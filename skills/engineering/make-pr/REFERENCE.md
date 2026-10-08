# PR body

Load for a nonempty locked diff. Measure its files (name-only), churn
(numstat additions + deletions), and areas (distinct top-level path segments).
First match: deep if files > 12, churn > 400, or areas >= 4 with files >= 8;
shallow if files <= 3 and churn <= 80; otherwise standard. Record depth.

## Shape

1. Optional link header only for URLs pasted in this request: exact URLs,
   labels from user or host, joined by ` | `. Links prove no motives.
2. `## Why the change`: one sentence describing the observable change the
   diff proves, not a product motive or conversation claim.
3. `## Special things to note`: one to three proved hazard bullets or `- None.`
   Hazards include breaks, migrations, constraints, deliberate omissions,
   surprising shapes, or explicit user wording.
4. `## Change outline`: optional short captions beside fenced views.
5. One blank line, then `Closes #N` per explicit issue, no heading.

These are the only level-two headings. Omit tests, rollout, unproved motives,
ticket claims, and harness footers. Cluster hunks into themes, not commits.
Cover useful distinct shapes without padding; for each theme needing a view,
select it using `references/views.md`.

## Voice

Write active, grammatical sentences with one idea each. Keep technical
literals in code and use one plain term per act. Use sentence-case headings,
American spelling, serial commas, and straight quotes. Necessary uncertainty
stays; claims not proved by the diff go.

Use periods or commas instead of dash/parenthesis substitutes. Colons introduce
lists/examples. Avoid contrast templates, forced threes, synonym cycling,
decorative bold/emojis, AI vocabulary, inflated copulas, filler, and marketing.
Prefer use/help/many/if to utilize/facilitate/numerous/in-the-event-that.
Do not write we, let's, please, simply, easy, quickly, slang, tl;dr, or exclamations.

Done when every title/body/caption/view claim has a hunk trace, the three-heading
shape and depth hold, and the footer issue set exactly equals the requested set.

Compatibility: Body hygiene now lives in `references/body-hygiene.md`.
