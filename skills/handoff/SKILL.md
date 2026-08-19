---
name: handoff
description: handoff when saving resumable session state or continuing work from an existing handoff document.
---

# Handoff

Save the state of the current task so a later session can pick it up. Write the handoff file next to this skill file, not inside the user's repository.

Write down the goal, what is done, what is left, and the files that matter, with absolute paths. Point to artifacts instead of pasting diffs, plans, or logs. Keep the file small. Remove every secret before you save: tokens, passwords, keys, and email addresses. Scan the file twice to be sure.

To resume, read the handoff first. Check that each path, branch, and PR it names still exists and still matches. Trust nothing stale. Then pick the most important open task and start working on it. Do not stop after a summary. Do not save a new handoff unless the user asks.
