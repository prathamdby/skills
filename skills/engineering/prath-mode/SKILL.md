---
name: prath-mode
description: Routes one goal to one skill or one delivery chain.
disable-model-invocation: true
---

# Prath mode

Leaves own invocation, options, procedures, and terminals. Read the selected
leaf; playbooks own predetermined order, not copies of leaf behavior.

## Matchers

- `autoplan`: autonomous plan, `playbooks/autoplan.md`
- `review-plan`: proposal review, `playbooks/review-plan.md`
- `deslop`: diff cleanup, `playbooks/deslop.md`
- `commit`: commit only, `playbooks/commit.md`
- `open-pr`: publish/update PR, `playbooks/open-pr.md`
- `finish-pr`: feedback fixes, `playbooks/finish-pr.md`
- `inspect-pr`: PR/CI inspection or reply, `playbooks/inspect-pr.md`
- `understand-repo`: map/read saved map, `playbooks/understand-repo.md`
- `research-external`: local external source, `playbooks/research-external.md`
- `session`: handoff/resume, `playbooks/session.md`
- `use-skill`: remote skill execution, `playbooks/use-skill.md`
- `restate`: plain restatement and catch-up, `playbooks/restate.md`
- `ship`: implement/deslop/commit/PR, `playbooks/ship.md`
- `save-work`: optional cleanup/commit, `playbooks/save-work.md`

An immediate action outranks a chain. Review does not prepend to ship.
Inspection/reply stays inspect-pr; fixing feedback selects finish-pr.
Neither inspect-pr nor gh escalates into fix-pr; fix-pr owns its gh call.
Deslop is required in ship, optional in save-work; resolve mixed index/worktree
paths before it. Parent owns implementation.

## 1. Match and verify

Record route | owner | completed | diff/tests | terminal.
Open one playbook and copy its steps into todos verbatim. Two matching actions/
chains → one clarification; no match → one outcome question.
From playbooks resolve leaves as `../../<name>/SKILL.md` or
`../../../personal/<name>/SKILL.md`; check all before starting and each again
before its turn. Missing → name paths, stop, offer
`npx skills@latest add prathamdby/skills`.
Done when route, completion condition, and installed owners are fixed.

## 2. Execute and resume

Read each current leaf in full; run it to a terminal. A reported terminal ends
an action route, but does not necessarily succeed. Advance a chain only on the
leaf's evidenced success/no-op. Blocked/waiting/awaiting-push pauses regardless
of a playbook's terminal-observed completion wording.

Parent implementation records planned diff and test evidence. Before make-pr require a clean tree.
On interruption revalidate the last owner's artifacts before continuing.
Done when the route's successful completion condition holds or a pause is
reported with its owner; reporting a blocker is not successful delivery.
