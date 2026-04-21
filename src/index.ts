#!/usr/bin/env node

/**
 * workspace-init-mcp MCP Server v4.0.1
 *
 * An MCP server that initializes VS Code workspaces with
 * documentation governance, Copilot instructions, and project structure.
 *
 * Uses the latest MCP SDK registerTool/registerPrompt/registerResource API.
 * Transport: stdio
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

import { type WorkspaceInitParams, PROJECT_TYPE_CONFIGS } from "./types.js";
import { collectFiles, buildSummary } from "./tools/initialize.js";
import {
  TARGET_IDE_VALUES,
  resolveWorkspaceTargetIDEs,
} from "./tools/agent-skills-install.js";
import { buildInitFormSchema } from "./tools/form-schema.js";
import { validateWorkspace } from "./tools/validate.js";
import { analyzeWorkspace } from "./tools/status.js";
import {
  startHarnessSession,
  advanceHarnessSession,
  getHarnessSessionStatus,
} from "./tools/harness-runtime.js";
import {
  buildWorkspaceInitMessages,
  buildQuickStartMessages,
  buildAnalyzeMessages,
} from "./prompts/index.js";
import {
  recommendAgentSkills,
  searchAgentSkills,
  listCategories,
  buildCatalogIndexes,
  AGENT_REGISTRY,
  SKILL_REGISTRY,
} from "./data/agent-skills-registry.js";
import { buildHarnessProfilesSummary } from "./data/harness-profiles.js";
import { generateSelectedSkills } from "./generators/agent-skills.js";

// ---------------------------------------------------------------------------
// Encoding helper
// ---------------------------------------------------------------------------

/**
 * Write file content with the specified encoding.
 * Handles utf-8-bom by prepending BOM to utf-8 output.
 */
function writeFileWithEncoding(
  fullPath: string,
  content: string,
  encoding: string
): void {
  if (encoding === "utf-8-bom") {
    fs.writeFileSync(fullPath, "\uFEFF" + content, "utf-8");
  } else {
    fs.writeFileSync(fullPath, content, encoding as BufferEncoding);
  }
}

// ---------------------------------------------------------------------------
// Schema definitions (Zod)
// ---------------------------------------------------------------------------

const PROJECT_TYPES = [
  "learning",
  "web-app",
  "api",
  "mobile",
  "data-science",
  "devops",
  "creative",
  "library",
  "monorepo",
  "consulting",
  "ecommerce",
  "fintech",
  "healthcare",
  "saas",
  "iot",
  "other",
] as const;

const HARNESS_RUNTIME_ACTIONS = [
  "complete",
  "request_changes",
  "block",
  "resume",
  "context_reset",
] as const;

const HARNESS_RUNTIME_ACTORS = [
  "planner",
  "generator",
  "evaluator",
  "operator",
] as const;

const BaseWorkspaceInputSchema = z.object({
  workspaceName: z
    .string()
    .describe("Name of the workspace (used in headings, file names)"),
  purpose: z
    .string()
    .describe(
      "Primary purpose and goals of this workspace. Be as specific as possible."
    ),
  workspacePath: z
    .string()
    .describe("Absolute path to the workspace root directory"),
  projectType: z
    .enum(PROJECT_TYPES)
    .optional()
    .describe(
      "Type of project: learning, web-app, api, mobile, data-science, devops, creative, library, monorepo, consulting, ecommerce, fintech, healthcare, saas, iot, other"
    ),
  techStack: z
    .array(z.string())
    .optional()
    .describe('Technology stack (e.g., ["TypeScript", "React", "Node.js"])'),
  docLanguage: z
    .string()
    .optional()
    .describe('Language for documentation (default: "Korean")'),
  codeCommentLanguage: z
    .string()
    .optional()
    .describe('Language for code comments (default: "English")'),
  isMultiRepo: z
    .boolean()
    .optional()
    .describe("Whether this workspace manages multiple projects/repos"),
  additionalContext: z
    .string()
    .optional()
    .describe("Any additional context or special requirements"),
  plannedTasks: z
    .array(z.string())
    .optional()
    .describe("Key workflows or tasks planned for this workspace"),
  includeAgentSkills: z
    .boolean()
    .optional()
    .describe(
      "Whether to include Agent Skills (.github/skills/ and .github/agents/). Default: true"
    ),
  agentSkillsIntent: z
    .string()
    .optional()
    .describe(
      "User intent for agent skill recommendation tuning (e.g., 'focus on testing and devops')"
    ),
  fileEncoding: z
    .enum(["utf-8", "utf-8-bom", "ascii", "latin1"])
    .optional()
    .describe(
      'File encoding for generated files (default: "utf-8"). Use "utf-8-bom" for Windows tools that require BOM.'
    ),
  targetIDEs: z
    .array(z.enum(TARGET_IDE_VALUES))
    .optional()
    .describe(
      'Target IDEs for Agent Skills file paths (default: ["vscode"]). Select multiple to generate skills into each IDE\'s directory.'
    ),
  lineEnding: z
    .enum(["lf", "crlf", "auto"])
    .optional()
    .describe(
      'Line ending style for generated files and .gitattributes (default: "lf").'
    ),
  includeHarnessEngineering: z
    .boolean()
    .optional()
    .describe(
      "Whether to generate AI harness engineering artifacts. Default: true"
    ),
  harnessProfile: z
    .enum(["lean", "balanced", "regulated", "autonomous"])
    .optional()
    .describe('Harness profile for long-running AI delivery. Default: "balanced".'),
  governanceProfile: z
    .enum(["standard", "strict", "regulated"])
    .optional()
    .describe('Governance strictness for the workspace. Default: "strict".'),
  autonomyMode: z
    .enum(["guided", "balanced", "autonomous"])
    .optional()
    .describe('How independently AI should execute work. Default: "balanced".'),
  tokenBudget: z
    .enum(["lean", "balanced", "thorough"])
    .optional()
    .describe('Token usage strategy for the workspace. Default: "balanced".'),
  primaryDomains: z
    .array(z.string())
    .optional()
    .describe(
      'Primary domains the harness must coordinate (e.g., ["product", "platform", "security"]).'
    ),
});

const InitializeWorkspaceInputSchema = BaseWorkspaceInputSchema.extend({
  force: z
    .boolean()
    .optional()
    .describe(
      "If true, overwrite existing files. If false (default), skip files that already exist."
    ),
});

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "workspace-init-mcp",
  version: "4.0.1",
});

// ---------------------------------------------------------------------------
// Tool: initialize_workspace
// ---------------------------------------------------------------------------

server.registerTool(
  "initialize_workspace",
  {
    title: "Initialize Workspace",
    description: `Initialize a VS Code workspace with documentation governance, Copilot instructions, Agent Skills, and project structure.

This tool creates a complete workspace setup including:
- .github/copilot-instructions.md (global Copilot instructions)
- .github/skills/ (Agent Skills - SKILL.md files per the agentskills.io standard)
- .github/agents/ (Agent definitions - .agent.md files)
- docs/ai-harness/dashboard/ (JSON-first admin dashboard with progress, KPI, issue, and git visibility)
- docs/ai-harness/runtime/ (planner / generator / evaluator runtime state, prompts, and session ledgers)
- docs/ai-harness/dashboard/scripts/dashboard-ops.mjs (dashboard refresh, strict validation, local preview server, and static export)
- .vscode/settings.json (Copilot custom instruction references)
- .vscode/*.instructions.md (code generation, test, review, commit, PR instructions)
- .editorconfig (cross-editor formatting consistency)
- .gitattributes (cross-platform line ending consistency)
- docs/ (work-logs, troubleshooting, changelog, adr, and project-type-specific directories)
- Initial changelog and work log entries

Agent Skills are included by default (set includeAgentSkills: false to skip).
Use targetIDEs to generate skills for multiple IDEs (vscode, cursor, claude-code, openhands).
Use fileEncoding to set file encoding (default: utf-8). Use lineEnding to set line endings (default: lf).

Required inputs: workspaceName, purpose, workspacePath
Optional inputs: projectType, techStack, docLanguage, codeCommentLanguage, isMultiRepo, additionalContext, plannedTasks, includeAgentSkills, agentSkillsIntent, fileEncoding, targetIDEs, lineEnding`,
    inputSchema: InitializeWorkspaceInputSchema,
  },
  async (params) => {
    try {
      const initParams: WorkspaceInitParams = {
        workspaceName: params.workspaceName,
        purpose: params.purpose,
        workspacePath: params.workspacePath,
        projectType: params.projectType as WorkspaceInitParams["projectType"],
        techStack: params.techStack,
        docLanguage: params.docLanguage,
        codeCommentLanguage: params.codeCommentLanguage,
        isMultiRepo: params.isMultiRepo,
        additionalContext: params.additionalContext,
        plannedTasks: params.plannedTasks,
        includeAgentSkills: params.includeAgentSkills,
        agentSkillsIntent: params.agentSkillsIntent,
        includeHarnessEngineering: params.includeHarnessEngineering,
        harnessProfile: params.harnessProfile,
        governanceProfile: params.governanceProfile,
        autonomyMode: params.autonomyMode,
        tokenBudget: params.tokenBudget,
        primaryDomains: params.primaryDomains,
        fileEncoding: params.fileEncoding as WorkspaceInitParams["fileEncoding"],
        targetIDEs: params.targetIDEs as WorkspaceInitParams["targetIDEs"],
        lineEnding: params.lineEnding as WorkspaceInitParams["lineEnding"],
      };

      // Generate all files
      const files = collectFiles(initParams);

      // Write files to disk
      const force = params.force ?? false;
      const encoding = params.fileEncoding ?? "utf-8";
      const written: string[] = [];
      const skipped: string[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const fullPath = path.join(params.workspacePath, file.relativePath);
        try {
          const dir = path.dirname(fullPath);
          fs.mkdirSync(dir, { recursive: true });

          if (!force && fs.existsSync(fullPath)) {
            skipped.push(file.relativePath);
            continue;
          }

          writeFileWithEncoding(fullPath, file.content, encoding);
          written.push(file.relativePath);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${file.relativePath}: ${msg}`);
        }
      }

      const result = buildSummary(initParams, files);

      let text = result.summary;

      // Append environment info
      const envInfo: string[] = [];
      envInfo.push(`File encoding: ${encoding}`);
      const ides = params.targetIDEs ?? ["vscode"];
      envInfo.push(`Target IDEs: ${ides.join(", ")}`);
      envInfo.push(`Line endings: ${params.lineEnding ?? "lf"}`);
      text += `\n\n${envInfo.join("\n")}`;

      if (skipped.length > 0) {
        const skippedList = skipped.map((s) => `  - ${s}`).join("\n");
        text += `\n\nSkipped existing files (${skipped.length}):\n${skippedList}`;
        text += "\n  Re-run with force: true to overwrite them.";
      }
      if (errors.length > 0) {
        text += `\n\nFailed file writes:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
      }

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Initialization failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: preview_workspace_init
// ---------------------------------------------------------------------------

server.registerTool(
  "preview_workspace_init",
  {
    title: "Preview Workspace Init",
    description: `Preview the files that would be generated by initialize_workspace without actually creating them.
Useful for reviewing the planned structure before committing to it.`,
    inputSchema: BaseWorkspaceInputSchema,
  },
  async (params) => {
    try {
      const initParams: WorkspaceInitParams = {
        workspaceName: params.workspaceName,
        purpose: params.purpose,
        workspacePath: params.workspacePath,
        projectType: params.projectType as WorkspaceInitParams["projectType"],
        techStack: params.techStack,
        docLanguage: params.docLanguage,
        codeCommentLanguage: params.codeCommentLanguage,
        isMultiRepo: params.isMultiRepo,
        additionalContext: params.additionalContext,
        plannedTasks: params.plannedTasks,
        includeAgentSkills: params.includeAgentSkills,
        agentSkillsIntent: params.agentSkillsIntent,
        includeHarnessEngineering: params.includeHarnessEngineering,
        harnessProfile: params.harnessProfile,
        governanceProfile: params.governanceProfile,
        autonomyMode: params.autonomyMode,
        tokenBudget: params.tokenBudget,
        primaryDomains: params.primaryDomains,
        fileEncoding: params.fileEncoding as WorkspaceInitParams["fileEncoding"],
        targetIDEs: params.targetIDEs as WorkspaceInitParams["targetIDEs"],
        lineEnding: params.lineEnding as WorkspaceInitParams["lineEnding"],
      };

      const files = collectFiles(initParams);

      const preview = files
        .map(
          (f) =>
            `- ${f.relativePath}\n${"-".repeat(60)}\n${f.content.slice(0, 500)}${f.content.length > 500 ? "\n... (truncated)" : ""}\n`
        )
        .join("\n");

      const text = `Workspace initialization preview: ${params.workspaceName}\n\nGenerated files: ${files.length}\n\n${preview}`;

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Preview failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: list_project_types
// ---------------------------------------------------------------------------

server.registerTool(
  "list_project_types",
  {
    title: "List Project Types",
    description:
      "List all available project types and their descriptions. Useful when the user is unsure which project type to choose.",
    inputSchema: z.object({}),
  },
  async () => {
    const lines = Object.entries(PROJECT_TYPE_CONFIGS).map(
      ([key, config]) =>
        `- **${key}** (${config.label}): ${config.description}\n  Default tech stack: ${config.defaultTechStack.length ? config.defaultTechStack.join(", ") : "none"}\n  Documentation sections: ${config.docSections.length ? config.docSections.join(", ") : "none"}`
    );

    const text = `Available project types:\n\n${lines.join("\n\n")}`;
    return { content: [{ type: "text" as const, text }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: list_harness_profiles
// ---------------------------------------------------------------------------

server.registerTool(
  "list_harness_profiles",
  {
    title: "List Harness Profiles",
    description:
      "List the built-in AI harness profiles for long-running workspace delivery.",
    inputSchema: z.object({}),
  },
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: buildHarnessProfilesSummary(),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_init_form_schema
// ---------------------------------------------------------------------------

server.registerTool(
  "get_init_form_schema",
  {
    title: "Get Init Form Schema",
    description: `Returns a universal JSON form schema for workspace initialization.

This schema can be used by ANY LLM client (CLI, VSCode, Claude Desktop, GPT Desktop,
Google AI Studio, etc.) to render an input form for the user. The schema includes:
- Required and optional fields clearly separated into sections
- Field types (text, select, multiselect, boolean, textarea, tags)
- Descriptions, placeholders, defaults, and validation rules
- A conversational guide for chat-based LLMs
- A CLI prompt guide for terminal-based clients

Call this tool FIRST when a user wants to initialize a workspace, then use the
returned schema to collect inputs before calling initialize_workspace.`,
    inputSchema: z.object({
      format: z
        .enum(["full", "conversational", "cli"])
        .optional()
        .describe(
          "Output format: 'full' (complete JSON schema), 'conversational' (markdown guide for chat), 'cli' (compact CLI guide). Default: full"
        ),
    }),
  },
  async (params) => {
    const schema = buildInitFormSchema();
    const format = params.format ?? "full";

    let text: string;
    switch (format) {
      case "conversational":
        text = schema.conversationalGuide;
        break;
      case "cli":
        text = schema.cliPromptGuide;
        break;
      default:
        text = JSON.stringify(schema, null, 2);
        break;
    }

    return { content: [{ type: "text" as const, text }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: validate_workspace
// ---------------------------------------------------------------------------

server.registerTool(
  "validate_workspace",
  {
    title: "Validate Workspace",
    description: `Validate whether a workspace has been properly initialized by workspace-init-mcp.

Checks for the presence of all expected files (.github/copilot-instructions.md,
.vscode/settings.json, instruction files, docs/ structure) and reports:
- Overall initialization status (initialized or not)
- Completeness percentage (0-100%)
- Per-file status (present/missing) with severity levels
- Dashboard state validity against the stricter JSON shape
- Actionable suggestions for fixing gaps`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory to validate"),
    }),
  },
  async (params) => {
    try {
      const result = validateWorkspace(params.workspacePath);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Validation failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: start_harness_session
// ---------------------------------------------------------------------------

server.registerTool(
  "start_harness_session",
  {
    title: "Start Harness Session",
    description: `Start a real planner / generator / evaluator runtime session inside an initialized workspace.

This tool:
- opens governed runtime state under docs/ai-harness/runtime/
- creates a durable session JSON snapshot and markdown summary
- seeds the first chunk and moves the workflow to plan-1
- synchronizes the administrator dashboard so non-developers can see the active session

Use this before meaningful implementation begins. The session is file-system-based and survives context resets, long-running work, and interrupted sessions.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      goal: z
        .string()
        .describe("Approved goal for the next bounded chunk or governed session"),
      title: z
        .string()
        .optional()
        .describe("Human-readable session title. Defaults to a trimmed goal summary."),
      sessionId: z
        .string()
        .optional()
        .describe("Optional custom session ID. Useful when external governance already assigned one."),
      chunkId: z
        .string()
        .optional()
        .describe("Optional custom chunk ID for the bounded implementation scope."),
      chunkTitle: z
        .string()
        .optional()
        .describe("Human-readable chunk title. Defaults to a trimmed goal summary."),
      adoptionTrack: z
        .enum(["legacy-modernization", "greenfield"])
        .optional()
        .describe('Whether this governed session belongs to a legacy modernization track or a greenfield track. Default: "greenfield".'),
      contextPolicy: z
        .enum(["balanced", "prefer-reset", "prefer-compaction"])
        .optional()
        .describe('Context handling preference for long-running work. Default: "balanced".'),
      force: z
        .boolean()
        .optional()
        .describe("If true, allow replacing the active session pointer when the previous active session is already closed."),
    }),
  },
  async (params) => {
    try {
      const result = startHarnessSession({
        workspacePath: params.workspacePath,
        goal: params.goal,
        title: params.title,
        sessionId: params.sessionId,
        chunkId: params.chunkId,
        chunkTitle: params.chunkTitle,
        adoptionTrack: params.adoptionTrack,
        contextPolicy: params.contextPolicy,
        force: params.force,
      });
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to start harness session: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: advance_harness_session
// ---------------------------------------------------------------------------

server.registerTool(
  "advance_harness_session",
  {
    title: "Advance Harness Session",
    description: `Advance the active planner / generator / evaluator runtime session through the governed state machine.

Use this tool after each meaningful phase step. The action determines how the current phase changes:
- complete: move to the next approved phase
- request_changes: send the work back to the required rework phase
- block: mark the session blocked without changing phase
- resume: clear a blocked session and continue
- context_reset: write a handover for a fresh AI session while keeping the same phase active

Every transition writes durable evidence into the runtime session files and re-syncs the dashboard.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
      action: z
        .enum(HARNESS_RUNTIME_ACTIONS)
        .describe("Transition action to apply to the current active phase"),
      actorRole: z
        .enum(HARNESS_RUNTIME_ACTORS)
        .describe("Role performing this phase transition"),
      note: z
        .string()
        .describe("Durable note describing what changed, what was decided, or why the session is blocked"),
      artifactPaths: z
        .array(z.string())
        .optional()
        .describe("Additional workspace-relative artifact paths that should be linked to this transition"),
      nextStep: z
        .string()
        .optional()
        .describe("Optional explicit next-step instruction to override the default phase guidance"),
    }),
  },
  async (params) => {
    try {
      const result = advanceHarnessSession({
        workspacePath: params.workspacePath,
        sessionId: params.sessionId,
        action: params.action,
        actorRole: params.actorRole,
        note: params.note,
        artifactPaths: params.artifactPaths,
        nextStep: params.nextStep,
      });
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to advance harness session: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_harness_session_status
// ---------------------------------------------------------------------------

server.registerTool(
  "get_harness_session_status",
  {
    title: "Get Harness Session Status",
    description: `Read the current planner / generator / evaluator runtime session and summarize the next actor, current phase, evidence paths, and resumable instruction.

Use this when:
- a fresh AI session needs to resume ongoing work
- an operator wants the latest governed runtime status
- you need the next actor brief before planning, generation, or evaluation continues`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      sessionId: z
        .string()
        .optional()
        .describe("Optional session ID. If omitted, the MCP uses the active runtime session."),
    }),
  },
  async (params) => {
    try {
      const result = getHarnessSessionStatus(params.workspacePath, params.sessionId);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Failed to read harness session status: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: analyze_workspace
// ---------------------------------------------------------------------------

server.registerTool(
  "analyze_workspace",
  {
    title: "Analyze Workspace",
    description: `Analyze an existing workspace directory to detect project type, tech stack,
and structure. Returns suggested configuration for initialize_workspace.

This tool is useful when:
- A user has an existing project and wants to add workspace governance
- You need to auto-fill form fields based on project analysis
- The user chose "quick-start" and you need to detect optimal settings

The analysis checks for: package.json, tsconfig.json, pyproject.toml, Docker,
Kubernetes, monorepo markers, and many other project indicators.

Use this before initializing a legacy project so the generated harness, dashboard,
and governance layers can be applied without replacing the existing architecture.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace directory to analyze"),
    }),
  },
  async (params) => {
    try {
      const result = analyzeWorkspace(params.workspacePath);
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Analysis failed: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: recommend_agent_skills
// ---------------------------------------------------------------------------

server.registerTool(
  "recommend_agent_skills",
  {
    title: "Recommend Agent Skills",
    description: `Recommend AI agent skills and agents based on project type, tech stack, and user intent.

Returns a scored list of recommended:
- **Skills** (.github/skills/): Portable, reusable AI capabilities (SKILL.md format)
- **Agents** (.github/agents/): Specialized agent configurations (.agent.md format)

The recommendation engine scores each entry based on:
- Project type relevance
- Tech stack keyword matching
- User intent/tag matching
- Priority level (core, recommended, specialized)

Use this tool to help users discover and select appropriate agent skills
before installing them with install_agent_skills.

Follows the open Agent Skills standard: https://agentskills.io`,
    inputSchema: z.object({
      projectType: z
        .enum(PROJECT_TYPES)
        .optional()
        .describe("Project type for relevance filtering"),
      techStack: z
        .array(z.string())
        .optional()
        .describe("Tech stack keywords for matching"),
      userIntent: z
        .string()
        .optional()
        .describe(
          "Free-text intent for tuning (e.g., 'testing devops automation ci/cd')"
        ),
      maxAgents: z.number().optional().describe("Max agents to return (default: 10)"),
      maxSkills: z.number().optional().describe("Max skills to return (default: 15)"),
    }),
  },
  async (params) => {
    const result = recommendAgentSkills({
      projectType: params.projectType,
      techStack: params.techStack,
      userIntent: params.userIntent,
      maxAgents: params.maxAgents,
      maxSkills: params.maxSkills,
    });
    return { content: [{ type: "text" as const, text: result.summary }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: search_agent_skills
// ---------------------------------------------------------------------------

server.registerTool(
  "search_agent_skills",
  {
    title: "Search Agent Skills",
    description: `Search the agent skills catalog by free-text query.

Searches across names, descriptions, tags, and categories of all registered
agents and skills. Use this when you need to find specific capabilities.`,
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Search query (e.g., 'testing', 'docker', 'react', 'security')"
        ),
    }),
  },
  async (params) => {
    const result = searchAgentSkills(params.query);
    return { content: [{ type: "text" as const, text: result.summary }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: install_agent_skills
// ---------------------------------------------------------------------------

server.registerTool(
  "install_agent_skills",
  {
    title: "Install Agent Skills",
    description: `Install selected agent skills and agents into a workspace.

Creates a canonical .github/skills/<id>/SKILL.md registry and .github/agents/<id>.agent.md
registry for the specified skill and agent IDs. When targetIDEs are provided or
detected from the workspace, the MCP also mirrors those files into the matching
IDE-specific directories and refreshes the canonical catalog indexes.

Use recommend_agent_skills or search_agent_skills first to discover available
skills and agents, then pass the selected IDs to this tool.`,
    inputSchema: z.object({
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      skillIds: z
        .array(z.string())
        .optional()
        .describe(
          "Skill IDs to install (e.g., ['conventional-commit', 'create-specification'])"
        ),
      agentIds: z
        .array(z.string())
        .optional()
        .describe(
          "Agent IDs to install (e.g., ['plan', 'principal-software-engineer'])"
        ),
      targetIDEs: z
        .array(z.enum(TARGET_IDE_VALUES))
        .optional()
        .describe(
          'Target IDE mirrors to generate (e.g., ["cursor", "claude-code"]). If omitted, the MCP reuses the workspace machine index or existing skill directories.'
        ),
      force: z
        .boolean()
        .optional()
        .describe("If true, overwrite existing files. Default: false"),
    }),
  },
  async (params) => {
    try {
      const skillEntries = (params.skillIds ?? [])
        .map((id) => SKILL_REGISTRY.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => s != null);

      const agentEntries = (params.agentIds ?? [])
        .map((id) => AGENT_REGISTRY.find((a) => a.id === id))
        .filter((a): a is NonNullable<typeof a> => a != null);

      if (skillEntries.length === 0 && agentEntries.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No recognized skill or agent IDs were provided. Use recommend_agent_skills or search_agent_skills first to confirm valid IDs.",
            },
          ],
        };
      }

      const unknownSkills = (params.skillIds ?? []).filter(
        (id) => !SKILL_REGISTRY.some((s) => s.id === id)
      );
      const unknownAgents = (params.agentIds ?? []).filter(
        (id) => !AGENT_REGISTRY.some((a) => a.id === id)
      );
      const targetIDEs = resolveWorkspaceTargetIDEs(
        params.workspacePath,
        params.targetIDEs as WorkspaceInitParams["targetIDEs"]
      );

      const files = generateSelectedSkills(skillEntries, agentEntries, {
        workspaceName: path.basename(params.workspacePath),
        workspacePath: params.workspacePath,
        purpose: "Selected agent skill installation",
        targetIDEs,
      });
      const force = params.force ?? false;
      const written: string[] = [];
      const skipped: string[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const fullPath = path.join(params.workspacePath, file.relativePath);
        try {
          const dir = path.dirname(fullPath);
          fs.mkdirSync(dir, { recursive: true });

          if (!force && fs.existsSync(fullPath)) {
            skipped.push(file.relativePath);
            continue;
          }

          fs.writeFileSync(fullPath, file.content, "utf-8");
          written.push(file.relativePath);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${file.relativePath}: ${msg}`);
        }
      }

      const writtenList = written.length > 0 ? written.map((entry) => `  - ${entry}`).join("\n") : "  - none";
      let text = "Agent Skills installation complete.\n\n";
      text += `Target IDE mirrors: ${targetIDEs.join(", ")}\n`;
      text += "Canonical registry: .github/skills/ and .github/agents/\n\n";
      text += `Written files (${written.length}):\n${writtenList}\n`;

      if (skipped.length > 0) {
        text += `\nSkipped existing files (${skipped.length}):\n${skipped.map((entry) => `  - ${entry}`).join("\n")}`;
        text += "\n  Re-run with force: true to overwrite them.\n";
      }
      if (unknownSkills.length > 0) {
        text += `\nUnknown skill IDs: ${unknownSkills.join(", ")}`;
      }
      if (unknownAgents.length > 0) {
        text += `\nUnknown agent IDs: ${unknownAgents.join(", ")}`;
      }
      if (errors.length > 0) {
        text += `\n\nErrors:\n${errors.map((entry) => `  - ${entry}`).join("\n")}`;
      }

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text" as const, text: `Installation failed: ${msg}` },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: list_agent_skills_catalog
// ---------------------------------------------------------------------------

server.registerTool(
  "list_agent_skills_catalog",
  {
    title: "List Agent Skills Catalog",
    description: `List the full catalog of available agent skills and agents.

Returns categorized lists of all registered skills and agents with their IDs,
names, descriptions, and categories. Use this for browsing the full catalog.`,
    inputSchema: z.object({
      filter: z
        .enum(["all", "agents", "skills"])
        .optional()
        .describe("Filter: 'all' (default), 'agents', or 'skills'"),
    }),
  },
  async (params) => {
    const filter = params.filter ?? "all";
    const cats = listCategories();
    const indexes = buildCatalogIndexes();
    const parts: string[] = [];

    parts.push("# Agent Skills Catalog");
    parts.push("");
    parts.push("## Indexed Views");
    parts.push(
      `- Roles: ${indexes.roles.map((role) => `${role.label} (${role.agents.length + role.skills.length})`).join(", ")}`
    );
    parts.push(
      `- Domains: ${indexes.domains.map((domain) => `${domain.label} (${domain.agents.length + domain.skills.length})`).join(", ")}`
    );
    parts.push("");

    if (filter !== "skills") {
      parts.push(`## Agents (${AGENT_REGISTRY.length})`);
      parts.push(`Categories: ${cats.agentCategories.join(", ")}`);
      for (const agent of AGENT_REGISTRY) {
        parts.push(
          `- **${agent.name}** (\`${agent.id}\`) [${agent.categories.join(", ")}] - ${agent.description}`
        );
      }
      parts.push("");
    }

    if (filter !== "agents") {
      parts.push(`## Skills (${SKILL_REGISTRY.length})`);
      parts.push(`Categories: ${cats.skillCategories.join(", ")}`);
      for (const skill of SKILL_REGISTRY) {
        parts.push(
          `- **${skill.name}** (\`${skill.id}\`) [${skill.categories.join(", ")}] - ${skill.description}`
        );
      }
    }

    return { content: [{ type: "text" as const, text: parts.join("\n") }] };
  }
);

// ---------------------------------------------------------------------------
// Prompts: User-facing forms for MCP clients
// ---------------------------------------------------------------------------

server.registerPrompt(
  "workspace-init",
  {
    title: "Initialize Workspace",
    description:
      "Collect the full set of inputs required to initialize a workspace with documentation, governance, and Agent Skills.",
    argsSchema: {
      workspaceName: z
        .string()
        .describe("Workspace name used in headings, filenames, and generated summaries"),
      purpose: z
        .string()
        .describe("Primary project goal and delivery objective"),
      workspacePath: z
        .string()
        .describe("Absolute path to the workspace root directory"),
      projectType: z
        .string()
        .optional()
        .describe("Project type: learning, web-app, api, mobile, data-science, devops, creative, library, monorepo, consulting, ecommerce, fintech, healthcare, saas, iot, other"),
      techStack: z
        .string()
        .optional()
        .describe('Technology stack as a comma-separated list, for example "TypeScript, React, Node.js"'),
      docLanguage: z
        .string()
        .optional()
        .describe('Documentation language (default: "Korean")'),
      codeCommentLanguage: z
        .string()
        .optional()
        .describe('Code comment language (default: "English")'),
      isMultiRepo: z
        .string()
        .optional()
        .describe('Whether the workspace manages multiple repositories ("true" or "false", default: false)'),
      additionalContext: z
        .string()
        .optional()
        .describe("Additional constraints, policies, or project-specific context"),
      plannedTasks: z
        .string()
        .optional()
        .describe('Planned workflows as a comma-separated list, for example "Auth implementation, API design"'),
    },
  },
  (args) => {
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined) filtered[k] = v;
    }
    return buildWorkspaceInitMessages(filtered);
  }
);

server.registerPrompt(
  "workspace-quick-start",
  {
    title: "Quick Workspace Init",
    description:
      "Initialize a workspace from the minimum required inputs and let the MCP infer the rest when possible.",
    argsSchema: {
      workspaceName: z.string().describe("Workspace name"),
      purpose: z.string().describe("Project purpose or short objective"),
      workspacePath: z.string().describe("Absolute workspace path"),
    },
  },
  (args) => buildQuickStartMessages(args)
);

server.registerPrompt(
  "workspace-analyze",
  {
    title: "Analyze Workspace",
    description:
      "Analyze an existing workspace to infer project type, tech stack, and initialization status.",
    argsSchema: {
      workspacePath: z.string().describe("Absolute path to the workspace being analyzed"),
    },
  },
  (args) => buildAnalyzeMessages(args)
);

// ---------------------------------------------------------------------------
// Resources: Project type configurations
// ---------------------------------------------------------------------------

server.registerResource(
  "project-types-overview",
  "workspace-init://project-types",
  {
    title: "Project Type Guide",
    description: "Overview of supported project types and their default configuration",
    mimeType: "text/markdown",
  },
  async (uri) => {
    const overview = Object.entries(PROJECT_TYPE_CONFIGS)
      .map(
        ([key, config]) =>
          `## ${config.label} (\`${key}\`)\n\n${config.description}\n\n` +
          `- Default tech stack: ${config.defaultTechStack.length ? config.defaultTechStack.join(", ") : "none"}\n` +
          `- Documentation sections: ${config.docSections.length ? config.docSections.join(", ") : "none"}\n` +
          `- Extra guidance:\n${config.extraInstructions.map((instruction) => `  - ${instruction}`).join("\n")}`
      )
      .join("\n\n---\n\n");

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# Project Type Guide\n\n${overview}`,
        },
      ],
    };
  }
);

server.registerResource(
  "project-type-detail",
  new ResourceTemplate("workspace-init://project-types/{type}", {
    list: async () => ({
      resources: Object.entries(PROJECT_TYPE_CONFIGS).map(([key, config]) => ({
        uri: `workspace-init://project-types/${key}`,
        name: config.label,
        description: config.description,
        mimeType: "application/json" as const,
      })),
    }),
  }),
  {
    title: "Project Type Detail",
    description: "Detailed configuration data for a specific project type",
    mimeType: "application/json",
  },
  async (uri, params) => {
    const typeName = params.type as string;
    const config =
      PROJECT_TYPE_CONFIGS[typeName as keyof typeof PROJECT_TYPE_CONFIGS];

    if (!config) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain" as const,
            text: `Project type "${typeName}" was not found. Supported types: ${Object.keys(PROJECT_TYPE_CONFIGS).join(", ")}`,
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json" as const,
          text: JSON.stringify({ type: typeName, ...config }, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Resources: Agent Skills catalog
// ---------------------------------------------------------------------------

server.registerResource(
  "agent-skills-catalog",
  "workspace-init://agent-skills",
  {
    title: "Agent Skills Catalog",
    description:
      "Catalog of all registered Agent Skills and agents, including role and domain indexes.",
    mimeType: "application/json",
  },
  async (uri) => {
    const indexes = buildCatalogIndexes();
    const catalog = {
      standard: "https://agentskills.io",
      indexes: {
        roles: indexes.roles.map((role) => ({
          id: role.id,
          label: role.label,
          description: role.description,
          agentIds: role.agents.map((agent) => agent.id),
          skillIds: role.skills.map((skill) => skill.id),
        })),
        domains: indexes.domains.map((domain) => ({
          id: domain.id,
          label: domain.label,
          description: domain.description,
          agentIds: domain.agents.map((agent) => agent.id),
          skillIds: domain.skills.map((skill) => skill.id),
        })),
      },
      agents: AGENT_REGISTRY.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        categories: a.categories,
        tags: a.tags,
        relevantProjectTypes: a.relevantProjectTypes,
        priority: a.priority,
      })),
      skills: SKILL_REGISTRY.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        categories: s.categories,
        tags: s.tags,
        relevantProjectTypes: s.relevantProjectTypes,
        hasResources: s.hasResources,
        priority: s.priority,
      })),
    };

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json" as const,
          text: JSON.stringify(catalog, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("workspace-init-mcp server v4.0.1 started on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
