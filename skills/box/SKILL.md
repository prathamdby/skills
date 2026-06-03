---
name: box
description: >
  Clone, update, and search git repositories locally by delegating all repo
  work to subagents. The main thread is a coordinator only. Use when the user
  passes a VCS URL (GitHub, GitLab, Bitbucket, etc.) or mentions a previously
  cloned repo name. Supports --persist to save a reference in the working
  directory's AGENTS.md, --update to force-pull, and --list to show cloned
  repos.
---

# Box

## When to use this skill

Activate when:

1. The user passes a VCS URL (`github.com`, `gitlab.com`, `bitbucket.org`, `.git`, `git@...`).
2. The user mentions a repo name that exists in the local manifest.
3. The user explicitly asks to clone, search, or explore a git repo.

## Execution model

This skill is a coordinator + subagent pipeline. The main thread never
touches a repository directly. See REFERENCE.md for roles, stage barriers, and
subagent briefing contracts.

## Flag detection

| Flag        | Effect                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `--persist` | After searching, dispatch a persist subagent to update the **working directory's** `AGENTS.md` with a repo reference. |
| `--update`  | Force `git pull` on the repo even if it already exists locally.                                                       |
| `--list`    | Skip all other work. List previously cloned repos and exit.                                                           |

**Defaults:** If no flags are provided, dispatch a prepare subagent (clone if missing), then search subagent(s), then report. Do not write to `AGENTS.md` unless `--persist` is passed.

## Sandbox location

All repos live inside the skill's own directory:

- Sandbox root: `./sandbox/`
- Manifest: `./sandbox/manifest.json`
- Cloned repos: `./sandbox/{slug}/`

The coordinator treats the directory containing `SKILL.md` as the anchor. This anchor path is the first item in every subagent brief.

## Step 1: Detect the target (coordinator)

Extract the target from the user's message:

- **URL present:** Use the URL. Derive slug from repo name.
- **Name mentioned:** Read `./sandbox/manifest.json` for matching slug. If not found, stop and ask.
- **Neither:** Fall back to startup case. See REFERENCE.md.

## Step 2: Prepare the repo (single prepare subagent)

Dispatch exactly one prepare subagent with anchor, slug, url, and `--update` value. Wait for return. On error, stop and report.

## Step 3: Search the repo (fan-out of read-only subagents)

Dispatch one or more read-only search subagents over the local repo. Each returns a summary plus `path:line` citations. Wait for all to return.

## Step 4: Aggregate (coordinator)

Merge search results into a single answer. Dedupe citations. If every subagent reported no matches, report honestly.

## Step 5: Persist to AGENTS.md (single persist subagent, if `--persist`)

If `--persist`, dispatch exactly one persist subagent with anchor, slug, url, `local_path`, and path to working directory's `AGENTS.md`. Skip otherwise.

## Step 6: Report (coordinator)

Summarize in 2-4 sentences: repo, local path, prepare status, persist status, and high-level search summary.

## Constraints

- **Never run `git push`** or modify remotes.
- **Never commit** inside cloned repos unless the user explicitly asks outside this skill.
- **Never infer repo contents** from the URL alone.
- **Do not re-clone** existing repos unless `--update` is passed.
- **Coordinator MUST NOT** clone, pull, read repo files, search repo contents, or edit `AGENTS.md` directly.
- **Exactly one writer** for `./sandbox/manifest.json` and the clone: the prepare subagent.
- **Exactly one writer** for the working directory's `AGENTS.md`: the persist subagent.
- **Search subagents are read-only.** They MUST NOT write to the sandbox, manifest, clone, or `AGENTS.md`.
- **Stage barriers hold.** Prepare returns before search. All search returns before persist.
- **Every subagent brief** includes anchor, slug, and url explicitly.
