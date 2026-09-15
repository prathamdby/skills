---
name: commit
description: >
  commit when saving scoped git changes with a message derived only from the
  committed diff, especially after tickets or reviews could bias the wording.
---

# Commit

## Options

Derive scope, style, hooks, and trailers from the request. Unspecified:
staged, conventional, hooks off (`-n`), trailers denied.
"commit the unstaged work" → unstaged. Index must be empty or `BLOCKED`.
"plain subject" / "simple message" → simple.
"run hooks" / "do not skip hooks" → verify; omit `-n`.
"keep Co-authored-by" / "allow trailers" / named identity trailers →
trailers allow. Record that opt-in.
Naming both scopes or both styles is `BLOCKED`. Do not guess a missing
needed value.

## Iron laws

1. Clean-room: every message line is proved by a selected diff hunk. Session,
   ticket, plan, branch, and reviewer facts stay out. Never start from a
   review-follow-up draft; draft only from the locked diff.
2. Hooks: without verify, use `-n`; with verify, never bypass hooks. A failed
   hook does not change the selected policy.
3. Command: use one subject `-m` and at most one body `-m`. Never use HEREDOC,
   `-F`, `-a`, an editor, or one `-m` per bullet.
4. Style: load the chosen section of `./REFERENCE.md` before drafting.
5. Trailers: do not draft or pass `Co-authored-by` / `Signed-off-by` /
   `Made-with`, or freeform harness footers such as `Made with Cursor`, unless
   an explicit user trailer request is recorded. Default deny means `-m` args
   are subject/body only.

## 1. Lock the commit snapshot

Read status. Staged scope uses `git diff --cached`. Unstaged scope requires an
empty index or terminates `BLOCKED`, and uses `git diff`; untracked files remain
excluded. Hash the selected diff with `git hash-object --stdin`. If empty,
report `NO_CHANGES`, naming unstaged tracked and untracked layers without
switching scope.

Record
`scope | selected diff hash | paths | message | trailers=deny|allow | command | commit | terminal`.
Done when the exact bytes intended for the commit are fixed.

## 2. Draft and trace

Load the chosen style section in `./REFERENCE.md`. That section includes the
imperative test, and for conventional only wrap and why-vs-how. Infer type
and wording from the locked diff only. Produce a subject and, for
conventional style only, an optional bullet body.

Before mutation, map every subject and body line to proving paths and hunks.
Delete or rewrite unproved text. Reject ticket IDs, reviewer references,
session rationale, scope notation, trailing periods, over-limit subjects,
lowercase-leading conventional body bullets, and banned identity trailers per
the shared rejection check in `./REFERENCE.md` unless trailers are allowed.

Done when the message passes the style rules and every line has a trace.

## 3. Commit

Re-hash the selected scope immediately before mutation. On mismatch, return to
Step 1. For unstaged scope, stage only the locked tracked paths now and verify
the cached diff matches the locked snapshot.

Use `git commit -n -m "<subject>"`; conventional style may add one body `-m`.
Omit `-n` only when verify is on. Pass subject and body as separate argv values
through the tool API; when using a shell, assign and quote variables so `"`,
backticks, `$`, backslashes, and newlines remain literal.

Done when git creates one commit. Hook, git, or interruption errors are
`BLOCKED`; report stderr and any index mutation without changing hook policy.

## 4. Verify and report

Compare the new commit diff and paths with the locked snapshot and
`git log -1 --format=%B` with the ledger message. Verify hook policy,
one-or-two `-m` shape, and preservation of out-of-scope work. A mismatch is
`BLOCKED`; report the created SHA and exact difference.

Then apply Trailer hygiene in `./REFERENCE.md`. After every denied-trailer
commit, and on allow-trailers when `%B` has an unrequested banned key or
freeform harness line, open a Python or Node.js REPL and read `HEAD` `%B`.
Strip only those unrequested lines. Keep requested trailers under allow.
Hooks often re-add trailers after `-m`. A shell one-liner is not the strip.
Still dirty or amend unsafe is `BLOCKED`. Report whether a trailer amend ran.

Report commit SHA, subject, scope, hooks, trailers policy, trace summary, and
remaining unstaged tracked and untracked work.

Terminal values are `SUCCESS`, `NO_CHANGES`, and `BLOCKED`. Never push.
