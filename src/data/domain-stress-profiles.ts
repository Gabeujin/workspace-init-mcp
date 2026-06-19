import { type ProjectType } from "../types.js";

export interface DomainStressDefinition {
  id: string;
  label: string;
  programKey: string;
  defaultOwner: string;
  activationProjectTypes?: ProjectType[];
  activationDomains: string[];
  activationRules: string[][];
  appliesWhen: string[];
  actors: string[];
  criticalSurfaces: string[];
  mandatoryEvidence: string[];
  reportSections: string[];
  operatingQuestion: string;
  parallelSafety: string;
}

export function normalizeDomainKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toDomainStressProfileId(value: string): string {
  return normalizeDomainKey(value) || "custom-domain-stress";
}

function titleCase(value: string): string {
  return (
    value
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Custom Domain"
  );
}

export const DOMAIN_STRESS_DEFINITIONS: DomainStressDefinition[] = [
  {
    id: "identity-commerce-operations",
    label: "Identity Commerce Operations",
    programKey: "commerceOperations",
    defaultOwner: "domain-commerce-orchestrator",
    activationDomains: [
      "commerce",
      "payments",
      "identity",
      "device-auth",
      "credential-flow",
      "order-management",
      "benefits",
      "entitlements",
      "privacy",
    ],
    activationRules: [
      ["commerce"],
      ["order-management"],
      ["identity-commerce"],
      ["device-auth", "benefits"],
      ["credential-flow", "entitlements"],
      ["resource-binding", "payments"],
    ],
    appliesWhen: [
      "identity, device-mediated access, ordering, payment, benefits, and audit surfaces are in scope",
      "web and mobile or device-assisted work must proceed together",
      "commerce-critical state, account credentials, provider callbacks, and benefit ledgers must remain traceable",
    ],
    actors: [
      "anonymous user",
      "registered account",
      "operator",
      "administrator",
      "payment provider",
      "support agent",
      "AI agent operator",
    ],
    criticalSurfaces: [
      "account identity and credential lifecycle",
      "device permission and credential verification",
      "resource or session binding",
      "catalog, cart, order, or request flow",
      "third-party payment handoff and callback",
      "amount handoff, settlement, refund, and reversal",
      "benefit or entitlement ledger",
      "promotion, benefit, expiry, stacking, and reversal rules",
      "operator/admin audit view",
      "PII, consent, redaction, and retention",
    ],
    mandatoryEvidence: [
      "credential issuance, revocation, replay prevention, and expiry tests",
      "device permission denial and fallback tests",
      "wrong-resource binding, stale binding, spoofing, and reassignment tests",
      "order state transition contract and staff audit history",
      "payment callback idempotency and provider outage recovery proof",
      "amount handoff and settlement reconciliation proof",
      "benefit accrual, redemption, and reversal ledger proof",
      "promotion stacking, expiry, cancellation, abuse, and reversal tests",
      "user PII, consent, export/delete, redaction, and retention policy",
    ],
    reportSections: [
      "Credential/Auth",
      "Device/Binding",
      "Orders",
      "Payments",
      "Benefits",
      "Operator Audit",
      "Privacy/PII",
      "Readiness Blockers",
    ],
    operatingQuestion:
      "Can users and operators complete identity, ordering, payment, benefit, and audit flows without untracked value, state, or PII risk?",
    parallelSafety:
      "Path-disjoint web, app, payment, benefit, and order chunks are still semantically coupled. Require a merge owner, schema owner, and end-to-end scenario owner before parallel implementation.",
  },
  {
    id: "legacy-modernization-governance",
    label: "Legacy Modernization Governance",
    programKey: "modernizationGovernance",
    defaultOwner: "legacy-modernization-orchestrator",
    activationDomains: [
      "legacy",
      "legacy-modernization",
      "modernization",
      "migration",
      "collaboration",
      "organization",
      "governance",
      "monetization",
    ],
    activationRules: [
      ["legacy"],
      ["legacy-modernization"],
      ["modernization"],
      ["migration"],
      ["collaboration", "governance"],
      ["organization", "monetization"],
    ],
    appliesWhen: [
      "an existing CRUD or workflow system exists before workspace-init",
      "workspace-init is applied as a non-destructive harness overlay",
      "the target product grows into identity, collaborative records, role governance, organizations, and monetization",
    ],
    actors: [
      "legacy user",
      "registered user",
      "domain moderator",
      "workflow owner",
      "participant",
      "group steward",
      "organization admin",
      "sponsor/customer",
    ],
    criticalSurfaces: [
      "legacy entities, routes, screens, users, and permissions",
      "modern identity and profiles",
      "collaborative workflow creation, participation, and records",
      "group roles, rules, proposals, voting, and approvals",
      "moderation and safety workflows",
      "organization transition model",
      "plans, entitlements, billing, sponsorship, settlement, and tax assumptions",
      "legacy data migration and rollback",
    ],
    mandatoryEvidence: [
      "AS-IS entity, route, screen, auth, deployment, and data inventory",
      "TO-BE capability map for records, collaboration, groups, governance, organizations, and monetization",
      "keep/replace/archive/migrate classification for every legacy route and table",
      "migration waves, dry-run rehearsal, rollback, and legacy URL compatibility proof",
      "legacy CRUD preservation smoke tests after harness adoption",
      "collaborative workflow lifecycle tests from creation to retained record and moderation",
      "governance lifecycle tests for proposal, vote, quorum, approval, role change, and audit",
      "monetization evidence for plans, entitlements, payments, refunds, sponsorship, settlement, and tax assumptions",
      "moderation and abuse handling tests with role-based audit trail",
    ],
    reportSections: [
      "Legacy Preservation",
      "AS-IS/TO-BE",
      "Migration Waves",
      "Collaboration Records",
      "Governance",
      "Monetization",
      "Moderation/Safety",
      "Cutover Blockers",
    ],
    operatingQuestion:
      "Can the existing system keep working while the product evolves into a governed, monetizable platform with reversible migrations?",
    parallelSafety:
      "Do not split legacy data model, identity, group roles, payments, and governance votes into independent chunks without a named integration owner and migration contract.",
  },
  {
    id: "content-release-governance",
    label: "Content Release Governance",
    programKey: "contentRelease",
    defaultOwner: "content-governance-owner",
    activationProjectTypes: ["creative"],
    activationDomains: [
      "content",
      "editorial",
      "content-release",
      "campaign",
      "media-assets",
      "visual-assets",
      "content-operations",
    ],
    activationRules: [
      ["content"],
      ["editorial"],
      ["content-release"],
      ["content-operations"],
      ["campaign", "visual-assets"],
      ["media-assets", "release-governance"],
    ],
    appliesWhen: [
      "long-form or multi-channel content is the main deliverable",
      "derivative content is produced while the primary content evolves",
      "visual or media assets need provenance and accessibility governance",
    ],
    actors: [
      "content owner",
      "editorial lead",
      "reviewer",
      "source/provenance librarian",
      "channel operator",
      "visual designer",
      "audience persona",
    ],
    criticalSurfaces: [
      "content promise and audience transformation",
      "concept dictionary and approved language",
      "argument map and counterargument coverage",
      "content unit outline, draft stage, editorial debt, and cut list",
      "channel derivative map",
      "visual asset queue",
      "asset prompt ledger and style guide",
      "release calendar and feedback loop",
      "promotion content promoted back into canonical content",
    ],
    mandatoryEvidence: [
      "message map, concept boundary, and contradiction ledger",
      "unit-to-message coverage and counterargument coverage map",
      "content progress, draft stage, editorial debt, and cut-list burn-up",
      "voice QA and audience empathy review",
      "derivative content map from canonical source to channel asset and feedback loop",
      "compression risk review and source concept links",
      "asset prompt, style, rights/provenance, alt text, and layout safe-zone ledger",
      "release calendar, audience feedback routing, and canonical impact policy",
      "content finish report with next production session brief",
    ],
    reportSections: [
      "Content Stage",
      "Unit Heatmap",
      "Message Consistency",
      "Unresolved Tensions",
      "Channel Pipeline",
      "Derivative Pipeline",
      "Visual Governance",
      "Release Readiness",
    ],
    operatingQuestion:
      "Can content operators finish one coherent canonical deliverable while derivative assets stay consistent, accessible, and provenance-safe?",
    parallelSafety:
      "Channel, derivative, visual, and canonical-content workers may run in parallel only when a canon editor owns consistency and all derivatives declare whether they change, promote, or merely market the canonical content.",
  },
];

export function getDomainStressDefinition(
  profileId: string
): DomainStressDefinition | undefined {
  const normalized = toDomainStressProfileId(profileId);
  return DOMAIN_STRESS_DEFINITIONS.find((profile) => profile.id === normalized);
}

export function listDomainStressProfileOptions(): Array<{
  value: string;
  label: string;
  description: string;
}> {
  return DOMAIN_STRESS_DEFINITIONS.map((profile) => ({
    value: profile.id,
    label: profile.label,
    description: profile.operatingQuestion,
  }));
}

export function matchesDomainStressDefinition(
  definition: DomainStressDefinition,
  options: {
    projectType?: ProjectType;
    primaryDomains?: string[];
  }
): boolean {
  const normalizedDomains = new Set(
    (options.primaryDomains ?? []).map((domain) => normalizeDomainKey(domain))
  );
  const projectTypeMatch =
    definition.activationProjectTypes?.includes(options.projectType ?? "other") ??
    false;
  const domainRuleMatch = definition.activationRules.some((rule) =>
    rule.every((domain) => normalizedDomains.has(normalizeDomainKey(domain)))
  );
  return projectTypeMatch || domainRuleMatch;
}

export function buildCustomDomainStressDefinition(
  profileId: string,
  options: {
    projectType?: ProjectType;
    primaryDomains?: string[];
    additionalContext?: string;
    legacyAdoptionProfile?: string;
  }
): DomainStressDefinition {
  const id = toDomainStressProfileId(profileId);
  const domainInputs = options.primaryDomains?.length
    ? options.primaryDomains
    : [options.projectType ?? "workspace"];
  const activationDomains = domainInputs.map((domain) => normalizeDomainKey(domain));
  const contextHint = options.additionalContext?.trim()
    ? "The operator supplied additional context; convert it into actors, critical surfaces, risks, and evidence links before implementation."
    : "The operator has not supplied enough domain detail yet; collect actors, critical surfaces, risks, and evidence links before implementation.";
  const legacyHint = options.legacyAdoptionProfile?.trim()
    ? "Existing-project assumptions must be protected by AS-IS/TO-BE and rollback evidence."
    : "Existing-project assumptions are unknown; treat destructive changes as blocked until the workspace proves ownership and rollback.";

  return {
    id,
    label: `${titleCase(id)} Stress Profile`,
    programKey: "customDomainOperations",
    defaultOwner: "domain-evidence-owner",
    activationDomains,
    activationRules: activationDomains.map((domain) => [domain]),
    appliesWhen: [
      "the workspace has domain-specific assumptions not covered by a built-in profile",
      "the team needs model-agnostic evidence gates that survive handoff across AI agents",
      contextHint,
    ],
    actors: [
      "primary user",
      "domain operator",
      "decision owner",
      "reviewer or evaluator",
      "AI agent operator",
    ],
    criticalSurfaces: [
      "domain goal and scope boundary",
      "actor permissions and responsibilities",
      "data, knowledge, or state transitions",
      "external integrations, source material, or dependencies",
      "failure, rollback, or correction paths",
      "progress, readiness, and evaluation evidence",
      "privacy, safety, compliance, or consent constraints where applicable",
    ],
    mandatoryEvidence: [
      "domain glossary and boundary map",
      "actor journey or workflow map with ownership",
      "state, data, or knowledge contract with invariants",
      "integration, dependency, or source-material contract or explicit not-applicable decision",
      "failure-mode and rollback or correction checklist",
      "negative review findings with remediation receipts",
      "progress and readiness evidence linked to dashboard claims",
      "handover note proving the next agent can resume without chat history",
      legacyHint,
    ],
    reportSections: [
      "Domain Boundary",
      "Actors And Ownership",
      "State And Evidence",
      "Workflow Progress",
      "Failure Modes",
      "Review Findings",
      "Readiness Blockers",
    ],
    operatingQuestion:
      "Can the workspace make trustworthy progress in this domain while every claim, dependency, review finding, and handoff stays evidence-backed?",
    parallelSafety:
      "Path-disjoint chunks are still coupled when they share domain invariants, state, source material, review gates, or readiness claims. Name a merge owner and evaluator before parallel work.",
  };
}
