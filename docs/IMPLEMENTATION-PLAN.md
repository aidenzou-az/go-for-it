# Implementation Plan

## Status

- Plan status: initial implementation complete
- Target: minimal `yxg` CLI v1
- Planning date: 2026-04-13

## Goal

Implement the smallest useful `yxg` CLI that can initialize a framework instance, validate it, create bounded work units, review them, and resume safely from durable state.

## Why This Slice

The current repository already has:

- kernel specs
- scaffold spec
- template spec
- canonical templates
- validator rules
- tooling contract

The highest-leverage next step is to build the minimum tooling surface that proves the framework can operate on a real repository without depending on future adapters.

## Scope

### In Scope

- reference CLI shape for `yxg`
- atomic file-write utilities
- template-copy and placeholder-fill utilities
- `init`
- `validate`
- `plan`
- `review`
- `resume`
- shared structured command output
- validator implementation for the v1 rule subset needed by the above commands

### Out Of Scope

- `import` implementation
- `cleanup` implementation
- `execute` implementation beyond a placeholder or explicit stub
- runtime adapters other than the reference CLI
- CI integration
- migration engine beyond manifest-aware stubs

## Implementation Principles

- build the narrowest slice that proves the framework works
- prefer boring filesystem primitives over abstractions
- keep validation and command behavior aligned with the written spec
- avoid hiding template logic in code when the template source already exists
- treat `.yxg/` artifacts as the public API of the system

## Recommended Technical Shape

### Language

Use Node.js for the reference CLI.

### Directory Suggestion

```text
src/
  cli/
  commands/
  templates/
  validation/
  fs/
  artifacts/
  output/
```

This is a suggestion, not yet a locked module boundary.

## Work Units

### WU-001 | CLI Foundation

#### Objective

Create the command runner, argument dispatch, consistent output contract, and shared path resolution.

#### Depends On

- none

#### Deliverables

- CLI entrypoint
- command dispatcher
- shared structured result type
- repository root and `.yxg/` path helpers

#### Why First

All later commands need the same execution shell and result format.

### WU-002 | Filesystem And Template Core

#### Objective

Implement atomic writes, safe directory creation, template loading from `templates/yxg/`, and placeholder substitution.

#### Depends On

- WU-001

#### Deliverables

- atomic write utility
- read/copy template utility
- placeholder-fill utility
- directory bootstrap helpers

#### Why Second

`init`, `plan`, and `review` all depend on this layer.

### WU-003 | Validator Core

#### Objective

Implement the validator engine, severity model, structured findings, and the minimum v1 rule set needed by early commands.

#### Depends On

- WU-001
- WU-002

#### Deliverables

- validator result model
- instance validation
- work validation
- state validation
- index validation
- template validation

#### Minimum Rule Set For First Pass

- core artifact presence
- frontmatter and schema shape
- manifest override safety
- state integrity
- index integrity
- work ready-state checks
- review completion checks

#### Why Third

Commands should not ship without the guardrails they depend on.

### WU-004 | `yxg init`

#### Objective

Implement initialization of the standard scaffold, instance template copy, and post-init validation.

#### Depends On

- WU-001
- WU-002
- WU-003

#### Deliverables

- `yxg init`
- default fail behavior when `.yxg/` already exists
- explicit `--reinit`
- explicit `--merge`
- bootstrap log entry

#### Success Condition

A fresh repository can be initialized into a valid `.yxg/` instance using only the CLI and the canonical templates.

### WU-005 | `yxg plan`

#### Objective

Implement work-unit creation and update from the canonical `WORK.md` template, plus `ready` gating through validation.

#### Depends On

- WU-001
- WU-002
- WU-003
- WU-004

#### Deliverables

- create a new work-unit artifact
- update an existing work-unit artifact
- enforce `ready` validation
- update `STATE.md`, `INDEX.md`, and `LOG.md`

#### Success Condition

The CLI can create a draft work unit, refine it, and refuse to mark it `ready` until the validator passes.

### WU-006 | `yxg review`

#### Objective

Implement review artifact creation, verdict handling, and `review -> done / ready / blocked` transitions.

#### Depends On

- WU-001
- WU-002
- WU-003
- WU-004
- WU-005

#### Deliverables

- review artifact creation from template
- verdict enforcement
- state transition logic
- updates to `STATE.md`, `INDEX.md`, and `LOG.md`

#### Success Condition

No work unit can reach `done` unless review passes the validator rules.

### WU-007 | `yxg resume`

#### Objective

Implement safe context restoration from `STATE`, active work, open reviews, and handoffs.

#### Depends On

- WU-001
- WU-003
- WU-004
- WU-005
- WU-006

#### Deliverables

- resume-order resolution
- warning surfacing for inconsistent state
- human-readable resume summary
- structured resume output

#### Success Condition

A user can run `yxg resume` and get a reliable next-action summary from `.yxg/` artifacts alone.

### WU-008 | `yxg validate`

#### Objective

Expose explicit validator entrypoints for instance and scoped validation.

#### Depends On

- WU-003

#### Deliverables

- `validate instance`
- `validate work <id>`
- `validate state`
- `validate index`
- `validate templates`

#### Success Condition

The validator can be run manually and produce both structured output and a human-readable summary.

## Deferred Work Units

These should not block the first usable release.

### WU-009 | `yxg import`

- baseline generation
- evidence-tagged import output
- conservative updates to `PROJECT`, `STATE`, `INDEX`, and `LOG`

### WU-010 | `yxg cleanup`

- archive completed work
- refresh index
- prune stale handoffs
- produce guardrail suggestions

### WU-011 | `yxg execute`

- thin execution support
- `active -> review` workflow support

## Recommended Delivery Order

### Wave 1

- WU-001
- WU-002

### Wave 2

- WU-003

### Wave 3

- WU-004
- WU-008

### Wave 4

- WU-005

### Wave 5

- WU-006

### Wave 6

- WU-007

### After First Usable Release

- WU-009
- WU-010
- WU-011

## Definition Of First Usable Release

The first usable release is reached when:

- `yxg init` creates a valid `.yxg/` instance
- `yxg validate` can validate instance and work scopes
- `yxg plan` can create and gate work units
- `yxg review` can control work completion
- `yxg resume` can restore next-step context from durable artifacts

### Current State

The repository now includes a working reference CLI implementation for:

- `yxg init`
- `yxg validate`
- `yxg plan`
- `yxg execute`
- `yxg review`
- `yxg resume`
- `yxg import`
- `yxg cleanup`

The initial implementation now exceeds the original first-usable-release target.

## Risks

- the validator implementation may become too broad too early
- path handling and atomic writes may introduce subtle platform issues
- index and state update logic may drift if command writers duplicate logic
- the archived `docs/legacy-ai/` exploratory material may confuse implementation work if treated as active source

## Risk Controls

- implement only the validator rule subset needed by shipped commands
- centralize write and path operations early
- centralize updates to `STATE`, `INDEX`, and `LOG`
- treat only the explicit spec set as normative

## Immediate Next Actions

1. Turn this plan into one or more concrete work artifacts.
2. Decide and create the actual source-code layout for the CLI.
3. Start with WU-001 and WU-002 before writing any command-specific behavior.
