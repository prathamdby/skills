---
name: fix-linear-ticket
description: >
  fix a Linear ticket end to end: fetch it, branch, classify mode, plan,
  implement, review. Flags: --base <branch> (default main), --mode <mode>
  (default auto; values: auto, scratch, modify, debug, trivial), and a
  ticket ID positional arg.
---

# Fix Linear Ticket

## Flags

| Flag / Arg        | Effect                                                                  |
| ----------------- | ----------------------------------------------------------------------- |
| `<ticket-id>`     | Linear ticket identifier (e.g. `ENG-123`). Extracted from the message.  |
| `--base <branch>` | Base branch to branch from. **Default: `main`.**                        |
| `--mode <mode>`   | `auto`, `scratch`, `modify`, `debug`, `trivial`. **Default: `auto`.**   |

If no ticket ID is found, stop and ask: "Which Linear ticket should I fix?
Please provide the ticket ID."

## Step 1: Fetch ticket details

Use Linear MCP tools to fetch the full record: title, description, comments,
attachments, linked issues, labels, state, priority. Never infer content from the
ID alone. If MCP is unavailable, the ticket is missing, or the API errors, stop
and report. **Done when** the full record is loaded, or you have stopped with an error.

## Step 2: Classify mode

If `--mode` was passed explicitly, use it. Otherwise classify from the ticket
title, body, and labels using "Mode classification" in `./REFERENCE.md`. Announce
the chosen mode and its signal in one line, then proceed without asking for mode
confirmation. **Done when** one mode is named with its signal in a single line.

## Step 3: Derive the branch name

Convention: `pd/<type>/<ticket-id>-<slug>`.

- `<type>`: `fix` (bug/defect), `feat` (feature/enhancement), `chore`
  (maintenance/tooling), `docs` (documentation). Default `fix` when unclear.
- `<ticket-id>`: lowercase.
- `<slug>`: kebab-case from the title, 4-5 words max.

Example: ENG-123 "Fix auth redirect loop" → `pd/fix/eng-123-fix-auth-redirect-loop`.

If the name cannot be constructed, stop and ask. **Done when** a valid name is set or you have asked.

## Step 4: Create the branch off base

```bash
git fetch origin <base-branch>
git checkout <base-branch>
git reset --hard origin/<base-branch>
git checkout -b <derived-branch-name>
```

Report the branch created. **Done when** you are on the new branch with no uncommitted base changes.

## Step 5: Plan the fix

Search the codebase for files related to the ticket, read them, and outline:
files to change, change per file, dependencies/ordering, risks. Follow the
search strategy and mode-specific planning emphasis in `./REFERENCE.md`.

Present the plan, then **wait for explicit user confirmation** before writing
code. `trivial` mode may skip confirmation for a single clerical edit with no
logic risk; still report scope before acting. **Done when** a plan is presented and (unless trivial) confirmed by the user.

## Step 6: Implement the fix

Apply the approved changes only. Keep changes focused and minimal, and do not
touch unrelated code. **Done when** the applied changes match the approved plan.

- **debug**: reproduce and collect evidence before changing code; add regression
  coverage where feasible.
- **scratch**: confirm target surface and acceptance criteria first; scaffold
  defaults only if new surfaces are needed.
- **modify**: preserve existing behavior; diff against current implementation.
- **trivial**: make the small change directly; skip elaborate scaffolding.

## Step 7: Review

Re-read every changed file and check it against the four review checks in
`./REFERENCE.md`: ticket requirements met, no regressions, edge cases covered,
style consistent with surrounding code.

Report: what was implemented, how it addresses the ticket, any regressions or
edge cases, and follow-up work. **Done when** the report covers implementation, ticket fit, risks, and follow-ups.

## Constraints

- This skill ends at review. Run commits, builds, tests, and pushes only on the
  user's explicit request, outside this skill.
- Always fetch ticket content from Linear; never infer it from the ID.
- If the ticket or branch name cannot be found, stop and ask.
