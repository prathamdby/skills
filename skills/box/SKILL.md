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
absolute paths in every brief. Resolve the working directory and its
`AGENTS.md` to absolute paths; never place sandbox data there.

Use Direct mode for `--no-subagents` or when no subagent tool exists. Otherwise
use Delegated mode. Direct runs each contract itself. Delegated uses one Prepare
writer, disjoint read-only Search workers, and one Persist writer; the
coordinator only detects, dispatches, aggregates, and reports.
In Delegated mode the coordinator never executes a stage contract. A failed
stage worker makes the run `BLOCKED`. Direct mode uses the same ledger.

Record:
`mode | slug | URL | prepare | search scopes | persist | current | terminal`.
After interruption, verify the manifest, clone, returned search evidence, and
persist markers. Resume at the earliest incomplete done condition and
redispatch any search scope without a result.

## 1. Detect

`--list` or a bare invocation treats a missing manifest as `[]`, prints each
slug, URL, and local path, marks invalid clones stale, then stops. With a URL,
use its final path segment without `.git` as the slug. With a name, match slug
case-sensitively. Zero or several matches ask for the URL.

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
worker to its scope and require `path:line` citations or `no matches`. Reject
overlapping scopes before dispatch.

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
`NO_MATCHES`. Use `NO_MATCHES` only when every scope returned no matches.

Never push, commit inside clones, infer contents from a URL, or let stages
overlap their write ownership.
