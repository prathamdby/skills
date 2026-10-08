---
name: cursor-agent
description: >
  cursor-agent to run the local Cursor CLI or manage installation, login, integrations, and workers.
---

# Cursor Agent

## Options and boundaries

Default: `cursor-agent --print --workspace <abs-dir> "<prompt>"`,
mode/model omitted, text output, parent wait 15m. Print alone can write.
"Plan" / "read-only plan" adds `--plan`; "ask" / "Q&A" adds `--mode ask`.
Both block. "Use <model>" adds `--model`. "Interactive" / "TUI" omits print.
"Resume <id>" adds `--resume`; "continue" adds `--continue`; both block.
"Worktree [name]" adds `--worktree [name]`; record the printed path.
"JSON" / "stream-json" selects that print format. Ambiguity is `BLOCKED`.

Workspace trust needs the user's named authorization for this run; a coding
request is not trust. On `Workspace Trust Required`, or before `--trust`,
apply `references/trust-integrations.md`. Trust recovery adds only an
authorized `--trust`, not force/yolo. Force, sandbox disabled, approve-mcps,
and worker desktop/credential controls need their own named waivers.
Auto-review is explicit opt-in, not a trust or permission bypass.

## 1. Resolve

Fix workspace, prompt, mode, session/worktree, output, and wait.
Check binary and `cursor-agent status --format json` without exposing secrets.
Missing binary → follow `references/install.md`; missing auth → `BLOCKED`
unless login was requested. Resolve trust before running.
Record `cmd | workspace | mode | session | worktree | trust | waiver | wait | evidence | terminal`.
Done when target, binary, auth, trust, and authorized options are fixed.

## 2. Run

Build argv and quote the prompt literally. Text/json may be quiet until
exit; silence is not a hang. Wait until exit or the recorded deadline;
kill only this run's PID at that deadline. Nonzero exit: capture stderr,
inspect the tree, report `BLOCKED`, not a retry with added force.

For JSON/stream output, follow `references/streaming.md`.
For resume, continue, or persist, follow `references/sessions.md`.
For worktrees/parallel runs, follow `references/worktrees.md`.
For a TUI or other command syntax, follow `references/management.md`.
For login, MCP, plugins, workers, or Bedrock, apply the matching branch in
`references/trust-integrations.md`. On rejected syntax, use scoped `--help`.
Done when the process exits, an intended live session is recorded, or an
authorization gate/failure is reported.

## 3. Verify and report

Inspect status and diff; CLI text is unverified. Run the narrowest covering
tests for edited executable code. Plan/ask must leave the tree unchanged.
Check each worktree and any integrated tree. Clean up only sessions and clean
worktrees this run created unless kept; preserve shell integration, MCP,
plugins, and workers. Report command, mode, session/worktree, waivers, wait,
and outcome evidence. Done when each outcome is observed or blocked with evidence.

Terminals: `SUCCESS`, `NO_CHANGES`, `BLOCKED`, `AWAITING_USER`.
