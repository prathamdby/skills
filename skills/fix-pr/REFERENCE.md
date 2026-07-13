# Fix PR reference

Substitute `<OWNER>`, `<REPO>`, and `<NUMBER>` from Step 1.

## Feedback surfaces

Every run must gather all three. Dedup by meaning, not by API endpoint.

| Source    | What it is                                              | Reply target                         |
| --------- | ------------------------------------------------------- | ------------------------------------ |
| `thread`  | Unresolved inline review thread (root + replies)        | Root review comment `databaseId`     |
| `review`  | Top-level review body with actionable findings          | Review `id` (reply via issue comment)|
| `comment` | PR conversation (issue) comment with actionable findings| Issue comment `id`                   |

## Fetch unresolved review threads

`gh api graphql` injects ANSI escapes even when piped. Set `NO_COLOR=1` and strip
with `sed` before parsing JSON.

```bash
THREADS_FILE="$(mktemp /tmp/pr_review_threads.XXXXXX).json"
CURSOR=""
ALL_THREADS="[]"
while true; do
  AFTER_ARG=""
  if [ -n "$CURSOR" ]; then
    AFTER_ARG="-f cursor=$CURSOR"
  fi
  PAGE=$(NO_COLOR=1 gh api graphql -f owner="<OWNER>" -f name="<REPO>" -F number=<NUMBER> $AFTER_ARG -f query='
  query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewThreads(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            isResolved
            comments(first: 50) {
              nodes {
                author { login }
                path
                line
                body
                databaseId
                url
              }
            }
          }
        }
      }
    }
  }' | sed 's/\x1b\[[0-9;]*m//g')
  PAGE_NODES=$(echo "$PAGE" | jq '.data.repository.pullRequest.reviewThreads.nodes')
  ALL_THREADS=$(echo "$ALL_THREADS" "$PAGE_NODES" | jq -s '.[0] + .[1]')
  HAS_NEXT=$(echo "$PAGE" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')
  if [ "$HAS_NEXT" != "true" ]; then
    break
  fi
  CURSOR=$(echo "$PAGE" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')
done
echo "$ALL_THREADS" | jq '[.[] | select(.isResolved == false)]' > "$THREADS_FILE"
```

Keep the first comment's `databaseId` as the reply target. Read **every**
comment body in the thread (root + replies) before triage. Clean up
`$THREADS_FILE` when done.

## Fetch review bodies

```bash
NO_COLOR=1 gh api "repos/<OWNER>/<REPO>/pulls/<NUMBER>/reviews" --paginate \
  | jq '[.[] | select(.body != null and (.body | gsub("^\\s+|\\s+$";"")) != "")
        | {id, state, body, user: .user.login}]'
```

Add body items when actionable and not already covered by an inline thread.
A single review body may contain multiple findings; explode per
**Normalize findings**.

## Fetch PR conversation comments

These are issue comments on the PR conversation tab, not review threads. Bots
and humans often leave multi-finding reviews here.

```bash
NO_COLOR=1 gh api "repos/<OWNER>/<REPO>/issues/<NUMBER>/comments" --paginate \
  | jq '[.[] | select(.body != null and (.body | gsub("^\\s+|\\s+$";"")) != "")
        | {id, body, user: .user.login, html_url, created_at}]'
```

Add items when actionable and not already covered by a thread or review body.
Explode multi-finding comments per **Normalize findings**.

## Normalize findings

Build one triage list. For each raw payload:

1. Skip empty bodies, "LGTM"/"thanks"-only acknowledgments, and CI/status
   noise with no actionable finding.
2. Skip an item whose body is already represented by another source (same
   file/line claim or near-identical text). Prefer `thread` over `review` over
   `comment` when deduping.
3. When one body contains multiple discrete findings (tables with finding rows,
   numbered/bulleted claims, repeated severity tags like `P2`/`P3`), create
   **one triage item per finding**. Keep the parent id as the shared reply
   target; put the finding excerpt in `body`.
4. Record: `source`, `reply_target_id`, `path`/`line` if cited, `author`,
   `body` (finding text), plus any reply text already on the thread for context.

## Post replies by surface

Use the numeric id from the fetch step.

### `thread`

```bash
NO_COLOR=1 gh api "repos/<OWNER>/<REPO>/pulls/<NUMBER>/comments/<databaseId>/replies" \
  -X POST -f body="<reply text>"
```

### `review` or `comment`

Post one conversation comment. When several triage items share the same
`reply_target_id`, consolidate into a **single** reply that covers every
verdict for that parent.

```bash
NO_COLOR=1 gh api "repos/<OWNER>/<REPO>/issues/<NUMBER>/comments" \
  -X POST -f body="<reply text>"
```

Lead the consolidated reply with a short pointer to the parent (author or
comment URL), then one short paragraph or bullet per finding.

For `fix` verdicts, push first, then:

```bash
COMMIT_SHA=$(git rev-parse HEAD)
```

Reference `$COMMIT_SHA` in the reply body.

## Semgrep dismissal replies

When author login is `semgrep-code-scan`:

- False positive: `/fp <reason>`
- Acceptable risk: `/ar <reason>`
- Other: `/other <reason>`

Keep the reason concrete and short. Unslop the draft per `./references/unslop-reply-drafts.md` before posting.

## Reply shapes

Lead with the fix, rejection, or fact. Examples by verdict:

### fix

```
Fixed in abc1234. Added a nil check before the DB call on line 42.
```

### reject

```
This branch can't run. validate() returns early at auth.go:88 when id is empty.
```

### clarify

```
The retry only fires on 5xx. 4xx responses surface to the caller by design.
See handleResponse at client.go:112.
```
