/**
 * Generator for Agent Skills files and IDE-specific mirrors.
 *
 * Produces SKILL.md files following the open Agent Skills standard (agentskills.io)
 * and .agent.md files for GitHub Copilot agent mode.
 *
 * @see https://agentskills.io
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { type WorkspaceInitParams, type GeneratedFile, type TargetIDE } from "../types.js";
import {
  AGENT_REGISTRY,
  SKILL_REGISTRY,
  buildCatalogIndexes,
  type AgentEntry,
  type CatalogDomainGroup,
  type CatalogRoleGroup,
  type SkillEntry,
  recommendAgentSkills,
} from "../data/agent-skills-registry.js";

// IDE path mapping and curated source locations

/** Directory prefixes for each target IDE */
const IDE_PATH_MAP: Record<TargetIDE, { skills: string; agents: string }> = {
  vscode: { skills: ".github/skills", agents: ".github/agents" },
  cursor: { skills: ".cursor/skills", agents: ".cursor/agents" },
  "claude-code": { skills: ".claude/skills", agents: ".claude/agents" },
  openhands: { skills: ".agents/skills", agents: ".agents/agents" },
};

const CANONICAL_INSTALL_TARGET = {
  label: "canonical-registry",
  skills: ".github/skills",
  agents: ".github/agents",
  canonical: true,
} as const;

const AWESOME_SKILLS_ROOT = fileURLToPath(new URL("../../awesome/skills", import.meta.url));
const AWESOME_AGENTS_ROOT = fileURLToPath(new URL("../../awesome/agents", import.meta.url));

type InstallTarget = {
  label: string;
  skills: string;
  agents: string;
  canonical: boolean;
};

const HARNESS_CORE_SKILL_IDS = [
  "context-map",
  "what-context-needed",
  "agent-governance",
  "harness-governance-manager",
  "harness-documentation-records",
  "harness-dashboard-state-manager",
  "domain-model-ledger",
  "agentic-eval",
  "harness-multi-expert-review",
  "harness-code-review-pipeline",
  "structured-autonomy-plan",
  "harness-implementation-orchestrator",
  "structured-autonomy-implement",
  "harness-post-work-review",
  "remember",
  "memory-merger",
];

const HARNESS_CORE_AGENT_IDS = [
  "plan",
  "context-architect",
  "repo-architect",
  "harness-doc-writer",
  "harness-dashboard-operator",
  "harness-expert-reviewer",
  "harness-implementer",
  "harness-verifier",
  "harness-quality-gate",
  "risk-focused-code-review",
  "principal-software-engineer",
];

function getInstallTargets(params: WorkspaceInitParams): InstallTarget[] {
  const targets: InstallTarget[] = [{ ...CANONICAL_INSTALL_TARGET }];

  for (const ide of params.targetIDEs ?? ["vscode"]) {
    const mapped = IDE_PATH_MAP[ide];
    if (
      targets.some(
        (target) => target.skills === mapped.skills && target.agents === mapped.agents
      )
    ) {
      continue;
    }

    targets.push({
      label: ide,
      skills: mapped.skills,
      agents: mapped.agents,
      canonical: false,
    });
  }

  return targets;
}

function looksBinary(buffer: Buffer): boolean {
  return buffer.includes(0);
}

function readUtf8TextFile(fullPath: string): string | null {
  const buffer = fs.readFileSync(fullPath);
  if (looksBinary(buffer)) {
    return null;
  }
  return buffer.toString("utf-8");
}

function collectCuratedDirectoryFiles(fullPath: string): Array<{
  relativePath: string;
  content: string;
}> {
  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const files: Array<{ relativePath: string; content: string }> = [];

  const visit = (currentPath: string) => {
    const entries = fs
      .readdirSync(currentPath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const content = readUtf8TextFile(entryPath);
      if (content == null) {
        continue;
      }

      files.push({
        relativePath: path.relative(fullPath, entryPath).replace(/\\/g, "/"),
        content,
      });
    }
  };

  visit(fullPath);

  return files;
}

function getCuratedSkillFiles(
  skill: SkillEntry
): Array<{ relativePath: string; content: string }> {
  const curatedFiles = collectCuratedDirectoryFiles(path.join(AWESOME_SKILLS_ROOT, skill.id));
  if (curatedFiles.some((file) => file.relativePath === "SKILL.md")) {
    return curatedFiles;
  }

  return curatedFiles.length > 0
    ? [...curatedFiles, { relativePath: "SKILL.md", content: buildSkillMd(skill) }]
    : [{ relativePath: "SKILL.md", content: buildSkillMd(skill) }];
}

function getAgentMarkdown(agent: AgentEntry): string {
  const curatedPath = path.join(AWESOME_AGENTS_ROOT, `${agent.id}.agent.md`);
  const curated = fs.existsSync(curatedPath) ? readUtf8TextFile(curatedPath) : null;
  return curated ?? buildAgentMd(agent);
}

function buildInstalledAssetFiles(
  skills: SkillEntry[],
  agents: AgentEntry[],
  params: WorkspaceInitParams
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const seenPaths = new Set<string>();
  const installTargets = getInstallTargets(params);
  const curatedSkills = new Map(
    skills.map((skill) => [skill.id, getCuratedSkillFiles(skill)] as const)
  );
  const curatedAgents = new Map(
    agents.map((agent) => [agent.id, getAgentMarkdown(agent)] as const)
  );

  const addFile = (relativePath: string, content: string) => {
    if (seenPaths.has(relativePath)) {
      return;
    }
    seenPaths.add(relativePath);
    files.push({ relativePath, content });
  };

  for (const target of installTargets) {
    for (const skill of skills) {
      for (const file of curatedSkills.get(skill.id) ?? []) {
        addFile(`${target.skills}/${skill.id}/${file.relativePath}`, file.content);
      }
    }

    for (const agent of agents) {
      addFile(`${target.agents}/${agent.id}.agent.md`, curatedAgents.get(agent.id) ?? "");
    }
  }

  return files;
}

// SKILL.md content builders

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
  const customBody = buildCustomSkillBody(skill);
  if (customBody) {
    return customBody;
  }

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
  } else if (skill.categories.includes("governance")) {
    sections.push(buildGovernanceInstructions(skill));
  } else if (skill.categories.includes("memory")) {
    sections.push(buildMemoryInstructions(skill));
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

function buildCustomSkillBody(skill: SkillEntry): string | null {
  switch (skill.id) {
    case "harness-governance-manager":
      return `# ${skill.name}

${skill.description}

## Workflow

1. Open governance first and capture the task goal, scope boundary, assumptions, and success criteria.
2. Run the planning ladder before implementation begins:
   - Plan 1
   - Review 1
   - Plan 2
   - Review 2
   - Plan 3
   - Review 3
3. Freeze the goal only after the third review confirms it is clear and testable.
4. Refresh the context ledger, review ledger, execution plan, and handover notes before coding.
5. Close governance last with verification status, residual risks, and next-step guidance.

## Default Surfaces

- \`.github/ai-harness/harness-manifest.yaml\`
- \`.github/ai-harness/operating-model.md\`
- \`docs/context/\`
- \`docs/reviews/\`
- \`docs/plans/\`
- \`docs/handovers/\`

## Rules

- Keep all generated artifacts UTF-8 safe.
- Prefer clean canonical documents over preserving broken mojibake.
- If the repo already uses \`.governance/\`, maintain compatibility instead of deleting it.
- Do not approve implementation when the goal is still ambiguous.
`;
    case "harness-implementation-orchestrator":
      return `# ${skill.name}

${skill.description}

## Mandatory Sequence

1. Governance open
2. Plan 1
3. Review 1
4. Plan 2
5. Review 2
6. Plan 3
7. Review 3
8. Goal freeze
9. Governance refresh
10. Chunked implementation
11. Verification, code review, and remediation
12. Governance close

## Chunking Rules

- Split the work when the blast radius spans multiple subsystems.
- Split the work when one review pass cannot evaluate the whole change clearly.
- Split the work when interruption would force a future session to reconstruct hidden state.
- Each chunk must have one verifiable outcome and one clear exit condition.

## Delegation Pattern

- Use a focused implementer for the approved chunk.
- Use a verifier for narrow checks and test coverage.
- Use expert reviewers for specialist lenses only when needed.
- Use a documentation writer to keep durable artifacts current.
`;
    case "harness-multi-expert-review":
      return `# ${skill.name}

${skill.description}

## Review Rounds

### Round 1

- generate evaluation criteria from governance artifacts, active plans, workspace conventions, and changed-code patterns
- review from independent expert lenses with isolated context

### Round 2

- merge findings
- remove duplicates
- resolve conflicting advice

### Round 3

- convert findings into the final approved improvement plan
- sequence actions by dependency, risk, and validation order

## Suggested Lenses

- architecture
- frontend
- backend
- security
- data
- operations
- UX and accessibility
- product impact

## Output

- evaluation criteria note
- one artifact per review round
- final improvement plan that implementation can follow without guesswork
`;
    case "harness-code-review-pipeline":
      return `# ${skill.name}

${skill.description}

## Stages

1. Extract task-specific review criteria from the approved plan, review notes, and workspace rules.
2. Run the relevant automated checks:
   - build and type validation
   - linting when configured
   - targeted tests
   - UTF-8 integrity checks for changed text artifacts
3. Review the implementation from an independent perspective.
4. Call out coverage gaps and brittle verification.
5. Re-run the affected checks after remediation.

## Priorities

1. security and data integrity
2. correctness and regressions
3. missing or weak tests
4. maintainability and performance
5. style and consistency

## Exit Rule

Do not close the chunk until critical and important findings are resolved and the relevant checks pass.
`;
    case "harness-documentation-records":
      return `# ${skill.name}

${skill.description}

## Core Rules

1. Create governance-opening records before implementation and completion records after verification.
2. Keep every artifact UTF-8 safe and durable across interrupted sessions.
3. Capture evidence, decisions, verification, and next steps instead of chat-like narration.
4. Record chunk boundaries so future sessions can resume safely.

## Document Types

- governance-opening note
- plan and review record
- chunk work log
- final record
- AS-IS vs TO-BE comparison
- handover note

## Required Fields

- goal and scope boundary
- affected files, modules, or services
- decisions and rationale
- verification status
- open risks and follow-up work

## Completion Standard

- another contributor can resume from the record alone
- the record points to the latest plan, review, and verification artifacts
`;
    case "service-endpoint-tracer":
      return `# ${skill.name}

${skill.description}

## Trace Procedure

1. Start from the strongest known identifier:
   - service ID
   - URL or route
   - controller method
   - service method
   - mapper or SQL ID
2. Follow the call chain one layer at a time.
3. Separate confirmed links from inferred links.
4. Record evidence for each hop and call out the blast radius.

## Output

- entry point
- trace path
- supporting evidence
- impacted layers
- open questions
- verification suggestions
`;
    case "message-resource-lookup":
      return `# ${skill.name}

${skill.description}

## Lookup Modes

- ID to text
- text to candidate IDs
- file to referenced message IDs
- message ID to usage locations

## Procedure

1. Search the primary resource source first.
2. Search code references second.
3. Group exact matches and fuzzy matches separately.
4. Record confirmed usage locations with context.
5. Flag duplicates, ambiguity, and missing locale coverage.

## Output

- requested lookup
- matching resource entries
- usage locations
- similar or duplicate candidates
- risks or next steps
`;
    case "legacy-sql-review":
      return `# ${skill.name}

${skill.description}

## Review Priorities

1. correctness and data integrity
2. binding safety
3. pagination and ordering stability
4. performance and non-sargable predicates
5. hard-coded locale or environment assumptions
6. maintainability

## Procedure

1. Summarize the query goal and expected result shape.
2. Review joins, filters, grouping, ordering, and dynamic SQL behavior.
3. Check mapper bindings and vendor-specific edge cases.
4. Recommend concrete rewrites or validation steps.

## Output

- query goal
- findings by severity
- performance observations
- safety observations
- suggested rewrites
- validation scenarios
`;
    case "harness-post-work-review":
      return `# ${skill.name}

${skill.description}

## Final Quality Gate

1. Gather the final change set and expected behavior.
2. Run three review rounds:
   - independent expert inspection
   - synthesis and remediation planning
   - final approval review
3. Remediate critical findings immediately.
4. Re-run tests, automated checks, and code review after remediation.
5. Refresh governance artifacts last and record remaining risks explicitly.

## Completion Standard

- verification is current
- code review issues are resolved or deliberately deferred
- test coverage matches the changed behavior
- handover state is fresh
- governance documents match the shipped state
`;
    default:
      return null;
  }
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

function buildGovernanceInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Define the allowed, restricted, and review-only actions for the workflow
2. Capture escalation triggers, approval gates, and audit expectations
3. Add trust and policy checkpoints before sensitive execution
4. Fail closed when policy evaluation is uncertain
5. Keep governance rules configurable so teams can evolve them safely

## Output Focus

- Governance policies
- Review gates
- Audit requirements
- Risk-based operational guidance

## Tags

${skill.tags.map((t) => `- \`${t}\``).join("\n")}
`;
}

function buildMemoryInstructions(skill: SkillEntry): string {
  return `## Instructions

1. Capture only the durable context that future sessions need
2. Convert repeated lessons and blockers into reusable memory
3. Organize memory by domain to keep retrieval efficient
4. Prefer concise summaries over transcript-like dumps
5. Remove redundant or stale memory to keep trust high

## Output Focus

- Durable learnings
- Context continuity notes
- Handover-ready summaries
- Memory hygiene recommendations

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
- Keep tools focused ??one responsibility per tool

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

// Agent .agent.md content builder

function buildAgentMd(agent: AgentEntry): string {
  const frontmatter = buildAgentFrontmatter(agent);

  const body = buildAgentBody(agent);

  return `${frontmatter}\n\n${body}\n`;
}

function buildAgentFrontmatter(agent: AgentEntry): string {
  const tools = getAgentTools(agent.id);
  const userInvocable = agent.id === "harness-quality-gate";

  return [
    "---",
    `name: "${agent.name}"`,
    `description: "${agent.description}"`,
    `tools: [${tools.join(", ")}]`,
    `user-invocable: ${userInvocable ? "true" : "false"}`,
    "---",
  ].join("\n");
}

function getAgentTools(agentId: string): string[] {
  switch (agentId) {
    case "harness-doc-writer":
      return ["read", "edit", "search"];
    case "legacy-enterprise-analysis":
      return ["read", "search"];
    case "harness-expert-reviewer":
      return ["read", "search"];
    case "harness-implementer":
      return ["read", "edit", "search", "execute"];
    case "harness-verifier":
      return ["read", "search", "execute"];
    case "harness-quality-gate":
      return ["read", "edit", "search", "execute"];
    case "risk-focused-code-review":
      return ["read", "search"];
    default:
      return [];
  }
}

function buildAgentBody(agent: AgentEntry): string {
  const customBody = buildCustomAgentBody(agent);
  if (customBody) {
    return customBody;
  }

  const sections: string[] = [];

  sections.push(`# ${agent.name}\n`);
  sections.push(`${agent.description}\n`);

  // Category-specific agent instructions
  if (agent.categories.includes("planning")) {
    sections.push(`## Approach

1. **Analyze** ??Understand the full context before proposing solutions
2. **Plan** ??Break down complex tasks into manageable steps
3. **Document** ??Record decisions and rationale
4. **Execute** ??Implement the plan step by step
5. **Review** ??Validate results against requirements
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

1. **Assess** ??Reproduce and understand the problem
2. **Investigate** ??Identify root cause through systematic analysis
3. **Resolve** ??Apply minimal, targeted fix
4. **QA** ??Verify fix and check for regressions
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

function buildCustomAgentBody(agent: AgentEntry): string | null {
  switch (agent.id) {
    case "harness-doc-writer":
      return `# ${agent.name}

${agent.description}

## Rules

- Use only approved implementation context and repository evidence.
- Keep all documents UTF-8 safe.
- Update governance surfaces only, not product code.
- Prefer concise, durable notes over transcript-like logs.

## Default Targets

- \`.github/ai-harness/\`
- \`docs/context/\`
- \`docs/reviews/\`
- \`docs/plans/\`
- \`docs/handovers/\`

## Typical Outputs

- governance-opening notes
- chunk work logs
- final records
- AS-IS vs TO-BE comparisons
- handover notes
- flow notes with Mermaid when structure matters
`;
    case "legacy-enterprise-analysis":
      return `# ${agent.name}

${agent.description}

## Rules

- Read first, trace second, infer last.
- Separate confirmed evidence from assumptions.
- Prefer findings and impact analysis over broad summaries.
- Do not edit files.

## Output

- scope summary
- confirmed flow map
- AS-IS vs TO-BE deltas
- risks and open questions
- recommended verification path
`;
    case "harness-expert-reviewer":
      return `# ${agent.name}

${agent.description}

## Rules

- Review from one expert lens only.
- Read only the files and criteria provided.
- Support every critical and important finding with evidence.
- Do not edit files.

## Output

- score
- critical findings
- important findings
- opportunities
- risks
- concise recommendations
`;
    case "harness-implementer":
      return `# ${agent.name}

${agent.description}

## Rules

- Implement only the approved chunk.
- Read the latest plan, review notes, and constraints first.
- Add or update tests for changed behavior whenever practical.
- Run narrow verification before returning.
- Report files changed, checks run, and open risks.
`;
    case "harness-verifier":
      return `# ${agent.name}

${agent.description}

## Rules

- Run only the checks relevant to the changed files and promised behavior.
- Report failures, suspicious leftovers, and weak coverage.
- Keep passing output brief.
- Do not edit files.
`;
    case "harness-quality-gate":
      return `# ${agent.name}

${agent.description}

## Rules

- Run the post-work review flow before declaring completion.
- Remediate critical findings immediately.
- Re-run verification after remediation.
- Refresh governance artifacts last.
- Do not add new features during quality-gate remediation.
`;
    case "risk-focused-code-review":
      return `# ${agent.name}

${agent.description}

## Rules

- Findings come first.
- Prioritize correctness, regressions, data integrity, security, and test gaps.
- Support important findings with concrete file-backed evidence.
- Keep the change summary short and place it after the findings.
- Do not edit files.
`;
    default:
      return null;
  }
}

// Public API

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
    userIntent: buildRecommendationIntent(params, options?.userIntent),
    maxAgents: options?.maxAgents ?? 8,
    maxSkills: options?.maxSkills ?? 12,
  });
  const selectedSkills = params.includeHarnessEngineering === false
    ? skills
    : dedupeSkills([
        ...skills,
        ...HARNESS_CORE_SKILL_IDS
          .map((id) => SKILL_REGISTRY.find((entry) => entry.id === id))
          .filter((entry): entry is SkillEntry => entry != null),
      ]);
  const selectedAgents = params.includeHarnessEngineering === false
    ? agents
    : dedupeAgents([
        ...agents,
        ...HARNESS_CORE_AGENT_IDS
          .map((id) => AGENT_REGISTRY.find((entry) => entry.id === id))
          .filter((entry): entry is AgentEntry => entry != null),
      ]);

  files.push(...buildInstalledAssetFiles(selectedSkills, selectedAgents, params));
  files.push(...generateCatalogSupportFiles(selectedAgents, selectedSkills, params));

  return files;
}

function buildRecommendationIntent(
  params: WorkspaceInitParams,
  userIntent?: string
): string {
  const parts = [userIntent, params.agentSkillsIntent, params.purpose];

  if (params.includeHarnessEngineering !== false) {
    parts.push(
      "context continuity governance review memory handover token discipline long-running delivery planner generator evaluator contract skeptical evaluation context reset compaction"
    );
  }

  if (params.primaryDomains?.length) {
    parts.push(params.primaryDomains.join(" "));
  }

  return parts.filter(Boolean).join(" ");
}

function dedupeSkills(skills: SkillEntry[]): SkillEntry[] {
  const seen = new Set<string>();
  return skills.filter((skill) => {
    if (seen.has(skill.id)) {
      return false;
    }
    seen.add(skill.id);
    return true;
  });
}

function dedupeAgents(agents: AgentEntry[]): AgentEntry[] {
  const seen = new Set<string>();
  return agents.filter((agent) => {
    if (seen.has(agent.id)) {
      return false;
    }
    seen.add(agent.id);
    return true;
  });
}

function normalizeIndexParams(
  params?: Partial<WorkspaceInitParams>
): WorkspaceInitParams {
  return {
    workspaceName: params?.workspaceName ?? "Selected Agent Skills",
    purpose: params?.purpose ?? "Selected agent skill installation",
    workspacePath: params?.workspacePath ?? ".",
    projectType: params?.projectType ?? "other",
    techStack: params?.techStack ?? [],
    targetIDEs: params?.targetIDEs ?? ["vscode"],
    includeHarnessEngineering: params?.includeHarnessEngineering ?? false,
    agentSkillsIntent: params?.agentSkillsIntent,
    primaryDomains: params?.primaryDomains,
    docLanguage: params?.docLanguage,
    codeCommentLanguage: params?.codeCommentLanguage,
    isMultiRepo: params?.isMultiRepo,
    additionalContext: params?.additionalContext,
    plannedTasks: params?.plannedTasks,
    includeAgentSkills: params?.includeAgentSkills,
    fileEncoding: params?.fileEncoding,
    lineEnding: params?.lineEnding,
    harnessProfile: params?.harnessProfile,
    governanceProfile: params?.governanceProfile,
    autonomyMode: params?.autonomyMode,
    tokenBudget: params?.tokenBudget,
  };
}

function generateCatalogSupportFiles(
  agents: AgentEntry[],
  skills: SkillEntry[],
  params: WorkspaceInitParams
): GeneratedFile[] {
  return [
    generateSkillsIndex(agents, skills, params),
    generateRoleIndex(agents, skills, params),
    generateDomainIndex(agents, skills, params),
    generateMachineReadableCatalogIndex(agents, skills, params),
  ];
}

function isProjectTypeSpecific(
  relevantProjectTypes: string[],
  projectType?: string
): boolean {
  return projectType != null && relevantProjectTypes.includes(projectType);
}

function buildQuickStartBundles(
  agents: AgentEntry[],
  skills: SkillEntry[],
  params: WorkspaceInitParams
): Array<{
  id: string;
  label: string;
  description: string;
  agents: AgentEntry[];
  skills: SkillEntry[];
}> {
  const foundationAgents = agents.filter((agent) =>
    HARNESS_CORE_AGENT_IDS.includes(agent.id)
  );
  const foundationSkills = skills.filter((skill) =>
    HARNESS_CORE_SKILL_IDS.includes(skill.id)
  );

  const nonFoundationAgents = agents.filter(
    (agent) => !HARNESS_CORE_AGENT_IDS.includes(agent.id)
  );
  const nonFoundationSkills = skills.filter(
    (skill) => !HARNESS_CORE_SKILL_IDS.includes(skill.id)
  );

  const domainAgents = nonFoundationAgents.filter((agent) =>
    isProjectTypeSpecific(agent.relevantProjectTypes, params.projectType)
  );
  const domainSkills = nonFoundationSkills.filter((skill) =>
    isProjectTypeSpecific(skill.relevantProjectTypes, params.projectType)
  );

  const specialistAgents = nonFoundationAgents.filter(
    (agent) => !domainAgents.some((candidate) => candidate.id === agent.id)
  );
  const specialistSkills = nonFoundationSkills.filter(
    (skill) => !domainSkills.some((candidate) => candidate.id === skill.id)
  );

  return [
    {
      id: "foundation",
      label: "Foundation Bundle",
      description:
        "Governance-first defaults that should bracket most meaningful work in this workspace.",
      agents: foundationAgents,
      skills: foundationSkills,
    },
    {
      id: "project-type",
      label: "Project-Type Bundle",
      description:
        params.projectType != null
          ? `Assets explicitly aligned to the selected project type: ${params.projectType}.`
          : "Assets aligned to the selected project type.",
      agents: domainAgents,
      skills: domainSkills,
    },
    {
      id: "specialists",
      label: "Specialist Additions",
      description:
        "Additional assets selected for tech stack, intent, or advanced scenarios beyond the shared foundation.",
      agents: specialistAgents,
      skills: specialistSkills,
    },
  ];
}

function renderLinkedEntries(
  kind: "agent" | "skill",
  entries: Array<AgentEntry | SkillEntry>
): string {
  if (entries.length === 0) {
    return "- none";
  }

  return entries
    .map((entry) => {
      const target =
        kind === "skill"
          ? `skills/${entry.id}/SKILL.md`
          : `agents/${entry.id}.agent.md`;
      return `- [\`${entry.id}\`](${target}): ${entry.name} - ${entry.description}`;
    })
    .join("\n");
}

function renderBundleSection(
  bundle: ReturnType<typeof buildQuickStartBundles>[number]
): string {
  return [
    `### ${bundle.label}`,
    bundle.description,
    `Agents (${bundle.agents.length})`,
    renderLinkedEntries("agent", bundle.agents),
    `Skills (${bundle.skills.length})`,
    renderLinkedEntries("skill", bundle.skills),
  ].join("\n\n");
}

function renderRoleSection(role: CatalogRoleGroup): string {
  return [
    `## ${role.label}`,
    role.description,
    `### Agents (${role.agents.length})`,
    renderLinkedEntries("agent", role.agents),
    `### Skills (${role.skills.length})`,
    renderLinkedEntries("skill", role.skills),
  ].join("\n\n");
}

function renderDomainSection(domain: CatalogDomainGroup): string {
  return [
    `## ${domain.label}`,
    domain.description,
    `### Agents (${domain.agents.length})`,
    renderLinkedEntries("agent", domain.agents),
    `### Skills (${domain.skills.length})`,
    renderLinkedEntries("skill", domain.skills),
  ].join("\n\n");
}

function generateRoleIndex(
  agents: AgentEntry[],
  skills: SkillEntry[],
  params: WorkspaceInitParams
): GeneratedFile {
  const { roles } = buildCatalogIndexes({ agents, skills });

  const content = [
    "# Agent Skills by Role",
    "",
    `> Auto-generated for **${params.workspaceName}**`,
    "",
    "Use this index when you know the role you need before picking a specific skill or agent.",
    "",
    ...roles.map(renderRoleSection),
    "",
  ].join("\n");

  return {
    relativePath: ".github/AGENT-SKILLS-BY-ROLE.md",
    content,
  };
}

function generateDomainIndex(
  agents: AgentEntry[],
  skills: SkillEntry[],
  params: WorkspaceInitParams
): GeneratedFile {
  const { domains } = buildCatalogIndexes({ agents, skills });
  const projectTypeBundle = buildQuickStartBundles(agents, skills, params).find(
    (bundle) => bundle.id === "project-type"
  );

  const content = [
    "# Agent Skills by Domain",
    "",
    `> Auto-generated for **${params.workspaceName}**`,
    "",
    "Use this index when you want to initialize or extend the workspace by project domain.",
    "",
    ...(projectTypeBundle
      ? [
          "## Selected Project Type Focus",
          "",
          renderBundleSection(projectTypeBundle),
          "",
        ]
      : []),
    ...domains.map(renderDomainSection),
    "",
  ].join("\n");

  return {
    relativePath: ".github/AGENT-SKILLS-BY-DOMAIN.md",
    content,
  };
}

function generateMachineReadableCatalogIndex(
  agents: AgentEntry[],
  skills: SkillEntry[],
  params: WorkspaceInitParams
): GeneratedFile {
  const { roles, domains } = buildCatalogIndexes({ agents, skills });
  const quickStartBundles = buildQuickStartBundles(agents, skills, params);
  const installTargets = getInstallTargets(params);

  const content = JSON.stringify(
    {
      workspace: {
        workspaceName: params.workspaceName,
        projectType: params.projectType ?? "other",
        techStack: params.techStack ?? [],
        targetIDEs: params.targetIDEs ?? ["vscode"],
        canonicalRegistry: {
          skills: CANONICAL_INSTALL_TARGET.skills,
          agents: CANONICAL_INSTALL_TARGET.agents,
        },
        installTargets: installTargets.map((target) => ({
          label: target.label,
          skills: target.skills,
          agents: target.agents,
          canonical: target.canonical,
        })),
      },
      quickStartBundles: quickStartBundles.map((bundle) => ({
        id: bundle.id,
        label: bundle.label,
        description: bundle.description,
        agentIds: bundle.agents.map((agent) => agent.id),
        skillIds: bundle.skills.map((skill) => skill.id),
      })),
      roles: roles.map((role) => ({
        id: role.id,
        label: role.label,
        description: role.description,
        agentIds: role.agents.map((agent) => agent.id),
        skillIds: role.skills.map((skill) => skill.id),
      })),
      domains: domains.map((domain) => ({
        id: domain.id,
        label: domain.label,
        description: domain.description,
        agentIds: domain.agents.map((agent) => agent.id),
        skillIds: domain.skills.map((skill) => skill.id),
      })),
    },
    null,
    2
  );

  return {
    relativePath: ".github/agent-skill-index.json",
    content,
  };
}

/**
 * Generate specific skills by IDs.
 */
export function generateSelectedSkills(
  skillEntries: SkillEntry[],
  agentEntries: AgentEntry[],
  params?: Partial<WorkspaceInitParams>
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const indexParams = normalizeIndexParams(params);
  files.push(...buildInstalledAssetFiles(skillEntries, agentEntries, indexParams));
  files.push(...generateCatalogSupportFiles(agentEntries, skillEntries, indexParams));

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
  const bundles = buildQuickStartBundles(agents, skills, params);
  const installTargets = getInstallTargets(params);
  const mirrorTargets = installTargets.filter((target) => !target.canonical);

  const skillsList = skills
    .map((s) => `| [\`${s.id}\`](skills/${s.id}/SKILL.md) | ${s.name} | ${s.description} | ${s.categories.join(", ")} |`)
    .join("\n");

  const agentsList = agents
    .map((a) => `| [\`${a.id}\`](agents/${a.id}.agent.md) | ${a.name} | ${a.description} | ${a.categories.join(", ")} |`)
    .join("\n");

  const mirrorPathLines =
    mirrorTargets.length > 0
      ? mirrorTargets
          .map(
            (target) =>
              `- **${target.label}**: \`${target.skills}/\`, \`${target.agents}/\``
          )
          .join("\n")
      : "- none";

  const content = [
    "# Agent Skills & Agents Registry",
    "",
    `> Auto-generated by workspace-init-mcp for **${params.workspaceName}**`,
    `> Project type: ${params.projectType ?? "other"} | Tech: ${params.techStack?.join(", ") || "not specified"}`,
    "",
    "## Quick Start",
    "",
    ...bundles.map(renderBundleSection),
    "",
    "## Index Files",
    "",
    "- [By Role](AGENT-SKILLS-BY-ROLE.md)",
    "- [By Domain](AGENT-SKILLS-BY-DOMAIN.md)",
    "- [Machine-readable Index](agent-skill-index.json)",
    "",
    `## Installed Skills (${skills.length})`,
    "",
    "| ID | Name | Description | Categories |",
    "|---|---|---|---|",
    skillsList,
    "",
    `## Installed Agents (${agents.length})`,
    "",
    "| ID | Name | Description | Categories |",
    "|---|---|---|---|",
    agentsList,
    "",
    "## Generated Paths",
    "",
    "A canonical registry is always generated under `.github/skills/` and `.github/agents/` so the index links remain stable.",
    "",
    "### Canonical Registry",
    "",
    `- \`${CANONICAL_INSTALL_TARGET.skills}/\``,
    `- \`${CANONICAL_INSTALL_TARGET.agents}/\``,
    "",
    "### IDE Mirrors",
    "",
    mirrorPathLines,
    "",
    "## Skill Discovery",
    "",
    "Skills are discovered automatically by compatible AI tools:",
    "- **VS Code Copilot**: Reads from `.github/skills/`",
    "- **Cursor**: Reads from `.cursor/skills/` or `.github/skills/`",
    "- **Claude Code**: Reads from `.claude/skills/` or `.github/skills/`",
    "- **OpenHands**: Reads from `.agents/skills/` or `.github/skills/`",
    "",
    "## Adding New Skills",
    "",
    "Create a new directory under `.github/skills/` with a `SKILL.md` file. The MCP can mirror that canonical copy into other IDE directories during generation:",
    "",
    "```",
    ".github/skills/",
    "  my-custom-skill/",
    "    SKILL.md          # Required: skill definition",
    "    references/       # Optional: reference documents",
    "    templates/        # Optional: template files",
    "    scripts/          # Optional: automation scripts",
    "    examples/         # Optional: usage examples",
    "```",
    "",
    "### SKILL.md Format",
    "",
    "```markdown",
    "---",
    'name: "My Custom Skill"',
    'description: "What this skill does"',
    'argument-hint: "How to invoke this skill"',
    "user-invokable: true",
    "disable-model-invocation: false",
    "---",
    "",
    "# My Custom Skill",
    "",
    "Instructions for the AI agent...",
    "```",
    "",
    "## References",
    "",
    "- [Agent Skills Standard](https://agentskills.io)",
    "- [VS Code Agent Skills Docs](https://code.visualstudio.com/docs/copilot/chat/agent-skills)",
    "- [awesome-copilot](https://github.com/github/awesome-copilot)",
    "",
  ].join("\n");

  return {
    relativePath: ".github/AGENT-SKILLS.md",
    content,
  };
}
