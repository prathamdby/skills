---
name: peer-review
description: >
  peer-review when deciding whether an implementation plan, design, or proposed
  change is ready to build.
---

# Peer review

There are no flags. A review request authorizes analysis, not file edits.

## 1. Resolve the review target

Require a plan, design, or proposed-change artifact and its governing
requirements. If none is provided or discoverable, report
`BLOCKED: review target required` and ask for one pointer. Never reconstruct a
target from conversation memory.

Record:
`target | requirements | evidence read | critical risk | verdict | edit authority`.

Done when the target and requirements are fixed, or the blocked report is sent.

## 2. Gather bounded evidence

Read the target, requirements, directly affected contracts, relevant source,
and current tests. Read history only when the target cites a past failure or a
current claim needs it. Stop gathering when every requirement and candidate
risk has a source pointer. Do not survey unrelated architecture.

After interruption, confirm the target and requirements have not changed before
using the ledger.

Done when each review claim can cite a requirement, target section, source
path, test, or history artifact.

## 3. Analyze

Map each requirement to a proposed step and verification. Check boundaries,
failure and rollback paths, ordering, compatibility, security, performance,
and test coverage. Rank by probability times impact. Do not promote a
theoretical concern over an evidenced failure.

Select at most one critical risk:

- no critical risk: `Ship it.`
- one repairable blocker: `Fix the critical risk first, then ship.`
- wrong approach, missing core requirements, or several coupled blockers:
  `Needs rework.`

Done when the verdict follows this mapping and every material requirement has
been checked.

## 4. Report

Write exactly four sections:

1. `## Critical risk`: one evidence-backed paragraph, or `None found.`
2. `## Other gaps`: `- <gap> → <impact>` bullets, or `None.`
3. `## Fix`: numbered steps for the critical risk or first rework decision, or
   `None.`
4. `## Verdict`: exactly one mapped sentence and no added explanation.

Done when the four-section contract holds and every finding has a citation.

## 5. Optional plan update

Edit only when the user explicitly requested an update before the review or
confirms after reading it. Apply only the reported Fix; broad rework requires a
new approved design. Re-read the diff and report changed paths.

Terminal values are `REVIEWED`, `BLOCKED`, and `AWAITING_CONFIRMATION`.
