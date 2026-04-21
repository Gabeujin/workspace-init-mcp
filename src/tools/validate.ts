/**
 * Tool: validate_workspace
 *
 * Checks whether a workspace has been properly initialized
 * and reports on the completeness of its structure.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { validateDashboardStateShape } from "./dashboard-state.js";

export interface ValidationItem {
  path: string;
  label: string;
  status: "present" | "missing" | "outdated";
  category: "copilot" | "vscode" | "docs" | "governance" | "dashboard";
  severity: "required" | "recommended" | "optional";
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
    path: "docs/ai-harness/dashboard/index.html",
    label: "Admin dashboard screen",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/state/dashboard-state.json",
    label: "Dashboard state JSON",
    category: "dashboard",
    severity: "required",
  },
  {
    path: "docs/ai-harness/dashboard/state/dashboard-state.schema.json",
    label: "Dashboard schema JSON",
    category: "dashboard",
    severity: "required",
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
];

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
      };
    } catch {
      return {
        ...expected,
        status: "outdated",
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

      return `  ${marker} [${item.severity}] ${item.label} -> ${item.path}`;
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
