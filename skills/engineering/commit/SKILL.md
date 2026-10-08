---
name: commit
description: >
  commit to save scoped changes with a message proved by the selected diff.
---

# Commit

## Options

Default: staged, conventional, trailers denied; hooks off only where host
policy permits bypass, otherwise hooks on. "Unstaged work" requires an empty
index; untracked files stay excluded. "Plain subject"/"simple message" selects
simple. "Run hooks"/"do not skip hooks" selects on. Explicit identity-trailer
requests opt in only to those trailers. Conflicting scopes/styles or missing
needed values block; hook failure does not change the chosen policy.

## 1. Lock

Read status and the selected diff (cached for staged, worktree for unstaged).
Empty → NO_CHANGES, naming other layers without switching. Hash selected bytes
with git hash-object. For unstaged, block if index is nonempty.
Record `scope | style | hooks | requested trailers | hash | paths | message | command | SHA | terminal`.
Done when intended bytes and out-of-scope work are fixed.

## 2. Draft and trace

Load the selected style and rejection check in `REFERENCE.md`.
Draft only from locked hunks, not session/ticket/plan/branch/reviewer context
or a prior review-follow-up draft. Map every message line to proving hunks.
Rewrite unproved copy and all rejected forms. Use one subject -m and at most
one body -m, not an editor, HEREDOC, -F, -a, or an argument per bullet.
Done when style, clean-room trace, and requested-trailer policy pass.

## 3. Commit

Rehash immediately before mutation; movement restarts Lock. For unstaged,
stage only locked tracked paths and require cached bytes equal the snapshot.
Use separate literal argv values for subject/body; shell variables must
preserve quotes, backticks, dollars, backslashes, and newlines.
Run hooks when required/chosen; bypass only if both recorded policy and host
permit it. Done when one commit exists; errors/interruption are BLOCKED with
stderr and any index mutation, never silently changing hook policy.

## 4. Verify

Compare commit diff/paths and `%B` to the locked snapshot/message, check command
shape/hook policy and preservation of unrelated work. Mismatch blocks with SHA
and exact difference. For denied trailers always apply Trailer hygiene in
`REFERENCE.md`; with opt-in, apply it when an unrequested banned line appears.
Keep the REPL strip and unpublished/run-owned-HEAD checks; a clean -m is not
proof of clean HEAD. Done when commit and message match after any safe amend.

Report SHA, subject, scope, hooks/trailers, trace, amend status, and remaining
tracked/untracked work. Terminals: SUCCESS, NO_CHANGES, BLOCKED. Never push.
