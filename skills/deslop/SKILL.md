---
name: deslop
description: >
  deslop when removing AI-generated bloat, needless defenses, foreign patterns,
  or avoidable complexity from a git diff without changing behavior.
---

# Deslop

## Flags

| Flag | Default | Effect |
|---|---|---|
| `--staged` | yes | `git diff --cached` |
| `--unstaged` | no | `git diff` |
| `--base <branch>` | no | `git diff <branch>...HEAD` |

The scope flags are mutually exclusive. More than one, a missing base branch,
or prose that conflicts with a flag is `BLOCKED`; ask which scope to use. Prose
that names staged, unstaged, or a base branch selects that scope exactly as its
flag; naming several is `BLOCKED`. Otherwise default to staged and never switch
because another diff is non-empty.

## 1. Lock scope

Capture status, the selected diff, its lexicographically sorted file list, and
the SHA-256 of the scope name plus complete diff as its fingerprint. Record:

`scope/fingerprint | current file | checked | kept instances | verification | terminal`

If the diff is empty, report `NO_CHANGES` and mention other non-empty scopes
from `git diff` without touching them. Before editing staged scope, block the
whole run if any target file also has unstaged changes. `--base` covers commits
only; block if a scoped path has staged or unstaged work.

Done when the exact editable scope and original index state are recorded.

## 2. Inspect and classify

Read each changed file and at most two adjacent files per module that establish
local norms; module means the changed file's directory and adjacent means files
in that directory. Classify every changed hunk against the six categories in
`./REFERENCE.md`. An instance is contiguous lines handled by one atomic edit.
Record path, lines, primary category, local evidence, and smallest safe edit.
For overlap, choose the category requiring the smallest edit; use a secondary
only for another edit. Do not stop after the first category.

For large diffs, process the sorted order and update the ledger after each file.
After any turn interruption before terminal state, recompute the fingerprint;
restart a changed current file and preserve completed entries only when their
hunks are unchanged.

Done when every scoped hunk has six-category coverage. Zero instances is
`CLEAN`.

## 3. Filter and edit

Apply every guardrail in `./REFERENCE.md`. Drop uncertain instances. Edit only
kept instances and use the smallest direct form that matches nearby code.
Preserve logic, timing, errors, side effects, public APIs, and useful
abstractions.

`--unstaged` and `--base` never stage. For `--staged`, stage only edited target
files after confirming they had no pre-existing unstaged hunks.

Done when each kept instance is changed; for unstaged/base the index matches
the Step 1 snapshot, and for staged only clean target-file updates entered it.

## 4. Verify and report

Re-run the selected diff and status. Confirm each kept instance is gone, no
out-of-scope hunk moved layers, and the post-edit diff has no new slop. Any edit
to executable code, types, control flow, error handling, validation, or an API
runs the narrowest covering test for its file, symbol, or package. Only
comments, docs, and whitespace may use the diff audit alone. Missing or failed
required tests are `BLOCKED`.

Report scope, files, category counts, preserved staging state, diff audit, and
tests. Terminal values are `SUCCESS`, `CLEAN`, `NO_CHANGES`, and `BLOCKED`.

Do not commit or expand beyond the selected diff.
