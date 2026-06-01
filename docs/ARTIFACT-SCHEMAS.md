# Artifact Schemas

## Status

- Spec status: draft
- Kernel version: v1

## Schema Format

All kernel artifacts use:

- Markdown body
- YAML frontmatter
- explicit `artifact_type`
- explicit `schema_version`

## Common Frontmatter

Every kernel artifact must include:

```yaml
---
artifact_type: <type>
schema_version: "1.0"
kernel_version: "1"
id: <stable-id>
created_at: "YYYY-MM-DD"
updated_at: "YYYY-MM-DD"
---
```

### Field Rules

- `artifact_type`: required string; must match the artifact schema name
- `schema_version`: required string; version of this artifact schema
- `kernel_version`: required string; kernel version this artifact conforms to
- `id`: required stable identifier within the repository
- `created_at`: required ISO date
- `updated_at`: required ISO date

Additional fields are allowed only when defined by the artifact schema below.

## Directory Layout

```text
.yxg/
  MANIFEST.md
  PROJECT.md
  STATE.md
  INDEX.md
  LOG.md
  logs/                    # optional machine-oriented logs
  ROADMAP.md                 # optional
  work/
    active/
    archive/                # optional
  reviews/                  # optional
  handoffs/                 # optional
  threads/                  # optional
  baseline/                 # optional
  templates/                # optional
```

## Git Persistence Classes

v1 classifies artifacts into two persistence classes for git workflows.

### Shared Durable Artifacts

These artifacts should usually be committed:

- `.yxg/MANIFEST.md`
- `.yxg/PROJECT.md`
- `.yxg/ROADMAP.md` when present
- `.yxg/work/**`
- `.yxg/reviews/**`
- `.yxg/handoffs/**`
- `.yxg/threads/**`
- `.yxg/baseline/**`

### Local Runtime Artifacts

These artifacts should usually remain uncommitted and be recreated or refreshed locally:

- `.yxg/STATE.md`
- `.yxg/INDEX.md`
- `.yxg/LOG.md`
- `.yxg/logs/**`
- `.yxg/templates/**`

Tooling may rebuild local runtime artifacts from shared artifacts plus current repository state.

## MANIFEST

### Path

`.yxg/MANIFEST.md`

### Purpose

Store project-instance metadata for the framework itself.

### Required Frontmatter

```yaml
artifact_type: manifest
schema_version: "1.0"
kernel_version: "1"
id: manifest
instance_name: <repo-or-project-name>
instance_status: active
default_artifact_schema_version: "1.0"
preferred_adapter: <adapter-or-none>
adapter_version: <adapter-version-or-none>
```

### Required Sections

- `# Manifest`
- `## Kernel`
- `## Migrations`
- `## Local Overrides`

### Section Semantics

- `Kernel`: current kernel version and adapter assumptions
- `Migrations`: applied migrations in chronological order
- `Local Overrides`: any project-specific behavior that intentionally differs from the default kernel

### Manifest Rules

- `Migrations` must record `applied_migrations`, including `none` when empty
- `Local Overrides` must only use the allowed strategy-level keys below

### Allowed `local_overrides` Keys

- `roadmap_enabled`
- `handoff_enabled`
- `cleanup_mode`
- `import_mode`
- `baseline_enabled`
- `index_refresh_mode`

### Allowed Override Values

- `cleanup_mode`: `manual`, `suggest`, `auto_safe`
- `import_mode`: `deep-onboarding`
- `index_refresh_mode`: `manual`, `on_write`, `on_command`

## PROJECT

### Path

`.yxg/PROJECT.md`

### Purpose

Store durable project intent.

### Required Frontmatter

```yaml
artifact_type: project
schema_version: "1.0"
kernel_version: "1"
id: project
status: active
```

### Required Sections

- `# Project`
- `## One-Sentence Goal`
- `## Why This Project Exists`
- `## Success Criteria`
- `## Non-Negotiable Constraints`
- `## Product Principles`
- `## Engineering Principles`
- `## Out Of Scope`

## STATE

### Path

`.yxg/STATE.md`

### Purpose

Store current operational position.

### Git Class

Local runtime artifact. Do not treat `STATE.md` as a durable shared planning record in git.

### Required Frontmatter

```yaml
artifact_type: state
schema_version: "1.0"
kernel_version: "1"
id: state
current_status: active
```

### Required Sections

- `# State`
- `## Current Focus`
- `## Active Work`
- `## Last Safe Checkpoint`
- `## Open Risks`
- `## Next Safe Action`

### Field Rules

`Current Focus` should identify the current objective at project level. `Active Work` should reference current work-unit IDs when present.

`STATE.md` is not a general project dashboard in v1. It should stay tightly focused on current operations and the next safe action.

## INDEX

### Path

`.yxg/INDEX.md`

### Purpose

Store the navigation map for durable knowledge.

### Git Class

Local runtime artifact. `INDEX.md` should normally be refreshed locally rather than reviewed as durable history.

### Required Frontmatter

```yaml
artifact_type: index
schema_version: "1.0"
kernel_version: "1"
id: index
```

### Required Sections

- `# Index`
- `## Core Artifacts`
- `## Current Operations`
- `## Reference Knowledge`
- `## Archive / History`
- `## Update Rule`

### Index Rules

- `Core Artifacts` must include `MANIFEST`, `PROJECT`, `STATE`, `INDEX`, and `LOG`
- `Current Operations` must include active work units and active reviews; active threads belong here when present
- `Reference Knowledge` should include roadmap and baseline artifacts when present
- `Archive / History` should point to work archive or other historical artifacts when present

## LOG

### Path

`.yxg/LOG.md`

### Purpose

Store an append-only chronological record.

### Git Class

Local runtime artifact in v1. Durable events should still be reflected through shared artifacts such as work units, reviews, handoffs, and baseline files.

### Required Frontmatter

```yaml
artifact_type: log
schema_version: "1.0"
kernel_version: "1"
id: log
append_only: true
```

### Required Sections

- `# Log`

### Log Rules

- `LOG.md` records important events only
- tooling may maintain a separate machine-oriented log under `.yxg/logs/`
- machine-oriented logs are auxiliary and are not a substitute for the human-facing `LOG.md`

### Entry Format

Each entry should use:

```text
## [YYYY-MM-DD] <event-id> | <short summary>

- fact 1
- fact 2
- fact 3
```

## ROADMAP

### Path

`.yxg/ROADMAP.md`

### Purpose

Optional sequencing artifact for projects that need explicit ordering beyond individual work units.

### Required Frontmatter

```yaml
artifact_type: roadmap
schema_version: "1.0"
kernel_version: "1"
id: roadmap
status: active
```

### Required Sections

- `# Roadmap`
- `## Now`
- `## Next`
- `## Later`
- `## Deferred`

The kernel does not require milestones or phases inside the roadmap. Projects may layer them on top if needed.

## WORK UNIT

### Path

`.yxg/work/active/<work-id>-<slug>.md`

Archived path:

`.yxg/work/archive/<work-id>-<slug>.md`

### Purpose

Store one bounded work contract.

### Required Frontmatter

```yaml
artifact_type: work
schema_version: "1.0"
kernel_version: "1"
id: <work-id>
slug: <slug>
title: <human-title>
status: draft
priority: medium
owner_role: planner
```

### Allowed Status Values

- `draft`
- `ready`
- `active`
- `monitoring`
- `blocked`
- `review`
- `done`

### Required Sections

- `# Work Unit`
- `## Objective`
- `## In Scope`
- `## Out Of Scope`
- `## Expected Touch Points`
- `## Dependencies`
- `## Assumptions`
- `## Risks`
- `## Plan`
- `## Verification`
- `## Done When`
- `## Escalate If`
- `## Evidence Log`
- `## Notes`

### Contract Rules

A work unit may not move to `ready` unless:

- `Objective` is concrete
- `In Scope` and `Out Of Scope` are explicit
- `Expected Touch Points` is non-empty
- `Assumptions` is explicit, even if it states `none`
- `Risks` is explicit, even if it states `none`
- `Verification` is non-empty
- `Done When` is testable

A work unit may not move to `done` without a corresponding review artifact and a successful `review -> done` transition.

## REVIEW

### Path

`.yxg/reviews/<review-id>.md`

### Purpose

Store post-execution evaluation of a work unit or change set.

### Required Frontmatter

```yaml
artifact_type: review
schema_version: "1.0"
kernel_version: "1"
id: <review-id>
target_work_id: <work-id>
verdict: pass
```

### Allowed Verdict Values

- `pass`
- `revise`
- `escalate`

### Required Sections

- `# Review`
- `## Scope Under Review`
- `## Contract`
- `## Findings`
- `## Verification Results`
- `## Verdict`
- `## Follow-Up`

## HANDOFF

### Path

`.yxg/handoffs/<handoff-id>.md`

### Purpose

Store resume context across session or context boundaries.

### Required Frontmatter

```yaml
artifact_type: handoff
schema_version: "1.0"
kernel_version: "1"
id: <handoff-id>
target_work_id: <work-id>
handoff_status: active
```

### Required Sections

- `# Handoff`
- `## Current Objective`
- `## Completed So Far`
- `## Current State`
- `## Exact Next Steps`
- `## Blockers And Open Questions`
- `## Resume Context`

## THREAD

### Path

`.yxg/threads/<thread-id>.md`

### Purpose

Store cross-session knowledge that does not belong to a single work unit.

### Required Frontmatter

```yaml
artifact_type: thread
schema_version: "1.0"
kernel_version: "1"
id: <thread-id>
thread_status: active
```

### Required Sections

- `# Thread`
- `## Goal`
- `## Context`
- `## References`
- `## Current Understanding`
- `## Next Steps`

## BASELINE ARTIFACTS

### Path

Files under `.yxg/baseline/`

### Purpose

Store imported understanding of an existing codebase.

### Recommended Files

- `STACK.md`
- `ARCHITECTURE.md`
- `CONVENTIONS.md`
- `RISKS.md`
- `IMPORT-SUMMARY.md`

### File Responsibilities

- `STACK.md`: languages, frameworks, package managers, test stack, build stack, deployment clues
- `ARCHITECTURE.md`: major modules, directory structure, runtime entry points, key data flows
- `CONVENTIONS.md`: naming, testing patterns, configuration patterns, error-handling patterns
- `RISKS.md`: stale docs, weak boundaries, low-test areas, generated code, sensitive paths
- `IMPORT-SUMMARY.md`: evidence sources, conflicts, low-confidence inferences, recommended next safe action

### Evidence Tag Rules

Each import conclusion or bullet in baseline artifacts must carry exactly one evidence tag:

- `[code-backed]`
- `[doc-backed]`
- `[inferred-low-confidence]`

Section-level evidence tags are insufficient in v1.

These are optional at kernel level, but `import` should create them in v1 when enough source material exists.
