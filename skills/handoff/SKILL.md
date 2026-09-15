---
name: handoff
description: >
  handoff when saving resumable session state or continuing work from an
  existing handoff document.
---

# Handoff

## Options

Derive create versus resume, output path, and focus from the request.
Unspecified: Create at
`<anchor>/handoffs/handoff-<YYYY-MM-DD-HHmmss>.md`.
"resume <path>" → Resume that file. "save to <path>" → Create there.
Resume and a save path together is `BLOCKED`. A named path without a usable
value is `BLOCKED`. Resolve paths to absolute before use. A named focus in
the request is the live focus.

Resolve `<anchor>` as the absolute directory containing this `SKILL.md`.

## Create

1. Resolve and create the parent directory. Record:
   `create | output path | surveyed | redacted | written | terminal`.
   Done when the absolute output path is writable.
2. Select current facts, not a transcript. Keep at most eight open tasks and
   twelve artifacts. Prefer the active plan, branch, PR, commits, dirty paths,
   blockers, and durable decisions. Mark superseded material.
   Done when each retained fact helps the next agent act.
3. Read `./REFERENCE.md`. Draft in memory, point to absolute artifact paths,
   and never paste full diffs, plans, logs, or terminal output. Put a live
   focus first. Include any active mode or workflow ledger.
4. Redact credentials, tokens, passwords, private keys, authenticated URLs,
   email addresses, and environment values. Scan twice, enforce the 12 KB bound,
   write to a sibling temporary file, then rename atomically. Scan the final
   file once more.
   Done when required sections, bounds, and all three scans pass.
5. Report the path, what was captured, and that a later handoff should resume
   from that absolute path.
   Success is the existing file plus the reported resume path.

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
3. Apply a live focus over the saved focus. Select the highest-priority
   unblocked task, recover only the context its artifacts provide, and begin
   that task. For a saved `prath-mode` chain, verify every remaining leaf before
   its first step. For `orchestrate`, treat the saved ledger as a pointer, then
   rebuild it from diffs, task results, and tests and refresh the roster before
   work. If no task remains, report `BLOCKED` with validation evidence. Do not
   stop after summary.
   Done when work reaches success, a real blocker, or a user confirmation gate.
4. Report reconciled drift and the work outcome. Do not create another handoff
   unless the user explicitly asks.

Terminal values are `SUCCESS`, `BLOCKED`, `AWAITING_USER`, and `INTERRUPTED`.
Record one with evidence before stopping.

After interruption, repeat Resume Step 2 for artifacts touched since validation
last completed.
