import {
  type GeneratedFile,
  type WorkspaceInitParams,
} from "../types.js";
import {
  HARNESS_ADAPTER_CONTRACT_VERSION,
  HARNESS_REQUIRED_HANDOFF_FIELDS,
} from "../data/runtime-contract.js";
import { HARNESS_RUNTIME_VERSION } from "../data/version.js";

const RUNTIME_COMPATIBILITY_VERSION = HARNESS_RUNTIME_VERSION;
const RUNTIME_COMPATIBILITY_FILES = [
  "docs/ai-harness/runtime/version-index.json",
  "docs/ai-harness/runtime/compatibility-matrix.json",
  "docs/ai-harness/runtime/adapter-contract.json",
  "docs/ai-harness/runtime/session-continuity.md",
];

function buildRuntimeReadme(): string {
  return `# Planner / Generator / Evaluator Runtime

This directory stores the file-system runtime for governed AI delivery.

## Purpose

- Run real planner, generator, and evaluator sessions without a database
- Keep long-running work resumable through explicit session JSON and markdown artifacts
- Ensure the dashboard can point to a durable runtime source of truth
- Preserve chunk contracts, independent evaluations, and context-reset handovers

## Core Files

- \`state/session-index.json\`: registry of all governed runtime sessions
- \`state/active-session.json\`: latest active or most recently closed session snapshot
- \`state/current-work-packet.json\`: latest active or queued work packet pointer for external AI handoff
- \`state/current-execution-bridge.json\`: latest prepared execution bridge pointer for external runtime launch
- \`state/current-native-execution.json\`: latest native executor launch pointer and status snapshot
- \`version-index.json\`: machine-readable feature and file index by workspace-init-mcp version
- \`compatibility-matrix.json\`: upgrade paths and compatibility checks for older harness workspaces
- \`adapter-contract.json\`: stable handoff interface for Copilot, Codex, Claude, Gemini, OpenHands, and portable runtimes
- \`session-continuity.md\`: cross-agent continuity rules for switching execution environments without losing governance state
- \`templates/harness-session.template.json\`: shape reference for runtime session state
- \`prompts/*.md\`: role briefs for planner, generator, and evaluator agents
- \`adapters/*.md\`: runtime-specific operating guidance for GitHub Copilot Chat, Codex CLI, Claude Code, Gemini CLI, generic CLI agents, OpenHands, and generic file-based execution
- \`bridges/*.md\`: launch guidance for concrete execution bridges
- \`native-executors/*.md\`: executable-specific guidance for directly launching supported runtimes
- \`work-packets/*.work-packet.json\`: durable per-session execution packets for external AI runtimes
- \`adapter-handoffs/<session-id>/<adapter-id>/\`: generated runtime-specific handoff bundles
- \`execution-bridges/<session-id>/<bridge-id>/\`: launch-ready bridge bundles and governed result receipts
- \`archive/\`: compacted closed-session bundles and archive indexes for long-running ledgers
- \`inbox/<role>/*.md\`: role-specific inbox copies that can be handed to a fresh AI session directly
- \`state-machine.md\`: allowed phase flow and transition rules

## MCP Runtime Tools

Use these MCP tools against the initialized workspace:

1. \`start_harness_session\`
   Opens governance, creates a runtime session, seeds the first chunk, and moves the workflow to \`plan-1\`.
2. \`advance_harness_session\`
   Moves the active session through the governed phase graph using \`complete\`, \`request_changes\`, \`block\`, \`resume\`, or \`context_reset\`.
3. \`get_harness_session_status\`
   Reads the current session and returns the next actor brief plus the current evidence paths.
4. \`list_harness_sessions\`
   Lists active, queued, blocked, open, or closed governed runtime sessions without reading JSON files manually.
5. \`get_harness_session_log\`
   Returns recent request/process/result events and evaluation-loop records for a governed session.
6. \`activate_harness_session\`
   Moves the single active lease to a queued or blocked session when execution focus changes.
7. \`audit_harness_runtime\`
   Audits runtime index, active snapshot, and session ledgers for drift or broken references.
8. \`prepare_harness_work_packet\`
   Rebuilds the durable work packet and actor inbox files for the active or requested session.
9. \`list_harness_runtime_adapters\`
   Lists the supported runtime adapters and their execution style.
10. \`prepare_harness_adapter_handoff\`
   Builds a runtime-specific handoff bundle for GitHub Copilot Chat, Codex CLI, Claude Code, Gemini CLI, generic CLI agents, OpenHands, or a generic file-based runtime.
11. \`list_harness_execution_bridges\`
   Lists the supported execution bridges and their launch style.
12. \`prepare_harness_execution_bridge\`
   Generates launch-ready bridge manifests, scripts, and result templates for a concrete runtime.
13. \`record_harness_execution_result\`
   Records the result receipt that returns an external execution back into governed runtime tracking.
14. \`list_harness_native_executors\`
   Lists the supported directly launchable runtime executors and reports local command detection.
15. \`prepare_harness_native_executor\`
   Builds the direct-launch plan, state file, and log targets for a native executor run.
16. \`launch_harness_native_executor\`
   Starts a supported native executor in foreground or background mode and records governed launch state.
17. \`get_harness_native_execution_status\`
   Reads the latest native executor state for a session or the workspace-level current snapshot.
18. \`compact_harness_runtime\`
   Archives older closed runtime sessions into durable archive bundles so the active ledgers stay readable.

## Operating Rules

1. No generator implementation begins before the evaluator-approved chunk contract exists.
2. Every phase change must record a durable note and at least one artifact path.
3. Every agent task, worker handoff, external execution, and phase transition records the original request, process summary, and result summary.
4. Use \`context_reset\` whenever drift, context anxiety, or handover risk appears.
5. Close governance only after verification, governance refresh, and request/process/result traceability are complete.
6. Keep session JSON and markdown summaries tracked in git.
`;
}

function buildRuntimeStateMachine(): string {
  return `# Runtime State Machine

## Phase Order

1. \`governance-open\`
2. \`plan-1\`
3. \`review-1\`
4. \`plan-2\`
5. \`review-2\`
6. \`plan-3\`
7. \`review-3\`
8. \`goal-freeze\`
9. \`contract-proposal\`
10. \`contract-review\`
11. \`implementation\`
12. \`self-check\`
13. \`independent-evaluation\`
14. \`remediation\` (re-entered only when changes are requested)
15. \`verification\`
16. \`governance-refresh\`
17. \`governance-close\`
18. \`closed\`

## Transition Actions

- \`complete\`: move to the next approved phase
- \`request_changes\`: move back to the required rework phase
- \`block\`: keep the current phase active but mark the session blocked
- \`resume\`: clear a blocked session and continue the same phase
- \`context_reset\`: write a handover and keep the same phase active for a fresh AI session

## Rework Rules

- \`review-1\` -> \`plan-1\`
- \`review-2\` -> \`plan-2\`
- \`review-3\` -> \`plan-3\`
- \`contract-review\` -> \`contract-proposal\`
- \`independent-evaluation\` -> \`remediation\`
- \`verification\` -> \`remediation\`

## Evidence Rules

- Planning phases write into \`docs/plans/<session-id>/\`
- Review phases write into \`docs/reviews/<session-id>/\`
- Contract phases write into \`docs/contracts/<session-id>/\` and \`docs/evaluations/<session-id>/\`
- Implementation and remediation write into \`docs/work-logs/\`
- Context resets write into \`docs/handovers/<session-id>/\`
- Session snapshots write into \`docs/ai-harness/runtime/state/\`
`;
}

function buildSessionIndexTemplate(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      updatedAt: "bootstrap",
      activeSessionId: null,
      queuedSessionIds: [],
      lease: {
        status: "idle",
        activeSessionId: null,
        leasedAt: null,
        queueDepth: 0,
      },
      sessions: [],
      note: "Use the MCP runtime tools to create governed sessions.",
    },
    null,
    2
  )}\n`;
}

function buildActiveSessionTemplate(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      mode: "planner-generator-evaluator",
      activeSessionId: null,
      status: "idle",
      currentPhase: "awaiting-session-start",
      nextActor: "planner",
      nextAction:
        "Start the first governed runtime session before implementation begins.",
      leaseStatus: "idle",
      leasedAt: null,
      queueDepth: 0,
      queuedSessionIds: [],
      lastUpdatedAt: "bootstrap",
    },
    null,
    2
  )}\n`;
}

function buildCurrentWorkPacketTemplate(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedAt: "bootstrap",
      leaseStatus: "idle",
      activeSessionId: null,
      nextActor: "planner",
      nextAction:
        "Start the first governed runtime session before implementation begins.",
      requestRecord: null,
      taskTracePolicy: {
        requiredFields: ["originalRequest", "processSummary", "resultSummary"],
        rule:
          "Every governed agent task records the original request, process summary, and result summary.",
      },
      workPacketFile: null,
      actorInboxFile: null,
      summary:
        "Open the first governed session before generating a planner work packet.",
    },
    null,
    2
  )}\n`;
}

function buildCurrentExecutionBridgeTemplate(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedAt: "bootstrap",
      activeSessionId: null,
      bridgeId: null,
      launchMode: "idle",
      bridgeManifestFile: null,
      summary:
        "Prepare an execution bridge after the first governed session and adapter handoff exist.",
    },
    null,
    2
  )}\n`;
}

function buildCurrentNativeExecutionTemplate(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedAt: "bootstrap",
      activeSessionId: null,
      bridgeId: null,
      status: "idle",
      launchMode: "idle",
      nativeExecutionPlanFile: null,
      nativeExecutionStateFile: null,
      stdoutLogFile: null,
      stderrLogFile: null,
      lastMessageFile: null,
      processId: null,
      executablePath: null,
      summary:
        "Prepare a native executor after the first governed session and execution bridge exist.",
    },
    null,
    2
  )}\n`;
}

function buildRuntimeVersionIndex(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedAt: "bootstrap",
      generatedBy: "workspace-init-mcp",
      latestVersion: RUNTIME_COMPATIBILITY_VERSION,
      purpose:
        "Machine-readable index of harness capabilities by workspace-init-mcp version so agents can reconcile old workspaces after @latest upgrades.",
      versions: [
        {
          version: "4.0.0",
          releaseTheme: "Governed workspace initialization baseline",
          capabilities: [
            "managed-harness-files",
            "three-plan-three-review-governance",
            "dashboard-state",
            "planner-generator-evaluator-ledgers",
          ],
          introducedFiles: [
            ".github/ai-harness/harness-manifest.yaml",
            ".github/ai-harness/operating-model.md",
            "docs/ai-harness/dashboard/state/dashboard-state.json",
          ],
          upgradeNotes: [
            "Use reconcile_workspace_initialization before relying on runtime handoffs.",
            "Preserve customized governance documents unless an operator explicitly refreshes them.",
          ],
        },
        {
          version: "4.0.1",
          releaseTheme: "Managed inventory and safer legacy reconcile posture",
          capabilities: [
            "managed-file-inventory",
            "reconcile-policy",
            "legacy-resource-import",
            "semantic-diff-audit",
          ],
          introducedFiles: [
            ".github/ai-harness/managed-file-inventory.json",
            ".github/ai-harness/reconcile-policy.json",
          ],
          upgradeNotes: [
            "Inventory-aware reconcile can add missing latest files while protecting drifted managed files.",
          ],
        },
        {
          version: "4.1.0",
          releaseTheme: "Planner/generator/evaluator runtime orchestration",
          capabilities: [
            "start_harness_session",
            "advance_harness_session",
            "list_harness_sessions",
            "get_harness_session_log",
            "prepare_harness_work_packet",
            "prepare_harness_adapter_handoff",
            "prepare_harness_execution_bridge",
            "record_harness_execution_result",
            "compact_harness_runtime",
          ],
          introducedFiles: [
            "docs/ai-harness/runtime/README.md",
            "docs/ai-harness/runtime/state/session-index.json",
            "docs/ai-harness/runtime/state/active-session.json",
            "docs/ai-harness/runtime/state/current-work-packet.json",
            "docs/ai-harness/runtime/state/current-execution-bridge.json",
          ],
          upgradeNotes: [
            "Runtime state files are live session state and should be merged, not blindly replaced.",
          ],
        },
        {
          version: "4.1.1",
          releaseTheme: "Codex native execution bridge hardening",
          capabilities: [
            "codex-exec-native-executor",
            "native-last-message-artifact",
            "native-executor-overrides",
            "dashboard-native-execution-visibility",
          ],
          introducedFiles: [
            ".github/ai-harness/native-executor-overrides.json",
            "docs/ai-harness/runtime/state/current-native-execution.json",
            "docs/ai-harness/runtime/native-executors/README.md",
          ],
          upgradeNotes: [
            "Codex runs should prefer codex exec with --output-last-message for durable final-message capture.",
          ],
        },
        {
          version: "4.1.2",
          releaseTheme: "Cross-agent compatibility and version capability indexing",
          capabilities: [
            "version-capability-index",
            "compatibility-matrix",
            "cross-agent-adapter-contract",
            "session-continuity-contract",
            "handoff-compatibility-metadata",
            "github-copilot-runtime-adapter",
          ],
          introducedFiles: [
            ...RUNTIME_COMPATIBILITY_FILES,
            "docs/ai-harness/runtime/adapters/github-copilot.md",
            "docs/ai-harness/runtime/bridges/github-copilot.md",
            "docs/ai-harness/runtime/native-executors/github-copilot.md",
          ],
          upgradeNotes: [
            "All adapter handoffs should include compatibility metadata and point to the stable adapter contract.",
            "Agents switching between Copilot, Codex, Claude, Gemini, OpenHands, or a portable runtime should read continuity files before chat history.",
            "Older workspaces should run reconcile_workspace_initialization to install missing compatibility files before starting @latest sessions.",
          ],
        },
        {
          version: "4.2.0",
          releaseTheme:
            "Parallel orchestration, non-destructive adoption, and quality gates",
          capabilities: [
            "harness-orchestrator-agent",
            "parallel-worker-context-injection",
            "worker-context-packets",
            "non-destructive-legacy-adoption",
            "protected-source-root-guard",
            "atomic-commit-quality-gate",
          ],
          introducedFiles: [
            ".github/agents/harness-orchestrator.agent.md",
            ".vscode/commit-message.instructions.md",
          ],
          upgradeNotes: [
            "Parallel worker sessions should start from orchestrator dependency maps and minimal context packets.",
            "Initialization and reconcile outputs must stay within governance, documentation, IDE, and harness roots unless a later explicit modernization contract expands ownership.",
            "Generated work packets should name dependency status, expected write paths, verification commands, and integration ownership.",
          ],
        },
        {
          version: "4.2.1",
          releaseTheme:
            "Safety hardening, runtime truthfulness, and release gate validation",
          capabilities: [
            "runtime-path-alias-hardening",
            "runtime-validation-json-diagnostics",
            "background-native-executor-failure-state",
            "strict-dashboard-contract-evidence",
            "cross-platform-release-ci",
          ],
          introducedFiles: [],
          upgradeNotes: [
            "Runtime session, chunk, and archive identifiers reject Windows reserved file-name aliases before writing state.",
            "Validation summaries now distinguish malformed JSON runtime state from missing artifacts.",
            "Native executor background launches remain non-definitive until a process is known to be running or a spawn failure is recorded.",
          ],
        },
        {
          version: RUNTIME_COMPATIBILITY_VERSION,
          releaseTheme:
            "Harness Dashboard Project World Model, ledger projections, and read-only local listener",
          capabilities: [
            "project-world-model-dashboard",
            "canonical-dashboard-event-ledger",
            "dashboard-projection-registry",
            "agent-resume-brief",
            "stakeholder-brief",
            "governance-evidence-brief",
            "service-registry-and-contracts",
            "release-incident-slo-database-readiness",
            "git-svn-vcs-change-records",
            "read-only-token-local-listener",
            "harness-dashboard-sse",
            "deterministic-dashboard-query",
            "public-share-redaction",
            "dashboard-context-mcp-tool",
          ],
          introducedFiles: [
            "docs/ai-harness/dashboard/events/harness-events.jsonl",
            "docs/ai-harness/dashboard/events/ledger-manifest.json",
            "docs/ai-harness/dashboard/entities/project-world-model.json",
            "docs/ai-harness/dashboard/state/dashboard-index.json",
            "docs/ai-harness/dashboard/state/dashboard-runtime.json",
            "docs/ai-harness/dashboard/state/embedding-documents.json",
            "docs/ai-harness/dashboard/schemas/events/harness-event.schema.json",
            "docs/ai-harness/dashboard/schemas/entities/project-world-model.schema.json",
            "docs/ai-harness/dashboard/schemas/projections/dashboard-state.schema.json",
            "docs/ai-harness/dashboard/design-framework.html",
            "docs/ai-harness/dashboard/backend-app-blueprint.html",
          ],
          upgradeNotes: [
            "The dashboard is a projection of a canonical event ledger, not a Markdown-derived report page.",
            "Use get_harness_dashboard_context at session start so AI Agents resume from explicit contracts instead of chat history.",
            "The local listener is restored on harness activity and remains loopback-only, token-protected, and read-only.",
            "Optional backend dashboard apps are blueprints only in 4.6.8 and are not generated by default.",
            "Public exports must redact local paths, usernames, tokens, private URLs, environment values, and sensitive deployment detail.",
          ],
        },
      ],
      latestRequiredArtifacts: [
        ...RUNTIME_COMPATIBILITY_FILES,
        "docs/ai-harness/dashboard/events/harness-events.jsonl",
        "docs/ai-harness/dashboard/events/ledger-manifest.json",
        "docs/ai-harness/dashboard/entities/project-world-model.json",
        "docs/ai-harness/dashboard/state/dashboard-state.json",
        "docs/ai-harness/dashboard/state/dashboard-index.json",
        "docs/ai-harness/dashboard/state/dashboard-runtime.json",
        "docs/ai-harness/dashboard/state/embedding-documents.json",
        "docs/ai-harness/dashboard/scripts/dashboard-ops.mjs",
      ],
      adapterCompatibility: {
        stableContractVersion: HARNESS_ADAPTER_CONTRACT_VERSION,
        supportedRuntimes: [
          "copilot",
          "github-copilot",
          "codex",
          "claude",
          "gemini",
          "openhands",
          "generic-cli",
          "generic-file-runtime",
        ],
        stableHandoffFields: [...HARNESS_REQUIRED_HANDOFF_FIELDS],
      },
    },
    null,
    2
  )}\n`;
}

function buildRuntimeCompatibilityMatrix(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedAt: "bootstrap",
      generatedBy: "workspace-init-mcp",
      currentVersion: RUNTIME_COMPATIBILITY_VERSION,
      adapterContractVersion: HARNESS_ADAPTER_CONTRACT_VERSION,
      upgradePolicy: {
        latestKeyword:
          "When an agent uses @latest, first inspect version-index.json and run reconcile_workspace_initialization if required compatibility files are missing.",
        safeDefault:
          "Use dry-run reconcile first; apply only after manual-review items are understood or intentionally held.",
        stateRule:
          "Merge live runtime state and dashboard state; replace generated compatibility contract files from the latest baseline.",
      },
      upgradePaths: [
        {
          from: "<=4.0.1",
          to: RUNTIME_COMPATIBILITY_VERSION,
          requiredActions: [
            "Add runtime orchestrator state and guide files.",
            "Add native executor override and current native execution snapshot files.",
            "Add version index, compatibility matrix, adapter contract, and session continuity contract.",
            "Refresh dashboard artifacts so operators can see runtime and compatibility surfaces.",
          ],
          preserve: [
            "customized operating model",
            "harness manifest",
            "dashboard truth fields",
            "legacy custom skills and agents",
          ],
        },
        {
          from: "4.1.0",
          to: RUNTIME_COMPATIBILITY_VERSION,
          requiredActions: [
            "Add Codex native executor last-message support.",
            "Add current native execution state file.",
            "Add version index and adapter compatibility contract files.",
          ],
          preserve: [
            "active runtime sessions",
            "work packets",
            "adapter handoff bundles",
            "execution receipts",
          ],
        },
        {
          from: "4.1.1",
          to: RUNTIME_COMPATIBILITY_VERSION,
          requiredActions: [
            "Add version index, compatibility matrix, adapter contract, and session continuity contract.",
            "Add the GitHub Copilot adapter, bridge, and manual native executor profile.",
            "Refresh adapter handoffs so compatibility metadata is embedded in new bundles.",
          ],
          preserve: [
            "native executor overrides",
            "current native execution state",
            "Codex last-message artifacts",
          ],
        },
        {
          from: "4.1.2",
          to: RUNTIME_COMPATIBILITY_VERSION,
          requiredActions: [
            "Add the harness orchestrator agent for dependency mapping and parallel worker assignment.",
            "Add generated file safety checks so initialization and reconcile stay out of protected legacy source roots.",
            "Refresh work packet templates and runtime handoffs with dependency, context injection, expected write path, verification, and quality gate fields.",
            "Refresh commit guidance so worker outputs stay traceable through atomic commits.",
          ],
          preserve: [
            "cross-agent adapter contract",
            "session continuity rules",
            "existing runtime state",
            "existing adapter handoff bundles",
          ],
        },
        {
          from: "4.2.0",
          to: RUNTIME_COMPATIBILITY_VERSION,
          requiredActions: [
            "Regenerate runtime compatibility files so 4.6.8 Hypertext Project World Model governance appears in version-index.json.",
            "Re-run validation after reconcile to surface malformed JSON runtime state with operator-facing diagnostics.",
            "Refresh native executor state after background launch failures so dashboards do not retain stale launch state.",
            "Install dashboard ledger, projection, entity, design framework, and read-only listener files.",
          ],
          preserve: [
            "parallel worker context packets",
            "protected source root policy",
            "existing runtime sessions",
            "existing dashboard truth fields",
          ],
        },
        {
          from: "4.2.1",
          to: RUNTIME_COMPATIBILITY_VERSION,
          requiredActions: [
            "Replace the server-status dashboard baseline with the 4.6.8 ledger-backed Hypertext Project World Model.",
            "Add stakeholderBrief, agentResumeBrief, governanceEvidenceBrief, service contracts, and operations readiness projections.",
            "Refresh dashboard state, schema, operations, and MCP context surfaces so agents can resume from projections.",
            "Keep the Project World Model Harness Dashboard as the only default dashboard; create Server Flow Monitoring dashboards only from explicit application-monitoring requests.",
          ],
          preserve: [
            "existing runtime sessions",
            "existing dashboard truth fields",
            "native executor launch evidence",
            "managed source-root safety policy",
          ],
        },
      ],
      compatibilityChecks: [
        {
          id: "version-index-present",
          file: "docs/ai-harness/runtime/version-index.json",
          severity: "required",
          reason: "Agents need a machine-readable capability index before assuming @latest behavior.",
        },
        {
          id: "adapter-contract-present",
          file: "docs/ai-harness/runtime/adapter-contract.json",
          severity: "required",
          reason: "Cross-agent handoffs need a stable interface shared by Copilot, Codex, Claude, Gemini, and OpenHands.",
        },
        {
          id: "session-continuity-present",
          file: "docs/ai-harness/runtime/session-continuity.md",
          severity: "required",
          reason: "Agent switching must preserve session id, active chunk, phase, receipts, and governed source-of-truth ordering.",
        },
        {
          id: "runtime-state-merge",
          file: "docs/ai-harness/runtime/state/",
          severity: "required",
          reason: "Runtime state stores live work and should be merged through reconcile.",
        },
      ],
      requiredRuntimeFiles: [
        "docs/ai-harness/runtime/state/session-index.json",
        "docs/ai-harness/runtime/state/active-session.json",
        "docs/ai-harness/runtime/state/current-work-packet.json",
        "docs/ai-harness/runtime/state/current-execution-bridge.json",
        "docs/ai-harness/runtime/state/current-native-execution.json",
        ...RUNTIME_COMPATIBILITY_FILES,
        "docs/ai-harness/runtime/adapters/github-copilot.md",
        "docs/ai-harness/runtime/bridges/github-copilot.md",
        "docs/ai-harness/runtime/native-executors/github-copilot.md",
      ],
    },
    null,
    2
  )}\n`;
}

function buildRuntimeAdapterContract(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      contractVersion: HARNESS_ADAPTER_CONTRACT_VERSION,
      generatedAt: "bootstrap",
      generatedBy: "workspace-init-mcp",
      purpose:
        "Stable cross-agent handoff interface for keeping governed harness work continuous across Copilot, Codex, Claude, Gemini, OpenHands, and portable runtimes.",
      supportedRuntimes: [
        "copilot",
        "github-copilot",
        "codex",
        "claude",
        "gemini",
        "openhands",
        "generic-cli",
        "generic-file-runtime",
      ],
      requiredHandoffFields: [...HARNESS_REQUIRED_HANDOFF_FIELDS],
      requiredFileReferences: [
        "workPacketFile",
        "workPacketMarkdownFile",
        "actorInboxFile",
        "sessionFile",
        "sessionSummaryFile",
        "rolePromptFile",
        "adapterProfileFile",
        "adapterContractFile",
        "versionIndexFile",
        "compatibilityMatrixFile",
        "sessionContinuityFile",
      ],
      sourceOfTruthOrder: [
        "runtime session JSON",
        "work packet JSON and markdown",
        "adapter handoff JSON and markdown",
        "execution bridge manifest and receipts",
        "dashboard state",
        "chat history",
      ],
      persistenceRules: [
        "Keep sessionId, chunkId, currentPhase, nextActor, and leaseStatus stable across runtime switches.",
        "Preserve requestRecord.originalRequest and add processSummary plus resultSummary for every meaningful task, worker receipt, and phase transition.",
        "Record runtime outcomes through governed receipts or advance_harness_session artifact paths before moving phases.",
        "Do not rely on hidden chat memory when a durable file provides the same fact.",
        "Use context_reset and handover artifacts when an agent cannot safely continue from current context.",
      ],
      switchingRules: [
        "Before switching runtimes, prepare a fresh adapter handoff for the target runtime.",
        "The receiving runtime must read adapter-contract.json, session-continuity.md, the handoff JSON, and the work packet before editing.",
        "The receiving runtime must not widen scope beyond the active chunk unless governance is advanced to a planning phase.",
        "If compatibility files are missing, run reconcile_workspace_initialization before starting governed execution.",
      ],
      parallelExecutionRules: [
        "An orchestrator must classify dependencies before launching parallel worker sessions.",
        "Parallel workers require disjoint expected write paths. Dependency manifests, lockfiles, CI workflows, shared config, generated clients, DB migrations, and API contracts require one merge owner or sequential execution.",
        "Run audit_harness_parallel_chunk_conflicts before launch; hard conflicts block parallel execution and integration-sensitive warnings require a merge owner.",
        "Only one runtime session may hold the active lease for a given chunk, but separate independent chunks may be queued or executed in separate supervised sessions.",
        "Evaluator and reviewer agents stay read-only unless a remediation contract assigns them a write scope.",
        "Worker outputs return through receipts, evaluations, dashboard updates, and atomic commits before integration is treated as complete.",
      ],
      contextInjectionRules: [
        "Each worker receives only the relevant task contract, code snippets, DB schema fragments, API specs, logs, verification commands, expected write paths, and merge ownership when integration is required.",
        "Do not inject unrelated repository context, old chat history, or other workers' private scratch notes unless they are explicit dependencies.",
        "If the worker discovers missing context or an undeclared write path, stop and update the context packet rather than silently expanding scope.",
      ],
      receiptContract: {
        requiredFields: [
          "sessionId",
          "bridgeId",
          "outcome",
          "summary",
          "originalRequest",
          "processSummary",
          "resultSummary",
          "artifactPaths",
          "nextStep",
        ],
        returnRule:
          "Every external or native execution returns through a governed receipt or an advance_harness_session artifact before the session phase changes.",
      },
    },
    null,
    2
  )}\n`;
}

function buildSessionContinuityContract(): string {
  return `# Session Continuity Contract

This contract keeps governed harness work stable when a user switches between Copilot, Codex, Claude, Gemini, OpenHands, or another runtime.

## Source Of Truth Order

1. Runtime session JSON in \`docs/ai-harness/runtime/sessions/\`
2. Work packet JSON and markdown in \`docs/ai-harness/runtime/work-packets/\`
3. Adapter handoff JSON and markdown in \`docs/ai-harness/runtime/adapter-handoffs/\`
4. Execution bridge manifests and receipts in \`docs/ai-harness/runtime/execution-bridges/\`
5. Dashboard state in \`docs/ai-harness/dashboard/state/dashboard-state.json\`
6. Chat history, terminal scrollback, or IDE memory

## Switching Rule

Before moving Copilot <-> Codex <-> Claude <-> Gemini <-> OpenHands, prepare a fresh adapter handoff for the target runtime and keep the same \`sessionId\`, \`chunkId\`, \`currentPhase\`, and \`nextActor\` unless governance explicitly advances them.

## Receiving Runtime Checklist

- Read \`docs/ai-harness/runtime/adapter-contract.json\`.
- Read \`docs/ai-harness/runtime/version-index.json\`.
- Read \`docs/ai-harness/runtime/compatibility-matrix.json\`.
- Read the generated handoff JSON and markdown for the selected adapter.
- Read the work packet and actor inbox before touching project files.
- Treat durable harness files as stronger evidence than prior chat context.
- Preserve the original user request and record process/result summaries in receipts or phase events.
- Return results through \`record_harness_execution_result\` or \`advance_harness_session\` with artifact paths.

## Parallel Worker Rule

Parallel work starts with an orchestrator-owned dependency map. A worker may run in parallel only when its context packet names an independent chunk, expected read paths, expected write paths, verification command, and integration owner. Workers must not coordinate through hidden chat state.

## Upgrade Rule

If a workspace was initialized with an older workspace-init-mcp version, run \`reconcile_workspace_initialization\` before using \`@latest\` capabilities. Reconcile should add missing compatibility files while preserving live runtime state, dashboard state, customized governance documents, and local adapter overrides.
`;
}

function buildSessionTemplate(params: WorkspaceInitParams): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      workspace: {
        name: params.workspaceName,
        rootPath: params.workspacePath,
        projectType: params.projectType ?? "other",
        purpose: params.purpose,
      },
      requestRecord: {
        originalRequest: "Store the user's original request text here.",
        normalizedGoal: "Describe the approved chunk goal here.",
        capturedAt: "TBD",
        source: "start_harness_session",
      },
      session: {
        id: "session-example",
        title: "Example governed delivery session",
        goal: "Describe the approved chunk goal here.",
        status: "active",
        adoptionTrack: "greenfield",
        createdAt: "TBD",
        updatedAt: "TBD",
        currentPhase: "plan-1",
        nextActor: "planner",
        activeChunkId: "chunk-example",
      },
      governance: {
        opened: true,
        latestPlanRound: 1,
        latestReviewRound: 0,
        goalFrozen: false,
        contractApproved: false,
        independentEvaluationPassed: false,
        governanceRefreshed: false,
        closeoutReady: false,
      },
      verification: {
        testsStatus: "pending",
        reviewStatus: "pending",
        remediationStatus: "not-started",
      },
      context: {
        policy: "balanced",
        resetCount: 0,
        lastResetAt: null,
        lastHandoverPath: null,
        pendingHandover: false,
      },
      chunk: {
        id: "chunk-example",
        title: "Example approved chunk",
        status: "planning",
        summary: "Describe the bounded chunk scope here.",
        outputs: [],
        dependencyNotes:
          "Classify as blocked, sequential, or parallel-ready with dependency rationale.",
        contextInjectionNotes:
          "List the relevant snippets, DB schema fragments, API specs, logs, commands, and expected write paths for the worker.",
        expectedReadPaths: [],
        expectedWritePaths: [],
        verificationCommands: [],
        assignedWorker: null,
        dependencyMap: [],
        mergeOwner: null,
        integrationOwner: null,
        parallelSafetyStatus: "unclassified",
        evaluationLoop: {
          iteration: 0,
          threshold:
            "Repeat work -> evaluate -> improve until the contract is satisfied and the hub can explain residual risk.",
          status: "not-started",
          history: [],
        },
      },
      phases: [],
      events: [
        {
          id: "evt-0001",
          at: "TBD",
          phase: "governance-open",
          actor: "planner",
          action: "complete",
          outcome: "governance-opened",
          note: "Governance scaffolding opened.",
          artifactPaths: [],
          taskTrace: {
            originalRequest: "Store the user's original request text here.",
            processSummary:
              "Describe the process used for this agent task or phase transition.",
            resultSummary:
              "Describe the result in user-facing terms, including residual risk.",
            recordedAt: "TBD",
            source: "start_harness_session",
          },
        },
      ],
      artifacts: [],
      notes: {
        current:
          "Complete Plan 1 and hand the artifact to the evaluator for Review 1.",
        lastOutcome: "bootstrap",
      },
    },
    null,
    2
  )}\n`;
}

function buildPlannerBrief(): string {
  return `# Planner Brief

- Expand the approved goal into a chunked, testable plan.
- Act as the hub for multi-chunk work: classify dependencies, isolate parallel-ready chunks, assign suitable workers, name merge owners, review receipts, and decide whether another improvement pass is required.
- Prepare a context-injection packet for each worker with only relevant snippets, schemas, API specs, commands, expected read paths, expected write paths, and merge ownership when integration is required.
- Run the parallel conflict audit before workers launch and resolve hard conflicts or integration-sensitive warnings first.
- Repeat work -> evaluate -> improve until the evaluator and hub can justify acceptance or record a blocker.
- Preserve the original request and require process/result summaries from each worker before accepting output.
- Update world model memory with decisions, evidence links, tacit context, and next safest action.
- Keep the plan ambitious at the product level and concrete at the verification level.
- Avoid locking in fragile low-level implementation choices too early.
- Treat every plan as resumable: document assumptions, open questions, and next steps explicitly.
- Before implementation begins, ensure the goal is frozen and the contract exists.
`;
}

function buildGeneratorBrief(): string {
  return `# Generator Brief

- Implement only against the approved contract and current chunk scope.
- Use only the injected context packet for the chunk unless the contract is updated.
- Keep outputs traceable to the active session, chunk, and verification criteria.
- Record static analysis, boundary test, version compatibility, dependency audit, and notable implementation tradeoffs as you work.
- Record processSummary and resultSummary so the hub can reconstruct what happened without hidden chat history.
- Produce a self-correction note that names uncertainty or low-confidence areas before evaluator review.
- If drift or context anxiety appears, request a context reset instead of guessing.
- Do not self-approve. Finish with evidence that can be judged independently.
`;
}

function buildEvaluatorBrief(): string {
  return `# Evaluator Brief

- Judge independently and skeptically against the contract, rubrics, and observed behavior.
- Prefer concrete evidence over optimistic summaries.
- Confirm static analysis, boundary testing, environment compatibility, dependency audit, maintainability, self-correction, and atomic commit evidence.
- When quality is insufficient, request changes with actionable findings.
- Score the result negatively, explain the evidence behind the score, and keep request/process/result traceability intact.
- Keep generator progress separate from evaluator approval.
- Verification ends only when the chunk is usable, reviewable, and safely handoff-ready.
`;
}

function buildWorkPacketsReadme(): string {
  return `# Runtime Work Packets

Each governed session writes a durable execution packet here.

- \`<session-id>.work-packet.json\`: machine-readable execution contract for the current actor
- \`<session-id>.md\`: human-readable packet for quick handoff

Use these files when a fresh AI session, another IDE, or an external stakeholder needs the exact next step without reading the full chat history.

For parallel work, the work packet is the context-injection boundary. It should include the active contract, relevant snippets or specs, dependency status, expected write paths, verification command, integration owner, and merge owner without dumping unrelated repository context. If a worker discovers an undeclared write path, it must stop and the packet must be revised before edits continue.
`;
}

function buildInboxReadme(): string {
  return `# Runtime Inbox

This directory mirrors the latest role-specific work packet in a lightweight markdown form.

- \`planner/<session-id>.md\`
- \`generator/<session-id>.md\`
- \`evaluator/<session-id>.md\`

Treat inbox files as session handoff entrypoints, not as the long-term source of truth. The source of truth remains the runtime session JSON and work packet JSON.
`;
}

function buildOutboxReadme(): string {
  return `# Runtime Outbox

Drop durable evidence or external execution outputs here when another runtime cannot write directly into the governed session folders.

Recommended pattern:

1. Write the raw output into \`outbox/<role>/\`
2. Link the durable path through \`advance_harness_session artifactPaths\`
3. Let the session ledger and dashboard capture the evidence officially
`;
}

function buildAdaptersReadme(): string {
  return `# Runtime Adapters

These adapter profiles explain how to hand governed runtime work to specific execution environments.

- \`../adapter-contract.json\`: stable interface all adapters must preserve
- \`github-copilot.md\`
- \`codex-cli.md\`
- \`claude-code.md\`
- \`gemini-cli.md\`
- \`generic-cli.md\`
- \`openhands.md\`
- \`generic-file-runtime.md\`

Use \`prepare_harness_adapter_handoff\` to generate a session-specific handoff bundle after selecting the adapter. When switching between Copilot, Codex, Claude, Gemini, OpenHands, or a portable runtime, read \`../session-continuity.md\` first.
`;
}

function buildAdapterProfile(
  id: string,
  title: string,
  runtimeFamily: string,
  focus: string,
  checklist: string[]
): string {
  return `# ${title}

- Adapter ID: \`${id}\`
- Runtime family: ${runtimeFamily}
- Focus: ${focus}

## Operator Checklist

${checklist.map((item) => `- ${item}`).join("\n")}

## Handoff Rule

Always start from the generated adapter handoff bundle and the per-session work packet, not from ad-hoc chat context.
`;
}

function buildAdapterHandoffsReadme(): string {
  return `# Adapter Handoffs

Session-specific runtime handoff bundles are generated here.

Pattern:

- \`<session-id>/<adapter-id>/handoff.json\`
- \`<session-id>/<adapter-id>/handoff.md\`
- \`<session-id>/<adapter-id>/launch-checklist.md\`

These bundles are safe to share with external AI runtimes because they point back to the governed file-system artifacts instead of requiring hidden chat history.
`;
}

function buildBridgesReadme(): string {
  return `# Execution Bridges

Bridge profiles describe how to launch governed sessions in concrete runtime environments.

- \`codex-cli.md\`
- \`github-copilot.md\`
- \`claude-code.md\`
- \`gemini-cli.md\`
- \`generic-cli.md\`
- \`openhands.md\`
- \`generic-file-runtime.md\`

Use \`prepare_harness_execution_bridge\` to generate the per-session launch bundle.
`;
}

function buildBridgeProfile(
  id: string,
  title: string,
  launchMode: string,
  notes: string[]
): string {
  return `# ${title}

- Bridge ID: \`${id}\`
- Launch mode: ${launchMode}

## Launch Notes

${notes.map((item) => `- ${item}`).join("\n")}

## Governance Rule

Always return external execution outcomes through a governed receipt before advancing the runtime session.
`;
}

function buildExecutionBridgesReadme(): string {
  return `# Execution Bridge Bundles

Per-session launch bundles are generated here.

Pattern:

- \`<session-id>/<bridge-id>/bridge-manifest.json\`
- \`<session-id>/<bridge-id>/launch.ps1\`
- \`<session-id>/<bridge-id>/launch.sh\`
- \`<session-id>/<bridge-id>/result-template.json\`
- \`<session-id>/<bridge-id>/return-to-governance.md\`
- \`<session-id>/<bridge-id>/result-receipt.json\`

These files let an operator start an external runtime and then return the result to the governed session cleanly.
`;
}

function buildNativeExecutorsReadme(): string {
  return `# Native Executors

Native executor profiles describe direct-launch integrations for supported runtimes.

- \`codex-cli.md\`
- \`github-copilot.md\`
- \`claude-code.md\`
- \`gemini-cli.md\`
- \`generic-cli.md\`
- \`openhands.md\`
- \`generic-file-runtime.md\`

The Codex native executor can use \`codex exec\` and write the final assistant message into the execution bridge bundle so the governed run leaves durable operator-facing evidence.

Use \`list_harness_native_executors\` to inspect what is locally available, \`prepare_harness_native_executor\` to generate a governed launch plan, and \`launch_harness_native_executor\` to execute the plan when appropriate.
`;
}

function buildNativeExecutorProfile(
  id: string,
  title: string,
  launchSupport: string,
  notes: string[]
): string {
  return `# ${title}

- Native executor ID: \`${id}\`
- Launch support: ${launchSupport}

## Operator Notes

${notes.map((item) => `- ${item}`).join("\n")}

## Governance Rule

Always launch from the governed workspace root and review the generated native execution plan before running commands directly.
`;
}

function buildRuntimeArchiveReadme(): string {
  return `# Runtime Archive

Archive bundles live here when older closed runtime sessions are compacted out of the active ledgers.

- \`archive-index.json\`: registry of generated archive bundles
- \`bundles/<archive-id>.json\`: machine-readable archive bundle
- \`bundles/<archive-id>.md\`: operator-friendly archive summary
- \`sessions/<session-id>.session.json\`: archived governed session state
- \`sessions/<session-id>.md\`: archived session summary

Use \`compact_harness_runtime\` when closed sessions accumulate and the active runtime ledger should stay lightweight for day-to-day work.
`;
}

function buildRuntimeArchiveIndexTemplate(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      updatedAt: "bootstrap",
      totalArchivedSessions: 0,
      bundles: [],
      note: "Archive compacted runtime sessions here when ledgers grow large.",
    },
    null,
    2
  )}\n`;
}

export function generateRuntimeOrchestratorFiles(
  params: WorkspaceInitParams
): GeneratedFile[] {
  if (params.includeHarnessEngineering === false) {
    return [];
  }

  return [
    {
      relativePath: "docs/ai-harness/runtime/README.md",
      content: buildRuntimeReadme(),
    },
    {
      relativePath: "docs/ai-harness/runtime/version-index.json",
      content: buildRuntimeVersionIndex(),
    },
    {
      relativePath: "docs/ai-harness/runtime/compatibility-matrix.json",
      content: buildRuntimeCompatibilityMatrix(),
    },
    {
      relativePath: "docs/ai-harness/runtime/adapter-contract.json",
      content: buildRuntimeAdapterContract(),
    },
    {
      relativePath: "docs/ai-harness/runtime/session-continuity.md",
      content: buildSessionContinuityContract(),
    },
    {
      relativePath: "docs/ai-harness/runtime/state-machine.md",
      content: buildRuntimeStateMachine(),
    },
    {
      relativePath: "docs/ai-harness/runtime/state/session-index.json",
      content: buildSessionIndexTemplate(),
    },
    {
      relativePath: "docs/ai-harness/runtime/state/active-session.json",
      content: buildActiveSessionTemplate(),
    },
    {
      relativePath: "docs/ai-harness/runtime/state/current-work-packet.json",
      content: buildCurrentWorkPacketTemplate(),
    },
    {
      relativePath: "docs/ai-harness/runtime/state/current-execution-bridge.json",
      content: buildCurrentExecutionBridgeTemplate(),
    },
    {
      relativePath: "docs/ai-harness/runtime/state/current-native-execution.json",
      content: buildCurrentNativeExecutionTemplate(),
    },
    {
      relativePath: "docs/ai-harness/runtime/templates/harness-session.template.json",
      content: buildSessionTemplate(params),
    },
    {
      relativePath: "docs/ai-harness/runtime/work-packets/README.md",
      content: buildWorkPacketsReadme(),
    },
    {
      relativePath: "docs/ai-harness/runtime/inbox/README.md",
      content: buildInboxReadme(),
    },
    {
      relativePath: "docs/ai-harness/runtime/outbox/README.md",
      content: buildOutboxReadme(),
    },
    {
      relativePath: "docs/ai-harness/runtime/adapters/README.md",
      content: buildAdaptersReadme(),
    },
    {
      relativePath: "docs/ai-harness/runtime/adapters/github-copilot.md",
      content: buildAdapterProfile(
        "github-copilot",
        "GitHub Copilot Chat / VS Code Adapter",
        "copilot",
        "IDE-native continuation that keeps .github/copilot-instructions.md aligned with governed runtime handoffs",
        [
          "Open the handoff markdown, actor inbox, and work packet in VS Code before prompting Copilot Chat.",
          "Tell Copilot to follow the adapter contract and session continuity contract over prior chat memory.",
          "Record Copilot outcomes through governed receipts or advance_harness_session artifact paths.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/adapters/codex-cli.md",
      content: buildAdapterProfile(
        "codex-cli",
        "Codex CLI / Desktop Adapter",
        "codex",
        "File-first coding continuation with strong patch/test discipline plus governed codex exec handoff support",
        [
          "Open the handoff markdown, actor inbox, and work packet before editing files.",
          "Prefer codex exec when you want a governed non-interactive run with a durable last-message file.",
          "Use governed artifacts as the source of truth over transient chat context.",
          "Advance the governed session after each meaningful phase completion.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/adapters/claude-code.md",
      content: buildAdapterProfile(
        "claude-code",
        "Claude Code / Claude CLI Adapter",
        "claude",
        "Repository execution with explicit governed handoffs and conservative CLI fallback coverage",
        [
          "Bootstrap the run with the generated handoff bundle and actor inbox.",
          "Preserve contract and evaluation gates exactly as written.",
          "When drift risk appears, record a reset instead of improvising.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/adapters/gemini-cli.md",
      content: buildAdapterProfile(
        "gemini-cli",
        "Gemini CLI Adapter",
        "gemini",
        "Gemini CLI execution using documented prompt and file-inclusion patterns",
        [
          "Use the generated handoff bundle and actor inbox as the canonical prompt context.",
          "Prefer the dedicated Gemini adapter over the generic CLI adapter when Gemini is the real runtime.",
          "Record the final Gemini command or wrapper in governed artifacts for reproducibility.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/adapters/generic-cli.md",
      content: buildAdapterProfile(
        "generic-cli",
        "Generic CLI Adapter",
        "cli",
        "Portable CLI execution for prompt-file or stdin driven agent runtimes such as Gemini CLI and future vendor CLIs",
        [
          "Use the generated handoff bundle and actor inbox as the canonical prompt context.",
          "Edit the generic launch command template to match the real CLI syntax in your environment.",
          "Record the final command or wrapper script in governed artifacts so the run can be reproduced.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/adapters/openhands.md",
      content: buildAdapterProfile(
        "openhands",
        "OpenHands Adapter",
        "openhands",
        "Autonomous workspace-agent execution bounded by governed files",
        [
          "Attach the handoff bundle as the worker bootstrap context.",
          "Keep expected writes inside the current chunk and governed ledgers.",
          "Persist evidence before asking the evaluator for a verdict.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/adapters/generic-file-runtime.md",
      content: buildAdapterProfile(
        "generic-file-runtime",
        "Generic File Runtime Adapter",
        "portable",
        "Portable file-based handoff for runtimes without native MCP integration",
        [
          "Share the handoff markdown and referenced files together.",
          "Write execution outputs into runtime/outbox if direct writes are constrained.",
          "Link the outbox artifacts back into the governed session after the run.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/adapter-handoffs/README.md",
      content: buildAdapterHandoffsReadme(),
    },
    {
      relativePath: "docs/ai-harness/runtime/bridges/README.md",
      content: buildBridgesReadme(),
    },
    {
      relativePath: "docs/ai-harness/runtime/bridges/github-copilot.md",
      content: buildBridgeProfile("github-copilot", "GitHub Copilot Chat Execution Bridge", "workspace-worker", [
        "Use this bridge when the target runtime is Copilot Chat inside VS Code.",
        "Open the generated handoff markdown and actor inbox before asking Copilot to continue.",
        "Return to governance with a receipt or advance_harness_session artifact paths after the Copilot run.",
      ]),
    },
    {
      relativePath: "docs/ai-harness/runtime/bridges/codex-cli.md",
      content: buildBridgeProfile("codex-cli", "Codex Execution Bridge", "guided-command", [
        "Use the generated bridge manifest and launch script as the runtime bootstrap.",
        "Prefer codex exec with --output-last-message for governed non-interactive runs, and keep interactive codex as the supervised fallback.",
        "Launch from the shared workspace so patch/test operations stay reproducible.",
        "Record a governed receipt when the run ends.",
      ]),
    },
    {
      relativePath: "docs/ai-harness/runtime/bridges/claude-code.md",
      content: buildBridgeProfile("claude-code", "Claude Code / Claude CLI Execution Bridge", "guided-command", [
        "Treat the adapter handoff as the boot prompt and the bridge manifest as the launch contract.",
        "Use official Claude CLI prompt patterns when available and keep the Claude Code prompt-file fallback for broader coverage.",
        "Return a governed receipt after the run.",
      ]),
    },
    {
      relativePath: "docs/ai-harness/runtime/bridges/gemini-cli.md",
      content: buildBridgeProfile("gemini-cli", "Gemini CLI Execution Bridge", "guided-command", [
        "Use Gemini CLI prompt mode or file inclusion syntax from the official CLI reference.",
        "Keep the run anchored to the workspace root so the handoff file resolves correctly.",
        "Capture the final Gemini command in governed evidence before returning to governance.",
      ]),
    },
    {
      relativePath: "docs/ai-harness/runtime/bridges/generic-cli.md",
      content: buildBridgeProfile("generic-cli", "Generic CLI Execution Bridge", "guided-command", [
        "Use this bridge when your runtime is CLI-based but does not yet have a dedicated vendor profile.",
        "Edit the generated launch template to match the target CLI flags before running it.",
        "Capture the real command you used in a receipt or governed work log.",
      ]),
    },
    {
      relativePath: "docs/ai-harness/runtime/bridges/openhands.md",
      content: buildBridgeProfile("openhands", "OpenHands Execution Bridge", "workspace-worker", [
        "Use the bridge manifest to bound the autonomous run.",
        "Persist evidence before handing back to evaluator-led phases.",
        "Record a receipt even when the run fails or is blocked.",
      ]),
    },
    {
      relativePath: "docs/ai-harness/runtime/bridges/generic-file-runtime.md",
      content: buildBridgeProfile("generic-file-runtime", "Generic File Runtime Bridge", "portable-replay", [
        "Use the bridge bundle as a portable operator handoff pack.",
        "Paste the generated prompt block into the external runtime as needed.",
        "Bring results back through governed receipts and artifact paths.",
      ]),
    },
    {
      relativePath: "docs/ai-harness/runtime/execution-bridges/README.md",
      content: buildExecutionBridgesReadme(),
    },
    {
      relativePath: "docs/ai-harness/runtime/native-executors/README.md",
      content: buildNativeExecutorsReadme(),
    },
    {
      relativePath: "docs/ai-harness/runtime/native-executors/github-copilot.md",
      content: buildNativeExecutorProfile(
        "github-copilot",
        "GitHub Copilot Chat Native Executor",
        "manual-only",
        [
          "Copilot Chat is usually launched through VS Code rather than a stable CLI.",
          "Use the generated bridge bundle and handoff markdown as the IDE prompt envelope.",
          "Record the Copilot result through governed receipts or advance_harness_session artifact paths.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/native-executors/codex-cli.md",
      content: buildNativeExecutorProfile(
        "codex-cli",
        "Codex Native Executor",
        "native",
        [
          "Prefer the generated native execution plan over ad-hoc terminal commands.",
          "The default Codex plan uses codex exec and captures the last message in a durable file inside the execution bridge bundle.",
          "Use native-executor-overrides.json if your Codex team standard needs explicit sandbox, approval, model, or profile flags.",
          "Use foreground mode when you want an immediate governed pass/fail result.",
          "Use background mode only when an operator is explicitly supervising the run.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/native-executors/claude-code.md",
      content: buildNativeExecutorProfile(
        "claude-code",
        "Claude Code / Claude CLI Native Executor",
        "native",
        [
          "Confirm whether the environment exposes `claude` or `claude-code` and pass an explicit override when needed.",
          "Treat the adapter handoff and actor inbox as the run bootstrap context, regardless of which binary is available.",
          "Capture stdout and stderr logs so the governed session can review the outcome.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/native-executors/gemini-cli.md",
      content: buildNativeExecutorProfile(
        "gemini-cli",
        "Gemini CLI Native Executor",
        "native",
        [
          "Run Gemini from the governed workspace root so the relative handoff file path resolves consistently.",
          "Use the dedicated Gemini prompt/file-inclusion launch profile before falling back to the generic CLI adapter.",
          "Capture stdout, stderr, and the effective Gemini command in governed artifacts after the run.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/native-executors/generic-cli.md",
      content: buildNativeExecutorProfile(
        "generic-cli",
        "Generic CLI Native Executor",
        "manual-only",
        [
          "Use this profile for CLIs whose exact launch syntax must be customized locally.",
          "Treat the generated bridge manifest, prompt file, and actor inbox as the portable execution envelope.",
          "Record stdout, stderr, and the effective command in governed artifacts after the run.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/native-executors/openhands.md",
      content: buildNativeExecutorProfile(
        "openhands",
        "OpenHands Native Executor",
        "native",
        [
          "Keep workspace writes bounded to the approved governed chunk.",
          "Use the bridge manifest to keep autonomous execution aligned with the governed plan.",
          "Return to governance with either a receipt or a native execution state review.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/native-executors/generic-file-runtime.md",
      content: buildNativeExecutorProfile(
        "generic-file-runtime",
        "Generic File Runtime Executor",
        "portable",
        [
          "Use this profile when the runtime must be started manually outside supported native commands.",
          "Share the plan, logs, and governed state files with the operator as a portable launch pack.",
          "Record the governed receipt even when the external runtime only produces file artifacts.",
        ]
      ),
    },
    {
      relativePath: "docs/ai-harness/runtime/archive/README.md",
      content: buildRuntimeArchiveReadme(),
    },
    {
      relativePath: "docs/ai-harness/runtime/archive/archive-index.json",
      content: buildRuntimeArchiveIndexTemplate(),
    },
    {
      relativePath: "docs/ai-harness/runtime/prompts/planner-brief.md",
      content: buildPlannerBrief(),
    },
    {
      relativePath: "docs/ai-harness/runtime/prompts/generator-brief.md",
      content: buildGeneratorBrief(),
    },
    {
      relativePath: "docs/ai-harness/runtime/prompts/evaluator-brief.md",
      content: buildEvaluatorBrief(),
    },
  ];
}
