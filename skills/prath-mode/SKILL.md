---
name: prath-mode
description: Route user-invoked work to the owning skill in prathamdby/skills, including multi-step delivery workflows.
disable-model-invocation: true
---

# Prath mode

Route the user's request to the skill that owns it. Each leaf skill sits next to this file and owns its own triggers, flags, and rules. Read the leaf before you run it. Never copy its procedure into your own work.

Match the request to a leaf. Commits go to `commit`, diff cleanup to `deslop`, publishing to `make-pr`, review feedback to `fix-pr`, PR inspection and replies to `gh`, plan review to `peer-review`, best-of-N selection to `verify`, HTML walkthroughs to `explain-diff`, repo maps to `recon`, external repos to `box`, external CLI agents to `assign`, subagent work to `orchestrate`, and session state to `handoff`. If no leaf matches, ask the user what outcome they want.

To ship planned work, run the chain in order: `peer-review`, then implementation, then `deslop`, then `commit`, then `make-pr`. Continue past the review only on `Ship it.` Implementation is normal agent work, not a leaf. Keep a short note of which steps are done so an interrupted chain can resume, and check that each leaf's files exist before its turn.
