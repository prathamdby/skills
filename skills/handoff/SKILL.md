---
name: handoff
description: >
  handoff when saving resumable session state or continuing work from an
  existing handoff document.
---

# Handoff

## Flags

| Flag or argument | Default | Effect |
|---|---|---|
| `--resume <path>` | off | Validate a saved handoff and continue its work |
| `--path <path>` | anchor path | Save a new handoff at this path |
| positional focus | none | Prioritize this focus during create or resume |

Resolve `<anchor>` as the absolute directory containing this `SKILL.md`.
Default saves use
`<anchor>/handoffs/handoff-<YYYY-MM-DD-HHmmss>.md`.
Resolve `--path` and `--resume` to absolute paths before use.

`--resume` and `--path` conflict. Stop if both appear or either lacks a value.
Without `--resume`, use Create.

## Create

1. Resolve and create the parent directory. Record:
   `create | output path | surveyed | redacted | written | terminal`.
   Done when the absolute output path is writable.
2. Select current facts, not a transcript. Keep at most eight open tasks and
   twelve artifacts. Prefer the active plan, branch, PR, commits, dirty paths,
   blockers, and durable decisions. Mark superseded material.
   Done when each retained fact helps the next agent act.
3. Read the create format and redaction rules in `./REFERENCE.md`, then write a
   file no larger than 12 KB. Point to artifacts; never paste full diffs, plans,
   logs, or terminal output. A positional focus goes first and controls task
   order.
   Done when all required sections exist and bounds hold.
4. Scan the finished text for credentials, tokens, passwords, private keys,
   authenticated URLs, email addresses, and copied environment values. Replace
   values with the reference's redaction markers.
   Done when a second scan finds no sensitive value.
5. Report the path, what was captured, and
   `/handoff --resume <absolute-path>`.
   Success is the existing file plus the reported resume command.

## Resume

1. Resolve and read the file. If absent, report
   `BLOCKED: handoff not found at <path>`.
   Record `resume | focus | validated artifacts | current task | terminal`.
   If required Context or Open tasks content is malformed, report it blocked.
2. Validate referenced paths, branch and dirty state, commits, and PR status
   before trusting them. Classify each as current, moved, missing, or
   superseded. Verify a suggested skill exists before invoking it. Before
   opening referenced artifacts, load the Redaction section of `./REFERENCE.md`
   and never repeat sensitive values.
   Done when stale facts cannot drive work.
3. Apply a positional focus over the saved focus. Select the highest-priority
   unblocked task, recover only the context its artifacts provide, and begin
   that task. If none remains, report `BLOCKED` with the validation evidence.
   Do not stop after summarizing the file.
   Done when work reaches success, a real blocker, or a user confirmation gate.
4. Report reconciled drift and the work outcome. Do not create another handoff
   unless the user explicitly asks.

Terminal values are `SUCCESS`, `BLOCKED`, `AWAITING_USER`, and `INTERRUPTED`.
Record one with evidence before stopping.

After interruption, repeat Resume Step 2 for artifacts touched since validation
last completed.
