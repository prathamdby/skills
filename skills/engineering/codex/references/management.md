# Review, interactive, and management commands

Review uses the leaf argv, which includes `--yolo`:
`codex --yolo review --base <branch>`, `--uncommitted`, or `--commit <sha>`.
Optional title/prompt are user-derived. Top-level review
rejects sandbox, -C, JSON, and skip-git-repo-check: run in the target cwd.
For exec output flags use `codex exec --yolo review`. A named sandbox omits
`--yolo`. A rejected `--yolo` on review uses scoped help and does not become
a prompt. Done when the review process exits.

For a requested TUI run `codex "<prompt>"` in the workspace; the user owns it.
For login, MCP, plugins, or update, obtain current syntax from the relevant
subcommand's help. Change only user-named servers, plugins, marketplaces,
or auth state.
Named sandbox and setup failure remain in `sandbox.md`. Global search/approval
flags precede exec and are added only when the user names them.
Done when the command result or intended live TUI is verified.
