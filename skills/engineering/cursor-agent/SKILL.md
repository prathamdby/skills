---
name: cursor-agent
description: >
  cursor-agent to run the local Cursor CLI or manage installation, login, integrations, and workers.
---

# Cursor Agent

## Options and boundaries

Default: `cursor-agent --print --trust --yolo --workspace <abs-dir> "<prompt>"`,
mode/model omitted, text output, parent wait 15m. Calling this skill authorizes
that run: pass `--trust` and `--yolo` without asking. Print alone can write.
"Plan" / "read-only plan" adds `--plan` and omits `--yolo`. "Ask" / "Q&A" adds
`--mode ask` and omits `--yolo`. Both stay read-only, still pass `--trust`, and
wait until exit. "Use <model>" adds `--model`. "Interactive" / "TUI" omits
print, `--trust`, and `--yolo`; the user owns that dialog.
"Resume <id>" adds `--resume`; "continue" adds `--continue`; both wait until
exit and keep the same trust/yolo choice as the selected mode.
"Worktree [name]" adds `--worktree [name]`; record the printed path.
"JSON" / "stream-json" selects that print format. Ambiguity is `BLOCKED`.

Add sandbox disabled, approve-mcps, or a worker desktop/credential flag only
when the user names that control. Auto-review is explicit opt-in. Do not stop
to confirm trust or yolo, and do not add those extra flags after a failure.

## 1. Resolve

Fix workspace, prompt, mode, session/worktree, output, and wait.
Check binary and `cursor-agent status --format json` without exposing secrets.
Missing binary → follow `references/install.md`; missing auth → `BLOCKED`
unless login was requested.
Record `cmd | workspace | mode | session | worktree | wait | evidence | terminal`.
Done when target, binary, auth, and the trust/yolo choice are fixed.

## 2. Run

Build argv and quote the prompt literally. Text/json may be quiet until
exit; silence is not a hang. Wait until exit or the recorded deadline;
kill only this run's PID at that deadline. Nonzero exit: capture stderr,
inspect the tree, report `BLOCKED`. On `Workspace Trust Required`, rerun the
same argv with `--trust` if it was missing. Do not ask the user and do not
add sandbox, MCP, or worker flags.

For JSON/stream output, follow `references/streaming.md`.
For resume, continue, or persist, follow `references/sessions.md`.
For worktrees/parallel runs, follow `references/worktrees.md`.
For a TUI or other command syntax, follow `references/management.md`.
For login, MCP, plugins, workers, or Bedrock, apply the matching branch in
`references/integrations.md`. On rejected syntax, use scoped `--help`.
Done when the process exits, an intended live session is recorded, or a
failure is reported.

## 3. Verify and report

Inspect status and diff; CLI text is unverified. Run the narrowest covering
tests for edited executable code. Plan/ask must leave the tree unchanged.
Check each worktree and any integrated tree. Clean up only sessions and clean
worktrees this run created unless kept; preserve shell integration, MCP,
plugins, and workers. Report command, mode, session/worktree, wait, and
outcome evidence. Done when each outcome is observed or blocked with evidence.

Terminals: `SUCCESS`, `NO_CHANGES`, `BLOCKED`.
