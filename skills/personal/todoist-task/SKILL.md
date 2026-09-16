---
name: todoist-task
description: >
  todoist-task when creating or previewing Todoist tasks from natural-language
  requirements, including projects, subtasks, dates, and consistent wording.
---

# Todoist task

## Contract

Create tasks that stay clear without their originating conversation. Preserve
meaning, technical literals, links, and stated constraints. Redact secrets. Keep
descriptions concise and actionable, not technical specifications or plan
trackers. Do not invent requirements, metadata, or completion criteria.

Derive the project, parent, due date, priority, and whether to create or preview
from the user's natural-language request. Default to Inbox, no due date, `p4`,
and no parent when the user supplies none.

Record `request | title | project | parent | due | priority | missing | duplicate | created | verified | terminal`.

Terminals are `CREATED`, `PREVIEW`, `NEEDS_CONTEXT`, `DUPLICATE`, and `BLOCKED`.

## 1. Resolve

Use the Todoist connector. If unavailable or disconnected, report `BLOCKED`;
do not substitute another service.

Resolve relative dates with the user's Todoist timezone and configured week.
Treat ordinary "deadline" or "done by" wording as a due date. Use Todoist's
deadline feature only when explicitly requested and supported.

Resolve a named project exactly. Do not create a missing project unless the user
requested it. Resolve a parent from its URL, ID, or unique title. Subtasks receive
no due date unless the user supplies one or asks to inherit the parent's date.

Done when every supplied metadata field has one resolved value.
## 2. Require specificity

Apply the future-reader test: could the user identify and execute this task six months later without the conversation that created it?

Resolve unnamed references that block identification or execution. For repository
work, a repository link and any essential source link normally suffice. Do not require
or add file names, line references, branches, implementation steps, checklists, or
completion criteria unless supplied or needed to resolve genuine ambiguity.

If essential context is missing, ask one concise question listing the missing
items. Do not create the task in that turn. Resume after the answer without
requesting another confirmation. URLs, IDs, and unique names resolve references.
Record accepted vague wording.

Done when the task passes the test or the user accepts the named ambiguity.

## 3. Format

Write the title as `Action verb + specific deliverable + necessary qualifier`, in
sentence case with no trailing period. Aim for 4 to 10 words, but let specificity
override the length limit. Preserve exact technical names.

Write the description in natural language. Begin with a short sentence explaining
the intended result or context. For repository work, prefer a simple whole-task
description with the repository link and any essential source link. Use bullets only
for distinct user-supplied requirements. Do not turn it into a checklist or add
unrequested detail.

Do not impose headings such as `Objective`, `Requirements`, or `Done when`. Use
headings only when a long task contains separate areas of work. Clarify the
wording without making it formal, repetitive, or impersonal. Do not repeat
metadata or add work the user did not request.

Before create or preview, redact credentials, tokens, passwords, private keys,
authenticated URLs, email addresses, and environment values from the title and
description. Replace each with a placeholder such as `[REDACTED: token]`.

Done when the title identifies the work, the description reads naturally without
the original conversation, and redaction has run.

## 4. Check and create

Resolve the project and parent through read-only calls. Normalize a title by
trimming ends, collapsing internal whitespace to one space, and casefolding.
Search for an active task with the same project, parent, and normalized title.
If found, report `DUPLICATE` and do not create another.

If the user requested a preview, present the exact title, description, and
metadata, then stop with `PREVIEW`. Otherwise create the recorded task once. In
a batch, never retry successful items because another item failed.

Done when creation returns an ID or every failure is identified.

## 5. Verify

Fetch each created task and compare its title, description, project, parent, due
date, and priority with the recorded payload. A mismatch against that payload is
authorized: update the field once toward the recorded value. If it still differs,
report `BLOCKED` with the ID and exact difference.

Report the verified title, project, parent when present, and due date.
Done when every reported success matches Todoist.
