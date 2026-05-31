---
name: deslop
description: >
  Remove AI slop and simplify staged, unstaged, or branch-diff changes while
  preserving exact functionality and maintaining readability. Use when the user
  types /deslop, asks to clean AI artifacts, remove bloat, simplify code,
  review changes for slop, or strip over-engineered patterns. Supports flags
  --staged, --unstaged, and --base <branch>.
---

# Remove AI Slop & Simplify

## When to use this skill

Activate when the user types `/deslop`, asks to remove AI slop, clean AI
artifacts, strip over-engineered patterns, simplify code, review staged or
unstaged changes for bloat, or make changes clearer without changing behavior.

## Flag detection

After activation, inspect the user's message for the following flags:

| Flag              | Effect                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `--staged`        | Diff staged changes (`git diff --cached`). **This is the default** if no diff flag is provided. |
| `--unstaged`      | Diff unstaged changes (`git diff`).                                                             |
| `--base <branch>` | Diff changes on current branch since merge base with `<branch>`: `git diff <branch>...HEAD`.    |

**Defaults:** If no diff flag is provided, behave as if `--staged` was passed.

**Mutual exclusivity:** `--staged`, `--unstaged`, and `--base` are mutually
exclusive. If multiple are provided, use the first one detected.

**Base argument:** `--base` requires a branch name immediately following it
(e.g., `--base main`, `--base develop`). If the branch name is missing,
stop and report: `--base requires a branch name (e.g., --base main)`.

## Step 1: Diff the changes

Choose the diff command based on the detected flag:

- `--staged` (or default): `git diff --cached | cat`
- `--unstaged`: `git diff | cat`
- `--base <branch>`: `git diff <branch>...HEAD | cat`

Run the selected command, capture the full output, and identify which files
were modified in the diff.

If there are no changes to diff (empty output), stop and report:
"No changes found to deslop."

## Step 2: Read the actual files

The diff alone is not sufficient to judge context. Read the full content of
every file that appears in the diff, including any adjacent or related files
needed to understand the codebase's existing patterns, trust model, and
abstraction level.

Pay special attention to:

- Existing comment style and documentation conventions
- Existing error handling philosophy (where are try-catch used? where are they not?)
- Existing type safety level (how strict is the codebase?)
- Existing abstraction level (do similar operations use helpers or inline code?)
- Existing validation level (how defensive is the surrounding code?)
- Existing complexity level (are sophisticated patterns used nearby, or is the
  codebase direct and simple?)
- Project-standard imports, function style, naming conventions, and formatting

## Step 3: Exhaustively analyze for slop & simplification opportunities

Analyze ALL changes in the diff against the full file context. Look for every
instance of the following categories across all modified files.

Do not stop after finding one issue. Continue analyzing until every file in the
diff has been fully checked against all categories.

### Category 1: Comment & Documentation Issues

- Comments that break existing documentation style
- Redundant comments explaining what the code obviously does
- AI-generated header blocks or boilerplate comments
- Comments in a different tone or format from the rest of the file

### Category 2: Trust Model & Defensive Mismatches

- Defensive checks (null checks, type guards, validation) in code surrounded by
  direct, trusting code
- Try-catch blocks where the codebase uses error propagation or early returns
- Exception swallowing (empty catch blocks or generic logging without action)
- Patterns that assume fragility where the codebase assumes correctness
- Unreachable branches or duplicate validations beyond project norms

### Category 3: Type Safety & Conversion Noise

- `any` casts where the codebase uses proper types
- Type assertions (`as Type`) that bypass the compiler where surrounding code
  does not
- `@ts-ignore` or `@ts-expect-error` without strong justification
- Assertion bypasses (`!` non-null assertions) in strict code
- Unnecessary parsing / stringifying / type conversion chains
- Redundant type assertions that add no value

### Category 4: Dialect & Project Standard Violations

- Imported patterns that feel foreign to the codebase's style
- Naming conventions that differ from surrounding code (e.g., camelCase in a
  snake_case file, or `isFoo` predicates where the codebase uses `foo?`)
- Library usage that differs from existing patterns (e.g., using lodash where
  the codebase uses native methods)
- Architectural patterns not used elsewhere in the module
- Import style, function style, error handling style, or formatting that
  violates project conventions

### Category 5: Over-Engineering & Abstraction Bloat

- Abstractions, interfaces, or design patterns where simple code exists elsewhere
- Helper functions or classes for one-liners or trivial operations
- Single-use wrapper functions or pass-through parameters
- Indirection layers that do not add value over direct code
- Premature generalization (e.g., making something configurable when it has
  only one use)
- Dependency injection or factory patterns where direct instantiation is used
  elsewhere

### Category 6: Over-Caution & Redundancy

- Validation or sanitization beyond what the codebase normally does
- Excessive null checks on values that are guaranteed by construction
- Redundant guards that duplicate runtime or compile-time checks
- Input normalization that the rest of the pipeline already handles
- Duplicate validations or defensive checks already covered by the type system
  or caller contract

### Category 7: Bloat & Verbose Ceremony

- Simple operations expanded into multiple lines unnecessarily
- Unnecessary variable declarations (e.g., `const result = expr; return result;`)
- Verbose conditionals that could be direct expressions
- Extra whitespace, blank lines, or formatting changes not matching project style
- Dead code, unreachable branches, or commented-out code left behind
- Intermediate variables used once with no clarity benefit

### Category 8: Complexity & Clarity Anti-Patterns

- Sophisticated solutions where the codebase uses direct approaches
- Nested conditionals that can flatten with early returns or guard clauses
- Complex boolean expressions that can be reduced or extracted
- Nested ternaries that should be `if/else`, `switch`, or direct expressions
- Overly compact one-liners that obscure intent
- Clever tricks or cryptic patterns that sacrifice readability
- Manual array building where `map`/`filter`/`reduce` fits naturally and is
  used elsewhere in the project
- Async abstractions (wrappers, queues, pools) where direct calls are the norm
- Meta-programming (reflection, proxies, decorators) absent from the rest of
  the module

## Step 4: Compile the complete list

Before making any edits, write out the complete inventory of every slop or
simplification opportunity found. For each instance, record:

- File path
- Line number(s)
- Category (1-8)
- What the issue is
- Why it violates the codebase's norms or readability standards

Do not proceed to removal until this list is complete and you are confident
no instance was missed.

If no slop or simplification opportunities are found after exhaustive analysis,
report: "No AI slop or simplification opportunities detected. The changes
look clean."

## Step 5: Balance simplification with maintainability

For every item on the compiled list, evaluate whether removing it improves
the code before editing. Apply these guardrails:

- **Prefer explicit, readable code over compact cleverness.**
- **Preserve helpful abstractions and logical groupings.**
  Do not inline a well-named helper just to save lines if it explains intent.
- **Do not combine unrelated concerns for the sake of fewer lines.**
- **Choose switch statements or if/else chains over nested ternaries.**
- **Keep code debuggable and extensible.**
  A slightly longer but straightforward path is better than a compressed
  expression that requires mental unpacking.
- **Preserve existing behavior exactly.**
  Simplification must not change logic, timing, side effects, or public APIs.

If a potential simplification violates any of these guardrails, leave it out
of the final removal list. Only keep instances where removal is a clear win.

## Step 6: Remove the slop and apply simplifications

Edit the actual source files directly (not the diff output) to strip every
approved instance from the compiled list. Make the smallest possible change
to remove the issue while preserving exact functionality.

Guidelines for removal:

- Delete bloat comments and dead code entirely
- Simplify over-engineered patterns to match surrounding directness
- Remove unnecessary defensive checks that contradict local trust model
- Replace type escape hatches with proper types if possible; if not, leave a
  brief explanatory comment
- Collapse bloated expressions into inline form matching local style
- Flatten nested conditionals with early returns or guard clauses
- Replace nested ternaries with `if/else` or `switch` where clarity improves
- Align naming and patterns with the surrounding codebase
- Remove unnecessary type conversion chains

Do not introduce new complexity during removal. Do not refactor beyond what is
needed to address the approved instances.

## Step 7: Re-stage the cleaned files

After all edits are complete, re-stage the cleaned files:

```bash
git add <modified-files>
```

Use `git status` to confirm the cleaned state if needed.

## Step 8: Report

Summarize the cleanup in exactly 2-4 sentences. Report:

- What categories of slop or simplification were addressed
- How many files were affected
- Why the code is cleaner or simpler now
- Any notable trade-offs considered (e.g., "Preserved a helper function
  because it clarifies intent despite adding a line")

Do not list every individual change. Keep it high-level and concrete.

Example reports:

- "Removed defensive try-catch blocks and null guards that contradicted the
  codebase's direct style. Flattened nested conditionals with early returns.
  Preserved a helper function that explains domain intent. Three files
  cleaned and re-staged."
- "Stripped verbose comments and collapsed a bloated variable chain into a
  single expression. Aligned naming with project conventions. One file
  cleaned and re-staged."
- "No AI slop or simplification opportunities detected. The changes look clean."
