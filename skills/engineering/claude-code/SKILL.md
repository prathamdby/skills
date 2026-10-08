---
name: claude-code
description: >
  claude-code to run the local Claude CLI or manage its installation, auth, MCP, and plugins.
---

# Claude Code

## Options and boundaries

Default: `claude --print --output-format text "<prompt>"` from the target
directory; permission mode and model omitted; parent wait 15m.
"Read-only" / "plan" adds `--permission-mode plan`; print alone can write.
"Use <model>" adds `--model`. "Interactive" / "TUI" omits `--print`.
"Resume <id>" adds `--resume`; "continue" adds `--continue`; both block.
"Worktree [name]" adds `--worktree [name]`; record the emitted path.
"JSON" / "stream-json" selects that print output. Missing needed values or
conflicting options are `BLOCKED`.

Permissions remain when print skips the trust dialog. A named waiver is
required for skip-permissions, bypassPermissions, dontAsk, auto, or
allow-dangerously-skip-permissions. Before using one, or when a print
permission prompt appears, follow `references/permissions.md`; recovery
does not invent a bypass. `claude help` starts a session: use `claude --help`.
`remote-control` is not documentation.

## 1. Resolve

Fix absolute workspace, prompt, mode, session, worktree, output, and wait.
Check binary and `claude auth status --text` without exposing secrets.
Missing binary → follow `references/install.md`; missing auth → `BLOCKED`
unless login was requested. Wrong cwd blocks.
Record `cmd | workspace | mode | session | worktree | waiver | wait | evidence | terminal`.
Done when target, binary, auth, and authorized options are fixed.

## 2. Run

Build argv from those options and quote the prompt literally. Default text
is quiet until process exit; silence is not a hang. Wait for exit or the
recorded deadline, and kill only this run's PID when that deadline expires.
Nonzero exit: capture stderr, inspect the tree, and report `BLOCKED`.

For JSON/stream output, follow `references/streaming.md`. For resume,
continue, or background sessions, follow `references/sessions.md`.
For worktrees or parallel runs, follow `references/worktrees.md`.
For an asked-for TUI or management command, follow `references/management.md`.
A rejected flag requires scoped `--help`, not a guessed replacement.
Done when the process exits, an intended live handle is recorded, or a
permission/authorization gate is reported.

## 3. Verify and report

Inspect status and diff; CLI text is not proof. Run the narrowest covering
tests for edited executable code. Plan mode must leave the tree unchanged.
Verify each worktree and any integrated tree. Clean up only this run's
sessions/worktrees unless explicitly kept; preserve auth, MCP, and plugins.
Report command, mode, session/worktree, waiver, wait, and outcome evidence.
Done when every requested outcome is observed or a blocker is evidenced.

Terminals: `SUCCESS`, `NO_CHANGES`, `BLOCKED`, `AWAITING_USER`.
