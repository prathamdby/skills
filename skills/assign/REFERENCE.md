# Assign reference

## Agent registry

Pipe `cat '<prompt-file>'` into the selected command. Omit optional arguments
when the user did not supply them.

| Agent | Command after the pipe | Default model |
|---|---|---|
| `opencode` | `opencode run [--model '<model>'] [--dir '<dir>'] --dangerously-skip-permissions` | `opencode-go/kimi-k2.6` |
| `codex` | `codex exec --sandbox workspace-write -c approval_policy=never [-C '<dir>'] [--model '<model>'] [--skip-git-repo-check] -` | configured default |
| `claude` | `claude -p '<shim>' [--model '<model>'] --dangerously-skip-permissions` | `opus` |

`<shim>` is fixed transport text:
`The piped stdin is the complete task. Execute it exactly. Do not infer or expand scope.`

For Claude with `--dir`, run the command inside `(cd '<dir>' && ...)`. For
Codex, include `--skip-git-repo-check` only when
`git -C '<dir>' rev-parse --is-inside-work-tree` fails.

## Required behavior

- Keep the stdin sentinel `-` for Codex.
- Keep `approval_policy=never` and `workspace-write`; do not use `--yolo`.
- Keep permission skipping for OpenCode and Claude. An invisible approval
  prompt otherwise appears as a silent hang.
- OpenCode models use `provider/model`. Codex models use a plain model name.
  Claude accepts aliases such as `opus` or a full model ID.
- Claude stdin is limited to 10 MB. A larger task must point to an existing
  source file instead of copying its contents into the prompt.

## Monitoring and termination

Capture combined output to a unique log while streaming it. Poll process state
and the target directory with increasing intervals. After 60 silent seconds,
inspect the process tree and confirm the required non-interactive flags. Do not
kill a live process for silence alone.

Terminate the whole process group when a visible prompt requests input, the
user cancels, or the execution deadline is reached:

1. Send interrupt and wait five seconds.
2. Send terminate and wait five seconds.
3. Send kill only if children remain.
4. Capture the resulting non-zero or synthetic timeout exit code.

Cleanup removes prompt and log files in a finally path. A failed cleanup is
part of the reported failure.

## Failure classification

- Executable or directory missing: `FAILED` before launch.
- Authentication or model error: `FAILED`, with the final stderr lines.
- Known interactive wait: terminate and report `FAILED`.
- Deadline reached: terminate and report `TIMED_OUT`.
- Parent interruption: terminate, clean up, and report `INTERRUPTED`.
- Exit zero with requested artifacts and verification: `SUCCESS`.
- Exit zero without output or observable result: `FAILED`.
