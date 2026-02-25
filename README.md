# workspace-init-mcp

[![npm version](https://img.shields.io/npm/v/workspace-init-mcp)](https://www.npmjs.com/package/workspace-init-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

VS Code 워크스페이스를 문서 거버넌스, Copilot 지침, **Agent Skills**, 프로젝트 구조와 함께 초기화하는 **MCP(Model Context Protocol) 서버**입니다.

> **v3.0.0** — Agent Skills (agentskills.io 오픈 표준) 통합, 50+ 에이전트 & 40+ 스킬 카탈로그, 프로젝트 유형별 자동 추천/설치

---

## 개요

새로운 프로젝트를 시작할 때, LLM에게 **"워크스페이스 초기화해 줘"** 라고 말하면 프로젝트 유형에 맞는 체계적인 구조가 자동으로 생성됩니다.

- **10개 도구(Tools)** — 초기화, 미리보기, 프로젝트 유형 조회, 폼 스키마, 검증, 분석, Agent Skills 추천/검색/설치/카탈로그
- **3개 프롬프트(Prompts)** — 전체 설정 폼, 빠른 시작, 워크스페이스 분석
- **3개 리소스(Resources)** — 프로젝트 유형 가이드 (정적 + 동적), Agent Skills 카탈로그
- **Agent Skills 엔진** — [agentskills.io](https://agentskills.io) 오픈 표준 기반, 프로젝트별 맞춤 추천
- **범용 폼 시스템** — CLI, VS Code, Claude Desktop, ChatGPT, Google AI Studio 등 모든 MCP 클라이언트에서 동작

### 생성되는 것들

| 카테고리 | 파일 |
|---|---|
| Copilot 공통 지침 | `.github/copilot-instructions.md` |
| **Agent Skills** | `.github/skills/<name>/SKILL.md` (프로젝트별 자동 추천) |
| **Agent 정의** | `.github/agents/<name>.agent.md` (프로젝트별 자동 추천) |
| Agent Skills 인덱스 | `.github/AGENT-SKILLS.md` (설치된 스킬/에이전트 목록) |
| VS Code 커스텀 지침 | `.vscode/code-generation.instructions.md`, `test-generation`, `code-review`, `commit-message`, `pr-description` |
| VS Code 설정 | `.vscode/settings.json` (Copilot 커스텀 지침 참조 설정) |
| 문서 거버넌스 | `docs/work-logs/`, `troubleshooting/`, `changelog/`, `adr/` |
| 프로젝트별 추가 문서 | 프로젝트 유형에 따라 자동 추가 (API 문서, 학습 노트, 실험 로그 등) |

---

## 빠른 시작

### 1단계: 설치

```bash
# npm 글로벌 설치 (권장)
npm install -g workspace-init-mcp

# 또는 npx로 직접 실행 (설치 없이)
npx workspace-init-mcp
```

### 2단계: MCP 클라이언트에 서버 등록

사용하는 LLM 클라이언트에 따라 아래 중 하나를 설정합니다.

#### VS Code — settings.json (사용자 레벨)

```jsonc
{
  "mcp": {
    "servers": {
      "workspace-init": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "workspace-init-mcp"]
      }
    }
  }
}
```

#### VS Code — .vscode/mcp.json (워크스페이스 레벨)

```json
{
  "servers": {
    "workspace-init": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "workspace-init-mcp"]
    }
  }
}
```

#### Claude Desktop — claude_desktop_config.json

```json
{
  "mcpServers": {
    "workspace-init": {
      "command": "npx",
      "args": ["-y", "workspace-init-mcp"]
    }
  }
}
```

#### 로컬 빌드 사용 시

```bash
git clone https://github.com/Gabeujin/workspace-init-mcp.git
cd workspace-init-mcp
npm install
npm run build
```

```jsonc
// settings.json 또는 mcp.json
{
  "servers": {
    "workspace-init": {
      "type": "stdio",
      "command": "node",
      "args": ["<절대경로>/workspace-init-mcp/dist/index.js"]
    }
  }
}
```

### 3단계: LLM에게 말하기

서버 등록이 완료되면 LLM 채팅에서 바로 사용할 수 있습니다:

```
"새 프로젝트 워크스페이스를 초기화해 줘"
```

---

## 사용 가이드

### 워크플로우 1: 처음부터 새 프로젝트 시작 (권장)

LLM에게 자연어로 요청하면, MCP 서버가 단계별로 안내합니다.

**대화 예시:**

```
👤 사용자:
   새 프로젝트를 시작하려고 해. 워크스페이스를 초기화해 줘.

🤖 LLM:
   워크스페이스 초기화를 도와드리겠습니다!
   먼저 입력 폼을 가져오겠습니다.
   → get_init_form_schema 호출 (format: "conversational")

   아래 정보를 알려주세요:

   📋 필수 입력
   1. 워크스페이스 이름: (예: my-project)
   2. 프로젝트 목적: (구체적으로 작성할수록 좋습니다)
   3. 워크스페이스 경로: (절대 경로, 예: C:\projects\my-project)

   📋 선택 입력 (미입력 시 기본값 적용)
   4. 프로젝트 유형: learning, web-app, api, mobile 등
   5. 기술 스택: TypeScript, React, Node.js 등
   ...

👤 사용자:
   이름은 "shopping-mall", 목적은 "이커머스 쇼핑몰 풀스택 개발",
   경로는 C:\projects\shopping-mall, 유형은 web-app,
   기술 스택은 TypeScript, Next.js, Prisma

🤖 LLM:
   먼저 생성될 파일을 미리보기 하겠습니다.
   → preview_workspace_init 호출

   총 15개 파일이 생성됩니다. 진행할까요?

👤 사용자:
   좋아, 진행해 줘.

🤖 LLM:
   → initialize_workspace 호출
   ✅ 워크스페이스 초기화 완료! 15개 파일이 생성되었습니다.
```

### 워크플로우 2: 기존 프로젝트에 거버넌스 추가

이미 코드가 있는 프로젝트에 문서 거버넌스 구조만 추가할 때:

```
👤 사용자:
   이 프로젝트를 분석하고 워크스페이스 거버넌스를 추가해 줘.

🤖 LLM:
   → analyze_workspace 호출 (현재 워크스페이스 경로)
   
   분석 결과:
   - 프로젝트 유형: web-app (감지됨)
   - 기술 스택: TypeScript, React, Vite (감지됨)
   - 초기화 상태: 미완료
   
   감지된 설정으로 초기화하겠습니다.
   → initialize_workspace 호출
   ✅ 기존 파일은 건너뛰고 거버넌스 파일만 추가되었습니다.
```

### 워크플로우 3: 빠른 시작 (최소 입력)

필수 정보 3개만 제공하면 나머지는 자동 감지합니다:

```
👤 사용자:
   C:\projects\my-api 경로에 "my-api"라는 API 서버 프로젝트를 빠르게 초기화해 줘.

🤖 LLM:
   → analyze_workspace 호출 (자동 감지)
   → initialize_workspace 호출 (감지된 설정 반영)
   ✅ 완료!
```

### 워크플로우 4: 초기화 후 검증

초기화 상태를 확인하고 누락된 부분을 보완:

```
👤 사용자:
   현재 워크스페이스의 초기화 상태를 검증해 줘.

🤖 LLM:
   → validate_workspace 호출

   📊 검증 결과:
   - 초기화 상태: ✅ 완료
   - 완성도: 85%
   - 누락: docs/adr/README.md (권장), docs/troubleshooting/README.md (권장)
   - 제안: 누락된 권장 파일을 추가하시겠습니까?
```

---

## 제공 기능 상세

### 도구 (Tools) — 10개

#### 1. `initialize_workspace`

워크스페이스를 완전히 초기화합니다. 파일을 실제로 생성합니다.
**v3.0.0부터 Agent Skills (`.github/skills/`, `.github/agents/`)도 자동 생성됩니다.**

**필수 입력값:**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `workspaceName` | string | 워크스페이스 이름 (파일명/제목에 사용) |
| `purpose` | string | 프로젝트의 목적과 목표 (구체적일수록 좋음) |
| `workspacePath` | string | 워크스페이스 루트의 절대 경로 |

**선택 입력값:**

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `projectType` | enum | `"other"` | 프로젝트 유형 (아래 목록 참조) |
| `techStack` | string[] | `[]` | 사용할 기술 스택 |
| `docLanguage` | string | `"한국어"` | 문서 작성 언어 |
| `codeCommentLanguage` | string | `"English"` | 코드 주석 언어 |
| `isMultiRepo` | boolean | `false` | Multi-Repository 워크스페이스 여부 |
| `additionalContext` | string | — | 추가 컨텍스트 또는 특별 요구사항 |
| `plannedTasks` | string[] | `[]` | 예정된 주요 작업 목록 |
| `includeAgentSkills` | boolean | `true` | Agent Skills 포함 여부 |
| `agentSkillsIntent` | string | — | Agent Skills 추천 튜닝을 위한 사용자 의도 |
| `force` | boolean | `false` | `true` 시 기존 파일을 덮어씀 |

#### 2. `preview_workspace_init`

파일을 생성하지 않고, 생성될 파일 목록과 내용을 미리보기합니다.

- `initialize_workspace`와 동일한 입력값 (`force` 제외)
- 실제 파일 시스템에 변경 없음

#### 3. `list_project_types`

사용 가능한 프로젝트 유형 목록과 각 유형의 설명·기본 기술 스택·추가 문서 섹션을 반환합니다.
- 입력값 없음

#### 4. `get_init_form_schema`

워크스페이스 초기화를 위한 **범용 JSON 폼 스키마**를 반환합니다.

모든 MCP 클라이언트(CLI, VS Code, Claude Desktop, ChatGPT, Google AI Studio 등)에서 사용자에게 입력 폼을 보여줄 수 있도록 설계되었습니다.

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `format` | enum | `"full"` | `"full"`: 전체 JSON 스키마, `"conversational"`: 대화형 마크다운 가이드, `"cli"`: CLI용 간결 가이드 |

#### 5. `validate_workspace`

워크스페이스가 올바르게 초기화되었는지 검증합니다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `workspacePath` | string | 검증할 워크스페이스의 절대 경로 |

**반환 정보:** 전체 초기화 상태, 완성도(%), 파일별 상태(존재/누락), 심각도별 분류, 개선 제안

#### 6. `analyze_workspace`

기존 워크스페이스 디렉토리를 분석하여 프로젝트 유형, 기술 스택, 구조를 감지합니다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `workspacePath` | string | 분석할 워크스페이스의 절대 경로 |

**감지 대상:** TypeScript, React, Vue, Angular, Node.js, Python, Java, Go, Rust, Docker, Kubernetes, Terraform, Jupyter, 모노레포(lerna, nx, turborepo 등)

#### 7. `recommend_agent_skills` *(v3.0.0 신규)*

프로젝트 유형, 기술 스택, 사용자 의도에 기반하여 AI 에이전트 스킬을 추천합니다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `projectType` | enum (선택) | 프로젝트 유형 |
| `techStack` | string[] (선택) | 기술 스택 키워드 |
| `userIntent` | string (선택) | 추천 튜닝을 위한 자유 텍스트 (예: "testing devops automation") |
| `maxAgents` | number (선택) | 반환할 최대 에이전트 수 (기본: 10) |
| `maxSkills` | number (선택) | 반환할 최대 스킬 수 (기본: 15) |

#### 8. `search_agent_skills` *(v3.0.0 신규)*

Agent Skills 카탈로그에서 자유 텍스트 검색을 수행합니다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `query` | string | 검색어 (예: "docker", "react", "security") |

#### 9. `install_agent_skills` *(v3.0.0 신규)*

선택한 스킬과 에이전트를 워크스페이스에 설치합니다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `workspacePath` | string | 워크스페이스 루트 절대 경로 |
| `skillIds` | string[] (선택) | 설치할 스킬 ID 목록 |
| `agentIds` | string[] (선택) | 설치할 에이전트 ID 목록 |
| `force` | boolean (선택) | 기존 파일 덮어쓰기 여부 |

#### 10. `list_agent_skills_catalog` *(v3.0.0 신규)*

전체 Agent Skills 카탈로그를 카테고리별로 나열합니다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `filter` | enum (선택) | `"all"` (기본), `"agents"`, `"skills"` |

---

### 프롬프트 (Prompts) — 3개

MCP 프롬프트는 클라이언트가 사용자에게 폼을 보여주는 표준 방식입니다. Claude Desktop, VS Code Copilot 등의 프롬프트 선택기에서 바로 사용할 수 있습니다.

| 프롬프트 | 설명 | 필수 인자 |
|---|---|---|
| `workspace-init` | 전체 설정 폼 (필수 3개 + 선택 7개 입력) | `workspaceName`, `purpose`, `workspacePath` |
| `workspace-quick-start` | 빠른 초기화 (필수 3개만, 나머지 자동 감지) | `workspaceName`, `purpose`, `workspacePath` |
| `workspace-analyze` | 기존 워크스페이스 분석 | `workspacePath` |

---

### 리소스 (Resources) — 3개

MCP 리소스는 LLM이 참조할 수 있는 정적/동적 데이터를 제공합니다.

| 리소스 URI | 설명 |
|---|---|
| `workspace-init://project-types` | 모든 프로젝트 유형의 종합 가이드 (Markdown) |
| `workspace-init://project-types/{type}` | 특정 프로젝트 유형의 상세 설정 (JSON, 동적) |
| `workspace-init://agent-skills` | Agent Skills 전체 카탈로그 (JSON) *(v3.0.0 신규)* |

---

## Agent Skills (v3.0.0 신규)

[Agent Skills](https://agentskills.io)는 AI 에이전트의 능력을 표준화하는 오픈 표준입니다. VS Code, Claude, Cursor, OpenHands 등 다양한 AI 도구에서 호환됩니다.

### 스킬 형식 (SKILL.md)

```markdown
---
name: "My Skill"
description: "What this skill does"
argument-hint: "How to invoke"
user-invokable: true
disable-model-invocation: false
---

# Instructions for the AI agent...
```

### 카탈로그 개요

| 분류 | 카테고리 | 주요 항목 |
|---|---|---|
| **에이전트** | planning, architecture, engineering, debugging, testing, devops, documentation, review, security, meta | Plan, Context Architect, Principal Software Engineer, Debug, DevOps Expert, Technical Writer, Code Reviewer 등 50+ |
| **스킬** | blueprint, document-gen, code-gen, testing, devops, git, mcp, refactor, analysis, prompt, project-setup | Copilot Instructions Blueprint, Create Specification, Conventional Commit, Playwright Test Generator, Multi-Stage Dockerfile 등 40+ |

### 프로젝트별 자동 추천

`initialize_workspace` 호출 시, 프로젝트 유형과 기술 스택에 따라 적합한 스킬/에이전트가 자동으로 추천되어 설치됩니다:

- **web-app + React**: React Frontend Engineer, Playwright Tester, Web App Testing, Create Specification 등
- **api + Node.js**: API Architect, Debug, Conventional Commit, Multi-Stage Dockerfile 등
- **devops**: DevOps Expert, Platform SRE Kubernetes, Terraform, GitHub Actions Expert 등

### 스킬 검색 경로

| AI 도구 | 검색 경로 |
|---|---|
| VS Code Copilot | `.github/skills/` |
| Claude Code | `.claude/skills/` 또는 `.github/skills/` |
| Cursor | `.cursor/skills/` 또는 `.github/skills/` |
| OpenHands | `.agents/skills/` 또는 `.github/skills/` |

---

## 프로젝트 유형

| 유형 | 라벨 | 설명 |
|---|---|---|
| `learning` | 학습/자기개발 | 학습 자료, 실습, 결과물의 문서화 및 이력 관리 |
| `web-app` | 웹 애플리케이션 | 프론트엔드/풀스택 웹 애플리케이션 개발 |
| `api` | API 서버 | 백엔드 API 서버 개발 |
| `mobile` | 모바일 앱 | iOS/Android 모바일 애플리케이션 개발 |
| `data-science` | 데이터 사이언스 | 데이터 분석, ML/AI 프로젝트 |
| `devops` | DevOps/인프라 | CI/CD, 인프라 관리, 클라우드 환경 구성 |
| `creative` | 크리에이티브/콘텐츠 | 시나리오, 문서, 콘텐츠 작성 프로젝트 |
| `library` | 라이브러리/패키지 | 재사용 가능한 라이브러리 또는 패키지 개발 |
| `monorepo` | 모노레포 | 여러 패키지/서비스를 하나의 저장소에서 관리 |
| `other` | 기타 | 사용자 정의 프로젝트 |

---

## 생성되는 파일 구조

`initialize_workspace` 실행 시 다음 구조가 생성됩니다:

```
<workspace>/
├── .github/
│   ├── copilot-instructions.md          # Copilot 공통 지침
│   ├── AGENT-SKILLS.md                  # 설치된 스킬/에이전트 인덱스
│   ├── skills/                          # Agent Skills (agentskills.io)
│   │   ├── conventional-commit/
│   │   │   └── SKILL.md
│   │   ├── create-specification/
│   │   │   └── SKILL.md
│   │   ├── refactor/
│   │   │   └── SKILL.md
│   │   └── ... (프로젝트 유형별 자동 선택)
│   └── agents/                          # Agent 정의
│       ├── plan.agent.md
│       ├── principal-software-engineer.agent.md
│       ├── debug.agent.md
│       └── ... (프로젝트 유형별 자동 선택)
├── .vscode/
│   ├── settings.json                    # Copilot 커스텀 지침 참조 설정
│   ├── code-generation.instructions.md  # 코드 생성 지침
│   ├── test-generation.instructions.md  # 테스트 생성 지침
│   ├── code-review.instructions.md      # 코드 리뷰 지침
│   ├── commit-message.instructions.md   # 커밋 메시지 지침
│   └── pr-description.instructions.md   # PR 설명 지침
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

---

## 사용 예시 (Tool 호출)

### 예시 1: 학습/자기개발 워크스페이스

```json
{
  "tool": "initialize_workspace",
  "arguments": {
    "workspaceName": "upgrade-skills",
    "purpose": "자기개발을 위한 학습·실습 통합 공간. 다양한 기술을 학습하고 실습 프로젝트를 진행",
    "workspacePath": "C:/workspace/upgrade-skills",
    "projectType": "learning",
    "isMultiRepo": true,
    "techStack": ["TypeScript", "Python", "React"],
    "plannedTasks": ["React 심화 학습", "Python 데이터 분석", "MCP 서버 개발"]
  }
}
```

### 예시 2: 웹 애플리케이션 프로젝트

```json
{
  "tool": "initialize_workspace",
  "arguments": {
    "workspaceName": "shopping-mall",
    "purpose": "이커머스 쇼핑몰 풀스택 웹 애플리케이션 개발",
    "workspacePath": "C:/projects/shopping-mall",
    "projectType": "web-app",
    "techStack": ["TypeScript", "Next.js", "Prisma", "PostgreSQL"]
  }
}
```

### 예시 3: 기존 프로젝트 분석 → 초기화

```json
// Step 1: 분석
{
  "tool": "analyze_workspace",
  "arguments": {
    "workspacePath": "C:/projects/existing-api"
  }
}
// → 감지 결과: projectType="api", techStack=["TypeScript", "Express", "MongoDB"]

// Step 2: 감지된 설정으로 초기화
{
  "tool": "initialize_workspace",
  "arguments": {
    "workspaceName": "existing-api",
    "purpose": "기존 REST API 서버에 문서 거버넌스 추가",
    "workspacePath": "C:/projects/existing-api",
    "projectType": "api",
    "techStack": ["TypeScript", "Express", "MongoDB"]
  }
}
```

### 예시 4: 검증

```json
{
  "tool": "validate_workspace",
  "arguments": {
    "workspacePath": "C:/projects/shopping-mall"
  }
}
// → 완성도: 100%, 상태: ✅ 초기화 완료
```

### 예시 5: 폼 스키마 조회 (대화형)

```json
{
  "tool": "get_init_form_schema",
  "arguments": {
    "format": "conversational"
  }
}
// → LLM이 사용자에게 보여줄 마크다운 형태의 입력 가이드 반환
```

### 예시 6: Agent Skills 추천 *(v3.0.0 신규)*

```json
{
  "tool": "recommend_agent_skills",
  "arguments": {
    "projectType": "web-app",
    "techStack": ["TypeScript", "React", "Next.js"],
    "userIntent": "testing devops ci/cd"
  }
}
// → 프로젝트에 적합한 에이전트와 스킬 추천 목록 반환
```

### 예시 7: Agent Skills 검색 *(v3.0.0 신규)*

```json
{
  "tool": "search_agent_skills",
  "arguments": {
    "query": "docker"
  }
}
// → Docker 관련 에이전트와 스킬 검색 결과 반환
```

### 예시 8: Agent Skills 개별 설치 *(v3.0.0 신규)*

```json
{
  "tool": "install_agent_skills",
  "arguments": {
    "workspacePath": "C:/projects/my-app",
    "skillIds": ["conventional-commit", "multi-stage-dockerfile", "playwright-generate-test"],
    "agentIds": ["debug", "devops-expert"]
  }
}
// → 선택한 스킬과 에이전트를 .github/skills/ 및 .github/agents/ 에 설치
```

---

## 프로젝트 구조

```
workspace-init-mcp/
├── src/
│   ├── index.ts                     # MCP 서버 엔트리포인트 (Tools, Prompts, Resources 등록)
│   ├── types.ts                     # 타입 정의 및 프로젝트 유형 설정
│   ├── data/
│   │   └── agent-skills-registry.ts # Agent Skills 카탈로그 (에이전트/스킬 레지스트리 + 추천 엔진)
│   ├── generators/
│   │   ├── index.ts                 # 제너레이터 배럴 export
│   │   ├── copilot-instructions.ts  # Copilot 공통 지침 생성
│   │   ├── settings.ts              # VS Code 설정 및 커스텀 지침 생성
│   │   ├── docs-structure.ts        # 문서 디렉토리 구조 생성
│   │   ├── changelog.ts             # 변경 이력 및 작업 로그 생성
│   │   └── agent-skills.ts          # Agent Skills & Agent 파일 생성 (SKILL.md, .agent.md)
│   ├── tools/
│   │   ├── initialize.ts            # 초기화 오케스트레이션
│   │   ├── form-schema.ts           # 범용 JSON 폼 스키마 빌더
│   │   ├── validate.ts              # 워크스페이스 검증
│   │   └── status.ts                # 워크스페이스 분석/감지
│   └── prompts/
│       ├── index.ts                 # 프롬프트 배럴 export
│       └── workspace-init.ts        # MCP 프롬프트 정의 및 메시지 빌더
├── dist/                            # 컴파일된 JS (빌드 산출물)
├── package.json
├── tsconfig.json
├── LICENSE
└── README.md
```

## 기술 스택

| 항목 | 버전 |
|---|---|
| Node.js | >= 18.0.0 |
| TypeScript | 5.7.3 |
| @modelcontextprotocol/sdk | 1.26.0 (`registerTool`/`registerPrompt`/`registerResource` API) |
| Zod | 3.24.2 |
| Transport | stdio |

## 라이선스

MIT
