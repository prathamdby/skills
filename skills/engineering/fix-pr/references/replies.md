# Verdict replies

Post only via gh pr-reply. Reply to an inline finding in its review thread
with the root databaseId. Nested IDs resolve to root. When that reply
succeeds, post nothing on the main conversation for that finding. When the
inline reply fails, follow the error that pr-reply returns. Do not retry
that inline reply. A finding with no inline thread keeps one conversation
reply per review or conversation parent. Split a draft that mixes both.
Inline findings go to their threads. Findings that never had an inline
thread go on the main conversation. CI findings with no inline thread use
an existing linked conversation surface, otherwise report without inventing
a target.

A fix or reject reply starts with the opening below, except a
semgrep-code-scan dismissal. One or two short sentences follow the opening.
The opening is not one of those sentences. Those sentences name the path,
test, SHA, or behavior, and they do not repeat the opening. A
semgrep-code-scan dismissal still starts with `/fp`, `/ar`, or `/other`.
Fixed, Rejected, and Intentionally won't fix do not precede that command.

- Fix, after push: Fixed in <pushed SHA>. <concrete change>.
- Reject, when the claim does not hold: Rejected. <conclusion>. <path:line or test evidence>.
- Reject, when the change is declined on purpose: Intentionally won't fix. <what stays and why>.
- Clarify: <observed behavior>. <specific question/contract>.
- Already-fixed: Already fixed in <SHA> at <path:line>.

Reject and clarify replies require ledger evidence. When a consolidated
reply's findings share one opening, start with that opening, then one short
bullet per finding. When they do not share one opening, keep one short
bullet per finding and add no status word. For semgrep-code-scan dismissals
preserve exactly `/fp <reason>`, `/ar <reason>`, or `/other <reason>` as
appropriate. Fixed findings get no dismissal command. Resolve no thread
without explicit authorization. Done when each finding is satisfied or
recorded unreplied. A finding answered in its inline thread, or on the main
conversation via fallback, is satisfied. A finding with no inline thread is
satisfied by its conversation reply.
