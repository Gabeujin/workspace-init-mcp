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
    for (const programKey of ["commerceOperations", "modernizationGovernance", "contentRelease"]) {
      const program = domainOperations != null && isPlainObject(domainOperations[programKey])
        ? domainOperations[programKey] as Record<string, unknown>
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
