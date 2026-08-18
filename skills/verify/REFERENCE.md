# Verify reference

Load only when a step names this file.

Paper: Kwok et al., *LLM-as-a-Verifier*, arXiv:2607.05391.
Official repo: https://github.com/llm-as-a-verifier/llm-as-a-verifier
(`fine_grained_reward.py`, `pivot_tournament.py`, `prompts.py`,
`scripts/run.py`, `criteria/TEMPLATE.md`).

## Paper method (Eq. 3.1)

Let `V = {v_1 … v_G}` be ordered score tokens, `G = 20`, `φ(v)` the scalar
for that token. For task `x`, criterion `c`, trajectory `τ`:

`R(x,τ) = (1/CK) Σ_c Σ_k Σ_g p_θ(v_g | x, c, τ) · φ(v_g)`

Normalize to [0, 1]: `(R − φ_min) / (φ_max − φ_min)`.
Pairwise preference (Bradley–Terry):

`P(τ_i ≻ τ_j | x) = 1 / (1 + exp(-(R_i − R_j)))`

Three scaling axes, complementary: granularity `G`, repeats `K`, criteria `C`.
A standard LM judge keeps only `argmax_v p(v)` and ties on close traces
(paper: 88/100 ties on a 1–5 judge for query-optimize).

Official scoring uses letters A–T so backends can read logprobs
(`GRANULARITY = 20`, `SCALE` in `fine_grained_reward.py`). Digits 1–20 in
the paper prompt; the repo maps A=20 … T=1.

## Path 1 — logprobs (paper)

Read the distribution at `<score_A>` and `<score_B>`. Official
`extract_score` takes `Σ p(v) φ(v)` over A–T (and a/t), then normalizes.
That is Eq. 3.1 for one `(c, k)`.

## Path 2 — two-stage (paper B.6)

When the acting model hides logits (GPT-5.5 / Opus-class APIs):

1. Prompt it with the pairwise template. Require a free-form analysis
   block, then a discrete score.
2. Forward task, both traces, and that analysis to a logprob verifier
   (`G=20`). Compute Eq. 3.1 from its score-tag logits.

Stage 1 is reasoning. Stage 2 is the calibrated reward. Do not stop after
stage 1's integer.

## Path 3 — letter fallback (not Eq. 3.1)

Official `extract_score` parses the emitted letter when logprobs are
missing. Map A=20 … T=1, then `R = (value − 1) / 19`. Average over C and
K. This is still a discrete token. Paper Table 12: discrete 1–10 needs
large `K` to break ties; the continuous path has ~0 ties at `K=1`.
Report `path=letter-fallback`. Never call this the paper method.

## A-T scale (official `SCALE`)

- A: clearly succeeded with verified output
- B–D: succeeded with minor issues
- E–G: mostly correct
- H–J: uncertain, leans success
- K–M: uncertain, leans failure
- N–P: significant issues remain
- Q–S: failed with partial progress
- T: clearly failed

## Pairwise prompt (official shape)

Keep task + both traces + scale first; put the one criterion last (prefix
cache). End with exactly:

```
<score_A> LETTER_A_TO_T </score_A>
<score_B> LETTER_A_TO_T </score_B>
```

Score only that criterion. Ignore narration. Odd `k` swaps slots; write
scores back in candidate order (`fine_grained_reward.py`).

## PPT when N>3 (official)

`pivot_tournament.py`, default `k=2`:

1. Ring pass: random Hamiltonian cycle; score the N adjacent directed
   pairs so each candidate sits once in A and once in B.
2. Pivots: top-k by ring-pass mean `w_i / c_i`.
3. Pivot rounds: every non-pivot vs each pivot, plus pairs inside P.
4. Winner: `argmax w_i / c_i`.

Budget: `N + k(N − k) + C(k, 2)`. Path 3 cannot separate candidates that
share the same letters; PPT seating then breaks the tie, not quality.

## Criteria file (official)

```
# <title>
## Ground Truth Note
<one paragraph; trust observed output>
## Criteria
### <Name> {#optional-id}
<where to look; what scores high vs low; what to ignore>
```

2–4 narrow criteria beat one broad one. HTML comments are stripped
(`prompts.py`). Paper triad for code agents: Specification, Output,
Errors (`criteria/terminal_bench.md`).

## Classify (official `scripts/run.py`)

all-pass: every trial already succeeds — skip the tournament.
swing: trials disagree — run the tournament.
all-fail: dropped as unwinnable in a fixed pool.

## `--track` (official `track` / `ProgressTracker`)

Score the prefix so far against "would the current state already complete
the task?" Independently per checkpoint. A rising curve is keep; a flat
low score is abandon. Paper: Value-Order Correlation (VOC).

## Generate N (paper test-time scaling)

The SOTA numbers are Pass@1 → verifier-selected Pass@N. Oracle Pass@K on
Terminal-Bench V2 hits 98.9% when a perfect picker sees the pool (Fig. 5).
The paper samples a **fixed** N (3, 5, or 20), in parallel when a harness
allows (TurboAgent). N is a budget, not a function of task hardness.

Each trajectory is an independent rollout. Official `select(problem,
candidates, ...)` ranks an already-built pool; this skill builds that pool
when the user did not supply one.

Isolation (harness mapping):

- bb: `bb thread spawn` × N with `--new-environment worktree` (or disjoint
  branches). Wait, then lock each trace.
- Cursor / Claude Code: N parallel subagents, each on its own worktree or
  branch. Parent does not edit product files during generate.
- Same checkout, no isolation primitive: `BLOCKED` for parallel. Fall back
  to `generate=serial` (reset or new branch between attempts).

A worker brief contains only: task, criteria, ground-truth note, write
scope, and "return the attempt + how to reproduce the check." No sibling
ids. No ranking instructions.

## Defaults vs repo

Repo `select` often uses `n_evaluations=4` and `pivots=2`. This skill
defaults `--evals 2` to bound in-harness cost; raise it when ties survive.
`--max-rounds` defaults to `0` (one generate + one select, as in the
paper). Raise it to resample the winner.
