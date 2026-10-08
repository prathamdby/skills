---
name: recon
description: >
  recon to read a saved codebase map, map the current repo, or refresh it after changes.
---

# Recon

## Route and memory

Default: patch existing memory, otherwise map cold. "Read the existing report"
or "show the saved map" selects **read**, never refresh or rebuild. "Refresh",
"rebuild", or "from scratch" selects rebuild. A named area is the focus.
Conflicting read/rebuild or rebuild/patch wording is `BLOCKED`.

Resolve `<anchor>` as this skill's absolute directory; memory stays in
`<anchor>/memory/`, outside the target repo. Resolve repo root, HEAD, dirty
paths, and the real absolute Git common directory. A shared-checkout key is
`<label>-<hash8>.md`: hash the common directory with SHA-256; take eight digits.
Label is its parent's basename for `.git`, otherwise its own basename.

Try that key first, then legacy keys hashing the current root and the primary
checkout root from `git worktree list --porcelain`. For each candidate, verify
frontmatter `repo` resolves to this same common directory. A matching SHA alone
does not establish repository identity. Unverifiable identity is `BLOCKED`.
Prefer the shared key; multiple legacy candidates with different heads require
an explicit path. A supplied report path must pass the same identity check.

Frontmatter: `repo` (primary checkout root), full commit `head`, ISO `updated`.
Sections: Layout, Entry points, Modules, Data flows, Commands, Conventions,
Gotchas, Evidence. Every claim cites evidence; at most ten bullets per section
and 200 lines total. Validate, write a sibling `.tmp`, then rename atomically.

## 1. Locate

Record `route | memory | stored head | HEAD | dirty | current | pending | terminal`.
For **read**, open only existing memory: create no directory, ledger, or snapshot.
For map/rebuild, persist the ledger at `<memory>.ledger` through atomic rename
after each item; delete it on success. Done when route and candidates are fixed.

## 2. Read or map

**Read:** return the saved map with snapshot path/date/head, coverage, and dirty
overlay. Compare stored head to HEAD; disclose stale or unresolvable metadata,
but do not repair it or inspect source to refresh claims. No report →
`NO_REPORT`, naming searched paths. Done with `READ` when the saved map and
limitations are presented and no file changed.

**Map:** use `references/mapping.md` for cold/rebuild exploration or committed
warm drift. A missing/unresolvable head takes the cold path. Reuse verified
legacy memory, but write new snapshots to the shared key; leave legacy files
untouched. Done when every section has evidence or `None found`, limits hold,
and the stored head equals current HEAD.

## 3. Resume and report

After interruption, recompute HEAD and changed paths; restart affected work
when the ledger differs. Resume the first pending item. Present the map in
thread, labeling sections rebuilt, patched, or representative-only; cite its
path, focus, drift, unverified areas, and dirty overlay. Warm maps end with
`Drift since last recon`. Done when each claim's coverage is disclosed.

Terminals: `READ`, `NO_REPORT`, `SUCCESS`, `BLOCKED`. Stored `head` always
names a real commit on writes. Memory is a map, not an inventory or history.
