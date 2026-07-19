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
mode". Keep this ledger after each numbered step:

`task | criteria | chunk owner/model/strikes | verified | blocked | waivers`

After an interruption, rebuild it from diffs, task results, and test output,
then re-verify any evidence affected by changed files or tools. Refresh the
roster and reassign any chunk whose delegate disappeared. Never resume from
memory alone. Defer unrelated work unless the user explicitly replaces or
queues the active task.

## 1. Muster

Discover the available subagent types, write access, and model selection
mechanism. Pick the cheapest model that can satisfy each chunk and record the
choice. Refresh and revalidate assignments after a resume or tool change.

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
run relevant tests or builds, then test interactions between chunks. For a
chunk failure: first re-brief its owner with evidence, then replace its
delegate, then mark it blocked on the third failure. Record each failed check
as that chunk's next strike. For an integration failure, open a coordination
brief naming each implicated chunk and the failing evidence; count each
chunk's strikes separately. Never fix it yourself.

Done when each criterion is `VERIFIED`, `BLOCKED` with evidence, or waived by
the user by name and recorded in the ledger, and integration has passed or is
itself blocked or waived by name.

## 6. Report

Lead with the overall result, including integration status. List verified,
blocked, and waived criteria with their evidence. If Step 2 corrected the
request, add:

`Deviation: the task said X; evidence showed Y; I delivered Z instead.`

Done when every report claim points to evidence from this run and no subagent
remains untracked.

## Constraints

- Never edit product files in this mode.
- Never delegate scoping, verification, integration, or the final judgment.
- Do not claim success from a delegate report alone.
