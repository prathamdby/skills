---
name: make-pr
description: make-pr when publishing committed branch changes as a new pull request or updating the existing pull request for that branch.
---

# Make PR

Publish the current branch as a pull request. Start only when the tree is clean and the branch is not behind or diverged from its remote. Target `main` unless the user names another base.

Write the title and body from the diff against the target branch alone. The title is one short imperative sentence. The body says what changed and why, grouped by theme, with no claims the diff cannot prove. Never invent a ticket number. Use one only when the user gives it.

Push with a normal push, never a force push. If the branch already has an open PR, update its title and body and leave the reviewers, labels, and draft state alone. Then read the PR back and make sure it shows what you wrote. Report the URL. Do not commit, run tests, or reopen closed PRs from this skill.
