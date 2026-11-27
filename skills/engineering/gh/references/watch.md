# Pull request watching

Apply when the request is to detect future changes on a pull request. Current
state still uses `pr-snapshot.ts` or `pr-threads.ts`; watching never replaces
those reads, fixes feedback, posts replies, or delivers wake messages.

`<anchor>` is this skill's absolute directory. Invoke the engine only as:

```sh
<anchor>/scripts/run pr-watch.mjs <group> <action> [resource] [options]
```

Use `--json` for agent work. No command prompts. Help works offline before
authentication, state access, or network access. List, inspect, removal, and
event inspection are local-state operations; add and run are the surfaces that
can use the network.

## Exact procedure

1. Resolve the target through the gh leaf options. `PR` is a positive integer
   no greater than 2,147,483,647, not a URL; extract the number when the user
   supplies a URL. Omit `PR` only when the current branch resolves to exactly
   one pull request. Use `--repo owner/repo` only with an explicit PR.
   The repository value must have exactly one slash; each side uses only ASCII
   letters, digits, `.`, `_`, or `-`, and neither side is `.` or `..`. The
   watch command has no `-R` form. Add the watch once:

   ```sh
   <anchor>/scripts/run pr-watch.mjs watches add <PR> --repo <OWNER/REPO> --json
   ```

   Keep the returned watch id. An active duplicate returns `unchanged` for the
   existing watch. A merged or closed target is a non-retryable conflict. A
   re-added ended watch receives a new id and can return continuation events.
   First-time registration appends no events, even when the baseline already
   has pending or failed checks; use snapshot or CI inspection for that current
   state instead of treating the empty events array as a clean bill of health.
2. Detect changes only with an explicit bounded sweep:

   ```sh
   <anchor>/scripts/run pr-watch.mjs watches run --watch <WATCH> --json
   ```

   Omit `--watch` to sweep every active watch. A bounded run is one sample, not
   continuous coverage.
3. For continuous watching, keep an explicit foreground follow process alive:

   ```sh
   <anchor>/scripts/run pr-watch.mjs watches run --follow --watch <WATCH> --timeout <DURATION> --json
   ```

   Follow runs its first sweep immediately, then sweeps every 120 seconds. In
   non-interactive use `--timeout` is required; agents should pass it
   explicitly. `DURATION` is a positive integer with suffix `s`, `m`, `h`, or
   `d`.
4. Report only event types, event counts, and the next drilldown. Do not paste
   sweep JSON into the conversation. A no-event result is "no new events in
   this sweep", never "nothing changed" and never proof of continuing coverage.
5. Drill down only with the owning one-shot surface:

   | Event family | Drilldown |
   | --- | --- |
   | `checks-failed` | `ci-failures.ts` |
   | `remarks` | `pr-threads.ts` |
   | `merged`, `closed`, `conflicting`, or `needs-rebase` | `pr-snapshot.ts` |

   Name each needed drilldown once. For other event types, report no drilldown
   rather than inventing one. Investigate `watch-ended` through
   `watches inspect` before deciding whether user action is needed.
6. Use `events list` only for missed or historical local events inside the
   retention boundary. Use `watches inspect` only for state, read-health, or
   quota debugging. Neither command creates coverage.
7. A missing PR or repo, missing watch, invalid or ambiguous selector,
   terminal target, or missing non-interactive timeout is blocked input:
   correct the exact command and rerun it. Do not reimplement watch reads with
   raw gh after a covering command failure.

## Lifecycle truth

There is no daemon in the service sense. `watches run` is both the sweep and
the tick, and `watches run --follow` is an explicit foreground loop. There is
no hidden process launch, restart supervision, platform wake delivery, or
separate blocking wait command.

Coverage exists only while a caller explicitly runs bounded sweeps or keeps a
follow process alive on an awake machine. After follow exits, the engine does
not poll and does not generate events; never claim post-exit or always-on
coverage. A later sweep is a new explicit sample, not retroactive coverage of
the exit interval.

State lives at `~/.gh-watch/state.json`, in a `0700` directory with a `0600`
file. It survives a pause or restart that preserves the same machine disk. It
vanishes when that machine is replaced, and there is no migration or repair of
the lost state. The event log is bounded local inspection state, not delivery,
acknowledgement, or a durable cross-machine audit log. It retains the newest
500 events. Events never carry comment bodies, review bodies, tokens, or log
text.

## Command surface

| Command | Capability | Human stdout | JSON stdout |
| --- | --- | --- | --- |
| `watches add [PR] [--repo owner/repo] [--json]` | Resolve, validate, baseline, and register one watch | Bare watch id | `{ "watch": watchSummary, "outcome": "added" \| "unchanged", "events": [event], "next": [nextCommand] }` |
| `watches list [--state active\|ended\|all] [--all] [--limit N] [--next CURSOR] [--json]` | List watches, active by default | Tab-separated `WATCH REPO PR STATE UPDATED` table | `{ "watches": [watchSummary], "pagination": pagination }` |
| `watches inspect <WATCH> [--json]` | Inspect one active or ended watch | Identity, state, dedupe, read, and quota rows | `{ "watch": watchDetail }` |
| `watches remove <WATCH> [--json]` | End one active watch and preserve ended-watch dedupe | Bare watch id | `{ "watch": watchSummary, "outcome": "removed" \| "unchanged", "next": [nextCommand] }` |
| `watches run [--watch WATCH] [--json]` | Run one bounded sweep now | One compact line per new event; empty when none | `{ "outcome": sweepOutcome, "summary": sweepSummary, "events": [event], "results": [sweepResult] }` |
| `watches run --follow [--watch WATCH] [--timeout DURATION] [--json]` | Sweep every two minutes until stopped, timeout, or no active watches | One compact line per new event as it arrives | JSONL, one object per line |
| `events list [--watch WATCH] [--since TIME] [--all] [--limit N] [--next CURSOR] [--json]` | Inspect the bounded event log | Tab-separated `SEQ TYPE REPO PR CREATED SUMMARY` table | `{ "events": [event], "pagination": pagination }` |
| `help [--all] [--json]` | Print offline command help | Root help, or canonical paths and summaries with `--all` | Root help document, or `{ "commands": [{ "path", "summary" }] }` with `--all` |
| `help search <query> [--json]` | Search offline help, at most 10 matches | Matching paths and summaries | `{ "commands": [{ "path", "summary" }] }` |

A `WATCH` selector is a `w_` id with five lowercase base36 characters or an
`owner/repo#N` reference matching exactly one stored watch.
`watches run --watch` accepts only an active watch; `inspect` and
`events list --watch` accept active or ended watches. `add` is idempotent per
host, repository, and PR. `remove` of an already ended watch is `unchanged`;
a missing watch is `not_found`. A missing or ended watch selected for
`watches run` fails before any network read or state mutation.

Pagination uses `pagination.next`, either an opaque cursor or null. Watch list
order is descending `updatedAt` with a descending-id tie-break; event list order
is descending `seq`. The default limit is 50, capped at 200 watches or 500
events. `--all` retrieves every remaining row and conflicts with an explicit
`--limit`. `--fields` is valid only with `--json` and projects top-level
result fields without changing the command outcome. `--timeout` is valid only
with `--follow`. `--since` on `events list` is inclusive and accepts an ISO
8601 UTC timestamp or a relative `s`, `m`, `h`, or `d` duration. In durations,
`d` means 24 hours.

Short forms are `-a` for `--all`, `-n` for `--limit`, `-s` for `--since`, and
`-f` for `--follow`. `-h` is a help alias and `-d` a debug alias. `--cwd`
changes only current-checkout resolution. Unique prefixes are never inferred.

Only `watches add` consults the effective `GH_HOST`; later reads use the host
stored on each watch. github.com is the verified target. Enterprise hosts are
best-effort: required-check and merge-queue reads are omitted there, and add or
inspect can report `enterprise_degraded`.

## Output shapes

`watchSummary` has exactly `id`, `key`, `host`, `repo`, `pr`, `state`,
`createdAt`, `updatedAt`, `endedAt`, `endReason`, and `url`. State is `active`
or `ended`; `endReason` is null while active, then `removed`, `merged`,
`closed`, `unreadable`, or `comment-limit`. `watchDetail` adds `dedupe`,
`read`, and `quota`. A `nextCommand` has exactly `command`, `argv`, and `when`.

`dedupe` carries evaluator state: `startedAt`, `headSha`, `failedChecks`,
`passed`, `passedChecks`, `owedChecks`, `awaitingApproval`,
`approvalAnnounced`, `remarksThrough`, `remarkIds`, `conflicting`,
`rebaseRequired`, `mergeQueueRemovalId`, `checksAwaitedSince`,
`checksPending`, `wakes`, and conditional `awaitingBaseline`. `read` carries
`lastFingerprintAt`, `lastDetailAt`, `lastActivityAt`, `statusFingerprint`,
`remarksFingerprint`, `detailInFlight`, `remarksIncomplete`,
`consecutiveFailures`, and `lastErrorReason`. `quota` carries `pausedUntil`,
`pauseReason`, `rateLimits`, `consecutiveRateLimitFailures`, and
`rateLimitGeneration`; each complete rate-limit entry has `limit`, `remaining`,
`used`, and `resetAt`. These detail fields are debugging state, not a report
format for ordinary watch results.

A bounded sweep outcome is `completed`, `partial`, `failed`, or `paused`.
`sweepSummary` has exactly `succeeded`, `failed`, `skipped`, `unknown`,
`startedAt`, `finishedAt`, `durationMs`, `watchCount`, `groupCount`, and
`readGroupCount`. Each sweep result has exactly `id`, `outcome`, `detailRead`,
`activityRead`, `eventCount`, and optional `error`; group outcome is
`unchanged`, `read`, `paused`, `failed`, or `ended`. Results sort by group key,
and events print ascending by `seq` only after their state commit succeeds.

An event object has exactly `id`, `seq`, `watchId`, `type`, `createdAt`,
`host`, `repo`, `pr`, `headSha`, `url`, and `data`. `createdAt` is the local
commit time, not the remote activity time. Event ids are `evt_` plus `seq`
zero-padded to at least six digits; `headSha` is a string or null, and arrays
keep evaluator order. The event types and data are:

| Type | `data` |
| --- | --- |
| `checks-failed` | `checks`: array of newly failing or cancelled `{ name: string, url: string \| null }` rows |
| `checks-passed` | `count`: nonnegative integer; `required`: boolean |
| `checks-finished` | `passed`: nonnegative integer; `failing`: array of every failing or cancelled `{ name: string, url: string \| null }` row at settlement |
| `checks-awaiting-approval` | `checks`: array of awaiting `{ name: string, url: string \| null }` rows |
| `remarks` | `count`: positive integer of actionable fresh remarks |
| `no-checks` | `minutes`: nonnegative integer |
| `conflicting` | empty object |
| `needs-rebase` | empty object |
| `merge-queue-removed` | `reason`: string or null |
| `merged` | `baseBranch`: string; `mergeCommitSha`: string or null; `mergedBy`: actor login string or null |
| `closed` | `baseBranch`: string |
| `watch-ended` | `reason`: exactly `unreadable` or `comment-limit` |

With `--json`, bounded commands write one JSON document to stdout and nothing
else. Success warnings are in that document's `warnings` array. Human progress,
receipts, warnings, and errors stay on stderr; in JSON mode the single error
document also stays on stderr. Follow JSONL starts with
`{ "type": "snapshot", "watches": [watchSummary], "intervalSeconds": 120 }`,
then emits `{ "type": "event", "event": event }` lines and warning lines with
`type`, `reason`, `message`, and optional `data`. There are no empty-sweep
heartbeat lines.

Per-command help JSON has stable keys `path`, `summary`, `subcommands`,
`arguments`, `options`, `lifecycle`, and `resultSchema`; `lifecycle` is null.
`help --all --json` and `help search <query> --json` return `commands` entries
with `path` and `summary`.

Errors use one document with `status`, `reason`, `message`, `next`, and
`data`, plus applicable optional `userActionRequired`, `retryable`,
`retryAfter`, `requestId`, and `warnings`. Success, empty results, unchanged
mutations, help, and follow timeout exit 0. Operational failure exits 1, usage
errors and missing input exit 2, and cancellation exits 130. A sweep that
starts keeps per-group failures in `results` instead of replacing the bulk
stdout document with an error document.
