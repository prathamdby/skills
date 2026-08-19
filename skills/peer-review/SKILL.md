---
name: peer-review
description: peer-review when deciding whether an implementation plan, design, or proposed change is ready to build.
---

# Peer review

Decide if a plan or a proposed change is ready to build. The user must point you to the plan and its requirements. Never review from memory.

Read the plan, the requirements, and the code and tests the plan touches. Check every requirement against what the plan says. Look for gaps, wrong assumptions, failure paths, and missing tests. List every finding that matters, worst first, with a citation for each. Do not stop at the first problem and do not pad the list with style nits.

End with one verdict. `Ship it.` when nothing material is wrong. `Fix the blockers first, then ship.` when each problem is small and the approach is right. `Needs rework.` when the approach is wrong or core requirements are missing.

A review request is analysis, not permission to edit files. Edit the plan only when the user asks, and then apply only the fixes you reported.
