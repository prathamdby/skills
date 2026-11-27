// Evaluator oracle cases ported from t3code commit
// a066eb0935da44bbb16571638138c218bfdbf775 (MIT licensed).
// Source: apps/server/src/orchestration-v2/pullRequestWatch.test.ts.
//
// Excluded oracle cases, all because wake-message rendering, thread delivery, or
// duration-until behavior is outside this evaluator port:
// - "cuts a long remark in the wake message without splitting an emoji": wake-message rendering.
// - every "quotes a remark's text without its HTML tags" row: wake-message rendering.
// - the pullRequestWatchEndMessage describe block: terminal wake-message rendering.
// - the embedded pullRequestWatchMessage assertions inside "wakes once when the other checks
//   finish after one failed" and "reports each merge queue removal once": rendering assertions
//   only; every evaluator-state and event expectation from those cases is still ported here.
// The oracle contains no duration-until evaluator case to port.

import { PULL_REQUEST_WATCH_WAKE_LIMIT } from "../skills/engineering/gh/scripts/pr-watch-evaluator.mjs";

export function registerEvaluatorCases({ test, assert, evaluateWatch, makeInitialDedupe }) {
  const STARTED = "2026-10-02T12:00:00.000Z";

  const evaluateAt = (watch, detail, remarks, now) =>
    evaluateWatch({ watch, detail, remarks, now });
  const evaluate0 = (watch, detail, remarks) => evaluateAt(watch, detail, remarks, 0);

  const watch = (overrides = {}) => ({
    startedAt: STARTED,
    headSha: null,
    failedChecks: [],
    passed: false,
    passedChecks: [],
    remarksThrough: STARTED,
    remarkIds: [],
    conflicting: false,
    wakes: 0,
    ...overrides,
  });

  const run = (id) => `https://github.com/o/r/actions/runs/${id}`;

  const check = (name, status) => ({
    name,
    status,
    description: null,
    url: `https://ci.example/${name}`,
  });

  const capabilities = (checksAlwaysReport) => ({ checksAlwaysReport });

  const detail = (overrides = {}) => ({
    capabilities: capabilities(true),
    headSha: "aaaaaaaaaa",
    checks: [check("lint", "success"), check("test", "pending")],
    mergeability: "mergeable",
    viewer: "agent-user",
    author: { login: "agent-user" },
    ...overrides,
  });

  const remark = (login, createdAt, body = "Please rename this.") => ({
    id: `${login}-${createdAt}`,
    kind: "review-comment",
    author: { login },
    body,
    createdAt,
    url: `https://github.com/o/r/pull/1#${login}`,
    path: "src/index.ts",
    reviewState: null,
  });

  const noRemarks = [];

  const codeRabbitReply = (status, action = "Action performed") =>
    `<!-- coderabbit-ai-generated:v1 -->

<!-- This is an auto-generated reply by CodeRabbit -->
<!-- CodeRabbit review command invocation: test -->
<details>
<summary>${action}</summary>
<dl>
<dd>
<br>

${status}

> Note: CodeRabbit is an incremental review system and does not re-review already reviewed commits.

</dd>
</dl>
</details>`;

  const refs = (checks) => checks.map((item) => ({ name: item.name, url: item.url ?? null }));
  const failedEvent = (checks) => ({
    type: "checks-failed",
    data: { checks: refs(checks) },
  });
  const passedEvent = (count, required) => ({
    type: "checks-passed",
    data: { count, required },
  });
  const finishedEvent = (passed, failing) => ({
    type: "checks-finished",
    data: { passed, failing: refs(failing) },
  });
  const approvalEvent = (checks) => ({
    type: "checks-awaiting-approval",
    data: { checks: refs(checks) },
  });
  const remarksEvent = (count) => ({ type: "remarks", data: { count } });
  const types = (events) => events.map((event) => event.type);

  for (const status of ["pending", "success"]) {
    test(`reports a required rebase once with ${status} CI`, () => {
      const blocked = detail({
        mergeability: "unknown",
        rebaseRequired: true,
        checks: [check("test", status)],
      });
      const first = evaluate0(watch(), blocked, noRemarks);
      assert.ok(types(first.events).includes("needs-rebase"));
      assert.deepEqual(evaluate0(first.next, blocked, noRemarks).events, []);
      const unknown = evaluate0(first.next, { ...blocked, rebaseRequired: undefined }, noRemarks);
      assert.deepEqual(evaluate0(unknown.next, blocked, noRemarks).events, []);
      const clean = evaluate0(first.next, { ...blocked, rebaseRequired: false }, noRemarks);
      assert.deepEqual(evaluate0(clean.next, blocked, noRemarks).events, [
        { type: "needs-rebase", data: {} },
      ]);
      assert.ok(
        types(evaluate0(first.next, { ...blocked, headSha: "bbbbbbbbbb" }, noRemarks).events)
          .includes("needs-rebase"),
      );
    });
  }

  for (const required of [false, true]) {
    test(`baselines already-passed checks (required: ${required})`, () => {
      const green = detail({ checks: [{ ...check("test", "success"), required }] });
      const baseline = evaluate0(watch({ awaitingBaseline: "all" }), green, noRemarks);
      assert.deepEqual(baseline.events, []);
      assert.equal(baseline.next.headSha, green.headSha);
      assert.equal(baseline.next.passed, true);
      assert.deepEqual(baseline.next.passedChecks, ["test"]);
      assert.equal(baseline.exhausted, false);
      assert.deepEqual(evaluate0(baseline.next, green, noRemarks).events, []);

      const pending = evaluate0(
        baseline.next,
        detail({ checks: [{ ...check("test", "pending"), required }] }),
        noRemarks,
      );
      assert.deepEqual(pending.events, []);
      const failed = evaluate0(
        pending.next,
        detail({ checks: [{ ...check("test", "failure"), required }] }),
        noRemarks,
      );
      assert.equal(failed.events[0]?.type, "checks-failed");
      const passed = evaluate0(failed.next, green, noRemarks);
      assert.deepEqual(passed.events, [passedEvent(1, required)]);
      assert.deepEqual(
        evaluate0(passed.next, { ...green, headSha: "bbbbbbbbbb" }, noRemarks).events,
        [passedEvent(1, required)],
      );
    });

    test(`reports CI that passes during registration once (required: ${required})`, () => {
      const green = detail({ checks: [{ ...check("test", "success"), required }] });
      for (const awaitingBaseline of ["all", "checks"]) {
        const first = evaluate0(
          watch({ awaitingBaseline, checksPending: true }),
          green,
          noRemarks,
        );
        assert.deepEqual(first.events, [passedEvent(1, required)]);
        assert.equal(first.next.checksPending, false);
        assert.deepEqual(evaluate0(first.next, green, noRemarks).events, []);
      }
    });
  }

  test("does not announce an unchanged required gate while optional CI still runs", () => {
    const pending = detail({
      checks: [{ ...check("test", "success"), required: true }, check("advisory", "pending")],
    });
    const first = evaluate0(
      watch({ awaitingBaseline: "all", checksPending: true }),
      pending,
      noRemarks,
    );
    assert.deepEqual(first.events, []);
    const green = {
      ...pending,
      checks: pending.checks.map((item) => ({ ...item, status: "success" })),
    };
    const finished = evaluate0(first.next, green, noRemarks);
    assert.deepEqual(finished.events, [passedEvent(2, false)]);
    assert.deepEqual(evaluate0(finished.next, green, noRemarks).events, []);
  });

  test("baselines existing failures and conflicts, then reports new ones", () => {
    const broken = detail({
      checks: [check("lint", "failure"), check("test", "pending")],
      mergeability: "conflicting",
      rebaseRequired: true,
    });
    const baseline = evaluate0(watch({ awaitingBaseline: "all" }), broken, noRemarks);
    assert.deepEqual(baseline.events, []);
    assert.deepEqual(baseline.next.failedChecks, ["lint"]);
    assert.equal(baseline.next.passed, false);
    assert.equal(baseline.next.conflicting, true);
    assert.equal(baseline.next.rebaseRequired, true);
    assert.deepEqual(evaluate0(baseline.next, broken, noRemarks).events, []);

    const failed = evaluate0(
      baseline.next,
      { ...broken, checks: [check("lint", "failure"), check("test", "failure")] },
      noRemarks,
    );
    assert.deepEqual(failed.events, [
      failedEvent([check("test", "failure")]),
      finishedEvent(0, [check("lint", "failure"), check("test", "failure")]),
    ]);
    const clean = evaluate0(failed.next, detail({ rebaseRequired: false }), noRemarks);
    assert.deepEqual(clean.events, []);
    assert.deepEqual(evaluate0(clean.next, broken, noRemarks).events, [
      failedEvent([check("lint", "failure")]),
      { type: "conflicting", data: {} },
      { type: "needs-rebase", data: {} },
    ]);
  });

  test("reports failures on the first read only when CI was pending at the start", () => {
    const red = detail({ checks: [check("lint", "failure"), check("test", "pending")] });
    const pending = evaluate0(
      watch({ awaitingBaseline: "all", checksPending: true }),
      red,
      noRemarks,
    );
    assert.deepEqual(pending.events, [failedEvent([check("lint", "failure")])]);
    assert.deepEqual(
      evaluate0(
        pending.next,
        detail({ checks: [check("lint", "failure"), check("test", "success")] }),
        noRemarks,
      ).events,
      [finishedEvent(1, [check("lint", "failure")])],
    );
    assert.deepEqual(
      evaluate0(watch({ awaitingBaseline: "all", checksPending: false }), red, noRemarks).events,
      [],
    );

    const placeholder = { ...check("Workflow approval status", "pending"), placeholder: true };
    const incomplete = evaluate0(
      watch({ awaitingBaseline: "all", checksPending: true }),
      detail({ checks: [check("lint", "success"), placeholder] }),
      noRemarks,
    );
    assert.deepEqual(incomplete.events, []);
    assert.deepEqual(
      evaluate0(
        incomplete.next,
        detail({ checks: [check("lint", "success"), check("gated", "failure")] }),
        noRemarks,
      ).events,
      [failedEvent([check("gated", "failure")])],
    );
  });

  test("baselines checks already awaiting approval", () => {
    const gated = detail({ checks: [{ ...check("CI", "action-required"), url: run(1) }] });
    const baseline = evaluate0(watch({ awaitingBaseline: "all" }), gated, noRemarks);
    assert.deepEqual(baseline.events, []);
    assert.deepEqual(evaluate0(baseline.next, gated, noRemarks).events, []);
  });

  test("reports remarks after the watch started while baselining checks and conflicts", () => {
    const green = detail({
      checks: [check("test", "success")],
      mergeability: "conflicting",
    });
    const comments = [
      remark("reviewer", "2026-10-02T11:00:00Z"),
      remark("reviewer", "2026-10-02T12:06:00Z"),
    ];
    const baseline = evaluate0(watch({ awaitingBaseline: "all" }), green, comments);
    assert.deepEqual(baseline.events, [remarksEvent(1)]);
    assert.equal(baseline.next.passed, true);
    assert.equal(baseline.next.conflicting, true);
    assert.equal(baseline.next.wakes, 1);
    assert.deepEqual(evaluate0(baseline.next, green, comments).events, []);
  });

  test("reports a failure once the head SHA appears after a baseline without one", () => {
    const waiting = evaluate0(
      watch({ awaitingBaseline: "all" }),
      detail({ headSha: undefined, checks: [check("test", "pending")] }),
      noRemarks,
    );
    assert.deepEqual(waiting.events, []);
    const failed = evaluate0(
      waiting.next,
      detail({ checks: [check("test", "failure")] }),
      noRemarks,
    );
    assert.deepEqual(failed.events, [failedEvent([check("test", "failure")])]);
  });

  test("keeps a baseline taken without a head SHA once the SHA appears", () => {
    const green = detail({ checks: [check("test", "success")] });
    const baseline = evaluate0(
      watch({ awaitingBaseline: "all" }),
      { ...green, headSha: undefined },
      noRemarks,
    );
    const known = evaluate0(baseline.next, green, noRemarks);
    assert.deepEqual(known.events, []);
    assert.equal(known.next.headSha, green.headSha);
    const unknown = evaluate0(known.next, { ...green, headSha: undefined }, noRemarks);
    assert.equal(unknown.next.headSha, green.headSha);
    assert.deepEqual(
      evaluate0(unknown.next, { ...green, headSha: "bbbbbbbbbb" }, noRemarks).events,
      [passedEvent(1, false)],
    );
  });

  for (const status of ["success", "failure"]) {
    test(`reports ${status} on checks that appear after a first read without any`, () => {
      const empty = evaluate0(
        watch({ awaitingBaseline: "all" }),
        detail({ checks: [] }),
        noRemarks,
      );
      assert.deepEqual(empty.events, []);
      assert.equal(empty.next.awaitingBaseline, undefined);
      assert.equal(empty.next.checksPending, true);
      assert.deepEqual(
        evaluate0(empty.next, detail({ checks: [check("test", status)] }), noRemarks).events,
        status === "success"
          ? [passedEvent(1, false)]
          : [failedEvent([check("test", "failure")])],
      );
    });
  }

  test("keeps the check baseline through a read whose approval lookup failed", () => {
    const bot = check("bot", "success");
    const unavailable = { ...check("Workflow approval status", "pending"), placeholder: true };
    const partial = evaluate0(
      watch({ awaitingBaseline: "all" }),
      detail({ checks: [bot, unavailable] }),
      noRemarks,
    );
    assert.deepEqual(partial.events, []);
    assert.equal(partial.next.awaitingBaseline, "checks");
    const approval = { ...check("CI", "action-required"), url: run(1) };
    for (const checks of [[bot], [bot, approval]]) {
      assert.deepEqual(evaluate0(partial.next, detail({ checks }), noRemarks).events, []);
    }
  });

  test("reports pending advisory checks finishing after a required-check baseline", () => {
    const initial = detail({
      checks: [{ ...check("test", "success"), required: true }, check("bot", "pending")],
    });
    const baseline = evaluate0(watch({ awaitingBaseline: "all" }), initial, noRemarks);
    assert.deepEqual(baseline.events, []);
    const settledInput = {
      ...initial,
      checks: [initial.checks[0], check("bot", "success")],
    };
    const settled = evaluate0(baseline.next, settledInput, noRemarks);
    assert.deepEqual(settled.events, [passedEvent(2, false)]);
    assert.deepEqual(evaluate0(settled.next, settledInput, noRemarks).events, []);
  });

  test("waits for workflow approval once, through reads that miss it, until the run finishes", () => {
    const bot = check("bot", "success");
    const approval = { ...check("CI", "action-required"), url: run(1) };
    const gated = detail({ checks: [bot, approval] });
    const first = evaluate0(watch(), gated, noRemarks);
    assert.deepEqual(first.events, [approvalEvent([approval])]);

    const missing = evaluate0(first.next, detail({ checks: [bot] }), noRemarks);
    assert.deepEqual(missing.events, []);
    assert.equal(missing.next.passed, false);
    assert.deepEqual(evaluate0(missing.next, gated, noRemarks).events, []);
    const later = { ...check("Preview", "action-required"), url: run(2) };
    assert.deepEqual(
      evaluate0(missing.next, detail({ checks: [bot, approval, later] }), noRemarks).events,
      [],
    );

    const unnamed = { ...check("Docs", "action-required"), url: null };
    const named = detail({ checks: [bot, unnamed] });
    const alone = evaluate0(watch(), named, noRemarks);
    assert.deepEqual(alone.events, [approvalEvent([unnamed])]);
    const placeholder = { ...unnamed, name: "Workflow approval status", placeholder: true };
    const unlisted = evaluate0(alone.next, detail({ checks: [bot, placeholder] }), noRemarks);
    assert.deepEqual(unlisted.events, []);
    assert.equal(unlisted.next.passed, false);
    assert.deepEqual(evaluate0(unlisted.next, named, noRemarks).events, []);
    const dropped = evaluate0(alone.next, detail({ checks: [bot] }), noRemarks);
    assert.deepEqual(dropped.events, []);
    assert.equal(dropped.next.passed, false);
    assert.deepEqual(dropped.next.awaitingApproval, [unnamed.name]);
    assert.deepEqual(evaluate0(dropped.next, named, noRemarks).events, []);
    const namedPending = evaluate0(
      dropped.next,
      detail({
        checks: [
          { ...bot, required: true },
          { ...unnamed, status: "pending" },
        ],
      }),
      noRemarks,
    );
    assert.deepEqual(namedPending.events, []);
    assert.equal(namedPending.next.passed, false);
    const namedDone = detail({ checks: [bot, { ...unnamed, status: "success" }] });
    const namedFinished = evaluate0(namedPending.next, namedDone, noRemarks);
    assert.deepEqual(namedFinished.events, [passedEvent(2, false)]);
    assert.deepEqual(namedFinished.next.awaitingApproval, []);
    assert.deepEqual(evaluate0(namedFinished.next, namedDone, noRemarks).events, []);
    const pushed = detail({ headSha: "bbbbbbbbbb", checks: [bot] });
    assert.deepEqual(evaluate0(missing.next, pushed, noRemarks).events, [passedEvent(1, false)]);

    const job = { ...check("lint", "success"), url: `${run(1)}/job/7` };
    const pending = { ...check("test", "pending"), url: `${run(1)}/job/8` };
    const required = { ...bot, required: true };
    const running = evaluate0(
      missing.next,
      detail({ checks: [required, job, pending] }),
      noRemarks,
    );
    assert.deepEqual(running.events, []);
    assert.equal(running.next.passed, false);
    assert.deepEqual(running.next.awaitingApproval, [run(1)]);
    const overlap = evaluate0(
      running.next,
      detail({ checks: [required, job, { ...pending, url: `${run(2)}/job/9` }] }),
      noRemarks,
    );
    assert.deepEqual(overlap.events, []);
    assert.equal(overlap.next.passed, false);
    assert.deepEqual(overlap.next.awaitingApproval, [run(1)]);
    const unlinked = evaluate0(
      overlap.next,
      detail({ checks: [required, job, { ...pending, url: null }] }),
      noRemarks,
    );
    assert.deepEqual(unlinked.events, []);
    assert.equal(unlinked.next.passed, false);
    assert.deepEqual(unlinked.next.awaitingApproval, [run(1)]);
    const advisory = evaluate0(
      unlinked.next,
      detail({ checks: [required, job, { ...pending, url: "https://ci.example/test" }] }),
      noRemarks,
    );
    assert.deepEqual(advisory.events, [passedEvent(1, true)]);
    assert.deepEqual(advisory.next.awaitingApproval, []);
    const completed = detail({ checks: [required, job, { ...pending, status: "success" }] });
    const finished = evaluate0(unlinked.next, completed, noRemarks);
    assert.deepEqual(finished.events, [passedEvent(1, true)]);
    assert.deepEqual(finished.next.awaitingApproval, []);
    assert.deepEqual(evaluate0(finished.next, completed, noRemarks).events, []);

    const done = evaluate0(missing.next, detail({ checks: [bot, job] }), noRemarks);
    assert.deepEqual(done.events, [passedEvent(2, false)]);
  });

  test("does not pass or fail while the host cannot tell whether workflows await approval", () => {
    const bot = check("bot", "success");
    const unknown = {
      ...check("Workflow approval status", "action-required"),
      url: null,
      placeholder: true,
    };
    const unread = evaluate0(watch(), detail({ checks: [bot, unknown] }), noRemarks);
    assert.deepEqual(unread.events, []);
    assert.equal(unread.next.passed, false);
    const read = evaluate0(unread.next, detail({ checks: [bot] }), noRemarks);
    assert.deepEqual(read.events, [passedEvent(1, false)]);
    const blocked = evaluate0(
      read.next,
      detail({ checks: [{ ...bot, status: "pending" }, unknown] }),
      noRemarks,
    );
    assert.equal(blocked.next.passed, false);
    assert.deepEqual(evaluate0(blocked.next, detail({ checks: [bot] }), noRemarks).events, [
      passedEvent(1, false),
    ]);
  });

  test("reports each failure at once, even while another check never finishes", () => {
    const bot = check("CodeRabbit", "pending");
    const first = detail({ checks: [check("lint", "failure"), check("test", "pending"), bot] });
    const lint = evaluate0(watch(), first, noRemarks);
    assert.deepEqual(lint.events, [failedEvent([check("lint", "failure")])]);
    assert.deepEqual(evaluate0(lint.next, first, noRemarks).events, []);

    const second = detail({ checks: [check("lint", "failure"), check("test", "failure"), bot] });
    const testFailure = evaluate0(lint.next, second, noRemarks);
    assert.deepEqual(testFailure.events, [failedEvent([check("test", "failure")])]);

    const rerun = evaluate0(testFailure.next, first, noRemarks);
    assert.equal(evaluate0(rerun.next, second, noRemarks).events.length, 1);

    const pushed = detail({ ...second, headSha: "bbbbbbbbbb" });
    assert.equal(evaluate0(testFailure.next, pushed, noRemarks).events.length, 1);

    const approval = { ...check("CI", "action-required"), url: run(1) };
    const gated = detail({ checks: [approval, check("lint", "failure")] });
    assert.deepEqual(evaluate0(watch(), gated, noRemarks).events, [
      failedEvent([check("lint", "failure")]),
      approvalEvent([approval]),
    ]);
  });

  test("reports passed once the required checks pass, whatever the others do", () => {
    const required = (name, status) => ({ ...check(name, status), required: true });
    const green = detail({
      checks: [required("test", "success"), required("lint", "success"), check("bot", "pending")],
    });
    const passed = evaluate0(watch(), green, noRemarks);
    assert.deepEqual(passed.events, [passedEvent(2, true)]);
    assert.deepEqual(evaluate0(passed.next, green, noRemarks).events, []);

    const plain = detail({ checks: [check("test", "success"), check("bot", "pending")] });
    assert.deepEqual(evaluate0(watch(), plain, noRemarks).events, []);
  });

  test("reports passed again when a required check shows up already passed", () => {
    const required = (name, status) => ({ ...check(name, status), required: true });
    const tests = detail({
      checks: [required("Tests", "success"), check("Smoke Tests", "pending")],
    });
    const first = evaluate0(watch(), tests, noRemarks);
    assert.deepEqual(first.events, [passedEvent(1, true)]);

    const gated = detail({
      checks: [
        required("Tests", "success"),
        check("Smoke Tests", "success"),
        required("Smoke Tests Gate", "success"),
      ],
    });
    const second = evaluate0(first.next, gated, noRemarks);
    assert.deepEqual(second.events, [passedEvent(2, true)]);
    assert.deepEqual(evaluate0(second.next, gated, noRemarks).events, []);

    const pending = detail({
      checks: [required("Tests", "success"), required("Smoke Tests Gate", "pending")],
    });
    const waiting = evaluate0(first.next, pending, noRemarks);
    assert.deepEqual(waiting.events, []);
    assert.deepEqual(evaluate0(waiting.next, gated, noRemarks).events, [passedEvent(2, true)]);
  });

  test("wakes again when the other checks finish after the required ones passed", () => {
    const required = (name, status) => ({ ...check(name, status), required: true });
    const early = detail({ checks: [required("test", "success"), check("e2e", "pending")] });
    const first = evaluate0(watch(), early, noRemarks);
    assert.deepEqual(first.events, [passedEvent(1, true)]);

    const done = detail({ checks: [required("test", "success"), check("e2e", "success")] });
    const final = evaluate0(first.next, done, noRemarks);
    assert.deepEqual(types(final.events), ["checks-passed"]);
    assert.deepEqual(evaluate0(final.next, done, noRemarks).events, []);

    const botPending = detail({ checks: [...done.checks, check("bot", "pending")] });
    const churn = evaluate0(final.next, botPending, noRemarks);
    assert.deepEqual(churn.events, []);
    const botDone = detail({ checks: [...done.checks, check("bot", "success")] });
    assert.deepEqual(evaluate0(churn.next, botDone, noRemarks).events, []);

    const promoted = detail({
      checks: [required("test", "success"), required("e2e", "success")],
    });
    const gated = evaluate0(first.next, promoted, noRemarks);
    assert.deepEqual(gated.events, [passedEvent(2, true)]);
    assert.deepEqual(evaluate0(gated.next, promoted, noRemarks).events, []);

    const green = evaluate0(watch(), done, noRemarks);
    assert.deepEqual(green.events, [passedEvent(1, true)]);
    assert.deepEqual(evaluate0(green.next, botDone, noRemarks).events, []);
  });

  test("reports an owed non-required failure once after the required notice", () => {
    const required = { ...check("test", "success"), required: true };
    const early = detail({ checks: [required, check("e2e", "pending")] });
    const first = evaluate0(watch(), early, noRemarks);
    assert.deepEqual(first.events, [passedEvent(1, true)]);
    const failed = detail({ checks: [required, check("e2e", "failure")] });
    const failure = evaluate0(first.next, failed, noRemarks);
    assert.deepEqual(failure.events, [failedEvent([check("e2e", "failure")])]);
    const repeated = evaluate0(failure.next, failed, noRemarks);
    assert.deepEqual(repeated.events, []);
    const recovered = detail({ checks: [required, check("e2e", "success")] });
    const final = evaluate0(repeated.next, recovered, noRemarks);
    assert.deepEqual(final.events, [passedEvent(2, false)]);
    assert.deepEqual(evaluate0(final.next, recovered, noRemarks).events, []);
  });

  test("clears old-head owed checks when a new head is pushed", () => {
    const required = { ...check("test", "success"), required: true };
    const early = detail({ checks: [required, check("e2e", "pending")] });
    const first = evaluate0(watch(), early, noRemarks);
    assert.deepEqual(first.next.owedChecks, ["e2e"]);
    const unreadHead = detail({ headSha: "bbbbbbbbbb", checks: [] });
    const unread = evaluate0(first.next, unreadHead, noRemarks);
    assert.deepEqual(unread.events, []);
    assert.deepEqual(unread.next.owedChecks, []);
    const pushed = detail({ ...unreadHead, checks: [required] });
    const newHead = evaluate0(unread.next, pushed, noRemarks);
    assert.deepEqual(newHead.events, [passedEvent(1, true)]);
    assert.deepEqual(newHead.next.owedChecks, []);
    const lateResult = detail({ ...pushed, checks: [required, check("e2e", "success")] });
    const final = evaluate0(newHead.next, lateResult, noRemarks);
    assert.deepEqual(final.events, []);
    assert.deepEqual(evaluate0(final.next, lateResult, noRemarks).events, []);
  });

  for (const required of [true, false]) {
    test(`wakes once when the other checks finish after one failed (required: ${required})`, () => {
      const gated = (name, status) => ({ ...check(name, status), required });
      const labels = gated("labels", "failure");
      const running = detail({
        checks: [labels, gated("test", "pending"), gated("docs", "pending")],
      });
      const failure = evaluate0(watch(), running, noRemarks);
      assert.deepEqual(failure.events, [failedEvent([labels])]);
      assert.deepEqual(evaluate0(failure.next, running, noRemarks).events, []);

      const done = detail({ checks: [labels, gated("test", "success"), gated("docs", "skipped")] });
      const finished = evaluate0(failure.next, done, noRemarks);
      assert.deepEqual(finished.events, [finishedEvent(1, [labels])]);
      assert.deepEqual(evaluate0(finished.next, done, noRemarks).events, []);

      const botPending = detail({ checks: [...done.checks, check("bot", "pending")] });
      const churn = evaluate0(finished.next, botPending, noRemarks);
      assert.deepEqual(churn.events, []);
      const botDone = detail({ checks: [...done.checks, check("bot", "success")] });
      assert.deepEqual(evaluate0(churn.next, botDone, noRemarks).events, []);

      const late = evaluate0(watch({ awaitingBaseline: "all" }), running, noRemarks);
      assert.deepEqual(late.events, []);
      assert.deepEqual(evaluate0(late.next, done, noRemarks).events, finished.events);
    });
  }

  test("says the checks finished only once every check has, a maintainer's approval included", () => {
    const required = (name, status) => ({ ...check(name, status), required: true });
    const lint = required("lint", "failure");
    const unit = required("unit", "success");
    const failure = evaluate0(
      watch(),
      detail({ checks: [lint, required("unit", "pending"), check("e2e", "pending")] }),
      noRemarks,
    );
    assert.deepEqual(failure.events, [failedEvent([lint])]);

    const advisory = detail({ checks: [lint, unit, check("e2e", "pending")] });
    const waiting = evaluate0(failure.next, advisory, noRemarks);
    assert.deepEqual(waiting.events, []);

    const approval = { ...check("deploy", "action-required"), url: run(1) };
    const held = detail({ checks: [lint, unit, check("e2e", "success"), approval] });
    const holding = evaluate0(waiting.next, held, noRemarks);
    assert.deepEqual(holding.events, [approvalEvent([approval])]);

    const unknown = {
      ...check("Workflow approval status", "action-required"),
      url: null,
      placeholder: true,
    };
    const deployed = { ...approval, status: "success" };
    const e2e = check("e2e", "failure");
    const unread = evaluate0(
      holding.next,
      detail({ checks: [lint, unit, check("e2e", "success"), deployed, unknown] }),
      noRemarks,
    );
    assert.deepEqual(unread.events, []);

    const done = detail({ checks: [lint, unit, e2e, deployed] });
    const finished = evaluate0(unread.next, done, noRemarks);
    assert.deepEqual(finished.events, [
      failedEvent([e2e]),
      finishedEvent(2, [lint, e2e]),
    ]);
    assert.deepEqual(evaluate0(finished.next, done, noRemarks).events, []);

    const gated = { ...check("deploy", "action-required"), url: run(2) };
    const asked = evaluate0(
      watch(),
      detail({ checks: [required("lint", "pending"), gated] }),
      noRemarks,
    );
    const omitted = evaluate0(asked.next, detail({ checks: [lint] }), noRemarks);
    assert.deepEqual(omitted.events, [failedEvent([lint])]);
    const job = { ...check("deploy-job", "success"), url: `${run(2)}/job/1` };
    assert.deepEqual(evaluate0(omitted.next, detail({ checks: [lint, job] }), noRemarks).events, [
      finishedEvent(1, [lint]),
    ]);
  });

  test("wakes when a rerun finishes while another failure still blocks the checks", () => {
    const labels = check("labels", "failure");
    const testFailure = check("test", "failure");
    const both = detail({ checks: [labels, testFailure] });
    const failed = evaluate0(watch(), both, noRemarks);
    assert.deepEqual(failed.events, [failedEvent([labels, testFailure])]);
    assert.deepEqual(evaluate0(failed.next, both, noRemarks).events, []);

    const rerun = evaluate0(
      failed.next,
      detail({ checks: [labels, check("test", "pending")] }),
      noRemarks,
    );
    assert.deepEqual(rerun.events, []);
    const recovered = detail({ checks: [labels, check("test", "success")] });
    assert.deepEqual(evaluate0(rerun.next, recovered, noRemarks).events, [
      finishedEvent(1, [labels]),
    ]);
    assert.deepEqual(evaluate0(failed.next, recovered, noRemarks).events, [
      finishedEvent(1, [labels]),
    ]);

    const pushed = detail({ ...recovered, headSha: "bbbbbbbbbb" });
    assert.deepEqual(evaluate0(rerun.next, pushed, noRemarks).events, [
      failedEvent([labels]),
    ]);
  });

  test("does not report passed again for a new passed check where none is required", () => {
    const first = evaluate0(watch(), detail({ checks: [check("test", "success")] }), noRemarks);
    assert.deepEqual(first.events, [passedEvent(1, false)]);
    const both = detail({ checks: [check("test", "success"), check("lint", "success")] });
    assert.deepEqual(evaluate0(first.next, both, noRemarks).events, []);
  });

  test("does not wake a watch saved before passed checks were recorded", () => {
    const green = detail({ checks: [{ ...check("test", "success"), required: true }] });
    const told = watch({ headSha: "aaaaaaaaaa", passed: true });
    const saved = evaluate0(told, green, noRemarks);
    assert.deepEqual(saved.events, []);
    assert.deepEqual(saved.next.passedChecks, ["test"]);
  });

  test("keeps remarks for a later pass when the conversation was not read whole", () => {
    const comments = [remark("reviewer", "2026-10-02T12:06:00Z")];
    const partial = evaluate0(watch(), detail(), null);
    assert.deepEqual(partial.events, []);
    assert.equal(evaluate0(partial.next, detail(), comments).events[0]?.type, "remarks");
  });

  test("reports a remark that shows up late with the same time as a reported one", () => {
    const first = remark("reviewer", "2026-10-02T12:06:00Z");
    const late = { ...remark("bot", "2026-10-02T12:06:00Z"), id: "late" };
    const reported = evaluate0(watch(), detail(), [first]);
    const again = evaluate0(reported.next, detail(), [first, late]);
    assert.deepEqual(again.events, [remarksEvent(1)]);
    assert.deepEqual(again.next.remarkIds, [first.id, "late"]);
  });

  test("reports edits after the watermark once and counts them toward the wake limit", () => {
    const old = remark("greptile[bot]", "2026-10-02T11:00:00Z");
    const watching = watch({
      headSha: "aaaaaaaaaa",
      remarkIds: [old.id],
      wakes: PULL_REQUEST_WATCH_WAKE_LIMIT - 1,
    });
    assert.deepEqual(evaluate0(watching, detail(), [old]).events, []);
    const edited = { ...old, editedAt: "2026-10-02T12:06:00Z" };
    const report = evaluate0(watching, detail(), [edited]);
    assert.deepEqual(report.events, [remarksEvent(1)]);
    assert.equal(report.next.remarksThrough, edited.editedAt);
    assert.deepEqual(report.next.remarkIds, [old.id]);
    assert.equal(report.exhausted, true);
    assert.deepEqual(evaluate0(report.next, detail(), [edited]).events, []);
    const late = { ...edited, id: "late" };
    assert.deepEqual(evaluate0(report.next, detail(), [edited, late]).events, [remarksEvent(1)]);
  });

  test("wakes once per edit of a remark seen at the watermark, never for the agent's own", () => {
    const seen = remark("ci-bot", "2026-10-10T19:52:40.000Z");
    const watching = watch({
      headSha: "aaaaaaaaaa",
      remarksThrough: seen.createdAt,
      remarkIds: [seen.id],
      wakes: 2,
    });
    assert.deepEqual(evaluate0(watching, detail(), [seen]).events, []);
    const edited = { ...seen, editedAt: "2026-10-10T20:04:50.000Z" };
    const first = evaluate0(watching, detail(), [edited]);
    assert.deepEqual(first.events, [remarksEvent(1)]);
    assert.equal(first.next.remarksThrough, edited.editedAt);
    assert.deepEqual(evaluate0(first.next, detail(), [edited]).events, []);
    const again = { ...seen, editedAt: "2026-10-10T20:05:50.000Z" };
    const second = evaluate0(first.next, detail(), [again]);
    assert.deepEqual(second.events, [remarksEvent(1)]);
    assert.deepEqual(evaluate0(second.next, detail(), [again]).events, []);
    const own = { ...edited, author: { login: "agent-user" } };
    assert.deepEqual(evaluate0(watching, detail(), [own]).events, []);
  });

  test("does not treat a failed check read as a rerun", () => {
    const failed = detail({ checks: [check("lint", "failure")] });
    const reported = evaluate0(watch(), failed, noRemarks);
    assert.equal(reported.events.length, 1);
    const unreadable = evaluate0(reported.next, detail({ checks: [] }), noRemarks);
    assert.deepEqual(evaluate0(unreadable.next, failed, noRemarks).events, []);
  });

  test("wakes for the pull request's author when the agent is someone else", () => {
    const contributor = detail({ author: { login: "contributor" } });
    const reply = remark("contributor", "2026-10-02T12:06:00Z");
    assert.deepEqual(evaluate0(watch(), contributor, [reply]).events, [remarksEvent(1)]);
    const noViewer = detail({ viewer: undefined, author: contributor.author });
    assert.deepEqual(evaluate0(watch(), noViewer, [reply]).events, []);
  });

  test("reports remarks from others once and never the agent's own", () => {
    const comments = [
      remark("agent-user", "2026-10-02T12:05:00Z", "Fixed in the latest push."),
      remark("macroscope-app[bot]", "2026-10-02T12:06:00Z"),
      remark("reviewer", "2026-10-02T11:00:00Z", "Older than the watch."),
    ];
    const report = evaluate0(watch(), detail(), comments);
    assert.deepEqual(report.events, [remarksEvent(1)]);
    assert.equal(report.next.remarksThrough, "2026-10-02T12:06:00Z");
    assert.deepEqual(evaluate0(report.next, detail(), comments).events, []);
  });

  test("skips CodeRabbit review acknowledgements and wakes once for their outcome edits", () => {
    const current = `<!-- This is an auto-generated reply by CodeRabbit -->
<details>
<summary>✅ Actions performed</summary>

Review triggered.

</details>`;
    const rows = [
      ["coderabbitai[bot]", codeRabbitReply("Review triggered.")],
      ["coderabbitai[bot]", codeRabbitReply("Full review triggered.")],
      ["coderabbitai[bot]", current],
      ["coderabbitai", current],
    ];
    for (const [login, acknowledgement] of rows) {
      const queued = {
        ...remark(login, "2026-10-02T12:06:00Z", acknowledgement),
        kind: "issue-comment",
        path: null,
      };
      const watching = watch({ headSha: "aaaaaaaaaa", wakes: 2 });
      const progress = evaluate0(watching, detail(), [queued]);
      assert.deepEqual(progress.events, []);
      assert.equal(progress.next.remarksThrough, queued.createdAt);
      assert.deepEqual(progress.next.remarkIds, [queued.id]);
      assert.equal(progress.next.wakes, 2);
      assert.equal(progress.exhausted, false);
      assert.deepEqual(evaluate0(progress.next, detail(), [queued]).events, []);

      const outcome = {
        ...queued,
        body: codeRabbitReply("Review finished."),
        editedAt: "2026-10-02T12:07:00Z",
      };
      const finished = evaluate0(progress.next, detail(), [outcome]);
      assert.deepEqual(finished.events, [remarksEvent(1)]);
      assert.equal(finished.next.wakes, 3);
      assert.deepEqual(evaluate0(finished.next, detail(), [outcome]).events, []);

      const late = remark("reviewer", queued.createdAt);
      const mixed = evaluate0(watching, detail(), [queued, late]);
      assert.deepEqual(mixed.events, [remarksEvent(1)]);
      assert.deepEqual(mixed.next.remarkIds, [queued.id, late.id]);
    }
  });

  test("keeps other replies and outcomes actionable beside CodeRabbit review progress", () => {
    const bodies = [
      codeRabbitReply("Full review triggered.", "Actions performed"),
      codeRabbitReply("Unable to review.", "Action not completed"),
      codeRabbitReply("Here is the answer to your question."),
      "Review triggered.",
      codeRabbitReply("Review triggered.").replace(
        "<!-- This is an auto-generated reply by CodeRabbit -->",
        "",
      ),
    ];
    const comments = [
      ...bodies.map((body, index) => ({
        ...remark("coderabbitai[bot]", "2026-10-02T12:06:00Z", body),
        id: `coderabbit-${index}`,
      })),
      remark("other-bot[bot]", "2026-10-02T12:06:00Z", bodies[0]),
      remark("reviewer", "2026-10-02T12:06:00Z", bodies[0]),
    ];
    const report = evaluate0(watch(), detail(), comments);
    assert.deepEqual(report.events, [remarksEvent(6)]);
    assert.deepEqual(evaluate0(report.next, detail(), comments).events, []);
  });

  test("reports a conflict once, until the branch is clean again", () => {
    const conflicting = detail({ mergeability: "conflicting" });
    const first = evaluate0(watch(), conflicting, noRemarks);
    assert.deepEqual(first.events, [{ type: "conflicting", data: {} }]);
    const { headSha: _unreadHead, ...headUnread } = conflicting;
    const unread = evaluate0(first.next, headUnread, noRemarks);
    assert.deepEqual(unread.events, []);
    assert.deepEqual(evaluate0(unread.next, conflicting, noRemarks).events, []);
    const recomputing = evaluate0(first.next, detail({ mergeability: "unknown" }), noRemarks);
    assert.deepEqual(evaluate0(recomputing.next, conflicting, noRemarks).events, []);
    const clean = evaluate0(first.next, detail(), noRemarks);
    assert.deepEqual(evaluate0(clean.next, conflicting, noRemarks).events, [
      { type: "conflicting", data: {} },
    ]);
    const pushed = { headSha: "bbbbbbbbbb" };
    const recomputed = evaluate0(
      first.next,
      detail({ ...pushed, mergeability: "unknown" }),
      noRemarks,
    );
    assert.deepEqual(
      evaluate0(recomputed.next, detail({ ...pushed, mergeability: "conflicting" }), noRemarks)
        .events,
      [{ type: "conflicting", data: {} }],
    );
  });

  test("reports each merge queue removal once while the head checks stay green", () => {
    const green = detail({ checks: [check("test", "success")] });
    const watching = evaluate0(watch(), green, noRemarks).next;
    const removed = (id, removedAt) =>
      detail({ ...green, mergeQueueRemoval: { id, removedAt, reason: "Merge conflict" } });

    const dropped = removed("first", "2026-10-02T12:10:00Z");
    const first = evaluate0(watching, dropped, noRemarks);
    assert.deepEqual(first.events, [
      { type: "merge-queue-removed", data: { reason: "Merge conflict" } },
    ]);
    assert.deepEqual(evaluate0(first.next, dropped, noRemarks).events, []);
    const quiet = evaluate0(first.next, green, noRemarks);
    assert.deepEqual(evaluate0(quiet.next, dropped, noRemarks).events, []);

    const again = removed("second", "2026-10-02T12:20:00Z");
    assert.equal(evaluate0(first.next, again, noRemarks).events.length, 1);
    const before = removed("before", "2026-10-02T11:00:00Z");
    const baseline = evaluate0(
      watch({ headSha: watching.headSha, passed: true, passedChecks: watching.passedChecks }),
      before,
      noRemarks,
    );
    assert.deepEqual(baseline.events, []);
    for (const prior of [watching, baseline.next]) {
      const skewed = evaluate0(prior, removed("new", "2026-10-02T11:59:58Z"), noRemarks);
      assert.deepEqual(skewed.events, [
        { type: "merge-queue-removed", data: { reason: "Merge conflict" } },
      ]);
      assert.deepEqual(
        evaluate0(skewed.next, removed("new", "2026-10-02T11:59:58Z"), noRemarks).events,
        [],
      );
    }
  });

  test("reports a merge queue removal stamped in the second the watch started", () => {
    const watching = watch({ startedAt: "2026-10-02T12:00:00.500Z" });
    const removed = (removedAt) =>
      detail({ mergeQueueRemoval: { id: "first", removedAt, reason: "CI failed" } });
    assert.deepEqual(evaluate0(watching, removed("2026-10-02T12:00:00Z"), noRemarks).events, [
      { type: "merge-queue-removed", data: { reason: "CI failed" } },
    ]);
    assert.deepEqual(evaluate0(watching, removed("2026-10-02T11:59:59Z"), noRemarks).events, []);
  });

  test("stays quiet when the queue lets go of a pull request by merging it", () => {
    const watching = evaluate0(watch(), detail(), noRemarks).next;
    const merging = detail({
      mergeQueueRemoval: { id: "landed", removedAt: "2026-10-02T12:10:00Z", reason: "merged" },
    });
    const read = evaluate0(watching, merging, noRemarks);
    assert.deepEqual(read.events, []);
    assert.equal(read.next.mergeQueueRemovalId, "landed");
  });

  test("does not spend the comment wake limit on check results", () => {
    const tired = watch({ headSha: "aaaaaaaaaa", wakes: PULL_REQUEST_WATCH_WAKE_LIMIT - 1 });
    const result = evaluate0(tired, detail({ checks: [check("lint", "failure")] }), noRemarks);
    assert.equal(result.exhausted, false);
    assert.equal(result.next.wakes, 0);
  });

  test("stops after the wake limit unless the head moves", () => {
    const comments = [remark("reviewer", "2026-10-02T12:10:00Z")];
    const tired = watch({ headSha: "aaaaaaaaaa", wakes: PULL_REQUEST_WATCH_WAKE_LIMIT - 1 });
    assert.equal(evaluate0(tired, detail(), comments).exhausted, true);
    const pushed = evaluate0(tired, detail({ headSha: "cccccccccc" }), comments);
    assert.equal(pushed.exhausted, false);
    assert.equal(pushed.next.wakes, 1);
  });

  const anHourLater = (first, read) => {
    const kinds = [];
    let current = first;
    for (let minute = 0; minute <= 60; minute += 10) {
      const { events, next } = evaluateAt(current, read, noRemarks, minute * 60_000);
      kinds.push(types(events));
      current = next;
    }
    return kinds;
  };

  test("does not tell a watch saved before the no-checks clock that its seen head has none", () => {
    const legacy = watch({ headSha: "aaaaaaaaaa" });
    assert.equal(
      anHourLater(legacy, detail({ checks: [] })).every((kinds) => kinds.length === 0),
      true,
    );
    const pushed = anHourLater(legacy, detail({ headSha: "bbbbbbbbbb", checks: [] }));
    assert.deepEqual(pushed.flat(), ["no-checks"]);
    const unknown = detail({
      checks: [{ ...check("Workflow approval status", "action-required"), placeholder: true }],
    });
    const fresh = watch({ awaitingBaseline: "all" });
    assert.deepEqual(anHourLater(fresh, unknown).flat(), []);
    const unread = evaluateAt(fresh, unknown, noRemarks, 0);
    assert.deepEqual(evaluateAt(unread.next, detail({ checks: [] }), noRemarks, 60 * 60_000).events, [
      { type: "no-checks", data: { minutes: 60 } },
    ]);
  });

  test("starts the no-checks clock while a fresh watch awaits its baseline", () => {
    assert.deepEqual(anHourLater(watch({ awaitingBaseline: "all" }), detail({ checks: [] })).flat(), [
      "no-checks",
    ]);
  });

  test("never reports missing checks on a host where an empty list says nothing", () => {
    const silent = detail({ capabilities: capabilities(false), checks: [] });
    assert.equal(anHourLater(watch(), silent).every((kinds) => kinds.length === 0), true);
  });

  test("counts checks as pending until every one, a review bot's included, has finished", () => {
    const pending = (checks, from = watch()) =>
      evaluate0(from, detail({ checks }), noRemarks).next.checksPending;
    const ci = { ...check("test", "success"), required: true };
    assert.equal(pending([ci, check("CodeRabbit", "pending")]), true);
    assert.equal(pending([ci, check("CodeRabbit", "success")]), false);
    assert.equal(pending([ci, check("CodeRabbit", "failure")]), false);
    assert.equal(pending([ci, check("deploy", "action-required")]), false);
    assert.equal(pending([], watch({ headSha: "aaaaaaaaaa", checksPending: false })), false);
    const unreadable = { ...check("approvals", "action-required"), placeholder: true };
    assert.equal(
      pending([unreadable], watch({ headSha: "aaaaaaaaaa", checksPending: true })),
      true,
    );
  });

  test("waits a while for a new head's checks on every host", () => {
    const pushed = (checksAlwaysReport) =>
      evaluate0(
        watch({ headSha: "aaaaaaaaaa", checksPending: false }),
        detail({
          headSha: "bbbbbbbbbb",
          capabilities: capabilities(checksAlwaysReport),
          checks: [],
        }),
        noRemarks,
      ).next.checksPending;
    assert.equal(pushed(true), true);
    assert.equal(pushed(false), true);

    for (const checksAlwaysReport of [true, false]) {
      let current = watch({ headSha: "aaaaaaaaaa" });
      for (const minute of [0, 20]) {
        current = evaluateAt(
          current,
          detail({
            headSha: "bbbbbbbbbb",
            capabilities: capabilities(checksAlwaysReport),
            checks: [],
          }),
          noRemarks,
          minute * 60_000,
        ).next;
      }
      assert.equal(current.checksPending, false);
    }

    const unanswered = (checksAwaitedSince) =>
      evaluate0(
        watch({ headSha: "bbbbbbbbbb", checksAwaitedSince }),
        detail({ headSha: "bbbbbbbbbb", checks: [] }),
        noRemarks,
      ).next.checksPending;
    assert.equal(unanswered(null), false);
    assert.equal(unanswered(STARTED), true);
  });

  test("makeInitialDedupe constructs first-time baseline input", () => {
    const initial = makeInitialDedupe({
      startedAt: STARTED,
      remarksThrough: STARTED,
      checksPending: true,
    });
    assert.equal(initial.awaitingBaseline, "all");
    assert.equal(initial.headSha, null);
    assert.equal(initial.checksPending, true);
    assert.equal(initial.wakes, 0);
    assert.deepEqual(initial.remarkIds, []);
    assert.equal("mergeQueueRemovalId" in initial, false);
  });

  test("makeInitialDedupe carries only T3 re-add continuation fields", () => {
    const carried = {
      startedAt: "2026-10-01T00:00:00.000Z",
      headSha: "bbbbbbbbbb",
      failedChecks: ["lint"],
      passed: true,
      passedChecks: ["test"],
      owedChecks: ["e2e"],
      awaitingApproval: [run(1)],
      approvalAnnounced: true,
      remarksThrough: "2026-10-01T01:00:00.000Z",
      remarkIds: ["old"],
      conflicting: true,
      rebaseRequired: true,
      mergeQueueRemovalId: "old-removal",
      wakes: 8,
      awaitingBaseline: "checks",
      checksAwaitedSince: STARTED,
      checksPending: true,
    };
    const initial = makeInitialDedupe({
      startedAt: STARTED,
      remarksThrough: STARTED,
      checksPending: false,
      carried,
    });
    assert.equal(initial.startedAt, STARTED);
    assert.equal(initial.headSha, "bbbbbbbbbb");
    assert.deepEqual(initial.failedChecks, ["lint"]);
    assert.equal(initial.passed, true);
    assert.deepEqual(initial.passedChecks, ["test"]);
    assert.deepEqual(initial.owedChecks, ["e2e"]);
    assert.deepEqual(initial.awaitingApproval, [run(1)]);
    assert.equal(initial.approvalAnnounced, true);
    assert.equal(initial.conflicting, true);
    assert.equal(initial.rebaseRequired, true);
    assert.equal(initial.awaitingBaseline, "checks");
    assert.equal(initial.checksAwaitedSince, STARTED);
    assert.equal(initial.remarksThrough, STARTED);
    assert.deepEqual(initial.remarkIds, []);
    assert.equal("mergeQueueRemovalId" in initial, false);
    assert.equal(initial.wakes, 0);
    assert.equal(initial.checksPending, false);
  });
}
