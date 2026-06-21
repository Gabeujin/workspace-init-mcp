# workspace-init-mcp

[![npm version](https://img.shields.io/npm/v/workspace-init-mcp)](https://www.npmjs.com/package/workspace-init-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

`workspace-init-mcp` installs a non-destructive AI Work Harness that lets humans and agents plan, resume, verify, and hand off project work from durable evidence instead of chat history.

Version `4.6.5` adds dashboard-first traceability and projection confidence: users can see what was requested, what process ran, what result was recorded, what evidence backs it, what residual risk remains, and whether the projection is still bootstrap/debt-limited without reading raw JSON or chat history. It keeps the 4.6.x domain-independent world-model harness: state-externalizing working-memory contracts, extensible domain stress profiles, and a persisted work-review-improve loop.

---

## What This Project Does

`workspace-init-mcp` helps AI agents and human teams keep project work coherent across long sessions, multiple models, parallel workers, and interrupted handoffs.

It generates:

| Surface | Purpose |
| --- | --- |
| Agent instructions | Platform-specific guidance for Codex, Copilot, Cursor, Claude Code, Antigravity, OpenHands, and portable MCP clients. |
| Harness governance | Planning, review, work-packet, evidence, handoff, decision, and reconciliation contracts. |
| Hypertext dashboard | A single-file `index.html` Project World Model with reality map, goal compass, context-rot monitor, operational command queue, audience lenses, multilingual UI, and slide-show briefing mode. |
| Ledger and projections | Canonical JSONL events plus rebuildable JSON state, index, runtime, entity, and embedding projections. |
| Local listener | Token-protected, loopback-only, read-only dashboard API with SSE and deterministic query support. |
| Reconcile tools | Non-destructive refresh of managed harness files while protecting application source roots. |
| Parallel orchestration | Expected read/write path contracts, chunk conflict audits, worker assignment, and evaluator loops. |
| Domain operations | Optional built-in or custom stress profiles with evidence gates, report sections, readiness checks, and operations views. |

The harness is designed for both new services and existing projects that already have source code, history, learning records, research material, operating rules, or team conventions.

---

## 4.6.5 Highlights

### Stateful Cognitive Offloading

The harness now treats the model and the generated project state as separate cooperating systems.

- The model focuses on semantic judgment, planning, critique, and synthesis.
- The harness maintains recoverable state: dashboard projections, evidence links, work packets, handoffs, review records, and compact resume briefs.
- Generated runtime handoffs include a `workingMemory` contract that separates prompt-facing context from outer durable stores.
- Agents are expected to verify evidence before promoting facts into the dashboard world model.
- Long work is resumed from ledger-backed state instead of chat memory alone.

### Work, Negative Review, Improve Loop

The runtime now persists evaluation loop history instead of leaving review pressure as prose guidance.

- Work packets and adapter handoffs expose `evaluationLoop.history`.
- `advance_harness_session` can record verdicts, findings, required fixes, verification evidence, residual risk, and before/after scores.
- The default quality rhythm is: do the work, ask for negative review, apply improvements, verify, then record the evidence.
- Harness state is intentionally allowed to start below release quality; it should improve through repeated review receipts.

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

The generated state now promotes three project-agnostic continuity contracts:

- `realityModel`: product, repository, service/work-system, environment, data, owner, and external dependency relationships with evidence freshness.
- `goalCompass`: current reality, goal state, top gaps, parent goal graph, next safe move, and forbidden drift.
- `contextRotMonitor`: stale facts, contradiction risks, projection freshness, and the next evidence an agent should collect before implementation.

### Stakeholder-Friendly UI

The generated HTML dashboard includes:

- Executive Overview landing view.
- Work tab with a user task board for current, remaining, and completed work.
- Agent-only maintenance queues for dashboard refresh, projection, listener, and indexing chores.
- Operational progress, blockers, and timeline views built from user-visible work only.
- Evidence tab for claim-to-proof traceability.
- Governance tab for decisions, gates, retros, and platform intake.
- System and Tech Stack views for runtime, listener, architecture, infrastructure, and integration surfaces.
- Audience Lens modes: Stakeholder, AI Agent, Maintainer.
- Korean/English language switching.
- Stakeholder slide-show mode for clean briefing and report conversations.
- WCAG-oriented keyboard, focus, ARIA, reduced-motion, and non-color-only status patterns.

UI work follows current Chrome/Google I/O modern web guidance as progressive enhancement: live local updates, semantic DOM, user preference support, View Transitions or scroll-driven motion when useful, and HTML-in-Canvas only when accessible/searchable DOM fallback and browser QA remain intact.

### Domain Stress And Briefing Packs

4.6.5 keeps the built-in service profiles and adds custom profile support so the harness can fit a web application, learning plan, research corpus, documentation program, or other governed domain without hard-coding the world around commerce or release work.

- `identity-commerce-operations`: credential/auth, payment, refund, fulfillment, and operational evidence gates.
- `legacy-modernization-governance`: AS-IS/TO-BE mapping, migration, rollback, ownership, and compatibility evidence gates.
- `content-release-governance`: message map, approval, localization, publishing, and post-release evidence gates.
- Custom `domainStressProfile` IDs or labels generate generic domain glossary, actor/workflow, state contract, source-material, review, readiness, and handoff gates.
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
/api/harness-dashboard/v1/agent-tasks
/api/harness-dashboard/v1/traceability
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
Use `x-harness-dashboard-token` or Bearer auth for REST routes. Query-string tokens are reserved for the SSE `events` route because browser `EventSource` cannot send custom headers.

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
| `start_harness_session`, `list_harness_sessions`, `get_harness_session_log` / runtime tools | Start, inspect, and manage governed sessions, chunks, handoffs, and native execution. |

---

## Quality And Safety Baseline

Version `4.6.5` includes these guardrails:

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
- First-class session listing and request/process/result event logs for resumable user-facing work.
- Semantic readiness scoring that does not hide missing evidence behind structural completeness.
- Optional harness engineering generation that fully honors `includeHarnessEngineering: false`.
- Extensible domain stress profiles so built-in commerce, modernization, and content-release examples do not become hidden defaults.
- Persisted evaluation-loop receipts for negative review, required fixes, verification evidence, and residual risk.

---

## Versioning Policy

Every source, generated-resource, schema, contract, or documentation change must increment the package version. The default policy is the next patch version unless the change is intentionally minor or major.

When bumping the version, update these together:

- `package.json`
- `package-lock.json`
- `src/data/version.ts`
- README release notes

The central TypeScript version constants drive generated runtime, dashboard, reconcile, and managed-inventory metadata so future changes do not leave stale literal versions scattered through the codebase. Run `npm run version:check` before publishing; `npm test` runs the same check before build and generation tests.

---

## Development Checks

Run:

```bash
npm test
```

This builds TypeScript and runs the harness generation regression suite:

```bash
npm run version:check
npm run build
node tests/harness-generation.test.js
```

Before publishing:

```bash
npm run clean
npm test
npm pack --dry-run
```

`prepack` runs `clean` and `build` so package contents do not depend on stale local `dist/` output.

---

## 4.6.5 Release Notes

Major changes:

- Added a persistent dashboard projection-confidence rail that summarizes completeness, staleness, trust boundary status, missing evidence count, open decisions, last refresh, listener status, and the action gate before users treat projections as operational truth.
- Added `sessionTraceability` and `projectionConfidence` dashboard state contracts, schema coverage, generated validation, dashboard context exposure, and a read-only `/api/harness-dashboard/v1/traceability` listener route.
- Rendered session trace cards in the dashboard so stakeholders and agents can read original request, process summary, result summary, trace integrity, evidence refs, residual risk, and next step without raw JSON or chat history.
- Propagated runtime task trace integrity and evaluator residual risk into dashboard session logs, governed sessions, stakeholder briefs, agent resume briefs, governance evidence, and projection confidence.
- Split user task management from AI-Agent-only dashboard maintenance so generated bootstrap chores no longer appear as stakeholder waiting or blocked work.
- Added `userTaskBoard` and `agentTaskQueues` state contracts, validation gates, reconcile cleanup, public `/tasks`, and explicit `/agent-tasks` listener routes.
- Filtered stakeholder reports, work KPIs, Gantt/status lanes, and slide decks so internal projection refresh tasks cannot become visible open work or "now doing" items.
- Added Harness-1-inspired stateful cognitive offloading contracts for prompt-facing working memory and durable outer stores.
- Persisted negative review and improvement receipts in runtime session state, work packets, and adapter handoffs.
- Made `domainStressProfile` extensible instead of a closed enum; custom IDs or labels now produce generic evidence gates and operations projections.
- Centralized version constants so generated dashboard, runtime, reconcile, and managed-inventory metadata advance together.
- Honored `includeHarnessEngineering: false` across runtime, readiness, dashboard, and dashboard-ops generation.
- Generalized dashboard operations validation so custom domain profiles are first-class.
- Allowed custom domain stress names such as `Learning Growth Harness`, while normalizing them into stable profile IDs.
- Restored built-in domain stress profile suggestions in the init form without closing off custom values.
- Added `npm run version:check` so package, lockfile, central version constants, README release notes, and prepack policy are checked before tests.
- Lowered bootstrap KPI optimism where live evidence is still missing.
- Updated packaging so `prepack` cleans stale `dist/` output before building.

Compatibility notes:

- No database or cloud deployment service is required.
- The local listener is restored by harness activity, not installed as an OS startup daemon.
- Persistent UI writes remain out of scope; dashboard controls are local view controls unless an explicit ops command records a governance event.
- Existing projects should use preview and reconcile dry-runs before applying managed-file refreshes.
