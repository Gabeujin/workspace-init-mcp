/**
 * Type definitions for workspace-init-mcp
 */

/** Supported project types that determine template generation strategy */
export type ProjectType =
  | "learning"
  | "web-app"
  | "api"
  | "mobile"
  | "data-science"
  | "devops"
  | "creative"
  | "library"
  | "monorepo"
  | "other";

/** Input parameters for workspace initialization */
export interface WorkspaceInitParams {
  /** Name of the workspace (used in file names, headings) */
  workspaceName: string;

  /** Primary purpose and goals of this workspace */
  purpose: string;

  /** Absolute path to the workspace root directory */
  workspacePath: string;

  /** Type of project — affects template generation */
  projectType?: ProjectType;

  /** Technology stack (e.g., ["TypeScript", "React", "Node.js"]) */
  techStack?: string[];

  /** Language for documentation (default: "한국어") */
  docLanguage?: string;

  /** Language for code comments (default: "English") */
  codeCommentLanguage?: string;

  /** Whether this workspace manages multiple projects/repos */
  isMultiRepo?: boolean;

  /** Additional context or special requirements */
  additionalContext?: string;

  /** Key workflows or tasks planned for this workspace */
  plannedTasks?: string[];

  /** Whether to include Agent Skills (.github/skills/ and .github/agents/) */
  includeAgentSkills?: boolean;

  /** User intent for agent skill recommendation tuning */
  agentSkillsIntent?: string;
}

/** Result of a single file generation */
export interface GeneratedFile {
  /** Relative path from workspace root */
  relativePath: string;

  /** File content */
  content: string;
}

/** Summary of the initialization result */
export interface InitResult {
  /** Total files created */
  filesCreated: number;

  /** List of generated file paths (relative) */
  generatedFiles: string[];

  /** Human-readable summary */
  summary: string;
}

/** Project type metadata for template generation */
export interface ProjectTypeConfig {
  label: string;
  description: string;
  defaultTechStack: string[];
  docSections: string[];
  extraInstructions: string[];
}

/** Map of project type to its configuration */
export const PROJECT_TYPE_CONFIGS: Record<ProjectType, ProjectTypeConfig> = {
  learning: {
    label: "학습/자기개발",
    description: "학습 자료, 실습, 결과물의 문서화 및 이력 관리",
    defaultTechStack: [],
    docSections: ["learning-notes"],
    extraInstructions: [
      "학습 자료와 실습 코드를 체계적으로 구분하여 관리합니다.",
      "학습 진행률과 이해도를 문서에 기록합니다.",
      "핵심 개념은 자신의 언어로 재정리합니다.",
    ],
  },
  "web-app": {
    label: "웹 애플리케이션",
    description: "프론트엔드/풀스택 웹 애플리케이션 개발",
    defaultTechStack: ["HTML", "CSS", "JavaScript"],
    docSections: ["api-docs", "component-docs"],
    extraInstructions: [
      "컴포넌트 기반 설계를 우선합니다.",
      "접근성(a11y) 가이드라인을 준수합니다.",
      "반응형 디자인을 기본으로 적용합니다.",
      "SEO 최적화를 고려합니다.",
    ],
  },
  api: {
    label: "API 서버",
    description: "백엔드 API 서버 개발",
    defaultTechStack: ["Node.js"],
    docSections: ["api-docs"],
    extraInstructions: [
      "RESTful 또는 GraphQL 설계 원칙을 따릅니다.",
      "API 버전 관리 전략을 수립합니다.",
      "인증/인가 체계를 명확히 설계합니다.",
      "API 문서 (OpenAPI/Swagger)를 자동 생성합니다.",
    ],
  },
  mobile: {
    label: "모바일 앱",
    description: "iOS/Android 모바일 애플리케이션 개발",
    defaultTechStack: [],
    docSections: ["design-docs"],
    extraInstructions: [
      "플랫폼별 UI/UX 가이드라인을 준수합니다.",
      "오프라인 동작을 고려합니다.",
      "배터리 및 네트워크 사용을 최적화합니다.",
    ],
  },
  "data-science": {
    label: "데이터 사이언스",
    description: "데이터 분석, ML/AI 프로젝트",
    defaultTechStack: ["Python", "Jupyter"],
    docSections: ["experiment-logs", "dataset-docs"],
    extraInstructions: [
      "실험 결과를 재현 가능하도록 시드값과 환경을 기록합니다.",
      "데이터셋 버전 관리를 철저히 합니다.",
      "모델 성능 메트릭을 체계적으로 추적합니다.",
    ],
  },
  devops: {
    label: "DevOps/인프라",
    description: "CI/CD, 인프라 관리, 클라우드 환경 구성",
    defaultTechStack: ["Docker", "Kubernetes"],
    docSections: ["infra-docs", "runbooks"],
    extraInstructions: [
      "인프라를 코드로 관리합니다 (IaC).",
      "장애 대응 런북을 작성합니다.",
      "모니터링·알림 체계를 문서화합니다.",
    ],
  },
  creative: {
    label: "크리에이티브/콘텐츠",
    description: "시나리오, 문서, 콘텐츠 작성 프로젝트",
    defaultTechStack: ["Markdown"],
    docSections: ["drafts", "references"],
    extraInstructions: [
      "콘텐츠 버전 관리를 통해 수정 이력을 추적합니다.",
      "리서치 자료와 참고 출처를 체계적으로 관리합니다.",
      "피드백 반영 내역을 기록합니다.",
    ],
  },
  library: {
    label: "라이브러리/패키지",
    description: "재사용 가능한 라이브러리 또는 패키지 개발",
    defaultTechStack: [],
    docSections: ["api-docs"],
    extraInstructions: [
      "공개 API의 하위 호환성을 최우선으로 고려합니다.",
      "Semantic Versioning을 엄격히 준수합니다.",
      "사용 예제와 API 문서를 철저히 작성합니다.",
      "번들 크기와 의존성을 최소화합니다.",
    ],
  },
  monorepo: {
    label: "모노레포",
    description: "여러 패키지/서비스를 하나의 저장소에서 관리",
    defaultTechStack: [],
    docSections: ["package-docs"],
    extraInstructions: [
      "패키지 간 의존성을 명확히 관리합니다.",
      "공유 코드와 개별 패키지의 경계를 명확히 합니다.",
      "패키지별 독립 빌드·테스트·배포가 가능하도록 구성합니다.",
    ],
  },
  other: {
    label: "기타",
    description: "사용자 정의 프로젝트",
    defaultTechStack: [],
    docSections: [],
    extraInstructions: [],
  },
};
