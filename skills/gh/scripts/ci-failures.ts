#!/usr/bin/env node
import { execFile } from "node:child_process";
import { chmodSync, closeSync, constants, fchmodSync, mkdtempSync, openSync, unlinkSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, promisify } from "node:util";
import {
  assertSha,
  gh,
  ghJson,
  ghJobLogs,
  resolveRepo,
  restJson,
  run,
  sanitizeForTerminal,
  truncate,
} from "./lib.ts";

const execFileP = promisify(execFile);

const USAGE = `usage: ci-failures.ts [run-id] [--pr N] [--sha SHA] [--list] [-L n] [--workflow W] [-R owner/repo] [--json] [--full] [--help]

Failing GitHub Actions jobs with log snippets, for a run id, a PR, or the
current branch's PR. Exits 0 when the report succeeds, even if CI is red.
With -R, also pass --pr N or a run id (not needed for --list).
  --list      recent runs with conclusions, to find the failing run id;
              -L n runs (default 10), --workflow W filters by name or file
  --pr N      PR whose failing checks to drill into
  --sha SHA   pin failing checks to this commit
  --full      accepted; snippets stay capped (logs are on disk)
  --json      { repo, pr?, runs: [...], external: [...] }`;

const FAILING = new Set(["failure", "cancelled", "timed_out", "action_required", "startup_failure"]);
const MARKERS = /##\[error\]|\berror\b|\bfail(?:ed|ure)?\b|exception|traceback|panic|fatal/i;
const UNZIP_PY = `
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
out = sys.stdout.buffer
for name in sorted(z.namelist()):
    if name.endswith("/"):
        continue
    out.write(z.read(name))
    if not name.endswith(".txt"):
        out.write(b"\\n")
`;

interface Check {
  name: string;
  state: string;
  bucket: string;
  link: string;
}
interface Ann {
  path: string;
  start_line: number;
  annotation_level: string;
  message: string;
}
interface JobLog {
  file?: string;
  lines?: number;
  snippet?: string;
  error?: string;
}
interface JobOut {
  name: string;
  conclusion: string;
  url: string;
  failedSteps: string[];
  log: JobLog;
}
interface RunOk {
  runId: string;
  workflow: string;
  conclusion: string;
  url: string;
  checks: string[];
  jobs: JobOut[];
}
type RunEntry = RunOk | { runId: string; checks: string[]; error: string };

interface RunRow {
  databaseId: number;
  workflowName: string;
  displayTitle: string;
  event: string;
  status: string;
  conclusion: string;
  createdAt: string;
}

function* iterLines(s: string): Generator<string> {
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) {
      let end = i;
      if (end > start && s.charCodeAt(end - 1) === 13) end--;
      yield s.slice(start, end);
      start = i + 1;
    }
  }
  if (start <= s.length) yield s.slice(start);
}

/** Single-pass ring buffer around the last ##[error], else MARKERS. */
function snippet(log: string, before = 40, after = 5, cap = 100): string {
  const errorRe = /##\[error\]/;
  const ring: string[] = [];
  let head = 0;
  const lastCap: string[] = [];
  const ringPush = (line: string) => {
    if (ring.length < before) ring.push(line);
    else {
      ring[head] = line;
      head = (head + 1) % before;
    }
  };
  const ringSnap = (): string[] =>
    ring.length < before ? ring.slice() : ring.slice(head).concat(ring.slice(0, head));

  let bestError: string[] | null = null;
  let bestMark: string[] | null = null;
  let collect: { lines: string[]; remain: number; error: boolean } | null = null;

  for (const line of iterLines(log)) {
    lastCap.push(line);
    if (lastCap.length > cap) lastCap.shift();
    if (collect) {
      collect.lines.push(line);
      collect.remain--;
      if (collect.remain <= 0) {
        const w = collect.lines.slice(-cap);
        if (collect.error) bestError = w;
        else if (!bestError) bestMark = w;
        collect = null;
      }
    }
    const isErr = errorRe.test(line);
    const isMark = !isErr && MARKERS.test(line);
    if (isErr || (isMark && !bestError)) {
      const lines = [...ringSnap(), line];
      collect = { lines, remain: after, error: isErr };
      if (isErr) bestError = lines.slice(-cap);
      else bestMark = lines.slice(-cap);
    }
    ringPush(line);
  }
  if (collect) {
    const w = collect.lines.slice(-cap);
    if (collect.error) bestError = w;
    else if (!bestError) bestMark = w;
  }
  return (bestError ?? bestMark ?? lastCap).join("\n");
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "job";
}

function isZip(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
}

async function zipToText(zipPath: string): Promise<string> {
  try {
    const { stdout } = await execFileP("unzip", ["-p", zipPath], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT" && err.code !== 9 && err.code !== 1) {
      /* unzip ran but failed; fall through to python */
    }
    const { stdout } = await execFileP("python3", ["-c", UNZIP_PY, zipPath], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  }
}

function leadSnippet(annotations: Ann[], log: string): string {
  const cap = 10;
  const rows = annotations.map((a) => `${a.path}:${a.start_line} [${a.annotation_level}] ${a.message}`);
  const extra = rows.length > cap ? [`… ${rows.length - cap} more annotations`] : [];
  const prefix = [...rows.slice(0, cap), ...extra];
  const body = snippet(log);
  return prefix.length ? `${prefix.join("\n")}\n${body}` : body;
}

function writePrivate(path: string, data: string | Buffer): void {
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0);
  const fd = openSync(path, flags, 0o600);
  try {
    fchmodSync(fd, 0o600);
    writeSync(fd, data);
  } finally {
    closeSync(fd);
  }
}

async function annotationsFor(repo: string, checkRunId: number | undefined): Promise<Ann[]> {
  if (checkRunId == null) return [];
  try {
    return await restJson<Ann[]>(`repos/${repo}/check-runs/${checkRunId}/annotations`, { per_page: "100" });
  } catch {
    return [];
  }
}

async function downloadLog(repo: string, job: { databaseId: number; name: string }, logDir: string): Promise<JobLog & { text?: string }> {
  try {
    const buf = await ghJobLogs(repo, job.databaseId);
    let text: string;
    if (isZip(buf)) {
      const zipPath = join(logDir, `${job.databaseId}-${slug(job.name)}.zip`);
      writePrivate(zipPath, buf);
      try {
        text = await zipToText(zipPath);
      } finally {
        try {
          unlinkSync(zipPath);
        } catch {
          /* keep going; log file still written below */
        }
      }
    } else {
      text = buf.toString("utf8");
    }
    const file = join(logDir, `${job.databaseId}-${slug(job.name)}.log`);
    writePrivate(file, text);
    return { file, lines: [...iterLines(text)].length, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("404")) return { error: "log not available yet (job still running?)" };
    return { error: msg.split("\n").slice(-1)[0] ?? msg };
  }
}

interface ViewJob {
  name: string;
  conclusion: string;
  databaseId: number;
  url: string;
  steps: { name: string; conclusion: string }[];
}
interface RunView {
  workflowName: string;
  conclusion: string;
  url: string;
  jobs: ViewJob[];
}

async function analyzeRun(repo: string, runId: string, checkNames: string[], logDir: string): Promise<RunOk> {
  const rv = await ghJson<RunView>(["run", "view", runId, "-R", repo, "--json", "jobs,workflowName,conclusion,url"]);
  const failingJobs = rv.jobs.filter((j) => FAILING.has((j.conclusion ?? "").toLowerCase()));
  const outJobs = await Promise.all(
    failingJobs.map(async (j) => {
      const [anns, downloaded] = await Promise.all([
        annotationsFor(repo, j.databaseId),
        downloadLog(repo, j, logDir),
      ]);
      const log: JobLog = downloaded.error
        ? { error: downloaded.error }
        : { file: downloaded.file, lines: downloaded.lines, snippet: leadSnippet(anns, downloaded.text ?? "") };
      return {
        name: j.name,
        conclusion: j.conclusion ?? "",
        url: j.url,
        failedSteps: (j.steps ?? []).filter((s) => FAILING.has((s.conclusion ?? "").toLowerCase())).map((s) => s.name),
        log,
      };
    }),
  );
  return {
    runId,
    workflow: rv.workflowName,
    conclusion: rv.conclusion,
    url: rv.url,
    checks: checkNames,
    jobs: outJobs,
  };
}

function runIdFromLink(link: string | undefined): string | undefined {
  return link?.match(/\/actions\/runs\/(\d+)/)?.[1];
}

async function failingFromSha(repo: string, sha: string): Promise<{ runs: Map<string, string[]>; external: Check[] }> {
  const runs = new Map<string, string[]>();
  const external: Check[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await restJson<{ check_runs: { name: string; conclusion: string | null; status: string; html_url: string; details_url?: string }[] }>(
      `repos/${repo}/commits/${sha}/check-runs`,
      { per_page: "100", page: String(page), filter: "latest" },
    );
    const rows = batch.check_runs ?? [];
    for (const c of rows) {
      const conclusion = (c.conclusion ?? "").toLowerCase();
      const bucket = FAILING.has(conclusion) ? "fail" : conclusion === "success" ? "pass" : "pending";
      if (bucket !== "fail") continue;
      const link = c.html_url || c.details_url || "";
      const id = runIdFromLink(link) ?? runIdFromLink(c.details_url);
      if (id) runs.set(id, [...(runs.get(id) ?? []), c.name]);
      else external.push({ name: c.name, state: c.conclusion || c.status, bucket, link });
    }
    if (rows.length < 100) break;
  }
  return { runs, external };
}

run(async () => {
  const { values: v, positionals } = parseArgs({
    options: {
      pr: { type: "string" },
      sha: { type: "string" },
      repo: { type: "string", short: "R" },
      list: { type: "boolean" },
      workflow: { type: "string" },
      limit: { type: "string", short: "L" },
      json: { type: "boolean" },
      full: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });
  if (v.help) return void console.log(USAGE);
  const repo = await resolveRepo(v.repo);
  const log = (line = "") => console.log(sanitizeForTerminal(line));

  if (v.list) {
    const limit = v.limit ? Number(v.limit) : 10;
    if (!Number.isInteger(limit) || limit <= 0) throw new Error(`-L must be a positive number, got: ${v.limit}`);
    const args = [
      "run",
      "list",
      "-R",
      repo,
      "--limit",
      String(limit),
      "--json",
      "databaseId,workflowName,displayTitle,event,status,conclusion,createdAt",
    ];
    if (v.workflow) args.push("--workflow", v.workflow);
    const rows = await ghJson<RunRow[]>(args);
    if (v.json) return void console.log(JSON.stringify({ repo, runs: rows }, null, 2));
    log(`${repo}: last ${rows.length} runs${v.workflow ? ` · workflow ${v.workflow}` : ""}`);
    for (const r of rows) {
      const mark = r.conclusion === "success" ? "✓" : FAILING.has(r.conclusion) ? "✗" : "○";
      const concl = r.conclusion || r.status;
      const when = r.createdAt.slice(0, 16).replace("T", " ");
      const title = r.displayTitle && r.displayTitle !== r.workflowName ? ` · ${truncate(r.displayTitle, 48)}` : "";
      log(`${mark} ${r.databaseId}  ${when}  ${concl.padEnd(11)} ${r.event.padEnd(17)} ${r.workflowName}${title}`);
    }
    if (rows.length > 0) log(`\ndrill into a failure: ci-failures.ts <run-id>${v.repo ? ` -R ${repo}` : ""}`);
    return;
  }

  const runId = positionals[0];
  const runs = new Map<string, string[]>();
  const external: Check[] = [];
  let prNum: number | undefined;
  if (runId) {
    if (!/^\d+$/.test(runId)) throw new Error(USAGE);
    runs.set(runId, []);
  } else {
    if (v.pr && !/^\d+$/.test(v.pr)) throw new Error(`--pr must be a number, got: ${v.pr}`);
    if (!v.pr && v.repo) throw new Error("with -R, also pass --pr N or a run id");
    prNum = v.pr ? Number(v.pr) : (await ghJson<{ number: number }>(["pr", "view", "--json", "number"])).number;
    if (v.sha) {
      const pinned = await failingFromSha(repo, assertSha(v.sha));
      for (const [id, names] of pinned.runs) runs.set(id, names);
      external.push(...pinned.external);
    } else {
      const raw = await gh(["pr", "checks", String(prNum), "-R", repo, "--json", "name,state,bucket,link"], {
        okCodes: [1, 8],
      }).catch((e: unknown) => {
        if (e instanceof Error && /no checks reported/i.test(e.message)) return "[]";
        throw e;
      });
      const checks: Check[] = JSON.parse(raw || "[]");
      for (const c of checks.filter((c) => c.bucket === "fail")) {
        const id = runIdFromLink(c.link);
        if (id) runs.set(id, [...(runs.get(id) ?? []), c.name]);
        else external.push(c);
      }
    }
    if (runs.size === 0 && external.length === 0) {
      if (v.json) return void console.log(JSON.stringify({ repo, pr: prNum, runs: [], external: [] }, null, 2));
      return void log(`${repo} PR #${prNum}: no failing checks`);
    }
  }

  const logDir = runs.size > 0 ? mkdtempSync(join(process.env.TMPDIR || tmpdir(), "gh-ci-")) : "";
  if (logDir) chmodSync(logDir, 0o700);

  const results: RunEntry[] = await Promise.all(
    [...runs].map(async ([id, names]) => {
      try {
        return await analyzeRun(repo, id, names, logDir);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { runId: id, checks: names, error: msg.split("\n").slice(-1)[0] ?? msg };
      }
    }),
  );

  if (v.json) {
    return void console.log(JSON.stringify({ repo, pr: prNum, runs: results, external }, null, 2));
  }

  const prLabel = prNum ? ` PR #${prNum}` : "";
  log(`${repo}${prLabel}: ${results.length} run${results.length === 1 ? "" : "s"} analyzed\n`);
  for (const r of results) {
    if ("error" in r) {
      log(`✗ could not analyze run ${r.runId}: ${r.error}\n`);
      continue;
    }
    if (r.jobs.length === 0 && !FAILING.has(r.conclusion)) {
      log(`○ ${r.workflow} · run ${r.runId} concluded ${r.conclusion || "in progress"}, nothing to report\n`);
      continue;
    }
    const via = r.checks.length ? ` (checks: ${r.checks.join(", ")})` : "";
    log(`✗ ${r.workflow} · run ${r.runId} · ${r.conclusion}${via}`);
    log(`  ${r.url}`);
    if (r.jobs.length === 0) log("  no failing jobs; failure is at the workflow level (startup/config?)");
    for (const j of r.jobs) {
      const steps = j.failedSteps.length ? `, failed step: ${j.failedSteps.join(", ")}` : "";
      log(`  job: ${j.name} (${j.conclusion})${steps}`);
      if (j.log.error) {
        log(`    log: ${j.log.error}`);
      } else {
        log(`    log: ${j.log.file} (${j.log.lines} lines)`);
        log(`    ┄ snippet ┄`);
        log((j.log.snippet ?? "").replace(/^/gm, "    "));
      }
    }
    log();
  }
  for (const c of external) log(`✗ ${c.name} is an external check (not GitHub Actions): ${c.link || "(no link)"}`);
});
