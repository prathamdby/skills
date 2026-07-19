---
name: commit
description: >
  commit when saving scoped git changes with a message derived only from the
  committed diff, especially after tickets or reviews could bias the wording.
---

# Commit

## Flags

| Flag | Default | Effect |
|---|---|---|
| `--staged` | yes | Commit the current index |
| `--unstaged` | no | Stage and commit tracked worktree changes; index must be empty |
| `--conventional` | yes | `type: description` |
| `--simple` | no | Plain one-line subject |
| `--verify` | off | Run hooks; otherwise every commit uses `-n` |

Scope flags conflict with each other; style flags conflict with each other.
Report `BLOCKED` instead of choosing. No flags mean staged, conventional, `-n`.

## Iron laws

1. Clean-room: every message line is proved by a selected diff hunk. Session,
   ticket, plan, branch, and reviewer facts stay out.
2. Hooks: without `--verify`, use `-n`; with it, never bypass hooks. A failed
   hook does not change the selected policy.
3. Command: use one subject `-m` and at most one body `-m`. Never use HEREDOC,
   `-F`, `-a`, an editor, or one `-m` per bullet.
4. Style: load the chosen section of `./REFERENCE.md` before drafting.

## 1. Lock the commit snapshot

Read status. Staged scope uses `git diff --cached`. Unstaged scope requires an
empty index or terminates `BLOCKED`, and uses `git diff`; untracked files remain
excluded. Hash the selected diff with `git hash-object --stdin`. If empty,
report `NO_CHANGES`, naming unstaged tracked and untracked layers without
switching scope.

Record `scope | selected diff hash | paths | message | command | commit | terminal`.
Done when the exact bytes intended for the commit are fixed.

## 2. Draft and trace

Load the chosen style section in `./REFERENCE.md`. Infer type and wording from
the locked diff only. Produce a subject and, for conventional style only, an
optional bullet body.

Before mutation, map every subject and body line to proving paths and hunks.
Delete or rewrite unproved text. Reject ticket IDs, reviewer references,
session rationale, scope notation, trailing periods, over-limit subjects, and
lowercase-leading conventional body bullets.

Done when the message passes the style rules and every line has a trace.

## 3. Commit

Re-hash the selected scope immediately before mutation. On mismatch, return to
Step 1. For unstaged scope, stage only the locked tracked paths now and verify
the cached diff matches the locked snapshot.

Use `git commit -n -m "<subject>"`; conventional style may add one body `-m`.
Omit `-n` only with `--verify`. Pass subject and body as separate argv values
through the tool API; when using a shell, assign and quote variables so `"`,
backticks, `$`, backslashes, and newlines remain literal.

Done when git creates one commit. Hook, git, or interruption errors are
`BLOCKED`; report stderr and any index mutation without changing hook policy.

## 4. Verify and report

Compare the new commit diff and paths with the locked snapshot and
`git log -1 --format=%B` with the ledger message. Verify hook policy,
one-or-two `-m` shape, and preservation of out-of-scope work. A mismatch is
`BLOCKED`; report the created SHA and exact difference.

Report commit SHA, subject, scope, hooks, trace summary, and remaining unstaged
tracked and untracked work.

Terminal values are `SUCCESS`, `NO_CHANGES`, and `BLOCKED`. Never push.
