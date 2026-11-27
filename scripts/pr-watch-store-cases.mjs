import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const NOW = "2026-11-27T00:00:00.000Z";
const LATER = "2026-11-27T00:00:01.000Z";

function makeDedupe(overrides = {}) {
  return {
    startedAt: NOW,
    headSha: null,
    failedChecks: [],
    passed: false,
    passedChecks: [],
    owedChecks: [],
    awaitingApproval: [],
    approvalAnnounced: false,
    remarksThrough: NOW,
    remarkIds: [],
    conflicting: false,
    rebaseRequired: false,
    mergeQueueRemovalId: null,
    checksAwaitedSince: null,
    checksPending: false,
    wakes: 0,
    ...overrides,
  };
}

function makeWatch(id = "w_a0000", overrides = {}) {
  const { dedupe: dedupeOverrides, ...rest } = overrides;
  return {
    id,
    key: "github.com:owner/repo#123",
    host: "github.com",
    repo: "owner/repo",
    pr: 123,
    url: "https://github.com/owner/repo/pull/123",
    state: "active",
    createdAt: NOW,
    updatedAt: NOW,
    endedAt: null,
    endReason: null,
    ...rest,
    dedupe: makeDedupe(dedupeOverrides),
  };
}

function makeGroup(overrides = {}) {
  const { read: readOverrides, ...rest } = overrides;
  return {
    key: "github.com:owner/repo#123",
    host: "github.com",
    repo: "owner/repo",
    pr: 123,
    ...rest,
    read: {
      lastFingerprintAt: null,
      lastDetailAt: null,
      lastActivityAt: null,
      statusFingerprint: null,
      remarksFingerprint: null,
      detailInFlight: true,
      remarksIncomplete: true,
      consecutiveFailures: 0,
      lastErrorReason: null,
      ...readOverrides,
    },
  };
}

function makeEvent(seq, watch, overrides = {}) {
  return {
    id: `evt_${String(seq).padStart(6, "0")}`,
    seq,
    watchId: watch.id,
    type: "conflicting",
    createdAt: NOW,
    host: watch.host,
    repo: watch.repo,
    pr: watch.pr,
    headSha: null,
    url: watch.url,
    data: {},
    ...overrides,
  };
}

function stateWithWatch(initialState, watch = makeWatch(), group = makeGroup()) {
  const state = initialState(NOW);
  state.watches[watch.id] = watch;
  state.groups[group.key] = group;
  return state;
}

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "pr-watch-store-cases-"));
}

function errorMatches(reason, retryable) {
  return (error) => {
    if (error?.reason !== reason) return false;
    if (retryable !== undefined && error.retryable !== retryable) return false;
    return typeof error.message === "string" && error.message.length > 0;
  };
}

export function registerStoreCases({ test, assert, createWatchStore, initialState, validateState, eventId }) {
  test("store state writes are readable and use private file and directory modes", async () => {
    const dir = await makeTempDir();
    try {
      const statePath = path.join(dir, "watch-home", "state.json");
      const store = createWatchStore({ statePath });
      const state = initialState(NOW);
      await store.writeState(state);

      const fileStat = await fs.stat(statePath);
      const directoryStat = await fs.stat(path.dirname(statePath));
      assert.equal(fileStat.mode & 0o777, 0o600);
      assert.equal(directoryStat.mode & 0o777, 0o700);
      assert.deepEqual(await store.readState(), state);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("missing state is an empty version one state while corrupt state is invalid_config", async () => {
    const dir = await makeTempDir();
    try {
      const statePath = path.join(dir, "state.json");
      const store = createWatchStore({ statePath });
      const missing = await store.readState();
      assert.equal(missing.version, 1);
      assert.equal(missing.nextEventSeq, 1);
      assert.deepEqual(missing.watches, {});
      assert.deepEqual(missing.groups, {});
      assert.deepEqual(missing.events, []);
      validateState(missing);

      await fs.writeFile(statePath, "{ not json", "utf8");
      await assert.rejects(store.readState(), errorMatches("invalid_config", false));

      await fs.writeFile(statePath, JSON.stringify({ ...initialState(NOW), version: 2 }), "utf8");
      await assert.rejects(store.readState(), errorMatches("invalid_config", false));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("schema validation rejects wrong types and unknown fixed-shape keys", () => {
    const wrongType = initialState(NOW);
    wrongType.nextEventSeq = "1";
    assert.throws(() => validateState(wrongType), errorMatches("invalid_config", false));

    const unknownTopLevel = initialState(NOW);
    unknownTopLevel.futureField = true;
    assert.throws(() => validateState(unknownTopLevel), errorMatches("invalid_config", false));

    const unknownNested = stateWithWatch(initialState);
    unknownNested.watches.w_a0000.futureField = true;
    assert.throws(() => validateState(unknownNested), errorMatches("invalid_config", false));
  });

  test("eventId uses zero padding to at least six digits", () => {
    assert.equal(eventId(1), "evt_000001");
    assert.equal(eventId(123456), "evt_123456");
    assert.equal(eventId(1234567), "evt_1234567");
  });

  test("live state and run lock holders produce retryable conflicts", async () => {
    const dir = await makeTempDir();
    try {
      const statePath = path.join(dir, "state.json");
      const store = createWatchStore({
        statePath,
        lockWaitMs: 5,
        staleLockMs: 1_000,
        heartbeatMs: 5,
      });

      const stateResult = await store.withStateLock(async () => {
        await assert.rejects(
          store.withStateLock(async () => "unreachable"),
          errorMatches("conflict", true),
        );
        return "state-held";
      }, { command: "store case" });
      assert.equal(stateResult, "state-held");

      const runResult = await store.withRunLock(async () => {
        await assert.rejects(
          store.withRunLock(async () => "unreachable"),
          errorMatches("conflict", true),
        );
        return "run-held";
      }, { command: "store case" });
      assert.equal(runResult, "run-held");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("cancellation stops a waiting state-lock acquisition", async () => {
    const dir = await makeTempDir();
    try {
      const statePath = path.join(dir, "state.json");
      const store = createWatchStore({
        statePath,
        lockWaitMs: 500,
        staleLockMs: 1_000,
        heartbeatMs: 5,
      });
      let releaseHolder;
      let markAcquired;
      const acquired = new Promise((resolve) => { markAcquired = resolve; });
      const holding = store.withStateLock(async () => {
        markAcquired();
        return new Promise((resolve) => {
          releaseHolder = resolve;
        });
      }, { command: "holder" });
      await acquired;
      let canceled = false;
      const waiting = store.withStateLock(async () => "unreachable", {
        command: "canceled waiter",
        isCanceled: () => canceled,
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      canceled = true;
      await assert.rejects(waiting, errorMatches("canceled", false));
      releaseHolder("held");
      assert.equal(await holding, "held");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("a stale lock is reclaimed and the state commit succeeds", async () => {
    const dir = await makeTempDir();
    try {
      const statePath = path.join(dir, "state.json");
      const store = createWatchStore({
        statePath,
        lockWaitMs: 100,
        staleLockMs: 50,
        heartbeatMs: 5,
      });
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.mkdir(store.lockPath);
      await fs.writeFile(path.join(store.lockPath, "owner.json"), JSON.stringify({
        token: "stale-owner",
        pid: 99_999_999,
        command: "stale test owner",
        heartbeat: NOW,
      }), "utf8");

      const state = initialState(NOW);
      const result = await store.withStateLock(async (controls) => {
        assert.equal(typeof controls.commit, "function");
        await controls.commit(state);
        return "acquired";
      }, { command: "store case" });
      assert.equal(result, "acquired");
      assert.deepEqual(await store.readState(), state);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("a changed owner token fails the commit before the final rename", async () => {
    const dir = await makeTempDir();
    try {
      const statePath = path.join(dir, "state.json");
      const store = createWatchStore({
        statePath,
        lockWaitMs: 100,
        staleLockMs: 1_000,
        heartbeatMs: 5_000,
      });
      await assert.rejects(
        store.withStateLock(async () => {
          await fs.writeFile(path.join(store.lockPath, "owner.json"), JSON.stringify({
            token: "replacement-owner",
            pid: process.pid,
            command: "replacement test owner",
            heartbeat: new Date().toISOString(),
          }), "utf8");
          await store.writeState(initialState(NOW));
        }, { command: "store case" }),
        errorMatches("conflict", true),
      );
      await assert.rejects(fs.stat(statePath), (error) => error?.code === "ENOENT");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("writes retain the newest five hundred events without lowering nextEventSeq", async () => {
    const dir = await makeTempDir();
    try {
      const statePath = path.join(dir, "state.json");
      const store = createWatchStore({ statePath });
      const watch = makeWatch();
      const state = stateWithWatch(initialState, watch);
      state.nextEventSeq = 506;
      for (let seq = 1; seq <= 505; seq += 1) {
        state.events.push(makeEvent(seq, watch));
      }

      const written = await store.writeState(state);
      assert.equal(written.events.length, 500);
      assert.equal(written.nextEventSeq, 506);
      assert.equal(written.events[0].seq, 6);
      assert.equal(written.events.at(-1).seq, 505);
      for (let index = 1; index < written.events.length; index += 1) {
        assert.equal(written.events[index].seq > written.events[index - 1].seq, true);
      }
      const readBack = await store.readState();
      assert.equal(readBack.events.length, 500);
      assert.equal(readBack.nextEventSeq, 506);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("schema validation rejects duplicate active watches for one group key", () => {
    const first = makeWatch("w_a0000");
    const second = makeWatch("w_b0000");
    const state = stateWithWatch(initialState, first);
    state.watches[second.id] = second;
    assert.throws(() => validateState(state), errorMatches("invalid_config", false));

    const caseVariant = makeWatch("w_c0000", {
      key: "github.com:Owner/repo#123",
      repo: "Owner/repo",
    });
    const caseState = stateWithWatch(initialState, first);
    caseState.watches[caseVariant.id] = caseVariant;
    assert.throws(() => validateState(caseState), errorMatches("invalid_config", false));
  });

  test("schema validation rejects embedded id and key mismatches", () => {
    const watch = makeWatch("w_a0000");
    const wrongContainer = stateWithWatch(initialState, watch);
    delete wrongContainer.watches[watch.id];
    wrongContainer.watches.w_b0000 = watch;
    assert.throws(() => validateState(wrongContainer), errorMatches("invalid_config", false));

    const wrongKey = makeWatch("w_a0000", { key: "github.com:owner/other#123" });
    assert.throws(() => validateState(stateWithWatch(initialState, wrongKey)), errorMatches("invalid_config", false));

    const group = makeGroup({ key: "github.com:owner/other#123" });
    assert.throws(() => validateState(stateWithWatch(initialState, makeWatch(), group)), errorMatches("invalid_config", false));
  });

  test("schema validation rejects invalid event sequence ids and dangling watch references", () => {
    const watch = makeWatch();
    const valid = stateWithWatch(initialState, watch);
    valid.nextEventSeq = 2;
    valid.events.push(makeEvent(1, watch));
    validateState(valid);

    const wrongId = stateWithWatch(initialState, watch);
    wrongId.nextEventSeq = 2;
    wrongId.events.push(makeEvent(1, watch, { id: "evt_000002" }));
    assert.throws(() => validateState(wrongId), errorMatches("invalid_config", false));

    const dangling = stateWithWatch(initialState, watch);
    dangling.nextEventSeq = 2;
    dangling.events.push(makeEvent(1, watch, { watchId: "w_b0000" }));
    assert.throws(() => validateState(dangling), errorMatches("invalid_config", false));

    const outOfRange = stateWithWatch(initialState, watch);
    outOfRange.nextEventSeq = 1;
    outOfRange.events.push(makeEvent(1, watch));
    assert.throws(() => validateState(outOfRange), errorMatches("invalid_config", false));
  });

  test("schema validation requires ended-watch dedupe to match the last watch row", () => {
    const watch = makeWatch("w_a0000", {
      state: "ended",
      updatedAt: LATER,
      endedAt: LATER,
      endReason: "removed",
    });
    const state = stateWithWatch(initialState, watch);
    state.endedWatches[watch.key] = {
      endedAt: LATER,
      endReason: "removed",
      lastWatchId: watch.id,
      dedupe: structuredClone(watch.dedupe),
    };
    validateState(state);

    state.endedWatches[watch.key].dedupe = {
      ...structuredClone(watch.dedupe),
      passed: true,
    };
    assert.throws(() => validateState(state), errorMatches("invalid_config", false));
  });
}
