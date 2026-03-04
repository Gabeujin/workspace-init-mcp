#!/usr/bin/env node

/**
 * workspace-init-mcp — MCP Server v3.0.0
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
import { buildInitFormSchema } from "./tools/form-schema.js";
import { validateWorkspace } from "./tools/validate.js";
import { analyzeWorkspace } from "./tools/status.js";
import {
  buildWorkspaceInitMessages,
  buildQuickStartMessages,
  buildAnalyzeMessages,
} from "./prompts/index.js";
import {
  recommendAgentSkills,
  searchAgentSkills,
  listCategories,
  AGENT_REGISTRY,
  SKILL_REGISTRY,
} from "./data/agent-skills-registry.js";
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
    .describe('Language for documentation (default: "한국어")'),
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
    .array(z.enum(["vscode", "cursor", "claude-code", "openhands"]))
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
  version: "3.1.0",
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
- .github/skills/ (Agent Skills — SKILL.md files per the agentskills.io standard)
- .github/agents/ (Agent definitions — .agent.md files)
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
      envInfo.push(`📁 File encoding: ${encoding}`);
      const ides = params.targetIDEs ?? ["vscode"];
      envInfo.push(`🎯 Target IDEs: ${ides.join(", ")}`);
      envInfo.push(`↵ Line endings: ${params.lineEnding ?? "lf"}`);
      text += `\n\n${envInfo.join("\n")}`;

      if (skipped.length > 0) {
        const skippedList = skipped.map((s) => `  - ${s}`).join("\n");
        text += `\n\n⏭️ 이미 존재하여 건너뛴 파일 (${skipped.length}개):\n${skippedList}`;
        text += `\n  → 덮어쓰려면 force: true 로 다시 실행하세요.`;
      }
      if (errors.length > 0) {
        text += `\n\n⚠️ 일부 파일 생성 실패:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
      }

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `❌ 초기화 실패: ${msg}` }],
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
        fileEncoding: params.fileEncoding as WorkspaceInitParams["fileEncoding"],
        targetIDEs: params.targetIDEs as WorkspaceInitParams["targetIDEs"],
        lineEnding: params.lineEnding as WorkspaceInitParams["lineEnding"],
      };

      const files = collectFiles(initParams);

      const preview = files
        .map(
          (f) =>
            `📄 ${f.relativePath}\n${"─".repeat(60)}\n${f.content.slice(0, 500)}${f.content.length > 500 ? "\n... (truncated)" : ""}\n`
        )
        .join("\n");

      const text = `🔍 워크스페이스 초기화 미리보기: ${params.workspaceName}\n\n총 ${files.length}개 파일이 생성됩니다.\n\n${preview}`;

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `❌ 미리보기 실패: ${msg}` }],
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
        `- **${key}** (${config.label}): ${config.description}\n  기본 기술 스택: ${config.defaultTechStack.length ? config.defaultTechStack.join(", ") : "없음"}\n  추가 문서 섹션: ${config.docSections.length ? config.docSections.join(", ") : "없음"}`
    );

    const text = `📋 사용 가능한 프로젝트 유형:\n\n${lines.join("\n\n")}`;
    return { content: [{ type: "text" as const, text }] };
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
        content: [{ type: "text" as const, text: `❌ 검증 실패: ${msg}` }],
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
Kubernetes, monorepo markers, and many other project indicators.`,
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
        content: [{ type: "text" as const, text: `❌ 분석 실패: ${msg}` }],
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
- Priority level (core → recommended → specialized)

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

Creates .github/skills/<id>/SKILL.md files and .github/agents/<id>.agent.md files
for the specified skill and agent IDs. Files follow the open Agent Skills standard.

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
              text: "⚠️ 유효한 스킬/에이전트 ID가 없습니다. recommend_agent_skills 또는 search_agent_skills 로 사용 가능한 ID를 확인하세요.",
            },
          ],
        };
      }

      // Find unrecognized IDs
      const unknownSkills = (params.skillIds ?? []).filter(
        (id) => !SKILL_REGISTRY.some((s) => s.id === id)
      );
      const unknownAgents = (params.agentIds ?? []).filter(
        (id) => !AGENT_REGISTRY.some((a) => a.id === id)
      );

      const files = generateSelectedSkills(skillEntries, agentEntries);
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

      let text = `✅ Agent Skills 설치 완료\n\n`;
      text += `📁 생성된 파일 (${written.length}개):\n${written.map((w) => `  - ${w}`).join("\n")}\n`;

      if (skipped.length > 0) {
        text += `\n⏭️ 이미 존재하여 건너뛴 파일 (${skipped.length}개):\n${skipped.map((s) => `  - ${s}`).join("\n")}`;
        text += `\n  → 덮어쓰려면 force: true 로 다시 실행하세요.\n`;
      }
      if (unknownSkills.length > 0) {
        text += `\n⚠️ 알 수 없는 스킬 ID: ${unknownSkills.join(", ")}`;
      }
      if (unknownAgents.length > 0) {
        text += `\n⚠️ 알 수 없는 에이전트 ID: ${unknownAgents.join(", ")}`;
      }
      if (errors.length > 0) {
        text += `\n\n❌ 오류:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
      }

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text" as const, text: `❌ 설치 실패: ${msg}` },
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
    const parts: string[] = [];

    parts.push(`📚 Agent Skills 카탈로그\n`);

    if (filter !== "skills") {
      parts.push(`## 에이전트 (${AGENT_REGISTRY.length}개)\n`);
      parts.push(`카테고리: ${cats.agentCategories.join(", ")}\n`);
      for (const agent of AGENT_REGISTRY) {
        parts.push(
          `- **${agent.name}** (\`${agent.id}\`) [${agent.categories.join(", ")}] — ${agent.description}`
        );
      }
      parts.push("");
    }

    if (filter !== "agents") {
      parts.push(`## 스킬 (${SKILL_REGISTRY.length}개)\n`);
      parts.push(`카테고리: ${cats.skillCategories.join(", ")}\n`);
      for (const skill of SKILL_REGISTRY) {
        parts.push(
          `- **${skill.name}** (\`${skill.id}\`) [${skill.categories.join(", ")}] — ${skill.description}`
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
    title: "워크스페이스 초기화",
    description:
      "워크스페이스 초기화를 위한 전체 설정 폼입니다. 필수/선택 입력값을 안내받고 맞춤형 워크스페이스를 생성합니다.",
    argsSchema: {
      workspaceName: z
        .string()
        .describe("워크스페이스 이름 (프로젝트 식별용, 파일명/제목에 사용)"),
      purpose: z
        .string()
        .describe("프로젝트의 주요 목적과 목표를 구체적으로 작성해 주세요"),
      workspacePath: z
        .string()
        .describe("워크스페이스 루트 디렉토리의 절대 경로"),
      projectType: z
        .string()
        .optional()
        .describe("프로젝트 유형: learning, web-app, api, mobile, data-science, devops, creative, library, monorepo, consulting, ecommerce, fintech, healthcare, saas, iot, other"),
      techStack: z
        .string()
        .optional()
        .describe('기술 스택 (쉼표로 구분, 예: "TypeScript, React, Node.js")'),
      docLanguage: z
        .string()
        .optional()
        .describe('문서 작성 언어 (기본: "한국어")'),
      codeCommentLanguage: z
        .string()
        .optional()
        .describe('코드 주석 언어 (기본: "English")'),
      isMultiRepo: z
        .string()
        .optional()
        .describe('멀티 레포지토리 여부 ("true" 또는 "false", 기본: false)'),
      additionalContext: z
        .string()
        .optional()
        .describe("추가 컨텍스트 (팀 규칙, 특수 요구사항 등)"),
      plannedTasks: z
        .string()
        .optional()
        .describe('예정된 주요 작업 (쉼표로 구분, 예: "인증 구현, API 설계")'),
    },
  },
  (args) => {
    // Filter out undefined values to match Record<string, string>
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
    title: "빠른 워크스페이스 초기화",
    description:
      "최소 필수 정보만으로 빠르게 워크스페이스를 초기화합니다. 선택 항목은 자동 감지됩니다.",
    argsSchema: {
      workspaceName: z.string().describe("워크스페이스 이름"),
      purpose: z.string().describe("프로젝트 목적 (한 줄 요약도 OK)"),
      workspacePath: z.string().describe("워크스페이스 경로 (절대 경로)"),
    },
  },
  (args) => buildQuickStartMessages(args)
);

server.registerPrompt(
  "workspace-analyze",
  {
    title: "워크스페이스 분석",
    description:
      "기존 프로젝트 디렉토리를 분석하여 프로젝트 유형, 기술 스택, 초기화 상태를 파악합니다.",
    argsSchema: {
      workspacePath: z.string().describe("분석할 워크스페이스 경로 (절대 경로)"),
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
    title: "프로젝트 유형 가이드",
    description: "사용 가능한 모든 프로젝트 유형과 설정 정보",
    mimeType: "text/markdown",
  },
  async (uri) => {
    const overview = Object.entries(PROJECT_TYPE_CONFIGS)
      .map(
        ([key, config]) =>
          `## ${config.label} (\`${key}\`)\n\n${config.description}\n\n` +
          `- 기본 기술 스택: ${config.defaultTechStack.length ? config.defaultTechStack.join(", ") : "없음"}\n` +
          `- 문서 섹션: ${config.docSections.length ? config.docSections.join(", ") : "없음"}\n` +
          `- 특화 지침:\n${config.extraInstructions.map((i) => `  - ${i}`).join("\n")}`
      )
      .join("\n\n---\n\n");

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# 프로젝트 유형 가이드\n\n${overview}`,
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
    title: "프로젝트 유형 상세",
    description: "특정 프로젝트 유형의 상세 설정 정보",
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
            text: `프로젝트 유형 "${typeName}"을 찾을 수 없습니다. 사용 가능: ${Object.keys(PROJECT_TYPE_CONFIGS).join(", ")}`,
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
    title: "Agent Skills 카탈로그",
    description:
      "사용 가능한 모든 Agent Skills 및 에이전트 목록 (agentskills.io 표준 기반)",
    mimeType: "application/json",
  },
  async (uri) => {
    const catalog = {
      standard: "https://agentskills.io",
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
  console.error("workspace-init-mcp server v3.1.0 started on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
