---
name: prath-mode
description: >
  prath-mode when routing goal-shaped work to a playbook that sequences
  prathamdby/skills leaves, including multi-step delivery chains.
disable-model-invocation: true
---

# Prath mode

The leaf owns its triggers, options, procedure, and terminal states. Read it
before acting. Never recreate a missing leaf or copy its procedure here.
Playbooks under `playbooks/` are predetermined routes only.

## Playbooks

- `design` — design before code; check a milestone (`playbooks/design.md`)
- `review-plan` — review a plan or proposal (`playbooks/review-plan.md`)
- `deslop` — remove slop (`playbooks/deslop.md`)
- `commit` — commit only (`playbooks/commit.md`)
- `open-pr` — create or update a PR (`playbooks/open-pr.md`)
- `finish-pr` — address PR feedback (`playbooks/finish-pr.md`)
- `inspect-pr` — inspect PR/CI or one reply (`playbooks/inspect-pr.md`)
- `understand-repo` — map current repo (`playbooks/understand-repo.md`)
- `research-external` — clone/search external repo (`playbooks/research-external.md`)
- `orchestrate` — coordinate subagents (`playbooks/orchestrate.md`)
- `session` — save or resume session (`playbooks/session.md`)
- `cursor-agent` — Cursor Agent CLI (`playbooks/cursor-agent.md`)
- `claude-code` — Claude Code CLI (`playbooks/claude-code.md`)
- `codex` — Codex CLI (`playbooks/codex.md`)
- `todoist` — Todoist task (`playbooks/todoist.md`)
- `ship` — implement → deslop → commit → make-pr (`playbooks/ship.md`)
- `design-then-ship` — design, milestones, then ship (`playbooks/design-then-ship.md`)
- `save-work` — optional deslop → commit (`playbooks/save-work.md`)

Match one immediate action playbook before a chain. Review-shaped asks stay on
`review-plan` (never prepend to `ship`). Orientation or reply-only →
`inspect-pr`; fix, push, or handle feedback → `finish-pr`. Playbook
`inspect-pr` never continues into `finish-pr`. Leaf `gh` never continues into
leaf `fix-pr`; `fix-pr` loads `gh` for GitHub I/O. `deslop` is required in
`ship`, optional in `save-work`. Implementation is parent work, not a leaf.
Resolve mixed staged/unstaged paths before `deslop`.

## 1. Match

Record: `route | current owner | completed owners | design path | diff/tests | terminal`

Open the matched `playbooks/<id>.md` and copy its steps into the todo list
verbatim. On conflict between two actions or two chains, ask one question.
If nothing matches, ask one intended-outcome question; if still large, use
`design`. `DIRECT` from `upfront-design` is no-op success; `DESIGNED` and
`CHECKED` are success and the chain continues on either. Done when one
playbook and its `complete_when` are recorded.

## 2. Verify installation

From `playbooks/`, resolve `leaf:<name>` as `../../<name>/SKILL.md` or
`../../../personal/<name>/SKILL.md`. Verify every leaf in the matched
playbook before the chain starts and before its turn. Missing → report names
and paths, then stop with `npx skills@latest add prathamdby/skills`.

Done when all required paths exist or the missing-skill report is sent.

## 3. Invoke and resume

Read the current leaf in full and run it to a terminal state. Advance only
after success or no-op; pause on blocked or waiting. After interruption,
verify the last owner's artifacts before continuing. Before `make-pr`,
require a clean tree. For `parent:implementation`, record planned-work diff
and test evidence in the ledger.

Done when `complete_when` holds or the current leaf reported why it paused.
