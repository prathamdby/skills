---
name: assign
description: >
  assign a task to an external coding agent and monitor it. Pipes the prompt via
  stdin to dodge quoting failures and auto-approves permissions to avoid silent
  hangs. Triggers: run a task with an external agent, hand off to OpenCode,
  Claude Code, or similar, execute a plan non-interactively. Flags: --agent
  <name> (default opencode), --model <model>, and --dir <path>.
---

# Assign

```
/assign "Fix the null check in auth.ts" --agent opencode --model opencode-go/kimi-k2.6
/assign "Fix the null check in auth.ts" --agent claude
```

## Flags

| Flag              | Effect                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `--agent <name>`  | Agent to delegate to. **Default: `opencode`**.                                                                                        |
| `--model <model>` | Model to use. Agent default applies if omitted.                                                                                       |
| `--dir <path>`    | Agent working directory. **Default: current directory.** `assign-prompt.tmp` is always written to the current directory, not `--dir`. |

If `--agent` names an unsupported agent, stop: "Unknown agent `<name>`.
Supported agents: opencode, codex, claude. See `./REFERENCE.md`."

## Step 1: Write the prompt file

Write the full task prompt to `./assign-prompt.tmp` in the **current working
directory** (not `--dir`). Never pass the prompt as a shell argument, quoting
breaks on multi-line or special-character prompts. Overwrite silently.

## Step 2: Invoke the agent

Look up the agent's invocation template and required non-interactive flags in
`./REFERENCE.md`. Those flags are not optional: without them the agent blocks on
an invisible permission prompt and hangs silently. Substitute `<model>` and
`<dir>`, then pipe the prompt:

```bash
cat ./assign-prompt.tmp | <agent-command>
```

## Step 3: Monitor output

Watch for progress (tool calls, file writes, step completions). If there is no
output for >60s after startup, the agent is hung on a permission prompt. Kill
it and check the agent's troubleshooting notes in `./REFERENCE.md`.

## Step 4: Verify and clean up

1. Report the exit code and a brief summary of what the agent did.
2. Delete `./assign-prompt.tmp`.
3. If the task was a code change, prompt the user to verify results.

## Constraints

- Never infer or expand the task. Delegate exactly the prompt provided.
- Never commit, push, or build unless the prompt explicitly asked for it.
