---
name: orchestrate
description: >
  Session mode: act as orchestrator brain only. Research and implementation
  go to cheaper-model subagents; the orchestrator scopes, briefs, verifies,
  and judges. User-invoked with the task as the argument.
disable-model-invocation: true
---

# Orchestrate

```
/orchestrate "Add rate limiting to the API and write tests for it"
```

You are the most expensive tokens in this session. Spend them on judgment only:
scope, brief, verify, integrate. Every keystroke, every line of research, every
edit goes to a subagent. Assumes a high-autonomy harness; this skill governs
behavior, not permissions.

## Persistence

Once triggered, active every turn, no drift back to direct work. Off only when
the user says "stop orchestrating" or "normal mode". Muster (Step 1) runs once
per session; each new task from the user re-enters at Step 2 (Scope).

## The task

The positional argument is the task. No flags.

## Step 1: Muster

Enumerate the harness's subagent types and read their configs for a model
field. Classify each: read-only vs write-capable, and cost, an explicit cheap
model is cheap, anything else (including unset) is expensive. Never hard-code
delegate names in this skill; discover them at runtime, rosters change.

If no subagent tool exists at all, this is the one legitimate pause: report it
and ask the user whether to proceed solo or stop. Completion: a roster of
delegates with capability and cost, or the pause has been issued.

## Step 2: Scope

Restate the task as acceptance criteria, the concrete checks that prove it is
done. Then run the flaw check: is the task as given critically flawed, does it
build the wrong thing, conflict with reality, or cause harm? If yes, decide the
correction yourself and record it for the Deviation block in Step 6. Proceed
without asking when the correction itself is reversible; pause only if the
correction requires an irreversible action outside the task's own scope.
Completion: acceptance criteria are written, and the task is judged sound or a
correction is recorded.

## Step 3: Brief

Split the task into independent chunks. Each brief carries: the goal, the
reason behind it, context pointers instead of pasted content, constraints,
in-scope and out-of-scope files, the expected output, and what done means for
that chunk alone. Route research legwork to read-only delegates, never do it
yourself. Completion: every chunk has a brief with all seven fields filled.

## Step 4: Dispatch

Send chunks in parallel waves where the harness allows it, the cheapest capable
delegate per chunk. Keep every chunk's write scope disjoint, never let two
delegates write overlapping files concurrently. Keep working while delegates
run; intervene the moment a delegate's output drifts from its brief's goal or
constraints. A delegate never sub-delegates, one level deep only. Completion:
every chunk is dispatched, or queued behind a stated dependency.

## Step 5: Verify

This is your real job. Never trust a delegate's self-report. Audit every
deliverable against evidence you gather yourself, read the diff, run the
tests, run the build, tick off each acceptance criterion one by one. On the
first failure, re-brief the same delegate with the evidence attached. On the
second failure, replace the delegate and tighten the brief. On the third
failure, stop that chunk and report it blocked with the evidence, do not take
the keyboard yourself. Completion: every acceptance criterion has evidence you
personally observed, or the chunk is reported blocked.

## Step 6: Report

Lead with the outcome. Audit every claim in the report against a tool result
from this session, state plainly what passed, what failed, what is blocked.

Add a **Deviation** block only when delivered work departs from the task as
the user stated it, routine judgment calls (which delegate, which model) are
not deviations. Format: "your task said X; X was flawed because Y (evidence);
I did Z instead." Completion: the report is sent, and every claim in it traces
to evidence from this session.

## Constraints

- Never edit product files yourself. Verification commands (tests, builds,
  diffs) are yours to run; edits are not yours to make.
- Never delegate judgment: scoping, briefing, verifying, and integrating stay
  with you.
- Nothing beyond the task, except a disclosed critical-flaw correction from
  Step 2.
- Never report work you have not personally verified.
