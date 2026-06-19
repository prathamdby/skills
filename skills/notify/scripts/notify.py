#!/usr/bin/env python3
"""Discord webhook notifier for coding agents."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ANCHOR = Path(__file__).resolve().parent.parent
DEFAULT_WEBHOOK_FILE = ANCHOR / "webhook.url"
WEBHOOK_PREFIX = "https://discord.com/api/webhooks/"
DEFAULT_COLOR = 5814783

MAX_TITLE = 256
MAX_DESCRIPTION = 4096
MAX_CONTENT = 2000
MAX_FIELDS = 10
MAX_FIELD_NAME = 256
MAX_FIELD_VALUE = 1024

SEND_EXAMPLE = """\
  python3 scripts/notify.py send --task \\
    --title "Task complete" \\
    --description "Auth flow done." \\
    --link "https://github.com/org/repo/pull/42\""""


def die(code: int, message: str, example: str | None = None) -> None:
    print(f"Error: {message}", file=sys.stderr)
    if example:
        print(f"Example:\n{example}", file=sys.stderr)
    raise SystemExit(code)


def read_webhook(path: Path) -> str:
    if not path.is_file():
        die(
            1,
            f"Webhook file not found: {path}",
            "  Ask the user for their Discord webhook URL, write it to the file,\n"
            "  then rerun send. See notify SKILL.md Step 3.",
        )
    url = path.read_text(encoding="utf-8").strip().strip("'\"")
    if not url:
        die(
            1,
            f"Webhook file is empty: {path}",
            "  Ask the user for their Discord webhook URL, write it to the file,\n"
            "  then rerun send. See notify SKILL.md Step 3.",
        )
    if not url.startswith(WEBHOOK_PREFIX):
        die(
            1,
            "Webhook URL must start with https://discord.com/api/webhooks/",
            f"  echo 'https://discord.com/api/webhooks/ID/TOKEN' > {path}",
        )
    return url


def parse_field(raw: str, index: int) -> dict[str, str]:
    if "|" not in raw:
        die(
            2,
            f"--field must be Name|Value (got: {raw!r})",
            '  --field "Branch|feature/auth"',
        )
    name, value = raw.split("|", 1)
    name = name.strip()
    value = value.strip()
    if not name or not value:
        die(2, f"--field name and value required (field {index + 1})")
    if len(name) > MAX_FIELD_NAME:
        die(2, f"Field name exceeds {MAX_FIELD_NAME} chars (field {index + 1})")
    if len(value) > MAX_FIELD_VALUE:
        die(2, f"Field value exceeds {MAX_FIELD_VALUE} chars (field {index + 1})")
    return {"name": name, "value": value}


def build_description(description: str, link: str | None) -> str:
    if not link or link in description:
        return description
    suffix = f"\n\n[Open]({link})"
    if len(description) + len(suffix) > MAX_DESCRIPTION:
        die(2, f"Description + link exceeds {MAX_DESCRIPTION} chars")
    return description + suffix


def build_payload(args: argparse.Namespace) -> dict[str, Any]:
    if not args.title:
        die(2, "--title is required", SEND_EXAMPLE)
    if not args.description:
        die(2, "--description is required", SEND_EXAMPLE)
    if args.task and not args.link:
        die(2, "--task requires --link", SEND_EXAMPLE)
    if len(args.title) > MAX_TITLE:
        die(2, f"--title exceeds {MAX_TITLE} chars")
    if len(args.description) > MAX_DESCRIPTION:
        die(2, f"--description exceeds {MAX_DESCRIPTION} chars")
    if len(args.fields) > MAX_FIELDS:
        die(2, f"Max {MAX_FIELDS} --field entries")
    if args.content and len(args.content) > MAX_CONTENT:
        die(2, f"--content exceeds {MAX_CONTENT} chars")

    embed: dict[str, Any] = {
        "title": args.title,
        "description": build_description(args.description, args.link),
        "color": args.color,
    }
    if args.fields:
        embed["fields"] = [parse_field(f, i) for i, f in enumerate(args.fields)]

    payload: dict[str, Any] = {"embeds": [embed]}
    if args.content:
        payload["content"] = args.content
    return payload


def post_webhook(url: str, payload: dict[str, Any]) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "notify-skill/1.0",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=30) as resp:
            if resp.status != 204:
                body = resp.read().decode("utf-8", errors="replace")
                die(3, f"HTTP {resp.status}: {body}")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        die(3, f"HTTP {exc.code}: {body}")
    except URLError as exc:
        die(3, f"Network error: {exc.reason}")


def cmd_send(args: argparse.Namespace) -> None:
    payload = build_payload(args)

    if args.dry_run:
        print("status: dry-run")
        print(json.dumps(payload, indent=2))
        if args.link:
            print(f"link: {args.link}")
        return

    webhook_file = Path(args.webhook_file)
    webhook_url = read_webhook(webhook_file)
    post_webhook(webhook_url, payload)
    print("status: sent")
    print(f"title: {args.title}")
    if args.link:
        print(f"link: {args.link}")


def parse_color(val: str) -> int:
    val = val.strip()
    if val.startswith("#"):
        try:
            color = int(val[1:], 16)
        except ValueError:
            raise argparse.ArgumentTypeError(f"Invalid hex color: {val}")
    else:
        try:
            color = int(val, 0)
        except ValueError:
            raise argparse.ArgumentTypeError(f"Invalid color integer or hex: {val}")
    if not 0 <= color <= 0xFFFFFF:
        raise argparse.ArgumentTypeError(
            "Color must be between 0 and 16777215 (0xFFFFFF)"
        )
    return color


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="notify.py",
        description="Send Discord webhook embed notifications.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    send = sub.add_parser(
        "send",
        help="Send a single embed notification",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    send.add_argument("--title", required=True, help="Embed title (max 256)")
    send.add_argument("--description", required=True, help="Embed body (max 4096)")
    send.add_argument(
        "--link",
        help="URL appended as [Open](url) in description. Required with --task.",
    )
    send.add_argument(
        "--task",
        action="store_true",
        help="Task notification. Requires --link.",
    )
    send.add_argument(
        "--color",
        type=parse_color,
        default=DEFAULT_COLOR,
        help=f"Embed color integer or hex (default: {DEFAULT_COLOR})",
    )
    send.add_argument(
        "--field",
        action="append",
        default=[],
        dest="fields",
        metavar="NAME|VALUE",
        help="Embed field. Repeatable. Max 10.",
    )
    send.add_argument("--content", help="Optional message above the embed")
    send.add_argument(
        "--webhook-file",
        default=str(DEFAULT_WEBHOOK_FILE),
        help=f"File with webhook URL (default: {DEFAULT_WEBHOOK_FILE})",
    )
    send.add_argument(
        "--dry-run",
        action="store_true",
        help="Print payload JSON. No POST.",
    )
    send.set_defaults(func=cmd_send)

    send_epilog = """
Examples:
  python3 scripts/notify.py send --task \\
    --title "Task complete" \\
    --description "Auth flow done. Tests pass." \\
    --link "https://github.com/org/repo/pull/42"

  python3 scripts/notify.py send \\
    --title "Ping" \\
    --description "Check terminal when free."

  python3 scripts/notify.py send --task \\
    --title "Input needed" \\
    --description "Pick base branch." \\
    --link "https://linear.app/team/issue/ABC-123" \\
    --field "Options|main or develop" \\
    --dry-run
"""
    send.epilog = send_epilog

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()