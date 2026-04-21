---
name: "Harness Dashboard State Manager"
description: "Maintain JSON-based dashboard state for progress, KPIs, issues, session history, and git visibility without using a database."
argument-hint: "Describe the task state, KPI changes, issues, git snapshot, and which dashboard JSON sections need to be updated."
user-invokable: true
disable-model-invocation: false
---

# Harness Dashboard State Manager

Use this skill when the workspace dashboard needs a truthful update that non-developers can scan quickly.

## Core Rules

1. Keep dashboard state in JSON files only. Do not introduce a database.
2. Update the dashboard at governance open, after meaningful progress changes, after verification, and at governance close.
3. Prefer short, operator-friendly labels over engineering shorthand.
4. Distinguish facts, risks, and assumptions clearly.
5. Keep git visibility explicit: whether history is tracked, what branch is active, and whether the working tree is clean.

## Required Sections

- Executive summary
- Progress state and current chunk
- KPI cards
- Issue and error log
- Session log
- Governed session records
- Artifact coverage
- Git status snapshot

## KPI Guidance

- Use labels that product, operations, and review stakeholders can understand quickly.
- Track directional health, not vanity metrics.
- Document the target state and why a KPI is warning, healthy, or risky.

## Progress State Guidance

- Name the active goal and the exact next step.
- Show whether work is blocked and why.
- Keep the planning and review ladder visible until implementation is allowed.
- Keep contract coverage and independent evaluation visible when they are required.

## Git Guidance

- Record whether the workspace is tracked in git.
- Capture branch, last commit snapshot, and working-tree cleanliness when known.
- If the status is unknown, say so explicitly instead of guessing.

## Output Standard

- Another operator can open the dashboard JSON and understand current delivery status in under five minutes.
