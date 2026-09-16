# CLI surface

Syntax follows local `claude --help`. If a flag is rejected, re-run
`claude --help` and use what the binary prints. Do not invent flags this
help does not list. Default argv, permission mode, and `--wall-clock`
stay in `SKILL.md`.

`claude help` (no dashes) is `BLOCKED`. It starts a session.
`claude remote-control` is not help. Do not run it for documentation.

## First-run

When `claude` is missing or the user asked to install. Prefer
`~/.local/bin/claude`.

macOS, Linux, WSL:

```
curl -fsSL https://claude.ai/install.sh | bash
claude --version
```

If the version command is not found, add `~/.local/bin` to PATH and retry.
On native Windows PowerShell: `irm https://claude.ai/install.ps1 | iex`,
then `claude --version`.

Once a native binary exists, `claude install [stable|latest|<version>]`
installs that native build. `claude update` only when the user asked to
update. A package-manager global install is not this recipe.

Then `claude auth status --text`. Do not print secrets. Missing login is
`BLOCKED` unless the user asked to authenticate: `claude auth login`
(default `--claudeai`). User-named `--console` or `--sso` only.

Done when `claude --version` prints and auth state is recorded.

## Interactive

Only when the user asked for the interactive TUI. Run in the target
directory:

```
claude "<prompt>"
```

Omit the prompt to open an empty session. Do not type into it to click
through dialogs. Prefer `--print` for automation.

Done when the user owns the live TUI, or `BLOCKED` / `AWAITING_USER`.

## Global flags

| Flag                                        | Notes                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `-p, --print`                               | Noninteractive. Default for this skill. Skips the workspace trust dialog. Permissions remain. |
| `--output-format <text\|json\|stream-json>` | Only with `--print`. Default `text`.                                                          |
| `--include-partial-messages`                | Requires `--print` and `--output-format stream-json`.                                         |
| `--include-hook-events`                     | Requires `--output-format stream-json`.                                                       |
| `--input-format <text\|stream-json>`        | Only with `--print`. Default `text`.                                                          |
| `-r, --resume <id>`                         | Session ID required under `--print`. A bare `-r` opens a picker.                              |
| `-c, --continue`                            | Previous session in this directory.                                                           |
| `--model <model>`                           | User-named only. Help aliases: `fable`, `opus`, `sonnet`, or a full name such as `claude-fable-5`. |
| `-w, --worktree [name]`                     | Optional name. Help does not state the path. Record whatever the CLI prints.                  |
| `--permission-mode plan`                    | Read-only. Other values stay in `./permissions.md`.                                           |
| `--session-id <uuid>`                       | Must be a valid UUID.                                                                         |
| `--no-session-persistence`                  | Print only.                                                                                   |
| `--max-budget-usd <amount>`                 | Print only.                                                                                   |
| `--add-dir <directories...>`                | Extra tool-access directories.                                                                |
| `--json-schema <schema>`                    | Structured output.                                                                            |

Gated flags stay in `./permissions.md`. Do not add them here as defaults.

Run from the target directory. This CLI has no flag that retargets cwd.
Wrong cwd is `BLOCKED`.

## `--print` output

`text` (default): final assistant text on stdout. Nothing until the
process exits. Silence is not a hang. Wait using `--wall-clock` in
`SKILL.md`.

`json`: one object on stdout. Do not assume field names. If that object
contains a session identifier, record it for `--resume`. A non-zero exit
is a failed run even if the text claims success.

`stream-json`: NDJSON lines. Do not assume event type names. Keep
reading until the process exits. Mid-stream text is not completion. New
NDJSON lines are liveness for this format only. `text` and `json` have
no live events.

`--include-partial-messages` only with `--print` and `stream-json`.

If a permission prompt appears under `--print`, follow Print-mode
prompts in `./permissions.md`. Do not add a gated skip to satisfy it.

## Subcommands

| Command                         | Use                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `claude [prompt]`               | Interactive TUI. Follow Interactive above.                                           |
| `claude --print [prompt]`       | One-shot. Default.                                                                   |
| `claude auth status --text`     | Auth check. Default of `auth status` is JSON. Do not print secrets.                  |
| `claude auth login`             | Only if the user asked.                                                              |
| `claude auth logout`            | Only if the user asked.                                                              |
| `claude --resume <id>`          | Resume. Id required under `--print`.                                                 |
| `claude mcp …`                  | Only if the user asked. Run `claude mcp --help` for current syntax.                  |
| `claude plugin …`               | Only if the user asked. Run `claude plugin --help`.                                  |
| `claude update` / `install`     | First-run. Only if asked.                                                            |
| `claude doctor`                 | Health check. Only if asked. Reads settings without a trust prompt.                  |
| `attach` / `logs` / `stop` / `rm` | Follow Background in `./orchestration.md`. Only if asked.                          |

There is no top-level `claude status`. Use `claude auth status --text`.

`claude agents --json` lists live and background sessions. It is not a
catalog of configured subagent files.
