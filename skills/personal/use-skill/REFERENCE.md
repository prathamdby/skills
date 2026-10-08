# use-skill reference

Endpoint and decoding detail for Resolve and fetch. Load this before fetching.
Run in a known repo or use literal owner/repo endpoints; quote paths with `?`.
GET reads use query strings, not -f/-F (which selects POST without -X GET).
Redirect large responses to run-owned files; never pipe gh to head.

## Link resolution

| Form | Example | Resolves to dir |
| ---- | ------- | --------------- |
| Blob URL | `https://github.com/OWNER/REPO/blob/REF/PATH/FILE` | `OWNER/REPO@REF:PATH` (the file's parent) |
| Raw URL | `https://raw.githubusercontent.com/OWNER/REPO/REF/PATH/FILE` | `OWNER/REPO@REF:PATH` (the file's parent) |
| Shorthand | `OWNER/REPO@REF:PATH` | `PATH` if it is a directory, else its parent |
| Directory URL | `https://github.com/OWNER/REPO/tree/REF/DIR` | `OWNER/REPO@REF:DIR` |

A missing `REF` uses the repo default branch: `gh api repos/OWNER/REPO --jq .default_branch`.

Shorthand file check: match `PATH` exactly against the tree listing before filtering. A `blob` hit means a file link and resolves to its parent; otherwise `PATH` is the dir.

## Bulk fetch

Resolve REF to a commit once using `repos/OWNER/REPO/commits/REF` and its `.sha`.
Use that revision for every subsequent tree/contents request.
List the recursive tree once into a temporary JSON file:

```text
gh api 'repos/OWNER/REPO/git/trees/REVISION?recursive=1' > tree.json
```

Require `.truncated == false` before selecting blobs whose paths start with
the resolved directory plus `/`. A truncated tree is BLOCKED, not an empty set.
Fetch every selected path through the contents endpoint:

```text
gh api 'repos/OWNER/REPO/contents/PATH?ref=REVISION'
```

Pass `ref` as a query string: the `--field ref=REF` form 404s on some `gh` builds even for existing paths.

Each payload is JSON with base64 in `.content` (strip newlines, then `base64 -d`). Files over the contents-API cap (~1MB) fail the endpoint above; fetch the blob instead:

```text
gh api repos/OWNER/REPO/git/blobs/SHA
```

where `SHA` comes from the `.sha` of the tree entry. Decode its `.content` from base64 the same way (strip newlines, then `base64 -d`).

## Error map

| Signal | Terminal |
| ------ | -------- |
| Missing dir (404 on tree or contents) | `BLOCKED` |
| Rate-limit (`403` with `retry-after` / `x-ratelimit-remaining: 0`) | `BLOCKED` with the retry time |
| Auth failure | `BLOCKED` |
| Empty blob set | `NO_CHANGES` |
| Non-empty set missing the entry file | `BLOCKED` |
