# Box Skill Reference

## Execution modes

### Mode selection

Apply the first matching rule:

1. User passes `--no-subagents`, or explicitly says not to use subagents / to run in the main thread → **direct mode**. Do not debate or refuse.
2. No subagent or Task tool is available in this environment → **direct mode**.
3. Otherwise → **delegated mode** (default).

### Direct mode

The main thread runs the full pipeline. Follow the Prepare, Search, and Persist
contracts below directly. The main thread may read the manifest, run `git`,
search repo files, and edit the working directory's `AGENTS.md` when persisting.

Do not refuse box work because subagents are missing. Do not tell the user to
wait for delegation — execute the contracts yourself.

### Delegated mode

The main thread is a coordinator only. It reads only the small sandbox manifest
for target detection and `--list`; it never reads repo files, never runs `git`,
and never edits the working directory's `AGENTS.md`. Dispatch a subagent for
every prepare, search, and persist action.

Coordinator-only work: flag/target detection, mode selection, subagent dispatch,
aggregation, and reporting.

## Roles

- **Coordinator / main thread** — detects the target and flags, picks execution
  mode, runs or dispatches each stage, aggregates results, and reports.
- **Prepare** — owns the sandbox, the clone/pull, and the manifest. The only
  writer of `./sandbox/manifest.json`.
- **Search** — read-only. Explores the local repo and returns a summary plus
  `path:line` citations. Never writes to disk.
- **Persist** — only when `--persist` is set. The only writer of the working
  directory's `AGENTS.md`.

In **delegated mode**, Prepare, Search, and Persist are separate subagents.
In **direct mode**, the main thread performs all three roles itself.

## Stage barriers

The pipeline runs in three gated stages. A stage does not start until the
previous stage has fully returned:

1. **Prepare** — local clone is on disk and the manifest is current.
2. **Search** — all search work returns findings (one pass in direct mode; one
   or more subagents in delegated mode).
3. **Persist** — only if `--persist`, update the working directory's
   `AGENTS.md` using the template.

These barriers guarantee there is exactly one writer for clone/manifest and
exactly one writer for `AGENTS.md`.

## Stage contracts

Standing constraints for every stage: no push, no commits in clones, no
inferring from URL, no re-clone without `--update`.

**Prepare (exactly one).**

- IN: anchor, slug, url, `--update` value, "no re-clone without `--update`".
- DOES: `mkdir -p ./sandbox`; create `manifest.json` as `[]` if absent; if
  missing, `git clone --depth 1 <url> ./sandbox/<slug>`; if present and
  `--update` was passed, `cd ./sandbox/<slug> && git pull`; otherwise skip git
  operations; upsert the manifest entry `{slug, url, local_path, cloned_at}`
  and write the manifest back.
- OUT: `local_path`, resolved slug/url, and status
  (`cloned | updated | reused | error:<reason>`).
- On `error:*`, stop and report; do not search a nonexistent path.
- **Slug collisions:** if a manifest entry already exists for `slug` with a
  **different** `url`, do not overwrite. Use an owner-qualified slug
  (`{owner}-{repo}`) and return the resolved slug. If a collision still
  resolves ambiguously, stop and ask the user.

**Search (read-only).**

- IN: anchor, slug, confirmed `local_path`, the user's question, and — in
  delegated mode when fanning out — an **assigned scope** (subtree, file set, or
  sub-question). Parallel delegated scopes MUST NOT overlap.
- DOES: search/read/summarize the local repo within scope. Use the local
  files, not the remote URL. Include code snippets with full context (imports,
  function signatures, file paths). Cite file paths and line numbers. If the
  user's prompt is open-ended, explore the repo structure, README, and main
  source files before answering.
- **Hard rule: write nothing** during search. No edits to the sandbox, the
  manifest, the clone, or `AGENTS.md`.
- OUT: a summary, the relevant snippets, and `path:line` citations within
  scope. If nothing matches, return an explicit `no matches in <scope>`.

**Persist (exactly one, only if `--persist`).**

- IN: anchor (to find the template), slug, url, `local_path`, the path to the
  working directory's `AGENTS.md`.
- DOES: read `./references/agents-md-template.md` from the skill directory;
  substitute `{slug}`, `{url}`, and `{local_path}`; if `AGENTS.md` exists,
  find `<!-- box:begin {slug} -->` and replace everything up to
  `<!-- box:end {slug} -->` with the new block; if the marker is absent,
  append the block under an `## External References` section (creating it if
  needed); if `AGENTS.md` does not exist, create it with the
  `## External References` section followed by the substituted block.
- OUT: status (`created | updated-block | appended`) and the path written.

## Subagent briefing (delegated mode only)

Subagents do not inherit the coordinator's context. Every brief must include,
explicitly:

- The sandbox **anchor path** (the directory containing this `SKILL.md`).
- The target **slug**.
- The target **url**.
- The standing constraints above.

## Startup case: bare invocation or `--list`

If the user invokes `/box` with no URL, no repo name, or passes `--list`, the
main thread handles this directly — no prepare/search/persist:

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

Then stop. This stays in the main thread because it is a trivial manifest
read with no repo content and no shared-state write.
