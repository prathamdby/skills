---
name: assign
description: assign when running one exact task through a supported external coding-agent CLI without interactive prompts.
---

# Assign

Give one task to an external coding agent and let it run to the end. The supported agents are opencode, codex, and claude. Write the full task before you start, because the agent cannot ask questions. Include the goal, the files that matter, and what a good result looks like. Do not add steps the task did not ask for, such as a commit or a push.

Write the task to a temp file and pipe it to the agent on stdin. Never put the task text in the command line, where other users and logs can read it. Create the file with `mktemp` and make it readable only by you. Check that the file reads back the same before you run. Remove it when the agent exits or stops, whatever the result.

Run the agent without interactive prompts and watch its output. For opencode and claude, skip permission prompts so the agent never waits for approval. For codex, pass `-` for stdin and keep `approval_policy=never` with the workspace write sandbox. Silence is not a failure. Stop it only when it waits for input, the user cancels, or the time limit is reached.

When the agent exits, check the result yourself. Look at the diff and run the tests. Do not trust the summary the CLI prints. Report the agent, the exit code, and what the code actually does now.
