import {
  type GeneratedFile,
  type WorkspaceInitParams,
} from "../types.js";

function buildReadinessReadme(): string {
  return `# Readiness Layer

This directory defines what remains before the initialized workspace should be considered operationally ready.

## Files

- \`remaining-work-spec.md\`: explicit completion criteria and remaining work buckets
- \`maturity-scorecard.template.json\`: machine-readable scorecard template
- \`scoring-model.md\`: how readiness is scored across the main operating dimensions
- \`maturity-scorecard.json\`: optional evidence scorecard written by the MCP readiness assessment
- \`semantic-audit.json\`: optional conservative semantic audit written by the MCP readiness semantic audit

## How To Use

1. Treat the remaining-work spec as the operator's definition of done after initialization.
2. Replace placeholders in the scorecard with real project evidence as adoption progresses.
3. Use the MCP readiness assessment to calculate a conservative score against the generated baseline.
4. Use the semantic audit when you want a stricter view of whether the workspace looks operationally real rather than merely complete.
5. Keep the scorecard and dashboard aligned whenever major governance or runtime changes land.
`;
}

function buildRemainingWorkSpec(): string {
  return `# Remaining Work Specification

Initialization creates the harness baseline, but real readiness still depends on project-specific adaptation.

## Completion Definition

The workspace should be considered operationally ready only when every section below has explicit evidence.

### 1. Baseline Initialization

- Objective: The generated governance, dashboard, runtime, and skill artifacts exist and are trackable.
- Acceptance criteria:
  - Core initialization files are present and readable.
  - The operator reviewed the generated operating model and manifest.
  - The project-specific purpose, domains, and workflow boundaries are no longer placeholders.
- Evidence paths:
  - \`.github/ai-harness/harness-manifest.yaml\`
  - \`.github/ai-harness/operating-model.md\`
  - \`docs/ai-harness/readiness/maturity-scorecard.json\`

### 2. Governance And Documentation

- Objective: The project has real plan, review, contract, evaluation, handover, and work-log practices.
- Acceptance criteria:
  - The three-plan / three-review rule is accepted by the team.
  - Real project evidence exists in plan, review, and handover ledgers.
  - The evaluator rubric reflects the actual domain risk profile.
- Evidence paths:
  - \`docs/plans/\`
  - \`docs/reviews/\`
  - \`docs/contracts/\`
  - \`docs/evaluations/\`
  - \`docs/handovers/\`

### 3. Runtime Orchestration

- Objective: Planner / generator / evaluator execution is resumable without hidden chat context.
- Acceptance criteria:
  - Session state files are valid.
  - Work packets and actor inbox files are generated and used.
  - Context resets and queue/lease handling are part of the operator workflow.
- Evidence paths:
  - \`docs/ai-harness/runtime/state/\`
  - \`docs/ai-harness/runtime/work-packets/\`
  - \`docs/ai-harness/runtime/inbox/\`

### 4. Dashboard And Stakeholder Visibility

- Objective: Non-developers can understand status, KPI, issues, and session history at a glance.
- Acceptance criteria:
  - Dashboard JSON is valid against the strict schema.
  - Progress, KPI, issues, governed sessions, and runtime orchestration are current.
  - A static export exists when stakeholders cannot access the local dashboard server.
- Evidence paths:
  - \`docs/ai-harness/dashboard/state/dashboard-state.json\`
  - \`docs/ai-harness/dashboard/exports/\`

### 5. External Runtime Portability

- Objective: The governed runtime can hand work to Codex, Claude Code, OpenHands, or portable external runtimes.
- Acceptance criteria:
  - Runtime adapter handoffs can be generated for the chosen execution environment.
  - Execution bridges exist for the chosen runtime family.
  - External runtime results return through governed receipts instead of ad-hoc chat summaries.
- Evidence paths:
  - \`docs/ai-harness/runtime/adapters/\`
  - \`docs/ai-harness/runtime/adapter-handoffs/\`
  - \`docs/ai-harness/runtime/bridges/\`
  - \`docs/ai-harness/runtime/execution-bridges/\`

### 6. Quality And Traceability

- Objective: The project can prove what changed, why it changed, and whether the change passed review.
- Acceptance criteria:
  - Tests and code review instructions are aligned with the project stack.
  - Verification and remediation status are tracked for governed sessions.
  - Git or another version-control workflow exists for the generated state files and ledgers.
- Evidence paths:
  - \`.vscode/test-generation.instructions.md\`
  - \`.vscode/code-review.instructions.md\`
  - \`docs/work-logs/\`
  - \`docs/changelog/\`

### 7. Domain Tailoring

- Objective: The generic harness reflects the real domain, not only the baseline template.
- Acceptance criteria:
  - Domain-specific KPIs are filled with real values.
  - Entity, timeline, feature, or version ledgers reflect the actual work.
  - Skills and agents have been trimmed to the ones the team will actually use.
- Evidence paths:
  - \`docs/ai-harness/dashboard/state/dashboard-state.json\`
  - \`.github/AGENT-SKILLS.md\`
  - \`.github/AGENT-SKILLS-BY-ROLE.md\`
  - \`.github/AGENT-SKILLS-BY-DOMAIN.md\`

## Optimization Backlog

These items are not required for baseline readiness, but they are worth planning next:

- Tighten domain-specific KPI thresholds and automated refresh logic
- Create runtime-specific operator playbooks for the team's actual execution environments
- Add project-native scripts that refresh readiness and dashboard state together
- Expand bridge-level receipts with richer test, review, and deployment evidence
`;
}

function buildScoringModel(): string {
  return `# Readiness Scoring Model

The readiness score is conservative by design. It is intended to answer:

"Can this workspace be operated safely and repeatedly with the generated harness?"

## Dimensions

1. Baseline Initialization: 15
2. Governance And Documentation: 20
3. Runtime Orchestration: 20
4. Dashboard And Stakeholder Visibility: 15
5. External Runtime Portability: 10
6. Quality And Traceability: 10
7. Domain Tailoring: 10

Total: 100

## Status Thresholds

- \`ready\`: 85+
- \`advancing\`: 70-84
- \`partial\`: 50-69
- \`fragile\`: below 50

## Interpretation

- High scores still require operator judgment; they mean the harness baseline is strong, not that the project is complete.
- Missing domain evidence should cap the practical score even when the baseline files are present.
- Scores should be refreshed whenever governance, runtime, dashboard, or bridge structures change materially.
`;
}

function buildScorecardTemplate(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedAt: "bootstrap",
      assessmentStatus: "not-assessed",
      overallScore: 0,
      classification: "partial",
      dimensions: [
        {
          id: "baseline-initialization",
          label: "Baseline Initialization",
          weight: 15,
          score: 0,
          status: "todo",
          evidencePaths: [
            ".github/ai-harness/harness-manifest.yaml",
            ".github/ai-harness/operating-model.md",
          ],
        },
        {
          id: "governance-documentation",
          label: "Governance And Documentation",
          weight: 20,
          score: 0,
          status: "todo",
          evidencePaths: ["docs/plans/", "docs/reviews/", "docs/contracts/"],
        },
        {
          id: "runtime-orchestration",
          label: "Runtime Orchestration",
          weight: 20,
          score: 0,
          status: "todo",
          evidencePaths: [
            "docs/ai-harness/runtime/state/session-index.json",
            "docs/ai-harness/runtime/state/current-work-packet.json",
          ],
        },
        {
          id: "dashboard-visibility",
          label: "Dashboard And Stakeholder Visibility",
          weight: 15,
          score: 0,
          status: "todo",
          evidencePaths: [
            "docs/ai-harness/dashboard/state/dashboard-state.json",
            "docs/ai-harness/dashboard/index.html",
          ],
        },
        {
          id: "external-runtime-portability",
          label: "External Runtime Portability",
          weight: 10,
          score: 0,
          status: "todo",
          evidencePaths: [
            "docs/ai-harness/runtime/adapters/README.md",
            "docs/ai-harness/runtime/bridges/README.md",
          ],
        },
        {
          id: "quality-traceability",
          label: "Quality And Traceability",
          weight: 10,
          score: 0,
          status: "todo",
          evidencePaths: [
            ".vscode/test-generation.instructions.md",
            ".vscode/code-review.instructions.md",
            "docs/work-logs/README.md",
          ],
        },
        {
          id: "domain-tailoring",
          label: "Domain Tailoring",
          weight: 10,
          score: 0,
          status: "todo",
          evidencePaths: [
            ".github/AGENT-SKILLS.md",
            "docs/ai-harness/dashboard/state/dashboard-state.json",
          ],
        },
      ],
      topGaps: [
        "Replace placeholder governance assumptions with real team rules.",
        "Fill KPI values and domain-specific dashboard state with real evidence.",
        "Choose the primary runtime adapter and bridge that the team will actually use.",
      ],
    },
    null,
    2
  )}\n`;
}

export function generateReadinessFiles(
  params: WorkspaceInitParams
): GeneratedFile[] {
  if (params.includeHarnessEngineering === false) {
    return [];
  }

  return [
    {
      relativePath: "docs/ai-harness/readiness/README.md",
      content: buildReadinessReadme(),
    },
    {
      relativePath: "docs/ai-harness/readiness/remaining-work-spec.md",
      content: buildRemainingWorkSpec(),
    },
    {
      relativePath: "docs/ai-harness/readiness/scoring-model.md",
      content: buildScoringModel(),
    },
    {
      relativePath: "docs/ai-harness/readiness/maturity-scorecard.template.json",
      content: buildScorecardTemplate(),
    },
  ];
}
