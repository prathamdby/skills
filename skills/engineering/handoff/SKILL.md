---
name: handoff
description: >
  handoff to save resumable context or continue from a validated handoff document.
---

# Handoff

## Route and privacy

Default create: `<anchor>/handoffs/handoff-<YYYY-MM-DD-HHmmss>.md`, with anchor
this skill's absolute directory. "Save to <path>" selects create there;
"resume <path>" selects resume. Both together, missing values, or malformed
required Context/Open tasks block. Resolve all paths absolutely.
A named live focus overrides the saved one.

Redact tokens/cookies, keys, passwords/connection credentials, private or
authenticated URLs, emails/PII, certificates, and environment values.
Use `[REDACTED: token]`, `[REDACTED: password]`, `[REDACTED: private-key]`,
`[REDACTED: pii]`, or `[REDACTED: url]` for those values.
Environment values become `NAME=[REDACTED]`. Preserve variable names, command
shapes, exit codes, and artifact pointers, not sensitive values.
Never weaken redaction to make a command copyable.
No full diffs/plans/logs/transcripts.
The bound is 12 KB, eight open tasks, twelve artifacts; one to five bullets
per section, omitting empty optional sections.

## Create

1. Resolve a writable path/parent. Record
   `create | path | facts | redaction | written | terminal`.
   Done when output can be written.
2. Select actionable current facts: plan, branch/PR/commits, dirty paths,
   blockers, durable decisions; mark superseded material. Apply
   `references/create.md` to draft required sections and workflow state.
   Done when each fact helps the next agent act.
3. Scan draft twice for sensitive values, validate bounds/sections, atomically
   replace through a sibling temporary file, then scan the final file.
   Done when structure, bounds, three scans, and existing file pass.
4. Report path, captured scope, and `resume the handoff at <absolute-path>`.
   Done when file and resume instruction exist.

## Resume

1. Resolve/read; absent → BLOCKED with path. Record
   `resume | focus | artifact status | task | terminal`.
   Done when required Context/Open tasks are valid.
2. Apply `references/resume.md` to verify paths, branch/dirty state, commits,
   PRs, and installed skills; classify current/moved/missing/superseded.
   Redact while reading referenced artifacts. Done when stale facts cannot act.
3. Choose highest-priority unblocked task under live focus and begin it,
   recovering only its artifact context. No task → evidenced BLOCKED, not
   another summary. Done at success, a real blocker, or confirmation gate.
4. Report drift and work outcome. Create no new handoff unless requested.

Terminals: SUCCESS, BLOCKED, AWAITING_USER, INTERRUPTED, with evidence.
On interruption revalidate artifacts touched since the last validation.
