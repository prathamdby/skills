# Pratham Dubey's skills

[![skills.sh](https://skills.sh/b/prathamdby/skills)](https://skills.sh/prathamdby/skills)

A small set of coding-agent skills for planning, git work, code review,
delegation, and session continuity. Each skill is one short file of plain
instructions. You can read any of them in a minute.

## Install

### skills.sh

```bash
npx skills@latest add prathamdby/skills
```

Pick the skills you want in the installer.

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

## Skills

| Skill | What it does |
|---|---|
| [`/prath-mode`](./skills/prath-mode/SKILL.md) | Route one request to the skill that owns it, or run a full ship chain. |
| [`/peer-review`](./skills/peer-review/SKILL.md) | Decide if a plan is ready to build: ship, fix the blockers, or rework. |
| [`/verify`](./skills/verify/SKILL.md) | Run N isolated attempts at a task and pick the best one. |
| [`/deslop`](./skills/deslop/SKILL.md) | Cut bloat from a diff without changing what the code does. |
| [`/commit`](./skills/commit/SKILL.md) | Commit staged work with a message proved by the diff. |
| [`/make-pr`](./skills/make-pr/SKILL.md) | Push a branch and create or update its pull request. |
| [`/fix-pr`](./skills/fix-pr/SKILL.md) | Work through pull-request feedback and red CI, then reply. |
| [`/gh`](./skills/gh/SKILL.md) | Read PR state, review threads, and CI failures through local scripts. |
| [`/explain-diff`](./skills/explain-diff/SKILL.md) | Turn a diff into a self-contained HTML teaching page. |
| [`/recon`](./skills/recon/SKILL.md) | Map the current repository and patch the map on later runs. |
| [`/box`](./skills/box/SKILL.md) | Clone an external repository and search the local copy with citations. |
| [`/assign`](./skills/assign/SKILL.md) | Run one task through an external coding-agent CLI. |
| [`/handoff`](./skills/handoff/SKILL.md) | Save session state and resume from it later. |
| [`/orchestrate`](./skills/orchestrate/SKILL.md) | Split work across subagents and verify what they return. |

## Development

The authoring rules live in [`AGENTS.md`](./AGENTS.md). The short version: one
plain file per skill, written in simplified technical English, with this table
updated for every new skill.

## License

MIT © 2026 Pratham Dubey
