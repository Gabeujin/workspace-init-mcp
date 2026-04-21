/**
 * Type definitions for workspace-init-mcp.
 */

/** Supported project types that determine template generation strategy. */
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
  | "consulting"
  | "ecommerce"
  | "fintech"
  | "healthcare"
  | "saas"
  | "iot"
  | "other";

/** Supported file encodings for generated files. */
export type FileEncoding = "utf-8" | "utf-8-bom" | "ascii" | "latin1";

/** Supported target IDEs for Agent Skills path generation. */
export type TargetIDE = "vscode" | "cursor" | "claude-code" | "openhands";

/** Supported line ending styles. */
export type LineEnding = "lf" | "crlf" | "auto";

/** Harness governance strictness. */
export type GovernanceProfile = "standard" | "strict" | "regulated";

/** How much autonomy the workspace gives to AI execution. */
export type AutonomyMode = "guided" | "balanced" | "autonomous";

/** Token usage strategy for long-running work. */
export type TokenBudget = "lean" | "balanced" | "thorough";

/** Input parameters for workspace initialization. */
export interface WorkspaceInitParams {
  /** Name of the workspace. */
  workspaceName: string;

  /** Primary purpose and goals of this workspace. */
  purpose: string;

  /** Absolute path to the workspace root directory. */
  workspacePath: string;

  /** Type of project. */
  projectType?: ProjectType;

  /** Technology stack, for example ["TypeScript", "React", "Node.js"]. */
  techStack?: string[];

  /** Language for documentation. */
  docLanguage?: string;

  /** Language for code comments. */
  codeCommentLanguage?: string;

  /** Whether this workspace manages multiple projects or repositories. */
  isMultiRepo?: boolean;

  /** Additional context or special requirements. */
  additionalContext?: string;

  /** Key workflows or tasks planned for this workspace. */
  plannedTasks?: string[];

  /** Whether to include Agent Skills. */
  includeAgentSkills?: boolean;

  /** User intent for agent skill recommendation tuning. */
  agentSkillsIntent?: string;

  /** File encoding for generated files. */
  fileEncoding?: FileEncoding;

  /** Target IDEs for Agent Skills file generation. */
  targetIDEs?: TargetIDE[];

  /** Line ending style for generated files. */
  lineEnding?: LineEnding;

  /** Whether to generate AI harness engineering files. */
  includeHarnessEngineering?: boolean;

  /** Long-running execution profile for the generated harness. */
  harnessProfile?: "lean" | "balanced" | "regulated" | "autonomous";

  /** Governance strictness for agent work. */
  governanceProfile?: GovernanceProfile;

  /** Desired autonomy level for the workspace. */
  autonomyMode?: AutonomyMode;

  /** Token usage strategy for the workspace. */
  tokenBudget?: TokenBudget;

  /** Primary domains that the workspace needs to coordinate. */
  primaryDomains?: string[];
}

/** Result of a single file generation. */
export interface GeneratedFile {
  /** Relative path from workspace root. */
  relativePath: string;

  /** File content. */
  content: string;
}

/** Summary of the initialization result. */
export interface InitResult {
  /** Total files created. */
  filesCreated: number;

  /** List of generated file paths. */
  generatedFiles: string[];

  /** Human-readable summary. */
  summary: string;
}

/** Project type metadata for template generation. */
export interface ProjectTypeConfig {
  label: string;
  description: string;
  defaultTechStack: string[];
  docSections: string[];
  extraInstructions: string[];
}

/** Map of project type to template configuration. */
export const PROJECT_TYPE_CONFIGS: Record<ProjectType, ProjectTypeConfig> = {
  learning: {
    label: "Learning",
    description: "Practice, study, experimentation, and personal knowledge capture",
    defaultTechStack: [],
    docSections: ["learning-notes"],
    extraInstructions: [
      "Separate learning notes from prototype or production-grade code.",
      "Record what was learned, not just what was built.",
      "Prefer explanations in the user's working language while keeping technical terms precise.",
    ],
  },
  "web-app": {
    label: "Web Application",
    description: "Frontend or full-stack web application delivery",
    defaultTechStack: ["HTML", "CSS", "JavaScript"],
    docSections: ["api-docs", "component-docs"],
    extraInstructions: [
      "Prefer component-driven design and clear UI boundaries.",
      "Treat accessibility and responsive behavior as baseline requirements.",
      "Plan SEO, analytics, and content performance when relevant.",
    ],
  },
  api: {
    label: "API Service",
    description: "Backend service, platform API, or integration layer",
    defaultTechStack: ["Node.js"],
    docSections: ["api-docs"],
    extraInstructions: [
      "Clarify API versioning, auth boundaries, and error contracts early.",
      "Document request and response expectations with examples.",
      "Prefer explicit validation at every external boundary.",
    ],
  },
  mobile: {
    label: "Mobile App",
    description: "Native or cross-platform mobile product development",
    defaultTechStack: [],
    docSections: ["design-docs"],
    extraInstructions: [
      "Respect platform-specific UX conventions.",
      "Plan offline behavior, battery use, and device constraints.",
      "Document platform-specific tradeoffs and validation steps.",
    ],
  },
  "data-science": {
    label: "Data Science",
    description: "Data analysis, ML workflows, experimentation, and model delivery",
    defaultTechStack: ["Python", "Jupyter"],
    docSections: ["experiment-logs", "dataset-docs"],
    extraInstructions: [
      "Keep experiments reproducible with environment and seed notes.",
      "Track dataset assumptions, lineage, and versioning explicitly.",
      "Document evaluation metrics, baselines, and decision criteria.",
    ],
  },
  devops: {
    label: "DevOps / Infrastructure",
    description: "CI/CD, operations, infrastructure, and reliability engineering",
    defaultTechStack: ["Docker", "Kubernetes"],
    docSections: ["infra-docs", "runbooks"],
    extraInstructions: [
      "Treat infrastructure as code and keep operations reproducible.",
      "Write runbooks and escalation guidance for critical workflows.",
      "Plan observability, alerting, and rollback paths with every major change.",
    ],
  },
  creative: {
    label: "Creative / Content",
    description: "Writing, content pipelines, narrative work, and media-heavy projects",
    defaultTechStack: ["Markdown"],
    docSections: ["drafts", "references"],
    extraInstructions: [
      "Track versions of major content artifacts and editorial decisions.",
      "Keep references and source material organized and attributable.",
      "Document feedback and revision rationale, not just final outputs.",
    ],
  },
  library: {
    label: "Library / Package",
    description: "Reusable package, SDK, framework extension, or shared component library",
    defaultTechStack: [],
    docSections: ["api-docs"],
    extraInstructions: [
      "Protect public API compatibility and document breaking changes clearly.",
      "Follow semantic versioning and publish migration notes when needed.",
      "Include examples and integration guidance for downstream users.",
    ],
  },
  monorepo: {
    label: "Monorepo",
    description: "Multiple packages or services coordinated in one repository",
    defaultTechStack: [],
    docSections: ["package-docs"],
    extraInstructions: [
      "Document package boundaries and shared ownership clearly.",
      "Track cross-package dependency changes and blast radius carefully.",
      "Prefer isolated build, test, and release paths when practical.",
    ],
  },
  consulting: {
    label: "Consulting / Delivery",
    description: "Client-facing planning, delivery, reporting, and governance-heavy execution",
    defaultTechStack: ["Markdown", "Excel"],
    docSections: ["proposal-docs", "deliverables", "meeting-notes"],
    extraInstructions: [
      "Track deliverables, decisions, and stakeholder communication explicitly.",
      "Keep work breakdown structures and risks current.",
      "Make approval points and scope boundaries visible throughout delivery.",
    ],
  },
  ecommerce: {
    label: "Ecommerce",
    description: "Commerce flows, catalogs, checkout, payments, and order management",
    defaultTechStack: ["TypeScript", "Node.js"],
    docSections: ["api-docs", "design-docs"],
    extraInstructions: [
      "Treat checkout, pricing, inventory, and fulfillment as high-risk domains.",
      "Validate security and fraud-sensitive paths with extra care.",
      "Document state transitions and failure recovery for orders and payments.",
    ],
  },
  fintech: {
    label: "Fintech",
    description: "Financial systems, payment flows, regulated data, and transaction-heavy products",
    defaultTechStack: ["Java", "Spring Boot"],
    docSections: ["api-docs", "compliance-docs", "audit-logs"],
    extraInstructions: [
      "Preserve auditability and traceability for all critical decisions and changes.",
      "Treat numeric precision, transaction integrity, and rollback safety as core requirements.",
      "Document compliance assumptions and control points explicitly.",
    ],
  },
  healthcare: {
    label: "Healthcare",
    description: "Healthcare systems, patient or clinical data workflows, and regulated integrations",
    defaultTechStack: ["Python", "TypeScript"],
    docSections: ["api-docs", "compliance-docs"],
    extraInstructions: [
      "Treat privacy, access control, and auditability as first-class concerns.",
      "Document sensitive data handling and integration standards clearly.",
      "Prefer safe defaults, explicit approvals, and traceable workflows.",
    ],
  },
  saas: {
    label: "SaaS",
    description: "Subscription-based multi-tenant software platforms",
    defaultTechStack: ["TypeScript", "Node.js", "React"],
    docSections: ["api-docs", "infra-docs", "design-docs"],
    extraInstructions: [
      "Document tenant boundaries, configuration surfaces, and billing assumptions.",
      "Plan for scale, isolation, and operational support as product requirements.",
      "Track customer-facing reliability and rollout risks explicitly.",
    ],
  },
  iot: {
    label: "IoT / Embedded",
    description: "Connected devices, edge software, telemetry, and hardware-adjacent systems",
    defaultTechStack: ["C", "Python", "MQTT"],
    docSections: ["infra-docs", "api-docs", "device-docs"],
    extraInstructions: [
      "Document device constraints, connectivity assumptions, and recovery behavior.",
      "Plan firmware, telemetry, and backend coordination together.",
      "Treat rollout safety and field recoverability as design requirements.",
    ],
  },
  other: {
    label: "Other",
    description: "Custom project type with user-defined goals and operating model",
    defaultTechStack: [],
    docSections: [],
    extraInstructions: [],
  },
};
