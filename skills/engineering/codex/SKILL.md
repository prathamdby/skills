---
name: codex
description: >
  codex to run the local Codex CLI or manage its installation, login, MCP, and plugins.
---

# Codex

## Options and boundaries

Default: `codex exec --yolo -C <abs-dir> "<prompt>"`; model omitted; parent
wait 15m. Calling this skill authorizes that run: pass `--yolo` without asking.
`--yolo` is the listed alias of `--dangerously-bypass-approvals-and-sandbox`;
pass `--yolo`, not both. Bare `codex` is an asked-for TUI and omits `--yolo`.
"Use <model>" adds `-m`. A named sandbox adds `--sandbox <mode>` and omits
`--yolo`. "Worktree" adds boolean `--worktree`, never a name or invented path.
"Review" selects `codex --yolo review`. Missing values or conflicts are `BLOCKED`.

`--full-auto` is rejected. `--search` and `--ask-for-approval` are global,
before `exec`, and only when the user names them. Skip-git-repo-check,
bypass-hook-trust, danger-full-access, approve-for-me, and ignore-rules are
added only when the user names that control. For a named sandbox or a sandbox
failure, follow `references/sandbox.md`. Do not ask, and do not initialize a
repo to evade the git check.

## 1. Resolve

Fix workspace, prompt, mode, session, worktree, sandbox, and wait.
Check binary and `codex login status` without exposing secrets.
Missing binary → follow `references/install.md`; missing auth → `BLOCKED`
unless login was requested. Omit `--sandbox` unless the user named it.
Record `cmd | workspace | mode | session | worktree | wait | evidence | terminal`.
Done when target, binary, auth, and the yolo-or-named-sandbox choice are fixed.

## 2. Run

Build argv, quote the prompt literally, and use `-C` for the target.
Default text is quiet until exit; silence is not a hang. Wait until exit or
the recorded deadline; kill only this run's PID at that deadline.
Nonzero exit: capture stderr, inspect the tree, report `BLOCKED`.
Do not ask the user and do not add a second bypass.

For JSONL/last-message output, follow `references/streaming.md`.
For resume/fork, follow `references/sessions.md`.
For worktrees/parallel runs, follow `references/worktrees.md`.
For review, TUI, login, MCP, or plugins, follow `references/management.md`.
On a rejected flag, use scoped `codex --help` or `codex exec --help`.
Done when the process exits or a named failure is reported.

## 3. Verify and report

Inspect status and diff; CLI text is unverified. Run the narrowest covering
tests for edited executable code. Check every child worktree; a named
read-only sandbox is not a tree-unchanged guarantee. Remove only clean
worktrees this run created and the user did not ask to keep; preserve login,
MCP, and plugins. Report command, mode, session/worktree, wait, and outcome
evidence. Done when every requested outcome is observed or a blocker is evidenced.

Terminals: `SUCCESS`, `NO_CHANGES`, `BLOCKED`.
