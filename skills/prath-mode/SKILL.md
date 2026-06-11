---
name: prath-mode
description: >
  Route tasks to the right skill in prathamdby/skills. Verifies the leaf skill
  is installed before invoking it. Use when the user types /prath-mode or wants
  Pratham's composable agent workflow. Read the matched leaf skill in full
  before executing.
disable-model-invocation: true
---

# Prath mode

## Non-negotiables

Read the matched leaf skill in full before executing. Do not restate or
improvise its workflow.

- Commit or write a commit message → **commit** (`../commit/SKILL.md`)
- Strip AI slop or simplify a diff → **deslop** (`../deslop/SKILL.md`)
- Open a pull request → **make-pr** (`../make-pr/SKILL.md`)
- Fix or implement a Linear ticket → **fix-linear-ticket**
  (`../fix-linear-ticket/SKILL.md`)
- Review a plan, design, or implementation → **peer-review**
  (`../peer-review/SKILL.md`)
- Clone or search an external git repo → **box** (`../box/SKILL.md`)
- Delegate work to an external agent → **assign** (`../assign/SKILL.md`)
- Save session context or resume a handoff → **handoff** (`../handoff/SKILL.md`)

When the user's request matches multiple skills, pick the leaf skill that owns
the immediate action. Use workflow chains below for multi-step work.

## Workflow chains

Run skills in order. Read each leaf skill before that step.

1. **Ship ticket work:** `fix-linear-ticket` → implement → `deslop` → `commit`
   → `make-pr` (pass `--ticket` to make-pr when the ID is known)
2. **Ship planned work:** `peer-review` → implement → `deslop` → `commit` →
   `make-pr`
3. **Quick save:** `deslop` (optional) → `commit`
4. **Research external code:** `box`
5. **Delegate heavy lift:** `assign`
6. **End or resume session:** `handoff` or `handoff --resume <path>`

## Composition rules

- Do not improvise commit or PR formatting when **commit** or **make-pr** apply
- **commit** uses the git diff only. Ignore session context for the message
- **make-pr** never commits, builds, runs, or pushes
- **make-pr** uses plain-English titles unless `--conventional` is passed
- **fix-linear-ticket** plans the fix and waits for user confirmation before
  writing code
- **deslop** runs before **commit** when both apply in a chain
- **peer-review** runs before implementation when a plan exists and has not been
  reviewed

## Step 0: Read REFERENCE.md (mandatory)

**Do not proceed to Step 1 or any later step until you have read `REFERENCE.md`
in full.**

1. Use the Read tool on `./REFERENCE.md` in this skill's directory (same folder
   as this file).
2. Treat every trigger, flag, never-rule, and workflow chain in that file as
   binding for this session.
3. If you have not read it yet, stop and read it now. Skipping this step causes
   wrong skill selection.

## Step 1: Match

Match the user's request to one leaf skill or one workflow chain from
REFERENCE.md.

If no skill matches, say so and ask what the user wants to do.

## Step 2: Verify installation

Before reading or executing a leaf skill, confirm it is installed.

1. Resolve the path `../<skill-name>/SKILL.md` relative to this skill's
   directory (same folder as this file).
2. Check the file exists. Use the Read tool or
   `test -f ../<skill-name>/SKILL.md` from this skill's directory.
3. If the file is missing, stop. Report the skill name, the path you checked,
   and tell the user to install it:
   `npx skills@latest add prathamdby/skills`
4. Do not improvise the leaf skill's workflow when it is not installed.

**Chains:** verify every leaf skill in the chain before starting the first step.
Skip `implement` (not a skill). If any skill is missing, list all missing names
in one message.

Re-check before each chain step. The user may install skills between steps.

## Step 3: Read and invoke

1. Read the leaf skill's `SKILL.md` in full.
2. Execute per the leaf skill. For chains, complete each step before starting
   the next unless the user narrows scope.
