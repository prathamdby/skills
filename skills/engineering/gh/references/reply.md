# Reply

Exactly one native target: in-reply-to databaseId/discussion_rN/comment URL,
or conversation. Exactly one body: body-file (preferred) or literal body argv.
Conflicting targets/bodies and empty content block. Nested ids resolve to the
thread root before POST. Posting does not resolve threads, push, or merge.
A failed inline GET or replies POST exits 1, unless that same body is already
in the thread. Then the process exits 0 and posts nothing more. Stderr on
failure is the original error, then a line that tells the caller to post the
same body with --conversation. This process does not post that fallback. A
review comment with no id is that failure.

JSON: {kind:"thread"|"conversation",id,url,inReplyTo,body}.
URL is posted html_url; inReplyTo is the root comment id, otherwise null.
Use the printed native URL as evidence, not the draft body as proof of posting.
