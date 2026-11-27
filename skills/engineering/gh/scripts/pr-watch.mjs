#!/usr/bin/env node
// Pull request watch CLI. Plain JavaScript; state, network, planning, and
// evaluation stay behind injected store and operations interfaces.

import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const COMMAND_ORDER = [
  "watches add",
  "watches list",
  "watches inspect",
  "watches remove",
  "watches run",
  "events list",
  "help",
  "help search",
];

const EVENT_CAP = 500;
const WATCH_CAP = 200;
const DEFAULT_LIMIT = 50;
const FOLLOW_INTERVAL_MS = 120_000;
const MAX_PR = 2_147_483_647;
const WATCH_ID_RE = /^w_[0-9a-z]{5}$/;
const REPO_PART_RE = /^[A-Za-z0-9._-]+$/;
const DURATION_RE = /^([1-9]\d*)([smhd])$/;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5]))?$/i;

const REASONS = new Set([
  "invalid_arguments",
  "unknown_option",
  "unknown_command",
  "missing_pr",
  "missing_repo",
  "missing_timeout",
  "ambiguous_watch",
  "missing_tool",
  "login_required",
  "token_expired",
  "permission_denied",
  "not_found",
  "conflict",
  "rate_limited",
  "network_error",
  "api_error",
  "unknown_outcome",
  "invalid_config",
  "timeout",
  "canceled",
  "internal_error",
]);

const REASON_DEFAULTS = {
  invalid_arguments: { exitCode: 2, status: "action_required", userActionRequired: true, retryable: false },
  unknown_option: { exitCode: 2, status: "action_required", userActionRequired: true, retryable: false },
  unknown_command: { exitCode: 2, status: "action_required", userActionRequired: true, retryable: false },
  missing_pr: { exitCode: 2, status: "action_required", userActionRequired: true, retryable: false },
  missing_repo: { exitCode: 2, status: "action_required", userActionRequired: true, retryable: false },
  missing_timeout: { exitCode: 2, status: "action_required", userActionRequired: true, retryable: false },
  ambiguous_watch: { exitCode: 2, status: "action_required", userActionRequired: true, retryable: false },
  missing_tool: { exitCode: 1, status: "action_required", userActionRequired: true, retryable: false },
  login_required: { exitCode: 1, status: "action_required", userActionRequired: true, retryable: false },
  token_expired: { exitCode: 1, status: "action_required", userActionRequired: true, retryable: false },
  permission_denied: { exitCode: 1, status: "action_required", userActionRequired: true, retryable: false },
  invalid_config: { exitCode: 1, status: "action_required", userActionRequired: true, retryable: false },
  not_found: { exitCode: 1, status: "action_required", userActionRequired: true, retryable: false },
  conflict: { exitCode: 1, status: "error", retryable: false },
  rate_limited: { exitCode: 1, status: "error", retryable: true },
  network_error: { exitCode: 1, status: "error", retryable: true },
  timeout: { exitCode: 1, status: "error", retryable: true },
  api_error: { exitCode: 1, status: "error", retryable: true },
  unknown_outcome: { exitCode: 1, status: "error", retryable: false },
  canceled: { exitCode: 130, status: "error", retryable: false },
  internal_error: { exitCode: 1, status: "error", retryable: false },
};

class CliError extends Error {
  constructor(reason, message, options = {}) {
    super(message);
    this.name = "CliError";
    this.reason = reason;
    this.status = options.status;
    this.exitCode = options.exitCode;
    this.userActionRequired = options.userActionRequired;
    this.retryable = options.retryable;
    this.retryableSpecified = options.retryableSpecified === true;
    this.retryAfter = options.retryAfter;
    this.requestId = options.requestId;
    this.warnings = options.warnings;
    this.next = options.next ?? [];
    this.data = options.data ?? {};
  }
}

function cliError(reason, message, options = {}) {
  const enriched = { ...options };
  if (Object.hasOwn(options, "retryable") && !Object.hasOwn(options, "retryableSpecified")) {
    enriched.retryableSpecified = true;
  }
  return new CliError(reason, message, enriched);
}

function usageError(message, data = {}, next = []) {
  return cliError("invalid_arguments", message, { data, next });
}

function unknownOption(option) {
  return cliError("unknown_option", `Unknown option "${option}".`, {
    data: { option },
  });
}

function unknownCommand(command) {
  return cliError("unknown_command", `Unknown command "${command}".`, {
    data: { command },
  });
}

function field(name, type, required) {
  return { name, type, required, secret: false };
}

function schema(names) {
  return names.map(([name, type, required = true]) => field(name, type, required));
}

const RESULT_SCHEMAS = {
  "watches add": schema([
    ["watch", "object"],
    ["outcome", "string"],
    ["events", "array"],
    ["next", "array"],
    ["warnings", "array", false],
  ]),
  "watches list": schema([
    ["watches", "array"],
    ["pagination", "object"],
    ["warnings", "array", false],
  ]),
  "watches inspect": schema([
    ["watch", "object"],
    ["warnings", "array", false],
  ]),
  "watches remove": schema([
    ["watch", "object"],
    ["outcome", "string"],
    ["next", "array"],
    ["warnings", "array", false],
  ]),
  "watches run": schema([
    ["outcome", "string"],
    ["summary", "object"],
    ["events", "array"],
    ["results", "array"],
    ["warnings", "array", false],
  ]),
  "events list": schema([
    ["events", "array"],
    ["pagination", "object"],
    ["warnings", "array", false],
  ]),
  help: schema([
    ["path", "string"],
    ["summary", "string"],
    ["subcommands", "array"],
    ["arguments", "array"],
    ["options", "array"],
    ["lifecycle", "null"],
    ["resultSchema", "array"],
    ["commands", "array", false],
    ["warnings", "array", false],
  ]),
  "help search": schema([
    ["commands", "array"],
    ["warnings", "array", false],
  ]),
};

function option(name, short, type, valueHint, defaultValue, acceptedValues, description) {
  return {
    name,
    short,
    type,
    valueHint,
    default: defaultValue,
    acceptedValues,
    repeatable: false,
    deprecated: false,
    description,
  };
}

const BOOLEAN_VALUES = ["true", "false"];
const GLOBAL_OPTIONS = [
  option("--json", null, "boolean", null, false, BOOLEAN_VALUES, "Write machine-readable JSON."),
  option("--fields", null, "string", "FIELDS", null, null, "Select top-level JSON result fields."),
  option("--debug", "-d", "boolean", null, false, BOOLEAN_VALUES, "Write redacted diagnostics to stderr."),
  option("--no-color", null, "boolean", null, false, null, "Disable terminal color."),
  option("--cwd", null, "string", "DIR", null, null, "Resolve the current checkout from DIR."),
  option("--non-interactive", null, "boolean", null, null, BOOLEAN_VALUES, "Disable interactive terminal behavior."),
  option("--help", "-h", "boolean", null, false, null, "Print help."),
];

function commandOptions(extra) {
  return [...extra, ...GLOBAL_OPTIONS];
}

function argument(name, valueHint, required) {
  return { name, valueHint, required };
}

const COMMAND_METADATA = {
  "watches add": {
    path: "watches add",
    summary: "Register a pull request watch.",
    arguments: [argument("pr", "PR", false)],
    options: commandOptions([
      option("--repo", null, "string", "OWNER/REPO", null, null, "Resolve the pull request in OWNER/REPO."),
    ]),
    lifecycle: null,
    resultSchema: RESULT_SCHEMAS["watches add"],
    nouns: ["watch", "pull request", "registration", "baseline"],
    examples: ["watches add 123 --repo owner/repo --json"],
  },
  "watches list": {
    path: "watches list",
    summary: "List active or ended pull request watches.",
    arguments: [],
    options: commandOptions([
      option("--state", null, "string", "STATE", "active", ["active", "ended", "all"], "Filter watches by lifecycle state."),
      option("--all", "-a", "boolean", null, false, BOOLEAN_VALUES, "Fetch every remaining row."),
      option("--limit", "-n", "integer", "N", DEFAULT_LIMIT, null, "Limit the number of rows."),
      option("--next", null, "string", "CURSOR", null, null, "Continue from an opaque pagination cursor."),
    ]),
    lifecycle: null,
    resultSchema: RESULT_SCHEMAS["watches list"],
    nouns: ["watch", "list", "active", "ended"],
    examples: ["watches list --state all --json"],
  },
  "watches inspect": {
    path: "watches inspect",
    summary: "Inspect one pull request watch and its read health.",
    arguments: [argument("watch", "WATCH", true)],
    options: commandOptions([]),
    lifecycle: null,
    resultSchema: RESULT_SCHEMAS["watches inspect"],
    nouns: ["watch", "inspect", "dedupe", "quota", "read"],
    examples: ["watches inspect w_7x2kq --json"],
  },
  "watches remove": {
    path: "watches remove",
    summary: "End an active pull request watch.",
    arguments: [argument("watch", "WATCH", true)],
    options: commandOptions([]),
    lifecycle: null,
    resultSchema: RESULT_SCHEMAS["watches remove"],
    nouns: ["watch", "remove", "end"],
    examples: ["watches remove w_7x2kq --json"],
  },
  "watches run": {
    path: "watches run",
    summary: "Run one bounded watch sweep, or follow sweep ticks.",
    arguments: [],
    options: commandOptions([
      option("--watch", null, "string", "WATCH", null, null, "Sweep only one active watch."),
      option("--follow", "-f", "boolean", null, false, BOOLEAN_VALUES, "Sweep every two minutes until stopped."),
      option("--timeout", null, "string", "DURATION", null, null, "Stop follow mode after a duration."),
    ]),
    lifecycle: null,
    resultSchema: RESULT_SCHEMAS["watches run"],
    nouns: ["watch", "run", "sweep", "follow", "poll"],
    examples: ["watches run --follow --timeout 10m --json"],
  },
  "events list": {
    path: "events list",
    summary: "Inspect the local pull request watch event log.",
    arguments: [],
    options: commandOptions([
      option("--watch", null, "string", "WATCH", null, null, "Filter events to one watch."),
      option("--since", "-s", "string", "TIME", null, null, "Include events since a UTC time or relative duration."),
      option("--all", "-a", "boolean", null, false, BOOLEAN_VALUES, "Fetch every remaining row."),
      option("--limit", "-n", "integer", "N", DEFAULT_LIMIT, null, "Limit the number of rows."),
      option("--next", null, "string", "CURSOR", null, null, "Continue from an opaque pagination cursor."),
    ]),
    lifecycle: null,
    resultSchema: RESULT_SCHEMAS["events list"],
    nouns: ["event", "list", "history", "watch"],
    examples: ["events list --since 30m --json"],
  },
  help: {
    path: "help",
    summary: "Print offline command help.",
    arguments: [],
    options: commandOptions([
      option("--all", "-a", "boolean", null, false, BOOLEAN_VALUES, "List every implemented command."),
    ]),
    lifecycle: null,
    resultSchema: RESULT_SCHEMAS.help,
    nouns: ["help", "command", "usage"],
    examples: ["help --all --json"],
  },
  "help search": {
    path: "help search",
    summary: "Search offline command help.",
    arguments: [argument("query", "QUERY", true)],
    options: commandOptions([]),
    lifecycle: null,
    resultSchema: RESULT_SCHEMAS["help search"],
    nouns: ["help", "search", "command"],
    examples: ["help search watch --json"],
  },
};

const GROUP_METADATA = {
  watches: {
    path: "watches",
    summary: "Manage pull request watches.",
    subcommands: COMMAND_ORDER.filter((command) => command.startsWith("watches ")).map((command) => ({
      path: command,
      summary: COMMAND_METADATA[command].summary,
    })),
  },
  events: {
    path: "events",
    summary: "Inspect pull request watch events.",
    subcommands: COMMAND_ORDER.filter((command) => command.startsWith("events ")).map((command) => ({
      path: command,
      summary: COMMAND_METADATA[command].summary,
    })),
  },
  help: {
    path: "help",
    summary: COMMAND_METADATA.help.summary,
    subcommands: [{ path: "help search", summary: COMMAND_METADATA["help search"].summary }],
  },
};

const ROOT_METADATA = {
  path: "",
  summary: "Watch GitHub pull requests with explicit bounded polls.",
  subcommands: [
    { path: "watches", summary: GROUP_METADATA.watches.summary },
    { path: "events", summary: GROUP_METADATA.events.summary },
    { path: "help", summary: COMMAND_METADATA.help.summary },
  ],
};

const CANONICAL_FIELDS = {};
for (const [command, meta] of Object.entries(COMMAND_METADATA)) {
  CANONICAL_FIELDS[command] = meta.resultSchema.map((item) => item.name);
}
const FOLLOW_FIELDS = ["type", "watches", "intervalSeconds", "event", "reason", "message", "data"];
const HELP_DOCUMENT_FIELDS = ["path", "summary", "subcommands", "arguments", "options", "lifecycle", "resultSchema", "warnings"];

const VALUE_OPTIONS = new Map([
  ["repo", "repo"],
  ["state", "state"],
  ["limit", "limit"],
  ["next", "next"],
  ["watch", "watch"],
  ["since", "since"],
  ["timeout", "timeout"],
  ["fields", "fields"],
  ["cwd", "cwd"],
]);
const BOOLEAN_OPTIONS = new Map([
  ["json", "json"],
  ["all", "all"],
  ["follow", "follow"],
  ["debug", "debug"],
]);
const SHORT_OPTIONS = new Map([
  ["-a", { name: "all", type: "boolean" }],
  ["-n", { name: "limit", type: "value" }],
  ["-s", { name: "since", type: "value" }],
  ["-f", { name: "follow", type: "boolean" }],
  ["-h", { name: "help", type: "boolean" }],
  ["-d", { name: "debug", type: "boolean" }],
]);

const ALLOWED_OPTIONS = {
  "watches add": new Set(["repo", "json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
  "watches list": new Set(["state", "all", "limit", "next", "json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
  "watches inspect": new Set(["json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
  "watches remove": new Set(["json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
  "watches run": new Set(["watch", "follow", "timeout", "json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
  "events list": new Set(["watch", "since", "all", "limit", "next", "json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
  help: new Set(["all", "json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
  "help search": new Set(["json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
  root: new Set(["json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
  watches: new Set(["json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
  events: new Set(["json", "fields", "debug", "no-color", "cwd", "non-interactive", "help"]),
};

function defaultRunnerPath() {
  return fileURLToPath(new URL("./run", import.meta.url));
}

function isIterableWriter(value) {
  return Array.isArray(value);
}

function writeTo(target, text) {
  if (target === undefined || target === null) {
    if (text.length > 0) {
      // The default is filled by main(); tests always inject a writer.
      return;
    }
    return;
  }
  try {
    if (typeof target === "function") {
      target(text);
      return;
    }
    if (isIterableWriter(target)) {
      target.push(text);
      return;
    }
    if (typeof target.write === "function") {
      target.write(text);
      return;
    }
  } catch (error) {
    if (error && (error.code === "EPIPE" || error.code === "ERR_STREAM_DESTROYED")) {
      throw new BrokenPipeError();
    }
    throw error;
  }
  throw cliError("internal_error", "The configured output stream is not writable.");
}

class BrokenPipeError extends Error {
  constructor() {
    super("stdout closed");
    this.name = "BrokenPipeError";
    this.code = "EPIPE";
  }
}

function makeIo(deps) {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  return {
    stdout: (text) => writeTo(stdout, text),
    stderr: (text) => writeTo(stderr, text),
  };
}

function ttyValue(deps, stream) {
  if (typeof deps.isTTY === "boolean") return deps.isTTY;
  if (deps.isTTY && typeof deps.isTTY === "object") return deps.isTTY[stream] === true;
  const candidate = stream === "stdout"
    ? (deps.stdout ?? process.stdout)
    : stream === "stderr"
      ? (deps.stderr ?? process.stderr)
      : (deps.stdin ?? process.stdin);
  return candidate?.isTTY === true;
}

function environment(deps) {
  return deps.env ?? process.env ?? {};
}

function workingDirectory(deps) {
  return deps.cwd ?? process.cwd();
}

function nowMs(deps) {
  if (typeof deps.now !== "function") return Date.now();
  const value = deps.now();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function isoNow(deps) {
  return new Date(nowMs(deps)).toISOString();
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(text)) return text;
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

function commandFromArgv(argv) {
  return argv.map(shellQuote).join(" ");
}

function nextCommand(runnerPath, args, when) {
  const argv = [runnerPath, "pr-watch.mjs", ...args];
  return { command: commandFromArgv(argv), argv, when };
}

function missingPrNext(ctx) {
  return [
    nextCommand(
      ctx.runnerPath,
      ["watches", "add", "<PR>", "--repo", "<OWNER/REPO>"],
      "Replace both placeholders with exact values",
    ),
  ];
}

function missingTimeoutNext(ctx) {
  return [
    nextCommand(
      ctx.runnerPath,
      ["watches", "run", "--follow", "--timeout", "<DURATION>", "--json"],
      "Replace <DURATION> with a positive duration such as 30m",
    ),
  ];
}

function redactSecrets(text) {
  return String(text)
    .replace(/(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
}

function stripRemoteControls(text) {
  return sanitizeHumanText(text);
}

function classifyReason(error) {
  const direct = error?.reason ?? error?.code;
  if (typeof direct === "string" && REASONS.has(direct)) return direct;
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return "timeout";
  if (error?.code === "ENOENT") return "missing_tool";
  const status = error?.status;
  if (status === 0) return "network_error";
  if (status === 401) return "token_expired";
  if (status === 403) return "permission_denied";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (typeof status === "number" && status >= 500) return "api_error";
  return "internal_error";
}

function normalizeError(error) {
  if (error instanceof CliError) {
    const defaults = REASON_DEFAULTS[error.reason] ?? REASON_DEFAULTS.internal_error;
    error.status = error.status ?? defaults.status;
    error.exitCode = error.exitCode ?? defaults.exitCode;
    if (error.retryable === undefined) error.retryable = defaults.retryable;
    if (error.userActionRequired === undefined && defaults.userActionRequired !== undefined) {
      error.userActionRequired = defaults.userActionRequired;
    }
    error.next = Array.isArray(error.next) ? error.next : [];
    error.data = error.data && typeof error.data === "object" && !Array.isArray(error.data) ? error.data : {};
    return error;
  }

  const reason = classifyReason(error);
  const retryableSpecified = typeof error?.retryable === "boolean";
  const defaults = REASON_DEFAULTS[reason] ?? REASON_DEFAULTS.internal_error;
  const fallback = reason === "internal_error" ? "The watch command failed unexpectedly." : "The watch command failed.";
  const message = redactSecrets(
    typeof error?.message === "string" && error.message.trim() ? error.message : fallback,
  );
  const data = error?.data && typeof error.data === "object" && !Array.isArray(error.data)
    ? { ...error.data }
    : {};
  if (typeof data.remoteMessage === "string" && data.remoteMessage) {
    data.remoteMessage = stripRemoteControls(data.remoteMessage);
  }
  if (typeof error?.remoteMessage === "string" && error.remoteMessage) {
    data.remoteMessage = stripRemoteControls(error.remoteMessage);
  }
  return cliError(reason, message, {
    status: defaults.status,
    exitCode: defaults.exitCode,
    userActionRequired: error?.userActionRequired === true || (error?.userActionRequired === undefined ? defaults.userActionRequired : false),
    retryable: retryableSpecified ? error.retryable : defaults.retryable,
    retryableSpecified,
    retryAfter: typeof error?.retryAfter === "number" && error.retryAfter >= 0 ? error.retryAfter : undefined,
    requestId: typeof error?.requestId === "string" ? error.requestId : undefined,
    data,
  });
}

function errorDocument(error) {
  const normalized = normalizeError(error);
  const document = {
    status: normalized.status,
    reason: normalized.reason,
    message: normalized.message,
    next: Array.isArray(normalized.next) ? normalized.next : [],
    data: normalized.data && typeof normalized.data === "object" ? normalized.data : {},
  };
  if (normalized.userActionRequired === true) document.userActionRequired = true;
  if (normalized.retryable === true || (normalized.retryableSpecified === true && normalized.retryable === false)) {
    document.retryable = normalized.retryable;
  }
  if (typeof normalized.retryAfter === "number") document.retryAfter = normalized.retryAfter;
  if (typeof normalized.requestId === "string") document.requestId = normalized.requestId;
  if (Array.isArray(normalized.warnings) && normalized.warnings.length > 0) document.warnings = normalized.warnings;
  return document;
}

function writeError(ctx, error) {
  const normalized = normalizeError(error);
  if (ctx.json) {
    ctx.io.stderr(`${JSON.stringify(errorDocument(normalized))}\n`);
  } else if (normalized.reason === "canceled") {
    ctx.io.stderr("Canceled.\n");
  } else {
    ctx.io.stderr(`error: ${sanitizeHumanText(normalized.message)}\n`);
    for (const item of normalized.next ?? []) {
      ctx.io.stderr(`next: ${sanitizeHumanText(item.command)}\n`);
    }
    for (const warning of normalized.warnings ?? []) {
      writeHumanWarning(ctx, warning);
    }
  }
  return normalized.exitCode ?? 1;
}

function scanBooleanFlag(argv, name) {
  let value = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") break;
    if (token.startsWith("--") && !token.includes("=") && VALUE_OPTIONS.has(token.slice(2))) {
      index += 1;
      continue;
    }
    if ((token === "-n" || token === "-s")) {
      index += 1;
      continue;
    }
    if (token === `--${name}`) value = true;
    else if (token === `--no-${name}`) value = false;
    else if (token === `--${name}=true`) value = true;
    else if (token === `--${name}=false`) value = false;
  }
  return value;
}

function parseBooleanAssignment(name, negative, assignment, token) {
  if (negative) {
    if (assignment !== undefined) throw unknownOption(token);
    return false;
  }
  if (assignment === undefined) return true;
  if (assignment === "true") return true;
  if (assignment === "false") return false;
  throw usageError(`Option --${name} accepts only true or false.`);
}

function parseArgv(argv) {
  const positional = [];
  const options = new Map();
  const provided = new Set();
  const unknown = [];
  let endOptions = false;

  function setOption(name, value, token) {
    options.set(name, value);
    provided.add(name);
    if (name === "help" && token !== "--help" && token !== "-h") throw unknownOption(token);
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!endOptions && token === "--") {
      endOptions = true;
      continue;
    }
    if (!endOptions && token.startsWith("--") && token.length > 2) {
      const equal = token.indexOf("=");
      const rawName = equal === -1 ? token.slice(2) : token.slice(2, equal);
      const assignment = equal === -1 ? undefined : token.slice(equal + 1);

      if (VALUE_OPTIONS.has(rawName)) {
        const name = VALUE_OPTIONS.get(rawName);
        let value = assignment;
        if (value === undefined) {
          if (index + 1 >= argv.length) throw usageError(`Option --${rawName} requires a value.`);
          index += 1;
          value = argv[index];
        }
        if (value === "") throw usageError(`Option --${rawName} requires a non-empty value.`);
        setOption(name, value, token);
        continue;
      }

      if (BOOLEAN_OPTIONS.has(rawName) || BOOLEAN_OPTIONS.has(rawName.replace(/^no-/, ""))) {
        const negative = rawName.startsWith("no-");
        const positive = negative ? rawName.slice(3) : rawName;
        if (!BOOLEAN_OPTIONS.has(positive)) {
          unknown.push(token);
          continue;
        }
        setOption(positive, parseBooleanAssignment(positive, negative, assignment, token), token);
        continue;
      }

      if (rawName === "non-interactive") {
        if (assignment === undefined) setOption("non-interactive", true, token);
        else if (assignment === "true") setOption("non-interactive", true, token);
        else if (assignment === "false") setOption("non-interactive", false, token);
        else throw usageError("Option --non-interactive accepts only true or false.");
        continue;
      }

      if (rawName === "no-color") {
        if (assignment !== undefined) throw unknownOption(token);
        setOption("no-color", true, token);
        continue;
      }

      if (rawName === "help") {
        if (assignment !== undefined) throw unknownOption(token);
        setOption("help", true, token);
        continue;
      }

      unknown.push(token);
      continue;
    }

    if (!endOptions && token.startsWith("-") && token !== "-") {
      const short = SHORT_OPTIONS.get(token);
      if (!short) {
        unknown.push(token);
        continue;
      }
      if (short.type === "boolean") {
        setOption(short.name, true, token);
        continue;
      }
      if (index + 1 >= argv.length) throw usageError(`Option ${token} requires a value.`);
      index += 1;
      const value = argv[index];
      if (value === "") throw usageError(`Option ${token} requires a non-empty value.`);
      setOption(short.name, value, token);
      continue;
    }

    positional.push(token);
  }

  return { positional, options, provided, unknown };
}

function resolveCommand(positional, helpRequested) {
  if (positional.length === 0) return { key: "root", kind: "root", args: [] };
  const [first, second, ...rest] = positional;
  if (!["watches", "events", "help"].includes(first)) throw unknownCommand(first);

  if (second === undefined) {
    if (first !== "help") return { key: first, kind: "group", args: [] };
    return { key: "help", kind: "command", args: [] };
  }

  const key = `${first} ${second}`;
  if (!COMMAND_METADATA[key]) throw unknownCommand(key);
  return { key, kind: "command", args: positional.slice(2) };
}

function validatePositionals(command, args) {
  switch (command.key) {
    case "watches add":
      if (args.length > 1) throw usageError("watches add accepts at most one pull request number.");
      return;
    case "watches inspect":
    case "watches remove":
      if (args.length !== 1) throw usageError(`${command.key} requires exactly one watch selector.`);
      return;
    case "help search":
      if (args.length !== 1) throw usageError("help search requires exactly one query.");
      return;
    case "watches list":
    case "watches run":
    case "events list":
    case "help":
      if (args.length > 0) throw usageError(`${command.key} does not accept positional arguments.`);
      return;
    default:
      return;
  }
}

function validateAllowedOptions(command, parsed) {
  const allowed = ALLOWED_OPTIONS[command.key] ?? ALLOWED_OPTIONS.root;
  for (const token of parsed.unknown) throw unknownOption(token);
  for (const name of parsed.provided) {
    if (!allowed.has(name)) throw unknownOption(`--${name}`);
  }
}

function parseDuration(value, optionName) {
  const match = DURATION_RE.exec(String(value ?? ""));
  if (!match) throw usageError(`${optionName} must be a positive integer followed by s, m, h, or d.`);
  const amount = Number(match[1]);
  const unit = match[2];
  const scale = unit === "s" ? 1_000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return amount * scale;
}

function strictIsoUtcMs(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/.exec(value);
  if (!match) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
    ? ms
    : null;
}

function parseSince(value, deps) {
  const text = String(value);
  if (ISO_UTC_RE.test(text)) {
    const ms = strictIsoUtcMs(text);
    if (ms !== null) return { iso: new Date(ms).toISOString(), ms };
  }
  if (DURATION_RE.test(text)) {
    const ms = nowMs(deps) - parseDuration(text, "--since");
    return { iso: new Date(ms).toISOString(), ms };
  }
  throw usageError("--since must be an ISO 8601 UTC timestamp or a positive duration followed by s, m, h, or d.");
}

function parsePr(text) {
  if (!/^\d+$/.test(String(text))) {
    throw usageError("PR must be a positive integer, not a URL or other value.");
  }
  const pr = Number(text);
  if (!Number.isSafeInteger(pr) || pr <= 0 || pr > MAX_PR) {
    throw usageError(`PR must be a positive integer no greater than ${MAX_PR}.`);
  }
  return pr;
}

function parseRepo(value) {
  const repo = String(value);
  const parts = repo.split("/");
  if (
    parts.length !== 2 ||
    !REPO_PART_RE.test(parts[0]) ||
    !REPO_PART_RE.test(parts[1]) ||
    parts[0] === "." || parts[0] === ".." ||
    parts[1] === "." || parts[1] === ".."
  ) {
    throw usageError("--repo must be owner/repo using ASCII letters, digits, dot, underscore, or dash.");
  }
  return repo;
}

function parseWatchSelector(selector) {
  const text = String(selector);
  if (WATCH_ID_RE.test(text)) return { kind: "id", id: text };
  const hash = text.lastIndexOf("#");
  if (hash > 0) {
    const repo = parseRepo(text.slice(0, hash));
    const pr = parsePr(text.slice(hash + 1));
    return { kind: "ref", repo, pr };
  }
  throw usageError("WATCH must be a watch id or owner/repo#N.");
}

function normalizeHost(raw) {
  const text = String(raw ?? "").trim().toLowerCase();
  if (!text || /[/\\?#@]/.test(text) || !HOST_RE.test(text)) {
    throw cliError("invalid_config", "GH_HOST must be hostname[:port] with no scheme, path, query, or userinfo.");
  }
  return text;
}

function effectiveHost(env) {
  return normalizeHost(env.GH_HOST?.trim() || "github.com");
}

function validFieldsFor(command, follow) {
  if (command.key === "watches run" && follow) return FOLLOW_FIELDS;
  if (command.key === "help") return CANONICAL_FIELDS.help;
  return CANONICAL_FIELDS[command.key] ?? [];
}

function parseFields(parsed, command, follow, helpMode = false) {
  const raw = parsed.options.get("fields");
  if (raw === undefined) return null;
  if (!parsed.options.get("json")) {
    throw usageError("--fields requires --json.");
  }
  const valid = helpMode ? HELP_DOCUMENT_FIELDS : validFieldsFor(command, follow);
  const seen = new Set();
  const fields = [];
  for (const item of String(raw).split(",")) {
    const name = item.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, "");
    if (name === "") throw usageError("--fields contains an empty item.", { fields: valid });
    if (!valid.includes(name)) {
      throw usageError(`Unknown result field "${name}".`, { fields: valid });
    }
    if (!seen.has(name)) {
      seen.add(name);
      fields.push(name);
    }
  }
  return fields;
}

function projectDocument(document, fields, canonical) {
  if (!fields) return document;
  const projected = {};
  for (const name of canonical) {
    if (fields.includes(name) && document[name] !== undefined) projected[name] = document[name];
  }
  return projected;
}

function projectFollowLine(line, fields) {
  if (!fields) return line;
  const projected = {};
  for (const name of FOLLOW_FIELDS) {
    if (fields.includes(name) && line[name] !== undefined) projected[name] = line[name];
  }
  return projected;
}

function jsonText(value, pretty) {
  return `${pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)}\n`;
}

function sanitizeHumanText(value) {
  let text = String(value ?? "");
  text = text.replace(/\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g, "");
  text = text.replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "");
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 9) out += "\\t";
    else if (code === 10) out += "\\n";
    else if (code === 13) out += "\\r";
    else if (code < 32 || (code >= 127 && code <= 159)) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else out += text[index];
  }
  return out;
}

function warning(reason, message, data) {
  const out = { reason, message };
  if (data !== undefined) out.data = data;
  return out;
}

function writeHumanWarning(ctx, item) {
  ctx.io.stderr(`warning: ${sanitizeHumanText(item.reason)}: ${sanitizeHumanText(item.message)}\n`);
}

function writeWarnings(ctx, warnings) {
  for (const item of warnings ?? []) writeHumanWarning(ctx, item);
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function watchSummary(watch) {
  return {
    id: watch.id,
    key: watch.key,
    host: watch.host,
    repo: watch.repo,
    pr: watch.pr,
    state: watch.state,
    createdAt: watch.createdAt,
    updatedAt: watch.updatedAt,
    endedAt: watch.endedAt,
    endReason: watch.endReason,
    url: watch.url,
  };
}

function defaultQuota() {
  return {
    pausedUntil: null,
    pauseReason: null,
    rateLimits: {},
    consecutiveRateLimitFailures: 0,
    rateLimitGeneration: 0,
  };
}

function watchDetail(state, watch) {
  return {
    ...watchSummary(watch),
    dedupe: clone(watch.dedupe),
    read: clone(state.groups?.[watch.key]?.read ?? null),
    quota: clone(state.hosts?.[watch.host] ?? defaultQuota()),
  };
}

function compareWatches(left, right) {
  const leftMs = Date.parse(left.updatedAt ?? "");
  const rightMs = Date.parse(right.updatedAt ?? "");
  if (leftMs !== rightMs) return rightMs - leftMs;
  return String(right.id ?? "").localeCompare(String(left.id ?? ""));
}

function compareEventsDescending(left, right) {
  return right.seq - left.seq;
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function decodeCursor(raw, kind) {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(String(raw), "base64url").toString("utf8"));
  } catch {
    throw usageError("--next is not a valid pagination cursor.");
  }
  if (!payload || payload.v !== 1 || payload.kind !== kind || typeof payload !== "object" || !exactKeys(payload, ["v", "kind", "filters", "last"])) {
    throw usageError("--next is not a valid pagination cursor.");
  }
  if (!payload.filters || typeof payload.filters !== "object" || !payload.last || typeof payload.last !== "object") {
    throw usageError("--next is not a valid pagination cursor.");
  }
  const filterKeys = kind === "watches" ? ["state"] : ["since", "watchId"];
  const lastKeys = kind === "watches" ? ["updatedAt", "id"] : ["seq"];
  if (!exactKeys(payload.filters, filterKeys) || !exactKeys(payload.last, lastKeys)) {
    throw usageError("--next is not a valid pagination cursor.");
  }
  return payload;
}

function parseLimit(raw, cap, warnings) {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (!/^\d+$/.test(String(raw))) throw usageError("--limit must be a positive integer.");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw usageError("--limit must be a positive integer.");
  if (value > cap) {
    warnings.push(warning("limit_clamped", `The requested limit was clamped to ${cap}.`, {
      requested: value,
      limit: cap,
    }));
    return cap;
  }
  return value;
}

function paginate(rows, limit, all, makeCursor) {
  const selected = all ? rows : rows.slice(0, limit);
  const complete = selected.length >= rows.length;
  const next = complete || selected.length === 0 ? null : makeCursor(selected[selected.length - 1]);
  return { rows: selected, pagination: { next } };
}

function validateListInputs(parsed, cap) {
  const warnings = [];
  const all = parsed.options.get("all") === true;
  if (all && parsed.provided.has("limit")) {
    throw usageError("--all conflicts with an explicit --limit.");
  }
  const limit = parseLimit(parsed.options.get("limit"), cap, warnings);
  return { warnings, all, limit };
}

function statePathFor(env) {
  const home = env.HOME || os.homedir();
  return path.join(home, ".gh-watch", "state.json");
}

async function loadStore(deps) {
  if (deps.store) return deps.store;
  if (deps._watchStore) return deps._watchStore;
  let module;
  try {
    module = await import("./pr-watch-store.mjs");
  } catch (error) {
    throw cliError("internal_error", "The watch state store is unavailable.", {
      data: { module: "pr-watch-store.mjs" },
    });
  }
  if (typeof module.createWatchStore !== "function") {
    throw cliError("internal_error", "The watch state store has an unexpected interface.");
  }
  const store = module.createWatchStore({ statePath: statePathFor(environment(deps)) });
  deps._watchStore = store;
  return store;
}

async function readState(deps) {
  const store = await loadStore(deps);
  if (typeof store.readState !== "function") {
    throw cliError("internal_error", "The watch state store has an unexpected interface.");
  }
  return store.readState();
}

async function mutateState(deps, command, fn, isCanceled = null) {
  const store = await loadStore(deps);
  if (typeof store.readState !== "function" || typeof store.writeState !== "function") {
    throw cliError("internal_error", "The watch state store has an unexpected interface.");
  }
  const checkCanceled = () => {
    if (typeof isCanceled === "function" && isCanceled()) throw cliError("canceled", "Canceled.");
  };
  const writeCancelAware = async (state) => {
    checkCanceled();
    try {
      await store.writeState(state);
    } catch (error) {
      checkCanceled();
      throw error;
    }
  };
  const mutate = async () => {
    checkCanceled();
    const state = await store.readState();
    const outcome = await fn(state);
    if (outcome?.write === true) await writeCancelAware(state);
    return outcome?.result;
  };
  checkCanceled();
  if (typeof store.withStateLock === "function") {
    return store.withStateLock(mutate, { command, isCanceled });
  }
  return mutate();
}

function resolveWatch(state, selector, options = {}) {
  const parsed = typeof selector === "string" ? parseWatchSelector(selector) : selector;
  const watches = Object.values(state.watches ?? {});
  let matches = [];
  if (parsed.kind === "id") {
    const watch = watches.find((item) => item.id === parsed.id);
    if (watch) matches = [watch];
  } else {
    const repo = parsed.repo.toLowerCase();
    matches = watches.filter((item) =>
      String(item.repo).toLowerCase() === repo && item.pr === parsed.pr
    );
  }
  if (matches.length > 1) {
    throw cliError("ambiguous_watch", "The watch selector matches more than one stored watch.", {
      data: { watches: matches.map((watch) => watch.id).sort() },
    });
  }
  const watch = matches[0];
  if (!watch || (options.activeOnly === true && watch.state !== "active")) {
    throw cliError("not_found", "No matching watch was found.", {
      data: { watch: parsed.kind === "id" ? parsed.id : `${parsed.repo}#${parsed.pr}` },
    });
  }
  return watch;
}

function prepareWatchesListInputs(parsed) {
  const { warnings, all, limit } = validateListInputs(parsed, WATCH_CAP);
  let stateFilter = parsed.options.get("state") ?? "active";
  if (!["active", "ended", "all"].includes(stateFilter)) {
    throw usageError("--state must be exactly active, ended, or all.");
  }
  let cursor = null;
  if (parsed.options.get("next") !== undefined) {
    cursor = decodeCursor(parsed.options.get("next"), "watches");
    if (!["active", "ended", "all"].includes(cursor.filters.state)) {
      throw usageError("--next is not a valid pagination cursor.");
    }
    if (
      typeof cursor.last.updatedAt !== "string" ||
      strictIsoUtcMs(cursor.last.updatedAt) === null ||
      typeof cursor.last.id !== "string" ||
      !WATCH_ID_RE.test(cursor.last.id)
    ) {
      throw usageError("--next is not a valid pagination cursor.");
    }
    if (parsed.provided.has("state") && stateFilter !== cursor.filters.state) {
      throw usageError("--state conflicts with the pagination cursor.");
    }
    stateFilter = cursor.filters.state;
  }
  return { warnings, all, limit, stateFilter, cursor };
}

function resolveWatchesList(state, prepared) {
  const { warnings, all, limit, stateFilter, cursor } = prepared;
  let rows = Object.values(state.watches ?? {});
  if (stateFilter !== "all") rows = rows.filter((watch) => watch.state === stateFilter);
  rows.sort(compareWatches);
  if (cursor) {
    rows = rows.filter((watch) => compareWatches(watch, {
      updatedAt: cursor.last.updatedAt,
      id: cursor.last.id,
    }) > 0);
  }
  const page = paginate(rows, limit, all, (last) => encodeCursor({
    v: 1,
    kind: "watches",
    filters: { state: stateFilter },
    last: { updatedAt: last.updatedAt, id: last.id },
  }));
  return { page, warnings, stateFilter, limit, all };
}

async function readStateForPagedCommand(ctx, all, startCursor) {
  try {
    return await readState(ctx.deps);
  } catch (error) {
    if (!all) throw error;
    const normalized = normalizeError(error);
    normalized.data = {
      ...(normalized.data && typeof normalized.data === "object" ? normalized.data : {}),
      rowsFetched: 0,
      next: startCursor,
    };
    throw normalized;
  }
}

function tableRows(rows) {
  return `${rows.join("\n")}\n`;
}

function writeWatchTable(ctx, watches) {
  const lines = ["WATCH\tREPO\tPR\tSTATE\tUPDATED"];
  for (const watch of watches) {
    lines.push([
      sanitizeHumanText(watch.id),
      sanitizeHumanText(watch.repo),
      String(watch.pr),
      sanitizeHumanText(watch.state),
      sanitizeHumanText(watch.updatedAt ?? ""),
    ].join("\t"));
  }
  ctx.io.stdout(tableRows(lines));
}

function writeEventTable(ctx, events) {
  const lines = ["SEQ\tTYPE\tREPO\tPR\tCREATED\tSUMMARY"];
  for (const event of events) {
    lines.push([
      String(event.seq),
      sanitizeHumanText(event.type),
      sanitizeHumanText(event.repo),
      String(event.pr),
      sanitizeHumanText(event.createdAt ?? ""),
      sanitizeHumanText(eventSummary(event)),
    ].join("\t"));
  }
  ctx.io.stdout(tableRows(lines));
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function eventSummary(event) {
  const data = event.data ?? {};
  switch (event.type) {
    case "checks-failed": {
      const checks = Array.isArray(data.checks) ? data.checks : [];
      return `${plural(checks.length, "check")} failed`;
    }
    case "checks-passed":
      return `${plural(data.count ?? 0, "check")} passed (${data.required === true ? "required" : "advisory"})`;
    case "checks-finished":
      return `${plural(data.passed ?? 0, "check")} passed, ${plural((data.failing ?? []).length, "check")} failing`;
    case "checks-awaiting-approval":
      return `${plural((data.checks ?? []).length, "check")} awaiting approval`;
    case "remarks":
      return plural(data.count ?? 0, "new remark");
    case "no-checks":
      return `no checks after ${data.minutes ?? 0} minutes`;
    case "conflicting":
      return "pull request is conflicting";
    case "needs-rebase":
      return "pull request needs a rebase";
    case "merge-queue-removed":
      return data.reason ? `removed from merge queue: ${data.reason}` : "removed from merge queue";
    case "merged":
      return `merged into ${data.baseBranch ?? "base branch"}`;
    case "closed":
      return "pull request closed";
    case "watch-ended":
      return `watch ended: ${data.reason ?? "unknown"}`;
    default:
      return event.type ?? "event";
  }
}

function flattenValue(value) {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  return JSON.stringify(value);
}

function writeInspectHuman(ctx, detail) {
  const rows = [];
  const put = (name, value) => rows.push(`${sanitizeHumanText(name)}\t${sanitizeHumanText(flattenValue(value))}`);
  for (const name of ["id", "key", "host", "repo", "pr", "state", "createdAt", "updatedAt", "endedAt", "endReason", "url"]) {
    put(name, detail[name]);
  }
  for (const [name, value] of Object.entries(detail.dedupe ?? {})) put(`dedupe.${name}`, value);
  for (const [name, value] of Object.entries(detail.read ?? {})) put(`read.${name}`, value);
  const quota = detail.quota ?? {};
  for (const name of ["pausedUntil", "pauseReason", "rateLimits", "consecutiveRateLimitFailures", "rateLimitGeneration"]) {
    put(`quota.${name}`, quota[name]);
  }
  ctx.io.stdout(tableRows(rows));
}

function nextPageCommand(ctx, command, cursor) {
  return nextCommand(ctx.runnerPath, [...command.split(" "), "--next", cursor], "Print the next page");
}

function writePaginationHint(ctx, command, pagination) {
  if (pagination?.next) {
    ctx.io.stderr(`next: ${nextPageCommand(ctx, command, pagination.next).command}\n`);
  }
}

async function executeWatchesList(ctx, parsed, fields) {
  const prepared = prepareWatchesListInputs(parsed);
  const state = await readStateForPagedCommand(ctx, prepared.all, parsed.options.get("next") ?? null);
  const { page, warnings } = resolveWatchesList(state, prepared);
  const summaries = page.rows.map(watchSummary);
  if (ctx.json) {
    let document = { watches: summaries, pagination: page.pagination };
    if (warnings.length > 0) document.warnings = warnings;
    document = projectDocument(document, fields, CANONICAL_FIELDS["watches list"]);
    ctx.io.stdout(jsonText(document, ctx.stdoutTTY));
  } else {
    writeWatchTable(ctx, summaries);
    writeWarnings(ctx, warnings);
    writePaginationHint(ctx, "watches list", page.pagination);
  }
  return 0;
}

async function executeEventsList(ctx, parsed, fields) {
  const pre = validateListInputs(parsed, EVENT_CAP);
  let since = null;
  if (parsed.options.get("since") !== undefined) since = parseSince(parsed.options.get("since"), ctx.deps);
  const selector = parsed.options.get("watch");
  const selectorShape = selector === undefined ? null : parseWatchSelector(selector);

  let cursor = null;
  if (parsed.options.get("next") !== undefined) {
    cursor = decodeCursor(parsed.options.get("next"), "events");
    if (typeof cursor.last.seq !== "number" || !Number.isSafeInteger(cursor.last.seq) || cursor.last.seq < 1) {
      throw usageError("--next is not a valid pagination cursor.");
    }
    if (
      cursor.filters.since !== null &&
      (typeof cursor.filters.since !== "string" || strictIsoUtcMs(cursor.filters.since) === null)
    ) {
      throw usageError("--next is not a valid pagination cursor.");
    }
    if (
      cursor.filters.watchId !== null &&
      (typeof cursor.filters.watchId !== "string" || !WATCH_ID_RE.test(cursor.filters.watchId))
    ) {
      throw usageError("--next is not a valid pagination cursor.");
    }
  }

  const state = await readStateForPagedCommand(ctx, pre.all, parsed.options.get("next") ?? null);
  let watchId = null;
  if (selectorShape) watchId = resolveWatch(state, selectorShape).id;

  if (cursor) {
    if (parsed.provided.has("watch") && watchId !== cursor.filters.watchId) {
      throw usageError("--watch conflicts with the pagination cursor.");
    }
    if (!parsed.provided.has("watch")) watchId = cursor.filters.watchId;

    if (parsed.provided.has("since")) {
      const explicit = since?.iso ?? null;
      if (explicit !== cursor.filters.since) throw usageError("--since conflicts with the pagination cursor.");
    } else {
      since = cursor.filters.since === null
        ? null
        : { iso: cursor.filters.since, ms: Date.parse(cursor.filters.since) };
    }
  }

  let rows = [...(state.events ?? [])];
  if (watchId !== null) rows = rows.filter((event) => event.watchId === watchId);
  if (since) rows = rows.filter((event) => Date.parse(event.createdAt) >= since.ms);
  rows.sort(compareEventsDescending);
  if (cursor) rows = rows.filter((event) => event.seq < cursor.last.seq);

  const page = paginate(rows, pre.limit, pre.all, (last) => encodeCursor({
    v: 1,
    kind: "events",
    filters: { since: since?.iso ?? null, watchId },
    last: { seq: last.seq },
  }));

  if (ctx.json) {
    let document = { events: page.rows, pagination: page.pagination };
    if (pre.warnings.length > 0) document.warnings = pre.warnings;
    document = projectDocument(document, fields, CANONICAL_FIELDS["events list"]);
    ctx.io.stdout(jsonText(document, ctx.stdoutTTY));
  } else {
    writeEventTable(ctx, page.rows);
    writeWarnings(ctx, pre.warnings);
    writePaginationHint(ctx, "events list", page.pagination);
  }
  return 0;
}

async function executeInspect(ctx, parsed, fields) {
  const selector = parseWatchSelector(parsed.positionals[0]);
  const state = await readState(ctx.deps);
  const watch = resolveWatch(state, selector);
  const detail = watchDetail(state, watch);
  const warnings = [];
  if (String(watch.host).toLowerCase() !== "github.com") {
    warnings.push(warning(
      "enterprise_degraded",
      "Enterprise GitHub reads omit required-check and merge-queue metadata when the host cannot support them.",
    ));
  }
  if (ctx.json) {
    let document = { watch: detail };
    if (warnings.length > 0) document.warnings = warnings;
    document = projectDocument(document, fields, CANONICAL_FIELDS["watches inspect"]);
    ctx.io.stdout(jsonText(document, ctx.stdoutTTY));
  } else {
    writeInspectHuman(ctx, detail);
    writeWarnings(ctx, warnings);
  }
  return 0;
}

async function executeRemove(ctx, parsed, fields) {
  const selector = parseWatchSelector(parsed.positionals[0]);
  const mutation = await mutateState(ctx.deps, "watches remove", async (state) => {
    const watch = resolveWatch(state, selector);
    if (watch.state !== "active") {
      return { write: false, result: { watch, outcome: "unchanged" } };
    }
    const endedAt = isoNow(ctx.deps);
    watch.state = "ended";
    watch.endedAt = endedAt;
    watch.endReason = "removed";
    watch.updatedAt = endedAt;
    state.endedWatches = state.endedWatches ?? {};
    state.endedWatches[watch.key] = {
      endedAt,
      endReason: "removed",
      lastWatchId: watch.id,
      dedupe: clone(watch.dedupe),
    };
    state.updatedAt = endedAt;
    return { write: true, result: { watch, outcome: "removed" } };
  }, () => Boolean(ctx.signalState.signal));

  const summary = watchSummary(mutation.watch);
  const next = [nextCommand(ctx.runnerPath, ["watches", "list", "--json"], "List remaining watches")];
  if (ctx.json) {
    const document = projectDocument({
      watch: summary,
      outcome: mutation.outcome,
      next,
    }, fields, CANONICAL_FIELDS["watches remove"]);
    ctx.io.stdout(jsonText(document, ctx.stdoutTTY));
  } else {
    ctx.io.stdout(`${sanitizeHumanText(summary.id)}\n`);
    ctx.io.stderr(`${mutation.outcome === "removed" ? "removed" : "unchanged"} watch ${sanitizeHumanText(summary.id)}\n`);
  }
  return 0;
}

function validateAddInputs(parsed) {
  const prText = parsed.positionals[0];
  const pr = prText === undefined ? null : parsePr(prText);
  const repo = parsed.options.get("repo") === undefined ? null : parseRepo(parsed.options.get("repo"));
  if (repo !== null && pr === null) {
    throw usageError("--repo requires an explicit PR.");
  }
  return { pr, repo };
}

async function getOperations(ctx) {
  if (ctx.deps.operations !== undefined) return ctx.deps.operations ?? null;
  if (ctx.deps._watchOperations !== undefined) return ctx.deps._watchOperations;
  // runCli fixtures must never accidentally reach the network when they omit
  // operations. Only the real script entry asks for module-backed wiring.
  if (ctx.deps.useDefaultOperations !== true) return null;
  const operations = await createDefaultOperations(ctx.deps, ctx);
  ctx.deps._watchOperations = operations;
  return operations;
}

function operationsMissingError() {
  return cliError("internal_error", "Watch network operations are not wired in this environment.");
}

function validateOperationWarnings(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item.reason === "string" && typeof item.message === "string")
    : [];
}

function validStoredWatchShape(watch) {
  return watch && typeof watch === "object" &&
    typeof watch.id === "string" &&
    typeof watch.key === "string" &&
    typeof watch.host === "string" &&
    typeof watch.repo === "string" &&
    Number.isSafeInteger(watch.pr) && watch.pr > 0 &&
    ["active", "ended"].includes(watch.state) &&
    typeof watch.createdAt === "string" &&
    typeof watch.updatedAt === "string" &&
    (watch.endedAt === null || typeof watch.endedAt === "string") &&
    (watch.endReason === null || typeof watch.endReason === "string") &&
    typeof watch.url === "string";
}

function validateAddOutcome(result) {
  if (
    !result || typeof result !== "object" ||
    !validStoredWatchShape(result.watch) ||
    !["added", "unchanged"].includes(result.outcome) ||
    (result.events !== undefined && !Array.isArray(result.events)) ||
    (result.outcome === "unchanged" && Array.isArray(result.events) && result.events.length > 0)
  ) {
    throw cliError("internal_error", "The add operation returned an unexpected outcome.");
  }
  return {
    watch: watchSummary(result.watch),
    outcome: result.outcome,
    events: Array.isArray(result.events) ? result.events : [],
    warnings: validateOperationWarnings(result.warnings),
  };
}

async function executeAdd(ctx, parsed, fields) {
  const { pr, repo } = validateAddInputs(parsed);
  const env = environment(ctx.deps);
  const host = effectiveHost(env);
  const operations = await getOperations(ctx);
  if (!operations || typeof operations.add !== "function") throw operationsMissingError();
  throwIfCanceled(ctx);
  const result = validateAddOutcome(await operations.add({
    pr,
    repo,
    host,
    cwd: effectiveCwd(ctx),
    env,
    now: ctx.deps.now,
    randomId: ctx.deps.randomId,
    runnerPath: ctx.runnerPath,
    isCanceled: () => Boolean(ctx.signalState.signal),
  }));
  const id = result.watch.id;
  const next = [
    nextCommand(ctx.runnerPath, ["watches", "inspect", id, "--json"], "Inspect the watch state"),
    nextCommand(ctx.runnerPath, ["watches", "run", "--watch", id, "--json"], "Run one bounded sweep for this watch"),
  ];
  if (ctx.json) {
    let document = {
      watch: result.watch,
      outcome: result.outcome,
      events: result.events,
      next,
    };
    if (result.warnings.length > 0) document.warnings = result.warnings;
    document = projectDocument(document, fields, CANONICAL_FIELDS["watches add"]);
    ctx.io.stdout(jsonText(document, ctx.stdoutTTY));
  } else {
    ctx.io.stdout(`${sanitizeHumanText(id)}\n`);
    ctx.io.stderr(`${result.outcome === "added" ? "added" : "unchanged"} watch ${sanitizeHumanText(id)}\n`);
    writeWarnings(ctx, result.warnings);
  }
  return 0;
}

function sweepError(error) {
  if (!error || typeof error !== "object") return error;
  const out = {
    reason: typeof error.reason === "string" ? error.reason : "internal_error",
    message: typeof error.message === "string" ? error.message : "The group read failed.",
    retryable: error.retryable === true,
  };
  if (typeof error.retryAfter === "number" && error.retryAfter >= 0) out.retryAfter = error.retryAfter;
  return out;
}

function groupWarnings(results) {
  const warnings = [];
  for (const result of Array.isArray(results) ? results : []) {
    if (result?.outcome === "failed") {
      warnings.push(warning("sweep_group_failed", `Sweep group ${result.id} failed.`, {
        id: result.id,
        error: sweepError(result.error),
      }));
    } else if (result?.outcome === "paused") {
      warnings.push(warning("sweep_group_paused", `Sweep group ${result.id} is paused.`, {
        id: result.id,
        error: sweepError(result.error),
      }));
    }
  }
  return warnings;
}

function projectSweepSummary(summary) {
  const projected = {
    succeeded: summary.succeeded,
    failed: summary.failed,
    skipped: summary.skipped,
    unknown: summary.unknown,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    durationMs: summary.durationMs,
    watchCount: summary.watchCount,
    groupCount: summary.groupCount,
    readGroupCount: summary.readGroupCount,
  };
  const integerKeys = ["succeeded", "failed", "skipped", "unknown", "watchCount", "groupCount", "readGroupCount"];
  const valid = integerKeys.every((key) => Number.isSafeInteger(projected[key]) && projected[key] >= 0) &&
    typeof projected.startedAt === "string" &&
    typeof projected.finishedAt === "string" &&
    typeof projected.durationMs === "number" && projected.durationMs >= 0;
  if (!valid) throw cliError("internal_error", "The sweep operation returned an invalid summary.");
  return projected;
}

function projectSweepResult(result) {
  if (
    !result || typeof result !== "object" ||
    typeof result.id !== "string" ||
    !["unchanged", "read", "paused", "failed", "ended"].includes(result.outcome) ||
    typeof result.detailRead !== "boolean" ||
    typeof result.activityRead !== "boolean" ||
    !Number.isSafeInteger(result.eventCount) || result.eventCount < 0
  ) {
    throw cliError("internal_error", "The sweep operation returned an invalid group result.");
  }
  const projected = {
    id: result.id,
    outcome: result.outcome,
    detailRead: result.detailRead,
    activityRead: result.activityRead,
    eventCount: result.eventCount,
  };
  if (result.error !== undefined) projected.error = sweepError(result.error);
  return projected;
}

function validateSweepOutcome(result) {
  if (
    !result || typeof result !== "object" ||
    !["completed", "partial", "failed", "paused"].includes(result.outcome) ||
    !result.summary || typeof result.summary !== "object" ||
    !Array.isArray(result.events) || !Array.isArray(result.results)
  ) {
    throw cliError("internal_error", "The sweep operation returned an unexpected outcome.");
  }
  return {
    outcome: result.outcome,
    summary: projectSweepSummary(result.summary),
    events: result.events,
    results: result.results.map(projectSweepResult),
    warnings: validateOperationWarnings(result.warnings),
  };
}

function boundedSweepDocument(result, extraWarnings) {
  const warnings = [...extraWarnings, ...groupWarnings(result.results)];
  const document = {
    outcome: result.outcome,
    summary: result.summary,
    events: result.events,
    results: result.results,
  };
  if (warnings.length > 0) document.warnings = warnings;
  return document;
}

async function executeRun(ctx, parsed, fields) {
  if (parsed.options.get("follow") === true) return executeFollow(ctx, parsed, fields);
  const selectorShape = parsed.options.get("watch") === undefined ? null : parseWatchSelector(parsed.options.get("watch"));
  const operations = await getOperations(ctx);
  if (!operations || typeof operations.sweep !== "function") throw operationsMissingError();
  const input = await prepareSweepInput(ctx, parsed, selectorShape);
  throwIfCanceled(ctx);
  const result = validateSweepOutcome(await operations.sweep(input));
  const extraWarnings = validateOperationWarnings(result.warnings);
  if (ctx.json) {
    const document = projectDocument(
      boundedSweepDocument(result, extraWarnings),
      fields,
      CANONICAL_FIELDS["watches run"],
    );
    ctx.io.stdout(jsonText(document, ctx.stdoutTTY));
  } else {
    for (const event of result.events) {
      ctx.io.stdout(`${sanitizeHumanText(compactEventLine(event))}\n`);
    }
    writeWarnings(ctx, [...extraWarnings, ...groupWarnings(result.results)]);
    if (result.outcome !== "completed") {
      ctx.io.stderr(`sweep ${sanitizeHumanText(result.outcome)}\n`);
    }
  }
  return result.outcome === "completed" ? 0 : 1;
}

function compactEventLine(event) {
  const at = event.createdAt ?? "";
  const repo = event.repo ?? "";
  const pr = event.pr ?? "";
  return `${at} ${event.type} ${repo}#${pr}: ${eventSummary(event)}`;
}

async function prepareSweepInput(ctx, parsed, selectorShape = null) {
  let watchId = null;
  if (selectorShape !== null) {
    const state = await readState(ctx.deps);
    watchId = resolveWatch(state, selectorShape, { activeOnly: true }).id;
  }
  return {
    watchId,
    cwd: effectiveCwd(ctx),
    env: environment(ctx.deps),
    now: ctx.deps.now,
    isCanceled: () => Boolean(ctx.signalState.signal),
  };
}

function timeoutMsFrom(parsed) {
  if (parsed.options.get("timeout") === undefined) return null;
  return parseDuration(parsed.options.get("timeout"), "--timeout");
}

async function activeSelection(ctx, watchId) {
  const state = await readState(ctx.deps);
  const active = Object.values(state.watches ?? {}).filter((watch) => watch.state === "active");
  const selected = watchId === null ? active : active.filter((watch) => watch.id === watchId);
  return { state, active, selected };
}

async function executeFollow(ctx, parsed, fields) {
  const invocationMs = nowMs(ctx.deps);
  const timeoutMs = timeoutMsFrom(parsed);
  const selectorShape = parsed.options.get("watch") === undefined ? null : parseWatchSelector(parsed.options.get("watch"));
  let watchId = null;
  const stateBefore = await readState(ctx.deps);
  if (selectorShape !== null) {
    watchId = resolveWatch(stateBefore, selectorShape, { activeOnly: true }).id;
  }
  const initial = await activeSelection(ctx, watchId);
  const snapshotWatches = initial.selected.map(watchSummary);

  if (ctx.json) {
    const line = projectFollowLine({
      type: "snapshot",
      watches: snapshotWatches,
      intervalSeconds: FOLLOW_INTERVAL_MS / 1000,
    }, fields);
    ctx.io.stdout(jsonText(line, false));
  }
  if (initial.selected.length === 0) return 0;

  const operations = await getOperations(ctx);
  if (!operations || typeof operations.sweep !== "function") throw operationsMissingError();

  const deadlineMs = timeoutMs === null ? null : invocationMs + timeoutMs;
  const input = {
    watchId,
    cwd: effectiveCwd(ctx),
    env: environment(ctx.deps),
    now: ctx.deps.now,
    isCanceled: () => Boolean(ctx.signalState.signal),
  };
  const tailCache = new Map();
  input.tailCache = tailCache;

  for (;;) {
    if (ctx.signalState.signal) return exitForSignal(ctx.signalState.signal);
    if (deadlineMs !== null && nowMs(ctx.deps) >= deadlineMs) return 0;
    const selection = await activeSelection(ctx, watchId);
    if (selection.selected.length === 0) return 0;

    const sweepStarted = nowMs(ctx.deps);
    let result;
    try {
      result = validateSweepOutcome(await operations.sweep(input));
    } catch (error) {
      if (ctx.signalState.signal) return exitForSignal(ctx.signalState.signal);
      throw error;
    }

    const warnings = [...validateOperationWarnings(result.warnings), ...groupWarnings(result.results)];
    if (ctx.json) {
      for (const item of warnings) {
        const line = { type: "warning", reason: item.reason, message: item.message };
        if (item.data !== undefined) line.data = item.data;
        ctx.io.stdout(jsonText(projectFollowLine(line, fields), false));
      }
      for (const event of result.events) {
        ctx.io.stdout(jsonText(projectFollowLine({ type: "event", event }, fields), false));
      }
    } else {
      for (const event of result.events) ctx.io.stdout(`${sanitizeHumanText(compactEventLine(event))}\n`);
      writeWarnings(ctx, warnings);
    }

    if (ctx.signalState.signal) return exitForSignal(ctx.signalState.signal);
    const after = await activeSelection(ctx, watchId);
    if (after.selected.length === 0) return 0;
    if (deadlineMs !== null && nowMs(ctx.deps) >= deadlineMs) return 0;

    const nextStart = sweepStarted + FOLLOW_INTERVAL_MS;
    const waitMs = Math.max(0, nextStart - nowMs(ctx.deps));
    const woke = await waitForNextTick(ctx, waitMs, deadlineMs);
    if (woke === "timeout") return 0;
    if (woke === "signal") return exitForSignal(ctx.signalState.signal);
  }
}

async function waitForNextTick(ctx, waitMs, deadlineMs) {
  const started = nowMs(ctx.deps);
  const target = started + waitMs;
  const sleeper = ctx.deps.sleep ?? defaultSleep;
  for (;;) {
    if (ctx.signalState.signal) return "signal";
    const current = nowMs(ctx.deps);
    if (deadlineMs !== null && current >= deadlineMs) return "timeout";
    if (current >= target) return "tick";
    let chunk = Math.min(1_000, target - current);
    if (deadlineMs !== null) chunk = Math.min(chunk, Math.max(0, deadlineMs - current));
    if (chunk <= 0) return deadlineMs !== null && current >= deadlineMs ? "timeout" : "tick";
    await sleeper(chunk, ctx.signalState);
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function exitForSignal(signal) {
  if (signal === "SIGTERM") return 143;
  return 130;
}

function throwIfCanceled(ctx) {
  if (!ctx.signalState.signal) return;
  throw cliError("canceled", "Canceled.");
}

function compactMetadataOption(item) {
  return {
    name: item.name,
    short: item.short,
    type: item.type,
    valueHint: item.valueHint,
    default: item.default,
    acceptedValues: item.acceptedValues,
    repeatable: item.repeatable,
    deprecated: item.deprecated,
  };
}

function helpDocument(meta) {
  return {
    path: meta.path,
    summary: meta.summary,
    subcommands: (meta.subcommands ?? []).map((item) => ({ path: item.path, summary: item.summary })),
    arguments: (meta.arguments ?? []).map((item) => ({
      name: item.name,
      valueHint: item.valueHint,
      required: item.required,
    })),
    options: (meta.options ?? []).map(compactMetadataOption),
    lifecycle: meta.lifecycle ?? null,
    resultSchema: (meta.resultSchema ?? []).map((item) => ({ ...item })),
  };
}

function commandList() {
  return COMMAND_ORDER.map((command) => ({
    path: command,
    summary: COMMAND_METADATA[command].summary,
  }));
}

function writeHumanHelp(ctx, meta) {
  const lines = [];
  lines.push(meta.path ? `${meta.path}: ${meta.summary}` : meta.summary);
  lines.push("");
  const usagePath = meta.path
    ? `${meta.path}${(meta.subcommands ?? []).length > 0 ? " <action>" : ""}`
    : "<group> <action>";
  lines.push(`Usage: ${shellQuote(ctx.runnerPath)} pr-watch.mjs ${usagePath}${meta.path === "watches add" ? " [PR]" : ""} [options]`);
  if ((meta.subcommands ?? []).length > 0) {
    lines.push("", "Commands:");
    for (const item of meta.subcommands) lines.push(`  ${item.path}\t${item.summary}`);
  }
  if ((meta.arguments ?? []).length > 0) {
    lines.push("", "Arguments:");
    for (const item of meta.arguments) {
      lines.push(`  ${item.valueHint ?? item.name}\t${item.required ? "required" : "optional"}`);
    }
  }
  if ((meta.options ?? []).length > 0) {
    lines.push("", "Options:");
    for (const item of meta.options) {
      const short = item.short ? `${item.short}, ` : "";
      const value = item.valueHint ? ` <${item.valueHint}>` : "";
      lines.push(`  ${short}${item.name}${value}\t${item.description ?? ""}`);
    }
  }
  ctx.io.stdout(`${lines.join("\n")}\n`);
}

async function executeHelp(ctx, parsed, fields) {
  const json = ctx.json;
  const helpAll = parsed.options.get("all") === true;
  if (json) {
    let document;
    let canonical;
    if (helpAll) {
      document = { commands: commandList() };
      canonical = CANONICAL_FIELDS.help;
    } else {
      document = helpDocument({ ...ROOT_METADATA, arguments: [], options: GLOBAL_OPTIONS, lifecycle: null, resultSchema: [] });
      canonical = CANONICAL_FIELDS.help;
    }
    document = projectDocument(document, fields, canonical);
    ctx.io.stdout(jsonText(document, ctx.stdoutTTY));
  } else if (helpAll) {
    const lines = commandList().map((item) => `${item.path}\t${item.summary}`);
    ctx.io.stdout(tableRows(lines));
  } else {
    writeHumanHelp(ctx, { ...ROOT_METADATA, arguments: [], options: GLOBAL_OPTIONS });
  }
  return 0;
}

function searchCommands(query) {
  const needle = query.toLowerCase();
  const terms = needle.split(/\s+/).filter(Boolean);
  const matches = [];
  for (const pathName of COMMAND_ORDER) {
    const meta = COMMAND_METADATA[pathName];
    const haystack = [
      pathName,
      meta.summary,
      ...(meta.nouns ?? []),
      ...(meta.examples ?? []),
    ].join("\n").toLowerCase();
    const direct = haystack.includes(needle);
    const allTerms = terms.length > 0 && terms.every((term) => haystack.includes(term));
    if (direct || allTerms) matches.push({ path: pathName, summary: meta.summary });
    if (matches.length >= 10) break;
  }
  return matches;
}

async function executeHelpSearch(ctx, parsed, fields) {
  const query = parsed.positionals[0];
  if (typeof query !== "string" || query.trim() === "") throw usageError("help search requires a non-empty query.");
  const matches = searchCommands(query);
  if (ctx.json) {
    const document = projectDocument({ commands: matches }, fields, CANONICAL_FIELDS["help search"]);
    ctx.io.stdout(jsonText(document, ctx.stdoutTTY));
  } else if (matches.length === 0) {
    ctx.io.stdout(`No commands match "${sanitizeHumanText(query)}".\n`);
  } else {
    ctx.io.stdout(tableRows(matches.map((item) => `${item.path}\t${item.summary}`)));
  }
  return 0;
}

function executeHelpMode(ctx, command, parsed, fields) {
  let meta;
  if (command.kind === "root") meta = { ...ROOT_METADATA, arguments: [], options: GLOBAL_OPTIONS, lifecycle: null, resultSchema: [] };
  else if (command.kind === "group") meta = { ...GROUP_METADATA[command.key], arguments: [], options: GLOBAL_OPTIONS, lifecycle: null, resultSchema: [] };
  else meta = COMMAND_METADATA[command.key];
  if (ctx.json) {
    const document = projectDocument(helpDocument(meta), fields, HELP_DOCUMENT_FIELDS);
    ctx.io.stdout(jsonText(document, ctx.stdoutTTY));
  } else {
    writeHumanHelp(ctx, meta);
  }
  return 0;
}

function effectiveCwd(ctx) {
  return parsedCwd(ctx.parsed) ?? workingDirectory(ctx.deps);
}

function parsedCwd(parsed) {
  const value = parsed.options.get("cwd");
  return value === undefined ? null : value;
}

function detectCi(env) {
  const value = env.CI;
  return value !== undefined && value !== "" && value !== "false" && value !== "0";
}

function detectAgentHarness(env) {
  return Boolean(
    env.CAPY || env.CAPY_THREAD_ID || env.CAPY_MACHINE_ID || env.CLAUDE_CODE ||
    env.CODEX_CI || env.CURSOR_AGENT || env.AGENT_HARNESS
  );
}

function interactionMode(ctx) {
  const env = environment(ctx.deps);
  const explicit = ctx.parsed.options.get("non-interactive");
  const stdinTTY = ttyValue(ctx.deps, "stdin");
  const stderrTTY = ttyValue(ctx.deps, "stderr");
  let nonInteractive = ctx.json || explicit === true || detectCi(env) || detectAgentHarness(env) || !stdinTTY || !stderrTTY;
  if (explicit === false && !ctx.json && !detectCi(env) && stdinTTY && stderrTTY) nonInteractive = false;
  return nonInteractive;
}

function validateRunInputs(ctx, parsed) {
  const hasTimeout = parsed.options.get("timeout") !== undefined;
  const follow = parsed.options.get("follow") === true;
  if (hasTimeout && !follow) throw usageError("--timeout requires --follow.");
  if (follow && interactionMode(ctx) && !hasTimeout) {
    throw cliError("missing_timeout", "Non-interactive follow mode requires --timeout.", {
      next: missingTimeoutNext(ctx),
    });
  }
  if (hasTimeout) parseDuration(parsed.options.get("timeout"), "--timeout");
}

function createSignalState(enabled) {
  const state = { signal: null, listeners: [] };
  if (!enabled || typeof process?.once !== "function") return state;
  const add = (signal) => {
    const listener = () => {
      if (state.signal === null) state.signal = signal;
    };
    process.once(signal, listener);
    state.listeners.push([signal, listener]);
  };
  add("SIGINT");
  add("SIGTERM");
  return state;
}

function cleanupSignalState(state) {
  if (!state?.listeners || typeof process?.removeListener !== "function") return;
  for (const [signal, listener] of state.listeners) {
    process.removeListener(signal, listener);
  }
  state.listeners = [];
}

function makeContext(argv, deps, parsed) {
  const env = environment(deps);
  const json = parsed?.options.get("json") === true || scanBooleanFlag(argv, "json");
  return {
    argv,
    deps,
    parsed,
    env,
    json,
    stdoutTTY: ttyValue(deps, "stdout"),
    io: makeIo(deps),
    runnerPath: deps.runnerPath ?? defaultRunnerPath(),
    signalState: deps._signalState ?? { signal: null },
  };
}

function parseCommandLine(argv, deps) {
  const initial = parseArgv(argv);
  const preliminaryHelp = initial.options.get("help") === true;
  const command = resolveCommand(initial.positional, preliminaryHelp);
  const positionals = command.args ?? [];
  const parsed = {
    ...initial,
    positionals,
  };
  validateAllowedOptions(command, parsed);
  if (!preliminaryHelp) validatePositionals(command, positionals);
  return { command, parsed };
}

function validateBeforeExecute(ctx, command, parsed) {
  const follow = command.key === "watches run" && parsed.options.get("follow") === true;
  const helpMode = parsed.options.get("help") === true || (command.kind !== "command" && command.key !== "help");
  const fields = parseFields(parsed, command, follow, helpMode);
  if (!helpMode && command.key === "watches run") validateRunInputs(ctx, parsed);
  return fields;
}

async function dispatch(ctx, command, parsed) {
  const fields = validateBeforeExecute(ctx, command, parsed);
  if (parsed.options.get("help") === true || command.kind !== "command") {
    if (command.key === "help" && parsed.options.get("help") !== true) {
      // Bare help is a real command, not help-mode for another path.
    } else {
      return executeHelpMode(ctx, command, parsed, fields);
    }
  }

  switch (command.key) {
    case "watches add": return executeAdd(ctx, parsed, fields);
    case "watches list": return executeWatchesList(ctx, parsed, fields);
    case "watches inspect": return executeInspect(ctx, parsed, fields);
    case "watches remove": return executeRemove(ctx, parsed, fields);
    case "watches run": return executeRun(ctx, parsed, fields);
    case "events list": return executeEventsList(ctx, parsed, fields);
    case "help": return executeHelp(ctx, parsed, fields);
    case "help search": return executeHelpSearch(ctx, parsed, fields);
    default:
      throw unknownCommand(command.key);
  }
}

export async function runCli(argv, deps = {}) {
  const effectiveDeps = deps;
  const signalEnabled = deps.listenSignals === true;
  if (signalEnabled) effectiveDeps._signalState = createSignalState(true);
  let ctx = null;
  try {
    const { command, parsed } = parseCommandLine(argv, effectiveDeps);
    ctx = makeContext(argv, effectiveDeps, parsed);
    ctx.command = command;
    if (parsed.options.get("debug") === true) {
      ctx.io.stderr(`debug: command=${command.key}\n`);
    }
    const follow = command.key === "watches run" && parsed.options.get("follow") === true;
    if (follow && ctx.signalState.signal) return exitForSignal(ctx.signalState.signal);
    throwIfCanceled(ctx);
    return await dispatch(ctx, command, parsed);
  } catch (error) {
    if (error instanceof BrokenPipeError) return 0;
    const json = ctx?.json ?? scanBooleanFlag(argv, "json");
    const fallbackParsed = { options: new Map([["json", json]]) };
    const errorCtx = ctx ?? makeContext(argv, effectiveDeps, fallbackParsed);
    try {
      return writeError(errorCtx, error);
    } catch (writeFailure) {
      if (writeFailure instanceof BrokenPipeError) return 0;
      throw writeFailure;
    }
  } finally {
    if (signalEnabled) cleanupSignalState(effectiveDeps._signalState);
  }
}

function normalizeRandomId(value) {
  if (typeof value !== "string") return undefined;
  if (WATCH_ID_RE.test(value)) return value;
  if (/^[0-9a-z]{5}$/.test(value)) return `w_${value}`;
  return undefined;
}

function resolutionFailure(error, missingReason, message, input) {
  const detail = `${error?.stderr ?? ""}
${error?.message ?? ""}`;
  if (/gh not found/i.test(detail)) {
    throw cliError("missing_tool", "gh not found on PATH; install the GitHub CLI.");
  }
  if (/auth login|authentication|not logged in|token/i.test(detail)) {
    throw cliError("login_required", `gh authentication is required to resolve the current ${missingReason === "missing_repo" ? "checkout" : "branch pull request"}.`);
  }
  throw cliError(missingReason, message, {
    next: missingPrNext({ runnerPath: input.runnerPath ?? defaultRunnerPath() }),
  });
}

async function resolveCheckoutTarget(input, lib) {
  if (input.repo && input.pr !== null) {
    return { host: input.host, repo: input.repo, pr: input.pr };
  }

  let repo = input.repo;
  if (!repo) {
    try {
      const resolved = await lib.resolveRepoOnHost(input.host, undefined, input.cwd);
      repo = resolved.repo;
    } catch (error) {
      resolutionFailure(
        error,
        "missing_repo",
        "Can't resolve exactly one GitHub repository for the current checkout on the effective host.",
        input,
      );
    }
  }

  let pr = input.pr;
  if (pr === null) {
    let number;
    try {
      number = await lib.resolvePr(undefined, undefined, input.cwd);
    } catch (error) {
      resolutionFailure(
        error,
        "missing_pr",
        "Can't add a watch without a pull request number or a current-branch resolution.",
        input,
      );
    }
    if (!Number.isSafeInteger(number) || number <= 0 || number > MAX_PR) {
      throw cliError("missing_pr", "Can't add a watch without a pull request number or a current-branch resolution.", {
        next: missingPrNext({ runnerPath: input.runnerPath ?? defaultRunnerPath() }),
      });
    }
    pr = number;
  }

  return { host: input.host, repo, pr };
}

export async function githubInterface(module, { store, engine, now, lib } = {}) {
  if (!module) return null;
  let candidate = module;
  if (
    typeof candidate.readFingerprints !== "function" ||
    typeof candidate.readDetail !== "function" ||
    typeof candidate.readActivity !== "function"
  ) {
    if (candidate.github && typeof candidate.github === "object") candidate = candidate.github;
    else if (typeof candidate.createGitHub === "function") candidate = candidate.createGitHub();
    else if (typeof candidate.createGitHubClient === "function") candidate = candidate.createGitHubClient();
  }
  if (
    !candidate ||
    typeof candidate.readFingerprints !== "function" ||
    typeof candidate.readDetail !== "function" ||
    typeof candidate.readActivity !== "function"
  ) {
    return null;
  }
  // The GitHub module exports transport-first functions while the engine
  // accepts an already-bound interface. Bind the additive lib transport lazily
  // here so help and local state commands never pay for or require it.
  if (candidate.readDetail.length <= 1) return candidate;
  if (
    !lib ||
    typeof lib.graphqlMetadata !== "function" ||
    typeof lib.restMetadata !== "function" ||
    typeof lib.gitHubCredentialFingerprint !== "function"
  ) {
    return null;
  }
  const transport = {
    graphql: (query, variables, meta = {}) => lib.graphqlMetadata(query, variables, {
      host: meta.host,
      timeoutMs: meta.timeoutMs,
    }),
    rest: (requestPath, meta = {}) => lib.restMetadata(requestPath, {
      ...meta,
      host: meta.host,
      timeoutMs: meta.timeoutMs,
    }),
  };
  let client;
  try {
    client = engine.createQuotaAwareTransport({
      store,
      transport,
      credentialFingerprint: lib.gitHubCredentialFingerprint,
      now,
    });
  } catch {
    return null;
  }
  return {
    readFingerprints: (slices, options) => candidate.readFingerprints(client, slices, options),
    readDetail: (target) => candidate.readDetail(client, target),
    readActivity: (target) => candidate.readActivity(client, target),
  };
}

async function createDefaultOperations(deps, ctx) {
  const store = await loadStore(deps);
  let engine;
  let githubModule;
  let lib;
  try {
    [engine, githubModule, lib] = await Promise.all([
      import("./pr-watch-engine.mjs"),
      import("./pr-watch-github.mjs"),
      import("./lib.ts"),
    ]);
  } catch {
    return null;
  }
  const now = () => nowMs(deps);
  const github = await githubInterface(githubModule, { store, engine, now, lib });
  if (!github || typeof engine.addWatch !== "function" || typeof engine.runSweep !== "function") return null;
  return {
    async add(input) {
      const target = await resolveCheckoutTarget(input, lib);
      return engine.addWatch({
        store,
        github,
        host: target.host,
        repo: target.repo,
        pr: target.pr,
        id: typeof input.randomId === "function" ? normalizeRandomId(input.randomId()) : undefined,
        now: typeof input.now === "function" ? input.now : now,
        isCanceled: typeof input.isCanceled === "function" ? input.isCanceled : null,
      });
    },
    async sweep(input) {
      return engine.runSweep({
        store,
        github,
        watchId: input.watchId ?? null,
        now: typeof input.now === "function" ? input.now : now,
        tailCache: input.tailCache ?? null,
        isCanceled: typeof input.isCanceled === "function" ? input.isCanceled : null,
      });
    },
  };
}

export function main() {
  process.stdout.on("error", (error) => {
    if (error && (error.code === "EPIPE" || error.code === "ERR_STREAM_DESTROYED")) process.exit(0);
    throw error;
  });
  const promise = runCli(process.argv.slice(2), {
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    cwd: process.cwd(),
    isTTY: {
      stdin: process.stdin.isTTY === true,
      stdout: process.stdout.isTTY === true,
      stderr: process.stderr.isTTY === true,
    },
    runnerPath: defaultRunnerPath(),
    listenSignals: true,
    useDefaultOperations: true,
  });
  promise.then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    },
  );
}

const invokedAsScript = process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) main();
