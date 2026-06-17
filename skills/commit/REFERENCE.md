# Commit Skill Reference

Per-style message format. Reached from Step 3 for the chosen style.

## `--conventional` formatting rules

- **Format:** `type: description`
- **Allowed types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`
- **No scope notation** (no `feat(scope):` — just `feat:`)
- **First line:** max 50 chars; lowercase except proper nouns and technical
  terms (OAuth, React, PostgreSQL, API, CLI, HTML, CSS, JSON, URL, HTTP); no
  trailing period
- **Body (if needed):** bullets starting with `-`; no blank lines between
  bullets; capitalize the first word of each; no trailing periods; explain
  _what_ and _why_, not _how_

```
feat: add user authentication flow

- Implement OAuth 2.0 login with Google and GitHub
- Add JWT token handling for session management
```

## `--simple` formatting rules

- Single line, no type prefix, max 72 chars
- Capitalize the first word; rest lowercase except proper nouns and technical terms
- No trailing period

Examples:

- "Add dark mode toggle to settings page"
- "Fix null pointer exception in user service"

## Concrete-change examples (diff-only)

| Diff shows                           | Bad                             | Good                                  |
| ------------------------------------ | ------------------------------- | ------------------------------------- |
| Null check added in `userService.ts` | fix: address review feedback    | fix: guard null user in getProfile    |
| README install steps rewritten       | docs: update per discussion     | docs: add pnpm install steps          |
| Extract helper from handler          | refactor: implement agreed plan | refactor: extract parsePayload helper |
