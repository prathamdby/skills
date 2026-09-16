---
name: cursor-agent
description: >
  cursor-agent when launching the Cursor Agent CLI (`cursor-agent`) for a
  first-run install, interactive session, one-shot, stream, persist, worktree,
  MCP, plugin, worker, or Bedrock command.
---

# Cursor Agent CLI

Default run is `cursor-agent --print` in the target workspace with `--mode`
omitted. Read-only values are `plan` and `ask`.

## Options

Derive product CLI argv from the request. Unspecified: `--print`, omit
`--mode`, `--output-format text`, parent wait `15m`. `--print` stays
modifying-capable unless plan or ask is set.
"plan" / "read-only plan" → `--plan` (`--mode plan`).
"ask" / "Q&A" → `--mode ask`. Plan and ask together is `BLOCKED`.
"use <model>" → `--model` only when named.
"resume <id>" → `--resume <id>`. "continue" → `--continue`. Both is
`BLOCKED`.
"worktree [name]" → `--worktree [name]` under
`~/.cursor/worktrees/<reponame>/<name>`. Do not invent a path.
"json" / "stream-json" → that `--output-format` with `--print`.
"trust this workspace" → `--trust` only. A coding task is not trust.
"auto-review" → `--auto-review` only when asked. Not a trust bypass.
"interactive" / "TUI" → omit `--print`.
Ambiguous wording is `BLOCKED`.

## Iron laws

1. Modes: omit `--mode` for execution. `--plan` and `--mode ask` are read-only. Treat `--print` as modifying-capable.
2. Trust: pass `--trust` only when the user authorized this workspace for
   this run. A coding task does not imply trust. `--yolo` and `-f` are not
   acceptable substitutes merely to bypass workspace trust. On
   `Workspace Trust Required`, follow Workspace trust refusal in
   `./references/trust-integrations.md`.
3. Gated: `--yolo`, `-f`, `--force`, `--sandbox disabled`, `--approve-mcps`,
   and worker credential or desktop flags require a named user waiver. When the
   user asked for login, MCP, plugin, worker, or Bedrock, follow that recipe in
   `./references/trust-integrations.md`.

## 1. Resolve

Confirm `cursor-agent` is on PATH. If missing, follow First-run in
`./references/cli-surface.md`. Record workspace, prompt, mode, session,
worktree, output format, and wall-clock. Check auth with
`cursor-agent status --format json`. Do not print secrets. Missing login is
`BLOCKED`. Record:
`cmd | workspace | mode | session | worktree | trust | verified | terminal | wall-clock`.

Done when binary, workspace, mode, auth state, and wall-clock are recorded.

## 2. Authorize trust

An untrusted workspace makes noninteractive `--print` exit 1. Do not add
`--trust` until the user names this workspace and authorizes it. Then pass
`--trust` only. Never recover with `--yolo` or `-f`. Follow the refusal
procedure in `./references/trust-integrations.md`.

Done when trust is already present, `--trust` is authorized and recorded, or the run is `BLOCKED` / `AWAITING_USER`.

## 3. Build the command

Construct argv from the derived options. Add `--plan` or `--mode ask` for
read-only work. Quote the prompt. Pass `--workspace` when cwd is not the
target. No gated flag without a named waiver. If `--output-format` is `json`
or `stream-json`, parse events with the catalog in
`./references/cli-surface.md`. If the user asked to install, update, or run
the interactive TUI, follow that recipe in `./references/cli-surface.md`.

Done when argv is recorded.

## 4. Run

Follow the matching recipe in `./references/orchestration.md` for one-shot,
streaming, sessions, worktrees, parallelism, cleanup, or failures. Wait for
exit or the recorded wall-clock. Do not kill a still-working process.

Done when the process exits, a persist session is the intended live handle,
or a named failure recipe applies.

## 5. Verify

Treat CLI text as unverified. Inspect `git status` and the diff. Run the
narrowest covering tests for edited executable code. Read-only modes must
leave the tree unchanged. For parallel or worktree runs, verify each tree
from Parallelism in `./references/orchestration.md`.

Done when each requested outcome is observed or `BLOCKED` with evidence.

## 6. Report

Lead with terminal state. Restate cmd, mode, session, worktree, trust
waiver, wall-clock, and verification evidence.

Terminal values are `SUCCESS`, `BLOCKED`, `NO_CHANGES`, and `AWAITING_USER`.
