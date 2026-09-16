# Orchestration

Follow the recipe for the branch in use. Default is Safe one-shot. Trust and
gated flags stay in `./trust-integrations.md`. `--wall-clock` stays in
`SKILL.md` and is never passed to `cursor-agent`.

Set `--workspace` to the absolute target when cwd might differ. Quote the
prompt so spaces and quotes stay literal.

## Safe one-shot

Default. Noninteractive, one prompt, exit.

```
cursor-agent --print --workspace <abs> "<prompt>"
```

Add `--plan` or `--mode ask` when the user asked for read-only work. Add
`--model` only when the user named one. Add `--trust` only when Step 2
recorded an explicit waiver for this workspace.

Done when the process exits and stdout or the json `result` is captured.
Non-zero exit is not success. Continue at Failures.

## Streaming

Use when the parent must observe tool calls or partial text while the child
runs.

```
cursor-agent --print --output-format stream-json --stream-partial-output --workspace <abs> "<prompt>"
```

Read NDJSON line by line. Keep `session_id` from `system`/`init` or `result`.
The `result` line is the completion signal. Do not treat a mid-stream
`assistant` event or an `interaction_query` as done. If `interaction_query`
appears, handle it using `--print` output in `./cli-surface.md`. New NDJSON
lines are liveness for this format only. `text` and `json` have no live
events.

For a single final object without live deltas:

```
cursor-agent --print --output-format json --workspace <abs> "<prompt>"
```

Done when a `result` object arrives or the process exits.

## Sessions

| Need                          | Command                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| New id, then later resume     | `--print --output-format json`, save `session_id`                 |
| Empty id first                | `cursor-agent create-chat`, then `--resume <id> --print`          |
| Resume known id               | `cursor-agent --print --resume <id> "<follow-up>"`                |
| Same directory, previous chat | `cursor-agent --print --continue "<follow-up>"`                   |
| Survive SSH/terminal drop     | `cursor-agent persist "<prompt>"`                                 |
| List / attach / stop persist  | `cursor-agent persist list`, `attach <session>`, `stop <session>` |

`--resume` without an id and `cursor-agent ls` / `cursor-agent resume` are interactive
pickers. Do not use them under `--print`.

`--resume` conflicts with `--continue`. Record the id in the ledger before
the next follow-up.

Done when the follow-up has an id or persist name, or `BLOCKED`.

## Worktrees

```
cursor-agent --print -w <name> --worktree-base <branch> --workspace <repo> "<prompt>"
```

The CLI creates `~/.cursor/worktrees/<reponame>/<name>` and prints
`Using worktree: <path>`. Record that path. Omit the name only when a
generated name is acceptable. Pass `--skip-worktree-setup` only when the
user asked to skip `.cursor/worktrees.json`.

Edits land in the worktree, not the original checkout. Verify inside the
worktree path.

Done when `Using worktree:` is recorded or worktree creation failed.

## Parallelism

One modifying `--print` per worktree. Disjoint paths. Never two writers on
the same checkout. Launch independent worktrees in one wave. Queue overlapping
writes.

Read-only `--plan` or `--mode ask` may share a tree when they do not write.

After all children exit, `git status` and `git diff` in each worktree. If this
run merges, re-check the merged tree.

Done when each child has its own workspace path and a recorded pid or
session id, and each tree has been inspected.

## Cleanup

After the run, or on abort:

1. `cursor-agent persist stop <session>` for persist sessions this run started.
2. From the main repo, `git worktree list`, then `git worktree remove <path>`
   only for worktrees this run created and the user did not ask to keep.
3. Kill a child only after Failures says to kill it.
4. Leave `~/.zshrc`, plugins, MCP approvals, and workers untouched.

Done when every session or worktree this run started is stopped, removed, or
explicitly kept.

## Failures

Do not infer a hang from no output. `text` and `json` stay silent until
exit. Restrict event liveness to `stream-json`.

| Signal                                            | Action                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Exit 1 and `Workspace Trust Required`             | Stop. Follow Workspace trust refusal in `./trust-integrations.md`. Do not add `--yolo` or `-f`. |
| Auth / login error                                | Follow Auth in `./trust-integrations.md`. `BLOCKED` unless the user asked to log in.            |
| `--stream-partial-output` without `stream-json`   | Fix argv. Do not retry with gated flags.                                                        |
| Non-zero exit after a started run                 | Capture stderr. Inspect the tree. Report `BLOCKED`. Do not retry with `--yolo`.                 |
| `text` / `json`, no output, still running         | Normal. Wait for exit or `--wall-clock`. Do not kill.                                           |
| `stream-json`, new events or CPU or tree changing | Still working. Do not kill.                                                                     |
| `--wall-clock` exceeded, process still running    | Kill that pid only. Cleanup. `BLOCKED`.                                                         |
| Interactive TUI when `--print` was intended       | Stop. Rerun with `--print`.                                                                     |

Done when the matching row is applied and the ledger has the signal.
