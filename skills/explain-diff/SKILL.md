---
name: explain-diff
description: explain-diff when turning a git diff, branch, or pull request into a self-contained HTML teaching page.
---

# Explain diff

Turn a diff, branch, or pull request into one HTML page that teaches the change. By default, explain the diff against `main`. The user can pick a branch, a PR, or the staged or unstaged changes instead.

Group the changed files into a few themes. For each theme, explain what changed and why in plain language, and quote the hunks that prove it. Read the surrounding code before you make a claim about how the system works. If you cannot prove a claim from the diff or the code, cut it.

Write one HTML file with all its CSS and JavaScript inline so it works offline. Use these sections: background, intuition, code walkthrough, and a short quiz with answer feedback. Save the page outside the repository and report the path. Never commit the page, push it, or edit the PR.
