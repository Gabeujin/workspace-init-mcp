/**
 * Generator for .github/copilot-instructions.md
 * Creates workspace-wide Copilot instructions tailored to the project purpose.
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
  const docLang = params.docLanguage ?? "한국어";
  const codeLang = params.codeCommentLanguage ?? "English";
  const isMulti = params.isMultiRepo ?? false;

  const techStackSection = params.techStack?.length
    ? `- **기술 스택**: ${params.techStack.join(", ")}`
    : "";

  const extraInstructionLines = config.extraInstructions
    .map((line) => `- ${line}`)
    .join("\n");

  const multiRepoSection = isMulti
    ? `
---

## 3. Multi-Repository Orchestration

### 3.1 프로젝트 독립성

- 각 프로젝트는 **독립된 개발환경** (언어, 프레임워크, 의존성)을 가집니다.
- 프로젝트 간 의존성이 있는 경우, 반드시 문서에 명시합니다.

### 3.2 변경 추적

- 모든 프로젝트의 **신규 개발, 변경, 수정, 삭제** 내역은 즉시 문서에 반영합니다.
- 변경 이력은 \`docs/changelog/\` 하위에 프로젝트별로 관리합니다.
- 크로스 프로젝트 영향이 있는 변경은 별도 표시합니다.
`
    : "";

  const plannedTasksSection = params.plannedTasks?.length
    ? `
### 예정된 주요 작업
${params.plannedTasks.map((t) => `- ${t}`).join("\n")}
`
    : "";

  const additionalContextSection = params.additionalContext
    ? `
### 추가 컨텍스트
${params.additionalContext}
`
    : "";

  const content = `# Copilot 공통 지침 (Global Instructions)

> 이 파일은 워크스페이스 전체에 자동 적용되는 공통 지침입니다.
> 모든 채팅 요청에 자동으로 포함됩니다.

---

## 1. 워크스페이스 개요

이 워크스페이스는 **${params.workspaceName}** 프로젝트입니다.

- **목적**: ${params.purpose}
- **유형**: ${config.label} — ${config.description}
${techStackSection ? techStackSection + "\n" : ""}- **구조**: ${isMulti ? "Multi-Repository / Multi-Project 워크스페이스" : "단일 프로젝트 워크스페이스"}
${plannedTasksSection}${additionalContextSection}
---

## 2. 핵심 원칙

### 2.1 문서 거버넌스 (Documentation Governance)

모든 작업은 반드시 문서로 기록되어야 합니다. 문서는 에이전트 세션의 **장기 기억**, **패턴 인식**, **Orchestration** 을 위한 핵심 자산입니다.

| 문서 유형 | 위치 | 자동 생성 | 설명 |
|---|---|---|---|
| 작업 로그 (Work Log) | \`docs/work-logs/\` | ✅ | 작업 요청 프롬프트, 진행 과정, 결과를 기록 |
| 트러블슈팅 (Troubleshooting) | \`docs/troubleshooting/\` | ✅ | 버그·이슈 발생 → 원인 분석 → 해결까지 전 과정 기록 |
| 변경 이력 (Changelog) | \`docs/changelog/\` | ✅ | ${isMulti ? "프로젝트별 " : ""}신규·변경·수정·삭제 내역 즉시 반영 |
| 아키텍처 결정 (ADR) | \`docs/adr/\` | 📝 | 주요 기술 결정 사항과 근거 기록 |

### 2.2 계획 우선 (Plan First)

모든 작업은 다음 순서를 따릅니다:

1. **계획 (Plan)**: 요구사항 분석, 기술 검토, 접근 방식 결정
2. **문서화 (Document)**: 작업 로그에 계획 기록
3. **구현 (Implement)**: 코드 작성 및 테스트
4. **검토 (Review)**: 코드 품질, 문서 정합성 확인
5. **기록 (Record)**: 결과 및 변경 이력 업데이트

### 2.3 근거 기반 개발 (Evidence-Based Development)

- **Context7 MCP** 를 적극 활용하여 최신 공식 문서 기반으로 개발합니다.
- 라이브러리·프레임워크 사용 시 반드시 최신 API 문서를 확인합니다.
- 불확실한 정보가 아닌 **검증된 근거** 에 기반하여 코드를 작성합니다.
${
  config.extraInstructions.length
    ? `
### 2.4 프로젝트 특화 원칙

${extraInstructionLines}
`
    : ""
}${multiRepoSection}
---

## ${isMulti ? "4" : "3"}. 작업 폴더 구조

\`\`\`
${params.workspaceName}/
├── .github/
│   └── copilot-instructions.md   # 이 파일 (공통 지침)
├── .vscode/
│   ├── settings.json             # Copilot 커스텀 지침 설정
│   └── *.instructions.md         # 특정 작업용 커스텀 지침 파일
├── docs/
│   ├── work-logs/                # 작업 로그
│   ├── troubleshooting/          # 트러블슈팅 기록
│   ├── changelog/                # 변경 이력
│   └── adr/                      # 아키텍처 결정 기록
${isMulti ? "├── <project-a>/                  # 개별 프로젝트\n├── <project-b>/                  # 개별 프로젝트\n" : "├── src/                          # 소스 코드\n"}└── ${params.workspaceName}.code-workspace
\`\`\`

---

## ${isMulti ? "5" : "4"}. 문서 자동 생성 규칙

### 작업 로그 (Work Log)

모든 작업 시작 시 자동 생성합니다.

**파일명**: \`docs/work-logs/YYYY-MM-DD-<작업-요약>.md\`

\`\`\`markdown
# 작업 로그: <제목>

- **일시**: YYYY-MM-DD HH:mm
- **프로젝트**: <대상 프로젝트>
- **유형**: 신규 개발 | 기능 수정 | 버그 수정 | 리팩토링 | 학습

## 요청 프롬프트
> <원본 사용자 요청을 그대로 기록>

## 계획
- [ ] 단계 1: ...

## 진행 과정
### Step 1: ...
- 수행 내용
- 결정 사항과 근거

## 결과
- 변경된 파일 목록
- 주요 변경 사항 요약

## 참고 자료
- 사용한 공식 문서 링크
\`\`\`

### 트러블슈팅 (Troubleshooting)

이슈 발생 시 자동 생성합니다.

**파일명**: \`docs/troubleshooting/YYYY-MM-DD-<이슈-요약>.md\`

\`\`\`markdown
# 트러블슈팅: <이슈 제목>

- **일시**: YYYY-MM-DD HH:mm
- **심각도**: Critical | High | Medium | Low
- **상태**: 🔴 Open | 🟡 In Progress | 🟢 Resolved

## 증상
- 에러 메시지 및 스택 트레이스
- 재현 조건

## 원인 분석
1. 가설 → 검증 결과

## 해결 방법
- 적용한 수정 사항

## 근본 원인 (Root Cause)
- 왜 이 문제가 발생했는지

## 예방 조치
- 재발 방지를 위한 조치
\`\`\`

### 변경 이력 (Changelog)

파일 변경 발생 시 자동 갱신합니다.

---

## ${isMulti ? "6" : "5"}. 코딩 공통 규칙

- 명확하고 의미 있는 변수·함수·클래스 이름을 사용합니다.
- 함수는 단일 책임 원칙(SRP)을 따릅니다.
- 매직 넘버 대신 상수를 사용합니다.
- 주석은 **왜(Why)** 를 설명하며, 코드 자체가 **무엇(What)** 을 설명하도록 작성합니다.
- 에러 처리를 철저히 합니다 (빈 catch 블록 금지).
- 커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/) 규칙을 따릅니다.

---

## ${isMulti ? "7" : "6"}. 에이전트 행동 지침

### 세션 시작 시

1. \`docs/\` 디렉토리의 최신 문서를 확인하여 컨텍스트를 파악합니다.
2. 진행 중인 작업이 있으면 이어서 진행합니다.
3. 새 작업이면 작업 로그를 생성합니다.

### 작업 중

1. 계획 → 구현 → 검토 순서를 반드시 따릅니다.
2. 이슈 발생 시 즉시 트러블슈팅 문서를 생성합니다.
3. 파일 변경 시 변경 이력을 업데이트합니다.
4. Context7 MCP로 최신 문서를 조회하여 근거 기반 개발을 합니다.

### 세션 종료 시

1. 작업 로그의 결과 섹션을 업데이트합니다.
2. 미완료 작업이 있으면 TODO로 명시합니다.
3. 다음 세션에서 이어갈 수 있도록 컨텍스트를 정리합니다.

---

## ${isMulti ? "8" : "7"}. 문서 작성 언어

- 문서는 **${docLang}** 로 작성합니다.
- 코드 주석은 **${codeLang}** 로 작성합니다.
- 기술 용어는 원어 그대로 사용합니다.

---

*이 지침은 워크스페이스의 모든 작업에 자동 적용됩니다.*
`;

  return {
    relativePath: ".github/copilot-instructions.md",
    content,
  };
}
