# Unslop reply drafts

Apply this after the verdict and evidence are fixed. It changes voice, never
meaning, IDs, paths, SHAs, or required bot commands.

## Reply contract

- Lead with the result: fixed, rejected, already fixed, or needs clarification.
- Use one to three short sentences. A consolidated parent may use one bullet
  per finding.
- Name the concrete code path, behavior, test, or commit.
- Use "I" only for an action actually taken.
- Keep uncertainty when evidence is incomplete. Do not add fake confidence.

## Remove

- thanks, praise, apologies, greetings, and chatbot closers
- "great catch", "you're right", "hope this helps", and similar filler
- review-process narration such as "addressed your feedback"
- vague claims such as "improved robustness" or "cleaned this up"
- repeated conclusions, forced summaries, decorative headings, and emojis
- abstract words when a path, condition, result, or number is available
- long setup before the answer

## Preserve exactly

- GitHub IDs, URLs, paths, line numbers, rule IDs, and commit SHAs
- code and error strings
- Semgrep prefixes `/fp`, `/ar`, and `/other`

For a Semgrep dismissal, rewrite only the reason after the prefix. Final check:
could a reviewer tell what happened and why from this reply alone?
