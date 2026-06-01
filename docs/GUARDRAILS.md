# Guardrails

## Principle

Prompts can express intent, but only mechanical checks reliably preserve a codebase over time. When a rule matters enough to repeat, harden it.

## What To Encode Mechanically

### Architecture

- allowed dependency directions
- restricted module boundaries
- forbidden imports
- file size or complexity ceilings

### Reliability

- required tests for critical paths
- performance budgets
- startup and shutdown expectations
- migration requirements when schemas change

### Quality

- formatting and linting
- naming conventions
- typed boundary validation
- logging and observability requirements

### Safety

- secret scanning
- prompt injection checks for agent-authored docs
- path traversal protection for tooling
- explicit approval points for destructive operations

## Guardrail Ladder

Use this order when tightening the system:

1. Clarify the rule in a doc.
2. Put the rule into the task plan.
3. Add the rule to evaluation.
4. Encode the rule in tooling or CI.

If a failure recurs after step 3, move to step 4.

## Garbage Collection

Schedule recurring cleanup passes that:

- remove stale docs
- collapse duplicate helpers
- replace weak local patterns with shared utilities
- refresh indexes and logs
- upgrade recurring reviewer comments into explicit rules

## Signals That A New Guardrail Is Needed

- the same class of bug appears twice
- different agents solve the same problem in incompatible ways
- reviewers keep giving the same feedback
- plans keep passing while behavior still fails
- agents cannot tell where a concept should live
