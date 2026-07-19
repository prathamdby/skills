# Commit reference

Load only the selected style section, then run the shared rejection check.

## `--conventional` formatting rules

- Format: `type: description`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`
- Pick the type that describes most changed lines. Use `chore` only when no
  more specific type fits.
- No scope notation.
- Subject: at most 50 characters, lowercase except names and technical terms,
  imperative, no trailing period.
- Optional body: one to five `- ` bullets in one body argument, no blank lines
  or trailing periods. Include only material diff details not in the subject.

## `--simple` formatting rules

- One line, no type prefix or body, at most 72 characters.
- Capitalize the first word; use sentence case; no trailing period.

## Shared rejection check

Reject and rewrite a draft containing:

- ticket IDs, reviewer names, review or plan language, or unstated motives
- a claim inferred from the branch name, commit history, or conversation
- scope notation such as `feat(api):`
- a vague verb such as update, change, address, or improve when a hunk supports
  a concrete action
- an untraced subject or body line
- too many message arguments, embedded blank-line bodies, HEREDOC, or `-F`
- hook behavior that disagrees with `--verify`
