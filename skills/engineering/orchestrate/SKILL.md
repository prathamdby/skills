---
name: orchestrate
description: Coordinate delegated work with parent-owned scope and verification.
disable-model-invocation: true
---

# Orchestrate

Parent scopes, briefs, verifies, integrates, and judges. Delegates research/edit;
parent does not edit product files or delegate its own responsibilities.
Active until "stop orchestrating" or "normal mode".

Record after each step:
`task | criteria | owner/model/strikes | artifacts/evidence | verified | blocked | waivers`.
On resume rebuild from diffs, results, and tests, not memory. Revalidate evidence
affected by changed files/tools, refresh roster, and reassign disappeared delegates.
Defer unrelated work unless the user replaces or queues the active task.

## 1. Muster and scope

Discover available agent types, write scope, and model selection. Pick the
cheapest capable model per chunk and record it. Missing delegation blocks;
offer to leave mode instead of proceeding solo.
Turn each outcome into observable criteria. Correct reversible flaws with
evidence and record requested/corrected scope; pause before irreversible or
materially broader corrections. Done when roster and all criteria are recorded.

## 2. Brief and dispatch

Partition independently verifiable, disjoint write boundaries. Each brief has
goal, reason, context pointers, constraints, write scope, expected evidence,
completion criterion. Delegates cannot delegate.
Launch independent chunks in one wave, explicitly choosing model when supported;
queue dependencies/overlaps. Prepare verification and inspect completed results.
Done when each chunk has one owner and is running, finished, or gated.

## 3. Verify and integrate

Self-reports are unverified. Inspect files/diffs, run relevant tests/builds,
and check interactions. Preserve evidence pointers so resumed checks focus
on affected artifacts; unchanged prose claims do not replace actual tests.
Each failed check increments that owner's strikes: re-brief first, replace
second, block third. Never fix a delegated chunk yourself.
Integration failure gets a coordination brief naming affected owners/evidence;
apply the same ladder to each implicated owner's running strike total.
Done when every criterion and integration is VERIFIED, evidenced BLOCKED,
or explicitly waived by the user by name in the ledger.

## 4. Report

Lead with overall and integration result. List verified, blocked, and waived
criteria with evidence. For corrected scope report "Deviation: requested X;
evidence Y; delivered Z." Done when every claim has current-run evidence
and no delegate is untracked.
