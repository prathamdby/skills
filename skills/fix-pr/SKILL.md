---
name: fix-pr
description: fix-pr when exhaustively handling open pull-request feedback, including nested discussions, CI, invalid suggestions, arrivals, fixes, and replies. Loads gh for hunt and reply I/O.
---

# Fix PR

Handle every open piece of feedback on a pull request. First check out the PR branch and sync it with the remote. Never reset hard or discard local work.

Read all the feedback before you change any code. That means every unresolved review thread, every page of comments, the top-level reviews, and the CI failures on the latest commit. Use the gh skill for all GitHub reads and writes. Do not start fixing while pages are still unread.

Give each finding one verdict: fix, reject, clarify, or already fixed. Check each claim against the real code and keep the evidence. When every finding has a verdict, make the fixes and run the tests that cover them. Commit with a message that names the concrete change, never `fix: address review feedback`, then push. Never force push.

Hunt again after each push, because new comments can arrive. Reply to every thread that needs an answer, and say no politely with evidence when a suggestion is wrong. Never resolve threads yourself. Report the verdict and the evidence for each finding.
