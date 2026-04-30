export const DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS = [
  "meta",
  "workspace",
  "executiveSummary",
  "progressState",
  "governanceState",
  "kpiProfile",
  "kpis",
  "errors",
  "gitStatus",
  "sessionLog",
  "governedSessions",
  "artifacts",
  "domainLens",
  "timeline",
  "entities",
  "versionLedger",
  "runtimeOrchestration",
  "operationsHealth",
  "memoryPromotion",
] as const;

export type DashboardStateTopLevelKey =
  (typeof DASHBOARD_STATE_REQUIRED_TOP_LEVEL_KEYS)[number];

export const DASHBOARD_STATE_CONTRACT_DESCRIPTION =
  "Canonical top-level dashboard state contract shared by schema generation, generated dashboard operations, and runtime validation.";
