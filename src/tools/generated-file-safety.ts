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

export const PROTECTED_SOURCE_PREFIXES = [
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

export function normalizeWorkspaceRelativePath(relativePath: string): string {
  return relativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".")
    .join("/");
}

function canonicalWorkspaceRelativePath(relativePath: string): string {
  return normalizeWorkspaceRelativePath(relativePath).toLowerCase();
}

export function isUnsafeWorkspaceRelativePath(relativePath: string): boolean {
  const trimmedPath = relativePath.trim();
  const slashNormalizedPath = trimmedPath.replace(/\\/g, "/");
  const normalizedPath = normalizeWorkspaceRelativePath(relativePath);
  return (
    normalizedPath.length === 0 ||
    slashNormalizedPath.startsWith("/") ||
    /^[A-Za-z]:/.test(slashNormalizedPath) ||
    slashNormalizedPath.split("/").includes("..")
  );
}

export function isGeneratedWorkspaceControlPath(relativePath: string): boolean {
  const normalizedPath = canonicalWorkspaceRelativePath(relativePath);
  return (
    GENERATED_CONTROL_FILES.has(normalizedPath) ||
    GENERATED_CONTROL_PREFIXES.some((prefix) =>
      normalizedPath.startsWith(prefix)
    )
  );
}

export function isProtectedSourcePath(relativePath: string): boolean {
  const normalizedPath = canonicalWorkspaceRelativePath(relativePath);
  return PROTECTED_SOURCE_PREFIXES.some((prefix) => {
    const root = prefix.replace(/\/$/, "");
    return normalizedPath === root || normalizedPath.startsWith(prefix);
  });
}

export function isProtectedSourceRootPath(relativePath: string): boolean {
  const normalizedPath = canonicalWorkspaceRelativePath(relativePath);
  return PROTECTED_SOURCE_PREFIXES.some((prefix) => {
    const root = prefix.replace(/\/$/, "");
    return normalizedPath === root;
  });
}

export function normalizeSafeWorkspaceRelativePaths(
  paths: string[],
  label: string
): string[] {
  const trimmedPaths = paths.map((item) => item.trim());
  const normalizedPaths = trimmedPaths.map((item) =>
    normalizeWorkspaceRelativePath(item)
  );
  const violations = trimmedPaths.filter(
    (relativePath) =>
      isUnsafeWorkspaceRelativePath(relativePath) ||
      isProtectedSourceRootPath(relativePath)
  );

  if (violations.length > 0) {
    throw new Error(
      [
        `Unsafe ${label} blocked by workspace path safety policy.`,
        "Use explicit workspace-relative file paths and avoid bare protected source roots.",
        `Blocked paths: ${violations.join(", ")}`,
      ].join(" ")
    );
  }

  return Array.from(new Set(normalizedPaths));
}

export function assertGeneratedFilesRespectNonDestructivePolicy(
  files: GeneratedFile[]
): void {
  const violations = files
    .map((file) => file.relativePath)
    .filter(
      (relativePath) =>
        isUnsafeWorkspaceRelativePath(relativePath) ||
        isProtectedSourcePath(relativePath) ||
        !isGeneratedWorkspaceControlPath(relativePath)
    )
    .map((relativePath) => normalizeWorkspaceRelativePath(relativePath));

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
