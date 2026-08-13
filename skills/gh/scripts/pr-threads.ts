#!/usr/bin/env node
import { parseArgs } from "node:util";
import { graphql, ghost, resolvePr, resolveRepo, run, splitOwnerRepo, truncate } from "./lib.ts";

const USAGE = `usage: pr-threads.ts [pr] [-R owner/repo] [--all|--open] [--author login] [--since ISO] [--full] [--json] [--complete] [--help]

Review conversation for a PR: review bodies, issue comments, and inline
threads. Default hides resolved and outdated threads (header counts them).
--open keeps unresolved including outdated. --all keeps everything.
Omit [pr] to use the current branch's PR. With -R, also pass the PR number.
  --all          include resolved and outdated threads
  --open         unresolved only (includes outdated)
  --author X     only items by X (threads: any comment by X)
  --since TS     only items with activity at/after TS (ISO 8601)
  --full         don't truncate bodies
  --complete     page leftover thread comments and older reviews/comments
  --json         { conversation, threads, moreReviews, moreComments,
                   moreConvo, moreThreadComments }`;

interface Comment {
  author: string;
  createdAt: string;
  body: string;
  id?: string;
  databaseId?: number | null;
  url?: string | null;
}
interface Thread {
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  originalLine: number | null;
  moreComments: boolean;
  comments: Comment[];
  id?: string;
  databaseId?: number | null;
  url?: string | null;
}
interface ConvoItem {
  kind: "review" | "comment";
  state?: string;
  author: string;
  createdAt: string;
  body: string;
  id?: string;
  databaseId?: number | null;
  url?: string | null;
}

const MAIN_QUERY = `
query PrThreads($owner: String!, $name: String!, $number: Int!, $cursor: String, $withConvo: Boolean!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviews(last: 50) @include(if: $withConvo) {
        pageInfo { hasPreviousPage startCursor }
        nodes { id databaseId url author { login } state submittedAt body }
      }
      comments(last: 50) @include(if: $withConvo) {
        pageInfo { hasPreviousPage startCursor }
        nodes { id databaseId url author { login } createdAt body }
      }
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved isOutdated path line originalLine
          comments(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes { id databaseId url author { login } createdAt body }
          }
        }
      }
    }
  }
}`;

const THREAD_COMMENTS_QUERY = `
query ThreadComments($id: ID!, $cursor: String!) {
  node(id: $id) {
    ... on PullRequestReviewThread {
      comments(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id databaseId url author { login } createdAt body }
      }
    }
  }
}`;

const REVIEWS_PAGE_QUERY = `
query PrReviewsPage($owner: String!, $name: String!, $number: Int!, $before: String!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviews(last: 50, before: $before) {
        pageInfo { hasPreviousPage startCursor }
        nodes { id databaseId url author { login } state submittedAt body }
      }
    }
  }
}`;

const COMMENTS_PAGE_QUERY = `
query PrCommentsPage($owner: String!, $name: String!, $number: Int!, $before: String!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      comments(last: 50, before: $before) {
        pageInfo { hasPreviousPage startCursor }
        nodes { id databaseId url author { login } createdAt body }
      }
    }
  }
}`;

type GqlComment = {
  id: string;
  databaseId: number | null;
  url: string | null;
  author: { login: string } | null;
  createdAt?: string;
  submittedAt?: string;
  body: string;
  state?: string;
};
type GqlThread = {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  originalLine: number | null;
  comments: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: GqlComment[];
  };
};
type PageInfo = { hasPreviousPage: boolean; startCursor: string | null };

function mapComment(c: GqlComment, createdAt: string): Comment {
  return {
    author: ghost(c.author?.login),
    createdAt,
    body: c.body ?? "",
    id: c.id,
    databaseId: c.databaseId,
    url: c.url,
  };
}

function mapReview(r: GqlComment): ConvoItem | null {
  if (r.state === "PENDING" || !r.body?.trim()) return null;
  return {
    kind: "review",
    state: r.state,
    author: ghost(r.author?.login),
    createdAt: r.submittedAt ?? "",
    body: r.body,
    id: r.id,
    databaseId: r.databaseId,
    url: r.url,
  };
}

function mapIssueComment(c: GqlComment): ConvoItem {
  return {
    kind: "comment",
    author: ghost(c.author?.login),
    createdAt: c.createdAt ?? "",
    body: c.body ?? "",
    id: c.id,
    databaseId: c.databaseId,
    url: c.url,
  };
}

async function pageThreadComments(gqlId: string, startCursor: string | null, comments: Comment[]): Promise<boolean> {
  let cursor = startCursor;
  while (cursor) {
    try {
      const data = await graphql<{
        node: { comments: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GqlComment[] } } | null;
      }>(THREAD_COMMENTS_QUERY, { id: gqlId, cursor });
      const conn = data.node?.comments;
      if (!conn) return true;
      for (const c of conn.nodes) comments.push(mapComment(c, c.createdAt ?? ""));
      cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    } catch {
      return true;
    }
  }
  return false;
}

async function pageOlder<T>(
  query: string,
  owner: string,
  name: string,
  number: number,
  startCursor: string | null,
  hasMore: boolean,
  take: (nodes: GqlComment[]) => T[],
): Promise<{ items: T[]; more: boolean }> {
  const items: T[] = [];
  let cursor = startCursor;
  let more = hasMore;
  while (more && cursor) {
    try {
      const data = await graphql<{
        repository: {
          pullRequest: {
            reviews?: { pageInfo: PageInfo; nodes: GqlComment[] };
            comments?: { pageInfo: PageInfo; nodes: GqlComment[] };
          };
        };
      }>(query, { owner, name, number, before: cursor });
      const conn = data.repository.pullRequest.reviews ?? data.repository.pullRequest.comments;
      if (!conn) {
        return { items, more: true };
      }
      items.unshift(...take(conn.nodes));
      more = conn.pageInfo.hasPreviousPage;
      cursor = conn.pageInfo.startCursor;
    } catch {
      return { items, more: true };
    }
  }
  return { items, more: false };
}

async function fetchConversation(repo: string, pr: number, complete: boolean) {
  const { owner, name } = splitOwnerRepo(repo);
  const convo: ConvoItem[] = [];
  const threads: Thread[] = [];
  const pendingComments: { gqlId: string; cursor: string | null; comments: Comment[] }[] = [];
  let moreReviews = false;
  let moreComments = false;
  let moreThreadComments = false;
  let reviewsCursor: string | null = null;
  let commentsCursor: string | null = null;
  let cursor: string | null = null;
  let firstPage = true;

  do {
    const data = await graphql<{
      repository: {
        pullRequest: {
          reviews?: { pageInfo: PageInfo; nodes: GqlComment[] };
          comments?: { pageInfo: PageInfo; nodes: GqlComment[] };
          reviewThreads: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: GqlThread[];
          };
        } | null;
      } | null;
    }>(MAIN_QUERY, { owner, name, number: pr, cursor, withConvo: firstPage });
    const p = data.repository?.pullRequest;
    if (!p) throw new Error(`PR ${repo}#${pr} not found`);
    if (firstPage) {
      for (const r of p.reviews?.nodes ?? []) {
        const item = mapReview(r);
        if (item) convo.push(item);
      }
      for (const c of p.comments?.nodes ?? []) convo.push(mapIssueComment(c));
      moreReviews = Boolean(p.reviews?.pageInfo.hasPreviousPage);
      moreComments = Boolean(p.comments?.pageInfo.hasPreviousPage);
      reviewsCursor = p.reviews?.pageInfo.startCursor ?? null;
      commentsCursor = p.comments?.pageInfo.startCursor ?? null;
      convo.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    }
    const conn = p.reviewThreads;
    for (const n of conn.nodes) {
      const comments = n.comments.nodes.map((c) => mapComment(c, c.createdAt ?? ""));
      if (n.comments.pageInfo.hasNextPage) moreThreadComments = true;
      threads.push({
        isResolved: n.isResolved,
        isOutdated: n.isOutdated,
        path: n.path,
        line: n.line,
        originalLine: n.originalLine,
        moreComments: n.comments.pageInfo.hasNextPage,
        comments,
        id: n.id,
      });
      if (n.comments.pageInfo.hasNextPage) {
        pendingComments.push({
          gqlId: n.id,
          cursor: n.comments.pageInfo.endCursor,
          comments,
        });
      }
    }
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    firstPage = false;
  } while (cursor);

  if (complete) {
    moreThreadComments = false;
    const byId = new Map(pendingComments.map((p) => [p.gqlId, p]));
    await Promise.all(
      threads.map(async (t) => {
        const pending = t.id ? byId.get(t.id) : undefined;
        if (!pending) {
          t.moreComments = false;
          return;
        }
        if (!pending.cursor) {
          t.moreComments = true;
          moreThreadComments = true;
          return;
        }
        const truncated = await pageThreadComments(pending.gqlId, pending.cursor, t.comments);
        t.moreComments = truncated;
        if (truncated) moreThreadComments = true;
      }),
    );

    if (moreReviews && reviewsCursor) {
      const extra = await pageOlder(REVIEWS_PAGE_QUERY, owner, name, pr, reviewsCursor, moreReviews, (nodes) =>
        nodes.map(mapReview).filter((x): x is ConvoItem => x != null),
      );
      convo.unshift(...extra.items);
      moreReviews = extra.more;
    }
    if (moreComments && commentsCursor) {
      const extra = await pageOlder(COMMENTS_PAGE_QUERY, owner, name, pr, commentsCursor, moreComments, (nodes) =>
        nodes.map(mapIssueComment),
      );
      convo.unshift(...extra.items);
      moreComments = extra.more;
    }
    convo.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  const moreConvo = moreReviews || moreComments;
  return { convo, threads, moreReviews, moreComments, moreConvo, moreThreadComments };
}

run(async () => {
  const { values: v, positionals } = parseArgs({
    options: {
      repo: { type: "string", short: "R" },
      all: { type: "boolean" },
      open: { type: "boolean" },
      author: { type: "string" },
      since: { type: "string" },
      full: { type: "boolean" },
      json: { type: "boolean" },
      complete: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });
  if (v.help) return void console.log(USAGE);
  if (v.all && v.open) throw new Error("--all and --open cannot be used together");
  const pr = await resolvePr(positionals[0], v.repo);
  const repo = await resolveRepo(v.repo);

  let { convo, threads, moreReviews, moreComments, moreConvo, moreThreadComments } = await fetchConversation(
    repo,
    pr,
    Boolean(v.complete),
  );
  const totalThreads = threads.length;
  let hidden = 0;
  if (v.all) {
    /* keep everything */
  } else if (v.open) {
    const kept = threads.filter((t) => !t.isResolved);
    hidden = totalThreads - kept.length;
    threads = kept;
  } else {
    const kept = threads.filter((t) => !t.isResolved && !t.isOutdated);
    hidden = totalThreads - kept.length;
    threads = kept;
  }
  if (v.author) {
    convo = convo.filter((i) => i.author === v.author);
    threads = threads.filter((t) => t.comments.some((c) => c.author === v.author));
  }
  if (v.since) {
    const since = Date.parse(v.since);
    if (Number.isNaN(since)) throw new Error(`--since is not a date: ${v.since}`);
    convo = convo.filter((i) => Date.parse(i.createdAt) >= since);
    threads = threads.filter((t) => t.comments.some((c) => Date.parse(c.createdAt) >= since));
  }

  if (v.json) {
    return void console.log(
      JSON.stringify({ conversation: convo, threads, moreReviews, moreComments, moreConvo, moreThreadComments }, null, 2),
    );
  }

  const reviews = convo.filter((i) => i.kind === "review").length;
  const comments = convo.length - reviews;
  let threadStat: string;
  if (v.all) {
    threadStat = `${threads.length}/${totalThreads} threads (${threads.filter((t) => !t.isResolved).length} open · ${threads.filter((t) => t.isOutdated).length} outdated)`;
  } else if (v.open) {
    threadStat = `${threads.length}/${totalThreads} threads${hidden > 0 ? ` (${hidden} resolved hidden; --all shows)` : ""}`;
  } else {
    threadStat = `${threads.length}/${totalThreads} threads${hidden > 0 ? ` (${hidden} resolved/outdated hidden; --all shows)` : ""}`;
  }
  console.log(
    `${repo}#${pr}: ${reviews} review ${reviews === 1 ? "body" : "bodies"} · ${comments} comment${comments === 1 ? "" : "s"} · ${threadStat}\n`,
  );
  if (convo.length === 0 && threads.length === 0) {
    return void console.log(totalThreads === 0 ? "no review activity" : "nothing matches the filters");
  }

  for (const item of convo) {
    const tag = item.kind === "review" ? `[review · ${item.state}]` : "[comment]";
    const body = v.full ? item.body : truncate(item.body, 600);
    console.log(`${tag} @${item.author} (${item.createdAt.slice(0, 10)})`);
    console.log(`  ${body.replace(/\n/g, "\n  ")}\n`);
  }
  if (moreConvo) {
    console.log("… reviews/comments older than the last 50 omitted\n");
  }

  threads.forEach((t, i) => {
    const state = t.isResolved ? "RESOLVED" : "OPEN";
    const outdatedTag = t.isOutdated ? " · outdated" : "";
    const loc = t.line ?? (t.originalLine != null ? `${t.originalLine} (original)` : "?");
    console.log(`[${i + 1}] ${state}${outdatedTag} · ${t.path}:${loc}`);
    for (const c of t.comments) {
      const body = v.full ? c.body : truncate(c.body, 600);
      console.log(`  @${c.author} (${c.createdAt.slice(0, 10)}): ${body.replace(/\n/g, "\n    ")}`);
    }
    if (t.moreComments) console.log("  … thread has more comments omitted (--complete pages them)");
    console.log();
  });
});
