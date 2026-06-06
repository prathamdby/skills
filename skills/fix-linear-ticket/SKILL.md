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

| Flag / Arg        | Effect                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `<ticket-id>`     | The Linear ticket identifier (e.g., `ENG-123`, `TEAM-456`). Extracted from the user's message if present. |
| `--base <branch>` | The base branch to branch from. **Default: `main`** if not provided.                                      |

If the ticket ID is not found, stop and ask: "Which Linear ticket should I fix? Please provide the ticket ID."

## Step 0: Read REFERENCE.md (mandatory)

**Do not proceed to Step 1 or any later step until you have read `REFERENCE.md` in full.**

1. Use the Read tool on `./REFERENCE.md` in this skill's directory (same folder as this file).
2. Treat every branch-naming rule, search strategy, and review check in that file as binding for this session.
3. If you have not read it yet, stop and read it now. Skipping this step causes wrong branch names and incomplete plans.

## Step 1: Fetch ticket details

Use available Linear MCP tools to fetch the full ticket record. Request: title, description, comments, attachments, linked issues, labels / state / priority.

**Constraints:**

- Never infer ticket content from the ID alone. Always fetch from Linear.
- If Linear MCP is unavailable, the ticket is not found, or the API returns an error, stop immediately and report to the user.

## Step 2: Derive branch name

Use the convention: `pd/<type>/<ticket-id>-<slug>` where `<type>` is `fix` (bugs), `feat` (features), `chore` (maintenance), or `docs` (documentation), defaulting to `fix`; `<ticket-id>` is lowercase; and `<slug>` is kebab-case from the title, max 4-5 words. See REFERENCE.md for examples.

If the branch name cannot be constructed, stop and ask the user for a branch name.

## Step 3: Create branch off base

1. Fetch the base branch:
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

1. Search the codebase for related files.
2. Outline affected files, changes needed, dependencies, and risks.
3. Present the plan concisely to the user.

**Wait for explicit user confirmation** before implementing. See REFERENCE.md for detailed search strategy.

## Step 5: Implement the fix

- Apply approved changes to listed files
- Make focused, minimal changes
- Do not change unrelated code
- Follow existing patterns and style

## Step 6: Review

1. Verify against ticket requirements
2. Check for regressions
3. Flag edge cases
4. Compare style consistency with original code

Report: what was implemented, how it addresses the ticket, any regressions or edge cases, and follow-up work. See REFERENCE.md for detailed review checks.

## Constraints (strict)

- **Never commit.** Do not run `git commit` at any point.
- **Never build.** Do not run build commands unless the user explicitly asks outside this skill.
- **Never run tests.** Do not run test commands unless the user explicitly asks outside this skill.
- **Never push.** Do not run `git push` at any point.
- **Never infer ticket content.** Always fetch from Linear.
- **If the ticket or branch name cannot be found, stop and ask.**
- **Never skip Step 0.** REFERENCE.md holds branch examples, search strategy, and review checks this skill depends on.
