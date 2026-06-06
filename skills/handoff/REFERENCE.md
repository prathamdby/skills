# Handoff Skill Reference

## Document format

Write handoff documents in markdown. Use only the sections that apply. Keep
each section to 1-5 bullet points or short paragraphs.

```markdown
# Handoff: <short title>

## Next session focus

<Present only when the user passed a positional argument. One paragraph describing
what the next session should prioritize.>

## Context

<What problem, codebase, branch, or feature was being worked on. Include
workspace path if relevant.>

## Progress

<What was completed in this session. Reference commits, PRs, and plans by path
or URL — do not paste diffs or full plan text.>

## Decisions

<Key choices made and why. Skip obvious or reversible choices.>

## Open tasks

1. <Highest-priority task>
2. <Next task>

## Blockers

<Unresolved issues, missing info, or external dependencies. Omit section if none.>

## Suggested skills

- `<skill-name>` — <one-line rationale for why the next agent should invoke it>
- `<skill-name>` — <one-line rationale>

## Artifacts

| Artifact | Path or URL   |
| -------- | ------------- |
| <type>   | <path or URL> |
```

## Section rules

### Next session focus

- Only include when the user passed a positional argument during `/handoff`.
- Frame open tasks and suggested skills around this focus.
- When resuming with a new positional arg, the live session focus overrides
  this section.

### Progress

Reference, do not duplicate:

- Commit SHAs: `abc1234` with branch name
- Plan files: `.cursor/plans/foo.plan.md`
- PRs: URL or `gh pr view` link
- Issues: Linear/Jira URL or ticket ID

### Suggested skills

Pick skills the next agent should load early based on the remaining work.
Examples:

- `commit` — changes are staged and ready to commit
- `make-pr` — branch work is complete, needs a PR
- `peer-review` — plan exists but was not reviewed
- `fix-linear-ticket` — work maps to a Linear ticket
- `deslop` — implementation is done but diff needs cleanup

Use installed skill names exactly as they appear in frontmatter.

### Artifacts

List every external artifact the next agent will need. Common types:

- Plan, ADR, PRD, PR, issue, branch, commit range, config file

## Redaction

Replace sensitive values before saving:

| Type                    | Replacement            |
| ----------------------- | ---------------------- |
| API keys / tokens       | `[REDACTED: api-key]`  |
| Passwords               | `[REDACTED: password]` |
| Email addresses         | `[REDACTED: email]`    |
| Internal URLs with auth | `[REDACTED: url]`      |

## Example (abbreviated)

```markdown
# Handoff: Add auth middleware

## Next session focus

Wire the new auth middleware into the remaining API routes and add integration
tests.

## Context

Working on `acme-api` on branch `pd/feat/auth-middleware`. Adding JWT
validation to protected routes.

## Progress

- Implemented `AuthMiddleware` in `src/middleware/auth.ts`
- Added unit tests for token validation
- Plan confirmed: see `.cursor/plans/auth-middleware.plan.md`

## Decisions

- Use existing `jose` library instead of adding `jsonwebtoken` (already in deps)
- Middleware returns 401, not 403, for missing tokens

## Open tasks

1. Apply middleware to `/api/v1/*` routes in `src/routes/`
2. Add integration tests in `tests/integration/auth.test.ts`
3. Update API docs

## Suggested skills

- `peer-review` — review the route integration plan before applying
- `commit` — commit middleware changes after tests pass
- `make-pr` — open PR once integration tests are green

## Artifacts

| Artifact   | Path or URL                             |
| ---------- | --------------------------------------- |
| Plan       | `.cursor/plans/auth-middleware.plan.md` |
| Branch     | `pd/feat/auth-middleware`               |
| Middleware | `src/middleware/auth.ts`                |
```

## Resume behavior

When `/handoff --resume <path>` is invoked:

1. Parse all sections from the document.
2. Present a brief restoration summary to the user.
3. If a positional arg was passed, state the narrowed focus explicitly.
4. Offer to invoke skills listed under `## Suggested skills`.
5. Start on the highest-priority open task unless the user redirects.
