# Permissions

Calling the skill authorizes the run. Default print includes
`--dangerously-skip-permissions` and does not stop for a permission prompt.
Plan / read-only uses `--permission-mode plan` and omits the skip flag.
If that mode still prompts, report `BLOCKED` with the prompt text. Do not ask
the user, do not add the skip flag, and do not switch to a TUI.

Add another mode only when the user names it: acceptEdits, manual, dontAsk,
auto, or bypassPermissions. `--permission-prompts none` denies actions that
would prompt; it is not the default. `--allow-dangerously-skip-permissions`
only makes the bypass available. Restricted refuses the skip flag; when the
user asked for restricted, omit the skip and do not replace it. A rejected
flag needs current scoped `--help`.
