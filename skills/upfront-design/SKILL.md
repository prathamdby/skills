---
name: upfront-design
description: >
  upfront-design when a request is large enough that product behavior, system
  architecture, program design, and implementation order should be agreed with
  the user before code, or when checking a landed slice against its design.
---

# Upfront design

## Flags

| Flag or argument  | Default     | Effect                                                       |
| ----------------- | ----------- | ------------------------------------------------------------ |
| `--resume <path>` | off         | Continue a design document from its first missing phase      |
| `--check <path>`  | off         | Verify the next unticked slice against the working tree      |
| `--output <path>` | anchor path | Write the design document here                               |
| positional        | required    | The request, or a path or URL to it; ignored with `--resume` |

Resolve `<anchor>` as the absolute directory containing this `SKILL.md`; the
default output is `<anchor>/designs/<basename>-<slug>-<YYYY-MM-DD-HHmmss>.md`
with `<basename>` the repo root directory name. Write inside the repo only when
`--output` names a repo path. The three flags conflict; stop if two appear or a
value is missing.

Record after every step, persisted at `<design path>.ledger` through a temp
sibling and atomic rename and deleted on any terminal except `AWAITING_USER`:
`request | size | design path | phase | approved phases | adr offers | terminal`.
Write each approved phase to the document the same way before the next phase
starts; the document, not the conversation, holds the design. Every design
phase pauses with `AWAITING_USER`; advance only on explicit approval and re-run
the phase on requested changes. `--resume` keeps existing sections and continues
at the first missing one.

## 0. Triage

A request is small when all hold: it changes one module or package, it adds or
changes no contract, data model, or public signature, and its desired behavior
is one sentence. Small stops with `DIRECT` plus that sentence and no pause.
Otherwise create the design file from the template in `./REFERENCE.md`, locate
an existing ADR tree (`docs/adr/`, `adr/`, `doc/adr/`, `docs/decisions/`), and
note ADRs touching this area; if none exists, proceed silently. Done when size
is recorded and, for non-small work, the file has frontmatter.

## 1. Product review

Write the problem, desired behavior as observable outcomes, non-goals, and
acceptance checks. Use supplied mockups; when the work has a user-facing surface
and none was supplied, draft a text wireframe or state table labelled as a
draft. Ask the whole open-question frontier in one numbered round with a
recommended answer per question. Pause. Done when the approved section is written.

## 2. System architecture

Name each component and the contract between each pair, data models with
ownership, constraints (compatibility, performance, security, rollout), and
explicit boundaries. Include one component diagram. Flag a conflict with an
existing ADR by number instead of overriding it. Pause. Done when the approved
section is written.

## 3. Program design

List types, method signatures, module and file layout, and one call graph per
user-visible flow from Phase 1. Name every new or changed symbol; write no
bodies. When the layout is uncertain, draft two shapes, pick one, and record
the reason. Pause. Done when every acceptance check maps to named symbols and
the section is written.

## 4. Vertical slices

Order slices so each cuts through every layer, never along one, to a demoable
or verifiable behavior, fits one work session, names its verification command
or test, and lists the Phase 3 symbols it lands. Prefactoring comes first; wide
refactors run as expand then contract, so a symbol may appear in two slices.
Multi-repo work names the order across repos. Pause. Done when every Phase 3
symbol is in a slice, every slice lands a symbol, and the section is written
with one unticked checkbox per slice.

## 5. Finalize

Set `status: approved`. For each decision recorded in Phases 2 and 3, offer an
ADR only when all three hold: hard to reverse, surprising without context,
chosen over a real alternative. On confirmation write it with the ADR template
in `./REFERENCE.md` into the tree found in Step 0, or `docs/adr/` created
lazily, in the repo that owns the decided component. Report the design path,
ADR paths, and the next step: `/peer-review` on the design, then `--check` after
each slice. Done when all four sections exist and every offer is written or declined.

## Check

With `--check`, take the first unticked slice and run its verification command.
Compare its promised symbols against the working tree by name and signature. On
pass, tick the slice and append a one-line result. On mismatch, add
`promised X; landed Y; reason` under the slice and leave it unticked. Report
with the format in `./REFERENCE.md`; never edit product files. Done when the
slice is ticked or has a deviation line and the report names the next unticked
slice or `all slices complete`.

Terminal values: `DIRECT` (no-op success for routers), `AWAITING_USER`,
`DESIGNED`, `CHECKED`, `BLOCKED`. Never implement here; designs hold no bodies.
