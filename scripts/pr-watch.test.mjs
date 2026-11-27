import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { evaluateWatch, makeInitialDedupe } from "../skills/engineering/gh/scripts/pr-watch-evaluator.mjs";
import { createWatchStore, initialState, validateState, eventId } from "../skills/engineering/gh/scripts/pr-watch-store.mjs";
import * as githubModule from "../skills/engineering/gh/scripts/pr-watch-github.mjs";
import { runCli } from "../skills/engineering/gh/scripts/pr-watch.mjs";
import { addWatch, runSweep, planGroupReads, groupWatches, createQuotaAwareTransport } from "../skills/engineering/gh/scripts/pr-watch-engine.mjs";
import { registerEvaluatorCases } from "./pr-watch-evaluator-cases.mjs";
import { registerGitHubFixtureCases } from "./pr-watch-github-fixtures.mjs";
import { registerStoreCases } from "./pr-watch-store-cases.mjs";
import { registerCliCases } from "./pr-watch-cli-cases.mjs";

registerEvaluatorCases({ test, assert, evaluateWatch, makeInitialDedupe });
registerGitHubFixtureCases({ test, assert, module: githubModule });
registerStoreCases({ test, assert, createWatchStore, initialState, validateState, eventId });
registerCliCases({ test, assert, runCli });

async function tempStore() {
  const dir = await mkdtemp(path.join(tmpdir(), "pr-watch-test-"));
  const store = createWatchStore({ statePath: path.join(dir, "state.json"), lockWaitMs: 1_000, staleLockMs: 250, heartbeatMs: 20 });
  return { dir, store, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

function check(name, status, extra = {}) {
  return { name, status, description: null, url: `https://ci.example/${name}`, ...extra };
}

function detail(overrides = {}) {
  return {
    capabilities: { checksAlwaysReport: true },
    state: "open",
    repository: "owner/repo",
    url: "https://github.com/owner/repo/pull/123",
    headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    headBranch: "feature",
    headRepositoryOwner: "owner",
    isCrossRepository: false,
    mergeability: "mergeable",
    baseBranch: "main",
    mergeCommitSha: null,
    mergedBy: null,
    checks: [check("lint", "success"), check("test", "pending")],
    viewer: "agent-user",
    author: { login: "agent-user" },
    checksTrusted: true,
    ...overrides,
  };
}

function activity(overrides = {}) {
  return {
    remarks: [],
    complete: true,
    commentsTruncated: false,
    reviewThreadsTruncated: false,
    fetchedAt: "2026-11-27T00:00:00.000Z",
    ...overrides,
  };
}

function fingerprint(overrides = {}) {
  return {
    key: "github.com:owner/repo#123",
    fingerprint: {
      status: "OPEN MERGEABLE aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa SUCCESS:1 0",
      remarks: "0  0  0",
    },
    checksPending: false,
    ...overrides,
  };
}

function fakeGithub(overrides = {}) {
  const detailValue = overrides.detail ?? detail();
  const activityValue = overrides.activity ?? activity();
  const fingerprintValue = overrides.fingerprint ?? fingerprint();
  return {
    calls: [],
    async readFingerprints(slices, options) {
      this.calls.push(["fingerprints", slices, options]);
      if (overrides.fingerprintError) throw overrides.fingerprintError;
      return slices.map((slice) => ({ ...fingerprintValue, key: slice.key }));
    },
    async readDetail(target) {
      this.calls.push(["detail", target]);
      if (overrides.detailError) throw overrides.detailError;
      return structuredClone(detailValue);
    },
    async readActivity(target) {
      this.calls.push(["activity", target]);
      if (overrides.activityError) throw overrides.activityError;
      return structuredClone(activityValue);
    },
  };
}

test("engine registration: first-time add appends no events and preserves baseline", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const github = fakeGithub({
      detail: detail({ checks: [check("lint", "failure"), check("test", "pending")] }),
    });
    const result = await addWatch({ store, github, host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 });
    assert.equal(result.outcome, "added");
    assert.deepEqual(result.events, []);
    const state = await store.readState();
    assert.equal(state.events.length, 0);
    assert.equal(state.watches.w_test1.state, "active");
    assert.equal(state.watches.w_test1.dedupe.failedChecks.includes("lint"), true);
    const read = state.groups["github.com:owner/repo#123"].read;
    assert.equal(read.lastDetailAt != null, true);
    assert.equal(read.statusFingerprint, fingerprint().fingerprint.status);
    assert.equal(read.remarksFingerprint, fingerprint().fingerprint.remarks);
    assert.equal(github.calls[0]?.[2]?.includeRollupState, true);
  } finally {
    await cleanup();
  }
});

test("engine registration: terminal target is non-retryable conflict before state write", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const github = fakeGithub({ detail: detail({ state: "merged" }) });
    await assert.rejects(
      addWatch({ store, github, host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1" }),
      (error) => error.reason === "conflict" && error.retryable === false && error.data?.state === "merged",
    );
    const state = await store.readState();
    assert.deepEqual(state.watches, {});
    assert.deepEqual(state.groups, {});
    assert.deepEqual(state.events, []);
  } finally {
    await cleanup();
  }
});

test("engine registration: degraded approval baseline persists checks marker and warning", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const github = fakeGithub({
      detail: detail({
        checks: [check("Workflow approval status", "action-required", { url: null, placeholder: true })],
      }),
    });
    const result = await addWatch({ store, github, host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 });
    assert.equal(result.outcome, "added");
    assert.equal(result.warnings.some((item) => item.reason === "baseline_incomplete"), true);
    const state = await store.readState();
    assert.equal(state.watches.w_test1.dedupe.awaitingBaseline, "checks");
  } finally {
    await cleanup();
  }
});

test("engine registration cancellation after reads start prevents the state write", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    let canceled = false;
    const backing = fakeGithub();
    const github = {
      readFingerprints: (slices) => backing.readFingerprints(slices),
      async readDetail(target) {
        const value = await backing.readDetail(target);
        canceled = true;
        return value;
      },
      readActivity: (target) => backing.readActivity(target),
    };
    await assert.rejects(
      addWatch({
        store,
        github,
        host: "github.com",
        repo: "owner/repo",
        pr: 123,
        id: "w_test1",
        isCanceled: () => canceled,
      }),
      (error) => error.reason === "canceled" && error.retryable === false,
    );
    const state = await store.readState();
    assert.deepEqual(state.watches, {});
    assert.deepEqual(state.groups, {});
    assert.deepEqual(state.events, []);
  } finally {
    await cleanup();
  }
});

test("engine sweep cancellation before a group commit prevents watch and event writes", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const baseMs = 1764300000000;
    await addWatch({ store, github: fakeGithub(), host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => baseMs });
    const before = await store.readState();
    let canceled = false;
    const backing = fakeGithub({
      detail: detail({ mergeability: "conflicting" }),
      fingerprint: fingerprint({ fingerprint: { status: "changed", remarks: "0  0  0" } }),
    });
    const github = {
      readFingerprints: (slices) => backing.readFingerprints(slices),
      async readDetail(target) {
        const value = await backing.readDetail(target);
        canceled = true;
        return value;
      },
      readActivity: (target) => backing.readActivity(target),
    };
    await assert.rejects(
      runSweep({ store, github, now: () => baseMs + 1_000, isCanceled: () => canceled }),
      (error) => error.reason === "canceled" && error.retryable === false,
    );
    const after = await store.readState();
    assert.deepEqual(after.watches, before.watches);
    assert.deepEqual(after.events, []);
    assert.deepEqual(after.groups["github.com:owner/repo#123"].read, before.groups["github.com:owner/repo#123"].read);
  } finally {
    await cleanup();
  }
});

test("engine read planner covers deadlines and fingerprint escalation", () => {
  const watch = {
    id: "w_test1",
    key: "github.com:owner/repo#123",
    host: "github.com",
    repo: "owner/repo",
    pr: 123,
    dedupe: { checksPending: true, checksAwaitedSince: null },
  };
  const group = groupWatches([watch])[0];
  const read = {
    lastFingerprintAt: "2026-11-27T00:00:00.000Z",
    lastDetailAt: "2026-11-27T00:00:00.000Z",
    lastActivityAt: "2026-11-27T00:00:00.000Z",
    statusFingerprint: "a",
    remarksFingerprint: "b",
    detailInFlight: false,
    remarksIncomplete: false,
    consecutiveFailures: 0,
    lastErrorReason: null,
  };
  const now = Date.parse("2026-11-27T00:01:00.000Z");
  assert.deepEqual(planGroupReads(group, read, { status: "a", remarks: "b" }, now), { detail: false, activity: false });
  assert.equal(planGroupReads(group, read, { status: "x", remarks: "b" }, now).detail, true);
  assert.equal(planGroupReads(group, read, { status: "a", remarks: "x" }, now).activity, true);
  assert.deepEqual(planGroupReads(group, read, null, now + 10 * 60_000), { detail: true, activity: true });
  assert.deepEqual(planGroupReads(group, read, { status: "a", remarks: "b" }, now + 28 * 60_000), { detail: false, activity: false });
  assert.deepEqual(planGroupReads(group, read, { status: "a", remarks: "b" }, now + 29 * 60_000), { detail: true, activity: true });
  assert.equal(planGroupReads(group, { ...read, detailInFlight: true }, { status: "a", remarks: "b" }, now).detail, true);
  assert.equal(planGroupReads(group, { ...read, remarksIncomplete: true }, { status: "a", remarks: "b" }, now).activity, true);
});

test("engine bounded sweep with unchanged fingerprint exits clean without events", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const github = fakeGithub();
    await addWatch({ store, github, host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 });
    const state = await store.readState();
    const read = state.groups["github.com:owner/repo#123"].read;
    const fp = {
      key: "github.com:owner/repo#123",
      fingerprint: { status: read.statusFingerprint, remarks: read.remarksFingerprint },
      checksPending: false,
    };
    const sweepGithub = fakeGithub({ fingerprint: fp });
    const result = await runSweep({ store, github: sweepGithub, now: () => 1764300000000 });
    assert.equal(result.outcome, "completed");
    assert.deepEqual(result.events, []);
    assert.equal(result.summary.succeeded, 1);
  } finally {
    await cleanup();
  }
});

test("engine fingerprint-only sweep updates only the fingerprint timestamp", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const github = fakeGithub();
    await addWatch({ store, github, host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 });
    const key = "github.com:owner/repo#123";
    await store.withStateLock(async () => {
      const state = await store.readState();
      state.groups[key].read.lastErrorReason = "api_error";
      state.groups[key].read.detailInFlight = false;
      await store.writeState(state);
    });
    const before = await store.readState();
    const read = before.groups[key].read;
    const fp = {
      key,
      fingerprint: { status: read.statusFingerprint, remarks: read.remarksFingerprint },
      checksPending: false,
    };
    const sweepGithub = fakeGithub({ fingerprint: fp });
    sweepGithub.calls = [];
    const result = await runSweep({ store, github: sweepGithub, now: () => 1764300000000 });
    assert.equal(result.outcome, "completed");
    assert.equal(sweepGithub.calls.some(([name]) => name === "detail" || name === "activity"), false);
    const after = await store.readState();
    assert.equal(after.groups[key].read.lastErrorReason, "api_error");
    assert.equal(after.groups[key].read.lastDetailAt, read.lastDetailAt);
    assert.equal(after.groups[key].read.statusFingerprint, read.statusFingerprint);
  } finally {
    await cleanup();
  }
});

test("engine passes the active reread interval to follow tail reuse", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const baseMs = 1764300000000;
    await addWatch({ store, github: fakeGithub(), host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => baseMs });
    const activityTargets = [];
    let fingerprintMode = "missing";
    const github = {
      async readFingerprints(slices) {
        return slices.map((slice) => fingerprintMode === "missing"
          ? { key: slice.key, fingerprint: null }
          : { key: slice.key, fingerprint: { status: "same", remarks: "changed" }, checksPending: false });
      },
      async readDetail() {
        return detail();
      },
      async readActivity(target) {
        activityTargets.push(target);
        return activity();
      },
    };
    const tailCache = new Map();
    await runSweep({ store, github, now: () => baseMs + 600_000, tailCache });
    assert.equal(activityTargets.at(-1).tailCacheTtlMs, 600_000);

    fingerprintMode = "usable";
    await runSweep({ store, github, now: () => baseMs + 601_000, tailCache });
    assert.equal(activityTargets.at(-1).tailCacheTtlMs, 1_800_000);
  } finally {
    await cleanup();
  }
});

test("engine sweep commit timestamps reflect the state write rather than read planning", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const baseMs = Date.parse("2026-11-27T00:00:00.000Z");
    const planningMs = baseMs + 1_000;
    const commitMs = baseMs + 10_000;
    await addWatch({
      store,
      github: fakeGithub(),
      host: "github.com",
      repo: "owner/repo",
      pr: 123,
      id: "w_test1",
      now: () => baseMs,
    });
    let currentMs = planningMs;
    const backing = fakeGithub({
      detail: detail({ mergeability: "conflicting" }),
      fingerprint: fingerprint({
        fingerprint: { status: "changed", remarks: "0  0  0" },
      }),
    });
    const sweepGithub = {
      readFingerprints: (slices) => backing.readFingerprints(slices),
      async readDetail(target) {
        const value = await backing.readDetail(target);
        currentMs = commitMs;
        return value;
      },
      readActivity: (target) => backing.readActivity(target),
    };
    const result = await runSweep({ store, github: sweepGithub, now: () => currentMs });
    assert.equal(result.events[0]?.type, "conflicting");
    assert.equal(result.events[0]?.createdAt, new Date(commitMs).toISOString());
    const state = await store.readState();
    assert.equal(state.watches.w_test1.updatedAt, new Date(commitMs).toISOString());
    assert.equal(state.updatedAt, new Date(commitMs).toISOString());
    assert.equal(state.groups["github.com:owner/repo#123"].read.lastDetailAt, new Date(planningMs).toISOString());
  } finally {
    await cleanup();
  }
});

function emptyQuotaRow(overrides = {}) {
  return {
    pausedUntil: null,
    pauseReason: null,
    rateLimits: {},
    consecutiveRateLimitFailures: 0,
    rateLimitGeneration: 0,
    ...overrides,
  };
}

async function writeHostRow(store, host, row) {
  await store.withStateLock(async () => {
    const state = await store.readState();
    state.hosts[host] = structuredClone(row);
    await store.writeState(state);
  });
}

function quotaHeaders(resource, { limit = 100, remaining = 100, resetAtMs, used = null, extra = {} }) {
  return {
    "x-ratelimit-resource": resource,
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": String(remaining),
    ...(used === null ? {} : { "x-ratelimit-used": String(used) }),
    "x-ratelimit-reset": String(Math.floor(resetAtMs / 1_000)),
    ...extra,
  };
}

function transportResponse(overrides = {}) {
  return {
    status: 200,
    headers: {},
    data: {},
    errors: [],
    requestId: null,
    ...overrides,
  };
}

test("quota transport admission uses independent per-resource floors before host pause", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const nowMs = Date.parse("2026-11-27T00:00:00.000Z");
    const resetAtMs = nowMs + 600_000;
    await writeHostRow(store, "github.com", emptyQuotaRow({
      rateLimits: {
        graphql: { limit: 100, remaining: 10, used: 90, resetAt: new Date(resetAtMs).toISOString() },
        core: { limit: 100, remaining: 9, used: 91, resetAt: new Date(resetAtMs).toISOString() },
      },
    }));
    const calls = { graphql: 0, rest: 0 };
    const client = createQuotaAwareTransport({
      store,
      now: () => nowMs,
      transport: {
        async graphql() {
          calls.graphql += 1;
          return transportResponse();
        },
        async rest() {
          calls.rest += 1;
          return transportResponse();
        },
      },
    });
    await client.graphql("query Q {}", {}, { host: "github.com" });
    assert.equal(calls.graphql, 1);
    await assert.rejects(
      client.rest("repos/owner/repo", { host: "github.com" }),
      (error) => error.reason === "rate_limited" && error.retryAfter === 600,
    );
    assert.equal(calls.rest, 0);
  } finally {
    await cleanup();
  }
});

test("quota transport persists observations immediately and rejects stale reset windows", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const nowMs = Date.parse("2026-11-27T00:00:00.000Z");
    const newerResetMs = nowMs + 600_000;
    const olderResetMs = nowMs + 300_000;
    const responses = [
      transportResponse({ headers: quotaHeaders("graphql", { remaining: 42, used: 58, resetAtMs: newerResetMs }) }),
      transportResponse({ headers: quotaHeaders("graphql", { remaining: 99, used: 1, resetAtMs: olderResetMs }) }),
    ];
    const client = createQuotaAwareTransport({
      store,
      now: () => nowMs,
      transport: {
        async graphql() {
          return responses.shift() ?? transportResponse();
        },
        async rest() {
          return transportResponse();
        },
      },
    });
    await client.graphql("query Q {}", {}, { host: "github.com" });
    let state = await store.readState();
    assert.deepEqual(state.hosts["github.com"].rateLimits.graphql, {
      limit: 100,
      remaining: 42,
      used: 58,
      resetAt: new Date(newerResetMs).toISOString(),
    });
    await client.graphql("query Q {}", {}, { host: "github.com" });
    state = await store.readState();
    assert.deepEqual(state.hosts["github.com"].rateLimits.graphql, {
      limit: 100,
      remaining: 42,
      used: 58,
      resetAt: new Date(newerResetMs).toISOString(),
    });
  } finally {
    await cleanup();
  }
});

test("quota transport applies generation leases, stale refusals, fallback backoff, and success reset", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    let nowMs = Date.parse("2026-11-27T00:00:00.000Z");
    let mode = "held";
    const held = [];
    const client = createQuotaAwareTransport({
      store,
      now: () => nowMs,
      transport: {
        graphql() {
          if (mode === "held") return new Promise((resolve) => held.push(resolve));
          if (mode === "fallback") {
            return Promise.resolve(transportResponse({ status: 429, headers: {}, data: null }));
          }
          return Promise.resolve(transportResponse());
        },
        async rest() {
          return transportResponse();
        },
      },
    });

    const first = client.graphql("query Q {}", {}, { host: "github.com" });
    const second = client.graphql("query Q {}", {}, { host: "github.com" });
    for (let index = 0; index < 100 && held.length < 2; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(held.length, 2);
    const firstResult = assert.rejects(first, (error) =>
      error.reason === "rate_limited" && error.retryAfter === 60 && error.requestId === "req-rate");
    held[0](transportResponse({
      status: 429,
      headers: { "retry-after": "60", "x-github-request-id": "req-rate" },
      data: null,
      requestId: "req-rate",
    }));
    await firstResult;

    const secondResult = assert.rejects(second, (error) => error.reason === "rate_limited" && error.retryAfter === 120);
    held[1](transportResponse({ status: 429, headers: { "retry-after": "120" }, data: null }));
    await secondResult;

    let state = await store.readState();
    let host = state.hosts["github.com"];
    assert.equal(host.consecutiveRateLimitFailures, 1);
    assert.equal(host.rateLimitGeneration, 1);
    assert.equal(host.pausedUntil, new Date(nowMs + 120_000).toISOString());

    await assert.rejects(
      client.rest("repos/owner/repo", { host: "github.com" }),
      (error) => error.reason === "rate_limited" && error.retryAfter === 120,
    );

    nowMs += 121_000;
    mode = "success";
    await client.graphql("query Q {}", {}, { host: "github.com" });
    state = await store.readState();
    host = state.hosts["github.com"];
    assert.equal(host.consecutiveRateLimitFailures, 0);
    assert.equal(host.rateLimitGeneration, 1);
    assert.equal(host.pausedUntil, null);
    assert.equal(host.pauseReason, null);

    mode = "fallback";
    await assert.rejects(client.graphql("query Q {}", {}, { host: "github.com" }), (error) =>
      error.reason === "rate_limited" && error.retryAfter === 60);
    state = await store.readState();
    host = state.hosts["github.com"];
    assert.equal(host.consecutiveRateLimitFailures, 1);
    assert.equal(host.rateLimitGeneration, 2);
    assert.equal(host.pausedUntil, new Date(nowMs + 60_000).toISOString());

    nowMs += 61_000;
    await assert.rejects(client.graphql("query Q {}", {}, { host: "github.com" }), (error) =>
      error.reason === "rate_limited" && error.retryAfter === 120);
    state = await store.readState();
    host = state.hosts["github.com"];
    assert.equal(host.consecutiveRateLimitFailures, 2);
    assert.equal(host.rateLimitGeneration, 3);
    assert.equal(host.pausedUntil, new Date(nowMs + 120_000).toISOString());
  } finally {
    await cleanup();
  }
});

test("quota transport caps requests at eight per host", async () => {
  let state = initialState("2026-11-27T00:00:00.000Z");
  const store = {
    async readState() {
      return structuredClone(state);
    },
    async writeState(next) {
      state = structuredClone(next);
    },
    async withStateLock(fn) {
      return fn();
    },
  };
  let active = 0;
  let maximum = 0;
  const client = createQuotaAwareTransport({
    store,
    transport: {
      async graphql() {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return transportResponse();
      },
      async rest() {
        return transportResponse();
      },
    },
  });
  await Promise.all(Array.from({ length: 24 }, () => client.graphql("query Q {}", {}, { host: "github.com" })));
  assert.equal(maximum, 8);
});

test("quota transport counts non-rate GraphQL error responses as lease successes", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    let nowMs = Date.parse("2026-11-27T00:00:00.000Z");
    let response = transportResponse({ status: 429, headers: {}, data: null });
    const client = createQuotaAwareTransport({
      store,
      now: () => nowMs,
      transport: {
        async graphql() {
          return response;
        },
        async rest() {
          return transportResponse();
        },
      },
    });
    await assert.rejects(client.graphql("query Q {}", {}, { host: "github.com" }), (error) => error.reason === "rate_limited");
    let state = await store.readState();
    assert.equal(state.hosts["github.com"].consecutiveRateLimitFailures, 1);

    nowMs += 61_000;
    response = transportResponse({
      data: null,
      errors: [{ type: "NOT_FOUND", message: "Could not resolve one field." }],
    });
    await client.graphql("query Q {}", {}, { host: "github.com" });
    state = await store.readState();
    assert.equal(state.hosts["github.com"].consecutiveRateLimitFailures, 0);
    assert.equal(state.hosts["github.com"].pausedUntil, null);
  } finally {
    await cleanup();
  }
});

test("engine registration canonicalizes repository keys and carries ended dedupe case-insensitively", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const baseDetail = detail({ repository: "Owner/Repo", url: "https://github.com/Owner/Repo/pull/123" });
    await addWatch({
      store,
      github: fakeGithub({ detail: baseDetail }),
      host: "github.com",
      repo: "owner/repo",
      pr: 123,
      id: "w_test1",
      now: () => 1764300000000,
    });
    let state = await store.readState();
    const canonicalKey = "github.com:Owner/Repo#123";
    assert.equal(state.watches.w_test1.key, canonicalKey);

    await store.withStateLock(async () => {
      const mutable = await store.readState();
      const watch = mutable.watches.w_test1;
      watch.state = "ended";
      watch.endedAt = "2026-11-27T00:10:00.000Z";
      watch.endReason = "removed";
      watch.updatedAt = watch.endedAt;
      mutable.endedWatches[canonicalKey] = {
        endedAt: watch.endedAt,
        endReason: "removed",
        lastWatchId: watch.id,
        dedupe: structuredClone(watch.dedupe),
      };
      mutable.updatedAt = watch.endedAt;
      await store.writeState(mutable);
    });

    const readdDetail = detail({
      repository: "Owner/Repo",
      url: "https://github.com/Owner/Repo/pull/123",
      mergeability: "conflicting",
    });
    const result = await addWatch({
      store,
      github: fakeGithub({ detail: readdDetail }),
      host: "github.com",
      repo: "owner/repo",
      pr: 123,
      id: "w_test2",
      now: () => 1764300001200,
    });
    assert.equal(result.outcome, "added");
    assert.equal(result.watch.key, canonicalKey);
    assert.equal(result.events.some((event) => event.type === "conflicting"), true);
    state = await store.readState();
    assert.equal(state.watches.w_test2.key, canonicalKey);
    assert.equal(state.groups[canonicalKey] !== undefined, true);
  } finally {
    await cleanup();
  }
});

test("engine sweep paused at fingerprint admission leaves group read state unchanged", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    await addWatch({ store, github: fakeGithub(), host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 });
    const before = await store.readState();
    const key = "github.com:owner/repo#123";
    const paused = new Error("GitHub requests are paused.");
    paused.reason = "rate_limited";
    paused.retryable = true;
    paused.retryAfter = 30;
    const result = await runSweep({
      store,
      github: fakeGithub({ fingerprintError: paused }),
      now: () => 1764300001000,
    });
    assert.equal(result.outcome, "paused");
    assert.equal(result.summary.skipped, 1);
    assert.equal(result.results[0].error.reason, "rate_limited");
    const after = await store.readState();
    assert.deepEqual(after.groups[key], before.groups[key]);
    assert.equal(after.updatedAt, before.updatedAt);
    assert.deepEqual(after.events, before.events);
  } finally {
    await cleanup();
  }
});

test("engine sweep with no success and paused plus failed groups is failed", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    await addWatch({ store, github: fakeGithub(), host: "github.com", repo: "owner/repo", pr: 1, id: "w_test1", now: () => 1764300000000 });
    await addWatch({ store, github: fakeGithub(), host: "github.com", repo: "owner/repo", pr: 2, id: "w_test2", now: () => 1764300000000 });
    const paused = new Error("GitHub requests are paused.");
    paused.reason = "rate_limited";
    paused.retryable = true;
    const unreadable = new Error("missing");
    unreadable.reason = "not_found";
    unreadable.retryable = false;
    const github = {
      async readFingerprints(slices) {
        return slices.map((slice) => slice.pr === 1
          ? { key: slice.key, fingerprint: null, error: paused }
          : { key: slice.key, fingerprint: { status: "changed", remarks: "changed" }, checksPending: false });
      },
      async readDetail(target) {
        if (target.pr === 2) throw unreadable;
        return detail();
      },
      async readActivity() {
        return activity();
      },
    };
    const result = await runSweep({ store, github, now: () => 1764300001000 });
    assert.deepEqual(result.results.map((entry) => entry.outcome), ["paused", "failed"]);
    assert.equal(result.summary.succeeded, 0);
    assert.equal(result.summary.failed, 1);
    assert.equal(result.summary.skipped, 1);
    assert.equal(result.outcome, "failed");
  } finally {
    await cleanup();
  }
});

test("engine sweep ends a watch after eight consecutive unreadable detail failures", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    await addWatch({ store, github: fakeGithub(), host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 });
    const unreadable = new Error("GitHub could not find the pull request read target.");
    unreadable.reason = "not_found";
    unreadable.retryable = false;
    const degradedFingerprint = new Error("degraded");
    degradedFingerprint.reason = "api_error";
    const github = fakeGithub({ fingerprintError: degradedFingerprint, detailError: unreadable });
    let result = null;
    for (let index = 0; index < 8; index += 1) {
      result = await runSweep({ store, github, now: () => 1764300001000 + index * 1000 });
    }
    assert.equal(result.results[0].outcome, "ended");
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].type, "watch-ended");
    assert.deepEqual(result.events[0].data, { reason: "unreadable" });
    const state = await store.readState();
    assert.equal(state.watches.w_test1.state, "ended");
    assert.equal(state.watches.w_test1.endReason, "unreadable");
    assert.equal(state.endedWatches["github.com:owner/repo#123"].dedupe.headSha, state.watches.w_test1.dedupe.headSha);
  } finally {
    await cleanup();
  }
});

test("engine sweep emits one terminal event and ends merged watches without evaluator side effects", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    await addWatch({ store, github: fakeGithub(), host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 });
    const mergedDetail = detail({
      state: "merged",
      mergeCommitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      mergedBy: { login: "maintainer" },
      checks: [check("lint", "failure")],
    });
    const movedFingerprint = fingerprint({
      fingerprint: { status: "MERGED MERGEABLE bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", remarks: "changed" },
    });
    const result = await runSweep({
      store,
      github: fakeGithub({ detail: mergedDetail, fingerprint: movedFingerprint }),
      now: () => 1764300001000,
    });
    assert.equal(result.outcome, "completed");
    assert.equal(result.results[0].outcome, "ended");
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].type, "merged");
    assert.deepEqual(result.events[0].data, {
      baseBranch: "main",
      mergeCommitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      mergedBy: "maintainer",
    });
    const state = await store.readState();
    assert.equal(state.watches.w_test1.state, "ended");
    assert.equal(state.watches.w_test1.endReason, "merged");
    assert.equal(state.endedWatches["github.com:owner/repo#123"].endReason, "merged");
  } finally {
    await cleanup();
  }
});

test("engine sweep appends the final remarks event before a comment-limit watch-ended event", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    await addWatch({ store, github: fakeGithub(), host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 });
    await store.withStateLock(async () => {
      const state = await store.readState();
      state.watches.w_test1.dedupe.wakes = 9;
      await store.writeState(state);
    });
    const remark = {
      id: "reviewer-1",
      kind: "review-comment",
      author: { login: "reviewer" },
      body: "Please rename this.",
      createdAt: "2026-11-27T00:10:00.000Z",
      url: "https://github.com/owner/repo/pull/123#discussion-1",
      path: "src/index.ts",
      reviewState: null,
    };
    const movedFingerprint = fingerprint({
      fingerprint: { status: "changed-status", remarks: "changed-remarks" },
    });
    const result = await runSweep({
      store,
      github: fakeGithub({ fingerprint: movedFingerprint, activity: activity({ remarks: [remark] }) }),
      now: () => 1764300001000,
    });
    assert.equal(result.results[0].outcome, "ended");
    assert.deepEqual(result.events.map((event) => event.type), ["remarks", "watch-ended"]);
    assert.deepEqual(result.events[0].data, { count: 1 });
    assert.deepEqual(result.events[1].data, { reason: "comment-limit" });
    const state = await store.readState();
    assert.equal(state.watches.w_test1.state, "ended");
    assert.equal(state.watches.w_test1.endReason, "comment-limit");
    assert.equal(state.endedWatches["github.com:owner/repo#123"].dedupe.wakes, 10);
  } finally {
    await cleanup();
  }
});

test("engine registration reports enterprise degradation on add and unchanged re-add", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    const input = { store, github: fakeGithub(), host: "ghe.example.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 };
    const added = await addWatch(input);
    assert.equal(added.warnings.some((item) => item.reason === "enterprise_degraded"), true);
    const unchanged = await addWatch({ ...input, github: fakeGithub({ detailError: new Error("must not read") }) });
    assert.equal(unchanged.outcome, "unchanged");
    assert.equal(unchanged.warnings.some((item) => item.reason === "enterprise_degraded"), true);
  } finally {
    await cleanup();
  }
});

test("registration binds the raw transport when the engine has no quota adapter", async () => {
  const engine = await import("../skills/engineering/gh/scripts/pr-watch-engine.mjs");
  if (typeof engine.createQuotaAwareTransport === "function") return;
  const { githubInterface } = await import("../skills/engineering/gh/scripts/pr-watch.mjs");
  const github = {
    async readFingerprints() {
      return [];
    },
    async readDetail(_client, target) {
      return target;
    },
    async readActivity(_client, target) {
      return target;
    },
  };
  const bound = await githubInterface(github, {
    store: {},
    engine,
    now: () => 0,
    lib: {
      graphqlMetadata() {},
      restMetadata() {},
      gitHubCredentialFingerprint() {},
    },
  });
  assert.equal(typeof bound?.readDetail, "function");
  assert.deepEqual(await bound.readDetail({ host: "github.com", repo: "owner/repo", pr: 1 }), {
    host: "github.com",
    repo: "owner/repo",
    pr: 1,
  });
});

test("engine sweep compare-and-set discards stale outcomes without consuming event sequence", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    await addWatch({ store, github: fakeGithub(), host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 });
    const before = await store.readState();
    let releaseDetail;
    const detailGate = new Promise((resolve) => { releaseDetail = resolve; });
    const github = {
      async readFingerprints(slices) {
        return slices.map((slice) => ({
          key: slice.key,
          fingerprint: { status: "changed", remarks: "changed" },
          checksPending: false,
        }));
      },
      async readDetail() {
        return detailGate;
      },
      async readActivity() {
        return activity();
      },
    };
    const sweeping = runSweep({ store, github, now: () => 1764300001000 });
    for (let index = 0; index < 100 && !sweeping; index += 1) await new Promise((resolve) => setTimeout(resolve, 1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await store.withStateLock(async () => {
      const state = await store.readState();
      const watch = state.watches.w_test1;
      watch.state = "ended";
      watch.endedAt = "2026-11-27T00:20:00.000Z";
      watch.endReason = "removed";
      watch.updatedAt = watch.endedAt;
      state.endedWatches[watch.key] = {
        endedAt: watch.endedAt,
        endReason: "removed",
        lastWatchId: watch.id,
        dedupe: structuredClone(watch.dedupe),
      };
      state.updatedAt = watch.endedAt;
      await store.writeState(state);
    });
    releaseDetail(detail({ mergeability: "conflicting" }));
    const result = await sweeping;
    assert.equal(result.outcome, "failed");
    assert.equal(result.results[0].outcome, "failed");
    assert.equal(result.results[0].error.reason, "conflict");
    const after = await store.readState();
    assert.equal(after.nextEventSeq, before.nextEventSeq);
    assert.deepEqual(after.events, []);
    assert.equal(after.watches.w_test1.endReason, "removed");
  } finally {
    await cleanup();
  }
});

test("engine concurrent sweeps conflict without duplicating reads or events", async () => {
  const { dir, store, cleanup } = await tempStore();
  try {
    await addWatch({ store, github: fakeGithub(), host: "github.com", repo: "owner/repo", pr: 123, id: "w_test1", now: () => 1764300000000 });
    let detailCalled;
    const called = new Promise((resolve) => { detailCalled = resolve; });
    let releaseDetail;
    const gate = new Promise((resolve) => { releaseDetail = resolve; });
    const github = {
      async readFingerprints(slices) {
        return slices.map((slice) => ({
          key: slice.key,
          fingerprint: { status: "changed", remarks: "changed" },
          checksPending: false,
        }));
      },
      async readDetail() {
        detailCalled();
        return gate;
      },
      async readActivity() {
        return activity();
      },
    };
    const first = runSweep({ store, github, now: () => 1764300001000 });
    await called;
    await assert.rejects(
      runSweep({ store, github: fakeGithub(), now: () => 1764300001000 }),
      (error) => error.reason === "conflict" && error.retryable === true,
    );
    releaseDetail(detail({ mergeability: "conflicting" }));
    const result = await first;
    assert.equal(result.events.filter((event) => event.type === "conflicting").length, 1);
    const state = await store.readState();
    assert.equal(state.events.filter((event) => event.type === "conflicting").length, 1);
  } finally {
    await cleanup();
  }
});
