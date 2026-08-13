#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
  gh,
  ghJson,
  graphql,
  ghost,
  isGraphqlFallback,
  prArg,
  resolvePr,
  resolveRepo,
  run,
  sanitizeForTerminal,
  splitOwnerRepo,
  truncate,
} from "./lib.ts";

const USAGE = `usage: pr-snapshot.ts [pr] [--pr n] [-R owner/repo] [--full] [--json] [--help]

Everything about a PR in one GraphQL call. Omit [pr] to use the current
branch's PR. With -R owner/repo, also pass [pr] or --pr.
  --full   don't truncate body/comment text
  --json   structured output; if files.hasNextPage, extra GraphQL pages
           (not the 1-query path). keys: number, title, state, isDraft,
           author, url, createdAt, baseRefName, headRefName, headRefOid,
           mergeable, mergeStateStatus, reviewDecision, additions,
           deletions, changedFiles, body, files, filesCapped, comments,
           checks, threads, reviewsLatest`;

const SNAPSHOT_QUERY = `
query PrSnapshot($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number title state isDraft author { login } url createdAt
      baseRefName headRefName headRefOid mergeable mergeStateStatus
      reviewDecision additions deletions changedFiles body
      files(first: 50) {
        nodes { path additions deletions }
        pageInfo { hasNextPage endCursor }
      }
      reviews(last: 50) { nodes { author { login } state } }
      comments(last: 5) { nodes { author { login } createdAt body } }
      reviewThreads(first: 100) {
        pageInfo { hasNextPage }
        nodes { isResolved }
      }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 100) {
                nodes {
                  __typename
                  ... on CheckRun { name status conclusion }
                  ... on StatusContext { context state }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const FILES_QUERY = `
query PrSnapshotFiles($owner: String!, $name: String!, $number: Int!, $cursor: String!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      files(first: 100, after: $cursor) {
        nodes { path additions deletions }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

const THREADS_QUERY = `
query PrSnapshotThreads($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) { pageInfo { hasNextPage } nodes { isResolved } }
    }
  }
}`;

const VIEW_FIELDS =
  "number,title,state,isDraft,author,url,createdAt,baseRefName,headRefName,headRefOid," +
  "mergeable,mergeStateStatus,reviewDecision,additions,deletions,changedFiles,files,reviews,comments,body";

interface FileRow {
  path: string;
  additions: number;
  deletions: number;
}
interface CommentRow {
  author: { login: string } | null;
  createdAt: string;
  body: string;
}
interface Check {
  name: string;
  state: string;
  bucket: string;
}
interface Threads {
  open: number;
  total: number;
  capped: boolean;
}
interface Snapshot {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  author: { login: string };
  url: string;
  createdAt: string;
  baseRefName: string;
  headRefName: string;
  headRefOid: string;
  mergeable: string;
  mergeStateStatus: string;
  reviewDecision: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  body: string;
  files: FileRow[];
  filesCapped: boolean;
  comments: CommentRow[];
  checks: Check[];
  threads: Threads;
  reviewsLatest: Record<string, string>;
}

type GqlFileConn = {
  nodes: FileRow[];
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
};

type RollupNode =
  | { __typename: "CheckRun"; name: string; status: string | null; conclusion: string | null }
  | { __typename: "StatusContext"; context: string; state: string | null }
  | { __typename: string };

function bucketCheckRun(status: string | null, conclusion: string | null): string {
  const st = (status ?? "").toUpperCase();
  if (["IN_PROGRESS", "QUEUED", "WAITING", "PENDING", "REQUESTED"].includes(st)) return "pending";
  const c = (conclusion ?? "").toUpperCase();
  if (c === "SUCCESS") return "pass";
  if (["FAILURE", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(c)) return "fail";
  if (c === "CANCELLED") return "cancel";
  if (["SKIPPED", "NEUTRAL"].includes(c)) return "skipping";
  return c ? c.toLowerCase() : "pending";
}

function bucketStatus(state: string | null): string {
  const s = (state ?? "").toUpperCase();
  if (s === "SUCCESS") return "pass";
  if (s === "PENDING" || s === "EXPECTED") return "pending";
  if (s === "FAILURE" || s === "ERROR") return "fail";
  return s ? s.toLowerCase() : "pending";
}

function mapRollup(nodes: RollupNode[] | undefined): Check[] {
  const checks: Check[] = [];
  for (const n of nodes ?? []) {
    if (n.__typename === "CheckRun") {
      const cr = n as Extract<RollupNode, { __typename: "CheckRun" }>;
      checks.push({
        name: cr.name,
        state: cr.conclusion || cr.status || "",
        bucket: bucketCheckRun(cr.status, cr.conclusion),
      });
    } else if (n.__typename === "StatusContext") {
      const sc = n as Extract<RollupNode, { __typename: "StatusContext" }>;
      checks.push({
        name: sc.context,
        state: sc.state || "",
        bucket: bucketStatus(sc.state),
      });
    }
  }
  return checks;
}

function latestReviews(reviews: { author: { login: string } | null; state: string }[]): Record<string, string> {
  const latest = new Map<string, string>();
  for (const r of reviews) {
    if (r.state !== "PENDING") latest.set(ghost(r.author?.login), r.state);
  }
  return Object.fromEntries(latest);
}

function threadStats(nodes: { isResolved: boolean }[], capped: boolean): Threads {
  return {
    open: nodes.filter((n) => !n.isResolved).length,
    total: nodes.length,
    capped,
  };
}

async function extraFiles(
  owner: string,
  name: string,
  number: number,
  start: GqlFileConn,
): Promise<FileRow[]> {
  const files = [...start.nodes];
  let cursor = start.pageInfo.hasNextPage ? start.pageInfo.endCursor : null;
  while (cursor) {
    const data = await graphql<{
      repository: { pullRequest: { files: GqlFileConn } };
    }>(FILES_QUERY, { owner, name, number, cursor });
    const conn = data.repository.pullRequest.files;
    files.push(...conn.nodes);
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor ?? null : null;
  }
  return files;
}

async function fromGraphql(repo: string, number: number, paginateFiles: boolean): Promise<Snapshot> {
  const { owner, name } = splitOwnerRepo(repo);
  const data = await graphql<{
    repository: {
      pullRequest: {
        number: number;
        title: string;
        state: string;
        isDraft: boolean;
        author: { login: string } | null;
        url: string;
        createdAt: string;
        baseRefName: string;
        headRefName: string;
        headRefOid: string;
        mergeable: string;
        mergeStateStatus: string;
        reviewDecision: string | null;
        additions: number;
        deletions: number;
        changedFiles: number;
        body: string | null;
        files: GqlFileConn;
        reviews: { nodes: { author: { login: string } | null; state: string }[] };
        comments: { nodes: CommentRow[] };
        reviewThreads: { pageInfo: { hasNextPage: boolean }; nodes: { isResolved: boolean }[] };
        commits: {
          nodes: {
            commit: {
              statusCheckRollup: { contexts: { nodes: RollupNode[] } } | null;
            };
          }[];
        };
      } | null;
    } | null;
  }>(SNAPSHOT_QUERY, { owner, name, number });
  const pr = data.repository?.pullRequest;
  if (!pr) throw new Error(`PR ${repo}#${number} not found`);
  let files = pr.files.nodes;
  const filesCapped = !paginateFiles && pr.files.pageInfo.hasNextPage;
  if (paginateFiles && pr.files.pageInfo.hasNextPage) {
    files = await extraFiles(owner, name, number, pr.files);
  }
  const rollup = pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes;
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    isDraft: pr.isDraft,
    author: { login: ghost(pr.author?.login) },
    url: pr.url,
    createdAt: pr.createdAt,
    baseRefName: pr.baseRefName,
    headRefName: pr.headRefName,
    headRefOid: pr.headRefOid,
    mergeable: pr.mergeable,
    mergeStateStatus: pr.mergeStateStatus,
    reviewDecision: pr.reviewDecision || "NONE",
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    body: pr.body ?? "",
    files,
    filesCapped,
    comments: pr.comments.nodes,
    checks: mapRollup(rollup),
    threads: threadStats(pr.reviewThreads.nodes, pr.reviewThreads.pageInfo.hasNextPage),
    reviewsLatest: latestReviews(pr.reviews.nodes),
  };
}

async function threadStatsViaGh(repo: string, number: number): Promise<Threads> {
  const { owner, name } = splitOwnerRepo(repo);
  const raw = JSON.parse(
    await gh([
      "api",
      "graphql",
      "-f",
      `query=${THREADS_QUERY}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `repo=${name}`,
      "-F",
      `number=${number}`,
    ]),
  );
  const conn = raw.data?.repository?.pullRequest?.reviewThreads;
  if (!conn) return { open: 0, total: 0, capped: false };
  return threadStats(conn.nodes, conn.pageInfo.hasNextPage);
}

async function fromFallback(repo: string, number: number): Promise<Snapshot> {
  type View = Omit<Snapshot, "checks" | "threads" | "reviewsLatest" | "author" | "reviewDecision" | "body" | "filesCapped"> & {
    author: { login: string } | null;
    reviewDecision: string | null;
    body: string | null;
    reviews: { author: { login: string } | null; state: string }[];
  };
  const [view, checksRaw, threads] = await Promise.all([
    ghJson<View>(["pr", "view", String(number), "-R", repo, "--json", VIEW_FIELDS]),
    gh(["pr", "checks", String(number), "-R", repo, "--json", "name,state,bucket"], { okCodes: [1, 8] }).catch(
      (e: unknown) => {
        if (e instanceof Error && /no checks reported/i.test(e.message)) return "[]";
        throw e;
      },
    ),
    threadStatsViaGh(repo, number).catch(() => ({ open: 0, total: 0, capped: false })),
  ]);
  const checks: Check[] = JSON.parse(checksRaw || "[]");
  return {
    number: view.number,
    title: view.title,
    state: view.state,
    isDraft: view.isDraft,
    author: { login: ghost(view.author?.login) },
    url: view.url,
    createdAt: view.createdAt,
    baseRefName: view.baseRefName,
    headRefName: view.headRefName,
    headRefOid: view.headRefOid,
    mergeable: view.mergeable,
    mergeStateStatus: view.mergeStateStatus,
    reviewDecision: view.reviewDecision || "NONE",
    additions: view.additions,
    deletions: view.deletions,
    changedFiles: view.changedFiles,
    body: view.body ?? "",
    files: view.files ?? [],
    filesCapped: false,
    comments: view.comments ?? [],
    checks,
    threads,
    reviewsLatest: latestReviews(view.reviews ?? []),
  };
}

function printText(repo: string, snap: Snapshot, full: boolean): void {
  const log = (line = "") => console.log(sanitizeForTerminal(line));
  const draft = snap.isDraft ? " (draft)" : "";
  log(`${repo}#${snap.number}: ${snap.title}`);
  log(`${snap.state}${draft} · @${snap.author.login} · created ${snap.createdAt.slice(0, 10)} · ${snap.url}`);
  log(`${snap.baseRefName} ← ${snap.headRefName} @ ${snap.headRefOid.slice(0, 12)}`);
  log(
    `mergeable ${snap.mergeable} · mergeState ${snap.mergeStateStatus} · review ${snap.reviewDecision || "NONE"}`,
  );

  const byBucket = new Map<string, Check[]>();
  for (const c of snap.checks) byBucket.set(c.bucket, [...(byBucket.get(c.bucket) ?? []), c]);
  const counts = ["pass", "fail", "pending", "skipping", "cancel"]
    .map((b) => [b, byBucket.get(b)?.length ?? 0] as const)
    .filter(([, count]) => count > 0)
    .map(([b, count]) => `${count} ${b}`)
    .join(" · ");
  log(`checks: ${counts || "none reported"}`);
  for (const c of byBucket.get("fail") ?? []) log(`  ✗ ${c.name}`);

  log(`threads: ${snap.threads.open} open / ${snap.threads.total}${snap.threads.capped ? "+" : ""}`);

  log(`files: ${snap.changedFiles} (+${snap.additions} −${snap.deletions})`);
  for (const f of snap.files.slice(0, 50)) log(`  +${f.additions} −${f.deletions}  ${f.path}`);
  if (snap.filesCapped) log(`  … file list capped at ${snap.files.length} (more exist; --json pages)`);
  else if (snap.files.length > 50) log(`  … ${snap.files.length - 50} more files`);

  const latest = Object.entries(snap.reviewsLatest);
  if (latest.length > 0) {
    log(`reviews: ${latest.map(([a, s]) => `${a} ${s}`).join(" · ")}`);
  }

  if (snap.comments.length > 0) {
    log(`comments: ${snap.comments.length}${snap.comments.length > 5 ? " (last 5)" : ""}`);
    for (const c of snap.comments.slice(-5)) {
      const body = full ? c.body : truncate(c.body, 400);
      log(`  @${ghost(c.author?.login)} ${c.createdAt.slice(0, 10)}: ${body.replace(/\n/g, "\n    ")}`);
    }
  }

  if (snap.body) {
    const body = full ? snap.body : truncate(snap.body, 600);
    log(`body:\n  ${body.replace(/\n/g, "\n  ")}`);
  }
}

run(async () => {
  const { values: v, positionals } = parseArgs({
    options: {
      repo: { type: "string", short: "R" },
      pr: { type: "string" },
      full: { type: "boolean" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });
  if (v.help) return void console.log(USAGE);
  const n = await resolvePr(prArg(v.pr, positionals[0]), v.repo);
  const repo = await resolveRepo(v.repo);

  let snap: Snapshot;
  try {
    snap = await fromGraphql(repo, n, Boolean(v.json));
  } catch (e) {
    if (!isGraphqlFallback(e)) throw e;
    snap = await fromFallback(repo, n);
  }

  if (v.json) return void console.log(JSON.stringify(snap, null, 2));
  printText(repo, snap, Boolean(v.full));
});
