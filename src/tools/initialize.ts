/**
 * MCP Tool: initialize_workspace
 *
 * Orchestrates all generators to produce the complete set of files
 * for workspace initialization.
 */

import { type WorkspaceInitParams, type GeneratedFile, type InitResult } from "../types.js";
import {
  generateCopilotInstructions,
  generateSettings,
  generateCodeGenInstructions,
  generateTestInstructions,
  generateReviewInstructions,
  generateCommitInstructions,
  generatePRInstructions,
  generateDocsStructure,
  generateInitialChangelog,
  generateSetupWorkLog,
  generateAgentSkills,
} from "../generators/index.js";

/**
 * Collect all files to be generated for the workspace.
 * Does NOT write to disk — returns a list of GeneratedFile objects.
 */
export function collectFiles(params: WorkspaceInitParams): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // 1. Copilot global instructions
  files.push(generateCopilotInstructions(params));

  // 2. VS Code settings & custom instruction files
  files.push(generateSettings(params));
  files.push(generateCodeGenInstructions(params));
  files.push(generateTestInstructions());
  files.push(generateReviewInstructions());
  files.push(generateCommitInstructions());
  files.push(generatePRInstructions());

  // 3. Documentation governance structure
  files.push(...generateDocsStructure(params));

  // 4. Agent Skills (.github/skills/ and .github/agents/)
  if (params.includeAgentSkills !== false) {
    files.push(
      ...generateAgentSkills(params, {
        userIntent: params.agentSkillsIntent,
      })
    );
  }

  // 5. Initial changelog & work log (needs the file list from above)
  const relativePaths = files.map((f) => f.relativePath);
  files.push(generateInitialChangelog(params, relativePaths));
  files.push(generateSetupWorkLog(params, [...relativePaths, "docs/changelog/...", "docs/work-logs/..."]));

  return files;
}

/**
 * Build a human-readable summary of the initialization result.
 */
export function buildSummary(
  params: WorkspaceInitParams,
  files: GeneratedFile[]
): InitResult {
  const relativePaths = files.map((f) => f.relativePath);

  const summary = `
✅ 워크스페이스 초기화 완료: ${params.workspaceName}

📁 생성된 파일 (${files.length}개):
${relativePaths.map((p) => `  - ${p}`).join("\n")}

📋 설정 요약:
  - 목적: ${params.purpose}
  - 프로젝트 유형: ${params.projectType ?? "other"}
  - 기술 스택: ${params.techStack?.join(", ") || "미지정"}
  - Multi-Repo: ${params.isMultiRepo ? "예" : "아니오"}
  - 문서 언어: ${params.docLanguage ?? "한국어"}
  - 코드 주석 언어: ${params.codeCommentLanguage ?? "English"}

🚀 다음 단계:
  1. 생성된 .github/copilot-instructions.md 를 검토하고 필요에 맞게 조정하세요.
  2. 프로젝트별 .instructions.md 파일을 추가하여 세부 지침을 구성하세요.
  3. 작업을 시작하면 docs/work-logs/ 에 자동으로 기록됩니다.
`.trim();

  return {
    filesCreated: files.length,
    generatedFiles: relativePaths,
    summary,
  };
}
