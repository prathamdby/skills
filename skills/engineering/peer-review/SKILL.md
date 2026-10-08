---
name: peer-review
description: >
  peer-review to judge whether a plan, design, or proposed change is ready to build.
---

# Peer review

Analysis, not edit authority.

## 1. Resolve

Require the target artifact and governing requirements by path, URL, pasted
text, or attached context. None → `BLOCKED: review target required`, asking
for one pointer. Do not reconstruct the target from conversation memory.
Record `target | requirements | evidence | findings | verdict | edit authority`.
Done when target and requirements are fixed or the blocked report is sent.

## 2. Ground

Read the target, requirements, affected contracts/source/tests. History is
reached only for a cited past failure or a current claim needing it. Stop
when each requirement and candidate concern has evidence; unrelated
architecture is outside scope. On resume, verify target/requirements;
changes restart Resolve instead of reusing stale findings.
Done when each claim cites requirements, target, source, test, or history.

## 3. Review

Map every requirement to proposed work and verification. Check boundaries,
failure/rollback, ordering, compatibility, security, performance, and tests.
Surface every material finding, without a count cap; omit preference nits.
Unsupported security/compatibility/performance claims are findings, but an
evidenced failure outranks a theoretical concern. Rank by probability × impact.

Verdict: no material findings → `Ship it.`; independent repairable blockers
→ `Fix the blockers first, then ship.` (each <= three steps, unchanged approach/
requirements); wrong approach, missing core requirements, or coupled blockers
→ `Needs rework.`
Done when every material requirement has a finding or explicit pass.

## 4. Report

Exactly three sections:
- `## Findings`: every ranked `finding → impact` bullet with citation,
  or `None found.`
- `## Fix`: numbered repairs in rank order, first rework decision, or `None.`
- `## Verdict`: exactly one mapped sentence, no additional explanation.
Done when the format and every finding's evidence hold.

## Optional update

Edit only when the user requested updating or confirms after the report.
Apply only the reported Fix; broad rework needs a newly approved design.
Reread the diff and report paths. Done when authorized changes match that Fix.

Terminals: `BLOCKED` (missing target), `REVIEWED` (analysis-only),
`AWAITING_CONFIRMATION` (update awaits approval), `UPDATED` (verified
authorized edit).
