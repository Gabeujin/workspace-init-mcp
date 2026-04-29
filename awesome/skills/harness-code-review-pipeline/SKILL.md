---
name: "Harness Code Review Pipeline"
description: "Run a disciplined code review pipeline after each implementation chunk. Includes criteria extraction, automated checks, third-party review, test coverage verification, and remediation loops."
argument-hint: "Describe the completed chunk, changed files, and expected behavior"
user-invokable: true
disable-model-invocation: false
---

# Harness Code Review Pipeline

Use this skill after each chunk of code work and before considering the task complete.

## Required Stages

1. Extract review criteria from the active plan, review notes, and workspace conventions.
2. Run relevant automated checks:
   - build or type checks
   - linting if configured
   - targeted tests
   - UTF-8 integrity for changed text artifacts
3. Validate boundary conditions and likely runtime exception paths.
4. Check environment compatibility, including framework/runtime versions such as Java/JDK when relevant.
5. Audit newly added or changed dependencies for conflicts with the existing system.
6. Review maintainability: SOLID, duplication, abstraction level, constants instead of hardcoding, and business/data-access separation.
7. Confirm generator self-correction includes uncertainty where evidence is weak.
8. Confirm atomic commit scope for each chunk or remediation.
9. Run an implementation-independent code review.
10. Highlight missing or weak test coverage.
11. Apply remediation and re-run the relevant checks until the chunk is clean.

## Review Priorities

1. security and data integrity
2. correctness and regressions
3. test coverage and verification depth
4. performance and maintainability
5. style and consistency

## Exit Rule

Do not close the chunk until critical and important findings are resolved, relevant tests pass, and governance artifacts reflect the final state.
