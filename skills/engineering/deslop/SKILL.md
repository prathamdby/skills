---
name: deslop
description: >
  deslop to remove diff bloat and foreign patterns without changing behavior.
---

# Deslop

## Scope

Default staged (`git diff --cached`). Unstaged/worktree → git diff;
against/since <branch> → committed triple-dot diff. Conflicting scopes,
missing base, or ambiguous values block. An empty scope never switches.

## 1. Lock

Capture status, selected diff, sorted paths, original index, and SHA-256 of
scope name plus complete diff. Record
`scope/hash | file | checked hunks | kept instances | verification | terminal`.
Empty → NO_CHANGES, naming other layers without touching them. Staged targets
with unstaged hunks block the whole run; committed-base targets with staged/
unstaged work also block. Done when editable bytes and staging boundaries are fixed.

## 2. Classify

Read every changed file and at most two same-directory norm-setting neighbors
per module. Apply all six categories in `REFERENCE.md` to every hunk.
Record path/lines, primary category, local evidence, smallest atomic edit;
secondary only for another edit. Update sorted-file progress after each file.
On resume rehash; restart changed current work and retain completed entries
only for unchanged hunks. Done when every hunk has six-category coverage;
no instances → CLEAN.

## 3. Edit

Apply all reference guardrails; drop uncertain instances. Use the smallest
locally established form, preserving logic, timing, errors, side effects,
validation, API, and useful abstraction.
Unstaged/base never stage. Staged stages only edited targets proven to have
had no pre-existing unstaged work. Done when each kept instance is gone and
the original index is preserved except authorized staged-target updates.

## 4. Verify

Recheck selected diff/status, no new slop or moved out-of-scope layers.
Executable/type/control/error/validation/API edits require the narrowest
covering test; missing/failing required tests block. Docs/comments/whitespace
may use diff audit alone. Report scope, files, category counts, staging
preservation, audit, tests. Done when each edit and staging invariant is proved.

Terminals: SUCCESS, CLEAN, NO_CHANGES, BLOCKED. No commits or scope expansion.
