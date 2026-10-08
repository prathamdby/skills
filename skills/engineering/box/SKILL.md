---
name: box
description: >
  box to manage external Git clones and answer questions from their local source.
---

# Box

## Options and ownership

Default clone-if-needed/search/report; persist only when asked.
"Update"/"pull first" fast-forwards first; "list" reports clones and stops.
"Persist"/"add to AGENTS.md" enables that write after search.
"No subagents"/"in this thread", or unavailable delegation, selects Direct;
otherwise Delegated. Keep this explicit mode switch, not a size heuristic.
Conflicting list/search or missing needed URL blocks.

Resolve this skill's absolute anchor, sandbox/manifest.json, sandbox/<slug>,
and working repo/AGENTS.md. Sandboxes stay outside the working repo.
Direct executes stage contracts. Delegated uses one Prepare writer, disjoint
read-only Search workers, one Persist writer; parent only dispatches/aggregates.
A failed worker blocks; workers cannot delegate.
Record `mode | slug/URL/path | prepare | search scopes/evidence | persist | current | terminal`.

## 1. Detect and prepare

Bare/list: missing manifest is empty; report slug, URL, path and stale clones,
then stop. URL slug is final segment without .git; names match case-sensitively.
Zero/multiple matches need a URL. Done when list is sent or identity fixed.

For search, run/dispatch `references/prepare.md` with absolute inputs. Wait
for validation before search. A partial clone never enters the manifest;
unknown directories are not deleted. Done when clone origin and manifest match.

## 2. Search

Assign non-overlapping subtrees/questions with absolute clone paths. Search
local files only, read-only; no question means README/manifests/layout/entries.
Require path:line evidence or a scoped no-match, surrounding context, and
omissions. Briefs include anchor, identity, stage, write boundary, inputs,
outputs, and no nested delegation. Done when every scope returns evidence.

## 3. Aggregate and persist

Answer by theme with deduplicated citations and unsearched areas.
Only when persist was requested and search is complete, run/dispatch
`references/persist.md`; its only target is the working repo's AGENTS.md.
Done when answer is cited and any authorized marker block exists exactly once.

On resume verify manifest/clone/results/markers; restart the earliest unfinished
condition, redispatch missing searches. Report identity/path, preparation,
scopes/no-matches, persist. SUCCESS/BLOCKED/NO_MATCHES (all scopes empty).
No clone commits/pushes, URL-based guesses, or overlapping write ownership.
