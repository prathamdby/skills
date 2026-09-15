# Commit reference

Load only the selected style section, then run the shared rejection check.
Load Trailer hygiene only during Step 4 verify, or when drafting under
allow-trailers / an explicit user trailer request.

## Conventional formatting rules

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

## Simple formatting rules

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
- hook behavior that disagrees with the recorded verify policy
- banned identity or harness trailer lines (`Co-authored-by:`, `Signed-off-by:`,
  `Made-with:`) or freeform harness footers (`Made with Cursor`, Claude
  marketing lines) unless allow-trailers is on

## Trailer hygiene

Banned trailer keys (case-insensitive): `Co-authored-by`, `Signed-off-by`,
`Made-with`.

Banned freeform harness lines (case-insensitive substring match on a whole
line): `Made with Cursor`, `Generated with Claude`, `Generated with Claude
Code`.

Many harness `commit-msg` and `prepare-commit-msg` hooks cannot be turned
off. They re-add these trailers after `-m` or `-n`. A clean draft is not a
clean `HEAD`. When trailers are denied (default), a Python or Node.js REPL
must inspect and strip after commit. Do not weaken allow-trailers
opt-in. A shell `sed`, `awk`, or `perl` one-liner is not the strip.

Detect: in a `python` or `node` REPL, run `git log -1 --format=%B` via
subprocess or `child_process` and scan that text for banned keys in git
trailer form `Key: value`, or a banned freeform harness line.

When trailers are denied, run this REPL path after every commit. When
allow-trailers is on, run the same path if `%B` contains a banned key or
freeform harness line the user did not request:

1. Open a `python` or `node` REPL. Read `HEAD` `%B` there and detect banned
   keys and freeform harness footers.
2. If dirty, confirm this run created `HEAD`, it is not on the remote, and
   no later commit landed. Otherwise `BLOCKED`.
3. If dirty, build the cleaned subject and optional body in the REPL from
   the ledger. Amend once with REPL-built argv: the same `-n` or verify
   policy as the original commit, one subject `-m` and at most one body
   `-m`, no HEREDOC, `-F`, editor, or trailer `-m` args. Do not use
   `git interpret-trailers` to add or edit trailers.
4. Re-read `%B` in the REPL. Any remaining banned or unexpected trailer or
   harness line is `BLOCKED`. Report the SHA and the leftover lines.

Under allow-trailers, keep only trailers the user requested for this run.
Report whether a trailer amend ran.

| Excuse                            | Reality                                              |
| --------------------------------- | ---------------------------------------------------- |
| "I passed a clean `-m`"           | Hooks rewrite after `-m`. Read `%B` in the REPL.     |
| "I disabled the hook"             | Many harness hooks cannot be turned off. Use the REPL. |
| "A shell one-liner stripped it"   | The strip is the REPL. Re-read `%B` there.           |

Provenance (principles only; do not copy the STE dictionary):
https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html
https://cbea.ms/git-commit/
https://www.asd-ste100.org/STE_faq.html
https://developers.google.com/style
