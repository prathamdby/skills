---
name: make-pr
description: >
  make-pr when publishing committed branch changes as a new pull request or
  updating the existing pull request for that branch.
---

# Make PR

## Flags

| Flag | Default | Effect |
|---|---|---|
| `--target <branch>` | `main` | PR base and branch-diff target |
| `--ticket <id>` | off | Prefix title with `[<id>]` |
| `--conventional` | off | Use conventional title rules |

Missing flag values are `BLOCKED`. Never infer a ticket from branch names,
commits, issues, or conversation.

## 1. Preflight

Resolve current branch, target ref, working-tree status, upstream state, and an
open PR for the branch; ignore closed PRs and block if several are open. Resolve
the push remote from configured upstream, otherwise `origin`, and fetch it
before comparing. Block on detached HEAD, current branch equal to target,
missing target, fetch failure, behind or diverged upstream, any uncommitted or
untracked file, or an open PR whose base differs from target.

Record:
`branch/target | diff hash | remote state | open PR | title/body | mutation | terminal`.

Done when the branch is clean, the base is fixed, and create versus update is
known.

## 2. Lock diff and write copy

Read `git diff <target>...HEAD` only and hash it with
`git hash-object --stdin`. If empty, report `NO_CHANGES`. Draft as a stranger
who has only this diff and the explicit ticket ID.

- Default title: imperative sentence case, no type prefix, no trailing period,
  summary at most 60 characters.
- Conventional title: load only that section of
  `../commit/REFERENCE.md`, not its shared rejection section; keep its
  50-character subject limit.
- Ticket: prepend `[<id>] ` exactly as supplied; the prefix does not authorize
  ticket claims in the body and does not count toward the subject limit.
- Body: `## Summary` with one to five thematic bullets. Group related hunks,
  never commits. Include no test, rollout, motive, or ticket claim the diff
  cannot prove.

Map every title phrase and bullet to proving paths and hunks. Rewrite untraced
copy. Done when all copy passes its format and clean-room trace.

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
against the ledger. On a partial API result or mismatch, retry the PR mutation
once after read-back; then report `BLOCKED` with a field-level difference.
Auth, rate-limit, fetch, push, and platform errors are also `BLOCKED`.

Report create or update, push status, URL, and trace summary only after
read-back matches.

After interruption, re-run Preflight and verify remote and PR state before any
retry. Do not duplicate a PR or repeat a successful push.

Terminal values are `SUCCESS`, `NO_CHANGES`, and `BLOCKED`. Never commit, force
push, reopen a PR, run builds, or run tests.
