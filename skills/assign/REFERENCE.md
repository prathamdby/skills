# Assign Skill Reference

## Agent registry

Each row is a supported agent. The invocation command is the full shell
command piped from stdin. The coordinator writes the prompt to
`./assign-prompt.tmp` and runs `cat ./assign-prompt.tmp | <command>`.

| Agent | Invocation command | Default model |
| --- | --- | --- |
| `opencode` | `opencode run --model '<model>' --dir '<dir>' --dangerously-skip-permissions` | `opencode-go/kimi-k2.6` |

### Notes per agent

**opencode**

- Prompt must be piped via stdin. Passing it as a shell argument causes silent
  quoting failures on multi-line prompts.
- `--dangerously-skip-permissions` is required. Without it, opencode blocks on
  permission prompts that are invisible in non-interactive mode, causing a
  silent hang with no output.
- `--dir '<dir>'` sets the working directory. Omit it entirely if `--dir` was
  not specified by the user; opencode defaults to the current directory.
- Model format: `<provider>/<model>` (e.g., `opencode-go/kimi-k2.6`,
  `anthropic/claude-sonnet-4`). Run `opencode models` to list available models.

## Adding a new agent

1. Add a row to the registry table above with the agent name, full invocation
   command, and default model.
2. Add a notes subsection documenting:
   - How the prompt must be passed (stdin vs. argument).
   - Any permission or auth flags required to run non-interactively.
   - Any known gotchas (startup delay, output format, exit codes).
3. Update the "Unknown agent" error message in SKILL.md to include the new name.

## Troubleshooting

### Silent hang — no output for >60s after startup

**Cause:** The agent is waiting on an interactive permission prompt that is not
visible in non-interactive mode.

**Fix for opencode:** Ensure `--dangerously-skip-permissions` is included in
the invocation command. This flag auto-approves all file-write and tool-use
permissions without prompting.

### Quoting failure — agent receives a truncated or garbled prompt

**Cause:** The prompt was passed as a shell argument. Single quotes, newlines,
or special characters terminate or corrupt the argument.

**Fix:** Always write the prompt to `./assign-prompt.tmp` and pipe it:
```bash
cat ./assign-prompt.tmp | opencode run --model '<model>' --dangerously-skip-permissions
```

### Agent exits with non-zero code

Check the agent's output for the last error message. Common causes:
- Model not found: run `opencode models` and verify the model slug.
- No API key: ensure the provider credentials are configured.
- Working directory not found: verify `--dir` points to an existing path.
