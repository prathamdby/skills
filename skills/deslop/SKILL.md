---
name: deslop
description: >
  Remove AI slop and simplify staged, unstaged, or branch-diff changes while
  preserving exact functionality and maintaining readability. Use when the user
  types /deslop, asks to clean AI artifacts, remove bloat, simplify code,
  review changes for slop, or strip over-engineered patterns. Supports flags
  --staged, --unstaged, and --base <branch>.
---

# Remove AI Slop & Simplify

## When to use this skill

Activate when the user types `/deslop`, asks to remove AI slop, clean AI
artifacts, strip over-engineered patterns, simplify code, review staged or
unstaged changes for bloat, or make changes clearer without changing behavior.

## Flag detection

| Flag              | Effect                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| `--staged`        | Diff staged changes (`git diff --cached`). **Default** if no diff flag is provided. |
| `--unstaged`      | Diff unstaged changes (`git diff`).                                                 |
| `--base <branch>` | Diff changes since merge base with `<branch>`: `git diff <branch>...HEAD`.          |

**Defaults:** If no diff flag is provided, behave as if `--staged` was passed.

**Mutual exclusivity:** `--staged`, `--unstaged`, and `--base` are mutually exclusive. Use the first one detected.

**Base argument:** `--base` requires a branch name (e.g., `--base main`). If missing, stop and report: `--base requires a branch name (e.g., --base main)`.

## Step 0: Read REFERENCE.md (mandatory)

**Do not proceed to Step 1 or any later step until you have read `REFERENCE.md` in full.**

1. Use the Read tool on `./REFERENCE.md` in this skill's directory (same folder as this file).
2. Treat every slop category, guardrail, and constraint in that file as binding for this session.
3. If you have not read it yet, stop and read it now. Skipping this step causes missed slop categories and wrong edits.

## Step 1: Diff the changes

- `--staged` (or default): `git diff --cached | cat`
- `--unstaged`: `git diff | cat`
- `--base <branch>`: `git diff <branch>...HEAD | cat`

If there are no changes (empty output), stop and report: "No changes found to deslop."

## Step 2: Read the actual files

Read the full content of every file in the diff, plus adjacent files needed to understand existing patterns.

Pay special attention to: comment style, error handling philosophy, type safety level, abstraction level (helpers vs. inline), validation / defensiveness level, complexity level nearby, and project-standard imports, function style, naming, and formatting.

## Step 3: Exhaustively analyze for slop

Analyze ALL changes against the full file context. Look for every instance across all modified files. Do not stop after finding one issue. Continue analyzing until every file in the diff has been fully checked. See REFERENCE.md for all 8 categories.

## Step 4: Compile the complete list

Before editing, record every instance found: file path, line number(s), category (1-8), what the issue is, and why it violates norms. Do not proceed to removal until this list is complete.

If no slop is found, report: "No AI slop or simplification opportunities detected. The changes look clean."

## Step 5: Balance simplification with maintainability

Evaluate every item before editing. See REFERENCE.md for all guardrails.

## Step 6: Remove the slop

Edit the actual source files directly to strip every approved instance. Make the smallest possible change while preserving exact functionality.

Guidelines: delete bloat comments and dead code; simplify over-engineered patterns; remove unnecessary defensive checks that contradict local trust model; replace type escape hatches with proper types if possible; collapse bloated expressions; flatten nested conditionals with early returns; replace nested ternaries with `if/else` or `switch`; align naming with surrounding codebase; remove unnecessary type conversion chains.

Do not introduce new complexity during removal.

## Step 7: Re-stage the cleaned files

```bash
git add <modified-files>
```

Use `git status` to confirm the cleaned state if needed.

## Step 8: Report

Summarize the cleanup in 2-4 sentences: what categories were addressed, how many files were affected, why the code is cleaner, and any trade-offs considered. Keep it high-level and concrete.
