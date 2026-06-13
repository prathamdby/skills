---
name: box
description: >
  Clone, update, and search git repositories locally. Delegates repo work to
  subagents when available; runs the full workflow in the main thread when
  subagents are unavailable or the user passes --no-subagents. Use when the user
  passes a VCS URL (GitHub, GitLab, Bitbucket, etc.) or mentions a previously
  cloned repo name. Supports --persist, --update, --list, and --no-subagents.
---

# Box

## When to use this skill

Activate when:

1. The user passes a VCS URL (`github.com`, `gitlab.com`, `bitbucket.org`, `.git`, `git@...`).
2. The user mentions a repo name that exists in the local manifest.
3. The user explicitly asks to clone, search, or explore a git repo.

## Step 0: Read REFERENCE.md (mandatory)

**Do not proceed to Step 1 or any later step until you have read `REFERENCE.md` in full.**

1. Use the Read tool on `./REFERENCE.md` in this skill's directory (same folder as this file).
2. Treat every role, barrier, template, and constraint in that file as binding for this session.
3. If you have not read it yet, stop and read it now. Skipping this step causes missed contracts and wrong output.

## Execution mode

Pick a mode before Step 2. See REFERENCE.md for selection rules and stage contracts.

- **Direct mode** — main thread runs prepare, search, and (if `--persist`) persist. Triggers: `--no-subagents`, user says not to delegate, or no subagent/Task tool. Execute immediately; do not refuse.
- **Delegated mode** (default when subagent tool exists and user did not opt out) — coordinate only; dispatch subagents per REFERENCE.md.

## Flag detection

| Flag             | Effect                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `--persist`      | After searching, save a repo reference in the **working directory's** `AGENTS.md`.                 |
| `--update`       | Force `git pull` on the repo even if it already exists locally.                                    |
| `--list`         | Skip all other work. List previously cloned repos and exit.                                        |
| `--no-subagents` | Run the full workflow in the main thread. Never dispatch subagents.                                |

**Defaults:** If no flags are provided, prepare (clone if missing), search, then report. Do not write to `AGENTS.md` unless `--persist` is passed.

## Sandbox location

All repos live inside the skill's own directory:

- Sandbox root: `./sandbox/`
- Manifest: `./sandbox/manifest.json`
- Cloned repos: `./sandbox/{slug}/`

The skill directory (containing this `SKILL.md`) is the **anchor**. Include it in every subagent brief.

## Step 1: Detect the target

Extract the target from the user's message:

- **URL present:** Use the URL. Derive slug from repo name.
- **Name mentioned:** Read `./sandbox/manifest.json` for matching slug. If not found, stop and ask.
- **Neither:** Fall back to startup case. See REFERENCE.md.

## Step 2: Prepare the repo

**Delegated:** dispatch one prepare subagent (anchor, slug, url, `--update`); wait for return. **Direct:** run the Prepare contract from REFERENCE.md. On error, stop and report.

## Step 3: Search the repo

**Delegated:** Dispatch one or more read-only search subagents. Wait for all to return.
**Direct:** Search/read the local repo per the Search contract in REFERENCE.md.

## Step 4: Aggregate

Merge findings into a single answer. Dedupe citations. If nothing matched, report honestly.

## Step 5: Persist to AGENTS.md (if `--persist`)

**Delegated:** Dispatch one persist subagent with anchor, slug, url, `local_path`, and path to working directory's `AGENTS.md`.
**Direct:** Run the Persist contract from REFERENCE.md yourself.

Skip this step when `--persist` is not set.

## Step 6: Report

Summarize in 2-4 sentences: repo, local path, prepare status, persist status, and high-level search summary.

## Constraints

- **Never run `git push`** or modify remotes.
- **Never commit** inside cloned repos unless the user explicitly asks outside this skill.
- **Never infer repo contents** from the URL alone.
- **Do not re-clone** existing repos unless `--update` is passed.
- **Delegated mode:** coordinator MUST NOT clone, pull, read repo files, search repo contents, or edit `AGENTS.md` directly.
- **Direct mode:** main thread owns prepare, search, and persist per REFERENCE.md.
- **Stage barriers hold** in both modes: prepare before search; search before persist.
- **Never skip Step 0.** REFERENCE.md holds mode selection, roles, barriers, and stage contracts.
