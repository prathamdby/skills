# Raw gh gotchas

Apply before an uncovered raw operation:

1. Redirect large output or use jq slicing, not gh piped to head (SIGPIPE).
2. PR diff has no stat/positive pathspec. For per-file stats use pulls/N/files;
   name-only/exclude require current support. Fetch full diff once, then search.
3. Checks exits 1 for failure, 8 for pending; read its table. Empty stdout plus
   stderr is a real error, not an ignorable pending signal.
4. Contents at a ref can use Accept application/vnd.github.raw; quote ?ref=SHA.
5. API placeholders use cwd repo unless GH_REPO overrides. -f/-F makes POST
   unless -X GET; use string owner/repo, not numeric field coercion.
6. Paginate comments/files/reviews. jq runs per page; do not combine with slurp.
7. Bodies use body-file or safely quoted heredoc; backticks in inline shell
   body strings are not literal without correct quoting.
8. PR checks rollup is statusCheckRollup; job steps are run-view jobs.
   Search fields differ from PR-view fields.
9. gh has no -C: use explicit -R owner/repo or cd to the repo in the same call.
10. Modern protection uses repos/owner/repo/rulesets. Classic protection 404
    may mean no classic rule/admin access; inspect rulesets, not a guessed path.
11. Compare BASE...HEAD exposes ahead_by/behind_by.
12. Multiline jq belongs in a temporary file passed with -f.
13. Do not sleep-poll runs/checks. Use host watchers when available; otherwise
    background a supported run-watch or checks-watch command.
