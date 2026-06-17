# Fix Linear Ticket Reference

Deep detail for Step 4 (planning) and Step 6 (review).

## Step 4: Codebase search strategy

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

## Step 6: Review checks

After implementation, re-read every changed file and verify:

1. **Ticket requirements**: does the change satisfy the description, title, and
   acceptance criteria?
2. **Regressions**: did it break existing behavior, tests, or adjacent code?
3. **Edge cases**: any scenario the fix misses, race conditions, null states,
   error paths?
4. **Style**: is the new code consistent with surrounding style, abstraction
   level, and naming?
