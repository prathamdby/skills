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
requirements, pointed to by path, URL, pasted text, or attached IDE context.
If none is provided, report `BLOCKED: review target required` and ask for one
pointer. Never reconstruct a target from conversation memory.

Record:
`target | requirements | evidence read | findings | verdict | edit authority`.

Done when the target and requirements are fixed, or the blocked report is sent.

## 2. Gather bounded evidence

Read the target, requirements, directly affected contracts, relevant source,
and current tests. Read history only when the target cites a past failure or a
current claim needs it. Search real callers of every mode, prop, wrapper, route
alias, and fallback the plan preserves. Stop gathering when every requirement,
compatibility claim, and candidate risk has a source pointer. Do not survey
unrelated architecture.

After interruption, confirm target and requirements are unchanged before using
the ledger; if either changed, discard the ledger and restart Step 1.

Done when each review claim can cite a requirement, target section, source
path, test, or history artifact.

## 3. Analyze (exhaustive)

Map each requirement to a proposed step and verification. Check boundaries,
failure and rollback paths, ordering, compatibility, security, performance,
and test coverage. Rank every finding by probability times impact. Do not
promote a theoretical concern over an evidenced failure. Treat unsupported
security, compatibility, or performance claims in the target as findings.

**Zero tech debt.** Rework the proposal from the intended end state, not the
historical path that produced the patch:

1. State the intended end state in one or two sentences.
2. Drop any mode, prop, wrapper, route alias, or fallback with no current
   caller. Do not keep dead compatibility.
3. Prefer one clear product surface over mode flags. Split only on obvious
   boundaries: state, layout, controls, or domain commands.
4. Move shared rules (feature flags, permissions, route gating, URL state,
   command naming) to one place. Flag duplication across pages or views.
5. Require verification of the new flow and of deleted assumptions that affect
   navigation, permissions, or persisted state.

Also flag a generic framework for one feature, names from implementation
history not product intent, a refactor that leaves the final shape incoherent,
and optimizing for the smallest diff over the code that should exist.

Surface **every** material finding. Do not stop at the first blocker. Do not
cap the list. Omit style and preference nits only.

Verdict mapping (after ranking the full list):

- no material findings: `Ship it.`
- only independent repairable blockers: `Fix the blockers first, then ship.`
  Repairable means at most three steps per blocker without changing approach
  or requirements.
- wrong approach, missing core requirements, or several coupled blockers:
  `Needs rework.`

Done when every material requirement and zero-tech-debt check has a finding or
an explicit pass, and the verdict follows this mapping.

## 4. Report

Write exactly four sections:

1. `## End state`: the intended end state in one or two sentences.
2. `## Findings`: ranked worst-first list of every material
   `- <finding> → <impact>` bullet with a citation, or `None found.` No
   count cap.
3. `## Fix`: numbered steps covering each repairable blocker in rank order,
   or the first rework decision, or `None.`
4. `## Verdict`: exactly one mapped sentence and no added explanation.

Done when the four-section contract holds and every finding has a citation.

## 5. Optional plan update

Edit only when the user explicitly requested an update in the review request or
confirms after reading it. Apply only the reported Fix; broad rework requires a
new approved design. Re-read the diff and report changed paths.

Terminal values: `BLOCKED` (missing target), `REVIEWED` (analysis-only),
`AWAITING_CONFIRMATION` (needs confirm), `UPDATED` (verified plan edit).
