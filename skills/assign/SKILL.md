---
name: assign
description: >
  assign when running one exact task through a supported external coding-agent
  CLI without interactive prompts.
---

# Assign

## Flags

| Flag | Default | Effect |
|---|---|---|
| `--agent <name>` | `opencode` | `opencode`, `codex`, or `claude` |
| `--model <model>` | registry default | Override the selected agent's model |
| `--dir <path>` | current directory | External agent working directory |

If `--agent` names an unsupported agent, stop: "Unknown agent `<name>`.
Supported agents: opencode, codex, claude. See `./REFERENCE.md`."

## 1. Preflight

Require a non-empty positional task, an existing working directory, the agent
executable, and the registry entry in `./REFERENCE.md`. For Codex outside a git
repo, use the registry's non-git branch.

Record:
`agent/model | dir | prompt path | process | last progress | exit | terminal`.

Done when inputs and the exact non-interactive command are resolved, or a
specific missing executable, directory, or auth blocker is reported.

## 2. Create transport

Create a collision-safe prompt file with restrictive permissions using the
system temp directory. Write the task bytes unchanged. Never pass task text as
a shell argument. Register cleanup before launching so success, error, signal,
or interruption removes the prompt.

Done when the prompt can be read back byte-for-byte and parallel assignments
cannot share its path.

## 3. Execute and monitor

Run the selected registry command through a tracked process and pipe the prompt
on stdin. Capture stdout, stderr, process ID, and exit code. Monitor output,
process state, and target-directory changes. Silence alone is not proof of a
hang. Inspect the process after a silent interval; terminate only when it is
waiting for input despite non-interactive flags, the user cancels, or the
execution deadline is reached. Use the reference's termination sequence.

Done when the process exits or is terminated, with no orphaned child process.

## 4. Verify and report

Always run cleanup, then confirm the prompt file is absent. Non-zero exit,
spawn failure, timeout, or empty output is not success. For code work, inspect
the resulting diff and requested test evidence; do not trust the CLI summary.

Report the agent, model, directory, exit code, observed result, verification,
and one terminal value: `SUCCESS`, `FAILED`, `TIMED_OUT`, or `INTERRUPTED`.

Delegate exactly the supplied task. Do not add commit, push, build, or scope
unless the task itself asks for it.
