# Sessions

Known id: `claude --print --resume <id> "<follow-up>"`.
Previous directory session: `claude --print --continue "<follow-up>"`.
Resume without an id is an interactive picker, not a print command.
Record the id; resume and continue conflict.

Only for requested background operation, use `claude --print --bg "<prompt>"`.
Record its id; use `claude attach <id>` or `claude logs <id>`.
`claude agents --json` lists sessions, not configured subagent files.
Stop/remove only this run's background sessions using `claude stop <id>`
then `claude rm <id>`, unless the user asked to keep them.
Done when the follow-up exits or the intended live id and cleanup policy are recorded.
