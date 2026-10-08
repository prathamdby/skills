# Reply

Exactly one native target: in-reply-to databaseId/discussion_rN/comment URL,
or conversation. Exactly one body: body-file (preferred) or literal body argv.
Conflicting targets/bodies and empty content block. Nested ids resolve to the
thread root before POST. Posting does not resolve threads, push, or merge.

JSON: {kind:"thread"|"conversation",id,url,inReplyTo,body}.
URL is posted html_url; inReplyTo is the root comment id, otherwise null.
Use the printed native URL as evidence, not the draft body as proof of posting.
