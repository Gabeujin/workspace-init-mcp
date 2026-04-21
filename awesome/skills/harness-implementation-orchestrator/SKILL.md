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

## Recommended Delegation Roles

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

## Per-Chunk Workflow

1. Refresh context, review, and plan artifacts.
2. Write or refresh the contract with scope, done criteria, and evaluator thresholds.
3. Implement the approved chunk only.
4. Run targeted verification and update or add tests.
5. Run independent evaluation or code review and remediate findings immediately.
6. Refresh handover and governance state before closing the chunk.
