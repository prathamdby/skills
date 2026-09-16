# Orchestration

Follow the recipe for the branch in use. Default is Safe one-shot. Sandbox
and gated flags stay in `./sandbox.md`. `--wall-clock` stays in `SKILL.md`
and is never passed to `codex`.

Pass `-C` with the absolute target when cwd might differ. Quote the prompt
so spaces and quotes stay literal.

## Safe one-shot

Default. Noninteractive, one prompt, exit.

```
codex exec -C <abs-dir> "<prompt>"
```

Add `--sandbox` only when the user named one. Add `-m` only when the user
named a model. Add `--worktree` only when the user asked for a managed
worktree.

Done when the process exits and stdout is captured. Non-zero exit is not
success. Continue at Failures.

## Streaming

Use when the parent must observe events while the child runs.

```
codex exec --json -C <abs-dir> "<prompt>"
```

Read JSONL line by line. Do not invent an event catalog. A new line is
liveness for `--json` only. Default exec text stays silent until exit.

To capture only the last agent message:

```
codex exec -o <FILE> -C <abs-dir> "<prompt>"
```

Done when the process exits or a last-message file is written.

## Sessions

| Need                    | Command                                      |
| ----------------------- | -------------------------------------------- |
| Follow-up with a known id | `codex exec resume <id> "<follow-up>"`     |
| Most recent recorded    | `codex exec resume --last "<follow-up>"`     |
| Fork a known id         | `codex exec fork <id> "<follow-up>"`         |

`codex resume`, `codex fork`, and `codex queue` are `BLOCKED`. Ask for
`exec resume` and an id.

Done when the follow-up has an id, or `BLOCKED`.

## Worktrees

```
codex exec --worktree -C <abs-dir> "<prompt>"
```

`--worktree` is boolean. Do not invent a path. Do not pass a name. The
CLI creates a managed Git worktree. Record the path the CLI reports.
Edits land there, not in the original checkout. Verify inside that
worktree.

Done when the managed worktree path is recorded or worktree creation failed.

## Parallelism

One modifying `exec` per worktree. Disjoint paths. Never two writers on
the same checkout. Launch independent `--worktree` runs in one wave. Queue
overlapping writes.

`--sandbox read-only` may share a tree only if those runs do not write.
It constrains model-generated shell, not the whole process.

After all children exit, `git status` and `git diff` in each worktree.

Done when each child has its own workspace path and a recorded pid or
session id, and each tree has been inspected.

## Cleanup

After the run, or on abort:

1. From the main repo, `git worktree list`, then `git worktree remove <path>`
   only for worktrees this run created and the user did not ask to keep.
2. Kill a child only after Failures says to kill it.
3. Leave login, plugins, and MCP config untouched.

Done when every worktree this run started is removed or explicitly kept.

## Failures

Do not infer a hang from no output. Default exec text stays silent until
exit. Restrict event liveness to `--json`.

| Signal | Action |
| ------ | ------ |
| Auth / login error | Follow Auth in `./cli-surface.md`. `BLOCKED` unless the user asked to log in. |
| `unexpected argument '--full-auto'` | Stop. `--full-auto` is rejected. Do not retry it. |
| `unexpected argument '--search'` or `'--ask-for-approval'` after `exec` | Stop. Those flags go before `exec`. Follow Flag order in `./cli-surface.md`. |
| Non-zero exit after a started run | Capture stderr. Inspect the tree. Report `BLOCKED`. Do not retry with a gated flag. |
| Default exec, no output, still running | Normal. Wait for exit or `--wall-clock`. Do not kill. |
| `--json`, new lines or CPU or tree changing | Still working. Do not kill. |
| `--wall-clock` exceeded, process still running | Kill that pid only. Cleanup. `BLOCKED`. |
| Interactive TUI when `exec` was intended | Stop. Rerun with `codex exec`. |
| `codex queue` or TUI `codex resume` picker | `BLOCKED`. Ask for `exec resume` and an id. |

Done when the matching row is applied and the ledger has the signal.
