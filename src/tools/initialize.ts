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
  generateCodeGenInstructions,
  generateCommitInstructions,
  generateCopilotInstructions,
  generateDashboardFiles,
  generateDashboardOperationFiles,
  generateDocsStructure,
  generateEditorConfig,
  generateGitAttributes,
  generateHarnessFiles,
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
  }

  // 6. AI harness engineering artifacts
  files.push(...generateHarnessFiles(params));
  files.push(...generateRuntimeOrchestratorFiles(params));
  files.push(...generateReadinessFiles(params));
  files.push(...generateDashboardFiles(params));
  files.push(...generateDashboardOperationFiles(params));

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
  files.push(buildManagedFileInventoryFile(files));

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
          "  2. Start from .github/AGENT-SKILLS.md, AGENT-SKILLS-BY-ROLE.md, and AGENT-SKILLS-BY-DOMAIN.md to trim or extend the catalog.",
          "  3. Review docs/work-logs and docs/changelog for the initialization record.",
          "  4. If this is a legacy project, keep workspace-init-mcp as a non-destructive documentation and IDE overlay unless you explicitly enable the full AI harness later.",
          "  5. Re-run initialization with includeHarnessEngineering: true when you want dashboard, runtime, readiness, reconcile, and governed parallel-agent workflows.",
        ]
      : [
          "  1. Review .github/copilot-instructions.md and the AI harness files.",
          "  2. Review .github/ai-harness/context-strategy.md and evaluation-rubrics.md before long-running work begins, especially the context-injection and post-work maturity gate rules.",
          "  3. Review .github/ai-harness/managed-file-inventory.json and .github/ai-harness/reconcile-policy.json so future reconcile runs can distinguish managed baseline files from user customization and apply the right hold/merge/replace policy.",
          "  4. Start from .github/AGENT-SKILLS.md, AGENT-SKILLS-BY-ROLE.md, and AGENT-SKILLS-BY-DOMAIN.md to trim or extend the catalog.",
          "  5. Open docs/ai-harness/dashboard/index.html and replace the template JSON state with real project signals.",
          "  6. Use docs/contracts/ and docs/evaluations/ to record chunk contracts and independent evaluator evidence.",
          "  7. Use docs/ai-harness/dashboard/templates/*.state.json when you need a domain-specific starting point.",
          "  8. Run node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh to auto-sync artifacts and git state.",
          "  9. Run node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs export-static --out docs/ai-harness/dashboard/exports/latest when stakeholders need a portable snapshot.",
          "  10. Use start_harness_session, advance_harness_session, and get_harness_session_status to run real planner/generator/evaluator sessions.",
          "  11. Review docs/ai-harness/readiness/remaining-work-spec.md and score the workspace against the readiness model.",
          "  12. Run the semantic readiness audit when you need a stricter operator view of placeholder pressure, evidence freshness, and dashboard truthfulness.",
          "  13. Run audit_workspace_upgrade_risk before major reconcile operations or legacy adoption.",
          "  14. For legacy projects, treat workspace-init-mcp as a non-destructive harness overlay: do not delete or replace existing application source while adopting the governance artifacts.",
          "  15. For parallel delivery, have an orchestrator split independent chunks, inject only task-relevant context into each worker, and reconcile worker outputs through contracts, evaluations, and atomic commits.",
          "  16. Tailor skill selection, dashboard KPIs, runtime adapters, and operating rules to your real workflows.",
          "  17. Use runtime archive compaction when closed sessions accumulate and the active ledgers need to stay lightweight.",
          "  18. Keep docs/work-logs, docs/reviews, docs/contracts, docs/evaluations, docs/handovers, runtime session files, readiness scorecards, semantic audits, and dashboard state current as work evolves.",
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
    `  - Target IDEs: ${(params.targetIDEs ?? ["vscode"]).join(", ")}`,
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
