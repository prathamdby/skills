# Orchestration

Follow the recipe for the branch in use. Default is Safe one-shot.
Gated flags stay in `./permissions.md`. `--wall-clock` stays in
`SKILL.md` and is never passed to `claude`.

Run from the target directory. Quote the prompt so spaces and quotes
stay literal. Wrong cwd is `BLOCKED`.

## Safe one-shot

Default. Noninteractive, one prompt, exit.

```
claude --print --output-format text "<prompt>"
```

Add `--permission-mode plan` when the user asked for read-only work.
Add `--model` only when the user named one.

Done when the process exits and stdout is captured. Non-zero exit is
not success. Continue at Failures.

## Streaming

Use when the parent must observe output while the child runs, and the
user asked for a stream.

```
claude --print --output-format stream-json "<prompt>"
```

Read NDJSON line by line. Do not assume event type names. The process
exit is the completion signal. Mid-stream lines are not done. New
NDJSON lines are liveness for this format only. `text` and `json` have
no live events.

For a single final object without live lines:

```
claude --print --output-format json "<prompt>"
```

Done when the process exits.

## Sessions

| Need                          | Command                                           |
| ----------------------------- | ------------------------------------------------- |
| Resume known id               | `claude --print --resume <id> "<follow-up>"`      |
| Same directory, previous chat | `claude --print --continue "<follow-up>"`         |

`--resume` without an id is an interactive picker. Do not use it under
`--print`. `--resume` conflicts with `--continue`. Record the id in the
ledger before the next follow-up.

Done when the follow-up has an id, or `BLOCKED`.

## Worktrees

Only when the user asked.

```
claude --print --worktree [name] "<prompt>"
```

Omit the name only when a generated name is acceptable. Help does not
state where the worktree is created. Record the path the CLI prints.
Do not invent a directory.

Edits land in the worktree, not the original checkout. Verify inside
the recorded path.

Done when a worktree path is recorded or worktree creation failed.

## Parallelism

One modifying `--print` per worktree. Disjoint paths. Never two writers
on the same checkout. Launch independent worktrees in one wave. Queue
overlapping writes.

Read-only `--permission-mode plan` may share a tree when they do not
write.

After all children exit, `git status` and `git diff` in each worktree.
If this run merges, re-check the merged tree.

Done when each child has its own workspace path and a recorded pid or
session id, and each tree has been inspected.

## Background

Only when the user asked for a background session.

```
claude --print --bg "<prompt>"
```

The CLI prints an id. Use that id:

```
claude attach <id>
claude logs <id>
claude stop <id>
claude rm <id>
```

`claude agents --json` lists them. Do not start `--bg` as a default.

Done when the id is recorded, or `BLOCKED`.

## Cleanup

After the run, or on abort:

1. `claude stop <id>` then `claude rm <id>` for background sessions this
   run started, unless the user asked to keep them.
2. Kill a child only after Failures says to kill it.
3. Leave plugins, MCP config, and auth untouched.

Done when every session this run started is stopped, removed, or
explicitly kept.

## Failures

Do not infer a hang from no output. `text` and `json` stay silent until
exit. Restrict event liveness to `stream-json`.

| Signal                                         | Action                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Auth / login error                             | `BLOCKED` unless the user asked to log in. Follow First-run in `./cli-surface.md`.          |
| Permission prompt under `--print`              | Follow Print-mode prompts in `./permissions.md`. Do not add a gated skip.                   |
| Non-zero exit after a started run              | Capture stderr. Inspect the tree. Report `BLOCKED`. Do not retry with a gated skip.         |
| `text` / `json`, no output, still running      | Normal. Wait for exit or `--wall-clock`. Do not kill.                                       |
| `stream-json`, new events or CPU or tree changing | Still working. Do not kill.                                                              |
| `--wall-clock` exceeded, process still running | Kill that pid only. Cleanup. `BLOCKED`.                                                     |
| Interactive TUI when `--print` was intended    | Stop. Rerun with `--print`.                                                                 |
| `claude help` started a session                | Stop. Use `claude --help`. Report `BLOCKED`.                                                |
| Cwd is not the target directory                | Stop. `BLOCKED`. Do not invent a flag that retargets cwd.                                   |

Done when the matching row is applied and the ledger has the signal.
