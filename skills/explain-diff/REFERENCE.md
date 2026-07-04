# Explain Diff — reference

## Prose

Write with clarity and flow: engaging, classic style, smooth transitions between
sections. Concrete examples beat abstract claims.

## Background

Two layers on one page (not tabs):

1. **Broad** — system the reader might not know; skippable callout if they are
   already familiar.
2. **Narrow** — only what this change sits on top of.

Explore adjacent files, not just diff lines.

## Intuition

Core idea of the change—essence before details. Toy data and small examples.
Figures and diagrams liberally; reuse a small set of diagram families (below).

## Code

High-level walkthrough of the diff. Group hunks by theme (e.g. API surface,
persistence, tests), not by commit order.

## Quiz

Five multiple-choice questions, medium difficulty: need to understand the change
to answer, not trick questions. In-page JS: on click, show correct/incorrect and
short feedback per option.

## Page chrome

- Table of contents linking to section ids.
- Section headers: Background, Intuition, Code, Quiz.
- Callouts for definitions, key concepts, important edge cases.
- Lists: HTML `<ul>`/`<ol>`, not markdown in the file.

## Diagram families (HTML only)

Pick a few and reuse:

- **UI sketch** — simplified boxes/labels for what the user sees.
- **Flow** — components and arrows; include **example payloads** on edges or in
  nodes.

No ASCII diagrams. Simple borders, flex/grid, or inline SVG—keep CSS in the same
file.

## Code blocks

Always use `<pre>` (optionally `<code>` inside). If using a styled div instead,
its CSS **must** include `white-space: pre-wrap` or `pre`, or newlines collapse.

## Pre-save checklist

1. Every code block: `white-space: pre` or `pre-wrap` in CSS.
2. TOC anchors match section ids.
3. Quiz JS runs without external CDN if possible (inline script).
4. Filename starts with `YYYY-MM-DD-` when using the default path pattern.