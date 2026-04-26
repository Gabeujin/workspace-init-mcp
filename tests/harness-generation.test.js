import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const initModule = await import("../dist/tools/initialize.js");
const validateModule = await import("../dist/tools/validate.js");
const registryModule = await import("../dist/data/agent-skills-registry.js");
const generatorModule = await import("../dist/generators/agent-skills.js");
const installModule = await import("../dist/tools/agent-skills-install.js");
const runtimeModule = await import("../dist/tools/harness-runtime.js");
const readinessModule = await import("../dist/tools/readiness.js");
const reconcileModule = await import("../dist/tools/reconcile.js");
const managedInventoryModule = await import("../dist/tools/managed-inventory.js");

const { collectFiles } = initModule;
const { validateWorkspace } = validateModule;
const { generateSelectedSkills } = generatorModule;
const { resolveWorkspaceTargetIDEs } = installModule;
const {
  assessWorkspaceReadiness,
  auditWorkspaceReadinessSemantics,
} = readinessModule;
const {
  reconcileWorkspaceInitialization,
  exportReconcilePreflightReport,
  restoreReconcileBackup,
} = reconcileModule;
const {
  auditWorkspaceManagedSemanticDiff,
  auditWorkspaceUpgradeRisk,
} = managedInventoryModule;
const {
  startHarnessSession,
  advanceHarnessSession,
  getHarnessSessionStatus,
  activateHarnessSession,
  auditHarnessRuntime,
  compactHarnessRuntime,
  listHarnessRuntimeAdapters,
  listHarnessExecutionBridges,
  listHarnessNativeExecutors,
  prepareHarnessWorkPacket,
  prepareHarnessAdapterHandoff,
  prepareHarnessExecutionBridge,
  prepareHarnessNativeExecutor,
  launchHarnessNativeExecutor,
  getHarnessNativeExecutionStatus,
  recordHarnessExecutionResult,
} = runtimeModule;
const { SKILL_REGISTRY, AGENT_REGISTRY, recommendAgentSkills } = registryModule;

function createParams() {
  return {
    workspaceName: "Harness Workspace",
    purpose: "Verify harness-first workspace generation",
    workspacePath: "C:/tmp/harness-workspace",
    projectType: "web-app",
    techStack: ["TypeScript", "Node.js"],
    includeAgentSkills: true,
    includeHarnessEngineering: true,
    targetIDEs: ["vscode"],
  };
}

function writeGeneratedFiles(rootDir, files) {
  for (const file of files) {
    const fullPath = path.join(rootDir, file.relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content, "utf-8");
  }
}

async function runGeneratedDashboardOps(scriptPath, args, gitFixturePath) {
  const originalArgv = process.argv;
  const originalGitFixture = process.env.DASHBOARD_GIT_FIXTURE;

  process.argv = [process.execPath, scriptPath, ...args];
  process.env.DASHBOARD_GIT_FIXTURE = gitFixturePath;

  try {
    await import(`${pathToFileURL(scriptPath).href}?run=${Date.now()}-${Math.random()}`);
  } finally {
    process.argv = originalArgv;
    if (originalGitFixture == null) {
      delete process.env.DASHBOARD_GIT_FIXTURE;
    } else {
      process.env.DASHBOARD_GIT_FIXTURE = originalGitFixture;
    }
  }
}

function completeHarnessSessionToClose(workspacePath) {
  const closeSequence = [
    ["planner", "Complete Plan 1."],
    ["evaluator", "Approve Review 1."],
    ["planner", "Complete Plan 2."],
    ["evaluator", "Approve Review 2."],
    ["planner", "Complete Plan 3."],
    ["evaluator", "Approve Review 3."],
    ["planner", "Freeze the governed goal."],
    ["generator", "Draft and complete the contract proposal."],
    ["evaluator", "Approve the contract review."],
    ["generator", "Complete the bounded implementation."],
    ["generator", "Finish the self-check evidence."],
    ["evaluator", "Pass the independent evaluation."],
    ["evaluator", "Pass verification."],
    ["planner", "Refresh governance artifacts."],
    ["planner", "Close governance."],
  ];

  for (const [actorRole, note] of closeSequence) {
    advanceHarnessSession({
      workspacePath,
      action: "complete",
      actorRole,
      note,
    });
  }
}

for (const skillId of [
  "harness-governance-manager",
  "harness-documentation-records",
  "harness-dashboard-state-manager",
  "workspace-reconcile-safety",
  "cli-runtime-bridge-orchestration",
  "domain-model-ledger",
  "harness-implementation-orchestrator",
  "harness-multi-expert-review",
  "harness-code-review-pipeline",
  "harness-post-work-review",
  "service-endpoint-tracer",
  "message-resource-lookup",
  "legacy-sql-review",
]) {
  assert.ok(SKILL_REGISTRY.some((skill) => skill.id === skillId), `${skillId} missing from skill registry`);
}

for (const agentId of [
  "harness-doc-writer",
  "harness-dashboard-operator",
  "legacy-reconcile-operator",
  "cli-runtime-bridge-operator",
  "harness-expert-reviewer",
  "harness-implementer",
  "harness-verifier",
  "harness-quality-gate",
  "legacy-enterprise-analysis",
  "risk-focused-code-review",
]) {
  assert.ok(AGENT_REGISTRY.some((agent) => agent.id === agentId), `${agentId} missing from agent registry`);
}

const files = collectFiles(createParams());
const byPath = new Map(files.map((file) => [file.relativePath, file.content]));

const registryIndex = byPath.get(".github/AGENT-SKILLS.md");
assert.ok(registryIndex, "main agent skills index not generated");
assert.match(registryIndex, /Quick Start/);
assert.match(registryIndex, /AGENT-SKILLS-BY-ROLE\.md/);
assert.match(registryIndex, /Foundation Bundle/);
assert.match(registryIndex, /Canonical Registry/);

const operatingModel = byPath.get(".github/ai-harness/operating-model.md");
assert.ok(operatingModel, "operating model not generated");
assert.match(operatingModel, /Plan 1 -> Review 1 -> Plan 2 -> Review 2 -> Plan 3 -> Review 3/);
assert.match(operatingModel, /Add or update tests for changed behavior/);
assert.match(operatingModel, /chunk contract/i);
assert.match(operatingModel, /context reset/i);

const contextStrategy = byPath.get(".github/ai-harness/context-strategy.md");
assert.ok(contextStrategy, "context strategy not generated");
assert.match(contextStrategy, /compaction/i);
assert.match(contextStrategy, /context reset/i);

const evaluationRubrics = byPath.get(".github/ai-harness/evaluation-rubrics.md");
assert.ok(evaluationRubrics, "evaluation rubrics not generated");
assert.match(evaluationRubrics, /Contract Fidelity/);
assert.match(evaluationRubrics, /generator self-approve/i);

const managedFileInventory = byPath.get(".github/ai-harness/managed-file-inventory.json");
assert.ok(managedFileInventory, "managed file inventory not generated");
const parsedManagedFileInventory = JSON.parse(managedFileInventory);
assert.ok(
  parsedManagedFileInventory.entries.some(
    (entry) =>
      entry.path === ".github/ai-harness/operating-model.md" &&
      entry.strategy === "replace"
  ),
  "managed file inventory should track replace-style governed files"
);
assert.ok(
  parsedManagedFileInventory.entries.some(
    (entry) =>
      entry.path === "docs/ai-harness/dashboard/state/dashboard-state.json" &&
      entry.strategy === "merge"
  ),
  "managed file inventory should track merge-style governed JSON files"
);

const reconcilePolicy = byPath.get(".github/ai-harness/reconcile-policy.json");
assert.ok(reconcilePolicy, "reconcile policy not generated");
const parsedReconcilePolicy = JSON.parse(reconcilePolicy);
assert.equal(
  parsedReconcilePolicy.activePreset,
  "balanced",
  "reconcile policy should default to the balanced preset"
);
assert.ok(
  parsedReconcilePolicy.presets?.conservative,
  "reconcile policy should expose a conservative preset for safer legacy upgrades"
);
assert.ok(
  parsedReconcilePolicy.presets?.["refresh-heavy"],
  "reconcile policy should expose a refresh-heavy preset for reviewed automation-heavy upgrades"
);
assert.ok(
  parsedReconcilePolicy.rules.some(
    (rule) =>
      rule.pattern === ".github/ai-harness/operating-model.md" &&
      rule.policy === "hold"
  ),
  "reconcile policy should protect operating model drift with a hold rule"
);

const nativeExecutorOverrides = byPath.get(
  ".github/ai-harness/native-executor-overrides.json"
);
assert.ok(nativeExecutorOverrides, "native executor overrides not generated");
const parsedNativeExecutorOverrides = JSON.parse(nativeExecutorOverrides);
assert.ok(
  Object.prototype.hasOwnProperty.call(parsedNativeExecutorOverrides.executors, "codex-cli"),
  "native executor overrides should expose a Codex launch profile slot"
);
assert.ok(
  Object.prototype.hasOwnProperty.call(
    parsedNativeExecutorOverrides.executors,
    "github-copilot"
  ),
  "native executor overrides should expose a Copilot handoff profile slot"
);

const reviewLedger = byPath.get("docs/reviews/README.md");
assert.ok(reviewLedger, "review ledger not generated");
assert.match(reviewLedger, /plan-1/);
assert.match(reviewLedger, /review-3/);

const contractLedger = byPath.get("docs/contracts/README.md");
assert.ok(contractLedger, "contract ledger not generated");
assert.match(contractLedger, /done criteria/i);

const evaluationsLedger = byPath.get("docs/evaluations/README.md");
assert.ok(evaluationsLedger, "evaluations ledger not generated");
assert.match(evaluationsLedger, /independent evaluation/i);

const dashboardReadme = byPath.get("docs/ai-harness/dashboard/README.md");
assert.ok(dashboardReadme, "dashboard README not generated");
assert.match(dashboardReadme, /DX \(Digital Transformation\) and AX \(AI Transformation\)/);
assert.match(dashboardReadme, /templates\/\*\.state\.json/);

const dashboardHtml = byPath.get("docs/ai-harness/dashboard/index.html");
assert.ok(dashboardHtml, "dashboard HTML not generated");
assert.match(dashboardHtml, /AI Harness Dashboard/);
assert.match(dashboardHtml, /Git-friendly/);
assert.match(dashboardHtml, /runtime-orchestration/);

const dashboardOpsReadme = byPath.get("docs/ai-harness/dashboard/scripts/README.md");
assert.ok(dashboardOpsReadme, "dashboard operations README not generated");
assert.match(dashboardOpsReadme, /dashboard-ops\.mjs refresh/);

const dashboardOpsScript = byPath.get("docs/ai-harness/dashboard/scripts/dashboard-ops.mjs");
assert.ok(dashboardOpsScript, "dashboard operations script not generated");
assert.match(dashboardOpsScript, /export-static/);
assert.match(dashboardOpsScript, /serve/);

const readinessGuide = byPath.get("docs/ai-harness/readiness/README.md");
assert.ok(readinessGuide, "readiness guide not generated");
assert.match(readinessGuide, /remaining-work spec/i);

const remainingWorkSpec = byPath.get(
  "docs/ai-harness/readiness/remaining-work-spec.md"
);
assert.ok(remainingWorkSpec, "remaining work specification not generated");
assert.match(remainingWorkSpec, /Runtime Orchestration/);
assert.match(remainingWorkSpec, /Dashboard And Stakeholder Visibility/);

const readinessScoringModel = byPath.get(
  "docs/ai-harness/readiness/scoring-model.md"
);
assert.ok(readinessScoringModel, "readiness scoring model not generated");
assert.match(readinessScoringModel, /ready/);
assert.match(readinessScoringModel, /fragile/);

const readinessScorecardTemplate = byPath.get(
  "docs/ai-harness/readiness/maturity-scorecard.template.json"
);
assert.ok(
  readinessScorecardTemplate,
  "readiness scorecard template not generated"
);
const parsedReadinessScorecardTemplate = JSON.parse(readinessScorecardTemplate);
assert.equal(parsedReadinessScorecardTemplate.assessmentStatus, "not-assessed");
assert.equal(parsedReadinessScorecardTemplate.dimensions.length, 7);

const runtimeReadme = byPath.get("docs/ai-harness/runtime/README.md");
assert.ok(runtimeReadme, "runtime orchestrator README not generated");
assert.match(runtimeReadme, /start_harness_session/);
assert.match(runtimeReadme, /prepare_harness_work_packet/);
assert.match(runtimeReadme, /prepare_harness_adapter_handoff/);
assert.match(runtimeReadme, /prepare_harness_execution_bridge/);
assert.match(runtimeReadme, /record_harness_execution_result/);
assert.match(runtimeReadme, /list_harness_native_executors/);
assert.match(runtimeReadme, /launch_harness_native_executor/);
assert.match(runtimeReadme, /version-index\.json/);
assert.match(runtimeReadme, /adapter-contract\.json/);

const runtimeVersionIndex = byPath.get("docs/ai-harness/runtime/version-index.json");
assert.ok(runtimeVersionIndex, "runtime version capability index not generated");
const parsedRuntimeVersionIndex = JSON.parse(runtimeVersionIndex);
assert.equal(parsedRuntimeVersionIndex.latestVersion, "4.1.2");
assert.ok(
  parsedRuntimeVersionIndex.versions.some(
    (entry) =>
      entry.version === "4.1.1" &&
      entry.capabilities.includes("codex-exec-native-executor")
  ),
  "runtime version index should preserve the 4.1.1 Codex bridge capability"
);
assert.ok(
  parsedRuntimeVersionIndex.versions.some(
    (entry) =>
      entry.version === "4.1.2" &&
      entry.capabilities.includes("cross-agent-adapter-contract") &&
      entry.capabilities.includes("github-copilot-runtime-adapter")
  ),
  "runtime version index should describe the 4.1.2 adapter contract capability"
);

const runtimeCompatibilityMatrix = byPath.get(
  "docs/ai-harness/runtime/compatibility-matrix.json"
);
assert.ok(runtimeCompatibilityMatrix, "runtime compatibility matrix not generated");
const parsedRuntimeCompatibilityMatrix = JSON.parse(runtimeCompatibilityMatrix);
assert.equal(parsedRuntimeCompatibilityMatrix.currentVersion, "4.1.2");
assert.ok(
  parsedRuntimeCompatibilityMatrix.upgradePaths.some(
    (entry) => entry.from === "4.1.1" && entry.to === "4.1.2"
  ),
  "runtime compatibility matrix should include the 4.1.1 to 4.1.2 upgrade path"
);
assert.ok(
  parsedRuntimeCompatibilityMatrix.requiredRuntimeFiles.includes(
    "docs/ai-harness/runtime/adapter-contract.json"
  ),
  "runtime compatibility matrix should require the adapter contract"
);
assert.ok(
  parsedRuntimeCompatibilityMatrix.requiredRuntimeFiles.includes(
    "docs/ai-harness/runtime/adapters/github-copilot.md"
  ),
  "runtime compatibility matrix should require the Copilot adapter profile"
);

const runtimeAdapterContract = byPath.get(
  "docs/ai-harness/runtime/adapter-contract.json"
);
assert.ok(runtimeAdapterContract, "runtime adapter contract not generated");
const parsedRuntimeAdapterContract = JSON.parse(runtimeAdapterContract);
assert.equal(parsedRuntimeAdapterContract.contractVersion, "1.0.0");
assert.ok(
  ["copilot", "codex", "claude", "gemini", "openhands"].every((runtime) =>
    parsedRuntimeAdapterContract.supportedRuntimes.includes(runtime)
  ),
  "runtime adapter contract should support the primary agent runtimes"
);
assert.ok(
  parsedRuntimeAdapterContract.requiredHandoffFields.includes("compatibility"),
  "runtime adapter contract should require compatibility metadata"
);

const runtimeSessionContinuity = byPath.get(
  "docs/ai-harness/runtime/session-continuity.md"
);
assert.ok(runtimeSessionContinuity, "runtime session continuity contract not generated");
assert.match(runtimeSessionContinuity, /Copilot <-> Codex <-> Claude <-> Gemini/);

const runtimeStateMachine = byPath.get("docs/ai-harness/runtime/state-machine.md");
assert.ok(runtimeStateMachine, "runtime state machine not generated");
assert.match(runtimeStateMachine, /contract-review/);
assert.match(runtimeStateMachine, /context_reset/);

const runtimeSessionIndex = byPath.get("docs/ai-harness/runtime/state/session-index.json");
assert.ok(runtimeSessionIndex, "runtime session index not generated");
const parsedRuntimeSessionIndex = JSON.parse(runtimeSessionIndex);
assert.equal(parsedRuntimeSessionIndex.activeSessionId, null);
assert.deepEqual(parsedRuntimeSessionIndex.queuedSessionIds, []);
assert.equal(parsedRuntimeSessionIndex.lease.status, "idle");

const runtimeActiveSession = byPath.get("docs/ai-harness/runtime/state/active-session.json");
assert.ok(runtimeActiveSession, "runtime active session template not generated");
const parsedRuntimeActiveSession = JSON.parse(runtimeActiveSession);
assert.equal(parsedRuntimeActiveSession.status, "idle");
assert.equal(parsedRuntimeActiveSession.queueDepth, 0);

const runtimeCurrentWorkPacket = byPath.get(
  "docs/ai-harness/runtime/state/current-work-packet.json"
);
assert.ok(
  runtimeCurrentWorkPacket,
  "runtime current work packet template not generated"
);
const parsedRuntimeCurrentWorkPacket = JSON.parse(runtimeCurrentWorkPacket);
assert.equal(parsedRuntimeCurrentWorkPacket.leaseStatus, "idle");
assert.equal(parsedRuntimeCurrentWorkPacket.activeSessionId, null);

const runtimeCurrentExecutionBridge = byPath.get(
  "docs/ai-harness/runtime/state/current-execution-bridge.json"
);
assert.ok(
  runtimeCurrentExecutionBridge,
  "runtime current execution bridge template not generated"
);
const parsedRuntimeCurrentExecutionBridge = JSON.parse(runtimeCurrentExecutionBridge);
assert.equal(parsedRuntimeCurrentExecutionBridge.activeSessionId, null);
assert.equal(parsedRuntimeCurrentExecutionBridge.bridgeId, null);

const runtimeCurrentNativeExecution = byPath.get(
  "docs/ai-harness/runtime/state/current-native-execution.json"
);
assert.ok(
  runtimeCurrentNativeExecution,
  "runtime current native execution template not generated"
);
const parsedRuntimeCurrentNativeExecution = JSON.parse(runtimeCurrentNativeExecution);
assert.equal(parsedRuntimeCurrentNativeExecution.activeSessionId, null);
assert.equal(parsedRuntimeCurrentNativeExecution.status, "idle");
assert.equal(parsedRuntimeCurrentNativeExecution.lastMessageFile, null);

const runtimeWorkPacketGuide = byPath.get(
  "docs/ai-harness/runtime/work-packets/README.md"
);
assert.ok(runtimeWorkPacketGuide, "runtime work packet guide not generated");
assert.match(runtimeWorkPacketGuide, /execution packet/i);

const runtimeAdaptersGuide = byPath.get(
  "docs/ai-harness/runtime/adapters/README.md"
);
assert.ok(runtimeAdaptersGuide, "runtime adapters guide not generated");
assert.match(runtimeAdaptersGuide, /Codex/i);
assert.match(runtimeAdaptersGuide, /OpenHands/i);
assert.match(runtimeAdaptersGuide, /gemini-cli/i);
assert.match(runtimeAdaptersGuide, /generic-cli/i);
assert.match(runtimeAdaptersGuide, /adapter-contract\.json/i);

const runtimeCopilotAdapter = byPath.get(
  "docs/ai-harness/runtime/adapters/github-copilot.md"
);
assert.ok(runtimeCopilotAdapter, "GitHub Copilot adapter profile not generated");
assert.match(runtimeCopilotAdapter, /Adapter ID: `github-copilot`/);

const runtimeCodexAdapter = byPath.get(
  "docs/ai-harness/runtime/adapters/codex-cli.md"
);
assert.ok(runtimeCodexAdapter, "codex adapter profile not generated");
assert.match(runtimeCodexAdapter, /Adapter ID: `codex-cli`/);
assert.match(runtimeCodexAdapter, /codex exec/i);

const runtimeGeminiAdapter = byPath.get(
  "docs/ai-harness/runtime/adapters/gemini-cli.md"
);
assert.ok(runtimeGeminiAdapter, "gemini adapter profile not generated");
assert.match(runtimeGeminiAdapter, /Adapter ID: `gemini-cli`/);

const runtimeAdapterHandoffsGuide = byPath.get(
  "docs/ai-harness/runtime/adapter-handoffs/README.md"
);
assert.ok(
  runtimeAdapterHandoffsGuide,
  "runtime adapter handoff guide not generated"
);
assert.match(runtimeAdapterHandoffsGuide, /handoff\.json/);

const runtimeBridgesGuide = byPath.get("docs/ai-harness/runtime/bridges/README.md");
assert.ok(runtimeBridgesGuide, "runtime bridges guide not generated");
assert.match(runtimeBridgesGuide, /prepare_harness_execution_bridge/);
assert.match(runtimeBridgesGuide, /github-copilot/i);
assert.match(runtimeBridgesGuide, /gemini-cli/i);
assert.match(runtimeBridgesGuide, /generic-cli/i);

const runtimeExecutionBridgesGuide = byPath.get(
  "docs/ai-harness/runtime/execution-bridges/README.md"
);
assert.ok(
  runtimeExecutionBridgesGuide,
  "runtime execution bridges guide not generated"
);
assert.match(runtimeExecutionBridgesGuide, /bridge-manifest\.json/);

const runtimeNativeExecutorsGuide = byPath.get(
  "docs/ai-harness/runtime/native-executors/README.md"
);
assert.ok(
  runtimeNativeExecutorsGuide,
  "runtime native executors guide not generated"
);
assert.match(runtimeNativeExecutorsGuide, /prepare_harness_native_executor/);
assert.match(runtimeNativeExecutorsGuide, /github-copilot/i);
assert.match(runtimeNativeExecutorsGuide, /gemini-cli/i);
assert.match(runtimeNativeExecutorsGuide, /generic-cli/i);

const runtimeNativeCodexExecutor = byPath.get(
  "docs/ai-harness/runtime/native-executors/codex-cli.md"
);
assert.ok(
  runtimeNativeCodexExecutor,
  "codex native executor profile not generated"
);
assert.match(runtimeNativeCodexExecutor, /Native executor ID: `codex-cli`/);
assert.match(runtimeNativeCodexExecutor, /codex exec/i);
assert.match(runtimeNativeCodexExecutor, /last message/i);

const runtimeArchiveGuide = byPath.get("docs/ai-harness/runtime/archive/README.md");
assert.ok(runtimeArchiveGuide, "runtime archive guide not generated");
assert.match(runtimeArchiveGuide, /compact_harness_runtime/);

const runtimeArchiveIndex = byPath.get(
  "docs/ai-harness/runtime/archive/archive-index.json"
);
assert.ok(runtimeArchiveIndex, "runtime archive index not generated");
const parsedRuntimeArchiveIndex = JSON.parse(runtimeArchiveIndex);
assert.equal(parsedRuntimeArchiveIndex.totalArchivedSessions, 0);
assert.deepEqual(parsedRuntimeArchiveIndex.bundles, []);

const dashboardState = byPath.get("docs/ai-harness/dashboard/state/dashboard-state.json");
assert.ok(dashboardState, "dashboard state JSON not generated");
const parsedDashboardState = JSON.parse(dashboardState);
assert.equal(parsedDashboardState.domainLens.mode, "software-delivery");
assert.equal(parsedDashboardState.governanceState.policyId, "three-plan-three-review");
assert.equal(parsedDashboardState.kpiProfile.id, "software-devops-governed-kpis");
assert.ok(
  parsedDashboardState.kpiProfile.requiredKpiIds.includes("session-governance-coverage"),
  "dashboard should require session governance coverage in the KPI profile"
);
assert.ok(
  parsedDashboardState.kpiProfile.requiredKpiIds.includes("contract-coverage"),
  "dashboard should require contract coverage in the KPI profile"
);
assert.ok(
  parsedDashboardState.kpiProfile.requiredKpiIds.includes("independent-evaluation-discipline"),
  "dashboard should require independent evaluation discipline in the KPI profile"
);
assert.ok(
  parsedDashboardState.kpis.some(
    (kpi) =>
      kpi.id === "test-coverage-discipline" &&
      kpi.required === true &&
      Array.isArray(kpi.perspectives) &&
      kpi.perspectives.includes("DevOps")
  ),
  "software delivery dashboards should expose mandatory DevOps-aligned KPI definitions"
);
assert.ok(
  parsedDashboardState.kpis.some((kpi) => kpi.id === "ax-dx-adoption"),
  "dashboard should expose a DX/AX readiness KPI"
);
assert.ok(
  Array.isArray(parsedDashboardState.governedSessions) &&
    parsedDashboardState.governedSessions.length > 0,
  "dashboard should bootstrap governed sessions"
);
assert.ok(
  parsedDashboardState.artifacts.some((artifact) => artifact.id === "admin-dashboard"),
  "dashboard should include the admin dashboard artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "managed-file-inventory"
  ),
  "dashboard should include the managed file inventory artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some((artifact) => artifact.id === "readiness-guide"),
  "dashboard should include the readiness guide artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "remaining-work-spec"
  ),
  "dashboard should include the remaining work specification artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "readiness-scoring-model"
  ),
  "dashboard should include the readiness scoring model artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "readiness-scorecard-template"
  ),
  "dashboard should include the readiness scorecard template artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some((artifact) => artifact.id === "contract-ledger"),
  "dashboard should include the contract ledger artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some((artifact) => artifact.id === "evaluation-ledger"),
  "dashboard should include the evaluation ledger artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some((artifact) => artifact.id === "runtime-session-index"),
  "dashboard should include the runtime session index artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-current-work-packet"
  ),
  "dashboard should include the current runtime work packet artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-adapters-guide"
  ),
  "dashboard should include the runtime adapters guide artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-version-index"
  ),
  "dashboard should include the runtime version index artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-compatibility-matrix"
  ),
  "dashboard should include the runtime compatibility matrix artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-adapter-contract"
  ),
  "dashboard should include the runtime adapter contract artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-session-continuity"
  ),
  "dashboard should include the runtime session continuity artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-current-execution-bridge"
  ),
  "dashboard should include the current execution bridge artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-native-executors-guide"
  ),
  "dashboard should include the native executors guide artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-current-native-execution"
  ),
  "dashboard should include the current native execution artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-bridges-guide"
  ),
  "dashboard should include the runtime bridges guide artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-archive-guide"
  ),
  "dashboard should include the runtime archive guide artifact"
);
assert.ok(
  parsedDashboardState.artifacts.some(
    (artifact) => artifact.id === "runtime-archive-index"
  ),
  "dashboard should include the runtime archive index artifact"
);
assert.equal(
  parsedDashboardState.runtimeOrchestration.currentPhase,
  "awaiting-session-start",
  "dashboard should expose runtime orchestration state before the first session starts"
);
assert.equal(
  parsedDashboardState.runtimeOrchestration.nativeExecutionStateFile,
  "docs/ai-harness/runtime/state/current-native-execution.json"
);
assert.equal(parsedDashboardState.runtimeOrchestration.nativeExecutionPlanFile, null);
assert.equal(parsedDashboardState.runtimeOrchestration.nativeExecutorBridgeId, null);
assert.equal(parsedDashboardState.runtimeOrchestration.leaseStatus, "idle");
assert.equal(parsedDashboardState.runtimeOrchestration.queueDepth, 0);
assert.ok(
  parsedDashboardState.gitStatus.auditExpectations.includes("Track dashboard JSON files in version control."),
  "dashboard should track git visibility requirements"
);

const dashboardSchema = byPath.get("docs/ai-harness/dashboard/state/dashboard-state.schema.json");
assert.ok(dashboardSchema, "dashboard schema not generated");
const parsedDashboardSchema = JSON.parse(dashboardSchema);
assert.ok(
  parsedDashboardSchema.required.includes("versionLedger"),
  "dashboard schema should require versionLedger"
);
assert.ok(
  parsedDashboardSchema.required.includes("runtimeOrchestration"),
  "dashboard schema should require runtime orchestration state"
);

const dashboardTemplate = byPath.get("docs/ai-harness/dashboard/templates/creative-narrative.state.json");
assert.ok(dashboardTemplate, "creative dashboard template not generated");
const parsedCreativeTemplate = JSON.parse(dashboardTemplate);
assert.equal(parsedCreativeTemplate.domainLens.mode, "creative-narrative");
assert.ok(
  parsedCreativeTemplate.entities.some((entity) => entity.type === "character"),
  "creative dashboard template should include character tracking"
);

const adoptionPaths = byPath.get("docs/ai-harness/adoption-paths.md");
assert.ok(adoptionPaths, "DX/AX adoption playbook not generated");
assert.match(adoptionPaths, /Legacy Project Adoption Track/);
assert.match(adoptionPaths, /New Project Track/);

const harnessSkill = byPath.get(".github/skills/harness-governance-manager/SKILL.md");
assert.ok(harnessSkill, "harness governance skill not generated");
assert.match(harnessSkill, /open governance first/i);

const documentationSkill = byPath.get(".github/skills/harness-documentation-records/SKILL.md");
assert.ok(documentationSkill, "harness documentation records skill not generated");
assert.match(documentationSkill, /durable record before implementation/i);

const dashboardSkill = byPath.get(".github/skills/harness-dashboard-state-manager/SKILL.md");
assert.ok(dashboardSkill, "dashboard state manager skill not generated");
assert.match(dashboardSkill, /dashboard state in JSON files only/i);

const domainLedgerSkill = byPath.get(".github/skills/domain-model-ledger/SKILL.md");
assert.ok(domainLedgerSkill, "domain model ledger skill not generated");
assert.match(domainLedgerSkill, /software delivery/i);

const harnessAgent = byPath.get(".github/agents/harness-quality-gate.agent.md");
assert.ok(harnessAgent, "harness quality gate agent not generated");
assert.match(harnessAgent, /tools: \[read, edit, search, execute\]/);
assert.match(harnessAgent, /user-invocable: true/);
assert.match(harnessAgent, /Refresh governance artifacts last/);

const riskReviewAgent = byPath.get(".github/agents/risk-focused-code-review.agent.md");
assert.ok(riskReviewAgent, "risk-focused review agent not generated");
assert.match(riskReviewAgent, /Findings come first/);

const dashboardAgent = byPath.get(".github/agents/harness-dashboard-operator.agent.md");
assert.ok(dashboardAgent, "dashboard operator agent not generated");
assert.match(dashboardAgent, /Maintain the administrator dashboard/i);

const roleIndex = byPath.get(".github/AGENT-SKILLS-BY-ROLE.md");
assert.ok(roleIndex, "role index not generated");
assert.match(roleIndex, /Reviewer/);
assert.match(roleIndex, /risk-focused-code-review/);

const domainIndex = byPath.get(".github/AGENT-SKILLS-BY-DOMAIN.md");
assert.ok(domainIndex, "domain index not generated");
assert.match(domainIndex, /Shared Foundation/);
assert.match(domainIndex, /Selected Project Type Focus/);

const machineIndex = byPath.get(".github/agent-skill-index.json");
assert.ok(machineIndex, "machine-readable catalog index not generated");
const parsedMachineIndex = JSON.parse(machineIndex);
assert.equal(parsedMachineIndex.workspace.projectType, "web-app");
assert.ok(
  parsedMachineIndex.roles.some((role) => role.id === "reviewer"),
  "machine index should include reviewer role"
);
assert.ok(
  parsedMachineIndex.domains.some((domain) => domain.id === "shared"),
  "machine index should include shared domain"
);
assert.ok(
  parsedMachineIndex.workspace.installTargets.some(
    (target) => target.skills === ".github/skills" && target.canonical === true
  ),
  "machine index should include the canonical registry target"
);

const cursorFiles = collectFiles({
  ...createParams(),
  targetIDEs: ["cursor"],
});
const cursorByPath = new Map(cursorFiles.map((file) => [file.relativePath, file.content]));
assert.ok(
  cursorByPath.has(".github/skills/harness-governance-manager/SKILL.md"),
  "cursor-only initialization should still generate the canonical skill registry"
);
assert.ok(
  cursorByPath.has(".cursor/skills/harness-governance-manager/SKILL.md"),
  "cursor-only initialization should mirror skills into .cursor"
);
assert.ok(
  cursorByPath.has(".cursor/agents/harness-quality-gate.agent.md"),
  "cursor-only initialization should mirror agents into .cursor"
);

const cursorMachineIndex = JSON.parse(cursorByPath.get(".github/agent-skill-index.json"));
assert.deepEqual(cursorMachineIndex.workspace.targetIDEs, ["cursor"]);
assert.ok(
  cursorMachineIndex.workspace.installTargets.some(
    (target) => target.label === "cursor" && target.skills === ".cursor/skills"
  ),
  "machine index should record cursor mirrors"
);

const multiIdeFiles = collectFiles({
  ...createParams(),
  targetIDEs: ["cursor", "claude-code", "openhands"],
});
const multiIdePaths = new Set(multiIdeFiles.map((file) => file.relativePath));
for (const requiredPath of [
  ".github/skills/harness-governance-manager/SKILL.md",
  ".cursor/skills/harness-governance-manager/SKILL.md",
  ".claude/skills/harness-governance-manager/SKILL.md",
  ".agents/skills/harness-governance-manager/SKILL.md",
  ".cursor/agents/harness-quality-gate.agent.md",
  ".claude/agents/harness-quality-gate.agent.md",
  ".agents/agents/harness-quality-gate.agent.md",
]) {
  assert.ok(multiIdePaths.has(requiredPath), `${requiredPath} should be generated for multi-IDE initialization`);
}

const polyglotSkill = SKILL_REGISTRY.find((skill) => skill.id === "polyglot-test-agent");
assert.ok(polyglotSkill, "polyglot-test-agent missing from skill registry");
const riskReviewEntry = AGENT_REGISTRY.find((agent) => agent.id === "risk-focused-code-review");
assert.ok(riskReviewEntry, "risk-focused-code-review missing from agent registry");

const selectedInstallFiles = generateSelectedSkills(
  [polyglotSkill],
  [riskReviewEntry],
  {
    workspaceName: "Selected Agent Skills",
    workspacePath: "C:/tmp/selected-skill-install",
    targetIDEs: ["cursor", "claude-code"],
  }
);
const selectedByPath = new Map(selectedInstallFiles.map((file) => [file.relativePath, file.content]));
for (const requiredPath of [
  ".github/skills/polyglot-test-agent/SKILL.md",
  ".github/skills/polyglot-test-agent/unit-test-generation.prompt.md",
  ".cursor/skills/polyglot-test-agent/unit-test-generation.prompt.md",
  ".claude/skills/polyglot-test-agent/unit-test-generation.prompt.md",
  ".github/agents/risk-focused-code-review.agent.md",
  ".cursor/agents/risk-focused-code-review.agent.md",
  ".claude/agents/risk-focused-code-review.agent.md",
]) {
  assert.ok(selectedByPath.has(requiredPath), `${requiredPath} should be included in selected installs`);
}

const targetIndexWorkspace = fs.mkdtempSync(path.join(process.cwd(), "tmp-target-index-"));
try {
  fs.mkdirSync(path.join(targetIndexWorkspace, ".github"), { recursive: true });
  fs.writeFileSync(
    path.join(targetIndexWorkspace, ".github", "agent-skill-index.json"),
    JSON.stringify(
      {
        workspace: {
          targetIDEs: ["cursor", "openhands"],
        },
      },
      null,
      2
    ),
    "utf-8"
  );
  assert.deepEqual(
    resolveWorkspaceTargetIDEs(targetIndexWorkspace),
    ["cursor", "openhands"],
    "target IDEs should be restored from the machine-readable index"
  );
  assert.deepEqual(
    resolveWorkspaceTargetIDEs(targetIndexWorkspace, ["claude-code"]),
    ["claude-code"],
    "explicit install target IDs should override workspace detection"
  );
} finally {
  fs.rmSync(targetIndexWorkspace, { recursive: true, force: true });
}

const targetDirWorkspace = fs.mkdtempSync(path.join(process.cwd(), "tmp-target-dir-"));
try {
  fs.mkdirSync(path.join(targetDirWorkspace, ".claude", "skills"), { recursive: true });
  fs.mkdirSync(path.join(targetDirWorkspace, ".agents", "agents"), { recursive: true });
  assert.deepEqual(
    resolveWorkspaceTargetIDEs(targetDirWorkspace),
    ["claude-code", "openhands"],
    "target IDEs should fall back to existing directory detection"
  );
} finally {
  fs.rmSync(targetDirWorkspace, { recursive: true, force: true });
}

const creativeFiles = collectFiles({
  ...createParams(),
  projectType: "creative",
  purpose: "Track story continuity and chapter delivery",
  primaryDomains: ["story", "characters", "timeline"],
});
const creativeByPath = new Map(creativeFiles.map((file) => [file.relativePath, file.content]));
const creativeDashboardState = JSON.parse(
  creativeByPath.get("docs/ai-harness/dashboard/state/dashboard-state.json")
);
assert.equal(creativeDashboardState.domainLens.mode, "creative-narrative");
assert.ok(
  creativeDashboardState.timeline.some((entry) => entry.type === "story-beat"),
  "creative initialization should switch the dashboard into narrative mode"
);
assert.ok(
  creativeDashboardState.versionLedger.some((entry) => entry.label.includes("Draft")),
  "creative initialization should include draft progression"
);

const fullWorkspace = fs.mkdtempSync(path.join(process.cwd(), "tmp-full-workspace-"));
try {
  const generatedFiles = collectFiles(createParams());
  writeGeneratedFiles(fullWorkspace, generatedFiles);

  const startedSession = startHarnessSession({
    workspacePath: fullWorkspace,
    goal: "Deliver the first governed runtime-backed feature slice.",
    sessionId: "session-runtime-001",
    chunkId: "chunk-runtime-001",
    chunkTitle: "First governed runtime slice",
  });
  assert.equal(startedSession.currentPhase, "plan-1");
  assert.equal(startedSession.nextActor, "planner");
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, startedSession.workPacketPath)),
    "starting a session should generate a durable work packet JSON"
  );
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, startedSession.actorInboxPath)),
    "starting a session should generate a role inbox handoff file"
  );

  const queuedSession = startHarnessSession({
    workspacePath: fullWorkspace,
    goal: "Prepare the second governed session in the queue.",
    sessionId: "session-runtime-002",
    chunkId: "chunk-runtime-002",
    chunkTitle: "Queued governed runtime slice",
  });
  assert.match(queuedSession.summary, /queued/i);

  const sessionStatus = getHarnessSessionStatus(fullWorkspace);
  assert.match(sessionStatus.summary, /Current phase: plan-1/);
  assert.match(sessionStatus.summary, /Next actor: planner/);
  assert.match(sessionStatus.summary, /Queue depth: 1/);

  const queuedStatus = getHarnessSessionStatus(fullWorkspace, "session-runtime-002");
  assert.match(queuedStatus.summary, /Lease status: queued/);

  const reviewTransition = advanceHarnessSession({
    workspacePath: fullWorkspace,
    action: "complete",
    actorRole: "planner",
    note: "Plan 1 complete and ready for evaluator review.",
  });
  assert.equal(reviewTransition.currentPhase, "review-1");
  assert.equal(reviewTransition.nextActor, "evaluator");

  const reworkTransition = advanceHarnessSession({
    workspacePath: fullWorkspace,
    action: "request_changes",
    actorRole: "evaluator",
    note: "The first plan needs tighter done criteria before we proceed.",
  });
  assert.equal(reworkTransition.currentPhase, "plan-1");
  assert.equal(reworkTransition.nextActor, "planner");

  const resetTransition = advanceHarnessSession({
    workspacePath: fullWorkspace,
    action: "context_reset",
    actorRole: "planner",
    note: "Reset the session context before rewriting Plan 1.",
    nextStep: "Resume Plan 1 from the latest handover and tighten the done criteria.",
  });
  assert.equal(resetTransition.currentPhase, "plan-1");
  assert.equal(resetTransition.nextActor, "planner");
  assert.ok(
    fs.existsSync(
      path.join(
        fullWorkspace,
        "docs",
        "handovers",
        "session-runtime-001",
        "chunk-runtime-001-context-reset-1.md"
      )
    ),
    "context reset should generate a durable handover artifact"
  );

  const runtimeDashboardState = JSON.parse(
    fs.readFileSync(
      path.join(
        fullWorkspace,
        "docs",
        "ai-harness",
        "dashboard",
        "state",
        "dashboard-state.json"
      ),
      "utf-8"
    )
  );
  assert.equal(
    runtimeDashboardState.runtimeOrchestration.activeSessionId,
    "session-runtime-001"
  );
  assert.equal(runtimeDashboardState.runtimeOrchestration.currentPhase, "plan-1");
  assert.equal(
    runtimeDashboardState.runtimeOrchestration.workPacketFile,
    "docs/ai-harness/runtime/work-packets/session-runtime-001.work-packet.json"
  );
  assert.equal(runtimeDashboardState.runtimeOrchestration.queueDepth, 1);
  assert.ok(
    runtimeDashboardState.runtimeOrchestration.queuedSessionIds.includes(
      "session-runtime-002"
    )
  );
  assert.equal(runtimeDashboardState.progressState.activeChunk, "chunk-runtime-001");
  assert.ok(
    runtimeDashboardState.sessionLog.some((session) => session.id === "session-runtime-001"),
    "runtime sync should add the governed session to the dashboard session log"
  );
  assert.ok(
    runtimeDashboardState.governedSessions.some(
      (session) => session.id === "session-runtime-001"
    ),
    "runtime sync should add the governed session to the dashboard governed sessions"
  );

  const runtimeAudit = auditHarnessRuntime(fullWorkspace);
  assert.equal(runtimeAudit.valid, true, "runtime audit should pass after queueing and resets");

  const activatedSession = activateHarnessSession(
    fullWorkspace,
    "session-runtime-002",
    "Switch the active lease to the queued session for focused execution.",
    true
  );
  assert.equal(activatedSession.sessionId, "session-runtime-002");
  const activatedStatus = getHarnessSessionStatus(fullWorkspace);
  assert.match(activatedStatus.summary, /session-runtime-002/);
  assert.match(activatedStatus.summary, /Lease status: active/);
  const preparedPacket = prepareHarnessWorkPacket(fullWorkspace, "session-runtime-002");
  assert.match(preparedPacket.summary, /Harness work packet prepared/);
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, preparedPacket.workPacketPath)),
    "explicit packet preparation should regenerate the session work packet"
  );
  const adapterCatalog = listHarnessRuntimeAdapters();
  assert.ok(
    adapterCatalog.adapters.some((adapter) => adapter.id === "github-copilot"),
    "runtime adapter catalog should include the GitHub Copilot adapter"
  );
  assert.ok(
    adapterCatalog.adapters.some((adapter) => adapter.id === "codex-cli"),
    "runtime adapter catalog should include the Codex adapter"
  );
  assert.ok(
    adapterCatalog.adapters.some((adapter) => adapter.id === "gemini-cli"),
    "runtime adapter catalog should include the Gemini adapter"
  );
  assert.ok(
    adapterCatalog.adapters.some((adapter) => adapter.id === "generic-cli"),
    "runtime adapter catalog should include the generic CLI adapter"
  );
  const bridgeCatalog = listHarnessExecutionBridges();
  assert.ok(
    bridgeCatalog.bridges.some((bridge) => bridge.id === "github-copilot"),
    "execution bridge catalog should include the GitHub Copilot bridge"
  );
  assert.ok(
    bridgeCatalog.bridges.some((bridge) => bridge.id === "codex-cli"),
    "execution bridge catalog should include the Codex bridge"
  );
  assert.ok(
    bridgeCatalog.bridges.some((bridge) => bridge.id === "gemini-cli"),
    "execution bridge catalog should include the Gemini bridge"
  );
  assert.ok(
    bridgeCatalog.bridges.some((bridge) => bridge.id === "generic-cli"),
    "execution bridge catalog should include the generic CLI bridge"
  );
  const copilotHandoff = prepareHarnessAdapterHandoff(
    fullWorkspace,
    "github-copilot",
    "session-runtime-002"
  );
  assert.match(copilotHandoff.summary, /GitHub Copilot Chat/);
  const copilotExecutionBridge = prepareHarnessExecutionBridge(
    fullWorkspace,
    "github-copilot",
    "session-runtime-002"
  );
  const copilotBridgeManifest = JSON.parse(
    fs.readFileSync(
      path.join(fullWorkspace, copilotExecutionBridge.bridgeManifestPath),
      "utf-8"
    )
  );
  assert.equal(copilotBridgeManifest.bridge.runtimeFamily, "copilot");
  assert.equal(
    copilotBridgeManifest.compatibility.adapterContractFile,
    "docs/ai-harness/runtime/adapter-contract.json"
  );
  const codexHandoff = prepareHarnessAdapterHandoff(
    fullWorkspace,
    "codex-cli",
    "session-runtime-002"
  );
  assert.match(codexHandoff.summary, /Codex CLI \/ Desktop/);
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, codexHandoff.handoffPath)),
    "adapter handoff should generate a machine-readable JSON bundle"
  );
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, codexHandoff.handoffMarkdownPath)),
    "adapter handoff should generate a markdown handoff bundle"
  );
  const codexHandoffMarkdown = fs.readFileSync(
    path.join(fullWorkspace, codexHandoff.handoffMarkdownPath),
    "utf-8"
  );
  assert.match(codexHandoffMarkdown, /Work packet JSON:/);
  assert.match(codexHandoffMarkdown, /Prompt Block/);
  assert.match(codexHandoffMarkdown, /Adapter contract:/);
  assert.match(codexHandoffMarkdown, /Version index:/);
  assert.match(codexHandoffMarkdown, /Session continuity:/);
  const codexHandoffJson = JSON.parse(
    fs.readFileSync(path.join(fullWorkspace, codexHandoff.handoffPath), "utf-8")
  );
  assert.equal(codexHandoffJson.compatibility.mcpServerVersion, "4.1.2");
  assert.equal(
    codexHandoffJson.fileReferences.adapterContractFile,
    "docs/ai-harness/runtime/adapter-contract.json"
  );
  assert.ok(
    codexHandoffJson.compatibility.requiredInterfaceFields.includes("sessionId"),
    "adapter handoff should declare the stable cross-agent interface fields"
  );
  const codexExecutionBridge = prepareHarnessExecutionBridge(
    fullWorkspace,
    "codex-cli",
    "session-runtime-002"
  );
  assert.match(codexExecutionBridge.summary, /Harness execution bridge prepared/);
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, codexExecutionBridge.bridgeManifestPath)),
    "execution bridge should generate a bridge manifest"
  );
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, codexExecutionBridge.launchPowershellPath)),
    "execution bridge should generate a PowerShell launcher"
  );
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, codexExecutionBridge.resultTemplatePath)),
    "execution bridge should generate a result template"
  );
  const codexBridgeManifest = JSON.parse(
    fs.readFileSync(path.join(fullWorkspace, codexExecutionBridge.bridgeManifestPath), "utf-8")
  );
  assert.ok(
    codexBridgeManifest.launchCommands.powershell.some((command) =>
      String(command).includes("codex exec") &&
      String(command).includes("--output-last-message")
    ),
    "Codex execution bridge should include the governed codex exec command with durable final-message capture"
  );
  assert.equal(
    codexBridgeManifest.resultArtifacts.nativeLastMessageFile,
    "docs/ai-harness/runtime/execution-bridges/session-runtime-002/codex-cli/native-executor.last-message.md"
  );
  assert.equal(
    codexBridgeManifest.compatibility.adapterContractFile,
    "docs/ai-harness/runtime/adapter-contract.json"
  );
  const claudeHandoff = prepareHarnessAdapterHandoff(
    fullWorkspace,
    "claude-code",
    "session-runtime-002"
  );
  assert.match(claudeHandoff.summary, /Claude Code \/ Claude CLI/);
  const claudeExecutionBridge = prepareHarnessExecutionBridge(
    fullWorkspace,
    "claude-code",
    "session-runtime-002"
  );
  const claudeBridgeManifest = JSON.parse(
    fs.readFileSync(path.join(fullWorkspace, claudeExecutionBridge.bridgeManifestPath), "utf-8")
  );
  assert.ok(
    claudeBridgeManifest.launchCommands.powershell.some((command) =>
      String(command).includes('claude -p "')
    ),
    "Claude execution bridge should include a documented Claude CLI prompt invocation"
  );
  assert.ok(
    claudeBridgeManifest.launchCommands.powershell.some((command) =>
      String(command).includes("claude-code --cwd")
    ),
    "Claude execution bridge should preserve the claude-code prompt-file fallback"
  );
  const geminiHandoff = prepareHarnessAdapterHandoff(
    fullWorkspace,
    "gemini-cli",
    "session-runtime-002"
  );
  assert.match(geminiHandoff.summary, /Gemini CLI/);
  const geminiExecutionBridge = prepareHarnessExecutionBridge(
    fullWorkspace,
    "gemini-cli",
    "session-runtime-002"
  );
  const geminiBridgeManifest = JSON.parse(
    fs.readFileSync(path.join(fullWorkspace, geminiExecutionBridge.bridgeManifestPath), "utf-8")
  );
  assert.ok(
    geminiBridgeManifest.launchCommands.powershell.some((command) =>
      String(command).includes('gemini -p "@')
    ),
    "Gemini execution bridge should include the dedicated prompt-file inclusion command"
  );
  const executionReceipt = recordHarnessExecutionResult({
    workspacePath: fullWorkspace,
    bridgeId: "codex-cli",
    sessionId: "session-runtime-002",
    outcome: "completed",
    summary: "External runtime completed the governed work slice and produced durable artifacts.",
    artifactPaths: ["docs/work-logs/session-runtime-002-external-run.md"],
    nextStep: "Move to the next evaluator-led checkpoint with the receipt evidence attached.",
  });
  assert.match(executionReceipt.summary, /Outcome: completed/);
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, executionReceipt.receiptPath)),
    "execution bridge should record a governed receipt"
  );
  const nativeExecutorCatalog = listHarnessNativeExecutors();
  assert.ok(
    nativeExecutorCatalog.executors.some((executor) => executor.id === "github-copilot"),
    "native executor catalog should include the GitHub Copilot manual profile"
  );
  assert.ok(
    nativeExecutorCatalog.executors.some((executor) => executor.id === "codex-cli"),
    "native executor catalog should include the Codex executor"
  );
  assert.ok(
    nativeExecutorCatalog.executors.some((executor) => executor.id === "claude-code"),
    "native executor catalog should include the Claude executor"
  );
  assert.ok(
    nativeExecutorCatalog.executors.some((executor) => executor.id === "gemini-cli"),
    "native executor catalog should include the Gemini executor"
  );
  const preparedNativeExecutor = prepareHarnessNativeExecutor(
    fullWorkspace,
    "codex-cli",
    "session-runtime-002",
    {
      executableOverride: process.execPath,
    }
  );
  assert.equal(preparedNativeExecutor.available, true);
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, preparedNativeExecutor.nativeExecutionPlanPath)),
    "native executor preparation should write a plan file"
  );
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, preparedNativeExecutor.nativeExecutionStatePath)),
    "native executor preparation should write a state file"
  );
  assert.equal(
    preparedNativeExecutor.lastMessagePath,
    "docs/ai-harness/runtime/execution-bridges/session-runtime-002/codex-cli/native-executor.last-message.md"
  );
  const preparedNativePlan = JSON.parse(
    fs.readFileSync(
      path.join(fullWorkspace, preparedNativeExecutor.nativeExecutionPlanPath),
      "utf-8"
    )
  );
  assert.ok(
    preparedNativePlan.launch.args.includes("exec"),
    "Codex native executor plan should default to codex exec"
  );
  assert.ok(
    preparedNativePlan.launch.args.includes("--output-last-message"),
    "Codex native executor plan should capture the final message into a durable artifact"
  );
  assert.equal(
    preparedNativePlan.launch.lastMessageFile,
    "docs/ai-harness/runtime/execution-bridges/session-runtime-002/codex-cli/native-executor.last-message.md"
  );
  const launchedNativeExecutor = launchHarnessNativeExecutor({
    workspacePath: fullWorkspace,
    bridgeId: "codex-cli",
    sessionId: "session-runtime-002",
    executableOverride: process.execPath,
    argsOverride: ["-e", "console.log('native executor ok')"],
    dryRun: true,
  });
  assert.equal(
    launchedNativeExecutor.status,
    "dry-run",
    "native executor launch should support governed dry runs in restricted environments"
  );
  const nativeExecutorStatus = getHarnessNativeExecutionStatus(
    fullWorkspace,
    "session-runtime-002",
    "codex-cli"
  );
  assert.match(nativeExecutorStatus.summary, /Native execution status: prepared/);
  const preparedClaudeNativeExecutor = prepareHarnessNativeExecutor(
    fullWorkspace,
    "claude-code",
    "session-runtime-002",
    {
      executableOverride: process.execPath,
      argsOverride: ["-e", "console.log('claude native executor ok')"],
    }
  );
  assert.equal(preparedClaudeNativeExecutor.available, true);
  const launchedClaudeNativeExecutor = launchHarnessNativeExecutor({
    workspacePath: fullWorkspace,
    bridgeId: "claude-code",
    sessionId: "session-runtime-002",
    executableOverride: process.execPath,
    argsOverride: ["-e", "console.log('claude native executor ok')"],
    dryRun: true,
  });
  assert.equal(
    launchedClaudeNativeExecutor.status,
    "dry-run",
    "Claude native executor launch should support governed dry runs"
  );
  const preparedGeminiNativeExecutor = prepareHarnessNativeExecutor(
    fullWorkspace,
    "gemini-cli",
    "session-runtime-002",
    {
      executableOverride: process.execPath,
      argsOverride: ["-e", "console.log('gemini native executor ok')"],
    }
  );
  assert.equal(preparedGeminiNativeExecutor.available, true);
  const launchedGeminiNativeExecutor = launchHarnessNativeExecutor({
    workspacePath: fullWorkspace,
    bridgeId: "gemini-cli",
    sessionId: "session-runtime-002",
    executableOverride: process.execPath,
    argsOverride: ["-e", "console.log('gemini native executor ok')"],
    dryRun: true,
  });
  assert.equal(
    launchedGeminiNativeExecutor.status,
    "dry-run",
    "Gemini native executor launch should also support governed dry runs"
  );
  fs.writeFileSync(
    path.join(
      fullWorkspace,
      ".github",
      "ai-harness",
      "native-executor-overrides.json"
    ),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        executors: {
          "codex-cli": {
            commandCandidates: ["codex-custom"],
            prependArgsTemplate: ["--from-prepend"],
            appendArgsTemplate: ["--tail-flag"],
          },
        },
        bridges: {
          "codex-cli": {
            prependPowershell: ['Write-Host "override bootstrap"'],
            powershell: ['codex-custom "{handoffInstruction}"'],
            appendBash: ['echo "override tail"'],
            bash: ['codex-custom "{handoffInstruction}"'],
          },
        },
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  const overriddenCodexBridge = prepareHarnessExecutionBridge(
    fullWorkspace,
    "codex-cli",
    "session-runtime-002"
  );
  const overriddenCodexBridgeManifest = JSON.parse(
    fs.readFileSync(path.join(fullWorkspace, overriddenCodexBridge.bridgeManifestPath), "utf-8")
  );
  assert.ok(
    overriddenCodexBridgeManifest.launchCommands.powershell.some((command) =>
      String(command).includes("override bootstrap")
    ),
    "execution bridge should honor workspace-level prepended bridge commands"
  );
  assert.ok(
    overriddenCodexBridgeManifest.launchCommands.powershell.some((command) =>
      String(command).includes("codex-custom")
    ),
    "execution bridge should honor workspace-level native executor overrides"
  );
  const overriddenCodexNativeExecutor = prepareHarnessNativeExecutor(
    fullWorkspace,
    "codex-cli",
    "session-runtime-002",
    {
      executableOverride: process.execPath,
    }
  );
  const overriddenCodexNativePlan = JSON.parse(
    fs.readFileSync(
      path.join(fullWorkspace, overriddenCodexNativeExecutor.nativeExecutionPlanPath),
      "utf-8"
    )
  );
  assert.ok(
    overriddenCodexNativePlan.executor.commandCandidates.includes("codex-custom"),
    "native executor plan should honor workspace-level command candidate overrides"
  );
  assert.ok(
    overriddenCodexNativePlan.launch.args.includes("--from-prepend"),
    "native executor plan should honor workspace-level prepended args overrides"
  );
  assert.ok(
    overriddenCodexNativePlan.launch.args.includes("--tail-flag"),
    "native executor plan should honor workspace-level appended args overrides"
  );
  const postNativeDashboardState = JSON.parse(
    fs.readFileSync(
      path.join(
        fullWorkspace,
        "docs",
        "ai-harness",
        "dashboard",
        "state",
        "dashboard-state.json"
      ),
      "utf-8"
    )
  );
  assert.ok(
    postNativeDashboardState.artifacts.some(
      (artifact) =>
        artifact.id === "runtime-current-native-execution" &&
        artifact.path === "docs/ai-harness/runtime/state/current-native-execution.json"
    ),
    "dashboard should track the current native execution snapshot"
  );
  assert.ok(
    postNativeDashboardState.artifacts.some(
      (artifact) =>
        String(artifact.id || "").startsWith(
          "runtime-native-execution-plan-session-runtime-002-codex-cli"
        )
    ),
    "dashboard should track the native execution plan artifact"
  );
  assert.ok(
    postNativeDashboardState.artifacts.some(
      (artifact) =>
        String(artifact.id || "").startsWith(
          "runtime-native-execution-last-message-session-runtime-002-codex-cli"
        )
    ),
    "dashboard should track the Codex native executor last-message artifact"
  );
  assert.equal(
    postNativeDashboardState.runtimeOrchestration.nativeExecutorBridgeId,
    "codex-cli"
  );
  assert.equal(
    postNativeDashboardState.runtimeOrchestration.nativeExecutionStateFile,
    "docs/ai-harness/runtime/execution-bridges/session-runtime-002/codex-cli/native-execution-state.json"
  );

  const validation = validateWorkspace(fullWorkspace);
  assert.equal(validation.isInitialized, true, "generated workspace should validate as initialized");
  assert.equal(
    validation.completeness,
    100,
    "generated workspace should include the full expected baseline"
  );
  const readinessAssessment = assessWorkspaceReadiness(fullWorkspace, true);
  assert.equal(
    readinessAssessment.classification,
    "ready",
    "generated workspace should start from a ready baseline after initialization"
  );
  assert.ok(
    readinessAssessment.overallScore >= 95,
    "generated workspace should receive a strong conservative readiness score"
  );
  assert.equal(
    readinessAssessment.scorecardPath,
    "docs/ai-harness/readiness/maturity-scorecard.json"
  );
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, readinessAssessment.scorecardPath)),
    "readiness assessment should write a scorecard when requested"
  );
  assert.match(readinessAssessment.summary, /Initialization completeness: 100%/);
  assert.match(readinessAssessment.summary, /Overall score:/);

  const patchPath = path.join(fullWorkspace, "dashboard-patch.json");
  fs.writeFileSync(
    patchPath,
    JSON.stringify(
      {
        progressState: {
          blocked: false,
          nextAction: "Start the first approved implementation chunk.",
          stageChecklist: [
            { id: "governance-open", label: "Governance Open", status: "complete" },
            { id: "plan-1", label: "Plan 1", status: "complete" },
            { id: "review-1", label: "Review 1", status: "complete" },
            { id: "plan-2", label: "Plan 2", status: "in-progress" },
            { id: "review-2", label: "Review 2", status: "todo" },
            { id: "plan-3", label: "Plan 3", status: "todo" },
            { id: "review-3", label: "Review 3", status: "todo" },
            { id: "goal-freeze", label: "Goal Freeze", status: "todo" },
            { id: "governance-refresh", label: "Governance Refresh", status: "todo" },
            { id: "implementation", label: "Implementation", status: "todo" },
            { id: "verification", label: "Verification", status: "todo" },
            { id: "governance-close", label: "Governance Close", status: "todo" }
          ]
        }
      },
      null,
      2
    ),
    "utf-8"
  );

  const gitFixturePath = path.join(fullWorkspace, "dashboard-git-fixture.json");
  fs.writeFileSync(
    gitFixturePath,
    JSON.stringify(
      {
        trackedByGit: "yes",
        currentBranch: "main",
        defaultBranch: "main",
        lastCommit: {
          sha: "abc123def456",
          message: "bootstrap",
          author: "Codex Test",
          committedAt: "2026-04-21T10:00:00.000Z"
        },
        workingTree: {
          status: "dirty",
          stagedChanges: "0",
          unstagedChanges: "1",
          untrackedFiles: "0"
        }
      },
      null,
      2
    ),
    "utf-8"
  );

  const dashboardOpsPath = path.join(
    fullWorkspace,
    "docs",
    "ai-harness",
    "dashboard",
    "scripts",
    "dashboard-ops.mjs"
  );

  const runtimeActiveSessionPath = path.join(
    fullWorkspace,
    "docs",
    "ai-harness",
    "runtime",
    "state",
    "active-session.json"
  );
  const runtimeActiveSessionState = JSON.parse(
    fs.readFileSync(runtimeActiveSessionPath, "utf-8")
  );
  runtimeActiveSessionState.nextAction =
    "Runtime file says the next step is to resume Plan 1 from the fresh handover.";
  fs.writeFileSync(
    runtimeActiveSessionPath,
    JSON.stringify(runtimeActiveSessionState, null, 2) + "\n",
    "utf-8"
  );

  await runGeneratedDashboardOps(
    dashboardOpsPath,
    ["refresh", "--workspace-root", fullWorkspace, "--patch", patchPath],
    gitFixturePath
  );

  await runGeneratedDashboardOps(dashboardOpsPath, ["validate"], gitFixturePath);

  const exportDir = path.join(
    fullWorkspace,
    "docs",
    "ai-harness",
    "dashboard",
    "exports",
    "latest"
  );
  await runGeneratedDashboardOps(
    dashboardOpsPath,
    ["export-static", "--workspace-root", fullWorkspace, "--out", exportDir],
    gitFixturePath
  );

  const refreshedState = JSON.parse(
    fs.readFileSync(
      path.join(
        fullWorkspace,
        "docs",
        "ai-harness",
        "dashboard",
        "state",
        "dashboard-state.json"
      ),
      "utf-8"
    )
  );
  assert.equal(refreshedState.gitStatus.trackedByGit, "yes");
  assert.match(refreshedState.gitStatus.currentBranch, /main|master/);
  assert.notEqual(refreshedState.gitStatus.lastCommit.sha, "TBD");
  assert.equal(refreshedState.executiveSummary.currentStage, "plan-2");
  assert.equal(refreshedState.kpiProfile.id, "software-devops-governed-kpis");
  assert.equal(
    refreshedState.runtimeOrchestration.activeSessionId,
    "session-runtime-002",
    "dashboard refresh should preserve runtime orchestration state"
  );
  assert.equal(
    refreshedState.runtimeOrchestration.workPacketFile,
    "docs/ai-harness/runtime/work-packets/session-runtime-002.work-packet.json",
    "dashboard refresh should preserve the active work packet path"
  );
  assert.equal(
    refreshedState.runtimeOrchestration.leaseStatus,
    "leased",
    "dashboard refresh should preserve the active lease state"
  );
  assert.equal(
    refreshedState.runtimeOrchestration.queueDepth,
    1,
    "dashboard refresh should preserve queue metadata for non-active sessions"
  );
  assert.ok(
    refreshedState.runtimeOrchestration.queuedSessionIds.includes("session-runtime-001"),
    "dashboard refresh should preserve queued session visibility after activation swaps the lease"
  );
  assert.equal(
    refreshedState.runtimeOrchestration.nextAction,
    "Runtime file says the next step is to resume Plan 1 from the fresh handover.",
    "dashboard refresh should resync runtime orchestration from the runtime state files"
  );
  assert.equal(
    refreshedState.runtimeOrchestration.nativeExecutorBridgeId,
    "codex-cli",
    "dashboard refresh should preserve native executor bridge context"
  );
  assert.equal(
    refreshedState.runtimeOrchestration.nativeExecutionStateFile,
    "docs/ai-harness/runtime/execution-bridges/session-runtime-002/codex-cli/native-execution-state.json",
    "dashboard refresh should resync native execution state from runtime files"
  );
  assert.ok(
    refreshedState.governanceState.requiredKpiIds.includes("session-governance-coverage"),
    "refresh should keep required KPI coverage aligned with the governance profile"
  );
  assert.ok(
    refreshedState.governanceState.requiredKpiIds.includes("contract-coverage"),
    "refresh should keep contract coverage aligned with the governance profile"
  );
  assert.ok(
    refreshedState.governedSessions.some((session) => session.id === "session-0001"),
    "refresh should preserve governed visibility for the bootstrap session"
  );
  assert.ok(
    refreshedState.governedSessions.some((session) => session.id === "session-auto-refresh"),
    "refresh should record dashboard synchronization as a governed session"
  );
  assert.ok(
    refreshedState.artifacts.some(
      (artifact) =>
        artifact.id === "runtime-adapter-handoff-session-runtime-002-codex-cli"
    ),
    "dashboard should retain adapter handoff visibility for external runtime continuation"
  );
  assert.ok(
    refreshedState.artifacts.some(
      (artifact) =>
        artifact.id === "runtime-execution-bridge-session-runtime-002-codex-cli"
    ),
    "dashboard should retain execution bridge visibility for launch bundle tracking"
  );
  assert.ok(
    refreshedState.artifacts.some(
      (artifact) =>
        artifact.id === "runtime-execution-receipt-session-runtime-002-codex-cli"
    ),
    "dashboard should retain execution receipt visibility for governed return flow"
  );
  assert.ok(
    refreshedState.kpis.some(
      (kpi) =>
        kpi.id === "session-governance-coverage" &&
        kpi.required === true &&
        Array.isArray(kpi.perspectives)
    ),
    "refresh should preserve required governance KPI metadata"
  );
  assert.ok(
    refreshedState.kpis.some(
      (kpi) =>
        kpi.id === "independent-evaluation-discipline" &&
        kpi.required === true
    ),
    "refresh should preserve independent evaluation discipline metadata"
  );
  assert.ok(
    fs.existsSync(path.join(exportDir, "index.html")),
    "static export should include index.html"
  );
  assert.ok(
    fs.existsSync(path.join(exportDir, "snapshot.html")),
    "static export should include standalone snapshot.html"
  );
  assert.ok(
    fs.existsSync(path.join(exportDir, "state", "dashboard-state.json")),
    "static export should include dashboard-state.json"
  );
  const semanticAudit = auditWorkspaceReadinessSemantics(fullWorkspace, true);
  assert.ok(
    semanticAudit.overallScore >= 60,
    "semantic audit should show the exercised workspace is at least operationally advancing"
  );
  assert.ok(
    ["advancing", "ready"].includes(semanticAudit.classification),
    "semantic audit should classify the exercised workspace above partial"
  );
  assert.equal(
    semanticAudit.reportPath,
    "docs/ai-harness/readiness/semantic-audit.json"
  );
  assert.ok(
    fs.existsSync(path.join(fullWorkspace, semanticAudit.reportPath)),
    "semantic audit should write a report when requested"
  );
  assert.match(semanticAudit.summary, /Workspace readiness semantic audit:/);
} finally {
  fs.rmSync(fullWorkspace, { recursive: true, force: true });
}

const closingWorkspace = fs.mkdtempSync(path.join(process.cwd(), "tmp-closed-runtime-"));
try {
  writeGeneratedFiles(closingWorkspace, collectFiles(createParams()));
  startHarnessSession({
    workspacePath: closingWorkspace,
    goal: "Close a governed session cleanly to verify idle runtime snapshots.",
    sessionId: "session-close-001",
    chunkId: "chunk-close-001",
    chunkTitle: "Closure verification slice",
  });
  completeHarnessSessionToClose(closingWorkspace);

  const idleActiveSnapshot = JSON.parse(
    fs.readFileSync(
      path.join(
        closingWorkspace,
        "docs",
        "ai-harness",
        "runtime",
        "state",
        "active-session.json"
      ),
      "utf-8"
    )
  );
  assert.equal(idleActiveSnapshot.activeSessionId, null);
  assert.equal(idleActiveSnapshot.leaseStatus, "idle");
  assert.equal(idleActiveSnapshot.queueDepth, 0);
  assert.deepEqual(idleActiveSnapshot.queuedSessionIds, []);

  const idleCurrentWorkPacket = JSON.parse(
    fs.readFileSync(
      path.join(
        closingWorkspace,
        "docs",
        "ai-harness",
        "runtime",
        "state",
        "current-work-packet.json"
      ),
      "utf-8"
    )
  );
  assert.equal(idleCurrentWorkPacket.activeSessionId, null);
  assert.equal(idleCurrentWorkPacket.leaseStatus, "idle");
  const idleCurrentExecutionBridge = JSON.parse(
    fs.readFileSync(
      path.join(
        closingWorkspace,
        "docs",
        "ai-harness",
        "runtime",
        "state",
        "current-execution-bridge.json"
      ),
      "utf-8"
    )
  );
  assert.equal(idleCurrentExecutionBridge.activeSessionId, null);
  assert.equal(idleCurrentExecutionBridge.bridgeId, null);

  const closingAudit = auditHarnessRuntime(closingWorkspace);
  assert.equal(
    closingAudit.valid,
    true,
    "runtime audit should still pass after the active lease returns to idle"
  );
} finally {
  fs.rmSync(closingWorkspace, { recursive: true, force: true });
}

const archiveWorkspace = fs.mkdtempSync(path.join(process.cwd(), "tmp-archive-runtime-"));
try {
  writeGeneratedFiles(archiveWorkspace, collectFiles(createParams()));
  for (const sessionSuffix of ["001", "002", "003"]) {
    startHarnessSession({
      workspacePath: archiveWorkspace,
      goal: `Close governed session ${sessionSuffix} so archive compaction can trim old ledgers.`,
      sessionId: `session-archive-${sessionSuffix}`,
      chunkId: `chunk-archive-${sessionSuffix}`,
      chunkTitle: `Archive slice ${sessionSuffix}`,
    });
    completeHarnessSessionToClose(archiveWorkspace);
  }

  const compaction = compactHarnessRuntime({
    workspacePath: archiveWorkspace,
    keepRecentClosed: 1,
    maxArchiveSessions: 5,
    reason: "Test compaction of old closed sessions.",
  });
  assert.equal(compaction.archivedSessionIds.length, 2);
  assert.ok(compaction.archiveBundlePath, "compaction should write an archive bundle");
  assert.ok(compaction.archiveSummaryPath, "compaction should write an archive summary");
  assert.ok(
    fs.existsSync(path.join(archiveWorkspace, compaction.archiveIndexPath)),
    "compaction should keep an archive index"
  );
  assert.ok(
    fs.existsSync(path.join(archiveWorkspace, compaction.archiveBundlePath)),
    "compaction should write the archive bundle file"
  );
  assert.ok(
    fs.existsSync(path.join(archiveWorkspace, compaction.archiveSummaryPath)),
    "compaction should write the archive summary markdown"
  );

  const compactedRuntimeIndex = JSON.parse(
    fs.readFileSync(
      path.join(
        archiveWorkspace,
        "docs",
        "ai-harness",
        "runtime",
        "state",
        "session-index.json"
      ),
      "utf-8"
    )
  );
  assert.equal(
    compactedRuntimeIndex.sessions.length,
    1,
    "compaction should leave only the newest closed session in the active runtime index"
  );
  assert.ok(
    compaction.archivedSessionIds.every((sessionId) =>
      fs.existsSync(
        path.join(
          archiveWorkspace,
          "docs",
          "ai-harness",
          "runtime",
          "archive",
          "sessions",
          `${sessionId}.session.json`
        )
      )
    ),
    "archived sessions should be moved into the runtime archive session store"
  );
  assert.ok(
    compaction.archivedSessionIds.every(
      (sessionId) =>
        !fs.existsSync(
          path.join(
            archiveWorkspace,
            "docs",
            "ai-harness",
            "runtime",
            "sessions",
            `${sessionId}.session.json`
          )
        )
    ),
    "archived session files should no longer remain in the active runtime session directory"
  );

  const compactedDashboardState = JSON.parse(
    fs.readFileSync(
      path.join(
        archiveWorkspace,
        "docs",
        "ai-harness",
        "dashboard",
        "state",
        "dashboard-state.json"
      ),
      "utf-8"
    )
  );
  assert.ok(
    compactedDashboardState.artifacts.some(
      (artifact) => artifact.id === "runtime-archive-index"
    ),
    "dashboard should keep the runtime archive index visible after compaction"
  );
  assert.ok(
    compactedDashboardState.artifacts.some(
      (artifact) => String(artifact.id || "").startsWith("runtime-archive-bundle-")
    ),
    "dashboard should expose the latest runtime archive bundle after compaction"
  );
  assert.equal(
    compactedDashboardState.governedSessions.filter(
      (session) => String(session.id || "").startsWith("session-archive-")
    ).length,
    1,
    "dashboard should retain only the non-archived closed archive test session in the main governed ledger"
  );
} finally {
  fs.rmSync(archiveWorkspace, { recursive: true, force: true });
}

const bareLegacyWorkspace = fs.mkdtempSync(path.join(process.cwd(), "tmp-bare-legacy-"));
try {
  fs.writeFileSync(
    path.join(bareLegacyWorkspace, "package.json"),
    JSON.stringify(
      {
        name: "legacy-service",
        description: "Legacy service that needs the latest governed AI harness.",
        dependencies: {
          express: "^4.0.0",
        },
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  fs.mkdirSync(path.join(bareLegacyWorkspace, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(bareLegacyWorkspace, "src", "server.js"),
    "console.log('legacy service');\n",
    "utf-8"
  );

  const bareReconcileDryRun = reconcileWorkspaceInitialization({
    workspacePath: bareLegacyWorkspace,
  });
  assert.equal(bareReconcileDryRun.applied, false);
  assert.match(bareReconcileDryRun.summary, /dry run complete/);
  assert.ok(
    !fs.existsSync(
      path.join(
        bareLegacyWorkspace,
        "docs",
        "ai-harness",
        "dashboard",
        "state",
        "dashboard-state.json"
      )
    ),
    "dry-run reconcile should not write managed files"
  );
  const bareReconcile = reconcileWorkspaceInitialization({
    workspacePath: bareLegacyWorkspace,
    applyChanges: true,
  });
  assert.match(bareReconcile.summary, /Workspace reconcile complete/);
  assert.equal(bareReconcile.resolvedConfig.workspaceName, "legacy-service");
  assert.equal(
    bareReconcile.resolvedConfig.purpose,
    "Legacy service that needs the latest governed AI harness."
  );
  assert.equal(bareReconcile.resolvedConfig.projectType, "api");
  assert.ok(
    fs.existsSync(
      path.join(
        bareLegacyWorkspace,
        "docs",
        "ai-harness",
        "dashboard",
        "state",
        "dashboard-state.json"
      )
    ),
    "reconcile should scaffold the latest dashboard for a bare legacy repo"
  );
  assert.ok(
    fs.existsSync(
      path.join(
        bareLegacyWorkspace,
        "docs",
        "ai-harness",
        "runtime",
        "adapter-contract.json"
      )
    ),
    "reconcile should scaffold the latest runtime adapter contract for a bare legacy repo"
  );
  const bareValidation = validateWorkspace(bareLegacyWorkspace);
  assert.equal(
    bareValidation.isInitialized,
    true,
    "bare legacy repo should validate after reconcile"
  );
} finally {
  fs.rmSync(bareLegacyWorkspace, { recursive: true, force: true });
}

const upgradedWorkspace = fs.mkdtempSync(path.join(process.cwd(), "tmp-upgraded-workspace-"));
try {
  writeGeneratedFiles(upgradedWorkspace, collectFiles(createParams()));
  fs.rmSync(
    path.join(
      upgradedWorkspace,
      "docs",
      "ai-harness",
      "runtime",
      "state",
      "current-native-execution.json"
    ),
    { force: true }
  );
  fs.rmSync(
    path.join(
      upgradedWorkspace,
      "docs",
      "ai-harness",
      "runtime",
      "native-executors"
    ),
    { recursive: true, force: true }
  );
  for (const compatibilityFile of [
    "version-index.json",
    "compatibility-matrix.json",
    "adapter-contract.json",
    "session-continuity.md",
  ]) {
    fs.rmSync(
      path.join(
        upgradedWorkspace,
        "docs",
        "ai-harness",
        "runtime",
        compatibilityFile
      ),
      { force: true }
    );
  }
  for (const compatibilityProfile of [
    ["adapters", "github-copilot.md"],
    ["bridges", "github-copilot.md"],
  ]) {
    fs.rmSync(
      path.join(
        upgradedWorkspace,
        "docs",
        "ai-harness",
        "runtime",
        compatibilityProfile[0],
        compatibilityProfile[1]
      ),
      { force: true }
    );
  }
  fs.rmSync(
    path.join(
      upgradedWorkspace,
      ".github",
      "ai-harness",
      "context-strategy.md"
    ),
    { force: true }
  );

  fs.mkdirSync(
    path.join(upgradedWorkspace, ".cursor", "skills", "legacy-custom-skill"),
    { recursive: true }
  );
  fs.writeFileSync(
    path.join(
      upgradedWorkspace,
      ".cursor",
      "skills",
      "legacy-custom-skill",
      "SKILL.md"
    ),
    "# Legacy Custom Skill\n\nLegacy instructions.\n",
    "utf-8"
  );
  fs.mkdirSync(path.join(upgradedWorkspace, ".agents", "agents"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(
      upgradedWorkspace,
      ".agents",
      "agents",
      "legacy-quality.agent.md"
    ),
    "# Legacy Quality Agent\n",
    "utf-8"
  );

  const legacyDashboardPath = path.join(
    upgradedWorkspace,
    "docs",
    "ai-harness",
    "dashboard",
    "state",
    "dashboard-state.json"
  );
  const legacyDashboardState = JSON.parse(
    fs.readFileSync(legacyDashboardPath, "utf-8")
  );
  legacyDashboardState.executiveSummary.headline = "Legacy mission control";
  delete legacyDashboardState.runtimeOrchestration.nativeExecutionStateFile;
  delete legacyDashboardState.runtimeOrchestration.nativeExecutionPlanFile;
  delete legacyDashboardState.runtimeOrchestration.nativeExecutorBridgeId;
  legacyDashboardState.artifacts = legacyDashboardState.artifacts.filter(
    (artifact) =>
      ![
        "runtime-version-index",
        "runtime-compatibility-matrix",
        "runtime-adapter-contract",
        "runtime-session-continuity",
        "runtime-native-executors-guide",
        "runtime-current-native-execution",
      ].includes(String(artifact.id || ""))
  );
  fs.writeFileSync(
    legacyDashboardPath,
    JSON.stringify(legacyDashboardState, null, 2) + "\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(
      upgradedWorkspace,
      ".github",
      "ai-harness",
      "operating-model.md"
    ),
    "Customized operating model that should stay in manual review.\n",
    "utf-8"
  );

  const upgradeRiskAudit = auditWorkspaceUpgradeRisk(upgradedWorkspace);
  assert.equal(upgradeRiskAudit.inventoryStatus, "present");
  assert.ok(
    ["moderate", "high"].includes(upgradeRiskAudit.riskLevel),
    "upgrade risk audit should escalate when managed files were customized"
  );
  assert.ok(
    upgradeRiskAudit.modifiedManagedFiles.includes(
      ".github/ai-harness/operating-model.md"
    ),
    "upgrade risk audit should flag customized managed files before reconcile"
  );
  assert.equal(
    upgradeRiskAudit.recommendedReconcileFlags.requireZeroManualReviewItemsForApply,
    true,
    "upgrade risk audit should recommend the strict manual-review gate when customized managed files are present"
  );
  const semanticDiff = auditWorkspaceManagedSemanticDiff(
    upgradedWorkspace,
    true
  );
  assert.equal(semanticDiff.inventoryStatus, "present");
  assert.ok(
    semanticDiff.reportJsonPath,
    "managed semantic diff should be able to write a durable report"
  );
  assert.ok(
    fs.existsSync(path.join(upgradedWorkspace, semanticDiff.reportJsonPath)),
    "managed semantic diff report JSON should be persisted"
  );
  assert.ok(
    semanticDiff.entries.some(
      (entry) =>
        entry.path === ".github/ai-harness/operating-model.md" &&
        entry.status === "customized"
    ),
    "managed semantic diff should classify customized replace-managed files"
  );
  assert.ok(
    semanticDiff.entries.some(
      (entry) =>
        entry.path === "docs/ai-harness/runtime/state/current-native-execution.json" &&
        entry.status === "missing"
    ),
    "managed semantic diff should classify missing managed files"
  );
  assert.ok(
    semanticDiff.entries.some(
      (entry) =>
        entry.path === "docs/ai-harness/runtime/adapter-contract.json" &&
        entry.status === "missing"
    ),
    "managed semantic diff should classify missing 4.1.2 compatibility contract files"
  );
  assert.ok(
    semanticDiff.entries.some(
      (entry) =>
        entry.path === "docs/ai-harness/runtime/adapters/github-copilot.md" &&
        entry.status === "missing"
    ),
    "managed semantic diff should classify missing Copilot adapter files"
  );
  const preflightReport = exportReconcilePreflightReport(upgradedWorkspace);
  assert.ok(
    fs.existsSync(path.join(upgradedWorkspace, preflightReport.reportHtmlPath)),
    "reconcile preflight export should write a shareable HTML report"
  );
  assert.match(
    fs.readFileSync(path.join(upgradedWorkspace, preflightReport.reportHtmlPath), "utf-8"),
    /Reconcile Preflight Report/
  );
  assert.match(
    fs.readFileSync(path.join(upgradedWorkspace, preflightReport.reportHtmlPath), "utf-8"),
    /AI Harness Upgrade Preflight/
  );
  assert.match(
    fs.readFileSync(path.join(upgradedWorkspace, preflightReport.reportHtmlPath), "utf-8"),
    /dashboard-grid/
  );
  assert.match(
    fs.readFileSync(path.join(upgradedWorkspace, preflightReport.reportHtmlPath), "utf-8"),
    /Dry-Run Reconcile Plan/
  );
  assert.ok(
    preflightReport.dryRunPlan.manualReviewFiles.includes(
      ".github/ai-harness/operating-model.md"
    ),
    "reconcile preflight export should include dry-run manual-review items"
  );

  const dryRunReconcile = reconcileWorkspaceInitialization({
    workspacePath: upgradedWorkspace,
  });
  assert.equal(dryRunReconcile.applied, false);
  assert.ok(
    dryRunReconcile.modifiedManagedFiles.includes(
      ".github/ai-harness/operating-model.md"
    ),
    "dry-run reconcile should surface customized managed files from the inventory"
  );
  assert.ok(
    dryRunReconcile.reportJsonPath === null,
    "dry-run reconcile should not create a migration report unless explicitly requested"
  );
  assert.equal(
    dryRunReconcile.semanticDiffTotals.customized >= 1,
    true,
    "dry-run reconcile should surface semantic diff totals for managed customizations"
  );
  const policyHeldReconcile = reconcileWorkspaceInitialization({
    workspacePath: upgradedWorkspace,
    overwriteModifiedManagedFiles: true,
  });
  assert.ok(
    policyHeldReconcile.manualReviewFiles.includes(
      ".github/ai-harness/operating-model.md"
    ),
    "file-level reconcile policy should still hold protected files for manual review even when modified managed overwrites are otherwise allowed"
  );

  const migrationsDir = path.join(upgradedWorkspace, "docs", "ai-harness", "migrations");
  const semanticDiffReportCountBeforeStrictApply = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith("managed-semantic-diff-")
    ).length;
  assert.throws(
    () =>
      reconcileWorkspaceInitialization({
        workspacePath: upgradedWorkspace,
        applyChanges: true,
        requireZeroManualReviewItemsForApply: true,
      }),
    /manual review items are still present/i,
    "strict reconcile apply should block writes while manual-review items remain"
  );
  assert.equal(
    fs.existsSync(
      path.join(
        upgradedWorkspace,
        "docs",
        "ai-harness",
        "runtime",
        "state",
        "current-native-execution.json"
      )
    ),
    false,
    "strict reconcile apply should not write missing files before the manual-review gate is cleared"
  );
  assert.equal(
    fs.existsSync(
      path.join(
        upgradedWorkspace,
        "docs",
        "ai-harness",
        "runtime",
        "adapter-contract.json"
      )
    ),
    false,
    "strict reconcile apply should not write missing compatibility files before the manual-review gate is cleared"
  );
  const semanticDiffReportCountAfterStrictApply = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith("managed-semantic-diff-")
    ).length;
  assert.equal(
    semanticDiffReportCountAfterStrictApply,
    semanticDiffReportCountBeforeStrictApply,
    "strict reconcile apply should not write semantic diff reports before the manual-review gate is cleared"
  );

  const reconcileResult = reconcileWorkspaceInitialization({
    workspacePath: upgradedWorkspace,
    applyChanges: true,
  });
  assert.equal(reconcileResult.applied, true);
  assert.ok(
    reconcileResult.writtenFiles.includes(
      "docs/ai-harness/runtime/state/current-native-execution.json"
    ),
    "reconcile should restore missing runtime state files"
  );
  assert.ok(
    reconcileResult.writtenFiles.includes(
      "docs/ai-harness/runtime/adapter-contract.json"
    ),
    "reconcile should restore missing 4.1.2 adapter contract files"
  );
  assert.ok(
    reconcileResult.writtenFiles.includes(
      "docs/ai-harness/runtime/adapters/github-copilot.md"
    ),
    "reconcile should restore missing Copilot adapter files"
  );
  assert.ok(
    reconcileResult.importedLegacyResources.some((entry) =>
      entry.includes(".github/skills/legacy-custom-skill/")
    ),
    "reconcile should import legacy skill resources into the canonical registry"
  );
  assert.ok(
    reconcileResult.importedLegacyResources.some((entry) =>
      entry.includes(".github/agents/legacy-quality.agent.md")
    ),
    "reconcile should import legacy agent resources into the canonical registry"
  );
  assert.ok(
    reconcileResult.reportJsonPath,
    "reconcile should write a durable migration report by default"
  );
  assert.ok(
    reconcileResult.semanticDiffReportJsonPath,
    "reconcile apply should also persist semantic diff evidence by default"
  );
  assert.ok(
    fs.existsSync(
      path.join(upgradedWorkspace, reconcileResult.semanticDiffReportJsonPath)
    ),
    "reconcile should persist the managed semantic diff report JSON"
  );
  assert.ok(
    fs.existsSync(path.join(upgradedWorkspace, reconcileResult.reportJsonPath)),
    "reconcile should persist the migration report JSON"
  );
  assert.ok(
    fs.existsSync(
      path.join(
        upgradedWorkspace,
        "docs",
        "ai-harness",
        "migrations",
        "latest-reconcile-report.md"
      )
    ),
    "reconcile should keep a latest migration report pointer"
  );
  assert.ok(
    reconcileResult.archivedFiles.some((entry) =>
      entry.endsWith(
        "docs/ai-harness/dashboard/state/dashboard-state.json"
      )
    ),
    "reconcile should back up replaced managed files so restore remains possible"
  );
  const upgradedDashboardState = JSON.parse(
    fs.readFileSync(legacyDashboardPath, "utf-8")
  );
  assert.equal(
    upgradedDashboardState.executiveSummary.headline,
    "Legacy mission control",
    "reconcile should preserve existing dashboard truth while adding new fields"
  );
  assert.equal(
    fs.readFileSync(
      path.join(
        upgradedWorkspace,
        ".github",
        "ai-harness",
        "operating-model.md"
      ),
      "utf-8"
    ),
    "Customized operating model that should stay in manual review.\n",
    "reconcile should keep customized managed files untouched unless explicitly allowed"
  );
  assert.equal(
    upgradedDashboardState.runtimeOrchestration.nativeExecutionStateFile,
    "docs/ai-harness/runtime/state/current-native-execution.json"
  );
  assert.ok(
    upgradedDashboardState.artifacts.some(
      (artifact) => artifact.id === "runtime-native-executors-guide"
    ),
    "reconcile should restore missing dashboard artifacts"
  );
  assert.ok(
    upgradedDashboardState.artifacts.some(
      (artifact) => artifact.id === "runtime-adapter-contract"
    ),
    "reconcile should restore missing compatibility dashboard artifacts"
  );
  assert.ok(
    fs.existsSync(
      path.join(
        upgradedWorkspace,
        ".github",
        "skills",
        "legacy-custom-skill",
        "SKILL.md"
      )
    ),
    "reconcile should preserve legacy custom skill content in the canonical skill root"
  );
  assert.ok(
    fs.existsSync(
      path.join(
        upgradedWorkspace,
        ".github",
        "agents",
        "legacy-quality.agent.md"
      )
    ),
    "reconcile should preserve legacy custom agent content in the canonical agent root"
  );
  const upgradedValidation = validateWorkspace(upgradedWorkspace);
  assert.equal(
    upgradedValidation.isInitialized,
    true,
    "older initialized workspace should validate after reconcile"
  );
  upgradedDashboardState.executiveSummary.headline = "Mutated after reconcile";
  fs.writeFileSync(
    legacyDashboardPath,
    JSON.stringify(upgradedDashboardState, null, 2) + "\n",
    "utf-8"
  );
  const restoreResult = restoreReconcileBackup(
    upgradedWorkspace,
    reconcileResult.reportJsonPath ?? undefined
  );
  assert.ok(
    restoreResult.restoredFiles.includes(
      "docs/ai-harness/dashboard/state/dashboard-state.json"
    ),
    "restore should bring back archived managed files from the reconcile report"
  );
  const restoredDashboardState = JSON.parse(
    fs.readFileSync(legacyDashboardPath, "utf-8")
  );
  assert.equal(
    restoredDashboardState.executiveSummary.headline,
    "Legacy mission control",
    "restore should replace the mutated dashboard file with the archived backup"
  );
  const maliciousReportPath = path.join(
    upgradedWorkspace,
    "docs",
    "ai-harness",
    "migrations",
    "malicious-reconcile-report.json"
  );
  fs.writeFileSync(
    maliciousReportPath,
    JSON.stringify(
      {
        backupFiles: [
          {
            originalPath: ".github/ai-harness/context-strategy.md",
            backupPath: "../outside-workspace/context-strategy.md",
          },
        ],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  assert.throws(
    () =>
      restoreReconcileBackup(
        upgradedWorkspace,
        "docs/ai-harness/migrations/malicious-reconcile-report.json"
      ),
    /escapes the workspace/,
    "restore should refuse backup paths that escape the workspace root"
  );
} finally {
  fs.rmSync(upgradedWorkspace, { recursive: true, force: true });
}

const legacyRecommendations = recommendAgentSkills({
  projectType: "consulting",
  techStack: ["Java", "Spring", "MyBatis", "Oracle"],
  userIntent: "legacy enterprise endpoint tracing localization message resource sql review",
  maxAgents: 20,
  maxSkills: 20,
});

assert.ok(
  legacyRecommendations.skills.some((skill) => skill.id === "service-endpoint-tracer"),
  "service endpoint tracer should be recommended for legacy tracing work"
);
assert.ok(
  legacyRecommendations.skills.some((skill) => skill.id === "message-resource-lookup"),
  "message resource lookup should be recommended for localization work"
);
assert.ok(
  legacyRecommendations.skills.some((skill) => skill.id === "legacy-sql-review"),
  "legacy SQL review should be recommended for enterprise SQL work"
);
assert.ok(
  legacyRecommendations.agents.some((agent) => agent.id === "legacy-enterprise-analysis"),
  "legacy enterprise analysis should be recommended for legacy consulting work"
);
assert.ok(
  legacyRecommendations.agents.some((agent) => agent.id === "risk-focused-code-review"),
  "risk-focused code review should be recommended for review-heavy work"
);
