---
name: "Harness Documentation Records"
description: "Create durable work logs, final records, AS-IS vs TO-BE summaries, and flow documents that keep long-running AI work resumable and auditable."
argument-hint: "Describe the task, document type, source evidence, and the outcome that must be recorded"
user-invokable: true
disable-model-invocation: false
---

# Harness Documentation Records

Use this skill when meaningful work needs a durable record before implementation starts, while it is in flight, or after it finishes.

## Core Rules

1. Record only evidence-backed facts, approved plans, and clearly labeled assumptions.
2. Keep every artifact UTF-8 safe and easy for a later session to resume from.
3. Prefer durable summaries over transcript-like chat dumps.
4. Capture why the change exists, what changed, how it was verified, and what remains risky.
5. When the task is large, record chunk boundaries and exit conditions explicitly.

## Document Types

- Governance-opening note
- Plan and review records
- Work log for an implementation chunk
- Final record or completion summary
- AS-IS vs TO-BE comparison
- Flow or dependency note with Mermaid when structure matters
- Handover note for the next session

## Required Fields

- Goal and scope boundary
- Relevant files, modules, or services
- Key decisions and rationale
- Verification performed
- Open risks, gaps, or follow-up work
- Next recommended action

## Writing Pattern

1. Start with the purpose of the artifact.
2. Cite the source evidence that supports the record.
3. Summarize the current state in language that a new contributor can understand quickly.
4. Add AS-IS vs TO-BE notes when behavior or architecture changed.
5. Close with verification status and any unresolved items.

## Completion Standard

- Another agent can resume work without relying on hidden chat context.
- The document explains both intent and evidence.
- The record points to the latest plan, review, and verification surfaces.
