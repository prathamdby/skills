---
name: box
description: >
  box a git repo, clone it locally and search the real source, with a tracked
  manifest. Delegates repo work to subagents when available, runs in the main
  thread otherwise. Triggers: a VCS URL (GitHub, GitLab, Bitbucket), a
  previously cloned repo name, or a request to clone/search/explore a repo.
  Flags: --persist, --update, --list, --no-subagents.
---

# Box

## Flags

| Flag             | Effect                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| `--persist`      | After searching, save a repo reference in the working dir `AGENTS.md`. |
| `--update`       | Force `git pull` even if the repo exists locally.                      |
| `--list`         | Skip all work; list cloned repos and exit.                             |
| `--no-subagents` | Run the full workflow in the main thread; never dispatch subagents.    |

No flags → clone if missing, search, report. Never write `AGENTS.md` without `--persist`.

## Execution mode

The mode is a **branch**. Pick it before Step 2. Full selection rules, role
definitions, stage barriers, and stage contracts are in `./REFERENCE.md`; read
the section for the mode you pick before running its stages.

- **Direct mode**, main thread runs prepare, search, and (if `--persist`)
  persist itself. Triggered by `--no-subagents`, the user declining delegation,
  or no subagent/Task tool. Execute immediately; never refuse for lack of subagents.
- **Delegated mode** (default when a subagent tool exists and the user did not
  opt out), main thread coordinates only and dispatches a subagent per stage.

## Sandbox location

All repos live in the skill's own directory, the **anchor** (the directory
holding this `SKILL.md`). Include the anchor in every subagent brief.

- Sandbox root: `./sandbox/`
- Manifest: `./sandbox/manifest.json`
- Cloned repos: `./sandbox/{slug}/`

## `--list` or bare invocation

Read `./sandbox/manifest.json` and list cloned repos (or "No repos cloned yet."),
then stop. Main thread handles this directly. No prepare/search/persist. See the
startup template in `./REFERENCE.md`.

## Step 1: Detect the target

- **URL present:** use it; derive the slug from the repo name.
- **Name mentioned:** read `./sandbox/manifest.json` for a matching slug. If
  absent, stop and ask.

## Step 2: Prepare the repo

Delegated: dispatch one prepare subagent (anchor, slug, url, `--update`); wait.
Direct: run the Prepare contract from `./REFERENCE.md`. On error, stop and report.

## Step 3: Search the repo

Delegated: dispatch one or more read-only search subagents with non-overlapping
scopes; wait for all. Direct: search the local repo per the Search contract. Cite
`path:line`.

## Step 4: Aggregate

Merge findings into one answer, dedupe citations. If nothing matched, say so.

## Step 5: Persist (only if `--persist`)

Delegated: dispatch one persist subagent (anchor, slug, url, `local_path`, path
to the working dir `AGENTS.md`). Direct: run the Persist contract from
`./REFERENCE.md`. Skip when `--persist` is unset.

## Step 6: Report

In 2-4 sentences: repo, local path, prepare status, persist status, and a
high-level search summary.

## Constraints

- **Never `git push`**, modify remotes, or commit inside clones (unless the user
  asks outside this skill).
- **Never infer repo contents** from the URL alone.
- **Do not re-clone** existing repos unless `--update` is passed.
- **Stage barriers hold** in both modes: prepare before search, search before
  persist, exactly one writer for the clone/manifest and one for `AGENTS.md`.
- **Delegated mode:** the coordinator never clones, pulls, reads repo files,
  searches repo contents, or edits `AGENTS.md`, subagents do that work.
