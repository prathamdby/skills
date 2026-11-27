// GitHub fingerprint, detail, activity, and quota readers for pr-watch.
// Plain JavaScript; network admission and persistence stay injected outside this module.

const CHECK_CONTEXT_PAGES = 10;
const REVIEW_THREAD_PAGES = 10;
const ACTIVITY_PAGES = 10;
const FINGERPRINT_BATCH_SIZE = 25;
const HOST_REQUEST_CONCURRENCY = 8;
const WORKFLOW_APPROVAL_LIMIT = 1_000;
const VIEWER_CACHE_TTL_MS = 10 * 60_000;
const TAIL_CACHE_TTL_MS = 30 * 60_000;
const UNSET_TIMESTAMP = "0001-01-01T00:00:00Z";
const STILL_RUNNING = "9999-12-31T23:59:59Z";
const PULL_REQUEST_EVENTS = new Set(["pull_request", "pull_request_target"]);
const UNFINISHED_WORKFLOW_RUN_STATUSES = new Set([
  "requested",
  "queued",
  "pending",
  "waiting",
  "in_progress",
]);

function typedError(reason, message, options = {}) {
  const error = new Error(message);
  error.reason = reason;
  if (options.retryable !== undefined) error.retryable = options.retryable;
  if (options.retryAfter !== undefined) error.retryAfter = options.retryAfter;
  if (options.requestId !== undefined) error.requestId = options.requestId;
  if (options.data !== undefined) error.data = options.data;
  return error;
}

function trimmed(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function nodesOf(connection) {
  const nodes = connection?.nodes;
  if (nodes === null || nodes === undefined) return [];
  if (!Array.isArray(nodes)) {
    throw typedError("api_error", "GitHub returned a malformed GraphQL connection.", {
      retryable: false,
    });
  }
  return nodes.filter((node) => node !== null && node !== undefined);
}

function nextCursorOf(pageInfo) {
  return pageInfo?.hasNextPage === true ? trimmed(pageInfo.endCursor) : null;
}

function isoFromMs(ms) {
  return new Date(ms).toISOString();
}

function normalizeNow(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (typeof now === "string" && Number.isFinite(Date.parse(now))) return Date.parse(now);
  return Date.now();
}

function normalizeHeaders(headers) {
  const out = {};
  if (!headers) return out;
  if (typeof headers.forEach === "function") {
    headers.forEach((value, key) => {
      out[String(key).toLowerCase()] = String(value);
    });
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) out[key.toLowerCase()] = String(value);
  }
  return out;
}

function isRateOrPause(error) {
  return error?.reason === "rate_limited" ||
    error?.reason === "rate_limit_paused" ||
    error?.reason === "quota_paused" ||
    error?._tag === "GitHubApiRateLimitError" ||
    error?._tag === "SourceControlRateLimitPausedError";
}

function stripRemoteControls(value) {
  let text = String(value ?? "");
  text = text.replace(/\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g, "");
  text = text.replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "");
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 9) out += "\\t";
    else if (code === 10) out += "\\n";
    else if (code === 13) out += "\\r";
    else if (code < 32 || (code >= 127 && code <= 159)) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else out += text[index];
  }
  return out;
}

function errorDataGraphQLErrors(errors) {
  return errors.map((error) => ({
    type: typeof error?.type === "string" ? error.type : null,
    path: Array.isArray(error?.path) ? [...error.path] : null,
  }));
}

function graphQLErrorData(errors) {
  const out = { graphqlErrors: errorDataGraphQLErrors(errors) };
  const remoteMessage = errors
    .map((error) => typeof error?.message === "string" ? error.message : "")
    .filter((message) => message.length > 0)
    .join("; ");
  if (remoteMessage) out.remoteMessage = stripRemoteControls(remoteMessage);
  return out;
}

function retryAtFromHeaders(headers, now = Date.now()) {
  const retryAfter = trimmed(headers["retry-after"]);
  if (retryAfter !== null) {
    if (/^\d+$/u.test(retryAfter)) {
      const at = now + Number(retryAfter) * 1_000;
      if (Number.isSafeInteger(at) && at > now) return at;
    } else {
      const at = Date.parse(retryAfter);
      if (Number.isFinite(at) && at > now) return at;
    }
  }
  const reset = Number(headers["x-ratelimit-reset"]) * 1_000;
  return Number.isFinite(reset) && reset > now ? reset : null;
}

function retryAfterSeconds(headers, now = Date.now()) {
  const retryAt = retryAtFromHeaders(headers, now);
  return retryAt === null ? undefined : Math.max(0, Math.ceil((retryAt - now) / 1_000));
}

/**
 * T3's exact rate-limit classification: 429 always; GraphQL quota/type/message;
 * 403 only when quota or text names a primary or secondary limit.
 */
export function classifyRateLimit(response) {
  const headers = normalizeHeaders(response?.headers);
  const status = Number(response?.status ?? 200);
  const errors = response?.graphqlErrors ?? response?.errors;
  const errorsPresent = Array.isArray(response?.graphqlErrors) ||
    response?.errorsPresent === true ||
    (!(response && typeof response === "object" && "errorsPresent" in response) && Array.isArray(errors));
  const body = typeof response?.body === "string"
    ? response.body
    : typeof response?.data === "string"
      ? response.data
      : response?.data && typeof response.data === "object"
        ? JSON.stringify(response.data)
        : "";
  const namesLimit = (text) => typeof text === "string" && /rate limit|abuse detection mechanism/i.test(text);
  return (
    status === 429 ||
    (errorsPresent &&
      (headers["x-ratelimit-remaining"] === "0" ||
        (errors ?? []).some((error) =>
          error?.type === "RATE_LIMITED" ||
          (typeof error?.message === "string" && /rate limit (already )?exceeded/i.test(error.message))
        ))) ||
    (status === 403 &&
      (headers["x-ratelimit-remaining"] === "0" ||
        namesLimit(body) ||
        (Array.isArray(errors) && errors.some((error) => namesLimit(error?.message)))))
  );
}

function normalizeTransportResponse(result) {
  if (result && typeof result === "object" &&
    ("status" in result || "headers" in result || "errors" in result)) {
    const errorsPresent = Array.isArray(result.errors);
    return {
      status: Number(result.status ?? 200),
      headers: normalizeHeaders(result.headers),
      data: result.data,
      errors: errorsPresent ? result.errors : [],
      errorsPresent,
      requestId: result.requestId ?? normalizeHeaders(result.headers)["x-github-request-id"] ?? null,
    };
  }
  if (result && typeof result === "object" && "data" in result &&
    (result.data === null || typeof result.data === "object")) {
    const errorsPresent = Array.isArray(result.errors);
    return {
      status: 200,
      headers: {},
      data: result.data,
      errors: errorsPresent ? result.errors : [],
      errorsPresent,
      requestId: null,
    };
  }
  return { status: 200, headers: {}, data: result, errors: [], errorsPresent: false, requestId: null };
}

function responseErrorReason(response, operation) {
  const headers = response.headers;
  const errors = Array.isArray(response.errors) ? response.errors : [];
  const base = {
    retryable: false,
    requestId: response.requestId ?? undefined,
    data: {
      operation,
      status: response.status,
      ...(errors.length > 0 ? graphQLErrorData(errors) : {}),
    },
  };
  if (classifyRateLimit(response)) {
    return typedError("rate_limited", `GitHub rate limited the ${operation} read.`, {
      ...base,
      retryable: true,
      retryAfter: retryAfterSeconds(headers),
    });
  }
  if (response.status === 401) {
    return typedError("token_expired", "GitHub rejected the current gh token.", base);
  }
  if (response.status === 403) {
    return typedError("permission_denied", "GitHub denied access to the pull request read.", base);
  }
  if (response.status === 404) {
    return typedError("not_found", "GitHub could not find the pull request read target.", base);
  }
  if (response.status === 0) {
    return typedError("network_error", "The GitHub request did not complete.", {
      ...base,
      retryable: true,
    });
  }
  if (response.status >= 500) {
    return typedError("api_error", `GitHub returned HTTP ${response.status} for the ${operation} read.`, {
      ...base,
      retryable: true,
    });
  }
  return typedError("api_error", `GitHub returned an unexpected response for the ${operation} read.`, base);
}

function graphQLErrorFailure(response, operation) {
  if (classifyRateLimit(response)) return responseErrorReason(response, operation);
  const errors = response.errors;
  const types = new Set(errors.map((error) => error?.type));
  if (
    types.has("FORBIDDEN") &&
    [...types].every((type) => type === "FORBIDDEN" || type === "NOT_FOUND")
  ) {
    return typedError("permission_denied", "GitHub denied access to the pull request read.", {
      requestId: response.requestId ?? undefined,
      data: { operation, ...graphQLErrorData(errors) },
    });
  }
  if (errors.length > 0 && errors.every((error) => error?.type === "NOT_FOUND")) {
    return typedError("not_found", "GitHub could not find the pull request read target.", {
      requestId: response.requestId ?? undefined,
      data: { operation, ...graphQLErrorData(errors) },
    });
  }
  return responseErrorReason(response, operation);
}

function throwForGraphQLResponse(response, operation, options = {}) {
  if (response.status < 200 || response.status >= 300) throw responseErrorReason(response, operation);
  if (response.errors.length === 0) return;
  if (
    options.tolerateMissingCompare === true &&
    response.errors.every((error) =>
      error?.type === "NOT_FOUND" &&
      Array.isArray(error?.path) &&
      error.path.join(".") === "repository.pullRequest.baseRef.compare"
    )
  ) {
    return;
  }
  throw graphQLErrorFailure(response, operation);
}

function rethrowClientError(error, operation) {
  if (error && typeof error === "object" && (error.reason || error._tag)) throw error;
  if (error && typeof error === "object" && Number.isFinite(Number(error.status))) {
    throw responseErrorReason({
      status: Number(error.status),
      headers: normalizeHeaders(error.headers),
      data: error.data ?? error.body,
      ...(Array.isArray(error.errors) ? { errors: error.errors } : {}),
      requestId: error.requestId ?? null,
    }, operation);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (error?.name === "AbortError" || error?.name === "TimeoutError" || /timed out|timeout/i.test(message)) {
    throw typedError("timeout", `The GitHub ${operation} read timed out.`, { retryable: true });
  }
  throw typedError("network_error", message, { retryable: true });
}

async function executeGraphQL(client, query, variables, meta) {
  let raw;
  try {
    raw = await client.graphql(query, variables, meta);
  } catch (error) {
    rethrowClientError(error, meta?.operation ?? "graphql");
  }
  const response = normalizeTransportResponse(raw);
  throwForGraphQLResponse(response, meta?.operation ?? "graphql", {
    tolerateMissingCompare: meta?.tolerateMissingCompare === true,
  });
  if (response.data === null || response.data === undefined) {
    throw typedError("api_error", `GitHub returned no data for the ${meta?.operation ?? "graphql"} read.`, {
      retryable: false,
      requestId: response.requestId ?? undefined,
      data: { operation: meta?.operation ?? "graphql", status: response.status },
    });
  }
  return response.data;
}

function ensureRestOk(raw, operation) {
  const response = normalizeTransportResponse(raw);
  if (response.status >= 200 && response.status < 300) return response;
  throw responseErrorReason(response, operation);
}

async function executeRest(client, path, meta) {
  let raw;
  try {
    raw = await client.rest(path, meta);
  } catch (error) {
    rethrowClientError(error, meta?.operation ?? "rest");
  }
  return ensureRestOk(raw, meta?.operation ?? "rest").data;
}

/** Exact T3 check-run/status-context status mapping. */
export function toCheckStatus(raw) {
  const status = raw?.status?.trim().toUpperCase();
  if (status !== undefined && status !== "COMPLETED" && status !== "") return "pending";
  switch ((raw?.conclusion ?? raw?.state)?.trim().toUpperCase()) {
    case "SUCCESS":
      return "success";
    case "ACTION_REQUIRED":
      return "action-required";
    case "FAILURE":
    case "ERROR":
    case "TIMED_OUT":
    case "STARTUP_FAILURE":
      return "failure";
    case "CANCELLED":
      return "cancelled";
    case "SKIPPED":
      return "skipped";
    case "PENDING":
    case "EXPECTED":
      return "pending";
    default:
      return "neutral";
  }
}

function realTimestamp(value) {
  const at = trimmed(value);
  return at === null || at === UNSET_TIMESTAMP ? null : at;
}

function isNamelessCheck(raw) {
  return trimmed(raw?.name) === null && trimmed(raw?.context) === null;
}

function toCheckEntries(rawChecks) {
  const lineageOf = (run) => `${run.workflow.id} ${run.event}`;
  const newestRunNumber = new Map();
  const note = (key, runNumber) => {
    if (runNumber > (newestRunNumber.get(key) ?? Number.NEGATIVE_INFINITY)) {
      newestRunNumber.set(key, runNumber);
    }
  };
  for (const check of rawChecks ?? []) {
    const run = check?.workflowRun;
    if (run == null || !PULL_REQUEST_EVENTS.has(run.event)) continue;
    note(lineageOf(run), run.runNumber);
    note(`${lineageOf(run)} ${trimmed(check.name) ?? ""}`, run.runNumber);
  }
  return (rawChecks ?? []).flatMap((check) => {
    const name = trimmed(check?.name) ?? trimmed(check?.context);
    if (name === null) return [];
    const status = toCheckStatus(check);
    const run = check.workflowRun;
    if (status === "cancelled" && run != null) {
      const replacedBy = check.isRequired === true ? `${lineageOf(run)} ${name}` : lineageOf(run);
      if (run.runNumber < (newestRunNumber.get(replacedBy) ?? run.runNumber)) return [];
    }
    return [{
      check: {
        name,
        status,
        description: trimmed(check.description),
        url: trimmed(check.detailsUrl) ?? trimmed(check.targetUrl),
        ...(typeof check.isRequired === "boolean" ? { required: check.isRequired } : {}),
      },
      workflowName: trimmed(check.workflowName) ?? trimmed(check.workflowRun?.workflow?.name),
      at: status === "pending"
        ? STILL_RUNNING
        : (realTimestamp(check.completedAt) ?? realTimestamp(check.startedAt)),
    }];
  });
}

const zonedDateTimePattern =
  /^(?:\d{4}|[+-]\d{6})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?|24:00(?::00(?:\.0+)?)?)(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i;

function validCalendarDate(datePart) {
  const yearText = datePart.slice(0, -6).replace(/^\+/u, "");
  const year = Number(yearText);
  const month = Number(datePart.slice(-5, -3));
  const day = Number(datePart.slice(-2));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function timestampParts(value) {
  if (!zonedDateTimePattern.test(value)) return { time: Number.NaN, fraction: "" };
  const datePart = value.split(/[Tt]/, 1)[0] ?? "";
  if (!validCalendarDate(datePart)) return { time: Number.NaN, fraction: "" };
  const fraction = /\.(\d+)(?=Z$|[+-]\d{2}:\d{2}$)/i.exec(value);
  const withoutFraction = fraction ? value.replace(fraction[0], "") : value;
  const time = Date.parse(withoutFraction);
  return { time, fraction: fraction?.[1] ?? "" };
}

function isAtLeastAsNew(candidate, kept) {
  if (candidate === null) return kept === null;
  if (kept === null) return true;
  const candidateParts = timestampParts(candidate);
  const keptParts = timestampParts(kept);
  if (Number.isNaN(candidateParts.time) || Number.isNaN(keptParts.time)) return candidate >= kept;
  if (candidateParts.time !== keptParts.time) return candidateParts.time > keptParts.time;
  const precision = Math.max(candidateParts.fraction.length, keptParts.fraction.length);
  return candidateParts.fraction.padEnd(precision, "0") >= keptParts.fraction.padEnd(precision, "0");
}

function sortChecks(checks) {
  return [...checks].sort((a, b) =>
    Number(b.status === "failure" || b.status === "cancelled") -
    Number(a.status === "failure" || a.status === "cancelled")
  );
}

function dedupeChecks(entries) {
  const newestByCheck = new Map();
  for (const entry of entries) {
    const key = JSON.stringify([entry.workflowName ?? "", entry.check.name]);
    const kept = newestByCheck.get(key);
    if (kept !== undefined) {
      if (!isAtLeastAsNew(entry.at, kept.at)) continue;
      if (
        entry.sequence !== undefined &&
        kept.sequence !== undefined &&
        entry.sequence < kept.sequence &&
        isAtLeastAsNew(kept.at, entry.at)
      ) continue;
    }
    newestByCheck.set(key, entry);
  }
  const survivors = [...newestByCheck.values()];
  const countsByName = new Map();
  for (const entry of survivors) {
    countsByName.set(entry.check.name, (countsByName.get(entry.check.name) ?? 0) + 1);
  }
  return sortChecks(survivors.map((entry) => {
    const workflowName = entry.workflowName ?? "";
    return workflowName.length > 0 && (countsByName.get(entry.check.name) ?? 0) > 1
      ? { ...entry.check, name: `${workflowName} / ${entry.check.name}` }
      : entry.check;
  }));
}

/** Normalize raw rollup rows with T3's supersede, rerun, collision, and ordering rules. */
export function normalizeChecks(rawChecks) {
  return dedupeChecks(toCheckEntries(rawChecks));
}

export function rollupCheckStatuses(statuses) {
  if (statuses.length === 0) return null;
  if (statuses.includes("failure") || statuses.includes("cancelled")) return "failing";
  if (statuses.includes("pending") || statuses.includes("action-required")) return "pending";
  return statuses.includes("success") ? "passing" : null;
}

function rollupChecksState(rawChecks) {
  return rollupCheckStatuses([
    ...normalizeChecks(rawChecks).map((check) => check.status),
    ...(rawChecks ?? []).filter(isNamelessCheck).map((check) => toCheckStatus(check)),
  ]);
}

const newestEdit = (connection) =>
  (connection?.nodes ?? []).reduce(
    (newest, node) => node?.lastEditedAt != null && node.lastEditedAt > newest ? node.lastEditedAt : newest,
    "",
  );

const stateCounts = (counts) =>
  (counts ?? [])
    .filter(({ count }) => count > 0)
    .map(({ state, count }) => `${state}:${count}`)
    .sort()
    .join(",");

/** Pack the exact two fingerprint strings T3 compares. */
export function packFingerprint(pr) {
  const contexts = pr?.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts;
  return {
    status: [
      pr?.state,
      pr?.mergeable,
      pr?.headRefOid,
      stateCounts(contexts?.checkRunCountsByState ?? null),
      stateCounts(contexts?.statusContextCountsByState ?? null),
      pr?.mergeQueueRemovals?.filteredCount ?? 0,
    ].join(" "),
    remarks: [
      pr?.comments?.totalCount ?? 0,
      newestEdit(pr?.comments),
      pr?.reviews?.totalCount ?? 0,
      newestEdit(pr?.reviews),
      pr?.reviewThreads?.totalCount ?? 0,
    ].join(" "),
  };
}

function parseRepository(repo) {
  const [owner, name, ...rest] = String(repo ?? "").trim().split("/");
  if (rest.length > 0 || owner === undefined || name === undefined) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(name)) return null;
  return { owner, name };
}

function normalizeSlice(slice, index = 0) {
  const host = String(slice?.host ?? "github.com").trim().toLowerCase();
  const repo = String(slice?.repo ?? "").trim();
  const pr = Number(slice?.pr);
  const parsed = parseRepository(repo);
  return {
    key: slice?.key ?? `${host}:${repo}#${pr}`,
    host,
    repo,
    pr,
    index,
    parsed: parsed && Number.isSafeInteger(pr) && pr > 0 && pr <= 2_147_483_647 ? parsed : null,
  };
}

function fingerprintOptions(options, host) {
  const include = options?.includeGitHubFields;
  const object = include && typeof include === "object" ? include : {};
  return {
    mergeQueue: typeof include === "boolean"
      ? include
      : object.mergeQueue ?? options?.includeMergeQueue ?? host.toLowerCase() === "github.com",
    rollupState: typeof include === "object" && include !== null && object.rollupState !== undefined
      ? object.rollupState === true
      : options?.includeRollupState === true,
  };
}

/** Build one aliased fingerprint GraphQL request for an already-selected slice batch. */
export function buildFingerprintBatch(slices, options = {}) {
  const normalized = slices.map((slice, index) => normalizeSlice(slice, index));
  const host = normalized[0]?.host ?? "github.com";
  const fingerprint = fingerprintOptions(options, host);
  const variableDefinitions = [];
  const variables = {};
  const selections = [];
  normalized.forEach((slice, index) => {
    const ownerVar = `owner${index}`;
    const nameVar = `name${index}`;
    const numberVar = `number${index}`;
    variableDefinitions.push(`$${ownerVar}: String!`, `$${nameVar}: String!`, `$${numberVar}: Int!`);
    variables[ownerVar] = slice.parsed?.owner ?? "";
    variables[nameVar] = slice.parsed?.name ?? "";
    variables[numberVar] = Number.isSafeInteger(slice.pr) ? slice.pr : 0;
    const mergeQueue = fingerprint.mergeQueue
      ? `      mergeQueueRemovals: timelineItems(itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT]) {\n        filteredCount\n      }\n`
      : "";
    const rollupState = fingerprint.rollupState ? "          state\n" : "";
    selections.push(`  _${index}_repository: repository(owner: $${ownerVar}, name: $${nameVar}) {
    pullRequest(number: $${numberVar}) {
      state
      mergeable
      headRefOid
      comments(first: 100, orderBy: { field: UPDATED_AT, direction: DESC }) {
        totalCount
        nodes {
          lastEditedAt
        }
      }
      reviews(last: 100) {
        totalCount
        nodes {
          lastEditedAt
        }
      }
      reviewThreads {
        totalCount
      }
${mergeQueue}      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
${rollupState}              contexts {
                checkRunCountsByState {
                  state
                  count
                }
                statusContextCountsByState {
                  state
                  count
                }
              }
            }
          }
        }
      }
    }
  }`);
  });
  const query = `query PullRequestWatchFingerprintBatch(
  ${variableDefinitions.join("\n  ")}
) {
${selections.join("\n")}
}`;
  return {
    query,
    variables,
    aliases: normalized.map((_, index) => `_${index}_repository`),
  };
}

function sliceAttribution(path, index) {
  return Array.isArray(path) && path[0] === `_${index}_repository`;
}

function fingerprintEntryError(errors, key) {
  const types = new Set(errors.map((error) => error?.type));
  const data = graphQLErrorData(errors);
  if (types.has("FORBIDDEN") && [...types].every((type) => type === "FORBIDDEN" || type === "NOT_FOUND")) {
    return typedError("permission_denied", "GitHub denied access to a fingerprint slice.", { data });
  }
  return typedError("api_error", "GitHub failed a fingerprint slice.", { data, key });
}

/** Decode an aliased fingerprint response, preserving slice isolation and partial data. */
export function parseFingerprintBatch(payload, slices) {
  const response = normalizeTransportResponse(payload);
  if (classifyRateLimit(response) || response.status < 200 || response.status >= 300) {
    throw responseErrorReason(response, "readFingerprints");
  }
  const data = response.data && typeof response.data === "object" ? response.data : {};
  const errors = response.errors;
  const unattributed = [];
  const bySlice = new Map();
  for (const error of errors) {
    const index = slices.findIndex((_, sliceIndex) => sliceAttribution(error?.path, sliceIndex));
    if (index === -1) unattributed.push(error);
    else {
      const list = bySlice.get(index) ?? [];
      list.push(error);
      bySlice.set(index, list);
    }
  }
  if (unattributed.length > 0) {
    throw graphQLErrorFailure({ ...response, errors: unattributed }, "readFingerprints");
  }
  return slices.map((slice, index) => {
    const normalized = normalizeSlice(slice, index);
    const base = {
      key: normalized.key,
      host: normalized.host,
      repo: normalized.repo,
      pr: normalized.pr,
    };
    const sliceErrors = bySlice.get(index) ?? [];
    if (sliceErrors.some((error) => error?.type !== "NOT_FOUND")) {
      return { ...base, fingerprint: null, error: fingerprintEntryError(sliceErrors, normalized.key) };
    }
    if (normalized.parsed === null) return { ...base, fingerprint: null };
    const pullRequest = data?.[`_${index}_repository`]?.pullRequest;
    if (pullRequest == null) return { ...base, fingerprint: null };
    const fingerprint = packFingerprint(pullRequest);
    const rollupState = pullRequest?.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state;
    return {
      ...base,
      fingerprint,
      status: fingerprint.status,
      remarks: fingerprint.remarks,
      checksPending: rollupState === "PENDING" || rollupState === "EXPECTED" || rollupState === "ACTION_REQUIRED",
    };
  });
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

function chunksOf(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

/** Read fingerprints in host groups, at most 25 aliases per request and 8 requests per host. */
export async function readFingerprints(client, slices, options = {}) {
  const normalized = slices.map((slice, index) => normalizeSlice(slice, index));
  const byHost = new Map();
  for (const slice of normalized) {
    const list = byHost.get(slice.host) ?? [];
    list.push(slice);
    byHost.set(slice.host, list);
  }
  const hostResults = await Promise.all([...byHost.entries()].map(async ([host, hostSlices]) => {
    const chunks = chunksOf(hostSlices, FINGERPRINT_BATCH_SIZE);
    return mapLimit(chunks, HOST_REQUEST_CONCURRENCY, async (chunk) => {
      const batch = buildFingerprintBatch(chunk, {
        ...options,
        includeGitHubFields: options.includeGitHubFields ?? {
          mergeQueue: host === "github.com",
          rollupState: options.includeRollupState === true,
        },
      });
      let payload;
      try {
        payload = await client.graphql(batch.query, batch.variables, {
          host,
          operation: "readFingerprints",
          sliceCount: chunk.length,
        });
      } catch (error) {
        return chunk.map((slice) => ({
          key: slice.key,
          host: slice.host,
          repo: slice.repo,
          pr: slice.pr,
          fingerprint: null,
          error,
        }));
      }
      try {
        return parseFingerprintBatch(payload, chunk);
      } catch (error) {
        return chunk.map((slice) => ({
          key: slice.key,
          host: slice.host,
          repo: slice.repo,
          pr: slice.pr,
          fingerprint: null,
          error,
        }));
      }
    });
  }));
  const entries = hostResults.flat(2);
  const byKeyAndIndex = new Map(entries.map((entry) => [entry.key, entry]));
  return normalized.map((slice) => byKeyAndIndex.get(slice.key) ?? {
    key: slice.key,
    host: slice.host,
    repo: slice.repo,
    pr: slice.pr,
    fingerprint: null,
  });
}

function checkContextFields(required) {
  const requiredLine = required ? "    isRequired(pullRequestNumber: $number)\n" : "";
  return `  ... on StatusContext {
    context
    state
    targetUrl
    createdAt
    description
${requiredLine}  }
  ... on CheckRun {
    name
    status
    conclusion
    startedAt
    completedAt
    detailsUrl
${requiredLine}    checkSuite {
      workflowRun {
        event
        runNumber
        workflow {
          id
          name
        }
      }
    }
  }`;
}

function pullRequestCoreQuery({ required, mergeQueue }) {
  const mergeQueueSelection = mergeQueue
    ? `      mergeQueueRemovals: timelineItems(last: 1, itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT]) {
        nodes {
          ... on RemovedFromMergeQueueEvent {
            id
            createdAt
            reason
          }
        }
      }
`
    : "";
  return `fragment WatchCheckContext on StatusCheckRollupContext {
  __typename
${checkContextFields(required)}
}

query PullRequestWatchCore(
  $owner: String!
  $name: String!
  $number: Int!
  $headRef: String!
) {
  repository(owner: $owner, name: $name) {
    nameWithOwner
    pullRequest(number: $number) {
      number
      url
      state
      mergedAt
      mergeCommit {
        oid
      }
      mergedBy {
        __typename
        login
        avatarUrl
        ... on User {
          name
        }
      }
      closedAt
      headRefName
      baseRefName
      headRefOid
      isCrossRepository
      mergeable
      headRepositoryOwner {
        login
      }
      author {
        __typename
        login
        avatarUrl
        ... on User {
          name
        }
      }
${mergeQueueSelection}      baseRef {
        compare(headRef: $headRef) {
          behindBy
        }
      }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 100) {
                nodes {
                  ...WatchCheckContext
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
      }
    }
  }
}`;
}

function pullRequestCheckContextsQuery(required) {
  return `fragment WatchCheckContextPage on StatusCheckRollupContext {
  __typename
${checkContextFields(required)}
}

query PullRequestWatchCheckContexts(
  $owner: String!
  $name: String!
  $number: Int!
  $after: String
) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      headRefOid
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 100, after: $after) {
                nodes {
                  ...WatchCheckContextPage
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
      }
    }
  }
}`;
}

const PULL_REQUEST_HEADS_QUERY = `query PullRequestWatchHeads(
  $owner: String!
  $name: String!
  $head: String!
  $after: String
) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 100, after: $after, states: [OPEN], headRefName: $head) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        number
        headRefOid
        isCrossRepository
        headRepositoryOwner {
          login
        }
      }
    }
  }
}`;

const VIEWER_QUERY = `query PullRequestWatchViewer {
  viewer {
    login
  }
}`;

function toActor(raw) {
  const login = trimmed(raw?.login);
  return login === null
    ? null
    : {
        login,
        name: trimmed(raw?.name),
        avatarUrl: trimmed(raw?.avatarUrl),
        ...(raw?.__typename === "Bot" ? { isBot: true } : {}),
      };
}

function toState(raw) {
  if (trimmed(raw?.mergedAt) !== null) return "merged";
  const state = raw?.state?.trim().toUpperCase();
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return "open";
}

function toMergeability(value) {
  switch (value?.trim().toUpperCase()) {
    case "MERGEABLE":
      return "mergeable";
    case "CONFLICTING":
      return "conflicting";
    default:
      return "unknown";
  }
}

function rawCheckContexts(connection) {
  return nodesOf(connection).map((check) => check?.__typename === "CheckRun"
    ? {
        ...check,
        workflowName: check.checkSuite?.workflowRun?.workflow?.name ?? null,
        workflowRun: check.checkSuite?.workflowRun ?? null,
      }
    : check);
}

function checkPageFromData(data) {
  const pr = data?.repository?.pullRequest;
  if (pr == null) return null;
  const contexts = nodesOf(pr.commits)[0]?.commit?.statusCheckRollup?.contexts;
  return {
    headSha: trimmed(pr.headRefOid),
    contexts: rawCheckContexts(contexts),
    nextCursor: nextCursorOf(contexts?.pageInfo),
    hasNextPage: contexts?.pageInfo?.hasNextPage === true,
  };
}

function malformedDetail(message) {
  throw typedError("api_error", message, {
    retryable: false,
    data: { operation: "readDetail" },
  });
}

function decodeCore(data, target) {
  const repository = data?.repository;
  const pr = repository?.pullRequest;
  if (repository == null || pr == null) return null;
  if (!Number.isInteger(pr.number) || typeof pr.url !== "string" || typeof pr.state !== "string") {
    malformedDetail("GitHub returned malformed pull-request detail data.");
  }
  for (const field of ["headRefName", "baseRefName", "headRefOid"]) {
    if (typeof pr[field] !== "string" || pr[field].length === 0) {
      malformedDetail("GitHub returned malformed pull-request branch data.");
    }
  }
  if (pr.isCrossRepository !== undefined && typeof pr.isCrossRepository !== "boolean") {
    malformedDetail("GitHub returned malformed pull-request repository data.");
  }
  if (
    pr.baseRef?.compare !== undefined && pr.baseRef.compare !== null &&
    pr.baseRef.compare.behindBy !== null && typeof pr.baseRef.compare.behindBy !== "number"
  ) {
    malformedDetail("GitHub returned malformed pull-request comparison data.");
  }
  const contextsConnection = nodesOf(pr.commits)[0]?.commit?.statusCheckRollup?.contexts;
  const contexts = rawCheckContexts(contextsConnection);
  const removal = nodesOf(pr.mergeQueueRemovals).at(-1);
  const comparison = pr.state !== "OPEN" || pr.baseRef?.compare == null
    ? null
    : { behindBy: pr.baseRef.compare.behindBy };
  const detail = {
    host: target.host,
    repository: trimmed(repository.nameWithOwner) ?? target.repo,
    repo: trimmed(repository.nameWithOwner) ?? target.repo,
    pr: pr.number,
    number: pr.number,
    url: trimmed(pr.url),
    state: toState(pr),
    author: toActor(pr.author),
    headBranch: trimmed(pr.headRefName),
    baseBranch: trimmed(pr.baseRefName),
    headSha: trimmed(pr.headRefOid),
    headRepositoryOwner: trimmed(pr.headRepositoryOwner?.login),
    isCrossRepository: pr.isCrossRepository === true,
    mergeability: toMergeability(pr.mergeable),
    mergedAt: trimmed(pr.mergedAt),
    closedAt: trimmed(pr.closedAt),
    mergeCommitSha: trimmed(pr.mergeCommit?.oid),
    mergedBy: toActor(pr.mergedBy),
    comparison,
    checksTruncated: contextsConnection?.pageInfo?.hasNextPage === true,
    firstCheckPage: checkPageFromData(data),
    rawChecks: contexts,
  };
  if (removal !== undefined && removal !== null && "id" in removal) {
    detail.mergeQueueRemoval = {
      id: removal.id,
      removedAt: removal.createdAt,
      reason: trimmed(removal.reason),
    };
  }
  if (comparison?.behindBy !== null && comparison?.behindBy !== undefined) {
    detail.behindBy = comparison.behindBy;
    detail.rebaseRequired = comparison.behindBy > 0;
  }
  return detail;
}

async function readAllCheckContexts(client, target, first, required) {
  const contexts = [...first.contexts];
  let after = first.nextCursor;
  if (first.hasNextPage && after === null) {
    throw typedError("api_error", "GitHub reported another check page without a cursor.", {
      data: { operation: "readDetail" },
    });
  }
  for (let page = 1; after !== null && page < CHECK_CONTEXT_PAGES; page++) {
    const data = await executeGraphQL(
      client,
      pullRequestCheckContextsQuery(required),
      { owner: target.parsed.owner, name: target.parsed.name, number: target.pr, after },
      { host: target.host, operation: "readDetailChecks" },
    );
    const next = checkPageFromData(data);
    if (next === null || next.headSha !== first.headSha) {
      throw typedError("api_error", "Pull request head changed while reading checks.", {
        retryable: true,
        data: { operation: "readDetailChecks" },
      });
    }
    if (next.nextCursor === after) {
      throw typedError("api_error", "GitHub repeated a check-pagination cursor.", {
        data: { operation: "readDetailChecks" },
      });
    }
    if (next.hasNextPage && next.nextCursor === null) {
      throw typedError("api_error", "GitHub reported another check page without a cursor.", {
        data: { operation: "readDetailChecks" },
      });
    }
    contexts.push(...next.contexts);
    after = next.nextCursor;
  }
  if (after !== null) {
    throw typedError("api_error", "GitHub check pagination exceeded the trusted page cap.", {
      retryable: true,
      data: { operation: "readDetailChecks", pages: CHECK_CONTEXT_PAGES },
    });
  }
  return contexts;
}

function workflowRunIdOf(url) {
  return trimmed(url)?.match(/\/actions\/runs\/(\d+)(?:\/|$)/)?.[1] ?? null;
}

function withUnfinishedWorkflowRuns(checks, runs) {
  const runningRunIds = new Set();
  for (const check of checks) {
    if (check.status !== "pending" && check.status !== "action-required") continue;
    const id = workflowRunIdOf(check.url);
    if (id !== null) runningRunIds.add(Number(id));
  }
  return [
    ...checks,
    ...runs
      .filter((run) => !runningRunIds.has(run.id))
      .map((run) => ({
        name: run.name,
        status: "pending",
        description: "This workflow run has not finished.",
        url: run.url,
      })),
  ];
}

function withWorkflowApprovals(checks, runs, unavailable) {
  const representedRunIds = new Set();
  for (const check of checks) {
    if (check.status !== "action-required" || check.url === null) continue;
    const id = workflowRunIdOf(check.url);
    if (id !== null) representedRunIds.add(Number(id));
  }
  const approvalChecks = runs
    .filter((run) => !representedRunIds.has(run.id))
    .map((run) => ({
      name: run.name,
      status: "action-required",
      description: "A maintainer must approve this workflow before it can run.",
      url: run.url,
    }));
  return [
    ...checks,
    ...approvalChecks,
    ...(unavailable
      ? [{
          name: "Workflow approval status",
          status: "action-required",
          description: "GitHub could not determine whether workflows are awaiting approval.",
          url: null,
          placeholder: true,
        }]
      : []),
  ];
}

function decodeWorkflowRuns(data, unfinishedOnly) {
  const rows = Array.isArray(data?.workflow_runs) ? data.workflow_runs : null;
  if (rows === null) {
    throw typedError("api_error", "GitHub returned malformed workflow-run data.", {
      data: { operation: "workflowRuns" },
    });
  }
  const runs = [];
  for (const run of rows) {
    if (unfinishedOnly && !UNFINISHED_WORKFLOW_RUN_STATUSES.has(run?.status ?? "")) continue;
    if (!Number.isInteger(run?.id)) continue;
    runs.push({
      pullRequestNumbers: Array.isArray(run.pull_requests)
        ? run.pull_requests.map((pr) => pr?.number).filter(Number.isInteger)
        : [],
      id: run.id,
      name: trimmed(run.name) ?? `Workflow run ${run.id}`,
      url: trimmed(run.html_url),
    });
  }
  return { runs, rawCount: rows.length };
}

async function readPullRequestHeads(client, target, headBranch) {
  const heads = [];
  let after = null;
  let truncated = false;
  const seen = new Set();
  for (;;) {
    const data = await executeGraphQL(
      client,
      PULL_REQUEST_HEADS_QUERY,
      { owner: target.parsed.owner, name: target.parsed.name, head: headBranch, after },
      { host: target.host, operation: "validateWorkflowApprovalHead" },
    );
    const connection = data?.repository?.pullRequests;
    if (connection === undefined) {
      throw typedError("api_error", "GitHub returned malformed pull-request head data.");
    }
    heads.push(...nodesOf(connection).map((pr) => ({
      number: pr.number,
      headSha: trimmed(pr.headRefOid),
      isCrossRepository: pr.isCrossRepository === true,
      headRepositoryOwner: trimmed(pr.headRepositoryOwner?.login),
    })));
    if (heads.length > WORKFLOW_APPROVAL_LIMIT) {
      truncated = true;
      break;
    }
    const next = nextCursorOf(connection.pageInfo);
    if (next === null) break;
    if (seen.has(next)) {
      truncated = true;
      break;
    }
    seen.add(next);
    after = next;
  }
  return { heads, truncated };
}

async function readWorkflowApprovals(client, target, detail) {
  if (detail.state !== "open") return { runs: [], unavailable: false };
  if (detail.headSha == null || detail.headRepositoryOwner == null || detail.headBranch == null) {
    return { runs: [], unavailable: true };
  }
  try {
    const [headsRead, runs] = await Promise.all([
      readPullRequestHeads(client, target, detail.headBranch),
      (async () => {
        const runs = [];
        for (let page = 1; runs.length <= WORKFLOW_APPROVAL_LIMIT; page++) {
          const path = `repos/${target.parsed.owner}/${target.parsed.name}/actions/runs?head_sha=${encodeURIComponent(detail.headSha)}&branch=${encodeURIComponent(detail.headBranch)}&event=pull_request&status=action_required&per_page=100&page=${page}`;
          const read = decodeWorkflowRuns(await executeRest(client, path, {
            host: target.host,
            operation: "listWorkflowRunsRequiringApproval",
          }), false);
          runs.push(...read.runs);
          if (read.rawCount < 100) break;
        }
        return runs;
      })(),
    ]);
    if (headsRead.truncated || headsRead.heads.length > WORKFLOW_APPROVAL_LIMIT) {
      return { runs: [], unavailable: true };
    }
    const exactHeads = headsRead.heads.filter((pr) =>
      pr.headSha === detail.headSha &&
      pr.isCrossRepository === detail.isCrossRepository &&
      pr.headRepositoryOwner?.toLowerCase() === detail.headRepositoryOwner.toLowerCase()
    );
    if (exactHeads.length !== 1 || exactHeads[0]?.number !== target.pr) {
      return { runs: [], unavailable: true };
    }
    if (runs.length > WORKFLOW_APPROVAL_LIMIT) return { runs: [], unavailable: true };
    if (!detail.isCrossRepository && runs.some((run) => run.pullRequestNumbers.length === 0)) {
      return { runs: [], unavailable: true };
    }
    return {
      runs: runs.filter((run) => run.pullRequestNumbers.length === 0
        ? detail.isCrossRepository
        : run.pullRequestNumbers.includes(target.pr)),
      unavailable: false,
    };
  } catch (error) {
    if (isRateOrPause(error)) throw error;
    return { runs: [], unavailable: true };
  }
}

async function readUnfinishedWorkflowRuns(client, target, detail) {
  if (detail.state !== "open" || detail.headSha == null) return [];
  try {
    const path = `repos/${target.parsed.owner}/${target.parsed.name}/actions/runs?head_sha=${encodeURIComponent(detail.headSha)}&per_page=100`;
    return decodeWorkflowRuns(await executeRest(client, path, {
      host: target.host,
      operation: "listUnfinishedWorkflowRuns",
    }), true).runs;
  } catch (error) {
    if (isRateOrPause(error)) throw error;
    return [];
  }
}

const viewerCache = new Map();

async function clientCredentialFingerprint(client, host) {
  try {
    if (typeof client.credentialFingerprint === "function") {
      const value = await client.credentialFingerprint(host);
      return trimmed(value) ?? "unscoped";
    }
    if (typeof client.credentialFingerprint === "string") return client.credentialFingerprint;
  } catch {
    // A viewer is optional; identity cache scope failure must not fail detail.
  }
  return `${host}:unscoped`;
}

async function readViewerIdentity(client, target) {
  const cacheKey = `${target.host}\0${await clientCredentialFingerprint(client, target.host)}`;
  const cached = viewerCache.get(cacheKey);
  if (cached !== undefined && cached.expiresAt > Date.now()) return cached.login;
  let login = null;
  try {
    const data = await executeRest(client, "user", {
      host: target.host,
      operation: "readViewer",
    });
    login = trimmed(data?.login);
  } catch (error) {
    const status = Number(error?.data?.status ?? error?.status ?? 0);
    const forbidden = status === 403 || error?.reason === "permission_denied";
    if (forbidden) {
      try {
        const data = await executeGraphQL(client, VIEWER_QUERY, {}, {
          host: target.host,
          operation: "readViewerFallback",
        });
        login = trimmed(data?.viewer?.login);
      } catch {
        login = null;
      }
    }
  }
  if (login !== null) {
    viewerCache.set(cacheKey, { login, expiresAt: Date.now() + VIEWER_CACHE_TTL_MS });
  }
  return login;
}

/** Read the composed pull-request detail, including trusted rollup corrections. */
export async function readDetail(client, targetInput) {
  const target = normalizeSlice(targetInput);
  if (target.parsed === null) {
    throw typedError("invalid_arguments", "A detail read needs host, owner/repo, and a positive pull request number.", {
      retryable: false,
    });
  }
  const githubCom = target.host === "github.com";
  const coreData = await executeGraphQL(
    client,
    pullRequestCoreQuery({ required: githubCom, mergeQueue: githubCom }),
    {
      owner: target.parsed.owner,
      name: target.parsed.name,
      number: target.pr,
      headRef: `refs/pull/${target.pr}/head`,
    },
    {
      host: target.host,
      operation: "readDetail",
      tolerateMissingCompare: true,
    },
  );
  const core = decodeCore(coreData, target);
  if (core === null) {
    throw typedError("not_found", "GitHub could not find the pull request.", {
      retryable: false,
      data: { operation: "readDetail" },
    });
  }
  const contexts = core.checksTruncated
    ? await readAllCheckContexts(client, target, core.firstCheckPage, githubCom)
    : core.rawChecks;
  const normalizedChecks = normalizeChecks(contexts);
  const [viewer, approvals, unfinishedRuns] = await Promise.all([
    readViewerIdentity(client, target),
    readWorkflowApprovals(client, target, core),
    readUnfinishedWorkflowRuns(client, target, core),
  ]);
  const checks = withWorkflowApprovals(
    withUnfinishedWorkflowRuns(normalizedChecks, unfinishedRuns),
    approvals.runs,
    approvals.unavailable,
  );
  const detail = {
    host: core.host,
    repository: core.repository,
    repo: core.repo,
    pr: core.pr,
    number: core.number,
    url: core.url,
    state: core.state,
    author: core.author,
    viewer,
    headBranch: core.headBranch,
    baseBranch: core.baseBranch,
    headSha: core.headSha,
    headRepositoryOwner: core.headRepositoryOwner,
    isCrossRepository: core.isCrossRepository,
    mergeability: core.mergeability,
    mergedAt: core.mergedAt,
    closedAt: core.closedAt,
    mergeCommitSha: core.mergeCommitSha ?? null,
    mergedBy: core.mergedBy ?? null,
    checks,
    checksState: rollupChecksState(contexts),
    checksTrusted: approvals.unavailable !== true,
    approvalStatusUnavailable: approvals.unavailable,
    capabilities: { checksAlwaysReport: true },
    checksAlwaysReport: true,
    enterpriseDegraded: !githubCom,
    comparison: core.comparison,
    complete: approvals.unavailable !== true,
  };
  if (core.mergeQueueRemoval !== undefined) detail.mergeQueueRemoval = core.mergeQueueRemoval;
  if (core.behindBy !== undefined) detail.behindBy = core.behindBy;
  if (core.rebaseRequired !== undefined) detail.rebaseRequired = core.rebaseRequired;
  if (!approvals.unavailable) detail.workflowApprovalsRequired = approvals.runs.length;
  return detail;
}

const ACTIVITY_QUERY = `query PullRequestWatchActivity(
  $owner: String!
  $name: String!
  $number: Int!
  $head: Boolean!
  $withComments: Boolean!
  $commentsAfter: String
  $withReviews: Boolean!
  $reviewsAfter: String
) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      author @include(if: $head) {
        __typename
        login
        avatarUrl
        ... on User {
          name
        }
      }
      comments(first: 100, after: $commentsAfter) @include(if: $withComments) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          body
          createdAt
          lastEditedAt
          url
          isMinimized
          author {
            __typename
            login
            avatarUrl
            ... on User {
              name
            }
          }
        }
      }
      reviews(first: 100, after: $reviewsAfter) @include(if: $withReviews) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          body
          state
          submittedAt
          lastEditedAt
          url
          isMinimized
          author {
            __typename
            login
            avatarUrl
            ... on User {
              name
            }
          }
        }
      }
    }
  }
}`;

const THREADS_QUERY = `query PullRequestWatchReviewThreads(
  $owner: String!
  $name: String!
  $number: Int!
  $after: String
) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          diffSide
          comments(first: 10) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              author {
                __typename
                login
                avatarUrl
                ... on User {
                  name
                }
              }
              body
              createdAt
              lastEditedAt
              url
              isMinimized
            }
          }
        }
      }
    }
  }
}`;

const THREAD_COMMENTS_QUERY = `query PullRequestWatchReviewThreadComments(
  $owner: String!
  $name: String!
  $number: Int!
  $threadId: ID!
  $after: String
) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      id
    }
  }
  node(id: $threadId) {
    __typename
    ... on PullRequestReviewThread {
      pullRequest {
        id
      }
      comments(first: 100, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          author {
            __typename
            login
            avatarUrl
            ... on User {
              name
            }
          }
          body
          createdAt
          lastEditedAt
          url
          isMinimized
        }
      }
    }
  }
}`;

function isReviewVerdict(reviewState) {
  switch (reviewState?.toUpperCase()) {
    case "APPROVED":
    case "CHANGES_REQUESTED":
    case "DISMISSED":
      return true;
    default:
      return false;
  }
}

function issueCommentRow(comment) {
  return {
    id: comment.id,
    kind: "issue-comment",
    author: toActor(comment.author),
    body: comment.body ?? "",
    createdAt: comment.createdAt,
    editedAt: comment.lastEditedAt ?? null,
    url: trimmed(comment.url),
    path: null,
    reviewState: null,
  };
}

function reviewRow(review) {
  const submittedAt = trimmed(review.submittedAt);
  const reviewState = trimmed(review.state);
  if (
    review.isMinimized ||
    submittedAt === null ||
    ((review.body ?? "").trim().length === 0 && !isReviewVerdict(reviewState))
  ) return [];
  return [{
    id: review.id,
    kind: "review",
    author: toActor(review.author),
    body: review.body ?? "",
    createdAt: submittedAt,
    editedAt: review.lastEditedAt ?? null,
    url: trimmed(review.url),
    path: null,
    reviewState,
  }];
}

function normalizeConversation(comments, reviews) {
  const issueComments = comments
    .filter((comment) => !comment.isMinimized)
    .map(issueCommentRow);
  return [...issueComments, ...reviews.flatMap(reviewRow)]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function decodeActivityPage(data) {
  const pr = data?.repository?.pullRequest;
  if (pr == null) return null;
  return {
    author: pr.author === undefined ? undefined : toActor(pr.author),
    remarks: normalizeConversation(nodesOf(pr.comments), nodesOf(pr.reviews)),
    nextCommentsCursor: nextCursorOf(pr.comments?.pageInfo),
    nextReviewsCursor: nextCursorOf(pr.reviews?.pageInfo),
    commentsHasNext: pr.comments?.pageInfo?.hasNextPage === true,
    reviewsHasNext: pr.reviews?.pageInfo?.hasNextPage === true,
  };
}

async function readConversation(client, target, markers) {
  const remarks = [];
  let author = null;
  let commentsAfter = null;
  let reviewsAfter = null;
  let withComments = true;
  let withReviews = true;
  const seenCommentCursors = new Set();
  const seenReviewCursors = new Set();
  for (let page = 0; page < ACTIVITY_PAGES; page++) {
    if (page > 0 && !withComments && !withReviews) break;
    const data = await executeGraphQL(client, ACTIVITY_QUERY, {
      owner: target.parsed.owner,
      name: target.parsed.name,
      number: target.pr,
      head: page === 0,
      withComments,
      commentsAfter,
      withReviews,
      reviewsAfter,
    }, { host: target.host, operation: "readActivityConversation" });
    const read = decodeActivityPage(data);
    if (read === null) {
      throw typedError("not_found", "GitHub could not find the pull request activity target.", {
        retryable: false,
      });
    }
    if (page === 0) author = read.author ?? null;
    remarks.push(...read.remarks);

    if (withComments) {
      const previous = commentsAfter;
      if (read.commentsHasNext && read.nextCommentsCursor === null) markers.malformedCursor = true;
      if (read.nextCommentsCursor !== null) {
        if (previous !== null && read.nextCommentsCursor === previous) {
          markers.repeatedCursor = true;
          withComments = false;
        } else if (seenCommentCursors.has(read.nextCommentsCursor)) {
          markers.repeatedCursor = true;
          withComments = false;
        } else {
          seenCommentCursors.add(read.nextCommentsCursor);
          commentsAfter = read.nextCommentsCursor;
        }
      } else {
        commentsAfter = null;
      }
      withComments = withComments && commentsAfter !== null;
    }
    if (withReviews) {
      const previous = reviewsAfter;
      if (read.reviewsHasNext && read.nextReviewsCursor === null) markers.malformedCursor = true;
      if (read.nextReviewsCursor !== null) {
        if (previous !== null && read.nextReviewsCursor === previous) {
          markers.repeatedCursor = true;
          withReviews = false;
        } else if (seenReviewCursors.has(read.nextReviewsCursor)) {
          markers.repeatedCursor = true;
          withReviews = false;
        } else {
          seenReviewCursors.add(read.nextReviewsCursor);
          reviewsAfter = read.nextReviewsCursor;
        }
      } else {
        reviewsAfter = null;
      }
      withReviews = withReviews && reviewsAfter !== null;
    }
  }
  return {
    author,
    remarks: remarks.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    truncated: commentsAfter !== null || reviewsAfter !== null,
  };
}

function threadCommentRow(comment, threadPath) {
  return {
    id: comment.id,
    kind: "review-comment",
    author: toActor(comment.author),
    body: comment.body ?? "",
    createdAt: comment.createdAt,
    editedAt: comment.lastEditedAt ?? null,
    url: trimmed(comment.url),
    path: threadPath,
    reviewState: null,
  };
}

function decodeThreadEntries(connection) {
  const entries = [];
  let malformed = false;
  for (const thread of nodesOf(connection)) {
    const path = trimmed(thread.path);
    const id = trimmed(thread.id);
    const loaded = nodesOf(thread.comments);
    const visible = loaded.filter((comment) => !comment.isMinimized);
    if (path === null || id === null || visible.length === 0) continue;
    const nextCursor = nextCursorOf(thread.comments?.pageInfo);
    if (thread.comments?.pageInfo?.hasNextPage === true && nextCursor === null) malformed = true;
    const totalCount = thread.comments?.totalCount;
    const countValid = Number.isInteger(totalCount) && totalCount >= 0;
    if (!countValid) malformed = true;
    entries.push({
      thread: {
        id,
        path,
        line: thread.line !== null && thread.line > 0 ? thread.line : null,
        side: thread.diffSide?.toUpperCase() === "LEFT" ? "left" : "right",
        isResolved: thread.isResolved === true,
        isOutdated: thread.isOutdated === true,
        comments: visible.map((comment) => threadCommentRow(comment, path)),
      },
      commentCount: countValid ? totalCount - (loaded.length - visible.length) : null,
      nextCommentCursor: nextCursor,
    });
  }
  return { entries, malformed };
}

async function readReviewThreads(client, target, markers) {
  const entries = [];
  let cursor = null;
  const seenCursors = new Set();
  let reviewThreadsTruncated = false;
  try {
    for (let page = 0; page < REVIEW_THREAD_PAGES; page++) {
      const data = await executeGraphQL(client, THREADS_QUERY, {
        owner: target.parsed.owner,
        name: target.parsed.name,
        number: target.pr,
        after: cursor,
      }, { host: target.host, operation: "readActivityReviewThreads" });
      const connection = data?.repository?.pullRequest?.reviewThreads;
      if (connection === undefined) {
        throw typedError("not_found", "GitHub could not find the pull request review-thread target.", {
          retryable: false,
        });
      }
      const pageRead = decodeThreadEntries(connection);
      if (pageRead.malformed) markers.malformedCursor = true;
      entries.push(...pageRead.entries);
      const next = nextCursorOf(connection.pageInfo);
      if (next === null) {
        cursor = null;
        break;
      }
      if ((cursor !== null && next === cursor) || seenCursors.has(next)) {
        markers.repeatedCursor = true;
        reviewThreadsTruncated = true;
        cursor = next;
        break;
      }
      seenCursors.add(next);
      cursor = next;
    }
    if (cursor !== null) reviewThreadsTruncated = true;
  } catch (error) {
    if (isRateOrPause(error)) throw error;
    markers.threadReadFailed = true;
    return {
      entries: [],
      reviewThreadsTruncated: true,
      truncated: true,
    };
  }
  return {
    entries,
    reviewThreadsTruncated,
    truncated: reviewThreadsTruncated || entries.some((entry) => entry.nextCommentCursor !== null),
  };
}

function decodeThreadTailPage(data) {
  const expected = data?.repository?.pullRequest?.id;
  const thread = data?.node?.__typename === "PullRequestReviewThread" ? data.node : null;
  const loaded = nodesOf(thread?.comments);
  const visible = loaded.filter((comment) => !comment.isMinimized);
  return {
    belongsToPullRequest: expected !== undefined && expected === thread?.pullRequest?.id,
    comments: visible,
    hiddenCount: loaded.length - visible.length,
    nextCursor: nextCursorOf(thread?.comments?.pageInfo),
    hasNextPage: thread?.comments?.pageInfo?.hasNextPage === true,
  };
}

function cacheGet(cache, key) {
  if (!cache) return undefined;
  if (cache instanceof Map) return cache.get(key);
  return cache[key];
}

function cacheSet(cache, key, value) {
  if (!cache) return;
  if (cache instanceof Map) cache.set(key, value);
  else cache[key] = value;
}

function cacheDelete(cache, key) {
  if (!cache) return;
  if (cache instanceof Map) cache.delete(key);
  else delete cache[key];
}

/** Read conversation and review-thread remarks with T3's completeness proof. */
export async function readActivity(client, targetInput) {
  const target = normalizeSlice(targetInput);
  if (target.parsed === null) {
    throw typedError("invalid_arguments", "An activity read needs host, owner/repo, and a positive pull request number.", {
      retryable: false,
    });
  }
  const nowMs = normalizeNow(targetInput.now);
  const markers = {
    repeatedCursor: false,
    wrongPullRequestTail: false,
    unprovenTail: false,
    malformedCursor: false,
    threadReadFailed: false,
    tailReadFailed: false,
  };
  const [conversation, threadRead] = await Promise.all([
    readConversation(client, target, markers),
    readReviewThreads(client, target, markers),
  ]);

  const reviewThreads = threadRead.entries.map((entry) => ({
    ...entry.thread,
    commentCount: entry.commentCount,
    ...(entry.nextCommentCursor === null ? {} : { nextCommentsCursor: entry.nextCommentCursor }),
  }));
  const visibleThreadComments = reviewThreads.flatMap((thread) => thread.comments);
  const visibleRemarks = [...conversation.remarks, ...visibleThreadComments]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const commentsTruncated = conversation.truncated || threadRead.truncated;
  const gateIncomplete = commentsTruncated && threadRead.reviewThreadsTruncated !== false;

  const visibleThrough = visibleRemarks.reduce(
    (latest, comment) => Math.max(latest, Date.parse(comment.editedAt ?? comment.createdAt)),
    0,
  );
  const paginated = reviewThreads.filter((thread) => thread.nextCommentsCursor != null);
  const cacheKey = `${target.host}:${target.repo}#${target.pr}`;
  const tailCache = targetInput.tailCache;
  const cached = cacheGet(tailCache, cacheKey);
  const reuse = cached !== undefined &&
    nowMs - cached.fetchedAt < (targetInput.tailCacheTtlMs ?? TAIL_CACHE_TTL_MS) &&
    cached.visibleThrough === visibleThrough &&
    cached.tails?.size === paginated.length &&
    paginated.every((thread) => cached.tails.get(thread.id)?.count === (thread.commentCount ?? 0));

  const tails = new Map();
  const remarks = [...visibleRemarks];
  for (const thread of paginated) {
    const count = thread.commentCount;
    if (!Number.isInteger(count) || count < 0) {
      markers.unprovenTail = true;
      continue;
    }
    let tail = reuse ? cached.tails.get(thread.id) : undefined;
    if (tail === undefined) {
      const comments = new Map();
      const cursors = new Set();
      let hidden = 0;
      let cursor = thread.nextCommentsCursor ?? null;
      let failed = false;
      while (cursor !== null) {
        if (cursors.has(cursor)) {
          markers.repeatedCursor = true;
          failed = true;
          break;
        }
        cursors.add(cursor);
        let page;
        try {
          const data = await executeGraphQL(client, THREAD_COMMENTS_QUERY, {
            owner: target.parsed.owner,
            name: target.parsed.name,
            number: target.pr,
            threadId: thread.id,
            after: cursor,
          }, { host: target.host, operation: "readActivityThreadTail" });
          page = decodeThreadTailPage(data);
        } catch (error) {
          if (isRateOrPause(error)) throw error;
          markers.tailReadFailed = true;
          failed = true;
          break;
        }
        if (!page.belongsToPullRequest) {
          markers.wrongPullRequestTail = true;
          failed = true;
          break;
        }
        if (page.hasNextPage && page.nextCursor === null) {
          markers.malformedCursor = true;
          failed = true;
          break;
        }
        for (const comment of page.comments) {
          comments.set(comment.id, threadCommentRow(comment, thread.path));
        }
        hidden += page.hiddenCount ?? 0;
        cursor = page.nextCursor;
      }
      if (failed || thread.comments.length + comments.size + hidden < count) {
        markers.unprovenTail = true;
        continue;
      }
      tail = { count, comments: [...comments.values()] };
    }
    tails.set(thread.id, tail);
    remarks.push(...tail.comments);
  }

  const incomplete = gateIncomplete ||
    markers.repeatedCursor ||
    markers.wrongPullRequestTail ||
    markers.unprovenTail ||
    markers.malformedCursor ||
    markers.threadReadFailed ||
    markers.tailReadFailed;
  const fetchedAtMs = reuse ? cached.fetchedAt : nowMs;
  if (incomplete) {
    cacheDelete(tailCache, cacheKey);
  } else {
    cacheSet(tailCache, cacheKey, {
      fetchedAt: fetchedAtMs,
      visibleThrough,
      tails,
    });
  }
  const complete = !incomplete;
  return {
    author: conversation.author,
    remarks: complete
      ? remarks.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      : null,
    commentCount: conversation.remarks.length + threadRead.entries.reduce((total, entry) => total + entry.commentCount, 0),
    reviewThreads,
    commentsTruncated,
    reviewThreadsTruncated: threadRead.reviewThreadsTruncated,
    complete,
    completeness: {
      complete,
      commentsTruncated,
      reviewThreadsTruncated: threadRead.reviewThreadsTruncated,
      repeatedCursor: markers.repeatedCursor,
      wrongPullRequestTail: markers.wrongPullRequestTail,
      unprovenTail: markers.unprovenTail,
      malformedCursor: markers.malformedCursor,
      threadReadFailed: markers.threadReadFailed,
      tailReadFailed: markers.tailReadFailed,
    },
    fetchedAt: isoFromMs(fetchedAtMs),
  };
}

/** Pure durable quota observation reducer; it never locally debits remaining quota. */
export function updateHostQuota(hostState, observation, now = Date.now()) {
  const current = hostState && typeof hostState === "object" ? hostState : {};
  const headers = normalizeHeaders(observation?.headers ?? observation);
  const integerHeader = (value) => {
    const text = trimmed(value);
    return text !== null && /^-?\d+$/u.test(text) ? Number(text) : Number.NaN;
  };
  const numericHeader = (value) => {
    const text = trimmed(value);
    return text === null ? Number.NaN : Number(text);
  };
  const resource = trimmed(headers["x-ratelimit-resource"]);
  const limit = integerHeader(headers["x-ratelimit-limit"]);
  const remaining = integerHeader(headers["x-ratelimit-remaining"]);
  const usedNumber = integerHeader(headers["x-ratelimit-used"]);
  const reset = numericHeader(headers["x-ratelimit-reset"]);
  if (
    resource === null ||
    !Number.isInteger(limit) || limit <= 0 ||
    !Number.isInteger(remaining) || remaining < 0 ||
    !Number.isFinite(reset)
  ) {
    return current;
  }
  const resetAtMs = reset * 1_000;
  if (!Number.isFinite(resetAtMs) || Math.abs(resetAtMs) > 8_640_000_000_000_000) return current;
  const resetAt = isoFromMs(resetAtMs);
  const prior = current.rateLimits?.[resource];
  if (prior !== undefined && Date.parse(prior.resetAt) > resetAtMs) return current;
  return {
    ...current,
    rateLimits: {
      ...(current.rateLimits ?? {}),
      [resource]: {
        limit,
        remaining,
        used: Number.isInteger(usedNumber) && usedNumber >= 0 ? usedNumber : null,
        resetAt,
      },
    },
  };
}
