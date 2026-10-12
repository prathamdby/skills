# Exec output

Use `codex exec --yolo --json -C <abs-dir> "<prompt>"` for JSONL. A named
sandbox omits `--yolo`. Read line by line without inventing an event catalog.
New lines indicate stream liveness;
default exec text can remain silent until exit.

For only the final message, use `codex exec --yolo -o <FILE> -C <abs-dir> "<prompt>"`.
The output path must be the path the user named, and it is recorded. An early-written file is
not proof of completion: record process exit. Nonzero exit fails even when
a message claims success. Done when process status and requested output exist.
