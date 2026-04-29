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
- **Traceability**: runtime sessions, handoffs, receipts, dashboard state, migrations, and atomic commits keep work history inspectable.

Protected source roots such as `src/`, `app/`, `packages/`, `services/`, `server/`, and `client/` remain owned by the project unless a later explicit implementation contract names them as an approved modernization scope.

## Quick Start

Add the MCP server to your client, then ask your agent to analyze or initialize a workspace.

Example user prompt:

```text
Analyze this existing repository and initialize workspace-init-mcp as a non-destructive AI harness overlay.
Preserve application source. Use strict governance, balanced autonomy, and include agent skills.
```

Recommended first pass for an existing repository:

1. Run `analyze_workspace`.
2. Run `preview_workspace_init` to inspect generated files.
3. Run `initialize_workspace` with `force: false`.
4. Run `validate_workspace`.
5. For older initialized workspaces, run `reconcile_workspace_initialization` as a dry run before applying changes.

## Setup

### VS Code `settings.json`

```jsonc
{
  "mcp": {
    "servers": {
      "workspace-init": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "workspace-init-mcp"]
      }
    }
  }
}
```

### VS Code `.vscode/mcp.json`

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

### Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "workspace-init": {
      "command": "npx",
      "args": ["-y", "workspace-init-mcp"]
    }
  }
}
```

### Codex CLI / Desktop

```bash
codex mcp add workspace-init -- npx -y workspace-init-mcp
codex mcp get workspace-init
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
| Readiness | `docs/ai-harness/readiness/` remaining-work spec, scoring model, scorecard template, semantic audits |
| Governance records | `docs/context/`, `docs/reviews/`, `docs/plans/`, `docs/contracts/`, `docs/evaluations/`, `docs/handovers/` |
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
- merge live dashboard/runtime JSON instead of replacing it blindly
- hold customized managed files for review
- archive replaced managed files under `docs/ai-harness/migrations/`
- import legacy custom skills or agents into canonical `.github` paths when appropriate

For safer reconcile runs:

- `reconcile_workspace_initialization` defaults to dry run mode
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

Worker outputs return through contracts, evaluator records, receipts, dashboard updates, and atomic commits.

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
- `index.html` renders progress, KPIs, issues, artifacts, governed sessions, and git state
- `templates/*.state.json` provide starting points for software delivery, creative narrative, knowledge workflows, and generic transformation initiatives
- `scripts/dashboard-ops.mjs` can refresh, validate, serve locally, and export static snapshots

Useful commands inside an initialized workspace:

```bash
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs validate
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs serve --port 43110
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs export-static --out docs/ai-harness/dashboard/exports/latest
```

## Runtime And Agent Switching

Version `4.2.1` includes a compatibility layer under `docs/ai-harness/runtime/`:

- `version-index.json` records capabilities by workspace-init-mcp release
- `compatibility-matrix.json` tells `@latest` sessions how to upgrade older workspaces safely
- `adapter-contract.json` defines stable handoff fields across Copilot, Codex, Claude, Gemini, OpenHands, generic CLI, and file-based runtimes
- `session-continuity.md` defines the source-of-truth order when moving work between agents

If a newer agent enters an older workspace, run `reconcile_workspace_initialization` before relying on the latest runtime behavior. Live dashboard and runtime state are merged; generated compatibility contracts refresh to the latest baseline.

## Readiness And Archival

The readiness layer answers: "What still needs to be true before this workspace is ready for repeatable DX/AX operation?"

- `assess_workspace_readiness` can score the workspace and optionally write `maturity-scorecard.json`
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
| `compact_harness_runtime` | Archive older closed sessions |
| `prepare_harness_work_packet` | Rebuild the work packet and actor inbox files |

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
| `launch_harness_native_executor` | Launch a supported native executor |
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
