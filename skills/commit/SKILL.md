---
name: commit
description: >
  Generate commit messages from the git diff only and commit changes to git.
  Ignores session context such as reviews or discussion. Commits with -n
  (--no-verify) by default to skip pre-commit hooks; pass --verify to run hooks.
  Use when the user types /commit, asks to commit changes, save work to git,
  create a commit, or write a commit message. Supports flags --staged/--unstaged
  for diff scope, --conventional/--simple for message style, and --verify to run
  hooks.
---

# Commit Changes

## When to use this skill

Activate when the user types `/commit`, asks to commit changes, save work to
git, create a commit, or write a commit message.

## Non-negotiables

Hook behavior is controlled by `--verify`.

- Default, without `--verify`: every commit command must include `-n`.
- With `--verify`: run hooks and never pass `-n` or `--no-verify`.
- Body formatting: use one or two `-m` flags, never three or more. The first
  `-m` is the subject. The optional second `-m` is the whole body.

If the commit command fails, fix the underlying issue or report the failure. Do
not switch hook behavior unless the user changes the flags and asks again.

## Flag detection

After activation, inspect the user's message for these flags:

| Flag             | Effect                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `--staged`       | Diff staged changes only (`git diff --cached`). **Default** if no diff flag is provided.             |
| `--unstaged`     | Diff unstaged changes (`git diff`).                                                                  |
| `--conventional` | Generate a conventional commit message. **Default** if no style flag is provided.                    |
| `--simple`       | Generate a concise plain-English message without conventional commit formatting.                     |
| `--verify`       | Run hooks. Off by default; without this flag, Step 4 uses `-n`.                                      |

**Defaults:** If no flags are provided, behave as if `--staged --conventional`
was passed. Hook skip (`-n`) is also the default unless `--verify` is present.

## Diff-only constraint

The git diff is the only input for the commit message. Ignore conversation
history, review threads, ticket text, and stated rationale unless the same fact
appears in the diff. Do not write messages like "address review feedback",
"as requested", "fix issues from discussion", or "implement the plan".

## Step 0: Read REFERENCE.md (mandatory)

**Do not proceed to Step 1 or any later step until you have read `REFERENCE.md` in full.**

1. Use the Read tool on `./REFERENCE.md` in this skill's directory (same folder as this file).
2. Treat every formatting rule and example in that file as binding for this session.
3. If you have not read it yet, stop and read it now. Skipping this step causes malformed commit messages.

## Step 1: Diff the changes

- `--staged` or default: `git diff --cached | cat`
- `--unstaged`: `git diff | cat`

Capture the full output. If there are no changes, stop and report:
"No changes found to commit."

## Step 2: Analyze changes

Read only the diff output. Identify changed files, change type, and what the
diff actually does: feature, fix, refactor, docs, test, chore, style, or perf.

## Step 3: Generate the commit message

Base the message solely on Step 2. Produce two values before Step 4:

- `subject`: first line only, no trailing newline.
- `body`: optional; bullet lines joined by single `\n`, no leading blank line.

For `--conventional`, `subject` is `type: description`; add `body` only when
the diff needs more explanation. For `--simple`, emit `subject` only. Follow
`./REFERENCE.md` for exact formatting.

## Step 4: Commit

Pass `subject` in the first `-m`. Pass `body` in a second `-m` when present.
Use the exact invocation patterns in `./REFERENCE.md`.

- Default, without `--verify`: run `git commit -n ...` and confirm `-n` or
  `--no-verify` was present.
- With `--verify`: run `git commit ...` and confirm neither `-n` nor
  `--no-verify` was present.

## Step 5: Report

Report the generated message, diff scope, style, hook behavior, success, and
the exact `git commit` command run. See `./REFERENCE.md` for example reports.
