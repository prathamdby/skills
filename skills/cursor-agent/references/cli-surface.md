# CLI surface

Syntax follows local `cursor-agent --help`. If a flag is rejected, re-run
`cursor-agent --help` and use what the binary prints. Do not copy other CLI
or SDK flags. Modes, `--print` writes, `--trust`, and `--wall-clock` stay in
`SKILL.md`.

## First-run

When `cursor-agent` is missing or the user asked to install:

```
curl https://cursor.com/install -fsS | bash
cursor-agent --version
```

If the version command is not found, add `~/.local/bin` to PATH and retry.
On native Windows: `irm 'https://cursor.com/install?win32=true' | iex`, then
`cursor-agent --version`. Then `cursor-agent status --format json`. Do not
print secrets. Missing login is `BLOCKED` unless the user asked to
authenticate: `cursor-agent login` (honors `NO_OPEN_BROWSER`).

`cursor-agent update` only when the user asked to update.
`cursor-agent install-shell-integration` writes `~/.zshrc` even on bash.
Only if asked.

Done when `cursor-agent --version` prints and auth state is recorded.

## Interactive

Only when the user asked for the interactive TUI. Run in the target
workspace:

```
cursor-agent "<prompt>"
```

Omit the prompt to open an empty session. Do not send keystrokes to click
through Workspace Trust, permissions, or any other dialog. If trust appears,
stop and follow Workspace trust refusal in `./trust-integrations.md`. Prefer
`--print` for automation.

Done when the user owns the live TUI, or `BLOCKED` / `AWAITING_USER`.

## Global flags

| Flag                                        | Notes                                                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `-p, --print`                               | Noninteractive. Default for this skill.                                                                                                                                                                      |
| `--output-format <text\|json\|stream-json>` | Only with `--print`. Default `text`.                                                                                                                                                                         |
| `--stream-partial-output`                   | Requires `--print --output-format stream-json`.                                                                                                                                                              |
| `--resume [chatId]`                         | Noninteractive resume needs an id.                                                                                                                                                                           |
| `--continue`                                | Previous session in this directory.                                                                                                                                                                          |
| `--model <model>`                           | Example: `gpt-5`, `sonnet-4-thinking`, or quoted bracket overrides.                                                                                                                                          |
| `--list-models`                             | List models and exit. Same catalog as `cursor-agent models`.                                                                                                                                                 |
| `--workspace <path-or-name>`                | Target directory or saved name. Default cwd.                                                                                                                                                                 |
| `--add-dir <path>`                          | Extra workspace root. Repeatable.                                                                                                                                                                            |
| `--plugin-dir <path>`                       | Load a local plugin directory. Repeatable.                                                                                                                                                                   |
| `-w, --worktree [name]`                     | Isolated worktree at `~/.cursor/worktrees/<reponame>/<name>`.                                                                                                                                                |
| `--worktree-base <branch>`                  | Base ref. Default current HEAD.                                                                                                                                                                              |
| `--skip-worktree-setup`                     | Skip `.cursor/worktrees.json` setup scripts.                                                                                                                                                                 |
| `--auto-review`                             | Smart Auto. A server classifier auto-runs tool calls it labels safe and prompts for the rest. Default off. Pass only when the user asked for Auto-review. Not `--trust`, not `--yolo`, not a sandbox change. |
| `--sandbox <enabled\|disabled>`             | Overrides config. `enabled` turns sandboxing on. `disabled` is gated.                                                                                                                                        |
| `-H, --header <Name: Value>`                | Repeatable. Do not put secrets on argv.                                                                                                                                                                      |
| `-e, --endpoint <url>`                      | Or `CURSOR_API_ENDPOINT`. Default `https://api2.cursor.sh`.                                                                                                                                                  |
| `--api-key <key>`                           | Or `CURSOR_API_KEY`. Prefer the env var. Never echo the key.                                                                                                                                                 |

Gated flags (`--trust`, `--yolo`, `-f`, `--force`, `--approve-mcps`,
`--sandbox disabled`) stay in `./trust-integrations.md`. Do not add them here
as defaults.

## `--print` output

`text` (default): final assistant text on stdout. Nothing until the process
exits. Silence is not a hang. Wait using `--wall-clock` in `SKILL.md`.

`json`: one object on stdout.

```
type: result
subtype: success
is_error: false
duration_ms
duration_api_ms
result
session_id
request_id
usage? (optional)
```

Capture `session_id` for `--resume`. `is_error` true or a non-zero exit is a
failed run even if `result` text claims success.

`stream-json`: NDJSON events, each with `session_id`. Observed types:

| type                | subtype                                          | Role                                 |
| ------------------- | ------------------------------------------------ | ------------------------------------ |
| `system`            | `init`                                           | cwd, model, `permissionMode`         |
| `user`              |                                                  | echoed prompt                        |
| `assistant`         |                                                  | text                                 |
| `tool_call`         | `started` / `completed`                          | tool use                             |
| `thinking`          | `delta` / `completed`                            | thinking                             |
| `retry`             |                                                  | retry                                |
| `connection`        |                                                  | connection                           |
| `system`            | `background_shell_timeout` / `task_notification` | side status                          |
| `interaction_query` | `request` / `response`                           | Permission or question prompt        |
| `result`            | `success`                                        | terminal object, same fields as json |

`interaction_query` is a live `--print` event, not corruption and not
completion. Keep the line. `--print` auto-skips ask-user questions. Web
fetch stays rejected unless a named `--force` / `--yolo` waiver is already
in argv. Do not add force to satisfy this event. Wait for `result`.

`--stream-partial-output` emits assistant text as individual deltas. Without
`stream-json` the CLI exits 1 with
`Error: --stream-partial-output requires --output-format stream-json`.

## Subcommands

| Command                                    | Use                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `cursor-agent [prompt]`                    | Interactive TUI. Follow Interactive above.                             |
| `cursor-agent --print [prompt]`            | One-shot. Default.                                                     |
| `cursor-agent persist [prompt]`            | Session that survives disconnects.                                     |
| `cursor-agent persist list`                | List persistent sessions.                                              |
| `cursor-agent persist attach <session>`    | Attach.                                                                |
| `cursor-agent persist stop <session>`      | Stop.                                                                  |
| `cursor-agent create-chat`                 | Print a new chat id for `--resume`.                                    |
| `cursor-agent ls`                          | Interactive session picker. Avoid under `--print`.                     |
| `cursor-agent resume`                      | Interactive latest-session resume. Prefer `--resume <id>`.             |
| `cursor-agent login` / `logout`            | Auth. Follow Auth in `./trust-integrations.md`.                        |
| `cursor-agent status` / `whoami`           | Auth status. `--format text\|json`.                                    |
| `cursor-agent models`                      | List models.                                                           |
| `cursor-agent about`                       | Version, system, account. `--format text\|json`. Do not paste secrets. |
| `cursor-agent mcp …`                       | Follow MCP in `./trust-integrations.md`.                               |
| `cursor-agent plugin marketplace …`        | Follow Plugins in `./trust-integrations.md`.                           |
| `cursor-agent worker …`                    | Follow Workers in `./trust-integrations.md`.                           |
| `cursor-agent bedrock …`                   | Follow Bedrock in `./trust-integrations.md`.                           |
| `cursor-agent generate-rule` / `rule`      | Interactive. Only if asked.                                            |
| `cursor-agent update`                      | Follow First-run. Only if asked.                                       |
| `cursor-agent install-shell-integration`   | Edits `~/.zshrc`. Only if asked.                                       |
| `cursor-agent uninstall-shell-integration` | Only if asked.                                                         |
