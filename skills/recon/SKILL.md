---
name: recon
description: >
  recon when mapping the current codebase, refreshing an earlier map, or
  re-orienting after repository changes.
---

# Recon

## Flags

| Flag or argument | Default | Effect |
|---|---|---|
| `--refresh` | off | Rebuild memory instead of patching it |
| positional focus | none | Explore and report that area in more depth |

Without `--refresh`, use the warm path when memory exists and the cold path
otherwise.

## Memory

Resolve `<anchor>` as the absolute directory containing this `SKILL.md`.
Memory lives at `<anchor>/memory/<basename>-<hash8>.md`; `hash8` is the first
eight SHA-256 characters of the repo's absolute root, and `basename` is that
root directory's name. Create the directory when needed. Never write memory
inside the target repo.

Frontmatter is `repo`, full commit `head`, and ISO date `updated`. The body has
these headings: Layout, Entry points, Modules, Data flows, Commands,
Conventions, Gotchas, Evidence. Every claim names one or more evidence paths.
Keep at most 10 bullets per heading and 200 lines total. Merge duplicates and
remove claims whose evidence no longer exists. Write to a sibling `.tmp` and
rename it into place only after validation.

## 1. Locate

Resolve the repo root, memory path, current HEAD, and dirty paths. Record:

`route | stored head | current head | changed | current item | pending | terminal`

Persist it after each item through a sibling temporary file and atomic rename at
`<memory-path>.ledger`; delete it on success. Done when paths and route are known.

## 2. Cold or refresh

Explore breadth first: manifests, top-level layout, entry points, dependency
boundaries, commands, and conventions. Read at most three representative anchor
files for at most 30 modules named by workspace manifests; go deeper only for
the positional focus. Use non-overlapping read-only subagents when available.
Write every required section and evidence path, then prune to the limits.

Done when the memory file exists, its `head` equals current HEAD, and every
heading contains evidence or says `None found`.

## 3. Warm drift

Read memory before repo files. Take the cold path if `head` is absent or not a
resolvable commit. Otherwise collect name-status changes from stored head to
HEAD. Rebuild through Step 2 if more than 200 files changed or changes exceed
25% of tracked files.

Otherwise read committed HEAD blobs for changed paths and memory claims citing
them; never use dirty worktree content. Follow renames, rewrite every evidence
path through the rename map, remove deleted evidence, and inspect one-hop
importers when a package root, manifest, or exported entry changed. Remove or
rewrite claims contradicted by changed files. With a positional focus, reread
that subtree within the same cap. Report dirty paths only as an overlay.

Done when each committed changed path is reflected, affected claims are
revalidated or removed, limits hold, and frontmatter names current HEAD.

## 4. Resume and report

After interruption, recompute HEAD and changed paths. If they differ from the
ledger, restart the affected cold or warm step. Resume the first pending item
from the persisted ledger. Present the updated map without requiring the user
to open the memory file. On warm runs, end with `Drift since last recon`.

Done when the report cites the memory snapshot, focus results, drift, and any
unverified area; labels each heading rebuilt, patched, or representative-only;
and discloses dirty paths.

## Constraints

- `head` always names an existing commit, never a dirty-tree placeholder.
- Do not turn the memory into a file inventory or append-only history.
