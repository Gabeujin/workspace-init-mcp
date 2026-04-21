---
name: "Harness Multi-Expert Review"
description: "Run a structured multi-expert review with evaluation criteria, context isolation, three review rounds, convergence, and governance-ready outputs."
argument-hint: "Describe what should be reviewed, the relevant files or domains, and whether the review is pre-work or post-work"
user-invokable: true
disable-model-invocation: false
---

# Harness Multi-Expert Review

Use this skill when a task needs multiple expert lenses before the goal is frozen or before the implementation plan is finalized.

## Review Model

### Round 1: Independent Expert Review

- generate compact evaluation criteria from governance artifacts, code conventions, and the active task goal
- delegate only the relevant file set to each expert lens
- collect evidence-backed findings only

### Round 2: Cross-Review Synthesis

- merge duplicates
- resolve conflicting recommendations
- identify critical, important, and optional follow-up items

### Round 3: Final Improvement Plan

- confirm the reviewed goal and boundaries
- sequence changes by dependency and risk
- define the final plan that implementation must follow

## Suggested Expert Lenses

- architecture
- frontend
- backend
- security
- data
- platform and operations
- UX and accessibility
- product impact

## Output Expectations

- a concise evaluation criteria note
- one artifact per review round
- a final improvement plan that can be implemented without guesswork
