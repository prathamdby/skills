---
name: fix-pr
description: >
  fix PR review feedback: recursively hunt all open review threads, nested
  replies, REST review-comment chains, conversation comments, and review
  bodies; triage each finding skeptically; fix what holds; reply; commit and
  push. Triggers: /fix-pr, address PR reviews. Reached by prath-mode after
  make-pr. Flags: --pr <n|url>, --no-push, --no-reply.
---

# Fix PR

## Flags

| Flag            | Effect                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| `--pr <n\|url>` | Target PR. **Default:** `gh pr view` on current branch; stop and ask if none. |
| `--no-push`     | Commit locally; skip push. Off by default.                                    |
| `--no-reply`    | Fix code; skip GitHub replies. Off by default.                                |

## Step 1: Resolve PR

`--pr` if passed; else `gh pr view --json number,headRefName,url,headRepository`.

Record owner, repo, number, head branch, URL. If `gh` errors or no PR exists,
stop and ask.

**Done when:** owner, repo, number, head branch, and URL are known.

## Step 2: Hunt all open feedback

Exhaustively collect every open finding. Run the full hunt contracts in
`./REFERENCE.md` (thread pages, nested comment pages, REST review-comment
cross-check, review bodies, issue comments). Substitute owner, repo, and
number from Step 1. Do **not** triage, edit, or "start with the obvious ones"
until the hunt checklist in `./REFERENCE.md` passes.

Skip empty bodies, pure acknowledgments, and duplicates. Record each item with
source (`thread` | `review` | `comment`), path/line if any, author, body, and
reply target id.

**Done when:** Hunt checklist passes; every open finding is listed with source,
author, body, and reply target.

## Step 3: Checkout PR branch

`gh pr checkout <number>` or confirm the working tree is on `headRefName`.

**Done when:** Working tree is on the PR head branch.

## Step 4: Triage skeptically

For **every** item from Step 2. No file edits until this step completes.

1. Read the cited file with surrounding context.
2. Trace the code path the reviewer claims is wrong.
3. Reproduce if possible (targeted test, call trace, type check).
4. Assign verdict: `fix` | `reject` | `clarify`.
5. Record one-line evidence.

**Done when:** Every item has verdict and evidence; no edits before this holds.

## Step 5: Implement

Apply only `fix` verdicts. Focused diffs; no drive-by refactors.

**Done when:** Every `fix` item has a local change, or there were zero `fix`
verdicts.

## Step 6: Commit

Read `../commit/SKILL.md` in full. Commit per that skill (clean-room message).

**Done when:** Changes are committed, or there is nothing to commit.

## Step 7: Push, re-hunt, reply

Unless `--no-push`: `git push`.

Unless `--no-reply`: re-run the hunt contracts in `./REFERENCE.md` and triage
any newly found open items (Steps 4–6 as needed); then reply to **every**
triaged item on its native surface. Draft per **Reply shapes** in
`./REFERENCE.md`; unslop each draft per `./references/unslop-reply-drafts.md`;
post per **Post replies by surface** in `./REFERENCE.md`. Consolidate items
that share one conversation-comment reply target into a single reply. For
`fix` verdicts, push before replying and reference the commit SHA. When author
is `semgrep-code-scan`, use **Semgrep dismissal replies** in `./REFERENCE.md`.

**Done when:** Push succeeded (or `--no-push`); hunt re-run found no untriaged
open items; every item has a posted reply (or `--no-reply`); every posted reply
is unslopped.

## Step 8: Report

Table: `source | item | verdict | action`. Include PR URL and commit SHA if any.

**Done when:** What was fixed, rejected, or discussed is visible at a glance.

Does not handle CI, merge conflicts, or stack restacking (`pr-babysit`); never invoke `make-pr`.
