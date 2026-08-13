#!/usr/bin/env node
// Shared spawn/HTTP helpers. Node >= 23.6 native TS, stdlib only.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;
const API_VERSION = "2022-11-28";
const TRACE = process.env.GH_TRACE === "1";

let spawnCount = 0;
let httpCount = 0;
let tokenCache: string | undefined;

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export interface GhOpts {
  /** Exit codes that still carry valid stdout (e.g. `gh pr checks`: 1 = failing, 8 = pending). */
  okCodes?: number[];
}

function spawnLabel(args: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "-f" || a === "-F") {
      const next = args[++i] ?? "";
      out.push(a, next.split("=")[0] ?? "");
      continue;
    }
    const first = a.split("\n")[0] ?? "";
    out.push(first.length > 80 ? first.slice(0, 80) : first);
  }
  return out.join(" ");
}

function traceSpawn(args: string[]): void {
  spawnCount++;
  if (TRACE) console.error(`gh-trace spawn ${spawnCount}: ${spawnLabel(args)}`);
}

function traceHttp(method: string, url: string, queryName?: string): void {
  httpCount++;
  if (!TRACE) return;
  let path = url;
  try {
    const u = new URL(url);
    path = u.pathname;
  } catch {
    /* keep raw */
  }
  const extra = queryName ? ` ${queryName}` : "";
  console.error(`gh-trace http ${httpCount}: ${method} ${path}${extra}`);
}

function failGh(err: NodeJS.ErrnoException & { stdout?: string | Buffer; stderr?: string | Buffer }, args: string[]): never {
  if (err.code === "ENOENT") throw new Error("gh not found on PATH; install the GitHub CLI");
  const stderr = bufToStr(err.stderr).trim();
  const stdout = bufToStr(err.stdout).trim();
  const detail =
    err.code === "ERR_CHILD_PROCESS_STDOUT_MAXBUFFER"
      ? "output exceeded 64MB maxBuffer"
      : truncate(stderr || stdout || err.message || "", 2000);
  throw new Error(`gh ${spawnLabel(args)}\n${detail}`);
}

function bufToStr(v: string | Buffer | undefined): string {
  if (v == null) return "";
  return typeof v === "string" ? v : v.toString("utf8");
}

export async function gh(args: string[], opts: GhOpts = {}): Promise<string> {
  traceSpawn(args);
  try {
    const { stdout } = await execFileP("gh", args, { maxBuffer: MAX_BUFFER, encoding: "utf8" });
    return stdout;
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    if (typeof err.code === "number" && opts.okCodes?.includes(err.code)) {
      // empty stdout + stderr is a real error (bad PR vs failing checks both exit 1)
      if (err.stdout?.trim() || !err.stderr?.trim()) return err.stdout ?? "";
    }
    failGh(err, args);
  }
}

export async function ghBuffer(args: string[]): Promise<Buffer> {
  traceSpawn(args);
  try {
    const { stdout } = await execFileP("gh", args, { maxBuffer: MAX_BUFFER, encoding: "buffer" });
    return stdout;
  } catch (e) {
    failGh(e as NodeJS.ErrnoException & { stdout?: Buffer; stderr?: Buffer }, args);
  }
}

export async function ghJson<T>(args: string[], opts?: GhOpts): Promise<T> {
  const out = await gh(args, opts);
  try {
    return JSON.parse(out) as T;
  } catch {
    throw new Error(`unexpected non-JSON from gh ${args.slice(0, 3).join(" ")}: ${out.slice(0, 200)}`);
  }
}

/** Job logs only: never fetch this URL with the GitHub token. */
export async function ghJobLogs(repo: string, jobId: number): Promise<Buffer> {
  return ghBuffer([
    "api",
    "--allow-escape-sequences",
    `repos/${repo}/actions/jobs/${jobId}/logs`,
  ]);
}

export async function getToken(): Promise<string> {
  if (tokenCache !== undefined) return tokenCache;
  const host = process.env.GH_HOST;
  const args = host ? ["auth", "token", "-h", host] : ["auth", "token"];
  tokenCache = (await gh(args)).trim();
  if (!tokenCache) throw new Error("gh auth token returned empty; run gh auth login");
  return tokenCache;
}

function graphqlUrl(): string {
  const host = process.env.GH_HOST;
  return host ? `https://${host}/api/graphql` : "https://api.github.com/graphql";
}

function restBase(): string {
  const host = process.env.GH_HOST;
  return host ? `https://${host}/api/v3/` : "https://api.github.com/";
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "gh-scripts",
    Connection: "keep-alive",
  };
}

function queryName(query: string): string {
  return query.match(/\bquery\s+(\w+)/)?.[1] ?? "query";
}

export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = await getToken();
  const url = graphqlUrl();
  traceHttp("POST", url, queryName(query));
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    throw new HttpError(e instanceof Error ? e.message : String(e), 0);
  }
  if (res.status >= 500) {
    throw new HttpError(`GraphQL ${res.status}`, res.status);
  }
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length && json.data == null) {
    throw new HttpError(json.errors.map((err) => err.message).join("; "), res.status);
  }
  if (json.data == null) throw new HttpError(`GraphQL ${res.status} empty data`, res.status);
  return json.data;
}

export function isGraphqlFallback(e: unknown): boolean {
  const status = e instanceof HttpError ? e.status : 0;
  if (status >= 500) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /timeout|timed out|complexity|something went wrong while executing your query/i.test(msg);
}

export async function restJson<T>(path: string, query?: Record<string, string>): Promise<T> {
  const token = await getToken();
  const url = new URL(path.replace(/^\//, ""), restBase());
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  traceHttp("GET", url.toString());
  let res: Response;
  try {
    res = await fetch(url, { headers: authHeaders(token) });
  } catch (e) {
    throw new HttpError(e instanceof Error ? e.message : String(e), 0);
  }
  if (!res.ok) {
    const body = truncate((await res.text()).replace(/\s+/g, " "), 400);
    throw new HttpError(`REST ${res.status} ${url.pathname} ${body}`, res.status);
  }
  return (await res.json()) as T;
}

export function splitOwnerRepo(repo: string): { owner: string; name: string } {
  const i = repo.indexOf("/");
  if (i <= 0 || i === repo.length - 1) throw new Error(`--repo must be owner/repo, got: ${repo}`);
  return { owner: repo.slice(0, i), name: repo.slice(i + 1) };
}

export async function resolveRepo(flag?: string): Promise<string> {
  if (flag) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(flag)) throw new Error(`--repo must be owner/repo, got: ${flag}`);
    return flag;
  }
  try {
    return (await gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])).trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/gh not found|auth login|authentication/i.test(msg)) throw e;
    throw new Error("not inside a repo with a GitHub remote; pass -R owner/repo");
  }
}

/** PR number: explicit positional, or the current branch's PR when omitted. */
export async function resolvePr(arg: string | undefined, repoFlag: string | undefined): Promise<number> {
  if (arg !== undefined) {
    const n = Number(arg);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`PR must be a positive number, got: ${arg}`);
    return n;
  }
  if (repoFlag) throw new Error("with -R, also pass the PR number");
  return (await ghJson<{ number: number }>(["pr", "view", "--json", "number"])).number;
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)} […+${s.length - max} chars]`;
}

export function ghost(login: string | null | undefined): string {
  return login || "ghost";
}

/** Wrap a script's main(): print clean errors, exit 1 only on real failure. Success is 0 even if CI is red. */
export function run(main: () => Promise<void>): void {
  process.stdout.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EPIPE") process.exit(0);
    throw e;
  });
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
