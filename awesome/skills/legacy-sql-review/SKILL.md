---
name: "Legacy SQL Review"
description: "Review legacy SQL and mapper queries for correctness, performance, binding safety, pagination issues, and maintainability."
argument-hint: "Provide the SQL file, mapper, query snippet, or review scope"
user-invokable: true
disable-model-invocation: false
---

# Legacy SQL Review

Use this skill when reviewing SQL in legacy or enterprise systems, especially where mapper frameworks and vendor-specific database behavior matter.

## Review Priorities

1. Correctness and data integrity
2. Missing or unsafe parameter binding
3. Pagination and ordering stability
4. Performance risks such as repeated subqueries, non-sargable predicates, or unnecessary DISTINCT/UNION
5. Hard-coded locale, code, or environment assumptions
6. Maintainability and mapper readability

## Procedure

1. Identify the purpose of the query and the expected result shape.
2. Review joins, filters, grouping, and ordering for correctness.
3. Check parameter binding and dynamic SQL behavior.
4. Look for vendor-specific edge cases such as pagination, null handling, or optimizer-hostile patterns.
5. Recommend concrete rewrites or targeted experiments when the issue is not provable from static review alone.

## Output Format

- Query goal
- Findings by severity
- Performance observations
- Binding and safety observations
- Suggested rewrite or validation steps
- Test data or execution scenarios worth checking

## Rules

- Be explicit when a concern is static evidence versus execution-plan speculation.
- Prefer practical rewrites over abstract style criticism.
- Highlight missing tests for edge-case data, pagination, and empty-result behavior.
