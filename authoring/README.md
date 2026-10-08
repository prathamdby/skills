# Authoring reference

Apply this procedure when adding, removing, renaming, or restructuring a skill.
The commit checks and approval rule remain in `../AGENTS.md`.

## Publish and route

For a new skill, add a Quickstart invocation and Reference row to `../README.md`.
Add a Why these skills exist row only for a distinct underlying failure mode.
For existing skills, change these entries only when intent, scope, invocation,
or coverage changes. Keep procedures, limits, and recent fixes in the leaf.

For every addition except `prath-mode`, add an action playbook under
`../skills/engineering/prath-mode/playbooks/` with `primary: <skill-basename>`,
and one matcher in the router. For a rename, rewrite the primary, matcher,
every `leaf:<old>`, and every participant. For removal, delete the primary and
matcher, and rewrite or remove affected chains. An empty chain is removed.

Keep `.claude-plugin/marketplace.json`'s directory array sorted and complete.
The `.agents/plugins/marketplace.json` and `.codex-plugin/plugin.json` schemas
are different; they do not contain that array.

## Pointers and invocation

Front-load the leading word in model-facing descriptions. Use one trigger per
distinct branch; collapse synonyms for the same branch. Omit identity already
explained in the body and a duplicate When to use section.

Use `disable-model-invocation: true` only for human-only reach. Its description
is a human summary. Keep model reach when another skill needs the leaf.

Write a context pointer as an action tied to a branch: "For a Claude stream,
follow `skills/engineering/claude-code/references/streaming.md`."
A vague "see reference" does not define when to load.
Sharpen an unreliable pointer before inlining its target. Material needed on
every branch belongs in the entry, not behind a mandatory reference gate.

## Options and steps

Derive options from natural-language requests, with short example phrases and
explicit defaults. Ambiguous, conflicting, or missing needed values are `BLOCKED`.
Do not expose an invocation flag table. Product CLI argv is output after derivation.

Co-locate each concept's definition, rules, and caveats. Use ordered steps for
procedures and reference for consulted facts. End each step on an observable,
exhaustive condition. Split a sequence to prevent rushing only when a real
context boundary hides later steps; another inline file read does not.

## Ownership and pruning

Give a meaning one authoritative owner. Call that owner instead of copying its
procedure. Existing cross-skill dependencies must be explicit and checked before
acting; selecting one skill does not install its siblings automatically.
Keep branch references inside their owning skill so a copied directory includes
them. Do not introduce a runtime dependency on authoring tools or `/tmp`.

Use a leading word only when it recruits a useful existing concept. Preserve
grammar and concrete actions; abbreviated fragments are not token optimization.
Prefer positive targets. Keep prohibitions for hard safety boundaries, paired
with the action to take instead.

Cache an environment fact only when lookup is expensive or omits a consequential
gotcha. Keep permission traps, ordering constraints, and reasons for deviations;
ordinary syntax can be checked through scoped help.

Delete stale material and evidenced no-ops, not merely long sentences. Generic
tutorial examples may be removed when the procedure retains its required
selection rules and output contracts. Compare loaded branch context, tool output,
and retries, not only entry length. Use `verification.md` to protect behavior.

Provenance: [writing-for-agents](https://github.com/mattpocock/skills/tree/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/productivity/writing-for-agents).
