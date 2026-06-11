# Agent Skill Authoring Conventions

> Rules specific to writing skills for this repository. For global agent
> behavior, see the `global-rules` skill.

## Meta-Rule: Draft Before Writing

**Never write a skill file without explicit user confirmation.**

1. Propose a plan (name, location, flags, structure)
2. Wait for user to say "yes" or request changes
3. Only then write the `SKILL.md` file

This applies to every skill, no exceptions.

## Meta-Rule: Update README

**After writing a new skill, update `README.md` before committing.**

1. Add the skill to the quickstart invocation list.
2. Add a failure mode entry in `## Why These Skills Exist` if applicable.
3. Add a row to the `## Reference` table with name, link, description, and flags.

Do not commit the skill without the README update.

## Meta-Rule: Validate Skill Changes

**After adding or updating any skill, run `node scripts/validate-skills.mjs` before committing.**

1. Run the validator after the skill file, reference files, and README are updated.
2. Fix every validation failure before committing.
3. Treat this as a maintainer check only; skill users do not run it when invoking installed skills.

Do not commit a skill addition or update until the validator passes.

---

## Project Structure

- Skills live in `skills/<name>/SKILL.md` (project-level)
- Never use `.agents/skills/` for this repo
- Each skill is a directory containing `SKILL.md` at minimum
- Optional: `REFERENCE.md`, `scripts/`, `references/`, `assets/`

## REFERENCE.md gate

If a skill ships a `REFERENCE.md`, **always add Step 0 to `SKILL.md`** before any
workflow step. Place it after flag detection (or the intro section) and before
Step 1 or Workflow A. Do not rely on inline "See REFERENCE.md" links alone.

Use this template. Customize bullet 2 and 3 for the skill's reference content:

```markdown
## Step 0: Read REFERENCE.md (mandatory)

**Do not proceed to Step 1 or any later step until you have read `REFERENCE.md` in full.**

1. Use the Read tool on `./REFERENCE.md` in this skill's directory (same folder as this file).
2. Treat every [rule / format / constraint type] in that file as binding for this session.
3. If you have not read it yet, stop and read it now. Skipping this step causes [specific failure mode].
```

If the skill has a Constraints section, add: **Never skip Step 0.** REFERENCE.md
holds [what the reference contains] this skill depends on.

When adding Step 0 to an existing skill that already has `REFERENCE.md`, apply
the same gate.

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

- Keep `SKILL.md` at or under 100 lines
- Use progressive disclosure: essentials in `SKILL.md`, detail in `REFERENCE.md`
  or `references/`; enforce the read with Step 0 when using `REFERENCE.md`
- Prefer procedures over declarations: teach _how to approach_, not _what to
  produce_
- Match specificity to fragility: guidelines for flexible tasks, exact steps for
  fragile ones
- State defaults, not menus: pick one approach, mention alternatives briefly
- Every instruction must be actionable. No vague advice.
- Use concrete language with examples. No filler.
