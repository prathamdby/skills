# Fix Linear Ticket Reference

## Branch type derivation table

| Ticket type / label  | Branch type prefix | Example ticket                   | Example branch name                     |
| -------------------- | ------------------ | -------------------------------- | --------------------------------------- |
| Bug, defect, issue   | `fix`              | ENG-123 "Fix auth redirect loop" | `pd/fix/eng-123-fix-auth-redirect-loop` |
| Feature, enhancement | `feat`             | TEAM-456 "Add dark mode toggle"  | `pd/feat/team-456-add-dark-mode-toggle` |
| Maintenance, tooling | `chore`            | ENG-789 "Update CI config"       | `pd/chore/eng-789-update-ci-config`     |
| Documentation        | `docs`             | TEAM-012 "Add API reference"     | `pd/docs/team-012-add-api-reference`    |

If unclear, default to `fix`.

## Step 4: Detailed codebase search strategy

1. **Search the codebase** for files related to the ticket:
   - Search for function names, component names, or modules mentioned in the
     ticket description
   - Search for existing code that matches the bug area or feature request
   - Read relevant files to understand the current implementation
2. **Outline the approach**:
   - List affected files
   - Describe what changes are needed in each file
   - Note any dependencies or ordering constraints
   - Flag potential risks or edge cases
3. **Present the plan** to the user in a concise, structured format:
   - Files to change
   - Changes per file
   - Any concerns or open questions

## Step 6: Detailed review checks

After implementation, re-read every file that was changed:

1. **Verify against ticket requirements**: Does the change satisfy the ticket
   description, title, and any acceptance criteria?
2. **Check for regressions**: Did the change break existing behavior, tests, or
   adjacent functionality?
3. **Flag edge cases**: Are there scenarios the fix does not cover? Are there
   race conditions, null states, or error paths not handled?
4. **Compare with original code**: Is the new code consistent with the
   surrounding codebase in style, abstraction level, and naming?
