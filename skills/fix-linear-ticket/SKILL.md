---
name: fix-linear-ticket
description: >
  Fetch a Linear ticket, create a branch, plan the fix with user confirmation,
  implement it, and review changes. Use when the user asks to fix a Linear
  ticket, work on a Linear issue, implement a Linear ticket, or resolve a
  Linear bug. Supports --base <branch> (default: main) and explicit ticket
  ID arguments.
---

# Fix Linear Ticket

## When to use this skill

Activate when the user asks to fix a Linear ticket, work on a Linear issue,
implement a Linear ticket, or resolve a Linear bug.

## Flag detection

After activation, inspect the user's message for the following:

| Flag / Arg        | Effect                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `<ticket-id>`     | The Linear ticket identifier (e.g., `ENG-123`, `TEAM-456`). Extracted from the user's message if present. |
| `--base <branch>` | The base branch to branch from. **Default: `main`** if not provided.                                      |

If the ticket ID is not found in the user's message, stop and ask:
"Which Linear ticket should I fix? Please provide the ticket ID."

## Step 1: Fetch ticket details

Use available Linear MCP tools to fetch the full ticket record for the
identified ticket ID. Request:

- Title
- Description
- Comments
- Attachments
- Linked issues
- Labels / state / priority (useful for deriving branch type)

**Constraints:**

- Never infer ticket content from the ID alone. Always fetch from Linear.
- If Linear MCP is unavailable, or the ticket is not found, or the API returns
  an error, stop immediately and report the issue to the user. Do not
  proceed with assumed content.

## Step 2: Derive branch name

Construct the branch name using the project branching convention:
`pd/<type>/<ticket-id>-<slug>`

Where:

- `<type>` is derived from the ticket labels or type if available:
  - `fix` for bugs, defects, or issues
  - `feat` for features or enhancements
  - `chore` for maintenance, refactors, or tooling
  - `docs` for documentation
  - If unclear, default to `fix`
- `<ticket-id>` is the original Linear identifier in lowercase (e.g., `eng-123`)
- `<slug>` is a kebab-case slug derived from the ticket title, max 4-5 words

Examples:

- Ticket `ENG-123` "Fix auth redirect loop" → `pd/fix/eng-123-fix-auth-redirect-loop`
- Ticket `TEAM-456` "Add dark mode toggle" → `pd/feat/team-456-add-dark-mode-toggle`

If the branch name cannot be constructed (e.g., ticket title is empty or
unusable), stop and ask the user for a branch name.

## Step 3: Create branch off base

1. Fetch the base branch (from `--base` flag, default `main`):
   ```bash
   git fetch origin <base-branch>
   ```
2. Check out the base branch at its latest remote state:
   ```bash
   git checkout <base-branch>
   git reset --hard origin/<base-branch>
   ```
3. Create and check out the derived branch:
   ```bash
   git checkout -b <derived-branch-name>
   ```

Report the branch created to the user.

## Step 4: Plan the fix

Read the fetched ticket details thoroughly. Then:

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

**Wait for explicit user confirmation** before proceeding to implementation.

If the user rejects the plan or requests changes, revise the plan and present
it again. Do not write any code until the user approves.

## Step 5: Implement the fix

Once the user confirms the plan, make the code changes:

- Apply the approved changes to the listed files
- Make focused, minimal changes that directly address the ticket
- Do not change unrelated code, even if you notice other issues
- Follow the codebase's existing patterns and style

## Step 6: Review

After implementation, re-read every file that was changed:

1. **Verify against ticket requirements**: Does the change satisfy the ticket
   description, title, and any acceptance criteria?
2. **Check for regressions**: Did the change break existing behavior, tests, or
   adjacent functionality?
3. **Flag edge cases**: Are there scenarios the fix does not cover? Are there
   race conditions, null states, or error paths not handled?
4. **Compare with original code**: Is the new code consistent with the
   surrounding codebase in style, abstraction level, and naming?

Report a summary to the user:

- What was implemented
- How it addresses the ticket
- Any regressions or edge cases flagged
- Any follow-up work recommended

## Constraints (strict)

- **Never commit.** Do not run `git commit` at any point.
- **Never build.** Do not run build commands unless the user explicitly asks
  outside this skill.
- **Never run tests.** Do not run test commands unless the user explicitly asks
  outside this skill.
- **Never push.** Do not run `git push` at any point.
- **Never infer ticket content.** Always fetch from Linear. Do not guess
  requirements from the ticket ID.
- **If the ticket or branch name cannot be found, stop and ask.** Do not
  proceed with missing information.
