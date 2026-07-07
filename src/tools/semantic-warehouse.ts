import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
  type ArchitectureProfileId,
  type SemanticGovernanceEvaluation,
} from "../data/ontology-contract.js";
import {
  validateSemanticGovernance,
  type ValidateSemanticGovernanceOptions,
} from "./semantic-governance.js";

export const SEMANTIC_WAREHOUSE_VIEW_NAMES = [
  "files",
  "symbols",
  "dependencyEdges",
  "rules",
  "violations",
  "evidenceRefs",
  "waivers",
  "claims",
  "completedFacts",
] as const;

export type SemanticWarehouseViewName =
  (typeof SEMANTIC_WAREHOUSE_VIEW_NAMES)[number];

export const SEMANTIC_WAREHOUSE_QUERY_IDS = [
  "list_views",
  "rules_blocking_file",
  "evidence_for_waiver",
  "dependency_edges_for_file",
  "violations_by_rule",
  "claims_for_evidence",
  "completed_facts",
] as const;

export type SemanticWarehouseQueryId =
  (typeof SEMANTIC_WAREHOUSE_QUERY_IDS)[number];

export interface SemanticWarehouseRow {
  id: string;
  rowType: string;
  sourceRefs: string[];
  provenance: {
    source: string;
    sourceRefs: string[];
  };
  [key: string]: unknown;
}

export type SemanticWarehouseViews = Record<
  SemanticWarehouseViewName,
  SemanticWarehouseRow[]
>;

export interface BuildSemanticWarehouseOptions
  extends ValidateSemanticGovernanceOptions {}

export interface SemanticWarehouseSnapshot {
  schemaVersion: string;
  profileId: ArchitectureProfileId;
  verdict: SemanticGovernanceEvaluation["verdict"];
  snapshotHash: string;
  views: SemanticWarehouseViews;
  viewSummaries: Array<{
    view: SemanticWarehouseViewName;
    rowCount: number;
  }>;
  warnings: string[];
}

export interface QuerySemanticWarehouseOptions
  extends BuildSemanticWarehouseOptions {
  queryId: SemanticWarehouseQueryId;
  targetPath?: string;
  ruleId?: string;
  waiverId?: string;
  evidenceRef?: string;
  limit?: number;
}

export interface SemanticWarehouseQueryResult {
  schemaVersion: string;
  queryId: SemanticWarehouseQueryId;
  profileId: ArchitectureProfileId;
  snapshotHash: string;
  rows: SemanticWarehouseRow[];
  rowCount: number;
  truncated: boolean;
  warnings: string[];
  sourceRefs: string[];
}

function stableHash(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function stableId(prefix: string, value: unknown): string {
  return `${prefix}:${stableHash(value).slice(0, 16)}`;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .map(normalizeRelativePath)
    .sort();
}

function row(
  id: string,
  rowType: string,
  sourceRefs: string[],
  source: string,
  fields: Record<string, unknown>
): SemanticWarehouseRow {
  const refs = uniqueSorted(sourceRefs);
  return {
    id,
    rowType,
    ...fields,
    sourceRefs: refs,
    provenance: {
      source,
      sourceRefs: refs,
    },
  };
}

function sortRows(rows: SemanticWarehouseRow[]): SemanticWarehouseRow[] {
  return [...rows].sort((left, right) => left.id.localeCompare(right.id));
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

function collectWaiverRows(workspacePath: string): SemanticWarehouseRow[] {
  const ledgerRelativePath = "docs/ai-harness/ontology/state/bypass-ledger.json";
  const ledgerPath = path.join(workspacePath, ledgerRelativePath);
  const ledger = readJsonIfExists<Record<string, unknown>>(ledgerPath);
  const waivers = Array.isArray(ledger?.waivers) ? ledger.waivers : [];
  return waivers
    .filter(isPlainObject)
    .map((waiver, index) => {
      const waiverId =
        typeof waiver.id === "string"
          ? waiver.id
          : typeof waiver.waiverId === "string"
            ? waiver.waiverId
            : `waiver-${String(index + 1).padStart(3, "0")}`;
      const evidenceRefs = uniqueSorted([
        ...asStringArray(waiver.evidenceRefs),
        ...asStringArray(waiver.evidenceRef),
        ...asStringArray(waiver.evidence),
      ]);
      return row(
        `waiver:${waiverId}`,
        "waiver",
        [ledgerRelativePath, ...evidenceRefs],
        ledgerRelativePath,
        {
          waiverId,
          ruleId: typeof waiver.ruleId === "string" ? waiver.ruleId : null,
          edgeFingerprint:
            typeof waiver.edgeFingerprint === "string"
              ? waiver.edgeFingerprint
              : null,
          owner: typeof waiver.owner === "string" ? waiver.owner : null,
          expiresAt: typeof waiver.expiresAt === "string" ? waiver.expiresAt : null,
          status: typeof waiver.status === "string" ? waiver.status : "unknown",
          evidenceRefs,
        }
      );
    });
}

function collectClaimRows(workspacePath: string): SemanticWarehouseRow[] {
  const stateRelativePath = "docs/ai-harness/dashboard/state/dashboard-state.json";
  const statePath = path.join(workspacePath, stateRelativePath);
  const state = readJsonIfExists<Record<string, unknown>>(statePath);
  const matrix = isPlainObject(state?.claimEvidenceMatrix)
    ? state.claimEvidenceMatrix
    : null;
  const claims = Array.isArray(matrix?.claims) ? matrix.claims : [];
  const missingEvidenceItems = Array.isArray(matrix?.missingEvidenceItems)
    ? matrix.missingEvidenceItems
    : [];
  const claimRows = claims.filter(isPlainObject).map((claim, index) => {
    const claimId =
      typeof claim.claimId === "string"
        ? claim.claimId
        : typeof claim.id === "string"
          ? claim.id
          : `claim-${String(index + 1).padStart(3, "0")}`;
    return row(`claim:${claimId}`, "claim", [stateRelativePath], stateRelativePath, {
      claimId,
      statement: typeof claim.statement === "string" ? claim.statement : null,
      evidenceRefs: uniqueSorted(asStringArray(claim.evidenceRefs)),
      falsificationTests: Array.isArray(claim.falsificationTests)
        ? claim.falsificationTests
        : [],
    });
  });
  const missingRows = missingEvidenceItems.filter(isPlainObject).map((item, index) => {
    const evidenceId =
      typeof item.id === "string"
        ? item.id
        : `missing-evidence-${String(index + 1).padStart(3, "0")}`;
    return row(
      `missing-evidence:${evidenceId}`,
      "missingEvidence",
      [stateRelativePath, ...asStringArray(item.evidenceRefs)],
      stateRelativePath,
      {
        evidenceId,
        label: typeof item.label === "string" ? item.label : null,
        blocksClaimIds: asStringArray(item.blocksClaimIds),
        owner: typeof item.owner === "string" ? item.owner : null,
        requiredEvidenceType:
          typeof item.requiredEvidenceType === "string"
            ? item.requiredEvidenceType
            : null,
      }
    );
  });
  return [...claimRows, ...missingRows];
}

function collectCompletedFactRows(workspacePath: string): SemanticWarehouseRow[] {
  const stateRelativePath = "docs/ai-harness/dashboard/state/dashboard-state.json";
  const statePath = path.join(workspacePath, stateRelativePath);
  const state = readJsonIfExists<Record<string, unknown>>(statePath);
  const rows: SemanticWarehouseRow[] = [];
  const taskQueues = isPlainObject(state?.taskQueues) ? state.taskQueues : null;
  for (const taskId of asStringArray(taskQueues?.completed)) {
    rows.push(
      row(`completed-task:${taskId}`, "completedTask", [stateRelativePath], stateRelativePath, {
        factId: taskId,
        status: "completed",
        factSource: "taskQueues.completed",
      })
    );
  }
  const governedSessions = Array.isArray(state?.governedSessions)
    ? state.governedSessions
    : [];
  for (const session of governedSessions.filter(isPlainObject)) {
    const sessionId = typeof session.id === "string" ? session.id : null;
    const traceIntegrity = isPlainObject(session.traceIntegrity)
      ? session.traceIntegrity
      : null;
    if (sessionId && traceIntegrity?.status === "complete") {
      rows.push(
        row(
          `completed-session:${sessionId}`,
          "completedSessionTrace",
          [stateRelativePath],
          stateRelativePath,
          {
            factId: sessionId,
            status: "complete",
            factSource: "governedSessions.traceIntegrity",
          }
        )
      );
    }
  }
  return rows;
}

function buildEvidenceRows(views: Omit<SemanticWarehouseViews, "evidenceRefs">): SemanticWarehouseRow[] {
  const byRef = new Map<string, Set<string>>();
  for (const rows of Object.values(views)) {
    for (const currentRow of rows) {
      for (const ref of currentRow.sourceRefs) {
        if (!byRef.has(ref)) {
          byRef.set(ref, new Set());
        }
        byRef.get(ref)?.add(currentRow.id);
      }
      const evidenceRefs = asStringArray(currentRow.evidenceRefs);
      for (const ref of evidenceRefs) {
        const normalized = normalizeRelativePath(ref);
        if (!byRef.has(normalized)) {
          byRef.set(normalized, new Set());
        }
        byRef.get(normalized)?.add(currentRow.id);
      }
    }
  }
  return [...byRef.entries()].map(([ref, usedBy]) =>
    row(stableId("evidence", ref), "evidenceRef", [ref], "semantic-warehouse", {
      ref,
      refKind:
        ref.startsWith(".github/") || ref.startsWith("docs/")
          ? "workspace-file"
          : ref.includes("/")
            ? "source-or-workspace-ref"
            : "symbolic-ref",
      usedByIds: [...usedBy].sort(),
    })
  );
}

export function buildSemanticWarehouse(
  options: BuildSemanticWarehouseOptions
): SemanticWarehouseSnapshot {
  const evaluation = validateSemanticGovernance(options);
  const workspacePath = fs.realpathSync.native(options.workspacePath);
  const files = evaluation.sourceGraph.files.map((file) =>
    row(`file:${file.path}`, "file", [file.path], "source-graph", {
      path: file.path,
      layer: file.layer,
      language: file.language,
      declarationCount: file.declarations.length,
      importCount: file.imports.length,
    })
  );
  const symbols = evaluation.sourceGraph.files.flatMap((file) =>
    file.declarations.map((declaration) =>
      row(
        stableId("symbol", {
          path: file.path,
          name: declaration.name,
          line: declaration.line,
        }),
        "symbol",
        [file.path],
        "source-graph",
        {
          filePath: file.path,
          layer: file.layer,
          name: declaration.name,
          kind: declaration.kind,
          line: declaration.line,
        }
      )
    )
  );
  const dependencyEdges = evaluation.sourceGraph.edges.map((edge) =>
    row(edge.id, "dependencyEdge", [edge.fromPath, edge.toPath ?? edge.specifier], "source-graph", {
      fromPath: edge.fromPath,
      toPath: edge.toPath,
      fromLayer: edge.fromLayer,
      toLayer: edge.toLayer,
      specifier: edge.specifier,
      kind: edge.kind,
      line: edge.line,
      confidence: edge.confidence,
      fingerprint: edge.fingerprint,
    })
  );
  const rules = evaluation.policy.rules.map((ruleFact) =>
    row(`rule:${ruleFact.id}`, "rule", [".github/ai-harness/architecture-ontology.policy.json"], "ontology-policy", {
      ruleId: ruleFact.id,
      profileId: evaluation.profileId,
      predicate: ruleFact.predicate,
      sourceLayer: ruleFact.sourceLayer,
      targetLayer: ruleFact.targetLayer,
      severity: ruleFact.severity,
      rationale: ruleFact.rationale,
      suggestedPath: ruleFact.suggestedPath ?? [],
    })
  );
  const violations = [...evaluation.violations, ...evaluation.warnings].map((violation) =>
    row(violation.id, "violation", violation.evidenceRefs, "governance-evaluation", {
      violationId: violation.id,
      ruleId: violation.ruleId,
      severity: violation.severity,
      message: violation.message,
      sourcePath: violation.sourcePath,
      targetPath: violation.targetPath,
      sourceLayer: violation.sourceLayer,
      targetLayer: violation.targetLayer,
      edgeKind: violation.edgeKind,
      line: violation.line,
      fingerprint: violation.fingerprint,
      confidence: violation.confidence,
      suggestedAction: violation.suggestedAction,
      spatialSignature: violation.spatialSignature,
      evidenceRefs: violation.evidenceRefs,
    })
  );
  const waivers = collectWaiverRows(workspacePath);
  const claims = collectClaimRows(workspacePath);
  const completedFacts = collectCompletedFactRows(workspacePath);
  const withoutEvidence = {
    files: sortRows(files),
    symbols: sortRows(symbols),
    dependencyEdges: sortRows(dependencyEdges),
    rules: sortRows(rules),
    violations: sortRows(violations),
    waivers: sortRows(waivers),
    claims: sortRows(claims),
    completedFacts: sortRows(completedFacts),
  };
  const views: SemanticWarehouseViews = {
    ...withoutEvidence,
    evidenceRefs: sortRows(buildEvidenceRows(withoutEvidence)),
  };
  const viewSummaries = SEMANTIC_WAREHOUSE_VIEW_NAMES.map((viewName) => ({
    view: viewName,
    rowCount: views[viewName].length,
  }));
  const warnings = [
    ...evaluation.policyWarnings,
    ...(fs.existsSync(path.join(workspacePath, "docs/ai-harness/dashboard/state/dashboard-state.json"))
      ? []
      : ["Dashboard state was not found; claims and completedFacts views are empty."]),
  ].sort();
  const snapshotHash = stableHash({
    profileId: evaluation.profileId,
    verdict: evaluation.verdict,
    viewSummaries,
    views,
    warnings,
  });
  return {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    profileId: evaluation.profileId,
    verdict: evaluation.verdict,
    snapshotHash,
    views,
    viewSummaries,
    warnings,
  };
}

function collectSourceRefs(rows: SemanticWarehouseRow[]): string[] {
  return uniqueSorted(rows.flatMap((currentRow) => currentRow.sourceRefs));
}

function limitRows(
  rows: SemanticWarehouseRow[],
  limit: number
): { rows: SemanticWarehouseRow[]; truncated: boolean } {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  return {
    rows: rows.slice(0, safeLimit),
    truncated: rows.length > safeLimit,
  };
}

function queryRows(
  warehouse: SemanticWarehouseSnapshot,
  options: QuerySemanticWarehouseOptions
): SemanticWarehouseRow[] {
  const targetPath = options.targetPath
    ? normalizeRelativePath(options.targetPath)
    : undefined;
  switch (options.queryId) {
    case "list_views":
      return warehouse.viewSummaries.map((summary) =>
        row(`view:${summary.view}`, "viewSummary", [], "semantic-warehouse", summary)
      );
    case "rules_blocking_file": {
      if (!targetPath) {
        return [];
      }
      const fileRow = warehouse.views.files.find((file) => file.path === targetPath);
      const layer = typeof fileRow?.layer === "string" ? fileRow.layer : null;
      const violationRows = warehouse.views.violations.filter(
        (violation) =>
          violation.sourcePath === targetPath || violation.targetPath === targetPath
      );
      const violatedRuleIds = new Set(
        violationRows
          .map((violation) => violation.ruleId)
          .filter((ruleId): ruleId is string => typeof ruleId === "string")
      );
      const potentialRuleRows = warehouse.views.rules.filter(
        (ruleFact) =>
          ruleFact.predicate === "MUST_NOT_IMPORT" &&
          (ruleFact.sourceLayer === layer || ruleFact.sourceLayer === "*")
      );
      const matchedRuleRows = warehouse.views.rules.filter((ruleFact) =>
        violatedRuleIds.has(String(ruleFact.ruleId))
      );
      return sortRows([...violationRows, ...matchedRuleRows, ...potentialRuleRows]);
    }
    case "evidence_for_waiver": {
      if (!options.waiverId) {
        return [];
      }
      const waiverRow = warehouse.views.waivers.find(
        (waiver) =>
          waiver.waiverId === options.waiverId ||
          waiver.id === `waiver:${options.waiverId}`
      );
      if (!waiverRow) {
        return [];
      }
      const refs = new Set([
        ...waiverRow.sourceRefs,
        ...asStringArray(waiverRow.evidenceRefs),
      ]);
      const evidenceRows = warehouse.views.evidenceRefs.filter((evidence) =>
        refs.has(String(evidence.ref))
      );
      return sortRows([waiverRow, ...evidenceRows]);
    }
    case "dependency_edges_for_file":
      if (!targetPath) {
        return [];
      }
      return warehouse.views.dependencyEdges.filter(
        (edge) => edge.fromPath === targetPath || edge.toPath === targetPath
      );
    case "violations_by_rule":
      if (!options.ruleId) {
        return [];
      }
      return warehouse.views.violations.filter(
        (violation) => violation.ruleId === options.ruleId
      );
    case "claims_for_evidence":
      if (!options.evidenceRef) {
        return [];
      }
      return warehouse.views.claims.filter((claim) =>
        claim.sourceRefs.includes(normalizeRelativePath(options.evidenceRef ?? "")) ||
        asStringArray(claim.evidenceRefs).includes(options.evidenceRef ?? "") ||
        asStringArray(claim.blocksClaimIds).includes(options.evidenceRef ?? "")
      );
    case "completed_facts":
      return warehouse.views.completedFacts;
  }
}

export function querySemanticWarehouse(
  options: QuerySemanticWarehouseOptions
): SemanticWarehouseQueryResult {
  const warehouse = buildSemanticWarehouse(options);
  const rows = sortRows(queryRows(warehouse, options));
  const limited = limitRows(rows, options.limit ?? 100);
  return {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    queryId: options.queryId,
    profileId: warehouse.profileId,
    snapshotHash: warehouse.snapshotHash,
    rows: limited.rows,
    rowCount: rows.length,
    truncated: limited.truncated,
    warnings: warehouse.warnings,
    sourceRefs: collectSourceRefs(limited.rows),
  };
}
