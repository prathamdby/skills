# Sandbox

Default exec passes `--yolo` and does not ask for approval. A named sandbox
replaces `--yolo` with `--sandbox <mode>`. Read-only and workspace-write
constrain model-generated shell, not the whole process. Help lists no default
sandbox. Setup failure, including bubblewrap failure, is `BLOCKED`; do not
ask and do not add another bypass.

`--full-auto` is rejected in every position and is not a sandbox value.
Current sandbox values are read-only, workspace-write, and danger-full-access.
Skip-git-repo-check is explicit opt-in for exec; review rejects it.
Do not initialize a temporary repo to evade the check.

Add one of these only when the user names that control:

- dangerously-bypass-hook-trust
- sandbox danger-full-access
- approve-for-me
- ask-for-approval never (global, before exec)
- ignore-rules

Inspect scoped help on rejected syntax. Do not pass `--yolo` together with
`--dangerously-bypass-approvals-and-sandbox`.
