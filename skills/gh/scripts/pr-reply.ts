#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { prArg, resolvePr, resolveRepo, restJson, restPost, run, sanitizeForTerminal } from "./lib.ts";

const USAGE = `usage: pr-reply.ts [pr] [--pr n] [-R owner/repo] (--in-reply-to id | --conversation) (--body-file path | --body text) [--json] [--help]

Post one PR reply. --in-reply-to replies in a review thread (root or nested
id; nested ids resolve to the thread root). --conversation posts on the PR
conversation. Pass body via --body-file or --body, not both.
  --in-reply-to  review comment databaseId, discussion_rN, or comment URL
  --conversation PR conversation comment (not a review thread)
  --body-file    reply markdown file
  --body         reply text (tool argv; prefer --body-file)
  --json         { kind, id, url, inReplyTo, body }`;

export function parseReviewCommentId(input: string): number {
  const trimmed = input.trim();
  const discussion = trimmed.match(/discussion_r(\d+)/);
  if (discussion?.[1]) return requirePositiveId(discussion[1]);
  const api = trimmed.match(/\/pulls\/comments\/(\d+)/);
  if (api?.[1]) return requirePositiveId(api[1]);
  return requirePositiveId(trimmed);
}

export function replyPath(repo: string, pr: number, rootId?: number): string {
  if (rootId != null) return `repos/${repo}/pulls/${pr}/comments/${rootId}/replies`;
  return `repos/${repo}/issues/${pr}/comments`;
}

export function replyRootId(comment: { id: number; in_reply_to_id?: number | null }): number {
  return comment.in_reply_to_id ?? comment.id;
}

function requirePositiveId(raw: string): number {
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`review comment id must be a positive integer, got: ${raw}`);
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) throw new Error(`review comment id must be a positive integer, got: ${raw}`);
  return n;
}

function readReplyBody(body: string | undefined, bodyFile: string | undefined): string {
  if (body != null && bodyFile != null) throw new Error("pass --body or --body-file, not both");
  if (body == null && bodyFile == null) throw new Error("pass --body-file or --body");
  const text = bodyFile != null ? readFileSync(bodyFile, "utf8") : body;
  if (!text.trim()) throw new Error(bodyFile != null ? "body file is empty" : "body is empty");
  return text;
}

type Posted = {
  id: number;
  html_url?: string;
  url?: string;
  in_reply_to_id?: number | null;
  body?: string;
};

function invokedAsScript(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const { values: v, positionals } = parseArgs({
    options: {
      repo: { type: "string", short: "R" },
      pr: { type: "string" },
      "in-reply-to": { type: "string" },
      conversation: { type: "boolean" },
      "body-file": { type: "string" },
      body: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });
  if (v.help) return void console.log(USAGE);
  if (v["in-reply-to"] && v.conversation) throw new Error("pass --in-reply-to or --conversation, not both");
  if (!v["in-reply-to"] && !v.conversation) throw new Error("pass --in-reply-to or --conversation");
  const body = readReplyBody(v.body, v["body-file"]);
  const threadId = v["in-reply-to"] ? parseReviewCommentId(v["in-reply-to"]) : undefined;
  const pr = await resolvePr(prArg(v.pr, positionals[0]), v.repo);
  const repo = await resolveRepo(v.repo);

  let rootId: number | undefined;
  if (threadId != null) {
    const existing = await restJson<Posted>(`repos/${repo}/pulls/comments/${threadId}`);
    rootId = replyRootId({ id: existing.id, in_reply_to_id: existing.in_reply_to_id });
  }
  const posted = await restPost<Posted>(replyPath(repo, pr, rootId), { body });
  const url = posted.html_url ?? posted.url ?? "";
  const kind = rootId != null ? "thread" : "conversation";
  if (v.json) {
    return void console.log(
      JSON.stringify(
        { kind, id: posted.id, url, inReplyTo: posted.in_reply_to_id ?? rootId ?? null, body: posted.body ?? body },
        null,
        2,
      ),
    );
  }
  const log = (line = "") => console.log(sanitizeForTerminal(line));
  if (kind === "thread") log(`${repo}#${pr}: replied to discussion_r${rootId}`);
  else log(`${repo}#${pr}: posted conversation comment`);
  if (url) log(url);
}

if (invokedAsScript()) run(main);
