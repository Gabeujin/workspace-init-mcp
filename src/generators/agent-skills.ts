/**
 * Generator for Agent Skills files (.github/skills/ and .github/agents/)
 *
 * Produces SKILL.md files following the open Agent Skills standard (agentskills.io)
 * and .agent.md files for GitHub Copilot agent mode.
 *
 * @see https://agentskills.io
 */

import { type WorkspaceInitParams, type GeneratedFile } from "../types.js";
import {
  type AgentEntry,
  type SkillEntry,
  recommendAgentSkills,
} from "../data/agent-skills-registry.js";

// ─── SKILL.md Content Builders ────────────────────────────────────────────

function buildSkillMd(skill: SkillEntry): string {
  const frontmatter = [
    "---",
    `name: "${skill.name}"`,
    `description: "${skill.description}"`,
    `argument-hint: "Describe what you need for ${skill.name.toLowerCase()}"`,
    `user-invokable: true`,
    `disable-model-invocation: false`,
    "---",
  ].join("\n");

  const body = buildSkillBody(skill);

  return `${frontmatter}\n\n${body}\n`;
}

function buildSkillBody(skill: SkillEntry): string {
  // Generate instructions based on category
  const sections: string[] = [];

  sections.push(`# ${skill.name}\n`);
  sections.push(`${skill.description}\n`);

  // Category-specific instructions
  if (skill.categories.includes("blueprint")) {
    sections.push(buildBlueprintInstructions(skill));
  } else if (skill.categories.includes("document-gen")) {
    sections.push(buildDocGenInstructions(skill));
  } else if (skill.categories.includes("testing")) {
    sections.push(buildTestingInstructions(skill));
  } else if (skill.categories.includes("git")) {
    sections.push(buildGitInstructions(skill));
  } else if (skill.categories.includes("devops")) {
    sections.push(buildDevOpsInstructions(skill));
  } else if (skill.categories.includes("code-gen")) {
    sections.push(buildCodeGenInstructions(skill));
  } else if (skill.categories.includes("refactor")) {
    sections.push(buildRefactorInstructions(skill));
  } else if (skill.categories.includes("analysis")) {
    sections.push(buildAnalysisInstructions(skill));
  } else if (skill.categories.includes("mcp")) {
    sections.push(buildMcpInstructions(skill));
  } else if (skill.categories.includes("project-setup")) {
    sections.push(buildProjectSetupInstructions(skill));
  } else if (skill.categories.includes("prompt")) {
    sections.push(buildPromptInstructions(skill));
  } else {
    sections.push(buildGenericInstructions(skill));
  }

  return sections.join("\n");
}

function buildBlueprintInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Analyze the current workspace to understand the project structure, tech stack, and conventions
2. Identify key patterns, dependencies, and architectural decisions
3. Generate a comprehensive blueprint document that captures:
   - Project overview and purpose
   - Technical architecture and design patterns
   - Key conventions and standards
   - Dependency map and relationships
4. Output the blueprint in a structured, consumable format

## Output Format

Create a well-structured Markdown document with clear sections, diagrams (where applicable using Mermaid), and actionable guidance.

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildDocGenInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Understand the context and purpose of the document to be generated
2. Analyze the workspace for relevant information (code, configs, existing docs)
3. Follow established documentation standards and templates
4. Generate the document with:
   - Clear structure and headings
   - Accurate technical details
   - Actionable content
   - Proper formatting (Markdown)
5. Validate the output against quality criteria

## Quality Criteria

- Accurate and up-to-date information
- Clear, concise writing
- Proper formatting and structure
- Appropriate level of detail for the target audience

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildTestingInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Analyze the code under test to understand its behavior and edge cases
2. Determine the appropriate testing strategy (unit, integration, E2E)
3. Generate test cases covering:
   - Happy path scenarios
   - Edge cases and boundary conditions
   - Error handling paths
   - Input validation
4. Follow testing best practices:
   - Arrange-Act-Assert pattern
   - Descriptive test names
   - Isolated and independent tests
   - Proper mocking and stubbing

## Test Framework Convention

Use the project's established testing framework. If none exists, recommend based on the tech stack.

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildGitInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Follow the project's established Git workflow conventions
2. Ensure commit messages follow the conventional commit format when applicable
3. Reference relevant issues or tickets in messages
4. Keep changes atomic and focused

## Conventional Commit Format

\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildDevOpsInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Follow infrastructure-as-code principles
2. Ensure configurations are reproducible and version-controlled
3. Apply security best practices (least privilege, secret management)
4. Document operational procedures and runbooks
5. Consider observability (logging, monitoring, alerting)

## Best Practices

- Use multi-stage builds for containers
- Implement health checks and readiness probes
- Follow the 12-factor app methodology
- Automate everything that can be automated

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildCodeGenInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Analyze requirements and existing code patterns in the workspace
2. Follow the project's established coding conventions
3. Generate clean, maintainable code that follows SOLID principles
4. Include proper error handling, logging, and documentation
5. Add appropriate tests for generated code

## Code Quality Standards

- Follow DRY (Don't Repeat Yourself) principle
- Use meaningful variable and function names
- Keep functions small and focused (SRP)
- Add JSDoc/docstring comments for public APIs

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildRefactorInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Identify code smells and areas for improvement
2. Create a refactoring plan with prioritized changes
3. Apply refactoring patterns:
   - Extract method/class for large functions
   - Replace conditionals with polymorphism
   - Simplify complex expressions
   - Remove dead code and duplication
4. Ensure all tests pass before and after refactoring
5. Make incremental changes with clear commit messages

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildAnalysisInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Systematically analyze the target (code, architecture, performance, etc.)
2. Identify patterns, issues, and opportunities
3. Provide evidence-based findings
4. Recommend actionable improvements with priority levels
5. Document analysis methodology and results

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildMcpInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Follow the Model Context Protocol (MCP) specification
2. Use the latest MCP SDK APIs (registerTool, registerPrompt, registerResource)
3. Define proper Zod schemas for tool parameters
4. Implement proper error handling and validation
5. Follow stdio transport conventions

## MCP Best Practices

- Use descriptive tool names and descriptions
- Validate all inputs with Zod schemas
- Return structured, parseable responses
- Keep tools focused — one responsibility per tool

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildProjectSetupInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Analyze the project type and requirements
2. Set up appropriate project structure and configuration
3. Apply consistent coding standards and formatting rules
4. Configure development environment tools
5. Create necessary configuration files

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildPromptInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Analyze the target prompt or instruction
2. Apply prompt engineering best practices:
   - Clear, specific instructions
   - Structured format with sections
   - Examples where helpful
   - Constraints and guardrails
3. Optimize for the target AI model or workflow
4. Test and iterate on the prompt

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildGenericInstructions(skill: SkillEntry): string {
  return `## Instructions

Follow best practices for ${skill.name.toLowerCase()}.
Analyze the workspace context before taking action.
Provide structured, actionable output.

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

// ─── Agent .agent.md Content Builder ──────────────────────────────────────

function buildAgentMd(agent: AgentEntry): string {
  const frontmatter = [
    "---",
    `name: "${agent.name}"`,
    `description: "${agent.description}"`,
    `tools: []`,
    "---",
  ].join("\n");

  const body = buildAgentBody(agent);

  return `${frontmatter}\n\n${body}\n`;
}

function buildAgentBody(agent: AgentEntry): string {
  const sections: string[] = [];

  sections.push(`# ${agent.name}\n`);
  sections.push(`${agent.description}\n`);

  // Category-specific agent instructions
  if (agent.categories.includes("planning")) {
    sections.push(`## Approach

1. **Analyze** — Understand the full context before proposing solutions
2. **Plan** — Break down complex tasks into manageable steps
3. **Document** — Record decisions and rationale
4. **Execute** — Implement the plan step by step
5. **Review** — Validate results against requirements
`);
  }

  if (agent.categories.includes("engineering")) {
    sections.push(`## Engineering Standards

- Write clean, maintainable, well-documented code
- Follow SOLID principles and design patterns
- Ensure proper error handling and logging
- Write tests alongside implementation
- Consider performance and scalability
`);
  }

  if (agent.categories.includes("debugging")) {
    sections.push(`## Debugging Methodology

1. **Assess** — Reproduce and understand the problem
2. **Investigate** — Identify root cause through systematic analysis
3. **Resolve** — Apply minimal, targeted fix
4. **QA** — Verify fix and check for regressions
`);
  }

  if (agent.categories.includes("testing")) {
    sections.push(`## Testing Philosophy

- Prioritize test reliability over coverage numbers
- Test behavior, not implementation details
- Use meaningful test descriptions
- Maintain fast feedback loops
`);
  }

  if (agent.categories.includes("devops")) {
    sections.push(`## DevOps Principles

- Infrastructure as Code (IaC)
- Automate repetitive operations
- Monitor, measure, improve (DORA metrics)
- Security-first approach
`);
  }

  if (agent.categories.includes("review")) {
    sections.push(`## Review Criteria

- Code correctness and completeness
- Adherence to project conventions
- Performance implications
- Security considerations
- Test coverage and quality
`);
  }

  if (agent.categories.includes("documentation")) {
    sections.push(`## Documentation Standards

- Write for the target audience
- Keep content accurate and up-to-date
- Use consistent formatting and terminology
- Include examples and references
`);
  }

  if (agent.categories.includes("architecture")) {
    sections.push(`## Architecture Guidelines

- Keep components loosely coupled
- Define clear boundaries and interfaces
- Document architectural decisions (ADR)
- Consider system quality attributes (scalability, reliability, security)
`);
  }

  if (agent.categories.includes("security")) {
    sections.push(`## Security Focus

- Review for OWASP Top 10 vulnerabilities
- Validate input at all boundaries
- Follow least privilege principle
- Audit dependency security
`);
  }

  if (agent.categories.includes("meta")) {
    sections.push(`## Meta-Agent Capabilities

- Orchestrate and coordinate multi-step workflows
- Analyze and optimize processes
- Generate and refine agent/skill configurations
`);
  }

  // Tags section
  sections.push(`## Specialization Tags\n`);
  sections.push(agent.tags.map((t) => `- \`${t}\``).join("\n"));

  return sections.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Generate agent skills files based on project type and tech stack.
 * Automatically recommends and generates appropriate skills and agents.
 */
export function generateAgentSkills(
  params: WorkspaceInitParams,
  options?: {
    /** Specific skill IDs to install (overrides auto-recommendation) */
    skillIds?: string[];
    /** Specific agent IDs to install (overrides auto-recommendation) */
    agentIds?: string[];
    /** User intent string for recommendation tuning */
    userIntent?: string;
    /** Maximum agents to include (default: 8) */
    maxAgents?: number;
    /** Maximum skills to include (default: 12) */
    maxSkills?: number;
  }
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Get recommendation
  const { agents, skills } = recommendAgentSkills({
    projectType: params.projectType ?? "other",
    techStack: params.techStack ?? [],
    userIntent: options?.userIntent ?? params.purpose ?? "",
    maxAgents: options?.maxAgents ?? 8,
    maxSkills: options?.maxSkills ?? 12,
  });

  // Generate SKILL.md files → .github/skills/<id>/SKILL.md
  for (const skill of skills) {
    files.push({
      relativePath: `.github/skills/${skill.id}/SKILL.md`,
      content: buildSkillMd(skill),
    });
  }

  // Generate .agent.md files → .github/agents/<id>.agent.md
  for (const agent of agents) {
    files.push({
      relativePath: `.github/agents/${agent.id}.agent.md`,
      content: buildAgentMd(agent),
    });
  }

  // Generate index/registry file
  files.push(generateSkillsIndex(agents, skills, params));

  return files;
}

/**
 * Generate specific skills by IDs.
 */
export function generateSelectedSkills(
  skillEntries: SkillEntry[],
  agentEntries: AgentEntry[]
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  for (const skill of skillEntries) {
    files.push({
      relativePath: `.github/skills/${skill.id}/SKILL.md`,
      content: buildSkillMd(skill),
    });
  }

  for (const agent of agentEntries) {
    files.push({
      relativePath: `.github/agents/${agent.id}.agent.md`,
      content: buildAgentMd(agent),
    });
  }

  return files;
}

/**
 * Generate an index file listing all installed skills and agents.
 */
function generateSkillsIndex(
  agents: AgentEntry[],
  skills: SkillEntry[],
  params: WorkspaceInitParams
): GeneratedFile {
  const skillsList = skills
    .map((s) => `| [\`${s.id}\`](skills/${s.id}/SKILL.md) | ${s.name} | ${s.description} | ${s.categories.join(", ")} |`)
    .join("\n");

  const agentsList = agents
    .map((a) => `| [\`${a.id}\`](agents/${a.id}.agent.md) | ${a.name} | ${a.description} | ${a.categories.join(", ")} |`)
    .join("\n");

  const content = `# Agent Skills & Agents Registry

> Auto-generated by workspace-init-mcp for **${params.workspaceName}**
> Project type: ${params.projectType ?? "other"} | Tech: ${params.techStack?.join(", ") || "미지정"}

## Installed Skills (${skills.length})

| ID | Name | Description | Categories |
|---|---|---|---|
${skillsList}

## Installed Agents (${agents.length})

| ID | Name | Description | Categories |
|---|---|---|---|
${agentsList}

## Skill Discovery

Skills are discovered automatically by compatible AI tools:
- **VS Code Copilot**: Reads from \`.github/skills/\`
- **Claude Code**: Reads from \`.claude/skills/\` or \`.github/skills/\`
- **Cursor**: Reads from \`.cursor/skills/\` or \`.github/skills/\`
- **OpenHands**: Reads from \`.agents/skills/\` or \`.github/skills/\`

## Adding New Skills

Create a new directory under \`.github/skills/\` with a \`SKILL.md\` file:

\`\`\`
.github/skills/
  my-custom-skill/
    SKILL.md          # Required: skill definition
    references/       # Optional: reference documents
    templates/        # Optional: template files
    scripts/          # Optional: automation scripts
    examples/         # Optional: usage examples
\`\`\`

### SKILL.md Format

\`\`\`markdown
---
name: "My Custom Skill"
description: "What this skill does"
argument-hint: "How to invoke this skill"
user-invokable: true
disable-model-invocation: false
---

# My Custom Skill

Instructions for the AI agent...
\`\`\`

## References

- [Agent Skills Standard](https://agentskills.io)
- [VS Code Agent Skills Docs](https://code.visualstudio.com/docs/copilot/chat/agent-skills)
- [awesome-copilot](https://github.com/github/awesome-copilot)
`;

  return {
    relativePath: ".github/AGENT-SKILLS.md",
    content,
  };
}
