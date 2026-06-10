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

Hook behavior is controlled by `--verify`. **Default (no `--verify`):** every
commit **must** include `-n` (equivalent to `--no-verify`). Agents often drop
`-n` to "save time" or avoid hook failures. That is wrong unless the user
passed `--verify`.

**Body formatting:** use exactly **one** `-m` flag for the full message. Git
inserts a blank line between every `-m` argument, so multiple `-m` flags produce
spaced-out bullets even when each flag holds a single line. Never pass one
bullet per `-m`. Never insert blank lines between body bullets in the message
string.

**Default path (no `--verify`):**

- **Always** pass `-n` on `git commit`
- **Never** run `git commit` without `-n`
- **Never** skip hooks by any other means (amending outside this flow, staging
  then committing elsewhere)
- If the commit command fails, fix the underlying issue or report the failure.
  Do not retry without `-n`

**With `--verify`:**

- **Never** pass `-n` or `--no-verify`
- Run `git commit -m "..."` so pre-commit and commit-msg hooks execute
- If hooks fail, fix the underlying issue or report the failure. Do not fall
  back to `-n` unless the user removes `--verify` and asks to commit again

## Flag detection

After activation, inspect the user's message for the following flags:

| Flag             | Effect                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `--staged`       | Diff staged changes only (`git diff --cached`). **This is the default** if no diff flag is provided. |
| `--unstaged`     | Diff unstaged changes (`git diff`).                                                                  |
| `--conventional` | Generate a conventional commit message. **This is the default** if no style flag is provided.        |
| `--simple`       | Generate a concise plain-English message without conventional commit formatting.                     |
| `--verify`       | Run pre-commit and commit-msg hooks. **Off by default**; without this flag, Step 4 uses `-n`.        |

**Defaults:** If the user provides no flags, behave as if `--staged --conventional`
was passed. Hook skip (`-n`) is also the default unless `--verify` is present.

**Flag combinations:** Multiple flags can be combined. For example,
`/commit --unstaged --simple` diffs unstaged changes and writes a simple
message. `/commit --verify --staged` runs hooks on a conventional staged commit.

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

Pass the full message in a **single** `-m` value. For multiline messages, use
one quoted string with embedded newlines (bash `$'...'` is preferred). See
REFERENCE.md for exact invocation patterns and anti-patterns.

Choose the command from the detected hook flag:

**Default (no `--verify`):**

```bash
git commit -n -m $'type: description\n\n- First bullet\n- Second bullet'
```

`-n` skips pre-commit and commit-msg hooks. It is mandatory on this path.

**Forbidden on the default path:**

- `git commit -m "..."` (missing `-n`)
- `git commit -am "..."` (missing `-n`)
- `git commit -n -m "subject" -m "- bullet"` (multiple `-m`; inserts blank lines)
- Any wrapper that omits `-n`

Before reporting success, confirm the command contained `-n` or `--no-verify`.

**With `--verify`:**

```bash
git commit -m $'type: description\n\n- First bullet\n- Second bullet'
```

Hooks must run. Do not pass `-n` or `--no-verify`.

**Forbidden with `--verify`:**

- `git commit -n -m "..."`
- `git commit --no-verify -m "..."`
- `git commit -m "subject" -m "- bullet"` (multiple `-m`; inserts blank lines)
- Any wrapper that skips hooks

Before reporting success, confirm the command did **not** contain `-n` or
`--no-verify`.

## Step 5: Report

After committing, report to the user:

1. The generated commit message (in a code block)
2. The diff scope used (`--staged` or `--unstaged`)
3. The style used (`--conventional` or `--simple`)
4. Hook behavior (`skipped (-n)` by default, or `ran (--verify)`)
5. Confirmation that the commit succeeded
6. The exact `git commit` command run

See REFERENCE.md for full example reports.
