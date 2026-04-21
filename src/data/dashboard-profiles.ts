import { type ProjectType } from "../types.js";

export type DashboardDomainMode =
  | "software-delivery"
  | "creative-narrative"
  | "knowledge-work"
  | "generic-governance";

export interface DashboardKpiDefinition {
  id: string;
  label: string;
  target: string;
  defaultValue: string;
  defaultStatus: "ok" | "warning" | "risk" | "info";
  defaultInterpretation: string;
  perspectives: string[];
  appliesToModes: DashboardDomainMode[];
  relevantProjectTypes?: ProjectType[];
}

export interface DashboardKpiProfile {
  id: string;
  label: string;
  requiredKpiIds: string[];
  perspectives: string[];
  rationale: string[];
}

export function inferDashboardDomainMode(
  projectType?: ProjectType
): DashboardDomainMode {
  switch (projectType) {
    case "creative":
      return "creative-narrative";
    case "learning":
      return "knowledge-work";
    case "other":
      return "generic-governance";
    default:
      return "software-delivery";
  }
}

export const DASHBOARD_KPI_DEFINITIONS: DashboardKpiDefinition[] = [
  {
    id: "governance-freshness",
    label: "Governance Freshness",
    target: "Refresh before and after every meaningful task",
    defaultValue: "bootstrap",
    defaultStatus: "warning",
    defaultInterpretation:
      "Template exists, but task-specific governance records still need real data.",
    perspectives: ["AX/DX", "Governance"],
    appliesToModes: [
      "software-delivery",
      "creative-narrative",
      "knowledge-work",
      "generic-governance",
    ],
  },
  {
    id: "planning-review-completion",
    label: "Planning / Review Completion",
    target: "6 / 6 complete before implementation",
    defaultValue: "1 / 6 gates active",
    defaultStatus: "warning",
    defaultInterpretation:
      "The workflow has started but is not ready for broad implementation yet.",
    perspectives: ["AX/DX", "Governance"],
    appliesToModes: [
      "software-delivery",
      "creative-narrative",
      "knowledge-work",
      "generic-governance",
    ],
  },
  {
    id: "contract-coverage",
    label: "Contract Coverage",
    target: "Every governed chunk has a written contract with done criteria and verification scope",
    defaultValue: "bootstrap",
    defaultStatus: "warning",
    defaultInterpretation:
      "Contract-driven chunk delivery is expected, but live contract evidence still needs to be populated.",
    perspectives: ["AX/DX", "Governance", "QA"],
    appliesToModes: [
      "software-delivery",
      "creative-narrative",
      "knowledge-work",
      "generic-governance",
    ],
  },
  {
    id: "session-resumability",
    label: "Session Resumability",
    target: "Every session leaves restart-ready evidence",
    defaultValue: "seeded",
    defaultStatus: "ok",
    defaultInterpretation:
      "The JSON structure is ready to hold resumable state, handovers, and artifact links.",
    perspectives: ["AX/DX", "Governance"],
    appliesToModes: [
      "software-delivery",
      "creative-narrative",
      "knowledge-work",
      "generic-governance",
    ],
  },
  {
    id: "session-governance-coverage",
    label: "Session Governance Coverage",
    target: "Every AI session opens and closes governance with dashboard visibility",
    defaultValue: "bootstrap",
    defaultStatus: "warning",
    defaultInterpretation:
      "Session governance records exist in template form but still need live operational data.",
    perspectives: ["AX/DX", "Governance"],
    appliesToModes: [
      "software-delivery",
      "creative-narrative",
      "knowledge-work",
      "generic-governance",
    ],
  },
  {
    id: "independent-evaluation-discipline",
    label: "Independent Evaluation Discipline",
    target: "Generator output is approved only through an independent evaluator, reviewer, or quality gate",
    defaultValue: "bootstrap",
    defaultStatus: "warning",
    defaultInterpretation:
      "Independent evaluation is part of the harness, but review and QA evidence still need to be recorded.",
    perspectives: ["AX/DX", "QA", "DevOps"],
    appliesToModes: [
      "software-delivery",
      "creative-narrative",
      "knowledge-work",
      "generic-governance",
    ],
  },
  {
    id: "evidence-traceability",
    label: "Evidence Traceability",
    target: "Plans, reviews, outputs, and handovers remain linked per session",
    defaultValue: "seeded",
    defaultStatus: "ok",
    defaultInterpretation:
      "The dashboard can point each governed session to explicit evidence and outputs.",
    perspectives: ["AX/DX", "Governance"],
    appliesToModes: [
      "software-delivery",
      "creative-narrative",
      "knowledge-work",
      "generic-governance",
    ],
  },
  {
    id: "git-history-visibility",
    label: "Git History Visibility",
    target: "Dashboard, governance, and change history all tracked in version control",
    defaultValue: "assessment-required",
    defaultStatus: "warning",
    defaultInterpretation:
      "Confirm repository status and update the git snapshot after bootstrap.",
    perspectives: ["AX/DX", "DevOps"],
    appliesToModes: [
      "software-delivery",
      "creative-narrative",
      "knowledge-work",
      "generic-governance",
    ],
  },
  {
    id: "ax-dx-adoption",
    label: "DX / AX Operating Readiness",
    target: "Operators can trace goals, progress, KPIs, issues, and decisions without chat history",
    defaultValue: "foundation-present",
    defaultStatus: "ok",
    defaultInterpretation:
      "The workspace now has a dashboard-ready operating surface; teams must keep it current.",
    perspectives: ["AX/DX"],
    appliesToModes: [
      "software-delivery",
      "creative-narrative",
      "knowledge-work",
      "generic-governance",
    ],
  },
  {
    id: "test-coverage-discipline",
    label: "Test Coverage Discipline",
    target: "Every programming change has matching coverage or a documented gap",
    defaultValue: "not-started",
    defaultStatus: "warning",
    defaultInterpretation:
      "No implementation chunk has been approved yet.",
    perspectives: ["DevOps", "Engineering"],
    appliesToModes: ["software-delivery"],
  },
  {
    id: "release-traceability",
    label: "Release Traceability",
    target: "Every version or feature wave maps to evidence, sessions, and verification",
    defaultValue: "seeded",
    defaultStatus: "warning",
    defaultInterpretation:
      "The release ledger exists, but version-level evidence still needs to be maintained.",
    perspectives: ["DevOps", "Product"],
    appliesToModes: ["software-delivery"],
  },
  {
    id: "service-operability-readiness",
    label: "Service Operability Readiness",
    target: "Runbooks, observability, and release safety are visible before deployment",
    defaultValue: "bootstrap",
    defaultStatus: "warning",
    defaultInterpretation:
      "Delivery controls exist, but service-operability evidence still needs to be populated.",
    perspectives: ["DevOps"],
    appliesToModes: ["software-delivery"],
    relevantProjectTypes: ["api", "web-app", "saas", "devops", "monorepo", "iot"],
  },
  {
    id: "story-continuity-integrity",
    label: "Story Continuity Integrity",
    target: "Timeline, events, and narrative state stay coherent across sessions",
    defaultValue: "seeded",
    defaultStatus: "warning",
    defaultInterpretation:
      "Narrative structures exist, but continuity checks still need live project data.",
    perspectives: ["Creative", "AX/DX"],
    appliesToModes: ["creative-narrative"],
  },
  {
    id: "character-ledger-freshness",
    label: "Character / Entity Ledger Freshness",
    target: "Important characters and story entities remain current and traceable",
    defaultValue: "seeded",
    defaultStatus: "warning",
    defaultInterpretation:
      "Entity tracking exists, but it still needs to be updated as the story evolves.",
    perspectives: ["Creative"],
    appliesToModes: ["creative-narrative"],
  },
  {
    id: "evidence-quality",
    label: "Evidence Quality",
    target: "Claims, conclusions, and module progress remain source-backed",
    defaultValue: "seeded",
    defaultStatus: "warning",
    defaultInterpretation:
      "Research and learning structures exist, but evidence trails need active maintenance.",
    perspectives: ["Knowledge", "AX/DX"],
    appliesToModes: ["knowledge-work"],
  },
  {
    id: "learning-loop-completion",
    label: "Learning Loop Completion",
    target: "Modules move from question to evidence to conclusion with clear next steps",
    defaultValue: "bootstrap",
    defaultStatus: "warning",
    defaultInterpretation:
      "Learning loops are scaffolded, but iteration closure still needs real work-state updates.",
    perspectives: ["Knowledge"],
    appliesToModes: ["knowledge-work"],
  },
  {
    id: "initiative-traceability",
    label: "Initiative Traceability",
    target: "Every initiative and milestone maps to owners, sessions, and decisions",
    defaultValue: "seeded",
    defaultStatus: "warning",
    defaultInterpretation:
      "Milestone structures exist, but initiative-level evidence needs active maintenance.",
    perspectives: ["Operations", "AX/DX"],
    appliesToModes: ["generic-governance"],
  },
  {
    id: "stakeholder-visibility",
    label: "Stakeholder Visibility",
    target: "Non-developers can understand the current state without reading chat or code",
    defaultValue: "foundation-present",
    defaultStatus: "ok",
    defaultInterpretation:
      "The dashboard is designed for broad stakeholder readability and requires live updates to stay useful.",
    perspectives: ["AX/DX", "Operations"],
    appliesToModes: [
      "software-delivery",
      "creative-narrative",
      "knowledge-work",
      "generic-governance",
    ],
  },
];

function filterByProjectType(
  definition: DashboardKpiDefinition,
  projectType?: ProjectType
): boolean {
  return (
    definition.relevantProjectTypes == null ||
    (projectType != null && definition.relevantProjectTypes.includes(projectType))
  );
}

export function getRequiredDashboardKpis(options: {
  domainMode: DashboardDomainMode;
  projectType?: ProjectType;
}): DashboardKpiDefinition[] {
  return DASHBOARD_KPI_DEFINITIONS.filter(
    (definition) =>
      definition.appliesToModes.includes(options.domainMode) &&
      filterByProjectType(definition, options.projectType)
  );
}

export function listDashboardKpiDefinitions(): DashboardKpiDefinition[] {
  return DASHBOARD_KPI_DEFINITIONS;
}

export function getDashboardKpiProfile(options: {
  domainMode: DashboardDomainMode;
  projectType?: ProjectType;
}): DashboardKpiProfile {
  const definitions = getRequiredDashboardKpis(options);

  switch (options.domainMode) {
    case "creative-narrative":
      return {
        id: "creative-governed-kpis",
        label: "Creative Governance KPI Profile",
        requiredKpiIds: definitions.map((definition) => definition.id),
        perspectives: ["AX/DX", "Creative Operations"],
        rationale: [
          "Narrative continuity, character state, and editorial progress must remain visible across sessions.",
          "Stakeholders should be able to assess story momentum without reading manuscript diffs or chat transcripts.",
        ],
      };
    case "knowledge-work":
      return {
        id: "knowledge-governed-kpis",
        label: "Knowledge Work KPI Profile",
        requiredKpiIds: definitions.map((definition) => definition.id),
        perspectives: ["AX/DX", "Research Operations"],
        rationale: [
          "Learning and research work must keep evidence quality and iteration closure visible.",
          "A reviewer should be able to understand the current module state, sources, and next step immediately.",
        ],
      };
    case "generic-governance":
      return {
        id: "general-governed-kpis",
        label: "General Governance KPI Profile",
        requiredKpiIds: definitions.map((definition) => definition.id),
        perspectives: ["AX/DX", "Operations"],
        rationale: [
          "Transformation initiatives need milestone, owner, and decision traceability even outside software delivery.",
          "The dashboard should remain readable by broad stakeholder groups.",
        ],
      };
    default:
      return {
        id: "software-devops-governed-kpis",
        label: "Software Delivery / DevOps KPI Profile",
        requiredKpiIds: definitions.map((definition) => definition.id),
        perspectives: ["AX/DX", "DevOps", "Engineering"],
        rationale: [
          "Software delivery requires governance visibility plus DevOps-grade release and operability traceability.",
          "Every meaningful session should connect planning, implementation, testing, git history, and release evidence.",
        ],
      };
  }
}
