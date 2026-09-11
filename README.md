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
- `/verify` fans out N isolated attempts, ranks them, and stops on a named gate.
- `/deslop` removes needless complexity from a selected diff.
- `/commit` creates a clean-room commit from staged or tracked unstaged work.
- `/make-pr` pushes committed work and creates or updates its pull request.
- `/fix-pr` hunts, triages, fixes, and replies to pull-request feedback and CI.
- `/gh` orients on a PR, review threads, or red CI, or posts one reply.
- `/explain-diff` writes a self-contained HTML walkthrough of a change.
- `/recon` maps the current repository and refreshes only changed areas later.
- `/box` clones and searches an external git repository locally.
- `/handoff` saves resumable session state or continues from it.
- `/orchestrate` coordinates cheaper subagents while the main agent verifies.
- `/cursor-agent` drives the local Cursor Agent CLI for first-run install, interactive, one-shot, persist, worktree, MCP, plugin, worker, or Bedrock runs.
- `/claude-code` drives the local Claude Code CLI for first-run, interactive, one-shot print, resume, worktree, MCP, or plugin runs.
- `/codex` drives the local Codex CLI for first-run, interactive, one-shot exec, review, resume, worktree, MCP, or plugin runs.

## Why these skills exist

| Common failure                                                                                                              | Skill                                            | Contract                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The agent picks the wrong workflow or repeats work owned by another skill.                                                  | [`prath-mode`](./skills/prath-mode/SKILL.md)     | Routes each immediate action to one owner and tracks chain completion.                                                                                            |
| A plan misses a requirement or carries a risky assumption into implementation.                                              | [`peer-review`](./skills/peer-review/SKILL.md)   | Exhausts every material finding, ranks them, and issues a fixed verdict. It edits only with explicit authority.                                                   |
| A plan review stops after the first risk and leaves other blockers unlisted.                                                | [`peer-review`](./skills/peer-review/SKILL.md)   | Surfaces every material finding with no count cap, then maps the full ranked list to the verdict.                                                                 |
| The agent ships the first attempt or picks a winner from narration instead of observed evidence.                            | [`verify`](./skills/verify/SKILL.md)             | Fans out N isolated attempts, pairwise-verifies on decomposed criteria, ranks with PPT, and stops on a named gate.                                                |
| Generated code adds guards, wrappers, comments, or indirection that the codebase does not need.                             | [`deslop`](./skills/deslop/SKILL.md)             | Classifies the selected diff against six categories, preserves staging intent, and verifies behavior-sensitive edits.                                             |
| Commit messages leak ticket or review context and do not match the committed hunks.                                         | [`commit`](./skills/commit/SKILL.md)             | Locks the snapshot, traces every message line to a hunk, applies the selected hook policy, and verifies the commit.                                               |
| PR creation misses local commits, duplicates an existing PR, or describes work absent from the diff.                        | [`make-pr`](./skills/make-pr/SKILL.md)           | Blocks on a dirty or diverged branch, publishes committed work, reuses the open PR, and verifies its fields.                                                      |
| A PR body stays flat for large diffs or buries small changes in boilerplate.                                                | [`make-pr`](./skills/make-pr/SKILL.md)           | Measures the locked diff, picks a body tier for bullet count and depth, and writes STE100 and Google-style prose.                                                 |
| A PR body of any tier leaves a shape change as prose when a sketch would make the delta clear.                              | [`make-pr`](./skills/make-pr/SKILL.md)           | Drafts rich proved views from Body visuals, including on S, and places each view next to the theme it supports.                                                   |
| A harness appends marketing footers such as `Made with Cursor` to the PR body.                                              | [`make-pr`](./skills/make-pr/SKILL.md)           | Requires the published body to equal the ledger body and strips injected footers once before success.                                                             |
| Review work starts from the first visible comment and misses later pages, nested replies, or invalid suggestions.           | [`fix-pr`](./skills/fix-pr/SKILL.md)             | Exhausts every feedback surface before editing, requires evidence for each verdict, and re-hunts until stable.                                                    |
| Required CI or check runs on the PR head are left red while only human comments are fixed.                                  | [`fix-pr`](./skills/fix-pr/SKILL.md)             | Hunts terminal non-success required or blocking checks and annotations with the other surfaces, then triages and fixes them.                                      |
| A fix-pr commit subject narrates review follow-up instead of the locked hunks.                                              | [`fix-pr`](./skills/fix-pr/SKILL.md)             | Discards pre-drafted subjects, requires a hunk-proved subject recipe, and blocks ban-list or conversation-only messages before push.                              |
| A fix-pr commit picks up identity or harness trailers from hooks or agent defaults.                                         | [`fix-pr`](./skills/fix-pr/SKILL.md)             | Denies `Co-authored-by` / `Signed-off-by` / `Made-with` and freeform harness footers by default and runs commit Trailer hygiene before push.                      |
| Agents burn 3–5 `gh` calls and dump CI logs into context when inspecting a PR.                                              | [`gh`](./skills/gh/SKILL.md)                     | One script per I/O loop; bounded snippets; logs on disk; raw `gh` only after gotchas.                                                                             |
| A fix-pr hunt runs `gh` scripts without loading the gh skill, then invents raw `gh` to reply.                               | [`fix-pr`](./skills/fix-pr/SKILL.md)             | Requires the gh skill before any GitHub I/O and posts replies through `pr-reply.ts`.                                                                              |
| Agents skip the `.ts` inspect scripts on Node 22 and dump GraphQL instead of probing bun, nub, tsx, or type-stripping Node. | [`gh`](./skills/gh/SKILL.md)                     | `scripts/run` tries bun, nub, tsx, then Node (native TS or `--experimental-strip-types`, including nvm); GraphQL inspect is blocked until that list is exhausted. |
| A large diff gets a shallow chat summary with no surrounding system context.                                                | [`explain-diff`](./skills/explain-diff/SKILL.md) | Groups the change by theme and writes an evidence-linked HTML page with a working quiz.                                                                           |
| Every session re-reads the same repository from scratch.                                                                    | [`recon`](./skills/recon/SKILL.md)               | Stores a bounded evidence map and patches it from committed git drift.                                                                                            |
| The agent guesses what an external repository contains.                                                                     | [`box`](./skills/box/SKILL.md)                   | Clones into a skill-owned sandbox, searches local source, and returns cited findings.                                                                             |
| A resumed session trusts stale paths, tasks, branches, or PR state.                                                         | [`handoff`](./skills/handoff/SKILL.md)           | Saves a bounded, redacted handoff and validates every artifact before resuming work.                                                                              |
| The main model spends its context on mechanical work or trusts delegate summaries.                                          | [`orchestrate`](./skills/orchestrate/SKILL.md)   | Delegates disjoint chunks, verifies evidence and integration, and keeps the parent read-only.                                                                     |
| The agent invents an unsupported `--mode` value, treats `--print` as read-only, or bypasses workspace trust with `--yolo`.  | [`cursor-agent`](./skills/cursor-agent/SKILL.md) | Runs current local `cursor-agent` syntax, gates `--trust`, and verifies the working tree.                                                                         |
| The agent treats `claude -p` as skip-all-permissions, or pastes `--workspace` / `--trust` / `--yolo` onto `claude`.         | [`claude-code`](./skills/claude-code/SKILL.md)   | Runs current local `claude` syntax, keeps `--print` under permission mode, and verifies the working tree.                                                         |
| The agent runs `codex` as a PTY TUI, `--full-auto`, or `--sandbox workspace-write` as auto-approve.                         | [`codex`](./skills/codex/SKILL.md)               | Runs `codex exec -C`, treats sandbox as not approval, and verifies the working tree.                                                                              |
| Best-of-N collapses to the first plausible attempt or one yes/no judge call.                                                | [`verify`](./skills/verify/SKILL.md)             | Fans out a fixed-N pool, scores pairs on a 20-letter scale, ranks with a pivot tournament, and stops on a named gate.                                             |

## Reference

| Skill                                            | Description                                                                                                 | Flags and arguments                                                                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`prath-mode`](./skills/prath-mode/SKILL.md)     | Route one action or a complete workflow chain.                                                              | None                                                                                                                                                                                                 |
| [`peer-review`](./skills/peer-review/SKILL.md)   | Exhaustively review a plan or proposed change and issue a fixed verdict.                                    | None                                                                                                                                                                                                 |
| [`verify`](./skills/verify/SKILL.md)             | Fan out N isolated attempts, pairwise-verify, and select, or score current progress.                        | `--candidates` default `3`, `--evals` default `2`, `--pivots` default `2`, `--max-rounds` default `0`, `--criteria` default auto, `--track`                                                          |
| [`deslop`](./skills/deslop/SKILL.md)             | Remove code slop from one git diff without changing behavior.                                               | `--staged` default, `--unstaged`, `--base <branch>`                                                                                                                                                  |
| [`commit`](./skills/commit/SKILL.md)             | Commit a locked snapshot with hunk-traced copy.                                                             | `--staged` default, `--unstaged`, `--conventional` default, `--simple`, `--verify`, `--allow-trailers`                                                                                               |
| [`make-pr`](./skills/make-pr/SKILL.md)           | Publish a branch and create or update its PR with a diff-scaled body and rich proved visuals on every tier. | `--target <branch>` default `main`, `--ticket <id>`, `--conventional`                                                                                                                                |
| [`fix-pr`](./skills/fix-pr/SKILL.md)             | Resolve open PR feedback and CI, then reply with evidence.                                                  | `--pr <n\|url>`, `--no-push`, `--no-reply`                                                                                                                                                           |
| [`gh`](./skills/gh/SKILL.md)                     | Orient on PR state, review threads, or CI, or post one reply.                                               | `--json`, `--full`, `-R owner/repo`, threads `--open`/`--all`/`--complete`, CI `--pr`/`--sha`/`--list`, reply `--in-reply-to`/`--conversation`/`--body-file`/`--body`; invoke via `scripts/run`      |
| [`explain-diff`](./skills/explain-diff/SKILL.md) | Write an HTML teaching page for a diff, branch, or PR.                                                      | `--target <branch>` default `main`, `--pr <n\|url>`, `--staged`, `--unstaged`, `--output <path>`                                                                                                     |
| [`recon`](./skills/recon/SKILL.md)               | Build or refresh a persistent map of the current repo.                                                      | `--refresh`, positional focus                                                                                                                                                                        |
| [`box`](./skills/box/SKILL.md)                   | Clone, update, list, search, or persist an external repo.                                                   | `--persist`, `--update`, `--list`, `--no-subagents`                                                                                                                                                  |
| [`handoff`](./skills/handoff/SKILL.md)           | Save or resume bounded session state.                                                                       | `--resume <path>`, `--path <path>`, positional focus                                                                                                                                                 |
| [`orchestrate`](./skills/orchestrate/SKILL.md)   | Coordinate in-harness subagents as a read-only parent.                                                      | Positional task                                                                                                                                                                                      |
| [`cursor-agent`](./skills/cursor-agent/SKILL.md) | Drive the Cursor Agent CLI for one-shot and related runs.                                                   | `--print` default, `--plan`, `--mode ask`, `--model`, `--resume <id>`, `--continue`, `--worktree [name]`, `--output-format` default `text`, `--trust`, `--auto-review`, `--wall-clock` default `15m` |
| [`claude-code`](./skills/claude-code/SKILL.md)   | Drive the Claude Code CLI for one-shot and related runs.                                                    | `--print` default, `--permission-mode plan`, `--model`, `--resume <id>`, `--continue`, `--worktree [name]`, `--output-format` default `text`, `--wall-clock` default `15m`                           |
| [`codex`](./skills/codex/SKILL.md)               | Drive the Codex CLI for one-shot exec and related runs.                                                     | `exec` default, `-C, --cd <DIR>`, `--sandbox <mode>`, `-m, --model <model>`, `--worktree`, `--wall-clock` default `15m`                                                                              |

## Development

Before committing a skill edit, run the manual checks in
[`AGENTS.md`](./AGENTS.md).

## License

MIT © 2026 Pratham Dubey
