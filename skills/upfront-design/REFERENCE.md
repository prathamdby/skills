# Upfront design reference

Load the section for the step being entered. Rules live in `SKILL.md`; this
file holds templates.

## Design document template

Load in Step 0 when creating the file. Write one section per approved phase;
leave later sections absent until their phase is approved. Every slice starts
unticked. Store repo roots as absolute paths.

```markdown
---
request: <one-line request, or the path or URL it came from>
repos:
  - <absolute repo root>
created: <YYYY-MM-DD>
status: draft
---

# Design: <short title>

## Product review

- Problem: <who is blocked and how>
- Desired behavior: <observable outcomes, one per bullet>
- Non-goals: <what this work will not do>
- Acceptance checks: <numbered; each names an observable result>
- Mockup: <supplied path, or a draft wireframe or state table labelled draft>

## System architecture

- Components: <name and responsibility, one per bullet>
- Contracts: <component A to component B: interface and data shape>
- Data models: <entity, fields, owning component>
- Constraints: <compatibility, performance, security, rollout>
- Boundaries: <what stays outside this design>
- Diagram: <one component diagram>
- ADR conflicts: <ADR-NNNN and the conflict, or none>

## Program design

- Types: <name and fields, one per bullet>
- Signatures: <module.function(args) -> return, one per bullet>
- Layout: <path and purpose for each new or changed file>
- Call graphs: <one per Phase 1 outcome, entry to exit>
- Alternatives: <second shape considered and why it lost, or none>

## Vertical slices

- [ ] S1 <behavior it delivers>
  - Symbols: <Phase 3 names landed here>
  - Verify: `<command or test>`
  - Deviations: <none, or promised X; landed Y; reason>
- [ ] S2 ...

## Decisions

- <decision>: ADR at <absolute path>, or recorded here only
```

## ADR template

Load in Step 5 only, after a decision passes all three tests: hard to reverse,
surprising without context, chosen over a real alternative.

Qualifying categories: architectural shape, integration pattern between
components, technology that would take a quarter to swap, boundary and scope
no-s, deliberate deviation from the obvious path, non-obvious rejected
alternative.

Numbering: scan the ADR tree for the highest `NNNN-` prefix and add one. Name
the file `NNNN-<slug>.md`. Create the tree only when writing the first ADR.

```markdown
# <Short title of the decision>

<One to three sentences: the context, the decision, and why.>
```

Optional sections, added only when they carry information the body lacks:
`Status` (`proposed`, `accepted`, `deprecated`, `superseded by ADR-NNNN`),
`Considered Options`, `Consequences`.

## Check report format

Load in Check only.

```text
slice: S<n> <behavior>
command: <verification command>
exit: <code>
symbols:
  <promised name and signature> | <landed, missing, or changed: detail>
result: ticked | deviation
next: S<n+1> | all slices complete
```
