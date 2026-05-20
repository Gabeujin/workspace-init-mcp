---
name: "Harness Dashboard State Manager"
description: "Maintain the Harness Dashboard 4.6 Hypertext Project World Model, ledger-backed projections, briefs, dictionary, VCS evidence, and listener state without using a database."
argument-hint: "Describe project-world-model facts, tasks, decisions, service state, operations evidence, VCS links, dictionary terms, or dashboard projections that need to be updated."
user-invokable: true
disable-model-invocation: false
---

# Harness Dashboard State Manager

Use this skill when the generated dashboard surfaces need truthful updates that stakeholders and AI Agents can scan quickly.

## Core Rules

1. Treat `events/harness-events.jsonl` as canonical truth; projection JSON and HTML are rebuildable.
2. Keep dashboard state in JSON files only. Do not introduce a database.
3. Prefer short stakeholder-friendly labels over engineering shorthand.
4. Distinguish observed, declared, planned, inferred, and stale facts clearly.
5. Keep work status explicit: waiting, in-progress, completed, blocked, failed, needs-user, and real-world.
6. Do not store secret values; references only.

## Required Sections

- `projectWorldModel`: mission, stakeholders, products, services, environments, repos, data assets, dependencies, risks, decisions, cadence, metrics, constraints
- `stakeholderBrief`: current goal, what changed, why it matters, current risk, required decision, owner, due date, next milestone, evidence links
- `agentResumeBrief`: current project goal, active session, last safe checkpoint, next safest action, blockers, validation commands, authoritative files, confidence
- `governanceEvidenceBrief`: evidence coverage, missing claims, unlinked VCS changes, unresolved decisions, stale projections, failed validations
- `taskQueues`, `decisionContracts`, `agile`, `operationsTimeline`, `releaseReadiness`, `incidentReadiness`, `sloSli`, `databaseReadiness`
- `dictionary`, `ontology`, `embeddingProjection`, `versionControl`, `vcsChangeRecords`, and `listener`

## Evidence Guidance

- Treat healthy, released, operational, connected, approved, or complete states as evidence claims.
- Record event sequence, source, timestamp, freshness, confidence, owner, and evidence links.
- Link Git commits or SVN revisions to sessions, tasks, decisions, releases, or warnings.
- Never show placeholder release, incident, SLO, database, or service-health evidence as current.

## World Model Maturity Guidance

- Treat `governanceActionabilityScore.score` as the current governance setup/readiness-to-govern score, not as production readiness.
- Treat `governanceActionabilityScore.operationalEvidenceScore` as the separate operational proof score.
- Improve both scores gradually by adding evidence, resolving decisions, linking VCS, clarifying owners, and converting missing claims into owned work.
- Never inflate a score by hiding warnings, deleting missing evidence, or treating declared/tacit context as observed fact.
- Use `worldModelImprovementContract` as the Agent contract for maturity loops, score improvement policy, tab ownership, and non-duplication rules.
- Ask the user for tacit real-world context when repository evidence cannot explain operational constraints, stakeholder intent, release windows, support expectations, or external account state. Store it as `declared` with owner, timestamp, confidence, and reversal condition.

## Tab Ownership And Non-Duplication

- Overview answers only: what changed, why it matters, current trust, current decision, and score meaning.
- Work owns open tasks, progress, Kanban/Gantt, blockers, remaining effort, and KPI timing inputs.
- Evidence owns claim-to-proof, missing evidence, VCS linkage, validation, and falsification status.
- Governance owns decisions, gates, values, cadence, reviews, retros, and improvement actions.
- Operations owns services, environments, dependencies, releases, incidents, SLO/SLI, database, and listener health.
- Tech Stack owns architecture, runtime stack, infrastructure, deployment path, data stores, and harness integration.
- Do not duplicate the same table across tabs. If a fact must appear in multiple tabs, each tab must answer a different stakeholder question about that fact.

## Dashboard Collaboration Protocol

- When the user references a dashboard tab, task, claim, decision, score, or blocker, respond as if both user and Agent are looking at the same dashboard projection.
- Name the relevant tab, item id or label, evidence path, current score impact, and safest next action.
- Prefer generated harness skills and `get_harness_dashboard_context` over ad hoc reading of unrelated files.

## Work Guidance

- Map legacy `TODO`, `FIXME`, `OPEN`, and unchecked boxes to `waiting`.
- Use `needs-user` for decisions, approvals, or confirmations.
- Use `real-world` for work agents cannot perform, such as purchases, external account setup, physical device access, or service procurement.
- Use `failed` only when there is clear evidence of failure.

## Safety Guidance

- Do not introduce a database dependency.
- Do not turn the read-only local listener into a hidden backend app.
- Do not store secrets, raw tokens, private key material, environment variable values, or private deployment details in dashboard state, preview, or logs.
- Do not embed restricted or secret material unless an explicit governance event permits it.

## Output Standard

- A stakeholder can open the single HTML dashboard and understand project state in seconds.
- A fresh AI Agent can read `dashboard-index.json` or call `get_harness_dashboard_context` and resume work without chat history.
