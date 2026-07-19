# Assign reference

## Agent registry

Create the prompt with `mktemp "${TMPDIR:-/tmp}/assign.XXXXXXXX"` or an
equivalent atomic primitive, then `chmod 600` it. Pipe with
`cat -- "$prompt_file"` into the selected command. Omit optional arguments when
the user did not supply them.

| Agent | Command after the pipe | Default model |
|---|---|---|
| `opencode` | `opencode run [--model '<model>'] [--dir '<dir>'] --dangerously-skip-permissions` | `opencode-go/kimi-k2.6` |
| `codex` | `codex exec --sandbox workspace-write -c approval_policy=never [-C '<dir>'] [--model '<model>'] [--skip-git-repo-check] -` | configured default |
| `claude` | `claude -p '<shim>' [--model '<model>'] --dangerously-skip-permissions` | `opus` |

`<shim>` is fixed transport text:
`The piped stdin is the complete task. Execute it exactly. Do not infer or expand scope.`

For Claude with `--dir`, run the command inside `(cd '<dir>' && ...)`. For
Codex, include `--skip-git-repo-check` only when
`git -C '<dir>' rev-parse --is-inside-work-tree` exits non-zero or prints
`false`. Missing `git` is a Codex preflight failure.

## Required behavior

- Keep the stdin sentinel `-` for Codex.
- Keep `approval_policy=never` and `workspace-write`; do not use `--yolo`.
- Keep permission skipping for OpenCode and Claude. An invisible approval
  prompt otherwise appears as a silent hang.
- OpenCode models use `provider/model`. Codex models use a plain model name.
  Claude accepts aliases such as `opus` or a full model ID.
- Claude stdin must be below 10,485,760 bytes. At or above that size, fail
  preflight and ask for a task that points to an existing readable source file
  instead of copying its contents.

## Monitoring and termination

Capture combined output to a unique log while streaming it. Launch the agent in
a new process group. Poll every five seconds until 60 silent seconds, then every
15 seconds. At 60 seconds, inspect the process tree and log without signaling
the process, and confirm the required non-interactive flags. Do not kill a live
process for silence alone.

Terminate the whole process group when a visible prompt requests input, the
user cancels, or the harness's execution deadline is reached. Without a harness
deadline there is no wall-clock timeout; continue until exit or cancellation.
A known interactive wait is a combined-log prompt containing approval,
confirmation, or `[y/N]` after non-interactive flags were supplied.

1. Send interrupt and wait five seconds.
2. Send terminate and wait five seconds.
3. Check descendants of the root PID and send kill to the process group only
   if any remain.
4. Capture the resulting non-zero or synthetic timeout exit code.

Capture reportable output before cleanup. Cleanup removes prompt and log files
in a finally path. Cleanup failure makes the terminal `FAILED` regardless of
the agent exit code.

## Failure classification

- Executable or directory missing: `FAILED` before launch.
- Runtime stderr containing login, API-key, unauthenticated, or model-not-found
  errors: `FAILED`, with the final stderr lines.
- Known interactive wait: terminate and report `FAILED`.
- Harness deadline reached: terminate and report `TIMED_OUT`.
- User cancellation or parent interruption: terminate, clean up, and report
  `INTERRUPTED`, unless cleanup fails.
- Exit zero with requested artifacts and verification: `SUCCESS`.
- For code tasks, exit zero with an empty target-directory diff is `FAILED`.
  For non-code tasks, exit zero with empty stdout is `FAILED`; stderr alone is
  not a result.
