# Permissions

Print skips workspace trust, not tool permissions. Its permission-prompts
default is `host` (SDK host or permission-prompt-tool). Leave it unset.
A user-named `none` denies actions that would prompt; it is not a bypass.

On a print permission prompt: stop without rerunning, report `AWAITING_USER`
with the prompt, and wait for an answer or a named waiver. Refusal is `BLOCKED`.
Do not switch to a TUI or add a skip to click through the same gate.

## Named waivers

A waiver applies only to the named control, never all rows:

| Control | Boundary |
|---|---|
| dangerously-skip-permissions | Bypasses permission checks |
| allow-dangerously-skip-permissions | Makes that bypass available, not enabled |
| permission-mode bypassPermissions | Same bypass through mode |
| permission-mode dontAsk | Skips asking |
| permission-mode auto | Automatic classifier |
| permission-prompts none | User-named denial of prompts, not bypass |
| agents dangerously-skip-permissions | Same bypass for dispatched sessions |

Default permission mode is omitted. Plan is read-only; acceptEdits/manual
are user-named choices, not bypasses. Restricted refuses bypassPermissions;
mention it only for requested lockdown. A rejected mode requires current
scoped help; it never authorizes a different waiver.
