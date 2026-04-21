---
name: "Service Endpoint Tracer"
description: "Trace service identifiers, URLs, controllers, services, mappers, and call chains across layered or legacy systems."
argument-hint: "Provide a service ID, URL, controller, mapper, or source file to trace"
user-invokable: true
disable-model-invocation: false
---

# Service Endpoint Tracer

Use this skill when a project needs evidence-backed tracing from UI calls or service identifiers into backend endpoints and storage layers.

## Good Fits

- Legacy enterprise applications with controller -> service -> mapper layering
- Frontend service IDs or URL calls that need a backend owner
- Mapper or SQL IDs that must be traced back to an endpoint
- Migration and impact analysis work where hidden dependencies matter

## Trace Procedure

1. Start from the strongest known identifier:
   - service ID
   - URL or route
   - controller method
   - service method
   - mapper or SQL ID
2. Follow the call chain one hop at a time and record evidence at each hop.
3. Distinguish confirmed links from inferred links.
4. Capture side inputs such as common code lookups, shared utilities, or message resources when they affect the flow.
5. End with a compact path summary that names the files, methods, and boundaries involved.

## Output Format

- Entry point
- Trace path
- Supporting evidence
- Impacted layers
- Open questions
- Verification suggestions

## Rules

- Do not invent links that are not supported by repository evidence.
- Mark inferred mappings explicitly.
- Prefer tight, file-backed traces over broad speculation.
- When a trace crosses multiple subsystems, note the blast radius.
