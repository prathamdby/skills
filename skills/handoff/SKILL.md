---
name: handoff
description: >
  handoff the session, compact the conversation into a document a fresh agent
  can resume from, or restore context from a saved handoff. Triggers: /handoff,
  save session context, hand off to a new agent, resume from a handoff file.
  Flags: --resume <path>, --path <path>, and a positional focus argument.
---

# Handoff

## Flags

| Flag / Arg        | Effect                                                                        |
| ----------------- | ----------------------------------------------------------------------------- |
| `--resume <path>` | Load an existing handoff doc and restore context. Writes no new doc.          |
| `--path <path>`   | Save the new doc to `<path>` instead of the default handoffs dir.             |
| Positional arg    | What the next session should focus on. Tailors a new doc or narrows a resume. |

No flags → create a new handoff doc in the default dir.

`--resume` and `--path` are mutually exclusive; if both passed, stop: "`--resume`
and `--path` are mutually exclusive." If `--resume` or `--path` is passed without
a path, stop and ask for it.

## Handoffs directory

Default save location is inside this skill's directory (the anchor):

- Root: `./handoffs/`
- Naming: `./handoffs/handoff-<YYYY-MM-DD-HHmmss>.md`

`--path <path>` overrides this entirely.

## Workflow A: Create (default, no `--resume`)

1. Resolve the save path: `--path` if given, else
   `<anchor>/handoffs/handoff-<timestamp>.md`. Create `./handoffs/` if absent.
2. Survey artifacts from the workspace and conversation, plans, PRDs, ADRs,
   issues, PRs, commits, diffs. You will reference them by path or URL, never
   paste their contents.
3. Write the doc using the format in `./REFERENCE.md`. Keep it readable by a
   fresh agent in under two minutes.
4. Redact API keys, tokens, passwords, and PII.
5. If a positional arg was passed, add `## Next session focus` at the top and
   frame open tasks and suggested skills around it.
6. Report the save path, a one-line capture summary, and the resume command:
   `/handoff --resume <path>`.

## Workflow B: Resume (`--resume <path>`)

1. Read the file. If absent, stop: "Handoff file not found at `<path>`."
2. Summarize context, progress, key decisions, prioritized open tasks, and
   blockers for the user.
3. If a positional arg was also passed, treat it as the narrowed focus.
4. From `## Suggested skills`, list each skill with its rationale and offer to
   invoke the ones relevant to the focus.
5. Continue from the open tasks, referencing artifacts by path or URL rather
   than re-deriving captured content.

## Constraints

- Redact sensitive values before saving.
- When resuming, never write a new handoff unless the user explicitly asks.
