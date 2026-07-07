# Fix Linear Ticket Reference

Deep detail for Step 2 (mode classification), Step 5 (planning), and Step 7
(review).

## Mode classification

Classify from the ticket's title, body, and labels. Pick the first matching mode:

1. **debug** — title or body mentions bug, regression, error, crash, failure,
   broken, or failing behavior. Labels: `bug`, `defect`, `regression`.
2. **trivial** — small clerical change: rename, typo, config tweak, label
   update, dependency bump, single-line fix. Body is short and scoped to one
   or two spots.
3. **scratch** — new feature, new module, new endpoint, new component, or any
   new surface that does not yet exist in the codebase. Labels: `feature`,
   `enhancement`.
4. **modify** — changes to existing functionality, enhancement of existing
   code, or adjustment of existing behavior. The codebase already has the
   surface being changed.

Default to `modify` when no signal is strong enough to pick another mode.

## Step 5: Codebase search strategy

1. **Search the codebase** for files related to the ticket:
   - Function names, component names, or modules named in the description
   - Existing code matching the bug area or feature request
   - Read the relevant files to understand the current implementation
2. **Outline the approach**:
   - List affected files
   - Describe the change needed in each
   - Note dependencies or ordering constraints
   - Flag risks or edge cases
3. **Present the plan** concisely: files to change, change per file, open questions.

### Mode-specific planning emphasis

- **debug**: identify the root cause area and existing tests covering it. Plan
  reproduction steps before any fix.
- **scratch**: identify the target surface (file, module, endpoint), acceptance
  criteria, and what scaffolding is needed.
- **modify**: identify the existing implementation to modify and its callers.
- **trivial**: confirm the exact scope (one or two spots) and skip deep search.

## Step 7: Review checks

After implementation, re-read every changed file and verify:

1. **Ticket requirements**: does the change satisfy the description, title, and
   acceptance criteria?
2. **Regressions**: did it break existing behavior, tests, or adjacent code?
3. **Edge cases**: any scenario the fix misses, race conditions, null states,
   error paths?
4. **Style**: is the new code consistent with surrounding style, abstraction
   level, and naming?
