# GitHub I/O reference

Load Raw `gh` gotchas before any raw `gh` command. Load JSON shapes before
parsing `--json`. Load Reply when posting a thread or conversation comment.
Load Trace and logs when counting script HTTP or reading job logs.

## Reply

`pr-reply.ts` posts one comment. Exactly one target and one body, or
`BLOCKED`:

| Flag | Effect |
|---|---|
| `--in-reply-to <id>` | Review-thread reply. `id` is a `databaseId`, `discussion_rN`, or comment URL |
| `--conversation` | New PR conversation comment |
| `--body-file <path>` | Reply markdown file |
| `--body <text>` | Reply text via argv; prefer `--body-file` |

`--in-reply-to` and `--conversation` conflict. `--body` and `--body-file`
conflict. Empty body is `BLOCKED`. Nested review-comment ids resolve to the
thread root before POST. The script never resolves, pushes, or merges.

### `pr-reply.ts --json`

```
{ kind: "thread" | "conversation", id, url, inReplyTo, body }
```

`url` is the posted `html_url`. `inReplyTo` is the root review-comment id for
thread replies, else null.

## Raw `gh` gotchas

1. Never pipe `gh` into `head`. SIGPIPE can abort the write (spurious nonzero
   exit) or truncate silently. Redirect to a file and read it, or trim with
   `--jq '.[0:20]'`.
2. `gh pr diff` has no `--stat` and no positive pathspec (`--name-only` and
   `-e` / `--exclude` exist in gh ≥ 2.95). Per-file stats:
   `gh api 'repos/{owner}/{repo}/pulls/N/files' --jq '.[]|[.filename,.additions,.deletions]|@tsv'`.
   Full diff: `gh pr diff N > "$TMPDIR/pr.diff"` once, then search the file.
3. `gh pr checks` exits 1 when failing and 8 when pending by design. Append
   `|| true` and read the table. Empty stdout plus stderr is a real error.
4. File bytes at a ref, no base64:
   `gh api 'repos/{owner}/{repo}/contents/PATH?ref=SHA' -H 'Accept: application/vnd.github.raw'`.
5. `gh api` fills `{owner}/{repo}` from the cwd repo (`GH_REPO=o/r` overrides).
   Quote any path containing `?`. Any `-f` / `-F` silently turns GET into POST
   unless you pass `-X GET`. Owner and repo are strings; `-F` on an all-digit
   name such as `2048` coerces it to Int and breaks the query.
6. `--paginate` on list endpoints (`/comments`, `/files`, `/reviews`). `--jq`
   already runs per page; do not add `--slurp`.
7. PR and comment bodies: `--body-file file.md` or a quoted heredoc. Never
   inline `--body "..."` that contains backticks.
8. PR CI rollup is `statusCheckRollup` on `gh pr view`. Job steps live under
   `gh run view N --json jobs`. `gh search prs` field names are not `gh pr view`
   field names.
9. `gh` has no `-C`. Pass `-R owner/repo` on every command, or `cd` first.
10. Modern branch rules: `gh api 'repos/{owner}/{repo}/rulesets'`. Classic
    `/branches/main/protection` 404s unless classic protection is on and you
    have admin. Both "Branch not protected" and "Not Found" mean check
    rulesets; neither is a path typo.
11. Ahead/behind:
    `gh api 'repos/{owner}/{repo}/compare/BASE...HEAD' --jq '{ahead_by,behind_by}'`.
12. `jq` longer than one line: write the program to a file and `jq -f prog.jq`.
    Inline shell quoting breaks.
13. Do not sleep-poll runs or checks. `gh run watch ID` and
    `gh pr checks N --watch --fail-fast` exist; let the harness background them.

## JSON shapes

Keep upstream keys. Truncation markers look like `[…+N chars]` unless `--full`.

### `pr-snapshot.ts --json`

```
{
  number, title, state, isDraft, author { login }, url, createdAt,
  baseRefName, headRefName, headRefOid, mergeable, mergeStateStatus,
  reviewDecision, additions, deletions, changedFiles, body,
  files: [{ path, additions, deletions }],
  filesCapped,
  comments: [{ author { login }, createdAt, body }],
  checks: [{ name, state, bucket }],
  threads: { open, total, capped },
  reviewsLatest: { <login>: <state> }
}
```

`bucket` is `pass` / `fail` / `pending` / `skipping` / `cancel`. `threads.capped`
is true when `reviewThreads` has a next page. `filesCapped` is true in text mode
when the first files page has a next page (no extra calls). `--json` pages files
until complete and sets `filesCapped` false. Text output slices files at 50 and
warns when `filesCapped` or the local list is longer.

`--json` file completeness is extra calls: if `files.hasNextPage`, further
GraphQL pages run. That is not the one-query fast path.

Fast-path GraphQL `pullRequest` fields: the keys above, `files(first: 50)` with
`pageInfo`, `reviews(last: 50)` author/state, `comments(last: 5)`,
`reviewThreads(first: 100)` `{ isResolved, pageInfo }`, and the latest commit
`statusCheckRollup` contexts `(first: 100)`. Complexity, timeout, or 5xx falls
back to split `gh pr view --json` + `gh pr checks` + thread-count GraphQL.

### `pr-threads.ts --json`

```
{
  conversation: [{
    kind: "review" | "comment", state?, author, createdAt, body,
    id, databaseId, url
  }],
  threads: [{
    id, databaseId, url,
    isResolved, isOutdated, path, line, originalLine,
    moreComments,
    comments: [{ author, createdAt, body, id, databaseId, url }]
  }],
  moreReviews, moreComments, moreConvo, moreThreadComments
}
```

`id`, `databaseId`, and `url` are additive on each thread and each comment
(conversation items included). GraphQL `PullRequestReviewThread` has no
`databaseId` or `url`; those thread fields are copied from the first comment
(the REST reply target). Per-thread `moreComments` is the nested comments
connection cap (main query uses `comments(first: 100)`).

Top-level `--complete` page markers (`moreReviews`, `moreComments`,
`moreConvo`, `moreThreadComments`) are true only when a page failed or GitHub
still truncated after paging leftover thread comments, review bodies, and issue
comments. Without `--complete`, treat per-thread `moreComments` and a set
top-level marker as incomplete lists.

Default hides resolved and outdated. `--open` keeps `!isResolved` including
outdated. `--all` keeps every thread. Reviews skip `PENDING` and empty bodies.

GraphQL: `reviewThreads(first: 100)` with nested `comments(first: 100)`
(author.login, createdAt, body, databaseId, url), plus thread `id`,
`isResolved`, `isOutdated`, path, line, originalLine, `pageInfo`. Reviews
`(last: 50)` and issue comments `(last: 50)` only on the first page.

### `ci-failures.ts --json`

Drilldown:

```
{
  repo, pr?,
  runs: [{
    runId, workflow, conclusion, url, checks[],
    jobs?: [{
      name, conclusion, url, failedSteps[],
      log: { file, lines, snippet } | { error },
      annotations?
    }],
    error?
  }],
  external: [{ name, state, bucket, link }]
}
```

`--list` (default `-L 10`, optional `--workflow W`):

```
{ repo, runs: [{ databaseId, workflowName, displayTitle, event, status, conclusion, createdAt }] }
```

`--sha` pins the commit when the caller has a head SHA. This script does not
decide required vs optional checks. One deleted or expired run is an `error`
entry; the rest of the report continues. `--full` is accepted and ignored.
External checks are those whose link has no `/actions/runs/<id>`.

## Trace and logs

`GH_TRACE=1` prints spawn and HTTP counts and path or query names only. Never
log tokens, `Authorization`, or signed URLs.

Job logs go through `gh api repos/<owner>/<repo>/actions/jobs/<id>/logs`. Do
not `fetch` the log URL with a GitHub `Authorization` header; the 302 to blob
storage must not forward the bearer token. If the body starts with `PK`, unzip
and snippet the failed step, then unlink the zip. Logs land in a 0700
`mkdtemp` under `$TMPDIR` (`gh-ci-*`), files mode 0600. Cite the printed file
path; do not paste the full log.
