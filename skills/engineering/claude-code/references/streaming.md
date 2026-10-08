# Print output

`json` emits one final object. Do not assume field names; record an available
session identifier. `stream-json` emits NDJSON; event names are not assumed.
Read until process exit: mid-stream text is not completion. New NDJSON is
liveness for streams only. Nonzero exit fails even when text claims success.

Use `claude --print --output-format <json|stream-json> "<prompt>"`.
Partial messages require print and stream-json; hook events require stream-json.
If a permission prompt appears, apply `permissions.md`; never add a skip.
Done when the process exits and output plus status are captured.
