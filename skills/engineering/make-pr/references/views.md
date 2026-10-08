# Change outline views

Load only for a theme whose changed shape benefits from a view.
Each item is a short caption beside one fence. Prefer one clear view;
add another only when a boundary, order, call, or layout remains unclear.

Shallow: prefer one or two views total, caption only when needed.
Standard: each distinct useful changed shape, without duplicates.
Deep: caption a view crossing a module/contract; multiple views may clarify
distinct boundaries, but omit unchanged categories.

| Changed shape | View |
|---|---|
| Logic/algorithm | Indented pseudocode, text fence |
| Runtime control flow | Caller/callee tree, ordered siblings |
| UI/module/state structure | Component tree with owning paths at boundaries |
| File responsibility/moves | Shallow file tree naming each moved/split path |
| Interaction/data/control ordering | Mermaid sequence or state view |
| Schema/relationship | SQL or diff of the schema |
| Endpoint request/response | Language fence or diff of the contract |
| Central type/interface | Language fence or diff of the type |

Prefer diff for an existing shape's delta. Use a full block only when most
is new, omitted names hide ownership/order, or a copyable shape is needed.
Order views by the clearest story; include only actual names, calls, props,
states, columns, routes, constraints, and boundaries the diff proves.

Publishable fences: text, diff, language, mermaid. No HTML fences or linked
HTML artifacts; this leaf neither commits new artifacts nor permits untracked
files. Exclude tests, rollout, unproved motive, and invented UI details.
Done when the smallest view set explains every useful changed boundary.
