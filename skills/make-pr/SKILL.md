---
name: make-pr
description: >
  make a pull request with a plain-English title and a thematic summary built
  from the branch diff. Triggers: open a PR, create a pull request, submit a PR.
  Flags: --target <branch> (default main), --ticket <id> (prefix title with the
  ticket), --conventional (conventional-commit title).
---

# Make Pull Request

## Flags

| Flag / Arg          | Effect                                                                |
| ------------------- | --------------------------------------------------------------------- |
| `--target <branch>` | Target branch. **Default: `main`.**                                   |
| `--ticket <id>`     | Prefix the title with `[<TICKET-ID>]` (e.g. `--ticket ABC-123`). Off. |
| `--conventional`    | Conventional-commit title format. Off — plain English by default.     |

If `--ticket` is passed without an ID, stop: "`--ticket` requires a ticket ID
(e.g., `--ticket ABC-123`)."

## Step 1: Gather context

1. Identify the current branch.
2. `git log <target>..HEAD --oneline` — commits on this branch.
3. `git diff <target>...HEAD` — the full diff.

With `--ticket`, use the explicit value; never search the branch name or commits
for a ticket number.

## Step 2: Generate the title

Base the title on the branch diff, not commit messages or session context.

- **Default:** plain English. Capitalize the first word; rest lowercase except
  proper nouns and technical terms. No `feat:`/`fix:`/`docs:` prefix.
- **`--conventional`:** conventional-commit format; follow
  `skills/commit/REFERENCE.md`.
- **`--ticket <id>`:** prepend `[<TICKET-ID>]` (uppercase as provided); keep the
  summary portion ≤60 chars.

Examples:

- `[ABC-123] Add user authentication flow` (ticket, default)
- `Add user authentication flow` (default)
- `[ABC-123] feat: add user authentication flow` (ticket, `--conventional`)

## Step 3: Generate the body

A concise, high-level summary of the branch changes relative to the target.
Group related changes thematically, not commit-by-commit. Factual and brief, no
filler. No Linear references unless `--ticket` was passed.

## Step 4: Open the PR

Use `gh pr create` (or equivalent) with the generated title and body, targeting
`--target`.

## Step 5: Report

Report the PR URL.

## Constraints

- **Never commit, build, run, or push.**
- **Never auto-detect Linear issues** from branch names or commits — use the
  explicit `--ticket` value only.
