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
on authentication failure, missing PR, closed PR, dirty working tree, or a PR
from a head branch that cannot be checked out safely. Fetch, check out the head,
and fast-forward to the remote SHA. Never reset, force, or discard local work.

Record:
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

Use platform-native tools when they cover every surface. When using GitHub CLI,
load only the hunt recipes in `./REFERENCE.md`. Record item counts and final
page markers. Do not triage or edit before all six passes finish.

Normalize one atomic finding per claim. Keep source, URL or ID, reply target,
author, path/line, rule ID, body, and existing replies. Drop acknowledgments
and status noise. Deduplicate by meaning, path, and rule; preserve every native
reply target.

Done when pagination is exhausted and every normalized finding is in the
ledger.

## 3. Triage every finding

Read surrounding code and trace the claimed path. Reproduce with the narrowest
test, type check, or call trace when possible. Assign exactly one verdict:
`fix`, `reject`, `clarify`, or `already-fixed`, with one evidence line.
No edits until every finding has a verdict.

Done when no finding is untriaged and invalid suggestions have concrete
rejection evidence.

## 4. Fix and verify

Apply only `fix` verdicts in focused edits. Run the narrowest covering checks
for each fixed cluster. A failed or unavailable required check is `BLOCKED`.
Do not change code for rejected or clarification findings.

Done when every fix has a verified diff or no code fix was needed.

## 5. Commit and push

When a diff exists, read `../commit/SKILL.md` and run it once. Skip commit on a
clean tree. Unless `--no-push`, push normally and verify remote SHA. Never force
push. With `--no-push`, fixed findings become `AWAITING_PUSH` and receive no
"fixed" reply.

Done when there is no diff, or one verified commit is local and pushed as
requested.

## 6. Re-hunt until stable

Repeat all six hunt passes after the last code or remote mutation. Normalize
and triage arrivals, then repeat Steps 4–6. If feedback arrived during the run,
require two consecutive hunts with the same actionable finding set.

Done when no finding is new, untriaged, or waiting on a local fix.

## 7. Reply and report

Unless `--no-reply`, draft each native-surface reply using `./REFERENCE.md`,
then apply `./references/unslop-reply-drafts.md`. Preserve required bot command
prefixes exactly. Consolidate findings sharing one conversation target. Re-hunt
once after replies to catch arrivals; do not resolve threads unless asked.

Report `source | finding | verdict | action | evidence`, PR URL, commit and push
state, hunt counts, and unreplied items. Terminal values are `SUCCESS`,
`NO_CODE_CHANGE`, `AWAITING_PUSH`, and `BLOCKED`.
After interruption, restart at Step 1 and re-hunt before trusting the ledger.
It does not fix CI, merge conflicts, or stacked-branch order, and never invokes
`make-pr`.
