/**
 * MCP Prompts for workspace-init-mcp
 *
 * Prompts are the MCP-standard way to present user-facing forms.
 * When a user selects a prompt in Claude Desktop, VSCode Copilot,
 * GPT Desktop, or any MCP-compatible client, the client renders
 * the prompt arguments as interactive form fields.
 *
 * We define:
 * 1. workspace-init        — Full guided initialization form
 * 2. workspace-quick-start — Minimal form with just required fields
 * 3. workspace-analyze     — Analyze existing workspace and suggest config
 */

import { z } from "zod";
import { type ProjectType, PROJECT_TYPE_CONFIGS } from "../types.js";
import { buildInitFormSchema } from "../tools/form-schema.js";

// ---------------------------------------------------------------------------
// Prompt: workspace-init (Full Form)
// ---------------------------------------------------------------------------

export const WORKSPACE_INIT_PROMPT = {
  name: "workspace-init",
  description:
    "워크스페이스 초기화를 위한 전체 설정 폼입니다. 필수/선택 입력값을 안내받고 맞춤형 워크스페이스를 생성합니다.",
} as const;

export const WORKSPACE_INIT_ARGS = {
  workspaceName: z
    .string()
    .describe("워크스페이스 이름 (프로젝트 식별용, 파일명/제목에 사용)"),
  purpose: z
    .string()
    .describe(
      "프로젝트의 주요 목적과 목표를 구체적으로 작성해 주세요 (상세할수록 좋은 결과)"
    ),
  workspacePath: z
    .string()
    .describe(
      "워크스페이스 루트 디렉토리의 절대 경로 (예: C:\\projects\\my-project)"
    ),
  projectType: z
    .string()
    .optional()
    .describe(
      "프로젝트 유형: learning, web-app, api, mobile, data-science, devops, creative, library, monorepo, consulting, ecommerce, fintech, healthcare, saas, iot, other"
    ),
  primaryDomains: z
    .string()
    .optional()
    .describe(
      '주요 도메인 (쉼표로 구분, 예: "learning, curriculum, assessment" 또는 "product, platform, security, data")'
    ),
  techStack: z
    .string()
    .optional()
    .describe(
      '기술 스택 (쉼표로 구분, 예: "TypeScript, React, Node.js")'
    ),
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
    .describe(
      '예정된 주요 작업 (쉼표로 구분, 예: "인증 구현, API 설계, DB 스키마")'
    ),
  harnessProfile: z
    .string()
    .optional()
    .describe('하네스 프로필: lean, balanced, regulated, autonomous (고위험 결제/개인정보/의료/금융은 regulated 권장)'),
  governanceProfile: z
    .string()
    .optional()
    .describe('거버넌스 엄격도: standard, strict, regulated'),
  autonomyMode: z
    .string()
    .optional()
    .describe('AI 실행 자율성: guided, balanced, autonomous'),
  tokenBudget: z
    .string()
    .optional()
    .describe('토큰 사용 전략: lean, balanced, thorough'),
  domainStressProfile: z
    .string()
    .optional()
    .describe(
      '도메인 스트레스 프로필 이름 또는 ID (예: Learning Growth Harness, research-review-harness, identity-commerce-operations)'
    ),
  legacyAdoptionProfile: z
    .string()
    .optional()
    .describe(
      "레거시 도입/현대화 정보: 기존 엔티티, 라우트, 위험 흐름, TO-BE 제품 아키타입, 마이그레이션 목표"
    ),
};

export function buildWorkspaceInitMessages(args: Record<string, string>) {
  const techStack = args.techStack
    ? args.techStack.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const plannedTasks = args.plannedTasks
    ? args.plannedTasks.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const primaryDomains = args.primaryDomains
    ? args.primaryDomains.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const additionalContext = [
    args.additionalContext,
    args.domainStressProfile
      ? `Domain stress profile: ${args.domainStressProfile}. Open docs/ai-harness/domain-stress-playbooks.md after initialization and copy the matching profile into the first plan, chunk contract, dashboard event, and evaluator prompt.`
      : "",
    args.legacyAdoptionProfile
      ? `Legacy adoption profile: ${args.legacyAdoptionProfile}. Treat existing source as protected and produce an AS-IS/TO-BE modernization preflight before implementation.`
      : "",
  ]
    .filter((entry) => entry != null && entry.trim().length > 0)
    .join("\n\n");

  const isMultiRepo = args.isMultiRepo === "true";

  const configSummary = `
## 입력된 설정

| 항목 | 값 |
|---|---|
| 워크스페이스 이름 | ${args.workspaceName} |
| 목적 | ${args.purpose} |
| 경로 | ${args.workspacePath} |
| 프로젝트 유형 | ${args.projectType ?? "other (기본)"} |
| 주요 도메인 | ${primaryDomains?.join(", ") ?? "미지정"} |
| 기술 스택 | ${techStack?.join(", ") ?? "미지정"} |
| 문서 언어 | ${args.docLanguage ?? "한국어 (기본)"} |
| 코드 주석 언어 | ${args.codeCommentLanguage ?? "English (기본)"} |
| 멀티 레포 | ${isMultiRepo ? "예" : "아니오"} |
| 하네스 프로필 | ${args.harnessProfile ?? "balanced (기본)"} |
| 거버넌스 | ${args.governanceProfile ?? "strict (기본)"} |
| 자율성 | ${args.autonomyMode ?? "balanced (기본)"} |
| 토큰 전략 | ${args.tokenBudget ?? "balanced (기본)"} |
| 도메인 스트레스 프로필 | ${args.domainStressProfile ?? "없음"} |
| 레거시 도입 정보 | ${args.legacyAdoptionProfile ?? "없음"} |
| 추가 컨텍스트 | ${additionalContext || "없음"} |
| 예정 작업 | ${plannedTasks?.join(", ") ?? "없음"} |
`.trim();

  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `위 설정으로 워크스페이스를 초기화해 주세요.

${configSummary}

\`initialize_workspace\` 도구를 호출하여 다음 파라미터로 실행해 주세요:
- workspaceName: "${args.workspaceName}"
- purpose: "${args.purpose}"
- workspacePath: "${args.workspacePath}"
${args.projectType ? `- projectType: "${args.projectType}"` : ""}
${primaryDomains ? `- primaryDomains: ${JSON.stringify(primaryDomains)}` : ""}
${techStack ? `- techStack: ${JSON.stringify(techStack)}` : ""}
${args.docLanguage ? `- docLanguage: "${args.docLanguage}"` : ""}
${args.codeCommentLanguage ? `- codeCommentLanguage: "${args.codeCommentLanguage}"` : ""}
- isMultiRepo: ${isMultiRepo}
${args.harnessProfile ? `- harnessProfile: "${args.harnessProfile}"` : ""}
${args.governanceProfile ? `- governanceProfile: "${args.governanceProfile}"` : ""}
${args.autonomyMode ? `- autonomyMode: "${args.autonomyMode}"` : ""}
${args.tokenBudget ? `- tokenBudget: "${args.tokenBudget}"` : ""}
${args.domainStressProfile ? `- domainStressProfile: "${args.domainStressProfile}"` : ""}
${args.legacyAdoptionProfile ? `- legacyAdoptionProfile: ${JSON.stringify(args.legacyAdoptionProfile)}` : ""}
${additionalContext ? `- additionalContext: ${JSON.stringify(additionalContext)}` : ""}
${plannedTasks ? `- plannedTasks: ${JSON.stringify(plannedTasks)}` : ""}

초기화 후 반드시 \`docs/ai-harness/domain-stress-playbooks.md\`를 열고, 해당 도메인 프로필의 actors / critical surfaces / mandatory evidence를 첫 계획서와 평가 프롬프트에 반영해 주세요.`,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Prompt: workspace-quick-start (Minimal)
// ---------------------------------------------------------------------------

export const WORKSPACE_QUICK_START_PROMPT = {
  name: "workspace-quick-start",
  description:
    "최소 필수 정보만으로 빠르게 워크스페이스를 초기화합니다. 선택 항목은 자동 감지됩니다.",
} as const;

export const WORKSPACE_QUICK_START_ARGS = {
  workspaceName: z
    .string()
    .describe("워크스페이스 이름"),
  purpose: z
    .string()
    .describe("프로젝트 목적 (한 줄 요약도 OK)"),
  workspacePath: z
    .string()
    .describe("워크스페이스 경로 (절대 경로)"),
};

export function buildQuickStartMessages(args: Record<string, string>) {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `워크스페이스를 빠르게 초기화해 주세요.

- 이름: ${args.workspaceName}
- 목적: ${args.purpose}
- 경로: ${args.workspacePath}

먼저 \`analyze_workspace\` 도구로 경로를 분석하여 프로젝트 유형과 기술 스택을 자동 감지해 주세요.
기존 앱 소스, 라우트, DB, CRUD 화면, 배포 흔적이 발견되면 바로 초기화하지 말고 레거시 도입 프리플라이트를 제안한 뒤, protected source root를 보존하는 설정으로 \`initialize_workspace\`를 실행해 주세요.
신규 프로젝트라면 감지된 설정에 \`primaryDomains\`와 도메인 스트레스 프로필을 추가한 뒤 \`initialize_workspace\`를 실행해 주세요.`,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Prompt: workspace-analyze (Analysis)
// ---------------------------------------------------------------------------

export const WORKSPACE_ANALYZE_PROMPT = {
  name: "workspace-analyze",
  description:
    "기존 프로젝트 디렉토리를 분석하여 프로젝트 유형, 기술 스택, 초기화 상태를 파악합니다.",
} as const;

export const WORKSPACE_ANALYZE_ARGS = {
  workspacePath: z
    .string()
    .describe("분석할 워크스페이스 경로 (절대 경로)"),
};

export function buildAnalyzeMessages(args: Record<string, string>) {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `다음 워크스페이스를 분석해 주세요: ${args.workspacePath}

1. \`analyze_workspace\` 도구로 프로젝트 구조를 분석해 주세요.
2. \`validate_workspace\` 도구로 초기화 상태를 확인해 주세요.
3. 기존 앱이면 AS-IS 엔티티/라우트/데이터/위험 흐름을 요약하고 레거시 현대화 adoption profile을 제안해 주세요.
4. 신규 앱이면 primaryDomains, 도메인 스트레스 프로필, 고위험 evidence gate를 제안해 주세요.
5. 분석 결과를 바탕으로 초기화가 필요하면 추천 설정을 알려주세요.`,
        },
      },
    ],
  };
}
