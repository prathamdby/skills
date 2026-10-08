# Design document

Store request, absolute repos, created date, and status draft in frontmatter;
title is `# Design: <short title>`. Add only the current approved phase,
leaving later sections absent until their approval.

Use these sections, with supporting fences beside their prose:

- Product review: Problem to solve, Success and how to measure it, Proposed
  solution. Include concrete pain, observable outcomes, a draft/supplied mockup,
  and how the change is reached and delivered.
- System design: shape and inherited pattern; NEW/CHANGED paths and roles;
  data sources, constraints/cost reasons; ADR conflicts; phase-banded sequence.
- Program design: each boundary's cited pattern or assumption, changed
  contract, constraints, real usage/signatures, and outcomes including failures.
- Vertical slices: one reviewable PR per milestone with layers, symbols,
  expected outcomes, automated assertion boxes, manual observed-result boxes,
  and deviations. Mark deferred/skipped only on user instruction.
- Decisions: each choice and its ADR path or document-only rationale.

## Wiring views

When multiple boundaries, changed dispatch/order, or async handoffs leave
wiring unclear, choose the smallest view: caller map with added call sites,
call graph from the affected entry using real symbols, or sequence showing
order/handoffs signatures cannot express. Do not emit every view by default.
