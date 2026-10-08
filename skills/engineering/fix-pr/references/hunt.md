# Complete hunt

Read gh's skill first. Scripts supply discussions and CI drilldown, not
proof that every REST root or blocking check is covered. Apply raw-gh
gotchas through the gh skill before uncovered API calls. Set NO_COLOR=1.

Reuse successful `pr-threads --json --open --complete` output for surfaces
1–2 when its completeness markers are false; do not repeat its GraphQL.
Consult recipes 1–2 only after `run` fails or a cap marker is set, to identify
missing coverage. Follow gh's BLOCKED handling, never reimplement its GraphQL.

1. Required script coverage: unresolved GraphQL reviewThreads, including
   outdated, through the last page; match totalCount when supplied.
2. Required script coverage: every thread's comments through the last page,
   retaining root databaseId, thread/comment IDs, author, path/line, body, URL,
   and replies.
3. Reconcile all `repos/<owner>/<repo>/pulls/<N>/comments` with --paginate;
   rebuild in_reply_to_id chains and add roots absent from GraphQL. Always run
   this REST reconciliation; script success does not prove all roots are present.
4. Fetch all nonempty review bodies unless complete-script moreReviews is false.
5. Fetch all nonempty conversation comments unless moreComments/moreConvo are false.
6. Page head-SHA check runs and necessary status contexts, classify required/
   blocking checks, and page actionable annotations tied to that SHA.
   Keep distinct check/annotation claims; pending/in-progress waits for a new run.

Record count, cursor/page, and completion for each loop. Any failed page or
set completeness marker blocks; partial data never counts as exhaustive.
Unavailable required/blocking classification blocks with the missing evidence,
not a guessed complete hunt.
Clean up only temporary files created by this run.

## Finding identity

Split claims only for different code paths/verdicts; supporting points share
the native parent. Stable key: source-root | path | line-range | rule-id |
normalized-claim. Deduplicate only identical keys, prefer thread then review,
conversation, check, and retain every native reply target.
Skip empty bodies, pure acknowledgments, resolved threads without new replies,
and actionless status messages. Done when six complete surfaces reconcile.
