# Deslop reference

Load the categories while classifying and the guardrails before editing.

## Six categories

### 1. Commentary noise

- Comments or doc blocks that restate the code
- Generated headings, boilerplate, or a voice absent from nearby files
- Commented-out code and stale explanations

### 2. Trust and type noise

- Guards, validation, or normalization already guaranteed by callers or types
- Try-catch blocks that swallow errors or contradict local propagation
- `any`, ignores, assertions, or conversion chains used to silence the type
  system rather than model the value

### 3. Foreign dialect

- Naming, imports, libraries, error handling, or function style that conflicts
  with the same module
- A design pattern or architecture not used by adjacent code
- Formatting churn unrelated to the change

### 4. Needless indirection

- Single-use wrappers, interfaces, factories, helpers, or pass-through layers
- Configuration for one fixed use
- Dependency injection, reflection, decorators, queues, or pools where the
  module uses direct calls

### 5. Mechanical bloat

- One-use variables that add no meaning
- Repeated computation, duplicate state, redundant branches, or dead code
- Multi-step ceremony around a direct local operation

### 6. Obscured control flow

- Deep nesting that a local early-return pattern can flatten
- Nested ternaries or dense boolean expressions
- Clever one-liners, manual collection building, or extraction that makes the
  path harder to debug

Use one primary category per instance. Mention a secondary category only when
it requires a separate edit.

## Guardrails

Drop the instance when any answer is uncertain:

1. Can the existing behavior be stated and shown to remain identical?
2. Does adjacent code establish the proposed replacement as local practice?
3. Does the edit preserve timing, errors, side effects, API shape, and data
   validation?
4. Does a named helper or abstraction explain domain intent or support more
   than one real use?
5. Does the shorter form remain easier to read and debug?
6. Is every changed line inside the selected diff's purpose?

Prefer explicit code over compact code. Do not combine unrelated concerns to
save lines. Do not remove a safety check merely because it is verbose; remove
it only when types, verified callers, or an existing test prove the same
contract. A comment or assumption is not proof.
