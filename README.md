# workspace-init-mcp

[![npm version](https://img.shields.io/npm/v/workspace-init-mcp)](https://www.npmjs.com/package/workspace-init-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

`workspace-init-mcp` is an MCP server that scaffolds AI-ready workspaces with:

- copilot instructions
- agent skills and agents
- documentation governance
- cross-IDE configuration
- an AI harness for long-running, resumable delivery
- a JSON-first admin dashboard for progress, KPI, issue, session, and git visibility

It is designed for VS Code, Cursor, Claude Code, OpenHands, and portable CLI-driven agent runtimes.

## Setup

Add the server to your MCP configuration.

### VS Code (`settings.json`)

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

### VS Code (`.vscode/mcp.json`)

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

### Claude Desktop (`claude_desktop_config.json`)

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
```

Then verify it from Codex with:

```bash
codex mcp get workspace-init
```

## What It Generates

Tell your LLM to initialize the workspace and the server can generate:

- `.github/copilot-instructions.md`
- `.github/agents/` and `.github/skills/` as the canonical registry, plus optional `.cursor/`, `.claude/`, and `.agents/` mirrors
- `.github/ai-harness/` for governance and operating-model artifacts
- `.github/ai-harness/managed-file-inventory.json` for safer future reconcile runs and upgrade-risk audits
- `.github/ai-harness/reconcile-policy.json` for file-level hold / merge / replace safety rules during reconcile
- `.github/ai-harness/native-executor-overrides.json` for workspace-local GitHub Copilot, Codex CLI, Claude Code, and Gemini CLI launch tuning
- `docs/ai-harness/readiness/` for the remaining-work specification, scoring model, readiness scorecard template, and later semantic audit outputs
- `docs/ai-harness/dashboard/` for a simple administrator dashboard backed by JSON files instead of a database
- `docs/ai-harness/runtime/` for the planner / generator / evaluator runtime state machine, session snapshots, bridges, native executor launch plans, and archive bundles
- `docs/ai-harness/migrations/` for reconcile reports and archived managed-file backups created during upgrades
- `.vscode/settings.json` and workspace instruction files
- `.editorconfig` and `.gitattributes`
- `docs/work-logs`, `docs/changelog`, `docs/adr`, `docs/troubleshooting`
- `docs/context`, `docs/reviews`, `docs/handovers`, `docs/plans`

## AI Harness Focus

The current version adds a stronger long-running delivery harness:

- governance documentation must bracket meaningful agent work
- meaningful work follows `Plan 1 -> Review 1 -> Plan 2 -> Review 2 -> Plan 3 -> Review 3` before broad implementation starts
- large work is expected to be chunked into resumable execution units
- review evidence, handovers, and context ledgers are generated as first-class artifacts
- a real file-system runtime is available for `planner -> generator -> evaluator` orchestration through governed session JSON
- curated harness skills and agents are included for governance management, orchestration, expert review, verification, and final quality gates
- a default dashboard operator agent and related skills keep progress state, KPI cards, issue visibility, domain lenses, and git traceability readable for non-developers
- harness profiles help teams choose between lean, balanced, regulated, and autonomous operating modes
- the Codex bridge now prefers `codex exec` for governed non-interactive runs and captures the final assistant message as a durable runtime artifact
- runtime compatibility files index version-by-version harness capabilities and define a stable adapter contract for Copilot, Codex, Claude, Gemini, OpenHands, and portable runtimes

## Admin Dashboard

Each initialized workspace now includes a file-system-first administrator dashboard under `docs/ai-harness/dashboard/`.

- `state/dashboard-state.json` is the live source of truth for progress, KPI, issues, session history, artifacts, and git visibility
- `templates/*.state.json` includes starter models for software delivery, creative narrative work, knowledge workflows, and generic transformation initiatives
- `index.html` renders a simple, readability-first screen that non-developers can open without a database or backend
- `scripts/dashboard-ops.mjs` refreshes state automatically, synchronizes git status, serves the dashboard locally, validates the stricter schema, and exports static snapshots
- the dashboard is designed to support DX (Digital Transformation) and AX (AI Transformation) operating models by making governance and delivery state visible outside chat history

This makes the scaffold usable not only for software projects, but also for domains such as:

- application and platform delivery with version-ledger tracking
- narrative and publishing work with timeline and character visibility
- learning, research, and analysis programs with module and evidence tracking
- general transformation initiatives that need milestone, KPI, issue, and handover visibility

## Legacy And New Projects

This MCP is designed to work in both scenarios:

- **Legacy project adoption**: analyze the existing repository, overlay governance and dashboard artifacts, then use the harness as the operational architecture while modernization proceeds in chunks
- **New project delivery**: start from the harness on day one so planning, reviews, dashboard visibility, tests, and version tracking are part of the default architecture

The goal is the same in both cases: the project can operate under a DX/AX-friendly harness without requiring a database or a separate observability platform.

When an existing repository or an older initialized workspace needs to catch up to the latest structure, use `reconcile_workspace_initialization`. It preserves live governed JSON state, fills missing latest-version artifacts, archives replaced managed files, and can import legacy skill and agent resources from older IDE-specific roots into canonical `.github` paths.

For safer legacy adoption:

- `reconcile_workspace_initialization` defaults to a dry run. Set `applyChanges: true` only after reviewing the plan.
- `requireCleanGitWhenPresent: true` can refuse writes when the repository has uncommitted changes.
- `audit_workspace_upgrade_risk` can estimate whether the workspace is missing a managed baseline, has customized managed files, or should stay in manual-review mode.
- `audit_workspace_managed_semantic_diff` can generate a readable baseline-vs-current report so operators can see which managed files are unchanged, customized, merge-diverged, or missing.
- `export_reconcile_preflight_report` can write JSON, Markdown, and HTML preflight snapshots so upgrade decisions can be reviewed and shared before any apply run.
- `requireZeroManualReviewItemsForApply: true` can block reconcile apply runs until customized managed files and other manual-review items have been resolved.
- reconcile can now carry semantic diff evidence into migration reports so upgrade decisions remain reviewable after the run.
- `reconcile-policy.json` lets operators define file-level hold / merge / replace behavior instead of relying only on global overwrite flags.
- `native-executor-overrides.json` lets teams tune GitHub Copilot handoffs, Codex CLI, Claude Code / Claude CLI, and Gemini CLI launch conventions without editing MCP code.
  It now supports base replacement plus `prepend` / `append` command fragments for both bridge launch scripts and native executor args.
- the managed file inventory lets newer initialized workspaces distinguish generated baseline files from later customization during reconcile.
- `restore_reconcile_backup` can roll managed-file refreshes back from the backups stored under `docs/ai-harness/migrations/`.
- reconcile reports and restores are constrained to workspace-local migration artifacts so upgrades stay reversible and bounded.

## Version Compatibility And Agent Switching

Version `4.1.2` adds a small compatibility layer under `docs/ai-harness/runtime/`:

- `version-index.json` records which harness capabilities and files were introduced by each workspace-init-mcp release.
- `compatibility-matrix.json` tells `@latest` sessions how to upgrade older workspaces safely before using newer runtime behavior.
- `adapter-contract.json` defines the stable handoff fields every adapter should preserve across Copilot, Codex, Claude, Gemini, OpenHands, generic CLI, and file-based runtimes.
- `session-continuity.md` describes the source-of-truth order and switching checklist so a task can move between agents without losing `sessionId`, `chunkId`, phase, lease, receipts, or evidence.

If an agent enters an older workspace with a newer server, run `reconcile_workspace_initialization` first. Live dashboard and runtime state are merged, while generated compatibility contracts refresh to the latest baseline.

## Readiness Layer

Each initialized workspace now includes a readiness layer under `docs/ai-harness/readiness/`.

- `remaining-work-spec.md` defines the conservative post-initialization definition of done
- `scoring-model.md` explains the weighted readiness dimensions and thresholds
- `maturity-scorecard.template.json` provides a machine-readable template for ongoing assessment
- `assess_workspace_readiness` can score the workspace and optionally write `maturity-scorecard.json`
- `audit_workspace_readiness_semantics` can perform a more conservative semantic audit and optionally write `semantic-audit.json`

This gives operators an explicit answer to a practical question: "What still needs to be true before this workspace is genuinely ready for repeatable DX/AX-style operation?"

## Runtime Archival

Long-running governed delivery can accumulate many closed sessions. The runtime now includes `docs/ai-harness/runtime/archive/` plus `compact_harness_runtime` so older closed sessions can be moved into durable archive bundles while the active ledgers and dashboard stay readable.

## Tools

| Tool | Description |
|---|---|
| `initialize_workspace` | Generate all workspace files |
| `reconcile_workspace_initialization` | Safely upgrade an existing repository or older initialized workspace to the latest managed structure, dry-run first by default |
| `audit_workspace_upgrade_risk` | Audit managed baseline drift, git cleanliness, and legacy resource roots before reconcile |
| `audit_workspace_managed_semantic_diff` | Generate a readable semantic diff report for managed baseline files before reconcile |
| `export_reconcile_preflight_report` | Export JSON, Markdown, and HTML reconcile preflight reports for safe upgrade review |
| `restore_reconcile_backup` | Restore managed files from a reconcile backup report under `docs/ai-harness/migrations/` |
| `preview_workspace_init` | Preview generated files without writing them |
| `analyze_workspace` | Detect project type and tech stack |
| `validate_workspace` | Check initialization completeness |
| `assess_workspace_readiness` | Score the initialized workspace against the readiness model and optionally write a scorecard |
| `audit_workspace_readiness_semantics` | Audit whether the workspace looks operationally real beyond file existence alone |
| `list_project_types` | List available project types |
| `list_harness_profiles` | List built-in AI harness profiles |
| `start_harness_session` | Open a governed planner / generator / evaluator runtime session |
| `advance_harness_session` | Move the active runtime session through the governed state machine |
| `get_harness_session_status` | Read the active runtime session and next actor brief |
| `activate_harness_session` | Move the single active runtime lease to another open or queued session |
| `audit_harness_runtime` | Audit runtime ledgers, queue state, and session file consistency |
| `compact_harness_runtime` | Archive older closed runtime sessions into durable archive bundles |
| `prepare_harness_work_packet` | Rebuild the durable per-session work packet and actor inbox handoff files |
| `list_harness_runtime_adapters` | List the supported runtime adapters for GitHub Copilot, Codex CLI, Claude Code, Gemini CLI, generic CLI agents, OpenHands, and generic file-based execution |
| `prepare_harness_adapter_handoff` | Generate a runtime-specific handoff bundle for a governed session |
| `list_harness_execution_bridges` | List the concrete execution bridges that turn handoffs into launch bundles |
| `list_harness_native_executors` | List the directly launchable native runtime integrations and local command detection |
| `prepare_harness_native_executor` | Build the governed native execution plan, state file, and log targets |
| `launch_harness_native_executor` | Launch a supported native executor in foreground or background mode |
| `get_harness_native_execution_status` | Read the current or session-specific native execution state snapshot |
| `prepare_harness_execution_bridge` | Generate a launch-ready execution bridge bundle for a governed session |
| `record_harness_execution_result` | Record the governed receipt that returns an external runtime result to the harness |
| `get_init_form_schema` | Get the initialization form schema |
| `recommend_agent_skills` | Recommend skills and agents |
| `search_agent_skills` | Search the skill catalog |
| `install_agent_skills` | Install specific skills or agents |
| `list_agent_skills_catalog` | Browse the full catalog |

## Project Types

Supported project types:

- `learning`
- `web-app`
- `api`
- `mobile`
- `data-science`
- `devops`
- `creative`
- `library`
- `monorepo`
- `consulting`
- `ecommerce`
- `fintech`
- `healthcare`
- `saas`
- `iot`
- `other`

## License

MIT
