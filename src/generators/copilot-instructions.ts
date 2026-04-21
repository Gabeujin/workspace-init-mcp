/**
 * Generator for .github/copilot-instructions.md.
 * Creates workspace-wide instructions tailored to the project and harness model.
 */

import {
  type WorkspaceInitParams,
  type GeneratedFile,
  PROJECT_TYPE_CONFIGS,
} from "../types.js";

export function generateCopilotInstructions(
  params: WorkspaceInitParams
): GeneratedFile {
  const config = PROJECT_TYPE_CONFIGS[params.projectType ?? "other"];
  const docLang = params.docLanguage ?? "Korean";
  const codeLang = params.codeCommentLanguage ?? "English";
  const isMulti = params.isMultiRepo ?? false;
  const techStack = params.techStack?.length
    ? params.techStack
    : config.defaultTechStack;

  const content = `# Workspace Copilot Instructions

These instructions apply across the entire workspace unless a more specific local instruction file overrides them.

## Workspace Overview

- Workspace: ${params.workspaceName}
- Purpose: ${params.purpose}
- Project type: ${config.label}
- Project profile: ${config.description}
- Tech stack: ${techStack.join(", ") || "Not specified"}
- Repository model: ${isMulti ? "Multi-repository or multi-project" : "Single repository"}

${renderPlannedTasks(params)}
${renderAdditionalContext(params)}
## Governance First

- Governance documentation comes first and last for every meaningful task.
- Before any implementation, refresh the active context, plan, and review artifacts.
- Do not start coding until the goal is explicit, review-backed, and frozen.
- If work is too large for one safe session, split it into resumable chunks before coding.
- Every chunk must end with updated review, verification, and handover state.
- Keep the admin dashboard JSON current so non-developers can see progress, KPIs, issues, and git visibility.

## Delivery Workflow

Follow this sequence for meaningful work:

1. Governance open
2. Plan 1
3. Review 1
4. Plan 2
5. Review 2
6. Plan 3
7. Review 3
8. Goal freeze
9. Governance refresh
10. Implementation
11. Verification, code review, and remediation
12. Governance close

### Workflow Rules

- Plan 1 should establish the first workable approach and identify unknowns.
- Review 1 should challenge scope, architecture, and missing context.
- Plan 2 should tighten sequencing, chunking, and risk controls.
- Review 2 should cover domain risks such as product, security, data, platform, and operations.
- Plan 3 should define the final chunk map, tests, and exit conditions.
- Review 3 should confirm resumability, validation order, and readiness to execute.
- Programming work must include matching tests or an explicit documented test gap with rationale.
- After implementation, run verification, code review, and immediate remediation before closure.

## Documentation Governance

Use repo artifacts as durable operational memory rather than relying on chat history.

- Context ledger: \`docs/context/\`
- Review ledger: \`docs/reviews/\`
- Execution plans: \`docs/plans/\`
- Handovers: \`docs/handovers/\`
- Work logs: \`docs/work-logs/\`
- Changelog: \`docs/changelog/\`
- Architectural decisions: \`docs/adr/\`
- AI harness policy: \`.github/ai-harness/\`
- Admin dashboard: \`docs/ai-harness/dashboard/\`

### Minimum Documentation Expectations

- Record the goal, scope, constraints, and success criteria before work begins.
- Track review outcomes and plan revisions as separate artifacts.
- Keep handover notes short, explicit, and immediately actionable.
- Update governance artifacts again after implementation and verification finish.

## Evidence-Based Development

- Base decisions on current repository evidence, approved documents, and verified references.
- Prefer targeted reads over broad scans to control token usage.
- Summarize durable findings into repo artifacts instead of re-reading the same context repeatedly.
- Stop and re-plan when token usage grows without decision progress.

## Project-Specific Guidance

${renderExtraInstructions(config.extraInstructions)}
${renderMultiRepoSection(isMulti)}
## Recommended Workspace Structure

\`\`\`
${params.workspaceName}/
|-- .github/
|   |-- copilot-instructions.md
|   |-- ai-harness/
|   |-- agents/
|   \`-- skills/
|-- .vscode/
|   |-- settings.json
|   \`-- *.instructions.md
|-- docs/
|   |-- context/
|   |-- reviews/
|   |-- plans/
|   |-- handovers/
|   |-- work-logs/
|   |-- changelog/
|   \`-- adr/
${isMulti ? "|-- <project-a>/\n|-- <project-b>/\n" : "|-- src/\n"}\`-- ${params.workspaceName}.code-workspace
\`\`\`

## Coding Conventions

- Prefer clear, intention-revealing names.
- Keep functions and modules focused on one responsibility.
- Use comments to explain why, not to restate obvious code.
- Handle errors explicitly and avoid silent failure paths.
- Keep changes small, reviewable, and traceable back to approved plans.

## Agent Operating Cadence

### Session Start

1. Read the latest governance artifacts before acting.
2. Continue unfinished work only if the current goal and handover state are still clear.
3. Open or refresh the active work log for new meaningful work.
4. Refresh the dashboard state before starting if progress, KPI, or git data is stale.

### During Work

1. Follow the approved plan and chunk boundaries.
2. Update documents as soon as decisions or scope change.
3. Run narrow verification early and often.
4. Escalate when cross-domain or high-risk decisions appear.
5. Update dashboard state when progress, blockers, KPIs, or git visibility changes.

### Session End

1. Refresh review, verification, and handover artifacts.
2. Record residual risks and the exact next step.
3. Refresh dashboard progress, issue, KPI, and git status snapshots.
4. Do not mark the work complete until governance and verification agree.

## Language and Encoding

- Documentation language: ${docLang}
- Code comment language: ${codeLang}
- Default file encoding: UTF-8

## Harness Overrides

- Governance documentation comes first and last for every meaningful agent task.
- Before implementation, create or refresh the relevant context, plan, and review artifacts.
- Complete Plan 1 -> Review 1 -> Plan 2 -> Review 2 -> Plan 3 -> Review 3 before broad coding starts.
- If the work is too large to complete safely in one uninterrupted session, split it into chunks before coding.
- Each chunk must end with updated work-log, review, verification, and handover state so the task remains resumable.
- Do not treat a task as complete until documentation, verification, and handover all agree on the final state.
`;

  return {
    relativePath: ".github/copilot-instructions.md",
    content,
  };
}

function renderPlannedTasks(params: WorkspaceInitParams): string {
  if (!params.plannedTasks?.length) {
    return "";
  }

  return `## Planned Work\n\n${params.plannedTasks.map((task) => `- ${task}`).join("\n")}\n\n`;
}

function renderAdditionalContext(params: WorkspaceInitParams): string {
  if (!params.additionalContext) {
    return "";
  }

  return `## Additional Context\n\n${params.additionalContext}\n\n`;
}

function renderExtraInstructions(lines: string[]): string {
  if (!lines.length) {
    return "- No extra project-specific guidance was supplied.\n";
  }

  return lines.map((line) => `- ${line}`).join("\n");
}

function renderMultiRepoSection(isMulti: boolean): string {
  if (!isMulti) {
    return "";
  }

  return `## Multi-Repository Coordination

- Document repository ownership, boundaries, and cross-repo impacts explicitly.
- Track changes per repository in changelog and handover artifacts.
- Make cross-repo dependencies visible before implementation starts.

`;
}
