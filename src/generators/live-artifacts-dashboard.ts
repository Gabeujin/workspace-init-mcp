import {
  type GeneratedFile,
  type WorkspaceInitParams,
} from "../types.js";

const DEFAULT_LIVE_ARTIFACTS_PORT = 43111;

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "workspace";
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function escapeHtmlLiteral(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLiveDashboardPackage(): string {
  return `${JSON.stringify(
    {
      scripts: {
        start: "node server.js",
        health: "node server.js --health",
        check: "node --check server.js && node --check public/app.js",
      },
    },
    null,
    2
  )}\n`;
}

function buildLiveDashboardGitignore(): string {
  return `.state/
logs/
node_modules/
*.log
`;
}

function buildLiveDashboardServer(
  params: WorkspaceInitParams,
  projectSlug: string
): string {
  const projectName = JSON.stringify(params.workspaceName);
  const projectPurpose = JSON.stringify(params.purpose);
  const slug = JSON.stringify(projectSlug);

  return `#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");
const childProcess = require("child_process");
const os = require("os");

const PROJECT_NAME = ${projectName};
const PROJECT_PURPOSE = ${projectPurpose};
const PROJECT_SLUG = ${slug};
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = ${DEFAULT_LIVE_ARTIFACTS_PORT};
const DASHBOARD_ROOT = __dirname;
const PROJECT_ROOT = path.resolve(DASHBOARD_ROOT, "..");
const PUBLIC_ROOT = path.join(DASHBOARD_ROOT, "public");
const STATE_ROOT = path.join(DASHBOARD_ROOT, ".state");
const HISTORY_ROOT = path.join(STATE_ROOT, "history");
const LOG_ROOT = path.join(DASHBOARD_ROOT, "logs");
const LATEST_SUMMARY_PATH = path.join(STATE_ROOT, "latest-summary.json");
const API_TOKEN_PATH = path.join(STATE_ROOT, "api-token");
const MAX_FILE_BYTES = 512 * 1024;
const MAX_PREVIEW_CHARS = 20000;
const MAX_SCAN_FILES = 3000;
const MAX_HISTORY_FILES = 200;
const HEARTBEAT_MS = 5000;
const SCAN_INTERVAL_MS = 4000;
const SERVER_STARTED_AT = new Date().toISOString();

const DEFAULT_SCAN_ROOTS = [
  "AGENTS.md",
  ".github/",
  ".agents/",
  ".governance/",
  "docs/ai-harness/",
  "docs/context/",
  "docs/reviews/",
  "docs/contracts/",
  "docs/plans/",
  "docs/handovers/",
  "docs/work-logs/",
  "docs/evaluations/",
  "memories/session/",
  "documents/",
  "agent-analysis/",
  "finalRecord/",
  "queryResult/"
];

const PREVIEW_ALLOWED_PREFIXES = DEFAULT_SCAN_ROOTS;
const SOURCE_PREVIEW_ENABLED = process.env.LIVE_ARTIFACTS_SOURCE_PREVIEW === "1";
const API_TOKEN_DISABLED = process.env.LIVE_ARTIFACTS_API_TOKEN === "off";

const EXCLUDED_PREFIXES = [
  ".git/",
  "node_modules/",
  "BACKUP/",
  "workspace_resources/",
  "temporary/",
  "live-artifacts-dashboard/.state/",
  "live-artifacts-dashboard/logs/"
];

const SECRET_FILE_PATTERN = /(^|\\/)(\\.env|.*\\.pem|.*\\.key|.*credential.*|.*secret.*|.*token.*)$/i;
const TEXT_EXTENSION_PATTERN = /\\.(md|mdx|txt|json|jsonc|yaml|yml|js|mjs|cjs|ts|tsx|jsx|css|html|xml|csv|ps1|cmd|bat|sh|properties|ini|toml)$/i;
const OPEN_MARKERS = [
  /- \\[ \\]/i,
  /\\bTODO:/i,
  /\\bFIXME:/i,
  /\\bOPEN:/i,
  /live-artifacts:\\s*open/i
];

function normalizeRelativePath(value) {
  return String(value || "").replace(/\\\\/g, "/").replace(/^\\.\\//, "");
}

function toRelativePath(fullPath) {
  return normalizeRelativePath(path.relative(PROJECT_ROOT, fullPath));
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function ensureRuntimeDirs() {
  fs.mkdirSync(STATE_ROOT, { recursive: true });
  fs.mkdirSync(HISTORY_ROOT, { recursive: true });
  fs.mkdirSync(LOG_ROOT, { recursive: true });
}

function createApiToken() {
  return crypto.randomBytes(32).toString("base64url").slice(0, 40);
}

function getApiToken() {
  if (API_TOKEN_DISABLED) {
    return "";
  }
  const configured = String(process.env.LIVE_ARTIFACTS_API_TOKEN || "").trim();
  if (configured.length > 0) {
    return configured;
  }
  ensureRuntimeDirs();
  try {
    const existing = fs.readFileSync(API_TOKEN_PATH, "utf-8").trim();
    if (existing.length >= 20) {
      return existing;
    }
  } catch {
    // Generate a token below.
  }
  const token = createApiToken();
  fs.writeFileSync(API_TOKEN_PATH, token + "\\n", { encoding: "utf-8", mode: 0o600 });
  return token;
}

function isLoopbackHost(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return true;
  }
  const host = raw.startsWith("[::1]") ? "::1" : raw.split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isAllowedOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return true;
  }
  try {
    return isLoopbackHost(new URL(raw).host);
  } catch {
    return false;
  }
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function authorizeApiRequest(req, parsedUrl) {
  if (!isLoopbackHost(req.headers.host) || !isAllowedOrigin(req.headers.origin)) {
    return { ok: false, statusCode: 403, error: "Loopback host and origin are required" };
  }
  if (API_TOKEN_DISABLED) {
    return { ok: true };
  }
  const expected = getApiToken();
  const provided = String(req.headers["x-live-artifacts-token"] || parsedUrl.query.token || "");
  if (!timingSafeEqualText(provided, expected)) {
    return { ok: false, statusCode: 401, error: "Live artifacts API token is required" };
  }
  return { ok: true };
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    "." + path.basename(filePath) + "." + process.pid + "." + Date.now() + "." + Math.random().toString(16).slice(2) + ".tmp"
  );
  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2) + "\\n", "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Preserve the original write error.
    }
    throw error;
  }
}

function pruneHistory() {
  let entries = [];
  try {
    entries = fs.readdirSync(HISTORY_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => ({
        name: entry.name,
        fullPath: path.join(HISTORY_ROOT, entry.name),
        mtimeMs: fs.statSync(path.join(HISTORY_ROOT, entry.name)).mtimeMs
      }))
      .sort((left, right) => right.mtimeMs - left.mtimeMs);
  } catch {
    return;
  }

  for (const entry of entries.slice(MAX_HISTORY_FILES)) {
    try {
      fs.unlinkSync(entry.fullPath);
    } catch {
      // Keep the dashboard running if history pruning cannot delete a file.
    }
  }
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isExcluded(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const lower = normalized.toLowerCase();
  if (SECRET_FILE_PATTERN.test(normalized)) {
    return true;
  }
  return EXCLUDED_PREFIXES.some((prefix) => lower === prefix.slice(0, -1).toLowerCase() || lower.startsWith(prefix.toLowerCase()));
}

function isDirectoryExcluded(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const lower = normalized.length > 0 ? normalized.toLowerCase() + "/" : "";
  return EXCLUDED_PREFIXES.some((prefix) => lower === prefix.toLowerCase() || lower.startsWith(prefix.toLowerCase()));
}

function getConfiguredScanRoots() {
  const configured = String(process.env.LIVE_ARTIFACTS_SCAN_ROOTS || "")
    .split(/[;,]/)
    .map((entry) => normalizeRelativePath(entry.trim()))
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_SCAN_ROOTS;
}

function walkFiles() {
  const files = [];
  const roots = getConfiguredScanRoots();
  const stack = [];

  for (const root of roots) {
    const resolved = path.resolve(PROJECT_ROOT, root);
    if (!isPathInside(resolved, PROJECT_ROOT)) {
      continue;
    }
    if (!fs.existsSync(resolved)) {
      continue;
    }
    try {
      const stat = fs.statSync(resolved);
      if (stat.isFile()) {
        if (!isExcluded(toRelativePath(resolved))) {
          files.push(resolved);
        }
        continue;
      }
      if (stat.isDirectory() && !isDirectoryExcluded(toRelativePath(resolved))) {
        stack.push(resolved);
      }
    } catch {
      continue;
    }
  }

  while (stack.length > 0 && files.length < MAX_SCAN_FILES) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relativePath = toRelativePath(fullPath);
      if (entry.isDirectory()) {
        if (!isDirectoryExcluded(relativePath)) {
          stack.push(fullPath);
        }
        continue;
      }
      if (!entry.isFile() || isExcluded(relativePath)) {
        continue;
      }
      files.push(fullPath);
      if (files.length >= MAX_SCAN_FILES) {
        break;
      }
    }
  }

  return files;
}

function isPreviewAllowed(relativePath) {
  if (SOURCE_PREVIEW_ENABLED) {
    return true;
  }
  const normalized = normalizeRelativePath(relativePath);
  return PREVIEW_ALLOWED_PREFIXES.some((prefix) => {
    const normalizedPrefix = normalizeRelativePath(prefix);
    return normalized === normalizedPrefix.replace(/\\/$/, "") || normalized.startsWith(normalizedPrefix);
  });
}

function redactSecrets(raw) {
  return raw
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[redacted-private-key]")
    .replace(/(authorization\\s*:\\s*bearer\\s+)[A-Za-z0-9._\\-+/=]+/gi, "$1[redacted]")
    .replace(/((?:api[_-]?key|client[_-]?secret|password|passwd|secret|token)\\s*[:=]\\s*["']?)[^"'\\s,}]+/gi, "$1[redacted]")
    .replace(/(["'](?:api[_-]?key|client[_-]?secret|password|passwd|secret|token)["']\\s*:\\s*["'])[^"']+(["'])/gi, "$1[redacted]$2")
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted-aws-access-key]")
    .replace(/[A-Za-z0-9_\\-]{24,}\\.[A-Za-z0-9_\\-]{20,}\\.[A-Za-z0-9_\\-]{20,}/g, "[redacted-jwt]");
}

function readPreview(fullPath, relativePath, stat) {
  if (stat.size > MAX_FILE_BYTES || !TEXT_EXTENSION_PATTERN.test(relativePath)) {
    return null;
  }
  if (SECRET_FILE_PATTERN.test(relativePath) || !isPreviewAllowed(relativePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(fullPath, "utf-8").slice(0, MAX_PREVIEW_CHARS);
    return redactSecrets(raw);
  } catch {
    return null;
  }
}

function isActiveOpenTaskCandidate(relativePath, preview) {
  const normalized = normalizeRelativePath(relativePath);
  return (
    normalized === "AGENTS.md" ||
    normalized.startsWith(".github/") ||
    normalized.startsWith(".agents/") ||
    normalized === ".governance/_INDEX.md" ||
    normalized === ".governance/_PROJECT_STATE.md" ||
    normalized.startsWith(".governance/backlog/") ||
    normalized.startsWith(".governance/plans/") ||
    normalized.startsWith("memories/session/") ||
    /live-artifacts:\\s*track-open-tasks/i.test(preview || "")
  );
}

function isArchivedUncheckedCandidate(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return (
    normalized.startsWith(".governance/sessions/") ||
    normalized.startsWith(".governance/reviews/") ||
    normalized.startsWith(".governance/decisions/") ||
    normalized.startsWith(".governance/specs/") ||
    normalized.startsWith(".governance/reports/") ||
    /^2026_.*_report\\//.test(normalized) ||
    normalized.startsWith("documents/") ||
    normalized.startsWith("agent-analysis/") ||
    normalized.startsWith("finalRecord/") ||
    normalized.startsWith("queryResult/")
  );
}

function classifyArtifact(relativePath, preview) {
  const normalized = normalizeRelativePath(relativePath);
  if (isActiveOpenTaskCandidate(normalized, preview)) {
    return "active-open-task";
  }
  if (isArchivedUncheckedCandidate(normalized)) {
    return "archived-unchecked";
  }
  if (normalized.startsWith(".governance/")) {
    return "governance";
  }
  if (normalized.startsWith("docs/ai-harness/") || normalized.startsWith("live-artifacts-dashboard/")) {
    return "harness";
  }
  if (/report|bundle|summary/i.test(normalized)) {
    return "report-bundle";
  }
  if (TEXT_EXTENSION_PATTERN.test(normalized)) {
    return "artifact";
  }
  return "binary-or-large";
}

function extractOpenMarkers(preview) {
  if (!preview) {
    return [];
  }
  const lines = preview.split(/\\r?\\n/);
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (OPEN_MARKERS.some((pattern) => pattern.test(line))) {
      matches.push({
        line: index + 1,
        text: line.trim().slice(0, 240)
      });
    }
  }
  return matches.slice(0, 30);
}

function getGitSnapshot() {
  function runGit(args) {
    return childProcess.execFileSync("git", args, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  }

  try {
    const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
    const status = runGit(["status", "--short"]);
    const numstat = runGit(["diff", "--numstat"]);
    const changedFiles = status
      .split(/\\r?\\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 200);
    return {
      available: true,
      branch,
      dirty: changedFiles.length > 0,
      changedFileCount: changedFiles.length,
      changedFiles,
      numstat: numstat
        .split(/\\r?\\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 200)
    };
  } catch {
    return {
      available: false,
      branch: "unknown",
      dirty: false,
      changedFileCount: 0,
      changedFiles: [],
      numstat: []
    };
  }
}

function buildGovernanceBundles(artifacts) {
  const prefixes = [
    ".governance/specs/",
    ".governance/decisions/",
    ".governance/sessions/",
    ".governance/reviews/",
    ".governance/reports/",
    ".governance/backlog/",
    ".governance/plans/"
  ];

  return prefixes.map((prefix) => {
    const items = artifacts.filter((artifact) => artifact.path.startsWith(prefix));
    return {
      id: prefix.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, ""),
      path: prefix,
      count: items.length,
      uncheckedCount: items.reduce((total, item) => total + item.openTaskCount, 0),
      status: items.length > 0 ? "present" : "missing"
    };
  });
}

function buildAdminDashboardReference() {
  const dashboardPath = "docs/ai-harness/dashboard/index.html";
  const statePath = "docs/ai-harness/dashboard/state/dashboard-state.json";
  const operationsScriptPath = "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs";
  return {
    role: "canonical-admin-state-and-operations-dashboard",
    dashboardPath,
    statePath,
    operationsScriptPath,
    defaultServePort: 43110,
    liveArtifactsPort: getPort(),
    dashboardAvailable: fs.existsSync(path.join(PROJECT_ROOT, dashboardPath)),
    stateAvailable: fs.existsSync(path.join(PROJECT_ROOT, statePath)),
    operationsScriptAvailable: fs.existsSync(path.join(PROJECT_ROOT, operationsScriptPath)),
    boundary:
      "Admin dashboard owns curated governance, runtime orchestration, KPIs, and service operations health; live artifacts dashboard owns real-time artifact discovery and open-work observation."
  };
}

function scanArtifacts() {
  const files = walkFiles();
  const artifacts = [];
  const activeOpenTasks = [];
  const archivedUnchecked = [];

  for (const fullPath of files) {
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    const relativePath = toRelativePath(fullPath);
    const preview = readPreview(fullPath, relativePath, stat);
    const openMarkers = extractOpenMarkers(preview);
    const category = classifyArtifact(relativePath, preview);
    const id = hash(relativePath).slice(0, 16);
    const artifact = {
      id,
      path: relativePath,
      category,
      status: openMarkers.length > 0 ? "attention" : "tracked",
      size: stat.size,
      mtimeMs: Math.round(stat.mtimeMs),
      previewAvailable: preview != null,
      openTaskCount: openMarkers.length
    };
    artifacts.push(artifact);

    if (category === "active-open-task" && openMarkers.length > 0) {
      for (const marker of openMarkers) {
        activeOpenTasks.push({ artifactId: id, path: relativePath, line: marker.line, text: marker.text });
      }
    }
    if (category === "archived-unchecked" && openMarkers.length > 0) {
      for (const marker of openMarkers) {
        archivedUnchecked.push({ artifactId: id, path: relativePath, line: marker.line, text: marker.text });
      }
    }
  }

  artifacts.sort((left, right) => right.mtimeMs - left.mtimeMs || left.path.localeCompare(right.path));
  return { artifacts, activeOpenTasks, archivedUnchecked, truncated: files.length >= MAX_SCAN_FILES };
}

function buildSummary(force, persist) {
  ensureRuntimeDirs();
  const shouldPersist = persist !== false;
  const startedAt = SERVER_STARTED_AT;
  const scanStartedAt = new Date().toISOString();
  const scan = scanArtifacts();
  const git = getGitSnapshot();
  const categories = {};

  for (const artifact of scan.artifacts) {
    categories[artifact.category] = (categories[artifact.category] || 0) + 1;
  }

  const reportBundles = scan.artifacts.filter((artifact) => artifact.category === "report-bundle" || artifact.path.startsWith(".governance/reports/"));
  const governanceBundles = buildGovernanceBundles(scan.artifacts);
  const signatureInput = {
    artifacts: scan.artifacts.map((artifact) => [
      artifact.path,
      artifact.size,
      artifact.mtimeMs,
      artifact.category,
      artifact.openTaskCount
    ]),
    git: {
      branch: git.branch,
      changedFileCount: git.changedFileCount,
      changedFiles: git.changedFiles
    }
  };
  const signature = hash(JSON.stringify(signatureInput)).slice(0, 24);
  const previous = readJsonIfExists(LATEST_SUMMARY_PATH);
  const generatedAt = new Date().toISOString();
  const summary = {
    project: {
      name: PROJECT_NAME,
      slug: PROJECT_SLUG,
      root: ".",
      rootScope: "project-root",
      purpose: PROJECT_PURPOSE,
      dashboardUrl: "http://" + DEFAULT_HOST + ":" + String(getPort()) + "/"
    },
    startedAt,
    scanStartedAt,
    generatedAt,
    signature,
    counts: {
      artifacts: scan.artifacts.length,
      activeOpenTasks: scan.activeOpenTasks.length,
      archivedUnchecked: scan.archivedUnchecked.length,
      reportBundles: reportBundles.length,
      gitChanges: git.changedFileCount,
      categories: Object.keys(categories).length
    },
    artifacts: scan.artifacts,
    activeOpenTasks: scan.activeOpenTasks.slice(0, 200),
    archivedUnchecked: scan.archivedUnchecked.slice(0, 200),
    reportBundles,
    gitChanges: git.changedFiles,
    categories,
    recentArtifacts: scan.artifacts.slice(0, 25),
    governanceBundles,
    adminDashboard: buildAdminDashboardReference(),
    git,
    health: {
      ok: true,
      truncated: scan.truncated,
      maxScanFiles: MAX_SCAN_FILES,
      scanRoots: getConfiguredScanRoots(),
      sourcePreviewEnabled: SOURCE_PREVIEW_ENABLED,
      maxFileBytes: MAX_FILE_BYTES,
      node: process.version,
      platform: os.platform()
    },
    theme: {
      storageKey: PROJECT_SLUG + ":liveArtifacts:theme",
      modes: ["light", "dark"],
      default: "system"
    },
    accessibility: {
      skipLink: true,
      ariaLive: true,
      chartTextFallback: true,
      reducedMotion: true,
      keyboardNavigation: true
    }
  };

  if (shouldPersist) {
    writeJson(LATEST_SUMMARY_PATH, summary);
    if (force || !previous || previous.signature !== signature) {
      const historyName = generatedAt.replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + signature + ".json";
      writeJson(path.join(HISTORY_ROOT, historyName), summary);
      pruneHistory();
    }
  }

  return summary;
}

function getPort() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf("--port");
  if (portIndex !== -1 && args[portIndex + 1]) {
    return Number(args[portIndex + 1]);
  }
  if (process.env.LIVE_ARTIFACTS_PORT) {
    return Number(process.env.LIVE_ARTIFACTS_PORT);
  }
  return DEFAULT_PORT;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    "content-type": contentType || "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(PUBLIC_ROOT, "." + requested);
  if (!isPathInside(resolved, PUBLIC_ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  fs.readFile(resolved, (error, data) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }
    const extension = path.extname(resolved).toLowerCase();
    const contentType =
      extension === ".html" ? "text/html; charset=utf-8" :
      extension === ".css" ? "text/css; charset=utf-8" :
      extension === ".js" ? "application/javascript; charset=utf-8" :
      "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    if (extension === ".html" && path.basename(resolved) === "index.html") {
      const token = getApiToken();
      const html = data.toString("utf-8").replace(
        "\\"__LIVE_ARTIFACTS_API_TOKEN__\\"",
        JSON.stringify(token)
      );
      res.end(html);
      return;
    }
    res.end(data);
  });
}

function getCurrentSummary(force) {
  if (force) {
    return buildSummary(true, true);
  }
  const current = readJsonIfExists(LATEST_SUMMARY_PATH);
  return current || buildSummary(false, false);
}

function handleArtifactDetail(res, id) {
  const summary = buildSummary(false, false);
  const artifact = summary.artifacts.find((item) => item.id === id);
  if (!artifact) {
    sendJson(res, 404, { ok: false, error: "Unknown artifact id" });
    return;
  }

  const fullPath = path.resolve(PROJECT_ROOT, artifact.path);
  let realProjectRoot;
  let realFullPath;
  try {
    realProjectRoot = fs.realpathSync(PROJECT_ROOT);
    realFullPath = fs.realpathSync(fullPath);
  } catch {
    sendJson(res, 404, { ok: false, error: "Artifact no longer exists" });
    return;
  }

  if (!isPathInside(realFullPath, realProjectRoot)) {
    sendJson(res, 403, { ok: false, error: "Artifact escapes project root" });
    return;
  }

  const stat = fs.statSync(realFullPath);
  const preview = readPreview(realFullPath, artifact.path, stat);
  sendJson(res, 200, {
    ok: true,
    artifact,
    preview,
    previewTruncated: preview != null && stat.size > Buffer.byteLength(preview, "utf-8")
  });
}

function handleEvents(req, res) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no"
  });

  let lastSignature = "";
  function send(event, data) {
    res.write("event: " + event + "\\n");
    res.write("data: " + JSON.stringify(data) + "\\n\\n");
  }

  const initial = buildSummary(false, false);
  lastSignature = initial.signature;
  send("ready", { ok: true, signature: lastSignature, generatedAt: initial.generatedAt });

  const heartbeat = setInterval(() => {
    send("heartbeat", { at: new Date().toISOString(), signature: lastSignature });
  }, HEARTBEAT_MS);

  const scanner = setInterval(() => {
    const next = buildSummary(false, false);
    if (next.signature !== lastSignature) {
      lastSignature = next.signature;
      send("summary", next);
    }
  }, SCAN_INTERVAL_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(scanner);
  });
}

function handleApi(req, res, parsedUrl) {
  const authorization = authorizeApiRequest(req, parsedUrl);
  if (!authorization.ok) {
    sendJson(res, authorization.statusCode, { ok: false, error: authorization.error });
    return;
  }

  if (parsedUrl.pathname === "/api/health") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method not allowed");
      return;
    }
    const summary = buildSummary(false, false);
    sendJson(res, 200, {
      ok: true,
      project: summary.project,
      signature: summary.signature,
      counts: summary.counts,
      health: summary.health
    });
    return;
  }

  if (parsedUrl.pathname === "/api/summary/refresh") {
    if (req.method !== "POST") {
      sendText(res, 405, "Method not allowed");
      return;
    }
    sendJson(res, 200, buildSummary(true, true));
    return;
  }

  if (parsedUrl.pathname === "/api/summary") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method not allowed");
      return;
    }
    sendJson(res, 200, buildSummary(false, false));
    return;
  }

  if (parsedUrl.pathname === "/api/artifacts") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method not allowed");
      return;
    }
    const summary = buildSummary(false, false);
    const openOnly = parsedUrl.query.openOnly === "true";
    const artifacts = openOnly
      ? summary.artifacts.filter((artifact) => artifact.category === "active-open-task" && artifact.openTaskCount > 0)
      : summary.artifacts;
    sendJson(res, 200, { ok: true, artifacts });
    return;
  }

  if (parsedUrl.pathname === "/api/artifact") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method not allowed");
      return;
    }
    if (typeof parsedUrl.query.id !== "string" || parsedUrl.query.id.length === 0) {
      sendJson(res, 400, { ok: false, error: "id is required" });
      return;
    }
    handleArtifactDetail(res, parsedUrl.query.id);
    return;
  }

  if (parsedUrl.pathname === "/api/events") {
    if (req.method !== "GET") {
      sendText(res, 405, "Method not allowed");
      return;
    }
    handleEvents(req, res);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Unknown API route" });
}

function createServer() {
  return http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || "/", true);
    if ((parsedUrl.pathname || "").startsWith("/api/")) {
      handleApi(req, res, parsedUrl);
      return;
    }
    serveStatic(req, res, parsedUrl.pathname || "/");
  });
}

if (process.argv.includes("--health")) {
  const summary = buildSummary(true, true);
  console.log(JSON.stringify({
    ok: true,
    signature: summary.signature,
    counts: summary.counts,
    health: summary.health
  }, null, 2));
  process.exit(0);
}

ensureRuntimeDirs();
getApiToken();
const port = getPort();
const server = createServer();
server.listen(port, DEFAULT_HOST, () => {
  console.log("Live artifacts dashboard listening at http://" + DEFAULT_HOST + ":" + String(port));
});
`;
}

function buildLiveDashboardHtml(params: WorkspaceInitParams): string {
  const title = escapeHtmlLiteral(`${params.workspaceName} Live Artifacts`);
  return `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="/styles.css" />
    <script>window.__LIVE_ARTIFACTS_API_TOKEN__ = "__LIVE_ARTIFACTS_API_TOKEN__";</script>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to main content</a>
    <header class="topbar">
      <div class="topbar-title">
        <p class="eyebrow">Local Harness</p>
        <h1>${title}</h1>
      </div>
      <div class="topbar-actions" aria-label="Dashboard actions">
        <span id="connection-status" class="status-pill" aria-live="polite">loading</span>
        <button id="theme-toggle" class="icon-button" type="button" aria-label="Toggle color theme" title="Toggle color theme">T</button>
        <button id="refresh-button" class="icon-button" type="button" aria-label="Refresh artifact summary" title="Refresh artifact summary">R</button>
      </div>
    </header>

    <main id="main" class="page-shell">
      <section class="summary-grid" aria-label="Artifact summary">
        <article class="summary-tile"><span>All Artifacts</span><strong id="count-artifacts">0</strong></article>
        <article class="summary-tile"><span>Open Tasks</span><strong id="count-open">0</strong></article>
        <article class="summary-tile"><span>Archived Checks</span><strong id="count-archived">0</strong></article>
        <article class="summary-tile"><span>Report Bundles</span><strong id="count-reports">0</strong></article>
        <article class="summary-tile"><span>Git Changes</span><strong id="count-git">0</strong></article>
      </section>
      <div id="scan-warning" class="scan-warning" role="status" hidden></div>

      <section class="insight-grid" aria-label="Dashboard insights">
        <section class="panel" aria-labelledby="artifact-map-heading">
          <h2 id="artifact-map-heading">Artifact Map</h2>
          <canvas id="artifact-chart" role="img" aria-label="Artifact category distribution chart"></canvas>
          <table class="data-table" aria-label="Artifact category counts">
            <thead><tr><th>Category</th><th>Count</th></tr></thead>
            <tbody id="category-table-body"></tbody>
          </table>
        </section>
        <section class="panel" aria-labelledby="open-work-heading">
          <h2 id="open-work-heading">Open Work</h2>
          <div id="open-work-summary" class="stack"></div>
        </section>
        <section class="panel" aria-labelledby="bundle-health-heading">
          <h2 id="bundle-health-heading">Bundle Health</h2>
          <div id="bundle-health" class="stack"></div>
        </section>
        <section class="panel" aria-labelledby="boundary-heading">
          <h2 id="boundary-heading">Dashboard Boundary</h2>
          <div id="dashboard-boundary" class="stack"></div>
        </section>
      </section>

      <section class="workspace-grid" aria-label="Artifact workspace">
        <nav class="panel sidebar" aria-label="Artifact filters">
          <label class="field-label" for="search-input">Search artifacts</label>
          <input id="search-input" type="search" placeholder="path, category, task text" />
          <div id="category-list" class="category-list" aria-label="Categories"></div>
          <div id="filter-result-count" class="assistive-text" aria-live="polite"></div>
        </nav>

        <section class="panel artifact-pane" aria-labelledby="artifact-list-heading">
          <h2 id="artifact-list-heading">Artifacts</h2>
          <div id="artifact-list" class="artifact-list"></div>
        </section>

        <section class="panel detail-pane" aria-labelledby="detail-heading">
          <h2 id="detail-heading">Artifact Detail</h2>
          <div id="detail-meta" class="detail-meta">No artifact selected.</div>
          <pre id="detail-preview" tabindex="0" aria-label="Selected artifact preview"></pre>
        </section>
      </section>
    </main>

    <div id="live-region" class="sr-only" aria-live="polite"></div>
    <script src="/vendor/chart.umd.js"></script>
    <script src="/app.js"></script>
  </body>
</html>
`;
}

function buildLiveDashboardStyles(): string {
  return `:root {
  --color-neutral-0: #ffffff;
  --color-neutral-50: #f6f7f9;
  --color-neutral-100: #eceff3;
  --color-neutral-200: #d8dee6;
  --color-neutral-500: #637083;
  --color-neutral-800: #1f2937;
  --color-neutral-900: #111827;
  --color-blue-600: #2563eb;
  --color-cyan-600: #0891b2;
  --color-green-600: #16803c;
  --color-amber-600: #b66a00;
  --color-red-600: #c83232;
  --color-violet-600: #7c3aed;
  --color-bg: var(--color-neutral-50);
  --color-surface: var(--color-neutral-0);
  --color-surface-raised: #fbfcfe;
  --color-text: var(--color-neutral-900);
  --color-text-muted: var(--color-neutral-500);
  --color-border: var(--color-neutral-200);
  --color-focus: var(--color-blue-600);
  --color-success: var(--color-green-600);
  --color-info: var(--color-cyan-600);
  --color-warning: var(--color-amber-600);
  --color-danger: var(--color-red-600);
  --color-violet: var(--color-violet-600);
  --shadow-card: 0 10px 28px rgba(31, 41, 55, 0.08);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --font-xs: 12px;
  --font-sm: 13px;
  --font-md: 14px;
  --font-lg: 16px;
  --font-xl: 20px;
  --font-2xl: 24px;
  --line-tight: 1.35;
  --line-normal: 1.55;
  --radius-panel: 8px;
  --radius-control: 6px;
}

[data-theme="dark"] {
  --color-bg: #12161f;
  --color-surface: #1b2230;
  --color-surface-raised: #222b3a;
  --color-text: #f3f6fb;
  --color-text-muted: #bac4d3;
  --color-border: #334155;
  --shadow-card: 0 10px 28px rgba(0, 0, 0, 0.28);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: "Segoe UI", "Noto Sans KR", system-ui, sans-serif;
  font-size: var(--font-md);
  line-height: var(--line-normal);
}

button,
input {
  font: inherit;
}

.skip-link {
  position: absolute;
  left: var(--space-4);
  top: -80px;
  z-index: 20;
  padding: var(--space-2) var(--space-3);
  background: var(--color-focus);
  color: var(--color-neutral-0);
  border-radius: var(--radius-control);
}

.skip-link:focus {
  top: var(--space-4);
}

:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.topbar h1 {
  margin: 0;
  font-size: var(--font-2xl);
  line-height: var(--line-tight);
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--color-info);
  font-size: var(--font-xs);
  font-weight: 700;
  text-transform: uppercase;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-pill,
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 28px;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface-raised);
  font-size: var(--font-sm);
}

.status-pill.live,
.badge.good {
  border-color: var(--color-success);
}

.status-pill.offline,
.badge.risk {
  border-color: var(--color-danger);
}

.icon-button {
  min-width: 40px;
  min-height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface-raised);
  cursor: pointer;
}

.page-shell {
  width: min(1440px, 100%);
  margin: 0 auto;
  padding: var(--space-6);
}

.summary-grid,
.insight-grid,
.workspace-grid {
  display: grid;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.summary-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.insight-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.workspace-grid {
  grid-template-columns: 280px minmax(0, 1fr) minmax(340px, 0.9fr);
  align-items: start;
}

.summary-tile,
.panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.summary-tile {
  min-height: 96px;
  padding: var(--space-4);
}

.summary-tile span {
  display: block;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.summary-tile strong {
  display: block;
  margin-top: var(--space-2);
  font-size: var(--font-2xl);
}

.scan-warning {
  margin: 0 0 var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-panel);
  color: var(--color-text);
  background: var(--color-surface);
}

.panel {
  padding: var(--space-4);
}

.panel h2 {
  margin: 0 0 var(--space-3);
  font-size: var(--font-xl);
  line-height: var(--line-tight);
}

.stack {
  display: grid;
  gap: var(--space-2);
}

.field-label {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

#search-input {
  width: 100%;
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface-raised);
}

.category-list,
.artifact-list {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.category-button,
.artifact-button {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface-raised);
  text-align: left;
  cursor: pointer;
}

.category-button {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
}

.artifact-button {
  padding: var(--space-3);
}

.category-button[aria-pressed="true"],
.artifact-button[aria-current="true"] {
  border-color: var(--color-focus);
}

.artifact-path {
  display: block;
  overflow-wrap: anywhere;
  font-family: "Cascadia Code", "Consolas", monospace;
  font-size: var(--font-sm);
}

.artifact-meta,
.assistive-text,
.detail-meta {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--space-3);
}

.data-table th,
.data-table td {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

#artifact-chart {
  width: 100%;
  max-height: 240px;
}

#detail-preview {
  min-height: 420px;
  max-height: 70vh;
  overflow: auto;
  margin: var(--space-3) 0 0;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface-raised);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1023px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .insight-grid,
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 639px) {
  .topbar {
    align-items: flex-start;
    flex-direction: column;
    padding: var(--space-4);
  }

  .page-shell {
    padding: var(--space-4);
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
`;
}

function buildLiveDashboardApp(projectSlug: string): string {
  return `"use strict";

const THEME_KEY = "${projectSlug}:liveArtifacts:theme";
const SUMMARY_KEY = "${projectSlug}:liveArtifacts:summary";

const state = {
  summary: null,
  selectedArtifactId: null,
  category: "all",
  search: "",
  lastRenderedSignature: "",
  lastChartSignature: "",
  chart: null
};

const API_TOKEN = String(window.__LIVE_ARTIFACTS_API_TOKEN__ || "");

function apiHeaders() {
  return API_TOKEN ? { "x-live-artifacts-token": API_TOKEN } : {};
}

function withApiToken(path) {
  if (!API_TOKEN) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return path + separator + "token=" + encodeURIComponent(API_TOKEN);
}

const elements = {
  connection: document.getElementById("connection-status"),
  refresh: document.getElementById("refresh-button"),
  theme: document.getElementById("theme-toggle"),
  live: document.getElementById("live-region"),
  scanWarning: document.getElementById("scan-warning"),
  search: document.getElementById("search-input"),
  categoryList: document.getElementById("category-list"),
  artifactList: document.getElementById("artifact-list"),
  filterCount: document.getElementById("filter-result-count"),
  detailMeta: document.getElementById("detail-meta"),
  detailPreview: document.getElementById("detail-preview"),
  categoryTable: document.getElementById("category-table-body"),
  openWork: document.getElementById("open-work-summary"),
  bundleHealth: document.getElementById("bundle-health"),
  dashboardBoundary: document.getElementById("dashboard-boundary"),
  chart: document.getElementById("artifact-chart")
};

function setLiveMessage(message) {
  elements.live.textContent = message;
}

function setConnection(status) {
  elements.connection.textContent = status;
  elements.connection.className = "status-pill " + (status === "live" ? "live" : status === "offline" ? "offline" : "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadCachedSummary() {
  try {
    const cached = JSON.parse(localStorage.getItem(SUMMARY_KEY) || "null");
    if (cached && cached.signature) {
      applySummary(cached, "cached summary loaded");
    }
  } catch {
    localStorage.removeItem(SUMMARY_KEY);
  }
}

async function fetchSummary(force) {
  setConnection("loading");
  const response = await fetch(force ? "/api/summary/refresh" : "/api/summary", {
    cache: "no-store",
    method: force ? "POST" : "GET",
    headers: apiHeaders()
  });
  if (!response.ok) {
    throw new Error("summary request failed");
  }
  return response.json();
}

function applySummary(summary, message) {
  state.summary = summary;
  try {
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
  } catch {
    // Ignore storage quota or privacy-mode failures.
  }
  render();
  setConnection("live");
  setLiveMessage(message || "Dashboard summary updated.");
}

function renderCounts(summary) {
  document.getElementById("count-artifacts").textContent = String(summary.counts?.artifacts ?? 0);
  document.getElementById("count-open").textContent = String(summary.counts?.activeOpenTasks ?? 0);
  document.getElementById("count-archived").textContent = String(summary.counts?.archivedUnchecked ?? 0);
  document.getElementById("count-reports").textContent = String(summary.counts?.reportBundles ?? 0);
  document.getElementById("count-git").textContent = String(summary.counts?.gitChanges ?? 0);
}

function renderScanHealth(summary) {
  const health = summary.health || {};
  const roots = Array.isArray(health.scanRoots) ? health.scanRoots.join(", ") : "default";
  if (health.truncated) {
    elements.scanWarning.hidden = false;
    elements.scanWarning.textContent =
      "Partial scan: artifact results hit the " + String(health.maxScanFiles || 0) + " file cap. Scan roots: " + roots;
    return;
  }
  elements.scanWarning.hidden = false;
  elements.scanWarning.textContent =
    "Scan roots: " + roots + ". Source preview is " + (health.sourcePreviewEnabled ? "enabled" : "disabled") + ".";
}

function renderCategoryTable(summary) {
  const categories = summary.categories || {};
  elements.categoryTable.innerHTML = Object.entries(categories)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name, count]) => "<tr><td>" + escapeHtml(name) + "</td><td>" + escapeHtml(count) + "</td></tr>")
    .join("");
}

function renderChart(summary) {
  const signature = summary.signature + ":chart";
  if (state.lastChartSignature === signature) {
    return;
  }
  state.lastChartSignature = signature;
  const categories = summary.categories || {};
  const labels = Object.keys(categories);
  const values = labels.map((label) => categories[label]);
  const styles = getComputedStyle(document.documentElement);
  const colors = [
    styles.getPropertyValue("--color-info").trim(),
    styles.getPropertyValue("--color-success").trim(),
    styles.getPropertyValue("--color-warning").trim(),
    styles.getPropertyValue("--color-danger").trim(),
    styles.getPropertyValue("--color-violet").trim()
  ];

  if (!window.Chart || !elements.chart) {
    return;
  }

  if (state.chart) {
    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = values;
    state.chart.data.datasets[0].backgroundColor = labels.map((_, index) => colors[index % colors.length]);
    state.chart.update();
    return;
  }

  state.chart = new window.Chart(elements.chart, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Artifacts", data: values, backgroundColor: labels.map((_, index) => colors[index % colors.length]) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderOpenWork(summary) {
  const tasks = summary.activeOpenTasks || [];
  const archived = summary.archivedUnchecked || [];
  elements.openWork.innerHTML =
    "<p><strong>" + escapeHtml(tasks.length) + "</strong> active open items</p>" +
    "<p><strong>" + escapeHtml(archived.length) + "</strong> archived unchecked items</p>" +
    tasks.slice(0, 5).map((task) =>
      '<div class="badge">' + escapeHtml(task.path) + ":" + escapeHtml(task.line) + "</div>"
    ).join("");
}

function renderBundleHealth(summary) {
  const bundles = summary.governanceBundles || [];
  elements.bundleHealth.innerHTML = bundles.map((bundle) =>
    '<div><span class="badge ' + (bundle.status === "present" ? "good" : "risk") + '">' +
    escapeHtml(bundle.status) + '</span> ' + escapeHtml(bundle.path) +
    ' <strong>' + escapeHtml(bundle.count) + '</strong></div>'
  ).join("");
}

function renderDashboardBoundary(summary) {
  const admin = summary.adminDashboard || {};
  elements.dashboardBoundary.innerHTML =
    '<div><span class="badge good">live</span> real-time artifact observation on port ' + escapeHtml(admin.liveArtifactsPort || "43111") + '</div>' +
    '<div><span class="badge">admin</span> canonical state on port ' + escapeHtml(admin.defaultServePort || "43110") + '</div>' +
    '<div class="artifact-meta">' + escapeHtml(admin.boundary || "Dashboard responsibilities are separated.") + '</div>' +
    '<div class="artifact-path">' + escapeHtml(admin.statePath || "docs/ai-harness/dashboard/state/dashboard-state.json") + '</div>';
}

function renderCategories(summary) {
  const categories = { all: summary.artifacts.length, ...(summary.categories || {}) };
  elements.categoryList.innerHTML = Object.entries(categories)
    .map(([name, count]) =>
      '<button type="button" class="category-button" data-category="' + escapeHtml(name) + '" aria-pressed="' + String(state.category === name) + '">' +
      '<span>' + escapeHtml(name) + '</span><strong>' + escapeHtml(count) + '</strong></button>'
    )
    .join("");
}

function getFilteredArtifacts(summary) {
  const search = state.search.trim().toLowerCase();
  return (summary.artifacts || []).filter((artifact) => {
    const categoryMatch = state.category === "all" || artifact.category === state.category;
    const searchMatch =
      search.length === 0 ||
      artifact.path.toLowerCase().includes(search) ||
      artifact.category.toLowerCase().includes(search);
    return categoryMatch && searchMatch;
  });
}

function renderArtifactList(summary) {
  const artifacts = getFilteredArtifacts(summary);
  elements.filterCount.textContent = String(artifacts.length) + " artifacts shown";
  if (artifacts.length === 0) {
    elements.artifactList.innerHTML = '<p class="assistive-text">No artifacts match the current filters.</p>';
    return;
  }

  elements.artifactList.innerHTML = artifacts.slice(0, 300).map((artifact) =>
    '<button type="button" class="artifact-button" data-id="' + escapeHtml(artifact.id) + '" aria-current="' + String(state.selectedArtifactId === artifact.id) + '">' +
    '<span class="artifact-path">' + escapeHtml(artifact.path) + '</span>' +
    '<span class="artifact-meta">' + escapeHtml(artifact.category) + ' - ' + escapeHtml(artifact.size) + ' bytes - open ' + escapeHtml(artifact.openTaskCount) + '</span>' +
    '</button>'
  ).join("");
}

async function selectArtifact(id) {
  state.selectedArtifactId = id;
  renderArtifactList(state.summary);
  elements.detailMeta.textContent = "Loading artifact preview...";
  elements.detailPreview.textContent = "";
  try {
    const response = await fetch("/api/artifact?id=" + encodeURIComponent(id), { cache: "no-store", headers: apiHeaders() });
    const detail = await response.json();
    if (!response.ok || !detail.ok) {
      throw new Error(detail.error || "artifact detail failed");
    }
    elements.detailMeta.textContent = detail.artifact.path + " - " + detail.artifact.category;
    elements.detailPreview.textContent = detail.preview || "Preview unavailable for this file.";
  } catch (error) {
    elements.detailMeta.textContent = "Artifact preview failed.";
    elements.detailPreview.textContent = error instanceof Error ? error.message : String(error);
  }
}

function render() {
  const summary = state.summary;
  if (!summary) {
    return;
  }
  state.lastRenderedSignature = summary.signature;
  renderCounts(summary);
  renderScanHealth(summary);
  renderCategoryTable(summary);
  renderChart(summary);
  renderOpenWork(summary);
  renderBundleHealth(summary);
  renderDashboardBoundary(summary);
  renderCategories(summary);
  renderArtifactList(summary);
}

function applyTheme(theme) {
  const resolved = theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = resolved;
  elements.theme.setAttribute("aria-label", "Switch to " + (resolved === "dark" ? "light" : "dark") + " theme");
  elements.theme.title = elements.theme.getAttribute("aria-label");
  if (state.summary) {
    state.lastChartSignature = "";
    renderChart(state.summary);
  }
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  applyTheme(stored);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(null);
    }
  });
}

function connectEvents() {
  if (!window.EventSource) {
    setLiveMessage("EventSource unavailable; use manual refresh.");
    return;
  }
  const source = new EventSource(withApiToken("/api/events"));
  source.addEventListener("ready", () => setConnection("live"));
  source.addEventListener("heartbeat", () => setConnection("live"));
  source.addEventListener("summary", (event) => {
    applySummary(JSON.parse(event.data), "Live artifact summary changed.");
  });
  source.onerror = () => {
    setConnection("offline");
    setLiveMessage("Live connection offline. Browser will retry automatically.");
  };
}

elements.refresh.addEventListener("click", async () => {
  try {
    applySummary(await fetchSummary(true), "Manual refresh complete.");
  } catch (error) {
    setConnection("offline");
    setLiveMessage(error instanceof Error ? error.message : String(error));
  }
});

elements.theme.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

elements.search.addEventListener("input", () => {
  state.search = elements.search.value;
  renderArtifactList(state.summary);
});

elements.categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.category = button.dataset.category || "all";
  renderCategories(state.summary);
  renderArtifactList(state.summary);
});

elements.artifactList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  selectArtifact(button.dataset.id);
});

elements.artifactList.addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  const buttons = Array.from(elements.artifactList.querySelectorAll("button[data-id]"));
  const index = buttons.indexOf(document.activeElement);
  if (index === -1) return;
  event.preventDefault();
  const nextIndex = event.key === "ArrowDown" ? Math.min(buttons.length - 1, index + 1) : Math.max(0, index - 1);
  buttons[nextIndex].focus();
});

initTheme();
loadCachedSummary();
fetchSummary(false)
  .then((summary) => applySummary(summary, "Dashboard summary loaded."))
  .catch((error) => {
    setConnection("offline");
    setLiveMessage(error instanceof Error ? error.message : String(error));
  });
connectEvents();
`;
}

function buildChartAdapter(): string {
  return `(function (global) {
  "use strict";

  function Chart(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext ? canvas.getContext("2d") : null;
    this.config = config || {};
    this.data = this.config.data || { labels: [], datasets: [{ data: [] }] };
    this.options = this.config.options || {};
    this.update();
  }

  Chart.prototype.update = function () {
    if (!this.ctx) return;
    var labels = this.data.labels || [];
    var dataset = (this.data.datasets && this.data.datasets[0]) || { data: [] };
    var values = dataset.data || [];
    var colors = dataset.backgroundColor || [];
    var width = this.canvas.clientWidth || 640;
    var height = this.canvas.clientHeight || 220;
    var ratio = global.devicePixelRatio || 1;
    this.canvas.width = width * ratio;
    this.canvas.height = height * ratio;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    var max = Math.max.apply(null, values.concat([1]));
    var barGap = 10;
    var barWidth = Math.max(20, (width - barGap * (values.length + 1)) / Math.max(1, values.length));
    for (var index = 0; index < values.length; index += 1) {
      var barHeight = Math.max(4, (height - 48) * (values[index] / max));
      var x = barGap + index * (barWidth + barGap);
      var y = height - barHeight - 28;
      this.ctx.fillStyle = colors[index] || "#2563eb";
      this.ctx.fillRect(x, y, barWidth, barHeight);
      this.ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim() || "#111827";
      this.ctx.font = "12px system-ui";
      this.ctx.fillText(String(values[index]), x, y - 6);
      this.ctx.fillText(String(labels[index] || "").slice(0, 12), x, height - 8);
    }
  };

  Chart.prototype.destroy = function () {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };

  global.Chart = Chart;
})(window);
`;
}

function buildStartDashboardScript(): string {
  return `$ErrorActionPreference = "Stop"
$DashboardPath = Split-Path -Parent $PSScriptRoot
$Port = if ($env:LIVE_ARTIFACTS_PORT) { [int]$env:LIVE_ARTIFACTS_PORT } else { ${DEFAULT_LIVE_ARTIFACTS_PORT} }
$HealthUrl = "http://127.0.0.1:$Port/api/health"

try {
  $response = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2
  if ($response.ok -eq $true) {
    Write-Host "Live artifacts dashboard is already running at $HealthUrl"
    exit 0
  }
} catch {
  # Not running yet.
}

$Logs = Join-Path $DashboardPath "logs"
New-Item -ItemType Directory -Path $Logs -Force | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogPath = Join-Path $Logs "server_$Stamp.log"
Start-Process -FilePath "node" -ArgumentList "server.js --port $Port" -WorkingDirectory $DashboardPath -RedirectStandardOutput $LogPath -RedirectStandardError $LogPath -WindowStyle Hidden
Write-Host "Live artifacts dashboard started at http://127.0.0.1:$Port"
`;
}

function buildInstallStartupScript(
  params: WorkspaceInitParams,
  projectSlug: string
): string {
  const taskName = `${params.workspaceName} Live Artifacts Dashboard`;
  return `$ErrorActionPreference = "Stop"
$TaskName = ${JSON.stringify(taskName)}
$ScriptPath = Join-Path $PSScriptRoot "start-dashboard.ps1"
$StartupCmd = Join-Path ([Environment]::GetFolderPath("Startup")) "${projectSlug}-live-artifacts-dashboard.cmd"

try {
  $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $ScriptPath + '"')
  $Trigger = New-ScheduledTaskTrigger -AtLogOn
  Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Description "Starts the local live artifacts dashboard." -Force | Out-Null
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Installed scheduled task: $TaskName"
} catch {
  $CmdContent = "@echo off" + [Environment]::NewLine + 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $ScriptPath + '"' + [Environment]::NewLine
  $CmdContent | Set-Content -LiteralPath $StartupCmd -Encoding ASCII
  Write-Host "Scheduled task failed; installed Startup fallback: $StartupCmd"
}
`;
}

function buildUninstallStartupScript(
  params: WorkspaceInitParams,
  projectSlug: string
): string {
  const taskName = `${params.workspaceName} Live Artifacts Dashboard`;
  return `$ErrorActionPreference = "Stop"
$TaskName = ${JSON.stringify(taskName)}
$StartupCmd = Join-Path ([Environment]::GetFolderPath("Startup")) "${projectSlug}-live-artifacts-dashboard.cmd"

try {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed scheduled task if present: $TaskName"
} catch {
  Write-Host "Scheduled task removal failed: $($_.Exception.Message)"
}

Remove-Item -LiteralPath $StartupCmd -Force -ErrorAction SilentlyContinue
Write-Host "Removed Startup fallback if present: $StartupCmd"
`;
}

function buildGovernanceIndex(params: WorkspaceInitParams): string {
  return `# Governance Index

<!-- LIVE_ARTIFACTS_DASHBOARD_START -->

## Live Artifacts Dashboard

- Dashboard path: \`live-artifacts-dashboard/\`
- Dashboard URL: \`http://127.0.0.1:${DEFAULT_LIVE_ARTIFACTS_PORT}\`
- Manager agent: \`.agents/live-artifacts-manager.md\`
- Query agent: \`.agents/live-artifacts-query.md\`
- Runtime state: \`live-artifacts-dashboard/.state/\`
- Logs: \`live-artifacts-dashboard/logs/\`

## Operating Rules

- Track active open work from AGENTS, GitHub instructions, \`.agents\`, \`.governance/backlog\`, and \`.governance/plans\`.
- Treat archived unchecked items under sessions, reviews, decisions, specs, reports, and report folders as review debt.
- Keep \`docs/ai-harness/dashboard/state/dashboard-state.json\` as the canonical admin dashboard state; live artifacts is a real-time observer, not a fork of that state.
- Treat \`.governance/\` as live-dashboard intake and staging. Canonical long-lived ledgers stay under \`docs/plans/\`, \`docs/reviews/\`, \`docs/contracts/\`, \`docs/evaluations/\`, and \`docs/handovers/\`.
- Never store secrets, raw tokens, or private key material in dashboard summary, preview, or logs.
- Keep the dashboard localhost-only unless an operator writes an explicit networking decision.

<!-- LIVE_ARTIFACTS_DASHBOARD_END -->
`;
}

function buildProjectState(params: WorkspaceInitParams, projectSlug: string): string {
  return `# Project State

<!-- LIVE_ARTIFACTS_DASHBOARD_START -->

## Live Artifacts Dashboard State

- Project: ${params.workspaceName}
- Slug: ${projectSlug}
- Purpose: ${params.purpose}
- Port: ${DEFAULT_LIVE_ARTIFACTS_PORT}
- URL: http://127.0.0.1:${DEFAULT_LIVE_ARTIFACTS_PORT}
- Theme storage key: \`${projectSlug}:liveArtifacts:theme\`
- Summary storage key: \`${projectSlug}:liveArtifacts:summary\`
- Runtime output policy: dashboard writes only under \`live-artifacts-dashboard/.state/\` and \`live-artifacts-dashboard/logs/\`.

## Current Governance Status

- Status: bootstrap
- Next action: run \`npm --prefix live-artifacts-dashboard run health\`, then start the dashboard for live artifact review.
- Startup installation: not installed by default.

<!-- LIVE_ARTIFACTS_DASHBOARD_END -->
`;
}

function buildGovernanceDoc(title: string, body: string): string {
  return `# ${title}

${body}
`;
}

function buildAgentDoc(kind: "manager" | "query", projectSlug: string): string {
  if (kind === "manager") {
    return `# ${projectSlug}-live-artifacts-manager

## Role

Maintain the local live artifacts dashboard, governance documents, scan policy, and validation workflow.

## Responsibilities

- Keep \`live-artifacts-dashboard/server.js\`, \`public/\`, and \`scripts/\` aligned with the project governance policy.
- Preserve user source files and never widen generated ownership into application code.
- Run \`npm --prefix live-artifacts-dashboard run check\` and \`npm --prefix live-artifacts-dashboard run health\` after dashboard changes.
- Watch for design drift: theme tokens, accessibility names, keyboard navigation, and chart text fallback are required.

## Forbidden

- Do not add CDN dependencies.
- Do not store secrets or raw credentials in summary, preview, state, or logs.
- Do not rewrite existing governance sections outside the live artifacts markers.
`;
  }

  return `# ${projectSlug}-live-artifacts-query

## Role

Query and summarize live dashboard state without modifying project files.

## Query Flow

1. Read \`GET /api/health\`.
2. Read \`GET /api/summary\` for a non-mutating scan snapshot.
3. Use \`POST /api/summary/refresh\` only when a local operator explicitly wants to persist latest summary and history.
4. Use \`GET /api/artifacts?openOnly=true\` for active open tasks.
5. Use \`GET /api/artifact?id=...\` only with ids returned by summary or artifacts APIs.

## Reporting

- Summarize active open tasks, archived unchecked items, report bundles, governance bundle status, and git dirty state.
- Report API failures as unknown rather than assuming success.
`;
}

function buildLiveArtifactsGuide(params: WorkspaceInitParams, projectSlug: string): string {
  return `# Live Artifacts Dashboard

This workspace includes a local live artifacts dashboard generated by workspace-init-mcp.

## URL

- \`http://127.0.0.1:${DEFAULT_LIVE_ARTIFACTS_PORT}\`

## Commands

\`\`\`bash
npm --prefix live-artifacts-dashboard run check
npm --prefix live-artifacts-dashboard run health
npm --prefix live-artifacts-dashboard start
\`\`\`

## API

- \`GET /api/health\`
- \`GET /api/summary\`
- \`POST /api/summary/refresh\`
- \`GET /api/artifacts\`
- \`GET /api/artifacts?openOnly=true\`
- \`GET /api/artifact?id=...\`
- \`GET /api/events\`

## Governance Integration

- Manager agent: \`.agents/live-artifacts-manager.md\`
- Query agent: \`.agents/live-artifacts-query.md\`
- Governance index: \`.governance/_INDEX.md\`
- Project state: \`.governance/_PROJECT_STATE.md\`
- Theme storage key: \`${projectSlug}:liveArtifacts:theme\`
- Summary storage key: \`${projectSlug}:liveArtifacts:summary\`

## Boundary With Admin Dashboard

- Admin dashboard: \`docs/ai-harness/dashboard/\` owns curated governance state, runtime orchestration, KPI state, server operations health, and exportable stakeholder snapshots.
- Live artifacts dashboard: \`live-artifacts-dashboard/\` owns localhost real-time artifact discovery, open marker tracking, archived unchecked visibility, and file previews by generated artifact id.
- Governance intake: \`.governance/\` is a live-dashboard staging surface. Canonical durable ledgers remain in \`docs/plans/\`, \`docs/reviews/\`, \`docs/contracts/\`, \`docs/evaluations/\`, and \`docs/handovers/\`.
- Default ports are intentionally separate: admin serve uses \`43110\`, live artifacts uses \`${DEFAULT_LIVE_ARTIFACTS_PORT}\`.
- Default scan roots stay inside governance, harness, and documentation evidence folders. Set \`LIVE_ARTIFACTS_SCAN_ROOTS\` only when an operator explicitly widens evidence intake.
- Source previews are disabled by default. Set \`LIVE_ARTIFACTS_SOURCE_PREVIEW=1\` only for trusted local review.

The dashboard is a harness overlay for ${params.workspaceName}. It may scan project files for evidence, but workspace-init-mcp must not delete, move, truncate, or replace legacy application source.
`;
}

export function generateLiveArtifactsDashboardFiles(
  params: WorkspaceInitParams
): GeneratedFile[] {
  if (params.includeHarnessEngineering === false) {
    return [];
  }

  const projectSlug = slugify(params.workspaceName);
  const stamp = dateStamp();

  return [
    {
      relativePath: "live-artifacts-dashboard/package.json",
      content: buildLiveDashboardPackage(),
    },
    {
      relativePath: "live-artifacts-dashboard/server.js",
      content: buildLiveDashboardServer(params, projectSlug),
    },
    {
      relativePath: "live-artifacts-dashboard/.gitignore",
      content: buildLiveDashboardGitignore(),
    },
    {
      relativePath: "live-artifacts-dashboard/public/index.html",
      content: buildLiveDashboardHtml(params),
    },
    {
      relativePath: "live-artifacts-dashboard/public/styles.css",
      content: buildLiveDashboardStyles(),
    },
    {
      relativePath: "live-artifacts-dashboard/public/app.js",
      content: buildLiveDashboardApp(projectSlug),
    },
    {
      relativePath: "live-artifacts-dashboard/public/vendor/chart.umd.js",
      content: buildChartAdapter(),
    },
    {
      relativePath: "live-artifacts-dashboard/scripts/start-dashboard.ps1",
      content: buildStartDashboardScript(),
    },
    {
      relativePath: "live-artifacts-dashboard/scripts/install-windows-startup.ps1",
      content: buildInstallStartupScript(params, projectSlug),
    },
    {
      relativePath: "live-artifacts-dashboard/scripts/uninstall-windows-startup.ps1",
      content: buildUninstallStartupScript(params, projectSlug),
    },
    {
      relativePath: ".governance/_INDEX.md",
      content: buildGovernanceIndex(params),
    },
    {
      relativePath: ".governance/_PROJECT_STATE.md",
      content: buildProjectState(params, projectSlug),
    },
    {
      relativePath: `.governance/specs/FS001_${stamp}_${projectSlug}_LiveArtifacts_운영명세.md`,
      content: buildGovernanceDoc(
        "Live Artifacts 운영 명세",
        "The live artifacts dashboard scans governed documents, open task markers, archived unchecked items, report bundles, and git state without modifying application source."
      ),
    },
    {
      relativePath: `.governance/decisions/D001_${stamp}_LiveArtifacts_포트_스캔정책_ADR.md`,
      content: buildGovernanceDoc(
        "Live Artifacts 포트 및 스캔 정책 ADR",
        `Decision: bind the dashboard to 127.0.0.1:${DEFAULT_LIVE_ARTIFACTS_PORT}, keep CORS disabled, scan with bounded file count and file size limits, and expose detail previews only through generated artifact ids.`
      ),
    },
    {
      relativePath: `.governance/sessions/S001_${stamp}_LiveArtifacts_대시보드_구현.md`,
      content: buildGovernanceDoc(
        "Live Artifacts 대시보드 구현 세션",
        "Bootstrap session for the local live artifacts dashboard. Replace this note with real operating evidence after the first run."
      ),
    },
    {
      relativePath: ".governance/reviews/README.md",
      content: buildGovernanceDoc("Governance Reviews Intake", "Use this folder for live-dashboard review intake and unresolved review signals. Canonical review ledgers belong in `docs/reviews/`."),
    },
    {
      relativePath: ".governance/reports/README.md",
      content: buildGovernanceDoc("Governance Reports Intake", "Use this folder for report bundles that the live dashboard should surface. Canonical stakeholder dashboard snapshots belong under `docs/ai-harness/dashboard/exports/` when exported."),
    },
    {
      relativePath: ".governance/backlog/README.md",
      content: buildGovernanceDoc("Governance Backlog Intake", "Track live-dashboard open governance signals here. Use `- [ ]` checkboxes for visibility, then promote durable plans, reviews, contracts, and handovers into `docs/` ledgers."),
    },
    {
      relativePath: ".governance/plans/README.md",
      content: buildGovernanceDoc("Governance Plans Intake", "Use this folder for active live-dashboard planning signals and parallel chunk intake. Canonical approved plans belong in `docs/plans/`."),
    },
    {
      relativePath: ".agents/live-artifacts-manager.md",
      content: buildAgentDoc("manager", projectSlug),
    },
    {
      relativePath: ".agents/live-artifacts-query.md",
      content: buildAgentDoc("query", projectSlug),
    },
    {
      relativePath: "docs/ai-harness/live-artifacts-dashboard.md",
      content: buildLiveArtifactsGuide(params, projectSlug),
    },
  ];
}
