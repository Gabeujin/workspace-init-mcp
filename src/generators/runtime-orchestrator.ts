import {
  type GeneratedFile,
  type WorkspaceInitParams,
} from "../types.js";

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
- \`templates/harness-session.template.json\`: shape reference for runtime session state
- \`prompts/*.md\`: role briefs for planner, generator, and evaluator agents
- \`adapters/*.md\`: runtime-specific operating guidance for Codex CLI, Claude Code, Gemini CLI, generic CLI agents, OpenHands, and generic file-based execution
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
4. \`activate_harness_session\`
   Moves the single active lease to a queued or blocked session when execution focus changes.
5. \`audit_harness_runtime\`
   Audits runtime index, active snapshot, and session ledgers for drift or broken references.
6. \`prepare_harness_work_packet\`
   Rebuilds the durable work packet and actor inbox files for the active or requested session.
7. \`list_harness_runtime_adapters\`
   Lists the supported runtime adapters and their execution style.
8. \`prepare_harness_adapter_handoff\`
   Builds a runtime-specific handoff bundle for Codex CLI, Claude Code, Gemini CLI, generic CLI agents, OpenHands, or a generic file-based runtime.
9. \`list_harness_execution_bridges\`
   Lists the supported execution bridges and their launch style.
10. \`prepare_harness_execution_bridge\`
   Generates launch-ready bridge manifests, scripts, and result templates for a concrete runtime.
11. \`record_harness_execution_result\`
   Records the result receipt that returns an external execution back into governed runtime tracking.
12. \`list_harness_native_executors\`
   Lists the supported directly launchable runtime executors and reports local command detection.
13. \`prepare_harness_native_executor\`
   Builds the direct-launch plan, state file, and log targets for a native executor run.
14. \`launch_harness_native_executor\`
   Starts a supported native executor in foreground or background mode and records governed launch state.
15. \`get_harness_native_execution_status\`
   Reads the latest native executor state for a session or the workspace-level current snapshot.
16. \`compact_harness_runtime\`
   Archives older closed runtime sessions into durable archive bundles so the active ledgers stay readable.

## Operating Rules

1. No generator implementation begins before the evaluator-approved chunk contract exists.
2. Every phase change must record a durable note and at least one artifact path.
3. Use \`context_reset\` whenever drift, context anxiety, or handover risk appears.
4. Close governance only after verification and governance refresh are both complete.
5. Keep session JSON and markdown summaries tracked in git.
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
      processId: null,
      executablePath: null,
      summary:
        "Prepare a native executor after the first governed session and execution bridge exist.",
    },
    null,
    2
  )}\n`;
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
      },
      phases: [],
      events: [],
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
- Keep the plan ambitious at the product level and concrete at the verification level.
- Avoid locking in fragile low-level implementation choices too early.
- Treat every plan as resumable: document assumptions, open questions, and next steps explicitly.
- Before implementation begins, ensure the goal is frozen and the contract exists.
`;
}

function buildGeneratorBrief(): string {
  return `# Generator Brief

- Implement only against the approved contract and current chunk scope.
- Keep outputs traceable to the active session, chunk, and verification criteria.
- Record test evidence and notable implementation tradeoffs as you work.
- If drift or context anxiety appears, request a context reset instead of guessing.
- Do not self-approve. Finish with evidence that can be judged independently.
`;
}

function buildEvaluatorBrief(): string {
  return `# Evaluator Brief

- Judge independently and skeptically against the contract, rubrics, and observed behavior.
- Prefer concrete evidence over optimistic summaries.
- When quality is insufficient, request changes with actionable findings.
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

- \`codex-cli.md\`
- \`claude-code.md\`
- \`gemini-cli.md\`
- \`generic-cli.md\`
- \`openhands.md\`
- \`generic-file-runtime.md\`

Use \`prepare_harness_adapter_handoff\` to generate a session-specific handoff bundle after selecting the adapter.
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
- \`claude-code.md\`
- \`gemini-cli.md\`
- \`generic-cli.md\`
- \`openhands.md\`
- \`generic-file-runtime.md\`

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
      relativePath: "docs/ai-harness/runtime/adapters/codex-cli.md",
      content: buildAdapterProfile(
        "codex-cli",
        "Codex CLI / Desktop Adapter",
        "codex",
        "File-first coding continuation with strong patch/test discipline",
        [
          "Open the handoff markdown, actor inbox, and work packet before editing files.",
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
      relativePath: "docs/ai-harness/runtime/bridges/codex-cli.md",
      content: buildBridgeProfile("codex-cli", "Codex Execution Bridge", "guided-command", [
        "Use the generated bridge manifest and launch script as the runtime bootstrap.",
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
      relativePath: "docs/ai-harness/runtime/native-executors/codex-cli.md",
      content: buildNativeExecutorProfile(
        "codex-cli",
        "Codex Native Executor",
        "native",
        [
          "Prefer the generated native execution plan over ad-hoc terminal commands.",
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
