# Verification cases

Run the existing repository guards. New one-shot checks, tokenizers, fixtures,
and measurement helpers belong in `/tmp`, not in the committed tree.

For each touched branch, trace a success and a relevant failure from the request
through pointers, authorization, actions, and the terminal. Record source paths,
the observed result, and any unexercised external operation. A parser assertion
or simulated trace is not evidence that a model followed a pointer in a live run.
Keep safety instructions when that behavioral evidence is unavailable.

## Required cases

| Branch | Success evidence | Failure or pause evidence |
|---|---|---|
| recon read | Existing, repository-verified snapshot is returned; file hashes unchanged | Missing snapshot is reported without refresh; another repo's map is rejected |
| recon worktree | Shared common directory finds the same snapshot; legacy primary-root key works | Mismatched or unresolvable stored head is disclosed on read, rebuilt only on map |
| router | Selected leaves run in order after success/no-op | Blocked/waiting is reported, never advances a chain; inspection does not become fixing |
| review | Every material requirement has evidence and a mapped verdict | No target blocks; review alone causes no edits |
| Git scopes | Locked scope, fingerprint, and unrelated index/worktree layers preserved | Mixed staged/unstaged target blocks before edits; empty scope never switches |
| commit policy | Diff proves each message line; requested trailers survive | Conversation-only subject fails; unrequested footer is detected; published HEAD is not amended |
| PR publication | Base/head, draft intent, explicit issue set, copy, and read-back match | Dirty tree, remote movement, or mismatched issue footer blocks; no inferred ticket |
| PR feedback | All six surfaces complete with native targets; one hunt | Failed/capped page blocks; push does not restart hunt; pending CI waits for another invocation |
| handoff | Compact redacted artifact resumes into an unblocked task | Stale artifacts cannot drive work; no task or malformed required sections blocks |
| box | Direct/delegated mode follows the requested override and available tools | Invalid listed clone is untouched; incomplete search cannot persist |
| remote skill | Pinned tree includes every blob; all sibling content is read | Missing entry/reference or truncated tree blocks; successful items are not retried |
| output voice | The draft path for commit, make-pr, and a fix-pr reply loads `authoring/output-voice.md`. The commit, make-pr, and fix-pr thread reports load it too. A commit subject still shows the type prefix, the 50-character cap, and the imperative test. A commit body still states what changed and why. A fix or reject opening matches `replies.md`. | A pointer that only says "see reference" fails the trace. `reply.md` gains no voice rule. A `description` hunk in this diff fails the bound. A personal-skill pointer that resolves under `skills/authoring/` fails the trace. |

## Pass bar

Every applicable case needs an observed pass or a named limitation. Static
checks cover names, bounds, links, manifests, and script immutability. Offline
fixtures cover exact payloads and file effects. Agent-behavior cases need a
recorded execution trace before a guardrail is removed. External writes can be
verified with authorized live read-back or left explicitly unexercised.

Measure before/after with the same tokenizer and the files actually loaded by
each named branch. Include help output when a branch invokes help. Compression
passes only with preserved required outcomes; percentage reductions are
observations, not quotas. Branch references may increase total disk text while
reducing loaded context.
