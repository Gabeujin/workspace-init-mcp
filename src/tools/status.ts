/**
 * Tool: get_workspace_status
 *
 * Analyzes an existing workspace directory and reports:
 * - Detected project type, tech stack, structure
 * - Current initialization status
 * - Recommended configuration for initialize_workspace
 *
 * This helps LLMs auto-fill form fields by analyzing the project.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type ProjectType, PROJECT_TYPE_CONFIGS } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceAnalysis {
  /** Detected project characteristics */
  detected: {
    projectType: ProjectType | null;
    techStack: string[];
    hasGit: boolean;
    hasPackageJson: boolean;
    hasPyproject: boolean;
    hasDockerfile: boolean;
    hasMonorepoMarkers: boolean;
    existingDocs: string[];
    fileCount: number;
    topLevelDirs: string[];
  };
  /** Suggested configuration for initialize_workspace */
  suggestedConfig: {
    projectType: ProjectType;
    techStack: string[];
    isMultiRepo: boolean;
  };
  /** Human-readable analysis */
  summary: string;
}

// ---------------------------------------------------------------------------
// Tech stack detection rules
// ---------------------------------------------------------------------------

interface DetectionRule {
  tech: string;
  files: string[];
  dirs?: string[];
  packageJsonDeps?: string[];
}

const DETECTION_RULES: DetectionRule[] = [
  {
    tech: "TypeScript",
    files: ["tsconfig.json", "tsconfig.base.json"],
    packageJsonDeps: ["typescript"],
  },
  {
    tech: "React",
    files: [],
    packageJsonDeps: ["react", "react-dom", "next"],
    dirs: [],
  },
  {
    tech: "Vue.js",
    files: ["vue.config.js", "nuxt.config.ts", "nuxt.config.js"],
    packageJsonDeps: ["vue", "nuxt"],
  },
  {
    tech: "Angular",
    files: ["angular.json"],
    packageJsonDeps: ["@angular/core"],
  },
  {
    tech: "Node.js",
    files: ["package.json"],
    packageJsonDeps: ["express", "fastify", "koa", "hapi", "nestjs"],
  },
  {
    tech: "Python",
    files: [
      "pyproject.toml",
      "setup.py",
      "requirements.txt",
      "Pipfile",
      "poetry.lock",
    ],
  },
  {
    tech: "Java",
    files: ["pom.xml", "build.gradle", "build.gradle.kts"],
  },
  {
    tech: "Go",
    files: ["go.mod", "go.sum"],
  },
  {
    tech: "Rust",
    files: ["Cargo.toml"],
  },
  {
    tech: "Docker",
    files: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"],
  },
  {
    tech: "Kubernetes",
    dirs: ["k8s", "kubernetes", "helm"],
    files: [],
  },
  {
    tech: "Terraform",
    files: ["main.tf", "terraform.tfvars"],
    dirs: ["terraform"],
  },
  {
    tech: "Jupyter",
    files: [],
    dirs: ["notebooks"],
  },
];

const MONOREPO_MARKERS = [
  "lerna.json",
  "nx.json",
  "pnpm-workspace.yaml",
  "rush.json",
  "turbo.json",
];

// ---------------------------------------------------------------------------
// Analysis logic
// ---------------------------------------------------------------------------

export function analyzeWorkspace(workspacePath: string): WorkspaceAnalysis {
  const topLevelEntries = safeReaddir(workspacePath);
  const topLevelDirs = topLevelEntries
    .filter((e) => e.isDirectory)
    .map((e) => e.name);
  const topLevelFiles = topLevelEntries
    .filter((e) => !e.isDirectory)
    .map((e) => e.name);

  // Tech stack detection
  const detectedTech = new Set<string>();
  let packageJsonDeps: string[] = [];

  // Read package.json deps if available
  const pkgJsonPath = path.join(workspacePath, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      packageJsonDeps = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ];
    } catch {
      // ignore parse errors
    }
  }

  for (const rule of DETECTION_RULES) {
    const hasFile = rule.files.some((f) => topLevelFiles.includes(f));
    const hasDir = rule.dirs?.some((d) => topLevelDirs.includes(d)) ?? false;
    const hasDep = rule.packageJsonDeps?.some((dep) =>
      packageJsonDeps.some((d) => d.includes(dep))
    ) ?? false;

    if (hasFile || hasDir || hasDep) {
      detectedTech.add(rule.tech);
    }
  }

  // Jupyter detection via .ipynb files
  const hasNotebooks = topLevelFiles.some((f) => f.endsWith(".ipynb")) ||
    topLevelDirs.includes("notebooks");
  if (hasNotebooks) detectedTech.add("Jupyter");

  // Monorepo detection
  const hasMonorepoMarkers = MONOREPO_MARKERS.some((f) =>
    topLevelFiles.includes(f)
  );
  const hasWorkspacePackages = topLevelDirs.includes("packages") ||
    topLevelDirs.includes("apps");

  // Existing docs
  const existingDocs: string[] = [];
  const docsDir = path.join(workspacePath, "docs");
  if (fs.existsSync(docsDir)) {
    try {
      const docEntries = fs.readdirSync(docsDir, { withFileTypes: true });
      for (const entry of docEntries) {
        existingDocs.push(entry.isDirectory() ? `docs/${entry.name}/` : `docs/${entry.name}`);
      }
    } catch {
      // ignore
    }
  }

  // Git
  const hasGit = fs.existsSync(path.join(workspacePath, ".git"));

  // File count (top-level only, for fast analysis)
  const fileCount = topLevelFiles.length;

  // Infer project type
  const projectType = inferProjectType(
    detectedTech,
    topLevelDirs,
    hasMonorepoMarkers || hasWorkspacePackages
  );

  const techStack = Array.from(detectedTech);
  const isMultiRepo = hasMonorepoMarkers || hasWorkspacePackages;

  const summary = buildAnalysisSummary({
    workspacePath,
    projectType,
    techStack,
    hasGit,
    isMultiRepo,
    existingDocs,
    fileCount,
    topLevelDirs,
  });

  return {
    detected: {
      projectType,
      techStack,
      hasGit,
      hasPackageJson: topLevelFiles.includes("package.json"),
      hasPyproject: topLevelFiles.includes("pyproject.toml"),
      hasDockerfile: topLevelFiles.includes("Dockerfile"),
      hasMonorepoMarkers: hasMonorepoMarkers || hasWorkspacePackages,
      existingDocs,
      fileCount,
      topLevelDirs,
    },
    suggestedConfig: {
      projectType: projectType ?? "other",
      techStack,
      isMultiRepo,
    },
    summary,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferProjectType(
  tech: Set<string>,
  dirs: string[],
  isMonorepo: boolean
): ProjectType | null {
  if (isMonorepo) return "monorepo";
  if (tech.has("Jupyter") || tech.has("Python") && dirs.includes("notebooks"))
    return "data-science";
  if (
    tech.has("Terraform") ||
    tech.has("Kubernetes") ||
    tech.has("Docker") && dirs.includes("infra")
  )
    return "devops";
  if (tech.has("React") || tech.has("Vue.js") || tech.has("Angular"))
    return "web-app";
  if (
    tech.has("Node.js") &&
    !tech.has("React") &&
    !tech.has("Vue.js") &&
    !tech.has("Angular")
  )
    return "api";
  return null;
}

function safeReaddir(
  dirPath: string
): { name: string; isDirectory: boolean }[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .map((d) => ({ name: d.name, isDirectory: d.isDirectory() }));
  } catch {
    return [];
  }
}

function buildAnalysisSummary(opts: {
  workspacePath: string;
  projectType: ProjectType | null;
  techStack: string[];
  hasGit: boolean;
  isMultiRepo: boolean;
  existingDocs: string[];
  fileCount: number;
  topLevelDirs: string[];
}): string {
  const typeLabel = opts.projectType
    ? PROJECT_TYPE_CONFIGS[opts.projectType].label
    : "감지 불가";

  return `🔍 워크스페이스 분석 결과: ${opts.workspacePath}

📂 구조:
  - 최상위 파일: ${opts.fileCount}개
  - 최상위 디렉토리: ${opts.topLevelDirs.join(", ") || "없음"}
  - Git: ${opts.hasGit ? "✅ 초기화됨" : "❌ 미초기화"}

🔧 감지된 기술 스택: ${opts.techStack.length > 0 ? opts.techStack.join(", ") : "감지 불가"}

📋 추론된 프로젝트 유형: ${typeLabel}${opts.projectType ? ` (${opts.projectType})` : ""}

${opts.isMultiRepo ? "📦 멀티 레포지토리 구조 감지됨" : "📦 단일 프로젝트 구조"}

📄 기존 문서: ${opts.existingDocs.length > 0 ? "\n" + opts.existingDocs.map((d) => `  - ${d}`).join("\n") : "없음"}

💡 추천 설정:
  projectType: "${opts.projectType ?? "other"}"
  techStack: [${opts.techStack.map((t) => `"${t}"`).join(", ")}]
  isMultiRepo: ${opts.isMultiRepo}`;
}
