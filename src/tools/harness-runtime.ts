import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  HARNESS_ADAPTER_CONTRACT_VERSION,
  HARNESS_REQUIRED_HANDOFF_FIELDS,
} from "../data/runtime-contract.js";
import { HARNESS_RUNTIME_VERSION } from "../data/version.js";
import {
  normalizeSafeWorkspaceRelativePaths,
  normalizeWorkspaceRelativePath,
} from "./generated-file-safety.js";

type HarnessActorRole = "hub" | "planner" | "generator" | "evaluator" | "operator";
type HarnessAction =
  | "complete"
  | "request_changes"
  | "block"
  | "resume"
  | "context_reset";
type HarnessPhaseId =
  | "governance-open"
  | "plan-1"
  | "review-1"
  | "plan-2"
  | "review-2"
  | "plan-3"
  | "review-3"
  | "goal-freeze"
  | "contract-proposal"
  | "contract-review"
  | "implementation"
  | "self-check"
  | "independent-evaluation"
  | "remediation"
  | "verification"
  | "governance-refresh"
  | "governance-close"
  | "closed";
type HarnessPhaseStatus =
  | "pending"
  | "active"
  | "complete"
  | "changes-requested"
  | "blocked";
type AdoptionTrack = "legacy-modernization" | "greenfield";
type ContextPolicy = "balanced" | "prefer-reset" | "prefer-compaction";
type HarnessLeaseStatus = "idle" | "active" | "queued" | "inactive";
export const HARNESS_RUNTIME_ADAPTER_IDS = [
  "github-copilot",
  "codex-cli",
  "claude-code",
  "gemini-cli",
  "generic-cli",
  "openhands",
  "generic-file-runtime",
] as const;
type HarnessRuntimeAdapterId = (typeof HARNESS_RUNTIME_ADAPTER_IDS)[number];
const NATIVE_EXECUTOR_OVERRIDES_PATH =
  ".github/ai-harness/native-executor-overrides.json";
const HARNESS_VERSION_INDEX_PATH = "docs/ai-harness/runtime/version-index.json";
const HARNESS_COMPATIBILITY_MATRIX_PATH =
  "docs/ai-harness/runtime/compatibility-matrix.json";
const HARNESS_ADAPTER_CONTRACT_PATH =
  "docs/ai-harness/runtime/adapter-contract.json";
const HARNESS_SESSION_CONTINUITY_PATH =
  "docs/ai-harness/runtime/session-continuity.md";
const HARNESS_DASHBOARD_LEDGER_PATH =
  "docs/ai-harness/dashboard/events/harness-events.jsonl";
const HARNESS_DASHBOARD_LEDGER_MANIFEST_PATH =
  "docs/ai-harness/dashboard/events/ledger-manifest.json";
const WINDOWS_RESERVED_RUNTIME_PATH_SEGMENT_PATTERN =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const DEFAULT_NATIVE_EXECUTOR_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_NATIVE_EXECUTOR_MAX_OUTPUT_BYTES = 1024 * 1024;

interface HarnessRuntimeAdapterDescriptor {
  id: HarnessRuntimeAdapterId;
  title: string;
  runtimeFamily: string;
  handoffMode: "file-first" | "workspace-agent" | "portable-bundle";
  summary: string;
  operatorChecklist: string[];
  runtimeExpectations: string[];
}

interface HarnessExecutionBridgeDescriptor {
  id: HarnessRuntimeAdapterId;
  title: string;
  adapterId: HarnessRuntimeAdapterId;
  runtimeFamily: string;
  launchMode: "guided-command" | "workspace-worker" | "portable-replay";
  summary: string;
  preferredCommands: {
    powershell: string[];
    bash: string[];
  };
  resultExpectations: string[];
}

interface HarnessNativeExecutorDescriptor {
  id: HarnessRuntimeAdapterId;
  title: string;
  launchSupport: "native" | "manual-only";
  commandCandidates: string[];
  versionArgs: string[];
  defaultArgsTemplate: string[];
  summary: string;
}

interface NativeExecutorOverridesDocument {
  schemaVersion: string;
  generatedAt: string;
  executors?: Partial<
    Record<
      HarnessRuntimeAdapterId,
      {
        commandCandidates?: string[];
        defaultArgsTemplate?: string[];
        prependArgsTemplate?: string[];
        appendArgsTemplate?: string[];
      }
    >
  >;
  bridges?: Partial<
    Record<
      HarnessRuntimeAdapterId,
      {
        powershell?: string[];
        bash?: string[];
        prependPowershell?: string[];
        appendPowershell?: string[];
        prependBash?: string[];
        appendBash?: string[];
      }
    >
  >;
}

interface HarnessPhaseDefinition {
  id: HarnessPhaseId;
  label: string;
  actor: HarnessActorRole;
  nextOnComplete?: HarnessPhaseId;
  nextOnChanges?: HarnessPhaseId;
}

interface HarnessPhaseRecord {
  id: HarnessPhaseId;
  label: string;
  actor: HarnessActorRole;
  status: HarnessPhaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  attempts: number;
  artifactPath: string | null;
  lastNote: string;
}

interface HarnessRuntimeEvent {
  id: string;
  at: string;
  phase: HarnessPhaseId;
  actor: HarnessActorRole;
  action: HarnessAction;
  outcome: string;
  note: string;
  artifactPaths: string[];
  taskTrace: HarnessTaskTrace;
  traceIntegrity?: HarnessTaskTraceIntegrity;
}

interface HarnessTaskTrace {
  originalRequest: string;
  processSummary: string;
  resultSummary: string;
  recordedAt: string;
  source: string;
}

interface HarnessTaskTraceIntegrity {
  status: "complete" | "legacy-fallback" | "missing-taskTrace-fields";
  missingFields: string[];
  source: string;
  warning: string | null;
}

interface HarnessRuntimeSessionState {
  schemaVersion: string;
  workspace: {
    name: string;
    rootPath: string;
    projectType: string;
    purpose: string;
  };
  requestRecord: {
    originalRequest: string;
    normalizedGoal: string;
    capturedAt: string;
    source: string;
  };
  session: {
    id: string;
    title: string;
    goal: string;
    status: "active" | "blocked" | "closed";
    adoptionTrack: AdoptionTrack;
    createdAt: string;
    updatedAt: string;
    currentPhase: HarnessPhaseId;
    nextActor: HarnessActorRole;
    activeChunkId: string;
  };
  governance: {
    opened: boolean;
    latestPlanRound: number;
    latestReviewRound: number;
    goalFrozen: boolean;
    contractApproved: boolean;
    independentEvaluationPassed: boolean;
    governanceRefreshed: boolean;
    closeoutReady: boolean;
  };
  verification: {
    testsStatus: string;
    reviewStatus: string;
    remediationStatus: string;
  };
  context: {
    policy: ContextPolicy;
    resetCount: number;
    lastResetAt: string | null;
    lastHandoverPath: string | null;
    pendingHandover: boolean;
  };
  chunk: {
    id: string;
    title: string;
    status: string;
    summary: string;
    outputs: string[];
    dependencyNotes?: string | null;
    contextInjectionNotes?: string | null;
    expectedReadPaths?: string[];
    expectedWritePaths?: string[];
    verificationCommands?: string[];
    assignedWorker?: string | null;
    dependencyMap?: string[];
    mergeOwner?: string | null;
    integrationOwner?: string | null;
    parallelSafetyStatus?:
      | "unclassified"
      | "blocked"
      | "sequential"
      | "parallel-ready"
      | "needs-merge-owner";
    evaluationLoop?: {
      iteration: number;
      threshold: string;
      status: "not-started" | "running" | "passed" | "blocked";
      history: Array<{
        at: string;
        actor: HarnessActorRole;
        verdict: string;
        phase: HarnessPhaseId;
        action: HarnessAction;
        findings: string[];
        requiredFixes: string[];
        verificationEvidence: string[];
        improvementAction: string;
        residualRisk: string | null;
        scoreBefore: number | null;
        scoreAfter: number | null;
      }>;
    };
  };
  phases: HarnessPhaseRecord[];
  events: HarnessRuntimeEvent[];
  artifacts: string[];
  notes: {
    current: string;
    lastOutcome: string;
  };
}

interface HarnessSessionIndex {
  schemaVersion: string;
  updatedAt: string;
  activeSessionId: string | null;
  queuedSessionIds: string[];
  lease: {
    status: "idle" | "leased";
    activeSessionId: string | null;
    leasedAt: string | null;
    queueDepth: number;
  };
  sessions: Array<{
    id: string;
    title: string;
    goal: string;
    status: string;
    currentPhase: HarnessPhaseId;
    nextActor: HarnessActorRole;
    chunkId: string;
    sessionPath: string;
    summaryPath: string;
    updatedAt: string;
  }>;
  note: string;
}

export interface StartHarnessSessionParams {
  workspacePath: string;
  goal: string;
  originalRequest?: string;
  processSummary?: string;
  resultSummary?: string;
  title?: string;
  sessionId?: string;
  chunkId?: string;
  chunkTitle?: string;
  dependencyNotes?: string;
  contextInjectionNotes?: string;
  expectedReadPaths?: string[];
  expectedWritePaths?: string[];
  verificationCommands?: string[];
  assignedWorker?: string;
  dependencyMap?: string[];
  mergeOwner?: string;
  integrationOwner?: string;
  parallelSafetyStatus?:
    | "unclassified"
    | "blocked"
    | "sequential"
    | "parallel-ready"
    | "needs-merge-owner";
  evaluationThreshold?: string;
  adoptionTrack?: AdoptionTrack;
  contextPolicy?: ContextPolicy;
  queueIfBusy?: boolean;
  force?: boolean;
}

export interface AdvanceHarnessSessionParams {
  workspacePath: string;
  sessionId?: string;
  action: HarnessAction;
  actorRole: HarnessActorRole;
  note: string;
  originalRequest?: string;
  processSummary?: string;
  resultSummary?: string;
  artifactPaths?: string[];
  nextStep?: string;
  reviewVerdict?: string;
  findings?: string[];
  requiredFixes?: string[];
  verificationEvidence?: string[];
  residualRisk?: string;
  scoreBefore?: number;
  scoreAfter?: number;
}

export interface HarnessRuntimeResult {
  sessionId: string;
  currentPhase: HarnessPhaseId;
  nextActor: HarnessActorRole;
  sessionPath: string;
  summaryPath: string;
  activeArtifactPath: string | null;
  workPacketPath: string;
  workPacketMarkdownPath: string;
  actorInboxPath: string;
  summary: string;
}

export interface HarnessSessionListResult {
  activeSessionId: string | null;
  queueDepth: number;
  sessions: Array<{
    id: string;
    title: string;
    status: string;
    leaseStatus: HarnessLeaseStatus;
    currentPhase: HarnessPhaseId;
    nextActor: HarnessActorRole;
    chunkId: string;
    updatedAt: string;
    originalRequest: string;
    eventCount: number;
    evaluationIteration: number;
    evaluationStatus: string;
    lastOutcome: string;
    nextAction: string;
    sessionPath: string;
    summaryPath: string;
  }>;
  summary: string;
}

export interface HarnessSessionLogResult {
  sessionId: string;
  events: Array<{
    id: string;
    at: string;
    phase: HarnessPhaseId;
    actor: HarnessActorRole;
    action: HarnessAction;
    outcome: string;
    note: string;
    artifactPaths: string[];
    taskTrace: HarnessTaskTrace;
    traceIntegrity?: HarnessTaskTraceIntegrity;
  }>;
  evaluationHistory: NonNullable<
    HarnessRuntimeSessionState["chunk"]["evaluationLoop"]
  >["history"];
  summary: string;
}

export interface AuditHarnessRuntimeResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: string;
}

export interface AuditHarnessParallelChunkConflictsResult {
  valid: boolean;
  sessions: Array<{
    sessionId: string;
    chunkId: string;
    status: string;
    expectedWritePaths: string[];
    expectedReadPaths: string[];
    dependencyNotes: string;
    parallelSafetyStatus: string;
    mergeOwner: string | null;
    integrationOwner: string | null;
  }>;
  conflicts: Array<{
    leftSessionId: string;
    leftChunkId: string;
    leftPath: string;
    rightSessionId: string;
    rightChunkId: string;
    rightPath: string;
    reason: string;
  }>;
  errors: string[];
  warnings: string[];
  summary: string;
}

export interface HarnessRuntimeValidationResult {
  valid: boolean;
  errors: string[];
}

export interface HarnessRuntimeAdapterCatalogResult {
  adapters: Array<{
    id: HarnessRuntimeAdapterId;
    title: string;
    runtimeFamily: string;
    handoffMode: string;
    summary: string;
  }>;
  summary: string;
}

export interface HarnessAdapterHandoffResult {
  adapterId: HarnessRuntimeAdapterId;
  sessionId: string;
  handoffPath: string;
  handoffMarkdownPath: string;
  checklistPath: string;
  summary: string;
}

export interface HarnessExecutionBridgeCatalogResult {
  bridges: Array<{
    id: HarnessRuntimeAdapterId;
    title: string;
    runtimeFamily: string;
    launchMode: string;
    summary: string;
  }>;
  summary: string;
}

export interface HarnessExecutionBridgeResult {
  bridgeId: HarnessRuntimeAdapterId;
  sessionId: string;
  bridgeManifestPath: string;
  launchPowershellPath: string;
  launchBashPath: string;
  resultTemplatePath: string;
  resultGuidePath: string;
  summary: string;
}

export interface RecordHarnessExecutionResultParams {
  workspacePath: string;
  bridgeId: HarnessRuntimeAdapterId;
  sessionId?: string;
  outcome: "completed" | "needs-review" | "blocked" | "failed";
  summary: string;
  originalRequest?: string;
  processSummary?: string;
  resultSummary?: string;
  artifactPaths?: string[];
  nextStep?: string;
}

export interface HarnessExecutionReceiptResult {
  bridgeId: HarnessRuntimeAdapterId;
  sessionId: string;
  receiptPath: string;
  receiptMarkdownPath: string;
  summary: string;
}

export interface HarnessNativeExecutorCatalogResult {
  executors: Array<{
    id: HarnessRuntimeAdapterId;
    title: string;
    launchSupport: "native" | "manual-only";
    available: boolean;
    detectedCommandPath: string | null;
    version: string | null;
    summary: string;
  }>;
  summary: string;
}

export interface PrepareHarnessNativeExecutorResult {
  bridgeId: HarnessRuntimeAdapterId;
  sessionId: string;
  available: boolean;
  nativeExecutionPlanPath: string;
  nativeExecutionStatePath: string;
  stdoutLogPath: string;
  stderrLogPath: string;
  lastMessagePath: string;
  summary: string;
}

export interface LaunchHarnessNativeExecutorParams {
  workspacePath: string;
  bridgeId: HarnessRuntimeAdapterId;
  sessionId?: string;
  executableOverride?: string;
  argsOverride?: string[];
  allowUnsafeNativeExecutorOverride?: boolean;
  waitForExit?: boolean;
  dryRun?: boolean;
  env?: Record<string, string>;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface LaunchHarnessNativeExecutorResult {
  bridgeId: HarnessRuntimeAdapterId;
  sessionId: string;
  status: string;
  processId?: number;
  exitCode?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  nativeExecutionPlanPath: string;
  nativeExecutionStatePath: string;
  stdoutLogPath: string;
  stderrLogPath: string;
  lastMessagePath: string;
  summary: string;
}

export interface HarnessNativeExecutionStatusResult {
  bridgeId: HarnessRuntimeAdapterId | null;
  sessionId: string | null;
  status: string;
  nativeExecutionStatePath: string;
  lastMessagePath: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  summary: string;
}

export interface CompactHarnessRuntimeParams {
  workspacePath: string;
  keepRecentClosed?: number;
  maxArchiveSessions?: number;
  reason?: string;
}

export interface CompactHarnessRuntimeResult {
  archivedSessionIds: string[];
  archiveIndexPath: string;
  archiveBundlePath?: string;
  archiveSummaryPath?: string;
  remainingRegisteredSessions: number;
  summary: string;
}

interface HarnessRuntimeArchiveIndex {
  schemaVersion: string;
  updatedAt: string;
  totalArchivedSessions: number;
  bundles: Array<{
    id: string;
    archivedAt: string;
    archivedSessionIds: string[];
    keepRecentClosed: number;
    reason: string;
    bundlePath: string;
    summaryPath: string;
  }>;
  note: string;
}

const PHASE_DEFINITIONS: HarnessPhaseDefinition[] = [
  {
    id: "governance-open",
    label: "Governance Open",
    actor: "planner",
    nextOnComplete: "plan-1",
  },
  { id: "plan-1", label: "Plan 1", actor: "planner", nextOnComplete: "review-1" },
  {
    id: "review-1",
    label: "Review 1",
    actor: "evaluator",
    nextOnComplete: "plan-2",
    nextOnChanges: "plan-1",
  },
  { id: "plan-2", label: "Plan 2", actor: "planner", nextOnComplete: "review-2" },
  {
    id: "review-2",
    label: "Review 2",
    actor: "evaluator",
    nextOnComplete: "plan-3",
    nextOnChanges: "plan-2",
  },
  { id: "plan-3", label: "Plan 3", actor: "planner", nextOnComplete: "review-3" },
  {
    id: "review-3",
    label: "Review 3",
    actor: "evaluator",
    nextOnComplete: "goal-freeze",
    nextOnChanges: "plan-3",
  },
  {
    id: "goal-freeze",
    label: "Goal Freeze",
    actor: "planner",
    nextOnComplete: "contract-proposal",
  },
  {
    id: "contract-proposal",
    label: "Contract Proposal",
    actor: "generator",
    nextOnComplete: "contract-review",
  },
  {
    id: "contract-review",
    label: "Contract Review",
    actor: "evaluator",
    nextOnComplete: "implementation",
    nextOnChanges: "contract-proposal",
  },
  {
    id: "implementation",
    label: "Implementation",
    actor: "generator",
    nextOnComplete: "self-check",
  },
  {
    id: "self-check",
    label: "Self Check",
    actor: "generator",
    nextOnComplete: "independent-evaluation",
  },
  {
    id: "independent-evaluation",
    label: "Independent Evaluation",
    actor: "evaluator",
    nextOnComplete: "verification",
    nextOnChanges: "remediation",
  },
  {
    id: "remediation",
    label: "Remediation",
    actor: "generator",
    nextOnComplete: "independent-evaluation",
  },
  {
    id: "verification",
    label: "Verification",
    actor: "evaluator",
    nextOnComplete: "governance-refresh",
    nextOnChanges: "remediation",
  },
  {
    id: "governance-refresh",
    label: "Governance Refresh",
    actor: "planner",
    nextOnComplete: "governance-close",
  },
  {
    id: "governance-close",
    label: "Governance Close",
    actor: "planner",
    nextOnComplete: "closed",
  },
  { id: "closed", label: "Closed", actor: "operator" },
];

const PHASE_BY_ID = new Map(
  PHASE_DEFINITIONS.map((definition) => [definition.id, definition])
);
const CHECKLIST_STAGE_ORDER = [
  "governance-open",
  "plan-1",
  "review-1",
  "plan-2",
  "review-2",
  "plan-3",
  "review-3",
  "goal-freeze",
  "implementation",
  "verification",
  "governance-refresh",
  "governance-close",
] as const;

const HARNESS_RUNTIME_ADAPTERS: HarnessRuntimeAdapterDescriptor[] = [
  {
    id: "github-copilot",
    title: "GitHub Copilot Chat / VS Code",
    runtimeFamily: "copilot",
    handoffMode: "file-first",
    summary:
      "Optimized for Copilot Chat sessions inside VS Code where repository instructions and governed handoff files must stay aligned.",
    operatorChecklist: [
      "Open the generated handoff markdown, actor inbox, and work packet in VS Code before prompting Copilot Chat.",
      "Make Copilot follow the adapter contract and session continuity contract instead of relying on prior chat state.",
      "Record any Copilot-produced result through governed receipts or advance_harness_session artifact paths.",
    ],
    runtimeExpectations: [
      "Treat .github/copilot-instructions.md plus the generated handoff as the boot context.",
      "Keep edits bounded to the active chunk and expected write paths.",
      "If Copilot cannot continue from files alone, trigger a context_reset and write a durable handover.",
    ],
  },
  {
    id: "codex-cli",
    title: "Codex CLI / Desktop",
    runtimeFamily: "codex",
    handoffMode: "file-first",
    summary:
      "Optimized for file-first continuation in a shared workspace with strong patch, test, and review discipline.",
    operatorChecklist: [
      "Open the generated adapter handoff markdown first.",
      "Load the actor inbox and work packet before editing code.",
      "Keep all durable decisions in governed artifacts, not only in chat.",
      "Use advance_harness_session after each meaningful governed phase change.",
    ],
    runtimeExpectations: [
      "Read the packet and actor inbox before touching the codebase.",
      "Prefer editing files and running tests over describing intended changes.",
      "Refresh the governed artifacts whenever implementation meaningfully changes scope or evidence.",
    ],
  },
  {
    id: "claude-code",
    title: "Claude Code / Claude CLI",
    runtimeFamily: "claude",
    handoffMode: "file-first",
    summary:
      "Optimized for Claude Code style repository execution with resumable file-system handoff artifacts and conservative CLI fallbacks.",
    operatorChecklist: [
      "Give Claude Code the handoff markdown plus the actor inbox file.",
      "Keep the governed phase boundaries explicit so Claude Code does not widen scope.",
      "Route any independent review step back through evaluator-owned artifacts.",
    ],
    runtimeExpectations: [
      "Start from the generated handoff prompt instead of replaying long chat history.",
      "Use context resets when the governed packet says drift risk is high.",
      "Treat contract approval and evaluation verdicts as external gates, not suggestions.",
    ],
  },
  {
    id: "gemini-cli",
    title: "Gemini CLI",
    runtimeFamily: "gemini",
    handoffMode: "file-first",
    summary:
      "Optimized for Gemini CLI style terminal execution using documented prompt and file-inclusion patterns from the official CLI reference.",
    operatorChecklist: [
      "Start from the generated handoff markdown and actor inbox before prompting Gemini CLI.",
      "Prefer the dedicated Gemini adapter over the generic CLI adapter when the runtime is Gemini.",
      "Record the exact Gemini command or wrapper used for the governed run.",
    ],
    runtimeExpectations: [
      "Treat the handoff markdown as governed source of truth and keep the run in the workspace root.",
      "Use the official prompt-style invocation patterns or file inclusion shortcuts instead of ad-hoc prompt reconstruction.",
      "Return results through governed receipts and artifact paths, not only terminal output.",
    ],
  },
  {
    id: "generic-cli",
    title: "Generic CLI Agent",
    runtimeFamily: "cli",
    handoffMode: "file-first",
    summary:
      "Portable CLI adapter for runtimes such as Gemini CLI or other prompt-file driven agents without a dedicated built-in bridge.",
    operatorChecklist: [
      "Open the governed handoff markdown and actor inbox before launching the CLI.",
      "Translate the generated generic launch template into the target CLI's real flags if they differ.",
      "Keep all outputs and decisions tied back to governed files and receipts.",
    ],
    runtimeExpectations: [
      "Treat the handoff markdown as the single source of truth for session context.",
      "Prefer prompt-file or stdin bootstrap over replaying long chat history manually.",
      "Capture the effective command you used in durable artifacts so another operator can reproduce it.",
    ],
  },
  {
    id: "openhands",
    title: "OpenHands",
    runtimeFamily: "openhands",
    handoffMode: "workspace-agent",
    summary:
      "Optimized for agent workers that operate directly in the repository with tool access and longer autonomous runs.",
    operatorChecklist: [
      "Attach the handoff bundle as the session bootstrap artifact for the worker.",
      "Make the active chunk, expected writes, and stop conditions explicit.",
      "Require the worker to persist evidence into the governed ledgers before phase completion.",
    ],
    runtimeExpectations: [
      "Autonomy is bounded by the active chunk contract and expected write paths.",
      "Do not treat queued sessions as implicitly available work.",
      "Before closeout, surface tests, review evidence, and remediation notes in durable files.",
    ],
  },
  {
    id: "generic-file-runtime",
    title: "Generic File-Based Runtime",
    runtimeFamily: "portable",
    handoffMode: "portable-bundle",
    summary:
      "Portable handoff bundle for any external LLM or AI runtime that can read files but does not integrate directly with the MCP.",
    operatorChecklist: [
      "Share the adapter handoff markdown together with the referenced work packet files.",
      "Keep execution outputs in runtime/outbox when direct writes are constrained.",
      "Manually link outbox artifacts back through advance_harness_session artifactPaths.",
    ],
    runtimeExpectations: [
      "Follow the handoff bundle as the single source of truth for next actions.",
      "Do not assume hidden context beyond the files referenced in the bundle.",
      "Return outcomes in files so the governed runtime can audit them later.",
    ],
  },
];

const HARNESS_EXECUTION_BRIDGES: HarnessExecutionBridgeDescriptor[] = [
  {
    id: "github-copilot",
    title: "GitHub Copilot Chat Execution Bridge",
    adapterId: "github-copilot",
    runtimeFamily: "copilot",
    launchMode: "workspace-worker",
    summary:
      "VS Code / Copilot Chat bridge that turns governed runtime files into a reproducible IDE handoff.",
    preferredCommands: {
      powershell: [
        'Set-Location "{workspacePath}"',
        'code "{workspacePath}"',
        'Write-Host "Open {handoffMarkdownRelativePath} in VS Code, then ask Copilot Chat to follow the adapter handoff and session continuity contract."',
      ],
      bash: [
        'cd "{workspacePath}"',
        'code "{workspacePath}"',
        'echo "Open {handoffMarkdownRelativePath} in VS Code, then ask Copilot Chat to follow the adapter handoff and session continuity contract."',
      ],
    },
    resultExpectations: [
      "Use the handoff markdown and actor inbox as the Copilot Chat prompt source of truth.",
      "Keep .github/copilot-instructions.md and runtime adapter-contract.json aligned when making governed changes.",
      "Return a governed receipt or advance the session with artifact paths after Copilot completes or blocks.",
    ],
  },
  {
    id: "codex-cli",
    title: "Codex Execution Bridge",
    adapterId: "codex-cli",
    runtimeFamily: "codex",
    launchMode: "guided-command",
    summary:
      "Guided launch bundle for Codex-style execution from a governed handoff and workspace packet.",
    preferredCommands: {
      powershell: [
        'Set-Location "{workspacePath}"',
        'codex exec --cd "{workspacePath}" --skip-git-repo-check --output-last-message "{lastMessagePath}" "{handoffInstruction}"',
        'Get-Content "{handoffMarkdownPath}" | codex exec --cd "{workspacePath}" --skip-git-repo-check --output-last-message "{lastMessagePath}" -',
        'codex --cd "{workspacePath}" "{handoffInstruction}"',
      ],
      bash: [
        'cd "{workspacePath}"',
        'codex exec --cd "{workspacePath}" --skip-git-repo-check --output-last-message "{lastMessagePath}" "{handoffInstruction}"',
        'cat "{handoffMarkdownPath}" | codex exec --cd "{workspacePath}" --skip-git-repo-check --output-last-message "{lastMessagePath}" -',
        'codex --cd "{workspacePath}" "{handoffInstruction}"',
      ],
    },
    resultExpectations: [
      "Write durable outputs to the expected governed paths, not only to chat.",
      "When the run finishes, capture a receipt before advancing the governed session.",
      "If the task diverges from the approved chunk, stop and record the blocker instead of widening scope.",
    ],
  },
  {
    id: "claude-code",
    title: "Claude Code / Claude CLI Execution Bridge",
    adapterId: "claude-code",
    runtimeFamily: "claude",
    launchMode: "guided-command",
    summary:
      "Guided launch bundle for Claude Code style repository execution through governed handoff files, with documented Claude CLI fallbacks.",
    preferredCommands: {
      powershell: [
        'Set-Location "{workspacePath}"',
        'claude -p "{handoffInstruction}"',
        'Get-Content "{handoffMarkdownPath}" | claude -p "Continue the governed session using the provided handoff context."',
        'claude-code --cwd "{workspacePath}" --prompt-file "{handoffMarkdownPath}"',
      ],
      bash: [
        'cd "{workspacePath}"',
        'claude -p "{handoffInstruction}"',
        'cat "{handoffMarkdownPath}" | claude -p "Continue the governed session using the provided handoff context."',
        'claude-code --cwd "{workspacePath}" --prompt-file "{handoffMarkdownPath}"',
      ],
    },
    resultExpectations: [
      "Treat the handoff markdown as the boot prompt for the session.",
      "Record implementation evidence in files before asking for governance advancement.",
      "Persist blockers and change requests as governed receipts instead of ad-hoc comments.",
    ],
  },
  {
    id: "gemini-cli",
    title: "Gemini CLI Execution Bridge",
    adapterId: "gemini-cli",
    runtimeFamily: "gemini",
    launchMode: "guided-command",
    summary:
      "Guided launch bundle for Gemini CLI using official prompt and file-inclusion patterns with governed handoff files.",
    preferredCommands: {
      powershell: [
        'Set-Location "{workspacePath}"',
        'gemini -p "@{handoffMarkdownRelativePath}"',
        'Get-Content "{handoffMarkdownPath}" | gemini -p "Continue the governed session using the provided handoff context."',
      ],
      bash: [
        'cd "{workspacePath}"',
        'gemini -p "@{handoffMarkdownRelativePath}"',
        'cat "{handoffMarkdownPath}" | gemini -p "Continue the governed session using the provided handoff context."',
      ],
    },
    resultExpectations: [
      "Use the governed handoff markdown as the boot context rather than reconstructing state manually.",
      "Keep the Gemini CLI run anchored to the workspace root so referenced files resolve consistently.",
      "Return governed receipts and artifact paths after the run completes or blocks.",
    ],
  },
  {
    id: "generic-cli",
    title: "Generic CLI Execution Bridge",
    adapterId: "generic-cli",
    runtimeFamily: "cli",
    launchMode: "guided-command",
    summary:
      "Vendor-neutral launch bundle for CLI agents where the governed handoff should be reused across sandboxes and local environments.",
    preferredCommands: {
      powershell: [
        'Write-Host "Edit the generic CLI template below to match your runtime syntax."',
        'YOUR_CLI --cwd "{workspacePath}" --prompt-file "{handoffMarkdownPath}"',
      ],
      bash: [
        'echo "Edit the generic CLI template below to match your runtime syntax."',
        'YOUR_CLI --cwd "{workspacePath}" --prompt-file "{handoffMarkdownPath}"',
      ],
    },
    resultExpectations: [
      "Treat the bridge manifest and handoff markdown as the portable execution contract.",
      "Record the real CLI command or wrapper script that was used for the run.",
      "Return outcomes through governed receipts or runtime state artifacts, not only terminal history.",
    ],
  },
  {
    id: "openhands",
    title: "OpenHands Execution Bridge",
    adapterId: "openhands",
    runtimeFamily: "openhands",
    launchMode: "workspace-worker",
    summary:
      "Workspace-worker bridge for long autonomous runs that still return to governed runtime files.",
    preferredCommands: {
      powershell: [
        'openhands run --workspace "{workspacePath}" --task-file "{handoffMarkdownPath}"',
      ],
      bash: [
        'openhands run --workspace "{workspacePath}" --task-file "{handoffMarkdownPath}"',
      ],
    },
    resultExpectations: [
      "Keep autonomy bounded by the chunk and expected write paths in the bridge manifest.",
      "Store any long-run evidence in runtime/outbox if direct writes are constrained.",
      "Return a governed receipt before the evaluator phase resumes.",
    ],
  },
  {
    id: "generic-file-runtime",
    title: "Generic File Runtime Bridge",
    adapterId: "generic-file-runtime",
    runtimeFamily: "portable",
    launchMode: "portable-replay",
    summary:
      "Portable launch bundle for external AI runtimes that only accept file artifacts and operator-driven prompts.",
    preferredCommands: {
      powershell: [
        'Write-Host "Open the handoff bundle and paste the prompt block into your external runtime."',
      ],
      bash: [
        'echo "Open the handoff bundle and paste the prompt block into your external runtime."',
      ],
    },
    resultExpectations: [
      "Capture outputs in governed files or runtime/outbox paths that can be audited later.",
      "Return a receipt with artifact paths so the governed session can resume safely.",
      "Do not assume the external runtime has hidden repository context beyond the handoff bundle.",
    ],
  },
];

const HARNESS_NATIVE_EXECUTORS: HarnessNativeExecutorDescriptor[] = [
  {
    id: "github-copilot",
    title: "GitHub Copilot Chat Native Executor",
    launchSupport: "manual-only",
    commandCandidates: [],
    versionArgs: [],
    defaultArgsTemplate: [],
    summary:
      "Manual-only profile for VS Code Copilot Chat. Use the generated bridge bundle and handoff files as the IDE prompt envelope.",
  },
  {
    id: "codex-cli",
    title: "Codex Native Executor",
    launchSupport: "native",
    commandCandidates: ["codex"],
    versionArgs: ["--version"],
    defaultArgsTemplate: [
      "exec",
      "--cd",
      "{workspacePath}",
      "--skip-git-repo-check",
      "--output-last-message",
      "{lastMessagePath}",
      "{handoffInstruction}",
    ],
    summary:
      "Launch Codex through codex exec from the governed workspace, capture the final message in a durable file, and keep the handoff instruction reproducible.",
  },
  {
    id: "claude-code",
    title: "Claude Code / Claude CLI Native Executor",
    launchSupport: "native",
    commandCandidates: ["claude", "claude-code"],
    versionArgs: ["--version"],
    defaultArgsTemplate: ["-p", "{handoffInstruction}"],
    summary:
      "Launch Claude Code or Claude CLI from the governed workspace with the handoff instruction as the boot prompt.",
  },
  {
    id: "gemini-cli",
    title: "Gemini CLI Native Executor",
    launchSupport: "native",
    commandCandidates: ["gemini"],
    versionArgs: ["--version"],
    defaultArgsTemplate: ["-p", "@{handoffMarkdownRelativePath}"],
    summary:
      "Launch Gemini CLI directly from the governed workspace using the documented prompt option and file-inclusion syntax.",
  },
  {
    id: "generic-cli",
    title: "Generic CLI Native Executor",
    launchSupport: "manual-only",
    commandCandidates: [],
    versionArgs: [],
    defaultArgsTemplate: [],
    summary:
      "Manual-only profile for vendor CLIs without a stable built-in contract. Customize the generated bridge commands and logs.",
  },
  {
    id: "openhands",
    title: "OpenHands Native Executor",
    launchSupport: "native",
    commandCandidates: ["openhands"],
    versionArgs: ["--version"],
    defaultArgsTemplate: [
      "run",
      "--workspace",
      "{workspacePath}",
      "--task-file",
      "{handoffMarkdownPath}",
    ],
    summary:
      "Launch OpenHands directly against the governed workspace and task file.",
  },
  {
    id: "generic-file-runtime",
    title: "Generic File Runtime",
    launchSupport: "manual-only",
    commandCandidates: [],
    versionArgs: [],
    defaultArgsTemplate: [],
    summary:
      "Portable file runtime with no single native executable. Use manual operator replay or a command override.",
  },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

interface JsonReadResult<T> {
  exists: boolean;
  value: T | null;
  error: string | null;
}

function readJsonIfExistsDetailed<T>(filePath: string): JsonReadResult<T> {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      value: null,
      error: null,
    };
  }

  try {
    return {
      exists: true,
      value: JSON.parse(fs.readFileSync(filePath, "utf-8")) as T,
      error: null,
    };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim().length > 0
        ? `: ${error.message}`
        : "";
    return {
      exists: true,
      value: null,
      error: `Invalid JSON in ${filePath}${detail}`,
    };
  }
}

function readJsonIfExists<T>(filePath: string): T | null {
  const result = readJsonIfExistsDetailed<T>(filePath);
  if (result.error != null) {
    throw new Error(result.error);
  }

  return result.value;
}

function readJsonForRuntimeAudit<T>(
  filePath: string,
  label: string,
  errors: string[]
): T | null {
  const result = readJsonIfExistsDetailed<T>(filePath);
  if (result.error != null) {
    errors.push(`${label}: ${result.error}`);
  }

  return result.value;
}

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup failures so the original write error is preserved.
    }
    throw err;
  }
}

function writeTextIfMissing(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf-8");
  }
}

function appendText(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, content, "utf-8");
}

function normalizeRuntimePathSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(normalized) ||
    normalized.endsWith(".") ||
    WINDOWS_RESERVED_RUNTIME_PATH_SEGMENT_PATTERN.test(normalized)
  ) {
    throw new Error(
      `${label} must be a safe path segment using only letters, numbers, dot, underscore, and hyphen, must not be a Windows reserved file name, and must not contain separators or traversal.`
    );
  }
  return normalized;
}

function normalizePositiveIntegerOption(
  value: number | undefined,
  fallback: number,
  label: string
): number {
  if (value == null) {
    return fallback;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function capTextByBytes(text: string, maxBytes: number): {
  text: string;
  truncated: boolean;
} {
  const buffer = Buffer.from(text, "utf-8");
  if (buffer.length <= maxBytes) {
    return { text, truncated: false };
  }
  return {
    text:
      buffer.subarray(0, maxBytes).toString("utf-8") +
      `\n[output truncated after ${maxBytes} bytes]\n`,
    truncated: true,
  };
}

function markBackgroundNativeExecutionFailed(
  workspacePath: string,
  session: HarnessRuntimeSessionState,
  bridgeId: HarnessRuntimeAdapterId,
  nativePaths: ReturnType<typeof buildNativeExecutionPaths>,
  prepared: PrepareHarnessNativeExecutorResult,
  executorTitle: string,
  commandPath: string,
  processId: number | null,
  errorCode: string,
  errorMessage: string
): void {
  const failedState = {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    activeSessionId: session.session.id,
    bridgeId,
    status: "failed",
    launchMode: "background",
    nativeExecutionPlanFile: prepared.nativeExecutionPlanPath,
    nativeExecutionStateFile: prepared.nativeExecutionStatePath,
    stdoutLogFile: prepared.stdoutLogPath,
    stderrLogFile: prepared.stderrLogPath,
    lastMessageFile: prepared.lastMessagePath,
    processId,
    executablePath: commandPath,
    errorCode,
    errorMessage,
    summary: `${executorTitle} failed during background execution. (${errorCode})`,
  };
  writeJson(nativePaths.nativeExecutionStatePath, failedState);
  writeJson(buildRuntimePaths(workspacePath).currentNativeExecutionPath, failedState);
  syncDashboardNativeExecution(
    workspacePath,
    session,
    bridgeId,
    prepared.nativeExecutionPlanPath,
    prepared.nativeExecutionStatePath,
    prepared.stdoutLogPath,
    prepared.stderrLogPath,
    prepared.lastMessagePath
  );
}

function buildRuntimePaths(workspacePath: string) {
  const runtimeRoot = path.join(workspacePath, "docs", "ai-harness", "runtime");
  const stateRoot = path.join(runtimeRoot, "state");
  const sessionsRoot = path.join(runtimeRoot, "sessions");
  const workPacketsRoot = path.join(runtimeRoot, "work-packets");
  const inboxRoot = path.join(runtimeRoot, "inbox");
  const outboxRoot = path.join(runtimeRoot, "outbox");
  const adaptersRoot = path.join(runtimeRoot, "adapters");
  const adapterHandoffsRoot = path.join(runtimeRoot, "adapter-handoffs");
  const bridgesRoot = path.join(runtimeRoot, "bridges");
  const executionBridgesRoot = path.join(runtimeRoot, "execution-bridges");
  const archiveRoot = path.join(runtimeRoot, "archive");
  const archiveSessionsRoot = path.join(archiveRoot, "sessions");
  const archiveBundlesRoot = path.join(archiveRoot, "bundles");

  return {
    runtimeRoot,
    stateRoot,
    sessionsRoot,
    workPacketsRoot,
    inboxRoot,
    outboxRoot,
    adaptersRoot,
    adapterHandoffsRoot,
    bridgesRoot,
    executionBridgesRoot,
    archiveRoot,
    archiveSessionsRoot,
    archiveBundlesRoot,
    sessionIndexPath: path.join(stateRoot, "session-index.json"),
    activeSessionPath: path.join(stateRoot, "active-session.json"),
    currentWorkPacketPath: path.join(stateRoot, "current-work-packet.json"),
    currentExecutionBridgePath: path.join(stateRoot, "current-execution-bridge.json"),
    currentNativeExecutionPath: path.join(stateRoot, "current-native-execution.json"),
    archiveIndexPath: path.join(archiveRoot, "archive-index.json"),
    dashboardStatePath: path.join(
      workspacePath,
      "docs",
      "ai-harness",
      "dashboard",
      "state",
      "dashboard-state.json"
    ),
  };
}

function buildSessionStatePath(workspacePath: string, sessionId: string): string {
  const paths = buildRuntimePaths(workspacePath);
  const safeSessionId = normalizeRuntimePathSegment(sessionId, "sessionId");
  return path.join(paths.sessionsRoot, `${safeSessionId}.session.json`);
}

function buildSessionSummaryPath(workspacePath: string, sessionId: string): string {
  const paths = buildRuntimePaths(workspacePath);
  const safeSessionId = normalizeRuntimePathSegment(sessionId, "sessionId");
  return path.join(paths.sessionsRoot, `${safeSessionId}.md`);
}

function buildArchivedSessionStatePath(
  workspacePath: string,
  sessionId: string
): string {
  const paths = buildRuntimePaths(workspacePath);
  const safeSessionId = normalizeRuntimePathSegment(sessionId, "sessionId");
  return path.join(paths.archiveSessionsRoot, `${safeSessionId}.session.json`);
}

function buildArchivedSessionSummaryPath(
  workspacePath: string,
  sessionId: string
): string {
  const paths = buildRuntimePaths(workspacePath);
  const safeSessionId = normalizeRuntimePathSegment(sessionId, "sessionId");
  return path.join(paths.archiveSessionsRoot, `${safeSessionId}.md`);
}

function buildRuntimeArchiveBundlePaths(workspacePath: string, archiveId: string) {
  const paths = buildRuntimePaths(workspacePath);
  const safeArchiveId = normalizeRuntimePathSegment(archiveId, "archiveId");
  return {
    bundlePath: path.join(paths.archiveBundlesRoot, `${safeArchiveId}.json`),
    summaryPath: path.join(paths.archiveBundlesRoot, `${safeArchiveId}.md`),
  };
}

function buildWorkPacketStatePath(workspacePath: string, sessionId: string): string {
  const paths = buildRuntimePaths(workspacePath);
  const safeSessionId = normalizeRuntimePathSegment(sessionId, "sessionId");
  return path.join(paths.workPacketsRoot, `${safeSessionId}.work-packet.json`);
}

function buildWorkPacketMarkdownPath(workspacePath: string, sessionId: string): string {
  const paths = buildRuntimePaths(workspacePath);
  const safeSessionId = normalizeRuntimePathSegment(sessionId, "sessionId");
  return path.join(paths.workPacketsRoot, `${safeSessionId}.md`);
}

function buildActorInboxPath(
  workspacePath: string,
  actor: HarnessActorRole,
  sessionId: string
): string {
  const paths = buildRuntimePaths(workspacePath);
  const safeSessionId = normalizeRuntimePathSegment(sessionId, "sessionId");
  return path.join(paths.inboxRoot, actor, `${safeSessionId}.md`);
}

function buildAdapterProfilePath(
  workspacePath: string,
  adapterId: HarnessRuntimeAdapterId
): string {
  const paths = buildRuntimePaths(workspacePath);
  return path.join(paths.adaptersRoot, `${adapterId}.md`);
}

function buildAdapterHandoffPaths(
  workspacePath: string,
  sessionId: string,
  adapterId: HarnessRuntimeAdapterId
): {
  handoffDir: string;
  handoffPath: string;
  handoffMarkdownPath: string;
  checklistPath: string;
} {
  const paths = buildRuntimePaths(workspacePath);
  const safeSessionId = normalizeRuntimePathSegment(sessionId, "sessionId");
  const handoffDir = path.join(paths.adapterHandoffsRoot, safeSessionId, adapterId);
  return {
    handoffDir,
    handoffPath: path.join(handoffDir, "handoff.json"),
    handoffMarkdownPath: path.join(handoffDir, "handoff.md"),
    checklistPath: path.join(handoffDir, "launch-checklist.md"),
  };
}

function buildBridgeProfilePath(
  workspacePath: string,
  bridgeId: HarnessRuntimeAdapterId
): string {
  const paths = buildRuntimePaths(workspacePath);
  return path.join(paths.bridgesRoot, `${bridgeId}.md`);
}

function buildExecutionBridgePaths(
  workspacePath: string,
  sessionId: string,
  bridgeId: HarnessRuntimeAdapterId
): {
  bridgeDir: string;
  bridgeManifestPath: string;
  launchPowershellPath: string;
  launchBashPath: string;
  resultTemplatePath: string;
  resultGuidePath: string;
  receiptPath: string;
  receiptMarkdownPath: string;
} {
  const paths = buildRuntimePaths(workspacePath);
  const safeSessionId = normalizeRuntimePathSegment(sessionId, "sessionId");
  const bridgeDir = path.join(paths.executionBridgesRoot, safeSessionId, bridgeId);
  return {
    bridgeDir,
    bridgeManifestPath: path.join(bridgeDir, "bridge-manifest.json"),
    launchPowershellPath: path.join(bridgeDir, "launch.ps1"),
    launchBashPath: path.join(bridgeDir, "launch.sh"),
    resultTemplatePath: path.join(bridgeDir, "result-template.json"),
    resultGuidePath: path.join(bridgeDir, "return-to-governance.md"),
    receiptPath: path.join(bridgeDir, "result-receipt.json"),
    receiptMarkdownPath: path.join(bridgeDir, "result-receipt.md"),
  };
}

function buildNativeExecutionPaths(
  workspacePath: string,
  sessionId: string,
  bridgeId: HarnessRuntimeAdapterId
): {
  nativeExecutionPlanPath: string;
  nativeExecutionStatePath: string;
  stdoutLogPath: string;
  stderrLogPath: string;
  lastMessagePath: string;
} {
  const executionPaths = buildExecutionBridgePaths(workspacePath, sessionId, bridgeId);
  return {
    nativeExecutionPlanPath: path.join(
      executionPaths.bridgeDir,
      "native-execution-plan.json"
    ),
    nativeExecutionStatePath: path.join(
      executionPaths.bridgeDir,
      "native-execution-state.json"
    ),
    stdoutLogPath: path.join(executionPaths.bridgeDir, "native-executor.stdout.log"),
    stderrLogPath: path.join(executionPaths.bridgeDir, "native-executor.stderr.log"),
    lastMessagePath: path.join(executionPaths.bridgeDir, "native-executor.last-message.md"),
  };
}

function getHarnessRuntimeAdapter(
  adapterId: HarnessRuntimeAdapterId
): HarnessRuntimeAdapterDescriptor {
  const adapter = HARNESS_RUNTIME_ADAPTERS.find((item) => item.id === adapterId);
  if (adapter == null) {
    throw new Error(`Unsupported harness runtime adapter "${adapterId}".`);
  }
  return adapter;
}

function getHarnessExecutionBridge(
  bridgeId: HarnessRuntimeAdapterId
): HarnessExecutionBridgeDescriptor {
  const bridge = HARNESS_EXECUTION_BRIDGES.find((item) => item.id === bridgeId);
  if (bridge == null) {
    throw new Error(`Unsupported harness execution bridge "${bridgeId}".`);
  }
  return bridge;
}

function getHarnessNativeExecutor(
  bridgeId: HarnessRuntimeAdapterId
): HarnessNativeExecutorDescriptor {
  const executor = HARNESS_NATIVE_EXECUTORS.find((item) => item.id === bridgeId);
  if (executor == null) {
    throw new Error(`Unsupported native executor "${bridgeId}".`);
  }
  return executor;
}

function loadNativeExecutorOverrides(
  workspacePath: string
): NativeExecutorOverridesDocument | null {
  const parsed = readJsonIfExists<NativeExecutorOverridesDocument>(
    path.join(workspacePath, NATIVE_EXECUTOR_OVERRIDES_PATH)
  );
  return isPlainObject(parsed) ? parsed : null;
}

function resolveBridgeCommands(
  workspacePath: string,
  bridge: HarnessExecutionBridgeDescriptor
): {
  powershell: string[];
  bash: string[];
} {
  const overrides = loadNativeExecutorOverrides(workspacePath);
  const bridgeOverride = overrides?.bridges?.[bridge.id];
  const powershell = Array.isArray(bridgeOverride?.powershell)
    ? bridgeOverride.powershell.filter((entry): entry is string => typeof entry === "string")
    : [];
  const bash = Array.isArray(bridgeOverride?.bash)
    ? bridgeOverride.bash.filter((entry): entry is string => typeof entry === "string")
    : [];
  const prependPowershell = Array.isArray(bridgeOverride?.prependPowershell)
    ? bridgeOverride.prependPowershell.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  const appendPowershell = Array.isArray(bridgeOverride?.appendPowershell)
    ? bridgeOverride.appendPowershell.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  const prependBash = Array.isArray(bridgeOverride?.prependBash)
    ? bridgeOverride.prependBash.filter((entry): entry is string => typeof entry === "string")
    : [];
  const appendBash = Array.isArray(bridgeOverride?.appendBash)
    ? bridgeOverride.appendBash.filter((entry): entry is string => typeof entry === "string")
    : [];
  const basePowershell =
    powershell.length > 0 ? powershell : bridge.preferredCommands.powershell;
  const baseBash = bash.length > 0 ? bash : bridge.preferredCommands.bash;

  return {
    powershell: [...prependPowershell, ...basePowershell, ...appendPowershell],
    bash: [...prependBash, ...baseBash, ...appendBash],
  };
}

function resolveNativeExecutorLaunchProfile(
  workspacePath: string,
  executor: HarnessNativeExecutorDescriptor
): {
  commandCandidates: string[];
  defaultArgsTemplate: string[];
} {
  const overrides = loadNativeExecutorOverrides(workspacePath);
  const executorOverride = overrides?.executors?.[executor.id];
  const commandCandidates = Array.isArray(executorOverride?.commandCandidates)
    ? executorOverride.commandCandidates.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
      )
    : [];
  const defaultArgsTemplate = Array.isArray(executorOverride?.defaultArgsTemplate)
    ? executorOverride.defaultArgsTemplate.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  const prependArgsTemplate = Array.isArray(executorOverride?.prependArgsTemplate)
    ? executorOverride.prependArgsTemplate.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  const appendArgsTemplate = Array.isArray(executorOverride?.appendArgsTemplate)
    ? executorOverride.appendArgsTemplate.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  const baseArgsTemplate =
    defaultArgsTemplate.length > 0 ? defaultArgsTemplate : executor.defaultArgsTemplate;

  return {
    commandCandidates: commandCandidates.length > 0 ? commandCandidates : executor.commandCandidates,
    defaultArgsTemplate: [
      ...prependArgsTemplate,
      ...baseArgsTemplate,
      ...appendArgsTemplate,
    ],
  };
}

function ensureRuntimeIndex(workspacePath: string): HarnessSessionIndex {
  const paths = buildRuntimePaths(workspacePath);
  ensureDir(paths.stateRoot);
  ensureDir(paths.sessionsRoot);
  ensureDir(paths.workPacketsRoot);
  ensureDir(paths.inboxRoot);
  ensureDir(paths.outboxRoot);
  ensureDir(paths.adaptersRoot);
  ensureDir(paths.adapterHandoffsRoot);
  ensureDir(paths.bridgesRoot);
  ensureDir(paths.executionBridgesRoot);
  ensureDir(paths.archiveRoot);
  ensureDir(paths.archiveSessionsRoot);
  ensureDir(paths.archiveBundlesRoot);

  const existingIndex = readJsonIfExists<HarnessSessionIndex>(paths.sessionIndexPath);
  const existingArchiveIndex =
    readJsonIfExists<HarnessRuntimeArchiveIndex>(paths.archiveIndexPath);
  if (existingArchiveIndex == null) {
    writeJson(paths.archiveIndexPath, {
      schemaVersion: "1.0.0",
      updatedAt: "bootstrap",
      totalArchivedSessions: 0,
      bundles: [],
      note: "Archive compacted runtime sessions here when ledgers grow large.",
    });
  }

  if (existingIndex != null) {
    return existingIndex;
  }

  const created: HarnessSessionIndex = {
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
    note: "Use the MCP harness runtime tools to manage governed sessions.",
  };
  writeJson(paths.sessionIndexPath, created);

  const activeSessionTemplate = {
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
  };
  writeJson(paths.activeSessionPath, activeSessionTemplate);
  writeJson(paths.currentWorkPacketPath, {
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
  });
  writeJson(paths.currentExecutionBridgePath, {
    schemaVersion: "1.0.0",
    generatedAt: "bootstrap",
    activeSessionId: null,
    bridgeId: null,
    launchMode: "idle",
    bridgeManifestFile: null,
    summary:
      "Prepare an execution bridge after the first governed session and adapter handoff exist.",
  });
  writeJson(paths.currentNativeExecutionPath, buildIdleNativeExecutionSnapshot());
  return created;
}

function relativeToWorkspace(workspacePath: string, targetPath: string): string {
  return path.relative(workspacePath, targetPath).replace(/\\/g, "/");
}

function buildIdleNativeExecutionSnapshot() {
  return {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
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
    summary: "No native executor launch is currently active.",
  };
}

function buildIdleActiveSnapshot() {
  return {
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
    lastUpdatedAt: nowIso(),
  };
}

function writeIdleActiveSnapshot(workspacePath: string): void {
  const paths = buildRuntimePaths(workspacePath);
  writeJson(paths.activeSessionPath, buildIdleActiveSnapshot());
}

function loadRuntimeIndex(workspacePath: string): HarnessSessionIndex {
  return ensureRuntimeIndex(workspacePath);
}

function loadArchiveIndex(workspacePath: string): HarnessRuntimeArchiveIndex {
  const paths = buildRuntimePaths(workspacePath);
  ensureRuntimeIndex(workspacePath);
  const archiveIndex = readJsonIfExists<HarnessRuntimeArchiveIndex>(
    paths.archiveIndexPath
  );
  if (archiveIndex == null) {
    throw new Error("Harness runtime archive index could not be loaded.");
  }
  return archiveIndex;
}

function loadActiveLeasedSession(workspacePath: string): HarnessRuntimeSessionState | null {
  const index = loadRuntimeIndex(workspacePath);
  if (index.activeSessionId == null) {
    return null;
  }
  return loadSession(workspacePath, index.activeSessionId);
}

function phaseArtifactRelativePath(
  session: Pick<HarnessRuntimeSessionState, "session" | "chunk">,
  phaseId: HarnessPhaseId
): string | null {
  const sessionId = normalizeRuntimePathSegment(session.session.id, "sessionId");
  const chunkId = normalizeRuntimePathSegment(session.chunk.id, "chunkId");
  switch (phaseId) {
    case "governance-open":
      return `docs/context/${sessionId}/governance-open.md`;
    case "plan-1":
    case "plan-2":
    case "plan-3":
      return `docs/plans/${sessionId}/${phaseId}.md`;
    case "review-1":
    case "review-2":
    case "review-3":
      return `docs/reviews/${sessionId}/${phaseId}.md`;
    case "goal-freeze":
      return `docs/plans/${sessionId}/goal-freeze.md`;
    case "contract-proposal":
      return `docs/contracts/${sessionId}/${chunkId}-contract.md`;
    case "contract-review":
      return `docs/evaluations/${sessionId}/${chunkId}-contract-review.md`;
    case "implementation":
      return `docs/work-logs/${sessionId}-${chunkId}-implementation.md`;
    case "self-check":
      return `docs/reviews/${sessionId}/self-check.md`;
    case "independent-evaluation":
      return `docs/evaluations/${sessionId}/${chunkId}-independent-evaluation.md`;
    case "remediation":
      return `docs/work-logs/${sessionId}-${chunkId}-remediation.md`;
    case "verification":
      return `docs/reviews/${sessionId}/verification.md`;
    case "governance-refresh":
      return `docs/context/${sessionId}/governance-refresh.md`;
    case "governance-close":
      return `docs/handovers/${sessionId}/governance-close.md`;
    case "closed":
      return null;
  }
}

function buildPhaseArtifactContent(
  session: HarnessRuntimeSessionState,
  phaseId: HarnessPhaseId
): string {
  const definition = PHASE_BY_ID.get(phaseId);
  const artifactPath = phaseArtifactRelativePath(session, phaseId);

  return `# ${definition?.label ?? phaseId}

- Session: \`${session.session.id}\`
- Goal: ${session.session.goal}
- Chunk: \`${session.chunk.id}\` (${session.chunk.title})
- Actor: ${definition?.actor ?? "operator"}
- Current phase: \`${phaseId}\`
- Artifact path: \`${artifactPath ?? "n/a"}\`

## Required Outcome

- Record the decisions, evidence, and next step for this phase.
- Keep the note short enough for the next session to resume without guesswork.
- Link only durable artifacts that should survive context resets and long-running delivery.

## Update Log

## bootstrap

- Session scaffolding created for this phase.
`;
}

function ensurePhaseArtifact(
  workspacePath: string,
  session: HarnessRuntimeSessionState,
  phaseId: HarnessPhaseId
): string | null {
  const relativePath = phaseArtifactRelativePath(session, phaseId);
  if (relativePath == null) {
    return null;
  }

  const fullPath = path.join(workspacePath, relativePath);
  writeTextIfMissing(fullPath, buildPhaseArtifactContent(session, phaseId));
  return relativePath;
}

function appendPhaseUpdate(
  workspacePath: string,
  relativePath: string | null,
  actorRole: HarnessActorRole,
  action: HarnessAction,
  note: string,
  extraArtifacts: string[],
  taskTrace?: HarnessTaskTrace
): void {
  if (relativePath == null) {
    return;
  }

  const lines = [
    "",
    `## ${nowIso()}`,
    "",
    `- Actor: ${actorRole}`,
    `- Action: ${action}`,
    `- Note: ${note}`,
  ];

  if (taskTrace != null) {
    lines.push(`- Original request: ${taskTrace.originalRequest}`);
    lines.push(`- Process: ${taskTrace.processSummary}`);
    lines.push(`- Result: ${taskTrace.resultSummary}`);
  }

  if (extraArtifacts.length > 0) {
    lines.push(`- Linked artifacts: ${extraArtifacts.join(", ")}`);
  }

  appendText(path.join(workspacePath, relativePath), `${lines.join("\n")}\n`);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizeTraceText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed != null && trimmed.length > 0 ? trimmed : fallback;
}

function requireTraceInput(value: string | undefined, fieldName: string): string {
  const trimmed = value?.trim();
  if (trimmed == null || trimmed.length === 0) {
    throw new Error(`${fieldName} is required for request/process/result traceability.`);
  }
  return trimmed;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildTaskTrace(params: {
  originalRequest?: string;
  fallbackOriginalRequest: string;
  processSummary?: string;
  fallbackProcessSummary: string;
  resultSummary?: string;
  fallbackResultSummary: string;
  recordedAt: string;
  source: string;
}): HarnessTaskTrace {
  return {
    originalRequest: normalizeTraceText(
      params.originalRequest,
      params.fallbackOriginalRequest
    ),
    processSummary: normalizeTraceText(
      params.processSummary,
      params.fallbackProcessSummary
    ),
    resultSummary: normalizeTraceText(
      params.resultSummary,
      params.fallbackResultSummary
    ),
    recordedAt: params.recordedAt,
    source: params.source,
  };
}

function requireTaskTrace(params: {
  originalRequest?: string;
  fallbackOriginalRequest: string;
  processSummary?: string;
  resultSummary?: string;
  recordedAt: string;
  source: string;
}): HarnessTaskTrace {
  return {
    originalRequest: normalizeTraceText(
      params.originalRequest,
      params.fallbackOriginalRequest
    ),
    processSummary: requireTraceInput(params.processSummary, "processSummary"),
    resultSummary: requireTraceInput(params.resultSummary, "resultSummary"),
    recordedAt: params.recordedAt,
    source: params.source,
  };
}

function validateTaskTraceShape(
  trace: unknown,
  label: string,
  errors: string[]
): void {
  if (!isPlainObject(trace)) {
    errors.push(`${label}.taskTrace must be an object`);
    return;
  }
  for (const field of [
    "originalRequest",
    "processSummary",
    "resultSummary",
    "recordedAt",
    "source",
  ]) {
    if (!isString(trace[field]) || trace[field].trim().length === 0) {
      errors.push(`${label}.taskTrace.${field} must be a non-empty string`);
    }
  }
}

function validateSessionTraceQuality(
  session: HarnessRuntimeSessionState,
  label: string,
  errors: string[]
): void {
  if (!isPlainObject(session.requestRecord)) {
    errors.push(`${label}.requestRecord must be an object`);
  } else {
    for (const field of ["originalRequest", "normalizedGoal", "capturedAt", "source"]) {
      if (
        !isString(session.requestRecord[field as keyof typeof session.requestRecord]) ||
        String(session.requestRecord[field as keyof typeof session.requestRecord]).trim().length === 0
      ) {
        errors.push(`${label}.requestRecord.${field} must be a non-empty string`);
      }
    }
  }

  if (!Array.isArray(session.events)) {
    errors.push(`${label}.events must be an array`);
    return;
  }

  for (const [index, event] of session.events.entries()) {
    validateTaskTraceShape(event.taskTrace, `${label}.events[${index}]`, errors);
  }
}

function appendHarnessDashboardLedgerEvent(params: {
  workspacePath: string;
  eventType: string;
  sourceTool: string;
  session: HarnessRuntimeSessionState;
  payload: Record<string, unknown>;
  causationId?: string | null;
  idempotencyKey: string;
  recordedAt: string;
}): string | null {
  const ledgerPath = path.join(params.workspacePath, HARNESS_DASHBOARD_LEDGER_PATH);
  const manifestPath = path.join(
    params.workspacePath,
    HARNESS_DASHBOARD_LEDGER_MANIFEST_PATH
  );
  const manifest = readJsonIfExists<Record<string, unknown>>(manifestPath);
  if (manifest == null || !fs.existsSync(ledgerPath)) {
    return null;
  }

  const lastSequence = Number(manifest.lastSequence || 0);
  const sequence = lastSequence + 1;
  const payloadHash = stableHash(params.payload);
  const workspaceId =
    typeof manifest.workspaceId === "string"
      ? manifest.workspaceId
      : params.session.workspace.name;
  const event = {
    eventId: `event-${String(sequence).padStart(6, "0")}-${params.eventType.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase()}`,
    sequence,
    eventType: params.eventType,
    eventVersion: "1.0.0",
    workspaceId,
    aggregateId: params.session.session.id,
    aggregateType: "harnessRuntimeSession",
    aggregateVersion: params.session.events.length,
    occurredAt: params.recordedAt,
    recordedAt: params.recordedAt,
    actor: params.session.session.nextActor,
    agentId: "workspace-init-mcp",
    sourceTool: params.sourceTool,
    correlationId: params.session.session.id,
    causationId: params.causationId ?? null,
    idempotencyKey: params.idempotencyKey,
    payloadHash,
    previousEventHash: String(manifest.rootHash || "genesis"),
    redactionLevel: "internal",
    payload: params.payload,
  };
  const record = {
    ...event,
    eventHash: stableHash(event),
  };

  appendText(ledgerPath, `${JSON.stringify(record)}\n`);
  const nextManifest = {
    ...manifest,
    firstSequence: Number(manifest.firstSequence || 1),
    lastSequence: sequence,
    rowCount: Number(manifest.rowCount || lastSequence) + 1,
    rootHash: record.eventHash,
    lastVerifiedAt: params.recordedAt,
    segments: Array.isArray(manifest.segments)
      ? (manifest.segments as Array<Record<string, unknown>>).map((segment, index) =>
          index === 0
            ? {
                ...segment,
                lastSequence: sequence,
                rowCount: Number(segment.rowCount || lastSequence) + 1,
                segmentHash: record.eventHash,
              }
            : segment
        )
      : [
          {
            id: `segment-000001-${String(sequence).padStart(6, "0")}`,
            path: HARNESS_DASHBOARD_LEDGER_PATH,
            firstSequence: 1,
            lastSequence: sequence,
            rowCount: sequence,
            schemaVersion: manifest.schemaVersion ?? "1.0.0",
            segmentHash: record.eventHash,
            compactionStatus: "hot",
          },
        ],
  };
  writeJson(manifestPath, nextManifest);
  return record.eventId;
}

function fallbackRequestRecord(session: HarnessRuntimeSessionState): HarnessRuntimeSessionState["requestRecord"] {
  return {
    originalRequest: session.session.goal,
    normalizedGoal: session.session.goal,
    capturedAt: session.session.createdAt,
    source: "legacy-session-fallback",
  };
}

function getSessionRequestRecord(
  session: HarnessRuntimeSessionState
): HarnessRuntimeSessionState["requestRecord"] {
  return session.requestRecord ?? fallbackRequestRecord(session);
}

function lookupCommandPath(commandName: string): string | null {
  try {
    const locator = process.platform === "win32" ? "where" : "which";
    const output = execFileSync(locator, [commandName], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    return output ?? null;
  } catch {
    return null;
  }
}

function detectNativeExecutor(
  executor: HarnessNativeExecutorDescriptor
): { commandPath: string | null; version: string | null } {
  for (const candidate of executor.commandCandidates) {
    const commandPath = lookupCommandPath(candidate);
    if (commandPath == null) {
      continue;
    }

    let version: string | null = null;
    if (executor.versionArgs.length > 0) {
      try {
        version = execFileSync(commandPath, executor.versionArgs, {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        })
          .split(/\r?\n/)[0]
          ?.trim() ?? null;
      } catch {
        version = null;
      }
    }

    return { commandPath, version };
  }

  return { commandPath: null, version: null };
}

function applyArgumentTemplate(
  template: string[],
  replacements: Record<string, string>
): string[] {
  return template.map((value) =>
    value.replace(/\{([a-zA-Z0-9]+)\}/g, (_, key: string) => replacements[key] ?? "")
  );
}

function buildHandoffInstruction(handoffMarkdownRelativePath: string): string {
  return `Open and follow ${handoffMarkdownRelativePath}. Read the referenced work packet and actor inbox before editing, keep work within the approved chunk, and continue the governed session in this workspace with durable evidence in files.`;
}

function appendLogHeader(fullPath: string, lines: string[]): void {
  ensureDir(path.dirname(fullPath));
  fs.appendFileSync(fullPath, `${lines.join("\n")}\n`, "utf-8");
}

function isProcessRunning(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}

function terminateProcessTree(processId: number): void {
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(processId), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      return;
    } catch {
      // Fall through to a direct kill attempt.
    }
  } else {
    try {
      process.kill(-processId, "SIGTERM");
      return;
    } catch {
      // Detached process groups are best-effort across platforms.
    }
  }

  try {
    process.kill(processId, "SIGTERM");
  } catch {
    // The process may already be gone.
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateRuntimeIndexShape(value: unknown): HarnessRuntimeValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(value)) {
    return {
      valid: false,
      errors: ["runtime session index must be an object"],
    };
  }

  if (!isString(value.schemaVersion)) {
    errors.push("runtime session index.schemaVersion must be a string");
  }
  if (!isString(value.updatedAt)) {
    errors.push("runtime session index.updatedAt must be a string");
  }
  if (value.activeSessionId != null && !isString(value.activeSessionId)) {
    errors.push("runtime session index.activeSessionId must be a string or null");
  }
  if (!Array.isArray(value.queuedSessionIds) || value.queuedSessionIds.some((item) => !isString(item))) {
    errors.push("runtime session index.queuedSessionIds must be an array of strings");
  }
  if (!isPlainObject(value.lease)) {
    errors.push("runtime session index.lease must be an object");
  } else {
    if (!isString(value.lease.status)) {
      errors.push("runtime session index.lease.status must be a string");
    }
    if (value.lease.activeSessionId != null && !isString(value.lease.activeSessionId)) {
      errors.push("runtime session index.lease.activeSessionId must be a string or null");
    }
    if (value.lease.leasedAt != null && !isString(value.lease.leasedAt)) {
      errors.push("runtime session index.lease.leasedAt must be a string or null");
    }
    if (!isFiniteNumber(value.lease.queueDepth)) {
      errors.push("runtime session index.lease.queueDepth must be a number");
    }
  }
  if (!Array.isArray(value.sessions)) {
    errors.push("runtime session index.sessions must be an array");
  } else {
    for (const [index, entry] of value.sessions.entries()) {
      if (!isPlainObject(entry)) {
        errors.push(`runtime session index.sessions[${index}] must be an object`);
        continue;
      }
      for (const field of [
        "id",
        "title",
        "goal",
        "status",
        "currentPhase",
        "nextActor",
        "chunkId",
        "sessionPath",
        "summaryPath",
        "updatedAt",
      ]) {
        if (!isString(entry[field])) {
          errors.push(`runtime session index.sessions[${index}].${field} must be a string`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateActiveRuntimeShape(value: unknown): HarnessRuntimeValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(value)) {
    return {
      valid: false,
      errors: ["active runtime session snapshot must be an object"],
    };
  }

  for (const field of [
    "schemaVersion",
    "mode",
    "status",
    "currentPhase",
    "nextActor",
    "nextAction",
    "leaseStatus",
    "lastUpdatedAt",
  ]) {
    if (!isString(value[field])) {
      errors.push(`active runtime session.${field} must be a string`);
    }
  }
  if (value.leasedAt != null && !isString(value.leasedAt)) {
    errors.push("active runtime session.leasedAt must be a string or null");
  }
  if (!isFiniteNumber(value.queueDepth)) {
    errors.push("active runtime session.queueDepth must be a number");
  }
  if (
    !Array.isArray(value.queuedSessionIds) ||
    value.queuedSessionIds.some((item) => !isString(item))
  ) {
    errors.push("active runtime session.queuedSessionIds must be an array of strings");
  }
  if (value.activeSessionId != null && !isString(value.activeSessionId)) {
    errors.push("active runtime session.activeSessionId must be a string or null");
  }
  if (value.activeSessionId == null) {
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  if (!isPlainObject(value.session)) {
    errors.push("active runtime session.session must be an object when activeSessionId is set");
  } else {
    const sessionValue = value.session;
    if (!isPlainObject(sessionValue.session)) {
      errors.push("active runtime session.session.session must be an object");
    } else {
      if (!isString(sessionValue.session.id)) {
        errors.push("active runtime session.session.session.id must be a string");
      } else if (sessionValue.session.id !== value.activeSessionId) {
        errors.push("active runtime session.session.session.id must match activeSessionId");
      }
      if (!isString(sessionValue.session.currentPhase)) {
        errors.push("active runtime session.session.session.currentPhase must be a string");
      }
      if (!isString(sessionValue.session.nextActor)) {
        errors.push("active runtime session.session.session.nextActor must be a string");
      }
    }
    if (!Array.isArray(sessionValue.phases)) {
      errors.push("active runtime session.session.phases must be an array");
    }
    if (!Array.isArray(sessionValue.events)) {
      errors.push("active runtime session.session.events must be an array");
    } else {
      validateSessionTraceQuality(
        sessionValue as unknown as HarnessRuntimeSessionState,
        "active runtime session.session",
        errors
      );
    }
    if (
      !isPlainObject(sessionValue.governance) ||
      !isBoolean(sessionValue.governance.opened)
    ) {
      errors.push("active runtime session.session.governance.opened must be a boolean");
    }
    if (
      !isPlainObject(sessionValue.context) ||
      !isFiniteNumber(sessionValue.context.resetCount)
    ) {
      errors.push("active runtime session.session.context.resetCount must be a number");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateCurrentWorkPacketShape(
  value: unknown
): HarnessRuntimeValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(value)) {
    return {
      valid: false,
      errors: ["current runtime work packet must be an object"],
    };
  }

  for (const field of [
    "schemaVersion",
    "generatedAt",
    "leaseStatus",
    "nextActor",
    "nextAction",
    "summary",
  ]) {
    if (!isString(value[field])) {
      errors.push(`current runtime work packet.${field} must be a string`);
    }
  }
  for (const nullableField of ["activeSessionId", "workPacketFile", "actorInboxFile"]) {
    if (value[nullableField] != null && !isString(value[nullableField])) {
      errors.push(`current runtime work packet.${nullableField} must be a string or null`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateCurrentExecutionBridgeShape(
  value: unknown
): HarnessRuntimeValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(value)) {
    return {
      valid: false,
      errors: ["current execution bridge must be an object"],
    };
  }

  for (const field of ["schemaVersion", "generatedAt", "launchMode", "summary"]) {
    if (!isString(value[field])) {
      errors.push(`current execution bridge.${field} must be a string`);
    }
  }
  for (const nullableField of ["activeSessionId", "bridgeId", "bridgeManifestFile"]) {
    if (value[nullableField] != null && !isString(value[nullableField])) {
      errors.push(`current execution bridge.${nullableField} must be a string or null`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateCurrentNativeExecutionShape(
  value: unknown
): HarnessRuntimeValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(value)) {
    return {
      valid: false,
      errors: ["current native execution state must be an object"],
    };
  }

  for (const field of ["schemaVersion", "generatedAt", "status", "launchMode", "summary"]) {
    if (!isString(value[field])) {
      errors.push(`current native execution.${field} must be a string`);
    }
  }
  for (const nullableField of [
    "activeSessionId",
    "bridgeId",
    "nativeExecutionPlanFile",
    "nativeExecutionStateFile",
    "stdoutLogFile",
    "stderrLogFile",
    "executablePath",
  ]) {
    if (value[nullableField] != null && !isString(value[nullableField])) {
      errors.push(`current native execution.${nullableField} must be a string or null`);
    }
  }
  if (value.processId != null && !isFiniteNumber(value.processId)) {
    errors.push("current native execution.processId must be a number or null");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function auditHarnessRuntime(
  workspacePath: string
): AuditHarnessRuntimeResult {
  const paths = buildRuntimePaths(workspacePath);
  const jsonErrors: string[] = [];
  const sessionIndexPayload = readJsonForRuntimeAudit<HarnessSessionIndex>(
    paths.sessionIndexPath,
    "session-index.json",
    jsonErrors
  );
  const activeRuntimePayload = readJsonForRuntimeAudit(
    paths.activeSessionPath,
    "active-session.json",
    jsonErrors
  );
  const currentWorkPacketPayload = readJsonForRuntimeAudit(
    paths.currentWorkPacketPath,
    "current-work-packet.json",
    jsonErrors
  );
  const currentExecutionBridgePayload = readJsonForRuntimeAudit(
    paths.currentExecutionBridgePath,
    "current-execution-bridge.json",
    jsonErrors
  );
  const currentNativeExecutionPayload = readJsonForRuntimeAudit(
    paths.currentNativeExecutionPath,
    "current-native-execution.json",
    jsonErrors
  );
  const indexValidation = validateRuntimeIndexShape(
    sessionIndexPayload
  );
  const activeValidation = validateActiveRuntimeShape(
    activeRuntimePayload
  );
  const currentWorkPacketValidation = validateCurrentWorkPacketShape(
    currentWorkPacketPayload
  );
  const currentExecutionBridgeValidation = validateCurrentExecutionBridgeShape(
    currentExecutionBridgePayload
  );
  const currentNativeExecutionValidation = validateCurrentNativeExecutionShape(
    currentNativeExecutionPayload
  );
  const errors = [
    ...jsonErrors,
    ...indexValidation.errors.map((error) => `session-index.json: ${error}`),
    ...activeValidation.errors.map((error) => `active-session.json: ${error}`),
    ...currentWorkPacketValidation.errors.map(
      (error) => `current-work-packet.json: ${error}`
    ),
    ...currentExecutionBridgeValidation.errors.map(
      (error) => `current-execution-bridge.json: ${error}`
    ),
    ...currentNativeExecutionValidation.errors.map(
      (error) => `current-native-execution.json: ${error}`
    ),
  ];
  const warnings: string[] = [];

  if (!indexValidation.valid) {
    return {
      valid: false,
      errors,
      warnings,
      summary: [
        "Harness runtime audit failed.",
        ...errors.map((error) => `  - ${error}`),
      ].join("\n"),
    };
  }

  const index = sessionIndexPayload as HarnessSessionIndex;
  const sessionFiles = fs.existsSync(paths.sessionsRoot)
    ? fs
        .readdirSync(paths.sessionsRoot)
        .filter((name) => name.endsWith(".session.json"))
    : [];
  const indexedIds = new Set(index.sessions.map((entry) => entry.id));
  const queuedIds = new Set(index.queuedSessionIds);

  if (
    index.activeSessionId != null &&
    !index.sessions.some((entry) => entry.id === index.activeSessionId)
  ) {
    errors.push(
      `session-index.json: activeSessionId "${index.activeSessionId}" does not exist in sessions[]`
    );
  }
  if (
    index.lease.activeSessionId !== index.activeSessionId ||
    index.lease.queueDepth !== index.queuedSessionIds.length
  ) {
    errors.push(
      "session-index.json: lease metadata is not aligned with activeSessionId or queuedSessionIds"
    );
  }

  for (const queuedId of queuedIds) {
    if (!indexedIds.has(queuedId)) {
      errors.push(`session-index.json: queued session "${queuedId}" is not registered in sessions[]`);
    }
  }

  for (const entry of index.sessions) {
    const fullPath = buildSessionStatePath(workspacePath, entry.id);
    const expectedSessionPath = relativeToWorkspace(workspacePath, fullPath);
    const expectedSummaryPath = relativeToWorkspace(
      workspacePath,
      buildSessionSummaryPath(workspacePath, entry.id)
    );
    if (normalizeWorkspaceRelativePath(entry.sessionPath) !== expectedSessionPath) {
      errors.push(
        `session-index.json: sessionPath for "${entry.id}" must be ${expectedSessionPath}`
      );
    }
    if (normalizeWorkspaceRelativePath(entry.summaryPath) !== expectedSummaryPath) {
      errors.push(
        `session-index.json: summaryPath for "${entry.id}" must be ${expectedSummaryPath}`
      );
    }
    if (!fs.existsSync(fullPath)) {
      errors.push(`session-index.json: session file missing for "${entry.id}" at ${expectedSessionPath}`);
      continue;
    }

    const session = readJsonForRuntimeAudit<HarnessRuntimeSessionState>(
      fullPath,
      `session-index.json: session file for "${entry.id}"`,
      errors
    );
    if (session == null) {
      errors.push(`session-index.json: session file for "${entry.id}" could not be loaded`);
      continue;
    }
    if (session.session.id !== entry.id) {
      errors.push(`session-index.json: session "${entry.id}" does not match file payload id "${session.session.id}"`);
    }
    validateSessionTraceQuality(
      session,
      `session-index.json: session file for "${entry.id}"`,
      errors
    );
    if (session.session.currentPhase !== entry.currentPhase) {
      warnings.push(
        `session-index.json: currentPhase for "${entry.id}" is "${entry.currentPhase}" but session file has "${session.session.currentPhase}"`
      );
    }
    if (session.chunk.id !== entry.chunkId) {
      warnings.push(
        `session-index.json: chunkId for "${entry.id}" is "${entry.chunkId}" but session file has "${session.chunk.id}"`
      );
    }
  }

  for (const fileName of sessionFiles) {
    const sessionId = fileName.replace(/\.session\.json$/, "");
    if (!indexedIds.has(sessionId)) {
      warnings.push(`runtime session file "${fileName}" exists but is not referenced by session-index.json`);
    }
  }

  const activeSnapshot = activeRuntimePayload as Record<string, unknown> | null;
  const currentWorkPacket = currentWorkPacketPayload as Record<string, unknown> | null;
  const currentExecutionBridge = currentExecutionBridgePayload as Record<
    string,
    unknown
  > | null;
  if (index.activeSessionId == null) {
    if (isPlainObject(activeSnapshot) && activeSnapshot.activeSessionId != null) {
      errors.push("active-session.json: expected no activeSessionId while the index is idle");
    }
    if (
      isPlainObject(currentWorkPacket) &&
      currentWorkPacket.activeSessionId != null &&
      currentWorkPacket.leaseStatus !== "idle"
    ) {
      errors.push(
        "current-work-packet.json: expected an idle packet while the runtime lease is idle"
      );
    }
    if (
      isPlainObject(currentExecutionBridge) &&
      (currentExecutionBridge.activeSessionId != null ||
        currentExecutionBridge.bridgeManifestFile != null)
    ) {
      warnings.push(
        "current-execution-bridge.json still points to a previous launch bundle while no runtime lease is active"
      );
    }
  } else if (
    !isPlainObject(activeSnapshot) ||
    activeSnapshot.activeSessionId !== index.activeSessionId
  ) {
    errors.push(
      `active-session.json: activeSessionId must match session-index.json (${index.activeSessionId})`
    );
  } else if (
    !isPlainObject(currentWorkPacket) ||
    currentWorkPacket.activeSessionId !== index.activeSessionId
  ) {
    errors.push(
      `current-work-packet.json: activeSessionId must match session-index.json (${index.activeSessionId})`
    );
  } else if (
    isPlainObject(currentExecutionBridge) &&
    currentExecutionBridge.activeSessionId != null &&
    currentExecutionBridge.activeSessionId !== index.activeSessionId
  ) {
    errors.push(
      `current-execution-bridge.json: activeSessionId must match session-index.json (${index.activeSessionId}) when populated`
    );
  }

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    warnings,
    summary: [
      valid ? "Harness runtime audit passed." : "Harness runtime audit failed.",
      `  - registered sessions: ${index.sessions.length}`,
      `  - queued sessions: ${index.queuedSessionIds.length}`,
      `  - active session: ${index.activeSessionId ?? "none"}`,
      ...(errors.length > 0 ? errors.map((error) => `  - error: ${error}`) : []),
      ...(warnings.length > 0 ? warnings.map((warning) => `  - warning: ${warning}`) : []),
    ].join("\n"),
  };
}

function pathScopesOverlap(leftPath: string, rightPath: string): boolean {
  const left = normalizeWorkspaceRelativePath(leftPath).toLowerCase();
  const right = normalizeWorkspaceRelativePath(rightPath).toLowerCase();
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function integrationSensitiveSurfaceForPath(workspaceRelativePath: string): string | null {
  const normalized = normalizeWorkspaceRelativePath(workspaceRelativePath).toLowerCase();
  const basename = normalized.split("/").pop() ?? normalized;

  if (
    [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "bun.lock",
      "bun.lockb",
      "requirements.txt",
      "poetry.lock",
      "pyproject.toml",
      "cargo.toml",
      "cargo.lock",
      "go.mod",
      "go.sum",
    ].includes(basename)
  ) {
    return "dependency manifest or lockfile";
  }

  if (
    normalized.startsWith(".github/workflows/") ||
    normalized.startsWith(".gitlab-ci") ||
    normalized === "azure-pipelines.yml" ||
    normalized === "bitbucket-pipelines.yml"
  ) {
    return "CI/CD workflow";
  }

  if (
    normalized.startsWith("migrations/") ||
    normalized.includes("/migrations/") ||
    normalized.startsWith("supabase/") ||
    normalized.startsWith("prisma/") ||
    normalized.includes("schema.sql") ||
    normalized.endsWith(".prisma")
  ) {
    return "database schema or migration";
  }

  if (
    normalized.includes("openapi") ||
    normalized.includes("swagger") ||
    normalized.endsWith(".proto") ||
    normalized.includes("/api/") ||
    normalized.includes("/contracts/")
  ) {
    return "API contract";
  }

  if (
    basename.startsWith("tsconfig") ||
    basename.startsWith("vite.config") ||
    basename.startsWith("webpack.config") ||
    basename.startsWith("rollup.config") ||
    basename.startsWith("next.config") ||
    basename.startsWith("eslint.config") ||
    basename === ".eslintrc" ||
    basename === ".prettierrc" ||
    normalized.startsWith(".vscode/")
  ) {
    return "shared project configuration";
  }

  return null;
}

export function auditHarnessParallelChunkConflicts(
  workspacePath: string
): AuditHarnessParallelChunkConflictsResult {
  const index = loadRuntimeIndex(workspacePath);
  const errors: string[] = [];
  const sessions = index.sessions
    .filter((entry) => entry.status !== "closed")
    .map((entry) => {
      const session = readJsonIfExists<HarnessRuntimeSessionState>(
        buildSessionStatePath(workspacePath, entry.id)
      );
      let expectedWritePaths: string[] = [];
      if (Array.isArray(session?.chunk.expectedWritePaths)) {
        try {
          expectedWritePaths = normalizeSafeWorkspaceRelativePaths(
            session.chunk.expectedWritePaths.map((item) => String(item)),
            `expectedWritePaths for session "${entry.id}"`
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          errors.push(
            `Session "${entry.id}" has unsafe expectedWritePaths: ${detail}`
          );
        }
      }
      return {
        sessionId: entry.id,
        chunkId: session?.chunk.id ?? entry.chunkId,
        status: entry.status,
        expectedWritePaths,
        expectedReadPaths: Array.isArray(session?.chunk.expectedReadPaths)
          ? session.chunk.expectedReadPaths.map((item) => String(item))
          : [],
        dependencyNotes: String(session?.chunk.dependencyNotes ?? ""),
        parallelSafetyStatus: String(
          session?.chunk.parallelSafetyStatus ?? "unclassified"
        ),
        mergeOwner:
          typeof session?.chunk.mergeOwner === "string"
            ? session.chunk.mergeOwner
            : null,
        integrationOwner:
          typeof session?.chunk.integrationOwner === "string"
            ? session.chunk.integrationOwner
            : null,
      };
    });
  const conflicts: AuditHarnessParallelChunkConflictsResult["conflicts"] = [];
  const warnings: string[] = [];

  for (const session of sessions) {
    if (
      (session.parallelSafetyStatus === "parallel-ready" ||
        /parallel-ready/i.test(session.dependencyNotes)) &&
      session.expectedWritePaths.length === 0
    ) {
      warnings.push(
        `Session "${session.sessionId}" is marked parallel-ready but has no expectedWritePaths.`
      );
    }
  }

  const integrationSurfaceOwners = new Map<
    string,
    Array<{ sessionId: string; chunkId: string; path: string }>
  >();

  for (const session of sessions) {
    for (const writePath of session.expectedWritePaths) {
      const surface = integrationSensitiveSurfaceForPath(writePath);
      if (surface == null) {
        continue;
      }
      const owners = integrationSurfaceOwners.get(surface) ?? [];
      owners.push({
        sessionId: session.sessionId,
        chunkId: session.chunkId,
        path: writePath,
      });
      integrationSurfaceOwners.set(surface, owners);

      if (
        (session.parallelSafetyStatus === "parallel-ready" ||
          /parallel-ready/i.test(session.dependencyNotes)) &&
        session.mergeOwner == null &&
        session.integrationOwner == null &&
        !/merge owner|integration owner|sequential/i.test(session.dependencyNotes)
      ) {
        warnings.push(
          `Session "${session.sessionId}" is parallel-ready but writes ${surface} path "${writePath}" without an explicit merge/integration owner.`
        );
      }
    }
  }

  for (const [surface, owners] of integrationSurfaceOwners.entries()) {
    const uniqueSessions = new Set(owners.map((owner) => owner.sessionId));
    if (uniqueSessions.size > 1) {
      warnings.push(
        `Multiple open or queued sessions touch ${surface}: ${owners
          .map((owner) => `${owner.sessionId}/${owner.chunkId}:${owner.path}`)
          .join(", ")}. Treat these as sequential or assign one merge owner even when paths do not textually overlap.`
      );
    }
  }

  for (let leftIndex = 0; leftIndex < sessions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sessions.length; rightIndex += 1) {
      const left = sessions[leftIndex];
      const right = sessions[rightIndex];
      for (const leftPath of left.expectedWritePaths) {
        for (const rightPath of right.expectedWritePaths) {
          if (pathScopesOverlap(leftPath, rightPath)) {
            conflicts.push({
              leftSessionId: left.sessionId,
              leftChunkId: left.chunkId,
              leftPath,
              rightSessionId: right.sessionId,
              rightChunkId: right.chunkId,
              rightPath,
              reason:
                leftPath === rightPath
                  ? "same expected write path"
                  : "parent/child expected write path overlap",
            });
          }
        }
      }
    }
  }

  return {
    valid: conflicts.length === 0 && errors.length === 0,
    sessions,
    conflicts,
    errors,
    warnings,
    summary: [
      conflicts.length === 0 && errors.length === 0
        ? "Harness parallel chunk conflict audit passed."
        : "Harness parallel chunk conflict audit failed.",
      `  - open or queued sessions: ${sessions.length}`,
      `  - conflicts: ${conflicts.length}`,
      `  - errors: ${errors.length}`,
      `  - warnings: ${warnings.length}`,
      ...errors.map((error) => `  - error: ${error}`),
      ...conflicts.map(
        (conflict) =>
          `  - conflict: ${conflict.leftSessionId}/${conflict.leftChunkId} ${conflict.leftPath} overlaps ${conflict.rightSessionId}/${conflict.rightChunkId} ${conflict.rightPath} (${conflict.reason})`
      ),
      ...warnings.map((warning) => `  - warning: ${warning}`),
    ].join("\n"),
  };
}

export function validateHarnessRuntimeFiles(
  workspacePath: string
): HarnessRuntimeValidationResult {
  const audit = auditHarnessRuntime(workspacePath);

  return {
    valid: audit.valid,
    errors: audit.errors,
  };
}

export function compactHarnessRuntime(
  params: CompactHarnessRuntimeParams
): CompactHarnessRuntimeResult {
  const keepRecentClosed = Math.max(0, params.keepRecentClosed ?? 10);
  const maxArchiveSessions = Math.max(1, params.maxArchiveSessions ?? 25);
  const workspacePath = params.workspacePath;
  const paths = buildRuntimePaths(workspacePath);
  const index = loadRuntimeIndex(workspacePath);
  const archiveIndex = loadArchiveIndex(workspacePath);
  const queuedIds = new Set(index.queuedSessionIds);
  const closedEntries = index.sessions
    .filter(
      (entry) =>
        entry.status === "closed" &&
        entry.id !== index.activeSessionId &&
        !queuedIds.has(entry.id)
    )
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  const archiveableCount = Math.max(0, closedEntries.length - keepRecentClosed);

  if (archiveableCount === 0) {
    return {
      archivedSessionIds: [],
      archiveIndexPath: relativeToWorkspace(workspacePath, paths.archiveIndexPath),
      remainingRegisteredSessions: index.sessions.length,
      summary: [
        "Harness runtime compaction not required.",
        `Closed sessions eligible: ${closedEntries.length}`,
        `Keep recent closed: ${keepRecentClosed}`,
        "Archived sessions: 0",
      ].join("\n"),
    };
  }

  const entriesToArchive = closedEntries.slice(
    0,
    Math.min(archiveableCount, maxArchiveSessions)
  );
  const archivedAt = nowIso();
  const archiveId = `archive-${archivedAt
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14)}-${entriesToArchive.length}`;
  const bundlePaths = buildRuntimeArchiveBundlePaths(workspacePath, archiveId);
  const archivedSessionIds: string[] = [];
  const archiveSessions = entriesToArchive.map((entry) => {
    const sourceSessionPath = buildSessionStatePath(workspacePath, entry.id);
    const sourceSummaryPath = buildSessionSummaryPath(workspacePath, entry.id);
    const archivedSessionPath = buildArchivedSessionStatePath(workspacePath, entry.id);
    const archivedSummaryPath = buildArchivedSessionSummaryPath(workspacePath, entry.id);
    const session = readJsonIfExists<HarnessRuntimeSessionState>(sourceSessionPath);

    ensureDir(path.dirname(archivedSessionPath));
    ensureDir(path.dirname(archivedSummaryPath));

    if (fs.existsSync(sourceSessionPath)) {
      fs.renameSync(sourceSessionPath, archivedSessionPath);
    }
    if (fs.existsSync(sourceSummaryPath)) {
      fs.renameSync(sourceSummaryPath, archivedSummaryPath);
    }

    archivedSessionIds.push(entry.id);

    return {
      id: entry.id,
      title: entry.title,
      goal: entry.goal,
      updatedAt: entry.updatedAt,
      currentPhase: entry.currentPhase,
      archivedSessionFile: relativeToWorkspace(workspacePath, archivedSessionPath),
      archivedSummaryFile: relativeToWorkspace(workspacePath, archivedSummaryPath),
      eventCount: session?.events.length ?? 0,
      artifactCount: session?.artifacts.length ?? 0,
    };
  });

  index.sessions = index.sessions.filter(
    (entry) => !archivedSessionIds.includes(entry.id)
  );
  index.updatedAt = archivedAt;
  index.lease.queueDepth = index.queuedSessionIds.length;
  index.note = `Runtime compacted at ${archivedAt}; archived ${archivedSessionIds.length} closed sessions.`;
  writeJson(paths.sessionIndexPath, index);

  const archiveBundle = {
    schemaVersion: "1.0.0",
    id: archiveId,
    archivedAt,
    archivedSessionIds,
    keepRecentClosed,
    reason:
      params.reason?.trim() ||
      "Archive older closed runtime sessions to keep active ledgers readable.",
    sessions: archiveSessions,
  };
  writeJson(bundlePaths.bundlePath, archiveBundle);
  fs.writeFileSync(
    bundlePaths.summaryPath,
    buildRuntimeArchiveSummaryMarkdown(archiveBundle),
    "utf-8"
  );

  archiveIndex.updatedAt = archivedAt;
  archiveIndex.totalArchivedSessions += archivedSessionIds.length;
  archiveIndex.bundles.push({
    id: archiveId,
    archivedAt,
    archivedSessionIds,
    keepRecentClosed,
    reason: archiveBundle.reason,
    bundlePath: relativeToWorkspace(workspacePath, bundlePaths.bundlePath),
    summaryPath: relativeToWorkspace(workspacePath, bundlePaths.summaryPath),
  });
  writeJson(paths.archiveIndexPath, archiveIndex);

  syncDashboardRuntimeArchive(
    workspacePath,
    archiveId,
    archivedSessionIds,
    relativeToWorkspace(workspacePath, paths.archiveIndexPath),
    relativeToWorkspace(workspacePath, bundlePaths.bundlePath),
    relativeToWorkspace(workspacePath, bundlePaths.summaryPath)
  );

  return {
    archivedSessionIds,
    archiveIndexPath: relativeToWorkspace(workspacePath, paths.archiveIndexPath),
    archiveBundlePath: relativeToWorkspace(workspacePath, bundlePaths.bundlePath),
    archiveSummaryPath: relativeToWorkspace(workspacePath, bundlePaths.summaryPath),
    remainingRegisteredSessions: index.sessions.length,
    summary: [
      "Harness runtime compaction complete.",
      `Archive bundle: ${relativeToWorkspace(workspacePath, bundlePaths.bundlePath)}`,
      `Archive summary: ${relativeToWorkspace(workspacePath, bundlePaths.summaryPath)}`,
      `Archived sessions: ${archivedSessionIds.join(", ")}`,
      `Remaining registered sessions: ${index.sessions.length}`,
    ].join("\n"),
  };
}

function buildSessionSummaryMarkdown(session: HarnessRuntimeSessionState): string {
  const recentEvents = session.events.slice(-8).reverse();
  const activePhase = session.phases.find(
    (phase) => phase.id === session.session.currentPhase
  );
  const requestRecord = getSessionRequestRecord(session);

  return `# ${session.session.title}

- Session ID: \`${session.session.id}\`
- Goal: ${session.session.goal}
- Original request: ${requestRecord.originalRequest}
- Status: ${session.session.status}
- Adoption track: ${session.session.adoptionTrack}
- Current phase: \`${session.session.currentPhase}\`
- Next actor: ${session.session.nextActor}
- Chunk: \`${session.chunk.id}\` (${session.chunk.title})
- Dependency notes: ${session.chunk.dependencyNotes ?? "unclassified"}
- Context injection: ${session.chunk.contextInjectionNotes ?? "use generated work packet defaults"}
- Context resets: ${session.context.resetCount}

## Current Instruction

${session.notes.current}

## Governance

- Latest plan round: ${session.governance.latestPlanRound}
- Latest review round: ${session.governance.latestReviewRound}
- Goal frozen: ${session.governance.goalFrozen ? "yes" : "no"}
- Contract approved: ${session.governance.contractApproved ? "yes" : "no"}
- Independent evaluation passed: ${session.governance.independentEvaluationPassed ? "yes" : "no"}
- Governance refreshed: ${session.governance.governanceRefreshed ? "yes" : "no"}
- Closeout ready: ${session.governance.closeoutReady ? "yes" : "no"}

## Verification

- Tests: ${session.verification.testsStatus}
- Review: ${session.verification.reviewStatus}
- Remediation: ${session.verification.remediationStatus}
- Commands: ${(session.chunk.verificationCommands ?? []).join(", ") || "not specified"}
- Atomic commit policy: one logical change per chunk or remediation with a traceable session/chunk reference

## Active Phase Artifact

${activePhase?.artifactPath ?? "n/a"}

## Runtime Artifacts

${session.artifacts.map((artifact) => `- ${artifact}`).join("\n") || "- none"}

## Request / Process / Result Trace

${recentEvents
  .map((event) => {
    const trace = event.taskTrace ?? {
      originalRequest: requestRecord.originalRequest,
      processSummary: event.note,
      resultSummary: event.outcome,
    };
    return [
      `- ${event.at} | ${event.phase} | ${event.actor} | ${event.action}`,
      `  - Original request: ${trace.originalRequest}`,
      `  - Process: ${trace.processSummary}`,
      `  - Result: ${trace.resultSummary}`,
    ].join("\n");
  })
  .join("\n") || "- none"}

## Recent Events

${recentEvents
  .map(
    (event) =>
      `- ${event.at} | ${event.phase} | ${event.actor} | ${event.action} | ${event.outcome} | ${event.note}`
  )
  .join("\n") || "- none"}
`;
}

function buildRuntimeArchiveSummaryMarkdown(archiveBundle: {
  id: string;
  archivedAt: string;
  archivedSessionIds: string[];
  keepRecentClosed: number;
  reason: string;
  sessions: Array<{
    id: string;
    title: string;
    goal: string;
    updatedAt: string;
    currentPhase: string;
    archivedSessionFile: string;
    archivedSummaryFile: string;
  }>;
}): string {
  return `# Runtime Archive ${archiveBundle.id}

- Archived at: ${archiveBundle.archivedAt}
- Sessions archived: ${archiveBundle.archivedSessionIds.length}
- Keep recent closed sessions: ${archiveBundle.keepRecentClosed}
- Reason: ${archiveBundle.reason}

## Archived Sessions

${archiveBundle.sessions
  .map(
    (session) =>
      `- \`${session.id}\` | ${session.title} | phase=${session.currentPhase} | updated=${session.updatedAt}\n  - Goal: ${session.goal}\n  - Archived state: ${session.archivedSessionFile}\n  - Archived summary: ${session.archivedSummaryFile}`
  )
  .join("\n") || "- none"}
`;
}

function buildDefaultSessionTitle(goal: string): string {
  const trimmed = goal.trim();
  if (trimmed.length <= 64) {
    return trimmed;
  }

  return `${trimmed.slice(0, 61)}...`;
}

function buildSessionId(provided: string | undefined, goal: string): string {
  if (provided != null && provided.trim().length > 0) {
    return normalizeRuntimePathSegment(provided, "sessionId");
  }

  const stamp = nowIso().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = slugify(goal) || "governed-work";
  return normalizeRuntimePathSegment(`session-${stamp}-${suffix}`, "sessionId");
}

function buildChunkId(
  provided: string | undefined,
  goal: string,
  sessionId: string
): string {
  if (provided != null && provided.trim().length > 0) {
    return normalizeRuntimePathSegment(provided, "chunkId");
  }

  return normalizeRuntimePathSegment(
    `chunk-${sessionId.replace(/^session-/, "")}-${slugify(goal) || "delivery"}`,
    "chunkId"
  );
}

function buildPhaseRecords(
  session: Pick<HarnessRuntimeSessionState, "session" | "chunk">,
  startedAt: string
): HarnessPhaseRecord[] {
  return PHASE_DEFINITIONS.map((definition) => {
    const artifactPath = phaseArtifactRelativePath(session, definition.id);
    if (definition.id === "governance-open") {
      return {
        id: definition.id,
        label: definition.label,
        actor: definition.actor,
        status: "complete",
        startedAt,
        completedAt: startedAt,
        attempts: 1,
        artifactPath,
        lastNote: "Governance scaffolding opened at session start.",
      };
    }

    if (definition.id === "plan-1") {
      return {
        id: definition.id,
        label: definition.label,
        actor: definition.actor,
        status: "active",
        startedAt,
        completedAt: null,
        attempts: 1,
        artifactPath,
        lastNote: "Plan 1 is ready for the planner.",
      };
    }

    return {
      id: definition.id,
      label: definition.label,
      actor: definition.actor,
      status: "pending",
      startedAt: null,
      completedAt: null,
      attempts: 0,
      artifactPath,
      lastNote: "",
    };
  });
}

function loadWorkspaceMetadata(workspacePath: string) {
  const dashboardPath = buildRuntimePaths(workspacePath).dashboardStatePath;
  const dashboardState = readJsonIfExists<Record<string, unknown>>(dashboardPath);
  const workspace = isPlainObject(dashboardState?.workspace)
    ? dashboardState.workspace
    : {};

  return {
    name: String(workspace.name || path.basename(workspacePath)),
    projectType: String(workspace.projectType || "other"),
    purpose: String(workspace.purpose || "Governed runtime delivery"),
  };
}

function loadSession(workspacePath: string, sessionId: string): HarnessRuntimeSessionState {
  const sessionPath = buildSessionStatePath(workspacePath, sessionId);
  const session = readJsonIfExists<HarnessRuntimeSessionState>(sessionPath);
  if (session == null) {
    throw new Error(`Harness session "${sessionId}" was not found.`);
  }
  return session;
}

function resolveSessionId(workspacePath: string, requestedSessionId?: string): string {
  if (requestedSessionId != null && requestedSessionId.trim().length > 0) {
    return normalizeRuntimePathSegment(requestedSessionId, "sessionId");
  }

  const index = ensureRuntimeIndex(workspacePath);
  if (index.activeSessionId == null) {
    throw new Error("No active harness session exists in this workspace.");
  }

  return normalizeRuntimePathSegment(index.activeSessionId, "sessionId");
}

function saveSession(
  workspacePath: string,
  session: HarnessRuntimeSessionState,
  options: {
    leaseMode: "assign-active" | "preserve-active" | "release-if-current";
    queueSession?: boolean;
    syncDashboard?: boolean;
  }
): {
  sessionPath: string;
  summaryPath: string;
  workPacketPath: string;
  workPacketMarkdownPath: string;
  actorInboxPath: string;
} {
  const sessionPath = buildSessionStatePath(workspacePath, session.session.id);
  const summaryPath = buildSessionSummaryPath(workspacePath, session.session.id);
  const index = ensureRuntimeIndex(workspacePath);
  const paths = buildRuntimePaths(workspacePath);
  const previousActiveSessionId = index.activeSessionId;

  writeJson(sessionPath, session);
  fs.writeFileSync(summaryPath, buildSessionSummaryMarkdown(session), "utf-8");

  const sessionEntry = {
    id: session.session.id,
    title: session.session.title,
    goal: session.session.goal,
    status: session.session.status,
    currentPhase: session.session.currentPhase,
    nextActor: session.session.nextActor,
    chunkId: session.chunk.id,
    sessionPath: relativeToWorkspace(workspacePath, sessionPath),
    summaryPath: relativeToWorkspace(workspacePath, summaryPath),
    updatedAt: session.session.updatedAt,
  };

  const existingIndex = index.sessions.findIndex((item) => item.id === session.session.id);
  if (existingIndex >= 0) {
    index.sessions[existingIndex] = sessionEntry;
  } else {
    index.sessions.push(sessionEntry);
  }

  const queuedSessionIds = new Set(index.queuedSessionIds ?? []);
  if (session.session.status === "closed") {
    queuedSessionIds.delete(session.session.id);
  } else if (options.queueSession === true) {
    queuedSessionIds.add(session.session.id);
  } else {
    queuedSessionIds.delete(session.session.id);
  }

  let activeSessionId = index.activeSessionId;
  if (options.leaseMode === "assign-active") {
    activeSessionId = session.session.id;
    queuedSessionIds.delete(session.session.id);
  } else if (
    options.leaseMode === "release-if-current" &&
    index.activeSessionId === session.session.id
  ) {
    activeSessionId = null;
  }

  index.updatedAt = session.session.updatedAt;
  index.activeSessionId = activeSessionId;
  index.queuedSessionIds = [...queuedSessionIds];
  index.lease = {
    status: activeSessionId == null ? "idle" : "leased",
    activeSessionId,
    leasedAt: activeSessionId == null ? null : session.session.updatedAt,
    queueDepth: index.queuedSessionIds.length,
  };
  writeJson(paths.sessionIndexPath, index);

  const packetPaths = writeWorkPacket(workspacePath, session, index);

  if (activeSessionId === session.session.id) {
    writeJson(paths.activeSessionPath, {
      schemaVersion: "1.0.0",
      mode: "planner-generator-evaluator",
      activeSessionId: session.session.id,
      status: session.session.status,
      currentPhase: session.session.currentPhase,
      nextActor: session.session.nextActor,
      nextAction: session.notes.current,
      lastUpdatedAt: session.session.updatedAt,
      queueDepth: index.queuedSessionIds.length,
      queuedSessionIds: index.queuedSessionIds,
      leaseStatus: index.lease.status,
      leasedAt: index.lease.leasedAt,
      session,
    });
  } else if (activeSessionId == null) {
    writeIdleActiveSnapshot(workspacePath);
    writeIdleWorkPacket(workspacePath, index);
    writeIdleExecutionBridge(workspacePath);
  }

  if (
    previousActiveSessionId != null &&
    previousActiveSessionId !== activeSessionId &&
    previousActiveSessionId !== session.session.id
  ) {
    const previousActiveSession = readJsonIfExists<HarnessRuntimeSessionState>(
      buildSessionStatePath(workspacePath, previousActiveSessionId)
    );
    if (previousActiveSession != null) {
      writeWorkPacket(workspacePath, previousActiveSession, index);
    }
  }

  if (activeSessionId !== session.session.id && activeSessionId != null) {
    const leasedSession = readJsonIfExists<HarnessRuntimeSessionState>(
      buildSessionStatePath(workspacePath, activeSessionId)
    );
    if (leasedSession != null) {
      writeWorkPacket(workspacePath, leasedSession, index);
    }
  }

  if (options.syncDashboard !== false) {
    const activeSession =
      activeSessionId == null ? null : loadSession(workspacePath, activeSessionId);
    if (activeSession != null) {
      syncDashboardFromSession(workspacePath, activeSession, true);
    } else {
      syncDashboardWithoutActiveLease(workspacePath);
    }
  }

  return {
    sessionPath: relativeToWorkspace(workspacePath, sessionPath),
    summaryPath: relativeToWorkspace(workspacePath, summaryPath),
    workPacketPath: packetPaths.workPacketPath,
    workPacketMarkdownPath: packetPaths.workPacketMarkdownPath,
    actorInboxPath: packetPaths.actorInboxPath,
  };
}

function activePhaseRecord(
  session: HarnessRuntimeSessionState
): HarnessPhaseRecord | undefined {
  return session.phases.find((phase) => phase.id === session.session.currentPhase);
}

function nextActionForPhase(phaseId: HarnessPhaseId): string {
  switch (phaseId) {
    case "plan-1":
    case "plan-2":
    case "plan-3":
      return "Write or update the current plan artifact, then move the work to evaluator review.";
    case "review-1":
    case "review-2":
    case "review-3":
      return "Evaluate the plan skeptically and either approve progress or send it back with evidence-backed changes.";
    case "goal-freeze":
      return "Freeze the goal, remove scope ambiguity, and confirm the bounded chunk before contract work begins.";
    case "contract-proposal":
      return "Draft the chunk contract with explicit done criteria, evidence expectations, and testability.";
    case "contract-review":
      return "Judge the contract independently and approve it only if it is specific enough to verify.";
    case "implementation":
      return "Implement only the approved contract scope and record evidence as you go.";
    case "self-check":
      return "Capture generator-side checks, test evidence, and any notable implementation gaps before evaluation.";
    case "independent-evaluation":
      return "Run the skeptical independent evaluation against the contract and visible behavior.";
    case "remediation":
      return "Address the evaluator findings without widening scope beyond the active contract.";
    case "verification":
      return "Confirm the fixed chunk is now shippable, reviewable, and ready for governance refresh.";
    case "governance-refresh":
      return "Refresh the latest governance and dashboard artifacts before closeout.";
    case "governance-close":
      return "Close the session only after artifacts, verification, and handover notes are current.";
    case "closed":
      return "Start a new governed session when the next approved chunk is ready.";
    case "governance-open":
      return "Open governance and seed the first plan artifact.";
  }
}

function mapPhaseToChunkStatus(phaseId: HarnessPhaseId): string {
  switch (phaseId) {
    case "plan-1":
    case "review-1":
    case "plan-2":
    case "review-2":
    case "plan-3":
    case "review-3":
    case "goal-freeze":
      return "planning";
    case "contract-proposal":
    case "contract-review":
      return "contracting";
    case "implementation":
    case "self-check":
      return "implementing";
    case "independent-evaluation":
    case "verification":
      return "evaluating";
    case "remediation":
      return "remediating";
    case "governance-refresh":
    case "governance-close":
      return "closing";
    case "closed":
      return "closed";
    case "governance-open":
      return "opening";
  }
}

function mapPhaseToChecklistStage(phaseId: HarnessPhaseId): string {
  switch (phaseId) {
    case "contract-proposal":
    case "contract-review":
    case "implementation":
    case "self-check":
    case "remediation":
      return "implementation";
    case "independent-evaluation":
    case "verification":
      return "verification";
    case "closed":
      return "governance-close";
    default:
      return phaseId;
  }
}

function buildRoleBrief(session: HarnessRuntimeSessionState): string {
  const phase = activePhaseRecord(session);
  const artifactPath = phase?.artifactPath ?? "n/a";
  const baseLines = [
    `Current phase: ${session.session.currentPhase}`,
    `Active artifact: ${artifactPath}`,
    `Chunk: ${session.chunk.id} (${session.chunk.title})`,
    `Current instruction: ${session.notes.current}`,
  ];

  switch (session.session.nextActor) {
    case "hub":
      return [
        ...baseLines,
        "Hub brief:",
        "- Own decomposition, worker assignment, merge ownership, and final integration judgment.",
        "- Run conflict audit before parallel work and stop workers that need undeclared write paths.",
        "- Review worker receipts, evidence, changed paths, and residual risk before accepting output.",
        "- Repeat work -> evaluate -> improve until the chunk threshold is met or a blocker is recorded.",
        "- Update dashboard memory, decisions, and next safest action before closeout.",
      ].join("\n");
    case "planner":
      return [
        ...baseLines,
        "Planner / hub brief:",
        "- Act as hub for multi-chunk work: classify dependencies, worker fit, merge ownership, and parallel-safe chunks.",
        "- Prepare minimal context-injection packets for each worker.",
        "- Require worker receipts and evidence before accepting subagent output.",
        "- Repeat work -> evaluate -> improve when the evaluator or hub finds gaps.",
        "- Keep the next step bounded, testable, and resumable.",
        "- Preserve the three-plan / three-review ladder before implementation.",
        "- Freeze the goal only when the chunk is explicit enough for contract review.",
      ].join("\n");
    case "generator":
      return [
        ...baseLines,
        "Generator brief:",
        "- Build only against the approved contract and current chunk scope.",
        "- Stay inside the injected context packet and expected write paths unless the contract is updated.",
        "- Record test evidence, implementation tradeoffs, and remaining risk explicitly.",
        "- Include self-correction and uncertainty before evaluator review.",
        "- If drift appears, use context_reset instead of stretching the session context.",
      ].join("\n");
    case "evaluator":
      return [
        ...baseLines,
        "Evaluator brief:",
        "- Judge independently and do not self-approve generator work.",
        "- Use skeptical, evidence-backed findings when requesting changes.",
        "- Verify static analysis, boundary tests, compatibility, dependency audit, maintainability, self-correction, and atomic commit evidence.",
        "- Verification is not complete until the contract is actually satisfied.",
      ].join("\n");
    default:
      return [...baseLines, "Operator brief:", "- Keep governance, dashboard, and session artifacts synchronized."].join("\n");
  }
}

function rolePromptRelativePath(actor: HarnessActorRole): string {
  switch (actor) {
    case "hub":
      return "docs/ai-harness/runtime/prompts/planner-brief.md";
    case "planner":
      return "docs/ai-harness/runtime/prompts/planner-brief.md";
    case "generator":
      return "docs/ai-harness/runtime/prompts/generator-brief.md";
    case "evaluator":
      return "docs/ai-harness/runtime/prompts/evaluator-brief.md";
    default:
      return "docs/ai-harness/runtime/README.md";
  }
}

function resolveLeaseStatus(
  sessionId: string,
  runtimeIndex: HarnessSessionIndex
): HarnessLeaseStatus {
  if (runtimeIndex.activeSessionId === sessionId) {
    return "active";
  }
  if (runtimeIndex.queuedSessionIds.includes(sessionId)) {
    return "queued";
  }
  return "inactive";
}

function buildPhaseReadPaths(session: HarnessRuntimeSessionState): string[] {
  const activePhase = activePhaseRecord(session);
  return uniqueStrings([
    `docs/ai-harness/runtime/sessions/${session.session.id}.session.json`,
    `docs/ai-harness/runtime/sessions/${session.session.id}.md`,
    rolePromptRelativePath(session.session.nextActor),
    activePhase?.artifactPath ?? null,
    session.context.lastHandoverPath,
    ...(session.chunk.expectedReadPaths ?? []),
    "docs/ai-harness/runtime/state/session-index.json",
    "docs/ai-harness/runtime/state/active-session.json",
    HARNESS_VERSION_INDEX_PATH,
    HARNESS_COMPATIBILITY_MATRIX_PATH,
    HARNESS_ADAPTER_CONTRACT_PATH,
    HARNESS_SESSION_CONTINUITY_PATH,
  ]);
}

function buildPhaseWritePaths(session: HarnessRuntimeSessionState): string[] {
  const activePhase = activePhaseRecord(session);
  return uniqueStrings([
    activePhase?.artifactPath ?? null,
    ...(session.chunk.expectedWritePaths ?? []),
    `docs/ai-harness/runtime/sessions/${session.session.id}.session.json`,
    `docs/ai-harness/runtime/sessions/${session.session.id}.md`,
    `docs/ai-harness/runtime/work-packets/${session.session.id}.work-packet.json`,
    `docs/ai-harness/runtime/work-packets/${session.session.id}.md`,
    `docs/ai-harness/runtime/inbox/${session.session.nextActor}/${session.session.id}.md`,
  ]);
}

function buildWorkPacketMarkdown(packet: Record<string, unknown>): string {
  const requiredReads = Array.isArray(packet.requiredReads)
    ? (packet.requiredReads as string[])
    : [];
  const expectedWrites = Array.isArray(packet.expectedWrites)
    ? (packet.expectedWrites as string[])
    : [];
  const recentEvents = Array.isArray(packet.recentEvents)
    ? (packet.recentEvents as Array<Record<string, unknown>>)
    : [];
  const parallelExecution = isPlainObject(packet.parallelExecution)
    ? packet.parallelExecution
    : {};
  const contextInjection = isPlainObject(packet.contextInjection)
    ? packet.contextInjection
    : {};
  const qualityGateChecklist = Array.isArray(packet.qualityGateChecklist)
    ? (packet.qualityGateChecklist as string[])
    : [];
  const requestRecord = isPlainObject(packet.requestRecord)
    ? packet.requestRecord
    : {};
  const taskTracePolicy = isPlainObject(packet.taskTracePolicy)
    ? packet.taskTracePolicy
    : {};
  const recentTaskRecords = Array.isArray(packet.recentTaskRecords)
    ? (packet.recentTaskRecords as Array<Record<string, unknown>>)
    : [];
  const verificationCommands = Array.isArray(packet.verificationCommands)
    ? (packet.verificationCommands as string[])
    : [];
  const dependencyMap = Array.isArray(packet.dependencyMap)
    ? (packet.dependencyMap as string[])
    : [];
  const evaluationLoop = isPlainObject(packet.evaluationLoop)
    ? packet.evaluationLoop
    : {};
  const workingMemory = isPlainObject(packet.workingMemory)
    ? packet.workingMemory
    : {};
  const evaluationHistory = Array.isArray(evaluationLoop.history)
    ? (evaluationLoop.history as Array<Record<string, unknown>>)
    : [];
  const recentEvaluationHistory = evaluationHistory.slice(-5);

  return `# Work Packet: ${String(packet.sessionId || "unknown")}

- Generated at: ${String(packet.generatedAt || "unknown")}
- Lease status: ${String(packet.leaseStatus || "idle")}
- Next actor: ${String(packet.nextActor || "planner")}
- Current phase: ${String(packet.currentPhase || "awaiting-session-start")}
- Goal: ${String(packet.goal || "n/a")}
- Chunk: ${String(packet.chunkId || "n/a")} (${String(packet.chunkTitle || "n/a")})
- Parallel safety: ${String(packet.parallelSafetyStatus || "unclassified")}
- Assigned worker: ${String(packet.assignedWorker || "unassigned")}
- Merge owner: ${String(packet.mergeOwner || "not assigned")}

## Current Instruction

${String(packet.nextAction || "Start the first governed runtime session before implementation begins.")}

## Request / Process / Result Ledger

- Original request: ${String(requestRecord.originalRequest || packet.goal || "n/a")}
- Normalized goal: ${String(requestRecord.normalizedGoal || packet.goal || "n/a")}
- Captured at: ${String(requestRecord.capturedAt || "unknown")}
- Trace rule: ${String(taskTracePolicy.rule || "Record the original request, process summary, and result summary for every meaningful task.")}
- Closeout gate: ${String(taskTracePolicy.closeoutGate || "Do not close governance without a final request/process/result record.")}

### Recent Task Records

${recentTaskRecords.map((record) => {
  return [
    `- ${String(record.at || "unknown")} | ${String(record.phase || "phase")} | ${String(record.actor || "actor")} | ${String(record.action || "action")}`,
    `  - Original request: ${String(record.originalRequest || "n/a")}`,
    `  - Process: ${String(record.processSummary || "n/a")}`,
    `  - Result: ${String(record.resultSummary || "n/a")}`,
  ].join("\n");
}).join("\n") || "- none yet"}

## Role Brief

${String(packet.roleBrief || "No role brief available.")}

## Required Reads

${requiredReads.map((item) => `- ${item}`).join("\n") || "- none"}

## Expected Writes

${expectedWrites.map((item) => `- ${item}`).join("\n") || "- none"}

## Parallel Execution

- Hub role: ${String(parallelExecution.hubRole || "The main agent owns orchestration and integration.")}
- Orchestrator required for multi-chunk work: ${String(parallelExecution.orchestratorRequiredForMultiChunkWork ?? "true")}
- Assigned worker: ${String(parallelExecution.assignedWorker || "unassigned")}
- Parallel safety status: ${String(parallelExecution.parallelSafetyStatus || "unclassified")}
- Merge owner: ${String(parallelExecution.mergeOwner || "not assigned")}
- Integration owner: ${String(parallelExecution.integrationOwner || "not assigned")}
- Dependency status: ${String(parallelExecution.dependencyStatus || "unclassified")}
- Dependency map:
${dependencyMap.map((item) => `  - ${item}`).join("\n") || "  - none"}
- Safety rule: ${String(parallelExecution.parallelSafetyRule || "n/a")}
- Merge rule: ${String(parallelExecution.mergeRule || "n/a")}
- Review loop: ${String(parallelExecution.reviewLoop || "Repeat work -> evaluate -> improve until accepted.")}

## Evaluation Loop

- Iteration: ${String(evaluationLoop.iteration ?? "0")}
- Status: ${String(evaluationLoop.status || "not-started")}
- Threshold: ${String(evaluationLoop.threshold || "Contract satisfied and evidence reviewed by the hub.")}

### Recent Negative Review / Improvement Records

${recentEvaluationHistory.map((entry) => {
  const findings = Array.isArray(entry.findings) ? entry.findings : [];
  const requiredFixes = Array.isArray(entry.requiredFixes) ? entry.requiredFixes : [];
  const evidence = Array.isArray(entry.verificationEvidence) ? entry.verificationEvidence : [];
  return [
    `- ${String(entry.at || "unknown")} ${String(entry.phase || "phase")} ${String(entry.verdict || "review")}`,
    findings.length > 0 ? `  - Findings: ${findings.map(String).join("; ")}` : "",
    requiredFixes.length > 0 ? `  - Required fixes: ${requiredFixes.map(String).join("; ")}` : "",
    evidence.length > 0 ? `  - Verification evidence: ${evidence.map(String).join("; ")}` : "",
    entry.residualRisk ? `  - Residual risk: ${String(entry.residualRisk)}` : "",
    entry.improvementAction ? `  - Improvement action: ${String(entry.improvementAction)}` : "",
  ].filter(Boolean).join("\n");
}).join("\n") || "- none yet"}

## Stateful Cognitive Offloading

- Inner tier: ${String(workingMemory.innerTier || "compact prompt-facing working memory")}
- Outer tier: ${String(workingMemory.outerTier || "durable artifact file cabinet")}
- Division of labor: ${String(workingMemory.policyRole || "agent decides; harness maintains recoverable state")}
- Curation rule: ${String(workingMemory.curationRule || "promote evidence-backed artifacts and demote noise")}
- Verify-before-promote: ${String(workingMemory.verifyBeforePromote || "completion claims require verification evidence")}

## Context Injection

- Rule: ${String(contextInjection.rule || "Use the smallest sufficient context packet.")}
- Forbidden: ${String(contextInjection.forbidden || "Do not rely on hidden or unrelated context.")}
- Escalation: ${String(contextInjection.escalation || "Stop and update the contract when more context is needed.")}

## Quality Gate Checklist

${qualityGateChecklist.map((item) => `- ${item}`).join("\n") || "- none"}

## Verification Commands

${verificationCommands.map((item) => `- ${item}`).join("\n") || "- none"}

## Atomic Commit Policy

${String(packet.atomicCommitPolicy || "Use one logical change per commit.")}

## Recent Events

${recentEvents
  .map(
    (event) =>
      `- ${String(event.at || "")} | ${String(event.phase || "")} | ${String(event.actor || "")} | ${String(event.action || "")} | ${String(event.outcome || "")} | ${String(event.note || "")}`
  )
  .join("\n") || "- none"}
`;
}

function buildAdapterPromptBlock(
  session: HarnessRuntimeSessionState,
  adapter: HarnessRuntimeAdapterDescriptor,
  packet: Record<string, unknown>
): string {
  const requiredReads = Array.isArray(packet.requiredReads)
    ? (packet.requiredReads as string[])
    : [];
  const expectedWrites = Array.isArray(packet.expectedWrites)
    ? (packet.expectedWrites as string[])
    : [];
  const requestRecord = isPlainObject(packet.requestRecord)
    ? packet.requestRecord
    : {};

  return [
    `You are continuing governed AI delivery through the "${adapter.title}" adapter.`,
    `Session ID: ${session.session.id}`,
    `Current phase: ${session.session.currentPhase}`,
    `Next actor: ${session.session.nextActor}`,
    `Original request: ${String(
      requestRecord.originalRequest || session.session.goal
    )}`,
    `Goal: ${session.session.goal}`,
    `Chunk: ${session.chunk.id} (${session.chunk.title})`,
    "",
    "Follow these rules strictly:",
    "- Treat the governed files as the source of truth over any hidden chat memory.",
    "- If another runtime handed this off, trust adapter-contract.json, session-continuity.md, the work packet, and runtime session state before chat history.",
    "- Do not widen scope beyond the active chunk and approved contract.",
    "- For parallel work, stay inside your assigned dependency-free chunk and expected write paths.",
    "- Use only the injected context packet unless you stop and update the contract.",
    "- Persist decisions, evidence, and outcomes into the referenced durable files.",
    "- For every meaningful task, preserve originalRequest, processSummary, and resultSummary in the event or execution receipt.",
    "- Use the workingMemory contract: let the harness carry recoverable state while you focus on semantic decisions.",
    "- Treat evaluationLoop.history as the durable record of work -> negative review -> remediation -> verification.",
    "- Before completion, record static analysis, boundary testing, compatibility, dependency audit, maintainability, self-correction, and atomic commit evidence.",
    "- Preserve sessionId, chunkId, currentPhase, nextActor, and leaseStatus unless an MCP runtime tool advances governance.",
    "- If the work is blocked or ambiguous, stop and record the blocker instead of improvising.",
    "",
    `Current instruction: ${session.notes.current}`,
    "",
    "Read these files first:",
    ...requiredReads.map((item) => `- ${item}`),
    "",
    "Write only within these durable paths unless the contract explicitly requires more:",
    ...expectedWrites.map((item) => `- ${item}`),
    "",
    "Runtime-specific expectations:",
    ...adapter.runtimeExpectations.map((item) => `- ${item}`),
  ].join("\n");
}

function buildAdapterHandoffMarkdown(handoff: Record<string, unknown>): string {
  const adapter = isPlainObject(handoff.adapter) ? handoff.adapter : {};
  const packet = isPlainObject(handoff.packet) ? handoff.packet : {};
  const fileReferences = isPlainObject(handoff.fileReferences)
    ? handoff.fileReferences
    : {};
  const compatibility = isPlainObject(handoff.compatibility)
    ? handoff.compatibility
    : {};
  const workingMemory = isPlainObject(handoff.workingMemory)
    ? handoff.workingMemory
    : {};
  const requestRecord = isPlainObject(handoff.requestRecord)
    ? handoff.requestRecord
    : isPlainObject(packet.requestRecord)
      ? packet.requestRecord
      : {};
  const taskTracePolicy = isPlainObject(handoff.taskTracePolicy)
    ? handoff.taskTracePolicy
    : isPlainObject(packet.taskTracePolicy)
      ? packet.taskTracePolicy
      : {};
  const evaluationLoop = isPlainObject(handoff.evaluationLoop)
    ? handoff.evaluationLoop
    : {};
  const operatorChecklist = Array.isArray(handoff.operatorChecklist)
    ? (handoff.operatorChecklist as string[])
    : [];
  const runtimeExpectations = Array.isArray(handoff.runtimeExpectations)
    ? (handoff.runtimeExpectations as string[])
    : [];

  return `# Adapter Handoff: ${String(handoff.sessionId || "unknown")} -> ${String(
    adapter.title || "adapter"
  )}

- Generated at: ${String(handoff.generatedAt || "unknown")}
- Adapter ID: \`${String(adapter.id || "unknown")}\`
- Runtime family: ${String(adapter.runtimeFamily || "unknown")}
- Handoff mode: ${String(adapter.handoffMode || "unknown")}
- Lease status: ${String(handoff.leaseStatus || "idle")}
- Next actor: ${String(handoff.nextActor || "planner")}
- Current phase: ${String(handoff.currentPhase || "awaiting-session-start")}
- Goal: ${String(handoff.goal || "n/a")}
- Chunk: ${String(handoff.chunkId || "n/a")} (${String(handoff.chunkTitle || "n/a")})

## Request Trace

- Original request: ${String(requestRecord.originalRequest || handoff.goal || "n/a")}
- Normalized goal: ${String(requestRecord.normalizedGoal || handoff.goal || "n/a")}
- Captured at: ${String(requestRecord.capturedAt || "unknown")}
- Required trace fields: ${Array.isArray(taskTracePolicy.requiredFields) ? (taskTracePolicy.requiredFields as string[]).join(", ") : "originalRequest, processSummary, resultSummary"}
- Closeout gate: ${String(taskTracePolicy.closeoutGate || "Do not close governance without request/process/result evidence.")}

## Source Files

- Work packet JSON: ${String(fileReferences.workPacketFile || "n/a")}
- Work packet Markdown: ${String(fileReferences.workPacketMarkdownFile || "n/a")}
- Actor inbox: ${String(fileReferences.actorInboxFile || "n/a")}
- Session state: ${String(fileReferences.sessionFile || "n/a")}
- Session summary: ${String(fileReferences.sessionSummaryFile || "n/a")}
- Runtime prompt: ${String(fileReferences.rolePromptFile || "n/a")}
- Adapter profile: ${String(fileReferences.adapterProfileFile || "n/a")}
- Adapter contract: ${String(fileReferences.adapterContractFile || "n/a")}
- Version index: ${String(fileReferences.versionIndexFile || "n/a")}
- Compatibility matrix: ${String(fileReferences.compatibilityMatrixFile || "n/a")}
- Session continuity: ${String(fileReferences.sessionContinuityFile || "n/a")}

## Compatibility

- MCP server version: ${String(compatibility.mcpServerVersion || "unknown")}
- Adapter contract version: ${String(compatibility.adapterContractVersion || "unknown")}

## Agent Switching Rule

When moving this session between Copilot, Codex, Claude, Gemini, OpenHands, or another runtime, keep \`sessionId\`, \`chunkId\`, \`currentPhase\`, and \`nextActor\` stable. Read the adapter contract and session continuity files before relying on chat history.

## Working Memory Contract

- Inner tier: ${String(workingMemory.innerTier || "compact prompt-facing working memory")}
- Outer tier: ${String(workingMemory.outerTier || "durable artifact file cabinet")}
- Evaluation loop: iteration ${String(evaluationLoop.iteration ?? "0")}, status ${String(evaluationLoop.status || "not-started")}

## Operator Checklist

${operatorChecklist.map((item) => `- ${item}`).join("\n") || "- none"}

## Runtime Expectations

${runtimeExpectations.map((item) => `- ${item}`).join("\n") || "- none"}

## Prompt Block

\`\`\`text
${String(handoff.promptBlock || "")}
\`\`\`

## Packet Summary

${String(packet.summary || "No packet summary available.")}
`;
}

function buildAdapterChecklistMarkdown(handoff: Record<string, unknown>): string {
  const operatorChecklist = Array.isArray(handoff.operatorChecklist)
    ? (handoff.operatorChecklist as string[])
    : [];
  const packet = isPlainObject(handoff.packet) ? handoff.packet : {};

  return `# Adapter Launch Checklist

- Session: \`${String(handoff.sessionId || "unknown")}\`
- Adapter: \`${String(handoff.adapterId || "unknown")}\`
- Next actor: ${String(handoff.nextActor || "planner")}
- Current phase: ${String(handoff.currentPhase || "awaiting-session-start")}

## Before Launch

${operatorChecklist.map((item) => `- ${item}`).join("\n") || "- none"}

## Confirmed Scope

- Goal: ${String(handoff.goal || "n/a")}
- Chunk: ${String(handoff.chunkId || "n/a")} (${String(handoff.chunkTitle || "n/a")})
- Next action: ${String(handoff.nextAction || "n/a")}
- Packet summary: ${String(packet.summary || "n/a")}
`;
}

function applyBridgeTemplate(
  template: string,
  replacements: Record<string, string>
): string {
  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(`{${key}}`, value);
  }
  return output;
}

function quotePowerShellSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteBashSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildExecutionBridgeMarkdown(manifest: Record<string, unknown>): string {
  const bridge = isPlainObject(manifest.bridge) ? manifest.bridge : {};
  const handoff = isPlainObject(manifest.handoff) ? manifest.handoff : {};
  const launchCommands = isPlainObject(manifest.launchCommands)
    ? manifest.launchCommands
    : {};
  const resultArtifacts = isPlainObject(manifest.resultArtifacts)
    ? manifest.resultArtifacts
    : {};
  const resultExpectations = Array.isArray(manifest.resultExpectations)
    ? (manifest.resultExpectations as string[])
    : [];

  return `# Execution Bridge: ${String(manifest.sessionId || "unknown")} -> ${String(
    bridge.title || "bridge"
  )}

- Generated at: ${String(manifest.generatedAt || "unknown")}
- Bridge ID: \`${String(manifest.bridgeId || "unknown")}\`
- Launch mode: ${String(bridge.launchMode || "unknown")}
- Runtime family: ${String(bridge.runtimeFamily || "unknown")}
- Active session: ${String(manifest.sessionId || "unknown")}
- Next actor: ${String(manifest.nextActor || "planner")}

## Launch Inputs

- Adapter handoff: ${String(handoff.handoffMarkdownFile || "n/a")}
- Work packet: ${String(handoff.workPacketFile || "n/a")}
- Actor inbox: ${String(handoff.actorInboxFile || "n/a")}
- Result template: ${String(manifest.resultTemplateFile || "n/a")}
- Native last message file: ${String(resultArtifacts.nativeLastMessageFile || "n/a")}

## Suggested Commands

### PowerShell

${Array.isArray(launchCommands.powershell) && launchCommands.powershell.length > 0
  ? (launchCommands.powershell as string[]).map((item) => `- ${item}`).join("\n")
  : "- none"}

### Bash

${Array.isArray(launchCommands.bash) && launchCommands.bash.length > 0
  ? (launchCommands.bash as string[]).map((item) => `- ${item}`).join("\n")
  : "- none"}

## Result Expectations

${resultExpectations.map((item) => `- ${item}`).join("\n") || "- none"}
`;
}

function buildExecutionBridgeGuide(manifest: Record<string, unknown>): string {
  const resultArtifacts = isPlainObject(manifest.resultArtifacts)
    ? manifest.resultArtifacts
    : {};
  const resultExpectations = Array.isArray(manifest.resultExpectations)
    ? (manifest.resultExpectations as string[])
    : [];

  return `# Return To Governance

1. Run the external execution environment using the launch bundle files in this directory.
2. Capture durable outputs in governed paths or runtime/outbox references.
3. Review any native last-message artifact such as \`${String(resultArtifacts.nativeLastMessageFile || "n/a")}\` and keep it with the governed evidence.
4. Fill out \`${String(manifest.resultTemplateFile || "result-template.json")}\`.
5. Call \`record_harness_execution_result\` or manually persist the same receipt in this directory.
6. Resume the governed phase with \`advance_harness_session\` once the receipt and evidence are in place.

## Result Expectations

${resultExpectations.map((item) => `- ${item}`).join("\n") || "- none"}
`;
}

function buildExecutionResultTemplate(manifest: Record<string, unknown>): Record<string, unknown> {
  const resultArtifacts = isPlainObject(manifest.resultArtifacts)
    ? manifest.resultArtifacts
    : {};
  const requestRecord = isPlainObject(manifest.requestRecord)
    ? manifest.requestRecord
    : {};
  return {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    sessionId: manifest.sessionId,
    bridgeId: manifest.bridgeId,
    outcome: "completed",
    summary: "Describe what the external runtime completed and what remains.",
    originalRequest: String(requestRecord.originalRequest || "Repeat the original user request here."),
    processSummary:
      "Describe the commands, files, checks, and decisions the external runtime performed.",
    resultSummary:
      "Describe the result in user-facing terms, including remaining risk or next work.",
    artifactPaths:
      typeof resultArtifacts.nativeLastMessageFile === "string"
        ? [resultArtifacts.nativeLastMessageFile]
        : [],
    nextStep: "Advance the governed session with the correct actor and action.",
  };
}

function buildExecutionReceiptMarkdown(receipt: Record<string, unknown>): string {
  const artifactPaths = Array.isArray(receipt.artifactPaths)
    ? (receipt.artifactPaths as string[])
    : [];
  const taskTrace = isPlainObject(receipt.taskTrace) ? receipt.taskTrace : {};

  return `# Execution Receipt: ${String(receipt.sessionId || "unknown")} / ${String(
    receipt.bridgeId || "bridge"
  )}

- Recorded at: ${String(receipt.recordedAt || "unknown")}
- Outcome: ${String(receipt.outcome || "unknown")}
- Summary: ${String(receipt.summary || "n/a")}
- Next step: ${String(receipt.nextStep || "n/a")}

## Request / Process / Result

- Original request: ${String(taskTrace.originalRequest || receipt.originalRequest || "n/a")}
- Process: ${String(taskTrace.processSummary || receipt.processSummary || "n/a")}
- Result: ${String(taskTrace.resultSummary || receipt.resultSummary || receipt.summary || "n/a")}

## Artifact Paths

${artifactPaths.map((item) => `- ${item}`).join("\n") || "- none"}
`;
}

function buildLaunchPowershell(manifest: Record<string, unknown>): string {
  const commands =
    isPlainObject(manifest.launchCommands) &&
    Array.isArray(manifest.launchCommands.powershell)
      ? (manifest.launchCommands.powershell as string[])
      : [];
  const commandList =
    commands.length > 0
      ? commands
          .map((command) => `Write-Host ${quotePowerShellSingleQuoted(`  ${command}`)}`)
          .join("\n")
      : `Write-Host ${quotePowerShellSingleQuoted("  No direct command is defined for this bridge.")}`;

  return [
    '$ErrorActionPreference = "Stop"',
    `$manifestPath = Join-Path $PSScriptRoot "bridge-manifest.json"`,
    '$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json',
    'Write-Host "Harness execution bridge loaded."',
    'Write-Host ("Session: " + $manifest.sessionId)',
    'Write-Host ("Bridge: " + $manifest.bridge.title)',
    'Write-Host "Suggested PowerShell launch commands:"',
    commandList,
    'Write-Host ""',
    'Write-Host ("Handoff markdown: " + $manifest.handoff.handoffMarkdownFile)',
    'Write-Host ("Actor inbox: " + $manifest.handoff.actorInboxFile)',
    'Write-Host ("Result template: " + $manifest.resultTemplateFile)',
  ].join("\n");
}

function buildLaunchBash(manifest: Record<string, unknown>): string {
  const commands =
    isPlainObject(manifest.launchCommands) &&
    Array.isArray(manifest.launchCommands.bash)
      ? (manifest.launchCommands.bash as string[])
      : [];
  const commandList =
    commands.length > 0
      ? commands
          .map((command) => `printf '%s\\n' ${quoteBashSingleQuoted(`  ${command}`)}`)
          .join("\n")
      : `printf '%s\\n' ${quoteBashSingleQuoted("  No direct command is defined for this bridge.")}`;

  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    'MANIFEST_PATH="$(cd "$(dirname "$0")" && pwd)/bridge-manifest.json"',
    'echo "Harness execution bridge loaded."',
    'echo "Suggested bash launch commands:"',
    commandList,
    'echo ""',
    'echo "Review bridge-manifest.json, handoff.md, and result-template.json before launching the external runtime."',
  ].join("\n");
}

function writeIdleWorkPacket(
  workspacePath: string,
  runtimeIndex: HarnessSessionIndex
): void {
  const paths = buildRuntimePaths(workspacePath);
  const queuedSessionId = runtimeIndex.queuedSessionIds[0] ?? null;
  const queuedSession =
    queuedSessionId == null
      ? null
      : readJsonIfExists<HarnessRuntimeSessionState>(
          buildSessionStatePath(workspacePath, queuedSessionId)
        );
  writeJson(paths.currentWorkPacketPath, {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    leaseStatus: "idle",
    activeSessionId: null,
    nextActor: queuedSession?.session.nextActor ?? "planner",
    nextAction:
      queuedSessionId != null
        ? `Activate the next queued session: ${queuedSessionId}`
        : "Start the first governed runtime session before implementation begins.",
    requestRecord:
      queuedSession == null ? null : getSessionRequestRecord(queuedSession),
    taskTracePolicy: {
      requiredFields: ["originalRequest", "processSummary", "resultSummary"],
      rule:
        "Every governed agent task records the original request, process summary, and result summary.",
    },
    workPacketFile:
      queuedSessionId != null
        ? `docs/ai-harness/runtime/work-packets/${queuedSessionId}.work-packet.json`
        : null,
    actorInboxFile:
      queuedSessionId != null
        ? `docs/ai-harness/runtime/inbox/${queuedSession?.session.nextActor ?? "planner"}/${queuedSessionId}.md`
        : null,
    summary:
      queuedSessionId != null
        ? `No session currently holds the active lease. The next queued session is ${queuedSessionId}.`
        : "No active harness session is currently leased.",
  });
}

function writeIdleExecutionBridge(workspacePath: string): void {
  const paths = buildRuntimePaths(workspacePath);
  writeJson(paths.currentExecutionBridgePath, {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    activeSessionId: null,
    bridgeId: null,
    launchMode: "idle",
    bridgeManifestFile: null,
    summary:
      "No execution bridge is currently prepared for the active runtime lease.",
  });
}

function taskTraceIntegrity(event: HarnessRuntimeEvent): HarnessTaskTraceIntegrity {
  if (!isPlainObject(event.taskTrace)) {
    return {
      status: "legacy-fallback",
      missingFields: ["taskTrace"],
      source: "legacy-event-fallback",
      warning:
        "This event predates strict taskTrace enforcement or was imported without taskTrace; request/process/result text is display fallback, not verified trace evidence.",
    };
  }
  const missingFields = [
    "originalRequest",
    "processSummary",
    "resultSummary",
  ].filter((field) => !isString(event.taskTrace[field as keyof HarnessTaskTrace]));
  return {
    status: missingFields.length > 0 ? "missing-taskTrace-fields" : "complete",
    missingFields,
    source: event.taskTrace.source || "taskTrace",
    warning:
      missingFields.length > 0
        ? "Task trace exists but is missing required request/process/result fields."
        : null,
  };
}

function displayTaskTrace(
  event: HarnessRuntimeEvent,
  requestRecord: HarnessRuntimeSessionState["requestRecord"]
): HarnessTaskTrace {
  return event.taskTrace ?? buildTaskTrace({
    fallbackOriginalRequest: requestRecord.originalRequest,
    fallbackProcessSummary: event.note,
    fallbackResultSummary: event.outcome,
    recordedAt: event.at,
    source: "legacy-event-fallback",
  });
}

function eventTraceRecord(
  event: HarnessRuntimeEvent,
  requestRecord: HarnessRuntimeSessionState["requestRecord"]
) {
  const taskTrace = displayTaskTrace(event, requestRecord);
  const traceIntegrity = taskTraceIntegrity(event);
  return {
    at: event.at,
    phase: event.phase,
    actor: event.actor,
    action: event.action,
    originalRequest: taskTrace.originalRequest,
    processSummary: taskTrace.processSummary,
    resultSummary: taskTrace.resultSummary,
    source: taskTrace.source,
    traceIntegrity,
  };
}

function writeWorkPacket(
  workspacePath: string,
  session: HarnessRuntimeSessionState,
  runtimeIndex: HarnessSessionIndex
): {
  workPacketPath: string;
  workPacketMarkdownPath: string;
  actorInboxPath: string;
} {
  const sessionPath = buildSessionStatePath(workspacePath, session.session.id);
  const summaryPath = buildSessionSummaryPath(workspacePath, session.session.id);
  const workPacketPath = buildWorkPacketStatePath(workspacePath, session.session.id);
  const workPacketMarkdownPath = buildWorkPacketMarkdownPath(
    workspacePath,
    session.session.id
  );
  const actorInboxPath = buildActorInboxPath(
    workspacePath,
    session.session.nextActor,
    session.session.id
  );
  const leaseStatus = resolveLeaseStatus(session.session.id, runtimeIndex);
  const activePhase = activePhaseRecord(session);
  const requestRecord = getSessionRequestRecord(session);
  const packet = {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    leaseStatus,
    activeSessionId: runtimeIndex.activeSessionId,
    sessionId: session.session.id,
    title: session.session.title,
    goal: session.session.goal,
    status: session.session.status,
    nextActor: session.session.nextActor,
    currentPhase: session.session.currentPhase,
    nextAction: session.notes.current,
    requestRecord,
    taskTracePolicy: {
      requiredFields: ["originalRequest", "processSummary", "resultSummary"],
      rule:
        "Every agent task, worker handoff, external execution, and phase transition must preserve the original request, process summary, and result summary in durable files.",
      sourceOfTruth:
        "Use requestRecord.originalRequest as the canonical original user request unless a later governed session explicitly records a narrower original request.",
      closeoutGate:
        "Do not close governance until the final event or receipt explains what was requested, what was done, and what changed.",
    },
    contextPolicy: session.context.policy,
    adoptionTrack: session.session.adoptionTrack,
    chunkId: session.chunk.id,
    chunkTitle: session.chunk.title,
    chunkStatus: session.chunk.status,
    chunkSummary: session.chunk.summary,
    dependencyNotes: session.chunk.dependencyNotes ?? null,
    contextInjectionNotes: session.chunk.contextInjectionNotes ?? null,
    expectedReadPaths: session.chunk.expectedReadPaths ?? [],
    expectedWritePaths: session.chunk.expectedWritePaths ?? [],
    verificationCommands: session.chunk.verificationCommands ?? [],
    assignedWorker: session.chunk.assignedWorker ?? null,
    dependencyMap: session.chunk.dependencyMap ?? [],
    mergeOwner: session.chunk.mergeOwner ?? null,
    integrationOwner: session.chunk.integrationOwner ?? null,
    parallelSafetyStatus: session.chunk.parallelSafetyStatus ?? "unclassified",
    workingMemory: {
      innerTier:
        "Use this packet as compact working memory: goal, phase, expected writes, curated evidence, review findings, next action, and context budget.",
      outerTier:
        "Use linked artifacts as the file cabinet: session JSON, phase artifacts, dashboard state, review notes, handovers, VCS records, and verification receipts.",
      policyRole:
        "The agent makes semantic decisions; the harness maintains recoverable state, evidence links, curation records, verification receipts, and budget-aware renderings.",
      curationRule:
        "Promote only evidence-backed artifacts into the active working set; demote stale or noisy context instead of copying it forward.",
      verifyBeforePromote:
        "High-confidence readiness or completion claims require verification evidence before closeout.",
    },
    evaluationLoop: session.chunk.evaluationLoop ?? null,
    rolePromptFile: rolePromptRelativePath(session.session.nextActor),
    stateFile: relativeToWorkspace(workspacePath, sessionPath),
    summaryFile: relativeToWorkspace(workspacePath, summaryPath),
    phaseArtifactFile: activePhase?.artifactPath ?? null,
    lastHandoverFile: session.context.lastHandoverPath,
    workPacketFile: relativeToWorkspace(workspacePath, workPacketPath),
    workPacketMarkdownFile: relativeToWorkspace(workspacePath, workPacketMarkdownPath),
    actorInboxFile: relativeToWorkspace(workspacePath, actorInboxPath),
    queueDepth: runtimeIndex.queuedSessionIds.length,
    queuedSessionIds: runtimeIndex.queuedSessionIds,
    governance: session.governance,
    verification: session.verification,
    requiredReads: buildPhaseReadPaths(session),
    expectedWrites: buildPhaseWritePaths(session),
    parallelExecution: {
      hubRole:
        "The main agent is the hub: it decomposes the request, assigns independent chunks, reviews worker receipts, integrates evidence, and decides whether another improvement pass is required.",
      orchestratorRequiredForMultiChunkWork: true,
      assignedWorker: session.chunk.assignedWorker ?? null,
      dependencyMap: session.chunk.dependencyMap ?? [],
      parallelSafetyStatus: session.chunk.parallelSafetyStatus ?? "unclassified",
      mergeOwner: session.chunk.mergeOwner ?? null,
      integrationOwner: session.chunk.integrationOwner ?? null,
      dependencyStatus:
        session.chunk.dependencyNotes ??
        "Classify this chunk as blocked, sequential, or parallel-ready before assigning workers.",
      parallelSafetyRule:
        "Parallel execution is allowed only when expected write paths, runtime side effects, database/schema changes, API contracts, and integration-sensitive shared files do not conflict.",
      mergeRule:
        "Worker outputs must return through receipts, evaluations, dashboard updates, and atomic commits. Dependency manifests, lockfiles, CI workflows, shared config, DB migrations, generated clients, and API contracts require one merge owner before integration is complete.",
      reviewLoop:
        session.chunk.evaluationLoop?.threshold ??
        "Repeat work -> evaluate -> improve until exit criteria are met or a blocker is recorded.",
    },
    contextInjection: {
      rule:
        session.chunk.contextInjectionNotes ??
        "Inject only task-relevant code snippets, DB schema fragments, API specs, logs, commands, expected write paths, and merge ownership when integration is required.",
      forbidden:
        "Do not rely on hidden chat state, unrelated repository areas, or another worker's private scratch context.",
      escalation:
        "If more context is needed, stop and update the context packet or chunk contract before continuing.",
    },
    qualityGateChecklist: [
      "Static analysis and likely runtime exception scan",
      "Boundary testing for edge inputs and limits",
      "Environment and framework/runtime version compatibility check",
      "Dependency audit for newly added or changed libraries",
      "Maintainability review for SOLID, duplication, abstraction level, constants, and layer separation",
      "Generator self-correction with uncertainty report",
      "Atomic commit traceability for the active chunk or remediation",
      "Merge-owner verification when shared integration surfaces changed",
    ],
    atomicCommitPolicy:
      "Use one logical change per commit and reference the session, chunk, plan, or issue when available.",
    roleBrief: buildRoleBrief(session),
    summary: `${session.session.nextActor} should continue ${session.session.currentPhase} for ${session.session.id} using the active artifact and approved governance boundaries.`,
    recentTaskRecords: session.events
      .slice(-5)
      .map((event) => eventTraceRecord(event, requestRecord)),
    recentEvents: session.events.slice(-5).map((event) => ({
      at: event.at,
      phase: event.phase,
      actor: event.actor,
      action: event.action,
      outcome: event.outcome,
      note: event.note,
    })),
  };

  writeJson(workPacketPath, packet);
  fs.writeFileSync(workPacketMarkdownPath, buildWorkPacketMarkdown(packet), "utf-8");
  ensureDir(path.dirname(actorInboxPath));
  fs.writeFileSync(
    actorInboxPath,
    [
      `# ${session.session.nextActor} Inbox`,
      "",
      `- Session: \`${session.session.id}\``,
      `- Lease status: ${leaseStatus}`,
      `- Current phase: \`${session.session.currentPhase}\``,
      `- Next action: ${session.notes.current}`,
      `- Packet JSON: ${relativeToWorkspace(workspacePath, workPacketPath)}`,
      `- Packet Markdown: ${relativeToWorkspace(workspacePath, workPacketMarkdownPath)}`,
      "",
      buildRoleBrief(session),
      "",
    ].join("\n"),
    "utf-8"
  );

  if (leaseStatus === "active") {
    writeJson(buildRuntimePaths(workspacePath).currentWorkPacketPath, packet);
  }

  return {
    workPacketPath: relativeToWorkspace(workspacePath, workPacketPath),
    workPacketMarkdownPath: relativeToWorkspace(workspacePath, workPacketMarkdownPath),
    actorInboxPath: relativeToWorkspace(workspacePath, actorInboxPath),
  };
}

function ensureRuntimeArtifacts(
  workspacePath: string,
  session: HarnessRuntimeSessionState
): void {
  const currentPhase = activePhaseRecord(session);
  const phaseArtifactPath = ensurePhaseArtifact(
    workspacePath,
    session,
    session.session.currentPhase
  );
  if (currentPhase != null) {
    currentPhase.artifactPath = phaseArtifactPath;
  }

  ensureDir(path.join(workspacePath, "docs", "context", session.session.id));
  ensureDir(path.join(workspacePath, "docs", "plans", session.session.id));
  ensureDir(path.join(workspacePath, "docs", "reviews", session.session.id));
  ensureDir(path.join(workspacePath, "docs", "contracts", session.session.id));
  ensureDir(path.join(workspacePath, "docs", "evaluations", session.session.id));
  ensureDir(path.join(workspacePath, "docs", "handovers", session.session.id));
}

function createStartEvent(
  startedAt: string,
  activeArtifactPath: string | null,
  taskTrace: HarnessTaskTrace
): HarnessRuntimeEvent {
  return {
    id: "evt-0001",
    at: startedAt,
    phase: "governance-open",
    actor: "planner",
    action: "complete",
    outcome: "governance-opened",
    note: "Governance opened and the session advanced to Plan 1.",
    artifactPaths: uniqueStrings([
      activeArtifactPath,
      "docs/ai-harness/runtime/state/session-index.json",
      "docs/ai-harness/runtime/state/active-session.json",
    ]),
    taskTrace,
  };
}

function nextEventId(session: HarnessRuntimeSessionState): string {
  return `evt-${String(session.events.length + 1).padStart(4, "0")}`;
}

function upsertDashboardArtifact(
  state: Record<string, unknown>,
  id: string,
  label: string,
  artifactPath: string,
  owner: string
): void {
  const artifacts = Array.isArray(state.artifacts)
    ? (state.artifacts as Array<Record<string, unknown>>)
    : [];
  const existingIndex = artifacts.findIndex((artifact) => artifact.id === id);
  const nextArtifact = {
    id,
    label,
    path: artifactPath,
    status: "present",
    owner,
  };
  if (existingIndex >= 0) {
    artifacts[existingIndex] = {
      ...artifacts[existingIndex],
      ...nextArtifact,
    };
  } else {
    artifacts.push(nextArtifact);
  }
  state.artifacts = artifacts;
}

function deriveChecklistStatuses(
  currentPhase: HarnessPhaseId,
  sessionStatus: HarnessRuntimeSessionState["session"]["status"]
) {
  const mappedStage = mapPhaseToChecklistStage(currentPhase);
  const currentStageIndex = CHECKLIST_STAGE_ORDER.indexOf(
    mappedStage as (typeof CHECKLIST_STAGE_ORDER)[number]
  );

  return CHECKLIST_STAGE_ORDER.map((stageId, index) => {
    let status = "todo";
    if (currentStageIndex === -1) {
      status = "todo";
    } else if (index < currentStageIndex) {
      status = "complete";
    } else if (index === currentStageIndex) {
      status =
        sessionStatus === "blocked"
          ? "blocked"
          : currentPhase === "closed" && stageId === "governance-close"
            ? "complete"
            : "in-progress";
    }
    if (currentPhase === "closed" && stageId === "governance-close") {
      status = "complete";
    }
    return {
      id: stageId,
      status,
    };
  });
}

function syncDashboardFromSession(
  workspacePath: string,
  session: HarnessRuntimeSessionState,
  setActive: boolean
): void {
  const paths = buildRuntimePaths(workspacePath);
  const runtimeIndex = loadRuntimeIndex(workspacePath);
  const workPacketPath = `docs/ai-harness/runtime/work-packets/${session.session.id}.work-packet.json`;
  const dashboardState = readJsonIfExists<Record<string, unknown>>(
    paths.dashboardStatePath
  );
  if (dashboardState == null) {
    return;
  }

  const updatedAt = session.session.updatedAt;
  const currentPhase = session.session.currentPhase;
  const mappedChecklistStatuses = new Map<string, string>(
    deriveChecklistStatuses(currentPhase, session.session.status).map((item) => [
      item.id,
      item.status,
    ])
  );

  if (isPlainObject(dashboardState.executiveSummary)) {
    dashboardState.executiveSummary = {
      ...dashboardState.executiveSummary,
      overallStatus:
        session.session.status === "blocked"
          ? "attention-needed"
          : session.session.status === "closed"
            ? "governed"
            : "active",
      currentStage: currentPhase,
      overallProgressPercent: Math.max(
        8,
        Math.round(
          (PHASE_DEFINITIONS.findIndex((phase) => phase.id === currentPhase) /
            (PHASE_DEFINITIONS.length - 1)) *
            100
        )
      ),
      nextDecision: session.notes.current,
      lastUpdated: updatedAt,
    };
  }

  if (isPlainObject(dashboardState.progressState)) {
    const existingChecklist = Array.isArray(dashboardState.progressState.stageChecklist)
      ? (dashboardState.progressState.stageChecklist as Array<Record<string, unknown>>)
      : [];
    dashboardState.progressState = {
      ...dashboardState.progressState,
      activeGoal: session.session.goal,
      activeChunk: session.chunk.id,
      currentOwner: session.session.nextActor,
      blocked: session.session.status === "blocked",
      riskLevel: session.session.status === "blocked" ? "high" : "managed",
      nextAction: session.notes.current,
      stageChecklist: existingChecklist.map((item) => ({
        ...item,
        status: mappedChecklistStatuses.get(String(item.id || "")) ?? item.status,
      })),
    };
  }

  if (isPlainObject(dashboardState.governanceState)) {
    const latestApprovedStage =
      CHECKLIST_STAGE_ORDER
        .filter((stageId) => mappedChecklistStatuses.get(stageId) === "complete")
        .slice(-1)[0] ?? "governance-open";

    dashboardState.governanceState = {
      ...dashboardState.governanceState,
      latestApprovedStage,
      goalFrozen: session.governance.goalFrozen,
      status:
        session.session.status === "blocked"
          ? "attention-needed"
          : session.session.status === "closed"
            ? "governed"
            : "active",
      dashboardSyncStatus: "current",
    };
  }

  dashboardState.runtimeOrchestration = {
    mode: "planner-generator-evaluator",
    activeSessionId: setActive ? session.session.id : null,
    activeChunkId: session.chunk.id,
    currentPhase,
    nextActor: session.session.nextActor,
    nextAction: session.notes.current,
    contextPolicy: session.context.policy,
    contractCoverageRule:
      "No generator implementation begins before the evaluator-approved chunk contract exists.",
    evaluatorRule:
      "The generator may not self-approve; an independent evaluator records the pass or change-request verdict.",
    lastEventAt: session.events.length > 0 ? session.events[session.events.length - 1].at : updatedAt,
    stateFile: "docs/ai-harness/runtime/state/active-session.json",
    sessionIndexFile: "docs/ai-harness/runtime/state/session-index.json",
    sessionSummaryFile: `docs/ai-harness/runtime/sessions/${session.session.id}.md`,
    workPacketFile: workPacketPath,
    leaseStatus: runtimeIndex.lease.status,
    leasedAt: runtimeIndex.lease.leasedAt,
    queueDepth: runtimeIndex.queuedSessionIds.length,
    queuedSessionIds: runtimeIndex.queuedSessionIds,
    recentEvents: session.events.slice(-5).map((event) => ({
      at: event.at,
      phase: event.phase,
      actor: event.actor,
      action: event.action,
      outcome: event.outcome,
      note: event.note,
    })),
  };

  upsertDashboardArtifact(
    dashboardState,
    "runtime-readme",
    "Runtime Orchestrator Guide",
    "docs/ai-harness/runtime/README.md",
    "harness-implementation-orchestrator"
  );
  upsertDashboardArtifact(
    dashboardState,
    "runtime-session-index",
    "Runtime Session Index",
    "docs/ai-harness/runtime/state/session-index.json",
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    "runtime-active-session",
    "Active Runtime Session",
    "docs/ai-harness/runtime/state/active-session.json",
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    "runtime-current-work-packet",
    "Current Runtime Work Packet",
    "docs/ai-harness/runtime/state/current-work-packet.json",
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    `runtime-work-packet-${session.session.id}`,
    `Runtime Work Packet (${session.session.id})`,
    workPacketPath,
    "harness-dashboard-operator"
  );

  const sessionOutputs = uniqueStrings([
    ...session.artifacts,
    `docs/ai-harness/runtime/sessions/${session.session.id}.md`,
    "docs/ai-harness/runtime/state/active-session.json",
    workPacketPath,
  ]);
  const requestRecord = getSessionRequestRecord(session);
  const latestEvent = session.events[session.events.length - 1];
  const latestTraceRecord =
    latestEvent == null
      ? {
          originalRequest: requestRecord.originalRequest,
          processSummary: session.notes.current,
          resultSummary: session.notes.lastOutcome,
          source: "session-request-record",
          traceIntegrity: {
            status: "legacy-fallback",
            missingFields: ["event"],
            source: "session-request-record",
            warning:
              "No runtime event was available for this dashboard projection; use the session request record as limited display context.",
          } satisfies HarnessTaskTraceIntegrity,
        }
      : eventTraceRecord(latestEvent, requestRecord);
  const evaluationHistory = session.chunk.evaluationLoop?.history ?? [];
  const latestEvaluation =
    evaluationHistory.length > 0
      ? evaluationHistory[evaluationHistory.length - 1]
      : null;
  const residualRisk =
    latestEvaluation?.residualRisk ??
    (session.session.status === "blocked" ? session.notes.current : null);
  const reviewFindings = latestEvaluation?.findings ?? [];
  const requiredFixes = latestEvaluation?.requiredFixes ?? [];

  const sessionLog = Array.isArray(dashboardState.sessionLog)
    ? (dashboardState.sessionLog as Array<Record<string, unknown>>)
    : [];
  const sessionLogIndex = sessionLog.findIndex((entry) => entry.id === session.session.id);
  const sessionLogEntry = {
    id: session.session.id,
    title: session.session.title,
    status: session.session.status,
    stage: currentPhase,
    startedAt: session.session.createdAt,
    endedAt: session.session.updatedAt,
    owner: session.session.nextActor,
    outputs: sessionOutputs,
    taskTrace: {
      originalRequest: latestTraceRecord.originalRequest,
      processSummary: latestTraceRecord.processSummary,
      resultSummary: latestTraceRecord.resultSummary,
      recordedAt: latestEvent?.at ?? updatedAt,
      source: latestTraceRecord.source,
    },
    traceIntegrity: latestTraceRecord.traceIntegrity,
    residualRisk,
    note: session.notes.current,
  };
  if (sessionLogIndex >= 0) {
    sessionLog[sessionLogIndex] = {
      ...sessionLog[sessionLogIndex],
      ...sessionLogEntry,
    };
  } else {
    sessionLog.push(sessionLogEntry);
  }
  dashboardState.sessionLog = sessionLog;

  const governedSessions = Array.isArray(dashboardState.governedSessions)
    ? (dashboardState.governedSessions as Array<Record<string, unknown>>)
    : [];
  const governedIndex = governedSessions.findIndex(
    (entry) => entry.id === session.session.id
  );
  const existingGoverned = governedIndex >= 0 ? governedSessions[governedIndex] : {};
  const governedEntry = {
    id: session.session.id,
    title: session.session.title,
    status: session.session.status,
    owner: session.session.nextActor,
    agentRole: session.session.nextActor,
    governanceStatus:
      session.session.status === "blocked"
        ? "attention-needed"
        : session.session.status === "closed"
          ? "governed"
          : "active",
    goal: session.session.goal,
    chunkId: session.chunk.id,
    startedAt: session.session.createdAt,
    endedAt: session.session.updatedAt,
    governance: {
      opened: session.governance.opened,
      latestPlanRound: session.governance.latestPlanRound,
      latestReviewRound: session.governance.latestReviewRound,
      goalFrozen: session.governance.goalFrozen,
      contractApproved: session.governance.contractApproved,
      independentEvaluationPassed:
        session.governance.independentEvaluationPassed,
      governanceRefreshed: session.governance.governanceRefreshed,
      closeoutReady: session.governance.closeoutReady,
      evidenceFreshness: "current",
    },
    verification: {
      testsStatus: session.verification.testsStatus,
      reviewStatus: session.verification.reviewStatus,
      remediationStatus: session.verification.remediationStatus,
    },
    git: {
      branch: String(
        (isPlainObject(existingGoverned.git) ? existingGoverned.git.branch : undefined) ??
          (isPlainObject(dashboardState.gitStatus)
            ? (dashboardState.gitStatus as Record<string, unknown>).currentBranch
            : "TBD") ??
          "TBD"
      ),
      commit: String(
        (isPlainObject(existingGoverned.git) ? existingGoverned.git.commit : undefined) ??
          (isPlainObject(dashboardState.gitStatus) &&
          isPlainObject((dashboardState.gitStatus as Record<string, unknown>).lastCommit)
            ? (
                (dashboardState.gitStatus as Record<string, unknown>)
                  .lastCommit as Record<string, unknown>
              ).sha
            : "TBD") ??
          "TBD"
      ),
    },
    outputs: sessionOutputs,
    taskTrace: {
      originalRequest: latestTraceRecord.originalRequest,
      processSummary: latestTraceRecord.processSummary,
      resultSummary: latestTraceRecord.resultSummary,
      recordedAt: latestEvent?.at ?? updatedAt,
      source: latestTraceRecord.source,
    },
    traceIntegrity: latestTraceRecord.traceIntegrity,
    residualRisk,
    reviewFindings,
    requiredFixes,
    nextStep: session.notes.current,
  };
  if (governedIndex >= 0) {
    governedSessions[governedIndex] = {
      ...governedSessions[governedIndex],
      ...governedEntry,
    };
  } else {
    governedSessions.push(governedEntry);
  }
  dashboardState.governedSessions = governedSessions;

  const traceabilityRoot = isPlainObject(dashboardState.sessionTraceability)
    ? dashboardState.sessionTraceability
    : {};
  const traceEntries = Array.isArray(traceabilityRoot.entries)
    ? (traceabilityRoot.entries as Array<Record<string, unknown>>)
    : [];
  const traceEntry = {
    sessionId: session.session.id,
    title: session.session.title,
    status: session.session.status,
    phase: currentPhase,
    originalRequest: latestTraceRecord.originalRequest,
    processSummary: latestTraceRecord.processSummary,
    resultSummary: latestTraceRecord.resultSummary,
    traceIntegrity: latestTraceRecord.traceIntegrity,
    residualRisk,
    findings: reviewFindings,
    requiredFixes,
    evidenceRefs: sessionOutputs,
    nextStep: session.notes.current,
    recordedAt: latestEvent?.at ?? updatedAt,
    source: latestTraceRecord.source,
  };
  const traceIndex = traceEntries.findIndex(
    (entry) => String(entry.sessionId || "") === session.session.id
  );
  if (traceIndex >= 0) {
    traceEntries[traceIndex] = {
      ...traceEntries[traceIndex],
      ...traceEntry,
    };
  } else {
    traceEntries.push(traceEntry);
  }
  dashboardState.sessionTraceability = {
    schemaVersion: HARNESS_RUNTIME_VERSION,
    status: traceEntries.some((entry) =>
      String(
        isPlainObject(entry.traceIntegrity)
          ? entry.traceIntegrity.status
          : "unknown"
      ).includes("missing") ||
      String(
        isPlainObject(entry.traceIntegrity)
          ? entry.traceIntegrity.status
          : "unknown"
      ).includes("fallback")
    )
      ? "trace-debt"
      : "trace-complete",
    purpose:
      "Let users understand what was requested, what process ran, what result was recorded, what evidence backs it, and what should happen next without opening raw runtime JSON or chat history.",
    source:
      "Projected from governedSessions, runtime events, execution receipts, and session summaries.",
    integrityPolicy:
      "Missing taskTrace data must be flagged as projection debt; fallback notes may explain context but must not be presented as verified original/process/result trace.",
    entries: traceEntries,
  };

  const issues = Array.isArray(dashboardState.errors)
    ? (dashboardState.errors as Array<Record<string, unknown>>)
    : [];
  const runtimeIssueId = `runtime-${session.session.id}`;
  const issueIndex = issues.findIndex((issue) => issue.id === runtimeIssueId);
  if (session.session.status === "blocked") {
    const issue = {
      id: runtimeIssueId,
      severity: "warning",
      status: "open",
      summary: `Runtime session ${session.session.id} is blocked: ${session.notes.current}`,
      owner: session.session.nextActor,
      firstSeenAt:
        issueIndex >= 0 ? String(issues[issueIndex].firstSeenAt || updatedAt) : updatedAt,
      lastSeenAt: updatedAt,
    };
    if (issueIndex >= 0) {
      issues[issueIndex] = {
        ...issues[issueIndex],
        ...issue,
      };
    } else {
      issues.push(issue);
    }
  } else if (issueIndex >= 0) {
    issues[issueIndex] = {
      ...issues[issueIndex],
      status: "closed",
      summary: `Runtime session ${session.session.id} is no longer blocked.`,
      lastSeenAt: updatedAt,
    };
  }
  dashboardState.errors = issues;

  dashboardState.agentResumeBrief = {
    ...(isPlainObject(dashboardState.agentResumeBrief)
      ? dashboardState.agentResumeBrief
      : {}),
    currentProjectGoal: session.session.goal,
    activeService: String(
      (isPlainObject(dashboardState.serviceRegistry) &&
      Array.isArray(dashboardState.serviceRegistry.services) &&
      isPlainObject(dashboardState.serviceRegistry.services[0])
        ? dashboardState.serviceRegistry.services[0].id
        : "primary-service") ?? "primary-service"
    ),
    activeSession: setActive ? session.session.id : null,
    lastSafeCheckpoint: `Runtime phase ${currentPhase} recorded at ${updatedAt}.`,
    nextSafestAction: session.notes.current,
    currentRisk:
      residualRisk ??
      (session.session.status === "blocked"
        ? session.notes.current
        : "No evaluator residual risk is recorded for the active harness session."),
    openDecisions: session.session.status === "blocked" ? [runtimeIssueId] : [],
    blockers: session.session.status === "blocked" ? [runtimeIssueId] : [],
    validationCommands: [
      "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs verify-projections",
      "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh",
    ],
    authoritativeFiles: uniqueStrings([
      "docs/ai-harness/dashboard/events/harness-events.jsonl",
      "docs/ai-harness/dashboard/state/dashboard-state.json",
      "docs/ai-harness/dashboard/state/dashboard-index.json",
      "docs/ai-harness/runtime/state/session-index.json",
      "docs/ai-harness/runtime/state/active-session.json",
      workPacketPath,
    ]),
    dirtyStateWarning:
      "Refresh dashboard-ops.mjs after VCS changes to keep Git/SVN evidence current.",
    staleStateWarning: "Dashboard runtime projection was updated from the active harness session.",
    confidence: "high",
  };

  dashboardState.stakeholderBrief = {
    ...(isPlainObject(dashboardState.stakeholderBrief)
      ? dashboardState.stakeholderBrief
      : {}),
    currentGoal: session.session.goal,
    whatChangedSinceLastReview: `Harness session ${session.session.id} is now ${session.session.status} at ${currentPhase}.`,
    whyItMatters:
      "The project dashboard and AI runtime now share the same resumable work state.",
    currentRisk:
      residualRisk ??
      (session.session.status === "blocked"
        ? session.notes.current
        : "No active blocker recorded in the harness runtime."),
    requiredDecision:
      session.session.status === "blocked"
        ? session.notes.current
        : "Continue through the next governed runtime phase.",
    owner: session.session.nextActor,
    nextMilestone: currentPhase,
    evidenceLinks: sessionOutputs,
  };

  dashboardState.taskQueues = {
    waiting: runtimeIndex.queuedSessionIds,
    inProgress:
      setActive && !["closed", "complete"].includes(session.session.status)
        ? [session.session.id]
        : [],
    completed: session.session.status === "closed" ? [session.session.id] : [],
    blocked: session.session.status === "blocked" ? [session.session.id] : [],
    needsUser:
      session.session.nextActor === "operator" || session.session.status === "blocked"
        ? [session.session.id]
        : [],
    realWorld: [],
    failed: [],
  };

  const dashboardAgile = isPlainObject(dashboardState.agile)
    ? dashboardState.agile
    : {};
  const backlog = Array.isArray(dashboardAgile.backlog)
    ? (dashboardAgile.backlog as Array<Record<string, unknown>>)
    : [];
  const taskId = `task-${session.session.id}`;
  const taskIndex = backlog.findIndex((item) => String(item.id || "") === taskId);
  const taskEntry = {
    id: taskId,
    status:
      session.session.status === "closed"
        ? "completed"
        : session.session.status === "blocked"
          ? "blocked"
          : "in-progress",
    title: session.session.title,
    owner: session.session.nextActor,
    evidenceRefs: sessionOutputs,
  };
  if (taskIndex >= 0) {
    backlog[taskIndex] = { ...backlog[taskIndex], ...taskEntry };
  } else {
    backlog.push(taskEntry);
  }
  dashboardState.agile = {
    ...dashboardAgile,
    iteration: isPlainObject(dashboardAgile.iteration)
      ? { ...dashboardAgile.iteration, status: "active", goal: session.session.goal }
      : { id: "iteration-current", status: "active", goal: session.session.goal },
    backlog,
  };
  dashboardState.agileCadence = dashboardState.agile;

  const timelineRoot = isPlainObject(dashboardState.workTimeline)
    ? dashboardState.workTimeline
    : {};
  const timelineItems = Array.isArray(timelineRoot.items)
    ? (timelineRoot.items as Array<Record<string, unknown>>)
    : [];
  const timelineIndex = timelineItems.findIndex(
    (item) => String(item.id || "") === session.session.id
  );
  const timelineEntry = {
    id: session.session.id,
    title: session.session.title,
    status:
      session.session.status === "closed"
        ? "completed"
        : session.session.status === "blocked"
          ? "blocked"
          : "in-progress",
    lane: "Governed Sessions",
    owner: session.session.nextActor,
    startAt: session.session.createdAt,
    plannedStartAt: session.session.createdAt,
    plannedEndAt:
      session.session.status === "closed"
        ? session.session.updatedAt
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    endAt: session.session.status === "closed" ? session.session.updatedAt : null,
    progressPercent: Math.max(
      5,
      Math.round(
        (PHASE_DEFINITIONS.findIndex((phase) => phase.id === currentPhase) /
          (PHASE_DEFINITIONS.length - 1)) *
          100
      )
    ),
    kpiTags: ["cycle-time", "wip-aging", "handover-latency"],
    evidenceRefs: sessionOutputs,
  };
  if (timelineIndex >= 0) {
    timelineItems[timelineIndex] = {
      ...timelineItems[timelineIndex],
      ...timelineEntry,
    };
  } else {
    timelineItems.push(timelineEntry);
  }
  dashboardState.workTimeline = {
    ...timelineRoot,
    schemaVersion: HARNESS_RUNTIME_VERSION,
    defaultRange: String(timelineRoot.defaultRange || "this-month"),
    items: timelineItems,
  };

  const timeline = Array.isArray(dashboardState.operationsTimeline)
    ? (dashboardState.operationsTimeline as Array<Record<string, unknown>>)
    : [];
  timeline.push({
    id: `runtime-${session.session.id}-${session.events.length}`,
    type: "session-event",
    status: session.session.status,
    occurredAt: updatedAt,
    summary: `${session.session.id} moved through ${currentPhase}: ${session.notes.current}`,
    evidenceRefs: sessionOutputs,
  });
  dashboardState.operationsTimeline = timeline.slice(-50);

  dashboardState.governanceEvidenceBrief = {
    ...(isPlainObject(dashboardState.governanceEvidenceBrief)
      ? dashboardState.governanceEvidenceBrief
      : {}),
    evidenceCoverage: "runtime-current",
    unresolvedDecisions: session.session.status === "blocked" ? [runtimeIssueId] : [],
    staleProjections: [],
    failedValidations: uniqueStrings([
      ...(session.verification.testsStatus === "failed"
        ? [`session-${session.session.id}`]
        : []),
      ...(latestTraceRecord.traceIntegrity.status === "complete"
        ? []
        : [`trace-${session.session.id}`]),
    ]),
  };

  const missingEvidenceClaims = Array.isArray(
    (dashboardState.governanceEvidenceBrief as Record<string, unknown>).missingEvidenceClaims
  )
    ? ((dashboardState.governanceEvidenceBrief as Record<string, unknown>).missingEvidenceClaims as unknown[])
    : [];
  const unresolvedDecisions = Array.isArray(
    (dashboardState.governanceEvidenceBrief as Record<string, unknown>).unresolvedDecisions
  )
    ? ((dashboardState.governanceEvidenceBrief as Record<string, unknown>).unresolvedDecisions as unknown[])
    : [];
  const confidenceRoot = isPlainObject(dashboardState.projectionConfidence)
    ? dashboardState.projectionConfidence
    : {};
  dashboardState.projectionConfidence = {
    ...confidenceRoot,
    schemaVersion: HARNESS_RUNTIME_VERSION,
    status:
      latestTraceRecord.traceIntegrity.status === "complete" &&
      missingEvidenceClaims.length === 0 &&
      unresolvedDecisions.length === 0
        ? "runtime-current"
        : "projection-debt",
    completeness: String(
      (isPlainObject(dashboardState.worldModelCompleteness)
        ? dashboardState.worldModelCompleteness.status
        : confidenceRoot.completeness) || "runtime-current"
    ),
    staleness: "runtime-current",
    trustBoundaryStatus: String(
      isPlainObject(dashboardState.trustBoundary)
        ? dashboardState.trustBoundary.status || "runtime-updated"
        : "runtime-updated"
    ),
    missingEvidenceCount: missingEvidenceClaims.length,
    openDecisionCount: unresolvedDecisions.length,
    lastSuccessfulRefreshAt: updatedAt,
    lastSourceEventSequence: session.events.length,
    localListenerStatus: String(
      isPlainObject(dashboardState.listener)
        ? dashboardState.listener.status || "not-started"
        : "not-started"
    ),
    actionGate:
      latestTraceRecord.traceIntegrity.status === "complete"
        ? "Continue only from the current governed session, linked evidence, and refreshed projections."
        : "Resolve trace integrity debt before using this projection for handoff or closeout.",
    userMessage:
      latestTraceRecord.traceIntegrity.status === "complete"
        ? "Runtime session trace is current; remaining confidence depends on evidence and decision closure."
        : "Runtime session has trace debt; request/process/result continuity needs repair before trusted handoff.",
    requiredActions:
      latestTraceRecord.traceIntegrity.status === "complete"
        ? [
            "Refresh projections after material changes",
            "Link verification evidence before closeout",
          ]
        : [
            "Run audit_harness_runtime",
            "Repair missing taskTrace fields",
            "Record a governed result with original request, process summary, and result summary",
          ],
    evidenceRefs: [
      "sessionTraceability",
      "governanceEvidenceBrief",
      "runtimeOrchestration",
    ],
  };

  const listenerStartCommand = "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs ensure-listening";
  dashboardState.userRealityCheck = {
    ...(isPlainObject(dashboardState.userRealityCheck)
      ? dashboardState.userRealityCheck
      : {}),
    schemaVersion: HARNESS_RUNTIME_VERSION,
    status:
      latestTraceRecord.traceIntegrity.status === "complete"
        ? "runtime-action-plan"
        : "trace-debt-action-plan",
    generatedAt: updatedAt,
    summary: {
      currentReality: String(
        isPlainObject(dashboardState.goalCompass)
          ? dashboardState.goalCompass.currentReality || session.session.goal
          : session.session.goal
      ),
      goalState: session.session.goal,
      progressState: `${session.session.status}:${currentPhase}`,
      trustPosture:
        latestTraceRecord.traceIntegrity.status === "complete"
          ? "runtime-current"
          : "trace-debt",
      missingEvidenceCount: missingEvidenceClaims.length,
      openDecisionCount: unresolvedDecisions.length,
      activeDomainStressProfiles: isPlainObject(dashboardState.domainStress) &&
        Array.isArray(dashboardState.domainStress.activeProfileIds)
        ? dashboardState.domainStress.activeProfileIds
        : [],
      readableWithoutRawJson: true,
    },
    answers: [
      {
        question: "What is happening now?",
        answer: `Harness session ${session.session.id} is ${session.session.status} in ${currentPhase}.`,
        sourceRefs: ["runtimeOrchestration", "sessionTraceability"],
        apiRoutes: ["/api/harness-dashboard/v1/reality-check", "/api/harness-dashboard/v1/sessions"],
      },
      {
        question: "What was requested?",
        answer: latestTraceRecord.originalRequest,
        sourceRefs: ["sessionTraceability", "governedSessions.taskTrace"],
        apiRoutes: ["/api/harness-dashboard/v1/traceability"],
      },
      {
        question: "What should happen next?",
        answer: session.notes.current,
        sourceRefs: ["agentResumeBrief.nextSafestAction", "runtimeOrchestration"],
        apiRoutes: ["/api/harness-dashboard/v1/reality-check", "/api/harness-dashboard/v1/tasks"],
      },
    ],
    progressFlow: [
      {
        stage: "reality",
        title: "Runtime session reality",
        status: session.session.status,
        summary: `Harness session ${session.session.id} is ${session.session.status} in ${currentPhase}.`,
        sourceRefs: ["runtimeOrchestration", "sessionTraceability", "governedSessions"],
        nextStep: session.notes.current,
      },
      {
        stage: "risks",
        title: "Current risks",
        status:
          latestTraceRecord.traceIntegrity.status === "complete"
            ? "tracked"
            : "trace-debt",
        summary:
          latestTraceRecord.traceIntegrity.status === "complete"
            ? `Request trace is complete for: ${latestTraceRecord.originalRequest}`
            : "Request/process/result trace integrity needs repair before handoff.",
        sourceRefs: ["sessionTraceability", "governedSessions.taskTrace", "governanceEvidenceBrief"],
        nextStep:
          latestTraceRecord.traceIntegrity.status === "complete"
            ? "Continue from the latest governed phase."
            : "Repair request/process/result trace integrity before handoff.",
      },
      {
        stage: "next-actions",
        title: "Next action",
        status: session.session.status,
        summary: session.notes.current,
        sourceRefs: ["agentResumeBrief.nextSafestAction", "runtimeOrchestration"],
        nextStep: session.notes.current,
      },
      {
        stage: "proof-progress",
        title: "Proof and progress",
        status: missingEvidenceClaims.length || unresolvedDecisions.length ? "debt" : "tracked",
        summary: `${missingEvidenceClaims.length} evidence gaps and ${unresolvedDecisions.length} open decisions remain for this projection.`,
        sourceRefs: ["governanceEvidenceBrief", "dashboardQualityScorecard", "sessionTraceability"],
        nextStep: "Link verification evidence and residual-risk decisions before closeout.",
      },
      {
        stage: "local-api",
        title: "Local API proof path",
        status: "listener-required",
        summary:
          "Static snapshots keep the resume path readable; the local listener provides token-authenticated structured previews.",
        sourceRefs: ["listener", "dashboardRuntime", "userRealityCheck.apiContract"],
        nextStep: listenerStartCommand,
      },
    ],
    actionPlan: [
      {
        id: `action.${session.session.id}.next`,
        rank: 1,
        title: session.notes.current,
        status: session.session.status,
        owner: session.session.nextActor,
        whyItMatters:
          "This is the current governed runtime step and should be the only source for continuing the active chunk.",
        evidenceRequired:
          sessionOutputs.length > 0
            ? sessionOutputs
            : ["verification evidence", "request/process/result trace", "dashboard projection refresh"],
        command:
          "advance_harness_session or record_harness_execution_result with processSummary and resultSummary",
        apiRoutes: ["/api/harness-dashboard/v1/reality-check", "/api/harness-dashboard/v1/traceability"],
        blocks:
          session.session.status === "blocked"
            ? [runtimeIssueId]
            : ["closeout-without-verification"],
        successSignal:
          "The session advances or closes with linked verification evidence and refreshed dashboard projections.",
        sourceRefs: [
          "sessionTraceability",
          "runtimeOrchestration",
          "governanceEvidenceBrief",
        ],
      },
      {
        id: `action.${session.session.id}.verify`,
        rank: 2,
        title: "Link verification evidence before closeout",
        status:
          session.verification.testsStatus === "passed"
            ? "ready"
            : session.verification.testsStatus,
        owner: "evaluator",
        whyItMatters:
          "A user cannot trust progress or close governance until verification evidence is durable and traceable.",
        evidenceRequired: [
          "test command output or artifact path",
          "negative review verdict",
          "residual risk decision",
        ],
        command: "record_harness_execution_result",
        apiRoutes: ["/api/harness-dashboard/v1/traceability", "/api/harness-dashboard/v1/query"],
        blocks: ["governance-close", "handoff-confidence"],
        successSignal:
          "sessionTraceability resultSummary and residualRisk match the verification receipt.",
        sourceRefs: ["sessionTraceability", "governanceEvidenceBrief", "dashboardQualityScorecard"],
      },
    ],
    evidenceMap: [
      {
        id: "session-trace",
        label: "Runtime session trace",
        sourceRefs: ["sessionTraceability", "governedSessions", "runtimeOrchestration"],
        missingRefs:
          latestTraceRecord.traceIntegrity.status === "complete"
            ? []
            : ["request-process-result-trace"],
        apiRoutes: ["/api/harness-dashboard/v1/traceability"],
      },
      {
        id: "verification",
        label: "Verification and residual risk",
        sourceRefs: sessionOutputs,
        missingRefs:
          sessionOutputs.length > 0 ? [] : ["verification-evidence"],
        apiRoutes: ["/api/harness-dashboard/v1/reality-check", "/api/harness-dashboard/v1/query"],
      },
    ],
    apiContract: {
      route: "/api/harness-dashboard/v1/reality-check",
      readOnly: true,
      startCommand: listenerStartCommand,
      statusCommand: "node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs status",
      usefulFor: [
        "active session resume",
        "stakeholder progress readout",
        "local dashboard widgets",
        "deterministic evidence lookup",
      ],
      queryExamples: [
        `/api/harness-dashboard/v1/evidence-ref?ref=${session.session.id}`,
        `/api/harness-dashboard/v1/query?scope=reality-check&q=${session.session.id}`,
        "/api/harness-dashboard/v1/query?scope=traceability&q=resultSummary",
      ],
      security:
        "Loopback-only, token-protected, no shell execution, no file writes, no LLM calls.",
    },
  };

  writeJson(paths.dashboardStatePath, dashboardState);
}

function syncDashboardWithoutActiveLease(workspacePath: string): void {
  const paths = buildRuntimePaths(workspacePath);
  const runtimeIndex = loadRuntimeIndex(workspacePath);
  const nextQueuedId = runtimeIndex.queuedSessionIds[0] ?? null;
  const nextQueuedSession =
    nextQueuedId == null
      ? null
      : readJsonIfExists<HarnessRuntimeSessionState>(
          buildSessionStatePath(workspacePath, nextQueuedId)
        );
  const dashboardState = readJsonIfExists<Record<string, unknown>>(
    paths.dashboardStatePath
  );
  if (dashboardState == null) {
    return;
  }

  const existing = isPlainObject(dashboardState.runtimeOrchestration)
    ? dashboardState.runtimeOrchestration
    : {};
  dashboardState.runtimeOrchestration = {
    mode: "planner-generator-evaluator",
    activeSessionId: null,
    activeChunkId: String(
      nextQueuedSession?.chunk.id || existing.activeChunkId || "chunk-unset"
    ),
    currentPhase: String(
      nextQueuedSession?.session.currentPhase || "awaiting-session-start"
    ),
    nextActor: String(nextQueuedSession?.session.nextActor || "planner"),
    nextAction:
      nextQueuedId != null
        ? `Activate the next queued session: ${nextQueuedId}`
        : "Start the first governed runtime session before implementation begins.",
    contextPolicy: String(
      nextQueuedSession?.context.policy || existing.contextPolicy || "balanced"
    ),
    contractCoverageRule:
      "No generator implementation begins before the evaluator-approved chunk contract exists.",
    evaluatorRule:
      "The generator may not self-approve; an independent evaluator records the pass or change-request verdict.",
    lastEventAt: runtimeIndex.updatedAt,
    stateFile: "docs/ai-harness/runtime/state/active-session.json",
    sessionIndexFile: "docs/ai-harness/runtime/state/session-index.json",
    sessionSummaryFile:
      nextQueuedId != null
        ? `docs/ai-harness/runtime/sessions/${nextQueuedId}.md`
        : "docs/ai-harness/runtime/sessions/",
    workPacketFile:
      nextQueuedId != null
        ? `docs/ai-harness/runtime/work-packets/${nextQueuedId}.work-packet.json`
        : "docs/ai-harness/runtime/state/current-work-packet.json",
    leaseStatus: runtimeIndex.lease.status,
    leasedAt: runtimeIndex.lease.leasedAt,
    queueDepth: runtimeIndex.queuedSessionIds.length,
    queuedSessionIds: runtimeIndex.queuedSessionIds,
    recentEvents: [],
  };
  writeJson(paths.dashboardStatePath, dashboardState);
}

function syncDashboardAdapterHandoff(
  workspacePath: string,
  session: HarnessRuntimeSessionState,
  adapterId: HarnessRuntimeAdapterId,
  handoffMarkdownPath: string,
  checklistPath: string
): void {
  const paths = buildRuntimePaths(workspacePath);
  const dashboardState = readJsonIfExists<Record<string, unknown>>(
    paths.dashboardStatePath
  );
  if (dashboardState == null) {
    return;
  }

  const adapter = getHarnessRuntimeAdapter(adapterId);
  upsertDashboardArtifact(
    dashboardState,
    `runtime-adapter-${adapterId}`,
    `${adapter.title} Adapter Profile`,
    `docs/ai-harness/runtime/adapters/${adapterId}.md`,
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    `runtime-adapter-handoff-${session.session.id}-${adapterId}`,
    `${adapter.title} Handoff (${session.session.id})`,
    handoffMarkdownPath,
    "harness-dashboard-operator"
  );

  const governedSessions = Array.isArray(dashboardState.governedSessions)
    ? (dashboardState.governedSessions as Array<Record<string, unknown>>)
    : [];
  const governedIndex = governedSessions.findIndex(
    (entry) => String(entry.id || "") === session.session.id
  );
  if (governedIndex >= 0) {
    const existingOutputs = Array.isArray(governedSessions[governedIndex].outputs)
      ? (governedSessions[governedIndex].outputs as string[])
      : [];
    governedSessions[governedIndex] = {
      ...governedSessions[governedIndex],
      outputs: uniqueStrings([
        ...existingOutputs,
        handoffMarkdownPath,
        checklistPath,
      ]),
    };
    dashboardState.governedSessions = governedSessions;
  }

  const sessionLog = Array.isArray(dashboardState.sessionLog)
    ? (dashboardState.sessionLog as Array<Record<string, unknown>>)
    : [];
  const sessionLogIndex = sessionLog.findIndex(
    (entry) => String(entry.id || "") === session.session.id
  );
  if (sessionLogIndex >= 0) {
    const existingOutputs = Array.isArray(sessionLog[sessionLogIndex].outputs)
      ? (sessionLog[sessionLogIndex].outputs as string[])
      : [];
    sessionLog[sessionLogIndex] = {
      ...sessionLog[sessionLogIndex],
      outputs: uniqueStrings([
        ...existingOutputs,
        handoffMarkdownPath,
        checklistPath,
      ]),
    };
    dashboardState.sessionLog = sessionLog;
  }

  writeJson(paths.dashboardStatePath, dashboardState);
}

function syncDashboardExecutionBridge(
  workspacePath: string,
  session: HarnessRuntimeSessionState,
  bridgeId: HarnessRuntimeAdapterId,
  bridgeManifestPath: string,
  resultGuidePath: string
): void {
  const paths = buildRuntimePaths(workspacePath);
  const dashboardState = readJsonIfExists<Record<string, unknown>>(
    paths.dashboardStatePath
  );
  if (dashboardState == null) {
    return;
  }

  const bridge = getHarnessExecutionBridge(bridgeId);
  upsertDashboardArtifact(
    dashboardState,
    "runtime-current-execution-bridge",
    "Current Execution Bridge State",
    "docs/ai-harness/runtime/state/current-execution-bridge.json",
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    `runtime-bridge-profile-${bridgeId}`,
    `${bridge.title} Profile`,
    `docs/ai-harness/runtime/bridges/${bridgeId}.md`,
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    `runtime-execution-bridge-${session.session.id}-${bridgeId}`,
    `${bridge.title} Launch Bundle (${session.session.id})`,
    bridgeManifestPath,
    "harness-dashboard-operator"
  );

  const governedSessions = Array.isArray(dashboardState.governedSessions)
    ? (dashboardState.governedSessions as Array<Record<string, unknown>>)
    : [];
  const governedIndex = governedSessions.findIndex(
    (entry) => String(entry.id || "") === session.session.id
  );
  if (governedIndex >= 0) {
    const existingOutputs = Array.isArray(governedSessions[governedIndex].outputs)
      ? (governedSessions[governedIndex].outputs as string[])
      : [];
    governedSessions[governedIndex] = {
      ...governedSessions[governedIndex],
      outputs: uniqueStrings([
        ...existingOutputs,
        bridgeManifestPath,
        resultGuidePath,
      ]),
    };
    dashboardState.governedSessions = governedSessions;
  }

  writeJson(paths.dashboardStatePath, dashboardState);
}

function syncDashboardExecutionReceipt(
  workspacePath: string,
  session: HarnessRuntimeSessionState,
  bridgeId: HarnessRuntimeAdapterId,
  receiptPath: string,
  receiptMarkdownPath: string
): void {
  const paths = buildRuntimePaths(workspacePath);
  const dashboardState = readJsonIfExists<Record<string, unknown>>(
    paths.dashboardStatePath
  );
  if (dashboardState == null) {
    return;
  }

  const bridge = getHarnessExecutionBridge(bridgeId);
  upsertDashboardArtifact(
    dashboardState,
    `runtime-execution-receipt-${session.session.id}-${bridgeId}`,
    `${bridge.title} Receipt (${session.session.id})`,
    receiptMarkdownPath,
    "harness-dashboard-operator"
  );

  const governedSessions = Array.isArray(dashboardState.governedSessions)
    ? (dashboardState.governedSessions as Array<Record<string, unknown>>)
    : [];
  const governedIndex = governedSessions.findIndex(
    (entry) => String(entry.id || "") === session.session.id
  );
  if (governedIndex >= 0) {
    const existingOutputs = Array.isArray(governedSessions[governedIndex].outputs)
      ? (governedSessions[governedIndex].outputs as string[])
      : [];
    governedSessions[governedIndex] = {
      ...governedSessions[governedIndex],
      outputs: uniqueStrings([
        ...existingOutputs,
        receiptPath,
        receiptMarkdownPath,
      ]),
    };
    dashboardState.governedSessions = governedSessions;
  }

  writeJson(paths.dashboardStatePath, dashboardState);
}

function syncDashboardNativeExecution(
  workspacePath: string,
  session: HarnessRuntimeSessionState,
  bridgeId: HarnessRuntimeAdapterId,
  nativeExecutionPlanPath: string,
  nativeExecutionStatePath: string,
  stdoutLogPath: string,
  stderrLogPath: string,
  lastMessagePath: string
): void {
  const paths = buildRuntimePaths(workspacePath);
  const dashboardState = readJsonIfExists<Record<string, unknown>>(
    paths.dashboardStatePath
  );
  if (dashboardState == null) {
    return;
  }

  const executor = getHarnessNativeExecutor(bridgeId);
  const nativeExecutionState = readJsonIfExists<Record<string, unknown>>(
    path.join(workspacePath, nativeExecutionStatePath)
  );
  upsertDashboardArtifact(
    dashboardState,
    "runtime-native-executors-guide",
    "Native Executors Guide",
    "docs/ai-harness/runtime/native-executors/README.md",
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    "runtime-current-native-execution",
    "Current Native Execution State",
    "docs/ai-harness/runtime/state/current-native-execution.json",
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    `runtime-native-execution-plan-${session.session.id}-${bridgeId}`,
    `${executor.title} Plan (${session.session.id})`,
    nativeExecutionPlanPath,
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    `runtime-native-execution-state-${session.session.id}-${bridgeId}`,
    `${executor.title} State (${session.session.id})`,
    nativeExecutionStatePath,
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    `runtime-native-execution-stdout-${session.session.id}-${bridgeId}`,
    `${executor.title} Stdout (${session.session.id})`,
    stdoutLogPath,
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    `runtime-native-execution-stderr-${session.session.id}-${bridgeId}`,
    `${executor.title} Stderr (${session.session.id})`,
    stderrLogPath,
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    `runtime-native-execution-last-message-${session.session.id}-${bridgeId}`,
    `${executor.title} Last Message (${session.session.id})`,
    lastMessagePath,
    "harness-dashboard-operator"
  );

  if (
    typeof dashboardState.runtimeOrchestration === "object" &&
    dashboardState.runtimeOrchestration !== null
  ) {
    dashboardState.runtimeOrchestration = {
      ...dashboardState.runtimeOrchestration,
      nativeExecutionStateFile: nativeExecutionStatePath,
      nativeExecutionPlanFile: nativeExecutionPlanPath,
      nativeExecutorBridgeId: bridgeId,
      nativeExecutionStatus: String(nativeExecutionState?.status ?? "unknown"),
      nativeExecutionErrorCode:
        nativeExecutionState?.errorCode == null
          ? null
          : String(nativeExecutionState.errorCode),
      nativeExecutionErrorMessage:
        nativeExecutionState?.errorMessage == null
          ? null
          : String(nativeExecutionState.errorMessage),
    };
  }

  const governedSessions = Array.isArray(dashboardState.governedSessions)
    ? (dashboardState.governedSessions as Array<Record<string, unknown>>)
    : [];
  const governedIndex = governedSessions.findIndex(
    (entry) => String(entry.id || "") === session.session.id
  );
  if (governedIndex >= 0) {
    const existingOutputs = Array.isArray(governedSessions[governedIndex].outputs)
      ? (governedSessions[governedIndex].outputs as string[])
      : [];
    governedSessions[governedIndex] = {
      ...governedSessions[governedIndex],
      outputs: uniqueStrings([
        ...existingOutputs,
        nativeExecutionPlanPath,
        nativeExecutionStatePath,
        stdoutLogPath,
        stderrLogPath,
        lastMessagePath,
      ]),
    };
    dashboardState.governedSessions = governedSessions;
  }

  writeJson(paths.dashboardStatePath, dashboardState);
}

function syncDashboardRuntimeArchive(
  workspacePath: string,
  archiveId: string,
  archivedSessionIds: string[],
  archiveIndexPath: string,
  archiveBundlePath: string,
  archiveSummaryPath: string
): void {
  const paths = buildRuntimePaths(workspacePath);
  const dashboardState = readJsonIfExists<Record<string, unknown>>(
    paths.dashboardStatePath
  );
  if (dashboardState == null) {
    return;
  }

  upsertDashboardArtifact(
    dashboardState,
    "runtime-archive-guide",
    "Runtime Archive Guide",
    "docs/ai-harness/runtime/archive/README.md",
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    "runtime-archive-index",
    "Runtime Archive Index",
    archiveIndexPath,
    "harness-dashboard-operator"
  );
  upsertDashboardArtifact(
    dashboardState,
    `runtime-archive-bundle-${archiveId}`,
    `Runtime Archive Bundle (${archiveId})`,
    archiveSummaryPath,
    "harness-dashboard-operator"
  );

  const shouldKeepSession = (item: Record<string, unknown>) =>
    !archivedSessionIds.includes(String(item.id || ""));

  if (Array.isArray(dashboardState.sessionLog)) {
    dashboardState.sessionLog = (
      dashboardState.sessionLog as Array<Record<string, unknown>>
    ).filter(shouldKeepSession);
  }

  if (Array.isArray(dashboardState.governedSessions)) {
    dashboardState.governedSessions = (
      dashboardState.governedSessions as Array<Record<string, unknown>>
    ).filter(shouldKeepSession);
  }

  if (
    typeof dashboardState.runtimeOrchestration === "object" &&
    dashboardState.runtimeOrchestration !== null
  ) {
    dashboardState.runtimeOrchestration = {
      ...dashboardState.runtimeOrchestration,
      archiveIndexFile: archiveIndexPath,
      archivedSessionCount: archivedSessionIds.length,
      lastArchiveAt: nowIso(),
      lastArchiveBundle: archiveBundlePath,
    };
  }

  writeJson(paths.dashboardStatePath, dashboardState);
}

export function startHarnessSession(
  params: StartHarnessSessionParams
): HarnessRuntimeResult {
  const workspacePath = params.workspacePath;
  const expectedReadPaths = normalizeSafeWorkspaceRelativePaths(
    params.expectedReadPaths ?? [],
    "harness expected read paths"
  );
  const expectedWritePaths = normalizeSafeWorkspaceRelativePaths(
    params.expectedWritePaths ?? [],
    "harness expected write paths"
  );
  const runtimeIndex = ensureRuntimeIndex(workspacePath);
  const activeSession =
    runtimeIndex.activeSessionId != null
      ? loadSession(workspacePath, runtimeIndex.activeSessionId)
      : null;

  if (
    activeSession != null &&
    activeSession.session.status !== "closed" &&
    params.queueIfBusy === false
  ) {
    throw new Error(
      `Active session "${runtimeIndex.activeSessionId}" is still open. Activate queueing or close the current lease before starting a new session.`
    );
  }

  const metadata = loadWorkspaceMetadata(workspacePath);
  const startedAt = nowIso();
  const sessionId = buildSessionId(params.sessionId, params.goal);
  const chunkId = buildChunkId(params.chunkId, params.goal, sessionId);
  const requestRecord = {
    originalRequest: requireTraceInput(params.originalRequest, "originalRequest"),
    normalizedGoal: params.goal,
    capturedAt: startedAt,
    source: "start_harness_session",
  };

  const session: HarnessRuntimeSessionState = {
    schemaVersion: "1.0.0",
    workspace: {
      name: metadata.name,
      rootPath: workspacePath,
      projectType: metadata.projectType,
      purpose: metadata.purpose,
    },
    requestRecord,
    session: {
      id: sessionId,
      title: params.title?.trim() || buildDefaultSessionTitle(params.goal),
      goal: params.goal,
      status: "active",
      adoptionTrack: params.adoptionTrack ?? "greenfield",
      createdAt: startedAt,
      updatedAt: startedAt,
      currentPhase: "plan-1",
      nextActor: "planner",
      activeChunkId: chunkId,
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
      policy: params.contextPolicy ?? "balanced",
      resetCount: 0,
      lastResetAt: null,
      lastHandoverPath: null,
      pendingHandover: false,
    },
    chunk: {
      id: chunkId,
      title: params.chunkTitle?.trim() || buildDefaultSessionTitle(params.goal),
      status: "planning",
      summary: params.goal,
      outputs: [],
      dependencyNotes: params.dependencyNotes ?? null,
      contextInjectionNotes: params.contextInjectionNotes ?? null,
      expectedReadPaths,
      expectedWritePaths,
      verificationCommands: params.verificationCommands ?? [],
      assignedWorker: params.assignedWorker ?? null,
      dependencyMap: params.dependencyMap ?? [],
      mergeOwner: params.mergeOwner ?? null,
      integrationOwner: params.integrationOwner ?? null,
      parallelSafetyStatus: params.parallelSafetyStatus ?? "unclassified",
      evaluationLoop: {
        iteration: 0,
        threshold:
          params.evaluationThreshold ??
          "Repeat work -> evaluate -> improve until the contract is satisfied, critical findings are resolved, and the hub can explain residual risk.",
        status: "not-started",
        history: [],
      },
    },
    phases: buildPhaseRecords(
      {
        session: {
          id: sessionId,
          title: params.title?.trim() || buildDefaultSessionTitle(params.goal),
          goal: params.goal,
          status: "active",
          adoptionTrack: params.adoptionTrack ?? "greenfield",
          createdAt: startedAt,
          updatedAt: startedAt,
          currentPhase: "plan-1",
          nextActor: "planner",
          activeChunkId: chunkId,
        },
        chunk: {
          id: chunkId,
          title: params.chunkTitle?.trim() || buildDefaultSessionTitle(params.goal),
          status: "planning",
          summary: params.goal,
          outputs: [],
        },
      },
      startedAt
    ),
    events: [],
    artifacts: [],
    notes: {
      current: nextActionForPhase("plan-1"),
      lastOutcome: "session-started",
    },
  };

  ensureRuntimeArtifacts(workspacePath, session);
  const governanceArtifact = ensurePhaseArtifact(
    workspacePath,
    session,
    "governance-open"
  );
  const planArtifact = ensurePhaseArtifact(workspacePath, session, "plan-1");
  session.artifacts = uniqueStrings([
    governanceArtifact,
    planArtifact,
    "docs/ai-harness/runtime/README.md",
    "docs/ai-harness/runtime/state/session-index.json",
    "docs/ai-harness/runtime/state/active-session.json",
  ]);
  const startTaskTrace = requireTaskTrace({
    originalRequest: requestRecord.originalRequest,
    fallbackOriginalRequest: params.goal,
    processSummary: params.processSummary,
    resultSummary: params.resultSummary,
    recordedAt: startedAt,
    source: "start_harness_session",
  });
  session.events.push(createStartEvent(startedAt, governanceArtifact, startTaskTrace));
  appendPhaseUpdate(
    workspacePath,
    governanceArtifact,
    "planner",
    "complete",
    "Governance opened and the runtime session advanced to Plan 1.",
    [planArtifact ?? ""],
    startTaskTrace
  );
  appendHarnessDashboardLedgerEvent({
    workspacePath,
    eventType: "harness.session.started",
    sourceTool: "start_harness_session",
    session,
    payload: {
      sessionId,
      chunkId,
      requestRecord,
      taskTrace: startTaskTrace,
      artifactPaths: session.artifacts,
    },
    idempotencyKey: `harness-session-start:${sessionId}`,
    recordedAt: startedAt,
  });

  const shouldQueue =
    activeSession != null && activeSession.session.status !== "closed";
  if (shouldQueue) {
    session.notes.current =
      `Queued behind active session ${activeSession.session.id}. Activate this session when the current lease is released.`;
  }

  const saveResult = saveSession(workspacePath, session, {
    leaseMode: shouldQueue ? "preserve-active" : "assign-active",
    queueSession: shouldQueue,
  });
  const activePhase = activePhaseRecord(session);
  const effectivePhase = shouldQueue ? "queued" : session.session.currentPhase;
  const effectiveActor = shouldQueue ? activeSession?.session.nextActor ?? "planner" : session.session.nextActor;

  return {
    sessionId,
    currentPhase: session.session.currentPhase,
    nextActor: session.session.nextActor,
    sessionPath: saveResult.sessionPath,
    summaryPath: saveResult.summaryPath,
    activeArtifactPath: activePhase?.artifactPath ?? null,
    workPacketPath: saveResult.workPacketPath,
    workPacketMarkdownPath: saveResult.workPacketMarkdownPath,
    actorInboxPath: saveResult.actorInboxPath,
    summary: [
      shouldQueue
        ? `Harness session queued: ${session.session.id}`
        : `Harness session started: ${session.session.id}`,
      `Title: ${session.session.title}`,
      `Goal: ${session.session.goal}`,
      `Adoption track: ${session.session.adoptionTrack}`,
      `Current phase: ${effectivePhase}`,
      `Next actor: ${effectiveActor}`,
      `Active artifact: ${activePhase?.artifactPath ?? "n/a"}`,
      `Session state: ${saveResult.sessionPath}`,
      `Session summary: ${saveResult.summaryPath}`,
      `Work packet: ${saveResult.workPacketPath}`,
      `Actor inbox: ${saveResult.actorInboxPath}`,
      ...(shouldQueue
        ? [`Queue depth: ${runtimeIndex.queuedSessionIds.length + 1}`, `Current lease holder: ${activeSession?.session.id ?? "none"}`]
        : []),
      "",
      shouldQueue
        ? `Queued instruction:\n${session.notes.current}`
        : buildRoleBrief(session),
    ].join("\n"),
  };
}

function promoteQueuedSessionIfAvailable(
  workspacePath: string
): {
  session: HarnessRuntimeSessionState;
  sessionPath: string;
  summaryPath: string;
  workPacketPath: string;
  workPacketMarkdownPath: string;
  actorInboxPath: string;
} | null {
  const index = loadRuntimeIndex(workspacePath);
  const nextQueuedId = index.queuedSessionIds[0];
  if (nextQueuedId == null) {
    return null;
  }

  const nextSession = loadSession(workspacePath, nextQueuedId);
  const saveResult = saveSession(workspacePath, nextSession, {
    leaseMode: "assign-active",
    queueSession: false,
  });
  return {
    session: nextSession,
    sessionPath: saveResult.sessionPath,
    summaryPath: saveResult.summaryPath,
    workPacketPath: saveResult.workPacketPath,
    workPacketMarkdownPath: saveResult.workPacketMarkdownPath,
    actorInboxPath: saveResult.actorInboxPath,
  };
}

export function activateHarnessSession(
  workspacePath: string,
  sessionId: string,
  reason?: string,
  force?: boolean
): HarnessRuntimeResult {
  const index = loadRuntimeIndex(workspacePath);
  const targetSession = loadSession(workspacePath, sessionId);
  if (targetSession.session.status === "closed") {
    throw new Error(`Harness session "${sessionId}" is already closed and cannot be activated.`);
  }

  if (index.activeSessionId === sessionId) {
    return getHarnessSessionStatus(workspacePath, sessionId);
  }

  if (index.activeSessionId != null) {
    const currentActive = loadSession(workspacePath, index.activeSessionId);
    if (
      currentActive.session.status !== "closed" &&
      currentActive.session.status !== "blocked" &&
      force !== true
    ) {
      throw new Error(
        `Active lease is still held by "${currentActive.session.id}". Block, close, or force-switch it before activating another session.`
      );
    }

    if (currentActive.session.status !== "closed") {
      currentActive.notes.current =
        reason?.trim() ||
        `Lease moved to ${sessionId}. Resume this queued session when it becomes active again.`;
      saveSession(workspacePath, currentActive, {
        leaseMode: "preserve-active",
        queueSession: true,
      });
    }
  }

  targetSession.notes.current =
    reason?.trim() || targetSession.notes.current || nextActionForPhase(targetSession.session.currentPhase);
  const saveResult = saveSession(workspacePath, targetSession, {
    leaseMode: "assign-active",
    queueSession: false,
  });
  const activePhase = activePhaseRecord(targetSession);

  return {
    sessionId: targetSession.session.id,
    currentPhase: targetSession.session.currentPhase,
    nextActor: targetSession.session.nextActor,
    sessionPath: saveResult.sessionPath,
    summaryPath: saveResult.summaryPath,
    activeArtifactPath: activePhase?.artifactPath ?? null,
    workPacketPath: saveResult.workPacketPath,
    workPacketMarkdownPath: saveResult.workPacketMarkdownPath,
    actorInboxPath: saveResult.actorInboxPath,
    summary: [
      `Harness session activated: ${targetSession.session.id}`,
      `Current phase: ${targetSession.session.currentPhase}`,
      `Next actor: ${targetSession.session.nextActor}`,
      `Active artifact: ${activePhase?.artifactPath ?? "n/a"}`,
      `Session state: ${saveResult.sessionPath}`,
      `Session summary: ${saveResult.summaryPath}`,
      `Work packet: ${saveResult.workPacketPath}`,
      `Actor inbox: ${saveResult.actorInboxPath}`,
      "",
      buildRoleBrief(targetSession),
    ].join("\n"),
  };
}

function moveToPhase(
  session: HarnessRuntimeSessionState,
  nextPhaseId: HarnessPhaseId,
  changedAt: string,
  note: string
): HarnessPhaseRecord | undefined {
  const nextPhase = session.phases.find((phase) => phase.id === nextPhaseId);
  if (nextPhase == null) {
    return undefined;
  }

  nextPhase.status = nextPhaseId === "closed" ? "complete" : "active";
  nextPhase.startedAt = nextPhase.startedAt ?? changedAt;
  nextPhase.completedAt = nextPhaseId === "closed" ? changedAt : null;
  nextPhase.attempts += 1;
  nextPhase.lastNote = note;
  session.session.currentPhase = nextPhaseId;
  session.session.nextActor = nextPhase.actor;
  session.chunk.status = mapPhaseToChunkStatus(nextPhaseId);
  session.notes.current = nextActionForPhase(nextPhaseId);
  return nextPhase;
}

function normalizeReviewTextList(values: string[] | undefined): string[] {
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function shouldRecordEvaluationLoopEntry(
  phaseId: HarnessPhaseId,
  params: AdvanceHarnessSessionParams
): boolean {
  return (
    phaseId.startsWith("review-") ||
    phaseId === "independent-evaluation" ||
    phaseId === "verification" ||
    phaseId === "remediation" ||
    params.action === "request_changes" ||
    (params.reviewVerdict?.trim().length ?? 0) > 0 ||
    normalizeReviewTextList(params.findings).length > 0 ||
    normalizeReviewTextList(params.requiredFixes).length > 0 ||
    normalizeReviewTextList(params.verificationEvidence).length > 0
  );
}

function recordEvaluationLoopEntry(
  session: HarnessRuntimeSessionState,
  params: AdvanceHarnessSessionParams,
  phaseId: HarnessPhaseId,
  changedAt: string
): void {
  const loop = session.chunk.evaluationLoop;
  if (loop == null || !shouldRecordEvaluationLoopEntry(phaseId, params)) {
    return;
  }

  const findings = normalizeReviewTextList(params.findings);
  const requiredFixes = normalizeReviewTextList(params.requiredFixes);
  const verificationEvidence = normalizeReviewTextList(params.verificationEvidence);
  const verdict =
    params.reviewVerdict?.trim() ||
    (params.action === "request_changes"
      ? "negative-review-changes-required"
      : params.action === "complete"
        ? "accepted-for-next-phase"
        : params.action);
  const improvementAction =
    params.nextStep?.trim() ||
    (requiredFixes.length > 0
      ? requiredFixes.join("; ")
      : params.action === "request_changes"
        ? "Remediate required fixes, then re-run independent review and verification."
        : "Record verification evidence and continue the governed loop.");

  loop.iteration += 1;
  loop.status =
    params.action === "block"
      ? "blocked"
      : params.action === "request_changes"
        ? "running"
        : phaseId === "verification" && params.action === "complete"
          ? "passed"
          : "running";
  loop.history.push({
    at: changedAt,
    actor: params.actorRole,
    verdict,
    phase: phaseId,
    action: params.action,
    findings,
    requiredFixes,
    verificationEvidence,
    improvementAction,
    residualRisk: params.residualRisk?.trim() || null,
    scoreBefore: Number.isFinite(params.scoreBefore) ? params.scoreBefore ?? null : null,
    scoreAfter: Number.isFinite(params.scoreAfter) ? params.scoreAfter ?? null : null,
  });
}

function applyActionToSession(
  session: HarnessRuntimeSessionState,
  params: AdvanceHarnessSessionParams
): {
  currentPhase: HarnessPhaseRecord;
  nextPhase: HarnessPhaseRecord | undefined;
  outcome: string;
} {
  const currentPhase = activePhaseRecord(session);
  if (currentPhase == null) {
    throw new Error(`Session "${session.session.id}" has no active phase.`);
  }

  if (
    params.action !== "resume" &&
    currentPhase.actor !== params.actorRole &&
    !(currentPhase.id === "governance-close" && params.actorRole === "operator")
  ) {
    throw new Error(
      `Current phase "${currentPhase.id}" expects actor "${currentPhase.actor}", not "${params.actorRole}".`
    );
  }

  const changedAt = nowIso();
  session.session.updatedAt = changedAt;
  currentPhase.lastNote = params.note;
  recordEvaluationLoopEntry(session, params, currentPhase.id, changedAt);

  switch (params.action) {
    case "block":
      session.session.status = "blocked";
      currentPhase.status = "blocked";
      session.notes.current =
        params.nextStep?.trim() || `Resolve the blocker and resume ${currentPhase.id}.`;
      return {
        currentPhase,
        nextPhase: currentPhase,
        outcome: "blocked",
      };
    case "resume":
      if (session.session.status !== "blocked") {
        throw new Error("The runtime session is not blocked.");
      }
      session.session.status = "active";
      currentPhase.status = "active";
      session.notes.current =
        params.nextStep?.trim() || nextActionForPhase(currentPhase.id);
      return {
        currentPhase,
        nextPhase: currentPhase,
        outcome: "resumed",
      };
    case "context_reset": {
      const safeSessionId = normalizeRuntimePathSegment(session.session.id, "sessionId");
      const safeChunkId = normalizeRuntimePathSegment(session.chunk.id, "chunkId");
      const handoverPath = `docs/handovers/${safeSessionId}/${safeChunkId}-context-reset-${session.context.resetCount + 1}.md`;
      const fullHandoverPath = path.join(params.workspacePath, handoverPath);
      writeTextIfMissing(
        fullHandoverPath,
        `# Context Reset Handover\n\n- Session: \`${session.session.id}\`\n- Phase: \`${currentPhase.id}\`\n- Actor: ${params.actorRole}\n- Reason: ${params.note}\n- Resume with: ${params.nextStep?.trim() || nextActionForPhase(currentPhase.id)}\n`
      );
      appendPhaseUpdate(
        params.workspacePath,
        handoverPath,
        params.actorRole,
        params.action,
        params.note,
        params.artifactPaths ?? []
      );
      session.context.resetCount += 1;
      session.context.lastResetAt = changedAt;
      session.context.lastHandoverPath = handoverPath;
      session.context.pendingHandover = false;
      session.notes.current =
        params.nextStep?.trim() ||
        `Resume ${currentPhase.id} from the latest handover and keep scope bounded.`;
      session.artifacts = uniqueStrings([
        ...session.artifacts,
        handoverPath,
        ...(params.artifactPaths ?? []),
      ]);
      return {
        currentPhase,
        nextPhase: currentPhase,
        outcome: "context-reset",
      };
    }
    case "complete":
    case "request_changes": {
      session.session.status = "active";
      currentPhase.status =
        params.action === "complete" ? "complete" : "changes-requested";
      currentPhase.completedAt =
        params.action === "complete" ? changedAt : currentPhase.completedAt;

      const definition = PHASE_BY_ID.get(currentPhase.id);
      const targetPhaseId =
        params.action === "complete"
          ? definition?.nextOnComplete
          : definition?.nextOnChanges;
      if (targetPhaseId == null) {
        throw new Error(
          `Action "${params.action}" is not allowed from phase "${currentPhase.id}".`
        );
      }

      if (currentPhase.id.startsWith("plan-") && params.action === "complete") {
        session.governance.latestPlanRound = Math.max(
          session.governance.latestPlanRound,
          Number(currentPhase.id.slice(-1))
        );
      }
      if (currentPhase.id.startsWith("review-") && params.action === "complete") {
        session.governance.latestReviewRound = Math.max(
          session.governance.latestReviewRound,
          Number(currentPhase.id.slice(-1))
        );
      }
      if (currentPhase.id === "goal-freeze" && params.action === "complete") {
        session.governance.goalFrozen = true;
      }
      if (currentPhase.id === "contract-review") {
        session.governance.contractApproved = params.action === "complete";
      }
      if (currentPhase.id === "self-check" && params.action === "complete") {
        session.verification.testsStatus = "recorded";
      }
      if (currentPhase.id === "independent-evaluation") {
        if (params.action === "complete") {
          session.governance.independentEvaluationPassed = true;
          session.verification.reviewStatus = "approved";
        } else {
          session.governance.independentEvaluationPassed = false;
          session.verification.reviewStatus = "changes-requested";
          session.verification.remediationStatus = "required";
        }
      }
      if (currentPhase.id === "verification") {
        if (params.action === "complete") {
          session.verification.testsStatus =
            session.verification.testsStatus === "recorded"
              ? "passed"
              : session.verification.testsStatus;
          session.verification.reviewStatus = "approved";
          session.governance.closeoutReady = true;
        } else {
          session.verification.reviewStatus = "changes-requested";
          session.verification.remediationStatus = "required";
          session.governance.closeoutReady = false;
        }
      }
      if (currentPhase.id === "remediation" && params.action === "complete") {
        session.verification.remediationStatus = "complete";
      }
      if (currentPhase.id === "governance-refresh" && params.action === "complete") {
        session.governance.governanceRefreshed = true;
      }
      if (currentPhase.id === "governance-close" && params.action === "complete") {
        session.session.status = "closed";
        session.governance.closeoutReady = true;
      }

      const nextPhase = moveToPhase(
        session,
        targetPhaseId,
        changedAt,
        params.note
      );
      if (targetPhaseId === "closed") {
        session.session.status = "closed";
      }
      session.notes.current =
        params.nextStep?.trim() || nextActionForPhase(targetPhaseId);
      return {
        currentPhase,
        nextPhase,
        outcome:
          params.action === "complete"
            ? `advanced-to-${targetPhaseId}`
            : `returned-to-${targetPhaseId}`,
      };
    }
  }
}

export function advanceHarnessSession(
  params: AdvanceHarnessSessionParams
): HarnessRuntimeResult {
  const artifactPaths = normalizeSafeWorkspaceRelativePaths(
    params.artifactPaths ?? [],
    "harness artifact paths"
  );
  const safeParams = {
    ...params,
    artifactPaths,
  };
  const index = loadRuntimeIndex(params.workspacePath);
  const sessionId = resolveSessionId(params.workspacePath, params.sessionId);
  if (index.activeSessionId !== sessionId) {
    throw new Error(
      `Harness session "${sessionId}" does not currently hold the active lease. Activate it before advancing phases.`
    );
  }
  const session = loadSession(params.workspacePath, sessionId);
  const currentPhaseBefore = activePhaseRecord(session);
  const transition = applyActionToSession(session, safeParams);
  const requestRecord = getSessionRequestRecord(session);
  const taskTrace = requireTaskTrace({
    originalRequest: params.originalRequest,
    fallbackOriginalRequest: requestRecord.originalRequest,
    processSummary: params.processSummary,
    resultSummary: params.resultSummary,
    recordedAt: session.session.updatedAt,
    source: "advance_harness_session",
  });

  const currentArtifactPath =
    currentPhaseBefore?.artifactPath ??
    ensurePhaseArtifact(params.workspacePath, session, transition.currentPhase.id);
  if (currentArtifactPath != null) {
    appendPhaseUpdate(
      params.workspacePath,
      currentArtifactPath,
      params.actorRole,
      params.action,
      params.note,
      artifactPaths,
      taskTrace
    );
  }

  const nextArtifactPath =
    transition.nextPhase?.id != null
      ? ensurePhaseArtifact(params.workspacePath, session, transition.nextPhase.id)
      : null;
  if (transition.nextPhase != null) {
    transition.nextPhase.artifactPath = nextArtifactPath;
  }

  const eventArtifactPaths = uniqueStrings([
    currentArtifactPath,
    nextArtifactPath,
    ...artifactPaths,
  ]);
  session.artifacts = uniqueStrings([...session.artifacts, ...eventArtifactPaths]);
  session.chunk.outputs = uniqueStrings([
    ...session.chunk.outputs,
    ...eventArtifactPaths,
  ]);
  session.events.push({
    id: nextEventId(session),
    at: session.session.updatedAt,
    phase: transition.currentPhase.id,
    actor: params.actorRole,
    action: params.action,
    outcome: transition.outcome,
    note: params.note,
    artifactPaths: eventArtifactPaths,
    taskTrace,
  });
  appendHarnessDashboardLedgerEvent({
    workspacePath: params.workspacePath,
    eventType: "harness.session.advanced",
    sourceTool: "advance_harness_session",
    session,
    payload: {
      sessionId,
      phase: transition.currentPhase.id,
      action: params.action,
      outcome: transition.outcome,
      note: params.note,
      taskTrace,
      artifactPaths: eventArtifactPaths,
      reviewVerdict: params.reviewVerdict ?? null,
      findings: normalizeReviewTextList(params.findings),
      requiredFixes: normalizeReviewTextList(params.requiredFixes),
      verificationEvidence: normalizeReviewTextList(params.verificationEvidence),
      scoreBefore: params.scoreBefore ?? null,
      scoreAfter: params.scoreAfter ?? null,
    },
    causationId: session.events[session.events.length - 2]?.id ?? null,
    idempotencyKey: `harness-session-advance:${sessionId}:${session.events.length}:${params.action}`,
    recordedAt: session.session.updatedAt,
  });
  session.notes.lastOutcome = transition.outcome;
  let saveResult;
  let responseSession = session;
  if (session.session.status === "closed") {
    saveResult = saveSession(params.workspacePath, session, {
      leaseMode: "release-if-current",
      queueSession: false,
      syncDashboard: false,
    });
    syncDashboardFromSession(params.workspacePath, session, false);
    const promoted = promoteQueuedSessionIfAvailable(params.workspacePath);
    if (promoted == null) {
      syncDashboardWithoutActiveLease(params.workspacePath);
    } else {
      responseSession = promoted.session;
      saveResult = {
        sessionPath: promoted.sessionPath,
        summaryPath: promoted.summaryPath,
        workPacketPath: promoted.workPacketPath,
        workPacketMarkdownPath: promoted.workPacketMarkdownPath,
        actorInboxPath: promoted.actorInboxPath,
      };
    }
  } else {
    saveResult = saveSession(params.workspacePath, session, {
      leaseMode: "assign-active",
      queueSession: false,
    });
  }
  const activePhase = activePhaseRecord(responseSession);

  return {
    sessionId: responseSession.session.id,
    currentPhase: responseSession.session.currentPhase,
    nextActor: responseSession.session.nextActor,
    sessionPath: saveResult.sessionPath,
    summaryPath: saveResult.summaryPath,
    activeArtifactPath: activePhase?.artifactPath ?? null,
    workPacketPath: saveResult.workPacketPath,
    workPacketMarkdownPath: saveResult.workPacketMarkdownPath,
    actorInboxPath: saveResult.actorInboxPath,
    summary: [
      `Harness session updated: ${session.session.id}`,
      `Action: ${params.action}`,
      `Outcome: ${transition.outcome}`,
      `Current phase: ${responseSession.session.currentPhase}`,
      `Next actor: ${responseSession.session.nextActor}`,
      `Active artifact: ${activePhase?.artifactPath ?? "n/a"}`,
      `Session state: ${saveResult.sessionPath}`,
      `Session summary: ${saveResult.summaryPath}`,
      `Work packet: ${saveResult.workPacketPath}`,
      `Actor inbox: ${saveResult.actorInboxPath}`,
      "",
      buildRoleBrief(responseSession),
    ].join("\n"),
  };
}

export function getHarnessSessionStatus(
  workspacePath: string,
  requestedSessionId?: string
): HarnessRuntimeResult {
  const runtimeIndex = loadRuntimeIndex(workspacePath);
  const sessionId = resolveSessionId(workspacePath, requestedSessionId);
  const session = loadSession(workspacePath, sessionId);
  const sessionPath = buildSessionStatePath(workspacePath, sessionId);
  const summaryPath = buildSessionSummaryPath(workspacePath, sessionId);
  const workPacketPath = buildWorkPacketStatePath(workspacePath, sessionId);
  const workPacketMarkdownPath = buildWorkPacketMarkdownPath(workspacePath, sessionId);
  const actorInboxPath = buildActorInboxPath(
    workspacePath,
    session.session.nextActor,
    sessionId
  );
  const activePhase = activePhaseRecord(session);
  const leaseStatus =
    runtimeIndex.activeSessionId === sessionId
      ? "active"
      : runtimeIndex.queuedSessionIds.includes(sessionId)
        ? "queued"
        : "inactive";

  return {
    sessionId,
    currentPhase: session.session.currentPhase,
    nextActor: session.session.nextActor,
    sessionPath: relativeToWorkspace(workspacePath, sessionPath),
    summaryPath: relativeToWorkspace(workspacePath, summaryPath),
    activeArtifactPath: activePhase?.artifactPath ?? null,
    workPacketPath: relativeToWorkspace(workspacePath, workPacketPath),
    workPacketMarkdownPath: relativeToWorkspace(workspacePath, workPacketMarkdownPath),
    actorInboxPath: relativeToWorkspace(workspacePath, actorInboxPath),
    summary: [
      `Harness session: ${session.session.id}`,
      `Title: ${session.session.title}`,
      `Status: ${session.session.status}`,
      `Lease status: ${leaseStatus}`,
      `Goal: ${session.session.goal}`,
      `Current phase: ${session.session.currentPhase}`,
      `Next actor: ${session.session.nextActor}`,
      `Chunk: ${session.chunk.id} (${session.chunk.title})`,
      `Context resets: ${session.context.resetCount}`,
      `Queue depth: ${runtimeIndex.queuedSessionIds.length}`,
      `Verification: tests=${session.verification.testsStatus}, review=${session.verification.reviewStatus}, remediation=${session.verification.remediationStatus}`,
      `State file: ${relativeToWorkspace(workspacePath, sessionPath)}`,
      `Summary file: ${relativeToWorkspace(workspacePath, summaryPath)}`,
      `Work packet: ${relativeToWorkspace(workspacePath, workPacketPath)}`,
      `Actor inbox: ${relativeToWorkspace(workspacePath, actorInboxPath)}`,
      "",
      buildRoleBrief(session),
    ].join("\n"),
  };
}

function resolveSessionLeaseStatus(
  runtimeIndex: HarnessSessionIndex,
  sessionId: string
): HarnessLeaseStatus {
  if (runtimeIndex.activeSessionId === sessionId) {
    return "active";
  }
  if (runtimeIndex.queuedSessionIds.includes(sessionId)) {
    return "queued";
  }
  return "inactive";
}

function eventWithTrace(
  event: HarnessRuntimeEvent,
  requestRecord: HarnessRuntimeSessionState["requestRecord"]
): HarnessRuntimeEvent {
  const traceIntegrity = taskTraceIntegrity(event);
  return {
    ...event,
    taskTrace: displayTaskTrace(event, requestRecord),
    traceIntegrity,
  };
}

export function listHarnessSessions(
  workspacePath: string,
  filter: "all" | "open" | "active" | "queued" | "blocked" | "closed" = "all"
): HarnessSessionListResult {
  const runtimeIndex = loadRuntimeIndex(workspacePath);
  const sessions = runtimeIndex.sessions
    .map((entry) => {
      const session = loadSession(workspacePath, entry.id);
      const requestRecord = getSessionRequestRecord(session);
      const leaseStatus = resolveSessionLeaseStatus(runtimeIndex, entry.id);
      const loop = session.chunk.evaluationLoop;
      return {
        id: session.session.id,
        title: session.session.title,
        status: session.session.status,
        leaseStatus,
        currentPhase: session.session.currentPhase,
        nextActor: session.session.nextActor,
        chunkId: session.chunk.id,
        updatedAt: session.session.updatedAt,
        originalRequest: requestRecord.originalRequest,
        eventCount: session.events.length,
        evaluationIteration: loop?.iteration ?? 0,
        evaluationStatus: loop?.status ?? "not-started",
        lastOutcome: session.notes.lastOutcome,
        nextAction: session.notes.current,
        sessionPath: entry.sessionPath,
        summaryPath: entry.summaryPath,
      };
    })
    .filter((session) => {
      switch (filter) {
        case "open":
          return session.status !== "closed";
        case "active":
          return session.leaseStatus === "active";
        case "queued":
          return session.leaseStatus === "queued";
        case "blocked":
          return session.status === "blocked";
        case "closed":
          return session.status === "closed";
        case "all":
          return true;
      }
    });

  return {
    activeSessionId: runtimeIndex.activeSessionId,
    queueDepth: runtimeIndex.queuedSessionIds.length,
    sessions,
    summary: [
      "Harness sessions:",
      `Active lease: ${runtimeIndex.activeSessionId ?? "none"}`,
      `Queue depth: ${runtimeIndex.queuedSessionIds.length}`,
      `Filter: ${filter}`,
      ...sessions.map(
        (session) =>
          `- ${session.id} | lease=${session.leaseStatus} | status=${session.status} | phase=${session.currentPhase} | next=${session.nextActor} | eval=${session.evaluationStatus}/${session.evaluationIteration} | events=${session.eventCount}\n  - Request: ${session.originalRequest}\n  - Next: ${session.nextAction}\n  - State: ${session.sessionPath}`
      ),
      sessions.length === 0 ? "- none" : "",
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
  };
}

export function getHarnessSessionLog(
  workspacePath: string,
  requestedSessionId?: string,
  limit = 20
): HarnessSessionLogResult {
  const sessionId = resolveSessionId(workspacePath, requestedSessionId);
  const session = loadSession(workspacePath, sessionId);
  const requestRecord = getSessionRequestRecord(session);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const events = session.events
    .slice(-safeLimit)
    .map((event) => eventWithTrace(event, requestRecord));
  const evaluationHistory =
    session.chunk.evaluationLoop?.history.slice(-safeLimit) ?? [];

  return {
    sessionId,
    events,
    evaluationHistory,
    summary: [
      `Harness session log: ${sessionId}`,
      `Original request: ${requestRecord.originalRequest}`,
      `Current phase: ${session.session.currentPhase}`,
      `Next actor: ${session.session.nextActor}`,
      `Events returned: ${events.length}`,
      `Evaluation records returned: ${evaluationHistory.length}`,
      "",
      "Recent events:",
      ...events.map((event) =>
        [
          `- ${event.at} | ${event.phase} | ${event.actor} | ${event.action} | ${event.outcome}`,
          `  - Process: ${event.taskTrace.processSummary}`,
          `  - Result: ${event.taskTrace.resultSummary}`,
          `  - Artifacts: ${event.artifactPaths.join(", ") || "none"}`,
        ].join("\n")
      ),
      events.length === 0 ? "- none" : "",
      "",
      "Evaluation loop:",
      ...evaluationHistory.map((entry) =>
        [
          `- ${entry.at} | ${entry.phase} | ${entry.actor} | ${entry.verdict}`,
          `  - Findings: ${entry.findings.join("; ") || "none"}`,
          `  - Required fixes: ${entry.requiredFixes.join("; ") || "none"}`,
          `  - Evidence: ${entry.verificationEvidence.join("; ") || "none"}`,
          `  - Score: ${entry.scoreBefore ?? "n/a"} -> ${entry.scoreAfter ?? "n/a"}`,
        ].join("\n")
      ),
      evaluationHistory.length === 0 ? "- none" : "",
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
  };
}

export function listHarnessRuntimeAdapters(): HarnessRuntimeAdapterCatalogResult {
  const adapters = HARNESS_RUNTIME_ADAPTERS.map((adapter) => ({
    id: adapter.id,
    title: adapter.title,
    runtimeFamily: adapter.runtimeFamily,
    handoffMode: adapter.handoffMode,
    summary: adapter.summary,
  }));

  return {
    adapters,
    summary: [
      "Available harness runtime adapters:",
      ...HARNESS_RUNTIME_ADAPTERS.map(
        (adapter) =>
          `- ${adapter.id}: ${adapter.title} [${adapter.runtimeFamily} / ${adapter.handoffMode}] - ${adapter.summary}`
      ),
    ].join("\n"),
  };
}

export function listHarnessExecutionBridges(): HarnessExecutionBridgeCatalogResult {
  const bridges = HARNESS_EXECUTION_BRIDGES.map((bridge) => ({
    id: bridge.id,
    title: bridge.title,
    runtimeFamily: bridge.runtimeFamily,
    launchMode: bridge.launchMode,
    summary: bridge.summary,
  }));

  return {
    bridges,
    summary: [
      "Available harness execution bridges:",
      ...HARNESS_EXECUTION_BRIDGES.map(
        (bridge) =>
          `- ${bridge.id}: ${bridge.title} [${bridge.runtimeFamily} / ${bridge.launchMode}] - ${bridge.summary}`
      ),
    ].join("\n"),
  };
}

export function listHarnessNativeExecutors(): HarnessNativeExecutorCatalogResult {
  const executors = HARNESS_NATIVE_EXECUTORS.map((executor) => {
    const detected = detectNativeExecutor(executor);
    return {
      id: executor.id,
      title: executor.title,
      launchSupport: executor.launchSupport,
      available:
        executor.launchSupport === "native" ? detected.commandPath != null : false,
      detectedCommandPath: detected.commandPath,
      version: detected.version,
      summary: executor.summary,
    };
  });

  return {
    executors,
    summary: [
      "Available native executor integrations:",
      ...executors.map(
        (executor) =>
          `- ${executor.id}: ${executor.title} [${executor.launchSupport}] - available=${executor.available ? "yes" : "no"}${executor.detectedCommandPath != null ? ` | path=${executor.detectedCommandPath}` : ""}${executor.version != null ? ` | version=${executor.version}` : ""}`
      ),
    ].join("\n"),
  };
}

export function prepareHarnessNativeExecutor(
  workspacePath: string,
  bridgeId: HarnessRuntimeAdapterId,
  requestedSessionId?: string,
  options?: {
    executableOverride?: string;
    argsOverride?: string[];
  }
): PrepareHarnessNativeExecutorResult {
  const sessionId = resolveSessionId(workspacePath, requestedSessionId);
  const session = loadSession(workspacePath, sessionId);
  const bridge = getHarnessExecutionBridge(bridgeId);
  const executor = getHarnessNativeExecutor(bridgeId);
  const launchProfile = resolveNativeExecutorLaunchProfile(workspacePath, executor);
  const adapterHandoff = prepareHarnessAdapterHandoff(
    workspacePath,
    bridge.adapterId,
    sessionId
  );
  prepareHarnessExecutionBridge(workspacePath, bridgeId, sessionId);
  const nativePaths = buildNativeExecutionPaths(workspacePath, sessionId, bridgeId);
  const detected = detectNativeExecutor({
    ...executor,
    commandCandidates: launchProfile.commandCandidates,
  });
  const commandPath = options?.executableOverride?.trim() || detected.commandPath;
  const handoffMarkdownRelativePath = adapterHandoff.handoffMarkdownPath;
  const handoffMarkdownPath = path.join(workspacePath, handoffMarkdownRelativePath);
  const lastMessagePath = nativePaths.lastMessagePath;
  const lastMessageRelativePath = relativeToWorkspace(workspacePath, lastMessagePath);
  const actorInboxPath = buildActorInboxPath(
    workspacePath,
    session.session.nextActor,
    sessionId
  );
  let args = options?.argsOverride?.length
    ? options.argsOverride
    : applyArgumentTemplate(launchProfile.defaultArgsTemplate, {
        workspacePath,
        handoffMarkdownPath,
        handoffMarkdownRelativePath,
        handoffInstruction: buildHandoffInstruction(handoffMarkdownRelativePath),
        actorInboxPath,
        lastMessagePath,
        lastMessageRelativePath,
      });
  if (
    !options?.argsOverride?.length &&
    bridgeId === "claude-code" &&
    commandPath != null &&
    path.basename(commandPath).toLowerCase().includes("claude-code")
  ) {
    args = ["--cwd", workspacePath, "--prompt-file", handoffMarkdownPath];
  }
  const available =
    executor.launchSupport === "native"
      ? commandPath != null && commandPath.trim().length > 0
      : commandPath != null && commandPath.trim().length > 0;

  const plan = {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    sessionId,
    bridgeId,
    executor: {
      id: executor.id,
      title: executor.title,
      launchSupport: executor.launchSupport,
      summary: executor.summary,
      commandCandidates: launchProfile.commandCandidates,
      detectedCommandPath: detected.commandPath,
      version: detected.version,
    },
    launch: {
      available,
      commandPath,
      args,
      cwd: workspacePath,
      waitForExitRecommended: false,
      stdoutLogFile: relativeToWorkspace(workspacePath, nativePaths.stdoutLogPath),
      stderrLogFile: relativeToWorkspace(workspacePath, nativePaths.stderrLogPath),
      lastMessageFile: lastMessageRelativePath,
      stateFile: relativeToWorkspace(workspacePath, nativePaths.nativeExecutionStatePath),
    },
    sources: {
      adapterHandoffMarkdownFile: adapterHandoff.handoffMarkdownPath,
      bridgeManifestFile: relativeToWorkspace(
        workspacePath,
        buildExecutionBridgePaths(workspacePath, sessionId, bridgeId).bridgeManifestPath
      ),
    },
  };

  ensureDir(path.dirname(nativePaths.nativeExecutionPlanPath));
  writeJson(nativePaths.nativeExecutionPlanPath, plan);
  writeJson(nativePaths.nativeExecutionStatePath, {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    activeSessionId: sessionId,
    bridgeId,
    status: "prepared",
    launchMode: executor.launchSupport,
    nativeExecutionPlanFile: relativeToWorkspace(
      workspacePath,
      nativePaths.nativeExecutionPlanPath
    ),
    nativeExecutionStateFile: relativeToWorkspace(
      workspacePath,
      nativePaths.nativeExecutionStatePath
    ),
    stdoutLogFile: relativeToWorkspace(workspacePath, nativePaths.stdoutLogPath),
    stderrLogFile: relativeToWorkspace(workspacePath, nativePaths.stderrLogPath),
    lastMessageFile: lastMessageRelativePath,
    processId: null,
    executablePath: commandPath ?? null,
    summary: available
      ? `${executor.title} is prepared for execution.`
      : `${executor.title} requires installation or an explicit command override before launch.`,
  });
  writeJson(buildRuntimePaths(workspacePath).currentNativeExecutionPath, {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    activeSessionId: sessionId,
    bridgeId,
    status: "prepared",
    launchMode: executor.launchSupport,
    nativeExecutionPlanFile: relativeToWorkspace(
      workspacePath,
      nativePaths.nativeExecutionPlanPath
    ),
    nativeExecutionStateFile: relativeToWorkspace(
      workspacePath,
      nativePaths.nativeExecutionStatePath
    ),
    stdoutLogFile: relativeToWorkspace(workspacePath, nativePaths.stdoutLogPath),
    stderrLogFile: relativeToWorkspace(workspacePath, nativePaths.stderrLogPath),
    lastMessageFile: lastMessageRelativePath,
    processId: null,
    executablePath: commandPath ?? null,
    summary: available
      ? `${executor.title} is prepared for execution.`
      : `${executor.title} requires installation or an explicit command override before launch.`,
  });

  syncDashboardNativeExecution(
    workspacePath,
    session,
    bridgeId,
    relativeToWorkspace(workspacePath, nativePaths.nativeExecutionPlanPath),
    relativeToWorkspace(workspacePath, nativePaths.nativeExecutionStatePath),
    relativeToWorkspace(workspacePath, nativePaths.stdoutLogPath),
    relativeToWorkspace(workspacePath, nativePaths.stderrLogPath),
    lastMessageRelativePath
  );

  return {
    bridgeId,
    sessionId,
    available,
    nativeExecutionPlanPath: relativeToWorkspace(
      workspacePath,
      nativePaths.nativeExecutionPlanPath
    ),
    nativeExecutionStatePath: relativeToWorkspace(
      workspacePath,
      nativePaths.nativeExecutionStatePath
    ),
    stdoutLogPath: relativeToWorkspace(workspacePath, nativePaths.stdoutLogPath),
    stderrLogPath: relativeToWorkspace(workspacePath, nativePaths.stderrLogPath),
    lastMessagePath: lastMessageRelativePath,
    summary: [
      `Native executor prepared: ${sessionId} -> ${executor.title}`,
      `Available: ${available ? "yes" : "no"}`,
      `Plan: ${relativeToWorkspace(workspacePath, nativePaths.nativeExecutionPlanPath)}`,
      `State: ${relativeToWorkspace(workspacePath, nativePaths.nativeExecutionStatePath)}`,
      `Stdout log: ${relativeToWorkspace(workspacePath, nativePaths.stdoutLogPath)}`,
      `Stderr log: ${relativeToWorkspace(workspacePath, nativePaths.stderrLogPath)}`,
      `Last message: ${lastMessageRelativePath}`,
    ].join("\n"),
  };
}

export function launchHarnessNativeExecutor(
  params: LaunchHarnessNativeExecutorParams
): LaunchHarnessNativeExecutorResult {
  const hasLaunchOverride =
    params.executableOverride != null ||
    (params.argsOverride != null && params.argsOverride.length > 0) ||
    (params.env != null && Object.keys(params.env).length > 0);
  if (
    params.dryRun !== true &&
    hasLaunchOverride &&
    params.allowUnsafeNativeExecutorOverride !== true
  ) {
    throw new Error(
      "Native executor launch overrides require allowUnsafeNativeExecutorOverride=true. Use dryRun=true to inspect the resolved command plan safely."
    );
  }

  const sessionId = resolveSessionId(params.workspacePath, params.sessionId);
  const session = loadSession(params.workspacePath, sessionId);
  const prepared = prepareHarnessNativeExecutor(
    params.workspacePath,
    params.bridgeId,
    sessionId,
    {
      executableOverride: params.executableOverride,
      argsOverride: params.argsOverride,
    }
  );
  const executor = getHarnessNativeExecutor(params.bridgeId);
  const nativePaths = buildNativeExecutionPaths(
    params.workspacePath,
    sessionId,
    params.bridgeId
  );
  const plan = readJsonIfExists(nativePaths.nativeExecutionPlanPath) as Record<
    string,
    unknown
  > | null;
  if (plan == null) {
    throw new Error("Native execution plan could not be loaded.");
  }

  const launch = isPlainObject(plan.launch) ? plan.launch : {};
  const commandPath = String(launch.commandPath || "");
  const args = Array.isArray(launch.args) ? launch.args.map((item) => String(item)) : [];
  const timeoutMs = normalizePositiveIntegerOption(
    params.timeoutMs,
    DEFAULT_NATIVE_EXECUTOR_TIMEOUT_MS,
    "timeoutMs"
  );
  const maxOutputBytes = normalizePositiveIntegerOption(
    params.maxOutputBytes,
    DEFAULT_NATIVE_EXECUTOR_MAX_OUTPUT_BYTES,
    "maxOutputBytes"
  );
  if (!commandPath) {
    throw new Error(
      `${executor.title} is not currently launchable. Install the runtime or pass executableOverride.`
    );
  }

  if (params.dryRun === true) {
    return {
      bridgeId: params.bridgeId,
      sessionId,
      status: "dry-run",
      nativeExecutionPlanPath: prepared.nativeExecutionPlanPath,
      nativeExecutionStatePath: prepared.nativeExecutionStatePath,
      stdoutLogPath: prepared.stdoutLogPath,
      stderrLogPath: prepared.stderrLogPath,
      lastMessagePath: prepared.lastMessagePath,
      summary: [
        `Native executor dry run: ${executor.title}`,
        `Command: ${commandPath}`,
        `Args: ${args.join(" ")}`,
        `Timeout: ${timeoutMs}ms`,
        `Max output bytes: ${maxOutputBytes}`,
        `Plan: ${prepared.nativeExecutionPlanPath}`,
        `Last message: ${prepared.lastMessagePath}`,
      ].join("\n"),
    };
  }

  const env = {
    ...process.env,
    ...(params.env ?? {}),
  } as Record<string, string>;

  appendLogHeader(nativePaths.stdoutLogPath, [
    `# ${nowIso()} | launch | ${executor.title}`,
    `# command: ${commandPath} ${args.join(" ")}`,
  ]);
  appendLogHeader(nativePaths.stderrLogPath, [
    `# ${nowIso()} | launch | ${executor.title}`,
  ]);

  if (params.waitForExit === true) {
    const result = spawnSync(commandPath, args, {
      cwd: params.workspacePath,
      env,
      encoding: "utf-8",
      timeout: timeoutMs,
      maxBuffer: maxOutputBytes,
      windowsHide: true,
    });
    const cappedStdout = capTextByBytes(result.stdout ?? "", maxOutputBytes);
    const cappedStderr = capTextByBytes(result.stderr ?? "", maxOutputBytes);
    fs.appendFileSync(
      nativePaths.stdoutLogPath,
      cappedStdout.text,
      "utf-8"
    );
    fs.appendFileSync(
      nativePaths.stderrLogPath,
      cappedStderr.text,
      "utf-8"
    );

    const spawnError = result.error as NodeJS.ErrnoException | undefined;
    const outputTruncated =
      cappedStdout.truncated ||
      cappedStderr.truncated ||
      spawnError?.code === "ENOBUFS";
    const timeoutExceeded = spawnError?.code === "ETIMEDOUT";
    const status =
      result.status === 0 && result.error == null && !outputTruncated
        ? "completed"
        : "failed";
    const errorCode = timeoutExceeded
      ? "timeout"
      : outputTruncated
        ? "output-limit"
        : spawnError?.code ?? null;
    const errorMessage = spawnError?.message ?? null;
    const state = {
      schemaVersion: "1.0.0",
      generatedAt: nowIso(),
      activeSessionId: sessionId,
      bridgeId: params.bridgeId,
      status,
      launchMode: "foreground",
      nativeExecutionPlanFile: prepared.nativeExecutionPlanPath,
      nativeExecutionStateFile: prepared.nativeExecutionStatePath,
      stdoutLogFile: prepared.stdoutLogPath,
      stderrLogFile: prepared.stderrLogPath,
      lastMessageFile: prepared.lastMessagePath,
      processId: null,
      executablePath: commandPath,
      exitCode: result.status,
      errorCode,
      errorMessage,
      signal: result.signal ?? null,
      timeoutMs,
      maxOutputBytes,
      outputTruncated,
      summary:
        status === "completed"
          ? `${executor.title} completed in foreground mode.`
          : `${executor.title} failed in foreground mode.${errorCode != null ? ` (${errorCode})` : ""}`,
    };
    writeJson(nativePaths.nativeExecutionStatePath, state);
    writeJson(buildRuntimePaths(params.workspacePath).currentNativeExecutionPath, state);
    syncDashboardNativeExecution(
      params.workspacePath,
      session,
      params.bridgeId,
      prepared.nativeExecutionPlanPath,
      prepared.nativeExecutionStatePath,
      prepared.stdoutLogPath,
      prepared.stderrLogPath,
      prepared.lastMessagePath
    );

    return {
      bridgeId: params.bridgeId,
      sessionId,
      status,
      exitCode: result.status,
      errorCode,
      errorMessage,
      nativeExecutionPlanPath: prepared.nativeExecutionPlanPath,
      nativeExecutionStatePath: prepared.nativeExecutionStatePath,
      stdoutLogPath: prepared.stdoutLogPath,
      stderrLogPath: prepared.stderrLogPath,
      lastMessagePath: prepared.lastMessagePath,
      summary: [
        `Native executor launch finished: ${executor.title}`,
        `Status: ${status}`,
        `Exit code: ${String(result.status)}`,
        `Error code: ${String(errorCode ?? "none")}`,
        `Signal: ${String(result.signal ?? "none")}`,
        `Timeout: ${timeoutMs}ms`,
        `Output truncated: ${outputTruncated ? "yes" : "no"}`,
        `State: ${prepared.nativeExecutionStatePath}`,
        `Last message: ${prepared.lastMessagePath}`,
      ].join("\n"),
    };
  }

  const stdoutFd = fs.openSync(nativePaths.stdoutLogPath, "a");
  const stderrFd = fs.openSync(nativePaths.stderrLogPath, "a");
  let child: ChildProcess;
  try {
    child = spawn(commandPath, args, {
      cwd: params.workspacePath,
      env,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", stdoutFd, stderrFd],
    });
  } catch (err) {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
    const errorMessage = err instanceof Error ? err.message : String(err);
    markBackgroundNativeExecutionFailed(
      params.workspacePath,
      session,
      params.bridgeId,
      nativePaths,
      prepared,
      executor.title,
      commandPath,
      null,
      "spawn-error",
      errorMessage
    );
    return {
      bridgeId: params.bridgeId,
      sessionId,
      status: "failed",
      processId: undefined,
      errorCode: "spawn-error",
      errorMessage,
      nativeExecutionPlanPath: prepared.nativeExecutionPlanPath,
      nativeExecutionStatePath: prepared.nativeExecutionStatePath,
      stdoutLogPath: prepared.stdoutLogPath,
      stderrLogPath: prepared.stderrLogPath,
      lastMessagePath: prepared.lastMessagePath,
      summary: [
        `Native executor launch failed: ${executor.title}`,
        `Error code: spawn-error`,
        `Error message: ${errorMessage}`,
        `State: ${prepared.nativeExecutionStatePath}`,
      ].join("\n"),
    };
  } finally {
    try {
      fs.closeSync(stdoutFd);
    } catch {
      // ignore descriptor close failures after spawn setup
    }
    try {
      fs.closeSync(stderrFd);
    } catch {
      // ignore descriptor close failures after spawn setup
    }
  }

  child.once("error", (err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    markBackgroundNativeExecutionFailed(
      params.workspacePath,
      session,
      params.bridgeId,
      nativePaths,
      prepared,
      executor.title,
      commandPath,
      child.pid ?? null,
      "spawn-error",
      errorMessage
    );
  });
  child.once("exit", () => {
    // Status polling records the final exited state; timers only enforce guardrails.
  });

  const timeoutTimer = setTimeout(() => {
    if (child.pid == null || !isProcessRunning(child.pid)) {
      return;
    }
    terminateProcessTree(child.pid);
    markBackgroundNativeExecutionFailed(
      params.workspacePath,
      session,
      params.bridgeId,
      nativePaths,
      prepared,
      executor.title,
      commandPath,
      child.pid ?? null,
      "timeout",
      `Background native executor exceeded timeoutMs=${timeoutMs}.`
    );
  }, timeoutMs);
  timeoutTimer.unref?.();

  const outputGuardTimer = setInterval(() => {
    const stdoutBytes = fs.existsSync(nativePaths.stdoutLogPath)
      ? fs.statSync(nativePaths.stdoutLogPath).size
      : 0;
    const stderrBytes = fs.existsSync(nativePaths.stderrLogPath)
      ? fs.statSync(nativePaths.stderrLogPath).size
      : 0;
    if (stdoutBytes <= maxOutputBytes && stderrBytes <= maxOutputBytes) {
      return;
    }
    if (child.pid != null && isProcessRunning(child.pid)) {
      terminateProcessTree(child.pid);
    }
    appendLogHeader(nativePaths.stderrLogPath, [
      `# ${nowIso()} | output-limit | maxOutputBytes=${maxOutputBytes}`,
    ]);
    markBackgroundNativeExecutionFailed(
      params.workspacePath,
      session,
      params.bridgeId,
      nativePaths,
      prepared,
      executor.title,
      commandPath,
      child.pid ?? null,
      "output-limit",
      `Background native executor exceeded maxOutputBytes=${maxOutputBytes}.`
    );
    clearInterval(outputGuardTimer);
  }, 250);
  outputGuardTimer.unref?.();
  child.once("exit", () => {
    clearTimeout(timeoutTimer);
    clearInterval(outputGuardTimer);
  });
  child.unref();

  const state = {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    activeSessionId: sessionId,
    bridgeId: params.bridgeId,
    status: "launching",
    launchMode: "background",
    nativeExecutionPlanFile: prepared.nativeExecutionPlanPath,
    nativeExecutionStateFile: prepared.nativeExecutionStatePath,
    stdoutLogFile: prepared.stdoutLogPath,
    stderrLogFile: prepared.stderrLogPath,
    lastMessageFile: prepared.lastMessagePath,
    processId: child.pid ?? null,
    executablePath: commandPath,
    timeoutMs,
    maxOutputBytes,
    summary: `${executor.title} background launch requested; check status for spawn errors or exit state.`,
  };
  writeJson(nativePaths.nativeExecutionStatePath, state);
  writeJson(buildRuntimePaths(params.workspacePath).currentNativeExecutionPath, state);
  syncDashboardNativeExecution(
    params.workspacePath,
    session,
    params.bridgeId,
    prepared.nativeExecutionPlanPath,
    prepared.nativeExecutionStatePath,
    prepared.stdoutLogPath,
    prepared.stderrLogPath,
    prepared.lastMessagePath
  );

  return {
    bridgeId: params.bridgeId,
    sessionId,
    status: "launching",
    processId: child.pid,
    nativeExecutionPlanPath: prepared.nativeExecutionPlanPath,
    nativeExecutionStatePath: prepared.nativeExecutionStatePath,
    stdoutLogPath: prepared.stdoutLogPath,
    stderrLogPath: prepared.stderrLogPath,
    lastMessagePath: prepared.lastMessagePath,
    summary: [
      `Native executor launch requested: ${executor.title}`,
      `PID: ${String(child.pid ?? "unknown")}`,
      `Timeout: ${timeoutMs}ms`,
      `Max output bytes: ${maxOutputBytes}`,
      `State: ${prepared.nativeExecutionStatePath}`,
      `Last message: ${prepared.lastMessagePath}`,
    ].join("\n"),
  };
}

export function getHarnessNativeExecutionStatus(
  workspacePath: string,
  requestedSessionId?: string,
  bridgeId?: HarnessRuntimeAdapterId
): HarnessNativeExecutionStatusResult {
  const paths = buildRuntimePaths(workspacePath);
  let statePath = paths.currentNativeExecutionPath;

  if (requestedSessionId != null && bridgeId != null) {
    statePath = buildNativeExecutionPaths(
      workspacePath,
      requestedSessionId,
      bridgeId
    ).nativeExecutionStatePath;
  }

  const state = readJsonIfExists(statePath) as Record<string, unknown> | null;
  if (state == null) {
    throw new Error("Native execution state could not be loaded.");
  }

  const processId =
    typeof state.processId === "number" ? state.processId : null;
  let status = String(state.status || "unknown");
  if (
    processId != null &&
    ["launching", "launched", "running"].includes(status) &&
    !isProcessRunning(processId)
  ) {
    status = "exited";
    state.status = status;
    state.summary = `${String(state.bridgeId || "native executor")} exited without a recorded exit code.`;
    writeJson(statePath, state);
    if (statePath === paths.currentNativeExecutionPath) {
      writeJson(paths.currentNativeExecutionPath, state);
    }
  } else if (processId != null && status === "launching") {
    status = "running";
    state.status = status;
    state.summary = `${String(state.bridgeId || "native executor")} is running after the background launch request.`;
    writeJson(statePath, state);
    if (statePath === paths.currentNativeExecutionPath) {
      writeJson(paths.currentNativeExecutionPath, state);
    }
  }

  return {
    bridgeId: (state.bridgeId as HarnessRuntimeAdapterId | null) ?? null,
    sessionId: (state.activeSessionId as string | null) ?? null,
    status,
    nativeExecutionStatePath: relativeToWorkspace(workspacePath, statePath),
    lastMessagePath:
      typeof state.lastMessageFile === "string" ? state.lastMessageFile : null,
    errorCode: typeof state.errorCode === "string" ? state.errorCode : null,
    errorMessage: typeof state.errorMessage === "string" ? state.errorMessage : null,
    summary: [
      `Native execution status: ${status}`,
      `Session: ${String(state.activeSessionId || "none")}`,
      `Bridge: ${String(state.bridgeId || "none")}`,
      `Executable: ${String(state.executablePath || "n/a")}`,
      `Process ID: ${String(state.processId ?? "n/a")}`,
      `Error code: ${String(state.errorCode ?? "none")}`,
      `Last message: ${String(state.lastMessageFile || "none")}`,
      `State: ${relativeToWorkspace(workspacePath, statePath)}`,
    ].join("\n"),
  };
}

export function prepareHarnessWorkPacket(
  workspacePath: string,
  requestedSessionId?: string
): HarnessRuntimeResult {
  const runtimeIndex = loadRuntimeIndex(workspacePath);
  const sessionId = resolveSessionId(workspacePath, requestedSessionId);
  const session = loadSession(workspacePath, sessionId);
  const packetPaths = writeWorkPacket(workspacePath, session, runtimeIndex);
  if (runtimeIndex.activeSessionId == null) {
    writeIdleWorkPacket(workspacePath, runtimeIndex);
  }

  const activePhase = activePhaseRecord(session);
  const leaseStatus = resolveLeaseStatus(sessionId, runtimeIndex);

  return {
    sessionId,
    currentPhase: session.session.currentPhase,
    nextActor: session.session.nextActor,
    sessionPath: relativeToWorkspace(workspacePath, buildSessionStatePath(workspacePath, sessionId)),
    summaryPath: relativeToWorkspace(workspacePath, buildSessionSummaryPath(workspacePath, sessionId)),
    activeArtifactPath: activePhase?.artifactPath ?? null,
    workPacketPath: packetPaths.workPacketPath,
    workPacketMarkdownPath: packetPaths.workPacketMarkdownPath,
    actorInboxPath: packetPaths.actorInboxPath,
    summary: [
      `Harness work packet prepared: ${session.session.id}`,
      `Lease status: ${leaseStatus}`,
      `Current phase: ${session.session.currentPhase}`,
      `Next actor: ${session.session.nextActor}`,
      `Active artifact: ${activePhase?.artifactPath ?? "n/a"}`,
      `Work packet: ${packetPaths.workPacketPath}`,
      `Packet markdown: ${packetPaths.workPacketMarkdownPath}`,
      `Actor inbox: ${packetPaths.actorInboxPath}`,
      "",
      buildRoleBrief(session),
    ].join("\n"),
  };
}

export function prepareHarnessExecutionBridge(
  workspacePath: string,
  bridgeId: HarnessRuntimeAdapterId,
  requestedSessionId?: string
): HarnessExecutionBridgeResult {
  const runtimeIndex = loadRuntimeIndex(workspacePath);
  const sessionId = resolveSessionId(workspacePath, requestedSessionId);
  const session = loadSession(workspacePath, sessionId);
  const bridge = getHarnessExecutionBridge(bridgeId);
  const adapterHandoff = prepareHarnessAdapterHandoff(
    workspacePath,
    bridge.adapterId,
    sessionId
  );
  const handoff = readJsonIfExists<Record<string, unknown>>(
    path.join(workspacePath, adapterHandoff.handoffPath)
  );
  if (handoff == null) {
    throw new Error(
      `Adapter handoff for session "${sessionId}" and adapter "${bridge.adapterId}" could not be loaded.`
    );
  }

  const executionPaths = buildExecutionBridgePaths(workspacePath, sessionId, bridgeId);
  const handoffMarkdownRelativePath = adapterHandoff.handoffMarkdownPath;
  const nativePaths = buildNativeExecutionPaths(workspacePath, sessionId, bridgeId);
  const launchCommands = resolveBridgeCommands(workspacePath, bridge);
  const replacements = {
    workspacePath,
    handoffMarkdownPath: adapterHandoff.handoffMarkdownPath,
    handoffMarkdownRelativePath,
    handoffInstruction: buildHandoffInstruction(handoffMarkdownRelativePath),
    lastMessagePath: nativePaths.lastMessagePath,
    lastMessageRelativePath: relativeToWorkspace(workspacePath, nativePaths.lastMessagePath),
    actorInboxPath: String(
      (isPlainObject(handoff.fileReferences) ? handoff.fileReferences.actorInboxFile : "") || ""
    ),
    workPacketPath: String(
      (isPlainObject(handoff.fileReferences) ? handoff.fileReferences.workPacketFile : "") || ""
    ),
  };
  const manifest = {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    bridgeId,
    sessionId,
    nextActor: session.session.nextActor,
    currentPhase: session.session.currentPhase,
    bridge: {
      id: bridge.id,
      title: bridge.title,
      runtimeFamily: bridge.runtimeFamily,
      launchMode: bridge.launchMode,
      summary: bridge.summary,
    },
    handoff: {
      handoffJsonFile: adapterHandoff.handoffPath,
      handoffMarkdownFile: adapterHandoff.handoffMarkdownPath,
      launchChecklistFile: adapterHandoff.checklistPath,
      actorInboxFile: replacements.actorInboxPath,
      workPacketFile: replacements.workPacketPath,
    },
    compatibility: isPlainObject(handoff.compatibility)
      ? handoff.compatibility
      : {
          mcpServerVersion: HARNESS_RUNTIME_VERSION,
          adapterContractVersion: HARNESS_ADAPTER_CONTRACT_VERSION,
          adapterContractFile: HARNESS_ADAPTER_CONTRACT_PATH,
          versionIndexFile: HARNESS_VERSION_INDEX_PATH,
          compatibilityMatrixFile: HARNESS_COMPATIBILITY_MATRIX_PATH,
          sessionContinuityFile: HARNESS_SESSION_CONTINUITY_PATH,
          requiredInterfaceFields: [...HARNESS_REQUIRED_HANDOFF_FIELDS],
        },
    requestRecord: isPlainObject(handoff.requestRecord)
      ? handoff.requestRecord
      : null,
    taskTracePolicy: isPlainObject(handoff.taskTracePolicy)
      ? handoff.taskTracePolicy
      : null,
    launchCommands: {
      powershell: launchCommands.powershell.map((command) =>
        applyBridgeTemplate(command, replacements)
      ),
      bash: launchCommands.bash.map((command) =>
        applyBridgeTemplate(command, replacements)
      ),
    },
    resultExpectations: bridge.resultExpectations,
    resultArtifacts: {
      nativeLastMessageFile: relativeToWorkspace(workspacePath, nativePaths.lastMessagePath),
    },
    resultTemplateFile: relativeToWorkspace(workspacePath, executionPaths.resultTemplatePath),
    resultGuideFile: relativeToWorkspace(workspacePath, executionPaths.resultGuidePath),
  };

  ensureDir(executionPaths.bridgeDir);
  writeJson(executionPaths.bridgeManifestPath, manifest);
  fs.writeFileSync(
    executionPaths.launchPowershellPath,
    buildLaunchPowershell(manifest),
    "utf-8"
  );
  fs.writeFileSync(
    executionPaths.launchBashPath,
    buildLaunchBash(manifest),
    "utf-8"
  );
  writeJson(
    executionPaths.resultTemplatePath,
    buildExecutionResultTemplate(manifest)
  );
  fs.writeFileSync(
    executionPaths.resultGuidePath,
    buildExecutionBridgeGuide(manifest),
    "utf-8"
  );
  if (runtimeIndex.activeSessionId === sessionId) {
    writeJson(buildRuntimePaths(workspacePath).currentExecutionBridgePath, {
      schemaVersion: "1.0.0",
      generatedAt: nowIso(),
      activeSessionId: sessionId,
      bridgeId,
      launchMode: bridge.launchMode,
      bridgeManifestFile: relativeToWorkspace(
        workspacePath,
        executionPaths.bridgeManifestPath
      ),
      summary: `${bridge.title} is prepared for ${sessionId}.`,
    });
  }

  syncDashboardExecutionBridge(
    workspacePath,
    session,
    bridgeId,
    relativeToWorkspace(workspacePath, executionPaths.bridgeManifestPath),
    relativeToWorkspace(workspacePath, executionPaths.resultGuidePath)
  );

  return {
    bridgeId,
    sessionId,
    bridgeManifestPath: relativeToWorkspace(
      workspacePath,
      executionPaths.bridgeManifestPath
    ),
    launchPowershellPath: relativeToWorkspace(
      workspacePath,
      executionPaths.launchPowershellPath
    ),
    launchBashPath: relativeToWorkspace(workspacePath, executionPaths.launchBashPath),
    resultTemplatePath: relativeToWorkspace(
      workspacePath,
      executionPaths.resultTemplatePath
    ),
    resultGuidePath: relativeToWorkspace(workspacePath, executionPaths.resultGuidePath),
    summary: [
      `Harness execution bridge prepared: ${sessionId} -> ${bridge.title}`,
      `Current phase: ${session.session.currentPhase}`,
      `Next actor: ${session.session.nextActor}`,
      `Bridge manifest: ${relativeToWorkspace(workspacePath, executionPaths.bridgeManifestPath)}`,
      `PowerShell launcher: ${relativeToWorkspace(workspacePath, executionPaths.launchPowershellPath)}`,
      `Bash launcher: ${relativeToWorkspace(workspacePath, executionPaths.launchBashPath)}`,
      `Result template: ${relativeToWorkspace(workspacePath, executionPaths.resultTemplatePath)}`,
    ].join("\n"),
  };
}

export function prepareHarnessAdapterHandoff(
  workspacePath: string,
  adapterId: HarnessRuntimeAdapterId,
  requestedSessionId?: string
): HarnessAdapterHandoffResult {
  const runtimeIndex = loadRuntimeIndex(workspacePath);
  const adapter = getHarnessRuntimeAdapter(adapterId);
  const sessionId = resolveSessionId(workspacePath, requestedSessionId);
  const session = loadSession(workspacePath, sessionId);
  const packetPaths = writeWorkPacket(workspacePath, session, runtimeIndex);
  const handoffPaths = buildAdapterHandoffPaths(workspacePath, sessionId, adapterId);
  const sessionPath = buildSessionStatePath(workspacePath, sessionId);
  const summaryPath = buildSessionSummaryPath(workspacePath, sessionId);
  const adapterProfilePath = buildAdapterProfilePath(workspacePath, adapterId);
  const packet = readJsonIfExists<Record<string, unknown>>(
    path.join(workspacePath, packetPaths.workPacketPath)
  ) ?? {};
  const compatibility = {
    mcpServerVersion: HARNESS_RUNTIME_VERSION,
    adapterContractVersion: HARNESS_ADAPTER_CONTRACT_VERSION,
    adapterContractFile: HARNESS_ADAPTER_CONTRACT_PATH,
    versionIndexFile: HARNESS_VERSION_INDEX_PATH,
    compatibilityMatrixFile: HARNESS_COMPATIBILITY_MATRIX_PATH,
    sessionContinuityFile: HARNESS_SESSION_CONTINUITY_PATH,
    requiredInterfaceFields: [...HARNESS_REQUIRED_HANDOFF_FIELDS],
    switchingRule:
      "Read durable harness files before chat history and preserve session identity across runtime switches.",
  };
  const handoff = {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    adapterId,
    sessionId,
    leaseStatus: resolveLeaseStatus(sessionId, runtimeIndex),
    nextActor: session.session.nextActor,
    currentPhase: session.session.currentPhase,
    nextAction: session.notes.current,
    goal: session.session.goal,
    chunkId: session.chunk.id,
    chunkTitle: session.chunk.title,
    adapter: {
      id: adapter.id,
      title: adapter.title,
      runtimeFamily: adapter.runtimeFamily,
      handoffMode: adapter.handoffMode,
      summary: adapter.summary,
    },
    fileReferences: {
      workPacketFile: packetPaths.workPacketPath,
      workPacketMarkdownFile: packetPaths.workPacketMarkdownPath,
      actorInboxFile: packetPaths.actorInboxPath,
      sessionFile: relativeToWorkspace(workspacePath, sessionPath),
      sessionSummaryFile: relativeToWorkspace(workspacePath, summaryPath),
      rolePromptFile: rolePromptRelativePath(session.session.nextActor),
      adapterProfileFile: relativeToWorkspace(workspacePath, adapterProfilePath),
      adapterContractFile: HARNESS_ADAPTER_CONTRACT_PATH,
      versionIndexFile: HARNESS_VERSION_INDEX_PATH,
      compatibilityMatrixFile: HARNESS_COMPATIBILITY_MATRIX_PATH,
      sessionContinuityFile: HARNESS_SESSION_CONTINUITY_PATH,
    },
    operatorChecklist: adapter.operatorChecklist,
    runtimeExpectations: adapter.runtimeExpectations,
    compatibility,
    packet,
    requestRecord: packet.requestRecord ?? getSessionRequestRecord(session),
    taskTracePolicy: packet.taskTracePolicy ?? null,
    workingMemory: packet.workingMemory ?? null,
    evaluationLoop: packet.evaluationLoop ?? session.chunk.evaluationLoop ?? null,
    promptBlock: buildAdapterPromptBlock(session, adapter, packet),
  };

  ensureDir(handoffPaths.handoffDir);
  writeJson(handoffPaths.handoffPath, handoff);
  fs.writeFileSync(
    handoffPaths.handoffMarkdownPath,
    buildAdapterHandoffMarkdown(handoff),
    "utf-8"
  );
  fs.writeFileSync(
    handoffPaths.checklistPath,
    buildAdapterChecklistMarkdown(handoff),
    "utf-8"
  );

  syncDashboardAdapterHandoff(
    workspacePath,
    session,
    adapterId,
    relativeToWorkspace(workspacePath, handoffPaths.handoffMarkdownPath),
    relativeToWorkspace(workspacePath, handoffPaths.checklistPath)
  );

  return {
    adapterId,
    sessionId,
    handoffPath: relativeToWorkspace(workspacePath, handoffPaths.handoffPath),
    handoffMarkdownPath: relativeToWorkspace(
      workspacePath,
      handoffPaths.handoffMarkdownPath
    ),
    checklistPath: relativeToWorkspace(workspacePath, handoffPaths.checklistPath),
    summary: [
      `Harness adapter handoff prepared: ${sessionId} -> ${adapter.title}`,
      `Lease status: ${resolveLeaseStatus(sessionId, runtimeIndex)}`,
      `Current phase: ${session.session.currentPhase}`,
      `Next actor: ${session.session.nextActor}`,
      `Handoff JSON: ${relativeToWorkspace(workspacePath, handoffPaths.handoffPath)}`,
      `Handoff Markdown: ${relativeToWorkspace(workspacePath, handoffPaths.handoffMarkdownPath)}`,
      `Launch checklist: ${relativeToWorkspace(workspacePath, handoffPaths.checklistPath)}`,
    ].join("\n"),
  };
}

export function recordHarnessExecutionResult(
  params: RecordHarnessExecutionResultParams
): HarnessExecutionReceiptResult {
  const artifactPaths = normalizeSafeWorkspaceRelativePaths(
    params.artifactPaths ?? [],
    "harness execution receipt artifact paths"
  );
  const sessionId = resolveSessionId(params.workspacePath, params.sessionId);
  const session = loadSession(params.workspacePath, sessionId);
  const bridge = getHarnessExecutionBridge(params.bridgeId);
  const executionPaths = buildExecutionBridgePaths(
    params.workspacePath,
    sessionId,
    params.bridgeId
  );
  const recordedAt = nowIso();
  const requestRecord = getSessionRequestRecord(session);
  const taskTrace = requireTaskTrace({
    originalRequest: params.originalRequest,
    fallbackOriginalRequest: requestRecord.originalRequest,
    processSummary: params.processSummary,
    resultSummary: params.resultSummary,
    recordedAt,
    source: "record_harness_execution_result",
  });
  ensureDir(executionPaths.bridgeDir);
  const receipt = {
    schemaVersion: "1.0.0",
    recordedAt,
    sessionId,
    bridgeId: params.bridgeId,
    outcome: params.outcome,
    summary: params.summary,
    taskTrace,
    artifactPaths: uniqueStrings(artifactPaths),
    nextStep:
      params.nextStep?.trim() ||
      "Advance the governed session with the correct actor role and transition action.",
  };

  writeJson(executionPaths.receiptPath, receipt);
  fs.writeFileSync(
    executionPaths.receiptMarkdownPath,
    buildExecutionReceiptMarkdown(receipt),
    "utf-8"
  );
  appendHarnessDashboardLedgerEvent({
    workspacePath: params.workspacePath,
    eventType: "harness.execution.receipt.recorded",
    sourceTool: "record_harness_execution_result",
    session,
    payload: {
      sessionId,
      bridgeId: params.bridgeId,
      outcome: params.outcome,
      summary: params.summary,
      taskTrace,
      artifactPaths: uniqueStrings(artifactPaths),
      nextStep: receipt.nextStep,
    },
    idempotencyKey: `harness-execution-receipt:${sessionId}:${params.bridgeId}:${recordedAt}`,
    recordedAt,
  });

  syncDashboardExecutionReceipt(
    params.workspacePath,
    session,
    params.bridgeId,
    relativeToWorkspace(params.workspacePath, executionPaths.receiptPath),
    relativeToWorkspace(params.workspacePath, executionPaths.receiptMarkdownPath)
  );

  return {
    bridgeId: params.bridgeId,
    sessionId,
    receiptPath: relativeToWorkspace(params.workspacePath, executionPaths.receiptPath),
    receiptMarkdownPath: relativeToWorkspace(
      params.workspacePath,
      executionPaths.receiptMarkdownPath
    ),
    summary: [
      `Harness execution result recorded: ${sessionId} / ${bridge.title}`,
      `Outcome: ${params.outcome}`,
      `Receipt JSON: ${relativeToWorkspace(params.workspacePath, executionPaths.receiptPath)}`,
      `Receipt Markdown: ${relativeToWorkspace(params.workspacePath, executionPaths.receiptMarkdownPath)}`,
    ].join("\n"),
  };
}
