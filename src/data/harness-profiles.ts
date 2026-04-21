import {
  type AutonomyMode,
  type GovernanceProfile,
  type TokenBudget,
} from "../types.js";

export interface HarnessProfile {
  id: string;
  label: string;
  governanceProfile: GovernanceProfile;
  autonomyMode: AutonomyMode;
  tokenBudget: TokenBudget;
  description: string;
  strengths: string[];
  reviewFocus: string[];
}

export const HARNESS_PROFILES: HarnessProfile[] = [
  {
    id: "lean",
    label: "Lean Delivery Harness",
    governanceProfile: "standard",
    autonomyMode: "guided",
    tokenBudget: "lean",
    description:
      "Optimized for fast product iteration with tight context scopes and lightweight reviews.",
    strengths: [
      "Minimizes token usage with narrow context intake",
      "Prefers short plans and small execution batches",
      "Uses lightweight review and handover artifacts",
    ],
    reviewFocus: [
      "Scope control",
      "Token discipline",
      "Fast feedback loops",
    ],
  },
  {
    id: "balanced",
    label: "Balanced Scale-Up Harness",
    governanceProfile: "strict",
    autonomyMode: "balanced",
    tokenBudget: "balanced",
    description:
      "Designed for long-running delivery with consistent context, explicit reviews, and durable handoffs.",
    strengths: [
      "Balances autonomy with recurring checkpoints",
      "Maintains context, review, and handover ledgers",
      "Supports multi-domain projects without losing focus",
    ],
    reviewFocus: [
      "Context continuity",
      "Execution quality",
      "Cross-domain coordination",
    ],
  },
  {
    id: "regulated",
    label: "Regulated Operations Harness",
    governanceProfile: "regulated",
    autonomyMode: "guided",
    tokenBudget: "balanced",
    description:
      "For compliance-sensitive work where approvals, auditability, and review rigor matter more than speed.",
    strengths: [
      "Adds strict escalation and approval expectations",
      "Prioritizes audit trails and decision traceability",
      "Keeps review evidence durable for regulated environments",
    ],
    reviewFocus: [
      "Auditability",
      "Approval gates",
      "Operational risk",
    ],
  },
  {
    id: "autonomous",
    label: "Autonomous Delivery Harness",
    governanceProfile: "strict",
    autonomyMode: "autonomous",
    tokenBudget: "thorough",
    description:
      "For teams that want deeper automation with strong planning, review loops, and state refresh rules.",
    strengths: [
      "Encourages multi-step autonomous execution with checkpoints",
      "Uses rich context and review artifacts to keep direction stable",
      "Fits large, evolving programs with many parallel workstreams",
    ],
    reviewFocus: [
      "Autonomy safety",
      "State freshness",
      "Program-level scaling",
    ],
  },
];

export function resolveHarnessProfile(profileId?: string): HarnessProfile {
  return (
    HARNESS_PROFILES.find((profile) => profile.id === profileId) ??
    HARNESS_PROFILES.find((profile) => profile.id === "balanced")!
  );
}

export function buildHarnessProfilesSummary(): string {
  const lines = HARNESS_PROFILES.map((profile) =>
    [
      `- **${profile.id}** (${profile.label})`,
      `  - Governance: ${profile.governanceProfile}`,
      `  - Autonomy: ${profile.autonomyMode}`,
      `  - Token budget: ${profile.tokenBudget}`,
      `  - ${profile.description}`,
      `  - Review focus: ${profile.reviewFocus.join(", ")}`,
    ].join("\n")
  );

  return [
    "Available harness profiles:",
    "",
    ...lines,
  ].join("\n");
}
