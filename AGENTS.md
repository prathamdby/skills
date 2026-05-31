# Agent Skill Authoring Conventions

> Rules specific to writing skills for this repository. For global agent
> behavior, see the `global-rules` skill.

## Meta-Rule: Draft Before Writing

**Never write a skill file without explicit user confirmation.**

1. Propose a plan (name, location, flags, structure)
2. Wait for user to say "yes" or request changes
3. Only then write the `SKILL.md` file

This applies to every skill, no exceptions.

---

## Project Structure

- Skills live in `skills/<name>/SKILL.md` (project-level)
- Never use `.agents/skills/` for this repo
- Each skill is a directory containing `SKILL.md` at minimum
- Optional: `scripts/`, `references/`, `assets/`

## Frontmatter

| Field         | Rule                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `name`        | kebab-case, max 64 chars, match directory name                                                   |
| `description` | WHAT the skill does + WHEN to use it + supported flags. Use imperative phrasing. Max 1024 chars. |

## Flags Are Preferred

If a skill has variants (diff scope, message style, target branch, etc.), expose
them as flags in the user's invocation message:

- `--flag <value>` for arguments
- `--flag` for booleans
- Always document flags in a table in the skill body
- Always declare defaults explicitly

### Flag Naming

- Use kebab-case: `--base-branch`, not `--baseBranch`
- Be explicit: `--ticket`, not `--t`

## Content Principles

- Keep `SKILL.md` under 500 lines / 5000 tokens
- Use progressive disclosure: essentials in `SKILL.md`, detail in `references/`
- Prefer procedures over declarations: teach _how to approach_, not _what to
  produce_
- Match specificity to fragility: guidelines for flexible tasks, exact steps for
  fragile ones
- State defaults, not menus: pick one approach, mention alternatives briefly
- Every instruction must be actionable. No vague advice.
- Use concrete language with examples. No filler.
