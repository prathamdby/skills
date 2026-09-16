# Explain diff reference

Load this file only after source, themes, evidence, and output are locked.

## Page contract

- Start with `<!-- generated-by: explain-diff -->`.
- One HTML5 document with embedded CSS and JavaScript. No network assets.
- One scrolling page with a table of contents and these IDs in order:
  `background`, `intuition`, `code`, `quiz`.
- Use sentence-case headings and concrete prose.
- Put evidence on factual elements with
  `data-source="path:line"` or `data-hunk="path:hunk"`.
- Give factual diagram labels, quiz options, and feedback the same evidence
  attributes.

## Sections

### Background

Explain the smallest system boundary needed to understand the change. Separate
broad context from the directly affected modules. Do not claim motivation from
commit messages or PR text unless the locked PR metadata proves it.

### Intuition

State the core before details. Use one small example with real data shapes from
the evidence. A diagram may use CSS boxes, grid, flex, or inline SVG. No ASCII
art.

### Code

Walk themes in dependency order, not commit or file order. Each theme includes
the before/after behavior, representative hunks, affected contracts, and
relevant checks. For a large diff, add a complete inventory table mapping every
changed path to one theme.

### Quiz

Write exactly five medium-difficulty questions. Each has four options, one
correct answer, feedback for every option, and an evidence pointer. Use
`fieldset`, `legend`, labels, and keyboard-accessible controls. Inline JavaScript
must show the score and per-option feedback without reloading.

## Code and diagrams

- Use `<pre><code>` and CSS `white-space: pre-wrap`.
- Escape source text, quiz options, and feedback before inserting them.
- Use callouts only for definitions, contracts, and important edge cases.
- No top-level tabs, markdown syntax, decorative animation, or generated filler.

## Verification checklist

1. Generator marker appears once.
2. All four sections and TOC anchors appear once and in order.
3. Every factual paragraph, bullet, table row, diagram label, question, answer,
   and feedback string has evidence.
4. Every changed path appears in a theme or inventory.
5. No network URL appears in `src`, CSS `url()`, or `@import`; every `href` is a
   local `#` anchor.
6. HTML source is escaped and code whitespace is preserved.
7. Five questions each have four options, one keyed answer, and four feedback
   strings.
8. HTML parses without structural errors.
9. Browser check passes every question when available; otherwise JavaScript
   parses and static structure passes.
10. Default filename starts with `YYYY-MM-DD-explain-`.
