import {
  type GeneratedFile,
  type ProjectType,
  type WorkspaceInitParams,
} from "../types.js";
import { DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS } from "../data/dashboard-state-contract.js";
import {
  getDashboardKpiProfile,
  getRequiredDashboardKpis,
  inferDashboardDomainMode,
  type DashboardDomainMode,
} from "../data/dashboard-profiles.js";

function buildPrimaryDomains(params: WorkspaceInitParams): string[] {
  if (params.primaryDomains?.length) {
    return params.primaryDomains;
  }

  return [params.projectType ?? "general-delivery"];
}

function buildDashboardState(params: WorkspaceInitParams) {
  const domainMode = inferDashboardDomainMode(params.projectType);
  const primaryDomains = buildPrimaryDomains(params);
  const targetIDEs = params.targetIDEs ?? ["vscode"];
  const projectType = params.projectType ?? "other";
  const techStack = params.techStack ?? [];
  const requiredKpis = getRequiredDashboardKpis({
    domainMode,
    projectType: params.projectType,
  });
  const kpiProfile = getDashboardKpiProfile({
    domainMode,
    projectType: params.projectType,
  });

  const stageChecklist = [
    { id: "governance-open", label: "Governance Open", status: "in-progress" },
    { id: "plan-1", label: "Plan 1", status: "todo" },
    { id: "review-1", label: "Review 1", status: "todo" },
    { id: "plan-2", label: "Plan 2", status: "todo" },
    { id: "review-2", label: "Review 2", status: "todo" },
    { id: "plan-3", label: "Plan 3", status: "todo" },
    { id: "review-3", label: "Review 3", status: "todo" },
    { id: "goal-freeze", label: "Goal Freeze", status: "todo" },
    { id: "governance-refresh", label: "Governance Refresh", status: "todo" },
    { id: "implementation", label: "Implementation", status: "todo" },
    { id: "verification", label: "Verification", status: "todo" },
    { id: "governance-close", label: "Governance Close", status: "todo" },
  ];

  const artifacts = [
    {
      id: "operating-model",
      label: "Operating Model",
      path: ".github/ai-harness/operating-model.md",
      status: "present",
      owner: "harness-doc-writer",
    },
    {
      id: "manifest",
      label: "Harness Manifest",
      path: ".github/ai-harness/harness-manifest.yaml",
      status: "present",
      owner: "harness-governance-manager",
    },
    {
      id: "managed-file-inventory",
      label: "Managed File Inventory",
      path: ".github/ai-harness/managed-file-inventory.json",
      status: "present",
      owner: "legacy-reconcile-operator",
    },
    {
      id: "reconcile-policy",
      label: "Reconcile Policy",
      path: ".github/ai-harness/reconcile-policy.json",
      status: "present",
      owner: "legacy-reconcile-operator",
    },
    {
      id: "native-executor-overrides",
      label: "Native Executor Overrides",
      path: ".github/ai-harness/native-executor-overrides.json",
      status: "present",
      owner: "cli-runtime-bridge-operator",
    },
    {
      id: "context-ledger",
      label: "Context Ledger",
      path: "docs/context/",
      status: "present",
      owner: "harness-doc-writer",
    },
    {
      id: "review-ledger",
      label: "Review Ledger",
      path: "docs/reviews/",
      status: "present",
      owner: "harness-expert-reviewer",
    },
    {
      id: "contract-ledger",
      label: "Chunk Contract Ledger",
      path: "docs/contracts/",
      status: "present",
      owner: "planner",
    },
    {
      id: "plan-ledger",
      label: "Plan Ledger",
      path: "docs/plans/",
      status: "present",
      owner: "harness-governance-manager",
    },
    {
      id: "handover-ledger",
      label: "Handover Ledger",
      path: "docs/handovers/",
      status: "present",
      owner: "harness-doc-writer",
    },
    {
      id: "work-log-ledger",
      label: "Work Log Ledger",
      path: "docs/work-logs/",
      status: "present",
      owner: "harness-doc-writer",
    },
    {
      id: "admin-dashboard",
      label: "Admin Dashboard",
      path: "docs/ai-harness/dashboard/index.html",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "dashboard-state",
      label: "Dashboard State JSON",
      path: "docs/ai-harness/dashboard/state/dashboard-state.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "live-artifacts-dashboard",
      label: "Live Artifacts Dashboard",
      path: "live-artifacts-dashboard/server.js",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "governance-index",
      label: "Governance Index",
      path: ".governance/_INDEX.md",
      status: "present",
      owner: "harness-governance-manager",
    },
    {
      id: "governance-project-state",
      label: "Governance Project State",
      path: ".governance/_PROJECT_STATE.md",
      status: "present",
      owner: "harness-governance-manager",
    },
    {
      id: "adoption-playbook",
      label: "DX/AX Adoption Playbook",
      path: "docs/ai-harness/adoption-paths.md",
      status: "present",
      owner: "harness-doc-writer",
    },
    {
      id: "readiness-guide",
      label: "Readiness Guide",
      path: "docs/ai-harness/readiness/README.md",
      status: "present",
      owner: "harness-doc-writer",
    },
    {
      id: "remaining-work-spec",
      label: "Remaining Work Specification",
      path: "docs/ai-harness/readiness/remaining-work-spec.md",
      status: "present",
      owner: "harness-governance-manager",
    },
    {
      id: "readiness-scoring-model",
      label: "Readiness Scoring Model",
      path: "docs/ai-harness/readiness/scoring-model.md",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "readiness-scorecard-template",
      label: "Readiness Scorecard Template",
      path: "docs/ai-harness/readiness/maturity-scorecard.template.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "context-strategy",
      label: "Context Strategy",
      path: ".github/ai-harness/context-strategy.md",
      status: "present",
      owner: "context-architect",
    },
    {
      id: "evaluation-rubrics",
      label: "Evaluation Rubrics",
      path: ".github/ai-harness/evaluation-rubrics.md",
      status: "present",
      owner: "harness-expert-reviewer",
    },
    {
      id: "evaluation-ledger",
      label: "Independent Evaluation Ledger",
      path: "docs/evaluations/",
      status: "present",
      owner: "harness-quality-gate",
    },
    {
      id: "runtime-readme",
      label: "Runtime Orchestrator Guide",
      path: "docs/ai-harness/runtime/README.md",
      status: "present",
      owner: "harness-implementation-orchestrator",
    },
    {
      id: "runtime-version-index",
      label: "Runtime Version Capability Index",
      path: "docs/ai-harness/runtime/version-index.json",
      status: "present",
      owner: "harness-implementation-orchestrator",
    },
    {
      id: "runtime-compatibility-matrix",
      label: "Runtime Compatibility Matrix",
      path: "docs/ai-harness/runtime/compatibility-matrix.json",
      status: "present",
      owner: "legacy-reconcile-operator",
    },
    {
      id: "runtime-adapter-contract",
      label: "Runtime Adapter Contract",
      path: "docs/ai-harness/runtime/adapter-contract.json",
      status: "present",
      owner: "cli-runtime-bridge-operator",
    },
    {
      id: "runtime-session-continuity",
      label: "Runtime Session Continuity Contract",
      path: "docs/ai-harness/runtime/session-continuity.md",
      status: "present",
      owner: "harness-doc-writer",
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
      id: "runtime-current-work-packet",
      label: "Current Runtime Work Packet",
      path: "docs/ai-harness/runtime/state/current-work-packet.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "runtime-adapters-guide",
      label: "Runtime Adapters Guide",
      path: "docs/ai-harness/runtime/adapters/README.md",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "runtime-current-execution-bridge",
      label: "Current Execution Bridge State",
      path: "docs/ai-harness/runtime/state/current-execution-bridge.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "runtime-native-executors-guide",
      label: "Native Executors Guide",
      path: "docs/ai-harness/runtime/native-executors/README.md",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "runtime-current-native-execution",
      label: "Current Native Execution State",
      path: "docs/ai-harness/runtime/state/current-native-execution.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "runtime-bridges-guide",
      label: "Runtime Bridges Guide",
      path: "docs/ai-harness/runtime/bridges/README.md",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "runtime-archive-guide",
      label: "Runtime Archive Guide",
      path: "docs/ai-harness/runtime/archive/README.md",
      status: "present",
      owner: "harness-dashboard-operator",
    },
    {
      id: "runtime-archive-index",
      label: "Runtime Archive Index",
      path: "docs/ai-harness/runtime/archive/archive-index.json",
      status: "present",
      owner: "harness-dashboard-operator",
    },
  ];

  const commonState = {
    meta: {
      schemaVersion: "1.0.0",
      generatedBy: "workspace-init-mcp",
      dashboardDesignSystem: "Readable Operations Dashboard",
      refreshRule:
        "Refresh this JSON at governance open, after each meaningful chunk, after verification, and at governance close.",
    },
    workspace: {
      name: params.workspaceName,
      purpose: params.purpose,
      projectType,
      primaryDomains,
      techStack,
      targetIDEs,
      harnessProfile: params.harnessProfile ?? "balanced",
      governanceProfile: params.governanceProfile ?? "strict",
      autonomyMode: params.autonomyMode ?? "balanced",
      tokenBudget: params.tokenBudget ?? "balanced",
    },
    executiveSummary: {
      headline: `${params.workspaceName} mission control`,
      overallStatus: "active",
      currentStage: "governance-open",
      overallProgressPercent: 8,
      nextDecision: "Complete Plan 1 and formalize the first verifiable chunk.",
      lastUpdated: "TBD - refresh on first real session",
      audienceNote:
        "This dashboard is written for operators, product owners, reviewers, and non-developer stakeholders.",
    },
    progressState: {
      activeGoal: params.purpose,
      activeChunk: "chunk-00-bootstrap-governance",
      currentOwner: "harness-dashboard-operator",
      blocked: false,
      riskLevel: "medium",
      nextAction: "Replace template state with the first approved task and its evidence-backed metrics.",
      stageChecklist,
      workstreams: [
        {
          id: "governance",
          label: "Governance and Direction",
          owner: "harness-doc-writer",
          status: "in-progress",
          progressPercent: 30,
          note: "Planning and review ladder has been scaffolded but needs task-specific content.",
        },
        {
          id: "delivery",
          label: "Primary Delivery Stream",
          owner: "harness-implementer",
          status: "not-started",
          progressPercent: 0,
          note: "Do not start implementation before the third review and goal freeze are complete.",
        },
        {
          id: "observability",
          label: "Dashboard and Traceability",
          owner: "harness-dashboard-operator",
          status: "in-progress",
          progressPercent: 20,
          note: "Dashboard assets exist; live project-specific KPIs and issue records still need to be populated.",
        },
      ],
    },
    governanceState: {
      policyId: "three-plan-three-review",
      policyLabel: "Three-Plan / Three-Review Governance",
      status: "active",
      sessionGovernanceRule:
        "Every meaningful AI session must open governance, preserve evidence, and close governance before completion.",
      latestApprovedStage: "governance-open",
      goalFrozen: false,
      dashboardSyncStatus: "bootstrap",
      requiredArtifacts: [
        ".github/ai-harness/harness-manifest.yaml",
        ".github/ai-harness/operating-model.md",
        "docs/context/",
        "docs/reviews/",
        "docs/plans/",
        "docs/handovers/",
        "docs/ai-harness/dashboard/state/dashboard-state.json",
        "live-artifacts-dashboard/package.json",
        "live-artifacts-dashboard/server.js",
        "live-artifacts-dashboard/public/index.html",
        "live-artifacts-dashboard/public/app.js",
        "live-artifacts-dashboard/public/vendor/chart.umd.js",
        ".governance/_INDEX.md",
        ".governance/_PROJECT_STATE.md",
        "docs/ai-harness/runtime/version-index.json",
        "docs/ai-harness/runtime/compatibility-matrix.json",
        "docs/ai-harness/runtime/adapter-contract.json",
        "docs/ai-harness/runtime/session-continuity.md",
      ],
      requiredKpiIds: kpiProfile.requiredKpiIds,
      mandatorySessionFields: [
        "goal",
        "chunkId",
        "governance.opened",
        "governance.latestPlanRound",
        "governance.latestReviewRound",
        "verification.reviewStatus",
        "nextStep",
      ],
      visibilityRule:
        "Every governed session should be visible to operators, product owners, reviewers, and non-developer stakeholders.",
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
        id: "seed-data-replacement",
        severity: "info",
        status: "open",
        summary: "Replace template dashboard entries with project-specific truth before real delivery begins.",
        owner: "harness-dashboard-operator",
        firstSeenAt: "bootstrap",
        lastSeenAt: "bootstrap",
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
        "Track dashboard JSON files in version control.",
        "Track governance documents and handover files in version control.",
        "Refresh git snapshot after each meaningful session close.",
      ],
    },
    sessionLog: [
      {
        id: "session-0001",
        title: "Workspace bootstrap",
        status: "complete",
        stage: "governance-open",
        startedAt: "bootstrap",
        endedAt: "bootstrap",
        owner: "workspace-init-mcp",
        outputs: [
          ".github/ai-harness/harness-manifest.yaml",
          ".github/ai-harness/operating-model.md",
          "docs/ai-harness/dashboard/index.html",
        ],
        note: "Initial harness, catalog, and dashboard scaffolding generated.",
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
        goal: "Bootstrap the harness, dashboard, and governance surfaces.",
        chunkId: "chunk-00-bootstrap-governance",
        startedAt: "bootstrap",
        endedAt: "bootstrap",
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
        outputs: [
          ".github/ai-harness/harness-manifest.yaml",
          ".github/ai-harness/operating-model.md",
          "docs/ai-harness/dashboard/index.html",
        ],
        nextStep:
          "Replace bootstrap placeholders with the first approved task, evidence set, and KPI values.",
      },
    ],
    runtimeOrchestration: {
      mode: "planner-generator-evaluator",
      activeSessionId: null,
      activeChunkId: "chunk-unset",
      currentPhase: "awaiting-session-start",
      nextActor: "planner",
      nextAction:
        "Start the first governed runtime session before implementation begins.",
      contextPolicy:
        "Prefer context resets when drift or context anxiety appears; compact only after durable handoff artifacts exist.",
      contractCoverageRule:
        "No generator implementation begins before the evaluator-approved chunk contract exists.",
      evaluatorRule:
        "The generator may not self-approve; an independent evaluator records the pass or change-request verdict.",
      lastEventAt: "bootstrap",
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
          at: "bootstrap",
          phase: "governance-open",
          actor: "planner",
          action: "bootstrap",
          outcome: "ready-for-session-start",
          note: "Runtime scaffolding created. Open the first governed session before implementation begins.",
        },
      ],
    },
    operationsHealth: {
      status: "not-configured",
      lastUpdated: "bootstrap",
      summary:
        "Connect application metrics, access logs, DBCP pool metrics, incident logs, and latency query outputs when adopting the harness into a running service.",
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
      incidentLogs: [
        {
          id: "ops-observability-bootstrap",
          severity: "info",
          status: "open",
          summary:
            "Wire server logs and incident sources before relying on this dashboard for production operations.",
          source: "bootstrap",
          firstSeenAt: "bootstrap",
          lastSeenAt: "bootstrap",
        },
      ],
      latencyQueries: [
        {
          id: "latency-p95",
          label: "P95 endpoint latency",
          query: "TBD",
          status: "not-configured",
          p95Ms: 0,
          lastRunAt: "bootstrap",
        },
      ],
      dataSources: [
        {
          id: "application-logs",
          label: "Application request and response logs",
          status: "not-connected",
          path: "TBD",
          expectedSignal: "traffic, request, response, error rate, and incident evidence",
        },
        {
          id: "dbcp-metrics",
          label: "DBCP pool metrics",
          status: "not-connected",
          path: "TBD",
          expectedSignal: "active, idle, max, waiters, validation query, and last check time",
        },
      ],
    },
    memoryPromotion: {
      status: "monitoring",
      thresholdScore: 7,
      evidenceThreshold: {
        minimumOccurrences: 3,
        minimumGovernedSessions: 2,
      },
      sourceRoots: [
        "memories/session/",
        "docs/work-logs/",
        "docs/context/",
        "docs/plans/",
        "docs/reviews/",
        "docs/handovers/",
        "docs/ai-harness/runtime/sessions/",
        ".governance/",
      ],
      candidates: [
        {
          id: "memory-to-skill-promotion",
          title: "Promote repeated governed work into reusable skills or agents",
          status: "proposed",
          score: 0,
          scoreBreakdown: {
            frequency: 0,
            stability: 0,
            reuseValue: 0,
            validationClarity: 0,
            coverageGap: 0,
          },
          occurrences: 0,
          governedSessionCount: 0,
          collisionCheck: "pending",
          decision: "backlog",
          evidencePaths: [
            "memories/session/",
            "docs/work-logs/",
            "docs/ai-harness/runtime/sessions/",
          ],
          generatedPaths: [],
          nextAction:
            "Use harness-memory-pattern-miner before creating new skills or agents from repeated work.",
        },
      ],
    },
    artifacts,
  };

  switch (domainMode) {
    case "creative-narrative":
      return {
        ...commonState,
        domainLens: {
          mode: domainMode,
          title: "Narrative Mission Control",
          primaryQuestion: "Can editors and operators understand story continuity, character state, and draft progress at a glance?",
        },
        timeline: [
          {
            id: "act-1",
            label: "Act 1 / Setup",
            type: "story-beat",
            status: "in-progress",
            owner: "story-architect",
            note: "Define premise, tone, and the protagonist's inciting incident.",
          },
          {
            id: "act-2",
            label: "Act 2 / Escalation",
            type: "story-beat",
            status: "not-started",
            owner: "story-architect",
            note: "Track reversals, conflicts, and stakes.",
          },
          {
            id: "act-3",
            label: "Act 3 / Resolution",
            type: "story-beat",
            status: "not-started",
            owner: "story-architect",
            note: "Align resolution with the thematic promise.",
          },
        ],
        entities: [
          {
            id: "character-protagonist",
            label: "Primary protagonist",
            type: "character",
            status: "draft",
            summary: "Track motivation, flaw, transformation arc, and relationship map.",
          },
          {
            id: "character-antagonist",
            label: "Primary antagonist or opposing force",
            type: "character",
            status: "draft",
            summary: "Track pressure exerted on the protagonist and the conflict escalator.",
          },
          {
            id: "story-world",
            label: "Story world and rules",
            type: "setting",
            status: "draft",
            summary: "Track locations, timeline consistency, and world constraints.",
          },
        ],
        versionLedger: [
          {
            id: "draft-0",
            label: "Draft 0 / Outline",
            status: "active",
            scope: "Premise, act structure, and character board",
            progressPercent: 20,
          },
          {
            id: "draft-1",
            label: "Draft 1 / Full manuscript",
            status: "planned",
            scope: "First complete pass",
            progressPercent: 0,
          },
        ],
      };
    case "knowledge-work":
      return {
        ...commonState,
        domainLens: {
          mode: domainMode,
          title: "Learning and Research Control Board",
          primaryQuestion: "Can a mentor or operator see goals, modules, evidence, and next learning steps immediately?",
        },
        timeline: [
          {
            id: "module-1",
            label: "Learning module 1",
            type: "module",
            status: "in-progress",
            owner: "research-lead",
            note: "Track problem statement, references, and takeaways.",
          },
          {
            id: "module-2",
            label: "Learning module 2",
            type: "module",
            status: "not-started",
            owner: "research-lead",
            note: "Track experiments, evaluations, and follow-up questions.",
          },
        ],
        entities: [
          {
            id: "topic-core",
            label: "Core learning topic",
            type: "topic",
            status: "draft",
            summary: "Track major concepts, misunderstandings, and evidence.",
          },
          {
            id: "reference-set",
            label: "Reference collection",
            type: "reference-set",
            status: "active",
            summary: "Keep source quality, dates, and takeaways organized.",
          },
        ],
        versionLedger: [
          {
            id: "iteration-0",
            label: "Iteration 0 / Baseline understanding",
            status: "active",
            scope: "Initial notes and goal framing",
            progressPercent: 15,
          },
        ],
      };
    case "generic-governance":
      return {
        ...commonState,
        domainLens: {
          mode: domainMode,
          title: "General Operations Control Board",
          primaryQuestion: "Can stakeholders see the mission, progress, issues, and history without domain-specific tooling?",
        },
        timeline: [
          {
            id: "milestone-1",
            label: "Milestone 1",
            type: "milestone",
            status: "in-progress",
            owner: "delivery-lead",
            note: "Define the first verifiable outcome and its evidence path.",
          },
        ],
        entities: [
          {
            id: "primary-initiative",
            label: "Primary initiative",
            type: "initiative",
            status: "draft",
            summary: "Track the main initiative, owner, and success definition.",
          },
        ],
        versionLedger: [
          {
            id: "baseline",
            label: "Baseline",
            status: "active",
            scope: "Bootstrap dashboard and governance surfaces",
            progressPercent: 10,
          },
        ],
      };
    default:
      return {
        ...commonState,
        domainLens: {
          mode: domainMode,
          title: "Software Delivery Control Board",
          primaryQuestion: "Can product, engineering, and operations leads see release progress, features, risks, and session history at a glance?",
        },
        timeline: [
          {
            id: "release-bootstrap",
            label: "Release Bootstrap",
            type: "release-milestone",
            status: "in-progress",
            owner: "delivery-lead",
            note: "Bootstrap governance, dashboard, and first approved work chunk.",
          },
          {
            id: "feature-wave-1",
            label: "Feature Wave 1",
            type: "feature-wave",
            status: "not-started",
            owner: "product-engineering",
            note: "Track the first batch of approved user-facing or platform features.",
          },
        ],
        entities: [
          {
            id: "feature-core-flow",
            label: "Core feature flow",
            type: "feature",
            status: "planned",
            summary: "Track feature scope, acceptance criteria, and verification path.",
          },
          {
            id: "service-or-module",
            label: "Service or module boundary",
            type: "component",
            status: "planned",
            summary: "Track technical ownership, interfaces, and release impact.",
          },
          {
            id: "stakeholder-surface",
            label: "Stakeholder-facing release note group",
            type: "release-surface",
            status: "draft",
            summary: "Track which changes need product or operations visibility.",
          },
        ],
        versionLedger: [
          {
            id: "v0.1.0",
            label: "v0.1.0 / Harness bootstrap",
            status: "active",
            scope: "Dashboard, governance model, and first delivery chunk",
            progressPercent: 20,
          },
          {
            id: "v0.2.0",
            label: "v0.2.0 / Feature wave 1",
            status: "planned",
            scope: "First meaningful product or platform release",
            progressPercent: 0,
          },
        ],
      };
  }
}

function escapeForInlineJson(text: string): string {
  return text.replace(/</g, "\\u003c");
}

function escapeHtmlLiteral(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDashboardReadme(params: WorkspaceInitParams): string {
  return `# AI Admin Dashboard

This dashboard turns the AI harness into an operator-friendly control board for **${params.workspaceName}**.

## Purpose

- Give non-developers a readable view of progress state, KPIs, issues, and current stage
- Track whether governance, reviews, tests, and git history are being maintained
- Make every meaningful AI session visible as a governed execution record
- Show whether chunk contracts and independent evaluations are current
- Enforce domain-required KPI coverage from AX/DX and DevOps perspectives
- Show server operations health: traffic, request/response, DBCP, incident logs, and latency queries
- Preserve domain-specific visibility without relying on a database
- Support both DX (Digital Transformation) and AX (AI Transformation) operating models

## Files

- \`index.html\`: the dashboard screen
- \`app.css\`: readable operations design system tokens and component styling
- \`app.js\`: dashboard renderer
- \`state/dashboard-state.json\`: source of truth for dashboard content
- \`state/dashboard-state.schema.json\`: JSON schema for editors and validation
- \`templates/*.state.json\`: domain-oriented starter states for software, narrative, learning, and generic transformation work
- \`scripts/dashboard-ops.mjs\`: refresh, validate, serve, and export operations
- \`../runtime/\`: planner / generator / evaluator runtime state, prompts, and session ledgers
- \`../../../live-artifacts-dashboard/\`: local real-time artifact observer on port \`43111\`
- \`design-system.md\`: design principles for simple, high-readability admin screens
- linked governance artifacts in \`docs/contracts/\`, \`docs/evaluations/\`, and \`.github/ai-harness/\`

## Update Rules

1. Refresh \`state/dashboard-state.json\` at governance open.
2. Update progress, KPI, issue, and session sections after each meaningful chunk.
3. Refresh git snapshot and artifact status before governance close.
4. Keep entries short enough for operators and non-developers to scan quickly.
5. Keep governed session records aligned with plan, contract, review, verification, and git evidence.
6. Record independent evaluation status separately from generator progress notes.
7. Treat the dashboard as a complement to \`docs/context/\`, \`docs/reviews/\`, \`docs/contracts/\`, \`docs/handovers/\`, and \`docs/ai-harness/runtime/\`, not a replacement.
8. Treat \`operationsHealth\` as a curated operations snapshot. Do not duplicate the live artifacts dashboard's file preview or SSE state here.

## Dashboard Boundary

- This admin dashboard owns canonical governed state, runtime orchestration, KPI state, server operations health, and exportable snapshots.
- \`live-artifacts-dashboard/\` owns local real-time artifact discovery, open marker tracking, archived unchecked visibility, and preview-by-id.
- The two dashboards intentionally use separate default ports: admin \`43110\`, live artifacts \`43111\`.

## Domain Coverage

- Software delivery: features, releases, session history, git status, and verification
- Creative work: timeline, characters, story continuity, draft progression
- Learning and research: modules, references, evidence, and iteration history
- Generic transformation work: initiatives, milestones, owners, and risk tracking

## Recommended Usage

1. Start from \`state/dashboard-state.json\` for the live workspace state.
2. Use the files in \`templates/\` as reference when the workspace expands into a new domain lens.
3. Start governed execution with \`start_harness_session\`, then keep runtime and dashboard state aligned with each phase change.
4. Keep dashboard JSON tracked in git so operators can audit how the mission changed over time.
`;
}

function buildDashboardDesignSystem(): string {
  return `# Readable Operations Dashboard

This dashboard uses a simple, readability-first design framework for AI operations.

## Principles

1. Readability beats density.
2. Status must be scannable in under 30 seconds.
3. Non-developers should understand the current stage, blockers, and next action without opening source code.
4. Use plain language before specialist language.
5. Visual hierarchy should separate executive summary, live state, evidence, and domain detail.

## Visual Rules

- Use one neutral background, one surface color family, and restrained accents for state badges.
- Prefer cards, tables, and progress bars over decorative charts.
- Keep line length moderate and spacing generous.
- Use semantic colors only for status: green, amber, red, blue, and neutral.
- Make labels explicit. Avoid abbreviations unless the workspace already standardizes them.

## Content Rules

- KPI labels must be understandable by operators, product leads, and reviewers.
- Issue summaries should describe impact, not just error codes.
- Session entries must explain what changed and what remains.
- Domain sections should mirror the real delivery mode:
  - software: versions, features, releases
  - narrative: timeline, characters, draft state
  - learning: modules, references, evidence

## Data Rules

- Store all dashboard state in JSON files.
- Avoid database dependencies for portability and git-based traceability.
- Keep schema changes explicit and versioned.
- Prefer append-or-refresh workflows over opaque hidden state.
`;
}

function buildDashboardSchema(): string {
  return `${JSON.stringify(
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "AI Harness Dashboard State",
      type: "object",
      required: [...DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS],
      properties: {
        meta: {
          type: "object",
          required: [
            "schemaVersion",
            "generatedBy",
            "dashboardDesignSystem",
            "refreshRule",
          ],
          properties: {
            schemaVersion: { type: "string" },
            generatedBy: { type: "string" },
            dashboardDesignSystem: { type: "string" },
            refreshRule: { type: "string" },
            lastAutoRefreshAt: { type: "string" },
          },
          additionalProperties: true,
        },
        workspace: {
          type: "object",
          required: [
            "name",
            "purpose",
            "projectType",
            "primaryDomains",
            "techStack",
            "targetIDEs",
            "harnessProfile",
            "governanceProfile",
            "autonomyMode",
            "tokenBudget",
          ],
          properties: {
            name: { type: "string" },
            purpose: { type: "string" },
            projectType: { type: "string" },
            primaryDomains: {
              type: "array",
              items: { type: "string" },
            },
            techStack: {
              type: "array",
              items: { type: "string" },
            },
            targetIDEs: {
              type: "array",
              items: { type: "string" },
            },
            harnessProfile: { type: "string" },
            governanceProfile: { type: "string" },
            autonomyMode: { type: "string" },
            tokenBudget: { type: "string" },
          },
          additionalProperties: true,
        },
        executiveSummary: {
          type: "object",
          required: [
            "headline",
            "overallStatus",
            "currentStage",
            "overallProgressPercent",
            "nextDecision",
            "lastUpdated",
            "audienceNote",
          ],
          properties: {
            headline: { type: "string" },
            overallStatus: { type: "string" },
            currentStage: { type: "string" },
            overallProgressPercent: { type: "number" },
            nextDecision: { type: "string" },
            lastUpdated: { type: "string" },
            audienceNote: { type: "string" },
          },
          additionalProperties: true,
        },
        progressState: {
          type: "object",
          required: [
            "activeGoal",
            "activeChunk",
            "currentOwner",
            "blocked",
            "riskLevel",
            "nextAction",
            "stageChecklist",
            "workstreams",
          ],
          properties: {
            activeGoal: { type: "string" },
            activeChunk: { type: "string" },
            currentOwner: { type: "string" },
            blocked: { type: "boolean" },
            riskLevel: { type: "string" },
            nextAction: { type: "string" },
            stageChecklist: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "label", "status"],
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  status: { type: "string" },
                },
                additionalProperties: true,
              },
            },
            workstreams: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "label", "owner", "status", "progressPercent", "note"],
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  owner: { type: "string" },
                  status: { type: "string" },
                  progressPercent: { type: "number" },
                  note: { type: "string" },
                },
                additionalProperties: true,
              },
            },
          },
          additionalProperties: true,
        },
        governanceState: {
          type: "object",
          required: [
            "policyId",
            "policyLabel",
            "status",
            "sessionGovernanceRule",
            "latestApprovedStage",
            "goalFrozen",
            "dashboardSyncStatus",
            "requiredArtifacts",
            "requiredKpiIds",
            "mandatorySessionFields",
            "visibilityRule",
          ],
          properties: {
            policyId: { type: "string" },
            policyLabel: { type: "string" },
            status: { type: "string" },
            sessionGovernanceRule: { type: "string" },
            latestApprovedStage: { type: "string" },
            goalFrozen: { type: "boolean" },
            dashboardSyncStatus: { type: "string" },
            requiredArtifacts: {
              type: "array",
              items: { type: "string" },
            },
            requiredKpiIds: {
              type: "array",
              items: { type: "string" },
            },
            mandatorySessionFields: {
              type: "array",
              items: { type: "string" },
            },
            visibilityRule: { type: "string" },
          },
          additionalProperties: true,
        },
        memoryPromotion: {
          type: "object",
          required: [
            "status",
            "thresholdScore",
            "evidenceThreshold",
            "sourceRoots",
            "candidates",
          ],
          properties: {
            status: { type: "string" },
            thresholdScore: { type: "number" },
            evidenceThreshold: {
              type: "object",
              required: ["minimumOccurrences", "minimumGovernedSessions"],
              properties: {
                minimumOccurrences: { type: "number" },
                minimumGovernedSessions: { type: "number" },
              },
              additionalProperties: true,
            },
            sourceRoots: { type: "array", items: { type: "string" } },
            candidates: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "id",
                  "title",
                  "status",
                  "score",
                  "occurrences",
                  "governedSessionCount",
                  "collisionCheck",
                  "decision",
                  "evidencePaths",
                  "generatedPaths",
                  "nextAction",
                ],
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  status: { type: "string" },
                  score: { type: "number" },
                  scoreBreakdown: { type: "object", additionalProperties: true },
                  occurrences: { type: "number" },
                  governedSessionCount: { type: "number" },
                  collisionCheck: { type: "string" },
                  decision: { type: "string" },
                  evidencePaths: { type: "array", items: { type: "string" } },
                  generatedPaths: { type: "array", items: { type: "string" } },
                  nextAction: { type: "string" },
                },
                additionalProperties: true,
              },
            },
          },
          additionalProperties: true,
        },
        kpiProfile: {
          type: "object",
          required: ["id", "label", "requiredKpiIds", "perspectives", "rationale"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            requiredKpiIds: {
              type: "array",
              items: { type: "string" },
            },
            perspectives: {
              type: "array",
              items: { type: "string" },
            },
            rationale: {
              type: "array",
              items: { type: "string" },
            },
          },
          additionalProperties: true,
        },
        kpis: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "label", "value", "target", "status", "interpretation", "perspectives", "required"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              value: { type: "string" },
              target: { type: "string" },
              status: { type: "string" },
              interpretation: { type: "string" },
              perspectives: {
                type: "array",
                items: { type: "string" },
              },
              required: { type: "boolean" },
            },
            additionalProperties: true,
          },
        },
        errors: {
          type: "array",
          items: {
            type: "object",
            required: [
              "id",
              "severity",
              "status",
              "summary",
              "owner",
              "firstSeenAt",
              "lastSeenAt",
            ],
            properties: {
              id: { type: "string" },
              severity: { type: "string" },
              status: { type: "string" },
              summary: { type: "string" },
              owner: { type: "string" },
              firstSeenAt: { type: "string" },
              lastSeenAt: { type: "string" },
            },
            additionalProperties: true,
          },
        },
        gitStatus: {
          type: "object",
          required: [
            "repositoryExpected",
            "trackedByGit",
            "provider",
            "defaultBranch",
            "currentBranch",
            "lastCommit",
            "workingTree",
            "auditExpectations",
          ],
          properties: {
            repositoryExpected: { type: "boolean" },
            trackedByGit: { type: "string" },
            provider: { type: "string" },
            defaultBranch: { type: "string" },
            currentBranch: { type: "string" },
            lastCommit: {
              type: "object",
              required: ["sha", "message", "author", "committedAt"],
              properties: {
                sha: { type: "string" },
                message: { type: "string" },
                author: { type: "string" },
                committedAt: { type: "string" },
              },
              additionalProperties: true,
            },
            workingTree: {
              type: "object",
              required: ["status", "stagedChanges", "unstagedChanges", "untrackedFiles"],
              properties: {
                status: { type: "string" },
                stagedChanges: { type: "string" },
                unstagedChanges: { type: "string" },
                untrackedFiles: { type: "string" },
              },
              additionalProperties: true,
            },
            auditExpectations: {
              type: "array",
              items: { type: "string" },
            },
          },
          additionalProperties: true,
        },
        sessionLog: {
          type: "array",
          items: {
            type: "object",
            required: [
              "id",
              "title",
              "status",
              "stage",
              "startedAt",
              "endedAt",
              "owner",
              "outputs",
              "note",
            ],
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              status: { type: "string" },
              stage: { type: "string" },
              startedAt: { type: "string" },
              endedAt: { type: "string" },
              owner: { type: "string" },
              outputs: {
                type: "array",
                items: { type: "string" },
              },
              note: { type: "string" },
            },
            additionalProperties: true,
          },
        },
        governedSessions: {
          type: "array",
          items: {
            type: "object",
            required: [
              "id",
              "title",
              "status",
              "owner",
              "agentRole",
              "governanceStatus",
              "goal",
              "chunkId",
              "startedAt",
              "endedAt",
              "governance",
              "verification",
              "git",
              "outputs",
              "nextStep",
            ],
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              status: { type: "string" },
              owner: { type: "string" },
              agentRole: { type: "string" },
              governanceStatus: { type: "string" },
              goal: { type: "string" },
              chunkId: { type: "string" },
              startedAt: { type: "string" },
              endedAt: { type: "string" },
              governance: {
                type: "object",
                required: [
                  "opened",
                  "latestPlanRound",
                  "latestReviewRound",
                  "goalFrozen",
                  "contractApproved",
                  "independentEvaluationPassed",
                  "governanceRefreshed",
                  "closeoutReady",
                  "evidenceFreshness",
                ],
                properties: {
                  opened: { type: "boolean" },
                  latestPlanRound: { type: "number" },
                  latestReviewRound: { type: "number" },
                  goalFrozen: { type: "boolean" },
                  contractApproved: { type: "boolean" },
                  independentEvaluationPassed: { type: "boolean" },
                  governanceRefreshed: { type: "boolean" },
                  closeoutReady: { type: "boolean" },
                  evidenceFreshness: { type: "string" },
                },
                additionalProperties: true,
              },
              verification: {
                type: "object",
                required: ["testsStatus", "reviewStatus", "remediationStatus"],
                properties: {
                  testsStatus: { type: "string" },
                  reviewStatus: { type: "string" },
                  remediationStatus: { type: "string" },
                },
                additionalProperties: true,
              },
              git: {
                type: "object",
                required: ["branch", "commit"],
                properties: {
                  branch: { type: "string" },
                  commit: { type: "string" },
                },
                additionalProperties: true,
              },
              outputs: {
                type: "array",
                items: { type: "string" },
              },
              nextStep: { type: "string" },
            },
            additionalProperties: true,
          },
        },
        artifacts: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "label", "path", "status", "owner"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              path: { type: "string" },
              status: { type: "string" },
              owner: { type: "string" },
            },
            additionalProperties: true,
          },
        },
        domainLens: {
          type: "object",
          required: ["mode", "title", "primaryQuestion"],
          properties: {
            mode: { type: "string" },
            title: { type: "string" },
            primaryQuestion: { type: "string" },
          },
          additionalProperties: true,
        },
        timeline: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "label", "type", "status", "owner", "note"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              type: { type: "string" },
              status: { type: "string" },
              owner: { type: "string" },
              note: { type: "string" },
            },
            additionalProperties: true,
          },
        },
        entities: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "label", "type", "status", "summary"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              type: { type: "string" },
              status: { type: "string" },
              summary: { type: "string" },
            },
            additionalProperties: true,
          },
        },
        versionLedger: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "label", "status", "scope", "progressPercent"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              status: { type: "string" },
              scope: { type: "string" },
              progressPercent: { type: "number" },
            },
            additionalProperties: true,
          },
        },
        runtimeOrchestration: {
          type: "object",
          required: [
            "mode",
            "activeSessionId",
            "activeChunkId",
            "currentPhase",
            "nextActor",
            "nextAction",
            "contextPolicy",
            "contractCoverageRule",
            "evaluatorRule",
            "lastEventAt",
            "stateFile",
            "sessionIndexFile",
            "sessionSummaryFile",
            "workPacketFile",
            "leaseStatus",
            "leasedAt",
            "queueDepth",
            "queuedSessionIds",
            "recentEvents",
          ],
          properties: {
            mode: { type: "string" },
            activeSessionId: { type: ["string", "null"] },
            activeChunkId: { type: "string" },
            currentPhase: { type: "string" },
            nextActor: { type: "string" },
            nextAction: { type: "string" },
            contextPolicy: { type: "string" },
            contractCoverageRule: { type: "string" },
            evaluatorRule: { type: "string" },
            lastEventAt: { type: "string" },
            stateFile: { type: "string" },
            sessionIndexFile: { type: "string" },
            sessionSummaryFile: { type: "string" },
            workPacketFile: { type: "string" },
            nativeExecutionStateFile: { type: ["string", "null"] },
            nativeExecutionPlanFile: { type: ["string", "null"] },
            nativeExecutorBridgeId: { type: ["string", "null"] },
            leaseStatus: { type: "string" },
            leasedAt: { type: ["string", "null"] },
            queueDepth: { type: "number" },
            queuedSessionIds: {
              type: "array",
              items: { type: "string" },
            },
            recentEvents: {
              type: "array",
              items: {
                type: "object",
                required: ["at", "phase", "actor", "action", "outcome", "note"],
                properties: {
                  at: { type: "string" },
                  phase: { type: "string" },
                  actor: { type: "string" },
                  action: { type: "string" },
                  outcome: { type: "string" },
                  note: { type: "string" },
                },
                additionalProperties: true,
              },
            },
          },
          additionalProperties: true,
        },
        operationsHealth: {
          type: "object",
          required: [
            "status",
            "lastUpdated",
            "summary",
            "traffic",
            "requestResponse",
            "dbcp",
            "incidentLogs",
            "latencyQueries",
            "dataSources",
          ],
          properties: {
            status: { type: "string" },
            lastUpdated: { type: "string" },
            summary: { type: "string" },
            traffic: {
              type: "object",
              required: ["requestsPerMinute", "activeConnections", "errorRatePercent", "source"],
              properties: {
                requestsPerMinute: { type: "number" },
                activeConnections: { type: "number" },
                errorRatePercent: { type: "number" },
                source: { type: "string" },
              },
              additionalProperties: true,
            },
            requestResponse: {
              type: "object",
              required: [
                "totalRequests",
                "successResponses",
                "errorResponses",
                "p50Ms",
                "p95Ms",
                "p99Ms",
                "slowRequestThresholdMs",
                "recentSamples",
              ],
              properties: {
                totalRequests: { type: "number" },
                successResponses: { type: "number" },
                errorResponses: { type: "number" },
                p50Ms: { type: "number" },
                p95Ms: { type: "number" },
                p99Ms: { type: "number" },
                slowRequestThresholdMs: { type: "number" },
                recentSamples: { type: "array", items: { type: "object" } },
              },
              additionalProperties: true,
            },
            dbcp: {
              type: "object",
              required: [
                "status",
                "poolName",
                "activeConnections",
                "idleConnections",
                "maxConnections",
                "waiters",
                "validationQuery",
                "lastCheckAt",
              ],
              properties: {
                status: { type: "string" },
                poolName: { type: "string" },
                activeConnections: { type: "number" },
                idleConnections: { type: "number" },
                maxConnections: { type: "number" },
                waiters: { type: "number" },
                validationQuery: { type: "string" },
                lastCheckAt: { type: "string" },
              },
              additionalProperties: true,
            },
            incidentLogs: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "severity", "status", "summary", "source", "firstSeenAt", "lastSeenAt"],
                properties: {
                  id: { type: "string" },
                  severity: { type: "string" },
                  status: { type: "string" },
                  summary: { type: "string" },
                  source: { type: "string" },
                  firstSeenAt: { type: "string" },
                  lastSeenAt: { type: "string" },
                },
                additionalProperties: true,
              },
            },
            latencyQueries: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "label", "query", "status", "p95Ms", "lastRunAt"],
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  query: { type: "string" },
                  status: { type: "string" },
                  p95Ms: { type: "number" },
                  lastRunAt: { type: "string" },
                },
                additionalProperties: true,
              },
            },
            dataSources: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "label", "status", "path", "expectedSignal"],
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  status: { type: "string" },
                  path: { type: "string" },
                  expectedSignal: { type: "string" },
                },
                additionalProperties: true,
              },
            },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    null,
    2
  )}\n`;
}

function buildDashboardTemplateFiles(
  params: WorkspaceInitParams
): GeneratedFile[] {
  const templates: Array<{
    fileName: string;
    projectType: ProjectType;
    primaryDomains: string[];
    purpose: string;
  }> = [
    {
      fileName: "software-delivery.state.json",
      projectType: "web-app",
      primaryDomains: ["product", "engineering", "operations"],
      purpose: "Track releases, features, delivery progress, and verification.",
    },
    {
      fileName: "creative-narrative.state.json",
      projectType: "creative",
      primaryDomains: ["story", "characters", "continuity"],
      purpose: "Track timeline, characters, draft progression, and narrative continuity.",
    },
    {
      fileName: "knowledge-work.state.json",
      projectType: "learning",
      primaryDomains: ["research", "learning", "evidence"],
      purpose: "Track modules, evidence, references, and iteration progress.",
    },
    {
      fileName: "generic-governance.state.json",
      projectType: "other",
      primaryDomains: ["governance", "operations", "delivery"],
      purpose: "Track initiatives, milestones, risks, and cross-functional execution.",
    },
  ];

  return templates.map((template) => {
    const state = buildDashboardState({
      ...params,
      projectType: template.projectType,
      primaryDomains: template.primaryDomains,
      purpose: template.purpose,
    });

    return {
      relativePath: `docs/ai-harness/dashboard/templates/${template.fileName}`,
      content: `${JSON.stringify(state, null, 2)}\n`,
    };
  });
}

function buildDashboardHtml(
  params: WorkspaceInitParams,
  embeddedStateJson: string
): string {
  const workspaceName = escapeHtmlLiteral(params.workspaceName);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${workspaceName} - AI Admin Dashboard</title>
    <link rel="stylesheet" href="./app.css" />
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to dashboard content</a>
    <div class="page-shell">
      <header class="page-header">
        <div>
          <p class="eyebrow">AI Harness Dashboard</p>
          <h1>${workspaceName}</h1>
          <p class="lede">Readable mission control for governance, progress state, KPIs, issues, session history, server operations health, domain state, and git visibility.</p>
        </div>
        <div class="header-meta">
          <span class="chip">JSON-first</span>
          <span class="chip">DB-free</span>
          <span class="chip">Git-friendly</span>
        </div>
      </header>

      <nav class="section-nav" aria-label="Dashboard sections">
        <a href="#executive-summary">Overview</a>
        <a href="#governance-state">Governance</a>
        <a href="#runtime-orchestration">Runtime</a>
        <a href="#memory-promotion">Memory</a>
        <a href="#operations-health">Ops</a>
        <a href="#governed-sessions">Evidence</a>
      </nav>

      <div id="state-source-banner" class="state-source-banner" role="status">Loading dashboard state...</div>

      <main id="main" class="dashboard-grid">
        <section class="panel panel-wide" id="executive-summary"></section>
        <section class="panel" id="progress-state"></section>
        <section class="panel" id="governance-state"></section>
        <section class="panel" id="runtime-orchestration"></section>
        <section class="panel" id="memory-promotion"></section>
        <section class="panel panel-wide" id="operations-health"></section>
        <section class="panel" id="git-status"></section>
        <section class="panel panel-wide" id="kpis"></section>
        <section class="panel panel-wide" id="errors"></section>
        <section class="panel panel-wide" id="workstreams"></section>
        <section class="panel panel-wide" id="session-log"></section>
        <section class="panel panel-wide" id="governed-sessions"></section>
        <section class="panel" id="artifacts"></section>
        <section class="panel" id="domain-lens"></section>
        <section class="panel panel-wide" id="timeline"></section>
        <section class="panel panel-wide" id="entities"></section>
        <section class="panel panel-wide" id="version-ledger"></section>
      </main>
    </div>

    <script id="dashboard-bootstrap-data" type="application/json">${escapeForInlineJson(
      embeddedStateJson
    )}</script>
    <script src="./app.js"></script>
  </body>
</html>
`;
}

function buildDashboardCss(): string {
  return `:root {
  --bg: #f3f5f7;
  --panel: #ffffff;
  --line: #d9e0e7;
  --text: #18212b;
  --muted: #51606f;
  --accent: #005a8d;
  --ok: #1f7a4d;
  --warn: #a86700;
  --risk: #b42318;
  --info: #0a66c2;
  --shadow: 0 14px 40px rgba(24, 33, 43, 0.08);
  --radius: 18px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: linear-gradient(180deg, #eef3f7 0%, var(--bg) 100%);
  color: var(--text);
  font-family: "Aptos", "Segoe UI", "Noto Sans KR", system-ui, sans-serif;
  line-height: 1.5;
}

.skip-link {
  position: absolute;
  left: 18px;
  top: -80px;
  z-index: 20;
  padding: 8px 12px;
  border-radius: 6px;
  color: #ffffff;
  background: var(--accent);
}

.skip-link:focus {
  top: 18px;
}

:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.page-shell {
  max-width: 1440px;
  margin: 0 auto;
  padding: 28px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 4px 0 10px;
  font-size: clamp(2rem, 2.6vw, 3rem);
  line-height: 1.1;
}

.eyebrow {
  margin: 0;
  font-size: 0.84rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 700;
}

.lede,
.meta-copy,
.table-note,
.empty-state,
.pill-note {
  color: var(--muted);
}

.header-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.section-nav {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.94);
}

.section-nav a {
  padding: 6px 10px;
  border-radius: 6px;
  color: var(--accent);
  font-weight: 700;
  text-decoration: none;
}

.state-source-banner {
  margin-bottom: 18px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--muted);
  background: #fbfcfd;
}

.state-source-banner.stale {
  border-color: var(--warn);
  color: #714500;
  background: rgba(168, 103, 0, 0.1);
}

.chip,
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 600;
  background: #e9f2f9;
  color: var(--accent);
}

.badge.ok {
  background: rgba(31, 122, 77, 0.12);
  color: var(--ok);
}

.badge.warning {
  background: rgba(168, 103, 0, 0.14);
  color: var(--warn);
}

.badge.risk,
.badge.error {
  background: rgba(180, 35, 24, 0.12);
  color: var(--risk);
}

.badge.info,
.badge.active {
  background: rgba(10, 102, 194, 0.12);
  color: var(--info);
}

.badge.neutral,
.badge.todo,
.badge.not-started,
.badge.planned,
.badge.draft {
  background: #eef2f5;
  color: #45525f;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 18px;
}

.panel {
  grid-column: span 6;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
}

.panel-wide {
  grid-column: span 12;
}

.panel h2 {
  margin: 0 0 14px;
  font-size: 1.1rem;
}

.split-metrics,
.card-grid,
.mini-grid {
  display: grid;
  gap: 12px;
}

.split-metrics {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.card-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.mini-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.metric-card,
.info-card,
.list-card {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px;
  background: #fbfcfd;
}

.metric-label,
.info-label {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 0.88rem;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.progress-bar {
  position: relative;
  height: 12px;
  border-radius: 999px;
  background: #e8edf2;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #0a66c2 0%, #005a8d 100%);
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.row strong {
  font-size: 0.96rem;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}

th {
  color: var(--muted);
  font-size: 0.84rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

td code {
  font-size: 0.88rem;
  color: var(--accent);
}

.list-reset {
  list-style: none;
  margin: 0;
  padding: 0;
}

.list-reset li + li {
  margin-top: 10px;
}

.mono {
  font-family: "Cascadia Code", "Consolas", monospace;
}

@media (max-width: 960px) {
  .page-shell {
    padding: 18px;
  }

  .page-header {
    flex-direction: column;
  }

  .panel,
  .panel-wide {
    grid-column: span 12;
  }
}
`;
}

function buildDashboardJs(): string {
  return `const bootstrapElement = document.getElementById("dashboard-bootstrap-data");
const bootstrapState = bootstrapElement ? JSON.parse(bootstrapElement.textContent || "{}") : {};

async function loadDashboardState() {
  try {
    const response = await fetch("./state/dashboard-state.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("state fetch failed");
    }
    return {
      state: await response.json(),
      source: "state/dashboard-state.json",
      stale: false,
      error: ""
    };
  } catch (error) {
    return {
      state: bootstrapState,
      source: "embedded bootstrap state",
      stale: true,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function renderStateSource(loadResult) {
  const banner = document.getElementById("state-source-banner");
  if (!banner) return;
  banner.className = "state-source-banner" + (loadResult.stale ? " stale" : "");
  banner.textContent = loadResult.stale
    ? "Showing embedded bootstrap state because the live dashboard JSON could not be loaded: " + String(loadResult.error || "unknown error")
    : "Showing live dashboard state from " + String(loadResult.source);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function badgeClass(status) {
  const normalized = String(status || "neutral").toLowerCase();
  if (["ok", "done", "complete", "completed"].includes(normalized)) return "ok";
  if (["warning", "planned", "todo", "not-started", "draft"].includes(normalized)) return normalized;
  if (["risk", "error", "blocked", "critical"].includes(normalized)) return "risk";
  if (["active", "in-progress", "info"].includes(normalized)) return "active";
  return "neutral";
}

function renderExecutiveSummary(state) {
  const summary = state.executiveSummary || {};
  const workspace = state.workspace || {};
  return \`
    <h2>Executive Summary</h2>
    <div class="split-metrics">
      <div class="metric-card">
        <span class="metric-label">Overall Status</span>
        <div class="metric-value">\${escapeHtml(summary.overallStatus || "unknown")}</div>
      </div>
      <div class="metric-card">
        <span class="metric-label">Current Stage</span>
        <div class="metric-value">\${escapeHtml(summary.currentStage || "unknown")}</div>
      </div>
      <div class="metric-card">
        <span class="metric-label">Progress</span>
        <div class="metric-value">\${escapeHtml(summary.overallProgressPercent ?? 0)}%</div>
      </div>
      <div class="metric-card">
        <span class="metric-label">Primary Domains</span>
        <div class="metric-value">\${escapeHtml((workspace.primaryDomains || []).join(", ") || "none")}</div>
      </div>
    </div>
    <p class="meta-copy">\${escapeHtml(summary.headline || "")}</p>
    <p class="meta-copy"><strong>Next decision:</strong> \${escapeHtml(summary.nextDecision || "TBD")}</p>
    <p class="meta-copy"><strong>Last updated:</strong> \${escapeHtml(summary.lastUpdated || "unknown")}</p>
  \`;
}

function renderProgressState(state) {
  const progress = state.progressState || {};
  const workstreams = progress.workstreams || [];
  const checklist = progress.stageChecklist || [];
  const overall = state.executiveSummary?.overallProgressPercent ?? 0;
  return \`
    <h2>Progress State</h2>
    <div class="stack">
      <div>
        <span class="metric-label">Active Goal</span>
        <strong>\${escapeHtml(progress.activeGoal || "TBD")}</strong>
      </div>
      <div>
        <span class="metric-label">Current Chunk</span>
        <strong class="mono">\${escapeHtml(progress.activeChunk || "TBD")}</strong>
      </div>
      <div>
        <span class="metric-label">Overall Progress</span>
        <div class="progress-bar"><div class="progress-fill" style="width: \${Number(overall) || 0}%"></div></div>
      </div>
      <div class="card-grid">
        <div class="info-card">
          <span class="info-label">Blocked</span>
          <strong>\${escapeHtml(progress.blocked ? "yes" : "no")}</strong>
        </div>
        <div class="info-card">
          <span class="info-label">Risk Level</span>
          <strong>\${escapeHtml(progress.riskLevel || "unknown")}</strong>
        </div>
        <div class="info-card">
          <span class="info-label">Next Action</span>
          <strong>\${escapeHtml(progress.nextAction || "TBD")}</strong>
        </div>
      </div>
      <div class="stack">
        <strong>Stage Checklist</strong>
        <ul class="list-reset">
          \${checklist.map((item) => \`<li class="row"><span>\${escapeHtml(item.label)}</span><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status)}</span></li>\`).join("")}
        </ul>
      </div>
      <div class="stack">
        <strong>Active Workstreams</strong>
        <ul class="list-reset">
          \${workstreams.map((item) => \`<li class="list-card"><div class="row"><strong>\${escapeHtml(item.label)}</strong><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status)}</span></div><div class="pill-note">Owner: \${escapeHtml(item.owner)}</div><div class="progress-bar"><div class="progress-fill" style="width: \${Number(item.progressPercent) || 0}%"></div></div><div class="pill-note">\${escapeHtml(item.note || "")}</div></li>\`).join("")}
        </ul>
      </div>
    </div>
  \`;
}

function renderGovernanceState(state) {
  const governance = state.governanceState || {};
  const profile = state.kpiProfile || {};
  return \`
    <h2>Governance Control</h2>
    <div class="stack">
      <div><span class="metric-label">Policy</span><strong>\${escapeHtml(governance.policyLabel || "unknown")}</strong></div>
      <div><span class="metric-label">Status</span><span class="badge \${badgeClass(governance.status)}">\${escapeHtml(governance.status || "unknown")}</span></div>
      <div><span class="metric-label">Latest Approved Stage</span><strong>\${escapeHtml(governance.latestApprovedStage || "unknown")}</strong></div>
      <div><span class="metric-label">Goal Frozen</span><strong>\${escapeHtml(governance.goalFrozen ? "yes" : "no")}</strong></div>
      <div class="pill-note">\${escapeHtml(governance.sessionGovernanceRule || "")}</div>
      <div class="pill-note"><strong>KPI Profile:</strong> \${escapeHtml(profile.label || "unknown")}</div>
      <div class="pill-note"><strong>Perspectives:</strong> \${escapeHtml((profile.perspectives || []).join(", ") || "none")}</div>
      <div class="pill-note"><strong>Required KPI IDs:</strong> \${escapeHtml((governance.requiredKpiIds || []).join(", ") || "none")}</div>
    </div>
  \`;
}

function deriveRuntimeOrchestration(state) {
  if (state.runtimeOrchestration && typeof state.runtimeOrchestration === "object") {
    return state.runtimeOrchestration;
  }

  const governedSessions = Array.isArray(state.governedSessions) ? state.governedSessions : [];
  const latestSession = governedSessions.length > 0 ? governedSessions[governedSessions.length - 1] : {};
  return {
    mode: "planner-generator-evaluator",
    activeSessionId: latestSession.id || null,
    activeChunkId: latestSession.chunkId || state.progressState?.activeChunk || "chunk-unset",
    currentPhase: state.executiveSummary?.currentStage || "awaiting-session-start",
    nextActor: latestSession.agentRole || state.progressState?.currentOwner || "planner",
    nextAction: latestSession.nextStep || state.progressState?.nextAction || "Start the first governed runtime session.",
    contextPolicy:
      "Prefer context resets when drift or context anxiety appears; compact only after durable handoff artifacts exist.",
    contractCoverageRule:
      "No generator implementation begins before the evaluator-approved chunk contract exists.",
    evaluatorRule:
      "The generator may not self-approve; an independent evaluator records the pass or change-request verdict.",
    lastEventAt: latestSession.endedAt || state.executiveSummary?.lastUpdated || "unknown",
    stateFile: "docs/ai-harness/runtime/state/active-session.json",
    sessionIndexFile: "docs/ai-harness/runtime/state/session-index.json",
    sessionSummaryFile: latestSession.id
      ? "docs/ai-harness/runtime/sessions/" + latestSession.id + ".md"
      : "docs/ai-harness/runtime/sessions/",
    workPacketFile: latestSession.id
      ? "docs/ai-harness/runtime/work-packets/" + latestSession.id + ".work-packet.json"
      : "docs/ai-harness/runtime/state/current-work-packet.json",
    leaseStatus: latestSession.id ? "leased" : "idle",
    leasedAt: latestSession.endedAt || null,
    queueDepth: 0,
    queuedSessionIds: [],
    recentEvents: [],
  };
}

function renderRuntimeOrchestration(state) {
  const runtime = deriveRuntimeOrchestration(state);
  const recentEvents = Array.isArray(runtime.recentEvents) ? runtime.recentEvents : [];
  return \`
    <h2>Runtime Orchestration</h2>
    <div class="stack">
      <div><span class="metric-label">Mode</span><strong>\${escapeHtml(runtime.mode || "planner-generator-evaluator")}</strong></div>
      <div><span class="metric-label">Active Session</span><strong class="mono">\${escapeHtml(runtime.activeSessionId || "none")}</strong></div>
      <div><span class="metric-label">Current Phase</span><strong>\${escapeHtml(runtime.currentPhase || "awaiting-session-start")}</strong></div>
      <div><span class="metric-label">Next Actor</span><strong>\${escapeHtml(runtime.nextActor || "planner")}</strong></div>
      <div><span class="metric-label">Chunk</span><strong class="mono">\${escapeHtml(runtime.activeChunkId || "chunk-unset")}</strong></div>
      <div class="pill-note">\${escapeHtml(runtime.nextAction || "")}</div>
      <div class="pill-note"><strong>Context policy:</strong> \${escapeHtml(runtime.contextPolicy || "")}</div>
      <div class="pill-note"><strong>Contract rule:</strong> \${escapeHtml(runtime.contractCoverageRule || "")}</div>
      <div class="pill-note"><strong>Evaluator rule:</strong> \${escapeHtml(runtime.evaluatorRule || "")}</div>
      <div class="pill-note"><strong>State:</strong> \${escapeHtml(runtime.stateFile || "")}</div>
      <div class="pill-note"><strong>Index:</strong> \${escapeHtml(runtime.sessionIndexFile || "")}</div>
      <div class="pill-note"><strong>Summary:</strong> \${escapeHtml(runtime.sessionSummaryFile || "")}</div>
      <div class="pill-note"><strong>Work Packet:</strong> \${escapeHtml(runtime.workPacketFile || "")}</div>
      <div class="pill-note"><strong>Native Executor Bridge:</strong> \${escapeHtml(runtime.nativeExecutorBridgeId || "none")}</div>
      <div class="pill-note"><strong>Native Execution State:</strong> \${escapeHtml(runtime.nativeExecutionStateFile || "n/a")}</div>
      <div class="pill-note"><strong>Native Execution Plan:</strong> \${escapeHtml(runtime.nativeExecutionPlanFile || "n/a")}</div>
      <div class="pill-note"><strong>Lease:</strong> \${escapeHtml(runtime.leaseStatus || "idle")} | <strong>Leased At:</strong> \${escapeHtml(runtime.leasedAt || "n/a")}</div>
      <div class="pill-note"><strong>Queue Depth:</strong> \${escapeHtml(String(runtime.queueDepth ?? 0))}</div>
      <div class="pill-note"><strong>Queued Sessions:</strong> \${escapeHtml((runtime.queuedSessionIds || []).join(", ") || "none")}</div>
      <div class="pill-note"><strong>Last Event:</strong> \${escapeHtml(runtime.lastEventAt || "unknown")}</div>
      \${recentEvents.length > 0 ? \`<ul class="list-reset">\${recentEvents
        .map(
          (event) =>
            \`<li class="list-card"><div class="row"><strong>\${escapeHtml(event.phase || "event")}</strong><span class="badge \${badgeClass(event.outcome || "info")}">\${escapeHtml(event.outcome || "")}</span></div><div class="pill-note">\${escapeHtml(event.at || "")} | \${escapeHtml(event.actor || "")} | \${escapeHtml(event.action || "")}</div><div class="pill-note">\${escapeHtml(event.note || "")}</div></li>\`
        )
        .join("")}</ul>\` : "<p class=\\"empty-state\\">No runtime events recorded yet.</p>"}
    </div>
  \`;
}

function renderMemoryPromotion(state) {
  const memory = state.memoryPromotion || {};
  const threshold = memory.evidenceThreshold || {};
  const candidates = Array.isArray(memory.candidates) ? memory.candidates : [];
  const topCandidate = candidates[0] || {};

  return \`
    <h2>Memory Promotion</h2>
    <div class="split-metrics">
      <div class="metric-card"><span class="metric-label">Status</span><div class="metric-value">\${escapeHtml(memory.status || "unknown")}</div></div>
      <div class="metric-card"><span class="metric-label">Threshold</span><div class="metric-value">\${escapeHtml(memory.thresholdScore ?? 7)}</div></div>
      <div class="metric-card"><span class="metric-label">Occurrences</span><div class="metric-value">\${escapeHtml(threshold.minimumOccurrences ?? 3)}</div></div>
      <div class="metric-card"><span class="metric-label">Sessions</span><div class="metric-value">\${escapeHtml(threshold.minimumGovernedSessions ?? 2)}</div></div>
    </div>
    <article class="list-card">
      <div class="row"><strong>\${escapeHtml(topCandidate.title || "No active candidate")}</strong><span class="badge \${badgeClass(topCandidate.status || "neutral")}">\${escapeHtml(topCandidate.status || "none")}</span></div>
      <div class="pill-note">Score: \${escapeHtml(topCandidate.score ?? 0)} | Decision: \${escapeHtml(topCandidate.decision || "none")} | Collision: \${escapeHtml(topCandidate.collisionCheck || "unknown")}</div>
      <div class="pill-note">Evidence: \${escapeHtml(Array.isArray(topCandidate.evidencePaths) ? topCandidate.evidencePaths.join(", ") : "")}</div>
      <div class="pill-note">\${escapeHtml(topCandidate.nextAction || "Mine repeated session evidence before creating new skills or agents.")}</div>
    </article>
  \`;
}

function renderOperationsHealth(state) {
  const operations = state.operationsHealth || {};
  const traffic = operations.traffic || {};
  const rr = operations.requestResponse || {};
  const dbcp = operations.dbcp || {};
  const incidents = Array.isArray(operations.incidentLogs) ? operations.incidentLogs : [];
  const latencyQueries = Array.isArray(operations.latencyQueries) ? operations.latencyQueries : [];
  const dataSources = Array.isArray(operations.dataSources) ? operations.dataSources : [];

  return \`
    <h2>Server Operations Health</h2>
    <div class="split-metrics">
      <div class="metric-card">
        <span class="metric-label">Operations Status</span>
        <div class="metric-value">\${escapeHtml(operations.status || "unknown")}</div>
      </div>
      <div class="metric-card">
        <span class="metric-label">Traffic RPM</span>
        <div class="metric-value">\${escapeHtml(traffic.requestsPerMinute ?? 0)}</div>
      </div>
      <div class="metric-card">
        <span class="metric-label">Error Rate</span>
        <div class="metric-value">\${escapeHtml(traffic.errorRatePercent ?? 0)}%</div>
      </div>
      <div class="metric-card">
        <span class="metric-label">P95 Latency</span>
        <div class="metric-value">\${escapeHtml(rr.p95Ms ?? 0)} ms</div>
      </div>
    </div>
    <p class="meta-copy">\${escapeHtml(operations.summary || "")}</p>
    <div class="card-grid">
      <article class="list-card">
        <div class="row"><strong>Request / Response</strong><span class="badge \${badgeClass(operations.status || "neutral")}">\${escapeHtml(operations.status || "unknown")}</span></div>
        <div class="pill-note">Total: \${escapeHtml(rr.totalRequests ?? 0)} | Success: \${escapeHtml(rr.successResponses ?? 0)} | Errors: \${escapeHtml(rr.errorResponses ?? 0)}</div>
        <div class="pill-note">P50: \${escapeHtml(rr.p50Ms ?? 0)} ms | P95: \${escapeHtml(rr.p95Ms ?? 0)} ms | P99: \${escapeHtml(rr.p99Ms ?? 0)} ms</div>
        <div class="pill-note">Slow threshold: \${escapeHtml(rr.slowRequestThresholdMs ?? 1000)} ms</div>
      </article>
      <article class="list-card">
        <div class="row"><strong>DBCP Health</strong><span class="badge \${badgeClass(dbcp.status || "neutral")}">\${escapeHtml(dbcp.status || "unknown")}</span></div>
        <div class="pill-note">Pool: \${escapeHtml(dbcp.poolName || "default")}</div>
        <div class="pill-note">Active: \${escapeHtml(dbcp.activeConnections ?? 0)} | Idle: \${escapeHtml(dbcp.idleConnections ?? 0)} | Max: \${escapeHtml(dbcp.maxConnections ?? 0)} | Waiters: \${escapeHtml(dbcp.waiters ?? 0)}</div>
        <div class="pill-note">Validation: \${escapeHtml(dbcp.validationQuery || "TBD")} | Last check: \${escapeHtml(dbcp.lastCheckAt || "unknown")}</div>
      </article>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Source</th><th>Last Seen</th></tr></thead>
        <tbody>
          \${incidents.map((item) => \`<tr><td>\${escapeHtml(item.summary || item.id)}</td><td><span class="badge \${badgeClass(item.severity)}">\${escapeHtml(item.severity || "")}</span></td><td>\${escapeHtml(item.status || "")}</td><td>\${escapeHtml(item.source || "")}</td><td>\${escapeHtml(item.lastSeenAt || "")}</td></tr>\`).join("")}
        </tbody>
      </table>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Latency Query</th><th>Status</th><th>P95</th><th>Last Run</th><th>Query</th></tr></thead>
        <tbody>
          \${latencyQueries.map((item) => \`<tr><td>\${escapeHtml(item.label || item.id)}</td><td><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status || "")}</span></td><td>\${escapeHtml(item.p95Ms ?? 0)} ms</td><td>\${escapeHtml(item.lastRunAt || "")}</td><td><code>\${escapeHtml(item.query || "")}</code></td></tr>\`).join("")}
        </tbody>
      </table>
    </div>
    <div class="mini-grid">
      \${dataSources.map((item) => \`<div class="info-card"><span class="info-label">\${escapeHtml(item.label || item.id)}</span><strong>\${escapeHtml(item.status || "unknown")}</strong><div class="pill-note mono">\${escapeHtml(item.path || "TBD")}</div><div class="pill-note">\${escapeHtml(item.expectedSignal || "")}</div></div>\`).join("")}
    </div>
    <p class="table-note">Last operations update: \${escapeHtml(operations.lastUpdated || "unknown")}</p>
  \`;
}

function renderGitStatus(state) {
  const git = state.gitStatus || {};
  const lastCommit = git.lastCommit || {};
  const workingTree = git.workingTree || {};
  return \`
    <h2>Version Control</h2>
    <div class="mini-grid">
      <div class="info-card"><span class="info-label">Tracked by Git</span><strong>\${escapeHtml(git.trackedByGit || "unknown")}</strong></div>
      <div class="info-card"><span class="info-label">Current Branch</span><strong class="mono">\${escapeHtml(git.currentBranch || "TBD")}</strong></div>
      <div class="info-card"><span class="info-label">Default Branch</span><strong class="mono">\${escapeHtml(git.defaultBranch || "main")}</strong></div>
      <div class="info-card"><span class="info-label">Working Tree</span><strong>\${escapeHtml(workingTree.status || "unknown")}</strong></div>
      <div class="info-card"><span class="info-label">Staged Changes</span><strong>\${escapeHtml(workingTree.stagedChanges || "TBD")}</strong></div>
      <div class="info-card"><span class="info-label">Unstaged Changes</span><strong>\${escapeHtml(workingTree.unstagedChanges || "TBD")}</strong></div>
      <div class="info-card"><span class="info-label">Untracked Files</span><strong>\${escapeHtml(workingTree.untrackedFiles || "TBD")}</strong></div>
    </div>
    <div class="stack">
      <div><span class="metric-label">Last Commit</span><strong class="mono">\${escapeHtml(lastCommit.sha || "TBD")}</strong></div>
      <div class="pill-note">\${escapeHtml(lastCommit.message || "No commit snapshot recorded yet.")}</div>
      <div class="pill-note"><strong>Author:</strong> \${escapeHtml(lastCommit.author || "TBD")} | <strong>Committed:</strong> \${escapeHtml(lastCommit.committedAt || "TBD")}</div>
      <div class="pill-note">Audit expectations:</div>
      <ul class="list-reset">
        \${(git.auditExpectations || []).map((item) => \`<li>\${escapeHtml(item)}</li>\`).join("")}
      </ul>
    </div>
  \`;
}

function renderWorkstreams(state) {
  const workstreams = state.progressState?.workstreams || [];
  if (workstreams.length === 0) {
    return "<h2>Workstreams Snapshot</h2><p class=\\"empty-state\\">No workstreams recorded.</p>";
  }

  return \`
    <h2>Workstreams Snapshot</h2>
    <div class="card-grid">
      \${workstreams.map((item) => \`<article class="list-card"><div class="row"><strong>\${escapeHtml(item.label)}</strong><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status)}</span></div><div class="pill-note">Owner: \${escapeHtml(item.owner || "unknown")}</div><div class="progress-bar"><div class="progress-fill" style="width: \${Number(item.progressPercent) || 0}%"></div></div><div class="pill-note">\${escapeHtml(item.note || "")}</div></article>\`).join("")}
    </div>
  \`;
}

function renderKpis(state) {
  const kpis = state.kpis || [];
  return \`
    <h2>KPI Board</h2>
    <div class="card-grid">
      \${kpis.map((item) => \`<article class="list-card"><div class="row"><strong>\${escapeHtml(item.label)}</strong><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status)}\${item.required ? " / required" : ""}</span></div><div class="metric-value">\${escapeHtml(item.value)}</div><div class="pill-note"><strong>Target:</strong> \${escapeHtml(item.target || "")}</div><div class="pill-note"><strong>Perspectives:</strong> \${escapeHtml((item.perspectives || []).join(", ") || "none")}</div><div class="pill-note">\${escapeHtml(item.interpretation || "")}</div></article>\`).join("")}
    </div>
  \`;
}

function renderErrors(state) {
  const items = state.errors || [];
  if (items.length === 0) {
    return "<h2>Issues and Errors</h2><p class=\\"empty-state\\">No issues recorded.</p>";
  }
  return \`
    <h2>Issues and Errors</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Status</th>
            <th>Summary</th>
            <th>Owner</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          \${items.map((item) => \`<tr><td><span class="badge \${badgeClass(item.severity)}">\${escapeHtml(item.severity)}</span></td><td>\${escapeHtml(item.status)}</td><td>\${escapeHtml(item.summary)}</td><td>\${escapeHtml(item.owner || "unassigned")}</td><td>\${escapeHtml(item.lastSeenAt || "")}</td></tr>\`).join("")}
        </tbody>
      </table>
    </div>
  \`;
}

function renderArtifacts(state) {
  const items = state.artifacts || [];
  return \`
    <h2>Artifacts</h2>
    <ul class="list-reset">
      \${items.map((item) => \`<li class="list-card"><div class="row"><strong>\${escapeHtml(item.label)}</strong><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status)}</span></div><div class="mono">\${escapeHtml(item.path || "")}</div><div class="pill-note">Owner: \${escapeHtml(item.owner || "unknown")}</div></li>\`).join("")}
    </ul>
  \`;
}

function renderDomainLens(state) {
  const lens = state.domainLens || {};
  const workspace = state.workspace || {};
  return \`
    <h2>Domain Lens</h2>
    <div class="stack">
      <div><span class="metric-label">Mode</span><strong>\${escapeHtml(lens.mode || "unknown")}</strong></div>
      <div><span class="metric-label">Title</span><strong>\${escapeHtml(lens.title || "")}</strong></div>
      <div class="pill-note">\${escapeHtml(lens.primaryQuestion || "")}</div>
      <div class="pill-note"><strong>Project Type:</strong> \${escapeHtml(workspace.projectType || "other")}</div>
    </div>
  \`;
}

function renderTimeline(state) {
  const items = state.timeline || [];
  return \`
    <h2>Timeline</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Type</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          \${items.map((item) => \`<tr><td>\${escapeHtml(item.label)}</td><td>\${escapeHtml(item.type)}</td><td><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status)}</span></td><td>\${escapeHtml(item.owner || "")}</td><td>\${escapeHtml(item.note || "")}</td></tr>\`).join("")}
        </tbody>
      </table>
    </div>
  \`;
}

function renderEntities(state) {
  const items = state.entities || [];
  return \`
    <h2>Domain Entities</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Type</th>
            <th>Status</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          \${items.map((item) => \`<tr><td>\${escapeHtml(item.label)}</td><td>\${escapeHtml(item.type)}</td><td><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status)}</span></td><td>\${escapeHtml(item.summary || "")}</td></tr>\`).join("")}
        </tbody>
      </table>
    </div>
  \`;
}

function renderVersionLedger(state) {
  const items = state.versionLedger || [];
  return \`
    <h2>Version Ledger</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th>Scope</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          \${items.map((item) => \`<tr><td>\${escapeHtml(item.label)}</td><td><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status)}</span></td><td>\${escapeHtml(item.scope || "")}</td><td>\${escapeHtml(item.progressPercent ?? 0)}%</td></tr>\`).join("")}
        </tbody>
      </table>
    </div>
  \`;
}

function renderSessionLog(state) {
  const items = state.sessionLog || [];
  return \`
    <h2>Session Log</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Session</th>
            <th>Status</th>
            <th>Stage</th>
            <th>Owner</th>
            <th>Outputs</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          \${items.map((item) => \`<tr><td class="mono">\${escapeHtml(item.id)}</td><td><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status)}</span></td><td>\${escapeHtml(item.stage || "")}</td><td>\${escapeHtml(item.owner || "")}</td><td>\${escapeHtml((item.outputs || []).join(", "))}</td><td>\${escapeHtml(item.note || "")}</td></tr>\`).join("")}
        </tbody>
      </table>
    </div>
  \`;
}

function renderGovernedSessions(state) {
  const items = state.governedSessions || [];
  if (items.length === 0) {
    return "<h2>Governed Sessions</h2><p class=\\"empty-state\\">No governed sessions recorded.</p>";
  }

  return \`
    <h2>Governed Sessions</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Session</th>
            <th>Owner / Role</th>
            <th>Governance</th>
            <th>Verification</th>
            <th>Git</th>
            <th>Next Step</th>
          </tr>
        </thead>
        <tbody>
          \${items.map((item) => \`<tr><td><div class="mono">\${escapeHtml(item.id)}</div><div>\${escapeHtml(item.title || "")}</div><div class="pill-note">Chunk: \${escapeHtml(item.chunkId || "")}</div></td><td><div>\${escapeHtml(item.owner || "")}</div><div class="pill-note">\${escapeHtml(item.agentRole || "")}</div><div><span class="badge \${badgeClass(item.status)}">\${escapeHtml(item.status || "")}</span> <span class="badge \${badgeClass(item.governanceStatus)}">\${escapeHtml(item.governanceStatus || "")}</span></div></td><td><div class="pill-note">Plan: \${escapeHtml(item.governance?.latestPlanRound ?? "")} / Review: \${escapeHtml(item.governance?.latestReviewRound ?? "")}</div><div class="pill-note">Goal frozen: \${escapeHtml(item.governance?.goalFrozen ? "yes" : "no")}</div><div class="pill-note">Evidence: \${escapeHtml(item.governance?.evidenceFreshness || "")}</div></td><td><div class="pill-note">Tests: \${escapeHtml(item.verification?.testsStatus || "")}</div><div class="pill-note">Review: \${escapeHtml(item.verification?.reviewStatus || "")}</div><div class="pill-note">Remediation: \${escapeHtml(item.verification?.remediationStatus || "")}</div></td><td><div class="mono">\${escapeHtml(item.git?.branch || "")}</div><div class="mono">\${escapeHtml(item.git?.commit || "")}</div></td><td>\${escapeHtml(item.nextStep || "")}</td></tr>\`).join("")}
        </tbody>
      </table>
    </div>
  \`;
}

async function main() {
  const loaded = await loadDashboardState();
  const state = loaded.state || {};
  renderStateSource(loaded);

  document.getElementById("executive-summary").innerHTML = renderExecutiveSummary(state);
  document.getElementById("progress-state").innerHTML = renderProgressState(state);
  document.getElementById("governance-state").innerHTML = renderGovernanceState(state);
  document.getElementById("runtime-orchestration").innerHTML = renderRuntimeOrchestration(state);
  document.getElementById("memory-promotion").innerHTML = renderMemoryPromotion(state);
  document.getElementById("operations-health").innerHTML = renderOperationsHealth(state);
  document.getElementById("git-status").innerHTML = renderGitStatus(state);
  document.getElementById("kpis").innerHTML = renderKpis(state);
  document.getElementById("errors").innerHTML = renderErrors(state);
  document.getElementById("workstreams").innerHTML = renderWorkstreams(state);
  document.getElementById("session-log").innerHTML = renderSessionLog(state);
  document.getElementById("governed-sessions").innerHTML = renderGovernedSessions(state);
  document.getElementById("artifacts").innerHTML = renderArtifacts(state);
  document.getElementById("domain-lens").innerHTML = renderDomainLens(state);
  document.getElementById("timeline").innerHTML = renderTimeline(state);
  document.getElementById("entities").innerHTML = renderEntities(state);
  document.getElementById("version-ledger").innerHTML = renderVersionLedger(state);
}

main();
`;
}

export function generateDashboardFiles(
  params: WorkspaceInitParams
): GeneratedFile[] {
  if (params.includeHarnessEngineering === false) {
    return [];
  }

  const state = buildDashboardState(params);
  const stateJson = `${JSON.stringify(state, null, 2)}\n`;

  return [
    {
      relativePath: "docs/ai-harness/dashboard/README.md",
      content: buildDashboardReadme(params),
    },
    {
      relativePath: "docs/ai-harness/dashboard/design-system.md",
      content: buildDashboardDesignSystem(),
    },
    {
      relativePath: "docs/ai-harness/dashboard/state/dashboard-state.schema.json",
      content: buildDashboardSchema(),
    },
    {
      relativePath: "docs/ai-harness/dashboard/state/dashboard-state.json",
      content: stateJson,
    },
    {
      relativePath: "docs/ai-harness/dashboard/index.html",
      content: buildDashboardHtml(params, stateJson.trimEnd()),
    },
    {
      relativePath: "docs/ai-harness/dashboard/app.css",
      content: buildDashboardCss(),
    },
    {
      relativePath: "docs/ai-harness/dashboard/app.js",
      content: buildDashboardJs(),
    },
    ...buildDashboardTemplateFiles(params),
  ];
}
