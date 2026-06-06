---
name: commit
description: >
  Generate commit messages from the git diff only and commit changes to git.
  Ignores session context such as reviews or discussion. Use when the user types
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

## Diff-only constraint

The git diff is the **only** input for the commit message. Ignore everything
else in the session.

- Do not use conversation history, review threads, ticket text, or the user's
  stated rationale
- Do not write messages like "address review feedback", "as requested",
  "fix issues from discussion", or "implement the plan"
- Do not reference work that is not visible in the diff
- Infer type and description solely from added, removed, and modified lines

If the user message explains why they changed something, treat that as
irrelevant unless the same fact appears in the diff.

## Step 0: Read REFERENCE.md (mandatory)

**Do not proceed to Step 1 or any later step until you have read `REFERENCE.md` in full.**

1. Use the Read tool on `./REFERENCE.md` in this skill's directory (same folder as this file).
2. Treat every formatting rule and example in that file as binding for this session.
3. If you have not read it yet, stop and read it now. Skipping this step causes malformed commit messages.

## Step 1: Diff the changes

Choose the diff command based on the detected flags:

- `--staged` (or default): `git diff --cached | cat`
- `--unstaged`: `git diff | cat`

Run the selected command, capture the full output, and analyze the changes.

## Step 2: Analyze changes

Read **only** the diff output. Do not use conversation context to interpret it.

Identify from the diff alone:

- What files were changed
- The nature of the changes (added, modified, deleted, renamed)
- What the diff actually does (new feature, bug fix, refactoring, documentation,
  test, chore, style, performance improvement)

If there are no changes to diff (empty output), stop and report:
"No changes found to commit."

## Step 3: Generate the commit message

Base the message solely on Step 2. Describe what the diff does, not why the
session wanted it.

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
