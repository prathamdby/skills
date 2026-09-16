# CLI surface

Syntax follows local `codex --help`. If a flag is rejected, re-run
`codex --help` or `codex exec --help` and use what the binary prints.
Sandbox, gated flags, and `--skip-git-repo-check` stay in `./sandbox.md`.
`--wall-clock` stays in `SKILL.md`.

## First-run

When `codex` is missing or the user asked to install:

```
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex --version
```

Prefer `~/.local/bin/codex`. If the version command is not found, add
`~/.local/bin` to PATH and retry. On native Windows:
`irm https://chatgpt.com/codex/install.ps1 | iex`, then `codex --version`.
Then `codex login status`. Do not print secrets. Missing login is
`BLOCKED` unless the user asked to authenticate. Follow Auth below.

`codex update` only when the user asked to update.

Done when `codex --version` prints and auth state is recorded.

## Interactive

Only when the user asked for the interactive TUI. Run in the target
workspace:

```
codex "<prompt>"
```

Omit the prompt to open an empty session. Do not drive the TUI. Prefer
`codex exec` for automation.

Done when the user owns the live TUI, or `BLOCKED` / `AWAITING_USER`.

## Flag order

`--search` and `--ask-for-approval` are global. They must appear before
`exec`:

```
codex --search exec -C <abs-dir> "<prompt>"
codex --ask-for-approval on-request exec -C <abs-dir> "<prompt>"
```

`codex exec --search` and `codex exec --ask-for-approval` exit 2
(`unexpected argument`). Those placements are `BLOCKED`.
`--ask-for-approval never` is gated. Follow `./sandbox.md`.

`--sandbox`, `-C`, `-m`, and `--worktree` are accepted on `exec` or
before it.

## Exec output

Default `exec` prints assistant text on stdout. Nothing until the
process exits. Silence is not a hang. Wait using `--wall-clock` in
`SKILL.md`.

`--json` prints events to stdout as JSONL. Read line by line. Do not
invent an event schema. A non-zero exit is a failed run even if a line
claims success.

`-o, --output-last-message <FILE>` writes the last agent message to that
file.

## Review

Review is `codex review`, not a generic `exec` prompt and not a `--plan`
flag.

```
codex review --base <BRANCH>
codex review --uncommitted
codex review --commit <SHA>
```

Optional `--title <TITLE>` and a prompt. Top-level `review` rejects
`--skip-git-repo-check`, `--sandbox`, `-C`, and `--json`. For JSONL or
exec-style output, use `codex exec review` with the same review flags.

Done when the review process exits.

## Sessions

Noninteractive resume is `codex exec resume`, not the TUI picker.

```
codex exec resume <SESSION_ID> "<prompt>"
codex exec resume --last "<prompt>"
codex exec fork <SESSION_ID> "<prompt>"
```

`codex resume` and `codex fork` without `--help` open an interactive
picker or continue a TUI session. `codex queue` sends work. Those are
`BLOCKED`. Ask for `exec resume` and an id.

## Auth

| Command                            | Use                                                                  |
| ---------------------------------- | -------------------------------------------------------------------- |
| `codex login status`               | Check login. Do not print tokens or keys.                            |
| `codex login`                      | Only when the user asked to authenticate. Starts a login flow.       |
| `codex login --with-api-key`       | Reads the API key from stdin. Only if asked. Do not echo the key.    |
| `codex login --with-access-token`  | Reads `CODEX_ACCESS_TOKEN` from stdin. Only if asked.                |
| `codex logout`                     | Only when the user asked to sign out.                                |

Missing auth is `BLOCKED`.

## MCP

Only when the user asked to configure MCP.

| Command                                                      | Use                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `codex mcp list [--json]`                                    | Names.                                                      |
| `codex mcp get <NAME> [--json]`                              | One server.                                                 |
| `codex mcp add <NAME> (--url <URL> \| -- <COMMAND>...)`      | User-named. Optional `--env`, `--bearer-token-env-var`.     |
| `codex mcp remove <NAME>`                                    | User-named.                                                 |
| `codex mcp login <NAME>`                                     | User-authorized.                                            |
| `codex mcp logout <NAME>`                                    | User-authorized.                                            |

Do not add or remove servers unless the user named them.

## Plugins

Only when the user asked to manage plugins.

| Command                                      | Use                                              |
| -------------------------------------------- | ------------------------------------------------ |
| `codex plugin add <PLUGIN[@MARKETPLACE]>`    | Optional `-m`. User-authorized.                  |
| `codex plugin list`                          | Optional `-m`, `--json`, `--available`.          |
| `codex plugin remove <PLUGIN[@MARKETPLACE]>` | User-authorized.                                 |
| `codex plugin marketplace add <SOURCE>`      | Optional `--ref`, `--sparse`. User-authorized.   |
| `codex plugin marketplace list`              | List sources.                                    |
| `codex plugin marketplace upgrade`           | User-authorized.                                 |
| `codex plugin marketplace remove <NAME>`     | User-authorized.                                 |

Do not add or remove plugins or marketplaces unless the user named them.

## Subcommands

| Command              | Use                                              |
| -------------------- | ------------------------------------------------ |
| `codex [prompt]`     | Interactive TUI. Follow Interactive above.       |
| `codex exec [prompt]`| One-shot. Default.                               |
| `codex review`       | Review branch. Follow Review above.              |
| `codex exec resume`  | Noninteractive resume. Follow Sessions.          |
| `codex exec fork`    | Noninteractive fork. Follow Sessions.            |
| `codex exec review`  | Review with exec output flags.                   |
| `codex login` / `logout` | Auth. Follow Auth above.                     |
| `codex mcp …`        | Follow MCP above.                                |
| `codex plugin …`     | Follow Plugins above.                            |
| `codex update`       | Follow First-run. Only if asked.                 |
