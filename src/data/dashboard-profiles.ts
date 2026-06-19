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
  relevantPrimaryDomains?: string[];
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
      return projectType == null ? "generic-governance" : "software-delivery";
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
    defaultStatus: "warning",
    defaultInterpretation:
      "The JSON structure can hold resumable state, but live handover evidence is still pending.",
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
    defaultStatus: "warning",
    defaultInterpretation:
      "The dashboard can point sessions to evidence after real governed work records are added.",
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
    target: "Stakeholders and AI Agents can trace the project world model, briefs, evidence, KPIs, issues, and decisions without chat history",
    defaultValue: "foundation-present",
    defaultStatus: "warning",
    defaultInterpretation:
      "The workspace has a dashboard-ready operating surface, but adoption is not proven until live sessions keep it current.",
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
    id: "commerce-payment-integrity",
    label: "Commerce / Payment Integrity",
    target: "Orders, payment attempts, provider callbacks, refunds, and reversals are idempotent and auditable",
    defaultValue: "contract-needed",
    defaultStatus: "risk",
    defaultInterpretation:
      "Commerce-critical state machines need explicit evidence before any payment or order claim is trusted.",
    perspectives: ["Product", "Payments", "QA"],
    appliesToModes: ["software-delivery"],
    relevantProjectTypes: ["ecommerce", "fintech"],
    relevantPrimaryDomains: ["commerce", "payments", "checkout", "settlement"],
  },
  {
    id: "account-benefit-ledger",
    label: "Account Benefit Ledger",
    target: "Account identity, credentials, benefits, entitlements, and reversals are traceable per subject",
    defaultValue: "ledger-not-proven",
    defaultStatus: "risk",
    defaultInterpretation:
      "Benefit and entitlement features need a ledger contract before product readiness can be claimed.",
    perspectives: ["Product", "Data", "Customer Ops"],
    appliesToModes: ["software-delivery"],
    relevantProjectTypes: ["ecommerce", "saas"],
    relevantPrimaryDomains: ["identity", "membership", "benefits", "entitlements", "rewards"],
  },
  {
    id: "device-flow-readiness",
    label: "Device Flow Readiness",
    target: "Device credentials, scanners, deep links, and permission flows have denial, spoof, and offline tests",
    defaultValue: "device-tests-missing",
    defaultStatus: "risk",
    defaultInterpretation:
      "Device-mediated flows can break or be spoofed unless the harness tracks permission, retry, and resource-binding evidence.",
    perspectives: ["Mobile", "Security", "QA"],
    appliesToModes: ["software-delivery"],
    relevantProjectTypes: ["mobile", "iot"],
    relevantPrimaryDomains: ["device-auth", "device-binding", "credential-flow", "scanner", "deep-link"],
  },
  {
    id: "collaboration-health",
    label: "Collaboration Health",
    target: "Activation, contribution, participation, record continuity, and moderation load are visible",
    defaultValue: "collaboration-map-needed",
    defaultStatus: "warning",
    defaultInterpretation:
      "Collaboration modernization needs product-health signals beyond CRUD completion.",
    perspectives: ["Collaboration", "Product", "Moderation"],
    appliesToModes: ["software-delivery"],
    relevantProjectTypes: ["saas"],
    relevantPrimaryDomains: ["collaboration", "social", "participation", "moderation", "records"],
  },
  {
    id: "organization-governance-readiness",
    label: "Organization Governance Readiness",
    target: "Groups, roles, proposals, votes, approvals, escalation, and organization transitions are modeled",
    defaultValue: "governance-model-needed",
    defaultStatus: "warning",
    defaultInterpretation:
      "A collaborative product that can become an organization needs governance primitives before monetization or scaling claims.",
    perspectives: ["Governance", "Product", "Operations"],
    appliesToModes: ["software-delivery", "generic-governance"],
    relevantProjectTypes: ["saas", "consulting"],
    relevantPrimaryDomains: ["collaboration", "organization", "governance", "org-transition"],
  },
  {
    id: "monetization-readiness",
    label: "Monetization Readiness",
    target: "Plans, entitlements, payments, sponsorship, settlement, and tax/accounting assumptions are explicit",
    defaultValue: "monetization-contract-needed",
    defaultStatus: "warning",
    defaultInterpretation:
      "Revenue features need product, legal, payment, and operations evidence before being treated as ready.",
    perspectives: ["Product", "Finance", "Operations"],
    appliesToModes: ["software-delivery"],
    relevantProjectTypes: ["saas", "ecommerce", "fintech"],
    relevantPrimaryDomains: ["monetization", "subscription", "marketplace", "entitlements"],
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
    id: "message-consistency",
    label: "Message Consistency",
    target: "Every primary and derivative content item supports or intentionally challenges the central message",
    defaultValue: "message-map-needed",
    defaultStatus: "warning",
    defaultInterpretation:
      "Creative work needs a message graph, counterargument map, and contradiction checks before completion claims.",
    perspectives: ["Creative", "Editorial", "Research"],
    appliesToModes: ["creative-narrative"],
    relevantProjectTypes: ["creative"],
    relevantPrimaryDomains: ["content", "editorial", "message-map", "canonical-content"],
  },
  {
    id: "content-pipeline-throughput",
    label: "Content Pipeline Throughput",
    target: "Canonical content, channel assets, derivative assets, release decisions, feedback, and reintegration are traceable",
    defaultValue: "pipeline-not-started",
    defaultStatus: "warning",
    defaultInterpretation:
      "Release momentum should be visible without letting derivative assets drift away from canonical content.",
    perspectives: ["Creative", "Release", "Marketing"],
    appliesToModes: ["creative-narrative"],
    relevantProjectTypes: ["creative"],
    relevantPrimaryDomains: ["content", "editorial", "channel-assets", "derivative-assets", "content-release"],
  },
  {
    id: "visual-asset-governance",
    label: "Visual Asset Governance",
    target: "Visual prompts, style rules, layout constraints, typography safe zones, alt text, and provenance are reviewed",
    defaultValue: "visual-ledger-needed",
    defaultStatus: "warning",
    defaultInterpretation:
      "Visual assets need style, rights, accessibility, and message-distortion checks.",
    perspectives: ["Creative", "Design", "Accessibility"],
    appliesToModes: ["creative-narrative"],
    relevantProjectTypes: ["creative"],
    relevantPrimaryDomains: ["visual-assets", "media-assets", "asset-governance", "accessibility"],
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
    defaultStatus: "warning",
    defaultInterpretation:
      "The dashboard is designed for broad stakeholder readability; live updates are required before this can be treated as proven.",
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
  projectType?: ProjectType,
  primaryDomains: string[] = []
): boolean {
  const normalizedDomains = new Set(
    primaryDomains.map((domain) => domain.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
  );
  if (
    definition.relevantPrimaryDomains != null &&
    definition.relevantPrimaryDomains.some((domain) =>
      normalizedDomains.has(domain.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    )
  ) {
    return true;
  }
  return (
    definition.relevantProjectTypes == null ||
    (projectType != null && definition.relevantProjectTypes.includes(projectType))
  );
}

export function getRequiredDashboardKpis(options: {
  domainMode: DashboardDomainMode;
  projectType?: ProjectType;
  primaryDomains?: string[];
}): DashboardKpiDefinition[] {
  return DASHBOARD_KPI_DEFINITIONS.filter(
    (definition) =>
      definition.appliesToModes.includes(options.domainMode) &&
      filterByProjectType(definition, options.projectType, options.primaryDomains)
  );
}

export function listDashboardKpiDefinitions(): DashboardKpiDefinition[] {
  return DASHBOARD_KPI_DEFINITIONS;
}

export function getDashboardKpiProfile(options: {
  domainMode: DashboardDomainMode;
  projectType?: ProjectType;
  primaryDomains?: string[];
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
          "Stakeholders should be able to assess story momentum without reading draft diffs or chat transcripts.",
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
