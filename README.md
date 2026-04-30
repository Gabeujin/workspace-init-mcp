# workspace-init-mcp

[![npm version](https://img.shields.io/npm/v/workspace-init-mcp)](https://www.npmjs.com/package/workspace-init-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

`workspace-init-mcp` is an MCP server for adding an AI governance and delivery harness to a workspace.

It generates Copilot instructions, agent skills, governance documents, runtime handoff files, dashboard state, readiness checks, and reconcile tools so AI-assisted work can stay reviewable, resumable, and safe across long-running sessions.

It is designed for VS Code, Cursor, Claude Code, OpenHands, Codex CLI/Desktop, GitHub Copilot, and portable file or CLI based agent runtimes.

## Core Guarantees

- **Non-destructive legacy adoption**: initialization and reconcile are harness overlays. They must not delete, truncate, move, or replace existing application source.
- **Governance-first delivery**: meaningful work is planned, reviewed, contracted, implemented, evaluated, and closed through durable files.
- **Parallel-agent support**: an orchestrator can split dependency-free chunks, assign worker agents, and inject only task-relevant context.
- **Independent evaluation**: generator output is checked through self-correction, evaluator review, verification, and quality gates.
- **Memory-to-skill promotion**: repeated session patterns can be scored and promoted into reusable skills or agents.
- **Traceability**: runtime sessions, handoffs, receipts, dashboard state, migrations, and atomic commits keep work history inspectable.

Protected source roots such as `src/`, `app/`, `packages/`, `services/`, `server/`, and `client/` remain owned by the project unless a later explicit implementation contract names them as an approved modernization scope.

## Current Safety Baseline

Version `4.3.0` includes the current safety baseline for legacy adoption and harness runtime work:

- `workspacePath` is enforced as an absolute path before MCP tools read or write workspace files.
- Initialization, reconcile, and workspace prompt schemas also reject relative `workspacePath` values before tool execution.
- Generated files are limited to harness, documentation, IDE, dashboard, runtime, skill, and agent ownership roots.
- `expectedWritePaths` are normalized before use. Empty paths, traversal, drive-qualified paths, and bare protected source roots such as `.`, `src/.`, `src//`, or `SRC/` are blocked.
- Reconcile policy files are validated before use. Malformed `nonDestructiveAdoption.protectedSourceRoots` falls back to the built-in non-destructive safety policy with warnings.
- Reconcile holds malformed managed JSON state for manual review instead of replacing live dashboard, runtime, or readiness state with generated baselines.
- Dashboard contract coverage is based on approved contract evidence, not only chunk metadata or next-step text.
- Dashboard state required top-level keys are single-sourced through `src/data/dashboard-state-contract.ts` and injected into runtime validation, generated JSON schema, and generated dashboard operations.
- Strict dashboard governance requires approved memory-to-skill promotions to generate only under skill or agent ownership roots.
- Strict dashboard governance rejects operational health claims that lack fresh datasource, DBCP, or latency-query evidence.
- Generated dashboard operations and live artifacts JSON state use temp-file plus rename writes to reduce partial-write risk.
- Native executor background launches start in a non-definitive `launching` state and record spawn failures with `spawn-error` diagnostics.
- Native executor launches support `timeoutMs` and `maxOutputBytes` guardrails so supervised runs cannot hang indefinitely or write unbounded stdout/stderr.
- Background native executor timeout and output-limit enforcement attempts process-tree termination (`taskkill /T` on Windows, process group termination on POSIX).
- Runtime JSON state writes use temp-file plus rename semantics to reduce partial-write risk during interrupted state updates.
- Readiness scoring is semantic-capped: structural completeness cannot report `ready` while the semantic readiness audit still shows weak operational evidence.
- `audit_harness_parallel_chunk_conflicts` checks open and queued runtime sessions for overlapping `expectedWritePaths` and rejects unsafe persisted write scopes before workers run in parallel.
- Runtime compaction rebuilds session archive source paths from safe session IDs instead of trusting persisted index paths.
- Runtime session, chunk, archive, and bundle identifiers reject path traversal, separators, trailing-dot aliases, and Windows reserved file names such as `CON`, `PRN`, and `COM1`.
- `validate_workspace`, runtime audit, and native execution status report malformed runtime JSON separately from missing runtime artifacts so operators can distinguish corruption from absence.
- `npm pack` runs a build through `prepack` so package contents do not depend on stale local `dist/` output.

## Quick Start

Pick your agent tool, add the MCP server once, then ask the agent to call the tool that matches your situation.

The MCP server command is always:

```bash
npx -y workspace-init-mcp
```

### New Project

Use this when you are starting a repository and want the harness from day one.

Ask your agent:

```text
Use workspace-init-mcp. Call initialize_workspace for this new project.
Use strict governance, balanced autonomy, include harness engineering, include agent skills,
and then call validate_workspace.
```

Recommended tool flow:

1. `get_init_form_schema` if the client can render a setup form.
2. `initialize_workspace` with an absolute `workspacePath`.
3. `validate_workspace`.
4. Start work through the generated harness: plan, review, contract, implementation, evaluation, verification, closeout.

### Existing Project

Use this when AI enters a legacy repo, client system, or production-adjacent service.

Ask your agent:

```text
Use workspace-init-mcp for non-destructive legacy adoption.
First call analyze_workspace, then preview_workspace_init.
Do not delete, move, truncate, or replace application source.
If the preview is safe, call initialize_workspace with force=false, then validate_workspace.
```

Recommended tool flow:

1. `analyze_workspace`.
2. `preview_workspace_init`.
3. `initialize_workspace` with `force: false`.
4. `validate_workspace`.
5. For an already initialized workspace, run `audit_workspace_upgrade_risk` and `reconcile_workspace_initialization` in dry-run mode before any apply run.

## Agent Tool Setup

These are the common MCP-capable agent environments this project is designed for. The exact popularity order changes over time, so treat this as a practical "top 5 places users usually start" rather than a permanent ranking.

### 1. Codex CLI / Codex Desktop

Add the MCP server:

```bash
codex mcp add workspace-init -- npx -y workspace-init-mcp
codex mcp get workspace-init
```

Then ask Codex:

```text
Use workspace-init-mcp. For a new project, call initialize_workspace and validate_workspace.
For an existing project, call analyze_workspace, preview_workspace_init, initialize_workspace force=false, and validate_workspace.
```

### 2. Claude Code / Claude CLI

Add the MCP server:

```bash
claude mcp add-json workspace-init '{"type":"stdio","command":"npx","args":["-y","workspace-init-mcp"]}'
claude mcp get workspace-init
```

Then ask Claude:

```text
Use the workspace-init MCP tools. Start with analyze_workspace for an existing repo,
or initialize_workspace for a new repo. Preserve application source.
```

### 3. Gemini CLI / Google Antigravity

For Gemini CLI:

```bash
gemini mcp add workspace-init npx -y workspace-init-mcp
gemini mcp list
```

For Google Antigravity or another Gemini-based agent IDE, add an equivalent stdio MCP server in the MCP settings:

```json
{
  "mcpServers": {
    "workspace-init": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "workspace-init-mcp"]
    }
  }
}
```

Then ask the agent:

```text
Use workspace-init-mcp to install an AI harness.
For this existing repo, analyze first, preview generated files, preserve source, then initialize.
```

### 4. GitHub Copilot In VS Code

Add this to `.vscode/mcp.json` in the repository:

```json
{
  "servers": {
    "workspace-init": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "workspace-init-mcp"]
    }
  }
}
```

Start the server from VS Code, open Copilot Chat in Agent mode, then ask:

```text
Use the workspace-init MCP server. If this is a new project, call initialize_workspace.
If this is an existing project, call analyze_workspace and preview_workspace_init first.
```

### 5. Cursor, OpenHands, Open Claude, Or Other MCP-Compatible IDE/CLI

Use the same stdio server shape in the tool's MCP configuration:

```json
{
  "mcpServers": {
    "workspace-init": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "workspace-init-mcp"]
    }
  }
}
```

For OpenHands CLI-style configuration, use the tool's MCP server manager or config file and point the command to `npx` with args `["-y", "workspace-init-mcp"]`.

Then ask:

```text
Use workspace-init-mcp. Choose the safe flow:
new project = initialize_workspace -> validate_workspace;
existing project = analyze_workspace -> preview_workspace_init -> initialize_workspace force=false -> validate_workspace.
```

## What It Generates

The generated files are intentionally limited to governance, documentation, IDE configuration, dashboard, runtime, skill, and agent surfaces.

| Area | Generated artifacts |
|---|---|
| Workspace instructions | `.github/copilot-instructions.md`, `.vscode/*.instructions.md` |
| Agent catalog | `.github/agents/`, `.github/skills/`, optional `.cursor/`, `.claude/`, and `.agents/` mirrors |
| Harness governance | `.github/ai-harness/harness-manifest.yaml`, `operating-model.md`, `context-strategy.md`, `evaluation-rubrics.md` |
| Safe reconcile | `.github/ai-harness/managed-file-inventory.json`, `reconcile-policy.json`, `docs/ai-harness/migrations/` |
| Runtime orchestration | `docs/ai-harness/runtime/` sessions, work packets, adapters, bridges, native executors, receipts, archives |
| Dashboard | `docs/ai-harness/dashboard/` HTML, CSS, JS, schema, templates, JSON state, operations script |
| Live artifacts dashboard | `live-artifacts-dashboard/` localhost observer for real-time governed artifacts, open markers, and SSE updates |
| Readiness | `docs/ai-harness/readiness/` remaining-work spec, scoring model, scorecard template, semantic audits |
| Governance records | `docs/context/`, `docs/reviews/`, `docs/plans/`, `docs/contracts/`, `docs/evaluations/`, `docs/handovers/` |
| Governance intake | `.governance/` live-dashboard intake and staging; durable canonical ledgers remain under `docs/` |
| Project docs | `docs/work-logs/`, `docs/changelog/`, `docs/adr/`, `docs/troubleshooting/` |
| Editor consistency | `.editorconfig`, `.gitattributes` |

## Operating Model

Meaningful work follows a governance ladder before implementation:

```text
Governance open
Plan 1 -> Review 1
Plan 2 -> Review 2
Plan 3 -> Review 3
Goal freeze
Contract proposal -> Contract review
Implementation -> Self-check
Independent evaluation -> Remediation
Verification
Governance refresh -> Governance close
```

The goal is not to slow work down. It is to make AI work resumable, auditable, and easier to split across sessions or agents without losing intent.

## Legacy Adoption

Use this MCP when AI enters an existing codebase, client system, or operational environment.

Safe legacy adoption means:

- analyze the AS-IS repository before writing
- add harness files around the project
- preserve application source and existing business logic
- keep `workspacePath` absolute and review generated-file previews before apply
- merge live dashboard/runtime JSON instead of replacing it blindly
- hold customized managed files for review
- archive replaced managed files under `docs/ai-harness/migrations/`
- import legacy custom skills or agents into canonical `.github` paths when appropriate

For safer reconcile runs:

- `reconcile_workspace_initialization` defaults to dry run mode
- malformed reconcile policy files fall back to the built-in non-destructive policy instead of weakening protected source-root enforcement
- malformed managed JSON state is held for manual review instead of overwritten during reconcile
- `requireCleanGitWhenPresent: true` can block writes when the working tree is dirty
- `requireZeroManualReviewItemsForApply: true` can block apply runs until manual-review items are resolved
- `audit_workspace_upgrade_risk` and `audit_workspace_managed_semantic_diff` expose managed-file drift before upgrades
- `export_reconcile_preflight_report` writes JSON, Markdown, and HTML reports for review
- `restore_reconcile_backup` can restore managed files from migration backups

## Parallel Agent Work

The harness includes a `harness-orchestrator` agent and runtime packet fields for parallel execution.

The orchestrator is responsible for:

- analyzing the backlog
- marking chunks as blocked, sequential, or parallel-ready
- assigning worker agents only to independent chunks
- defining expected read paths, write paths, verification commands, and merge ownership
- injecting only the relevant task contract, code snippets, DB schema fragments, API specs, logs, and commands

Parallel work is allowed only when write scopes, schema changes, API contracts, runtime side effects, and deployment order do not conflict.
Run `audit_harness_parallel_chunk_conflicts` before launching workers to catch overlapping declared write scopes in open or queued runtime sessions.

Worker outputs return through contracts, evaluator records, receipts, dashboard updates, and atomic commits.

## Memory-To-Skill Promotion

Harness installations include `harness-memory-pattern-miner` and `harness-memory-curator`.
They inspect durable session memories, work logs, plans, reviews, handovers, runtime sessions, dashboard state, and `.governance/` intake notes to detect repeated stable work.

Promotion is conservative by default:

- require at least three repetitions or evidence across two governed sessions
- score frequency, stability, reuse value, validation clarity, and coverage gap
- create a skill for repeatable procedure and an agent for durable role ownership
- write only inside agent/skill ownership roots; never alter application source during memory curation

## Quality Gate

Every implementation chunk should pass the maturity gate before closeout:

1. **Critical error and stability checks**: static analysis, syntax checks, runtime exception risk, and boundary testing.
2. **Version compatibility**: framework/runtime sync, Java/JDK or equivalent environment checks, and dependency compatibility.
3. **Dependency audit**: confirm new or changed libraries do not conflict with the existing system.
4. **Maintainability**: SOLID, duplication, abstraction level, constants instead of hardcoding, and business/data-access separation.
5. **Self-correction and traceability**: generator uncertainty report, independent evaluation, remediation evidence, and atomic commit references.

## Admin Dashboard

Each initialized workspace includes a file-system dashboard under `docs/ai-harness/dashboard/`.

The dashboard is JSON-first and does not require a database:

- `state/dashboard-state.json` is the live source of truth
- `index.html` renders progress, KPIs, issues, artifacts, governed sessions, server operations health, and git state
- `templates/*.state.json` provide starting points for software delivery, creative narrative, knowledge workflows, and generic transformation initiatives
- `scripts/dashboard-ops.mjs` can refresh, validate, serve locally, and export static snapshots
- `operationsHealth` tracks traffic, request/response counts, DBCP pool health, incident logs, and latency queries
- Strict validation treats `operationsHealth.status=ok|healthy|connected|configured|active|operational` as an evidence claim and requires fresh source paths, DBCP checks, and latency query timestamps
- `memoryPromotion` tracks repeated AI work patterns until they meet conservative evidence thresholds for a skill or agent
- Contract readiness is intentionally conservative: `contract-coverage` only counts sessions with approved contract evidence
- The required top-level state contract is shared by schema generation, dashboard operations, and runtime validation to prevent drift

Useful commands inside an initialized workspace:

```bash
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs validate
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs validate --strict-governance
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs serve --port 43110
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs export-static --out docs/ai-harness/dashboard/exports/latest
```

## Live Artifacts Dashboard

Harness-first work also includes a local real-time artifact observer under `live-artifacts-dashboard/`.

- Default URL: `http://127.0.0.1:43111`
- Source of truth boundary: it observes artifacts and open work, while `docs/ai-harness/dashboard/state/dashboard-state.json` remains the canonical admin dashboard state
- Runtime output is constrained to `live-artifacts-dashboard/.state/` and `live-artifacts-dashboard/logs/`
- APIs: `/api/health`, `/api/summary`, `POST /api/summary/refresh`, `/api/artifacts`, `/api/artifact?id=...`, and `/api/events`
- Default scans stay inside governance, harness, and evidence documentation roots; source previews are opt-in with `LIVE_ARTIFACTS_SOURCE_PREVIEW=1`
- API routes require a generated local token by default. Use the served UI, `x-live-artifacts-token`, or `?token=` for SSE; set `LIVE_ARTIFACTS_API_TOKEN=off` only for explicitly trusted local runs

Useful commands inside an initialized workspace:

```bash
npm --prefix live-artifacts-dashboard run check
npm --prefix live-artifacts-dashboard run health
npm --prefix live-artifacts-dashboard start
```

## Runtime And Agent Switching

Version `4.3.0` includes a compatibility layer under `docs/ai-harness/runtime/`:

- `version-index.json` records capabilities by workspace-init-mcp release
- `compatibility-matrix.json` tells `@latest` sessions how to upgrade older workspaces safely
- `adapter-contract.json` defines stable handoff fields across Copilot, Codex, Claude, Gemini, OpenHands, generic CLI, and file-based runtimes
- `session-continuity.md` defines the source-of-truth order when moving work between agents
- Runtime validation, audit, and native execution status distinguish corrupted JSON state from missing state files
- Native executor state records launch, foreground completion, background spawn failure, and operator-approved override use

If a newer agent enters an older workspace, run `reconcile_workspace_initialization` before relying on the latest runtime behavior. Live dashboard and runtime state are merged; generated compatibility contracts refresh to the latest baseline.

## Readiness And Archival

The readiness layer answers: "What still needs to be true before this workspace is ready for repeatable DX/AX operation?"

- `assess_workspace_readiness` can score the workspace and optionally write `maturity-scorecard.json`
- Structural readiness is capped by semantic audit results so baseline files alone do not overstate operational readiness
- `audit_workspace_readiness_semantics` performs a conservative semantic audit beyond file existence
- `compact_harness_runtime` archives older closed sessions so active runtime ledgers stay readable

## Tool Reference

### Initialization

| Tool | Purpose |
|---|---|
| `analyze_workspace` | Detect project type, tech stack, and existing workspace signals |
| `preview_workspace_init` | Preview generated files without writing them |
| `initialize_workspace` | Generate the governance, dashboard, runtime, docs, and agent baseline |
| `validate_workspace` | Check initialization completeness and outdated artifacts |
| `get_init_form_schema` | Return a client-renderable initialization form schema |
| `list_project_types` | List supported project types |
| `list_harness_profiles` | List lean, balanced, regulated, and autonomous harness profiles |

### Reconcile And Safety

| Tool | Purpose |
|---|---|
| `reconcile_workspace_initialization` | Upgrade an existing repository or older initialized workspace, dry-run first by default |
| `audit_workspace_upgrade_risk` | Audit managed baseline drift, git cleanliness, and legacy resource roots |
| `audit_workspace_managed_semantic_diff` | Report unchanged, customized, missing, and merge-diverged managed files |
| `export_reconcile_preflight_report` | Export JSON, Markdown, and HTML reconcile preflight reports |
| `restore_reconcile_backup` | Restore managed files from reconcile backup reports |

### Runtime Orchestration

| Tool | Purpose |
|---|---|
| `start_harness_session` | Open a governed planner/generator/evaluator runtime session |
| `advance_harness_session` | Move the active session through the state machine |
| `get_harness_session_status` | Read the active or requested session and next actor brief |
| `activate_harness_session` | Move the active runtime lease to another open or queued session |
| `audit_harness_runtime` | Audit runtime ledgers, queue state, and session consistency |
| `audit_harness_parallel_chunk_conflicts` | Audit open and queued sessions for overlapping `expectedWritePaths` before parallel worker assignment |
| `compact_harness_runtime` | Archive older closed sessions |
| `prepare_harness_work_packet` | Rebuild the work packet and actor inbox files |

Runtime tool inputs require an absolute `workspacePath`. Session IDs, chunk IDs, and archive IDs must be safe single path segments.

### Adapter And Execution Bridges

| Tool | Purpose |
|---|---|
| `list_harness_runtime_adapters` | List supported runtime adapters |
| `prepare_harness_adapter_handoff` | Generate a runtime-specific handoff bundle |
| `list_harness_execution_bridges` | List bridge profiles for external runtimes |
| `prepare_harness_execution_bridge` | Generate a launch-ready execution bridge bundle |
| `record_harness_execution_result` | Record a governed receipt from an external runtime |
| `list_harness_native_executors` | List directly launchable runtime integrations and local command detection |
| `prepare_harness_native_executor` | Build a governed native execution plan |
| `launch_harness_native_executor` | Launch a supported native executor; real launches using executable, args, or env overrides require `allowUnsafeNativeExecutorOverride: true`; `timeoutMs` and `maxOutputBytes` bound native execution |
| `get_harness_native_execution_status` | Read native execution state |

### Readiness And Skills

| Tool | Purpose |
|---|---|
| `assess_workspace_readiness` | Score operational readiness and optionally write a scorecard |
| `audit_workspace_readiness_semantics` | Audit placeholder pressure, evidence freshness, and dashboard truthfulness |
| `recommend_agent_skills` | Recommend skills and agents for the workspace |
| `search_agent_skills` | Search the skill catalog |
| `install_agent_skills` | Install selected skills or agents |
| `list_agent_skills_catalog` | Browse the full catalog |

## Project Types

Supported project types:

`learning`, `web-app`, `api`, `mobile`, `data-science`, `devops`, `creative`, `library`, `monorepo`, `consulting`, `ecommerce`, `fintech`, `healthcare`, `saas`, `iot`, `other`

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
