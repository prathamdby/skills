# Sandbox and gated flags

Follow this file when `--sandbox` is rejected, when choosing a sandbox
value, or when a bypass is requested.

## Sandbox values

`-s, --sandbox <SANDBOX_MODE>` selects the sandbox policy for
model-generated shell commands. Values:

| Value                 | Meaning                                                      |
| --------------------- | ------------------------------------------------------------ |
| `read-only`           | Constrains model-generated shell only                        |
| `workspace-write`     | Constrains model-generated shell only. Not auto-approve      |
| `danger-full-access`  | Gated. Named waiver required                                 |

Omit `--sandbox` unless the user named one. Help lists no default.

`--approve-for-me` is a separate flag. Help: "Route approval requests
through automatic review using the workspace-write sandbox". It is not
implied by `--sandbox workspace-write`. Gated.

Never recover a failed sandbox with `--sandbox danger-full-access`,
including when bubblewrap failed.

## Rejected: `--full-auto`

This binary rejects `--full-auto` in every position:

```
error: unexpected argument '--full-auto' found
```

`--sandbox full-auto` is also invalid. Possible values are `read-only`,
`workspace-write`, `danger-full-access`. `--full-auto` is `BLOCKED`.

## Git-repo check

`codex exec` accepts `--skip-git-repo-check` ("Allow running Codex outside
a Git repository"). Pass it only when the user names it. Do not `git init`
in `/tmp` to dodge the default check.

`codex review` rejects `--skip-git-repo-check`:

```
error: unexpected argument '--skip-git-repo-check' found
```

## Gated flags

Named user waiver required. Never a default. A waiver for one row does
not waive the others.

| Flag or value | Allowed only when |
| ------------- | ----------------- |
| `--dangerously-bypass-approvals-and-sandbox` | User named this bypass |
| `--dangerously-bypass-hook-trust` | User named hook-trust bypass |
| `--sandbox danger-full-access` | User named this sandbox value |
| `--approve-for-me` | User named automatic approval routing |
| `--yolo` | User named this flag. Accepted and unlisted. Forbidden without a waiver |
| `--ask-for-approval never` | User named silent approval. Global, before `exec` only |
| `--ignore-rules` | User named dropping execpolicy `.rules` |

Do not claim what `--yolo` aliases. Do not add any row to recover from a
sandbox setup failure.
