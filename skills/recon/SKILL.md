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
eight SHA-256 characters of the repo's absolute root. Create the directory when
needed. Never write memory inside the target repo.

Frontmatter is `repo`, full commit `head`, and ISO date `updated`. The body has
these headings: Layout, Entry points, Modules, Data flows, Commands,
Conventions, Gotchas, Evidence. Every claim names one or more evidence paths.
Keep at most 10 bullets per heading and 200 lines total. Merge duplicates and
remove claims whose evidence no longer exists.

## 1. Locate

Resolve the repo root, memory path, current HEAD, and dirty paths. Record:

`route | stored head | current head | changed | current item | pending | terminal`

Done when the path and cold, warm, or refresh route are known.

## 2. Cold or refresh

Explore breadth first: manifests, top-level layout, entry points, dependency
boundaries, commands, and conventions. Read at most three representative anchor
files per module; go deeper only for the positional focus. Use non-overlapping
read-only subagents when available. Write every required section and evidence
path, then prune to the limits.

Done when the memory file exists, its `head` equals current HEAD, and every
heading contains evidence or says `None found`.

## 3. Warm drift

Read memory before repo files. Verify the stored commit exists, then collect
name-status changes from stored head to HEAD. Rebuild through Step 2 if the
commit is missing, more than 200 files changed, or changes exceed 25% of
tracked files.

Otherwise read changed files and memory claims citing them. Follow renames,
remove deleted evidence, and inspect one-hop dependents when a public boundary
changed. Update affected claims only. Record dirty paths in the report as an
uncommitted overlay; never store them as committed truth.

Done when each committed changed path is reflected, affected claims are
revalidated or removed, limits hold, and frontmatter names current HEAD.

## 4. Resume and report

After interruption, recompute HEAD and changed paths. If they differ from the
ledger, restart the affected cold or warm step. Present the updated map without
requiring the user to open the memory file. On warm runs, end with `Drift since
last recon`; always disclose dirty paths and incomplete coverage.

Done when the report cites the memory snapshot, focus results, drift, and any
unverified area.

## Constraints

- `head` always names an existing commit, never a dirty-tree placeholder.
- Do not turn the memory into a file inventory or append-only history.
