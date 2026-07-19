---
name: box
description: >
  box when cloning, updating, listing, or searching an external git repository
  from its real local source.
---

# Box

## Flags

| Flag | Default | Effect |
|---|---|---|
| `--persist` | off | Upsert the local repo in the working directory's `AGENTS.md` |
| `--update` | off | Pull an existing clone before search |
| `--list` | off | List the manifest and stop |
| `--no-subagents` | off | Run every stage in the main thread |

No flags clone if needed, search, and report. Never persist without
`--persist`.

## Paths and mode

Resolve `<anchor>` as the absolute directory containing this `SKILL.md`.
Use `<anchor>/sandbox/manifest.json` and `<anchor>/sandbox/<slug>/`. Include
absolute paths in every brief.

Use Direct mode for `--no-subagents` or when no subagent tool exists. Otherwise
use Delegated mode. Direct runs each contract itself. Delegated uses one Prepare
writer, disjoint read-only Search workers, and one Persist writer; the
coordinator only detects, dispatches, aggregates, and reports.

Record:
`mode | slug | URL | prepare | search scopes | persist | current | terminal`.
After interruption, verify the manifest, clone, returned search evidence, and
persist markers before advancing.

## 1. Detect

`--list` or a bare invocation reads the manifest directly, prints each slug,
URL, and local path, then succeeds without other stages. With a URL, derive the
slug from the repo name. With a name, require one exact manifest match; ask for
the URL when absent or ambiguous.

Done when the list is reported or slug, URL, and local path are resolved.

## 2. Prepare

Run or dispatch the Prepare contract in `./REFERENCE.md`. Wait before search.
A failed or partial clone is never added to the manifest. On retry, move a
manifest-free invalid clone to a timestamped `.partial` sibling before cloning;
never delete an unknown directory.

Done when the local path contains a valid clone, its origin matches the URL,
and the manifest entry is current, or a prepare error is reported.

## 3. Search

Run or dispatch the Search contract in `./REFERENCE.md`. Partition parallel
workers by non-overlapping subtree or question. If the request gives no
question, inspect structure, README, manifests, and entry points. Bound each
worker to its scope and require `path:line` citations or `no matches`.

Done when every scope returned evidence or an explicit no-match result.

## 4. Aggregate and persist

Answer the user's question by theme, deduplicate citations, and disclose
unsearched areas. With `--persist`, run or dispatch the Persist contract only
after search. It may edit only the working directory's `AGENTS.md`.

Done when the answer is cited and, when requested, the marker block exists
exactly once.

## 5. Report

Report repo, absolute local path, prepare status, searched scopes, no-match
areas, and persist status. Terminal values are `SUCCESS`, `BLOCKED`, and
`NO_MATCHES`.

Never push, commit inside clones, infer contents from a URL, or let stages
overlap their write ownership.
