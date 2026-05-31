---
name: box
description: >
  Clone, update, and search git repositories locally. Auto-invokes when the user
  passes a VCS URL (GitHub, GitLab, Bitbucket, etc.) or mentions a previously
  cloned repo name. Supports --persist to save a reference in the working
  directory's AGENTS.md, --update to force-pull, and --list to show cloned repos.
---

# Box

## When to use this skill

Activate when:

1. The user passes a VCS URL (`github.com`, `gitlab.com`, `bitbucket.org`, `.git`, `git@...`).
2. The user mentions a repo name that exists in the local manifest.
3. The user explicitly asks to clone, search, or explore a git repo.

## Flag detection

After activation, inspect the user's message for the following flags:

| Flag        | Effect                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `--persist` | After cloning/searching, append or update a deterministic reference block in the **working directory's** `AGENTS.md`. |
| `--update`  | Force `git pull` on the repo even if it already exists locally.                                                       |
| `--list`    | Skip all other work. List previously cloned repos and exit.                                                           |

**Defaults:** If no flags are provided, clone if missing, update if needed, search, and answer. Do not write to `AGENTS.md` unless `--persist` is passed.

## Sandbox location

All repos live inside the skill's own directory, next to `SKILL.md`:

- Sandbox root: `./sandbox/`
- Manifest: `./sandbox/manifest.json`
- Cloned repos: `./sandbox/{slug}/`

The agent must treat the directory containing `SKILL.md` as the anchor. All sandbox paths are relative to that directory.

## Startup case: bare invocation or `--list`

If the user invokes `/box` with no URL, no repo name, or passes `--list`:

1. Read `./sandbox/manifest.json`. If it does not exist or is empty, report: "No repos cloned yet."
2. Print a concise list:

```markdown
# Box

_local repo search & context_

Previously cloned:

- abc (github.com/john-doe/abc)
- xyz (gitlab.com/acme/xyz)

Give me a repo URL or name to search, or pass --persist to save a reference.
```

Then stop. Do not clone or search anything.

## Step 1: Detect the target

Extract the target from the user's message:

- **If a URL is present:** Use the URL. Derive the slug from the repo name in the path.
  - Example: `https://github.com/john-doe/abc.git` or `https://github.com/john-doe/abc` → slug `abc`.
  - Example: `git@gitlab.com:acme/xyz.git` → slug `xyz`.
- **If no URL but a name is mentioned:** Check `./sandbox/manifest.json` for a matching slug.
  - If found, use that repo's recorded URL and local path.
  - If not found, stop and ask: "I don't know that repo. Pass a URL to clone it first."
- **If neither URL nor known name:** Fall back to the startup case.

## Step 2: Prepare the sandbox

Ensure the filesystem structure exists:

```bash
mkdir -p ./sandbox
```

If `./sandbox/manifest.json` does not exist, create it with contents: `[]`.

## Step 3: Clone or update

Load the manifest. Find the entry for the target slug.

- **If missing:** Clone the URL into `./sandbox/{slug}/`.
  ```bash
  git clone --depth 1 <url> ./sandbox/<slug>
  ```
- **If present and `--update` was passed:**
  ```bash
  cd ./sandbox/<slug> && git pull
  ```
- **If present and no `--update`:** Skip git operations. The local copy is current enough.

After a successful clone or pull, update the manifest entry:

```json
{
  "slug": "abc",
  "url": "https://github.com/john-doe/abc",
  "local_path": "./sandbox/abc",
  "cloned_at": "2026-01-15T10:00:00Z"
}
```

Write the updated manifest back to `./sandbox/manifest.json`.

## Step 4: Execute the user's request

Search, read, summarize, or otherwise use the repo contents to answer the user's prompt. Follow these rules:

- Use the **local files** in `./sandbox/{slug}/`, not the remote URL.
- Include **code snippets** with full context (imports, function signatures, file paths).
- Cite **file paths and line numbers** when referencing code.
- Use **bulleted or numbered lists** for readability.
- If the user's prompt is open-ended ("tell me about abc"), explore the repo structure, README, and main source files before answering.

## Step 5: Persist to AGENTS.md (if `--persist`)

If the user passed `--persist`, update the **working directory's** `AGENTS.md`:

1. Read `./references/agents-md-template.md` from the skill directory.
2. Substitute `{slug}`, `{url}`, and `{local_path}` with the actual values.
3. Determine the target `AGENTS.md` path: `./AGENTS.md` (relative to the current working directory).
4. If `AGENTS.md` exists:
   - Search for `<!-- box:begin {slug} -->`.
   - If found: replace everything from that marker to `<!-- box:end {slug} -->` with the new block.
   - If not found: append the block under the `## External References` section. If that section does not exist, create it at the end of the file.
5. If `AGENTS.md` does not exist:
   - Create it.
   - Write `## External References` followed by the substituted block.

The markers ensure deterministic updates. Do not create duplicates.

## Step 6: Report

Summarize the outcome in 2-4 sentences:

- What repo was cloned/updated (slug and URL).
- Where it lives locally (`./sandbox/{slug}/`).
- Whether `--persist` updated the working directory's `AGENTS.md`.
- A high-level summary of what was found or done.

Example report:

```
Cloned abc from github.com/john-doe/abc into ./sandbox/abc.
Updated AGENTS.md with the repo reference.
Found the auth flow implementation in src/auth.ts and confirmed JWT handling.
```

## Constraints

- **Never run `git push`** or modify remotes.
- **Never commit** changes inside the cloned repos unless the user explicitly asks outside this skill.
- **Never infer a repo's contents** from the URL alone. Always read the local files.
- **Do not re-clone** existing repos unless `--update` is passed.
