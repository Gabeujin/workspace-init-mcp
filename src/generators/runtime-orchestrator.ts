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
- \`templates/harness-session.template.json\`: shape reference for runtime session state
- \`prompts/*.md\`: role briefs for planner, generator, and evaluator agents
- \`state-machine.md\`: allowed phase flow and transition rules

## MCP Runtime Tools

Use these MCP tools against the initialized workspace:

1. \`start_harness_session\`
   Opens governance, creates a runtime session, seeds the first chunk, and moves the workflow to \`plan-1\`.
2. \`advance_harness_session\`
   Moves the active session through the governed phase graph using \`complete\`, \`request_changes\`, \`block\`, \`resume\`, or \`context_reset\`.
3. \`get_harness_session_status\`
   Reads the current session and returns the next actor brief plus the current evidence paths.

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
      lastUpdatedAt: "bootstrap",
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
      relativePath: "docs/ai-harness/runtime/templates/harness-session.template.json",
      content: buildSessionTemplate(params),
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
