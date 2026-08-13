---
name: gh
description: >
  gh when inspecting a PR, reading review threads, diagnosing red CI, or composing
  non-trivial gh commands. fix-pr hunt invokes the scripts for surfaces 1–2 and CI
  snippets.
---

# GitHub orientation

CLI contracts follow AVGVSTVS96/better-github-skill (no upstream license;
reimplemented). Requires authenticated `gh` and Node ≥ 23.6.

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

1. Scripts for the three inspect loops; raw `gh` for everything else. Before
   any raw `gh` command, apply the gotchas in `./REFERENCE.md`.
2. Snapshot is PR state; threads is what reviewers wrote. Neither replaces the
   other.
3. Scripts exit 0 when the report succeeds. Red CI and open threads are not
   script failures. Never `gh | head`. EPIPE is not failure.
4. Never reply, resolve, push, or merge.

## Scripts

Resolve `<anchor>` as the directory containing this `SKILL.md`. Run with `node`.
Load JSON shapes in `./REFERENCE.md` before parsing `--json`.

| Script | Covers |
|---|---|
| `<anchor>/scripts/pr-snapshot.ts [pr] [--pr n] [-R owner/repo] [--full] [--json]` | Meta, mergeability, checks, files, reviews, comments, thread counts |
| `<anchor>/scripts/pr-threads.ts [pr] [--pr n] [-R owner/repo] [--all\|--open] [--author] [--since] [--full] [--json] [--complete]` | Review bodies, issue comments, inline threads with resolution |
| `<anchor>/scripts/ci-failures.ts [run-id] [--pr N] [--sha SHA] [--list [-L n] [--workflow W]] [--full] [-R owner/repo] [--json]` | Failing checks → jobs/steps → snippet; logs on disk |

## 1. Resolve the target

Confirm `gh` is authenticated and Node is ≥ 23.6. Record owner/repo, PR or run
id, SHA if known, and which surface. No PR for a PR-bound request is
`NO_CHANGES`. Auth failure or missing `gh` is `BLOCKED`.

Record: `target | surface | command | terminal`.

Done when the target is identified or a terminal is set.

## 2. Inspect

Pick one covering script. Pass `--sha` when the head SHA is known. Pass
`--json --open --complete` when the consumer needs every unresolved thread.
If no script covers the request, use raw `gh` after applying gotchas in
`./REFERENCE.md`. Redirect large output to a file; never pipe to `head`.

Done when stdout is a complete report or stderr names a real failure.

## 3. Report

Summarize from the script output. Cite printed log paths; do not paste full
CI logs. A set cap marker in `--json` means that list is incomplete. Green CI
or zero threads is `SUCCESS`.

Terminal values are `SUCCESS`, `NO_CHANGES` (empty or no PR), and `BLOCKED`.
