// Pull request watch grouping, read planning, registration, and bounded sweeps.
// Network and GitHub decoding stay behind the injected github interface.

import { evaluateWatch, makeInitialDedupe, watchesEqual } from "./pr-watch-evaluator.mjs";
import { classifyRateLimit, updateHostQuota } from "./pr-watch-github.mjs";

const READ_FAILURE_LIMIT = 8;
const GROUP_READ_CONCURRENCY = 4;
const NO_CHECKS_MS = 15 * 60_000;
const QUIET_REREAD_MS = 10 * 60_000;
const FINGERPRINT_REREAD_MS = 30 * 60_000;
const QUOTA_ADMISSION_FLOOR = 0.1;
const FALLBACK_RATE_LIMIT_PAUSE_MS = 60_000;
const MAX_RATE_LIMIT_PAUSE_MS = 15 * 60_000;
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


function emptyHostState() {
  return {
    pausedUntil: null,
    pauseReason: null,
    rateLimits: {},
    consecutiveRateLimitFailures: 0,
    rateLimitGeneration: 0,
  };
}

function normalizeHostKey(host) {
  return typeof host === "string" && host.trim() ? host.trim().toLowerCase() : "github.com";
}

function hostStateOf(state, host) {
  const stored = state.hosts?.[host];
  if (!stored || typeof stored !== "object") return emptyHostState();
  return {
    ...emptyHostState(),
    ...clone(stored),
    rateLimits: clone(stored.rateLimits ?? {}),
  };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function retrySeconds(retryAtMs, nowMs) {
  return Math.max(0, Math.ceil((retryAtMs - nowMs) / 1_000));
}

function admissionPausedError(message, retryAtMs, nowMs) {
  return typedError("rate_limited", message, {
    retryable: true,
    retryAfter: retrySeconds(retryAtMs, nowMs),
  });
}

function fallbackRateLimitPauseMs(attempt) {
  return Math.min(
    FALLBACK_RATE_LIMIT_PAUSE_MS * 2 ** Math.max(0, attempt - 1),
    MAX_RATE_LIMIT_PAUSE_MS,
  );
}

function headersOf(response) {
  const headers = {};
  for (const [key, value] of Object.entries(response?.headers ?? {})) {
    if (value !== undefined && value !== null) headers[String(key).toLowerCase()] = String(value);
  }
  return headers;
}

function retryAtFromRateLimitHeaders(headers, nowMs) {
  const retryAfter = typeof headers["retry-after"] === "string" ? headers["retry-after"].trim() : "";
  if (retryAfter) {
    if (/^\d+$/u.test(retryAfter)) {
      const at = nowMs + Number(retryAfter) * 1_000;
      if (Number.isSafeInteger(at) && at > nowMs) return at;
    } else {
      const at = Date.parse(retryAfter);
      if (Number.isFinite(at) && at > nowMs) return at;
    }
  }
  const reset = Number(headers["x-ratelimit-reset"]) * 1_000;
  return Number.isFinite(reset) && reset > nowMs ? reset : null;
}

function responseHasCompleteQuotaObservation(response) {
  const headers = headersOf(response);
  const limit = Number(headers["x-ratelimit-limit"]);
  const remaining = Number(headers["x-ratelimit-remaining"]);
  const reset = Number(headers["x-ratelimit-reset"]);
  return typeof headers["x-ratelimit-resource"] === "string" &&
    headers["x-ratelimit-resource"].trim().length > 0 &&
    Number.isInteger(limit) && limit > 0 &&
    Number.isInteger(remaining) && remaining >= 0 &&
    Number.isFinite(reset);
}

/**
 * Bind a metadata transport to the durable quota and host-rate policy.
 * Every response is observed and settled through the state lock before the
 * caller can act on it; no local debit is ever invented.
 */
export function createQuotaAwareTransport({
  store,
  transport,
  credentialFingerprint = null,
  now = () => Date.now(),
} = {}) {
  if (!store || typeof store.readState !== "function" || typeof store.withStateLock !== "function") {
    throw typedError("invalid_arguments", "createQuotaAwareTransport requires a watch store.", { retryable: false });
  }
  if (!transport || typeof transport.graphql !== "function" || typeof transport.rest !== "function") {
    throw typedError("invalid_arguments", "createQuotaAwareTransport requires graphql and rest transport functions.", { retryable: false });
  }
  const nowMs = () => {
    const value = typeof now === "function" ? now() : Date.now();
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  };
  const hostSlots = new Map();

  async function withHostSlot(host, fn) {
    const normalizedHost = normalizeHostKey(host);
    let slots = hostSlots.get(normalizedHost);
    if (slots === undefined) {
      slots = { active: 0, queue: [] };
      hostSlots.set(normalizedHost, slots);
    }
    if (slots.active >= 8 || slots.queue.length > 0) {
      await new Promise((resolve) => slots.queue.push(resolve));
    } else {
      slots.active += 1;
    }
    try {
      return await fn();
    } finally {
      const next = slots.queue.shift();
      if (next === undefined) slots.active -= 1;
      else next();
    }
  }

  async function mutateHost(host, mutator, command) {
    const normalizedHost = normalizeHostKey(host);
    let result;
    await store.withStateLock(async () => {
      const state = await store.readState();
      const before = hostStateOf(state, normalizedHost);
      const next = mutator(clone(before), nowMs());
      result = next;
      if (state.hosts[normalizedHost] === undefined || !sameJson(before, next)) {
        state.hosts[normalizedHost] = next;
        state.updatedAt = iso(nowMs());
        await store.writeState(state);
      }
    }, { command });
    return result;
  }

  async function admit(host, resource) {
    const normalizedHost = normalizeHostKey(host);
    return store.withStateLock(async () => {
      const state = await store.readState();
      const hostState = hostStateOf(state, normalizedHost);
      const at = nowMs();
      const quota = hostState.rateLimits?.[resource];
      if (quota) {
        const resetAtMs = Date.parse(quota.resetAt);
        if (Number.isFinite(resetAtMs) && resetAtMs > at && quota.remaining < quota.limit * QUOTA_ADMISSION_FLOOR) {
          throw admissionPausedError(
            `GitHub ${resource} quota is paused until the stored reset time.`,
            resetAtMs,
            at,
          );
        }
      }
      const pausedAtMs = hostState.pausedUntil === null ? Number.NaN : Date.parse(hostState.pausedUntil);
      if (Number.isFinite(pausedAtMs) && pausedAtMs > at) {
        throw admissionPausedError(
          `GitHub requests to ${normalizedHost} are paused until the rate limit resets.`,
          pausedAtMs,
          at,
        );
      }
      return hostState.rateLimitGeneration;
    }, { command: "pr-watch admit" });
  }

  async function observeQuota(host, response) {
    if (!responseHasCompleteQuotaObservation(response)) return;
    await mutateHost(host, (current, at) =>
      updateHostQuota(current, { headers: headersOf(response) }, at),
    "pr-watch quota");
  }

  async function recordRateLimit(host, lease, retryAtInput) {
    return mutateHost(host, (current, at) => {
      const currentRetryAtMs = current.pausedUntil === null ? 0 : Date.parse(current.pausedUntil);
      if (current.rateLimitGeneration > lease) {
        if (currentRetryAtMs <= at && (retryAtInput == null || retryAtInput <= at)) return current;
        const retryAt = retryAtInput != null && retryAtInput > currentRetryAtMs
          ? retryAtInput
          : currentRetryAtMs;
        if (retryAt === currentRetryAtMs) return current;
        return {
          ...current,
          pausedUntil: iso(retryAt),
          pauseReason: "rate_limit",
        };
      }
      const attempt = current.consecutiveRateLimitFailures + 1;
      const proposedRetryAt = retryAtInput != null && retryAtInput > at
        ? retryAtInput
        : at + fallbackRateLimitPauseMs(attempt);
      const retryAt = currentRetryAtMs > at
        ? Math.max(currentRetryAtMs, proposedRetryAt)
        : proposedRetryAt;
      return {
        ...current,
        pausedUntil: iso(retryAt),
        pauseReason: "rate_limit",
        consecutiveRateLimitFailures: attempt,
        rateLimitGeneration: Math.max(current.rateLimitGeneration, lease) + 1,
      };
    }, "pr-watch rate-limit");
  }

  async function recordSuccess(host, lease) {
    await mutateHost(host, (current, at) => {
      const retryAtMs = current.pausedUntil === null ? 0 : Date.parse(current.pausedUntil);
      if (current.rateLimitGeneration !== lease || retryAtMs > at) return current;
      return {
        ...current,
        pausedUntil: null,
        pauseReason: null,
        consecutiveRateLimitFailures: 0,
      };
    }, "pr-watch rate-success");
  }

  function successfulTransportResponse(response) {
    const status = Number(response?.status ?? 200);
    return status >= 200 && status < 300;
  }

  async function request(resource, invoke, meta = {}) {
    const host = normalizeHostKey(meta.host);
    return withHostSlot(host, async () => {
      const lease = await admit(host, resource);
      const response = await invoke();
      await observeQuota(host, response);
      if (classifyRateLimit(response)) {
        const headers = headersOf(response);
        const retryAt = retryAtFromRateLimitHeaders(headers, nowMs());
        const settled = await recordRateLimit(host, lease, retryAt);
        const pauseMs = Date.parse(settled.pausedUntil);
        throw typedError("rate_limited", "GitHub rate limited the pull request watch read.", {
          retryable: true,
          retryAfter: Number.isFinite(pauseMs) ? retrySeconds(pauseMs, nowMs()) : undefined,
          requestId: response?.requestId ?? headers["x-github-request-id"] ?? undefined,
        });
      }
      if (successfulTransportResponse(response)) await recordSuccess(host, lease);
      return response;
    });
  }

  return {
    graphql: (query, variables, meta = {}) =>
      request("graphql", () => transport.graphql(query, variables, meta), meta),
    rest: (requestPath, meta = {}) =>
      request("core", () => transport.rest(requestPath, meta), meta),
    credentialFingerprint: typeof credentialFingerprint === "function"
      ? (host) => credentialFingerprint(host)
      : undefined,
  };
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

export function publicError(error, fallbackMessage = "The watch read failed.") {
  const reason = errorReason(error);
  const out = {
    reason,
    message: typeof error?.message === "string" && error.message ? error.message : fallbackMessage,
    retryable: error?.retryable === true,
  };
  if (typeof error?.retryAfter === "number") out.retryAfter = error.retryAfter;
  return out;
}

export function groupWatches(watches) {
  const groups = new Map();
  for (const watch of watches) {
    const key = watch.key ?? groupKeyOf(watch);
    let group = groups.get(key);
    if (group === undefined) {
      group = {
        key,
        host: watch.host,
        repo: watch.repo,
        pr: watch.pr,
        watches: [],
      };
      groups.set(key, group);
    }
    group.watches.push(watch);
  }
  return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function checksDue(watches, now) {
  return watches.some((watch) => {
    const dedupe = watch.dedupe ?? watch;
    if (dedupe.checksPending === undefined) return true;
    return dedupe.checksAwaitedSince != null &&
      now - Date.parse(dedupe.checksAwaitedSince) >= NO_CHECKS_MS;
  });
}

export function planGroupReads(group, read, fingerprint, now) {
  const watches = group.watches ?? [];
  if (read?.lastDetailAt == null) return { detail: true, activity: true };
  const due = checksDue(watches, now);
  if (fingerprint == null) {
    const activity =
      read.detailInFlight === true ||
      read.remarksIncomplete === true ||
      read.lastActivityAt == null ||
      now - Date.parse(read.lastActivityAt) >= QUIET_REREAD_MS;
    return { detail: activity || due, activity };
  }
  const activity =
    read.remarksFingerprint !== fingerprint.remarks ||
    read.remarksIncomplete === true ||
    read.lastActivityAt == null ||
    now - Date.parse(read.lastActivityAt) >= FINGERPRINT_REREAD_MS;
  return {
    detail:
      activity ||
      due ||
      read.statusFingerprint !== fingerprint.status ||
      read.detailInFlight === true,
    activity,
  };
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

function sameRead(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function normalizeGroupTarget(target) {
  const host = typeof target.host === "string" ? target.host.toLowerCase() : target.host;
  const normalized = { host, repo: target.repo, pr: target.pr };
  return {
    key: target.key ?? groupKeyOf(normalized),
    ...normalized,
  };
}

function fingerprintMap(value) {
  if (value instanceof Map) return value;
  const map = new Map();
  for (const entry of asArray(value)) {
    if (entry && typeof entry.key === "string") map.set(entry.key, entry);
  }
  return map;
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

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function selectedResultError(error) {
  return error ? publicError(error) : undefined;
}

function terminalDescriptor(detail) {
  if (detail.state === "merged") {
    return {
      type: "merged",
      data: {
        baseBranch: detail.baseBranch ?? "",
        mergeCommitSha: detail.mergeCommitSha ?? null,
        mergedBy: detail.mergedBy?.login ?? detail.mergedBy ?? null,
      },
    };
  }
  return {
    type: "closed",
    data: { baseBranch: detail.baseBranch ?? "" },
  };
}

async function prepareGroup({ group, read, fingerprintEntry, github, now, tailCache, isCanceled = null }) {
  const target = normalizeGroupTarget(group);
  const fp = fingerprintOf(fingerprintEntry);
  const groupNow = now();
  const fpError = fingerprintEntry?.error ?? null;
  if (fpError && errorReason(fpError) === "rate_limited") {
    return {
      group,
      target,
      beforeRead: clone(read ?? emptyGroupRead()),
      fingerprintEntry,
      plan: { detail: false, activity: false },
      detail: null,
      activity: null,
      detailError: null,
      activityError: null,
      outcome: "paused",
      error: fpError,
      skipCommit: true,
      now: groupNow,
      events: [],
    };
  }
  const plan = planGroupReads(group, read, fp, groupNow);
  const prepared = {
    group,
    target,
    beforeRead: clone(read ?? emptyGroupRead()),
    fingerprintEntry,
    plan,
    detail: null,
    activity: null,
    detailError: null,
    activityError: null,
    outcome: plan.detail || plan.activity ? "read" : "unchanged",
    error: null,
    now: groupNow,
    events: [],
  };
  throwIfCanceled(isCanceled);
  if (plan.detail) {
    try {
      prepared.detail = await github.readDetail(target);
    } catch (error) {
      prepared.detailError = error;
    }
  }
  throwIfCanceled(isCanceled);
  if (plan.activity) {
    try {
      prepared.activity = await github.readActivity({
        ...target,
        tailCache,
        tailCacheTtlMs: fp === null ? QUIET_REREAD_MS : FINGERPRINT_REREAD_MS,
      });
    } catch (error) {
      prepared.activityError = error;
    }
  }

  if (prepared.detailError) {
    prepared.outcome = errorReason(prepared.detailError) === "rate_limited" ? "paused" : "failed";
    prepared.error = prepared.detailError;
    return prepared;
  }
  if (prepared.activityError) {
    prepared.outcome = errorReason(prepared.activityError) === "rate_limited" ? "paused" : "failed";
    prepared.error = prepared.activityError;
  }

  if (!prepared.detail) return prepared;

  if (prepared.detail.state === "merged" || prepared.detail.state === "closed") {
    prepared.outcome = "ended";
    prepared.endReason = prepared.detail.state;
    prepared.events = [terminalDescriptor(prepared.detail)];
    return prepared;
  }

  const transitions = [];
  let exhausted = false;
  for (const watch of group.watches) {
    const evaluated = evaluateWatch({
      watch: watch.dedupe,
      detail: prepared.detail,
      remarks: prepared.activity?.remarks ?? null,
      now: groupNow,
    });
    const events = evaluated.events;
    transitions.push({ watch, evaluated, events });
    if (evaluated.exhausted) exhausted = true;
  }
  if (exhausted) {
    for (const transition of transitions) {
      transition.events.push({ type: "watch-ended", data: { reason: "comment-limit" } });
    }
    prepared.outcome = "ended";
    prepared.endReason = "comment-limit";
  }
  prepared.transitions = transitions;
  prepared.events = transitions.flatMap((transition) => transition.events.map((event) => ({
    ...event,
    watchId: transition.watch.id,
  })));
  return prepared;
}

export async function applySweep(store, prepared, now = () => Date.now(), isCanceled = null) {
  throwIfCanceled(isCanceled);
  return store.withStateLock(async () => {
    throwIfCanceled(isCanceled);
    const state = await store.readState();
    const key = prepared.target.key;
    const currentGroup = state.groups[key];
    const beforeRead = currentGroup?.read ?? emptyGroupRead();
    const liveWatches = prepared.group.watches.map((watch) => state.watches[watch.id]).filter(Boolean);
    const stale = liveWatches.length !== prepared.group.watches.length ||
      prepared.group.watches.some((watch, index) =>
        liveWatches[index]?.state !== "active" ||
        liveWatches[index]?.dedupe?.startedAt !== watch.dedupe?.startedAt
      );
    if (stale || !sameRead(beforeRead, prepared.beforeRead)) {
      return {
        id: key,
        outcome: "failed",
        detailRead: prepared.plan.detail,
        activityRead: prepared.plan.activity,
        eventCount: 0,
        error: {
          reason: "conflict",
          message: "The watch changed while its sweep read was in flight.",
          retryable: true,
        },
        events: [],
      };
    }

    if (prepared.skipCommit === true) {
      return {
        id: key,
        outcome: prepared.outcome,
        detailRead: prepared.plan.detail,
        activityRead: prepared.plan.activity,
        eventCount: 0,
        ...(prepared.error ? { error: selectedResultError(prepared.error) } : {}),
        events: [],
      };
    }

    const readMs = prepared.now;
    const commitMs = now();
    const commitAt = iso(commitMs);
    if (!state.groups[key]) state.groups[key] = makeGroupRow(prepared.target);
    state.groups[key].read = transitionGroupRead(beforeRead, prepared, readMs);

    const events = [];
    let anyEnded = false;
    if (prepared.detail && (prepared.detail.state === "merged" || prepared.detail.state === "closed")) {
      for (const prior of prepared.group.watches) {
        const watch = state.watches[prior.id];
        if (!watch) continue;
        const endedDedupe = clone(watch.dedupe);
        watch.state = "ended";
        watch.endedAt = commitAt;
        watch.endReason = prepared.detail.state;
        watch.updatedAt = commitAt;
        state.endedWatches[key] = {
          endedAt: commitAt,
          endReason: prepared.detail.state,
          lastWatchId: watch.id,
          dedupe: endedDedupe,
        };
        events.push(...materializeEvents(
          state,
          prepared.events,
          watch,
          prepared.detail.headSha ?? watch.dedupe.headSha ?? null,
          commitAt,
        ));
        anyEnded = true;
      }
    } else if (prepared.endReason === "comment-limit" && prepared.transitions) {
      for (const transition of prepared.transitions) {
        const watch = state.watches[transition.watch.id];
        if (!watch) continue;
        const endedDedupe = clone(transition.evaluated.next);
        watch.dedupe = clone(transition.evaluated.next);
        watch.state = "ended";
        watch.endedAt = commitAt;
        watch.endReason = "comment-limit";
        watch.updatedAt = commitAt;
        state.endedWatches[key] = {
          endedAt: commitAt,
          endReason: "comment-limit",
          lastWatchId: watch.id,
          dedupe: endedDedupe,
        };
        events.push(...materializeEvents(
          state,
          transition.events,
          watch,
          prepared.detail?.headSha ?? watch.dedupe.headSha ?? null,
          commitAt,
        ));
        anyEnded = true;
      }
    } else if (prepared.transitions) {
      for (const transition of prepared.transitions) {
        const watch = state.watches[transition.watch.id];
        if (!watch) continue;
        const next = clone(transition.evaluated.next);
        const changed = !watchesEqual(watch.dedupe, next);
        if (changed) {
          watch.dedupe = next;
          watch.updatedAt = commitAt;
        }
        events.push(...materializeEvents(
          state,
          transition.events,
          watch,
          prepared.detail?.headSha ?? watch.dedupe.headSha ?? null,
          commitAt,
        ));
      }
    } else if (!prepared.detail && prepared.detailError) {
      const failures = state.groups[key].read.consecutiveFailures;
      if (failures >= READ_FAILURE_LIMIT) {
        for (const prior of prepared.group.watches) {
          const watch = state.watches[prior.id];
          if (!watch) continue;
          const endedDedupe = clone(watch.dedupe);
          watch.state = "ended";
          watch.endedAt = commitAt;
          watch.endReason = "unreadable";
          watch.updatedAt = commitAt;
          state.endedWatches[key] = {
            endedAt: commitAt,
            endReason: "unreadable",
            lastWatchId: watch.id,
            dedupe: endedDedupe,
          };
          events.push(...materializeEvents(
            state,
            [{ type: "watch-ended", data: { reason: "unreadable" } }],
            watch,
            watch.dedupe.headSha ?? null,
            commitAt,
          ));
          anyEnded = true;
        }
      }
    }

    state.updatedAt = commitAt;
    await writeStateCancelAware(store, state, isCanceled);
    const outcome = anyEnded ? "ended" : prepared.outcome;
    return {
      id: key,
      outcome,
      detailRead: prepared.plan.detail,
      activityRead: prepared.plan.activity,
      eventCount: events.length,
      ...(prepared.error ? { error: selectedResultError(prepared.error) } : {}),
      events,
    };
  }, { command: "watches run", isCanceled });
}

function summarizeSweep(results, startedMs, finishedMs, watchCount, groupCount) {
  const summary = {
    succeeded: 0,
    failed: 0,
    skipped: 0,
    unknown: 0,
    startedAt: iso(startedMs),
    finishedAt: iso(finishedMs),
    durationMs: Math.max(0, finishedMs - startedMs),
    watchCount,
    groupCount,
    readGroupCount: results.filter((result) => result.detailRead || result.activityRead).length,
  };
  for (const result of results) {
    if (result.outcome === "failed") summary.failed += 1;
    else if (result.outcome === "paused") summary.skipped += 1;
    else summary.succeeded += 1;
  }
  let outcome = "completed";
  if (results.length > 0 && summary.skipped === results.length) outcome = "paused";
  else if (summary.succeeded === 0 && summary.failed > 0) outcome = "failed";
  else if (summary.failed > 0 || summary.skipped > 0) outcome = "partial";
  return { outcome, summary };
}

export async function runSweep({
  store,
  github,
  watchId = null,
  now = () => Date.now(),
  tailCache = null,
  isCanceled = null,
}) {
  throwIfCanceled(isCanceled);
  return store.withRunLock(async () => {
    throwIfCanceled(isCanceled);
    const startedMs = now();
    const state = await store.readState();
    let watches = Object.values(state.watches).filter((watch) => watch.state === "active");
    if (watchId != null) watches = watches.filter((watch) => watch.id === watchId);
    const groups = groupWatches(watches);
    if (groups.length === 0) {
      const empty = summarizeSweep([], startedMs, now(), 0, 0);
      return { ...empty, events: [], results: [] };
    }

    const slices = groups.map((group) => normalizeGroupTarget(group));
    throwIfCanceled(isCanceled);
    let fingerprintReads = new Map();
    let fingerprintFailure = null;
    try {
      fingerprintReads = fingerprintMap(await github.readFingerprints(slices));
    } catch (error) {
      fingerprintFailure = error;
    }

    const preparedGroups = await mapLimit(groups, GROUP_READ_CONCURRENCY, async (group) => {
      const key = group.key;
      const entry = fingerprintFailure
        ? { key, error: fingerprintFailure }
        : fingerprintEntry(fingerprintReads, key);
      return prepareGroup({
        group,
        read: state.groups[key]?.read ?? emptyGroupRead(),
        fingerprintEntry: entry,
        github,
        now,
        tailCache,
        isCanceled,
      });
    });

    const results = [];
    const events = [];
    for (const prepared of preparedGroups.sort((left, right) => left.target.key.localeCompare(right.target.key))) {
      const result = await applySweep(store, prepared, now, isCanceled);
      const { events: resultEvents, ...publicResult } = result;
      results.push(publicResult);
      events.push(...resultEvents);
    }
    events.sort((left, right) => left.seq - right.seq);
    const finishedMs = now();
    const roll = summarizeSweep(results, startedMs, finishedMs, watches.length, groups.length);
    return { ...roll, events, results };
  }, { command: "watches run", isCanceled });
}

