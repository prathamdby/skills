---
name: upfront-design
description: >
  upfront-design when a request is large enough that product behavior, system
  architecture, program design, and implementation order should be agreed with
  the user before code, or when given an existing design to resume or check.
---

# Upfront design

The request is the work, or the path of an existing design: a
file with `request` and `status` frontmatter and a `# Design:` title. `draft`
resumes at the first missing section, or at a phase the user names, deleting
later sections; `approved` checks the next open milestone; any other status
is `BLOCKED: unknown design status`. Anything else starts a new design.

Resolve `<anchor>` as the absolute directory containing this `SKILL.md`. Write
new designs to `<anchor>/designs/<basename>-<slug>-<YYYY-MM-DD-HHmmss>.md`,
with `<basename>` the root directory name of the first repo, never inside it.

After a design path exists, record after every step at `<design path>.ledger`
through a temp sibling and atomic rename; delete it on any terminal except
`AWAITING_USER`:
`request | size | design path | phase | approved phases | adr offers | terminal`.
Write each approved phase to the document the same way before the next phase
starts. Each phase pauses with `AWAITING_USER` until approved or revised.

## 0. Triage

A request is small when all hold: it changes one module or package, it adds or
changes no contract, data model, or public signature, and its desired behavior
is one sentence. Small stops with `DIRECT` plus that sentence and no pause; do
not write a design-path ledger. Otherwise create the design file from
`./REFERENCE.md`, locate an ADR tree (`docs/adr/`, `adr/`, `doc/adr/`,
`docs/decisions/`), and note ADRs touching this area; if none exists, proceed
silently. Done when size is recorded and, for non-small work, the file has
frontmatter.

## 1. Product review

Write Problem to solve with concrete user pain, Success with measurable
signals, and Proposed solution with a bold one-line shape, a mockup, and a
delivery paragraph. Use supplied mockups; when the work has a user-facing
surface and none was supplied, draft a text wireframe or state table labelled
as a draft. Ask the whole open-question frontier in one numbered round with a
recommended answer per question. Pause. Done when the approved section is written.

## 2. System design

State the shape in one bold sentence and the pattern it follows. Add a layer
map of paths marked NEW or CHANGED with a role each, data sources and
constraints with their cost reason, and a sequence diagram with a band per
phase. Flag ADR conflicts by number instead of overriding them. Pause. Done
when the approved section is written.

## 3. Program design

For each boundary, cite a repo pattern or mark an assumption; write changed
contracts, constraints, usage with real signatures, and file roles, not bodies.
When layout is uncertain, compare two shapes, pick one, and record why.
When multiple boundaries or changed dispatch/order leave wiring unclear, use
Wiring views in `./REFERENCE.md`; otherwise omit extra trees and graphs.
Pause. Done when every Success outcome maps to named symbols and an expected
result, and the approved section is written.

## 4. Vertical slices

After needed prefactoring, start with the thinnest end-to-end slice exposing
contracts and checks. Each milestone is one reviewable PR cutting layers, with
Phase 3 symbols, expected outcomes including relevant failures, and assertions
or manual results proving them. Only the user defers or skips milestones;
wide refactors expand then contract, so symbols may appear in two milestones.
Multi-repo work names repo order. Pause. Done when every Phase 3 symbol is in
a milestone, each has outcome-linked commands or steps, and one open checkbox.

## 5. Finalize

Set `status: approved`. For each decision recorded in Phases 2 and 3, offer an
ADR only when all three hold: hard to reverse, surprising without context,
chosen over a real alternative. On confirmation write it with the ADR template
in `./REFERENCE.md` into the tree found in Step 0, or `docs/adr/` created
lazily, in the repo that owns the decided component. Report the design path,
ADR paths, and next steps (`/peer-review`, then pass the design after each
milestone; to revise, set `status: draft`, name the phase, pass the path).
Done with `DESIGNED` when Product review, System design, Program design,
Vertical slices, and Decisions exist and every offer is written or declined.

## Check

Take the first open, non-deferred/non-skipped milestone. If expected outcomes
are absent, apply Legacy outcomes in `./REFERENCE.md` before checking.
Show each command; run only after the user approves that exact string.
Tick checks only with evidence of expected outcomes, not exit status alone.
Compare symbol names and signatures. Open manual boxes → report steps and
`AWAITING_USER`. Tick the milestone only when every box passes and symbols
match; otherwise record `promised X; landed Y; reason`, leave open.
Use Check report in `./REFERENCE.md`; never edit product files. Done with
`CHECKED` when ticked or all complete; otherwise `AWAITING_USER`.

Terminal values: `DIRECT` (no-op success for routers), `AWAITING_USER`, `DESIGNED`, `CHECKED`, `BLOCKED`.
