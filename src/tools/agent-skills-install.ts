import * as fs from "node:fs";
import * as path from "node:path";

import { type TargetIDE } from "../types.js";

export const TARGET_IDE_VALUES = [
  "vscode",
  "cursor",
  "claude",
  "claude-code",
  "codex",
  "antigravity",
  "openhands",
] as const;

function isTargetIDE(value: unknown): value is TargetIDE {
  return (
    typeof value === "string" &&
    TARGET_IDE_VALUES.includes(value as (typeof TARGET_IDE_VALUES)[number])
  );
}

function normalizeTargetIDE(value: TargetIDE): TargetIDE {
  return value === "claude" ? "claude-code" : value;
}

function dedupeTargetIDEs(targetIDEs: TargetIDE[]): TargetIDE[] {
  return [...new Set(targetIDEs.map(normalizeTargetIDE))];
}

function readTargetIDEsFromMachineIndex(workspacePath: string): TargetIDE[] | null {
  const indexPath = path.join(workspacePath, ".github", "agent-skill-index.json");
  if (!fs.existsSync(indexPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as {
      workspace?: { targetIDEs?: unknown };
    };
    const targetIDEs = Array.isArray(parsed.workspace?.targetIDEs)
      ? parsed.workspace.targetIDEs.filter(isTargetIDE)
      : [];
    return targetIDEs.length > 0 ? dedupeTargetIDEs(targetIDEs) : null;
  } catch {
    return null;
  }
}

function detectTargetIDEsFromDirectories(workspacePath: string): TargetIDE[] {
  const mappings: Array<{ ide: TargetIDE; paths: string[] }> = [
    {
      ide: "cursor",
      paths: [
        ".cursor/skills",
        ".cursor/agents",
        ".cursor/rules",
        ".cursorrules",
      ],
    },
    {
      ide: "claude-code",
      paths: [".claude/skills", ".claude/agents", ".claude/CLAUDE.md", "CLAUDE.md"],
    },
    {
      ide: "codex",
      paths: ["AGENTS.md", "AGENTS.override.md", ".codex"],
    },
    {
      ide: "antigravity",
      paths: [
        ".agents/plugins",
        ".agents/rules",
        ".agents/hooks.json",
        ".gemini",
        "GEMINI.md",
      ],
    },
    { ide: "openhands", paths: [".agents/skills", ".agents/agents"] },
    {
      ide: "vscode",
      paths: [
        ".github/skills",
        ".github/agents",
        ".github/copilot-instructions.md",
        ".vscode",
      ],
    },
  ];

  const detected = mappings
    .filter(({ paths }) =>
      paths.some((relativePath) => fs.existsSync(path.join(workspacePath, relativePath)))
    )
    .map(({ ide }) => ide);

  return detected.length > 0 ? dedupeTargetIDEs(detected) : ["vscode"];
}

export function resolveWorkspaceTargetIDEs(
  workspacePath: string,
  requested?: TargetIDE[]
): TargetIDE[] {
  if (requested?.length) {
    return dedupeTargetIDEs(requested.filter(isTargetIDE));
  }

  const indexed = readTargetIDEsFromMachineIndex(workspacePath);
  if (indexed?.length) {
    return indexed;
  }

  return detectTargetIDEsFromDirectories(workspacePath);
}
