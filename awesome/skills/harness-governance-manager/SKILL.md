---
name: "Harness Governance Manager"
description: "Create, repair, and refresh governance artifacts for AI-assisted delivery. Use for harness manifests, context ledgers, review notes, execution plans, handovers, and UTF-8-safe documentation updates."
argument-hint: "Describe the workspace, governance artifact to create or refresh, and the current task status"
user-invokable: true
disable-model-invocation: false
---

# Harness Governance Manager

Use this skill when the workspace needs durable governance artifacts before, during, or after meaningful agent work.

## Core Rules

1. Treat governance artifacts as the durable source of truth for AI work.
2. Use UTF-8 for every governance document unless the user explicitly asks for another encoding.
3. Do not start implementation until the goal, scope, and review path are documented clearly.
4. If work cannot be completed safely in one uninterrupted session, split it into resumable chunks before coding.
5. Every meaningful task must open governance first and close governance last.

## Default Artifact Set

- `.github/ai-harness/harness-manifest.yaml`
- `.github/ai-harness/operating-model.md`
- `docs/context/`
- `docs/reviews/`
- `docs/plans/`
- `docs/handovers/`

If the repo already uses `.governance/`, maintain it as a legacy governance surface instead of deleting it.

## Required Workflow

1. Open governance: capture mission, scope boundary, constraints, and success criteria.
2. Run the planning and review ladder:
   - Plan 1
   - Review 1
   - Plan 2
   - Review 2
   - Plan 3
   - Review 3
3. Freeze the goal only after the third review confirms the target is clear.
4. Refresh the context ledger, plan artifacts, and review notes before implementation.
5. After implementation, refresh verification notes, handover state, and final governance summaries.

## Output Expectations

- Governance artifacts are current and internally consistent.
- Review and plan identifiers are easy to trace.
- Another contributor can resume work from the repo without relying on chat history.
