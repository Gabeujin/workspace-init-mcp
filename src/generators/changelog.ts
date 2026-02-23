/**
 * Generator for initial changelog entry.
 */

import { type WorkspaceInitParams, type GeneratedFile } from "../types.js";

/** Generate the initial changelog file for the workspace */
export function generateInitialChangelog(
  params: WorkspaceInitParams,
  generatedFiles: string[]
): GeneratedFile {
  const today = new Date().toISOString().split("T")[0];

  const fileList = generatedFiles.map((f) => `- \`${f}\``).join("\n");

  const content = `# Changelog: ${params.workspaceName}

## [${today}]

### Added
${fileList}
`;

  return {
    relativePath: `docs/changelog/${slugify(params.workspaceName)}.md`,
    content,
  };
}

/** Generate the initial work log for workspace setup */
export function generateSetupWorkLog(
  params: WorkspaceInitParams,
  generatedFiles: string[]
): GeneratedFile {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const fileTable = generatedFiles
    .map((f) => `| \`${f}\` | ✅ 신규 |`)
    .join("\n");

  const content = `# 작업 로그: ${params.workspaceName} 워크스페이스 초기 설정

- **일시**: ${today} ${now}
- **프로젝트**: ${params.workspaceName}
- **유형**: 신규 개발

## 요청 프롬프트
> workspace-init-mcp 를 통한 워크스페이스 자동 초기화

## 계획
- [x] 워크스페이스 거버넌스 구조 생성
- [x] Copilot 공통 지침 및 커스텀 지침 파일 생성
- [x] 문서 디렉토리 구조 생성
- [x] 초기 변경 이력 및 작업 로그 생성

## 결과

### 생성된 파일 목록
| 파일 | 상태 |
|---|---|
${fileTable}

### 워크스페이스 설정 정보
- **목적**: ${params.purpose}
- **프로젝트 유형**: ${params.projectType ?? "other"}
- **기술 스택**: ${params.techStack?.join(", ") || "미지정"}
- **Multi-Repo**: ${params.isMultiRepo ? "예" : "아니오"}
- **문서 언어**: ${params.docLanguage ?? "한국어"}
- **코드 주석 언어**: ${params.codeCommentLanguage ?? "English"}
`;

  return {
    relativePath: `docs/work-logs/${today}-워크스페이스-초기-설정.md`,
    content,
  };
}

/** Convert a name to a URL/file-safe slug */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}
