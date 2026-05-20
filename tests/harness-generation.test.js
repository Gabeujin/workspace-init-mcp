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

function createParams(workspacePath) {
  return {
    workspaceName: "Harness Workspace",
    purpose: "Verify Harness Dashboard 4.6 Hypertext Project World Model generation",
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
    "4.6 must not generate the old live-artifacts backend app by default"
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
  for (const key of DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS) {
    assert.ok(key in state, `dashboard-state.json should include ${key}`);
  }
  assert.equal(state.meta.schemaVersion, "4.6.0");
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
  assert.equal(state.dashboardQualityScorecard.uiUxDesignScore >= 9.5, true);
  assert.equal(state.governanceActionabilityScore.canPlan, true);
  assert.equal(state.governanceActionabilityScore.score >= 6.5, true);
  assert.ok(state.governanceActionabilityScore.operationalEvidenceScore < state.governanceActionabilityScore.score);
  assert.equal(state.agentPlatformGovernance.status, "awaiting-user-declaration");
  assert.ok(state.agentPlatformGovernance.activePlatforms.includes("vscode"));
  assert.equal(state.audienceLens.defaultMode, "stakeholder");
  assert.equal(state.audienceLens.modes.stakeholder.slideshowEnabled, true);
  assert.match(state.audienceLens.principle, /same ledger-backed truth/);
  assert.ok(state.decisionContracts.some((decision) => decision.id === "decision-agent-platform-selection"));
  assert.match(state.worldModelImprovementContract.purpose, /more truthful/);
  assert.ok(state.agentContextPacks.agent.mustRead.includes("worldModelImprovementContract"));
  assert.ok(state.agentContextPacks.agent.mustRead.includes("agentPlatformGovernance"));
  assert.ok(Array.isArray(state.workReadinessMap.rows));
  assert.ok(Array.isArray(state.projectEvidenceInventory.sources));
  assert.ok(state.valueHierarchy.values.some((item) => item.id === "value-save-integrity"));
  assert.ok(state.workTimeline.items.some((item) => item.blockingClaimIds?.includes("claim.release.traceability")));

  const html = byPath.get("docs/ai-harness/dashboard/index.html").content;
  const audiencePlan = byPath.get("docs/ai-harness/dashboard/audience-lens-presentation-plan.md").content;
  assert.match(audiencePlan, /Audience Lens is not a cosmetic selector/);
  assert.match(audiencePlan, /Slideshow Contract/);
  assert.match(html, /Harness Adoption Guide/);
  assert.match(html, /Governance Setup/);
  assert.match(html, /Operational evidence/);
  assert.match(html, /Executive Worldview/);
  assert.match(html, /Audience Lens/);
  assert.match(html, /Language/);
  assert.match(html, /Slide Show View/);
  assert.match(html, /data-slideshow-open/);
  assert.match(html, /slide-deck/);
  assert.match(html, /world-prism/);
  assert.match(html, /requestFullscreen/);
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
            parserVersion: "4.6.0",
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
              parserVersion: "4.6.0",
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

  result = runNode([scriptPath, "export-static", "--out", "public-export", "--public"], {
    cwd: root,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const exported = fs.readFileSync(path.join(root, "public-export", "harness-dashboard.html"), "utf-8");
  assert.doesNotMatch(exported, /api-token/);
  assert.match(exported, /redacted/);
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
  assert.equal(runtimeIndex.latestVersion, "4.6.0");
  assert.equal(compatibilityMatrix.currentVersion, "4.6.0");
  assert.ok(
    runtimeIndex.versions.some(
      (entry) =>
        entry.version === "4.6.0" &&
        entry.capabilities.includes("project-world-model-dashboard") &&
        entry.introducedFiles.includes("docs/ai-harness/dashboard/events/harness-events.jsonl")
    )
  );
}

console.log("Harness Dashboard 4.6 generation tests passed.");
