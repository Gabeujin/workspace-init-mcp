---
name: "Message Resource Lookup"
description: "Find localization or message resource IDs, trace where they are used, and check for reuse before introducing new strings."
argument-hint: "Provide a message ID, visible text, locale key, or source file to inspect"
user-invokable: true
disable-model-invocation: false
---

# Message Resource Lookup

Use this skill when UI or backend text is managed through message IDs, locale references, translation tables, or resource bundles.

## Good Fits

- Find the text behind an existing message ID
- Find the message ID behind visible UI text
- Trace where a message resource is used across frontend and backend
- Check for duplicate or near-duplicate messages before adding a new one
- Audit localization coverage in layered applications

## Procedure

1. Determine the lookup mode:
   - ID to text
   - text to candidate IDs
   - file to referenced message IDs
   - message ID to usage locations
2. Search the primary resource source first, then code references.
3. Record every confirmed usage location with file and context.
4. Group findings by message type when the system distinguishes alerts, titles, buttons, codes, or menus.
5. Call out duplicates, ambiguity, and missing localization coverage.

## Output Format

- Requested lookup
- Matching resource entries
- Usage locations
- Similar or duplicate candidates
- Risks or follow-up suggestions

## Rules

- Prefer reuse over creating new near-duplicate resources.
- Separate exact matches from fuzzy matches.
- If locale coverage is incomplete, say which languages or surfaces appear missing.
