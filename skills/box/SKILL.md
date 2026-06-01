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

This skill is a **coordinator + subagent pipeline**. The main thread never
touches a repository directly — that work is delegated to subagents so repo
file contents never pollute the main thread's context.

### Roles

- **Coordinator** — the main thread. Detects the target and flags, dispatches
  subagents, aggregates their results, and produces the final report. The
  coordinator reads only the small sandbox manifest; it never reads repo
  files, never runs `git`, and never edits the working directory's `AGENTS.md`.
- **Prepare subagent** — exactly one. Owns the sandbox, the clone/pull, and the
  manifest. The only writer of `./sandbox/manifest.json`.
- **Search subagent(s)** — one or more, read-only. Each explores an assigned
  scope of the local repo and returns a summary plus `path:line` citations.
  Never writes to disk.
- **Persist subagent** — exactly one, dispatched only when `--persist` is set.
  The only writer of the working directory's `AGENTS.md`.

### Stage barriers

The pipeline runs in three gated stages. A stage does not start until the
previous stage has fully returned:

1. **Prepare** — the prepare subagent returns. The local clone is on disk and
   the manifest is current.
2. **Search** — coordinator fans out one or more read-only search subagents.
   All of them return their findings.
3. **Persist** — only if `--persist`, the persist subagent updates the working
   directory's `AGENTS.md` using the template.

These barriers guarantee there is exactly one writer for clone/manifest and
exactly one writer for `AGENTS.md`, while the read-only search stage fans out
freely.

### Enforcement

The main thread is a coordinator only. It MUST NOT clone, pull, read repo
files, search repo contents, or edit `AGENTS.md` directly. Dispatch a subagent
for every action that touches a repository or the sandbox. If you are about to
run `git` or open a file under `./sandbox/`, stop: that work belongs in a
subagent. Brief the subagent and let it return its results to you.

Subagent usage is mandatory. The only work permitted in the coordinator is
flag/target detection, subagent dispatch, aggregation, and reporting.

### Subagent briefing contracts

Subagents do not inherit the coordinator's context. Every brief must include,
explicitly:

- The sandbox **anchor path** (the directory containing this `SKILL.md`).
- The target **slug**.
- The target **url**.
- The standing constraints (no push, no commits in clones, no inferring from
  URL, no re-clone without `--update`).

**Prepare subagent (exactly one).**

- IN: anchor, slug, url, `--update` value, "no re-clone without `--update`".
- DOES: `mkdir -p ./sandbox`; create `manifest.json` as `[]` if absent; if
  missing, `git clone --depth 1 <url> ./sandbox/<slug>`; if present and
  `--update` was passed, `cd ./sandbox/<slug> && git pull`; otherwise skip git
  operations; upsert the manifest entry `{slug, url, local_path, cloned_at}`
  and write the manifest back.
- OUT: `local_path`, resolved slug/url, and status
  (`cloned | updated | reused | error:<reason>`).
- On `error:*`, the coordinator stops and reports; do not dispatch searches
  against a nonexistent path.
- **Slug collisions:** if a manifest entry already exists for `slug` with a
  **different** `url`, do not overwrite. Use an owner-qualified slug
  (`{owner}-{repo}`) and return the resolved slug. If a collision still
  resolves ambiguously, stop and ask the user.

**Search subagent (one or more, read-only).**

- IN: anchor, slug, confirmed `local_path`, the user's question, and — when
  the coordinator fans out — this subagent's **assigned scope** (a subtree,
  file set, or sub-question). The assigned scopes for parallel subagents MUST
  NOT overlap.
- DOES: search/read/summarize the local repo within the assigned scope. Use
  the local files, not the remote URL. Include code snippets with full
  context (imports, function signatures, file paths). Cite file paths and
  line numbers. If the user's prompt is open-ended, explore the repo
  structure, README, and main source files before answering.
- **Hard rule: write nothing.** No edits to the sandbox, the manifest, the
  clone, or `AGENTS.md`.
- OUT: a summary, the relevant snippets, and `path:line` citations within
  scope. If nothing matches, return an explicit `no matches in <scope>`.

**Persist subagent (exactly one, only if `--persist`).**

- IN: anchor (to find the template), slug, url, `local_path`, the path to the
  working directory's `AGENTS.md` (the coordinator's current working
  directory).
- DOES: read `./references/agents-md-template.md` from the skill directory;
  substitute `{slug}`, `{url}`, and `{local_path}`; if `AGENTS.md` exists,
  find `<!-- box:begin {slug} -->` and replace everything up to
  `<!-- box:end {slug} -->` with the new block; if the marker is absent,
  append the block under an `## External References` section (creating it if
  needed); if `AGENTS.md` does not exist, create it with the
  `## External References` section followed by the substituted block.
- OUT: status (`created | updated-block | appended`) and the path written.

## Flag detection

After activation, inspect the user's message for the following flags:

| Flag        | Effect                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `--persist` | After searching, dispatch a persist subagent to update the **working directory's** `AGENTS.md` with a repo reference. |
| `--update`  | Force `git pull` on the repo even if it already exists locally.                                                       |
| `--list`    | Skip all other work. List previously cloned repos and exit.                                                           |

**Defaults:** If no flags are provided, dispatch a prepare subagent (clone if
missing, update if needed), then dispatch search subagent(s), then report. Do
not write to `AGENTS.md` unless `--persist` is passed.

## Sandbox location

All repos live inside the skill's own directory, next to `SKILL.md`:

- Sandbox root: `./sandbox/`
- Manifest: `./sandbox/manifest.json`
- Cloned repos: `./sandbox/{slug}/`

The coordinator treats the directory containing `SKILL.md` as the anchor. This
anchor path is the first item in every subagent brief so the prepare, search,
and persist subagents resolve the same paths.

## Startup case: bare invocation or `--list`

If the user invokes `/box` with no URL, no repo name, or passes `--list`, the
coordinator handles this directly — no subagent dispatch:

1. Read `./sandbox/manifest.json`. If it does not exist or is empty, report:
   "No repos cloned yet."
2. Print a concise list:

```markdown
# Box

_local repo search & context_

Previously cloned:

- abc (github.com/john-doe/abc)
- xyz (gitlab.com/acme/xyz)

Give me a repo URL or name to search, or pass --persist to save a reference.
```

Then stop. This stays in the coordinator because it is a trivial manifest
read with no repo content and no shared-state write — the dispatch overhead
would exceed the work, and the delegation rule targets repo work specifically.

## Step 1: Detect the target (coordinator)

Extract the target from the user's message:

- **If a URL is present:** Use the URL. Derive the slug from the repo name in
  the path.
  - Example: `https://github.com/john-doe/abc.git` or
    `https://github.com/john-doe/abc` → slug `abc`.
  - Example: `git@gitlab.com:acme/xyz.git` → slug `xyz`.
- **If no URL but a name is mentioned:** Read `./sandbox/manifest.json` and
  check for a matching slug.
  - If found, use that entry's recorded URL and local path.
  - If not found, stop and ask: "I don't know that repo. Pass a URL to clone
    it first."
- **If neither URL nor known name:** Fall back to the startup case above.

The coordinator performs only this read; it does not run `git` or open the
cloned repo.

## Step 2: Prepare the repo (single prepare subagent)

Dispatch **exactly one** prepare subagent with the brief from the
[Subagent briefing contracts](#subagent-briefing-contracts) section. Pass:

- anchor path,
- slug,
- url,
- `--update` value (true/false).

The prepare subagent owns `mkdir -p ./sandbox`, manifest initialization,
`git clone --depth 1`, `git pull` (only when `--update` is set), and writing
the manifest entry. Wait for the subagent to return before continuing.

If the subagent returns `error:<reason>`, the coordinator stops and reports
the error. No search subagents are dispatched.

## Step 3: Search the repo (fan-out of read-only subagents)

The coordinator now dispatches one or more **read-only** search subagents
over the local repo at the `local_path` returned by the prepare stage.

- **Single question, small repo:** dispatch one search subagent with the
  full repo as its scope.
- **Multi-part question or large repo:** split the question or the repo
  into non-overlapping scopes (subtrees, file sets, or sub-questions) and
  dispatch one search subagent per scope in parallel.
- **Hard rule:** every search subagent is read-only. It MUST NOT write to
  the sandbox, the manifest, the clone, or `AGENTS.md`.

Each subagent's brief includes: anchor, slug, `local_path`, the user's
question, and (when fanning out) the assigned scope. Each subagent returns a
summary plus `path:line` citations, or an explicit "no matches in `<scope>`".

Wait for every search subagent to return before continuing to aggregation.

## Step 4: Aggregate (coordinator)

The coordinator merges the search subagent results:

- Combine summaries into a single answer.
- Dedupe citations. The same `path:line` may appear from multiple subagents
  on overlapping coverage; keep each citation once.
- If **every** search subagent returned `no matches in <scope>`, do not
  fabricate. The coordinator reports honestly that nothing matched.

## Step 5: Persist to AGENTS.md (single persist subagent, if `--persist`)

If `--persist` was passed, dispatch **exactly one** persist subagent with the
brief from the [Subagent briefing contracts](#subagent-briefing-contracts)
section. Pass: anchor, slug, url, `local_path`, and the path to the working
directory's `AGENTS.md`.

The persist subagent reads `./references/agents-md-template.md`, substitutes
the values, and performs the marker-based upsert. The coordinator does not
read or write `AGENTS.md` itself.

If `--persist` was not passed, skip this step entirely.

## Step 6: Report (coordinator)

Summarize the outcome in 2-4 sentences. Report:

- The repo involved (slug and URL).
- Where it lives locally (`./sandbox/{slug}/`).
- The prepare subagent's status (`cloned | updated | reused | error:…`).
- Whether the persist subagent ran and what it wrote
  (`created | updated-block | appended | skipped`).
- A high-level summary of what the search subagent(s) found.

Example report:

```
Cloned abc from github.com/john-doe/abc into ./sandbox/abc.
Searched: auth lives in src/auth.ts (JWT handling) and src/middleware.ts.
Persisted the repo reference to ./AGENTS.md.
```

## Constraints

- **Never run `git push`** or modify remotes.
- **Never commit** changes inside the cloned repos unless the user explicitly
  asks outside this skill.
- **Never infer a repo's contents** from the URL alone. Always have the search
  subagents read the local files.
- **Do not re-clone** existing repos unless `--update` is passed.
- **Coordinator MUST NOT** clone, pull, read repo files, search repo contents,
  or edit `AGENTS.md` directly. All repo and `AGENTS.md` work is delegated to
  subagents.
- **Exactly one writer** for `./sandbox/manifest.json` and the clone: the
  prepare subagent. No other subagent may write to the sandbox.
- **Exactly one writer** for the working directory's `AGENTS.md`: the persist
  subagent. No other subagent may write to `AGENTS.md`.
- **Search subagents are read-only.** They MUST NOT write to the sandbox, the
  manifest, the clone, or `AGENTS.md`.
- **Stage barriers hold.** The prepare subagent returns before any search
  subagent is dispatched. All search subagents return before the persist
  subagent is dispatched.
- **Every subagent brief** includes the anchor path, slug, and url explicitly.
  Subagents do not inherit the coordinator's context.
