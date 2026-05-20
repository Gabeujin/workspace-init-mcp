import * as fs from "node:fs";
import * as path from "node:path";

import { validateWorkspace } from "./validate.js";

type ReadinessStatus = "ready" | "advancing" | "partial" | "fragile";

interface ReadinessDimensionDefinition {
  id: string;
  label: string;
  weight: number;
  paths: string[];
}

export interface WorkspaceReadinessAssessment {
  workspacePath: string;
  overallScore: number;
  structuralScore: number;
  semanticScore: number;
  semanticCapApplied: boolean;
  classification: ReadinessStatus;
  dimensions: Array<{
    id: string;
    label: string;
    weight: number;
    score: number;
    status: ReadinessStatus;
    evidenceFound: number;
    evidenceExpected: number;
    missingPaths: string[];
  }>;
  topGaps: string[];
  suggestions: string[];
  scorecardPath?: string;
  summary: string;
}

export interface WorkspaceReadinessSemanticAudit {
  workspacePath: string;
  overallScore: number;
  classification: ReadinessStatus;
  checks: Array<{
    id: string;
    label: string;
    weight: number;
    score: number;
    status: ReadinessStatus;
    findings: string[];
  }>;
  findings: string[];
  reportPath?: string;
  summary: string;
}

const READINESS_DIMENSIONS: ReadinessDimensionDefinition[] = [
  {
    id: "baseline-initialization",
    label: "Baseline Initialization",
    weight: 15,
    paths: [
      "AGENTS.md",
      ".github/copilot-instructions.md",
      ".github/ai-harness/harness-manifest.yaml",
      ".github/ai-harness/operating-model.md",
      "docs/ai-harness/README.md",
      "docs/ai-harness/readiness/remaining-work-spec.md",
    ],
  },
  {
    id: "governance-documentation",
    label: "Governance And Documentation",
    weight: 20,
    paths: [
      "docs/plans/README.md",
      "docs/reviews/README.md",
      "docs/contracts/README.md",
      "docs/evaluations/README.md",
      "docs/handovers/README.md",
      ".github/ai-harness/evaluation-rubrics.md",
    ],
  },
  {
    id: "runtime-orchestration",
    label: "Runtime Orchestration",
    weight: 20,
    paths: [
      "docs/ai-harness/runtime/state/session-index.json",
      "docs/ai-harness/runtime/state/active-session.json",
      "docs/ai-harness/runtime/state/current-work-packet.json",
      "docs/ai-harness/runtime/state/current-execution-bridge.json",
      "docs/ai-harness/runtime/work-packets/README.md",
      "docs/ai-harness/runtime/inbox/README.md",
    ],
  },
  {
    id: "dashboard-visibility",
    label: "Dashboard And Stakeholder Visibility",
    weight: 15,
    paths: [
      "docs/ai-harness/dashboard/index.html",
      "docs/ai-harness/dashboard/state/dashboard-state.json",
      "docs/ai-harness/dashboard/state/dashboard-state.schema.json",
      "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs",
    ],
  },
  {
    id: "external-runtime-portability",
    label: "External Runtime Portability",
    weight: 10,
    paths: [
      "docs/ai-harness/runtime/adapters/README.md",
      "docs/ai-harness/runtime/adapter-handoffs/README.md",
      "docs/ai-harness/runtime/bridges/README.md",
      "docs/ai-harness/runtime/execution-bridges/README.md",
    ],
  },
  {
    id: "quality-traceability",
    label: "Quality And Traceability",
    weight: 10,
    paths: [
      ".vscode/test-generation.instructions.md",
      ".vscode/code-review.instructions.md",
      "docs/work-logs/README.md",
      "docs/changelog/README.md",
      "docs/context/README.md",
    ],
  },
  {
    id: "domain-tailoring",
    label: "Domain Tailoring",
    weight: 10,
    paths: [
      ".github/AGENT-SKILLS.md",
      ".github/AGENT-SKILLS-BY-ROLE.md",
      ".github/AGENT-SKILLS-BY-DOMAIN.md",
      "docs/ai-harness/readiness/maturity-scorecard.template.json",
      "docs/ai-harness/dashboard/state/dashboard-state.json",
    ],
  },
];

const PLACEHOLDER_PATTERNS = [
  /\bTBD\b/gim,
  /\bbootstrap\b/gim,
  /\bplaceholder\b/gim,
  /\bnot-assessed\b/gim,
  /\bunknown\b/gim,
  /\btodo\b/gim,
  /Replace template/gi,
  /Start the first governed runtime session/gi,
  /Use the MCP/gi,
];

function readTextIfExists(fullPath: string): string | null {
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return fs.readFileSync(fullPath, "utf-8");
}

function readJsonIfExists(fullPath: string): unknown | null {
  const text = readTextIfExists(fullPath);
  if (text == null) {
    return null;
  }

  return JSON.parse(text) as unknown;
}

function countPlaceholderHits(text: string): number {
  return PLACEHOLDER_PATTERNS.reduce((total, pattern) => {
    const matches = text.match(pattern);
    return total + (matches?.length ?? 0);
  }, 0);
}

function collectFilesRecursively(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const results: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      results.push(fullPath);
    }
  }

  return results;
}

function countMeaningfulFiles(
  workspacePath: string,
  relativePath: string,
  options?: {
    ignoreNames?: string[];
    ignorePatterns?: RegExp[];
  }
): number {
  const fullPath = path.join(workspacePath, relativePath);
  const files = collectFilesRecursively(fullPath);
  const ignoreNames = new Set(options?.ignoreNames ?? ["README.md", ".gitkeep"]);
  const ignorePatterns = options?.ignorePatterns ?? [/\.template\./i];

  return files.filter((filePath) => {
    const baseName = path.basename(filePath);
    if (ignoreNames.has(baseName)) {
      return false;
    }

    return !ignorePatterns.some((pattern) => pattern.test(baseName));
  }).length;
}

function scoreFromFraction(found: number, expected: number): number {
  if (expected <= 0) {
    return 100;
  }

  return Math.max(0, Math.min(100, Math.round((found / expected) * 100)));
}

function placeholderBurdenScore(fileScores: Array<{ path: string; hits: number }>) {
  const totalHits = fileScores.reduce((total, item) => total + item.hits, 0);
  const score = Math.max(0, 100 - totalHits * 5);
  const findings = fileScores
    .filter((item) => item.hits > 0)
    .sort((left, right) => right.hits - left.hits)
    .slice(0, 4)
    .map((item) => `${item.path}: ${item.hits} placeholder-like markers`);

  if (findings.length === 0) {
    findings.push("No major placeholder markers were detected in the sampled operating files.");
  }

  return { score, findings };
}

function classifyScore(score: number): ReadinessStatus {
  if (score >= 85) {
    return "ready";
  }
  if (score >= 70) {
    return "advancing";
  }
  if (score >= 50) {
    return "partial";
  }
  return "fragile";
}

function workspaceHasPath(workspacePath: string, relativePath: string): boolean {
  return fs.existsSync(path.join(workspacePath, relativePath));
}

function applySemanticReadinessCap(
  structuralScore: number,
  semanticScore: number
): {
  overallScore: number;
  semanticCapApplied: boolean;
} {
  if (semanticScore >= 85) {
    return { overallScore: structuralScore, semanticCapApplied: false };
  }

  const cappedScore = Math.min(structuralScore, Math.min(84, semanticScore + 20));
  return {
    overallScore: cappedScore,
    semanticCapApplied: cappedScore < structuralScore,
  };
}

export function assessWorkspaceReadiness(
  workspacePath: string,
  writeScorecard = false
): WorkspaceReadinessAssessment {
  if (!fs.existsSync(workspacePath)) {
    throw new Error(`Workspace path does not exist: ${workspacePath}`);
  }

  const validation = validateWorkspace(workspacePath);

  const dimensions = READINESS_DIMENSIONS.map((dimension) => {
    const missingPaths = dimension.paths.filter(
      (relativePath) => !workspaceHasPath(workspacePath, relativePath)
    );
    const evidenceExpected = dimension.paths.length;
    const evidenceFound = evidenceExpected - missingPaths.length;
    const score = Math.round((evidenceFound / evidenceExpected) * 100);

    return {
      id: dimension.id,
      label: dimension.label,
      weight: dimension.weight,
      score,
      status: classifyScore(score),
      evidenceFound,
      evidenceExpected,
      missingPaths,
    };
  });

  const structuralScore = Math.round(
    dimensions.reduce(
      (total, dimension) => total + dimension.score * (dimension.weight / 100),
      0
    )
  );
  const semanticAudit = auditWorkspaceReadinessSemantics(workspacePath, false);
  const { overallScore, semanticCapApplied } = applySemanticReadinessCap(
    structuralScore,
    semanticAudit.overallScore
  );
  const classification = classifyScore(overallScore);

  const topGaps = dimensions
    .filter((dimension) => dimension.missingPaths.length > 0)
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map(
      (dimension) =>
        `${dimension.label}: ${dimension.missingPaths
          .slice(0, 3)
          .join(", ")}`
    );

  let scorecardPath: string | undefined;
  if (writeScorecard) {
    scorecardPath = path.join(
      workspacePath,
      "docs",
      "ai-harness",
      "readiness",
      "maturity-scorecard.json"
    );
    fs.mkdirSync(path.dirname(scorecardPath), { recursive: true });
    fs.writeFileSync(
      scorecardPath,
      `${JSON.stringify(
        {
          schemaVersion: "1.0.0",
          generatedAt: new Date().toISOString(),
          assessmentStatus: "assessed",
          overallScore,
          structuralScore,
          semanticScore: semanticAudit.overallScore,
          semanticCapApplied,
          classification,
          dimensions,
          topGaps,
          suggestions: validation.suggestions,
        },
        null,
        2
      )}\n`,
      "utf-8"
    );
  }

  const summary = [
    `Workspace readiness assessment: ${path.basename(workspacePath)}`,
    `Initialization completeness: ${validation.completeness}%`,
    `Overall score: ${overallScore}/100 (${classification})`,
    `Structural score: ${structuralScore}/100`,
    `Semantic score: ${semanticAudit.overallScore}/100`,
    `Semantic cap applied: ${semanticCapApplied ? "yes" : "no"}`,
    "",
    "Dimensions:",
    ...dimensions.map(
      (dimension) =>
        `  - ${dimension.label}: ${dimension.score}/100 (${dimension.status})`
    ),
    "",
    "Top gaps:",
    ...(topGaps.length > 0 ? topGaps.map((gap) => `  - ${gap}`) : ["  - none"]),
    ...(scorecardPath != null
      ? ["", `Scorecard written: ${path.relative(workspacePath, scorecardPath).replace(/\\/g, "/")}`]
      : []),
  ].join("\n");

  return {
    workspacePath,
    overallScore,
    structuralScore,
    semanticScore: semanticAudit.overallScore,
    semanticCapApplied,
    classification,
    dimensions,
    topGaps,
    suggestions: validation.suggestions,
    scorecardPath:
      scorecardPath == null
        ? undefined
        : path.relative(workspacePath, scorecardPath).replace(/\\/g, "/"),
    summary,
  };
}

export function auditWorkspaceReadinessSemantics(
  workspacePath: string,
  writeReport = false
): WorkspaceReadinessSemanticAudit {
  if (!fs.existsSync(workspacePath)) {
    throw new Error(`Workspace path does not exist: ${workspacePath}`);
  }

  const dashboardStatePath = path.join(
    workspacePath,
    "docs",
    "ai-harness",
    "dashboard",
    "state",
    "dashboard-state.json"
  );
  const runtimeIndexPath = path.join(
    workspacePath,
    "docs",
    "ai-harness",
    "runtime",
    "state",
    "session-index.json"
  );
  const readinessScorecardPath = path.join(
    workspacePath,
    "docs",
    "ai-harness",
    "readiness",
    "maturity-scorecard.json"
  );
  const operatingModelPath = path.join(
    workspacePath,
    ".github",
    "ai-harness",
    "operating-model.md"
  );
  const activeSessionPath = path.join(
    workspacePath,
    "docs",
    "ai-harness",
    "runtime",
    "state",
    "active-session.json"
  );
  const currentWorkPacketPath = path.join(
    workspacePath,
    "docs",
    "ai-harness",
    "runtime",
    "state",
    "current-work-packet.json"
  );

  const dashboardState = (readJsonIfExists(dashboardStatePath) ?? {}) as Record<
    string,
    unknown
  >;
  const runtimeIndex = (readJsonIfExists(runtimeIndexPath) ?? {}) as Record<
    string,
    unknown
  >;
  const readinessScorecard = (readJsonIfExists(readinessScorecardPath) ?? {}) as Record<
    string,
    unknown
  >;
  const dashboardText = readTextIfExists(dashboardStatePath) ?? "";
  const operatingModelText = readTextIfExists(operatingModelPath) ?? "";
  const activeSessionText = readTextIfExists(activeSessionPath) ?? "";
  const currentWorkPacketText = readTextIfExists(currentWorkPacketPath) ?? "";
  const scorecardText = readTextIfExists(readinessScorecardPath) ?? "";

  const governanceDirs = [
    "docs/plans",
    "docs/reviews",
    "docs/contracts",
    "docs/evaluations",
    "docs/handovers",
    "docs/work-logs",
  ];
  const governanceEvidence = governanceDirs.map((relativePath) => ({
    relativePath,
    count: countMeaningfulFiles(workspacePath, relativePath),
  }));
  const governanceFound = governanceEvidence.filter((item) => item.count > 0).length;
  const governanceFindings = governanceEvidence
    .filter((item) => item.count === 0)
    .map((item) => `${item.relativePath} does not yet contain project-specific evidence.`);

  const executiveSummary =
    typeof dashboardState.executiveSummary === "object" &&
    dashboardState.executiveSummary !== null
      ? (dashboardState.executiveSummary as Record<string, unknown>)
      : {};
  const progressState =
    typeof dashboardState.progressState === "object" &&
    dashboardState.progressState !== null
      ? (dashboardState.progressState as Record<string, unknown>)
      : {};
  const gitStatus =
    typeof dashboardState.gitStatus === "object" && dashboardState.gitStatus !== null
      ? (dashboardState.gitStatus as Record<string, unknown>)
      : {};
  const governedSessions = Array.isArray(dashboardState.governedSessions)
    ? (dashboardState.governedSessions as Array<Record<string, unknown>>)
    : [];
  const kpis = Array.isArray(dashboardState.kpis)
    ? (dashboardState.kpis as Array<Record<string, unknown>>)
    : [];
  const workstreams = Array.isArray(progressState.workstreams)
    ? (progressState.workstreams as Array<Record<string, unknown>>)
    : [];
  const versionLedger = Array.isArray(dashboardState.versionLedger)
    ? (dashboardState.versionLedger as Array<Record<string, unknown>>)
    : [];
  const timeline = Array.isArray(dashboardState.timeline)
    ? (dashboardState.timeline as Array<Record<string, unknown>>)
    : [];
  const entities = Array.isArray(dashboardState.entities)
    ? (dashboardState.entities as Array<Record<string, unknown>>)
    : [];

  const dashboardCriteria = [
    typeof executiveSummary.lastUpdated === "string" &&
      !/bootstrap|TBD/i.test(String(executiveSummary.lastUpdated)),
    typeof executiveSummary.currentStage === "string" &&
      !["governance-open", "awaiting-session-start"].includes(
        String(executiveSummary.currentStage)
      ),
    governedSessions.some(
      (session) =>
        !["session-0001", "session-auto-refresh"].includes(String(session.id || ""))
    ),
    kpis.filter(
      (kpi) => !/^(TBD|unknown)$/i.test(String(kpi.value ?? "")) && String(kpi.value ?? "").trim() !== ""
    ).length >= Math.max(1, Math.round(kpis.length * 0.6)),
    String(gitStatus.currentBranch ?? "").trim() !== "TBD" &&
      !/unknown/i.test(String(gitStatus.trackedByGit ?? "")),
  ];
  const dashboardFindings: string[] = [];
  if (!dashboardCriteria[0]) {
    dashboardFindings.push("Dashboard lastUpdated still looks like bootstrap or placeholder data.");
  }
  if (!dashboardCriteria[1]) {
    dashboardFindings.push("Dashboard currentStage still looks close to the initial template state.");
  }
  if (!dashboardCriteria[2]) {
    dashboardFindings.push("No real governed session beyond bootstrap/auto-refresh is visible yet.");
  }
  if (!dashboardCriteria[3]) {
    dashboardFindings.push("Too many KPI values still look placeholder-like for stakeholder use.");
  }
  if (!dashboardCriteria[4]) {
    dashboardFindings.push("Git visibility in the dashboard still looks incomplete or placeholder-like.");
  }

  const placeholderBurden = placeholderBurdenScore([
    {
      path: "docs/ai-harness/dashboard/state/dashboard-state.json",
      hits: countPlaceholderHits(dashboardText),
    },
    {
      path: ".github/ai-harness/operating-model.md",
      hits: countPlaceholderHits(operatingModelText),
    },
    {
      path: "docs/ai-harness/runtime/state/active-session.json",
      hits: countPlaceholderHits(activeSessionText),
    },
    {
      path: "docs/ai-harness/runtime/state/current-work-packet.json",
      hits: countPlaceholderHits(currentWorkPacketText),
    },
    {
      path: "docs/ai-harness/readiness/maturity-scorecard.json",
      hits: countPlaceholderHits(scorecardText),
    },
  ]);

  const registeredSessions = Array.isArray(runtimeIndex.sessions)
    ? runtimeIndex.sessions.length
    : 0;
  const queuedSessions = Array.isArray(runtimeIndex.queuedSessionIds)
    ? runtimeIndex.queuedSessionIds.length
    : 0;
  const workPacketCount = countMeaningfulFiles(
    workspacePath,
    "docs/ai-harness/runtime/work-packets",
    {
      ignorePatterns: [/README\.md/i],
    }
  );
  const handoffCount = countMeaningfulFiles(
    workspacePath,
    "docs/ai-harness/runtime/adapter-handoffs"
  );
  const bridgeCount = countMeaningfulFiles(
    workspacePath,
    "docs/ai-harness/runtime/execution-bridges"
  );
  const runtimeCriteria = [
    registeredSessions > 0,
    workPacketCount >= Math.max(1, registeredSessions),
    handoffCount > 0,
    bridgeCount > 0,
    queuedSessions >= 0,
  ];
  const runtimeFindings: string[] = [];
  if (!runtimeCriteria[0]) {
    runtimeFindings.push("No governed runtime sessions have been registered yet.");
  }
  if (!runtimeCriteria[1]) {
    runtimeFindings.push("Work packets are missing for some governed runtime sessions.");
  }
  if (!runtimeCriteria[2]) {
    runtimeFindings.push("No adapter handoff bundle has been produced for external continuation yet.");
  }
  if (!runtimeCriteria[3]) {
    runtimeFindings.push("No execution bridge bundle has been produced yet.");
  }

  const activeWorkstreams = workstreams.filter(
    (item) => Number(item.progressPercent ?? 0) > 0
  ).length;
  const evolvingVersions = versionLedger.filter((entry) => {
    const scope = String(entry.scope ?? "");
    return Number(entry.progressPercent ?? 0) > 0 && !/bootstrap/i.test(scope);
  }).length;
  const domainEntities = entities.filter(
    (entry) => !/draft/i.test(String(entry.status ?? ""))
  ).length;
  const liveTimeline = timeline.filter(
    (entry) => !/not-started/i.test(String(entry.status ?? ""))
  ).length;
  const domainEvidenceFound = [
    activeWorkstreams > 0,
    evolvingVersions > 0,
    domainEntities > 0,
    liveTimeline > 0,
  ].filter(Boolean).length;
  const domainFindings: string[] = [];
  if (activeWorkstreams === 0) {
    domainFindings.push("Workstreams still look close to the template baseline.");
  }
  if (evolvingVersions === 0) {
    domainFindings.push("Version or feature-wave tracking has not clearly moved beyond bootstrap scope.");
  }
  if (domainEntities === 0 && liveTimeline === 0) {
    domainFindings.push("Domain entities or timeline records do not yet show meaningful live state.");
  }

  const traceabilityCriteria = [
    fs.existsSync(path.join(workspacePath, ".git")),
    countMeaningfulFiles(workspacePath, "docs/changelog") > 0,
    countMeaningfulFiles(workspacePath, "docs/work-logs") > 0,
    String(gitStatus.trackedByGit ?? "").toLowerCase() === "yes",
  ];
  const traceabilityFindings: string[] = [];
  if (!traceabilityCriteria[0]) {
    traceabilityFindings.push("No .git directory was found, so historical traceability is still weak.");
  }
  if (!traceabilityCriteria[1]) {
    traceabilityFindings.push("The changelog does not yet contain project-specific entries beyond the scaffold.");
  }
  if (!traceabilityCriteria[2]) {
    traceabilityFindings.push("The work log does not yet contain project-specific execution evidence.");
  }
  if (!traceabilityCriteria[3]) {
    traceabilityFindings.push("Dashboard git visibility is not yet confidently synchronized with a tracked repository.");
  }

  const checks = [
    {
      id: "governance-evidence-freshness",
      label: "Governance Evidence Freshness",
      weight: 25,
      score: scoreFromFraction(governanceFound, governanceEvidence.length),
      findings:
        governanceFindings.length > 0
          ? governanceFindings
          : ["Governance ledgers contain project-specific evidence across the main sections."],
    },
    {
      id: "dashboard-truthfulness",
      label: "Dashboard Truthfulness",
      weight: 20,
      score: scoreFromFraction(
        dashboardCriteria.filter(Boolean).length,
        dashboardCriteria.length
      ),
      findings:
        dashboardFindings.length > 0
          ? dashboardFindings
          : ["Dashboard state looks meaningfully populated for operator and stakeholder use."],
    },
    {
      id: "placeholder-pressure",
      label: "Placeholder Pressure",
      weight: 15,
      score: placeholderBurden.score,
      findings: placeholderBurden.findings,
    },
    {
      id: "runtime-evidence-quality",
      label: "Runtime Evidence Quality",
      weight: 20,
      score: scoreFromFraction(
        runtimeCriteria.filter(Boolean).length,
        runtimeCriteria.length
      ),
      findings:
        runtimeFindings.length > 0
          ? runtimeFindings
          : ["Runtime handoffs, work packets, and execution bridge evidence are present."],
    },
    {
      id: "domain-state-richness",
      label: "Domain State Richness",
      weight: 10,
      score: scoreFromFraction(domainEvidenceFound, 4),
      findings:
        domainFindings.length > 0
          ? domainFindings
          : ["Domain-specific ledgers show live state beyond the initial template."],
    },
    {
      id: "traceability-discipline",
      label: "Traceability Discipline",
      weight: 10,
      score: scoreFromFraction(
        traceabilityCriteria.filter(Boolean).length,
        traceabilityCriteria.length
      ),
      findings:
        traceabilityFindings.length > 0
          ? traceabilityFindings
          : ["Version-control and documentary traceability look operational."],
    },
  ].map((check) => ({
    ...check,
    status: classifyScore(check.score),
  }));

  const overallScore = Math.round(
    checks.reduce(
      (total, check) => total + check.score * (check.weight / 100),
      0
    )
  );
  const classification = classifyScore(overallScore);
  const findings = checks
    .filter((check) => check.score < 100)
    .flatMap((check) => check.findings.slice(0, 2).map((item) => `${check.label}: ${item}`))
    .slice(0, 8);

  let reportPath: string | undefined;
  if (writeReport) {
    reportPath = path.join(
      workspacePath,
      "docs",
      "ai-harness",
      "readiness",
      "semantic-audit.json"
    );
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(
      reportPath,
      `${JSON.stringify(
        {
          schemaVersion: "1.0.0",
          generatedAt: new Date().toISOString(),
          overallScore,
          classification,
          checks,
          findings,
        },
        null,
        2
      )}\n`,
      "utf-8"
    );
  }

  const summary = [
    `Workspace readiness semantic audit: ${path.basename(workspacePath)}`,
    `Overall score: ${overallScore}/100 (${classification})`,
    "",
    "Checks:",
    ...checks.map(
      (check) => `  - ${check.label}: ${check.score}/100 (${check.status})`
    ),
    "",
    "Findings:",
    ...(findings.length > 0 ? findings.map((item) => `  - ${item}`) : ["  - none"]),
    ...(reportPath != null
      ? ["", `Report written: ${path.relative(workspacePath, reportPath).replace(/\\/g, "/")}`]
      : []),
  ].join("\n");

  return {
    workspacePath,
    overallScore,
    classification,
    checks,
    findings,
    reportPath:
      reportPath == null
        ? undefined
        : path.relative(workspacePath, reportPath).replace(/\\/g, "/"),
    summary,
  };
}
