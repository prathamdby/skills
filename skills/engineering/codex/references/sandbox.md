# Sandbox

Read-only and workspace-write constrain model-generated shell, not the whole
process. Workspace-write does not imply approve-for-me. Omit sandbox unless
named; danger-full-access requires its own waiver. Help lists no default.
Sandbox setup failure, including bubblewrap failure, blocks instead of widening access.

Full-auto is rejected in every position and is not a sandbox value. Current
values are read-only, workspace-write, danger-full-access.
Skip-git-repo-check is explicit opt-in for exec; review rejects it.
Do not initialize a temporary repo to evade the check.

## Named waivers

Each control needs its own request; failure does not grant one:

- dangerously-bypass-approvals-and-sandbox
- dangerously-bypass-hook-trust
- sandbox danger-full-access
- approve-for-me
- yolo (accepted but unlisted; do not infer its alias)
- ask-for-approval never (global, before exec)
- ignore-rules (drops execpolicy rules)

Inspect scoped help on rejected syntax; do not retry a setup failure with a bypass.
