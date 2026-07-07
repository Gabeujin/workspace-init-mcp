/**
 * MCP Tool: initialize_workspace
 *
 * Orchestrates all generators to produce the complete set of files
 * for workspace initialization.
 */

import {
  type GeneratedFile,
  type InitResult,
  type WorkspaceInitParams,
} from "../types.js";
import {
  generateAgentSkills,
  generateAgentPlatformInstructionFiles,
  generateCodeGenInstructions,
  generateCommitInstructions,
  generateCopilotInstructions,
  generateDashboardFiles,
  generateDashboardOperationFiles,
  generateDocsStructure,
  generateEditorConfig,
  generateGitAttributes,
  generateHarnessCoreAgentSkills,
  generateHarnessFiles,
  generateOntologyFiles,
  generateReadinessFiles,
  generateRuntimeOrchestratorFiles,
  generateInitialChangelog,
  generatePRInstructions,
  generateReviewInstructions,
  generateSettings,
  generateSetupWorkLog,
  generateTestInstructions,
} from "../generators/index.js";
import { buildManagedFileInventoryFile } from "./managed-inventory.js";
import { assertGeneratedFilesRespectNonDestructivePolicy } from "./generated-file-safety.js";

/**
 * Collect all files to be generated for the workspace.
 * Does not write to disk; returns a list of GeneratedFile objects.
 */
export function collectFiles(params: WorkspaceInitParams): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // 1. Copilot/global instructions
  files.push(generateCopilotInstructions(params));
  files.push(...generateAgentPlatformInstructionFiles(params));

  // 2. VS Code settings and custom instruction files
  files.push(generateSettings(params));
  files.push(generateCodeGenInstructions(params));
  files.push(generateTestInstructions());
  files.push(generateReviewInstructions());
  files.push(generateCommitInstructions());
  files.push(generatePRInstructions());

  // 3. Cross-editor config files
  files.push(generateEditorConfig(params));
  files.push(generateGitAttributes(params));

  // 4. Documentation governance structure
  files.push(...generateDocsStructure(params));

  // 5. Agent Skills (.github/skills/ and .github/agents/)
  if (params.includeAgentSkills !== false) {
    files.push(
      ...generateAgentSkills(params, {
        userIntent: params.agentSkillsIntent,
      })
    );
  } else if (params.includeHarnessEngineering !== false) {
    files.push(...generateHarnessCoreAgentSkills(params));
  }

  // 6. AI harness engineering artifacts
  if (params.includeHarnessEngineering !== false) {
    files.push(...generateHarnessFiles(params));
    files.push(...generateOntologyFiles(params));
    files.push(...generateRuntimeOrchestratorFiles(params));
    files.push(...generateReadinessFiles(params));
    files.push(...generateDashboardFiles(params));
    files.push(...generateDashboardOperationFiles(params));
  }

  // 7. Initial changelog and work log
  const relativePaths = files.map((file) => file.relativePath);
  files.push(generateInitialChangelog(params, relativePaths));
  files.push(
    generateSetupWorkLog(params, [
      ...relativePaths,
      "docs/changelog/...",
      "docs/work-logs/...",
    ])
  );
  if (params.includeHarnessEngineering !== false) {
    files.push(buildManagedFileInventoryFile(files));
  }

  assertGeneratedFilesRespectNonDestructivePolicy(files);

  return files;
}

/**
 * Build a human-readable summary of the initialization result.
 */
export function buildSummary(
  params: WorkspaceInitParams,
  files: GeneratedFile[]
): InitResult {
  const relativePaths = files.map((file) => file.relativePath);
  const harnessStatus =
    params.includeHarnessEngineering === false
      ? "disabled"
      : params.harnessProfile ?? "balanced";
  const primaryDomains =
    params.primaryDomains?.join(", ") ??
    params.projectType ??
    "general-software-delivery";
  const suggestedNextSteps =
    params.includeHarnessEngineering === false
      ? [
          "  1. Review .github/copilot-instructions.md and the generated editor instruction files.",
          "  2. Review AGENTS.md and any detected platform overlays such as CLAUDE.md, .cursor/rules/, or .agents/plugins/ so every AI agent starts from the same harness contract.",
          "  3. Start from .github/AGENT-SKILLS.md, AGENT-SKILLS-BY-ROLE.md, and AGENT-SKILLS-BY-DOMAIN.md to trim or extend the catalog.",
          "  4. Review docs/work-logs and docs/changelog for the initialization record.",
          "  5. If this is a legacy project, keep workspace-init-mcp as a non-destructive documentation and IDE overlay unless you explicitly enable the full AI harness later.",
          "  6. Re-run initialization with includeHarnessEngineering: true when you want dashboard, runtime, readiness, reconcile, and governed parallel-agent workflows.",
        ]
      : [
          "  1. Review .github/copilot-instructions.md, AGENTS.md, and detected platform overlays so Copilot, Codex, Claude Code, Cursor, Antigravity, and other agents share the same harness contract.",
          "  2. Review .github/ai-harness/context-strategy.md and evaluation-rubrics.md before long-running work begins, especially context injection, hub review, parallel chunking, and post-work maturity gate rules.",
          "  3. Review .github/ai-harness/managed-file-inventory.json and .github/ai-harness/reconcile-policy.json so future reconcile runs can distinguish managed baseline files from user customization and apply the right hold/merge/replace policy.",
          "  4. Start from .github/AGENT-SKILLS.md, AGENT-SKILLS-BY-ROLE.md, and AGENT-SKILLS-BY-DOMAIN.md to trim or extend the catalog.",
          "  5. Open docs/ai-harness/dashboard/index.html to inspect the single-file Project World Model snapshot.",
          "  6. Confirm active AI agent platforms in the Governance tab, then run node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs record-agent-platforms --platforms <platforms> --source user-declaration when detection is uncertain.",
          "  7. Use docs/contracts/ and docs/evaluations/ to record chunk contracts and independent evaluator evidence.",
          "  8. Use docs/ai-harness/dashboard/templates/*.state.json when you need a domain-specific starting point.",
          "  9. Run node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs ensure-listening to restore the read-only local dashboard listener on an available port.",
          "  10. Run node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh to rebuild projections from ledger-backed state and collect Git/SVN evidence.",
          "  11. Use start_harness_session, advance_harness_session, and get_harness_session_status to run real planner/generator/evaluator sessions.",
          "  12. Review docs/ai-harness/readiness/remaining-work-spec.md and score the workspace against the readiness model.",
          "  13. Run the semantic readiness audit when you need a stricter operator view of placeholder pressure, evidence freshness, and dashboard truthfulness.",
          "  14. Run audit_workspace_upgrade_risk before major reconcile operations or legacy adoption.",
          "  15. For legacy projects, treat workspace-init-mcp as a non-destructive harness overlay: do not delete or replace existing application source while adopting the governance artifacts.",
          "  16. For parallel delivery, have the main agent act as hub: split independent chunks, assign suitable subagents, inject only task-relevant context, audit expectedWritePaths, review worker receipts, and repeat work-evaluate-improve until the exit criteria are satisfied.",
          "  17. Tailor skill selection, dashboard KPIs, runtime adapters, and operating rules to your real workflows.",
          "  18. Use runtime archive compaction when closed sessions accumulate and the active ledgers need to stay lightweight.",
          "  19. Keep docs/work-logs, docs/reviews, docs/contracts, docs/evaluations, docs/handovers, runtime session files, readiness scorecards, semantic audits, and dashboard state current as work evolves.",
        ];

  const summary = [
    `Workspace initialization complete: ${params.workspaceName}`,
    "",
    `Generated files (${files.length}):`,
    ...relativePaths.map((relativePath) => `  - ${relativePath}`),
    "",
    "Configuration summary:",
    `  - Purpose: ${params.purpose}`,
    `  - Project type: ${params.projectType ?? "other"}`,
    `  - Tech stack: ${params.techStack?.join(", ") || "not specified"}`,
    `  - Multi-repo: ${params.isMultiRepo ? "yes" : "no"}`,
    `  - Documentation language: ${params.docLanguage ?? "Korean"}`,
    `  - Code comment language: ${params.codeCommentLanguage ?? "English"}`,
    `  - File encoding: ${params.fileEncoding ?? "utf-8"}`,
    `  - Target AI platforms: ${(params.targetIDEs ?? ["vscode"]).join(", ")}`,
    `  - Line endings: ${params.lineEnding ?? "lf"}`,
    `  - Harness engineering: ${harnessStatus}`,
    `  - Governance profile: ${params.governanceProfile ?? "strict"}`,
    `  - Autonomy mode: ${params.autonomyMode ?? "balanced"}`,
    `  - Token budget: ${params.tokenBudget ?? "balanced"}`,
    `  - Primary domains: ${primaryDomains}`,
    "",
    "Suggested next steps:",
    ...suggestedNextSteps,
  ].join("\n");

  return {
    filesCreated: files.length,
    generatedFiles: relativePaths,
    summary,
  };
}
