/**
 * Strict validation helpers for the generated AI harness dashboard state.
 */

import { type ProjectType } from "../types.js";
import { DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS } from "../data/dashboard-state-contract.js";
import {
  getDashboardKpiProfile,
  inferDashboardDomainMode,
} from "../data/dashboard-profiles.js";

export interface DashboardStateValidationResult {
  valid: boolean;
  errors: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pushTypeError(
  errors: string[],
  fieldPath: string,
  expected: string,
  actual: unknown
): void {
  const actualType =
    actual === null
      ? "null"
      : Array.isArray(actual)
        ? "array"
        : typeof actual;
  errors.push(`${fieldPath} must be ${expected}; received ${actualType}`);
}

function requireObject(
  errors: string[],
  fieldPath: string,
  value: unknown
): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    pushTypeError(errors, fieldPath, "an object", value);
    return null;
  }

  return value;
}

function requireStringField(
  errors: string[],
  objectPath: string,
  objectValue: Record<string, unknown>,
  fieldName: string
): void {
  if (!isString(objectValue[fieldName])) {
    pushTypeError(errors, `${objectPath}.${fieldName}`, "a string", objectValue[fieldName]);
  }
}

function requireBooleanField(
  errors: string[],
  objectPath: string,
  objectValue: Record<string, unknown>,
  fieldName: string
): void {
  if (!isBoolean(objectValue[fieldName])) {
    pushTypeError(errors, `${objectPath}.${fieldName}`, "a boolean", objectValue[fieldName]);
  }
}

function requireNumberField(
  errors: string[],
  objectPath: string,
  objectValue: Record<string, unknown>,
  fieldName: string
): void {
  if (!isFiniteNumber(objectValue[fieldName])) {
    pushTypeError(errors, `${objectPath}.${fieldName}`, "a finite number", objectValue[fieldName]);
  }
}

function requireStringArrayField(
  errors: string[],
  objectPath: string,
  objectValue: Record<string, unknown>,
  fieldName: string
): void {
  const fieldValue = objectValue[fieldName];
  if (!Array.isArray(fieldValue) || fieldValue.some((entry) => !isString(entry))) {
    pushTypeError(errors, `${objectPath}.${fieldName}`, "an array of strings", fieldValue);
  }
}

function readStringArrayField(
  errors: string[],
  objectPath: string,
  objectValue: Record<string, unknown>,
  fieldName: string
): string[] {
  const fieldValue = objectValue[fieldName];
  if (!Array.isArray(fieldValue) || fieldValue.some((entry) => !isString(entry))) {
    pushTypeError(errors, `${objectPath}.${fieldName}`, "an array of strings", fieldValue);
    return [];
  }

  return fieldValue;
}

function requireArray(
  errors: string[],
  fieldPath: string,
  value: unknown
): unknown[] | null {
  if (!Array.isArray(value)) {
    pushTypeError(errors, fieldPath, "an array", value);
    return null;
  }

  return value;
}

function requireAllowedStringField(
  errors: string[],
  objectPath: string,
  objectValue: Record<string, unknown>,
  fieldName: string,
  allowedValues: string[]
): void {
  const value = objectValue[fieldName];
  requireStringField(errors, objectPath, objectValue, fieldName);
  if (isString(value) && !allowedValues.includes(value)) {
    errors.push(
      `${objectPath}.${fieldName} must be one of ${allowedValues.join(", ")}; received ${value}`
    );
  }
}

function requireUniqueStringId(
  errors: string[],
  seenIds: Set<string>,
  fieldPath: string,
  value: unknown
): string | null {
  if (!isString(value) || value.trim().length === 0) {
    pushTypeError(errors, fieldPath, "a non-empty string", value);
    return null;
  }
  if (seenIds.has(value)) {
    errors.push(`${fieldPath} must be unique; duplicate id ${value}`);
  }
  seenIds.add(value);
  return value;
}

function requireNonEmptyStringArrayField(
  errors: string[],
  objectPath: string,
  objectValue: Record<string, unknown>,
  fieldName: string
): string[] {
  const values = readStringArrayField(errors, objectPath, objectValue, fieldName);
  if (values.length === 0) {
    errors.push(`${objectPath}.${fieldName} must contain at least one entry`);
  }
  return values;
}

function backfillProjectionConfidence(root: Record<string, unknown>): void {
  if (isPlainObject(root.projectionConfidence)) {
    return;
  }
  const meta = isPlainObject(root.meta) ? root.meta : {};
  const evidence = isPlainObject(root.governanceEvidenceBrief)
    ? root.governanceEvidenceBrief
    : {};
  const trust = isPlainObject(root.trustBoundary) ? root.trustBoundary : {};
  const missingEvidenceClaims = Array.isArray(evidence.missingEvidenceClaims)
    ? evidence.missingEvidenceClaims
    : [];
  const unresolvedDecisions = Array.isArray(evidence.unresolvedDecisions)
    ? evidence.unresolvedDecisions
    : [];
  root.projectionConfidence = {
    schemaVersion: String(meta.schemaVersion || "legacy-backfill"),
    status: "projection-debt",
    completeness: String(meta.completeness || "legacy-backfill"),
    staleness: String(meta.staleness || "legacy-backfill"),
    trustBoundaryStatus: String(trust.status || "legacy-refresh-required"),
    missingEvidenceCount: missingEvidenceClaims.length,
    openDecisionCount: unresolvedDecisions.length,
    lastSuccessfulRefreshAt: null,
    lastSourceEventSequence: Number(meta.sourceEventSequence || 0),
    localListenerStatus: String(
      isPlainObject(root.listener) ? root.listener.status || "not-started" : "not-started"
    ),
    actionGate:
      "Run dashboard-ops refresh before treating this legacy projection as operational truth.",
    userMessage:
      "This dashboard state predates projection-confidence fields and was backfilled for safe validation.",
    requiredActions: [
      "Run dashboard-ops verify-projections",
      "Run dashboard-ops refresh",
      "Record a governed session with request/process/result trace",
    ],
    evidenceRefs: ["legacy-dashboard-state"],
  };
}

function backfillSessionTraceability(root: Record<string, unknown>): void {
  if (
    isPlainObject(root.sessionTraceability) &&
    Array.isArray(root.sessionTraceability.entries) &&
    root.sessionTraceability.entries.length > 0
  ) {
    return;
  }
  const workspace = isPlainObject(root.workspace) ? root.workspace : {};
  const purpose = String(workspace.purpose || "Recover legacy dashboard projection.");
  const workspaceName = String(workspace.name || workspace.id || "Legacy dashboard");
  const governedSessions = Array.isArray(root.governedSessions)
    ? root.governedSessions
    : [];
  const sessionLog = Array.isArray(root.sessionLog) ? root.sessionLog : [];
  const sourceSessions = governedSessions.length > 0 ? governedSessions : sessionLog;
  const entries = sourceSessions.length > 0
    ? sourceSessions.slice(0, 10).map((entry) => {
        const session = isPlainObject(entry) ? entry : {};
        const trace = isPlainObject(session.taskTrace) ? session.taskTrace : {};
        const evidenceRefs = Array.isArray(session.outputs)
          ? session.outputs.filter(isString)
          : ["legacy-dashboard-state"];
        return {
          sessionId: String(session.id || session.sessionId || "legacy-session"),
          title: String(session.title || session.goal || workspaceName),
          status: String(session.status || "legacy-backfill"),
          phase: String(session.phase || session.stage || "legacy-backfill"),
          originalRequest: String(trace.originalRequest || session.goal || purpose),
          processSummary: String(
            trace.processSummary ||
              session.note ||
              "Legacy dashboard session was backfilled; process summary was not recorded in the old projection."
          ),
          resultSummary: String(
            trace.resultSummary ||
              session.note ||
              "Legacy dashboard session requires refresh before result claims are trusted."
          ),
          traceIntegrity: {
            status: "legacy-fallback",
            missingFields: isPlainObject(session.taskTrace) ? [] : ["taskTrace"],
            source: "legacy-dashboard-state",
            warning:
              "Backfilled traceability keeps validation migration-safe but is not verified request/process/result evidence.",
          },
          residualRisk:
            "Legacy projection may not preserve full request/process/result trace until refreshed.",
          evidenceRefs,
          nextStep: String(
            session.nextStep || "Run dashboard-ops refresh and record the next governed session."
          ),
          recordedAt: String(session.endedAt || session.startedAt || "legacy-backfill"),
          source: "legacy-dashboard-state",
        };
      })
    : [
        {
          sessionId: "legacy-dashboard-state",
          title: workspaceName,
          status: "legacy-backfill",
          phase: "legacy-refresh-required",
          originalRequest: purpose,
          processSummary:
            "Legacy dashboard state was loaded without session traceability fields.",
          resultSummary:
            "Backfilled traceability enables validation and refresh, but real session trace evidence is still required.",
          traceIntegrity: {
            status: "legacy-fallback",
            missingFields: ["sessionTraceability"],
            source: "legacy-dashboard-state",
            warning: "No governed session trace was present in this legacy projection.",
          },
          residualRisk:
            "Legacy projection may not preserve full request/process/result trace until refreshed.",
          evidenceRefs: ["legacy-dashboard-state"],
          nextStep: "Run dashboard-ops refresh and start or resume a governed session.",
          recordedAt: "legacy-backfill",
          source: "legacy-dashboard-state",
        },
      ];
  root.sessionTraceability = {
    schemaVersion: String(
      isPlainObject(root.meta) ? root.meta.schemaVersion || "legacy-backfill" : "legacy-backfill"
    ),
    status: "trace-debt",
    purpose: "Backfilled compatibility projection for request/process/result traceability.",
    source: "legacy-dashboard-state",
    integrityPolicy:
      "Legacy backfills are migration aids only; refreshed governed sessions must record taskTrace directly.",
    entries,
  };
}

function backfillUserRealityCheck(root: Record<string, unknown>): void {
  if (isPlainObject(root.userRealityCheck)) {
    return;
  }
  const workspace = isPlainObject(root.workspace) ? root.workspace : {};
  const goalCompass = isPlainObject(root.goalCompass) ? root.goalCompass : {};
  const evidence = isPlainObject(root.governanceEvidenceBrief)
    ? root.governanceEvidenceBrief
    : {};
  const projectionConfidence = isPlainObject(root.projectionConfidence)
    ? root.projectionConfidence
    : {};
  const missingEvidenceClaims = Array.isArray(evidence.missingEvidenceClaims)
    ? evidence.missingEvidenceClaims.filter(isString)
    : [];
  const unresolvedDecisions = Array.isArray(evidence.unresolvedDecisions)
    ? evidence.unresolvedDecisions.filter(isString)
    : [];
  const nextSafeMove = String(
    goalCompass.nextSafeMove || "Run dashboard-ops refresh, verify projections, and record the next governed session."
  );

  root.userRealityCheck = {
    schemaVersion: String(
      isPlainObject(root.meta) ? root.meta.schemaVersion || "legacy-backfill" : "legacy-backfill"
    ),
    status: "legacy-backfill-action-plan",
    purpose:
      "Backfilled action plan so users can see reality, goal, risk, next action, evidence, progress, and API usefulness without raw JSON.",
    generatedAt: "legacy-backfill",
    summary: {
      currentReality: String(
        goalCompass.currentReality || "Legacy dashboard projection needs refresh."
      ),
      goalState: String(goalCompass.goalState || workspace.purpose || "Goal not declared."),
      progressState: "legacy-refresh-required",
      trustPosture: String(projectionConfidence.status || "projection-debt"),
      missingEvidenceCount: missingEvidenceClaims.length,
      openDecisionCount: unresolvedDecisions.length,
      activeDomainStressProfiles: [],
      readableWithoutRawJson: true,
    },
    answers: [
      {
        question: "What should happen next?",
        answer: nextSafeMove,
        sourceRefs: ["goalCompass", "projectionConfidence"],
        apiRoutes: ["/api/harness-dashboard/v1/reality-check"],
      },
    ],
    actionPlan: [
      {
        id: "action.legacy-refresh",
        rank: 1,
        title: "Refresh legacy dashboard reality",
        status: "refresh-required",
        owner: "harness-dashboard-operator",
        whyItMatters:
          "Legacy projections may not preserve current reality, evidence, or traceability contracts.",
        evidenceRequired: [
          "dashboard-ops verify-projections output",
          "dashboard-ops refresh output",
          "next governed session request/process/result trace",
        ],
        command: "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh",
        apiRoutes: ["/api/harness-dashboard/v1/reality-check", "/api/harness-dashboard/v1/traceability"],
        blocks: ["trusted-handoff", "operational-truth"],
        successSignal:
          "Projection confidence, session traceability, and evidence gaps are refreshed from current state.",
        sourceRefs: ["legacy-dashboard-state"],
      },
    ],
    evidenceMap: [
      {
        id: "legacy",
        label: "Legacy projection",
        sourceRefs: ["legacy-dashboard-state"],
        missingRefs: ["current-reality-refresh"],
        apiRoutes: ["/api/harness-dashboard/v1/reality-check"],
      },
    ],
    apiContract: {
      route: "/api/harness-dashboard/v1/reality-check",
      readOnly: true,
      usefulFor: ["legacy refresh orientation", "AI-agent resume"],
      queryExamples: ["/api/harness-dashboard/v1/query?scope=reality-check&q=refresh"],
      security: "Loopback-only, token-protected, no shell execution, no file writes, no LLM calls.",
    },
  };
}

export function validateDashboardStateShape(
  value: unknown
): DashboardStateValidationResult {
  const errors: string[] = [];
  const root = requireObject(errors, "dashboardState", value);

  if (root == null) {
    return { valid: false, errors };
  }

  backfillProjectionConfidence(root);
  backfillSessionTraceability(root);
  backfillUserRealityCheck(root);

  const requiredTopLevelKeys = DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS;

  for (const key of requiredTopLevelKeys) {
    if (!(key in root)) {
      errors.push(`dashboardState.${key} is required`);
    }
  }

  const meta = requireObject(errors, "dashboardState.meta", root.meta);
  if (meta != null) {
    requireStringField(errors, "dashboardState.meta", meta, "schemaVersion");
    requireStringField(errors, "dashboardState.meta", meta, "generatedBy");
    requireStringField(errors, "dashboardState.meta", meta, "dashboardDesignSystem");
    requireStringField(errors, "dashboardState.meta", meta, "refreshRule");
  }

  const workspace = requireObject(errors, "dashboardState.workspace", root.workspace);
  if (workspace != null) {
    requireStringField(errors, "dashboardState.workspace", workspace, "name");
    requireStringField(errors, "dashboardState.workspace", workspace, "purpose");
    requireStringField(errors, "dashboardState.workspace", workspace, "projectType");
    requireStringArrayField(errors, "dashboardState.workspace", workspace, "primaryDomains");
    requireStringArrayField(errors, "dashboardState.workspace", workspace, "techStack");
    requireStringArrayField(errors, "dashboardState.workspace", workspace, "targetIDEs");
    requireStringField(errors, "dashboardState.workspace", workspace, "harnessProfile");
    requireStringField(errors, "dashboardState.workspace", workspace, "governanceProfile");
    requireStringField(errors, "dashboardState.workspace", workspace, "autonomyMode");
    requireStringField(errors, "dashboardState.workspace", workspace, "tokenBudget");
    requireStringField(errors, "dashboardState.workspace", workspace, "domainStressProfile");
    requireStringField(errors, "dashboardState.workspace", workspace, "legacyAdoptionProfile");
  }

  const domainStress = requireObject(
    errors,
    "dashboardState.domainStress",
    root.domainStress
  );
  if (domainStress != null) {
    requireStringField(errors, "dashboardState.domainStress", domainStress, "schemaVersion");
    requireStringArrayField(errors, "dashboardState.domainStress", domainStress, "activeProfileIds");
    requireArray(errors, "dashboardState.domainStress.profiles", domainStress.profiles);
    requireArray(errors, "dashboardState.domainStress.claims", domainStress.claims);
    requireArray(
      errors,
      "dashboardState.domainStress.missingEvidenceItems",
      domainStress.missingEvidenceItems
    );
    requireArray(errors, "dashboardState.domainStress.workItems", domainStress.workItems);
    requireArray(
      errors,
      "dashboardState.domainStress.decisionContracts",
      domainStress.decisionContracts
    );
    requireArray(errors, "dashboardState.domainStress.hardGates", domainStress.hardGates);
    requireArray(
      errors,
      "dashboardState.domainStress.reportSections",
      domainStress.reportSections
    );
  }

  const domainOperations = requireObject(
    errors,
    "dashboardState.domainOperations",
    root.domainOperations
  );
  if (domainOperations != null) {
    requireStringField(errors, "dashboardState.domainOperations", domainOperations, "schemaVersion");
    requireStringArrayField(
      errors,
      "dashboardState.domainOperations",
      domainOperations,
      "activeProfileIds"
    );
    requireStringField(errors, "dashboardState.domainOperations", domainOperations, "status");
    requireArray(errors, "dashboardState.domainOperations.programs", domainOperations.programs);
  }

  const realityModel = requireObject(
    errors,
    "dashboardState.realityModel",
    root.realityModel
  );
  const realityNodeIds = new Set<string>();
  if (realityModel != null) {
    requireStringField(errors, "dashboardState.realityModel", realityModel, "schemaVersion");
    requireStringField(errors, "dashboardState.realityModel", realityModel, "purpose");
    const realityNodes =
      requireArray(errors, "dashboardState.realityModel.nodes", realityModel.nodes) ?? [];
    for (const [index, node] of realityNodes.entries()) {
      const pathPrefix = `dashboardState.realityModel.nodes[${index}]`;
      const item = requireObject(errors, pathPrefix, node);
      if (item == null) {
        continue;
      }
      requireUniqueStringId(errors, realityNodeIds, `${pathPrefix}.id`, item.id);
      requireStringField(errors, pathPrefix, item, "label");
      requireStringField(errors, pathPrefix, item, "type");
      requireStringField(errors, pathPrefix, item, "state");
      requireAllowedStringField(errors, pathPrefix, item, "confidence", ["low", "medium", "high"]);
      requireStringField(errors, pathPrefix, item, "owner");
      requireNonEmptyStringArrayField(errors, pathPrefix, item, "evidenceRefs");
      requireStringField(errors, pathPrefix, item, "freshness");
    }

    const realityEdgeIds = new Set<string>();
    const realityEdges =
      requireArray(errors, "dashboardState.realityModel.edges", realityModel.edges) ?? [];
    for (const [index, edge] of realityEdges.entries()) {
      const pathPrefix = `dashboardState.realityModel.edges[${index}]`;
      const item = requireObject(errors, pathPrefix, edge);
      if (item == null) {
        continue;
      }
      requireUniqueStringId(errors, realityEdgeIds, `${pathPrefix}.id`, item.id);
      requireStringField(errors, pathPrefix, item, "from");
      requireStringField(errors, pathPrefix, item, "to");
      requireStringField(errors, pathPrefix, item, "relation");
      requireStringField(errors, pathPrefix, item, "status");
      requireAllowedStringField(errors, pathPrefix, item, "confidence", ["low", "medium", "high"]);
      requireStringField(errors, pathPrefix, item, "owner");
      requireNonEmptyStringArrayField(errors, pathPrefix, item, "evidenceRefs");
      requireStringField(errors, pathPrefix, item, "freshness");
      if (isString(item.from) && !realityNodeIds.has(item.from)) {
        errors.push(`${pathPrefix}.from must reference an existing realityModel node`);
      }
      if (isString(item.to) && !realityNodeIds.has(item.to)) {
        errors.push(`${pathPrefix}.to must reference an existing realityModel node`);
      }
    }

    const missingRelationEvidence = requireArray(
      errors,
      "dashboardState.realityModel.missingRelationEvidence",
      realityModel.missingRelationEvidence
    ) ?? [];
    const missingRelationIds = new Set<string>();
    for (const [index, missing] of missingRelationEvidence.entries()) {
      const pathPrefix = `dashboardState.realityModel.missingRelationEvidence[${index}]`;
      const item = requireObject(errors, pathPrefix, missing);
      if (item == null) {
        continue;
      }
      requireUniqueStringId(errors, missingRelationIds, `${pathPrefix}.id`, item.id);
      requireStringField(errors, pathPrefix, item, "label");
      requireStringField(errors, pathPrefix, item, "relation");
      requireStringField(errors, pathPrefix, item, "owner");
      requireStringField(errors, pathPrefix, item, "requiredEvidenceType");
      requireStringField(errors, pathPrefix, item, "nextActionRef");
    }
    requireStringField(errors, "dashboardState.realityModel", realityModel, "updateRule");
  }

  const goalCompass = requireObject(
    errors,
    "dashboardState.goalCompass",
    root.goalCompass
  );
  const goalIds = new Set<string>();
  if (goalCompass != null) {
    requireStringField(errors, "dashboardState.goalCompass", goalCompass, "schemaVersion");
    requireStringField(errors, "dashboardState.goalCompass", goalCompass, "currentReality");
    requireStringField(errors, "dashboardState.goalCompass", goalCompass, "goalState");
    requireStringField(errors, "dashboardState.goalCompass", goalCompass, "nextSafeMove");
    const goalGraph =
      requireArray(errors, "dashboardState.goalCompass.goalGraph", goalCompass.goalGraph) ?? [];
    const parentRefs: Array<{ path: string; parentId: string }> = [];
    for (const [index, goal] of goalGraph.entries()) {
      const pathPrefix = `dashboardState.goalCompass.goalGraph[${index}]`;
      const item = requireObject(errors, pathPrefix, goal);
      if (item == null) {
        continue;
      }
      requireUniqueStringId(errors, goalIds, `${pathPrefix}.id`, item.id);
      if (item.parentId !== null) {
        requireStringField(errors, pathPrefix, item, "parentId");
        if (isString(item.parentId)) {
          parentRefs.push({ path: `${pathPrefix}.parentId`, parentId: item.parentId });
        }
      }
      requireStringField(errors, pathPrefix, item, "type");
      requireStringField(errors, pathPrefix, item, "statement");
      requireStringField(errors, pathPrefix, item, "status");
      requireStringField(errors, pathPrefix, item, "owner");
      requireNonEmptyStringArrayField(errors, pathPrefix, item, "evidenceRefs");
    }
    for (const ref of parentRefs) {
      if (!goalIds.has(ref.parentId)) {
        errors.push(`${ref.path} must reference an existing goalCompass.goalGraph id`);
      }
    }
    if (!goalIds.has("mission")) {
      errors.push("dashboardState.goalCompass.goalGraph must include the mission root goal");
    }

    const topGaps =
      requireArray(errors, "dashboardState.goalCompass.topGaps", goalCompass.topGaps) ?? [];
    const gapIds = new Set<string>();
    for (const [index, gap] of topGaps.entries()) {
      const pathPrefix = `dashboardState.goalCompass.topGaps[${index}]`;
      const item = requireObject(errors, pathPrefix, gap);
      if (item == null) {
        continue;
      }
      requireUniqueStringId(errors, gapIds, `${pathPrefix}.id`, item.id);
      requireStringField(errors, pathPrefix, item, "label");
      requireStringField(errors, pathPrefix, item, "status");
      requireStringField(errors, pathPrefix, item, "owner");
      requireStringField(errors, pathPrefix, item, "nextActionRef");
      requireNonEmptyStringArrayField(errors, pathPrefix, item, "blocks");
      requireNonEmptyStringArrayField(errors, pathPrefix, item, "evidenceNeeded");
    }
    requireStringArrayField(
      errors,
      "dashboardState.goalCompass",
      goalCompass,
      "alignmentChecks"
    );
    const phaseGate = requireObject(
      errors,
      "dashboardState.goalCompass.phaseGate",
      goalCompass.phaseGate
    );
    if (phaseGate != null) {
      requireStringField(errors, "dashboardState.goalCompass.phaseGate", phaseGate, "id");
      requireStringField(errors, "dashboardState.goalCompass.phaseGate", phaseGate, "status");
      requireStringField(errors, "dashboardState.goalCompass.phaseGate", phaseGate, "failurePolicy");
      requireNumberField(errors, "dashboardState.goalCompass.phaseGate", phaseGate, "thresholdScore");
      requireBooleanField(errors, "dashboardState.goalCompass.phaseGate", phaseGate, "canPlan");
      requireBooleanField(
        errors,
        "dashboardState.goalCompass.phaseGate",
        phaseGate,
        "canImplementApplicationChange"
      );
      requireBooleanField(
        errors,
        "dashboardState.goalCompass.phaseGate",
        phaseGate,
        "goalTraceRequired"
      );
      requireBooleanField(
        errors,
        "dashboardState.goalCompass.phaseGate",
        phaseGate,
        "rotWarningsBlockImplementation"
      );
      requireBooleanField(
        errors,
        "dashboardState.goalCompass.phaseGate",
        phaseGate,
        "staleRequiredFactsBlockCloseout"
      );
      requireNonEmptyStringArrayField(
        errors,
        "dashboardState.goalCompass.phaseGate",
        phaseGate,
        "requiredChecks"
      );
    }
  }

  const contextRotMonitor = requireObject(
    errors,
    "dashboardState.contextRotMonitor",
    root.contextRotMonitor
  );
  let openCriticalRotWarningCount = 0;
  if (contextRotMonitor != null) {
    requireStringField(
      errors,
      "dashboardState.contextRotMonitor",
      contextRotMonitor,
      "schemaVersion"
    );
    requireStringField(
      errors,
      "dashboardState.contextRotMonitor",
      contextRotMonitor,
      "status"
    );
    const rotWarnings = requireArray(
      errors,
      "dashboardState.contextRotMonitor.rotWarnings",
      contextRotMonitor.rotWarnings
    ) ?? [];
    const rotWarningIds = new Set<string>();
    for (const [index, warning] of rotWarnings.entries()) {
      const pathPrefix = `dashboardState.contextRotMonitor.rotWarnings[${index}]`;
      const item = requireObject(errors, pathPrefix, warning);
      if (item == null) {
        continue;
      }
      requireUniqueStringId(errors, rotWarningIds, `${pathPrefix}.id`, item.id);
      requireAllowedStringField(errors, pathPrefix, item, "severity", [
        "info",
        "warning",
        "critical",
      ]);
      requireStringField(errors, pathPrefix, item, "status");
      requireStringField(errors, pathPrefix, item, "summary");
      requireStringField(errors, pathPrefix, item, "owner");
      requireNonEmptyStringArrayField(errors, pathPrefix, item, "evidenceRefs");
      requireStringField(errors, pathPrefix, item, "nextAction");
      requireStringField(errors, pathPrefix, item, "openedAt");
      requireStringField(errors, pathPrefix, item, "expiresAt");
      requireBooleanField(errors, pathPrefix, item, "blocksImplementation");
      if (
        item.severity === "critical" &&
        item.status === "open" &&
        item.blocksImplementation === true
      ) {
        openCriticalRotWarningCount += 1;
      }
    }

    const factRecords =
      requireArray(errors, "dashboardState.contextRotMonitor.factRecords", contextRotMonitor.factRecords) ??
      [];
    const factIds = new Set<string>();
    for (const [index, fact] of factRecords.entries()) {
      const pathPrefix = `dashboardState.contextRotMonitor.factRecords[${index}]`;
      const item = requireObject(errors, pathPrefix, fact);
      if (item == null) {
        continue;
      }
      requireUniqueStringId(errors, factIds, `${pathPrefix}.id`, item.id);
      requireAllowedStringField(errors, pathPrefix, item, "status", [
        "observed",
        "declared",
        "planned",
        "stale",
        "contradicted",
        "retired",
      ]);
      requireStringField(errors, pathPrefix, item, "owner");
      requireStringField(errors, pathPrefix, item, "lastVerifiedAt");
      requireStringField(errors, pathPrefix, item, "ttl");
      requireStringField(errors, pathPrefix, item, "evidenceRef");
      requireStringField(errors, pathPrefix, item, "reversalCondition");
      requireStringField(errors, pathPrefix, item, "relatedGoalRef");
      requireStringField(errors, pathPrefix, item, "relatedRealityRef");
    }
    const expiredFacts = readStringArrayField(
      errors,
      "dashboardState.contextRotMonitor",
      contextRotMonitor,
      "expiredFacts"
    );
    for (const expiredFactId of expiredFacts) {
      if (!factIds.has(expiredFactId)) {
        errors.push(
          `dashboardState.contextRotMonitor.expiredFacts contains unknown fact id ${expiredFactId}`
        );
      }
    }
    requireStringArrayField(
      errors,
      "dashboardState.contextRotMonitor",
      contextRotMonitor,
      "nextEvidenceToCollect"
    );
  }

  const phaseGate = isPlainObject(goalCompass?.phaseGate)
    ? (goalCompass.phaseGate as Record<string, unknown>)
    : null;
  if (
    openCriticalRotWarningCount > 0 &&
    phaseGate != null &&
    phaseGate.canImplementApplicationChange === true
  ) {
    errors.push(
      "dashboardState.goalCompass.phaseGate.canImplementApplicationChange must be false while critical context rot warnings are open"
    );
  }

  const harnessEvaluation = requireObject(
    errors,
    "dashboardState.harnessEvaluation",
    root.harnessEvaluation
  );
  if (harnessEvaluation != null) {
    requireStringField(errors, "dashboardState.harnessEvaluation", harnessEvaluation, "schemaVersion");
    requireStringField(errors, "dashboardState.harnessEvaluation", harnessEvaluation, "scope");
    requireStringField(errors, "dashboardState.harnessEvaluation", harnessEvaluation, "status");
    requireNumberField(errors, "dashboardState.harnessEvaluation", harnessEvaluation, "score");
    requireNumberField(errors, "dashboardState.harnessEvaluation", harnessEvaluation, "thresholdScore");
    requireStringField(errors, "dashboardState.harnessEvaluation", harnessEvaluation, "sourceStateHash");
    requireStringField(errors, "dashboardState.harnessEvaluation", harnessEvaluation, "evaluatedAt");
    requireStringField(errors, "dashboardState.harnessEvaluation", harnessEvaluation, "evaluator");
    const metrics =
      requireArray(errors, "dashboardState.harnessEvaluation.metrics", harnessEvaluation.metrics) ??
      [];
    const metricIds = new Set<string>();
    let failingMetricCount = 0;
    for (const [index, metric] of metrics.entries()) {
      const pathPrefix = `dashboardState.harnessEvaluation.metrics[${index}]`;
      const item = requireObject(errors, pathPrefix, metric);
      if (item == null) {
        continue;
      }
      requireUniqueStringId(errors, metricIds, `${pathPrefix}.id`, item.id);
      requireStringField(errors, pathPrefix, item, "label");
      requireStringField(errors, pathPrefix, item, "status");
      requireNumberField(errors, pathPrefix, item, "score");
      requireNumberField(errors, pathPrefix, item, "thresholdScore");
      requireNonEmptyStringArrayField(errors, pathPrefix, item, "evidenceRefs");
      requireStringField(errors, pathPrefix, item, "failClosedRule");
      if (
        item.status !== "pass" ||
        (isFiniteNumber(item.score) &&
          isFiniteNumber(item.thresholdScore) &&
          item.score < item.thresholdScore)
      ) {
        failingMetricCount += 1;
      }
    }
    const gates = requireObject(
      errors,
      "dashboardState.harnessEvaluation.gates",
      harnessEvaluation.gates
    );
    if (gates != null) {
      requireBooleanField(errors, "dashboardState.harnessEvaluation.gates", gates, "goalTraceRequired");
      requireBooleanField(errors, "dashboardState.harnessEvaluation.gates", gates, "criticalRotBlocksImplementation");
      requireBooleanField(errors, "dashboardState.harnessEvaluation.gates", gates, "staleFactsBlockCloseout");
      requireBooleanField(errors, "dashboardState.harnessEvaluation.gates", gates, "brokenRealityRefsBlockProjection");
    }
    if (
      isFiniteNumber(harnessEvaluation.score) &&
      isFiniteNumber(harnessEvaluation.thresholdScore) &&
      harnessEvaluation.score >= harnessEvaluation.thresholdScore &&
      harnessEvaluation.status !== "pass"
    ) {
      errors.push("dashboardState.harnessEvaluation.status must be pass when score meets thresholdScore");
    }
    if (
      harnessEvaluation.status === "pass" &&
      isFiniteNumber(harnessEvaluation.score) &&
      isFiniteNumber(harnessEvaluation.thresholdScore) &&
      harnessEvaluation.score < harnessEvaluation.thresholdScore
    ) {
      errors.push("dashboardState.harnessEvaluation.score must meet thresholdScore when status is pass");
    }
    if (harnessEvaluation.status === "pass" && failingMetricCount > 0) {
      errors.push("dashboardState.harnessEvaluation cannot pass while any metric is below threshold or not pass");
    }
    if (harnessEvaluation.status === "pass" && openCriticalRotWarningCount > 0) {
      errors.push("dashboardState.harnessEvaluation cannot pass while critical context rot warnings are open");
    }
  }

  const executiveSummary = requireObject(
    errors,
    "dashboardState.executiveSummary",
    root.executiveSummary
  );
  if (executiveSummary != null) {
    requireStringField(
      errors,
      "dashboardState.executiveSummary",
      executiveSummary,
      "headline"
    );
    requireStringField(
      errors,
      "dashboardState.executiveSummary",
      executiveSummary,
      "overallStatus"
    );
    requireStringField(
      errors,
      "dashboardState.executiveSummary",
      executiveSummary,
      "currentStage"
    );
    requireNumberField(
      errors,
      "dashboardState.executiveSummary",
      executiveSummary,
      "overallProgressPercent"
    );
    requireStringField(
      errors,
      "dashboardState.executiveSummary",
      executiveSummary,
      "nextDecision"
    );
    requireStringField(
      errors,
      "dashboardState.executiveSummary",
      executiveSummary,
      "lastUpdated"
    );
    requireStringField(
      errors,
      "dashboardState.executiveSummary",
      executiveSummary,
      "audienceNote"
    );
  }

  const progressState = requireObject(
    errors,
    "dashboardState.progressState",
    root.progressState
  );
  if (progressState != null) {
    requireStringField(errors, "dashboardState.progressState", progressState, "activeGoal");
    requireStringField(errors, "dashboardState.progressState", progressState, "activeChunk");
    requireStringField(errors, "dashboardState.progressState", progressState, "currentOwner");
    requireBooleanField(errors, "dashboardState.progressState", progressState, "blocked");
    requireStringField(errors, "dashboardState.progressState", progressState, "riskLevel");
    requireStringField(errors, "dashboardState.progressState", progressState, "nextAction");

    const stageChecklist = requireArray(
      errors,
      "dashboardState.progressState.stageChecklist",
      progressState.stageChecklist
    );
    if (stageChecklist != null) {
      for (const [index, item] of stageChecklist.entries()) {
        const checklistItem = requireObject(
          errors,
          `dashboardState.progressState.stageChecklist[${index}]`,
          item
        );
        if (checklistItem == null) {
          continue;
        }

        requireStringField(
          errors,
          `dashboardState.progressState.stageChecklist[${index}]`,
          checklistItem,
          "id"
        );
        requireStringField(
          errors,
          `dashboardState.progressState.stageChecklist[${index}]`,
          checklistItem,
          "label"
        );
        requireStringField(
          errors,
          `dashboardState.progressState.stageChecklist[${index}]`,
          checklistItem,
          "status"
        );
      }
    }

    const workstreams = requireArray(
      errors,
      "dashboardState.progressState.workstreams",
      progressState.workstreams
    );
    if (workstreams != null) {
      for (const [index, item] of workstreams.entries()) {
        const workstream = requireObject(
          errors,
          `dashboardState.progressState.workstreams[${index}]`,
          item
        );
        if (workstream == null) {
          continue;
        }

        requireStringField(
          errors,
          `dashboardState.progressState.workstreams[${index}]`,
          workstream,
          "id"
        );
        requireStringField(
          errors,
          `dashboardState.progressState.workstreams[${index}]`,
          workstream,
          "label"
        );
        requireStringField(
          errors,
          `dashboardState.progressState.workstreams[${index}]`,
          workstream,
          "owner"
        );
        requireStringField(
          errors,
          `dashboardState.progressState.workstreams[${index}]`,
          workstream,
          "status"
        );
        requireNumberField(
          errors,
          `dashboardState.progressState.workstreams[${index}]`,
          workstream,
          "progressPercent"
        );
        requireStringField(
          errors,
          `dashboardState.progressState.workstreams[${index}]`,
          workstream,
          "note"
        );
      }
    }
  }

  const governanceState = requireObject(
    errors,
    "dashboardState.governanceState",
    root.governanceState
  );
  if (governanceState != null) {
    requireStringField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "policyId"
    );
    requireStringField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "policyLabel"
    );
    requireStringField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "status"
    );
    requireStringField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "sessionGovernanceRule"
    );
    requireStringField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "latestApprovedStage"
    );
    requireBooleanField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "goalFrozen"
    );
    requireStringField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "dashboardSyncStatus"
    );
    requireStringArrayField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "requiredArtifacts"
    );
    requireStringArrayField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "requiredKpiIds"
    );
    requireStringArrayField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "mandatorySessionFields"
    );
    requireStringField(
      errors,
      "dashboardState.governanceState",
      governanceState,
      "visibilityRule"
    );
  }

  const kpiProfile = requireObject(errors, "dashboardState.kpiProfile", root.kpiProfile);
  if (kpiProfile != null) {
    requireStringField(errors, "dashboardState.kpiProfile", kpiProfile, "id");
    requireStringField(errors, "dashboardState.kpiProfile", kpiProfile, "label");
    requireStringArrayField(
      errors,
      "dashboardState.kpiProfile",
      kpiProfile,
      "requiredKpiIds"
    );
    requireStringArrayField(
      errors,
      "dashboardState.kpiProfile",
      kpiProfile,
      "perspectives"
    );
    requireStringArrayField(
      errors,
      "dashboardState.kpiProfile",
      kpiProfile,
      "rationale"
    );
  }

  const kpis = requireArray(errors, "dashboardState.kpis", root.kpis);
  if (kpis != null) {
    for (const [index, item] of kpis.entries()) {
      const kpi = requireObject(errors, `dashboardState.kpis[${index}]`, item);
      if (kpi == null) {
        continue;
      }

      requireStringField(errors, `dashboardState.kpis[${index}]`, kpi, "id");
      requireStringField(errors, `dashboardState.kpis[${index}]`, kpi, "label");
      requireStringField(errors, `dashboardState.kpis[${index}]`, kpi, "value");
      requireStringField(errors, `dashboardState.kpis[${index}]`, kpi, "target");
      requireStringField(errors, `dashboardState.kpis[${index}]`, kpi, "status");
      requireStringArrayField(
        errors,
        `dashboardState.kpis[${index}]`,
        kpi,
        "perspectives"
      );
      requireBooleanField(
        errors,
        `dashboardState.kpis[${index}]`,
        kpi,
        "required"
      );
      requireStringField(
        errors,
        `dashboardState.kpis[${index}]`,
        kpi,
        "interpretation"
      );
    }
  }

  const projectionConfidence = requireObject(
    errors,
    "dashboardState.projectionConfidence",
    root.projectionConfidence
  );
  if (projectionConfidence != null) {
    requireStringField(errors, "dashboardState.projectionConfidence", projectionConfidence, "status");
    requireStringField(errors, "dashboardState.projectionConfidence", projectionConfidence, "completeness");
    requireStringField(errors, "dashboardState.projectionConfidence", projectionConfidence, "staleness");
    requireStringField(errors, "dashboardState.projectionConfidence", projectionConfidence, "trustBoundaryStatus");
    requireNumberField(errors, "dashboardState.projectionConfidence", projectionConfidence, "missingEvidenceCount");
    requireNumberField(errors, "dashboardState.projectionConfidence", projectionConfidence, "openDecisionCount");
    requireStringField(errors, "dashboardState.projectionConfidence", projectionConfidence, "actionGate");
    requireStringArrayField(errors, "dashboardState.projectionConfidence", projectionConfidence, "requiredActions");
  }

  const sessionTraceability = requireObject(
    errors,
    "dashboardState.sessionTraceability",
    root.sessionTraceability
  );
  if (sessionTraceability != null) {
    requireStringField(errors, "dashboardState.sessionTraceability", sessionTraceability, "status");
    requireStringField(errors, "dashboardState.sessionTraceability", sessionTraceability, "purpose");
    requireStringField(errors, "dashboardState.sessionTraceability", sessionTraceability, "integrityPolicy");
    const traceEntries =
      requireArray(
        errors,
        "dashboardState.sessionTraceability.entries",
        sessionTraceability.entries
      ) ?? [];
    if (traceEntries.length === 0) {
      errors.push("dashboardState.sessionTraceability.entries must contain at least one trace entry");
    }
    for (const [index, item] of traceEntries.entries()) {
      const pathPrefix = `dashboardState.sessionTraceability.entries[${index}]`;
      const traceEntry = requireObject(errors, pathPrefix, item);
      if (traceEntry == null) {
        continue;
      }
      for (const field of [
        "sessionId",
        "status",
        "phase",
        "originalRequest",
        "processSummary",
        "resultSummary",
        "nextStep",
      ]) {
        requireStringField(errors, pathPrefix, traceEntry, field);
      }
      requireObject(errors, `${pathPrefix}.traceIntegrity`, traceEntry.traceIntegrity);
      requireStringArrayField(errors, pathPrefix, traceEntry, "evidenceRefs");
    }
  }

  const userRealityCheck = requireObject(
    errors,
    "dashboardState.userRealityCheck",
    root.userRealityCheck
  );
  if (userRealityCheck != null) {
    requireStringField(errors, "dashboardState.userRealityCheck", userRealityCheck, "status");
    requireStringField(errors, "dashboardState.userRealityCheck", userRealityCheck, "purpose");
    requireObject(errors, "dashboardState.userRealityCheck.summary", userRealityCheck.summary);
    const answers =
      requireArray(errors, "dashboardState.userRealityCheck.answers", userRealityCheck.answers) ?? [];
    if (answers.length === 0) {
      errors.push("dashboardState.userRealityCheck.answers must contain at least one user question");
    }
    const actionPlan =
      requireArray(errors, "dashboardState.userRealityCheck.actionPlan", userRealityCheck.actionPlan) ?? [];
    if (actionPlan.length === 0) {
      errors.push("dashboardState.userRealityCheck.actionPlan must contain at least one action");
    }
    const actionIds = new Set<string>();
    for (const [index, item] of actionPlan.entries()) {
      const pathPrefix = `dashboardState.userRealityCheck.actionPlan[${index}]`;
      const action = requireObject(errors, pathPrefix, item);
      if (action == null) {
        continue;
      }
      requireUniqueStringId(errors, actionIds, `${pathPrefix}.id`, action.id);
      requireNumberField(errors, pathPrefix, action, "rank");
      for (const field of [
        "title",
        "status",
        "owner",
        "whyItMatters",
        "successSignal",
      ]) {
        requireStringField(errors, pathPrefix, action, field);
      }
      requireNonEmptyStringArrayField(errors, pathPrefix, action, "evidenceRequired");
      requireNonEmptyStringArrayField(errors, pathPrefix, action, "apiRoutes");
      requireStringArrayField(errors, pathPrefix, action, "blocks");
      requireNonEmptyStringArrayField(errors, pathPrefix, action, "sourceRefs");
    }
    requireArray(errors, "dashboardState.userRealityCheck.evidenceMap", userRealityCheck.evidenceMap);
    const apiContract = requireObject(
      errors,
      "dashboardState.userRealityCheck.apiContract",
      userRealityCheck.apiContract
    );
    if (apiContract != null) {
      requireStringField(errors, "dashboardState.userRealityCheck.apiContract", apiContract, "route");
      requireBooleanField(errors, "dashboardState.userRealityCheck.apiContract", apiContract, "readOnly");
      requireStringArrayField(errors, "dashboardState.userRealityCheck.apiContract", apiContract, "usefulFor");
    }
  }

  const issues = requireArray(errors, "dashboardState.errors", root.errors);
  if (issues != null) {
    for (const [index, item] of issues.entries()) {
      const issue = requireObject(errors, `dashboardState.errors[${index}]`, item);
      if (issue == null) {
        continue;
      }

      requireStringField(errors, `dashboardState.errors[${index}]`, issue, "id");
      requireStringField(errors, `dashboardState.errors[${index}]`, issue, "severity");
      requireStringField(errors, `dashboardState.errors[${index}]`, issue, "status");
      requireStringField(errors, `dashboardState.errors[${index}]`, issue, "summary");
      requireStringField(errors, `dashboardState.errors[${index}]`, issue, "owner");
      requireStringField(
        errors,
        `dashboardState.errors[${index}]`,
        issue,
        "firstSeenAt"
      );
      requireStringField(
        errors,
        `dashboardState.errors[${index}]`,
        issue,
        "lastSeenAt"
      );
    }
  }

  const gitStatus = requireObject(errors, "dashboardState.gitStatus", root.gitStatus);
  if (gitStatus != null) {
    requireBooleanField(errors, "dashboardState.gitStatus", gitStatus, "repositoryExpected");
    requireStringField(errors, "dashboardState.gitStatus", gitStatus, "trackedByGit");
    requireStringField(errors, "dashboardState.gitStatus", gitStatus, "provider");
    requireStringField(errors, "dashboardState.gitStatus", gitStatus, "defaultBranch");
    requireStringField(errors, "dashboardState.gitStatus", gitStatus, "currentBranch");
    requireStringArrayField(
      errors,
      "dashboardState.gitStatus",
      gitStatus,
      "auditExpectations"
    );

    const lastCommit = requireObject(
      errors,
      "dashboardState.gitStatus.lastCommit",
      gitStatus.lastCommit
    );
    if (lastCommit != null) {
      requireStringField(
        errors,
        "dashboardState.gitStatus.lastCommit",
        lastCommit,
        "sha"
      );
      requireStringField(
        errors,
        "dashboardState.gitStatus.lastCommit",
        lastCommit,
        "message"
      );
      requireStringField(
        errors,
        "dashboardState.gitStatus.lastCommit",
        lastCommit,
        "author"
      );
      requireStringField(
        errors,
        "dashboardState.gitStatus.lastCommit",
        lastCommit,
        "committedAt"
      );
    }

    const workingTree = requireObject(
      errors,
      "dashboardState.gitStatus.workingTree",
      gitStatus.workingTree
    );
    if (workingTree != null) {
      requireStringField(
        errors,
        "dashboardState.gitStatus.workingTree",
        workingTree,
        "status"
      );
      requireStringField(
        errors,
        "dashboardState.gitStatus.workingTree",
        workingTree,
        "stagedChanges"
      );
      requireStringField(
        errors,
        "dashboardState.gitStatus.workingTree",
        workingTree,
        "unstagedChanges"
      );
      requireStringField(
        errors,
        "dashboardState.gitStatus.workingTree",
        workingTree,
        "untrackedFiles"
      );
    }
  }

  const sessionLog = requireArray(errors, "dashboardState.sessionLog", root.sessionLog);
  if (sessionLog != null) {
    for (const [index, item] of sessionLog.entries()) {
      const session = requireObject(
        errors,
        `dashboardState.sessionLog[${index}]`,
        item
      );
      if (session == null) {
        continue;
      }

      requireStringField(errors, `dashboardState.sessionLog[${index}]`, session, "id");
      requireStringField(
        errors,
        `dashboardState.sessionLog[${index}]`,
        session,
        "title"
      );
      requireStringField(
        errors,
        `dashboardState.sessionLog[${index}]`,
        session,
        "status"
      );
      requireStringField(
        errors,
        `dashboardState.sessionLog[${index}]`,
        session,
        "stage"
      );
      requireStringField(
        errors,
        `dashboardState.sessionLog[${index}]`,
        session,
        "startedAt"
      );
      requireStringField(
        errors,
        `dashboardState.sessionLog[${index}]`,
        session,
        "endedAt"
      );
      requireStringField(
        errors,
        `dashboardState.sessionLog[${index}]`,
        session,
        "owner"
      );
      requireStringField(
        errors,
        `dashboardState.sessionLog[${index}]`,
        session,
        "note"
      );
      requireStringArrayField(
        errors,
        `dashboardState.sessionLog[${index}]`,
        session,
        "outputs"
      );
    }
  }

  const governedSessions = requireArray(
    errors,
    "dashboardState.governedSessions",
    root.governedSessions
  );
  if (governedSessions != null) {
    for (const [index, item] of governedSessions.entries()) {
      const session = requireObject(
        errors,
        `dashboardState.governedSessions[${index}]`,
        item
      );
      if (session == null) {
        continue;
      }

      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "id"
      );
      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "title"
      );
      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "status"
      );
      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "owner"
      );
      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "agentRole"
      );
      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "governanceStatus"
      );
      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "goal"
      );
      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "chunkId"
      );
      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "startedAt"
      );
      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "endedAt"
      );
      requireStringArrayField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "outputs"
      );
      requireStringField(
        errors,
        `dashboardState.governedSessions[${index}]`,
        session,
        "nextStep"
      );

      const sessionGovernance = requireObject(
        errors,
        `dashboardState.governedSessions[${index}].governance`,
        session.governance
      );
      if (sessionGovernance != null) {
        requireBooleanField(
          errors,
          `dashboardState.governedSessions[${index}].governance`,
          sessionGovernance,
          "opened"
        );
        requireNumberField(
          errors,
          `dashboardState.governedSessions[${index}].governance`,
          sessionGovernance,
          "latestPlanRound"
        );
        requireNumberField(
          errors,
          `dashboardState.governedSessions[${index}].governance`,
          sessionGovernance,
          "latestReviewRound"
        );
        requireBooleanField(
          errors,
          `dashboardState.governedSessions[${index}].governance`,
          sessionGovernance,
          "goalFrozen"
        );
        requireBooleanField(
          errors,
          `dashboardState.governedSessions[${index}].governance`,
          sessionGovernance,
          "contractApproved"
        );
        requireBooleanField(
          errors,
          `dashboardState.governedSessions[${index}].governance`,
          sessionGovernance,
          "independentEvaluationPassed"
        );
        requireBooleanField(
          errors,
          `dashboardState.governedSessions[${index}].governance`,
          sessionGovernance,
          "governanceRefreshed"
        );
        requireBooleanField(
          errors,
          `dashboardState.governedSessions[${index}].governance`,
          sessionGovernance,
          "closeoutReady"
        );
        requireStringField(
          errors,
          `dashboardState.governedSessions[${index}].governance`,
          sessionGovernance,
          "evidenceFreshness"
        );
      }

      const sessionVerification = requireObject(
        errors,
        `dashboardState.governedSessions[${index}].verification`,
        session.verification
      );
      if (sessionVerification != null) {
        requireStringField(
          errors,
          `dashboardState.governedSessions[${index}].verification`,
          sessionVerification,
          "testsStatus"
        );
        requireStringField(
          errors,
          `dashboardState.governedSessions[${index}].verification`,
          sessionVerification,
          "reviewStatus"
        );
        requireStringField(
          errors,
          `dashboardState.governedSessions[${index}].verification`,
          sessionVerification,
          "remediationStatus"
        );
      }

      const sessionGit = requireObject(
        errors,
        `dashboardState.governedSessions[${index}].git`,
        session.git
      );
      if (sessionGit != null) {
        requireStringField(
          errors,
          `dashboardState.governedSessions[${index}].git`,
          sessionGit,
          "branch"
        );
        requireStringField(
          errors,
          `dashboardState.governedSessions[${index}].git`,
          sessionGit,
          "commit"
        );
      }
    }
  }

  const memoryPromotion = requireObject(
    errors,
    "dashboardState.memoryPromotion",
    root.memoryPromotion
  );
  if (memoryPromotion != null) {
    requireStringField(errors, "dashboardState.memoryPromotion", memoryPromotion, "status");
    requireNumberField(errors, "dashboardState.memoryPromotion", memoryPromotion, "thresholdScore");
    requireStringArrayField(errors, "dashboardState.memoryPromotion", memoryPromotion, "sourceRoots");
    const evidenceThreshold = requireObject(
      errors,
      "dashboardState.memoryPromotion.evidenceThreshold",
      memoryPromotion.evidenceThreshold
    );
    if (evidenceThreshold != null) {
      requireNumberField(
        errors,
        "dashboardState.memoryPromotion.evidenceThreshold",
        evidenceThreshold,
        "minimumOccurrences"
      );
      requireNumberField(
        errors,
        "dashboardState.memoryPromotion.evidenceThreshold",
        evidenceThreshold,
        "minimumGovernedSessions"
      );
    }
    const candidates = requireArray(
      errors,
      "dashboardState.memoryPromotion.candidates",
      memoryPromotion.candidates
    );
    if (candidates != null) {
      for (const [index, item] of candidates.entries()) {
        const candidate = requireObject(
          errors,
          `dashboardState.memoryPromotion.candidates[${index}]`,
          item
        );
        if (candidate == null) {
          continue;
        }
        requireStringField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "id");
        requireStringField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "title");
        requireStringField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "status");
        requireNumberField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "score");
        requireNumberField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "occurrences");
        requireNumberField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "governedSessionCount");
        requireStringField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "collisionCheck");
        requireStringField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "decision");
        requireStringArrayField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "evidencePaths");
        requireStringArrayField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "generatedPaths");
        requireStringField(errors, `dashboardState.memoryPromotion.candidates[${index}]`, candidate, "nextAction");
      }
    }
  }

  const artifacts = requireArray(errors, "dashboardState.artifacts", root.artifacts);
  if (artifacts != null) {
    for (const [index, item] of artifacts.entries()) {
      const artifact = requireObject(
        errors,
        `dashboardState.artifacts[${index}]`,
        item
      );
      if (artifact == null) {
        continue;
      }

      requireStringField(errors, `dashboardState.artifacts[${index}]`, artifact, "id");
      requireStringField(
        errors,
        `dashboardState.artifacts[${index}]`,
        artifact,
        "label"
      );
      requireStringField(
        errors,
        `dashboardState.artifacts[${index}]`,
        artifact,
        "path"
      );
      requireStringField(
        errors,
        `dashboardState.artifacts[${index}]`,
        artifact,
        "status"
      );
      requireStringField(
        errors,
        `dashboardState.artifacts[${index}]`,
        artifact,
        "owner"
      );
    }
  }

  const domainLens = requireObject(errors, "dashboardState.domainLens", root.domainLens);
  if (domainLens != null) {
    requireStringField(errors, "dashboardState.domainLens", domainLens, "mode");
    requireStringField(errors, "dashboardState.domainLens", domainLens, "title");
    requireStringField(
      errors,
      "dashboardState.domainLens",
      domainLens,
      "primaryQuestion"
    );
  }

  const timeline = requireArray(errors, "dashboardState.timeline", root.timeline);
  if (timeline != null) {
    for (const [index, item] of timeline.entries()) {
      const timelineItem = requireObject(
        errors,
        `dashboardState.timeline[${index}]`,
        item
      );
      if (timelineItem == null) {
        continue;
      }

      requireStringField(errors, `dashboardState.timeline[${index}]`, timelineItem, "id");
      requireStringField(
        errors,
        `dashboardState.timeline[${index}]`,
        timelineItem,
        "label"
      );
      requireStringField(
        errors,
        `dashboardState.timeline[${index}]`,
        timelineItem,
        "type"
      );
      requireStringField(
        errors,
        `dashboardState.timeline[${index}]`,
        timelineItem,
        "status"
      );
      requireStringField(
        errors,
        `dashboardState.timeline[${index}]`,
        timelineItem,
        "owner"
      );
      requireStringField(
        errors,
        `dashboardState.timeline[${index}]`,
        timelineItem,
        "note"
      );
    }
  }

  const entities = requireArray(errors, "dashboardState.entities", root.entities);
  if (entities != null) {
    for (const [index, item] of entities.entries()) {
      const entity = requireObject(errors, `dashboardState.entities[${index}]`, item);
      if (entity == null) {
        continue;
      }

      requireStringField(errors, `dashboardState.entities[${index}]`, entity, "id");
      requireStringField(errors, `dashboardState.entities[${index}]`, entity, "label");
      requireStringField(errors, `dashboardState.entities[${index}]`, entity, "type");
      requireStringField(errors, `dashboardState.entities[${index}]`, entity, "status");
      requireStringField(errors, `dashboardState.entities[${index}]`, entity, "summary");
    }
  }

  const versionLedger = requireArray(
    errors,
    "dashboardState.versionLedger",
    root.versionLedger
  );
  if (versionLedger != null) {
    for (const [index, item] of versionLedger.entries()) {
      const version = requireObject(
        errors,
        `dashboardState.versionLedger[${index}]`,
        item
      );
      if (version == null) {
        continue;
      }

      requireStringField(errors, `dashboardState.versionLedger[${index}]`, version, "id");
      requireStringField(
        errors,
        `dashboardState.versionLedger[${index}]`,
        version,
        "label"
      );
      requireStringField(
        errors,
        `dashboardState.versionLedger[${index}]`,
        version,
        "status"
      );
      requireStringField(
        errors,
        `dashboardState.versionLedger[${index}]`,
        version,
        "scope"
      );
      requireNumberField(
        errors,
        `dashboardState.versionLedger[${index}]`,
        version,
        "progressPercent"
      );
    }
  }

  const runtimeOrchestration = requireObject(
    errors,
    "dashboardState.runtimeOrchestration",
    root.runtimeOrchestration
  );
  if (runtimeOrchestration != null) {
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "mode"
    );
    if (
      runtimeOrchestration.activeSessionId != null &&
      !isString(runtimeOrchestration.activeSessionId)
    ) {
      pushTypeError(
        errors,
        "dashboardState.runtimeOrchestration.activeSessionId",
        "a string or null",
        runtimeOrchestration.activeSessionId
      );
    }
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "activeChunkId"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "currentPhase"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "nextActor"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "nextAction"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "contextPolicy"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "contractCoverageRule"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "evaluatorRule"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "lastEventAt"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "stateFile"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "sessionIndexFile"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "sessionSummaryFile"
    );
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "workPacketFile"
    );
    if (
      runtimeOrchestration.nativeExecutionStateFile != null &&
      !isString(runtimeOrchestration.nativeExecutionStateFile)
    ) {
      pushTypeError(
        errors,
        "dashboardState.runtimeOrchestration.nativeExecutionStateFile",
        "a string or null",
        runtimeOrchestration.nativeExecutionStateFile
      );
    }
    if (
      runtimeOrchestration.nativeExecutionPlanFile != null &&
      !isString(runtimeOrchestration.nativeExecutionPlanFile)
    ) {
      pushTypeError(
        errors,
        "dashboardState.runtimeOrchestration.nativeExecutionPlanFile",
        "a string or null",
        runtimeOrchestration.nativeExecutionPlanFile
      );
    }
    if (
      runtimeOrchestration.nativeExecutorBridgeId != null &&
      !isString(runtimeOrchestration.nativeExecutorBridgeId)
    ) {
      pushTypeError(
        errors,
        "dashboardState.runtimeOrchestration.nativeExecutorBridgeId",
        "a string or null",
        runtimeOrchestration.nativeExecutorBridgeId
      );
    }
    requireStringField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "leaseStatus"
    );
    if (
      runtimeOrchestration.leasedAt != null &&
      !isString(runtimeOrchestration.leasedAt)
    ) {
      pushTypeError(
        errors,
        "dashboardState.runtimeOrchestration.leasedAt",
        "a string or null",
        runtimeOrchestration.leasedAt
      );
    }
    requireNumberField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "queueDepth"
    );
    requireStringArrayField(
      errors,
      "dashboardState.runtimeOrchestration",
      runtimeOrchestration,
      "queuedSessionIds"
    );

    const recentEvents = requireArray(
      errors,
      "dashboardState.runtimeOrchestration.recentEvents",
      runtimeOrchestration.recentEvents
    );
    if (recentEvents != null) {
      for (const [index, item] of recentEvents.entries()) {
        const event = requireObject(
          errors,
          `dashboardState.runtimeOrchestration.recentEvents[${index}]`,
          item
        );
        if (event == null) {
          continue;
        }

        requireStringField(
          errors,
          `dashboardState.runtimeOrchestration.recentEvents[${index}]`,
          event,
          "at"
        );
        requireStringField(
          errors,
          `dashboardState.runtimeOrchestration.recentEvents[${index}]`,
          event,
          "phase"
        );
        requireStringField(
          errors,
          `dashboardState.runtimeOrchestration.recentEvents[${index}]`,
          event,
          "actor"
        );
        requireStringField(
          errors,
          `dashboardState.runtimeOrchestration.recentEvents[${index}]`,
          event,
          "action"
        );
        requireStringField(
          errors,
          `dashboardState.runtimeOrchestration.recentEvents[${index}]`,
          event,
          "outcome"
        );
        requireStringField(
          errors,
          `dashboardState.runtimeOrchestration.recentEvents[${index}]`,
          event,
          "note"
        );
      }
    }
  }

  const operationsHealth = requireObject(
    errors,
    "dashboardState.operationsHealth",
    root.operationsHealth
  );
  if (operationsHealth != null) {
    requireStringField(errors, "dashboardState.operationsHealth", operationsHealth, "status");
    requireStringField(errors, "dashboardState.operationsHealth", operationsHealth, "lastUpdated");
    requireStringField(errors, "dashboardState.operationsHealth", operationsHealth, "summary");

    const traffic = requireObject(
      errors,
      "dashboardState.operationsHealth.traffic",
      operationsHealth.traffic
    );
    if (traffic != null) {
      requireNumberField(errors, "dashboardState.operationsHealth.traffic", traffic, "requestsPerMinute");
      requireNumberField(errors, "dashboardState.operationsHealth.traffic", traffic, "activeConnections");
      requireNumberField(errors, "dashboardState.operationsHealth.traffic", traffic, "errorRatePercent");
      requireStringField(errors, "dashboardState.operationsHealth.traffic", traffic, "source");
    }

    const requestResponse = requireObject(
      errors,
      "dashboardState.operationsHealth.requestResponse",
      operationsHealth.requestResponse
    );
    if (requestResponse != null) {
      for (const field of [
        "totalRequests",
        "successResponses",
        "errorResponses",
        "p50Ms",
        "p95Ms",
        "p99Ms",
        "slowRequestThresholdMs",
      ]) {
        requireNumberField(
          errors,
          "dashboardState.operationsHealth.requestResponse",
          requestResponse,
          field
        );
      }
      requireArray(
        errors,
        "dashboardState.operationsHealth.requestResponse.recentSamples",
        requestResponse.recentSamples
      );
    }

    const dbcp = requireObject(
      errors,
      "dashboardState.operationsHealth.dbcp",
      operationsHealth.dbcp
    );
    if (dbcp != null) {
      requireStringField(errors, "dashboardState.operationsHealth.dbcp", dbcp, "status");
      requireStringField(errors, "dashboardState.operationsHealth.dbcp", dbcp, "poolName");
      requireNumberField(errors, "dashboardState.operationsHealth.dbcp", dbcp, "activeConnections");
      requireNumberField(errors, "dashboardState.operationsHealth.dbcp", dbcp, "idleConnections");
      requireNumberField(errors, "dashboardState.operationsHealth.dbcp", dbcp, "maxConnections");
      requireNumberField(errors, "dashboardState.operationsHealth.dbcp", dbcp, "waiters");
      requireStringField(errors, "dashboardState.operationsHealth.dbcp", dbcp, "validationQuery");
      requireStringField(errors, "dashboardState.operationsHealth.dbcp", dbcp, "lastCheckAt");
    }

    const incidentLogs = requireArray(
      errors,
      "dashboardState.operationsHealth.incidentLogs",
      operationsHealth.incidentLogs
    );
    if (incidentLogs != null) {
      for (const [index, item] of incidentLogs.entries()) {
        const incident = requireObject(
          errors,
          `dashboardState.operationsHealth.incidentLogs[${index}]`,
          item
        );
        if (incident == null) {
          continue;
        }
        for (const field of ["id", "severity", "status", "summary", "source", "firstSeenAt", "lastSeenAt"]) {
          requireStringField(
            errors,
            `dashboardState.operationsHealth.incidentLogs[${index}]`,
            incident,
            field
          );
        }
      }
    }

    const latencyQueries = requireArray(
      errors,
      "dashboardState.operationsHealth.latencyQueries",
      operationsHealth.latencyQueries
    );
    if (latencyQueries != null) {
      for (const [index, item] of latencyQueries.entries()) {
        const latencyQuery = requireObject(
          errors,
          `dashboardState.operationsHealth.latencyQueries[${index}]`,
          item
        );
        if (latencyQuery == null) {
          continue;
        }
        for (const field of ["id", "label", "query", "status", "lastRunAt"]) {
          requireStringField(
            errors,
            `dashboardState.operationsHealth.latencyQueries[${index}]`,
            latencyQuery,
            field
          );
        }
        requireNumberField(
          errors,
          `dashboardState.operationsHealth.latencyQueries[${index}]`,
          latencyQuery,
          "p95Ms"
        );
      }
    }

    const dataSources = requireArray(
      errors,
      "dashboardState.operationsHealth.dataSources",
      operationsHealth.dataSources
    );
    if (dataSources != null) {
      for (const [index, item] of dataSources.entries()) {
        const dataSource = requireObject(
          errors,
          `dashboardState.operationsHealth.dataSources[${index}]`,
          item
        );
        if (dataSource == null) {
          continue;
        }
        for (const field of ["id", "label", "status", "path", "expectedSignal"]) {
          requireStringField(
            errors,
            `dashboardState.operationsHealth.dataSources[${index}]`,
            dataSource,
            field
          );
        }
      }
    }
  }

  const taskQueues = requireObject(errors, "dashboardState.taskQueues", root.taskQueues);
  if (taskQueues != null) {
    for (const field of ["waiting", "inProgress", "completed", "blocked", "needsUser"]) {
      requireStringArrayField(errors, "dashboardState.taskQueues", taskQueues, field);
    }
    for (const field of ["realWorld", "failed"]) {
      if (taskQueues[field] != null) {
        requireStringArrayField(errors, "dashboardState.taskQueues", taskQueues, field);
      }
    }
  }

  const agentTaskQueues = requireObject(
    errors,
    "dashboardState.agentTaskQueues",
    root.agentTaskQueues
  );
  if (agentTaskQueues != null) {
    for (const field of ["waiting", "inProgress", "completed", "blocked"]) {
      requireStringArrayField(errors, "dashboardState.agentTaskQueues", agentTaskQueues, field);
    }
    if (agentTaskQueues.hiddenFromUserTaskBoard != null) {
      requireStringArrayField(
        errors,
        "dashboardState.agentTaskQueues",
        agentTaskQueues,
        "hiddenFromUserTaskBoard"
      );
    }
    const maintenance = requireArray(
      errors,
      "dashboardState.agentTaskQueues.maintenance",
      agentTaskQueues.maintenance
    );
    if (maintenance != null) {
      for (const [index, item] of maintenance.entries()) {
        const maintenanceTask = requireObject(
          errors,
          `dashboardState.agentTaskQueues.maintenance[${index}]`,
          item
        );
        if (maintenanceTask == null) {
          continue;
        }
        requireStringField(errors, `dashboardState.agentTaskQueues.maintenance[${index}]`, maintenanceTask, "id");
        requireStringField(errors, `dashboardState.agentTaskQueues.maintenance[${index}]`, maintenanceTask, "status");
        requireStringField(errors, `dashboardState.agentTaskQueues.maintenance[${index}]`, maintenanceTask, "title");
        requireStringField(errors, `dashboardState.agentTaskQueues.maintenance[${index}]`, maintenanceTask, "owner");
        requireStringField(errors, `dashboardState.agentTaskQueues.maintenance[${index}]`, maintenanceTask, "queueVisibility");
      }
    }
  }

  const userTaskBoard = requireObject(
    errors,
    "dashboardState.userTaskBoard",
    root.userTaskBoard
  );
  if (userTaskBoard != null) {
    for (const field of ["current", "remaining", "completed", "hiddenAgentTaskIds"]) {
      requireStringArrayField(errors, "dashboardState.userTaskBoard", userTaskBoard, field);
    }
    for (const field of ["blocked", "needsUser"]) {
      if (userTaskBoard[field] != null) {
        requireStringArrayField(errors, "dashboardState.userTaskBoard", userTaskBoard, field);
      }
    }
  }
  if (taskQueues != null && userTaskBoard != null) {
    const readArray = (value: unknown) =>
      Array.isArray(value) ? value.filter((item): item is string => isString(item)) : [];
    const agentHiddenIds = agentTaskQueues == null
      ? []
      : [
          ...readArray(agentTaskQueues.hiddenFromUserTaskBoard),
          ...readArray(agentTaskQueues.waiting),
          ...readArray(agentTaskQueues.inProgress),
          ...readArray(agentTaskQueues.completed),
          ...readArray(agentTaskQueues.blocked),
        ];
    const userHiddenIds = readArray(userTaskBoard.hiddenAgentTaskIds);
    const hiddenAgentIds = new Set([
      ...userHiddenIds,
      ...agentHiddenIds,
      "task-bootstrap-refresh-projections",
      "session-0001",
    ].map((item) => String(item)));
    const userHiddenSet = new Set(userHiddenIds.map((item) => String(item)));
    for (const taskId of agentHiddenIds) {
      if (!userHiddenSet.has(String(taskId))) {
        errors.push(
          `dashboardState.userTaskBoard.hiddenAgentTaskIds is missing agent-only task "${taskId}"`
        );
      }
    }
    const idEntries = (items: unknown[]): string[] =>
      items.map((item) => isPlainObject(item) ? String(item.id || "") : String(item || ""));
    const publicSurfaces: Array<[string, string[]]> = [
      [
        "dashboardState.taskQueues",
        ["waiting", "inProgress", "completed", "blocked", "needsUser"]
          .flatMap((field) => readArray(taskQueues[field]).map((item) => String(item))),
      ],
      [
        "dashboardState.userTaskBoard",
        ["current", "remaining", "completed", "blocked", "needsUser"]
          .flatMap((field) => readArray(userTaskBoard[field]).map((item) => String(item))),
      ],
      [
        "dashboardState.agile.backlog",
        idEntries(
          isPlainObject(root.agile) && Array.isArray(root.agile.backlog)
            ? root.agile.backlog
            : []
        ),
      ],
      [
        "dashboardState.agileCadence.backlog",
        idEntries(
          isPlainObject(root.agileCadence) && Array.isArray(root.agileCadence.backlog)
            ? root.agileCadence.backlog
            : []
        ),
      ],
      [
        "dashboardState.workTimeline.items",
        idEntries(
          isPlainObject(root.workTimeline) && Array.isArray(root.workTimeline.items)
            ? root.workTimeline.items
            : []
        ),
      ],
      [
        "dashboardState.workReadinessMap.rows",
        idEntries(
          isPlainObject(root.workReadinessMap) && Array.isArray(root.workReadinessMap.rows)
            ? root.workReadinessMap.rows
            : []
        ),
      ],
    ];
    for (const [surfacePath, ids] of publicSurfaces) {
      for (const id of ids) {
        if (hiddenAgentIds.has(id)) {
          errors.push(`${surfacePath} must not expose agent-only task "${id}"`);
        }
      }
    }
  }

  const claimEvidenceMatrix = requireObject(
    errors,
    "dashboardState.claimEvidenceMatrix",
    root.claimEvidenceMatrix
  );
  if (claimEvidenceMatrix != null) {
    const claims = requireArray(
      errors,
      "dashboardState.claimEvidenceMatrix.claims",
      claimEvidenceMatrix.claims
    );
    if (claims != null) {
      for (const [index, item] of claims.entries()) {
        const claim = requireObject(
          errors,
          `dashboardState.claimEvidenceMatrix.claims[${index}]`,
          item
        );
        if (claim == null) {
          continue;
        }
        requireStringField(errors, `dashboardState.claimEvidenceMatrix.claims[${index}]`, claim, "claimId");
        requireStringField(errors, `dashboardState.claimEvidenceMatrix.claims[${index}]`, claim, "statement");
        requireStringField(errors, `dashboardState.claimEvidenceMatrix.claims[${index}]`, claim, "claimStatus");
        requireNumberField(errors, `dashboardState.claimEvidenceMatrix.claims[${index}]`, claim, "confidence");
        requireStringArrayField(errors, `dashboardState.claimEvidenceMatrix.claims[${index}]`, claim, "evidenceRefs");
      }
    }

    const missingEvidenceItems = requireArray(
      errors,
      "dashboardState.claimEvidenceMatrix.missingEvidenceItems",
      claimEvidenceMatrix.missingEvidenceItems
    );
    if (missingEvidenceItems != null) {
      for (const [index, item] of missingEvidenceItems.entries()) {
        const missing = requireObject(
          errors,
          `dashboardState.claimEvidenceMatrix.missingEvidenceItems[${index}]`,
          item
        );
        if (missing == null) {
          continue;
        }
        requireStringField(errors, `dashboardState.claimEvidenceMatrix.missingEvidenceItems[${index}]`, missing, "id");
        requireStringField(errors, `dashboardState.claimEvidenceMatrix.missingEvidenceItems[${index}]`, missing, "label");
        requireStringArrayField(errors, `dashboardState.claimEvidenceMatrix.missingEvidenceItems[${index}]`, missing, "blocksClaimIds");
        requireStringField(errors, `dashboardState.claimEvidenceMatrix.missingEvidenceItems[${index}]`, missing, "requiredEvidenceType");
        requireStringField(errors, `dashboardState.claimEvidenceMatrix.missingEvidenceItems[${index}]`, missing, "owner");
        requireStringField(errors, `dashboardState.claimEvidenceMatrix.missingEvidenceItems[${index}]`, missing, "resolutionTaskId");
        if (missing.queueVisibility != null && !isString(missing.queueVisibility)) {
          pushTypeError(
            errors,
            `dashboardState.claimEvidenceMatrix.missingEvidenceItems[${index}].queueVisibility`,
            "a string",
            missing.queueVisibility
          );
        }
      }
    }
  }

  const decisionContracts = requireArray(
    errors,
    "dashboardState.decisionContracts",
    root.decisionContracts
  );
  if (decisionContracts != null) {
    for (const [index, item] of decisionContracts.entries()) {
      const decision = requireObject(
        errors,
        `dashboardState.decisionContracts[${index}]`,
        item
      );
      if (decision == null) {
        continue;
      }
      requireStringField(errors, `dashboardState.decisionContracts[${index}]`, decision, "id");
      requireStringField(errors, `dashboardState.decisionContracts[${index}]`, decision, "status");
      requireStringField(errors, `dashboardState.decisionContracts[${index}]`, decision, "owner");
      requireStringField(errors, `dashboardState.decisionContracts[${index}]`, decision, "decision");
      requireStringArrayField(errors, `dashboardState.decisionContracts[${index}]`, decision, "evidence");
    }
  }

  const workTimeline = requireObject(errors, "dashboardState.workTimeline", root.workTimeline);
  if (workTimeline != null) {
    const items = requireArray(errors, "dashboardState.workTimeline.items", workTimeline.items);
    if (items != null) {
      for (const [index, item] of items.entries()) {
        const timelineItem = requireObject(
          errors,
          `dashboardState.workTimeline.items[${index}]`,
          item
        );
        if (timelineItem == null) {
          continue;
        }
        requireStringField(errors, `dashboardState.workTimeline.items[${index}]`, timelineItem, "id");
        requireStringField(errors, `dashboardState.workTimeline.items[${index}]`, timelineItem, "title");
        requireStringField(errors, `dashboardState.workTimeline.items[${index}]`, timelineItem, "status");
        requireStringField(errors, `dashboardState.workTimeline.items[${index}]`, timelineItem, "owner");
        requireStringArrayField(errors, `dashboardState.workTimeline.items[${index}]`, timelineItem, "evidenceRefs");
      }
    }
  }

  const dashboardQualityScorecard = requireObject(
    errors,
    "dashboardState.dashboardQualityScorecard",
    root.dashboardQualityScorecard
  );
  if (dashboardQualityScorecard != null) {
    requireNumberField(errors, "dashboardState.dashboardQualityScorecard", dashboardQualityScorecard, "targetScore");
    requireNumberField(errors, "dashboardState.dashboardQualityScorecard", dashboardQualityScorecard, "uiUxDesignScore");
    requireNumberField(errors, "dashboardState.dashboardQualityScorecard", dashboardQualityScorecard, "projectEvidenceScore");
    const qaEvidence = requireObject(
      errors,
      "dashboardState.dashboardQualityScorecard.qaEvidence",
      dashboardQualityScorecard.qaEvidence
    );
    if (qaEvidence != null) {
      requireStringArrayField(
        errors,
        "dashboardState.dashboardQualityScorecard.qaEvidence",
        qaEvidence,
        "requiredFor95"
      );
      requireStringField(errors, "dashboardState.dashboardQualityScorecard.qaEvidence", qaEvidence, "status");
      requireStringField(errors, "dashboardState.dashboardQualityScorecard.qaEvidence", qaEvidence, "note");
      const verifiedQaStatuses = new Set([
        "verified",
        "passed",
        "browser-verified",
        "current-browser-verified",
      ]);
      if (
        isFiniteNumber(dashboardQualityScorecard.uiUxDesignScore) &&
        isFiniteNumber(dashboardQualityScorecard.targetScore) &&
        dashboardQualityScorecard.uiUxDesignScore >= dashboardQualityScorecard.targetScore &&
        !verifiedQaStatuses.has(String(qaEvidence.status || "").toLowerCase())
      ) {
        errors.push(
          "dashboardState.dashboardQualityScorecard.uiUxDesignScore must stay below targetScore until qaEvidence.status is verified or passed"
        );
      }
    }

    const modernWebUiPolicy = requireObject(
      errors,
      "dashboardState.dashboardQualityScorecard.modernWebUiPolicy",
      dashboardQualityScorecard.modernWebUiPolicy
    );
    if (modernWebUiPolicy != null) {
      requireStringField(
        errors,
        "dashboardState.dashboardQualityScorecard.modernWebUiPolicy",
        modernWebUiPolicy,
        "sourceBaseline"
      );
      requireStringField(
        errors,
        "dashboardState.dashboardQualityScorecard.modernWebUiPolicy",
        modernWebUiPolicy,
        "liveRequirement"
      );
      requireStringField(
        errors,
        "dashboardState.dashboardQualityScorecard.modernWebUiPolicy",
        modernWebUiPolicy,
        "htmlInCanvasPolicy"
      );
      requireStringField(
        errors,
        "dashboardState.dashboardQualityScorecard.modernWebUiPolicy",
        modernWebUiPolicy,
        "qaGate"
      );
    }

    const dimensions = requireArray(
      errors,
      "dashboardState.dashboardQualityScorecard.dimensions",
      dashboardQualityScorecard.dimensions
    );
    if (dimensions != null) {
      for (const [index, item] of dimensions.entries()) {
        const dimension = requireObject(
          errors,
          `dashboardState.dashboardQualityScorecard.dimensions[${index}]`,
          item
        );
        if (dimension == null) {
          continue;
        }
        requireStringField(errors, `dashboardState.dashboardQualityScorecard.dimensions[${index}]`, dimension, "id");
        requireStringField(errors, `dashboardState.dashboardQualityScorecard.dimensions[${index}]`, dimension, "label");
        requireNumberField(errors, `dashboardState.dashboardQualityScorecard.dimensions[${index}]`, dimension, "score");
        requireStringArrayField(errors, `dashboardState.dashboardQualityScorecard.dimensions[${index}]`, dimension, "evidenceRefs");
        if (
          qaEvidence != null &&
          isFiniteNumber(dashboardQualityScorecard.targetScore) &&
          isFiniteNumber(dimension.score) &&
          dimension.score >= dashboardQualityScorecard.targetScore
        ) {
          const verifiedQaStatuses = new Set([
            "verified",
            "passed",
            "browser-verified",
            "current-browser-verified",
          ]);
          if (!verifiedQaStatuses.has(String(qaEvidence.status || "").toLowerCase())) {
            errors.push(
              `dashboardState.dashboardQualityScorecard.dimensions[${index}].score must stay below targetScore until qaEvidence.status is verified or passed`
            );
          }
        }
      }
    }
  }

  if (workspace != null && kpiProfile != null && kpis != null) {
    const projectType = workspace.projectType as ProjectType | undefined;
    const primaryDomains = Array.isArray(workspace.primaryDomains)
      ? workspace.primaryDomains.map((item) => String(item))
      : [];
    const domainMode = inferDashboardDomainMode(projectType);
    const expectedProfile = getDashboardKpiProfile({
      domainMode,
      projectType,
      primaryDomains,
    });
    const actualKpiIds = new Set(
      kpis
        .filter((item): item is Record<string, unknown> => isPlainObject(item))
        .map((item) => String(item.id))
    );
    if (kpiProfile.id !== expectedProfile.id) {
      errors.push(
        `dashboardState.kpiProfile.id must be "${expectedProfile.id}" for projectType "${String(
          projectType ?? "other"
        )}"`
      );
    }
    for (const requiredKpiId of expectedProfile.requiredKpiIds) {
      if (!actualKpiIds.has(requiredKpiId)) {
        errors.push(
          `dashboardState.kpis is missing required KPI "${requiredKpiId}" for profile "${expectedProfile.id}"`
        );
      }
    }

    if (governanceState != null) {
      const governanceRequiredKpis = Array.isArray(governanceState.requiredKpiIds)
        ? new Set(governanceState.requiredKpiIds.map((item) => String(item)))
        : new Set<string>();
      for (const requiredKpiId of expectedProfile.requiredKpiIds) {
        if (!governanceRequiredKpis.has(requiredKpiId)) {
          errors.push(
            `dashboardState.governanceState.requiredKpiIds is missing required KPI "${requiredKpiId}"`
          );
        }
      }
    }
  }

  if (domainStress != null) {
    const activeProfileIds = Array.isArray(domainStress.activeProfileIds)
      ? domainStress.activeProfileIds.map((item) => String(item))
      : [];
    const profiles = Array.isArray(domainStress.profiles)
      ? domainStress.profiles.filter((item): item is Record<string, unknown> => isPlainObject(item))
      : [];
    const matrix = isPlainObject(root.claimEvidenceMatrix) ? root.claimEvidenceMatrix : {};
    const claims = Array.isArray(matrix.claims)
      ? matrix.claims.filter((item): item is Record<string, unknown> => isPlainObject(item))
      : [];
    const gaps = Array.isArray(matrix.missingEvidenceItems)
      ? matrix.missingEvidenceItems.filter((item): item is Record<string, unknown> => isPlainObject(item))
      : [];
    const decisions = Array.isArray(root.decisionContracts)
      ? root.decisionContracts.filter((item): item is Record<string, unknown> => isPlainObject(item))
      : [];
    const timelineObject = isPlainObject(root.workTimeline) ? root.workTimeline : {};
    const timelineItems = Array.isArray(timelineObject.items)
      ? timelineObject.items.filter((item): item is Record<string, unknown> => isPlainObject(item))
      : [];
    const workMap = isPlainObject(root.workReadinessMap) ? root.workReadinessMap : {};
    const workRows = Array.isArray(workMap.rows)
      ? workMap.rows.filter((item): item is Record<string, unknown> => isPlainObject(item))
      : [];
    const queues = isPlainObject(root.taskQueues) ? root.taskQueues : {};
    const queuedIds = new Set(
      ["waiting", "inProgress", "completed", "blocked", "needsUser"]
        .flatMap((key) => Array.isArray(queues[key]) ? queues[key].map((item) => String(item)) : [])
    );
    const claimIds = new Set(claims.map((claim) => String(claim.claimId)));
    const gapIds = new Set(gaps.map((gap) => String(gap.id)));
    const decisionIds = new Set(decisions.map((decision) => String(decision.id)));
    const timelineIds = new Set(timelineItems.map((item) => String(item.id)));
    const workRowIds = new Set(workRows.map((item) => String(item.id)));
    const operationPrograms = domainOperations != null && Array.isArray(domainOperations.programs)
      ? domainOperations.programs.filter((item): item is Record<string, unknown> => isPlainObject(item))
      : [];
    const operationProgramIds = new Set(operationPrograms.map((program) => String(program.profileId)));

    for (const profileId of activeProfileIds) {
      const profile = profiles.find((item) => String(item.id) === profileId);
      if (profile == null) {
        errors.push(`dashboardState.domainStress.profiles is missing active profile "${profileId}"`);
        continue;
      }
      const claimId = `claim.domain.${profileId}.readiness`;
      const decisionId = `decision.domain-stress.${profileId}`;
      if (!claimIds.has(claimId)) {
        errors.push(`dashboardState.claimEvidenceMatrix.claims is missing domain readiness claim "${claimId}"`);
      }
      if (!decisionIds.has(decisionId)) {
        errors.push(`dashboardState.decisionContracts is missing domain decision "${decisionId}"`);
      }
      if (!operationProgramIds.has(profileId)) {
        errors.push(`dashboardState.domainOperations.programs is missing active profile "${profileId}"`);
      }
      const evidenceGates = Array.isArray(profile.evidenceGates)
        ? profile.evidenceGates.filter((item): item is Record<string, unknown> => isPlainObject(item))
        : [];
      for (const gate of evidenceGates) {
        const gateId = String(gate.id);
        const taskId = `task.${gateId}`;
        if (!gapIds.has(gateId)) {
          errors.push(`dashboardState.claimEvidenceMatrix.missingEvidenceItems is missing domain gate "${gateId}"`);
        }
        if (!timelineIds.has(taskId)) {
          errors.push(`dashboardState.workTimeline.items is missing domain task "${taskId}"`);
        }
        if (!workRowIds.has(taskId)) {
          errors.push(`dashboardState.workReadinessMap.rows is missing domain task "${taskId}"`);
        }
        if (!queuedIds.has(taskId)) {
          errors.push(`dashboardState.taskQueues is missing domain task "${taskId}"`);
        }
      }
    }
    const blockedGateIds = new Set(
      gaps
        .filter((gap) => gap.blocksReadiness !== false)
        .map((gap) => String(gap.id))
    );
    const reportSections = Array.isArray(domainStress.reportSections)
      ? domainStress.reportSections.filter((item): item is Record<string, unknown> => isPlainObject(item))
      : [];
    for (const section of reportSections) {
      const profile = profiles.find((item) => String(item.id) === String(section.profileId));
      const evidenceGates = profile != null && Array.isArray(profile.evidenceGates)
        ? profile.evidenceGates.filter((item): item is Record<string, unknown> => isPlainObject(item))
        : [];
      const sectionGateIds = evidenceGates
        .filter((gate) => String(gate.reportSection) === String(section.section))
        .map((gate) => String(gate.id));
      const expectedStatus = sectionGateIds.some((id) => blockedGateIds.has(id)) ? "blocked" : "resolved";
      if (
        sectionGateIds.length > 0 &&
        expectedStatus === "resolved" &&
        String(section.status) !== "resolved"
      ) {
        errors.push(
          `dashboardState.domainStress.reportSections section "${String(
            section.section
          )}" must be resolved after all section gates are resolved`
        );
      }
      if (
        sectionGateIds.length > 0 &&
        expectedStatus === "blocked" &&
        String(section.status) === "resolved"
      ) {
        errors.push(
          `dashboardState.domainStress.reportSections section "${String(
            section.section
          )}" cannot be resolved while section gates are still blocked`
        );
      }
    }
    const operationEntries = domainOperations == null
      ? []
      : Object.entries(domainOperations).filter(
          ([programKey, value]) =>
            !["schemaVersion", "activeProfileIds", "status", "dashboardQuestion", "programs"].includes(programKey) &&
            isPlainObject(value)
        );
    for (const [programKey, programValue] of operationEntries) {
      const program = isPlainObject(programValue)
        ? programValue as Record<string, unknown>
        : null;
      if (program == null) {
        continue;
      }
      const operationSections = [
        ...(Array.isArray(program.sections) ? program.sections : []),
        ...(Array.isArray(program.domains) ? program.domains : []),
        ...(Array.isArray(program.pipelines) ? program.pipelines : []),
      ].filter((item): item is Record<string, unknown> => isPlainObject(item));
      for (const section of operationSections) {
        const gateIds = Array.isArray(section.evidenceGateIds)
          ? section.evidenceGateIds.map((item) => String(item))
          : [];
        if (gateIds.length === 0) {
          continue;
        }
        const expectedStatus = gateIds.some((id) => blockedGateIds.has(id)) ? "blocked" : "resolved";
        if (expectedStatus === "resolved" && String(section.status) !== "resolved") {
          errors.push(
            `dashboardState.domainOperations.${programKey} section "${String(
              section.id ?? section.label
            )}" must be resolved after all section gates are resolved`
          );
        }
        if (expectedStatus === "blocked" && String(section.status) === "resolved") {
          errors.push(
            `dashboardState.domainOperations.${programKey} section "${String(
              section.id ?? section.label
            )}" cannot be resolved while section gates are still blocked`
          );
        }
      }
    }
  }

  if (sessionLog != null && governedSessions != null) {
    const governedSessionIds = new Set(
      governedSessions
        .filter((item): item is Record<string, unknown> => isPlainObject(item))
        .map((item) => String(item.id))
    );
    for (const session of sessionLog) {
      if (isPlainObject(session) && isString(session.id) && !governedSessionIds.has(session.id)) {
        errors.push(
          `dashboardState.governedSessions is missing a governed entry for session "${session.id}"`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
