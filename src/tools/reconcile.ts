import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { collectFiles } from "./initialize.js";
import { analyzeWorkspace } from "./status.js";
import { resolveWorkspaceTargetIDEs } from "./agent-skills-install.js";
import {
  auditWorkspaceUpgradeRisk,
  auditWorkspaceManagedSemanticDiff,
  buildManagedInventoryEntryMap,
  computeContentSha256,
  MANAGED_JSON_MERGE_PATHS,
  readManagedFileInventory,
  type WorkspaceManagedSemanticDiffResult,
  type WorkspaceUpgradeRiskAuditResult,
} from "./managed-inventory.js";
import {
  isUnsafeWorkspaceRelativePath,
  normalizeWorkspaceRelativePath,
} from "./generated-file-safety.js";
import {
  type FileEncoding,
  type LineEnding,
  type WorkspaceInitParams,
  type TargetIDE,
  type GovernanceProfile,
  type AutonomyMode,
  type TokenBudget,
} from "../types.js";

export interface ReconcileWorkspaceOptions extends Partial<WorkspaceInitParams> {
  workspacePath: string;
  applyChanges?: boolean;
  archiveManagedFiles?: boolean;
  importLegacyAgentResources?: boolean;
  overwriteManagedFiles?: boolean;
  overwriteModifiedManagedFiles?: boolean;
  writeMigrationReport?: boolean;
  writeSemanticDiffReport?: boolean;
  requireCleanGitWhenPresent?: boolean;
  requireZeroManualReviewItemsForApply?: boolean;
}

export interface ReconcileWorkspaceResult {
  workspacePath: string;
  resolvedConfig: WorkspaceInitParams;
  applied: boolean;
  writtenFiles: string[];
  mergedFiles: string[];
  overwrittenFiles: string[];
  unchangedFiles: string[];
  archivedFiles: string[];
  importedLegacyResources: string[];
  modifiedManagedFiles: string[];
  manualReviewFiles: string[];
  warnings: string[];
  inventoryStatus: "present" | "missing" | "invalid";
  semanticDiffTotals: {
    unchanged: number;
    customized: number;
    missing: number;
    mergeUnchanged: number;
    mergeDiverged: number;
  };
  semanticDiffReportJsonPath: string | null;
  semanticDiffReportMarkdownPath: string | null;
  reportJsonPath: string | null;
  reportMarkdownPath: string | null;
  summary: string;
}

interface ReconcileBackupFile {
  originalPath: string;
  backupPath: string;
}

interface PendingReconcileWrite {
  relativePath: string;
  fullPath: string;
  content: string;
  archiveBeforeWrite: boolean;
}

type ReconcileExistingFilePolicy = "replace" | "merge" | "hold";

interface ReconcilePolicyDefaults {
  managedJsonState: ReconcileExistingFilePolicy;
  managedFileRefresh: ReconcileExistingFilePolicy;
  modifiedManagedFile: ReconcileExistingFilePolicy;
}

interface ReconcilePolicyRule {
  id: string;
  matchType: "exact" | "prefix" | "suffix" | "glob";
  pattern: string;
  policy: ReconcileExistingFilePolicy;
  reason: string;
}

interface ReconcilePolicyPreset {
  description?: string;
  defaults?: Partial<ReconcilePolicyDefaults>;
  rules?: ReconcilePolicyRule[];
}

interface ReconcilePolicyDocument {
  schemaVersion: string;
  generatedAt: string;
  activePreset?: string;
  nonDestructiveAdoption?: {
    mode: string;
    protectedIntent: string;
    protectedSourceRoots: string[];
  };
  defaults: ReconcilePolicyDefaults;
  presets?: Record<string, ReconcilePolicyPreset>;
  rules: ReconcilePolicyRule[];
  notes?: string[];
}

interface ResolvedReconcilePolicy {
  policy: ReconcileExistingFilePolicy;
  source: string;
  reason: string;
}

export interface RestoreReconcileBackupResult {
  workspacePath: string;
  restoredFiles: string[];
  reportJsonPath: string;
  summary: string;
}

interface ReconcilePreflightDryRunPlan {
  applied: false;
  writtenFiles: string[];
  mergedFiles: string[];
  overwrittenFiles: string[];
  modifiedManagedFiles: string[];
  manualReviewFiles: string[];
  plannedLegacyResources: string[];
  warnings: string[];
  inventoryStatus: "present" | "missing" | "invalid";
  summary: string;
}

export interface ReconcilePreflightExportResult {
  workspacePath: string;
  riskAudit: WorkspaceUpgradeRiskAuditResult;
  semanticDiff: WorkspaceManagedSemanticDiffResult;
  dryRunPlan: ReconcilePreflightDryRunPlan;
  reportJsonPath: string;
  reportMarkdownPath: string;
  reportHtmlPath: string;
  summary: string;
}

const RECONCILE_VERSION = "4.2.1";
const RECONCILE_POLICY_PATH = ".github/ai-harness/reconcile-policy.json";

const LEGACY_RESOURCE_ROOTS: Array<{
  kind: "skill" | "agent";
  label: string;
  relativePath: string;
}> = [
  { kind: "skill", label: "cursor", relativePath: ".cursor/skills" },
  { kind: "skill", label: "claude-code", relativePath: ".claude/skills" },
  { kind: "skill", label: "openhands", relativePath: ".agents/skills" },
  { kind: "agent", label: "cursor", relativePath: ".cursor/agents" },
  { kind: "agent", label: "claude-code", relativePath: ".claude/agents" },
  { kind: "agent", label: "openhands", relativePath: ".agents/agents" },
];

function writeFileWithEncoding(
  fullPath: string,
  content: string,
  encoding: FileEncoding
): void {
  if (encoding === "utf-8-bom") {
    fs.writeFileSync(fullPath, "\uFEFF" + content, "utf-8");
    return;
  }

  fs.writeFileSync(fullPath, content, encoding as BufferEncoding);
}

function ensureDir(fullPath: string): void {
  fs.mkdirSync(fullPath, { recursive: true });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function readJsonIfExists<T>(fullPath: string): T | null {
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function isReconcilePolicyValue(value: unknown): value is ReconcileExistingFilePolicy {
  return value === "replace" || value === "merge" || value === "hold";
}

function isReconcilePolicyDefaults(value: unknown): value is ReconcilePolicyDefaults {
  return (
    isPlainObject(value) &&
    isReconcilePolicyValue(value.managedJsonState) &&
    isReconcilePolicyValue(value.managedFileRefresh) &&
    isReconcilePolicyValue(value.modifiedManagedFile)
  );
}

function isPartialReconcilePolicyDefaults(
  value: unknown
): value is Partial<ReconcilePolicyDefaults> {
  return (
    isPlainObject(value) &&
    (value.managedJsonState === undefined ||
      isReconcilePolicyValue(value.managedJsonState)) &&
    (value.managedFileRefresh === undefined ||
      isReconcilePolicyValue(value.managedFileRefresh)) &&
    (value.modifiedManagedFile === undefined ||
      isReconcilePolicyValue(value.modifiedManagedFile))
  );
}

function isReconcilePolicyRule(value: unknown): value is ReconcilePolicyRule {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    ["exact", "prefix", "suffix", "glob"].includes(String(value.matchType)) &&
    typeof value.pattern === "string" &&
    isReconcilePolicyValue(value.policy) &&
    typeof value.reason === "string"
  );
}

function isReconcilePolicyPreset(value: unknown): value is ReconcilePolicyPreset {
  return (
    isPlainObject(value) &&
    (value.description === undefined || typeof value.description === "string") &&
    (value.defaults === undefined || isPartialReconcilePolicyDefaults(value.defaults)) &&
    (value.rules === undefined ||
      (Array.isArray(value.rules) &&
        value.rules.every((rule) => isReconcilePolicyRule(rule))))
  );
}

function isReconcilePolicyNonDestructiveAdoption(
  value: unknown
): value is NonNullable<ReconcilePolicyDocument["nonDestructiveAdoption"]> {
  return (
    isPlainObject(value) &&
    typeof value.mode === "string" &&
    typeof value.protectedIntent === "string" &&
    Array.isArray(value.protectedSourceRoots) &&
    value.protectedSourceRoots.every(
      (root) =>
        typeof root === "string" &&
        root.trim().length > 0 &&
        !isUnsafeWorkspaceRelativePath(root)
    )
  );
}

function areReconcilePolicyPresets(
  value: unknown
): value is Record<string, ReconcilePolicyPreset> {
  return (
    isPlainObject(value) &&
    Object.values(value).every((preset) => isReconcilePolicyPreset(preset))
  );
}

function buildDefaultReconcilePolicy(): ReconcilePolicyDocument {
  return {
    schemaVersion: "1.0.0",
    generatedAt: "generated-at-runtime",
    activePreset: "balanced",
    nonDestructiveAdoption: {
      mode: "harness-overlay",
      protectedIntent:
        "workspace-init-mcp adds governance, documentation, IDE, and runtime harness artifacts around an existing project. It must not delete, truncate, move, or replace legacy application source.",
      protectedSourceRoots: [
        "src/",
        "app/",
        "apps/",
        "lib/",
        "packages/",
        "services/",
        "server/",
        "client/",
        "frontend/",
        "backend/",
        "api/",
        "web/",
        "mobile/",
      ],
    },
    defaults: {
      managedJsonState: "merge",
      managedFileRefresh: "replace",
      modifiedManagedFile: "hold",
    },
    presets: {
      conservative: {
        description:
          "Prefer manual review for drifted governed files while still allowing safe JSON state merges.",
        defaults: {
          managedJsonState: "merge",
          managedFileRefresh: "hold",
          modifiedManagedFile: "hold",
        },
      },
      balanced: {
        description:
          "Refresh generated baselines, merge live JSON state, and hold customized governed files.",
        defaults: {
          managedJsonState: "merge",
          managedFileRefresh: "replace",
          modifiedManagedFile: "hold",
        },
      },
      "refresh-heavy": {
        description:
          "Favor baseline refresh after an operator has reviewed preflight output and accepted stronger automation.",
        defaults: {
          managedJsonState: "merge",
          managedFileRefresh: "replace",
          modifiedManagedFile: "replace",
        },
      },
    },
    rules: [
      {
        id: "operating-model-hold",
        matchType: "exact",
        pattern: ".github/ai-harness/operating-model.md",
        policy: "hold",
        reason:
          "Operating model documents often capture approved local customization and should not be auto-refreshed silently.",
      },
      {
        id: "manifest-hold",
        matchType: "exact",
        pattern: ".github/ai-harness/harness-manifest.yaml",
        policy: "hold",
        reason:
          "Harness manifests can encode workspace-specific governance decisions and should stay in manual review when drifted.",
      },
      {
        id: "inventory-replace",
        matchType: "exact",
        pattern: ".github/ai-harness/managed-file-inventory.json",
        policy: "replace",
        reason: "Managed inventory should refresh with the newest generated baseline.",
      },
      {
        id: "legacy-source-src-hold",
        matchType: "prefix",
        pattern: "src/",
        policy: "hold",
        reason:
          "Legacy application source is outside the harness ownership boundary and must never be refreshed by workspace-init-mcp.",
      },
      {
        id: "legacy-source-app-hold",
        matchType: "prefix",
        pattern: "app/",
        policy: "hold",
        reason:
          "Application source is outside the harness ownership boundary and must never be refreshed by workspace-init-mcp.",
      },
      {
        id: "legacy-source-packages-hold",
        matchType: "prefix",
        pattern: "packages/",
        policy: "hold",
        reason:
          "Package source is outside the harness ownership boundary and must never be refreshed by workspace-init-mcp.",
      },
      {
        id: "dashboard-state-merge",
        matchType: "prefix",
        pattern: "docs/ai-harness/dashboard/state/",
        policy: "merge",
        reason: "Dashboard state is live governed JSON and should be merged instead of replaced.",
      },
      {
        id: "runtime-state-merge",
        matchType: "prefix",
        pattern: "docs/ai-harness/runtime/state/",
        policy: "merge",
        reason: "Runtime state is live governed session evidence and should be merged.",
      },
      {
        id: "readiness-json-merge",
        matchType: "glob",
        pattern: "docs/ai-harness/readiness/*.json",
        policy: "merge",
        reason: "Readiness JSON should preserve live state through merge-oriented reconcile.",
      },
    ],
  };
}

function withDefaultNonDestructiveAdoption(
  document: ReconcilePolicyDocument
): ReconcilePolicyDocument {
  if (document.nonDestructiveAdoption != null) {
    return document;
  }

  return {
    ...document,
    nonDestructiveAdoption:
      buildDefaultReconcilePolicy().nonDestructiveAdoption,
  };
}

function loadReconcilePolicy(workspacePath: string): {
  document: ReconcilePolicyDocument;
  source: string;
  warnings: string[];
} {
  const fullPath = path.join(workspacePath, RECONCILE_POLICY_PATH);
  if (!fs.existsSync(fullPath)) {
    return {
      document: buildDefaultReconcilePolicy(),
      source: "built-in-default",
      warnings: [
        "Reconcile policy file is missing. Falling back to the built-in safety policy.",
      ],
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as ReconcilePolicyDocument;
    if (
      !isPlainObject(parsed) ||
      !isReconcilePolicyDefaults(parsed.defaults) ||
      !Array.isArray(parsed.rules) ||
      !parsed.rules.every((rule) => isReconcilePolicyRule(rule)) ||
      (parsed.nonDestructiveAdoption !== undefined &&
        !isReconcilePolicyNonDestructiveAdoption(parsed.nonDestructiveAdoption)) ||
      (parsed.presets !== undefined && !areReconcilePolicyPresets(parsed.presets)) ||
      (parsed.activePreset !== undefined && typeof parsed.activePreset !== "string")
    ) {
      return {
        document: buildDefaultReconcilePolicy(),
        source: "built-in-default",
        warnings: [
          "Reconcile policy file exists but could not be validated. Falling back to the built-in safety policy.",
        ],
      };
    }

    const warnings: string[] = [];
    if (parsed.nonDestructiveAdoption == null) {
      warnings.push(
        "Reconcile policy is missing nonDestructiveAdoption.protectedSourceRoots. Using the built-in protected source root guard."
      );
    }
    let document = withDefaultNonDestructiveAdoption(parsed);
    let source = RECONCILE_POLICY_PATH;
    if (parsed.activePreset != null && parsed.activePreset.length > 0) {
      const preset = parsed.presets?.[parsed.activePreset];
      if (preset == null) {
        warnings.push(
          `Reconcile policy activePreset '${parsed.activePreset}' was not found. Using document defaults and rules.`
        );
      } else {
        document = {
          ...parsed,
          defaults: {
            ...parsed.defaults,
            ...(preset.defaults ?? {}),
          },
          rules: [
            ...(preset.rules ?? []),
            ...parsed.rules,
          ],
        };
        source = `${RECONCILE_POLICY_PATH}#preset:${parsed.activePreset}`;
      }
    }

    return {
      document,
      source,
      warnings,
    };
  } catch {
    return {
      document: buildDefaultReconcilePolicy(),
      source: "built-in-default",
      warnings: [
        "Reconcile policy file exists but could not be parsed. Falling back to the built-in safety policy.",
      ],
    };
  }
}

function matchesReconcilePattern(
  relativePath: string,
  rule: ReconcilePolicyRule
): boolean {
  switch (rule.matchType) {
    case "exact":
      return relativePath === rule.pattern;
    case "prefix":
      return relativePath.startsWith(rule.pattern);
    case "suffix":
      return relativePath.endsWith(rule.pattern);
    case "glob": {
      const regexBody = rule.pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      return new RegExp(`^${regexBody}$`).test(relativePath);
    }
    default:
      return false;
  }
}

function resolveProtectedSourceRootForPath(
  relativePath: string,
  policyDocument: ReconcilePolicyDocument
): string | null {
  const protectedRoots =
    policyDocument.nonDestructiveAdoption?.protectedSourceRoots ?? [];
  const normalizedPath = normalizeWorkspaceRelativePath(relativePath).toLowerCase();

  for (const root of protectedRoots) {
    const normalizedRoot = normalizeWorkspaceRelativePath(root).toLowerCase();
    const rootPrefix = normalizedRoot.endsWith("/")
      ? normalizedRoot
      : `${normalizedRoot}/`;
    const rootName = rootPrefix.replace(/\/$/, "");
    if (normalizedPath === rootName || normalizedPath.startsWith(rootPrefix)) {
      return rootPrefix;
    }
  }

  return null;
}

function resolveReconcilePolicyForPath(
  relativePath: string,
  policyDocument: ReconcilePolicyDocument,
  policySource: string,
  isManagedJson: boolean,
  isModifiedManagedFile: boolean
): ResolvedReconcilePolicy {
  const protectedSourceRoot = resolveProtectedSourceRootForPath(
    relativePath,
    policyDocument
  );
  if (protectedSourceRoot != null) {
    return {
      policy: "hold",
      source: `${policySource}:nonDestructiveAdoption.protectedSourceRoots`,
      reason: `Application source under ${protectedSourceRoot} is outside the harness ownership boundary and requires an explicit implementation contract before reconcile may replace it.`,
    };
  }

  for (const rule of policyDocument.rules) {
    if (matchesReconcilePattern(relativePath, rule)) {
      return {
        policy: rule.policy,
        source: `${policySource}:${rule.id}`,
        reason: rule.reason,
      };
    }
  }

  if (isManagedJson) {
    return {
      policy: policyDocument.defaults.managedJsonState,
      source: `${policySource}:defaults.managedJsonState`,
      reason: "Default policy for managed JSON state files.",
    };
  }

  if (isModifiedManagedFile) {
    return {
      policy: policyDocument.defaults.modifiedManagedFile,
      source: `${policySource}:defaults.modifiedManagedFile`,
      reason: "Default policy for customized managed files.",
    };
  }

  return {
    policy: policyDocument.defaults.managedFileRefresh,
    source: `${policySource}:defaults.managedFileRefresh`,
    reason: "Default policy for managed file refresh.",
  };
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseSimpleYamlArrayManifest(raw: string): {
  scalars: Record<string, string>;
  arrays: Record<string, string[]>;
} {
  const scalars: Record<string, string> = {};
  const arrays: Record<string, string[]> = {};
  let currentArrayKey: string | null = null;

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }

    const topLevelMatch = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (topLevelMatch != null) {
      const [, key, rest] = topLevelMatch;
      if (rest.trim() === "") {
        currentArrayKey = key;
        arrays[key] = arrays[key] ?? [];
      } else {
        currentArrayKey = null;
        scalars[key] = stripQuotes(rest);
      }
      continue;
    }

    const arrayMatch = currentArrayKey != null
      ? /^\s*-\s*(.+)$/.exec(line)
      : null;
    if (arrayMatch != null) {
      arrays[currentArrayKey!] = arrays[currentArrayKey!] ?? [];
      arrays[currentArrayKey!].push(stripQuotes(arrayMatch[1]));
      continue;
    }

    if (/^\S/.test(line)) {
      currentArrayKey = null;
    }
  }

  return { scalars, arrays };
}

function readExistingHarnessManifest(workspacePath: string): Partial<WorkspaceInitParams> {
  const manifestPath = path.join(
    workspacePath,
    ".github",
    "ai-harness",
    "harness-manifest.yaml"
  );
  if (!fs.existsSync(manifestPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const parsed = parseSimpleYamlArrayManifest(raw);
    return {
      workspaceName: parsed.scalars.workspace_name,
      purpose: parsed.scalars.purpose,
      projectType: parsed.scalars.project_type as WorkspaceInitParams["projectType"],
      harnessProfile: parsed.scalars.harness_profile as WorkspaceInitParams["harnessProfile"],
      governanceProfile: parsed.scalars.governance_profile as GovernanceProfile,
      autonomyMode: parsed.scalars.autonomy_mode as AutonomyMode,
      tokenBudget: parsed.scalars.token_budget as TokenBudget,
      primaryDomains: parsed.arrays.primary_domains,
      techStack: parsed.arrays.tech_stack?.filter((entry) => entry !== "TBD"),
      plannedTasks: parsed.arrays.planned_tasks?.filter((entry) => entry !== "TBD"),
    };
  } catch {
    return {};
  }
}

function readExistingDashboardConfig(workspacePath: string): Partial<WorkspaceInitParams> {
  const dashboardPath = path.join(
    workspacePath,
    "docs",
    "ai-harness",
    "dashboard",
    "state",
    "dashboard-state.json"
  );
  const parsed = readJsonIfExists<Record<string, unknown>>(dashboardPath);
  if (parsed == null || !isPlainObject(parsed.workspace)) {
    return {};
  }

  const workspace = parsed.workspace;
  const primaryDomains = Array.isArray(workspace.primaryDomains)
    ? workspace.primaryDomains
        .filter((entry): entry is string => typeof entry === "string")
    : undefined;
  const techStack = Array.isArray(workspace.techStack)
    ? workspace.techStack
        .filter((entry): entry is string => typeof entry === "string")
    : undefined;
  const targetIDEs = Array.isArray(workspace.targetIDEs)
    ? workspace.targetIDEs
        .filter((entry): entry is TargetIDE => typeof entry === "string")
    : undefined;

  return {
    workspaceName: typeof workspace.name === "string" ? workspace.name : undefined,
    purpose: typeof workspace.purpose === "string" ? workspace.purpose : undefined,
    projectType:
      typeof workspace.projectType === "string"
        ? (workspace.projectType as WorkspaceInitParams["projectType"])
        : undefined,
    primaryDomains,
    techStack,
    targetIDEs,
    harnessProfile:
      typeof workspace.harnessProfile === "string"
        ? (workspace.harnessProfile as WorkspaceInitParams["harnessProfile"])
        : undefined,
    governanceProfile:
      typeof workspace.governanceProfile === "string"
        ? (workspace.governanceProfile as GovernanceProfile)
        : undefined,
    autonomyMode:
      typeof workspace.autonomyMode === "string"
        ? (workspace.autonomyMode as AutonomyMode)
        : undefined,
  };
}

function readPackageMetadata(workspacePath: string): {
  name?: string;
  description?: string;
  techStack: string[];
} {
  const packagePath = path.join(workspacePath, "package.json");
  if (!fs.existsSync(packagePath)) {
    return { techStack: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, "utf-8")) as {
      name?: string;
      description?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      name: parsed.name,
      description: parsed.description,
      techStack: uniqueStrings([
        ...Object.keys(parsed.dependencies ?? {}),
        ...Object.keys(parsed.devDependencies ?? {}),
      ]),
    };
  } catch {
    return { techStack: [] };
  }
}

function mergeGeneratedState(baseValue: unknown, existingValue: unknown): unknown {
  if (existingValue === undefined) {
    return baseValue;
  }

  if (Array.isArray(baseValue) && Array.isArray(existingValue)) {
    const generatedHasIdObjects = baseValue.every(
      (entry) => isPlainObject(entry) && typeof entry.id === "string"
    );
    const existingHasIdObjects = existingValue.every(
      (entry) => isPlainObject(entry) && typeof entry.id === "string"
    );

    if (generatedHasIdObjects && existingHasIdObjects) {
      const merged = new Map<string, Record<string, unknown>>();
      for (const entry of baseValue as Array<Record<string, unknown>>) {
        merged.set(String(entry.id), entry);
      }
      for (const entry of existingValue as Array<Record<string, unknown>>) {
        const id = String(entry.id);
        const current = merged.get(id);
        merged.set(
          id,
          current == null
            ? entry
            : (mergeGeneratedState(current, entry) as Record<string, unknown>)
        );
      }
      return Array.from(merged.values());
    }

    const generatedAreStrings = baseValue.every((entry) => typeof entry === "string");
    const existingAreStrings = existingValue.every((entry) => typeof entry === "string");
    if (generatedAreStrings && existingAreStrings) {
      return uniqueStrings([
        ...(baseValue as string[]),
        ...(existingValue as string[]),
      ]);
    }

    return existingValue.length > 0 ? existingValue : baseValue;
  }

  if (isPlainObject(baseValue) && isPlainObject(existingValue)) {
    const result: Record<string, unknown> = {};
    const keys = new Set([
      ...Object.keys(baseValue),
      ...Object.keys(existingValue),
    ]);
    for (const key of keys) {
      result[key] = mergeGeneratedState(baseValue[key], existingValue[key]);
    }
    return result;
  }

  return existingValue ?? baseValue;
}

function archiveManagedFile(
  workspacePath: string,
  reportRoot: string,
  relativePath: string
): ReconcileBackupFile | null {
  const sourcePath = path.join(workspacePath, relativePath);
  if (!fs.existsSync(sourcePath)) {
    return null;
  }

  const backupPath = path.join(reportRoot, "managed-backup", relativePath);
  ensureDir(path.dirname(backupPath));
  fs.copyFileSync(sourcePath, backupPath);
  return {
    originalPath: relativePath,
    backupPath: path.relative(workspacePath, backupPath).replace(/\\/g, "/"),
  };
}

function copyDirectoryRecursive(sourceDir: string, targetDir: string): void {
  ensureDir(targetDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
      continue;
    }
    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function discoverLegacyAgentResources(
  workspacePath: string
): string[] {
  const imported: string[] = [];

  for (const root of LEGACY_RESOURCE_ROOTS) {
    const sourceRoot = path.join(workspacePath, root.relativePath);
    if (!fs.existsSync(sourceRoot)) {
      continue;
    }

    if (root.kind === "skill") {
      for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }

        const sourceDir = path.join(sourceRoot, entry.name);
        const targetDir = path.join(workspacePath, ".github", "skills", entry.name);
        if (fs.existsSync(targetDir)) {
          continue;
        }
        imported.push(
          `.github/skills/${entry.name}/ (imported from ${root.relativePath}/${entry.name})`
        );
      }
      continue;
    }

    for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }

      const sourcePath = path.join(sourceRoot, entry.name);
      const targetPath = path.join(workspacePath, ".github", "agents", entry.name);
      if (fs.existsSync(targetPath)) {
        continue;
      }
      imported.push(
        `.github/agents/${entry.name} (imported from ${root.relativePath}/${entry.name})`
      );
    }
  }

  return imported;
}

function importLegacyAgentResources(
  workspacePath: string
): string[] {
  const discovered = discoverLegacyAgentResources(workspacePath);

  for (const entry of discovered) {
    const match = /^(\.github\/(skills|agents)\/.+?) \(imported from (.+)\)$/.exec(entry);
    if (match == null) {
      continue;
    }

    const [, targetRelativePath, kind, sourceRelativePath] = match;
    const sourcePath = path.join(workspacePath, sourceRelativePath);
    const targetPath = path.join(workspacePath, targetRelativePath);
    if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
      continue;
    }

    if (kind === "skills") {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      ensureDir(path.dirname(targetPath));
      fs.copyFileSync(sourcePath, targetPath);
    }
  }

  return discovered;
}

function buildMigrationPaths(workspacePath: string): {
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
  const reportRoot = path.join(migrationsRoot, `reconcile-${timestamp}`);
  return {
    reportRoot,
    reportJsonPath: path.join(reportRoot, "reconcile-report.json"),
    reportMarkdownPath: path.join(reportRoot, "reconcile-report.md"),
    latestReportJsonPath: path.join(migrationsRoot, "latest-reconcile-report.json"),
    latestReportMarkdownPath: path.join(migrationsRoot, "latest-reconcile-report.md"),
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

function toPreflightDryRunPlan(
  result: ReconcileWorkspaceResult
): ReconcilePreflightDryRunPlan {
  return {
    applied: false,
    writtenFiles: result.writtenFiles,
    mergedFiles: result.mergedFiles,
    overwrittenFiles: result.overwrittenFiles,
    modifiedManagedFiles: result.modifiedManagedFiles,
    manualReviewFiles: result.manualReviewFiles,
    plannedLegacyResources: result.importedLegacyResources,
    warnings: result.warnings,
    inventoryStatus: result.inventoryStatus,
    summary: result.summary,
  };
}

function buildListMarkdown(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- none"];
}

function buildReconcilePreflightMarkdown(result: {
  riskAudit: WorkspaceUpgradeRiskAuditResult;
  semanticDiff: WorkspaceManagedSemanticDiffResult;
  dryRunPlan: ReconcilePreflightDryRunPlan;
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
    "## Dry-Run Reconcile Plan",
    `- Planned new files: ${result.dryRunPlan.writtenFiles.length}`,
    `- Planned JSON merges: ${result.dryRunPlan.mergedFiles.length}`,
    `- Planned managed refreshes: ${result.dryRunPlan.overwrittenFiles.length}`,
    `- Manual review items: ${result.dryRunPlan.manualReviewFiles.length}`,
    `- Planned legacy imports: ${result.dryRunPlan.plannedLegacyResources.length}`,
    `- Dry-run warnings: ${result.dryRunPlan.warnings.length}`,
    "",
    "## Recommended Reconcile Flags",
    `- applyChanges: ${String(result.riskAudit.recommendedReconcileFlags.applyChanges)}`,
    `- requireCleanGitWhenPresent: ${String(result.riskAudit.recommendedReconcileFlags.requireCleanGitWhenPresent)}`,
    `- overwriteModifiedManagedFiles: ${String(result.riskAudit.recommendedReconcileFlags.overwriteModifiedManagedFiles)}`,
    `- importLegacyAgentResources: ${String(result.riskAudit.recommendedReconcileFlags.importLegacyAgentResources)}`,
    `- requireZeroManualReviewItemsForApply: ${String(result.riskAudit.recommendedReconcileFlags.requireZeroManualReviewItemsForApply)}`,
    "",
    "## Manual Review From Dry Run",
    ...buildListMarkdown(result.dryRunPlan.manualReviewFiles.map((item) => `\`${item}\``)),
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
    "## Suggestions",
    ...buildListMarkdown(result.riskAudit.suggestions),
    "",
    "## Warnings",
    ...buildListMarkdown([
      ...result.riskAudit.warnings,
      ...result.dryRunPlan.warnings,
    ]),
    "",
  ].join("\n");
}

function buildTableRows(
  values: string[],
  emptyLabel = "none"
): string {
  if (values.length === 0) {
    return `<tr><td>${escapeHtml(emptyLabel)}</td></tr>`;
  }

  return values
    .map((value) => `<tr><td><code>${escapeHtml(value)}</code></td></tr>`)
    .join("");
}

function buildSemanticRows(
  result: WorkspaceManagedSemanticDiffResult,
  status: WorkspaceManagedSemanticDiffResult["entries"][number]["status"]
): string {
  const rows = result.entries
    .filter((entry) => entry.status === status)
    .map(
      (entry) =>
        `<tr><td><code>${escapeHtml(entry.path)}</code></td><td>${escapeHtml(
          entry.category
        )}</td><td>${escapeHtml(entry.note)}</td></tr>`
    )
    .join("");

  return rows || '<tr><td colspan="3">none</td></tr>';
}

function buildReconcilePreflightHtml(result: {
  riskAudit: WorkspaceUpgradeRiskAuditResult;
  semanticDiff: WorkspaceManagedSemanticDiffResult;
  dryRunPlan: ReconcilePreflightDryRunPlan;
}): string {
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
  const warningItems = [
    ...result.riskAudit.warnings,
    ...result.dryRunPlan.warnings,
  ];
  const warningsMarkup =
    warningItems.length > 0
      ? warningItems
          .map(
            (item) =>
              `<li class="list-card"><strong>Warning</strong><div class="pill-note">${escapeHtml(
                item
              )}</div></li>`
          )
          .join("")
      : '<li class="list-card"><strong>No active warnings</strong><div class="pill-note">The preflight audit and dry run did not emit warnings beyond the current risk posture.</div></li>';
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
    .metric-card, .list-card { border:1px solid var(--line); border-radius:14px; padding:14px; background:#fbfcfd; }
    .metric-label { display:block; margin-bottom:6px; color:var(--muted); font-size:0.88rem; }
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
        <p class="lede">Dashboard-style safety snapshot that combines risk audit, managed semantic diff, and dry-run reconcile plan before any apply run.</p>
        <p class="meta-copy"><strong>Workspace:</strong> <span class="mono">${escapeHtml(
          result.riskAudit.workspacePath.replace(/\\/g, "/")
        )}</span></p>
      </div>
      <div class="header-meta">
        <span class="chip">JSON-first</span>
        <span class="chip">Dry-run plan</span>
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
            <span class="metric-label">Manual Review Items</span>
            <div class="metric-value">${result.dryRunPlan.manualReviewFiles.length}</div>
          </div>
        </div>
        <p class="meta-copy"><strong>Legacy resource roots:</strong> ${result.riskAudit.legacyResourceRoots.length > 0 ? escapeHtml(result.riskAudit.legacyResourceRoots.join(", ")) : "none"}</p>
      </section>

      <section class="panel panel-wide">
        <h2>Dry-Run Reconcile Plan</h2>
        <div class="split-metrics">
          <div class="metric-card"><span class="metric-label">Planned New Files</span><div class="metric-value">${result.dryRunPlan.writtenFiles.length}</div></div>
          <div class="metric-card"><span class="metric-label">Planned JSON Merges</span><div class="metric-value">${result.dryRunPlan.mergedFiles.length}</div></div>
          <div class="metric-card"><span class="metric-label">Planned Managed Refreshes</span><div class="metric-value">${result.dryRunPlan.overwrittenFiles.length}</div></div>
          <div class="metric-card"><span class="metric-label">Planned Legacy Imports</span><div class="metric-value">${result.dryRunPlan.plannedLegacyResources.length}</div></div>
        </div>
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
        <h2>Manual Review From Dry Run</h2>
        <p class="table-note">A strict apply should remain blocked until these items are resolved or an operator explicitly relaxes the gate.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Path</th></tr></thead>
            <tbody>${buildTableRows(result.dryRunPlan.manualReviewFiles)}</tbody>
          </table>
        </div>
      </section>

      <section class="panel panel-wide">
        <h2>Planned New Files</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Path</th></tr></thead>
            <tbody>${buildTableRows(result.dryRunPlan.writtenFiles)}</tbody>
          </table>
        </div>
      </section>

      <section class="panel panel-wide">
        <h2>Customized Managed Files</h2>
        <p class="table-note">These are the highest-priority manual review candidates before a strict reconcile apply run.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Path</th><th>Category</th><th>Note</th></tr></thead>
            <tbody>${buildSemanticRows(result.semanticDiff, "customized")}</tbody>
          </table>
        </div>
      </section>

      <section class="panel panel-wide">
        <h2>Missing Managed Files</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Path</th><th>Category</th><th>Note</th></tr></thead>
            <tbody>${buildSemanticRows(result.semanticDiff, "missing")}</tbody>
          </table>
        </div>
      </section>

      <section class="panel panel-wide">
        <h2>Merge-Diverged JSON State</h2>
        <p class="table-note">These files may be valid live state, but they should still be reviewed before replacing or normalizing them.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Path</th><th>Category</th><th>Note</th></tr></thead>
            <tbody>${buildSemanticRows(result.semanticDiff, "merge-diverged")}</tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function normalizePathForComparison(fullPath: string): string {
  return path.resolve(fullPath).replace(/\\/g, "/").toLowerCase();
}

function isPathInsideDirectory(fullPath: string, directoryPath: string): boolean {
  const normalizedPath = normalizePathForComparison(fullPath);
  const normalizedDirectory = normalizePathForComparison(directoryPath).replace(/\/$/, "");
  return (
    normalizedPath === normalizedDirectory ||
    normalizedPath.startsWith(`${normalizedDirectory}/`)
  );
}

function resolveReportJsonPath(
  workspacePath: string,
  requestedReportPath?: string
): string {
  const migrationsRoot = path.join(
    workspacePath,
    "docs",
    "ai-harness",
    "migrations"
  );
  const candidate = requestedReportPath == null
    ? path.join(migrationsRoot, "latest-reconcile-report.json")
    : path.isAbsolute(requestedReportPath)
      ? requestedReportPath
      : path.join(workspacePath, requestedReportPath);

  if (!isPathInsideDirectory(candidate, migrationsRoot)) {
    throw new Error(
      `Reconcile report must be inside ${path.relative(workspacePath, migrationsRoot).replace(/\\/g, "/")}.`
    );
  }

  if (!fs.existsSync(candidate)) {
    throw new Error(`Reconcile report not found: ${candidate}`);
  }

  return candidate;
}

function detectGitSafety(
  workspacePath: string
): {
  repositoryPresent: boolean;
  dirty: boolean | null;
  available: boolean;
  warning: string | null;
} {
  const gitDir = path.join(workspacePath, ".git");
  if (!fs.existsSync(gitDir)) {
    return {
      repositoryPresent: false,
      dirty: null,
      available: false,
      warning: "No .git directory detected. Reconcile can still run, but restore safety relies on migration backups only.",
    };
  }

  try {
    const output = execFileSync(
      "git",
      ["status", "--porcelain"],
      {
        cwd: workspacePath,
        encoding: "utf-8",
        windowsHide: true,
      }
    );
    return {
      repositoryPresent: true,
      dirty: output.trim().length > 0,
      available: true,
      warning:
        output.trim().length > 0
          ? "Git working tree is not clean. Review outstanding changes before applying reconcile."
          : null,
    };
  } catch {
    return {
      repositoryPresent: true,
      dirty: null,
      available: false,
      warning:
        "Git repository detected, but git status could not be read. Reconcile will rely on migration backups.",
    };
  }
}

function resolveWorkspaceConfig(
  options: ReconcileWorkspaceOptions
): WorkspaceInitParams {
  const analysis = analyzeWorkspace(options.workspacePath);
  const manifestConfig = readExistingHarnessManifest(options.workspacePath);
  const dashboardConfig = readExistingDashboardConfig(options.workspacePath);
  const packageMeta = readPackageMetadata(options.workspacePath);
  const targetIDEs = resolveWorkspaceTargetIDEs(
    options.workspacePath,
    options.targetIDEs
  );

  const workspaceName =
    options.workspaceName ??
    manifestConfig.workspaceName ??
    dashboardConfig.workspaceName ??
    packageMeta.name ??
    path.basename(options.workspacePath);
  const purpose =
    options.purpose ??
    manifestConfig.purpose ??
    dashboardConfig.purpose ??
    packageMeta.description ??
    "Upgrade this workspace to the latest governed AI harness structure.";
  const projectType =
    options.projectType ??
    manifestConfig.projectType ??
    dashboardConfig.projectType ??
    analysis.suggestedConfig.projectType;
  const techStack = uniqueStrings([
    ...(options.techStack ?? []),
    ...(manifestConfig.techStack ?? []),
    ...(dashboardConfig.techStack ?? []),
    ...(analysis.suggestedConfig.techStack ?? []),
  ]);
  const primaryDomains = uniqueStrings([
    ...(options.primaryDomains ?? []),
    ...(manifestConfig.primaryDomains ?? []),
    ...(dashboardConfig.primaryDomains ?? []),
  ]);

  return {
    workspaceName,
    purpose,
    workspacePath: options.workspacePath,
    projectType,
    techStack,
    docLanguage: options.docLanguage ?? "Korean",
    codeCommentLanguage: options.codeCommentLanguage ?? "English",
    isMultiRepo: options.isMultiRepo ?? manifestConfig.isMultiRepo ?? analysis.suggestedConfig.isMultiRepo,
    additionalContext: options.additionalContext,
    plannedTasks: uniqueStrings([
      ...(options.plannedTasks ?? []),
      ...(manifestConfig.plannedTasks ?? []),
    ]),
    includeAgentSkills: options.includeAgentSkills ?? true,
    agentSkillsIntent: options.agentSkillsIntent,
    fileEncoding: options.fileEncoding ?? "utf-8",
    targetIDEs,
    lineEnding: (options.lineEnding ?? "lf") as LineEnding,
    includeHarnessEngineering: options.includeHarnessEngineering ?? true,
    harnessProfile:
      options.harnessProfile ??
      manifestConfig.harnessProfile ??
      dashboardConfig.harnessProfile ??
      "balanced",
    governanceProfile:
      options.governanceProfile ??
      manifestConfig.governanceProfile ??
      dashboardConfig.governanceProfile ??
      "strict",
    autonomyMode:
      options.autonomyMode ??
      manifestConfig.autonomyMode ??
      dashboardConfig.autonomyMode ??
      "balanced",
    tokenBudget:
      options.tokenBudget ??
      manifestConfig.tokenBudget ??
      "balanced",
    primaryDomains: primaryDomains.length > 0 ? primaryDomains : [projectType ?? "other"],
  };
}

function buildReportMarkdown(report: Record<string, unknown>): string {
  const resolvedConfig = report.resolvedConfig as WorkspaceInitParams;
  const applied = report.applied === true;
  const inventoryStatus = String(report.inventoryStatus ?? "missing");
  const writtenFiles = report.writtenFiles as string[];
  const mergedFiles = report.mergedFiles as string[];
  const overwrittenFiles = report.overwrittenFiles as string[];
  const importedLegacyResources = report.importedLegacyResources as string[];
  const modifiedManagedFiles = report.modifiedManagedFiles as string[];
  const manualReviewFiles = report.manualReviewFiles as string[];
  const warnings = report.warnings as string[];
  const semanticDiffTotals = (report.semanticDiffTotals ?? {}) as Record<string, number>;
  const semanticDiffReportJsonPath =
    typeof report.semanticDiffReportJsonPath === "string"
      ? report.semanticDiffReportJsonPath
      : null;
  const semanticDiffReportMarkdownPath =
    typeof report.semanticDiffReportMarkdownPath === "string"
      ? report.semanticDiffReportMarkdownPath
      : null;
  const reconcilePolicySource =
    typeof report.reconcilePolicySource === "string"
      ? report.reconcilePolicySource
      : "unknown";

  return [
    "# Workspace Reconcile Report",
    "",
    `- Tool version: ${RECONCILE_VERSION}`,
    `- Applied changes: ${applied ? "yes" : "no (dry run)"}`,
    `- Managed inventory: ${inventoryStatus}`,
    `- Workspace: ${resolvedConfig.workspaceName}`,
    `- Purpose: ${resolvedConfig.purpose}`,
    `- Project type: ${resolvedConfig.projectType ?? "other"}`,
    `- Target IDEs: ${(resolvedConfig.targetIDEs ?? ["vscode"]).join(", ")}`,
    `- Reconcile policy: ${reconcilePolicySource}`,
    "",
    "## Actions",
    `- New files written: ${writtenFiles.length}`,
    `- JSON state files merged: ${mergedFiles.length}`,
    `- Managed files refreshed: ${overwrittenFiles.length}`,
    `- Modified managed files held for review: ${modifiedManagedFiles.length}`,
    `- Imported legacy resources: ${importedLegacyResources.length}`,
    `- Manual review items: ${manualReviewFiles.length}`,
    `- Warnings: ${warnings.length}`,
    "",
    "## Semantic Diff Snapshot",
    `- Customized replace-managed files: ${semanticDiffTotals.customized ?? 0}`,
    `- Missing managed files: ${semanticDiffTotals.missing ?? 0}`,
    `- Merge-managed divergence: ${semanticDiffTotals.mergeDiverged ?? 0}`,
    `- Semantic diff JSON: ${semanticDiffReportJsonPath ?? "not written"}`,
    `- Semantic diff Markdown: ${semanticDiffReportMarkdownPath ?? "not written"}`,
    "",
    "## Warnings",
    ...(warnings.length > 0
      ? warnings.map((entry) => `- ${entry}`)
      : ["- none"]),
    "",
    "## Imported Legacy Resources",
    ...(importedLegacyResources.length > 0
      ? importedLegacyResources.map((entry) => `- ${entry}`)
      : ["- none"]),
    "",
    "## Modified Managed Files",
    ...(modifiedManagedFiles.length > 0
      ? modifiedManagedFiles.map((entry) => `- ${entry}`)
      : ["- none"]),
    "",
    "## Manual Review",
    ...(manualReviewFiles.length > 0
      ? manualReviewFiles.map((entry) => `- ${entry}`)
      : ["- none"]),
    "",
  ].join("\n");
}

export function exportReconcilePreflightReport(
  workspacePath: string
): ReconcilePreflightExportResult {
  const riskAudit = auditWorkspaceUpgradeRisk(workspacePath);
  const semanticDiff = auditWorkspaceManagedSemanticDiff(workspacePath, false);
  const dryRunPlan = toPreflightDryRunPlan(
    reconcileWorkspaceInitialization({
      workspacePath,
      applyChanges: false,
      writeMigrationReport: false,
      writeSemanticDiffReport: false,
    })
  );
  const paths = buildReconcilePreflightPaths(workspacePath);
  ensureDir(paths.reportRoot);

  const report = {
    schemaVersion: "1.1.0",
    generatedAt: new Date().toISOString(),
    workspacePath: workspacePath.replace(/\\/g, "/"),
    riskAudit,
    semanticDiff: {
      inventoryStatus: semanticDiff.inventoryStatus,
      totals: semanticDiff.totals,
      entries: semanticDiff.entries,
      warnings: semanticDiff.warnings,
    },
    dryRunPlan,
  };
  const reportJson = `${JSON.stringify(report, null, 2)}\n`;
  const reportMarkdown = buildReconcilePreflightMarkdown({
    riskAudit,
    semanticDiff,
    dryRunPlan,
  });
  const reportHtml = buildReconcilePreflightHtml({
    riskAudit,
    semanticDiff,
    dryRunPlan,
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
    dryRunPlan,
    reportJsonPath,
    reportMarkdownPath,
    reportHtmlPath,
    summary: [
      "Reconcile preflight report exported.",
      `Risk level: ${riskAudit.riskLevel}`,
      `Managed inventory: ${riskAudit.inventoryStatus}`,
      `Customized managed files: ${semanticDiff.totals.customized}`,
      `Missing managed files: ${semanticDiff.totals.missing}`,
      `Planned new files: ${dryRunPlan.writtenFiles.length}`,
      `Planned JSON merges: ${dryRunPlan.mergedFiles.length}`,
      `Manual review items: ${dryRunPlan.manualReviewFiles.length}`,
      `Report JSON: ${reportJsonPath}`,
      `Report Markdown: ${reportMarkdownPath}`,
      `Report HTML: ${reportHtmlPath}`,
    ].join("\n"),
  };
}

export function reconcileWorkspaceInitialization(
  options: ReconcileWorkspaceOptions
): ReconcileWorkspaceResult {
  const resolvedConfig = resolveWorkspaceConfig(options);
  const generatedFiles = collectFiles(resolvedConfig);
  const migrationPaths = buildMigrationPaths(options.workspacePath);
  const applyChanges = options.applyChanges ?? false;
  const archiveManagedFiles = options.archiveManagedFiles ?? true;
  const overwriteManagedFiles = options.overwriteManagedFiles ?? true;
  const overwriteModifiedManagedFiles = options.overwriteModifiedManagedFiles ?? false;
  const importLegacyResources = options.importLegacyAgentResources ?? true;
  const writeMigrationReport = options.writeMigrationReport ?? applyChanges;
  const writeSemanticDiffReport =
    options.writeSemanticDiffReport ?? writeMigrationReport;
  const requireCleanGitWhenPresent = options.requireCleanGitWhenPresent ?? false;
  const requireZeroManualReviewItemsForApply =
    options.requireZeroManualReviewItemsForApply ?? false;
  const encoding = resolvedConfig.fileEncoding ?? "utf-8";
  const gitSafety = detectGitSafety(options.workspacePath);
  const managedInventory = readManagedFileInventory(options.workspacePath);
  const managedInventoryEntries = buildManagedInventoryEntryMap(managedInventory.document);
  const reconcilePolicy = loadReconcilePolicy(options.workspacePath);
  let semanticDiff = auditWorkspaceManagedSemanticDiff(options.workspacePath, false);
  const warnings: string[] = [];
  if (gitSafety.warning != null) {
    warnings.push(gitSafety.warning);
  }
  warnings.push(...managedInventory.warnings);
  warnings.push(...reconcilePolicy.warnings);
  if (
    requireCleanGitWhenPresent &&
    gitSafety.repositoryPresent &&
    gitSafety.available &&
    gitSafety.dirty === true &&
    applyChanges
  ) {
    throw new Error(
      "Git working tree is not clean. Commit or stash existing changes before applying reconcile, or disable requireCleanGitWhenPresent."
    );
  }

  const writtenFiles: string[] = [];
  const mergedFiles: string[] = [];
  const overwrittenFiles: string[] = [];
  const unchangedFiles: string[] = [];
  const archivedFiles: string[] = [];
  const modifiedManagedFiles: string[] = [];
  const manualReviewFiles: string[] = [];
  const backupFiles: ReconcileBackupFile[] = [];
  const pendingWrites: PendingReconcileWrite[] = [];

  for (const file of generatedFiles) {
    const fullPath = path.join(options.workspacePath, file.relativePath);
    const isManagedJson = MANAGED_JSON_MERGE_PATHS.has(file.relativePath);

    if (!fs.existsSync(fullPath)) {
      writtenFiles.push(file.relativePath);
      pendingWrites.push({
        relativePath: file.relativePath,
        fullPath,
        content: file.content,
        archiveBeforeWrite: false,
      });
      continue;
    }

    const existingContent = fs.readFileSync(fullPath, "utf-8");
    if (existingContent === file.content) {
      unchangedFiles.push(file.relativePath);
      continue;
    }
    const inventoryEntry = managedInventoryEntries.get(file.relativePath);
    const existingHash = inventoryEntry != null
      ? computeContentSha256(existingContent)
      : null;
    const isModifiedManagedFile =
      inventoryEntry != null &&
      inventoryEntry.strategy === "replace" &&
      existingHash !== inventoryEntry.contentSha256;
    const policyResolution = resolveReconcilePolicyForPath(
      file.relativePath,
      reconcilePolicy.document,
      reconcilePolicy.source,
      isManagedJson,
      isModifiedManagedFile
    );

    if (policyResolution.policy === "hold") {
      if (isModifiedManagedFile) {
        modifiedManagedFiles.push(file.relativePath);
      }
      manualReviewFiles.push(file.relativePath);
      warnings.push(
        `Reconcile policy held ${file.relativePath} for manual review (${policyResolution.source}).`
      );
      continue;
    }

    if (isManagedJson) {
      if (policyResolution.policy === "replace") {
        if (existingContent === file.content) {
          unchangedFiles.push(file.relativePath);
          continue;
        }
        if (!overwriteManagedFiles) {
          manualReviewFiles.push(file.relativePath);
          continue;
        }
        overwrittenFiles.push(file.relativePath);
        pendingWrites.push({
          relativePath: file.relativePath,
          fullPath,
          content: file.content,
          archiveBeforeWrite: archiveManagedFiles,
        });
        continue;
      }

      try {
        const generatedJson = JSON.parse(file.content) as unknown;
        const existingJson = JSON.parse(existingContent) as unknown;
        const mergedJson = mergeGeneratedState(generatedJson, existingJson);
        const mergedContent = `${JSON.stringify(mergedJson, null, 2)}\n`;
        if (mergedContent === existingContent) {
          unchangedFiles.push(file.relativePath);
          continue;
        }

        mergedFiles.push(file.relativePath);
        pendingWrites.push({
          relativePath: file.relativePath,
          fullPath,
          content: mergedContent,
          archiveBeforeWrite: archiveManagedFiles,
        });
        continue;
      } catch {
        if (!overwriteManagedFiles) {
          manualReviewFiles.push(file.relativePath);
          continue;
        }

        overwrittenFiles.push(file.relativePath);
        pendingWrites.push({
          relativePath: file.relativePath,
          fullPath,
          content: file.content,
          archiveBeforeWrite: archiveManagedFiles,
        });
        continue;
      }
    }

    if (isModifiedManagedFile && !overwriteModifiedManagedFiles && policyResolution.policy !== "replace") {
      modifiedManagedFiles.push(file.relativePath);
      manualReviewFiles.push(file.relativePath);
      continue;
    }

    if (!overwriteManagedFiles) {
      manualReviewFiles.push(file.relativePath);
      continue;
    }

    overwrittenFiles.push(file.relativePath);
    pendingWrites.push({
      relativePath: file.relativePath,
      fullPath,
      content: file.content,
      archiveBeforeWrite: archiveManagedFiles,
    });
  }

  const plannedLegacyResources = importLegacyResources
    ? discoverLegacyAgentResources(options.workspacePath)
    : [];
  let importedLegacyResources = applyChanges
    ? []
    : plannedLegacyResources.map((entry) => `planned: ${entry}`);

  if (
    applyChanges &&
    requireZeroManualReviewItemsForApply &&
    manualReviewFiles.length > 0
  ) {
    throw new Error(
      [
        "Reconcile apply blocked because manual review items are still present.",
        `Manual review items: ${manualReviewFiles.length}`,
        "Run a dry run first, review the managed semantic diff, and either resolve the files or explicitly relax requireZeroManualReviewItemsForApply.",
        ...(semanticDiff.reportMarkdownPath != null
          ? [`Managed semantic diff: ${semanticDiff.reportMarkdownPath}`]
          : []),
      ].join("\n")
    );
  }

  if (writeSemanticDiffReport) {
    semanticDiff = auditWorkspaceManagedSemanticDiff(options.workspacePath, true);
  }

  if (applyChanges) {
    for (const pendingWrite of pendingWrites) {
      if (pendingWrite.archiveBeforeWrite && archiveManagedFiles) {
        const archived = archiveManagedFile(
          options.workspacePath,
          migrationPaths.reportRoot,
          pendingWrite.relativePath
        );
        if (archived != null) {
          archivedFiles.push(archived.backupPath);
          backupFiles.push(archived);
        }
      }
      ensureDir(path.dirname(pendingWrite.fullPath));
      writeFileWithEncoding(pendingWrite.fullPath, pendingWrite.content, encoding);
    }

    if (importLegacyResources) {
      importedLegacyResources = importLegacyAgentResources(options.workspacePath);
    }
  }

  let reportJsonPath: string | null = null;
  let reportMarkdownPath: string | null = null;
  if (writeMigrationReport) {
    ensureDir(migrationPaths.reportRoot);
    const report = {
      schemaVersion: "1.0.0",
      toolVersion: RECONCILE_VERSION,
      generatedAt: new Date().toISOString(),
      applied: applyChanges,
      workspacePath: options.workspacePath.replace(/\\/g, "/"),
      resolvedConfig,
      writtenFiles,
      mergedFiles,
      overwrittenFiles,
      unchangedFiles,
      archivedFiles,
      backupFiles,
      importedLegacyResources,
      modifiedManagedFiles,
      manualReviewFiles,
      warnings,
      inventoryStatus: managedInventory.status,
      reconcilePolicySource: reconcilePolicy.source,
      semanticDiffTotals: semanticDiff.totals,
      semanticDiffReportJsonPath: semanticDiff.reportJsonPath,
      semanticDiffReportMarkdownPath: semanticDiff.reportMarkdownPath,
    };
    const reportJson = `${JSON.stringify(report, null, 2)}\n`;
    const reportMarkdown = buildReportMarkdown(report);
    ensureDir(migrationPaths.reportRoot);
    writeFileWithEncoding(migrationPaths.reportJsonPath, reportJson, encoding);
    writeFileWithEncoding(migrationPaths.reportMarkdownPath, reportMarkdown, encoding);
    writeFileWithEncoding(migrationPaths.latestReportJsonPath, reportJson, encoding);
    writeFileWithEncoding(migrationPaths.latestReportMarkdownPath, reportMarkdown, encoding);
    reportJsonPath = path
      .relative(options.workspacePath, migrationPaths.reportJsonPath)
      .replace(/\\/g, "/");
    reportMarkdownPath = path
      .relative(options.workspacePath, migrationPaths.reportMarkdownPath)
      .replace(/\\/g, "/");
  }

  const summary = [
    applyChanges
      ? `Workspace reconcile complete: ${resolvedConfig.workspaceName}`
      : `Workspace reconcile dry run complete: ${resolvedConfig.workspaceName}`,
    `Tool version: ${RECONCILE_VERSION}`,
    `Project type: ${resolvedConfig.projectType ?? "other"}`,
    `Target IDEs: ${(resolvedConfig.targetIDEs ?? ["vscode"]).join(", ")}`,
    `Applied changes: ${applyChanges ? "yes" : "no (dry run)"}`,
    `Managed inventory: ${managedInventory.status}`,
    `Reconcile policy: ${reconcilePolicy.source}`,
    "Legacy source safety: non-destructive harness overlay; application source roots are outside managed ownership.",
    `Semantic diff customized files: ${semanticDiff.totals.customized}`,
    `Semantic diff missing files: ${semanticDiff.totals.missing}`,
    `Semantic diff merge divergence: ${semanticDiff.totals.mergeDiverged}`,
    "",
    `${applyChanges ? "Written" : "Planned new"} missing files: ${writtenFiles.length}`,
    `${applyChanges ? "Merged" : "Planned merged"} state files: ${mergedFiles.length}`,
    `${applyChanges ? "Refreshed" : "Planned refreshed"} managed files: ${overwrittenFiles.length}`,
    `Modified managed files held for review: ${modifiedManagedFiles.length}`,
    `${applyChanges ? "Imported" : "Planned imported"} legacy resources: ${importedLegacyResources.length}`,
    `Manual review items: ${manualReviewFiles.length}`,
    `Strict manual-review gate: ${requireZeroManualReviewItemsForApply ? "enabled" : "disabled"}`,
    reportJsonPath != null ? `Migration report: ${reportJsonPath}` : "Migration report: disabled",
    semanticDiff.reportJsonPath != null
      ? `Managed semantic diff report: ${semanticDiff.reportJsonPath}`
      : "Managed semantic diff report: disabled",
    ...(warnings.length > 0
      ? ["", "Warnings:", ...warnings.map((entry) => `  - ${entry}`)]
      : []),
    ...(importedLegacyResources.length > 0
      ? ["", "Imported legacy resources:", ...importedLegacyResources.map((entry) => `  - ${entry}`)]
      : []),
    ...(modifiedManagedFiles.length > 0
      ? ["", "Modified managed files:", ...modifiedManagedFiles.map((entry) => `  - ${entry}`)]
      : []),
    ...(manualReviewFiles.length > 0
      ? ["", "Manual review recommended:", ...manualReviewFiles.map((entry) => `  - ${entry}`)]
      : []),
  ].join("\n");

  return {
    workspacePath: options.workspacePath,
    resolvedConfig,
    applied: applyChanges,
    writtenFiles,
    mergedFiles,
    overwrittenFiles,
    unchangedFiles,
    archivedFiles,
    importedLegacyResources,
    modifiedManagedFiles,
    manualReviewFiles,
    warnings,
    inventoryStatus: managedInventory.status,
    semanticDiffTotals: semanticDiff.totals,
    semanticDiffReportJsonPath: semanticDiff.reportJsonPath,
    semanticDiffReportMarkdownPath: semanticDiff.reportMarkdownPath,
    reportJsonPath,
    reportMarkdownPath,
    summary,
  };
}

export function restoreReconcileBackup(
  workspacePath: string,
  requestedReportPath?: string
): RestoreReconcileBackupResult {
  const reportJsonFullPath = resolveReportJsonPath(workspacePath, requestedReportPath);
  const report = readJsonIfExists<{
    backupFiles?: ReconcileBackupFile[];
  }>(reportJsonFullPath);

  if (report == null) {
    throw new Error("Reconcile report could not be parsed.");
  }

  const backupFiles = Array.isArray(report.backupFiles)
    ? report.backupFiles.filter(
        (entry): entry is ReconcileBackupFile =>
          isPlainObject(entry) &&
          typeof entry.originalPath === "string" &&
          typeof entry.backupPath === "string"
      )
    : [];

  if (backupFiles.length === 0) {
    throw new Error("No managed backup files were recorded in this reconcile report.");
  }

  const restoredFiles: string[] = [];
  for (const backup of backupFiles) {
    const sourcePath = path.resolve(workspacePath, backup.backupPath);
    const targetPath = path.resolve(workspacePath, backup.originalPath);
    if (!isPathInsideDirectory(sourcePath, workspacePath)) {
      throw new Error(`Backup source path escapes the workspace: ${backup.backupPath}`);
    }
    if (!isPathInsideDirectory(targetPath, workspacePath)) {
      throw new Error(`Backup target path escapes the workspace: ${backup.originalPath}`);
    }
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
    restoredFiles.push(backup.originalPath);
  }

  return {
    workspacePath,
    restoredFiles,
    reportJsonPath: path.relative(workspacePath, reportJsonFullPath).replace(/\\/g, "/"),
    summary: [
      "Reconcile backup restore complete.",
      `Restored files: ${restoredFiles.length}`,
      `Report: ${path.relative(workspacePath, reportJsonFullPath).replace(/\\/g, "/")}`,
    ].join("\n"),
  };
}
