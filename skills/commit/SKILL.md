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
empty index, uses `git diff`, stages only its tracked paths, then re-reads
`git diff --cached`; untracked files remain excluded and must be reported.
If the selected diff is empty, report `NO_CHANGES` and mention other dirty
layers without switching scope.

Record `scope | staged diff hash | paths | message | command | commit | terminal`.
Done when the exact bytes intended for the commit are fixed.

## 2. Draft and trace

Load the chosen style section in `./REFERENCE.md`. Infer type and wording from
the locked diff only. Produce a subject and, for conventional style only, an
optional bullet body.

Before mutation, map every subject and body line to proving paths and hunks.
Delete or rewrite unproved text. Reject ticket IDs, reviewer references,
session rationale, scope notation, trailing periods, and over-limit subjects.

Done when the message passes the style rules and every line has a trace.

## 3. Commit

Use `git commit -n -m "<subject>"` or one additional body `-m`; omit `-n` only
with `--verify`. Confirm the staged diff hash still matches the ledger
immediately before running it. On mismatch, return to Step 1.

Done when git creates one commit, or returns a captured hook or git error.

## 4. Verify and report

Compare the new commit diff and paths with the locked snapshot. Verify the
stored message, hook policy, one-or-two `-m` shape, and preservation of
out-of-scope work. Report commit SHA, subject, scope, hooks, and trace summary.

Terminal values are `SUCCESS`, `NO_CHANGES`, and `BLOCKED`. Never push.
