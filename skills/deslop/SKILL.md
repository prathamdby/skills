---
name: deslop
description: deslop when removing AI-generated bloat, needless defenses, foreign patterns, or avoidable complexity from a git diff without changing behavior.
---

# Deslop

Clean one diff before it ships. By default, look at the staged diff. The user can ask for the unstaged diff or a branch diff instead. Work only inside that diff and leave everything else alone.

Read the changed files and a little of the code around them. Remove what the codebase does not need: comments that restate the code, error handling for cases that cannot happen, wrappers and abstractions with one caller, and patterns that match no nearby code. Keep the smallest edit that does the job and match the style of the surrounding file.

Do not change what the code does. Keep the logic, the errors, and the public API the same. When you are unsure about an edit, skip it. If you touched code that can run, run the tests that cover it. If you touched only comments or whitespace, reading the final diff is enough. Do not commit.
