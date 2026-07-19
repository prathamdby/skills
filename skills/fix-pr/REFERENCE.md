# Fix PR reference

Load Hunt recipes only when platform-native tools cannot prove full coverage.
Load Reply contracts only after the finding set is stable.

## GitHub hunt recipes

Set `NO_COLOR=1`. Substitute owner, repo, number, and head SHA from the ledger.

1. GraphQL: page `pullRequest.reviewThreads(first:100, after:$cursor)` until
   `hasNextPage` is false. Keep unresolved nodes, including outdated ones. When
   `totalCount` is available, collected thread count must match it.
2. For each kept thread, page `comments(first:100, after:$cursor)` until false.
   Collect thread ID, root `databaseId`, author, path, line, body, URL, and every
   reply.
3. REST cross-check all review comments:
   `gh api "repos/<owner>/<repo>/pulls/<number>/comments" --paginate`.
   Rebuild chains through `in_reply_to_id`; add roots absent from GraphQL.
4. Fetch non-empty review bodies:
   `gh api "repos/<owner>/<repo>/pulls/<number>/reviews" --paginate`.
5. Fetch non-empty conversation comments:
   `gh api "repos/<owner>/<repo>/issues/<number>/comments" --paginate`.
6. Fetch check runs for the head SHA, then paginate annotations for each run.
   Add only actionable annotations tied to the PR head.

For every page loop, store item count, end cursor or page number, and completion
boolean. A failed page makes the hunt `BLOCKED`; never treat partial data as
complete. Clean up temporary files on every exit.

## Normalization

- Split only claims that require different code paths or verdicts; keep
  supporting sub-points in one finding and preserve the parent reply target.
- Deduplicate only identical stable keys. Prefer thread, then review, then
  conversation, then check.
- Never discard another native reply target during deduplication.
- Skip empty bodies, pure acknowledgments, resolved threads without new
  replies, and status messages with no requested action.
- Stable key:
  `source-root | path | line-range | rule-id | normalized-claim`.

## Reply contracts

Reply to inline findings through their root review-comment reply endpoint.
Review-body and conversation findings receive one PR conversation comment per
shared parent. Check annotations use their linked conversation surface when
one exists; otherwise report them without inventing a reply target.

Reply forms:

- `fix`: `Fixed in <sha>. <concrete change>.`
- `reject`: `<Conclusion>. <path:line or test evidence>.`
- `clarify`: `<Observed behavior>. <specific question or contract>.`
- `already-fixed`: `Already fixed in <sha> at <path:line>.`

A fixed reply requires a pushed SHA. Reject and clarify replies require the
ledger evidence. Consolidated replies contain one short bullet per finding.

For author `semgrep-code-scan`, preserve one required prefix exactly:

- false positive: `/fp <reason>`
- acceptable risk: `/ar <reason>`
- other dismissal: `/other <reason>`

Do not post a command prefix for a fixed finding. Never resolve a thread unless
the user explicitly asked.
