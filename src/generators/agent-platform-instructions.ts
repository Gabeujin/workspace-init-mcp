/**
 * Platform-specific AI agent instruction files.
 *
 * These files make the same Harness World Model contract visible to Codex,
 * Claude Code, Cursor, Antigravity, GitHub Copilot, and generic agents.
 */

import {
  PROJECT_TYPE_CONFIGS,
  type GeneratedFile,
  type TargetIDE,
  type WorkspaceInitParams,
} from "../types.js";

export const HARNESS_INSTRUCTION_BLOCK_START =
  "<!-- workspace-init-mcp:harness-world-model:start -->";
export const HARNESS_INSTRUCTION_BLOCK_END =
  "<!-- workspace-init-mcp:harness-world-model:end -->";

export function extractHarnessInstructionBlock(content: string): string | null {
  const startIndex = content.indexOf(HARNESS_INSTRUCTION_BLOCK_START);
  const endIndex = content.indexOf(HARNESS_INSTRUCTION_BLOCK_END);
  if (startIndex < 0 || endIndex < startIndex) {
    return null;
  }

  return content.slice(
    startIndex,
    endIndex + HARNESS_INSTRUCTION_BLOCK_END.length
  );
}

export function mergeHarnessInstructionBlock(
  generatedContent: string,
  existingContent: string
): string {
  const generatedBlock =
    extractHarnessInstructionBlock(generatedContent) ??
    generatedContent.trimEnd();
  const existingStart = existingContent.indexOf(HARNESS_INSTRUCTION_BLOCK_START);
  const existingEnd = existingContent.indexOf(HARNESS_INSTRUCTION_BLOCK_END);

  if (existingStart >= 0 && existingEnd >= existingStart) {
    const before = existingContent.slice(0, existingStart).trimEnd();
    const after = existingContent
      .slice(existingEnd + HARNESS_INSTRUCTION_BLOCK_END.length)
      .trimStart();
    return `${before}${before ? "\n\n" : ""}${generatedBlock}${after ? `\n\n${after}` : ""}\n`;
  }

  const trimmedExisting = existingContent.trimEnd();
  return `${trimmedExisting}${trimmedExisting ? "\n\n" : ""}${generatedBlock}\n`;
}

function normalizeTargetIDE(value: TargetIDE): TargetIDE {
  return value === "claude" ? "claude-code" : value;
}

function targetPlatformSet(params: WorkspaceInitParams): Set<TargetIDE> {
  const targets: TargetIDE[] = params.targetIDEs?.length
    ? params.targetIDEs
    : ["vscode"];
  return new Set(targets.map(normalizeTargetIDE));
}

function renderHarnessInstructionBlock(
  params: WorkspaceInitParams,
  platformLabel: string
): string {
  const config = PROJECT_TYPE_CONFIGS[params.projectType ?? "other"];
  const techStack = params.techStack?.length
    ? params.techStack
    : config.defaultTechStack;

  return `${HARNESS_INSTRUCTION_BLOCK_START}
## Workspace-Init Harness World Model

This ${platformLabel} instruction block is managed by workspace-init-mcp. Preserve project-specific instructions outside this block, and update this block through workspace-init-mcp reconcile when the harness baseline changes.

### Project Identity

- Workspace: ${params.workspaceName}
- Purpose: ${params.purpose}
- Project type: ${config.label}
- Tech stack: ${techStack.join(", ") || "Not specified"}
- Harness root: \`docs/ai-harness/\`
- Dashboard state: \`docs/ai-harness/dashboard/state/dashboard-index.json\`
- Runtime state: \`docs/ai-harness/runtime/state/current-work-packet.json\`

### Required Session Startup

1. Read \`AGENTS.md\`, the platform instruction file, and \`docs/ai-harness/dashboard/state/dashboard-index.json\` before meaningful work.
2. If dashboard context may be stale, call \`get_harness_dashboard_context\` instead of relying on chat history.
3. Treat the Harness Dashboard as the project world model: Overview summarizes, Work sequences, Evidence proves, Governance decides, Operations runs, and Tech Stack explains composition.
4. Check \`agentPlatformGovernance\`; if active platforms are still inferred, ask the user to confirm them and record the declaration with \`dashboard-ops.mjs record-agent-platforms\`.
5. Treat instruction files for non-active platforms as \`unused-instruction\` until the user reactivates that platform.
6. Improve the world model gradually by linking real evidence, clarifying owners, capturing tacit user context, and recording decisions with confidence and reversal conditions.
7. Never raise governance or evidence scores by hiding warnings, deleting missing evidence, or converting declared context into observed fact.

### Parallel Orchestration Contract

- The main agent is the hub for work decomposition, subagent delegation, integration, and final judgment.
- For non-trivial requests, plan bounded chunks by subsystem, dependency, and expected write paths before implementation begins.
- Use parallel subagents only when chunks have disjoint write scopes and no unresolved shared DB/schema/API/runtime side effects.
- Run \`audit_harness_parallel_chunk_conflicts\` before assigning parallel workers.
- Include every file a worker may write in \`expectedWritePaths\`, including manifests, lockfiles, migrations, generated clients, API contracts, CI workflows, and shared config.
- Integration-sensitive surfaces require one named merge owner or sequential execution.
- A worker that needs an undeclared write path must stop and return to the hub for contract update before editing.

### Hub Review Loop

1. Hub creates chunk contracts with expected reads, expected writes, owner, merge owner, verification commands, and done criteria.
2. Workers execute only their assigned chunk and return receipts, evidence, changed paths, residual risk, and confidence.
3. Hub reviews worker outputs against the contract, repository evidence, dashboard state, and validation results.
4. If quality is insufficient, the hub issues a focused improvement pass and repeats work -> evaluate -> improve until the exit threshold is met or a blocker is recorded.
5. Hub updates dashboard/runtime memory with durable lessons, decisions, evidence links, and next safest action before closing.

### Memory And Continuity

- Durable project memory lives in harness artifacts, not in private chat context.
- Record tacit user context as declared facts with owner, timestamp, confidence, and source.
- Every closed session should leave a retro insight or explicit \`no-new-learning\` event.
- Any future agent model must be able to resume from dashboard index, runtime packets, contracts, evidence, and handovers without reconstructing hidden state.
${HARNESS_INSTRUCTION_BLOCK_END}`;
}

function buildAgentsMd(params: WorkspaceInitParams): GeneratedFile {
  return {
    relativePath: "AGENTS.md",
    content: `# AGENTS.md

Repository-level instructions for AI coding agents. This file is intentionally platform-neutral and should be read before implementation work.

${renderHarnessInstructionBlock(params, "cross-agent")}
`,
  };
}

function buildClaudeMd(params: WorkspaceInitParams): GeneratedFile {
  return {
    relativePath: "CLAUDE.md",
    content: `# CLAUDE.md

Claude Code project memory for this workspace. Preserve human-authored Claude guidance outside the managed block.

${renderHarnessInstructionBlock(params, "Claude Code")}
`,
  };
}

function buildCursorRule(params: WorkspaceInitParams): GeneratedFile {
  return {
    relativePath: ".cursor/rules/harness-world-model.mdc",
    content: `---
description: Workspace-init Harness World Model governance, orchestration, and memory rules
alwaysApply: true
---

# Harness World Model

${renderHarnessInstructionBlock(params, "Cursor")}
`,
  };
}

function buildAntigravityPluginManifest(): GeneratedFile {
  return {
    relativePath: ".agents/plugins/workspace-init-harness/plugin.json",
    content: `${JSON.stringify({ name: "workspace-init-harness" }, null, 2)}\n`,
  };
}

function buildAntigravityRule(params: WorkspaceInitParams): GeneratedFile {
  return {
    relativePath:
      ".agents/plugins/workspace-init-harness/rules/harness-world-model.md",
    content: `# Harness World Model

Antigravity project rule for workspace-init-mcp governed AI delivery. Preserve human-authored Antigravity rules outside the managed block.

${renderHarnessInstructionBlock(params, "Antigravity")}
`,
  };
}

export function generateAgentPlatformInstructionFiles(
  params: WorkspaceInitParams
): GeneratedFile[] {
  const platforms = targetPlatformSet(params);
  const files: GeneratedFile[] = [buildAgentsMd(params)];

  if (platforms.has("claude-code")) {
    files.push(buildClaudeMd(params));
  }

  if (platforms.has("cursor")) {
    files.push(buildCursorRule(params));
  }

  if (platforms.has("antigravity")) {
    files.push(buildAntigravityPluginManifest(), buildAntigravityRule(params));
  }

  return files;
}
