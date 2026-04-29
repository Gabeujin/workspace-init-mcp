import { type GeneratedFile } from "../types.js";

const GENERATED_CONTROL_PREFIXES = [
  ".github/",
  ".vscode/",
  ".cursor/",
  ".claude/",
  ".agents/",
  "docs/",
] as const;

const GENERATED_CONTROL_FILES = new Set([".editorconfig", ".gitattributes"]);

const PROTECTED_SOURCE_PREFIXES = [
  "src/",
  "app/",
  "apps/",
  "lib/",
  "libs/",
  "packages/",
  "services/",
  "server/",
  "client/",
  "frontend/",
  "backend/",
  "api/",
  "web/",
  "mobile/",
  "database/",
  "db/",
  "migrations/",
  "public/",
  "assets/",
] as const;

function normalizeGeneratedPath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function isUnsafeRelativePath(normalizedPath: string): boolean {
  return (
    normalizedPath.length === 0 ||
    normalizedPath.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalizedPath) ||
    normalizedPath.split("/").includes("..")
  );
}

export function isGeneratedWorkspaceControlPath(relativePath: string): boolean {
  const normalizedPath = normalizeGeneratedPath(relativePath);
  return (
    GENERATED_CONTROL_FILES.has(normalizedPath) ||
    GENERATED_CONTROL_PREFIXES.some((prefix) =>
      normalizedPath.startsWith(prefix)
    )
  );
}

export function isProtectedSourcePath(relativePath: string): boolean {
  const normalizedPath = normalizeGeneratedPath(relativePath);
  return PROTECTED_SOURCE_PREFIXES.some((prefix) =>
    normalizedPath.startsWith(prefix)
  );
}

export function assertGeneratedFilesRespectNonDestructivePolicy(
  files: GeneratedFile[]
): void {
  const violations = files
    .map((file) => normalizeGeneratedPath(file.relativePath))
    .filter(
      (relativePath) =>
        isUnsafeRelativePath(relativePath) ||
        isProtectedSourcePath(relativePath) ||
        !isGeneratedWorkspaceControlPath(relativePath)
    );

  if (violations.length > 0) {
    throw new Error(
      [
        "Generated file safety policy blocked workspace initialization output.",
        "workspace-init-mcp may only scaffold governance, documentation, IDE, and harness artifacts; it must not write into legacy application source roots.",
        `Blocked paths: ${violations.join(", ")}`,
      ].join(" ")
    );
  }
}
