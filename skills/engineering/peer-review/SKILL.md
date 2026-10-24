---
name: peer-review
description: >
  peer-review to judge whether a plan, design, or proposed change is ready to build.
---

# Peer review

Analysis, not edit authority. Judge the stated problem before the change.

## 1. Resolve

Require the target artifact and governing requirements by path, URL, pasted
text, or attached context. None → `BLOCKED: review target required`, asking
for one pointer. Do not reconstruct the target from conversation memory.
If the stated problem is ambiguous, keep the named target and record the
ambiguity in Findings.
Record `target | requirements | evidence | findings | verdict | edit authority`.
Done when target and requirements are fixed or the blocked report is sent.

## 2. Ground

When the target is the current change, read that diff before any whole file.
Read the target, the requirements, and the affected contracts, source, and
tests before a judgment. Leave unread code out of Findings.
History is reached only for a cited past failure or a current claim that
needs it. Stop when each requirement and each candidate concern has evidence.
Unrelated architecture is outside scope. Label each load-bearing claim
checked, inferred, or supplied and unchecked. A verified code fact does not
verify a product conclusion. A claim that depends on a dependency stays
unchecked until its manifest or lockfile and the dependency's own source or
docs are read. On resume, verify the target and the requirements. A change
restarts Resolve.
Done when each claim cites requirements, target, source, test, or history,
and carries its label.

## 3. Review

On every target, answer in this order.
1. Does the proposal solve the stated problem?
2. Which high-risk behavior changes, on purpose or by accident?
3. Which simpler design keeps that behavior with fewer concepts?
4. Which next change is the smallest one the evidence supports?

The fourth answer names one next change. It does not reorder Fix.
High-risk work touches persistence, permissions, security boundaries,
concurrency, retries, caching, migrations, public APIs, billing, data loss,
schema, type boundaries, or a contract that crosses a process. Also check
failure and rollback, ordering, compatibility, performance, and tests.
Map every requirement to proposed work and to verification.
A new concept has to pay for itself against a sound local pattern. When the
local pattern is poor, unsafe, or confusing, name a clearer precedent and say
where this change leaves that pattern. These heuristics are not a mandate to
rewrite working code. When the design choice is non-obvious, weigh what is
required, how long the change will live, how easy it is to undo, and who
will maintain it.
Group findings that share one root cause. Surface every distinct material
finding, with no count cap. Omit preference nits.
Put any assumption, default, or scope choice that changes the recommendation
inside the finding that depends on it, and say how the recommendation changes
if the caller rejects that choice.
Unsupported security, compatibility, or performance claims are findings.
An evidenced failure outranks a theoretical concern.
Rank by probability times impact.

Verdict, after the full list. No material findings means `Ship it.`
Independent repairable blockers mean `Fix the blockers first, then ship.`
Each repair stays within three steps and keeps the approach and the
requirements. A wrong approach, a missing core requirement, or coupled
blockers mean `Needs rework.`
Done when every material requirement has a finding or an explicit pass.

## 4. Report

Exactly three sections.
- `## Findings` lists every ranked `finding → impact` bullet with a citation
  and a label, or `None found.`
- `## Fix` lists numbered repairs in rank order, or the first rework
  decision, or `None.` When the verdict is `Needs rework.`, name one
  alternative and the evidence that would reverse it.
- `## Verdict` is exactly one mapped sentence, with no further explanation.
Done when the format holds and every finding still has its evidence.

## Optional update

Edit only when the user requested an update or confirms after the report.
Apply only the reported Fix. Broad rework needs a newly approved design.
Reread the diff and the report paths. Done when the authorized changes match
that Fix.

Terminals: `BLOCKED` (missing target), `REVIEWED` (analysis-only),
`AWAITING_CONFIRMATION` (update awaits approval), `UPDATED` (verified
authorized edit).
