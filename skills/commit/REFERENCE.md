# Commit Skill Reference

## `-n` / `--no-verify` (mandatory)

Every commit must skip hooks. The command always includes `-n`:

```bash
git commit -n -m "<message>"
```

Agents often omit `-n` and let pre-commit hooks run or fail. That violates this
skill. If you did not pass `-n`, you did not complete Step 4.

## Diff-only message rule

The commit message describes **what changed in the diff**, not the surrounding
session.

**Do not write:**

- "Address review feedback"
- "Fix issues raised in discussion"
- "Implement the agreed plan"
- "Update per user request"

**Write the concrete change instead.**

| Diff shows                           | Bad                             | Good                                  |
| ------------------------------------ | ------------------------------- | ------------------------------------- |
| Null check added in `userService.ts` | fix: address review feedback    | fix: guard null user in getProfile    |
| README install steps rewritten       | docs: update per discussion     | docs: add pnpm install steps          |
| Extract helper from handler          | refactor: implement agreed plan | refactor: extract parsePayload helper |

## `--conventional` formatting rules

- **Format:** `type: description`
- **Allowed types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`
- **No scope notation** (e.g., no `feat(scope):` — just `feat:`)
- **First line:**
  - Maximum 50 characters
  - All lowercase except proper nouns and technical terms
    (e.g., OAuth, React, PostgreSQL, API, CLI, HTML, CSS, JSON, URL, HTTP)
  - No period at the end
- **Mandatory blank line** after the first line
- **Body (if needed):**
  - Use only when the change requires explanation beyond the first line
  - Bullet points starting with `-`
  - No blank lines between bullets
  - Capitalize the first word of each bullet
  - No periods at the end of bullets
  - Explain _what_ changed and _why_, not _how_

Example:

```
feat: add user authentication flow

- Implement OAuth 2.0 login with Google and GitHub
- Add JWT token handling for session management
- Update login UI to match new design system
```

## `--simple` formatting rules

Generate a concise plain-English commit message:

- Single line, no type prefix
- Maximum 72 characters
- Capitalize the **first word** of the first line; keep everything else lowercase except proper nouns and technical terms
- No period at the end
- Describe what changed in plain language

Examples:

- "Add dark mode toggle to settings page"
- "Fix null pointer exception in user service"
- "Update README with install instructions"

## Example report

```
Commit complete.

Scope: staged
Style: conventional
Hooks: skipped (-n)

Command:
git commit -n -m "feat: add password reset endpoint"

Message:
```

```
feat: add password reset endpoint

- Implement token-based reset flow
- Add email template for reset notifications
- Update user model with reset token fields
```
