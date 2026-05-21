# workspace-init-mcp

[![npm version](https://img.shields.io/npm/v/workspace-init-mcp)](https://www.npmjs.com/package/workspace-init-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

`workspace-init-mcp` is an MCP server that installs an AI-native governance harness into a project without taking ownership of application source code.

Version `4.6.1` ships the Hypertext Harness Dashboard as a single-file HTML Project World Model backed by JSONL events, JSON projections, a read-only local API, stakeholder-friendly interactive views, and domain-specific evidence gates. The main shift is from Markdown/JSON-only reporting to a durable hypertext dashboard that can be shared, served locally, inspected by AI agents, and used as a project continuity layer.

---

## What This Project Does

`workspace-init-mcp` helps AI agents and human teams keep project work coherent across long sessions, multiple models, parallel workers, and interrupted handoffs.

It generates:

| Surface | Purpose |
| --- | --- |
| Agent instructions | Platform-specific guidance for Codex, Copilot, Cursor, Claude Code, Antigravity, OpenHands, and portable MCP clients. |
| Harness governance | Planning, review, work-packet, evidence, handoff, decision, and reconciliation contracts. |
| Hypertext dashboard | A single-file `index.html` Project World Model with tabs, charts, Gantt/Kanban work views, audience lenses, multilingual UI, and slide-show briefing mode. |
| Ledger and projections | Canonical JSONL events plus rebuildable JSON state, index, runtime, entity, and embedding projections. |
| Local listener | Token-protected, loopback-only, read-only dashboard API with SSE and deterministic query support. |
| Reconcile tools | Non-destructive refresh of managed harness files while protecting application source roots. |
| Parallel orchestration | Expected read/write path contracts, chunk conflict audits, worker assignment, and evaluator loops. |
| Domain operations | Optional stress profiles for identity/commerce, legacy modernization, and content-release governance with evidence gates and report sections. |

The harness is designed for both new services and existing production-adjacent projects that already have source code, history, and team conventions.

---

## 4.6.1 Highlights

### Hypertext Dashboard First

The dashboard is now the primary stakeholder surface, not a generated Markdown report.

- `docs/ai-harness/dashboard/index.html` is a portable single-file HTML dashboard.
- It embeds CSS, JavaScript, design tokens, chart helpers, and a bounded project snapshot.
- It can run as a static file or through the generated read-only local listener.
- It presents the same ledger-backed truth differently for stakeholders, AI agents, and maintainers.

### Ledger-First Project World Model

The canonical truth is the append-only event ledger:

```text
docs/ai-harness/dashboard/events/harness-events.jsonl
```

Rebuildable projections live under:

```text
docs/ai-harness/dashboard/state/
docs/ai-harness/dashboard/entities/
docs/ai-harness/dashboard/schemas/
```

Every generated status claim is expected to carry provenance: sequence, source, timestamp, freshness, confidence, owner, and evidence.

### Stakeholder-Friendly UI

The generated HTML dashboard includes:

- Executive Overview landing view.
- Work tab with open work, progress, blockers, Kanban, and Gantt timeline.
- Evidence tab for claim-to-proof traceability.
- Governance tab for decisions, gates, retros, and platform intake.
- System and Tech Stack views for runtime, listener, architecture, infrastructure, and integration surfaces.
- Audience Lens modes: Stakeholder, AI Agent, Maintainer.
- Korean/English language switching.
- Stakeholder slide-show mode for clean briefing and report conversations.
- WCAG-oriented keyboard, focus, ARIA, reduced-motion, and non-color-only status patterns.

### Domain Stress And Briefing Packs

4.6.1 adds domain stress profiles that make the dashboard more useful for real service work instead of generic project tracking.

- `identity-commerce-operations`: credential/auth, payment, refund, fulfillment, and operational evidence gates.
- `legacy-modernization-governance`: AS-IS/TO-BE mapping, migration, rollback, ownership, and compatibility evidence gates.
- `content-release-governance`: message map, approval, localization, publishing, and post-release evidence gates.
- `record-domain-evidence` updates the matching work queue, readiness rows, operations timeline, report sections, and missing-evidence signals.
- `export-report` produces `briefing.md`, `speaker-notes.md`, `evidence-appendix.json`, and `report-manifest.json` from the dashboard state.
- `/api/harness-dashboard/v1/briefing` exposes the same report pack through the read-only local listener.

### Read-Only Local Listener

The generated listener is a helper, not a hidden backend product.

- Restored on harness activity.
- Loopback host only by default.
- Local token required for API calls.
- Host and Origin checks.
- CORS disabled.
- DNS rebinding protection.
- Strict CSP for served HTML.
- No shell, file writes, LLM calls, or persistence from deterministic query routes.

### Agent Continuity

AI agents can resume from dashboard projections instead of chat history.

Key generated briefs:

- `stakeholderBrief`: what changed, why it matters, risks, decisions, owner, next milestone.
- `agentResumeBrief`: next safest action, blockers, validation commands, authoritative files, stale/dirty warnings.
- `governanceEvidenceBrief`: missing evidence, stale projections, unresolved decisions, unlinked VCS records.

The MCP tool `get_harness_dashboard_context` reads projections only. It does not start listeners, refresh VCS, append events, mutate state, run shell commands, or call an LLM.

### Parallel-Agent Safety

Parallel work is supported through explicit chunk contracts.

- Workers must receive disjoint `expectedWritePaths`.
- `audit_harness_parallel_chunk_conflicts` checks open and queued sessions for path overlap.
- Shared surfaces such as lockfiles, CI workflows, DB migrations, API contracts, and global config are treated as integration-sensitive.
- The hub/orchestrator owns merge review, evaluator feedback, evidence capture, and final integration.

This does not magically solve merge conflicts. It reduces them by making write ownership explicit before workers begin, then requiring review receipts and integration ownership before closeout.

---

## Quick Start

The published MCP command is:

```bash
npx -y workspace-init-mcp
```

Use an absolute `workspacePath`. Relative paths are rejected by the tool schemas and runtime checks.

### New Project

Ask your agent:

```text
Use workspace-init-mcp. Initialize this project with strict governance,
balanced autonomy, harness engineering, and agent skills. Then validate the workspace.
```

Recommended flow:

1. `get_init_form_schema`
2. `initialize_workspace`
3. `validate_workspace`
4. `get_harness_dashboard_context`
5. Start governed work through plan, review, chunk contract, implementation, evaluation, verification, and closeout.

### Existing Project

Ask your agent:

```text
Use workspace-init-mcp for non-destructive legacy adoption.
First call analyze_workspace, then preview_workspace_init.
Do not delete, move, truncate, or replace application source.
If the preview is safe, call initialize_workspace with force=false, then validate_workspace.
```

Recommended flow:

1. `analyze_workspace`
2. `preview_workspace_init`
3. `initialize_workspace` with `force: false`
4. `validate_workspace`
5. `audit_workspace_upgrade_risk`
6. `reconcile_workspace_initialization` dry run before applying future managed-file upgrades

Protected application roots such as `src/`, `app/`, `packages/`, `services/`, `server/`, `client/`, `frontend/`, `backend/`, `api/`, `web/`, and `mobile/` remain outside workspace-init ownership unless a later explicit implementation contract names them.

---

## Local Development

Build a local checkout:

```powershell
cd C:\workSpace\dev\root\workspace-init-mcp
npm install
npm run build
```

Run the local MCP server through an MCP client with:

```powershell
node C:\workSpace\dev\root\workspace-init-mcp\dist\index.js
```

This server uses MCP stdio. In normal use, the agent tool launches it from MCP configuration rather than keeping it as a standalone terminal service.

Example local Codex configuration:

```powershell
codex mcp add workspace-init-local -- node "C:\workSpace\dev\root\workspace-init-mcp\dist\index.js"
codex mcp get workspace-init-local
```

Generic MCP configuration:

```json
{
  "mcpServers": {
    "workspace-init-local": {
      "type": "stdio",
      "command": "node",
      "args": ["C:\\workSpace\\dev\\root\\workspace-init-mcp\\dist\\index.js"]
    }
  }
}
```

---

## Dashboard Operations

After initialization, dashboard operations are available inside the target project:

```bash
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs verify-projections
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs refresh
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs ensure-listening
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs status
```

Common commands:

| Command | Purpose |
| --- | --- |
| `verify-projections` | Validate required Project World Model fields and reference integrity. |
| `refresh` | Refresh disposable projections and collect VCS/evidence signals. |
| `rebuild-projections` | Rebuild projection files from the embedded HTML snapshot. |
| `repair-projections` | Quarantine corrupt JSON and rebuild projections when possible. |
| `ensure-listening` | Restore the read-only local listener on an available port. |
| `restart` | Stop and restart the listener for the current workspace. |
| `record-agent-platforms` | Persist the user's active AI-agent platforms into governance state. |
| `record-domain-evidence` | Resolve, waive, or re-block a domain stress evidence gate while syncing queues, timeline, readiness rows, and reports. |
| `export-static --public` | Export a redacted single-file stakeholder snapshot. |
| `export-report --focus today --public` | Export a dashboard-derived briefing pack with speaker notes, evidence appendix, and report manifest. |

The listener exposes read-only routes under:

```text
/api/harness-dashboard/v1/snapshot
/api/harness-dashboard/v1/index
/api/harness-dashboard/v1/tasks
/api/harness-dashboard/v1/sessions
/api/harness-dashboard/v1/dictionary
/api/harness-dashboard/v1/version-control
/api/harness-dashboard/v1/runtime
/api/harness-dashboard/v1/briefing
/api/harness-dashboard/v1/health
/api/harness-dashboard/v1/events
/api/harness-dashboard/v1/query
```

Every response includes API version, schema version, workspace identity, projection version, ledger offset, generated time, capabilities, and `readOnly: true`.

---

## Agent Platform Governance

`workspace-init-mcp` detects and reinforces common AI-agent instruction surfaces:

| Platform | Typical files |
| --- | --- |
| Codex | `AGENTS.md`, `.codex/` |
| GitHub Copilot / VS Code | `.github/copilot-instructions.md`, `.vscode/mcp.json` |
| Cursor | `.cursor/rules/`, `.cursorrules` |
| Claude Code | `CLAUDE.md`, `.claude/` |
| Antigravity / Gemini-style agent IDEs | `.agents/plugins/`, `.agents/skills/` |
| OpenHands | `.openhands/`, `.agents/` |

When platform detection is ambiguous, the generated dashboard includes an AI Agent Platform Intake panel. Persist the declaration with:

```bash
node docs/ai-harness/dashboard/scripts/dashboard-ops.mjs record-agent-platforms --platforms codex,cursor --source user-declaration
```

Inactive platform instruction files are marked as unused governance surfaces instead of being treated as active truth.

---

## Generated File Ownership

workspace-init owns only harness and governance surfaces such as:

```text
.github/ai-harness/
.github/agents/
.github/skills/
.governance/
.vscode/
docs/ai-harness/
docs/context/
docs/plans/
docs/reviews/
docs/handovers/
docs/work-logs/
AGENTS.md
CLAUDE.md
```

Application source remains project-owned. Reconcile prefers merge or hold behavior for live state and customized governed files. It archives managed files before replacing them when replacement is allowed.

---

## Tool Families

Main MCP tools include:

| Tool | Use |
| --- | --- |
| `analyze_workspace` | Inspect an existing workspace and detect project/agent surfaces. |
| `preview_workspace_init` | Show what initialization would create before writing. |
| `initialize_workspace` | Generate the harness baseline. |
| `validate_workspace` | Check required and recommended artifacts. |
| `audit_workspace_upgrade_risk` | Identify managed-file drift and upgrade risk. |
| `reconcile_workspace_initialization` | Refresh generated harness artifacts safely. |
| `restore_reconcile_backup` | Restore archived managed files from a reconcile run. |
| `get_harness_dashboard_context` | Read dashboard projections for AI-agent resume. |
| `audit_harness_parallel_chunk_conflicts` | Check expected write-path overlap before parallel work. |
| `open_harness_session` / runtime tools | Start and manage governed sessions, chunks, handoffs, and native execution. |

---

## Quality And Safety Baseline

Version `4.6.1` includes these guardrails:

- Absolute `workspacePath` enforcement.
- Non-destructive adoption for legacy projects.
- Generated-path safety checks for traversal, drive-qualified paths, and protected source roots.
- Managed-file inventory and reconcile policy validation.
- Strict dashboard state contract shared by schema generation, dashboard ops, and validation.
- JSONL ledger manifest with sequence and hash provenance.
- Atomic temp-file plus rename writes for projection/runtime updates.
- Local listener token auth, loopback-only host checks, disabled CORS, and strict CSP.
- Public export redaction for local paths, users, tokens, secrets, private URLs, and sensitive notes.
- Runtime state corruption reporting that distinguishes malformed JSON from missing artifacts.
- Parallel chunk conflict audits for open and queued sessions.
- Semantic readiness scoring that does not hide missing evidence behind structural completeness.

---

## Development Checks

Run:

```bash
npm test
```

This builds TypeScript and runs the harness generation regression suite:

```bash
npm run build
node tests/harness-generation.test.js
```

Before publishing:

```bash
npm run clean
npm test
npm pack --dry-run
```

`prepack` runs a build so package contents do not depend on stale local `dist/` output.

---

## 4.6.1 Release Notes

Major changes:

- Reframed the Harness Dashboard as a hypertext Project World Model.
- Moved stakeholder communication from Markdown-centric reports to a single-file HTML dashboard.
- Added audience lenses, slide-show briefing mode, multilingual UI, Tech Stack view, Gantt/Kanban work visualization, and clearer tab purposes.
- Added domain stress profiles for identity/commerce operations, legacy modernization governance, and content-release governance.
- Added domain evidence gates that keep missing evidence, work queues, readiness rows, report sections, and operations timelines synchronized.
- Added dashboard-derived briefing/report export with speaker notes, evidence appendix, report manifest, and read-only `/briefing` API support.
- Extended initialization inputs for primary domains, governance profile, autonomy mode, token budget, domain stress profile, and legacy adoption posture.
- Added dashboard context APIs and read-only listener behavior for AI-agent resume.
- Added agent platform detection, user declaration flow, and instruction surface indexing.
- Strengthened parallel-agent chunk conflict guidance and expected write-path governance.
- Improved projection validation, runtime state handling, and dashboard operations.

Compatibility notes:

- No database or cloud deployment service is required.
- The local listener is restored by harness activity, not installed as an OS startup daemon.
- Persistent UI writes remain out of scope; dashboard controls are local view controls unless an explicit ops command records a governance event.
- Existing projects should use preview and reconcile dry-runs before applying managed-file refreshes.
