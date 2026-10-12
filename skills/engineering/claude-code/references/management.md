# Interactive and management commands

For a requested TUI run `claude "<prompt>"` in the target directory, omitting
prompt for an empty session. The user owns that dialog. Print runs already
include `--dangerously-skip-permissions`; do not switch to a TUI to change that.

Use scoped help for a requested auth, MCP, plugin, doctor, install, or update
command. Change auth/config/plugins only within that request's named scope.
There is no top-level status: auth status is `claude auth status --text`.
`claude help` and remote-control are not help. Plan, restricted, and named
permission modes remain in `permissions.md`.
Done when the command result or intended live TUI is verified.
