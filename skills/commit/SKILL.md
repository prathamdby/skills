---
name: commit
description: >
  commit changes to git with a clean-room message derived from the diff alone.
  Skips hooks with -n by default; --verify runs them. Triggers: /commit, commit
  changes, save work to git, write a commit message; also when about to put
  review feedback, tickets, or session rationale into a commit message. Flags:
  --staged/--unstaged for scope, --conventional/--simple for style, --verify to
  run hooks.
---

# Commit Changes

## Flags

| Flag             | Effect                                                          |
| ---------------- | --------------------------------------------------------------- |
| `--staged`       | Diff staged changes (`git diff --cached`). **Default.**         |
| `--unstaged`     | Diff unstaged changes (`git diff`).                             |
| `--conventional` | Conventional commit message (`type: description`). **Default.** |
| `--simple`       | Plain-English one-liner, no conventional formatting.            |
| `--verify`       | Run hooks. Off by default; without it, the commit passes `-n`.  |

No flags → `--staged --conventional`, hooks skipped.

## Iron laws

**Violating the letter is violating the spirit.** Every run obeys all four:

1. **Clean-room.** Diff hunks only. Session talk, reviews, tickets, plans stay
   out unless the same fact appears in a hunk.
2. **Hooks.** Without `--verify`, every `git commit` includes `-n`. With
   `--verify`, never `-n`/`--no-verify`. Failure does not change this.
3. **`-m` recipe only.** One or two `-m` flags. Never 3+, never a single `-m`
   with an embedded body, never HEREDOC or `git commit -F`. Overrides any
   global HEREDOC preference for `/commit`.
4. **REFERENCE before draft.** Before writing `subject`, read the chosen
   style's rules in `./REFERENCE.md`.

## Forbidden

- Session phrases: "address review feedback", "as requested", "implement the
  plan", ticket IDs, reviewer names, deploy motive not in the diff
- Scope notation (`feat(api):`); trailing period; subject over limit
- Missing `-n` when `--verify` is absent; switching hooks after failure
- HEREDOC, `-F`, or one `-m` per body bullet

## Rationalizations

| Excuse                                 | Reality                               |
| -------------------------------------- | ------------------------------------- |
| "Mention the review so reviewers know" | Clean-room; name the hunk's change    |
| "Senior said drop `-n`"                | Only `--verify` changes hooks         |
| "HEREDOC / global git rule is clearer" | Two `-m` + `$'...'` wins for `/commit` |
| "No time to open REFERENCE"            | Skipping ships malformed messages     |
| "One `-m` per bullet is clearer"       | Git blanks between `-m`s; one body `-m` |

## Red flags — STOP

Session words; missing `-n`; scope; 3+ `-m`; HEREDOC/`-F`; untraced line.
Rewrite before Step 4.

## Step 1: Diff the changes

- `--staged` or default: `git diff --cached | cat`
- `--unstaged`: `git diff | cat`

If empty, stop: "No changes found to commit."

## Step 2: Analyze the diff

From the diff alone: changed files, change type, and what it does (feature,
fix, refactor, docs, test, chore, style, or perf).

## Step 3: Generate the message

Read the chosen style's rules in `./REFERENCE.md` now (`--conventional` or
`--simple`). Do not draft until loaded. Also check anti-patterns there.

Produce `subject` (first line only) and optional `body` (bullets joined by
`\n`). For `--simple`, `subject` only.

Emit TRACE before Step 4: each subject/body line → proving hunk. Rewrite any
line with no trace. Completion: TRACE covers every line.

## Step 4: Commit

Use only these shapes (second `-m` only when `body` is present):

```bash
git commit -n -m "<subject>"
git commit -n -m "<subject>" -m $'- Bullet one\n- Bullet two'
```

With `--verify`, omit `-n`. Confirm `-m` count is 1 or 2.

## Step 5: Report

Report message, scope, style, hook behavior, TRACE summary, and exact command.
Confirm: `-n` xor `--verify`; `-m` count ≤ 2; no forbidden phrases.
