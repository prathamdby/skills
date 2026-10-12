# Print output

`json` emits one final object. Do not assume field names; record an available
session identifier. `stream-json` emits NDJSON; event names are not assumed.
Read until process exit: mid-stream text is not completion. New NDJSON is
liveness for streams only. Nonzero exit fails even when text claims success.

Use `claude --print --dangerously-skip-permissions --output-format <json|stream-json> "<prompt>"`.
Plan/read-only omits the skip flag and uses `--permission-mode plan`.
Partial messages require print and stream-json; hook events require stream-json.
A prompt on a default run means the skip flag was missing: rerun once with it.
A prompt in plan/read-only is `BLOCKED`; do not add the skip flag.
Done when the process exits and output plus status are captured.
