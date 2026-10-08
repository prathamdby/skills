---
name: gh
description: >
  gh for PR state, discussions, CI diagnosis, replies, and nontrivial GitHub commands; fix-pr invokes it.
---

# GitHub I/O

Contracts follow AVGVSTVS96/better-github-skill (unlicensed; reimplemented).
Resolve `<anchor>` as this skill's absolute directory. The existing
`<anchor>/scripts/run` selects bun, nub, tsx, then Node/nvm with strip-types.

## Options

Default: current branch PR, cwd repo, truncated text. A PR number/URL selects
that PR; a named repo emits -R and needs a PR for PR-bound work.
JSON/full bodies selects --json/--full. Open threads includes unresolved
outdated threads; all includes resolved too; both conflict. Complete paging
adds --complete; author/since supply their filters.
CI selects ci-failures; list runs uses --list (default limit 10), workflow
filters it; a run id analyzes that run. Known head SHA adds --sha.
Reply needs exactly one target/body from `references/reply.md`.
Missing needed values or conflicting choices are BLOCKED.

## 1. Resolve and choose

Confirm authenticated gh; missing binary/auth blocks. Record
`repo | PR/run/SHA | surface | argv | terminal`.
No current PR for PR-bound work → NO_CHANGES.
Choose the covering script:

| Surface | Script | JSON contract |
|---|---|---|
| PR state/checks/files/counts | pr-snapshot.ts | `references/snapshot.md` |
| Review bodies/comments/threads | pr-threads.ts | `references/threads.md` |
| CI runs/jobs/log snippets | ci-failures.ts | `references/ci.md` |
| One native thread/conversation reply | pr-reply.ts | `references/reply.md` |

Snapshot is state, threads is feedback; neither replaces the other.
Before parsing JSON, load only that surface's contract.
Done when target and script or uncovered raw operation are fixed.

## 2. Run

Invoke only through `<anchor>/scripts/run <script.ts> ...`, not node directly.
Node version or ERR_UNKNOWN_FILE_EXTENSION is not failure evidence or a
GraphQL license: use run. Its exit 2 is BLOCKED with tried-runtime list.
Script success reports data/posts; red CI/open threads are not runtime failure.
For all unresolved feedback use --json --open --complete; SHA-pin known heads.
Replies use pr-reply only. No resolving, pushing, or merging by this leaf.

Raw gh is permitted only for uncovered operations, after applying
`references/raw-gh.md`. A covering-script failure never authorizes reimplementing
its GraphQL. Redirect large output, never pipe gh to head.
For HTTP tracing or logs apply `references/logs.md`.
Done when output is complete, a reply URL exists, or a real error is captured.

## 3. Report

Summarize observed output. Set cap markers mean incomplete data, not success
for an exhaustive consumer. Cite log paths instead of pasting logs.
Green CI, zero threads, or posted reply is SUCCESS; a valid red report is
also successful inspection, not repaired CI.
Terminals: SUCCESS, NO_CHANGES (empty/no PR), BLOCKED.
