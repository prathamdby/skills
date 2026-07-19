# Box reference

Load the contract for the stage being entered. Do not load later stages early.

## Prepare contract

Input: absolute anchor, slug, URL, update boolean.

1. Create `<anchor>/sandbox/` and initialize a missing manifest as `[]`.
2. If the slug belongs to another URL, try `<owner>-<repo>`; ask if still
   ambiguous.
3. Validate an existing clone with `git -C <path> rev-parse --git-dir` and
   `git -C <path> remote get-url origin`.
4. Reuse a valid clone without `--update`. With `--update`, run
   `git -C <path> pull --ff-only`.
5. If a manifest-free path is not a valid clone, move it to
   `<path>.partial-<timestamp>` before one clone retry.
6. Clone missing repos with `git clone --depth 1 <url> <absolute-path>`.
7. Only after validation, upsert
   `{slug, url, local_path, cloned_at}`. Write the manifest through a temporary
   sibling and rename it atomically.

Output: resolved slug, URL, absolute path, and exactly one status:
`cloned | updated | reused | blocked:<reason>`. A blocked result ends the run.

## Search contract

Input: absolute clone path, exact user question, and one assigned scope.

- Search local files only. Never infer from URL or remote snippets.
- Write nothing.
- A parallel scope must not overlap another worker's paths or sub-question.
- For an open-ended request, inspect README, manifests, top-level structure,
  and primary entry points.
- Return a short finding list with enough surrounding code to interpret it.
  Every finding cites `path:line`. Return `no matches in <scope>` when empty.

Output: assigned scope, searched paths, findings, citations, and omissions.

## Persist contract

Input: absolute anchor, slug, URL, local path, and absolute target `AGENTS.md`.

1. Read `<anchor>/references/agents-md-template.md`.
2. Substitute slug, URL, and local path.
3. Replace the block between `<!-- box:begin <slug> -->` and
   `<!-- box:end <slug> -->` when present.
4. Otherwise append it once under `## External references`, creating the file
   or heading when absent.
5. Re-read the file and verify exactly one complete marker block exists.

Output: target path and `created | updated | appended | blocked:<reason>`.

## Delegated briefs

Every delegated brief contains the absolute anchor, slug, URL, local path when
known, assigned stage, write boundary, input values, expected output fields,
and the rule that subagents may not delegate again.
