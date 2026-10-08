---
name: make-pr
description: >
  make-pr to publish committed changes and create or update their pull request.
---

# Make PR

## Options

Default: base main, no ticket/issue, imperative sentence-case title, non-draft
creation. "Target <branch>" selects base; "draft PR" selects draft creation.
Updates preserve existing draft state unless the user explicitly requests
conversion. "Ticket <id>" / "prefix [<id>]" supplies only that exact prefix.
"Issue N" / "fixes #N" / "closes #N" authorizes one `Closes #N` per issue.
Issue URLs yield N only from `/issues/N`; pull URLs do not. Bare #N, missing
values, or conflicting options block. Infer no ticket/issue from other context.
"Conventional title" loads formatting and rejection rules in
`../commit/REFERENCE.md`; verify that dependency exists first.

## 1. Preflight

Resolve branch, target, status, upstream, and open PR. Use configured push
remote or origin; fetch before comparison. Block on detached HEAD, target
equal to current branch, missing target, fetch failure, behind/diverged
upstream, dirty/untracked files, several open PRs, or a different existing base.
Ignore closed PRs. Record
`branch/base | remote | diff hash | PR | draft | title/body/depth | mutation | terminal`.
Done when clean branch, fixed base, and create/update are known.

## 2. Draft from the locked diff

Read and hash only `git diff <target>...HEAD`; empty → `NO_CHANGES`.
Default title is imperative sentence case, at most 60 characters, no type or
period. Conventional keeps commit's 50-character limit. An explicit ticket
prefix is exempt from length and ticket rejection, not proof of ticket claims.

For a nonempty diff, apply body, depth, and style rules in `REFERENCE.md`.
Use `references/views.md` only for a theme needing a fenced view.
Trace every title phrase, body line, caption, and visual label to hunks;
only explicitly authorized Closes footers are exempt.
Done when format, depth, exact issue set, and clean-room trace pass.

## 3. Publish

Recheck status and diff hash; movement returns to Preflight. Push missing/ahead
upstream normally, never force; fetch and require upstream equals local HEAD.
Create with explicit base/head and requested draft state, or update copy
while preserving draft, reviewers, labels, assignees, and projects. Only an
explicit draft conversion authorizes changing that state.
Record each successful mutation; on interruption re-preflight instead of
repeating a successful push/create. Register the URL with the host's PR-link
tool when available, including existing PRs when work starts.
Done when a PR URL or captured mutation error exists.

## 4. Read back

Verify URL, base/head, title/body, draft, and preserved fields against the
ledger. A partial API result or non-body mismatch permits one mutation retry
after read-back, then `BLOCKED` with field differences. For an appended body
or footer, apply `references/body-hygiene.md`.
Confirm the three body headings, one-sentence Why, Special bounds, and exact
Closes set. Auth/rate-limit/fetch/push/platform errors block.
Report create/update, push, URL, depth, body strip, and trace only after match.
Done when remote state and ledger agree.

Terminals: `SUCCESS`, `NO_CHANGES`, `BLOCKED`. No commits, force pushes,
reopening closed PRs, builds, or tests in this leaf.
