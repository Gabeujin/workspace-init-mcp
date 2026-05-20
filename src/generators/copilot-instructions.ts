/**
 * Generator for .github/copilot-instructions.md.
 * Creates workspace-wide instructions tailored to the project and harness model.
 */

import {
  type WorkspaceInitParams,
  type GeneratedFile,
  PROJECT_TYPE_CONFIGS,
} from "../types.js";
import {
  HARNESS_INSTRUCTION_BLOCK_END,
  HARNESS_INSTRUCTION_BLOCK_START,
} from "./agent-platform-instructions.js";

export function generateCopilotInstructions(
  params: WorkspaceInitParams
): GeneratedFile {
  const config = PROJECT_TYPE_CONFIGS[params.projectType ?? "other"];
  const docLang = params.docLanguage ?? "Korean";
  const codeLang = params.codeCommentLanguage ?? "English";
  const isMulti = params.isMultiRepo ?? false;
  const techStack = params.techStack?.length
    ? params.techStack
    : config.defaultTechStack;

  const content = `${HARNESS_INSTRUCTION_BLOCK_START}
# Workspace Copilot Instructions

These instructions apply across the entire workspace unless a more specific local instruction file overrides them.

## Workspace Overview

- Workspace: ${params.workspaceName}
- Purpose: ${params.purpose}
- Project type: ${config.label}
- Project profile: ${config.description}
- Tech stack: ${techStack.join(", ") || "Not specified"}
- Repository model: ${isMulti ? "Multi-repository or multi-project" : "Single repository"}

${renderPlannedTasks(params)}
${renderAdditionalContext(params)}
## Governance First

- Treat workspace initialization and reconcile as a non-destructive harness overlay for legacy projects.
- Do not delete, truncate, move, or replace existing application source while adopting workspace-init-mcp artifacts.
- Governance documentation comes first and last for every meaningful task.
- Before any implementation, refresh the active context, plan, and review artifacts.
- Do not start coding until the goal is explicit, review-backed, and frozen.
- If work is too large for one safe session, split it into resumable chunks before coding.
- Every chunk must end with updated review, verification, and handover state.
- Keep the admin dashboard JSON current for server health, and use the live artifacts dashboard for harness work status, artifacts, user confirmation, and real-world action tracking.

## Harness World Model Dashboard

- Treat \`docs/ai-harness/dashboard/\` as the shared project world model for stakeholders and AI Agents.
- Before meaningful work, read \`docs/ai-harness/dashboard/state/dashboard-index.json\` or call \`get_harness_dashboard_context\` so the Agent is oriented to the same dashboard state the user sees.
- Improve \`governanceActionabilityScore.score\` gradually by clarifying goals, owners, active work, decisions, tab responsibilities, and resumable Agent contracts.
- Improve \`governanceActionabilityScore.operationalEvidenceScore\` gradually by linking real VCS, CI, release, service-health, incident, SLO/SLI, database, telemetry, and runbook evidence.
- Never improve a score by hiding warnings, deleting missing evidence, or treating declared/tacit context as observed fact.
- Use \`worldModelImprovementContract\` as the standing contract for maturity loops, tacit-context intake, score improvement, tab ownership, and non-duplication.
- Use \`agentPlatformGovernance\` to confirm the real active AI platforms; record user-declared platforms with \`dashboard-ops.mjs record-agent-platforms\` and treat non-active platform files as \`unused-instruction\`.
- If repository artifacts do not explain stakeholder intent, operational constraints, domain vocabulary, release windows, external account state, or support expectations, ask for that tacit context and record it as declared context with owner, timestamp, confidence, and reversal condition.
- Keep dashboard tabs non-duplicative: Overview summarizes, Work sequences, Evidence proves, Governance decides, Operations runs, and Tech Stack explains project composition.
- When the user asks about a dashboard tab, task, score, blocker, claim, or decision, answer with the relevant tab, item id or label, evidence path, score impact, and safest next action.

## Parallel Agent Work

- The main agent acts as the hub: it analyzes the backlog, maps dependencies, separates parallel-ready chunks from sequential or blocked work, assigns subagents, reviews their receipts, and decides whether another improvement pass is required.
- Run workers in parallel only when their write scopes, DB/schema impacts, API contracts, and runtime side effects do not conflict.
- Include every file a worker may write in \`expectedWritePaths\`, including shared manifests, lockfiles, schemas, API contracts, CI workflows, generated files, and project config.
- Capture \`expectedReadPaths\`, \`assignedWorker\`, \`dependencyMap\`, \`mergeOwner\`, \`integrationOwner\`, \`parallelSafetyStatus\`, and \`evaluationThreshold\` in the harness session or work packet when work is delegated.
- Run \`audit_harness_parallel_chunk_conflicts\` before launching parallel workers. Hard conflicts must be split or made sequential; warnings on integration-sensitive surfaces require one merge owner or an explicit integration contract.
- Inject each worker with only task-relevant context: approved contract, relevant code snippets, schemas, API specs, logs, verification commands, expected write paths, and merge owner when integration is required.
- Workers must not widen scope or coordinate through hidden chat state; integration returns through contracts, evaluations, receipts, dashboard updates, and atomic commits.
- If a worker discovers it must touch an undeclared path, it must stop and update the chunk contract before editing.
- The hub repeats work -> evaluate -> improve until the chunk contract is satisfied, critical findings are resolved, and world model memory is updated with lessons, decisions, and next safest action.

## Delivery Workflow

Follow this sequence for meaningful work:

1. Governance open
2. Plan 1
3. Review 1
4. Plan 2
5. Review 2
6. Plan 3
7. Review 3
8. Goal freeze
9. Governance refresh
10. Implementation
11. Verification, code review, and remediation
12. Governance close

### Workflow Rules

- Plan 1 should establish the first workable approach and identify unknowns.
- Review 1 should challenge scope, architecture, and missing context.
- Plan 2 should tighten sequencing, chunking, and risk controls.
- Review 2 should cover domain risks such as product, security, data, platform, and operations.
- Plan 3 should define the final chunk map, tests, and exit conditions.
- Review 3 should confirm resumability, validation order, and readiness to execute.
- Programming work must include matching tests or an explicit documented test gap with rationale.
- After implementation, run verification, code review, and immediate remediation before closure.

## Post-Work Maturity Gate

After AI-generated code changes, verify:

1. Static analysis, syntax checks, likely runtime exception paths, and boundary tests.
2. Framework/runtime compatibility, environment sync such as Java/JDK version, and dependency audit for added libraries.
3. Maintainability: SOLID, duplication, abstraction level, constants instead of hardcoding, and business/data-access separation.
4. Generator self-correction with an uncertainty report when confidence is low or evidence is incomplete.
5. Atomic commit traceability: one logical chunk or remediation per commit with a session, chunk, plan, or issue reference when available.

## Documentation Governance

Use repo artifacts as durable operational memory rather than relying on chat history.

- Context ledger: \`docs/context/\`
- Review ledger: \`docs/reviews/\`
- Execution plans: \`docs/plans/\`
- Handovers: \`docs/handovers/\`
- Work logs: \`docs/work-logs/\`
- Changelog: \`docs/changelog/\`
- Architectural decisions: \`docs/adr/\`
- AI harness policy: \`.github/ai-harness/\`
- Admin dashboard: \`docs/ai-harness/dashboard/\`

### Minimum Documentation Expectations

- Record the goal, scope, constraints, and success criteria before work begins.
- Track review outcomes and plan revisions as separate artifacts.
- Keep handover notes short, explicit, and immediately actionable.
- Update governance artifacts again after implementation and verification finish.

## Evidence-Based Development

- Base decisions on current repository evidence, approved documents, and verified references.
- Prefer targeted reads over broad scans to control token usage.
- Summarize durable findings into repo artifacts instead of re-reading the same context repeatedly.
- Stop and re-plan when token usage grows without decision progress.

## Project-Specific Guidance

${renderExtraInstructions(config.extraInstructions)}
${renderMultiRepoSection(isMulti)}
## Recommended Workspace Structure

\`\`\`
${params.workspaceName}/
|-- .github/
|   |-- copilot-instructions.md
|   |-- ai-harness/
|   |-- agents/
|   \`-- skills/
|-- .vscode/
|   |-- settings.json
|   \`-- *.instructions.md
|-- docs/
|   |-- context/
|   |-- reviews/
|   |-- plans/
|   |-- handovers/
|   |-- work-logs/
|   |-- changelog/
|   \`-- adr/
${isMulti ? "|-- <project-a>/\n|-- <project-b>/\n" : "|-- src/\n"}\`-- ${params.workspaceName}.code-workspace
\`\`\`

## Coding Conventions

- Prefer clear, intention-revealing names.
- Keep functions and modules focused on one responsibility.
- Use comments to explain why, not to restate obvious code.
- Handle errors explicitly and avoid silent failure paths.
- Keep changes small, reviewable, and traceable back to approved plans.

## Agent Operating Cadence

### Session Start

1. Read the latest governance artifacts before acting.
2. Continue unfinished work only if the current goal and handover state are still clear.
3. Open or refresh the active work log for new meaningful work.
4. Read \`docs/ai-harness/dashboard/state/dashboard-index.json\` or call \`get_harness_dashboard_context\` before starting if dashboard context may be stale.

### During Work

1. Follow the approved plan and chunk boundaries.
2. Update documents as soon as decisions or scope change.
3. Run narrow verification early and often.
4. Escalate when cross-domain or high-risk decisions appear.
5. Update dashboard projections when service telemetry, VCS evidence, decisions, blockers, or harness work state changes.

### Session End

1. Refresh review, verification, and handover artifacts.
2. Record residual risks and the exact next step.
3. Refresh dashboard projections, issue/task queues, KPI/readiness signals, and Git/SVN visibility snapshots.
4. Do not mark the work complete until governance and verification agree.

## Language and Encoding

- Documentation language: ${docLang}
- Code comment language: ${codeLang}
- Default file encoding: UTF-8

## Harness Overrides

- workspace-init-mcp is a harness engineering, artifacts, and governance layer; legacy source remains owned by the project unless a later explicit code-change contract names it.
- Governance documentation comes first and last for every meaningful agent task.
- Before implementation, create or refresh the relevant context, plan, and review artifacts.
- Complete Plan 1 -> Review 1 -> Plan 2 -> Review 2 -> Plan 3 -> Review 3 before broad coding starts.
- If the work is too large to complete safely in one uninterrupted session, split it into chunks before coding.
- Each chunk must end with updated work-log, review, verification, and handover state so the task remains resumable.
- For parallel work, assign independent chunks through an orchestrator and inject only the context each worker needs.
- Require self-correction, independent evaluation, and atomic commits before closure.
- Do not treat a task as complete until documentation, verification, and handover all agree on the final state.
${HARNESS_INSTRUCTION_BLOCK_END}
`;

  return {
    relativePath: ".github/copilot-instructions.md",
    content,
  };
}

function renderPlannedTasks(params: WorkspaceInitParams): string {
  if (!params.plannedTasks?.length) {
    return "";
  }

  return `## Planned Work\n\n${params.plannedTasks.map((task) => `- ${task}`).join("\n")}\n\n`;
}

function renderAdditionalContext(params: WorkspaceInitParams): string {
  if (!params.additionalContext) {
    return "";
  }

  return `## Additional Context\n\n${params.additionalContext}\n\n`;
}

function renderExtraInstructions(lines: string[]): string {
  if (!lines.length) {
    return "- No extra project-specific guidance was supplied.\n";
  }

  return lines.map((line) => `- ${line}`).join("\n");
}

function renderMultiRepoSection(isMulti: boolean): string {
  if (!isMulti) {
    return "";
  }

  return `## Multi-Repository Coordination

- Document repository ownership, boundaries, and cross-repo impacts explicitly.
- Track changes per repository in changelog and handover artifacts.
- Make cross-repo dependencies visible before implementation starts.

`;
}
