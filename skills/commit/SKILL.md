---
name: commit
description: >
  Generate commit messages and commit changes to git. Use when the user types
  /commit, asks to commit changes, save work to git, create a commit, or write
  a commit message. Supports flags --staged/--unstaged for diff scope and
  --conventional/--simple for message style.
---

# Commit Changes

## When to use this skill

Activate when the user types `/commit`, asks to commit changes, save work to
git, create a commit, or write a commit message.

## Flag detection

After activation, inspect the user's message for the following flags:

| Flag             | Effect                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `--staged`       | Diff staged changes only (`git diff --cached`). **This is the default** if no diff flag is provided. |
| `--unstaged`     | Diff unstaged changes (`git diff`).                                                                  |
| `--conventional` | Generate a conventional commit message. **This is the default** if no style flag is provided.        |
| `--simple`       | Generate a concise plain-English message without conventional commit formatting.                     |

**Defaults:** If the user provides no flags, behave as if `--staged --conventional`
was passed.

**Flag combinations:** Multiple flags can be combined. For example,
`/commit --unstaged --simple` diffs unstaged changes and writes a simple
message.

## Step 1: Diff the changes

Choose the diff command based on the detected flags:

- `--staged` (or default): `git diff --cached | cat`
- `--unstaged`: `git diff | cat`

Run the selected command, capture the full output, and analyze the changes.

## Step 2: Analyze changes

Read the diff output and identify:

- What files were changed
- The nature of the changes (added, modified, deleted, renamed)
- The purpose of the changes (new feature, bug fix, refactoring, documentation,
  test, chore, style, performance improvement)

If there are no changes to diff (empty output), stop and report:
"No changes found to commit."

## Step 3: Generate the commit message

- `--conventional` path: Generate a conventional commit message. See REFERENCE.md
  for full formatting rules.
- `--simple` path: Generate a concise plain-English message. See REFERENCE.md
  for full formatting rules.

## Step 4: Commit

Run the commit command with the generated message:

```bash
git commit -n -m "<generated message>"
```

The `-n` flag skips pre-commit hooks. Do not modify this command.

## Step 5: Report

After committing, report to the user:

1. The generated commit message (in a code block)
2. The diff scope used (`--staged` or `--unstaged`)
3. The style used (`--conventional` or `--simple`)
4. Confirmation that the commit succeeded

See REFERENCE.md for a full example report.
