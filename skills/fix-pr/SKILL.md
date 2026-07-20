---
name: fix-pr
description: >
  fix-pr when exhaustively handling open pull-request feedback, including
  nested discussions, invalid suggestions, new arrivals, fixes, and replies.
---

# Fix PR feedback

## Flags

| Flag | Default | Effect |
|---|---|---|
| `--pr <n\|url>` | current branch PR | Target PR |
| `--no-push` | off | Keep commits local |
| `--no-reply` | off | Do not post review replies |

Missing values are `BLOCKED`.

## 1. Resolve and synchronize

Resolve owner, repo, number, URL, base, head branch, and remote head SHA. Block
on auth failure, missing/closed PR, dirty tree, or unsafe head checkout.
Fetch, check out the head, and fast-forward to the remote SHA. Never reset,
force, or discard local work. Record:
`PR/head SHA | hunt counts | current finding | verdicts | commit/push | replies | terminal`.
Done when local HEAD equals the PR head SHA and the ledger identifies the PR.

## 2. Hunt before editing

Collect every page from all applicable surfaces:
1. unresolved review threads, including outdated ones
2. every comment page inside each thread
3. review-comment API chains reconciled to thread roots
4. actionable top-level review bodies
5. actionable PR conversation comments
6. actionable check annotations attached to the PR head
Every hunt reconciles review-comment chains unless thread discovery proves every
root is present. When using GitHub CLI, load hunt recipes in `./REFERENCE.md`.
Record counts and final page markers. Do not triage or edit before all six
passes finish. Normalize one atomic finding per claim. Keep source, URL or ID,
reply target, author, path/line, rule ID, body, and existing replies. Drop
acknowledgments and status noise. Deduplicate only identical stable keys from
`./REFERENCE.md`; preserve every native reply target. Done when pagination is
exhausted and every normalized finding is in the ledger.

## 3. Triage every finding

Read surrounding code and trace the claimed path. Reproduce with the narrowest
test, type check, or call trace when possible. Assign exactly one verdict:
`fix`, `reject`, `clarify`, or `already-fixed`, with one evidence line. If
reproduction is skipped, record why. No edits until every finding has a verdict.
Done when no finding is untriaged and invalid suggestions have concrete
rejection evidence.

## 4. Fix and verify

Apply only `fix` verdicts in focused edits. Run the narrowest covering checks
for each fixed cluster. A failed required check is `BLOCKED`; if none exists,
record that evidence. Do not change code for rejected or clarification findings.
Done when every fix has a verified diff or no code fix was needed.

## 5. Commit and push
When a diff exists, discard every pre-drafted subject (ledger, teammate,
manager, branch, "review follow-up"). Read `../commit/SKILL.md` and run it
once with `--unstaged` so that skill alone drafts from the locked diff as
`type: <concrete code action proved by dominant hunks>`. Before `git commit`,
load Commit clean-room in `./REFERENCE.md`; require no ban-list token, a
passing conversation-only test, and rejection of every excuse there
(including "feedback ≠ findings", "body lists hunks", "Fixed-in reply needs
review framing"). Canonical rejects: `fix: address review feedback on agent
files` and `fix: address ... review findings`. Skip commit on a clean tree.
Unless `--no-push`, push and verify remote SHA; never force push. With
`--no-push`, fixed findings become `AWAITING_PUSH` with no "fixed" reply.
Remote movement or push rejection is `BLOCKED`. Re-read
`git log -1 --format=%B`; ban-list or conversation-only text is `BLOCKED`
(do not push). Done when there is no diff, or one verified clean-room commit
is local and pushed.

## 6. Re-hunt until stable
Repeat all six hunt passes after the last code or remote mutation. Normalize
and triage arrivals, then repeat Steps 4–6. After any hunt whose actionable
set changed, require two consecutive hunts with the same set. Done when no
finding is new, untriaged, or waiting on a local fix and the required
consecutive stable hunts have completed.

## 7. Reply and report
Unless `--no-reply`, skip targets whose existing replies already satisfy the
verdict, draft remaining replies using `./REFERENCE.md`, then apply
`./references/unslop-reply-drafts.md`. Preserve bot command prefixes.
Consolidate shared targets. Re-hunt after replies; new findings return to
Step 3. Before retrying a failed reply, refetch its target; if the intended
reply is present, mark it posted, otherwise retry once. A second failure is
`BLOCKED`. Do not resolve threads unless asked. Report
`source | finding | verdict | action | evidence`, PR URL, commit and push
state, hunt counts, and unreplied items. Terminals: `SUCCESS`,
`NO_CODE_CHANGE`, `AWAITING_PUSH`, `BLOCKED`. Use `NO_CODE_CHANGE` when no
commit was created; never `SUCCESS` with an unreplied required target. After
interruption, restart at Step 1 and re-hunt before trusting the ledger. Does
not fix CI, merge conflicts, or stacked-branch order; never invokes `make-pr`.
