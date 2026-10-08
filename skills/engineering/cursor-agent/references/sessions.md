# Sessions

Use `cursor-agent --print --resume <id> "<prompt>"` for a known id, or
`--continue` for the previous directory session; both conflict.
Get an id from JSON result, stream system/init or result, or `create-chat`.
Resume without an id, `ls`, and top-level `resume` are interactive pickers.

For requested disconnect survival, use `cursor-agent persist "<prompt>"`.
Record its name; use `cursor-agent persist list`, `persist attach <session>`,
or `persist stop <session>`. Stop only sessions this run created unless kept.
Done when the follow-up exits or the intended live session is recorded.
