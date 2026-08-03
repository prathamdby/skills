# Make PR reference

## Body scale

Load during Step 2 after the locked diff is non-empty. Measure only that
diff:

| Metric | Source |
|---|---|
| `files` | count of paths in `git diff --name-only <target>...HEAD` |
| `churn` | sum of added and deleted lines from `git diff --numstat <target>...HEAD` |
| `areas` | count of distinct top-level path segments among those files |

Pick **exactly one** tier with this order (first match wins):

1. **L** when `files` > 12, or `churn` > 400, or (`areas` ≥ 4 and `files` ≥ 8).
2. **S** when `files` ≤ 3 and `churn` ≤ 80.
3. **M** for every other non-empty diff.

| Tier | Summary bullets | Extra sections | Depth |
|---|---|---|---|
| S | 1–3 | none | Outcomes only. Name what changed for the user of the code. Skip deep call chains. |
| M | 3–7 | Add `## Details` when two or more themes need more than one line each | Name key files and symbols the diff proves. State behavior change in plain words. |
| L | 5–12 | `## Details` required. Add `## Breaking` only when the diff proves a break | Explain modules, contracts, and call-path deltas the hunks show. |

Rules for every tier:

- Cluster related hunks into themes. Never one bullet per commit.
- Bullet count is a range, not a quota. Cover each theme once. Do not pad.
- Default body always starts with `## Summary` and its bullets.
- Open extra sections only when the tier allows them **and** the locked
  diff supplies evidence for that section.
- Include no test, rollout, motive, or ticket claim the diff cannot prove.
- Never draft harness footers (`Made with Cursor`, identity trailers, peers).
- Record the chosen tier in the ledger next to title/body so Step 4 can
  restate it.

### Draft procedure

1. Measure `files`, `churn`, and `areas` from the locked diff.
2. Select the tier with the first-match order above.
3. Cluster hunks into themes.
4. Write `## Summary` bullets at that tier's depth and count range.
5. Add allowed extra sections only when evidence exists.
6. Apply STE100 below to every body sentence and bullet.
7. Map every title phrase and body line to proving paths and hunks.
   Rewrite untraced copy.

Done when format, tier, STE100, and clean-room trace all pass.

## STE100 for PR bodies

Apply ASD-STE100 discipline to body prose (not to path or symbol literals):

- Use one plain word for one idea. Do not rotate synonyms for the same act.
- Write active voice. Name the actor: "The skill measures the diff."
- Use simple tense. Prefer "The body uses tier M." over perfect forms.
- Keep instructional lines at 20 words or fewer. Keep descriptive bullets
  at 25 words or fewer.
- Keep one topic per paragraph and one idea per bullet.
- Use a list when three or more parallel points appear.
- Keep necessary technical nouns (API names, flags, path segments). Define a
  rare term once in the same bullet if a stranger would misread it.
- Do not soften claims with empty hedges. If the diff does not prove a
  claim, delete the claim.

Title lines keep the Step 2 title rules; still prefer active imperative
wording and plain words.

## Body hygiene

Load only during Step 4 verify after a create or update.

The published PR body must equal the ledger body. Harnesses and platform
hooks often append marketing footers after create or edit.

Banned additions (case-insensitive; strip whether freeform or `Key: value`):

- `Made with Cursor`, `Made-with: Cursor`, or Cursor product links used as a
  footer
- `Generated with Claude`, `Generated with Claude Code`, or similar Claude
  Code marketing lines
- `Co-authored-by:` / `Signed-off-by:` identity trailers in the PR body
- Any trailing block after the ledger body separated by a blank line that the
  ledger did not include

Detect: read the PR body back. Normalize only a single trailing newline for
comparison. Any other difference from the ledger body is dirty.

When dirty:

1. Update the PR body once to the exact ledger body. Change no other field.
2. Re-read the body. Any remaining difference from the ledger is `BLOCKED`;
   report the leftover lines.
3. Report whether a body strip ran.

Never draft banned footers in Step 2. Never treat a harness footer as part of
the summary.
