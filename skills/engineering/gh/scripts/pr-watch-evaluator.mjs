// Pull request watch evaluator semantics ported from t3code commit
// a066eb0935da44bbb16571638138c218bfdbf775 (MIT licensed).
// Source: apps/server/src/orchestration-v2/pullRequestWatch.ts lines 54-305.

/** Bounds consecutive comment-only wakes to stop bot reply loops; other progress resets it. */
export const PULL_REQUEST_WATCH_WAKE_LIMIT = 10;

/** How long a head may go without any check before the caller is told none reported. */
export const PULL_REQUEST_WATCH_NO_CHECKS_MS = 15 * 60_000;

/**
 * @typedef {object} WatchCheck
 * @property {string} name
 * @property {"success"|"action-required"|"failure"|"cancelled"|"skipped"|"pending"|"neutral"} status
 * @property {string|null} url
 * @property {boolean} [required]
 * @property {boolean} [placeholder]
 */

/**
 * @typedef {object} WatchRemark
 * @property {string} id
 * @property {string} createdAt
 * @property {string} [editedAt]
 * @property {string} body
 * @property {{login: string}|null} [author]
 */

/**
 * Evaluator dedupe state/input. Optional absence is semantic for T3 compatibility:
 * mergeQueueRemovalId is absent before the first queue read, while null means an empty
 * read baselined it; checksAwaitedSince is null when no no-checks clock is running.
 *
 * @typedef {object} WatchDedupe
 * @property {string} startedAt
 * @property {string|null} headSha
 * @property {string[]} failedChecks
 * @property {boolean} passed
 * @property {string[]} passedChecks
 * @property {string[]} [owedChecks]
 * @property {string[]} [awaitingApproval]
 * @property {boolean} [approvalAnnounced]
 * @property {string} remarksThrough
 * @property {string[]} remarkIds
 * @property {boolean} conflicting
 * @property {boolean} [rebaseRequired]
 * @property {string|null} [mergeQueueRemovalId]
 * @property {number} wakes
 * @property {"all"|"checks"} [awaitingBaseline]
 * @property {string|null} [checksAwaitedSince]
 * @property {boolean} [checksPending]
 */

/**
 * Detail slice consumed by the evaluator.
 *
 * @typedef {object} WatchDetail
 * @property {{checksAlwaysReport?: boolean}} capabilities
 * @property {string} [headSha]
 * @property {WatchCheck[]} checks
 * @property {"mergeable"|"conflicting"|"unknown"} mergeability
 * @property {string} [viewer]
 * @property {{login: string}} [author]
 * @property {boolean} [rebaseRequired]
 * @property {{id: string, removedAt: string, reason: string|null}} [mergeQueueRemoval]
 */

/**
 * Compact event descriptor. Data shapes are exactly:
 * checks-failed {checks:[{name,url}]}; checks-passed {count,required};
 * checks-finished {passed,failing:[{name,url}]};
 * checks-awaiting-approval {checks:[{name,url}]}; remarks {count};
 * no-checks {minutes}; conflicting {}; needs-rebase {}; merge-queue-removed {reason}.
 *
 * @typedef {object} WatchEvent
 * @property {string} type
 * @property {object} data
 */

const isFailedCheck = (check) => check.status === "failure" || check.status === "cancelled";

// A GitHub Actions job URL extends its workflow run URL; their names need not match.
const workflowRunOf = (url) => url?.match(/^.*\/actions\/runs\/\d+/)?.[0] ?? null;
const approvalKey = (check) => workflowRunOf(check.url) ?? check.name;

function isReviewAcknowledgement(remark) {
  return (
    remark.author?.login.toLowerCase().replace(/\[bot\]$/, "") === "coderabbitai" &&
    /<!-- This is an auto-generated reply by CodeRabbit -->[\s\S]*?<summary>[^\p{L}<]*Actions? performed<\/summary>\s*(?:<dl>\s*<dd>\s*<br>\s*)?(?:Full review|Review) triggered\./u.test(
      remark.body.slice(0, 1_000),
    )
  );
}

const checkRef = (check) => ({ name: check.name, url: check.url ?? null });

/**
 * Evaluate one detail/activity read against durable watch dedupe state. T3's `until`
 * thread-holding field is deliberately outside this port and is neither read nor preserved.
 *
 * @param {object} input
 * @param {WatchDedupe} input.watch durable dedupe state from the previous committed read
 * @param {WatchDetail} input.detail composed detail read; placeholder checks only mark it untrusted
 * @param {WatchRemark[]|null} input.remarks visible remarks, or null when activity was unread
 * @param {number} input.now epoch milliseconds used for every clock decision in this read
 * @returns {{next: WatchDedupe, events: WatchEvent[], exhausted: boolean}}
 */
export function evaluateWatch({ watch, detail, remarks, now }) {
  /** @type {WatchEvent[]} */
  const events = [];
  // A read without a head says nothing about pushes, so it keeps the last known one.
  const headSha = detail.headSha ?? watch.headSha;
  const headMoved = watch.headSha !== null && headSha !== watch.headSha;
  const checksBaseline = watch.awaitingBaseline !== undefined && !headMoved;

  // Hosts can return no checks on read failure; preserve prior state.
  let failedChecks = headMoved ? [] : watch.failedChecks;
  let passed = headMoved ? false : watch.passed;
  let passedChecks = headMoved ? [] : watch.passedChecks;
  let owedChecks = headMoved ? [] : (watch.owedChecks ?? []);
  const owedBefore = owedChecks;
  let awaitingApproval = headMoved ? [] : (watch.awaitingApproval ?? []);
  let approvalAnnounced = headMoved ? false : (watch.approvalAnnounced ?? false);
  // A watch with no answer (saved before the field, or since a push) waits only while the clock below runs.
  let checksPending = headMoved ? false : (watch.checksPending ?? watch.checksAwaitedSince != null);
  // An unavailable approval read cannot establish success or that no checks exist.
  const unread = detail.checks.some((check) => check.placeholder === true);
  const checks = detail.checks.filter((check) => check.placeholder !== true);
  const failed = checks.filter(isFailedCheck);
  const awaiting = checks.filter((check) => check.status === "action-required");
  const failedBefore = failedChecks;
  const newlyFailed = failed.filter((check) => !failedBefore.includes(check.name));

  if (checks.length > 0) {
    // A run awaiting approval waits on a person, like a review, so only running checks count.
    // An unfinished baseline read keeps the seed below for the next one.
    checksPending =
      checks.some((check) => check.status === "pending") ||
      (checksBaseline && unread && watch.checksPending === true);
    // The baseline hides failures from before the watch, but CI running at the start can fail
    // before the first read.
    if (newlyFailed.length > 0 && (!checksBaseline || watch.checksPending === true)) {
      events.push({
        type: "checks-failed",
        data: { checks: newlyFailed.map(checkRef) },
      });
    }
    if (!approvalAnnounced && awaiting.length > 0) {
      if (!checksBaseline) {
        events.push({
          type: "checks-awaiting-approval",
          data: { checks: awaiting.map(checkRef) },
        });
      }
      approvalAnnounced = true;
    }
    failedChecks = failed.map((check) => check.name);

    // Approval reads can omit gated runs. Keep each hold until its jobs finish.
    const awaitingNow = [...new Set(awaiting.map(approvalKey))];
    const nameUnfinished = (name) => {
      const matching = checks.filter((check) => check.name === name);
      return (
        matching.length === 0 ||
        matching.some((check) => check.status === "pending" || check.status === "action-required")
      );
    };
    // GitHub deduplicates jobs across runs, so a visible pending job may hide one in an awaited run.
    // A pending check without a URL could be such a job; one with another host's URL cannot.
    const jobsPending = checks.some(
      (check) =>
        check.status === "pending" && (check.url === null || workflowRunOf(check.url) !== null),
    );
    const finished = new Set(
      jobsPending
        ? []
        : checks
            .filter((check) => check.status !== "action-required" && check.status !== "pending")
            .map((check) => workflowRunOf(check.url)),
    );
    awaitingApproval = [
      ...awaitingNow,
      ...awaitingApproval.filter(
        (key) =>
          !awaitingNow.includes(key) &&
          (workflowRunOf(key) === key ? !finished.has(key) : nameUnfinished(key)),
      ),
    ];
  }

  const required = checks.filter((check) => check.required === true);
  const gate = required.length > 0 ? required : checks;
  const passedNow =
    awaitingApproval.length === 0 &&
    gate.every((check) => check.status !== "pending" && !isFailedCheck(check));
  if (checks.length > 0 && !(unread && passedNow)) {
    const gateNames = gate.map((check) => check.name);
    const told = passed && passedChecks.length === 0 ? gateNames : passedChecks;
    // Required checks can finish between sweeps; detect new names. With no required checks, ignore advisory gate growth.
    const gateGrew = required.length > 0 && gateNames.some((name) => !told.includes(name));
    // Other checks still pending when required ones passed are owed one wake when all settle.
    // Only those are owed, so later advisory churn never wakes. One turned required is gate news.
    const owed =
      passedNow && passed
        ? checks
            .filter((check) => check.required !== true && owedChecks.includes(check.name))
            .map((check) => check.name)
        : [];
    const settled =
      failed.length === 0 &&
      awaitingApproval.length === 0 &&
      checks.every((check) => check.status !== "pending");
    owedChecks = owed;
    if (passedNow && (!passed || gateGrew)) {
      // CI running at the start that has since settled green is news. The start rollup can be
      // pending only on optional checks, so a passed gate alone is not.
      if (!checksBaseline || (watch.checksPending === true && settled)) {
        events.push({
          type: "checks-passed",
          data: { count: gate.length, required: required.length > 0 },
        });
      }
      owedChecks =
        required.length > 0
          ? checks
              .filter((check) => check.required !== true && check.status === "pending")
              .map((check) => check.name)
          : [];
    } else if (settled && owed.length > 0) {
      events.push({
        type: "checks-passed",
        data: { count: checks.length, required: false },
      });
      owedChecks = [];
    } else if (gate.some(isFailedCheck)) {
      // A failed gate never sends the passed wake. A failure seen while other checks still run, or
      // a failed check that ran again, owes one wake once every check has finished.
      const rerun = failedBefore.some((name) => !failedChecks.includes(name));
      const running =
        unread ||
        awaitingApproval.length > 0 ||
        checks.some((check) => check.status === "pending" || check.status === "action-required");
      if (running) {
        if (owedBefore.length > 0 || rerun || newlyFailed.length > 0) owedChecks = failedChecks;
      } else if (owedBefore.length > 0 || rerun) {
        events.push({
          type: "checks-finished",
          data: {
            passed: checks.filter((check) => check.status === "success").length,
            failing: failed.map(checkRef),
          },
        });
      }
    }
    passed = passedNow;
    passedChecks = passedNow ? gateNames : [];
  }

  // Only a head never read with checks waits for them; a legacy watch's clock starts at its next push.
  const awaitedBefore =
    headMoved || watch.awaitingBaseline === "all"
      ? new Date(now).toISOString()
      : (watch.checksAwaitedSince ?? null);
  let checksAwaitedSince = checks.length > 0 ? null : awaitedBefore;
  const awaitedMs = checksAwaitedSince === null ? 0 : now - Date.parse(checksAwaitedSince);
  if (!unread && awaitedMs >= PULL_REQUEST_WATCH_NO_CHECKS_MS) {
    if (detail.capabilities.checksAlwaysReport === true) {
      events.push({
        type: "no-checks",
        data: { minutes: Math.round(awaitedMs / 60_000) },
      });
    }
    checksAwaitedSince = null;
    checksPending = false;
  } else if (checksAwaitedSince !== null) {
    checksPending = true;
  }

  const own = (detail.viewer ?? detail.author?.login)?.toLowerCase();
  const through = Date.parse(watch.remarksThrough);
  const activeAt = (remark) => remark.editedAt ?? remark.createdAt;
  // Hosts can stamp remarks to the second, so remarks at the boundary time are told apart by ID.
  const fresh = (remarks ?? []).filter((remark) => {
    const at = Date.parse(activeAt(remark));
    return (
      (at > through || (at === through && !watch.remarkIds.includes(remark.id))) &&
      remark.author?.login.toLowerCase() !== own
    );
  });
  const actionable = fresh.filter((remark) => !isReviewAcknowledgement(remark));
  if (actionable.length > 0) {
    events.push({ type: "remarks", data: { count: actionable.length } });
  }
  const latest = Math.max(through, ...fresh.map((remark) => Date.parse(activeAt(remark))));
  const atLatest = fresh.filter((remark) => Date.parse(activeAt(remark)) === latest);
  const remarksThrough = latest === through ? watch.remarksThrough : activeAt(atLatest[0]);
  const remarkIds = [
    ...(latest === through ? watch.remarkIds : []),
    ...atLatest.map((remark) => remark.id),
  ];

  // Like a failed check, a conflict or rebase a push did not resolve is news for the new head.
  const toldConflict = !headMoved && watch.conflicting;
  if (watch.awaitingBaseline !== "all" && detail.mergeability === "conflicting" && !toldConflict) {
    events.push({ type: "conflicting", data: {} });
  }
  const toldRebase = !headMoved && watch.rebaseRequired === true;
  if (watch.awaitingBaseline !== "all" && detail.rebaseRequired === true && !toldRebase) {
    events.push({ type: "needs-rebase", data: {} });
  }
  const rebaseRequired = detail.rebaseRequired ?? watch.rebaseRequired;
  // "unknown" is a host still computing after a push; only a clean answer clears a conflict.
  const conflicting =
    detail.mergeability === "unknown" ? toldConflict : detail.mergeability === "conflicting";

  // The queue's checks run on a commit of its own, so its head can stay green after the queue
  // drops it. After the first read, IDs avoid comparing the server clock with the host clock.
  // The initial read uses whole seconds to exclude historical removals.
  const removal = detail.mergeQueueRemoval;
  if (
    removal !== undefined &&
    // Merging also records a removal, up to a second before the pull request reads as merged.
    removal.reason !== "merged" &&
    removal.id !== watch.mergeQueueRemovalId &&
    (watch.mergeQueueRemovalId !== undefined ||
      Date.parse(removal.removedAt) >= Math.floor(Date.parse(watch.startedAt) / 1000) * 1000)
  ) {
    events.push({
      type: "merge-queue-removed",
      data: { reason: removal.reason ?? null },
    });
  }
  // Null records an empty baseline; historical IDs are saved without waking the watch.
  const mergeQueueRemovalId = removal?.id ?? watch.mergeQueueRemovalId ?? null;

  const commentsOnly = events.length > 0 && events.every((event) => event.type === "remarks");
  const progress = headMoved || (events.length > 0 && !commentsOnly);
  const wakes = (progress ? 0 : watch.wakes) + (commentsOnly ? 1 : 0);

  return {
    events,
    next: {
      startedAt: watch.startedAt,
      headSha,
      failedChecks,
      passed,
      passedChecks,
      owedChecks,
      awaitingApproval,
      approvalAnnounced,
      remarksThrough,
      remarkIds,
      conflicting,
      ...(rebaseRequired !== undefined && { rebaseRequired }),
      mergeQueueRemovalId,
      wakes,
      // Only a read that cannot be trusted to show the checks leaves the baseline to the next one.
      ...(checksBaseline &&
        (unread || (detail.headSha === undefined && checks.length === 0)) && {
          awaitingBaseline: "checks",
        }),
      checksAwaitedSince,
      checksPending,
    },
    exhausted: commentsOnly && wakes >= PULL_REQUEST_WATCH_WAKE_LIMIT,
  };
}

/**
 * Compare durable watch state with T3's field-by-field semantics. Optional approval and owed
 * fields use their T3 defaults; all other fields compare strictly, including null-vs-undefined.
 *
 * @param {WatchDedupe} left
 * @param {WatchDedupe} right
 * @returns {boolean}
 */
export function watchesEqual(left, right) {
  return (
    left.startedAt === right.startedAt &&
    left.headSha === right.headSha &&
    left.failedChecks.join("\n") === right.failedChecks.join("\n") &&
    left.passed === right.passed &&
    left.passedChecks.join("\n") === right.passedChecks.join("\n") &&
    (left.owedChecks ?? []).join("\n") === (right.owedChecks ?? []).join("\n") &&
    (left.awaitingApproval ?? []).join("\n") === (right.awaitingApproval ?? []).join("\n") &&
    (left.approvalAnnounced ?? false) === (right.approvalAnnounced ?? false) &&
    left.remarksThrough === right.remarksThrough &&
    left.remarkIds.join("\n") === right.remarkIds.join("\n") &&
    left.conflicting === right.conflicting &&
    left.rebaseRequired === right.rebaseRequired &&
    left.mergeQueueRemovalId === right.mergeQueueRemovalId &&
    left.wakes === right.wakes &&
    left.awaitingBaseline === right.awaitingBaseline &&
    left.checksAwaitedSince === right.checksAwaitedSince &&
    left.checksPending === right.checksPending
  );
}

const CARRIED_DEDUPE_FIELDS = [
  "headSha",
  "failedChecks",
  "passed",
  "passedChecks",
  "owedChecks",
  "awaitingApproval",
  "approvalAnnounced",
  "conflicting",
  "rebaseRequired",
  "checksAwaitedSince",
  "awaitingBaseline",
];

/**
 * Construct evaluator input for synchronous registration. Without `carried`, this is a
 * first-time baseline input and therefore has transient `awaitingBaseline: "all"`. With
 * `carried`, only T3's re-add continuation fields are copied; remarks watermarks, boundary
 * ids, merge-queue dedupe, and wake count deliberately restart. `checksPending` is positive
 * evidence resolved by the caller (fingerprint seed, or carried positive evidence when the
 * fingerprint read failed). Optional pre-read fields whose absence is semantic stay absent.
 *
 * @param {object} input
 * @param {string} input.startedAt ISO UTC watch start and evaluator baseline timestamp
 * @param {string} input.remarksThrough ISO UTC initial remarks watermark
 * @param {string|null} [input.headSha] initial head, normally null for registration input
 * @param {boolean} [input.checksPending] positive evidence that checks were pending at registration
 * @param {WatchDedupe|null} [input.carried] ended-watch dedupe for a re-add
 * @returns {WatchDedupe}
 */
export function makeInitialDedupe({
  startedAt,
  remarksThrough,
  headSha = null,
  checksPending = false,
  carried = null,
}) {
  /** @type {WatchDedupe} */
  const initial = {
    startedAt,
    headSha,
    failedChecks: [],
    passed: false,
    passedChecks: [],
    owedChecks: [],
    awaitingApproval: [],
    approvalAnnounced: false,
    remarksThrough,
    remarkIds: [],
    conflicting: false,
    checksPending: checksPending === true,
    wakes: 0,
  };
  if (carried == null) return { ...initial, awaitingBaseline: "all" };

  for (const key of CARRIED_DEDUPE_FIELDS) {
    if (carried[key] !== undefined) {
      initial[key] = Array.isArray(carried[key]) ? [...carried[key]] : carried[key];
    }
  }
  return initial;
}
