#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  prArg,
  resolvePr,
  resolveRepo,
  restJson,
  restPost,
  run,
  sanitizeForTerminal,
} from "./lib.ts";

const USAGE = `usage: pr-reply.ts [pr] [--pr n] [-R owner/repo] (--in-reply-to id | --conversation) (--body-file path | --body text) [--json] [--help]

Post one PR reply. --in-reply-to replies in a review thread (root or nested
id; nested ids resolve to the thread root). --conversation posts on the PR
conversation. Pass body via --body-file or --body, not both.
  --in-reply-to  review comment databaseId, discussion_rN, or comment URL
  --conversation PR conversation comment (not a review thread)
  --body-file    reply markdown file
  --body         reply text (tool argv; prefer --body-file)
  --json         { kind, id, url, inReplyTo, body }`;

type Posted = {
  id: number;
  html_url?: string;
  url?: string;
  in_reply_to_id?: number | null;
  body?: string;
};

function requirePositiveId(raw: string): number {
  if (!/^[1-9]\d*$/.test(raw))
    throw new Error(
      `review comment id must be a positive integer, got: ${raw}`,
    );
  const n = Number(raw);
  if (!Number.isSafeInteger(n))
    throw new Error(
      `review comment id must be a positive integer, got: ${raw}`,
    );
  return n;
}

function parseReviewCommentId(input: string): number {
  const trimmed = input.trim();
  const discussion = trimmed.match(/^discussion_r(\d+)$/);
  if (discussion?.[1]) return requirePositiveId(discussion[1]);
  const urlHash = trimmed.match(/^https?:\/\/\S+#discussion_r(\d+)$/i);
  if (urlHash?.[1]) return requirePositiveId(urlHash[1]);
  const api = trimmed.match(/^https?:\/\/\S+\/pulls\/comments\/(\d+)$/i);
  if (api?.[1]) return requirePositiveId(api[1]);
  return requirePositiveId(trimmed);
}

function replyPath(repo: string, pr: number, rootId?: number): string {
  if (rootId != null)
    return `repos/${repo}/pulls/${pr}/comments/${rootId}/replies`;
  return `repos/${repo}/issues/${pr}/comments`;
}

class ThreadCheckError extends Error {}

function inlineReplyFailed(e: unknown): Error {
  const detail = e instanceof Error ? e.message : String(e);
  return new Error(
    `${detail}\nInline reply failed. Post this same body with --conversation on the main conversation.`,
  );
}

function threadCheckFailed(postErr: unknown, lookupErr: unknown): ThreadCheckError {
  const postDetail = postErr instanceof Error ? postErr.message : String(postErr);
  const lookupDetail =
    lookupErr instanceof Error ? lookupErr.message : String(lookupErr);
  return new ThreadCheckError(
    `${postDetail}\nCould not check the thread for an existing reply: ${lookupDetail}\nVerify the thread before posting this body on the main conversation.`,
  );
}

async function listReviewComments(repo: string, pr: number): Promise<Posted[]> {
  const all: Posted[] = [];
  let seen: number | undefined;
  for (let page = 1; ; page++) {
    const comments = await restJson<Posted[]>(
      `repos/${repo}/pulls/${pr}/comments`,
      { per_page: "100", page: String(page) },
    );
    const first = comments[0]?.id;
    if (comments.length === 0 || first === seen) return all;
    seen = first;
    all.push(...comments);
    if (comments.length < 100) return all;
  }
}

function replyAlreadyInThread(
  comments: readonly Posted[],
  rootId: number,
  body: string,
): Posted | undefined {
  return comments.find(
    (comment) => comment.in_reply_to_id === rootId && comment.body === body,
  );
}

async function findExistingReply(
  repo: string,
  pr: number,
  rootId: number,
  body: string,
): Promise<Posted | undefined> {
  return replyAlreadyInThread(await listReviewComments(repo, pr), rootId, body);
}

async function findReplyAfterGetFailure(
  repo: string,
  pr: number,
  threadId: number,
  body: string,
): Promise<{ rootId: number; posted: Posted } | undefined> {
  const comments = await listReviewComments(repo, pr);
  const target = comments.find((comment) => comment.id === threadId);
  const rootId = target ? (target.in_reply_to_id ?? target.id) : threadId;
  if (rootId == null) return undefined;
  const posted = replyAlreadyInThread(comments, rootId, body);
  if (!posted) return undefined;
  return { rootId, posted };
}

function readReplyBody(
  body: string | undefined,
  bodyFile: string | undefined,
): string {
  if (body != null && bodyFile != null)
    throw new Error("pass --body or --body-file, not both");
  if (body == null && bodyFile == null)
    throw new Error("pass --body-file or --body");
  const text = bodyFile != null ? readFileSync(bodyFile, "utf8") : body;
  if (!text.trim())
    throw new Error(bodyFile != null ? "body file is empty" : "body is empty");
  return text;
}

run(async () => {
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
  if (v["in-reply-to"] && v.conversation)
    throw new Error("pass --in-reply-to or --conversation, not both");
  if (!v["in-reply-to"] && !v.conversation)
    throw new Error("pass --in-reply-to or --conversation");
  const body = readReplyBody(v.body, v["body-file"]);
  const threadId = v["in-reply-to"]
    ? parseReviewCommentId(v["in-reply-to"])
    : undefined;
  const pr = await resolvePr(prArg(v.pr, positionals[0]), v.repo);
  const repo = await resolveRepo(v.repo);

  let rootId: number | undefined;
  let posted: Posted;
  if (threadId != null) {
    try {
      let existing: Posted;
      try {
        existing = await restJson<Posted>(
          `repos/${repo}/pulls/comments/${threadId}`,
        );
      } catch (getErr) {
        try {
          const recovered = await findReplyAfterGetFailure(
            repo,
            pr,
            threadId,
            body,
          );
          if (recovered) {
            rootId = recovered.rootId;
            posted = recovered.posted;
            existing = recovered.posted;
          } else {
            throw getErr;
          }
        } catch (lookupErr) {
          if (lookupErr === getErr) throw getErr;
          throw threadCheckFailed(getErr, lookupErr);
        }
      }
      if (rootId == null) {
        const id = existing.in_reply_to_id ?? existing.id;
        if (id == null) throw new Error(`review comment ${threadId} has no id`);
        rootId = id;
        try {
          posted = await restPost<Posted>(replyPath(repo, pr, rootId), {
            body,
          });
        } catch (postErr) {
          try {
            const already = await findExistingReply(repo, pr, id, body);
            if (!already) throw postErr;
            posted = already;
          } catch (lookupErr) {
            if (lookupErr === postErr) throw postErr;
            throw threadCheckFailed(postErr, lookupErr);
          }
        }
      }
    } catch (e) {
      if (e instanceof ThreadCheckError) throw e;
      throw inlineReplyFailed(e);
    }
  } else {
    posted = await restPost<Posted>(replyPath(repo, pr, rootId), { body });
  }
  const url = posted.html_url ?? posted.url ?? "";
  const kind = rootId != null ? "thread" : "conversation";
  if (v.json) {
    return void console.log(
      JSON.stringify(
        {
          kind,
          id: posted.id,
          url,
          inReplyTo: posted.in_reply_to_id ?? rootId ?? null,
          body: posted.body ?? body,
        },
        null,
        2,
      ),
    );
  }
  const log = (line = "") => console.log(sanitizeForTerminal(line));
  if (kind === "thread") log(`${repo}#${pr}: replied to discussion_r${rootId}`);
  else log(`${repo}#${pr}: posted conversation comment`);
  if (url) log(url);
});
