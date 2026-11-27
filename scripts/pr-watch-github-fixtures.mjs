// Offline oracle fixtures for the GitHub watch transport/read layer.
// Root test harnesses can import registerGitHubFixtureCases and supply node:test/assert.

import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  buildFingerprintBatch,
  classifyRateLimit,
  normalizeChecks,
  packFingerprint,
  parseFingerprintBatch,
  readActivity,
  readDetail,
  readFingerprints,
  toCheckStatus,
  updateHostQuota,
} from "../skills/engineering/gh/scripts/pr-watch-github.mjs";

const envelope = (data, extras = {}) => ({
  status: 200,
  headers: {},
  data,
  errors: [],
  ...extras,
});

const workflowRun = (workflowId, event, runNumber, workflowName = workflowId) => ({
  event,
  runNumber,
  workflow: { id: workflowId, name: workflowName },
});

const target = { host: "github.com", repo: "acme/web", pr: 7 };

function fingerprintPullRequest(overrides = {}) {
  return {
    state: "OPEN",
    mergeable: "MERGEABLE",
    headRefOid: "abc123",
    comments: {
      totalCount: 4,
      nodes: [{ lastEditedAt: "2026-11-27T02:00:00Z" }, { lastEditedAt: null }],
    },
    reviews: {
      totalCount: 2,
      nodes: [{ lastEditedAt: "2026-11-27T02:05:00Z" }],
    },
    reviewThreads: { totalCount: 3 },
    mergeQueueRemovals: { filteredCount: 1 },
    commits: {
      nodes: [{
        commit: {
          statusCheckRollup: {
            state: "PENDING",
            contexts: {
              checkRunCountsByState: [
                { state: "SUCCESS", count: 2 },
                { state: "FAILURE", count: 1 },
                { state: "PENDING", count: 0 },
              ],
              statusContextCountsByState: [
                { state: "EXPECTED", count: 1 },
                { state: "SUCCESS", count: 1 },
              ],
            },
          },
        },
      }],
    },
    ...overrides,
  };
}

function coreData({
  checks = [],
  hasNextPage = false,
  endCursor = null,
  headSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  behindBy = 0,
} = {}) {
  return {
    repository: {
      nameWithOwner: "acme/web",
      pullRequest: {
        number: 7,
        url: "https://github.com/acme/web/pull/7",
        state: "OPEN",
        mergedAt: null,
        mergeCommit: null,
        mergedBy: null,
        closedAt: null,
        headRefName: "feature",
        baseRefName: "main",
        headRefOid: headSha,
        isCrossRepository: false,
        mergeable: "MERGEABLE",
        headRepositoryOwner: { login: "acme" },
        author: { login: "octocat", avatarUrl: null, name: "Octo" },
        mergeQueueRemovals: { nodes: [] },
        baseRef: { compare: { behindBy } },
        commits: {
          nodes: [{
            commit: {
              statusCheckRollup: {
                contexts: {
                  nodes: checks,
                  pageInfo: { hasNextPage, endCursor },
                },
              },
            },
          }],
        },
      },
    },
  };
}

function headsData(exact = true) {
  const head = {
    number: exact === true ? 7 : 8,
    headRefOid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    isCrossRepository: false,
    headRepositoryOwner: { login: "acme" },
  };
  return {
    repository: {
      pullRequests: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: exact === "two" ? [head, { ...head, number: 7 }] : [head],
      },
    },
  };
}

function detailClient({
  core = coreData(),
  checkPages = [],
  heads = headsData(),
  approvalRuns = [],
  unfinishedRuns = [],
  restFailures = {},
} = {}) {
  const calls = { graphql: [], rest: [] };
  let checkPage = 0;
  return {
    calls,
    credentialFingerprint: "fixture-credential",
    async graphql(query, variables) {
      calls.graphql.push({ query, variables });
      if (query.includes("PullRequestWatchCore")) return envelope(core);
      if (query.includes("PullRequestWatchCheckContexts")) {
        const page = checkPages[checkPage++] ?? {
          repository: {
            pullRequest: {
              headRefOid: core.repository.pullRequest.headRefOid,
              commits: { nodes: [{ commit: { statusCheckRollup: { contexts: {
                nodes: [], pageInfo: { hasNextPage: false, endCursor: null },
              } } } }] },
            },
          },
        };
        return envelope(page);
      }
      if (query.includes("PullRequestWatchHeads")) return envelope(heads);
      if (query.includes("PullRequestWatchViewer")) return envelope({ viewer: { login: "viewer" } });
      throw new Error(`unexpected GraphQL query: ${query.slice(0, 100)}`);
    },
    async rest(path) {
      calls.rest.push(path);
      if (path === "user") return envelope({ login: "viewer" });
      if (restFailures[path] !== undefined) throw restFailures[path];
      if (path.includes("status=action_required")) {
        return envelope({ workflow_runs: approvalRuns });
      }
      if (path.includes("actions/runs")) {
        return envelope({ workflow_runs: unfinishedRuns });
      }
      throw new Error(`unexpected REST path: ${path}`);
    },
  };
}

function activityData({ comments = [], reviews = [], commentsCursor = null, reviewsCursor = null } = {}) {
  return {
    repository: {
      pullRequest: {
        author: { login: "octocat", avatarUrl: null, name: "Octo" },
        comments: {
          pageInfo: { hasNextPage: commentsCursor !== null, endCursor: commentsCursor },
          nodes: comments,
        },
        reviews: {
          pageInfo: { hasNextPage: reviewsCursor !== null, endCursor: reviewsCursor },
          nodes: reviews,
        },
      },
    },
  };
}

function threadNode({
  id = "thread-1",
  path = "src/a.ts",
  totalCount = 1,
  comments = null,
  nextCursor = null,
} = {}) {
  const rows = comments ?? [{
    id: `${id}-c1`,
    author: { login: "reviewer", avatarUrl: null, name: null },
    body: "line note",
    createdAt: "2026-11-27T01:02:00Z",
    lastEditedAt: null,
    url: "https://github.com/acme/web/pull/7#discussion_r1",
    isMinimized: false,
  }];
  return {
    id,
    isResolved: false,
    isOutdated: false,
    path,
    line: 3,
    diffSide: "RIGHT",
    comments: {
      totalCount,
      pageInfo: { hasNextPage: nextCursor !== null, endCursor: nextCursor },
      nodes: rows,
    },
  };
}

function threadsData(nodes, nextCursor = null) {
  return {
    repository: {
      pullRequest: {
        reviewThreads: {
          totalCount: nodes.length,
          pageInfo: { hasNextPage: nextCursor !== null, endCursor: nextCursor },
          nodes,
        },
      },
    },
  };
}

function tailData({
  belongs = true,
  comments = [],
  hidden = 0,
  nextCursor = null,
} = {}) {
  const minimized = Array.from({ length: hidden }, (_, index) => ({
    id: `hidden-${index}`,
    author: { login: "hidden" },
    body: "hidden",
    createdAt: "2026-11-27T01:03:00Z",
    lastEditedAt: null,
    url: null,
    isMinimized: true,
  }));
  return {
    repository: { pullRequest: { id: "pr-7" } },
    node: {
      __typename: "PullRequestReviewThread",
      pullRequest: { id: belongs ? "pr-7" : "other-pr" },
      comments: {
        pageInfo: { hasNextPage: nextCursor !== null, endCursor: nextCursor },
        nodes: [...comments, ...minimized],
      },
    },
  };
}

function activityClient({
  conversationPages = [activityData()],
  threadPages = [threadsData([])],
  tailPages = [],
} = {}) {
  const calls = { conversation: 0, threads: 0, tails: 0, queries: [] };
  return {
    calls,
    async graphql(query) {
      calls.queries.push(query);
      if (query.includes("PullRequestWatchActivity")) {
        const page = conversationPages[Math.min(calls.conversation, conversationPages.length - 1)];
        calls.conversation += 1;
        return envelope(typeof page === "function" ? page(calls.conversation - 1) : page);
      }
      if (query.includes("PullRequestWatchReviewThreadComments")) {
        const page = tailPages[Math.min(calls.tails, tailPages.length - 1)];
        calls.tails += 1;
        return envelope(typeof page === "function" ? page(calls.tails - 1) : page);
      }
      if (query.includes("PullRequestWatchReviewThreads")) {
        const page = threadPages[Math.min(calls.threads, threadPages.length - 1)];
        calls.threads += 1;
        return envelope(typeof page === "function" ? page(calls.threads - 1) : page);
      }
      throw new Error(`unexpected activity GraphQL query: ${query.slice(0, 100)}`);
    },
    async rest() {
      throw new Error("activity reads do not use REST");
    },
  };
}

export function registerGitHubFixtureCases({ test = nodeTest, assert = nodeAssert } = {}) {
  test("check status mapping follows the pinned T3 enum mapping", () => {
    const cases = [
      [{ status: "IN_PROGRESS", conclusion: null }, "pending"],
      [{ status: "QUEUED", conclusion: null }, "pending"],
      [{ status: "COMPLETED", conclusion: "SUCCESS" }, "success"],
      [{ status: "COMPLETED", conclusion: "ACTION_REQUIRED" }, "action-required"],
      [{ status: "COMPLETED", conclusion: "FAILURE" }, "failure"],
      [{ status: "COMPLETED", conclusion: "ERROR" }, "failure"],
      [{ status: "COMPLETED", conclusion: "TIMED_OUT" }, "failure"],
      [{ status: "COMPLETED", conclusion: "STARTUP_FAILURE" }, "failure"],
      [{ status: "COMPLETED", conclusion: "CANCELLED" }, "cancelled"],
      [{ status: "COMPLETED", conclusion: "SKIPPED" }, "skipped"],
      [{ state: "PENDING" }, "pending"],
      [{ state: "EXPECTED" }, "pending"],
      [{ state: "SUCCESS" }, "success"],
      [{ state: "unknown-value" }, "neutral"],
      [{}, "neutral"],
    ];
    for (const [raw, expected] of cases) assert.equal(toCheckStatus(raw), expected);
  });

  test("superseded cancelled checks are filtered by workflow lineage and required name", () => {
    const rows = [
      {
        name: "matrix-a",
        status: "COMPLETED",
        conclusion: "CANCELLED",
        completedAt: "2026-11-27T01:00:00Z",
        workflowRun: workflowRun("W1", "pull_request", 1, "CI"),
      },
      {
        name: "matrix-b",
        status: "COMPLETED",
        conclusion: "SUCCESS",
        completedAt: "2026-11-27T01:05:00Z",
        workflowRun: workflowRun("W1", "pull_request", 2, "CI"),
      },
      {
        name: "required-job",
        status: "COMPLETED",
        conclusion: "CANCELLED",
        completedAt: "2026-11-27T01:00:00Z",
        isRequired: true,
        workflowRun: workflowRun("W2", "pull_request", 1, "Required"),
      },
      {
        name: "different-job",
        status: "COMPLETED",
        conclusion: "SUCCESS",
        completedAt: "2026-11-27T01:05:00Z",
        workflowRun: workflowRun("W2", "pull_request", 2, "Required"),
      },
    ];
    const names = normalizeChecks(rows).map((check) => check.name);
    assert.deepEqual(names.sort(), ["different-job", "matrix-b", "required-job"].sort());
    const requiredDropped = normalizeChecks([
      rows[2],
      {
        name: "required-job",
        status: "COMPLETED",
        conclusion: "SUCCESS",
        completedAt: "2026-11-27T01:06:00Z",
        workflowRun: workflowRun("W2", "pull_request", 2, "Required"),
      },
    ]);
    assert.deepEqual(requiredDropped.map((check) => [check.name, check.status]), [["required-job", "success"]]);
  });

  test("reruns dedupe by workflow and check name using timestamp precision", () => {
    const rows = [
      {
        name: "test",
        status: "COMPLETED",
        conclusion: "FAILURE",
        completedAt: "2026-11-27T01:00:00.1001Z",
        workflowRun: workflowRun("W1", "pull_request", 1, "CI"),
      },
      {
        name: "test",
        status: "COMPLETED",
        conclusion: "SUCCESS",
        completedAt: "2026-11-27T01:00:00.1002Z",
        workflowRun: workflowRun("W1", "pull_request", 2, "CI"),
      },
    ];
    assert.deepEqual(normalizeChecks(rows).map((check) => check.status), ["success"]);
    const runningWins = normalizeChecks([
      rows[1],
      {
        name: "test",
        status: "IN_PROGRESS",
        startedAt: "2026-11-27T00:59:00Z",
        workflowRun: workflowRun("W1", "pull_request", 3, "CI"),
      },
    ]);
    assert.deepEqual(runningWins.map((check) => check.status), ["pending"]);
  });

  test("same-named surviving jobs gain workflow prefixes and failures sort first", () => {
    const rows = [
      {
        name: "build",
        status: "COMPLETED",
        conclusion: "SUCCESS",
        completedAt: "2026-11-27T01:00:00Z",
        workflowRun: workflowRun("W1", "pull_request", 1, "CI"),
      },
      {
        name: "build",
        status: "COMPLETED",
        conclusion: "FAILURE",
        completedAt: "2026-11-27T01:00:00Z",
        workflowRun: workflowRun("W2", "pull_request", 1, "Deploy"),
      },
    ];
    const checks = normalizeChecks(rows);
    assert.equal(checks[0].name, "Deploy / build");
    assert.equal(checks[0].status, "failure");
    assert.equal(checks[1].name, "CI / build");
  });

  test("fingerprint packing byte-matches T3 field order, sorting, edit maxima, and fallbacks", () => {
    assert.deepEqual(packFingerprint(fingerprintPullRequest()), {
      status: "OPEN MERGEABLE abc123 FAILURE:1,SUCCESS:2 EXPECTED:1,SUCCESS:1 1",
      remarks: "4 2026-11-27T02:00:00Z 2 2026-11-27T02:05:00Z 3",
    });
    const enterprise = fingerprintPullRequest({ mergeQueueRemovals: undefined });
    assert.equal(packFingerprint(enterprise).status.split(" ").at(-1), "0");
  });

  test("fingerprint batch parser isolates aliases, seeds pending state, and keeps missing slices null", () => {
    const slices = [
      { key: "github.com:acme/web#7", host: "github.com", repo: "acme/web", pr: 7 },
      { key: "github.com:acme/web#8", host: "github.com", repo: "acme/web", pr: 8 },
      { key: "github.com:acme/web#9", host: "github.com", repo: "acme/web", pr: 9 },
    ];
    const batch = buildFingerprintBatch(slices, {
      includeGitHubFields: { mergeQueue: true, rollupState: true },
    });
    assert.match(batch.query, /_0_repository: repository/);
    assert.match(batch.query, /_2_repository: repository/);
    assert.equal(batch.variables.owner0, "acme");
    const payload = envelope({
      _0_repository: { pullRequest: fingerprintPullRequest() },
      _1_repository: null,
      _2_repository: { pullRequest: fingerprintPullRequest({ state: "CLOSED", mergeable: "UNKNOWN" }) },
    }, {
      errors: [{ type: "NOT_FOUND", message: "missing", path: ["_1_repository"] }],
    });
    const parsed = parseFingerprintBatch(payload, slices);
    assert.equal(parsed[0].fingerprint.status, packFingerprint(fingerprintPullRequest()).status);
    assert.equal(parsed[0].checksPending, true);
    assert.equal(parsed[1].fingerprint, null);
    assert.equal(parsed[1].error, undefined);
    assert.equal(parsed[2].fingerprint.status.split(" ")[0], "CLOSED");

    const actionRequired = fingerprintPullRequest();
    actionRequired.commits.nodes[0].commit.statusCheckRollup.state = "ACTION_REQUIRED";
    const completed = fingerprintPullRequest();
    completed.commits.nodes[0].commit.statusCheckRollup.state = "SUCCESS";
    const seeded = parseFingerprintBatch(envelope({
      _0_repository: { pullRequest: actionRequired },
      _1_repository: { pullRequest: completed },
    }), slices);
    assert.equal(seeded[0].checksPending, true);
    assert.equal(seeded[1].checksPending, false);
  });

  test("fingerprint parser attributes partial errors to their slice and throws unattributed errors", () => {
    const slices = [
      { key: "a", host: "github.com", repo: "acme/web", pr: 7 },
      { key: "b", host: "github.com", repo: "acme/web", pr: 8 },
    ];
    const payload = envelope({
      _0_repository: { pullRequest: fingerprintPullRequest() },
      _1_repository: { pullRequest: fingerprintPullRequest() },
    }, {
      errors: [{ type: "FORBIDDEN", message: "denied", path: ["_1_repository", "pullRequest"] }],
    });
    const parsed = parseFingerprintBatch(payload, slices);
    assert.equal(parsed[0].error, undefined);
    assert.equal(parsed[1].fingerprint, null);
    assert.equal(parsed[1].error.reason, "permission_denied");
    assert.throws(
      () => parseFingerprintBatch(envelope({}, { errors: [{ type: "FORBIDDEN", message: "bad\n\u202evalue" }] }), slices),
      (error) => {
        assert.equal(error.reason, "permission_denied");
        assert.equal(error.data.graphqlErrors[0].message, undefined);
        assert.equal(error.data.remoteMessage, "bad\\nvalue");
        return true;
      },
    );
  });

  test("fingerprint reads chunk at 25 aliases per request", async () => {
    const batchSizes = [];
    const client = {
      async graphql(query, variables) {
        const size = Object.keys(variables).length / 3;
        batchSizes.push(size);
        const data = {};
        for (let index = 0; index < size; index++) {
          data[`_${index}_repository`] = { pullRequest: fingerprintPullRequest() };
        }
        return envelope(data);
      },
      async rest() {
        throw new Error("fingerprints do not use REST");
      },
    };
    const slices = Array.from({ length: 26 }, (_, index) => ({
      key: `github.com:acme/web#${index + 1}`,
      host: "github.com",
      repo: "acme/web",
      pr: index + 1,
    }));
    const rows = await readFingerprints(client, slices);
    assert.deepEqual(batchSizes, [25, 1]);
    assert.equal(rows.length, 26);
    assert.equal(rows.every((row) => row.fingerprint !== null), true);
  });

  test("fingerprint reads keep at most eight requests in flight per host", async () => {
    let active = 0;
    let maximum = 0;
    const batchSizes = [];
    const client = {
      async graphql(query, variables) {
        const size = Object.keys(variables).length / 3;
        batchSizes.push(size);
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        const data = {};
        for (let index = 0; index < size; index++) {
          data[`_${index}_repository`] = { pullRequest: fingerprintPullRequest() };
        }
        return envelope(data);
      },
      async rest() {
        throw new Error("fingerprints do not use REST");
      },
    };
    const slices = Array.from({ length: 201 }, (_, index) => ({
      key: `github.com:acme/web#${index + 1}`,
      host: "github.com",
      repo: "acme/web",
      pr: index + 1,
    }));
    const rows = await readFingerprints(client, slices);
    assert.equal(rows.length, 201);
    assert.equal(batchSizes.length, 9);
    assert.equal(maximum <= 8, true);
  });

  test("fingerprint reads isolate one host's failure from other hosts", async () => {
    const rateLimited = new Error("paused");
    rateLimited.reason = "rate_limited";
    const client = {
      async graphql(query, variables, meta = {}) {
        if (meta.host === "bad.example.com") throw rateLimited;
        return envelope({ _0_repository: { pullRequest: fingerprintPullRequest() } });
      },
      async rest() {
        throw new Error("fingerprints do not use REST");
      },
    };
    const rows = await readFingerprints(client, [
      { key: "github.com:acme/web#1", host: "github.com", repo: "acme/web", pr: 1 },
      { key: "bad.example.com:acme/web#2", host: "bad.example.com", repo: "acme/web", pr: 2 },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].fingerprint !== null, true);
    assert.equal(rows[1].fingerprint, null);
    assert.equal(rows[1].error, rateLimited);
  });

  test("check pagination fails closed when the head changes mid-read", async () => {
    const head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const client = detailClient({
      core: coreData({ hasNextPage: true, endCursor: "cursor-1", headSha: head }),
      checkPages: [{
        repository: {
          pullRequest: {
            headRefOid: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            commits: { nodes: [{ commit: { statusCheckRollup: { contexts: {
              nodes: [], pageInfo: { hasNextPage: false, endCursor: null },
            } } } }] },
          },
        },
      }],
    });
    await assert.rejects(() => readDetail(client, target), (error) => {
      assert.equal(error.reason, "api_error");
      assert.match(error.message, /head changed/i);
      return true;
    });
  });

  test("approval rows are unique when a rollup check already represents the workflow run", async () => {
    const represented = {
      name: "deploy",
      status: "COMPLETED",
      conclusion: "ACTION_REQUIRED",
      detailsUrl: "https://github.com/acme/web/actions/runs/42/job/9",
      completedAt: "2026-11-27T01:00:00Z",
    };
    const client = detailClient({
      core: coreData({ checks: [represented] }),
      approvalRuns: [
        { id: 42, name: "deploy", html_url: "https://github.com/acme/web/actions/runs/42", pull_requests: [{ number: 7 }] },
        { id: 43, name: "release", html_url: "https://github.com/acme/web/actions/runs/43", pull_requests: [{ number: 7 }] },
      ],
    });
    const detail = await readDetail(client, target);
    const approvalRows = detail.checks.filter((check) => check.status === "action-required");
    assert.deepEqual(approvalRows.map((check) => check.name), ["deploy", "release"]);
    assert.equal(detail.workflowApprovalsRequired, 2);
    assert.equal(detail.checks.some((check) => check.placeholder === true), false);
  });

  test("non-unique approval heads produce the exact placeholder row rather than guessing", async () => {
    const client = detailClient({ heads: headsData("two") });
    const detail = await readDetail(client, target);
    const placeholder = detail.checks.find((check) => check.placeholder === true);
    assert.deepEqual(placeholder, {
      name: "Workflow approval status",
      status: "action-required",
      description: "GitHub could not determine whether workflows are awaiting approval.",
      url: null,
      placeholder: true,
    });
    assert.equal(detail.checksTrusted, false);
    assert.equal(detail.complete, false);
  });

  test("unfinished workflow synthesis adds pending rows and skips represented runs", async () => {
    const represented = {
      name: "lint",
      status: "IN_PROGRESS",
      detailsUrl: "https://github.com/acme/web/actions/runs/51/job/2",
      startedAt: "2026-11-27T01:00:00Z",
    };
    const client = detailClient({
      core: coreData({ checks: [represented] }),
      unfinishedRuns: [
        { id: 50, name: "queued workflow", html_url: "https://github.com/acme/web/actions/runs/50", status: "queued" },
        { id: 51, name: "lint", html_url: "https://github.com/acme/web/actions/runs/51", status: "in_progress" },
        { id: 52, name: "done", html_url: "https://github.com/acme/web/actions/runs/52", status: "completed" },
      ],
    });
    const detail = await readDetail(client, target);
    const synthetic = detail.checks.filter((check) => check.description === "This workflow run has not finished.");
    assert.deepEqual(synthetic, [{
      name: "queued workflow",
      status: "pending",
      description: "This workflow run has not finished.",
      url: "https://github.com/acme/web/actions/runs/50",
    }]);
    assert.deepEqual(
      detail.checks.slice(1).map((check) => check.name),
      ["queued workflow"],
    );
  });

  test("activity normalization drops minimized rows, keeps bodiless verdicts, and uses submittedAt", async () => {
    const client = activityClient({
      conversationPages: [activityData({
        comments: [
          {
            id: "issue-hidden",
            body: "hidden",
            createdAt: "2026-11-27T01:00:00Z",
            lastEditedAt: null,
            url: null,
            isMinimized: true,
            author: { login: "spammer" },
          },
          {
            id: "issue-visible",
            body: "please look",
            createdAt: "2026-11-27T01:01:00Z",
            lastEditedAt: "2026-11-27T01:04:00Z",
            url: "https://github.com/acme/web/pull/7#issuecomment-1",
            isMinimized: false,
            author: { login: "reviewer" },
          },
        ],
        reviews: [
          {
            id: "review-bodiless-comment",
            body: "",
            state: "COMMENTED",
            submittedAt: "2026-11-27T01:02:00Z",
            lastEditedAt: null,
            url: null,
            isMinimized: false,
            author: { login: "reviewer" },
          },
          {
            id: "review-verdict",
            body: "",
            state: "APPROVED",
            submittedAt: "2026-11-27T01:03:00Z",
            lastEditedAt: null,
            url: null,
            isMinimized: false,
            author: { login: "reviewer" },
          },
          {
            id: "review-hidden",
            body: "hidden",
            state: "COMMENTED",
            submittedAt: "2026-11-27T01:04:00Z",
            lastEditedAt: null,
            url: null,
            isMinimized: true,
            author: { login: "reviewer" },
          },
        ],
      })],
      threadPages: [threadsData([threadNode()])],
    });
    const activity = await readActivity(client, target);
    assert.equal(activity.complete, true);
    assert.deepEqual(activity.remarks.map((remark) => [remark.id, remark.kind, remark.createdAt]), [
      ["issue-visible", "issue-comment", "2026-11-27T01:01:00Z"],
      ["thread-1-c1", "review-comment", "2026-11-27T01:02:00Z"],
      ["review-verdict", "review", "2026-11-27T01:03:00Z"],
    ]);
    assert.equal(activity.remarks[0].editedAt, "2026-11-27T01:04:00Z");
    assert.equal(activity.remarks[1].path, "src/a.ts");
    assert.equal(activity.remarks[2].reviewState, "APPROVED");
  });

  test("proven review-thread tails complete the activity read", async () => {
    const initial = Array.from({ length: 10 }, (_, index) => ({
      id: `initial-${index}`,
      author: { login: "reviewer" },
      body: `note ${index}`,
      createdAt: `2026-11-27T01:${String(index).padStart(2, "0")}:00Z`,
      lastEditedAt: null,
      url: null,
      isMinimized: false,
    }));
    const tailComment = {
      id: "tail-1",
      author: { login: "reviewer" },
      body: "tail",
      createdAt: "2026-11-27T01:11:00Z",
      lastEditedAt: null,
      url: null,
      isMinimized: false,
    };
    const client = activityClient({
      threadPages: [threadsData([threadNode({
        totalCount: 12,
        comments: initial,
        nextCursor: "tail-cursor",
      })])],
      tailPages: [tailData({ comments: [tailComment], hidden: 1 })],
    });
    const activity = await readActivity(client, target);
    assert.equal(activity.complete, true);
    assert.equal(activity.remarks.filter((remark) => remark.kind === "review-comment").length, 11);
    assert.equal(activity.completeness.unprovenTail, false);
    const tailQuery = client.calls.queries.find((query) => query.includes("PullRequestWatchReviewThreadComments"));
    assert.match(tailQuery, /node\(id: \$threadId\) \{\n    __typename/);
  });

  test("repeated activity cursors mark the read incomplete and withhold remarks", async () => {
    const page = (index) => activityData({
      comments: [{
        id: `c-${index}`,
        body: "comment",
        createdAt: "2026-11-27T01:00:00Z",
        lastEditedAt: null,
        url: null,
        isMinimized: false,
        author: { login: "reviewer" },
      }],
      commentsCursor: "same-cursor",
    });
    const client = activityClient({ conversationPages: [page] });
    const activity = await readActivity(client, target);
    assert.equal(activity.complete, false);
    assert.equal(activity.remarks, null);
    assert.equal(activity.completeness.repeatedCursor, true);
  });

  test("a tail belonging to another pull request is marked wrong and incomplete", async () => {
    const initial = Array.from({ length: 10 }, (_, index) => ({
      id: `initial-${index}`,
      author: { login: "reviewer" },
      body: "note",
      createdAt: "2026-11-27T01:00:00Z",
      lastEditedAt: null,
      url: null,
      isMinimized: false,
    }));
    const client = activityClient({
      threadPages: [threadsData([threadNode({ totalCount: 11, comments: initial, nextCursor: "tail-cursor" })])],
      tailPages: [tailData({ belongs: false, comments: [{
        id: "tail-1",
        author: { login: "reviewer" },
        body: "tail",
        createdAt: "2026-11-27T01:11:00Z",
        lastEditedAt: null,
        url: null,
        isMinimized: false,
      }] })],
    });
    const activity = await readActivity(client, target);
    assert.equal(activity.complete, false);
    assert.equal(activity.completeness.wrongPullRequestTail, true);
    assert.equal(activity.remarks, null);
  });

  test("an unproven tail count never advances the remarks watermark", async () => {
    const initial = Array.from({ length: 10 }, (_, index) => ({
      id: `initial-${index}`,
      author: { login: "reviewer" },
      body: "note",
      createdAt: "2026-11-27T01:00:00Z",
      lastEditedAt: null,
      url: null,
      isMinimized: false,
    }));
    const client = activityClient({
      threadPages: [threadsData([threadNode({ totalCount: 12, comments: initial, nextCursor: "tail-cursor" })])],
      tailPages: [tailData({ comments: [{
        id: "tail-1",
        author: { login: "reviewer" },
        body: "tail",
        createdAt: "2026-11-27T01:11:00Z",
        lastEditedAt: null,
        url: null,
        isMinimized: false,
      }], hidden: 0 })],
    });
    const activity = await readActivity(client, target);
    assert.equal(activity.complete, false);
    assert.equal(activity.completeness.unprovenTail, true);
    assert.equal(activity.remarks, null);
  });

  test("a missing review-thread comment count makes the tail unproven", async () => {
    const initial = Array.from({ length: 10 }, (_, index) => ({
      id: `initial-${index}`,
      author: { login: "reviewer" },
      body: "note",
      createdAt: "2026-11-27T01:00:00Z",
      lastEditedAt: null,
      url: null,
      isMinimized: false,
    }));
    const node = threadNode({ comments: initial, nextCursor: "tail-cursor" });
    delete node.comments.totalCount;
    const client = activityClient({
      threadPages: [threadsData([node])],
      tailPages: [tailData({ comments: [{
        id: "tail-1",
        author: { login: "reviewer" },
        body: "tail",
        createdAt: "2026-11-27T01:11:00Z",
        lastEditedAt: null,
        url: null,
        isMinimized: false,
      }], hidden: 0 })],
    });
    const activity = await readActivity(client, target);
    assert.equal(activity.complete, false);
    assert.equal(activity.completeness.unprovenTail, true);
    assert.equal(activity.remarks, null);
  });

  test("detail composition derives rebase state, viewer identity, terminal fields, and capabilities", async () => {
    const core = coreData({ behindBy: 2 });
    core.repository.pullRequest.mergeable = "CONFLICTING";
    const client = detailClient({ core });
    const detail = await readDetail(client, target);
    const coreCall = client.calls.graphql.find(({ query }) => query.includes("PullRequestWatchCore"));
    assert.equal(coreCall.query.includes("__typename"), true);
    assert.equal(coreCall.query.includes("isRequired"), true);
    assert.equal(detail.repository, "acme/web");
    assert.equal(detail.state, "open");
    assert.equal(detail.mergeability, "conflicting");
    assert.equal(detail.rebaseRequired, true);
    assert.equal(detail.behindBy, 2);
    assert.equal(detail.viewer, "viewer");
    assert.equal(detail.capabilities.checksAlwaysReport, true);
    assert.equal(detail.checksAlwaysReport, true);
    assert.equal(detail.mergeCommitSha, null);
    assert.equal(detail.mergedBy, null);
  });

  test("the exact missing pull-ref NOT_FOUND error tolerates an absent comparison", async () => {
    const core = coreData();
    core.repository.pullRequest.baseRef = { compare: null };
    const base = detailClient({ core });
    const client = {
      ...base,
      async graphql(query, variables) {
        if (query.includes("PullRequestWatchCore")) {
          return envelope(core, {
            errors: [{
              type: "NOT_FOUND",
              message: "Could not resolve to a Ref",
              path: ["repository", "pullRequest", "baseRef", "compare"],
            }],
          });
        }
        return base.graphql(query, variables);
      },
    };
    const detail = await readDetail(client, target);
    assert.equal(detail.rebaseRequired, undefined);
    assert.equal(detail.comparison, null);
  });

  test("Enterprise detail reads omit required bits and merge queue fields", async () => {
    const client = detailClient();
    await readDetail(client, { host: "git.enterprise.test", repo: "acme/web", pr: 7 });
    const coreCall = client.calls.graphql.find(({ query }) => query.includes("PullRequestWatchCore"));
    assert.equal(coreCall.query.includes("isRequired"), false);
    assert.equal(coreCall.query.includes("mergeQueueRemovals"), false);
  });

  test("an unfinished review-thread listing trips the exact completeness gate", async () => {
    const client = activityClient({
      threadPages: [threadsData([threadNode()], "more-threads")],
    });
    const activity = await readActivity(client, target);
    assert.equal(activity.reviewThreadsTruncated, true);
    assert.equal(activity.complete, false);
    assert.equal(activity.remarks, null);
  });

  test("quota observations are validated, stored per resource, and stale windows rejected", () => {
    const now = Date.parse("2026-11-27T12:00:00Z");
    let state = {};
    state = updateHostQuota(state, {
      headers: {
        "x-ratelimit-resource": "graphql",
        "x-ratelimit-limit": "5000",
        "x-ratelimit-remaining": "4999",
        "x-ratelimit-used": "1",
        "x-ratelimit-reset": "1795816800",
      },
    }, now);
    assert.deepEqual(state.rateLimits.graphql, {
      limit: 5000,
      remaining: 4999,
      used: 1,
      resetAt: "2026-11-27T22:00:00.000Z",
    });
    const stale = updateHostQuota(state, {
      headers: {
        "x-ratelimit-resource": "graphql",
        "x-ratelimit-limit": "5000",
        "x-ratelimit-remaining": "1",
        "x-ratelimit-reset": "1795813200",
      },
    }, now);
    assert.equal(stale.rateLimits.graphql.remaining, 4999);
    const invalid = updateHostQuota(state, {
      headers: {
        "x-ratelimit-resource": "core",
        "x-ratelimit-limit": "0",
        "x-ratelimit-remaining": "1",
        "x-ratelimit-reset": "1795816800",
      },
    }, now);
    assert.equal(invalid.rateLimits.core, undefined);
    const missingUsed = updateHostQuota(state, {
      headers: {
        "x-ratelimit-resource": "core",
        "x-ratelimit-limit": "5000",
        "x-ratelimit-remaining": "4900",
        "x-ratelimit-reset": "1795816800",
      },
    }, now);
    assert.equal(missingUsed.rateLimits.core.used, null);
  });

  test("rate-limit classification matches T3 primary and secondary rules", () => {
    assert.equal(classifyRateLimit({ status: 429, headers: {} }), true);
    assert.equal(classifyRateLimit({
      status: 200,
      headers: { "x-ratelimit-remaining": "0" },
    }), false);
    assert.equal(classifyRateLimit({
      status: 200,
      headers: { "x-ratelimit-remaining": "0" },
      errors: [],
    }), true);
    assert.equal(classifyRateLimit({
      status: 200,
      headers: {},
      errors: [{ type: "RATE_LIMITED", message: "limited" }],
    }), true);
    assert.equal(classifyRateLimit({
      status: 200,
      headers: {},
      errors: [{ message: "API rate limit already exceeded for user ID 1." }],
    }), true);
    assert.equal(classifyRateLimit({
      status: 403,
      headers: { "x-ratelimit-remaining": "0" },
    }), true);
    assert.equal(classifyRateLimit({
      status: 403,
      headers: {},
      body: "You have triggered an abuse detection mechanism.",
    }), true);
    assert.equal(classifyRateLimit({
      status: 403,
      headers: { "retry-after": "60" },
    }), false);
    assert.equal(classifyRateLimit({
      status: 403,
      headers: {},
      body: "Resource not accessible by integration",
    }), false);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  registerGitHubFixtureCases();
}
