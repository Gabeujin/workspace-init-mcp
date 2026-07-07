import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { resolveContainedExistingFile } from "./safe-workspace-write.js";

export const GOVERNANCE_TRUST_RELATIVE_PATH =
  ".github/ai-harness/governance-trust.json";

export interface GovernanceApprovalPayload {
  purpose:
    | "architecture-policy-pack-approval"
    | "architecture-waiver-approval"
    | "architecture-waiver-revocation";
  subject: Record<string, unknown>;
}

interface TrustedReviewer {
  id: string;
  publicKeyPem: string;
  status?: "active" | "revoked";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function readTrustConfig(workspacePath: string): {
  reviewers: TrustedReviewer[];
  errors: string[];
} {
  try {
    const resolved = resolveContainedExistingFile(
      workspacePath,
      GOVERNANCE_TRUST_RELATIVE_PATH
    );
    const raw = JSON.parse(fs.readFileSync(resolved.fullPath, "utf-8")) as unknown;
    if (!isPlainObject(raw)) {
      return {
        reviewers: [],
        errors: [`Governance trust file is not an object: ${GOVERNANCE_TRUST_RELATIVE_PATH}`],
      };
    }
    const rawReviewers = Array.isArray(raw.reviewers)
      ? raw.reviewers
      : Array.isArray(raw.trustedReviewers)
        ? raw.trustedReviewers
        : [];
    const reviewers: TrustedReviewer[] = rawReviewers
      .filter(isPlainObject)
      .map((reviewer): TrustedReviewer => {
        const status: TrustedReviewer["status"] =
          reviewer.status === "revoked" || reviewer.status === "active"
            ? reviewer.status
            : "active";
        return {
          id: typeof reviewer.id === "string" ? reviewer.id : "",
          publicKeyPem:
            typeof reviewer.publicKeyPem === "string" ? reviewer.publicKeyPem : "",
          status,
        };
      })
      .filter(
        (reviewer) =>
          reviewer.id.trim().length > 0 &&
          reviewer.publicKeyPem.trim().length > 0
      );
    return { reviewers, errors: [] };
  } catch (error) {
    return {
      reviewers: [],
      errors: [
        `Governance trust file is missing or unsafe: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

function signatureBytes(signature: string): Buffer | null {
  const normalized = signature.trim();
  const encoded = normalized.startsWith("ed25519:")
    ? normalized.slice("ed25519:".length)
    : normalized;
  try {
    return Buffer.from(encoded, "base64");
  } catch {
    return null;
  }
}

export function verifyGovernanceApprovalSignature(params: {
  workspacePath: string;
  approvedBy: string;
  approvalSignature: string;
  payload: GovernanceApprovalPayload;
}): { valid: boolean; errors: string[]; sourceRefs: string[] } {
  const approvedBy = params.approvedBy.trim();
  const approvalSignature = params.approvalSignature.trim();
  const errors: string[] = [];
  if (approvedBy.length === 0) {
    errors.push("approvedBy is required for governance approval signature verification.");
  }
  if (approvalSignature.length === 0) {
    errors.push(
      "approvalSignature is required and must be an Ed25519 signature over the governance approval payload."
    );
  }
  const trust = readTrustConfig(params.workspacePath);
  errors.push(...trust.errors);
  const reviewer = trust.reviewers.find(
    (current) => current.id === approvedBy && current.status !== "revoked"
  );
  if (reviewer == null) {
    errors.push(`approvedBy is not an active trusted reviewer: ${approvedBy || "missing"}.`);
  }
  const signature = signatureBytes(approvalSignature);
  if (signature == null) {
    errors.push("approvalSignature is not valid base64 or ed25519:<base64>.");
  }
  if (errors.length > 0 || reviewer == null || signature == null) {
    return {
      valid: false,
      errors,
      sourceRefs: [GOVERNANCE_TRUST_RELATIVE_PATH],
    };
  }
  try {
    const publicKey = crypto.createPublicKey(reviewer.publicKeyPem);
    const valid = crypto.verify(
      null,
      Buffer.from(stableSerialize(params.payload), "utf-8"),
      publicKey,
      signature
    );
    if (!valid) {
      errors.push("approvalSignature does not verify against the trusted reviewer public key.");
    }
  } catch (error) {
    errors.push(
      `approvalSignature verification failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  return {
    valid: errors.length === 0,
    errors,
    sourceRefs: [GOVERNANCE_TRUST_RELATIVE_PATH],
  };
}
