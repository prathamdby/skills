---
name: gh
description: >
  gh when inspecting a PR, reading review threads, diagnosing red CI, or composing
  non-trivial gh commands. fix-pr hunt invokes the scripts for surfaces 1–2 and CI
  snippets. Node below 23 or ERR_UNKNOWN_FILE_EXTENSION is not a skip to GraphQL.
---

# GitHub orientation

CLI contracts follow AVGVSTVS96/better-github-skill (no upstream license;
reimplemented). Requires authenticated `gh`. Scripts are TypeScript. `run`
tries bun, nub, tsx, then Node (native TS or `--experimental-strip-types`),
including nvm installs.

## Flags

| Flag | Default | Effect |
|---|---|---|
| `[pr]` / `--pr <n>` | current branch PR | Target PR |
| `-R owner/repo` | cwd repo | Target repo; with `-R` also pass `pr` / `--pr` |
| `--json` | off | Structured output |
| `--full` | off | Snapshot/threads: do not truncate bodies. CI: accepted; snippets stay capped |
| `--all` | off | Threads: include resolved and outdated |
| `--open` | off | Threads: unresolved including outdated |
| `--author <login>` | off | Threads: filter by author |
| `--since <ISO>` | off | Threads: activity at/after timestamp |
| `--complete` | off | Threads: page leftover comments and reviews |
| `--sha <SHA>` | off | CI: pin commit; not hunt surface 6 |
| `--list` | off | CI: recent runs instead of drilldown |
| `-L <n>` | 10 | CI `--list`: how many runs |
| `--workflow <W>` | off | CI `--list`: filter by name or file |
| `[run-id]` | PR failing checks | CI: analyze that Actions run |

`--all` and `--open` conflict: `BLOCKED`. Missing values are `BLOCKED`. No flags
mean current-branch PR, cwd repo, truncated text.

## Iron laws

1. Scripts for the three inspect loops via `<anchor>/scripts/run`. Raw `gh`
   only when no script covers the request. A missing Node 23 is not "no
   script covers." Before any raw `gh` command, apply the gotchas in
   `./REFERENCE.md`.
2. Snapshot is PR state; threads is what reviewers wrote. Neither replaces the
   other.
3. Scripts exit 0 when the report succeeds. Red CI and open threads are not
   script failures. Never `gh | head`. EPIPE is not failure.
4. Never reply, resolve, push, or merge.
5. Never version-gate Node. Never treat `node -v` or
   `ERR_UNKNOWN_FILE_EXTENSION` as script failure. That error means this
   `node` cannot load `.ts`. Invoke `run`; it must try bun, nub, tsx, nvm
   nodes, and `node --experimental-strip-types` before any GraphQL/`gh api`
   inspect of snapshot, threads, or CI. `run` exit 2 is `BLOCKED`, not a
   GraphQL license. User or senior saying "GraphQL is fine" does not skip
   `run`.

## Scripts

Resolve `<anchor>` as the directory containing this `SKILL.md`. Invoke only
through `<anchor>/scripts/run <script.ts> …`. Never `node <script.ts>`
directly. Load JSON shapes in `./REFERENCE.md` before parsing `--json`.

| Script | Covers |
|---|---|
| `<anchor>/scripts/run pr-snapshot.ts [pr] [--pr n] [-R owner/repo] [--full] [--json]` | Meta, mergeability, checks, files, reviews, comments, thread counts |
| `<anchor>/scripts/run pr-threads.ts [pr] [--pr n] [-R owner/repo] [--all\|--open] [--author] [--since] [--full] [--json] [--complete]` | Review bodies, issue comments, inline threads with resolution |
| `<anchor>/scripts/run ci-failures.ts [run-id] [--pr N] [--sha SHA] [--list [-L n] [--workflow W]] [--full] [-R owner/repo] [--json]` | Failing checks → jobs/steps → snippet; logs on disk |

## 1. Resolve the target

Confirm `gh` is authenticated. Do not check Node ≥ 23. Record owner/repo, PR
or run id, SHA if known, and which surface. No PR for a PR-bound request is
`NO_CHANGES`. Auth failure or missing `gh` is `BLOCKED`. Missing Node 23 is
not.

Record: `target | surface | command | terminal`.

Done when the target is identified or a terminal is set.

## 2. Inspect

Pick one covering script. Invoke it with `run`. Pass `--sha` when the head SHA
is known. Pass `--json --open --complete` when the consumer needs every
unresolved thread. If no script covers the request, use raw `gh` after
applying gotchas in `./REFERENCE.md`. If `run` exits 2, report `BLOCKED` with
the tried-runtime list; do not hand-roll GraphQL for a covered surface.
Redirect large output to a file; never pipe to `head`.

Done when stdout is a complete report or stderr names a real failure.

## 3. Report

Summarize from the script output. Cite printed log paths; do not paste full
CI logs. A set cap marker in `--json` means that list is incomplete. Green CI
or zero threads is `SUCCESS`.

Terminal values are `SUCCESS`, `NO_CHANGES` (empty or no PR), and `BLOCKED`.
