# Fix PR reference

Load Hunt recipes per GitHub hunt recipes (scripts never replace recipe 3 or 6).
Load Commit clean-room only while Step 5 has a diff to commit.
Load Reply contracts only after the finding set is stable.

## Commit clean-room

The commit message describes the locked code diff, never the fix-pr session.
Replies may say the work answered review; the commit subject and body may not.
Discard any subject drafted before the commit skill runs. Draft only from
locked hunks as `type: <concrete code action>`. Trailers default deny: never
draft or pass `Co-authored-by` / `Signed-off-by` / `Made-with` or freeform
harness footers such as `Made with Cursor` unless the user explicitly requests
trailers for this run. After commit, scan `%B` and apply Trailer hygiene in
`../commit/REFERENCE.md` when banned keys or harness lines appear.

Ban-list — any hit in subject or body is `BLOCKED` before push:

- `address` with review, feedback, findings, comments, threads, or requests
- `review feedback`, `review findings`, `review comments`, `review follow-up`
- `per review`, `per feedback`, `as requested`, `from review`, reviewer names
- ledger labels, branch-name claims, or "PR history" framing
- identity or harness trailer lines `Co-authored-by:`, `Signed-off-by:`,
  `Made-with:`, or freeform `Made with Cursor` / Claude marketing lines unless
  allowed

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
| "Hooks or the agent always add Co-authored-by" | Strip via Trailer hygiene before push. |
| "Harness appends Made with Cursor" | Strip via Trailer hygiene before push. |

Red flags — rewrite before `git commit` or block before push:

- Any ban-list token above
- A subject reused from a teammate, manager, or ledger draft
- A subject that still makes sense if the diff is deleted and only the PR
  conversation remains
- Banned identity or harness trailers in `%B` when trailers are denied

## GitHub hunt recipes

Scripts vs recipes: after reading `../gh/SKILL.md`, that skill's
`pr-threads.ts` and `ci-failures.ts` feed hunt surfaces 1–2 and CI
log/annotation snippets. They do not replace recipes 1–6 wholesale. Recipe 3
always runs (REST review-comment reconcile); a successful script is not proof
REST roots are present. Skip recipes 4–5 only when `--complete` JSON has
complete page markers (`moreReviews`/`moreComments`/`moreConvo` false). Recipe
6 always runs for SHA-pinned required/blocking checks and annotations;
`ci-failures` is drilldown only. Load remaining recipes when `run` exits after
trying every runtime (bun, nub, tsx, nvm, Node strip-types) or a cap marker is
set. `node -v` below 23 and `ERR_UNKNOWN_FILE_EXTENSION` are not script
failure. Script JSON additive fields `id`, `databaseId`, `url` are the reply
targets from threads; REST reconcile may add roots.

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
6. PR CI for the head SHA:
   - List check runs (and status contexts when required for merge) for the
     head SHA. Page until complete.
   - Normalize each terminal non-success required or blocking check as a
     finding (name, conclusion, URL, head SHA). Skip pure pending or
     in-progress runs; re-hunt after they finish if they remain blocking.
   - Paginate annotations for each run. Add only actionable annotations tied
     to the PR head. Prefer one finding per distinct failure claim; keep
     both the check-run finding and its annotations when they differ.

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

Post through the loaded gh skill `pr-reply.ts`. Inline findings use
`--in-reply-to` with the root review-comment `databaseId` (nested ids resolve
to that root). Review-body and conversation findings use `--conversation`, one
PR conversation comment per shared parent. Check-run and annotation findings
use their linked conversation surface when one exists; otherwise report them
without inventing a reply target. Do not invent raw `gh` for a covered reply.

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
