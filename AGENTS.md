# Agent skill authoring conventions

Rules for writing skills in this repository.

## Draft before writing

Never write a skill file without explicit user confirmation. Propose the plan,
wait for a yes, then write. This applies to every skill.

## Update the README

After you write a skill, add its row to the table in `README.md` before you
commit. Do not commit a skill without it.

## What a skill is

A skill is one `SKILL.md` inside `skills/<name>/`, never in `.agents/skills/`.
No reference files and no extra reading. The only exception is executable code
the skill needs to run, such as the scripts in `skills/gh/scripts/`.

A skill is a paragraph or two of instruction toward an end goal. It is not a
playbook and not a checklist. A school child should be able to read it and say
what the skill does.

## How to write it

Write in ASD-STE100 simplified technical English.

- Keep sentences short. One instruction per sentence.
- Use plain words. "Use", not "utilize". One word per meaning, used the same
  way every time.
- Use the active voice. Name who does what.
- Use the imperative for instructions and the present tense for facts.
- Keep the articles "the" and "a". Do not drop them to sound terse.

Follow the unslop rules at the same time: no em dashes, no colons as
mid-sentence glue, no bold spam, no decorative filler, no AI vocabulary. Use
sentence case for headings.

## Frontmatter

- `name`: kebab-case and the same as the directory name.
- `description`: the triggers that fire the skill, leading word first. Leave it
  out when only the user invokes the skill.

## Check before committing

There is no validator script. You are the check. For every skill you touched:
the name matches the directory, the description is present, the README table
includes the skill, and every Markdown path the skill mentions exists.
