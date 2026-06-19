# Notify Reference

## Webhook setup

On first `send` (not `--dry-run`), the agent checks `<anchor>/webhook.url`. If
missing or empty, it asks you for the URL before proceeding.

Manual setup:

1. Discord channel → Integrations → Webhooks → New Webhook.
2. Copy webhook URL.
3. Save one line to `<anchor>/webhook.url` (see `webhook.url.example`).
4. Never commit `webhook.url`.

## CLI

```bash
python3 <anchor>/scripts/notify.py send --help
```

### Examples

Task complete:

```bash
python3 scripts/notify.py send --task \
  --title "Task complete" \
  --description "Auth flow done. Tests pass." \
  --link "https://github.com/org/repo/pull/42" \
  --field "Branch|feature/auth"
```

Generic ping:

```bash
python3 scripts/notify.py send \
  --title "Ping" \
  --description "Check terminal when free."
```

Dry-run:

```bash
python3 scripts/notify.py send --task \
  --title "Input needed" \
  --description "Pick base branch." \
  --link "https://linear.app/team/issue/ABC-123" \
  --dry-run
```

## Embed limits

| Field       | Max  |
| ----------- | ---- |
| title       | 256  |
| description | 4096 |
| fields      | 10   |
| field name  | 256  |
| field value | 1024 |

## Valid `--link` for task work

| Context    | Link                                                             |
| ---------- | ---------------------------------------------------------------- |
| PR         | `https://github.com/.../pull/N`                                  |
| Commit     | `https://github.com/.../commit/SHA`                              |
| Linear     | `https://linear.app/.../issue/ID`                                |
| CI         | Run URL from provider                                            |
| Local only | Repo file on GitHub/GitLab, not bare `file://` unless user asked |

## Exit codes

| Code | Fix                                                                       |
| ---- | ------------------------------------------------------------------------- |
| 0    | Sent or dry-run ok                                                        |
| 1    | Agent should have asked for URL (Step 3). Rewrite file or ask user again. |
| 2    | Fix flags. Read stderr example.                                           |
| 3    | Check URL valid, not deleted, not rate-limited (429). Do not blind retry. |

## Idempotency

Re-running `send` posts again. Discord may duplicate. Do not retry on exit 3 without fixing the cause.

## HTTP errors

| Code | Meaning                         |
| ---- | ------------------------------- |
| 401  | Invalid webhook token           |
| 404  | Webhook deleted                 |
| 429  | Rate limited. Wait, retry once. |
