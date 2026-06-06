---
name: assign
description: >
  Delegate a task or plan to an external coding agent and monitor execution.
  Use when the user asks to run a task with an external agent, hand off work
  to OpenCode or a similar tool, or execute a plan non-interactively.
  Supports --agent <name> (default: opencode) and --model <provider/model>.
---

# Assign

## Quick start

```
/assign "Fix the null check in auth.ts" --agent opencode --model opencode-go/kimi-k2.6
```

## Flag detection

| Flag                       | Effect                                                                     |
| -------------------------- | -------------------------------------------------------------------------- |
| `--agent <name>`           | Agent to delegate to. **Default: `opencode`**.                             |
| `--model <provider/model>` | Model to use. Agent-specific default applies if omitted. See REFERENCE.md. |
| `--dir <path>`             | Working directory for the agent. Default: current directory.               |

If `--agent` names an unsupported agent, stop and report:
"Unknown agent `<name>`. Supported agents: opencode. See REFERENCE.md."

## Step 0: Read REFERENCE.md (mandatory)

**Do not proceed to Step 1 or any later step until you have read `REFERENCE.md` in full.**

1. Use the Read tool on `./REFERENCE.md` in this skill's directory (same folder as this file).
2. Treat every agent invocation template, model default, and troubleshooting note in that file as binding for this session.
3. If you have not read it yet, stop and read it now. Skipping this step causes broken invocations and silent hangs.

## Step 1: Write the prompt file

Write the full task prompt to `./assign-prompt.tmp` in the **current working
directory** (not in `--dir`). Never pass the prompt as a shell argument —
quoting breaks on multi-line or special-character prompts. Overwrite silently
if the file already exists.

## Step 2: Invoke the agent

Look up the agent's invocation template in REFERENCE.md. Substitute `<model>`
and `<dir>` as needed, then run:

```bash
cat ./assign-prompt.tmp | <agent-command>
```

## Step 3: Monitor output

Watch the agent's output for:

- Progress signals (tool calls, file writes, step completions)
- Silent hang: no output for >60s after startup

If the process hangs silently, kill it and report the issue. Check REFERENCE.md
troubleshooting for the affected agent.

## Step 4: Verify and clean up

After the agent exits:

1. Report exit code and a brief summary of what the agent did.
2. Delete `./assign-prompt.tmp`.
3. Prompt the user to verify results if the task was a code change.

## Constraints

- Never infer or expand the task. Delegate exactly the prompt provided.
- Never commit, push, or build unless the prompt explicitly asked for it.
- Never skip Step 0. REFERENCE.md holds agent invocation templates and troubleshooting this skill depends on.
