import {
  SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
  type ArchitectureOntologyPolicy,
} from "../data/ontology-contract.js";
import {
  buildArchitectureOntologyPolicyForProfile,
  buildArchitectureProfilesCatalog,
  listArchitectureProfileDefinitions,
  resolveDefaultArchitectureProfileId,
} from "../data/architecture-profiles.js";
import { WORKSPACE_INIT_MCP_VERSION } from "../data/version.js";
import {
  type GeneratedFile,
  type WorkspaceInitParams,
} from "../types.js";

export function buildDefaultArchitectureOntologyPolicy(
  params: WorkspaceInitParams
): ArchitectureOntologyPolicy {
  return buildArchitectureOntologyPolicyForProfile(
    resolveDefaultArchitectureProfileId(params)
  );
}

function jsonFile(relativePath: string, value: unknown): GeneratedFile {
  return {
    relativePath,
    content: `${JSON.stringify(value, null, 2)}\n`,
  };
}

function buildOntologyReadme(params: WorkspaceInitParams): string {
  return `# Semantic Governance Ontology

This directory stores the local-first semantic governance layer for ${params.workspaceName}.

The ontology layer is advisory until a project explicitly opts into hard enforcement.
It exists to make architecture facts, source dependency edges, violations, waivers,
and compact agent context packs deterministic and auditable.

## Supported Profiles

${listArchitectureProfileDefinitions()
  .map((profile) => `- \`${profile.profileId}\`: ${profile.summary}`)
  .join("\n")}

## Authority Order

1. Exact source graph and ontology policy
2. Governance evaluation receipts
3. Compact JSON-LD / tree context packs
4. Quantized signatures and ASCII maps

Quantized vectors and ASCII maps help small models understand violations. They never
decide whether a dependency is allowed.

## Generated State

- \`state/source-graph.json\`: last source graph scan
- \`state/governance-evaluation.json\`: last read-only architecture evaluation
- \`state/semantic-warehouse.json\`: deterministic semantic fact-table projection
- \`state/waiver-validation.json\`: last waiver ledger/source-comment validation
- \`state/enforcement-report.json\`: last opt-in strict/ci/report enforcement gate result
- \`state/bypass-ledger.json\`: local waiver ledger placeholder
- \`state/waiver-revocations.json\`: signed waiver revocation receipt ledger
- \`state/context-pack.example.json\`: compact prompt context example
- \`.github/ai-harness/governance-trust.json\`: trusted reviewer public keys for signed approvals

## Bypass Rule

Source comments may only reference a waiver id. They cannot authorize an exception.
A waiver must live in the ledger with owner, trusted-reviewer approval signature,
local evidence, expiry, affected rule, exact edge fingerprint, max-use limits,
and a source comment on the violating file. The active lifetime must stay within
the profile's \`ttlDays\`, and each file must stay under \`maxActivePerFile\`.
Active waiver validation also requires \`state/waiver-revocations.json\` to be
anchored in git history. Trusted signed revocation receipts are append-only:
once they appear in a baseline ref, deleting or rolling them back blocks the
waiver.

Source comment format:

- Allowed reference: \`// semantic-waiver: waiver.example.001\`
- Forbidden self-authorization: \`// semantic-waiver: waiver.example.001 allow bypass\`
`;
}

function buildPolicyAuthoringGuide(params: WorkspaceInitParams): string {
  const activeProfile = resolveDefaultArchitectureProfileId(params);
  const profiles = listArchitectureProfileDefinitions()
    .map((profile) => {
      const allowed = profile.authoringGuidance.allowedDependencyExamples
        .map((example) => `  - allow: \`${example}\``)
        .join("\n");
      const blocked = profile.authoringGuidance.blockedDependencyExamples
        .map((example) => `  - block: \`${example}\``)
        .join("\n");
      const hints = profile.authoringGuidance.pathHintGuidance
        .map((hint) => `  - ${hint}`)
        .join("\n");
      return [
        `## ${profile.label} (\`${profile.profileId}\`)`,
        "",
        profile.authoringGuidance.intent,
        "",
        "Examples:",
        allowed,
        blocked,
        "",
        "Path hint guidance:",
        hints,
      ].join("\n");
    })
    .join("\n\n");

  return `# Architecture Ontology Policy Authoring

Active bootstrap profile: \`${activeProfile}\`

The architecture ontology policy is local-first and deterministic. Edit
\`.github/ai-harness/architecture-ontology.policy.json\` when the project has a
real architecture convention that differs from the generated defaults.

Authoring rules:

1. Keep \`schemaVersion\`, \`profileId\`, \`layers\`, \`rules\`, and \`bypassPolicy\`.
2. Every rule must use declared layer ids or \`*\`.
3. Unknown or unresolved edges must warn or block; they must never silently allow.
4. Source comments may reference waiver ids only. They do not authorize bypass.
5. Prefer adding precise path hints before weakening a blocking rule.

${profiles}
`;
}

function buildSemanticContextPromptTemplate(): string {
  return `# Semantic Context Pack Prompt Template

Use this template when injecting \`get_semantic_context_pack\` output into a small or resumed model.

## Instruction

You are reviewing compressed semantic governance facts. Treat the compressed pack
as an index, not as the final authority.

Authority order:

1. Exact source graph
2. Architecture ontology policy
3. Governance evaluation receipts
4. Waiver ledger
5. Context pack JSON-LD/tree/rule facts
6. Anti-pattern prompts, quantized signatures, and ASCII maps

Rules:

- Cite \`ruleFacts[].ruleId\`, \`fingerprint\`, and \`sourceRefs\` for every decision.
- Do not allow a dependency because a quantized signature looks close.
- Do not block a dependency solely because an anti-pattern prompt sounds similar.
- If \`warnings\` mention policy quality, request a fresh scan or exact source ref before proceeding.
- If \`sourceRefs\` are missing for a claim, treat the claim as unverified.

## Expected Input

\`\`\`json
{
  "contentHash": "...",
  "compression": { "advisoryCompressionOnly": true },
  "ruleFacts": [],
  "antiPatterns": [],
  "quantizedSignatures": [],
  "sourceRefs": []
}
\`\`\`

## Response Shape

Return:

1. verdict: allow, warn, or block
2. cited rule ids
3. cited source refs
4. uncertainty or missing evidence
5. next safe action
`;
}

function buildPolicyPacksReadme(): string {
  return `# Architecture Policy Packs

Policy packs let teams share mature architecture ontology policies through local
GitOps review. They are intentionally local-first and fail closed:

- No automatic central upload.
- Import defaults to review-only.
- Pack import verifies the pack hash, pack signature, trust flags, and
  workspace-contained read path before any merge.
- Applying a pack requires reviewer identity, a workspace-contained approval
  evidence file, trusted-reviewer Ed25519 approval signature, the prior review
  receipt path, and the expected review signature from that receipt.
- Local policy remains authoritative unless \`import_architecture_policy_pack\`
  is called with \`applyMerge: true\`.
- Applied imports write a backup under \`backups/\` and a review receipt under
  \`imports/\`.

Recommended flow:

1. Run \`export_architecture_policy_pack\` with \`writePack: true\`.
2. Review the exported JSON in a branch or pull request.
3. Create a local approval evidence file, for example under \`docs/decisions/\`.
4. Run \`import_architecture_policy_pack\` without \`applyMerge\` and with
   \`writeReview: true\`.
5. Copy the returned \`reviewReceiptPath\` and \`expectedReviewSignature\` into
   the apply request after reviewer and approval refs are final.
6. Apply with \`mergeStrategy: "replace-profile"\` only when the review is ready.
`;
}

export function generateOntologyFiles(
  params: WorkspaceInitParams
): GeneratedFile[] {
  if (params.includeHarnessEngineering === false) {
    return [];
  }

  const policy = buildDefaultArchitectureOntologyPolicy(params);
  const emptySourceGraph = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: "bootstrap",
    workspaceRootHash: "bootstrap",
    toolVersion: WORKSPACE_INIT_MCP_VERSION,
    architectureProfileId: policy.profileId,
    scan: {
      sourceFileCount: 0,
      dependencyEdgeCount: 0,
      maxFiles: 0,
      skippedByLimit: 0,
      unsupportedFiles: 0,
    },
    warnings: [
      "Bootstrap source graph is empty until scan_source_graph or validate_architecture_governance runs.",
    ],
    files: [],
    edges: [],
  };
  const emptyEvaluation = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: "bootstrap",
    profileId: policy.profileId,
    verdict: "warn",
    summary:
      "Semantic governance is initialized but no source graph scan has been recorded yet.",
    sourceGraphRef: "docs/ai-harness/ontology/state/source-graph.json",
    policyRef: ".github/ai-harness/architecture-ontology.policy.json",
    policyWarnings: [],
    violations: [],
    warnings: [
      {
        id: "semantic.bootstrap-no-source-graph",
        ruleId: "semantic.source-graph-required",
        severity: "warn",
        message:
          "Run scan_source_graph or validate_architecture_governance before treating semantic governance as evidence.",
      },
    ],
  };
  const bypassLedger = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: "bootstrap",
    policy:
      "Source comments may reference waiver ids only. Waivers require owner, trusted-reviewer approval signature, evidence ref, expiry, exact edge fingerprint, and maxUses.",
    requiredFields: [
      "id",
      "ruleId",
      "edgeFingerprint",
      "owner",
      "approvedBy",
      "approvalRef",
      "approvalSignature",
      "status",
      "createdAt",
      "expiresAt",
      "evidenceRefs",
      "maxUses",
      "rationale",
    ],
    sourceCommentRule:
      "Use semantic-waiver: <id> as a reference only; comments cannot approve, bypass, skip, ignore, or override governance.",
    waivers: [],
  };
  const emptySemanticWarehouse = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    profileId: policy.profileId,
    verdict: "warn",
    snapshotHash: "bootstrap",
    viewSummaries: [
      "files",
      "symbols",
      "dependencyEdges",
      "rules",
      "violations",
      "evidenceRefs",
      "waivers",
      "claims",
      "completedFacts",
    ].map((view) => ({ view, rowCount: 0 })),
    views: {
      files: [],
      symbols: [],
      dependencyEdges: [],
      rules: [],
      violations: [],
      evidenceRefs: [],
      waivers: [],
      claims: [],
      completedFacts: [],
    },
    warnings: [
      "Bootstrap semantic warehouse is empty until query_semantic_warehouse or validate_architecture_governance runs.",
    ],
  };
  const waiverRevocations = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: "bootstrap",
    policy:
      "Signed revocation receipts override active waiver approvals. Revocations require trusted reviewer signatures and append-only git-history anchoring.",
    revocations: [],
  };
  const emptyWaiverValidation = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: "bootstrap",
    verdict: "warn",
    summary:
      "Waiver validation has not run yet. Source comments cannot authorize exceptions.",
    ledgerPath: "docs/ai-harness/ontology/state/bypass-ledger.json",
    sourceReferences: [],
    findings: [
      {
        id: "waiver-finding.bootstrap-not-run",
        status: "missing-evidence",
        severity: "warn",
        waiverId: null,
        ruleId: null,
        edgeFingerprint: null,
        sourcePath: null,
        line: null,
        message:
          "Run validate_architecture_waivers before treating waiver state as evidence.",
        evidenceRefs: ["docs/ai-harness/ontology/state/bypass-ledger.json"],
      },
    ],
    metrics: {
      waivers: 0,
      sourceReferences: 0,
      validWaivers: 0,
      blockedFindings: 0,
      warningFindings: 1,
    },
  };
  const emptyEnforcementReport = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: "bootstrap",
    enforcementMode: "report",
    optInOnly: true,
    profileId: policy.profileId,
    gate: "disabled",
    canProceed: true,
    summary:
      "Semantic enforcement has not run yet. Report mode is advisory; strict and ci modes are explicit opt-in gates.",
    decisions: [],
    governance: emptyEvaluation,
    waiverValidation: emptyWaiverValidation,
    metrics: {
      blockedViolations: 0,
      waivedViolations: 0,
      warningDecisions: 0,
      waiverBlockFindings: 0,
      waiverWarningFindings: 0,
      policyWarnings: 0,
      skippedByLimit: 0,
      unsupportedFiles: 0,
      strictUnknownForced: false,
      failOnWarnings: false,
    },
    markdown:
      "# Semantic Enforcement Report\n\nGate: disabled\n\nRun enforce_architecture_governance to produce a CI/PR-ready report.\n",
  };
  const emptyEnforcementMarkdown = `# Semantic Enforcement Report

Schema version: ${SEMANTIC_GOVERNANCE_SCHEMA_VERSION}
Generated at: bootstrap
Gate: disabled
Mode: report
Opt-in: yes

Run \`enforce_architecture_governance\` to produce a CI/PR-ready report.
Report mode is advisory; strict and ci modes are explicit blocking gates.
`;
  const emptyPolicyPackImportReview = {
    receiptKind: "architecture-policy-pack-import-review",
    receiptVersion: 1,
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: "bootstrap",
    status: "review-required",
    packId: null,
    packPath: "docs/ai-harness/ontology/policy-packs/exports/",
    mergeStrategy: "review-only",
    canApply: false,
    applied: false,
    expectedReviewSignature: null,
    policyHash: null,
    packSignature: null,
    approvalEvidenceRef: null,
    approvalEvidenceHash: null,
    reviewedBy: null,
    approvalRef: null,
    approvalSignature: null,
    approvalSignatureVerified: false,
    reviewSignature: null,
    conflicts: [],
    errors: [
      "No policy pack has been reviewed yet. Run import_architecture_policy_pack in review-only mode first.",
    ],
    localPolicyRef: ".github/ai-harness/architecture-ontology.policy.json",
    backupPath: null,
    reviewReceiptPath: null,
    sourceRefs: [".github/ai-harness/architecture-ontology.policy.json"],
    summary:
      "Policy pack import review has not run yet. Local policy remains authoritative.",
  };
  const governanceTrust = {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    generatedAt: "bootstrap",
    reviewers: [],
    policy:
      "Add trusted reviewer Ed25519 public keys before signed waivers or policy-pack applies can pass strict governance.",
    exampleReviewer: {
      id: "principal-architect",
      status: "active",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----",
    },
  };

  return [
    jsonFile(".github/ai-harness/architecture-ontology.policy.json", policy),
    jsonFile(".github/ai-harness/governance-trust.json", governanceTrust),
    {
      relativePath: "docs/ai-harness/ontology/README.md",
      content: buildOntologyReadme(params),
    },
    {
      relativePath: "docs/ai-harness/ontology/policy-authoring.md",
      content: buildPolicyAuthoringGuide(params),
    },
    {
      relativePath:
        "docs/ai-harness/ontology/prompt-templates/semantic-context-pack.md",
      content: buildSemanticContextPromptTemplate(),
    },
    {
      relativePath: "docs/ai-harness/ontology/policy-packs/README.md",
      content: buildPolicyPacksReadme(),
    },
    jsonFile(
      "docs/ai-harness/ontology/architecture-profiles.catalog.json",
      buildArchitectureProfilesCatalog()
    ),
    jsonFile(
      "docs/ai-harness/ontology/schemas/architecture-ontology.schema.json",
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: "Architecture Ontology Policy",
        type: "object",
        required: [
          "schemaVersion",
          "profileId",
          "enforcementMode",
          "unknownLayerMode",
          "layers",
          "rules",
          "bypassPolicy",
        ],
        additionalProperties: true,
      }
    ),
    jsonFile("docs/ai-harness/ontology/schemas/source-graph.schema.json", {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Source Graph Snapshot",
      type: "object",
      required: ["schemaVersion", "generatedAt", "files", "edges", "scan"],
      additionalProperties: true,
    }),
    jsonFile(
      "docs/ai-harness/ontology/schemas/governance-evaluation.schema.json",
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: "Semantic Governance Evaluation",
        type: "object",
        required: [
          "schemaVersion",
          "generatedAt",
          "profileId",
          "verdict",
          "summary",
          "violations",
          "warnings",
        ],
        additionalProperties: true,
      }
    ),
    jsonFile("docs/ai-harness/ontology/schemas/bypass-ledger.schema.json", {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Architecture Waiver Ledger",
      type: "object",
      required: ["schemaVersion", "generatedAt", "policy", "waivers"],
      properties: {
        schemaVersion: { type: "string" },
        generatedAt: { type: "string" },
        policy: { type: "string" },
        waivers: {
          type: "array",
          items: {
            type: "object",
            required: [
              "id",
              "ruleId",
              "edgeFingerprint",
              "owner",
              "approvedBy",
              "approvalRef",
              "approvalSignature",
              "status",
              "createdAt",
              "expiresAt",
              "evidenceRefs",
              "maxUses",
              "rationale",
            ],
            properties: {
              id: { type: "string" },
              ruleId: { type: "string" },
              edgeFingerprint: { type: "string" },
              owner: { type: "string" },
              approvedBy: { type: "string" },
              approvalRef: { type: "string" },
              approvalSignature: { type: "string" },
              status: {
                enum: ["active", "expired", "revoked", "superseded"],
              },
              createdAt: { type: "string" },
              expiresAt: { type: "string" },
              evidenceRefs: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
              },
              maxUses: { type: "number", minimum: 1 },
              rationale: { type: "string" },
            },
            additionalProperties: true,
          },
        },
      },
      additionalProperties: true,
    }),
    jsonFile("docs/ai-harness/ontology/schemas/waiver-revocations.schema.json", {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Architecture Waiver Revocation Ledger",
      type: "object",
      required: ["schemaVersion", "generatedAt", "policy", "revocations"],
      additionalProperties: true,
    }),
    jsonFile("docs/ai-harness/ontology/schemas/semantic-warehouse.schema.json", {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Semantic Warehouse Snapshot",
      type: "object",
      required: [
        "schemaVersion",
        "profileId",
        "verdict",
        "snapshotHash",
        "views",
        "viewSummaries",
        "warnings",
      ],
      additionalProperties: true,
    }),
    jsonFile("docs/ai-harness/ontology/schemas/waiver-validation.schema.json", {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Architecture Waiver Validation",
      type: "object",
      required: [
        "schemaVersion",
        "generatedAt",
        "verdict",
        "summary",
        "ledgerPath",
        "sourceReferences",
        "findings",
        "metrics",
      ],
      additionalProperties: true,
    }),
    jsonFile("docs/ai-harness/ontology/schemas/enforcement-report.schema.json", {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Semantic Enforcement Report",
      type: "object",
      required: [
        "schemaVersion",
        "generatedAt",
        "enforcementMode",
        "optInOnly",
        "profileId",
        "gate",
        "canProceed",
        "summary",
        "decisions",
        "governance",
        "waiverValidation",
        "metrics",
      ],
      properties: {
        schemaVersion: { type: "string" },
        generatedAt: { type: "string" },
        enforcementMode: { enum: ["report", "strict", "ci"] },
        optInOnly: { const: true },
        gate: { enum: ["pass", "warn", "fail", "disabled"] },
        canProceed: { type: "boolean" },
        decisions: {
          type: "array",
          items: {
            type: "object",
            required: [
              "id",
              "status",
              "ruleId",
              "edgeFingerprint",
              "sourcePath",
              "sourceRefs",
            ],
            additionalProperties: true,
          },
        },
      },
      additionalProperties: true,
    }),
    jsonFile("docs/ai-harness/ontology/schemas/policy-pack.schema.json", {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Architecture Policy Pack",
      type: "object",
      required: [
        "schemaVersion",
        "generatedAt",
        "packId",
        "profileId",
        "policyHash",
        "policy",
        "trust",
        "gitOps",
        "signature",
        "sourceRefs",
      ],
      properties: {
        schemaVersion: { type: "string" },
        generatedAt: { type: "string" },
        packId: { type: "string" },
        policyHash: { type: "string" },
        trust: {
          type: "object",
          required: [
            "source",
            "exportedBy",
            "sourceWorkspaceHash",
            "reviewRequired",
            "autoUpload",
            "localAuthorityDefault",
          ],
          additionalProperties: true,
        },
        gitOps: {
          type: "object",
          required: [
            "noAutomaticCentralUpload",
            "mergeRequestRequired",
            "reversible",
            "suggestedBranch",
            "rollbackDirectory",
          ],
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    }),
    jsonFile("docs/ai-harness/ontology/state/source-graph.json", emptySourceGraph),
    jsonFile(
      "docs/ai-harness/ontology/state/governance-evaluation.json",
      emptyEvaluation
    ),
    jsonFile(
      "docs/ai-harness/ontology/state/semantic-warehouse.json",
      emptySemanticWarehouse
    ),
    jsonFile(
      "docs/ai-harness/ontology/state/waiver-validation.json",
      emptyWaiverValidation
    ),
    jsonFile(
      "docs/ai-harness/ontology/state/enforcement-report.json",
      emptyEnforcementReport
    ),
    {
      relativePath: "docs/ai-harness/ontology/state/enforcement-report.md",
      content: emptyEnforcementMarkdown,
    },
    jsonFile(
      "docs/ai-harness/ontology/policy-packs/import-review.example.json",
      emptyPolicyPackImportReview
    ),
    jsonFile("docs/ai-harness/ontology/state/bypass-ledger.json", bypassLedger),
    jsonFile(
      "docs/ai-harness/ontology/state/waiver-revocations.json",
      waiverRevocations
    ),
    jsonFile("docs/ai-harness/ontology/state/context-pack.example.json", {
      schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
      generatedAt: "bootstrap",
      profileId: policy.profileId,
      tokenBudget: "lean",
      verdict: "warn",
      contentHash: "bootstrap",
      compression: {
        authority: "exact-graph-policy-receipts",
        mode: "lean",
        maxFindings: 5,
        maxGraphNodes: 30,
        selectedFindingCount: 0,
        totalFindingCount: 0,
        estimatedJsonChars: 0,
        advisoryCompressionOnly: true,
      },
      jsonLd: {
        "@context": {
          entity: "https://workspace-init-mcp.local/ontology/entity",
          relation: "https://workspace-init-mcp.local/ontology/relation",
        },
        "@graph": [],
      },
      tree: [],
      ruleFacts: [],
      antiPatterns: [],
      quantizedSignatures: [],
      spatialMaps: [],
      promptTemplate:
        "Use docs/ai-harness/ontology/prompt-templates/semantic-context-pack.md with a fresh context pack.",
      sourceRefs: [],
      warnings: [
        "Bootstrap context pack is empty until get_semantic_context_pack runs.",
      ],
      note:
        "Run get_semantic_context_pack after source graph scanning to populate this structure.",
    }),
  ];
}
