# Print output

`json` emits a final `result`: subtype, is_error, result, session_id,
duration_ms, duration_api_ms, request_id, and optional usage.
Record session_id. An error result or nonzero exit is failure.

For a stream, use print with output-format stream-json; add
`--stream-partial-output` only for that format. It emits NDJSON with
session_id. Events include system/init, user, assistant, tool_call,
thinking, retry, connection, interaction_query, and result.

Result is the completion signal, not assistant text or interaction_query.
Interaction queries are live prompts, not corruption. Print skips ask-user
questions; web fetch remains rejected unless an already-authorized force/yolo
waiver exists. Do not add force to satisfy an event. Preserve the query line.
New stream lines indicate liveness; quiet text/json is normal.
Done when a result or process exit is captured and its status is checked.
