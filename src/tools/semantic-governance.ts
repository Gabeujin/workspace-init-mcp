import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import {
  ARCHITECTURE_LAYER_IDS,
  ARCHITECTURE_PROFILE_IDS,
  SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
  type ArchitectureLayerId,
  type ArchitectureOntologyPolicy,
  type ArchitecturePolicyRule,
  type ArchitectureProfileId,
  type ScanConfidence,
  type SemanticGovernanceEvaluation,
  type SemanticVerdict,
  type SemanticViolation,
  type SourceDeclarationFact,
  type SourceDependencyEdge,
  type SourceEdgeKind,
  type SourceFileFact,
  type SourceGraphSnapshot,
  type SourceImportFact,
} from "../data/ontology-contract.js";
import { buildArchitectureOntologyPolicyForProfile } from "../data/architecture-profiles.js";
import { WORKSPACE_INIT_MCP_VERSION } from "../data/version.js";

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

const DEFAULT_EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "docs/ai-harness/ontology/state",
]);

const SOURCE_ROOT_HINTS = new Set([
  "app",
  "apps",
  "client",
  "lib",
  "modules",
  "packages",
  "server",
  "services",
  "src",
  "test",
  "tests",
]);

const UNSUPPORTED_CODE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".dart",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".kt",
  ".kts",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".scala",
  ".swift",
  ".svelte",
  ".vue",
]);

const EXTERNAL_LAYERS = new Set(["external", "unresolved"]);

interface LoadedArchitecturePolicy {
  policy: ArchitectureOntologyPolicy;
  warnings: string[];
}

export interface ScanSourceGraphOptions {
  workspacePath: string;
  architectureProfile?: ArchitectureProfileId;
  maxFiles?: number;
}

export interface ValidateSemanticGovernanceOptions extends ScanSourceGraphOptions {
  strictUnknown?: boolean;
}

export interface SemanticContextPackOptions extends ValidateSemanticGovernanceOptions {
  tokenBudget?: "lean" | "balanced" | "thorough";
  targetPaths?: string[];
}

export interface SemanticContextPack {
  schemaVersion: string;
  generatedAt: string;
  profileId: ArchitectureProfileId;
  tokenBudget: "lean" | "balanced" | "thorough";
  verdict: SemanticVerdict;
  contentHash: string;
  compression: {
    authority: "exact-graph-policy-receipts";
    mode: "lean" | "balanced" | "thorough";
    maxFindings: number;
    maxGraphNodes: number;
    selectedFindingCount: number;
    totalFindingCount: number;
    estimatedJsonChars: number;
    advisoryCompressionOnly: true;
  };
  jsonLd: Record<string, unknown>;
  tree: Array<Record<string, unknown>>;
  ruleFacts: Array<Record<string, unknown>>;
  antiPatterns: Array<Record<string, unknown>>;
  quantizedSignatures: Array<Record<string, unknown>>;
  spatialMaps: string[];
  promptTemplate: string;
  sourceRefs: string[];
  warnings: string[];
  summary: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function stableHash(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function relativeToWorkspace(workspacePath: string, fullPath: string): string {
  const relativePath = path.relative(workspacePath, fullPath);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Path escaped workspace during source graph scan: ${fullPath}`);
  }
  return normalizeRelativePath(relativePath);
}

function resolveArchitectureProfile(
  value: ArchitectureProfileId | undefined,
  workspacePath?: string
): ArchitectureProfileId {
  if (ARCHITECTURE_PROFILE_IDS.includes(value as ArchitectureProfileId)) {
    return value as ArchitectureProfileId;
  }
  if (workspacePath) {
    const policyPath = path.join(
      workspacePath,
      ".github",
      "ai-harness",
      "architecture-ontology.policy.json"
    );
    try {
      const parsed = JSON.parse(fs.readFileSync(policyPath, "utf-8")) as {
        profileId?: string;
      };
      if (ARCHITECTURE_PROFILE_IDS.includes(parsed.profileId as ArchitectureProfileId)) {
        return parsed.profileId as ArchitectureProfileId;
      }
    } catch {
      // Fall through to the conservative default.
    }
  }
  return "n-tier";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateArchitectureOntologyPolicyShape(
  policy: unknown,
  expectedProfileId: ArchitectureProfileId
): string[] {
  const warnings: string[] = [];
  if (!isPlainObject(policy)) {
    return ["Policy is not an object."];
  }
  if (policy.schemaVersion !== SEMANTIC_GOVERNANCE_SCHEMA_VERSION) {
    warnings.push(
      `Policy schemaVersion should be ${SEMANTIC_GOVERNANCE_SCHEMA_VERSION}.`
    );
  }
  if (policy.profileId !== expectedProfileId) {
    warnings.push(
      `Policy profileId ${String(policy.profileId)} does not match requested profile ${expectedProfileId}.`
    );
  }
  if (!Array.isArray(policy.layers) || policy.layers.length === 0) {
    warnings.push("Policy must declare at least one architecture layer.");
  }
  if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
    warnings.push("Policy must declare at least one architecture rule.");
  }
  const knownLayers = new Set(ARCHITECTURE_LAYER_IDS);
  const declaredLayers = new Set<string>();
  if (Array.isArray(policy.layers)) {
    for (const layer of policy.layers) {
      if (!isPlainObject(layer) || typeof layer.id !== "string") {
        warnings.push("Each layer must be an object with an id.");
        continue;
      }
      declaredLayers.add(layer.id);
      if (!knownLayers.has(layer.id as ArchitectureLayerId)) {
        warnings.push(`Unknown layer id: ${layer.id}.`);
      }
      if (!Array.isArray(layer.pathHints)) {
        warnings.push(`Layer ${layer.id} must declare pathHints.`);
      }
    }
  }
  if (!declaredLayers.has("unknown")) {
    warnings.push("Policy must include the unknown layer.");
  }
  if (Array.isArray(policy.rules)) {
    for (const rule of policy.rules) {
      if (!isPlainObject(rule)) {
        warnings.push("Each rule must be an object.");
        continue;
      }
      if (typeof rule.id !== "string" || rule.id.trim().length === 0) {
        warnings.push("Each rule must have a stable id.");
      }
      if (
        rule.predicate !== "MAY_IMPORT" &&
        rule.predicate !== "MUST_NOT_IMPORT" &&
        rule.predicate !== "UNKNOWN_LAYER_REVIEW"
      ) {
        warnings.push(`Rule ${String(rule.id)} has an invalid predicate.`);
      }
      for (const [key, value] of [
        ["sourceLayer", rule.sourceLayer],
        ["targetLayer", rule.targetLayer],
      ] as const) {
        if (value !== "*" && typeof value === "string" && !declaredLayers.has(value)) {
          warnings.push(`Rule ${String(rule.id)} references undeclared ${key}: ${value}.`);
        }
      }
      if (rule.severity !== "allow" && rule.severity !== "warn" && rule.severity !== "block") {
        warnings.push(`Rule ${String(rule.id)} has invalid severity.`);
      }
    }
  }
  const hasUnknownRule =
    Array.isArray(policy.rules) &&
    policy.rules.some(
      (rule) => isPlainObject(rule) && rule.predicate === "UNKNOWN_LAYER_REVIEW"
    );
  if (!hasUnknownRule) {
    warnings.push("Policy must include an UNKNOWN_LAYER_REVIEW rule.");
  }
  if (!isPlainObject(policy.bypassPolicy)) {
    warnings.push("Policy must include bypassPolicy.");
  } else {
    if (policy.bypassPolicy.sourceCommentMayOnlyReferenceWaiver !== true) {
      warnings.push("bypassPolicy.sourceCommentMayOnlyReferenceWaiver must be true.");
    }
    if (policy.bypassPolicy.waiverLedgerRequired !== true) {
      warnings.push("bypassPolicy.waiverLedgerRequired must be true.");
    }
    const maxActivePerFile = policy.bypassPolicy.maxActivePerFile;
    if (
      typeof maxActivePerFile !== "number" ||
      !Number.isInteger(maxActivePerFile) ||
      maxActivePerFile < 1 ||
      maxActivePerFile > 25
    ) {
      warnings.push("bypassPolicy.maxActivePerFile must be an integer from 1 to 25.");
    }
    const ttlDays = policy.bypassPolicy.ttlDays;
    if (
      typeof ttlDays !== "number" ||
      !Number.isInteger(ttlDays) ||
      ttlDays < 1 ||
      ttlDays > 365
    ) {
      warnings.push("bypassPolicy.ttlDays must be an integer from 1 to 365.");
    }
  }
  return warnings;
}

function loadPolicy(
  workspacePath: string,
  architectureProfile: ArchitectureProfileId,
  strictUnknown: boolean
): LoadedArchitecturePolicy {
  const policyPath = path.join(
    workspacePath,
    ".github",
    "ai-harness",
    "architecture-ontology.policy.json"
  );
  const warnings: string[] = [];
  let policy: ArchitectureOntologyPolicy | null = null;
  if (fs.existsSync(policyPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(policyPath, "utf-8")) as unknown;
      const policyWarnings = validateArchitectureOntologyPolicyShape(
        parsed,
        architectureProfile
      );
      if (policyWarnings.length === 0) {
        policy = parsed as ArchitectureOntologyPolicy;
      } else {
        warnings.push(
          `Local architecture ontology policy was rejected; using generated ${architectureProfile} defaults.`,
          ...policyWarnings
        );
      }
    } catch (error) {
      warnings.push(
        `Local architecture ontology policy could not be parsed; using generated ${architectureProfile} defaults: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      policy = null;
    }
  }
  if (policy == null) {
    policy = buildArchitectureOntologyPolicyForProfile(architectureProfile);
  }
  return {
    policy: {
      ...policy,
      profileId: architectureProfile,
      unknownLayerMode: strictUnknown ? "block" : policy.unknownLayerMode ?? "warn",
    },
    warnings,
  };
}

function isSourceFile(fullPath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(fullPath).toLowerCase());
}

function shouldSkipDirectory(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  const firstSegment = normalized.split("/")[0];
  return DEFAULT_EXCLUDED_DIRS.has(normalized) || DEFAULT_EXCLUDED_DIRS.has(firstSegment);
}

function isUnsupportedSourceCandidate(relativePath: string, fullPath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  const firstSegment = normalized.split("/")[0];
  return (
    SOURCE_ROOT_HINTS.has(firstSegment) &&
    UNSUPPORTED_CODE_EXTENSIONS.has(path.extname(fullPath).toLowerCase())
  );
}

function collectSourceFiles(workspacePath: string, maxFiles: number): {
  files: string[];
  skippedByLimit: number;
  unsupportedFiles: number;
} {
  const files: string[] = [];
  let skippedByLimit = 0;
  let unsupportedFiles = 0;

  function walk(dir: string): void {
    if (files.length >= maxFiles) {
      skippedByLimit += 1;
      return;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = relativeToWorkspace(workspacePath, fullPath);
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(relativePath)) {
          walk(fullPath);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (isSourceFile(fullPath)) {
        files.push(fullPath);
        if (files.length >= maxFiles) {
          skippedByLimit += 1;
          return;
        }
      } else if (isUnsupportedSourceCandidate(relativePath, fullPath)) {
        unsupportedFiles += 1;
      }
    }
  }

  walk(workspacePath);
  return { files, skippedByLimit, unsupportedFiles };
}

function readCompilerOptions(workspacePath: string): ts.CompilerOptions {
  const tsconfigPath = path.join(workspacePath, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) {
    return {
      allowJs: true,
      checkJs: false,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      module: ts.ModuleKind.Node16,
      target: ts.ScriptTarget.ES2022,
      skipLibCheck: true,
    };
  }
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    return {};
  }
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    workspacePath
  );
  return parsed.options;
}

function classifyLayer(
  relativePath: string,
  policy: ArchitectureOntologyPolicy
): ArchitectureLayerId {
  const normalized = normalizeRelativePath(relativePath).toLowerCase();
  const sortedLayers = [...policy.layers].sort(
    (a, b) => b.pathHints.join("").length - a.pathHints.join("").length
  );
  for (const layer of sortedLayers) {
    if (layer.id === "unknown") {
      continue;
    }
    if (layer.pathHints.some((hint) => normalized.includes(hint.toLowerCase()))) {
      return layer.id;
    }
  }
  return "unknown";
}

function sourceLanguage(fullPath: string): "typescript" | "javascript" {
  return path.extname(fullPath).toLowerCase().includes("ts")
    ? "typescript"
    : "javascript";
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

function resolveModuleSpecifier(
  workspacePath: string,
  compilerOptions: ts.CompilerOptions,
  containingFile: string,
  specifier: string
): { resolvedPath: string | null; confidence: ScanConfidence } {
  const resolved = ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    ts.sys
  ).resolvedModule?.resolvedFileName;
  if (resolved && !resolved.includes("/node_modules/") && !resolved.includes("\\node_modules\\")) {
    const full = path.resolve(resolved);
    if (full.startsWith(path.resolve(workspacePath))) {
      return { resolvedPath: relativeToWorkspace(workspacePath, full), confidence: "high" };
    }
  }

  if (specifier.startsWith(".")) {
    const base = path.resolve(path.dirname(containingFile), specifier);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      base.replace(/\.js$/, ".ts"),
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
      path.join(base, "index.js"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && isSourceFile(candidate)) {
        return {
          resolvedPath: relativeToWorkspace(workspacePath, candidate),
          confidence: "medium",
        };
      }
    }
  }

  return { resolvedPath: null, confidence: specifier.startsWith(".") ? "low" : "high" };
}

function edgeId(edge: Omit<SourceDependencyEdge, "id">): string {
  return `edge:${stableHash({
    fromPath: edge.fromPath,
    toPath: edge.toPath,
    kind: edge.kind,
    line: edge.line,
    specifier: edge.specifier,
  }).slice(0, 16)}`;
}

function edgeFingerprint(edge: {
  fromPath: string;
  toPath: string | null;
  kind: SourceEdgeKind;
  line: number;
  specifier: string;
}): string {
  return stableHash(edge).slice(0, 24);
}

function declarationKind(node: ts.Node): string {
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isVariableStatement(node)) return "variable";
  return ts.SyntaxKind[node.kind] ?? "unknown";
}

function declarationName(node: ts.Node): string | null {
  if (
    (ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)) &&
    node.name
  ) {
    return node.name.text;
  }
  if (ts.isVariableStatement(node)) {
    const names = node.declarationList.declarations
      .map((declaration) =>
        ts.isIdentifier(declaration.name) ? declaration.name.text : null
      )
      .filter((value): value is string => value != null);
    return names.join(", ") || null;
  }
  return null;
}

function addEdge(
  edges: SourceDependencyEdge[],
  policy: ArchitectureOntologyPolicy,
  workspacePath: string,
  fromPath: string,
  fromLayer: ArchitectureLayerId,
  kind: SourceEdgeKind,
  specifier: string,
  line: number,
  resolvedPath: string | null,
  confidence: ScanConfidence
): void {
  const toLayer: SourceDependencyEdge["toLayer"] =
    resolvedPath == null
      ? specifier.startsWith(".")
        ? "unresolved"
        : "external"
      : classifyLayer(resolvedPath, policy);
  const baseEdge: Omit<SourceDependencyEdge, "id"> = {
    fromPath,
    toPath: resolvedPath,
    fromLayer,
    toLayer,
    specifier,
    kind,
    line,
    confidence,
    fingerprint: edgeFingerprint({
      fromPath,
      toPath: resolvedPath,
      kind,
      line,
      specifier,
    }),
  };
  edges.push({ ...baseEdge, id: edgeId(baseEdge) });
}

function resolveSymbolPath(
  checker: ts.TypeChecker,
  workspacePath: string,
  node: ts.Node
): string | null {
  const symbol = checker.getSymbolAtLocation(node);
  const declarations = symbol?.getDeclarations() ?? [];
  for (const declaration of declarations) {
    const fullPath = path.resolve(declaration.getSourceFile().fileName);
    if (
      !fullPath.includes("node_modules") &&
      fullPath.startsWith(path.resolve(workspacePath)) &&
      isSourceFile(fullPath)
    ) {
      return relativeToWorkspace(workspacePath, fullPath);
    }
  }
  return null;
}

function extractSourceFileFacts(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  workspacePath: string,
  compilerOptions: ts.CompilerOptions,
  policy: ArchitectureOntologyPolicy,
  edges: SourceDependencyEdge[]
): SourceFileFact {
  const fromPath = relativeToWorkspace(workspacePath, path.resolve(sourceFile.fileName));
  const fromLayer = classifyLayer(fromPath, policy);
  const declarations: SourceDeclarationFact[] = [];
  const imports: SourceImportFact[] = [];

  function recordImport(
    kind: SourceEdgeKind,
    specifier: string,
    node: ts.Node
  ): void {
    const resolved = resolveModuleSpecifier(
      workspacePath,
      compilerOptions,
      sourceFile.fileName,
      specifier
    );
    const fact = {
      specifier,
      kind,
      line: lineOf(sourceFile, node),
      resolvedPath: resolved.resolvedPath,
      confidence: resolved.confidence,
    };
    imports.push(fact);
    addEdge(
      edges,
      policy,
      workspacePath,
      fromPath,
      fromLayer,
      kind,
      specifier,
      fact.line,
      fact.resolvedPath,
      fact.confidence
    );
  }

  function recordSymbolEdge(
    kind: SourceEdgeKind,
    expression: ts.Node,
    line: number
  ): void {
    const resolvedPath = resolveSymbolPath(checker, workspacePath, expression);
    if (resolvedPath == null || resolvedPath === fromPath) {
      return;
    }
    addEdge(
      edges,
      policy,
      workspacePath,
      fromPath,
      fromLayer,
      kind,
      expression.getText(sourceFile),
      line,
      resolvedPath,
      "medium"
    );
  }

  function visit(node: ts.Node): void {
    const name = declarationName(node);
    if (name) {
      declarations.push({
        name,
        kind: declarationKind(node),
        line: lineOf(sourceFile, node),
      });
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      recordImport("imports", node.moduleSpecifier.text, node);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      recordImport("exports", node.moduleSpecifier.text, node);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      recordImport("dynamic-import", node.arguments[0].text, node);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      recordImport("require", node.arguments[0].text, node);
    } else if (ts.isHeritageClause(node)) {
      const kind = node.token === ts.SyntaxKind.ExtendsKeyword ? "extends" : "implements";
      for (const typeNode of node.types) {
        recordSymbolEdge(kind, typeNode.expression, lineOf(sourceFile, typeNode));
      }
    } else if (ts.isNewExpression(node) && node.expression) {
      recordSymbolEdge("new", node.expression, lineOf(sourceFile, node));
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    path: fromPath,
    language: sourceLanguage(sourceFile.fileName),
    layer: fromLayer,
    declarations,
    imports,
  };
}

export function scanSourceGraph(
  options: ScanSourceGraphOptions
): SourceGraphSnapshot {
  if (!path.isAbsolute(options.workspacePath)) {
    throw new Error("workspacePath must be absolute");
  }
  const workspacePath = fs.realpathSync.native(options.workspacePath);
  const maxFiles = Math.max(1, Math.min(options.maxFiles ?? 500, 5000));
  const architectureProfile = resolveArchitectureProfile(
    options.architectureProfile,
    workspacePath
  );
  const loadedPolicy = loadPolicy(workspacePath, architectureProfile, false);
  const policy = loadedPolicy.policy;
  const compilerOptions = readCompilerOptions(workspacePath);
  const collected = collectSourceFiles(workspacePath, maxFiles);
  const program = ts.createProgram({
    rootNames: collected.files,
    options: {
      ...compilerOptions,
      allowJs: true,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true,
    },
  });
  const checker = program.getTypeChecker();
  const edges: SourceDependencyEdge[] = [];
  const fileSet = new Set(collected.files.map((file) => path.resolve(file)));
  const files = program
    .getSourceFiles()
    .filter((sourceFile) => fileSet.has(path.resolve(sourceFile.fileName)))
    .map((sourceFile) =>
      extractSourceFileFacts(
        sourceFile,
        checker,
        workspacePath,
        compilerOptions,
        policy,
        edges
      )
    )
    .sort((left, right) => left.path.localeCompare(right.path));

  edges.sort((left, right) =>
    `${left.fromPath}:${left.line}:${left.specifier}`.localeCompare(
      `${right.fromPath}:${right.line}:${right.specifier}`
    )
  );

  return {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: nowIso(),
    workspaceRootHash: stableHash(workspacePath),
    toolVersion: WORKSPACE_INIT_MCP_VERSION,
    architectureProfileId: architectureProfile,
    scan: {
      sourceFileCount: files.length,
      dependencyEdgeCount: edges.length,
      maxFiles,
      skippedByLimit: collected.skippedByLimit,
      unsupportedFiles: collected.unsupportedFiles,
    },
    warnings: loadedPolicy.warnings,
    files,
    edges,
  };
}

function isLayer(value: string): value is ArchitectureLayerId {
  return !EXTERNAL_LAYERS.has(value);
}

function matchingRules(
  policy: ArchitectureOntologyPolicy,
  edge: SourceDependencyEdge,
  predicate: ArchitecturePolicyRule["predicate"]
): ArchitecturePolicyRule[] {
  if (!isLayer(edge.toLayer)) {
    return [];
  }
  return policy.rules.filter(
    (rule) =>
      rule.predicate === predicate &&
      (rule.sourceLayer === "*" || rule.sourceLayer === edge.fromLayer) &&
      (rule.targetLayer === "*" || rule.targetLayer === edge.toLayer)
  );
}

function layerVector(
  policy: ArchitectureOntologyPolicy,
  layer: ArchitectureLayerId | "external" | "unresolved"
): [number, number, number] {
  if (!isLayer(layer)) {
    return [2, 2, 5];
  }
  const definition =
    policy.layers.find((candidate) => candidate.id === layer) ??
    policy.layers.find((candidate) => candidate.id === "unknown");
  return [
    Math.max(0, Math.min(5, Math.round(definition?.depth ?? 2))),
    Math.max(0, Math.min(5, Math.round(definition?.access ?? 2))),
    Math.max(0, Math.min(5, Math.round(definition?.volatility ?? 4))),
  ];
}

function vectorDistance(
  left: [number, number, number],
  right: [number, number, number]
): number {
  return Number(
    Math.sqrt(
      (left[0] - right[0]) ** 2 +
      (left[1] - right[1]) ** 2 +
      (left[2] - right[2]) ** 2
    ).toFixed(2)
  );
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .map(normalizeRelativePath)
    .sort();
}

function distanceBucket(distance: number): "near" | "medium" | "far" {
  if (distance < 2) return "near";
  if (distance < 4) return "medium";
  return "far";
}

function buildAsciiMap(
  sourcePath: string,
  targetPath: string | null,
  source: [number, number, number],
  target: [number, number, number]
): string {
  const rows: string[] = [
    "[LAYER MAP] X=Access, Y=Layer Depth, cell marker carries volatility",
    "PRIVILEGE: 0(Priv) 1     2     3     4     5(Pub)",
    "---------------------------------------------------",
  ];
  for (let y = 5; y >= 0; y -= 1) {
    const label =
      y === 5 ? "5(Pres) |" : y === 3 ? "3(Biz)  |" : y === 0 ? "0(Data) |" : `${y}       |`;
    let row = label;
    for (let x = 0; x <= 5; x += 1) {
      const hasSource = x === source[1] && y === source[0];
      const hasTarget = x === target[1] && y === target[0];
      if (hasSource && hasTarget) {
        row += ` ST:${Math.max(source[2], target[2])}`;
      } else if (hasSource) {
        row += ` S:${source[2]} `;
      } else if (hasTarget) {
        row += ` T:${target[2]} `;
      } else {
        row += " .   ";
      }
    }
    rows.push(row);
  }
  rows.push("---------------------------------------------------");
  rows.push(`S=${sourcePath}`);
  rows.push(`T=${targetPath ?? "unresolved/external"}`);
  return rows.join("\n");
}

function violationForEdge(
  policy: ArchitectureOntologyPolicy,
  edge: SourceDependencyEdge,
  rule: ArchitecturePolicyRule,
  severity: SemanticVerdict,
  message: string
): SemanticViolation {
  const sourceVector = layerVector(policy, edge.fromLayer);
  const targetVector = layerVector(policy, edge.toLayer);
  const distance = vectorDistance(sourceVector, targetVector);
  const suggestedPath = rule.suggestedPath?.join(" -> ");
  const suggestedAction =
    suggestedPath != null
      ? `Route the dependency through ${suggestedPath}.`
      : "Classify the source and target layers, then introduce an allowed boundary or interface.";

  return {
    id: `violation:${stableHash({
      rule: rule.id,
      fingerprint: edge.fingerprint,
    }).slice(0, 16)}`,
    ruleId: rule.id,
    severity,
    message,
    sourcePath: edge.fromPath,
    targetPath: edge.toPath,
    sourceLayer: edge.fromLayer,
    targetLayer: edge.toLayer,
    edgeKind: edge.kind,
    line: edge.line,
    fingerprint: edge.fingerprint,
    confidence: edge.confidence,
    evidenceRefs: [
      edge.fromPath,
      edge.toPath ?? edge.specifier,
      ".github/ai-harness/architecture-ontology.policy.json",
    ],
    suggestedAction,
    spatialSignature: {
      source: sourceVector,
      target: targetVector,
      distance,
    },
    asciiMap: buildAsciiMap(edge.fromPath, edge.toPath, sourceVector, targetVector),
  };
}

function evaluateEdge(
  policy: ArchitectureOntologyPolicy,
  edge: SourceDependencyEdge
): SemanticViolation | null {
  if (edge.toLayer === "external") {
    return null;
  }

  if (edge.toLayer === "unresolved" || edge.fromLayer === "unknown" || edge.toLayer === "unknown") {
    const rule =
      policy.rules.find((candidate) => candidate.predicate === "UNKNOWN_LAYER_REVIEW") ??
      {
        id: "semantic.unknown-layer-requires-review",
        predicate: "UNKNOWN_LAYER_REVIEW" as const,
        sourceLayer: "*",
        targetLayer: "unknown" as const,
        severity: policy.unknownLayerMode,
        rationale:
          "Unclassified or unresolved dependency edges need explicit review.",
      };
    return violationForEdge(
      policy,
      edge,
      rule,
      policy.unknownLayerMode,
      `Unclassified semantic edge: ${edge.fromPath} -> ${edge.toPath ?? edge.specifier}.`
    );
  }

  if (edge.fromLayer === edge.toLayer) {
    return null;
  }

  const denyRule = matchingRules(policy, edge, "MUST_NOT_IMPORT")[0];
  if (denyRule) {
    return violationForEdge(
      policy,
      edge,
      denyRule,
      denyRule.severity,
      `Architecture violation: ${edge.fromLayer} cannot ${edge.kind} ${edge.toLayer}.`
    );
  }

  if (matchingRules(policy, edge, "MAY_IMPORT").length > 0) {
    return null;
  }

  const implicitRule: ArchitecturePolicyRule = {
    id: `${policy.profileId}.implicit-unlisted-edge-review`,
    predicate: "UNKNOWN_LAYER_REVIEW",
    sourceLayer: edge.fromLayer,
    targetLayer: edge.toLayer,
    severity: policy.enforcementMode === "strict" ? "block" : "warn",
    rationale:
      "The architecture ontology does not list this layer relation as allowed.",
  };
  return violationForEdge(
    policy,
    edge,
    implicitRule,
    implicitRule.severity,
    `Unlisted architecture relation: ${edge.fromLayer} -> ${edge.toLayer}.`
  );
}

export function validateSemanticGovernance(
  options: ValidateSemanticGovernanceOptions
): SemanticGovernanceEvaluation {
  const workspacePath = fs.realpathSync.native(options.workspacePath);
  const architectureProfile = resolveArchitectureProfile(
    options.architectureProfile,
    workspacePath
  );
  const sourceGraph = scanSourceGraph({
    workspacePath: options.workspacePath,
    architectureProfile,
    maxFiles: options.maxFiles,
  });
  const loadedPolicy = loadPolicy(
    workspacePath,
    architectureProfile,
    options.strictUnknown ?? false
  );
  const policy = loadedPolicy.policy;
  const policyWarnings = [...sourceGraph.warnings, ...loadedPolicy.warnings];
  const findings = sourceGraph.edges
    .map((edge) => evaluateEdge(policy, edge))
    .filter((violation): violation is SemanticViolation => violation != null);
  const violations = findings.filter((finding) => finding.severity === "block");
  const warnings = findings.filter((finding) => finding.severity !== "block");
  const verdict: SemanticVerdict =
    violations.length > 0 ? "block" : warnings.length > 0 ? "warn" : "allow";

  return {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: nowIso(),
    profileId: architectureProfile,
    verdict,
    summary: [
      `Semantic governance verdict: ${verdict}`,
      `Files scanned: ${sourceGraph.scan.sourceFileCount}`,
      `Edges evaluated: ${sourceGraph.scan.dependencyEdgeCount}`,
      `Blocked edges: ${violations.length}`,
      `Warning edges: ${warnings.length}`,
      `Policy warnings: ${policyWarnings.length}`,
    ].join("\n"),
    sourceGraph,
    policy,
    policyWarnings,
    violations,
    warnings,
    metrics: {
      filesScanned: sourceGraph.scan.sourceFileCount,
      edgesEvaluated: sourceGraph.scan.dependencyEdgeCount,
      blockedEdges: violations.length,
      warningEdges: warnings.length,
      unresolvedEdges: sourceGraph.edges.filter((edge) => edge.toLayer === "unresolved").length,
    },
  };
}

export function buildSemanticContextPack(
  options: SemanticContextPackOptions
): SemanticContextPack {
  const evaluation = validateSemanticGovernance(options);
  const tokenBudget = options.tokenBudget ?? "lean";
  const maxFindings =
    tokenBudget === "thorough" ? 20 : tokenBudget === "balanced" ? 10 : 5;
  const maxGraphNodes = tokenBudget === "thorough" ? 100 : tokenBudget === "balanced" ? 60 : 30;
  const targetSet = new Set(
    (options.targetPaths ?? []).map((targetPath) => normalizeRelativePath(targetPath))
  );
  const allFindings = [...evaluation.violations, ...evaluation.warnings].filter(
    (finding) =>
      targetSet.size === 0 ||
      targetSet.has(finding.sourcePath) ||
      (finding.targetPath != null && targetSet.has(finding.targetPath))
  );
  const selectedFindings = allFindings.slice(0, maxFindings);
  const antiPatternGroups = new Map<string, typeof selectedFindings>();
  for (const finding of allFindings) {
    const key = `${finding.ruleId}:${finding.sourceLayer}->${finding.targetLayer}`;
    antiPatternGroups.set(key, [...(antiPatternGroups.get(key) ?? []), finding]);
  }
  const antiPatterns = [...antiPatternGroups.entries()]
    .filter(([, findings]) => findings.length > 1)
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .slice(0, tokenBudget === "lean" ? 3 : tokenBudget === "balanced" ? 6 : 12)
    .map(([key, findings]) => ({
      id: `anti-pattern:${stableHash(key).slice(0, 12)}`,
      ruleId: findings[0].ruleId,
      relation: `${findings[0].sourceLayer}->${findings[0].targetLayer}`,
      occurrenceCount: findings.length,
      exampleRefs: uniqueSorted(
        findings.flatMap((finding) => [finding.sourcePath, finding.targetPath])
      ).slice(0, 6),
      attentionPrompt:
        `Repeated ${findings[0].sourceLayer}->${findings[0].targetLayer} violation. Check this pattern before accepting similar edits.`,
    }));
  const selectedFiles = new Set<string>();
  for (const finding of selectedFindings) {
    selectedFiles.add(finding.sourcePath);
    if (finding.targetPath) {
      selectedFiles.add(finding.targetPath);
    }
  }

  const graphNodes = evaluation.sourceGraph.files
    .filter((file) => selectedFiles.size === 0 || selectedFiles.has(file.path))
    .slice(0, maxGraphNodes)
    .map((file) => ({
      "@id": `file:${file.path}`,
      "@type": "SourceFile",
      layer: file.layer,
      declarations: file.declarations.map((declaration) => declaration.name).slice(0, 12),
    }));
  const graphEdges = selectedFindings.map((finding) => ({
    "@id": `edge:${finding.fingerprint}`,
    "@type": "DependencyEdge",
    source: `file:${finding.sourcePath}`,
    target: finding.targetPath ? `file:${finding.targetPath}` : finding.targetLayer,
    relation: finding.edgeKind,
    verdict: finding.severity,
    rule: finding.ruleId,
  }));
  const quantizedSignatures = selectedFindings.map((finding) => ({
    id: `qsig:${finding.fingerprint}`,
    advisoryOnly: true,
    ruleId: finding.ruleId,
    severity: finding.severity,
    edgeKind: finding.edgeKind,
    sourceLayer: finding.sourceLayer,
    targetLayer: finding.targetLayer,
    sourceVector: finding.spatialSignature.source,
    targetVector: finding.spatialSignature.target,
    distanceBucket: distanceBucket(finding.spatialSignature.distance),
    fingerprint: finding.fingerprint,
    sourceRefs: uniqueSorted([finding.sourcePath, finding.targetPath]),
  }));
  const sourceRefs = uniqueSorted([
    ".github/ai-harness/architecture-ontology.policy.json",
    ...selectedFindings.flatMap((finding) => finding.evidenceRefs),
    ...evaluation.policyWarnings.map(() => ".github/ai-harness/architecture-ontology.policy.json"),
  ]);
  const promptTemplate = [
    "You are reviewing a compressed semantic-governance context pack.",
    "Authority order: exact source graph, ontology policy, governance receipts, waiver ledger, then compressed aids.",
    "Do not treat quantized signatures, ASCII maps, or anti-pattern prompts as proof.",
    "Use ruleFacts and sourceRefs to cite every decision.",
    "If a required sourceRef is missing or the pack warns about policy quality, ask for a fresh scan before allowing risky work.",
  ].join("\n");
  const warnings = [
    ...evaluation.policyWarnings,
    ...evaluation.warnings.map((warning) => warning.message),
  ].slice(0, maxFindings);
  const contentForHash = {
    profileId: evaluation.profileId,
    tokenBudget,
    verdict: evaluation.verdict,
    graphNodes,
    graphEdges,
    tree: selectedFindings.map((finding) => ({
      source: finding.sourcePath,
      sourceLayer: finding.sourceLayer,
      target: finding.targetPath ?? finding.targetLayer,
      targetLayer: finding.targetLayer,
      rule: finding.ruleId,
      verdict: finding.severity,
      repair: finding.suggestedAction,
    })),
    ruleFacts: selectedFindings.map((finding) => ({
      ruleId: finding.ruleId,
      line: finding.line,
      fingerprint: finding.fingerprint,
      message: finding.message,
      confidence: finding.confidence,
      evidenceRefs: finding.evidenceRefs,
    })),
    antiPatterns,
    quantizedSignatures,
    sourceRefs,
    warnings,
  };
  const contentHash = stableHash(contentForHash);

  return {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: nowIso(),
    profileId: evaluation.profileId,
    tokenBudget,
    verdict: evaluation.verdict,
    contentHash,
    compression: {
      authority: "exact-graph-policy-receipts",
      mode: tokenBudget,
      maxFindings,
      maxGraphNodes,
      selectedFindingCount: selectedFindings.length,
      totalFindingCount: allFindings.length,
      estimatedJsonChars: JSON.stringify(contentForHash).length,
      advisoryCompressionOnly: true,
    },
    jsonLd: {
      "@context": {
        file: "https://workspace-init-mcp.local/ontology/file",
        layer: "https://workspace-init-mcp.local/ontology/layer",
        relation: "https://workspace-init-mcp.local/ontology/relation",
        verdict: "https://workspace-init-mcp.local/ontology/verdict",
        rule: "https://workspace-init-mcp.local/ontology/rule",
      },
      "@graph": [...graphNodes, ...graphEdges],
    },
    tree: selectedFindings.map((finding) => ({
      source: finding.sourcePath,
      sourceLayer: finding.sourceLayer,
      target: finding.targetPath ?? finding.targetLayer,
      targetLayer: finding.targetLayer,
      rule: finding.ruleId,
      verdict: finding.severity,
      repair: finding.suggestedAction,
    })),
    ruleFacts: selectedFindings.map((finding) => ({
      ruleId: finding.ruleId,
      line: finding.line,
      fingerprint: finding.fingerprint,
      message: finding.message,
      confidence: finding.confidence,
      evidenceRefs: finding.evidenceRefs,
    })),
    antiPatterns,
    quantizedSignatures,
    spatialMaps: selectedFindings.map((finding) => finding.asciiMap),
    promptTemplate,
    sourceRefs,
    warnings,
    summary: evaluation.summary,
  };
}
