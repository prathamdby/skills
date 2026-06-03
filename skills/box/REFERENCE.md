# Box Skill Reference

## Roles

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

## Stage barriers

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

## Enforcement

The main thread is a coordinator only. It MUST NOT clone, pull, read repo
files, search repo contents, or edit `AGENTS.md` directly. Dispatch a subagent
for every action that touches a repository or the sandbox. If you are about to
run `git` or open a file under `./sandbox/`, stop: that work belongs in a
subagent. Brief the subagent and let it return its results to you.

Subagent usage is mandatory. The only work permitted in the coordinator is
flag/target detection, subagent dispatch, aggregation, and reporting.

## Subagent briefing contracts

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
