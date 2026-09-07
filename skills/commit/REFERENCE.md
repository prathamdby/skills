# Commit reference

Load only the selected style section, then run the shared rejection check.
Load Trailer hygiene only during Step 4 verify, or when drafting under
`--allow-trailers` / an explicit user trailer request.

## `--conventional` formatting rules

- Format: `type: description`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`
- Pick the type that describes most changed lines. Use `chore` only when no
  more specific type fits.
- No scope notation.
- Subject: at most 50 characters, lowercase except names and technical terms,
  imperative, no trailing period. This lowercase description is an intentional
  override of Beams/Pope "capitalize the subject": this repo requires
  `type: lowercase description` and forbids a scope field.
- Imperative test on the text after `type: `: "If applied, this commit will
  <description>" must be a grammatical sentence. Reject "fixed", "fixes",
  or "adding".
- Optional body: one to five `- ` bullets in one body argument, no blank lines
  or trailing periods. Include only material diff details not in the subject.
  Capitalize the first letter of every bullet. Do not copy subject lowercase
  onto body bullets.
- Subject is the first `-m`. Optional body is the second `-m`. That pair is
  the required Pope/Beams blank line. Never join them into one `-m`.
- Wrap every body line at 72 characters. 72 counts every character on the
  line, including `- `, the hanging indent, and path or code literals.
  Continue a wrapped `- ` bullet with a hanging indent of two spaces.
  Before (77, reject):
  `- Add webhook parser tests under skills/commit/REFERENCE.md for the wrap gate`
  After (72, then a two-space hanging indent):

```
- Add webhook parser tests under skills/commit/REFERENCE.md for the wrap
  gate
```

- Body states what changed and why the proving hunks exist, not how the code
  works. The diff shows how. Use only facts the locked diff proves. Do not
  add ticket, review, or session motives.

## `--simple` formatting rules

- One line, no type prefix or body, at most 72 characters.
- Capitalize the first word; use sentence case; no trailing period.
  Pope/Beams capitalization applies here.
- Imperative test: "If applied, this commit will <subject>" must be a
  grammatical sentence.

## Shared rejection check

Reject and rewrite a draft containing:

- ticket IDs, reviewer names, review or plan language, or unstated motives
- review-session framing such as `address review feedback`, `address review
  findings`, `address PR feedback`, `review follow-up`, or `per review`
- a claim inferred from the branch name, commit history, or conversation
- scope notation such as `feat(api):`
- a vague verb such as update, change, address, or improve when a hunk supports
  a concrete action
- an untraced subject or body line
- a conventional body bullet whose first letter is lowercase
- too many message arguments, embedded blank-line bodies, HEREDOC, or `-F`
- an unwrapped body line over 72 characters
- a conventional body that only restates how the diff works and states no
  what or why the hunks prove
- hook behavior that disagrees with `--verify`
- banned identity or harness trailer lines (`Co-authored-by:`, `Signed-off-by:`,
  `Made-with:`) or freeform harness footers (`Made with Cursor`, Claude
  marketing lines) unless allow-trailers is on

## Trailer hygiene

Banned trailer keys (case-insensitive): `Co-authored-by`, `Signed-off-by`,
`Made-with`.

Banned freeform harness lines (case-insensitive substring match on a whole
line): `Made with Cursor`, `Generated with Claude`, `Generated with Claude
Code`.

Detect: scan `git log -1 --format=%B` for lines matching banned keys in git
trailer form `Key: value`, or a banned freeform harness line.

When trailers are denied, or when allow-trailers is on but `%B` contains a
banned key or freeform harness line the user did not request:

1. Confirm this run created `HEAD`, it is not on the remote, and no later
   commit landed. Otherwise `BLOCKED`.
2. Amend once with the exact ledger subject and optional body, using the same
   `-n` / `--verify` policy as the original commit, and no trailer `-m` args.
   Replace the full message from the ledger; do not use `git interpret-trailers`
   to add or edit trailers.
3. Re-read `%B`. Any remaining banned (or unexpected) trailer or harness line
   is `BLOCKED`; report the SHA and the leftover lines.

Under allow-trailers, keep only trailers the user requested for this run.
Report whether a trailer amend ran.

Provenance (principles only; do not copy the STE dictionary):
https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html
https://cbea.ms/git-commit/
https://www.asd-ste100.org/STE_faq.html
https://developers.google.com/style
