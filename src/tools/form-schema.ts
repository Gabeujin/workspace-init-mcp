/**
 * Form Schema Tool
 *
 * Returns a universal JSON form schema that ANY LLM client can use
 * to render input forms — works in CLI, VSCode, Claude Desktop,
 * GPT Desktop, Google AI Studio, and any custom client.
 *
 * The schema separates required and optional fields with rich metadata
 * (labels, descriptions, types, defaults, enums, placeholders) so that
 * clients can build native UI or conversational input flows.
 */

import { PROJECT_TYPE_CONFIGS, type ProjectType } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormField {
  name: string;
  label: string;
  type: "text" | "select" | "multiselect" | "boolean" | "textarea" | "tags";
  required: boolean;
  description: string;
  placeholder?: string;
  default?: string | boolean | string[];
  options?: { value: string; label: string; description?: string }[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    patternDescription?: string;
  };
}

export interface FormSection {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
}

export interface FormSchema {
  formId: string;
  formTitle: string;
  formDescription: string;
  version: string;
  sections: FormSection[];
  /** Markdown-formatted usage guide for LLMs that render conversationally */
  conversationalGuide: string;
  /** Compact CLI prompt text */
  cliPromptGuide: string;
}

// ---------------------------------------------------------------------------
// Schema builder
// ---------------------------------------------------------------------------

export function buildInitFormSchema(): FormSchema {
  const projectTypeOptions = Object.entries(PROJECT_TYPE_CONFIGS).map(
    ([key, config]) => ({
      value: key,
      label: config.label,
      description: config.description,
    })
  );

  const requiredFields: FormField[] = [
    {
      name: "workspaceName",
      label: "워크스페이스 이름",
      type: "text",
      required: true,
      description:
        "프로젝트를 식별하는 이름입니다. 파일명, 제목 등에 사용됩니다.",
      placeholder: "my-awesome-project",
      validation: {
        minLength: 1,
        maxLength: 100,
        pattern: "^[a-zA-Z0-9가-힣][a-zA-Z0-9가-힣\\s\\-_.]*$",
        patternDescription:
          "영문, 한글, 숫자, 공백, 하이픈, 밑줄, 점으로 구성",
      },
    },
    {
      name: "purpose",
      label: "프로젝트 목적",
      type: "textarea",
      required: true,
      description:
        "이 워크스페이스의 주요 목적과 목표를 구체적으로 설명해 주세요. LLM이 맞춤형 지침을 생성하는 데 사용됩니다.",
      placeholder:
        "React와 Node.js를 사용한 실시간 채팅 애플리케이션 개발. WebSocket 기반 통신, 사용자 인증, 메시지 이력 관리 기능 포함.",
      validation: { minLength: 10, maxLength: 2000 },
    },
    {
      name: "workspacePath",
      label: "워크스페이스 경로",
      type: "text",
      required: true,
      description:
        "워크스페이스 루트 디렉토리의 절대 경로입니다. 이 경로에 파일이 생성됩니다.",
      placeholder: "C:\\projects\\my-project 또는 /home/user/projects/my-project",
      validation: { minLength: 1 },
    },
  ];

  const optionalFields: FormField[] = [
    {
      name: "projectType",
      label: "프로젝트 유형",
      type: "select",
      required: false,
      description:
        "프로젝트 성격에 맞는 유형을 선택하면 맞춤형 문서 구조와 지침이 생성됩니다.",
      default: "other",
      options: projectTypeOptions,
    },
    {
      name: "techStack",
      label: "기술 스택",
      type: "tags",
      required: false,
      description:
        '사용할 기술/프레임워크 목록입니다. 코드 생성 지침에 반영됩니다.',
      placeholder: "TypeScript, React, Node.js, PostgreSQL",
      default: [],
    },
    {
      name: "docLanguage",
      label: "문서 작성 언어",
      type: "text",
      required: false,
      description: "문서를 작성할 언어입니다.",
      default: "한국어",
      placeholder: "한국어",
    },
    {
      name: "codeCommentLanguage",
      label: "코드 주석 언어",
      type: "text",
      required: false,
      description: "코드 주석을 작성할 언어입니다.",
      default: "English",
      placeholder: "English",
    },
    {
      name: "isMultiRepo",
      label: "멀티 레포지토리 여부",
      type: "boolean",
      required: false,
      description:
        "하나의 워크스페이스에서 여러 프로젝트/저장소를 관리하는 경우 활성화합니다.",
      default: false,
    },
    {
      name: "additionalContext",
      label: "추가 컨텍스트",
      type: "textarea",
      required: false,
      description:
        "팀 규칙, 특수 요구사항, 참고 사항 등 추가 정보를 자유롭게 입력하세요.",
      placeholder: "팀원 5명, 2주 스프린트 주기, Jira 연동 필요",
    },
    {
      name: "plannedTasks",
      label: "예정된 주요 작업",
      type: "tags",
      required: false,
      description: "이 워크스페이스에서 수행할 주요 작업 목록입니다.",
      placeholder: "사용자 인증 구현, API 설계, 데이터베이스 스키마 정의",
      default: [],
    },
    {
      name: "force",
      label: "기존 파일 덮어쓰기",
      type: "boolean",
      required: false,
      description:
        "이미 존재하는 파일을 덮어쓸지 여부입니다. false이면 기존 파일을 건너뜁니다.",
      default: false,
    },
  ];

  const conversationalGuide = buildConversationalGuide(
    requiredFields,
    optionalFields
  );
  const cliPromptGuide = buildCliPromptGuide(requiredFields, optionalFields);

  return {
    formId: "workspace-init",
    formTitle: "워크스페이스 초기화",
    formDescription:
      "VS Code 워크스페이스에 문서 거버넌스, Copilot 지침, 프로젝트 구조를 설정합니다. " +
      "필수 입력값을 먼저 받고, 선택 입력값은 기본값이 적용됩니다.",
    version: "1.0.0",
    sections: [
      {
        id: "required",
        title: "📋 필수 입력",
        description: "워크스페이스 초기화에 반드시 필요한 정보입니다.",
        fields: requiredFields,
      },
      {
        id: "optional",
        title: "⚙️ 선택 입력",
        description:
          "입력하지 않으면 기본값이 적용됩니다. 프로젝트에 맞게 커스터마이징하세요.",
        fields: optionalFields,
      },
    ],
    conversationalGuide,
    cliPromptGuide,
  };
}

// ---------------------------------------------------------------------------
// Guide builders for different environments
// ---------------------------------------------------------------------------

function buildConversationalGuide(
  required: FormField[],
  optional: FormField[]
): string {
  const reqLines = required
    .map(
      (f) =>
        `### ${f.label} (필수)\n${f.description}\n${f.placeholder ? `> 예시: ${f.placeholder}` : ""}`
    )
    .join("\n\n");

  const optLines = optional
    .map((f) => {
      const defaultNote =
        f.default !== undefined ? ` (기본값: ${JSON.stringify(f.default)})` : "";
      return `- **${f.label}**${defaultNote}: ${f.description}`;
    })
    .join("\n");

  return `# 워크스페이스 초기화 안내

아래 정보를 입력해 주시면 맞춤형 워크스페이스를 설정해 드리겠습니다.

## 📋 필수 정보 (반드시 입력)

${reqLines}

## ⚙️ 선택 정보 (입력하지 않으면 기본값 적용)

${optLines}

---
필수 정보만 입력하셔도 되며, 선택 정보는 나중에 수정할 수 있습니다.
가능한 한 **목적(purpose)** 을 구체적으로 작성해 주시면 더 나은 결과를 얻을 수 있습니다.`;
}

function buildCliPromptGuide(
  required: FormField[],
  optional: FormField[]
): string {
  const reqLines = required
    .map((f) => `  ${f.name} (필수): ${f.description}`)
    .join("\n");
  const optLines = optional
    .map((f) => {
      const def =
        f.default !== undefined ? ` [기본: ${JSON.stringify(f.default)}]` : "";
      return `  ${f.name}${def}: ${f.description}`;
    })
    .join("\n");

  return `workspace-init-mcp — 워크스페이스 초기화

필수 입력:
${reqLines}

선택 입력:
${optLines}`;
}
