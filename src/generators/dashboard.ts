import crypto from "node:crypto";
import {
  type GeneratedFile,
  type WorkspaceInitParams,
} from "../types.js";
import { DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS } from "../data/dashboard-state-contract.js";
import {
  getDashboardKpiProfile,
  getRequiredDashboardKpis,
  inferDashboardDomainMode,
} from "../data/dashboard-profiles.js";
import {
  buildCustomDomainStressDefinition,
  DOMAIN_STRESS_DEFINITIONS,
  matchesDomainStressDefinition,
  toDomainStressProfileId,
  type DomainStressDefinition,
} from "../data/domain-stress-profiles.js";
import {
  DASHBOARD_API_VERSION,
  DASHBOARD_PROJECTION_VERSION,
  DASHBOARD_SCHEMA_VERSION,
} from "../data/version.js";

const BOOTSTRAP_SEQUENCE = 1;
const BOOTSTRAP_TIME = "bootstrap";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  );
}

function stableHash(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeInlineJson(value: string): string {
  return value.replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function buildWorkspaceId(params: WorkspaceInitParams): string {
  return `workspace-${slugify(params.workspaceName)}-${stableHash({
    name: params.workspaceName,
    path: params.workspacePath,
  }).slice(0, 10)}`;
}

function buildProjectWorldModel(params: WorkspaceInitParams, workspaceId: string) {
  const projectType = params.projectType ?? "other";
  const primaryDomains = params.primaryDomains?.length
    ? params.primaryDomains
    : [projectType];
  const serviceId = `${slugify(params.workspaceName)}-primary-service`;

  return {
    id: workspaceId,
    mission: {
      statement: params.purpose,
      serviceLifecycleMode: projectType === "api" || projectType === "saas" || projectType === "web-app"
        ? "active-development"
        : "greenfield",
      successDefinition:
        "Stakeholders and AI Agents can understand the current project world, resume work safely, and trace every status claim to durable evidence.",
    },
    stakeholders: [
      {
        id: "stakeholder-product-owner",
        label: "Product Owner",
        role: "decision-owner",
        informationNeed:
          "Understand what changed, what is blocked, what needs approval, and what evidence supports the current state.",
      },
      {
        id: "stakeholder-ai-agent",
        label: "AI Agent",
        role: "operator",
        informationNeed:
          "Resume the next safe action from authoritative files, validation commands, open decisions, and current risks.",
      },
      {
        id: "stakeholder-maintainer",
        label: "Maintainer",
        role: "service-owner",
        informationNeed:
          "Inspect service lifecycle, environments, releases, incidents, dependencies, and version-control evidence.",
      },
    ],
    products: [
      {
        id: `${slugify(params.workspaceName)}-product`,
        label: params.workspaceName,
        status: "foundation",
        purpose: params.purpose,
      },
    ],
    services: [
      {
        id: serviceId,
        label: params.workspaceName,
        lifecycleState: "scaffolded",
        serviceCreationContractId: "service-creation-primary",
        runningServiceContractId: "running-service-primary",
      },
    ],
    environments: ["local", "dev", "test", "staging", "production"].map((environment) => ({
      id: `env-${environment}`,
      label: environment,
      status: environment === "local" ? "planned" : "unknown",
      accountOrProject: "TBD",
      region: "TBD",
      urls: [],
      runtime: params.techStack ?? [],
      dependencies: [],
      databases: [],
      queues: [],
      storage: [],
      featureFlags: [],
      secretRefs: [],
      observabilityLinks: [],
      secretPolicy: "Secret names or references only; never store secret values.",
    })),
    repos: [
      {
        id: "repo-primary",
        provider: "git-or-svn",
        root: ".",
        status: "assessment-required",
      },
    ],
    dataAssets: [],
    dependencies: [
      {
        id: "dependency-harness-dashboard",
        from: serviceId,
        to: "harness-dashboard",
        kind: "harness-component",
        criticality: "required",
        status: "planned",
      },
    ],
    risks: [
      {
        id: "risk-bootstrap-placeholder",
        summary:
          "The generated world model is a bootstrap projection and needs project-specific evidence before operational claims are trusted.",
        status: "open",
        severity: "medium",
        owner: "harness-dashboard-operator",
      },
    ],
    decisions: [
      {
        id: "decision-dashboard-world-model",
        status: "approved",
        summary:
          "Use the Harness Dashboard as the canonical Project World Model projection.",
        evidenceRefs: ["event-000001-bootstrap"],
      },
    ],
    cadence: {
      iteration: "bootstrap",
      review: "not-started",
      retro: "not-started",
      definitionOfReady: [
        "Goal is clear",
        "Stakeholder decision owner is known",
        "Expected write paths and verification commands are identified",
      ],
      definitionOfDone: [
        "Evidence is linked",
        "Validation is recorded",
        "Dashboard projections are refreshed",
        "Next AI Agent action is explicit",
      ],
    },
    metrics: [
      {
        id: "world-model-completeness",
        label: "World Model Completeness",
        value: "bootstrap",
        target:
          "Services mapped, owners assigned, environments known, evidence linked, decisions current, risks reviewed.",
      },
    ],
    constraints: [
      "The event ledger is canonical; dashboard state and HTML are projections.",
      "Local listener APIs are read-only and loopback-only by default.",
      "UI inputs are local view controls unless an explicit future persisted feedback flow is approved.",
    ],
    primaryDomains,
  };
}

const AGENT_PLATFORM_CATALOG = [
  {
    id: "vscode",
    label: "VS Code / GitHub Copilot",
    instructionPaths: [".github/copilot-instructions.md", ".vscode/mcp.json"],
    governanceRole: "Copilot Agent mode and MCP-aware editor workflows",
  },
  {
    id: "codex",
    label: "Codex CLI / Codex Desktop",
    instructionPaths: ["AGENTS.md", ".codex/"],
    governanceRole: "Codex-oriented hub, review, and resume instructions",
  },
  {
    id: "claude-code",
    label: "Claude Code",
    instructionPaths: ["CLAUDE.md", ".claude/"],
    governanceRole: "Claude project memory and MCP resume behavior",
  },
  {
    id: "cursor",
    label: "Cursor",
    instructionPaths: [".cursor/rules/harness-world-model.mdc", ".cursorrules"],
    governanceRole: "Cursor rule-based agent collaboration",
  },
  {
    id: "antigravity",
    label: "Google Antigravity / Gemini Agent IDE",
    instructionPaths: [
      ".agents/plugins/workspace-init-harness/plugin.json",
      ".agents/plugins/workspace-init-harness/rules/harness-world-model.md",
    ],
    governanceRole: "Antigravity plugin/rule governance overlay",
  },
  {
    id: "openhands",
    label: "OpenHands",
    instructionPaths: [".openhands/", ".agents/skills/"],
    governanceRole: "OpenHands-compatible agent skill and memory conventions",
  },
] as const;

function normalizeAgentPlatform(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "claude") {
    return "claude-code";
  }
  if (normalized === "copilot" || normalized === "github-copilot") {
    return "vscode";
  }
  if (normalized === "gemini" || normalized === "google-antigravity") {
    return "antigravity";
  }
  return normalized;
}

function uniqueAgentPlatforms(values: readonly string[] | undefined): string[] {
  const allowed = new Set(AGENT_PLATFORM_CATALOG.map((platform) => platform.id));
  const normalized = (values ?? ["vscode"])
    .map((value) => normalizeAgentPlatform(String(value)))
    .filter((value) => allowed.has(value as (typeof AGENT_PLATFORM_CATALOG)[number]["id"]));
  return Array.from(new Set(normalized.length > 0 ? normalized : ["vscode"]));
}

function buildAgentPlatformGovernance(params: WorkspaceInitParams) {
  const detectedPlatforms = uniqueAgentPlatforms(params.targetIDEs);
  const activePlatforms = detectedPlatforms;
  const activeSet = new Set(activePlatforms);
  const instructionState = AGENT_PLATFORM_CATALOG.map((platform) => {
    const active = activeSet.has(platform.id);
    return {
      platform: platform.id,
      label: platform.label,
      instructionPaths: platform.instructionPaths,
      governanceRole: platform.governanceRole,
      state: active ? "active-instruction" : "not-generated",
      source: active ? "initialize_workspace targetIDEs or auto-detection" : "platform catalog",
      confidence: active ? "medium" : "low",
      reason: active
        ? "The platform is part of the current generated instruction surface. Ask the user to confirm it if detection came from repository signals."
        : "No active declaration exists. If stale instruction files are later found for this platform, record it as unused-instruction.",
    };
  });
  const activeInstructionPaths = instructionState
    .filter((item) => activeSet.has(item.platform))
    .flatMap((item) => item.instructionPaths);
  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    status: "awaiting-user-declaration",
    prompt:
      "Confirm which AI agent platforms are actively used in this project so harness instructions, skills, and governance indexing match the real workflow.",
    detectedPlatforms,
    declaredPlatforms: [],
    activePlatforms,
    platformOptions: AGENT_PLATFORM_CATALOG,
    instructionState,
    unusedInstructionState: instructionState.filter((item) => item.state === "unused-instruction"),
    intake: {
      status: "awaiting-user-declaration",
      source: "bootstrap",
      submittedAt: null,
      submittedBy: null,
      readOnlyDashboardRule:
        "Dashboard controls do not write by themselves. Use the generated record-agent-platforms command to persist the declaration into the ledger and projections.",
      commandTemplate:
        "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs record-agent-platforms --platforms codex,cursor --source dashboard-intake",
    },
    governanceIndexing: {
      factId: "fact-agent-platform-selection",
      decisionId: "decision-agent-platform-selection",
      actionId: "governance.agent-platform-declaration",
      evidenceRefs: activeInstructionPaths,
      indexedAs: "inferred until user declaration is recorded",
      nextAction:
        "Ask the user to confirm the active platforms. Then run record-agent-platforms so unused instruction files can be marked and active instructions can be indexed.",
    },
  };
}

function buildAudienceLensContract() {
  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    defaultMode: "stakeholder",
    principle:
      "All audience modes use the same ledger-backed truth, but each mode changes vocabulary, tab labels, first-panel priority, information density, and reporting affordances.",
    modes: {
      stakeholder: {
        label: "Stakeholder",
        primaryQuestion:
          "What changed, how complete is the work, what remains, what is blocked, and what decision is needed?",
        density: "briefing",
        tabLabels: {
          Overview: "Briefing",
          Work: "Delivery",
          Evidence: "Proof",
          Governance: "Decisions",
          System: "Operations",
          TechStack: "Stack",
        },
        firstPanels: [
          "stakeholder-report",
          "open-work-progress",
          "decision-risk-pulse",
          "slideshow",
        ],
        slideshowEnabled: true,
      },
      agent: {
        label: "AI Agent",
        primaryQuestion:
          "What is the next safest action, what files are authoritative, what assumptions are forbidden, and what validation is required?",
        density: "operator",
        tabLabels: {
          Overview: "Resume",
          Work: "Work Plan",
          Evidence: "Proof Map",
          Governance: "Contracts",
          System: "Runtime",
          TechStack: "Architecture",
        },
        firstPanels: [
          "agent-resume-brief",
          "validation-commands",
          "authoritative-files",
          "agent-platform-governance",
        ],
        slideshowEnabled: false,
      },
      maintainer: {
        label: "Maintainer",
        primaryQuestion:
          "What is operationally safe, what release/data/incident evidence is missing, and what system surfaces need attention?",
        density: "technical",
        tabLabels: {
          Overview: "Health",
          Work: "Ops Work",
          Evidence: "Traceability",
          Governance: "Gates",
          System: "Topology",
          TechStack: "Infra Stack",
        },
        firstPanels: [
          "operations-readiness",
          "service-topology",
          "release-incident-data",
          "listener-health",
        ],
        slideshowEnabled: true,
      },
    },
    slideshow: {
      enabled: true,
      mode: "stakeholder",
      implementation:
        "Built-in no-CDN swiper-style slide deck using CSS transforms, keyboard controls, and the Fullscreen API.",
      slideTypes: [
        "executive-summary",
        "work-progress",
        "timeline-kpi",
        "risk-decision",
        "next-actions",
      ],
      visualSystem: [
        "CSS 3D world prism",
        "progress bars",
        "status rails",
        "large metric tiles",
        "table alternatives",
      ],
      readOnly: true,
    },
  };
}

function buildServiceContracts(params: WorkspaceInitParams) {
  return {
    serviceCreationContract: {
      id: "service-creation-primary",
      businessReason: params.purpose,
      targetUsers: ["TBD"],
      interfaceIntent:
        "Define APIs, UI routes, CLI commands, or integration contracts before broad implementation.",
      dataOwnership: "TBD",
      operationalOwner: "TBD",
      deploymentTarget: "TBD",
      observabilityBaseline: [
        "health endpoint",
        "logs",
        "metrics",
        "trace correlation",
        "runbook",
      ],
      acceptanceCriteria: [
        "Discovery approved",
        "Design approved",
        "Build accepted",
        "Verification passed",
        "Release approved",
        "Operation accepted",
      ],
      readinessGates: {
        discoveryApproved: false,
        designApproved: false,
        buildAccepted: false,
        verificationPassed: false,
        releaseApproved: false,
        operationAccepted: false,
      },
    },
    runningServiceContract: {
      id: "running-service-primary",
      health: {
        status: "not-connected",
        healthEndpoint: "TBD",
        lastObservedAt: "bootstrap",
      },
      sloSla: {
        availability: "TBD",
        latency: "TBD",
        errorRate: "TBD",
        saturation: "TBD",
        freshness: "TBD",
      },
      incidents: [],
      dependencies: [],
      configSurface: [],
      releaseVersion: "TBD",
      rollbackPath: "TBD",
      runbookLink: "TBD",
      knownRisks: ["Bootstrap state has not been connected to real operations evidence."],
      databaseOperations: {
        schemaVersion: "TBD",
        migrationStatus: "not-connected",
        pendingMigrations: [],
        backupFreshness: "unknown",
        restoreDrillEvidence: [],
        seedDataState: "unknown",
        connectionPoolStatus: "unknown",
        retentionPolicy: "TBD",
        driftWarnings: [],
      },
    },
  };
}

function buildRealityModel(
  params: WorkspaceInitParams,
  workspaceId: string,
  projectWorldModel: ReturnType<typeof buildProjectWorldModel>
) {
  const serviceId = projectWorldModel.services[0].id;
  const productId = projectWorldModel.products[0].id;
  const environmentNodes = projectWorldModel.environments.map((environment) => ({
    id: environment.id,
    label: environment.label,
    type: "environment",
    state: environment.status,
    confidence: environment.status === "unknown" ? "low" : "medium",
    owner: environment.status === "unknown" ? "maintainer" : "harness-dashboard-operator",
    evidenceRefs: ["projectWorldModel.environments"],
    freshness: "bootstrap",
  }));

  const nodes = [
    {
      id: workspaceId,
      label: params.workspaceName,
      type: "workspace",
      state: "declared",
      confidence: "medium",
      owner: "stakeholder-product-owner",
      evidenceRefs: ["event-000001-bootstrap"],
      freshness: "until-first-session",
    },
    {
      id: productId,
      label: params.workspaceName,
      type: "product-or-work-output",
      state: "declared",
      confidence: "medium",
      owner: "stakeholder-product-owner",
      evidenceRefs: ["projectWorldModel.products"],
      freshness: "until-product-intake",
    },
    {
      id: "repo-primary",
      label: "Primary workspace repository",
      type: "repository",
      state: "assessment-required",
      confidence: "low",
      owner: "maintainer",
      evidenceRefs: ["versionControl.collectionProvenance"],
      freshness: "until-vcs-refresh",
    },
    {
      id: serviceId,
      label: params.workspaceName,
      type: "service-or-work-system",
      state: "scaffolded",
      confidence: "medium",
      owner: "maintainer",
      evidenceRefs: ["serviceRegistry", "runningServiceContract"],
      freshness: "until-service-evidence",
    },
    {
      id: "harness-dashboard",
      label: "Project World Model projection",
      type: "harness-surface",
      state: "generated",
      confidence: "high",
      owner: "harness-dashboard-operator",
      evidenceRefs: ["docs/ai-harness/dashboard/index.html"],
      freshness: "after-next-refresh",
    },
    {
      id: "context-ledger",
      label: "Durable context ledger",
      type: "memory-ledger",
      state: "generated",
      confidence: "medium",
      owner: "harness-memory-curator",
      evidenceRefs: ["docs/context/README.md", "docs/context/context-index.md"],
      freshness: "until-first-real-context-update",
    },
    ...environmentNodes,
  ];

  const edges = [
    {
      id: "edge-workspace-governs-product",
      from: workspaceId,
      to: productId,
      relation: "governs-purpose",
      status: "declared",
      confidence: "medium",
      owner: "stakeholder-product-owner",
      evidenceRefs: ["workspace.purpose"],
      freshness: "until-first-session",
    },
    {
      id: "edge-product-realized-by-service",
      from: productId,
      to: serviceId,
      relation: "realized-by",
      status: "declared",
      confidence: "medium",
      owner: "maintainer",
      evidenceRefs: ["projectWorldModel.services"],
      freshness: "until-service-evidence",
    },
    {
      id: "edge-repo-contains-service",
      from: "repo-primary",
      to: serviceId,
      relation: "contains-or-documents",
      status: "assessment-required",
      confidence: "low",
      owner: "maintainer",
      evidenceRefs: ["versionControl"],
      freshness: "until-vcs-refresh",
    },
    {
      id: "edge-dashboard-projects-world",
      from: "harness-dashboard",
      to: workspaceId,
      relation: "projects-world-model",
      status: "supported",
      confidence: "high",
      owner: "harness-dashboard-operator",
      evidenceRefs: [
        "docs/ai-harness/dashboard/events/harness-events.jsonl",
        "docs/ai-harness/dashboard/state/dashboard-state.json",
      ],
      freshness: "after-next-refresh",
    },
    {
      id: "edge-context-stabilizes-goal",
      from: "context-ledger",
      to: workspaceId,
      relation: "stabilizes-context",
      status: "generated",
      confidence: "medium",
      owner: "harness-memory-curator",
      evidenceRefs: ["docs/context/context-index.md"],
      freshness: "until-first-real-context-update",
    },
    ...projectWorldModel.environments.map((environment) => ({
      id: `edge-service-targets-${environment.id}`,
      from: serviceId,
      to: environment.id,
      relation: "targets-environment",
      status: environment.status === "unknown" ? "unknown" : "planned",
      confidence: environment.status === "unknown" ? "low" : "medium",
      owner: "maintainer",
      evidenceRefs: ["projectWorldModel.environments"],
      freshness: "until-environment-evidence",
    })),
  ];

  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    purpose:
      "Map the project as a real work system: people, goals, repositories, services, environments, data surfaces, external dependencies, evidence, and freshness.",
    stateClasses: ["observed", "declared", "planned", "unknown", "stale"],
    canonicalNodeTypes: [
      "workspace",
      "product-or-work-output",
      "repository",
      "service-or-work-system",
      "environment",
      "data-surface",
      "external-system",
      "human-owner",
      "memory-ledger",
      "harness-surface",
    ],
    nodes,
    edges,
    missingRelationEvidence: [
      {
        id: "missing.real-repository-linkage",
        label: "Repository-to-work-system linkage",
        relation: "repo-primary contains-or-documents primary service/work system",
        owner: "maintainer",
        requiredEvidenceType: "VCS refresh plus linked service or project artifact paths",
        nextActionRef: "missing.vcs-task-links",
      },
      {
        id: "missing.real-environment-topology",
        label: "Environment topology evidence",
        relation: "primary service/work system targets real execution environments",
        owner: "maintainer",
        requiredEvidenceType: "environment URLs, accounts, deployment target, or not-applicable decision",
        nextActionRef: "missing.deployment-target",
      },
    ],
    updateRule:
      "Every new real-world relationship must name owner, status, evidenceRefs, confidence, freshness, and a reversal condition when it affects decisions.",
  };
}

function buildGoalCompass(params: WorkspaceInitParams, domainStress: ReturnType<typeof buildDomainStressState>) {
  const domainGate =
    domainStress.activeProfileIds.length > 0
      ? `Resolve active domain stress gates for ${domainStress.activeProfileIds.join(", ")}.`
      : "Open the first governed session and connect real evidence.";

  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    purpose:
      "Keep humans and AI Agents oriented from current reality to goal state without relying on chat history.",
    currentReality:
      "Bootstrap harness is installed; real project evidence, active platform declaration, service/runtime state, and VCS linkage still need confirmation.",
    goalState:
      "A future Agent can resume from durable reality, goal, evidence, decisions, risks, owners, and next actions without reconstructing hidden context.",
    northStar: params.purpose,
    goalGraph: [
      {
        id: "mission",
        parentId: null,
        type: "mission",
        statement: params.purpose,
        status: "declared",
        owner: "stakeholder-product-owner",
        evidenceRefs: ["workspace.purpose", "event-000001-bootstrap"],
      },
      {
        id: "strategic.world-model-continuity",
        parentId: "mission",
        type: "strategic-goal",
        statement:
          "Maintain a truthful Project World Model with reality relationships, evidence, decisions, and next safe action.",
        status: "active",
        owner: "harness-dashboard-operator",
        evidenceRefs: ["worldModelImprovementContract", "realityModel"],
      },
      {
        id: "session.first-governed-goal",
        parentId: "strategic.world-model-continuity",
        type: "session-goal",
        statement: "Confirm the first governed goal and service/work lifecycle mode.",
        status: "pending-decision",
        owner: "stakeholder-product-owner",
        evidenceRefs: ["decision-first-governed-goal"],
      },
    ],
    topGaps: [
      {
        id: "gap.first-governed-goal",
        label: "First governed goal is not frozen",
        status: "open",
        blocks: ["ready-to-build", "claim.agent.safe-resume"],
        owner: "stakeholder-product-owner",
        evidenceNeeded: ["approved first governed goal", "service/work lifecycle mode"],
        nextActionRef: "decision-first-governed-goal",
      },
      {
        id: "gap.real-world-topology",
        label: "Physical/project relationship map is still bootstrap-level",
        status: "open",
        blocks: ["claim.service.operational-readiness", "claim.data.integrity"],
        owner: "maintainer",
        evidenceNeeded: ["repository/service linkage", "environment topology", "data-surface decision"],
        nextActionRef: "missing.real-environment-topology",
      },
      {
        id: "gap.evidence-linkage",
        label: "VCS, service, release, data, and operations evidence are not linked",
        status: "open",
        blocks: ["ready-to-release", "ready-to-operate", "ready-to-handoff"],
        owner: "harness-dashboard-operator",
        evidenceNeeded: ["VCS refresh", "validation records", "release and operations evidence"],
        nextActionRef: "missing.vcs-task-links",
      },
    ],
    nextSafeMove: domainGate,
    phaseGate: {
      id: "gate.goal-alignment.before-implementation",
      status: "blocked-for-application-change",
      thresholdScore: 9.8,
      canPlan: true,
      canImplementApplicationChange: false,
      goalTraceRequired: true,
      rotWarningsBlockImplementation: true,
      staleRequiredFactsBlockCloseout: true,
      requiredChecks: [
        "Chunk goal traces to an existing goalCompass.goalGraph id.",
        "Open critical contextRotMonitor warnings are resolved, waived, or marked not-applicable with evidence.",
        "Top gap blockers are either outside the chunk scope or explicitly carried into the chunk contract.",
        "Newly learned facts update contextRotMonitor.factRecords or a linked governed artifact.",
      ],
      failurePolicy:
        "Fail closed: planning and evidence collection may continue, but application-source implementation waits until goal trace and critical context-rot checks pass.",
    },
    forbiddenDrift: [
      "Do not optimize a local task while the parent mission or first governed goal is unresolved.",
      "Do not treat declared or tacit context as observed reality without evidence and owner.",
      "Do not close a session without updating realityModel, goalCompass, or contextRotMonitor when new facts were learned.",
    ],
    alignmentChecks: [
      "Session goal names a parent goal in goalGraph.",
      "Chunk goal has expected write paths and verification commands.",
      "Evidence gaps are visible before readiness scores rise.",
      "Next safe move is specific enough for a new Agent to start without chat history.",
    ],
  };
}

function buildContextRotMonitor(
  domainStress: ReturnType<typeof buildDomainStressState>
) {
  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    status: "watching",
    purpose:
      "Detect stale, contradictory, projection-only, or missing context before an Agent drifts away from the real goal.",
    rotWarnings: [
      {
        id: "rot.bootstrap-expiry",
        severity: "warning",
        status: "open",
        summary: "Bootstrap context expires after the first real governed session or service evidence update.",
        owner: "harness-dashboard-operator",
        evidenceRefs: ["agentResumeBrief.staleStateWarning"],
        nextAction: "Run verify-projections, refresh, then start or resume a governed session.",
        openedAt: BOOTSTRAP_TIME,
        expiresAt: "after-first-governed-session",
        blocksImplementation: false,
      },
      {
        id: "rot.unconfirmed-platforms",
        severity: "warning",
        status: "open",
        summary: "AI platform instructions remain inferred until the user records the active platform set.",
        owner: "stakeholder-product-owner",
        evidenceRefs: ["agentPlatformGovernance"],
        nextAction: "Record active platforms with dashboard-ops.mjs record-agent-platforms.",
        openedAt: BOOTSTRAP_TIME,
        expiresAt: "after-agent-platform-declaration",
        blocksImplementation: false,
      },
      ...domainStress.activeProfileIds.map((profileId) => ({
        id: `rot.domain-stress.${profileId}`,
        severity: "critical",
        status: "open",
        summary: `Domain stress profile ${profileId} has unresolved mandatory evidence gates.`,
        owner: "domain-orchestrator",
        evidenceRefs: ["domainStress", "claimEvidenceMatrix.missingEvidenceItems"],
        nextAction: "Resolve, waive, or mark not-applicable each mandatory evidence gate with a durable artifact.",
        openedAt: BOOTSTRAP_TIME,
        expiresAt: "before-domain-readiness-claim",
        blocksImplementation: true,
      })),
    ],
    factRecords: [
      {
        id: "fact-bootstrap-purpose",
        status: "declared",
        owner: "stakeholder-product-owner",
        lastVerifiedAt: BOOTSTRAP_TIME,
        ttl: "until-first-governed-session",
        evidenceRef: "workspace.purpose",
        reversalCondition: "Stakeholder changes the mission, lifecycle mode, or product boundary.",
        relatedGoalRef: "mission",
        relatedRealityRef: "workspace",
      },
      {
        id: "fact-agent-platforms-inferred",
        status: "declared",
        owner: "harness-dashboard-operator",
        lastVerifiedAt: BOOTSTRAP_TIME,
        ttl: "until-agent-platform-declaration",
        evidenceRef: "agentPlatformGovernance",
        reversalCondition: "User records active AI platforms or marks generated platform overlays unused.",
        relatedGoalRef: "strategic.world-model-continuity",
        relatedRealityRef: "harness-dashboard",
      },
      {
        id: "fact-real-topology-bootstrap",
        status: "planned",
        owner: "maintainer",
        lastVerifiedAt: BOOTSTRAP_TIME,
        ttl: "until-first-vcs-and-service-refresh",
        evidenceRef: "realityModel",
        reversalCondition: "Repository, service, environment, data, or external-system evidence updates the topology.",
        relatedGoalRef: "strategic.world-model-continuity",
        relatedRealityRef: "repo-primary",
      },
    ],
    expiredFacts: ["fact-bootstrap-purpose"],
    contradictionRisks: [
      "Dashboard projection may claim orientation readiness while VCS evidence is still uncollected.",
      "Declared platform instructions may not match the AI tools actually used by the project.",
      "A service/work system can appear scaffolded while no real environment, owner, or health evidence exists.",
    ],
    staleProjectionPolicy:
      "If dashboard-state.json, dashboard-index.json, runtime state, or handoff artifacts disagree, trust ledger-backed events and refresh projections before continuing.",
    contextLedger: {
      canonicalPath: "docs/context/context-index.md",
      requiredFactFields: [
        "id",
        "status",
        "owner",
        "lastVerifiedAt",
        "ttl",
        "evidenceRef",
        "reversalCondition",
      ],
    },
    nextEvidenceToCollect: [
      "active AI platform declaration",
      "first governed goal and lifecycle mode",
      "VCS refresh and dirty/unlinked change classification",
      "service/work-system owner and real environment evidence",
      "domain stress evidence gates when a profile is active",
    ],
  };
}

function buildHarnessEvaluation(
  sourceStateHash: string,
  realityModel: ReturnType<typeof buildRealityModel>,
  goalCompass: ReturnType<typeof buildGoalCompass>,
  contextRotMonitor: ReturnType<typeof buildContextRotMonitor>
) {
  const openCriticalWarnings = contextRotMonitor.rotWarnings.filter(
    (warning) =>
      warning.severity === "critical" &&
      warning.status === "open" &&
      warning.blocksImplementation
  ).length;
  const metricThreshold = 9.8;
  const metrics = [
    {
      id: "reality-graph-integrity",
      label: "Reality graph integrity",
      status: "pass",
      score: 9.9,
      thresholdScore: metricThreshold,
      evidenceRefs: ["realityModel.nodes", "realityModel.edges", "realityModel.missingRelationEvidence"],
      failClosedRule:
        "Projection validation fails when a reality edge points at a missing node or a relationship lacks owner, confidence, freshness, or evidence.",
    },
    {
      id: "goal-trace-gate",
      label: "Goal trace gate",
      status: "needs-runtime-evidence",
      score: 8.8,
      thresholdScore: metricThreshold,
      evidenceRefs: ["goalCompass.goalGraph", "goalCompass.phaseGate", "goalCompass.topGaps"],
      failClosedRule:
        "Application-source implementation is blocked when a chunk goal cannot trace to goalCompass.goalGraph.",
    },
    {
      id: "context-rot-gate",
      label: "Context rot gate",
      status: openCriticalWarnings > 0 ? "blocked" : "needs-runtime-evidence",
      score: openCriticalWarnings > 0 ? 8.4 : 8.9,
      thresholdScore: metricThreshold,
      evidenceRefs: ["contextRotMonitor.rotWarnings", "contextRotMonitor.factRecords"],
      failClosedRule:
        "Open critical context-rot warnings block implementation and stale required facts block closeout.",
    },
    {
      id: "evaluation-artifact",
      label: "Deterministic evaluation artifact",
      status: "needs-evidence",
      score: 8.7,
      thresholdScore: metricThreshold,
      evidenceRefs: [
        "docs/ai-harness/dashboard/evaluations/harness-evaluation.json",
        "dashboard-ops.mjs verify-projections",
      ],
      failClosedRule:
        "A score at or above threshold is invalid unless every metric is pass and the sourceStateHash is recorded.",
    },
  ];

  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    scope: "bootstrap-harness-contract",
    status: "needs-evidence",
    score: 8.9,
    thresholdScore: metricThreshold,
    sourceStateHash,
    evaluatedAt: BOOTSTRAP_TIME,
    evaluator: "workspace-init-mcp deterministic harness evaluator",
    scoreMeaning:
      "This is the harness contract score target for reality/goal/context enforcement. Bootstrap starts below 9.8 until current validation, runtime evidence, browser QA, and critical context-rot gates prove the contract.",
    gates: {
      goalTraceRequired: goalCompass.phaseGate.goalTraceRequired,
      criticalRotBlocksImplementation: goalCompass.phaseGate.rotWarningsBlockImplementation,
      staleFactsBlockCloseout: goalCompass.phaseGate.staleRequiredFactsBlockCloseout,
      brokenRealityRefsBlockProjection: true,
      openCriticalWarningCount: openCriticalWarnings,
      canImplementApplicationChange: goalCompass.phaseGate.canImplementApplicationChange,
    },
    metrics,
    regressionChecks: [
      "Broken realityModel edge references fail validation.",
      "Dangling goalGraph parent references fail validation.",
      "Open critical contextRotMonitor warnings cannot coexist with canImplementApplicationChange=true.",
      "A passing harnessEvaluation cannot contain failed or below-threshold metrics.",
      "Bootstrap evaluation cannot claim pass or 9.8 until runtime evidence and current QA gates are verified.",
    ],
  };
}

function resolveDomainStressDefinitions(
  params: WorkspaceInitParams
): DomainStressDefinition[] {
  const explicit = params.domainStressProfile
    ? toDomainStressProfileId(params.domainStressProfile)
    : null;
  const active = new Set<string>();
  const customDefinitions: DomainStressDefinition[] = [];

  if (explicit) {
    active.add(explicit);
  }

  for (const definition of DOMAIN_STRESS_DEFINITIONS) {
    if (
      matchesDomainStressDefinition(definition, {
        projectType: params.projectType,
        primaryDomains: params.primaryDomains,
      })
    ) {
      active.add(definition.id);
    }
  }

  if (params.legacyAdoptionProfile?.trim()) {
    active.add("legacy-modernization-governance");
  }

  if (
    explicit != null &&
    !DOMAIN_STRESS_DEFINITIONS.some((definition) => definition.id === explicit)
  ) {
    customDefinitions.push(
      buildCustomDomainStressDefinition(explicit, {
        projectType: params.projectType,
        primaryDomains: params.primaryDomains,
        additionalContext: params.additionalContext,
        legacyAdoptionProfile: params.legacyAdoptionProfile,
      })
    );
  }

  return [
    ...DOMAIN_STRESS_DEFINITIONS.filter((definition) => active.has(definition.id)),
    ...customDefinitions,
  ];
}

function buildDomainStressState(params: WorkspaceInitParams) {
  const definitions = resolveDomainStressDefinitions(params);
  const requestedProfileId = params.domainStressProfile
    ? toDomainStressProfileId(params.domainStressProfile)
    : null;
  const profiles = definitions.map((definition) => {
    const evidenceGates = definition.mandatoryEvidence.map((evidence, index) => {
      const gateSlug = slugify(evidence);
      return {
        id: `domain.${definition.id}.evidence.${String(index + 1).padStart(2, "0")}.${gateSlug}`,
        label: evidence,
        status: "missing-evidence",
        owner: definition.defaultOwner,
        requiredEvidenceType: evidence,
        reportSection: definition.reportSections[index % definition.reportSections.length],
      };
    });
    return {
      id: definition.id,
      label: definition.label,
      programKey: definition.programKey,
      activation: requestedProfileId === definition.id ? "explicit" : "inferred",
      appliesWhen: definition.appliesWhen,
      actors: definition.actors,
      criticalSurfaces: definition.criticalSurfaces,
      reportSections: definition.reportSections,
      operatingQuestion: definition.operatingQuestion,
      parallelSafety: definition.parallelSafety,
      evidenceGates,
      hardGate:
        "All mandatory evidence gates must be resolved, explicitly waived, or marked not-applicable before readiness, publication, release, or operating claims are trusted.",
    };
  });
  const missingEvidenceItems = profiles.flatMap((profile) =>
    profile.evidenceGates.map((gate) => ({
      id: gate.id,
      label: gate.label,
      blocksClaimIds: [`claim.domain.${profile.id}.readiness`],
      requiredEvidenceType: gate.requiredEvidenceType,
      owner: gate.owner,
      resolutionTaskId: `task.${gate.id}`,
      queueVisibility: "task",
      surfaceAsTask: true,
      domainStressProfile: profile.id,
      reportSection: gate.reportSection,
      blocksReadiness: true,
    }))
  );
  const workItems = profiles.flatMap((profile) =>
    profile.evidenceGates.map((gate, index) => ({
      id: `task.${gate.id}`,
      title: `Prove ${gate.label}`,
      status: "blocked",
      lane: profile.label,
      owner: gate.owner,
      startAt: BOOTSTRAP_TIME,
      plannedStartAt: BOOTSTRAP_TIME,
      plannedEndAt: "before-domain-readiness-claim",
      endAt: null,
      progressPercent: 0,
      kpiTags: ["domain-stress", profile.id, gate.reportSection],
      evidenceRefs: ["docs/ai-harness/domain-stress-playbooks.md", gate.id],
      nextActionRef: gate.id,
      blockingClaimIds: [`claim.domain.${profile.id}.readiness`],
      exitCriteria:
        "Attach concrete project evidence or an approved not-applicable decision to this gate.",
      domainStressProfile: profile.id,
      sequence: index + 1,
    }))
  );
  const claims = profiles.map((profile) => ({
    claimId: `claim.domain.${profile.id}.readiness`,
    statement: `${profile.label} is ready for trusted execution.`,
    subjectRef: `domain-stress:${profile.id}`,
    claimStatus: "missing-evidence",
    confidence: 0.08,
    sign:
      "A domain stress profile is active, but its mandatory evidence gates are not yet connected to project artifacts.",
    object: profile.label,
    interpretant:
      "Domain work is only trustworthy when the profile's actors, critical surfaces, mandatory evidence, and report sections are reflected in real artifacts and dashboard state.",
    evidenceRefs: ["docs/ai-harness/domain-stress-playbooks.md", "docs/ai-harness/domain-stress-profiles.json"],
    counterEvidenceRefs: profile.evidenceGates.map((gate) => gate.id),
    falsificationTests: [
      "Reject readiness if any mandatory evidence gate is missing, stale, or unsupported.",
      "Reject readiness if the final report omits profile-specific report sections.",
      "Reject readiness if parallel chunks share profile invariants, state, source material, or readiness claims without an integration owner.",
    ],
    nextActionRef: profile.evidenceGates[0]?.id ?? "domain-stress-profile-review",
    domainStressProfile: profile.id,
  }));
  const decisionContracts = profiles.map((profile) => ({
    id: `decision.domain-stress.${profile.id}`,
    status: "pending",
    owner: "stakeholder-product-owner",
    decision: `Approve ${profile.label} evidence gates, owners, and report sections.`,
    alternatives: [
      "activate the full profile",
      "split the profile into release waves",
      "mark specific gates not-applicable with an explicit rationale",
    ],
    evidence: ["docs/ai-harness/domain-stress-playbooks.md", "docs/ai-harness/domain-stress-profiles.json"],
    reversalCondition:
      "Scope, domain, compliance, payment, data, governance, or release assumptions change.",
    stakeholderImpact:
      "Controls which domain-specific blockers appear in work queues, reports, and readiness judgments.",
    approvalThreshold:
      "Explicit stakeholder or orchestrator approval recorded before claiming domain readiness.",
    domainStressProfile: profile.id,
  }));

  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    activeProfileIds: profiles.map((profile) => profile.id),
    selectionSource: params.domainStressProfile ? "explicit-or-explicit-plus-inferred" : "primary-domain-inference",
    requestedProfile: params.domainStressProfile ?? null,
    requestedProfileId,
    legacyAdoptionProfile: params.legacyAdoptionProfile ?? null,
    profiles,
    claims,
    missingEvidenceItems,
    workItems,
    decisionContracts,
    hardGates: profiles.map((profile) => ({
      profileId: profile.id,
      label: profile.label,
      gateCount: profile.evidenceGates.length,
      status: profile.evidenceGates.length > 0 ? "blocked" : "not-applicable",
      validatorExpectation:
        "validateDashboardStateShape requires domainStress profile arrays; readiness remains blocked until evidence gates are resolved.",
    })),
    reportSections: profiles.flatMap((profile) =>
      profile.reportSections.map((section) => ({
        profileId: profile.id,
        section,
        status: "missing-evidence",
        requiredInBriefing: true,
      }))
    ),
    parallelSafetyRule:
      profiles.length > 0
        ? profiles.map((profile) => profile.parallelSafety).join(" ")
        : "Path-disjoint chunks are still coupled when they share domain invariants, state, source material, review gates, or readiness claims.",
  };
}

function gateIdsFor(profile: Record<string, unknown>, pattern: RegExp): string[] {
  const evidenceGates = Array.isArray(profile.evidenceGates)
    ? profile.evidenceGates as Record<string, unknown>[]
    : [];
  return evidenceGates
    .filter((gate) => pattern.test(String(gate.label ?? "")))
    .map((gate) => String(gate.id));
}

function buildDomainOperations(domainStress: ReturnType<typeof buildDomainStressState>) {
  const operations: Record<string, unknown> = {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    activeProfileIds: domainStress.activeProfileIds,
    status: domainStress.activeProfileIds.length > 0 ? "domain-evidence-required" : "no-active-domain-stress-profile",
    dashboardQuestion:
      "What domain-specific evidence is blocking trusted execution, production readiness, or publication readiness?",
    programs: domainStress.profiles.map((profile) => ({
      profileId: profile.id,
      label: profile.label,
      status: "blocked-by-mandatory-evidence",
      operatingQuestion: profile.operatingQuestion,
      criticalSurfaceCount: profile.criticalSurfaces.length,
      evidenceGateCount: profile.evidenceGates.length,
      reportSections: profile.reportSections,
      nextAction: profile.evidenceGates[0]?.label ?? "No domain gates active.",
    })),
  };

  for (const profile of domainStress.profiles) {
    if (profile.id === "identity-commerce-operations") {
      operations.commerceOperations = {
        profileId: profile.id,
        status: "blocked-by-mandatory-evidence",
        operatingQuestion: profile.operatingQuestion,
        sections: [
          { id: "credential-auth", label: "Credential/Auth", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /credential|device permission/i) },
          { id: "device-binding", label: "Device/Binding", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /resource|binding|device/i) },
          { id: "orders", label: "Orders", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /order|audit/i) },
          { id: "payments", label: "Payments", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /payment|settlement|callback/i) },
          { id: "benefits", label: "Benefits", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /benefit|promotion|entitlement/i) },
          { id: "operator-audit", label: "Operator Audit", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /audit|order/i) },
          { id: "privacy", label: "Privacy/PII", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /PII|consent|retention|delete/i) },
          { id: "readiness-blockers", label: "Readiness Blockers", status: "blocked", evidenceGateIds: profile.evidenceGates.map((gate) => gate.id) },
        ],
        operatingKpis: [
          { id: "resource-binding-health", label: "Resource Binding Health", value: "not-proven", target: "wrong-resource, stale binding, reassignment, and spoof cases tested" },
          { id: "order-lifecycle-sla", label: "Order Lifecycle SLA", value: "not-proven", target: "request to operator acceptance to payment handoff is idempotent and observable" },
          { id: "provider-reconciliation", label: "Provider Reconciliation", value: "not-proven", target: "callbacks, manual recovery, refunds, and settlement are auditable" },
          { id: "benefit-liability", label: "Benefit Liability", value: "not-proven", target: "benefit issuance, redemption, reversal, expiry, and abuse are ledger-backed" },
          { id: "operator-audit-coverage", label: "Operator Audit Coverage", value: "not-proven", target: "operator actions include actor, resource/order/account, timestamp, and reason" },
        ],
        productionGate:
          "Do not claim operating product readiness until payment, benefit, resource binding, and privacy evidence gates are resolved.",
      };
    }
    if (profile.id === "legacy-modernization-governance") {
      operations.modernizationGovernance = {
        profileId: profile.id,
        status: "blocked-by-modernization-preflight",
        operatingQuestion: profile.operatingQuestion,
        asIsToBe: {
          asIsInventoryStatus: "required",
          toBeCapabilityMapStatus: "required",
          routeTableCoverageTarget: "100% keep/replace/archive/migrate classification",
          coveragePercent: 0,
          unmappedLegacyItems: [],
          requiredArtifactLinks: [
            "AS-IS entity/route/table inventory",
            "TO-BE capability map",
            "migration wave contract",
            "rollback proof",
          ],
        },
        monetizationLedger: {
          status: "missing-evidence",
          requiredEvidence: [
            "plan and entitlement map",
            "payment state machine",
            "refund/reversal audit",
            "sponsorship and settlement assumptions",
            "tax/accounting responsibility note",
          ],
        },
        organizationTransitionGates: [
          "legal entity assumption",
          "ownership and revenue-share policy",
          "operator authority transfer",
          "accounting and tax owner",
          "member governance accountability",
        ],
        domains: [
          { id: "legacy-crud", label: "Legacy CRUD Preservation", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /legacy|CRUD|route|table/i) },
          { id: "collaboration-records", label: "Collaboration Records", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /collaborative|record|workflow/i) },
          { id: "governance", label: "Governance", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /governance|proposal|vote|quorum|role/i) },
          { id: "monetization", label: "Monetization", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /monetization|plan|entitlement|payment|refund|sponsor|tax/i) },
          { id: "moderation", label: "Moderation/Safety", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /moderation|abuse|audit/i) },
        ],
      };
    }
    if (profile.id === "content-release-governance") {
      operations.contentRelease = {
        profileId: profile.id,
        status: "blocked-by-editorial-and-release-evidence",
        operatingQuestion: profile.operatingQuestion,
        content: {
          titleStatus: "declared-by-project",
          messageMapStatus: "required",
          contentProgressStatus: "required",
          finishDefinitionStatus: "required",
        },
        contentProgress: {
          overallDraftPercent: 0,
          unitHeatmap: [],
          editorialDebtCount: 0,
          contradictionCount: 0,
          nextProductionDecision: "Define message map and first content unit coverage before release claims.",
        },
        contentPipeline: {
          channelAssetsReady: 0,
          derivativeAssetsReady: 0,
          visualAssetsApproved: 0,
          releaseReadinessPercent: 0,
        },
        visualAssetGovernance: {
          promptLedgerStatus: "required",
          rightsProvenanceStatus: "required",
          altTextStatus: "required",
          layoutSafeZoneStatus: "required",
        },
        pipelines: [
          { id: "message", label: "Message Consistency", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /message|concept|contradiction/i) },
          { id: "units", label: "Unit Heatmap", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /unit|content progress|counterargument/i) },
          { id: "channels", label: "Channel Pipeline", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /channel|feedback/i) },
          { id: "derivatives", label: "Derivative Pipeline", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /derivative|compression/i) },
          { id: "visuals", label: "Visual Governance", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /asset|style|rights|alt|layout/i) },
          { id: "release", label: "Release Readiness", status: "missing-evidence", evidenceGateIds: gateIdsFor(profile, /release|finish/i) },
        ],
        firstViewport:
          "Show content stage, unit heatmap, message consistency, unresolved tensions, ready derivative assets, and next production decision.",
      };
    }
    if (
      !["identity-commerce-operations", "legacy-modernization-governance", "content-release-governance"].includes(profile.id)
    ) {
      operations[profile.programKey || "customDomainOperations"] = {
        profileId: profile.id,
        status: "blocked-by-mandatory-evidence",
        operatingQuestion: profile.operatingQuestion,
        sections: profile.reportSections.map((section) => ({
          id: slugify(section),
          label: section,
          status: "missing-evidence",
          evidenceGateIds: profile.evidenceGates
            .filter((gate) => gate.reportSection === section)
            .map((gate) => gate.id),
        })),
        criticalSurfaces: profile.criticalSurfaces,
        operatingKpis: [
          {
            id: "evidence-coverage",
            label: "Evidence Coverage",
            value: "not-proven",
            target: "all mandatory evidence gates resolved, waived, or marked not-applicable",
          },
          {
            id: "review-loop-closure",
            label: "Review Loop Closure",
            value: "not-started",
            target: "negative-review findings have remediation and verification receipts",
          },
        ],
        readinessGate:
          "Do not claim domain readiness until evidence gates, review findings, and handoff continuity are resolved.",
      };
    }
  }

  return operations;
}

function buildDashboardState(params: WorkspaceInitParams) {
  const workspaceId = buildWorkspaceId(params);
  const projectType = params.projectType ?? "other";
  const domainMode = inferDashboardDomainMode(projectType);
  const primaryDomains = params.primaryDomains ?? [];
  const requiredKpis = getRequiredDashboardKpis({
    domainMode,
    projectType,
    primaryDomains,
  });
  const kpiProfile = getDashboardKpiProfile({
    domainMode,
    projectType,
    primaryDomains,
  });
  const domainStress = buildDomainStressState(params);
  const domainOperations = buildDomainOperations(domainStress);
  const projectWorldModel = buildProjectWorldModel(params, workspaceId);
  const realityModel = buildRealityModel(params, workspaceId, projectWorldModel);
  const goalCompass = buildGoalCompass(params, domainStress);
  const contextRotMonitor = buildContextRotMonitor(domainStress);
  const contracts = buildServiceContracts(params);
  const stateHashSeed = {
    workspaceId,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    purpose: params.purpose,
  };
  const sourceStateHash = stableHash(stateHashSeed);
  const harnessEvaluation = buildHarnessEvaluation(
    sourceStateHash,
    realityModel,
    goalCompass,
    contextRotMonitor
  );
  const commonProjection = {
    sourceEventSequence: BOOTSTRAP_SEQUENCE,
    sourceStateHash,
    projectionVersion: DASHBOARD_PROJECTION_VERSION,
    generatedAt: BOOTSTRAP_TIME,
    expiresAt: "after-first-refresh",
    completeness: "partial",
    staleness: "bootstrap",
  };
  const stageChecklist = [
    { id: "governance-open", label: "Governance Open", status: "in-progress" },
    { id: "plan-1", label: "Plan 1", status: "todo" },
    { id: "review-1", label: "Review 1", status: "todo" },
    { id: "plan-2", label: "Plan 2", status: "todo" },
    { id: "review-2", label: "Review 2", status: "todo" },
    { id: "plan-3", label: "Plan 3", status: "todo" },
    { id: "review-3", label: "Review 3", status: "todo" },
    { id: "goal-freeze", label: "Goal Freeze", status: "todo" },
    { id: "implementation", label: "Implementation", status: "todo" },
    { id: "verification", label: "Verification", status: "todo" },
    { id: "retro", label: "Retrospective", status: "todo" },
    { id: "governance-close", label: "Governance Close", status: "todo" },
  ];
  const authoritativeFiles = [
    "docs/ai-harness/dashboard/events/harness-events.jsonl",
    "docs/ai-harness/dashboard/events/ledger-manifest.json",
    "docs/ai-harness/dashboard/entities/reality-model.json",
    "docs/ai-harness/dashboard/entities/goal-compass.json",
    "docs/ai-harness/dashboard/entities/context-rot-monitor.json",
    "docs/ai-harness/dashboard/evaluations/harness-evaluation.json",
    "docs/ai-harness/dashboard/state/dashboard-state.json",
    "docs/ai-harness/dashboard/state/dashboard-index.json",
    "docs/ai-harness/runtime/state/session-index.json",
    "docs/ai-harness/runtime/state/active-session.json",
  ];
  const agentPlatformGovernance = buildAgentPlatformGovernance(params);
  for (const filePath of agentPlatformGovernance.governanceIndexing.evidenceRefs) {
    if (!authoritativeFiles.includes(filePath)) {
      authoritativeFiles.push(filePath);
    }
  }
  const agentMaintenanceTasks = [
    {
      id: "task-bootstrap-refresh-projections",
      status: "waiting",
      title: "Verify and refresh dashboard projections",
      owner: "harness-dashboard-operator",
      queueVisibility: "agent-only",
      audience: "agent",
      userVisible: false,
      evidenceRefs: ["event-000001-bootstrap"],
      blocksClaimIds: ["claim.world-model.bootstrap"],
      nextActionRef:
        "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh",
      exitCriteria:
        "Projection verification and refresh complete without stale/corrupt projection warnings.",
    },
  ];
  const userTaskBoardRemainingIds = domainStress.workItems
    .filter((item) =>
      !["complete", "completed", "closed"].includes(
        String(item.status || "").toLowerCase()
      )
    )
    .map((item) => item.id);
  const artifacts = [
    {
      id: "dashboard-html",
      label: "Harness Dashboard Single HTML",
      path: "docs/ai-harness/dashboard/index.html",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "event-ledger",
      label: "Harness Event Ledger",
      path: "docs/ai-harness/dashboard/events/harness-events.jsonl",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "ledger-manifest",
      label: "Ledger Manifest",
      path: "docs/ai-harness/dashboard/events/ledger-manifest.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "dashboard-index",
      label: "Agent Dashboard Index",
      path: "docs/ai-harness/dashboard/state/dashboard-index.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "dashboard-runtime",
      label: "Local Listener Runtime State",
      path: "docs/ai-harness/dashboard/state/dashboard-runtime.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "runtime-session-index",
      label: "Runtime Session Index",
      path: "docs/ai-harness/runtime/state/session-index.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "runtime-active-session",
      label: "Active Runtime Session",
      path: "docs/ai-harness/runtime/state/active-session.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "managed-file-inventory",
      label: "Managed File Inventory",
      path: ".github/ai-harness/managed-file-inventory.json",
      status: "present",
      owner: "legacy-reconcile-operator",
    },
    {
      id: "operating-model",
      label: "Operating Model",
      path: ".github/ai-harness/operating-model.md",
      status: "present",
      owner: "harness-doc-writer",
    },
  ];
  const bootstrapSessionEvidenceRefs = [
    "docs/ai-harness/dashboard/events/harness-events.jsonl",
    "docs/ai-harness/dashboard/state/dashboard-state.json",
    "docs/ai-harness/dashboard/index.html",
  ];
  const bootstrapTaskTrace = {
    originalRequest: params.purpose,
    processSummary:
      "workspace-init-mcp generated the Project World Model ledger, projections, dashboard, runtime scaffolding, and governance files.",
    resultSummary:
      "Bootstrap dashboard and harness state are installed, but real VCS, service, owner, release, and operations evidence still need to be connected.",
    recordedAt: BOOTSTRAP_TIME,
    source: "initialize_workspace bootstrap projection",
  };
  const bootstrapTraceIntegrity = {
    status: "complete",
    missingFields: [],
    policy:
      "Dashboard session trace cards must show missing taskTrace fields explicitly instead of silently reconstructing them from notes or chat history.",
  };

  return {
    meta: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      apiVersion: DASHBOARD_API_VERSION,
      generatedBy: "workspace-init-mcp",
      dashboardDesignSystem: "Project World Model",
      workspaceId,
      refreshRule:
        "Append canonical events first, rebuild projections, then export or serve read-only dashboard views.",
      ...commonProjection,
    },
    workspace: {
      id: workspaceId,
      name: params.workspaceName,
      purpose: params.purpose,
      projectType,
      primaryDomains: projectWorldModel.primaryDomains,
      techStack: params.techStack ?? [],
      targetIDEs: params.targetIDEs ?? ["vscode"],
      harnessProfile: params.harnessProfile ?? "balanced",
      governanceProfile: params.governanceProfile ?? "strict",
      autonomyMode: params.autonomyMode ?? "balanced",
      tokenBudget: params.tokenBudget ?? "balanced",
      domainStressProfile: params.domainStressProfile ?? "auto",
      legacyAdoptionProfile: params.legacyAdoptionProfile ?? "none",
    },
    agentPlatformGovernance,
    audienceLens: buildAudienceLensContract(),
    projectWorldModel,
    realityModel,
    goalCompass,
    contextRotMonitor,
    harnessEvaluation,
    cognitiveOffloading: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      sourceInspiration:
        "Harness-1 stateful cognitive offloading pattern: policy keeps semantic decisions while the harness maintains recoverable state.",
      divisionOfLabor: {
        agentKeeps:
          "Choose goals, searches, implementation moves, review judgments, promotion/demotion decisions, verification targets, and stop conditions.",
        harnessKeeps:
          "Maintain candidate pools, curated evidence, verification records, cross-artifact links, deduplicated observations, work packets, and budget-aware context renderings.",
      },
      workingMemory: {
        innerTier:
          "Prompt-facing summary: active goal, curated evidence, current blockers, recent review findings, next action, and context-budget marker.",
        outerTier:
          "Durable file cabinet: full ledgers, source documents, work packets, review artifacts, verification receipts, VCS records, and generated projections.",
        renderRule:
          "Render compact state before each meaningful agent action; keep raw artifacts addressable by path instead of copying them into every prompt.",
      },
      curationPolicy: {
        warmStart:
          "Seed the first working set from existing project files, user-declared goals, and detected harness artifacts, then require agents to promote, demote, or discard entries with evidence.",
        importanceTags: ["very-high", "high", "fair", "low"],
        capacityRule:
          "Prefer a small, importance-ordered curated set; archive or link bulky evidence rather than flooding prompt context.",
      },
      verificationPolicy: {
        verifyBeforePromote:
          "High-confidence readiness claims need verification evidence before promotion.",
        negativeReviewLoop:
          "Every meaningful work packet cycles through work -> negative review -> remediation -> verification until accepted, blocked, or explicitly risk-accepted.",
        requiredReviewRecordFields: [
          "iteration",
          "reviewer role",
          "verdict",
          "findings",
          "required fixes",
          "remediation evidence",
          "verification evidence",
          "residual risk",
          "next action",
        ],
      },
      budgetPolicy: {
        marker: "context-budget-marker",
        degradationOrder: [
          "keep goal, blockers, curated evidence, and latest review findings",
          "summarize older observations",
          "link large artifacts by path",
          "request compaction or context reset only after writing a handover",
        ],
      },
    },
    domainStress,
    domainOperations,
    worldModelFacts: [
      {
        id: "fact-bootstrap-purpose",
        state: "declared",
        summary: params.purpose,
        source: "initialize_workspace input",
        timestamp: BOOTSTRAP_TIME,
        freshnessTtl: "until-first-session",
        confidence: "medium",
        owner: "workspace-init-mcp",
        evidencePaths: ["docs/ai-harness/dashboard/events/harness-events.jsonl"],
      },
      {
        id: "fact-listener-bootstrap",
        state: "planned",
        summary:
          "The local read-only dashboard bridge is generated and will be auto-restored on harness activity.",
        source: "dashboard-runtime projection",
        timestamp: BOOTSTRAP_TIME,
        freshnessTtl: "until-listener-start",
        confidence: "medium",
        owner: "harness-dashboard-operator",
        evidencePaths: ["docs/ai-harness/dashboard/state/dashboard-runtime.json"],
      },
      {
        id: "fact-agent-platform-detection-bootstrap",
        state: "inferred",
        summary: `Initial AI agent platform surface: ${agentPlatformGovernance.activePlatforms.join(", ")}.`,
        source: "initialize_workspace targetIDEs and repository signal detection",
        timestamp: BOOTSTRAP_TIME,
        freshnessTtl: "until-user-platform-declaration",
        confidence: "medium",
        owner: "workspace-init-mcp",
        evidencePaths: agentPlatformGovernance.governanceIndexing.evidenceRefs,
      },
    ],
    serviceRegistry: {
      services: projectWorldModel.services,
      lifecycleStates: [
        "idea",
        "discovery",
        "design",
        "scaffolded",
        "local-running",
        "building",
        "verifying",
        "ci-ready",
        "preview",
        "staging",
        "released",
        "production",
        "operating",
        "degraded",
        "deprecated",
        "retiring",
        "retired",
      ],
    },
    serviceCreationContract: contracts.serviceCreationContract,
    runningServiceContract: contracts.runningServiceContract,
    dependencyGraph: {
      nodes: [
        { id: projectWorldModel.services[0].id, label: params.workspaceName, type: "service" },
        { id: "harness-dashboard", label: "Harness Dashboard", type: "harness-component" },
      ],
      edges: projectWorldModel.dependencies,
    },
    worldJudgment: {
      status: "bootstrap-not-ready-for-operational-judgment",
      label: "Harness Installed, Evidence Capture Started",
      summary:
        "The harness is ready to guide planning, session resume, and evidence capture. Production, release, and operations claims remain separate readiness checks until project evidence is linked.",
      allowedActions: [
        "Use the dashboard for orientation and session resume.",
        "Open the first governed harness session.",
        "Collect service, VCS, release, and operations evidence.",
      ],
      blockedActions: [
        "Do not treat bootstrap service readiness as production readiness.",
        "Do not release, deploy, or close governance gates from placeholder evidence.",
        "Do not embed restricted or secret material without explicit approval.",
      ],
      trustScore: 12,
      trustLevel: "bootstrap",
      sourceRefs: ["event-000001-bootstrap"],
      freshness: {
        ledger: "bootstrap",
        projection: "bootstrap",
        evidence: "partial",
      },
    },
    judgmentConsole: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      currentJudgment:
        "Harness adoption is ready; use Overview to choose the next governed action while release and operations evidence is still being collected.",
      permittedActions: [
        "Use the dashboard to orient stakeholders and AI Agents.",
        "Open or resume a governed harness session.",
        "Collect evidence and link it to decisions, tasks, and VCS records.",
      ],
      blockedActions: [
        "Do not approve release or operations readiness from bootstrap evidence.",
        "Do not close handoff while dirty/unlinked VCS or missing evidence remains.",
        "Do not treat generated projection claims as ledger truth unless source events are linked.",
      ],
      nextRequiredDecision: "decision-first-governed-goal",
      nextRequiredDecisionLabel:
        "Confirm whether the project is greenfield creation, running-service adoption, or modernization.",
      highestRiskSignal: "signal-bootstrap-evidence-gap",
      valueAtRisk: ["value-user-outcome", "value-agent-continuity"],
      decisionDeadline: "TBD",
      owner: "stakeholder-product-owner",
    },
    criticalSignals: [
      {
        id: "signal-bootstrap-evidence-gap",
        severity: "watching",
        label: "Evidence capture has started",
        status: "open",
        whyItMatters:
          "The world model can orient work now. Service health, release, VCS, and telemetry evidence are collected next before operational claims are trusted.",
        owner: "harness-dashboard-operator",
        sourceRefs: ["governanceEvidenceBrief.missingEvidenceClaims"],
        nextAction:
          "Convert each missing evidence claim into an owner, required artifact, and resolution task.",
      },
      {
        id: "signal-first-goal-decision",
        severity: "decision-needed",
        label: "First governed goal is not confirmed",
        status: "open",
        whyItMatters:
          "Service lifecycle gates cannot be trusted until the stakeholder confirms whether this is greenfield creation, running-service adoption, or legacy modernization.",
        owner: "stakeholder-product-owner",
        sourceRefs: ["decision-first-governed-goal"],
        nextAction: "Approve or revise the first governed goal.",
      },
      {
        id: "signal-vcs-evidence-uncollected",
        severity: "watching",
        label: "Version-control evidence not yet collected",
        status: "watching",
        whyItMatters:
          "Git/SVN history must be linked to sessions, tasks, and decisions before change history can support governance claims.",
        owner: "harness-dashboard-operator",
        sourceRefs: ["versionControl.collectionProvenance"],
        nextAction: "Run dashboard refresh and link unlinked changes to the active work context.",
      },
    ],
    valueHierarchy: {
      purpose:
        "Make project decisions by balancing user value, project-specific safety, operational simplicity, and AI-agent continuity.",
      values: [
        {
          id: "value-user-outcome",
          label: "User outcome and continuity",
          priority: 1,
          rationale:
            "Project changes should preserve the primary user or stakeholder outcome the workspace exists to deliver.",
          conflictPolicy:
            "Do not improve harness governance at the cost of disrupting the project's real value path.",
        },
        {
          id: "value-project-state-integrity",
          label: "Project state integrity",
          priority: 2,
          rationale:
            "Configuration, data, content, and operational state should not be silently lost, duplicated, or overwritten.",
          conflictPolicy:
            "When state ownership is unclear, prefer explicit review, backup, and recovery over implicit mutation.",
        },
        {
          id: "value-privacy-cost-control",
          label: "Privacy and cost control",
          priority: 3,
          rationale:
            "External services, accounts, datasets, and environments must respect privacy, quota, cost, and graceful degradation.",
          conflictPolicy:
            "Do not persist secrets or unnecessary personal data in harness projections.",
        },
        {
          id: "value-agent-continuity",
          label: "AI Agent continuity",
          priority: 4,
          rationale:
            "Future agents must resume from explicit facts, decisions, validation commands, and evidence gaps.",
          conflictPolicy:
            "No task should close without a durable next-action or no-new-learning event.",
        },
      ],
    },
    claimEvidenceMatrix: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      claimModel:
        "Each visible status claim should connect a sign, object, interpretation rule, evidence strength, and next action.",
      claims: [
        {
          claimId: "claim.world-model.bootstrap",
          statement: "The Harness Dashboard 4.6.5 world model exists for this workspace.",
          subjectRef: `workspace:${workspaceId}`,
          claimStatus: "supported",
          confidence: 0.78,
          sign: "Generated dashboard files and bootstrap event are present.",
          object: "workspace harness world model",
          interpretant:
            "If the generated HTML, state JSON, ledger manifest, and bootstrap event exist, the world model can be used for orientation.",
          evidenceRefs: [
            "docs/ai-harness/dashboard/index.html",
            "docs/ai-harness/dashboard/state/dashboard-state.json",
            "event-000001-bootstrap",
          ],
          counterEvidenceRefs: [],
          falsificationTests: [
            "Reject this claim if index.html, dashboard-state.json, or event-000001-bootstrap is missing.",
            "Reject this claim if ledger-manifest.json does not include sequence 1.",
          ],
          nextActionRef: "agentTaskQueues.maintenance.task-bootstrap-refresh-projections",
        },
        {
          claimId: "claim.service.operational-readiness",
          statement: "The primary service is ready for operational judgment.",
          subjectRef: `service:${projectWorldModel.services[0].id}`,
          claimStatus: "missing-evidence",
          confidence: 0.18,
          sign: "Service registry exists, but health, deployment, telemetry, incident, and release evidence are incomplete.",
          object: "primary service readiness",
          interpretant:
            "A service should not be judged operational until health, deployment target, release traceability, runbook, and telemetry claims are supported.",
          evidenceRefs: ["serviceRegistry", "runningServiceContract"],
          counterEvidenceRefs: [
            "governanceEvidenceBrief.missingEvidenceClaims",
            "releaseReadiness.status",
            "incidentReadiness.mitigationStatus",
          ],
          falsificationTests: [
            "Reject operational readiness if health, deployment, telemetry, runbook, or rollback evidence is absent.",
            "Reject operational readiness if releaseReadiness.status remains not-connected.",
          ],
          nextActionRef: "missing.service-health",
        },
        {
          claimId: "claim.agent.safe-resume",
          statement: "A future AI Agent can safely resume work from dashboard context.",
          subjectRef: `workspace:${workspaceId}`,
          claimStatus: "partial",
          confidence: 0.52,
          sign: "Agent resume brief and authoritative files exist, but the first governed goal remains pending.",
          object: "agent resumability",
          interpretant:
            "Resume is acceptable for orientation, but implementation should wait until open decisions and blockers are addressed.",
          evidenceRefs: ["agentResumeBrief", "dashboard-index.json"],
          counterEvidenceRefs: ["decision-first-governed-goal", "bootstrap-state-needs-real-evidence"],
          falsificationTests: [
            "Reject safe resume if agentResumeBrief.activeSession conflicts with runtimeOrchestration.activeSessionId.",
            "Reject safe resume if dirty VCS changes are unlinked and no next action explains them.",
          ],
          nextActionRef: "decision-first-governed-goal",
        },
        {
          claimId: "claim.agent.platform-governance",
          statement: "AI-agent platform instructions match the platforms actually used by this project.",
          subjectRef: `workspace:${workspaceId}`,
          claimStatus: "partial",
          confidence: 0.5,
          sign:
            "Platform instruction files are generated from detected or configured target platforms, but the user has not declared the real active platform set yet.",
          object: "agent platform governance",
          interpretant:
            "Instruction files should be active only for platforms the team uses; stale or unused platform instructions must be indexed as unused-instruction so Agents do not follow the wrong operating model.",
          evidenceRefs: ["agentPlatformGovernance", ...agentPlatformGovernance.governanceIndexing.evidenceRefs],
          counterEvidenceRefs: ["decision-agent-platform-selection"],
          falsificationTests: [
            "Reject this claim if the dashboard platform declaration conflicts with active instruction files.",
            "Reject this claim if unused platform instruction files are not marked unused-instruction.",
          ],
          nextActionRef: "agentPlatformGovernance.intake",
        },
        {
          claimId: "claim.vcs.linkage",
          statement: "Version-control changes are linked to governed work.",
          subjectRef: `workspace:${workspaceId}`,
          claimStatus: "missing-evidence",
          confidence: 0.16,
          sign: "Bootstrap projection has no collected Git/SVN records yet.",
          object: "VCS-to-session/task/decision traceability",
          interpretant:
            "Change history supports governance only when revisions are linked to sessions, tasks, decisions, or explicit warnings.",
          evidenceRefs: ["versionControl.collectionProvenance"],
          counterEvidenceRefs: ["versionControl.unlinkedChanges", "vcsChangeRecords"],
          falsificationTests: [
            "Reject this claim if any commit, SVN revision, or dirty path has no session/task/decision/claim linkage.",
            "Reject this claim if collectionProvenance.exitCode is non-zero or stale.",
          ],
          nextActionRef: "missing.vcs-task-links",
        },
        {
          claimId: "claim.release.traceability",
          statement: "A release can be traced from decision to deployment and rollback.",
          subjectRef: `service:${projectWorldModel.services[0].id}`,
          claimStatus: "missing-evidence",
          confidence: 0.12,
          sign: "Release readiness exists as a contract but has no release records.",
          object: "release traceability",
          interpretant:
            "A release is governable only when version, revision, artifact, CI run, approver, target, smoke result, and rollback path are known.",
          evidenceRefs: ["releaseReadiness.requiredTraceability"],
          counterEvidenceRefs: ["releaseReadiness.releases", "governanceEvidenceBrief.missingEvidenceClaims"],
          falsificationTests: [
            "Reject release readiness if releaseReadiness.releases is empty.",
            "Reject release readiness if smoke test result or rollback command is missing.",
          ],
          nextActionRef: "missing.deployment-target",
        },
        {
          claimId: "claim.data.integrity",
          statement:
            "Project data or state integrity risks are visible when the project has a data surface.",
          subjectRef: "value:value-project-state-integrity",
          claimStatus: "conditional",
          confidence: 0.32,
          sign:
            "The bootstrap world model tracks data readiness as conditional until project-specific data ownership is declared or observed.",
          object: "project state integrity governance",
          interpretant:
            "Data readiness should become work only when this workspace owns a database, dataset, migration path, storage layer, or other persistent state surface.",
          evidenceRefs: ["valueHierarchy", "databaseReadiness", "runningServiceContract.dataOwnership"],
          counterEvidenceRefs: ["databaseReadiness.backupFreshness", "databaseReadiness.restoreDrillEvidence"],
          falsificationTests: [
            "Do not queue data-readiness work if the project has no declared or observed data surface.",
            "Reject data readiness if a declared data surface has no ownership, migration, backup, or recovery evidence.",
          ],
          nextActionRef: "missing.database-readiness",
        },
        ...domainStress.claims,
      ],
      missingEvidenceItems: [
        {
          id: "missing.service-health",
          label: "Service health evidence",
          blocksClaimIds: ["claim.service.operational-readiness"],
          requiredEvidenceType: "health check, smoke test, or local run verification",
          owner: "maintainer",
          resolutionTaskId: "evidence.service-health",
          queueVisibility: "evidence-only",
        },
        {
          id: "missing.deployment-target",
          label: "Deployment target evidence",
          blocksClaimIds: ["claim.service.operational-readiness"],
          requiredEvidenceType: "deployment URL, CI run, artifact, and rollback path",
          owner: "maintainer",
          resolutionTaskId: "evidence.deployment-target",
          queueVisibility: "evidence-only",
        },
        {
          id: "missing.vcs-task-links",
          label: "VCS-to-work linkage",
          blocksClaimIds: ["claim.agent.safe-resume"],
          requiredEvidenceType: "commit/revision links to sessions, tasks, and decisions",
          owner: "harness-dashboard-operator",
          resolutionTaskId: "evidence.vcs-linkage",
          queueVisibility: "evidence-only",
        },
        {
          id: "missing.agent-platform-declaration",
          label: "AI platform declaration",
          blocksClaimIds: ["claim.agent.platform-governance", "claim.agent.safe-resume"],
          requiredEvidenceType: "user-declared active AI agent platform set and unused-instruction classification",
          owner: "stakeholder-product-owner",
          resolutionTaskId: "agentPlatformGovernance.intake",
          queueVisibility: "governance-only",
        },
        {
          id: "missing.database-readiness",
          label: "Data readiness evidence when applicable",
          blocksClaimIds: ["claim.data.integrity"],
          requiredEvidenceType:
            "data ownership, schema, migration, retention, backup, restore, or not-applicable decision",
          owner: "maintainer",
          resolutionTaskId: "evidence.data-readiness",
          queueVisibility: "evidence-only",
        },
        ...domainStress.missingEvidenceItems,
      ],
    },
    readinessJudgments: [
      {
        id: "ready-to-plan",
        label: "Ready to plan",
        status: "conditional",
        rationale:
          "The world model and agent resume brief exist, but the first governed goal still needs stakeholder confirmation.",
        requiredNextAction: "Resolve decision-first-governed-goal.",
        evidenceRefs: ["stakeholderBrief", "agentResumeBrief"],
      },
      {
        id: "ready-to-build",
        label: "Ready to build",
        status: "not-ready",
        rationale:
          "Build should wait until service ownership, environment, expected write paths, and validation commands are explicit.",
        requiredNextAction: "Open a governed harness session with expected write paths.",
        evidenceRefs: ["serviceCreationContract", "agile.gates"],
      },
      {
        id: "ready-to-release",
        label: "Ready to release",
        status: "not-ready",
        rationale:
          "Release traceability, CI run, deployment target, smoke test, and rollback path are not connected.",
        requiredNextAction: "Populate releaseReadiness from VCS and deployment evidence.",
        evidenceRefs: ["releaseReadiness"],
      },
      {
        id: "ready-to-operate",
        label: "Ready to operate",
        status: "not-ready",
        rationale:
          "Incident readiness, SLO/SLI, telemetry, runbook, and backup/restore posture are not connected.",
        requiredNextAction: "Collect runbook, telemetry, incident, and database readiness evidence.",
        evidenceRefs: ["incidentReadiness", "sloSli", "databaseReadiness"],
      },
      {
        id: "ready-to-handoff",
        label: "Ready to hand off",
        status: "conditional",
        rationale:
          "Agent resume brief exists, but evidence gaps and open decisions must be preserved as explicit next actions.",
        requiredNextAction: "Keep blocker and missing evidence items visible in the agent context pack.",
        evidenceRefs: ["agentResumeBrief", "claimEvidenceMatrix"],
      },
      ...domainStress.profiles.map((profile) => ({
        id: `ready-for-domain-stress.${profile.id}`,
        label: `${profile.label} ready`,
        status: "not-ready",
        rationale:
          "The selected domain stress profile has mandatory evidence gates that must be resolved before readiness or reporting claims are trusted.",
        requiredNextAction: profile.evidenceGates[0]?.label ?? "Review domain stress gates.",
        evidenceRefs: ["domainStress", "domainOperations", "claimEvidenceMatrix"],
      })),
    ],
    trustBoundary: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      status: "bootstrap-warning",
      ledgerRootHash: "event-000001-bootstrap",
      projectionStateHash: sourceStateHash,
      runtimeStatePathHash: stableHash("docs/ai-harness/dashboard/state/dashboard-state.json"),
      servedSnapshotHash: sourceStateHash,
      checks: [
        {
          id: "ledger-present",
          label: "Ledger exists",
          status: "supported",
          evidenceRefs: ["docs/ai-harness/dashboard/events/harness-events.jsonl"],
        },
        {
          id: "projection-disposable",
          label: "Projection is disposable",
          status: "supported",
          evidenceRefs: ["docs/ai-harness/dashboard/state/dashboard-state.json"],
        },
        {
          id: "claim-event-coverage",
          label: "Claim-event coverage",
          status: "partial",
          evidenceRefs: ["claimEvidenceMatrix"],
          nextAction: "Append refresh, VCS, and session events before claiming operational truth.",
        },
      ],
    },
    dashboardQualityScorecard: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      targetScore: 9.5,
      uiUxDesignScore: 9.2,
      projectEvidenceScore: 1.2,
      scoringPolicy:
        "UI/UX design is capped below 9.5 until current browser QA evidence proves live data, render, console, keyboard, responsive, accessibility, and interactive checks.",
      qaEvidence: {
        requiredFor95: [
          "rendered-browser-smoke",
          "console-clean",
          "keyboard-and-modal-flow",
          "responsive-viewport-check",
          "live-sse-or-refresh-path-check",
          "accessibility-tree-check",
          "modern-ui-progressive-enhancement-check",
        ],
        status: "pending-run",
        note: "No generated dashboard may self-certify above the 9.5 target until a current browser QA artifact proves live, interactive, accessible, responsive behavior.",
      },
      modernWebUiPolicy: {
        schemaVersion: DASHBOARD_SCHEMA_VERSION,
        sourceBaseline: "Google I/O 2026 Chrome UI and HTML-in-Canvas guidance",
        liveRequirement:
          "World Model Harness Dashboard work must preserve the live local listener, SSE/runtime refresh path, keyboard navigation, and projection freshness cues.",
        htmlInCanvasPolicy:
          "HTML-in-Canvas may be used only as progressive enhancement for canvas/WebGL/WebGPU surfaces; semantic DOM fallback, accessibility, find-in-page, translation, and Playwright verification are mandatory.",
        userPreferenceRules: [
          "Respect color-scheme, prefers-color-scheme, prefers-contrast, prefers-reduced-motion, and user text scaling.",
          "Use light-dark(), accent-color, contrast-aware tokens, and responsive container-aware sizing where supported with fallback CSS.",
        ],
        interactionRules: [
          "Use View Transitions, element-scoped transitions, scroll-driven animations, popover/dialog/inert, and move-before only when they improve orientation and do not break QA.",
          "Prefer native HTML controls and semantic DOM before canvas-only UI.",
          "Keep dashboard interactions live: tab purpose updates, filters, copy/export actions, local API health, and SSE events must remain visible and testable.",
        ],
        noiseReductionRules: [
          "Reduce repeated panels and visual clutter before adding motion.",
          "Use container queries, scroll-state affordances, details/hidden-until-found, and stable component dimensions to keep dense dashboards scannable.",
        ],
        qaGate:
          "If Playwright, accessibility, keyboard, console, responsive, or canvas fallback checks fail, prefer stable DOM/CSS over experimental API usage.",
      },
      dimensions: [
        {
          id: "executive-judgment",
          label: "Executive judgment clarity",
          score: 9.3,
          evidenceRefs: ["judgmentConsole", "worldJudgment", "criticalSignals"],
          rationale:
            "First-screen panels answer trust, blocked actions, required decision, owner, and value at risk.",
        },
        {
          id: "timeline-readiness-map",
          label: "Timeline as readiness map",
          score: 9.3,
          evidenceRefs: ["workTimeline", "readinessJudgments", "claimEvidenceMatrix"],
          rationale:
            "Timeline rows connect task span, status, evidence, blocker, exit criteria, and next action.",
        },
        {
          id: "triadic-evidence",
          label: "Claim-evidence interpretability",
          score: 9.3,
          evidenceRefs: ["claimEvidenceMatrix.claims"],
          rationale:
            "Claims expose sign, object, interpretant, counter-evidence, falsification test, and next action.",
        },
        {
          id: "agent-resume",
          label: "AI Agent resumability",
          score: 9.3,
          evidenceRefs: ["agentResumeBrief", "agentContextPacks", "dashboard-index.json"],
          rationale:
            "Agent-facing briefs identify next safest action, forbidden assumptions, validation commands, and authoritative files.",
        },
        {
          id: "accessibility-shareability",
          label: "Accessible single-file shareability",
          score: 9.3,
          evidenceRefs: ["docs/ai-harness/dashboard/index.html"],
          rationale:
            "Single-file HTML keeps semantic tabs, keyboard navigation, table alternatives, reduced motion, and no remote assets.",
        },
      ],
      evaluatorProvenance: [
        {
          id: "qa-bootstrap-static",
          evaluatorRole: "workspace-init-mcp-generator",
          status: "self-assessed",
          checkedAt: BOOTSTRAP_TIME,
          evidenceRefs: ["docs/ai-harness/dashboard/index.html"],
          confidence: "medium",
        },
      ],
      whyNot95Yet: [
        "Project evidence is intentionally low until service, VCS, release, and operations claims are linked to real artifacts.",
        "Dirty or unclassified working-tree paths cap handoff and release readiness.",
        "Operational trust cannot exceed evidence coverage even when the UI design is strong.",
        "Modern UI enhancements must prove live, accessible, interactive behavior through current browser QA before raising the UI score.",
      ],
    },
    governanceActionabilityScore: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      score: 6.8,
      maxScore: 10,
      status: "guided-onboarding",
      adoptionStage: "governed-adoption",
      onboardingScore: 6.8,
      operationalEvidenceScore: 1.2,
      scoreMeaning:
        "The main score measures whether the harness is ready to guide planning and evidence collection. It is not production release readiness.",
      userInterpretation:
        "Harness installation is usable. The low operational evidence score means the project has not yet linked enough proof for release or operations approval.",
      canPlan: true,
      canBuild: false,
      canRelease: false,
      canOperate: false,
      canHandoff: false,
      capReason:
        "Release and operations remain blocked by unresolved decisions and missing service/release/data evidence, not by a failed harness setup.",
      inputs: {
        uiUxDesignScore: 9.2,
        projectEvidenceScore: 1.2,
        dirtyOrUnclassifiedVcsPaths: 0,
        missingEvidenceClaims: 5 + domainStress.missingEvidenceItems.length,
        unresolvedDecisions: 1 + domainStress.decisionContracts.length,
      },
      nextToReach95: [
        "Resolve decision-first-governed-goal.",
        "Collect and link VCS, release, data, service health, and operations evidence.",
        ...domainStress.profiles.map((profile) => `Resolve mandatory evidence gates for ${profile.label}.`),
        "Use Work and Evidence tabs to turn missing claims into owned tasks.",
      ],
    },
    worldModelImprovementContract: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      purpose:
        "Every AI Agent session must make the project world model more truthful, less ambiguous, and easier to resume.",
      scorePolicy: {
        governanceSetupScore:
          "Improve by clarifying mission, owners, active work, decisions, artifacts, and dashboard tab responsibilities.",
        operationalEvidenceScore:
          "Improve by linking real VCS, CI, release, service-health, incident, SLO/SLI, database, and runbook evidence.",
        target:
          "Move both scores upward over time without hiding missing evidence or inflating production readiness.",
      },
      maturityLoop: [
        "Read dashboard-index.json or call get_harness_dashboard_context before meaningful work.",
        "Confirm or record active AI agent platforms so platform-specific instruction files match the real toolchain.",
        "Analyze repository artifacts, governance records, runtime files, VCS state, and project-specific conventions.",
        "Update realityModel when a real product, repository, service, environment, data surface, owner, or external dependency relationship is learned.",
        "Update goalCompass when the current reality, target state, gap list, or next safe move changes.",
        "Review contextRotMonitor before implementation and clear only warnings that have durable evidence.",
        "Ask for or record tacit real-world context when repository evidence is insufficient.",
        "Convert unknowns into decisions, risks, evidence tasks, dictionary terms, or explicit stale facts.",
        "Refresh and verify projections after material decisions, evidence, VCS, service, or operations changes.",
        "Close each session with one retro insight or an explicit no-new-learning event.",
      ],
      tacitContextIntake: {
        allowed:
          "Stakeholder intent, operational constraints, domain vocabulary, team conventions, external account status, release windows, support expectations, and real-world blockers.",
        rules: [
          "Mark injected context as declared until independently observed.",
          "Do not store secret values, credentials, private tokens, or unreleased sensitive details.",
          "Attach owner, timestamp, confidence, source, and reversal condition when tacit context changes a claim.",
        ],
      },
      tabOwnership: {
        Overview:
          "Executive orientation only: what changed, what matters, trust, next decision, and score meaning.",
        Work:
          "Open work, progress, status lanes, timeline readiness, blockers, remaining effort, and KPI timing inputs.",
        Evidence:
          "Claim-to-proof matrix, missing evidence, VCS linkage, validation, and falsification status.",
        Governance:
          "Decisions, agent platform intake, gates, values, definitions of ready/done, cadence, reviews, retros, and improvement actions.",
        Operations:
          "Service topology, environments, dependencies, releases, incidents, SLO/SLI, database, and listener health.",
        TechStack:
          "Project architecture, technology stack, infrastructure, deployment path, data stores, and harness integration.",
      },
      nonDuplicationRules: [
        "Do not repeat the same table across tabs; link to the authoritative tab instead.",
        "When a fact appears in more than one view, each tab must answer a different user question about that fact.",
        "Overview summarizes; Work sequences; Evidence proves; Governance decides; Operations runs; Tech Stack explains composition.",
      ],
      dashboardCollaborationProtocol: [
        "When the user references a dashboard tab or task, answer as if both user and Agent are looking at that same projected state.",
        "Name the tab, the specific task/claim/decision, the evidence path, and the safest next action.",
        "Use generated harness skills before inventing ad hoc dashboard handling.",
      ],
    },
    workReadinessMap: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      source: "projected-from-workTimeline-backlog-sessions-evidence",
      generatedAt: BOOTSTRAP_TIME,
      rows: domainStress.workItems.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        owner: item.owner,
        evidenceRefs: item.evidenceRefs,
        blocksClaimIds: item.blockingClaimIds,
        domainStressProfile: item.domainStressProfile,
      })),
      summary: {
        visibleRows: domainStress.workItems.length,
        activeRows: 0,
        blockedRows: domainStress.workItems.length,
        gateCount: domainStress.missingEvidenceItems.length,
      },
      apiParity:
        "dashboard-ops refresh populates this with the exact rows used for stakeholder Gantt and AI Agent task APIs.",
    },
    projectEvidenceInventory: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      generatedAt: BOOTSTRAP_TIME,
      sources: [],
      claimsPromoted: [],
      missingSourceTypes: [
        "package manifest",
        "CI workflow",
        "deployment target",
        "data surface declaration",
        "service smoke test",
        ...domainStress.reportSections.map(
          (section) => `${section.profileId} / ${section.section} evidence`
        ),
      ],
    },
    agentContextPacks: {
      stakeholder: {
        label: "Stakeholder Decision Pack",
        primaryQuestion: "Can I trust the current state and what decision is required?",
        mustRead: ["worldJudgment", "criticalSignals", "readinessJudgments", "decisionContracts"],
      },
      agent: {
        label: "AI Agent Resume Pack",
        primaryQuestion: "What is the next safest action and what assumptions are forbidden?",
        mustRead: [
          "agentResumeBrief",
          "goalCompass",
          "realityModel",
          "contextRotMonitor",
          "harnessEvaluation",
          "cognitiveOffloading",
          "governanceActionabilityScore",
          "worldModelImprovementContract",
          "agentPlatformGovernance",
          "claimEvidenceMatrix",
          "taskQueues",
          "workTimeline",
          "domainStress",
          "domainOperations",
        ],
        forbiddenAssumptions: [
          "Do not assume service readiness from bootstrap state.",
          "Do not assume dirty VCS changes are linked to the current task.",
          "Do not treat pending decisions as approved.",
          "Do not assume the generated platform instruction files are all active until agentPlatformGovernance is declared.",
          "Do not treat tacit stakeholder context as observed fact until it has evidence or an owner-approved declaration.",
          "Do not start implementation when the proposed chunk goal cannot be traced to goalCompass.goalGraph.",
          "Do not ignore contextRotMonitor.rotWarnings even when a local task looks straightforward.",
          "Do not report a 9.8+ harness score unless harnessEvaluation.status is pass and every metric meets its threshold.",
        ],
      },
      maintainer: {
        label: "Maintainer Operations Pack",
        primaryQuestion: "What must be connected before release or operation?",
        mustRead: [
          "serviceRegistry",
          "releaseReadiness",
          "incidentReadiness",
          "sloSli",
          "databaseReadiness",
          "domainStress",
          "domainOperations",
        ],
      },
    },
    stakeholderBrief: {
      currentGoal: params.purpose,
      whatChangedSinceLastReview:
        "Workspace initialized with the Harness Dashboard 4.6.5 Hypertext Project World Model.",
      whyItMatters:
        "Stakeholders and AI Agents now share a durable, evidence-backed view of project reality.",
      currentRisk:
        domainStress.activeProfileIds.length
          ? `Bootstrap projections are not yet connected to real service, release, VCS, incident, or domain evidence for ${domainStress.activeProfileIds.join(", ")}.`
          : "Bootstrap projections are not yet connected to real service, release, VCS, or incident evidence.",
      requiredDecision:
        "Confirm the first governed project goal and service lifecycle mode.",
      owner: "stakeholder-product-owner",
      dueDate: "TBD",
      nextMilestone: "Open first governed harness session and refresh projections.",
      evidenceLinks: ["event-000001-bootstrap"],
    },
    agentResumeBrief: {
      currentProjectGoal: params.purpose,
      activeService: projectWorldModel.services[0].id,
      activeSession: null,
      lastSafeCheckpoint: "Harness dashboard bootstrap generated.",
      nextSafestAction:
        domainStress.activeProfileIds.length
          ? "Resolve the active domain stress profile decision, convert mandatory evidence gates into session contracts, then verify and refresh projections."
          : "Run dashboard-ops.mjs verify-projections, refresh projections, then start the first governed harness session for this workspace.",
      openDecisions: ["decision-first-governed-goal"],
      governanceOnlyDecisions: ["decision-agent-platform-selection"],
      blockers: [
        "bootstrap-state-needs-real-evidence",
        ...domainStress.activeProfileIds.map((profileId) => `domain-stress.${profileId}.mandatory-evidence`),
      ],
      validationCommands: [
        "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs verify-projections",
        "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh",
        "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs status",
        "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs validate",
      ],
      authoritativeFiles,
      dirtyStateWarning:
        "Version-control state is unknown until the first refresh collects Git or SVN evidence.",
      staleStateWarning:
        "Bootstrap state expires after the first real harness session or service evidence update.",
      confidence: "medium",
    },
    governanceEvidenceBrief: {
      evidenceCoverage: "bootstrap",
      missingEvidenceClaims: [
        "service health",
        "deployment target",
        "VCS history",
        "operations telemetry",
        "stakeholder approval",
        ...domainStress.missingEvidenceItems.map((item) => item.label),
      ],
      unlinkedCommitsOrRevisions: [],
      unresolvedDecisions: [
        "decision-first-governed-goal",
        "decision-agent-platform-selection",
        ...domainStress.decisionContracts.map((decision) => decision.id),
      ],
      staleProjections: ["dashboard-state.json"],
      failedValidations: [],
    },
    projectionConfidence: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      status: "projection-debt",
      completeness: "partial",
      staleness: "bootstrap",
      trustBoundaryStatus: "bootstrap-warning",
      missingEvidenceCount: 5 + domainStress.missingEvidenceItems.length,
      openDecisionCount: 2 + domainStress.decisionContracts.length,
      lastSuccessfulRefreshAt: null,
      lastSourceEventSequence: BOOTSTRAP_SEQUENCE,
      localListenerStatus: "not-started",
      actionGate:
        "Use planning, evidence review, and dashboard verification now; defer release, operate, or reality-complete claims until refresh and evidence gates pass.",
      userMessage:
        "This dashboard is usable for orientation, planning, and handoff, but it is still a bootstrap projection with missing real project evidence.",
      requiredActions: [
        "Run dashboard-ops.mjs verify-projections",
        "Run dashboard-ops.mjs refresh",
        "Record the first governed session with original request, process summary, and result summary",
        "Link VCS, service, owner, release, and operations evidence before claiming operational truth",
      ],
      evidenceRefs: [
        "trustBoundary",
        "governanceEvidenceBrief",
        "claimEvidenceMatrix",
        "dashboardQualityScorecard",
      ],
    },
    sessionTraceability: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      status: "bootstrap-trace-complete",
      purpose:
        "Let users understand what was requested, what process ran, what result was recorded, what evidence backs it, and what should happen next without opening raw runtime JSON or chat history.",
      source:
        "Projected from governedSessions, runtime events, execution receipts, and session summaries.",
      integrityPolicy:
        "Missing taskTrace data must be flagged as projection debt; fallback notes may explain context but must not be presented as verified original/process/result trace.",
      entries: [
        {
          sessionId: "session-0001",
          title: "Workspace bootstrap",
          status: "complete",
          phase: "governance-open",
          originalRequest: bootstrapTaskTrace.originalRequest,
          processSummary: bootstrapTaskTrace.processSummary,
          resultSummary: bootstrapTaskTrace.resultSummary,
          traceIntegrity: bootstrapTraceIntegrity,
          residualRisk:
            "Bootstrap projections are not real service, VCS, release, owner, or operations evidence.",
          evidenceRefs: bootstrapSessionEvidenceRefs,
          nextStep:
            "Verify projections, connect VCS evidence, and open the first governed session.",
          recordedAt: BOOTSTRAP_TIME,
          source: bootstrapTaskTrace.source,
        },
      ],
    },
    decisionContracts: [
      {
        id: "decision-first-governed-goal",
        status: "pending",
        owner: "stakeholder-product-owner",
        decision: "Confirm the first governed goal for this workspace.",
        alternatives: ["greenfield service creation", "running service adoption", "legacy modernization"],
        evidence: ["event-000001-bootstrap"],
        reversalCondition: "Stakeholder changes project lifecycle mode or scope.",
        stakeholderImpact:
          "Determines which service, environment, release, and readiness gates become mandatory first.",
        approvalThreshold: "Explicit stakeholder or operator confirmation.",
      },
      {
        id: "decision-agent-platform-selection",
        status: "pending",
        owner: "stakeholder-product-owner",
        decision: "Confirm which AI agent platforms are actively used for this project.",
        alternatives: [
          "use auto-detected platforms",
          "declare a single active platform",
          "declare multiple active platforms",
          "mark stale generated instructions as unused-instruction",
        ],
        evidence: ["agentPlatformGovernance"],
        reversalCondition:
          "The team adopts, retires, or changes an AI agent platform or instruction source.",
        stakeholderImpact:
          "Controls which platform-specific instruction files are authoritative, which are unused, and how future Agents should coordinate with the dashboard.",
        approvalThreshold:
          "User declaration recorded with dashboard-ops.mjs record-agent-platforms or an equivalent MCP governance event.",
      },
      ...domainStress.decisionContracts,
    ],
    agile: {
      iteration: {
        id: "iteration-bootstrap",
        status: "planned",
        goal: params.purpose,
      },
      backlog: [
        ...domainStress.workItems,
      ],
      review: { status: "not-started", dueAt: "TBD" },
      retro: { status: "not-started", lastInsight: "no-new-learning" },
      improvementActions: [],
      definitionOfReady: projectWorldModel.cadence.definitionOfReady,
      definitionOfDone: projectWorldModel.cadence.definitionOfDone,
      gates: contracts.serviceCreationContract.readinessGates,
    },
    agileCadence: {
      iteration: {
        id: "iteration-bootstrap",
        status: "planned",
        goal: params.purpose,
      },
      backlog: [
        ...domainStress.workItems,
      ],
      review: { status: "not-started", dueAt: "TBD" },
      retro: { status: "not-started", lastInsight: "no-new-learning" },
      improvementActions: [],
      definitionOfReady: projectWorldModel.cadence.definitionOfReady,
      definitionOfDone: projectWorldModel.cadence.definitionOfDone,
      gates: contracts.serviceCreationContract.readinessGates,
    },
    taskQueues: {
      waiting: [],
      inProgress: [],
      completed: [],
      blocked: domainStress.workItems.map((item) => item.id),
      needsUser: [
        "decision-first-governed-goal",
        ...domainStress.decisionContracts.map((decision) => decision.id),
      ],
      realWorld: [],
      failed: [],
    },
    agentTaskQueues: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      visibilityPolicy:
        "Agent-only dashboard maintenance tasks stay out of stakeholder task boards, reports, and presentation inputs.",
      waiting: agentMaintenanceTasks.map((item) => item.id),
      inProgress: [],
      completed: [],
      blocked: [],
      maintenance: agentMaintenanceTasks,
      hiddenFromUserTaskBoard: [
        ...agentMaintenanceTasks.map((item) => item.id),
        "session-0001",
      ],
    },
    userTaskBoard: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      source: "taskQueues/workTimeline filtered to user-visible work",
      generatedAt: BOOTSTRAP_TIME,
      visibilityPolicy:
        "Show user-owned project work only; dashboard bootstrap, listener, projection, and indexing chores are AI Agent maintenance.",
      current: [],
      remaining: userTaskBoardRemainingIds,
      completed: [],
      blocked: domainStress.workItems
        .filter((item) => String(item.status || "").toLowerCase() === "blocked")
        .map((item) => item.id),
      needsUser: [
        "decision-first-governed-goal",
        ...domainStress.decisionContracts.map((decision) => decision.id),
      ],
      hiddenAgentTaskIds: [
        ...agentMaintenanceTasks.map((item) => item.id),
        "session-0001",
      ],
      emptyState:
        "No project task is active yet. Confirm the first governed goal or add domain work before treating the board as operational.",
    },
    workTimeline: {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      defaultRange: "this-month",
      rangePresets: [
        "this-month",
        "this-quarter",
        "this-year",
        "last-year",
        "all",
      ],
      kpiUses: [
        "cycle-time",
        "lead-time",
        "blocked-duration",
        "throughput",
        "wip-aging",
        "handover-latency",
      ],
      items: [...domainStress.workItems],
      openSourceAdapters: [
        {
          name: "Frappe Gantt",
          use: "task span rendering when a future bundled adapter is allowed",
          license: "MIT",
        },
        {
          name: "Apache ECharts",
          use: "timeline and KPI charts for optional backend dashboards",
          license: "Apache-2.0",
        },
        {
          name: "Mermaid",
          use: "governance and dependency diagrams in docs exports",
          license: "MIT",
        },
        {
          name: "Cytoscape.js",
          use: "dependency graph visualization for optional backend dashboards",
          license: "MIT",
        },
      ],
      singleFileConstraint:
        "the 4.6.5 HTML ships a native SVG/HTML Gantt renderer so the dashboard remains single-file, CDN-free, and shareable offline.",
    },
    listener: {
      workspaceId,
      statePathHash: stableHash("docs/ai-harness/dashboard/state/dashboard-state.json"),
      pid: null,
      pidStartTime: null,
      commandHash: null,
      host: "127.0.0.1",
      port: null,
      url: null,
      tokenPath: "docs/ai-harness/dashboard/state/api-token",
      logPath: "docs/ai-harness/dashboard/logs/dashboard-bridge.log",
      startedAt: null,
      lastHeartbeatAt: null,
      lastHealthCheckAt: null,
      lifecycle: "auto-restored-on-harness-activity",
      readOnly: true,
      authPolicy: "local token required; Host and Origin must be loopback; CORS disabled.",
    },
    dictionary: {
      entries: [
        {
          termId: "term-project-world-model",
          label: "Project World Model",
          type: "domainConcept",
          aliases: ["Harness Dashboard 4.6.5", "world model"],
          definition:
            "The durable ontology and evidence-backed projection set that describes the project reality for stakeholders and AI Agents.",
          owner: "harness-dashboard-operator",
          sourceRefs: ["event-000001-bootstrap"],
          status: "promoted",
          validFrom: BOOTSTRAP_TIME,
          confidence: "high",
        },
        {
          termId: "term-auto-restored-listener",
          label: "Auto-Restored Local Listener",
          type: "workflow",
          aliases: ["dashboard bridge", "local read-only helper"],
          definition:
            "A loopback-only read API/SSE bridge restored by harness activity, not a default OS daemon.",
          owner: "harness-dashboard-operator",
          sourceRefs: ["dashboard-runtime"],
          status: "active",
          validFrom: BOOTSTRAP_TIME,
          confidence: "medium",
        },
      ],
      relations: [
        {
          from: "term-auto-restored-listener",
          to: "term-project-world-model",
          relation: "supports",
        },
      ],
    },
    ontology: {
      root: "projectWorldModel",
      terms: [
        "mission",
        "stakeholders",
        "products",
        "services",
        "environments",
        "repos",
        "dataAssets",
        "dependencies",
        "risks",
        "decisions",
        "cadence",
        "metrics",
        "constraints",
      ],
      relationTypes: [
        "sameAs",
        "replaces",
        "broaderThan",
        "narrowerThan",
        "conflictsWith",
        "supports",
      ],
      interoperabilityRule:
        "Project-specific ontology extensions must preserve these root anchors so AI Agents can resume across projects.",
    },
    workDictionary: {
      entries: [
        {
          termId: "term-project-world-model",
          label: "Project World Model",
          type: "domainConcept",
          aliases: ["Harness Dashboard 4.6.5", "world model"],
          definition:
            "The durable ontology and evidence-backed projection set that describes the project reality for stakeholders and AI Agents.",
          owner: "harness-dashboard-operator",
          sourceRefs: ["event-000001-bootstrap"],
          status: "promoted",
          validFrom: BOOTSTRAP_TIME,
          confidence: "high",
        },
        {
          termId: "term-auto-restored-listener",
          label: "Auto-Restored Local Listener",
          type: "workflow",
          aliases: ["dashboard bridge", "local read-only helper"],
          definition:
            "A loopback-only read API/SSE bridge restored by harness activity, not a default OS daemon.",
          owner: "harness-dashboard-operator",
          sourceRefs: ["dashboard-runtime"],
          status: "active",
          validFrom: BOOTSTRAP_TIME,
          confidence: "medium",
        },
      ],
      relations: [
        {
          from: "term-auto-restored-listener",
          to: "term-project-world-model",
          relation: "supports",
        },
      ],
    },
    embeddingProjection: {
      projectionVersion: DASHBOARD_PROJECTION_VERSION,
      policy: {
        allowedByDefault: ["public", "internal"],
        blockedByDefault: ["restricted", "secret"],
        note:
          "Restricted or secret material must not be embedded unless an explicit governance event allows it.",
      },
      documents: [
        {
          docId: `${workspaceId}:bootstrap-world-model`,
          sourceRefs: ["event-000001-bootstrap", "projectWorldModel"],
          sourceHash: sourceStateHash,
          chunkHash: stableHash(`${workspaceId}:bootstrap-world-model`),
          chunkStrategy: "world-model-summary",
          metadata: {
            workspaceId,
            projectType,
            purpose: params.purpose,
          },
          text: `${params.workspaceName}: ${params.purpose}`,
          language: params.docLanguage ?? "Korean",
          sensitivity: "internal",
          redactionPolicy:
            "exclude local runtime ports, tokens, PIDs, and secret references",
          model: "not-embedded",
          dimension: 0,
          sourceEventSequence: BOOTSTRAP_SEQUENCE,
          embeddingStatus: "pending",
        },
      ],
    },
    embeddingDocuments: [
      {
        docId: `${workspaceId}:bootstrap-world-model`,
        sourceRefs: ["event-000001-bootstrap", "projectWorldModel"],
        sourceHash: sourceStateHash,
        chunkHash: stableHash(`${workspaceId}:bootstrap-world-model`),
        chunkStrategy: "world-model-summary",
        metadata: {
          workspaceId,
          projectType,
          purpose: params.purpose,
        },
        text: `${params.workspaceName}: ${params.purpose}`,
        language: params.docLanguage ?? "Korean",
        sensitivity: "internal",
        redactionPolicy: "exclude local runtime ports, tokens, PIDs, and secret references",
        model: "not-embedded",
        dimension: 0,
        sourceEventSequence: BOOTSTRAP_SEQUENCE,
        embeddingStatus: "pending",
      },
    ],
    operationsTimeline: [
      {
        id: "timeline-bootstrap",
        type: "dashboard-bootstrap",
        status: "complete",
        occurredAt: BOOTSTRAP_TIME,
        summary: "Harness Dashboard 4.6.5 world model bootstrap generated.",
        evidenceRefs: ["event-000001-bootstrap"],
      },
    ],
    releaseReadiness: {
      releases: [],
      requiredTraceability: [
        "release id",
        "version",
        "commit or revision",
        "build artifact",
        "CI run",
        "target environment",
        "approver",
        "deployment window",
        "migration status",
        "feature flags changed",
        "smoke test result",
        "rollback command",
        "post-deploy verification",
      ],
      status: "not-connected",
    },
    incidentReadiness: {
      severityTaxonomy: ["sev1", "sev2", "sev3", "sev4"],
      escalationOwner: "TBD",
      runbookLinks: [],
      knownFailureModes: [],
      activeIncidents: [],
      recentIncidents: [],
      mitigationStatus: "not-connected",
      backupRestoreStatus: "unknown",
      rto: "TBD",
      rpo: "TBD",
      freezeWindows: [],
      unresolvedOperationalRisks: ["Bootstrap state has no incident evidence yet."],
    },
    sloSli: {
      availability: "TBD",
      latency: "TBD",
      errorRate: "TBD",
      saturation: "TBD",
      freshness: "TBD",
      queueDepth: "TBD",
      syntheticChecks: [],
      dependencyHealth: [],
      lastTelemetryTimestamp: null,
    },
    databaseReadiness: contracts.runningServiceContract.databaseOperations,
    worldModelCompleteness: {
      score: 12,
      maxScore: 100,
      servicesMapped: true,
      ownersAssigned: false,
      environmentsKnown: false,
      evidenceLinked: true,
      decisionsCurrent: false,
      risksReviewed: false,
      status: "bootstrap",
    },
    vcsChangeRecords: [],
    versionControl: {
      provider: "unknown",
      status: "assessment-required",
      currentBranchOrRevision: "TBD",
      workingCopyStatus: "unknown",
      ledger: [],
      unlinkedChanges: [],
      collectionProvenance: {
        command: "TBD",
        cwd: ".",
        exitCode: null,
        capturedAt: "bootstrap",
        parserVersion: DASHBOARD_SCHEMA_VERSION,
        completeness: "partial",
      },
    },
    // Runtime-facing facade fields projected from the 4.6.5 world model.
    executiveSummary: {
      headline: `${params.workspaceName} Project World Model`,
      overallStatus: "bootstrap",
      currentStage: "governance-open",
      overallProgressPercent: 8,
      nextDecision: "Confirm the first governed goal and service lifecycle mode.",
      lastUpdated: BOOTSTRAP_TIME,
      audienceNote:
        "This first viewport is designed for stakeholders, maintainers, and AI Agents to share the same project reality.",
    },
    progressState: {
      activeGoal: params.purpose,
      activeChunk: "chunk-00-bootstrap-world-model",
      currentOwner: "harness-dashboard-operator",
      blocked: false,
      riskLevel: "medium",
      nextAction:
        "Verify projections, connect VCS evidence, then open the first governed harness session.",
      stageChecklist,
      workstreams: [
        {
          id: "world-model",
          label: "Project World Model",
          owner: "harness-dashboard-operator",
          status: "in-progress",
          progressPercent: 15,
          note: "Bootstrap ontology and projections exist; real service evidence still needs to be connected.",
        },
      ],
    },
    governanceState: {
      policyId: "project-world-model-4-6",
      policyLabel: "Harness Dashboard 4.6.5 Hypertext Project World Model",
      status: "active",
      sessionGovernanceRule:
        "Every meaningful AI session must append canonical events, refresh projections, and leave an agent resume brief.",
      latestApprovedStage: "governance-open",
      goalFrozen: false,
      dashboardSyncStatus: "bootstrap",
      requiredArtifacts: [
        ...authoritativeFiles,
        "docs/ai-harness/dashboard/index.html",
        "docs/ai-harness/dashboard/schemas/events/harness-event.schema.json",
        "docs/ai-harness/dashboard/schemas/entities/project-world-model.schema.json",
        "docs/ai-harness/dashboard/schemas/projections/dashboard-state.schema.json",
        "docs/ai-harness/domain-stress-playbooks.md",
        "docs/ai-harness/domain-stress-profiles.json",
      ],
      requiredKpiIds: kpiProfile.requiredKpiIds,
      mandatorySessionFields: [
        "goal",
        "chunkId",
        "governance.opened",
        "verification.reviewStatus",
        "nextStep",
        "agentResumeBrief",
      ],
      visibilityRule:
        "Critical UI facts must also exist in dashboard-index.json or the versioned local API.",
    },
    kpiProfile,
    kpis: requiredKpis.map((definition) => ({
      id: definition.id,
      label: definition.label,
      value: definition.defaultValue,
      target: definition.target,
      status: definition.defaultStatus,
      interpretation: definition.defaultInterpretation,
      perspectives: definition.perspectives,
      required: true,
    })),
    errors: [
      {
        id: "bootstrap-evidence-gap",
        severity: "info",
        status: "open",
        summary:
          "Replace bootstrap projections with ledger-backed project, service, VCS, and operations evidence.",
        owner: "harness-dashboard-operator",
        firstSeenAt: BOOTSTRAP_TIME,
        lastSeenAt: BOOTSTRAP_TIME,
      },
    ],
    gitStatus: {
      repositoryExpected: true,
      trackedByGit: "unknown",
      provider: "git",
      defaultBranch: "main",
      currentBranch: "TBD",
      lastCommit: {
        sha: "TBD",
        message: "TBD",
        author: "TBD",
        committedAt: "TBD",
      },
      workingTree: {
        status: "unknown",
        stagedChanges: "TBD",
        unstagedChanges: "TBD",
        untrackedFiles: "TBD",
      },
      auditExpectations: [
        "Link commits or SVN revisions to sessions, tasks, decisions, or mark them as governance warnings.",
        "Refresh VCS evidence after each meaningful session close.",
      ],
    },
    sessionLog: [
      {
        id: "session-0001",
        title: "Workspace bootstrap",
        status: "complete",
        stage: "governance-open",
        startedAt: BOOTSTRAP_TIME,
        endedAt: BOOTSTRAP_TIME,
        owner: "workspace-init-mcp",
        outputs: bootstrapSessionEvidenceRefs,
        taskTrace: bootstrapTaskTrace,
        traceIntegrity: bootstrapTraceIntegrity,
        note: "Initial project world model, ledger, projections, and dashboard generated.",
      },
    ],
    governedSessions: [
      {
        id: "session-0001",
        title: "Workspace bootstrap",
        status: "complete",
        owner: "workspace-init-mcp",
        agentRole: "initializer",
        governanceStatus: "governed",
        goal: "Bootstrap the project world model and dashboard governance surfaces.",
        chunkId: "chunk-00-bootstrap-world-model",
        startedAt: BOOTSTRAP_TIME,
        endedAt: BOOTSTRAP_TIME,
        governance: {
          opened: true,
          latestPlanRound: 1,
          latestReviewRound: 0,
          goalFrozen: false,
          contractApproved: false,
          independentEvaluationPassed: false,
          governanceRefreshed: false,
          closeoutReady: false,
          evidenceFreshness: "bootstrap",
        },
        verification: {
          testsStatus: "not-applicable",
          reviewStatus: "pending",
          remediationStatus: "not-started",
        },
        git: {
          branch: "TBD",
          commit: "TBD",
        },
        outputs: bootstrapSessionEvidenceRefs,
        taskTrace: bootstrapTaskTrace,
        traceIntegrity: bootstrapTraceIntegrity,
        residualRisk:
          "Bootstrap projections are not real service, VCS, release, owner, or operations evidence.",
        nextStep:
          "Verify projections, connect VCS evidence, and open the first governed session.",
      },
    ],
    artifacts,
    domainLens: {
      mode: domainMode,
      title: "Project World Model",
      primaryQuestion:
        "Can a stakeholder and the next AI Agent understand the same project reality without chat history?",
      activeStressProfiles: domainStress.activeProfileIds,
      operationsProjection: "domainOperations",
      reportSections: domainStress.reportSections,
    },
    timeline: [
      {
        id: "timeline-bootstrap",
        label: "dashboard 4.6.5 Bootstrap",
        type: "governance",
        status: "complete",
        owner: "workspace-init-mcp",
        note: "Project World Model projections generated.",
      },
    ],
    entities: [
      {
        id: workspaceId,
        label: params.workspaceName,
        type: "project-world",
        status: "bootstrap",
        summary: params.purpose,
      },
      ...domainStress.profiles.map((profile) => ({
        id: `domain-stress:${profile.id}`,
        label: profile.label,
        type: "domain-stress-profile",
        status: "evidence-required",
        summary: profile.operatingQuestion,
      })),
    ],
    versionLedger: [
      {
        id: "harness-dashboard-4-6",
        label: "Harness Dashboard 4.6.5",
        status: "bootstrap",
        scope: "Project World Model",
        progressPercent: 8,
      },
    ],
    runtimeOrchestration: {
      mode: "planner-generator-evaluator",
      activeSessionId: null,
      activeChunkId: "chunk-unset",
      currentPhase: "awaiting-session-start",
      nextActor: "planner",
      nextAction:
        "Start the first governed runtime session after projection verification.",
      contextPolicy:
        "Prefer explicit agent resume briefs over relying on chat history.",
      contractCoverageRule:
        "No implementation begins before a ledger-backed chunk contract and done criteria exist.",
      evaluatorRule:
        "Generator output must be independently evaluated before closeout.",
      lastEventAt: BOOTSTRAP_TIME,
      stateFile: "docs/ai-harness/runtime/state/active-session.json",
      sessionIndexFile: "docs/ai-harness/runtime/state/session-index.json",
      sessionSummaryFile: "docs/ai-harness/runtime/sessions/",
      workPacketFile: "docs/ai-harness/runtime/state/current-work-packet.json",
      nativeExecutionStateFile:
        "docs/ai-harness/runtime/state/current-native-execution.json",
      nativeExecutionPlanFile: null,
      nativeExecutorBridgeId: null,
      leaseStatus: "idle",
      leasedAt: null,
      queueDepth: 0,
      queuedSessionIds: [],
      recentEvents: [
        {
          at: BOOTSTRAP_TIME,
          phase: "governance-open",
          actor: "initializer",
          action: "bootstrap",
          outcome: "project-world-model-created",
          note: "dashboard 4.6.5 projections and canonical ledger initialized.",
        },
      ],
    },
    operationsHealth: {
      status: "not-connected",
      lastUpdated: BOOTSTRAP_TIME,
      summary:
        "Connect real service telemetry, SLO/SLI signals, incidents, releases, and database evidence before treating operations claims as current.",
      traffic: {
        requestsPerMinute: 0,
        activeConnections: 0,
        errorRatePercent: 0,
        source: "not-connected",
      },
      requestResponse: {
        totalRequests: 0,
        successResponses: 0,
        errorResponses: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        slowRequestThresholdMs: 1000,
        recentSamples: [],
      },
      dbcp: {
        status: "unknown",
        poolName: "default",
        activeConnections: 0,
        idleConnections: 0,
        maxConnections: 0,
        waiters: 0,
        validationQuery: "TBD",
        lastCheckAt: "bootstrap",
      },
      incidentLogs: [],
      latencyQueries: [],
      dataSources: [],
    },
    memoryPromotion: {
      status: "watching",
      thresholdScore: 7,
      sourceRoots: [
        "docs/ai-harness/dashboard/events/",
        "docs/ai-harness/runtime/sessions/",
        "docs/work-logs/",
      ],
      evidenceThreshold: {
        minimumOccurrences: 3,
        minimumGovernedSessions: 2,
      },
      candidates: [
        {
          id: "world-model-patterns",
          title: "Repeated project world model patterns",
          status: "watching",
          score: 0,
          occurrences: 0,
          governedSessionCount: 0,
          collisionCheck: "pending",
          decision: "not-ready",
          evidencePaths: [],
          generatedPaths: [],
          nextAction:
            "Mine repeated sessions after real project work begins.",
        },
      ],
    },
  };
}

function buildDashboardIndex(state: Record<string, unknown>) {
  const taskQueues = state.taskQueues as Record<string, string[]>;
  const agentTaskQueues = state.agentTaskQueues as Record<string, string[]>;
  const agentResumeBrief = state.agentResumeBrief as Record<string, unknown>;
  const stakeholderBrief = state.stakeholderBrief as Record<string, unknown>;
  const meta = state.meta as Record<string, unknown>;
  const workTimeline = state.workTimeline as Record<string, unknown>;
  const claimEvidenceMatrix = state.claimEvidenceMatrix as Record<string, unknown>;
  const timelineItems = Array.isArray(workTimeline?.items)
    ? workTimeline.items
    : [];
  const claims = Array.isArray(claimEvidenceMatrix?.claims)
    ? claimEvidenceMatrix.claims
    : [];
  const missingEvidenceItems = Array.isArray(claimEvidenceMatrix?.missingEvidenceItems)
    ? claimEvidenceMatrix.missingEvidenceItems
    : [];
  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    apiVersion: DASHBOARD_API_VERSION,
    workspaceId: meta.workspaceId,
    projectionVersion: DASHBOARD_PROJECTION_VERSION,
    sourceEventSequence: meta.sourceEventSequence,
    sourceStateHash: meta.sourceStateHash,
    generatedAt: BOOTSTRAP_TIME,
    expiresAt: "after-first-refresh",
    completeness: "partial",
    staleness: "bootstrap",
    stakeholderBrief,
    agentResumeBrief,
    worldJudgment: state.worldJudgment,
    judgmentConsole: state.judgmentConsole,
    criticalSignals: state.criticalSignals,
    readinessJudgments: state.readinessJudgments,
    trustBoundary: state.trustBoundary,
    dashboardQualityScorecard: state.dashboardQualityScorecard,
    projectionConfidence: state.projectionConfidence,
    sessionTraceability: state.sessionTraceability,
    governanceActionabilityScore: state.governanceActionabilityScore,
    agentPlatformGovernance: state.agentPlatformGovernance,
    audienceLens: state.audienceLens,
    realityModel: state.realityModel,
    goalCompass: state.goalCompass,
    contextRotMonitor: state.contextRotMonitor,
    harnessEvaluation: state.harnessEvaluation,
    cognitiveOffloading: state.cognitiveOffloading,
    worldModelImprovementContract: state.worldModelImprovementContract,
    workReadinessMap: state.workReadinessMap,
    projectEvidenceInventory: state.projectEvidenceInventory,
    claimSummary: {
      claimCount: claims.length,
      missingEvidenceItemCount: missingEvidenceItems.length,
      unsupportedClaimCount: claims.filter((claim) =>
        ["missing-evidence", "contradicted", "stale"].includes(
          String((claim as Record<string, unknown>).claimStatus || "")
        )
      ).length,
    },
    agentContextPacks: state.agentContextPacks,
    userTaskBoard: state.userTaskBoard,
    taskCounts: Object.fromEntries(
      Object.entries(taskQueues).map(([key, value]) => [key, value.length])
    ),
    agentTaskCounts: Object.fromEntries(
      Object.entries(agentTaskQueues)
        .filter(([, value]) => Array.isArray(value))
        .map(([key, value]) => [key, value.length])
    ),
    timelineSummary: {
      itemCount: timelineItems.length,
      defaultRange: workTimeline?.defaultRange ?? "this-month",
      kpiUses: workTimeline?.kpiUses ?? [],
    },
    currentGoal: stakeholderBrief.currentGoal,
    nextAction: agentResumeBrief.nextSafestAction,
    criticalRisks: ["bootstrap-evidence-gap"],
    authoritativeFiles: agentResumeBrief.authoritativeFiles,
    apiRoutes: [
      "/api/harness-dashboard/v1/snapshot",
      "/api/harness-dashboard/v1/index",
      "/api/harness-dashboard/v1/tasks",
      "/api/harness-dashboard/v1/agent-tasks",
      "/api/harness-dashboard/v1/traceability",
      "/api/harness-dashboard/v1/sessions",
      "/api/harness-dashboard/v1/dictionary",
      "/api/harness-dashboard/v1/version-control",
      "/api/harness-dashboard/v1/runtime",
      "/api/harness-dashboard/v1/briefing",
      "/api/harness-dashboard/v1/health",
      "/api/harness-dashboard/v1/events",
      "/api/harness-dashboard/v1/query",
    ],
  };
}

function buildDashboardRuntime(state: Record<string, unknown>) {
  const meta = state.meta as Record<string, unknown>;
  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    apiVersion: DASHBOARD_API_VERSION,
    workspaceId: meta.workspaceId,
    listener: {
      status: "not-started",
      lifecycle: "auto-restored-on-harness-activity",
      statePathHash: stableHash("docs/ai-harness/dashboard/state/dashboard-state.json"),
      host: "127.0.0.1",
      port: null,
      url: null,
      pid: null,
      pidStartTime: null,
      commandHash: null,
      tokenPath: "docs/ai-harness/dashboard/state/api-token",
      logPath: "docs/ai-harness/dashboard/logs/dashboard-bridge.log",
      lockPath: "docs/ai-harness/dashboard/state/dashboard-listener.lock",
      startedAt: null,
      lastHeartbeatAt: null,
      lastHealthCheckAt: null,
      lastFailure: null,
    },
    projectionVersion: DASHBOARD_PROJECTION_VERSION,
    sourceEventSequence: meta.sourceEventSequence,
    sourceStateHash: meta.sourceStateHash,
    generatedAt: BOOTSTRAP_TIME,
    completeness: "partial",
    staleness: "bootstrap",
  };
}

function buildBootstrapEvent(params: WorkspaceInitParams, state: Record<string, unknown>) {
  const workspaceId = String((state.meta as Record<string, unknown>).workspaceId);
  const payload = {
    workspaceName: params.workspaceName,
    purpose: params.purpose,
    dashboardVersion: DASHBOARD_SCHEMA_VERSION,
    projectionFiles: [
      "state/dashboard-state.json",
      "state/dashboard-index.json",
      "state/dashboard-runtime.json",
      "state/embedding-documents.json",
    ],
  };
  const payloadHash = stableHash(payload);
  const event = {
    eventId: "event-000001-bootstrap",
    sequence: BOOTSTRAP_SEQUENCE,
    eventType: "workspace.dashboard.bootstrap",
    eventVersion: "1.0.0",
    workspaceId,
    aggregateId: workspaceId,
    aggregateType: "projectWorldModel",
    aggregateVersion: 1,
    occurredAt: BOOTSTRAP_TIME,
    recordedAt: BOOTSTRAP_TIME,
    actor: "workspace-init-mcp",
    agentId: "workspace-init-mcp",
    sourceTool: "initialize_workspace",
    correlationId: "bootstrap",
    causationId: null,
    idempotencyKey: `dashboard-bootstrap:${workspaceId}`,
    payloadHash,
    previousEventHash: "genesis",
    redactionLevel: "internal",
    payload,
  };
  return {
    ...event,
    eventHash: stableHash({ ...event, eventHash: undefined }),
  };
}

function buildLedgerManifest(event: Record<string, unknown>) {
  const eventHash = String(event.eventHash);
  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    workspaceId: event.workspaceId,
    ledgerPath: "docs/ai-harness/dashboard/events/harness-events.jsonl",
    segments: [
      {
        id: "segment-000001-000001",
        path: "docs/ai-harness/dashboard/events/harness-events.jsonl",
        firstSequence: 1,
        lastSequence: 1,
        rowCount: 1,
        schemaVersion: DASHBOARD_SCHEMA_VERSION,
        segmentHash: eventHash,
        compactionStatus: "hot",
      },
    ],
    firstSequence: 1,
    lastSequence: 1,
    rowCount: 1,
    rootHash: eventHash,
    lastVerifiedAt: BOOTSTRAP_TIME,
    compactionStatus: "not-compacted",
  };
}

function buildSchema(title: string, required: string[]): string {
  return `${JSON.stringify(
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title,
      type: "object",
      required,
      additionalProperties: true,
      properties: Object.fromEntries(required.map((key) => [key, {}])),
    },
    null,
    2
  )}\n`;
}

function buildDashboardStateSchema(): string {
  const properties: Record<string, unknown> = Object.fromEntries(
    DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS.map((key) => [key, {}])
  );
  properties.taskQueues = {
    type: "object",
    required: ["waiting", "inProgress", "completed", "blocked", "needsUser"],
    additionalProperties: true,
    properties: {
      waiting: { type: "array", items: { type: "string" } },
      inProgress: { type: "array", items: { type: "string" } },
      completed: { type: "array", items: { type: "string" } },
      blocked: { type: "array", items: { type: "string" } },
      needsUser: { type: "array", items: { type: "string" } },
      realWorld: { type: "array", items: { type: "string" } },
      failed: { type: "array", items: { type: "string" } },
    },
  };
  properties.agentTaskQueues = {
    type: "object",
    required: ["waiting", "inProgress", "completed", "blocked"],
    additionalProperties: true,
    properties: {
      waiting: { type: "array", items: { type: "string" } },
      inProgress: { type: "array", items: { type: "string" } },
      completed: { type: "array", items: { type: "string" } },
      blocked: { type: "array", items: { type: "string" } },
      hiddenFromUserTaskBoard: { type: "array", items: { type: "string" } },
      maintenance: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "status", "title", "owner", "queueVisibility"],
          additionalProperties: true,
        },
      },
    },
  };
  properties.userTaskBoard = {
    type: "object",
    required: ["current", "remaining", "completed", "hiddenAgentTaskIds"],
    additionalProperties: true,
    properties: {
      current: { type: "array", items: { type: "string" } },
      remaining: { type: "array", items: { type: "string" } },
      completed: { type: "array", items: { type: "string" } },
      blocked: { type: "array", items: { type: "string" } },
      needsUser: { type: "array", items: { type: "string" } },
      hiddenAgentTaskIds: { type: "array", items: { type: "string" } },
    },
  };
  properties.claimEvidenceMatrix = {
    type: "object",
    required: ["claims", "missingEvidenceItems"],
    additionalProperties: true,
    properties: {
      claims: {
        type: "array",
        items: {
          type: "object",
          required: ["claimId", "statement", "claimStatus", "confidence", "evidenceRefs"],
          additionalProperties: true,
          properties: {
            claimId: { type: "string" },
            statement: { type: "string" },
            claimStatus: { type: "string" },
            confidence: { type: "number" },
            evidenceRefs: { type: "array", items: { type: "string" } },
          },
        },
      },
      missingEvidenceItems: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "label", "blocksClaimIds", "requiredEvidenceType", "owner", "resolutionTaskId"],
          additionalProperties: true,
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            blocksClaimIds: { type: "array", items: { type: "string" } },
            requiredEvidenceType: { type: "string" },
            owner: { type: "string" },
            resolutionTaskId: { type: "string" },
            queueVisibility: { type: "string" },
          },
        },
      },
    },
  };
  properties.domainStress = {
    type: "object",
    required: [
      "schemaVersion",
      "activeProfileIds",
      "profiles",
      "claims",
      "missingEvidenceItems",
      "workItems",
      "decisionContracts",
      "hardGates",
      "reportSections",
    ],
    additionalProperties: true,
    properties: {
      schemaVersion: { type: "string" },
      activeProfileIds: { type: "array", items: { type: "string" } },
      profiles: { type: "array" },
      claims: { type: "array" },
      missingEvidenceItems: { type: "array" },
      workItems: { type: "array" },
      decisionContracts: { type: "array" },
      hardGates: { type: "array" },
      reportSections: { type: "array" },
    },
  };
  properties.domainOperations = {
    type: "object",
    required: ["schemaVersion", "activeProfileIds", "status", "programs"],
    additionalProperties: true,
    properties: {
      schemaVersion: { type: "string" },
      activeProfileIds: { type: "array", items: { type: "string" } },
      status: { type: "string" },
      programs: { type: "array" },
    },
  };
  properties.realityModel = {
    type: "object",
    required: ["schemaVersion", "purpose", "nodes", "edges", "missingRelationEvidence", "updateRule"],
    additionalProperties: true,
    properties: {
      schemaVersion: { type: "string" },
      purpose: { type: "string" },
      nodes: { type: "array" },
      edges: { type: "array" },
      missingRelationEvidence: { type: "array" },
      updateRule: { type: "string" },
    },
  };
  properties.goalCompass = {
    type: "object",
    required: ["schemaVersion", "currentReality", "goalState", "goalGraph", "topGaps", "nextSafeMove", "alignmentChecks", "phaseGate"],
    additionalProperties: true,
    properties: {
      schemaVersion: { type: "string" },
      currentReality: { type: "string" },
      goalState: { type: "string" },
      goalGraph: { type: "array" },
      topGaps: { type: "array" },
      nextSafeMove: { type: "string" },
      alignmentChecks: { type: "array", items: { type: "string" } },
      phaseGate: { type: "object" },
    },
  };
  properties.contextRotMonitor = {
    type: "object",
    required: ["schemaVersion", "status", "rotWarnings", "factRecords", "expiredFacts", "nextEvidenceToCollect"],
    additionalProperties: true,
    properties: {
      schemaVersion: { type: "string" },
      status: { type: "string" },
      rotWarnings: { type: "array" },
      factRecords: { type: "array" },
      expiredFacts: { type: "array", items: { type: "string" } },
      nextEvidenceToCollect: { type: "array", items: { type: "string" } },
    },
  };
  properties.harnessEvaluation = {
    type: "object",
    required: ["schemaVersion", "scope", "status", "score", "thresholdScore", "sourceStateHash", "evaluatedAt", "evaluator", "metrics", "gates"],
    additionalProperties: true,
    properties: {
      schemaVersion: { type: "string" },
      scope: { type: "string" },
      status: { type: "string" },
      score: { type: "number" },
      thresholdScore: { type: "number" },
      sourceStateHash: { type: "string" },
      evaluatedAt: { type: "string" },
      evaluator: { type: "string" },
      metrics: { type: "array" },
      gates: { type: "object" },
    },
  };
  properties.decisionContracts = {
    type: "array",
    items: {
      type: "object",
      required: ["id", "status", "owner", "decision", "evidence"],
      additionalProperties: true,
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        owner: { type: "string" },
        decision: { type: "string" },
        evidence: { type: "array", items: { type: "string" } },
      },
    },
  };
  properties.workTimeline = {
    type: "object",
    required: ["items"],
    additionalProperties: true,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "title", "status", "owner", "evidenceRefs"],
          additionalProperties: true,
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            status: { type: "string" },
            owner: { type: "string" },
            evidenceRefs: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  };
  properties.projectionConfidence = {
    type: "object",
    required: [
      "status",
      "completeness",
      "staleness",
      "trustBoundaryStatus",
      "missingEvidenceCount",
      "openDecisionCount",
      "actionGate",
      "requiredActions",
    ],
    additionalProperties: true,
    properties: {
      status: { type: "string" },
      completeness: { type: "string" },
      staleness: { type: "string" },
      trustBoundaryStatus: { type: "string" },
      missingEvidenceCount: { type: "number" },
      openDecisionCount: { type: "number" },
      actionGate: { type: "string" },
      userMessage: { type: "string" },
      requiredActions: { type: "array", items: { type: "string" } },
      evidenceRefs: { type: "array", items: { type: "string" } },
    },
  };
  properties.sessionTraceability = {
    type: "object",
    required: ["status", "purpose", "integrityPolicy", "entries"],
    additionalProperties: true,
    properties: {
      status: { type: "string" },
      purpose: { type: "string" },
      integrityPolicy: { type: "string" },
      entries: {
        type: "array",
        items: {
          type: "object",
          required: [
            "sessionId",
            "status",
            "phase",
            "originalRequest",
            "processSummary",
            "resultSummary",
            "traceIntegrity",
            "evidenceRefs",
            "nextStep",
          ],
          additionalProperties: true,
          properties: {
            sessionId: { type: "string" },
            status: { type: "string" },
            phase: { type: "string" },
            originalRequest: { type: "string" },
            processSummary: { type: "string" },
            resultSummary: { type: "string" },
            traceIntegrity: { type: "object" },
            residualRisk: { type: "string" },
            evidenceRefs: { type: "array", items: { type: "string" } },
            nextStep: { type: "string" },
          },
        },
      },
    },
  };
  properties.dashboardQualityScorecard = {
    type: "object",
    required: ["targetScore", "uiUxDesignScore", "projectEvidenceScore", "qaEvidence", "modernWebUiPolicy"],
    additionalProperties: true,
    properties: {
      targetScore: { type: "number" },
      uiUxDesignScore: { type: "number" },
      projectEvidenceScore: { type: "number" },
      qaEvidence: {
        type: "object",
        required: ["requiredFor95", "status", "note"],
        additionalProperties: true,
        properties: {
          requiredFor95: { type: "array", items: { type: "string" } },
          status: { type: "string" },
          note: { type: "string" },
        },
      },
      modernWebUiPolicy: { type: "object" },
    },
  };
  return `${JSON.stringify(
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Harness Dashboard State Projection",
      type: "object",
      required: [...DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS],
      additionalProperties: true,
      properties,
    },
    null,
    2
  )}\n`;
}

function buildDashboardHtml(params: WorkspaceInitParams, embeddedStateJson: string): string {
  const workspaceName = escapeHtml(params.workspaceName);
  const htmlLang = (params.docLanguage ?? "").toLowerCase().includes("korean")
    ? "ko"
    : "en";
  const bootstrap = escapeInlineJson(embeddedStateJson);
  return `<!doctype html>
<html lang="${htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:* http://localhost:*; img-src 'self' data:; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
    <title>${workspaceName} Harness Dashboard 4.6.5</title>
    <style>
      :root {
        --bg: #f6f8fb;
        --surface: #ffffff;
        --surface-2: #eef3f8;
        --text: #17202a;
        --muted: #52606d;
        --line: #d8e0e8;
        --accent: #1769aa;
        --ok: #1f7a4d;
        --warn: #9a6700;
        --risk: #b42318;
        --info: #3451b2;
        --shadow: 0 10px 30px rgba(23, 32, 42, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Noto Sans KR", Arial, sans-serif;
        color: var(--text);
        background: var(--bg);
        line-height: 1.5;
      }
      .skip-link { position: absolute; left: 16px; top: -80px; background: var(--accent); color: white; padding: 8px 12px; border-radius: 6px; z-index: 10; }
      .skip-link:focus { top: 16px; }
      :focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
      .shell { max-width: 1480px; margin: 0 auto; padding: 24px; }
      .hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items: start; margin-bottom: 16px; }
      h1, h2, h3 { margin: 0; line-height: 1.15; }
      h1 { font-size: 2.2rem; }
      h2 { font-size: 1.25rem; margin-bottom: 12px; }
      h3 { font-size: 1rem; margin-bottom: 8px; }
      .eyebrow { margin: 0 0 6px; color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0; font-size: 0.78rem; }
      .lede, .muted, .source { color: var(--muted); }
      .mode-banner, .status-rail, .panel, .tablist, .control-card, .tab-purpose { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); }
      .control-card { padding: 12px; min-width: 320px; display: grid; gap: 10px; }
      .control-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .control-card label { display: grid; gap: 6px; font-weight: 700; }
      .audience-note { display: block; margin-top: 6px; font-size: 0.78rem; color: var(--muted); max-width: 280px; }
      .lens-statement { border: 1px solid rgba(23, 105, 170, 0.22); border-radius: 8px; background: #f5f9ff; padding: 10px 12px; font-size: 0.86rem; color: var(--text); }
      .lens-statement strong { display: block; margin-bottom: 4px; }
      .report-scope-control { display: grid; gap: 6px; font-weight: 700; }
      .button-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .mode-banner { padding: 12px 14px; margin-bottom: 14px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      .status-rail { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; overflow: hidden; margin-bottom: 14px; }
      .rail-item { padding: 12px; background: #fbfcfd; min-width: 0; }
      .rail-label, .source { font-size: 0.78rem; color: var(--muted); }
      .rail-value { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-weight: 700; overflow: hidden; overflow-wrap: anywhere; }
      .tablist { display: flex; gap: 6px; padding: 8px; margin-bottom: 14px; flex-wrap: wrap; position: sticky; top: 0; z-index: 5; }
      .tab { border: 0; border-radius: 6px; padding: 8px 10px; background: transparent; color: var(--text); font-weight: 700; cursor: pointer; }
      .tab[aria-selected="true"] { background: var(--accent); color: #ffffff; }
      .tab-purpose { padding: 12px 14px; margin-top: -6px; margin-bottom: 14px; display: grid; gap: 4px; }
      .tab-purpose { scroll-margin-top: 72px; }
      .tab-purpose strong { display: block; }
      .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; }
      .panel { padding: 16px; grid-column: span 6; min-width: 0; }
      .panel-wide { grid-column: span 12; }
      .metric-grid, .card-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .card, .metric { border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; padding: 12px; min-width: 0; }
      .metric strong { display: block; font-size: 1.4rem; overflow-wrap: anywhere; }
      .overview-guide { display: grid; grid-template-columns: minmax(0, 0.62fr) minmax(320px, 0.38fr); gap: 12px; align-items: stretch; }
      .guide-hero { border: 1px solid rgba(23, 105, 170, 0.24); border-radius: 8px; background: linear-gradient(135deg, #f5f9ff, #ffffff); padding: 16px; display: grid; gap: 10px; }
      .guide-hero strong { font-size: 1.45rem; line-height: 1.2; overflow-wrap: anywhere; }
      .guide-steps { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
      .guide-steps li { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; align-items: start; }
      .step-index { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; background: var(--accent); color: #fff; font-size: 0.78rem; font-weight: 800; }
      .guide-strip { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .guide-card { border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; padding: 12px; display: grid; gap: 6px; min-width: 0; }
      .guide-card strong { font-size: 1.2rem; overflow-wrap: anywhere; }
      .guide-card.ok { border-color: rgba(31, 122, 77, 0.28); background: #f3fbf6; }
      .guide-card.info { border-color: rgba(23, 105, 170, 0.24); background: #f5f9ff; }
      .guide-card.warn { border-color: rgba(154, 103, 0, 0.3); background: #fffaf0; }
      .judgment { border-left: 5px solid var(--warn); background: #fffaf0; }
      .judgment.risk { border-left-color: var(--risk); background: #fff7f5; }
      .judgment-console { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr); gap: 12px; }
      .judgment-headline { border: 1px solid rgba(180, 35, 24, 0.24); border-radius: 8px; background: #fff7f5; padding: 14px; display: grid; gap: 10px; }
      .judgment-headline strong { font-size: 1.2rem; }
      .judgment-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .judgment-actions ul { margin: 6px 0 0 18px; padding: 0; }
      .value-strip { display: flex; flex-wrap: wrap; gap: 6px; }
      .value-pill { display: inline-flex; align-items: center; border: 1px solid rgba(23, 105, 170, 0.22); border-radius: 999px; background: #f4f8fc; padding: 4px 8px; font-size: 0.78rem; font-weight: 700; color: var(--accent); }
      .quality-meter { display: grid; gap: 8px; }
      .quality-row { display: grid; grid-template-columns: minmax(150px, 1fr) minmax(0, 2fr) 54px; gap: 8px; align-items: center; }
      .quality-track { height: 10px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
      .quality-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--ok)); }
      .quality-fill.low { background: var(--risk); }
      .actionability { display: grid; gap: 12px; align-items: stretch; }
      .score-duo { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .actionability-score { border: 1px solid rgba(23, 105, 170, 0.24); border-radius: 8px; background: #f5f9ff; padding: 14px; display: grid; place-items: center; text-align: center; min-height: 150px; }
      .actionability-score.secondary { border-color: rgba(154, 103, 0, 0.28); background: #fffaf0; }
      .actionability-score strong { font-size: 2.2rem; }
      .actionability-copy { display: grid; gap: 10px; }
      .decision-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
      .decision-cell { border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; padding: 10px; }
      .decision-cell.ok { border-color: rgba(31, 122, 77, 0.3); background: #f3fbf6; }
      .decision-cell.risk { border-color: rgba(180, 35, 24, 0.28); background: #fff7f5; }
      .reality-action-hub { display: grid; gap: 14px; }
      .hub-brief { border: 1px solid rgba(23, 105, 170, 0.24); border-radius: 8px; background: #f5f9ff; padding: 14px; display: grid; gap: 8px; }
      .hub-brief strong { font-size: 1.25rem; overflow-wrap: anywhere; }
      .hub-grid { display: grid; grid-template-columns: minmax(0, 0.62fr) minmax(280px, 0.38fr); gap: 12px; align-items: start; }
      .hub-list { display: grid; gap: 8px; }
      .hub-item { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 10px; display: grid; gap: 6px; }
      .hub-item strong { overflow-wrap: anywhere; }
      .hub-item.warn { border-color: rgba(154, 103, 0, 0.28); background: #fffaf0; }
      .hub-item.risk { border-color: rgba(180, 35, 24, 0.28); background: #fff7f5; }
      .hub-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .hub-action-button { border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--text); padding: 7px 10px; font-weight: 800; cursor: pointer; }
      .hub-action-button:hover, .hub-action-button:focus-visible { border-color: var(--accent); color: var(--accent); }
      .api-route-list { display: flex; flex-wrap: wrap; gap: 6px; }
      .route-chip { border: 1px solid var(--line); border-radius: 999px; background: #f8fafc; padding: 4px 8px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.72rem; overflow-wrap: anywhere; }
      .trust-boundary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .trust-boundary .metric { border-top: 4px solid var(--accent); }
      .signal-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .signal { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fbfcfd; display: grid; gap: 6px; }
      .signal.critical, .signal.decision-needed { border-color: rgba(180, 35, 24, 0.35); background: #fff7f5; }
      .signal.watching { border-color: rgba(154, 103, 0, 0.35); background: #fffaf0; }
      .signal h3 { margin: 0; }
      .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; background: var(--surface-2); color: var(--text); }
      .badge.ok { background: rgba(31, 122, 77, 0.12); color: var(--ok); }
      .badge.warn { background: rgba(154, 103, 0, 0.14); color: var(--warn); }
      .badge.risk { background: rgba(180, 35, 24, 0.12); color: var(--risk); }
      .badge.info { background: rgba(52, 81, 178, 0.12); color: var(--info); }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; border-bottom: 1px solid var(--line); padding: 8px; vertical-align: top; }
      th { color: var(--muted); font-size: 0.82rem; }
      .table-wrap { overflow-x: auto; }
      .bar { display: grid; gap: 6px; margin-top: 10px; }
      .bar-row { display: grid; grid-template-columns: 130px minmax(0, 1fr) 44px; gap: 8px; align-items: center; }
      .bar-track { height: 10px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
      .bar-fill { height: 100%; background: var(--accent); }
      .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-bottom: 12px; }
      .toolbar label { display: grid; gap: 4px; font-weight: 700; min-width: 180px; }
      .timeline-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
      .timeline-chip { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: #fbfcfd; }
      .timeline-chip strong { display: block; font-size: 1.1rem; }
      .timeline-chip.risk { border-color: rgba(180, 35, 24, 0.3); background: #fff7f5; }
      .work-hero { display: grid; grid-template-columns: minmax(0, 0.7fr) minmax(280px, 0.3fr); gap: 14px; align-items: stretch; }
      .open-work-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .work-card { border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; padding: 12px; display: grid; gap: 10px; min-width: 0; }
      .work-card.blocked { border-color: rgba(180, 35, 24, 0.32); background: #fff7f5; }
      .work-card.in-progress, .work-card.active { border-color: rgba(23, 105, 170, 0.32); background: #f5f9ff; }
      .work-card.completed { border-color: rgba(31, 122, 77, 0.28); background: #f3fbf6; }
      .work-title { font-weight: 800; overflow-wrap: anywhere; }
      .work-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; color: var(--muted); font-size: 0.78rem; }
      .task-board { display: grid; gap: 12px; }
      .task-board-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .task-column { border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; padding: 12px; min-width: 0; display: grid; gap: 9px; align-content: start; }
      .task-column h3 { display: flex; justify-content: space-between; gap: 8px; align-items: center; margin: 0; }
      .task-mini-card { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 10px; display: grid; gap: 6px; }
      .task-mini-card strong { overflow-wrap: anywhere; }
      .agent-maintenance-board { display: grid; gap: 10px; }
      .maintenance-card { border: 1px dashed rgba(82, 96, 109, 0.34); border-radius: 8px; background: #f7f8fa; color: var(--muted); padding: 12px; display: grid; gap: 6px; }
      .maintenance-card strong { color: var(--text); overflow-wrap: anywhere; }
      .progress-track { height: 10px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
      .progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--ok)); }
      .progress-fill.blocked { background: var(--risk); }
      .progress-copy { display: flex; justify-content: space-between; gap: 10px; font-size: 0.82rem; font-weight: 700; }
      .view-switch { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: #fff; }
      .segment { border: 0; border-radius: 0; padding: 8px 12px; background: transparent; color: var(--text); font-weight: 800; cursor: pointer; }
      .segment[aria-pressed="true"] { background: var(--accent); color: #fff; }
      .kanban-board { display: grid; grid-template-columns: repeat(4, minmax(220px, 1fr)); gap: 12px; overflow-x: auto; padding-bottom: 4px; }
      .kanban-column { border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; min-height: 220px; padding: 10px; display: grid; align-content: start; gap: 10px; }
      .kanban-column h3 { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .kanban-card { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 10px; display: grid; gap: 8px; box-shadow: 0 6px 14px rgba(23, 32, 42, 0.05); }
      .kanban-card.in-progress, .kanban-card.active { border-left: 4px solid var(--accent); }
      .kanban-card.blocked, .kanban-card.failed { border-left: 4px solid var(--risk); }
      .kanban-card.completed, .kanban-card.complete { border-left: 4px solid var(--ok); }
      .gantt-legend { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 4px 0 12px; }
      .legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--muted); }
      .status-dot { width: 10px; height: 10px; border-radius: 999px; background: #7a8699; display: inline-block; }
      .status-dot.in-progress, .status-dot.active { background: var(--accent); }
      .status-dot.completed, .status-dot.complete { background: var(--ok); }
      .status-dot.blocked, .status-dot.failed { background: var(--risk); }
      .status-dot.waiting { background: #7a8699; }
      .gantt { display: grid; gap: 0; margin-top: 12px; border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; overflow-x: auto; box-shadow: inset 0 1px 0 rgba(255,255,255,0.8); }
      .gantt-axis, .gantt-row { display: grid; grid-template-columns: minmax(280px, 340px) minmax(680px, 1fr); gap: 12px; align-items: center; min-width: 1020px; }
      .gantt-axis { padding: 12px 12px 8px; background: #f4f7fa; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 1; }
      .gantt-row { padding: 12px; border-bottom: 1px solid var(--line); align-items: start; }
      .gantt-row:last-child { border-bottom: 0; }
      .gantt-row:hover { background: #f8fbff; }
      .gantt-axis-label { color: var(--muted); font-size: 0.78rem; font-weight: 700; }
      .gantt-track { position: relative; min-height: 64px; border: 1px solid var(--line); border-radius: 8px; background-color: #fff; background-image: linear-gradient(90deg, rgba(23, 105, 170, 0.08) 1px, transparent 1px), linear-gradient(0deg, rgba(216, 224, 232, 0.28) 1px, transparent 1px); background-size: 20% 100%, 100% 50%; overflow: hidden; margin-top: 4px; }
      .gantt-phase { position: absolute; top: 0; bottom: 0; border-right: 1px dashed rgba(82, 96, 109, 0.25); background: rgba(238, 243, 248, 0.45); font-size: 0.68rem; color: var(--muted); padding: 2px 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .today-marker { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--risk); opacity: 0.72; z-index: 2; }
      .today-marker::after { content: "today"; position: absolute; top: 2px; left: 5px; font-size: 0.68rem; color: var(--risk); background: #fff; padding: 0 3px; border-radius: 4px; }
      .gantt-gate { position: absolute; top: 8px; bottom: 8px; width: 2px; background: var(--warn); z-index: 2; }
      .gantt-gate::after { content: attr(data-label); position: absolute; top: -5px; left: 6px; font-size: 0.68rem; color: var(--warn); background: #fffaf0; border: 1px solid rgba(154, 103, 0, 0.24); border-radius: 4px; padding: 0 4px; white-space: nowrap; }
      .gantt-bar { position: absolute; top: 15px; height: 34px; min-width: 84px; max-width: calc(100% - 4px); border-radius: 8px; color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 0 10px; font-size: 0.78rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 8px 16px rgba(23, 32, 42, 0.14); }
      .gantt-bar.waiting { background: #7a8699; }
      .gantt-bar.blocked, .gantt-bar.failed { background: var(--risk); }
      .gantt-bar.completed, .gantt-bar.complete { background: var(--ok); }
      .gantt-bar.in-progress, .gantt-bar.active { background: var(--accent); }
      .gantt-bar.in-progress::after, .gantt-bar.active::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.36), transparent); transform: translateX(-100%); animation: ganttPulse 1.8s linear infinite; }
      .gantt-label, .gantt-progress-label { position: relative; z-index: 1; overflow: hidden; text-overflow: ellipsis; }
      .gantt-progress-label { opacity: 0.9; }
      .stack-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .stack-card { border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; padding: 12px; display: grid; gap: 8px; min-width: 0; }
      .stack-card strong { overflow-wrap: anywhere; }
      .architecture-map { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .architecture-node { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fff; min-height: 112px; display: grid; gap: 6px; }
      .architecture-node.primary { border-color: rgba(23, 105, 170, 0.35); background: #f5f9ff; }
      .architecture-node.warn { border-color: rgba(154, 103, 0, 0.35); background: #fffaf0; }
      .world-map-visual { border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; padding: 12px; display: grid; gap: 12px; }
      .world-node-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
      .world-node { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 10px; display: grid; gap: 6px; }
      .world-node-index { width: 26px; height: 26px; border-radius: 50%; background: #e9f3f1; color: var(--accent); display: inline-flex; align-items: center; justify-content: center; font-weight: 800; }
      .world-edge-list { display: flex; flex-wrap: wrap; gap: 8px; }
      .world-edge { border: 1px solid var(--line); border-radius: 999px; background: #fff; padding: 6px 10px; color: var(--muted); font-size: 0.78rem; }
      .platform-intake { display: grid; grid-template-columns: minmax(0, 0.58fr) minmax(320px, 0.42fr); gap: 12px; align-items: start; }
      .platform-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .platform-card { border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; padding: 12px; display: grid; gap: 8px; min-width: 0; }
      .platform-card.active { border-color: rgba(31, 122, 77, 0.3); background: #f3fbf6; }
      .platform-card.unused, .platform-card.unused-instruction { border-color: rgba(154, 103, 0, 0.34); background: #fffaf0; }
      .platform-card label { display: flex; gap: 8px; align-items: flex-start; font-weight: 800; }
      .platform-card input { margin-top: 3px; }
      .platform-output { border: 1px solid var(--line); border-radius: 8px; background: #0f1720; color: #d8f3ff; padding: 12px; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 120px; }
      .gantt-meta { display: grid; gap: 4px; min-width: 0; }
      .gantt-title { font-weight: 700; overflow-wrap: anywhere; }
      .gantt-subtitle { color: var(--muted); font-size: 0.78rem; overflow-wrap: anywhere; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
      .gantt-evidence { margin-top: 4px; color: var(--muted); font-size: 0.74rem; overflow-wrap: anywhere; display: grid; gap: 2px; max-height: 58px; overflow: hidden; }
      .lane-pill { display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 999px; padding: 2px 7px; background: #fff; color: var(--muted); font-size: 0.72rem; }
      .axis-ticks { position: relative; min-height: 24px; }
      .axis-tick { position: absolute; top: 0; transform: translateX(-50%); color: var(--muted); font-size: 0.72rem; white-space: nowrap; }
      @keyframes ganttPulse { to { transform: translateX(100%); } }
      input, select, button { font: inherit; }
      input, select { border: 1px solid var(--line); border-radius: 6px; padding: 8px; background: #fff; color: var(--text); }
      button.primary { border: 0; border-radius: 6px; padding: 8px 12px; background: var(--accent); color: #fff; font-weight: 700; cursor: pointer; }
      button.secondary { border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; background: #fff; color: var(--text); font-weight: 800; cursor: pointer; }
      button.secondary:hover, button.primary:hover { filter: brightness(0.97); }
      .lens-stakeholder .detail-heavy { display: none; }
      .lens-agent .stakeholder-only, .lens-maintainer .stakeholder-only { display: none !important; }
      .slide-deck { position: fixed; inset: 0; z-index: 99; background: #07111d; color: #eef7ff; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; padding: 18px; }
      .slide-deck.hidden { display: none !important; }
      .deck-topbar, .deck-controls { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .deck-topbar { border-bottom: 1px solid rgba(255,255,255,0.14); padding-bottom: 12px; }
      .deck-title { font-weight: 900; font-size: 1rem; letter-spacing: 0; }
      .deck-count { color: #9fb2c7; font-size: 0.86rem; }
      .deck-viewport { overflow: hidden; min-height: 0; perspective: 1200px; }
      .deck-track { height: 100%; display: flex; transform: translateX(calc(var(--slide-index, 0) * -100%)); transition: transform 420ms ease; }
      .deck-slide { min-width: 100%; height: 100%; padding: clamp(18px, 3vw, 42px); display: grid; grid-template-columns: minmax(0, 0.58fr) minmax(300px, 0.42fr); gap: clamp(18px, 3vw, 44px); align-items: center; }
      .deck-slide h2 { font-size: clamp(2rem, 4.4vw, 4.8rem); line-height: 1.02; margin: 0; color: #fff; }
      .deck-slide p { font-size: clamp(1rem, 1.4vw, 1.35rem); line-height: 1.5; color: #c8d8e8; }
      .deck-kicker { color: #78c2ff; font-weight: 900; text-transform: uppercase; font-size: 0.82rem; letter-spacing: 0; }
      .deck-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
      .deck-metric { border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; background: rgba(255,255,255,0.06); padding: 14px; }
      .deck-metric strong { display: block; color: #fff; font-size: clamp(1.7rem, 3vw, 3rem); line-height: 1; }
      .deck-metric span { color: #9fb2c7; font-size: 0.86rem; }
      .deck-list { margin: 18px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; }
      .deck-list li { border-left: 3px solid #78c2ff; padding: 8px 0 8px 12px; color: #dbeafe; }
      .deck-card { border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; background: rgba(255,255,255,0.07); padding: 18px; box-shadow: 0 24px 60px rgba(0,0,0,0.28); }
      .deck-progress-row { display: grid; gap: 7px; margin: 10px 0; }
      .deck-progress-row span { display: flex; justify-content: space-between; gap: 12px; color: #dbeafe; font-weight: 800; }
      .deck-progress-track { height: 11px; border-radius: 999px; background: rgba(255,255,255,0.12); overflow: hidden; }
      .deck-progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #78c2ff, #79e6a5); }
      .deck-workflow { display: grid; gap: 12px; }
      .deck-workflow-card { border: 1px solid rgba(255,255,255,0.16); border-radius: 8px; background: rgba(255,255,255,0.07); padding: 14px; color: #dbeafe; }
      .deck-workflow-card strong { display: block; color: #fff; font-size: 1rem; }
      .world-prism { position: relative; height: min(52vh, 430px); transform-style: preserve-3d; transform: rotateX(58deg) rotateZ(-32deg); display: grid; place-items: center; }
      .prism-layer { position: absolute; width: min(56vw, 430px); height: min(30vw, 220px); border: 1px solid rgba(120,194,255,0.5); border-radius: 8px; background: linear-gradient(135deg, rgba(120,194,255,0.16), rgba(121,230,165,0.08)); box-shadow: 0 16px 40px rgba(29, 140, 216, 0.18); transform: translateZ(var(--z)); }
      .prism-layer::before, .prism-layer::after { content: ""; position: absolute; inset: 18%; border: 1px dashed rgba(255,255,255,0.22); border-radius: 8px; }
      .prism-node { position: absolute; width: 92px; min-height: 48px; border-radius: 8px; background: #eef7ff; color: #07111d; display: grid; place-items: center; text-align: center; font-size: 0.78rem; font-weight: 900; padding: 8px; transform: rotateZ(32deg) rotateX(-58deg); box-shadow: 0 10px 24px rgba(0,0,0,0.25); }
      .prism-node.one { top: 18%; left: 14%; }
      .prism-node.two { top: 30%; right: 13%; }
      .prism-node.three { bottom: 16%; left: 38%; }
      .deck-button { border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; background: rgba(255,255,255,0.08); color: #fff; padding: 9px 12px; font-weight: 900; cursor: pointer; }
      .deck-button.primary { background: #78c2ff; color: #06111e; border-color: #78c2ff; }
      .deck-dots { display: flex; gap: 7px; align-items: center; justify-content: center; }
      .deck-dot { width: 9px; height: 9px; border-radius: 999px; background: rgba(255,255,255,0.26); border: 0; padding: 0; }
      .deck-dot[aria-current="true"] { background: #78c2ff; width: 28px; border-radius: 999px; }
      .ops-command { display: grid; gap: 16px; }
      .ops-command-hero { display: grid; grid-template-columns: minmax(220px, 0.32fr) minmax(0, 0.68fr); gap: 16px; align-items: stretch; }
      .ops-ring-card, .ops-now-card, .ops-meta-card, .ops-flow-card, .report-lab { border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; padding: 16px; min-width: 0; }
      .ops-ring { width: min(210px, 100%); aspect-ratio: 1; margin: 0 auto 12px; border-radius: 999px; background: conic-gradient(#1f7a4d var(--pct), #dbe5ee 0); display: grid; place-items: center; box-shadow: inset 0 0 0 18px #fff; }
      .ops-ring strong { font-size: 2.2rem; line-height: 1; }
      .ops-now-card { display: grid; gap: 10px; border-left: 5px solid var(--accent); }
      .ops-now-title { font-size: clamp(1.35rem, 2vw, 2rem); line-height: 1.15; margin: 0; overflow-wrap: anywhere; }
      .ops-action-strip, .ops-meta-grid, .ops-flow-grid, .report-action-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
      .ops-action { border: 1px solid rgba(23,105,170,0.18); border-radius: 8px; background: #f5f9ff; padding: 12px; }
      .ops-action strong, .ops-meta-card strong, .ops-flow-card strong { display: block; }
      .ops-meta-card.ok { border-left: 5px solid var(--ok); }
      .ops-meta-card.warn { border-left: 5px solid var(--warn); }
      .ops-meta-card.risk { border-left: 5px solid var(--risk); }
      .ops-flow-card { position: relative; overflow: hidden; }
      .ops-flow-card::after { content: ""; position: absolute; inset: auto 0 0; height: 4px; background: var(--flow-color, var(--accent)); opacity: 0.82; }
      .ops-flow-card.waiting { --flow-color: var(--info); }
      .ops-flow-card.in-progress { --flow-color: var(--ok); }
      .ops-flow-card.blocked { --flow-color: var(--risk); }
      .ops-flow-card.completed { --flow-color: var(--muted); }
      .work-focus-list { display: grid; gap: 8px; }
      .work-focus-button { width: 100%; border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 10px; text-align: left; cursor: pointer; display: grid; gap: 4px; }
      .work-focus-button[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(23,105,170,0.14); }
      .work-focus-button strong { overflow-wrap: anywhere; }
      .event-ticker { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .event-pill { border: 1px solid var(--line); border-radius: 999px; padding: 6px 10px; background: #fff; font-size: 0.82rem; }
      .report-lab { display: grid; gap: 12px; }
      .report-action-row button { width: 100%; }
      .ops-lens-strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .ops-lens-button { border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--text); padding: 7px 11px; font-weight: 900; cursor: pointer; }
      .ops-lens-button[aria-pressed="true"] { border-color: var(--accent); background: #eaf4ff; box-shadow: 0 0 0 3px rgba(23,105,170,0.14); }
      .ops-lens-panel { border: 1px solid rgba(23,105,170,0.2); border-radius: 8px; background: #f7fbff; padding: 14px; display: grid; gap: 10px; }
      .insight-stack { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
      .insight-item { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 12px; min-width: 0; display: grid; gap: 5px; }
      .insight-item.risk { border-left: 5px solid var(--risk); }
      .insight-item.warn { border-left: 5px solid var(--warn); }
      .insight-item.ok { border-left: 5px solid var(--ok); }
      .report-brief-preview { border: 1px solid var(--line); border-radius: 8px; background: #0f1720; color: #e8f4ff; padding: 12px; max-height: 220px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
      .projection-confidence { display: grid; gap: 10px; border: 1px solid rgba(154,103,0,0.28); border-left: 5px solid var(--warn); border-radius: 8px; background: #fffaf0; padding: 14px; margin: 12px 0; box-shadow: var(--shadow); }
      .projection-confidence.ok { border-left-color: var(--ok); background: #f3fbf6; }
      .projection-confidence.debt, .projection-confidence.risk { border-left-color: var(--risk); background: #fff4f4; }
      .projection-confidence-head { display: flex; gap: 10px; align-items: start; justify-content: space-between; flex-wrap: wrap; }
      .projection-confidence-head strong { font-size: 1rem; overflow-wrap: anywhere; }
      .projection-confidence .metric-grid { margin-top: 0; }
      .trace-card { border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; padding: 14px; display: grid; gap: 10px; }
      .trace-card.warn { border-left: 5px solid var(--warn); }
      .trace-card.risk { border-left: 5px solid var(--risk); }
      .trace-flow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .trace-step { border: 1px solid rgba(23,105,170,0.16); border-radius: 8px; background: #fff; padding: 10px; min-width: 0; }
      .trace-step strong { display: block; margin-bottom: 5px; }
      .trace-step p { margin: 0; overflow-wrap: anywhere; }
      .trace-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .projection-warning { border: 1px solid rgba(197, 76, 76, 0.35); border-left: 5px solid var(--risk); border-radius: 8px; background: #fff4f4; color: #742626; padding: 12px; margin: 12px 0; font-weight: 800; }
      .hidden { display: none !important; }
      .mono { font-family: Consolas, "Courier New", monospace; }
      @media (max-width: 900px) {
        .hero, .control-grid, .overview-guide, .guide-strip, .hub-grid, .task-board-columns, .judgment-console, .judgment-actions, .score-duo, .actionability, .decision-strip, .trust-boundary, .status-rail, .metric-grid, .card-grid, .signal-grid, .open-work-grid, .work-hero, .stack-grid, .architecture-map, .platform-intake, .platform-grid, .trace-flow, .deck-slide, .deck-metrics, .gantt-axis, .gantt-row, .ops-command-hero { grid-template-columns: 1fr; }
        .panel, .panel-wide { grid-column: span 12; }
        .control-card { min-width: 0; }
        .slide-deck { padding: 12px; }
        .deck-viewport { overflow-y: auto; }
        .deck-track { min-height: 100%; align-items: stretch; }
        .deck-slide { height: auto; min-height: 100%; align-items: start; padding: 18px 4px 24px; }
        .deck-slide h2 { font-size: clamp(2rem, 9vw, 3rem); }
        .world-prism { height: 260px; }
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
      }
      @media print {
        .tablist, .mode-banner, .status-rail, .control-card, .deck-topbar, .deck-controls { display: none !important; }
        body { background: #fff; }
        .panel, .status-rail, .mode-banner { box-shadow: none; break-inside: avoid; }
        .slide-deck { position: static; display: block !important; background: #fff; color: #111; padding: 0; }
        .deck-viewport { overflow: visible; }
        .deck-track { display: block; transform: none !important; }
        .deck-slide { min-width: 0; height: 100vh; page-break-after: always; color: #111; }
      }
    </style>
  </head>
  <body>
    <a href="#main" class="skip-link" id="skip-link">Skip to dashboard content</a>
    <div class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Harness Dashboard 4.6.5</p>
          <h1 id="dashboard-title" data-workspace="${workspaceName}">${workspaceName} Project World Model</h1>
          <p class="lede" id="dashboard-lede">A canonical, ledger-backed view of project reality for stakeholders, AI Agents, and maintainers.</p>
        </div>
        <div class="control-card">
          <div class="control-grid">
            <label>
              <span id="audience-label">Audience Lens</span>
              <select id="audience-mode" aria-label="Audience lens">
                <option value="stakeholder" id="audience-option-stakeholder">Stakeholder view</option>
                <option value="agent" id="audience-option-agent">AI Agent resume view</option>
                <option value="maintainer" id="audience-option-maintainer">Maintainer operations view</option>
              </select>
            </label>
            <label>
              <span id="language-label">Language</span>
              <select id="language-mode" aria-label="Dashboard language">
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <span class="audience-note" id="control-note">View controls only change the dashboard lens. They do not write to harness state.</span>
          <div class="lens-statement" id="lens-statement"></div>
          <label class="report-scope-control">
            <span id="report-focus-label">Report focus</span>
            <select id="report-focus" aria-label="Report focus">
              <option value="today" id="report-focus-option-today">Today</option>
              <option value="active" id="report-focus-option-active">Active work</option>
              <option value="blocked" id="report-focus-option-blocked">Blocked work</option>
              <option value="all" id="report-focus-option-all">All work</option>
            </select>
          </label>
          <div class="button-row">
            <button class="secondary" type="button" id="slideshow-button" data-slideshow-open>Slide Show View</button>
          </div>
        </div>
      </header>
      <section id="mode-banner" class="mode-banner" aria-live="polite"></section>
      <section id="projection-confidence" class="projection-confidence" aria-live="polite"></section>
      <section id="status-rail" class="status-rail" aria-label="Persistent project status rail"></section>
      <nav class="tablist" role="tablist" aria-label="Dashboard views">
        <button class="tab" role="tab" id="tab-overview" aria-controls="view-overview" aria-selected="true" data-purpose="Executive view: world judgment, critical signals, required decision, risk, and trustworthiness.">Overview</button>
        <button class="tab" role="tab" id="tab-work" aria-controls="view-work" aria-selected="false" data-purpose="Delivery view: queues, backlog, active work, readiness timeline, WIP aging, and throughput signals.">Work</button>
        <button class="tab" role="tab" id="tab-evidence" aria-controls="view-evidence" aria-selected="false" data-purpose="Proof view: claim-to-evidence matrix, missing evidence, source links, Git/SVN records, and validation warnings.">Evidence</button>
        <button class="tab" role="tab" id="tab-governance" aria-controls="view-governance" aria-selected="false" data-purpose="Decision view: value hierarchy, readiness judgments, approvals, gates, definition of ready/done, retro and review loops.">Governance</button>
        <button class="tab" role="tab" id="tab-system" aria-controls="view-system" aria-selected="false" data-purpose="System topology view: services, environments, dependencies, operations readiness, and listener health without repeating the executive mission.">System</button>
        <button class="tab" role="tab" id="tab-tech" aria-controls="view-tech" aria-selected="false" data-purpose="Technology stack view: project architecture, runtime stack, infrastructure, data stores, deployment path, and harness integration points.">Tech Stack</button>
      </nav>
      <section id="tab-purpose" class="tab-purpose" aria-live="polite"></section>
      <main id="main" class="grid">
        <section id="view-overview" class="grid panel-wide" role="tabpanel" aria-labelledby="tab-overview"></section>
        <section id="view-work" class="grid panel-wide hidden" role="tabpanel" aria-labelledby="tab-work"></section>
        <section id="view-evidence" class="grid panel-wide hidden" role="tabpanel" aria-labelledby="tab-evidence"></section>
        <section id="view-governance" class="grid panel-wide hidden" role="tabpanel" aria-labelledby="tab-governance"></section>
        <section id="view-system" class="grid panel-wide hidden" role="tabpanel" aria-labelledby="tab-system"></section>
        <section id="view-tech" class="grid panel-wide hidden" role="tabpanel" aria-labelledby="tab-tech"></section>
      </main>
    </div>
    <section id="slide-deck" class="slide-deck hidden" aria-modal="true" role="dialog" aria-labelledby="deck-heading"></section>
    <script id="dashboard-bootstrap-data" type="application/json">${bootstrap}</script>
    <script>
      const bootstrapElement = document.getElementById("dashboard-bootstrap-data");
      const bootstrapState = JSON.parse(bootstrapElement.textContent || "{}");
      const localApiToken = window.__HARNESS_DASHBOARD_TOKEN__ || "";
      const app = {
        state: bootstrapState,
        mode: "Static Snapshot",
        source: "embedded snapshot",
        stale: true,
        audienceMode: "stakeholder",
        locale: document.documentElement.lang === "ko" ? "ko" : "en",
        timelineRange: "this-month",
        workView: "kanban",
        reportFocus: "today",
        reportScopeFallback: false,
        opsLens: "action",
        selectedWorkId: null,
        uiEvents: [],
        reportCopyStatus: "",
        projectionError: "",
        slideIndex: 0,
        slideDeckOpen: false,
        deckReturnFocus: null,
      };
      const I18N = {
        en: {
          "titleSuffix": "Project World Model",
          "lede": "A canonical, ledger-backed view of project reality for stakeholders, AI Agents, and maintainers.",
          "skip": "Skip to dashboard content",
          "audience": "Audience Lens",
          "language": "Language",
          "stakeholderView": "Stakeholder view",
          "agentView": "AI Agent resume view",
          "maintainerView": "Maintainer operations view",
          "controlNote": "View controls only change the dashboard lens. They do not write to harness state.",
          "slideShowView": "Slide Show View",
          "slideDeck": "Stakeholder Slide Show",
          "slideDeck.stakeholder": "Stakeholder Slide Show",
          "slideDeck.agent": "AI Agent Resume Slides",
          "slideDeck.maintainer": "Maintainer Report Deck",
          "reportFocus": "Report focus",
          "reportFocus.today": "Today",
          "reportFocus.active": "Active work",
          "reportFocus.blocked": "Blocked work",
          "reportFocus.all": "All work",
          "reportLab": "Report Deck Lab",
          "reportLabCopy": "The HTML report deck rebuilds from the selected work scope. Use Today when someone asks to apply today's work report to the dashboard.",
          "openPptDashboard": "Open report deck",
          "applyTodayReport": "Apply today's work report",
          "currentWorkInfographic": "Current Work Infographic",
          "nowDoing": "Now doing",
          "nextOperatorMove": "Next operator move",
          "metaThinking": "Meta Thinking Signals",
          "whatDoing": "What are we doing?",
          "whyDoing": "Why does it matter?",
          "whatNext": "What should happen next?",
          "whatBlocks": "What can block this?",
          "workFlow": "Work flow",
          "focusWork": "Focus work",
          "recentUiEvents": "Recent UI events",
          "jumpToWork": "Jump to Work",
          "jumpToEvidence": "Jump to Evidence",
          "jumpToGovernance": "Jump to Governance",
          "reportScope": "Report scope",
          "opsLens": "Operator lens",
          "opsLens.action": "Action",
          "opsLens.evidence": "Evidence",
          "opsLens.risk": "Risk",
          "opsLens.report": "Report",
          "operatorInsightPanel": "Operator Insight Panel",
          "claimActionGraph": "Claim-action graph",
          "reportBrief": "Report brief",
          "copyReportBrief": "Copy report brief",
          "printReport": "Print / PDF",
          "copiedReportBrief": "Report brief copied",
          "projectionWarning": "Projection warning",
          "projectionConfidence": "Projection Confidence",
          "projectionDebt": "Projection debt",
          "actionGate": "Action gate",
          "lastRefresh": "Last refresh",
          "trust": "Trust",
          "openEvidence": "Open evidence",
          "openDecisions": "Open decisions",
          "sessionTraceability": "Session Traceability",
          "traceIntegrity": "Trace integrity",
          "originalRequest": "Original request",
          "processSummary": "Process summary",
          "resultSummary": "Result summary",
          "residualRisk": "Residual risk",
          "reportScopeFallback": "Scope fallback applied",
          "reportScopeStrictEmpty": "No rows matched the selected scope.",
          "startPresentation": "Start fullscreen",
          "closePresentation": "Close",
          "previousSlide": "Previous",
          "nextSlide": "Next",
          "lensContract": "Lens contract",
          "stakeholderLensQuestion": "Stakeholder lens answers: what changed, how complete the work is, what remains, what is blocked, and what decision is needed.",
          "agentLensQuestion": "AI Agent lens answers: next safest action, authoritative files, forbidden assumptions, and validation commands.",
          "maintainerLensQuestion": "Maintainer lens answers: operational safety, release/data/incident evidence, listener health, and system risk.",
          "stakeholderReport": "Stakeholder Report",
          "agentResumeBoard": "AI Agent Resume Board",
          "maintainerHealthBoard": "Maintainer Health Board",
          "reportCta": "Open slide show for a clean review-oriented report.",
          "thisWeekProgress": "This Week Progress",
          "deckExecutiveTitle": "Project state in one view",
          "deckWorkTitle": "Open work and remaining effort",
          "deckTimelineTitle": "Timeline pressure and KPI signals",
          "deckRiskTitle": "Risks, blockers, and decisions",
          "deckNextTitle": "Next actions and handoff",
          "tab.overview": "Overview",
          "tab.work": "Work",
          "tab.evidence": "Evidence",
          "tab.governance": "Governance",
          "tab.system": "Operations",
          "tab.tech": "Tech Stack",
          "purpose.overview": "What changed, why it matters, the current risk, the required decision, and whether the state is trustworthy.",
          "purpose.work": "Open work first: progress, remaining time, blockers, status lanes, readiness timeline, and KPI inputs.",
          "purpose.evidence": "Claims, proof, missing evidence, source links, Git/SVN records, and validation warnings.",
          "purpose.governance": "Decisions, AI platform intake, value hierarchy, readiness gates, definitions, cadence, reviews, and retro loops.",
          "purpose.system": "Operational topology, services, environments, dependencies, release/incident/data readiness, and listener health.",
          "purpose.tech": "Project composition, technology stack, infrastructure, deployment path, data stores, and harness integration points.",
          "mode": "Mode",
          "source": "Source",
          "eventSequence": "Event sequence",
          "projection": "Projection",
          "freshness": "Freshness",
          "activeSession": "Active Session",
          "waiting": "Waiting",
          "queueWip": "Queue WIP",
          "activeWork": "Active Work",
          "needsUser": "Needs User",
          "vcs": "VCS",
          "currentJudgmentConsole": "Current Judgment Console",
          "overviewGuide": "Harness Adoption Guide",
          "readThisFirst": "Read this first",
          "harnessReady": "Harness is installed and usable",
          "setupReadyCopy": "This dashboard can guide planning, session resume, evidence capture, and stakeholder review from now on.",
          "evidencePending": "Evidence collection is still in progress",
          "evidencePendingCopy": "Low operational evidence means release and operations proof is not linked yet. It does not mean the harness failed.",
          "whatToLookAt": "What to look at next",
          "guideStepWork": "Work shows open tasks, progress, blockers, status lanes, and readiness timeline.",
          "guideStepEvidence": "Evidence shows which claims still need proof before release or handoff.",
          "guideStepTech": "Tech Stack explains the project composition, infrastructure, and harness integration points.",
          "governanceActionabilityScore": "Governance Setup & Operating Readiness",
          "governanceSetup": "Governance setup",
          "operationalEvidence": "Operational evidence",
          "releaseEvidenceGate": "Release evidence gate",
          "nextEvidenceToUnlock": "Next evidence to unlock release/operate",
          "scoreMeaning": "Meaning",
          "governanceScoreMeaningCopy": "The main score measures whether the harness is ready to guide planning, resume, and evidence collection. It is not production release readiness.",
          "releaseGateCopy": "Release and handoff remain blocked until VCS, service, release, data, and operations evidence is linked.",
          "nextResolveDecision": "Resolve unresolved stakeholder decisions.",
          "nextClassifyVcs": "Classify or link dirty VCS paths to governed work.",
          "nextSupportEvidence": "Support missing service, release, data, and operations claims with evidence.",
          "nextAppendEvents": "Append semantic claim/VCS/release/data events when evidence changes.",
          "plan": "Plan",
          "build": "Build",
          "release": "Release",
          "operate": "Operate",
          "handoff": "Handoff",
          "yes": "yes",
          "no": "no",
          "worldJudgmentHeader": "World Judgment Header",
          "criticalSignals": "Critical Signals",
          "executiveOverview": "Executive Overview",
          "dashboardQualityScorecard": "Dashboard Quality Scorecard",
          "decisionRiskPulse": "Decision And Risk Pulse",
          "trustContinuity": "Trust And Continuity Snapshot",
          "ledgerTrust": "Ledger Projection Trust Boundary",
          "realityGoalCompass": "Reality And Goal Compass",
          "realityNextActionsHub": "Reality & Next Actions Hub",
          "hubCurrentRead": "Current operating read",
          "hubCurrentReadCopy": "This combines reality, goal, risks, evidence, API health, and the next safe action without requiring raw JSON or chat history.",
          "hubPrimaryNextActions": "Primary next actions",
          "hubEvidenceTargets": "Evidence targets",
          "hubLocalApi": "Local listener API",
          "hubApiCopy": "Read-only loopback endpoints are useful for local tools, dashboards, and deterministic search.",
          "hubOpenWorkTab": "Open Work",
          "hubOpenEvidenceTab": "Open Evidence",
          "hubOpenSystemTab": "Open Operations",
          "hubNoAction": "No user-facing action is active yet.",
          "hubNoEvidenceTarget": "No evidence target is currently listed.",
          "currentReality": "Current Reality",
          "goalState": "Goal State",
          "topGaps": "Top 3 Gaps",
          "nextSafeMove": "Next Safe Move",
          "projectWorldMap": "Project World Map",
          "contextRotMonitor": "Context Rot Monitor",
          "currentGoal": "Current goal",
          "whatChanged": "What changed",
          "whyMatters": "Why it matters",
          "requiredDecision": "Required decision",
          "risk": "Risk",
          "owner": "Owner",
          "dueDate": "Due date",
          "nextMilestone": "Next milestone",
          "openBlockers": "Open blockers",
          "nextSafestAction": "Next safest action",
          "lastSafeCheckpoint": "Last safe checkpoint",
          "openWork": "Open Work",
          "openWorkHint": "Only work that is still waiting, active, or blocked. Completed work moves into the timeline and KPI history.",
          "userTaskBoard": "User Task Board",
          "userTaskBoardHint": "This board shows project work only: what is active now, what remains, and what has been completed.",
          "userTaskEmpty": "No project task is active yet. Confirm the first governed goal or add domain work before treating the board as operational.",
          "currentWork": "Current work",
          "remainingWork": "Remaining work",
          "completedWork": "Completed work",
          "agentMaintenanceTasks": "Agent Maintenance Tasks",
          "agentOnly": "agent-only",
          "hiddenAgentTasks": "Hidden agent tasks",
          "maintenanceHint": "Dashboard projection, listener, indexing, and refresh chores are kept here for AI Agents and excluded from user task metrics.",
          "operationalQueue": "Operational Command Queue",
          "kanban": "Status lanes",
          "gantt": "Timeline",
          "workKpiInputs": "Work KPI Inputs",
          "queueBacklogDetails": "Queue And Backlog Detail",
          "timelineCoverage": "Timeline Coverage",
          "activeAnimated": "Active / Animated",
          "oldestActiveAge": "Oldest Active Age",
          "timelineLanes": "Timeline Lanes",
          "closedItems": "Closed Items",
          "visibleWork": "Visible work",
          "activeNow": "Active now",
          "blockedGates": "Blocked gates",
          "evidenceBlockers": "Evidence blockers",
          "oldestWip": "Oldest WIP",
          "timelineRange": "Timeline range",
          "thisMonth": "This month",
          "thisQuarter": "This quarter",
          "thisYear": "This year",
          "lastYear": "Last year",
          "allWork": "All recorded work",
          "readinessMapCopy": "This timeline is a readiness map: bars show work span, shaded bands show phase pressure, yellow gates show exit criteria, and blocked rows identify the claims they prevent.",
          "tableAlternative": "Timeline table alternative",
          "progress": "Progress",
          "remaining": "Remaining",
          "evidence": "Evidence",
          "blocks": "Blocks",
          "exit": "Exit",
          "none": "none",
          "noEvidence": "no evidence linked",
          "notDeclared": "not declared",
          "noOpenWork": "No open work in this projection.",
          "stackComposition": "Project Composition",
          "technologyStack": "Technology Stack",
          "infraDeploy": "Infrastructure And Deployment",
          "dataStorage": "Data And Storage",
          "harnessIntegration": "Harness Integration",
          "architectureMap": "Architecture Map",
          "agentPlatformIntake": "AI Agent Platform Intake",
          "platformIntakeCopy": "Select the AI agent platforms that are actually used in this project. Submitting here prepares the exact local command; persistence happens through dashboard-ops so the read-only listener stays safe.",
          "detectedPlatforms": "Detected platforms",
          "declaredPlatforms": "Declared platforms",
          "activePlatforms": "Active platforms",
          "unusedInstructions": "Unused instructions",
          "recordPlatformDeclaration": "Prepare declaration",
          "platformCommandReady": "Run this command to index the declaration",
          "platformReadOnlyNote": "This dashboard is read-only. The command appends a governance event and rebuilds projections.",
          "confidence": "Confidence",
          "evidenceSource": "Evidence source",
          "purpose": "Purpose",
          "status.waiting": "waiting",
          "status.in-progress": "in progress",
          "status.active": "active",
          "status.completed": "completed",
          "status.complete": "complete",
          "status.blocked": "blocked",
          "status.failed": "failed",
          "status.guided-onboarding": "guided onboarding",
          "status.ready-to-govern": "ready to govern",
          "status.operational-candidate": "operational candidate",
        },
        ko: {
          "titleSuffix": "프로젝트 월드 모델",
          "lede": "이해관계자, AI Agent, 운영자가 함께 보는 원장 기반 프로젝트 현실 지도입니다.",
          "skip": "대시보드 본문으로 이동",
          "audience": "보기 방식",
          "language": "언어",
          "stakeholderView": "이해관계자 보기",
          "agentView": "AI Agent 재개 보기",
          "maintainerView": "운영자 보기",
          "controlNote": "보기 방식과 언어만 바뀝니다. 하네스 상태에는 아무것도 기록하지 않습니다.",
          "slideShowView": "슬라이드 쇼 보기",
          "slideDeck": "이해관계자 슬라이드 쇼",
          "slideDeck.stakeholder": "이해관계자 슬라이드 쇼",
          "slideDeck.agent": "AI Agent 재개 슬라이드",
          "slideDeck.maintainer": "운영자 보고 덱",
          "reportFocus": "보고 범위",
          "reportFocus.today": "오늘",
          "reportFocus.active": "진행 작업",
          "reportFocus.blocked": "차단 작업",
          "reportFocus.all": "전체 작업",
          "reportLab": "보고 덱 랩",
          "reportLabCopy": "선택한 작업 범위로 HTML 보고 덱을 다시 구성합니다. '오늘 작업내역을 대시보드에 적용해줘' 같은 요청에는 오늘 범위를 사용합니다.",
          "openPptDashboard": "보고 덱 열기",
          "applyTodayReport": "오늘 작업 보고 적용",
          "currentWorkInfographic": "현재 진행 작업 인포그래픽",
          "nowDoing": "지금 하는 일",
          "nextOperatorMove": "다음 운영 행동",
          "metaThinking": "메타 사고 신호",
          "whatDoing": "무엇을 하고 있나?",
          "whyDoing": "왜 중요한가?",
          "whatNext": "다음에 무엇을 해야 하나?",
          "whatBlocks": "무엇이 막을 수 있나?",
          "workFlow": "작업 흐름",
          "focusWork": "작업 포커스",
          "recentUiEvents": "최근 UI 이벤트",
          "jumpToWork": "작업으로 이동",
          "jumpToEvidence": "근거로 이동",
          "jumpToGovernance": "거버넌스로 이동",
          "reportScope": "보고 범위",
          "opsLens": "운영 렌즈",
          "opsLens.action": "행동",
          "opsLens.evidence": "근거",
          "opsLens.risk": "위험",
          "opsLens.report": "보고",
          "operatorInsightPanel": "운영 인사이트 패널",
          "claimActionGraph": "주장-행동 그래프",
          "reportBrief": "보고 브리프",
          "copyReportBrief": "보고 브리프 복사",
          "printReport": "인쇄 / PDF",
          "copiedReportBrief": "보고 브리프를 복사했습니다",
          "projectionWarning": "프로젝션 경고",
          "reportScopeFallback": "보고 범위 대체 적용됨",
          "reportScopeStrictEmpty": "선택한 범위에 해당하는 행이 없습니다.",
          "startPresentation": "전체화면 시작",
          "closePresentation": "닫기",
          "previousSlide": "이전",
          "nextSlide": "다음",
          "lensContract": "보기 방식 계약",
          "stakeholderLensQuestion": "이해관계자 보기는 무엇이 바뀌었고, 얼마나 진행됐고, 무엇이 남았고, 무엇이 막혔고, 어떤 결정이 필요한지 답합니다.",
          "agentLensQuestion": "AI Agent 보기는 다음 안전 행동, 권위 파일, 금지 가정, 검증 명령을 답합니다.",
          "maintainerLensQuestion": "운영자 보기는 운영 안전성, 릴리즈/데이터/장애 증거, listener 상태, 시스템 위험을 답합니다.",
          "stakeholderReport": "이해관계자 보고",
          "agentResumeBoard": "AI Agent 재개 보드",
          "maintainerHealthBoard": "운영자 헬스 보드",
          "reportCta": "PM 보고용으로 정리된 슬라이드 쇼를 엽니다.",
          "thisWeekProgress": "이번 주 진행 현황",
          "deckExecutiveTitle": "프로젝트 상태 한 장 요약",
          "deckWorkTitle": "열린 작업과 남은 노력",
          "deckTimelineTitle": "타임라인 압력과 KPI 신호",
          "deckRiskTitle": "위험, 차단 요인, 결정",
          "deckNextTitle": "다음 행동과 인수인계",
          "tab.overview": "한눈 요약",
          "tab.work": "작업",
          "tab.evidence": "근거",
          "tab.governance": "거버넌스",
          "tab.system": "운영",
          "tab.tech": "기술 구성",
          "purpose.overview": "무엇이 바뀌었고, 왜 중요한지, 현재 위험과 필요한 결정, 상태 신뢰도를 먼저 보여줍니다.",
          "purpose.work": "열려 있는 작업을 먼저 보여주고 진행률, 남은 기간, 차단 요인, 상태 레인, 준비도 타임라인, KPI 입력값을 다룹니다.",
          "purpose.evidence": "주장, 증거, 빠진 근거, 소스 링크, Git/SVN 기록, 검증 경고를 다룹니다.",
          "purpose.governance": "결정, AI 플랫폼 입력, 가치 우선순위, 준비 게이트, 정의, 주기, 리뷰와 회고 루프를 다룹니다.",
          "purpose.system": "운영 토폴로지, 서비스, 환경, 의존성, 릴리즈/장애/데이터 준비도, 리스너 상태를 다룹니다.",
          "purpose.tech": "프로젝트 구성, 기술 스택, 인프라, 배포 경로, 데이터 저장소, 하네스 연동 지점을 보여줍니다.",
          "mode": "모드",
          "source": "출처",
          "eventSequence": "이벤트 순번",
          "projection": "프로젝션",
          "freshness": "신선도",
          "activeSession": "활성 세션",
          "waiting": "대기",
          "queueWip": "진행 큐",
          "activeWork": "진행 작업",
          "needsUser": "사용자 필요",
          "vcs": "형상관리",
          "currentJudgmentConsole": "현재 판단 콘솔",
          "overviewGuide": "하네스 도입 가이드",
          "readThisFirst": "먼저 볼 내용",
          "harnessReady": "하네스가 설치되어 사용할 수 있습니다",
          "setupReadyCopy": "이제 이 대시보드로 계획 수립, 세션 재개, 근거 수집, 이해관계자 공유를 진행할 수 있습니다.",
          "evidencePending": "운영 증거는 아직 수집 중입니다",
          "evidencePendingCopy": "운영 증거 점수가 낮다는 뜻은 릴리즈/운영 증명이 아직 연결되지 않았다는 의미입니다. 하네스 실패가 아닙니다.",
          "whatToLookAt": "다음에 볼 탭",
          "guideStepWork": "작업 탭에서 열린 작업, 진행률, 차단 요인, 상태 레인, 준비도 타임라인을 봅니다.",
          "guideStepEvidence": "근거 탭에서 릴리즈나 인수인계 전에 어떤 주장에 증명이 필요한지 봅니다.",
          "guideStepTech": "기술 구성 탭에서 프로젝트 구성, 인프라, 하네스 연동 지점을 봅니다.",
          "governanceActionabilityScore": "거버넌스 구성과 운영 준비도",
          "governanceSetup": "거버넌스 구성",
          "operationalEvidence": "운영 증거",
          "releaseEvidenceGate": "릴리즈 증거 게이트",
          "nextEvidenceToUnlock": "릴리즈/운영 해제를 위한 다음 증거",
          "scoreMeaning": "점수 의미",
          "governanceScoreMeaningCopy": "주 점수는 하네스가 계획 수립, 세션 재개, 근거 수집을 안내할 준비가 되었는지 측정합니다. 운영 릴리즈 준비도 점수가 아닙니다.",
          "releaseGateCopy": "릴리즈와 인수인계는 형상관리, 서비스, 릴리즈, 데이터, 운영 증거가 연결될 때까지 별도 게이트로 유지됩니다.",
          "nextResolveDecision": "미해결 이해관계자 결정을 정리합니다.",
          "nextClassifyVcs": "더티 형상관리 경로를 거버넌스 작업에 분류하거나 연결합니다.",
          "nextSupportEvidence": "서비스, 릴리즈, 데이터, 운영 주장에 필요한 증거를 연결합니다.",
          "nextAppendEvents": "증거가 바뀌면 claim/VCS/release/data 이벤트를 원장에 추가합니다.",
          "plan": "계획",
          "build": "구축",
          "release": "릴리즈",
          "operate": "운영",
          "handoff": "인수인계",
          "yes": "가능",
          "no": "대기",
          "worldJudgmentHeader": "월드 판단 헤더",
          "criticalSignals": "핵심 신호",
          "executiveOverview": "이해관계자 요약",
          "dashboardQualityScorecard": "대시보드 품질 점수표",
          "decisionRiskPulse": "결정과 위험 흐름",
          "trustContinuity": "신뢰와 연속성 스냅샷",
          "ledgerTrust": "원장-프로젝션 신뢰 경계",
          "realityGoalCompass": "현실과 목표 나침반",
          "realityNextActionsHub": "현실과 다음 행동 허브",
          "hubCurrentRead": "현재 운영 판독",
          "hubCurrentReadCopy": "원시 JSON이나 채팅 기록 없이 현실, 목표, 위험, 증거, API 상태, 다음 안전 행동을 한곳에 모읍니다.",
          "hubPrimaryNextActions": "주요 다음 행동",
          "hubEvidenceTargets": "증거 대상",
          "hubLocalApi": "로컬 리스너 API",
          "hubApiCopy": "읽기 전용 루프백 엔드포인트는 로컬 도구, 대시보드, 결정적 검색에 사용할 수 있습니다.",
          "hubOpenWorkTab": "작업 열기",
          "hubOpenEvidenceTab": "근거 열기",
          "hubOpenSystemTab": "운영 열기",
          "hubNoAction": "아직 사용자에게 보이는 활성 행동이 없습니다.",
          "hubNoEvidenceTarget": "현재 표시할 증거 대상이 없습니다.",
          "currentReality": "현재 현실",
          "goalState": "목표 상태",
          "topGaps": "상위 3개 간극",
          "nextSafeMove": "다음 안전 행동",
          "projectWorldMap": "프로젝트 세계 지도",
          "contextRotMonitor": "컨텍스트 부패 감시",
          "currentGoal": "현재 목표",
          "whatChanged": "변경 내용",
          "whyMatters": "중요한 이유",
          "requiredDecision": "필요한 결정",
          "risk": "위험",
          "owner": "담당",
          "dueDate": "기한",
          "nextMilestone": "다음 마일스톤",
          "openBlockers": "열린 차단 요인",
          "nextSafestAction": "다음 안전한 행동",
          "lastSafeCheckpoint": "마지막 안전 체크포인트",
          "openWork": "열려 있는 작업",
          "openWorkHint": "아직 대기, 진행, 차단 상태인 작업입니다. 완료된 작업은 타임라인과 KPI 기록으로 이동합니다.",
          "userTaskBoard": "사용자 작업판",
          "userTaskBoardHint": "프로젝트 작업만 보여줍니다. 지금 진행 중인 작업, 남은 작업, 완료된 작업을 분리합니다.",
          "userTaskEmpty": "아직 활성화된 프로젝트 작업이 없습니다. 첫 governed 목표를 확정하거나 도메인 작업을 추가한 뒤 운영 작업판으로 보세요.",
          "currentWork": "진행 중인 작업",
          "remainingWork": "남은 작업",
          "completedWork": "완료된 작업",
          "agentMaintenanceTasks": "에이전트 정비 작업",
          "agentOnly": "에이전트 전용",
          "hiddenAgentTasks": "숨겨진 에이전트 작업",
          "maintenanceHint": "대시보드 투영, 리스너, 인덱싱, 새로고침 정비는 AI Agent용으로만 유지하고 사용자 작업 지표에서는 제외합니다.",
          "operationalQueue": "운영 명령 큐",
          "kanban": "상태 레인",
          "gantt": "타임라인",
          "workKpiInputs": "작업 KPI 입력값",
          "queueBacklogDetails": "큐와 백로그 상세",
          "timelineCoverage": "타임라인 커버리지",
          "activeAnimated": "진행/애니메이션",
          "oldestActiveAge": "가장 오래된 WIP",
          "timelineLanes": "타임라인 레인",
          "closedItems": "종료 작업",
          "visibleWork": "표시 작업",
          "activeNow": "현재 진행",
          "blockedGates": "차단 게이트",
          "evidenceBlockers": "근거 차단 요인",
          "oldestWip": "최장 WIP",
          "timelineRange": "기간",
          "thisMonth": "이번 달",
          "thisQuarter": "이번 분기",
          "thisYear": "올해",
          "lastYear": "작년",
          "allWork": "전체 기록",
          "readinessMapCopy": "이 타임라인은 준비도 지도입니다. 막대는 작업 기간, 음영은 단계 압력, 노란 게이트는 종료 기준, 차단 행은 막고 있는 주장을 보여줍니다.",
          "tableAlternative": "타임라인 표 대체 보기",
          "progress": "진행률",
          "remaining": "남은 기간",
          "evidence": "근거",
          "blocks": "차단",
          "exit": "종료 기준",
          "none": "없음",
          "noEvidence": "연결된 근거 없음",
          "notDeclared": "선언되지 않음",
          "noOpenWork": "이 프로젝션에는 열린 작업이 없습니다.",
          "stackComposition": "프로젝트 구성",
          "technologyStack": "기술 스택",
          "infraDeploy": "인프라와 배포",
          "dataStorage": "데이터와 저장소",
          "harnessIntegration": "하네스 연동",
          "architectureMap": "아키텍처 지도",
          "agentPlatformIntake": "AI 에이전트 플랫폼 입력",
          "platformIntakeCopy": "이 프로젝트에서 실제로 사용하는 AI 에이전트 플랫폼을 선택하세요. 제출은 정확한 로컬 명령을 준비하며, 읽기 전용 listener 보호를 위해 실제 기록은 dashboard-ops가 수행합니다.",
          "detectedPlatforms": "감지된 플랫폼",
          "declaredPlatforms": "선언된 플랫폼",
          "activePlatforms": "활성 플랫폼",
          "unusedInstructions": "미사용 지침",
          "recordPlatformDeclaration": "선언 준비",
          "platformCommandReady": "이 명령으로 선언을 인덱싱하세요",
          "platformReadOnlyNote": "이 대시보드는 읽기 전용입니다. 명령은 거버넌스 이벤트를 추가하고 projection을 재생성합니다.",
          "confidence": "신뢰도",
          "evidenceSource": "근거 출처",
          "purpose": "목적",
          "status.waiting": "대기",
          "status.in-progress": "진행 중",
          "status.active": "진행 중",
          "status.completed": "완료",
          "status.complete": "완료",
          "status.blocked": "차단",
          "status.failed": "실패",
          "status.guided-onboarding": "도입 안내 중",
          "status.ready-to-govern": "거버넌스 가능",
          "status.operational-candidate": "운영 검토 후보",
        },
      };
      function t(key) {
        return (I18N[app.locale] && I18N[app.locale][key]) || I18N.en[key] || key;
      }
      function getAudienceMode() {
        return ["stakeholder", "agent", "maintainer"].includes(app.audienceMode) ? app.audienceMode : "stakeholder";
      }
      function getAudienceConfig() {
        const lens = app.state.audienceLens || {};
        const modes = lens.modes || {};
        return modes[getAudienceMode()] || {
          label: getAudienceMode(),
          primaryQuestion: "",
          density: "default",
          tabLabels: {},
          slideshowEnabled: getAudienceMode() === "stakeholder",
        };
      }
      function lensQuestion() {
        const mode = getAudienceMode();
        if (mode === "agent") return t("agentLensQuestion");
        if (mode === "maintainer") return t("maintainerLensQuestion");
        return t("stakeholderLensQuestion");
      }
      function tabLabel(defaultLabel, key) {
        const labels = getAudienceConfig().tabLabels || {};
        return app.locale === "en" ? (labels[key] || defaultLabel) : defaultLabel;
      }
      function rowLimit(defaultLimit) {
        const mode = getAudienceMode();
        if (mode === "stakeholder") return Math.min(defaultLimit, 5);
        if (mode === "maintainer") return Math.max(defaultLimit, 10);
        return Math.max(defaultLimit, 12);
      }
      function statusText(value) {
        const key = "status." + normalizeTimelineStatus(value);
        return t(key);
      }
      function genericStatusText(value) {
        const raw = String(value || "unknown");
        const key = "status." + raw.toLowerCase();
        const translated = t(key);
        return translated === key ? raw : translated;
      }
      function reportFocusLabel(value) {
        return t("reportFocus." + (value || app.reportFocus || "today"));
      }
      function slideDeckTitle() {
        const key = "slideDeck." + getAudienceMode();
        const translated = t(key);
        return translated === key ? t("slideDeck") : translated;
      }
      function esc(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      }
      function badge(value) {
        const status = String(value || "unknown").toLowerCase();
        const klass = ["complete", "completed", "healthy", "ok", "approved"].includes(status) ? "ok" :
          ["blocked", "failed", "risk", "critical", "not-ready", "contradicted"].includes(status) ? "risk" :
          ["warning", "stale", "partial", "pending", "unknown", "decision-needed", "missing-evidence"].includes(status) ? "warn" : "info";
        return '<span class="badge ' + klass + '">' + esc(value || "unknown") + "</span>";
      }
      async function loadState() {
        if (window.__HARNESS_STATIC_EXPORT__ && !localApiToken) {
          app.state = bootstrapState;
          app.mode = "Static Export";
          app.source = "embedded export";
          app.stale = false;
          app.projectionError = "";
          render();
          connectEvents();
          return;
        }
        try {
          const snapshotUrl = localApiToken ? "./api/harness-dashboard/v1/snapshot" : "./state/dashboard-state.json";
          const response = await fetch(snapshotUrl, {
            cache: "no-store",
            headers: localApiToken ? { "x-harness-dashboard-token": localApiToken } : {},
          });
          if (!response.ok) throw new Error("state fetch failed");
          const loaded = await response.json();
          app.state = loaded.payload || loaded;
          app.mode = localApiToken ? "Local Live" : "Static Snapshot";
          app.source = localApiToken ? "api snapshot" : "state/dashboard-state.json";
          app.stale = false;
          app.projectionError = "";
        } catch (error) {
          app.state = bootstrapState;
          app.mode = "Degraded Offline";
          app.source = "embedded snapshot";
          app.stale = true;
          app.projectionError = error && error.message ? error.message : String(error || "state load failed");
        }
        render();
        connectEvents();
      }
      function renderMode() {
        const meta = app.state.meta || {};
        const mode = app.mode === "Local Live" ? "Local Live" : app.mode === "Static Export" ? "Static Export" : app.stale ? "Degraded Offline" : "Static Snapshot";
        document.getElementById("mode-banner").innerHTML =
          badge(mode) +
          '<span><strong>' + esc(t("source")) + ':</strong> ' + esc(app.source) + '</span>' +
          '<span><strong>' + esc(t("eventSequence")) + ':</strong> ' + esc(meta.sourceEventSequence || 0) + '</span>' +
          '<span><strong>' + esc(t("projection")) + ':</strong> ' + esc(meta.projectionVersion || meta.schemaVersion || "unknown") + '</span>' +
          '<span><strong>' + esc(t("freshness")) + ':</strong> ' + esc(meta.staleness || "unknown") + '</span>' +
          (app.projectionError ? '<span class="projection-warning"><strong>' + esc(t("projectionWarning")) + ':</strong> ' + esc(app.projectionError) + '</span>' : "");
      }
      function projectionConfidenceState() {
        const state = app.state || {};
        const meta = state.meta || {};
        const confidence = state.projectionConfidence || {};
        const evidence = state.governanceEvidenceBrief || {};
        const trust = state.trustBoundary || {};
        const listener = state.listener || ((state.dashboardRuntime || {}).listener) || {};
        const missingEvidenceCount = Number(confidence.missingEvidenceCount ?? ((evidence.missingEvidenceClaims || []).length || 0));
        const openDecisionCount = Number(confidence.openDecisionCount ?? ((evidence.unresolvedDecisions || []).length || 0));
        const staleness = String(confidence.staleness || meta.staleness || (app.stale ? "stale" : "fresh"));
        const trustStatus = String(confidence.trustBoundaryStatus || trust.status || "unknown");
        const status = String(confidence.status || (missingEvidenceCount > 0 || /bootstrap|warning|stale|partial/i.test(staleness + " " + trustStatus) ? "projection-debt" : "current"));
        return {
          status,
          completeness: confidence.completeness || ((state.worldModelCompleteness || {}).status) || meta.completeness || "unknown",
          staleness,
          trustStatus,
          missingEvidenceCount,
          openDecisionCount,
          lastSuccessfulRefreshAt: confidence.lastSuccessfulRefreshAt || meta.generatedAt || t("notDeclared"),
          sourceSequence: confidence.lastSourceEventSequence || meta.sourceEventSequence || 0,
          listenerStatus: confidence.localListenerStatus || listener.status || "not-started",
          userMessage: confidence.userMessage || t("projectionDebt"),
          actionGate: confidence.actionGate || "Review evidence debt before treating this projection as operational truth.",
          requiredActions: confidence.requiredActions || [],
        };
      }
      function renderProjectionConfidence() {
        const target = document.getElementById("projection-confidence");
        if (!target) return;
        const confidence = projectionConfidenceState();
        const hasDebt = /debt|warning|bootstrap|partial|stale|blocked|risk/i.test(confidence.status + " " + confidence.staleness + " " + confidence.trustStatus) || confidence.missingEvidenceCount > 0 || confidence.openDecisionCount > 0;
        target.className = "projection-confidence " + (hasDebt ? "debt" : "ok");
        const actions = (confidence.requiredActions || []).slice(0, 4).map((item) => '<li>' + esc(item) + '</li>').join("");
        target.innerHTML =
          '<div class="projection-confidence-head"><div><span class="rail-label">' + esc(t("projectionConfidence")) + '</span><strong>' + esc(confidence.userMessage) + '</strong></div>' + badge(hasDebt ? t("projectionDebt") : confidence.status) + '</div>' +
          metricGrid([
            [t("freshness"), confidence.staleness, "projection state"],
            [t("trust"), confidence.trustStatus, "trustBoundary"],
            [t("openEvidence"), confidence.missingEvidenceCount, "missing claims"],
            [t("openDecisions"), confidence.openDecisionCount, "unresolved decisions"],
            [t("lastRefresh"), confidence.lastSuccessfulRefreshAt || t("notDeclared"), "source event " + confidence.sourceSequence],
            ["Listener", confidence.listenerStatus, "local API"],
          ]) +
          '<p><strong>' + esc(t("actionGate")) + ':</strong> ' + esc(confidence.actionGate) + '</p>' +
          (actions ? '<ul>' + actions + '</ul>' : "");
      }
      function renderRail() {
        const state = app.state;
        const queues = state.taskQueues || {};
        const runtime = state.runtimeOrchestration || {};
        const vcs = state.versionControl || {};
        const workMap = state.workReadinessMap || {};
        const activeWork = (workMap.summary || {}).activeRows ?? (queues.inProgress || []).length;
        const items = [
          [t("mode"), app.mode],
          [t("audience"), t(app.audienceMode + "View")],
          [t("activeSession"), runtime.activeSessionId || t("none")],
          [t("waiting"), (queues.waiting || []).length],
          [t("queueWip"), (queues.inProgress || []).length],
          [t("activeWork"), activeWork],
          [t("needsUser"), (queues.needsUser || []).length],
          [t("vcs"), vcs.workingCopyStatus || vcs.status || "unknown"],
        ];
        document.getElementById("status-rail").innerHTML = items.map(([label, value]) =>
          '<div class="rail-item"><span class="rail-label">' + esc(label) + '</span><span class="rail-value">' + esc(value) + '</span></div>'
        ).join("");
      }
      function panel(title, body, wide = false) {
        return '<article class="panel ' + (wide ? 'panel-wide' : '') + '"><h2>' + esc(title) + '</h2>' + body + '</article>';
      }
      function metricGrid(items) {
        return '<div class="metric-grid">' + items.map(([label, value, source]) =>
          '<div class="metric"><span class="rail-label">' + esc(label) + '</span><strong>' + esc(value) + '</strong><span class="source">' + esc(source || "") + '</span></div>'
        ).join("") + '</div>';
      }
      function barChart(items) {
        const max = Math.max(1, ...items.map((item) => Number(item[1]) || 0));
        return '<div class="bar">' + items.map(([label, value]) => {
          const width = Math.round(((Number(value) || 0) / max) * 100);
          return '<div class="bar-row"><span>' + esc(label) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div><strong>' + esc(value) + '</strong></div>';
        }).join("") + '</div>';
      }
      function table(headers, rows) {
        return '<div class="table-wrap"><table><thead><tr>' + headers.map((h) => '<th>' + esc(h) + '</th>').join("") + '</tr></thead><tbody>' +
          rows.map((row) => '<tr>' + row.map((cell) => '<td>' + cell + '</td>').join("") + '</tr>').join("") + '</tbody></table></div>';
      }
      const DAY_MS = 24 * 60 * 60 * 1000;
      function asDate(value, fallback) {
        const parsed = new Date(value || "");
        return Number.isFinite(parsed.getTime()) ? parsed : fallback;
      }
      function dateFromOffset(offsetDays) {
        const offset = Number(offsetDays);
        const base = new Date();
        base.setHours(9, 0, 0, 0);
        return new Date(base.getTime() + (Number.isFinite(offset) ? offset : 0) * DAY_MS);
      }
      function timelineStart(item, fallback) {
        return asDate(item.startAt || item.plannedStartAt, Number.isFinite(Number(item.startOffsetDays)) ? dateFromOffset(item.startOffsetDays) : fallback);
      }
      function timelinePlannedEnd(item, fallback) {
        return asDate(item.endAt || item.plannedEndAt, Number.isFinite(Number(item.plannedEndOffsetDays)) ? dateFromOffset(item.plannedEndOffsetDays) : fallback);
      }
      function normalizeTimelineStatus(value) {
        const status = String(value || "waiting").toLowerCase();
        if (status === "active" || status === "doing") return "in-progress";
        if (status === "complete") return "completed";
        return status;
      }
      function isActiveTimelineStatus(status) {
        return ["in-progress", "active", "building", "verifying", "operating"].includes(String(status || "").toLowerCase());
      }
      function buildTimelineItems() {
        const now = new Date();
        const timelineItems = (((app.state.workTimeline || {}).items) || []).map((item) => ({ ...item }));
        const agile = app.state.agile || app.state.agileCadence || {};
        const seen = new Set(timelineItems.map((item) => String(item.id)));
        for (const item of agile.backlog || []) {
          const id = String(item.id || item.title || "task");
          if (seen.has(id)) continue;
          timelineItems.push({
            id,
            title: item.title || id,
            status: item.status || "waiting",
            lane: "Backlog",
            owner: item.owner || "unassigned",
            startAt: item.startedAt || item.startAt || now.toISOString(),
            plannedEndAt: item.dueAt || item.plannedEndAt || new Date(now.getTime() + 7 * DAY_MS).toISOString(),
            endAt: item.endedAt || item.endAt || null,
            progressPercent: item.progressPercent || 0,
            kpiTags: item.kpiTags || ["throughput"],
            evidenceRefs: item.evidenceRefs || [],
            blockingClaimIds: item.blocksClaimIds || item.blockingClaimIds || [],
            nextActionRef: item.nextActionRef || item.resolutionTaskId || "",
            exitCriteria: item.exitCriteria || "",
          });
          seen.add(id);
        }
        for (const session of app.state.governedSessions || []) {
          const id = String(session.id || "session");
          if (seen.has(id)) continue;
          timelineItems.push({
            id,
            title: session.title || session.goal || id,
            status: session.status || "waiting",
            lane: "Governed Sessions",
            owner: session.owner || session.agentRole || "agent",
            startAt: session.startedAt || now.toISOString(),
            endAt: session.endedAt || null,
            plannedEndAt: session.endedAt || new Date(now.getTime() + 3 * DAY_MS).toISOString(),
            progressPercent: session.status === "complete" || session.status === "closed" ? 100 : 40,
            kpiTags: ["cycle-time", "handover-latency"],
            evidenceRefs: session.outputs || [],
            blockingClaimIds: [],
            nextActionRef: session.nextStep || "",
            exitCriteria: "Session closes with verification, retro insight, and refreshed dashboard projection.",
          });
          seen.add(id);
        }
        const matrix = app.state.claimEvidenceMatrix || {};
        for (const gap of matrix.missingEvidenceItems || []) {
          if (!(gap && (gap.surfaceAsTask === true || gap.queueVisibility === "task"))) continue;
          const id = String(gap.id || gap.resolutionTaskId || "missing-evidence");
          if (seen.has(id)) continue;
          timelineItems.push({
            id,
            title: gap.label || id,
            status: "blocked",
            lane: "Evidence Recovery",
            owner: gap.owner || "unassigned",
            startOffsetDays: -4,
            plannedEndOffsetDays: 7,
            progressPercent: 0,
            kpiTags: ["blocked-duration", "evidence-coverage"],
            evidenceRefs: [gap.id, gap.requiredEvidenceType].filter(Boolean),
            blockingClaimIds: gap.blocksClaimIds || [],
            nextActionRef: gap.resolutionTaskId || "",
            exitCriteria: gap.requiredEvidenceType || "Required evidence is linked to the claim.",
          });
          seen.add(id);
        }
        return timelineItems;
      }
      function hiddenAgentTaskIds() {
        const state = app.state || {};
        const userBoard = state.userTaskBoard || {};
        const agentQueues = state.agentTaskQueues || {};
        const ids = [
          ...((userBoard.hiddenAgentTaskIds || [])),
          ...((agentQueues.hiddenFromUserTaskBoard || [])),
          ...((agentQueues.maintenance || []).map((item) => item && item.id)),
        ].filter(Boolean).map((item) => String(item));
        ids.push("task-bootstrap-refresh-projections");
        ids.push("session-0001");
        return Array.from(new Set(ids));
      }
      function isAgentOnlyTask(item) {
        const id = String((item || {}).id || (item || {}).resolutionTaskId || "");
        const visibility = String((item || {}).queueVisibility || (item || {}).audience || (item || {}).visibility || "").toLowerCase();
        const hidden = new Set(hiddenAgentTaskIds());
        return hidden.has(id) ||
          visibility.includes("agent-only") ||
          (item || {}).userVisible === false ||
          (item || {}).agentOnly === true;
      }
      function userVisibleTimelineItems(items) {
        return (items || []).filter((item) => !isAgentOnlyTask(item));
      }
      function workItemsForAudience(items) {
        return getAudienceMode() === "agent" ? (items || []) : userVisibleTimelineItems(items || []);
      }
      function filterTaskQueueIds(queues) {
        const hidden = new Set(hiddenAgentTaskIds());
        return Object.fromEntries(Object.entries(queues || {}).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.filter((id) => !hidden.has(String(id))) : value,
        ]));
      }
      function rangeWindow(items) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        if (app.timelineRange === "this-month") return [startOfMonth, new Date(now.getFullYear(), now.getMonth() + 1, 1)];
        if (app.timelineRange === "this-quarter") return [startOfQuarter, new Date(startOfQuarter.getFullYear(), startOfQuarter.getMonth() + 3, 1)];
        if (app.timelineRange === "this-year") return [startOfYear, new Date(now.getFullYear() + 1, 0, 1)];
        if (app.timelineRange === "last-year") return [new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear(), 0, 1)];
        const starts = items.map((item) => timelineStart(item, now).getTime());
        const ends = items.map((item) => timelinePlannedEnd(item, new Date(now.getTime() + DAY_MS)).getTime());
        return [new Date(Math.min(...starts, now.getTime())), new Date(Math.max(...ends, now.getTime() + DAY_MS))];
      }
      function formatShortDate(date) {
        return date.toISOString().slice(0, 10);
      }
      function isTodayDate(value) {
        const parsed = new Date(value || "");
        if (!Number.isFinite(parsed.getTime())) return false;
        return formatShortDate(parsed) === formatShortDate(new Date());
      }
      function itemTouchesToday(item) {
        if (item.startAt === "bootstrap" || item.plannedStartAt === "bootstrap") return true;
        if (Number.isFinite(Number(item.startOffsetDays)) && Math.abs(Number(item.startOffsetDays)) <= 1) return true;
        return isTodayDate(item.startAt || item.plannedStartAt) ||
          isTodayDate(item.endAt || item.endedAt || item.completedAt) ||
          isActiveTimelineStatus(item.status);
      }
      function itemMatchesReportFocus(item, focus) {
        const status = normalizeTimelineStatus(item.status);
        if (focus === "active") return isActiveTimelineStatus(status);
        if (focus === "blocked") return ["blocked", "failed"].includes(status);
        if (focus === "all") return true;
        return itemTouchesToday(item);
      }
      function buildReportItems() {
        const items = workItemsForAudience(buildTimelineItems());
        const scoped = items.filter((item) => itemMatchesReportFocus(item, app.reportFocus));
        app.reportScopeFallback = scoped.length === 0;
        return scoped.length > 0 ? scoped : items.filter((item) => !["complete", "completed", "closed"].includes(String(item.status || "").toLowerCase())).slice(0, 8);
      }
      function addUiEvent(label, detail) {
        app.uiEvents = [{ at: new Date().toLocaleTimeString(), label, detail }, ...app.uiEvents].slice(0, 6);
      }
      function selectedWorkItem(items) {
        const pool = items && items.length ? items : workItemsForAudience(buildTimelineItems());
        if (app.selectedWorkId) {
          const selected = pool.find((item) => String(item.id) === String(app.selectedWorkId));
          if (selected) return selected;
        }
        return pool.find((item) => isActiveTimelineStatus(item.status)) ||
          pool.find((item) => ["blocked", "failed"].includes(normalizeTimelineStatus(item.status))) ||
          pool.find((item) => normalizeTimelineStatus(item.status) === "waiting") ||
          pool[0] ||
          null;
      }
      function workFlowCounts(items) {
        const counts = { waiting: 0, "in-progress": 0, blocked: 0, completed: 0 };
        for (const item of items) {
          const status = normalizeTimelineStatus(item.status);
          if (isActiveTimelineStatus(status)) counts["in-progress"] += 1;
          else if (["blocked", "failed"].includes(status)) counts.blocked += 1;
          else if (["complete", "completed", "closed"].includes(status)) counts.completed += 1;
          else counts.waiting += 1;
        }
        return counts;
      }
      function normalizeOpsLens(value) {
        return ["action", "evidence", "risk", "report"].includes(value) ? value : "action";
      }
      function opsLensLabel(value) {
        return t("opsLens." + normalizeOpsLens(value));
      }
      function buildReportBrief(items) {
        const state = app.state || {};
        const reportItems = items && items.length ? items : buildReportItems();
        const evidenceBlockers = evidenceBlockerCount();
        const focus = selectedWorkItem(reportItems) || {};
        const brief = state.stakeholderBrief || {};
        const evidence = state.governanceEvidenceBrief || {};
        const blocked = reportItems.filter((item) => ["blocked", "failed"].includes(normalizeTimelineStatus(item.status)));
        const active = reportItems.filter((item) => isActiveTimelineStatus(item.status));
        const nextAction = focus.nextActionRef || focus.exitCriteria || (state.agentResumeBrief || {}).nextSafestAction || t("notDeclared");
        const blockers = (focus.blockingClaimIds || focus.blocksClaimIds || []).join(", ") || (blocked.length ? blocked.map((item) => item.title || item.id).slice(0, 3).join(", ") : t("none"));
        return [
          t("reportScope") + ": " + reportFocusLabel(app.reportFocus) + (app.reportScopeFallback ? " (" + t("reportScopeFallback") + ")" : ""),
          t("currentGoal") + ": " + (brief.currentGoal || focus.goal || focus.title || t("notDeclared")),
          t("whatChanged") + ": " + (brief.whatChangedSinceLastReview || t("notDeclared")),
          t("nowDoing") + ": " + (focus.title || focus.id || t("noOpenWork")),
          t("activeNow") + ": " + active.length + " / " + t("blockedGates") + ": " + blocked.length + " / " + t("evidenceBlockers") + ": " + evidenceBlockers + " / " + t("openWork") + ": " + reportItems.length,
          t("nextOperatorMove") + ": " + nextAction,
          t("evidence") + ": " + ((focus.evidenceRefs || focus.outputs || []).join(", ") || t("noEvidence")) + " | missing: " + ((evidence.missingEvidenceClaims || []).slice(0, 4).join(", ") || t("none")),
          t("whatBlocks") + ": " + blockers,
          t("requiredDecision") + ": " + (brief.requiredDecision || (state.judgmentConsole || {}).nextRequiredDecision || t("none")),
        ].join("\\n");
      }
      function evidenceBlockerCount() {
        const matrix = app.state.claimEvidenceMatrix || {};
        return (matrix.missingEvidenceItems || []).filter((gap) => gap && gap.blocksReadiness !== false).length;
      }
      function buildOperatorInsights(focus, timelineItems) {
        const state = app.state || {};
        const matrix = state.claimEvidenceMatrix || {};
        const missing = (matrix.missingEvidenceItems || []).slice(0, 4);
        const signals = (state.criticalSignals || []).slice(0, 4);
        const unresolved = ((state.governanceEvidenceBrief || {}).unresolvedDecisions || []).slice(0, 3);
        const blocked = (timelineItems || []).filter((item) => ["blocked", "failed"].includes(normalizeTimelineStatus(item.status))).slice(0, 3);
        const nextAction = focus.nextActionRef || focus.exitCriteria || (state.agentResumeBrief || {}).nextSafestAction || t("notDeclared");
        const focusEvidence = (focus.evidenceRefs || focus.outputs || []).slice(0, 4);
        const blockers = (focus.blockingClaimIds || focus.blocksClaimIds || []).slice(0, 4);
        const fallbackInsight = [{ tone: "warn", title: t("reportScopeStrictEmpty"), detail: t("openWorkHint"), source: t("reportScope") }];
        return {
          action: [
            { tone: "ok", title: t("nextOperatorMove"), detail: nextAction, source: focus.owner || focus.agentRole || "unassigned" },
            { tone: "warn", title: t("requiredDecision"), detail: (state.stakeholderBrief || {}).requiredDecision || (state.judgmentConsole || {}).nextRequiredDecision || t("none"), source: "judgmentConsole" },
            { tone: blocked.length ? "risk" : "ok", title: t("blockedGates"), detail: blocked.map((item) => item.title || item.id).join(", ") || t("none"), source: "workTimeline" },
          ],
          evidence: (missing.length ? missing.map((gap) => ({ tone: gap.blocksReadiness ? "risk" : "warn", title: gap.claimId || gap.id || t("evidence"), detail: gap.requiredEvidence || gap.description || gap.expectedEvidence || t("notDeclared"), source: gap.sourceRef || gap.queueVisibility || "claimEvidenceMatrix" })) : [
            { tone: focusEvidence.length ? "ok" : "warn", title: t("evidence"), detail: focusEvidence.join(", ") || t("noEvidence"), source: focus.id || "selected work" },
          ]),
          risk: (signals.length ? signals.map((signal) => ({ tone: signal.severity === "critical" || signal.severity === "high" ? "risk" : "warn", title: signal.label || signal.id || t("risk"), detail: signal.nextAction || signal.whyItMatters || signal.summary || "", source: signal.source || signal.id || "criticalSignals" })) : [
            { tone: blockers.length ? "risk" : "ok", title: t("whatBlocks"), detail: blockers.join(", ") || t("none"), source: focus.id || "selected work" },
          ]),
          report: [
            { tone: app.reportScopeFallback ? "warn" : "ok", title: t("reportScope"), detail: reportFocusLabel(app.reportFocus), source: app.reportScopeFallback ? t("reportScopeFallback") : "strict scope" },
            { tone: unresolved.length ? "warn" : "ok", title: "Decisions", detail: unresolved.join(", ") || t("none"), source: "governanceEvidenceBrief" },
            { tone: "ok", title: t("reportBrief"), detail: buildReportBrief([focus].filter(Boolean)).split("\\n").slice(0, 3).join(" · "), source: "copy-ready" },
          ],
        };
      }
      function renderOperatorLensPanel(focus, timelineItems) {
        const lens = normalizeOpsLens(app.opsLens);
        const controls = ["action", "evidence", "risk", "report"].map((value) =>
          '<button class="ops-lens-button" type="button" data-ops-lens="' + esc(value) + '" aria-pressed="' + String(lens === value) + '">' + esc(opsLensLabel(value)) + '</button>'
        ).join("");
        const insights = (buildOperatorInsights(focus || {}, timelineItems || [])[lens] || []).filter(Boolean);
        const cards = (insights.length ? insights : [{ tone: "warn", title: t("operatorInsightPanel"), detail: t("notDeclared"), source: "empty" }]).map((item) =>
          '<div class="insight-item ' + esc(item.tone || "") + '"><span class="rail-label">' + esc(item.title || "") + '</span><strong>' + esc(item.detail || "") + '</strong><span class="source">' + esc(item.source || "") + '</span></div>'
        ).join("");
        return '<div class="ops-lens-panel"><div class="ops-lens-strip"><span class="rail-label">' + esc(t("opsLens")) + '</span>' + controls + '</div><div><h3>' + esc(t("operatorInsightPanel")) + ' · ' + esc(opsLensLabel(lens)) + '</h3><div class="insight-stack">' + cards + '</div></div></div>';
      }
      function renderGantt(items) {
        const now = new Date();
        const [rangeStart, rangeEnd] = rangeWindow(items);
        const total = Math.max(DAY_MS, rangeEnd.getTime() - rangeStart.getTime());
        const visible = items.filter((item) => {
          const start = timelineStart(item, now);
          const end = timelinePlannedEnd(item, isActiveTimelineStatus(item.status) ? now : new Date(start.getTime() + DAY_MS));
          return end >= rangeStart && start <= rangeEnd;
        });
        const activeItems = visible.filter((item) => isActiveTimelineStatus(item.status));
        const blockedItems = visible.filter((item) => ["blocked", "failed"].includes(String(item.status || "").toLowerCase()));
        const closedItems = visible.filter((item) => ["complete", "completed", "closed"].includes(String(item.status || "").toLowerCase()));
        const laneCount = new Set(visible.map((item) => item.lane || "Work")).size;
        const oldestActiveAge = activeItems.reduce((max, item) => {
          const start = timelineStart(item, now);
          return Math.max(max, Math.ceil((now.getTime() - start.getTime()) / DAY_MS));
        }, 0);
        const todayLeft = Math.max(0, Math.min(100, ((now.getTime() - rangeStart.getTime()) / total) * 100));
        const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => new Date(rangeStart.getTime() + total * ratio));
        const axis = '<div class="gantt-axis"><span class="gantt-axis-label">' + esc(t("tab.work")) + ' / lane</span><div class="axis-ticks">' + ticks.map((tick, index) => '<span class="axis-tick" style="left:' + (index * 25) + '%">' + esc(formatShortDate(tick)) + '</span>').join("") + '</div></div>';
        const rows = visible.map((item) => {
          const status = normalizeTimelineStatus(item.status);
          const start = timelineStart(item, now);
          const end = timelinePlannedEnd(item, isActiveTimelineStatus(status) ? now : new Date(start.getTime() + DAY_MS));
          const left = Math.max(0, Math.min(100, ((start.getTime() - rangeStart.getTime()) / total) * 100));
          const right = Math.max(0, Math.min(100, ((end.getTime() - rangeStart.getTime()) / total) * 100));
          const rawWidth = Math.max(2, right - left);
          const width = Math.min(100, Math.max(8, rawWidth));
          const visualLeft = Math.max(0, Math.min(100 - width, left));
          const label = Math.round(Number(item.progressPercent || 0)) + "%";
          const age = isActiveTimelineStatus(status) ? Math.max(0, Math.ceil((now.getTime() - start.getTime()) / DAY_MS)) + "d WIP" : formatShortDate(start) + " to " + formatShortDate(end);
          const evidence = (item.evidenceRefs || []).slice(0, 3).join(", ") || t("noEvidence");
          const blockers = (item.blockingClaimIds || item.blocksClaimIds || []).slice(0, 3).join(", ") || t("none");
          const gateLeft = Math.max(0, Math.min(100, right));
          const phaseLeft = Math.max(0, visualLeft);
          const phaseWidth = Math.max(8, Math.min(100 - phaseLeft, width));
          return '<div class="gantt-row"><div class="gantt-meta"><span class="gantt-title">' + esc(item.title || item.id) + '</span><span class="gantt-subtitle"><span class="status-dot ' + esc(status) + '"></span><span class="lane-pill">' + esc(item.lane || "Work") + '</span><span>' + esc(item.owner || "unassigned") + '</span><span>' + esc(statusText(status)) + '</span><span>' + esc(age) + '</span></span><span class="gantt-evidence"><span><strong>' + esc(t("evidence")) + ':</strong> ' + esc(evidence) + '</span><span><strong>' + esc(t("blocks")) + ':</strong> ' + esc(blockers) + '</span><span><strong>' + esc(t("exit")) + ':</strong> ' + esc(item.exitCriteria || t("notDeclared")) + '</span></span></div><div class="gantt-track"><span class="gantt-phase" style="left:' + phaseLeft + '%;width:' + phaseWidth + '%">' + esc(item.lane || "Work") + '</span><span class="today-marker" style="left:' + todayLeft + '%" aria-hidden="true"></span><span class="gantt-gate" style="left:' + gateLeft + '%" data-label="exit"></span><div class="gantt-bar ' + esc(status) + '" style="left:' + visualLeft + '%;width:' + width + '%" title="' + esc(formatShortDate(start) + " to " + formatShortDate(end) + " | " + (item.nextActionRef || "no next action")) + '"><span class="gantt-label">' + esc(item.title || item.id) + '</span><span class="gantt-progress-label">' + esc(label) + '</span></div></div></div>';
        }).join("");
        const empty = visible.length === 0 ? '<p class="muted">No timeline items overlap this range.</p>' : "";
        const alternative = table([t("tab.work"), "Status", t("owner"), "Start", "End", t("evidence"), t("blocks"), "Next / " + t("exit")], visible.map((item) => {
          const start = timelineStart(item, now);
          const end = timelinePlannedEnd(item, isActiveTimelineStatus(item.status) ? now : new Date(start.getTime() + DAY_MS));
          return [
            esc(item.title || item.id),
            badge(statusText(item.status)),
            esc(item.owner || ""),
            esc(formatShortDate(start)),
            esc(formatShortDate(end)),
            esc((item.evidenceRefs || []).join(", ") || t("none")),
            esc((item.blockingClaimIds || item.blocksClaimIds || []).join(", ") || t("none")),
            esc(item.nextActionRef || item.exitCriteria || ""),
          ];
        }));
        const summary = '<div class="timeline-summary"><div class="timeline-chip"><span class="rail-label">' + esc(t("visibleWork")) + '</span><strong>' + esc(visible.length) + '</strong><span class="source">selected range</span></div><div class="timeline-chip"><span class="rail-label">' + esc(t("activeNow")) + '</span><strong>' + esc(activeItems.length) + '</strong><span class="source">animated bars</span></div><div class="timeline-chip risk"><span class="rail-label">' + esc(t("blockedGates")) + '</span><strong>' + esc(blockedItems.length) + '</strong><span class="source">readiness blockers</span></div><div class="timeline-chip"><span class="rail-label">' + esc(t("oldestWip")) + '</span><strong>' + esc(activeItems.length ? oldestActiveAge + "d" : t("none")) + '</strong><span class="source">' + esc(laneCount) + ' lanes, ' + esc(closedItems.length) + ' closed</span></div></div>';
        const legend = '<div class="gantt-legend" aria-label="Timeline status legend"><span class="legend-item"><span class="status-dot waiting"></span>' + esc(t("status.waiting")) + '</span><span class="legend-item"><span class="status-dot in-progress"></span>' + esc(t("status.in-progress")) + '</span><span class="legend-item"><span class="status-dot completed"></span>' + esc(t("status.completed")) + '</span><span class="legend-item"><span class="status-dot blocked"></span>' + esc(t("status.blocked")) + '</span></div>';
        return '<div class="toolbar"><label>' + esc(t("timelineRange")) + '<select id="timeline-range" aria-label="Timeline range"><option value="this-month">' + esc(t("thisMonth")) + '</option><option value="this-quarter">' + esc(t("thisQuarter")) + '</option><option value="this-year">' + esc(t("thisYear")) + '</option><option value="last-year">' + esc(t("lastYear")) + '</option><option value="all">' + esc(t("allWork")) + '</option></select></label><span class="source">' + esc(t("readinessMapCopy")) + '</span></div>' + summary + legend + '<div class="gantt" role="img" aria-label="Work readiness timeline with evidence links, blockers, exit gates, and WIP status">' + axis + rows + '</div>' + empty + '<h3>' + esc(t("tableAlternative")) + '</h3>' + alternative;
      }
      function progressPercent(item) {
        const value = Number(item.progressPercent);
        if (Number.isFinite(value)) return Math.max(0, Math.min(100, Math.round(value)));
        const status = normalizeTimelineStatus(item.status);
        if (status === "completed") return 100;
        if (status === "in-progress") return 45;
        return 0;
      }
      function remainingLabel(item) {
        const now = new Date();
        const status = normalizeTimelineStatus(item.status);
        if (["completed", "complete", "closed"].includes(status)) return app.locale === "ko" ? "완료됨" : "done";
        const end = timelinePlannedEnd(item, new Date(now.getTime() + DAY_MS));
        const days = Math.ceil((end.getTime() - now.getTime()) / DAY_MS);
        if (days < 0) return app.locale === "ko" ? Math.abs(days) + "일 지연" : Math.abs(days) + "d overdue";
        if (days === 0) return app.locale === "ko" ? "오늘" : "today";
        return app.locale === "ko" ? days + "일" : days + "d";
      }
      function progressBar(item) {
        const status = normalizeTimelineStatus(item.status);
        const pct = progressPercent(item);
        return '<div><div class="progress-copy"><span>' + esc(t("progress")) + ' ' + pct + '%</span><span>' + esc(t("remaining")) + ': ' + esc(remainingLabel(item)) + '</span></div><div class="progress-track"><div class="progress-fill ' + esc(status) + '" style="width:' + pct + '%"></div></div></div>';
      }
      function renderOpenWorkList(items) {
        const open = items.filter((item) => !["complete", "completed", "closed"].includes(String(item.status || "").toLowerCase())).slice(0, rowLimit(9));
        if (open.length === 0) return '<p class="muted">' + esc(t("noOpenWork")) + '</p>';
        return '<p class="muted">' + esc(t("openWorkHint")) + '</p><div class="open-work-grid">' + open.map((item) => {
          const status = normalizeTimelineStatus(item.status);
          const blockers = (item.blockingClaimIds || item.blocksClaimIds || []).slice(0, 2).join(", ") || t("none");
          return '<article class="work-card ' + esc(status) + '"><div><span class="badge ' + (status === "blocked" ? "risk" : status === "in-progress" ? "info" : "warn") + '">' + esc(statusText(status)) + '</span></div><span class="work-title">' + esc(item.title || item.id) + '</span><div class="work-meta"><span class="lane-pill">' + esc(item.lane || "Work") + '</span><span>' + esc(item.owner || "unassigned") + '</span></div>' + progressBar(item) + '<p class="source"><strong>' + esc(t("blocks")) + ':</strong> ' + esc(blockers) + '</p><p class="source"><strong>' + esc(t("exit")) + ':</strong> ' + esc(item.exitCriteria || item.nextActionRef || t("notDeclared")) + '</p></article>';
        }).join("") + '</div>';
      }
      function taskBoardGroups(items) {
        const groups = { current: [], remaining: [], completed: [] };
        for (const item of userVisibleTimelineItems(items || [])) {
          const status = normalizeTimelineStatus(item.status);
          if (isActiveTimelineStatus(status)) groups.current.push(item);
          else if (["complete", "completed", "closed"].includes(status)) groups.completed.push(item);
          else groups.remaining.push(item);
        }
        return groups;
      }
      function renderTaskColumn(label, rows, emptyLabel) {
        return '<section class="task-column"><h3><span>' + esc(label) + '</span><span class="badge">' + esc(rows.length) + '</span></h3>' +
          (rows.length ? rows.slice(0, rowLimit(8)).map((item) => {
            const status = normalizeTimelineStatus(item.status);
            return '<article class="task-mini-card"><strong>' + esc(item.title || item.id) + '</strong><span>' + badge(statusText(status)) + ' ' + esc(item.owner || "unassigned") + '</span><span class="source">' + esc(item.nextActionRef || item.exitCriteria || t("notDeclared")) + '</span></article>';
          }).join("") : '<p class="muted">' + esc(emptyLabel || t("none")) + '</p>') +
          '</section>';
      }
      function renderUserTaskBoard(items) {
        const visible = userVisibleTimelineItems(items || []);
        const groups = taskBoardGroups(visible);
        const empty = visible.length === 0 ? '<p class="muted">' + esc(((app.state.userTaskBoard || {}).emptyState) || t("userTaskEmpty")) + '</p>' : "";
        return '<div class="task-board"><p class="muted">' + esc(t("userTaskBoardHint")) + '</p>' + metricGrid([
          [t("currentWork"), groups.current.length, "in progress"],
          [t("remainingWork"), groups.remaining.length, "waiting / blocked"],
          [t("completedWork"), groups.completed.length, "done"],
          [t("needsUser"), ((app.state.taskQueues || {}).needsUser || []).length, "decisions"],
        ]) + empty + '<div class="task-board-columns">' +
          renderTaskColumn(t("currentWork"), groups.current, t("noOpenWork")) +
          renderTaskColumn(t("remainingWork"), groups.remaining, t("none")) +
          renderTaskColumn(t("completedWork"), groups.completed, t("none")) +
          '</div></div>';
      }
      function agentMaintenanceItems() {
        const agentQueues = app.state.agentTaskQueues || {};
        const seen = new Set();
        const items = [];
        for (const item of agentQueues.maintenance || []) {
          const id = String((item || {}).id || "");
          if (!id || seen.has(id)) continue;
          items.push(item);
          seen.add(id);
        }
        for (const item of buildTimelineItems().filter((entry) => isAgentOnlyTask(entry))) {
          const id = String((item || {}).id || "");
          if (!id || seen.has(id)) continue;
          items.push(item);
          seen.add(id);
        }
        return items;
      }
      function renderAgentMaintenanceTasks() {
        const items = agentMaintenanceItems();
        const hidden = hiddenAgentTaskIds();
        const cards = items.map((item) =>
          '<article class="maintenance-card"><span class="badge info">' + esc(t("agentOnly")) + '</span><strong>' + esc(item.title || item.id) + '</strong><span class="source">' + esc(item.nextActionRef || item.exitCriteria || "") + '</span><span class="source">' + esc(item.owner || "harness-dashboard-operator") + '</span></article>'
        ).join("");
        return '<div class="agent-maintenance-board"><p class="muted">' + esc(t("maintenanceHint")) + '</p>' + metricGrid([
          [t("agentMaintenanceTasks"), items.length, "agentTaskQueues"],
          [t("hiddenAgentTasks"), hidden.length, "not in user task board"],
          [t("waiting"), ((app.state.agentTaskQueues || {}).waiting || []).length, "maintenance waiting"],
          [t("closedItems"), ((app.state.agentTaskQueues || {}).completed || []).length, "maintenance done"],
        ]) + (cards || '<p class="muted">' + esc(t("none")) + '</p>') + '</div>';
      }
      function renderWorkViewSwitch() {
        return '<div class="toolbar"><div class="view-switch" role="group" aria-label="Work view mode"><button type="button" class="segment" data-work-view="kanban" aria-pressed="' + String(app.workView === "kanban") + '">' + esc(t("kanban")) + '</button><button type="button" class="segment" data-work-view="gantt" aria-pressed="' + String(app.workView === "gantt") + '">' + esc(t("gantt")) + '</button></div><span class="source">' + esc(t("purpose.work")) + '</span></div>';
      }
      function renderStatusLanes(items) {
        const groups = [
          ["waiting", t("status.waiting")],
          ["in-progress", t("status.in-progress")],
          ["blocked", t("status.blocked")],
          ["completed", t("status.completed")],
        ];
        return renderWorkViewSwitch() + '<div class="kanban-board">' + groups.map(([status, label]) => {
          const rows = items.filter((item) => {
            const normalized = normalizeTimelineStatus(item.status);
            if (status === "completed") return ["complete", "completed", "closed"].includes(String(item.status || "").toLowerCase());
            return normalized === status;
          }).slice(0, 10);
          return '<section class="kanban-column"><h3><span>' + esc(label) + '</span><span class="badge">' + rows.length + '</span></h3>' + (rows.length ? rows.map((item) => {
            const normalized = normalizeTimelineStatus(item.status);
            return '<article class="kanban-card ' + esc(normalized) + '"><strong>' + esc(item.title || item.id) + '</strong><div class="work-meta"><span class="lane-pill">' + esc(item.lane || "Work") + '</span><span>' + esc(item.owner || "unassigned") + '</span></div>' + progressBar(item) + '<span class="source">' + esc(item.nextActionRef || item.exitCriteria || "") + '</span></article>';
          }).join("") : '<p class="muted">' + esc(t("none")) + '</p>') + '</section>';
        }).join("") + '</div>';
      }
      function renderOverviewGuide() {
        const state = app.state || {};
        const score = state.governanceActionabilityScore || {};
        const evidence = state.governanceEvidenceBrief || {};
        const queues = state.taskQueues || {};
        const workSummary = ((state.workReadinessMap || {}).summary) || {};
        const missingCount = Array.isArray(evidence.missingEvidenceClaims) ? evidence.missingEvidenceClaims.length : 0;
        const openDecisionCount = Array.isArray(evidence.unresolvedDecisions) ? evidence.unresolvedDecisions.length : 0;
        const sourceCount = Array.isArray((state.projectEvidenceInventory || {}).sources) ? state.projectEvidenceInventory.sources.length : 0;
        const activeCount = Number(workSummary.activeRows || ((queues.inProgress || []).length + (queues.active || []).length) || 0);
        const blockedCount = Number(workSummary.blockedRows || (queues.blocked || []).length || 0);
        const setupScore = Number(score.onboardingScore ?? score.score ?? 0);
        const operationalScore = Number(score.operationalEvidenceScore ?? ((score.inputs || {}).projectEvidenceScore) ?? 0);
        const interpretation = app.locale === "ko" ? t("evidencePendingCopy") : (score.userInterpretation || t("evidencePendingCopy"));
        const activeLabel = app.locale === "ko" ? t("status.active") : "active";
        const blockedLabel = app.locale === "ko" ? t("status.blocked") : "blocked";
        const missingLabel = app.locale === "ko" ? "증거 필요" : "missing";
        const decisionsLabel = app.locale === "ko" ? "결정" : "decisions";
        return '<div class="overview-guide">' +
          '<div class="guide-hero"><span class="rail-label">' + esc(t("readThisFirst")) + '</span><strong>' + esc(t("harnessReady")) + '</strong><p>' + esc(t("setupReadyCopy")) + '</p><p class="muted">' + esc(interpretation) + '</p><ul class="guide-steps">' +
          '<li><span class="step-index">1</span><span>' + esc(t("guideStepWork")) + '</span></li>' +
          '<li><span class="step-index">2</span><span>' + esc(t("guideStepEvidence")) + '</span></li>' +
          '<li><span class="step-index">3</span><span>' + esc(t("guideStepTech")) + '</span></li>' +
          '</ul></div>' +
          '<div class="guide-strip">' +
          '<div class="guide-card ok"><span class="rail-label">' + esc(t("governanceSetup")) + '</span><strong>' + esc(setupScore.toFixed(1)) + '/10</strong><span>' + esc(genericStatusText(score.status || "ready")) + '</span></div>' +
          '<div class="guide-card warn"><span class="rail-label">' + esc(t("operationalEvidence")) + '</span><strong>' + esc(operationalScore.toFixed(1)) + '/10</strong><span>' + esc(t("evidencePending")) + '</span></div>' +
          '<div class="guide-card info"><span class="rail-label">' + esc(t("openWork")) + '</span><strong>' + esc(activeCount + blockedCount) + '</strong><span>' + esc(activeCount) + ' ' + esc(activeLabel) + ' · ' + esc(blockedCount) + ' ' + esc(blockedLabel) + '</span></div>' +
          '<div class="guide-card"><span class="rail-label">' + esc(t("evidence")) + '</span><strong>' + esc(sourceCount) + '</strong><span>' + esc(missingCount) + ' ' + esc(missingLabel) + ' · ' + esc(openDecisionCount) + ' ' + esc(decisionsLabel) + '</span></div>' +
          '</div></div>';
      }
      function renderWorldJudgment() {
        const judgment = app.state.worldJudgment || {};
        const allowed = (judgment.allowedActions || []).map((item) => '<li>' + esc(item) + '</li>').join("");
        const blocked = (judgment.blockedActions || []).map((item) => '<li>' + esc(item) + '</li>').join("");
        return '<div class="judgment risk card"><p><strong>' + esc(judgment.label || "World judgment") + ':</strong> ' + esc(judgment.summary || "") + '</p>' +
          metricGrid([
            ["Trust", (judgment.trustScore ?? "unknown") + "/100", judgment.trustLevel || "unknown"],
            ["Ledger", (judgment.freshness || {}).ledger || "unknown", "freshness"],
            ["Projection", (judgment.freshness || {}).projection || "unknown", "freshness"],
            ["Evidence", (judgment.freshness || {}).evidence || "unknown", "freshness"],
          ]) +
          '<div class="grid" style="margin-top:10px"><div style="grid-column:span 6"><h3>Allowed now</h3><ul>' + allowed + '</ul></div><div style="grid-column:span 6"><h3>Blocked until evidence improves</h3><ul>' + blocked + '</ul></div></div></div>';
      }
      function renderJudgmentConsole() {
        const consoleState = app.state.judgmentConsole || {};
        const permitted = (consoleState.permittedActions || []).map((item) => '<li>' + esc(item) + '</li>').join("");
        const blocked = (consoleState.blockedActions || []).map((item) => '<li>' + esc(item) + '</li>').join("");
        const values = (consoleState.valueAtRisk || []).map((item) => '<span class="value-pill">' + esc(item) + '</span>').join("");
        return '<div class="judgment-console"><div class="judgment-headline"><span class="rail-label">Current Judgment</span><strong>' + esc(consoleState.currentJudgment || "Judgment unavailable") + '</strong><p><strong>Decision:</strong> ' + esc(consoleState.nextRequiredDecisionLabel || consoleState.nextRequiredDecision || "none") + '</p><p><strong>Owner:</strong> ' + esc(consoleState.owner || "unassigned") + ' · <strong>Due:</strong> ' + esc(consoleState.decisionDeadline || "TBD") + '</p><div class="value-strip">' + values + '</div></div><div class="judgment-actions"><div class="card"><h3>Permitted now</h3><ul>' + permitted + '</ul></div><div class="card"><h3>Blocked now</h3><ul>' + blocked + '</ul></div></div></div>';
      }
      function renderTrustBoundary() {
        const trust = app.state.trustBoundary || {};
        const checks = trust.checks || [];
        return '<div class="trust-boundary">' +
          '<div class="metric"><span class="rail-label">Ledger root</span><strong class="mono">' + esc(String(trust.ledgerRootHash || "unknown").slice(0, 12)) + '</strong><span class="source">append-only truth</span></div>' +
          '<div class="metric"><span class="rail-label">Projection hash</span><strong class="mono">' + esc(String(trust.projectionStateHash || "unknown").slice(0, 12)) + '</strong><span class="source">disposable state</span></div>' +
          '<div class="metric"><span class="rail-label">Runtime path</span><strong class="mono">' + esc(String(trust.runtimeStatePathHash || "unknown").slice(0, 12)) + '</strong><span class="source">listener identity</span></div>' +
          '<div class="metric"><span class="rail-label">Boundary</span><strong>' + esc(trust.status || "unknown") + '</strong><span class="source">' + esc(checks.length) + ' checks</span></div>' +
          '</div>' +
          table(["Check", "Status", "Evidence", "Next"], checks.map((check) => [
            esc(check.label || check.id),
            badge(check.status),
            esc((check.evidenceRefs || []).join(", ") || "none"),
            esc(check.nextAction || ""),
          ]));
      }
      function renderQualityScorecard() {
        const scorecard = app.state.dashboardQualityScorecard || {};
        const dimensions = scorecard.dimensions || [];
        const rows = dimensions.map((item) => {
          const score = Math.max(0, Math.min(10, Number(item.score || 0)));
          return '<div class="quality-row"><span>' + esc(item.label || item.id) + '</span><span class="quality-track"><span class="quality-fill" style="width:' + (score * 10) + '%"></span></span><strong>' + esc(score.toFixed(1)) + '</strong></div>';
        }).join("");
        const provenance = (scorecard.evaluatorProvenance || []).map((item) => '<li>' + esc(item.evaluatorRole || item.id) + ': ' + esc(item.status || "unknown") + ' · ' + esc(item.checkedAt || "") + '</li>').join("");
        const whyNot = (scorecard.whyNot95Yet || []).map((item) => '<li>' + esc(item) + '</li>').join("");
        const qa = scorecard.qaEvidence || {};
        const qaRows = (qa.requiredFor95 || []).map((item) => '<li>' + esc(item) + '</li>').join("");
        return metricGrid([
          ["UI/UX", (Number(scorecard.uiUxDesignScore || 0)).toFixed(1) + "/10", "target " + (scorecard.targetScore || 9.5)],
          ["Project Evidence", (Number(scorecard.projectEvidenceScore || 0)).toFixed(1) + "/10", "truth score, not beautified"],
          ["Dimensions", dimensions.length, "scorecard rows"],
          ["QA Evidence", qa.status || "not-declared", "browser gate"],
        ]) + '<p class="muted">' + esc(scorecard.scoringPolicy || "") + '</p><div class="quality-meter">' + rows + '</div><h3>QA contract</h3><p class="muted">' + esc(qa.note || "") + '</p><ul>' + qaRows + '</ul><h3>Evaluator provenance</h3><ul>' + provenance + '</ul><h3>Why not 9.5 yet</h3><ul>' + whyNot + '</ul>';
      }
      function normalizeTraceEntry(entry) {
        const trace = entry.taskTrace || entry;
        const integrity = entry.traceIntegrity || trace.traceIntegrity || {};
        return {
          sessionId: entry.sessionId || entry.id || "session",
          title: entry.title || entry.goal || entry.sessionId || entry.id || "Session",
          status: entry.status || "unknown",
          phase: entry.phase || entry.stage || entry.currentPhase || "unknown",
          originalRequest: trace.originalRequest || entry.originalRequest || entry.goal || t("notDeclared"),
          processSummary: trace.processSummary || entry.processSummary || entry.note || t("notDeclared"),
          resultSummary: trace.resultSummary || entry.resultSummary || entry.note || t("notDeclared"),
          integrityStatus: integrity.status || trace.integrityStatus || "unknown",
          missingFields: integrity.missingFields || trace.missingFields || [],
          residualRisk: entry.residualRisk || trace.residualRisk || "",
          evidenceRefs: entry.evidenceRefs || entry.outputs || [],
          nextStep: entry.nextStep || entry.nextAction || t("notDeclared"),
          recordedAt: entry.recordedAt || trace.recordedAt || entry.endedAt || entry.startedAt || "",
          source: entry.source || trace.source || "",
        };
      }
      function renderSessionTraceability() {
        const traceRoot = app.state.sessionTraceability || {};
        const projectedEntries = Array.isArray(traceRoot.entries) ? traceRoot.entries : [];
        const governedEntries = (app.state.governedSessions || []).map((session) => ({
          ...session,
          sessionId: session.id,
          phase: session.stage || session.currentPhase,
          evidenceRefs: session.outputs || [],
        }));
        const seen = new Set();
        const entries = [...projectedEntries, ...governedEntries]
          .map(normalizeTraceEntry)
          .filter((entry) => {
            const key = entry.sessionId + ":" + entry.phase + ":" + entry.recordedAt;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, rowLimit(8));
        const cards = entries.map((entry) => {
          const hasMissing = (entry.missingFields || []).length > 0 || /missing|fallback|unknown/i.test(String(entry.integrityStatus));
          return '<article class="trace-card ' + (hasMissing ? 'warn' : '') + '"><div class="trace-meta">' +
            badge(entry.status) + badge(entry.phase) + '<span class="source">' + esc(entry.sessionId) + '</span><span class="source">' + esc(t("traceIntegrity")) + ': ' + esc(entry.integrityStatus) + '</span></div>' +
            '<h3>' + esc(entry.title) + '</h3>' +
            '<div class="trace-flow">' +
            '<div class="trace-step"><strong>' + esc(t("originalRequest")) + '</strong><p>' + esc(entry.originalRequest) + '</p></div>' +
            '<div class="trace-step"><strong>' + esc(t("processSummary")) + '</strong><p>' + esc(entry.processSummary) + '</p></div>' +
            '<div class="trace-step"><strong>' + esc(t("resultSummary")) + '</strong><p>' + esc(entry.resultSummary) + '</p></div>' +
            '</div>' +
            (entry.residualRisk ? '<p><strong>' + esc(t("residualRisk")) + ':</strong> ' + esc(entry.residualRisk) + '</p>' : '') +
            '<p><strong>' + esc(t("evidence")) + ':</strong> ' + esc((entry.evidenceRefs || []).slice(0, 6).join(", ") || t("noEvidence")) + '</p>' +
            '<p><strong>' + esc(t("nextOperatorMove")) + ':</strong> ' + esc(entry.nextStep) + '</p>' +
            (hasMissing ? '<p class="projection-warning">' + esc(t("traceIntegrity")) + ': ' + esc((entry.missingFields || []).join(", ") || entry.integrityStatus) + '</p>' : '') +
            '</article>';
        }).join("");
        return '<p class="muted">' + esc(traceRoot.purpose || "Session trace cards summarize governed work without raw JSON or chat history.") + '</p>' + (cards || '<p class="muted">' + esc(t("none")) + '</p>');
      }
      function renderActionabilityScore() {
        const score = app.state.governanceActionabilityScore || {};
        const setupScore = Number(score.onboardingScore ?? score.score ?? 0);
        const operationalScore = Number(score.operationalEvidenceScore ?? ((score.inputs || {}).projectEvidenceScore) ?? 0);
        const inputs = score.inputs || {};
        const cell = (label, ok) => '<div class="decision-cell ' + (ok ? 'ok' : 'risk') + '"><span class="rail-label">' + esc(label) + '</span><strong>' + esc(ok ? t("yes") : t("no")) + '</strong></div>';
        const nextItems = app.locale === "ko"
          ? [
              ...(Number(inputs.unresolvedDecisions || 0) > 0 ? [t("nextResolveDecision")] : []),
              ...(Number(inputs.dirtyOrUnclassifiedVcsPaths || 0) > 0 ? [t("nextClassifyVcs")] : []),
              ...(Number(inputs.missingEvidenceClaims || 0) > 0 ? [t("nextSupportEvidence")] : []),
              t("nextAppendEvents"),
            ]
          : (score.nextToReach95 || []);
        const next = nextItems.map((item) => '<li>' + esc(item) + '</li>').join("");
        const meaningText = app.locale === "ko" ? t("governanceScoreMeaningCopy") : (score.scoreMeaning || t("governanceScoreMeaningCopy"));
        const interpretationText = app.locale === "ko" ? t("evidencePendingCopy") : (score.userInterpretation || t("evidencePendingCopy"));
        const capReasonText = app.locale === "ko" ? t("releaseGateCopy") : (score.capReason || t("releaseGateCopy"));
        return '<div class="actionability"><div class="score-duo">' +
          '<div class="actionability-score"><span class="rail-label">' + esc(t("governanceSetup")) + '</span><strong>' + esc(setupScore.toFixed(1)) + '/10</strong><span>' + esc(genericStatusText(score.status || "unknown")) + '</span></div>' +
          '<div class="actionability-score secondary"><span class="rail-label">' + esc(t("operationalEvidence")) + '</span><strong>' + esc(operationalScore.toFixed(1)) + '/10</strong><span>' + esc(t("releaseEvidenceGate")) + '</span></div>' +
          '</div><div class="actionability-copy"><p><strong>' + esc(t("scoreMeaning")) + ':</strong> ' + esc(meaningText) + '</p><p class="muted">' + esc(interpretationText) + '</p><div class="decision-strip">' + cell(t("plan"), score.canPlan) + cell(t("build"), score.canBuild) + cell(t("release"), score.canRelease) + cell(t("operate"), score.canOperate) + cell(t("handoff"), score.canHandoff) + '</div><p><strong>' + esc(t("releaseEvidenceGate")) + ':</strong> ' + esc(capReasonText) + '</p><h3>' + esc(t("nextEvidenceToUnlock")) + '</h3><ul>' + next + '</ul></div></div>';
      }
      function renderSignals(signals) {
        const rows = (signals || []).map((signal) =>
          '<article class="signal ' + esc(signal.severity || "") + '"><h3>' + esc(signal.label || signal.id) + '</h3>' +
          badge(signal.severity || signal.status || "signal") +
          '<p>' + esc(signal.whyItMatters || "") + '</p><p><strong>Owner:</strong> ' + esc(signal.owner || "unassigned") + '</p><p><strong>Next:</strong> ' + esc(signal.nextAction || "") + '</p></article>'
        ).join("");
        return '<div class="signal-grid">' + rows + '</div>';
      }
      function renderReadiness() {
        const judgments = app.state.readinessJudgments || [];
        return table(["Judgment", "Status", "Rationale", "Evidence", "Required next action"], judgments.map((item) => [
          esc(item.label || item.id),
          badge(item.status),
          esc(item.rationale || ""),
          esc((item.evidenceRefs || []).join(", ") || "none"),
          esc(item.requiredNextAction || ""),
        ]));
      }
      function renderClaimMatrix() {
        const matrix = app.state.claimEvidenceMatrix || {};
        const claims = matrix.claims || [];
        const missing = matrix.missingEvidenceItems || [];
        return '<p class="muted">' + esc(matrix.claimModel || "") + '</p>' +
          table(["Claim", "Sign", "Object", "Interpretant", "Status", "Evidence", "Counter / Falsification", "Next"], claims.map((claim) => [
            esc(claim.statement || claim.claimId),
            esc(claim.sign || ""),
            esc(claim.object || claim.subjectRef || ""),
            esc(claim.interpretant || ""),
            badge(claim.claimStatus),
            esc(Math.round(Number(claim.confidence || 0) * 100) + "% · " + ((claim.evidenceRefs || []).join(", ") || "none")),
            esc(((claim.counterEvidenceRefs || []).join(", ") || "none") + " | " + ((claim.falsificationTests || []).slice(0, 2).join(" / ") || "no falsification test")),
            esc(claim.nextActionRef || ""),
          ])) +
          '<h3>Missing Evidence Items</h3>' +
          table(["Gap", "Blocks", "Required evidence", "Owner", "Resolution task"], missing.map((item) => [
            esc(item.label || item.id),
            esc((item.blocksClaimIds || []).join(", ")),
            esc(item.requiredEvidenceType || ""),
            esc(item.owner || ""),
            esc(item.resolutionTaskId || ""),
          ]));
      }
      function renderValueHierarchy() {
        const hierarchy = app.state.valueHierarchy || {};
        const values = hierarchy.values || [];
        return '<p class="muted">' + esc(hierarchy.purpose || "") + '</p>' +
          table(["Priority", "Value", "Rationale", "Conflict policy"], values.map((item) => [
            esc(item.priority || ""),
            esc(item.label || item.id),
            esc(item.rationale || ""),
            esc(item.conflictPolicy || ""),
          ]));
      }
      function renderAgentContextPacks() {
        const packs = app.state.agentContextPacks || {};
        return table(["Pack", "Primary question", "Must read", "Forbidden assumptions"], Object.values(packs).map((pack) => [
          esc(pack.label || ""),
          esc(pack.primaryQuestion || ""),
          esc((pack.mustRead || []).join(", ")),
          esc((pack.forbiddenAssumptions || []).join(", ") || "none"),
        ]));
      }
      function renderStakeholderReport() {
        const state = app.state;
        const brief = state.stakeholderBrief || {};
        const evidence = state.governanceEvidenceBrief || {};
        const timelineItems = userVisibleTimelineItems(buildTimelineItems());
        const open = timelineItems.filter((item) => !["complete", "completed", "closed"].includes(String(item.status || "").toLowerCase()));
        const blocked = open.filter((item) => ["blocked", "failed"].includes(String(item.status || "").toLowerCase()));
        const averageProgress = open.length ? Math.round(open.reduce((sum, item) => sum + progressPercent(item), 0) / open.length) : 100;
        const slideCta = '<div class="button-row stakeholder-only"><button class="primary" type="button" data-slideshow-open>' + esc(t("slideShowView")) + '</button><span class="source">' + esc(t("reportCta")) + '</span></div>';
        return '<div class="guide-hero"><span class="rail-label">' + esc(t("stakeholderReport")) + '</span><strong>' + esc(brief.currentGoal || "") + '</strong><p>' + esc(brief.whatChangedSinceLastReview || "") + '</p><p><strong>' + esc(t("whyMatters")) + ':</strong> ' + esc(brief.whyItMatters || "") + '</p>' + metricGrid([
          [t("progress"), averageProgress + "%", "open work average"],
          [t("openWork"), open.length, "waiting / active / blocked"],
          [t("blockedGates"), blocked.length, "needs decision or evidence"],
          [t("evidence"), (evidence.missingEvidenceClaims || []).length, "missing claims"],
        ]) + '<p><strong>' + esc(t("requiredDecision")) + ':</strong> ' + esc(brief.requiredDecision || t("none")) + '</p>' + slideCta + '</div>';
      }
      function renderRealityGoalCompass() {
        const compass = app.state.goalCompass || {};
        const gaps = (compass.topGaps || []).slice(0, 3);
        return '<div class="guide-strip">' +
          '<article class="guide-card"><span class="rail-label">' + esc(t("currentReality")) + '</span><strong>' + esc(compass.currentReality || t("notDeclared")) + '</strong></article>' +
          '<article class="guide-card ok"><span class="rail-label">' + esc(t("goalState")) + '</span><strong>' + esc(compass.goalState || t("notDeclared")) + '</strong></article>' +
          '<article class="guide-card warn"><span class="rail-label">' + esc(t("topGaps")) + '</span><ul>' + gaps.map((gap) => '<li><strong>' + esc(gap.label || gap.id) + '</strong><br><span class="source">' + esc(gap.nextActionRef || "") + '</span></li>').join("") + '</ul></article>' +
          '<article class="guide-card risk"><span class="rail-label">' + esc(t("nextSafeMove")) + '</span><strong>' + esc(compass.nextSafeMove || (app.state.agentResumeBrief || {}).nextSafestAction || t("notDeclared")) + '</strong></article>' +
          '</div>';
      }
      function renderRealityNextActionsHub() {
        const state = app.state || {};
        const compass = state.goalCompass || {};
        const phaseGate = compass.phaseGate || {};
        const judgment = state.judgmentConsole || {};
        const evidence = state.governanceEvidenceBrief || {};
        const matrix = state.claimEvidenceMatrix || {};
        const listener = state.listener || ((state.dashboardRuntime || {}).listener) || {};
        const timelineItems = userVisibleTimelineItems(buildTimelineItems());
        const openWork = timelineItems
          .filter((item) => !["complete", "completed", "closed"].includes(String(item.status || "").toLowerCase()))
          .slice(0, 4);
        const gaps = (compass.topGaps || []).slice(0, 3);
        const actions = [];
        if (compass.nextSafeMove || (state.agentResumeBrief || {}).nextSafestAction) {
          actions.push({
            label: compass.nextSafeMove || (state.agentResumeBrief || {}).nextSafestAction,
            status: phaseGate.status || judgment.currentJudgment || "next",
            owner: phaseGate.owner || judgment.owner || "harness-dashboard-operator",
            evidenceRefs: phaseGate.requiredChecks || compass.alignmentChecks || [],
            next: judgment.nextRequiredDecisionLabel || judgment.nextRequiredDecision || "",
          });
        }
        for (const item of openWork) {
          actions.push({
            label: item.title || item.id,
            status: item.status || "open",
            owner: item.owner || "unassigned",
            evidenceRefs: item.evidenceRefs || [],
            next: item.nextActionRef || item.exitCriteria || "",
          });
        }
        for (const gap of gaps) {
          actions.push({
            label: gap.label || gap.id,
            status: gap.status || "gap",
            owner: gap.owner || "unassigned",
            evidenceRefs: gap.evidenceNeeded || [],
            next: gap.nextActionRef || "",
          });
        }
        const seen = new Set();
        const uniqueActions = actions.filter((item) => {
          const key = String(item.label || "").toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 5);
        const missingEvidence = (matrix.missingEvidenceItems || []).slice(0, 5).map((item) => ({
          label: item.label || item.id,
          status: item.blocksReadiness === false ? "tracking" : "missing-evidence",
          owner: item.owner || "unassigned",
          target: item.requiredEvidenceType || item.resolutionTaskId || "",
          refs: item.blocksClaimIds || [],
        }));
        const decisions = (state.decisionContracts || [])
          .filter((item) => !["approved", "accepted", "closed"].includes(String(item.status || "").toLowerCase()))
          .slice(0, 3)
          .map((item) => ({
            label: item.decision || item.summary || item.id,
            status: item.status || "decision-needed",
            owner: item.owner || "unassigned",
            target: (item.evidence || []).join(", "),
            refs: [item.id],
          }));
        const evidenceTargets = [...missingEvidence, ...decisions].slice(0, 6);
        const routeFallback = [
          "/api/harness-dashboard/v1/snapshot",
          "/api/harness-dashboard/v1/tasks",
          "/api/harness-dashboard/v1/traceability",
          "/api/harness-dashboard/v1/briefing",
          "/api/harness-dashboard/v1/health",
          "/api/harness-dashboard/v1/events",
          "/api/harness-dashboard/v1/query",
        ];
        const routes = (((state.dashboardRuntime || {}).apiRoutes) || ((state.dashboardIndex || {}).apiRoutes) || routeFallback).slice(0, 8);
        const actionCards = uniqueActions.length
          ? uniqueActions.map((item) =>
              '<article class="hub-item ' + (String(item.status || "").includes("blocked") ? "risk" : "warn") + '"><strong>' + esc(item.label) + '</strong>' +
              '<span>' + badge(statusText(item.status)) + ' ' + esc(item.owner || "unassigned") + '</span>' +
              '<span class="source"><strong>' + esc(t("evidence")) + ':</strong> ' + esc((item.evidenceRefs || []).slice(0, 3).join(", ") || t("notDeclared")) + '</span>' +
              '<span class="source"><strong>' + esc(t("nextSafestAction")) + ':</strong> ' + esc(item.next || item.label || t("notDeclared")) + '</span></article>'
            ).join("")
          : '<p class="muted">' + esc(t("hubNoAction")) + '</p>';
        const evidenceCards = evidenceTargets.length
          ? evidenceTargets.map((item) =>
              '<article class="hub-item"><strong>' + esc(item.label) + '</strong><span>' + badge(statusText(item.status)) + ' ' + esc(item.owner || "unassigned") + '</span>' +
              '<span class="source">' + esc(item.target || t("notDeclared")) + '</span><span class="source">' + esc((item.refs || []).slice(0, 4).join(", ") || t("notDeclared")) + '</span></article>'
            ).join("")
          : '<p class="muted">' + esc(t("hubNoEvidenceTarget")) + '</p>';
        const apiRoutes = routes.map((route) => '<span class="route-chip">' + esc(route) + '</span>').join("");
        return '<div class="reality-action-hub">' +
          '<div class="hub-brief"><span class="rail-label">' + esc(t("hubCurrentRead")) + '</span><strong>' + esc(compass.currentReality || (state.worldJudgment || {}).summary || t("notDeclared")) + '</strong><p>' + esc(t("hubCurrentReadCopy")) + '</p>' +
          metricGrid([
            [t("goalState"), compass.goalState || t("notDeclared"), "goalCompass"],
            [t("risk"), judgment.currentJudgment || (state.worldJudgment || {}).status || "unknown", "judgmentConsole"],
            [t("evidence"), evidence.evidenceCoverage || ((matrix.missingEvidenceItems || []).length + " gaps"), "claimEvidenceMatrix"],
            [t("hubLocalApi"), listener.status || "not-started", listener.url || "loopback listener"],
          ]) +
          '<div class="hub-actions"><button type="button" class="hub-action-button" data-jump-tab="view-work">' + esc(t("hubOpenWorkTab")) + '</button><button type="button" class="hub-action-button" data-jump-tab="view-evidence">' + esc(t("hubOpenEvidenceTab")) + '</button><button type="button" class="hub-action-button" data-jump-tab="view-system">' + esc(t("hubOpenSystemTab")) + '</button></div></div>' +
          '<div class="hub-grid"><section class="hub-list"><h3>' + esc(t("hubPrimaryNextActions")) + '</h3>' + actionCards + '</section>' +
          '<section class="hub-list"><h3>' + esc(t("hubEvidenceTargets")) + '</h3>' + evidenceCards + '<div class="hub-item"><strong>' + esc(t("hubLocalApi")) + '</strong><span class="source">' + esc(t("hubApiCopy")) + '</span><div class="api-route-list">' + apiRoutes + '</div></div></section></div>' +
          '</div>';
      }
      function renderRealityGraph(nodes, edges) {
        const visibleNodes = nodes.slice(0, 8);
        const nodeCards = visibleNodes.map((node, index) =>
          '<article class="world-node"><span class="world-node-index">' + esc(index + 1) + '</span><strong>' + esc(node.label || node.id || t("notDeclared")) + '</strong><span class="source">' + esc(node.type || "node") + ' · ' + esc(node.state || "unknown") + '</span></article>'
        ).join("");
        const edgeChips = edges.slice(0, 12).map((edge) =>
          '<span class="world-edge"><span class="mono">' + esc(edge.from || "") + '</span> -> <span class="mono">' + esc(edge.to || "") + '</span> · ' + esc(edge.relation || "related") + '</span>'
        ).join("");
        return '<div class="world-map-visual" aria-label="Project world relationship map"><div class="world-node-grid">' + (nodeCards || '<p class="muted">' + esc(t("notDeclared")) + '</p>') + '</div><div class="world-edge-list">' + (edgeChips || '<span class="world-edge">' + esc(t("notDeclared")) + '</span>') + '</div></div>';
      }
      function renderProjectWorldMap() {
        const reality = app.state.realityModel || {};
        const nodes = reality.nodes || [];
        const edges = reality.edges || [];
        const missing = reality.missingRelationEvidence || [];
        return '<div class="stack"><p class="muted">' + esc(reality.purpose || "") + '</p>' + metricGrid([
          ["Nodes", nodes.length, "product / repo / service / environment"],
          ["Relations", edges.length, "physical and governance edges"],
          ["Missing relation evidence", missing.length, "must be resolved"],
          ["Update rule", "active", reality.updateRule || ""],
        ]) +
          renderRealityGraph(nodes, edges) +
          '<h3>' + esc(t("projectWorldMap")) + '</h3>' + table(["Node", "Type", "State", t("owner"), t("evidence")], nodes.slice(0, rowLimit(14)).map((node) => [
            esc(node.label || node.id),
            esc(node.type || ""),
            badge(node.state || "unknown"),
            esc(node.owner || ""),
            esc((node.evidenceRefs || []).slice(0, 2).join(", ")),
          ])) +
          '<h3>Relations</h3>' + table(["From -> To", "Relation", "Status", t("owner")], edges.slice(0, rowLimit(14)).map((edge) => [
            '<span class="mono">' + esc(edge.from || "") + '</span> -> <span class="mono">' + esc(edge.to || "") + '</span>',
            esc(edge.relation || ""),
            badge(edge.status || "unknown"),
            esc(edge.owner || ""),
          ])) +
          '<h3>Missing relation evidence</h3>' + table(["Gap", "Relation", t("owner"), "Next"], missing.map((item) => [
            esc(item.label || item.id),
            esc(item.relation || ""),
            esc(item.owner || ""),
            esc(item.nextActionRef || ""),
          ])) + '</div>';
      }
      function renderContextRotMonitor() {
        const monitor = app.state.contextRotMonitor || {};
        const warnings = monitor.rotWarnings || [];
        return '<div class="stack">' + metricGrid([
          ["Status", monitor.status || "unknown", "rot monitor"],
          ["Warnings", warnings.length, "stale / contradictory / missing context"],
          ["Expired facts", (monitor.expiredFacts || []).length, (monitor.expiredFacts || []).join(", ") || t("none")],
          ["Next evidence", (monitor.nextEvidenceToCollect || []).length, "collection queue"],
        ]) +
          table(["Warning", "Severity", "Owner", "Next"], warnings.slice(0, rowLimit(12)).map((warning) => [
            esc(warning.summary || warning.id),
            badge(warning.severity || "warning"),
            esc(warning.owner || ""),
            esc(warning.nextAction || ""),
          ])) +
          '<h3>Next evidence to collect</h3><ul>' + (monitor.nextEvidenceToCollect || []).map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul></div>';
      }
      function renderAgentResumeBoard() {
        const agent = app.state.agentResumeBrief || {};
        const platforms = app.state.agentPlatformGovernance || {};
        return '<div class="judgment-console"><div class="judgment-headline"><span class="rail-label">' + esc(t("agentResumeBoard")) + '</span><strong>' + esc(agent.nextSafestAction || "") + '</strong><p><strong>' + esc(t("lastSafeCheckpoint")) + ':</strong> ' + esc(agent.lastSafeCheckpoint || "") + '</p><p><strong>Confidence:</strong> ' + esc(agent.confidence || "unknown") + '</p></div><div class="card"><h3>Validation commands</h3><ul>' + (agent.validationCommands || []).map((item) => '<li class="mono">' + esc(item) + '</li>').join("") + '</ul></div></div>' +
          '<h3>Authoritative Files</h3>' + table(["File"], (agent.authoritativeFiles || []).slice(0, rowLimit(16)).map((item) => ['<span class="mono">' + esc(item) + '</span>'])) +
          '<h3>Agent Platform Governance</h3>' + metricGrid([
            [t("activePlatforms"), (platforms.activePlatforms || []).length, (platforms.activePlatforms || []).join(", ") || t("none")],
            [t("declaredPlatforms"), (platforms.declaredPlatforms || []).length, platforms.status || "awaiting"],
            [t("unusedInstructions"), (platforms.unusedInstructionState || []).length, "unused-instruction"],
            ["Open decisions", (agent.openDecisions || []).length, (agent.openDecisions || []).join(", ") || t("none")],
          ]);
      }
      function renderReportLab() {
        const reportItems = buildReportItems();
        const active = reportItems.filter((item) => isActiveTimelineStatus(item.status)).length;
        const blocked = reportItems.filter((item) => ["blocked", "failed"].includes(normalizeTimelineStatus(item.status))).length;
        const reportBrief = buildReportBrief(reportItems);
        const fallback = app.reportScopeFallback ? '<div class="projection-warning"><strong>' + esc(t("reportScopeFallback")) + ':</strong> ' + esc(t("reportScopeStrictEmpty")) + '</div>' : "";
        const copyStatus = app.reportCopyStatus ? '<span class="source" aria-live="polite">' + esc(app.reportCopyStatus) + '</span>' : "";
        return '<div class="report-lab"><div><span class="rail-label">' + esc(t("reportLab")) + '</span><p class="muted">' + esc(t("reportLabCopy")) + '</p></div>' +
          metricGrid([
            [t("reportScope"), reportFocusLabel(app.reportFocus), "local view state"],
            [t("openWork"), reportItems.length, "deck input rows"],
            [t("activeNow"), active, "in progress"],
            [t("blockedGates"), blocked, "blocked / failed"],
          ]) +
          fallback +
          '<div><h3>' + esc(t("reportBrief")) + '</h3><pre class="report-brief-preview" id="report-brief-preview">' + esc(reportBrief) + '</pre></div>' +
          '<div class="report-action-row">' +
          '<button class="primary" type="button" data-report-focus="today" data-slideshow-open>' + esc(t("applyTodayReport")) + '</button>' +
          '<button class="secondary" type="button" data-report-focus="active" data-slideshow-open>' + esc(t("openPptDashboard")) + ' · ' + esc(t("reportFocus.active")) + '</button>' +
          '<button class="secondary" type="button" data-report-focus="blocked" data-slideshow-open>' + esc(t("openPptDashboard")) + ' · ' + esc(t("reportFocus.blocked")) + '</button>' +
          '<button class="secondary" type="button" data-report-copy>' + esc(t("copyReportBrief")) + '</button>' +
          '<button class="secondary" type="button" data-report-print>' + esc(t("printReport")) + '</button>' +
          '</div>' + copyStatus + '</div>';
      }
      function renderDomainStressBoard() {
        const stress = app.state.domainStress || {};
        const operations = app.state.domainOperations || {};
        const profiles = stress.profiles || [];
        if (!profiles.length) {
          return '<p class="muted">No domain stress profile is active. Add primaryDomains or domainStressProfile to promote domain-specific gates.</p>';
        }
        const profileCards = profiles.map((profile) => {
          const gates = profile.evidenceGates || [];
          const sections = profile.reportSections || [];
          return '<article class="work-card blocked"><div><span class="badge risk">domain gate</span></div><span class="work-title">' + esc(profile.label || profile.id) + '</span><p>' + esc(profile.operatingQuestion || "") + '</p>' + metricGrid([
            ["Actors", (profile.actors || []).length, (profile.actors || []).slice(0, 3).join(", ")],
            ["Surfaces", (profile.criticalSurfaces || []).length, (profile.criticalSurfaces || []).slice(0, 2).join(", ")],
            ["Evidence Gates", gates.length, "mandatory"],
            ["Report Sections", sections.length, sections.slice(0, 2).join(", ")],
          ]) + '<p class="source"><strong>Next:</strong> ' + esc((gates[0] || {}).label || "Review profile gates") + '</p></article>';
        }).join("");
        const programRows = (operations.programs || []).map((program) => [
          esc(program.label || program.profileId),
          badge(program.status || "unknown"),
          esc(program.operatingQuestion || ""),
          esc((program.reportSections || []).join(", ")),
          esc(program.nextAction || ""),
        ]);
        const missing = (stress.missingEvidenceItems || []).slice(0, rowLimit(16));
        return '<div class="domain-stress-board"><div class="open-work-grid">' + profileCards + '</div>' +
          '<h3>Domain Operations Projection</h3>' + table(["Program", "Status", "Operating question", "Report sections", "Next"], programRows) +
          '<h3>Mandatory Evidence Gates</h3>' + table(["Gate", "Profile", "Section", "Owner", "Task"], missing.map((item) => [
            esc(item.label || item.id),
            esc(item.domainStressProfile || ""),
            esc(item.reportSection || ""),
            esc(item.owner || ""),
            esc(item.resolutionTaskId || ""),
          ])) + '</div>';
      }
      function renderMaintainerHealthBoard() {
        const release = app.state.releaseReadiness || {};
        const incident = app.state.incidentReadiness || {};
        const slo = app.state.sloSli || {};
        const db = app.state.databaseReadiness || {};
        const listener = app.state.listener || ((app.state.dashboardRuntime || {}).listener) || {};
        const timelineItems = userVisibleTimelineItems(buildTimelineItems());
        const reportItems = buildReportItems();
        const counts = workFlowCounts(timelineItems);
        const focus = selectedWorkItem(reportItems) || {};
        const evidenceBlockers = evidenceBlockerCount();
        const activeItems = timelineItems.filter((item) => isActiveTimelineStatus(item.status));
        const blockedItems = timelineItems.filter((item) => ["blocked", "failed"].includes(normalizeTimelineStatus(item.status)));
        const openItems = timelineItems.filter((item) => !["complete", "completed", "closed"].includes(normalizeTimelineStatus(item.status)));
        const avgProgress = openItems.length ? Math.round(openItems.reduce((sum, item) => sum + progressPercent(item), 0) / openItems.length) : 100;
        const nextAction = focus.nextActionRef || focus.exitCriteria || (app.state.agentResumeBrief || {}).nextSafestAction || t("notDeclared");
        const focusBlockers = (focus.blockingClaimIds || focus.blocksClaimIds || []).join(", ") || (blockedItems.length ? blockedItems.map((item) => item.title || item.id).slice(0, 2).join(", ") : t("none"));
        const eventPills = (app.uiEvents.length ? app.uiEvents : [{ at: "--:--", label: "load", detail: reportFocusLabel(app.reportFocus) }])
          .map((event) => '<span class="event-pill"><strong>' + esc(event.at) + '</strong> ' + esc(event.label) + ' · ' + esc(event.detail || "") + '</span>').join("");
        const focusButtons = reportItems.slice(0, 5).map((item) => {
          const pressed = String(item.id) === String((focus || {}).id);
          return '<button class="work-focus-button" type="button" data-focus-work="' + esc(item.id || "") + '" aria-pressed="' + String(pressed) + '"><strong>' + esc(item.title || item.id) + '</strong><span>' + badge(statusText(item.status)) + ' ' + esc(item.owner || "unassigned") + '</span><span class="source">' + esc(item.nextActionRef || item.exitCriteria || t("notDeclared")) + '</span></button>';
        }).join("");
        const flowCards = [
          ["waiting", t("waiting"), counts.waiting, "queue"],
          ["in-progress", t("activeNow"), counts["in-progress"], "WIP"],
          ["blocked", t("blockedGates"), counts.blocked, "timeline blocked"],
          ["blocked", t("evidenceBlockers"), evidenceBlockers, "needs proof / decision"],
          ["completed", t("closedItems"), counts.completed, "done"],
        ].map(([klass, label, count, source]) => '<div class="ops-flow-card ' + esc(klass) + '"><span class="rail-label">' + esc(label) + '</span><strong>' + esc(count) + '</strong><span class="source">' + esc(source) + '</span></div>').join("");
        return '<div class="ops-command"><div class="ops-command-hero">' +
          '<div class="ops-ring-card"><span class="rail-label">' + esc(t("currentWorkInfographic")) + '</span><div class="ops-ring" style="--pct:' + esc(avgProgress) + '%"><strong>' + esc(avgProgress) + '%</strong></div>' + metricGrid([
            [t("activeNow"), activeItems.length, "currently moving"],
            [t("blockedGates"), blockedItems.length, "timeline blocked"],
            [t("evidenceBlockers"), evidenceBlockers, "claim graph"],
          ]) + '</div>' +
          '<div class="ops-now-card"><span class="rail-label">' + esc(t("nowDoing")) + '</span><h3 class="ops-now-title">' + esc(focus.title || focus.goal || t("noOpenWork")) + '</h3><div class="ops-action-strip">' +
          '<div class="ops-action"><span class="rail-label">' + esc(t("nextOperatorMove")) + '</span><strong>' + esc(nextAction) + '</strong></div>' +
          '<div class="ops-action"><span class="rail-label">' + esc(t("owner")) + '</span><strong>' + esc(focus.owner || focus.agentRole || "unassigned") + '</strong></div>' +
          '<div class="ops-action"><span class="rail-label">' + esc(t("evidence")) + '</span><strong>' + esc((focus.evidenceRefs || focus.outputs || []).length) + '</strong><span class="source">' + esc(((focus.evidenceRefs || focus.outputs || []).slice(0, 2).join(", ")) || t("noEvidence")) + '</span></div>' +
          '</div><div class="button-row"><button type="button" class="secondary" data-jump-tab="view-work">' + esc(t("jumpToWork")) + '</button><button type="button" class="secondary" data-jump-tab="view-evidence">' + esc(t("jumpToEvidence")) + '</button><button type="button" class="secondary" data-jump-tab="view-governance">' + esc(t("jumpToGovernance")) + '</button></div></div></div>' +
          '<div class="ops-meta-grid">' +
          '<div class="ops-meta-card ok"><span class="rail-label">' + esc(t("whatDoing")) + '</span><strong>' + esc(focus.title || focus.goal || t("noOpenWork")) + '</strong><span class="source">' + esc(focus.lane || "Work") + '</span></div>' +
          '<div class="ops-meta-card"><span class="rail-label">' + esc(t("whyDoing")) + '</span><strong>' + esc((app.state.stakeholderBrief || {}).whyItMatters || (app.state.operationsHealth || {}).summary || "") + '</strong></div>' +
          '<div class="ops-meta-card warn"><span class="rail-label">' + esc(t("whatNext")) + '</span><strong>' + esc(nextAction) + '</strong></div>' +
          '<div class="ops-meta-card risk"><span class="rail-label">' + esc(t("whatBlocks")) + '</span><strong>' + esc(focusBlockers) + '</strong></div>' +
          '</div>' +
          renderOperatorLensPanel(focus, timelineItems) +
          '<div class="ops-flow-grid">' + flowCards + '</div>' +
          renderDomainStressBoard() +
          '<div class="grid"><div class="card" style="grid-column:span 6"><h3>' + esc(t("focusWork")) + '</h3><div class="work-focus-list">' + (focusButtons || '<p class="muted">' + esc(t("noOpenWork")) + '</p>') + '</div></div><div class="card" style="grid-column:span 6"><h3>' + esc(t("recentUiEvents")) + '</h3><div class="event-ticker">' + eventPills + '</div></div></div>' +
          renderReportLab() +
          '<div class="card"><h3>Operational gates</h3>' + metricGrid([
          ["Release", release.status || "unknown", release.releaseId || "not declared"],
          ["Incident", incident.mitigationStatus || "unknown", incident.escalationOwner || "owner TBD"],
          ["SLO", slo.lastTelemetryTimestamp || "not-connected", "telemetry freshness"],
          ["DB", db.migrationStatus || "not-connected", db.backupFreshness || "backup unknown"],
          ["Listener", listener.status || "not-started", listener.url || "local bridge"],
        ]) + '</div></div>';
      }
      function renderOverview() {
        const state = app.state;
        const brief = state.stakeholderBrief || {};
        const agent = state.agentResumeBrief || {};
        const evidence = state.governanceEvidenceBrief || {};
        const completeness = state.worldModelCompleteness || {};
        const mode = getAudienceMode();
        if (mode === "agent") {
          document.getElementById("view-overview").innerHTML =
            panel(t("realityNextActionsHub"), renderRealityNextActionsHub(), true) +
            panel(t("sessionTraceability"), renderSessionTraceability(), true) +
            panel(t("realityGoalCompass"), renderRealityGoalCompass(), true) +
            panel(t("agentResumeBoard"), renderAgentResumeBoard(), true) +
            panel(t("contextRotMonitor"), renderContextRotMonitor(), true) +
            panel(t("currentJudgmentConsole"), renderJudgmentConsole(), true) +
            panel(t("criticalSignals"), renderSignals(state.criticalSignals || []), true) +
            panel(t("ledgerTrust"), renderTrustBoundary(), true);
          return;
        }
        if (mode === "maintainer") {
          document.getElementById("view-overview").innerHTML =
            panel(t("realityNextActionsHub"), renderRealityNextActionsHub(), true) +
            panel(t("sessionTraceability"), renderSessionTraceability(), true) +
            panel(t("realityGoalCompass"), renderRealityGoalCompass(), true) +
            panel(t("maintainerHealthBoard"), renderMaintainerHealthBoard(), true) +
            panel(t("projectWorldMap"), renderProjectWorldMap(), true) +
            panel(t("worldJudgmentHeader"), renderWorldJudgment(), true) +
            panel(t("trustContinuity"), metricGrid([
              ["World Model", (completeness.score || 0) + "/" + (completeness.maxScore || 100), "completeness score"],
              ["Evidence", evidence.evidenceCoverage || "unknown", "coverage state"],
              ["Missing Claims", (evidence.missingEvidenceClaims || []).length, "needs proof"],
              ["Listener", (state.listener || {}).status || "not-started", "local bridge"],
            ]), true) +
            panel(t("ledgerTrust"), renderTrustBoundary(), true);
          return;
        }
        document.getElementById("view-overview").innerHTML =
          panel(t("realityNextActionsHub"), renderRealityNextActionsHub(), true) +
          panel(t("sessionTraceability"), renderSessionTraceability(), true) +
          panel(t("realityGoalCompass"), renderRealityGoalCompass(), true) +
          panel(t("stakeholderReport"), renderStakeholderReport(), true) +
          panel(t("projectWorldMap"), renderProjectWorldMap(), true) +
          panel(t("overviewGuide"), renderOverviewGuide(), true) +
          panel(t("governanceActionabilityScore"), renderActionabilityScore(), true) +
          panel(t("executiveOverview"), '<p><strong>' + esc(t("currentGoal")) + ':</strong> ' + esc(brief.currentGoal) + '</p><p><strong>' + esc(t("whatChanged")) + ':</strong> ' + esc(brief.whatChangedSinceLastReview) + '</p><p><strong>' + esc(t("whyMatters")) + ':</strong> ' + esc(brief.whyItMatters) + '</p><p><strong>' + esc(t("requiredDecision")) + ':</strong> ' + esc(brief.requiredDecision) + '</p><p><strong>' + esc(t("risk")) + ':</strong> ' + esc(brief.currentRisk) + '</p>', true) +
          panel(t("trustContinuity"), metricGrid([
            ["World Model", (completeness.score || 0) + "/" + (completeness.maxScore || 100), "completeness score"],
            ["Evidence", evidence.evidenceCoverage || "unknown", "coverage state"],
            ["Missing Claims", (evidence.missingEvidenceClaims || []).length, "needs proof"],
            ["Resume Confidence", agent.confidence || "unknown", "agentResumeBrief"],
          ]) + '<p><strong>' + esc(t("nextSafestAction")) + ':</strong> ' + esc(agent.nextSafestAction) + '</p><p><strong>' + esc(t("lastSafeCheckpoint")) + ':</strong> ' + esc(agent.lastSafeCheckpoint) + '</p>') +
          panel(t("currentJudgmentConsole"), renderJudgmentConsole(), true) +
          panel(t("worldJudgmentHeader"), renderWorldJudgment(), true) +
          panel(t("criticalSignals"), renderSignals(state.criticalSignals || []), true) +
          panel(t("decisionRiskPulse"), '<p><strong>' + esc(t("owner")) + ':</strong> ' + esc(brief.owner || "unassigned") + '</p><p><strong>' + esc(t("dueDate")) + ':</strong> ' + esc(brief.dueDate || "TBD") + '</p><p><strong>' + esc(t("nextMilestone")) + ':</strong> ' + esc(brief.nextMilestone || "") + '</p><p><strong>' + esc(t("openBlockers")) + ':</strong> ' + esc((agent.blockers || []).join(", ") || t("none")) + '</p>') +
          panel(t("dashboardQualityScorecard"), renderQualityScorecard(), true) +
          panel(t("ledgerTrust"), renderTrustBoundary(), true);
      }
      function renderWork() {
        const queues = filterTaskQueueIds(app.state.taskQueues || {});
        const agile = app.state.agile || app.state.agileCadence || {};
        const backlog = (agile.backlog || []).filter((item) => !isAgentOnlyTask(item));
        const timelineItems = userVisibleTimelineItems(buildTimelineItems());
        const activeItems = timelineItems.filter((item) => isActiveTimelineStatus(item.status));
        const activeCount = activeItems.length;
        const completedCount = timelineItems.filter((item) => ["complete", "completed", "closed"].includes(String(item.status || "").toLowerCase())).length;
        const lanes = new Set(timelineItems.map((item) => item.lane || "Work")).size;
        const now = new Date();
        const oldestActiveAge = activeItems.reduce((max, item) => {
          const start = timelineStart(item, now);
          return Math.max(max, Math.ceil((now.getTime() - start.getTime()) / DAY_MS));
        }, 0);
        const timelineCoverage = timelineItems.length > 0 ? Math.round((timelineItems.filter((item) => item.startAt || item.plannedStartAt).length / timelineItems.length) * 100) + "%" : "none";
        const board = panel(t("operationalQueue"), (app.workView === "gantt" ? renderWorkViewSwitch() + renderGantt(timelineItems) : renderStatusLanes(timelineItems)), true);
        const kpis = panel(t("workKpiInputs"), metricGrid([
            [t("timelineCoverage"), timelineCoverage, "dated work items"],
            [t("activeAnimated"), activeCount, "status=in-progress"],
            [t("oldestActiveAge"), activeCount > 0 ? oldestActiveAge + "d" : t("none"), "WIP aging"],
            [t("timelineLanes"), lanes, "delivery lanes"],
            [t("closedItems"), completedCount, "timeline closed"],
          ]), true);
        const details = panel(t("queueBacklogDetails"), table(["Queue", "Items"], Object.keys(queues).map((key) => [esc(key), esc((queues[key] || []).slice(0, rowLimit(20)).join(", ") || t("none"))]))
            + '<h3>Backlog</h3>'
            + table([t("tab.work"), "Status", t("owner")], backlog.slice(0, rowLimit(30)).map((item) => [esc(item.title || item.id), badge(item.status), esc(item.owner || "")])), true);
        if (getAudienceMode() === "stakeholder") {
          document.getElementById("view-work").innerHTML =
            panel(t("userTaskBoard"), renderUserTaskBoard(timelineItems), true) +
            kpis +
            board;
          return;
        }
        if (getAudienceMode() === "maintainer") {
          document.getElementById("view-work").innerHTML =
            panel(t("userTaskBoard"), renderUserTaskBoard(timelineItems), true) +
            kpis +
            board +
            details;
          return;
        }
        document.getElementById("view-work").innerHTML =
          panel(t("agentMaintenanceTasks"), renderAgentMaintenanceTasks(), true) +
          details +
          panel(t("userTaskBoard"), renderUserTaskBoard(timelineItems), true) +
          board +
          kpis;
      }
      function renderEvidence() {
        const state = app.state;
        const artifacts = state.artifacts || [];
        const vcs = state.versionControl || {};
        const evidence = state.governanceEvidenceBrief || {};
        const records = state.vcsChangeRecords || [];
        const inventory = state.projectEvidenceInventory || {};
        const coveragePanel = panel("Evidence Coverage", metricGrid([
            ["Coverage", evidence.evidenceCoverage || "unknown", "governanceEvidenceBrief"],
            ["Missing Claims", (evidence.missingEvidenceClaims || []).length, "claims without proof"],
            ["Unlinked VCS", (evidence.unlinkedCommitsOrRevisions || []).length, "commits/revisions"],
            ["Failed Validations", (evidence.failedValidations || []).length, "validation results"],
          ]) + '<p><strong>Missing:</strong> ' + esc((evidence.missingEvidenceClaims || []).slice(0, rowLimit(8)).join(", ") || "none") + '</p>', true);
        const inventoryPanel = panel("Project Evidence Inventory", table(["Source", "Type", "Status", "Promotes"], (inventory.sources || []).slice(0, rowLimit(30)).map((source) => [
            esc(source.path || source.id),
            esc(source.type || ""),
            badge(source.status || "observed"),
            esc((source.promotesClaimIds || []).join(", ") || "none"),
          ])), true);
        const artifactPanel = panel("Artifacts", table(["Artifact", "Path", "Status"], artifacts.slice(0, rowLimit(30)).map((a) => [esc(a.label || a.id), '<span class="mono">' + esc(a.path || "") + '</span>', badge(a.status)])), true);
        const vcsPanel = panel("Version Control", '<p><strong>Provider:</strong> ' + esc(vcs.provider) + '</p><p><strong>Status:</strong> ' + esc(vcs.status) + '</p><p><strong>Working copy:</strong> ' + esc(vcs.workingCopyStatus) + '</p>' + table(["Revision", "Author", "Linked"], records.slice(0, rowLimit(12)).map((record) => [esc(record.commitId || record.revisionId || ""), esc(record.author || ""), esc([...(record.linkedSessionIds || []), ...(record.linkedTaskIds || []), ...(record.linkedDecisionIds || [])].join(", ") || "unlinked")])), true);
        if (getAudienceMode() === "stakeholder") {
          document.getElementById("view-evidence").innerHTML =
            coveragePanel +
            panel(t("sessionTraceability"), renderSessionTraceability(), true) +
            inventoryPanel;
          return;
        }
        if (getAudienceMode() === "maintainer") {
          document.getElementById("view-evidence").innerHTML =
            vcsPanel +
            coveragePanel +
            panel(t("sessionTraceability"), renderSessionTraceability(), true) +
            inventoryPanel +
            artifactPanel;
          return;
        }
        document.getElementById("view-evidence").innerHTML =
          panel("Claim Evidence Matrix", renderClaimMatrix(), true) +
          coveragePanel +
          panel(t("sessionTraceability"), renderSessionTraceability(), true) +
          vcsPanel +
          inventoryPanel +
          artifactPanel;
      }
      function platformCommand(values) {
        return "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs record-agent-platforms --platforms " + values.join(",") + " --source dashboard-intake";
      }
      function selectedPlatformIds(governance) {
        let selected = (governance.declaredPlatforms || []).length > 0 ? governance.declaredPlatforms : (governance.activePlatforms || governance.detectedPlatforms || []);
        try {
          const saved = JSON.parse(localStorage.getItem("harness-dashboard-platform-selection") || "[]");
          if (Array.isArray(saved) && saved.length > 0) selected = saved;
        } catch {}
        return Array.from(new Set((selected || []).map((item) => String(item))));
      }
      function renderAgentPlatformIntake() {
        const governance = app.state.agentPlatformGovernance || {};
        const options = governance.platformOptions || [];
        const selected = selectedPlatformIds(governance);
        const selectedSet = new Set(selected);
        const instructionRows = (governance.instructionState || []).map((item) => [
          esc(item.label || item.platform),
          badge(item.state || "unknown"),
          esc((item.instructionPaths || []).join(", ") || t("none")),
          esc(item.reason || ""),
        ]);
        const cards = options.map((platform) => {
          const state = (governance.instructionState || []).find((item) => item.platform === platform.id) || {};
          const checked = selectedSet.has(platform.id);
          const klass = checked ? "active" : String(state.state || "").includes("unused") ? "unused" : "";
          return '<article class="platform-card ' + esc(klass) + '"><label><input type="checkbox" data-platform-checkbox value="' + esc(platform.id) + '"' + (checked ? " checked" : "") + ' /><span>' + esc(platform.label) + '</span></label><span class="source">' + esc(platform.governanceRole || "") + '</span><span>' + badge(state.state || (checked ? "active" : "not-generated")) + '</span><span class="source">' + esc((platform.instructionPaths || []).join(", ")) + '</span></article>';
        }).join("");
        const command = selected.length > 0 ? platformCommand(selected) : (governance.intake || {}).commandTemplate || "";
        const output = JSON.stringify({
          selectedPlatforms: selected,
          command,
          note: t("platformReadOnlyNote"),
        }, null, 2);
        return '<div class="platform-intake"><div><p class="muted">' + esc(t("platformIntakeCopy")) + '</p><div class="platform-grid">' + cards + '</div><div class="toolbar"><button class="primary" type="button" data-platform-submit>' + esc(t("recordPlatformDeclaration")) + '</button></div></div><div><div class="metric-grid">' +
          '<div class="metric"><span class="rail-label">' + esc(t("detectedPlatforms")) + '</span><strong>' + esc((governance.detectedPlatforms || []).length) + '</strong><span class="source">' + esc((governance.detectedPlatforms || []).join(", ") || t("none")) + '</span></div>' +
          '<div class="metric"><span class="rail-label">' + esc(t("declaredPlatforms")) + '</span><strong>' + esc((governance.declaredPlatforms || []).length) + '</strong><span class="source">' + esc((governance.declaredPlatforms || []).join(", ") || t("none")) + '</span></div>' +
          '<div class="metric"><span class="rail-label">' + esc(t("activePlatforms")) + '</span><strong>' + esc((governance.activePlatforms || []).length) + '</strong><span class="source">' + esc((governance.activePlatforms || []).join(", ") || t("none")) + '</span></div>' +
          '<div class="metric"><span class="rail-label">' + esc(t("unusedInstructions")) + '</span><strong>' + esc((governance.unusedInstructionState || []).length) + '</strong><span class="source">unused-instruction</span></div>' +
          '</div><p><strong>' + esc(t("platformCommandReady")) + '</strong></p><pre class="platform-output" id="platform-intake-output">' + esc(output) + '</pre></div></div>' +
          table(["Platform", "Instruction state", "Paths", "Reason"], instructionRows);
      }
      function renderGovernance() {
        const decisions = app.state.decisionContracts || [];
        const cadence = app.state.agile || app.state.agileCadence || {};
        const completeness = app.state.worldModelCompleteness || {};
        const gates = (cadence.gates || app.state.serviceCreationContract?.readinessGates || {});
        const decisionsPanel = panel("Decisions", table(["Decision", "Status", "Owner", "Impact"], decisions.slice(0, rowLimit(20)).map((d) => [esc(d.decision || d.id), badge(d.status), esc(d.owner || ""), esc(d.stakeholderImpact || "")])), true);
        const gatesPanel = panel("Governance Gates", table(["Gate", "State"], Object.entries(gates).map(([key, value]) => [esc(key), badge(value ? "approved" : "pending")])));
        const completenessPanel = panel("World Model Completeness", metricGrid([
            ["Score", (completeness.score || 0) + "/" + (completeness.maxScore || 100), "worldModelCompleteness"],
            ["Owners", completeness.ownersAssigned ? "assigned" : "missing", "ownersAssigned"],
            ["Environments", completeness.environmentsKnown ? "known" : "unknown", "environmentsKnown"],
            ["Risks", completeness.risksReviewed ? "reviewed" : "pending", "risksReviewed"],
          ]));
        const cadencePanel = panel("Cadence", '<p><strong>Iteration:</strong> ' + esc((cadence.iteration || {}).id || "") + '</p><p><strong>Review:</strong> ' + esc((cadence.review || {}).status || "") + '</p><p><strong>Retro:</strong> ' + esc((cadence.retro || {}).status || "") + '</p><p><strong>Definition of Done:</strong> ' + esc((cadence.definitionOfDone || []).join(", ")) + '</p>');
        if (getAudienceMode() === "stakeholder") {
          document.getElementById("view-governance").innerHTML =
            decisionsPanel +
            gatesPanel +
            completenessPanel;
          return;
        }
        if (getAudienceMode() === "maintainer") {
          document.getElementById("view-governance").innerHTML =
            gatesPanel +
            panel("Readiness Judgments", renderReadiness(), true) +
            decisionsPanel +
            cadencePanel;
          return;
        }
        document.getElementById("view-governance").innerHTML =
          panel(t("agentPlatformIntake"), renderAgentPlatformIntake(), true) +
          decisionsPanel +
          panel("Readiness Judgments", renderReadiness(), true) +
          panel("Value Hierarchy", renderValueHierarchy(), true) +
          gatesPanel +
          completenessPanel +
          cadencePanel;
      }
      function renderSystem() {
        const world = app.state.projectWorldModel || {};
        const serviceRegistry = app.state.serviceRegistry || {};
        const service = (serviceRegistry.services || [])[0] || {};
        const runtime = app.state.runtimeOrchestration || {};
        const listener = app.state.listener || ((app.state.dashboardRuntime || {}).listener) || {};
        const release = app.state.releaseReadiness || {};
        const incident = app.state.incidentReadiness || {};
        const slo = app.state.sloSli || {};
        const db = app.state.databaseReadiness || {};
        const topologyPanel = panel("System Topology", metricGrid([
            ["Services", (serviceRegistry.services || []).length, "serviceRegistry"],
            ["Environments", (world.environments || []).length, "projectWorldModel.environments"],
            ["Dependencies", (world.dependencies || []).length, "dependency graph edges"],
            ["Lifecycle", (world.mission || {}).serviceLifecycleMode || "unknown", "service lifecycle mode"],
          ]), true);
        const servicePanel = panel("Service Registry", table(["Service", "Lifecycle", "Contracts"], (serviceRegistry.services || []).slice(0, rowLimit(20)).map((item) => [esc(item.label || item.id), badge(item.lifecycleState), esc([item.serviceCreationContractId, item.runningServiceContractId].filter(Boolean).join(", "))])));
        const envPanel = panel("Environments", table(["Environment", "Status", "Runtime", "Secret policy"], (world.environments || []).slice(0, rowLimit(20)).map((env) => [esc(env.label || env.id), badge(env.status), esc((env.runtime || []).join(", ")), esc(env.secretPolicy || "references only")])));
        const depPanel = panel("Dependencies", table(["From", "To", "Criticality", "Status"], (world.dependencies || []).slice(0, rowLimit(30)).map((edge) => [esc(edge.from), esc(edge.to), esc(edge.criticality), badge(edge.status)])));
        const readinessPanel = panel("Operations Readiness", metricGrid([
            ["Release", release.status || "unknown", "releaseReadiness"],
            ["Incident", incident.mitigationStatus || "unknown", "incidentReadiness"],
            ["SLO", slo.lastTelemetryTimestamp || "not-connected", "sloSli"],
            ["DB", db.migrationStatus || "not-connected", "databaseReadiness"],
          ]), true);
        const listenerPanel = panel("Runtime And Listener", '<p><strong>Phase:</strong> ' + esc(runtime.currentPhase || "") + '</p><p><strong>Lease:</strong> ' + esc(runtime.leaseStatus || "") + '</p><p><strong>Listener:</strong> ' + esc(listener.status || "not-started") + ' ' + esc(listener.url || "") + '</p>');
        if (getAudienceMode() === "stakeholder") {
          document.getElementById("view-system").innerHTML =
            topologyPanel +
            readinessPanel;
          return;
        }
        document.getElementById("view-system").innerHTML =
          topologyPanel +
          servicePanel +
          envPanel +
          depPanel +
          readinessPanel +
          listenerPanel;
      }
      function inferTechStack() {
        const state = app.state;
        const brief = state.stakeholderBrief || {};
        const agent = state.agentResumeBrief || {};
        const inventory = state.projectEvidenceInventory || {};
        const sources = (inventory.sources || []).map((source) => String(source.path || source.id || "")).join(" ");
        const text = [brief.currentGoal, brief.whatChangedSinceLastReview, agent.currentProjectGoal, sources].join(" ");
        const items = [];
        const add = (label, role, evidence, confidence = "observed") => {
          if (!items.some((item) => item.label === label)) items.push({ label, role, evidence, confidence });
        };
        if (/react/i.test(text)) add("React", "Browser UI runtime", "stakeholder goal / package evidence", "declared");
        if (/vite/i.test(text) || /vite\.config/i.test(text)) add("Vite", "Frontend build tool", "vite config / package evidence", "observed");
        if (/node|package\.json|npm/i.test(text)) add("Node.js / npm", "Local toolchain and package manager", "package.json", "observed");
        if (/github pages/i.test(text)) add("GitHub Pages", "Static hosting target", "deployment plan", "declared");
        if (/github actions|deploy\.yml|workflow/i.test(text)) add("GitHub Actions", "CI/CD workflow", ".github/workflows/deploy.yml", "observed");
        if (/supabase/i.test(text)) add("Supabase", "Cloud data backend", "Supabase plan and SQL evidence", "declared");
        const lowerText = text.toLowerCase();
        if (/postgres|sql/i.test(text) || (lowerText.includes("supabase/") && lowerText.includes(".sql"))) add("Postgres", "Relational data store", "SQL schema evidence", "observed");
        if (/local storage|localstorage|로컬 스토리지/i.test(text)) add("localStorage", "Browser persistence fallback", "stakeholder goal", "declared");
        if (items.length === 0) add("Unclassified stack", "Needs evidence collection", "projectEvidenceInventory", "unknown");
        return items;
      }
      function renderTechStack() {
        const state = app.state;
        const world = state.projectWorldModel || {};
        const serviceRegistry = state.serviceRegistry || {};
        const service = (serviceRegistry.services || [])[0] || {};
        const inventory = state.projectEvidenceInventory || {};
        const release = state.releaseReadiness || {};
        const db = state.databaseReadiness || {};
        const tech = inferTechStack();
        const envs = world.environments || [];
        const deps = world.dependencies || [];
        const sourceRows = (inventory.sources || []).map((source) => [
          esc(source.path || source.id),
          esc(source.type || ""),
          badge(source.status || "observed"),
          esc((source.promotesClaimIds || []).join(", ") || t("none")),
        ]);
        const architecture = [
          ["primary", "Frontend", service.label || service.id || "project service", service.lifecycleState || "unknown"],
          ["", "Build / CI", tech.some((item) => item.label === "GitHub Actions") ? "GitHub Actions" : "not evidenced", release.status || "unknown"],
          ["", "Deploy", tech.some((item) => item.label === "GitHub Pages") ? "GitHub Pages" : "deployment target not evidenced", release.targetEnvironment || "unknown"],
          ["warn", "Data", tech.some((item) => item.label === "Supabase") ? "Supabase / Postgres" : (db.migrationStatus || "not connected"), db.backupFreshness || "backup unknown"],
        ].map(([klass, title, primary, secondary]) => '<div class="architecture-node ' + esc(klass) + '"><span class="rail-label">' + esc(title) + '</span><strong>' + esc(primary) + '</strong><span class="source">' + esc(secondary) + '</span></div>').join("");
        document.getElementById("view-tech").innerHTML =
          panel(t("stackComposition"), metricGrid([
            ["Services", (serviceRegistry.services || []).length, "serviceRegistry"],
            ["Environments", envs.length, "projectWorldModel.environments"],
            ["Dependencies", deps.length, "dependency graph"],
            ["Evidence sources", (inventory.sources || []).length, "projectEvidenceInventory"],
          ]) + '<p><strong>' + esc(t("currentGoal")) + ':</strong> ' + esc((state.stakeholderBrief || {}).currentGoal || "") + '</p>', true) +
          panel(t("architectureMap"), '<div class="architecture-map">' + architecture + '</div>', true) +
          panel(t("technologyStack"), '<div class="stack-grid">' + tech.map((item) => '<article class="stack-card"><strong>' + esc(item.label) + '</strong><span>' + esc(item.role) + '</span><span class="source">' + esc(t("confidence")) + ': ' + esc(item.confidence) + '</span><span class="source">' + esc(t("evidenceSource")) + ': ' + esc(item.evidence) + '</span></article>').join("") + '</div>', true) +
          panel(t("infraDeploy"), table(["Layer", "State", t("evidence")], [
            ["Release", badge(release.status || "unknown"), esc(release.releaseId || release.version || "not declared")],
            ["CI/CD", badge(tech.some((item) => item.label === "GitHub Actions") ? "observed" : "missing-evidence"), esc(".github/workflows/deploy.yml")],
            ["Hosting", badge(tech.some((item) => item.label === "GitHub Pages") ? "declared" : "unknown"), esc(release.targetEnvironment || "GitHub Pages target if approved")],
            ["Rollback", badge(release.rollbackCommand ? "declared" : "missing-evidence"), esc(release.rollbackCommand || "not declared")],
          ]), true) +
          panel(t("dataStorage"), table(["Asset", "State", t("evidence")], [
            ["Database", badge(db.migrationStatus || "not-connected"), esc(db.schemaVersion || "not declared")],
            ["Supabase", badge(tech.some((item) => item.label === "Supabase") ? "declared" : "unknown"), esc("project Supabase plan, if present")],
            ["Postgres SQL", badge(tech.some((item) => item.label === "Postgres") ? "observed" : "unknown"), esc("supabase/*.sql")],
            ["Browser persistence", badge(tech.some((item) => item.label === "localStorage") ? "declared" : "unknown"), esc("local save fallback")],
          ]), true) +
          panel(t("harnessIntegration") + " / Agent Context Packs", '<p class="muted">AI Agents should resume from the projected world model, not from chat memory. This panel intentionally describes project composition instead of exposing dashboard API routes.</p>' + renderAgentContextPacks(), true) +
          panel("Evidence Sources", table(["Source", "Type", "Status", "Promotes"], sourceRows), true);
      }
      function worldPrism(labelA, labelB, labelC) {
        return '<div class="world-prism" aria-hidden="true"><span class="prism-layer" style="--z:-58px"></span><span class="prism-layer" style="--z:0px"></span><span class="prism-layer" style="--z:58px"></span><span class="prism-node one">' + esc(labelA) + '</span><span class="prism-node two">' + esc(labelB) + '</span><span class="prism-node three">' + esc(labelC) + '</span></div>';
      }
      function deckMetricGrid(items) {
        return '<div class="deck-metrics">' + items.map(([label, value, source]) =>
          '<div class="deck-metric"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><span>' + esc(source || "") + '</span></div>'
        ).join("") + '</div>';
      }
      function deckProgress(items) {
        return '<div class="deck-card">' + items.map((item) => {
          const pct = progressPercent(item);
          return '<div class="deck-progress-row"><span><strong>' + esc(item.title || item.id) + '</strong><em>' + esc(pct + "% · " + remainingLabel(item)) + '</em></span><div class="deck-progress-track"><div class="deck-progress-fill" style="width:' + pct + '%"></div></div></div>';
        }).join("") + '</div>';
      }
      function deckWorkflow(items) {
        const rows = items.slice(0, 5).map((item) =>
          '<div class="deck-workflow-card"><strong>' + esc(item.title || item.id) + '</strong><span>' + esc(statusText(item.status)) + ' · ' + esc(item.owner || "unassigned") + '</span><br /><span>' + esc(item.nextActionRef || item.exitCriteria || t("notDeclared")) + '</span></div>'
        ).join("");
        return '<div class="deck-workflow">' + (rows || '<div class="deck-workflow-card">' + esc(t("noOpenWork")) + '</div>') + '</div>';
      }
      function buildSlides() {
        const state = app.state;
        const brief = state.stakeholderBrief || {};
        const agent = state.agentResumeBrief || {};
        const evidence = state.governanceEvidenceBrief || {};
        const queues = state.taskQueues || {};
        const allItems = workItemsForAudience(buildTimelineItems());
        const items = buildReportItems();
        const evidenceBlockers = evidenceBlockerCount();
        const open = items.filter((item) => !["complete", "completed", "closed"].includes(String(item.status || "").toLowerCase()));
        const active = items.filter((item) => isActiveTimelineStatus(item.status));
        const blocked = items.filter((item) => ["blocked", "failed"].includes(String(item.status || "").toLowerCase()));
        const completed = allItems.filter((item) => ["complete", "completed", "closed"].includes(String(item.status || "").toLowerCase()));
        const averageProgress = open.length ? Math.round(open.reduce((sum, item) => sum + progressPercent(item), 0) / open.length) : 100;
        const focus = selectedWorkItem(items) || {};
        const risks = (state.criticalSignals || []).slice(0, 4);
        const nextItems = [
          focus.nextActionRef || focus.exitCriteria,
          brief.requiredDecision,
          agent.nextSafestAction,
          brief.nextMilestone,
        ].filter(Boolean);
        const slides = [
          {
            kicker: t("reportFocus") + " · " + reportFocusLabel(app.reportFocus),
            title: getAudienceMode() === "maintainer" ? t("currentWorkInfographic") : t("deckExecutiveTitle"),
            body: '<p>' + esc(brief.whatChangedSinceLastReview || "") + '</p><p><strong>' + esc(t("whyMatters")) + ':</strong> ' + esc(brief.whyItMatters || "") + '</p>' + deckMetricGrid([
              [t("progress"), averageProgress + "%", "open work average"],
              [t("openWork"), open.length, "waiting / active / blocked"],
              [t("evidence"), (evidence.missingEvidenceClaims || []).length, "missing claims"],
              [t("vcs"), (state.versionControl || {}).workingCopyStatus || "unknown", "working copy"],
            ]),
            visual: worldPrism(t("currentGoal"), t("evidence"), t("nextMilestone")),
          },
          {
            kicker: t("thisWeekProgress"),
            title: getAudienceMode() === "maintainer" ? t("nowDoing") : t("deckWorkTitle"),
            body: '<p><strong>' + esc(focus.title || focus.goal || t("noOpenWork")) + '</strong></p><p>' + esc(focus.nextActionRef || focus.exitCriteria || t("openWorkHint")) + '</p>' + deckProgress(open.slice(0, 5)),
            visual: deckMetricGrid([
              [t("activeNow"), active.length, "animated WIP"],
              [t("blockedGates"), blocked.length, "needs help"],
              [t("evidenceBlockers"), evidenceBlockers, "claim graph"],
              [t("closedItems"), completed.length, "all done"],
            ]),
          },
          {
            kicker: t("workKpiInputs"),
            title: t("deckTimelineTitle"),
            body: '<p>' + esc(t("readinessMapCopy")) + '</p>' + deckMetricGrid([
              [t("timelineLanes"), new Set(allItems.map((item) => item.lane || "Work")).size, "delivery lanes"],
              [t("timelineCoverage"), allItems.length > 0 ? Math.round((allItems.filter((item) => item.startAt || item.plannedStartAt).length / allItems.length) * 100) + "%" : "none", "dated items"],
              [t("oldestActiveAge"), active.length ? Math.max(...active.map((item) => Math.ceil((Date.now() - timelineStart(item, new Date()).getTime()) / DAY_MS))) + "d" : t("none"), "WIP aging"],
              [t("handoff"), (state.governedSessions || []).length, "governed sessions"],
            ]),
            visual: deckWorkflow(items),
          },
          {
            kicker: t("decisionRiskPulse"),
            title: t("deckRiskTitle"),
            body: '<p><strong>' + esc(t("requiredDecision")) + ':</strong> ' + esc(brief.requiredDecision || t("none")) + '</p><ul class="deck-list">' + risks.map((risk) => '<li><strong>' + esc(risk.label || risk.id) + '</strong><br />' + esc(risk.nextAction || risk.whyItMatters || "") + '</li>').join("") + '</ul>',
            visual: deckMetricGrid([
              [t("risk"), risks.length, "critical signals"],
              ["Decisions", (evidence.unresolvedDecisions || []).length, "unresolved"],
              [t("evidenceBlockers"), evidenceBlockers, "missing proof"],
              [t("confidence"), agent.confidence || "unknown", "resume brief"],
            ]),
          },
          {
            kicker: t("nextMilestone"),
            title: t("deckNextTitle"),
            body: '<ul class="deck-list">' + nextItems.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul><p><strong>' + esc(t("owner")) + ':</strong> ' + esc(brief.owner || "unassigned") + ' · <strong>' + esc(t("dueDate")) + ':</strong> ' + esc(brief.dueDate || "TBD") + '</p>',
            visual: worldPrism(t("owner"), t("nextSafestAction"), t("evidence")),
          },
        ];
        if (getAudienceMode() === "maintainer") {
          slides.splice(3, 0, {
            kicker: t("maintainerHealthBoard"),
            title: t("metaThinking"),
            body: '<ul class="deck-list">' +
              '<li><strong>' + esc(t("whatDoing")) + '</strong><br />' + esc(focus.title || focus.goal || t("noOpenWork")) + '</li>' +
              '<li><strong>' + esc(t("whatNext")) + '</strong><br />' + esc(focus.nextActionRef || focus.exitCriteria || agent.nextSafestAction || t("notDeclared")) + '</li>' +
              '<li><strong>' + esc(t("whatBlocks")) + '</strong><br />' + esc(((focus.blockingClaimIds || focus.blocksClaimIds || []).join(", ")) || t("none")) + '</li>' +
              '</ul>',
            visual: deckMetricGrid([
              ["Release", (state.releaseReadiness || {}).status || "unknown", "gate"],
              ["Incident", (state.incidentReadiness || {}).mitigationStatus || "unknown", "ops"],
              ["DB", (state.databaseReadiness || {}).migrationStatus || "unknown", "data"],
              ["Listener", (state.listener || {}).status || "not-started", "bridge"],
            ]),
          });
          slides.splice(4, 0, {
            kicker: t("reportScope") + " · " + reportFocusLabel(app.reportFocus),
            title: t("reportBrief"),
            body: '<pre class="report-brief-preview">' + esc(buildReportBrief(items)) + '</pre>',
            visual: deckMetricGrid([
              [t("operatorInsightPanel"), opsLensLabel(app.opsLens), "interactive lens"],
              [t("claimActionGraph"), ((state.claimEvidenceMatrix || {}).missingEvidenceItems || []).length, "missing evidence"],
              [t("reportScope"), app.reportScopeFallback ? t("reportScopeFallback") : "strict", reportFocusLabel(app.reportFocus)],
              [t("needsUser"), ((state.taskQueues || {}).needsUser || []).length, "user decisions"],
            ]),
          });
        }
        return slides;
      }
      function renderSlideDeck() {
        const deck = document.getElementById("slide-deck");
        if (!deck) return;
        const slides = buildSlides();
        app.slideIndex = Math.max(0, Math.min(app.slideIndex, slides.length - 1));
        deck.classList.toggle("hidden", !app.slideDeckOpen);
        if (!app.slideDeckOpen) {
          deck.removeAttribute("data-rendered");
          deck.innerHTML = "";
          return;
        }
        const dots = slides.map((_, index) => '<button class="deck-dot" type="button" data-slide-go="' + index + '" aria-label="Go to slide ' + (index + 1) + '" aria-current="' + String(index === app.slideIndex) + '"></button>').join("");
        deck.style.setProperty("--slide-index", String(app.slideIndex));
        deck.innerHTML =
          '<div class="deck-topbar"><div><span class="deck-title" id="deck-heading">' + esc(slideDeckTitle()) + '</span><span class="deck-count"> ' + esc(app.slideIndex + 1) + ' / ' + esc(slides.length) + '</span></div><div class="deck-controls"><button class="deck-button" type="button" data-slide-fullscreen>' + esc(t("startPresentation")) + '</button><button class="deck-button" type="button" data-slide-close>' + esc(t("closePresentation")) + '</button></div></div>' +
          '<div class="deck-viewport"><div class="deck-track">' + slides.map((slide, index) => '<article class="deck-slide" aria-hidden="' + String(index !== app.slideIndex) + '"><div><span class="deck-kicker">' + esc(slide.kicker) + '</span><h2>' + esc(slide.title) + '</h2>' + slide.body + '</div><div>' + slide.visual + '</div></article>').join("") + '</div></div>' +
          '<div class="deck-controls"><button class="deck-button" type="button" data-slide-prev>' + esc(t("previousSlide")) + '</button><div class="deck-dots">' + dots + '</div><button class="deck-button primary" type="button" data-slide-next>' + esc(t("nextSlide")) + '</button></div>';
        if (deck.getAttribute("data-rendered") !== "true") {
          const close = deck.querySelector("[data-slide-close]");
          if (close) close.focus();
        }
        deck.setAttribute("data-rendered", "true");
      }
      function openSlideDeck(trigger) {
        if (!getAudienceConfig().slideshowEnabled) return;
        app.deckReturnFocus = trigger || document.activeElement;
        app.slideDeckOpen = true;
        app.slideIndex = 0;
        setSlideDeckBackgroundIsolation(true);
        renderSlideDeck();
      }
      function closeSlideDeck() {
        app.slideDeckOpen = false;
        setSlideDeckBackgroundIsolation(false);
        renderSlideDeck();
        if (app.deckReturnFocus && app.deckReturnFocus.focus) app.deckReturnFocus.focus();
      }
      function setSlideDeckBackgroundIsolation(isIsolated) {
        [document.querySelector(".shell"), document.getElementById("skip-link")]
          .filter(Boolean)
          .forEach((node) => {
            if ("inert" in node) node.inert = isIsolated;
            if (isIsolated) {
              node.setAttribute("aria-hidden", "true");
            } else {
              node.removeAttribute("aria-hidden");
            }
          });
      }
      function moveSlide(delta) {
        const slides = buildSlides();
        app.slideIndex = Math.max(0, Math.min(slides.length - 1, app.slideIndex + delta));
        renderSlideDeck();
      }
      function requestDeckFullscreen() {
        const deck = document.getElementById("slide-deck");
        if (deck && deck.requestFullscreen) {
          deck.requestFullscreen().catch(() => {});
        }
      }
      function copyReportBrief() {
        const text = buildReportBrief(buildReportItems());
        const finish = (status) => {
          app.reportCopyStatus = status || t("copiedReportBrief");
          addUiEvent("report-copy", reportFocusLabel(app.reportFocus));
          render();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => finish(t("copiedReportBrief"))).catch(() => finish(t("reportBrief") + " " + t("notDeclared")));
        } else {
          finish(t("reportBrief") + " " + t("notDeclared"));
        }
      }
      function printReport() {
        addUiEvent("report-print", reportFocusLabel(app.reportFocus));
        window.print();
      }
      function render() {
        renderChromeText();
        renderMode();
        renderProjectionConfidence();
        renderRail();
        renderOverview();
        renderWork();
        renderEvidence();
        renderGovernance();
        renderSystem();
        renderTechStack();
        renderTabPurpose();
        renderSlideDeck();
        bindDynamicControls();
      }
      function renderChromeText() {
        document.documentElement.lang = app.locale;
        const title = document.getElementById("dashboard-title");
        if (title) title.textContent = (title.getAttribute("data-workspace") || "") + " " + t("titleSuffix");
        const lede = document.getElementById("dashboard-lede");
        if (lede) lede.textContent = t("lede");
        const skip = document.getElementById("skip-link");
        if (skip) skip.textContent = t("skip");
        const audienceLabel = document.getElementById("audience-label");
        if (audienceLabel) audienceLabel.textContent = t("audience");
        const languageLabel = document.getElementById("language-label");
        if (languageLabel) languageLabel.textContent = t("language");
        const controlNote = document.getElementById("control-note");
        if (controlNote) controlNote.textContent = t("controlNote");
        const lensStatement = document.getElementById("lens-statement");
        if (lensStatement) {
          const config = getAudienceConfig();
          lensStatement.innerHTML = '<strong>' + esc(t("lensContract")) + ': ' + esc(config.label || getAudienceMode()) + '</strong><span>' + esc(lensQuestion()) + '</span>';
        }
        const slideshowButton = document.getElementById("slideshow-button");
        if (slideshowButton) {
          slideshowButton.textContent = t("slideShowView");
          slideshowButton.classList.toggle("hidden", !getAudienceConfig().slideshowEnabled);
        }
        const reportFocusLabelNode = document.getElementById("report-focus-label");
        if (reportFocusLabelNode) reportFocusLabelNode.textContent = t("reportFocus");
        const reportOptionMap = {
          "report-focus-option-today": "reportFocus.today",
          "report-focus-option-active": "reportFocus.active",
          "report-focus-option-blocked": "reportFocus.blocked",
          "report-focus-option-all": "reportFocus.all",
        };
        for (const [id, key] of Object.entries(reportOptionMap)) {
          const option = document.getElementById(id);
          if (option) option.textContent = t(key);
        }
        const optionMap = {
          "audience-option-stakeholder": "stakeholderView",
          "audience-option-agent": "agentView",
          "audience-option-maintainer": "maintainerView",
        };
        for (const [id, key] of Object.entries(optionMap)) {
          const option = document.getElementById(id);
          if (option) option.textContent = t(key);
        }
        const tabs = [
          ["tab-overview", "tab.overview", "purpose.overview", "Overview"],
          ["tab-work", "tab.work", "purpose.work", "Work"],
          ["tab-evidence", "tab.evidence", "purpose.evidence", "Evidence"],
          ["tab-governance", "tab.governance", "purpose.governance", "Governance"],
          ["tab-system", "tab.system", "purpose.system", "System"],
          ["tab-tech", "tab.tech", "purpose.tech", "TechStack"],
        ];
        for (const [id, labelKey, purposeKey, lensKey] of tabs) {
          const tab = document.getElementById(id);
          if (tab) {
            tab.textContent = tabLabel(t(labelKey), lensKey);
            tab.setAttribute("data-purpose", t(purposeKey));
          }
        }
        document.body.classList.remove("lens-stakeholder", "lens-agent", "lens-maintainer");
        document.body.classList.add("lens-" + getAudienceMode());
      }
      function renderTabPurpose() {
        const selected = document.querySelector('[role="tab"][aria-selected="true"]') || document.getElementById("tab-overview");
        const label = selected ? selected.textContent : "Overview";
        const purpose = selected ? selected.getAttribute("data-purpose") : "";
        document.getElementById("tab-purpose").innerHTML = '<strong>' + esc(label) + '</strong><span class="muted">' + esc(purpose || "") + '</span>';
      }
      function bindDynamicControls() {
        const audience = document.getElementById("audience-mode");
        if (audience) audience.value = app.audienceMode;
        const language = document.getElementById("language-mode");
        if (language) language.value = app.locale;
        const timelineRange = document.getElementById("timeline-range");
        if (timelineRange) timelineRange.value = app.timelineRange;
        const reportFocus = document.getElementById("report-focus");
        if (reportFocus) reportFocus.value = app.reportFocus;
        document.querySelectorAll("[data-work-view]").forEach((button) => {
          button.setAttribute("aria-pressed", String(button.getAttribute("data-work-view") === app.workView));
        });
      }
      function connectEvents() {
        if (!window.EventSource || app.mode === "Degraded Offline" || !localApiToken) return;
        try {
          const eventsUrl = "./api/harness-dashboard/v1/events?token=" + encodeURIComponent(localApiToken);
          const source = new EventSource(eventsUrl);
          source.addEventListener("harness.snapshot", (event) => {
            const envelope = JSON.parse(event.data);
            app.state = envelope.payload || app.state;
            app.mode = "Local Live";
            app.source = "SSE harness.snapshot";
            app.stale = false;
            render();
          });
          source.addEventListener("harness.changed", (event) => {
            const envelope = JSON.parse(event.data);
            app.state = envelope.payload || app.state;
            app.mode = "Local Live";
            app.source = "SSE harness.changed";
            app.stale = false;
            render();
          });
          source.onerror = () => {
            app.mode = app.stale ? "Degraded Offline" : "Static Snapshot";
            renderMode();
          };
        } catch {
          app.mode = "Static Snapshot";
        }
      }
      function switchTab(targetId) {
        document.querySelectorAll('[role="tab"]').forEach((tab) => {
          const selected = tab.getAttribute("aria-controls") === targetId;
          tab.setAttribute("aria-selected", String(selected));
        });
        document.querySelectorAll('[role="tabpanel"]').forEach((panel) => {
          panel.classList.toggle("hidden", panel.id !== targetId);
        });
        renderTabPurpose();
        const purpose = document.getElementById("tab-purpose");
        if (purpose && window.scrollY > purpose.offsetTop) {
          purpose.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      }
      document.querySelectorAll('[role="tab"]').forEach((tab) => {
        tab.addEventListener("click", () => switchTab(tab.getAttribute("aria-controls")));
        tab.addEventListener("keydown", (event) => {
          const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
          const index = tabs.indexOf(tab);
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
            tabs[next].focus();
            switchTab(tabs[next].getAttribute("aria-controls"));
          }
          if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            const next = event.key === "Home" ? 0 : tabs.length - 1;
            tabs[next].focus();
            switchTab(tabs[next].getAttribute("aria-controls"));
          }
        });
      });
      document.addEventListener("change", (event) => {
        const target = event.target;
        if (!target || !target.id) return;
        if (target.id === "audience-mode") {
          app.audienceMode = target.value;
          if (app.audienceMode === "agent") {
            app.slideDeckOpen = false;
          }
          render();
        }
        if (target.id === "timeline-range") {
          app.timelineRange = target.value;
          renderWork();
          bindDynamicControls();
        }
        if (target.id === "language-mode") {
          app.locale = target.value === "en" ? "en" : "ko";
          render();
        }
        if (target.id === "report-focus") {
          app.reportFocus = ["today", "active", "blocked", "all"].includes(target.value) ? target.value : "today";
          addUiEvent("report-focus", reportFocusLabel(app.reportFocus));
          render();
        }
      });
      document.addEventListener("click", (event) => {
        const rawTarget = event.target;
        const target = rawTarget && rawTarget.closest ? rawTarget.closest("[data-slideshow-open], [data-slide-close], [data-slide-prev], [data-slide-next], [data-slide-fullscreen], [data-slide-go], [data-work-view], [data-focus-work], [data-jump-tab], [data-platform-submit], [data-report-focus], [data-ops-lens], [data-report-copy], [data-report-print]") : rawTarget;
        if (!target || !target.getAttribute) return;
        const opensSlideDeck = target.hasAttribute("data-slideshow-open");
        const reportFocus = target.getAttribute("data-report-focus");
        if (reportFocus) {
          app.reportFocus = ["today", "active", "blocked", "all"].includes(reportFocus) ? reportFocus : "today";
          addUiEvent("report-focus", reportFocusLabel(app.reportFocus));
          render();
          if (!opensSlideDeck) return;
        }
        if (opensSlideDeck) {
          const refreshedTrigger = reportFocus ? document.querySelector('[data-report-focus="' + reportFocus + '"][data-slideshow-open]') : target;
          openSlideDeck(refreshedTrigger || target);
          return;
        }
        if (target.hasAttribute("data-slide-close")) {
          closeSlideDeck();
          return;
        }
        if (target.hasAttribute("data-slide-prev")) {
          moveSlide(-1);
          return;
        }
        if (target.hasAttribute("data-slide-next")) {
          moveSlide(1);
          return;
        }
        if (target.hasAttribute("data-slide-fullscreen")) {
          requestDeckFullscreen();
          return;
        }
        if (target.hasAttribute("data-report-copy")) {
          copyReportBrief();
          return;
        }
        if (target.hasAttribute("data-report-print")) {
          printReport();
          return;
        }
        const goSlide = target.getAttribute("data-slide-go");
        if (goSlide != null) {
          app.slideIndex = Number(goSlide) || 0;
          renderSlideDeck();
          return;
        }
        const workView = target.getAttribute("data-work-view");
        if (workView) {
          app.workView = workView;
          renderWork();
          bindDynamicControls();
        }
        const focusWork = target.getAttribute("data-focus-work");
        if (focusWork) {
          app.selectedWorkId = focusWork;
          addUiEvent("focus-work", focusWork);
          render();
          return;
        }
        const opsLens = target.getAttribute("data-ops-lens");
        if (opsLens) {
          app.opsLens = normalizeOpsLens(opsLens);
          addUiEvent("ops-lens", opsLensLabel(app.opsLens));
          render();
          return;
        }
        const jumpTab = target.getAttribute("data-jump-tab");
        if (jumpTab) {
          addUiEvent("jump-tab", jumpTab.replace("view-", ""));
          switchTab(jumpTab);
          return;
        }
        if (target.hasAttribute("data-platform-submit")) {
          const selected = Array.from(document.querySelectorAll("[data-platform-checkbox]:checked")).map((input) => input.value);
          const output = document.getElementById("platform-intake-output");
          if (selected.length === 0) {
            if (output) output.textContent = JSON.stringify({ error: "Select at least one active AI agent platform." }, null, 2);
            return;
          }
          try {
            localStorage.setItem("harness-dashboard-platform-selection", JSON.stringify(selected));
          } catch {}
          if (output) {
            output.textContent = JSON.stringify({
              selectedPlatforms: selected,
              command: platformCommand(selected),
              note: t("platformReadOnlyNote"),
            }, null, 2);
          }
        }
      });
      document.addEventListener("keydown", (event) => {
        if (!app.slideDeckOpen) return;
        if (event.key === "Tab") {
          const deck = document.getElementById("slide-deck");
          const focusables = deck ? Array.from(deck.querySelectorAll('button, [href], select, textarea, input, [tabindex]:not([tabindex="-1"])')).filter((node) => !node.disabled && node.offsetParent !== null) : [];
          if (focusables.length) {
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (deck && !deck.contains(document.activeElement)) {
              event.preventDefault();
              first.focus();
            } else if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeSlideDeck();
        }
        if (event.key === "ArrowRight" || event.key === "PageDown") {
          event.preventDefault();
          moveSlide(1);
        }
        if (event.key === "ArrowLeft" || event.key === "PageUp") {
          event.preventDefault();
          moveSlide(-1);
        }
        if (event.key === "Home") {
          event.preventDefault();
          app.slideIndex = 0;
          renderSlideDeck();
        }
        if (event.key === "End") {
          event.preventDefault();
          app.slideIndex = buildSlides().length - 1;
          renderSlideDeck();
        }
      });
      loadState();
    </script>
  </body>
</html>
`;
}

function buildDashboardReadme(): string {
  return `# Harness Dashboard 4.6.5: Project World Model

The dashboard is a ledger-backed Project World Model, not a Markdown-derived report page.

## Source Of Truth

- Canonical ledger: \`events/harness-events.jsonl\`
- Ledger manifest: \`events/ledger-manifest.json\`
- Normalized entities: \`entities/*.json\`
- Disposable projections: \`state/*.json\`
- Shareable view: \`index.html\`

## Operating Rules

1. Append canonical events before changing projected state.
2. Rebuild projections from the ledger when state is stale, corrupt, or migrated.
3. Treat \`state/dashboard-index.json\` as an AI Agent cache, not canonical truth.
4. Keep the local listener loopback-only, read-only, and token-protected.
5. Audience Lens is a deterministic view layer: Stakeholder, AI Agent, and Maintainer modes reorder, rename, and limit the same canonical data without creating separate truth.
6. Stakeholder mode includes a read-only fullscreen slide show for review-oriented reporting.
7. Record active AI-agent platforms with \`scripts/dashboard-ops.mjs record-agent-platforms --platforms ...\`; the dashboard UI prepares the command but does not write through the listener.
8. Use public-share export when a snapshot leaves the local machine.
9. Use \`scripts/dashboard-ops.mjs export-report --focus today --public\` to produce a reusable briefing, speaker notes, appendix, and manifest from the selected dashboard truth.
`;
}

function buildAudienceLensPresentationPlan(): string {
  return `# Audience Lens And Stakeholder Presentation Plan

## Purpose

Audience Lens is not a cosmetic selector. It is a deterministic presentation layer over the same canonical project world model. Stakeholders, AI Agents, and maintainers must see the same truth with different density, vocabulary, ordering, row limits, and primary actions.

## Negative Review Findings

- A lens selector that only changes a label is misleading and should not be considered implemented.
- Stakeholder reporting fails if the user must scan raw tables to answer basic PM questions about progress, blockers, decisions, and remaining work.
- Separate persisted per-audience data would create divergent truth and violate the ledger-first dashboard doctrine.
- A slideshow must not become a second source of truth or an executive narrative that hides uncertainty.
- External CDN visual libraries are not acceptable for the single-file, offline-shareable dashboard contract.

## Design Contract

- The append-only ledger remains canonical.
- Dashboard state and HTML remain disposable projections.
- Audience Lens changes only derived presentation: tab labels, panel order, row limits, vocabulary, first-panel priority, and actions.
- Stakeholder mode emphasizes reportability: progress, what changed, why it matters, risks, decisions, owners, due dates, and next milestone.
- AI Agent mode emphasizes resumability: next safest action, authoritative files, forbidden assumptions, validation commands, blockers, and platform governance.
- Maintainer mode emphasizes operability: service topology, listener health, VCS state, release readiness, incident readiness, SLO/SLI, database readiness, and runtime risk.
- Slideshow mode is read-only, generated from the loaded projection, and uses the Fullscreen API only after user gesture.

## Slideshow Contract

- Stakeholder and Maintainer modes expose a Slide Show View / report deck entry point.
- Slides are generated from the same loaded state as the dashboard.
- Each slide has one headline message, one evidence or provenance cue, and one explicit next-action implication.
- Slides support next, previous, direct dot navigation, Escape close, ArrowLeft, ArrowRight, Home, End, reduced motion, and print/PDF capture.
- No slide may depend on raw JSON, local file paths, private URLs, tokens, or secret values as its primary stakeholder explanation.

## Acceptance Criteria

- Changing Audience Lens visibly changes tab labels, first-panel priority, information density, row limits, and primary action affordances.
- All lens views share the same source event sequence and state hash.
- Stakeholder mode can answer within 30 seconds: what changed, how complete the work is, what remains, what is blocked, who owns the decision, and what happens next.
- AI Agent mode can answer: what is the next safest action, which files are authoritative, what assumptions are forbidden, and how validation should run.
- Maintainer mode can answer: what operational evidence is missing, which systems are involved, whether release/data/incident gates are ready, and whether the listener/runtime state is healthy.
- Slideshow works offline from embedded state and in local-live mode without CDN, remote fonts, remote images, POST routes, shell execution, file writes, or LLM calls.
- Public export redaction must apply to slideshow content.
- Tests must parse generated client JS and assert lens/slideshow structures exist.
`;
}

function buildDesignFrameworkHtml(): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<title>Harness Dashboard Design Framework</title>
<body>
  <h1>Harness Dashboard 4.6.5 Design Framework</h1>
  <p>Executive Overview first. Same data, different density for Stakeholder, AI Agent, and Maintainer modes.</p>
  <ul>
    <li>Modes: Local Live, Static Snapshot, Degraded Offline.</li>
    <li>Components: status rail, decision cards, open-work queue, status-lane/timeline switcher, evidence tables, relationship maps, and technology stack panels.</li>
    <li>Accessibility: WCAG 2.2 AA, semantic tabs, keyboard navigation, table alternatives for charts, reduced motion.</li>
    <li>No CDN, no remote fonts, no remote assets.</li>
  </ul>
</body>
</html>
`;
}

function buildBackendBlueprintHtml(): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<title>Optional Backend Dashboard Blueprint</title>
<body>
  <h1>Optional Backend Dashboard Blueprint</h1>
  <p>The default 4.6.5 dashboard uses a local read-only bridge. A full backend dashboard is an optional future implementation, not generated by default.</p>
  <ul>
    <li>Must preserve ledger-first governance.</li>
    <li>Must not replace the local single-file dashboard contract.</li>
    <li>Must implement explicit auth, tenancy, audit logs, and deployment governance before cloud use.</li>
  </ul>
</body>
</html>
`;
}

function jsonFile(relativePath: string, value: unknown): GeneratedFile {
  return {
    relativePath,
    content: `${JSON.stringify(value, null, 2)}\n`,
  };
}

export function generateDashboardFiles(
  params: WorkspaceInitParams
): GeneratedFile[] {
  if (params.includeHarnessEngineering === false) {
    return [];
  }

  const state = buildDashboardState(params) as Record<string, unknown>;
  const index = buildDashboardIndex(state);
  const runtime = buildDashboardRuntime(state);
  const event = buildBootstrapEvent(params, state);
  const manifest = buildLedgerManifest(event);
  const stateJson = JSON.stringify(state, null, 2);

  return [
    {
      relativePath: "docs/ai-harness/dashboard/README.md",
      content: buildDashboardReadme(),
    },
    {
      relativePath: "docs/ai-harness/dashboard/audience-lens-presentation-plan.md",
      content: buildAudienceLensPresentationPlan(),
    },
    {
      relativePath: "docs/ai-harness/dashboard/index.html",
      content: buildDashboardHtml(params, stateJson),
    },
    {
      relativePath: "docs/ai-harness/dashboard/design-framework.html",
      content: buildDesignFrameworkHtml(),
    },
    jsonFile("docs/ai-harness/dashboard/state/design-framework.json", {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      modes: ["Local Live", "Static Snapshot", "Degraded Offline"],
      audienceModes: ["Stakeholder", "AI Agent", "Maintainer"],
      accessibility: "WCAG 2.2 AA",
      remoteAssetsAllowed: false,
    }),
    jsonFile("docs/ai-harness/dashboard/state/design-profile.json", {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      defaultLandingView: "Executive Overview",
      tabs: ["Overview", "Work", "Evidence", "Governance", "System", "Tech Stack"],
      audienceLens: {
        modes: ["Stakeholder", "AI Agent", "Maintainer"],
        behavior:
          "Changing Audience Lens must visibly change tab labels, first-panel priority, information density, row limits, vocabulary, and primary actions while preserving the same canonical source truth.",
        slideshow:
          "Stakeholder mode includes a built-in no-CDN swiper-style fullscreen slide show for review-oriented reporting.",
      },
      informationArchitecture: {
        antiDuplicationRule:
          "Each tab owns one job. Overview may summarize critical signals, but detail tables stay in their owning tabs.",
        viewResponsibilities: {
          Overview:
            "Executive synthesis: world judgment, critical signals, change, consequence, decision, risk, trustworthiness, and next safe action.",
          Work:
            "Delivery execution: timeline, WIP aging, queues, backlog, and throughput/KPI source data.",
          Evidence:
            "Proof and provenance: claim-to-evidence matrix, missing evidence items, artifacts, validation coverage, and Git/SVN linkage.",
          Governance:
            "Decision system: AI platform intake, value hierarchy, readiness judgments, approvals, gates, cadence, retro, definitions of ready/done, and completeness scoring.",
          System:
            "Operational topology: services, environments, dependencies, release/incident/SLO/database readiness, and listener health.",
          "Tech Stack":
            "Project composition: architecture, runtime stack, infrastructure, deployment path, data stores, and harness integration points.",
        },
      },
      components: [
        "persistent-status-rail",
        "audience-mode-selector",
        "tab-purpose-strip",
        "world-judgment-header",
        "critical-signal-radar",
        "claim-evidence-matrix",
        "value-hierarchy-table",
        "readiness-judgment-table",
        "agent-context-packs",
        "language-switcher-ko-en",
        "audience-lens-derived-view",
        "stakeholder-fullscreen-slide-deck",
        "css-3d-world-prism",
        "work-kanban-gantt-switcher",
        "work-timeline-gantt",
        "timeline-range-filter",
        "task-flow-chart-with-table-alternative",
        "decision-contract-table",
        "agent-platform-intake",
        "evidence-coverage-panel",
        "project-tech-stack-map",
      ],
      constraints: [
        "single html file",
        "no CDN",
        "no remote fonts",
        "no remote assets",
        "semantic tabs",
        "keyboard navigation",
        "reduced motion",
        "non-color-only status",
      ],
      openSourceAdapterPolicy:
        "Use bundled or backend-owned open-source libraries only when they do not break the single-file, no-CDN, no-remote-assets dashboard contract.",
      recommendedOpenSourceLibraries: [
        "Frappe Gantt",
        "Apache ECharts",
        "Mermaid",
        "Cytoscape.js",
        "FullCalendar",
        "Tabulator",
      ],
    }),
    {
      relativePath: "docs/ai-harness/dashboard/backend-app-blueprint.html",
      content: buildBackendBlueprintHtml(),
    },
    jsonFile("docs/ai-harness/dashboard/state/backend-app-blueprint.json", {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      defaultGenerated: false,
      purpose:
        "Specification for future opt-in backend dashboard implementation.",
      nonGoals: [
        "No backend dashboard app is generated by default.",
        "No database is required for 4.6.5 MVP.",
        "No persistent UI writes are allowed by default.",
      ],
    }),
    {
      relativePath: "docs/ai-harness/dashboard/events/harness-events.jsonl",
      content: `${JSON.stringify(event)}\n`,
    },
    jsonFile("docs/ai-harness/dashboard/events/ledger-manifest.json", manifest),
    jsonFile("docs/ai-harness/dashboard/entities/project-world-model.json", state.projectWorldModel),
    jsonFile("docs/ai-harness/dashboard/entities/reality-model.json", state.realityModel),
    jsonFile("docs/ai-harness/dashboard/entities/goal-compass.json", state.goalCompass),
    jsonFile("docs/ai-harness/dashboard/entities/context-rot-monitor.json", state.contextRotMonitor),
    jsonFile("docs/ai-harness/dashboard/evaluations/harness-evaluation.json", state.harnessEvaluation),
    jsonFile("docs/ai-harness/dashboard/entities/sessions.json", state.governedSessions),
    jsonFile("docs/ai-harness/dashboard/entities/tasks.json", state.agile),
    jsonFile("docs/ai-harness/dashboard/entities/artifacts.json", state.artifacts),
    jsonFile("docs/ai-harness/dashboard/entities/decisions.json", state.decisionContracts),
    jsonFile("docs/ai-harness/dashboard/entities/dictionary-terms.json", state.dictionary),
    jsonFile("docs/ai-harness/dashboard/entities/vcs-records.json", state.vcsChangeRecords),
    jsonFile("docs/ai-harness/dashboard/state/dashboard-state.json", state),
    jsonFile("docs/ai-harness/dashboard/state/dashboard-index.json", index),
    jsonFile("docs/ai-harness/dashboard/state/dashboard-runtime.json", runtime),
    jsonFile("docs/ai-harness/dashboard/state/embedding-documents.json", state.embeddingProjection),
    {
      relativePath: "docs/ai-harness/dashboard/schemas/events/harness-event.schema.json",
      content: buildSchema("Harness Dashboard Event Envelope", [
        "eventId",
        "sequence",
        "eventType",
        "eventVersion",
        "workspaceId",
        "aggregateId",
        "aggregateType",
        "aggregateVersion",
        "occurredAt",
        "recordedAt",
        "actor",
        "agentId",
        "sourceTool",
        "correlationId",
        "causationId",
        "idempotencyKey",
        "payloadHash",
        "previousEventHash",
        "redactionLevel",
        "payload",
      ]),
    },
    {
      relativePath: "docs/ai-harness/dashboard/schemas/entities/project-world-model.schema.json",
      content: buildSchema("Project World Model Entity", [
        "id",
        "mission",
        "stakeholders",
        "products",
        "services",
        "environments",
        "repos",
        "dependencies",
        "risks",
        "decisions",
        "cadence",
        "metrics",
        "constraints",
      ]),
    },
    {
      relativePath: "docs/ai-harness/dashboard/schemas/projections/dashboard-state.schema.json",
      content: buildDashboardStateSchema(),
    },
    {
      relativePath: "docs/ai-harness/dashboard/state/dashboard-state.schema.json",
      content: buildDashboardStateSchema(),
    },
  ];
}
