#!/usr/bin/env node
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:https";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");
const repliesPath = path.join(repoRoot, "skills/engineering/fix-pr/references/replies.md");
const skillPath = path.join(repoRoot, "skills/engineering/fix-pr/SKILL.md");
const runScript = path.join(repoRoot, "skills/engineering/gh/scripts/run");

const repo = "acme/widgets";
const pr = 5;
const rootId = 4242;
const sha = "516b64c";
const inlineBody = `Fixed in ${sha}. Mission create stores the generated title, and delete removes that title with the mission.`;
const conversationBody = [
  `Fixed in ${sha}`,
  "",
  "Original summary",
  "- Add auto mission titles and safe delete cleanup",
].join("\n");

const work = mkdtempSync(path.join(tmpdir(), "fixpr-reply-"));
const recorded = [];
let server;

function sentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function replySection(skill) {
  const start = skill.indexOf("## 5. Reply and report");
  if (start < 0) throw new Error("fix-pr reply section missing");
  const rest = skill.slice(start + "## 5. Reply and report".length);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}

function conversationWaitsForInlineFailure(text) {
  return sentences(text).some(
    (s) =>
      /conversation/i.test(s) &&
      /inline|thread/i.test(s) &&
      /fail|fallback/i.test(s),
  );
}

function postsMainConversationAfterInlineSuccess(replies, section) {
  const flat = replies.replace(/\s+/g, " ");
  const sharesParent = /share one conversation reply per parent/.test(flat);
  return sharesParent && !conversationWaitsForInlineFailure(`${replies}\n${section}`);
}

function kindOf(urlPath) {
  if (/\/pulls\/\d+\/comments\/\d+\/replies$/.test(urlPath)) return "thread";
  if (/\/issues\/\d+\/comments$/.test(urlPath)) return "conversation";
  return "other";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function startGithub() {
  const key = path.join(work, "key.pem");
  const cert = path.join(work, "cert.pem");
  execFileSync(
    "openssl",
    ["req", "-x509", "-newkey", "rsa:2048", "-keyout", key, "-out", cert, "-days", "1", "-nodes", "-subj", "/CN=127.0.0.1"],
    { stdio: "ignore" },
  );
  return new Promise((resolve) => {
    const app = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, async (req, res) => {
      const urlPath = new URL(req.url ?? "/", "https://127.0.0.1").pathname;
      const raw = await readBody(req);
      let payload = {};
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = { raw };
        }
      }
      const kind = kindOf(urlPath);
      if (req.method === "POST") {
        recorded.push({ kind, path: urlPath, body: typeof payload.body === "string" ? payload.body : raw });
      }
      const postedId = kind === "thread" ? 9001 : 9002;
      const json =
        req.method === "GET"
          ? { id: rootId, in_reply_to_id: null, html_url: `https://github.com/${repo}/pull/${pr}#discussion_r${rootId}`, body: "Add auto mission titles and safe delete cleanup" }
          : {
              id: postedId,
              in_reply_to_id: kind === "thread" ? rootId : null,
              html_url:
                kind === "thread"
                  ? `https://github.com/${repo}/pull/${pr}#discussion_r${postedId}`
                  : `https://github.com/${repo}/pull/${pr}#issuecomment-${postedId}`,
              body: payload.body ?? "",
            };
      res.writeHead(201, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    });
    app.listen(0, "127.0.0.1", () => resolve(app));
  });
}

function writeGhStub() {
  const bin = path.join(work, "bin");
  mkdirSync(bin);
  const gh = path.join(bin, "gh");
  writeFileSync(
    gh,
    `#!/bin/sh
if [ "$1" = "auth" ] && [ "$2" = "token" ]; then
  printf '%s\\n' test-token
  exit 0
fi
echo "unexpected gh $*" >&2
exit 97
`,
  );
  chmodSync(gh, 0o755);
  return bin;
}

async function runReply(host, bin, args) {
  await execFileP(runScript, ["pr-reply.ts", ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GH_HOST: host,
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
    },
  });
}

function ofKind(kind) {
  return recorded.filter((row) => row.kind === kind);
}

function show(rows) {
  if (rows.length === 0) return "(none)";
  return rows.map((row) => `${row.path}\n${row.body}`).join("\n---\n");
}

const failures = [];
function check(name, ok, detail) {
  if (ok) {
    console.log(`ok ${name}`);
    return;
  }
  failures.push(name);
  console.log(`not ok ${name}`);
  if (detail) console.log(detail);
}

try {
  server = await startGithub();
  const port = server.address().port;
  const host = `127.0.0.1:${port}`;
  const bin = writeGhStub();
  const inlineFile = path.join(work, "inline.md");
  const conversationFile = path.join(work, "conversation.md");
  writeFileSync(inlineFile, `${inlineBody}\n`);
  writeFileSync(conversationFile, `${conversationBody}\n`);

  const replies = readFileSync(repliesPath, "utf8");
  const section = replySection(readFileSync(skillPath, "utf8"));
  const base = ["--pr", String(pr), "-R", repo];

  await runReply(host, bin, [...base, "--in-reply-to", String(rootId), "--body-file", inlineFile]);
  check(
    "one inline pr-reply writes the thread and not the main conversation",
    ofKind("thread").length === 1 && ofKind("conversation").length === 0,
    `thread:\n${show(ofKind("thread"))}\nconversation:\n${show(ofKind("conversation"))}`,
  );

  if (postsMainConversationAfterInlineSuccess(replies, section)) {
    await runReply(host, bin, [...base, "--conversation", "--body-file", conversationFile]);
  }

  const threads = ofKind("thread");
  const conversations = ofKind("conversation");
  check(
    "successful inline reply is the only comment for that finding",
    threads.length === 1 &&
      threads[0].body.startsWith(`Fixed in ${sha}`) &&
      conversations.length === 0,
    [
      "The inline thread reply succeeded, then the main conversation also received this finding.",
      `thread (${threads.length}):`,
      show(threads),
      `conversation (${conversations.length}):`,
      show(conversations),
    ].join("\n"),
  );
} catch (err) {
  failures.push("harness");
  console.log(`not ok harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  rmSync(work, { recursive: true, force: true });
}

console.log(`passed=${failures.length === 0 ? "yes" : "no"} failed=${failures.length}`);
process.exit(failures.length === 0 ? 0 : 1);
