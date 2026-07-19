# Pratham Dubey's skills

[![skills.sh](https://skills.sh/b/prathamdby/skills)](https://skills.sh/prathamdby/skills)

A small set of coding-agent workflows for planning, git work, code review,
delegation, and session continuity. Each skill has a narrow job, explicit stop
conditions, and defaults listed in its own file.

## Install

### skills.sh

```bash
npx skills@latest add prathamdby/skills
```

Pick the skills and agents you want in the installer.

### Claude Code

```text
/plugin marketplace add prathamdby/skills
/plugin install skills@pratham-skills
```

### Codex

```bash
codex plugin marketplace add prathamdby/skills
codex plugin add skills@pratham-skills
```

## Quickstart

- `/prath-mode` routes work to one skill or a delivery chain.
- `/peer-review` checks an implementation plan before work starts.
- `/deslop` removes needless complexity from a selected diff.
- `/commit` creates a clean-room commit from staged or tracked unstaged work.
- `/make-pr` pushes committed work and creates or updates its pull request.
- `/fix-pr` hunts, triages, fixes, and replies to pull-request feedback.
- `/explain-diff` writes a self-contained HTML walkthrough of a change.
- `/recon` maps the current repository and refreshes only changed areas later.
- `/box` clones and searches an external git repository locally.
- `/assign` runs one exact task through an external coding-agent CLI.
- `/handoff` saves resumable session state or continues from it.
- `/orchestrate` coordinates cheaper subagents while the main agent verifies.

## Why these skills exist

| Common failure | Skill | Contract |
|---|---|---|
| The agent picks the wrong workflow or repeats work owned by another skill. | [`prath-mode`](./skills/prath-mode/SKILL.md) | Routes each immediate action to one owner and tracks chain completion. |
| A plan misses a requirement or carries a risky assumption into implementation. | [`peer-review`](./skills/peer-review/SKILL.md) | Produces one critical risk, material gaps, a focused fix, and a fixed verdict. It edits only with explicit authority. |
| Generated code adds guards, wrappers, comments, or indirection that the codebase does not need. | [`deslop`](./skills/deslop/SKILL.md) | Classifies the selected diff against six categories, preserves staging intent, and verifies behavior-sensitive edits. |
| Commit messages leak ticket or review context and do not match the committed hunks. | [`commit`](./skills/commit/SKILL.md) | Locks the snapshot, traces every message line to a hunk, applies the selected hook policy, and verifies the commit. |
| PR creation misses local commits, duplicates an existing PR, or describes work absent from the diff. | [`make-pr`](./skills/make-pr/SKILL.md) | Blocks on a dirty or diverged branch, publishes committed work, reuses the open PR, and verifies its fields. |
| Review work starts from the first visible comment and misses later pages, nested replies, or invalid suggestions. | [`fix-pr`](./skills/fix-pr/SKILL.md) | Exhausts every feedback surface before editing, requires evidence for each verdict, and re-hunts until stable. |
| A large diff gets a shallow chat summary with no surrounding system context. | [`explain-diff`](./skills/explain-diff/SKILL.md) | Groups the change by theme and writes an evidence-linked HTML page with a working quiz. |
| Every session re-reads the same repository from scratch. | [`recon`](./skills/recon/SKILL.md) | Stores a bounded evidence map and patches it from committed git drift. |
| The agent guesses what an external repository contains. | [`box`](./skills/box/SKILL.md) | Clones into a skill-owned sandbox, searches local source, and returns cited findings. |
| External coding-agent commands break on quoting, permissions, silence, or parallel runs. | [`assign`](./skills/assign/SKILL.md) | Uses collision-safe stdin transport, non-interactive commands, tracked processes, cleanup, and result verification. |
| A resumed session trusts stale paths, tasks, branches, or PR state. | [`handoff`](./skills/handoff/SKILL.md) | Saves a bounded, redacted handoff and validates every artifact before resuming work. |
| The main model spends its context on mechanical work or trusts delegate summaries. | [`orchestrate`](./skills/orchestrate/SKILL.md) | Delegates disjoint chunks, verifies evidence and integration, and keeps the parent read-only. |

## Reference

| Skill | Description | Flags and arguments |
|---|---|---|
| [`prath-mode`](./skills/prath-mode/SKILL.md) | Route one action or a complete workflow chain. | None |
| [`peer-review`](./skills/peer-review/SKILL.md) | Review a plan or proposed change and issue a fixed verdict. | None |
| [`deslop`](./skills/deslop/SKILL.md) | Remove code slop from one git diff without changing behavior. | `--staged` default, `--unstaged`, `--base <branch>` |
| [`commit`](./skills/commit/SKILL.md) | Commit a locked snapshot with hunk-traced copy. | `--staged` default, `--unstaged`, `--conventional` default, `--simple`, `--verify` |
| [`make-pr`](./skills/make-pr/SKILL.md) | Publish a branch and create or update its PR. | `--target <branch>` default `main`, `--ticket <id>`, `--conventional` |
| [`fix-pr`](./skills/fix-pr/SKILL.md) | Resolve all open PR feedback and reply with evidence. | `--pr <n\|url>`, `--no-push`, `--no-reply` |
| [`explain-diff`](./skills/explain-diff/SKILL.md) | Write an HTML teaching page for a diff, branch, or PR. | `--target <branch>` default `main`, `--pr <n\|url>`, `--staged`, `--unstaged`, `--output <path>` |
| [`recon`](./skills/recon/SKILL.md) | Build or refresh a persistent map of the current repo. | `--refresh`, positional focus |
| [`box`](./skills/box/SKILL.md) | Clone, update, list, search, or persist an external repo. | `--persist`, `--update`, `--list`, `--no-subagents` |
| [`assign`](./skills/assign/SKILL.md) | Run one task with OpenCode, Codex, or Claude Code. | `--agent <name>` default `opencode`, `--model <model>`, `--dir <path>` |
| [`handoff`](./skills/handoff/SKILL.md) | Save or resume bounded session state. | `--resume <path>`, `--path <path>`, positional focus |
| [`orchestrate`](./skills/orchestrate/SKILL.md) | Coordinate in-harness subagents as a read-only parent. | Positional task |

## Development

Before committing a skill edit, run the manual checks in
[`AGENTS.md`](./AGENTS.md):

1. Frontmatter name matches the skill directory.
2. Description is present and at most 1,024 characters.
3. `SKILL.md` is at most 100 lines.
4. Quickstart and Reference both include the skill.
5. Every real Markdown path in the skill resolves.

## License

MIT © 2026 Pratham Dubey
