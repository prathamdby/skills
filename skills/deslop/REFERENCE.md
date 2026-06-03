# Deslop Skill Reference

## All 8 slop categories

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

## Step 5 balancing guardrails

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

## Example reports

- "Removed defensive try-catch blocks and null guards that contradicted the
  codebase's direct style. Flattened nested conditionals with early returns.
  Preserved a helper function that explains domain intent. Three files
  cleaned and re-staged."
- "Stripped verbose comments and collapsed a bloated variable chain into a
  single expression. Aligned naming with project conventions. One file
  cleaned and re-staged."
- "No AI slop or simplification opportunities detected. The changes look clean."
