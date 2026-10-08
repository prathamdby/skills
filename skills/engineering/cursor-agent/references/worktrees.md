# Worktrees and parallel runs

Use `cursor-agent --print -w <name> --worktree-base <branch> --workspace <repo>`.
The path is `~/.cursor/worktrees/<reponame>/<name>`; record `Using worktree:`.
Omit name only if generation is acceptable. Skip setup only when explicitly
asked, using `--skip-worktree-setup`; verify edits in the emitted tree.

One modifying child per tree, disjoint paths, independent launches in one wave;
queue overlaps. Plan/ask may share only nonwriting trees.
Record PID/session and workspace, inspect status/diff in each child, and
recheck any integrated tree. Remove only clean trees this run created and
not kept. Done when every child is verified and cleanup is recorded.
