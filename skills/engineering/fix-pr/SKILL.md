---
name: fix-pr
description: >
  fix-pr to handle PR feedback and blocking CI in one pass; invokes gh and commit.
---

# Fix PR

## Options and dependencies

Default: current branch PR, push/replies on. PR number/URL selects it;
"do not push"/"keep local" disables push; "do not reply" disables replies.
Missing named values block. Before any GitHub I/O, verify and read
`../gh/SKILL.md`; before committing, verify and read `../commit/SKILL.md`.
Missing dependencies block with paths, not improvised replacements.

## 1. Synchronize

Resolve repo, PR URL/number/base/head/remote SHA. Closed/missing PR, auth
failure, dirty tree, or unsafe checkout blocks. Fetch, check out head, and
fast-forward to remote SHA; never reset/force.
Record `PR/SHA | push/replies | hunt counts/pages | finding/verdict/evidence | commit/push | native targets | terminal`.
Done when local HEAD equals remote PR head and identity is fixed.

## 2. Hunt once

Through gh, collect unresolved threads including outdated, every nested page,
REST review-comment chains, actionable review bodies, conversation comments,
and terminal non-success required/blocking head-SHA checks plus annotations.
Use pr-threads --json --open --complete and ci-failures with PR/SHA.
Apply every completeness/reconciliation rule in `references/hunt.md`;
script exit alone proves neither REST roots nor required checks.
No triage/edit before all six surfaces are complete. Normalize/deduplicate
claims without losing native reply targets. Done when every page completes
and each finding is recorded.
Run this hunt once, not after edits/commit/push/reply. Later feedback or CI
needs a new invocation; retrying one failed reply is not another hunt.

## 3. Triage and fix

Trace every claim in surrounding source; reproduce where possible.
Assign fix/reject/clarify/already-fixed with evidence, including skip reasons.
No edits before all verdicts. Apply only fixes in focused clusters and run
their narrowest checks; required failures block. Done when every finding
has a verdict and every fix a verified diff, or no fix was needed.

## 4. Commit and push

For a diff, discard earlier message drafts and invoke commit with unstaged
scope. Commit owns all clean-room rules, including the conversation-only
test and trailer hygiene in `../commit/REFERENCE.md`; repeat no alternative
message policy here. Skip commit on clean tree.
Push when enabled, verify remote SHA, never force; movement/rejection blocks.
Push off leaves fixed findings AWAITING_PUSH. Recheck %B before push for
rejected framing/unrequested trailers. Done when no diff exists or the
verified commit is pushed; a local-only fix is not pushed success.

## 5. Reply and report

With replies on, apply `references/replies.md` then
`references/unslop-reply-drafts.md`. Consolidate shared parents, preserve bot
prefixes, and post only through gh's reply script. Skip satisfied targets.
For failure refetch only that target and retry once; another failure blocks.
Fixed replies require a pushed SHA. Do not resolve unless explicitly asked
and supported by a separately authorized operation.
Report finding/verdict/action/evidence, URL, commit/push, hunt counts, and
unreplied targets. Done when all authorized replies match their verdicts.

Terminals: SUCCESS, NO_CODE_CHANGE, AWAITING_PUSH, BLOCKED. Never SUCCESS
with unreplied required targets. Resume restarts Synchronize; no merge-conflict fixes.
