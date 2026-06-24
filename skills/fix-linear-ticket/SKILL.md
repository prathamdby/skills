---
name: fix-linear-ticket
description: >
  fix a Linear ticket end to end, fetch it, branch, plan with confirmation,
  implement, review. Triggers: fix a Linear ticket, work on a Linear issue,
  implement a Linear ticket, resolve a Linear bug. Flags: --base <branch>
  (default main) and an explicit ticket ID.
---

# Fix Linear Ticket

## Flags

| Flag / Arg        | Effect                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| `<ticket-id>`     | Linear ticket identifier (e.g. `ENG-123`). Extracted from the message. |
| `--base <branch>` | Base branch to branch from. **Default: `main`.**                       |

If no ticket ID is found, stop and ask: "Which Linear ticket should I fix?
Please provide the ticket ID."

## Step 1: Fetch ticket details

Use Linear MCP tools to fetch the full record: title, description, comments,
attachments, linked issues, labels, state, priority. Never infer ticket content
from the ID alone. If Linear MCP is unavailable, the ticket is not found, or the
API errors, stop and report.

## Step 2: Derive the branch name

Convention: `pd/<type>/<ticket-id>-<slug>`.

- `<type>`: `fix` (bug/defect), `feat` (feature/enhancement), `chore`
  (maintenance/tooling), `docs` (documentation). Default `fix` when unclear.
- `<ticket-id>`: lowercase.
- `<slug>`: kebab-case from the title, 4-5 words max.

Example: ENG-123 "Fix auth redirect loop" → `pd/fix/eng-123-fix-auth-redirect-loop`.

If the name cannot be constructed, stop and ask the user for one.

## Step 3: Create the branch off base

```bash
git fetch origin <base-branch>
git checkout <base-branch>
git reset --hard origin/<base-branch>
git checkout -b <derived-branch-name>
```

Report the branch created.

## Step 4: Plan the fix

Search the codebase for files related to the ticket, function/component/module
names from the description, and the bug area or feature surface. Read them to
understand the current implementation. Then outline: files to change, the change
per file, dependencies/ordering, and risks or edge cases. See `./REFERENCE.md`
for the full search strategy.

Present the plan, then **wait for explicit user confirmation** before writing
any code.

## Step 5: Implement the fix

Apply the approved changes only. Keep changes focused and minimal, and do not
touch unrelated code.

## Step 6: Review

Re-read every changed file and check it against the four review checks in
`./REFERENCE.md`: ticket requirements met, no regressions, edge cases covered,
style consistent with surrounding code.

Report: what was implemented, how it addresses the ticket, any regressions or
edge cases, and follow-up work.

## Constraints

- **Never commit, build, run tests, or push.** Do none of these unless the user
  asks outside this skill.
- **Never infer ticket content.** Always fetch from Linear.
- If the ticket or branch name cannot be found, stop and ask.
