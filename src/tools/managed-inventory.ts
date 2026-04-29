import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { type GeneratedFile } from "../types.js";
import { analyzeWorkspace } from "./status.js";

export const MANAGED_FILE_INVENTORY_PATH = ".github/ai-harness/managed-file-inventory.json";
export const MANAGED_INVENTORY_SCHEMA_VERSION = "1.0.0";
const TOOL_VERSION = "4.2.0";

export const MANAGED_JSON_MERGE_PATHS = new Set([
  "docs/ai-harness/dashboard/state/dashboard-state.json",
  "docs/ai-harness/runtime/state/session-index.json",
  "docs/ai-harness/runtime/state/active-session.json",
  "docs/ai-harness/runtime/state/current-work-packet.json",
  "docs/ai-harness/runtime/state/current-execution-bridge.json",
  "docs/ai-harness/runtime/state/current-native-execution.json",
  "docs/ai-harness/runtime/archive/archive-index.json",
]);

const LEGACY_RESOURCE_ROOTS = [
  ".cursor/skills",
  ".claude/skills",
  ".agents/skills",
  ".cursor/agents",
  ".claude/agents",
  ".agents/agents",
];

export interface ManagedFileInventoryEntry {
  path: string;
  contentSha256: string;
  bytes: number;
  strategy: "merge" | "replace";
  category: string;
}

export interface ManagedFileInventoryDocument {
  schemaVersion: string;
  generatedBy: string;
  generatedAt: string;
  entries: ManagedFileInventoryEntry[];
}

export interface ManagedFileInventoryReadResult {
  status: "present" | "missing" | "invalid";
  document: ManagedFileInventoryDocument | null;
  warnings: string[];
}

export interface WorkspaceUpgradeRiskAuditResult {
  workspacePath: string;
  riskLevel: "low" | "moderate" | "high";
  inventoryStatus: "present" | "missing" | "invalid";
  hasGit: boolean;
  gitDirty: boolean | null;
  modifiedManagedFiles: string[];
  missingManagedFiles: string[];
  legacyResourceRoots: string[];
  warnings: string[];
  suggestions: string[];
  recommendedReconcileFlags: {
    applyChanges: false;
    requireCleanGitWhenPresent: boolean;
    overwriteModifiedManagedFiles: false;
    importLegacyAgentResources: boolean;
    requireZeroManualReviewItemsForApply: boolean;
  };
  summary: string;
}

export interface ManagedSemanticDiffEntry {
  path: string;
  category: string;
  strategy: "merge" | "replace";
  status:
    | "unchanged"
    | "customized"
    | "missing"
    | "merge-unchanged"
    | "merge-diverged";
  baselineSha256: string;
  currentSha256: string | null;
  note: string;
}

export interface WorkspaceManagedSemanticDiffResult {
  workspacePath: string;
  inventoryStatus: "present" | "missing" | "invalid";
  entries: ManagedSemanticDiffEntry[];
  totals: {
    unchanged: number;
    customized: number;
    missing: number;
    mergeUnchanged: number;
    mergeDiverged: number;
  };
  warnings: string[];
  reportJsonPath: string | null;
  reportMarkdownPath: string | null;
  summary: string;
}

export interface ReconcilePreflightExportResult {
  workspacePath: string;
  riskAudit: WorkspaceUpgradeRiskAuditResult;
  semanticDiff: WorkspaceManagedSemanticDiffResult;
  reportJsonPath: string;
  reportMarkdownPath: string;
  reportHtmlPath: string;
  summary: string;
}

export function computeContentSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

function ensureDir(fullPath: string): void {
  fs.mkdirSync(fullPath, { recursive: true });
}

function classifyManagedPath(relativePath: string): string {
  if (relativePath.startsWith(".github/ai-harness/")) {
    return "governance";
  }
  if (relativePath.startsWith("docs/ai-harness/dashboard/")) {
    return "dashboard";
  }
  if (relativePath.startsWith("docs/ai-harness/runtime/")) {
    return "runtime";
  }
  if (relativePath.startsWith("docs/ai-harness/readiness/")) {
    return "readiness";
  }
  if (relativePath.startsWith(".github/skills/") || relativePath.startsWith(".github/agents/")) {
    return "canonical-catalog";
  }
  if (
    relativePath.startsWith(".cursor/") ||
    relativePath.startsWith(".claude/") ||
    relativePath.startsWith(".agents/")
  ) {
    return "ide-mirror";
  }
  if (relativePath.startsWith(".vscode/")) {
    return "ide-config";
  }
  if (relativePath.startsWith("docs/")) {
    return "docs";
  }
  if (relativePath === ".editorconfig" || relativePath === ".gitattributes") {
    return "workspace-config";
  }
  return "other";
}

function isInventoryEntry(value: unknown): value is ManagedFileInventoryEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ManagedFileInventoryEntry).path === "string" &&
    typeof (value as ManagedFileInventoryEntry).contentSha256 === "string" &&
    typeof (value as ManagedFileInventoryEntry).bytes === "number" &&
    ((value as ManagedFileInventoryEntry).strategy === "merge" ||
      (value as ManagedFileInventoryEntry).strategy === "replace") &&
    typeof (value as ManagedFileInventoryEntry).category === "string"
  );
}

function detectGitStatus(workspacePath: string): {
  hasGit: boolean;
  gitDirty: boolean | null;
  warning: string | null;
} {
  if (!fs.existsSync(path.join(workspacePath, ".git"))) {
    return {
      hasGit: false,
      gitDirty: null,
      warning: "No .git directory detected. Upgrade rollback will rely on migration backups only.",
    };
  }

  try {
    const output = execFileSync("git", ["status", "--porcelain"], {
      cwd: workspacePath,
      encoding: "utf-8",
      windowsHide: true,
    });
    return {
      hasGit: true,
      gitDirty: output.trim().length > 0,
      warning:
        output.trim().length > 0
          ? "Git working tree is not clean. Review or checkpoint local changes before applying upgrade writes."
          : null,
    };
  } catch {
    return {
      hasGit: true,
      gitDirty: null,
      warning: "Git repository detected, but git status could not be read from this environment.",
    };
  }
}

function readFileSha256(fullPath: string): string | null {
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  return computeContentSha256(content);
}

function listLegacyResourceRoots(workspacePath: string): string[] {
  return LEGACY_RESOURCE_ROOTS.filter((relativePath) => {
    const fullPath = path.join(workspacePath, relativePath);
    if (!fs.existsSync(fullPath)) {
      return false;
    }

    try {
      return fs.readdirSync(fullPath).length > 0;
    } catch {
      return true;
    }
  });
}

function buildManagedSemanticDiffPaths(workspacePath: string): {
  reportRoot: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  latestReportJsonPath: string;
  latestReportMarkdownPath: string;
} {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const migrationsRoot = path.join(
    workspacePath,
    "docs",
    "ai-harness",
    "migrations"
  );
  const reportRoot = path.join(migrationsRoot, `managed-semantic-diff-${timestamp}`);

  return {
    reportRoot,
    reportJsonPath: path.join(reportRoot, "managed-semantic-diff.json"),
    reportMarkdownPath: path.join(reportRoot, "managed-semantic-diff.md"),
    latestReportJsonPath: path.join(migrationsRoot, "latest-managed-semantic-diff.json"),
    latestReportMarkdownPath: path.join(migrationsRoot, "latest-managed-semantic-diff.md"),
  };
}

function buildReconcilePreflightPaths(workspacePath: string): {
  reportRoot: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  reportHtmlPath: string;
  latestReportJsonPath: string;
  latestReportMarkdownPath: string;
  latestReportHtmlPath: string;
} {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const migrationsRoot = path.join(
    workspacePath,
    "docs",
    "ai-harness",
    "migrations"
  );
  const reportRoot = path.join(migrationsRoot, `reconcile-preflight-${timestamp}`);

  return {
    reportRoot,
    reportJsonPath: path.join(reportRoot, "reconcile-preflight.json"),
    reportMarkdownPath: path.join(reportRoot, "reconcile-preflight.md"),
    reportHtmlPath: path.join(reportRoot, "reconcile-preflight.html"),
    latestReportJsonPath: path.join(migrationsRoot, "latest-reconcile-preflight.json"),
    latestReportMarkdownPath: path.join(migrationsRoot, "latest-reconcile-preflight.md"),
    latestReportHtmlPath: path.join(migrationsRoot, "latest-reconcile-preflight.html"),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildManagedSemanticDiffMarkdown(
  result: Omit<WorkspaceManagedSemanticDiffResult, "summary">
): string {
  const statusGroups: Array<{
    title: string;
    entries: ManagedSemanticDiffEntry[];
  }> = [
    {
      title: "Customized Replace-Managed Files",
      entries: result.entries.filter((entry) => entry.status === "customized"),
    },
    {
      title: "Missing Managed Files",
      entries: result.entries.filter((entry) => entry.status === "missing"),
    },
    {
      title: "Merge-Managed Files With Divergence",
      entries: result.entries.filter((entry) => entry.status === "merge-diverged"),
    },
  ];

  return [
    "# Managed Semantic Diff Report",
    "",
    `- Inventory status: ${result.inventoryStatus}`,
    `- Unchanged replace-managed files: ${result.totals.unchanged}`,
    `- Customized replace-managed files: ${result.totals.customized}`,
    `- Missing managed files: ${result.totals.missing}`,
    `- Merge-managed unchanged files: ${result.totals.mergeUnchanged}`,
    `- Merge-managed diverged files: ${result.totals.mergeDiverged}`,
    "",
    "## Warnings",
    ...(result.warnings.length > 0
      ? result.warnings.map((warning) => `- ${warning}`)
      : ["- none"]),
    "",
    ...statusGroups.flatMap((group) => [
      `## ${group.title}`,
      ...(group.entries.length > 0
        ? group.entries.map(
            (entry) =>
              `- \`${entry.path}\` [${entry.category} / ${entry.strategy}] - ${entry.note}`
          )
        : ["- none"]),
      "",
    ]),
  ].join("\n");
}

function buildReconcilePreflightMarkdown(result: {
  riskAudit: WorkspaceUpgradeRiskAuditResult;
  semanticDiff: WorkspaceManagedSemanticDiffResult;
}): string {
  const customizedEntries = result.semanticDiff.entries.filter(
    (entry) => entry.status === "customized"
  );
  const missingEntries = result.semanticDiff.entries.filter(
    (entry) => entry.status === "missing"
  );

  return [
    "# Reconcile Preflight Report",
    "",
    `- Workspace: ${result.riskAudit.workspacePath.replace(/\\/g, "/")}`,
    `- Risk level: ${result.riskAudit.riskLevel}`,
    `- Managed inventory: ${result.riskAudit.inventoryStatus}`,
    `- Git tracked: ${result.riskAudit.hasGit ? "yes" : "no"}`,
    `- Git dirty: ${
      result.riskAudit.gitDirty == null
        ? "unknown"
        : result.riskAudit.gitDirty
          ? "yes"
          : "no"
    }`,
    `- Customized managed files: ${result.semanticDiff.totals.customized}`,
    `- Missing managed files: ${result.semanticDiff.totals.missing}`,
    `- Merge-managed divergence: ${result.semanticDiff.totals.mergeDiverged}`,
    "",
    "## Recommended Reconcile Flags",
    `- applyChanges: ${String(result.riskAudit.recommendedReconcileFlags.applyChanges)}`,
    `- requireCleanGitWhenPresent: ${String(result.riskAudit.recommendedReconcileFlags.requireCleanGitWhenPresent)}`,
    `- overwriteModifiedManagedFiles: ${String(result.riskAudit.recommendedReconcileFlags.overwriteModifiedManagedFiles)}`,
    `- importLegacyAgentResources: ${String(result.riskAudit.recommendedReconcileFlags.importLegacyAgentResources)}`,
    `- requireZeroManualReviewItemsForApply: ${String(result.riskAudit.recommendedReconcileFlags.requireZeroManualReviewItemsForApply)}`,
    "",
    "## Suggestions",
    ...(result.riskAudit.suggestions.length > 0
      ? result.riskAudit.suggestions.map((item) => `- ${item}`)
      : ["- none"]),
    "",
    "## Warnings",
    ...(result.riskAudit.warnings.length > 0
      ? result.riskAudit.warnings.map((item) => `- ${item}`)
      : ["- none"]),
    "",
    "## Customized Managed Files",
    ...(customizedEntries.length > 0
      ? customizedEntries.map((entry) => `- \`${entry.path}\` - ${entry.note}`)
      : ["- none"]),
    "",
    "## Missing Managed Files",
    ...(missingEntries.length > 0
      ? missingEntries.map((entry) => `- \`${entry.path}\` - ${entry.note}`)
      : ["- none"]),
    "",
  ].join("\n");
}

function buildReconcilePreflightHtml(result: {
  riskAudit: WorkspaceUpgradeRiskAuditResult;
  semanticDiff: WorkspaceManagedSemanticDiffResult;
}): string {
  const customizedRows = result.semanticDiff.entries
    .filter((entry) => entry.status === "customized")
    .map(
      (entry) =>
        `<tr><td><code>${escapeHtml(entry.path)}</code></td><td>${escapeHtml(
          entry.category
        )}</td><td>${escapeHtml(entry.note)}</td></tr>`
    )
    .join("");
  const missingRows = result.semanticDiff.entries
    .filter((entry) => entry.status === "missing")
    .map(
      (entry) =>
        `<tr><td><code>${escapeHtml(entry.path)}</code></td><td>${escapeHtml(
          entry.category
        )}</td><td>${escapeHtml(entry.note)}</td></tr>`
    )
    .join("");
  const mergeDivergedRows = result.semanticDiff.entries
    .filter((entry) => entry.status === "merge-diverged")
    .map(
      (entry) =>
        `<tr><td><code>${escapeHtml(entry.path)}</code></td><td>${escapeHtml(
          entry.category
        )}</td><td>${escapeHtml(entry.note)}</td></tr>`
    )
    .join("");
  const riskClass =
    result.riskAudit.riskLevel === "high"
      ? "risk"
      : result.riskAudit.riskLevel === "moderate"
        ? "warning"
        : "ok";
  const gitDirtyLabel =
    result.riskAudit.gitDirty == null
      ? "unknown"
      : result.riskAudit.gitDirty
        ? "yes"
        : "no";
  const recommendations = [
    ["applyChanges", String(result.riskAudit.recommendedReconcileFlags.applyChanges)],
    [
      "requireCleanGitWhenPresent",
      String(result.riskAudit.recommendedReconcileFlags.requireCleanGitWhenPresent),
    ],
    [
      "overwriteModifiedManagedFiles",
      String(result.riskAudit.recommendedReconcileFlags.overwriteModifiedManagedFiles),
    ],
    [
      "importLegacyAgentResources",
      String(result.riskAudit.recommendedReconcileFlags.importLegacyAgentResources),
    ],
    [
      "requireZeroManualReviewItemsForApply",
      String(result.riskAudit.recommendedReconcileFlags.requireZeroManualReviewItemsForApply),
    ],
  ];
  const warningsMarkup =
    result.riskAudit.warnings.length > 0
      ? result.riskAudit.warnings
          .map(
            (item) =>
              `<li class="list-card"><strong>Warning</strong><div class="pill-note">${escapeHtml(
                item
              )}</div></li>`
          )
          .join("")
      : '<li class="list-card"><strong>No active warnings</strong><div class="pill-note">The preflight audit did not emit warnings beyond the current risk posture.</div></li>';
  const suggestionsMarkup =
    result.riskAudit.suggestions.length > 0
      ? result.riskAudit.suggestions
          .map(
            (item) =>
              `<li class="list-card"><strong>Suggested next step</strong><div class="pill-note">${escapeHtml(
                item
              )}</div></li>`
          )
          .join("")
      : '<li class="list-card"><strong>No additional suggestions</strong></li>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reconcile Preflight Report</title>
  <style>
    :root { --bg:#f3f5f7; --panel:#ffffff; --line:#d9e0e7; --text:#18212b; --muted:#51606f; --accent:#005a8d; --ok:#1f7a4d; --warn:#a86700; --risk:#b42318; --info:#0a66c2; --shadow:0 14px 40px rgba(24, 33, 43, 0.08); --radius:18px; }
    * { box-sizing:border-box; }
    body { margin:0; background:linear-gradient(180deg, #eef3f7 0%, var(--bg) 100%); color:var(--text); font-family:"Aptos", "Segoe UI", "Noto Sans KR", system-ui, sans-serif; line-height:1.5; }
    .page-shell { max-width:1440px; margin:0 auto; padding:28px; }
    .page-header { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; margin-bottom:24px; }
    .page-header h1 { margin:4px 0 10px; font-size:clamp(2rem, 2.5vw, 3rem); line-height:1.1; }
    .eyebrow { margin:0; font-size:0.84rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--accent); font-weight:700; }
    .lede, .meta-copy, .table-note, .pill-note { color:var(--muted); }
    .header-meta { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:10px; }
    .chip, .badge { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:999px; font-size:0.88rem; font-weight:600; background:#e9f2f9; color:var(--accent); }
    .badge.ok { background:rgba(31, 122, 77, 0.12); color:var(--ok); }
    .badge.warning { background:rgba(168, 103, 0, 0.14); color:var(--warn); }
    .badge.risk, .badge.error { background:rgba(180, 35, 24, 0.12); color:var(--risk); }
    .badge.info, .badge.active { background:rgba(10, 102, 194, 0.12); color:var(--info); }
    .dashboard-grid { display:grid; grid-template-columns:repeat(12, minmax(0, 1fr)); gap:18px; }
    .panel { grid-column:span 6; background:var(--panel); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); padding:20px; }
    .panel-wide { grid-column:span 12; }
    .panel h2 { margin:0 0 14px; font-size:1.1rem; }
    .split-metrics, .card-grid { display:grid; gap:12px; }
    .split-metrics { grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); }
    .card-grid { grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); }
    .metric-card, .info-card, .list-card { border:1px solid var(--line); border-radius:14px; padding:14px; background:#fbfcfd; }
    .metric-label, .info-label { display:block; margin-bottom:6px; color:var(--muted); font-size:0.88rem; }
    .metric-value { font-size:1.5rem; font-weight:700; }
    .stack { display:flex; flex-direction:column; gap:12px; }
    .row { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .list-reset { list-style:none; margin:0; padding:0; }
    .list-reset li + li { margin-top:10px; }
    .table-wrap { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { color:var(--muted); font-size:0.84rem; text-transform:uppercase; letter-spacing:0.06em; }
    code { font-family:"Cascadia Code", "Consolas", monospace; font-size:0.92em; color:var(--accent); }
    .mono { font-family:"Cascadia Code", "Consolas", monospace; }
    @media (max-width: 960px) { .page-shell { padding:18px; } .page-header { flex-direction:column; } .panel, .panel-wide { grid-column:span 12; } }
  </style>
</head>
<body>
  <div class="page-shell">
    <header class="page-header">
      <div>
        <p class="eyebrow">AI Harness Upgrade Preflight</p>
        <h1>Reconcile Preflight Report</h1>
        <p class="lede">Dashboard-style safety snapshot for legacy adoption and governed upgrade review before any reconcile apply run.</p>
        <p class="meta-copy"><strong>Workspace:</strong> <span class="mono">${escapeHtml(
          result.riskAudit.workspacePath.replace(/\\/g, "/")
        )}</span></p>
      </div>
      <div class="header-meta">
        <span class="chip">JSON-first</span>
        <span class="chip">HTML export</span>
        <span class="chip">Pre-apply gate</span>
      </div>
    </header>

    <main class="dashboard-grid">
      <section class="panel panel-wide">
        <h2>Executive Summary</h2>
        <div class="split-metrics">
          <div class="metric-card">
            <span class="metric-label">Risk Level</span>
            <div class="metric-value"><span class="badge ${riskClass}">${escapeHtml(
              result.riskAudit.riskLevel
            )}</span></div>
          </div>
          <div class="metric-card">
            <span class="metric-label">Managed Inventory</span>
            <div class="metric-value">${escapeHtml(result.riskAudit.inventoryStatus)}</div>
          </div>
          <div class="metric-card">
            <span class="metric-label">Git Dirty</span>
            <div class="metric-value">${escapeHtml(gitDirtyLabel)}</div>
          </div>
          <div class="metric-card">
            <span class="metric-label">Customized Managed Files</span>
            <div class="metric-value">${result.semanticDiff.totals.customized}</div>
          </div>
          <div class="metric-card">
            <span class="metric-label">Missing Managed Files</span>
            <div class="metric-value">${result.semanticDiff.totals.missing}</div>
          </div>
          <div class="metric-card">
            <span class="metric-label">Merge Divergence</span>
            <div class="metric-value">${result.semanticDiff.totals.mergeDiverged}</div>
          </div>
        </div>
        <p class="meta-copy"><strong>Legacy resource roots:</strong> ${result.riskAudit.legacyResourceRoots.length > 0 ? escapeHtml(result.riskAudit.legacyResourceRoots.join(", ")) : "none"}</p>
      </section>

      <section class="panel">
        <h2>Recommended Flags</h2>
        <div class="stack">
          ${recommendations
            .map(
              ([name, value]) => `
              <div class="row">
                <span class="mono">${escapeHtml(name)}</span>
                <span class="badge ${value === "true" ? "warning" : "ok"}">${escapeHtml(value)}</span>
              </div>`
            )
            .join("")}
        </div>
      </section>

      <section class="panel">
        <h2>Risk Guidance</h2>
        <ul class="list-reset">
          ${suggestionsMarkup}
        </ul>
      </section>

      <section class="panel panel-wide">
        <h2>Warnings</h2>
        <ul class="list-reset">
          ${warningsMarkup}
        </ul>
      </section>

      <section class="panel panel-wide">
        <h2>Customized Managed Files</h2>
        <p class="table-note">These are the highest-priority manual review candidates before a strict reconcile apply run.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Path</th><th>Category</th><th>Note</th></tr></thead>
            <tbody>${customizedRows || '<tr><td colspan="3">none</td></tr>'}</tbody>
          </table>
        </div>
      </section>

      <section class="panel panel-wide">
        <h2>Missing Managed Files</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Path</th><th>Category</th><th>Note</th></tr></thead>
            <tbody>${missingRows || '<tr><td colspan="3">none</td></tr>'}</tbody>
          </table>
        </div>
      </section>

      <section class="panel panel-wide">
        <h2>Merge-Diverged JSON State</h2>
        <p class="table-note">These files may be valid live state, but they should still be reviewed before replacing or normalizing them.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Path</th><th>Category</th><th>Note</th></tr></thead>
            <tbody>${mergeDivergedRows || '<tr><td colspan="3">none</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</body>
</html>
`;
}

export function buildManagedFileInventoryFile(files: GeneratedFile[]): GeneratedFile {
  const entries = files
    .filter((file) => file.relativePath !== MANAGED_FILE_INVENTORY_PATH)
    .slice()
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    .map((file) => ({
      path: file.relativePath,
      contentSha256: computeContentSha256(file.content),
      bytes: Buffer.byteLength(file.content, "utf-8"),
      strategy: (MANAGED_JSON_MERGE_PATHS.has(file.relativePath) ? "merge" : "replace") as
        | "merge"
        | "replace",
      category: classifyManagedPath(file.relativePath),
    }));

  const inventory: ManagedFileInventoryDocument = {
    schemaVersion: MANAGED_INVENTORY_SCHEMA_VERSION,
    generatedBy: `workspace-init-mcp@${TOOL_VERSION}`,
    generatedAt: "generated-at-runtime",
    entries,
  };

  return {
    relativePath: MANAGED_FILE_INVENTORY_PATH,
    content: `${JSON.stringify(inventory, null, 2)}\n`,
  };
}

export function readManagedFileInventory(
  workspacePath: string
): ManagedFileInventoryReadResult {
  const fullPath = path.join(workspacePath, MANAGED_FILE_INVENTORY_PATH);
  if (!fs.existsSync(fullPath)) {
    return {
      status: "missing",
      document: null,
      warnings: [
        "Managed file inventory is missing. The workspace may predate managed baseline tracking, so upgrade audits cannot distinguish generated drift from deliberate customization.",
      ],
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as ManagedFileInventoryDocument;
    if (
      parsed == null ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.entries) ||
      !parsed.entries.every((entry) => isInventoryEntry(entry))
    ) {
      return {
        status: "invalid",
        document: null,
        warnings: [
          "Managed file inventory exists but could not be validated. Treat upgrade writes as higher risk until the baseline is regenerated.",
        ],
      };
    }

    return {
      status: "present",
      document: parsed,
      warnings: [],
    };
  } catch {
    return {
      status: "invalid",
      document: null,
      warnings: [
        "Managed file inventory exists but could not be parsed. Treat upgrade writes as higher risk until the baseline is regenerated.",
      ],
    };
  }
}

export function buildManagedInventoryEntryMap(
  inventory: ManagedFileInventoryDocument | null
): Map<string, ManagedFileInventoryEntry> {
  return new Map((inventory?.entries ?? []).map((entry) => [entry.path, entry]));
}

export function auditWorkspaceUpgradeRisk(
  workspacePath: string
): WorkspaceUpgradeRiskAuditResult {
  const analysis = analyzeWorkspace(workspacePath);
  const inventory = readManagedFileInventory(workspacePath);
  const inventoryEntries = inventory.document?.entries ?? [];
  const modifiedManagedFiles: string[] = [];
  const missingManagedFiles: string[] = [];
  const warnings = [...inventory.warnings];
  const suggestions: string[] = [];
  const legacyResourceRoots = listLegacyResourceRoots(workspacePath);
  const gitStatus = detectGitStatus(workspacePath);

  if (gitStatus.warning != null) {
    warnings.push(gitStatus.warning);
  }

  for (const entry of inventoryEntries) {
    const fullPath = path.join(workspacePath, entry.path);
    if (!fs.existsSync(fullPath)) {
      missingManagedFiles.push(entry.path);
      continue;
    }

    if (entry.strategy !== "replace") {
      continue;
    }

    const currentHash = readFileSha256(fullPath);
    if (currentHash != null && currentHash !== entry.contentSha256) {
      modifiedManagedFiles.push(entry.path);
    }
  }

  if (gitStatus.hasGit && gitStatus.gitDirty === true) {
    suggestions.push("Commit or stash local changes before running reconcile with applyChanges: true.");
  }
  if (inventory.status !== "present") {
    suggestions.push("Run reconcile as a dry run first. This workspace is missing a trustworthy managed baseline.");
  }
  suggestions.push(
    "Preserve legacy application source during harness adoption; workspace-init-mcp should add or merge governance artifacts, not delete or replace business code."
  );
  if (modifiedManagedFiles.length > 0) {
    suggestions.push("Keep overwriteModifiedManagedFiles disabled and review customized managed files one by one.");
  }
  if (legacyResourceRoots.length > 0) {
    suggestions.push("Leave importLegacyAgentResources enabled so old IDE roots can be carried into the canonical .github registry.");
  }
  if (missingManagedFiles.length > 0) {
    suggestions.push("Use reconcile to restore missing managed artifacts after reviewing the dry-run report.");
  }
  if (suggestions.length === 0) {
    suggestions.push("The workspace looks ready for a low-risk dry run and then a gated reconcile apply.");
  }

  let riskScore = 0;
  if (gitStatus.gitDirty === true) {
    riskScore += 4;
  }
  if (inventory.status !== "present") {
    riskScore += 2;
  }
  if (modifiedManagedFiles.length > 0) {
    riskScore += 4;
  }
  if (legacyResourceRoots.length > 0) {
    riskScore += 1;
  }
  if (missingManagedFiles.length >= 10) {
    riskScore += 1;
  }

  const riskLevel =
    riskScore >= 6 ? "high" : riskScore >= 3 ? "moderate" : "low";

  const summary = [
    `Workspace upgrade risk audit: ${analysis.suggestedConfig.projectType}`,
    `Risk level: ${riskLevel}`,
    `Managed inventory: ${inventory.status}`,
    `Git tracked: ${gitStatus.hasGit ? "yes" : "no"}`,
    `Git dirty: ${gitStatus.gitDirty == null ? "unknown" : gitStatus.gitDirty ? "yes" : "no"}`,
    `Modified managed files: ${modifiedManagedFiles.length}`,
    `Missing managed files: ${missingManagedFiles.length}`,
    `Legacy resource roots: ${legacyResourceRoots.length}`,
    "",
    "Recommended reconcile flags:",
    "  - applyChanges: false",
    `  - requireCleanGitWhenPresent: ${gitStatus.hasGit ? "true" : "false"}`,
    "  - overwriteModifiedManagedFiles: false",
    `  - importLegacyAgentResources: ${legacyResourceRoots.length > 0 ? "true" : "false"}`,
    `  - requireZeroManualReviewItemsForApply: ${
      modifiedManagedFiles.length > 0 || inventory.status !== "present"
        ? "true"
        : "false"
    }`,
    ...(warnings.length > 0
      ? ["", "Warnings:", ...warnings.map((entry) => `  - ${entry}`)]
      : []),
    ...(modifiedManagedFiles.length > 0
      ? [
          "",
          "Modified managed files:",
          ...modifiedManagedFiles.map((entry) => `  - ${entry}`),
        ]
      : []),
    ...(missingManagedFiles.length > 0
      ? [
          "",
          "Missing managed files:",
          ...missingManagedFiles.map((entry) => `  - ${entry}`),
        ]
      : []),
    ...(legacyResourceRoots.length > 0
      ? [
          "",
          "Legacy resource roots:",
          ...legacyResourceRoots.map((entry) => `  - ${entry}`),
        ]
      : []),
  ].join("\n");

  return {
    workspacePath,
    riskLevel,
    inventoryStatus: inventory.status,
    hasGit: gitStatus.hasGit,
    gitDirty: gitStatus.gitDirty,
    modifiedManagedFiles,
    missingManagedFiles,
    legacyResourceRoots,
    warnings,
    suggestions,
    recommendedReconcileFlags: {
      applyChanges: false,
      requireCleanGitWhenPresent: gitStatus.hasGit,
      overwriteModifiedManagedFiles: false,
      importLegacyAgentResources: legacyResourceRoots.length > 0,
      requireZeroManualReviewItemsForApply:
        modifiedManagedFiles.length > 0 || inventory.status !== "present",
    },
    summary,
  };
}

export function auditWorkspaceManagedSemanticDiff(
  workspacePath: string,
  writeReport = false
): WorkspaceManagedSemanticDiffResult {
  const inventory = readManagedFileInventory(workspacePath);
  const warnings = [...inventory.warnings];
  const entries: ManagedSemanticDiffEntry[] = [];

  for (const entry of inventory.document?.entries ?? []) {
    const fullPath = path.join(workspacePath, entry.path);
    const currentHash = readFileSha256(fullPath);

    if (currentHash == null) {
      entries.push({
        path: entry.path,
        category: entry.category,
        strategy: entry.strategy,
        status: "missing",
        baselineSha256: entry.contentSha256,
        currentSha256: null,
        note: "Managed file is missing from the workspace.",
      });
      continue;
    }

    if (entry.strategy === "merge") {
      const status = currentHash === entry.contentSha256
        ? "merge-unchanged"
        : "merge-diverged";
      entries.push({
        path: entry.path,
        category: entry.category,
        strategy: entry.strategy,
        status,
        baselineSha256: entry.contentSha256,
        currentSha256: currentHash,
        note:
          status === "merge-unchanged"
            ? "Merge-managed JSON still matches the baseline snapshot."
            : "Merge-managed JSON has diverged from the baseline, which may be valid governed state but should be reviewed before upgrades.",
      });
      continue;
    }

    const unchanged = currentHash === entry.contentSha256;
    entries.push({
      path: entry.path,
      category: entry.category,
      strategy: entry.strategy,
      status: unchanged ? "unchanged" : "customized",
      baselineSha256: entry.contentSha256,
      currentSha256: currentHash,
      note: unchanged
        ? "Replace-managed file still matches the generated baseline."
        : "Replace-managed file no longer matches the baseline and should be treated as a customization unless reviewed otherwise.",
    });
  }

  const resultBase = {
    workspacePath,
    inventoryStatus: inventory.status,
    entries,
    totals: {
      unchanged: entries.filter((entry) => entry.status === "unchanged").length,
      customized: entries.filter((entry) => entry.status === "customized").length,
      missing: entries.filter((entry) => entry.status === "missing").length,
      mergeUnchanged: entries.filter((entry) => entry.status === "merge-unchanged").length,
      mergeDiverged: entries.filter((entry) => entry.status === "merge-diverged").length,
    },
    warnings,
    reportJsonPath: null,
    reportMarkdownPath: null,
  } satisfies Omit<WorkspaceManagedSemanticDiffResult, "summary">;

  let reportJsonPath: string | null = null;
  let reportMarkdownPath: string | null = null;
  if (writeReport) {
    const paths = buildManagedSemanticDiffPaths(workspacePath);
    ensureDir(paths.reportRoot);
    const json = `${JSON.stringify(resultBase, null, 2)}\n`;
    const markdown = buildManagedSemanticDiffMarkdown(resultBase);
    fs.writeFileSync(paths.reportJsonPath, json, "utf-8");
    fs.writeFileSync(paths.reportMarkdownPath, markdown, "utf-8");
    fs.writeFileSync(paths.latestReportJsonPath, json, "utf-8");
    fs.writeFileSync(paths.latestReportMarkdownPath, markdown, "utf-8");
    reportJsonPath = path.relative(workspacePath, paths.reportJsonPath).replace(/\\/g, "/");
    reportMarkdownPath = path.relative(workspacePath, paths.reportMarkdownPath).replace(/\\/g, "/");
  }

  const summary = [
    "Workspace managed semantic diff audit complete.",
    `Inventory status: ${inventory.status}`,
    `Customized replace-managed files: ${resultBase.totals.customized}`,
    `Missing managed files: ${resultBase.totals.missing}`,
    `Merge-managed diverged files: ${resultBase.totals.mergeDiverged}`,
    reportJsonPath != null ? `Report: ${reportJsonPath}` : "Report: disabled",
    ...(warnings.length > 0
      ? ["", "Warnings:", ...warnings.map((warning) => `  - ${warning}`)]
      : []),
  ].join("\n");

  return {
    ...resultBase,
    reportJsonPath,
    reportMarkdownPath,
    summary,
  };
}

export function exportReconcilePreflightReport(
  workspacePath: string
): ReconcilePreflightExportResult {
  const riskAudit = auditWorkspaceUpgradeRisk(workspacePath);
  const semanticDiff = auditWorkspaceManagedSemanticDiff(workspacePath, false);
  const paths = buildReconcilePreflightPaths(workspacePath);
  ensureDir(paths.reportRoot);

  const report = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    workspacePath: workspacePath.replace(/\\/g, "/"),
    riskAudit,
    semanticDiff: {
      inventoryStatus: semanticDiff.inventoryStatus,
      totals: semanticDiff.totals,
      entries: semanticDiff.entries,
      warnings: semanticDiff.warnings,
    },
  };
  const reportJson = `${JSON.stringify(report, null, 2)}\n`;
  const reportMarkdown = buildReconcilePreflightMarkdown({
    riskAudit,
    semanticDiff,
  });
  const reportHtml = buildReconcilePreflightHtml({
    riskAudit,
    semanticDiff,
  });

  fs.writeFileSync(paths.reportJsonPath, reportJson, "utf-8");
  fs.writeFileSync(paths.reportMarkdownPath, reportMarkdown, "utf-8");
  fs.writeFileSync(paths.reportHtmlPath, reportHtml, "utf-8");
  fs.writeFileSync(paths.latestReportJsonPath, reportJson, "utf-8");
  fs.writeFileSync(paths.latestReportMarkdownPath, reportMarkdown, "utf-8");
  fs.writeFileSync(paths.latestReportHtmlPath, reportHtml, "utf-8");

  const reportJsonPath = path.relative(workspacePath, paths.reportJsonPath).replace(/\\/g, "/");
  const reportMarkdownPath = path
    .relative(workspacePath, paths.reportMarkdownPath)
    .replace(/\\/g, "/");
  const reportHtmlPath = path.relative(workspacePath, paths.reportHtmlPath).replace(/\\/g, "/");

  return {
    workspacePath,
    riskAudit,
    semanticDiff,
    reportJsonPath,
    reportMarkdownPath,
    reportHtmlPath,
    summary: [
      "Reconcile preflight report exported.",
      `Risk level: ${riskAudit.riskLevel}`,
      `Managed inventory: ${riskAudit.inventoryStatus}`,
      `Customized managed files: ${semanticDiff.totals.customized}`,
      `Missing managed files: ${semanticDiff.totals.missing}`,
      `Report JSON: ${reportJsonPath}`,
      `Report Markdown: ${reportMarkdownPath}`,
      `Report HTML: ${reportHtmlPath}`,
    ].join("\n"),
  };
}
