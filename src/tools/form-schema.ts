/**
 * Form Schema Tool
 *
 * Returns a universal JSON form schema that any MCP client can use
 * to render workspace initialization inputs.
 */

import { PROJECT_TYPE_CONFIGS } from "../types.js";

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
  conversationalGuide: string;
  cliPromptGuide: string;
}

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
      label: "Workspace name",
      type: "text",
      required: true,
      description: "Name used in generated headings and workspace artifacts.",
      placeholder: "my-awesome-project",
      validation: {
        minLength: 1,
        maxLength: 100,
        pattern: "^[a-zA-Z0-9][a-zA-Z0-9\\s\\-_.]*$",
        patternDescription:
          "Letters, numbers, spaces, hyphens, underscores, or dots",
      },
    },
    {
      name: "purpose",
      label: "Workspace purpose",
      type: "textarea",
      required: true,
      description:
        "Describe the main outcome, product intent, or operating goal for this workspace.",
      placeholder:
        "Build and operate a multi-domain AI delivery workspace for long-running product work.",
      validation: {
        minLength: 10,
        maxLength: 2000,
      },
    },
    {
      name: "workspacePath",
      label: "Workspace path",
      type: "text",
      required: true,
      description: "Absolute path to the workspace root.",
      placeholder: "C:\\projects\\my-project or /home/user/projects/my-project",
      validation: {
        minLength: 1,
      },
    },
  ];

  const optionalFields: FormField[] = [
    {
      name: "projectType",
      label: "Project type",
      type: "select",
      required: false,
      description:
        "Chooses a workspace template strategy and documentation defaults.",
      default: "other",
      options: projectTypeOptions,
    },
    {
      name: "techStack",
      label: "Tech stack",
      type: "tags",
      required: false,
      description: "Technologies used by the project.",
      placeholder: "TypeScript, React, Node.js, PostgreSQL",
      default: [],
    },
    {
      name: "primaryDomains",
      label: "Primary domains",
      type: "tags",
      required: false,
      description:
        "Domains the AI harness must coordinate across, such as product, platform, security, data, or operations.",
      placeholder: "product, platform, security, data, operations",
      default: [],
    },
    {
      name: "docLanguage",
      label: "Documentation language",
      type: "text",
      required: false,
      description: "Preferred language for generated documentation.",
      default: "Korean",
      placeholder: "Korean",
    },
    {
      name: "codeCommentLanguage",
      label: "Code comment language",
      type: "text",
      required: false,
      description: "Preferred language for code comments.",
      default: "English",
      placeholder: "English",
    },
    {
      name: "isMultiRepo",
      label: "Multi-repo workspace",
      type: "boolean",
      required: false,
      description:
        "Enable if the workspace coordinates multiple repositories or packages.",
      default: false,
    },
    {
      name: "additionalContext",
      label: "Additional context",
      type: "textarea",
      required: false,
      description:
        "Extra constraints, workflow expectations, standards, or delivery notes.",
      placeholder:
        "Strict review culture, long-running feature branches, regulated deployment flow.",
    },
    {
      name: "plannedTasks",
      label: "Planned tasks",
      type: "tags",
      required: false,
      description: "Common tasks the workspace will repeatedly support.",
      placeholder: "architecture review, implementation planning, CI hardening",
      default: [],
    },
    {
      name: "includeAgentSkills",
      label: "Include agent skills",
      type: "boolean",
      required: false,
      description: "Generate agent skills and agent definitions.",
      default: true,
    },
    {
      name: "agentSkillsIntent",
      label: "Agent skill intent",
      type: "text",
      required: false,
      description:
        "Intent hint used to recommend the most relevant skills and agents.",
      placeholder: "focus on governance, planning, and long-running delivery",
    },
    {
      name: "includeHarnessEngineering",
      label: "Include harness engineering",
      type: "boolean",
      required: false,
      description:
        "Generate long-running AI harness artifacts such as governance, context, review, and handover guides.",
      default: true,
    },
    {
      name: "harnessProfile",
      label: "Harness profile",
      type: "select",
      required: false,
      description:
        "High-level operating profile for the generated AI delivery harness.",
      default: "balanced",
      options: [
        {
          value: "lean",
          label: "Lean",
          description: "Fast delivery with tight context scopes and low token use",
        },
        {
          value: "balanced",
          label: "Balanced",
          description: "Long-running delivery with explicit reviews and handovers",
        },
        {
          value: "regulated",
          label: "Regulated",
          description: "Auditability and governance for compliance-sensitive work",
        },
        {
          value: "autonomous",
          label: "Autonomous",
          description: "Deeper automation with strong review and refresh rules",
        },
      ],
    },
    {
      name: "governanceProfile",
      label: "Governance profile",
      type: "select",
      required: false,
      description: "How strict the workspace should be about approvals and controls.",
      default: "strict",
      options: [
        {
          value: "standard",
          label: "Standard",
          description: "General delivery guardrails with practical flexibility",
        },
        {
          value: "strict",
          label: "Strict",
          description: "Recommended default for long-running AI delivery",
        },
        {
          value: "regulated",
          label: "Regulated",
          description: "For compliance-sensitive or audit-heavy environments",
        },
      ],
    },
    {
      name: "autonomyMode",
      label: "Autonomy mode",
      type: "select",
      required: false,
      description: "How independently AI should execute work in this workspace.",
      default: "balanced",
      options: [
        {
          value: "guided",
          label: "Guided",
          description: "Frequent human checkpoints before meaningful execution",
        },
        {
          value: "balanced",
          label: "Balanced",
          description: "Autonomy with recurring reviews and checkpoints",
        },
        {
          value: "autonomous",
          label: "Autonomous",
          description: "More independent execution with stronger harness controls",
        },
      ],
    },
    {
      name: "tokenBudget",
      label: "Token budget",
      type: "select",
      required: false,
      description: "How aggressively the workspace should control token usage.",
      default: "balanced",
      options: [
        {
          value: "lean",
          label: "Lean",
          description: "Prefer minimal context and short summaries",
        },
        {
          value: "balanced",
          label: "Balanced",
          description: "Default balance between depth and cost",
        },
        {
          value: "thorough",
          label: "Thorough",
          description: "Use richer context when accuracy matters more than cost",
        },
      ],
    },
    {
      name: "force",
      label: "Overwrite existing files",
      type: "boolean",
      required: false,
      description:
        "If true, replace existing generated files instead of skipping them.",
      default: false,
    },
    {
      name: "fileEncoding",
      label: "File encoding",
      type: "select",
      required: false,
      description: "Encoding used for generated files.",
      default: "utf-8",
      options: [
        {
          value: "utf-8",
          label: "UTF-8",
          description: "Recommended default",
        },
        {
          value: "utf-8-bom",
          label: "UTF-8 BOM",
          description: "Use only for Windows tools that require BOM",
        },
        {
          value: "ascii",
          label: "ASCII",
          description: "7-bit ASCII",
        },
        {
          value: "latin1",
          label: "Latin-1",
          description: "ISO-8859-1",
        },
      ],
    },
    {
      name: "targetIDEs",
      label: "Target IDEs",
      type: "tags",
      required: false,
      description:
        "Where skill and agent files should be generated.",
      default: ["vscode"],
      placeholder: "vscode, cursor, claude-code, openhands",
    },
    {
      name: "lineEnding",
      label: "Line endings",
      type: "select",
      required: false,
      description: "Line-ending style for generated files.",
      default: "lf",
      options: [
        {
          value: "lf",
          label: "LF",
          description: "Unix/macOS and the recommended default",
        },
        {
          value: "crlf",
          label: "CRLF",
          description: "Windows style",
        },
        {
          value: "auto",
          label: "Auto",
          description: "Let Git normalize based on .gitattributes",
        },
      ],
    },
  ];

  const conversationalGuide = buildConversationalGuide(
    requiredFields,
    optionalFields
  );
  const cliPromptGuide = buildCliPromptGuide(requiredFields, optionalFields);

  return {
    formId: "workspace-init",
    formTitle: "Workspace initialization",
    formDescription:
      "Create a workspace with documentation governance, agent skills, and an optional long-running AI harness.",
    version: "2.0.0",
    sections: [
      {
        id: "required",
        title: "Required inputs",
        description:
          "Minimum information needed to initialize the workspace.",
        fields: requiredFields,
      },
      {
        id: "optional",
        title: "Optional inputs",
        description:
          "Use these to tailor the generated governance, harness, and skill setup.",
        fields: optionalFields,
      },
    ],
    conversationalGuide,
    cliPromptGuide,
  };
}

function buildConversationalGuide(
  required: FormField[],
  optional: FormField[]
): string {
  const requiredLines = required
    .map(
      (field) =>
        `### ${field.label} (required)\n${field.description}${
          field.placeholder ? `\n> Example: ${field.placeholder}` : ""
        }`
    )
    .join("\n\n");

  const optionalLines = optional
    .map((field) => {
      const defaultNote =
        field.default !== undefined
          ? ` (default: ${JSON.stringify(field.default)})`
          : "";
      return `- **${field.label}**${defaultNote}: ${field.description}`;
    })
    .join("\n");

  return `# Workspace initialization guide

Provide the required information first. Optional inputs help tailor governance, skills, and long-running AI harness behavior.

## Required

${requiredLines}

## Optional

${optionalLines}

The more precise the purpose, domains, and workflow notes are, the better the generated harness will fit long-running work.`;
}

function buildCliPromptGuide(
  required: FormField[],
  optional: FormField[]
): string {
  const requiredLines = required
    .map((field) => `  ${field.name}: ${field.description}`)
    .join("\n");
  const optionalLines = optional
    .map((field) => {
      const defaultNote =
        field.default !== undefined
          ? ` [default: ${JSON.stringify(field.default)}]`
          : "";
      return `  ${field.name}${defaultNote}: ${field.description}`;
    })
    .join("\n");

  return `workspace-init-mcp input guide

Required:
${requiredLines}

Optional:
${optionalLines}`;
}
