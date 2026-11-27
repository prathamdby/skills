import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const STATE_VERSION = 1;
export const EVENT_RETENTION = 500;
export const DEFAULT_STATE_PATH = path.join(os.homedir(), ".gh-watch", "state.json");

const OWNER_FILE = "owner.json";
const MAX_HEARTBEAT_MS = 5_000;
const END_REASONS = new Set(["removed", "merged", "closed", "unreadable", "comment-limit"]);
const EVENT_TYPES = new Set([
  "checks-failed",
  "checks-passed",
  "checks-finished",
  "checks-awaiting-approval",
  "remarks",
  "no-checks",
  "conflicting",
  "needs-rebase",
  "merge-queue-removed",
  "merged",
  "closed",
  "watch-ended",
]);
const WATCH_ID_RE = /^w_[0-9a-z]{5}$/;
const HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5]))?$/;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const lockContext = new AsyncLocalStorage();

function typedError(reason, message, options = {}) {
  const error = new Error(message);
  error.name = "WatchStoreError";
  error.reason = reason;
  if (options.retryable !== undefined) error.retryable = options.retryable;
  if (options.data !== undefined) error.data = options.data;
  return error;
}

function invalidConfig(message, path, data = {}) {
  return typedError("invalid_config", message, {
    retryable: false,
    data: { path, ...data },
  });
}

function invalidArguments(message, data = {}) {
  return typedError("invalid_arguments", message, {
    retryable: false,
    data,
  });
}

function lockConflict(message, data = {}) {
  return typedError("conflict", message, {
    retryable: true,
    data,
  });
}

function throwIfLockCanceled(isCanceled) {
  if (typeof isCanceled === "function" && isCanceled()) {
    throw typedError("canceled", "Canceled.", { retryable: false });
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIsoString(value) {
  if (typeof value !== "string" || !ISO_UTC_RE.test(value)) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/.exec(value);
  const ms = Date.parse(value);
  if (!match || !Number.isFinite(ms)) return false;
  const date = new Date(ms);
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidHost(value) {
  return typeof value === "string" && HOST_RE.test(value);
}

function isValidRepo(value) {
  if (typeof value !== "string") return false;
  const parts = value.split("/");
  return parts.length === 2 && parts.every((part) =>
    part.length > 0 && part !== "." && part !== ".." && /^[A-Za-z0-9._-]+$/.test(part)
  );
}

function targetKey(value) {
  return `${value.host}:${value.repo}#${value.pr}`;
}

function fail(path, message, data) {
  throw invalidConfig(message, path, data);
}

function assertExactKeys(value, allowed, path, optional = []) {
  const expected = new Set(allowed);
  const optionalKeys = new Set(optional);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) fail(`${path}.${key}`, "The state contains an unknown fixed-shape key.", { key });
  }
  for (const key of allowed) {
    if (!optionalKeys.has(key) && !(key in value)) {
      fail(`${path}.${key}`, "The state is missing a required key.", { key });
    }
  }
}

function requireCondition(condition, path, message, data) {
  if (!condition) fail(path, message, data);
}

function validateIso(value, path) {
  requireCondition(isIsoString(value), path, "Expected an ISO 8601 UTC timestamp.");
}

function validateNullableIso(value, path) {
  requireCondition(value === null || isIsoString(value), path, "Expected an ISO 8601 UTC timestamp or null.");
}

function validateNonEmptyStringArray(value, path) {
  requireCondition(Array.isArray(value), path, "Expected an array.");
  for (const [index, item] of value.entries()) {
    requireCondition(isNonEmptyString(item), `${path}.${index}`, "Expected a nonempty string.");
  }
}

function validateDedupe(value, path) {
  if (!isPlainObject(value)) fail(path, "Expected a watch dedupe object.");
  assertExactKeys(value, [
    "startedAt",
    "headSha",
    "failedChecks",
    "passed",
    "passedChecks",
    "owedChecks",
    "awaitingApproval",
    "approvalAnnounced",
    "remarksThrough",
    "remarkIds",
    "conflicting",
    "rebaseRequired",
    "mergeQueueRemovalId",
    "checksAwaitedSince",
    "checksPending",
    "awaitingBaseline",
    "wakes",
  ], path, [
    "rebaseRequired",
    "mergeQueueRemovalId",
    "checksAwaitedSince",
    "checksPending",
    "awaitingBaseline",
  ]);
  validateIso(value.startedAt, `${path}.startedAt`);
  requireCondition(value.headSha === null || isNonEmptyString(value.headSha), `${path}.headSha`, "Expected a nonempty string or null.");
  validateNonEmptyStringArray(value.failedChecks, `${path}.failedChecks`);
  requireCondition(typeof value.passed === "boolean", `${path}.passed`, "Expected a boolean.");
  validateNonEmptyStringArray(value.passedChecks, `${path}.passedChecks`);
  validateNonEmptyStringArray(value.owedChecks, `${path}.owedChecks`);
  validateNonEmptyStringArray(value.awaitingApproval, `${path}.awaitingApproval`);
  requireCondition(typeof value.approvalAnnounced === "boolean", `${path}.approvalAnnounced`, "Expected a boolean.");
  validateIso(value.remarksThrough, `${path}.remarksThrough`);
  validateNonEmptyStringArray(value.remarkIds, `${path}.remarkIds`);
  requireCondition(typeof value.conflicting === "boolean", `${path}.conflicting`, "Expected a boolean.");
  if ("rebaseRequired" in value) {
    requireCondition(typeof value.rebaseRequired === "boolean", `${path}.rebaseRequired`, "Expected a boolean when present.");
  }
  if ("mergeQueueRemovalId" in value) {
    requireCondition(value.mergeQueueRemovalId === null || isNonEmptyString(value.mergeQueueRemovalId), `${path}.mergeQueueRemovalId`, "Expected a nonempty string or null when present.");
  }
  if ("checksAwaitedSince" in value) {
    requireCondition(value.checksAwaitedSince === null || isIsoString(value.checksAwaitedSince), `${path}.checksAwaitedSince`, "Expected an ISO 8601 UTC timestamp or null when present.");
  }
  if ("checksPending" in value) {
    requireCondition(typeof value.checksPending === "boolean", `${path}.checksPending`, "Expected a boolean when present.");
  }
  if ("awaitingBaseline" in value) {
    requireCondition(value.awaitingBaseline === "checks", `${path}.awaitingBaseline`, "Durable awaitingBaseline must be exactly checks.");
  }
  requireCondition(isNonNegativeInteger(value.wakes), `${path}.wakes`, "Expected a nonnegative integer.");
}

function validateTargetFields(value, path) {
  requireCondition(isValidHost(value.host), `${path}.host`, "Expected a lowercase hostname with an optional valid port.");
  requireCondition(isValidRepo(value.repo), `${path}.repo`, "Expected an owner/repository name.");
  requireCondition(isPositiveInteger(value.pr), `${path}.pr`, "Expected a positive integer pull request number.");
  requireCondition(value.key === targetKey(value), `${path}.key`, "The embedded key does not match host, repo, and pr.", {
    expected: targetKey(value),
  });
}

function validateWatchRow(mapKey, value, path) {
  if (!isPlainObject(value)) fail(path, "Expected a watch object.");
  assertExactKeys(value, [
    "id",
    "key",
    "host",
    "repo",
    "pr",
    "url",
    "state",
    "createdAt",
    "updatedAt",
    "endedAt",
    "endReason",
    "dedupe",
  ], path);
  requireCondition(WATCH_ID_RE.test(value.id), `${path}.id`, "Expected a watch id in the form w_ plus five lowercase base36 characters.");
  requireCondition(value.id === mapKey, `${path}.id`, "The embedded watch id does not match its containing object key.", {
    expected: mapKey,
  });
  validateTargetFields(value, path);
  requireCondition(isNonEmptyString(value.url), `${path}.url`, "Expected the pull request HTML URL.");
  requireCondition(value.state === "active" || value.state === "ended", `${path}.state`, "Expected active or ended.");
  validateIso(value.createdAt, `${path}.createdAt`);
  validateIso(value.updatedAt, `${path}.updatedAt`);
  if (value.state === "active") {
    requireCondition(value.endedAt === null, `${path}.endedAt`, "An active watch must have a null endedAt.");
    requireCondition(value.endReason === null, `${path}.endReason`, "An active watch must have a null endReason.");
  } else {
    validateIso(value.endedAt, `${path}.endedAt`);
    requireCondition(END_REASONS.has(value.endReason), `${path}.endReason`, "Expected a known watch end reason.");
  }
  validateDedupe(value.dedupe, `${path}.dedupe`);
}

function validateGroupRead(value, path) {
  if (!isPlainObject(value)) fail(path, "Expected a group read object.");
  assertExactKeys(value, [
    "lastFingerprintAt",
    "lastDetailAt",
    "lastActivityAt",
    "statusFingerprint",
    "remarksFingerprint",
    "detailInFlight",
    "remarksIncomplete",
    "consecutiveFailures",
    "lastErrorReason",
  ], path);
  validateNullableIso(value.lastFingerprintAt, `${path}.lastFingerprintAt`);
  validateNullableIso(value.lastDetailAt, `${path}.lastDetailAt`);
  validateNullableIso(value.lastActivityAt, `${path}.lastActivityAt`);
  requireCondition(value.statusFingerprint === null || typeof value.statusFingerprint === "string", `${path}.statusFingerprint`, "Expected a string or null.");
  requireCondition(value.remarksFingerprint === null || typeof value.remarksFingerprint === "string", `${path}.remarksFingerprint`, "Expected a string or null.");
  requireCondition(typeof value.detailInFlight === "boolean", `${path}.detailInFlight`, "Expected a boolean.");
  requireCondition(typeof value.remarksIncomplete === "boolean", `${path}.remarksIncomplete`, "Expected a boolean.");
  requireCondition(isNonNegativeInteger(value.consecutiveFailures), `${path}.consecutiveFailures`, "Expected a nonnegative integer.");
  requireCondition(value.lastErrorReason === null || isNonEmptyString(value.lastErrorReason), `${path}.lastErrorReason`, "Expected a nonempty reason string or null.");
}

function validateGroupRow(mapKey, value, path) {
  if (!isPlainObject(value)) fail(path, "Expected a group object.");
  assertExactKeys(value, ["key", "host", "repo", "pr", "read"], path);
  requireCondition(value.key === mapKey, `${path}.key`, "The embedded group key does not match its containing object key.", {
    expected: mapKey,
  });
  validateTargetFields(value, path);
  validateGroupRead(value.read, `${path}.read`);
}

function validateEndedRow(value, path) {
  if (!isPlainObject(value)) fail(path, "Expected an ended-watch object.");
  assertExactKeys(value, ["endedAt", "endReason", "lastWatchId", "dedupe"], path);
  validateIso(value.endedAt, `${path}.endedAt`);
  requireCondition(END_REASONS.has(value.endReason), `${path}.endReason`, "Expected a known watch end reason.");
  requireCondition(WATCH_ID_RE.test(value.lastWatchId), `${path}.lastWatchId`, "Expected a valid retained watch id.");
  validateDedupe(value.dedupe, `${path}.dedupe`);
}

function validateRateLimit(value, path) {
  if (!isPlainObject(value)) fail(path, "Expected a rate-limit object.");
  assertExactKeys(value, ["limit", "remaining", "used", "resetAt"], path);
  requireCondition(isPositiveInteger(value.limit), `${path}.limit`, "Expected a positive integer.");
  requireCondition(isNonNegativeInteger(value.remaining), `${path}.remaining`, "Expected a nonnegative integer.");
  requireCondition(value.used === null || isNonNegativeInteger(value.used), `${path}.used`, "Expected a nonnegative integer or null.");
  validateIso(value.resetAt, `${path}.resetAt`);
}

function validateHostRow(mapKey, value, path) {
  if (!isPlainObject(value)) fail(path, "Expected a host object.");
  requireCondition(isValidHost(mapKey), path, "Expected a lowercase hostname with an optional valid port.");
  assertExactKeys(value, [
    "pausedUntil",
    "pauseReason",
    "rateLimits",
    "consecutiveRateLimitFailures",
    "rateLimitGeneration",
  ], path);
  validateNullableIso(value.pausedUntil, `${path}.pausedUntil`);
  requireCondition(value.pauseReason === null || value.pauseReason === "rate_limit", `${path}.pauseReason`, "Expected rate_limit or null.");
  if (!isPlainObject(value.rateLimits)) fail(`${path}.rateLimits`, "Expected a rate-limit map.");
  for (const [resource, entry] of Object.entries(value.rateLimits)) {
    requireCondition(isNonEmptyString(resource), `${path}.rateLimits`, "Rate-limit resource keys must be nonempty.");
    validateRateLimit(entry, `${path}.rateLimits.${resource}`);
  }
  requireCondition(isNonNegativeInteger(value.consecutiveRateLimitFailures), `${path}.consecutiveRateLimitFailures`, "Expected a nonnegative integer.");
  requireCondition(isNonNegativeInteger(value.rateLimitGeneration), `${path}.rateLimitGeneration`, "Expected a nonnegative integer.");
}

function validateCheckRef(value, path) {
  if (!isPlainObject(value)) fail(path, "Expected a check reference object.");
  assertExactKeys(value, ["name", "url"], path);
  requireCondition(isNonEmptyString(value.name), `${path}.name`, "Expected a nonempty check name.");
  requireCondition(value.url === null || typeof value.url === "string", `${path}.url`, "Expected a string or null.");
}

function validateCheckRefs(value, path) {
  requireCondition(Array.isArray(value), path, "Expected an array.");
  for (const [index, item] of value.entries()) validateCheckRef(item, `${path}.${index}`);
}

function validateEventData(type, value, path) {
  if (!isPlainObject(value)) fail(path, "Expected an event data object.");
  switch (type) {
    case "checks-failed":
    case "checks-awaiting-approval":
      assertExactKeys(value, ["checks"], path);
      validateCheckRefs(value.checks, `${path}.checks`);
      return;
    case "checks-passed":
      assertExactKeys(value, ["count", "required"], path);
      requireCondition(isNonNegativeInteger(value.count), `${path}.count`, "Expected a nonnegative integer.");
      requireCondition(typeof value.required === "boolean", `${path}.required`, "Expected a boolean.");
      return;
    case "checks-finished":
      assertExactKeys(value, ["passed", "failing"], path);
      requireCondition(isNonNegativeInteger(value.passed), `${path}.passed`, "Expected a nonnegative integer.");
      validateCheckRefs(value.failing, `${path}.failing`);
      return;
    case "remarks":
      assertExactKeys(value, ["count"], path);
      requireCondition(isPositiveInteger(value.count), `${path}.count`, "Expected a positive integer.");
      return;
    case "no-checks":
      assertExactKeys(value, ["minutes"], path);
      requireCondition(isNonNegativeInteger(value.minutes), `${path}.minutes`, "Expected a nonnegative integer.");
      return;
    case "conflicting":
    case "needs-rebase":
      assertExactKeys(value, [], path);
      return;
    case "merge-queue-removed":
      assertExactKeys(value, ["reason"], path);
      requireCondition(value.reason === null || typeof value.reason === "string", `${path}.reason`, "Expected a string or null.");
      return;
    case "merged":
      assertExactKeys(value, ["baseBranch", "mergeCommitSha", "mergedBy"], path);
      requireCondition(typeof value.baseBranch === "string", `${path}.baseBranch`, "Expected a string.");
      requireCondition(value.mergeCommitSha === null || typeof value.mergeCommitSha === "string", `${path}.mergeCommitSha`, "Expected a string or null.");
      requireCondition(value.mergedBy === null || typeof value.mergedBy === "string", `${path}.mergedBy`, "Expected a string or null.");
      return;
    case "closed":
      assertExactKeys(value, ["baseBranch"], path);
      requireCondition(typeof value.baseBranch === "string", `${path}.baseBranch`, "Expected a string.");
      return;
    case "watch-ended":
      assertExactKeys(value, ["reason"], path);
      requireCondition(value.reason === "unreadable" || value.reason === "comment-limit", `${path}.reason`, "Expected unreadable or comment-limit.");
      return;
    default:
      fail(path, "Unknown event type.", { type });
  }
}

function validateEvent(value, path) {
  if (!isPlainObject(value)) fail(path, "Expected an event object.");
  assertExactKeys(value, [
    "id",
    "seq",
    "watchId",
    "type",
    "createdAt",
    "host",
    "repo",
    "pr",
    "headSha",
    "url",
    "data",
  ], path);
  requireCondition(isPositiveInteger(value.seq), `${path}.seq`, "Expected a positive integer event sequence.");
  requireCondition(value.id === eventId(value.seq), `${path}.id`, "The event id does not match its sequence.", {
    expected: eventId(value.seq),
  });
  requireCondition(typeof value.watchId === "string", `${path}.watchId`, "Expected a retained watch id.");
  requireCondition(EVENT_TYPES.has(value.type), `${path}.type`, "Expected a known event type.");
  validateIso(value.createdAt, `${path}.createdAt`);
  requireCondition(isValidHost(value.host), `${path}.host`, "Expected a lowercase hostname with an optional valid port.");
  requireCondition(isValidRepo(value.repo), `${path}.repo`, "Expected an owner/repository name.");
  requireCondition(isPositiveInteger(value.pr), `${path}.pr`, "Expected a positive integer pull request number.");
  requireCondition(value.headSha === null || isNonEmptyString(value.headSha), `${path}.headSha`, "Expected a nonempty string or null.");
  requireCondition(isNonEmptyString(value.url), `${path}.url`, "Expected the pull request HTML URL.");
  validateEventData(value.type, value.data, `${path}.data`);
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key, index) => key === rightKeys[index] && deepEqual(left[key], right[key]));
  }
  return false;
}

function validateMap(value, path) {
  if (!isPlainObject(value)) fail(path, "Expected an object map.");
}

export function validateState(state) {
  if (!isPlainObject(state)) throw invalidConfig("Watch state must be an object.", "state");
  assertExactKeys(state, [
    "version",
    "createdAt",
    "updatedAt",
    "nextEventSeq",
    "watches",
    "groups",
    "endedWatches",
    "hosts",
    "events",
  ], "state");
  requireCondition(state.version === STATE_VERSION, "state.version", "Unsupported watch state schema version.", {
    expected: STATE_VERSION,
  });
  validateIso(state.createdAt, "state.createdAt");
  validateIso(state.updatedAt, "state.updatedAt");
  requireCondition(isPositiveInteger(state.nextEventSeq), "state.nextEventSeq", "Expected a positive integer.");
  validateMap(state.watches, "state.watches");
  validateMap(state.groups, "state.groups");
  validateMap(state.endedWatches, "state.endedWatches");
  validateMap(state.hosts, "state.hosts");
  requireCondition(Array.isArray(state.events), "state.events", "Expected an event array.");
  requireCondition(state.events.length <= EVENT_RETENTION, "state.events", "The event log exceeds its retention bound.", {
    retention: EVENT_RETENTION,
  });

  for (const [id, watch] of Object.entries(state.watches)) validateWatchRow(id, watch, `state.watches.${id}`);
  for (const [key, group] of Object.entries(state.groups)) validateGroupRow(key, group, `state.groups.${key}`);
  for (const [key, ended] of Object.entries(state.endedWatches)) validateEndedRow(ended, `state.endedWatches.${key}`);
  for (const [host, row] of Object.entries(state.hosts)) validateHostRow(host, row, `state.hosts.${host}`);
  for (const [index, event] of state.events.entries()) validateEvent(event, `state.events.${index}`);

  const activeKeys = new Set();
  for (const [id, watch] of Object.entries(state.watches)) {
    if (watch.state !== "active") continue;
    const identity = watch.key.toLowerCase();
    requireCondition(!activeKeys.has(identity), `state.watches.${id}.key`, "Duplicate active watches for one pull request group are not valid.", {
      key: watch.key,
    });
    activeKeys.add(identity);
  }

  for (const [id, watch] of Object.entries(state.watches)) {
    requireCondition(state.groups[watch.key] !== undefined, `state.watches.${id}.key`, "Every stored watch requires a group row.", {
      key: watch.key,
    });
  }

  const eventSeqs = new Set();
  let previousSeq = 0;
  for (const [index, event] of state.events.entries()) {
    requireCondition(event.seq < state.nextEventSeq, `state.events.${index}.seq`, "Event sequence numbers must remain below nextEventSeq.");
    requireCondition(!eventSeqs.has(event.seq), `state.events.${index}.seq`, "Event sequence numbers must be unique.");
    requireCondition(event.seq > previousSeq, `state.events.${index}.seq`, "Events must be stored ascending by sequence.");
    eventSeqs.add(event.seq);
    previousSeq = event.seq;
    requireCondition(state.watches[event.watchId] !== undefined, `state.events.${index}.watchId`, "Every event must reference a retained watch row.", {
      watchId: event.watchId,
    });
  }

  for (const [key, ended] of Object.entries(state.endedWatches)) {
    const watch = state.watches[ended.lastWatchId];
    requireCondition(watch !== undefined, `state.endedWatches.${key}.lastWatchId`, "An ended-watch row must reference a retained watch row.", {
      watchId: ended.lastWatchId,
    });
    requireCondition(watch.key === key, `state.endedWatches.${key}.lastWatchId`, "The ended-watch key does not match its last watch row.", {
      key,
    });
    requireCondition(watch.state === "ended", `state.endedWatches.${key}.lastWatchId`, "The referenced last watch must be ended.");
    requireCondition(deepEqual(ended.dedupe, watch.dedupe), `state.endedWatches.${key}.dedupe`, "Ended-watch dedupe does not match the last watch row.");
  }

  return state;
}

export function initialState(nowIso = new Date().toISOString()) {
  if (!isIsoString(nowIso)) {
    throw invalidArguments("initialState requires an ISO 8601 UTC timestamp.");
  }
  return {
    version: STATE_VERSION,
    createdAt: nowIso,
    updatedAt: nowIso,
    nextEventSeq: 1,
    watches: {},
    groups: {},
    endedWatches: {},
    hosts: {},
    events: [],
  };
}

export function eventId(seq) {
  if (!isPositiveInteger(seq)) throw invalidArguments("eventId requires a positive integer sequence.");
  return `evt_${String(seq).padStart(6, "0")}`;
}

function cloneJson(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function watchSummary(watch) {
  if (!isPlainObject(watch)) throw invalidArguments("watchSummary requires a watch object.");
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

function emptyHostState() {
  return {
    pausedUntil: null,
    pauseReason: null,
    rateLimits: {},
    consecutiveRateLimitFailures: 0,
    rateLimitGeneration: 0,
  };
}

export function watchDetail(watch, group, host) {
  if (!isPlainObject(watch)) throw invalidArguments("watchDetail requires a watch object.");
  if (!isPlainObject(group) || group.key !== watch.key || !isPlainObject(group.read)) {
    throw invalidArguments("watchDetail requires the watch's complete group row.");
  }
  if (host !== undefined && host !== null && !isPlainObject(host)) {
    throw invalidArguments("watchDetail requires a complete host object or null.");
  }
  return {
    ...watchSummary(watch),
    dedupe: cloneJson(watch.dedupe),
    read: cloneJson(group.read),
    quota: cloneJson(host ?? emptyHostState()),
  };
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

function namesOf(checks) {
  return checks.map((check) => check.name).join(", ");
}

export function eventSummary(event) {
  if (!isPlainObject(event)) throw invalidArguments("eventSummary requires an event object.");
  const data = isPlainObject(event.data) ? event.data : {};
  switch (event.type) {
    case "checks-failed": {
      const checks = Array.isArray(data.checks) ? data.checks : [];
      return `${checks.length} failing ${plural(checks.length, "check")}: ${namesOf(checks)}`;
    }
    case "checks-passed":
      return data.required === true
        ? `${data.count ?? 0} required ${plural(data.count ?? 0, "check")} passed`
        : `${data.count ?? 0} advisory ${plural(data.count ?? 0, "check")} passed`;
    case "checks-finished": {
      const failing = Array.isArray(data.failing) ? data.failing : [];
      return `check gate settled with ${data.passed ?? 0} passed and ${failing.length} failing`;
    }
    case "checks-awaiting-approval": {
      const checks = Array.isArray(data.checks) ? data.checks : [];
      return `${checks.length} ${plural(checks.length, "check")} awaiting approval: ${namesOf(checks)}`;
    }
    case "remarks":
      return `${data.count ?? 0} new ${plural(data.count ?? 0, "remark")}`;
    case "no-checks":
      return `no checks reported after ${data.minutes ?? 0} minutes`;
    case "conflicting":
      return "pull request has merge conflicts";
    case "needs-rebase":
      return "pull request is behind its base branch";
    case "merge-queue-removed":
      return data.reason ? `removed from merge queue: ${data.reason}` : "removed from merge queue";
    case "merged":
      return `merged into ${data.baseBranch ?? "base branch"}`;
    case "closed":
      return `closed without merging into ${data.baseBranch ?? "base branch"}`;
    case "watch-ended":
      return `watch ended: ${data.reason ?? "unknown"}`;
    default:
      return typeof event.type === "string" ? event.type : "watch event";
  }
}

function normalizeNow(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  throw invalidArguments("The injected now function must return a Date, finite timestamp, or ISO timestamp.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function processExists(pid) {
  if (!isPositiveInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function sanitizeCommand(command) {
  const fallback = path.basename(process.argv[1] || process.title || "node");
  const value = typeof command === "string" && command.trim() ? command.trim() : fallback;
  return value.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").slice(0, 160);
}

async function readOwner(lockPath) {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(lockPath, OWNER_FILE), "utf8"));
    if (!isPlainObject(parsed)) return null;
    if (!isNonEmptyString(parsed.token) || !isPositiveInteger(parsed.pid) ||
      typeof parsed.command !== "string" || !isIsoString(parsed.heartbeat)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeOwner(lockPath, owner) {
  const temp = path.join(lockPath, `.${OWNER_FILE}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`);
  await fs.writeFile(temp, `${JSON.stringify(owner)}\n`, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temp, path.join(lockPath, OWNER_FILE));
}

async function inspectLock(lockPath, staleLockMs, nowMs) {
  const owner = await readOwner(lockPath);
  if (owner) {
    if (!processExists(owner.pid)) return { state: "stale", owner, reason: "process_gone" };
    const heartbeat = Date.parse(owner.heartbeat);
    if (nowMs - heartbeat > staleLockMs) return { state: "stale", owner, reason: "heartbeat_expired" };
    return { state: "live", owner };
  }
  try {
    const stat = await fs.stat(lockPath);
    if (nowMs - stat.mtimeMs > staleLockMs) return { state: "stale", owner: null, reason: "owner_unreadable" };
  } catch {
    return { state: "missing", owner: null };
  }
  return { state: "live", owner: null };
}

async function reclaimStaleLock(lockPath, expectedOwner) {
  const aside = `${lockPath}.stale-${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  try {
    await fs.rename(lockPath, aside);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw invalidConfig("Could not reclaim a stale watch-state lock.", "lock", { operation: "rename" });
  }
  const moved = await readOwner(aside);
  const stillStale = expectedOwner?.token
    ? moved?.token === expectedOwner.token
    : moved === null;
  if (!stillStale) {
    await fs.rename(aside, lockPath).catch(() => {});
    return false;
  }
  await fs.rm(aside, { recursive: true, force: true }).catch(() => {});
  return true;
}

async function acquireLock({
  lockPath,
  waitMs,
  staleLockMs,
  heartbeatMs,
  now,
  command,
  nonBlocking,
  isCanceled,
}) {
  const token = crypto.randomBytes(16).toString("hex");
  const startedWallMs = Date.now();
  const intervalMs = Math.min(heartbeatMs, MAX_HEARTBEAT_MS);

  for (;;) {
    throwIfLockCanceled(isCanceled);
    let created = false;
    try {
      await fs.mkdir(lockPath, { mode: 0o700 });
      created = true;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw invalidConfig("Could not create the watch-state lock.", "lock", { operation: "mkdir" });
      }
    }

    if (created) {
      const heartbeat = new Date(normalizeNow(now())).toISOString();
      const owner = { token, pid: process.pid, command: sanitizeCommand(command), heartbeat };
      try {
        await writeOwner(lockPath, owner);
      } catch (error) {
        await fs.rm(lockPath, { recursive: true, force: true }).catch(() => {});
        throw invalidConfig("Could not initialize the watch-state lock.", "lock", { operation: "owner" });
      }

      let stopped = false;
      let refreshInFlight = null;
      const refresh = () => {
        if (stopped || refreshInFlight) return;
        refreshInFlight = (async () => {
          try {
            owner.heartbeat = new Date(normalizeNow(now())).toISOString();
            await writeOwner(lockPath, owner);
          } catch {
          }
        })();
        void refreshInFlight.finally(() => {
          refreshInFlight = null;
        });
      };
      const timer = setInterval(refresh, intervalMs);
      timer.unref?.();
      return {
        lockPath,
        token,
        owner,
        async stop() {
          stopped = true;
          clearInterval(timer);
          if (refreshInFlight) await refreshInFlight;
        },
      };
    }

    const inspection = await inspectLock(lockPath, staleLockMs, normalizeNow(now()));
    if (inspection.state === "missing") continue;
    if (inspection.state === "stale") {
      await reclaimStaleLock(lockPath, inspection.owner);
      continue;
    }
    if (nonBlocking) {
      throw lockConflict("Another watch process already holds this lock.", { lockPath });
    }

    const elapsed = Date.now() - startedWallMs;
    if (elapsed >= waitMs) {
      throw lockConflict("Timed out waiting for the watch-state lock.", { lockPath });
    }
    throwIfLockCanceled(isCanceled);
    await sleep(Math.min(25, Math.max(1, waitMs - elapsed)));
  }
}

async function verifyLockOwner(lease) {
  const owner = await readOwner(lease.lockPath);
  if (!owner || owner.token !== lease.token) {
    throw lockConflict("The watch-state lock was lost before the state commit.", { lockPath: lease.lockPath });
  }
}

async function releaseLock(lease) {
  await lease.stop();
  try {
    const owner = await readOwner(lease.lockPath);
    if (owner?.token === lease.token) {
      await fs.rm(lease.lockPath, { recursive: true, force: true });
    }
  } catch {
  }
}

function prepareForWrite(state) {
  if (!isPlainObject(state)) return state;
  return {
    ...state,
    events: Array.isArray(state.events) ? state.events.slice(-EVENT_RETENTION) : state.events,
  };
}

async function fsyncDirectory(directory) {
  try {
    const handle = await fs.open(directory, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
  }
}

function storeIoError(action) {
  return invalidConfig(`Could not ${action} the watch state.`, "state", { operation: action });
}

export function createWatchStore({
  statePath = DEFAULT_STATE_PATH,
  lockWaitMs = 10_000,
  staleLockMs = 30_000,
  heartbeatMs = 5_000,
  now = () => new Date(),
} = {}) {
  if (!isNonEmptyString(statePath)) throw invalidArguments("statePath must be a nonempty path.");
  if (!Number.isFinite(lockWaitMs) || lockWaitMs < 0) throw invalidArguments("lockWaitMs must be a nonnegative number.");
  if (!Number.isFinite(staleLockMs) || staleLockMs <= 0) throw invalidArguments("staleLockMs must be a positive number.");
  if (!Number.isFinite(heartbeatMs) || heartbeatMs <= 0) throw invalidArguments("heartbeatMs must be a positive number.");
  if (typeof now !== "function") throw invalidArguments("now must be a function.");

  const resolvedStatePath = path.resolve(statePath);
  const stateDirectory = path.dirname(resolvedStatePath);
  const lockPath = `${resolvedStatePath}.lock`;
  const runLockPath = `${resolvedStatePath}.run.lock`;

  function nowMs() {
    return normalizeNow(now());
  }

  function nowIso() {
    return new Date(nowMs()).toISOString();
  }

  async function ensureStateDirectory() {
    try {
      await fs.mkdir(stateDirectory, { recursive: true, mode: 0o700 });
      const stat = await fs.stat(stateDirectory);
      if (!stat.isDirectory()) throw new Error("not a directory");
      await fs.chmod(stateDirectory, 0o700);
    } catch (error) {
      if (error?.reason) throw error;
      throw invalidConfig("Could not create or repair the watch-state directory.", "stateDirectory");
    }
  }

  async function readState() {
    let text;
    try {
      text = await fs.readFile(resolvedStatePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return initialState(nowIso());
      throw storeIoError("read");
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw invalidConfig("Watch state is corrupt JSON.", "state");
    }
    return validateState(parsed);
  }

  async function writeStateAtomic(state, preRename) {
    const prepared = prepareForWrite(state);
    validateState(prepared);
    await ensureStateDirectory();

    const tempPath = `${resolvedStatePath}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
    let handle = null;
    let renamed = false;
    try {
      handle = await fs.open(tempPath, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(prepared, null, 2)}\n`, "utf8");
      await fs.chmod(tempPath, 0o600);
      await handle.sync();
      await handle.close();
      handle = null;
      if (preRename) await preRename();
      await fs.rename(tempPath, resolvedStatePath);
      renamed = true;
      await fsyncDirectory(stateDirectory);
      return prepared;
    } catch (error) {
      if (error?.reason) throw error;
      throw storeIoError("write");
    } finally {
      if (handle) await handle.close().catch(() => {});
      if (!renamed) await fs.rm(tempPath, { force: true }).catch(() => {});
    }
  }

  async function writeState(state) {
    const context = lockContext.getStore();
    const stateLease = context?.kind === "state" && context.lease.lockPath === lockPath ? context.lease : null;
    return writeStateAtomic(state, stateLease ? () => verifyLockOwner(stateLease) : null);
  }

  async function runWithLock(kind, lockForOperation, waitMs, nonBlocking, callback, options) {
    if (typeof callback !== "function") throw invalidArguments("A lock callback is required.");
    await ensureStateDirectory();
    throwIfLockCanceled(options?.isCanceled);
    const lease = await acquireLock({
      lockPath: lockForOperation,
      waitMs,
      staleLockMs,
      heartbeatMs,
      now,
      command: options?.command,
      nonBlocking,
      isCanceled: options?.isCanceled,
    });
    const context = { kind, lease };
    const controls = Object.freeze({
      statePath: resolvedStatePath,
      lockPath: lease.lockPath,
      command: lease.owner.command,
      commit: writeState,
    });
    try {
      throwIfLockCanceled(options?.isCanceled);
      return await lockContext.run(context, () => callback(controls));
    } finally {
      await releaseLock(lease);
    }
  }

  async function withStateLock(callback, options = {}) {
    return runWithLock("state", lockPath, lockWaitMs, false, callback, options);
  }

  async function withRunLock(callback, options = {}) {
    return runWithLock("run", runLockPath, 0, true, callback, options);
  }

  return {
    statePath: resolvedStatePath,
    lockPath,
    runLockPath,
    readState,
    writeState,
    withStateLock,
    withRunLock,
  };
}
