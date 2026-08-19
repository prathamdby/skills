---
name: recon
description: recon when mapping the current codebase, refreshing an earlier map, or re-orienting after repository changes.
---

# Recon

Map the repository and keep the map for later runs. Store it in a memory file next to this skill file, named after the repository with a short hash of its path. Never write the memory inside the target repository.

On a first run, read the layout, the entry points, the main modules, and the commands, then write the map. Every claim in the map must name the file that proves it. Keep the map short. It is a map, not a file inventory.

On later runs, read the memory first. Compare the stored commit with the current one and update only the parts that drifted. Rebuild the whole map only when the change is large. Use `--refresh` to force a rebuild. A positional argument names an area to explore in more depth.

End by showing the user the map. On repeat runs, say what changed since the last one.
