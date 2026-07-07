import { resolveHarnessProfile } from "../data/harness-profiles.js";
import {
  buildCustomDomainStressDefinition,
  DOMAIN_STRESS_DEFINITIONS,
  toDomainStressProfileId,
} from "../data/domain-stress-profiles.js";
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
      relativePath: ".github/ai-harness/reconcile-policy.json",
      content: buildReconcilePolicy(),
    },
    {
      relativePath: ".github/ai-harness/native-executor-overrides.json",
      content: buildNativeExecutorOverrides(),
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
      relativePath: "docs/ai-harness/domain-stress-playbooks.md",
      content: buildDomainStressPlaybooks(params, domains),
    },
    {
      relativePath: "docs/ai-harness/domain-stress-profiles.json",
      content: buildDomainStressProfiles(params, domains),
    },
    {
      relativePath: ".governance/_INDEX.md",
      content: buildGovernanceIndex(params),
    },
    {
      relativePath: ".governance/_PROJECT_STATE.md",
      content: buildGovernanceProjectState(params),
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
      relativePath: "docs/context/context-index.md",
      content: buildContextIndex(params, domains),
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

function buildGovernanceIndex(params: WorkspaceInitParams): string {
  return `# Governance Index

This folder is a lightweight intake and staging area for active governance notes.
Canonical durable harness state lives under \`docs/ai-harness/\`, especially the
Harness Dashboard event ledger and runtime session files.

## Workspace

- Name: ${params.workspaceName}
- Purpose: ${params.purpose}

## Canonical Sources

- Dashboard ledger: \`docs/ai-harness/dashboard/events/harness-events.jsonl\`
- Dashboard state projection: \`docs/ai-harness/dashboard/state/dashboard-state.json\`
- Agent dashboard index: \`docs/ai-harness/dashboard/state/dashboard-index.json\`
- Runtime sessions: \`docs/ai-harness/runtime/state/session-index.json\`
`;
}

function buildGovernanceProjectState(params: WorkspaceInitParams): string {
  return `# Governance Project State

## Current Goal

${params.purpose}

## Status

- Harness Dashboard 5.0.0 Hypertext Project World Model generated.
- First governed session is pending.
- AI Agents should call \`get_harness_dashboard_context\` before starting work.

## Next Review

Confirm the first governed goal, service lifecycle mode, owner, and verification commands.
`;
}

function buildReconcilePolicy(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedAt: "generated-at-runtime",
      activePreset: "balanced",
      nonDestructiveAdoption: {
        mode: "harness-overlay",
        protectedIntent:
          "workspace-init-mcp adds governance, documentation, IDE, and runtime harness artifacts around an existing project. It must not delete, truncate, move, or replace legacy application source.",
        protectedSourceRoots: [
          "src/",
          "app/",
          "apps/",
          "lib/",
          "packages/",
          "services/",
          "server/",
          "client/",
          "frontend/",
          "backend/",
          "api/",
          "web/",
          "mobile/",
        ],
      },
      defaults: {
        managedJsonState: "merge",
        managedFileRefresh: "replace",
        modifiedManagedFile: "hold",
      },
      presets: {
        conservative: {
          description:
            "Prefer manual review for drifted governed files while still allowing safe JSON state merges.",
          defaults: {
            managedJsonState: "merge",
            managedFileRefresh: "hold",
            modifiedManagedFile: "hold",
          },
        },
        balanced: {
          description:
            "Refresh generated baselines, merge live JSON state, and hold customized governed files.",
          defaults: {
            managedJsonState: "merge",
            managedFileRefresh: "replace",
            modifiedManagedFile: "hold",
          },
        },
        "refresh-heavy": {
          description:
            "Favor baseline refresh after an operator has reviewed preflight output and accepted stronger automation.",
          defaults: {
            managedJsonState: "merge",
            managedFileRefresh: "replace",
            modifiedManagedFile: "replace",
          },
        },
      },
      rules: [
        {
          id: "operating-model-hold",
          matchType: "exact",
          pattern: ".github/ai-harness/operating-model.md",
          policy: "hold",
          reason: "Operating model documents often carry approved local customizations and should not be auto-refreshed silently.",
        },
        {
          id: "manifest-hold",
          matchType: "exact",
          pattern: ".github/ai-harness/harness-manifest.yaml",
          policy: "hold",
          reason: "Harness manifests can encode project-specific governance decisions that deserve manual review before replacement.",
        },
        {
          id: "managed-inventory-replace",
          matchType: "exact",
          pattern: ".github/ai-harness/managed-file-inventory.json",
          policy: "replace",
          reason: "Managed inventory should refresh with the latest generated baseline when initialization evolves.",
        },
        {
          id: "legacy-source-src-hold",
          matchType: "prefix",
          pattern: "src/",
          policy: "hold",
          reason: "Legacy application source is outside the harness ownership boundary and must never be refreshed by workspace-init-mcp.",
        },
        {
          id: "legacy-source-app-hold",
          matchType: "prefix",
          pattern: "app/",
          policy: "hold",
          reason: "Application source is outside the harness ownership boundary and must never be refreshed by workspace-init-mcp.",
        },
        {
          id: "legacy-source-packages-hold",
          matchType: "prefix",
          pattern: "packages/",
          policy: "hold",
          reason: "Package source is outside the harness ownership boundary and must never be refreshed by workspace-init-mcp.",
        },
        {
          id: "dashboard-state-merge",
          matchType: "prefix",
          pattern: "docs/ai-harness/dashboard/state/",
          policy: "merge",
          reason: "Dashboard state is live governed JSON and should be merged rather than replaced.",
        },
        {
          id: "runtime-state-merge",
          matchType: "prefix",
          pattern: "docs/ai-harness/runtime/state/",
          policy: "merge",
          reason: "Runtime state is live session evidence and should be merged instead of blindly refreshed.",
        },
        {
          id: "runtime-compatibility-contract-refresh",
          matchType: "exact",
          pattern: "docs/ai-harness/runtime/adapter-contract.json",
          policy: "replace",
          reason: "Adapter contracts should refresh to the latest stable cross-agent interface so @latest sessions stay compatible.",
        },
        {
          id: "runtime-version-index-refresh",
          matchType: "exact",
          pattern: "docs/ai-harness/runtime/version-index.json",
          policy: "replace",
          reason: "Version indexes are generated compatibility metadata and should reflect the latest server capabilities.",
        },
        {
          id: "runtime-compatibility-matrix-refresh",
          matchType: "exact",
          pattern: "docs/ai-harness/runtime/compatibility-matrix.json",
          policy: "replace",
          reason: "Compatibility matrices are generated upgrade metadata and should refresh with the latest server release.",
        },
        {
          id: "runtime-session-continuity-refresh",
          matchType: "exact",
          pattern: "docs/ai-harness/runtime/session-continuity.md",
          policy: "replace",
          reason: "Session continuity guidance should stay aligned with the latest supported adapter contract.",
        },
        {
          id: "readiness-json-merge",
          matchType: "glob",
          pattern: "docs/ai-harness/readiness/*.json",
          policy: "merge",
          reason: "Readiness JSON is durable state and should be preserved through merge-oriented upgrades.",
        },
      ],
      notes: [
        "Policy values: replace, merge, hold.",
        "Non-destructive adoption is mandatory: generated harness upgrades may add/merge governance artifacts, but must not delete or overwrite legacy application source.",
        "Set activePreset to conservative, balanced, or refresh-heavy to change the default reconcile posture.",
        "hold keeps drifted files in manual review even if overwriteManagedFiles is enabled.",
        "merge is intended for JSON state ledgers and falls back to manual review if merging is unsafe.",
      ],
    },
    null,
    2
  )}\n`;
}

function buildNativeExecutorOverrides(): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedAt: "generated-at-runtime",
      notes: [
        "Use this file to tune bridge commands and native executor launch arguments for local CLI environments.",
        "Leave arrays empty to keep the built-in safe defaults.",
        "defaultArgsTemplate or powershell/bash replaces the built-in base command template.",
        "prependArgsTemplate / appendArgsTemplate and prependPowershell / appendPowershell / prependBash / appendBash layer around the chosen base template.",
        "Prefer workspace-relative prompt files and governed handoff instructions so runs stay reproducible.",
        "Useful template placeholders include {workspacePath}, {handoffMarkdownPath}, {handoffMarkdownRelativePath}, {handoffInstruction}, {actorInboxPath}, {lastMessagePath}, and {lastMessageRelativePath}.",
        "The built-in Codex profile prefers codex exec plus --output-last-message so the final assistant response becomes a durable governed artifact.",
        "All runtime overrides should preserve docs/ai-harness/runtime/adapter-contract.json and session-continuity.md so Copilot, Codex, Claude, Gemini, OpenHands, and portable runtimes can switch safely.",
      ],
      executors: {
        "github-copilot": {
          commandCandidates: [],
          defaultArgsTemplate: [],
          prependArgsTemplate: [],
          appendArgsTemplate: [],
        },
        "codex-cli": {
          commandCandidates: [],
          defaultArgsTemplate: [],
          prependArgsTemplate: [],
          appendArgsTemplate: [],
        },
        "claude-code": {
          commandCandidates: [],
          defaultArgsTemplate: [],
          prependArgsTemplate: [],
          appendArgsTemplate: [],
        },
        "gemini-cli": {
          commandCandidates: [],
          defaultArgsTemplate: [],
          prependArgsTemplate: [],
          appendArgsTemplate: [],
        },
      },
      bridges: {
        "github-copilot": {
          powershell: [],
          bash: [],
          prependPowershell: [],
          appendPowershell: [],
          prependBash: [],
          appendBash: [],
        },
        "codex-cli": {
          powershell: [],
          bash: [],
          prependPowershell: [],
          appendPowershell: [],
          prependBash: [],
          appendBash: [],
        },
        "claude-code": {
          powershell: [],
          bash: [],
          prependPowershell: [],
          appendPowershell: [],
          prependBash: [],
          appendBash: [],
        },
        "gemini-cli": {
          powershell: [],
          bash: [],
          prependPowershell: [],
          appendPowershell: [],
          prependBash: [],
          appendBash: [],
        },
      },
    },
    null,
    2
  )}\n`;
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
    `domain_stress_profile: ${quote(params.domainStressProfile ?? "auto")}`,
    `legacy_adoption_profile: ${quote(params.legacyAdoptionProfile ?? "none")}`,
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
    "legacy_adoption:",
    "  mode: non_destructive_harness_overlay",
    "  ownership_boundary: governance_docs_ide_and_runtime_artifacts_only",
    "  protected_source_roots:",
    "    - src/",
    "    - app/",
    "    - apps/",
    "    - lib/",
    "    - packages/",
    "    - services/",
    "    - server/",
    "    - client/",
    "  prohibited_actions:",
    "    - delete_existing_application_source",
    "    - replace_existing_application_source_without_explicit_task_contract",
    "    - move_or_rename_legacy_modules_during_harness_adoption",
    "  allowed_actions:",
    "    - add_missing_harness_artifacts",
    "    - merge_live_governed_json_state",
    "    - hold_customized_managed_files_for_review",
    "parallel_execution:",
    "  orchestrator_agent: required_for_multi_chunk_work",
    "  dependency_rule: parallelize_only_chunks_without_write_runtime_or_schema_dependencies",
    "  worker_assignment: one_worker_per_disjoint_chunk",
    "  write_scope_required: true",
    "  evaluator_independence_required: true",
    "  context_injection: task_relevant_snippets_db_schema_api_specs_only",
    "  merge_rule: reconcile_worker_outputs_through_contracts_evaluations_and_atomic_commits",
    "quality_gate:",
    "  - static_analysis_and_runtime_exception_scan",
    "  - boundary_testing",
    "  - environment_version_compatibility_check",
    "  - dependency_audit",
    "  - clean_code_and_abstraction_review",
    "  - self_correction_uncertainty_report",
    "  - atomic_commit_traceability",
    "atomic_commits:",
    "  required: true",
    "  format: conventional_commits_with_chunk_or_session_reference",
    "  scope: one_logical_change_per_commit",
    "core_artifacts:",
    "  mission_control: .github/ai-harness/operating-model.md",
    "  policy: .github/ai-harness/harness-manifest.yaml",
    "  managed_inventory: .github/ai-harness/managed-file-inventory.json",
    "  reconcile_policy: .github/ai-harness/reconcile-policy.json",
    "  native_executor_overrides: .github/ai-harness/native-executor-overrides.json",
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
    "  runtime_version_index: docs/ai-harness/runtime/version-index.json",
    "  runtime_compatibility_matrix: docs/ai-harness/runtime/compatibility-matrix.json",
    "  runtime_adapter_contract: docs/ai-harness/runtime/adapter-contract.json",
    "  runtime_session_continuity: docs/ai-harness/runtime/session-continuity.md",
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

- Treat workspace-init-mcp as a non-destructive harness overlay for existing and legacy projects.
- Do not delete, truncate, move, or replace existing application source during harness adoption.
- Keep generated harness ownership bounded to governance, documentation, IDE configuration, runtime state, dashboard, skills, agents, and related managed artifacts.
- Every meaningful agent task starts with governance documentation.
- Every meaningful agent task ends with governance documentation.
- Before implementation, complete Plan 1 -> Review 1 -> Plan 2 -> Review 2 -> Plan 3 -> Review 3.
- Before implementation, agree on a chunk contract that defines scope, done criteria, and how the evaluator will test it.
- Do not code until the goal is explicit, review-backed, and frozen.
- Before implementation, create or refresh the relevant context, plan, and review artifacts.
- Keep generator and evaluator roles separate whenever quality, taste, or correctness judgment matters.
- For multi-chunk work, the orchestrator must identify independent chunks, assign disjoint write scopes, and record dependencies before workers start.
- Worker agents receive only the relevant snippets, schemas, API specs, contracts, and file paths for their chunk.
- If the work is too large to complete safely in one uninterrupted session, split it into chunks before coding.
- Each chunk must leave enough review and handover evidence for another session to resume without guessing.
- Any programming change must include matching test coverage or an explicit documented gap with justification.
- Every completed implementation chunk must pass the code maturity gate or report uncertainty before closure.
- Keep commits atomic: one logical chunk/remediation per commit with traceable session or chunk references.
- After implementation, run verification, code review, remediation, and a final governance refresh before closure.
- Refresh the Project World Model dashboard state at governance open, after each meaningful chunk, and at governance close.

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

## Non-Destructive Legacy Adoption

- Legacy adoption means adding the harness around an existing codebase, not replacing the codebase.
- Source roots such as \`src/\`, \`app/\`, \`packages/\`, \`services/\`, \`server/\`, and \`client/\` are protected unless a later explicit implementation contract names them as the approved work scope.
- Reconcile runs may add missing harness files, merge governed JSON state, import legacy agent assets, and hold customized managed files for review.
- Reconcile runs must not delete application source or silently rewrite business logic as part of setup.
- When source modernization is required, create a separate chunk contract with tests, rollback notes, and an atomic commit boundary.

## Parallel Orchestration And Context Injection

- The main agent acts as the hub: it analyzes the backlog, maps dependencies, assigns subagents, reviews worker receipts, owns merge/integration decisions, and accepts or rejects outputs.
- The hub separates independent chunks before worker sessions begin and records \`expectedReadPaths\`, \`expectedWritePaths\`, \`assignedWorker\`, \`dependencyMap\`, \`mergeOwner\`, \`integrationOwner\`, \`parallelSafetyStatus\`, and \`evaluationThreshold\`.
- Parallel chunks are allowed only when their write scopes, runtime side effects, database changes, API contracts, and integration-sensitive shared files do not conflict.
- Dependency manifests, lockfiles, CI workflows, shared config, generated clients, DB migrations, and API contracts require one merge owner or sequential execution.
- Each worker receives a minimal context packet: task contract, relevant code snippets, affected schemas, API specs, verification command, expected write paths, and merge ownership when integration is required.
- Workers must not read broadly or widen scope just because another worker is active.
- Integration happens through contracts, evaluator records, receipts, dashboard updates, and atomic commits rather than hidden chat coordination.
- The hub repeats work -> evaluate -> improve until the contract is satisfied, critical findings are resolved, and world model memory has the evidence needed for future agents to resume.

## Code Maturity Gate

Every completed implementation chunk must pass this gate before governance close:

1. Critical error and stability validation: static analysis, syntax checks, likely runtime exception scan, and boundary testing.
2. Version compatibility validation: framework/runtime environment sync, Java/JDK or equivalent version checks, and dependency audit for newly added libraries.
3. Maintainability and extensibility review: SOLID, duplication, abstraction level, constants instead of hardcoding, and separation between business logic and data access.
4. Self-correction: the generator records its own evaluation, known uncertainty, and any low-confidence area before the independent evaluator reviews it.
5. Atomic commit traceability: commits are scoped to one logical chunk or remediation and reference the session, chunk, plan, or issue when available.

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
4. Have the orchestrator split the backlog into dependent and independent chunks
5. Inject only task-relevant context into each worker packet
6. Negotiate and record the chunk contract
7. Execute one chunk or a set of independent chunks with tests, evaluation, review, and remediation
8. Refresh the dashboard, session log, and git snapshot
9. Commit atomically with traceable chunk or session references
10. Close governance artifacts

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
- Add governance, dashboard, runtime, and agent artifacts without deleting or replacing legacy application source
- Coordinate parallel agent work through dependency-aware chunks and minimal context injection
- Support scale-up across domains: ${domains.join(", ")}

## Core Files

- \`.github/ai-harness/harness-manifest.yaml\`: execution policy and review loop
- \`.github/ai-harness/managed-file-inventory.json\`: managed baseline used for safer reconcile and upgrade audits
- \`.github/ai-harness/reconcile-policy.json\`: file-level reconcile policy for hold / merge / replace decisions
- \`.github/ai-harness/native-executor-overrides.json\`: vendor-specific handoff and CLI launch overrides for GitHub Copilot, Codex CLI, Claude Code, Gemini CLI, and future executor tuning
- \`.github/ai-harness/operating-model.md\`: how humans and AI should operate
- \`.github/ai-harness/context-strategy.md\`: when to compact vs reset context
- \`.github/ai-harness/evaluation-rubrics.md\`: explicit grading criteria and quality thresholds
- \`docs/ai-harness/dashboard/\`: Harness Dashboard 5.0.0 Hypertext Project World Model, ledger projections, single-file HTML, and read-only local API design system
- \`docs/ai-harness/runtime/\`: planner / generator / evaluator runtime state, prompts, and session ledgers
- \`docs/ai-harness/adoption-paths.md\`: legacy-project and greenfield DX/AX adoption playbook
- \`docs/ai-harness/domain-stress-playbooks.md\`: domain packs for identity commerce, legacy modernization, and content release governance
- \`docs/ai-harness/domain-stress-profiles.json\`: machine-readable domain stress profiles that agents can copy into plans, contracts, dashboard events, and evaluator prompts
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
5. For parallel work, have the orchestrator classify dependencies and assign only independent chunks to workers
6. Inject only task-relevant code snippets, DB schemas, API specs, and expected write paths into each worker context
7. Write a chunk contract and agree on evaluator thresholds before coding
8. Execute one chunk or independent chunk set, validate it, review it, remediate it, and update the review ledger
9. Run the maturity gate: static analysis, boundary tests, version compatibility, dependency audit, maintainability review, self-correction, and atomic commit traceability
10. Refresh realityModel, goalCompass, contextRotMonitor, evidence, runtime, and operations status in the Project World Model dashboard
11. Close governance artifacts last: work log, review state, handover, contracts, evaluations, and dashboard state

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
- Ledger-first, HTML-backed dashboard visibility for operators and non-developers
- Git-backed traceability for progress, issues, and decisions
- Chunked delivery so sessions remain resumable
- Non-destructive adoption so existing project source remains intact while the harness layer is added
- Parallel execution through dependency-aware chunking, isolated worker context, and atomic commits

## Legacy Project Adoption Track

Use this track when AI is entering an existing codebase, client system, or operational environment.

0. Preserve the existing source tree:
   - do not delete, truncate, move, or replace application source as part of workspace initialization
   - treat \`src/\`, \`app/\`, \`packages/\`, \`services/\`, \`server/\`, \`client/\`, and similar roots as protected until a later explicit modernization contract names them
   - use \`.github/\`, \`.vscode/\`, \`docs/\`, and IDE agent roots for harness artifacts
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
5. When multiple teams or agent sessions are available, split modernization work by independent modules, APIs, screens, or documentation streams only after dependency mapping is explicit.
6. Inject each worker with only the relevant snippets, schema fragments, API specs, logs, and verification commands for that chunk.
7. Use context resets when legacy exploration causes drift or context anxiety, but only after writing a durable handover.
8. Treat the harness as the stable operating layer even if the product architecture is still evolving.

## New Project Track

Use this track when the project starts fresh and the harness can shape the architecture from day one.

1. Freeze mission, scope boundaries, and target architecture through the review ladder.
2. Bootstrap the dashboard before implementation starts.
3. Define version or release ledgers from the first delivery milestone.
4. Keep implementation chunked, contract-backed, test-backed, and review-backed.
5. Parallelize only chunks with no dependency or write-scope conflict.
6. Use the evaluator and quality gate as independent sign-off, not as generator self-praise.
7. Export static dashboard snapshots for stakeholders whenever direct access is limited.

## Dashboard Operations

- Local preview server: \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs serve --port 43110\`
- Automatic refresh and git sync: \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh\`
- Strict validation: \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs validate\`
- Portable static export: \`node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs export-static --out docs/ai-harness/dashboard/exports/latest\`

## Domain Coverage

This harness can be adapted across: ${domains.join(", ")}.

Before high-risk domain work, open \`docs/ai-harness/domain-stress-playbooks.md\` and choose the closest stress profile. The chosen profile must be copied into the first plan, chunk contract, dashboard event, and independent evaluation prompt.

The operating rule is consistent regardless of domain:

- plan clearly
- review deeply
- implement in chunks
- parallelize only dependency-free chunks with isolated context
- test and remediate
- commit atomically with traceable work history
- refresh governance and dashboard state last
`;
}

function buildDomainStressProfiles(
  params: WorkspaceInitParams,
  domains: string[]
): string {
  const explicitProfileId = params.domainStressProfile
    ? toDomainStressProfileId(params.domainStressProfile)
    : null;
  const profiles = [
    ...DOMAIN_STRESS_DEFINITIONS,
    ...(
      explicitProfileId != null &&
      !DOMAIN_STRESS_DEFINITIONS.some((profile) => profile.id === explicitProfileId)
        ? [
            buildCustomDomainStressDefinition(explicitProfileId, {
              projectType: params.projectType,
              primaryDomains: params.primaryDomains,
              additionalContext: params.additionalContext,
              legacyAdoptionProfile: params.legacyAdoptionProfile,
            }),
          ]
        : []
    ),
  ];
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedFor: params.workspaceName,
      purpose: params.purpose,
      activeDomains: domains,
      usage:
        "Use these profiles as checklists for additionalContext, plannedTasks, dashboard claims, chunk contracts, and evaluator prompts. Built-ins are examples; project-specific profile ids create custom evidence gates instead of forcing a domain fit.",
      profiles: profiles.map((profile) => ({
        id: profile.id,
        label: profile.label,
        appliesWhen: profile.appliesWhen,
        actors: profile.actors,
        criticalSurfaces: profile.criticalSurfaces,
        mandatoryEvidence: profile.mandatoryEvidence,
        reportSections: profile.reportSections,
        operatingQuestion: profile.operatingQuestion,
        parallelSafety: profile.parallelSafety,
      })),
    },
    null,
    2
  )}\n`;
}

function buildDomainStressPlaybooks(
  params: WorkspaceInitParams,
  domains: string[]
): string {
  return `# Domain Stress Playbooks

These playbooks turn a generic harness into a domain-aware operating system. Use them when a project is too broad for a single \`projectType\` label.

Generated for: **${params.workspaceName}**

Active domains: ${domains.join(", ")}

## How To Use

1. Pick one profile from \`domain-stress-profiles.json\`.
2. Copy the profile id into the first plan, chunk contract, evaluator prompt, and dashboard event.
3. Expand \`additionalContext\` with actors, critical surfaces, data classes, integrations, and failure modes.
4. Convert mandatory evidence into missing-evidence claims before implementation begins.
5. Promote semantic coupling to a blocker when path-disjoint chunks share domain invariants, state, source material, review gates, or readiness claims.
6. Run \`dashboard-ops.mjs export-report --focus today --public\` only after validation passes.

## Identity Commerce Operations

Use this profile for products where identity, commerce, device, and operator surfaces share state.

### Required Intake

- Actors: anonymous user, identified account, operator, business admin, support owner, provider, AI operator.
- Device flows: credential scan, resource binding, web surface, mobile deep link, device permission denial.
- Commerce flows: cart, order, payment handoff, provider callback, offline amount handoff, refund, void.
- Benefit flows: accrual, reversal, reward issue, stacking, expiry, redemption, abuse prevention.
- Data classes: account PII, credential, bound resource, session, order, payment attempt, payment callback, benefit ledger, reward ledger, audit log.
- Providers: configured payment or identity providers, or explicit mock provider contracts.

### Evidence Gates

- Credential issuance, revocation, replay prevention, and expiry.
- Device permission denial and fallback.
- Resource binding, spoofing, stale tag, and reassignment.
- Order state machine and operator/admin audit history.
- Payment callback idempotency and provider outage recovery.
- Benefit ledger double-entry or equivalent reconciliation.
- Reward stacking, expiry, cancellation, and reversal.
- Privacy redaction, user export/delete, and retention policy.

## Legacy Modernization Governance

Use this profile when workspace-init enters after a legacy CRUD surface already exists.

### Required Preflight

- AS-IS map: tables/models, routes, screens, auth assumptions, deployment state, tests, hidden coupling.
- TO-BE map: records, comments, profiles, collaboration flows, continuity records, groups, roles, proposals, votes, organizations, monetization.
- Migration waves: preserve CRUD, add identity, add collaboration, add continuity records, add group governance, add organization transition, add monetization.
- Cutover plan: data migration rehearsal, rollback, seeded demo data, legacy URL compatibility.
- Moderation plan: reports, blocks, roles, audit log, abuse handling.

### Evidence Gates

- Legacy CRUD still works after harness adoption.
- Every legacy route/table is mapped to keep, replace, archive, or migrate.
- Collaboration lifecycle E2E: create, join, attend, record continuity, moderate.
- Governance lifecycle: proposal, vote/quorum, approval, role change, audit.
- Monetization readiness: plan, entitlement, payment, refund, sponsorship, settlement assumptions.
- Collaboration health KPIs: activation, retention, participation, moderation load, organization growth.

## Content Release Governance

Use this profile when the output is canonical content plus derivative channel and visual assets.

### Required Intake

- Content title, central message, audience promise, target audience, taboo positions, tone, outline, finish definition.
- Concept dictionary, approved language, "do not say this" boundaries, contradiction risks.
- Content channels: canonical draft, newsletter, owned channels, derivative visuals.
- Release cadence and feedback loop.
- Visual generation style guide, platform dimensions, typography safe zones, alt text, rights/provenance rules.

### Evidence Gates

- Message consistency and concept boundary review.
- Content-to-message coverage and counterargument coverage.
- Prose voice QA and harmful oversimplification check.
- Derivative map: promote to canonical content, market only, or revise canon.
- Visual prompt/version ledger, visual consistency, typography, alt text, and rights checks.
- Content finish report: progress, draft stage, editorial debt, cut list, source gaps, next production session brief.

## Parallel Session Rule

When a domain profile names semantic coupling, the orchestrator must treat it as a dependency even if files do not overlap. The contract must name:

- merge owner
- schema or canon owner
- end-to-end scenario owner
- verification command
- dashboard state update required at closeout
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
- Context-injection packets that give a worker only the snippets, schemas, API specs, commands, and expected write paths needed for one chunk

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
- For parallel work, keep worker contexts isolated and name the dependency assumptions that make the chunk safe to run concurrently

## Owner

The current workspace agents and reviewers are jointly responsible for keeping this ledger useful and current for ${params.workspaceName}.
`;
}

function buildContextIndex(
  params: WorkspaceInitParams,
  domains: string[]
): string {
  return `# Context Index

This index is the durable intake surface for facts that keep AI Agents oriented to
the same project reality after chat history, context windows, or runtime sessions
change.

## Workspace

- Workspace: ${params.workspaceName}
- Mission: ${params.purpose}
- Primary domains: ${domains.join(", ")}

## Required Fact Record

Every project-specific fact promoted into this ledger should include:

- id
- status: observed, declared, planned, stale, contradicted, or retired
- owner
- lastVerifiedAt
- ttl
- evidenceRef
- reversalCondition
- relatedGoalRef
- relatedRealityRef

## Bootstrap Records

| Fact | Status | Owner | TTL | Evidence | Reversal condition |
| --- | --- | --- | --- | --- | --- |
| Mission statement | declared | stakeholder-product-owner | until-first-governed-session | docs/ai-harness/dashboard/events/harness-events.jsonl | Stakeholder changes purpose or lifecycle mode |
| Project reality map | planned | harness-dashboard-operator | until-first-refresh | docs/ai-harness/dashboard/entities/reality-model.json | Real topology evidence contradicts bootstrap model |
| Goal compass | planned | harness-dashboard-operator | until-first-goal-freeze | docs/ai-harness/dashboard/entities/goal-compass.json | First governed goal is revised |

## Maintenance Rule

When a session learns a real relationship, stale assumption, owner, external
dependency, environment, data surface, or goal change, update this index or link
the exact governed artifact that updates \`realityModel\`, \`goalCompass\`, or
\`contextRotMonitor\`.
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
- dependency map for chunks that may run in parallel
- context-injection scope for each worker agent
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
- Parallel dependencies or worker outputs that still need integration
- Atomic commit or work-history references
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
- Dependency status: blocked-by, unlocks, or independent
- Worker context packet: relevant snippets, schemas, API specs, commands, and expected write paths
- Parallel safety statement when the chunk is assigned alongside other work
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
- Require a generator self-correction note that states checks run, uncertainty, and low-confidence areas before independent approval.

## Five-Step Maturity Gate

1. Critical errors and stability: static analysis, syntax checks, runtime exception scan, and boundary testing.
2. Version compatibility: environment sync, framework/runtime compatibility, and dependency audit.
3. Maintainability and extensibility: SOLID, duplication, abstraction level, constants, and layer separation.
4. Self-correction: generator-side evaluation plus explicit uncertainty report.
5. Atomic commits: one logical chunk or remediation per commit with traceable session, chunk, or issue references.

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
- For multi-agent execution, an orchestrator must map dependencies before workers start
- Parallel chunks must have disjoint write scopes; integration-sensitive shared files require a merge owner or sequential execution
- Run \`audit_harness_parallel_chunk_conflicts\` before launching parallel workers and resolve hard conflicts or integration warnings first
- Worker plans must include the exact context-injection packet instead of broad repository context

## Chunking Heuristics

Split the work when any of these are true:

- The affected surface area spans many subsystems
- The review would otherwise become too broad to evaluate well
- The work cannot be validated with one clear test or verification step
- A session interruption would force someone to reconstruct hidden state
- Two chunks can run independently without sharing mutable files, schema changes, runtime state, or deployment order

## Suggested Structure

- \`<feature>/plan.md\`
- \`<feature>/goal-freeze.md\`
- \`<feature>/dependency-map.md\`
- \`<feature>/context-packets/<worker-id>.md\`
- \`<feature>/chunks/chunk-01.md\`
- \`<feature>/chunks/chunk-02.md\`
- \`<feature>/contract.md\`

## Orchestrator Checklist

- Classify backlog items as blocked, sequential, or parallel-ready.
- Record dependencies, shared files, DB/schema/API impacts, and merge owner.
- Assign one worker per independent chunk with expected read and write paths.
- Inject only relevant code snippets, DB schema fragments, API specs, command outputs, and verification commands.
- Require workers to stop before touching undeclared write paths.
- Reserve evaluator or reviewer agents for read-only judgment unless remediation is explicitly assigned.
- Require atomic commits so parallel work history remains traceable.

## Chunk Template

\`\`\`markdown
# Chunk 01: <goal>

- Goal:
- Scope boundary:
- Dependency status:
- Parallel safety:
- Assigned worker:
- Context packet:
- Files expected to change:
- Verification:
- Self-correction:
- Atomic commit scope:
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

## Context Injection For Parallel Agents

- Give each worker the smallest context that can safely complete its chunk.
- Include the chunk contract, relevant code snippets, DB schema fragments, API specs, logs, commands, and expected write paths.
- Exclude unrelated repository areas, old chat history, and other workers' implementation details unless they are an explicit dependency.
- Record the injected context packet under \`docs/context/\` or \`docs/plans/<feature>/context-packets/\` so the evaluator can audit what the worker saw.
- If the worker needs broader context, stop and update the contract instead of silently expanding the packet.

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

### Parallel Execution Discipline

- Did the orchestrator correctly classify dependencies before assigning parallel work?
- Did each worker stay inside its injected context and expected write paths?
- Were integration conflicts, shared files, and merge ownership handled explicitly?

### Code Maturity

- Did static analysis, syntax checks, runtime exception review, and boundary testing pass?
- Were framework/runtime versions, Java/JDK or equivalent environment assumptions, and dependencies checked for compatibility?
- Does the code follow SOLID, avoid unnecessary duplication, separate layers clearly, and avoid hardcoded business values?
- Did the generator produce a self-correction note with uncertainty rather than claiming unsupported confidence?
- Are commits atomic and traceable to the chunk, session, issue, or plan?

## Domain Notes

- Active domains: ${domains.join(", ")}
- For design-heavy work, emphasize coherence and originality over generic safe defaults.
- For software delivery, treat correctness, review depth, and operability as blocking concerns.
- For research or narrative work, treat evidence quality, continuity, and domain-ledger freshness as blocking concerns.

## Evaluator Standard

- Prefer skeptical, evidence-backed findings over generous approval.
- Do not let the generator self-approve quality-critical work.
- Fail the chunk if any blocking criterion falls below the agreed threshold.
- Fail or mark uncertain when self-correction, dependency audit, boundary testing, or atomic commit evidence is missing.

## Planner Guidance

Keep specs ambitious on outcome and user value, but avoid freezing brittle implementation details too early. Contracts and evaluation should bridge the gap between high-level intent and executable chunks.
`;
}

function quote(value: string): string {
  return JSON.stringify(value);
}
