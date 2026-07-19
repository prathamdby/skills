---
name: deslop
description: >
  deslop when removing AI-generated bloat, needless defenses, foreign patterns,
  or avoidable complexity from a git diff without changing behavior.
---

# Deslop

## Flags

| Flag | Default | Diff |
|---|---|---|
| `--staged` | yes | `git diff --cached` |
| `--unstaged` | no | `git diff` |
| `--base <branch>` | no | `git diff <branch>...HEAD` |

The scope flags are mutually exclusive. More than one, a missing base branch,
or prose that conflicts with a flag is `BLOCKED`; ask which scope to use. Never
switch away from the default because another diff happens to be non-empty.

## 1. Lock scope

Capture status, the selected diff, its file list, and a fingerprint. Record:

`scope/fingerprint | current file | checked | kept instances | verification | terminal`

If the diff is empty, report `NO_CHANGES` and mention other non-empty scopes
without touching them. Before editing staged scope, block if a target file also
has unstaged changes. This prevents staging unrelated work.

Done when the exact editable scope and original index state are recorded.

## 2. Inspect and classify

Read each changed file and at most two adjacent files per module that establish
local norms. Classify every changed hunk against the six categories in
`./REFERENCE.md`. Record path, lines, category, evidence from local norms, and
the smallest behavior-preserving edit. Do not stop after the first category.

For large diffs, process stable path order and update the ledger after each
file. After interruption, recompute the fingerprint; restart a changed current
file and preserve completed entries only when their hunks are unchanged.

Done when every scoped hunk has six-category coverage. Zero instances is
`CLEAN`.

## 3. Filter and edit

Apply every guardrail in `./REFERENCE.md`. Drop uncertain instances. Edit only
kept instances and use the smallest direct form that matches nearby code.
Preserve logic, timing, errors, side effects, public APIs, and useful
abstractions.

`--unstaged` and `--base` never stage. For `--staged`, stage only edited target
files after confirming they had no pre-existing unstaged hunks.

Done when each kept instance is changed and the original index state outside
staged target files is unchanged.

## 4. Verify and report

Re-run the selected diff and status. Confirm each kept instance is gone, no
out-of-scope hunk moved layers, and no new complexity appeared. Run targeted
tests for control-flow, error, type, or API edits. Text-only cleanup needs only
the diff audit. If required tests cannot run, report `BLOCKED`, not success.

Report scope, files, category counts, preserved staging state, diff audit, and
tests. Terminal values are `SUCCESS`, `CLEAN`, `NO_CHANGES`, and `BLOCKED`.

Do not commit or expand beyond the selected diff.
