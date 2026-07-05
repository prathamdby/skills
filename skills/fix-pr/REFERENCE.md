# Fix PR reference

Substitute `<OWNER>`, `<REPO>`, and `<NUMBER>` from Step 1.

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
            comments(first: 10) {
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

Keep `databaseId` from GraphQL for replies. Clean up `$THREADS_FILE` when done.

## Fetch changes-requested review bodies

```bash
NO_COLOR=1 gh api "repos/<OWNER>/<REPO>/pulls/<NUMBER>/reviews" \
  | jq '[.[] | select(.state == "CHANGES_REQUESTED") | {body, user: .user.login}]'
```

Add body items to the triage list only when actionable and not already covered by
an inline thread.

## Post thread replies

Use the numeric `databaseId` from GraphQL, not the opaque node ID.

```bash
NO_COLOR=1 gh api "repos/<OWNER>/<REPO>/pulls/<NUMBER>/comments/<databaseId>/replies" \
  -X POST -f body="<reply text>"
```

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

Keep the reason concrete and short. Run unslop on the draft before posting.

## Reply shapes

### fix (good)

```
Fixed in abc1234. Added a nil check before the DB call on line 42.
```

### fix (bad)

```
Thank you for this insightful feedback! I've carefully addressed your concerns
in the latest commit to ensure robustness going forward.
```

### reject (good)

```
This branch can't run. validate() returns early at auth.go:88 when id is empty.
```

### reject (bad)

```
Great question! While your suggestion has merit, the current implementation
already handles this case adequately.
```

### clarify (good)

```
The retry only fires on 5xx. 4xx responses surface to the caller by design.
See handleResponse at client.go:112.
```

### clarify (bad)

```
I hope this helps clarify! Let me know if you have any other questions about
the error handling approach.
```