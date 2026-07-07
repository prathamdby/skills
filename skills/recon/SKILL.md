---
name: recon
description: >
  recon builds a persistent memory of a codebase and keeps it current. Cold
  start explores the unknown; every later run explores only the drift. Triggers:
  /recon, explore or map a codebase, re-orient in a repo after time away. Flags:
  --refresh, and a positional focus argument.
---

# Recon

Explore the known, then verify it; the cost of re-orienting scales with how much the repo drifted, not with how big it is.

## Flags

| Flag / Arg     | Effect                                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| `--refresh`    | Ignore existing memory; full re-exploration; rewrite the memory from scratch. |
| Positional arg | A focus area to explore in extra depth this run; also woven into the report.  |

No flags -> cold path if no memory exists, warm path otherwise.

## Memory

The skill folder (the directory holding this `SKILL.md`) is the **anchor**.
Memory lives at `<anchor>/memory/<slug>.md`, where `<slug>` is the repo root's
basename plus the first 8 chars of the sha256 of its absolute path (two clones
never collide). Create `<anchor>/memory/` if absent.

Each memory file starts with frontmatter:

- `repo:` absolute root path
- `head:` full commit SHA
- `updated:` `YYYY-MM-DD`

Followed by the map: layout and structure, entry points, key modules and their
responsibilities, data flow, conventions, build/test/lint commands, gotchas.
Memory is derived state about a target repo; it never gets committed into the
target repo.

## Step 1: Locate

`git rev-parse --show-toplevel` for the repo root; compute the slug; check for
the memory file. Missing file or `--refresh` -> Step 2 (cold). Present -> Step 3
(warm). Completion: the path is decided, cold or warm.

## Step 2: Cold path

Traditional full exploration: layout, entry points, key modules, data flow,
conventions, build/test commands, gotchas. Use read-only subagents for legwork
when the harness offers them. Then write the memory file with the current HEAD
SHA (`git rev-parse HEAD`) and today's date. Completion: memory file exists on
disk with all frontmatter fields and every map section filled. Go to Step 5.

## Step 3: Warm path

Read the memory file first; it is the map of the known. Then measure drift:
verify the recorded SHA exists (`git cat-file -e <sha>^{commit}`), then
`git diff --name-status <sha>..HEAD`. Fallback triggers, either one -> treat this
run as Step 2 with `--refresh` semantics (full re-explore, rewrite): the SHA is
gone (rebase, gc, shallow clone), or the diff is huge (more than 200 files, or
more than 25% of tracked files per `git ls-files | wc -l`). Otherwise -> Step 4.
Completion: drift is measured and the route (patch vs rewrite) is chosen.

## Step 4: Patch

Re-explore only the changed paths from the diff: read added and modified files,
drop memory claims about deleted ones, follow renames. Trust untouched sections
of the memory; do not re-verify them. Patch the affected memory sections, set
`head:` to current HEAD and `updated:` to today. Note uncommitted changes
(`git status --porcelain`) in the report but never record a dirty state as
`head:`; the SHA always names a real commit. Completion: every file in the diff
is reflected in the memory, SHA and date updated.

## Step 5: Report

Present the codebase overview from the (updated) memory, weighted toward the
positional focus if given. On a warm run, end with a "Drift since last recon"
section: what changed and how the memory moved. Completion: the user has the
overview without needing to open the memory file.

## Constraints

- Never write the memory into the target repo; it lives in the anchor only.
- The recorded `head:` is always a commit that exists; never a dirty-tree
  placeholder.
- Warm runs read the memory before touching the repo; the known comes first.
