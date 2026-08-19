---
name: commit
description: commit when saving scoped git changes with a message derived only from the committed diff, especially after tickets or reviews could bias the wording.
---

# Commit

Commit the changes for the current task. By default, commit what is already staged. If the user asks for unstaged work, stage those tracked files first and leave untracked files alone.

Read the diff and write the message from what the diff does. Ticket text, reviewer comments, and plans stay out of the message. Use the conventional format, for example `feat: add search` or `fix: stop duplicate retries`, unless the user asks for a plain subject. Every line of the message must be proved by a hunk in the diff.

Use one `git commit -m` for the subject and at most one more `-m` for the body. Do not add `Co-authored-by`, `Signed-off-by`, or tool credit lines unless the user asks. Never amend a pushed commit, never force push, and never push at all from this skill.
