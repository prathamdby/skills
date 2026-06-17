# Assign Skill Reference

## Agent registry

Each row is a supported agent. The invocation command is the full shell
command piped from stdin. The coordinator writes the prompt to
`./assign-prompt.tmp` and runs `cat ./assign-prompt.tmp | <command>`.

| Agent      | Invocation command                                                                               | Default model                  |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| `opencode` | `opencode run --model '<model>' --dir '<dir>' --dangerously-skip-permissions`                    | `opencode-go/kimi-k2.6`        |
| `codex`    | `codex exec --sandbox workspace-write -c approval_policy=never --cd '<dir>' --model '<model>' -` | Codex default (omit `--model`) |
| `claude`   | `claude -p '<shim>' --model '<model>' --dangerously-skip-permissions`                            | `opus`                         |

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

**codex**

- Prompt must be piped via stdin using the `-` sentinel. The explicit `-` forces
  stdin as the full prompt and sidesteps the non-TTY stdin-detection hang.
- `-c approval_policy=never` is required. Without it, Codex can block on approval
  prompts that are invisible in non-interactive mode, causing a silent hang with
  no output. (`codex exec` does not accept `--ask-for-approval`; use the config
  override.)
- `--sandbox workspace-write` grants edit access. Default `exec` sandbox is
  read-only. Avoid `--dangerously-bypass-approvals-and-sandbox` / `--yolo`.
- `-m/--model` is optional and takes a plain model name (not `provider/model`);
  omit to use Codex's configured default.
- `-C/--cd '<dir>'` sets the working directory. Omit it entirely if `--dir` was
  not specified by the user; Codex defaults to the current directory.
- Codex requires a Git repository by default. Pass `--skip-git-repo-check` to run
  outside one. `--full-auto` is deprecated (prints a warning); do not use it.

**claude**

- Claude Code requires `-p` (print mode) for non-interactive delegation. The task
  body is piped via stdin; `<shim>` is a fixed transport string, not task
  expansion:
  `The piped stdin is the complete task. Execute it exactly. Do not infer or expand scope.`
- `--dangerously-skip-permissions` is required for tasks that use tools. Without
  it, file edits and shell commands stall waiting for approval that never comes
  in `-p` mode.
- Claude has no `--cd` flag. When the user passes `--dir`, wrap the command:
  `cat ./assign-prompt.tmp | (cd '<dir>' && claude -p '<shim>' --model '<model>' --dangerously-skip-permissions)`.
  When `--dir` was not specified, omit the subshell and run from the current
  directory.
- Model format: alias (`opus`, `sonnet`, `haiku`, `fable`) or full model ID
  (e.g., `claude-opus-4-8`). Not `provider/model`. When the user omits
  `--model`, substitute `opus`.
- Full project context loads by default (CLAUDE.md, skills, hooks, MCP). Do not
  pass `--bare` unless the prompt explicitly asks for it.
- Stdin is capped at 10MB (v2.1.128+). For larger prompts, reference a file
  path in the task instead of piping the full body.
- Requires `claude auth login` or `ANTHROPIC_API_KEY`.

## Adding a new agent

1. Add a row to the registry table above with the agent name, full invocation
   command, and default model.
2. Add a notes subsection documenting:
   - How the prompt must be passed (stdin vs. argument).
   - Any permission or auth flags required to run non-interactively.
   - Any known gotchas (startup delay, output format, exit codes).
3. Update the "Unknown agent" error message in SKILL.md to include the new name.

## Troubleshooting

### Silent hang, no output for >60s after startup

**Cause:** The agent is waiting on an interactive permission prompt that is not
visible in non-interactive mode.

**Fix for opencode:** Ensure `--dangerously-skip-permissions` is included in
the invocation command. This flag auto-approves all file-write and tool-use
permissions without prompting.

**Fix for codex:** Ensure `-c approval_policy=never` is included in the
invocation command. Use the `-` stdin sentinel (pipe the prompt) rather than
passing it as an argument.

**Fix for claude:** Ensure `--dangerously-skip-permissions` is included. Without
it, tool-using tasks fail or stall while waiting for permission approval.

### Quoting failure, agent receives a truncated or garbled prompt

**Cause:** The prompt was passed as a shell argument. Single quotes, newlines,
or special characters terminate or corrupt the argument.

**Fix:** Always write the prompt to `./assign-prompt.tmp` and pipe it:

```bash
cat ./assign-prompt.tmp | opencode run --model '<model>' --dangerously-skip-permissions
```

### Agent exits with non-zero code

Check the agent's output for the last error message. Common causes:

- Model not found: run `opencode models` and verify the model slug.
- Claude model not found: use an alias (`opus`, `sonnet`) or a full model ID.
- No API key: ensure the provider credentials are configured. For claude, run
  `claude auth status`.
- Working directory not found: verify `--dir` points to an existing path.
- Claude edits land in the wrong directory: ensure the `(cd '<dir>' && ...)` wrapper
  is present when `--dir` was specified.
