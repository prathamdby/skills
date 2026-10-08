# Interactive and management commands

For a requested TUI run `claude "<prompt>"` in the target directory, omitting
prompt for an empty session. The user owns dialogs; automation uses print.
Do not switch to a TUI to bypass a print permission refusal.

Use scoped help for a requested auth, MCP, plugin, doctor, install, or update
command. Change auth/config/plugins only within that request's named scope.
There is no top-level status: auth status is `claude auth status --text`.
`claude help` and remote-control are not help. Gated options remain in
`permissions.md`; normal syntax discovery never authorizes one.
Done when the authorized command result or intended live TUI is verified.
