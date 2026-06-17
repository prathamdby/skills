# Agent Skill Authoring Conventions

> Rules specific to writing skills for this repository. For global agent
> behavior, see the `global-rules` skill. These conventions follow the
> `writing-great-skills` framework: a skill exists to make the agent take the
> same _process_ every run. Predictability is the goal every rule below serves.

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

## Disclose by branch, not by gate

Material the agent needs on _every_ run stays inline in `SKILL.md`. Material
only _some_ runs reach (a **branch** — a distinct way the skill is invoked) gets
pushed into `REFERENCE.md` or `references/`, reached by a sharp **context
pointer** at the step that needs it.

- Inline what every branch needs; disclose what only some branches reach.
- A pointer's _wording_ decides how reliably the agent follows it. Word it as an
  instruction tied to its trigger condition: "classify every change against the
  8 categories in `REFERENCE.md`", not "see REFERENCE.md".
- Do not add a mandatory "read this file first" gate. A gate forces every run to
  load reference some runs never use, defeating disclosure. If a pointer fires
  unreliably on must-have material, sharpen its wording or inline the material —
  do not gate it.
- If everything in a would-be `REFERENCE.md` is must-have on every run, keep it
  inline and ship no `REFERENCE.md`.

## Frontmatter

| Field         | Rule                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | kebab-case, max 64 chars, match directory name                                                                                                                  |
| `description` | Triggers that fire the skill, plus a reach clause if other skills invoke it. Front-load the leading word. Omit it to make a skill user-invoked. Max 1024 chars. |

### Writing the description

The description sits in the context window every turn, so prune it harder than
the body.

- **Front-load the leading word** — the word you actually type when you want the
  skill (`commit`, `deslop`, `handoff`). It anchors invocation.
- **One trigger per branch.** Synonyms renaming a single branch are duplication;
  collapse them. Keep only genuinely distinct triggers.
- **Cut identity already stated in the body.** No mandated boilerplate phrase.
- Do not restate the description as a "When to use this skill" section in the
  body — that is duplication of a line the agent already holds.

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
- Use progressive disclosure: inline what every run needs; push branch-only
  reference into `REFERENCE.md` or `references/` behind a sharp context pointer
- Co-locate: keep a concept's definition, rules, and caveats under one heading
- Prefer procedures over declarations: teach _how to approach_, not _what to
  produce_
- Match specificity to fragility: guidelines for flexible tasks, exact steps for
  fragile ones
- State defaults, not menus: pick one approach, mention alternatives briefly
- End each step on a checkable completion criterion, so the agent can tell done
  from not-done and does not stop short
- Reach for a leading word before a paragraph: a pretrained concept (`slop`,
  `handoff`, `tracer bullets`) anchors behavior in one token
- Keep each meaning in one place. The same fact in two files is duplication —
  the leaf frontmatter owns its own triggers and flags, not a central catalog
- Hunt no-ops: delete any sentence the agent would already obey by default
- Every instruction must be actionable. No vague advice, no filler.
