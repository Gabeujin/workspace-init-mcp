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

const { collectFiles } = initModule;
const { validateWorkspace } = validateModule;
const { generateSelectedSkills } = generatorModule;
const { resolveWorkspaceTargetIDEs } = installModule;
const {
  startHarnessSession,
  advanceHarnessSession,
  getHarnessSessionStatus,
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

for (const skillId of [
  "harness-governance-manager",
  "harness-documentation-records",
  "harness-dashboard-state-manager",
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

const runtimeReadme = byPath.get("docs/ai-harness/runtime/README.md");
assert.ok(runtimeReadme, "runtime orchestrator README not generated");
assert.match(runtimeReadme, /start_harness_session/);

const runtimeStateMachine = byPath.get("docs/ai-harness/runtime/state-machine.md");
assert.ok(runtimeStateMachine, "runtime state machine not generated");
assert.match(runtimeStateMachine, /contract-review/);
assert.match(runtimeStateMachine, /context_reset/);

const runtimeSessionIndex = byPath.get("docs/ai-harness/runtime/state/session-index.json");
assert.ok(runtimeSessionIndex, "runtime session index not generated");
assert.equal(JSON.parse(runtimeSessionIndex).activeSessionId, null);

const runtimeActiveSession = byPath.get("docs/ai-harness/runtime/state/active-session.json");
assert.ok(runtimeActiveSession, "runtime active session template not generated");
assert.equal(JSON.parse(runtimeActiveSession).status, "idle");

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
assert.equal(
  parsedDashboardState.runtimeOrchestration.currentPhase,
  "awaiting-session-start",
  "dashboard should expose runtime orchestration state before the first session starts"
);
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

  const sessionStatus = getHarnessSessionStatus(fullWorkspace);
  assert.match(sessionStatus.summary, /Current phase: plan-1/);
  assert.match(sessionStatus.summary, /Next actor: planner/);

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

  const validation = validateWorkspace(fullWorkspace);
  assert.equal(validation.isInitialized, true, "generated workspace should validate as initialized");
  assert.equal(
    validation.completeness,
    100,
    "generated workspace should include the full expected baseline"
  );

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
    "session-runtime-001",
    "dashboard refresh should preserve runtime orchestration state"
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
} finally {
  fs.rmSync(fullWorkspace, { recursive: true, force: true });
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
