import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const initModule = await import("../dist/tools/initialize.js");
const validateModule = await import("../dist/tools/validate.js");
const reconcileModule = await import("../dist/tools/reconcile.js");
const dashboardContextModule = await import("../dist/tools/harness-dashboard-context.js");
const dashboardStateModule = await import("../dist/tools/dashboard-state.js");
const dashboardStateContractModule = await import("../dist/data/dashboard-state-contract.js");
const harnessRuntimeModule = await import("../dist/tools/harness-runtime.js");
const formSchemaModule = await import("../dist/tools/form-schema.js");
const serverFlowDashboardModule = await import("../dist/generators/server-flow-dashboard.js");
const agentSkillsRegistryModule = await import("../dist/data/agent-skills-registry.js");
const agentSkillsGeneratorModule = await import("../dist/generators/agent-skills.js");

const { collectFiles, buildSummary } = initModule;
const { validateWorkspace } = validateModule;
const { reconcileWorkspaceInitialization } = reconcileModule;
const { getHarnessDashboardContext } = dashboardContextModule;
const { validateDashboardStateShape } = dashboardStateModule;
const { DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS } = dashboardStateContractModule;
const {
  startHarnessSession,
  advanceHarnessSession,
  listHarnessSessions,
  getHarnessSessionLog,
  auditHarnessRuntime,
  auditHarnessParallelChunkConflicts,
  recordHarnessExecutionResult,
} = harnessRuntimeModule;
const { buildInitFormSchema } = formSchemaModule;
const { generateServerFlowDashboardFiles } = serverFlowDashboardModule;
const { recommendAgentSkills, SKILL_REGISTRY, AGENT_REGISTRY } = agentSkillsRegistryModule;
const { generateSelectedSkills } = agentSkillsGeneratorModule;
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
const CURRENT_VERSION = packageJson.version;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

{
  const indexSource = fs.readFileSync(path.join(process.cwd(), "src/index.ts"), "utf-8");
  const versionSource = fs.readFileSync(path.join(process.cwd(), "src/data/version.ts"), "utf-8");
  const readmeSource = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  const versionPattern = escapeRegExp(CURRENT_VERSION);
  assert.match(versionSource, new RegExp(`WORKSPACE_INIT_MCP_VERSION\\s*=\\s*"${versionPattern}"`));
  assert.match(readmeSource, new RegExp(`Version \`${versionPattern}\``));
  assert.match(readmeSource, new RegExp(`## ${versionPattern} Release Notes`));
  assert.doesNotMatch(readmeSource, /4\.6\.1/);
  assert.match(indexSource, /domainStressProfile:\s*z/);
  assert.match(indexSource, /legacyAdoptionProfile:\s*z/);
  assert.match(indexSource, /primaryDomains:\s*z/);

  const initForm = buildInitFormSchema();
  const domainStressField = initForm.sections
    .flatMap((section) => section.fields)
    .find((field) => field.name === "domainStressProfile");
  assert.ok(domainStressField);
  assert.equal(domainStressField.type, "text");
  assert.ok(domainStressField.options.some((option) => option.value === "identity-commerce-operations"));
}

function createParams(workspacePath) {
  return {
    workspaceName: "Harness Workspace",
    purpose: `Verify Harness Dashboard ${CURRENT_VERSION} Hypertext Project World Model generation`,
    workspacePath,
    projectType: "web-app",
    techStack: ["TypeScript", "Node.js"],
    includeAgentSkills: true,
    includeHarnessEngineering: true,
    targetIDEs: ["vscode"],
    governanceProfile: "strict",
    autonomyMode: "balanced",
    tokenBudget: "balanced",
  };
}

function createWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "workspace-init-mcp-4-6-"));
}

function writeGeneratedFiles(rootDir, files) {
  for (const file of files) {
    const fullPath = path.join(rootDir, file.relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content, "utf-8");
  }
}

function generateWorkspace() {
  const root = createWorkspace();
  const params = createParams(root);
  const files = collectFiles(params);
  writeGeneratedFiles(root, files);
  return { root, params, files };
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf-8"));
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    encoding: "utf-8",
    windowsHide: true,
    ...options,
    env: {
      ...process.env,
      WORKSPACE_INIT_DASHBOARD_AUTOSTART: "0",
      ...(options.env || {}),
    },
  });
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAvailablePort() {
  return await new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.equal(typeof address, "object");
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForFile(filePath, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) {
      return;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function waitForText(getText, pattern, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = getText();
    if (pattern.test(text)) {
      return text;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${pattern}`);
}

async function terminateProcess(childProcess) {
  if (childProcess.exitCode != null) {
    return;
  }
  childProcess.kill();
  await Promise.race([
    new Promise((resolve) => childProcess.once("exit", resolve)),
    delay(2000),
  ]);
}

async function waitForSseEvent(endpoint, eventName, timeoutMs = 5000) {
  return await new Promise((resolve, reject) => {
    const request = http.get(endpoint);
    const timer = setTimeout(() => {
      request.destroy();
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    request.on("response", (response) => {
      response.setEncoding("utf-8");
      response.on("data", (chunk) => {
        const text = String(chunk);
        if (text.includes(`event: ${eventName}`)) {
          clearTimeout(timer);
          request.destroy();
          resolve(text);
        }
      });
    });
    request.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

{
  const { root, params, files } = generateWorkspace();
  const byPath = new Map(files.map((file) => [file.relativePath, file]));

  assert.equal(
    files.some((file) => file.relativePath.startsWith("server-flow-dashboard/")),
    false,
    "server flow monitoring dashboard must not be generated by default"
  );

  for (const requiredPath of [
    "AGENTS.md",
    "docs/ai-harness/dashboard/events/harness-events.jsonl",
    "docs/ai-harness/dashboard/events/ledger-manifest.json",
    "docs/ai-harness/dashboard/entities/project-world-model.json",
    "docs/ai-harness/dashboard/entities/reality-model.json",
    "docs/ai-harness/dashboard/entities/goal-compass.json",
    "docs/ai-harness/dashboard/entities/context-rot-monitor.json",
    "docs/ai-harness/dashboard/evaluations/harness-evaluation.json",
    "docs/ai-harness/dashboard/state/dashboard-state.json",
    "docs/ai-harness/dashboard/state/dashboard-index.json",
    "docs/ai-harness/dashboard/state/dashboard-runtime.json",
    "docs/ai-harness/dashboard/state/embedding-documents.json",
    "docs/ai-harness/dashboard/audience-lens-presentation-plan.md",
    "docs/ai-harness/domain-stress-playbooks.md",
    "docs/ai-harness/domain-stress-profiles.json",
    "docs/ai-harness/dashboard/schemas/events/harness-event.schema.json",
    "docs/ai-harness/dashboard/schemas/entities/project-world-model.schema.json",
    "docs/ai-harness/dashboard/schemas/projections/dashboard-state.schema.json",
    "docs/ai-harness/dashboard/design-framework.html",
    "docs/ai-harness/dashboard/state/design-profile.json",
    "docs/ai-harness/dashboard/backend-app-blueprint.html",
    "docs/context/context-index.md",
  ]) {
    assert.ok(byPath.has(requiredPath), `${requiredPath} should be generated`);
  }

  const state = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const dashboardStateSchema = JSON.parse(
    byPath.get("docs/ai-harness/dashboard/state/dashboard-state.schema.json").content
  );
  assert.ok(dashboardStateSchema.properties.claimEvidenceMatrix.properties.missingEvidenceItems);
  assert.ok(dashboardStateSchema.properties.dashboardQualityScorecard.properties.qaEvidence);
  assert.ok(dashboardStateSchema.properties.dashboardQualityScorecard.properties.modernWebUiPolicy);
  assert.ok(dashboardStateSchema.properties.projectionConfidence.properties.requiredActions);
  assert.ok(dashboardStateSchema.properties.sessionTraceability.properties.entries);
  assert.ok(dashboardStateSchema.properties.userRealityCheck.properties.actionPlan);
  for (const key of DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS) {
    assert.ok(key in state, `dashboard-state.json should include ${key}`);
  }
  assert.equal(state.meta.schemaVersion, CURRENT_VERSION);
  assert.equal(state.projectWorldModel.mission.statement, params.purpose);
  const legacyShape = JSON.parse(JSON.stringify(state));
  delete legacyShape.projectionConfidence;
  delete legacyShape.sessionTraceability;
  delete legacyShape.userRealityCheck;
  const legacyShapeValidation = validateDashboardStateShape(legacyShape);
  assert.equal(legacyShapeValidation.valid, true, legacyShapeValidation.errors.join("\n"));
  assert.equal(legacyShape.projectionConfidence.status, "projection-debt");
  assert.equal(legacyShape.sessionTraceability.status, "trace-debt");
  assert.equal(legacyShape.sessionTraceability.entries[0].traceIntegrity.status, "legacy-fallback");
  assert.equal(legacyShape.userRealityCheck.status, "legacy-backfill-action-plan");
  assert.ok(legacyShape.userRealityCheck.actionPlan[0].apiRoutes.includes("/api/harness-dashboard/v1/reality-check"));
  assert.equal(state.realityModel.nodes.some((node) => node.type === "repository"), true);
  assert.equal(state.realityModel.edges.some((edge) => edge.relation === "projects-world-model"), true);
  assert.match(state.goalCompass.currentReality, /Bootstrap harness/);
  assert.equal(state.goalCompass.topGaps.length >= 3, true);
  assert.equal(state.goalCompass.phaseGate.canImplementApplicationChange, false);
  assert.equal(state.goalCompass.phaseGate.goalTraceRequired, true);
  assert.equal(state.contextRotMonitor.rotWarnings.length >= 2, true);
  assert.equal(state.contextRotMonitor.factRecords.length >= 3, true);
  assert.ok(state.contextRotMonitor.nextEvidenceToCollect.includes("active AI platform declaration"));
  assert.equal(state.harnessEvaluation.status, "needs-evidence");
  assert.equal(state.harnessEvaluation.thresholdScore, 9.8);
  assert.equal(state.harnessEvaluation.score < state.harnessEvaluation.thresholdScore, true);
  assert.equal(
    state.harnessEvaluation.metrics.some((metric) => metric.status !== "pass" || metric.score < metric.thresholdScore),
    true
  );
  assert.match(state.harnessEvaluation.scoreMeaning, /Bootstrap starts below 9\.8/);
  assert.match(state.cognitiveOffloading.sourceInspiration, /stateful cognitive offloading/);
  assert.match(state.cognitiveOffloading.divisionOfLabor.agentKeeps, /review judgments/);
  assert.match(state.cognitiveOffloading.workingMemory.outerTier, /Durable file cabinet/);
  assert.match(state.cognitiveOffloading.verificationPolicy.negativeReviewLoop, /negative review/);
  assert.equal(state.listener.readOnly, true);
  assert.equal(state.embeddingProjection.policy.blockedByDefault.includes("secret"), true);
  assert.ok(Array.isArray(state.workTimeline.items));
  assert.deepEqual(state.workTimeline.items, []);
  assert.equal(state.worldJudgment.status, "bootstrap-not-ready-for-operational-judgment");
  assert.ok(Array.isArray(state.criticalSignals));
  assert.ok(Array.isArray(state.claimEvidenceMatrix.claims));
  assert.ok(Array.isArray(state.claimEvidenceMatrix.missingEvidenceItems));
  assert.ok(state.claimEvidenceMatrix.claims.some((claim) => Array.isArray(claim.falsificationTests)));
  assert.ok(Array.isArray(state.readinessJudgments));
  assert.equal(state.judgmentConsole.nextRequiredDecision, "decision-first-governed-goal");
  assert.equal(state.trustBoundary.status, "bootstrap-warning");
  assert.equal(state.projectionConfidence.status, "projection-debt");
  assert.equal(state.projectionConfidence.trustBoundaryStatus, "bootstrap-warning");
  assert.equal(state.projectionConfidence.missingEvidenceCount > 0, true);
  assert.ok(state.projectionConfidence.requiredActions.some((item) => /verify-projections/.test(item)));
  assert.equal(state.sessionTraceability.status, "bootstrap-trace-complete");
  assert.equal(state.sessionTraceability.entries[0].originalRequest, params.purpose);
  assert.match(state.sessionTraceability.entries[0].processSummary, /generated the Project World Model ledger/);
  assert.match(state.sessionTraceability.entries[0].resultSummary, /real VCS, service, owner, release, and operations evidence/);
  assert.equal(state.sessionTraceability.entries[0].traceIntegrity.status, "complete");
  assert.ok(state.sessionTraceability.entries[0].evidenceRefs.includes("docs/ai-harness/dashboard/index.html"));
  assert.equal(state.userRealityCheck.status, "bootstrap-action-plan");
  assert.equal(state.userRealityCheck.summary.readableWithoutRawJson, true);
  assert.ok(state.userRealityCheck.actionPlan.length >= 5);
  assert.equal(state.userRealityCheck.actionPlan[0].id, "action.verify-projections");
  assert.ok(state.userRealityCheck.actionPlan.every((item) => item.evidenceRequired.length > 0));
  assert.equal(state.userRealityCheck.summary.missingEvidenceCount, state.governanceEvidenceBrief.missingEvidenceClaims.length);
  assert.equal(state.userRealityCheck.summary.openDecisionCount, state.governanceEvidenceBrief.unresolvedDecisions.length);
  assert.equal(state.userRealityCheck.apiContract.route, "/api/harness-dashboard/v1/reality-check");
  assert.ok(state.userRealityCheck.apiContract.queryExamples.some((item) => item.includes("/evidence-ref?ref=")));
  assert.equal(state.governedSessions[0].taskTrace.originalRequest, params.purpose);
  assert.equal(state.governedSessions[0].traceIntegrity.status, "complete");
  assert.equal(state.dashboardQualityScorecard.uiUxDesignScore < 9.5, true);
  assert.equal(
    state.dashboardQualityScorecard.dimensions.every((dimension) => dimension.score < 9.5),
    true
  );
  assert.equal(state.governanceActionabilityScore.inputs.uiUxDesignScore < 9.5, true);
  assert.equal(state.governanceActionabilityScore.canPlan, true);
  assert.equal(state.governanceActionabilityScore.score >= 6.5, true);
  assert.ok(state.governanceActionabilityScore.operationalEvidenceScore < state.governanceActionabilityScore.score);
  assert.equal(state.agentPlatformGovernance.status, "awaiting-user-declaration");
  assert.ok(state.agentPlatformGovernance.activePlatforms.includes("vscode"));
  assert.equal(state.audienceLens.defaultMode, "stakeholder");
  assert.equal(state.audienceLens.modes.stakeholder.slideshowEnabled, true);
  assert.equal(state.audienceLens.modes.maintainer.slideshowEnabled, true);
  assert.match(state.audienceLens.principle, /same ledger-backed truth/);
  assert.equal(state.dashboardQualityScorecard.qaEvidence.status, "pending-run");
  assert.ok(state.dashboardQualityScorecard.qaEvidence.requiredFor95.includes("rendered-browser-smoke"));
  assert.ok(state.dashboardQualityScorecard.qaEvidence.requiredFor95.includes("live-sse-or-refresh-path-check"));
  assert.match(state.dashboardQualityScorecard.modernWebUiPolicy.htmlInCanvasPolicy, /progressive enhancement/);
  assert.match(state.dashboardQualityScorecard.modernWebUiPolicy.liveRequirement, /SSE/);
  assert.ok(state.decisionContracts.some((decision) => decision.id === "decision-agent-platform-selection"));
  assert.ok(state.governanceEvidenceBrief.unresolvedDecisions.includes("decision-agent-platform-selection"));
  assert.ok(state.agentResumeBrief.governanceOnlyDecisions.includes("decision-agent-platform-selection"));
  assert.match(state.worldModelImprovementContract.purpose, /more truthful/);
  assert.ok(state.worldModelImprovementContract.maturityLoop.some((item) => item.includes("realityModel")));
  assert.ok(state.agentContextPacks.agent.mustRead.includes("worldModelImprovementContract"));
  assert.ok(state.agentContextPacks.agent.mustRead.includes("goalCompass"));
  assert.ok(state.agentContextPacks.agent.mustRead.includes("realityModel"));
  assert.ok(state.agentContextPacks.agent.mustRead.includes("contextRotMonitor"));
  assert.ok(state.agentContextPacks.agent.mustRead.includes("harnessEvaluation"));
  assert.ok(state.agentContextPacks.agent.mustRead.includes("cognitiveOffloading"));
  assert.ok(state.agentContextPacks.agent.mustRead.includes("agentPlatformGovernance"));
  assert.ok(Array.isArray(state.workReadinessMap.rows));
  assert.ok(Array.isArray(state.projectEvidenceInventory.sources));
  assert.ok(state.valueHierarchy.values.some((item) => item.id === "value-user-outcome"));
  assert.ok(state.claimEvidenceMatrix.claims.some((claim) => claim.claimId === "claim.data.integrity"));
  assert.deepEqual(state.taskQueues.waiting, []);
  assert.deepEqual(state.taskQueues.blocked, []);
  assert.ok(state.agentTaskQueues.waiting.includes("task-bootstrap-refresh-projections"));
  assert.ok(state.agentTaskQueues.hiddenFromUserTaskBoard.includes("task-bootstrap-refresh-projections"));
  assert.ok(state.agentTaskQueues.maintenance.some((item) => item.id === "task-bootstrap-refresh-projections" && item.queueVisibility === "agent-only"));
  assert.deepEqual(state.userTaskBoard.current, []);
  assert.deepEqual(state.userTaskBoard.remaining, []);
  assert.deepEqual(state.userTaskBoard.completed, []);
  assert.ok(state.userTaskBoard.hiddenAgentTaskIds.includes("task-bootstrap-refresh-projections"));
  assert.equal(state.taskQueues.needsUser.includes("decision-agent-platform-selection"), false);
  assert.equal(state.claimEvidenceMatrix.missingEvidenceItems.find((item) => item.id === "missing.database-readiness").blocksClaimIds.includes("claim.service.operational-readiness"), false);
  assert.equal(state.kpis.some((kpi) => kpi.id === "commerce-payment-integrity"), false);
  assert.deepEqual(state.domainStress.activeProfileIds, []);
  assert.deepEqual(state.domainOperations.activeProfileIds, []);
  assert.equal(state.domainOperations.status, "no-active-domain-stress-profile");
  const baselineTaskIds = new Set([
    ...state.agile.backlog.map((item) => item.id),
    ...state.agileCadence.backlog.map((item) => item.id),
    ...state.workTimeline.items.map((item) => item.id),
    ...state.workReadinessMap.rows.map((item) => item.id),
    ...state.userTaskBoard.current,
    ...state.userTaskBoard.remaining,
    ...state.userTaskBoard.completed,
  ]);
  assert.equal(baselineTaskIds.has("task-bootstrap-refresh-projections"), false);
  assert.equal(baselineTaskIds.has("task-confirm-agent-platforms"), false);
  assert.equal(baselineTaskIds.has("task-map-deployment-target"), false);
  assert.equal(baselineTaskIds.has("task-map-data-readiness"), false);

  const html = byPath.get("docs/ai-harness/dashboard/index.html").content;
  const audiencePlan = byPath.get("docs/ai-harness/dashboard/audience-lens-presentation-plan.md").content;
  const domainStressPlaybook = byPath.get("docs/ai-harness/domain-stress-playbooks.md").content;
  const domainStressProfiles = JSON.parse(byPath.get("docs/ai-harness/domain-stress-profiles.json").content);
  assert.match(audiencePlan, /Audience Lens is not a cosmetic selector/);
  assert.match(audiencePlan, /Slideshow Contract/);
  assert.match(domainStressPlaybook, /Identity Commerce Operations/);
  assert.match(domainStressPlaybook, /Legacy Modernization Governance/);
  assert.match(domainStressPlaybook, /Content Release Governance/);
  assert.ok(domainStressProfiles.profiles.some((profile) => profile.id === "identity-commerce-operations"));
  assert.ok(domainStressProfiles.profiles.some((profile) => profile.id === "legacy-modernization-governance"));
  assert.ok(domainStressProfiles.profiles.some((profile) => profile.id === "content-release-governance"));
  assert.match(html, /Harness Adoption Guide/);
  assert.match(html, /Governance Setup/);
  assert.match(html, /Operational evidence/);
  assert.match(html, /Executive Overview/);
  assert.match(html, /Audience Lens/);
  assert.match(html, /Language/);
  assert.match(html, /Report focus/);
  assert.match(html, /Slide Show View/);
  assert.match(html, /data-slideshow-open/);
  assert.match(html, /data-report-focus/);
  assert.match(html, /data-focus-work/);
  assert.match(html, /data-jump-tab/);
  assert.match(html, /data-ops-lens/);
  assert.match(html, /data-report-copy/);
  assert.match(html, /report-brief-preview/);
  assert.match(html, /projection-warning/);
  assert.match(html, /projection-confidence/);
  assert.match(html, /Projection Confidence/);
  assert.match(html, /Session Traceability/);
  assert.match(html, /User Reality Check/);
  assert.match(html, /renderUserRealityCheck/);
  assert.match(html, /data-evidence-ref/);
  assert.match(html, /data-api-route/);
  assert.match(html, /lookupEvidenceRef/);
  assert.match(html, /lookupApiRoute/);
  assert.match(html, /api\/harness-dashboard\/v1\/evidence-ref/);
  assert.match(html, /evidenceStructuredResult/);
  assert.match(html, /evidence-rank-strip/);
  assert.match(html, /matchQuality/);
  assert.match(html, /canonicalPath/);
  assert.match(html, /command-line/);
  assert.match(html, /api-preview/);
  assert.match(html, /slideDeckKeyboardHelp/);
  assert.match(html, /deck-status/);
  assert.doesNotMatch(html, /scope=all&q=/);
  assert.match(html, /renderProjectionConfidence/);
  assert.match(html, /renderSessionTraceability/);
  assert.match(html, /originalRequest/);
  assert.match(html, /traceIntegrity/);
  assert.match(html, /Maintainer Report Deck/);
  assert.match(html, /slide-deck/);
  assert.match(html, /world-prism/);
  assert.match(html, /ops-command/);
  assert.match(html, /Operator Insight Panel/);
  assert.match(html, /Claim-action graph/);
  assert.match(html, /renderReportLab/);
  assert.match(html, /buildReportItems/);
  assert.match(html, /buildReportBrief/);
  assert.match(html, /renderOperatorLensPanel/);
  assert.match(html, /renderDomainStressBoard/);
  assert.match(html, /Domain Operations Projection/);
  assert.match(html, /__HARNESS_STATIC_EXPORT__/);
  assert.match(html, /requestFullscreen/);
  assert.match(html, /aria-hidden/);
  assert.match(html, /inert/);
  assert.match(html, /lens-stakeholder/);
  assert.match(html, /tabLabel/);
  assert.match(html, /renderStakeholderReport/);
  assert.match(html, /renderAgentResumeBoard/);
  assert.match(html, /renderMaintainerHealthBoard/);
  assert.match(html, /Current Judgment Console/);
  assert.match(html, /Reality And Goal Compass/);
  assert.match(html, /Reality & Next Actions Hub/);
  assert.match(html, /renderRealityNextActionsHub/);
  assert.match(html, /hubPrimaryNextActions/);
  assert.match(html, /api-route-list/);
  assert.match(html, /data-jump-tab="view-evidence"/);
  assert.match(html, /Current Reality/);
  assert.match(html, /Goal State/);
  assert.match(html, /Top 3 Gaps/);
  assert.match(html, /Next Safe Move/);
  assert.match(html, /Project World Map/);
  assert.match(html, /world-map-visual/);
  assert.match(html, /Project world relationship map/);
  assert.match(html, /Context Rot Monitor/);
  assert.match(html, /World Judgment Header/);
  assert.match(html, /Critical Signals/);
  assert.match(html, /Claim Evidence Matrix/);
  assert.match(html, /Falsification/);
  assert.match(html, /Value Hierarchy/);
  assert.match(html, /Readiness Judgments/);
  assert.match(html, /Agent Context Packs/);
  assert.match(html, /AI Agent Platform Intake/);
  assert.match(html, /data-platform-submit/);
  assert.match(html, /record-agent-platforms/);
  assert.match(html, /Open Work/);
  assert.match(html, /User Task Board/);
  assert.match(html, /Agent Maintenance Tasks/);
  assert.match(html, /renderUserTaskBoard/);
  assert.match(html, /renderAgentMaintenanceTasks/);
  assert.match(html, /Operational Command Queue/);
  assert.match(html, /Status lanes/);
  assert.match(html, /readiness map/);
  assert.match(html, /Dashboard Quality Scorecard/);
  assert.match(html, /Governance Setup & Operating Readiness/);
  assert.match(html, /Project Evidence Inventory/);
  assert.match(html, /Ledger Projection Trust Boundary/);
  assert.match(html, /Decision And Risk Pulse/);
  assert.match(html, /Trust And Continuity Snapshot/);
  assert.match(html, /System Topology/);
  assert.match(html, /Tech Stack/);
  assert.match(html, /Project Composition/);
  assert.match(html, /Architecture Map/);
  assert.doesNotMatch(html, /Task Flow/);
  assert.doesNotMatch(html, /query-box/);
  assert.match(html, /Timeline range/);
  assert.match(html, /gantt-bar/);
  assert.match(html, /data-purpose="Executive view: world judgment/);
  assert.match(html, /data-purpose="Delivery view/);
  assert.match(html, /Local Live/);
  assert.match(html, /Static Snapshot/);
  assert.match(html, /Degraded Offline/);
  assert.match(html, /api\/harness-dashboard\/v1\/events/);
  assert.match(html, /api\/harness-dashboard\/v1\/traceability/);
  assert.match(html, /setSlideDeckBackgroundIsolation/);
  assert.match(html, /document\.querySelector\(".shell"\)/);
  assert.match(html, /node\.inert = isIsolated/);
  assert.match(html, /!deck\.contains\(document\.activeElement\)/);
  assert.doesNotMatch(html, /swiper-bundle|three\.min|cdn\./i);
  const executableScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1]
  );
  assert.ok(executableScripts.length > 0, "dashboard should include executable client JS");
  for (const script of executableScripts) {
    assert.doesNotThrow(() => new Function(script), "dashboard client JS should parse");
  }

  const copilot = byPath.get(".github/copilot-instructions.md").content;
  const agentsMd = byPath.get("AGENTS.md").content;
  assert.match(agentsMd, /Parallel Orchestration Contract/);
  assert.match(agentsMd, /Hub Review Loop/);
  assert.match(copilot, /Harness World Model Dashboard/);
  assert.match(copilot, /worldModelImprovementContract/);
  assert.match(copilot, /realityModel/);
  assert.match(copilot, /goalCompass/);
  assert.match(copilot, /contextRotMonitor/);
  assert.match(copilot, /workspace-init-mcp:harness-world-model:start/);
  assert.match(copilot, /main agent acts as the hub/);
  assert.match(copilot, /Keep dashboard tabs non-duplicative/);

  const dashboardSkill = byPath.get(".github/skills/harness-dashboard-state-manager/SKILL.md").content;
  assert.match(dashboardSkill, /World Model Maturity Guidance/);
  assert.match(dashboardSkill, /Dashboard Collaboration Protocol/);
  assert.match(dashboardSkill, /Modern Web UI Guidance/);
  assert.match(dashboardSkill, /HTML-in-Canvas/);
  assert.equal(
    byPath.has(".github/skills/server-flow-dashboard-builder/SKILL.md"),
    false,
    "server flow skill must not be installed in the default world model dashboard surface"
  );

  const dashboardAgent = byPath.get(".github/agents/harness-dashboard-operator.agent.md").content;
  assert.match(dashboardAgent, /worldModelImprovementContract/);
  assert.match(dashboardAgent, /tab ownership/i);
  assert.match(dashboardAgent, /HTML-in-Canvas/);
  assert.equal(
    byPath.has(".github/agents/server-flow-monitoring-operator.agent.md"),
    false,
    "server flow agent must not be installed in the default world model dashboard surface"
  );

  const designProfile = readJson(root, "docs/ai-harness/dashboard/state/design-profile.json");
  assert.match(
    designProfile.informationArchitecture.antiDuplicationRule,
    /Each tab owns one job/
  );
  assert.match(
    designProfile.informationArchitecture.viewResponsibilities.Overview,
    /world judgment/
  );

  const summary = buildSummary(params, files).summary;
  assert.match(summary, /Project World Model/);
  assert.match(summary, /ensure-listening/);

  const validation = validateWorkspace(root);
  assert.equal(validation.isInitialized, true);
  assert.equal(validation.completeness, 100);
}

{
  const root = createWorkspace();
  const files = collectFiles({
    ...createParams(root),
    includeHarnessEngineering: false,
  });
  const byPath = new Map(files.map((file) => [file.relativePath, file]));

  assert.ok(byPath.has("AGENTS.md"));
  assert.equal(
    files.some((file) => file.relativePath.startsWith("docs/ai-harness/dashboard/")),
    false,
    "includeHarnessEngineering=false must omit dashboard artifacts"
  );
  assert.equal(
    files.some((file) => file.relativePath.startsWith("docs/ai-harness/runtime/")),
    false,
    "includeHarnessEngineering=false must omit runtime artifacts"
  );
  assert.equal(
    files.some((file) => file.relativePath.startsWith(".github/ai-harness/")),
    false,
    "includeHarnessEngineering=false must omit harness engineering config"
  );
  assert.equal(byPath.has(".github/ai-harness/managed-file-inventory.json"), false);
}

{
  const { root } = generateWorkspace();
  const statePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
  state.claimEvidenceMatrix.missingEvidenceItems = "not-an-array";
  state.taskQueues.needsUser = [42];
  state.dashboardQualityScorecard.uiUxDesignScore = 9.6;
  state.dashboardQualityScorecard.qaEvidence.status = "pending-run";
  state.dashboardQualityScorecard.dimensions[0].score = 9.7;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");

  const validation = validateWorkspace(root);
  const dashboardItem = validation.items.find(
    (item) => item.path === "docs/ai-harness/dashboard/state/dashboard-state.json"
  );
  assert.equal(dashboardItem.status, "outdated");
  assert.match(validation.summary, /Dashboard state shape validation failed/);
}

{
  const { root } = generateWorkspace();
  const statePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));

  const invalidReality = JSON.parse(JSON.stringify(state));
  invalidReality.realityModel.edges[0].to = "missing-node";
  let validation = validateDashboardStateShape(invalidReality);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => /realityModel\.edges\[0\]\.to/.test(error)));

  const invalidGoal = JSON.parse(JSON.stringify(state));
  invalidGoal.goalCompass.goalGraph[1].parentId = "missing-goal";
  validation = validateDashboardStateShape(invalidGoal);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => /goalCompass\.goalGraph\[1\]\.parentId/.test(error)));

  const invalidRotGate = JSON.parse(JSON.stringify(state));
  invalidRotGate.contextRotMonitor.rotWarnings.push({
    id: "rot.test-critical",
    severity: "critical",
    status: "open",
    summary: "Critical rot fixture.",
    owner: "test",
    evidenceRefs: ["test"],
    nextAction: "Keep blocked.",
    openedAt: "test",
    expiresAt: "test",
    blocksImplementation: true,
  });
  invalidRotGate.goalCompass.phaseGate.canImplementApplicationChange = true;
  validation = validateDashboardStateShape(invalidRotGate);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => /critical context rot warnings are open/.test(error)));

  const invalidEvaluation = JSON.parse(JSON.stringify(state));
  invalidEvaluation.harnessEvaluation.status = "pass";
  invalidEvaluation.harnessEvaluation.score = 9.8;
  invalidEvaluation.harnessEvaluation.metrics[0].status = "fail";
  invalidEvaluation.harnessEvaluation.metrics[0].score = 7.5;
  validation = validateDashboardStateShape(invalidEvaluation);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => /harnessEvaluation cannot pass/.test(error)));

  const invalidPassBelowThreshold = JSON.parse(JSON.stringify(state));
  invalidPassBelowThreshold.harnessEvaluation.status = "pass";
  invalidPassBelowThreshold.harnessEvaluation.score = 9.2;
  invalidPassBelowThreshold.harnessEvaluation.metrics = invalidPassBelowThreshold.harnessEvaluation.metrics.map((metric) => ({
    ...metric,
    status: "pass",
    score: metric.thresholdScore,
  }));
  validation = validateDashboardStateShape(invalidPassBelowThreshold);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => /score must meet thresholdScore/.test(error)));

  const hiddenTaskInPublicSurfaces = JSON.parse(JSON.stringify(state));
  const hiddenTask = {
    id: "task-bootstrap-refresh-projections",
    status: "waiting",
    title: "Verify and refresh dashboard projections",
    owner: "harness-dashboard-operator",
    queueVisibility: "agent-only",
    evidenceRefs: ["event-000001-bootstrap"],
  };
  hiddenTaskInPublicSurfaces.taskQueues.waiting.push(hiddenTask.id);
  hiddenTaskInPublicSurfaces.userTaskBoard.remaining.push(hiddenTask.id);
  hiddenTaskInPublicSurfaces.agile.backlog.push(hiddenTask);
  hiddenTaskInPublicSurfaces.agileCadence.backlog.push(hiddenTask);
  hiddenTaskInPublicSurfaces.workTimeline.items.push(hiddenTask);
  hiddenTaskInPublicSurfaces.workReadinessMap.rows.push(hiddenTask);
  validation = validateDashboardStateShape(hiddenTaskInPublicSurfaces);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => /agent-only task "task-bootstrap-refresh-projections"/.test(error)));

  const agentOwnedUserWork = JSON.parse(JSON.stringify(state));
  const agentOwnedTask = {
    id: "task-agent-owned-project-work",
    status: "waiting",
    title: "Agent-owned real project work",
    owner: "ai-agent",
    audience: "agent",
    evidenceRefs: ["user-evidence"],
  };
  agentOwnedUserWork.taskQueues.waiting.push(agentOwnedTask.id);
  agentOwnedUserWork.userTaskBoard.remaining.push(agentOwnedTask.id);
  agentOwnedUserWork.workTimeline.items.push(agentOwnedTask);
  validation = validateDashboardStateShape(agentOwnedUserWork);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
}

{
  const root = createWorkspace();
  const files = generateServerFlowDashboardFiles({
    workspacePath: root,
    dashboardName: "API Server Flow",
    applicationName: "Checkout API",
    focus: "combined",
    monitoredServices: ["api", "worker"],
    ports: [3000, 4317],
    dataPipelines: ["orders", "payments"],
  });
  const byPath = new Map(files.map((file) => [file.relativePath, file]));
  assert.ok(byPath.has("server-flow-dashboard/public/index.html"));
  assert.ok(byPath.has("server-flow-dashboard/config/server-flow-dashboard.config.json"));
  assert.ok(byPath.has("docs/server-flow-monitoring-dashboard.md"));
  const config = JSON.parse(byPath.get("server-flow-dashboard/config/server-flow-dashboard.config.json").content);
  assert.equal(config.dashboardDomain, "server-flow-monitoring");
  assert.match(config.separationRule, /not the World Model Harness Dashboard/);
  assert.match(config.modernWebUiPolicy.htmlInCanvasPolicy, /accessible/);
  assert.match(byPath.get("server-flow-dashboard/README.md").content, /Network traffic flow/);
  assert.match(byPath.get("docs/server-flow-monitoring-dashboard.md").content, /Modern UI Rule/);
  assert.doesNotMatch(byPath.get("server-flow-dashboard/README.md").content, /agent governance state/i);
}

{
  const { root } = generateWorkspace();
  const statePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const state = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const hiddenTask = {
    id: "task-bootstrap-refresh-projections",
    status: "waiting",
    title: "Verify and refresh dashboard projections",
    owner: "harness-dashboard-operator",
    queueVisibility: "agent-only",
    evidenceRefs: ["event-000001-bootstrap"],
  };
  state.taskQueues.waiting.push(hiddenTask.id);
  state.workTimeline.items.push(hiddenTask);
  state.workReadinessMap.rows.push(hiddenTask);
  state.agile.backlog.push(hiddenTask);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
  const scriptPath = path.join(root, "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs");
  const validateResult = runNode([scriptPath, "validate"], { cwd: root });
  assert.notEqual(validateResult.status, 0);
  assert.match(validateResult.stderr + validateResult.stdout, /agent-only task/);
}

{
  const root = createWorkspace();
  const recommendations = recommendAgentSkills({
    projectType: "api",
    techStack: ["Node.js", "MCP server"],
    userIntent: "server flow monitoring dashboard network traffic workflow uptime",
    maxAgents: 20,
    maxSkills: 20,
  });
  assert.ok(
    recommendations.skills.some((entry) => entry.id === "server-flow-dashboard-builder"),
    "server flow skill should be recommended for explicit monitoring requests"
  );
  assert.ok(
    recommendations.agents.some((entry) => entry.id === "server-flow-monitoring-operator"),
    "server flow agent should be recommended for explicit monitoring requests"
  );
  const serverFlowSkill = SKILL_REGISTRY.find((entry) => entry.id === "server-flow-dashboard-builder");
  const serverFlowAgent = AGENT_REGISTRY.find((entry) => entry.id === "server-flow-monitoring-operator");
  assert.ok(serverFlowSkill);
  assert.ok(serverFlowAgent);
  const selectedFiles = generateSelectedSkills([serverFlowSkill], [serverFlowAgent], {
    ...createParams(root),
    agentSkillsIntent: "server flow monitoring dashboard",
  });
  const byPath = new Map(selectedFiles.map((file) => [file.relativePath, file]));
  assert.match(byPath.get(".github/skills/server-flow-dashboard-builder/SKILL.md").content, /Server Flow Dashboard/);
  assert.match(byPath.get(".github/skills/server-flow-dashboard-builder/SKILL.md").content, /separate from `docs\/ai-harness\/dashboard\/`/);
  assert.match(byPath.get(".github/skills/server-flow-dashboard-builder/SKILL.md").content, /HTML-in-Canvas/);
  assert.match(byPath.get(".github/agents/server-flow-monitoring-operator.agent.md").content, /Server Flow Monitoring/);
  assert.match(byPath.get(".github/agents/server-flow-monitoring-operator.agent.md").content, /separate domain from the World Model Harness Dashboard/);
  assert.match(byPath.get(".github/agents/server-flow-monitoring-operator.agent.md").content, /modern browser UI features/);
}

{
  const root = createWorkspace();
  const files = generateServerFlowDashboardFiles({
    workspacePath: root,
    dashboardName: "<img src=x onerror=alert(1)>",
    applicationName: "Checkout API",
    monitoredServices: ["<script>alert(1)</script>"],
    dataPipelines: ["orders"],
  });
  const byPath = new Map(files.map((file) => [file.relativePath, file]));
  const html = byPath.get("server-flow-dashboard/public/index.html").content;
  const appJs = byPath.get("server-flow-dashboard/public/app.js").content;
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /refresh-sample/);
  assert.doesNotMatch(appJs, /innerHTML/);
  assert.match(appJs, /textContent/);
  assert.match(appJs, /document\.createElement/);
  assert.match(appJs, /addEventListener\("click"/);
}

{
  const root = createWorkspace();
  const files = collectFiles({
    ...createParams(root),
    workspaceName: "Commerce Identity Stress",
    projectType: "web-app",
    primaryDomains: ["commerce", "payments", "device-auth", "benefits", "identity"],
    domainStressProfile: "identity-commerce-operations",
  });
  const state = JSON.parse(
    files.find((file) => file.relativePath === "docs/ai-harness/dashboard/state/dashboard-state.json").content
  );
  const kpiIds = new Set(state.kpis.map((kpi) => kpi.id));
  assert.ok(kpiIds.has("commerce-payment-integrity"));
  assert.ok(kpiIds.has("account-benefit-ledger"));
  assert.ok(kpiIds.has("device-flow-readiness"));
  assert.ok(state.kpiProfile.requiredKpiIds.includes("commerce-payment-integrity"));
  assert.ok(state.domainStress.activeProfileIds.includes("identity-commerce-operations"));
  assert.ok(state.domainOperations.commerceOperations);
  assert.ok(state.domainStress.missingEvidenceItems.some((item) => /payment callback/i.test(item.label)));
  assert.ok(state.workTimeline.items.some((item) => item.domainStressProfile === "identity-commerce-operations"));
  writeGeneratedFiles(root, files);
  const scriptPath = path.join(root, "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs");
  const result = runNode([scriptPath, "export-report", "--out", "commerce-report", "--audience", "maintainer", "--focus", "blocked", "--public"], {
    cwd: root,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const briefing = fs.readFileSync(path.join(root, "commerce-report", "briefing.md"), "utf-8");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "commerce-report", "report-manifest.json"), "utf-8"));
  const appendix = JSON.parse(fs.readFileSync(path.join(root, "commerce-report", "evidence-appendix.json"), "utf-8"));
  assert.match(briefing, /Domain Stress Sections/);
  assert.match(briefing, /Credential\/Auth/);
  assert.match(briefing, /Payments/);
  assert.ok(manifest.domainProfiles.includes("identity-commerce-operations"));
  assert.ok(appendix.domainOperations.commerceOperations);
  const firstGateId = state.domainStress.profiles[0].evidenceGates[0].id;
  const evidencePath = path.join(root, "docs", "qa", "credential-replay-test.md");
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, "# Credential replay proof\n\nVerified local evidence fixture.\n", "utf-8");
  const recordResult = runNode([
    scriptPath,
    "record-domain-evidence",
    "--gate",
    firstGateId,
    "--status",
    "resolved",
    "--evidence",
    "docs/qa/credential-replay-test.md",
    "--note",
    "Credential replay proof linked",
  ], { cwd: root });
  assert.equal(recordResult.status, 0, recordResult.stderr || recordResult.stdout);
  const resolvedState = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const resolvedGap = resolvedState.claimEvidenceMatrix.missingEvidenceItems.find((item) => item.id === firstGateId);
  assert.equal(resolvedGap.blocksReadiness, false);
  assert.ok(resolvedState.taskQueues.completed.includes(`task.${firstGateId}`));
  assert.equal(resolvedState.taskQueues.blocked.includes(`task.${firstGateId}`), false);
  const credentialSection = resolvedState.domainOperations.commerceOperations.sections.find((section) => section.id === "credential-auth");
  assert.ok(["blocked", "resolved"].includes(credentialSection.status));
  const validateResult = runNode([scriptPath, "validate"], { cwd: root });
  assert.equal(validateResult.status, 0, validateResult.stderr || validateResult.stdout);
}

{
  const root = createWorkspace();
  const files = collectFiles({
    ...createParams(root),
    workspaceName: "Payments Only Web App",
    projectType: "web-app",
    primaryDomains: ["payments"],
  });
  const state = JSON.parse(
    files.find((file) => file.relativePath === "docs/ai-harness/dashboard/state/dashboard-state.json").content
  );
  assert.equal(state.domainStress.activeProfileIds.includes("identity-commerce-operations"), false);
}

{
  const root = createWorkspace();
  const files = collectFiles({
    ...createParams(root),
    workspaceName: "Learning Growth Harness",
    purpose: "Track learning progress, feedback, review loops, and durable knowledge state",
    projectType: "other",
    primaryDomains: ["learning", "curriculum", "assessment", "knowledge-base"],
    domainStressProfile: "Learning Growth Harness",
  });
  const byPath = new Map(files.map((file) => [file.relativePath, file]));
  const state = JSON.parse(
    byPath.get("docs/ai-harness/dashboard/state/dashboard-state.json").content
  );
  const profileCatalog = JSON.parse(byPath.get("docs/ai-harness/domain-stress-profiles.json").content);

  assert.deepEqual(state.domainStress.activeProfileIds, ["learning-growth-harness"]);
  assert.equal(state.domainStress.requestedProfile, "Learning Growth Harness");
  assert.equal(state.domainStress.requestedProfileId, "learning-growth-harness");
  assert.equal(state.domainStress.profiles[0].label, "Learning Growth Harness Stress Profile");
  assert.equal(state.domainStress.profiles[0].programKey, "customDomainOperations");
  assert.equal(state.domainStress.profiles[0].activation, "explicit");
  assert.ok(state.domainStress.missingEvidenceItems.some((item) => /negative review/i.test(item.label)));
  assert.ok(state.domainStress.parallelSafetyRule.includes("domain invariants"));
  assert.ok(state.domainOperations.customDomainOperations);
  assert.equal(state.domainOperations.customDomainOperations.profileId, "learning-growth-harness");
  assert.ok(state.domainOperations.customDomainOperations.sections.some((section) => section.label === "Review Findings"));
  assert.match(state.domainOperations.customDomainOperations.readinessGate, /handoff continuity/);
  assert.equal("commerceOperations" in state.domainOperations, false);
  assert.equal("modernizationGovernance" in state.domainOperations, false);
  assert.equal("contentRelease" in state.domainOperations, false);
  assert.ok(profileCatalog.profiles.some((profile) => profile.id === "learning-growth-harness"));
}

{
  const root = createWorkspace();
  const files = collectFiles({
    ...createParams(root),
    workspaceName: "Commerce False Green Stress",
    projectType: "web-app",
    primaryDomains: ["commerce", "payments", "device-auth", "benefits", "identity"],
    domainStressProfile: "identity-commerce-operations",
  });
  writeGeneratedFiles(root, files);
  const statePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
  state.domainOperations.commerceOperations.sections[0].status = "resolved";
  state.domainStress.reportSections.find((section) => section.section === "Credential/Auth").status = "resolved";
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
  const validation = validateWorkspace(root);
  const dashboardItem = validation.items.find(
    (item) => item.path === "docs/ai-harness/dashboard/state/dashboard-state.json"
  );
  assert.equal(dashboardItem.status, "outdated");
  const scriptPath = path.join(root, "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs");
  const result = runNode([scriptPath, "validate"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /cannot be resolved while/);
}

{
  const root = createWorkspace();
  const files = collectFiles({
    ...createParams(root),
    workspaceName: "Modernization Governance Stress",
    projectType: "web-app",
    primaryDomains: ["legacy-modernization", "collaboration", "organization", "governance", "monetization"],
    domainStressProfile: "legacy-modernization-governance",
    legacyAdoptionProfile: "Legacy CRUD records/comments/users/categories to collaborative governance platform",
  });
  const state = JSON.parse(
    files.find((file) => file.relativePath === "docs/ai-harness/dashboard/state/dashboard-state.json").content
  );
  const kpiIds = new Set(state.kpis.map((kpi) => kpi.id));
  assert.ok(kpiIds.has("collaboration-health"));
  assert.ok(kpiIds.has("organization-governance-readiness"));
  assert.ok(kpiIds.has("monetization-readiness"));
  assert.ok(state.domainStress.activeProfileIds.includes("legacy-modernization-governance"));
  assert.ok(state.domainOperations.modernizationGovernance);
  assert.ok(state.domainStress.missingEvidenceItems.some((item) => /AS-IS/i.test(item.label)));
}

{
  const root = createWorkspace();
  const files = collectFiles({
    ...createParams(root),
    workspaceName: "Content Release Stress",
    projectType: "creative",
    primaryDomains: ["content", "editorial", "content-release", "media-assets", "visual-assets"],
    domainStressProfile: "content-release-governance",
  });
  const state = JSON.parse(
    files.find((file) => file.relativePath === "docs/ai-harness/dashboard/state/dashboard-state.json").content
  );
  const kpiIds = new Set(state.kpis.map((kpi) => kpi.id));
  assert.ok(kpiIds.has("message-consistency"));
  assert.ok(kpiIds.has("content-pipeline-throughput"));
  assert.ok(kpiIds.has("visual-asset-governance"));
  assert.ok(state.domainStress.activeProfileIds.includes("content-release-governance"));
  assert.ok(state.domainOperations.contentRelease);
  assert.ok(state.domainStress.missingEvidenceItems.some((item) => /message map/i.test(item.label)));
}

{
  const root = createWorkspace();
  const files = collectFiles({
    ...createParams(root),
    targetIDEs: ["cursor", "claude-code", "codex", "antigravity"],
  });
  const byPath = new Map(files.map((file) => [file.relativePath, file]));

  assert.ok(byPath.has("AGENTS.md"), "Codex/cross-agent AGENTS.md should be generated");
  assert.ok(byPath.has("CLAUDE.md"), "Claude Code project memory should be generated when targeted");
  assert.ok(
    byPath.has(".cursor/rules/harness-world-model.mdc"),
    "Cursor project rule should be generated when targeted"
  );
  assert.ok(
    byPath.has(".agents/plugins/workspace-init-harness/plugin.json"),
    "Antigravity workspace plugin manifest should be generated when targeted"
  );
  assert.ok(
    byPath.has(".agents/plugins/workspace-init-harness/rules/harness-world-model.md"),
    "Antigravity workspace rule should be generated when targeted"
  );
  assert.match(byPath.get("CLAUDE.md").content, /Claude Code project memory/);
  assert.match(
    byPath.get(".cursor/rules/harness-world-model.mdc").content,
    /alwaysApply: true/
  );
}

{
  const root = createWorkspace();
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Existing Agents\n\nKeep this rule.\n", "utf-8");
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "# Existing Claude\n\nKeep Claude rule.\n", "utf-8");
  fs.mkdirSync(path.join(root, ".cursor", "rules"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".cursor", "rules", "legacy.mdc"),
    "---\ndescription: legacy\n---\nLegacy Cursor rule.\n",
    "utf-8"
  );
  fs.mkdirSync(path.join(root, ".agents", "plugins", "legacy"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".agents", "plugins", "legacy", "plugin.json"),
    "{\"name\":\"legacy\"}\n",
    "utf-8"
  );

  const result = reconcileWorkspaceInitialization({
    workspacePath: root,
    workspaceName: "Legacy Agent Platform Workspace",
    purpose: "Adopt harness without replacing existing agent instructions.",
    applyChanges: true,
    writeMigrationReport: false,
    writeSemanticDiffReport: false,
  });

  assert.equal(result.applied, true);
  assert.ok(result.resolvedConfig.targetIDEs.includes("cursor"));
  assert.ok(result.resolvedConfig.targetIDEs.includes("claude-code"));
  assert.ok(result.resolvedConfig.targetIDEs.includes("codex"));
  assert.ok(result.resolvedConfig.targetIDEs.includes("antigravity"));

  const agentsContent = fs.readFileSync(path.join(root, "AGENTS.md"), "utf-8");
  const claudeContent = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf-8");
  assert.match(agentsContent, /Keep this rule/);
  assert.match(agentsContent, /workspace-init-mcp:harness-world-model:start/);
  assert.match(claudeContent, /Keep Claude rule/);
  assert.match(claudeContent, /Workspace-Init Harness World Model/);
  assert.ok(fs.existsSync(path.join(root, ".cursor", "rules", "harness-world-model.mdc")));
  assert.ok(
    fs.existsSync(
      path.join(root, ".agents", "plugins", "workspace-init-harness", "rules", "harness-world-model.md")
    )
  );
}

{
  const { root } = generateWorkspace();
  const statePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const noisy = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const bootstrapMaintenanceTask = {
    id: "task-bootstrap-refresh-projections",
    status: "waiting",
    title: "Verify and refresh dashboard projections",
    owner: "harness-dashboard-operator",
    evidenceRefs: ["event-000001-bootstrap"],
    blocksClaimIds: ["claim.world-model.bootstrap"],
    exitCriteria: "verify-projections and refresh complete without stale/corrupt projection warnings",
  };
  noisy.taskQueues.waiting.push("task-bootstrap-refresh-projections");
  noisy.taskQueues.waiting.push("task-confirm-agent-platforms");
  noisy.taskQueues.blocked.push(
    "task-collect-service-health",
    "task-map-deployment-target",
    "task-map-data-readiness"
  );
  noisy.taskQueues.needsUser.push("decision-agent-platform-selection");
  noisy.agile.backlog.push({
    ...bootstrapMaintenanceTask,
  });
  noisy.agileCadence.backlog.push({
    ...bootstrapMaintenanceTask,
  });
  noisy.agile.backlog.push({
    id: "task-map-data-readiness",
    status: "blocked",
    title: "Map save-data, migration, backup, and restore readiness",
    owner: "maintainer",
    evidenceRefs: ["missing.database-readiness"],
  });
  noisy.agile.backlog.push({
    id: "task-link-vcs-records",
    status: "in-progress",
    title: "User-preserved VCS linkage task",
    owner: "maintainer",
    evidenceRefs: ["user-evidence-vcs-link"],
  });
  noisy.workTimeline.items.push({
    ...bootstrapMaintenanceTask,
    lane: "Harness Bootstrap",
  });
  noisy.workReadinessMap.rows.push({
    ...bootstrapMaintenanceTask,
  });
  noisy.userTaskBoard.remaining.push("task-bootstrap-refresh-projections");
  noisy.workTimeline.items.push({
    id: "task-map-deployment-target",
    status: "blocked",
    title: "Legacy noisy deployment task",
    nextActionRef: "task-map-deployment-target",
  });
  noisy.workTimeline.items.push({
    id: "task-collect-service-health",
    status: "in-progress",
    title: "User-preserved health task",
    owner: "maintainer",
    evidenceRefs: ["user-service-health-evidence"],
  });
  noisy.claimEvidenceMatrix.claims.push({
    claimId: "claim.data.save-integrity",
    statement: "Legacy game-specific data claim should not survive migration.",
  });
  noisy.claimEvidenceMatrix.missingEvidenceItems.push({
    id: "legacy-vcs-gap",
    label: "Legacy VCS gap",
    blocksClaimIds: ["claim.vcs.history-linked"],
    requiredEvidenceType: "linked VCS evidence",
    owner: "maintainer",
    resolutionTaskId: "task-link-vcs-records",
    nextActionRef: "task-map-data-readiness",
  });
  noisy.claimEvidenceMatrix.missingEvidenceItems.push({
    id: "manual-evidence-task",
    label: "Manual user evidence task",
    blocksClaimIds: ["claim.manual"],
    requiredEvidenceType: "user-authored acceptance evidence",
    owner: "operator",
    resolutionTaskId: "task-user-authored-evidence",
    provenance: "manual user-authored",
  });
  noisy.workReadinessMap.rows = [
    {
      id: "task-confirm-agent-platforms",
      title: "Legacy noisy platform task",
    },
  ];
  noisy.agentResumeBrief.openDecisions.push("decision-agent-platform-selection");
  noisy.agentResumeBrief.blockers.push("agent-platform-declaration-needed");
  fs.writeFileSync(statePath, JSON.stringify(noisy, null, 2) + "\n", "utf-8");

  const result = reconcileWorkspaceInitialization({
    workspacePath: root,
    workspaceName: "Noisy Existing Dashboard",
    purpose: "Verify reconcile removes generated dashboard queue noise.",
    applyChanges: true,
    writeMigrationReport: false,
    writeSemanticDiffReport: false,
  });
  assert.equal(result.applied, true);
  const cleaned = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const cleanedTaskIds = new Set([
    ...cleaned.taskQueues.waiting,
    ...cleaned.taskQueues.blocked,
    ...cleaned.taskQueues.completed,
    ...cleaned.agile.backlog.map((item) => item.id),
    ...cleaned.workTimeline.items.map((item) => item.id),
    ...cleaned.workReadinessMap.rows.map((item) => item.id),
  ]);
  assert.equal(cleanedTaskIds.has("task-bootstrap-refresh-projections"), false);
  assert.equal(cleanedTaskIds.has("task-confirm-agent-platforms"), false);
  assert.equal(cleanedTaskIds.has("task-map-deployment-target"), false);
  assert.equal(cleanedTaskIds.has("task-map-data-readiness"), false);
  assert.equal(cleanedTaskIds.has("task-link-vcs-records"), true);
  assert.equal(cleanedTaskIds.has("task-collect-service-health"), true);
  const legacyGap = cleaned.claimEvidenceMatrix.missingEvidenceItems.find((item) => item.id === "legacy-vcs-gap");
  assert.equal(legacyGap.resolutionTaskId, "missing.vcs-task-links");
  assert.equal(legacyGap.nextActionRef, "missing.database-readiness");
  const manualGap = cleaned.claimEvidenceMatrix.missingEvidenceItems.find((item) => item.id === "manual-evidence-task");
  assert.equal(manualGap.queueVisibility, "task");
  assert.equal(manualGap.surfaceAsTask, true);
  assert.ok(Array.isArray(cleaned.reconcileClassifications));
  assert.ok(cleaned.reconcileClassifications.some((entry) => entry.id === "task-map-data-readiness"));
  assert.equal(cleaned.claimEvidenceMatrix.claims.some((claim) => claim.claimId === "claim.data.integrity"), true);
  assert.equal(cleaned.claimEvidenceMatrix.claims.some((claim) => claim.claimId === "claim.data.save-integrity"), false);
  assert.equal(cleaned.agentResumeBrief.openDecisions.includes("decision-agent-platform-selection"), false);
  assert.ok(cleaned.agentTaskQueues.waiting.includes("task-bootstrap-refresh-projections"));
  assert.ok(cleaned.agentTaskQueues.hiddenFromUserTaskBoard.includes("task-bootstrap-refresh-projections"));
  assert.ok(cleaned.userTaskBoard.hiddenAgentTaskIds.includes("task-bootstrap-refresh-projections"));
  assert.equal(
    validateDashboardStateShape(cleaned).valid,
    true
  );
}

{
  const { root } = generateWorkspace();
  const statePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const customized = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  customized.workTimeline.items.push({
    id: "task-map-deployment-target",
    status: "in-progress",
    title: "Map deployment target, CI, release, and rollback path",
    provenance: "manual user-restored operational task",
    evidenceRefs: ["manual-release-evidence"],
    nextActionRef: "task-map-deployment-target",
  });
  fs.writeFileSync(statePath, JSON.stringify(customized, null, 2) + "\n", "utf-8");

  const result = reconcileWorkspaceInitialization({
    workspacePath: root,
    workspaceName: "Customized Legacy Dashboard",
    purpose: "Verify reconcile preserves explicit user-provenance legacy task rows.",
    applyChanges: true,
    writeMigrationReport: false,
    writeSemanticDiffReport: false,
  });
  assert.equal(result.applied, true);
  const cleaned = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const preserved = cleaned.workTimeline.items.find((item) => item.id === "task-map-deployment-target");
  assert.equal(preserved?.provenance, "manual user-restored operational task");
  assert.equal(preserved?.nextActionRef, "missing.deployment-target");
}

{
  const root = createWorkspace();
  const files = collectFiles({
    ...createParams(root),
    includeAgentSkills: false,
  });
  const byPath = new Map(files.map((file) => [file.relativePath, file]));
  assert.ok(
    byPath.has(".github/skills/harness-dashboard-state-manager/SKILL.md"),
    "harness core dashboard skill must be generated even when broad agent skills are disabled"
  );
  assert.ok(
    byPath.has(".github/agents/harness-dashboard-operator.agent.md"),
    "harness core dashboard agent must be generated even when broad agent skills are disabled"
  );
  assert.equal(
    byPath.has(".github/skills/server-flow-dashboard-builder/SKILL.md"),
    false,
    "server flow dashboard skill must remain opt-in even when harness core skills are generated"
  );
  assert.equal(
    byPath.has(".github/agents/server-flow-monitoring-operator.agent.md"),
    false,
    "server flow monitoring agent must remain opt-in even when harness core agents are generated"
  );
}

{
  const { root } = generateWorkspace();
  const statePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const legacyState = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  delete legacyState.projectionConfidence;
  delete legacyState.sessionTraceability;
  delete legacyState.userRealityCheck;
  fs.writeFileSync(statePath, JSON.stringify(legacyState, null, 2) + "\n", "utf-8");
  const scriptPath = path.join(root, "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs");
  const result = runNode([scriptPath, "validate"], { cwd: root });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /valid/);
}

{
  const { root } = generateWorkspace();
  const statePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const legacyState = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  delete legacyState.projectionConfidence;
  delete legacyState.sessionTraceability;
  delete legacyState.userRealityCheck;
  fs.writeFileSync(statePath, JSON.stringify(legacyState, null, 2) + "\n", "utf-8");

  const result = reconcileWorkspaceInitialization({
    workspacePath: root,
    workspaceName: "Legacy Reality Check Workspace",
    purpose: "Verify reconcile backfills user-facing dashboard reality checks.",
    applyChanges: true,
    writeMigrationReport: false,
    writeSemanticDiffReport: false,
  });
  assert.equal(result.applied, true);
  const reconciled = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  assert.equal(reconciled.projectionConfidence.status, "projection-debt");
  assert.ok(reconciled.sessionTraceability.entries[0].originalRequest);
  assert.ok(["bootstrap-trace-complete", "trace-debt"].includes(reconciled.sessionTraceability.status));
  assert.ok(["bootstrap-action-plan", "legacy-backfill-action-plan"].includes(reconciled.userRealityCheck.status));
  assert.equal(reconciled.userRealityCheck.apiContract.route, "/api/harness-dashboard/v1/reality-check");
  assert.ok(reconciled.userRealityCheck.actionPlan[0].evidenceRequired.length > 0);
  assert.equal(validateDashboardStateShape(reconciled).valid, true);
}

{
  const { root } = generateWorkspace();
  const scriptPath = path.join(root, "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs");

  let result = runNode(["--check", scriptPath], { cwd: root });
  assert.equal(result.status, 0, result.stderr);

  result = runNode([scriptPath, "verify-projections"], { cwd: root });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /valid/);

  const manifest = readJson(root, "docs/ai-harness/dashboard/events/ledger-manifest.json");
  const state = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const appendEventPath = path.join(root, "event-append.json");
  fs.writeFileSync(
    appendEventPath,
    JSON.stringify(
      {
        eventId: "event-000002-test",
        sequence: 2,
        eventType: "workspace.dashboard.test",
        eventVersion: "1.0.0",
        workspaceId: state.meta.workspaceId,
        aggregateId: state.meta.workspaceId,
        aggregateType: "projectWorldModel",
        aggregateVersion: 1,
        occurredAt: "test",
        recordedAt: "test",
        actor: "test",
        agentId: "test",
        sourceTool: "test",
        correlationId: "test",
        causationId: null,
        idempotencyKey: "test-append-event",
        payloadHash: "test-payload-hash",
        previousEventHash: manifest.rootHash,
        redactionLevel: "internal",
        payload: { ok: true },
      },
      null,
      2
    ),
    "utf-8"
  );
  result = runNode(
    [
      scriptPath,
      "append-event",
      "--event",
      appendEventPath,
      "--expected-last-sequence",
      "0",
    ],
    { cwd: root }
  );
  assert.notEqual(result.status, 0, "append-event must reject mismatched expectedLastSequence");
  result = runNode(
    [
      scriptPath,
      "append-event",
      "--event",
      appendEventPath,
      "--expected-last-sequence",
      "1",
    ],
    { cwd: root }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readJson(root, "docs/ai-harness/dashboard/events/ledger-manifest.json").lastSequence, 2);

  result = runNode(
    [
      scriptPath,
      "record-agent-platforms",
      "--platforms",
      "codex,cursor",
      "--source",
      "test-declaration",
    ],
    { cwd: root }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const platformState = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  assert.deepEqual(platformState.agentPlatformGovernance.declaredPlatforms, ["codex", "cursor"]);
  assert.equal(platformState.agentPlatformGovernance.status, "declared");
  assert.ok(
    platformState.agentPlatformGovernance.unusedInstructionState.some(
      (entry) => entry.platform === "vscode"
    ),
    "non-active generated instruction files should be indexed as unused-instruction"
  );
  assert.ok(platformState.workspace.targetIDEs.includes("codex"));
  assert.equal(platformState.taskQueues.completed.includes("task-confirm-agent-platforms"), false);
  assert.ok(
    platformState.decisionContracts.some(
      (decision) =>
        decision.id === "decision-agent-platform-selection" &&
        decision.status === "approved"
    )
  );
  const platformIndex = readJson(root, "docs/ai-harness/dashboard/state/dashboard-index.json");
  assert.equal(platformIndex.agentPlatformGovernance.status, "declared");

  const fixturePath = path.join(root, "vcs-fixture.json");
  fs.writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        versionControl: {
          provider: "git",
          status: "fixture",
          currentBranchOrRevision: "main",
          workingCopyStatus: "clean",
          ledger: ["abc123"],
          unlinkedChanges: [],
          collectionProvenance: {
            command: "fixture",
            cwd: root,
            exitCode: 0,
            capturedAt: "fixture",
            parserVersion: CURRENT_VERSION,
            completeness: "fixture",
          },
        },
        vcsChangeRecords: [
          {
            provider: "git",
            repoRoot: root,
            commitId: "abc123",
            revisionId: "abc123",
            parentIds: [],
            author: "tester",
            timestamp: "fixture",
            messageHash: "hash",
            changedPaths: [],
            statusCounts: {},
            linkedSessionIds: [],
            linkedTaskIds: [],
            linkedDecisionIds: [],
            collectionCommand: {
              command: "fixture",
              cwd: root,
              exitCode: 0,
              capturedAt: "fixture",
              parserVersion: CURRENT_VERSION,
              timeoutOrTruncated: false,
            },
          },
        ],
      },
      null,
      2
    ),
    "utf-8"
  );
  result = runNode([scriptPath, "refresh"], {
    cwd: root,
    env: { DASHBOARD_VERSION_CONTROL_FIXTURE: fixturePath },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const refreshed = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  assert.equal(refreshed.versionControl.provider, "git");
  assert.equal(refreshed.vcsChangeRecords[0].commitId, "abc123");
  assert.deepEqual(
    readJson(root, "docs/ai-harness/dashboard/entities/reality-model.json"),
    refreshed.realityModel
  );
  assert.deepEqual(
    readJson(root, "docs/ai-harness/dashboard/entities/goal-compass.json"),
    refreshed.goalCompass
  );
  assert.deepEqual(
    readJson(root, "docs/ai-harness/dashboard/entities/context-rot-monitor.json"),
    refreshed.contextRotMonitor
  );
  assert.equal(
    readJson(root, "docs/ai-harness/dashboard/evaluations/harness-evaluation.json").sourceStateHash,
    refreshed.meta.sourceStateHash
  );

  for (const relativePath of [
    "docs/ai-harness/dashboard/state/dashboard-state.json",
    "docs/ai-harness/dashboard/state/dashboard-index.json",
    "docs/ai-harness/dashboard/state/dashboard-runtime.json",
    "docs/ai-harness/dashboard/state/embedding-documents.json",
  ]) {
    fs.rmSync(path.join(root, relativePath), { force: true });
  }
  result = runNode([scriptPath, "rebuild-projections"], { cwd: root });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(fs.existsSync(path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json")));

  fs.writeFileSync(
    path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json"),
    "{not-json",
    "utf-8"
  );
  result = runNode([scriptPath, "repair-projections"], { cwd: root });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(
    fs
      .readdirSync(path.join(root, "docs/ai-harness/dashboard/state"))
      .some((entry) => entry.includes(".corrupt."))
  );

  const exportStatePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const exportState = JSON.parse(fs.readFileSync(exportStatePath, "utf-8"));
  exportState.privateExportFixture = {
    ownerEmail: "owner@example.com",
    linuxPath: "/Users/example/private/project",
    windowsPath: "C:\\Users\\example\\secret\\project",
    privateUrl: "http://192.168.1.5:43110/dashboard",
    tokenText: "github_pat_1234567890abcdefghijklmnop",
    bearer: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
    awsAccessKey: "AKIA1234567890ABCDEF",
    passwordAssignment: "password=super-secret-value",
    pem: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
    note: "innocent field leaks github_pat_1234567890abcdefghijklmnop if string redaction fails",
  };
  fs.writeFileSync(exportStatePath, JSON.stringify(exportState, null, 2), "utf-8");
  result = runNode([scriptPath, "export-static", "--out", "public-export", "--public"], {
    cwd: root,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const exported = fs.readFileSync(path.join(root, "public-export", "harness-dashboard.html"), "utf-8");
  const exportedState = JSON.parse(fs.readFileSync(path.join(root, "public-export", "dashboard-state.json"), "utf-8"));
  const bootstrapMatch = exported.match(/<script id="dashboard-bootstrap-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(bootstrapMatch, "public export should embed dashboard state");
  const bootstrapState = JSON.parse(bootstrapMatch[1]);
  assert.equal(Array.isArray(bootstrapState.projectWorldModel.environments), true);
  assert.equal(Array.isArray(exportedState.projectWorldModel.environments), true);
  assert.match(exported, /__HARNESS_STATIC_EXPORT__/);
  assert.doesNotMatch(exported, /api-token/);
  assert.doesNotMatch(exported, /owner@example\.com/);
  assert.doesNotMatch(exported, /\/Users\/example/);
  assert.doesNotMatch(exported, /192\.168\.1\.5/);
  assert.doesNotMatch(exported, /github_pat_1234567890/);
  assert.doesNotMatch(exported, /AKIA1234567890ABCDEF/);
  assert.doesNotMatch(exported, /super-secret-value/);
  assert.doesNotMatch(JSON.stringify(exportedState), /owner@example\.com|github_pat_1234567890|AKIA1234567890ABCDEF|super-secret-value/);
  assert.match(exported, /redacted/);

  result = runNode([scriptPath, "export-report", "--out", "report-export", "--audience", "maintainer", "--focus", "today", "--public"], {
    cwd: root,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const briefing = fs.readFileSync(path.join(root, "report-export", "briefing.md"), "utf-8");
  const notes = fs.readFileSync(path.join(root, "report-export", "speaker-notes.md"), "utf-8");
  const appendix = JSON.parse(fs.readFileSync(path.join(root, "report-export", "evidence-appendix.json"), "utf-8"));
  const reportManifest = JSON.parse(fs.readFileSync(path.join(root, "report-export", "report-manifest.json"), "utf-8"));
  assert.match(briefing, /Report focus: today/);
  assert.match(briefing, /Next operator move/);
  assert.match(briefing, /Domain Stress Sections/);
  assert.match(notes, /Slide 1 - Current Operating Read/);
  assert.match(notes, /Slide 4 - Domain Stress Sections/);
  assert.equal(reportManifest.public, true);
  assert.equal(reportManifest.audience, "maintainer");
  assert.equal(reportManifest.focus, "today");
  assert.deepEqual(reportManifest.domainProfiles, []);
  assert.ok(Array.isArray(appendix.evidenceBlockers));
  assert.ok(Array.isArray(appendix.domainReportSections));
  assert.doesNotMatch(briefing + notes + JSON.stringify(appendix) + JSON.stringify(reportManifest), /owner@example\.com|github_pat_1234567890|AKIA1234567890ABCDEF|super-secret-value/);

  const invalidState = JSON.parse(fs.readFileSync(exportStatePath, "utf-8"));
  invalidState.claimEvidenceMatrix.missingEvidenceItems = "bad-shape";
  fs.writeFileSync(exportStatePath, JSON.stringify(invalidState, null, 2), "utf-8");
  result = runNode([scriptPath, "export-report", "--out", "bad-report-export"], { cwd: root });
  assert.notEqual(result.status, 0, "export-report should reject invalid dashboard state before writing");
  assert.match(result.stderr + result.stdout, /validation failed/);
  assert.equal(fs.existsSync(path.join(root, "bad-report-export", "briefing.md")), false);
  result = runNode([scriptPath, "validate"], { cwd: root });
  assert.notEqual(result.status, 0, "dashboard-ops validate should reject corrupted nested dashboard state");
  assert.match(result.stderr + result.stdout, /missingEvidenceItems/);

  const invalidGraphState = JSON.parse(JSON.stringify(exportState));
  invalidGraphState.realityModel.edges[0].from = "missing-node";
  fs.writeFileSync(exportStatePath, JSON.stringify(invalidGraphState, null, 2), "utf-8");
  result = runNode([scriptPath, "validate"], { cwd: root });
  assert.notEqual(result.status, 0, "dashboard-ops validate should reject broken reality graph references");
  assert.match(result.stderr + result.stdout, /realityModel\.edges\[0\]\.from/);
}

{
  const { root } = generateWorkspace();
  const tokenPath = path.join(root, "docs/ai-harness/dashboard/state/api-token");
  assert.equal(fs.existsSync(tokenPath), false);

  const context = getHarnessDashboardContext({
    workspacePath: root,
    view: "agent",
    query: "world",
    limit: 5,
  });

  assert.equal(context.readOnly, true);
  assert.match(context.summary, /no listener startup/i);
  assert.equal(fs.existsSync(tokenPath), false, "context tool must not start listener or create token");
  assert.ok(context.sourceFiles.some((sourcePath) => sourcePath.endsWith("dashboard-index.json")));
  assert.ok("worldModelImprovementContract" in context.context);
  assert.ok("resumePacket" in context.context);
  assert.ok("goalCompass" in context.context);
  assert.ok("realityModel" in context.context);
  assert.ok("contextRotMonitor" in context.context);
  assert.ok("harnessEvaluation" in context.context);
  assert.ok("cognitiveOffloading" in context.context);
  assert.match(context.context.cognitiveOffloading.verificationPolicy.negativeReviewLoop, /negative review/);
  assert.equal(context.context.harnessEvaluation.status, "needs-evidence");
  assert.ok(Array.isArray(context.context.rotWarnings));
  assert.ok(Array.isArray(context.context.nextEvidenceToCollect));
  assert.ok("governanceActionabilityScore" in context.context);
  assert.ok("agentPlatformGovernance" in context.context);
  assert.ok("audienceLens" in context.context);
  assert.ok(context.queryResults.length > 0);
}

{
  const { root } = generateWorkspace();
  startHarnessSession({
    workspacePath: root,
    goal: "Implement feature A",
    originalRequest: "Implement feature A with traceable orchestration.",
    processSummary: "Created a governed session for feature A and classified it as parallel-ready.",
    resultSummary: "Feature A session was opened with explicit worker ownership.",
    sessionId: "session-a",
    chunkId: "chunk-a",
    dependencyNotes: "parallel-ready: isolated component",
    expectedReadPaths: ["src/features/README.md"],
    expectedWritePaths: ["src/features/a.ts"],
    assignedWorker: "worker-a",
    dependencyMap: ["chunk-a has no dependency"],
    mergeOwner: "hub",
    parallelSafetyStatus: "parallel-ready",
    evaluationThreshold: "Hub acceptance after tests and receipt review.",
    queueIfBusy: true,
  });
  startHarnessSession({
    workspacePath: root,
    goal: "Implement feature A follow-up",
    originalRequest: "Implement feature A follow-up with traceable orchestration.",
    processSummary: "Created a queued governed session for a follow-up touching the same feature path.",
    resultSummary: "Follow-up session was queued for conflict detection.",
    sessionId: "session-b",
    chunkId: "chunk-b",
    dependencyNotes: "parallel-ready: isolated component",
    expectedWritePaths: ["src/features/a.ts"],
    queueIfBusy: true,
  });
  const audit = auditHarnessParallelChunkConflicts(root);
  assert.equal(audit.valid, false);
  assert.equal(audit.conflicts.length, 1);
  assert.equal(audit.sessions[0].parallelSafetyStatus, "parallel-ready");
  assert.equal(audit.sessions[0].mergeOwner, "hub");
  assert.ok(audit.sessions[0].expectedReadPaths.includes("src/features/README.md"));
  assert.match(audit.summary, /same expected write path/);

  const packet = readJson(root, "docs/ai-harness/runtime/work-packets/session-a.work-packet.json");
  assert.equal(packet.assignedWorker, "worker-a");
  assert.equal(packet.mergeOwner, "hub");
  assert.equal(packet.parallelSafetyStatus, "parallel-ready");
  assert.match(packet.parallelExecution.hubRole, /main agent is the hub/);
  assert.match(packet.evaluationLoop.threshold, /Hub acceptance/);
  assert.match(packet.workingMemory.policyRole, /harness maintains recoverable state/);
  assert.match(packet.workingMemory.verifyBeforePromote, /verification evidence/);
}

{
  const { root } = generateWorkspace();
  startHarnessSession({
    workspacePath: root,
    goal: "Improve study progress harness",
    originalRequest: "Improve the study progress harness with negative review traceability.",
    processSummary: "Created a governed session for the study progress review loop.",
    resultSummary: "Study progress session was opened with evaluation-loop tracking.",
    sessionId: "session-review-loop",
    chunkId: "chunk-review-loop",
    expectedWritePaths: ["docs/plans/study-progress.md"],
    evaluationThreshold: "Negative review findings must have fixes and verification evidence.",
    queueIfBusy: true,
  });
  advanceHarnessSession({
    workspacePath: root,
    sessionId: "session-review-loop",
    action: "complete",
    actorRole: "planner",
    note: "Initial plan drafted for evaluator review.",
    processSummary: "Planner drafted the initial study progress plan and linked it as evidence.",
    resultSummary: "Plan 1 advanced to evaluator review.",
    artifactPaths: ["docs/plans/study-progress.md"],
  });
  advanceHarnessSession({
    workspacePath: root,
    sessionId: "session-review-loop",
    action: "request_changes",
    actorRole: "evaluator",
    note: "Negative review found evidence gaps before implementation.",
    processSummary: "Evaluator reviewed the plan against evidence requirements and found a missing assessment receipt.",
    resultSummary: "Plan returned to revision with required evidence fixes.",
    reviewVerdict: "changes-required",
    findings: ["No assessment evidence is linked to the progress claim."],
    requiredFixes: ["Add assessment receipt and update readiness claim before continuing."],
    verificationEvidence: ["docs/reviews/study-progress-negative-review.md"],
    residualRisk: "Learning readiness remains unproven until the receipt is attached.",
    scoreBefore: 6.1,
    scoreAfter: 7.0,
    nextStep: "Revise the plan with an evidence-backed assessment gate.",
    artifactPaths: ["docs/reviews/study-progress-negative-review.md"],
  });

  const session = readJson(root, "docs/ai-harness/runtime/sessions/session-review-loop.session.json");
  const packet = readJson(root, "docs/ai-harness/runtime/work-packets/session-review-loop.work-packet.json");
  const dashboardState = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const packetMarkdown = fs.readFileSync(
    path.join(root, "docs/ai-harness/runtime/work-packets/session-review-loop.md"),
    "utf-8"
  );

  assert.equal(session.session.currentPhase, "plan-1");
  assert.equal(session.chunk.evaluationLoop.iteration, 1);
  assert.equal(session.chunk.evaluationLoop.status, "running");
  assert.equal(session.chunk.evaluationLoop.history[0].verdict, "changes-required");
  assert.deepEqual(session.chunk.evaluationLoop.history[0].findings, [
    "No assessment evidence is linked to the progress claim.",
  ]);
  assert.deepEqual(session.chunk.evaluationLoop.history[0].requiredFixes, [
    "Add assessment receipt and update readiness claim before continuing.",
  ]);
  assert.deepEqual(session.chunk.evaluationLoop.history[0].verificationEvidence, [
    "docs/reviews/study-progress-negative-review.md",
  ]);
  assert.equal(session.chunk.evaluationLoop.history[0].residualRisk, "Learning readiness remains unproven until the receipt is attached.");
  assert.equal(session.chunk.evaluationLoop.history[0].scoreBefore, 6.1);
  assert.equal(session.chunk.evaluationLoop.history[0].scoreAfter, 7.0);
  assert.equal(packet.evaluationLoop.iteration, 1);
  assert.match(packet.workingMemory.curationRule, /Promote only evidence-backed/);
  assert.match(packetMarkdown, /Recent Negative Review \/ Improvement Records/);
  assert.match(packetMarkdown, /No assessment evidence is linked/);
  assert.equal(dashboardState.stakeholderBrief.currentRisk, "Learning readiness remains unproven until the receipt is attached.");
  assert.equal(dashboardState.agentResumeBrief.currentRisk, "Learning readiness remains unproven until the receipt is attached.");
  assert.equal(
    dashboardState.sessionTraceability.entries.find((entry) => entry.sessionId === "session-review-loop").residualRisk,
    "Learning readiness remains unproven until the receipt is attached."
  );
}

{
  const { root } = generateWorkspace();
  const originalRequest =
    "Review workspace-init MCP from a user perspective and improve automation traceability.";
  startHarnessSession({
    workspacePath: root,
    goal: "Improve automation traceability",
    originalRequest,
    processSummary:
      "Orchestrator created a governed session and prepared the first traceable work packet.",
    resultSummary: "Traceable session startup completed.",
    sessionId: "session-traceability",
    chunkId: "chunk-traceability",
    expectedWritePaths: ["src/tools/harness-runtime.ts"],
    evaluationThreshold: "Score must reach 9.5/10 after negative review.",
    queueIfBusy: true,
  });
  advanceHarnessSession({
    workspacePath: root,
    sessionId: "session-traceability",
    action: "complete",
    actorRole: "planner",
    note: "Traceability plan completed for evaluator review.",
    processSummary:
      "Planner converted the original request into request/process/result ledger requirements.",
    resultSummary: "Plan 1 now has durable traceability evidence.",
    artifactPaths: ["docs/plans/session-traceability/plan-1.md"],
  });
  recordHarnessExecutionResult({
    workspacePath: root,
    sessionId: "session-traceability",
    bridgeId: "codex-cli",
    outcome: "completed",
    summary: "Codex worker produced a traceable implementation receipt.",
    processSummary:
      "Worker reviewed the work packet, changed the harness runtime, and ran targeted checks.",
    resultSummary: "Execution returned a receipt with original request, process, and result.",
    artifactPaths: ["docs/work-logs/session-traceability-chunk-traceability-implementation.md"],
  });

  const session = readJson(root, "docs/ai-harness/runtime/sessions/session-traceability.session.json");
  const packet = readJson(root, "docs/ai-harness/runtime/work-packets/session-traceability.work-packet.json");
  const receipt = readJson(
    root,
    "docs/ai-harness/runtime/execution-bridges/session-traceability/codex-cli/result-receipt.json"
  );
  const ledgerManifest = readJson(root, "docs/ai-harness/dashboard/events/ledger-manifest.json");
  const ledgerLines = fs
    .readFileSync(path.join(root, "docs/ai-harness/dashboard/events/harness-events.jsonl"), "utf-8")
    .trim()
    .split(/\r?\n/);
  const listed = listHarnessSessions(root, "open");
  const log = getHarnessSessionLog(root, "session-traceability", 5);
  const packetMarkdown = fs.readFileSync(
    path.join(root, "docs/ai-harness/runtime/work-packets/session-traceability.md"),
    "utf-8"
  );
  const receiptMarkdown = fs.readFileSync(
    path.join(
      root,
      "docs/ai-harness/runtime/execution-bridges/session-traceability/codex-cli/result-receipt.md"
    ),
    "utf-8"
  );

  assert.equal(session.requestRecord.originalRequest, originalRequest);
  assert.equal(session.events[0].taskTrace.originalRequest, originalRequest);
  assert.match(session.events[1].taskTrace.processSummary, /ledger requirements/);
  assert.equal(packet.requestRecord.originalRequest, originalRequest);
  assert.equal(packet.taskTracePolicy.requiredFields.includes("resultSummary"), true);
  assert.match(packet.recentTaskRecords[1].resultSummary, /durable traceability evidence/);
  assert.equal(ledgerManifest.lastSequence, 4);
  assert.equal(ledgerLines.length, 4);
  assert.match(ledgerLines[1], /harness\.session\.started/);
  assert.match(ledgerLines[2], /harness\.session\.advanced/);
  assert.match(ledgerLines[3], /harness\.execution\.receipt\.recorded/);
  assert.equal(listed.sessions.some((item) => item.id === "session-traceability"), true);
  assert.match(listed.summary, /improve automation traceability/);
  assert.equal(log.events.length, 2);
  assert.match(log.summary, /Request \/ Process \/ Result|Process:/);
  assert.match(log.summary, /Plan 1 now has durable traceability evidence/);
  assert.match(packetMarkdown, /Request \/ Process \/ Result Ledger/);
  assert.match(packetMarkdown, /Review workspace-init MCP from a user perspective/);
  assert.equal(receipt.taskTrace.originalRequest, originalRequest);
  assert.match(receipt.taskTrace.processSummary, /changed the harness runtime/);
  assert.match(receiptMarkdown, /Request \/ Process \/ Result/);
  assert.match(receiptMarkdown, /Execution returned a receipt/);

  session.events[0].taskTrace = undefined;
  fs.writeFileSync(
    path.join(root, "docs/ai-harness/runtime/sessions/session-traceability.session.json"),
    JSON.stringify(session, null, 2) + "\n",
    "utf-8"
  );
  const audit = auditHarnessRuntime(root);
  assert.equal(audit.valid, false);
  assert.match(audit.summary, /taskTrace/);
  const degradedLog = getHarnessSessionLog(root, "session-traceability", 5);
  assert.equal(degradedLog.events[0].traceIntegrity.status, "legacy-fallback");
  assert.ok(degradedLog.events[0].traceIntegrity.missingFields.includes("taskTrace"));
}

{
  const { root } = generateWorkspace();
  const sessionId = "session-close-trace";
  startHarnessSession({
    workspacePath: root,
    goal: "Verify close trace preservation",
    originalRequest: "Close a governed runtime session and keep the final trace visible in the dashboard.",
    processSummary: "Created a close-path governed session for dashboard trace preservation.",
    resultSummary: "Close-path session opened with request/process/result tracking.",
    sessionId,
    chunkId: "chunk-close-trace",
    expectedWritePaths: ["docs/handovers/session-close-trace/governance-close.md"],
    queueIfBusy: true,
  });
  const closeSteps = [
    ["planner", "Plan completed for close trace review.", "Planner prepared the close trace plan.", "Plan moved to first review."],
    ["evaluator", "Review approved close trace plan.", "Evaluator approved the close trace plan.", "Review moved to plan 2."],
    ["planner", "Plan 2 completed.", "Planner refined close trace verification.", "Plan 2 moved to second review."],
    ["evaluator", "Review 2 approved.", "Evaluator approved the second close trace plan.", "Review 2 moved to plan 3."],
    ["planner", "Plan 3 completed.", "Planner finalized close trace scope.", "Plan 3 moved to final review."],
    ["evaluator", "Review 3 approved.", "Evaluator approved close trace scope.", "Review 3 moved to goal freeze."],
    ["planner", "Goal frozen.", "Planner froze the close trace goal.", "Goal freeze moved to contract proposal."],
    ["generator", "Contract proposed.", "Generator drafted the close trace contract.", "Contract proposal moved to contract review."],
    ["evaluator", "Contract approved.", "Evaluator approved the close trace contract.", "Contract review moved to implementation."],
    ["generator", "Implementation completed.", "Generator implemented close trace verification work.", "Implementation moved to self-check."],
    ["generator", "Self-check completed.", "Generator checked close trace evidence.", "Self-check moved to independent evaluation."],
    ["evaluator", "Independent evaluation passed.", "Evaluator independently approved close trace evidence.", "Independent evaluation moved to verification."],
    ["evaluator", "Verification passed.", "Evaluator verified close trace preservation.", "Verification moved to governance refresh."],
    ["planner", "Governance refreshed.", "Planner refreshed governance records before close.", "Governance refresh moved to closeout."],
    ["operator", "Final closeout completed.", "Operator closed governance with final request/process/result trace.", "Closed dashboard trace remains projected."],
  ];
  for (const [actorRole, note, processSummary, resultSummary] of closeSteps) {
    advanceHarnessSession({
      workspacePath: root,
      sessionId,
      action: "complete",
      actorRole,
      note,
      processSummary,
      resultSummary,
      artifactPaths: ["docs/handovers/session-close-trace/governance-close.md"],
    });
  }
  const closedSession = readJson(root, "docs/ai-harness/runtime/sessions/session-close-trace.session.json");
  const dashboardState = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const traceEntry = dashboardState.sessionTraceability.entries.find((entry) => entry.sessionId === sessionId);
  const governedEntry = dashboardState.governedSessions.find((entry) => entry.id === sessionId);
  assert.equal(closedSession.session.status, "closed");
  assert.equal(traceEntry.status, "closed");
  assert.equal(traceEntry.phase, "closed");
  assert.match(traceEntry.processSummary, /Operator closed governance/);
  assert.match(traceEntry.resultSummary, /Closed dashboard trace remains projected/);
  assert.equal(traceEntry.traceIntegrity.status, "complete");
  assert.equal(governedEntry.status, "closed");
  assert.match(governedEntry.taskTrace.resultSummary, /Closed dashboard trace remains projected/);
}

{
  const { root } = generateWorkspace();
  startHarnessSession({
    workspacePath: root,
    goal: "Verify strict trace enforcement",
    originalRequest: "Verify strict trace enforcement for governed runtime tools.",
    processSummary: "Created a governed session for strict trace failure checks.",
    resultSummary: "Strict trace session opened.",
    sessionId: "session-strict-trace",
    chunkId: "chunk-strict-trace",
    queueIfBusy: true,
  });
  assert.throws(
    () =>
      advanceHarnessSession({
        workspacePath: root,
        sessionId: "session-strict-trace",
        action: "complete",
        actorRole: "planner",
        note: "This call intentionally omits resultSummary.",
        processSummary: "Planner attempted to advance without a result summary.",
      }),
    /resultSummary is required/
  );
  assert.throws(
    () =>
      recordHarnessExecutionResult({
        workspacePath: root,
        sessionId: "session-strict-trace",
        bridgeId: "codex-cli",
        outcome: "completed",
        summary: "This call intentionally omits processSummary.",
        resultSummary: "Receipt should not be accepted without process summary.",
      }),
    /processSummary is required/
  );
}

{
  const { root } = generateWorkspace();
  startHarnessSession({
    workspacePath: root,
    goal: "Add dependency",
    originalRequest: "Add a dependency with governed conflict detection.",
    processSummary: "Created a dependency-manifest session for parallel audit coverage.",
    resultSummary: "Dependency session was opened for integration-sensitive conflict review.",
    sessionId: "session-package",
    chunkId: "chunk-package",
    dependencyNotes: "parallel-ready: dependency manifest work",
    expectedWritePaths: ["package.json"],
    queueIfBusy: true,
  });
  startHarnessSession({
    workspacePath: root,
    goal: "Refresh lockfile",
    originalRequest: "Refresh the lockfile with governed conflict detection.",
    processSummary: "Created a lockfile session for parallel audit coverage.",
    resultSummary: "Lockfile session was opened for integration-sensitive conflict review.",
    sessionId: "session-lock",
    chunkId: "chunk-lock",
    dependencyNotes: "parallel-ready: lockfile work",
    expectedWritePaths: ["package-lock.json"],
    queueIfBusy: true,
  });
  const audit = auditHarnessParallelChunkConflicts(root);
  assert.equal(audit.valid, true);
  assert.ok(
    audit.warnings.some((warning) => /dependency manifest or lockfile/.test(warning)),
    "integration-sensitive dependency surfaces should warn even when paths differ"
  );
}

{
  const { root } = generateWorkspace();
  const statePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const state = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const maintenanceTask = (state.agentTaskQueues?.maintenance || []).find((item) => item && item.id === "task-bootstrap-refresh-projections");
  const bootstrapTask = maintenanceTask ? {
    id: maintenanceTask.id || "task-bootstrap-refresh-projections",
    title: maintenanceTask.title || "Verify and refresh dashboard projections",
    status: maintenanceTask.status || "waiting",
    owner: maintenanceTask.owner || "harness-dashboard-operator",
    lane: maintenanceTask.lane || "agent-maintenance",
    queueVisibility: maintenanceTask.queueVisibility || "agent-only",
    evidenceRefs: maintenanceTask.evidenceRefs || ["event-000001-bootstrap"],
    blockingClaimIds: maintenanceTask.blockingClaimIds ? [...maintenanceTask.blockingClaimIds] : [],
    nextActionRef: "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh",
  } : {
    id: "task-bootstrap-refresh-projections",
    status: "waiting",
    title: "Verify and refresh dashboard projections",
    owner: "harness-dashboard-operator",
    lane: "agent-maintenance",
    queueVisibility: "agent-only",
    evidenceRefs: ["event-000001-bootstrap"],
    blockingClaimIds: ["claim.world-model.bootstrap"],
    nextActionRef: "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh",
  };
  const sessionTask = {
    id: "session-0001",
    status: "running",
    title: "Bootstrap projection maintenance session",
    lane: "agent-maintenance",
    owner: "harness-dashboard-operator",
    queueVisibility: "agent-only",
    evidenceRefs: ["event-000001-bootstrap"],
    blockingClaimIds: [],
    nextActionRef: "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh",
  };
  state.taskQueues.waiting = Array.from(new Set([...(Array.isArray(state.taskQueues?.waiting) ? state.taskQueues.waiting : []), bootstrapTask.id, sessionTask.id]));
  state.userTaskBoard.remaining = Array.from(new Set([...(Array.isArray(state.userTaskBoard?.remaining) ? state.userTaskBoard.remaining : []), bootstrapTask.id, sessionTask.id]));
  state.governedSessions = state.governedSessions || [];
  if (!state.governedSessions.some((session) => session && session.id === sessionTask.id)) {
    state.governedSessions.push(sessionTask);
  }
  state.agile = state.agile || {};
  state.agile.backlog = state.agile.backlog || [];
  state.agileCadence = state.agileCadence || {};
  state.agileCadence.backlog = state.agileCadence.backlog || [];
  state.workTimeline = state.workTimeline || {};
  state.workTimeline.items = state.workTimeline.items || [];
  state.workReadinessMap = state.workReadinessMap || {};
  state.workReadinessMap.rows = state.workReadinessMap.rows || [];
  state.sessionLog = state.sessionLog || [];
  const hasTask = (items, id) => Array.isArray(items) && items.some((item) => String((item || {}).id || item || "") === id);
  if (!hasTask(state.agile.backlog, bootstrapTask.id)) {
    state.agile.backlog.push(bootstrapTask);
  }
  if (!hasTask(state.agileCadence.backlog, bootstrapTask.id)) {
    state.agileCadence.backlog.push(bootstrapTask);
  }
  if (!hasTask(state.workTimeline.items, bootstrapTask.id)) {
    state.workTimeline.items.push(bootstrapTask);
  }
  if (!hasTask(state.workReadinessMap.rows, bootstrapTask.id)) {
    state.workReadinessMap.rows.push(bootstrapTask);
  }
  if (!hasTask(state.sessionLog, bootstrapTask.id)) {
    state.sessionLog.push(bootstrapTask);
  }
  if (!hasTask(state.agile.backlog, sessionTask.id)) {
    state.agile.backlog.push(sessionTask);
  }
  if (!hasTask(state.agileCadence.backlog, sessionTask.id)) {
    state.agileCadence.backlog.push(sessionTask);
  }
  if (!hasTask(state.workTimeline.items, sessionTask.id)) {
    state.workTimeline.items.push(sessionTask);
  }
  if (!hasTask(state.workReadinessMap.rows, sessionTask.id)) {
    state.workReadinessMap.rows.push(sessionTask);
  }
  if (!hasTask(state.sessionLog, sessionTask.id)) {
    state.sessionLog.push(sessionTask);
  }
  state.agentTaskQueues = state.agentTaskQueues || {};
  state.agentTaskQueues.waiting = Array.from(new Set([...(Array.isArray(state.agentTaskQueues.waiting) ? state.agentTaskQueues.waiting : []), sessionTask.id]));
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");

  const scriptPath = path.join(root, "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs");
  const port = await getAvailablePort();
  const child = spawn(process.execPath, [scriptPath, "listen", "--port", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });

  try {
    await waitForText(() => output, /listening at/i);
    const tokenPath = path.join(root, "docs/ai-harness/dashboard/state/api-token");
    await waitForFile(tokenPath);
    const token = fs.readFileSync(tokenPath, "utf-8").trim();
    const authHeaders = { "x-harness-dashboard-token": token };
    const apiUrl = (pathAndQuery) =>
      `http://127.0.0.1:${port}/api/harness-dashboard/v1/${pathAndQuery}`;

    const runtimeQueryTokenResponse = await fetch(apiUrl(`runtime?token=${token}`));
    assert.equal(runtimeQueryTokenResponse.status, 401);

    const runtimeResponse = await fetch(apiUrl("runtime"), { headers: authHeaders });
    assert.equal(runtimeResponse.status, 200);
    const runtime = await runtimeResponse.json();
    assert.equal(runtime.readOnly, true);
    assert.equal(runtime.apiVersion, "v1");
    assert.ok(runtime.capabilities.includes("traceability"));
    assert.ok(runtime.capabilities.includes("reality-check"));
    assert.ok(runtime.capabilities.includes("evidence-ref"));
    assert.equal(runtime.payload.listener.status, "listening");

    const rejected = await fetch(apiUrl("runtime"));
    assert.equal(rejected.status, 401);

    const query = await fetch(apiUrl("query?q=world"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(query.readOnly, true);
    assert.ok(query.payload.resultCount > 0);
    const allQuery = await fetch(apiUrl("query?q=task-bootstrap-refresh-projections"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(allQuery.readOnly, true);
    assert.equal(allQuery.payload.resultCount, 0);
    assert.equal(allQuery.payload.results.every((item) => typeof item.text === "string" && !item.text.includes("task-bootstrap-refresh-projections")), true);
    assert.equal(allQuery.payload.results.every((item) => typeof item.text === "string" && !item.text.includes("session-0001")), true);

    const decisionsQuery = await fetch(apiUrl("query?scope=decisions&q=redacted-local-path"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(decisionsQuery.readOnly, true);
    assert.equal(JSON.stringify(decisionsQuery.payload).includes(root), false);
    assert.equal(JSON.stringify(decisionsQuery.payload).includes("task-bootstrap-refresh-projections"), false);

    const evidenceQuery = await fetch(apiUrl("query?scope=evidence&q=redacted-local-path"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(evidenceQuery.readOnly, true);
    assert.equal(JSON.stringify(evidenceQuery.payload).includes(root), false);
    assert.equal(JSON.stringify(evidenceQuery.payload).includes("task-bootstrap-refresh-projections"), false);

    const tasksPayload = await fetch(apiUrl("tasks"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(tasksPayload.readOnly, true);
    assert.equal(JSON.stringify(tasksPayload.payload).includes("task-bootstrap-refresh-projections"), false);
    assert.equal(JSON.stringify(tasksPayload.payload).includes("Verify and refresh dashboard projections"), false);

    const snapshotPayload = await fetch(apiUrl("snapshot"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(snapshotPayload.readOnly, true);
    assert.equal(JSON.stringify(snapshotPayload.payload).includes("task-bootstrap-refresh-projections"), false);
    assert.equal(JSON.stringify(snapshotPayload.payload).includes("session-0001"), false);
    assert.equal(JSON.stringify(snapshotPayload.payload).includes(root), false);
    assert.match(JSON.stringify(snapshotPayload.payload), /\[redacted-local-path\]/);

    const taskQuery = await fetch(apiUrl("query?scope=tasks&q=bootstrap-refresh"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(taskQuery.readOnly, true);
    assert.equal(taskQuery.payload.resultCount, 0);

    const agentTasksPayload = await fetch(apiUrl("agent-tasks"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(agentTasksPayload.readOnly, true);
    assert.equal(JSON.stringify(agentTasksPayload.payload).includes("task-bootstrap-refresh-projections"), true);
    assert.equal(JSON.stringify(agentTasksPayload.payload).includes("session-0001"), true);

    const sessionsPayload = await fetch(apiUrl("sessions"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(sessionsPayload.readOnly, true);
    assert.equal(JSON.stringify(sessionsPayload.payload).includes("task-bootstrap-refresh-projections"), false);
    assert.equal(JSON.stringify(sessionsPayload.payload).includes("session-0001"), false);
    assert.equal(JSON.stringify(sessionsPayload.payload).includes(root), false);

    const traceabilityPayload = await fetch(apiUrl("traceability"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(traceabilityPayload.readOnly, true);
    assert.equal(traceabilityPayload.payload.projectionConfidence.status, "projection-debt");
    assert.ok(traceabilityPayload.payload.sessionTraceability.entries[0].originalRequest);
    assert.equal(traceabilityPayload.payload.sessionTraceability.entries[0].traceIntegrity.status, "complete");
    assert.equal(JSON.stringify(traceabilityPayload.payload).includes(root), false);

    const realityCheckPayload = await fetch(apiUrl("reality-check"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(realityCheckPayload.readOnly, true);
    assert.equal(realityCheckPayload.payload.userRealityCheck.status, "bootstrap-action-plan");
    assert.equal(realityCheckPayload.payload.userRealityCheck.apiContract.route, "/api/harness-dashboard/v1/reality-check");
    assert.ok(realityCheckPayload.payload.userRealityCheck.actionPlan.some((item) => item.id === "action.verify-projections"));
    assert.equal(JSON.stringify(realityCheckPayload.payload).includes(root), false);

    const evidenceRefPayload = await fetch(apiUrl("evidence-ref?ref=event-000001-bootstrap"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(evidenceRefPayload.readOnly, true);
    assert.equal(evidenceRefPayload.payload.ref, "event-000001-bootstrap");
    assert.equal(evidenceRefPayload.payload.resultCount > 0, true);
    assert.ok(evidenceRefPayload.payload.matchSummary.candidateCount > 0);
    assert.ok(evidenceRefPayload.payload.matchSummary.exactMatchCount > 0);
    assert.ok(evidenceRefPayload.payload.results.some((item) => item.kind && item.sourcePath && item.title));
    assert.equal(evidenceRefPayload.payload.results[0].matchQuality, "exact");
    assert.ok(Number(evidenceRefPayload.payload.results[0].score) >= 100);
    assert.ok(evidenceRefPayload.payload.results[0].canonicalPath);
    assert.ok(evidenceRefPayload.payload.results[0].freshness);
    assert.ok(evidenceRefPayload.payload.results[0].provenance);
    assert.equal(JSON.stringify(evidenceRefPayload.payload).includes(root), false);

    const traceabilityQuery = await fetch(apiUrl("query?scope=traceability&q=originalRequest"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(traceabilityQuery.readOnly, true);
    assert.equal(traceabilityQuery.payload.resultCount > 0, true);
    assert.ok(traceabilityQuery.payload.indexSummary.candidateCount > 0);
    assert.ok(traceabilityQuery.payload.results[0].matchQuality);

    const realityCheckQuery = await fetch(apiUrl("query?scope=reality-check&q=verify-projections"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(realityCheckQuery.readOnly, true);
    assert.equal(realityCheckQuery.payload.resultCount > 0, true);
    assert.ok(realityCheckQuery.payload.results.every((item) => item.sourcePath && item.text));
    assert.equal(JSON.stringify(realityCheckQuery.payload).includes(root), false);

    const briefingResponse = await fetch(apiUrl("briefing"), { headers: authHeaders });
    assert.equal(briefingResponse.status, 200);
    const briefingPayload = await briefingResponse.json();
    assert.equal(briefingPayload.readOnly, true);
    assert.equal(briefingPayload.payload.manifest.focus, "today");
    assert.match(briefingPayload.payload.briefingMarkdown, /Harness Dashboard Briefing/);

    const snapshotEvent = await waitForSseEvent(
      `http://127.0.0.1:${port}/api/harness-dashboard/v1/events?token=${token}`,
      "harness.snapshot"
    );
    assert.equal(snapshotEvent.includes("task-bootstrap-refresh-projections"), false);
    assert.equal(snapshotEvent.includes("session-0001"), false);
  } finally {
    await terminateProcess(child);
  }
}

{
  const { root } = generateWorkspace();
  const runtimeIndex = readJson(root, "docs/ai-harness/runtime/version-index.json");
  const compatibilityMatrix = readJson(root, "docs/ai-harness/runtime/compatibility-matrix.json");
  assert.equal(runtimeIndex.latestVersion, CURRENT_VERSION);
  assert.equal(compatibilityMatrix.currentVersion, CURRENT_VERSION);
  assert.ok(
    runtimeIndex.versions.some(
      (entry) =>
        entry.version === CURRENT_VERSION &&
        entry.capabilities.includes("project-world-model-dashboard") &&
        entry.introducedFiles.includes("docs/ai-harness/dashboard/events/harness-events.jsonl")
    )
  );
}

console.log(`Harness Dashboard ${CURRENT_VERSION} generation tests passed.`);
