# Trust and integrations

Follow this file on `Workspace Trust Required`, before `--trust`, and when
the user asked for login, MCP, plugin, worker, or Bedrock.

## Workspace trust

`--trust` is allowed only after the user names this workspace and authorizes
trust for this run. A coding task, a feature request, or `--print` does not
imply trust. `--yolo`, `-f`, and `--force` are not acceptable substitutes
merely to bypass workspace trust. They force-allow commands. That is a
different control. Do not use them to skip the trust prompt.

## Workspace trust refusal

Noninteractive `cursor-agent --print` without `--trust` in an untrusted
workspace exits 1 with this exact text. `<workspace>` is a placeholder for
the workspace path Cursor prints:

```
⚠ Workspace Trust Required

  Cursor Agent can execute code and access files in this directory.
  Do you trust the contents of this directory?

    <workspace>

  To proceed, you can either:
    • Run 'cursor-agent' interactively to decide
    • Pass --trust, --yolo, or -f if you trust this directory
```

The CLI lists `--yolo` and `-f` as bypasses. This skill forbids those
bypasses for trust.

Recovery:

1. Stop. Do not rerun. Do not add `--yolo`, `-f`, or `--force`.
2. Report `AWAITING_USER` with the workspace path from the message.
3. Ask the user to authorize `--trust` for that path.
4. After explicit authorization for this run, rerun the same argv plus
   `--trust` only. Record `trust=waived:<path>` in the ledger.
5. If the user refuses, report `BLOCKED` and stop. Do not switch to an
   interactive `cursor-agent` prompt to click through trust.

`--trust` is not a standing waiver for later tasks.

## Auth

| Command                                        | Use                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `cursor-agent status --format json` / `whoami` | Check login. Do not print tokens, keys, or raw account dumps.      |
| `cursor-agent login`                           | Only when the user asked to authenticate. Honor `NO_OPEN_BROWSER`. |
| `cursor-agent logout`                          | Only when the user asked to sign out.                              |
| `cursor-agent models`                          | Model catalog.                                                     |
| `cursor-agent about --format json`             | Version and account. Redact secrets.                               |

Prefer `CURSOR_API_KEY` in the environment over `--api-key` on argv. Do not
read key files or `.env`. Do not pass keys in `--header`.

Missing auth is `BLOCKED`.

## Bedrock

Run only with an explicit Bedrock request.

| Command                          | Use                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `cursor-agent bedrock configure` | Store credentials. Prefer `--from-env`. Optional `--region`, `--test-model`. |
| `cursor-agent bedrock enable`    | Enable mode. Requires stored credentials.                                    |
| `cursor-agent bedrock status`    | Show configuration and team-role availability.                               |
| `cursor-agent bedrock test`      | Validate stored credentials with the backend.                                |
| `cursor-agent bedrock disable`   | Disable mode. Keep stored credentials.                                       |
| `cursor-agent bedrock clear`     | Clear stored credentials and disable mode.                                   |

`--secret-key` belongs in a prompt to the user, not in a recorded command
line, unless they supplied a non-secret path such as `--from-env`.

## MCP

There is no `cursor-agent mcp add`. Config lives in `.cursor/mcp.json` or
`~/.cursor/mcp.json`. Edit those files only when the user asked to configure
MCP. Then:

| Command                            | Use                                              |
| ---------------------------------- | ------------------------------------------------ |
| `cursor-agent mcp list`            | Names and status.                                |
| `cursor-agent mcp list-tools <id>` | Tool names.                                      |
| `cursor-agent mcp login <id>`      | OAuth for a configured server. User-authorized.  |
| `cursor-agent mcp enable <id>`     | Add to the local approved list. User-authorized. |
| `cursor-agent mcp disable <id>`    | Disable loading. User-authorized.                |

`--approve-mcps` auto-approves every MCP server. Gated. Never pass it to
skip a prompt. Do not enable or disable servers unless the user named them.

## Plugins

| Command                                              | Use                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `--plugin-dir <path>`                                | Load a local plugin directory for this process. Repeatable. |
| `cursor-agent plugin marketplace add <gitUrl>`       | Optional `--git-ref`. User-authorized.                      |
| `cursor-agent plugin marketplace list`               | `--format text\|json`.                                      |
| `cursor-agent plugin marketplace remove <nameOrUrl>` | User-authorized.                                            |
| `cursor-agent plugin marketplace update <nameOrUrl>` | Re-index. User-authorized.                                  |

Do not add or remove marketplaces unless the user named the URL or name.

## Workers

Do not start a worker unless the user asked for My Machines or a pool.

Personal My Machines:

```
cursor-agent worker start
```

Team Self-Hosted Pool (Enterprise, service-account key):

```
cursor-agent worker --pool [name] start
```

Preflight: `cursor-agent worker debug`. Worker flags go before `start`.
Optional `--worker-dir <path>` (repeatable; first path is assignment
identity), `--management-addr <address>` (for example `:8080`),
`--display <display>` (Linux `--computer-use` only). Session hooks live
in `hooks.json`. `--on-session-start` / `--on-session-end` are extras.

Gated worker flags, user waiver required, never as a trust substitute:

| Flag                       | Why gated                                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--computer-use`           | Desktop control.                                                                                                                                                                                                                                       |
| `--share-desktop [mode]`   | Desktop sharing. Linux flag-without-mode defaults to `view_and_control`. macOS defaults to `view`; `view_and_control` is explicit opt-in. If the user named share without a mode, pass `--share-desktop view` on macOS and `--share-desktop` on Linux. |
| `--mint-github-token`      | Injects GitHub tokens. Pool only.                                                                                                                                                                                                                      |
| `--clone-git-repos`        | Clones claimed repos. Implies token minting.                                                                                                                                                                                                           |
| `--sync-dashboard-secrets` | Injects dashboard secrets.                                                                                                                                                                                                                             |
| `--identity-socket`        | OIDC token minting for claimed agents.                                                                                                                                                                                                                 |
| `--auth-token-file`        | Token file. Do not read it.                                                                                                                                                                                                                            |

`--debug` on `worker` prints diagnostics, not `--yolo`. Still avoid dumping
secrets from its output.

## Gated unsafe controls

| Flag                            | Allowed only when                                            |
| ------------------------------- | ------------------------------------------------------------ |
| `--trust`                       | User named this workspace and authorized trust for this run. |
| `--yolo` / `-f` / `--force`     | User named force-allow for commands, not as a trust bypass.  |
| `--sandbox disabled`            | User named sandbox disable.                                  |
| `--approve-mcps`                | User named auto-approve of MCP servers.                      |
| `--auto-review`                 | User named Auto-review. Not a trust or yolo substitute.      |
| `--api-key` on argv             | No env var path and the user supplied the key. Prefer env.   |
| Bedrock `--secret-key`          | User asked to configure Bedrock. Prefer `--from-env`.        |
| Worker desktop/credential flags | User named that worker flag.                                 |

A waiver for one row does not waive the others.
