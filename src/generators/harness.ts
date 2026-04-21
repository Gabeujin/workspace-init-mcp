import { resolveHarnessProfile } from "../data/harness-profiles.js";
import {
  type GeneratedFile,
  type WorkspaceInitParams,
} from "../types.js";

function buildDomainList(params: WorkspaceInitParams): string[] {
  if (params.primaryDomains?.length) {
    return params.primaryDomains;
  }

  return [params.projectType ?? "general-software-delivery"];
}

export function generateHarnessFiles(
  params: WorkspaceInitParams
): GeneratedFile[] {
  if (params.includeHarnessEngineering === false) {
    return [];
  }

  const profile = resolveHarnessProfile(params.harnessProfile);
  const domains = buildDomainList(params);

  return [
    {
      relativePath: ".github/ai-harness/harness-manifest.yaml",
      content: buildHarnessManifest(params, profile.id, domains),
    },
    {
      relativePath: ".github/ai-harness/operating-model.md",
      content: buildOperatingModel(params, profile.id, domains),
    },
    {
      relativePath: ".github/ai-harness/context-strategy.md",
      content: buildContextStrategy(params),
    },
    {
      relativePath: ".github/ai-harness/evaluation-rubrics.md",
      content: buildEvaluationRubrics(params, domains),
    },
    {
      relativePath: "docs/ai-harness/README.md",
      content: buildHarnessReadme(params, profile.id, domains),
    },
    {
      relativePath: "docs/ai-harness/adoption-paths.md",
      content: buildAdoptionPaths(params, domains),
    },
    {
      relativePath: "docs/contracts/README.md",
      content: buildContractsReadme(params),
    },
    {
      relativePath: "docs/evaluations/README.md",
      content: buildEvaluationsReadme(params),
    },
    {
      relativePath: "docs/context/README.md",
      content: buildContextReadme(params, domains),
    },
    {
      relativePath: "docs/reviews/README.md",
      content: buildReviewReadme(params),
    },
    {
      relativePath: "docs/handovers/README.md",
      content: buildHandoverReadme(params),
    },
    {
      relativePath: "docs/plans/README.md",
      content: buildPlansReadme(params),
    },
  ];
}

function buildHarnessManifest(
  params: WorkspaceInitParams,
  profileId: string,
  domains: string[]
): string {
  const techStack = params.techStack?.length
    ? params.techStack.map((tech) => `  - ${tech}`).join("\n")
    : "  - TBD";
  const plannedTasks = params.plannedTasks?.length
    ? params.plannedTasks.map((task) => `  - ${task}`).join("\n")
    : "  - TBD";

  return [
    `workspace_name: ${quote(params.workspaceName)}`,
    `purpose: ${quote(params.purpose)}`,
    `project_type: ${quote(params.projectType ?? "other")}`,
    `harness_profile: ${quote(profileId)}`,
    `governance_profile: ${quote(params.governanceProfile ?? "strict")}`,
    `autonomy_mode: ${quote(params.autonomyMode ?? "balanced")}`,
    `token_budget: ${quote(params.tokenBudget ?? "balanced")}`,
    "primary_domains:",
    ...domains.map((domain) => `  - ${quote(domain)}`),
    "tech_stack:",
    techStack,
    "planned_tasks:",
    plannedTasks,
    "review_loop:",
    "  - governance-open",
    "  - plan-1",
    "  - review-1",
    "  - plan-2",
    "  - review-2",
    "  - plan-3",
    "  - review-3",
    "  - goal-freeze",
    "  - governance-refresh",
    "  - contract-agreement",
    "  - implementation",
    "  - independent-evaluation",
    "  - verification-and-code-review",
    "  - remediation-loop",
    "  - governance-close",
    "execution_architecture:",
    "  planner: required",
    "  generator: required",
    "  evaluator: required",
    "  evaluator_independence: strict",
    "  contract_required_before_execution: true",
    "  contract_dir: docs/contracts/",
    "  evaluation_dir: docs/evaluations/",
    "  evaluation_rubrics: .github/ai-harness/evaluation-rubrics.md",
    "  context_strategy: .github/ai-harness/context-strategy.md",
    "task_persistence:",
    "  planning_dir: docs/plans/",
    "  review_dir: docs/reviews/",
    "  handover_dir: docs/handovers/",
    "  contract_dir: docs/contracts/",
    "  evaluation_dir: docs/evaluations/",
    "  chunk_large_work: true",
    "  max_chunk_goal: one-verifiable-outcome",
    "  prefer_context_resets_for_drift: true",
    "core_artifacts:",
    "  mission_control: .github/ai-harness/operating-model.md",
    "  policy: .github/ai-harness/harness-manifest.yaml",
    "  context_strategy: .github/ai-harness/context-strategy.md",
    "  evaluation_rubrics: .github/ai-harness/evaluation-rubrics.md",
    "  context: docs/context/",
    "  reviews: docs/reviews/",
    "  handovers: docs/handovers/",
    "  plans: docs/plans/",
    "  contracts: docs/contracts/",
    "  evaluations: docs/evaluations/",
    "  dashboard_html: docs/ai-harness/dashboard/index.html",
    "  dashboard_state: docs/ai-harness/dashboard/state/dashboard-state.json",
    "  dashboard_ops: docs/ai-harness/dashboard/scripts/dashboard-ops.mjs",
    "  dashboard_exports: docs/ai-harness/dashboard/exports/",
    "  runtime_guide: docs/ai-harness/runtime/README.md",
    "  runtime_session_index: docs/ai-harness/runtime/state/session-index.json",
    "  runtime_active_session: docs/ai-harness/runtime/state/active-session.json",
    "escalation_triggers:",
    "  - unclear product intent",
    "  - cross-domain architecture impact",
    "  - security, compliance, or privacy risk",
    "  - token usage expanding without decision progress",
    "  - context drift or context anxiety during long-running work",
    "  - execution blocked for more than one cycle",
    "  - plan chunk too large to resume safely after interruption",
    "",
  ].join("\n");
}

function buildOperatingModel(
  params: WorkspaceInitParams,
  profileId: string,
  domains: string[]
): string {
  return `# AI Harness Operating Model

This workspace uses the **${profileId}** harness profile to keep long-running AI delivery consistent, reviewable, and scalable.

## Mission

- Workspace: ${params.workspaceName}
- Purpose: ${params.purpose}
- Project type: ${params.projectType ?? "other"}
- Primary domains: ${domains.join(", ")}

## Source of Truth Order

1. User intent and approved decisions
2. \`.github/ai-harness/harness-manifest.yaml\`
3. \`.github/copilot-instructions.md\`
4. \`docs/context/\`, \`docs/reviews/\`, and \`docs/plans/\`
5. Codebase and tests
6. External references and temporary notes

## Hard Rules

- Every meaningful agent task starts with governance documentation.
- Every meaningful agent task ends with governance documentation.
- Before implementation, complete Plan 1 -> Review 1 -> Plan 2 -> Review 2 -> Plan 3 -> Review 3.
- Before implementation, agree on a chunk contract that defines scope, done criteria, and how the evaluator will test it.
- Do not code until the goal is explicit, review-backed, and frozen.
- Before implementation, create or refresh the relevant context, plan, and review artifacts.
- Keep generator and evaluator roles separate whenever quality, taste, or correctness judgment matters.
- If the work is too large to complete safely in one uninterrupted session, split it into chunks before coding.
- Each chunk must leave enough review and handover evidence for another session to resume without guessing.
- Any programming change must include matching test coverage or an explicit documented gap with justification.
- After implementation, run verification, code review, remediation, and a final governance refresh before closure.
- Refresh the admin dashboard state at governance open, after each meaningful chunk, and at governance close.

## Three-Plan / Three-Review Loop

### Governance Open

- Record the goal, scope boundary, and success criteria
- Refresh the context ledger and execution plan
- Split large work into resumable chunks before broad implementation starts

### Plan 1

- Draft the first working approach from the task goal, constraints, and current codebase
- Capture open questions and assumptions explicitly
- Keep the plan narrow enough to review critically

### Review 1

- Check scope boundaries, success criteria, and architecture impact
- Reject work that lacks a clear outcome or decision owner
- Require a context map when the blast radius is unclear

### Plan 2

- Revise the plan using the first review findings
- Improve chunking, sequencing, and risk controls
- Tighten verification expectations

### Review 2

- Review domain-specific risks for product, platform, security, data, and operations
- Confirm that the selected skills and agents match the real domain mix
- Reject plans that still hide large unknowns

### Plan 3

- Produce the final delivery plan with chunks, tests, review hooks, and handover expectations
- Make the goal and exit criteria explicit for each chunk

### Review 3

- Validate implementation order, test strategy, code review triggers, and resumability
- Confirm that another session could continue from repo artifacts alone
- Freeze the goal only when the plan is ready for disciplined execution

### Governance Refresh Before Coding

- Refresh the context ledger, review artifacts, execution plan, and handover entry
- Record the frozen goal and the first approved chunk before implementation begins

### Implementation and Verification

- Execute one approved chunk at a time
- Add or update tests for changed behavior
- Run the narrowest relevant verification and code review after each chunk
- Remediate issues immediately instead of deferring hidden risk

### Governance Close

- Update review notes, work logs, and handover state
- Record what is complete, what remains risky, and what the next chunk should be
- Treat the task as unfinished until continuity artifacts are current

## Token Discipline

- Prefer targeted file reads over broad scans
- Summarize findings into durable artifacts instead of re-reading the same context
- Stop and re-plan if token usage grows while decisions remain unresolved
- Use handovers for resumability instead of carrying transient context forever

## Planner / Generator / Evaluator

- The planner expands short requests into a product and delivery frame without over-specifying fragile implementation details.
- The generator executes only approved chunks and should not self-approve work.
- The evaluator stays skeptical, grades against explicit criteria, and blocks completion when thresholds are missed.
- For subjective work such as design, weight originality and coherence more heavily than default-safe polish.
- For programming work, use the evaluator plus tests, code review, and operational checks as the final gate.

## Contract-First Chunk Execution

- Before each implementation chunk, write a contract in \`docs/contracts/\` that states:
  - the chunk goal
  - scope boundaries
  - done criteria
  - verification method
  - evaluator threshold
- Only start coding after the contract is approved.
- Store evaluator findings and remediation decisions in \`docs/evaluations/\`.

## Context Strategy

- Use compaction while the model remains coherent and decisions are still progressing.
- Use a context reset when you observe drift, premature wrap-up behavior, rising context anxiety, or weak recall of earlier constraints.
- Every reset must leave enough plan, contract, review, and handover state for the next session to continue cleanly.

## Execution Cadence

1. Open governance artifacts
2. Run Plan 1 / Review 1 / Plan 2 / Review 2 / Plan 3 / Review 3
3. Freeze the goal and refresh governance
4. Negotiate and record the chunk contract
5. Execute one chunk with tests, evaluation, review, and remediation
6. Refresh the dashboard, session log, and git snapshot
7. Close governance artifacts

## Escalate When

- The request changes the operating model or governance assumptions
- A hidden dependency expands the blast radius
- The task requires decisions across multiple specialties
- The project starts losing continuity between sessions
- The current chunk can no longer be resumed safely from project artifacts
`;
}

function buildHarnessReadme(
  params: WorkspaceInitParams,
  profileId: string,
  domains: string[]
): string {
  return `# AI Harness

This directory family defines how AI work is governed for **${params.workspaceName}**.

## Goals

- Keep context durable across long-running work
- Prevent uncontrolled token growth
- Preserve direction across planning, implementation, review, and handoff
- Support scale-up across domains: ${domains.join(", ")}

## Core Files

- \`.github/ai-harness/harness-manifest.yaml\`: execution policy and review loop
- \`.github/ai-harness/operating-model.md\`: how humans and AI should operate
- \`.github/ai-harness/context-strategy.md\`: when to compact vs reset context
- \`.github/ai-harness/evaluation-rubrics.md\`: explicit grading criteria and quality thresholds
- \`docs/ai-harness/dashboard/\`: JSON-first administrator dashboard and design system
- \`docs/ai-harness/runtime/\`: planner / generator / evaluator runtime state, prompts, and session ledgers
- \`docs/ai-harness/adoption-paths.md\`: legacy-project and greenfield DX/AX adoption playbook
- \`docs/context/\`: durable context, assumptions, and open questions
- \`docs/reviews/\`: three-pass review artifacts
- \`docs/handovers/\`: resumable status for future sessions
- \`docs/plans/\`: chunked execution plans for persistence
- \`docs/contracts/\`: chunk contracts and done criteria
- \`docs/evaluations/\`: independent evaluation and QA evidence

## Mandatory Workflow

1. Open governance artifacts first: context, plan, and review notes
2. Complete Plan 1 -> Review 1 -> Plan 2 -> Review 2 -> Plan 3 -> Review 3
3. Freeze the goal and refresh governance before implementation
4. Split large work into chunks that each end in one verifiable outcome
5. Write a chunk contract and agree on evaluator thresholds before coding
6. Execute one chunk, validate it, review it, remediate it, and update the review ledger
7. Refresh the dashboard snapshot so operators can see progress, KPIs, issues, session governance, and git state
8. Close governance artifacts last: work log, review state, handover, contracts, evaluations, and dashboard state

## Profile

Current harness profile: **${profileId}**
`;
}

function buildAdoptionPaths(
  params: WorkspaceInitParams,
  domains: string[]
): string {
  return `# DX/AX Adoption Paths

This workspace is designed so both **existing legacy projects** and **new greenfield projects** can operate under the same harness engineering model.

## Shared Outcome

- Governance-first execution
- Three planning and review cycles before broad implementation
- Planner / generator / evaluator role separation for high-risk or quality-critical work
- Contract-first chunk execution so every implementation step has explicit done criteria
- JSON-first dashboard visibility for operators and non-developers
- Git-backed traceability for progress, issues, and decisions
- Chunked delivery so sessions remain resumable

## Legacy Project Adoption Track

Use this track when AI is entering an existing codebase, client system, or operational environment.

1. Analyze the AS-IS landscape:
   - major modules or services
   - integration boundaries
   - high-risk legacy flows
   - missing tests and missing documentation
2. Open governance and define one modernization or delivery chunk at a time.
3. Use the dashboard to expose:
   - current modernization goal
   - git traceability
   - version or release ledger
   - blockers, risks, and verification state
   - governed session coverage and contract coverage
4. Introduce tests incrementally with each approved chunk.
5. Use context resets when legacy exploration causes drift or context anxiety, but only after writing a durable handover.
6. Treat the harness as the stable operating layer even if the product architecture is still evolving.

## New Project Track

Use this track when the project starts fresh and the harness can shape the architecture from day one.

1. Freeze mission, scope boundaries, and target architecture through the review ladder.
2. Bootstrap the dashboard before implementation starts.
3. Define version or release ledgers from the first delivery milestone.
4. Keep implementation chunked, contract-backed, test-backed, and review-backed.
5. Use the evaluator and quality gate as independent sign-off, not as generator self-praise.
6. Export static dashboard snapshots for stakeholders whenever direct access is limited.

## Dashboard Operations

- Local preview server: \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs serve --port 43110\`
- Automatic refresh and git sync: \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh\`
- Strict validation: \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs validate\`
- Portable static export: \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs export-static --out docs/ai-harness/dashboard/exports/latest\`

## Domain Coverage

This harness can be adapted across: ${domains.join(", ")}.

The operating rule is consistent regardless of domain:

- plan clearly
- review deeply
- implement in chunks
- test and remediate
- refresh governance and dashboard state last
`;
}

function buildContextReadme(
  params: WorkspaceInitParams,
  domains: string[]
): string {
  return `# Context Ledger

Use this directory to store the minimum durable context needed to continue work without relying on chat history.

## What Belongs Here

- Business or product context that changes design decisions
- Active constraints, assumptions, and unresolved questions
- Domain-specific notes for: ${domains.join(", ")}
- External dependencies that affect execution

## Suggested Files

- \`mission.md\`
- \`constraints.md\`
- \`open-questions.md\`
- \`integrations.md\`
- \`context-reset-handover.md\`

## Rules

- Prefer short summaries over raw transcript dumps
- Record decisions, not every thought
- Refresh stale context before large changes
- Link to source artifacts when possible
- Open or update this ledger before starting large work
- Close it with the final state after each chunk ends

## Owner

The current workspace agents and reviewers are jointly responsible for keeping this ledger useful and current for ${params.workspaceName}.
`;
}

function buildReviewReadme(params: WorkspaceInitParams): string {
  return `# Review Ledger

This workspace uses a three-plan and three-review model before major implementation work.

## Review Ladder

1. \`plan-1\`: first approach and assumptions
2. \`review-1\`: scope, architecture, and context check
3. \`plan-2\`: revised plan with tighter sequencing
4. \`review-2\`: domain-risk review
5. \`plan-3\`: final delivery plan and chunk map
6. \`review-3\`: execution, testing, and resumability check

## Required Evidence

- the frozen goal
- chunk boundaries
- test and verification strategy
- code review expectations
- resumability and handover readiness

## File Naming

- \`YYYY-MM-DD-<feature>-plan-1.md\`
- \`YYYY-MM-DD-<feature>-review-1.md\`
- \`YYYY-MM-DD-<feature>-plan-2.md\`
- \`YYYY-MM-DD-<feature>-review-2.md\`
- \`YYYY-MM-DD-<feature>-plan-3.md\`
- \`YYYY-MM-DD-<feature>-review-3.md\`

## Exit Rule

Do not treat work as complete until review evidence, work logs, plans, and handover state all agree.
`;
}

function buildHandoverReadme(params: WorkspaceInitParams): string {
  return `# Handover Notes

Use this directory to make paused work resumable without reconstructing context from scratch.

## Required Sections

- Current goal
- What changed
- What is verified
- What is still risky or unresolved
- Recommended next step

## File Naming

- \`YYYY-MM-DD-<workstream>-handover.md\`

## Quality Bar

- A new contributor should understand the next action in under five minutes
- Link to the exact files, reviews, plans, and decisions that matter
- Record blockers explicitly instead of implying them

## Workspace

This handover model is part of the AI harness for ${params.workspaceName}.
`;
}

function buildContractsReadme(params: WorkspaceInitParams): string {
  return `# Chunk Contracts

Use this directory for explicit agreements between the planner, generator, and evaluator before implementation starts.

## Why Contracts Exist

- Turn high-level intent into one testable chunk at a time
- Prevent generator drift and silent scope expansion
- Give the evaluator explicit done criteria before code is written
- Preserve resumable state when sessions reset or ownership changes

## Required Sections

- Goal
- Scope boundary
- Out-of-scope notes
- Done criteria
- Verification method
- Evaluator threshold
- Related plan, review, and handover artifacts

## File Naming

- \`YYYY-MM-DD-<feature>-contract.md\`

## Exit Rule

Do not start implementation until the contract is explicit enough that a skeptical evaluator could judge the result without guessing.

## Workspace

This contract model is part of the AI harness for ${params.workspaceName}.
`;
}

function buildEvaluationsReadme(params: WorkspaceInitParams): string {
  return `# Independent Evaluations

Use this directory for evaluator, QA, and quality-gate records that stay separate from the generator's own implementation notes.

## Rules

- Prefer independent evaluation over generator self-praise.
- Grade against explicit criteria, thresholds, and contract scope.
- Record failures in enough detail that remediation can proceed without rediscovery.
- Keep findings evidence-backed and tied to files, routes, behaviors, or outputs.

## Suggested Records

- evaluator findings
- QA execution notes
- remediation decision log
- final pass / fail summary

## File Naming

- \`YYYY-MM-DD-<feature>-evaluation.md\`
- \`YYYY-MM-DD-<feature>-qa.md\`
- \`YYYY-MM-DD-<feature>-quality-gate.md\`

## Workspace

This evaluation model is part of the AI harness for ${params.workspaceName}.
`;
}

function buildPlansReadme(params: WorkspaceInitParams): string {
  return `# Execution Plans

Use this directory for durable plans that can survive session interruption, environment failure, or ownership changes.

## Mandatory Rules

- Create or refresh a plan before major implementation work starts
- Complete the full three-plan and three-review ladder before coding
- Break large work into chunks when one uninterrupted session is not realistic
- Each chunk should target one verifiable outcome
- Each chunk must reference its related review note and handover note
- Each chunk must define its tests, code review trigger, and remediation path

## Chunking Heuristics

Split the work when any of these are true:

- The affected surface area spans many subsystems
- The review would otherwise become too broad to evaluate well
- The work cannot be validated with one clear test or verification step
- A session interruption would force someone to reconstruct hidden state

## Suggested Structure

- \`<feature>/plan.md\`
- \`<feature>/goal-freeze.md\`
- \`<feature>/chunks/chunk-01.md\`
- \`<feature>/chunks/chunk-02.md\`
- \`<feature>/contract.md\`

## Chunk Template

\`\`\`markdown
# Chunk 01: <goal>

- Goal:
- Scope boundary:
- Files expected to change:
- Verification:
- Code review:
- Remediation loop:
- Related review note:
- Related handover note:
- Exit condition:
\`\`\`

## Workspace

This planning model exists to protect continuity for ${params.workspaceName}.
`;
}

function buildContextStrategy(params: WorkspaceInitParams): string {
  return `# Context Strategy

This workspace uses a deliberate context strategy for ${params.workspaceName}.

## Default Rule

- Prefer compaction while the agent is still coherent and the task is progressing.
- Prefer context resets when the session starts drifting, forgetting earlier constraints, or trying to wrap up prematurely.

## Reset Triggers

- context anxiety or premature completion behavior
- repeated re-reading without decision progress
- hidden state building up outside durable artifacts
- long-running work that would benefit from a clean evaluator pass
- legacy exploration that expands beyond the current chunk boundary

## Reset Requirements

- refresh the active plan, review, contract, and handover artifacts first
- record the next step explicitly
- link the exact files and verification evidence the next session needs
- leave enough state that another agent can continue without chat history

## Why This Matters

Compaction preserves continuity, but resets can restore discipline when long sessions start to lose coherence. The harness should choose the simplest strategy that still protects correctness and continuity.
`;
}

function buildEvaluationRubrics(
  params: WorkspaceInitParams,
  domains: string[]
): string {
  return `# Evaluation Rubrics

Use these criteria to keep evaluation independent, skeptical, and useful for **${params.workspaceName}**.

## Core Criteria

### Contract Fidelity

- Did the implementation satisfy the explicit chunk contract?
- Did it stay inside the agreed scope boundary?

### Functionality

- Does the changed behavior actually work under realistic use?
- Can the evaluator verify the primary outcome without guessing?

### Quality

- Is the result coherent, maintainable, and aligned with workspace standards?
- Are obvious shortcuts or stubbed surfaces still present?

### Verification Depth

- Were tests, checks, or QA paths strong enough for the claimed outcome?
- Is any coverage gap documented explicitly?

## Domain Notes

- Active domains: ${domains.join(", ")}
- For design-heavy work, emphasize coherence and originality over generic safe defaults.
- For software delivery, treat correctness, review depth, and operability as blocking concerns.
- For research or narrative work, treat evidence quality, continuity, and domain-ledger freshness as blocking concerns.

## Evaluator Standard

- Prefer skeptical, evidence-backed findings over generous approval.
- Do not let the generator self-approve quality-critical work.
- Fail the chunk if any blocking criterion falls below the agreed threshold.

## Planner Guidance

Keep specs ambitious on outcome and user value, but avoid freezing brittle implementation details too early. Contracts and evaluation should bridge the gap between high-level intent and executable chunks.
`;
}

function quote(value: string): string {
  return JSON.stringify(value);
}
