---
name: "Domain Model Ledger"
description: "Maintain domain-specific timeline, entity, release, and version views so operators can understand work across software, narrative, and knowledge domains."
argument-hint: "Describe the domain, the entities or versions being tracked, and what changed in the timeline or model."
user-invokable: true
disable-model-invocation: false
---

# Domain Model Ledger

Use this skill when the dashboard needs domain-aware state that goes beyond generic task progress.

## Core Rules

1. Model the domain in language the real stakeholders use.
2. Keep timelines, entities, and version history readable by non-developers.
3. Preserve continuity between sessions by tracking what changed and why.
4. Prefer one concise summary per entity or version over scattered notes.

## Domain Patterns

- Software delivery:
  - features
  - components or services
  - releases and version history
- Narrative work:
  - characters
  - story beats or acts
  - draft progression
- Learning and research:
  - modules
  - references
  - iteration history

## Modeling Rules

- Every timeline item should have a status and owner.
- Every entity should explain why it matters.
- Every version entry should show scope and progress.
- If a concept changes names, keep the old and new names traceable.

## Output Standard

- A stakeholder can see the current structure of the work without opening chat history or source code.
