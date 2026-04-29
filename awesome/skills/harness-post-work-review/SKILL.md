---
name: "Harness Post-Work Review"
description: "Run the final quality gate after implementation. Executes multi-expert inspection, remediation, verification, and governance closure before a task is considered done."
argument-hint: "Describe the completed work, changed scope, and any known risks"
user-invokable: true
disable-model-invocation: false
---

# Harness Post-Work Review

Use this skill when implementation is complete and the task needs final verification, remediation, and documentation closure.

## Final Quality Gate

1. Gather change context and expected outcomes.
2. Confirm the latest contract and evaluator criteria before approval.
3. Run the maturity gate:
   - static analysis and likely runtime exception scan
   - boundary testing
   - environment and framework/runtime compatibility check
   - dependency audit
   - maintainability and extensibility review
   - generator self-correction and uncertainty report
   - atomic commit traceability
4. Run three review rounds:
   - independent expert inspection
   - synthesis and remediation planning
   - final approval review
5. Remediate every critical finding and any important finding that blocks safe release or handoff.
6. Re-run tests, automated checks, and code review after remediation.
7. Update governance artifacts last.

## Required Closure

- tests and verification are current
- code review findings are addressed
- remaining risks are explicit
- handover guidance is fresh
- governance records match the shipped state
