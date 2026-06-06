---
name: make-pr
description: >
  Create a pull request with plain-English titles by default. Use when the user
  asks to open a PR, create a pull request, submit a PR, or merge a branch.
  Supports --target <branch> (default: main), --ticket <id> (prefixes title with
  ticket number, off by default), and --conventional (conventional commit title
  format, off by default).
---

# Make Pull Request

## When to use this skill

Activate when the user asks to open a pull request, create a PR, submit a PR,
or merge a branch.

## Flag detection

After activation, inspect the user's message for the following flags:

| Flag / Arg             | Effect                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `--target <branch>`    | Target branch for the PR. **Default: `main`** if not provided.                              |
| `--ticket <ticket-id>` | Linear ticket ID to prefix the PR title with (e.g., `--ticket ABC-123`). Off by default.    |
| `--conventional`       | Use conventional commit format for the title summary (`type: description`). Off by default. |

**Defaults:** Plain-English title. No `feat:`, `fix:`, or other conventional
prefix unless `--conventional` is passed.

If `--ticket` is passed but no ticket ID is provided, stop and ask:
"`--ticket` requires a ticket ID (e.g., `--ticket ABC-123`)."

## Step 1: Gather context

1. Identify the current branch name.
2. Run the following to get commits on this branch:
   ```bash
   git log <target>..HEAD --oneline
   ```
3. Run the following to see the full diff:
   ```bash
   git diff <target>...HEAD
   ```

If `--ticket` was passed, **do not search** for the ticket number in the branch
name or commit messages. Use the explicit `--ticket` value directly.

## Step 2: Generate PR title

Base the title on the branch diff from Step 1, not commit messages or session
context.

**Default (no `--conventional`):** plain English. No conventional commit
prefix.

- Capitalize the first word; keep the rest lowercase except proper nouns and
  technical terms
- Describe what the branch changes
- Do not write titles like `feat: add auth`, `fix: null check`, or `docs: update readme`

**With `--conventional`:** conventional commit format for the summary portion.
Follow formatting rules in `skills/commit/REFERENCE.md`.

**Ticket prefix:** when `--ticket <id>` is passed, prepend `[<TICKET-ID>]` before
the summary. Ticket ID uppercase as provided. Max ~60 characters for the summary
portion when a ticket prefix is present.

Examples (default):

- `--ticket ABC-123`: `[ABC-123] Add user authentication flow`
- No ticket: `Add user authentication flow`

Examples (`--conventional`):

- `--ticket ABC-123`: `[ABC-123] feat: add user authentication flow`
- No ticket: `feat: add user authentication flow`

## Step 3: Generate PR body

Write a concise, high-level summary of the changes introduced by this branch
relative to the target branch.

Rules:

- Base it on the commit diff, not commit-by-commit
- Group related changes thematically
- Keep it factual and brief
- No filler, no boilerplate
- No Linear issue references unless `--ticket` was passed

## Step 4: Open the PR

Use the GitHub CLI (`gh pr create`) or equivalent tool to open the PR with the
generated title and body, targeting the specified `--target` branch.

## Step 5: Report

Report the PR URL to the user.

## Constraints

- **Never commit, build, run, or push.**
- **Do not auto-detect Linear issues** from branch names or commits.
  Only use the explicit `--ticket` value if provided.
- If `--ticket` is missing its argument, stop and ask.
