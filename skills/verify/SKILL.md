---
name: verify
description: >
  verify when running best-of-N, choosing among multiple attempts, a 1-10
  or yes/no judge would collapse close traces, comments claim success
  without a run, or a live attempt may have stalled.
---

# Verify

Sample N isolated trajectories, then rank them (Kwok et al., arXiv:2607.05391).
One score token is an LM judge, not this method.

## Options

Derive N, K, pivots, rounds, criteria, and track from the request.
Unspecified: N `3`, evals `2`, pivots `2`, rounds `0`, auto criteria,
track off. A supplied attempt list overrides N. Raise evals when ties
survive; raise rounds to resample a swing winner or replace an all-fail pool.
"5 candidates" → N=5. "track progress" → track; skip generate and select.
"criteria in <path>" → that file.
N is a budget, not inferred from hardness. Conflicting numbers or a missing
needed path is `BLOCKED`.

## 1. Lock task and criteria

Require a task. Write 2–4 independent criteria plus a ground-truth note that
trusts observed tool output, not narration. Write that file using the
layout in `REFERENCE.md`.

Record: `task | criteria | track | generate | path | n/k/pivots/rounds | current | terminal`.

Done when task and criteria are fixed, or `BLOCKED`.

## 2. Generate

Track: skip. If the user supplied attempts, use them unchanged.

Else dispatch N workers in one parallel wave. Each brief:
locked task + criteria + "one complete attempt; no siblings; no rank."
Write scope is a worktree or copy using Isolation in `REFERENCE.md`, never
a branch on this tree. Same-tree parallel writes are `BLOCKED`. Parent
implements nothing. No spawn: N serial attempts (`generate=serial`).

Done when N traces are locked, or `BLOCKED`.

## 3. Verify

Run candidates when a criterion is empirical. Classify all-pass / all-fail
/ swing. Skip scoring on skip classes. all-fail is unwinnable here: if
rounds remain, consume one and return to Step 2; else `ALL_FAIL`.

On swing, one criterion per comparison. N≤3: every directed pair. N>3:
clamp pivots to `[1, N]`, then run the PPT procedure in `REFERENCE.md`.
Average over C and K. Soft win `p = 1/(1+exp(-(R_a-R_b)))`. Accumulate
`w_i`, `c_i`.

Scoring path (first match); pick it from `REFERENCE.md`:

1. Logprobs at `<score_A>` / `<score_B>`: `R = E[φ(v)]` on A–T (paper).
2. No logprobs, user named a logprob verifier: two-stage (paper B.6).
3. This harness only: emit A–T, map, average over K and C. Not Eq. 3.1.
   Still pairwise, decomposed, swapped. Never a 1–10.

Track: score the prefix against "already complete?"; no siblings.

Done when each scored candidate has `w_i/c_i`, or a skip class applies.

## 4. Select

Track or all-fail: no winner. all-pass: lowest-index passer. swing:
`argmax w_i/c_i` (index tie-break). Done when that choice is recorded.

## 5. Revise or stop

Stop on: all-pass; track and score ≥ 0.8 with observed checks;
rounds exhausted (default: no revise); no score gain. Else revise
only the swing winner on its weakest criteria and return to Step 3.

Done when a stop rule fires.

## 6. Report

`criteria | generate | path | classify | ranking w_i/c_i | winner | rounds |
stop | terminal`. `SUCCESS`, `ALL_PASS`, `ALL_FAIL`, `NO_IMPROVEMENT`,
`BLOCKED`.

## Rationalizations

| Excuse                      | Reality                                       |
| --------------------------- | --------------------------------------------- |
| "I'll just do it myself"    | Parent implements zero candidates. Fan out N. |
| "N should match difficulty" | N is the stated budget. Do not invent it.     |
| "Score them 1-10"           | Discrete judge. Trust observed execution.     |

## Red flags

Parent wrote a candidate; same-tree or branch-as-parallel workers; N inferred; a 1–10; no swing `w_i/c_i`; no A/B swap.
