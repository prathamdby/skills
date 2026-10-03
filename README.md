# Pratham Dubey's skills

[![skills.sh](https://skills.sh/b/prathamdby/skills)](https://skills.sh/prathamdby/skills)

A small set of agent workflows for software delivery, research, delegation,
task management, and session continuity. Each skill has a narrow job, explicit
stop conditions, and options derived from the user's request.

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

- `/prath-mode` routes a goal to the right skill or multi-step workflow.
- `/upfront-design` develops an approved design and delivery plan, then checks implementation against it.
- `/autoplan` turns a repository change request into an evidence-backed implementation plan without interruptions.
- `/peer-review` assesses whether a plan, design, or proposed change is ready to build.
- `/deslop` removes unnecessary complexity from a git diff without changing behavior.
- `/commit` saves scoped git changes with a message grounded in the committed diff.
- `/make-pr` publishes committed branch changes and creates or updates their pull request.
- `/fix-pr` handles PR feedback and failing CI through triage, fixes, and evidence-backed replies.
- `/gh` inspects PR state and discussions, diagnoses CI failures, and posts replies.
- `/recon` builds and maintains an evidence-backed map of the current codebase.
- `/box` manages local clones of external repositories and answers questions from their source.
- `/use-skill` runs remote skills from GitHub links without installing them.
- `/todoist-task` creates or previews Todoist tasks that make sense without the original conversation.
- `/handoff` saves session context and validates it when resuming work.
- `/orchestrate` coordinates delegated work while keeping the main agent responsible for verification.
- `/cursor-agent` runs and manages the local Cursor Agent CLI and verifies its results.
- `/claude-code` runs and manages the local Claude Code CLI and verifies its results.
- `/codex` runs and manages the local Codex CLI and verifies its results.

## Why these skills exist

| Common failure | Skill | How it helps |
| --- | --- | --- |
| The agent picks the wrong workflow or repeats work owned by another skill. | [`prath-mode`](./skills/engineering/prath-mode/SKILL.md) | Routes work through the appropriate skills and delivery workflows. |
| Coding starts before the problem, design, and delivery plan are agreed. | [`upfront-design`](./skills/engineering/upfront-design/SKILL.md) | Guides collaborative design and checks implementation against approved milestones. |
| Planning stalls on repeated questions or lacks a grounded path to implementation. | [`autoplan`](./skills/engineering/autoplan/SKILL.md) | Produces an evidence-backed implementation plan autonomously. |
| A plan misses requirements or carries risky assumptions into implementation. | [`peer-review`](./skills/engineering/peer-review/SKILL.md) | Evaluates the proposed work and identifies material blockers before building. |
| Generated edits make code harder to maintain without adding behavior. | [`deslop`](./skills/engineering/deslop/SKILL.md) | Removes unnecessary complexity while preserving behavior. |
| Commit messages describe the conversation instead of the changes being saved. | [`commit`](./skills/engineering/commit/SKILL.md) | Creates scoped commits with messages grounded in the committed changes. |
| A branch is published with a duplicate PR or a description that does not match its changes. | [`make-pr`](./skills/engineering/make-pr/SKILL.md) | Publishes committed work and keeps the PR description grounded in the branch diff. |
| PR feedback or failing CI is missed, dismissed without evidence, or left unresolved. | [`fix-pr`](./skills/engineering/fix-pr/SKILL.md) | Checks feedback and CI, verifies justified fixes, and replies with evidence. |
| PR discussions and CI failures are hard to inspect or reply to reliably. | [`gh`](./skills/engineering/gh/SKILL.md) | Provides focused GitHub inspection, diagnosis, and replies. |
| Each session rediscovers the repository or relies on an outdated map. | [`recon`](./skills/engineering/recon/SKILL.md) | Maintains a reusable codebase map grounded in repository evidence. |
| The agent guesses what an external repository contains. | [`box`](./skills/engineering/box/SKILL.md) | Answers questions from managed local clones of the actual source. |
| The agent needs a remote skill without adding it to the installed collection. | [`use-skill`](./skills/personal/use-skill/SKILL.md) | Fetches and runs GitHub-hosted skills on demand. |
| Tasks lose their meaning when separated from the conversation that created them. | [`todoist-task`](./skills/personal/todoist-task/SKILL.md) | Creates clear Todoist tasks with the requested context and metadata. |
| Work resumes with lost context or stale assumptions about artifacts and progress. | [`handoff`](./skills/engineering/handoff/SKILL.md) | Saves actionable session context and validates it before continuing. |
| Delegated work overlaps or is accepted without checking the result. | [`orchestrate`](./skills/engineering/orchestrate/SKILL.md) | Coordinates subagents with clear ownership and verified outcomes. |
| Cursor Agent runs use incorrect commands or workspace permissions. | [`cursor-agent`](./skills/engineering/cursor-agent/SKILL.md) | Runs and manages the local CLI while respecting permissions and verifying results. |
| Claude Code runs confuse execution modes and permissions. | [`claude-code`](./skills/engineering/claude-code/SKILL.md) | Runs and manages the local CLI while respecting permissions and verifying results. |
| Codex runs confuse execution modes and sandbox behavior. | [`codex`](./skills/engineering/codex/SKILL.md) | Runs and manages the local CLI while respecting permissions and verifying results. |

## Reference

| Skill | Description |
| --- | --- |
| [`prath-mode`](./skills/engineering/prath-mode/SKILL.md) | Route goals to skills and multi-step workflows. |
| [`upfront-design`](./skills/engineering/upfront-design/SKILL.md) | Develop, resume, and check approved designs and delivery plans. |
| [`autoplan`](./skills/engineering/autoplan/SKILL.md) | Produce an evidence-backed implementation plan without interruptions. |
| [`peer-review`](./skills/engineering/peer-review/SKILL.md) | Assess plans, designs, and proposed changes for readiness to build. |
| [`deslop`](./skills/engineering/deslop/SKILL.md) | Simplify a git diff without changing behavior. |
| [`commit`](./skills/engineering/commit/SKILL.md) | Save scoped changes with diff-grounded commit messages. |
| [`make-pr`](./skills/engineering/make-pr/SKILL.md) | Publish committed work and create or update its pull request. |
| [`fix-pr`](./skills/engineering/fix-pr/SKILL.md) | Triage and resolve PR feedback and failing CI, then reply with evidence. |
| [`gh`](./skills/engineering/gh/SKILL.md) | Inspect PRs and discussions, diagnose CI failures, and post replies. |
| [`recon`](./skills/engineering/recon/SKILL.md) | Build and refresh an evidence-backed codebase map. |
| [`box`](./skills/engineering/box/SKILL.md) | Manage and research external repositories from local source. |
| [`use-skill`](./skills/personal/use-skill/SKILL.md) | Run GitHub-hosted skills on demand without installing them. |
| [`todoist-task`](./skills/personal/todoist-task/SKILL.md) | Create or preview clear, self-contained Todoist tasks. |
| [`handoff`](./skills/engineering/handoff/SKILL.md) | Preserve session context and resume work from validated state. |
| [`orchestrate`](./skills/engineering/orchestrate/SKILL.md) | Coordinate delegated work with verified ownership and results. |
| [`cursor-agent`](./skills/engineering/cursor-agent/SKILL.md) | Run, manage, and verify local Cursor Agent CLI work. |
| [`claude-code`](./skills/engineering/claude-code/SKILL.md) | Run, manage, and verify local Claude Code CLI work. |
| [`codex`](./skills/engineering/codex/SKILL.md) | Run, manage, and verify local Codex CLI work. |

## Development

Before committing a skill edit, run
[`scripts/skill-guards.test.sh`](./scripts/skill-guards.test.sh) and the
manual checks in [`AGENTS.md`](./AGENTS.md).

## License

MIT © 2026 Pratham Dubey
