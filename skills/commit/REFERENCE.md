# Commit Skill Reference

Per-style message format and anti-patterns. Reached from Step 3 for the chosen
style, and again when checking the draft against anti-patterns.

## `--conventional` formatting rules

- **Format:** `type: description`
- **Allowed types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`
- **No scope notation** (no `feat(scope):`, just `feat:`)
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

## Trace examples (clean-room)

Each message names the change its hunk proves, nothing more.

| Diff shows                           | Message                               |
| ------------------------------------ | ------------------------------------- |
| Null check added in `userService.ts` | fix: guard null user in getProfile    |
| README install steps rewritten       | docs: add pnpm install steps          |
| Extract helper from handler          | refactor: extract parsePayload helper |

## Anti-patterns (reject and rewrite)

| Bad draft / command | Why it fails | Rewrite toward |
| --- | --- | --- |
| `fix: address Sarah's review feedback` | Session / reviewer, not in diff | Name the concrete code change |
| `fix: implement ABC-99 auth plan` | Ticket / plan, not in diff | Name the hunk (e.g. null guard) |
| `feat(api): add rate limiting middleware` | Scope notation forbidden | `feat: add rate limiting middleware` |
| `refactor: extract helper.` | Trailing period; vague | `refactor: extract parsePayload helper` |
| Subject > 50 chars (conventional) | Over limit | Shorten; move detail to body |
| Three or more `-m` flags | Blank line between every bullet | One subject `-m` + one body `-m` |
| Single `-m` with embedded `\n\n` body | Body often dropped | Two `-m` flags |
| `git commit -F - <<EOF ...` / HEREDOC | Not this skill's recipe | Two `-m` + `$'...'` |
| `git commit -m "..."` without `-n` when no `--verify` | Hooks must be skipped | Add `-n` |
