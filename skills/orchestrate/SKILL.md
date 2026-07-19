---
name: orchestrate
description: >
  Orchestrate user-invoked tasks that should be split across cheaper subagents
  while the main agent remains responsible for scope and verification.
disable-model-invocation: true
---

# Orchestrate

The positional argument is the task. There are no flags. The main agent scopes,
briefs, verifies, integrates, and reports. Subagents research and edit.

## Persistence

This mode stays active until the user says "stop orchestrating" or "normal
mode". Keep this ledger after every gate:

`task | acceptance criteria | active chunks | verified chunks | blocked chunks`

After an interruption, rebuild the ledger from diffs, task results, and test
output. Re-verify the last completed gate. Never resume from memory alone.

## 1. Muster

Discover the available subagent types, write access, and model selection
mechanism. Pick the cheapest model that can satisfy each chunk. Refresh the
roster after a resume or tool change.

If no subagent tool exists, report `BLOCKED: orchestration unavailable` and
offer to leave this mode. Do not proceed solo while this mode is active.

Done when the ledger records the usable roster and model controls, or the
blocked report has been sent.

## 2. Scope

Translate the task into observable acceptance criteria. Check for a request
that conflicts with evidence, builds the wrong result, or causes harm. Correct
a reversible flaw and record the original request, evidence, and correction.
Pause before any irreversible or materially broader correction.

Done when every requested outcome has a criterion and each correction is
recorded.

## 3. Brief

Split work at independently verifiable boundaries. Each brief contains the
goal, reason, context pointers, constraints, write scope, expected evidence,
and completion criterion. Give concurrent writers disjoint paths. A delegate
may not delegate again.

Done when every chunk has one owner and all seven brief fields.

## 4. Dispatch

Dispatch independent chunks in one parallel wave. Set the model explicitly
when supported. Queue dependent or overlapping writes. While delegates run,
prepare verification commands and inspect completed results.

Done when every chunk is running, finished, or queued behind a named gate.

## 5. Verify and integrate

Treat every self-report as unverified. Inspect the resulting files and diff,
run relevant tests or builds, then test interactions between chunks. On the
first failure, re-brief with evidence. On the second, replace the delegate and
tighten the brief. On the third, mark the chunk blocked. Never fix it yourself.

Done when each criterion is `VERIFIED`, `BLOCKED` with evidence, or explicitly
waived by the user, and integrated checks have run.

## 6. Report

Lead with the outcome. List verified, blocked, and waived criteria with their
evidence. If Step 2 corrected the request, add:

`Deviation: the task said X; evidence showed Y; I delivered Z instead.`

Done when every report claim points to evidence from this run and no subagent
remains untracked.

## Constraints

- Never edit product files in this mode.
- Never delegate scoping, verification, integration, or the final judgment.
- Do not claim success from a delegate report alone.
