---
name: gh
description: gh when inspecting a PR, reading review threads, diagnosing red CI, posting a thread or conversation reply, or composing non-trivial gh commands. fix-pr loads this skill for hunt and reply I/O. Node below 23 or ERR_UNKNOWN_FILE_EXTENSION is not a skip to GraphQL.
---

# GitHub I/O

Use the scripts in the `scripts` directory next to this file for GitHub work. Run them with `scripts/run <script>` and it finds a working TypeScript runtime for you. `pr-snapshot.ts` shows PR state and checks. `pr-threads.ts` shows review threads. `ci-failures.ts` collects CI failures and saves the logs to disk. `pr-reply.ts` posts one reply.

A snapshot tells you the state of the PR. The threads tell you what reviewers wrote. You usually need both. Pass `--json` for structured output and `--full` when you need complete comment bodies.

Do not pipe output through `head`. If the output is large, redirect it to a file. If `run` exits with code 2, stop and report it. That is not permission to hand-write GraphQL. A Node version error means the runtime cannot load TypeScript, not that the script failed. Let `run` try its runtimes.

Never resolve threads, merge, or push from this skill. Post replies only through `pr-reply.ts`.
