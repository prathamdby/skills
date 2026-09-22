# Pratham Dubey's skills

[![skills.sh](https://skills.sh/b/prathamdby/skills)](https://skills.sh/prathamdby/skills)

A small set of coding-agent workflows for planning, git work, code review,
delegation, and session continuity. Each skill has a narrow job, explicit stop
conditions, and options derived from the user's request.

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

- `/prath-mode` matches a goal to a playbook under `prath-mode/playbooks/` and runs that route’s leaves.
- `/upfront-design` gates product review, system design, program design, and vertical slices on user approval before code, then checks each landed milestone when given the approved design.
- `/peer-review` checks an implementation plan before work starts.
- `/deslop` removes needless complexity from a selected diff.
- `/commit` creates a clean-room commit from staged or tracked unstaged work.
- `/make-pr` pushes committed work and creates or updates its pull request.
- `/fix-pr` hunts, triages, fixes, and replies to pull-request feedback and CI.
- `/gh` orients on a PR, review threads, or red CI, or posts one reply.
- `/recon` maps the current repository and refreshes only changed areas later.
- `/box` clones and searches an external git repository locally.
- `/use-skill` fetches and runs a remote skill from one or more GitHub links.
- `/todoist-task` asks a few questions about missing context, then creates reminders that still make sense six months later.
- `/handoff` saves resumable session state or continues from it.
- `/orchestrate` coordinates cheaper subagents while the main agent verifies.
- `/cursor-agent` drives the local Cursor Agent CLI for first-run install, interactive, one-shot, persist, worktree, MCP, plugin, worker, or Bedrock runs.
- `/claude-code` drives the local Claude Code CLI for first-run, interactive, one-shot print, resume, worktree, MCP, or plugin runs.
- `/codex` drives the local Codex CLI for first-run, interactive, one-shot exec, review, resume, worktree, MCP, or plugin runs.

## Why these skills exist

| Common failure                                                                                                              | Skill                                                            | Contract                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The agent picks the wrong workflow or repeats work owned by another skill.                                                  | [`prath-mode`](./skills/engineering/prath-mode/SKILL.md)         | Matches one playbook, copies its steps into the todo list, and invokes only the named leaves.                                                                                |
| The agent starts coding from a one-line request; the PR needs rework and review drags.                                      | [`upfront-design`](./skills/engineering/upfront-design/SKILL.md) | Triages size, writes each approved design phase to a file outside the repo, records only hard-to-reverse decisions as ADRs, and checks landed milestones against the design. |
| A plan misses a requirement or carries a risky assumption into implementation.                                              | [`peer-review`](./skills/engineering/peer-review/SKILL.md)       | Exhausts every material finding, ranks them, and issues a fixed verdict. It edits only with explicit authority.                                                              |
| A plan review stops after the first risk and leaves other blockers unlisted.                                                | [`peer-review`](./skills/engineering/peer-review/SKILL.md)       | Surfaces every material finding with no count cap, then maps the full ranked list to the verdict.                                                                            |
| Generated code adds guards, wrappers, comments, or indirection that the codebase does not need.                             | [`deslop`](./skills/engineering/deslop/SKILL.md)                 | Classifies the selected diff against six categories, preserves staging intent, and verifies behavior-sensitive edits.                                                        |
| Commit messages leak ticket or review context and do not match the committed hunks.                                         | [`commit`](./skills/engineering/commit/SKILL.md)                 | Locks the snapshot, traces every message line to a hunk, applies the selected hook policy, and verifies the commit.                                                          |
| PR creation misses local commits, duplicates an existing PR, or describes work absent from the diff.                        | [`make-pr`](./skills/engineering/make-pr/SKILL.md)               | Blocks on a dirty or diverged branch, publishes committed work, reuses the open PR, and verifies its fields.                                                                 |
| A PR body is a flat changelog or invents motive or ticket claims the diff cannot prove.                                     | [`make-pr`](./skills/engineering/make-pr/SKILL.md)               | Writes Why, Special, and Change outline from the locked diff only, with Special as `- None.` when no proved hazards exist.                                                   |
| A PR body leaves a shape change as prose when a sketch would make the delta clear.                                          | [`make-pr`](./skills/engineering/make-pr/SKILL.md)               | Adds the smallest proved views in Change outline, including schema, contract, and type sketches when the hunks show them.                                                    |
| A harness appends marketing footers such as `Made with Cursor` to the PR body.                                              | [`make-pr`](./skills/engineering/make-pr/SKILL.md)               | Requires the published body to equal the ledger body and strips injected footers once before success.                                                                        |
| Review work starts from the first visible comment and misses later pages, nested replies, or invalid suggestions.           | [`fix-pr`](./skills/engineering/fix-pr/SKILL.md)                 | Exhausts every feedback surface before editing, requires evidence for each verdict, and re-hunts until stable.                                                               |
| Required CI or check runs on the PR head are left red while only human comments are fixed.                                  | [`fix-pr`](./skills/engineering/fix-pr/SKILL.md)                 | Hunts terminal non-success required or blocking checks and annotations with the other surfaces, then triages and fixes them.                                                 |
| A fix-pr commit subject narrates review follow-up instead of the locked hunks.                                              | [`fix-pr`](./skills/engineering/fix-pr/SKILL.md)                 | Discards pre-drafted subjects, requires a hunk-proved subject recipe, and blocks ban-list or conversation-only messages before push.                                         |
| A fix-pr commit picks up identity or harness trailers from hooks or agent defaults.                                         | [`fix-pr`](./skills/engineering/fix-pr/SKILL.md)                 | Denies `Co-authored-by` / `Signed-off-by` / `Made-with` and freeform harness footers by default and runs commit Trailer hygiene before push.                                 |
| Agents burn 3–5 `gh` calls and dump CI logs into context when inspecting a PR.                                              | [`gh`](./skills/engineering/gh/SKILL.md)                         | One script per I/O loop; bounded snippets; logs on disk; raw `gh` only after gotchas.                                                                                        |
| A fix-pr hunt runs `gh` scripts without loading the gh skill, then invents raw `gh` to reply.                               | [`fix-pr`](./skills/engineering/fix-pr/SKILL.md)                 | Requires the gh skill before any GitHub I/O and posts replies through `pr-reply.ts`.                                                                                         |
| Agents skip the `.ts` inspect scripts on Node 22 and dump GraphQL instead of probing bun, nub, tsx, or type-stripping Node. | [`gh`](./skills/engineering/gh/SKILL.md)                         | `scripts/run` tries bun, nub, tsx, then Node (native TS or `--experimental-strip-types`, including nvm); GraphQL inspect is blocked until that list is exhausted.            |
| Every session re-reads the same repository from scratch.                                                                    | [`recon`](./skills/engineering/recon/SKILL.md)                   | Stores a bounded evidence map and patches it from committed git drift.                                                                                                       |
| The agent guesses what an external repository contains.                                                                     | [`box`](./skills/engineering/box/SKILL.md)                       | Clones into a skill-owned sandbox, searches local source, and returns cited findings.                                                                                        |
| The model needs a skill it does not have installed.                                                                           | [`use-skill`](./skills/personal/use-skill/SKILL.md)              | Bulk-fetches the full skill directory via `gh api` and executes it as if natively present.                                                             |
| A Todoist task loses the reason for the work or becomes a technical specification. | [`todoist-task`](./skills/personal/todoist-task/SKILL.md) | Asks 1 to 3 questions about missing context, waits for answers, and saves a concise reminder with duplicate checks and verification. |
| A resumed session trusts stale paths, tasks, branches, or PR state.                                                         | [`handoff`](./skills/engineering/handoff/SKILL.md)               | Saves a bounded, redacted handoff and validates every artifact before resuming work.                                                                                         |
| The main model spends its context on mechanical work or trusts delegate summaries.                                          | [`orchestrate`](./skills/engineering/orchestrate/SKILL.md)       | Delegates disjoint chunks, verifies evidence and integration, and keeps the parent read-only.                                                                                |
| The agent invents an unsupported `--mode` value, treats `--print` as read-only, or bypasses workspace trust with `--yolo`.  | [`cursor-agent`](./skills/engineering/cursor-agent/SKILL.md)     | Runs current local `cursor-agent` syntax, gates `--trust`, and verifies the working tree.                                                                                    |
| The agent treats `claude -p` as skip-all-permissions, or pastes `--workspace` / `--trust` / `--yolo` onto `claude`.         | [`claude-code`](./skills/engineering/claude-code/SKILL.md)       | Runs current local `claude` syntax, keeps `--print` under permission mode, and verifies the working tree.                                                                    |
| The agent runs `codex` as a PTY TUI, `--full-auto`, or `--sandbox workspace-write` as auto-approve.                         | [`codex`](./skills/engineering/codex/SKILL.md)                   | Runs `codex exec -C`, treats sandbox as not approval, and verifies the working tree.                                                                                         |

## Reference

| Skill                                                            | Description                                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`prath-mode`](./skills/engineering/prath-mode/SKILL.md)         | Match a goal to a playbook and run its leaf sequence.                                              |
| [`upfront-design`](./skills/engineering/upfront-design/SKILL.md) | Agree product review, system design, program design, and vertical slices before code; check landed milestones. |
| [`peer-review`](./skills/engineering/peer-review/SKILL.md)       | Exhaustively review a plan or proposed change and issue a fixed verdict.                                       |
| [`deslop`](./skills/engineering/deslop/SKILL.md)                 | Remove code slop from one git diff without changing behavior.                                                  |
| [`commit`](./skills/engineering/commit/SKILL.md)                 | Commit a locked snapshot with hunk-traced copy.                                                                |
| [`make-pr`](./skills/engineering/make-pr/SKILL.md)               | Publish a branch and create or update its PR with a Why / Special / Change outline body and trailer hygiene.   |
| [`fix-pr`](./skills/engineering/fix-pr/SKILL.md)                 | Resolve open PR feedback and CI, then reply with evidence.                                                     |
| [`gh`](./skills/engineering/gh/SKILL.md)                         | Orient on PR state, review threads, or CI, or post one reply.                                                  |
| [`recon`](./skills/engineering/recon/SKILL.md)                   | Build or refresh a persistent map of the current repo.                                                         |
| [`box`](./skills/engineering/box/SKILL.md)                       | Clone, update, list, search, or persist an external repo.                                                      |
| [`use-skill`](./skills/personal/use-skill/SKILL.md)           | Run a remote skill on demand from GitHub links.                                                                |
| [`todoist-task`](./skills/personal/todoist-task/SKILL.md)        | Clarify missing context before creating or previewing concise Todoist reminders. |
| [`handoff`](./skills/engineering/handoff/SKILL.md)               | Save or resume bounded session state.                                                                          |
| [`orchestrate`](./skills/engineering/orchestrate/SKILL.md)       | Coordinate in-harness subagents as a read-only parent.                                                         |
| [`cursor-agent`](./skills/engineering/cursor-agent/SKILL.md)     | Drive the Cursor Agent CLI for one-shot and related runs.                                                      |
| [`claude-code`](./skills/engineering/claude-code/SKILL.md)       | Drive the Claude Code CLI for one-shot and related runs.                                                       |
| [`codex`](./skills/engineering/codex/SKILL.md)                   | Drive the Codex CLI for one-shot exec and related runs.                                                        |

## Development

Before committing a skill edit, run
[`scripts/skill-guards.test.sh`](./scripts/skill-guards.test.sh) and the
manual checks in [`AGENTS.md`](./AGENTS.md).

## License

MIT © 2026 Pratham Dubey
