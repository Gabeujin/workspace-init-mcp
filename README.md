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

It is designed for VS Code, Cursor, Claude Code, and OpenHands.

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

## What It Generates

Tell your LLM to initialize the workspace and the server can generate:

- `.github/copilot-instructions.md`
- `.github/agents/` and `.github/skills/` as the canonical registry, plus optional `.cursor/`, `.claude/`, and `.agents/` mirrors
- `.github/ai-harness/` for governance and operating-model artifacts
- `docs/ai-harness/dashboard/` for a simple administrator dashboard backed by JSON files instead of a database
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
- curated harness skills and agents are included for governance management, orchestration, expert review, verification, and final quality gates
- a default dashboard operator agent and related skills keep progress state, KPI cards, issue visibility, domain lenses, and git traceability readable for non-developers
- harness profiles help teams choose between lean, balanced, regulated, and autonomous operating modes

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

## Tools

| Tool | Description |
|---|---|
| `initialize_workspace` | Generate all workspace files |
| `preview_workspace_init` | Preview generated files without writing them |
| `analyze_workspace` | Detect project type and tech stack |
| `validate_workspace` | Check initialization completeness |
| `list_project_types` | List available project types |
| `list_harness_profiles` | List built-in AI harness profiles |
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
