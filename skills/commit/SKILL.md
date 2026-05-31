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

### `--conventional` path (default)

Generate a conventional commit message following these rules strictly:

- **Format:** `type: description`
- **Allowed types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`
- **No scope notation** (e.g., no `feat(scope):` — just `feat:`)
- **First line:**
  - Maximum 50 characters
  - All lowercase except proper nouns and technical terms
    (e.g., OAuth, React, PostgreSQL, API, CLI, HTML, CSS, JSON, URL, HTTP)
  - No period at the end
- **Mandatory blank line** after the first line
- **Body (if needed):**
  - Use only when the change requires explanation beyond the first line
  - Bullet points starting with `-`
  - No blank lines between bullets
  - Capitalize the first word of each bullet
  - No periods at the end of bullets
  - Explain _what_ changed and _why_, not _how_

Example:

```
feat: add user authentication flow

- Implement OAuth 2.0 login with Google and GitHub
- Add JWT token handling for session management
- Update login UI to match new design system
```

### `--simple` path

Generate a concise plain-English commit message:

- Single line, no type prefix
- Maximum 72 characters
- Capitalize the **first word** of the first line; keep everything else lowercase except proper nouns and technical terms
- No period at the end
- Describe what changed in plain language

Examples:

- "Add dark mode toggle to settings page"
- "Fix null pointer exception in user service"
- "Update README with install instructions"

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

Example report:

```
Commit complete.

Scope: staged
Style: conventional

Message:
```

feat: add password reset endpoint

- Implement token-based reset flow
- Add email template for reset notifications
- Update user model with reset token fields

```

```
