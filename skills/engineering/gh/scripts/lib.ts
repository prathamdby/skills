#!/usr/bin/env node
// Shared spawn/HTTP helpers. Stdlib only; invoke via ./run.
import { execFile } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;
const API_VERSION = "2022-11-28";
const TRACE = process.env.GH_TRACE === "1";

let spawnCount = 0;
let httpCount = 0;
const tokenCache = new Map<string, string>();
const GH_HOST_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5]))?$/i;

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
  /** Optional checkout directory for commands whose meaning depends on the current repository. */
  cwd?: string;
  /** Additive environment overrides for one invocation. */
  env?: Record<string, string>;
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

function failGh(
  err: NodeJS.ErrnoException & {
    stdout?: string | Buffer;
    stderr?: string | Buffer;
  },
  args: string[],
): never {
  if (err.code === "ENOENT")
    throw new Error("gh not found on PATH; install the GitHub CLI");
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
    const { stdout } = await execFileP("gh", args, {
      maxBuffer: MAX_BUFFER,
      encoding: "utf8",
      cwd: opts.cwd,
      env: opts.env === undefined ? process.env : { ...process.env, ...opts.env },
    });
    return stdout;
  } catch (e) {
    const err = e as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
    };
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
    const { stdout } = await execFileP("gh", args, {
      maxBuffer: MAX_BUFFER,
      encoding: "buffer",
    });
    return stdout;
  } catch (e) {
    failGh(
      e as NodeJS.ErrnoException & { stdout?: Buffer; stderr?: Buffer },
      args,
    );
  }
}

export async function ghJson<T>(args: string[], opts?: GhOpts): Promise<T> {
  const out = await gh(args, opts);
  try {
    return JSON.parse(out) as T;
  } catch {
    throw new Error(
      `unexpected non-JSON from gh ${args.slice(0, 3).join(" ")}: ${out.slice(0, 200)}`,
    );
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

function githubHost(): string | undefined {
  const raw = process.env.GH_HOST?.trim();
  if (!raw) return undefined;
  if (/[/\\?#@]/.test(raw) || !GH_HOST_RE.test(raw)) {
    throw new Error(`GH_HOST must be hostname[:port], got: ${raw}`);
  }
  return raw.toLowerCase();
}

export async function getToken(): Promise<string> {
  const host = githubHost();
  const key = host ?? "github.com";
  const cached = tokenCache.get(key);
  if (cached !== undefined) return cached;
  const args = host ? ["auth", "token", "-h", host] : ["auth", "token"];
  const token = (await gh(args)).trim();
  if (!token)
    throw new Error("gh auth token returned empty; run gh auth login");
  tokenCache.set(key, token);
  return token;
}

function graphqlUrl(): string {
  const host = githubHost();
  return host
    ? `https://${host}/api/graphql`
    : "https://api.github.com/graphql";
}

function restBase(): string {
  const host = githubHost();
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

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
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
  if (json.errors?.length) {
    throw new HttpError(
      json.errors.map((err) => err.message).join("; "),
      res.status,
    );
  }
  if (json.data == null)
    throw new HttpError(`GraphQL ${res.status} empty data`, res.status);
  return json.data;
}

export function isGraphqlFallback(e: unknown): boolean {
  const status = e instanceof HttpError ? e.status : 0;
  if (status >= 500) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /timeout|timed out|complexity|something went wrong while executing your query/i.test(
    msg,
  );
}

async function restRequest<T>(
  method: "GET" | "POST",
  path: string,
  init?: { query?: Record<string, string>; body?: unknown },
): Promise<T> {
  const token = await getToken();
  const url = new URL(path.replace(/^\//, ""), restBase());
  if (init?.query)
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  traceHttp(method, url.toString());
  const headers =
    method === "POST"
      ? { ...authHeaders(token), "Content-Type": "application/json" }
      : authHeaders(token);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(init?.body ?? {}) : undefined,
    });
  } catch (e) {
    throw new HttpError(e instanceof Error ? e.message : String(e), 0);
  }
  if (!res.ok) {
    const body = truncate((await res.text()).replace(/\s+/g, " "), 400);
    throw new HttpError(
      `REST ${res.status} ${url.pathname} ${body}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

export async function restJson<T>(
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  return restRequest<T>("GET", path, { query });
}

export async function restPost<T>(path: string, body: unknown): Promise<T> {
  return restRequest<T>("POST", path, { body });
}

export function splitOwnerRepo(repo: string): { owner: string; name: string } {
  const i = repo.indexOf("/");
  if (i <= 0 || i === repo.length - 1)
    throw new Error(`--repo must be owner/repo, got: ${repo}`);
  return { owner: repo.slice(0, i), name: repo.slice(i + 1) };
}

export async function resolveRepo(flag?: string): Promise<string> {
  if (flag) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(flag))
      throw new Error(`--repo must be owner/repo, got: ${flag}`);
    const { owner, name } = splitOwnerRepo(flag);
    if (owner === "." || owner === ".." || name === "." || name === "..") {
      throw new Error(`--repo must be owner/repo, got: ${flag}`);
    }
    return flag;
  }
  try {
    return (
      await gh([
        "repo",
        "view",
        "--json",
        "nameWithOwner",
        "--jq",
        ".nameWithOwner",
      ])
    ).trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/gh not found|auth login|authentication/i.test(msg)) throw e;
    throw new Error(
      "not inside a repo with a GitHub remote; pass -R owner/repo",
    );
  }
}

/** Prefer `--pr` or the positional; reject conflicting values. */
export function prArg(flag?: string, positional?: string): string | undefined {
  if (flag != null && positional != null && flag !== positional) {
    throw new Error("pass the PR as [pr] or --pr, not both");
  }
  return flag ?? positional;
}

export function assertSha(sha: string): string {
  if (!/^[0-9a-fA-F]{7,64}$/.test(sha))
    throw new Error(`--sha must be a commit SHA, got: ${sha}`);
  return sha;
}

/** Strip C0/C1 controls so untrusted GitHub text cannot drive the terminal. */
export function sanitizeForTerminal(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10) {
      out += s[i];
      continue;
    }
    if (c <= 31 || c === 127 || (c >= 0x80 && c <= 0x9f)) continue;
    out += s[i];
  }
  return out;
}

/** PR number: explicit positional, or the current branch's PR when omitted. */
export async function resolvePr(
  arg: string | undefined,
  repoFlag: string | undefined,
  cwd?: string,
): Promise<number> {
  if (arg !== undefined) {
    const n = Number(arg);
    if (!Number.isInteger(n) || n <= 0)
      throw new Error(`PR must be a positive number, got: ${arg}`);
    return n;
  }
  if (repoFlag) throw new Error("with -R, also pass the PR number");
  return (await ghJson<{ number: number }>(["pr", "view", "--json", "number"], {
    cwd,
    env: { GH_PROMPT_DISABLED: "1", GH_DEBUG: "" },
  }))
    .number;
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

/**
 * Additive transport for the watch engine. The helpers above predate host-aware
 * metadata reads and intentionally keep their existing behavior for current scripts.
 */
const WATCH_TOKEN_TTL_MS = 5 * 60_000;
const GH_TOKEN_TIMEOUT_MS = 10_000;
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
const watchTokenCache = new Map<string, { token: string; expiresAt: number }>();
const credentialHmacKey = randomBytes(32);

export class GitHubTransportError extends Error {
  reason: string;
  retryable: boolean;
  status: number;
  headers: Record<string, string>;
  data: unknown;

  constructor(
    reason: string,
    message: string,
    options: {
      retryable?: boolean;
      status?: number;
      headers?: Record<string, string>;
      data?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "GitHubTransportError";
    this.reason = reason;
    this.retryable = options.retryable === true;
    this.status = options.status ?? 0;
    this.headers = options.headers ?? {};
    this.data = options.data;
  }
}

export function normalizeGitHubHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  if (/[/\\?#@]/.test(normalized) || !GH_HOST_RE.test(normalized)) {
    throw new Error(`GitHub host must be hostname[:port], got: ${host}`);
  }
  return normalized;
}

export function effectiveGitHubHost(host?: string): string {
  const raw = host ?? process.env.GH_HOST ?? "github.com";
  return normalizeGitHubHost(raw);
}

export function gitHubApiEndpoints(host?: string): {
  host: string;
  restBase: string;
  graphqlUrl: string;
} {
  const normalized = effectiveGitHubHost(host);
  if (normalized === "github.com") {
    return {
      host: normalized,
      restBase: "https://api.github.com/",
      graphqlUrl: "https://api.github.com/graphql",
    };
  }
  const hostnameOnly = normalized.split(":")[0] ?? normalized;
  if (hostnameOnly.endsWith(".ghe.com")) {
    return {
      host: normalized,
      restBase: `https://api.${normalized}/`,
      graphqlUrl: `https://api.${normalized}/graphql`,
    };
  }
  return {
    host: normalized,
    restBase: `https://${normalized}/api/v3/`,
    graphqlUrl: `https://${normalized}/api/graphql`,
  };
}

function tokenCacheKey(host: string): string {
  return normalizeGitHubHost(host);
}

export async function getGitHubToken(host?: string): Promise<string> {
  const normalized = effectiveGitHubHost(host);
  const key = tokenCacheKey(normalized);
  const cached = watchTokenCache.get(key);
  if (cached !== undefined && cached.expiresAt > Date.now()) return cached.token;
  const env = { ...process.env, GH_PROMPT_DISABLED: "1" };
  delete env.GH_DEBUG;
  traceSpawn(["auth", "token", "-h", normalized]);
  try {
    const { stdout } = await execFileP(
      "gh",
      ["auth", "token", "-h", normalized],
      {
        maxBuffer: MAX_BUFFER,
        encoding: "utf8",
        env,
        timeout: GH_TOKEN_TIMEOUT_MS,
        killSignal: "SIGTERM",
      },
    );
    const token = stdout.trim();
    if (!token) {
      throw new GitHubTransportError(
        "login_required",
        `gh auth token returned empty for ${normalized}; run gh auth login`,
      );
    }
    watchTokenCache.set(key, {
      token,
      expiresAt: Date.now() + WATCH_TOKEN_TTL_MS,
    });
    return token;
  } catch (e) {
    if (e instanceof GitHubTransportError) throw e;
    const err = e as NodeJS.ErrnoException & { stderr?: string | Buffer };
    if (err.code === "ENOENT") {
      throw new GitHubTransportError(
        "missing_tool",
        "gh not found on PATH; install the GitHub CLI",
      );
    }
    if (err.killed === true || err.signal === "SIGTERM") {
      throw new GitHubTransportError(
        "timeout",
        `gh auth token timed out for ${normalized}`,
        { retryable: true },
      );
    }
    throw new GitHubTransportError(
      "login_required",
      `gh auth token failed for ${normalized}; run gh auth login`,
    );
  }
}

export function dropGitHubToken(host?: string): void {
  watchTokenCache.delete(tokenCacheKey(effectiveGitHubHost(host)));
}

export async function gitHubCredentialFingerprint(host?: string): Promise<string> {
  const normalized = effectiveGitHubHost(host);
  const token = await getGitHubToken(normalized);
  return createHmac("sha256", credentialHmacKey)
    .update(normalized)
    .update("\0")
    .update(token)
    .digest("hex");
}

function responseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

async function fetchBounded(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    const aborted = e instanceof Error &&
      (e.name === "AbortError" || e.name === "TimeoutError" ||
        (e.cause instanceof Error && (e.cause.name === "AbortError" || e.cause.name === "TimeoutError")));
    if (aborted) {
      throw new GitHubTransportError("timeout", `GitHub request timed out after ${timeoutMs}ms`, {
        retryable: true,
      });
    }
    throw new GitHubTransportError(
      "network_error",
      e instanceof Error ? e.message : String(e),
      { retryable: true },
    );
  } finally {
    clearTimeout(timer);
  }
}

async function decodeResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  const type = res.headers.get("content-type") ?? "";
  if (!/json/i.test(type)) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export interface GitHubMetadataResponse {
  status: number;
  headers: Record<string, string>;
  data: unknown;
  errors: Array<{ type: string | null; message: string; path: Array<string | number> | null }>;
  requestId: string | null;
}

export interface GitHubRestMetadataOptions {
  host?: string;
  timeoutMs?: number;
  method?: "GET" | "POST";
  query?: Record<string, string>;
  body?: unknown;
  accept?: string;
}

function transportMeta(init: GitHubRestMetadataOptions = {}): {
  timeoutMs: number;
  method: "GET" | "POST";
  query?: Record<string, string>;
  body?: unknown;
  accept?: string;
} {
  return {
    timeoutMs: init?.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
    method: init?.method ?? "GET",
    query: init?.query,
    body: init?.body,
    accept: init?.accept,
  };
}

export async function graphqlMetadata(
  query: string,
  variables: Record<string, unknown> = {},
  init: { host?: string; timeoutMs?: number } = {},
): Promise<GitHubMetadataResponse> {
  const endpoints = gitHubApiEndpoints(init.host);
  const token = await getGitHubToken(endpoints.host);
  traceHttp("POST", endpoints.graphqlUrl, queryName(query));
  const res = await fetchBounded(
    endpoints.graphqlUrl,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    },
    init.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
  );
  const headers = responseHeaders(res.headers);
  if (res.status === 401) dropGitHubToken(endpoints.host);
  const decoded = await decodeResponseBody(res);
  const object =
    decoded !== null && typeof decoded === "object" && !Array.isArray(decoded)
      ? (decoded as {
          data?: unknown;
          errors?: Array<{ type?: unknown; message?: unknown; path?: unknown }>;
        })
      : {};
  const errors = Array.isArray(object.errors)
    ? object.errors.map((error) => ({
        type: typeof error?.type === "string" ? error.type : null,
        message: typeof error?.message === "string" ? error.message : "",
        path: Array.isArray(error?.path)
          ? error.path.filter((part): part is string | number =>
              typeof part === "string" || typeof part === "number",
            )
          : null,
      }))
    : undefined;
  return {
    status: res.status,
    headers,
    data: object.data,
    ...(errors === undefined ? {} : { errors }),
    requestId: headers["x-github-request-id"] ?? null,
  };
}

export async function restMetadata(
  path: string,
  init: GitHubRestMetadataOptions = {},
): Promise<GitHubMetadataResponse> {
  const endpoints = gitHubApiEndpoints(init.host);
  const token = await getGitHubToken(endpoints.host);
  const options = transportMeta(init);
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path) || path.startsWith("//")) {
    throw new GitHubTransportError("invalid_arguments", "GitHub REST transport paths must be relative.");
  }
  const url = new URL(path.replace(/^\//, ""), endpoints.restBase);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }
  traceHttp(options.method, url.toString());
  const headers = {
    ...authHeaders(token),
    ...(options.accept !== undefined ? { Accept: options.accept } : {}),
    ...(options.method === "POST" ? { "Content-Type": "application/json" } : {}),
  };
  const res = await fetchBounded(
    url.toString(),
    {
      method: options.method,
      headers,
      body: options.method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
    },
    options.timeoutMs,
  );
  const responseHeadersObject = responseHeaders(res.headers);
  if (res.status === 401) dropGitHubToken(endpoints.host);
  const data = await decodeResponseBody(res);
  return {
    status: res.status,
    headers: responseHeadersObject,
    data,
    requestId: responseHeadersObject["x-github-request-id"] ?? null,
  };
}

function hostPort(host: string): { hostname: string; port: number } {
  const normalized = normalizeGitHubHost(host);
  const index = normalized.lastIndexOf(":");
  if (index === -1) return { hostname: normalized, port: 443 };
  return { hostname: normalized.slice(0, index), port: Number(normalized.slice(index + 1)) };
}

/** Resolve a checkout repository and prove its web URL belongs to the requested host and port. */
export async function resolveRepoOnHost(
  host: string,
  flag?: string,
  cwd?: string,
): Promise<{ repo: string; host: string; url: string | null }> {
  const normalized = normalizeGitHubHost(host);
  if (flag) return { repo: await resolveRepo(flag), host: normalized, url: null };
  let row: { nameWithOwner?: unknown; url?: unknown };
  try {
    row = await ghJson<{ nameWithOwner?: unknown; url?: unknown }>([
      "repo",
      "view",
      "--json",
      "nameWithOwner,url",
    ], {
      cwd,
      env: { GH_PROMPT_DISABLED: "1", GH_DEBUG: "" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/gh not found|auth login|authentication/i.test(msg)) throw e;
    throw new Error("not inside a repo with a GitHub remote on the requested host");
  }
  const repo = typeof row.nameWithOwner === "string" ? row.nameWithOwner.trim() : "";
  const rawUrl = typeof row.url === "string" ? row.url.trim() : "";
  if (!repo || !rawUrl) {
    throw new Error("not inside a repo with a GitHub remote on the requested host");
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("checkout repository URL is not a valid web URL");
  }
  const expected = hostPort(normalized);
  const actualPort = parsed.port === "" ? (parsed.protocol === "https:" ? 443 : 80) : Number(parsed.port);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== expected.hostname ||
    actualPort !== expected.port
  ) {
    throw new Error("checkout repository URL does not match the requested GitHub host");
  }
  return { repo, host: normalized, url: rawUrl };
}
