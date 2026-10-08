# Worktrees and parallel runs

Only when requested: `claude --print --worktree [name] "<prompt>"`.
Help does not promise its location; record the emitted path, never invent one.
Edits land there, so verify inside that tree.

One modifying child per worktree; disjoint paths, independent launches in one
wave, overlapping writes queued. Plan mode may share a tree only while it
does not write. Record a PID/session and workspace per child.
Inspect status and diff in every child tree and recheck an integrated tree.
Remove only clean worktrees this run created and not explicitly kept.
Done when every child has a recorded handle/path, verification, and cleanup state.
