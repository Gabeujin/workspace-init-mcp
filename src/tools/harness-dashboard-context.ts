import * as fs from "node:fs";
import * as path from "node:path";

export interface HarnessDashboardContextOptions {
  workspacePath: string;
  view?: "agent" | "stakeholder" | "maintainer" | "full";
  query?: string;
  limit?: number;
}

export interface HarnessDashboardContextResult {
  workspacePath: string;
  readOnly: true;
  sourceFiles: string[];
  summary: string;
  context: Record<string, unknown>;
  queryResults: Array<{ path: string; value: unknown }>;
}

function readJsonFile(fullPath: string): unknown {
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

function safeReadJson(fullPath: string): unknown | null {
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return readJsonFile(fullPath);
}

function visit(
  value: unknown,
  needle: string,
  results: Array<{ path: string; value: unknown }>,
  currentPath: string,
  limit: number
): void {
  if (results.length >= limit) {
    return;
  }

  if (
    typeof value === "string" &&
    value.toLowerCase().includes(needle)
  ) {
    results.push({ path: currentPath, value });
    return;
  }

  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    if (String(value).toLowerCase().includes(needle)) {
      results.push({ path: currentPath, value });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      visit(item, needle, results, `${currentPath}[${index}]`, limit);
    });
    return;
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      visit(item, needle, results, currentPath ? `${currentPath}.${key}` : key, limit);
      if (results.length >= limit) {
        return;
      }
    }
  }
}

export function getHarnessDashboardContext(
  options: HarnessDashboardContextOptions
): HarnessDashboardContextResult {
  const dashboardStatePath = path.join(
    options.workspacePath,
    "docs",
    "ai-harness",
    "dashboard",
    "state",
    "dashboard-state.json"
  );
  const dashboardIndexPath = path.join(
    options.workspacePath,
    "docs",
    "ai-harness",
    "dashboard",
    "state",
    "dashboard-index.json"
  );
  const dashboardRuntimePath = path.join(
    options.workspacePath,
    "docs",
    "ai-harness",
    "dashboard",
    "state",
    "dashboard-runtime.json"
  );
  const ledgerManifestPath = path.join(
    options.workspacePath,
    "docs",
    "ai-harness",
    "dashboard",
    "events",
    "ledger-manifest.json"
  );

  const state = safeReadJson(dashboardStatePath) as Record<string, unknown> | null;
  const index = safeReadJson(dashboardIndexPath) as Record<string, unknown> | null;
  const runtime = safeReadJson(dashboardRuntimePath) as Record<string, unknown> | null;
  const manifest = safeReadJson(ledgerManifestPath) as Record<string, unknown> | null;

  if (state == null && index == null) {
    throw new Error(
      "Harness Dashboard projections were not found. Run initialize_workspace or dashboard-ops.mjs rebuild-projections first."
    );
  }

  const fullState = state ?? {};
  const compactIndex = index ?? {};
  const view = options.view ?? "agent";
  const agentResumeBrief = fullState.agentResumeBrief ?? compactIndex.agentResumeBrief;
  const stakeholderBrief =
    fullState.stakeholderBrief ?? compactIndex.stakeholderBrief;
  const governanceEvidenceBrief = fullState.governanceEvidenceBrief;
  const goalCompass = fullState.goalCompass ?? compactIndex.goalCompass;
  const realityModel = fullState.realityModel ?? compactIndex.realityModel;
  const contextRotMonitor =
    fullState.contextRotMonitor ?? compactIndex.contextRotMonitor;
  const harnessEvaluation =
    fullState.harnessEvaluation ?? compactIndex.harnessEvaluation;
  const cognitiveOffloading =
    fullState.cognitiveOffloading ?? compactIndex.cognitiveOffloading;
  const projectionConfidence =
    fullState.projectionConfidence ?? compactIndex.projectionConfidence;
  const sessionTraceability =
    fullState.sessionTraceability ?? compactIndex.sessionTraceability;
  const userRealityCheck =
    fullState.userRealityCheck ?? compactIndex.userRealityCheck;
  const agentResumeRecord =
    (agentResumeBrief as Record<string, unknown> | undefined) ?? {};
  const governanceEvidenceRecord =
    (governanceEvidenceBrief as Record<string, unknown> | undefined) ?? {};
  const worldJudgmentRecord =
    (fullState.worldJudgment as Record<string, unknown> | undefined) ?? {};
  const judgmentConsoleRecord =
    (fullState.judgmentConsole as Record<string, unknown> | undefined) ?? {};
  const contextRotRecord =
    (contextRotMonitor as Record<string, unknown> | undefined) ?? {};

  const context =
    view === "full"
      ? {
          index: compactIndex,
          runtime,
          manifest,
          state: fullState,
        }
      : view === "stakeholder"
        ? {
            realityModel,
            goalCompass,
            contextRotMonitor,
            harnessEvaluation,
            cognitiveOffloading,
            projectionConfidence,
            sessionTraceability,
            userRealityCheck,
            worldJudgment: fullState.worldJudgment,
            audienceLens: fullState.audienceLens,
            criticalSignals: fullState.criticalSignals,
            stakeholderBrief,
            readinessJudgments: fullState.readinessJudgments,
            claimEvidenceMatrix: fullState.claimEvidenceMatrix,
            taskQueues: fullState.taskQueues,
            workTimeline: fullState.workTimeline,
            decisions: fullState.decisionContracts,
            evidence: governanceEvidenceBrief,
            worldModelCompleteness: fullState.worldModelCompleteness,
          }
        : view === "maintainer"
          ? {
              realityModel,
              goalCompass,
              contextRotMonitor,
              harnessEvaluation,
              cognitiveOffloading,
              projectionConfidence,
              sessionTraceability,
              userRealityCheck,
              worldJudgment: fullState.worldJudgment,
              audienceLens: fullState.audienceLens,
              criticalSignals: fullState.criticalSignals,
              runtime,
              versionControl: fullState.versionControl,
              vcsChangeRecords: fullState.vcsChangeRecords,
              serviceRegistry: fullState.serviceRegistry,
              environments: (fullState.projectWorldModel as Record<string, unknown> | undefined)
                ?.environments,
              releaseReadiness: fullState.releaseReadiness,
              incidentReadiness: fullState.incidentReadiness,
              databaseReadiness: fullState.databaseReadiness,
            }
          : {
              resumePacket: {
                currentReality:
                  (goalCompass as Record<string, unknown> | undefined)
                    ?.currentReality ?? worldJudgmentRecord.summary,
                goalState:
                  (goalCompass as Record<string, unknown> | undefined)
                    ?.goalState ?? stakeholderBrief,
                nextSafeMove:
                  (goalCompass as Record<string, unknown> | undefined)
                    ?.nextSafeMove ?? agentResumeRecord.nextSafestAction,
                blockedActions:
                  judgmentConsoleRecord.blockedActions ??
                  worldJudgmentRecord.blockedActions ??
                  [],
                authoritativeFiles:
                  agentResumeRecord.authoritativeFiles ??
                  compactIndex.authoritativeFiles,
                harnessScore:
                  (harnessEvaluation as Record<string, unknown> | undefined)
                    ?.score,
              },
              rotWarnings: contextRotRecord.rotWarnings ?? [],
              blockedActions:
                judgmentConsoleRecord.blockedActions ??
                worldJudgmentRecord.blockedActions ??
                [],
              nextEvidenceToCollect:
                contextRotRecord.nextEvidenceToCollect ??
                governanceEvidenceRecord.missingEvidenceClaims ??
                [],
              realityModel,
              goalCompass,
              contextRotMonitor,
              harnessEvaluation,
              cognitiveOffloading,
              projectionConfidence,
              sessionTraceability,
              userRealityCheck,
              worldJudgment: fullState.worldJudgment,
              criticalSignals: fullState.criticalSignals,
              readinessJudgments: fullState.readinessJudgments,
            governanceActionabilityScore: fullState.governanceActionabilityScore,
            worldModelImprovementContract: fullState.worldModelImprovementContract,
            agentPlatformGovernance: fullState.agentPlatformGovernance,
            audienceLens: fullState.audienceLens,
            claimEvidenceMatrix: fullState.claimEvidenceMatrix,
              agentContextPacks: fullState.agentContextPacks,
              agentResumeBrief,
              stakeholderBrief,
              taskQueues: fullState.taskQueues,
              workTimeline: fullState.workTimeline,
              openDecisions: fullState.decisionContracts,
              authoritativeFiles:
                (agentResumeBrief as Record<string, unknown> | undefined)
                  ?.authoritativeFiles ?? compactIndex.authoritativeFiles,
              runtime,
              manifest,
            };

  const queryResults: Array<{ path: string; value: unknown }> = [];
  const query = options.query?.trim().toLowerCase();
  if (query) {
    visit(context, query, queryResults, "", Math.max(1, options.limit ?? 20));
  }

  const sourceFiles = [
    dashboardIndexPath,
    dashboardStatePath,
    dashboardRuntimePath,
    ledgerManifestPath,
  ].filter((fullPath) => fs.existsSync(fullPath));

  return {
    workspacePath: options.workspacePath,
    readOnly: true,
    sourceFiles,
    summary:
      "Read dashboard projections only; no listener startup, VCS refresh, ledger append, shell execution, file write, or LLM call was performed.",
    context,
    queryResults,
  };
}
