---
name: codex
description: >
  codex to run the local Codex CLI or manage its installation, login, MCP, and plugins.
---

# Codex

## Options and boundaries

Default: `codex exec -C <abs-dir> "<prompt>"`; sandbox and model omitted;
parent wait 15m. Bare `codex` is an asked-for TUI.
"Use <model>" adds `-m`. A named sandbox adds `--sandbox <mode>`.
"Worktree" adds boolean `--worktree`, never a name or invented path.
"Review" selects `codex review`. Missing values or conflicts are `BLOCKED`.

Sandbox read-only constrains model-generated shell, not the whole process.
Workspace-write is not auto-approve. `--full-auto` is rejected.
`--search` and `--ask-for-approval` are global, before `exec`.
Skip-git-repo-check needs an explicit request; do not initialize a repo to
evade the check. Named waivers are required for bypass-approvals-and-sandbox,
bypass-hook-trust, danger-full-access, approve-for-me, approval never, yolo,
and ignore-rules. Before a waiver or on sandbox failure, apply
`references/sandbox.md`; failure does not authorize a bypass.

## 1. Resolve

Fix workspace, prompt, mode, session, worktree, sandbox, and wait.
Check binary and `codex login status` without exposing secrets.
Missing binary → follow `references/install.md`; missing auth → `BLOCKED`
unless login was requested. Omit sandbox unless the user named it.
Record `cmd | workspace | mode | session | worktree | waiver | wait | evidence | terminal`.
Done when target, binary, auth, and authorized options are fixed.

## 2. Run

Build argv, quote the prompt literally, and use `-C` for the target.
Default text is quiet until exit; silence is not a hang. Wait until exit or
the recorded deadline; kill only this run's PID at that deadline.
Nonzero exit: capture stderr, inspect the tree, report `BLOCKED`.

For JSONL/last-message output, follow `references/streaming.md`.
For resume/fork, follow `references/sessions.md`.
For worktrees/parallel runs, follow `references/worktrees.md`.
For review, TUI, login, MCP, or plugins, follow `references/management.md`.
On a rejected flag, use scoped `codex --help` or `codex exec --help`.
Done when the process exits or a named failure/authorization gate is reported.

## 3. Verify and report

Inspect status and diff; CLI text is unverified. Run the narrowest covering
tests for edited executable code. Check every child worktree; read-only
sandbox is not a tree-unchanged guarantee. Remove only clean worktrees this
run created and the user did not ask to keep; preserve login, MCP, plugins.
Report command, mode, session/worktree, waiver, wait, and outcome evidence.
Done when every requested outcome is observed or a blocker is evidenced.

Terminals: `SUCCESS`, `NO_CHANGES`, `BLOCKED`, `AWAITING_USER`.
