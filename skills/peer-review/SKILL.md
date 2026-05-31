---
name: peer-review
description: >
  Review implementation plans, technical designs, and code changes for gaps,
  risks, and completeness. Use when the user asks for a peer review,
  review of a plan, review of an implementation, assess a design, or check
  a proposal for issues. Focuses on what matters most and updates the plan
  with fixes.
---

# Peer Review

## When to use this skill

Activate when the user asks to peer review a plan, review an implementation,
assess a design, check a proposal for gaps, or evaluate a technical approach.

## Step 1: Gather context

Use available tools to pull everything relevant before analyzing:

- **Requirements**: Read the spec, ticket, or PR description that defines what must be built
- **Implementation plan**: Read the plan, design doc, or proposed changes
- **Code / changes**: Read the actual implementation, diff, or relevant source files
- **API specs**: Read OpenAPI specs, protobuf definitions, or API documentation
- **Dependencies**: Check `package.json`, `requirements.txt`, `Cargo.toml`, etc. for related libraries
- **Recent incidents**: Search for related bugs, incidents, or post-mortems in the codebase or docs
- **Tests**: Read existing test files to understand current coverage

Do not proceed to analysis until you have read all relevant materials.

## Step 2: Analyze the plan against requirements

Compare the implementation plan to the requirements. Check:

- **Completeness**: Are all requirements addressed? What's missing?
- **Edge cases**: What happens at boundaries, empty inputs, max values, race conditions?
- **Error states**: How are failures handled? Are rollback paths defined?
- **Failure modes**: What breaks if a downstream service is down, slow, or returns garbage?
- **Dependencies**: Are there hidden ordering constraints? Circular imports? Version conflicts?
- **Performance**: Will this scale? Are there N+1 queries, unbounded loops, or memory leaks?
- **Security**: Are inputs validated? Is auth checked? Are secrets handled safely? Is data integrity protected?
- **Testing**: Is the test strategy adequate? Are integration tests included? What about load or chaos testing?

Focus on what is **most likely to cause failure**, not every theoretical issue.

## Step 3: Structure the response

Format the review in exactly four sections. Be concise. Maximum clarity, minimum words.

### Critical Risk

A single paragraph identifying **the one thing most likely to cause failure**.
Explain why it is dangerous and under what conditions it will break.
Do not list multiple risks here. Pick the highest-impact, most probable one.

### Other Gaps

A bulleted list of **secondary issues**, one line each. Format each bullet as:

```
- <issue> → <impact>
```

Only include issues that are real and material. Skip nitpicks and theoretical concerns.

### Fix

Numbered steps to **address the critical risk only**. The fix must be concrete,
actionable, and limited to the critical risk. Do not try to fix everything.

### Verdict

A single sentence choosing one of:

- "Ship it."
- "Fix the critical risk first, then ship."
- "Needs rework."

No explanation. Just the sentence.

## Step 4: Update the plan with fixes

Apply the fix steps to the implementation plan. Edit the plan files directly
to incorporate the critical risk mitigation. Make the smallest necessary
changes to address the critical risk.

After updating, report what files were changed and summarize the fix applied.

## Style rules

- Use concrete language. No vague warnings ("be careful with X").
- Every claim must be backed by evidence from the materials you read.
- If you are unsure about something, say so explicitly rather than guessing.
- Prefer brevity over completeness. A short, accurate review is more useful
  than a long, diluted one.
