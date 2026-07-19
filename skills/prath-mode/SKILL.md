---
name: prath-mode
description: >
  Route user-invoked work to the owning skill in prathamdby/skills, including
  multi-step delivery workflows.
disable-model-invocation: true
---

# Prath mode

The leaf owns its triggers, flags, procedure, and terminal states. Read it
before acting. Never recreate a missing leaf or copy its procedure here.

## Routing map

| Immediate action | Leaf |
|---|---|
| Commit scoped changes | `commit` (`../commit/SKILL.md`) |
| Remove code slop | `deslop` (`../deslop/SKILL.md`) |
| Create or update a PR | `make-pr` (`../make-pr/SKILL.md`) |
| Address PR feedback | `fix-pr` (`../fix-pr/SKILL.md`) |
| Review an implementation plan | `peer-review` (`../peer-review/SKILL.md`) |
| Explain a diff as HTML | `explain-diff` (`../explain-diff/SKILL.md`) |
| Map or refresh the current repo | `recon` (`../recon/SKILL.md`) |
| Clone or search an external repo | `box` (`../box/SKILL.md`) |
| Run one task in an external CLI agent | `assign` (`../assign/SKILL.md`) |
| Coordinate current-harness subagents | `orchestrate` (`../orchestrate/SKILL.md`) |
| Save or resume session state | `handoff` (`../handoff/SKILL.md`) |

For one action, route to its leaf. Use `orchestrate` for several in-harness
delegates and `assign` for one external CLI process. Use a chain only when the
request asks for its complete terminal outcome.

## Workflow chains

| Requested outcome | Ordered owners | Complete when |
|---|---|---|
| Ship planned work | `peer-review` → implementation → `deslop` → `commit` → `make-pr` | PR URL verified |
| Save current work | `deslop` when requested → `commit` | new commit verified |
| Finish PR feedback | `fix-pr` | its stable terminal state |
| Understand current repo | `recon` | memory and report verified |
| Research external code | `box` | cited answer returned |
| End or resume work | `handoff` | create or resume terminal state |

Implementation is normal agent work, not a leaf. `fix-pr` already owns its
fix, commit, push, re-hunt, and reply loop; never append those actions.

## 1. Match

Record a run ledger:

`route | current owner | completed owners | terminal condition`

If no route matches, ask one question about the intended outcome. Done when one
leaf or chain and its terminal condition are recorded.

## 2. Verify installation

Resolve each leaf path relative to this file and verify it exists before the
chain starts and before its turn. If any are missing, report every missing name
and checked path, then stop with:
`npx skills@latest add prathamdby/skills`

Done when all required paths exist or the missing-skill report is sent.

## 3. Invoke and resume

Read the current leaf in full and run it to one of its terminal states. Advance
only after success or no-op; pause the chain on blocked or waiting. After an
interruption, verify the last owner's artifacts before continuing.

Done when the recorded chain terminal condition is observed or the current
leaf has reported why progress paused.
