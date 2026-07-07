/**
 * Tool: validate_workspace
 *
 * Checks whether a workspace has been properly initialized
 * and reports on the completeness of its structure.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { validateDashboardStateShape } from "./dashboard-state.js";
import { validateHarnessRuntimeFiles } from "./harness-runtime.js";

export interface ValidationItem {
  path: string;
  label: string;
  status: "present" | "missing" | "outdated";
  category:
    | "copilot"
    | "agent-platform"
    | "vscode"
    | "docs"
    | "governance"
    | "dashboard";
  severity: "required" | "recommended" | "optional";
  details?: string;
}

export interface ValidationResult {
  workspacePath: string;
  isInitialized: boolean;
  completeness: number;
  items: ValidationItem[];
  summary: string;
  suggestions: string[];
}

const EXPECTED_FILES: Omit<ValidationItem, "status">[] = [
  {
    path: ".github/copilot-instructions.md",
    label: "Global copilot instructions",
    category: "copilot",
    severity: "required",
  },
  {
    path: "AGENTS.md",
    label: "Cross-agent and Codex instructions",
    category: "agent-platform",
    severity: "required",
  },
  {
    path: ".vscode/settings.json",
    label: "VS Code settings",
    category: "vscode",
    severity: "required",
  },
  {
    path: ".vscode/code-generation.instructions.md",
    label: "Code generation instructions",
    category: "vscode",
    severity: "required",
  },
  {
    path: ".vscode/test-generation.instructions.md",
    label: "Test generation instructions",
    category: "vscode",
    severity: "recommended",
  },
  {
    path: ".vscode/code-review.instructions.md",
    label: "Code review instructions",
    category: "vscode",
    severity: "recommended",
  },
  {
    path: ".vscode/commit-message.instructions.md",
    label: "Commit message instructions",
    category: "vscode",
    severity: "recommended",
  },
  {
    path: ".vscode/pr-description.instructions.md",
    label: "PR description instructions",
    category: "vscode",
    severity: "optional",
  },
  {
    path: ".github/ai-harness/harness-manifest.yaml",
    label: "AI harness manifest",
    category: "governance",
    severity: "required",
  },
  {
    path: ".github/ai-harness/managed-file-inventory.json",
    label: "Managed file inventory",
    category: "governance",
    severity: "recommended",
  },
  {
    path: ".github/ai-harness/reconcile-policy.json",
    label: "Reconcile policy",
    category: "governance",
    severity: "recommended",
  },
  {
    path: ".github/ai-harness/native-executor-overrides.json",
    label: "Native executor overrides",
    category: "governance",
    severity: "optional",
  },
  {
    path: ".github/ai-harness/operating-model.md",
    label: "AI harness operating model",
    category: "governance",
    severity: "required",
  },
  {
    path: ".github/ai-harness/context-strategy.md",
    label: "AI harness context strategy",
    category: "governance",
    severity: "recommended",
  },
  {
    path: ".github/ai-harness/evaluation-rubrics.md",
    label: "AI harness evaluation rubrics",
    category: "governance",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/README.md",
    label: "AI harness docs",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/ai-harness/adoption-paths.md",
    label: "DX/AX adoption playbook",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/readiness/README.md",
    label: "Readiness guide",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/readiness/remaining-work-spec.md",
    label: "Remaining work specification",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/readiness/scoring-model.md",
    label: "Readiness scoring model",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/readiness/maturity-scorecard.template.json",
    label: "Readiness scorecard template",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/work-logs/README.md",
    label: "Work logs",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/troubleshooting/README.md",
    label: "Troubleshooting docs",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/changelog/README.md",
    label: "Changelog docs",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/adr/README.md",
    label: "Architecture decision records",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/context/README.md",
    label: "Context ledger docs",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/context/context-index.md",
    label: "Durable context fact index",
    category: "docs",
    severity: "required",
  },
  {
    path: ".github/ai-harness/governance-trust.json",
    label: "Governance approval trust anchors",
    category: "governance",
    severity: "required",
  },
  {
    path: ".github/ai-harness/architecture-ontology.policy.json",
    label: "Architecture ontology policy",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/README.md",
    label: "Semantic governance ontology guide",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/policy-authoring.md",
    label: "Architecture policy authoring guide",
    category: "governance",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/ontology/prompt-templates/semantic-context-pack.md",
    label: "Semantic context pack prompt template",
    category: "governance",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/ontology/policy-packs/README.md",
    label: "Architecture policy pack GitOps guide",
    category: "governance",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/ontology/architecture-profiles.catalog.json",
    label: "Architecture profiles catalog",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/schemas/architecture-ontology.schema.json",
    label: "Architecture ontology schema",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/schemas/source-graph.schema.json",
    label: "Source graph schema",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/schemas/governance-evaluation.schema.json",
    label: "Semantic governance evaluation schema",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/schemas/bypass-ledger.schema.json",
    label: "Architecture waiver ledger schema",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/schemas/waiver-revocations.schema.json",
    label: "Architecture waiver revocation ledger schema",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/schemas/semantic-warehouse.schema.json",
    label: "Semantic warehouse schema",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/schemas/waiver-validation.schema.json",
    label: "Waiver validation schema",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/schemas/enforcement-report.schema.json",
    label: "Semantic enforcement report schema",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/schemas/policy-pack.schema.json",
    label: "Architecture policy pack schema",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/state/source-graph.json",
    label: "Semantic source graph state",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/state/governance-evaluation.json",
    label: "Semantic governance evaluation state",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/state/semantic-warehouse.json",
    label: "Semantic warehouse state",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/state/waiver-validation.json",
    label: "Waiver validation state",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/state/enforcement-report.json",
    label: "Semantic enforcement report state",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/state/enforcement-report.md",
    label: "Semantic enforcement report Markdown",
    category: "governance",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/ontology/state/bypass-ledger.json",
    label: "Architecture waiver ledger",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/state/waiver-revocations.json",
    label: "Architecture waiver revocation ledger",
    category: "governance",
    severity: "required",
  },
  {
    path: "docs/ai-harness/ontology/state/context-pack.example.json",
    label: "Semantic context pack example",
    category: "governance",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/ontology/policy-packs/import-review.example.json",
    label: "Policy pack import review example",
    category: "governance",
    severity: "recommended",
  },
  {
    path: "docs/reviews/README.md",
    label: "Review ledger docs",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/handovers/README.md",
    label: "Handover docs",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/plans/README.md",
    label: "Execution plan docs",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/contracts/README.md",
    label: "Chunk contract docs",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/evaluations/README.md",
    label: "Independent evaluation docs",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/README.md",
    label: "Runtime orchestrator guide",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/version-index.json",
    label: "Runtime version capability index",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/compatibility-matrix.json",
    label: "Runtime compatibility matrix",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/adapter-contract.json",
    label: "Runtime adapter contract",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/session-continuity.md",
    label: "Runtime session continuity contract",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/state/session-index.json",
    label: "Runtime session index",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/state/active-session.json",
    label: "Active runtime session snapshot",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/state/current-work-packet.json",
    label: "Current runtime work packet snapshot",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/state/current-execution-bridge.json",
    label: "Current execution bridge snapshot",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/state/current-native-execution.json",
    label: "Current native execution snapshot",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/work-packets/README.md",
    label: "Runtime work packet guide",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/inbox/README.md",
    label: "Runtime inbox guide",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/adapters/README.md",
    label: "Runtime adapters guide",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/adapter-handoffs/README.md",
    label: "Runtime adapter handoff guide",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/bridges/README.md",
    label: "Runtime execution bridges guide",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/execution-bridges/README.md",
    label: "Execution bridge bundles guide",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/native-executors/README.md",
    label: "Native executor integrations guide",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/archive/README.md",
    label: "Runtime archive guide",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/runtime/archive/archive-index.json",
    label: "Runtime archive index",
    category: "docs",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/dashboard/index.html",
    label: "Harness Dashboard single-file HTML",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/events/harness-events.jsonl",
    label: "Harness event ledger JSONL",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/events/ledger-manifest.json",
    label: "Harness ledger manifest",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/entities/project-world-model.json",
    label: "Project World Model entity snapshot",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/entities/reality-model.json",
    label: "Reality model entity snapshot",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/entities/goal-compass.json",
    label: "Goal compass entity snapshot",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/entities/context-rot-monitor.json",
    label: "Context rot monitor entity snapshot",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/evaluations/harness-evaluation.json",
    label: "Harness evaluation score artifact",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/state/dashboard-state.json",
    label: "Dashboard state projection",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/state/dashboard-index.json",
    label: "Agent-readable dashboard index",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/state/dashboard-runtime.json",
    label: "Read-only listener runtime state",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/state/embedding-documents.json",
    label: "Embedding document projection",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/state/dashboard-state.schema.json",
    label: "Dashboard state schema JSON",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/schemas/events/harness-event.schema.json",
    label: "Harness event envelope schema",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/schemas/entities/project-world-model.schema.json",
    label: "Project World Model schema",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/schemas/projections/dashboard-state.schema.json",
    label: "Projection schema registry entry",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/design-framework.html",
    label: "Dashboard frontend design framework",
    category: "dashboard",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/dashboard/state/design-profile.json",
    label: "Dashboard frontend design profile",
    category: "dashboard",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/dashboard/backend-app-blueprint.html",
    label: "Optional backend dashboard blueprint",
    category: "dashboard",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs",
    label: "Dashboard operations script",
    category: "dashboard",
    severity: "recommended",
  },
  {
    path: "docs/ai-harness/dashboard/scripts/README.md",
    label: "Dashboard operations guide",
    category: "dashboard",
    severity: "recommended",
  },
  {
    path: ".governance/_INDEX.md",
    label: "Governance index",
    category: "governance",
    severity: "required",
  },
  {
    path: ".governance/_PROJECT_STATE.md",
    label: "Governance project state",
    category: "governance",
    severity: "required",
  },
];

const RUNTIME_STATE_PATHS = new Set([
  "docs/ai-harness/runtime/state/session-index.json",
  "docs/ai-harness/runtime/state/active-session.json",
  "docs/ai-harness/runtime/state/current-work-packet.json",
  "docs/ai-harness/runtime/state/current-execution-bridge.json",
  "docs/ai-harness/runtime/state/current-native-execution.json",
]);

const SEMANTIC_JSON_PATHS = new Set([
  ".github/ai-harness/governance-trust.json",
  ".github/ai-harness/architecture-ontology.policy.json",
  "docs/ai-harness/ontology/architecture-profiles.catalog.json",
  "docs/ai-harness/ontology/schemas/architecture-ontology.schema.json",
  "docs/ai-harness/ontology/schemas/source-graph.schema.json",
  "docs/ai-harness/ontology/schemas/governance-evaluation.schema.json",
  "docs/ai-harness/ontology/schemas/bypass-ledger.schema.json",
  "docs/ai-harness/ontology/schemas/waiver-revocations.schema.json",
  "docs/ai-harness/ontology/schemas/semantic-warehouse.schema.json",
  "docs/ai-harness/ontology/schemas/waiver-validation.schema.json",
  "docs/ai-harness/ontology/schemas/enforcement-report.schema.json",
  "docs/ai-harness/ontology/schemas/policy-pack.schema.json",
  "docs/ai-harness/ontology/state/source-graph.json",
  "docs/ai-harness/ontology/state/governance-evaluation.json",
  "docs/ai-harness/ontology/state/semantic-warehouse.json",
  "docs/ai-harness/ontology/state/waiver-validation.json",
  "docs/ai-harness/ontology/state/enforcement-report.json",
  "docs/ai-harness/ontology/state/bypass-ledger.json",
  "docs/ai-harness/ontology/state/waiver-revocations.json",
  "docs/ai-harness/ontology/state/context-pack.example.json",
  "docs/ai-harness/ontology/policy-packs/import-review.example.json",
]);

const SEMANTIC_STATE_PROJECTION_PATHS = new Set([
  "docs/ai-harness/ontology/state/source-graph.json",
  "docs/ai-harness/ontology/state/governance-evaluation.json",
  "docs/ai-harness/ontology/state/semantic-warehouse.json",
  "docs/ai-harness/ontology/state/waiver-validation.json",
  "docs/ai-harness/ontology/state/enforcement-report.json",
]);

function formatJsonError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `Invalid JSON: ${error.message}`;
  }

  return "Invalid JSON: parse failed";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function semanticProjectionReadiness(
  relativePath: string,
  parsed: Record<string, unknown>
): string | null {
  if (!SEMANTIC_STATE_PROJECTION_PATHS.has(relativePath)) {
    return null;
  }

  if (parsed.generatedAt === "bootstrap" || parsed.snapshotHash === "bootstrap") {
    return "Bootstrap-only semantic projection; run semantic governance tools before treating it as current evidence";
  }

  if (relativePath === "docs/ai-harness/ontology/state/source-graph.json") {
    const scan = isPlainRecord(parsed.scan) ? parsed.scan : {};
    const sourceFileCount =
      typeof scan.sourceFileCount === "number"
        ? scan.sourceFileCount
        : arrayLength(parsed.files);
    if (!Array.isArray(parsed.files) || !Array.isArray(parsed.edges) || sourceFileCount < 1) {
      return "Source graph has no scanned source files; run scan_source_graph";
    }
    return null;
  }

  if (relativePath === "docs/ai-harness/ontology/state/governance-evaluation.json") {
    const sourceGraphRef = typeof parsed.sourceGraphRef === "string" ? parsed.sourceGraphRef : "";
    const findings = arrayLength(parsed.violations) + arrayLength(parsed.warnings);
    if (!sourceGraphRef || !Array.isArray(parsed.violations) || !Array.isArray(parsed.warnings)) {
      return "Governance evaluation is missing source graph evidence arrays";
    }
    if (findings === 0 && !parsed.evaluationHash && !parsed.sourceGraphHash) {
      return "Governance evaluation has no findings or source graph hash; run validate_architecture_governance";
    }
    return null;
  }

  if (relativePath === "docs/ai-harness/ontology/state/semantic-warehouse.json") {
    const summaries = Array.isArray(parsed.viewSummaries) ? parsed.viewSummaries : [];
    const totalRows = summaries.reduce((sum, item) => {
      if (!isPlainRecord(item)) {
        return sum;
      }
      return sum + (typeof item.rowCount === "number" ? item.rowCount : 0);
    }, 0);
    if (!isPlainRecord(parsed.views) || totalRows < 1) {
      return "Semantic warehouse has no fact rows; run query_semantic_warehouse";
    }
    return null;
  }

  if (relativePath === "docs/ai-harness/ontology/state/waiver-validation.json") {
    if (!Array.isArray(parsed.findings) || !isPlainRecord(parsed.metrics)) {
      return "Waiver validation is missing findings or metrics; run validate_architecture_waivers";
    }
    return null;
  }

  if (relativePath === "docs/ai-harness/ontology/state/enforcement-report.json") {
    if (parsed.gate === "disabled" || parsed.optInOnly !== true) {
      return "Enforcement report is still disabled bootstrap state; run enforce_architecture_governance";
    }
    return null;
  }

  return null;
}

function inspectExpectedFile(
  workspacePath: string,
  expected: Omit<ValidationItem, "status">
): ValidationItem {
  const fullPath = path.join(workspacePath, expected.path);
  if (!fs.existsSync(fullPath)) {
    return {
      ...expected,
      status: "missing",
    };
  }

  if (expected.path === "docs/ai-harness/dashboard/state/dashboard-state.json") {
    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      const validation = validateDashboardStateShape(parsed);

      return {
        ...expected,
        status: validation.valid ? "present" : "outdated",
        details: validation.valid
          ? undefined
          : "Dashboard state shape validation failed",
      };
    } catch (error) {
      return {
        ...expected,
        status: "outdated",
        details: formatJsonError(error),
      };
    }
  }

  if (RUNTIME_STATE_PATHS.has(expected.path)) {
    try {
      JSON.parse(fs.readFileSync(fullPath, "utf-8")) as unknown;
    } catch (error) {
      return {
        ...expected,
        status: "outdated",
        details: formatJsonError(error),
      };
    }

    const validation = validateHarnessRuntimeFiles(workspacePath);
    return {
      ...expected,
      status: validation.valid ? "present" : "outdated",
      details: validation.valid
        ? undefined
        : "Runtime state contract validation failed",
    };
  }

  if (SEMANTIC_JSON_PATHS.has(expected.path)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as Record<
        string,
        unknown
      >;
      const hasSchema =
        typeof parsed.schemaVersion === "string" ||
        typeof parsed.$schema === "string";
      const projectionReadinessIssue = hasSchema
        ? semanticProjectionReadiness(expected.path, parsed)
        : null;
      return {
        ...expected,
        status: hasSchema && projectionReadinessIssue == null ? "present" : "outdated",
        details: hasSchema
          ? projectionReadinessIssue ?? undefined
          : "Missing schemaVersion or $schema",
      };
    } catch (error) {
      return {
        ...expected,
        status: "outdated",
        details: formatJsonError(error),
      };
    }
  }

  if (
    expected.path === "docs/ai-harness/runtime/version-index.json" ||
    expected.path === "docs/ai-harness/runtime/compatibility-matrix.json" ||
    expected.path === "docs/ai-harness/runtime/adapter-contract.json"
  ) {
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as Record<
        string,
        unknown
      >;
      const hasSchema = typeof parsed.schemaVersion === "string";
      return {
        ...expected,
        status: hasSchema ? "present" : "outdated",
        details: hasSchema ? undefined : "Missing schemaVersion",
      };
    } catch (error) {
      return {
        ...expected,
        status: "outdated",
        details: formatJsonError(error),
      };
    }
  }

  return {
    ...expected,
    status: "present",
  };
}

function detectGitPresence(workspacePath: string): boolean {
  return fs.existsSync(path.join(workspacePath, ".git"));
}

export function validateWorkspace(workspacePath: string): ValidationResult {
  const items = EXPECTED_FILES.map((expected) =>
    inspectExpectedFile(workspacePath, expected)
  );

  const requiredItems = items.filter((item) => item.severity === "required");
  const healthyRequired = requiredItems.filter(
    (item) => item.status === "present"
  );
  const healthyItems = items.filter((item) => item.status === "present");
  const allHealthy = items.filter((item) => item.status !== "missing");

  const isInitialized = healthyRequired.length === requiredItems.length;
  const completeness = Math.round((healthyItems.length / items.length) * 100);
  const missing = items.filter((item) => item.status === "missing");
  const outdated = items.filter((item) => item.status === "outdated");
  const suggestions: string[] = [];

  if (missing.some((item) => item.severity === "required")) {
    suggestions.push(
      "Required workspace artifacts are missing. Run `initialize_workspace` to repair the baseline setup."
    );
  }

  if (outdated.some((item) => item.category === "dashboard")) {
    suggestions.push(
      "The dashboard state exists but is not valid against the strict dashboard shape. Refresh it with the generated dashboard operations script."
    );
  }

  if (
    outdated.some(
      (item) =>
        item.path === "docs/ai-harness/runtime/state/session-index.json" ||
        item.path === "docs/ai-harness/runtime/state/active-session.json" ||
        item.path === "docs/ai-harness/runtime/state/current-work-packet.json" ||
        item.path === "docs/ai-harness/runtime/state/current-execution-bridge.json" ||
        item.path === "docs/ai-harness/runtime/state/current-native-execution.json"
    )
  ) {
    suggestions.push(
      "Runtime orchestration state is present but invalid. Reconcile docs/ai-harness/runtime/state/*.json before continuing governed execution."
    );
  }

  if (outdated.some((item) => SEMANTIC_STATE_PROJECTION_PATHS.has(item.path))) {
    suggestions.push(
      "Semantic governance projection files are bootstrap scaffolds or stale. Run `scan_source_graph`, `validate_architecture_governance`, `query_semantic_warehouse`, and the waiver/enforcement checks before treating architecture evidence as complete."
    );
  }

  const missingRecommended = missing.filter(
    (item) => item.severity === "recommended"
  );
  if (missingRecommended.length > 0) {
    suggestions.push(
      `Recommended artifacts missing: ${missingRecommended
        .map((item) => item.label)
        .join(", ")}`
    );
  }

  if (!detectGitPresence(workspacePath)) {
    suggestions.push(
      "No .git directory was detected. For DX/AX traceability, connect this workspace to Git or another version-control system."
    );
  }

  const docsDir = path.join(workspacePath, "docs");
  if (fs.existsSync(docsDir)) {
    try {
      const docSubDirs = fs
        .readdirSync(docsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

      if (docSubDirs.length > 4) {
        suggestions.push(
          `Extended documentation sections detected (${docSubDirs.length} directories). Review them to ensure the harness remains the source of truth.`
        );
      }
    } catch {
      // ignore directory inspection failures
    }
  }

  if (isInitialized && completeness === 100) {
    suggestions.push(
      "The workspace baseline is complete, including the recommended harness and dashboard artifacts."
    );
  } else if (
    allHealthy.some((item) => item.path === ".github/ai-harness/harness-manifest.yaml")
  ) {
    suggestions.push(
      "The workspace already has a harness baseline. Use this to adopt DX/AX governance even on a legacy project by filling the dashboard, review ledger, and handover files incrementally."
    );
  }

  const summary = [
    `[${isInitialized ? "ok" : "needs-attention"}] Workspace validation result: ${workspacePath}`,
    "",
    `Completeness: ${completeness}% (${healthyItems.length}/${items.length})`,
    `Required items: ${healthyRequired.length}/${requiredItems.length}`,
    `Outdated items: ${outdated.length}`,
    "",
    ...items.map((item) => {
      const marker =
        item.status === "present"
          ? "[ok]"
          : item.status === "outdated"
            ? "[outdated]"
            : "[missing]";

      const details = item.details ? ` (${item.details})` : "";
      return `  ${marker} [${item.severity}] ${item.label} -> ${item.path}${details}`;
    }),
    ...(suggestions.length > 0
      ? ["", "Suggestions:", ...suggestions.map((suggestion) => `  - ${suggestion}`)]
      : []),
  ].join("\n");

  return {
    workspacePath,
    isInitialized,
    completeness,
    items,
    summary,
    suggestions,
  };
}
