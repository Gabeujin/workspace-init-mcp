import * as fs from "node:fs";
import * as path from "node:path";

type HarnessActorRole = "planner" | "generator" | "evaluator" | "operator";
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
}

interface HarnessRuntimeSessionState {
  schemaVersion: string;
  workspace: {
    name: string;
    rootPath: string;
    projectType: string;
    purpose: string;
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
  title?: string;
  sessionId?: string;
  chunkId?: string;
  chunkTitle?: string;
  adoptionTrack?: AdoptionTrack;
  contextPolicy?: ContextPolicy;
  force?: boolean;
}

export interface AdvanceHarnessSessionParams {
  workspacePath: string;
  sessionId?: string;
  action: HarnessAction;
  actorRole: HarnessActorRole;
  note: string;
  artifactPaths?: string[];
  nextStep?: string;
}

export interface HarnessRuntimeResult {
  sessionId: string;
  currentPhase: HarnessPhaseId;
  nextActor: HarnessActorRole;
  sessionPath: string;
  summaryPath: string;
  activeArtifactPath: string | null;
  summary: string;
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

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
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

function buildRuntimePaths(workspacePath: string) {
  const runtimeRoot = path.join(workspacePath, "docs", "ai-harness", "runtime");
  const stateRoot = path.join(runtimeRoot, "state");
  const sessionsRoot = path.join(runtimeRoot, "sessions");

  return {
    runtimeRoot,
    stateRoot,
    sessionsRoot,
    sessionIndexPath: path.join(stateRoot, "session-index.json"),
    activeSessionPath: path.join(stateRoot, "active-session.json"),
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
  return path.join(paths.sessionsRoot, `${sessionId}.session.json`);
}

function buildSessionSummaryPath(workspacePath: string, sessionId: string): string {
  const paths = buildRuntimePaths(workspacePath);
  return path.join(paths.sessionsRoot, `${sessionId}.md`);
}

function ensureRuntimeIndex(workspacePath: string): HarnessSessionIndex {
  const paths = buildRuntimePaths(workspacePath);
  ensureDir(paths.stateRoot);
  ensureDir(paths.sessionsRoot);

  const existingIndex = readJsonIfExists<HarnessSessionIndex>(paths.sessionIndexPath);
  if (existingIndex != null) {
    return existingIndex;
  }

  const created: HarnessSessionIndex = {
    schemaVersion: "1.0.0",
    updatedAt: "bootstrap",
    activeSessionId: null,
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
    lastUpdatedAt: "bootstrap",
  };
  writeJson(paths.activeSessionPath, activeSessionTemplate);
  return created;
}

function relativeToWorkspace(workspacePath: string, targetPath: string): string {
  return path.relative(workspacePath, targetPath).replace(/\\/g, "/");
}

function phaseArtifactRelativePath(
  session: Pick<HarnessRuntimeSessionState, "session" | "chunk">,
  phaseId: HarnessPhaseId
): string | null {
  switch (phaseId) {
    case "governance-open":
      return `docs/context/${session.session.id}/governance-open.md`;
    case "plan-1":
    case "plan-2":
    case "plan-3":
      return `docs/plans/${session.session.id}/${phaseId}.md`;
    case "review-1":
    case "review-2":
    case "review-3":
      return `docs/reviews/${session.session.id}/${phaseId}.md`;
    case "goal-freeze":
      return `docs/plans/${session.session.id}/goal-freeze.md`;
    case "contract-proposal":
      return `docs/contracts/${session.session.id}/${session.chunk.id}-contract.md`;
    case "contract-review":
      return `docs/evaluations/${session.session.id}/${session.chunk.id}-contract-review.md`;
    case "implementation":
      return `docs/work-logs/${session.session.id}-${session.chunk.id}-implementation.md`;
    case "self-check":
      return `docs/reviews/${session.session.id}/self-check.md`;
    case "independent-evaluation":
      return `docs/evaluations/${session.session.id}/${session.chunk.id}-independent-evaluation.md`;
    case "remediation":
      return `docs/work-logs/${session.session.id}-${session.chunk.id}-remediation.md`;
    case "verification":
      return `docs/reviews/${session.session.id}/verification.md`;
    case "governance-refresh":
      return `docs/context/${session.session.id}/governance-refresh.md`;
    case "governance-close":
      return `docs/handovers/${session.session.id}/governance-close.md`;
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
  extraArtifacts: string[]
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

  if (extraArtifacts.length > 0) {
    lines.push(`- Linked artifacts: ${extraArtifacts.join(", ")}`);
  }

  appendText(path.join(workspacePath, relativePath), `${lines.join("\n")}\n`);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function buildSessionSummaryMarkdown(session: HarnessRuntimeSessionState): string {
  const recentEvents = session.events.slice(-8).reverse();
  const activePhase = session.phases.find(
    (phase) => phase.id === session.session.currentPhase
  );

  return `# ${session.session.title}

- Session ID: \`${session.session.id}\`
- Goal: ${session.session.goal}
- Status: ${session.session.status}
- Adoption track: ${session.session.adoptionTrack}
- Current phase: \`${session.session.currentPhase}\`
- Next actor: ${session.session.nextActor}
- Chunk: \`${session.chunk.id}\` (${session.chunk.title})
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

## Active Phase Artifact

${activePhase?.artifactPath ?? "n/a"}

## Runtime Artifacts

${session.artifacts.map((artifact) => `- ${artifact}`).join("\n") || "- none"}

## Recent Events

${recentEvents
  .map(
    (event) =>
      `- ${event.at} | ${event.phase} | ${event.actor} | ${event.action} | ${event.outcome} | ${event.note}`
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
    return provided.trim();
  }

  const stamp = nowIso().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = slugify(goal) || "governed-work";
  return `session-${stamp}-${suffix}`;
}

function buildChunkId(
  provided: string | undefined,
  goal: string,
  sessionId: string
): string {
  if (provided != null && provided.trim().length > 0) {
    return provided.trim();
  }

  return `chunk-${sessionId.replace(/^session-/, "")}-${slugify(goal) || "delivery"}`;
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
    return requestedSessionId.trim();
  }

  const index = ensureRuntimeIndex(workspacePath);
  if (index.activeSessionId == null) {
    throw new Error("No active harness session exists in this workspace.");
  }

  return index.activeSessionId;
}

function saveSession(
  workspacePath: string,
  session: HarnessRuntimeSessionState,
  setActive: boolean
): { sessionPath: string; summaryPath: string } {
  const sessionPath = buildSessionStatePath(workspacePath, session.session.id);
  const summaryPath = buildSessionSummaryPath(workspacePath, session.session.id);
  const index = ensureRuntimeIndex(workspacePath);
  const paths = buildRuntimePaths(workspacePath);

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
  index.updatedAt = session.session.updatedAt;
  index.activeSessionId = setActive ? session.session.id : null;
  writeJson(paths.sessionIndexPath, index);

  writeJson(paths.activeSessionPath, {
    schemaVersion: "1.0.0",
    mode: "planner-generator-evaluator",
    activeSessionId: setActive ? session.session.id : null,
    status: session.session.status,
    currentPhase: session.session.currentPhase,
    nextActor: session.session.nextActor,
    nextAction: session.notes.current,
    lastUpdatedAt: session.session.updatedAt,
    session,
  });

  syncDashboardFromSession(workspacePath, session, setActive);

  return {
    sessionPath: relativeToWorkspace(workspacePath, sessionPath),
    summaryPath: relativeToWorkspace(workspacePath, summaryPath),
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
    case "planner":
      return [
        ...baseLines,
        "Planner brief:",
        "- Keep the next step bounded, testable, and resumable.",
        "- Preserve the three-plan / three-review ladder before implementation.",
        "- Freeze the goal only when the chunk is explicit enough for contract review.",
      ].join("\n");
    case "generator":
      return [
        ...baseLines,
        "Generator brief:",
        "- Build only against the approved contract and current chunk scope.",
        "- Record test evidence, implementation tradeoffs, and remaining risk explicitly.",
        "- If drift appears, use context_reset instead of stretching the session context.",
      ].join("\n");
    case "evaluator":
      return [
        ...baseLines,
        "Evaluator brief:",
        "- Judge independently and do not self-approve generator work.",
        "- Use skeptical, evidence-backed findings when requesting changes.",
        "- Verification is not complete until the contract is actually satisfied.",
      ].join("\n");
    default:
      return [...baseLines, "Operator brief:", "- Keep governance, dashboard, and session artifacts synchronized."].join("\n");
  }
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
  activeArtifactPath: string | null
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

  const sessionOutputs = uniqueStrings([
    ...session.artifacts,
    `docs/ai-harness/runtime/sessions/${session.session.id}.md`,
    "docs/ai-harness/runtime/state/active-session.json",
  ]);

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

  writeJson(paths.dashboardStatePath, dashboardState);
}

export function startHarnessSession(
  params: StartHarnessSessionParams
): HarnessRuntimeResult {
  const workspacePath = params.workspacePath;
  const runtimeIndex = ensureRuntimeIndex(workspacePath);

  if (runtimeIndex.activeSessionId != null && params.force !== true) {
    const activeSession = loadSession(workspacePath, runtimeIndex.activeSessionId);
    if (activeSession.session.status !== "closed") {
      throw new Error(
        `Active session "${runtimeIndex.activeSessionId}" is still open. Close it or pass force: true to replace the active pointer.`
      );
    }
  }

  const metadata = loadWorkspaceMetadata(workspacePath);
  const startedAt = nowIso();
  const sessionId = buildSessionId(params.sessionId, params.goal);
  const chunkId = buildChunkId(params.chunkId, params.goal, sessionId);

  const session: HarnessRuntimeSessionState = {
    schemaVersion: "1.0.0",
    workspace: {
      name: metadata.name,
      rootPath: workspacePath,
      projectType: metadata.projectType,
      purpose: metadata.purpose,
    },
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
  session.events.push(createStartEvent(startedAt, governanceArtifact));
  appendPhaseUpdate(
    workspacePath,
    governanceArtifact,
    "planner",
    "complete",
    "Governance opened and the runtime session advanced to Plan 1.",
    [planArtifact ?? ""]
  );

  const saveResult = saveSession(workspacePath, session, true);
  const activePhase = activePhaseRecord(session);

  return {
    sessionId,
    currentPhase: session.session.currentPhase,
    nextActor: session.session.nextActor,
    sessionPath: saveResult.sessionPath,
    summaryPath: saveResult.summaryPath,
    activeArtifactPath: activePhase?.artifactPath ?? null,
    summary: [
      `Harness session started: ${session.session.id}`,
      `Title: ${session.session.title}`,
      `Goal: ${session.session.goal}`,
      `Adoption track: ${session.session.adoptionTrack}`,
      `Current phase: ${session.session.currentPhase}`,
      `Next actor: ${session.session.nextActor}`,
      `Active artifact: ${activePhase?.artifactPath ?? "n/a"}`,
      `Session state: ${saveResult.sessionPath}`,
      `Session summary: ${saveResult.summaryPath}`,
      "",
      buildRoleBrief(session),
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
      const handoverPath = `docs/handovers/${session.session.id}/${session.chunk.id}-context-reset-${session.context.resetCount + 1}.md`;
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
  const sessionId = resolveSessionId(params.workspacePath, params.sessionId);
  const session = loadSession(params.workspacePath, sessionId);
  const currentPhaseBefore = activePhaseRecord(session);
  const transition = applyActionToSession(session, params);

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
      params.artifactPaths ?? []
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
    ...(params.artifactPaths ?? []),
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
  });
  session.notes.lastOutcome = transition.outcome;

  const saveResult = saveSession(
    params.workspacePath,
    session,
    session.session.status !== "closed"
  );
  const activePhase = activePhaseRecord(session);

  return {
    sessionId: session.session.id,
    currentPhase: session.session.currentPhase,
    nextActor: session.session.nextActor,
    sessionPath: saveResult.sessionPath,
    summaryPath: saveResult.summaryPath,
    activeArtifactPath: activePhase?.artifactPath ?? null,
    summary: [
      `Harness session updated: ${session.session.id}`,
      `Action: ${params.action}`,
      `Outcome: ${transition.outcome}`,
      `Current phase: ${session.session.currentPhase}`,
      `Next actor: ${session.session.nextActor}`,
      `Active artifact: ${activePhase?.artifactPath ?? "n/a"}`,
      `Session state: ${saveResult.sessionPath}`,
      `Session summary: ${saveResult.summaryPath}`,
      "",
      buildRoleBrief(session),
    ].join("\n"),
  };
}

export function getHarnessSessionStatus(
  workspacePath: string,
  requestedSessionId?: string
): HarnessRuntimeResult {
  const sessionId = resolveSessionId(workspacePath, requestedSessionId);
  const session = loadSession(workspacePath, sessionId);
  const sessionPath = buildSessionStatePath(workspacePath, sessionId);
  const summaryPath = buildSessionSummaryPath(workspacePath, sessionId);
  const activePhase = activePhaseRecord(session);

  return {
    sessionId,
    currentPhase: session.session.currentPhase,
    nextActor: session.session.nextActor,
    sessionPath: relativeToWorkspace(workspacePath, sessionPath),
    summaryPath: relativeToWorkspace(workspacePath, summaryPath),
    activeArtifactPath: activePhase?.artifactPath ?? null,
    summary: [
      `Harness session: ${session.session.id}`,
      `Title: ${session.session.title}`,
      `Status: ${session.session.status}`,
      `Goal: ${session.session.goal}`,
      `Current phase: ${session.session.currentPhase}`,
      `Next actor: ${session.session.nextActor}`,
      `Chunk: ${session.chunk.id} (${session.chunk.title})`,
      `Context resets: ${session.context.resetCount}`,
      `Verification: tests=${session.verification.testsStatus}, review=${session.verification.reviewStatus}, remediation=${session.verification.remediationStatus}`,
      `State file: ${relativeToWorkspace(workspacePath, sessionPath)}`,
      `Summary file: ${relativeToWorkspace(workspacePath, summaryPath)}`,
      "",
      buildRoleBrief(session),
    ].join("\n"),
  };
}
