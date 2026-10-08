# Sessions

Use `codex exec resume <id> "<prompt>"`, or `--last` for the recorded most
recent session. Fork with `codex exec fork <id> "<prompt>"`.
Record the session id before another follow-up.

Top-level `codex resume` and `codex fork` open/continue a TUI.
`codex queue` sends work. They are not noninteractive resume substitutes:
report `BLOCKED` and request an exec-resume target instead.
Done when the selected follow-up exits or a missing id is reported.
