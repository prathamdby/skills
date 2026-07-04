---
name: explain-diff
description: >
  explain-diff: explain a code change, diff, branch, or PR as a rich
  self-contained HTML page. Flags: --target <branch>, --pr <n>, --staged,
  --unstaged, --output <path>.
---

# Explain Diff

Produce one **teaching artifact**: a long-page HTML file with Background,
Intuition, Code, and Quiz. Not a PR description (`make-pr`) and not inline chat
prose—the reader opens the file in a browser.

## Flags

| Flag              | Effect                                                       |
| ----------------- | ------------------------------------------------------------ |
| `--target <branch>` | Branch diff: `git diff <branch>...HEAD`. **Default: `main`.** |
| `--pr <n\|url>`   | PR diff via `gh pr diff` (and PR title/body for context).    |
| `--staged`        | `git diff --cached` only.                                    |
| `--unstaged`      | `git diff` only.                                             |
| `--output <path>` | Write path. **Default:** `/tmp/YYYY-MM-DD-explain-<slug>.html` |

Diff source is mutually exclusive. Use the first detected among `--pr`, `--staged`,
`--unstaged`; otherwise `--target`. `--pr` without a number when not on a PR
branch: try `gh pr view` to resolve; if it returns no PR, stop and ask.

Slug: short kebab from the change topic (e.g. `rate-limit-api`).

## Step 1: Gather the change set

Collect diff text and identifiers (files, commits, PR number). If the diff is
empty, stop: "No changes found to explain."

For `--target`, also run `git log <target>..HEAD --oneline` for narrative context.

## Step 2: Legwork

Read surrounding code beyond the diff hunk lines—callers, types, tests, config—so
Background can stand alone for a beginner and still narrow to what this change
touches. Done when you can name the system before/after without guessing.

## Step 3: Draft the four sections

Follow section rubrics, prose tone, diagram families, and quiz rules in
`./REFERENCE.md`. Order on the page: Background → Intuition → Code → Quiz.

## Step 4: Write HTML

Emit a **single self-contained** file: embedded CSS and JavaScript, table of
contents, section headers, one scroll (no top-level tabs). Basic responsive
layout. Apply the pre-save checklist in `./REFERENCE.md` (especially `pre` /
`white-space` on code blocks).

Write only to `--output` or the default under `/tmp/` (or another path **outside
the repo**). Never commit the HTML file.

## Step 5: Report

Give the absolute path and a one-line open hint (`open` on macOS, `xdg-open` on
Linux, `start` on Windows). Do not paste the full HTML into chat.

## Constraints

- **Never** use ASCII art diagrams; use simple HTML diagram patterns from
  `./REFERENCE.md`.
- **Never** commit, push, or open a PR as part of this skill.
- Quiz: five medium-difficulty multiple-choice questions with click feedback in
  the page—spec in `./REFERENCE.md`.
