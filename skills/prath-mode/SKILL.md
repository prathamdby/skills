---
name: prath-mode
description: >
  Route a task to the right skill in prathamdby/skills and run multi-step
  workflow chains. Verifies the leaf skill is installed before invoking it.
disable-model-invocation: true
---

# Prath mode

Read the matched leaf skill in full before executing. Do not restate or
improvise its workflow. The leaf owns its own triggers, flags, and rules.

## Routing map

| Action                                   | Leaf skill                                              |
| ---------------------------------------- | ------------------------------------------------------- |
| Commit or write a commit message         | **commit** (`../commit/SKILL.md`)                       |
| Strip AI slop or simplify a diff         | **deslop** (`../deslop/SKILL.md`)                       |
| Open a pull request                      | **make-pr** (`../make-pr/SKILL.md`)                     |
| Fix or implement a Linear ticket         | **fix-linear-ticket** (`../fix-linear-ticket/SKILL.md`) |
| Review a plan, design, or implementation | **peer-review** (`../peer-review/SKILL.md`)             |
| Clone or search an external git repo     | **box** (`../box/SKILL.md`)                             |
| Delegate work to an external agent       | **assign** (`../assign/SKILL.md`)                       |
| Save session context or resume a handoff | **handoff** (`../handoff/SKILL.md`)                     |

When a request matches several skills, pick the leaf that owns the immediate
action. For multi-step work, use a chain below.

## Workflow chains

Run in order. Read each leaf before its step. `implement` is not a skill.

1. **Ship ticket work:** `fix-linear-ticket` → implement → `deslop` → `commit` →
   `make-pr` (pass `--ticket` to make-pr when the ID is known)
2. **Ship planned work:** `peer-review` → implement → `deslop` → `commit` → `make-pr`
3. **Quick save:** `deslop` (optional) → `commit`
4. **Research external code:** `box`
5. **Delegate heavy lift:** `assign`
6. **End or resume session:** `handoff` or `handoff --resume <path>`

## Step 1: Match

Match the request to one leaf or one chain. If nothing matches, say so and ask
what the user wants.

## Step 2: Verify installation

Before reading or executing a leaf, confirm it is installed: resolve
`../<skill-name>/SKILL.md` relative to this skill's directory and check it exists
(`test -f` or the Read tool). For a chain, verify every leaf before the first
step and re-check before each subsequent step, the user may install skills
between steps.

If any leaf is missing, stop and report its name and checked path, list all
missing names in one message, and tell the user to install:
`npx skills@latest add prathamdby/skills`. Never improvise a missing leaf's
workflow.

## Step 3: Read and invoke

Read the matched leaf's `SKILL.md` in full, then execute per the leaf. For
chains, complete each step before starting the next unless the user narrows scope.
