# Handoff reference

Load this file while creating a handoff. On resume, load only Redaction before
opening referenced artifacts.

## Document contract

- Keep the file at or below 12 KB.
- Use one to five bullets per section.
- Keep no more than eight open tasks and twelve artifacts.
- Omit empty optional sections.
- Point to source material instead of copying it.

```markdown
# Handoff: <short title>

## Next session focus
<Only when the user supplied a focus. One concrete outcome.>

## Context
- <repo root, branch, task, and current scope>

## Progress
- <verified result with commit, PR, or file pointer>

## Decisions
- <durable choice and short reason>

## Open tasks
1. <highest-priority unblocked task>

## Blockers
- <blocker and evidence>

## Working tree
- <staged, unstaged, and untracked paths that matter>

## Suggested skills
- `<installed-name>`: <why the next task needs it>

## Artifacts
| Type | Path or URL | Status |
|---|---|---|
| <type> | <pointer> | current, moved, missing, or superseded |
```

## Selection rules

- Progress contains verified outcomes, not activity.
- Decisions exclude obvious, reversible, or speculative choices.
- Open tasks exclude completed and stale todos. Name dependencies.
- Artifacts include the active plan, PR or issue, branch, useful commits,
  changed files, and required config. Do not list every file.
- Suggested skills must exist under the installed `skills/` root containing
  this skill. Common choices are `peer-review`, `deslop`, `commit`, `make-pr`,
  `fix-pr`, `recon`, `box`, `assign`, `orchestrate`, and `explain-diff`.
- A live positional focus overrides a focus saved in the document.

## Redaction

Replace the value while preserving enough context to resume:

| Sensitive value | Replacement |
|---|---|
| API key, token, cookie, bearer value | `[REDACTED: token]` |
| Password or connection-string credential | `[REDACTED: password]` |
| Private key or certificate body | `[REDACTED: private-key]` |
| Email address or user PII | `[REDACTED: pii]` |
| Authenticated or private URL | `[REDACTED: url]` |
| Environment variable value | `<NAME>=[REDACTED]` |

Never weaken redaction to make a command copyable. Record the variable name,
command shape, exit code, or artifact path instead.
