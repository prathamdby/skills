---
name: humanize
description: >
  Rewrite text to break AI statistical patterns and restore a human voice.
  Use when prose feels robotic, formulaic, or detectably machine-generated.
  Paste or attach the text to humanize.
---

# Humanize

## When to use this skill

Activate when the user asks to humanize text, remove AI tells, make writing sound less robotic, or edit prose that feels generated. Accept text pasted inline, from a file, or attached.

## What the research says

AI text detectors work by finding predictable statistical signatures. Turnitin's own product officer describes the difference as "the more idiosyncratic, unpredictable nature of human writing and the very predictable statistical signatures of AI generated text." DetectGPT found that AI text sits in "negative curvature regions" of probability — meaning it follows the model's most likely next-token paths. When Weber-Wulff's team tested 14 commercial detectors, they found the tools hunt repetition and statistical regularity. Paraphrasing breaks them because it introduces the irregularity human writing naturally has.

The goal of this skill is not to "beat detection." It is to write prose that lacks the mechanical regularity of generated text — the same regularity that makes prose feel lifeless to human readers.

## Core Rules

1. **Break probability patterns.** AI text follows the model's highest-likelihood paths. Human writing surprises. Include an unexpected detail, a minor contradiction, or a personal aside that a model trained on averages would not generate. If every sentence feels like the "most likely" continuation of the last, rewrite one to be the "second most likely."

2. **Name the actor.** Every sentence needs a human subject doing something. No passive voice. No inanimate objects performing human verbs ("the data suggests," "the model reveals," "the culture shifts"). Name who decided, who built, who observed.

3. **Be specific, not declarative.** "The implications are significant" → name the specific implication. "This is a complex problem" → describe the actual conflict. AI text defaults to vague summaries because it lacks a point of view. Give it one.

4. **Vary rhythm and length aggressively.** Detectors flag metronomic regularity. Mix short punches with longer explanatory sentences. Break a three-item list into two. End one paragraph mid-thought. Let another breathe. No three consecutive sentences of the same length.

5. **Cut discourse markers.** AI overuses signposting to simulate structure: "furthermore," "moreover," "importantly," "crucially," "interestingly," "it is worth noting," "at its core." These are rhythmic tells that detectors and readers both spot. Remove them. Let the logic carry itself.

6. **Break formulaic structures.** Avoid binary contrasts ("not X, but Y"), negative listings ("not A, not B, but C"), dramatic fragmentation ("Speed. Quality. Cost."), and rhetorical setups ("What if I told you..."). These are statistical fingerprints of generated text. State the point directly.

7. **Kill adverbs and hedges.** All `-ly` words, plus "really," "just," "simply," "actually," "genuinely," "literally." Also cut lazy extremes: "every," "always," "never," "everyone." Use specifics instead of sweeping claims.

8. **Put the reader in the room.** No narrator-from-a-distance ("People tend to," "Nobody designed this"). Use "you" or name a specific person. Concreteness over abstraction.

## Quick Checks

Before delivering rewritten prose:

- Any passive voice? Name the actor.
- Any discourse marker? Cut it.
- Any binary contrast or negative listing? State the point directly.
- Three consecutive sentences same length? Break one.
- Any adverb or hedge? Remove it.
- Any vague declarative? Name the specific thing.
- Any inanimate subject doing a human verb? Fix it.
- Does it sound like a pull-quote? Rewrite it.
- Would a language model assign this text high probability? If yes, surprise it.

## Scoring

Rate the rewritten text 1-10 on each dimension. Total /50.

| Dimension   | Question                                                                 |
| ----------- | ------------------------------------------------------------------------ |
| Surprise    | Does it contain an unexpected detail or turn a reader would not predict? |
| Specificity | Does it name concrete things, or rely on vague summaries?                |
| Rhythm      | Varied sentence length and flow, or metronomic?                          |
| Agency      | Active voice with named actors, or passive/abstractions?                 |
| Voice       | Is there a clear human point of view, or is it generic?                  |

Below 35/50: rewrite again. Report the score and the two weakest dimensions.

## Workflow

1. **Receive text** — from user message, attached file, or clipboard.
2. **Read the full text** — understand the subject and intent before editing.
3. **Apply the 8 core rules** in order, rewriting the text.
4. **Run quick checks** on the output.
5. **Score the result** on the 5 dimensions.
6. **If below 35/50** — rewrite and re-score.
7. **Report** — deliver the rewritten text, the score, and a brief summary of what was changed.

## Constraints

- Do not frame this as "beating detection." Frame it as writing with a human voice.
- Do not rewrite beyond what's needed. Minimal effective change.
- Do not mention other skills or frameworks by name.
