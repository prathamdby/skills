# Prath Mode Reference

Skill catalog for routing. Sibling paths assume skills are installed together
(e.g. via skills.sh).

## Install verification

Before invoking a leaf skill, confirm `../<skill-name>/SKILL.md` exists relative
to the prath-mode skill directory.

| Check  | Command or tool                                        |
| ------ | ------------------------------------------------------ |
| Exists | `test -f ../<skill-name>/SKILL.md` from prath-mode dir |
| Read   | Read tool on `../<skill-name>/SKILL.md`                |

**If missing**, stop and report:

```
Skill not installed: <skill-name>
Expected path: ../<skill-name>/SKILL.md

Install with:
npx skills@latest add prathamdby/skills
```

Pick the missing skill in the installer. Do not run the leaf workflow without
an installed `SKILL.md`.

**Chains:** collect leaf skill names from the chain (not `implement`). Verify
all before the first step. Re-verify before each subsequent leaf step.

| Chain                  | Skills to verify                                            |
| ---------------------- | ----------------------------------------------------------- |
| Ship ticket work       | fix-linear-ticket, deslop, commit, make-pr                  |
| Ship planned work      | peer-review, deslop, commit, make-pr                        |
| Quick save             | deslop, commit (deslop optional but still check if invoked) |
| Research external code | box                                                         |
| Delegate heavy lift    | assign                                                      |
| End or resume session  | handoff                                                     |

## Handoff integration

When **handoff** writes a "Suggested skills" section, use skill names and
rationales from this catalog only.

## Workflow chains

| Chain                  | Sequence                                                  |
| ---------------------- | --------------------------------------------------------- |
| Ship ticket work       | fix-linear-ticket → implement → deslop → commit → make-pr |
| Ship planned work      | peer-review → implement → deslop → commit → make-pr       |
| Quick save             | deslop (optional) → commit                                |
| Research external code | box                                                       |
| Delegate heavy lift    | assign                                                    |
| End or resume session  | handoff / handoff --resume                                |

---

## commit

**Path:** `../commit/SKILL.md`

**Triggers:** `/commit`, commit changes, save work to git, write a commit
message.

**Flags:**

| Flag                          | Default          |
| ----------------------------- | ---------------- |
| `--staged` / `--unstaged`     | `--staged`       |
| `--conventional` / `--simple` | `--conventional` |

**Never:**

- Base the message on conversation context, reviews, or ticket text
- Skip reading `../commit/REFERENCE.md` (Step 0 in leaf skill)

**Chains:** Quick save, Ship ticket work, Ship planned work

---

## deslop

**Path:** `../deslop/SKILL.md`

**Triggers:** `/deslop`, clean AI artifacts, remove bloat, simplify code,
strip over-engineered patterns, review changes for slop.

**Flags:**

| Flag                                          | Default                         |
| --------------------------------------------- | ------------------------------- |
| `--staged` / `--unstaged` / `--base <branch>` | `--staged` (mutually exclusive) |

**Never:**

- Change behavior while removing slop
- Skip reading `../deslop/REFERENCE.md` (Step 0 in leaf skill)

**Chains:** Quick save, Ship ticket work, Ship planned work

---

## make-pr

**Path:** `../make-pr/SKILL.md`

**Triggers:** open a PR, create a pull request, submit a PR.

**Flags:**

| Flag                | Default                   |
| ------------------- | ------------------------- |
| `--target <branch>` | `main`                    |
| `--ticket <id>`     | off                       |
| `--conventional`    | off (plain-English title) |

**Never:**

- Commit, build, run, or push
- Auto-detect Linear issues from branch names or commits
- Use conventional commit prefixes in the title unless `--conventional` is
  passed

**Chains:** Ship ticket work, Ship planned work

---

## fix-linear-ticket

**Path:** `../fix-linear-ticket/SKILL.md`

**Triggers:** fix a Linear ticket, work on a Linear issue, implement a Linear
ticket, resolve a Linear bug.

**Flags:**

| Flag              | Default                   |
| ----------------- | ------------------------- |
| `<ticket-id>`     | required (ask if missing) |
| `--base <branch>` | `main`                    |

**Never:**

- Implement before user confirms the plan
- Skip reading `../fix-linear-ticket/REFERENCE.md` (Step 0 in leaf skill)

**Chains:** Ship ticket work

---

## peer-review

**Path:** `../peer-review/SKILL.md`

**Triggers:** peer review a plan, review an implementation, assess a design,
check a proposal for gaps.

**Flags:** none

**Never:**

- Review without gathering plan, requirements, and relevant code context first

**Chains:** Ship planned work

---

## box

**Path:** `../box/SKILL.md`

**Triggers:** VCS URL, previously cloned repo name, clone/search/explore a git
repo.

**Flags:**

| Flag        | Effect                                             |
| ----------- | -------------------------------------------------- |
| `--persist` | Save repo reference in working directory AGENTS.md |
| `--update`  | Force-pull cloned repo                             |
| `--list`    | Show cloned repos in manifest                      |

**Never:**

- Touch repositories directly from the main thread (coordinator + subagents only)
- Skip reading `../box/REFERENCE.md` (Step 0 in leaf skill)

**Chains:** Research external code

---

## assign

**Path:** `../assign/SKILL.md`

**Triggers:** run a task with an external agent, hand off to OpenCode or similar,
execute a plan non-interactively.

**Flags:**

| Flag                       | Default           |
| -------------------------- | ----------------- |
| `--agent <name>`           | `opencode`        |
| `--model <provider/model>` | agent default     |
| `--dir <path>`             | current directory |

**Never:**

- Pass prompts via shell arguments (use temp file + stdin per leaf skill)

**Chains:** Delegate heavy lift

---

## handoff

**Path:** `../handoff/SKILL.md`

**Triggers:** `/handoff`, save session context, hand off to a new agent, resume
from a handoff file.

**Flags:**

| Flag              | Default                      |
| ----------------- | ---------------------------- |
| `--resume <path>` | load existing doc (no write) |
| `--path <path>`   | override save location       |
| positional arg    | next-session focus           |

**Never:**

- Combine `--resume` and `--path`

**Chains:** End or resume session
