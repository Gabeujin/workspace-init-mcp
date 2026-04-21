/**
 * Strict validation helpers for the generated AI harness dashboard state.
 */

import { type ProjectType } from "../types.js";
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

export function validateDashboardStateShape(
  value: unknown
): DashboardStateValidationResult {
  const errors: string[] = [];
  const root = requireObject(errors, "dashboardState", value);

  if (root == null) {
    return { valid: false, errors };
  }

  const requiredTopLevelKeys = [
    "meta",
    "workspace",
    "executiveSummary",
    "progressState",
    "governanceState",
    "kpiProfile",
    "kpis",
    "errors",
    "gitStatus",
    "sessionLog",
    "governedSessions",
    "artifacts",
    "domainLens",
    "timeline",
    "entities",
    "versionLedger",
  ];

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

  if (workspace != null && kpiProfile != null && kpis != null) {
    const projectType = workspace.projectType as ProjectType | undefined;
    const domainMode = inferDashboardDomainMode(projectType);
    const expectedProfile = getDashboardKpiProfile({
      domainMode,
      projectType,
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
