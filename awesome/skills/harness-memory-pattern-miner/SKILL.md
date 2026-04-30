---
name: "Harness Memory Pattern Miner"
description: "Analyze session memories, work logs, governance traces, and repeated user requests to identify stable recurring workflows. Use when a harness workspace should turn repeated work into a reusable skill, agent, checklist, or governance playbook without overfitting to one session."
argument-hint: "Describe the repeated work pattern, memory scope, and whether to propose only or create assets"
user-invokable: true
disable-model-invocation: false
---

# Harness Memory Pattern Miner

Use this skill when repeated session behavior suggests the workspace needs a reusable skill or agent.

## Evidence Sources

Prefer durable harness records over chat recall:

- `memories/session/`
- `.github/instructions/`
- `.github/prompts/`
- `docs/work-logs/`
- `docs/context/`
- `docs/plans/`
- `docs/reviews/`
- `docs/handovers/`
- `docs/ai-harness/runtime/sessions/`
- `docs/ai-harness/dashboard/state/dashboard-state.json`
- `.governance/` intake notes when present

Do not scan protected legacy source roots unless the user explicitly asks for code-pattern extraction.

## Promotion Threshold

Promote a recurring pattern only when all criteria are met:

1. The same workflow appears at least three times or across at least two governed sessions.
2. The trigger is stable enough to describe in one sentence.
3. The inputs, expected outputs, and validation checks are repeatable.
4. The work benefits from reusable procedure, reusable scripts, or a dedicated role.
5. The pattern is not already covered by an installed skill, agent, prompt, or instruction.

If evidence is thin, create a backlog proposal instead of a skill or agent.

## Decision Rules

- Create a skill when the repeated work is procedural and another agent needs reusable instructions or scripts.
- Create an agent when the repeated work is a durable role with a point of view, review lens, or ownership boundary.
- Create both only when a role needs a companion procedure.
- Keep generated assets inside agent/skill ownership roots such as `.github/skills/`, `.github/agents/`, `.cursor/`, `.claude/`, or `.agents/`.
- Never modify application source while mining memory patterns.

## Workflow

1. Build an evidence table with source path, session/date, repeated action, trigger text, output type, and validation signal.
2. Score each candidate from 0 to 10:
   - frequency: 0-2
   - stability: 0-2
   - reuse value: 0-2
   - validation clarity: 0-2
   - coverage gap: 0-2
3. For candidates scoring below 7, write a backlog note or update governance context only.
4. For candidates scoring 7 or higher, draft the smallest useful skill or agent.
5. Run a collision check against existing catalog entries before creating files.
6. If creating a skill, keep `SKILL.md` concise and include only resources that are directly useful.
7. If creating an agent, define role, tools, operating rules, boundaries, and output format.
8. Add tests or catalog assertions when working inside `workspace-init-mcp` itself.
9. Record residual uncertainty in the review or handover artifact.

## Output Format

When proposing candidates, use:

| Candidate | Score | Asset Type | Evidence | Reason | Next Action |
| --- | ---: | --- | --- | --- | --- |

When creating assets, report:

- created or updated paths
- evidence summary
- trigger phrase
- validation performed
- remaining uncertainty
