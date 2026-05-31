---
name: make-pr
description: >
  Create a pull request. Use when the user asks to open a PR, create a pull
  request, submit a PR, or merge a branch. Supports --target <branch>
  (default: main) and --ticket <id> (prefixes title with ticket number, off by
  default).
---

# Make Pull Request

## When to use this skill

Activate when the user asks to open a pull request, create a PR, submit a PR,
or merge a branch.

## Flag detection

After activation, inspect the user's message for the following flags:

| Flag / Arg             | Effect                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `--target <branch>`    | Target branch for the PR. **Default: `main`** if not provided.                           |
| `--ticket <ticket-id>` | Linear ticket ID to prefix the PR title with (e.g., `--ticket ABC-123`). Off by default. |

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

- If `--ticket <id>` was passed: `[<TICKET-ID>] <concise summary>`
  - Ticket ID uppercase as provided
  - Concise summary of changes, max ~60 characters for the summary portion
- If no `--ticket`: plain concise summary

Examples:

- `--ticket ABC-123`: `[ABC-123] Add user authentication flow`
- No ticket: `Add user authentication flow`

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
