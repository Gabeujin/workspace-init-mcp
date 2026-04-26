---
name: "Workspace Reconcile Safety"
description: "Safely upgrades legacy or older initialized workspaces to the latest managed harness structure with dry-run, backup, restore, and review discipline."
argument-hint: "Describe the legacy workspace state, the upgrade goal, and any safety constraints."
user-invokable: true
disable-model-invocation: false
---

# Workspace Reconcile Safety

Use this skill when an existing repository or an older workspace-init-mcp output must be upgraded without losing governed work.

## Safety Rules

- Prefer a dry run first. Review planned writes, merges, legacy imports, and manual-review items before applying.
- Treat runtime, dashboard, and readiness JSON as merge candidates, not disposable files.
- Archive replaced managed files so restore is possible through reconcile backups.
- If a git repository exists, prefer a clean checkpoint before applying reconcile.
- Preserve custom skills and agents by importing them into canonical `.github` paths instead of deleting older IDE-specific copies.

## Recommended Flow

1. Analyze the workspace and confirm the inferred project type, domains, and IDE targets.
2. Run a dry reconcile plan and inspect the migration report.
3. Review any manual-review items and custom generated-file drift.
4. Apply reconcile only after the plan looks safe.
5. Validate the workspace and refresh the dashboard afterward.
6. If needed, restore managed files from the reconcile backup report.

## Output Expectations

- A clear list of planned or applied writes
- Explicit warnings about git, missing backups, or manual-review items
- Durable migration artifacts under `docs/ai-harness/migrations/`
- A restore path when managed files were refreshed
