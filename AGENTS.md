# Skill authoring

Skills make the agent follow a predictable process, not produce identical output.

## Authority and ownership

- Before writing a skill, propose its name, location, options, and structure;
  obtain explicit user confirmation. Approval to implement that plan counts.
- Skills live at `skills/<category>/<name>/SKILL.md`, normally in `engineering/`
  or `personal/`. Use this tree, not `.agents/skills/`.
- The leaf owns invocation, options, procedure, and terminals; routers own order.
- Keep every-run instructions inline. Disclose branch-only material through a
  pointer naming both the condition and the required action. No read-first gate.
- Preserve behavior when pruning. Remove a guardrail only with behavioral evidence.

## Description triggers

The frontmatter field stays named `description`. State the situations that
should activate this skill, in plain words a request would match. A person
uses that text to pick the skill. A model uses it too, unless the skill sets
`disable-model-invocation: true`.

Put the distinguishing word first. Give each distinct request one trigger.
Use one wording for the synonyms of that request.
When a similar request belongs to a neighboring skill, name that skill.
Write normal sentences. Leave the procedure, the options, and the result
in the body. Omit identity that the body already explains, and omit a duplicate
When to use section.

## Before committing

Run `bash scripts/skill-guards.test.sh`, then check every touched skill:

1. Frontmatter `name` matches its directory, is kebab-case, and is at most 64 characters.
2. `description` exists, is at most 1024 characters, and follows
   Description triggers.
3. `SKILL.md` is at most 100 lines.
4. README has its `/<name>` Quickstart entry and Reference link.
5. Real `.md` links and backticked paths resolve; ignore `<placeholder>` paths.
6. Claude `plugins[0].skills` exactly matches the sorted skill-directory set.
7. Every non-router leaf has exactly one primary action playbook; all playbook
   leaves and participants resolve. Here the router exception is `prath-mode`.

When adding, renaming, or removing a skill, apply the README and playbook
maintenance procedure in `authoring/README.md`. When drafting or restructuring
agent-facing documents, apply its pointer, option, and ownership rules. For
behavior changes or compression, run the relevant cases in `authoring/verification.md`.

README describes whole-skill intent. Reread the full leaf before changing its
entries; procedural refinements alone do not require README changes.
