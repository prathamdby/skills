---
name: fix-pr
description: >
  fix-pr when exhaustively handling open pull-request feedback, including nested
  discussions, CI, invalid suggestions, arrivals, fixes, and replies. Loads gh
  for hunt and reply I/O.
---

# Fix PR feedback

## Flags

| Flag            | Default           | Effect                     |
| --------------- | ----------------- | -------------------------- |
| `--pr <n\|url>` | current branch PR | Target PR                  |
| `--no-push`     | off               | Keep commits local         |
| `--no-reply`    | off               | Do not post review replies |

Missing values are `BLOCKED`.

## 1. Resolve and synchronize

Resolve owner, repo, number, URL, base, head branch, and remote head SHA. Block
on auth failure, missing/closed PR, dirty tree, or unsafe head checkout.
Fetch, check out head, and fast-forward to remote SHA; never reset or force.
Record: `PR/head SHA | hunt counts | current finding | verdicts | commit/push | replies | terminal`.
Done when local HEAD equals the PR head SHA and the ledger identifies the PR.

## 2. Hunt before editing

**REQUIRED SUB-SKILL:** Read `../gh/SKILL.md` before any GitHub I/O. Hunt through
that skill: surfaces 1–2 with `pr-threads.ts --json --open --complete`; CI
snippets with `ci-failures.ts --json --pr N --sha <head>`. Surfaces:

1. unresolved review threads, including outdated ones
2. every comment page inside each thread
3. review-comment API chains reconciled to thread roots
4. actionable top-level review bodies
5. actionable PR conversation comments
6. PR CI on the head SHA: terminal non-success required/blocking checks and annotations

Every hunt reconciles review-comment chains unless every root is proved present.
Load recipe 3 in `./REFERENCE.md` (REST reconcile); script exit is not proof
roots are present. Skip 4–5 only when `--complete` JSON moreReviews,
moreComments, and moreConvo are false. Recipe 6 always SHA-pins required or
blocking checks and annotations; `ci-failures` is drilldown only. Load remaining
recipes only after `run` exits. Record counts and page markers. No triage or
edit before all six passes finish. Normalize one finding per claim (source,
target, author, path/line, rule ID, body). Deduplicate identical keys from
`./REFERENCE.md`; preserve native reply targets. Done when pagination is
exhausted and every finding is in the ledger.

## 3. Triage every finding

Read surrounding code and trace the claimed path; reproduce when possible.
Assign one verdict: `fix`, `reject`, `clarify`, or `already-fixed`, with one
evidence line; record why if skipped. No edits until all findings have verdicts.
Done when all findings are triaged and rejects have concrete evidence.

## 4. Fix and verify

Apply only `fix` verdicts in focused edits. Run narrowest covering checks for
each fixed cluster; failed required checks are `BLOCKED`. Do not change code
for rejected or clarification findings. Done when every fix has a verified diff
or no code fix was needed.

## 5. Commit and push

When a diff exists, discard pre-drafted subjects. Read `../commit/SKILL.md` and
run it with `--unstaged` so it drafts from the locked diff as
`type: <concrete code action proved by dominant hunks>`. Trailers default deny
per Commit clean-room in `./REFERENCE.md` (identity trailers and harness
footers). Require no ban-list token and passing conversation-only test; reject
canonical excuses there. Skip commit on a clean tree. Unless `--no-push`, push
and verify remote SHA; never force. With `--no-push`, fixed findings become
`AWAITING_PUSH`. Remote movement or push rejection is `BLOCKED`. Re-read
`git log -1 --format=%B`; ban-list tokens or banned trailers are `BLOCKED`.
Apply Trailer hygiene in `../commit/REFERENCE.md` if needed. Done when there is
no diff, or one verified clean-room commit is pushed.

## 6. Re-hunt until stable

Repeat all six passes after code or remote mutations; triage arrivals and
repeat Steps 4–6. After actionable set changes, require two consecutive hunts
with matching sets. Done when no finding is new or untriaged and stable hunts
finish.

## 7. Reply and report

Unless `--no-reply`, skip targets whose replies satisfy the verdict, draft
remaining replies using `./REFERENCE.md`, then apply
`./references/unslop-reply-drafts.md`. Preserve bot prefixes. Consolidate
shared targets. Post replies through loaded gh skill (`pr-reply.ts`); do not
invent raw `gh`. Re-hunt after replies; new findings return to Step 3. Before
retrying a failed reply, refetch its target; retry once. Second failure is
`BLOCKED`. Do not resolve threads unless asked. Report
`source | finding | verdict | action | evidence`, PR URL, commit/push state,
hunt counts, and unreplied items. Terminals: `SUCCESS`, `NO_CODE_CHANGE`,
`AWAITING_PUSH`, `BLOCKED`. Never `SUCCESS` with unreplied targets. After
interruption, restart at Step 1. Does not fix merge conflicts.
