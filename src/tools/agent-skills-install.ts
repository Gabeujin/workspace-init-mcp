import * as fs from "node:fs";
import * as path from "node:path";

import { type TargetIDE } from "../types.js";

export const TARGET_IDE_VALUES = [
  "vscode",
  "cursor",
  "claude-code",
  "openhands",
] as const;

function isTargetIDE(value: unknown): value is TargetIDE {
  return (
    typeof value === "string" &&
    TARGET_IDE_VALUES.includes(value as (typeof TARGET_IDE_VALUES)[number])
  );
}

function dedupeTargetIDEs(targetIDEs: TargetIDE[]): TargetIDE[] {
  return [...new Set(targetIDEs)];
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
    { ide: "cursor", paths: [".cursor/skills", ".cursor/agents"] },
    { ide: "claude-code", paths: [".claude/skills", ".claude/agents"] },
    { ide: "openhands", paths: [".agents/skills", ".agents/agents"] },
    { ide: "vscode", paths: [".github/skills", ".github/agents"] },
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
