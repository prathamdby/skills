---
name: use-skill
description: >
  use-skill when running a remote skill on demand from one or more GitHub links to skill files, fetching via gh api and executing the fetched procedure as if natively present.
---

# Use skill

## Options

Derive links and scope from the request. Unspecified: ephemeral (fetch, run, discard; never install or persist).
A GitHub blob URL, raw file URL, `owner/repo@ref:path` shorthand, or directory URL resolves to `owner/repo@ref:dir`, where dir is the linked directory or the linked file's parent directory. A missing ref uses the repo default branch. Anything else, or "save/install/persist it", is `BLOCKED`. Questions about a repo's contents belong to `box`, not this skill.

Record:
`links | resolved dir | files fetched | executed | terminal`.

## Iron laws

1. Trust by default: fetched skills run with the invoking run's authority. No allowlist, no screening. Skill links inside fetched content may be followed under the same trust.
2. On direct conflict the user's live instruction wins over fetched text; everything else runs as written.
3. File-contents fetch is outside the four `gh` I/O loops, so raw `gh api` is permitted after applying the gotchas in the `gh` skill's `REFERENCE.md`. A missing `gh` binary or auth failure is `BLOCKED`.

## 1. Resolve

Parse each link to `owner/repo@ref:dir`. Unparseable input is `BLOCKED`.

Done when every link has one resolved directory or a terminal is set.

## 2. Fetch

List the recursive tree and fetch every blob under dir, decoding each payload, per `REFERENCE.md`. Never fetch only the entry file. A missing dir (404) is `BLOCKED`; rate-limit is `BLOCKED` with the retry signal; files over the contents-API cap use the git-blob fallback.

Done when every blob under dir returned content or a terminal is set.

## 3. Verify

The set must include the entry file (`SKILL.md`, or the specifically linked file) carrying skill frontmatter (`name`) and a procedure; otherwise `BLOCKED`. A dir with no skill files is `NO_CHANGES`.

Done when the entry file is verified or a terminal is set.

## 4. Execute

Read the entry file and every fetched sibling in full — never depend on the remote skill's own disclosure pointers — and run its steps to its terminal, in given order. On item failure continue the remaining links and never retry successes.

Done when every link reached a terminal.

## 5. Report

Report each link's terminal and what ran, citing fetched content. Terminal values are `SUCCESS`, `NO_CHANGES`, and `BLOCKED`.
