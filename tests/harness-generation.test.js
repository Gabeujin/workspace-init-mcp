import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
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
const semanticGovernanceModule = await import("../dist/tools/semantic-governance.js");
const semanticWarehouseModule = await import("../dist/tools/semantic-warehouse.js");
const semanticWaiversModule = await import("../dist/tools/semantic-waivers.js");
const semanticEnforcementModule = await import("../dist/tools/semantic-enforcement.js");
const semanticPolicyPacksModule = await import("../dist/tools/semantic-policy-packs.js");
const safeWorkspaceWriteModule = await import("../dist/tools/safe-workspace-write.js");
const governanceApprovalModule = await import("../dist/tools/governance-approval.js");

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
const {
  scanSourceGraph,
  validateSemanticGovernance,
  buildSemanticContextPack,
} = semanticGovernanceModule;
const {
  buildSemanticWarehouse,
  querySemanticWarehouse,
} = semanticWarehouseModule;
const {
  buildWaiverApprovalEvidenceDigest,
  buildWaiverApprovalPayload,
  buildWaiverRevocationPayload,
  validateArchitectureWaivers,
} = semanticWaiversModule;
const { runSemanticEnforcement } = semanticEnforcementModule;
const {
  buildPolicyPackApprovalPayload,
  exportArchitecturePolicyPack,
  importArchitecturePolicyPack,
} = semanticPolicyPacksModule;
const { writeContainedTextAtomic } = safeWorkspaceWriteModule;
const { stableSerialize } = governanceApprovalModule;
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
const CURRENT_VERSION = packageJson.version;
const EXPECTED_USER_REALITY_PROGRESS_STAGES = [
  "reality",
  "risks",
  "next-actions",
  "proof-progress",
  "local-api",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

{
  const root = createWorkspace();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-init-mcp-outside-"));
  const linked = path.join(root, "linked-outside");
  let symlinkCreated = false;
  try {
    fs.symlinkSync(outside, linked, "junction");
    symlinkCreated = true;
  } catch {
    symlinkCreated = false;
  }

  if (symlinkCreated) {
    assert.throws(
      () =>
        writeContainedTextAtomic(
          root,
          path.join(linked, "escape.txt"),
          "must not escape\n",
          "utf-8"
        ),
      /symbolic link directory|escaped workspace/
    );
    assert.equal(fs.existsSync(path.join(outside, "escape.txt")), false);
  }
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

function fileSha256(fullPath) {
  return createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
}

function createGovernanceTrust(root, reviewerId = "principal-architect") {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  fs.mkdirSync(path.join(root, ".github", "ai-harness"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".github", "ai-harness", "governance-trust.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        reviewers: [
          {
            id: reviewerId,
            status: "active",
            publicKeyPem,
          },
        ],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  fs.mkdirSync(path.join(root, "docs", "ai-harness", "ontology", "state"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "docs", "ai-harness", "ontology", "state", "waiver-revocations.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        policy: "Signed revocation receipts override active waiver approvals.",
        revocations: [],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  return { reviewerId, privateKey };
}

function signGovernancePayload(privateKey, payload) {
  return `ed25519:${sign(
    null,
    Buffer.from(stableSerialize(payload), "utf-8"),
    privateKey
  ).toString("base64")}`;
}

function runGit(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf-8",
    windowsHide: true,
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

function signedWaiver(root, trust, waiver) {
  const approvalReady = {
    ...waiver,
    approvedBy: trust.reviewerId,
    approvalSignature: "",
  };
  const evidenceDigest = buildWaiverApprovalEvidenceDigest(root, approvalReady);
  assert.deepEqual(evidenceDigest.errors, []);
  return {
    ...approvalReady,
    approvalSignature: signGovernancePayload(
      trust.privateKey,
      buildWaiverApprovalPayload(approvalReady, evidenceDigest)
    ),
  };
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
    let buffer = "";
    const timer = setTimeout(() => {
      request.destroy();
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    request.on("response", (response) => {
      response.setEncoding("utf-8");
      response.on("data", (chunk) => {
        buffer += String(chunk);
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const text of parts) {
          if (text.includes(`event: ${eventName}`)) {
            clearTimeout(timer);
            request.destroy();
            resolve(text);
            return;
          }
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
    ".github/ai-harness/architecture-ontology.policy.json",
    "docs/ai-harness/ontology/README.md",
    "docs/ai-harness/ontology/policy-authoring.md",
    "docs/ai-harness/ontology/prompt-templates/semantic-context-pack.md",
    "docs/ai-harness/ontology/policy-packs/README.md",
    "docs/ai-harness/ontology/architecture-profiles.catalog.json",
    "docs/ai-harness/ontology/schemas/architecture-ontology.schema.json",
    "docs/ai-harness/ontology/schemas/source-graph.schema.json",
    "docs/ai-harness/ontology/schemas/governance-evaluation.schema.json",
    "docs/ai-harness/ontology/schemas/bypass-ledger.schema.json",
    "docs/ai-harness/ontology/schemas/semantic-warehouse.schema.json",
    "docs/ai-harness/ontology/schemas/waiver-validation.schema.json",
    "docs/ai-harness/ontology/schemas/enforcement-report.schema.json",
    "docs/ai-harness/ontology/schemas/policy-pack.schema.json",
    "docs/ai-harness/ontology/state/source-graph.json",
    "docs/ai-harness/ontology/state/governance-evaluation.json",
    "docs/ai-harness/ontology/state/semantic-warehouse.json",
    "docs/ai-harness/ontology/state/waiver-validation.json",
    "docs/ai-harness/ontology/state/enforcement-report.json",
    "docs/ai-harness/ontology/state/enforcement-report.md",
    "docs/ai-harness/ontology/policy-packs/import-review.example.json",
    "docs/ai-harness/ontology/state/bypass-ledger.json",
    "docs/ai-harness/ontology/state/context-pack.example.json",
  ]) {
    assert.ok(byPath.has(requiredPath), `${requiredPath} should be generated`);
  }

  const state = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const architectureProfileCatalog = JSON.parse(
    byPath.get("docs/ai-harness/ontology/architecture-profiles.catalog.json").content
  );
  assert.ok(architectureProfileCatalog.profiles.some((profile) => profile.profileId === "clean"));
  assert.ok(architectureProfileCatalog.profiles.some((profile) => profile.profileId === "hexagonal"));
  assert.ok(architectureProfileCatalog.profiles.some((profile) => profile.profileId === "ddd"));
  assert.ok(architectureProfileCatalog.profiles.some((profile) => profile.profileId === "event-driven"));
  assert.match(byPath.get("docs/ai-harness/ontology/policy-authoring.md").content, /Source comments may reference waiver ids only/);
  assert.match(byPath.get("docs/ai-harness/ontology/prompt-templates/semantic-context-pack.md").content, /Authority order/);
  assert.match(byPath.get("docs/ai-harness/ontology/policy-packs/README.md").content, /No automatic central upload/);
  assert.match(byPath.get("docs/ai-harness/ontology/state/enforcement-report.md").content, /CI\/PR-ready report/);
  const enforcementReport = JSON.parse(byPath.get("docs/ai-harness/ontology/state/enforcement-report.json").content);
  assert.equal(enforcementReport.optInOnly, true);
  assert.equal(enforcementReport.gate, "disabled");
  const policyPackSchema = JSON.parse(byPath.get("docs/ai-harness/ontology/schemas/policy-pack.schema.json").content);
  assert.ok(policyPackSchema.required.includes("trust"));
  const policyPackReview = JSON.parse(byPath.get("docs/ai-harness/ontology/policy-packs/import-review.example.json").content);
  assert.equal(policyPackReview.applied, false);
  const dashboardStateSchema = JSON.parse(
    byPath.get("docs/ai-harness/dashboard/state/dashboard-state.schema.json").content
  );
  assert.ok(dashboardStateSchema.properties.claimEvidenceMatrix.properties.missingEvidenceItems);
  assert.ok(dashboardStateSchema.properties.dashboardQualityScorecard.properties.qaEvidence);
  assert.ok(dashboardStateSchema.properties.dashboardQualityScorecard.properties.modernWebUiPolicy);
  assert.ok(dashboardStateSchema.properties.projectionConfidence.properties.requiredActions);
  assert.ok(dashboardStateSchema.properties.sessionTraceability.properties.entries);
  assert.ok(dashboardStateSchema.properties.sessionTraceability.properties.entries.items.properties.traceSource);
  assert.ok(dashboardStateSchema.properties.sessionTraceability.properties.entries.items.properties.traceDebt);
  assert.ok(dashboardStateSchema.properties.sessionTraceability.properties.entries.items.properties.traceConfidence);
  assert.ok(dashboardStateSchema.properties.dashboardQualityScorecard.properties.userPerspectiveAudit);
  assert.ok(dashboardStateSchema.properties.userRealityCheck.properties.actionPlan);
  assert.ok(dashboardStateSchema.properties.userRealityCheck.properties.nextActionRunway);
  assert.ok(dashboardStateSchema.properties.userRealityCheck.properties.listenerTrustCard);
  assert.ok(dashboardStateSchema.properties.userRealityCheck.properties.trustReadinessBrief);
  assert.ok(dashboardStateSchema.properties.userRealityCheck.properties.trustReadinessBrief.properties.questions);
  assert.ok(dashboardStateSchema.properties.userRealityCheck.properties.trustReadinessBrief.properties.scoreDimensions);
  assert.ok(dashboardStateSchema.properties.userRealityCheck.properties.trustReadinessBrief.properties.evidenceChecks);
  assert.ok(dashboardStateSchema.properties.userRealityCheck.properties.trustReadinessBrief.properties.routeContracts);
  assert.ok(dashboardStateSchema.properties.userRealityCheck.properties.progressFlow);
  assert.ok(dashboardStateSchema.properties.semanticGovernance.properties.visualGraph);
  assert.ok(dashboardStateSchema.properties.semanticGovernance.properties.commands);
  assert.ok(dashboardStateSchema.properties.semanticGovernance.required.includes("semanticWarehouse"));
  assert.ok(dashboardStateSchema.properties.semanticGovernance.required.includes("waiverGovernance"));
  assert.ok(dashboardStateSchema.properties.semanticGovernance.required.includes("enforcement"));
  assert.ok(dashboardStateSchema.properties.agentCommandBridge.properties.sseFeedbackLoop);
  assert.ok(dashboardStateSchema.properties.agentCommandBridge.properties.suggestedCommands);
  assert.ok(dashboardStateSchema.properties.agentCommandBridge.required.includes("commandPacketSchema"));
  assert.ok(dashboardStateSchema.properties.agentCommandBridge.required.includes("dashboardDoesNotRunTools"));
  for (const key of DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS) {
    assert.ok(key in state, `dashboard-state.json should include ${key}`);
  }
  assert.equal(state.meta.schemaVersion, CURRENT_VERSION);
  assert.ok(state.semanticGovernance);
  assert.equal(state.semanticGovernance.schemaVersion, CURRENT_VERSION);
  assert.ok(state.semanticGovernance.profileId);
  assert.ok(state.semanticGovernance.visualGraph.nodes.length > 0);
  assert.ok(state.semanticGovernance.visualGraph.edges.length > 0);
  assert.ok(state.semanticGovernance.apiRoutes.includes("/api/harness-dashboard/v1/query?scope=architecture&q=governance"));
  assert.ok(state.semanticGovernance.apiRoutes.includes("/api/harness-dashboard/v1/architecture"));
  assert.ok(state.agentCommandBridge);
  assert.equal(state.agentCommandBridge.status, "draft-only-read-only");
  assert.equal(state.agentCommandBridge.executionMode, "draft-only");
  assert.equal(state.agentCommandBridge.dashboardDoesNotRunTools, true);
  assert.equal(state.agentCommandBridge.requiresAgentExecution, true);
  assert.match(state.agentCommandBridge.policy, /never runs tools/);
  assert.ok(state.agentCommandBridge.suggestedCommands.length >= 3);
  assert.ok(state.agentCommandBridge.suggestedCommands.every((item) => /^Draft request:/.test(item.label)));
  assert.match(state.agentCommandBridge.sseFeedbackLoop.expectedLatency, /immediate/);
  assert.equal(state.projectWorldModel.mission.statement, params.purpose);
  const legacyShape = JSON.parse(JSON.stringify(state));
  delete legacyShape.projectionConfidence;
  delete legacyShape.sessionTraceability;
  delete legacyShape.userRealityCheck;
  delete legacyShape.semanticGovernance;
  delete legacyShape.agentCommandBridge;
  const legacyShapeValidation = validateDashboardStateShape(legacyShape);
  assert.equal(legacyShapeValidation.valid, true, legacyShapeValidation.errors.join("\n"));
  assert.equal(legacyShape.projectionConfidence.status, "projection-debt");
  assert.equal(legacyShape.semanticGovernance.status, "legacy-backfill-pending-scan");
  assert.equal(legacyShape.semanticGovernance.gate.canProceed, false);
  assert.equal(legacyShape.agentCommandBridge.executionMode, "draft-only");
  assert.equal(legacyShape.agentCommandBridge.dashboardDoesNotRunTools, true);
  assert.equal(legacyShape.sessionTraceability.status, "trace-debt");
  assert.equal(legacyShape.sessionTraceability.entries[0].traceIntegrity.status, "complete");
  assert.equal(legacyShape.sessionTraceability.entries[0].traceSource, "recorded-event");
  assert.equal(legacyShape.sessionTraceability.entries[0].traceDebt, false);
  assert.equal(legacyShape.sessionTraceability.entries[0].traceConfidence, "high");
  assert.ok(legacyShape.dashboardQualityScorecard.userPerspectiveAudit);
  assert.equal(legacyShape.dashboardQualityScorecard.userPerspectiveAudit.currentSupportScore <= 10, true);
  assert.equal(legacyShape.userRealityCheck.status, "legacy-backfill-action-plan");
  assert.ok(legacyShape.userRealityCheck.actionPlan[0].apiRoutes.includes("/api/harness-dashboard/v1/reality-check"));
  assert.equal(legacyShape.userRealityCheck.nextActionRunway[0].proofRoute, "/api/harness-dashboard/v1/reality-check");
  assert.equal(legacyShape.userRealityCheck.listenerTrustCard.healthRoute, "/api/harness-dashboard/v1/health");
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
  assert.equal(state.sessionTraceability.traceDebtCount, 0);
  assert.equal(state.sessionTraceability.trustedTraceCount, 1);
  assert.equal(state.sessionTraceability.entries[0].originalRequest, params.purpose);
  assert.match(state.sessionTraceability.entries[0].processSummary, /generated the Project World Model ledger/);
  assert.match(state.sessionTraceability.entries[0].resultSummary, /real VCS, service, owner, release, and operations evidence/);
  assert.equal(state.sessionTraceability.entries[0].traceIntegrity.status, "complete");
  assert.equal(state.sessionTraceability.entries[0].traceSource, "recorded-event");
  assert.equal(state.sessionTraceability.entries[0].traceDebt, false);
  assert.equal(state.sessionTraceability.entries[0].traceConfidence, "high");
  assert.ok(state.sessionTraceability.entries[0].evidenceRefs.includes("docs/ai-harness/dashboard/index.html"));
  assert.equal(state.userRealityCheck.status, "bootstrap-action-plan");
  assert.equal(state.userRealityCheck.summary.readableWithoutRawJson, true);
  assert.ok(state.userRealityCheck.trustReadinessBrief);
  assert.ok(state.userRealityCheck.trustReadinessBrief.section);
  assert.equal(typeof state.userRealityCheck.trustReadinessBrief.score?.value, "number");
  assert.equal(state.userRealityCheck.trustReadinessBrief.score.status, "orientation-confidence-not-release-readiness");
  assert.match(state.userRealityCheck.trustReadinessBrief.score.rationale, /not release, deployment, or operations readiness/);
  assert.match(state.userRealityCheck.trustReadinessBrief.scorePolicy, /Auditable average/);
  assert.equal(state.userRealityCheck.trustReadinessBrief.score.max >= state.userRealityCheck.trustReadinessBrief.score.value, true);
  assert.equal(Array.isArray(state.userRealityCheck.trustReadinessBrief.scoreDimensions), true);
  assert.equal(state.userRealityCheck.trustReadinessBrief.scoreDimensions.length >= 5, true);
  assert.ok(state.userRealityCheck.trustReadinessBrief.scoreDimensions.every((item) =>
    item.id &&
    item.label &&
    Number.isFinite(item.score) &&
    item.currentFinding &&
    Array.isArray(item.passCriteria) &&
    item.passCriteria.length > 0 &&
    Array.isArray(item.evidenceRefs) &&
    item.evidenceRefs.length > 0 &&
    Array.isArray(item.apiRouteChips) &&
    item.apiRouteChips.length > 0 &&
    item.nextAction
  ));
  assert.ok(state.userRealityCheck.trustReadinessBrief.scoreDimensions.some((item) => item.id === "local-api-usefulness"));
  assert.ok(state.userRealityCheck.trustReadinessBrief.evidenceChecks);
  assert.ok(state.userRealityCheck.trustReadinessBrief.evidenceChecks.resolvableRefs.includes("event-000001-bootstrap"));
  assert.ok(state.userRealityCheck.trustReadinessBrief.evidenceChecks.lookupRoutes.some((item) => item.includes("event-000001-bootstrap")));
  assert.ok(state.userRealityCheck.trustReadinessBrief.evidenceChecks.conceptualRefs.includes("projectionConfidence"));
  assert.ok(state.userRealityCheck.trustReadinessBrief.evidenceChecks.unresolvedRefs.includes("missing.service-health"));
  assert.ok(state.userRealityCheck.trustReadinessBrief.evidenceChecks.unresolvedItems.some((item) =>
    item.id === "missing.service-health" &&
    item.label &&
    item.requiredEvidenceType &&
    item.nextAction &&
    Array.isArray(item.apiRouteChips)
  ));
  assert.ok(state.claimEvidenceMatrix.missingEvidenceItems.some((item) => item.id === "missing.operations-telemetry"));
  assert.ok(state.claimEvidenceMatrix.missingEvidenceItems.some((item) => item.id === "missing.stakeholder-approval"));
  assert.ok(Array.isArray(state.userRealityCheck.trustReadinessBrief.routeContracts));
  assert.ok(state.userRealityCheck.trustReadinessBrief.routeContracts.some((item) =>
    item.route === "/api/harness-dashboard/v1/reality-check" &&
    item.expectedPayloadKeys.includes("userRealityCheck")
  ));
  assert.ok(state.userRealityCheck.trustReadinessBrief.routeContracts.some((item) =>
    item.route === "/api/harness-dashboard/v1/architecture" &&
    item.expectedPayloadKeys.includes("semanticGovernance") &&
    item.expectedPayloadKeys.includes("agentCommandBridge")
  ));
  assert.ok(state.userRealityCheck.trustReadinessBrief.routeContracts.some((item) =>
    item.route === "/api/harness-dashboard/v1/agent-bridge" &&
    item.expectedPayloadKeys.includes("agentCommandBridge") &&
    item.expectedPayloadKeys.includes("agentResumeBrief")
  ));
  assert.equal(Array.isArray(state.userRealityCheck.trustReadinessBrief.questions), true);
  assert.equal(state.userRealityCheck.trustReadinessBrief.questions.length >= 5, true);
  assert.ok(state.userRealityCheck.trustReadinessBrief.questions.every((item) =>
    item.question &&
    item.answer &&
    item.decision &&
    Array.isArray(item.dimensionIds) &&
    item.dimensionIds.length > 0 &&
    Array.isArray(item.evidenceRefs) &&
    item.evidenceRefs.length > 0 &&
    Array.isArray(item.unresolvedEvidenceRefs) &&
    Array.isArray(item.unresolvedEvidenceItems)
  ));
  assert.ok(state.userRealityCheck.trustReadinessBrief.questions.some((item) => Array.isArray(item.commands) && item.commands.length > 0));
  assert.ok(state.userRealityCheck.trustReadinessBrief.questions.some((item) => Number.isFinite(item.confidenceScore)));
  assert.ok(state.userRealityCheck.trustReadinessBrief.questions.some((item) => /How can the listener/.test(item.question)));
  assert.equal(typeof state.userRealityCheck.trustReadinessBrief.commands?.length, "number");
  assert.ok(state.userRealityCheck.trustReadinessBrief.commands.length > 0);
  assert.ok(state.userRealityCheck.trustReadinessBrief.apiRouteChips.includes("/api/harness-dashboard/v1/reality-check"));
  assert.ok(state.userRealityCheck.trustReadinessBrief.apiRouteChips.includes("/api/harness-dashboard/v1/architecture"));
  assert.ok(state.userRealityCheck.trustReadinessBrief.apiRouteChips.includes("/api/harness-dashboard/v1/agent-bridge"));
  assert.ok(state.userRealityCheck.actionPlan.length >= 6);
  assert.ok(Array.isArray(state.userRealityCheck.nextActionRunway));
  assert.equal(state.userRealityCheck.nextActionRunway.length >= 4, true);
  assert.deepEqual(
    state.userRealityCheck.nextActionRunway.slice(0, 2).map((item) => item.actionId),
    ["action.verify-projections", "action.start-local-listener"]
  );
  assert.ok(state.userRealityCheck.nextActionRunway.every((item) =>
    item.id &&
    item.lane &&
    item.userQuestion &&
    item.actionTitle &&
    item.owner &&
    item.whyNow &&
    Array.isArray(item.unlocks) &&
    item.unlocks.length > 0 &&
    Array.isArray(item.evidenceToCollect) &&
    item.evidenceToCollect.length > 0 &&
    item.proofRoute &&
    item.expectedVisibleChange &&
    Array.isArray(item.blockerRefs) &&
    item.blockerRefs.length > 0 &&
    Array.isArray(item.sourceRefs) &&
    item.sourceRefs.length > 0
  ));
  assert.equal(state.userRealityCheck.nextActionRunway[1].proofRoute, "/api/harness-dashboard/v1/health");
  assert.ok(state.userRealityCheck.nextActionRunway.some((item) => /raw JSON/.test(item.userQuestion)));
  assert.ok(state.userRealityCheck.listenerTrustCard);
  assert.equal(state.userRealityCheck.listenerTrustCard.healthRoute, "/api/harness-dashboard/v1/health");
  assert.equal(state.userRealityCheck.listenerTrustCard.runtimeRoute, "/api/harness-dashboard/v1/runtime");
  assert.match(state.userRealityCheck.listenerTrustCard.startCommand, /ensure-listening/);
  assert.match(state.userRealityCheck.listenerTrustCard.snapshotAgePolicy, /health route/);
  const invalidListenerTrustState = JSON.parse(JSON.stringify(state));
  delete invalidListenerTrustState.userRealityCheck.listenerTrustCard.healthRoute;
  const invalidListenerTrustValidation = validateDashboardStateShape(invalidListenerTrustState);
  assert.equal(invalidListenerTrustValidation.valid, false);
  assert.ok(invalidListenerTrustValidation.errors.some((error) =>
    /listenerTrustCard\.healthRoute/.test(error)
  ));
  assert.ok(Array.isArray(state.userRealityCheck.progressFlow));
  assert.equal(state.userRealityCheck.progressFlow.length, 5);
  assert.deepEqual(
    state.userRealityCheck.progressFlow.map((item) => item.stage),
    EXPECTED_USER_REALITY_PROGRESS_STAGES
  );
  assert.equal(state.userRealityCheck.actionPlan[0].id, "action.verify-projections");
  assert.equal(state.userRealityCheck.actionPlan[1].id, "action.start-local-listener");
  assert.ok(state.userRealityCheck.actionPlan.every((item) => item.evidenceRequired.length > 0));
  assert.ok(state.userRealityCheck.progressFlow.every((item) => item.stage && item.title && item.status && item.summary && Array.isArray(item.sourceRefs)));
  assert.ok(state.userRealityCheck.progressFlow.some((item) => item.stage === "local-api" && /ensure-listening/.test(item.nextStep)));
  assert.equal(state.userRealityCheck.summary.missingEvidenceCount, state.governanceEvidenceBrief.missingEvidenceClaims.length);
  assert.equal(state.userRealityCheck.summary.openDecisionCount, state.governanceEvidenceBrief.unresolvedDecisions.length);
  assert.equal(state.userRealityCheck.apiContract.route, "/api/harness-dashboard/v1/reality-check");
  assert.match(state.userRealityCheck.apiContract.startCommand, /ensure-listening/);
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
  assert.ok(state.dashboardQualityScorecard.userPerspectiveAudit);
  assert.equal(state.dashboardQualityScorecard.userPerspectiveAudit.targetScore, 9.5);
  assert.equal(state.dashboardQualityScorecard.userPerspectiveAudit.currentSupportScore < 9.5, true);
  assert.match(state.dashboardQualityScorecard.userPerspectiveAudit.scorePolicy, /not release, deployment, or operations readiness/);
  assert.match(state.dashboardQualityScorecard.userPerspectiveAudit.explicitBlocker, /Cannot honestly score 9\.5/);
  assert.equal(state.dashboardQualityScorecard.userPerspectiveAudit.dimensions.length >= 8, true);
  assert.ok(state.dashboardQualityScorecard.userPerspectiveAudit.dimensions.every((item) =>
    item.id &&
    item.label &&
    Number.isFinite(item.score) &&
    item.score <= 10 &&
    item.status &&
    item.negativeFinding &&
    item.userOutcome &&
    Array.isArray(item.evidenceRefs) &&
    item.evidenceRefs.length > 0 &&
    Array.isArray(item.apiRouteChips) &&
    item.apiRouteChips.length > 0 &&
    item.nextAction
  ));
  assert.ok(state.dashboardQualityScorecard.userPerspectiveAudit.verificationPath.every((item) =>
    item.id &&
    item.title &&
    item.command &&
    item.expectedEvidence &&
    Array.isArray(item.apiRouteChips) &&
    item.apiRouteChips.length > 0 &&
    item.successSignal
  ));
  assert.ok(state.dashboardQualityScorecard.userPerspectiveAudit.apiRouteChips.includes("/api/harness-dashboard/v1/reality-check"));
  assert.ok(state.dashboardQualityScorecard.userPerspectiveAudit.dimensions.some((item) =>
    item.id === "listener-api-usefulness" &&
    item.apiRouteChips.includes("/api/harness-dashboard/v1/architecture") &&
    item.apiRouteChips.includes("/api/harness-dashboard/v1/agent-bridge")
  ));
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
  assert.match(html, /Trust\s*&amp;\s*Readiness Brief|Trust & Readiness Brief/);
  assert.match(html, /What is real right now/);
  assert.match(html, /Score policy/);
  assert.match(html, /Score dimensions/);
  assert.match(html, /Evidence checks/);
  assert.match(html, /Route contracts/);
  assert.match(html, /Next Action Runway/);
  assert.match(html, /Local listener health &amp; trust|Local listener health & trust/);
  assert.match(html, /expectedVisibleChange/);
  assert.match(html, /listenerTrustCard/);
  assert.match(html, /orientation-confidence-not-release-readiness/);
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
  assert.match(html, /Static mode note/);
  assert.match(html, /originalRequest/);
  assert.match(html, /traceIntegrity/);
  assert.match(html, /traceSource/);
  assert.match(html, /Trace source/);
  assert.match(html, /Non-authoritative trace/);
  assert.match(html, /User Perspective Audit/);
  assert.match(html, /negativeFinding/);
  assert.match(html, /userOutcome/);
  assert.match(html, /userPerspectiveAudit/);
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
  assert.match(html, /briefQuestions/);
  assert.match(html, /briefScore/);
  assert.match(html, /briefRouteContracts/);
  assert.match(html, /expectedPayloadKeys/);
  assert.match(html, /What could be risky/);
  assert.match(html, /Reality > Risks > Next Actions > Proof > API/);
  assert.match(html, /Listener bootstrap/);
  assert.match(html, /Static proof fallback/);
  assert.match(html, /listenerBootstrapCopy/);
  assert.match(html, /ensure-listening/);
  assert.match(html, /id="tab-overview"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(html, /id="tab-work"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  assert.match(html, /id="view-overview"[^>]*aria-hidden="false"/);
  assert.match(html, /id="view-work"[^>]*aria-hidden="true"[^>]*hidden[^>]*inert/);
  assert.match(html, /setAttribute\("tabindex", selected \? "0" : "-1"\)/);
  assert.match(html, /toggleAttribute\("hidden", !selected\)/);
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
  assert.match(html, /Semantic Governance Cockpit/);
  assert.match(html, /Architecture Layer Map/);
  assert.match(html, /Agent Command Bridge/);
  assert.match(html, /view-architecture/);
  assert.match(html, /data-agent-command-build/);
  assert.match(html, /Build draft packet/);
  assert.match(html, /Copy draft for Agent/);
  assert.match(html, /query\?scope=architecture/);
  assert.match(html, /rule-flow-map/);
  assert.match(html, /architectureRuleFlowMap/);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /id="agent-command-preview" aria-label="Agent command draft packet" tabindex="0"/);
  assert.match(html, /executionMode/);
  assert.match(html, /dashboardDoesNotRunTools/);
  assert.match(html, /sourceStateHash/);
  assert.ok(html.includes('selectedRoute.startsWith("/api/harness-dashboard/v1/")'));
  assert.match(html, /apiLookupRejected/);
  assert.match(html, /eventSource/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(html, /Primary system/);
  assert.doesNotMatch(html, /GitHub Pages target if approved/);
  assert.doesNotMatch(html, /project Supabase plan, if present/);
  assert.doesNotMatch(html, /supabase\/\*\.sql/);
  assert.match(html, /\.command-composer select, \.command-composer textarea \{ width: 100%; min-width: 0; max-width: 100%; \}/);
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
  assert.equal(validation.isInitialized, false);
  assert.equal(validation.completeness < 100, true);
  const semanticProjectionItems = validation.items.filter((item) =>
    item.path.startsWith("docs/ai-harness/ontology/state/") &&
    [
      "source-graph.json",
      "governance-evaluation.json",
      "semantic-warehouse.json",
      "waiver-validation.json",
      "enforcement-report.json",
    ].some((fileName) => item.path.endsWith(fileName))
  );
  assert.equal(semanticProjectionItems.length, 5);
  assert.ok(semanticProjectionItems.every((item) => item.status === "outdated"));
  assert.match(validation.summary, /Bootstrap-only semantic projection|Semantic warehouse has no fact rows/);

  const generatedWarehouse = buildSemanticWarehouse({
    workspacePath: root,
    architectureProfile: "n-tier",
    maxFiles: 1,
  });
  assert.ok(generatedWarehouse.views.claims.some((row) => row.claimId === "claim.data.integrity"));
  assert.ok(generatedWarehouse.views.completedFacts.some((row) => row.rowType === "completedSessionTrace"));
  assert.ok(generatedWarehouse.views.claims.every((row) => row.sourceRefs.includes("docs/ai-harness/dashboard/state/dashboard-state.json")));
  assert.ok(generatedWarehouse.views.completedFacts.every((row) => row.sourceRefs.includes("docs/ai-harness/dashboard/state/dashboard-state.json")));
}

{
  const { root } = generateWorkspace();
  fs.rmSync(path.join(root, "docs", "ai-harness", "ontology"), {
    recursive: true,
    force: true,
  });
  fs.rmSync(path.join(root, ".github", "ai-harness", "architecture-ontology.policy.json"), {
    force: true,
  });
  const validation = validateWorkspace(root);
  assert.equal(validation.isInitialized, false);
  assert.ok(validation.completeness < 100);
  assert.ok(validation.items.some((item) =>
    item.path === ".github/ai-harness/architecture-ontology.policy.json" &&
    item.status === "missing" &&
    item.severity === "required"
  ));
  assert.ok(validation.items.some((item) =>
    item.path === "docs/ai-harness/ontology/state/governance-evaluation.json" &&
    item.status === "missing"
  ));
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, "src", "controllers"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "services"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "data", "UserRepository.ts"),
    "export class UserRepository { findUser(id: string) { return { id }; } }\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "services", "UserService.ts"),
    [
      "import { UserRepository } from '../data/UserRepository.js';",
      "export class UserService {",
      "  constructor(private readonly repository = new UserRepository()) {}",
      "  find(id: string) { return this.repository.findUser(id); }",
      "}",
      "",
    ].join("\n"),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "controllers", "UserController.ts"),
    [
      "import { UserRepository } from '../data/UserRepository.js';",
      "export class UserController {",
      "  async handler(id: string) {",
      "    await import('../services/UserService.js');",
      "    return new UserRepository().findUser(id);",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "controllers", "AdminController.ts"),
    [
      "import { UserRepository } from '../data/UserRepository.js';",
      "export class AdminController {",
      "  handler(id: string) {",
      "    return new UserRepository().findUser(id);",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf-8"
  );

  const graph = scanSourceGraph({
    workspacePath: root,
    architectureProfile: "n-tier",
  });
  assert.ok(graph.files.some((file) => file.path === "src/controllers/UserController.ts"));
  assert.ok(graph.files.some((file) => file.layer === "data-access"));
  assert.ok(graph.edges.some((edge) =>
    edge.fromLayer === "presentation" &&
    edge.toLayer === "data-access" &&
    edge.kind === "imports"
  ));

  const evaluation = validateSemanticGovernance({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
  });
  assert.equal(evaluation.verdict, "block");
  assert.ok(evaluation.violations.some((violation) =>
    violation.ruleId === "n-tier.presentation-must-not-import-data-access" &&
    violation.sourcePath === "src/controllers/UserController.ts"
  ));

  const pack = buildSemanticContextPack({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    tokenBudget: "balanced",
  });
  const packAgain = buildSemanticContextPack({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    tokenBudget: "balanced",
  });
  const leanPack = buildSemanticContextPack({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    tokenBudget: "lean",
  });
  assert.equal(pack.verdict, "block");
  assert.equal(packAgain.contentHash, pack.contentHash);
  assert.equal(pack.compression.advisoryCompressionOnly, true);
  assert.equal(pack.compression.authority, "exact-graph-policy-receipts");
  assert.equal(leanPack.compression.maxFindings < pack.compression.maxFindings, true);
  assert.match(pack.promptTemplate, /exact source graph/);
  assert.ok(pack.sourceRefs.includes(".github/ai-harness/architecture-ontology.policy.json"));
  assert.ok(pack.sourceRefs.includes("src/controllers/UserController.ts"));
  assert.match(JSON.stringify(pack.jsonLd), /DependencyEdge/);
  assert.ok(pack.ruleFacts.some((fact) => fact.ruleId === "n-tier.presentation-must-not-import-data-access"));
  assert.ok(pack.antiPatterns.some((pattern) =>
    pattern.ruleId === "n-tier.presentation-must-not-import-data-access" &&
    pattern.occurrenceCount > 1 &&
    /Repeated/.test(pattern.attentionPrompt)
  ));
  assert.ok(pack.quantizedSignatures.length > 0);
  assert.ok(pack.quantizedSignatures.every((signature) =>
    signature.advisoryOnly === true &&
    Array.isArray(signature.sourceRefs) &&
    signature.sourceRefs.length > 0
  ));
  assert.ok(pack.spatialMaps.some((map) => map.includes("[LAYER MAP]")));

  const warehouse = buildSemanticWarehouse({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
  });
  assert.ok(warehouse.viewSummaries.some((view) => view.view === "files" && view.rowCount > 0));
  assert.ok(warehouse.viewSummaries.some((view) => view.view === "dependencyEdges" && view.rowCount > 0));
  assert.ok(warehouse.viewSummaries.some((view) => view.view === "rules" && view.rowCount > 0));
  assert.ok(warehouse.viewSummaries.some((view) => view.view === "violations" && view.rowCount > 0));
  const allWarehouseRows = Object.values(warehouse.views).flat();
  assert.ok(allWarehouseRows.length > 0);
  assert.ok(allWarehouseRows.every((row) =>
    row.id &&
    row.rowType &&
    Array.isArray(row.sourceRefs) &&
    row.sourceRefs.length > 0 &&
    row.provenance &&
    Array.isArray(row.provenance.sourceRefs) &&
    row.provenance.sourceRefs.length > 0
  ));

  const blockingQuery = querySemanticWarehouse({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    queryId: "rules_blocking_file",
    targetPath: "src/controllers/UserController.ts",
  });
  const blockingQueryAgain = querySemanticWarehouse({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    queryId: "rules_blocking_file",
    targetPath: "src/controllers/UserController.ts",
  });
  assert.deepEqual(blockingQueryAgain, blockingQuery, "semantic warehouse queries must be deterministic");
  assert.ok(blockingQuery.rows.some((row) => row.ruleId === "n-tier.presentation-must-not-import-data-access"));
  assert.ok(blockingQuery.sourceRefs.includes("src/controllers/UserController.ts"));

  const edgeQuery = querySemanticWarehouse({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    queryId: "dependency_edges_for_file",
    targetPath: "src/controllers/UserController.ts",
  });
  assert.ok(edgeQuery.rows.some((row) => row.toPath === "src/data/UserRepository.ts"));

  const controllerViolation = evaluation.violations.find((violation) =>
    violation.ruleId === "n-tier.presentation-must-not-import-data-access" &&
    violation.sourcePath === "src/controllers/UserController.ts"
  );
  assert.ok(controllerViolation);
  const trust = createGovernanceTrust(root);
  runGit(root, ["init"]);
  runGit(root, ["config", "user.email", "harness@example.invalid"]);
  runGit(root, ["config", "user.name", "Harness Test"]);
  runGit(root, [
    "add",
    ".github/ai-harness/governance-trust.json",
    "docs/ai-harness/ontology/state/waiver-revocations.json",
  ]);
  runGit(root, ["commit", "-m", "anchor empty waiver revocations"]);
  fs.mkdirSync(path.join(root, "docs", "decisions"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "ai-harness", "ontology", "state"), { recursive: true });
  fs.appendFileSync(
    path.join(root, "src", "controllers", "UserController.ts"),
    "\n// semantic-waiver: waiver.valid.001\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "docs", "decisions", "waiver-valid.md"),
    "# Valid waiver evidence\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "docs", "decisions", "waiver-valid-approval.md"),
    "# Valid waiver approval\n",
    "utf-8"
  );
  const validWaiver = signedWaiver(root, trust, {
    id: "waiver.valid.001",
    ruleId: controllerViolation.ruleId,
    edgeFingerprint: controllerViolation.fingerprint,
    owner: "architecture-owner",
    approvalRef: "docs/decisions/waiver-valid-approval.md",
    status: "active",
    createdAt: "2026-07-01T00:00:00.000Z",
    expiresAt: "2026-07-15T00:00:00.000Z",
    evidenceRefs: ["docs/decisions/waiver-valid.md"],
    maxUses: 1,
    rationale: "Temporary fixture exception with exact fingerprint.",
  });
  fs.writeFileSync(
    path.join(root, "docs", "ai-harness", "ontology", "state", "bypass-ledger.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        policy: "Source comments reference waiver ids only.",
        waivers: [validWaiver],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  const validWaiverValidation = validateArchitectureWaivers({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    now: "2026-07-08T00:00:00.000Z",
  });
  assert.equal(validWaiverValidation.verdict, "allow");
  assert.equal(validWaiverValidation.metrics.validWaivers, 1);
  assert.ok(validWaiverValidation.findings.some((finding) =>
    finding.status === "valid" &&
    finding.waiverId === "waiver.valid.001" &&
    finding.edgeFingerprint === controllerViolation.fingerprint
  ));

  const revocation = {
    id: "waiver-revocation.valid.001",
    waiverId: "waiver.valid.001",
    ruleId: controllerViolation.ruleId,
    edgeFingerprint: controllerViolation.fingerprint,
    revokedBy: trust.reviewerId,
    revokedAt: "2026-07-09T00:00:00.000Z",
    reason: "Regression fixture revocation.",
    revocationSignature: "",
  };
  const signedRevocation = {
    ...revocation,
    revocationSignature: signGovernancePayload(
      trust.privateKey,
      buildWaiverRevocationPayload(revocation)
    ),
  };
  fs.writeFileSync(
    path.join(root, "docs", "ai-harness", "ontology", "state", "waiver-revocations.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        policy: "Signed revocation receipts override active waiver approvals.",
        revocations: [signedRevocation],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  const revokedWaiverValidation = validateArchitectureWaivers({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    now: "2026-07-10T00:00:00.000Z",
  });
  assert.equal(revokedWaiverValidation.verdict, "block");
  assert.equal(revokedWaiverValidation.metrics.validWaivers, 0);
  assert.ok(revokedWaiverValidation.findings.some((finding) =>
    finding.waiverId === "waiver.valid.001" &&
    /trusted signed revocation/.test(finding.message)
  ));

  runGit(root, ["add", "docs/ai-harness/ontology/state/waiver-revocations.json"]);
  runGit(root, ["commit", "-m", "anchor signed waiver revocation"]);
  fs.writeFileSync(
    path.join(root, "docs", "ai-harness", "ontology", "state", "waiver-revocations.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        policy: "Signed revocation receipts override active waiver approvals.",
        revocations: [],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  runGit(root, ["add", "docs/ai-harness/ontology/state/waiver-revocations.json"]);
  runGit(root, ["commit", "-m", "attempt waiver revocation rollback"]);
  const rollbackValidation = validateArchitectureWaivers({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    now: "2026-07-10T00:00:00.000Z",
  });
  assert.equal(rollbackValidation.verdict, "block");
  assert.equal(rollbackValidation.metrics.validWaivers, 0);
  assert.ok(rollbackValidation.findings.some((finding) =>
    finding.waiverId === "waiver.valid.001" &&
    /append-only/.test(finding.message)
  ));
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, "docs", "ai-harness", "ontology", "state"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "decisions"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs", "decisions", "adr-1.md"),
    "# ADR 1\n\nWaiver evidence.\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "docs", "ai-harness", "ontology", "state", "bypass-ledger.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        policy: "test waiver ledger",
        waivers: [
          {
            id: "waiver.test.001",
            ruleId: "clean.application-must-not-import-infrastructure",
            edgeFingerprint: "edge-fingerprint-test",
            owner: "test-owner",
            status: "active",
            expiresAt: "2099-01-01",
            evidenceRefs: ["docs/decisions/adr-1.md"],
          },
        ],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  const waiverQuery = querySemanticWarehouse({
    workspacePath: root,
    architectureProfile: "clean",
    strictUnknown: true,
    queryId: "evidence_for_waiver",
    waiverId: "waiver.test.001",
  });
  assert.equal(waiverQuery.rowCount >= 2, true);
  assert.ok(waiverQuery.rows.some((row) => row.rowType === "waiver" && row.waiverId === "waiver.test.001"));
  assert.ok(waiverQuery.rows.some((row) => row.rowType === "evidenceRef" && row.ref === "docs/decisions/adr-1.md"));
  assert.ok(waiverQuery.sourceRefs.includes("docs/ai-harness/ontology/state/bypass-ledger.json"));
  assert.ok(waiverQuery.sourceRefs.includes("docs/decisions/adr-1.md"));
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, "src", "controllers"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "decisions"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "ai-harness", "ontology", "state"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "data", "UserRepository.ts"),
    "export class UserRepository {}\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "controllers", "SelfAuthorizingController.ts"),
    [
      "import { UserRepository } from '../data/UserRepository.js';",
      "// semantic-waiver: waiver.self.001 allow bypass",
      "export class SelfAuthorizingController { repo = new UserRepository(); }",
      "",
    ].join("\n"),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "controllers", "UnknownWaiverController.ts"),
    [
      "import { UserRepository } from '../data/UserRepository.js';",
      "// semantic-waiver: waiver.unknown.404",
      "export class UnknownWaiverController { repo = new UserRepository(); }",
      "",
    ].join("\n"),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "docs", "decisions", "waiver-expired.md"),
    "# Expired waiver evidence\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "docs", "decisions", "waiver-mismatch.md"),
    "# Mismatch waiver evidence\n",
    "utf-8"
  );
  const negativeEvaluation = validateSemanticGovernance({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
  });
  const negativeViolation = negativeEvaluation.violations.find((violation) =>
    violation.ruleId === "n-tier.presentation-must-not-import-data-access"
  );
  assert.ok(negativeViolation);
  fs.writeFileSync(
    path.join(root, "docs", "ai-harness", "ontology", "state", "bypass-ledger.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        policy: "Source comments reference waiver ids only.",
        waivers: [
          {
            id: "waiver.self.001",
            ruleId: negativeViolation.ruleId,
            edgeFingerprint: negativeViolation.fingerprint,
            owner: "architecture-owner",
            status: "active",
            createdAt: "2026-07-01T00:00:00.000Z",
            expiresAt: "2026-07-15T00:00:00.000Z",
            evidenceRefs: ["docs/decisions/waiver-expired.md"],
            maxUses: 1,
            rationale: "Self-authorizing comments must still fail.",
          },
          {
            id: "waiver.expired.001",
            ruleId: negativeViolation.ruleId,
            edgeFingerprint: negativeViolation.fingerprint,
            owner: "architecture-owner",
            status: "active",
            createdAt: "2020-01-01T00:00:00.000Z",
            expiresAt: "2020-01-02T00:00:00.000Z",
            evidenceRefs: ["docs/decisions/waiver-expired.md"],
            maxUses: 1,
            rationale: "Expired fixture.",
          },
          {
            id: "waiver.mismatch.001",
            ruleId: negativeViolation.ruleId,
            edgeFingerprint: "not-the-edge-fingerprint",
            owner: "architecture-owner",
            status: "active",
            createdAt: "2026-07-01T00:00:00.000Z",
            expiresAt: "2026-07-15T00:00:00.000Z",
            evidenceRefs: ["docs/decisions/waiver-mismatch.md"],
            maxUses: 1,
            rationale: "Mismatch fixture.",
          },
          {
            id: "waiver.missing-evidence.001",
            ruleId: negativeViolation.ruleId,
            edgeFingerprint: negativeViolation.fingerprint,
            owner: "architecture-owner",
            status: "active",
            createdAt: "2026-07-01T00:00:00.000Z",
            expiresAt: "2026-07-15T00:00:00.000Z",
            evidenceRefs: ["docs/decisions/missing.md"],
            maxUses: 1,
            rationale: "Missing evidence fixture.",
          },
        ],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  const negativeWaiverValidation = validateArchitectureWaivers({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    now: "2026-07-08T00:00:00.000Z",
  });
  assert.equal(negativeWaiverValidation.verdict, "block");
  assert.ok(negativeWaiverValidation.findings.some((finding) => finding.status === "self-authorizing-comment"));
  assert.ok(negativeWaiverValidation.findings.some((finding) => finding.status === "expired"));
  assert.ok(negativeWaiverValidation.findings.some((finding) => finding.status === "fingerprint-mismatch"));
  assert.ok(negativeWaiverValidation.findings.some((finding) => finding.status === "missing-evidence"));
  assert.ok(negativeWaiverValidation.findings.some((finding) => finding.status === "unknown-reference"));

  const negativeEnforcement = runSemanticEnforcement({
    workspacePath: root,
    architectureProfile: "n-tier",
    enforcementMode: "strict",
    strictUnknown: true,
    now: "2026-07-08T00:00:00.000Z",
  });
  assert.equal(negativeEnforcement.gate, "fail");
  assert.equal(negativeEnforcement.canProceed, false);
  assert.equal(negativeEnforcement.metrics.waiverBlockFindings > 0, true);
  assert.match(negativeEnforcement.markdown, /self-authorizing-comment/);
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, "src", "controllers"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "data"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "data", "UserRepository.ts"),
    "export class UserRepository {}\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "controllers", "ReportOnlyController.ts"),
    [
      "import { UserRepository } from '../data/UserRepository.js';",
      "export class ReportOnlyController {}",
      "",
    ].join("\n"),
    "utf-8"
  );

  const reportMode = runSemanticEnforcement({
    workspacePath: root,
    architectureProfile: "n-tier",
    enforcementMode: "report",
    strictUnknown: true,
    now: "2026-07-08T00:00:00.000Z",
  });
  assert.equal(reportMode.gate, "warn");
  assert.equal(reportMode.canProceed, true);
  assert.ok(reportMode.decisions.some((decision) => decision.status === "warn"));

  const strictMode = runSemanticEnforcement({
    workspacePath: root,
    architectureProfile: "n-tier",
    enforcementMode: "strict",
    strictUnknown: true,
    now: "2026-07-08T00:00:00.000Z",
  });
  assert.equal(strictMode.gate, "fail");
  assert.equal(strictMode.canProceed, false);
  assert.ok(strictMode.decisions.some((decision) => decision.status === "blocked"));
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, "src", "controllers"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "decisions"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "ai-harness", "ontology", "state"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "data", "UserRepository.ts"),
    "export class UserRepository {}\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "controllers", "WaivedController.ts"),
    [
      "import { UserRepository } from '../data/UserRepository.js';",
      "// semantic-waiver: waiver.enforcement.001",
      "export class WaivedController {}",
      "",
    ].join("\n"),
    "utf-8"
  );
  const evaluation = validateSemanticGovernance({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
  });
  const violation = evaluation.violations.find((finding) =>
    finding.ruleId === "n-tier.presentation-must-not-import-data-access"
  );
  assert.ok(violation);
  const trust = createGovernanceTrust(root);
  runGit(root, ["init"]);
  runGit(root, ["config", "user.email", "harness@example.invalid"]);
  runGit(root, ["config", "user.name", "Harness Test"]);
  runGit(root, [
    "add",
    ".github/ai-harness/governance-trust.json",
    "docs/ai-harness/ontology/state/waiver-revocations.json",
  ]);
  runGit(root, ["commit", "-m", "anchor empty waiver revocations"]);
  fs.writeFileSync(
    path.join(root, "docs", "decisions", "waiver-enforcement.md"),
    "# Enforcement waiver evidence\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "docs", "decisions", "waiver-enforcement-approval.md"),
    "# Enforcement waiver approval\n",
    "utf-8"
  );
  const enforcementWaiver = signedWaiver(root, trust, {
    id: "waiver.enforcement.001",
    ruleId: violation.ruleId,
    edgeFingerprint: violation.fingerprint,
    owner: "architecture-owner",
    approvalRef: "docs/decisions/waiver-enforcement-approval.md",
    status: "active",
    createdAt: "2026-07-01T00:00:00.000Z",
    expiresAt: "2026-07-15T00:00:00.000Z",
    evidenceRefs: ["docs/decisions/waiver-enforcement.md"],
    maxUses: 1,
    rationale: "Temporary enforcement fixture exception with exact fingerprint.",
  });
  fs.writeFileSync(
    path.join(root, "docs", "ai-harness", "ontology", "state", "bypass-ledger.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        policy: "Source comments reference waiver ids only.",
        waivers: [enforcementWaiver],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  const strictWaived = runSemanticEnforcement({
    workspacePath: root,
    architectureProfile: "n-tier",
    enforcementMode: "strict",
    strictUnknown: true,
    now: "2026-07-08T00:00:00.000Z",
  });
  assert.equal(strictWaived.gate, "pass");
  assert.equal(strictWaived.canProceed, true);
  assert.ok(strictWaived.decisions.some((decision) =>
    decision.status === "waived" &&
    decision.waiverId === "waiver.enforcement.001"
  ));
  assert.match(strictWaived.markdown, /Semantic Enforcement Report/);
  assert.match(strictWaived.markdown, /Opt-in/);
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, "src", "domain"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "domain", "Order.ts"),
    [
      "import { MissingAdapter } from './MissingAdapter.js';",
      "export const orderAdapter = MissingAdapter;",
      "",
    ].join("\n"),
    "utf-8"
  );
  const forcedStrictUnknown = runSemanticEnforcement({
    workspacePath: root,
    architectureProfile: "ddd",
    enforcementMode: "strict",
    strictUnknown: false,
    now: "2026-07-08T00:00:00.000Z",
  });
  assert.equal(forcedStrictUnknown.gate, "fail");
  assert.equal(forcedStrictUnknown.canProceed, false);
  assert.equal(forcedStrictUnknown.metrics.strictUnknownForced, true);
  assert.ok(forcedStrictUnknown.decisions.some((decision) => decision.status === "blocked"));
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "a.ts"), "export const a = 1;\n", "utf-8");
  fs.writeFileSync(path.join(root, "src", "b.ts"), "export const b = 2;\n", "utf-8");
  const partialScan = runSemanticEnforcement({
    workspacePath: root,
    architectureProfile: "n-tier",
    enforcementMode: "ci",
    maxFiles: 1,
  });
  assert.equal(partialScan.gate, "fail");
  assert.equal(partialScan.canProceed, false);
  assert.equal(partialScan.metrics.skippedByLimit > 0, true);

  const unsupportedSource = createWorkspace();
  fs.mkdirSync(path.join(unsupportedSource, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(unsupportedSource, "src", "service.py"),
    "class Service:\n    pass\n",
    "utf-8"
  );
  const unsupportedScan = runSemanticEnforcement({
    workspacePath: unsupportedSource,
    architectureProfile: "n-tier",
    enforcementMode: "ci",
  });
  assert.equal(unsupportedScan.gate, "fail");
  assert.equal(unsupportedScan.metrics.unsupportedFiles, 1);
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, "src", "controllers"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "decisions"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "ai-harness", "ontology", "state"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "data", "UserRepository.ts"),
    "export class UserRepository {}\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "controllers", "LedgerOnlyController.ts"),
    [
      "import { UserRepository } from '../data/UserRepository.js';",
      "export class LedgerOnlyController { repo = new UserRepository(); }",
      "",
    ].join("\n"),
    "utf-8"
  );
  const evaluation = validateSemanticGovernance({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
  });
  const violation = evaluation.violations.find((finding) =>
    finding.ruleId === "n-tier.presentation-must-not-import-data-access"
  );
  assert.ok(violation);
  fs.writeFileSync(
    path.join(root, "docs", "decisions", "ledger-only-waiver.md"),
    "# Ledger-only waiver evidence\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "docs", "ai-harness", "ontology", "state", "bypass-ledger.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        policy: "Source comments reference waiver ids only.",
        waivers: [
          {
            id: "waiver.ledger-only.001",
            ruleId: violation.ruleId,
            edgeFingerprint: violation.fingerprint,
            owner: "architecture-owner",
            status: "active",
            createdAt: "2026-07-01T00:00:00.000Z",
            expiresAt: "2026-07-15T00:00:00.000Z",
            evidenceRefs: ["docs/decisions/ledger-only-waiver.md"],
            maxUses: 1,
            rationale: "This exact waiver lacks the required source reference.",
          },
        ],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  const ledgerOnly = validateArchitectureWaivers({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    now: "2026-07-08T00:00:00.000Z",
  });
  assert.equal(ledgerOnly.verdict, "block");
  assert.ok(ledgerOnly.findings.some((finding) =>
    finding.waiverId === "waiver.ledger-only.001" &&
    /ledger-only waivers/.test(finding.message)
  ));
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, "src", "controllers"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "decisions"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "ai-harness", "ontology", "state"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "data", "UserRepository.ts"),
    "export class UserRepository {}\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "data", "AuditRepository.ts"),
    "export class AuditRepository {}\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "controllers", "MultiWaiverController.ts"),
    [
      "import { UserRepository } from '../data/UserRepository.js';",
      "import { AuditRepository } from '../data/AuditRepository.js';",
      "// semantic-waiver: waiver.multi.001",
      "// semantic-waiver: waiver.multi.002",
      "export class MultiWaiverController {",
      "  user = new UserRepository();",
      "  audit = new AuditRepository();",
      "}",
      "",
    ].join("\n"),
    "utf-8"
  );
  const evaluation = validateSemanticGovernance({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
  });
  const multiViolations = evaluation.violations.filter((finding) =>
    finding.sourcePath === "src/controllers/MultiWaiverController.ts" &&
    finding.ruleId === "n-tier.presentation-must-not-import-data-access"
  );
  assert.equal(multiViolations.length, 2);
  fs.writeFileSync(
    path.join(root, "docs", "decisions", "multi-waiver.md"),
    "# Multi waiver evidence\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "docs", "ai-harness", "ontology", "state", "bypass-ledger.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "test",
        policy: "Source comments reference waiver ids only.",
        waivers: [
          {
            id: "waiver.multi.001",
            ruleId: multiViolations[0].ruleId,
            edgeFingerprint: multiViolations[0].fingerprint,
            owner: "architecture-owner",
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            expiresAt: "2026-07-15T00:00:00.000Z",
            evidenceRefs: ["docs/decisions/multi-waiver.md"],
            maxUses: 1,
            rationale: "Intentionally exceeds policy ttlDays.",
          },
          {
            id: "waiver.multi.002",
            ruleId: multiViolations[1].ruleId,
            edgeFingerprint: multiViolations[1].fingerprint,
            owner: "architecture-owner",
            status: "active",
            createdAt: "2026-07-01T00:00:00.000Z",
            expiresAt: "2026-07-15T00:00:00.000Z",
            evidenceRefs: ["docs/decisions/multi-waiver.md"],
            maxUses: 1,
            rationale: "Intentionally exceeds policy maxActivePerFile when combined.",
          },
        ],
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  const policyLimited = validateArchitectureWaivers({
    workspacePath: root,
    architectureProfile: "n-tier",
    strictUnknown: true,
    now: "2026-07-08T00:00:00.000Z",
  });
  assert.equal(policyLimited.verdict, "block");
  assert.ok(policyLimited.findings.some((finding) => /ttlDays/.test(finding.message)));
  assert.ok(policyLimited.findings.some((finding) => /maxActivePerFile/.test(finding.message)));
  assert.equal(policyLimited.metrics.validWaivers, 0);
}

{
  const { root } = generateWorkspace();
  const originalPolicy = readJson(root, ".github/ai-harness/architecture-ontology.policy.json");
  assert.equal(originalPolicy.profileId, "n-tier");

  const exported = exportArchitecturePolicyPack({
    workspacePath: root,
    architectureProfile: "clean",
    exportedBy: "architecture-owner",
    writePack: true,
  });
  assert.equal(exported.status, "exported");
  assert.equal(exported.pack.trust.autoUpload, false);
  assert.equal(exported.pack.trust.reviewRequired, true);
  assert.equal(exported.pack.trust.localAuthorityDefault, true);
  assert.ok(exported.packPath);
  assert.ok(fs.existsSync(path.join(root, exported.packPath)));

  const tamperedPackPath =
    "docs/ai-harness/ontology/policy-packs/exports/tampered.policy-pack.json";
  const tamperedPack = JSON.parse(JSON.stringify(exported.pack));
  tamperedPack.signature.value = "sha256:not-the-pack-signature";
  fs.mkdirSync(path.dirname(path.join(root, tamperedPackPath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, tamperedPackPath),
    JSON.stringify(tamperedPack, null, 2) + "\n",
    "utf-8"
  );
  const tamperedReview = importArchitecturePolicyPack({
    workspacePath: root,
    packPath: tamperedPackPath,
  });
  assert.equal(tamperedReview.status, "blocked");
  assert.ok(tamperedReview.errors.some((error) => /signature\.value/.test(error)));

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-init-mcp-policy-outside-"));
  fs.writeFileSync(
    path.join(outside, "outside.policy-pack.json"),
    JSON.stringify(exported.pack, null, 2) + "\n",
    "utf-8"
  );
  const linkedPackDir = path.join(
    root,
    "docs",
    "ai-harness",
    "ontology",
    "policy-packs",
    "linked-outside"
  );
  let policySymlinkCreated = false;
  try {
    fs.symlinkSync(outside, linkedPackDir, "junction");
    policySymlinkCreated = true;
  } catch {
    policySymlinkCreated = false;
  }
  if (policySymlinkCreated) {
    const linkedReview = importArchitecturePolicyPack({
      workspacePath: root,
      packPath:
        "docs/ai-harness/ontology/policy-packs/linked-outside/outside.policy-pack.json",
    });
    assert.equal(linkedReview.status, "blocked");
    assert.ok(linkedReview.errors.some((error) =>
      /unsafe|symbolic link|linked/.test(error)
    ));
  }

  const reviewedBy = "principal-architect";
  const trust = createGovernanceTrust(root, reviewedBy);
  const approvalRef = "docs/decisions/policy-pack-clean-review.md";
  fs.mkdirSync(path.dirname(path.join(root, approvalRef)), { recursive: true });
  fs.writeFileSync(
    path.join(root, approvalRef),
    "# Policy pack clean profile approval\n\nReviewed for local replacement.\n",
    "utf-8"
  );
  const reviewPreview = importArchitecturePolicyPack({
    workspacePath: root,
    packPath: exported.packPath,
  });
  assert.ok(reviewPreview.reviewReceiptPath);
  const approvalSignature = signGovernancePayload(
    trust.privateKey,
    buildPolicyPackApprovalPayload({
      packId: exported.pack.packId,
      policyHash: exported.pack.policyHash,
      packSignature: exported.pack.signature.value,
      reviewedBy,
      approvalRef,
      approvalEvidenceHash: fileSha256(path.join(root, approvalRef)),
      reviewReceiptPath: reviewPreview.reviewReceiptPath,
    })
  );
  const review = importArchitecturePolicyPack({
    workspacePath: root,
    packPath: exported.packPath,
    reviewedBy,
    approvalRef,
    approvalSignature,
    writeReview: true,
  });
  assert.equal(review.status, "review-required");
  assert.equal(review.applied, false);
  assert.equal(readJson(root, ".github/ai-harness/architecture-ontology.policy.json").profileId, "n-tier");
  assert.ok(review.expectedReviewSignature);
  assert.ok(review.reviewReceiptPath);
  assert.ok(fs.existsSync(path.join(root, review.reviewReceiptPath)));
  assert.ok(review.conflicts.some((conflict) => conflict.type === "profile-mismatch"));

  const blockedApply = importArchitecturePolicyPack({
    workspacePath: root,
    packPath: exported.packPath,
    applyMerge: true,
    mergeStrategy: "replace-profile",
    allowProfileChange: true,
    allowConflicts: true,
    reviewedBy,
    approvalRef,
    approvalSignature,
    reviewReceiptPath: review.reviewReceiptPath,
    reviewSignature: "not-the-expected-signature",
  });
  assert.equal(blockedApply.status, "blocked");
  assert.equal(blockedApply.applied, false);
  assert.equal(readJson(root, ".github/ai-harness/architecture-ontology.policy.json").profileId, "n-tier");

  const missingReceiptApply = importArchitecturePolicyPack({
    workspacePath: root,
    packPath: exported.packPath,
    applyMerge: true,
    mergeStrategy: "replace-profile",
    allowProfileChange: true,
    allowConflicts: true,
    reviewedBy,
    approvalRef,
    approvalSignature,
    reviewSignature: review.expectedReviewSignature,
  });
  assert.equal(missingReceiptApply.status, "blocked");
  assert.ok(missingReceiptApply.errors.some((error) => /reviewReceiptPath/.test(error)));

  const reviewSignature = review.expectedReviewSignature;
  assert.ok(reviewSignature);
  const merged = importArchitecturePolicyPack({
    workspacePath: root,
    packPath: exported.packPath,
    applyMerge: true,
    mergeStrategy: "replace-profile",
    allowProfileChange: true,
    allowConflicts: true,
    reviewedBy,
    approvalRef,
    approvalSignature,
    reviewReceiptPath: review.reviewReceiptPath,
    reviewSignature,
  });
  assert.equal(merged.status, "merged");
  assert.equal(merged.applied, true);
  assert.ok(merged.backupPath);
  assert.ok(merged.reviewReceiptPath);
  assert.ok(fs.existsSync(path.join(root, merged.backupPath)));
  assert.ok(fs.existsSync(path.join(root, merged.reviewReceiptPath)));
  assert.equal(readJson(root, ".github/ai-harness/architecture-ontology.policy.json").profileId, "clean");
}

{
  const profileFixtures = [
    {
      profile: "clean",
      files: {
        "src/use-cases/GetUser.ts": [
          "import { DbClient } from '../infra/DbClient.js';",
          "export class GetUser { constructor(private readonly db = new DbClient()) {} }",
          "",
        ].join("\n"),
        "src/infra/DbClient.ts": "export class DbClient {}\n",
      },
      ruleId: "clean.application-must-not-import-infrastructure",
      sourcePath: "src/use-cases/GetUser.ts",
    },
    {
      profile: "hexagonal",
      files: {
        "src/application/RegisterUser.ts": [
          "import { UserRepository } from '../adapters/outbound/UserRepository.js';",
          "export class RegisterUser { constructor(private readonly repo = new UserRepository()) {} }",
          "",
        ].join("\n"),
        "src/adapters/outbound/UserRepository.ts": "export class UserRepository {}\n",
      },
      ruleId: "hexagonal.application-must-not-import-infrastructure",
      sourcePath: "src/application/RegisterUser.ts",
    },
    {
      profile: "ddd",
      files: {
        "src/domain/Order.ts": [
          "import { EventBus } from '../infrastructure/EventBus.js';",
          "export class Order { publish(bus = new EventBus()) { return bus; } }",
          "",
        ].join("\n"),
        "src/infrastructure/EventBus.ts": "export class EventBus {}\n",
      },
      ruleId: "ddd.domain-must-not-import-infrastructure",
      sourcePath: "src/domain/Order.ts",
    },
    {
      profile: "event-driven",
      files: {
        "src/domain/Invoice.ts": [
          "import { KafkaClient } from '../broker/KafkaClient.js';",
          "export class Invoice { publish(client = new KafkaClient()) { return client; } }",
          "",
        ].join("\n"),
        "src/broker/KafkaClient.ts": "export class KafkaClient {}\n",
      },
      ruleId: "event-driven.domain-must-not-import-infrastructure",
      sourcePath: "src/domain/Invoice.ts",
    },
    {
      profile: "workspace-init-mcp",
      files: {
        "src/data/Registry.ts": [
          "import { analyzeWorkspace } from '../tools/status.js';",
          "export const registry = { analyzeWorkspace };",
          "",
        ].join("\n"),
        "src/tools/status.ts": "export function analyzeWorkspace() { return {}; }\n",
      },
      ruleId: "workspace-init-mcp.data-access-must-not-import-business",
      sourcePath: "src/data/Registry.ts",
    },
  ];

  for (const fixture of profileFixtures) {
    const root = createWorkspace();
    for (const [relativePath, content] of Object.entries(fixture.files)) {
      const fullPath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, "utf-8");
    }
    const evaluation = validateSemanticGovernance({
      workspacePath: root,
      architectureProfile: fixture.profile,
      strictUnknown: true,
    });
    assert.equal(evaluation.verdict, "block", `${fixture.profile} should block its fixture`);
    assert.ok(
      evaluation.violations.some((violation) =>
        violation.ruleId === fixture.ruleId &&
        violation.sourcePath === fixture.sourcePath
      ),
      `${fixture.profile} should report ${fixture.ruleId}`
    );
    assert.equal(evaluation.policyWarnings.length, 0);
  }
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, "src", "domain"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "domain", "Order.ts"),
    [
      "import { MissingAdapter } from './MissingAdapter.js';",
      "export const orderAdapter = MissingAdapter;",
      "",
    ].join("\n"),
    "utf-8"
  );
  const evaluation = validateSemanticGovernance({
    workspacePath: root,
    architectureProfile: "ddd",
    strictUnknown: true,
  });
  const unknownFinding = [...evaluation.violations, ...evaluation.warnings].find((finding) =>
    finding.ruleId === "semantic.unknown-layer-requires-review"
  );
  assert.ok(unknownFinding);
  assert.match(unknownFinding.asciiMap, /ST:/);
  assert.match(unknownFinding.asciiMap, /S=src\/domain\/Order.ts/);
  assert.match(unknownFinding.asciiMap, /T=unresolved\/external/);
}

{
  const root = createWorkspace();
  fs.mkdirSync(path.join(root, ".github", "ai-harness"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".github", "ai-harness", "architecture-ontology.policy.json"),
    JSON.stringify(
      {
        schemaVersion: "0.0.0",
        profileId: "not-real",
        layers: [],
        rules: [],
        bypassPolicy: {
          sourceCommentMayOnlyReferenceWaiver: false,
          waiverLedgerRequired: false,
        },
      },
      null,
      2
    ),
    "utf-8"
  );
  fs.mkdirSync(path.join(root, "src", "use-cases"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "infra"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "use-cases", "GetUser.ts"),
    "import { DbClient } from '../infra/DbClient.js';\nexport const getUser = new DbClient();\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(root, "src", "infra", "DbClient.ts"),
    "export class DbClient {}\n",
    "utf-8"
  );

  const evaluation = validateSemanticGovernance({
    workspacePath: root,
    architectureProfile: "clean",
    strictUnknown: true,
  });
  assert.equal(evaluation.verdict, "block");
  assert.ok(evaluation.policyWarnings.some((warning) => /rejected/.test(warning)));
  assert.equal(evaluation.policy.profileId, "clean");
  assert.ok(evaluation.violations.some((violation) =>
    violation.ruleId === "clean.application-must-not-import-infrastructure"
  ));

  const strictPolicyWarnings = runSemanticEnforcement({
    workspacePath: root,
    architectureProfile: "clean",
    enforcementMode: "ci",
    strictUnknown: true,
  });
  assert.equal(strictPolicyWarnings.gate, "fail");
  assert.equal(strictPolicyWarnings.canProceed, false);
  assert.equal(strictPolicyWarnings.metrics.policyWarnings > 0, true);
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
  assert.match(reconciled.userRealityCheck.apiContract.startCommand, /ensure-listening/);
  assert.ok(reconciled.userRealityCheck.nextActionRunway.length > 0);
  assert.ok([
    "/api/harness-dashboard/v1/reality-check",
    "/api/harness-dashboard/v1/traceability",
  ].includes(reconciled.userRealityCheck.nextActionRunway[0].proofRoute));
  assert.equal(reconciled.userRealityCheck.listenerTrustCard.healthRoute, "/api/harness-dashboard/v1/health");
  assert.deepEqual(
    reconciled.userRealityCheck.progressFlow.map((item) => item.stage),
    EXPECTED_USER_REALITY_PROGRESS_STAGES
  );
  assert.ok(reconciled.userRealityCheck.actionPlan[0].evidenceRequired.length > 0);
  assert.equal(validateDashboardStateShape(reconciled).valid, true);
}

{
  const { root } = generateWorkspace();
  const statePath = path.join(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const legacyState = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  delete legacyState.userRealityCheck.progressFlow;
  delete legacyState.userRealityCheck.apiContract.startCommand;
  delete legacyState.userRealityCheck.apiContract.statusCommand;
  fs.writeFileSync(statePath, JSON.stringify(legacyState, null, 2) + "\n", "utf-8");

  const result = reconcileWorkspaceInitialization({
    workspacePath: root,
    workspaceName: "Existing Legacy Reality Check Workspace",
    purpose: "Verify reconcile upgrades existing user-facing dashboard reality checks.",
    applyChanges: true,
    writeMigrationReport: false,
    writeSemanticDiffReport: false,
  });
  assert.equal(result.applied, true);
  const reconciled = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  assert.deepEqual(
    reconciled.userRealityCheck.progressFlow.map((item) => item.stage),
    EXPECTED_USER_REALITY_PROGRESS_STAGES
  );
  assert.match(reconciled.userRealityCheck.apiContract.startCommand, /ensure-listening/);
  assert.match(reconciled.userRealityCheck.apiContract.statusCommand, /dashboard-ops\.mjs status/);
  assert.ok(reconciled.userRealityCheck.nextActionRunway.some((item) => item.actionId === "action.verify-projections"));
  assert.equal(reconciled.userRealityCheck.listenerTrustCard.runtimeRoute, "/api/harness-dashboard/v1/runtime");
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
  const ledgerPath = path.join(root, "docs/ai-harness/dashboard/events/harness-events.jsonl");
  const manifestPath = path.join(root, "docs/ai-harness/dashboard/events/ledger-manifest.json");
  fs.rmSync(ledgerPath, { force: true });
  fs.rmSync(manifestPath, { force: true });

  startHarnessSession({
    workspacePath: root,
    goal: "Recover missing dashboard ledger files",
    originalRequest: "Recover missing dashboard ledger files without losing runtime event trace.",
    processSummary:
      "Created a session after deleting the dashboard event ledger and manifest.",
    resultSummary:
      "Runtime should recreate missing dashboard ledger files and append the session start event.",
    sessionId: "session-ledger-recovery",
    chunkId: "chunk-ledger-recovery",
    queueIfBusy: true,
  });
  advanceHarnessSession({
    workspacePath: root,
    sessionId: "session-ledger-recovery",
    action: "complete",
    actorRole: "planner",
    note: "Ledger recovery plan completed.",
    processSummary:
      "Planner advanced the recovered session to prove appends continue after manifest recreation.",
    resultSummary: "Dashboard ledger recovery preserved the phase advance event.",
  });
  recordHarnessExecutionResult({
    workspacePath: root,
    sessionId: "session-ledger-recovery",
    bridgeId: "codex-cli",
    outcome: "completed",
    summary: "Ledger recovery receipt recorded.",
    processSummary:
      "Worker recorded a receipt after dashboard ledger recovery.",
    resultSummary:
      "Recovered dashboard ledger preserved the execution receipt event.",
  });

  const recoveredManifest = readJson(root, "docs/ai-harness/dashboard/events/ledger-manifest.json");
  const recoveredLines = fs.readFileSync(ledgerPath, "utf-8").trim().split(/\r?\n/);
  assert.equal(recoveredManifest.recoveryStatus, "ledger-and-manifest-recreated-empty");
  assert.equal(recoveredManifest.lastSequence, 3);
  assert.equal(recoveredManifest.rowCount, 3);
  assert.equal(recoveredLines.length, 3);
  assert.match(recoveredLines[0], /harness\.session\.started/);
  assert.match(recoveredLines[1], /harness\.session\.advanced/);
  assert.match(recoveredLines[2], /harness\.execution\.receipt\.recorded/);
  assert.match(recoveredLines[2], /Recovered dashboard ledger preserved the execution receipt event/);
  assert.match(recoveredLines[0], /"previousEventHash":"genesis"/);
  const recoveredState = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
  const recoveredGovernedSession = recoveredState.governedSessions.find((entry) =>
    entry.id === "session-ledger-recovery"
  );
  assert.ok(recoveredGovernedSession);
  assert.ok(recoveredGovernedSession.outputs.some((entry) => /result-receipt\.json$/.test(entry)));
}

{
  const { root } = generateWorkspace();
  const ledgerPath = path.join(root, "docs/ai-harness/dashboard/events/harness-events.jsonl");
  const manifestPath = path.join(root, "docs/ai-harness/dashboard/events/ledger-manifest.json");
  fs.appendFileSync(ledgerPath, "{not valid json}\n", "utf-8");
  fs.rmSync(manifestPath, { force: true });

  startHarnessSession({
    workspacePath: root,
    goal: "Recover corrupt dashboard ledger rows",
    originalRequest: "Recover corrupt dashboard ledger rows without aborting dashboard event append.",
    processSummary:
      "Created a session after corrupting one dashboard ledger row and deleting the manifest.",
    resultSummary:
      "Runtime should quarantine corrupt dashboard ledger rows and append a new session event.",
    sessionId: "session-ledger-corrupt-recovery",
    chunkId: "chunk-ledger-corrupt-recovery",
    queueIfBusy: true,
  });

  const recoveredManifest = readJson(root, "docs/ai-harness/dashboard/events/ledger-manifest.json");
  const recoveredLines = fs.readFileSync(ledgerPath, "utf-8").trim().split(/\r?\n/);
  assert.equal(recoveredManifest.recoveryStatus, "manifest-recovered-from-valid-ledger-rows");
  assert.equal(recoveredManifest.corruptRowCount, 1);
  assert.ok(recoveredManifest.quarantinePath);
  assert.equal(recoveredManifest.lastSequence, 2);
  assert.equal(recoveredLines.length, 2);
  assert.match(recoveredLines[1], /harness\.session\.started/);
  assert.equal(recoveredLines.some((line) => line.includes("{not valid json}")), false);
  const quarantine = readJson(root, recoveredManifest.quarantinePath);
  assert.equal(quarantine.corruptRowCount, 1);
  assert.match(quarantine.rows[0].content, /not valid json/);
}

{
  const { root } = generateWorkspace();
  const ledgerPath = path.join(root, "docs/ai-harness/dashboard/events/harness-events.jsonl");
  fs.appendFileSync(ledgerPath, "{still not valid json}\n", "utf-8");

  startHarnessSession({
    workspacePath: root,
    goal: "Recover corrupt ledger with manifest present",
    originalRequest: "Recover a corrupt dashboard ledger row even when the manifest still exists.",
    processSummary:
      "Created a session after corrupting the dashboard ledger while preserving the manifest.",
    resultSummary:
      "Runtime should quarantine the corrupt row and append after the existing valid bootstrap event.",
    sessionId: "session-ledger-corrupt-present-manifest",
    chunkId: "chunk-ledger-corrupt-present-manifest",
    queueIfBusy: true,
  });

  const recoveredManifest = readJson(root, "docs/ai-harness/dashboard/events/ledger-manifest.json");
  const recoveredLines = fs.readFileSync(ledgerPath, "utf-8").trim().split(/\r?\n/);
  assert.equal(recoveredManifest.recoveryStatus, "manifest-recovered-from-valid-ledger-rows");
  assert.equal(recoveredManifest.corruptRowCount, 1);
  assert.equal(recoveredManifest.lastSequence, 2);
  assert.equal(recoveredLines.length, 2);
  assert.match(recoveredLines[0], /workspace\.dashboard\.bootstrap/);
  assert.match(recoveredLines[1], /harness\.session\.started/);
  assert.equal(recoveredLines.some((line) => line.includes("{still not valid json}")), false);
  const quarantine = readJson(root, recoveredManifest.quarantinePath);
  assert.match(quarantine.rows[0].content, /still not valid json/);
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
  assert.deepEqual(
    dashboardState.userRealityCheck.progressFlow.map((item) => item.stage),
    EXPECTED_USER_REALITY_PROGRESS_STAGES
  );
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
    assert.equal(traceabilityPayload.payload.sessionTraceability.entries[0].traceSource, "recorded-event");
    assert.equal(traceabilityPayload.payload.sessionTraceability.entries[0].traceDebt, false);
    assert.equal(traceabilityPayload.payload.sessionTraceability.entries[0].traceConfidence, "high");
    assert.equal(typeof traceabilityPayload.payload.sessionTraceability.traceDebtCount, "number");
    assert.equal(JSON.stringify(traceabilityPayload.payload).includes(root), false);

    const realityCheckPayload = await fetch(apiUrl("reality-check"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(realityCheckPayload.readOnly, true);
    assert.equal(realityCheckPayload.payload.userRealityCheck.status, "bootstrap-action-plan");
    assert.equal(realityCheckPayload.payload.userRealityCheck.apiContract.route, "/api/harness-dashboard/v1/reality-check");
    assert.ok(realityCheckPayload.payload.userRealityCheck.actionPlan.some((item) => item.id === "action.verify-projections"));
    assert.ok(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief);
    assert.equal(typeof realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.score?.value, "number");
    assert.equal(Array.isArray(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.questions), true);
    assert.ok(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.questions.some((item) => item.question && item.answer));
    assert.ok(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.apiRouteChips.includes("/api/harness-dashboard/v1/reality-check"));
    assert.ok(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.scoreDimensions.some((item) => item.id === "local-api-usefulness"));
    assert.ok(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.evidenceChecks.resolvableRefs.includes("event-000001-bootstrap"));
    assert.ok(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.evidenceChecks.unresolvedRefs.includes("missing.service-health"));
    assert.ok(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.evidenceChecks.unresolvedItems.some((item) => item.id === "missing.first-governed-session-closeout"));
    assert.ok(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.routeContracts.some((item) => item.route === "/api/harness-dashboard/v1/health"));
    assert.ok(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.routeContracts.some((item) =>
      item.route === "/api/harness-dashboard/v1/architecture" &&
      item.expectedPayloadKeys.includes("semanticGovernance")
    ));
    assert.ok(realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.routeContracts.some((item) =>
      item.route === "/api/harness-dashboard/v1/agent-bridge" &&
      item.expectedPayloadKeys.includes("agentCommandBridge")
    ));
    assert.ok(realityCheckPayload.payload.userRealityCheck.nextActionRunway.some((item) =>
      item.actionId === "action.start-local-listener" &&
      item.proofRoute === "/api/harness-dashboard/v1/health" &&
      /raw JSON/.test(item.userQuestion)
    ));
    assert.equal(realityCheckPayload.payload.userRealityCheck.listenerTrustCard.healthRoute, "/api/harness-dashboard/v1/health");
    assert.equal(realityCheckPayload.payload.userRealityCheck.listenerTrustCard.runtimeRoute, "/api/harness-dashboard/v1/runtime");
    for (const contract of realityCheckPayload.payload.userRealityCheck.trustReadinessBrief.routeContracts) {
      const pathAndQuery = contract.route.replace("/api/harness-dashboard/v1/", "");
      const contractPayload = await fetch(apiUrl(pathAndQuery), { headers: authHeaders }).then((response) => response.json());
      assert.equal(contractPayload.readOnly, true);
      for (const key of contract.expectedPayloadKeys) {
        assert.ok(key in contractPayload.payload, `${contract.route} payload should include ${key}`);
      }
    }
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

    for (const ref of [
      "missing.service-health",
      "missing.operations-telemetry",
      "missing.stakeholder-approval",
      "missing.first-governed-session-closeout",
      "missing.live-listener-status",
    ]) {
      const unresolvedPayload = await fetch(apiUrl(`evidence-ref?ref=${encodeURIComponent(ref)}`), { headers: authHeaders }).then((response) => response.json());
      assert.equal(unresolvedPayload.readOnly, true);
      assert.equal(unresolvedPayload.payload.ref, ref);
      assert.equal(unresolvedPayload.payload.resultCount > 0, true);
      assert.ok(unresolvedPayload.payload.results.some((item) => item.recordId === ref || item.text.includes(ref) || item.canonicalPath.includes(ref)));
      assert.equal(JSON.stringify(unresolvedPayload.payload).includes(root), false);
    }

    const traceabilityQuery = await fetch(apiUrl("query?scope=traceability&q=originalRequest"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(traceabilityQuery.readOnly, true);
    assert.equal(traceabilityQuery.payload.resultCount > 0, true);
    assert.ok(traceabilityQuery.payload.indexSummary.candidateCount > 0);
    assert.ok(traceabilityQuery.payload.results[0].matchQuality);

    const traceSourceQuery = await fetch(apiUrl("query?scope=traceability&q=recorded-event"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(traceSourceQuery.readOnly, true);
    assert.equal(traceSourceQuery.payload.resultCount > 0, true);
    assert.ok(traceSourceQuery.payload.results.some((item) => item.sourcePath === "sessionTraceability.entries"));

    const realityCheckQuery = await fetch(apiUrl("query?scope=reality-check&q=verify-projections"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(realityCheckQuery.readOnly, true);
    assert.equal(realityCheckQuery.payload.resultCount > 0, true);
    assert.ok(realityCheckQuery.payload.results.every((item) => item.sourcePath && item.text));
    assert.equal(JSON.stringify(realityCheckQuery.payload).includes(root), false);

    const runwayQuery = await fetch(apiUrl("query?scope=reality-check&q=Turn%20proof%20chips"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(runwayQuery.readOnly, true);
    assert.equal(runwayQuery.payload.resultCount > 0, true);
    assert.ok(runwayQuery.payload.results.some((item) => item.sourcePath === "userRealityCheck.nextActionRunway"));

    const listenerTrustQuery = await fetch(apiUrl("query?scope=reality-check&q=listener-required"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(listenerTrustQuery.readOnly, true);
    assert.equal(listenerTrustQuery.payload.resultCount > 0, true);
    assert.ok(listenerTrustQuery.payload.results.some((item) => item.sourcePath === "userRealityCheck.listenerTrustCard"));

    const userPerspectiveAuditQuery = await fetch(apiUrl("query?scope=reality-check&q=userPerspectiveAudit"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(userPerspectiveAuditQuery.readOnly, true);
    assert.equal(userPerspectiveAuditQuery.payload.resultCount > 0, true);
    assert.ok(userPerspectiveAuditQuery.payload.results.some((item) =>
      item.sourcePath === "dashboardQualityScorecard.userPerspectiveAudit" ||
      item.sourcePath === "dashboardQualityScorecard.userPerspectiveAudit.dimensions"
    ));
    assert.ok(userPerspectiveAuditQuery.payload.indexSummary.sources.includes("dashboardQualityScorecard.userPerspectiveAudit"));

    const architecturePayload = await fetch(apiUrl("architecture"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(architecturePayload.readOnly, true);
    assert.ok(architecturePayload.capabilities.includes("architecture"));
    assert.ok(architecturePayload.payload.semanticGovernance.profileId);
    assert.ok(architecturePayload.payload.semanticGovernance.visualGraph.nodes.length > 0);
    assert.ok(architecturePayload.payload.agentCommandBridge.suggestedCommands.length >= 3);

    const agentBridgePayload = await fetch(apiUrl("agent-bridge"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(agentBridgePayload.readOnly, true);
    assert.ok(agentBridgePayload.capabilities.includes("agent-bridge"));
    assert.equal(agentBridgePayload.payload.agentCommandBridge.status, "draft-only-read-only");
    assert.equal(agentBridgePayload.payload.agentCommandBridge.dashboardDoesNotRunTools, true);
    assert.ok(agentBridgePayload.payload.agentCommandBridge.sseFeedbackLoop.events.includes("harness.changed"));

    const architectureQuery = await fetch(apiUrl("query?scope=architecture&q=waiver"), { headers: authHeaders }).then((response) => response.json());
    assert.equal(architectureQuery.readOnly, true);
    assert.equal(architectureQuery.payload.resultCount > 0, true);
    assert.ok(architectureQuery.payload.results.some((item) => item.sourcePath.includes("semanticGovernance") || item.sourcePath.includes("agentCommandBridge")));

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
    const trailingSlashSnapshotEvent = await waitForSseEvent(
      `http://127.0.0.1:${port}/api/harness-dashboard/v1/events/?token=${token}`,
      "harness.snapshot"
    );
    assert.equal(trailingSlashSnapshotEvent.includes("task-bootstrap-refresh-projections"), false);
    const changedEventPromise = waitForSseEvent(
      `http://127.0.0.1:${port}/api/harness-dashboard/v1/events?token=${token}`,
      "harness.changed",
      2500
    );
    await delay(160);
    const liveState = readJson(root, "docs/ai-harness/dashboard/state/dashboard-state.json");
    liveState.meta.sourceEventSequence = Number(liveState.meta.sourceEventSequence || 0) + 1;
    liveState.meta.generatedAt = "sse-immediate-test";
    const tempStatePath = path.join(path.dirname(statePath), ".dashboard-state.json.sse-test.tmp");
    fs.writeFileSync(tempStatePath, JSON.stringify(liveState, null, 2) + "\n", "utf-8");
    fs.renameSync(tempStatePath, statePath);
    const changedEvent = await changedEventPromise;
    assert.match(changedEvent, /harness.changed/);
    assert.match(changedEvent, /sse-immediate-test/);
    assert.match(changedEvent, /fs\.watch|heartbeat-hash-check/);
    const rejectedTrailingSlashSse = await fetch(apiUrl(`events/?token=bad-token`));
    assert.equal(rejectedTrailingSlashSse.status, 401);
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
