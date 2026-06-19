export const HARNESS_ADAPTER_CONTRACT_VERSION = "1.0.0";

export const HARNESS_REQUIRED_HANDOFF_FIELDS = [
  "schemaVersion",
  "generatedAt",
  "adapterId",
  "sessionId",
  "leaseStatus",
  "nextActor",
  "currentPhase",
  "nextAction",
  "goal",
  "chunkId",
  "adapter",
  "fileReferences",
  "operatorChecklist",
  "runtimeExpectations",
  "packet",
  "requestRecord",
  "taskTracePolicy",
  "workingMemory",
  "evaluationLoop",
  "promptBlock",
  "compatibility",
] as const;

export type HarnessRequiredHandoffField =
  (typeof HARNESS_REQUIRED_HANDOFF_FIELDS)[number];
