# Worktrees and parallel runs

Use `codex exec --worktree -C <abs-dir> "<prompt>"` only when requested.
Worktree is boolean: no name or invented path. Record the managed tree the
CLI prints; edits and verification belong there.

One modifying exec per tree, disjoint paths, independent launches in one wave;
queue overlaps. Read-only sandbox may share a tree only when runs do not
write: it constrains model shell, not the whole process.
Record each PID/session and path, then inspect status/diff in every tree.
From the main repo use worktree list/remove only for clean trees this run
created and not kept. Done when each child is verified and cleanup is recorded.
