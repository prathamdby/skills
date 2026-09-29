---
name: autoplan
description: >
  autoplan when told to plan alone with no interruptions ("just plan it
  yourself") and deliver a senior-grade implementation plan in one pass.
  Never fires on gated phased design; that stays on upfront-design.
---

# Autoplan

The intent is the work. Analysis only; never edit product files. Deliver one
plan in-thread unless the caller names a file; then write it there instead.

## Options

Derive scope, depth, and output from the request. Unspecified: scope is the
current repo, depth is standard (triaged lenses), output is the thread.
"quick" / "sketch" → depth sketch (Shape plus Risks only, always-on lenses
only). Naming a repo area scopes evidence there. "thorough" / "risky" /
"migration" → depth deep (every lens plus its probes); deep wins over quick
when both appear. Refusals below take precedence over depth and lens rules.
A bare empty intent, an intent with no groundable verb, object, or area, or a
non-repo intent with no plannable target is `BLOCKED` with the reason named
(see Refusals). Conflicting scope wording keeps the narrowest reading and
logs both readings under Assumptions; never ask.

## Refusals

Stop with `BLOCKED` before evidence when any hold: the intent names no
groundable change (no verb, object, or area that maps to a target); the
intent is non-repo and no lens applies (meeting, process, or prose with no
codebase target); the request asks to build rather than plan (plan the
work instead of starting it). Name the missing piece and one example
intent that would proceed. Emit no lenses, layer map, milestones, or
handoff on a refusal.

## 0. Triage

Trivial when all hold: one module, no contract, data-model, or signature
change, behavior statable in one sentence. Trivial stops with `DIRECT` plus
that sentence and a three-line sketch (shape, files, first step); run no
lenses. Otherwise record `intent | scope | depth | terminal` and continue.
Done when the terminal or the proceed record exists.

## 1. Evidence

Check the requested contract or route does not already exist before
planning; an existing match reframes the plan as hardening, never rebuild.
Read the `recon` memory file at `<anchor>/memory/<basename>-<hash8>.md` when
its `head` resolves to a commit; otherwise cold-scan within `recon`'s own
limits (at most three anchor files for at most 30 modules). Scan the ADR
tree (`docs/adr/`, `adr/`, `doc/adr/`, `docs/decisions/`) for touched areas;
missing tree proceeds silently. Note debt signals (TODO density, recent
reverts, duplicated modules). A dirty worktree is overlay note under
Assumptions only, never a cite; committed state decides existence claims.
Every material claim needs a path, test, or ADR cite, else the `(Assumption:
<what is missing>)` mark; a null search result cites as `no matches in
<paths>`. Done when each later claim has a cite or the mark.

## 2. Lenses

Always on: contracts/API, failure/rollback, longevity/debt. Contracts/API
includes the router/leaf probes in `REFERENCE.md` whenever the intent
touches a playbook, matcher, or leaf. Conditional, activate only on a
stated trigger else state one skip line: data/migration on schema,
backfill, persisted-artifact, or runtime/toolchain change; compat/versioning on an
external consumer or stored payload; security/secrets on auth, secrets,
PII, or new untrusted or secret-bearing inputs; perf/cost on a hot path or
cost-bearing call; operability/observability on services, deploys, or
paging. Deep runs every lens. For each active lens,
score every probe in its `REFERENCE.md` section before writing the plan,
turning each hit into a cited risk or plan step. A probe hits when the plan
changes a named surface, breaks a named guarantee or invariant, or widens
a named load; else it passes. Each lens closes `pass with cite`, `risk →
step`, or `no evidence`. Done when every active lens has closed and every
risk points at a step.

## 3. Plan

Write Assumptions (including option conflicts), Shape (one bold sentence plus
the pattern it follows), Layer map (paths marked NEW or CHANGED with a role
each; prose contracts cite file plus step instead of a symbol), Sequence per
phase, File-plus-symbol grounding (every behavior maps to a named path and
symbol, a file-plus-contract-step where no code symbols exist, or an
explicit Assumption), Risks worst-first with cites (rank by probability
times impact where measurable, else by judgment stated as judgment),
Milestones (small changes land as one PR; otherwise each one PR cutting
layers, each with a command-or-manual-step and symbols landed), Explicit
non-goals, and a Handoff pointer naming the caller's next route (default
`/peer-review`, then `ship`; substitute when nothing is built yet, e.g. a
meeting, refusal, or docs-only plan names `/peer-review` or stops). Done
with `PLANNED` when every behavior is grounded or assumed, every risk is
owned by a step, and every milestone is verifiable.

Terminal values: `PLANNED`, `DIRECT`, `BLOCKED`.
