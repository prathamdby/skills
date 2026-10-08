# Mapping

Load only for map or rebuild; reading a saved report does not reach this file.

## Cold or rebuild

Explore breadth first: manifests, layout, entry points, dependency boundaries,
commands, and conventions. Read at most three representative anchor files for
at most 30 modules named by workspace manifests; go deeper only for named focus.
Use non-overlapping read-only subagents when available. Write all required
sections and evidence, merge duplicates, and prune to the entry's limits.

## Warm drift

Read memory before source. Resolve its head as a commit; otherwise go cold.
Collect name-status changes from stored head to HEAD. Rebuild if more than
200 files changed or changes exceed 25% of tracked files.

Otherwise read committed HEAD blobs for changed paths and claims citing them,
not dirty worktree content. Follow renames and rewrite evidence through that
map; remove deleted evidence. Inspect one-hop importers when a package root,
manifest, or exported entry changes. Revalidate or remove affected claims.
For named focus, reread that subtree within the cold-path cap.

Done when every committed changed path is reflected, affected claims are
revalidated or removed, limits hold, and frontmatter names current HEAD.
