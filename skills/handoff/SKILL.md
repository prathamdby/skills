---
name: handoff
description: >
  Compact the current conversation into a handoff document so a fresh agent
  can continue the work, or restore context from a previously saved handoff.
  Use when the user types /handoff, wants to save session context, hand off
  to a new agent, or resume from a handoff file. Supports --resume <path>,
  --path <path>, and a positional focus argument.
---

# Handoff

## When to use this skill

Activate when the user types `/handoff`, asks to save session context, hand off
to a new agent, or resume from a previously saved handoff document.

## Flag detection

| Flag / Arg        | Effect                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `--resume <path>` | Load an existing handoff doc and restore its context. No new doc is written.                          |
| `--path <path>`   | Save the new handoff doc to `<path>` instead of the default handoffs dir.                             |
| Positional arg    | Description of what the next session will focus on. Tailors the new doc or narrows a resumed session. |

**Defaults:** If no flags are provided, create a new handoff document in the
default handoffs directory.

`--resume` and `--path` are mutually exclusive. If both are passed, stop and
report: "`--resume` and `--path` are mutually exclusive. Use `--resume` to load
an existing handoff, or `--path` to save a new one."

If `--resume` or `--path` is passed without a path argument, stop and ask for
the missing path.

## Handoffs directory

Default save location is inside this skill's directory:

- Handoffs root: `./handoffs/`
- File naming: `./handoffs/handoff-<YYYY-MM-DD-HHmmss>.md`

`--path <path>` overrides this entirely.

## Step 0: Read REFERENCE.md (mandatory)

**Do not proceed to Workflow A, Workflow B, or any later step until you have read `REFERENCE.md` in full.**

1. Use the Read tool on `./REFERENCE.md` in this skill's directory (same folder as this file).
2. Treat every document format rule and example in that file as binding for this session.
3. If you have not read it yet, stop and read it now. Skipping this step causes malformed handoff documents.

## Workflow A: Create handoff (default)

Run when `--resume` is not passed.

1. Determine the save path. Use `--path <path>` when provided; otherwise use
   `<anchor>/handoffs/handoff-<timestamp>.md`.
2. Create `./handoffs/` if the default directory does not exist.
3. Survey existing artifacts from the workspace or conversation: plans, PRDs,
   ADRs, issues, PRs, commits, and diffs. Reference them by path or URL.
4. Write the handoff document using the format in `./REFERENCE.md`. Keep it
   compact enough for a fresh agent to read in under two minutes.
5. Redact API keys, tokens, passwords, and personally identifiable information.
6. If a positional argument was passed, add `## Next session focus` at the top
   and tailor open tasks and suggested skills around that focus.
7. Report the full save path, one-line capture summary, and resume command:
   `/handoff --resume <path>`.

## Workflow B: Resume from handoff (`--resume`)

Run when `--resume <path>` is passed.

1. Read the file at `<path>`. If it does not exist, stop and report:
   "Handoff file not found at `<path>`."
2. Summarize context, progress, key decisions, prioritized open tasks, and
   blockers for the user.
3. If a positional argument was also passed, treat it as the narrowed focus for
   this resumed session.
4. Read `## Suggested skills` from the document. List each skill with its
   rationale and offer to invoke the relevant ones for the current focus.
5. Continue from the open tasks. Reference artifacts by path or URL instead of
   re-deriving captured content.

## Constraints

- Never duplicate content already captured in artifacts. Reference by path or URL.
- Redact sensitive information before saving.
- When resuming, do not write a new handoff unless the user explicitly asks.
- Never skip Step 0. REFERENCE.md holds the handoff document format and examples this skill depends on.
