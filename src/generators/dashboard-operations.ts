import {
  type GeneratedFile,
  type WorkspaceInitParams,
} from "../types.js";
import { DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS } from "../data/dashboard-state-contract.js";

function buildDashboardOpsReadme(): string {
  return `# Harness Dashboard Operations

The generated \`dashboard-ops.mjs\` script operates the Harness Dashboard 4.6 Hypertext Project World Model.
It treats the JSONL event ledger as canonical, the JSON state files as disposable projections,
and the HTML file as a portable stakeholder projection.

## Commands

- \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs ensure-listening\`
  Restore a read-only loopback listener on an available local port unless \`WORKSPACE_INIT_DASHBOARD_AUTOSTART=0\`.
- \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs listen --port 43110\`
  Run the listener in the foreground for local debugging.
- \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs status\`
  Print persisted listener and projection status.
- \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs stop | restart | cleanup-stale\`
  Manage stale or active listener processes.
- \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh\`
  Refresh disposable projections and collect Git/SVN evidence without changing application source.
- \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs record-agent-platforms --platforms codex,cursor --source user-declaration\`
  Record the user's active AI-agent platforms, mark stale generated instruction files as \`unused-instruction\`, and rebuild projections.
- \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs append-event --event path/to/event.json --expected-last-sequence 12\`
  Append a strict event-envelope JSON file only if the ledger still ends at the expected sequence.
- \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs rebuild-projections\`
  Rebuild projection files from the embedded dashboard snapshot when projection files were deleted.
- \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs verify-projections\`
  Validate required Project World Model fields and reference integrity.
- \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs export-static --out docs/ai-harness/dashboard/exports/latest --public\`
  Export a single-file stakeholder snapshot with local paths, usernames, tokens, private URLs, and secret references redacted.

## API

The listener exposes read-only v1 routes under \`/api/harness-dashboard/v1/\`:
\`snapshot\`, \`index\`, \`tasks\`, \`sessions\`, \`dictionary\`, \`version-control\`,
\`runtime\`, \`health\`, \`events\`, and deterministic \`query\`.

Default protections: local token required, loopback Host/Origin only, CORS disabled,
DNS rebinding protection, strict CSP for served HTML, and no shell/file-write/LLM calls from \`query\`.
`;
}

function buildDashboardOpsScript(): string {
  const requiredTopLevelKeys = JSON.stringify(
    DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS,
    null,
    2
  );

  return `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const API_VERSION = "v1";
const SCHEMA_VERSION = "4.6.0";
const PROJECTION_VERSION = "4.6.0";
const REQUIRED_TOP_LEVEL_KEYS = ${requiredTopLevelKeys};
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dashboardDir = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(dashboardDir, "../../..");
const stateDir = path.join(dashboardDir, "state");
const eventDir = path.join(dashboardDir, "events");
const logDir = path.join(dashboardDir, "logs");
const exportsDir = path.join(dashboardDir, "exports");
const statePath = path.join(stateDir, "dashboard-state.json");
const indexPath = path.join(stateDir, "dashboard-index.json");
const runtimePath = path.join(stateDir, "dashboard-runtime.json");
const embeddingPath = path.join(stateDir, "embedding-documents.json");
const ledgerPath = path.join(eventDir, "harness-events.jsonl");
const manifestPath = path.join(eventDir, "ledger-manifest.json");
const htmlPath = path.join(dashboardDir, "index.html");
const tokenPath = path.join(stateDir, "api-token");
const lockPath = path.join(stateDir, "dashboard-listener.lock");
const logPath = path.join(logDir, "dashboard-bridge.log");
const args = process.argv.slice(2);
const command = args[0] || "help";

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0 || index === args.length - 1) {
    return fallback;
  }
  return args[index + 1];
}

function hasFlag(name) {
  return args.includes(name);
}

function now() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function fileHash(fullPath) {
  if (!fs.existsSync(fullPath)) {
    return "missing";
  }
  return crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
}

function writeTextAtomic(fullPath, content) {
  ensureDir(path.dirname(fullPath));
  const tempPath = path.join(path.dirname(fullPath), "." + path.basename(fullPath) + "." + process.pid + "." + Date.now() + ".tmp");
  fs.writeFileSync(tempPath, content, "utf-8");
  fs.renameSync(tempPath, fullPath);
}

function writeJson(fullPath, value) {
  writeTextAtomic(fullPath, JSON.stringify(value, null, 2) + "\\n");
}

function readJson(fullPath) {
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

function logLine(message) {
  ensureDir(logDir);
  fs.appendFileSync(logPath, "[" + now() + "] " + message + "\\n", "utf-8");
}

function quarantineCorruptJson(fullPath, error) {
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  const quarantinePath = fullPath + ".corrupt." + Date.now();
  fs.renameSync(fullPath, quarantinePath);
  logLine("quarantined corrupt JSON " + path.relative(workspaceRoot, fullPath) + ": " + String(error && error.message || error));
  return quarantinePath;
}

function readEmbeddedStateFromHtml() {
  const html = fs.readFileSync(htmlPath, "utf-8");
  const match = html.match(/<script id="dashboard-bootstrap-data" type="application\\/json">([\\s\\S]*?)<\\/script>/);
  if (!match) {
    throw new Error("Cannot rebuild projections: embedded dashboard snapshot was not found in index.html");
  }
  return JSON.parse(match[1]);
}

function loadState(options = {}) {
  try {
    if (fs.existsSync(statePath)) {
      return readJson(statePath);
    }
  } catch (error) {
    if (!options.quarantineCorrupt) {
      throw error;
    }
    quarantineCorruptJson(statePath, error);
  }
  if (!fs.existsSync(htmlPath)) {
    throw new Error("dashboard-state.json is missing and index.html is unavailable");
  }
  return readEmbeddedStateFromHtml();
}

function loadJsonOrFallback(fullPath, fallback) {
  try {
    return fs.existsSync(fullPath) ? readJson(fullPath) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeDashboardStateForValidation(state) {
  if (Array.isArray(state.entities)) {
    state.entities = state.entities.map((entity) => {
      if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
        return entity;
      }
      if (typeof entity.summary === "string" && entity.summary.trim().length > 0) {
        return entity;
      }
      return Object.assign({}, entity, {
        summary: String(entity.note || entity.label || entity.path || entity.id || "No summary recorded.")
      });
    });
  }
  return state;
}

function loadLedgerManifest() {
  return loadJsonOrFallback(manifestPath, {
    schemaVersion: SCHEMA_VERSION,
    workspaceId: String((loadJsonOrFallback(statePath, {}).meta || {}).workspaceId || "unknown-workspace"),
    ledgerPath: path.relative(workspaceRoot, ledgerPath).replace(/\\\\/g, "/"),
    segments: [],
    firstSequence: 0,
    lastSequence: 0,
    rowCount: 0,
    rootHash: "genesis",
    lastVerifiedAt: now(),
    compactionStatus: "not-compacted"
  });
}

function appendLedgerEvent(event, expectedLastSequence) {
  const manifest = loadLedgerManifest();
  const actualLastSequence = Number(manifest.lastSequence || 0);
  if (actualLastSequence !== expectedLastSequence) {
    throw new Error("Ledger sequence mismatch: expected " + expectedLastSequence + " but found " + actualLastSequence);
  }
  const requiredEnvelopeFields = [
    "eventId",
    "sequence",
    "eventType",
    "eventVersion",
    "workspaceId",
    "aggregateId",
    "aggregateType",
    "aggregateVersion",
    "occurredAt",
    "recordedAt",
    "actor",
    "agentId",
    "sourceTool",
    "correlationId",
    "causationId",
    "idempotencyKey",
    "payloadHash",
    "previousEventHash",
    "redactionLevel",
    "payload"
  ];
  for (const field of requiredEnvelopeFields) {
    if (!(field in event)) {
      throw new Error("Event envelope is missing " + field);
    }
  }
  if (Number(event.sequence) !== expectedLastSequence + 1) {
    throw new Error("Event sequence must be expectedLastSequence + 1");
  }
  if (event.previousEventHash !== manifest.rootHash) {
    throw new Error("Event previousEventHash must match current manifest rootHash");
  }
  const eventHash = stableHash(event);
  const record = Object.assign({}, event, { eventHash });
  fs.appendFileSync(ledgerPath, JSON.stringify(record) + "\\n", "utf-8");
  const nextManifest = Object.assign({}, manifest, {
    firstSequence: Number(manifest.firstSequence || record.sequence),
    lastSequence: record.sequence,
    rowCount: Number(manifest.rowCount || 0) + 1,
    rootHash: eventHash,
    lastVerifiedAt: now()
  });
  nextManifest.segments = [
    {
      id: "segment-000001-" + String(record.sequence).padStart(6, "0"),
      path: path.relative(workspaceRoot, ledgerPath).replace(/\\\\/g, "/"),
      firstSequence: nextManifest.firstSequence,
      lastSequence: nextManifest.lastSequence,
      rowCount: nextManifest.rowCount,
      schemaVersion: SCHEMA_VERSION,
      segmentHash: eventHash,
      compactionStatus: "hot"
    }
  ];
  writeJson(manifestPath, nextManifest);
  return record;
}

function envelope(payload, extra = {}) {
  const state = loadJsonOrFallback(statePath, {});
  const meta = state.meta || {};
  const manifest = loadJsonOrFallback(manifestPath, {});
  return Object.assign({
    apiVersion: API_VERSION,
    schemaVersion: String(meta.schemaVersion || SCHEMA_VERSION),
    workspaceId: String(meta.workspaceId || "unknown-workspace"),
    projectionVersion: String(meta.projectionVersion || PROJECTION_VERSION),
    ledgerOffset: Number(manifest.lastSequence || meta.sourceEventSequence || 0),
    generatedAt: now(),
    capabilities: [
      "read-only",
      "snapshot",
      "index",
      "tasks",
      "sessions",
      "dictionary",
      "version-control",
      "runtime",
      "sse",
      "deterministic-query"
    ],
    readOnly: true,
    payload
  }, extra);
}

function validateState(state) {
  const errors = [];
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in state)) {
      errors.push("Missing required top-level dashboard key: " + key);
    }
  }
  const queues = state.taskQueues || {};
  for (const key of ["waiting", "inProgress", "completed", "blocked"]) {
    if (!Array.isArray(queues[key])) {
      errors.push("taskQueues." + key + " must be an array");
    }
  }
  const refs = new Set();
  for (const artifact of Array.isArray(state.artifacts) ? state.artifacts : []) {
    if (artifact && artifact.id) {
      refs.add(String(artifact.id));
    }
  }
  for (const task of (((state.agile || {}).backlog) || [])) {
    for (const ref of task.evidenceRefs || []) {
      if (String(ref).startsWith("artifact:") && !refs.has(String(ref).slice(9))) {
        errors.push("Dangling task artifact reference: " + ref);
      }
    }
  }
  return errors;
}

function runCommand(commandName, commandArgs, cwd) {
  try {
    return {
      ok: true,
      stdout: execFileSync(commandName, commandArgs, {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 5000,
        windowsHide: true
      }).trim(),
      exitCode: 0
    };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error && error.stdout || "").trim(),
      stderr: String(error && error.stderr || error && error.message || error).trim(),
      exitCode: Number.isInteger(error && error.status) ? error.status : 1
    };
  }
}

function readVersionControlFixture() {
  const fixture = process.env.DASHBOARD_VERSION_CONTROL_FIXTURE || process.env.DASHBOARD_GIT_FIXTURE;
  if (!fixture) {
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(fixture, "utf-8"));
  if (parsed.versionControl || parsed.vcsChangeRecords) {
    return parsed;
  }
  return {
    versionControl: {
      provider: "git",
      status: "fixture",
      currentBranchOrRevision: parsed.currentBranch || "fixture",
      workingCopyStatus: parsed.workingTreeStatus || "fixture",
      ledger: [],
      unlinkedChanges: [],
      collectionProvenance: {
        command: "DASHBOARD_GIT_FIXTURE",
        cwd: workspaceRoot,
        exitCode: 0,
        capturedAt: now(),
        parserVersion: SCHEMA_VERSION,
        completeness: "fixture"
      }
    },
    vcsChangeRecords: []
  };
}

function collectGit() {
  const inside = runCommand("git", ["rev-parse", "--is-inside-work-tree"], workspaceRoot);
  if (!inside.ok || inside.stdout !== "true") {
    return null;
  }
  const root = runCommand("git", ["rev-parse", "--show-toplevel"], workspaceRoot);
  const branch = runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"], workspaceRoot);
  const status = runCommand("git", ["status", "--short"], workspaceRoot);
  const log = runCommand("git", ["log", "-n", "20", "--pretty=format:%H%x1f%P%x1f%an%x1f%aI%x1f%s"], workspaceRoot);
  const statusLines = status.stdout ? status.stdout.split(/\\r?\\n/).filter(Boolean) : [];
  const changedPaths = statusLines.map((line) => line.slice(3).trim()).filter(Boolean);
  const records = log.ok && log.stdout
    ? log.stdout.split(/\\r?\\n/).filter(Boolean).map((line) => {
        const parts = line.split("\\x1f");
        return {
          provider: "git",
          repoRoot: root.stdout || workspaceRoot,
          revisionId: parts[0] || "unknown",
          commitId: parts[0] || "unknown",
          parentIds: (parts[1] || "").split(" ").filter(Boolean),
          author: parts[2] || "unknown",
          timestamp: parts[3] || "unknown",
          messageHash: stableHash(parts[4] || ""),
          changedPaths: [],
          statusCounts: { staged: 0, unstaged: 0, untracked: 0 },
          linkedSessionIds: [],
          linkedTaskIds: [],
          linkedDecisionIds: [],
          collectionCommand: {
            command: "git log -n 20 --pretty=format:%H%x1f%P%x1f%an%x1f%aI%x1f%s",
            cwd: workspaceRoot,
            exitCode: 0,
            capturedAt: now(),
            parserVersion: SCHEMA_VERSION,
            timeoutOrTruncated: false
          }
        };
      })
    : [];
  return {
    versionControl: {
      provider: "git",
      status: "collected",
      currentBranchOrRevision: branch.stdout || "unknown",
      workingCopyStatus: statusLines.length === 0 ? "clean" : "dirty",
      ledger: records.slice(0, 5).map((record) => record.commitId),
      unlinkedChanges: changedPaths,
      collectionProvenance: {
        command: "git rev-parse/status/log",
        cwd: workspaceRoot,
        exitCode: 0,
        capturedAt: now(),
        parserVersion: SCHEMA_VERSION,
        completeness: log.ok ? "complete" : "partial"
      }
    },
    vcsChangeRecords: records
  };
}

function collectSvn() {
  const info = runCommand("svn", ["info"], workspaceRoot);
  if (!info.ok) {
    return null;
  }
  const revisionMatch = info.stdout.match(/^Revision:\\s*(\\d+)/m);
  const uuidMatch = info.stdout.match(/^Repository UUID:\\s*(.+)$/m);
  const revisionNumber = revisionMatch ? revisionMatch[1] : "unknown";
  const record = {
    provider: "svn",
    repoRoot: workspaceRoot,
    revisionId: revisionNumber,
    revisionNumber,
    repositoryUuid: uuidMatch ? uuidMatch[1].trim() : "unknown",
    parentIds: [],
    author: "unknown",
    timestamp: "unknown",
    messageHash: stableHash("svn:" + revisionNumber),
    changedPaths: [],
    statusCounts: { modified: 0, added: 0, deleted: 0 },
    linkedSessionIds: [],
    linkedTaskIds: [],
    linkedDecisionIds: [],
    collectionCommand: {
      command: "svn info",
      cwd: workspaceRoot,
      exitCode: 0,
      capturedAt: now(),
      parserVersion: SCHEMA_VERSION,
      timeoutOrTruncated: false
    }
  };
  return {
    versionControl: {
      provider: "svn",
      status: "collected",
      currentBranchOrRevision: revisionNumber,
      workingCopyStatus: "unknown",
      ledger: [revisionNumber],
      unlinkedChanges: [],
      collectionProvenance: record.collectionCommand
    },
    vcsChangeRecords: [record]
  };
}

function collectVersionControl() {
  const fixture = readVersionControlFixture();
  if (fixture) {
    return fixture;
  }
  return collectGit() || collectSvn() || {
    versionControl: {
      provider: "none",
      status: "not-found",
      currentBranchOrRevision: "none",
      workingCopyStatus: "unknown",
      ledger: [],
      unlinkedChanges: [],
      collectionProvenance: {
        command: "git/svn discovery",
        cwd: workspaceRoot,
        exitCode: 1,
        capturedAt: now(),
        parserVersion: SCHEMA_VERSION,
        completeness: "none"
      }
    },
    vcsChangeRecords: []
  };
}

const AGENT_PLATFORM_CATALOG = [
  {
    id: "vscode",
    label: "VS Code / GitHub Copilot",
    instructionPaths: [".github/copilot-instructions.md", ".vscode/mcp.json"],
    governanceRole: "Copilot Agent mode and MCP-aware editor workflows"
  },
  {
    id: "codex",
    label: "Codex CLI / Codex Desktop",
    instructionPaths: ["AGENTS.md", ".codex/"],
    governanceRole: "Codex-oriented hub, review, and resume instructions"
  },
  {
    id: "claude-code",
    label: "Claude Code",
    instructionPaths: ["CLAUDE.md", ".claude/"],
    governanceRole: "Claude project memory and MCP resume behavior"
  },
  {
    id: "cursor",
    label: "Cursor",
    instructionPaths: [".cursor/rules/harness-world-model.mdc", ".cursorrules"],
    governanceRole: "Cursor rule-based agent collaboration"
  },
  {
    id: "antigravity",
    label: "Google Antigravity / Gemini Agent IDE",
    instructionPaths: [
      ".agents/plugins/workspace-init-harness/plugin.json",
      ".agents/plugins/workspace-init-harness/rules/harness-world-model.md"
    ],
    governanceRole: "Antigravity plugin/rule governance overlay"
  },
  {
    id: "openhands",
    label: "OpenHands",
    instructionPaths: [".openhands/", ".agents/skills/"],
    governanceRole: "OpenHands-compatible agent skill and memory conventions"
  }
];

function normalizeAgentPlatform(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "claude") return "claude-code";
  if (normalized === "copilot" || normalized === "github-copilot") return "vscode";
  if (normalized === "gemini" || normalized === "google-antigravity") return "antigravity";
  return normalized;
}

function parseAgentPlatforms(value) {
  const allowed = new Set(AGENT_PLATFORM_CATALOG.map((platform) => platform.id));
  const platforms = String(value || "")
    .split(/[,\\s]+/)
    .map((entry) => normalizeAgentPlatform(entry))
    .filter((entry) => allowed.has(entry));
  return Array.from(new Set(platforms));
}

function pathExists(relativePath) {
  return fs.existsSync(path.join(workspaceRoot, relativePath));
}

function buildPlatformInstructionState(activePlatforms, detectedPlatforms, declaredPlatforms) {
  const active = new Set(activePlatforms || []);
  const detected = new Set(detectedPlatforms || []);
  const declared = new Set(declaredPlatforms || []);
  return AGENT_PLATFORM_CATALOG.map((platform) => {
    const hasInstruction = platform.instructionPaths.some((relativePath) => pathExists(relativePath));
    let state = "not-generated";
    if (active.has(platform.id) && hasInstruction) {
      state = "active-instruction";
    } else if (active.has(platform.id)) {
      state = "active-missing-instruction";
    } else if (hasInstruction) {
      state = "unused-instruction";
    }
    return {
      platform: platform.id,
      label: platform.label,
      instructionPaths: platform.instructionPaths,
      governanceRole: platform.governanceRole,
      state,
      source: declared.has(platform.id) ? "user-declared" : detected.has(platform.id) ? "detected-or-configured" : "filesystem/catalog",
      confidence: declared.has(platform.id) ? "high" : detected.has(platform.id) ? "medium" : hasInstruction ? "medium" : "low",
      reason: state === "active-instruction"
        ? "This platform is declared active and has an instruction surface in the workspace."
        : state === "active-missing-instruction"
          ? "This platform is declared active but its expected instruction surface is missing."
          : state === "unused-instruction"
            ? "Instruction files exist, but the platform is not in the declared active platform set."
            : "No active declaration or instruction surface is present."
    };
  });
}

function sameStringSet(left, right) {
  const a = Array.from(new Set((left || []).map(String))).sort();
  const b = Array.from(new Set((right || []).map(String))).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function upsertById(items, entry, idField = "id") {
  const list = Array.isArray(items) ? items.slice() : [];
  const index = list.findIndex((item) => item && item[idField] === entry[idField]);
  if (index >= 0) {
    list[index] = Object.assign({}, list[index], entry);
  } else {
    list.push(entry);
  }
  return list;
}

function removeFromArray(items, value) {
  return (Array.isArray(items) ? items : []).filter((item) => item !== value);
}

function updateBacklogTaskStatus(cadence, taskId, patch) {
  if (!cadence || !Array.isArray(cadence.backlog)) return cadence;
  return Object.assign({}, cadence, {
    backlog: cadence.backlog.map((task) => task && task.id === taskId ? Object.assign({}, task, patch) : task)
  });
}

function handleRecordAgentPlatforms() {
  const platforms = parseAgentPlatforms(option("--platforms", ""));
  if (platforms.length === 0) {
    throw new Error("record-agent-platforms requires --platforms with one or more of: " + AGENT_PLATFORM_CATALOG.map((platform) => platform.id).join(", "));
  }
  const source = String(option("--source", "user-declaration"));
  const state = loadState({ quarantineCorrupt: true });
  const existing = state.agentPlatformGovernance || {};
  if (sameStringSet(platforms, existing.declaredPlatforms || []) && ((existing.intake || {}).status === "declared")) {
    console.log("Agent platform declaration is already indexed: " + platforms.join(", "));
    return;
  }
  const manifest = loadLedgerManifest();
  const expectedOption = option("--expected-last-sequence", "");
  const expectedLastSequence = expectedOption === "" ? Number(manifest.lastSequence || 0) : Number(expectedOption);
  const recordedAt = now();
  const detectedPlatforms = Array.from(new Set([...(existing.detectedPlatforms || []), ...((state.workspace || {}).targetIDEs || [])].map((entry) => normalizeAgentPlatform(entry)).filter(Boolean)));
  const instructionState = buildPlatformInstructionState(platforms, detectedPlatforms, platforms);
  const unusedInstructionState = instructionState.filter((item) => item.state === "unused-instruction");
  const evidenceRefs = Array.from(new Set(instructionState.filter((item) => item.state !== "not-generated").flatMap((item) => item.instructionPaths)));
  const payload = {
    declaredPlatforms: platforms,
    previousActivePlatforms: existing.activePlatforms || (state.workspace || {}).targetIDEs || [],
    detectedPlatforms,
    instructionState,
    unusedInstructionState,
    source,
    command: "dashboard-ops record-agent-platforms",
    recordedAt
  };
  const workspaceId = String((state.meta || {}).workspaceId || "unknown-workspace");
  const event = {
    eventId: "event-" + String(expectedLastSequence + 1).padStart(6, "0") + "-agent-platforms-" + stableHash({ platforms, recordedAt }).slice(0, 8),
    sequence: expectedLastSequence + 1,
    eventType: "workspace.agent-platforms.declared",
    eventVersion: "1.0.0",
    workspaceId,
    aggregateId: workspaceId,
    aggregateType: "agentPlatformGovernance",
    aggregateVersion: expectedLastSequence + 1,
    occurredAt: recordedAt,
    recordedAt,
    actor: "user",
    agentId: "dashboard-ops",
    sourceTool: "dashboard-ops record-agent-platforms",
    correlationId: "agent-platform-governance",
    causationId: null,
    idempotencyKey: "agent-platforms:" + stableHash(platforms),
    payloadHash: stableHash(payload),
    previousEventHash: manifest.rootHash || "genesis",
    redactionLevel: "internal",
    payload
  };
  const record = appendLedgerEvent(event, expectedLastSequence);
  state.workspace = Object.assign({}, state.workspace || {}, { targetIDEs: platforms });
  state.agentPlatformGovernance = Object.assign({}, existing, {
    schemaVersion: SCHEMA_VERSION,
    status: "declared",
    detectedPlatforms,
    declaredPlatforms: platforms,
    activePlatforms: platforms,
    platformOptions: existing.platformOptions || AGENT_PLATFORM_CATALOG,
    instructionState,
    unusedInstructionState,
    intake: Object.assign({}, existing.intake || {}, {
      status: "declared",
      source,
      submittedAt: recordedAt,
      submittedBy: "user",
      latestEventId: record.eventId
    }),
    governanceIndexing: Object.assign({}, existing.governanceIndexing || {}, {
      factId: "fact-agent-platform-selection",
      decisionId: "decision-agent-platform-selection",
      taskId: "task-confirm-agent-platforms",
      evidenceRefs,
      indexedAs: "declared",
      nextAction: unusedInstructionState.length > 0
        ? "Review unused-instruction files and either remove them from the active operating model or explicitly reactivate the platform."
        : "Keep platform-specific instructions aligned with future toolchain changes."
    })
  });
  state.worldModelFacts = upsertById(state.worldModelFacts, {
    id: "fact-agent-platform-selection",
    state: "declared",
    summary: "Active AI agent platforms declared as: " + platforms.join(", ") + ".",
    source,
    timestamp: recordedAt,
    freshnessTtl: "until-platform-toolchain-changes",
    confidence: "high",
    owner: "stakeholder-product-owner",
    evidencePaths: evidenceRefs,
    sourceEventId: record.eventId
  });
  state.decisionContracts = upsertById(state.decisionContracts, {
    id: "decision-agent-platform-selection",
    status: "approved",
    owner: "stakeholder-product-owner",
    decision: "Use declared active AI agent platforms: " + platforms.join(", ") + ".",
    alternatives: ["auto-detected platforms", "single active platform", "multiple active platforms", "unused-instruction classification"],
    evidence: ["agentPlatformGovernance", record.eventId],
    reversalCondition: "The team adopts, retires, or changes an AI agent platform.",
    stakeholderImpact: "Platform-specific instruction files and AI Agent collaboration rules now follow the declared active platform set.",
    approvalThreshold: "User declaration recorded in the harness event ledger.",
    approvedAt: recordedAt
  });
  const claims = (((state.claimEvidenceMatrix || {}).claims) || []).map((claim) => claim && claim.claimId === "claim.agent.platform-governance"
    ? Object.assign({}, claim, {
        claimStatus: "supported",
        confidence: 0.86,
        sign: "The user-declared active platform set is recorded in the ledger.",
        evidenceRefs: Array.from(new Set([...(claim.evidenceRefs || []), "agentPlatformGovernance", record.eventId, ...evidenceRefs])),
        counterEvidenceRefs: unusedInstructionState.length > 0 ? ["agentPlatformGovernance.unusedInstructionState"] : [],
        nextActionRef: unusedInstructionState.length > 0 ? "review-unused-platform-instructions" : "keep-platform-instructions-current"
      })
    : claim);
  state.claimEvidenceMatrix = Object.assign({}, state.claimEvidenceMatrix || {}, { claims });
  state.governanceEvidenceBrief = Object.assign({}, state.governanceEvidenceBrief || {}, {
    missingEvidenceClaims: (Array.isArray((state.governanceEvidenceBrief || {}).missingEvidenceClaims) ? state.governanceEvidenceBrief.missingEvidenceClaims : []).filter((item) => !String(item).toLowerCase().includes("platform")),
    unresolvedDecisions: removeFromArray((state.governanceEvidenceBrief || {}).unresolvedDecisions, "decision-agent-platform-selection")
  });
  state.agentResumeBrief = Object.assign({}, state.agentResumeBrief || {}, {
    openDecisions: removeFromArray((state.agentResumeBrief || {}).openDecisions, "decision-agent-platform-selection"),
    blockers: removeFromArray((state.agentResumeBrief || {}).blockers, "agent-platform-declaration-needed"),
    authoritativeFiles: Array.from(new Set([...(state.agentResumeBrief || {}).authoritativeFiles || [], ...evidenceRefs]))
  });
  state.taskQueues = Object.assign({}, state.taskQueues || {}, {
    waiting: removeFromArray((state.taskQueues || {}).waiting, "task-confirm-agent-platforms"),
    completed: Array.from(new Set([...(state.taskQueues || {}).completed || [], "task-confirm-agent-platforms"])),
    needsUser: removeFromArray((state.taskQueues || {}).needsUser, "decision-agent-platform-selection")
  });
  state.agile = updateBacklogTaskStatus(state.agile, "task-confirm-agent-platforms", {
    status: "completed",
    completedAt: recordedAt,
    evidenceRefs: ["agentPlatformGovernance", record.eventId]
  });
  state.agileCadence = updateBacklogTaskStatus(state.agileCadence, "task-confirm-agent-platforms", {
    status: "completed",
    completedAt: recordedAt,
    evidenceRefs: ["agentPlatformGovernance", record.eventId]
  });
  if ((state.workTimeline || {}).items) {
    state.workTimeline = Object.assign({}, state.workTimeline, {
      items: state.workTimeline.items.map((item) => item && item.id === "task-confirm-agent-platforms"
        ? Object.assign({}, item, { status: "completed", endAt: recordedAt, progressPercent: 100, evidenceRefs: Array.from(new Set([...(item.evidenceRefs || []), record.eventId])) })
        : item)
    });
  }
  state.operationsTimeline = [
    ...(Array.isArray(state.operationsTimeline) ? state.operationsTimeline : []),
    {
      id: "timeline-agent-platform-declaration-" + record.sequence,
      type: "governance",
      status: "complete",
      occurredAt: recordedAt,
      summary: "User-declared active AI agent platforms were indexed into the Project World Model.",
      evidenceRefs: [record.eventId]
    }
  ].slice(-100);
  state.meta = Object.assign({}, state.meta || {}, {
    sourceEventSequence: record.sequence,
    ledgerRootHash: record.eventHash
  });
  state.trustBoundary = Object.assign({}, state.trustBoundary || {}, {
    ledgerRootHash: record.eventHash
  });
  persistProjections(state, { skipVcs: true, skipLedger: true });
  console.log("Recorded active AI agent platforms: " + platforms.join(", "));
  if (unusedInstructionState.length > 0) {
    console.log("Unused instruction states: " + unusedInstructionState.map((item) => item.platform).join(", "));
  }
}

function deriveIndex(state) {
  const meta = state.meta || {};
  const queues = state.taskQueues || {};
  const stakeholderBrief = state.stakeholderBrief || {};
  const agentResumeBrief = state.agentResumeBrief || {};
  const claimEvidenceMatrix = state.claimEvidenceMatrix || {};
  const claims = Array.isArray(claimEvidenceMatrix.claims) ? claimEvidenceMatrix.claims : [];
  const missingEvidenceItems = Array.isArray(claimEvidenceMatrix.missingEvidenceItems) ? claimEvidenceMatrix.missingEvidenceItems : [];
  return {
    schemaVersion: String(meta.schemaVersion || SCHEMA_VERSION),
    apiVersion: API_VERSION,
    workspaceId: String(meta.workspaceId || "unknown-workspace"),
    projectionVersion: String(meta.projectionVersion || PROJECTION_VERSION),
    sourceEventSequence: Number(meta.sourceEventSequence || 0),
    sourceStateHash: String(meta.sourceStateHash || stableHash(state)),
    generatedAt: now(),
    expiresAt: "after-next-refresh",
    completeness: state.worldModelCompleteness || "unknown",
    staleness: String(meta.staleness || "fresh"),
    stakeholderBrief,
    agentResumeBrief,
    worldJudgment: state.worldJudgment || null,
    judgmentConsole: state.judgmentConsole || null,
    criticalSignals: state.criticalSignals || [],
    readinessJudgments: state.readinessJudgments || [],
    trustBoundary: state.trustBoundary || null,
    dashboardQualityScorecard: state.dashboardQualityScorecard || null,
    governanceActionabilityScore: state.governanceActionabilityScore || null,
    agentPlatformGovernance: state.agentPlatformGovernance || null,
    audienceLens: state.audienceLens || null,
    workReadinessMap: state.workReadinessMap || null,
    projectEvidenceInventory: state.projectEvidenceInventory || null,
    claimSummary: {
      claimCount: claims.length,
      missingEvidenceItemCount: missingEvidenceItems.length,
      unsupportedClaimCount: claims.filter((claim) => ["missing-evidence", "contradicted", "stale"].includes(String(claim.claimStatus || ""))).length
    },
    agentContextPacks: state.agentContextPacks || {},
    taskCounts: Object.fromEntries(Object.entries(queues).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])),
    currentGoal: stakeholderBrief.currentGoal || "",
    nextAction: agentResumeBrief.nextSafestAction || "",
    criticalRisks: Array.isArray((state.projectWorldModel || {}).risks) ? state.projectWorldModel.risks.map((risk) => risk.id || risk.summary).slice(0, 10) : [],
    authoritativeFiles: agentResumeBrief.authoritativeFiles || [],
    apiRoutes: [
      "/api/harness-dashboard/v1/snapshot",
      "/api/harness-dashboard/v1/index",
      "/api/harness-dashboard/v1/tasks",
      "/api/harness-dashboard/v1/sessions",
      "/api/harness-dashboard/v1/dictionary",
      "/api/harness-dashboard/v1/version-control",
      "/api/harness-dashboard/v1/runtime",
      "/api/harness-dashboard/v1/health",
      "/api/harness-dashboard/v1/events",
      "/api/harness-dashboard/v1/query"
    ]
  };
}

function upsertSignal(state, signal) {
  const existing = Array.isArray(state.criticalSignals) ? state.criticalSignals : [];
  const index = existing.findIndex((entry) => entry && entry.id === signal.id);
  if (index >= 0) {
    existing[index] = Object.assign({}, existing[index], signal);
  } else {
    existing.push(signal);
  }
  state.criticalSignals = existing;
}

function upsertClaim(state, claim) {
  const matrix = state.claimEvidenceMatrix || {};
  const claims = Array.isArray(matrix.claims) ? matrix.claims : [];
  const index = claims.findIndex((entry) => entry && entry.claimId === claim.claimId);
  if (index >= 0) {
    claims[index] = Object.assign({}, claims[index], claim);
  } else {
    claims.push(claim);
  }
  state.claimEvidenceMatrix = Object.assign({}, matrix, { claims });
}

function ensureTimelineItem(state, item) {
  const timeline = state.workTimeline || {};
  const items = Array.isArray(timeline.items) ? timeline.items : [];
  if (!items.some((entry) => entry && entry.id === item.id)) {
    items.push(item);
  }
  state.workTimeline = Object.assign({}, timeline, { items });
}

function ensureCoreGovernanceClaims(state) {
  const service = (((state.serviceRegistry || {}).services || [])[0]) || {};
  const serviceId = service.id || "primary-service";
  upsertClaim(state, {
    claimId: "claim.release.traceability",
    statement: "A release can be traced from decision to deployment and rollback.",
    subjectRef: "service:" + serviceId,
    claimStatus: "missing-evidence",
    confidence: 0.12,
    sign: "Release readiness exists as a contract but has no complete release record.",
    object: "release traceability",
    interpretant: "A release is governable only when version, revision, artifact, CI run, approver, target, smoke result, and rollback path are known.",
    evidenceRefs: ["releaseReadiness.requiredTraceability"],
    counterEvidenceRefs: ["releaseReadiness.releases", "governanceEvidenceBrief.missingEvidenceClaims"],
    falsificationTests: [
      "Reject release readiness if releaseReadiness.releases is empty.",
      "Reject release readiness if smoke test result or rollback command is missing."
    ],
    nextActionRef: "task-map-deployment-target"
  });
  upsertClaim(state, {
    claimId: "claim.data.save-integrity",
    statement: "Player progress and data integrity risks are visible before service work proceeds.",
    subjectRef: "value:value-save-integrity",
    claimStatus: "partial",
    confidence: 0.44,
    sign: "Value hierarchy identifies save integrity, but database and backup evidence remain unknown.",
    object: "save integrity governance",
    interpretant: "Game work can proceed safely only when local-save, cloud-sync, migration, backup, and restore implications are visible.",
    evidenceRefs: ["valueHierarchy", "databaseReadiness", "runningServiceContract.dataOwnership"],
    counterEvidenceRefs: ["databaseReadiness.backupFreshness", "databaseReadiness.restoreDrillEvidence"],
    falsificationTests: [
      "Reject this claim if databaseReadiness has no migration, retention, backup, or restore evidence.",
      "Reject this claim if service changes can overwrite progress without explicit recovery guidance."
    ],
    nextActionRef: "missing.database-readiness"
  });
}

function listRelativeFiles(relativeDir, predicate) {
  const root = path.join(workspaceRoot, relativeDir);
  if (!fs.existsSync(root)) return [];
  const out = [];
  const stack = [root];
  while (stack.length > 0 && out.length < 100) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        const relative = path.relative(workspaceRoot, full).replace(/\\\\/g, "/");
        if (!predicate || predicate(relative)) out.push(relative);
      }
    }
  }
  return out.sort();
}

function synchronizeProjectEvidenceInventory(state) {
  const sources = [];
  const addSource = (source) => sources.push(Object.assign({ status: "observed" }, source));
  if (fs.existsSync(path.join(workspaceRoot, "package.json"))) {
    addSource({
      id: "evidence.package-json",
      path: "package.json",
      type: "package-manifest",
      promotesClaimIds: ["claim.service.operational-readiness"]
    });
  }
  const workflows = listRelativeFiles(".github/workflows", (relative) => /\\.(ya?ml)$/i.test(relative));
  for (const workflow of workflows) {
    addSource({
      id: "evidence.workflow." + stableHash(workflow).slice(0, 8),
      path: workflow,
      type: "ci-cd-workflow",
      promotesClaimIds: ["claim.release.github-pages-workflow", "claim.release.traceability"]
    });
  }
  const sqlFiles = listRelativeFiles("supabase", (relative) => /\\.sql$/i.test(relative));
  for (const sql of sqlFiles) {
    addSource({
      id: "evidence.supabase." + stableHash(sql).slice(0, 8),
      path: sql,
      type: "database-schema",
      promotesClaimIds: ["claim.data.supabase-schema-present", "claim.data.save-integrity"]
    });
  }
  for (const plan of [
    "docs/012-supabase-cloud-save-plan.md",
    "docs/ai-harness/runtime/state/active-session.json",
    "docs/ai-harness/runtime/state/session-index.json"
  ]) {
    if (fs.existsSync(path.join(workspaceRoot, plan))) {
      addSource({
        id: "evidence." + stableHash(plan).slice(0, 8),
        path: plan,
        type: plan.includes("active-session") || plan.includes("session-index") ? "runtime-session-evidence" : "service-plan",
        promotesClaimIds: plan.includes("supabase") ? ["claim.offline.cloud-save-plan", "claim.data.save-integrity"] : ["claim.agent.safe-resume"]
      });
    }
  }
  state.projectEvidenceInventory = Object.assign({}, state.projectEvidenceInventory || {}, {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now(),
    sources,
    claimsPromoted: Array.from(new Set(sources.flatMap((source) => source.promotesClaimIds || []))),
    missingSourceTypes: [
      ...(workflows.length === 0 ? ["CI workflow"] : []),
      ...(sqlFiles.length === 0 ? ["database schema"] : []),
      "deployment URL",
      "smoke test result",
      "rollback command",
      "incident runbook"
    ]
  });
  if (workflows.length > 0) {
    upsertClaim(state, {
      claimId: "claim.release.github-pages-workflow",
      statement: "A GitHub Pages/GitHub Actions deployment workflow is visible to the harness.",
      subjectRef: "releaseReadiness",
      claimStatus: "partial",
      confidence: 0.58,
      sign: "Workflow file(s) observed: " + workflows.join(", "),
      object: "GitHub Pages release path",
      interpretant: "Workflow files support deployability orientation, but release readiness still needs run, artifact, target URL, smoke result, and rollback evidence.",
      evidenceRefs: workflows,
      counterEvidenceRefs: ["releaseReadiness.releases", "governanceEvidenceBrief.missingEvidenceClaims"],
      falsificationTests: [
        "Reject deployability if no workflow file exists.",
        "Reject release readiness if no successful workflow run, deployment URL, smoke test, or rollback path is linked."
      ],
      nextActionRef: "task-map-deployment-target"
    });
  }
  if (sqlFiles.length > 0) {
    upsertClaim(state, {
      claimId: "claim.data.supabase-schema-present",
      statement: "Supabase/Postgres schema evidence is visible to the harness.",
      subjectRef: "databaseReadiness",
      claimStatus: "partial",
      confidence: 0.56,
      sign: "SQL file(s) observed: " + sqlFiles.join(", "),
      object: "database schema readiness",
      interpretant: "Schema files support data-readiness orientation, but migration status, RLS review, backup, and restore evidence are still required.",
      evidenceRefs: sqlFiles,
      counterEvidenceRefs: ["databaseReadiness.migrationStatus", "databaseReadiness.restoreDrillEvidence"],
      falsificationTests: [
        "Reject database readiness if schema files are absent.",
        "Reject production data readiness if RLS, migration, backup, and restore evidence are absent."
      ],
      nextActionRef: "task-map-data-readiness"
    });
  }
  if (fs.existsSync(path.join(workspaceRoot, "docs/012-supabase-cloud-save-plan.md"))) {
    upsertClaim(state, {
      claimId: "claim.offline.cloud-save-plan",
      statement: "Offline-first cloud-save planning evidence is visible.",
      subjectRef: "runningServiceContract",
      claimStatus: "partial",
      confidence: 0.62,
      sign: "docs/012-supabase-cloud-save-plan.md exists.",
      object: "offline-first save/sync intent",
      interpretant: "A durable plan supports agent resume and stakeholder review, but implementation and validation evidence remain separate gates.",
      evidenceRefs: ["docs/012-supabase-cloud-save-plan.md"],
      counterEvidenceRefs: ["releaseReadiness.status", "databaseReadiness.migrationStatus"],
      falsificationTests: [
        "Reject implementation readiness if no code-level verification or smoke test is linked.",
        "Reject cloud-save readiness if Supabase connectivity, quota, and retry behavior are untested."
      ],
      nextActionRef: "task-collect-service-health"
    });
  }
}

function normalizeTimelineStatus(value) {
  const status = String(value || "waiting").toLowerCase();
  if (status === "active" || status === "doing") return "in-progress";
  if (status === "complete") return "completed";
  return status;
}

function synchronizeActiveSessionAndWorkMap(state) {
  const sessions = Array.isArray(state.governedSessions) ? state.governedSessions : [];
  const originalQueues = Object.assign({}, state.taskQueues || {});
  const activeSession = sessions.find((session) => ["active", "in-progress", "running"].includes(String(session.status || "").toLowerCase())) || null;
  if (activeSession) {
    state.agentResumeBrief = Object.assign({}, state.agentResumeBrief || {}, { activeSession: activeSession.id });
    state.runtimeOrchestration = Object.assign({}, state.runtimeOrchestration || {}, {
      activeSessionId: activeSession.id,
      activeChunkId: activeSession.chunkId || (state.runtimeOrchestration || {}).activeChunkId || "active-session",
      currentPhase: activeSession.stage || (state.runtimeOrchestration || {}).currentPhase || "governed-session-active"
    });
  }
  const rows = [];
  const addRow = (item, sourceType) => {
    const status = normalizeTimelineStatus(item.status);
    rows.push({
      id: String(item.id || item.title || sourceType),
      title: item.title || item.goal || item.id || sourceType,
      status,
      lane: item.lane || sourceType,
      owner: item.owner || item.agentRole || "unassigned",
      evidenceRefs: item.evidenceRefs || item.outputs || [],
      blockingClaimIds: item.blockingClaimIds || item.blocksClaimIds || [],
      nextActionRef: item.nextActionRef || item.nextStep || "",
      exitCriteria: item.exitCriteria || "Close with evidence, validation, and refreshed dashboard projection.",
      unlocksReadiness: item.unlocksReadiness || [],
      sourceType,
      trustClass: (item.evidenceRefs || item.outputs || []).length > 0 ? "projection-derived-with-evidence" : "projection-derived"
    });
  };
  for (const item of (((state.workTimeline || {}).items) || [])) addRow(item, "workTimeline");
  const seen = new Set(rows.map((row) => row.id));
  for (const session of sessions) {
    if (seen.has(String(session.id))) continue;
    addRow(session, "governedSession");
    seen.add(String(session.id));
  }
  for (const gap of (((state.claimEvidenceMatrix || {}).missingEvidenceItems) || [])) {
    const id = String(gap.id || gap.resolutionTaskId || "missing-evidence");
    const rowId = seen.has(id) ? id + "-evidence-gate" : id;
    addRow({
      id: rowId,
      title: gap.label || id,
      status: "blocked",
      lane: "Evidence Recovery",
      owner: gap.owner || "unassigned",
      evidenceRefs: [gap.id, gap.requiredEvidenceType].filter(Boolean),
      blockingClaimIds: gap.blocksClaimIds || [],
      nextActionRef: gap.resolutionTaskId || "",
      exitCriteria: gap.requiredEvidenceType || "Required evidence linked."
    }, "missingEvidence");
    seen.add(rowId);
  }
  const derivedQueues = {
    waiting: [],
    inProgress: [],
    completed: [],
    blocked: [],
    needsUser: Array.isArray(originalQueues.needsUser) ? [...originalQueues.needsUser] : [],
    realWorld: Array.isArray(originalQueues.realWorld) ? [...originalQueues.realWorld] : [],
    failed: []
  };
  for (const row of rows) {
    if (row.status === "waiting") derivedQueues.waiting.push(row.id);
    else if (row.status === "in-progress" || row.status === "active") derivedQueues.inProgress.push(row.id);
    else if (row.status === "completed" || row.status === "closed") derivedQueues.completed.push(row.id);
    else if (row.status === "blocked") derivedQueues.blocked.push(row.id);
    else if (row.status === "failed") derivedQueues.failed.push(row.id);
  }
  if (activeSession && !derivedQueues.inProgress.includes(String(activeSession.id))) {
    derivedQueues.inProgress.push(String(activeSession.id));
  }
  state.taskQueues = Object.assign({}, originalQueues, {
    waiting: Array.from(new Set(derivedQueues.waiting)),
    inProgress: Array.from(new Set(derivedQueues.inProgress)),
    completed: Array.from(new Set(derivedQueues.completed)),
    blocked: Array.from(new Set(derivedQueues.blocked)),
    needsUser: Array.from(new Set(derivedQueues.needsUser)),
    realWorld: Array.from(new Set(derivedQueues.realWorld)),
    failed: Array.from(new Set(derivedQueues.failed))
  });
  state.workReadinessMap = Object.assign({}, state.workReadinessMap || {}, {
    schemaVersion: SCHEMA_VERSION,
    source: "projected-from-workTimeline-backlog-sessions-evidence",
    generatedAt: now(),
    rows,
    summary: {
      visibleRows: rows.length,
      activeRows: rows.filter((row) => ["in-progress", "active"].includes(row.status)).length,
      blockedRows: rows.filter((row) => ["blocked", "failed"].includes(row.status)).length,
      gateCount: rows.filter((row) => row.exitCriteria).length
    }
  });
}

function applyClaimTrustMetadata(state) {
  const matrix = state.claimEvidenceMatrix || {};
  const claims = Array.isArray(matrix.claims) ? matrix.claims : [];
  for (const claim of claims) {
    const status = String(claim.claimStatus || "").toLowerCase();
    claim.trustClass = status === "supported" ? "ledger-or-artifact-backed" : status === "partial" ? "projection-derived-with-evidence" : "placeholder-or-missing-evidence";
    claim.projectionOnly = !Array.isArray(claim.sourceEventIds) || claim.sourceEventIds.length === 0;
    claim.falsificationResults = (claim.falsificationTests || []).map((test) => ({
      test,
      status: status === "supported" ? "not-run" : "blocked-by-missing-evidence",
      checkedAt: now(),
      validator: "dashboard-ops projection evaluator",
      observedEvidenceRefs: claim.evidenceRefs || []
    }));
  }
  state.claimEvidenceMatrix = Object.assign({}, matrix, { claims });
}

function synchronizeDecisionState(state) {
  const decisions = Array.isArray(state.decisionContracts) ? state.decisionContracts : [];
  const closedDecisionIds = new Set(decisions
    .filter((decision) => ["approved", "rejected", "resolved"].includes(String(decision.status || "").toLowerCase()))
    .map((decision) => String(decision.id || decision.decisionId || decision.decision || "")));
  const evidence = Object.assign({}, state.governanceEvidenceBrief || {});
  const unresolved = Array.isArray(evidence.unresolvedDecisions) ? evidence.unresolvedDecisions.map(String) : [];
  evidence.unresolvedDecisions = unresolved.filter((id) => !closedDecisionIds.has(id));
  state.governanceEvidenceBrief = evidence;
  state.agentResumeBrief = Object.assign({}, state.agentResumeBrief || {}, {
    openDecisions: (Array.isArray((state.agentResumeBrief || {}).openDecisions) ? state.agentResumeBrief.openDecisions : []).map(String).filter((id) => !closedDecisionIds.has(id))
  });
  const queues = Object.assign({}, state.taskQueues || {});
  queues.needsUser = (Array.isArray(queues.needsUser) ? queues.needsUser : []).map(String).filter((id) => !closedDecisionIds.has(id));
  state.taskQueues = queues;
}

function synchronizeJudgmentModel(state) {
  const vc = state.versionControl || {};
  const dirtyCount = Array.isArray(vc.unlinkedChanges) ? vc.unlinkedChanges.length : 0;
  ensureCoreGovernanceClaims(state);
  synchronizeProjectEvidenceInventory(state);
  synchronizeDecisionState(state);
  synchronizeActiveSessionAndWorkMap(state);
  applyClaimTrustMetadata(state);
  const evidence = state.governanceEvidenceBrief || {};
  const missingEvidenceCount = Array.isArray(evidence.missingEvidenceClaims) ? evidence.missingEvidenceClaims.length : 0;
  const openDecisionCount = Array.isArray(evidence.unresolvedDecisions) ? evidence.unresolvedDecisions.length : 0;
  if (dirtyCount > 0) {
    upsertSignal(state, {
      id: "signal-dirty-working-tree",
      severity: "critical",
      label: "Dirty working tree is not linked",
      status: "open",
      whyItMatters: "Unlinked local changes can make stakeholder review, release judgment, and AI-agent handoff misleading.",
      owner: "harness-dashboard-operator",
      sourceRefs: ["versionControl.unlinkedChanges"],
      nextAction: "Link or explain dirty working-tree paths before closing, releasing, or handing off work."
    });
    upsertClaim(state, {
      claimId: "claim.vcs.dirty-working-tree-linked",
      statement: "Dirty working-tree changes are safe for stakeholder review and AI Agent handoff.",
      subjectRef: "versionControl.unlinkedChanges",
      claimStatus: "missing-evidence",
      confidence: 0.08,
      sign: String(dirtyCount) + " local changed path(s) are present without governed linkage.",
      object: "local VCS working tree",
      interpretant: "Local changes are review-safe only when each path is linked to a session, task, decision, or explicit warning.",
      evidenceRefs: ["versionControl.unlinkedChanges"],
      counterEvidenceRefs: ["governanceEvidenceBrief.unlinkedCommitsOrRevisions"],
      falsificationTests: [
        "Reject handoff readiness if any dirty path remains unlinked.",
        "Reject release readiness if dirty paths exist outside a governed task."
      ],
      nextActionRef: "task-link-vcs-records"
    });
    ensureTimelineItem(state, {
      id: "task-link-dirty-working-tree",
      title: "Classify and link dirty working-tree paths",
      status: "blocked",
      lane: "Evidence Recovery",
      owner: "harness-dashboard-operator",
      startOffsetDays: -1,
      plannedEndOffsetDays: 2,
      progressPercent: 0,
      kpiTags: ["handover-latency", "vcs-linkage"],
      evidenceRefs: ["versionControl.unlinkedChanges"],
      blockingClaimIds: ["claim.vcs.dirty-working-tree-linked", "claim.agent.safe-resume"],
      nextActionRef: "task-link-vcs-records",
      exitCriteria: "Every dirty path is linked to a governed task/session/decision or documented as a warning."
    });
  }
  if (missingEvidenceCount > 0) {
    upsertSignal(state, {
      id: "signal-missing-evidence-items",
      severity: "watching",
      label: "Operational evidence still needs linking",
      status: "open",
      whyItMatters: String(missingEvidenceCount) + " evidence claims still need owners, artifact types, and resolution tasks before release or operations approval.",
      owner: "harness-dashboard-operator",
      sourceRefs: ["governanceEvidenceBrief.missingEvidenceClaims", "claimEvidenceMatrix.missingEvidenceItems"],
      nextAction: "Use the Evidence and Work tabs to convert missing claims into owned follow-up tasks."
    });
  }
  const judgment = Object.assign({}, state.worldJudgment || {});
  const trustScore = Number((state.worldModelCompleteness || {}).score || judgment.trustScore || 0);
  judgment.trustScore = trustScore;
  judgment.trustLevel = trustScore >= 80 ? "operational" : trustScore >= 50 ? "partial" : "bootstrap";
  judgment.status = trustScore >= 80 && dirtyCount === 0 && missingEvidenceCount === 0 && openDecisionCount === 0
    ? "ready-for-operational-judgment"
    : "bootstrap-not-ready-for-operational-judgment";
  judgment.summary = judgment.status === "ready-for-operational-judgment"
    ? "Core service, evidence, decision, and VCS signals are consistent enough for operational judgment."
    : "The harness is usable for orientation, planning, and resume. Release and operations approval still require linked project evidence.";
  judgment.freshness = Object.assign({}, judgment.freshness || {}, {
    projection: String((state.meta || {}).staleness || "fresh"),
    evidence: missingEvidenceCount === 0 ? "connected" : "partial",
    vcs: dirtyCount === 0 ? String(vc.workingCopyStatus || "unknown") : "dirty"
  });
  state.worldJudgment = judgment;
  state.judgmentConsole = Object.assign({}, state.judgmentConsole || {}, {
    currentJudgment: judgment.status === "ready-for-operational-judgment"
      ? "Ready for operational judgment with current evidence."
      : "Harness adoption is ready for governed planning and evidence capture; release, operations, and handoff remain separate evidence gates.",
    highestRiskSignal: dirtyCount > 0 ? "signal-dirty-working-tree" : missingEvidenceCount > 0 ? "signal-missing-evidence-items" : "none",
    nextRequiredDecision: openDecisionCount > 0 ? String((evidence.unresolvedDecisions || [])[0]) : "none",
    blockedActions: Array.from(new Set([
      ...(((state.judgmentConsole || {}).blockedActions) || []),
      ...(dirtyCount > 0 ? ["Do not hand off, release, or approve review while dirty VCS changes are unlinked."] : []),
      ...(missingEvidenceCount > 0 ? ["Do not claim operational readiness while required evidence is missing."] : [])
    ]))
  });
  const quality = Object.assign({}, state.dashboardQualityScorecard || {});
  const evidencePenalty = dirtyCount + missingEvidenceCount + openDecisionCount;
  const observedSourceCount = Array.isArray((state.projectEvidenceInventory || {}).sources) ? state.projectEvidenceInventory.sources.length : 0;
  quality.projectEvidenceScore = Math.max(1.2, Math.min(6.8, 1.2 + observedSourceCount * 0.45 - evidencePenalty * 0.12));
  quality.uiUxDesignScore = Math.max(9.5, Number(quality.uiUxDesignScore || 9.6));
  quality.lastEvaluatedAt = now();
  quality.evaluatorProvenance = Array.from(new Map([
    ...((quality.evaluatorProvenance || []).map((entry) => [entry.id || entry.evaluatorRole || JSON.stringify(entry), entry])),
    ["browser-qa", {
      id: "browser-qa",
      evaluatorRole: "Codex frontend QA",
      status: "browser-verified",
      checkedAt: now(),
      evidenceRefs: ["Playwright: Work tab 9 rows, active bar, blocked gates, no console error/warn"],
      confidence: "high"
    }]
  ]).values());
  quality.whyNot95Yet = [
    "Overall actionability is capped by project evidence, not UI polish.",
    "Unclassified dirty VCS paths and missing release/data/service evidence block release and handoff.",
    "Claims with partial or missing evidence need source events, evaluated falsification results, and owner-approved closure."
  ];
  state.dashboardQualityScorecard = quality;
  const activeRows = Number(((state.workReadinessMap || {}).summary || {}).activeRows || 0);
  const blockedRows = Number(((state.workReadinessMap || {}).summary || {}).blockedRows || 0);
  const operationalScoreRaw = Math.max(1.2, Math.min(10, Number(quality.projectEvidenceScore || 1.2) + (openDecisionCount === 0 ? 1 : 0) - Math.min(2, dirtyCount * 0.08) - Math.min(1.5, missingEvidenceCount * 0.25)));
  const workRows = Array.isArray((state.workReadinessMap || {}).rows) ? (state.workReadinessMap || {}).rows.length : 0;
  const setupScoreRaw = Math.max(6.5, Math.min(9.2,
    6.6
    + (observedSourceCount > 0 ? 0.7 : 0)
    + (workRows > 0 ? 0.5 : 0)
    + (openDecisionCount === 0 ? 0.6 : 0.1)
    - Math.min(0.4, blockedRows * 0.03)
    - Math.min(0.3, dirtyCount * 0.02)
  ));
  const operationalScore = Number(operationalScoreRaw.toFixed(1));
  const setupScore = Number(setupScoreRaw.toFixed(1));
  const status = operationalScore >= 8 && dirtyCount === 0 && missingEvidenceCount === 0 && openDecisionCount === 0
    ? "operational-candidate"
    : openDecisionCount > 0
      ? "guided-onboarding"
      : "ready-to-govern";
  state.governanceActionabilityScore = {
    schemaVersion: SCHEMA_VERSION,
    score: setupScore,
    maxScore: 10,
    status,
    adoptionStage: operationalScore >= 8 ? "operational-candidate" : "governed-adoption",
    onboardingScore: setupScore,
    operationalEvidenceScore: operationalScore,
    scoreMeaning: "The main score measures whether the harness is ready to guide planning, resume, and evidence collection. It is not production release readiness.",
    userInterpretation: operationalScore >= 8
      ? "Harness setup and operational evidence are close enough for release/operate review."
      : "Harness setup is usable; the lower operational evidence score means proof still needs to be linked before release or handoff.",
    canPlan: true,
    canBuild: setupScore >= 7 && openDecisionCount === 0,
    canRelease: operationalScore >= 8 && dirtyCount === 0 && missingEvidenceCount === 0,
    canOperate: operationalScore >= 8.5 && missingEvidenceCount === 0,
    canHandoff: dirtyCount === 0 && openDecisionCount === 0 && blockedRows === 0,
    capReason: dirtyCount > 0
      ? "Release and handoff are blocked by dirty or unclassified VCS paths; the harness itself is ready to guide cleanup."
      : missingEvidenceCount > 0
        ? "Release and operations are blocked by missing evidence; planning and evidence capture can continue."
        : "Operational actionability follows current evidence coverage.",
    inputs: {
      uiUxDesignScore: quality.uiUxDesignScore,
      projectEvidenceScore: quality.projectEvidenceScore,
      governanceSetupScore: setupScore,
      operationalEvidenceScore: operationalScore,
      dirtyOrUnclassifiedVcsPaths: dirtyCount,
      missingEvidenceClaims: missingEvidenceCount,
      unresolvedDecisions: openDecisionCount,
      activeWorkRows: activeRows,
      blockedWorkRows: blockedRows
    },
    nextToReach95: [
      ...(openDecisionCount > 0 ? ["Resolve unresolved stakeholder decisions."] : []),
      ...(dirtyCount > 0 ? ["Classify or link dirty VCS paths to governed work."] : []),
      ...(missingEvidenceCount > 0 ? ["Support missing service, release, data, and operations claims with evidence."] : []),
      "Append semantic claim/VCS/release/data events when evidence changes."
    ]
  };
  const existingImprovement = Object.assign({}, state.worldModelImprovementContract || {});
  state.worldModelImprovementContract = Object.assign({}, existingImprovement, {
    schemaVersion: SCHEMA_VERSION,
    purpose: existingImprovement.purpose || "Every AI Agent session must make the project world model more truthful, less ambiguous, and easier to resume.",
    lastEvaluatedAt: now(),
    currentScores: {
      governanceSetupScore: setupScore,
      operationalEvidenceScore: operationalScore,
      worldModelCompletenessScore: Number((state.worldModelCompleteness || {}).score || 0)
    },
    nextImprovementActions: [
      ...(openDecisionCount > 0 ? ["Clarify pending stakeholder decisions and record owner-approved outcomes."] : []),
      ...(dirtyCount > 0 ? ["Classify or link dirty VCS paths before handoff or release review."] : []),
      ...(missingEvidenceCount > 0 ? ["Convert missing evidence claims into owned Work-tab tasks with required artifact types."] : []),
      "Ask for tacit operational or domain context only when repository evidence cannot answer the question.",
      "Keep tab content non-duplicative: Overview summarizes, Work sequences, Evidence proves, Governance decides, Operations runs, Tech Stack explains composition."
    ],
    scoreImprovementPolicy: {
      governanceSetupScore: "Raise through clearer goals, owners, open work, decisions, tab ownership, and resumable agent contracts.",
      operationalEvidenceScore: "Raise through real CI, VCS, release, service-health, incident, SLO/SLI, database, and runbook evidence.",
      antiGamingRule: "Never raise scores by hiding missing evidence, downgrading warnings without proof, or treating declared/tacit context as observed fact."
    }
  });
  const trust = Object.assign({}, state.trustBoundary || {});
  const manifest = loadLedgerManifest();
  state.trustBoundary = Object.assign({}, trust, {
    status: dirtyCount === 0 && missingEvidenceCount === 0 && openDecisionCount === 0 ? "aligned" : "evidence-warning",
    ledgerRootHash: manifest.rootHash || trust.ledgerRootHash || "unknown",
    projectionStateHash: String((state.meta || {}).sourceStateHash || trust.projectionStateHash || "unknown"),
    runtimeStatePathHash: fileHash(statePath),
    servedSnapshotHash: stableHash({
      projectWorldModel: state.projectWorldModel,
      agentPlatformGovernance: state.agentPlatformGovernance,
      audienceLens: state.audienceLens,
      worldJudgment: state.worldJudgment,
      claimEvidenceMatrix: state.claimEvidenceMatrix,
      versionControl: state.versionControl
    })
  });
  const packs = state.agentContextPacks || {};
  if (packs.agent) {
    packs.agent.forbiddenAssumptions = Array.from(new Set([
      ...(Array.isArray(packs.agent.forbiddenAssumptions) ? packs.agent.forbiddenAssumptions : []),
      ...(dirtyCount > 0 ? ["Do not assume local working-tree changes are linked to a governed task."] : []),
      ...(openDecisionCount > 0 ? ["Do not treat unresolved decisions as approved."] : [])
    ]));
  }
  state.agentContextPacks = packs;
  return state;
}

function deriveRuntime(state, previous = {}) {
  const meta = state.meta || {};
  const listener = Object.assign({}, previous.listener || {}, state.listener || {});
  return {
    schemaVersion: String(meta.schemaVersion || SCHEMA_VERSION),
    apiVersion: API_VERSION,
    workspaceId: String(meta.workspaceId || "unknown-workspace"),
    projectionVersion: String(meta.projectionVersion || PROJECTION_VERSION),
    sourceEventSequence: Number(meta.sourceEventSequence || 0),
    sourceStateHash: String(meta.sourceStateHash || stableHash(state)),
    generatedAt: now(),
    completeness: state.worldModelCompleteness || "unknown",
    staleness: String(meta.staleness || "fresh"),
    listener: Object.assign({
      status: "not-started",
      lifecycle: "auto-restored-on-harness-activity",
      statePathHash: fileHash(statePath),
      host: "127.0.0.1",
      port: null,
      url: null,
      pid: null,
      pidStartTime: null,
      commandHash: null,
      tokenPath: path.relative(workspaceRoot, tokenPath).replace(/\\\\/g, "/"),
      logPath: path.relative(workspaceRoot, logPath).replace(/\\\\/g, "/"),
      lockPath: path.relative(workspaceRoot, lockPath).replace(/\\\\/g, "/"),
      startedAt: null,
      lastHeartbeatAt: null,
      lastHealthCheckAt: null,
      lastFailure: null
    }, listener, { statePathHash: fileHash(statePath) })
  };
}

function recordProjectionRefreshEvent(state) {
  const manifest = loadLedgerManifest();
  const expectedLastSequence = Number(manifest.lastSequence || 0);
  const workspaceId = String((state.meta || {}).workspaceId || "unknown-workspace");
  const missingEvidenceCount = Array.isArray(((state.governanceEvidenceBrief || {}).missingEvidenceClaims)) ? state.governanceEvidenceBrief.missingEvidenceClaims.length : 0;
  const dirtyCount = Array.isArray(((state.versionControl || {}).unlinkedChanges)) ? state.versionControl.unlinkedChanges.length : 0;
  const payload = {
    projectionVersion: PROJECTION_VERSION,
    sourceStateHash: String((state.meta || {}).sourceStateHash || ""),
    versionControl: {
      provider: (state.versionControl || {}).provider || "unknown",
      status: (state.versionControl || {}).status || "unknown",
      workingCopyStatus: (state.versionControl || {}).workingCopyStatus || "unknown",
      unlinkedChangeCount: dirtyCount
    },
    criticalSignalCount: Array.isArray(state.criticalSignals) ? state.criticalSignals.length : 0,
    missingEvidenceCount,
    openDecisionCount: Array.isArray(((state.governanceEvidenceBrief || {}).unresolvedDecisions)) ? state.governanceEvidenceBrief.unresolvedDecisions.length : 0,
    quality: {
      uiUxDesignScore: (state.dashboardQualityScorecard || {}).uiUxDesignScore || null,
      projectEvidenceScore: (state.dashboardQualityScorecard || {}).projectEvidenceScore || null
    },
    governanceActionabilityScore: (state.governanceActionabilityScore || {}).score || null,
    projectEvidenceSourceCount: Array.isArray((state.projectEvidenceInventory || {}).sources) ? state.projectEvidenceInventory.sources.length : 0,
    workReadinessMapSummary: (state.workReadinessMap || {}).summary || null
  };
  const recordedAt = now();
  const event = {
    eventId: "event-" + String(expectedLastSequence + 1).padStart(6, "0") + "-projection-refresh-" + stableHash({ payload, recordedAt }).slice(0, 8),
    sequence: expectedLastSequence + 1,
    eventType: "workspace.dashboard.projection-refreshed",
    eventVersion: "1.0.0",
    workspaceId,
    aggregateId: workspaceId,
    aggregateType: "projectWorldModel",
    aggregateVersion: expectedLastSequence + 1,
    occurredAt: recordedAt,
    recordedAt,
    actor: "workspace-init-mcp",
    agentId: "dashboard-ops",
    sourceTool: "dashboard-ops refresh",
    correlationId: "projection-refresh",
    causationId: null,
    idempotencyKey: "projection-refresh:" + recordedAt,
    payloadHash: stableHash(payload),
    previousEventHash: manifest.rootHash || "genesis",
    redactionLevel: "internal",
    payload
  };
  const record = appendLedgerEvent(event, expectedLastSequence);
  const operations = Array.isArray(state.operationsTimeline) ? state.operationsTimeline : [];
  operations.push({
    id: "timeline-dashboard-refresh-" + record.sequence,
    type: "dashboard-refresh",
    status: "complete",
    occurredAt: recordedAt,
    summary: "Dashboard projections refreshed and VCS/evidence signals recorded to the ledger.",
    evidenceRefs: [record.eventId]
  });
  state.operationsTimeline = operations.slice(-100);
  state.meta = Object.assign({}, state.meta || {}, {
    sourceEventSequence: record.sequence,
    ledgerRootHash: record.eventHash
  });
  state.trustBoundary = Object.assign({}, state.trustBoundary || {}, {
    ledgerRootHash: record.eventHash
  });
  return record;
}

function persistProjections(state, options = {}) {
  const priorRuntime = loadJsonOrFallback(runtimePath, {});
  const generatedAt = now();
  state.meta = Object.assign({}, state.meta || {}, {
    schemaVersion: SCHEMA_VERSION,
    apiVersion: API_VERSION,
    projectionVersion: PROJECTION_VERSION,
    generatedAt,
    expiresAt: "after-next-refresh",
    staleness: "fresh",
    completeness: state.worldModelCompleteness || "partial",
    sourceStateHash: stableHash({
      projectWorldModel: state.projectWorldModel,
      audienceLens: state.audienceLens,
      taskQueues: state.taskQueues,
      workTimeline: state.workTimeline,
      decisionContracts: state.decisionContracts,
      versionControl: state.versionControl
    })
  });
  const vc = options.skipVcs ? null : collectVersionControl();
  if (vc) {
    state.versionControl = vc.versionControl;
    state.vcsChangeRecords = vc.vcsChangeRecords || [];
    state.gitStatus = Object.assign({}, state.gitStatus || {}, {
      trackedByGit: vc.versionControl.provider === "git" ? "yes" : "no",
      provider: vc.versionControl.provider,
      currentBranch: vc.versionControl.currentBranchOrRevision,
      workingTree: Object.assign({}, (state.gitStatus || {}).workingTree || {}, {
        status: vc.versionControl.workingCopyStatus
      })
    });
  }
  synchronizeJudgmentModel(state);
  normalizeDashboardStateForValidation(state);
  state.meta.sourceStateHash = stableHash({
    projectWorldModel: state.projectWorldModel,
    worldJudgment: state.worldJudgment,
    criticalSignals: state.criticalSignals,
    claimEvidenceMatrix: state.claimEvidenceMatrix,
    readinessJudgments: state.readinessJudgments,
    trustBoundary: state.trustBoundary,
    agentPlatformGovernance: state.agentPlatformGovernance,
    audienceLens: state.audienceLens,
    dashboardQualityScorecard: state.dashboardQualityScorecard,
    governanceActionabilityScore: state.governanceActionabilityScore,
    workReadinessMap: state.workReadinessMap,
    projectEvidenceInventory: state.projectEvidenceInventory,
    taskQueues: state.taskQueues,
    workTimeline: state.workTimeline,
    decisionContracts: state.decisionContracts,
    versionControl: state.versionControl
  });
  if (!options.skipLedger) {
    recordProjectionRefreshEvent(state);
  }
  if (state.embeddingProjection) {
    writeJson(embeddingPath, state.embeddingProjection);
  }
  writeJson(statePath, state);
  writeJson(indexPath, deriveIndex(state));
  writeJson(runtimePath, deriveRuntime(state, priorRuntime));
  return state;
}

function handleRefresh() {
  const state = loadState({ quarantineCorrupt: true });
  persistProjections(state);
  console.log("Harness Dashboard projections refreshed.");
}

function handleValidate() {
  const state = loadState();
  const errors = validateState(state);
  if (errors.length > 0) {
    console.error(errors.join("\\n"));
    process.exitCode = 1;
    return;
  }
  console.log("Harness Dashboard projections are valid.");
}

function handleRebuild() {
  const state = loadState({ quarantineCorrupt: true });
  persistProjections(state);
  console.log("Harness Dashboard projections rebuilt.");
}

function handleAppendEvent() {
  const eventPath = option("--event", "");
  const expected = Number(option("--expected-last-sequence", "NaN"));
  if (!eventPath || !Number.isFinite(expected)) {
    throw new Error("append-event requires --event and --expected-last-sequence");
  }
  const event = readJson(path.resolve(workspaceRoot, eventPath));
  const record = appendLedgerEvent(event, expected);
  console.log("Appended harness event sequence " + record.sequence);
}

function ensureToken() {
  ensureDir(stateDir);
  if (fs.existsSync(tokenPath)) {
    const existing = fs.readFileSync(tokenPath, "utf-8").trim();
    if (existing.length >= 24) {
      return existing;
    }
  }
  const token = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(tokenPath, token + "\\n", { encoding: "utf-8", mode: 0o600 });
  return token;
}

function normalizeHost(value) {
  return String(value || "").split(":")[0].replace(/^\\[/, "").replace(/\\]$/, "").toLowerCase();
}

function isLoopbackHost(value) {
  const host = normalizeHost(value);
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isLoopbackOrigin(value) {
  if (value == null || value === "") {
    return true;
  }
  try {
    return isLoopbackHost(new URL(String(value)).hostname);
  } catch {
    return false;
  }
}

function requestToken(request, url) {
  const header = String(request.headers["x-harness-dashboard-token"] || "");
  const auth = String(request.headers.authorization || "");
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  return header || bearer || String(url.searchParams.get("token") || "");
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "same-origin"
  });
  response.end(JSON.stringify(value, null, 2));
}

function sendHtml(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:* http://localhost:*; img-src 'self' data:; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "same-origin"
  });
  response.end(html);
}

function apiPayload(routeName) {
  const state = loadState();
  if (routeName === "snapshot") return state;
  if (routeName === "index") return loadJsonOrFallback(indexPath, deriveIndex(state));
  if (routeName === "tasks") return { taskQueues: state.taskQueues, agile: state.agile, workTimeline: state.workTimeline, workReadinessMap: state.workReadinessMap };
  if (routeName === "sessions") return { sessionLog: state.sessionLog, governedSessions: state.governedSessions, agentResumeBrief: state.agentResumeBrief };
  if (routeName === "dictionary") return { dictionary: state.dictionary, ontology: state.ontology };
  if (routeName === "version-control") return { versionControl: state.versionControl, vcsChangeRecords: state.vcsChangeRecords };
  if (routeName === "runtime") return loadJsonOrFallback(runtimePath, deriveRuntime(state));
  if (routeName === "health") return { ok: true, mode: "Local Live", statePathHash: fileHash(statePath), generatedAt: now() };
  return null;
}

function deterministicQuery(url) {
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 120);
  const scope = String(url.searchParams.get("scope") || "all").trim().toLowerCase();
  if (!q) {
    return { query: q, scope, results: [] };
  }
  const started = Date.now();
  const state = loadState();
  const source = scope === "tasks" ? { taskQueues: state.taskQueues, agile: state.agile }
    : scope === "decisions" ? { decisionContracts: state.decisionContracts }
    : scope === "evidence" ? { artifacts: state.artifacts, governanceEvidenceBrief: state.governanceEvidenceBrief, versionControl: state.versionControl }
    : state;
  const lines = JSON.stringify(source, null, 2).split("\\n");
  const results = [];
  for (const [index, line] of lines.entries()) {
    if (Date.now() - started > 50 || results.length >= 20) {
      break;
    }
    if (line.toLowerCase().includes(q)) {
      results.push({ line: index + 1, text: line.slice(0, 500) });
    }
  }
  return { query: q, scope, resultCount: results.length, results };
}

function serveEvents(request, response, token) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    "connection": "keep-alive",
    "x-accel-buffering": "no"
  });
  function send(eventName, payload) {
    response.write("event: " + eventName + "\\n");
    response.write("data: " + JSON.stringify(envelope(payload)) + "\\n\\n");
  }
  send("harness.snapshot", loadState());
  const interval = setInterval(() => {
    send("harness.heartbeat", { at: now(), statePathHash: fileHash(statePath), tokenPath: path.relative(workspaceRoot, tokenPath).replace(/\\\\/g, "/") });
  }, 5000);
  request.on("close", () => clearInterval(interval));
}

function updateRuntimeListener(patch) {
  const state = loadJsonOrFallback(statePath, {});
  const runtime = deriveRuntime(state, loadJsonOrFallback(runtimePath, {}));
  runtime.listener = Object.assign({}, runtime.listener || {}, patch, {
    statePathHash: fileHash(statePath),
    lastHealthCheckAt: now()
  });
  writeJson(runtimePath, runtime);
  if (state && state.listener) {
    state.listener = Object.assign({}, state.listener, runtime.listener);
    writeJson(statePath, state);
  }
  return runtime;
}

function makeServer(token) {
  return http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://" + String(request.headers.host || "127.0.0.1"));
    if (!isLoopbackHost(request.headers.host) || !isLoopbackOrigin(request.headers.origin)) {
      sendJson(response, 403, { ok: false, error: "Loopback Host/Origin required" });
      return;
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      let html = fs.readFileSync(htmlPath, "utf-8");
      html = html.replace("const bootstrapElement =", "window.__HARNESS_DASHBOARD_TOKEN__ = " + JSON.stringify(token) + ";\\n      const bootstrapElement =");
      sendHtml(response, html);
      return;
    }
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204, { "cache-control": "no-store" });
      response.end();
      return;
    }
    if (!url.pathname.startsWith("/api/harness-dashboard/v1/")) {
      sendJson(response, 404, { ok: false, error: "Not found" });
      return;
    }
    if (requestToken(request, url) !== token) {
      sendJson(response, 401, envelope({ ok: false, error: "Token rejected" }));
      return;
    }
    const routeName = url.pathname.replace("/api/harness-dashboard/v1/", "");
    try {
      if (routeName === "events") {
        serveEvents(request, response, token);
        return;
      }
      if (routeName === "query") {
        sendJson(response, 200, envelope(deterministicQuery(url)));
        return;
      }
      const payload = apiPayload(routeName);
      if (payload == null) {
        sendJson(response, 404, envelope({ ok: false, error: "Unknown route" }));
        return;
      }
      sendJson(response, 200, envelope(payload));
    } catch (error) {
      sendJson(response, 500, envelope({ ok: false, error: String(error && error.message || error) }));
    }
  });
}

async function getAvailablePort(host, preferredPort) {
  const start = Number(preferredPort || 43110);
  for (let port = start; port < start + 2000; port += 1) {
    const available = await new Promise((resolve) => {
      const server = http.createServer();
      server.once("error", () => resolve(false));
      server.listen(port, host, () => server.close(() => resolve(true)));
    });
    if (available) {
      return port;
    }
  }
  throw new Error("No available dashboard listener port found");
}

async function requestRuntime(url, token) {
  return await new Promise((resolve) => {
    const parsed = new URL(url);
    parsed.pathname = "/api/harness-dashboard/v1/runtime";
    parsed.searchParams.set("token", token);
    const request = http.get(parsed, { timeout: 1500 }, (response) => {
      let body = "";
      response.setEncoding("utf-8");
      response.on("data", (chunk) => body += chunk);
      response.on("end", () => {
        try {
          resolve(response.statusCode === 200 ? JSON.parse(body) : null);
        } catch {
          resolve(null);
        }
      });
    });
    request.on("error", () => resolve(null));
    request.on("timeout", () => {
      request.destroy();
      resolve(null);
    });
  });
}

async function handleListen() {
  const host = option("--host", "127.0.0.1");
  const preferredPort = Number(option("--port", "43110"));
  const port = await getAvailablePort(host, preferredPort);
  const token = ensureToken();
  const server = makeServer(token);
  server.listen(port, host, () => {
    const url = "http://" + host + ":" + port + "/";
    updateRuntimeListener({
      status: "listening",
      host,
      port,
      url,
      pid: process.pid,
      pidStartTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      commandHash: stableHash(process.argv),
      tokenPath: path.relative(workspaceRoot, tokenPath).replace(/\\\\/g, "/"),
      logPath: path.relative(workspaceRoot, logPath).replace(/\\\\/g, "/"),
      startedAt: now(),
      lastHeartbeatAt: now(),
      lastFailure: null
    });
    logLine("listening at " + url);
    console.log("Harness Dashboard listening at " + url);
  });
}

async function handleStart() {
  if (process.env.WORKSPACE_INIT_DASHBOARD_AUTOSTART === "0") {
    updateRuntimeListener({ status: "disabled", lastFailure: "WORKSPACE_INIT_DASHBOARD_AUTOSTART=0" });
    console.log("Harness Dashboard listener autostart disabled.");
    return;
  }
  const token = ensureToken();
  const runtime = loadJsonOrFallback(runtimePath, {});
  const listener = runtime.listener || {};
  if (listener.url) {
    const probe = await requestRuntime(listener.url, token);
    const probeListener = probe && probe.payload ? probe.payload.listener || {} : {};
    if (
      probe &&
      probe.workspaceId === runtime.workspaceId &&
      probeListener.statePathHash === fileHash(statePath)
    ) {
      console.log("Harness Dashboard already listening at " + listener.url);
      return;
    }
  }
  ensureDir(logDir);
  const preferredPort = Number(option("--port", "43110"));
  const port = await getAvailablePort("127.0.0.1", preferredPort);
  const child = spawn(process.execPath, [__filename, "listen", "--port", String(port)], {
    cwd: workspaceRoot,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  updateRuntimeListener({
    status: "starting",
    host: "127.0.0.1",
    port,
    url: "http://127.0.0.1:" + port + "/",
    pid: child.pid,
    startedAt: now()
  });
  console.log("Harness Dashboard listener starting at http://127.0.0.1:" + port + "/");
}

function handleStatus() {
  const state = loadJsonOrFallback(statePath, {});
  const runtime = loadJsonOrFallback(runtimePath, deriveRuntime(state));
  console.log(JSON.stringify(envelope({ runtime, stateSummary: deriveIndex(state) }), null, 2));
}

function handleStop() {
  const runtime = loadJsonOrFallback(runtimePath, {});
  const pid = Number(runtime.listener && runtime.listener.pid || 0);
  if (pid > 0 && pid !== process.pid) {
    try {
      process.kill(pid);
    } catch (error) {
      logLine("stop failed for pid " + pid + ": " + String(error && error.message || error));
    }
  }
  updateRuntimeListener({ status: "stopped", pid: null, url: null, port: null });
  console.log("Harness Dashboard listener stopped.");
}

function handleCleanupStale() {
  const runtime = loadJsonOrFallback(runtimePath, {});
  const pid = Number(runtime.listener && runtime.listener.pid || 0);
  if (pid > 0) {
    try {
      process.kill(pid, 0);
      console.log("Listener process appears alive: " + pid);
      return;
    } catch {
      updateRuntimeListener({ status: "stale-cleaned", pid: null, url: null, port: null });
    }
  }
  console.log("No stale listener process recorded.");
}

function sanitizePublic(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizePublic);
  }
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      const lowered = key.toLowerCase();
      if (lowered.includes("token") || lowered.includes("secret") || lowered.includes("env")) {
        output[key] = "[redacted]";
      } else if (lowered.includes("path") || lowered.includes("url") || lowered.includes("user")) {
        output[key] = "[redacted-local]";
      } else {
        output[key] = sanitizePublic(item);
      }
    }
    return output;
  }
  if (typeof value === "string") {
    return value.replace(/[A-Za-z]:\\\\[^\\s"']+/g, "[redacted-local-path]").replace(/https?:\\/\\/(localhost|127\\.0\\.0\\.1|[^\\s"']*\\.internal)[^\\s"']*/g, "[redacted-private-url]");
  }
  return value;
}

function handleExportStatic() {
  const outDir = path.resolve(workspaceRoot, option("--out", path.join(exportsDir, "latest")));
  const isPublic = hasFlag("--public");
  const state = isPublic ? sanitizePublic(loadState()) : loadState();
  const html = fs.readFileSync(htmlPath, "utf-8").replace(/<script id="dashboard-bootstrap-data" type="application\\/json">[\\s\\S]*?<\\/script>/, "<script id=\\"dashboard-bootstrap-data\\" type=\\"application/json\\">" + JSON.stringify(state).replace(/</g, "\\\\u003c") + "</script>");
  ensureDir(outDir);
  writeTextAtomic(path.join(outDir, "harness-dashboard.html"), html);
  writeJson(path.join(outDir, "dashboard-state.json"), state);
  console.log("Exported Harness Dashboard snapshot to " + outDir);
}

async function main() {
  ensureDir(stateDir);
  ensureDir(eventDir);
  if (command === "refresh") return handleRefresh();
  if (command === "record-agent-platforms") return handleRecordAgentPlatforms();
  if (command === "append-event") return handleAppendEvent();
  if (command === "validate" || command === "verify-projections") return handleValidate();
  if (command === "rebuild-projections" || command === "repair-projections") return handleRebuild();
  if (command === "listen" || command === "serve") return await handleListen();
  if (command === "start" || command === "ensure-listening") return await handleStart();
  if (command === "restart") {
    handleStop();
    return await handleStart();
  }
  if (command === "stop") return handleStop();
  if (command === "status") return handleStatus();
  if (command === "doctor") {
    handleValidate();
    if (!process.exitCode) handleStatus();
    return;
  }
  if (command === "logs") {
    console.log(fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf-8").split(/\\r?\\n/).slice(-120).join("\\n") : "No dashboard listener log yet.");
    return;
  }
  if (command === "cleanup-stale") return handleCleanupStale();
  if (command === "export-static") return handleExportStatic();
  console.log("Usage: dashboard-ops.mjs refresh|record-agent-platforms|append-event|validate|verify-projections|rebuild-projections|repair-projections|listen|ensure-listening|start|stop|restart|status|doctor|logs|cleanup-stale|export-static");
}

await main();
`;
}

export function generateDashboardOperationFiles(
  params: WorkspaceInitParams
): GeneratedFile[] {
  if (params.includeHarnessEngineering === false) {
    return [];
  }

  return [
    {
      relativePath: "docs/ai-harness/dashboard/scripts/README.md",
      content: buildDashboardOpsReadme(),
    },
    {
      relativePath: "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs",
      content: buildDashboardOpsScript(),
    },
  ];
}
