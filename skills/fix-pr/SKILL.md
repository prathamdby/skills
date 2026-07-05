---
name: fix-pr
description: >
  fix PR review feedback: fetch unresolved threads, triage each finding
  skeptically, fix what holds, reply on threads, commit and push. Triggers:
  /fix-pr, address PR reviews. Reached by prath-mode after make-pr. Flags:
  --pr <n|url>, --no-push, --no-reply.
---

# Fix PR

## Flags

| Flag | Effect |
| --- | --- |
| `--pr <n\|url>` | Target PR. **Default:** `gh pr view` on current branch; stop and ask if none. |
| `--no-push` | Commit locally; skip push. Off by default. |
| `--no-reply` | Fix code; skip GitHub thread replies. Off by default. |

## Step 1: Resolve PR

`--pr` if passed; else `gh pr view --json number,headRefName,url,headRepository`.

Record owner, repo, number, head branch, URL. If `gh` errors or no PR exists,
stop and ask.

**Done when:** owner, repo, number, head branch, and URL are known.

## Step 2: Fetch open feedback

Paginate all unresolved review threads using the GraphQL contract in
`./REFERENCE.md`. Substitute owner, repo, and number from Step 1.

If a changes-requested review has a body with actionable feedback not already
covered by inline threads, add those items using the REST pattern in
`./REFERENCE.md`.

**Done when:** Every unresolved thread and orphan review-body item is listed with
path, line, author, and body.

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

Read `../commit/SKILL.md` in full. Commit per that skill (diff-only message).

**Done when:** Changes are committed, or there is nothing to commit.

## Step 7: Push and reply

Unless `--no-push`: `git push`.

Unless `--no-reply`, reply to **every** triaged item:

1. Draft per verdict shape in `./REFERENCE.md`.
2. Apply the unslop process in `~/.agents/skills/unslop/SKILL.md` to each
   draft. Replies must be **concise** (fact or fix first, no preamble) and
   **humane** (teammate tone, not a bot closing a ticket).
3. Post using reply commands in `./REFERENCE.md`. For `fix` verdicts, push
   before replying; reference the commit SHA. Never post platitudes
   ("acknowledged", "will fix", "good point", "hope this helps").
4. When author is `semgrep-code-scan`, use dismissal patterns in
   `./REFERENCE.md`.

**Done when:** Push succeeded (or `--no-push`); every item has a posted reply
(or `--no-reply`); every reply is concise, humane, and unslopped.

## Step 8: Report

Table: `item | verdict | action`. Include PR URL and commit SHA if any.

**Done when:** What was fixed, rejected, or discussed is visible at a glance.

Does not handle CI, merge conflicts, or stack restacking (`pr-babysit`); never invoke `make-pr`.