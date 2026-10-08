# Review, interactive, and management commands

Review uses `codex review --base <branch>`, `--uncommitted`, or `--commit <sha>`.
Optional title/prompt are user-derived. Top-level review rejects sandbox, -C,
JSON, and skip-git-repo-check: run in the target cwd. For exec output flags use
`codex exec review`. Done when the review process exits.

For a requested TUI run `codex "<prompt>"` in the workspace; the user owns it.
For login, MCP, plugins, or update, obtain current syntax from the relevant
subcommand's help. Change only user-named servers, plugins, marketplaces,
or auth state.
Sandbox and gated controls remain in `sandbox.md`. Global search/approval flags
precede exec. Done when the authorized result or intended live TUI is verified.
