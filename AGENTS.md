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

## Before committing

Run `bash scripts/skill-guards.test.sh`, then check every touched skill:

1. Frontmatter `name` matches its directory, is kebab-case, and is at most 64 characters.
2. `description` exists and is at most 1024 characters.
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
