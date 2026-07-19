---
name: explain-diff
description: >
  explain-diff when turning a git diff, branch, or pull request into a
  self-contained HTML teaching page.
---

# Explain diff

## Flags

| Flag | Default | Effect |
|---|---|---|
| `--target <branch>` | `main` | Explain `<branch>...HEAD` |
| `--pr <n\|url>` | off | Explain one PR diff and metadata |
| `--staged` | off | Explain the index |
| `--unstaged` | off | Explain worktree changes |
| `--output <path>` | dated `/tmp` file | Set the HTML path |

The four source choices are mutually exclusive; conflicting or valueless flags
are `BLOCKED`. With no source flag, use `--target main`. A bare `--pr` may
resolve the current branch's PR; block if absent or ambiguous.

## 1. Lock source and output

Capture source identity, head SHA, exact diff, sorted paths, and SHA-256 diff
hash. Empty diff is `NO_CHANGES`. Derive slug from sanitized branch name, PR
number, or `change-<head8>`, capped at 40 characters.

Resolve output to an absolute path outside the repo. Create a missing parent.
Block before overwriting a user-supplied existing file. A default output may
replace only a prior artifact containing this skill's generator marker.

Record:
`source/hash | themes | evidence | output | current gate | verification | terminal`.
Persist it beside the output as `<output>.ledger` and remove it on success.

Done when source and safe output are immutable.

## 2. Group and research

Assign every changed path to a functional theme before reading surrounding
code. For more than 50 paths, explain themes through representative hunks and
include a complete changed-file inventory. Use at most 12 themes, three
surrounding files per theme, and 30 surrounding files total. Read direct
definitions, callers, contracts, tests, and config only when a planned claim
needs them.

Done when every path has a theme and each planned claim has a hunk or read-file
pointer.

## 3. Build the teaching page

Load `./REFERENCE.md`. Write one HTML file in this order: Background, Intuition,
Code, Quiz. Include a table of contents, inline CSS and JavaScript, responsive
layout, and only HTML or inline-SVG diagrams. Code sections group by theme,
with the complete inventory for large diffs.

Every factual sentence about the change traces to a hunk. Every system claim
traces to a surrounding file. Remove unsupported intent, motive, or PR claims.

Done when the file exists with all four non-empty sections and five grounded
quiz questions.

## 4. Verify and report

Apply the reference checklist. Verify no external asset URL, all anchors,
generator marker, code whitespace, evidence pointers, and quiz answer feedback.
When a browser tool exists, load the file and test one correct and one incorrect
answer; otherwise disclose static-only verification.

After interruption, compare source hash and ledger. Restart changed themes;
otherwise continue at the first incomplete gate.

Report absolute path, source, theme and file counts, quiz count, and verification
level. Do not paste the HTML. Terminal values are `SUCCESS`, `NO_CHANGES`, and
`BLOCKED`. Never commit, push, or mutate a PR.
