# Permissions

Follow this file on a permission prompt under `--print`, and before any
gated flag.

`--print` skips the workspace trust dialog. That is not a permission
skip. Permission mode still applies. Prompts go to the host by default.

## Print-mode prompts

Exact `--permission-prompts` help:

```
Who answers permission prompts with --print: "host" (the SDK host or
--permission-prompt-tool) or "none" (nobody: anything that would prompt
is denied automatically; the permission mode still decides everything
else) (choices: "host", "none", default: "host")
```

Default is `host`. Leave it unset unless the user named a value.

`--permission-prompts none` is user-named. It denies anything that would
prompt. It is not a bypass. Do not add it to recover a stuck prompt.

Recovery when a prompt appears under `--print`:

1. Stop. Do not rerun. Do not add `--dangerously-skip-permissions`,
   `--allow-dangerously-skip-permissions`, or `--permission-mode`
   `bypassPermissions` / `dontAsk` / `auto`.
2. Report `AWAITING_USER` with the prompt text.
3. Wait for the user to answer the prompt or name a gated waiver.
4. If the user refuses, report `BLOCKED` and stop. Do not switch to an
   interactive TUI to click through the prompt.

Never add `--dangerously-skip-permissions` because `--print` "skips
dialogs". It skips the trust dialog only.

## Gated flags

Named user waiver required. Never as a default. Never to recover a
prompt. A waiver for one row does not waive the others.

| Argv | Help text / why gated |
| --- | --- |
| `--dangerously-skip-permissions` | "Bypass all permission checks. Recommended only for sandboxes with no internet access." |
| `--allow-dangerously-skip-permissions` | "Enable bypassing all permission checks as an option, without it being enabled by default. Recommended only for sandboxes with no internet access." |
| `--permission-mode bypassPermissions` | Same bypass, via mode. |
| `--permission-mode dontAsk` | Skips asking. Do not assume it is safe. |
| `--permission-mode auto` | Auto-mode classifier. User-asked only. |
| `--permission-prompts none` | User-named. Denies prompts. Not a bypass. |
| `claude agents --dangerously-skip-permissions` | Same bypass on dispatched sessions. |

`--permission-mode` help choices: `acceptEdits`, `auto`,
`bypassPermissions`, `manual`, `dontAsk`, `plan`. This skill defaults
to omitting the flag. `plan` is the read-only value in `SKILL.md`.
`acceptEdits` and `manual` are user-named, not bypasses.

`--restricted` refuses `bypassPermissions`. Mention it only when the
user asked for lockdown.
