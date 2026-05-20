---
name: "Harness Implementation Orchestrator"
description: "Orchestrate long-running implementation with governance-first planning, three plan-review cycles, resumable chunking, targeted delegation, verification, and handover discipline."
argument-hint: "Describe the change goal, expected scope, and any constraints or deadlines"
user-invokable: true
disable-model-invocation: false
---

# Harness Implementation Orchestrator

Use this skill for multi-file, high-risk, or long-running implementation work that must remain resumable and well-governed.

## Non-Negotiable Rules

1. Do not code until Plan 1, Review 1, Plan 2, Review 2, Plan 3, and Review 3 are complete.
2. Freeze the implementation goal before any broad code change starts.
3. Record a chunk contract before implementation starts.
4. Refresh governance artifacts before and after each chunk.
5. Keep each chunk limited to one verifiable outcome.
6. Add or update tests for behavior that changes.
7. Treat legacy adoption as a non-destructive harness overlay; do not delete or replace existing application source during setup.
8. For parallel work, the main agent is the hub: classify dependencies, assign only independent chunks to workers, review receipts, and accept integration only after evidence is sufficient.

## Recommended Delegation Roles

- `@harness-orchestrator` for dependency mapping, worker assignment, and context injection
- `@harness-implementer` for the approved code chunk
- `@harness-verifier` for targeted checks and regression validation
- `@harness-doc-writer` for governance updates
- `@harness-expert-reviewer` for focused expert-lens reviews
- `@harness-quality-gate` for post-work remediation and final quality closure

## Chunking Heuristics

Split the work when any of these are true:

- more than one subsystem changes together
- the blast radius is unclear
- test scope is larger than one focused verification pass
- a session interruption would lose hidden context
- independent chunks can run in parallel without shared write paths, DB/schema changes, API contract conflicts, runtime side effects, or integration-sensitive shared files
- dependency manifests, lockfiles, CI workflows, shared config, generated clients, DB migrations, and API contracts require one merge owner or sequential execution even when text paths do not overlap

## Parallel Execution

1. Build a dependency map for the backlog.
2. Mark chunks as blocked, sequential, or parallel-ready.
3. Assign one worker per independent chunk.
4. Define expected read paths, expected write paths, assigned worker, dependency map, merge owner, integration owner, parallel safety status, and evaluation threshold.
5. Run `audit_harness_parallel_chunk_conflicts`; resolve hard conflicts and treat integration warnings as requiring sequentialization or a named merge owner.
6. Inject only relevant code snippets, DB schema fragments, API specs, logs, commands, and verification instructions.
7. Require worker receipts with changed paths, verification evidence, residual risk, confidence, and undeclared path requests.
8. Integrate through evaluator evidence, receipts, dashboard updates, and atomic commits.
9. Repeat work -> evaluate -> improve until the hub can explain why the chunk is accepted or blocked.

## Per-Chunk Workflow

1. Refresh context, review, and plan artifacts.
2. Write or refresh the contract with scope, done criteria, and evaluator thresholds.
3. Implement the approved chunk only.
4. Run targeted verification and update or add tests.
5. Run independent evaluation or code review and remediate findings immediately.
6. Run the maturity gate: static analysis, boundary testing, environment compatibility, dependency audit, maintainability review, self-correction, and atomic commit traceability.
7. Update world model memory with lessons, decisions, tacit context, evidence links, and next safest action.
8. Refresh handover and governance state before closing the chunk.
