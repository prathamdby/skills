---
name: peer-review
description: >
  peer-review a plan, design, or implementation, find the one critical risk,
  list other gaps, propose a fix for the critical risk, and update the plan.
  Triggers: peer review a plan, review an implementation, assess a design, check
  a proposal for gaps.
---

# Peer Review

## Step 1: Gather context

Read everything relevant before analyzing:

- **Requirements**: the spec, ticket, or PR description defining what must be built
- **Plan**: the implementation plan, design doc, or proposed changes
- **Code**: the actual implementation, diff, or relevant source
- **Contracts**: OpenAPI/protobuf/API docs; `package.json`/`requirements.txt`/`Cargo.toml` for related libs
- **History**: related bugs, incidents, or post-mortems
- **Tests**: existing test files for current coverage

## Step 2: Analyze against requirements

Compare the plan to the requirements. Check completeness, edge cases (boundaries,
empty inputs, max values, races), error states and rollback, failure modes (a
downstream service down/slow/returning garbage), hidden ordering or version
conflicts, performance (N+1, unbounded loops, leaks), security (input validation,
auth, secrets, data integrity), and test adequacy.

Focus on what is **most likely to cause failure**, not every theoretical issue.

## Step 3: Write the review

Exactly four sections. Maximum clarity, minimum words.

### Critical Risk

One paragraph naming **the single thing most likely to cause failure**, why it
is dangerous and under what conditions it breaks. Pick the highest-impact, most
probable one; do not list several.

### Other Gaps

Bulleted secondary issues, one line each, formatted `- <issue> → <impact>`. Only
real, material issues, no nitpicks or theoretical concerns.

### Fix

Numbered, concrete, actionable steps that address **the critical risk only**.

### Verdict

One sentence, exactly one of: "Ship it." / "Fix the critical risk first, then
ship." / "Needs rework." No explanation.

## Step 4: Update the plan

Apply the Fix steps to the plan files directly, the smallest change that
mitigates the critical risk. Report which files changed and the fix applied.

## Style

- Concrete language only. No vague warnings ("be careful with X").
- Back every claim with evidence from what you read.
