export const SEMANTIC_GOVERNANCE_SCHEMA_VERSION = "1.0.0";

export const ARCHITECTURE_PROFILE_IDS = [
  "n-tier",
  "clean",
  "hexagonal",
  "ddd",
  "event-driven",
  "workspace-init-mcp",
] as const;

export type ArchitectureProfileId = (typeof ARCHITECTURE_PROFILE_IDS)[number];

export const ARCHITECTURE_LAYER_IDS = [
  "presentation",
  "business",
  "domain",
  "application",
  "data-access",
  "infrastructure",
  "configuration",
  "test",
  "generated-harness",
  "unknown",
] as const;

export type ArchitectureLayerId = (typeof ARCHITECTURE_LAYER_IDS)[number];

export type SourceEdgeKind =
  | "imports"
  | "exports"
  | "dynamic-import"
  | "require"
  | "extends"
  | "implements"
  | "new";

export type SemanticVerdict = "allow" | "warn" | "block";
export type ScanConfidence = "high" | "medium" | "low";

export interface ArchitectureLayerDefinition {
  id: ArchitectureLayerId;
  label: string;
  depth: number;
  access: number;
  volatility: number;
  pathHints: string[];
}

export interface ArchitecturePolicyRule {
  id: string;
  predicate: "MAY_IMPORT" | "MUST_NOT_IMPORT" | "UNKNOWN_LAYER_REVIEW";
  sourceLayer: ArchitectureLayerId | "*";
  targetLayer: ArchitectureLayerId | "*";
  severity: SemanticVerdict;
  rationale: string;
  suggestedPath?: ArchitectureLayerId[];
}

export interface ArchitectureOntologyPolicy {
  schemaVersion: string;
  profileId: ArchitectureProfileId;
  enforcementMode: "advisory" | "strict";
  unknownLayerMode: "warn" | "block";
  layers: ArchitectureLayerDefinition[];
  rules: ArchitecturePolicyRule[];
  bypassPolicy: {
    sourceCommentMayOnlyReferenceWaiver: true;
    waiverLedgerRequired: true;
    maxActivePerFile: number;
    ttlDays: number;
  };
}

export interface SourceImportFact {
  specifier: string;
  kind: SourceEdgeKind;
  line: number;
  resolvedPath: string | null;
  confidence: ScanConfidence;
}

export interface SourceDeclarationFact {
  name: string;
  kind: string;
  line: number;
}

export interface SourceFileFact {
  path: string;
  language: "typescript" | "javascript";
  layer: ArchitectureLayerId;
  declarations: SourceDeclarationFact[];
  imports: SourceImportFact[];
}

export interface SourceDependencyEdge {
  id: string;
  fromPath: string;
  toPath: string | null;
  fromLayer: ArchitectureLayerId;
  toLayer: ArchitectureLayerId | "external" | "unresolved";
  specifier: string;
  kind: SourceEdgeKind;
  line: number;
  confidence: ScanConfidence;
  fingerprint: string;
}

export interface SourceGraphSnapshot {
  schemaVersion: string;
  generatedAt: string;
  workspaceRootHash: string;
  toolVersion: string;
  architectureProfileId: ArchitectureProfileId;
  scan: {
    sourceFileCount: number;
    dependencyEdgeCount: number;
    maxFiles: number;
    skippedByLimit: number;
    unsupportedFiles: number;
  };
  warnings: string[];
  files: SourceFileFact[];
  edges: SourceDependencyEdge[];
}

export interface SemanticViolation {
  id: string;
  ruleId: string;
  severity: SemanticVerdict;
  message: string;
  sourcePath: string;
  targetPath: string | null;
  sourceLayer: ArchitectureLayerId;
  targetLayer: ArchitectureLayerId | "external" | "unresolved";
  edgeKind: SourceEdgeKind;
  line: number;
  fingerprint: string;
  confidence: ScanConfidence;
  evidenceRefs: string[];
  suggestedAction: string;
  spatialSignature: {
    source: [number, number, number];
    target: [number, number, number];
    distance: number;
  };
  asciiMap: string;
}

export interface SemanticGovernanceEvaluation {
  schemaVersion: string;
  generatedAt: string;
  profileId: ArchitectureProfileId;
  verdict: SemanticVerdict;
  summary: string;
  sourceGraph: SourceGraphSnapshot;
  policy: ArchitectureOntologyPolicy;
  policyWarnings: string[];
  violations: SemanticViolation[];
  warnings: SemanticViolation[];
  metrics: {
    filesScanned: number;
    edgesEvaluated: number;
    blockedEdges: number;
    warningEdges: number;
    unresolvedEdges: number;
  };
}

export type WaiverValidationStatus =
  | "valid"
  | "invalid"
  | "expired"
  | "missing-evidence"
  | "fingerprint-mismatch"
  | "rule-mismatch"
  | "unused"
  | "unknown-reference"
  | "self-authorizing-comment";

export interface ArchitectureWaiverLedgerEntry {
  id: string;
  ruleId: string;
  edgeFingerprint: string;
  owner: string;
  approvedBy: string;
  approvalRef: string;
  approvalSignature: string;
  status: "active" | "expired" | "revoked" | "superseded";
  createdAt: string;
  expiresAt: string;
  evidenceRefs: string[];
  maxUses: number;
  rationale: string;
}

export interface ArchitectureWaiverLedger {
  schemaVersion: string;
  generatedAt: string;
  policy: string;
  waivers: ArchitectureWaiverLedgerEntry[];
}

export interface SourceWaiverReference {
  id: string;
  waiverId: string;
  sourcePath: string;
  line: number;
  rawText: string;
  selfAuthorizing: boolean;
  evidenceRefs: string[];
}

export interface WaiverValidationFinding {
  id: string;
  status: WaiverValidationStatus;
  severity: "info" | "warn" | "block";
  waiverId: string | null;
  ruleId: string | null;
  edgeFingerprint: string | null;
  sourcePath: string | null;
  line: number | null;
  message: string;
  evidenceRefs: string[];
}

export interface WaiverValidationResult {
  schemaVersion: string;
  generatedAt: string;
  verdict: SemanticVerdict;
  summary: string;
  ledgerPath: string;
  sourceReferences: SourceWaiverReference[];
  findings: WaiverValidationFinding[];
  metrics: {
    waivers: number;
    sourceReferences: number;
    validWaivers: number;
    blockedFindings: number;
    warningFindings: number;
  };
}
