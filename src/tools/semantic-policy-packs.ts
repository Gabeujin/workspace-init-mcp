import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  ARCHITECTURE_PROFILE_IDS,
  SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
  type ArchitectureOntologyPolicy,
  type ArchitecturePolicyRule,
  type ArchitectureProfileId,
} from "../data/ontology-contract.js";
import { buildArchitectureOntologyPolicyForProfile } from "../data/architecture-profiles.js";
import { validateArchitectureOntologyPolicyShape } from "./semantic-governance.js";
import {
  resolveContainedExistingFile,
  writeContainedJsonAtomic,
} from "./safe-workspace-write.js";
import {
  verifyGovernanceApprovalSignature,
  type GovernanceApprovalPayload,
} from "./governance-approval.js";

const POLICY_RELATIVE_PATH =
  ".github/ai-harness/architecture-ontology.policy.json";
const POLICY_PACK_ROOT = "docs/ai-harness/ontology/policy-packs";
const POLICY_PACK_EXPORTS = `${POLICY_PACK_ROOT}/exports`;
const POLICY_PACK_IMPORTS = `${POLICY_PACK_ROOT}/imports`;
const POLICY_PACK_BACKUPS = `${POLICY_PACK_ROOT}/backups`;

export const POLICY_PACK_MERGE_STRATEGIES = [
  "review-only",
  "replace-profile",
] as const;

export type PolicyPackMergeStrategy =
  (typeof POLICY_PACK_MERGE_STRATEGIES)[number];

export type PolicyPackReviewStatus =
  | "exported"
  | "review-required"
  | "blocked"
  | "merged";

export interface ArchitecturePolicyPack {
  schemaVersion: string;
  generatedAt: string;
  packId: string;
  profileId: ArchitectureProfileId;
  policyHash: string;
  policy: ArchitectureOntologyPolicy;
  trust: {
    source: "local-workspace";
    exportedBy: string;
    sourceWorkspaceHash: string;
    trustLevel: "local-draft" | "team-reviewed" | "organization-reviewed";
    reviewRequired: true;
    autoUpload: false;
    localAuthorityDefault: true;
  };
  gitOps: {
    noAutomaticCentralUpload: true;
    mergeRequestRequired: true;
    reversible: true;
    suggestedBranch: string;
    rollbackDirectory: string;
  };
  signature: {
    type: "sha256-policy-pack";
    value: string;
    signedBy: string;
    signedAt: string;
  };
  sourceRefs: string[];
  reviewChecklist: string[];
  warnings: string[];
}

export interface ExportArchitecturePolicyPackOptions {
  workspacePath: string;
  architectureProfile?: ArchitectureProfileId;
  exportedBy?: string;
  trustLevel?: ArchitecturePolicyPack["trust"]["trustLevel"];
  writePack?: boolean;
}

export interface ExportArchitecturePolicyPackResult {
  schemaVersion: string;
  status: "exported";
  generatedAt: string;
  pack: ArchitecturePolicyPack;
  packPath: string | null;
  summary: string;
}

export interface ImportArchitecturePolicyPackOptions {
  workspacePath: string;
  packPath: string;
  applyMerge?: boolean;
  mergeStrategy?: PolicyPackMergeStrategy;
  allowProfileChange?: boolean;
  allowConflicts?: boolean;
  reviewedBy?: string;
  approvalRef?: string;
  approvalSignature?: string;
  reviewSignature?: string;
  reviewReceiptPath?: string;
  writeReview?: boolean;
}

export interface PolicyPackConflict {
  id: string;
  severity: "info" | "warn" | "block";
  type:
    | "profile-mismatch"
    | "schema-mismatch"
    | "policy-shape"
    | "rule-conflict"
    | "layer-conflict";
  message: string;
  localRef: string;
  incomingRef: string;
}

export interface ImportArchitecturePolicyPackResult {
  schemaVersion: string;
  generatedAt: string;
  status: Exclude<PolicyPackReviewStatus, "exported">;
  packId: string | null;
  packPath: string;
  mergeStrategy: PolicyPackMergeStrategy;
  canApply: boolean;
  applied: boolean;
  expectedReviewSignature: string | null;
  conflicts: PolicyPackConflict[];
  errors: string[];
  localPolicyRef: string;
  backupPath: string | null;
  reviewReceiptPath: string | null;
  sourceRefs: string[];
  summary: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function stableHash(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function fileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function workspaceRealPath(workspacePath: string): string {
  if (!path.isAbsolute(workspacePath)) {
    throw new Error(`workspacePath must be absolute. Received: ${workspacePath}`);
  }
  return fs.realpathSync.native(workspacePath);
}

function relativeToWorkspace(workspacePath: string, fullPath: string): string {
  const relativePath = path.relative(workspacePath, fullPath);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Path escaped workspace: ${fullPath}`);
  }
  return normalizeRelativePath(relativePath);
}

function resolveContainedReadPath(
  workspacePath: string,
  inputPath: string
): { fullPath: string | null; relativePath: string; error: string | null } {
  try {
    return {
      ...resolveContainedExistingFile(workspacePath, inputPath),
      error: null,
    };
  } catch (error) {
    const fullPath = path.isAbsolute(inputPath)
      ? path.resolve(inputPath)
      : path.resolve(workspacePath, inputPath);
    let relativePath = normalizeRelativePath(inputPath);
    try {
      relativePath = relativeToWorkspace(workspacePath, fullPath);
    } catch {
      relativePath = normalizeRelativePath(inputPath);
    }
    return {
      fullPath: null,
      relativePath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readJsonIfExists<T>(fullPath: string): T | null {
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function isProfileId(value: unknown): value is ArchitectureProfileId {
  return ARCHITECTURE_PROFILE_IDS.includes(value as ArchitectureProfileId);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clonePolicy(policy: ArchitectureOntologyPolicy): ArchitectureOntologyPolicy {
  return JSON.parse(JSON.stringify(policy)) as ArchitectureOntologyPolicy;
}

function resolvePolicy(
  workspacePath: string,
  requestedProfile?: ArchitectureProfileId
): { policy: ArchitectureOntologyPolicy; sourceRefs: string[]; warnings: string[] } {
  const policyPath = path.join(workspacePath, POLICY_RELATIVE_PATH);
  const rawPolicy = readJsonIfExists<unknown>(policyPath);
  const profileId =
    requestedProfile ??
    (isPlainObject(rawPolicy) && isProfileId(rawPolicy.profileId)
      ? rawPolicy.profileId
      : "n-tier");
  if (rawPolicy != null) {
    const warnings = validateArchitectureOntologyPolicyShape(rawPolicy, profileId);
    if (warnings.length === 0) {
      return {
        policy: clonePolicy(rawPolicy as ArchitectureOntologyPolicy),
        sourceRefs: [POLICY_RELATIVE_PATH],
        warnings: [],
      };
    }
    return {
      policy: buildArchitectureOntologyPolicyForProfile(profileId),
      sourceRefs: [POLICY_RELATIVE_PATH],
      warnings: [
        `Local policy failed shape validation; exported generated ${profileId} defaults instead.`,
        ...warnings,
      ],
    };
  }
  return {
    policy: buildArchitectureOntologyPolicyForProfile(profileId),
    sourceRefs: [POLICY_RELATIVE_PATH],
    warnings: [`No local policy found; exported generated ${profileId} defaults.`],
  };
}

function policySignature(params: {
  packId: string;
  profileId: ArchitectureProfileId;
  policyHash: string;
  signedBy: string;
}): string {
  return `sha256:${stableHash({
    purpose: "architecture-policy-pack",
    packId: params.packId,
    profileId: params.profileId,
    policyHash: params.policyHash,
    signedBy: params.signedBy,
  })}`;
}

export function buildPolicyPackReviewSignature(params: {
  packId: string;
  policyHash: string;
  reviewedBy: string;
  approvalRef: string;
  packSignature?: string;
  approvalEvidenceHash?: string;
  reviewReceiptPath?: string;
}): string {
  return `review-sha256:${stableHash({
    purpose: "architecture-policy-pack-review",
    packId: params.packId,
    policyHash: params.policyHash,
    reviewedBy: params.reviewedBy,
    approvalRef: params.approvalRef,
    packSignature: params.packSignature ?? "legacy-unbound-pack-signature",
    approvalEvidenceHash:
      params.approvalEvidenceHash ?? "legacy-unbound-approval-evidence",
    reviewReceiptPath:
      params.reviewReceiptPath ?? "legacy-unbound-review-receipt",
  })}`;
}

export function buildPolicyPackApprovalPayload(params: {
  packId: string;
  policyHash: string;
  packSignature: string;
  reviewedBy: string;
  approvalRef: string;
  approvalEvidenceHash: string;
  reviewReceiptPath: string;
}): GovernanceApprovalPayload {
  return {
    purpose: "architecture-policy-pack-approval",
    subject: {
      packId: params.packId,
      policyHash: params.policyHash,
      packSignature: params.packSignature,
      reviewedBy: params.reviewedBy,
      approvalRef: params.approvalRef,
      approvalEvidenceHash: params.approvalEvidenceHash,
      reviewReceiptPath: params.reviewReceiptPath,
    },
  };
}

function policyPackExportRelativePath(pack: ArchitecturePolicyPack): string {
  return `${POLICY_PACK_EXPORTS}/${pack.profileId}-${pack.policyHash.slice(0, 12)}.policy-pack.json`;
}

function backupRelativePath(policyHash: string): string {
  return `${POLICY_PACK_BACKUPS}/architecture-ontology.policy.${policyHash.slice(0, 12)}.${Date.now()}.json`;
}

function reviewReceiptRelativePath(packId: string, policyHash: string): string {
  return `${POLICY_PACK_IMPORTS}/${stableHash({ packId, policyHash }).slice(0, 16)}.import-review.json`;
}

function expectedPackId(
  profileId: ArchitectureProfileId,
  policyHash: string
): string {
  return `architecture-policy-pack:${profileId}:${policyHash.slice(0, 16)}`;
}

function resolveApprovalEvidence(
  workspacePath: string,
  approvalRef: string
): { relativePath: string | null; hash: string | null; errors: string[] } {
  const normalized = normalizeRelativePath(approvalRef.trim());
  if (normalized.length === 0) {
    return {
      relativePath: null,
      hash: null,
      errors: ["approvalRef is required."],
    };
  }
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return {
      relativePath: normalized,
      hash: null,
      errors: [
        "approvalRef must be a workspace-contained durable evidence file, not a URL.",
      ],
    };
  }
  try {
    const resolved = resolveContainedExistingFile(workspacePath, normalized);
    return {
      relativePath: resolved.relativePath,
      hash: fileHash(fs.readFileSync(resolved.fullPath)),
      errors: [],
    };
  } catch (error) {
    return {
      relativePath: normalized,
      hash: null,
      errors: [
        `approvalRef is missing or unsafe: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

function readReviewReceipt(
  workspacePath: string,
  reviewReceiptPath: string
): { receipt: Record<string, unknown> | null; relativePath: string; errors: string[] } {
  const resolved = resolveContainedReadPath(workspacePath, reviewReceiptPath);
  if (resolved.error != null || resolved.fullPath == null) {
    return {
      receipt: null,
      relativePath: resolved.relativePath,
      errors: [`Review receipt is missing or unsafe: ${resolved.error}`],
    };
  }
  const raw = readJsonIfExists<unknown>(resolved.fullPath);
  if (!isPlainObject(raw)) {
    return {
      receipt: null,
      relativePath: resolved.relativePath,
      errors: [`Review receipt is missing or unreadable: ${resolved.relativePath}`],
    };
  }
  return { receipt: raw, relativePath: resolved.relativePath, errors: [] };
}

export function exportArchitecturePolicyPack(
  options: ExportArchitecturePolicyPackOptions
): ExportArchitecturePolicyPackResult {
  const workspacePath = workspaceRealPath(options.workspacePath);
  const exportedBy = options.exportedBy?.trim() || "workspace-init-mcp";
  const generatedAt = nowIso();
  const resolved = resolvePolicy(workspacePath, options.architectureProfile);
  const policyHash = stableHash(resolved.policy);
  const packId = `architecture-policy-pack:${resolved.policy.profileId}:${policyHash.slice(0, 16)}`;
  const pack: ArchitecturePolicyPack = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt,
    packId,
    profileId: resolved.policy.profileId,
    policyHash,
    policy: resolved.policy,
    trust: {
      source: "local-workspace",
      exportedBy,
      sourceWorkspaceHash: stableHash(workspacePath),
      trustLevel: options.trustLevel ?? "local-draft",
      reviewRequired: true,
      autoUpload: false,
      localAuthorityDefault: true,
    },
    gitOps: {
      noAutomaticCentralUpload: true,
      mergeRequestRequired: true,
      reversible: true,
      suggestedBranch: `governance/policy-pack-${resolved.policy.profileId}-${policyHash.slice(0, 8)}`,
      rollbackDirectory: POLICY_PACK_BACKUPS,
    },
    signature: {
      type: "sha256-policy-pack",
      value: policySignature({
        packId,
        profileId: resolved.policy.profileId,
        policyHash,
        signedBy: exportedBy,
      }),
      signedBy: exportedBy,
      signedAt: generatedAt,
    },
    sourceRefs: resolved.sourceRefs,
    reviewChecklist: [
      "Confirm the incoming pack came through a reviewed GitOps change.",
      "Review profile id, rule ids, layer path hints, and bypass policy.",
      "Run import review before applyMerge.",
      "Use the expectedReviewSignature from review output for explicit apply.",
      "Keep the backup path from the import receipt for rollback.",
    ],
    warnings: resolved.warnings,
  };
  let packPath: string | null = null;
  if (options.writePack === true) {
    packPath = policyPackExportRelativePath(pack);
    writeContainedJsonAtomic(
      workspacePath,
      path.join(workspacePath, packPath),
      pack
    );
  }
  return {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    status: "exported",
    generatedAt,
    pack,
    packPath,
    summary: [
      `Architecture policy pack exported: ${pack.packId}`,
      `Profile: ${pack.profileId}`,
      `Policy hash: ${pack.policyHash}`,
      `Auto upload: ${pack.trust.autoUpload}`,
      `Review required: ${pack.trust.reviewRequired}`,
      `Pack path: ${packPath ?? "not written"}`,
    ].join("\n"),
  };
}

function readPolicyPack(
  workspacePath: string,
  packPath: string
): { pack: ArchitecturePolicyPack | null; relativePath: string; errors: string[] } {
  const resolved = resolveContainedReadPath(workspacePath, packPath);
  const errors: string[] = [];
  if (resolved.error != null || resolved.fullPath == null) {
    return {
      pack: null,
      relativePath: resolved.relativePath,
      errors: [`Policy pack is missing or unsafe: ${resolved.error}`],
    };
  }
  const raw = readJsonIfExists<unknown>(resolved.fullPath);
  if (!isPlainObject(raw)) {
    return {
      pack: null,
      relativePath: resolved.relativePath,
      errors: [`Policy pack is missing or unreadable: ${resolved.relativePath}`],
    };
  }
  const pack = raw as unknown as ArchitecturePolicyPack;
  if (pack.schemaVersion !== SEMANTIC_GOVERNANCE_SCHEMA_VERSION) {
    errors.push(
      `Policy pack schemaVersion should be ${SEMANTIC_GOVERNANCE_SCHEMA_VERSION}.`
    );
  }
  if (typeof pack.packId !== "string" || pack.packId.trim().length === 0) {
    errors.push("Policy pack must include packId.");
  }
  if (!isProfileId(pack.profileId)) {
    errors.push(`Policy pack profileId is invalid: ${String(pack.profileId)}`);
  }
  if (!isPlainObject(pack.policy)) {
    errors.push("Policy pack must include policy object.");
  }
  const policyHash = isPlainObject(pack.policy) ? stableHash(pack.policy) : "";
  const declaredProfile = isProfileId(pack.profileId) ? pack.profileId : "n-tier";
  if (pack.policyHash !== policyHash) {
    errors.push("Policy pack policyHash does not match the included policy.");
  }
  if (
    isProfileId(pack.profileId) &&
    pack.packId !== expectedPackId(pack.profileId, pack.policyHash)
  ) {
    errors.push("Policy pack packId does not match profile and policyHash.");
  }
  if (pack.trust?.autoUpload !== false) {
    errors.push("Policy pack must declare autoUpload=false.");
  }
  if (pack.trust?.reviewRequired !== true) {
    errors.push("Policy pack must declare reviewRequired=true.");
  }
  if (pack.trust?.localAuthorityDefault !== true) {
    errors.push("Policy pack must preserve localAuthorityDefault=true.");
  }
  if (pack.gitOps?.noAutomaticCentralUpload !== true) {
    errors.push("Policy pack gitOps.noAutomaticCentralUpload must be true.");
  }
  if (pack.gitOps?.mergeRequestRequired !== true) {
    errors.push("Policy pack gitOps.mergeRequestRequired must be true.");
  }
  if (pack.gitOps?.reversible !== true) {
    errors.push("Policy pack gitOps.reversible must be true.");
  }
  if (pack.gitOps?.rollbackDirectory !== POLICY_PACK_BACKUPS) {
    errors.push(`Policy pack gitOps.rollbackDirectory must be ${POLICY_PACK_BACKUPS}.`);
  }
  if (pack.signature?.type !== "sha256-policy-pack") {
    errors.push("Policy pack signature.type must be sha256-policy-pack.");
  }
  if (
    typeof pack.signature?.signedBy !== "string" ||
    pack.signature.signedBy.trim().length === 0
  ) {
    errors.push("Policy pack signature.signedBy is required.");
  }
  if (
    typeof pack.signature?.signedAt !== "string" ||
    pack.signature.signedAt.trim().length === 0
  ) {
    errors.push("Policy pack signature.signedAt is required.");
  }
  const expectedSignature = policySignature({
    packId: typeof pack.packId === "string" ? pack.packId : "",
    profileId: declaredProfile,
    policyHash: typeof pack.policyHash === "string" ? pack.policyHash : "",
    signedBy: typeof pack.signature?.signedBy === "string" ? pack.signature.signedBy : "",
  });
  if (pack.signature?.value !== expectedSignature) {
    errors.push("Policy pack signature.value does not match pack contents.");
  }
  return { pack, relativePath: resolved.relativePath, errors };
}

function ruleMap(policy: ArchitectureOntologyPolicy): Map<string, ArchitecturePolicyRule> {
  return new Map(policy.rules.map((rule) => [rule.id, rule]));
}

function detectConflicts(
  localPolicy: ArchitectureOntologyPolicy,
  incomingPolicy: ArchitectureOntologyPolicy,
  packPath: string
): PolicyPackConflict[] {
  const conflicts: PolicyPackConflict[] = [];
  if (localPolicy.schemaVersion !== incomingPolicy.schemaVersion) {
    conflicts.push({
      id: "policy-pack-conflict:schema-version",
      severity: "block",
      type: "schema-mismatch",
      message: `Local schemaVersion ${localPolicy.schemaVersion} differs from incoming ${incomingPolicy.schemaVersion}.`,
      localRef: POLICY_RELATIVE_PATH,
      incomingRef: packPath,
    });
  }
  if (localPolicy.profileId !== incomingPolicy.profileId) {
    conflicts.push({
      id: "policy-pack-conflict:profile-id",
      severity: "warn",
      type: "profile-mismatch",
      message: `Local profile ${localPolicy.profileId} differs from incoming ${incomingPolicy.profileId}.`,
      localRef: POLICY_RELATIVE_PATH,
      incomingRef: packPath,
    });
  }
  const localRules = ruleMap(localPolicy);
  for (const incomingRule of incomingPolicy.rules) {
    const localRule = localRules.get(incomingRule.id);
    if (localRule != null && stableHash(localRule) !== stableHash(incomingRule)) {
      conflicts.push({
        id: `policy-pack-conflict:rule:${incomingRule.id}`,
        severity: "block",
        type: "rule-conflict",
        message: `Rule ${incomingRule.id} exists locally with different contents.`,
        localRef: `${POLICY_RELATIVE_PATH}#rules/${incomingRule.id}`,
        incomingRef: `${packPath}#policy/rules/${incomingRule.id}`,
      });
    }
  }
  const localLayers = new Map(localPolicy.layers.map((layer) => [layer.id, layer]));
  for (const incomingLayer of incomingPolicy.layers) {
    const localLayer = localLayers.get(incomingLayer.id);
    if (localLayer != null && stableHash(localLayer) !== stableHash(incomingLayer)) {
      conflicts.push({
        id: `policy-pack-conflict:layer:${incomingLayer.id}`,
        severity: "warn",
        type: "layer-conflict",
        message: `Layer ${incomingLayer.id} differs in labels, coordinates, or path hints.`,
        localRef: `${POLICY_RELATIVE_PATH}#layers/${incomingLayer.id}`,
        incomingRef: `${packPath}#policy/layers/${incomingLayer.id}`,
      });
    }
  }
  return conflicts.sort((left, right) => left.id.localeCompare(right.id));
}

function buildImportSummary(result: Omit<ImportArchitecturePolicyPackResult, "summary">): string {
  return [
    `Policy pack import status: ${result.status}`,
    `Pack: ${result.packId ?? "unreadable"}`,
    `Merge strategy: ${result.mergeStrategy}`,
    `Can apply: ${result.canApply}`,
    `Applied: ${result.applied}`,
    `Conflicts: ${result.conflicts.length}`,
    `Errors: ${result.errors.length}`,
    `Backup: ${result.backupPath ?? "none"}`,
    `Review receipt: ${result.reviewReceiptPath ?? "none"}`,
  ].join("\n");
}

export function importArchitecturePolicyPack(
  options: ImportArchitecturePolicyPackOptions
): ImportArchitecturePolicyPackResult {
  const workspacePath = workspaceRealPath(options.workspacePath);
  const generatedAt = nowIso();
  const mergeStrategy = options.mergeStrategy ?? "review-only";
  const packResult = readPolicyPack(workspacePath, options.packPath);
  const localPolicy = resolvePolicy(workspacePath).policy;
  const errors = [...packResult.errors];
  const pack = packResult.pack;
  const conflicts =
    pack != null && errors.length === 0
      ? detectConflicts(localPolicy, pack.policy, packResult.relativePath)
      : [];
  if (pack != null) {
    const shapeWarnings = validateArchitectureOntologyPolicyShape(
      pack.policy,
      pack.profileId
    );
    errors.push(
      ...shapeWarnings.map((warning) => `Incoming policy shape warning: ${warning}`)
    );
  }

  const reviewedBy = options.reviewedBy?.trim() ?? "";
  const approvalRef = options.approvalRef?.trim() ?? "";
  const approvalSignature = options.approvalSignature?.trim() ?? "";
  const applyRequested = options.applyMerge === true;
  const needsActionableReview =
    applyRequested ||
    options.writeReview === true ||
    reviewedBy.length > 0 ||
    approvalRef.length > 0 ||
    approvalSignature.length > 0 ||
    options.reviewSignature != null;
  let approvalEvidenceRef: string | null = null;
  let approvalEvidenceHash: string | null = null;
  if (needsActionableReview) {
    if (reviewedBy.length === 0) {
      errors.push(
        applyRequested
          ? "applyMerge requires reviewedBy."
          : "writeReview requires reviewedBy."
      );
    }
    if (approvalRef.length === 0) {
      errors.push(
        applyRequested
          ? "applyMerge requires approvalRef."
          : "writeReview requires approvalRef."
      );
    } else {
      const approvalEvidence = resolveApprovalEvidence(workspacePath, approvalRef);
      approvalEvidenceRef = approvalEvidence.relativePath;
      approvalEvidenceHash = approvalEvidence.hash;
      errors.push(...approvalEvidence.errors);
    }
    if (approvalSignature.length === 0) {
      errors.push(
        applyRequested
          ? "applyMerge requires approvalSignature from a trusted reviewer."
          : "writeReview requires approvalSignature from a trusted reviewer."
      );
    }
  }

  const defaultReviewReceiptPath =
    pack != null ? reviewReceiptRelativePath(pack.packId, pack.policyHash) : null;
  const requestedReviewReceiptPath =
    options.reviewReceiptPath?.trim() ??
    (applyRequested ? "" : defaultReviewReceiptPath ?? "");
  let reviewReceiptPath =
    requestedReviewReceiptPath.length > 0
      ? normalizeRelativePath(requestedReviewReceiptPath)
      : defaultReviewReceiptPath;
  const expectedReviewSignature =
    pack != null &&
    reviewedBy.length > 0 &&
    approvalRef.length > 0 &&
    approvalEvidenceHash != null &&
    reviewReceiptPath != null
      ? buildPolicyPackReviewSignature({
          packId: pack.packId,
          policyHash: pack.policyHash,
          reviewedBy,
          approvalRef,
          packSignature: pack.signature.value,
          approvalEvidenceHash,
          reviewReceiptPath,
        })
      : null;
  if (
    needsActionableReview &&
    pack != null &&
    approvalEvidenceHash != null &&
    reviewReceiptPath != null &&
    reviewedBy.length > 0 &&
    approvalSignature.length > 0
  ) {
    if (pack.signature.signedBy === reviewedBy) {
      errors.push("reviewedBy must differ from the policy pack signer.");
    }
    const approval = verifyGovernanceApprovalSignature({
      workspacePath,
      approvedBy: reviewedBy,
      approvalSignature,
      payload: buildPolicyPackApprovalPayload({
        packId: pack.packId,
        policyHash: pack.policyHash,
        packSignature: pack.signature.value,
        reviewedBy,
        approvalRef,
        approvalEvidenceHash,
        reviewReceiptPath,
      }),
    });
    errors.push(...approval.errors);
  }
  if (applyRequested) {
    if (mergeStrategy === "review-only") {
      errors.push("applyMerge requires mergeStrategy=replace-profile.");
    }
    if (options.reviewReceiptPath == null || options.reviewReceiptPath.trim().length === 0) {
      errors.push("applyMerge requires reviewReceiptPath from a prior review.");
    }
    if (
      expectedReviewSignature == null ||
      options.reviewSignature !== expectedReviewSignature
    ) {
      errors.push("applyMerge requires the exact expectedReviewSignature.");
    }
    if (
      pack != null &&
      localPolicy.profileId !== pack.profileId &&
      options.allowProfileChange !== true
    ) {
      errors.push("Incoming profile differs; set allowProfileChange=true to merge.");
    }
    if (
      conflicts.some((conflict) => conflict.severity === "block") &&
      options.allowConflicts !== true
    ) {
      errors.push("Blocking conflicts require allowConflicts=true.");
    }
    if (pack != null && options.reviewReceiptPath != null) {
      const receiptResult = readReviewReceipt(workspacePath, options.reviewReceiptPath);
      errors.push(...receiptResult.errors);
      const receipt = receiptResult.receipt;
      if (receipt != null) {
        const receiptChecks: Array<[boolean, string]> = [
          [
            receipt.receiptKind === "architecture-policy-pack-import-review",
            "Review receipt kind is invalid.",
          ],
          [receipt.status === "review-required", "Review receipt must be from a prior review-required result."],
          [receipt.applied === false, "Review receipt must not already be an applied merge receipt."],
          [receipt.packId === pack.packId, "Review receipt packId does not match the incoming pack."],
          [receipt.packPath === packResult.relativePath, "Review receipt packPath does not match the incoming pack path."],
          [receipt.policyHash === pack.policyHash, "Review receipt policyHash does not match the incoming pack."],
          [receipt.packSignature === pack.signature.value, "Review receipt pack signature does not match the incoming pack."],
          [receipt.reviewedBy === reviewedBy, "Review receipt reviewedBy does not match apply request."],
          [receipt.approvalRef === approvalRef, "Review receipt approvalRef does not match apply request."],
          [receipt.approvalSignature === approvalSignature, "Review receipt approvalSignature does not match apply request."],
          [receipt.approvalEvidenceHash === approvalEvidenceHash, "Review receipt approval evidence hash does not match current evidence."],
          [receipt.expectedReviewSignature === options.reviewSignature, "Review receipt expected signature does not match apply request."],
        ];
        for (const [ok, message] of receiptChecks) {
          if (!ok) {
            errors.push(message);
          }
        }
      }
      reviewReceiptPath = receiptResult.relativePath;
    }
  }

  let status: ImportArchitecturePolicyPackResult["status"] =
    errors.length > 0 ? "blocked" : applyRequested ? "merged" : "review-required";
  let backupPath: string | null = null;
  const canApply =
    pack != null &&
    errors.length === 0 &&
    expectedReviewSignature != null &&
    (conflicts.every((conflict) => conflict.severity !== "block") ||
      options.allowConflicts === true);
  let applied = false;

  if (status === "merged" && pack != null) {
    backupPath = backupRelativePath(stableHash(localPolicy));
    writeContainedJsonAtomic(
      workspacePath,
      path.join(workspacePath, backupPath),
      localPolicy
    );
    writeContainedJsonAtomic(
      workspacePath,
      path.join(workspacePath, POLICY_RELATIVE_PATH),
      pack.policy
    );
    applied = true;
  } else if (applyRequested) {
    status = "blocked";
  }

  const withoutSummary: Omit<ImportArchitecturePolicyPackResult, "summary"> = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt,
    status,
    packId: pack?.packId ?? null,
    packPath: packResult.relativePath,
    mergeStrategy,
    canApply,
    applied,
    expectedReviewSignature,
    conflicts,
    errors,
    localPolicyRef: POLICY_RELATIVE_PATH,
    backupPath,
    reviewReceiptPath,
    sourceRefs: [
      POLICY_RELATIVE_PATH,
      packResult.relativePath,
      ...(backupPath ? [backupPath] : []),
    ],
  };
  const result: ImportArchitecturePolicyPackResult = {
    ...withoutSummary,
    summary: buildImportSummary(withoutSummary),
  };

  if (
    reviewReceiptPath != null &&
    expectedReviewSignature != null &&
    errors.length === 0 &&
    (options.writeReview === true || applied)
  ) {
    writeContainedJsonAtomic(
      workspacePath,
      path.join(workspacePath, reviewReceiptPath),
      {
        receiptKind: "architecture-policy-pack-import-review",
        receiptVersion: 1,
        ...result,
        policyHash: pack?.policyHash ?? null,
        packSignature: pack?.signature.value ?? null,
        approvalEvidenceRef,
        approvalEvidenceHash,
        reviewedBy: reviewedBy || null,
        approvalRef: approvalRef || null,
        approvalSignature: approvalSignature || null,
        approvalSignatureVerified: true,
        reviewSignature: options.reviewSignature ?? null,
        noAutomaticCentralUpload: true,
        reversible: true,
      }
    );
  }

  return result;
}
