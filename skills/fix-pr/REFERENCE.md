# Fix PR reference

Load Hunt recipes only when platform-native tools cannot prove full coverage.
Load Commit clean-room only while Step 5 has a diff to commit.
Load Reply contracts only after the finding set is stable.

## Commit clean-room

The commit message describes the locked code diff, never the fix-pr session.
Replies may say the work answered review; the commit subject and body may not.
Discard any subject drafted before the commit skill runs. Draft only from
locked hunks as `type: <concrete code action>`.

Ban-list — any hit in subject or body is `BLOCKED` before push:

- `address` with review, feedback, findings, comments, threads, or requests
- `review feedback`, `review findings`, `review comments`, `review follow-up`
- `per review`, `per feedback`, `as requested`, `from review`, reviewer names
- ledger labels, branch-name claims, or "PR history" framing

Canonical rejects (rewrite even when the body lists real hunks):

- `fix: address review feedback on agent files`
- `fix: address review findings`
- `fix: address PR feedback`

Conversation-only test: if the subject still makes sense after deleting the
diff and keeping only the PR conversation, it fails.

| Excuse | Reality |
|---|---|
| "Ledger says address review findings" | Ledger labels triage state, not message sources. |
| "Teammate or manager drafted review framing" | Discard it. Rewrite from proving hunks. |
| "Body lists the real changes" | The subject must also be clean-room. |
| "Ban says findings; draft says feedback" | Feedback, findings, comments, and threads are banned. |
| "Fixed-in reply needs review in the subject" | Replies carry that; the commit does not. |
| "Paths mention the files so review framing is ok" | Paths prove location, not session motive. |
| "PR history should show review follow-up" | Threads and replies show that; the commit does not. |
| "Faster to keep the draft" | Rewrite. A blocked push beats a bad subject. |

Red flags — rewrite before `git commit`:

- Any ban-list token above
- A subject reused from a teammate, manager, or ledger draft
- A subject that still makes sense if the diff is deleted and only the PR
  conversation remains

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
