# Sessions

Use `codex exec --yolo -C <abs-dir> resume <id> "<prompt>"`. The previous
session uses `--last` in that same argv. Fork with
`codex exec --yolo -C <abs-dir> fork <id> "<prompt>"`.
A named sandbox omits `--yolo`.
Record the session id before another follow-up.

Top-level `codex resume` and `codex fork` open/continue a TUI.
`codex queue` sends work. They are not noninteractive resume substitutes:
report `BLOCKED` and request an exec-resume target instead.
Done when the selected follow-up exits or a missing id is reported.
