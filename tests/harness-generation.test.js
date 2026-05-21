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
const dashboardStateContractModule = await import("../dist/data/dashboard-state-contract.js");
const harnessRuntimeModule = await import("../dist/tools/harness-runtime.js");

const { collectFiles, buildSummary } = initModule;
const { validateWorkspace } = validateModule;
const { reconcileWorkspaceInitialization } = reconcileModule;
const { getHarnessDashboardContext } = dashboardContextModule;
const { DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS } = dashboardStateContractModule;
const { startHarnessSession, auditHarnessParallelChunkConflicts } = harnessRuntimeModule;

{
  const indexSource = fs.readFileSync(path.join(process.cwd(), "src/index.ts"), "utf-8");
  assert.match(indexSource, /domainStressProfile:\s*z/);
  assert.match(indexSource, /legacyAdoptionProfile:\s*z/);
  assert.match(indexSource, /primaryDomains:\s*z/);
}

function createParams(workspacePath) {
  return {
    workspaceName: "Harness Workspace",
    purpose: "Verify Harness Dashboard 4.6.1 Hypertext Project World Model generation",
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
  await new Promise((resolve, reject) => {
    const request = http.get(endpoint);
    const timer = setTimeout(() => {
      request.destroy();
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    request.on("response", (response) => {
      response.setEncoding("utf-8");
      response.on("data", (chunk) => {
        if (String(chunk).includes(`event: ${eventName}`)) {
          clearTimeout(timer);
          request.destroy();
          resolve();
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
    files.some((file) => file.relativePath.startsWith("live-artifacts-dashboard/")),
    false,
    "4.6.1 must not generate the old live-artifacts backend app by default"
  );

  for (const requiredPath of [
    "AGENTS.md",
    "docs/ai-harness/dashboard/events/harness-events.jsonl",
    "docs/ai-harness/dashboard/events/ledger-manifest.json",
    "docs/ai-harness/dashboard/entities/project-world-model.json",
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
  ]) {
    assert.ok(byPath.has(requiredPath), `${requiredPath} should be generated`);
  }

  const state = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const dashboardStateSchema = JSON.parse(
    byPath.get("docs/ai-harness/dashboard/state/dashboard-state.schema.json").content
  );
  assert.ok(dashboardStateSchema.properties.claimEvidenceMatrix.properties.missingEvidenceItems);
  assert.ok(dashboardStateSchema.properties.dashboardQualityScorecard.properties.qaEvidence);
  for (const key of DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS) {
    assert.ok(key in state, `dashboard-state.json should include ${key}`);
  }
  assert.equal(state.meta.schemaVersion, "4.6.1");
  assert.equal(state.projectWorldModel.mission.statement, params.purpose);
  assert.equal(state.listener.readOnly, true);
  assert.equal(state.embeddingProjection.policy.blockedByDefault.includes("secret"), true);
  assert.ok(Array.isArray(state.workTimeline.items));
  assert.equal(state.workTimeline.items[0].kpiTags.includes("world-model-completeness"), true);
  assert.equal(state.worldJudgment.status, "bootstrap-not-ready-for-operational-judgment");
  assert.ok(Array.isArray(state.criticalSignals));
  assert.ok(Array.isArray(state.claimEvidenceMatrix.claims));
  assert.ok(Array.isArray(state.claimEvidenceMatrix.missingEvidenceItems));
  assert.ok(state.claimEvidenceMatrix.claims.some((claim) => Array.isArray(claim.falsificationTests)));
  assert.ok(Array.isArray(state.readinessJudgments));
  assert.equal(state.judgmentConsole.nextRequiredDecision, "decision-first-governed-goal");
  assert.equal(state.trustBoundary.status, "bootstrap-warning");
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
  assert.ok(state.decisionContracts.some((decision) => decision.id === "decision-agent-platform-selection"));
  assert.ok(state.governanceEvidenceBrief.unresolvedDecisions.includes("decision-agent-platform-selection"));
  assert.ok(state.agentResumeBrief.governanceOnlyDecisions.includes("decision-agent-platform-selection"));
  assert.match(state.worldModelImprovementContract.purpose, /more truthful/);
  assert.ok(state.agentContextPacks.agent.mustRead.includes("worldModelImprovementContract"));
  assert.ok(state.agentContextPacks.agent.mustRead.includes("agentPlatformGovernance"));
  assert.ok(Array.isArray(state.workReadinessMap.rows));
  assert.ok(Array.isArray(state.projectEvidenceInventory.sources));
  assert.ok(state.valueHierarchy.values.some((item) => item.id === "value-user-outcome"));
  assert.ok(state.claimEvidenceMatrix.claims.some((claim) => claim.claimId === "claim.data.integrity"));
  assert.deepEqual(state.taskQueues.waiting, ["task-bootstrap-refresh-projections"]);
  assert.deepEqual(state.taskQueues.blocked, []);
  assert.equal(state.taskQueues.needsUser.includes("decision-agent-platform-selection"), false);
  assert.equal(state.claimEvidenceMatrix.missingEvidenceItems.find((item) => item.id === "missing.database-readiness").blocksClaimIds.includes("claim.service.operational-readiness"), false);
  assert.equal(state.kpis.some((kpi) => kpi.id === "commerce-payment-integrity"), false);
  assert.deepEqual(state.domainStress.activeProfileIds, []);
  assert.deepEqual(state.domainOperations.activeProfileIds, []);
  assert.equal(state.domainOperations.status, "no-active-domain-stress-profile");
  const baselineTaskIds = new Set([
    ...state.agile.backlog.map((item) => item.id),
    ...state.workTimeline.items.map((item) => item.id),
  ]);
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
  assert.match(html, /Work Board/);
  assert.match(html, /Kanban/);
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
  assert.match(copilot, /workspace-init-mcp:harness-world-model:start/);
  assert.match(copilot, /main agent acts as the hub/);
  assert.match(copilot, /Keep dashboard tabs non-duplicative/);

  const dashboardSkill = byPath.get(".github/skills/harness-dashboard-state-manager/SKILL.md").content;
  assert.match(dashboardSkill, /World Model Maturity Guidance/);
  assert.match(dashboardSkill, /Dashboard Collaboration Protocol/);

  const dashboardAgent = byPath.get(".github/agents/harness-dashboard-operator.agent.md").content;
  assert.match(dashboardAgent, /worldModelImprovementContract/);
  assert.match(dashboardAgent, /tab ownership/i);

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
  noisy.taskQueues.waiting.push("task-confirm-agent-platforms");
  noisy.taskQueues.blocked.push(
    "task-collect-service-health",
    "task-map-deployment-target",
    "task-map-data-readiness"
  );
  noisy.taskQueues.needsUser.push("decision-agent-platform-selection");
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
    id: "task-map-deployment-target",
    status: "blocked",
    title: "Legacy noisy deployment task",
    nextActionRef: "task-map-deployment-target",
  });
  noisy.workTimeline.items.push({
    id: "task-collect-service-health",
    status: "in-progress",
    title: "User-preserved health task",
    evidenceRefs: ["user-service-health-evidence"],
  });
  noisy.claimEvidenceMatrix.claims.push({
    claimId: "claim.data.save-integrity",
    statement: "Legacy game-specific data claim should not survive migration.",
  });
  noisy.claimEvidenceMatrix.missingEvidenceItems.push({
    id: "legacy-vcs-gap",
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
            parserVersion: "4.6.1",
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
              parserVersion: "4.6.1",
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
}

{
  const { root } = generateWorkspace();
  startHarnessSession({
    workspacePath: root,
    goal: "Add dependency",
    sessionId: "session-package",
    chunkId: "chunk-package",
    dependencyNotes: "parallel-ready: dependency manifest work",
    expectedWritePaths: ["package.json"],
    queueIfBusy: true,
  });
  startHarnessSession({
    workspacePath: root,
    goal: "Refresh lockfile",
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

    const runtimeResponse = await fetch(
      `http://127.0.0.1:${port}/api/harness-dashboard/v1/runtime?token=${token}`
    );
    assert.equal(runtimeResponse.status, 200);
    const runtime = await runtimeResponse.json();
    assert.equal(runtime.readOnly, true);
    assert.equal(runtime.apiVersion, "v1");
    assert.equal(runtime.payload.listener.status, "listening");

    const rejected = await fetch(
      `http://127.0.0.1:${port}/api/harness-dashboard/v1/runtime`
    );
    assert.equal(rejected.status, 401);

    const query = await fetch(
      `http://127.0.0.1:${port}/api/harness-dashboard/v1/query?q=world&token=${token}`
    ).then((response) => response.json());
    assert.equal(query.readOnly, true);
    assert.ok(query.payload.resultCount > 0);

    const briefingResponse = await fetch(
      `http://127.0.0.1:${port}/api/harness-dashboard/v1/briefing?token=${token}`
    );
    assert.equal(briefingResponse.status, 200);
    const briefingPayload = await briefingResponse.json();
    assert.equal(briefingPayload.readOnly, true);
    assert.equal(briefingPayload.payload.manifest.focus, "today");
    assert.match(briefingPayload.payload.briefingMarkdown, /Harness Dashboard Briefing/);

    await waitForSseEvent(
      `http://127.0.0.1:${port}/api/harness-dashboard/v1/events?token=${token}`,
      "harness.snapshot"
    );
  } finally {
    await terminateProcess(child);
  }
}

{
  const { root } = generateWorkspace();
  const runtimeIndex = readJson(root, "docs/ai-harness/runtime/version-index.json");
  const compatibilityMatrix = readJson(root, "docs/ai-harness/runtime/compatibility-matrix.json");
  assert.equal(runtimeIndex.latestVersion, "4.6.1");
  assert.equal(compatibilityMatrix.currentVersion, "4.6.1");
  assert.ok(
    runtimeIndex.versions.some(
      (entry) =>
        entry.version === "4.6.1" &&
        entry.capabilities.includes("project-world-model-dashboard") &&
        entry.introducedFiles.includes("docs/ai-harness/dashboard/events/harness-events.jsonl")
    )
  );
}

console.log("Harness Dashboard 4.6.1 generation tests passed.");
