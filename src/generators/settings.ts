/**
 * Generator for .vscode/settings.json and custom instruction files.
 * Creates Copilot custom instructions tailored to the project type.
 */

import { type WorkspaceInitParams, type GeneratedFile } from "../types.js";

/** Generate .vscode/settings.json with Copilot custom instruction references */
export function generateSettings(params: WorkspaceInitParams): GeneratedFile {
  const settings = {
    "github.copilot.chat.codeGeneration.instructions": [
      { file: "code-generation.instructions.md" },
    ],
    "github.copilot.chat.testGeneration.instructions": [
      { file: "test-generation.instructions.md" },
    ],
    "github.copilot.chat.reviewSelection.instructions": [
      { file: "code-review.instructions.md" },
    ],
    "github.copilot.chat.commitMessageGeneration.instructions": [
      { file: "commit-message.instructions.md" },
    ],
    "github.copilot.chat.pullRequestDescriptionGeneration.instructions": [
      { file: "pr-description.instructions.md" },
    ],
    "files.trimTrailingWhitespace": true,
    "files.insertFinalNewline": true,
    "files.trimFinalNewlines": true,
    "editor.formatOnSave": true,
    "editor.defaultFormatter": null as string | null,
    "files.exclude": {
      "**/.git": true,
      "**/.DS_Store": true,
      "**/Thumbs.db": true,
    },
    "search.exclude": {
      "**/node_modules": true,
      "**/dist": true,
      "**/build": true,
      "**/.next": true,
      "**/target": true,
      "**/__pycache__": true,
      "**/*.pyc": true,
    },
  };

  return {
    relativePath: ".vscode/settings.json",
    content: JSON.stringify(settings, null, 2) + "\n",
  };
}

/** Generate code generation instruction file */
export function generateCodeGenInstructions(
  params: WorkspaceInitParams
): GeneratedFile {
  const techNote = params.techStack?.length
    ? `\n## 기술 스택 참고\n\n이 프로젝트는 ${params.techStack.join(", ")} 기반입니다. 해당 기술의 공식 컨벤션과 모범 사례를 따릅니다.\n`
    : "";

  const content = `---
applyTo: "**"
---

# 코드 생성 공통 지침 (Code Generation Instructions)

## 기본 원칙

- 코드는 **읽기 쉽고 유지보수 가능** 하도록 작성합니다.
- 단일 책임 원칙(SRP)을 준수합니다.
- DRY(Don't Repeat Yourself) 원칙을 따릅니다.
- YAGNI(You Aren't Gonna Need It) — 필요하지 않은 기능은 미리 구현하지 않습니다.
${techNote}
## 네이밍 컨벤션

- 변수/함수: 의미를 명확히 전달하는 이름 사용
- 상수: UPPER_SNAKE_CASE
- 불리언 변수: \`is\`, \`has\`, \`should\`, \`can\` 접두사 사용
- 함수명은 동사로 시작 (예: \`getUserData\`, \`calculateTotal\`)
- 약어 사용을 최소화하고, 사용 시 일관성을 유지

## 코드 구조

- 함수는 하나의 작업만 수행하며, 20줄 이내를 권장
- 중첩(nesting)은 최대 3단계까지 허용, 그 이상은 함수로 분리
- Early return 패턴을 적극 활용하여 중첩을 줄임
- 매직 넘버·문자열은 상수로 추출
- 관련 코드를 논리적으로 그룹핑하고 빈 줄로 구분

## 에러 처리

- 모든 외부 호출(API, DB, 파일 I/O)에 적절한 에러 처리 필수
- 빈 catch 블록 금지 — 최소한 로깅을 포함
- 사용자에게 의미 있는 에러 메시지를 제공
- 필요 시 커스텀 에러 클래스를 정의

## 주석

- 코드 자체로 의미가 전달되도록 작성 (자기 설명적 코드)
- 주석은 **왜(Why)** 해당 방식을 선택했는지 설명
- TODO/FIXME/HACK 주석에는 반드시 설명을 포함
- 주석은 ${params.codeCommentLanguage ?? "English"}로 작성

## 보안

- 하드코딩된 자격 증명, API 키, 비밀번호 금지
- 환경 변수 또는 시크릿 매니저를 통해 민감 정보 관리
- 사용자 입력은 반드시 검증 및 새니타이징

## 성능

- 불필요한 연산, 메모리 할당을 피함
- 대량 데이터 처리 시 페이징, 스트리밍 고려
- N+1 쿼리 등 비효율적 데이터 접근 패턴 방지
`;

  return {
    relativePath: ".vscode/code-generation.instructions.md",
    content,
  };
}

/** Generate test generation instruction file */
export function generateTestInstructions(): GeneratedFile {
  const content = `---
applyTo: "**/*.{test,spec}.{js,ts,jsx,tsx,py,java}"
---

# 테스트 생성 지침 (Test Generation Instructions)

## 기본 원칙

- 테스트는 **독립적이고 반복 가능** 해야 합니다.
- 각 테스트는 하나의 동작만 검증합니다.
- AAA 패턴 (Arrange → Act → Assert)을 따릅니다.
- 테스트 이름은 \`[대상]_[시나리오]_[기대결과]\` 형식을 권장합니다.

## 테스트 범위

- Happy Path: 정상 동작 시나리오
- Edge Cases: 경계값, 빈 값, null/undefined
- Error Cases: 예외 발생 시나리오
- 입력 유효성 검증

## 테스트 구조

- 테스트 파일은 대상 파일과 동일한 디렉토리 또는 \`__tests__/\` 폴더에 위치
- 테스트 데이터는 명확하게 정의하고, 팩토리 함수 또는 fixture 사용 권장
- 외부 의존성은 Mock/Stub으로 격리
- 테스트 간 상태 공유 금지

## 작성 규칙

- 각 describe 블록은 논리적 단위로 그룹핑
- beforeEach/afterEach로 설정/정리를 명확히 분리
- assertion 메시지를 포함하여 실패 시 원인 파악이 용이하도록 작성
- 스냅샷 테스트는 최소한으로 사용
`;

  return {
    relativePath: ".vscode/test-generation.instructions.md",
    content,
  };
}

/** Generate code review instruction file */
export function generateReviewInstructions(): GeneratedFile {
  const content = `---
applyTo: "**"
---

# 코드 리뷰 지침 (Code Review Instructions)

## 리뷰 관점

### 1. 정확성 (Correctness)
- 로직이 요구사항을 올바르게 구현하는가?
- 경계 조건과 엣지 케이스가 처리되었는가?
- 에러 핸들링이 적절한가?

### 2. 가독성 (Readability)
- 변수/함수명이 의미를 명확히 전달하는가?
- 코드 구조가 이해하기 쉬운가?
- 불필요한 복잡성이 없는가?

### 3. 유지보수성 (Maintainability)
- 단일 책임 원칙을 준수하는가?
- DRY 원칙을 따르는가?
- 향후 변경이 용이한 구조인가?

### 4. 보안 (Security)
- 민감 정보가 하드코딩되어 있지 않은가?
- 사용자 입력이 적절히 검증·새니타이징되는가?
- 알려진 취약점 패턴이 없는가?

### 5. 성능 (Performance)
- 불필요한 연산이나 메모리 사용이 없는가?
- N+1 쿼리 등 비효율적 패턴이 없는가?
- 적절한 캐싱 전략이 적용되었는가?

## 리뷰 결과 형식

\`\`\`markdown
### ✅ 장점
- ...

### ⚠️ 개선 제안
- [파일:라인] 설명 및 제안

### 🔴 필수 수정
- [파일:라인] 문제 설명 및 수정 방안

### 📝 참고 사항
- ...
\`\`\`
`;

  return {
    relativePath: ".vscode/code-review.instructions.md",
    content,
  };
}

/** Generate commit message instruction file */
export function generateCommitInstructions(): GeneratedFile {
  const content = `---
applyTo: "**"
---

# 커밋 메시지 생성 지침 (Commit Message Instructions)

## 형식: Conventional Commits

\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

## Type 목록

- \`feat\`: 새로운 기능 추가
- \`fix\`: 버그 수정
- \`docs\`: 문서 변경
- \`style\`: 코드 포맷팅 (기능 변경 없음)
- \`refactor\`: 코드 리팩토링 (기능 변경 없음)
- \`test\`: 테스트 추가/수정
- \`chore\`: 빌드 설정, 의존성 업데이트 등
- \`perf\`: 성능 개선
- \`ci\`: CI/CD 설정 변경

## 규칙

- **subject**: 50자 이내, 명령형(imperative) 현재 시제, 첫 글자 소문자, 마침표 없음
- **scope**: 변경 대상 프로젝트 또는 모듈
- **body**: 변경의 이유(Why)와 이전 동작과의 차이를 설명 (72자 줄바꿈)
- **footer**: Breaking Changes, 관련 이슈 번호 (\`Closes #123\`)
- 한 커밋에 하나의 논리적 변경만 포함
`;

  return {
    relativePath: ".vscode/commit-message.instructions.md",
    content,
  };
}

/** Generate PR description instruction file */
export function generatePRInstructions(): GeneratedFile {
  const content = `---
applyTo: "**"
---

# PR 설명 생성 지침 (Pull Request Description Instructions)

## PR 제목

- Conventional Commits 형식: \`<type>(<scope>): <설명>\`

## PR 본문 템플릿

\`\`\`markdown
## 📋 변경 사항 요약

## 🎯 변경 이유

## 🔧 변경 내역
-

## 🧪 테스트
- [ ] 단위 테스트
- [ ] 통합 테스트
- [ ] 수동 테스트

## ⚠️ 주의 사항

## 🔗 관련 이슈
\`\`\`
`;

  return {
    relativePath: ".vscode/pr-description.instructions.md",
    content,
  };
}

/** Generate .editorconfig for cross-editor consistency */
export function generateEditorConfig(params: WorkspaceInitParams): GeneratedFile {
  const encoding = params.fileEncoding ?? "utf-8";
  // .editorconfig charset value: utf-8, utf-8-bom, latin1
  const charset = encoding === "utf-8-bom" ? "utf-8-bom" : encoding === "latin1" ? "latin1" : "utf-8";
  const eol = params.lineEnding === "crlf" ? "crlf" : "lf";

  const content = `root = true

[*]
charset = ${charset}
end_of_line = ${eol}
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.py]
indent_size = 4

[Makefile]
indent_style = tab

[*.go]
indent_style = tab
`;

  return {
    relativePath: ".editorconfig",
    content,
  };
}

/** Generate .gitattributes for cross-platform line ending consistency */
export function generateGitAttributes(params: WorkspaceInitParams): GeneratedFile {
  const lineEnding = params.lineEnding ?? "lf";
  const eolSetting = lineEnding === "auto" ? "auto" : lineEnding === "crlf" ? "crlf" : "lf";
  const eolDirective = lineEnding === "auto" ? "text=auto" : `text eol=${eolSetting}`;

  const content = `# Auto-detect text files and normalize line endings
* ${eolDirective}

# Source code
*.ts text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.tsx text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.js text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.jsx text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.py text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.java text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.go text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.rs text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.cs text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.rb text eol=${eolSetting === "auto" ? "lf" : eolSetting}

# Config & docs
*.json text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.yaml text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.yml text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.md text eol=${eolSetting === "auto" ? "lf" : eolSetting}
*.toml text eol=${eolSetting === "auto" ? "lf" : eolSetting}

# Binary files
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.webp binary
*.woff binary
*.woff2 binary
*.ttf binary
*.eot binary
*.zip binary
*.tar.gz binary
*.pdf binary
`;

  return {
    relativePath: ".gitattributes",
    content,
  };
}
