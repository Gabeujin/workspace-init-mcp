import {
  SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
  type ArchitectureProfileId,
  type SemanticGovernanceEvaluation,
  type SemanticVerdict,
  type SemanticViolation,
  type WaiverValidationFinding,
  type WaiverValidationResult,
} from "../data/ontology-contract.js";
import {
  validateSemanticGovernance,
  type ValidateSemanticGovernanceOptions,
} from "./semantic-governance.js";
import { validateArchitectureWaivers } from "./semantic-waivers.js";

export const SEMANTIC_ENFORCEMENT_MODES = ["report", "strict", "ci"] as const;

export type SemanticEnforcementMode =
  (typeof SEMANTIC_ENFORCEMENT_MODES)[number];

export type SemanticEnforcementGate = "pass" | "warn" | "fail" | "disabled";

export type SemanticEnforcementDecisionStatus =
  | "allowed"
  | "warn"
  | "blocked"
  | "waived";

export interface RunSemanticEnforcementOptions
  extends ValidateSemanticGovernanceOptions {
  enforcementMode?: SemanticEnforcementMode;
  now?: string;
  failOnWarnings?: boolean;
  requireWaiverValidation?: boolean;
}

export interface SemanticEnforcementDecision {
  id: string;
  status: SemanticEnforcementDecisionStatus;
  ruleId: string;
  severity: SemanticVerdict;
  edgeFingerprint: string;
  sourcePath: string;
  targetPath: string | null;
  reason: string;
  sourceRefs: string[];
  waiverId?: string;
}

export interface SemanticEnforcementReport {
  schemaVersion: string;
  generatedAt: string;
  enforcementMode: SemanticEnforcementMode;
  optInOnly: true;
  profileId: ArchitectureProfileId;
  gate: SemanticEnforcementGate;
  canProceed: boolean;
  summary: string;
  decisions: SemanticEnforcementDecision[];
  governance: SemanticGovernanceEvaluation;
  waiverValidation: WaiverValidationResult;
  metrics: {
    blockedViolations: number;
    waivedViolations: number;
    warningDecisions: number;
    waiverBlockFindings: number;
    waiverWarningFindings: number;
    policyWarnings: number;
    skippedByLimit: number;
    unsupportedFiles: number;
    strictUnknownForced: boolean;
    failOnWarnings: boolean;
  };
  markdown: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right));
}

function waiverKey(ruleId: string | null, edgeFingerprint: string | null): string {
  return `${ruleId ?? ""}|${edgeFingerprint ?? ""}`;
}

function buildValidWaiverMap(
  findings: WaiverValidationFinding[]
): Map<string, WaiverValidationFinding> {
  const validWaivers = new Map<string, WaiverValidationFinding>();
  for (const finding of findings) {
    if (
      finding.status === "valid" &&
      finding.waiverId != null &&
      finding.ruleId != null &&
      finding.edgeFingerprint != null
    ) {
      validWaivers.set(
        waiverKey(finding.ruleId, finding.edgeFingerprint),
        finding
      );
    }
  }
  return validWaivers;
}

function sourceRefsForFinding(finding: SemanticViolation): string[] {
  return uniqueSorted([
    ...finding.evidenceRefs,
    finding.sourcePath,
    finding.targetPath,
    ".github/ai-harness/architecture-ontology.policy.json",
    "docs/ai-harness/ontology/state/source-graph.json",
    "docs/ai-harness/ontology/state/governance-evaluation.json",
  ]);
}

function decisionForFinding(
  finding: SemanticViolation,
  mode: SemanticEnforcementMode,
  validWaivers: Map<string, WaiverValidationFinding>
): SemanticEnforcementDecision {
  const waiver = validWaivers.get(waiverKey(finding.ruleId, finding.fingerprint));
  if (waiver?.waiverId != null) {
    return {
      id: `enforcement:${finding.fingerprint}:waived`,
      status: "waived",
      ruleId: finding.ruleId,
      severity: finding.severity,
      edgeFingerprint: finding.fingerprint,
      sourcePath: finding.sourcePath,
      targetPath: finding.targetPath,
      waiverId: waiver.waiverId,
      reason: `Exact governance violation is waived by ledger entry ${waiver.waiverId}.`,
      sourceRefs: uniqueSorted([
        ...sourceRefsForFinding(finding),
        ...waiver.evidenceRefs,
      ]),
    };
  }

  const status: SemanticEnforcementDecisionStatus =
    finding.severity === "block"
      ? mode === "report"
        ? "warn"
        : "blocked"
      : "warn";
  return {
    id: `enforcement:${finding.fingerprint}:${status}`,
    status,
    ruleId: finding.ruleId,
    severity: finding.severity,
    edgeFingerprint: finding.fingerprint,
    sourcePath: finding.sourcePath,
    targetPath: finding.targetPath,
    reason:
      status === "blocked"
        ? finding.message
        : `Report-only advisory finding: ${finding.message}`,
    sourceRefs: sourceRefsForFinding(finding),
  };
}

function buildSummary(report: Omit<SemanticEnforcementReport, "summary" | "markdown">): string {
  return [
    `Semantic enforcement gate: ${report.gate}`,
    `Mode: ${report.enforcementMode}`,
    `Can proceed: ${report.canProceed ? "yes" : "no"}`,
    `Blocked violations: ${report.metrics.blockedViolations}`,
    `Waived violations: ${report.metrics.waivedViolations}`,
    `Warning decisions: ${report.metrics.warningDecisions}`,
    `Waiver block findings: ${report.metrics.waiverBlockFindings}`,
    `Policy warnings: ${report.metrics.policyWarnings}`,
    `Skipped by scan limit: ${report.metrics.skippedByLimit}`,
    `Unsupported source files: ${report.metrics.unsupportedFiles}`,
    "Report mode is advisory only; strict and ci modes are explicit opt-in enforcement gates.",
  ].join("\n");
}

function markdownList(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return `- ${emptyText}`;
  }
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildSemanticEnforcementMarkdown(
  report: Omit<SemanticEnforcementReport, "markdown">
): string {
  const blocked = report.decisions.filter((decision) => decision.status === "blocked");
  const waived = report.decisions.filter((decision) => decision.status === "waived");
  const warnings = report.decisions.filter((decision) => decision.status === "warn");
  const waiverBlocks = report.waiverValidation.findings.filter(
    (finding) => finding.severity === "block"
  );

  return [
    "# Semantic Enforcement Report",
    "",
    `- Gate: ${report.gate}`,
    `- Mode: ${report.enforcementMode}`,
    `- Can proceed: ${report.canProceed ? "yes" : "no"}`,
    `- Profile: ${report.profileId}`,
    `- Generated at: ${report.generatedAt}`,
    "- Opt-in: yes. Report mode is advisory; strict and ci modes are the blocking modes.",
    `- Strict unknown forced: ${report.metrics.strictUnknownForced ? "yes" : "no"}`,
    `- Policy warnings: ${report.metrics.policyWarnings}`,
    `- Skipped by scan limit: ${report.metrics.skippedByLimit}`,
    `- Unsupported source files: ${report.metrics.unsupportedFiles}`,
    "",
    "## Blocked Decisions",
    "",
    markdownList(
      blocked.map(
        (decision) =>
          `${decision.ruleId} ${decision.sourcePath} -> ${decision.targetPath ?? "unresolved"} (${decision.edgeFingerprint})`
      ),
      "No blocked decisions."
    ),
    "",
    "## Waived Decisions",
    "",
    markdownList(
      waived.map(
        (decision) =>
          `${decision.ruleId} via ${decision.waiverId ?? "unknown waiver"} (${decision.edgeFingerprint})`
      ),
      "No waived decisions."
    ),
    "",
    "## Warnings",
    "",
    markdownList(
      warnings.map(
        (decision) =>
          `${decision.ruleId} ${decision.sourcePath} -> ${decision.targetPath ?? "unresolved"} (${decision.edgeFingerprint})`
      ),
      "No warning decisions."
    ),
    "",
    "## Waiver Validation Blocks",
    "",
    markdownList(
      waiverBlocks.map(
        (finding) =>
          `${finding.status}: ${finding.message} (${finding.waiverId ?? "no waiver id"})`
      ),
      "No blocking waiver validation findings."
    ),
    "",
    "## Source Refs",
    "",
    markdownList(
      uniqueSorted(
        report.decisions.flatMap((decision) => decision.sourceRefs)
      ).slice(0, 50),
      "No source refs."
    ),
    "",
  ].join("\n");
}

export function runSemanticEnforcement(
  options: RunSemanticEnforcementOptions
): SemanticEnforcementReport {
  const enforcementMode = options.enforcementMode ?? "report";
  const failOnWarnings = options.failOnWarnings ?? false;
  const strictUnknown =
    enforcementMode === "report" ? options.strictUnknown ?? false : true;
  const strictUnknownForced =
    enforcementMode !== "report" && options.strictUnknown === false;
  const governance = validateSemanticGovernance({
    ...options,
    strictUnknown,
  });
  const waiverValidation = validateArchitectureWaivers({
    ...options,
    strictUnknown,
    now: options.now,
  });
  const validWaivers = buildValidWaiverMap(waiverValidation.findings);
  const decisions = [...governance.violations, ...governance.warnings]
    .map((finding) =>
      decisionForFinding(finding, enforcementMode, validWaivers)
    )
    .sort((left, right) =>
      `${left.status}:${left.ruleId}:${left.sourcePath}:${left.edgeFingerprint}`.localeCompare(
        `${right.status}:${right.ruleId}:${right.sourcePath}:${right.edgeFingerprint}`
      )
    );

  const blockedViolations = decisions.filter(
    (decision) => decision.status === "blocked"
  ).length;
  const waivedViolations = decisions.filter(
    (decision) => decision.status === "waived"
  ).length;
  const warningDecisions = decisions.filter(
    (decision) => decision.status === "warn"
  ).length;
  const waiverBlockFindings = waiverValidation.findings.filter(
    (finding) => finding.severity === "block"
  ).length;
  const waiverWarningFindings = waiverValidation.findings.filter(
    (finding) => finding.severity === "warn"
  ).length;
  const policyWarnings = governance.policyWarnings.length;
  const skippedByLimit = governance.sourceGraph.scan.skippedByLimit;
  const unsupportedFiles = governance.sourceGraph.scan.unsupportedFiles;

  const shouldFailStrict =
    blockedViolations > 0 ||
    waiverBlockFindings > 0 ||
    policyWarnings > 0 ||
    skippedByLimit > 0 ||
    unsupportedFiles > 0 ||
    (failOnWarnings && (warningDecisions > 0 || waiverWarningFindings > 0));
  const gate: SemanticEnforcementGate =
    enforcementMode === "report"
      ? decisions.length > 0 ||
        waiverBlockFindings > 0 ||
        waiverWarningFindings > 0 ||
        policyWarnings > 0 ||
        skippedByLimit > 0 ||
        unsupportedFiles > 0
        ? "warn"
        : "pass"
      : shouldFailStrict
        ? "fail"
        : warningDecisions > 0 || waiverWarningFindings > 0
          ? "warn"
          : "pass";
  const canProceed = enforcementMode === "report" ? true : gate !== "fail";
  const withoutText = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: nowIso(),
    enforcementMode,
    optInOnly: true as const,
    profileId: governance.profileId,
    gate,
    canProceed,
    decisions,
    governance,
    waiverValidation,
    metrics: {
      blockedViolations,
      waivedViolations,
      warningDecisions,
      waiverBlockFindings,
      waiverWarningFindings,
      policyWarnings,
      skippedByLimit,
      unsupportedFiles,
      strictUnknownForced,
      failOnWarnings,
    },
  };
  const withSummary = {
    ...withoutText,
    summary: buildSummary(withoutText),
  };
  return {
    ...withSummary,
    markdown: buildSemanticEnforcementMarkdown(withSummary),
  };
}
