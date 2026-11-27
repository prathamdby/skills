// Pull request watch grouping, read planning, registration, and bounded sweeps.
// Network and GitHub decoding stay behind the injected github interface.

import { evaluateWatch, makeInitialDedupe } from "./pr-watch-evaluator.mjs";

const UNREADABLE_REASONS = new Set([
  "missing_tool",
  "login_required",
  "token_expired",
  "permission_denied",
  "not_found",
]);

export function typedError(reason, message, options = {}) {
  const error = new Error(message);
  error.reason = reason;
  if (options.retryable !== undefined) error.retryable = options.retryable;
  if (options.retryAfter !== undefined) error.retryAfter = options.retryAfter;
  if (options.requestId !== undefined) error.requestId = options.requestId;
  if (options.data !== undefined) error.data = options.data;
  return error;
}


export function groupKeyOf(target) {
  return `${target.host}:${target.repo}#${target.pr}`;
}

const iso = (ms) => new Date(ms).toISOString();
const clone = (value) => structuredClone(value);
const asArray = (value) => Array.isArray(value) ? value : [];

export function errorReason(error) {
  return error && typeof error.reason === "string" ? error.reason : "internal_error";
}

function detailInFlight(detail) {
  return detail?.mergeability === "unknown" ||
    asArray(detail?.checks).some((check) => check.status === "pending");
}

function emptyGroupRead() {
  return {
    lastFingerprintAt: null,
    lastDetailAt: null,
    lastActivityAt: null,
    statusFingerprint: null,
    remarksFingerprint: null,
    detailInFlight: true,
    remarksIncomplete: true,
    consecutiveFailures: 0,
    lastErrorReason: null,
  };
}

function normalizeGroupTarget(target) {
  const host = typeof target.host === "string" ? target.host.toLowerCase() : target.host;
  const normalized = { host, repo: target.repo, pr: target.pr };
  return {
    key: target.key ?? groupKeyOf(normalized),
    ...normalized,
  };
}

function keyEntry(map, key) {
  if (!map || typeof map !== "object") return null;
  if (map[key] !== undefined) return { key, value: map[key] };
  const lower = key.toLowerCase();
  for (const [candidateKey, value] of Object.entries(map)) {
    if (candidateKey.toLowerCase() === lower) return { key: candidateKey, value };
  }
  return null;
}

function fingerprintEntry(reads, key) {
  if (reads instanceof Map) return reads.get(key) ?? null;
  if (Array.isArray(reads)) return reads.find((entry) => entry?.key === key) ?? null;
  if (reads && typeof reads === "object") return reads[key] ?? null;
  return null;
}

function fingerprintOf(entry) {
  if (!entry) return null;
  if (entry.fingerprint && typeof entry.fingerprint === "object") return entry.fingerprint;
  if (typeof entry.status === "string" && typeof entry.remarks === "string") return entry;
  return null;
}

function materializeEvents(state, descriptors, watch, headSha, createdAt) {
  const events = [];
  for (const descriptor of descriptors) {
    const seq = state.nextEventSeq;
    state.nextEventSeq += 1;
    const event = {
      id: `evt_${String(seq).padStart(6, "0")}`,
      seq,
      watchId: watch.id,
      type: descriptor.type,
      createdAt,
      host: watch.host,
      repo: watch.repo,
      pr: watch.pr,
      headSha: headSha ?? null,
      url: watch.url,
      data: descriptor.data ?? {},
    };
    state.events.push(event);
    events.push(event);
  }
  if (state.events.length > 500) state.events.splice(0, state.events.length - 500);
  return events;
}

function makeGroupRow(target) {
  return {
    key: target.key,
    host: target.host,
    repo: target.repo,
    pr: target.pr,
    read: emptyGroupRead(),
  };
}

function readTimestamp(value, fallback) {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return value;
  if (typeof value === "number" && Number.isFinite(value)) return iso(value);
  return fallback;
}

function transitionGroupRead(before, prepared, nowMs) {
  const next = clone(before ?? emptyGroupRead());
  const nowIso = iso(nowMs);
  const fp = fingerprintOf(prepared.fingerprintEntry);
  if (fp !== null) next.lastFingerprintAt = nowIso;

  if (prepared.detailError) {
    next.lastDetailAt = null;
    next.statusFingerprint = null;
    next.remarksFingerprint = null;
    next.detailInFlight = true;
    next.remarksIncomplete = true;
    const reason = errorReason(prepared.detailError);
    if (reason === "rate_limited") {
      // A pause is not evidence that the pull request became unreadable.
    } else if (UNREADABLE_REASONS.has(reason)) {
      next.consecutiveFailures = (before?.consecutiveFailures ?? 0) + 1;
    } else {
      next.consecutiveFailures = 0;
    }
  } else if (prepared.detail) {
    next.lastDetailAt = nowIso;
    next.statusFingerprint = fp?.status ?? null;
    next.remarksFingerprint = fp?.remarks ?? null;
    next.detailInFlight = detailInFlight(prepared.detail);
    next.consecutiveFailures = 0;
  }

  if (prepared.plan.activity) {
    next.lastActivityAt = prepared.activity
      ? readTimestamp(prepared.activity.fetchedAt, nowIso)
      : nowIso;
    if (prepared.activity) {
      next.remarksIncomplete = prepared.activity.complete !== true;
    } else if (prepared.activityError) {
      next.remarksIncomplete = true;
    }
  }

  if (prepared.plan.detail || prepared.plan.activity) {
    if (prepared.detailError) next.lastErrorReason = errorReason(prepared.detailError);
    else if (prepared.activityError) next.lastErrorReason = errorReason(prepared.activityError);
    else next.lastErrorReason = null;
  }
  return next;
}

function registrationInput({ startedAt, checksPending, carried }) {
  return makeInitialDedupe({
    startedAt,
    remarksThrough: startedAt,
    checksPending,
    carried,
  });
}

function summaryOf(watch) {
  return {
    id: watch.id,
    key: watch.key,
    host: watch.host,
    repo: watch.repo,
    pr: watch.pr,
    state: watch.state,
    createdAt: watch.createdAt,
    updatedAt: watch.updatedAt,
    endedAt: watch.endedAt,
    endReason: watch.endReason,
    url: watch.url,
  };
}

function warning(reason, message, data) {
  return data === undefined ? { reason, message } : { reason, message, data };
}

function throwIfCanceled(isCanceled) {
  if (typeof isCanceled === "function" && isCanceled()) {
    throw typedError("canceled", "Canceled.", { retryable: false });
  }
}

async function writeStateCancelAware(store, state, isCanceled) {
  throwIfCanceled(isCanceled);
  try {
    return await store.writeState(state);
  } catch (error) {
    throwIfCanceled(isCanceled);
    throw error;
  }
}

function enterpriseWarnings(host) {
  return typeof host === "string" && host.toLowerCase() !== "github.com"
    ? [warning(
        "enterprise_degraded",
        "Enterprise GitHub reads omit required-check and merge-queue metadata when the host cannot support them.",
      )]
    : [];
}

function checkBaselineUntrusted(detail) {
  return detail?.checksTrusted === false ||
    asArray(detail?.checks).some((check) => check.placeholder === true);
}

export async function addWatch({
  store,
  github,
  host,
  repo,
  pr,
  id,
  now = () => Date.now(),
  isCanceled = null,
}) {
  const target = normalizeGroupTarget({ host, repo, pr });
  const key = target.key;
  const before = await store.readState();
  const existing = Object.values(before.watches).find((watch) =>
    watch.state === "active" &&
    watch.key.toLowerCase() === key.toLowerCase()
  );
  if (existing) {
    return { watch: summaryOf(existing), outcome: "unchanged", events: [], warnings: enterpriseWarnings(target.host) };
  }

  let seedEntry = null;
  let fingerprintError = null;
  let fingerprintAt = null;
  throwIfCanceled(isCanceled);
  try {
    fingerprintAt = now();
    const reads = await github.readFingerprints([{ ...target, key }], { includeRollupState: true });
    seedEntry = fingerprintEntry(reads, key);
  } catch (error) {
    fingerprintError = error;
  }

  const ended = keyEntry(before.endedWatches, key)?.value ?? null;
  const fp = fingerprintOf(seedEntry);
  const seededPending = fp && seedEntry?.checksPending === true;
  const carryPending = ended?.dedupe?.checksPending === true;
  const checksPending = seededPending === true || (fp == null && carryPending);

  throwIfCanceled(isCanceled);
  const detail = await github.readDetail(target);
  if (detail.state === "merged" || detail.state === "closed") {
    throw typedError("conflict", `Pull request #${pr} is already ${detail.state}.`, {
      retryable: false,
      data: { state: detail.state },
    });
  }

  let activity = null;
  let activityError = null;
  throwIfCanceled(isCanceled);
  try {
    activity = await github.readActivity(target);
  } catch (error) {
    activityError = error;
  }

  const untrustedChecks = checkBaselineUntrusted(detail);
  const incompleteActivity = activity == null || activity.complete !== true;
  const warnings = enterpriseWarnings(target.host);
  if (untrustedChecks || incompleteActivity) {
    warnings.push(warning(
      "baseline_incomplete",
      "The first watch baseline is incomplete; polling will finish it before trusting that side.",
      {
        checks: untrustedChecks ? "untrusted" : "trusted",
        activity: incompleteActivity ? "incomplete" : "complete",
      },
    ));
  }

  throwIfCanceled(isCanceled);
  return store.withStateLock(async () => {
    throwIfCanceled(isCanceled);
    const state = await store.readState();
    const currentExisting = Object.values(state.watches).find((watch) =>
      watch.state === "active" && watch.key.toLowerCase() === key.toLowerCase()
    );
    if (currentExisting) {
      return { watch: summaryOf(currentExisting), outcome: "unchanged", events: [], warnings: enterpriseWarnings(target.host) };
    }

    const commitMs = now();
    const commitAt = iso(commitMs);
    const canonicalRepo = detail.repository ?? target.repo;
    const canonicalKey = `${target.host}:${canonicalRepo}#${target.pr}`;
    const currentEnded = keyEntry(state.endedWatches, canonicalKey)?.value ?? null;
    const input = registrationInput({
      startedAt: commitAt,
      checksPending,
      carried: currentEnded?.dedupe ?? null,
    });
    const evaluated = evaluateWatch({
      watch: input,
      detail,
      remarks: activity?.remarks ?? null,
      now: commitMs,
    });
    const firstTime = currentEnded == null;
    const descriptors = firstTime ? [] : evaluated.events;
    const watchId = id ?? makeWatchId(state);
    const nextDedupe = { ...evaluated.next };
    if (untrustedChecks && nextDedupe.awaitingBaseline === undefined) {
      nextDedupe.awaitingBaseline = "checks";
    }
    const watch = {
      id: watchId,
      key,
      host: target.host,
      repo: canonicalRepo,
      pr: target.pr,
      url: detail.url,
      state: "active",
      createdAt: commitAt,
      updatedAt: commitAt,
      endedAt: null,
      endReason: null,
      dedupe: nextDedupe,
    };
    watch.key = canonicalKey;
    state.watches[watchId] = watch;

    const prepared = {
      plan: { detail: true, activity: true },
      fingerprintEntry: seedEntry,
      detail,
      activity,
      detailError: null,
      activityError,
    };
    const priorGroup = keyEntry(state.groups, watch.key)?.value ?? null;
    const group = makeGroupRow({ ...target, key: watch.key, repo: watch.repo });
    group.read = transitionGroupRead(priorGroup?.read ?? null, prepared, commitMs);
    if (fingerprintAt != null && fp != null && fingerprintError == null) {
      group.read.lastFingerprintAt = iso(fingerprintAt);
    }
    state.groups[watch.key] = group;

    const events = materializeEvents(state, descriptors, watch, detail.headSha ?? null, commitAt);
    state.updatedAt = commitAt;
    await writeStateCancelAware(store, state, isCanceled);
    return {
      watch: summaryOf(watch),
      outcome: "added",
      events,
      warnings,
    };
  }, { command: "watches add", isCanceled });
}

function makeWatchId(state) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(5));
    let suffix = "";
    for (const byte of bytes) suffix += alphabet[byte % 36];
    const id = `w_${suffix}`;
    if (state.watches[id] === undefined) return id;
  }
}

