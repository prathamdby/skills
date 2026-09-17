---
name: make-pr
description: >
  make-pr when publishing committed branch changes as a new pull request or
  updating the existing pull request for that branch.
---

# Make PR

## Options

Derive base, ticket, and title style from the request. Unspecified: target
`main`, no ticket, default title.
"target develop" / "base release-1" → that branch.
"ticket PROJ-123" / "prefix [PROJ-123]" → prepend `[PROJ-123] ` exactly as
supplied. Never infer a ticket from branch names, commits, issues, or
conversation.
"conventional title" → conventional title rules.
A named target or ticket without a usable value is `BLOCKED`.

## 1. Preflight

Resolve current branch, target ref, working-tree status, upstream state, and an
open PR for the branch; ignore closed PRs and block if several are open. Resolve
the push remote from configured upstream, otherwise `origin`, and fetch it
before comparing. Block on detached HEAD, current branch equal to target,
missing target, fetch failure, behind or diverged upstream, any uncommitted or
untracked file, or an open PR whose base differs from target.

Record:
`branch/target | diff hash | remote state | open PR | title/body/depth | mutation | terminal`.

Done when the branch is clean, the base is fixed, and create versus update is
known.

## 2. Lock diff and write copy

Read `git diff <target>...HEAD` only and hash it with
`git hash-object --stdin`. If empty, report `NO_CHANGES`. Draft as a stranger
who has only this diff and the explicit ticket ID.

- Default title: imperative sentence case, no type prefix, no trailing period,
  summary at most 60 characters.
- Conventional title: load its section and shared rejection check from
  `../commit/REFERENCE.md`; keep the 50-character subject limit. Only an
  explicit ticket prefix is exempt from the ticket-ID rejection.
- Ticket: prepend `[<id>] ` exactly as supplied; the prefix does not authorize
  ticket claims in the body and does not count toward the subject limit.
- Body: draft per Body structure, Change outline, and Body style in
  `./REFERENCE.md`. Cluster related hunks into themes, never commits. Emit
  Why (one proved sentence), Special (proved hazards or `- None.`), then
  Change outline with the smallest useful views. Optional link header only
  for user-pasted URLs. Include no test, rollout, unproved motive, unproved
  ticket claim, or harness footer.

Map every title phrase, body line, caption, and visual label to proving paths
and hunks. Rewrite untraced copy. Done when format, depth, Body style, Change
outline, and clean-room trace pass.

## 3. Publish

Recheck status and diff hash. If either changed, return to Step 1. Publish the
committed branch to the resolved remote with a normal upstream push when
missing or ahead. Never force push. After fetch, local HEAD and upstream must
match before PR mutation. Block on ambiguity or push failure.

Create a PR when none exists. Otherwise update the existing title and body
while changing no other field; preserve draft state, reviewers, labels,
assignees, linked issues, and projects. Use target and current branch
explicitly. Record mutation as `none`, `pushed`, `pr-created`, or `pr-updated`
after each successful action.

Done when the platform returns a PR URL or a captured mutation error.

## 4. Verify and report

Read the PR back. Verify URL, base, head, title, body, and preserved draft state
against the ledger. On a partial API result or non-body field mismatch, retry
the PR mutation once after read-back; then report `BLOCKED` with a field-level
difference. Auth, rate-limit, fetch, push, and platform errors are also
`BLOCKED`.

Confirm the ledger body has `## Why the change`, `## Special things to note`,
and `## Change outline`; Why is one sentence; Special is 1-3 bullets or
`- None.`; and it has no `## Summary`, `## Details`, or `## Breaking`. Any
skeleton mismatch is `BLOCKED` with a field-level difference.

Then apply Body hygiene in `./REFERENCE.md`: the body must equal the ledger
body (single trailing newline only). If harness footers or other text were
appended, update the body once to the exact ledger body, re-read, and report
whether a strip ran. Still dirty is `BLOCKED`.

Report create or update, push status, URL, body strip status, chosen depth, and
trace summary only after read-back matches.

After interruption, re-run Preflight and verify remote and PR state before any
retry. Do not duplicate a PR or repeat a successful push.

Terminal values are `SUCCESS`, `NO_CHANGES`, and `BLOCKED`. Never commit, force
push, reopen a PR, run builds, or run tests.
