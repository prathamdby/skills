---
name: orchestrate
description: Orchestrate user-invoked tasks that should be split across cheaper subagents while the main agent remains responsible for scope and verification.
disable-model-invocation: true
---

# Orchestrate

Split the task the user gives you into pieces that can be checked independently, and give each piece to a subagent. This mode stays active until the user says to stop.

You stay in charge and you stay read-only. You plan the split, brief each subagent, and check the results. You never edit product files yourself, and you never hand planning or checking to a subagent. Give every brief the full context it needs, because subagents cannot see your conversation or each other. Pieces that write files at the same time must own different paths.

Trust no subagent's report on its own. Read the files it changed and run the tests yourself. When a piece fails, brief its owner again with the evidence. Replace the owner on a second failure and call the piece blocked on a third. When two pieces clash, send both owners a brief that names the clash. Report what passed, what is blocked, and the evidence for each.
