import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
  type ArchitectureWaiverLedger,
  type ArchitectureWaiverLedgerEntry,
  type SourceWaiverReference,
  type WaiverValidationFinding,
  type WaiverValidationResult,
  type WaiverValidationStatus,
} from "../data/ontology-contract.js";
import {
  validateSemanticGovernance,
  type ValidateSemanticGovernanceOptions,
} from "./semantic-governance.js";
import { resolveContainedExistingFile } from "./safe-workspace-write.js";
import {
  verifyGovernanceApprovalSignature,
  type GovernanceApprovalPayload,
} from "./governance-approval.js";

const WAIVER_LEDGER_RELATIVE_PATH =
  "docs/ai-harness/ontology/state/bypass-ledger.json";
const WAIVER_REVOCATION_LEDGER_RELATIVE_PATH =
  "docs/ai-harness/ontology/state/waiver-revocations.json";
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "docs/ai-harness/ontology/state",
]);

export interface ValidateArchitectureWaiversOptions
  extends ValidateSemanticGovernanceOptions {
  now?: string;
}

export interface WaiverRevocationEntry {
  id: string;
  waiverId: string;
  ruleId: string;
  edgeFingerprint: string;
  revokedBy: string;
  revokedAt: string;
  reason: string;
  revocationSignature: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function relativeToWorkspace(workspacePath: string, fullPath: string): string {
  const relativePath = path.relative(workspacePath, fullPath);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Path escaped workspace during waiver scan: ${fullPath}`);
  }
  return normalizeRelativePath(relativePath);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }
  return [];
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

function parseWaiverRevocationEntries(
  rawLedger: Record<string, unknown>,
  evidenceRef: string
): {
  revocations: WaiverRevocationEntry[];
  findings: WaiverValidationFinding[];
} {
  const findings: WaiverValidationFinding[] = [];
  const entries = Array.isArray(rawLedger.revocations) ? rawLedger.revocations : [];
  const revocations: WaiverRevocationEntry[] = [];
  for (const [index, entry] of entries.entries()) {
    if (!isPlainObject(entry)) {
      findings.push(
        finding({
          status: "invalid",
          severity: "block",
          waiverId: null,
          ruleId: null,
          edgeFingerprint: null,
          sourcePath: null,
          line: null,
          message: `Waiver revocation at index ${index} is not an object.`,
          evidenceRefs: [evidenceRef],
        })
      );
      continue;
    }
    const revocation: WaiverRevocationEntry = {
      id: typeof entry.id === "string" ? entry.id : "",
      waiverId: typeof entry.waiverId === "string" ? entry.waiverId : "",
      ruleId: typeof entry.ruleId === "string" ? entry.ruleId : "",
      edgeFingerprint:
        typeof entry.edgeFingerprint === "string" ? entry.edgeFingerprint : "",
      revokedBy: typeof entry.revokedBy === "string" ? entry.revokedBy : "",
      revokedAt: typeof entry.revokedAt === "string" ? entry.revokedAt : "",
      reason: typeof entry.reason === "string" ? entry.reason : "",
      revocationSignature:
        typeof entry.revocationSignature === "string"
          ? entry.revocationSignature
          : "",
    };
    const missing = [
      ["id", revocation.id],
      ["waiverId", revocation.waiverId],
      ["ruleId", revocation.ruleId],
      ["edgeFingerprint", revocation.edgeFingerprint],
      ["revokedBy", revocation.revokedBy],
      ["revokedAt", revocation.revokedAt],
      ["reason", revocation.reason],
      ["revocationSignature", revocation.revocationSignature],
    ].filter(([, value]) => String(value).trim().length === 0);
    if (missing.length > 0) {
      findings.push(
        finding({
          status: "invalid",
          severity: "block",
          waiverId: revocation.waiverId || null,
          ruleId: revocation.ruleId || null,
          edgeFingerprint: revocation.edgeFingerprint || null,
          sourcePath: null,
          line: null,
          message: `Waiver revocation ${revocation.id || index} is missing required fields: ${missing.map(([field]) => field).join(", ")}.`,
          evidenceRefs: [evidenceRef],
        })
      );
    }
    revocations.push(revocation);
  }
  return { revocations, findings };
}

function parseWaiverRevocations(workspacePath: string): {
  revocations: WaiverRevocationEntry[];
  findings: WaiverValidationFinding[];
} {
  const revocationPath = path.join(workspacePath, WAIVER_REVOCATION_LEDGER_RELATIVE_PATH);
  const rawLedger = readJsonIfExists<Record<string, unknown>>(revocationPath);
  if (!isPlainObject(rawLedger)) {
    return {
      revocations: [],
      findings: [
        finding({
          status: "missing-evidence",
          severity: "warn",
          waiverId: null,
          ruleId: null,
          edgeFingerprint: null,
          sourcePath: null,
          line: null,
          message:
            "Waiver revocation ledger is missing or unreadable; active waiver replay protection is unavailable.",
          evidenceRefs: [WAIVER_REVOCATION_LEDGER_RELATIVE_PATH],
        }),
      ],
    };
  }
  return parseWaiverRevocationEntries(
    rawLedger,
    WAIVER_REVOCATION_LEDGER_RELATIVE_PATH
  );
}

function runGit(workspacePath: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: workspacePath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
      windowsHide: true,
    });
  } catch {
    return null;
  }
}

function loadAnchoredWaiverRevocations(workspacePath: string): {
  available: boolean;
  sourceRefs: string[];
  revocations: Array<{ revocation: WaiverRevocationEntry; sourceRef: string }>;
} {
  const gitRootOutput = runGit(workspacePath, ["rev-parse", "--show-toplevel"]);
  if (gitRootOutput == null) {
    return { available: false, sourceRefs: [], revocations: [] };
  }
  const gitRoot = gitRootOutput.trim();
  const ledgerFullPath = path.join(workspacePath, WAIVER_REVOCATION_LEDGER_RELATIVE_PATH);
  const pathspec = normalizeRelativePath(path.relative(gitRoot, ledgerFullPath));
  if (pathspec === "" || pathspec.startsWith("../")) {
    return { available: false, sourceRefs: [], revocations: [] };
  }

  const refs = [
    "HEAD",
    "origin/HEAD",
    "origin/main",
    "origin/master",
    "main",
    "master",
  ];
  const seenContents = new Set<string>();
  const seenCommits = new Set<string>();
  const sourceRefs: string[] = [];
  const revocations: Array<{ revocation: WaiverRevocationEntry; sourceRef: string }> = [];
  for (const ref of refs) {
    const commitsRaw = runGit(workspacePath, [
      "log",
      "--format=%H",
      ref,
      "--",
      pathspec,
    ]);
    if (commitsRaw == null) {
      continue;
    }
    for (const commit of commitsRaw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
      if (seenCommits.has(commit)) {
        continue;
      }
      seenCommits.add(commit);
      const raw = runGit(workspacePath, ["show", `${commit}:${pathspec}`]);
      if (raw == null || seenContents.has(raw)) {
        continue;
      }
      seenContents.add(raw);
      const sourceRef = `git:${ref}:${commit.slice(0, 12)}:${pathspec}`;
      sourceRefs.push(sourceRef);
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isPlainObject(parsed)) {
          continue;
        }
        for (const current of parseWaiverRevocationEntries(parsed, sourceRef).revocations) {
          revocations.push({ revocation: current, sourceRef });
        }
      } catch {
        continue;
      }
    }
  }
  return {
    available: sourceRefs.length > 0,
    sourceRefs,
    revocations,
  };
}

function shouldSkipDirectory(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  const firstSegment = normalized.split("/")[0];
  return EXCLUDED_DIRS.has(normalized) || EXCLUDED_DIRS.has(firstSegment);
}

function collectSourceFiles(workspacePath: string, maxFiles: number): string[] {
  const files: string[] = [];
  function walk(dir: string): void {
    if (files.length >= maxFiles) {
      return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = relativeToWorkspace(workspacePath, fullPath);
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(relativePath)) {
          walk(fullPath);
        }
        continue;
      }
      if (
        entry.isFile() &&
        SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        files.push(fullPath);
      }
    }
  }
  walk(workspacePath);
  return files;
}

function parseWaiverLedger(workspacePath: string): {
  ledger: ArchitectureWaiverLedger;
  findings: WaiverValidationFinding[];
} {
  const ledgerPath = path.join(workspacePath, WAIVER_LEDGER_RELATIVE_PATH);
  const rawLedger = readJsonIfExists<Record<string, unknown>>(ledgerPath);
  const findings: WaiverValidationFinding[] = [];
  if (!isPlainObject(rawLedger)) {
    return {
      ledger: {
        schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
        generatedAt: "missing",
        policy: "missing waiver ledger",
        waivers: [],
      },
      findings: [
        finding({
          status: "missing-evidence",
          severity: "warn",
          waiverId: null,
          ruleId: null,
          edgeFingerprint: null,
          sourcePath: null,
          line: null,
          message:
            "Waiver ledger is missing or unreadable; source comments cannot authorize exceptions.",
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH],
        }),
      ],
    };
  }
  const waivers = Array.isArray(rawLedger.waivers) ? rawLedger.waivers : [];
  const parsedWaivers: ArchitectureWaiverLedgerEntry[] = [];
  for (const [index, waiver] of waivers.entries()) {
    if (!isPlainObject(waiver)) {
      findings.push(
        finding({
          status: "missing-evidence",
          severity: "block",
          waiverId: null,
          ruleId: null,
          edgeFingerprint: null,
          sourcePath: null,
          line: null,
          message: `Waiver at index ${index} is not an object.`,
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH],
        })
      );
      continue;
    }
    const id = typeof waiver.id === "string" ? waiver.id : "";
    const ruleId = typeof waiver.ruleId === "string" ? waiver.ruleId : "";
    const edgeFingerprint =
      typeof waiver.edgeFingerprint === "string" ? waiver.edgeFingerprint : "";
    const owner = typeof waiver.owner === "string" ? waiver.owner : "";
    const approvedBy =
      typeof waiver.approvedBy === "string" ? waiver.approvedBy : "";
    const approvalRef =
      typeof waiver.approvalRef === "string" ? waiver.approvalRef : "";
    const approvalSignature =
      typeof waiver.approvalSignature === "string"
        ? waiver.approvalSignature
        : "";
    const statusIsValid =
      waiver.status === "active" ||
      waiver.status === "expired" ||
      waiver.status === "revoked" ||
      waiver.status === "superseded";
    const status: ArchitectureWaiverLedgerEntry["status"] = statusIsValid
      ? (waiver.status as ArchitectureWaiverLedgerEntry["status"])
      : "active";
    const createdAt =
      typeof waiver.createdAt === "string" ? waiver.createdAt : "unknown";
    const expiresAt =
      typeof waiver.expiresAt === "string" ? waiver.expiresAt : "";
    const evidenceRefs = asStringArray(waiver.evidenceRefs);
    const maxUses =
      typeof waiver.maxUses === "number" && Number.isFinite(waiver.maxUses)
        ? waiver.maxUses
        : 1;
    const rationale =
      typeof waiver.rationale === "string" ? waiver.rationale : "";
    const requiredMissing = [
      ["id", id],
      ["ruleId", ruleId],
      ["edgeFingerprint", edgeFingerprint],
      ["owner", owner],
      ["approvedBy", approvedBy],
      ["approvalRef", approvalRef],
      ["approvalSignature", approvalSignature],
      ["status", statusIsValid ? status : ""],
      ["expiresAt", expiresAt],
      ["rationale", rationale],
    ].filter(([, value]) => String(value).trim().length === 0);
    if (requiredMissing.length > 0 || evidenceRefs.length === 0) {
      findings.push(
        finding({
          status: "missing-evidence",
          severity: "block",
          waiverId: id || null,
          ruleId: ruleId || null,
          edgeFingerprint: edgeFingerprint || null,
          sourcePath: null,
          line: null,
          message: `Waiver ${id || index} is missing required fields: ${requiredMissing
            .map(([field]) => field)
            .join(", ")}${evidenceRefs.length === 0 ? ", evidenceRefs" : ""}.`,
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH],
        })
      );
    }
    parsedWaivers.push({
      id,
      ruleId,
      edgeFingerprint,
      owner,
      approvedBy,
      approvalRef: normalizeRelativePath(approvalRef),
      approvalSignature,
      status,
      createdAt,
      expiresAt,
      evidenceRefs: evidenceRefs.map(normalizeRelativePath),
      maxUses,
      rationale,
    });
  }
  return {
    ledger: {
      schemaVersion:
        typeof rawLedger.schemaVersion === "string"
          ? rawLedger.schemaVersion
          : SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
      generatedAt:
        typeof rawLedger.generatedAt === "string"
          ? rawLedger.generatedAt
          : "unknown",
      policy: typeof rawLedger.policy === "string" ? rawLedger.policy : "",
      waivers: parsedWaivers,
    },
    findings,
  };
}

function isExpired(expiresAt: string, now: string): boolean {
  const expires = Date.parse(expiresAt);
  const current = Date.parse(now);
  if (!Number.isFinite(expires) || !Number.isFinite(current)) {
    return true;
  }
  return expires < current;
}

function waiverLifetimeDays(
  createdAt: string,
  expiresAt: string
): number | null {
  const created = Date.parse(createdAt);
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(created) || !Number.isFinite(expires) || expires < created) {
    return null;
  }
  return Math.ceil((expires - created) / 86_400_000);
}

function evidenceExists(workspacePath: string, evidenceRef: string): boolean {
  const normalized = normalizeRelativePath(evidenceRef);
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return false;
  }
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return false;
  }
  try {
    resolveContainedExistingFile(workspacePath, normalized);
    return true;
  } catch {
    return false;
  }
}

function fileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function evidenceHash(workspacePath: string, evidenceRef: string): {
  ref: string;
  hash: string | null;
  errors: string[];
} {
  const normalized = normalizeRelativePath(evidenceRef);
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return {
      ref: normalized,
      hash: null,
      errors: [`Evidence ref must be workspace-contained, not a URL: ${normalized}`],
    };
  }
  try {
    const resolved = resolveContainedExistingFile(workspacePath, normalized);
    return {
      ref: resolved.relativePath,
      hash: fileHash(fs.readFileSync(resolved.fullPath)),
      errors: [],
    };
  } catch (error) {
    return {
      ref: normalized,
      hash: null,
      errors: [
        `Evidence ref is missing or unsafe: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

export function buildWaiverApprovalEvidenceDigest(
  workspacePath: string,
  waiver: Pick<
    ArchitectureWaiverLedgerEntry,
    "approvalRef" | "evidenceRefs"
  >
): {
  approvalEvidenceHash: string | null;
  evidenceRefHashes: Array<{ ref: string; sha256: string }>;
  errors: string[];
} {
  const approval = evidenceHash(workspacePath, waiver.approvalRef);
  const evidenceRefs = waiver.evidenceRefs.map((ref) => evidenceHash(workspacePath, ref));
  return {
    approvalEvidenceHash: approval.hash,
    evidenceRefHashes: evidenceRefs
      .filter((item): item is { ref: string; hash: string; errors: string[] } => item.hash != null)
      .map((item) => ({ ref: item.ref, sha256: item.hash })),
    errors: [
      ...approval.errors.map((error) => `approvalRef: ${error}`),
      ...evidenceRefs.flatMap((item) =>
        item.errors.map((error) => `${item.ref}: ${error}`)
      ),
    ],
  };
}

export function buildWaiverApprovalPayload(
  waiver: ArchitectureWaiverLedgerEntry,
  evidenceDigest: {
    approvalEvidenceHash: string | null;
    evidenceRefHashes: Array<{ ref: string; sha256: string }>;
  }
): GovernanceApprovalPayload {
  return {
    purpose: "architecture-waiver-approval",
    subject: {
      id: waiver.id,
      ruleId: waiver.ruleId,
      edgeFingerprint: waiver.edgeFingerprint,
      owner: waiver.owner,
      approvedBy: waiver.approvedBy,
      approvalRef: waiver.approvalRef,
      approvalEvidenceHash: evidenceDigest.approvalEvidenceHash,
      approvalEvidenceRefs: evidenceDigest.evidenceRefHashes,
      status: waiver.status,
      createdAt: waiver.createdAt,
      expiresAt: waiver.expiresAt,
      evidenceRefs: waiver.evidenceRefs,
      maxUses: waiver.maxUses,
      rationale: waiver.rationale,
    },
  };
}

export function buildWaiverRevocationPayload(
  revocation: WaiverRevocationEntry
): GovernanceApprovalPayload {
  return {
    purpose: "architecture-waiver-revocation",
    subject: {
      id: revocation.id,
      waiverId: revocation.waiverId,
      ruleId: revocation.ruleId,
      edgeFingerprint: revocation.edgeFingerprint,
      revokedBy: revocation.revokedBy,
      revokedAt: revocation.revokedAt,
      reason: revocation.reason,
    },
  };
}

function findMatchingViolation(
  violations: ReturnType<typeof validateSemanticGovernance>["violations"],
  waiver: ArchitectureWaiverLedgerEntry
) {
  return violations.find(
    (violation) =>
      violation.ruleId === waiver.ruleId &&
      violation.fingerprint === waiver.edgeFingerprint
  );
}

function waiverRevocationKey(
  waiverId: string,
  ruleId: string | null,
  edgeFingerprint: string | null
): string {
  return `${waiverId}|${ruleId ?? ""}|${edgeFingerprint ?? ""}`;
}

function finding(params: Omit<WaiverValidationFinding, "id">): WaiverValidationFinding {
  const fingerprint = [
    params.status,
    params.waiverId,
    params.ruleId,
    params.edgeFingerprint,
    params.sourcePath,
    params.line,
    params.message,
  ].join("|");
  return {
    id: `waiver-finding:${Buffer.from(fingerprint).toString("base64url").slice(0, 20)}`,
    ...params,
  };
}

function parseSourceWaiverReferences(workspacePath: string, maxFiles: number): SourceWaiverReference[] {
  const references: SourceWaiverReference[] = [];
  const waiverPattern = /(?:semantic-waiver|architecture-waiver|waiver-id)\s*:\s*([A-Za-z0-9._:-]+)/i;
  const selfAuthorizationPattern =
    /\b(allow|allowed|approve|approved|ignore|skip|bypass|override)\b/i;
  const evidencePattern = /evidence\s*:\s*([^\s]+)/i;
  for (const fullPath of collectSourceFiles(workspacePath, maxFiles)) {
    const sourcePath = relativeToWorkspace(workspacePath, fullPath);
    const lines = fs.readFileSync(fullPath, "utf-8").split(/\r?\n/);
    lines.forEach((lineText, index) => {
      const match = waiverPattern.exec(lineText);
      if (!match) {
        return;
      }
      const evidenceMatch = evidencePattern.exec(lineText);
      const evidenceRefs = evidenceMatch ? [normalizeRelativePath(evidenceMatch[1])] : [];
      references.push({
        id: `source-waiver:${sourcePath}:${index + 1}`,
        waiverId: match[1],
        sourcePath,
        line: index + 1,
        rawText: lineText.trim(),
        selfAuthorizing: selfAuthorizationPattern.test(lineText),
        evidenceRefs,
      });
    });
  }
  return references.sort((left, right) =>
    `${left.sourcePath}:${left.line}`.localeCompare(`${right.sourcePath}:${right.line}`)
  );
}

export function validateArchitectureWaivers(
  options: ValidateArchitectureWaiversOptions
): WaiverValidationResult {
  if (!path.isAbsolute(options.workspacePath)) {
    throw new Error("workspacePath must be absolute");
  }
  const workspacePath = fs.realpathSync.native(options.workspacePath);
  const now = options.now ?? nowIso();
  const evaluation = validateSemanticGovernance(options);
  const bypassPolicy = evaluation.policy.bypassPolicy;
  const ledgerResult = parseWaiverLedger(workspacePath);
  const revocationResult = parseWaiverRevocations(workspacePath);
  const revocationAnchor = loadAnchoredWaiverRevocations(workspacePath);
  const ledger = ledgerResult.ledger;
  const sourceReferences = parseSourceWaiverReferences(
    workspacePath,
    Math.max(1, Math.min(options.maxFiles ?? 500, 5000))
  );
  const findings: WaiverValidationFinding[] = [
    ...ledgerResult.findings,
    ...revocationResult.findings,
  ];
  const blockedWaiverIds = new Set(
    findings
      .filter((current) => current.severity === "block" && current.waiverId != null)
      .map((current) => current.waiverId as string)
  );
  function addFinding(current: WaiverValidationFinding): void {
    findings.push(current);
    if (current.severity === "block" && current.waiverId != null) {
      blockedWaiverIds.add(current.waiverId);
    }
  }
  if (
    ledger.waivers.length > 0 &&
    revocationResult.findings.some(
      (current) =>
        current.status === "missing-evidence" &&
        current.evidenceRefs.includes(WAIVER_REVOCATION_LEDGER_RELATIVE_PATH)
    )
  ) {
    addFinding(
      finding({
        status: "missing-evidence",
        severity: "block",
        waiverId: null,
        ruleId: null,
        edgeFingerprint: null,
        sourcePath: null,
        line: null,
        message:
          "Waiver revocation ledger is required whenever waiver entries exist; active waiver replay protection must fail closed.",
        evidenceRefs: [WAIVER_REVOCATION_LEDGER_RELATIVE_PATH],
      })
    );
  }
  if (ledger.waivers.length > 0 && !revocationAnchor.available) {
    addFinding(
      finding({
        status: "missing-evidence",
        severity: "block",
        waiverId: null,
        ruleId: null,
        edgeFingerprint: null,
        sourcePath: null,
        line: null,
        message:
          "Active waiver ledgers require the waiver revocation ledger to be anchored in git history; otherwise revoked waiver receipts can be rolled back or deleted.",
        evidenceRefs: [WAIVER_REVOCATION_LEDGER_RELATIVE_PATH],
      })
    );
  }
  const referencesByWaiver = new Map<string, SourceWaiverReference[]>();
  for (const reference of sourceReferences) {
    referencesByWaiver.set(reference.waiverId, [
      ...(referencesByWaiver.get(reference.waiverId) ?? []),
      reference,
    ]);
    if (reference.selfAuthorizing) {
      addFinding(
        finding({
          status: "self-authorizing-comment",
          severity: "block",
          waiverId: reference.waiverId,
          ruleId: null,
          edgeFingerprint: null,
          sourcePath: reference.sourcePath,
          line: reference.line,
          message:
            "Source comments may reference waiver ids only; they cannot approve, bypass, skip, or override governance.",
          evidenceRefs: [reference.sourcePath],
        })
      );
    }
  }

  const waiverIds = new Set(ledger.waivers.map((waiver) => waiver.id));
  for (const reference of sourceReferences) {
    if (!waiverIds.has(reference.waiverId)) {
      addFinding(
        finding({
          status: "unknown-reference",
          severity: "block",
          waiverId: reference.waiverId,
          ruleId: null,
          edgeFingerprint: null,
          sourcePath: reference.sourcePath,
          line: reference.line,
          message: `Source references unknown waiver ${reference.waiverId}.`,
          evidenceRefs: [reference.sourcePath, WAIVER_LEDGER_RELATIVE_PATH],
        })
      );
    }
  }

  const activeWaiverIds = new Set(
    ledger.waivers
      .filter(
        (waiver) =>
          waiver.status === "active" &&
          !isExpired(waiver.expiresAt, now)
      )
      .map((waiver) => waiver.id)
  );
  const activeWaiversByFile = new Map<string, Set<string>>();
  for (const reference of sourceReferences) {
    if (!activeWaiverIds.has(reference.waiverId)) {
      continue;
    }
    const current = activeWaiversByFile.get(reference.sourcePath) ?? new Set<string>();
    current.add(reference.waiverId);
    activeWaiversByFile.set(reference.sourcePath, current);
  }
  for (const [sourcePath, activeIds] of activeWaiversByFile) {
    if (activeIds.size > bypassPolicy.maxActivePerFile) {
      for (const waiverId of activeIds) {
        addFinding(
          finding({
            status: "invalid",
            severity: "block",
            waiverId,
            ruleId: null,
            edgeFingerprint: null,
            sourcePath,
            line: null,
            message: `Source file ${sourcePath} references ${activeIds.size} active waivers but policy maxActivePerFile is ${bypassPolicy.maxActivePerFile}.`,
            evidenceRefs: [sourcePath, WAIVER_LEDGER_RELATIVE_PATH],
          })
        );
      }
    }
  }

  const validRevocations = new Map<string, WaiverRevocationEntry>();
  for (const revocation of revocationResult.revocations) {
    const verification = verifyGovernanceApprovalSignature({
      workspacePath,
      approvedBy: revocation.revokedBy,
      approvalSignature: revocation.revocationSignature,
      payload: buildWaiverRevocationPayload(revocation),
    });
    if (verification.valid) {
      validRevocations.set(
        waiverRevocationKey(
          revocation.waiverId,
          revocation.ruleId,
          revocation.edgeFingerprint
        ),
        revocation
      );
    } else {
      addFinding(
        finding({
          status: "invalid",
          severity: "block",
          waiverId: revocation.waiverId || null,
          ruleId: revocation.ruleId || null,
          edgeFingerprint: revocation.edgeFingerprint || null,
          sourcePath: null,
          line: null,
          message: `Waiver revocation ${revocation.id || revocation.waiverId} trusted signature is invalid: ${verification.errors.join("; ")}.`,
          evidenceRefs: [
            WAIVER_REVOCATION_LEDGER_RELATIVE_PATH,
            ...verification.sourceRefs,
          ],
        })
      );
    }
  }
  const anchoredRevocations = new Map<
    string,
    { revocation: WaiverRevocationEntry; sourceRefs: string[] }
  >();
  for (const { revocation, sourceRef } of revocationAnchor.revocations) {
    const verification = verifyGovernanceApprovalSignature({
      workspacePath,
      approvedBy: revocation.revokedBy,
      approvalSignature: revocation.revocationSignature,
      payload: buildWaiverRevocationPayload(revocation),
    });
    if (!verification.valid) {
      continue;
    }
    const key = waiverRevocationKey(
      revocation.waiverId,
      revocation.ruleId,
      revocation.edgeFingerprint
    );
    const current = anchoredRevocations.get(key);
    if (current == null) {
      anchoredRevocations.set(key, { revocation, sourceRefs: [sourceRef] });
    } else if (!current.sourceRefs.includes(sourceRef)) {
      current.sourceRefs.push(sourceRef);
    }
  }
  for (const [key, anchored] of anchoredRevocations) {
    if (validRevocations.has(key)) {
      continue;
    }
    addFinding(
      finding({
        status: "invalid",
        severity: "block",
        waiverId: anchored.revocation.waiverId,
        ruleId: anchored.revocation.ruleId,
        edgeFingerprint: anchored.revocation.edgeFingerprint,
        sourcePath: null,
        line: null,
        message: `Previously anchored signed waiver revocation ${anchored.revocation.id} is absent from the current revocation ledger; revocation receipts are append-only and cannot be rolled back or deleted.`,
        evidenceRefs: [
          WAIVER_REVOCATION_LEDGER_RELATIVE_PATH,
          ...anchored.sourceRefs,
        ],
      })
    );
  }

  for (const waiver of ledger.waivers) {
    const matchingViolation = findMatchingViolation(evaluation.violations, waiver);
    const matchingRuleViolation = evaluation.violations.find(
      (violation) => violation.ruleId === waiver.ruleId
    );
    const matchingFingerprintViolation = evaluation.violations.find(
      (violation) => violation.fingerprint === waiver.edgeFingerprint
    );
    const uses = referencesByWaiver.get(waiver.id) ?? [];
    const signedRevocation = validRevocations.get(
      waiverRevocationKey(waiver.id, waiver.ruleId, waiver.edgeFingerprint)
    );
    const missingEvidence = waiver.evidenceRefs.filter(
      (evidenceRef) => !evidenceExists(workspacePath, evidenceRef)
    );
    const evidenceDigest = buildWaiverApprovalEvidenceDigest(workspacePath, waiver);
    const approvalEvidenceMissing = !evidenceExists(workspacePath, waiver.approvalRef);
    const approval = verifyGovernanceApprovalSignature({
      workspacePath,
      approvedBy: waiver.approvedBy,
      approvalSignature: waiver.approvalSignature,
      payload: buildWaiverApprovalPayload(waiver, evidenceDigest),
    });
    const lifetimeDays = waiverLifetimeDays(waiver.createdAt, waiver.expiresAt);
    if (waiver.status !== "active" || isExpired(waiver.expiresAt, now)) {
      addFinding(
        finding({
          status: "expired",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? null,
          line: uses[0]?.line ?? null,
          message: `Waiver ${waiver.id} is not active or has expired.`,
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH, ...waiver.evidenceRefs],
        })
      );
      continue;
    }
    if (signedRevocation != null && signedRevocation.waiverId === waiver.id) {
      addFinding(
        finding({
          status: "invalid",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? null,
          line: uses[0]?.line ?? null,
          message: `Waiver ${waiver.id} has a trusted signed revocation ${signedRevocation.id}; active approval signatures cannot override revocation receipts.`,
          evidenceRefs: [
            WAIVER_LEDGER_RELATIVE_PATH,
            WAIVER_REVOCATION_LEDGER_RELATIVE_PATH,
          ],
        })
      );
    }
    if (lifetimeDays == null || lifetimeDays > bypassPolicy.ttlDays) {
      addFinding(
        finding({
          status: "invalid",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? null,
          line: uses[0]?.line ?? null,
          message:
            lifetimeDays == null
              ? `Waiver ${waiver.id} has invalid createdAt/expiresAt ordering.`
              : `Waiver ${waiver.id} lifetime is ${lifetimeDays} days but policy ttlDays is ${bypassPolicy.ttlDays}.`,
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH, ...waiver.evidenceRefs],
        })
      );
    }
    if (missingEvidence.length > 0) {
      addFinding(
        finding({
          status: "missing-evidence",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? null,
          line: uses[0]?.line ?? null,
          message: `Waiver ${waiver.id} references missing evidence: ${missingEvidence.join(", ")}.`,
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH, ...waiver.evidenceRefs],
        })
      );
    }
    if (approvalEvidenceMissing) {
      addFinding(
        finding({
          status: "missing-evidence",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? null,
          line: uses[0]?.line ?? null,
          message: `Waiver ${waiver.id} approvalRef is missing or unsafe: ${waiver.approvalRef}.`,
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH, waiver.approvalRef],
        })
      );
    }
    if (!approval.valid) {
      addFinding(
        finding({
          status: "invalid",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? null,
          line: uses[0]?.line ?? null,
          message: `Waiver ${waiver.id} trusted approval signature is invalid: ${approval.errors.join("; ")}.`,
          evidenceRefs: [
            WAIVER_LEDGER_RELATIVE_PATH,
            waiver.approvalRef,
            ...approval.sourceRefs,
          ],
        })
      );
    }
    if (evidenceDigest.errors.length > 0) {
      addFinding(
        finding({
          status: "missing-evidence",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? null,
          line: uses[0]?.line ?? null,
          message: `Waiver ${waiver.id} evidence hash binding failed: ${evidenceDigest.errors.join("; ")}.`,
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH, waiver.approvalRef, ...waiver.evidenceRefs],
        })
      );
    }
    if (matchingViolation == null) {
      addFinding(
        finding({
          status:
            matchingRuleViolation != null
              ? "fingerprint-mismatch"
              : matchingFingerprintViolation != null
                ? "rule-mismatch"
                : "unused",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? null,
          line: uses[0]?.line ?? null,
          message: `Waiver ${waiver.id} does not match an active violation by both rule id and exact edge fingerprint.`,
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH, ...waiver.evidenceRefs],
        })
      );
    }
    if (uses.length === 0) {
      addFinding(
        finding({
          status: "invalid",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: matchingViolation?.sourcePath ?? null,
          line: matchingViolation?.line ?? null,
          message: `Waiver ${waiver.id} must be referenced by a source comment on the violating file; ledger-only waivers are not active.`,
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH, ...waiver.evidenceRefs],
        })
      );
    }
    if (
      matchingViolation != null &&
      uses.length > 0 &&
      !uses.some((use) => use.sourcePath === matchingViolation.sourcePath)
    ) {
      addFinding(
        finding({
          status: "invalid",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? null,
          line: uses[0]?.line ?? null,
          message: `Waiver ${waiver.id} must be referenced from ${matchingViolation.sourcePath}, the file that owns the waived violation.`,
          evidenceRefs: [
            WAIVER_LEDGER_RELATIVE_PATH,
            ...waiver.evidenceRefs,
            ...uses.map((use) => use.sourcePath),
          ],
        })
      );
    }
    if (uses.length > waiver.maxUses) {
      addFinding(
        finding({
          status: "invalid",
          severity: "block",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? null,
          line: uses[0]?.line ?? null,
          message: `Waiver ${waiver.id} is referenced ${uses.length} times but maxUses is ${waiver.maxUses}.`,
          evidenceRefs: [WAIVER_LEDGER_RELATIVE_PATH, ...uses.map((use) => use.sourcePath)],
        })
      );
    }
    if (
      matchingViolation != null &&
      missingEvidence.length === 0 &&
      !approvalEvidenceMissing &&
      evidenceDigest.errors.length === 0 &&
      approval.valid &&
      signedRevocation == null &&
      waiver.status === "active" &&
      !isExpired(waiver.expiresAt, now) &&
      uses.length > 0 &&
      uses.some((use) => use.sourcePath === matchingViolation.sourcePath) &&
      uses.length <= waiver.maxUses &&
      lifetimeDays != null &&
      lifetimeDays <= bypassPolicy.ttlDays &&
      !blockedWaiverIds.has(waiver.id)
    ) {
      addFinding(
        finding({
          status: "valid",
          severity: "info",
          waiverId: waiver.id,
          ruleId: waiver.ruleId,
          edgeFingerprint: waiver.edgeFingerprint,
          sourcePath: uses[0]?.sourcePath ?? matchingViolation.sourcePath,
          line: uses[0]?.line ?? matchingViolation.line,
          message: `Waiver ${waiver.id} matches ${waiver.ruleId} and exact edge fingerprint.`,
          evidenceRefs: [
            WAIVER_LEDGER_RELATIVE_PATH,
            ...waiver.evidenceRefs,
            matchingViolation.sourcePath,
          ],
        })
      );
    }
  }

  findings.sort((left, right) =>
    `${left.severity}:${left.waiverId}:${left.status}:${left.sourcePath}:${left.line}`.localeCompare(
      `${right.severity}:${right.waiverId}:${right.status}:${right.sourcePath}:${right.line}`
    )
  );
  const blockedFindings = findings.filter((current) => current.severity === "block");
  const warningFindings = findings.filter((current) => current.severity === "warn");
  const validWaivers = new Set(
    findings
      .filter((current) => current.status === "valid")
      .map((current) => current.waiverId)
      .filter((waiverId): waiverId is string => waiverId != null)
  );
  const verdict = blockedFindings.length > 0 ? "block" : warningFindings.length > 0 ? "warn" : "allow";
  return {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: nowIso(),
    verdict,
    summary: [
      `Waiver governance verdict: ${verdict}`,
      `Waivers: ${ledger.waivers.length}`,
      `Source references: ${sourceReferences.length}`,
      `Valid waivers: ${validWaivers.size}`,
      `Blocked findings: ${blockedFindings.length}`,
      `Warning findings: ${warningFindings.length}`,
    ].join("\n"),
    ledgerPath: WAIVER_LEDGER_RELATIVE_PATH,
    sourceReferences,
    findings,
    metrics: {
      waivers: ledger.waivers.length,
      sourceReferences: sourceReferences.length,
      validWaivers: validWaivers.size,
      blockedFindings: blockedFindings.length,
      warningFindings: warningFindings.length,
    },
  };
}
