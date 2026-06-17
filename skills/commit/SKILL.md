---
name: commit
description: >
  commit changes to git with a message derived from the diff only, ignoring
  session context like reviews or discussion. Skips hooks with -n by default;
  --verify runs them. Triggers: /commit, commit changes, save work to git, write
  a commit message. Flags: --staged/--unstaged for scope, --conventional/--simple
  for style, --verify to run hooks.
---

# Commit Changes

## Flags

| Flag             | Effect                                                          |
| ---------------- | --------------------------------------------------------------- |
| `--staged`       | Diff staged changes (`git diff --cached`). **Default.**         |
| `--unstaged`     | Diff unstaged changes (`git diff`).                             |
| `--conventional` | Conventional commit message (`type: description`). **Default.** |
| `--simple`       | Plain-English one-liner, no conventional formatting.            |
| `--verify`       | Run hooks. Off by default; without it, the commit passes `-n`.  |

No flags → `--staged --conventional`, hooks skipped.

## Diff-only constraint

The diff is the only input for the message. Ignore conversation history, review
threads, ticket text, and stated rationale unless the same fact appears in the
diff. Never write "address review feedback", "as requested", or "implement the
plan" — describe the concrete change instead.

## Hook behavior

- Without `--verify`: every `git commit` command must include `-n`.
- With `--verify`: run hooks; never pass `-n` or `--no-verify`.

If the commit fails, fix the underlying issue or report it. Do not switch hook
behavior unless the user changes the flags and asks again.

## `-m` flag count

Use one or two `-m` flags, never three or more. First `-m` is the subject; an
optional second `-m` holds the entire body. Git inserts one blank line between
them, producing correct subject/body separation. Put all body bullets in that
single second `-m`, separated by `\n` (use `$'...'`), never `\n\n`.

```bash
git commit -n -m "feat: add auth flow" \
  -m $'- Implement OAuth login\n- Add JWT handling'
```

Three or more `-m` flags insert a blank line between every bullet. A single `-m`
with an embedded body gets bodies dropped. Both are wrong.

## Step 1: Diff the changes

- `--staged` or default: `git diff --cached | cat`
- `--unstaged`: `git diff | cat`

If empty, stop: "No changes found to commit."

## Step 2: Analyze the diff

From the diff alone, identify changed files, change type, and what the diff
does: feature, fix, refactor, docs, test, chore, style, or perf.

## Step 3: Generate the message

Base the message solely on Step 2. Produce:

- `subject`: first line only.
- `body`: optional; bullet lines joined by single `\n`.

For the chosen style, follow the exact format rules and examples in
`./REFERENCE.md` — conventional rules for `--conventional`, simple rules for
`--simple`. For `--simple`, emit `subject` only.

## Step 4: Commit

Pass `subject` in the first `-m`, `body` in a second `-m` when present.

- Without `--verify`: `git commit -n ...`. Confirm `-n` was present.
- With `--verify`: `git commit ...`. Confirm neither `-n` nor `--no-verify` was present.

## Step 5: Report

Report the message, diff scope, style, hook behavior, and the exact `git commit`
command run.
