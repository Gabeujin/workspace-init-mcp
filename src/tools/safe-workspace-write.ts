import * as fs from "node:fs";
import * as path from "node:path";

type TextEncoding = BufferEncoding | "utf-8-bom";

export interface ContainedFileResolution {
  fullPath: string;
  relativePath: string;
}

function isPathWithin(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(parentPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function workspaceRealPath(workspacePath: string): string {
  if (!path.isAbsolute(workspacePath)) {
    throw new Error(`workspacePath must be absolute. Received: ${workspacePath}`);
  }
  return fs.realpathSync.native(workspacePath);
}

export function ensureContainedDirectory(
  workspacePath: string,
  directoryPath: string
): void {
  const workspaceReal = workspaceRealPath(workspacePath);
  const absoluteDirectoryPath = path.resolve(directoryPath);
  const relativeDirectory = path.relative(path.resolve(workspacePath), absoluteDirectoryPath);
  if (
    relativeDirectory.startsWith("..") ||
    path.isAbsolute(relativeDirectory)
  ) {
    throw new Error(`Directory escaped workspace: ${directoryPath}`);
  }

  const segments = relativeDirectory
    .split(path.sep)
    .filter((segment) => segment.length > 0 && segment !== ".");
  let currentPath = workspaceReal;
  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    if (fs.existsSync(currentPath)) {
      const lstat = fs.lstatSync(currentPath);
      if (lstat.isSymbolicLink()) {
        throw new Error(`Refusing to write through symbolic link directory: ${currentPath}`);
      }
      if (!lstat.isDirectory()) {
        throw new Error(`Expected directory path is occupied by a file: ${currentPath}`);
      }
    } else {
      fs.mkdirSync(currentPath);
    }
    const currentReal = fs.realpathSync.native(currentPath);
    if (!isPathWithin(workspaceReal, currentReal)) {
      throw new Error(`Directory escaped workspace through linked path: ${directoryPath}`);
    }
  }
}

export function assertContainedNonSymlinkFile(
  workspacePath: string,
  fullPath: string
): void {
  const workspaceReal = workspaceRealPath(workspacePath);
  const absoluteFullPath = path.resolve(fullPath);
  const relativeFile = path.relative(path.resolve(workspacePath), absoluteFullPath);
  if (relativeFile.startsWith("..") || path.isAbsolute(relativeFile)) {
    throw new Error(`File path escaped workspace: ${fullPath}`);
  }
  ensureContainedDirectory(workspacePath, path.dirname(absoluteFullPath));
  if (fs.existsSync(absoluteFullPath)) {
    const lstat = fs.lstatSync(absoluteFullPath);
    if (lstat.isSymbolicLink()) {
      throw new Error(`Refusing to overwrite symbolic link path: ${fullPath}`);
    }
    const targetReal = fs.realpathSync.native(absoluteFullPath);
    if (!isPathWithin(workspaceReal, targetReal)) {
      throw new Error(`File path escaped workspace through linked target: ${fullPath}`);
    }
  }
}

export function resolveContainedExistingFile(
  workspacePath: string,
  inputPath: string
): ContainedFileResolution {
  const workspaceReal = workspaceRealPath(workspacePath);
  const workspaceRoot = path.resolve(workspacePath);
  const absoluteFullPath = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(workspaceRoot, inputPath);
  const relativeFile = path.relative(workspaceRoot, absoluteFullPath);
  if (
    relativeFile === "" ||
    relativeFile.startsWith("..") ||
    path.isAbsolute(relativeFile)
  ) {
    throw new Error(`File path escaped workspace: ${inputPath}`);
  }

  const segments = relativeFile
    .split(path.sep)
    .filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.length === 0) {
    throw new Error(`File path did not identify a workspace file: ${inputPath}`);
  }

  let currentPath = workspaceReal;
  for (const segment of segments.slice(0, -1)) {
    currentPath = path.join(currentPath, segment);
    if (!fs.existsSync(currentPath)) {
      throw new Error(`Parent directory is missing for contained read: ${inputPath}`);
    }
    const lstat = fs.lstatSync(currentPath);
    if (lstat.isSymbolicLink()) {
      throw new Error(`Refusing to read through symbolic link directory: ${currentPath}`);
    }
    if (!lstat.isDirectory()) {
      throw new Error(`Contained read parent is not a directory: ${currentPath}`);
    }
    const currentReal = fs.realpathSync.native(currentPath);
    if (!isPathWithin(workspaceReal, currentReal)) {
      throw new Error(`File path escaped workspace through linked directory: ${inputPath}`);
    }
  }

  const fullPath = path.join(workspaceReal, ...segments);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Contained read file is missing: ${inputPath}`);
  }
  const lstat = fs.lstatSync(fullPath);
  if (lstat.isSymbolicLink()) {
    throw new Error(`Refusing to read symbolic link path: ${inputPath}`);
  }
  if (!lstat.isFile()) {
    throw new Error(`Contained read target is not a file: ${inputPath}`);
  }
  const targetReal = fs.realpathSync.native(fullPath);
  if (!isPathWithin(workspaceReal, targetReal)) {
    throw new Error(`File path escaped workspace through linked target: ${inputPath}`);
  }

  return {
    fullPath,
    relativePath: normalizeRelativePath(relativeFile),
  };
}

function writeFileWithEncoding(
  fullPath: string,
  content: string,
  encoding: TextEncoding
): void {
  if (encoding === "utf-8-bom") {
    fs.writeFileSync(fullPath, `\uFEFF${content}`, "utf-8");
    return;
  }
  fs.writeFileSync(fullPath, content, encoding);
}

export function writeContainedTextAtomic(
  workspacePath: string,
  fullPath: string,
  content: string,
  encoding: TextEncoding = "utf-8"
): void {
  assertContainedNonSymlinkFile(workspacePath, fullPath);
  const tempPath = path.join(
    path.dirname(fullPath),
    `.${path.basename(fullPath)}.${process.pid}.${Date.now()}.tmp`
  );
  try {
    writeFileWithEncoding(tempPath, content, encoding);
    fs.renameSync(tempPath, fullPath);
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
    throw error;
  }
}

export function writeContainedJsonAtomic(
  workspacePath: string,
  fullPath: string,
  value: unknown
): void {
  writeContainedTextAtomic(
    workspacePath,
    fullPath,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf-8"
  );
}

export function appendContainedText(
  workspacePath: string,
  fullPath: string,
  content: string
): void {
  assertContainedNonSymlinkFile(workspacePath, fullPath);
  fs.appendFileSync(fullPath, content, "utf-8");
}

export function copyContainedFileAtomic(
  workspacePath: string,
  sourcePath: string,
  targetPath: string
): void {
  assertContainedNonSymlinkFile(workspacePath, sourcePath);
  assertContainedNonSymlinkFile(workspacePath, targetPath);
  const tempPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`
  );
  try {
    fs.copyFileSync(sourcePath, tempPath);
    fs.renameSync(tempPath, targetPath);
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
    throw error;
  }
}
