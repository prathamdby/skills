# Unslop reply drafts

Apply this after the verdict and evidence are fixed. It changes voice, never
meaning, IDs, paths, SHAs, or required bot commands.

## Process

1. Scan for the patterns below.
2. Rewrite. Preserve meaning and match the intended tone.
3. Self-audit. Ask what makes the draft obviously AI-generated, then fix it.

## Reply contract

- Lead with the result: fixed, rejected, already fixed, or needs clarification.
- Use one to three short sentences. A consolidated parent may use one bullet per finding.
- Name the concrete code path, behavior, test, or commit.
- Use "I" only for an action actually taken.
- Keep uncertainty when evidence is incomplete. Do not add fake confidence.

## Preserve exactly

- GitHub IDs, URLs, paths, line numbers, rule IDs, and commit SHAs.
- Code and error strings.
- Semgrep prefixes `/fp`, `/ar`, and `/other`.

For a Semgrep dismissal, rewrite only the reason after the prefix. Do not post
a command prefix for a fixed finding. Final check: could a reviewer tell what
happened and why from this reply alone?

## Remove

- Thanks, praise, apologies, greetings, chatbot closers, and emojis.
- "Great catch", "you're right", "hope this helps", and similar filler.
- Review-process narration such as "addressed your feedback".
- Vague claims when a path, condition, result, or number is available.
- Repeated conclusions, forced summaries, decorative headings, and long setup.

## Patterns to detect and fix

Rule numbers are stable IDs that other skills cite. A removed rule leaves a gap.

### Content

3. **Superficial -ing phrases.** Delete or expand phrases such as
"highlighting...", "ensuring...", "reflecting...", "showcasing...", and "fostering..." with real sources.
5. **Vague attributions.** Name the source or delete claims such as "Experts believe", "Industry reports suggest", and "Some critics argue".

### Language

7. **AI vocabulary.** Replace words such as additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, abstract landscape, pivotal, showcase, tapestry, testament, underscore, and vibrant.
8. **Fancy ways to say "is".** Replace "serves as", "stands as", "boasts", and "features" with "is" or "has".
9. **"Not just X, but Y."** State the point directly.
10. **Rule of three.** Use the natural number instead of forcing three items.
11. **Synonym cycling.** Pick one term and repeat it in the paragraph.
12. **False ranges.** List topics directly when the endpoints are not a meaningful scale.

### Style

13. **Em dash overuse.** Avoid em dashes entirely. Use periods or commas only, not parentheses, en dashes, or hyphen-as-dash substitutes.
14. **Colon overuse.** Use colons only before a list or example. Rewrite mid-sentence connectors as direct sentences.
15. **Boldface overuse.** Do not bold every proper noun or acronym.
16. **Inline-header lists.** Convert a bold label that restates the line into prose.
17. **Title case headings.** Use sentence case.
18. **Decorative emojis.** Remove them from headings and bullets.
19. **Curly quotes.** Replace them with straight quotes.

### Communication artifacts

20. **Chatbot phrases.** Remove phrases such as "I hope this helps!", "Let me know if...", "Of course!", "Certainly!", and "Found the smoking gun!".
22. **Sycophantic tone.** Respond directly instead of saying "Great question!" or "You're absolutely right!".

### Filler

23. **Filler phrases.** Replace "in order to" with "to", "due to the fact that" with "because", and delete "it is important to note that".
24. **Excessive hedging.** Replace stacked qualifiers with a direct claim such as "may".
25. **Generic conclusions.** State specific plans or facts.

### Jargon and plain speech

26. **Abstract metaphor nouns.** Replace metaphorical jargon with a plain, concrete word. For example, "substrate" becomes "base" and "vector" becomes "way" or "method".
27. **Say what it does, not how it feels.** Name the mechanism or number. Write
what the sentence tells the reader to do or know. Cut it if that is not concrete
or if it could appear unchanged in another project's docs.
28. **Shorten or split dense sentences.** Use one idea per sentence or bullet.
29. **Active voice.** Name the actor, except when the actor is unknown or does not matter.
30. **Cut adverbs.** Use a stronger verb or a measured result.
31. **Prefer the plain word.** Use "use" instead of "utilize" or "leverage", "help" instead of "facilitate", "many" instead of "numerous", and "if" instead of "in the event that".
32. **Mannered prose.** Replace metaphor, flourish, rhetorical fragments, personified code, figurative verbs, and stock framing with literal language.
33. **Over-compression.** Restore dropped articles, verbless fragments, verbs, and meaning hidden by symbols or abbreviations. Spell out arrows and abbreviations.

Provenance: https://raw.githubusercontent.com/cursor/plugins/refs/heads/main/pstack/skills/unslop/SKILL.md
