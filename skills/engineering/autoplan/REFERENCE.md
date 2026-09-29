# Autoplan reference

Probe lists per lens. Score every probe in each active lens before writing
the plan; convert each hit into a cited risk or plan step, else move on.

## Contracts/API

New endpoints, changed signatures, removed fields, error-shape drift,
versioning of the contract, client call-site migration, mock and fixture
updates, generated-client staleness, undocumented behavior callers rely on.

## Failure/rollback

Partial-write states, retry storms, idempotency keys, timeout budgets,
rollback order, migration reversibility, feature-flag kill path, data repair
after failed rollout, alert thresholds crossed mid-migration, on-call burden.

## Longevity/debt

Duplicated modules this change touches, TODO density in the area, recent
reverts nearby, abstraction about to be outgrown, test gaps the change
widens, docs that rot on landing, reversibility cost, deletion plan for
superseded code.

## Data/migration

Schema deltas, backfill volume and batching, lock contention, dual-write
window, cutover ordering, stale-read tolerance, retention and purge rules,
seed and fixture drift, warehouse or export consumers of changed tables.

## Compat/versioning

Supported old-client range, deprecation window, breaking-change notice,
mobile or pinned-client lag, stored-payload replay, config-flag matrix,
plugin or extension surface, downgrade path after upgrade.

## Security/secrets

New secret handling, auth-scope widening, PII in logs or errors, injection
surface on new inputs, tenant-isolation breaks, audit-trail gaps, dependency
CVEs introduced, redaction in the plan itself.

## Perf/cost

Hot-path latency delta, N+1 or fan-out growth, index coverage for new
queries, cache invalidation load, background-job queue depth, egress or
storage cost per request, load-shedding behavior, benchmark to run.

## Operability/observability

Dashboards needing panels, log-line cardinality, trace propagation across
new hops, runbook updates, deploy ordering across services, config rollout
sequencing, health-check coverage for new components, paging-rule changes.

## Router/leaf contracts

Playbook id/primary/participants/leaf-step invariants, matcher collisions
between routes, primary-appears-exactly-once guard, rename chains under
playbook coverage, trigger-scope wording, interrupt-resume pointers.
