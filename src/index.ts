#!/usr/bin/env node

/**
 * workspace-init-mcp — MCP Server
 *
 * An MCP server that initializes VS Code workspaces with
 * documentation governance, Copilot instructions, and project structure.
 *
 * Transport: stdio
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

import { type WorkspaceInitParams } from "./types.js";
import { collectFiles, buildSummary } from "./tools/initialize.js";

// ---------------------------------------------------------------------------
// Schema definitions (Zod — used by McpServer.tool())
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
  "other",
] as const;

const BaseWorkspaceSchema = {
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
      "Type of project: learning, web-app, api, mobile, data-science, devops, creative, library, monorepo, other"
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
};

const InitializeWorkspaceSchema = {
  ...BaseWorkspaceSchema,
  force: z
    .boolean()
    .optional()
    .describe(
      "If true, overwrite existing files. If false (default), skip files that already exist."
    ),
};

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "workspace-init-mcp",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tool: initialize_workspace
// ---------------------------------------------------------------------------

server.tool(
  "initialize_workspace",
  `Initialize a VS Code workspace with documentation governance, Copilot instructions, and project structure.

This tool creates a complete workspace setup including:
- .github/copilot-instructions.md (global Copilot instructions)
- .vscode/settings.json (Copilot custom instruction references)
- .vscode/*.instructions.md (code generation, test, review, commit, PR instructions)
- docs/ (work-logs, troubleshooting, changelog, adr, and project-type-specific directories)
- Initial changelog and work log entries

Required inputs: workspaceName, purpose, workspacePath
Optional inputs: projectType, techStack, docLanguage, codeCommentLanguage, isMultiRepo, additionalContext, plannedTasks`,
  InitializeWorkspaceSchema,
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
      };

      // Generate all files
      const files = collectFiles(initParams);

      // Write files to disk
      const force = params.force ?? false;
      const written: string[] = [];
      const skipped: string[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const fullPath = path.join(params.workspacePath, file.relativePath);
        try {
          const dir = path.dirname(fullPath);
          fs.mkdirSync(dir, { recursive: true });

          // Overwrite protection: skip existing files unless force=true
          if (!force && fs.existsSync(fullPath)) {
            skipped.push(file.relativePath);
            continue;
          }

          fs.writeFileSync(fullPath, file.content, "utf-8");
          written.push(file.relativePath);
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : String(err);
          errors.push(`${file.relativePath}: ${msg}`);
        }
      }

      // Build result summary
      const result = buildSummary(initParams, files);

      let text = result.summary;
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
        content: [
          { type: "text" as const, text: `❌ 초기화 실패: ${msg}` },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: preview_workspace_init
// ---------------------------------------------------------------------------

server.tool(
  "preview_workspace_init",
  `Preview the files that would be generated by initialize_workspace without actually creating them.
Useful for reviewing the planned structure before committing to it.`,
  BaseWorkspaceSchema,
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
        content: [
          { type: "text" as const, text: `❌ 미리보기 실패: ${msg}` },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: list_project_types
// ---------------------------------------------------------------------------

server.tool(
  "list_project_types",
  "List all available project types and their descriptions. Useful when the user is unsure which project type to choose.",
  {},
  async () => {
    const { PROJECT_TYPE_CONFIGS } = await import("./types.js");

    const lines = Object.entries(PROJECT_TYPE_CONFIGS).map(
      ([key, config]) =>
        `- **${key}** (${config.label}): ${config.description}\n  기본 기술 스택: ${config.defaultTechStack.length ? config.defaultTechStack.join(", ") : "없음"}\n  추가 문서 섹션: ${config.docSections.length ? config.docSections.join(", ") : "없음"}`
    );

    const text = `📋 사용 가능한 프로젝트 유형:\n\n${lines.join("\n\n")}`;
    return { content: [{ type: "text" as const, text }] };
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("workspace-init-mcp server started on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
