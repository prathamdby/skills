---
name: upfront-design
description: >
  upfront-design when a request is large enough that product behavior, system
  architecture, program design, and implementation order should be agreed with
  the user before code, or when given an existing design to resume or check.
---

# Upfront design

The positional argument is the request, or the path of an existing design: a
file with `request` and `status` frontmatter and a `# Design:` title. `draft`
resumes at the first missing section, or at a phase the user names, deleting
later sections; `approved` checks the next open milestone; any other status
is `BLOCKED: unknown design status`. Anything else starts a new design.

Resolve `<anchor>` as the absolute directory containing this `SKILL.md`. Write
new designs to `<anchor>/designs/<basename>-<slug>-<YYYY-MM-DD-HHmmss>.md`,
with `<basename>` the root directory name of the first repo, never inside it.

Record after every step, persisted at `<design path>.ledger` through a temp
sibling and atomic rename and deleted on any terminal except `AWAITING_USER`:
`request | size | design path | phase | approved phases | adr offers | terminal`.
Write each approved phase to the document the same way before the next phase
starts; the document, not the conversation, holds the design. Each phase
pauses with `AWAITING_USER` until the user approves or asks for changes.

## 0. Triage

A request is small when all hold: it changes one module or package, it adds or
changes no contract, data model, or public signature, and its desired behavior
is one sentence. Small stops with `DIRECT` plus that sentence and no pause.
Otherwise create the design file from the template in `./REFERENCE.md`, locate
an existing ADR tree (`docs/adr/`, `adr/`, `doc/adr/`, `docs/decisions/`), and
note ADRs touching this area; if none exists, proceed silently. Done when size
is recorded and, for non-small work, the file has frontmatter.

## 1. Product review

Write Problem to solve with concrete user pain, Success with measurable
signals, and Proposed solution with a bold one-line shape, a mockup, and a
delivery paragraph. Use supplied mockups; when the work has a user-facing
surface and none was supplied, draft a text wireframe or state table labelled
as a draft. Ask the whole open-question frontier in one numbered round with a
recommended answer per question. Pause. Done when the approved section is written.

## 2. System design

State the shape in one bold sentence and the existing pattern it follows. Add
a layer map of paths marked NEW or CHANGED with a role each, the data sources
and constraints with their cost reason, and a sequence diagram with a band per
phase. Flag a conflict with an existing ADR by number instead of overriding
it. Pause. Done when the approved section is written.

## 3. Program design

For each boundary write its thesis, the pattern it follows, a usage snippet
with real signatures, call sites grouped by boundary, a file tree with a role
per file, a call-site tree marking added calls, and a call graph from the entry
point. Write no bodies. When the layout is uncertain, draft two shapes, pick
one, and record the reason. Pause. Done when every Success outcome maps to
named symbols and the section is written.

## 4. Vertical slices

Order milestones so each is one PR that cuts through every layer, stub to mock
to wire to logic to error handling, names its automated commands and manual
steps, and lists the Phase 3 symbols it lands. The checkbox is the done signal;
only the user marks a milestone deferred or skipped. Prefactoring comes first;
wide refactors run as expand then contract, so a symbol may appear in two
milestones. Multi-repo work names the order across repos. Pause. Done when
every Phase 3 symbol is in a milestone, every milestone has a command or step,
and the section is written with one open box per milestone.

## 5. Finalize

Set `status: approved`. For each decision recorded in Phases 2 and 3, offer an
ADR only when all three hold: hard to reverse, surprising without context,
chosen over a real alternative. On confirmation write it with the ADR template
in `./REFERENCE.md` into the tree found in Step 0, or `docs/adr/` created
lazily, in the repo that owns the decided component. Report the design path,
ADR paths, and the next step: `/peer-review` on the design, then pass the
approved design after each milestone; to revise, set `status: draft`, name the
phase, and pass the path. Done when all four sections exist and every offer is
written or declined.

## Check

Given an approved design, take the first open milestone that is not deferred
or skipped. Run its automated commands and tick each that passes. Compare
promised symbols to the working tree by name and signature. If any manual box
is open, report the steps with expected results and stop with `AWAITING_USER`.
When every box is ticked and symbols match, tick the milestone; on mismatch
add `promised X; landed Y; reason` and leave it open. Use the report format in
`./REFERENCE.md`; never edit product files. Done when the milestone is ticked,
awaiting manual confirmation, or has a deviation line, and the report names
the next open milestone or `all milestones complete` with deferred symbols.

Terminal values: `DIRECT` (no-op success for routers), `AWAITING_USER`,
`DESIGNED`, `CHECKED`, `BLOCKED`.
