# Pratham Dubey's Skills

[![skills.sh](https://skills.sh/b/prathamdby/skills)](https://skills.sh/prathamdby/skills)

My personal agent skills that I use every day to ship clean commits, clean PRs, and clean code. Not vibe coding.

These skills are designed to be small, opinionated, and composable. They work with any model. They enforce conventions I actually care about: conventional commits, slop-free code, ticket-driven branches, and focused PRs. Hack around with them. Make them your own.

## Quickstart (30-second setup)

1. Run the skills.sh installer:

```bash
npx skills@latest add prathamdby/skills
```

2. Pick the skills you want, and which coding agents you want to install them on.

3. Invoke them in your agent:
   - `/commit`, commit with conventional or simple messages
   - `/deslop`, strip AI bloat and simplify
   - `/peer-review`, review a plan for gaps before building
   - `/fix-linear-ticket`, fetch ticket, branch, plan, fix, review
   - `/make-pr`, open PRs with thematic summaries
   - `/box`, clone and search any git repo locally
   - `/humanize`, remove AI tells from prose

## Why These Skills Exist

I built these skills to fix failure modes I kept hitting with Claude Code, Codex, and other agents.

### #1: Agents Write Garbage Commits

**The Problem.** Ask an agent to commit and you get "update file", "fix stuff", or a paragraph-long message that says nothing.

**The Fix.** [`/commit`](./skills/commit/SKILL.md) enforces your commit convention, conventional commits with strict formatting rules, or simple one-liners when you want speed. Flags for `--staged` vs `--unstaged`, `--conventional` vs `--simple`.

### #2: AI Slop Creeps Into the Codebase

**The Problem.** Agents add defensive checks nobody asked for, single-use abstractions, verbose comments explaining the obvious, and clever one-liners that obscure intent. The code works, but it's heavier than it needs to be.

**The Fix.** [`/deslop`](./skills/deslop/SKILL.md) exhaustively analyzes staged, unstaged, or branch-diff changes for 8 categories of slop and simplification opportunities, then removes them while preserving exact functionality. Supports `--staged`, `--unstaged`, and `--base <branch>`.

### #3: PRs Are Vague, Mis-Targeted, Or Missing Context

**The Problem.** Agents open PRs with titles like "Changes" and bodies that list every commit. Or they target the wrong branch. Or they forget to link the ticket.

**The Fix.** [`/make-pr`](./skills/make-pr/SKILL.md) generates thematic summaries grouped by related changes, not commit-by-commit. Supports `--target <branch>` (default: `main`) and `--ticket <id>` for Linear-linked titles like `[ABC-123] Add auth flow`.

### #4: Ticket-to-Code Is Scattershot

**The Problem.** Agents guess what a Linear ticket wants. They miss edge cases, skip linked issues, and build the wrong thing confidently.

**The Fix.** [`/fix-linear-ticket`](./skills/fix-linear-ticket/SKILL.md) fetches the real ticket from Linear, title, description, comments, attachments, linked issues. Creates a properly-named branch off any base you specify. Plans the fix and waits for your confirmation before writing code. Then reviews its own work against the ticket requirements.

### #5: Implementation Plans Go Unchallenged

**The Problem.** You greenlight a plan, the agent builds it, and only then you realize it missed a requirement or introduced a regression.

**The Fix.** [`/peer-review`](./skills/peer-review/SKILL.md) analyzes any implementation plan against requirements, flags the single critical risk, lists other gaps, proposes a fix for the critical risk only, and gives a verdict: ship it, fix critical first, or needs rework.

### #6: Agents Can't Search External Repos

**The Problem.** You drop a GitHub link and the agent either ignores it, guesses the contents, or dumps the raw README without understanding the code. No persistence, no local search, no context next time you mention the repo.

**The Fix.** [`/box`](./skills/box/SKILL.md) clones the repo locally (shallow, `--depth 1`), tracks it in a manifest, and searches the actual source when you ask. Pass `--persist` to write a reference into your project's `AGENTS.md` so future agents know the repo exists and can search it anytime you mention it by name.

### #7: Prose Sounds Robot-Generated

**The Problem.** AI text has statistical fingerprints: metronomic rhythm, passive voice, discourse markers, binary contrasts, vague declaratives. It reads as flat and lifeless to humans, and these same patterns are what detection tools target.

**The Fix.** [`/humanize`](./skills/humanize/SKILL.md) rewrites text to break probability patterns, name actors, vary rhythm, and replace vague summaries with specific details. Includes a 5-dimension scoring system and references from the detection research literature.

## Reference

| Skill                                                      | Description                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`commit`](./skills/commit/SKILL.md)                       | Generate conventional or simple commit messages. Supports `--staged`/`--unstaged` and `--conventional`/`--simple`. |
| [`deslop`](./skills/deslop/SKILL.md)                       | Remove AI slop and simplify changes. Supports `--staged`/`--unstaged`/`--base <branch>`.                           |
| [`fix-linear-ticket`](./skills/fix-linear-ticket/SKILL.md) | Fetch Linear ticket, create branch, plan fix with confirmation, implement, review. Supports `--base <branch>`.     |
| [`make-pr`](./skills/make-pr/SKILL.md)                     | Open PRs with thematic summaries. Supports `--target <branch>` and `--ticket <id>`.                                |
| [`peer-review`](./skills/peer-review/SKILL.md)             | Review implementation plans for gaps, risks, and completeness.                                                     |
| [`box`](./skills/box/SKILL.md)                             | Clone and search git repos locally. Supports `--persist`, `--update`, and `--list`.                                |
| [`humanize`](./skills/humanize/SKILL.md)                   | Rewrite text to remove AI tells and restore a human voice.                                                           |

## License

MIT © 2026 Pratham Dubey
