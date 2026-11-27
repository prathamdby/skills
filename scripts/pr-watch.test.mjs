import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { evaluateWatch, makeInitialDedupe } from "../skills/engineering/gh/scripts/pr-watch-evaluator.mjs";
import { createWatchStore, initialState, validateState, eventId } from "../skills/engineering/gh/scripts/pr-watch-store.mjs";
import * as githubModule from "../skills/engineering/gh/scripts/pr-watch-github.mjs";
import { runCli } from "../skills/engineering/gh/scripts/pr-watch.mjs";
import { addWatch } from "../skills/engineering/gh/scripts/pr-watch-engine.mjs";
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

