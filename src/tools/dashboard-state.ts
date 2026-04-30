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
