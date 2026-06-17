---
name: deslop
description: >
  deslop a diff, remove AI slop and over-engineering while preserving exact
  behavior. Triggers: /deslop, remove AI slop, clean AI artifacts, strip
  over-engineered patterns, simplify code, review changes for bloat. Flags:
  --staged, --unstaged, --base <branch>.
---

# Remove AI Slop & Simplify

**Slop** is code heavier than it needs to be: comments stating the obvious,
defensive checks the codebase does not use, single-use abstractions, type escape
hatches, ceremony, cleverness that obscures intent. This skill finds every
instance in a diff and removes it without changing behavior.

## Flags

| Flag              | Effect                                                  |
| ----------------- | ------------------------------------------------------- |
| `--staged`        | Diff staged changes (`git diff --cached`). **Default.** |
| `--unstaged`      | Diff unstaged changes (`git diff`).                     |
| `--base <branch>` | Diff since merge base: `git diff <branch>...HEAD`.      |

Mutually exclusive; use the first detected. `--base` needs a branch name. If
missing, stop: `--base requires a branch name (e.g., --base main)`.

## Step 1: Diff the changes

- `--staged` or default: `git diff --cached | cat`
- `--unstaged`: `git diff | cat`
- `--base <branch>`: `git diff <branch>...HEAD | cat`

If empty, stop: "No changes found to deslop."

## Step 2: Read the files

Read the full content of every file in the diff, plus adjacent files that reveal
existing patterns: comment style, error-handling philosophy, type-safety level,
abstraction level, validation/defensiveness, and project-standard imports,
naming, and formatting. Slop is defined _relative to these local norms_.

## Step 3: Classify every change against all 8 slop categories

Check every changed line in every file against the 8 categories in
`./REFERENCE.md`. Do not stop at the first hit. The step is done only when every
file in the diff has been checked against every category.

## Step 4: Compile the instance list

Record each instance: file path, line number(s), category (1-8), the issue, and
why it violates local norms. If none found, stop: "No AI slop or simplification
opportunities detected. The changes look clean."

## Step 5: Filter against the guardrails

Drop any instance whose removal would violate the maintainability guardrails in
`./REFERENCE.md`. Keep only clear wins.

## Step 6: Remove the slop

Edit the source files to strip every kept instance. Make the smallest change
that preserves exact functionality, logic, timing, side effects, and public
APIs unchanged. Introduce no new complexity while removing.

## Step 7: Re-stage

```bash
git add <modified-files>
```

## Step 8: Report

In 2-4 sentences: which categories were addressed, how many files changed, why
the code is cleaner, and any trade-off considered.
