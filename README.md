# workspace-init-mcp

VS Code 워크스페이스를 문서 거버넌스, Copilot 지침, 프로젝트 구조와 함께 초기화하는 **MCP(Model Context Protocol) 서버**입니다.

## 개요

새로운 워크스페이스를 시작할 때, 프로젝트의 목적과 유형에 맞는 체계적인 구조를 자동으로 생성합니다.

- Copilot 공통 지침 (`.github/copilot-instructions.md`)
- VS Code 커스텀 지침 (코드 생성, 테스트, 리뷰, 커밋 메시지, PR 설명)
- 문서 거버넌스 디렉토리 (`docs/work-logs`, `troubleshooting`, `changelog`, `adr`)
- 프로젝트 유형별 추가 문서 디렉토리 (학습 노트, API 문서, 실험 로그 등)

## 기술 스택

- **Runtime**: Node.js >= 18
- **Language**: TypeScript
- **Protocol**: MCP (Model Context Protocol) via `@modelcontextprotocol/sdk`
- **Transport**: stdio

## 프로젝트 구조

```
workspace-init-mcp/
├── src/
│   ├── index.ts                  # MCP 서버 엔트리포인트
│   ├── types.ts                  # 타입 정의 및 프로젝트 유형 설정
│   ├── generators/
│   │   ├── index.ts              # 제너레이터 배럴 export
│   │   ├── copilot-instructions.ts  # Copilot 공통 지침 생성
│   │   ├── settings.ts           # VS Code 설정 및 커스텀 지침 생성
│   │   ├── docs-structure.ts     # 문서 디렉토리 구조 생성
│   │   └── changelog.ts          # 변경 이력 및 작업 로그 생성
│   └── tools/
│       └── initialize.ts         # 초기화 도구 오케스트레이션
├── dist/                         # 컴파일된 JS (빌드 산출물)
├── package.json
├── tsconfig.json
└── README.md
```

## 설치 및 빌드

```bash
cd workspace-init-mcp
npm install
npm run build
```

## MCP 서버 등록

VS Code의 MCP 설정 또는 `settings.json`에 다음과 같이 등록합니다:

### VS Code settings.json

```jsonc
{
  "mcp": {
    "servers": {
      "workspace-init": {
        "type": "stdio",
        "command": "node",
        "args": ["<절대경로>/workspace-init-mcp/dist/index.js"],
      },
    },
  },
}
```

### .vscode/mcp.json (워크스페이스 레벨)

```json
{
  "servers": {
    "workspace-init": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/workspace-init-mcp/dist/index.js"]
    }
  }
}
```

## 제공 도구 (MCP Tools)

### 1. `initialize_workspace`

워크스페이스를 완전히 초기화합니다. 파일을 실제로 생성합니다.

**필수 입력값:**

| 파라미터        | 타입   | 설명                          |
| --------------- | ------ | ----------------------------- |
| `workspaceName` | string | 워크스페이스 이름             |
| `purpose`       | string | 워크스페이스의 목적과 목표    |
| `workspacePath` | string | 워크스페이스 루트의 절대 경로 |

**선택 입력값:**

| 파라미터              | 타입     | 기본값      | 설명                               |
| --------------------- | -------- | ----------- | ---------------------------------- |
| `projectType`         | enum     | `"other"`   | 프로젝트 유형 (아래 목록 참조)     |
| `techStack`           | string[] | `[]`        | 사용할 기술 스택                   |
| `docLanguage`         | string   | `"한국어"`  | 문서 작성 언어                     |
| `codeCommentLanguage` | string   | `"English"` | 코드 주석 언어                     |
| `isMultiRepo`         | boolean  | `false`     | Multi-Repository 워크스페이스 여부 |
| `additionalContext`   | string   | —           | 추가 컨텍스트 또는 특별 요구사항   |
| `plannedTasks`        | string[] | `[]`        | 예정된 주요 작업 목록              |

### 2. `preview_workspace_init`

파일을 생성하지 않고, 생성될 파일 목록과 내용을 미리보기합니다.

- `initialize_workspace`와 동일한 입력값을 받습니다.
- 실제 파일 시스템에 변경을 가하지 않습니다.

### 3. `list_project_types`

사용 가능한 프로젝트 유형 목록과 각 유형의 설명을 반환합니다.

- 사용자가 어떤 유형을 선택할지 모를 때 유용합니다.
- 입력값 없음.

## 프로젝트 유형

| 유형           | 라벨                | 설명                                          |
| -------------- | ------------------- | --------------------------------------------- |
| `learning`     | 학습/자기개발       | 학습 자료, 실습, 결과물의 문서화 및 이력 관리 |
| `web-app`      | 웹 애플리케이션     | 프론트엔드/풀스택 웹 애플리케이션 개발        |
| `api`          | API 서버            | 백엔드 API 서버 개발                          |
| `mobile`       | 모바일 앱           | iOS/Android 모바일 애플리케이션 개발          |
| `data-science` | 데이터 사이언스     | 데이터 분석, ML/AI 프로젝트                   |
| `devops`       | DevOps/인프라       | CI/CD, 인프라 관리, 클라우드 환경 구성        |
| `creative`     | 크리에이티브/콘텐츠 | 시나리오, 문서, 콘텐츠 작성 프로젝트          |
| `library`      | 라이브러리/패키지   | 재사용 가능한 라이브러리 또는 패키지 개발     |
| `monorepo`     | 모노레포            | 여러 패키지/서비스를 하나의 저장소에서 관리   |
| `other`        | 기타                | 사용자 정의 프로젝트                          |

## 생성되는 파일 구조

`initialize_workspace` 실행 시 다음 구조가 생성됩니다:

```
<workspace>/
├── .github/
│   └── copilot-instructions.md        # 공통 지침
├── .vscode/
│   ├── settings.json                  # Copilot 설정
│   ├── code-generation.instructions.md
│   ├── test-generation.instructions.md
│   ├── code-review.instructions.md
│   ├── commit-message.instructions.md
│   └── pr-description.instructions.md
├── docs/
│   ├── work-logs/
│   │   ├── README.md
│   │   └── YYYY-MM-DD-워크스페이스-초기-설정.md
│   ├── troubleshooting/
│   │   └── README.md
│   ├── changelog/
│   │   ├── README.md
│   │   └── <workspace-name>.md
│   ├── adr/
│   │   └── README.md
│   └── <프로젝트 유형별 추가 디렉토리>/
│       └── README.md
```

## 사용 예시

### 자기개발 워크스페이스

```
도구: initialize_workspace
입력:
  workspaceName: "upgrade-skills"
  purpose: "자기개발을 위한 학습·실습 통합 공간. 다양한 기술을 학습하고 실습 프로젝트를 진행"
  workspacePath: "C:/workspace/upgrade-skills"
  projectType: "learning"
  isMultiRepo: true
  techStack: ["TypeScript", "Python", "React"]
  plannedTasks: ["React 심화 학습", "Python 데이터 분석", "MCP 서버 개발"]
```

### 웹 애플리케이션 프로젝트

```
도구: initialize_workspace
입력:
  workspaceName: "my-web-app"
  purpose: "사내 업무 관리 시스템 풀스택 웹 애플리케이션 개발"
  workspacePath: "C:/projects/my-web-app"
  projectType: "web-app"
  techStack: ["TypeScript", "Next.js", "Prisma", "PostgreSQL"]
```

### 시나리오/콘텐츠 프로젝트

```
도구: initialize_workspace
입력:
  workspaceName: "story-project"
  purpose: "SF 단편 소설 시리즈 집필 프로젝트"
  workspacePath: "C:/writing/story-project"
  projectType: "creative"
  docLanguage: "한국어"
```

## 라이선스

MIT
