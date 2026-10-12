# Print output

`json` emits a final `result`: subtype, is_error, result, session_id,
duration_ms, duration_api_ms, request_id, and optional usage.
Record session_id. An error result or nonzero exit is failure.

For a stream, use `cursor-agent --print --trust --yolo` with output-format
stream-json. Add `--stream-partial-output` only for that format. Plan/ask
keeps `--trust` and omits `--yolo`. The stream emits NDJSON with session_id.
Events include system/init, user, assistant, tool_call,
thinking, retry, connection, interaction_query, and result.

Result is the completion signal, not assistant text or interaction_query.
Interaction queries are live prompts, not corruption. Print skips ask-user
questions. Do not add another force flag to satisfy an event.
Preserve the query line.
New stream lines indicate liveness; quiet text/json is normal.
Done when a result or process exit is captured and its status is checked.
