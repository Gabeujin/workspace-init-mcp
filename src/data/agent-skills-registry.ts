/**
 * Agent Skills Registry — Indexed dictionary of awesome-copilot agents & skills
 *
 * Built from github/awesome-copilot repository analysis.
 * Each entry includes metadata for intelligent recommendation based on
 * project type, tech stack, and user intent.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentCategory =
  | "planning"
  | "architecture"
  | "engineering"
  | "debugging"
  | "testing"
  | "devops"
  | "documentation"
  | "review"
  | "security"
  | "data"
  | "frontend"
  | "backend"
  | "mobile"
  | "cloud"
  | "creative"
  | "meta"
  | "platform";

export type SkillCategory =
  | "blueprint"
  | "document-gen"
  | "code-gen"
  | "testing"
  | "devops"
  | "migration"
  | "refactor"
  | "git"
  | "mcp"
  | "platform"
  | "analysis"
  | "prompt"
  | "project-setup"
  | "infrastructure";

export interface AgentEntry {
  /** File name without .agent.md extension */
  id: string;
  /** Display name from frontmatter */
  name: string;
  /** Description from frontmatter */
  description: string;
  /** Categorization for recommendation */
  categories: AgentCategory[];
  /** Tags for flexible matching */
  tags: string[];
  /** Which project types this agent is most relevant for */
  relevantProjectTypes: string[];
  /** Tech stack keywords this agent specializes in */
  techKeywords: string[];
  /** Priority (1=core, 2=recommended, 3=specialized) */
  priority: number;
}

export interface SkillEntry {
  /** Directory name (= SKILL.md name field) */
  id: string;
  /** Display name */
  name: string;
  /** Description from frontmatter */
  description: string;
  /** Categorization for recommendation */
  categories: SkillCategory[];
  /** Tags for flexible matching */
  tags: string[];
  /** Which project types this skill is most relevant for */
  relevantProjectTypes: string[];
  /** Tech stack keywords */
  techKeywords: string[];
  /** Whether the skill has additional resources (scripts, templates, etc.) */
  hasResources: boolean;
  /** Priority (1=core, 2=recommended, 3=specialized) */
  priority: number;
}

// ---------------------------------------------------------------------------
// Agent Registry
// ---------------------------------------------------------------------------

export const AGENT_REGISTRY: AgentEntry[] = [
  // ── Planning & Architecture ──
  {
    id: "plan",
    name: "Plan Mode",
    description: "Strategic planning and architecture assistant focused on thoughtful analysis before implementation",
    categories: ["planning"],
    tags: ["planning", "strategy", "analysis", "think-first"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 1,
  },
  {
    id: "planner",
    name: "Planner",
    description: "Task planning and breakdown assistant",
    categories: ["planning"],
    tags: ["planning", "task-breakdown", "workflow"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 1,
  },
  {
    id: "task-planner",
    name: "Task Planner",
    description: "Detailed task planning with dependency tracking",
    categories: ["planning"],
    tags: ["planning", "tasks", "dependencies"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "context-architect",
    name: "Context Architect",
    description: "Plans and executes multi-file changes by identifying relevant context and dependencies",
    categories: ["architecture", "planning"],
    tags: ["architecture", "context-map", "dependencies", "multi-file"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 1,
  },
  {
    id: "repo-architect",
    name: "Repo Architect",
    description: "Bootstraps and validates agentic project structures for GitHub Copilot workflows",
    categories: ["architecture", "meta"],
    tags: ["scaffolding", "repo-structure", "agents", "skills"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 1,
  },
  {
    id: "arch",
    name: "Architecture",
    description: "Software architecture design and review",
    categories: ["architecture"],
    tags: ["architecture", "design-patterns", "system-design"],
    relevantProjectTypes: ["web-app", "api", "library", "monorepo"],
    techKeywords: [],
    priority: 1,
  },
  {
    id: "blueprint-mode",
    name: "Blueprint Mode",
    description: "Comprehensive project blueprint generation",
    categories: ["architecture", "planning"],
    tags: ["blueprint", "architecture", "comprehensive"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "implementation-plan",
    name: "Implementation Plan",
    description: "Detailed implementation planning for features and changes",
    categories: ["planning"],
    tags: ["implementation", "planning", "features"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  // ── Engineering ──
  {
    id: "principal-software-engineer",
    name: "Principal Software Engineer",
    description: "Principal-level engineering guidance with focus on engineering excellence and pragmatic implementation",
    categories: ["engineering", "review"],
    tags: ["best-practices", "clean-code", "solid", "design-patterns", "tech-debt"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 1,
  },
  {
    id: "software-engineer-agent-v1",
    name: "Software Engineer Agent",
    description: "General-purpose software engineering assistant",
    categories: ["engineering"],
    tags: ["coding", "implementation", "general"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "expert-nextjs-developer",
    name: "Expert Next.js Developer",
    description: "Specialized Next.js development assistance",
    categories: ["engineering", "frontend"],
    tags: ["nextjs", "react", "ssr", "fullstack"],
    relevantProjectTypes: ["web-app"],
    techKeywords: ["Next.js", "React", "TypeScript"],
    priority: 2,
  },
  {
    id: "expert-react-frontend-engineer",
    name: "Expert React Frontend Engineer",
    description: "Expert React frontend development",
    categories: ["engineering", "frontend"],
    tags: ["react", "frontend", "components", "state-management"],
    relevantProjectTypes: ["web-app"],
    techKeywords: ["React", "TypeScript", "JavaScript"],
    priority: 2,
  },
  {
    id: "expert-cpp-software-engineer",
    name: "Expert C++ Software Engineer",
    description: "C++ development expertise",
    categories: ["engineering"],
    tags: ["cpp", "systems", "performance"],
    relevantProjectTypes: ["library"],
    techKeywords: ["C++"],
    priority: 3,
  },
  {
    id: "expert-dotnet-software-engineer",
    name: "Expert .NET Software Engineer",
    description: ".NET development expertise",
    categories: ["engineering"],
    tags: ["dotnet", "csharp", "aspnet"],
    relevantProjectTypes: ["web-app", "api"],
    techKeywords: [".NET", "C#", "ASP.NET"],
    priority: 2,
  },
  {
    id: "api-architect",
    name: "API Architect",
    description: "API design and architecture specialist",
    categories: ["architecture", "backend"],
    tags: ["api", "rest", "graphql", "openapi"],
    relevantProjectTypes: ["api"],
    techKeywords: [],
    priority: 1,
  },
  // ── Debugging ──
  {
    id: "debug",
    name: "Debug Mode",
    description: "Systematic debugging with 4-phase approach: assess, investigate, resolve, QA",
    categories: ["debugging"],
    tags: ["debugging", "troubleshooting", "root-cause"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 1,
  },
  // ── Testing ──
  {
    id: "playwright-tester",
    name: "Playwright Tester",
    description: "E2E testing with Playwright",
    categories: ["testing"],
    tags: ["e2e", "playwright", "browser-testing"],
    relevantProjectTypes: ["web-app"],
    techKeywords: ["Playwright", "TypeScript"],
    priority: 2,
  },
  {
    id: "polyglot-test-builder",
    name: "Polyglot Test Builder",
    description: "Multi-language test generation and management",
    categories: ["testing"],
    tags: ["testing", "polyglot", "multi-language"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "tdd-red",
    name: "TDD Red Phase",
    description: "Write failing tests first (Red phase of TDD)",
    categories: ["testing"],
    tags: ["tdd", "red", "test-first"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "tdd-green",
    name: "TDD Green Phase",
    description: "Make tests pass with minimal code (Green phase of TDD)",
    categories: ["testing"],
    tags: ["tdd", "green", "implementation"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "tdd-refactor",
    name: "TDD Refactor Phase",
    description: "Refactor code while keeping tests green",
    categories: ["testing"],
    tags: ["tdd", "refactor", "clean-code"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  // ── DevOps ──
  {
    id: "devops-expert",
    name: "DevOps Expert",
    description: "DevOps specialist following the infinity loop principle with focus on automation",
    categories: ["devops"],
    tags: ["devops", "cicd", "automation", "monitoring", "dora"],
    relevantProjectTypes: ["devops", "api", "web-app"],
    techKeywords: ["Docker", "Kubernetes", "Terraform"],
    priority: 1,
  },
  {
    id: "platform-sre-kubernetes",
    name: "Platform SRE Kubernetes",
    description: "Kubernetes platform engineering and SRE",
    categories: ["devops", "cloud"],
    tags: ["kubernetes", "sre", "platform", "reliability"],
    relevantProjectTypes: ["devops"],
    techKeywords: ["Kubernetes", "Docker"],
    priority: 2,
  },
  {
    id: "github-actions-expert",
    name: "GitHub Actions Expert",
    description: "GitHub Actions CI/CD pipeline specialist",
    categories: ["devops"],
    tags: ["github-actions", "cicd", "workflows"],
    relevantProjectTypes: ["*"],
    techKeywords: ["GitHub Actions"],
    priority: 2,
  },
  {
    id: "terraform",
    name: "Terraform",
    description: "Terraform infrastructure as code specialist",
    categories: ["devops", "cloud"],
    tags: ["terraform", "iac", "infrastructure"],
    relevantProjectTypes: ["devops"],
    techKeywords: ["Terraform", "HCL"],
    priority: 2,
  },
  // ── Documentation ──
  {
    id: "se-technical-writer",
    name: "Technical Writer",
    description: "Technical documentation writing specialist",
    categories: ["documentation"],
    tags: ["documentation", "technical-writing", "api-docs"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 1,
  },
  {
    id: "gem-documentation-writer",
    name: "Documentation Writer",
    description: "Documentation generation and management",
    categories: ["documentation"],
    tags: ["documentation", "writing", "markdown"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  // ── Review & Quality ──
  {
    id: "gem-reviewer",
    name: "Code Reviewer",
    description: "Code review assistant",
    categories: ["review"],
    tags: ["code-review", "quality", "standards"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 1,
  },
  {
    id: "se-security-reviewer",
    name: "Security Reviewer",
    description: "Security-focused code review",
    categories: ["review", "security"],
    tags: ["security", "review", "vulnerabilities"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "se-system-architecture-reviewer",
    name: "System Architecture Reviewer",
    description: "System architecture review and assessment",
    categories: ["review", "architecture"],
    tags: ["architecture", "review", "assessment"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "critical-thinking",
    name: "Critical Thinking",
    description: "Challenges assumptions and encourages deeper analysis",
    categories: ["review"],
    tags: ["critical-thinking", "analysis", "assumptions"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "devils-advocate",
    name: "Devil's Advocate",
    description: "Challenges decisions to strengthen solutions",
    categories: ["review"],
    tags: ["devils-advocate", "challenge", "robustness"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 3,
  },
  // ── Prompt & Meta ──
  {
    id: "prompt-engineer",
    name: "Prompt Engineer",
    description: "Analyzes and improves prompts following OpenAI best practices",
    categories: ["meta"],
    tags: ["prompt-engineering", "optimization", "llm"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "meta-agentic-project-scaffold",
    name: "Meta Agentic Project Scaffold",
    description: "Meta-agent for pulling and organizing agentic project structures",
    categories: ["meta"],
    tags: ["meta", "scaffolding", "agents", "organization"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "custom-agent-foundry",
    name: "Custom Agent Foundry",
    description: "Create custom agent definitions",
    categories: ["meta"],
    tags: ["agent-creation", "customization", "meta"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 3,
  },
  // ── MCP Experts ──
  {
    id: "typescript-mcp-expert",
    name: "TypeScript MCP Expert",
    description: "TypeScript MCP server development specialist",
    categories: ["engineering", "backend"],
    tags: ["mcp", "typescript", "server"],
    relevantProjectTypes: ["api", "library"],
    techKeywords: ["TypeScript", "MCP"],
    priority: 2,
  },
  {
    id: "python-mcp-expert",
    name: "Python MCP Expert",
    description: "Python MCP server development specialist",
    categories: ["engineering", "backend"],
    tags: ["mcp", "python", "server"],
    relevantProjectTypes: ["api", "data-science"],
    techKeywords: ["Python", "MCP"],
    priority: 3,
  },
  // ── Cloud/Azure ──
  {
    id: "azure-principal-architect",
    name: "Azure Principal Architect",
    description: "Azure cloud architecture and best practices",
    categories: ["cloud", "architecture"],
    tags: ["azure", "cloud", "architecture", "well-architected"],
    relevantProjectTypes: ["devops", "api", "web-app"],
    techKeywords: ["Azure"],
    priority: 2,
  },
  // ── Data ──
  {
    id: "ms-sql-dba",
    name: "MS SQL DBA",
    description: "Microsoft SQL Server database administration",
    categories: ["data"],
    tags: ["sql", "database", "mssql", "dba"],
    relevantProjectTypes: ["api", "data-science"],
    techKeywords: ["SQL Server", "MSSQL"],
    priority: 3,
  },
  {
    id: "postgresql-dba",
    name: "PostgreSQL DBA",
    description: "PostgreSQL database administration and optimization",
    categories: ["data"],
    tags: ["postgresql", "database", "optimization"],
    relevantProjectTypes: ["api", "data-science"],
    techKeywords: ["PostgreSQL"],
    priority: 3,
  },
  // ── Frontend Frameworks ──
  {
    id: "electron-angular-native",
    name: "Electron Angular Native",
    description: "Electron with Angular desktop application development",
    categories: ["frontend", "engineering"],
    tags: ["electron", "angular", "desktop"],
    relevantProjectTypes: ["web-app"],
    techKeywords: ["Electron", "Angular"],
    priority: 3,
  },
  // ── Mobile ──
  {
    id: "dotnet-maui",
    name: ".NET MAUI",
    description: ".NET MAUI cross-platform mobile/desktop development",
    categories: ["mobile", "engineering"],
    tags: ["maui", "dotnet", "mobile", "cross-platform"],
    relevantProjectTypes: ["mobile"],
    techKeywords: [".NET", "MAUI"],
    priority: 2,
  },
  // ── Creative/Content ──
  {
    id: "prd",
    name: "PRD",
    description: "Product Requirements Document generator",
    categories: ["planning", "documentation"],
    tags: ["prd", "requirements", "product"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "specification",
    name: "Specification",
    description: "Technical specification document generator",
    categories: ["planning", "documentation"],
    tags: ["specification", "requirements", "technical"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  // ── Orchestration ──
  {
    id: "gem-orchestrator",
    name: "Orchestrator",
    description: "Multi-agent workflow orchestration",
    categories: ["meta"],
    tags: ["orchestrator", "workflow", "multi-agent"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "gem-implementer",
    name: "Implementer",
    description: "Code implementation from plans",
    categories: ["engineering"],
    tags: ["implementation", "coding"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "gem-researcher",
    name: "Researcher",
    description: "Technical research and analysis",
    categories: ["planning"],
    tags: ["research", "analysis", "investigation"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 2,
  },
  // ── Beast Mode / Advanced ──
  {
    id: "4.1-Beast",
    name: "GPT-4.1 Beast Mode",
    description: "Maximum performance agent with advanced reasoning and comprehensive capabilities",
    categories: ["engineering", "meta"],
    tags: ["beast-mode", "advanced", "comprehensive", "gpt-4.1"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 3,
  },
  {
    id: "mentor",
    name: "Mentor",
    description: "Learning and mentorship guidance",
    categories: ["documentation"],
    tags: ["mentor", "learning", "guidance", "education"],
    relevantProjectTypes: ["learning"],
    techKeywords: [],
    priority: 2,
  },
  {
    id: "janitor",
    name: "Janitor",
    description: "Code cleanup and maintenance",
    categories: ["review"],
    tags: ["cleanup", "maintenance", "refactor"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    priority: 3,
  },
];

// ---------------------------------------------------------------------------
// Skill Registry
// ---------------------------------------------------------------------------

export const SKILL_REGISTRY: SkillEntry[] = [
  // ── Blueprint Generators ──
  {
    id: "copilot-instructions-blueprint-generator",
    name: "Copilot Instructions Blueprint",
    description: "Technology-agnostic blueprint generator for copilot-instructions.md files",
    categories: ["blueprint", "project-setup"],
    tags: ["copilot", "instructions", "blueprint", "standards"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "folder-structure-blueprint-generator",
    name: "Folder Structure Blueprint",
    description: "Analyzes and documents project folder structures with visualization",
    categories: ["blueprint", "project-setup"],
    tags: ["folder-structure", "blueprint", "visualization"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "technology-stack-blueprint-generator",
    name: "Technology Stack Blueprint",
    description: "Analyzes codebases to create detailed technology stack documentation",
    categories: ["blueprint", "analysis"],
    tags: ["tech-stack", "blueprint", "analysis", "documentation"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "architecture-blueprint-generator",
    name: "Architecture Blueprint",
    description: "Generates comprehensive architecture documentation",
    categories: ["blueprint"],
    tags: ["architecture", "blueprint", "documentation"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "readme-blueprint-generator",
    name: "README Blueprint",
    description: "Generates comprehensive README documentation blueprints",
    categories: ["blueprint", "document-gen"],
    tags: ["readme", "blueprint", "documentation"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  {
    id: "code-exemplars-blueprint-generator",
    name: "Code Exemplars Blueprint",
    description: "Generates code example blueprints for documentation",
    categories: ["blueprint"],
    tags: ["code-examples", "blueprint", "documentation"],
    relevantProjectTypes: ["library"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  {
    id: "project-workflow-analysis-blueprint-generator",
    name: "Project Workflow Blueprint",
    description: "Analyzes and documents project workflow patterns",
    categories: ["blueprint", "analysis"],
    tags: ["workflow", "blueprint", "analysis"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  // ── Document Generators ──
  {
    id: "create-specification",
    name: "Create Specification",
    description: "Creates specification files optimized for AI consumption",
    categories: ["document-gen"],
    tags: ["specification", "requirements", "ai-optimized"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "create-implementation-plan",
    name: "Create Implementation Plan",
    description: "Creates deterministic, machine-readable implementation plans",
    categories: ["document-gen"],
    tags: ["implementation", "planning", "tasks"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "create-readme",
    name: "Create README",
    description: "Creates professional README.md files",
    categories: ["document-gen"],
    tags: ["readme", "documentation", "github"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "create-agentsmd",
    name: "Create AGENTS.md",
    description: "Creates AGENTS.md — an open-format README for agents",
    categories: ["document-gen", "project-setup"],
    tags: ["agents.md", "agent-config", "documentation"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "create-architectural-decision-record",
    name: "Create ADR",
    description: "Creates Architectural Decision Records for AI-optimized decision documentation",
    categories: ["document-gen"],
    tags: ["adr", "architecture", "decisions"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "create-llms",
    name: "Create LLMs.txt",
    description: "Creates LLMs.txt file for AI context",
    categories: ["document-gen", "project-setup"],
    tags: ["llms.txt", "ai-context", "documentation"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  {
    id: "prd",
    name: "Product Requirements Document",
    description: "Creates Product Requirements Documents (PRD)",
    categories: ["document-gen"],
    tags: ["prd", "requirements", "product"],
    relevantProjectTypes: ["web-app", "api", "mobile"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  // ── Git & Workflow ──
  {
    id: "conventional-commit",
    name: "Conventional Commit",
    description: "Generates standardized conventional commit messages",
    categories: ["git"],
    tags: ["commit", "conventional", "git", "workflow"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "git-commit",
    name: "Git Commit",
    description: "Git commit message helper",
    categories: ["git"],
    tags: ["commit", "git"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  {
    id: "git-flow-branch-creator",
    name: "Git Flow Branch Creator",
    description: "Creates branches following Git Flow naming conventions",
    categories: ["git"],
    tags: ["git-flow", "branching", "naming"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  // ── Code Generation ──
  {
    id: "generate-custom-instructions-from-codebase",
    name: "Generate Custom Instructions",
    description: "Generates migration/evolution instructions by analyzing codebase differences",
    categories: ["code-gen", "migration"],
    tags: ["instructions", "migration", "evolution", "codebase-analysis"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "typescript-mcp-server-generator",
    name: "TypeScript MCP Server Generator",
    description: "Generates TypeScript MCP server scaffolding",
    categories: ["mcp", "code-gen"],
    tags: ["mcp", "typescript", "server", "scaffolding"],
    relevantProjectTypes: ["api", "library"],
    techKeywords: ["TypeScript", "MCP"],
    hasResources: false,
    priority: 2,
  },
  {
    id: "python-mcp-server-generator",
    name: "Python MCP Server Generator",
    description: "Generates Python MCP server scaffolding",
    categories: ["mcp", "code-gen"],
    tags: ["mcp", "python", "server"],
    relevantProjectTypes: ["api", "data-science"],
    techKeywords: ["Python", "MCP"],
    hasResources: false,
    priority: 3,
  },
  {
    id: "create-spring-boot-java-project",
    name: "Spring Boot Java Project",
    description: "Creates Spring Boot Java project scaffolding",
    categories: ["code-gen"],
    tags: ["spring-boot", "java", "scaffolding"],
    relevantProjectTypes: ["api", "web-app"],
    techKeywords: ["Java", "Spring Boot"],
    hasResources: false,
    priority: 3,
  },
  {
    id: "create-spring-boot-kotlin-project",
    name: "Spring Boot Kotlin Project",
    description: "Creates Spring Boot Kotlin project scaffolding",
    categories: ["code-gen"],
    tags: ["spring-boot", "kotlin", "scaffolding"],
    relevantProjectTypes: ["api"],
    techKeywords: ["Kotlin", "Spring Boot"],
    hasResources: false,
    priority: 3,
  },
  {
    id: "create-web-form",
    name: "Create Web Form",
    description: "Generates web form components",
    categories: ["code-gen"],
    tags: ["form", "web", "components"],
    relevantProjectTypes: ["web-app"],
    techKeywords: ["HTML", "CSS", "JavaScript"],
    hasResources: false,
    priority: 3,
  },
  // ── Testing ──
  {
    id: "playwright-generate-test",
    name: "Playwright Test Generator",
    description: "Generates Playwright E2E test scenarios",
    categories: ["testing"],
    tags: ["playwright", "e2e", "test-generation"],
    relevantProjectTypes: ["web-app"],
    techKeywords: ["Playwright", "TypeScript"],
    hasResources: false,
    priority: 2,
  },
  {
    id: "polyglot-test-agent",
    name: "Polyglot Test Agent",
    description: "Multi-language test generation",
    categories: ["testing"],
    tags: ["testing", "polyglot", "multi-language"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: true,
    priority: 2,
  },
  {
    id: "pytest-coverage",
    name: "Pytest Coverage",
    description: "Python test coverage analysis with pytest",
    categories: ["testing"],
    tags: ["pytest", "coverage", "python"],
    relevantProjectTypes: ["api", "data-science"],
    techKeywords: ["Python", "pytest"],
    hasResources: false,
    priority: 3,
  },
  {
    id: "webapp-testing",
    name: "Web App Testing",
    description: "Web application testing strategy and execution",
    categories: ["testing"],
    tags: ["testing", "web", "strategy"],
    relevantProjectTypes: ["web-app"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  // ── DevOps ──
  {
    id: "multi-stage-dockerfile",
    name: "Multi-Stage Dockerfile",
    description: "Creates optimized multi-stage Dockerfiles",
    categories: ["devops", "infrastructure"],
    tags: ["docker", "dockerfile", "multi-stage", "optimization"],
    relevantProjectTypes: ["devops", "api", "web-app"],
    techKeywords: ["Docker"],
    hasResources: false,
    priority: 2,
  },
  {
    id: "devops-rollout-plan",
    name: "DevOps Rollout Plan",
    description: "Creates deployment rollout plans",
    categories: ["devops"],
    tags: ["deployment", "rollout", "planning"],
    relevantProjectTypes: ["devops"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  {
    id: "containerize-aspnetcore",
    name: "Containerize ASP.NET Core",
    description: "Containerizes ASP.NET Core applications",
    categories: ["devops"],
    tags: ["container", "docker", "aspnet"],
    relevantProjectTypes: ["api", "web-app"],
    techKeywords: ["ASP.NET", ".NET", "Docker"],
    hasResources: false,
    priority: 3,
  },
  // ── Refactoring ──
  {
    id: "refactor",
    name: "Refactor",
    description: "Code refactoring guidance and execution",
    categories: ["refactor"],
    tags: ["refactor", "code-quality", "improvement"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "refactor-plan",
    name: "Refactor Plan",
    description: "Creates refactoring plans",
    categories: ["refactor"],
    tags: ["refactor", "planning", "strategy"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  // ── Analysis ──
  {
    id: "context-map",
    name: "Context Map",
    description: "Creates context maps for codebases",
    categories: ["analysis"],
    tags: ["context", "mapping", "understanding"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "what-context-needed",
    name: "What Context Needed",
    description: "Identifies what context is needed for a task",
    categories: ["analysis"],
    tags: ["context", "analysis", "planning"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  // ── Prompt Engineering ──
  {
    id: "prompt-builder",
    name: "Prompt Builder",
    description: "Builds and optimizes prompts",
    categories: ["prompt"],
    tags: ["prompt", "optimization", "engineering"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  {
    id: "boost-prompt",
    name: "Boost Prompt",
    description: "Enhances and improves existing prompts",
    categories: ["prompt"],
    tags: ["prompt", "enhancement", "improvement"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 3,
  },
  // ── Project Setup ──
  {
    id: "editorconfig",
    name: "EditorConfig",
    description: "Creates .editorconfig files for consistent coding styles",
    categories: ["project-setup"],
    tags: ["editorconfig", "coding-style", "consistency"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 1,
  },
  {
    id: "create-github-action-workflow-specification",
    name: "GitHub Actions Workflow",
    description: "Creates GitHub Actions workflow specifications",
    categories: ["devops", "project-setup"],
    tags: ["github-actions", "ci", "workflow"],
    relevantProjectTypes: ["*"],
    techKeywords: ["GitHub Actions"],
    hasResources: false,
    priority: 2,
  },
  {
    id: "finalize-agent-prompt",
    name: "Finalize Agent Prompt",
    description: "Finalizes and polishes agent prompt definitions",
    categories: ["prompt", "project-setup"],
    tags: ["agent", "prompt", "finalization"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: false,
    priority: 2,
  },
  // ── Migration ──
  {
    id: "dotnet-upgrade",
    name: ".NET Upgrade",
    description: ".NET framework/version upgrade assistance",
    categories: ["migration"],
    tags: ["dotnet", "upgrade", "migration"],
    relevantProjectTypes: ["web-app", "api"],
    techKeywords: [".NET", "C#"],
    hasResources: false,
    priority: 3,
  },
  // ── Platform Specific ──
  {
    id: "excalidraw-diagram-generator",
    name: "Excalidraw Diagram Generator",
    description: "Generates Excalidraw diagrams with templates for various diagram types",
    categories: ["document-gen"],
    tags: ["excalidraw", "diagrams", "visualization"],
    relevantProjectTypes: ["*"],
    techKeywords: [],
    hasResources: true,
    priority: 3,
  },
  {
    id: "aspire",
    name: ".NET Aspire",
    description: ".NET Aspire cloud-native application development",
    categories: ["platform"],
    tags: ["aspire", "dotnet", "cloud-native"],
    relevantProjectTypes: ["api", "web-app"],
    techKeywords: [".NET", "Aspire"],
    hasResources: true,
    priority: 3,
  },
];

// ---------------------------------------------------------------------------
// Recommendation Engine
// ---------------------------------------------------------------------------

export interface RecommendationResult {
  /** Agents recommended for this project */
  agents: AgentEntry[];
  /** Skills recommended for this project */
  skills: SkillEntry[];
  /** Human-readable summary */
  summary: string;
}

/**
 * Recommend agents and skills based on project type, tech stack, and user intent.
 */
export function recommendAgentSkills(options: {
  projectType?: string;
  techStack?: string[];
  userIntent?: string;
  maxAgents?: number;
  maxSkills?: number;
}): RecommendationResult {
  const {
    projectType = "other",
    techStack = [],
    userIntent = "",
    maxAgents = 10,
    maxSkills = 15,
  } = options;

  const intentLower = userIntent.toLowerCase();
  const techLower = techStack.map((t) => t.toLowerCase());

  // Score agents
  const scoredAgents = AGENT_REGISTRY.map((agent) => {
    let score = 0;

    // Project type match
    if (
      agent.relevantProjectTypes.includes("*") ||
      agent.relevantProjectTypes.includes(projectType)
    ) {
      score += 10;
    }

    // Tech stack match
    for (const keyword of agent.techKeywords) {
      if (techLower.some((t) => t.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(t))) {
        score += 5;
      }
    }

    // Intent/tag match
    for (const tag of agent.tags) {
      if (intentLower.includes(tag)) {
        score += 3;
      }
    }

    // Priority bonus
    score += (4 - agent.priority) * 2;

    return { agent, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxAgents)
    .map((s) => s.agent);

  // Score skills
  const scoredSkills = SKILL_REGISTRY.map((skill) => {
    let score = 0;

    if (
      skill.relevantProjectTypes.includes("*") ||
      skill.relevantProjectTypes.includes(projectType)
    ) {
      score += 10;
    }

    for (const keyword of skill.techKeywords) {
      if (techLower.some((t) => t.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(t))) {
        score += 5;
      }
    }

    for (const tag of skill.tags) {
      if (intentLower.includes(tag)) {
        score += 3;
      }
    }

    score += (4 - skill.priority) * 2;

    return { skill, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSkills)
    .map((s) => s.skill);

  // Build summary
  const agentList = scoredAgents
    .map((a) => `  - **${a.name}** (\`${a.id}\`): ${a.description}`)
    .join("\n");
  const skillList = scoredSkills
    .map((s) => `  - **${s.name}** (\`${s.id}\`): ${s.description}`)
    .join("\n");

  const summary = `
🤖 추천 Agent Skills (프로젝트: ${projectType}, 기술: ${techStack.join(", ") || "미지정"})

## 추천 에이전트 (${scoredAgents.length}개)
${agentList || "  없음"}

## 추천 스킬 (${scoredSkills.length}개)
${skillList || "  없음"}

💡 선택한 항목을 \`install_agent_skills\` 도구로 설치하면
\`.github/skills/\` 및 \`.github/agents/\` 에 자동 배포됩니다.
`.trim();

  return { agents: scoredAgents, skills: scoredSkills, summary };
}

/**
 * Search agents and skills by free-text query.
 */
export function searchAgentSkills(query: string): RecommendationResult {
  const q = query.toLowerCase();

  const matchedAgents = AGENT_REGISTRY.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.tags.some((t) => t.includes(q)) ||
      a.categories.some((c) => c.includes(q))
  );

  const matchedSkills = SKILL_REGISTRY.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.includes(q)) ||
      s.categories.some((c) => c.includes(q))
  );

  const agentList = matchedAgents
    .map((a) => `  - **${a.name}** (\`${a.id}\`): ${a.description}`)
    .join("\n");
  const skillList = matchedSkills
    .map((s) => `  - **${s.name}** (\`${s.id}\`): ${s.description}`)
    .join("\n");

  const summary = `
🔍 검색 결과: "${query}"

## 에이전트 (${matchedAgents.length}개)
${agentList || "  없음"}

## 스킬 (${matchedSkills.length}개)
${skillList || "  없음"}
`.trim();

  return { agents: matchedAgents, skills: matchedSkills, summary };
}

/**
 * Get all unique categories across agents and skills.
 */
export function listCategories(): {
  agentCategories: AgentCategory[];
  skillCategories: SkillCategory[];
} {
  const agentCats = new Set<AgentCategory>();
  const skillCats = new Set<SkillCategory>();

  for (const a of AGENT_REGISTRY) a.categories.forEach((c) => agentCats.add(c));
  for (const s of SKILL_REGISTRY) s.categories.forEach((c) => skillCats.add(c));

  return {
    agentCategories: [...agentCats].sort(),
    skillCategories: [...skillCats].sort(),
  };
}
