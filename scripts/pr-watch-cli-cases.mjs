// Reusable pr-watch CLI contract cases. The root harness supplies node:test,
// node:assert/strict, and the runCli implementation under test.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const NOW = "2026-11-27T01:00:00.000Z";
const RUNNER = "/opt/gh/scripts/run";

function dedupe(startedAt = NOW) {
  return {
    startedAt,
    headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    failedChecks: [],
    passed: false,
    passedChecks: [],
    owedChecks: [],
    awaitingApproval: [],
    approvalAnnounced: false,
    remarksThrough: startedAt,
    remarkIds: [],
    conflicting: false,
    rebaseRequired: false,
    mergeQueueRemovalId: null,
    checksAwaitedSince: null,
    checksPending: false,
    wakes: 0,
  };
}

function groupRead() {
  return {
    lastFingerprintAt: NOW,
    lastDetailAt: NOW,
    lastActivityAt: NOW,
    statusFingerprint: "status",
    remarksFingerprint: "remarks",
    detailInFlight: false,
    remarksIncomplete: false,
    consecutiveFailures: 0,
    lastErrorReason: null,
  };
}

function watch(id, overrides = {}) {
  const pr = overrides.pr ?? 123;
  const repo = overrides.repo ?? "owner/repo";
  const host = overrides.host ?? "github.com";
  const state = overrides.state ?? "active";
  const updatedAt = overrides.updatedAt ?? NOW;
  return {
    id,
    key: `${host}:${repo}#${pr}`,
    host,
    repo,
    pr,
    url: `https://${host}/${repo}/pull/${pr}`,
    state,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt,
    endedAt: state === "ended" ? updatedAt : null,
    endReason: state === "ended" ? (overrides.endReason ?? "removed") : null,
    dedupe: overrides.dedupe ?? dedupe(),
  };
}

function event(seq, watchId, type, createdAt, data = {}, overrides = {}) {
  return {
    id: `evt_${String(seq).padStart(6, "0")}`,
    seq,
    watchId,
    type,
    createdAt,
    host: "github.com",
    repo: "owner/repo",
    pr: 123,
    headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    url: "https://github.com/owner/repo/pull/123",
    data,
    ...overrides,
  };
}

function fixtureState() {
  const activeOld = watch("w_act01", {
    pr: 123,
    updatedAt: "2026-11-27T00:10:00.000Z",
  });
  const activeNew = watch("w_act02", {
    pr: 124,
    updatedAt: "2026-11-27T00:20:00.000Z",
  });
  const ended = watch("w_end01", {
    pr: 123,
    state: "ended",
    updatedAt: "2026-11-27T00:30:00.000Z",
  });
  const key123 = activeOld.key;
  return {
    version: 1,
    createdAt: "2026-11-27T00:00:00.000Z",
    updatedAt: "2026-11-27T00:30:00.000Z",
    nextEventSeq: 5,
    watches: {
      [activeOld.id]: activeOld,
      [activeNew.id]: activeNew,
      [ended.id]: ended,
    },
    groups: {
      [key123]: {
        key: key123,
        host: "github.com",
        repo: "owner/repo",
        pr: 123,
        read: groupRead(),
      },
      [activeNew.key]: {
        key: activeNew.key,
        host: "github.com",
        repo: "owner/repo",
        pr: 124,
        read: groupRead(),
      },
    },
    endedWatches: {
      [key123]: {
        endedAt: ended.endedAt,
        endReason: "removed",
        lastWatchId: ended.id,
        dedupe: structuredClone(ended.dedupe),
      },
    },
    hosts: {
      "github.com": {
        pausedUntil: null,
        pauseReason: null,
        rateLimits: {},
        consecutiveRateLimitFailures: 0,
        rateLimitGeneration: 0,
      },
    },
    events: [
      event(1, "w_act01", "remarks", "2026-11-27T00:00:00.000Z", { count: 1 }),
      event(2, "w_act01", "checks-failed", "2026-11-27T00:10:00.000Z", {
        checks: [{ name: "lint", url: null }],
      }),
      event(3, "w_act02", "remarks", "2026-11-27T00:20:00.000Z", { count: 2 }, { pr: 124, url: "https://github.com/owner/repo/pull/124" }),
      event(4, "w_end01", "conflicting", "2026-11-27T00:30:00.000Z", {}),
    ],
  };
}

function memoryStore(initial) {
  let state = structuredClone(initial);
  const store = {
    reads: 0,
    writes: 0,
    async readState() {
      store.reads += 1;
      return structuredClone(state);
    },
    async writeState(next) {
      store.writes += 1;
      state = structuredClone(next);
    },
    async withStateLock(fn) {
      return fn();
    },
    async withRunLock(fn) {
      return fn();
    },
    snapshot() {
      return structuredClone(state);
    },
    replace(next) {
      state = structuredClone(next);
    },
  };
  return store;
}

function makeHarness(t, { state = fixtureState(), operations, store = memoryStore(state), tty = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "pr-watch-cli-testtmp-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const stdout = [];
  const stderr = [];
  const deps = {
    stdout,
    stderr,
    env: { HOME: dir },
    cwd: dir,
    isTTY: { stdin: tty, stdout: tty, stderr: tty },
    store,
    operations,
    runnerPath: RUNNER,
    now: () => Date.parse(NOW),
    randomId: () => "w_new99",
  };
  return {
    deps,
    store,
    stdout: () => stdout.join(""),
    stderr: () => stderr.join(""),
    json: () => JSON.parse(stdout.join("")),
    errorJson: () => JSON.parse(stderr.join("")),
    lines: () => stdout.join("").trim().split("\n").filter(Boolean),
  };
}

async function invoke(runCli, harness, argv) {
  const stdoutBefore = harness.stdout().length;
  const stderrBefore = harness.stderr().length;
  const code = await runCli(argv, harness.deps);
  const stdout = harness.stdout().slice(stdoutBefore);
  const stderr = harness.stderr().slice(stderrBefore);
  return {
    code,
    stdout,
    stderr,
    json: () => JSON.parse(stdout),
    errorJson: () => JSON.parse(stderr),
    lines: () => stdout.trim().split("\n").filter(Boolean),
  };
}

function sweepSummary(overrides = {}) {
  return {
    succeeded: 1,
    failed: 0,
    skipped: 0,
    unknown: 0,
    startedAt: NOW,
    finishedAt: NOW,
    durationMs: 1,
    watchCount: 1,
    groupCount: 1,
    readGroupCount: 1,
    ...overrides,
  };
}

export function registerCliCases({ test, assert, runCli }) {
  test("cli help is offline, stream-pure, and includes the full implemented surface", async (t) => {
    const harness = makeHarness(t, { store: null, operations: undefined });

    let result = await invoke(runCli, harness, ["help", "--all", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    const paths = result.json().commands.map((command) => command.path);
    assert.deepEqual(paths, [
      "watches add",
      "watches list",
      "watches inspect",
      "watches remove",
      "watches run",
      "events list",
      "help",
      "help search",
    ]);

    result = await invoke(runCli, harness, ["--help"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /watches/);
    assert.match(result.stdout, /events/);

    result = await invoke(runCli, harness, ["watches", "run", "--help", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(Object.keys(result.json()), [
      "path",
      "summary",
      "subcommands",
      "arguments",
      "options",
      "lifecycle",
      "resultSchema",
    ]);
    assert.equal(result.json().path, "watches run");
    assert.deepEqual(
      result.json().resultSchema.map((item) => item.name),
      ["outcome", "summary", "events", "results", "warnings"],
    );
    for (const item of result.json().options) {
      assert.deepEqual(Object.keys(item), [
        "name",
        "short",
        "type",
        "valueHint",
        "default",
        "acceptedValues",
        "repeatable",
        "deprecated",
      ]);
    }

    result = await invoke(runCli, harness, ["help", "search", "sweep", "--json"]);
    assert.equal(result.code, 0);
    assert.deepEqual(result.json().commands[0].path, "watches run");

    result = await invoke(runCli, harness, ["watches", "add", "--help", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.json().path, "watches add");
  });

  test("cli rejects unknown commands and options as usage errors", async (t) => {
    let harness = makeHarness(t);
    let result = await invoke(runCli, harness, ["bogus", "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.stdout, "");
    assert.equal(result.errorJson().reason, "unknown_command");

    result = await invoke(runCli, harness, ["watches", "list", "--bogus", "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "unknown_option");
    assert.equal(result.errorJson().data.option, "--bogus");

    result = await invoke(runCli, harness, ["watches", "add", "--help", "--json", "--bogus"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "unknown_option");

    result = await invoke(runCli, harness, ["watches", "list", "-R", "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "unknown_option");
  });

  test("cli validates and projects top-level fields in canonical schema order", async (t) => {
    const harness = makeHarness(t);
    let result = await invoke(runCli, harness, [
      "watches", "list", "--json", "--fields", "pagination,watches,pagination",
    ]);
    assert.equal(result.code, 0);
    assert.deepEqual(Object.keys(result.json()), ["watches", "pagination"]);

    result = await invoke(runCli, harness, ["watches", "list", "--json", "--fields", "nope"]);
    assert.equal(result.code, 2);
    assert.equal(result.stdout, "");
    assert.equal(result.errorJson().reason, "invalid_arguments");
    assert.deepEqual(result.errorJson().data.fields, ["watches", "pagination", "warnings"]);

    result = await invoke(runCli, harness, ["watches", "list", "--fields", "watches"]);
    assert.equal(result.code, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /--fields requires --json/);

    result = await invoke(runCli, harness, ["watches", "list", "--json", "--fields", "watches,,pagination"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "invalid_arguments");
  });

  test("cli rejects invalid input before any state write", async (t) => {
    const harness = makeHarness(t, {
      operations: {
        async add() {
          return { watch: watch("w_new99"), outcome: "added", events: [], warnings: [] };
        },
      },
    });
    for (const argv of [
      ["watches", "add", "abc"],
      ["watches", "add", "1", "--repo", "bad/repo/name"],
      ["watches", "add", "--repo", "owner/repo"],
      ["watches", "remove", "not-a-watch"],
      ["watches", "inspect", "owner/repo#0"],
    ]) {
      const result = await invoke(runCli, harness, argv);
      assert.equal(result.code, 2, argv.join(" "));
    }
    assert.equal(harness.store.writes, 0);
  });

  test("cli network commands report internal_error when operations are absent", async (t) => {
    const harness = makeHarness(t, { operations: undefined });
    let result = await invoke(runCli, harness, ["watches", "add", "123", "--repo", "owner/repo", "--json"]);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.errorJson().reason, "internal_error");

    result = await invoke(runCli, harness, ["watches", "run", "--json"]);
    assert.equal(result.code, 1);
    assert.equal(result.errorJson().reason, "internal_error");
  });

  test("cli lists watches in contract order with filters, cursors, and clamping", async (t) => {
    const harness = makeHarness(t);
    let result = await invoke(runCli, harness, ["watches", "list", "--json"]);
    assert.equal(result.code, 0);
    assert.deepEqual(result.json().watches.map((item) => item.id), ["w_act02", "w_act01"]);
    assert.equal(result.stderr, "");

    result = await invoke(runCli, harness, ["watches", "list", "--state", "ended", "--json"]);
    assert.deepEqual(result.json().watches.map((item) => item.id), ["w_end01"]);

    result = await invoke(runCli, harness, ["watches", "list", "--limit", "1", "--json"]);
    assert.equal(result.json().watches.length, 1);
    assert.equal(result.json().watches[0].id, "w_act02");
    const cursor = result.json().pagination.next;
    assert.equal(typeof cursor, "string");

    result = await invoke(runCli, harness, ["watches", "list", "--next", cursor, "--json"]);
    assert.equal(result.code, 0);
    assert.deepEqual(result.json().watches.map((item) => item.id), ["w_act01"]);
    assert.equal(result.json().pagination.next, null);

    result = await invoke(runCli, harness, ["watches", "list", "--state", "ended", "--next", cursor, "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "invalid_arguments");

    result = await invoke(runCli, harness, ["watches", "list", "--limit", "999", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.json().warnings[0].reason, "limit_clamped");
    assert.equal(result.json().warnings[0].data.limit, 200);

    result = await invoke(runCli, harness, ["watches", "list", "--all", "--limit", "1", "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "invalid_arguments");

    result = await invoke(runCli, harness, ["watches", "list", "--state", "all", "--all", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.json().watches.length, 3);
    assert.equal(result.json().pagination.next, null);
  });

  test("cli lists events descending with since, watch, and cursor filtering", async (t) => {
    const harness = makeHarness(t);
    let result = await invoke(runCli, harness, ["events", "list", "--json"]);
    assert.equal(result.code, 0);
    assert.deepEqual(result.json().events.map((item) => item.seq), [4, 3, 2, 1]);

    result = await invoke(runCli, harness, ["events", "list", "--watch", "w_act01", "--json"]);
    assert.deepEqual(result.json().events.map((item) => item.seq), [2, 1]);

    result = await invoke(runCli, harness, ["events", "list", "--since", "2026-11-27T00:10:00.000Z", "--json"]);
    assert.deepEqual(result.json().events.map((item) => item.seq), [4, 3, 2]);

    result = await invoke(runCli, harness, ["events", "list", "--limit", "2", "--json"]);
    const cursor = result.json().pagination.next;
    assert.deepEqual(result.json().events.map((item) => item.seq), [4, 3]);
    result = await invoke(runCli, harness, ["events", "list", "--next", cursor, "--json"]);
    assert.deepEqual(result.json().events.map((item) => item.seq), [2, 1]);

    result = await invoke(runCli, harness, ["events", "list", "--since", "bad-time", "--json"]);
    assert.equal(result.code, 2);
  });

  test("cli resolves owner/repo#N selectors and reports ambiguity with candidate ids", async (t) => {
    const harness = makeHarness(t);
    let result = await invoke(runCli, harness, ["watches", "inspect", "OWNER/REPO#124", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.json().watch.id, "w_act02");

    result = await invoke(runCli, harness, ["watches", "inspect", "owner/repo#123", "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "ambiguous_watch");
    assert.deepEqual(result.errorJson().data.watches, ["w_act01", "w_end01"]);
  });

  test("cli inspects one watch with exact summary, dedupe, read, and quota projections", async (t) => {
    const harness = makeHarness(t);
    const result = await invoke(runCli, harness, ["watches", "inspect", "w_act01", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    const value = result.json().watch;
    assert.deepEqual(Object.keys(value), [
      "id", "key", "host", "repo", "pr", "state", "createdAt", "updatedAt", "endedAt", "endReason", "url", "dedupe", "read", "quota",
    ]);
    assert.equal(value.read.statusFingerprint, "status");
    assert.equal(value.quota.rateLimitGeneration, 0);
  });

  test("cli remove transitions active watches, no-ops ended watches, and misses cleanly", async (t) => {
    const harness = makeHarness(t);
    let result = await invoke(runCli, harness, ["watches", "remove", "w_act01", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.json().outcome, "removed");
    assert.deepEqual(result.json().next[0].argv, [
      RUNNER, "pr-watch.mjs", "watches", "list", "--json",
    ]);
    assert.equal(harness.store.writes, 1);
    const state = harness.store.snapshot();
    assert.equal(state.watches.w_act01.state, "ended");
    assert.equal(state.watches.w_act01.endReason, "removed");
    assert.equal(state.endedWatches["github.com:owner/repo#123"].lastWatchId, "w_act01");
    assert.deepEqual(state.endedWatches["github.com:owner/repo#123"].dedupe, state.watches.w_act01.dedupe);
    assert.equal(state.events.length, 4);

    result = await invoke(runCli, harness, ["watches", "remove", "w_act01", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.json().outcome, "unchanged");
    assert.equal(harness.store.writes, 1);

    result = await invoke(runCli, harness, ["watches", "remove", "w_zzzzz", "--json"]);
    assert.equal(result.code, 1);
    assert.equal(result.errorJson().reason, "not_found");
  });

  test("cli human remove stdout is the bare id while receipts stay on stderr", async (t) => {
    const harness = makeHarness(t);
    const result = await invoke(runCli, harness, ["watches", "remove", "w_act01"]);
    assert.equal(result.code, 0);
    assert.equal(result.stdout, "w_act01\n");
    assert.match(result.stderr, /removed watch w_act01/);
  });

  test("cli add delegates inputs and emits runner-based inspect and sweep next commands", async (t) => {
    const calls = [];
    const added = watch("w_new99", { pr: 123 });
    const harness = makeHarness(t, {
      operations: {
        async add(input) {
          calls.push(input);
          return { watch: added, outcome: "added", events: [], warnings: [{ reason: "baseline_incomplete", message: "baseline incomplete" }] };
        },
      },
    });
    const result = await invoke(runCli, harness, ["watches", "add", "123", "--repo", "owner/repo", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].pr, 123);
    assert.equal(calls[0].repo, "owner/repo");
    assert.equal(calls[0].host, "github.com");
    assert.equal(calls[0].cwd, harness.deps.cwd);
    assert.equal(calls[0].env, harness.deps.env);
    assert.equal(result.json().outcome, "added");
    assert.deepEqual(result.json().next.map((item) => item.argv), [
      [RUNNER, "pr-watch.mjs", "watches", "inspect", "w_new99", "--json"],
      [RUNNER, "pr-watch.mjs", "watches", "run", "--watch", "w_new99", "--json"],
    ]);
    assert.equal(result.json().warnings[0].reason, "baseline_incomplete");
  });

  test("cli human add stdout is the bare id while warnings and receipts stay on stderr", async (t) => {
    const harness = makeHarness(t, {
      operations: {
        async add() {
          return {
            watch: watch("w_new99"),
            outcome: "added",
            events: [],
            warnings: [{ reason: "baseline_incomplete", message: "baseline incomplete" }],
          };
        },
      },
    });
    const result = await invoke(runCli, harness, ["watches", "add", "123", "--repo", "owner/repo"]);
    assert.equal(result.code, 0);
    assert.equal(result.stdout, "w_new99\n");
    assert.match(result.stderr, /warning: baseline_incomplete/);
    assert.match(result.stderr, /added watch w_new99/);
  });

  test("cli bounded sweep keeps JSON stream purity and prints human events only on stdout", async (t) => {
    const produced = event(5, "w_act01", "remarks", NOW, { count: 2 });
    const operations = {
      async sweep() {
        return {
          outcome: "completed",
          summary: sweepSummary(),
          events: [produced],
          results: [{ id: "github.com:owner/repo#123", outcome: "read", detailRead: true, activityRead: true, eventCount: 1 }],
        };
      },
    };
    let harness = makeHarness(t, { operations });
    let result = await invoke(runCli, harness, ["watches", "run", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(Object.keys(result.json()), ["outcome", "summary", "events", "results"]);
    assert.equal(result.json().events.length, 1);

    harness = makeHarness(t, { operations });
    result = await invoke(runCli, harness, ["watches", "run"]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /remarks owner\/repo#123/);
    assert.equal(result.stderr, "");
  });

  test("cli partial sweeps exit 1 with a result document and no error document", async (t) => {
    const operations = {
      async sweep() {
        return {
          outcome: "partial",
          summary: sweepSummary({ succeeded: 1, failed: 1, groupCount: 2 }),
          events: [],
          results: [
            { id: "github.com:owner/repo#123", outcome: "read", detailRead: true, activityRead: true, eventCount: 0 },
            {
              id: "github.com:owner/repo#124",
              outcome: "failed",
              detailRead: true,
              activityRead: false,
              eventCount: 0,
              error: { reason: "network_error", message: "network failed", retryable: true },
            },
          ],
        };
      },
    };
    const harness = makeHarness(t, { operations });
    const result = await invoke(runCli, harness, ["watches", "run", "--json"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "");
    assert.equal(result.json().outcome, "partial");
    assert.equal(result.json().warnings[0].reason, "sweep_group_failed");
    assert.equal(result.json().warnings[0].data.id, "github.com:owner/repo#124");
  });

  test("cli human list output keeps rows on stdout and warnings on stderr", async (t) => {
    const harness = makeHarness(t);
    const result = await invoke(runCli, harness, ["watches", "list", "--limit", "999"]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /^WATCH\tREPO\tPR\tSTATE\tUPDATED\n/);
    assert.doesNotMatch(result.stdout, /limit_clamped/);
    assert.match(result.stderr, /warning: limit_clamped/);
  });

  test("cli bare groups and required-path help exit 0 offline", async (t) => {
    const harness = makeHarness(t, { store: null });
    let result = await invoke(runCli, harness, ["watches"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /watches add/);
    assert.match(result.stdout, /watches run/);

    result = await invoke(runCli, harness, ["watches", "inspect", "--help", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.json().path, "watches inspect");
  });

  test("cli boolean forms are last-wins and the option terminator is respected", async (t) => {
    const harness = makeHarness(t);
    let result = await invoke(runCli, harness, ["watches", "list", "--json", "--json=false"]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /^WATCH\t/);

    result = await invoke(runCli, harness, ["watches", "list", "--json", "--no-json"]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /^WATCH\t/);

    result = await invoke(runCli, harness, ["watches", "list", "--json=false", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(Array.isArray(result.json().watches), true);

    result = await invoke(runCli, harness, ["watches", "list", "--", "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /does not accept positional arguments/);
  });

  test("cli rejects malformed and conflicting event cursors", async (t) => {
    const harness = makeHarness(t);
    let result = await invoke(runCli, harness, ["events", "list", "--next", "not-a-cursor", "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "invalid_arguments");

    result = await invoke(runCli, harness, ["events", "list", "--limit", "1", "--json"]);
    const cursor = result.json().pagination.next;
    result = await invoke(runCli, harness, [
      "events", "list", "--next", cursor, "--since", "2026-11-27T00:00:00.000Z", "--json",
    ]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "invalid_arguments");
  });

  test("cli failed JSON --all reads carry rowsFetched and the starting cursor", async (t) => {
    const harness = makeHarness(t);
    harness.store.readState = async () => {
      const error = new Error("corrupt state");
      error.reason = "invalid_config";
      error.retryable = false;
      throw error;
    };
    const result = await invoke(runCli, harness, ["watches", "list", "--all", "--json"]);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.errorJson().reason, "invalid_config");
    assert.equal(result.errorJson().data.rowsFetched, 0);
    assert.equal(result.errorJson().data.next, null);
    assert.equal(result.errorJson().retryable, false);
  });

  test("cli run accepts only active watches and validates selectors before sweeping", async (t) => {
    let calls = 0;
    const harness = makeHarness(t, {
      operations: {
        async sweep() {
          calls += 1;
          return { outcome: "completed", summary: sweepSummary(), events: [], results: [] };
        },
      },
    });
    let result = await invoke(runCli, harness, ["watches", "run", "--watch", "w_end01", "--json"]);
    assert.equal(result.code, 1);
    assert.equal(result.errorJson().reason, "not_found");
    assert.equal(calls, 0);

    result = await invoke(runCli, harness, ["watches", "run", "--watch", "bad", "--json"]);
    assert.equal(result.code, 2);
    assert.equal(calls, 0);
  });

  test("cli add validates GH_HOST before invoking operations", async (t) => {
    let calls = 0;
    const harness = makeHarness(t, {
      operations: {
        async add() {
          calls += 1;
          return { watch: watch("w_new99"), outcome: "added", events: [], warnings: [] };
        },
      },
    });
    harness.deps.env.GH_HOST = "https://github.com";
    const result = await invoke(runCli, harness, ["watches", "add", "123", "--repo", "owner/repo", "--json"]);
    assert.equal(result.code, 1);
    assert.equal(result.errorJson().reason, "invalid_config");
    assert.equal(calls, 0);
  });

  test("cli orders watches by timestamp rather than ISO spelling", async (t) => {
    const harness = makeHarness(t);
    const state = harness.store.snapshot();
    state.watches.w_act01.updatedAt = "2026-11-27T00:20:00Z";
    state.watches.w_act02.updatedAt = "2026-11-27T00:20:00.001Z";
    harness.store.replace(state);
    const result = await invoke(runCli, harness, ["watches", "list", "--json"]);
    assert.equal(result.code, 0);
    assert.deepEqual(result.json().watches.map((watch) => watch.id), ["w_act02", "w_act01"]);
  });

  test("cli rejects positive-shaped but foreign cursor contents", async (t) => {
    const harness = makeHarness(t);
    const encode = (payload) => Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    let cursor = encode({
      v: 1,
      kind: "events",
      filters: { since: null, watchId: null },
      last: { seq: 0 },
    });
    let result = await invoke(runCli, harness, ["events", "list", "--next", cursor, "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "invalid_arguments");

    cursor = encode({
      v: 1,
      kind: "events",
      filters: { since: null, watchId: null },
      last: { seq: 4 },
      extra: "foreign",
    });
    result = await invoke(runCli, harness, ["events", "list", "--next", cursor, "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "invalid_arguments");

    result = await invoke(runCli, harness, ["events", "list", "--since", "2026-02-31T00:00:00Z", "--json"]);
    assert.equal(result.code, 2);
    assert.equal(result.errorJson().reason, "invalid_arguments");
  });

  test("cli strips controls from structured remote error messages", async (t) => {
    const harness = makeHarness(t);
    harness.store.readState = async () => {
      const error = new Error("The watch command failed.");
      error.reason = "api_error";
      error.retryable = true;
      error.data = { remoteMessage: "bad\n\u202evalue" };
      throw error;
    };
    const result = await invoke(runCli, harness, ["watches", "list", "--json"]);
    assert.equal(result.code, 1);
    assert.equal(result.errorJson().data.remoteMessage, "bad\\nvalue");
  });

  test("cli malformed operation outcomes are internal errors", async (t) => {
    const harness = makeHarness(t, {
      operations: {
        async add() {
          return { outcome: "added" };
        },
      },
    });
    const result = await invoke(runCli, harness, ["watches", "add", "123", "--repo", "owner/repo", "--json"]);
    assert.equal(result.code, 1);
    assert.equal(result.errorJson().reason, "internal_error");
  });

  test("cli bounded cancellation before a state write exits 130 as canceled", async (t) => {
    const harness = makeHarness(t);
    harness.deps._signalState = { signal: "SIGINT" };
    const result = await invoke(runCli, harness, ["watches", "list", "--json"]);
    assert.equal(result.code, 130);
    assert.equal(result.stdout, "");
    assert.equal(result.errorJson().reason, "canceled");
  });


  test("cli cancellation before a mutation write prevents that write", async (t) => {
    const harness = makeHarness(t);
    harness.deps._signalState = { signal: null };
    const readState = harness.store.readState;
    harness.store.readState = async () => {
      harness.deps._signalState.signal = "SIGINT";
      return readState();
    };
    const result = await invoke(runCli, harness, ["watches", "remove", "w_act01", "--json"]);
    assert.equal(result.code, 130);
    assert.equal(result.stdout, "");
    assert.equal(result.errorJson().reason, "canceled");
    assert.equal(harness.store.writes, 0);
    assert.equal(harness.store.snapshot().watches.w_act01.state, "active");
  });

  test("cli mutation reports a committed outcome when cancellation arrives during the write", async (t) => {
    const harness = makeHarness(t);
    harness.deps._signalState = { signal: null };
    const writeState = harness.store.writeState;
    harness.store.writeState = async (state) => {
      harness.deps._signalState.signal = "SIGINT";
      await writeState(state);
    };
    const result = await invoke(runCli, harness, ["watches", "remove", "w_act01", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.json().outcome, "removed");
    assert.equal(harness.store.snapshot().watches.w_act01.state, "ended");
  });

  test("cli cancellation converts a failed mutation write to canceled", async (t) => {
    const harness = makeHarness(t);
    harness.deps._signalState = { signal: null };
    harness.store.writeState = async () => {
      harness.deps._signalState.signal = "SIGINT";
      const error = new Error("disk failed");
      error.reason = "invalid_config";
      throw error;
    };
    const result = await invoke(runCli, harness, ["watches", "remove", "w_act01", "--json"]);
    assert.equal(result.code, 130);
    assert.equal(result.stdout, "");
    assert.equal(result.errorJson().reason, "canceled");
  });

  test("cli pretty-prints bounded JSON only on a stdout TTY", async (t) => {
    const harness = makeHarness(t, { tty: true });
    const result = await invoke(runCli, harness, ["watches", "list", "--json"]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /^\{\n  "watches": \[/);
    assert.equal(result.stderr, "");
  });


  test("cli closed stdout ends a read quietly with exit 0", async (t) => {
    const harness = makeHarness(t);
    harness.deps.stdout = {
      write() {
        const error = new Error("pipe closed");
        error.code = "EPIPE";
        throw error;
      },
    };
    const result = await invoke(runCli, harness, ["watches", "list"]);
    assert.equal(result.code, 0);
  });

}
