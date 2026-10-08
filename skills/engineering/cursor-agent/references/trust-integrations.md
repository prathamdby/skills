# Trust and authorization

Trust needs the user to name this workspace and authorize this run.
Coding, print, and a prior task's waiver do not imply trust.
Force/yolo can force-allow commands; they are not substitutes for workspace trust.

## Workspace Trust Required

Untrusted noninteractive print exits 1 with `Workspace Trust Required` and
the workspace path. Although the CLI suggests trust, yolo, or -f:

1. Stop without rerunning or adding force.
2. Report `AWAITING_USER` with the printed workspace path.
3. Request authorization for `--trust` on that path.
4. After approval, rerun the same argv plus trust only; record `trust=waived:<path>`.
5. Refusal is `BLOCKED`; a TUI is not a way around it.

## Independent waivers

Trust is workspace-scoped. Each other control needs its own named request:
force/yolo/-f, sandbox disabled, approve-mcps, and worker desktop/credential
flags. Auto-review is explicit opt-in and not a trust/yolo/sandbox change.
Prefer CURSOR_API_KEY in the environment, not argv or headers; do not read
key files or `.env`, or expose account dumps.

For requested login, MCP, plugin, Bedrock, or worker operations, apply the
matching branch in `integrations.md`. A waiver for one operation grants no
other credential, desktop, server, or configuration access.
