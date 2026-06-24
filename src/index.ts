#!/usr/bin/env node

/**
 * workspace-init-mcp MCP Server v4.6.8
 *
 * An MCP server that initializes VS Code workspaces with
 * documentation governance, Copilot instructions, and project structure.
 *
 * Uses the latest MCP SDK registerTool/registerPrompt/registerResource API.
 * Transport: stdio
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";

import { type WorkspaceInitParams, PROJECT_TYPE_CONFIGS } from "./types.js";
import { collectFiles, buildSummary } from "./tools/initialize.js";
import {
  TARGET_IDE_VALUES,
  resolveWorkspaceTargetIDEs,
} from "./tools/agent-skills-install.js";
import { buildInitFormSchema } from "./tools/form-schema.js";
import { validateWorkspace } from "./tools/validate.js";
import { getHarnessDashboardContext } from "./tools/harness-dashboard-context.js";
import { analyzeWorkspace } from "./tools/status.js";
import {
  exportReconcilePreflightReport,
  reconcileWorkspaceInitialization,
  restoreReconcileBackup,
} from "./tools/reconcile.js";
import { assertGeneratedFilesRespectNonDestructivePolicy } from "./tools/generated-file-safety.js";
import {
  auditWorkspaceManagedSemanticDiff,
  auditWorkspaceUpgradeRisk,
  buildManagedFileInventoryFile,
  MANAGED_FILE_INVENTORY_PATH,
  MANAGED_TEXT_MERGE_PATHS,
} from "./tools/managed-inventory.js";
import { mergeHarnessInstructionBlock } from "./generators/agent-platform-instructions.js";
import {
  assessWorkspaceReadiness,
  auditWorkspaceReadinessSemantics,
} from "./tools/readiness.js";
import {
  HARNESS_RUNTIME_ADAPTER_IDS,
  startHarnessSession,
  advanceHarnessSession,
  getHarnessSessionStatus,
  listHarnessSessions,
  getHarnessSessionLog,
  activateHarnessSession,
  auditHarnessRuntime,
  auditHarnessParallelChunkConflicts,
  listHarnessRuntimeAdapters,
  listHarnessExecutionBridges,
  listHarnessNativeExecutors,
  prepareHarnessWorkPacket,
  prepareHarnessAdapterHandoff,
  prepareHarnessExecutionBridge,
  prepareHarnessNativeExecutor,
  launchHarnessNativeExecutor,
  getHarnessNativeExecutionStatus,
  recordHarnessExecutionResult,
  compactHarnessRuntime,
} from "./tools/harness-runtime.js";
import {
  buildWorkspaceInitMessages,
  buildQuickStartMessages,
  buildAnalyzeMessages,
} from "./prompts/index.js";
import {
  recommendAgentSkills,
  searchAgentSkills,
  listCategories,
  buildCatalogIndexes,
  AGENT_REGISTRY,
  SKILL_REGISTRY,
} from "./data/agent-skills-registry.js";
import { buildHarnessProfilesSummary } from "./data/harness-profiles.js";
import { WORKSPACE_INIT_MCP_VERSION } from "./data/version.js";
import { generateSelectedSkills } from "./generators/agent-skills.js";
import { generateServerFlowDashboardFiles } from "./generators/server-flow-dashboard.js";

// ---------------------------------------------------------------------------
// Encoding helper
// ---------------------------------------------------------------------------

function assertAbsoluteWorkspacePath(workspacePath: string): void {
  if (!path.isAbsolute(workspacePath)) {
    throw new Error(
      `workspacePath must be an absolute path. Received: ${workspacePath}`
    );
  }
}

function workspacePathInputSchema(description: string) {
  return z
    .string()
    .refine((value) => path.isAbsolute(value), {
      message: "workspacePath must be an absolute path",
    })
    .describe(description);
}

const LIVE_GOVERNANCE_STATE_PREFIXES = [
  ".governance/reports/",
  ".governance/reviews/",
  ".governance/sessions/",
  "docs/ai-harness/runtime/sessions/",
  "docs/ai-harness/runtime/work-packets/",
  "docs/ai-harness/runtime/inbox/",
  "docs/ai-harness/runtime/outbox/",
  "docs/ai-harness/runtime/adapter-handoffs/",
  "docs/ai-harness/runtime/execution-bridges/",
  "docs/ai-harness/runtime/archive/",
] as const;

const LIVE_GOVERNANCE_STATE_FILES = new Set([
  ".governance/_INDEX.md",
  ".governance/_PROJECT_STATE.md",
  "docs/context/context-index.md",
  "docs/ai-harness/dashboard/entities/reality-model.json",
  "docs/ai-harness/dashboard/entities/goal-compass.json",
  "docs/ai-harness/dashboard/entities/context-rot-monitor.json",
  "docs/ai-harness/dashboard/evaluations/harness-evaluation.json",
  "docs/ai-harness/dashboard/state/dashboard-state.json",
  "docs/ai-harness/readiness/maturity-scorecard.json",
  "docs/ai-harness/readiness/semantic-audit.json",
  "docs/ai-harness/runtime/state/session-index.json",
  "docs/ai-harness/runtime/state/active-session.json",
  "docs/ai-harness/runtime/state/current-work-packet.json",
  "docs/ai-harness/runtime/state/current-execution-bridge.json",
  "docs/ai-harness/runtime/state/current-native-execution.json",
  "docs/ai-harness/runtime/archive/archive-index.json",
]);

function isLiveGovernanceStatePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return (
    LIVE_GOVERNANCE_STATE_FILES.has(normalized) ||
    LIVE_GOVERNANCE_STATE_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix)
    )
  );
}

/**
 * Write file content with the specified encoding.
 * Handles utf-8-bom by prepending BOM to utf-8 output.
 */
function writeFileWithEncoding(
  fullPath: string,
  content: string,
  encoding: string
): void {
  if (encoding === "utf-8-bom") {
    fs.writeFileSync(fullPath, "\uFEFF" + content, "utf-8");
  } else {
    fs.writeFileSync(fullPath, content, encoding as BufferEncoding);
  }
}

function isPathWithin(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(parentPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertContainedNonSymlinkWrite(workspacePath: string, fullPath: string): void {
  const workspaceRealPath = fs.realpathSync.native(workspacePath);
  const parentPath = path.dirname(fullPath);
  fs.mkdirSync(parentPath, { recursive: true });
  const parentRealPath = fs.realpathSync.native(parentPath);
  if (!isPathWithin(workspaceRealPath, parentRealPath)) {
    throw new Error(`Generated file write escaped the workspace through a linked directory: ${fullPath}`);
  }
  if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isSymbolicLink()) {
    throw new Error(`Refusing to overwrite symbolic link generated path: ${fullPath}`);
  }
}

function writeContainedFileAtomic(
  workspacePath: string,
  fullPath: string,
  content: string,
  encoding: string
): void {
  assertContainedNonSymlinkWrite(workspacePath, fullPath);
  const tempPath = path.join(
    path.dirname(fullPath),
    `.${path.basename(fullPath)}.${process.pid}.${Date.now()}.tmp`
  );
  try {
    writeFileWithEncoding(tempPath, content, encoding);
    fs.renameSync(tempPath, fullPath);
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
    throw error;
  }
}

function restoreDashboardListenerOnHarnessActivity(
  workspacePath: string
): string {
  if (process.env.WORKSPACE_INIT_DASHBOARD_AUTOSTART === "0") {
    return "Harness Dashboard listener autostart disabled by WORKSPACE_INIT_DASHBOARD_AUTOSTART=0.";
  }

  const scriptPath = path.join(
    workspacePath,
    "docs",
    "ai-harness",
    "dashboard",
    "scripts",
    "dashboard-ops.mjs"
  );
  if (!fs.existsSync(scriptPath)) {
    return "Harness Dashboard listener not started because dashboard-ops.mjs is not present.";
  }

  const child = spawn(process.execPath, [scriptPath, "ensure-listening"], {
    cwd: workspacePath,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return "Harness Dashboard listener restore requested via dashboard-ops.mjs ensure-listening.";
}

// ---------------------------------------------------------------------------
// Schema definitions (Zod)
// ---------------------------------------------------------------------------

const PROJECT_TYPES = [
  "learning",
  "web-app",
  "api",
  "mobile",
  "data-science",
  "devops",
  "creative",
  "library",
  "monorepo",
  "consulting",
  "ecommerce",
  "fintech",
  "healthcare",
  "saas",
  "iot",
  "other",
] as const;

const HARNESS_RUNTIME_ACTIONS = [
  "complete",
  "request_changes",
  "block",
  "resume",
  "context_reset",
] as const;

const HARNESS_RUNTIME_ACTORS = [
  "hub",
  "planner",
  "generator",
  "evaluator",
  "operator",
] as const;

const BaseWorkspaceInputSchema = z.object({
  workspaceName: z
    .string()
    .describe("Name of the workspace (used in headings, file names)"),
  purpose: z
    .string()
    .describe(
      "Primary purpose and goals of this workspace. Be as specific as possible."
    ),
  workspacePath: workspacePathInputSchema(
    "Absolute path to the workspace root directory"
  ),
  projectType: z
    .enum(PROJECT_TYPES)
    .optional()
    .describe(
      "Type of project: learning, web-app, api, mobile, data-science, devops, creative, library, monorepo, consulting, ecommerce, fintech, healthcare, saas, iot, other"
    ),
  techStack: z
    .array(z.string())
    .optional()
    .describe('Technology stack (e.g., ["TypeScript", "React", "Node.js"])'),
  docLanguage: z
    .string()
    .optional()
    .describe('Language for documentation (default: "Korean")'),
  codeCommentLanguage: z
    .string()
    .optional()
    .describe('Language for code comments (default: "English")'),
  isMultiRepo: z
    .boolean()
    .optional()
    .describe("Whether this workspace manages multiple projects/repos"),
  additionalContext: z
    .string()
    .optional()
    .describe("Any additional context or special requirements"),
  plannedTasks: z
    .array(z.string())
    .optional()
    .describe("Key workflows or tasks planned for this workspace"),
  includeAgentSkills: z
    .boolean()
    .optional()
    .describe(
      "Whether to include Agent Skills (.github/skills/ and .github/agents/). Default: true"
    ),
  agentSkillsIntent: z
    .string()
    .optional()
    .describe(
      "User intent for agent skill recommendation tuning (e.g., 'focus on testing and devops')"
    ),
  fileEncoding: z
    .enum(["utf-8", "utf-8-bom", "ascii", "latin1"])
    .optional()
    .describe(
      'File encoding for generated files (default: "utf-8"). Use "utf-8-bom" for Windows tools that require BOM.'
    ),
  targetIDEs: z
    .array(z.enum(TARGET_IDE_VALUES))
    .optional()
    .describe(
      'Target AI agent platforms for instruction overlays and Agent Skills paths (default: detected platforms, otherwise ["vscode"]). Examples: ["vscode", "cursor", "claude-code", "codex", "antigravity"].'
    ),
  lineEnding: z
    .enum(["lf", "crlf", "auto"])
    .optional()
    .describe(
      'Line ending style for generated files and .gitattributes (default: "lf").'
    ),
  includeHarnessEngineering: z
    .boolean()
    .optional()
    .describe(
      "Whether to generate AI harness engineering artifacts. Default: true"
    ),
  harnessProfile: z
    .enum(["lean", "balanced", "regulated", "autonomous"])
    .optional()
    .describe('Harness profile for long-running AI delivery. Default: "balanced".'),
  governanceProfile: z
    .enum(["standard", "strict", "regulated"])
    .optional()
    .describe('Governance strictness for the workspace. Default: "strict".'),
  autonomyMode: z
    .enum(["guided", "balanced", "autonomous"])
    .optional()
    .describe('How independently AI should execute work. Default: "balanced".'),
  tokenBudget: z
    .enum(["lean", "balanced", "thorough"])
    .optional()
    .describe('Token usage strategy for the workspace. Default: "balanced".'),
  primaryDomains: z
    .array(z.string())
    .optional()
    .describe(
      'Primary domains the harness must coordinate (e.g., ["product", "platform", "security"]).'
    ),
  domainStressProfile: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .describe(
      "Optional high-risk domain profile id or label. Built-ins include identity-commerce-operations, legacy-modernization-governance, and content-release-governance; any project-specific value is normalized into a custom evidence-gate profile."
    ),
  legacyAdoptionProfile: z
    .string()
    .optional()
    .describe(
      "For existing projects, summarize legacy entities, routes, data stores, risks, migration goals, and protected source boundaries."
    ),
});

const InitializeWorkspaceInputSchema = BaseWorkspaceInputSchema.extend({
  force: z
    .boolean()
    .optional()
    .describe(
      "If true, overwrite existing generated governance/config files only. If false (default), skip files that already exist. This never authorizes deleting or replacing legacy application source."
    ),
});

const ReconcileWorkspaceInputSchema = BaseWorkspaceInputSchema.partial().extend({
  workspacePath: workspacePathInputSchema(
    "Absolute path to the workspace root directory"
  ),
  applyChanges: z
    .boolean()
    .optional()
    .describe(
      "If true, apply the reconcile plan. If false (default), run a dry run and only report planned changes."
    ),
  archiveManagedFiles: z
    .boolean()
    .optional()
    .describe(
      "If true (default), archive replaced managed files under docs/ai-harness/migrations/ before refreshing them."
    ),
  importLegacyAgentResources: z
    .boolean()
    .optional()
    .describe(
      "If true (default), copy legacy skill and agent resources from old IDE-specific roots into canonical .github paths when missing."
    ),
  overwriteManagedFiles: z
    .boolean()
    .optional()
    .describe(
      "If true (default), refresh managed generated files to the latest version. If false, changed managed files are left for manual review."
    ),
  overwriteModifiedManagedFiles: z
    .boolean()
    .optional()
    .describe(
      "If true, allow reconcile to refresh managed files even when the managed inventory shows they were customized after initialization. Default: false."
    ),
  writeMigrationReport: z
    .boolean()
    .optional()
    .describe(
      "If true (default), write a durable reconcile report under docs/ai-harness/migrations/."
    ),
  writeSemanticDiffReport: z
    .boolean()
    .optional()
    .describe(
      "If true, also write a managed semantic diff report under docs/ai-harness/migrations/. Defaults to the reconcile-report behavior."
    ),
  requireCleanGitWhenPresent: z
    .boolean()
    .optional()
    .describe(
      "If true, refuse to apply reconcile when a git repository is present and the working tree is not clean."
    ),
  requireZeroManualReviewItemsForApply: z
    .boolean()
    .optional()
    .describe(
      "If true, block applyChanges whenever reconcile still finds manual-review items such as customized managed files."
    ),
});

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "workspace-init-mcp",
  version: WORKSPACE_INIT_MCP_VERSION,
});

// ---------------------------------------------------------------------------
// Tool: initialize_workspace
// ---------------------------------------------------------------------------

server.registerTool(
  "initialize_workspace",
  {
    title: "Initialize Workspace",
    description: `Initialize a VS Code workspace with documentation governance, Copilot instructions, Agent Skills, and project structure.

This tool creates a complete workspace setup including:
- .github/copilot-instructions.md (global Copilot instructions)
- AGENTS.md (cross-agent and Codex repository instructions)
- platform-aware instruction overlays for detected Cursor, Claude Code, Antigravity, Codex, and VS Code projects
- .github/skills/ (Agent Skills - SKILL.md files per the agentskills.io standard)
- .github/agents/ (Agent definitions - .agent.md files)
- .github/ai-harness/managed-file-inventory.json (managed baseline for safer future upgrades and reconcile audits)
- .github/ai-harness/reconcile-policy.json (file-level reconcile safety policy for hold / merge / replace decisions)
- .github/ai-harness/native-executor-overrides.json (workspace-local handoff and launch tuning for GitHub Copilot, Codex CLI, Claude Code, Gemini CLI, and similar runtimes)
- docs/ai-harness/readiness/ (remaining-work spec, scoring model, and readiness scorecard template)
- docs/ai-harness/dashboard/ (Harness Dashboard 4.6.8 Hypertext Project World Model with ledger, projections, single-file HTML, and read-only local API)
- docs/ai-harness/runtime/ (planner / generator / evaluator runtime state, prompts, and session ledgers)
- docs/ai-harness/dashboard/scripts/dashboard-ops.mjs (projection rebuild, strict validation, read-only listener, SSE, VCS collection, and public export)
- .vscode/settings.json (Copilot custom instruction references)
- .vscode/*.instructions.md (code generation, test, review, commit, PR instructions)
- .editorconfig (cross-editor formatting consistency)
- .gitattributes (cross-platform line ending consistency)
- docs/ (work-logs, troubleshooting, changelog, adr, and project-type-specific directories)
- Initial changelog and work log entries

Agent Skills are included by default (set includeAgentSkills: false to skip).
Use targetIDEs to generate skills and platform instructions for multiple AI agent platforms (vscode, cursor, claude/claude-code, codex, antigravity, openhands). If the active platform set is uncertain, initialize with the best detected set and confirm it later through the dashboard Governance tab's agentPlatformGovernance intake.
Use fileEncoding to set file encoding (default: utf-8). Use lineEnding to set line endings (default: lf).
Legacy adoption is non-destructive: generated outputs are limited to governance, documentation, IDE, and harness artifacts and must not delete or replace existing application source files.

Required inputs: workspaceName, purpose, workspacePath
Optional inputs: projectType, techStack, docLanguage, codeCommentLanguage, isMultiRepo, additionalContext, plannedTasks, includeAgentSkills, agentSkillsIntent, fileEncoding, targetIDEs, lineEnding, primaryDomains, domainStressProfile, legacyAdoptionProfile`,
    inputSchema: InitializeWorkspaceInputSchema,
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const initParams: WorkspaceInitParams = {
        workspaceName: params.workspaceName,
        purpose: params.purpose,
        workspacePath: params.workspacePath,
        projectType: params.projectType as WorkspaceInitParams["projectType"],
        techStack: params.techStack,
        docLanguage: params.docLanguage,
        codeCommentLanguage: params.codeCommentLanguage,
        isMultiRepo: params.isMultiRepo,
        additionalContext: params.additionalContext,
        plannedTasks: params.plannedTasks,
        includeAgentSkills: params.includeAgentSkills,
        agentSkillsIntent: params.agentSkillsIntent,
        includeHarnessEngineering: params.includeHarnessEngineering,
        harnessProfile: params.harnessProfile,
        governanceProfile: params.governanceProfile,
        autonomyMode: params.autonomyMode,
        tokenBudget: params.tokenBudget,
        primaryDomains: params.primaryDomains,
        domainStressProfile: params.domainStressProfile,
        legacyAdoptionProfile: params.legacyAdoptionProfile,
        fileEncoding: params.fileEncoding as WorkspaceInitParams["fileEncoding"],
        targetIDEs: resolveWorkspaceTargetIDEs(
          params.workspacePath,
          params.targetIDEs as WorkspaceInitParams["targetIDEs"]
        ),
        lineEnding: params.lineEnding as WorkspaceInitParams["lineEnding"],
      };

      // Generate all files
      const files = collectFiles(initParams);

      // Write files to disk
      const force = params.force ?? false;
      const encoding = params.fileEncoding ?? "utf-8";
      const written: string[] = [];
      const skipped: string[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const fullPath = path.join(params.workspacePath, file.relativePath);
        try {
          const dir = path.dirname(fullPath);
          fs.mkdirSync(dir, { recursive: true });

          if (!force && fs.existsSync(fullPath)) {
            if (MANAGED_TEXT_MERGE_PATHS.has(file.relativePath)) {
              const existingContent = fs.readFileSync(fullPath, "utf-8");
              const mergedContent = mergeHarnessInstructionBlock(
                file.content,
                existingContent
              );
              if (mergedContent !== existingContent) {
                writeFileWithEncoding(fullPath, mergedContent, encoding);
                written.push(`${file.relativePath} (merged harness instruction block)`);
              } else {
                skipped.push(file.relativePath);
              }
              continue;
            }
            skipped.push(file.relativePath);
            continue;
          }

          if (
            force &&
            fs.existsSync(fullPath) &&
            isLiveGovernanceStatePath(file.relativePath)
          ) {
            skipped.push(
              `${file.relativePath} (preserved live governance state; use reconcile for merge-aware refresh)`
            );
            continue;
          }

          writeFileWithEncoding(fullPath, file.content, encoding);
          written.push(file.relativePath);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${file.relativePath}: ${msg}`);
        }
      }

      const listenerRestoreNote =
        initParams.includeHarnessEngineering === false
          ? "Harness Dashboard listener not started because harness engineering is disabled."
          : restoreDashboardListenerOnHarnessActivity(params.workspacePath);

      const result = buildSummary(initParams, files);

      let text = result.summary;

      // Append environment info
      const envInfo: string[] = [];
      envInfo.push(`File encoding: ${encoding}`);
      const ides = initParams.targetIDEs ?? ["vscode"];
      envInfo.push(`Target AI platforms: ${ides.join(", ")}`);
      envInfo.push(`Line endings: ${params.lineEnding ?? "lf"}`);
      envInfo.push(listenerRestoreNote);
      text += `\n\n${envInfo.join("\n")}`;

      if (skipped.length > 0) {
        const skippedList = skipped.map((s) => `  - ${s}`).join("\n");
        text += `\n\nSkipped existing files (${skipped.length}):\n${skippedList}`;
        text += "\n  Re-run with force: true to overwrite them.";
      }
      if (errors.length > 0) {
        text += `\n\nFailed file writes:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
      }

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Initialization failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: reconcile_workspace_initialization
// ---------------------------------------------------------------------------

server.registerTool(
  "reconcile_workspace_initialization",
  {
    title: "Reconcile Workspace Initialization",
    description: `Upgrade an existing workspace to the latest workspace-init-mcp structure without discarding existing governed work.

Use this when:
- a legacy project needs the latest DX/AX harness architecture
- an older workspace-init-mcp setup should be brought forward to the newest structure
- real development has already happened and the workspace needs missing runtime, dashboard, readiness, or governance layers filled in safely

This tool:
- analyzes the existing repository and resolves a best-effort latest configuration
- treats the operation as a non-destructive harness overlay and does not delete or replace legacy application source
- consults the managed file inventory when present so customized managed files can be held for manual review
- writes missing latest-version files
- installs version-index, compatibility-matrix, adapter-contract, and session-continuity files required by newer agent runtimes
- merges live governed JSON state such as dashboard and runtime snapshots
- refreshes managed generated files to the latest templates
- archives replaced managed files under docs/ai-harness/migrations/
- imports legacy skill and agent resources from older IDE-specific roots into canonical .github paths when missing

By default this tool runs in dry-run mode. Set applyChanges: true after reviewing the plan when you are ready to modify the workspace.
For safer upgrades, prefer requireCleanGitWhenPresent: true, keep overwriteModifiedManagedFiles: false unless you have reviewed the diff, enable requireZeroManualReviewItemsForApply when legacy safety matters most, and use restore_reconcile_backup if a managed-file refresh must be rolled back.`,
    inputSchema: ReconcileWorkspaceInputSchema,
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = reconcileWorkspaceInitialization({
        workspaceName: params.workspaceName,
        purpose: params.purpose,
        workspacePath: params.workspacePath,
        projectType: params.projectType as WorkspaceInitParams["projectType"],
        techStack: params.techStack,
        docLanguage: params.docLanguage,
        codeCommentLanguage: params.codeCommentLanguage,
        isMultiRepo: params.isMultiRepo,
        additionalContext: params.additionalContext,
        plannedTasks: params.plannedTasks,
        includeAgentSkills: params.includeAgentSkills,
        agentSkillsIntent: params.agentSkillsIntent,
        includeHarnessEngineering: params.includeHarnessEngineering,
        harnessProfile: params.harnessProfile,
        governanceProfile: params.governanceProfile,
        autonomyMode: params.autonomyMode,
        tokenBudget: params.tokenBudget,
        primaryDomains: params.primaryDomains,
        domainStressProfile: params.domainStressProfile,
        legacyAdoptionProfile: params.legacyAdoptionProfile,
        fileEncoding: params.fileEncoding as WorkspaceInitParams["fileEncoding"],
        targetIDEs: resolveWorkspaceTargetIDEs(
          params.workspacePath,
          params.targetIDEs as WorkspaceInitParams["targetIDEs"]
        ),
        lineEnding: params.lineEnding as WorkspaceInitParams["lineEnding"],
        applyChanges: params.applyChanges,
        archiveManagedFiles: params.archiveManagedFiles,
        importLegacyAgentResources: params.importLegacyAgentResources,
        overwriteManagedFiles: params.overwriteManagedFiles,
        overwriteModifiedManagedFiles: params.overwriteModifiedManagedFiles,
        writeMigrationReport: params.writeMigrationReport,
        writeSemanticDiffReport: params.writeSemanticDiffReport,
        requireCleanGitWhenPresent: params.requireCleanGitWhenPresent,
        requireZeroManualReviewItemsForApply:
          params.requireZeroManualReviewItemsForApply,
      });
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Workspace reconcile failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: audit_workspace_upgrade_risk
// ---------------------------------------------------------------------------

server.registerTool(
  "audit_workspace_upgrade_risk",
  {
    title: "Audit Workspace Upgrade Risk",
    description: `Audit a workspace before reconcile or legacy adoption to estimate upgrade risk.

This tool:
- inspects the managed file inventory when present
- detects managed files that appear customized after initialization
- reports missing managed artifacts, legacy IDE resource roots, and git cleanliness
- recommends safe reconcile flags before applyChanges is considered

Use this before large upgrades, legacy-project onboarding, or any reconcile run where safety matters more than speed.`,
    inputSchema: z.object({
      workspacePath: workspacePathInputSchema(
        "Absolute path to the workspace root directory"
      ),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = auditWorkspaceUpgradeRisk(params.workspacePath);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Workspace upgrade risk audit failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: audit_workspace_managed_semantic_diff
// ---------------------------------------------------------------------------

server.registerTool(
  "audit_workspace_managed_semantic_diff",
  {
    title: "Audit Workspace Managed Semantic Diff",
    description: `Generate a semantic diff between the managed baseline inventory and the current workspace state.

This tool:
- classifies managed files as unchanged, customized, missing, merge-unchanged, or merge-diverged
- makes customized governed files easier to review before reconcile apply runs
- can write durable JSON and Markdown reports under docs/ai-harness/migrations/

Use this when you want a more readable preflight view of managed-file drift before upgrade work.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      writeReport: z
        .boolean()
        .optional()
        .describe(
          "If true, write a durable semantic diff report under docs/ai-harness/migrations/."
        ),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = auditWorkspaceManagedSemanticDiff(
        params.workspacePath,
        params.writeReport ?? false
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Workspace managed semantic diff failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: export_reconcile_preflight_report
// ---------------------------------------------------------------------------

server.registerTool(
  "export_reconcile_preflight_report",
  {
    title: "Export Reconcile Preflight Report",
    description: `Export a stakeholder-readable reconcile preflight report before a legacy upgrade or reconcile apply run.

This tool:
- runs the upgrade risk audit
- captures the managed semantic diff snapshot
- embeds a no-write dry-run reconcile plan
- writes JSON, Markdown, and HTML reports under docs/ai-harness/migrations/
- creates latest-report pointers so operators can share the newest preflight snapshot quickly

Use this when you want a durable preflight artifact before touching a legacy or already-customized workspace.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = exportReconcilePreflightReport(params.workspacePath);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Reconcile preflight export failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: restore_reconcile_backup
// ---------------------------------------------------------------------------

server.registerTool(
  "restore_reconcile_backup",
  {
    title: "Restore Reconcile Backup",
    description: `Restore managed files from the latest or requested reconcile backup report.

Use this when a reconcile apply run needs to be rolled back from the backups stored under docs/ai-harness/migrations/.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      reportJsonPath: z
        .string()
        .optional()
        .describe("Optional workspace-relative or absolute path to a reconcile-report.json file. Defaults to the latest reconcile report."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = restoreReconcileBackup(
        params.workspacePath,
        params.reportJsonPath
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Reconcile restore failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: preview_workspace_init
// ---------------------------------------------------------------------------

server.registerTool(
  "preview_workspace_init",
  {
    title: "Preview Workspace Init",
    description: `Preview the files that would be generated by initialize_workspace without actually creating them.
Useful for reviewing the planned structure before committing to it.`,
    inputSchema: BaseWorkspaceInputSchema,
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const initParams: WorkspaceInitParams = {
        workspaceName: params.workspaceName,
        purpose: params.purpose,
        workspacePath: params.workspacePath,
        projectType: params.projectType as WorkspaceInitParams["projectType"],
        techStack: params.techStack,
        docLanguage: params.docLanguage,
        codeCommentLanguage: params.codeCommentLanguage,
        isMultiRepo: params.isMultiRepo,
        additionalContext: params.additionalContext,
        plannedTasks: params.plannedTasks,
        includeAgentSkills: params.includeAgentSkills,
        agentSkillsIntent: params.agentSkillsIntent,
        includeHarnessEngineering: params.includeHarnessEngineering,
        harnessProfile: params.harnessProfile,
        governanceProfile: params.governanceProfile,
        autonomyMode: params.autonomyMode,
        tokenBudget: params.tokenBudget,
        primaryDomains: params.primaryDomains,
        domainStressProfile: params.domainStressProfile,
        legacyAdoptionProfile: params.legacyAdoptionProfile,
        fileEncoding: params.fileEncoding as WorkspaceInitParams["fileEncoding"],
        targetIDEs: resolveWorkspaceTargetIDEs(
          params.workspacePath,
          params.targetIDEs as WorkspaceInitParams["targetIDEs"]
        ),
        lineEnding: params.lineEnding as WorkspaceInitParams["lineEnding"],
      };

      const files = collectFiles(initParams);

      const preview = files
        .map(
          (f) =>
            `- ${f.relativePath}\n${"-".repeat(60)}\n${f.content.slice(0, 500)}${f.content.length > 500 ? "\n... (truncated)" : ""}\n`
        )
        .join("\n");

      const text = `Workspace initialization preview: ${params.workspaceName}\n\nGenerated files: ${files.length}\n\n${preview}`;

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Preview failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: list_project_types
// ---------------------------------------------------------------------------

server.registerTool(
  "list_project_types",
  {
    title: "List Project Types",
    description:
      "List all available project types and their descriptions. Useful when the user is unsure which project type to choose.",
    inputSchema: z.object({}),
  },
  async () => {
    const lines = Object.entries(PROJECT_TYPE_CONFIGS).map(
      ([key, config]) =>
        `- **${key}** (${config.label}): ${config.description}\n  Default tech stack: ${config.defaultTechStack.length ? config.defaultTechStack.join(", ") : "none"}\n  Documentation sections: ${config.docSections.length ? config.docSections.join(", ") : "none"}`
    );

    const text = `Available project types:\n\n${lines.join("\n\n")}`;
    return { content: [{ type: "text" as const, text }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: list_harness_profiles
// ---------------------------------------------------------------------------

server.registerTool(
  "list_harness_profiles",
  {
    title: "List Harness Profiles",
    description:
      "List the built-in AI harness profiles for long-running workspace delivery.",
    inputSchema: z.object({}),
  },
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: buildHarnessProfilesSummary(),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_init_form_schema
// ---------------------------------------------------------------------------

server.registerTool(
  "get_init_form_schema",
  {
    title: "Get Init Form Schema",
    description: `Returns a universal JSON form schema for workspace initialization.

This schema can be used by ANY LLM client (CLI, VSCode, Claude Desktop, GPT Desktop,
Google AI Studio, etc.) to render an input form for the user. The schema includes:
- Required and optional fields clearly separated into sections
- Field types (text, select, multiselect, boolean, textarea, tags)
- Descriptions, placeholders, defaults, and validation rules
- A conversational guide for chat-based LLMs
- A CLI prompt guide for terminal-based clients

Call this tool FIRST when a user wants to initialize a workspace, then use the
returned schema to collect inputs before calling initialize_workspace.`,
    inputSchema: z.object({
      format: z
        .enum(["full", "conversational", "cli"])
        .optional()
        .describe(
          "Output format: 'full' (complete JSON schema), 'conversational' (markdown guide for chat), 'cli' (compact CLI guide). Default: full"
        ),
    }),
  },
  async (params) => {
    const schema = buildInitFormSchema();
    const format = params.format ?? "full";

    let text: string;
    switch (format) {
      case "conversational":
        text = schema.conversationalGuide;
        break;
      case "cli":
        text = schema.cliPromptGuide;
        break;
      default:
        text = JSON.stringify(schema, null, 2);
        break;
    }

    return { content: [{ type: "text" as const, text }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: create_server_flow_dashboard
// ---------------------------------------------------------------------------

server.registerTool(
  "create_server_flow_dashboard",
  {
    title: "Create Server Flow Monitoring Dashboard",
    description: `Create a separate Server Flow Monitoring Dashboard scaffold for an application, API server, MCP server, worker, data pipeline, deployment, VPS, or homelab service.

This tool is intentionally separate from the World Model Harness Dashboard. It creates an application/server monitoring surface under server-flow-dashboard/ and a short docs blueprint, but it does not change docs/ai-harness/dashboard/ or agent governance state.

Use it when the user asks for a server flow dashboard, runtime monitoring dashboard, traffic dashboard, pipeline monitoring dashboard, lightweight server status dashboard, or when newly built application infrastructure needs visible flow monitoring.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      dashboardName: z
        .string()
        .optional()
        .describe("Human-readable dashboard title"),
      applicationName: z
        .string()
        .optional()
        .describe("Application, API server, MCP server, worker, or deployment being monitored"),
      focus: z
        .enum(["network-traffic", "workflow", "lightweight", "combined"])
        .optional()
        .describe("Monitoring focus. Default: combined."),
      monitoredServices: z
        .array(z.string())
        .optional()
        .describe("Services or containers to show in the dashboard"),
      ports: z
        .array(z.number())
        .optional()
        .describe("Ports associated with monitored services"),
      dataPipelines: z
        .array(z.string())
        .optional()
        .describe("Data or workflow pipelines to show"),
      force: z
        .boolean()
        .optional()
        .describe("Overwrite existing server-flow-dashboard files. Default: false."),
      fileEncoding: z
        .enum(["utf-8", "utf-8-bom", "ascii", "latin1"])
        .optional()
        .describe("File encoding for generated files. Default: utf-8."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const files = generateServerFlowDashboardFiles({
        workspacePath: params.workspacePath,
        dashboardName: params.dashboardName,
        applicationName: params.applicationName,
        focus: params.focus,
        monitoredServices: params.monitoredServices,
        ports: params.ports,
        dataPipelines: params.dataPipelines,
      });
      assertGeneratedFilesRespectNonDestructivePolicy(files);

      const force = params.force ?? false;
      const encoding = params.fileEncoding ?? "utf-8";
      const written: string[] = [];
      const skipped: string[] = [];
      let managedInventoryStatus = "not-present";

      for (const file of files) {
        const fullPath = path.join(params.workspacePath, file.relativePath);
        assertContainedNonSymlinkWrite(params.workspacePath, fullPath);
        if (!force && fs.existsSync(fullPath)) {
          skipped.push(file.relativePath);
          continue;
        }
        writeContainedFileAtomic(params.workspacePath, fullPath, file.content, encoding);
        written.push(file.relativePath);
      }

      const managedInventoryPath = path.join(params.workspacePath, MANAGED_FILE_INVENTORY_PATH);
      if (written.length > 0 && fs.existsSync(managedInventoryPath)) {
        try {
          const current = JSON.parse(fs.readFileSync(managedInventoryPath, "utf-8")) as {
            entries?: Array<{ path?: string }>;
          };
          if (current != null && typeof current === "object" && Array.isArray(current.entries)) {
            const writtenFiles = files.filter((file) => written.includes(file.relativePath));
            const generatedInventory = JSON.parse(
              buildManagedFileInventoryFile(writtenFiles).content
            ) as { entries?: Array<{ path: string }> };
            const entriesByPath = new Map<string, unknown>();
            for (const entry of current.entries) {
              if (typeof entry.path === "string") {
                entriesByPath.set(entry.path, entry);
              }
            }
            for (const entry of generatedInventory.entries ?? []) {
              entriesByPath.set(entry.path, entry);
            }
            current.entries = Array.from(entriesByPath.values()) as Array<{ path?: string }>;
            current.entries.sort((left, right) => String(left.path).localeCompare(String(right.path)));
            writeContainedFileAtomic(
              params.workspacePath,
              managedInventoryPath,
              `${JSON.stringify(current, null, 2)}\n`,
              encoding
            );
            managedInventoryStatus = "updated";
          } else {
            managedInventoryStatus = "skipped-invalid";
          }
        } catch {
          managedInventoryStatus = "skipped-invalid";
        }
      } else if (fs.existsSync(managedInventoryPath)) {
        managedInventoryStatus = written.length === 0 ? "unchanged-no-new-files" : "present";
      }

      return {
        content: [
          {
            type: "text" as const,
            text: [
              "Server Flow Monitoring Dashboard scaffold complete.",
              "",
              `Written files (${written.length}):`,
              ...written.map((file) => `  - ${file}`),
              "",
              `Skipped existing files (${skipped.length}):`,
              ...skipped.map((file) => `  - ${file}`),
              "",
              `Managed inventory: ${managedInventoryStatus}`,
              "",
              "Domain boundary: this is separate from docs/ai-harness/dashboard/, which remains the World Model Harness Dashboard.",
            ].join("\n"),
          },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Server flow dashboard creation failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: validate_workspace
// ---------------------------------------------------------------------------

server.registerTool(
  "validate_workspace",
  {
    title: "Validate Workspace",
    description: `Validate whether a workspace has been properly initialized by workspace-init-mcp.

Checks for the presence of all expected files (.github/copilot-instructions.md,
.vscode/settings.json, instruction files, docs/ structure) and reports:
- Overall initialization status (initialized or not)
- Completeness percentage (0-100%)
- Per-file status (present/missing) with severity levels
- Dashboard state validity against the stricter JSON shape
- Actionable suggestions for fixing gaps`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory to validate"),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = validateWorkspace(params.workspacePath);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Validation failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_harness_dashboard_context
// ---------------------------------------------------------------------------

server.registerTool(
  "get_harness_dashboard_context",
  {
    title: "Get Harness Dashboard Context",
    description: `Read the Harness Dashboard 4.6.8 Hypertext Project World Model projections for AI Agent resume context.

This tool is intentionally read-only. It never starts listeners, refreshes VCS,
mutates dashboard state, appends ledger events, runs shell commands, or calls an LLM.
Use it at the beginning of a work session to understand current goals, open decisions,
blockers, authoritative files, projection freshness, and governance evidence.`,
    inputSchema: z.object({
      workspacePath: workspacePathInputSchema(
        "Absolute path to the workspace root directory"
      ),
      view: z
        .enum(["agent", "stakeholder", "maintainer", "full"])
        .optional()
        .describe("Context density and vocabulary. Default: agent"),
      query: z
        .string()
        .optional()
        .describe("Optional deterministic projection search term"),
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe("Maximum query matches to return. Default: 20"),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = getHarnessDashboardContext({
        workspacePath: params.workspacePath,
        view: params.view,
        query: params.query,
        limit: params.limit,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text" as const,
            text: `Harness Dashboard context read failed: ${msg}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: assess_workspace_readiness
// ---------------------------------------------------------------------------

server.registerTool(
  "assess_workspace_readiness",
  {
    title: "Assess Workspace Readiness",
    description: `Assess how operationally ready an initialized workspace is against the generated readiness model.

This tool scores the workspace across:
- baseline initialization
- governance and documentation
- runtime orchestration
- dashboard and stakeholder visibility
- external runtime portability
- quality and traceability
- domain tailoring

Use it after initialization, after major harness upgrades, or before handing the workspace to a broader team. Optionally write a machine-readable scorecard back into docs/ai-harness/readiness/.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      writeScorecard: z
        .boolean()
        .optional()
        .describe(
          "If true, write docs/ai-harness/readiness/maturity-scorecard.json with the assessment result"
        ),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = assessWorkspaceReadiness(
        params.workspacePath,
        params.writeScorecard
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text" as const,
            text: `Workspace readiness assessment failed: ${msg}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: audit_workspace_readiness_semantics
// ---------------------------------------------------------------------------

server.registerTool(
  "audit_workspace_readiness_semantics",
  {
    title: "Audit Workspace Readiness Semantics",
    description: `Audit whether an initialized workspace looks operationally real, not only structurally complete.

This audit focuses on semantic signals such as:
- placeholder pressure in core files
- whether governance ledgers contain project-specific evidence
- whether the dashboard looks populated with real signals
- whether runtime handoffs and bridge evidence exist
- whether version-control and documentary traceability are active

Use it when you want a conservative operator-style judgment instead of a file-existence score alone.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      writeReport: z
        .boolean()
        .optional()
        .describe(
          "If true, write docs/ai-harness/readiness/semantic-audit.json with the audit result"
        ),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = auditWorkspaceReadinessSemantics(
        params.workspacePath,
        params.writeReport
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text" as const,
            text: `Workspace readiness semantic audit failed: ${msg}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: audit_harness_parallel_chunk_conflicts
// ---------------------------------------------------------------------------

server.registerTool(
  "audit_harness_parallel_chunk_conflicts",
  {
    title: "Audit Harness Parallel Chunk Conflicts",
    description: `Audit open and queued harness runtime sessions for overlapping expected write paths before running workers in parallel.

Use this after the orchestrator splits work into chunks and before assigning worker agents. A passing audit means the declared expected write scopes do not textually overlap. The audit also warns when multiple sessions touch integration-sensitive surfaces such as dependency manifests, lockfiles, CI workflows, API contracts, DB migrations, or shared project config; those warnings should be handled by making the work sequential or naming one merge owner.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = auditHarnessParallelChunkConflicts(params.workspacePath);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text" as const,
            text: `Harness parallel chunk conflict audit failed: ${msg}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: start_harness_session
// ---------------------------------------------------------------------------

server.registerTool(
  "start_harness_session",
  {
    title: "Start Harness Session",
    description: `Start a real planner / generator / evaluator runtime session inside an initialized workspace.

This tool:
- opens governed runtime state under docs/ai-harness/runtime/
- creates a durable session JSON snapshot and markdown summary
- seeds the first chunk and moves the workflow to plan-1
- captures hub orchestration fields, dependency maps, expected read/write paths, merge owners, verification commands, and context-injection guidance for parallel workers
- synchronizes durable runtime state and keeps the Project World Model dashboard as the canonical reality, goal, context, evidence, runtime, and next-action surface

Use this before meaningful implementation begins. The session is file-system-based and survives context resets, long-running work, and interrupted sessions.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      goal: z
        .string()
        .describe("Approved goal for the next bounded chunk or governed session"),
      originalRequest: z
        .string()
        .min(1)
        .describe("Original user request text to preserve verbatim for request/process/result traceability."),
      processSummary: z
        .string()
        .min(1)
        .describe("Process summary for session startup, such as orchestration setup, worker assignment, or context preparation."),
      resultSummary: z
        .string()
        .min(1)
        .describe("Startup result summary for the created runtime session and initial plan phase."),
      title: z
        .string()
        .optional()
        .describe("Human-readable session title. Defaults to a trimmed goal summary."),
      sessionId: z
        .string()
        .optional()
        .describe("Optional custom session ID. Useful when external governance already assigned one."),
      chunkId: z
        .string()
        .optional()
        .describe("Optional custom chunk ID for the bounded implementation scope."),
      chunkTitle: z
        .string()
        .optional()
        .describe("Human-readable chunk title. Defaults to a trimmed goal summary."),
      dependencyNotes: z
        .string()
        .optional()
        .describe("Dependency classification for this chunk, for example blocked, sequential, or parallel-ready with the reason."),
      contextInjectionNotes: z
        .string()
        .optional()
        .describe("Minimal context packet guidance for the worker: relevant snippets, schemas, API specs, logs, commands, and expected write paths."),
      expectedReadPaths: z
        .array(z.string())
        .optional()
        .describe("Expected read paths for this chunk. Use this to keep worker context explicit and reviewable without broad repository dumps."),
      expectedWritePaths: z
        .array(z.string())
        .optional()
        .describe("Expected write paths for this chunk. Use this to keep parallel workers inside disjoint scopes. Include shared manifests, lockfiles, schemas, API contracts, and config files when a worker may update them so the conflict audit can warn about integration-sensitive surfaces."),
      verificationCommands: z
        .array(z.string())
        .optional()
        .describe("Commands or checks the worker/evaluator should run for this chunk."),
      assignedWorker: z
        .string()
        .optional()
        .describe("Optional worker or subagent identifier assigned to this chunk."),
      dependencyMap: z
        .array(z.string())
        .optional()
        .describe("Chunk dependencies or ordering notes, one entry per dependency edge or prerequisite."),
      mergeOwner: z
        .string()
        .optional()
        .describe("Named hub/worker responsible for integrating outputs when this chunk touches shared surfaces."),
      integrationOwner: z
        .string()
        .optional()
        .describe("Named owner responsible for cross-chunk runtime, API, DB, CI, release, or dependency integration."),
      parallelSafetyStatus: z
        .enum(["unclassified", "blocked", "sequential", "parallel-ready", "needs-merge-owner"])
        .optional()
        .describe("Explicit orchestration classification for this chunk before any worker is launched."),
      evaluationThreshold: z
        .string()
        .optional()
        .describe("Exit threshold for the work -> evaluate -> improve loop before the hub accepts the chunk."),
      adoptionTrack: z
        .enum(["legacy-modernization", "greenfield"])
        .optional()
        .describe('Whether this governed session belongs to a legacy modernization track or a greenfield track. Default: "greenfield".'),
      contextPolicy: z
        .enum(["balanced", "prefer-reset", "prefer-compaction"])
        .optional()
        .describe('Context handling preference for long-running work. Default: "balanced".'),
      queueIfBusy: z
        .boolean()
        .optional()
        .describe("If true (default), create a queued governed session when another session already holds the active lease."),
      force: z
        .boolean()
        .optional()
        .describe("Reserved for stale-index recovery. Open governed sessions are never replaced automatically."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = startHarnessSession({
        workspacePath: params.workspacePath,
        goal: params.goal,
        originalRequest: params.originalRequest,
        processSummary: params.processSummary,
        resultSummary: params.resultSummary,
        title: params.title,
        sessionId: params.sessionId,
        chunkId: params.chunkId,
        chunkTitle: params.chunkTitle,
        dependencyNotes: params.dependencyNotes,
        contextInjectionNotes: params.contextInjectionNotes,
        expectedReadPaths: params.expectedReadPaths,
        expectedWritePaths: params.expectedWritePaths,
        verificationCommands: params.verificationCommands,
        assignedWorker: params.assignedWorker,
        dependencyMap: params.dependencyMap,
        mergeOwner: params.mergeOwner,
        integrationOwner: params.integrationOwner,
        parallelSafetyStatus: params.parallelSafetyStatus,
        evaluationThreshold: params.evaluationThreshold,
        adoptionTrack: params.adoptionTrack,
        contextPolicy: params.contextPolicy,
        queueIfBusy: params.queueIfBusy,
        force: params.force,
      });
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to start harness session: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: advance_harness_session
// ---------------------------------------------------------------------------

server.registerTool(
  "advance_harness_session",
  {
    title: "Advance Harness Session",
    description: `Advance the active planner / generator / evaluator runtime session through the governed state machine.

Use this tool after each meaningful phase step. The action determines how the current phase changes:
- complete: move to the next approved phase
- request_changes: send the work back to the required rework phase
- block: mark the session blocked without changing phase
- resume: clear a blocked session and continue
- context_reset: write a handover for a fresh AI session while keeping the same phase active

Every transition writes durable evidence into the runtime session files and re-syncs the dashboard.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
      action: z
        .enum(HARNESS_RUNTIME_ACTIONS)
        .describe("Transition action to apply to the current active phase"),
      actorRole: z
        .enum(HARNESS_RUNTIME_ACTORS)
        .describe("Role performing this phase transition"),
      note: z
        .string()
        .describe("Durable note describing what changed, what was decided, or why the session is blocked"),
      originalRequest: z
        .string()
        .optional()
        .describe("Original user request text for this agent task. Defaults to the session request record when omitted."),
      processSummary: z
        .string()
        .min(1)
        .describe("What the actor actually did during this task or phase step."),
      resultSummary: z
        .string()
        .min(1)
        .describe("User-facing result of this task or phase step."),
      artifactPaths: z
        .array(z.string())
        .optional()
        .describe("Additional workspace-relative artifact paths that should be linked to this transition"),
      nextStep: z
        .string()
        .optional()
        .describe("Optional explicit next-step instruction to override the default phase guidance"),
      reviewVerdict: z
        .string()
        .optional()
        .describe("Optional structured verdict for a negative review, evaluator pass, remediation review, or verification gate."),
      findings: z
        .array(z.string())
        .optional()
        .describe("Negative review findings or risks that must remain visible in the evaluation loop."),
      requiredFixes: z
        .array(z.string())
        .optional()
        .describe("Concrete improvements required before the session can pass the review loop."),
      verificationEvidence: z
        .array(z.string())
        .optional()
        .describe("Evidence paths, commands, receipts, or review artifacts proving remediation or verification."),
      residualRisk: z
        .string()
        .optional()
        .describe("Residual risk accepted after remediation or verification."),
      scoreBefore: z
        .number()
        .optional()
        .describe("Optional score before remediation for score movement tracking."),
      scoreAfter: z
        .number()
        .optional()
        .describe("Optional score after remediation for score movement tracking."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = advanceHarnessSession({
        workspacePath: params.workspacePath,
        sessionId: params.sessionId,
        action: params.action,
        actorRole: params.actorRole,
        note: params.note,
        originalRequest: params.originalRequest,
        processSummary: params.processSummary,
        resultSummary: params.resultSummary,
        artifactPaths: params.artifactPaths,
        nextStep: params.nextStep,
        reviewVerdict: params.reviewVerdict,
        findings: params.findings,
        requiredFixes: params.requiredFixes,
        verificationEvidence: params.verificationEvidence,
        residualRisk: params.residualRisk,
        scoreBefore: params.scoreBefore,
        scoreAfter: params.scoreAfter,
      });
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to advance harness session: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_harness_session_status
// ---------------------------------------------------------------------------

server.registerTool(
  "get_harness_session_status",
  {
    title: "Get Harness Session Status",
    description: `Read the current planner / generator / evaluator runtime session and summarize the next actor, current phase, evidence paths, and resumable instruction.

Use this when:
- a fresh AI session needs to resume ongoing work
- an operator wants the latest governed runtime status
- you need the next actor brief before planning, generation, or evaluation continues`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = getHarnessSessionStatus(params.workspacePath, params.sessionId);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to read harness session status: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: list_harness_sessions
// ---------------------------------------------------------------------------

server.registerTool(
  "list_harness_sessions",
  {
    title: "List Harness Sessions",
    description: `List governed runtime sessions without requiring operators to inspect session-index.json manually.

Use this when:
- a user wants to see active, queued, blocked, open, or closed harness work
- an agent needs to choose the correct session before status, log, handoff, or activation
- orchestration needs a quick queue and evaluation-loop overview`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      filter: z
        .enum(["all", "open", "active", "queued", "blocked", "closed"])
        .optional()
        .describe('Optional session filter. Default: "all".'),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = listHarnessSessions(params.workspacePath, params.filter);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to list harness sessions: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_harness_session_log
// ---------------------------------------------------------------------------

server.registerTool(
  "get_harness_session_log",
  {
    title: "Get Harness Session Log",
    description: `Read the recent event and evaluation-loop history for a governed runtime session.

Use this when:
- a fresh agent needs the actual task trail, not just file paths
- a reviewer wants request/process/result traceability
- an operator needs the recent negative-review and remediation record before deciding the next action`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of recent events and evaluation records to return. Default: 20; max: 100."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = getHarnessSessionLog(
        params.workspacePath,
        params.sessionId,
        params.limit
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to read harness session log: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: activate_harness_session
// ---------------------------------------------------------------------------

server.registerTool(
  "activate_harness_session",
  {
    title: "Activate Harness Session",
    description: `Move the single active runtime lease to a queued, blocked, or otherwise resumable harness session.

Use this when:
- multiple governed sessions exist and the team wants to change focus
- the current active lease is blocked and another session should proceed
- a queued session is ready to become the main execution thread

By default the MCP refuses to steal the lease from a still-active session unless force is true.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      sessionId: z
        .string()
        .describe("Session ID to activate as the current execution lease"),
      reason: z
        .string()
        .optional()
        .describe("Optional note explaining why execution focus is moving to this session"),
      force: z
        .boolean()
        .optional()
        .describe("If true, allow moving the lease away from a non-closed active session"),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = activateHarnessSession(
        params.workspacePath,
        params.sessionId,
        params.reason,
        params.force
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to activate harness session: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: audit_harness_runtime
// ---------------------------------------------------------------------------

server.registerTool(
  "audit_harness_runtime",
  {
    title: "Audit Harness Runtime",
    description: `Audit the governed runtime ledgers under docs/ai-harness/runtime/.

This audit checks:
- session-index.json and active-session.json shape
- lease metadata, queue depth, and active-session consistency
- missing or mismatched session files
- orphan session files not referenced by the index

Use this before long pauses, handovers, or release checkpoints when you want strong confidence that the runtime ledger is still trustworthy.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = auditHarnessRuntime(params.workspacePath);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to audit harness runtime: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: compact_harness_runtime
// ---------------------------------------------------------------------------

server.registerTool(
  "compact_harness_runtime",
  {
    title: "Compact Harness Runtime",
    description: `Archive older closed runtime sessions into durable archive bundles so the active runtime ledgers stay readable.

This tool:
- keeps the newest closed sessions active in session-index.json
- moves older closed session files into docs/ai-harness/runtime/archive/
- writes an archive bundle and archive summary
- removes archived sessions from the main dashboard session ledgers while preserving archive artifacts

Use it when governed runtime history grows large and operators need a lighter day-to-day control surface.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      keepRecentClosed: z
        .number()
        .optional()
        .describe(
          "How many of the newest closed sessions should remain in the active runtime ledger. Default: 10"
        ),
      maxArchiveSessions: z
        .number()
        .optional()
        .describe(
          "Maximum number of closed sessions to compact in one run. Default: 25"
        ),
      reason: z
        .string()
        .optional()
        .describe("Optional durable reason for the compaction run"),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = compactHarnessRuntime({
        workspacePath: params.workspacePath,
        keepRecentClosed: params.keepRecentClosed,
        maxArchiveSessions: params.maxArchiveSessions,
        reason: params.reason,
      });
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to compact harness runtime: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: prepare_harness_work_packet
// ---------------------------------------------------------------------------

server.registerTool(
  "prepare_harness_work_packet",
  {
    title: "Prepare Harness Work Packet",
    description: `Regenerate the durable work packet and actor inbox files for a governed runtime session.

Use this when:
- a fresh AI session needs a clean, file-based handoff packet
- another IDE or runtime should pick up the next planner / generator / evaluator task
- runtime notes, artifacts, or queue state changed and the packet should be refreshed explicitly

The MCP also refreshes work packets automatically during session changes, but this tool gives operators an explicit way to rebuild them on demand.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = prepareHarnessWorkPacket(
        params.workspacePath,
        params.sessionId
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to prepare harness work packet: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: list_harness_runtime_adapters
// ---------------------------------------------------------------------------

server.registerTool(
  "list_harness_runtime_adapters",
  {
    title: "List Harness Runtime Adapters",
    description: `List the supported runtime adapters that can consume governed harness work packets.

Use this when:
- an operator needs to choose between GitHub Copilot, Codex CLI, Claude Code, Gemini CLI, generic CLI adapters, OpenHands, or a generic file-based runtime
- you want to understand the handoff style before generating a runtime bundle
- different stakeholders need different AI execution environments for the same governed session`,
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const result = listHarnessRuntimeAdapters();
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to list harness runtime adapters: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: prepare_harness_adapter_handoff
// ---------------------------------------------------------------------------

server.registerTool(
  "prepare_harness_adapter_handoff",
  {
    title: "Prepare Harness Adapter Handoff",
    description: `Generate a runtime-specific handoff bundle for a governed harness session.

This tool:
- refreshes the durable work packet if needed
- maps the governed session into a runtime-specific adapter bundle
- writes portable handoff files under docs/ai-harness/runtime/adapter-handoffs/
- gives operators a clean artifact set to pass to GitHub Copilot, Codex CLI, Claude Code, Gemini CLI, generic CLI adapters, OpenHands, or a generic external runtime

Use this whenever a governed session should continue in a concrete execution environment.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      adapterId: z
        .enum(HARNESS_RUNTIME_ADAPTER_IDS)
        .describe("Runtime adapter to prepare for the governed session"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = prepareHarnessAdapterHandoff(
        params.workspacePath,
        params.adapterId,
        params.sessionId
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to prepare harness adapter handoff: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: list_harness_execution_bridges
// ---------------------------------------------------------------------------

server.registerTool(
  "list_harness_execution_bridges",
  {
    title: "List Harness Execution Bridges",
    description: `List the concrete execution bridges that turn adapter handoffs into launch bundles and governed result receipts.`,
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const result = listHarnessExecutionBridges();
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to list harness execution bridges: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: list_harness_native_executors
// ---------------------------------------------------------------------------

server.registerTool(
  "list_harness_native_executors",
  {
    title: "List Harness Native Executors",
    description: `List the directly launchable native executor integrations and report what is locally detectable on this machine.`,
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const result = listHarnessNativeExecutors();
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to list harness native executors: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: prepare_harness_native_executor
// ---------------------------------------------------------------------------

server.registerTool(
  "prepare_harness_native_executor",
  {
    title: "Prepare Harness Native Executor",
    description: `Build the governed native execution plan, state file, and log targets for a supported runtime executor.

Use this after preparing an execution bridge when you want a directly launchable command plan for GitHub Copilot, Codex CLI, Claude Code, Gemini CLI, generic CLI adapters, OpenHands, or a portable file-based runtime.

For Codex CLI, the generated plan can prefer codex exec and capture the final assistant message in a durable runtime artifact.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      bridgeId: z
        .enum(HARNESS_RUNTIME_ADAPTER_IDS)
        .describe("Native executor / bridge ID to prepare"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
      executableOverride: z
        .string()
        .optional()
        .describe("Optional explicit executable path to use instead of auto-detection."),
      argsOverride: z
        .array(z.string())
        .optional()
        .describe("Optional explicit argument list for the native executor launch plan."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = prepareHarnessNativeExecutor(
        params.workspacePath,
        params.bridgeId,
        params.sessionId,
        {
          executableOverride: params.executableOverride,
          argsOverride: params.argsOverride,
        }
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to prepare harness native executor: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: launch_harness_native_executor
// ---------------------------------------------------------------------------

server.registerTool(
  "launch_harness_native_executor",
  {
    title: "Launch Harness Native Executor",
    description: `Launch a supported native executor from the governed workspace and record its direct execution state.

Use foreground mode when you want an immediate result in the current tool call. Use background mode when an operator will supervise the run through the generated logs, status files, and any captured last-message artifact.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      bridgeId: z
        .enum(HARNESS_RUNTIME_ADAPTER_IDS)
        .describe("Native executor / bridge ID to launch"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
      executableOverride: z
        .string()
        .optional()
        .describe("Optional explicit executable path to use instead of auto-detection."),
      argsOverride: z
        .array(z.string())
        .optional()
        .describe("Optional explicit argument list for the native executor launch."),
      allowUnsafeNativeExecutorOverride: z
        .boolean()
        .optional()
        .describe("Required as true for real launches that use executableOverride, argsOverride, or env. Dry runs do not require it."),
      waitForExit: z
        .boolean()
        .optional()
        .describe("If true, run in foreground and wait for completion."),
      dryRun: z
        .boolean()
        .optional()
        .describe("If true, do not launch. Return the resolved command plan only."),
      env: z
        .record(z.string(), z.string())
        .optional()
        .describe("Optional environment variable overrides for the native executor process."),
      timeoutMs: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Optional maximum runtime in milliseconds. Defaults to 600000."),
      maxOutputBytes: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Optional stdout/stderr byte cap per stream. Defaults to 1048576."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = launchHarnessNativeExecutor({
        workspacePath: params.workspacePath,
        bridgeId: params.bridgeId,
        sessionId: params.sessionId,
        executableOverride: params.executableOverride,
        argsOverride: params.argsOverride,
        allowUnsafeNativeExecutorOverride: params.allowUnsafeNativeExecutorOverride,
        waitForExit: params.waitForExit,
        dryRun: params.dryRun,
        env: params.env,
        timeoutMs: params.timeoutMs,
        maxOutputBytes: params.maxOutputBytes,
      });
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to launch harness native executor: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_harness_native_execution_status
// ---------------------------------------------------------------------------

server.registerTool(
  "get_harness_native_execution_status",
  {
    title: "Get Harness Native Execution Status",
    description: `Read the current or session-specific native executor state snapshot for a governed runtime.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID for session-specific state lookup."),
      bridgeId: z
        .enum(HARNESS_RUNTIME_ADAPTER_IDS)
        .optional()
        .describe("Optional bridge ID. Provide this with sessionId for session-specific state lookup."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = getHarnessNativeExecutionStatus(
        params.workspacePath,
        params.sessionId,
        params.bridgeId
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to read harness native execution status: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: prepare_harness_execution_bridge
// ---------------------------------------------------------------------------

server.registerTool(
  "prepare_harness_execution_bridge",
  {
    title: "Prepare Harness Execution Bridge",
    description: `Generate a launch-ready execution bridge bundle for a governed harness session.

This tool writes:
- a bridge manifest
- PowerShell and bash launch helper scripts
- a result template
- a governance return guide

Use it after preparing an adapter handoff when the session is about to continue in a specific runtime.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      bridgeId: z
        .enum(HARNESS_RUNTIME_ADAPTER_IDS)
        .describe("Execution bridge to prepare for the governed session"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = prepareHarnessExecutionBridge(
        params.workspacePath,
        params.bridgeId,
        params.sessionId
      );
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to prepare harness execution bridge: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: record_harness_execution_result
// ---------------------------------------------------------------------------

server.registerTool(
  "record_harness_execution_result",
  {
    title: "Record Harness Execution Result",
    description: `Record the result of an external runtime execution as a governed receipt.

Use this after GitHub Copilot, Codex CLI, Claude Code, Gemini CLI, generic CLI runtime, OpenHands, or another external runtime finishes its launch bundle work. The receipt does not advance the governed state machine by itself, but it gives the next planner / generator / evaluator step a durable artifact to review.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      bridgeId: z
        .enum(HARNESS_RUNTIME_ADAPTER_IDS)
        .describe("Execution bridge that produced the external runtime result"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
      outcome: z
        .enum(["completed", "needs-review", "blocked", "failed"])
        .describe("Outcome of the external runtime execution"),
      summary: z
        .string()
        .describe("Durable summary of what the external runtime completed or why it failed"),
      originalRequest: z
        .string()
        .optional()
        .describe("Original user request text preserved for execution receipt traceability. Defaults to the session request record."),
      processSummary: z
        .string()
        .min(1)
        .describe("Commands, files, checks, and decisions the external runtime performed."),
      resultSummary: z
        .string()
        .min(1)
        .describe("User-facing execution result, including remaining risk or next work."),
      artifactPaths: z
        .array(z.string())
        .optional()
        .describe("Workspace-relative artifact paths produced by the external runtime"),
      nextStep: z
        .string()
        .optional()
        .describe("Optional explicit next-step guidance for the governed runtime"),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = recordHarnessExecutionResult({
        workspacePath: params.workspacePath,
        bridgeId: params.bridgeId,
        sessionId: params.sessionId,
        outcome: params.outcome,
        summary: params.summary,
        originalRequest: params.originalRequest,
        processSummary: params.processSummary,
        resultSummary: params.resultSummary,
        artifactPaths: params.artifactPaths,
        nextStep: params.nextStep,
      });
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to record harness execution result: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: analyze_workspace
// ---------------------------------------------------------------------------

server.registerTool(
  "analyze_workspace",
  {
    title: "Analyze Workspace",
    description: `Analyze an existing workspace directory to detect project type, tech stack,
and structure. Returns suggested configuration for initialize_workspace.

This tool is useful when:
- A user has an existing project and wants to add workspace governance
- You need to auto-fill form fields based on project analysis
- The user chose "quick-start" and you need to detect optimal settings

The analysis checks for: package.json, tsconfig.json, pyproject.toml, Docker,
Kubernetes, monorepo markers, and many other project indicators.

Use this before initializing a legacy project so the generated harness, dashboard,
and governance layers can be applied without replacing the existing architecture.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace directory to analyze"),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const result = analyzeWorkspace(params.workspacePath);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Analysis failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: recommend_agent_skills
// ---------------------------------------------------------------------------

server.registerTool(
  "recommend_agent_skills",
  {
    title: "Recommend Agent Skills",
    description: `Recommend AI agent skills and agents based on project type, tech stack, and user intent.

Returns a scored list of recommended:
- **Skills** (.github/skills/): Portable, reusable AI capabilities (SKILL.md format)
- **Agents** (.github/agents/): Specialized agent configurations (.agent.md format)

The recommendation engine scores each entry based on:
- Project type relevance
- Tech stack keyword matching
- User intent/tag matching
- Priority level (core, recommended, specialized)

Use this tool to help users discover and select appropriate agent skills
before installing them with install_agent_skills.

Follows the open Agent Skills standard: https://agentskills.io`,
    inputSchema: z.object({
      projectType: z
        .enum(PROJECT_TYPES)
        .optional()
        .describe("Project type for relevance filtering"),
      techStack: z
        .array(z.string())
        .optional()
        .describe("Tech stack keywords for matching"),
      userIntent: z
        .string()
        .optional()
        .describe(
          "Free-text intent for tuning (e.g., 'testing devops automation ci/cd')"
        ),
      maxAgents: z.number().optional().describe("Max agents to return (default: 10)"),
      maxSkills: z.number().optional().describe("Max skills to return (default: 15)"),
    }),
  },
  async (params) => {
    const result = recommendAgentSkills({
      projectType: params.projectType,
      techStack: params.techStack,
      userIntent: params.userIntent,
      maxAgents: params.maxAgents,
      maxSkills: params.maxSkills,
    });
    return { content: [{ type: "text" as const, text: result.summary }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: search_agent_skills
// ---------------------------------------------------------------------------

server.registerTool(
  "search_agent_skills",
  {
    title: "Search Agent Skills",
    description: `Search the agent skills catalog by free-text query.

Searches across names, descriptions, tags, and categories of all registered
agents and skills. Use this when you need to find specific capabilities.`,
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Search query (e.g., 'testing', 'docker', 'react', 'security')"
        ),
    }),
  },
  async (params) => {
    const result = searchAgentSkills(params.query);
    return { content: [{ type: "text" as const, text: result.summary }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: install_agent_skills
// ---------------------------------------------------------------------------

server.registerTool(
  "install_agent_skills",
  {
    title: "Install Agent Skills",
    description: `Install selected agent skills and agents into a workspace.

Creates a canonical .github/skills/<id>/SKILL.md registry and .github/agents/<id>.agent.md
registry for the specified skill and agent IDs. When targetIDEs are provided or
detected from the workspace, the MCP also mirrors those files into the matching
platform-specific directories and refreshes the canonical catalog indexes.

Use recommend_agent_skills or search_agent_skills first to discover available
skills and agents, then pass the selected IDs to this tool.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      skillIds: z
        .array(z.string())
        .optional()
        .describe(
          "Skill IDs to install (e.g., ['conventional-commit', 'create-specification'])"
        ),
      agentIds: z
        .array(z.string())
        .optional()
        .describe(
          "Agent IDs to install (e.g., ['plan', 'principal-software-engineer'])"
        ),
      targetIDEs: z
        .array(z.enum(TARGET_IDE_VALUES))
        .optional()
        .describe(
          'Target platform mirrors to generate (e.g., ["cursor", "claude-code", "antigravity"]). If omitted, the MCP reuses the workspace machine index or existing platform instruction directories.'
        ),
      force: z
        .boolean()
        .optional()
        .describe("If true, overwrite existing files. Default: false"),
    }),
  },
  async (params) => {
    try {
      assertAbsoluteWorkspacePath(params.workspacePath);
      const skillEntries = (params.skillIds ?? [])
        .map((id) => SKILL_REGISTRY.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => s != null);

      const agentEntries = (params.agentIds ?? [])
        .map((id) => AGENT_REGISTRY.find((a) => a.id === id))
        .filter((a): a is NonNullable<typeof a> => a != null);

      if (skillEntries.length === 0 && agentEntries.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No recognized skill or agent IDs were provided. Use recommend_agent_skills or search_agent_skills first to confirm valid IDs.",
            },
          ],
        };
      }

      const unknownSkills = (params.skillIds ?? []).filter(
        (id) => !SKILL_REGISTRY.some((s) => s.id === id)
      );
      const unknownAgents = (params.agentIds ?? []).filter(
        (id) => !AGENT_REGISTRY.some((a) => a.id === id)
      );
      const targetIDEs = resolveWorkspaceTargetIDEs(
        params.workspacePath,
        params.targetIDEs as WorkspaceInitParams["targetIDEs"]
      );

      const files = generateSelectedSkills(skillEntries, agentEntries, {
        workspaceName: path.basename(params.workspacePath),
        workspacePath: params.workspacePath,
        purpose: "Selected agent skill installation",
        targetIDEs,
      });
      assertGeneratedFilesRespectNonDestructivePolicy(files);
      const force = params.force ?? false;
      const written: string[] = [];
      const skipped: string[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const fullPath = path.join(params.workspacePath, file.relativePath);
        try {
          const dir = path.dirname(fullPath);
          fs.mkdirSync(dir, { recursive: true });

          if (!force && fs.existsSync(fullPath)) {
            skipped.push(file.relativePath);
            continue;
          }

          fs.writeFileSync(fullPath, file.content, "utf-8");
          written.push(file.relativePath);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${file.relativePath}: ${msg}`);
        }
      }

      const writtenList = written.length > 0 ? written.map((entry) => `  - ${entry}`).join("\n") : "  - none";
      let text = "Agent Skills installation complete.\n\n";
      text += `Target platform mirrors: ${targetIDEs.join(", ")}\n`;
      text += "Canonical registry: .github/skills/ and .github/agents/\n\n";
      text += `Written files (${written.length}):\n${writtenList}\n`;

      if (skipped.length > 0) {
        text += `\nSkipped existing files (${skipped.length}):\n${skipped.map((entry) => `  - ${entry}`).join("\n")}`;
        text += "\n  Re-run with force: true to overwrite them.\n";
      }
      if (unknownSkills.length > 0) {
        text += `\nUnknown skill IDs: ${unknownSkills.join(", ")}`;
      }
      if (unknownAgents.length > 0) {
        text += `\nUnknown agent IDs: ${unknownAgents.join(", ")}`;
      }
      if (errors.length > 0) {
        text += `\n\nErrors:\n${errors.map((entry) => `  - ${entry}`).join("\n")}`;
      }

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text" as const, text: `Installation failed: ${msg}` },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: list_agent_skills_catalog
// ---------------------------------------------------------------------------

server.registerTool(
  "list_agent_skills_catalog",
  {
    title: "List Agent Skills Catalog",
    description: `List the full catalog of available agent skills and agents.

Returns categorized lists of all registered skills and agents with their IDs,
names, descriptions, and categories. Use this for browsing the full catalog.`,
    inputSchema: z.object({
      filter: z
        .enum(["all", "agents", "skills"])
        .optional()
        .describe("Filter: 'all' (default), 'agents', or 'skills'"),
    }),
  },
  async (params) => {
    const filter = params.filter ?? "all";
    const cats = listCategories();
    const indexes = buildCatalogIndexes();
    const parts: string[] = [];

    parts.push("# Agent Skills Catalog");
    parts.push("");
    parts.push("## Indexed Views");
    parts.push(
      `- Roles: ${indexes.roles.map((role) => `${role.label} (${role.agents.length + role.skills.length})`).join(", ")}`
    );
    parts.push(
      `- Domains: ${indexes.domains.map((domain) => `${domain.label} (${domain.agents.length + domain.skills.length})`).join(", ")}`
    );
    parts.push("");

    if (filter !== "skills") {
      parts.push(`## Agents (${AGENT_REGISTRY.length})`);
      parts.push(`Categories: ${cats.agentCategories.join(", ")}`);
      for (const agent of AGENT_REGISTRY) {
        parts.push(
          `- **${agent.name}** (\`${agent.id}\`) [${agent.categories.join(", ")}] - ${agent.description}`
        );
      }
      parts.push("");
    }

    if (filter !== "agents") {
      parts.push(`## Skills (${SKILL_REGISTRY.length})`);
      parts.push(`Categories: ${cats.skillCategories.join(", ")}`);
      for (const skill of SKILL_REGISTRY) {
        parts.push(
          `- **${skill.name}** (\`${skill.id}\`) [${skill.categories.join(", ")}] - ${skill.description}`
        );
      }
    }

    return { content: [{ type: "text" as const, text: parts.join("\n") }] };
  }
);

// ---------------------------------------------------------------------------
// Prompts: User-facing forms for MCP clients
// ---------------------------------------------------------------------------

server.registerPrompt(
  "workspace-init",
  {
    title: "Initialize Workspace",
    description:
      "Collect the full set of inputs required to initialize a workspace with documentation, governance, and Agent Skills.",
    argsSchema: {
      workspaceName: z
        .string()
        .describe("Workspace name used in headings, filenames, and generated summaries"),
      purpose: z
        .string()
        .describe("Primary project goal and delivery objective"),
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      projectType: z
        .string()
        .optional()
        .describe("Project type: learning, web-app, api, mobile, data-science, devops, creative, library, monorepo, consulting, ecommerce, fintech, healthcare, saas, iot, other"),
      primaryDomains: z
        .string()
        .optional()
        .describe('Primary domains as a comma-separated list, for example "commerce, identity, device-auth, benefits"'),
      techStack: z
        .string()
        .optional()
        .describe('Technology stack as a comma-separated list, for example "TypeScript, React, Node.js"'),
      docLanguage: z
        .string()
        .optional()
        .describe('Documentation language (default: "Korean")'),
      codeCommentLanguage: z
        .string()
        .optional()
        .describe('Code comment language (default: "English")'),
      isMultiRepo: z
        .string()
        .optional()
        .describe('Whether the workspace manages multiple repositories ("true" or "false", default: false)'),
      additionalContext: z
        .string()
        .optional()
        .describe("Additional constraints, policies, or project-specific context"),
      plannedTasks: z
        .string()
        .optional()
        .describe('Planned workflows as a comma-separated list, for example "Auth implementation, API design"'),
      harnessProfile: z
        .string()
        .optional()
        .describe("Harness profile: lean, balanced, regulated, autonomous"),
      governanceProfile: z
        .string()
        .optional()
        .describe("Governance profile: standard, strict, regulated"),
      autonomyMode: z
        .string()
        .optional()
        .describe("AI autonomy mode: guided, balanced, autonomous"),
      tokenBudget: z
        .string()
        .optional()
        .describe("Token strategy: lean, balanced, thorough"),
      domainStressProfile: z
        .string()
        .optional()
        .describe("Domain stress profile id or label: identity-commerce-operations, legacy-modernization-governance, content-release-governance, or a custom value such as Learning Growth Harness"),
      legacyAdoptionProfile: z
        .string()
        .optional()
        .describe("Existing-project modernization context: legacy entities, routes, data stores, risks, and migration goals"),
    },
  },
  (args) => {
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined) filtered[k] = v;
    }
    return buildWorkspaceInitMessages(filtered);
  }
);

server.registerPrompt(
  "workspace-quick-start",
  {
    title: "Quick Workspace Init",
    description:
      "Initialize a workspace from the minimum required inputs and let the MCP infer the rest when possible.",
    argsSchema: {
      workspaceName: z.string().describe("Workspace name"),
      purpose: z.string().describe("Project purpose or short objective"),
      workspacePath: workspacePathInputSchema("Absolute workspace path"),
    },
  },
  (args) => buildQuickStartMessages(args)
);

server.registerPrompt(
  "workspace-analyze",
  {
    title: "Analyze Workspace",
    description:
      "Analyze an existing workspace to infer project type, tech stack, and initialization status.",
    argsSchema: {
      workspacePath: workspacePathInputSchema(
        "Absolute path to the workspace being analyzed"
      ),
    },
  },
  (args) => buildAnalyzeMessages(args)
);

// ---------------------------------------------------------------------------
// Resources: Project type configurations
// ---------------------------------------------------------------------------

server.registerResource(
  "project-types-overview",
  "workspace-init://project-types",
  {
    title: "Project Type Guide",
    description: "Overview of supported project types and their default configuration",
    mimeType: "text/markdown",
  },
  async (uri) => {
    const overview = Object.entries(PROJECT_TYPE_CONFIGS)
      .map(
        ([key, config]) =>
          `## ${config.label} (\`${key}\`)\n\n${config.description}\n\n` +
          `- Default tech stack: ${config.defaultTechStack.length ? config.defaultTechStack.join(", ") : "none"}\n` +
          `- Documentation sections: ${config.docSections.length ? config.docSections.join(", ") : "none"}\n` +
          `- Extra guidance:\n${config.extraInstructions.map((instruction) => `  - ${instruction}`).join("\n")}`
      )
      .join("\n\n---\n\n");

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# Project Type Guide\n\n${overview}`,
        },
      ],
    };
  }
);

server.registerResource(
  "project-type-detail",
  new ResourceTemplate("workspace-init://project-types/{type}", {
    list: async () => ({
      resources: Object.entries(PROJECT_TYPE_CONFIGS).map(([key, config]) => ({
        uri: `workspace-init://project-types/${key}`,
        name: config.label,
        description: config.description,
        mimeType: "application/json" as const,
      })),
    }),
  }),
  {
    title: "Project Type Detail",
    description: "Detailed configuration data for a specific project type",
    mimeType: "application/json",
  },
  async (uri, params) => {
    const typeName = params.type as string;
    const config =
      PROJECT_TYPE_CONFIGS[typeName as keyof typeof PROJECT_TYPE_CONFIGS];

    if (!config) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain" as const,
            text: `Project type "${typeName}" was not found. Supported types: ${Object.keys(PROJECT_TYPE_CONFIGS).join(", ")}`,
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json" as const,
          text: JSON.stringify({ type: typeName, ...config }, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Resources: Agent Skills catalog
// ---------------------------------------------------------------------------

server.registerResource(
  "agent-skills-catalog",
  "workspace-init://agent-skills",
  {
    title: "Agent Skills Catalog",
    description:
      "Catalog of all registered Agent Skills and agents, including role and domain indexes.",
    mimeType: "application/json",
  },
  async (uri) => {
    const indexes = buildCatalogIndexes();
    const catalog = {
      standard: "https://agentskills.io",
      indexes: {
        roles: indexes.roles.map((role) => ({
          id: role.id,
          label: role.label,
          description: role.description,
          agentIds: role.agents.map((agent) => agent.id),
          skillIds: role.skills.map((skill) => skill.id),
        })),
        domains: indexes.domains.map((domain) => ({
          id: domain.id,
          label: domain.label,
          description: domain.description,
          agentIds: domain.agents.map((agent) => agent.id),
          skillIds: domain.skills.map((skill) => skill.id),
        })),
      },
      agents: AGENT_REGISTRY.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        categories: a.categories,
        tags: a.tags,
        relevantProjectTypes: a.relevantProjectTypes,
        priority: a.priority,
      })),
      skills: SKILL_REGISTRY.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        categories: s.categories,
        tags: s.tags,
        relevantProjectTypes: s.relevantProjectTypes,
        hasResources: s.hasResources,
        priority: s.priority,
      })),
    };

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json" as const,
          text: JSON.stringify(catalog, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`workspace-init-mcp server v${WORKSPACE_INIT_MCP_VERSION} started on stdio`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
