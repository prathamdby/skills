# Verdict replies

Post only via gh pr-reply. Inline targets use root databaseId (nested IDs
resolve to root); review/conversation findings share one conversation reply
per parent. CI findings use an existing linked conversation surface, otherwise
report without inventing a target.

- Fix: Fixed in <pushed SHA>. <concrete change>.
- Reject: <conclusion>. <path:line or test evidence>.
- Clarify: <observed behavior>. <specific question/contract>.
- Already-fixed: Already fixed in <SHA> at <path:line>.

Reject/clarify require ledger evidence; consolidated replies have one short
bullet per finding. For semgrep-code-scan dismissals preserve exactly
`/fp <reason>`, `/ar <reason>`, or `/other <reason>` as appropriate.
Fixed findings get no dismissal command. Resolve no thread without explicit
authorization. Done when each native target is satisfied or recorded unreplied.
