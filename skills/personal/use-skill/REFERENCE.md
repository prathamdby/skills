# use-skill reference

Endpoint and decoding detail for Step 2. Load this before fetching.

## Link resolution

| Form | Example | Resolves to dir |
| ---- | ------- | --------------- |
| Blob URL | `https://github.com/OWNER/REPO/blob/REF/PATH/FILE` | `OWNER/REPO@REF:PATH` (the file's parent) |
| Raw URL | `https://raw.githubusercontent.com/OWNER/REPO/REF/PATH/FILE` | `OWNER/REPO@REF:PATH` (the file's parent) |
| Shorthand | `OWNER/REPO@REF:PATH` | `PATH` if it is a directory, else its parent |
| Directory URL | `https://github.com/OWNER/REPO/tree/REF/DIR` | `OWNER/REPO@REF:DIR` |

A missing `REF` uses the repo default branch: `gh api repos/OWNER/REPO --jq .default_branch`.

## Bulk fetch

List the recursive tree once, then fetch every blob under `DIR`:

```text
gh api 'repos/OWNER/REPO/git/trees/REF?recursive=1' --jq '.tree[] | select(.type=="blob" and (.path | startswith("DIR/"))) | .path'
```

Fetch each listed path through the contents endpoint:

```text
gh api 'repos/OWNER/REPO/contents/PATH?ref=REF'
```

Pass `ref` as a query string: the `--field ref=REF` form 404s on some `gh` builds even for existing paths.

Each payload is JSON with base64 in `.content` (strip newlines, then `base64 -d`). Files over the contents-API cap (~1MB) fail the endpoint above; fetch the blob instead:

```text
gh api repos/OWNER/REPO/git/blobs/SHA
```

where `SHA` comes from the `.sha` of the tree entry.

## Error map

| Signal | Terminal |
| ------ | -------- |
| Missing dir (404 on tree or contents) | `BLOCKED` |
| Rate-limit (`403` with `retry-after` / `x-ratelimit-remaining: 0`) | `BLOCKED` with the retry time |
| Auth failure | `BLOCKED` |
| Directory with no skill files | `NO_CHANGES` |
