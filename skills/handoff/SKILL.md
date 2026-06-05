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

After activation, inspect the user's message for the following flags:

| Flag / Arg | Effect |
| --- | --- |
| `--resume <path>` | Load an existing handoff doc and restore its context. No new doc is written. |
| `--path <path>` | Save the new handoff doc to `<path>` instead of the default handoffs dir. |
| Positional arg | Description of what the next session will focus on. Tailors the new doc or narrows a resumed session. |

**Defaults:** If no flags are provided, create a new handoff document in the
default handoffs directory.

**Mutual exclusivity:** `--resume` and `--path` cannot be combined. If both are
passed, stop and report:
"`--resume` and `--path` are mutually exclusive. Use `--resume` to load an
existing handoff, or `--path` to save a new one."

If `--resume` or `--path` is passed without a path argument, stop and ask for
the missing path.

## Handoffs directory

Default save location is inside the skill's own directory. Treat the directory
containing `SKILL.md` as the anchor (same pattern as `box`'s `./sandbox/`):

- Handoffs root: `./handoffs/`
- File naming: `./handoffs/handoff-<YYYY-MM-DD-HHmmss>.md`

`--path <path>` overrides this entirely.

## Workflow A: Create handoff (default)

Run when `--resume` is **not** passed.

### Step 1: Determine save path

- If `--path <path>` was passed: use that path.
- Otherwise: use `<anchor>/handoffs/handoff-<timestamp>.md`.

Create `./handoffs/` if it does not exist.

### Step 2: Survey existing artifacts

Before writing, identify artifacts already in the workspace or linked from the
conversation:

- Plans, PRDs, ADRs, issues, open PRs, commits, diffs

Reference these by path or URL. Do not copy their content into the handoff.

### Step 3: Write the handoff document

Write the document using the format in REFERENCE.md. Keep it compact — a fresh
agent should get oriented in under two minutes of reading.

### Step 4: Redact sensitive information

Remove or replace:

- API keys, tokens, passwords
- Personally identifiable information

Use `[REDACTED]` placeholders where needed.

### Step 5: Tailor to next session focus

If a positional argument was passed, add a `## Next session focus` section at
the top of the document. Frame open tasks and suggested skills around that
focus.

### Step 6: Report

Tell the user:

1. The full save path
2. A one-line summary of what was captured
3. How to resume: `/handoff --resume <path>`

## Workflow B: Resume from handoff (`--resume`)

Run when `--resume <path>` is passed.

### Step 1: Read the handoff document

Read the file at `<path>`. If it does not exist, stop and report:
"Handoff file not found at `<path>`."

### Step 2: Restore context

Summarize for the user:

- Context and progress
- Key decisions
- Open tasks (prioritized)
- Blockers

Do not write a new handoff document.

### Step 3: Apply narrowed focus

If a positional argument was also passed, treat it as the narrowed focus for
this resumed session. Override or refine the doc's "Next session focus" with
the new intent.

### Step 4: Suggest skills

Read the `## Suggested skills` section from the doc. List each skill with its
rationale and offer to invoke the relevant ones for the current focus.

### Step 5: Continue work

Pick up from the open tasks. Reference artifacts by path or URL instead of
re-deriving content already captured elsewhere.

## Constraints

- Never duplicate content already captured in artifacts. Reference by path or
  URL instead.
- Redact any sensitive information before saving.
- When resuming, do not write a new handoff unless the user explicitly asks.

See REFERENCE.md for the handoff document format and examples.
