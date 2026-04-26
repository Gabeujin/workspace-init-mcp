---
name: "CLI Runtime Bridge Orchestration"
description: "Prepares governed handoff bundles and portable launch guidance for CLI-based agents across local, sandboxed, and vendor-specific runtimes."
argument-hint: "Describe the CLI runtime, sandbox constraints, and the governed session that should continue there."
user-invokable: true
disable-model-invocation: false
---

# CLI Runtime Bridge Orchestration

Use this skill when a governed session needs to continue in a CLI-based agent such as Codex CLI, Claude Code, Gemini CLI, or another prompt-file driven runtime.

## Operating Rules

- Start from the governed handoff bundle, actor inbox, and work packet.
- Prefer portable launch envelopes over hidden chat context.
- Capture the actual command or wrapper script used for the run.
- Record stdout, stderr, and produced artifacts in governed files whenever possible.
- Return the result through a governed receipt or runtime state file before advancing the session.

## Recommended Flow

1. Prepare the runtime adapter handoff.
2. Prepare the execution bridge.
3. If the runtime has a stable native contract, use a native executor plan.
4. If the runtime is vendor-specific or sandbox-constrained, use the generic CLI bridge and customize the command template locally.
5. Record the outcome through governed receipts, logs, or runtime state artifacts.

## What Good Looks Like

- The bridge manifest identifies the exact handoff files and expected result paths.
- The CLI command can be reproduced by another operator.
- The governed session can resume without reading prior chat logs.
