---
name: notify
description: >
  notify the user via Discord webhook embed. Triggers: /notify, send a Discord
  notification, alert me when done, ping me on Discord. Flags: --task, --link,
  --webhook, --color, --field, --content, --dry-run.
---

# Notify

Send a Discord embed via `./scripts/notify.py send`. Never curl. Never hand-build JSON.

## Flags

Skill flags map to CLI flags on `send`:

| Flag                 | CLI flag         | Effect                                         |
| -------------------- | ---------------- | ---------------------------------------------- |
| `--task`             | `--task`         | Task notification. Requires `--link`.          |
| `--link <url>`       | `--link`         | URL in embed. Required with `--task`.          |
| `--webhook <path>`   | `--webhook-file` | URL file. **Default: `<anchor>/webhook.url`**. |
| `--color <int\|hex>` | `--color`        | Embed color. Default `5814783`.                |
| `--field "N\|V"`     | `--field`        | Repeatable. Max 10.                            |
| `--content <text>`   | `--content`      | Message above embed.                           |
| `--dry-run`          | `--dry-run`      | Print payload. No POST.                        |
| Positional arg       | `--description`  | Embed body if not passed as flag.              |

`--title` and `--description` are always required on the CLI.

## Anchor

Directory holding this `SKILL.md`. Script: `<anchor>/scripts/notify.py`.

## Step 1: Classify branch

- **Task work** (implement, fix, review, PR, ticket, CI): use `--task` + `--link`.
- **Generic ping**: omit `--task`. `--link` optional.

## Step 2: Compose embed

- `--title`: short label ("Task complete", "Input needed").
- `--description`: positional arg or one-line session summary.
- `--link`: real URL when `--task`. GitHub PR/commit, Linear issue, CI run, repo tree link.
- `--field`: only when it adds signal (branch, ticket, status).

Done when title + description set and `--task` has `--link`.

## Step 3: Ensure webhook config

Skip this step when using `--dry-run`.

1. Resolve path: `--webhook <path>` or `<anchor>/webhook.url`.
2. Read the file if it exists. If missing or whitespace-only, **ask the user** for the
   Discord webhook URL. Do not run `send` yet. Wait for their reply.
3. On reply: write the URL as a single line to the resolved path. Create parent dirs
   if needed. URL must start with `https://discord.com/api/webhooks/`. If invalid,
   ask again with the prefix requirement.
4. Step done when the file contains a valid webhook URL prefix.

First-time setup help: Discord channel → Integrations → Webhooks → New Webhook →
copy URL. See `./REFERENCE.md`.

## Step 4: Run CLI

```bash
python3 <anchor>/scripts/notify.py send --title "..." --description "..." [flags]
```

Use `--dry-run` when payload unclear. Read `send --help` for Examples.

## Step 5: Check exit code

0 only means sent (or dry-run ok). On 2/3: stderr verbatim to user. Stop. No silent retry.

On exit 1 after Step 3: URL in file failed validation at POST time. Ask user for a
fresh webhook URL, rewrite the file, rerun `send` once.

## Step 6: Report

Parse stdout `status:`, `title:`, `link:`. Never echo webhook URL.

## Constraints

- Always embeds. Script enforces.
- Never commit `webhook.url`.
- On exit 3, follow troubleshooting in `./REFERENCE.md`.
