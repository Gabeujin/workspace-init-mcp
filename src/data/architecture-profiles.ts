import {
  SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
  type ArchitectureLayerDefinition,
  type ArchitectureOntologyPolicy,
  type ArchitecturePolicyRule,
  type ArchitectureProfileId,
} from "./ontology-contract.js";
import { type WorkspaceInitParams } from "../types.js";

export interface ArchitectureProfileAuthoringGuidance {
  intent: string;
  allowedDependencyExamples: string[];
  blockedDependencyExamples: string[];
  pathHintGuidance: string[];
}

export interface ArchitectureProfileDefinition {
  profileId: ArchitectureProfileId;
  label: string;
  summary: string;
  layers: ArchitectureLayerDefinition[];
  rules: ArchitecturePolicyRule[];
  authoringGuidance: ArchitectureProfileAuthoringGuidance;
}

const BASE_LAYERS: Record<string, ArchitectureLayerDefinition> = {
  presentation: {
    id: "presentation",
    label: "Presentation / Interface",
    depth: 5,
    access: 5,
    volatility: 4,
    pathHints: [
      "src/index.",
      "/controllers/",
      "/routes/",
      "/pages/",
      "/views/",
      "/ui/",
      "/components/",
      "/adapters/inbound/",
    ],
  },
  business: {
    id: "business",
    label: "Business / Service",
    depth: 3,
    access: 3,
    volatility: 3,
    pathHints: ["/services/", "/business/", "/tools/", "/generators/"],
  },
  application: {
    id: "application",
    label: "Application / Use Case",
    depth: 3,
    access: 3,
    volatility: 3,
    pathHints: ["/application/", "/apps/", "/use-cases/", "/usecases/", "/ports/"],
  },
  domain: {
    id: "domain",
    label: "Domain Model",
    depth: 2,
    access: 2,
    volatility: 2,
    pathHints: ["/domain/", "/models/", "/entities/", "/aggregates/"],
  },
  dataAccess: {
    id: "data-access",
    label: "Data Access",
    depth: 0,
    access: 1,
    volatility: 2,
    pathHints: ["/repositories/", "/repository/", "/data/", "/db/", "/persistence/"],
  },
  infrastructure: {
    id: "infrastructure",
    label: "Infrastructure / Adapter",
    depth: 1,
    access: 1,
    volatility: 4,
    pathHints: [
      "/infra/",
      "/infrastructure/",
      "/adapters/outbound/",
      "/broker/",
      "/messaging/",
      "/clients/",
      "/external/",
    ],
  },
  configuration: {
    id: "configuration",
    label: "Configuration",
    depth: 1,
    access: 2,
    volatility: 1,
    pathHints: ["/config/", "/settings/", "tsconfig.json", "package.json"],
  },
  generatedHarness: {
    id: "generated-harness",
    label: "Generated Harness Artifact",
    depth: 4,
    access: 2,
    volatility: 2,
    pathHints: ["docs/ai-harness/", ".github/ai-harness/", ".governance/"],
  },
  test: {
    id: "test",
    label: "Test",
    depth: 4,
    access: 4,
    volatility: 4,
    pathHints: ["/tests/", ".test.", ".spec."],
  },
  unknown: {
    id: "unknown",
    label: "Unknown / Unclassified",
    depth: 2,
    access: 2,
    volatility: 4,
    pathHints: [],
  },
};

function cloneLayer(layer: ArchitectureLayerDefinition): ArchitectureLayerDefinition {
  return {
    ...layer,
    pathHints: [...layer.pathHints],
  };
}

function layerSet(
  keys: Array<keyof typeof BASE_LAYERS>,
  overrides: Partial<Record<keyof typeof BASE_LAYERS, string[]>> = {}
): ArchitectureLayerDefinition[] {
  return keys.map((key) => ({
    ...cloneLayer(BASE_LAYERS[key]),
    pathHints: [...(overrides[key] ?? BASE_LAYERS[key].pathHints)],
  }));
}

function allow(
  profileId: ArchitectureProfileId,
  sourceLayer: ArchitecturePolicyRule["sourceLayer"],
  targetLayer: ArchitecturePolicyRule["targetLayer"],
  rationale: string
): ArchitecturePolicyRule {
  return {
    id: `${profileId}.${sourceLayer}-may-import-${targetLayer}`,
    predicate: "MAY_IMPORT",
    sourceLayer,
    targetLayer,
    severity: "allow",
    rationale,
  };
}

function block(
  profileId: ArchitectureProfileId,
  sourceLayer: ArchitecturePolicyRule["sourceLayer"],
  targetLayer: ArchitecturePolicyRule["targetLayer"],
  rationale: string,
  suggestedPath?: ArchitecturePolicyRule["suggestedPath"]
): ArchitecturePolicyRule {
  return {
    id: `${profileId}.${sourceLayer}-must-not-import-${targetLayer}`,
    predicate: "MUST_NOT_IMPORT",
    sourceLayer,
    targetLayer,
    severity: "block",
    rationale,
    suggestedPath,
  };
}

function unknownRule(): ArchitecturePolicyRule {
  return {
    id: "semantic.unknown-layer-requires-review",
    predicate: "UNKNOWN_LAYER_REVIEW",
    sourceLayer: "*",
    targetLayer: "unknown",
    severity: "warn",
    rationale:
      "Unclassified targets need explicit review; the semantic verifier must not silently allow unknown architecture facts.",
  };
}

const PROFILE_DEFINITIONS: Record<ArchitectureProfileId, ArchitectureProfileDefinition> = {
  "n-tier": {
    profileId: "n-tier",
    label: "N-tier",
    summary:
      "Interface code routes through business services before persistence or external systems.",
    layers: layerSet([
      "presentation",
      "business",
      "domain",
      "dataAccess",
      "configuration",
      "generatedHarness",
      "test",
      "unknown",
    ]),
    rules: [
      allow("n-tier", "presentation", "business", "Interface layers call service/use-case layers."),
      allow("n-tier", "business", "data-access", "Business layers may use repositories or persistence adapters."),
      allow("n-tier", "business", "domain", "Business logic may use domain entities and value objects."),
      allow("n-tier", "*", "configuration", "Configuration constants may be imported by runtime layers."),
      block(
        "n-tier",
        "presentation",
        "data-access",
        "Presentation must not bypass the business/use-case layer to call persistence directly.",
        ["presentation", "business", "data-access"]
      ),
      unknownRule(),
    ],
    authoringGuidance: {
      intent:
        "Use this profile for conventional web/API services where controllers talk to services and services talk to persistence.",
      allowedDependencyExamples: [
        "src/controllers/UserController.ts -> src/services/UserService.ts",
        "src/services/UserService.ts -> src/data/UserRepository.ts",
      ],
      blockedDependencyExamples: [
        "src/controllers/UserController.ts -> src/data/UserRepository.ts",
      ],
      pathHintGuidance: [
        "Map controllers/routes/pages to presentation.",
        "Map services/use-cases to business.",
        "Map repositories/db/persistence to data-access.",
      ],
    },
  },
  clean: {
    profileId: "clean",
    label: "Clean Architecture",
    summary:
      "Outer delivery and infrastructure rings depend inward on application and domain rings; inner rings never depend outward.",
    layers: layerSet([
      "presentation",
      "application",
      "domain",
      "dataAccess",
      "infrastructure",
      "configuration",
      "generatedHarness",
      "test",
      "unknown",
    ]),
    rules: [
      allow("clean", "presentation", "application", "Interface adapters call application use cases."),
      allow("clean", "application", "domain", "Application use cases may depend on domain entities."),
      allow("clean", "infrastructure", "application", "Infrastructure adapters implement application ports."),
      allow("clean", "infrastructure", "domain", "Infrastructure may map domain entities at the boundary."),
      allow("clean", "data-access", "application", "Persistence adapters implement application ports."),
      allow("clean", "data-access", "domain", "Persistence adapters may map domain entities."),
      allow("clean", "*", "configuration", "Configuration constants may be imported by runtime layers."),
      block("clean", "application", "infrastructure", "Application use cases must not depend on infrastructure adapters."),
      block("clean", "application", "data-access", "Application use cases must use ports, not concrete persistence."),
      block("clean", "domain", "application", "Domain entities must not depend on application orchestration."),
      block("clean", "domain", "infrastructure", "Domain entities must not depend on infrastructure."),
      block("clean", "domain", "data-access", "Domain entities must not depend on persistence."),
      unknownRule(),
    ],
    authoringGuidance: {
      intent:
        "Use this profile when dependency direction is the central architectural invariant.",
      allowedDependencyExamples: [
        "src/controllers/UserController.ts -> src/use-cases/GetUser.ts",
        "src/infra/PostgresUserRepository.ts -> src/application/UserRepositoryPort.ts",
      ],
      blockedDependencyExamples: [
        "src/use-cases/GetUser.ts -> src/infra/PostgresUserRepository.ts",
      ],
      pathHintGuidance: [
        "Map use-cases/application/ports to application.",
        "Map infra/adapters/outbound/clients to infrastructure.",
        "Map repositories/persistence/db to data-access.",
      ],
    },
  },
  hexagonal: {
    profileId: "hexagonal",
    label: "Hexagonal / Ports and Adapters",
    summary:
      "Inbound and outbound adapters depend on the application core; the core does not depend on adapters.",
    layers: layerSet([
      "presentation",
      "application",
      "domain",
      "dataAccess",
      "infrastructure",
      "configuration",
      "generatedHarness",
      "test",
      "unknown",
    ]),
    rules: [
      allow("hexagonal", "presentation", "application", "Inbound adapters call application ports."),
      allow("hexagonal", "application", "domain", "Application core may depend on domain."),
      allow("hexagonal", "data-access", "application", "Outbound persistence adapters implement application ports."),
      allow("hexagonal", "infrastructure", "application", "Infrastructure adapters implement application ports."),
      allow("hexagonal", "data-access", "domain", "Adapters may translate persisted domain data."),
      allow("hexagonal", "infrastructure", "domain", "Adapters may translate domain events or entities."),
      allow("hexagonal", "*", "configuration", "Configuration constants may be imported by runtime layers."),
      block("hexagonal", "application", "data-access", "Application core must not depend on outbound adapters."),
      block("hexagonal", "application", "infrastructure", "Application core must not depend on concrete infrastructure."),
      block("hexagonal", "domain", "application", "Domain should remain independent of application ports."),
      block("hexagonal", "domain", "data-access", "Domain must not depend on persistence adapters."),
      block("hexagonal", "domain", "infrastructure", "Domain must not depend on infrastructure adapters."),
      unknownRule(),
    ],
    authoringGuidance: {
      intent:
        "Use this profile when adapters surround a port-driven application core.",
      allowedDependencyExamples: [
        "src/adapters/inbound/HttpUserAdapter.ts -> src/application/RegisterUser.ts",
        "src/adapters/outbound/UserRepository.ts -> src/application/UserRepositoryPort.ts",
      ],
      blockedDependencyExamples: [
        "src/application/RegisterUser.ts -> src/adapters/outbound/UserRepository.ts",
      ],
      pathHintGuidance: [
        "Map adapters/inbound to presentation.",
        "Map adapters/outbound to infrastructure or data-access.",
        "Map ports/use-cases/application to application.",
      ],
    },
  },
  ddd: {
    profileId: "ddd",
    label: "Domain-Driven Design",
    summary:
      "Domain model remains pure; application services orchestrate domain behavior and adapters implement persistence/infrastructure.",
    layers: layerSet([
      "presentation",
      "application",
      "domain",
      "dataAccess",
      "infrastructure",
      "configuration",
      "generatedHarness",
      "test",
      "unknown",
    ]),
    rules: [
      allow("ddd", "presentation", "application", "Presentation calls application services."),
      allow("ddd", "application", "domain", "Application services orchestrate domain behavior."),
      allow("ddd", "data-access", "domain", "Repositories may map aggregates and value objects."),
      allow("ddd", "infrastructure", "domain", "Infrastructure may publish or translate domain events."),
      allow("ddd", "infrastructure", "application", "Infrastructure may host application service adapters."),
      allow("ddd", "*", "configuration", "Configuration constants may be imported by runtime layers."),
      block("ddd", "domain", "application", "Domain model must not depend on application services."),
      block("ddd", "domain", "data-access", "Domain model must not depend on repository implementations."),
      block("ddd", "domain", "infrastructure", "Domain model must not depend on infrastructure."),
      block("ddd", "application", "infrastructure", "Application services should depend on domain ports, not concrete infrastructure."),
      unknownRule(),
    ],
    authoringGuidance: {
      intent:
        "Use this profile when aggregate boundaries and domain purity are the main governance concern.",
      allowedDependencyExamples: [
        "src/application/PlaceOrder.ts -> src/domain/Order.ts",
        "src/infrastructure/EventPublisher.ts -> src/domain/OrderPlaced.ts",
      ],
      blockedDependencyExamples: [
        "src/domain/Order.ts -> src/infrastructure/EventBus.ts",
      ],
      pathHintGuidance: [
        "Map aggregates/entities/value objects/domain events to domain.",
        "Map application services/use cases to application.",
        "Map ORM/repositories/db clients to data-access.",
      ],
    },
  },
  "event-driven": {
    profileId: "event-driven",
    label: "Event-Driven",
    summary:
      "Event handlers and application services process events while domain facts stay independent of broker infrastructure.",
    layers: layerSet([
      "presentation",
      "application",
      "business",
      "domain",
      "dataAccess",
      "infrastructure",
      "configuration",
      "generatedHarness",
      "test",
      "unknown",
    ], {
      business: ["/handlers/", "/processors/", "/workflows/", "/consumers/"],
      application: ["/application/", "/commands/", "/queries/", "/use-cases/"],
      infrastructure: ["/broker/", "/messaging/", "/event-bus/", "/infrastructure/", "/infra/"],
    }),
    rules: [
      allow("event-driven", "presentation", "application", "Ingress surfaces dispatch commands or queries."),
      allow("event-driven", "application", "domain", "Application services may use domain facts."),
      allow("event-driven", "business", "application", "Handlers may call application services."),
      allow("event-driven", "business", "domain", "Handlers may interpret domain events."),
      allow("event-driven", "infrastructure", "business", "Broker adapters may invoke event handlers."),
      allow("event-driven", "infrastructure", "application", "Broker adapters may dispatch application commands."),
      allow("event-driven", "data-access", "domain", "Projection stores may map domain facts."),
      allow("event-driven", "*", "configuration", "Configuration constants may be imported by runtime layers."),
      block("event-driven", "domain", "infrastructure", "Domain events must not depend on broker infrastructure."),
      block("event-driven", "domain", "data-access", "Domain facts must not depend on projection stores."),
      block("event-driven", "application", "infrastructure", "Application services should not depend on concrete brokers."),
      block("event-driven", "presentation", "data-access", "Ingress surfaces must not bypass handlers/application services."),
      unknownRule(),
    ],
    authoringGuidance: {
      intent:
        "Use this profile when queues, brokers, projections, and event handlers are central to the system.",
      allowedDependencyExamples: [
        "src/broker/KafkaAdapter.ts -> src/handlers/InvoiceCreatedHandler.ts",
        "src/handlers/InvoiceCreatedHandler.ts -> src/application/RecordInvoice.ts",
      ],
      blockedDependencyExamples: [
        "src/domain/Invoice.ts -> src/broker/KafkaClient.ts",
      ],
      pathHintGuidance: [
        "Map handlers/processors/consumers to business.",
        "Map broker/messaging/event-bus to infrastructure.",
        "Map projections/repositories to data-access.",
      ],
    },
  },
  "workspace-init-mcp": {
    profileId: "workspace-init-mcp",
    label: "Workspace-init MCP Plugin",
    summary:
      "MCP entrypoints orchestrate tools/generators/data modules while generated harness artifacts remain isolated.",
    layers: layerSet([
      "presentation",
      "business",
      "dataAccess",
      "configuration",
      "generatedHarness",
      "test",
      "unknown",
    ], {
      presentation: ["src/index.", "/prompts/"],
      business: ["/tools/", "/generators/"],
      dataAccess: ["/data/"],
    }),
    rules: [
      allow("workspace-init-mcp", "presentation", "business", "MCP entrypoints route requests into tool/generator modules."),
      allow("workspace-init-mcp", "business", "data-access", "Tools and generators may read data contracts and registries."),
      allow("workspace-init-mcp", "business", "configuration", "Tools and generators may use configuration constants."),
      allow("workspace-init-mcp", "presentation", "data-access", "Entrypoints may expose registry metadata read-only."),
      allow("workspace-init-mcp", "*", "configuration", "Configuration constants may be imported by runtime layers."),
      block("workspace-init-mcp", "data-access", "business", "Data registries and contracts must not import tools or generators."),
      block("workspace-init-mcp", "data-access", "presentation", "Data registries must not import MCP entrypoints."),
      block("workspace-init-mcp", "generated-harness", "business", "Generated harness docs/state must not import runtime tool code."),
      unknownRule(),
    ],
    authoringGuidance: {
      intent:
        "Use this profile for this MCP's own codebase and plugin-style tools with generated harness artifacts.",
      allowedDependencyExamples: [
        "src/index.ts -> src/tools/initialize.ts",
        "src/tools/initialize.ts -> src/data/version.ts",
      ],
      blockedDependencyExamples: [
        "src/data/agent-skills-registry.ts -> src/tools/status.ts",
      ],
      pathHintGuidance: [
        "Map src/index.ts and prompts to presentation.",
        "Map tools and generators to business.",
        "Map data contracts, registries, and version constants to data-access.",
      ],
    },
  },
};

export function resolveDefaultArchitectureProfileId(
  params: WorkspaceInitParams
): ArchitectureProfileId {
  if (params.projectType === "library" || params.projectType === "monorepo") {
    return "workspace-init-mcp";
  }
  return "n-tier";
}

export function getArchitectureProfileDefinition(
  profileId: ArchitectureProfileId
): ArchitectureProfileDefinition {
  const definition = PROFILE_DEFINITIONS[profileId];
  return {
    ...definition,
    layers: definition.layers.map(cloneLayer),
    rules: definition.rules.map((rule) => ({
      ...rule,
      suggestedPath: rule.suggestedPath ? [...rule.suggestedPath] : undefined,
    })),
    authoringGuidance: {
      intent: definition.authoringGuidance.intent,
      allowedDependencyExamples: [...definition.authoringGuidance.allowedDependencyExamples],
      blockedDependencyExamples: [...definition.authoringGuidance.blockedDependencyExamples],
      pathHintGuidance: [...definition.authoringGuidance.pathHintGuidance],
    },
  };
}

export function listArchitectureProfileDefinitions(): ArchitectureProfileDefinition[] {
  return (Object.keys(PROFILE_DEFINITIONS) as ArchitectureProfileId[]).map(
    getArchitectureProfileDefinition
  );
}

export function buildArchitectureOntologyPolicyForProfile(
  profileId: ArchitectureProfileId
): ArchitectureOntologyPolicy {
  const definition = getArchitectureProfileDefinition(profileId);
  return {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    profileId,
    enforcementMode: "advisory",
    unknownLayerMode: "warn",
    layers: definition.layers,
    rules: definition.rules,
    bypassPolicy: {
      sourceCommentMayOnlyReferenceWaiver: true,
      waiverLedgerRequired: true,
      maxActivePerFile: 1,
      ttlDays: 14,
    },
  };
}

export function buildArchitectureProfilesCatalog(): Record<string, unknown> {
  return {
    schemaVersion: SEMANTIC_GOVERNANCE_SCHEMA_VERSION,
    profiles: listArchitectureProfileDefinitions().map((profile) => ({
      profileId: profile.profileId,
      label: profile.label,
      summary: profile.summary,
      layers: profile.layers.map((layer) => ({
        id: layer.id,
        label: layer.label,
        pathHints: layer.pathHints,
      })),
      authoringGuidance: profile.authoringGuidance,
    })),
  };
}
