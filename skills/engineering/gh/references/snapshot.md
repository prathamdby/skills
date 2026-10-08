# Snapshot JSON

Keep upstream keys; body truncation is marked unless full was requested.
Fields: number, title, state, isDraft, author.login, url, createdAt, baseRefName,
headRefName, headRefOid, mergeable, mergeStateStatus, reviewDecision, additions,
deletions, changedFiles, body; files[{path,additions,deletions}], filesCapped;
comments[{author.login,createdAt,body}]; checks[{name,state,bucket}];
threads{open,total,capped}; reviewsLatest keyed by login.

Buckets: pass/fail/pending/skipping/cancel. Thread cap means more pages.
Text files are sliced at 50; filesCapped warns about more pages. JSON pages
files until complete; that may require extra calls, not the one-query fast path.
Initial query uses files first 50, latest 50 reviews, latest five comments,
first 100 thread counts, and latest commit's first 100 check contexts.
Complexity/timeout/5xx falls back to split view/checks/thread-count requests.
