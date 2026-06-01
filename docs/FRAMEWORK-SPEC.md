# Framework Spec

## Status

- Spec status: draft
- Kernel version: v1

## Purpose

Define a reusable, repo-local framework kernel for long-running AI-assisted software development.

The kernel is not a project plan. It is the operating contract that every project instance uses.

## Core Goals

1. Keep durable project knowledge inside the repository.
2. Make work resumable without depending on chat history.
3. Force non-trivial work through explicit work-unit contracts.
4. Separate planning, execution, review, and curation.
5. Turn recurring failure modes into mechanical guardrails over time.

## Non-Goals

This kernel does not require:

- milestone or phase workflows
- multi-agent orchestration
- a specific runtime such as Codex or Claude Code
- a specific CLI binary or command transport
- a database or external service for state storage

## Design Principles

### Repo-Local State

The repository is the source of truth for durable intent, state, work contracts, reviews, and accumulated knowledge.

In v1, this does not mean every `.yxg/` artifact must be committed. The kernel distinguishes between shared durable artifacts and local runtime artifacts so the repository can keep durable knowledge without turning high-churn operational views into version-control noise.

### Generic Work-Unit Core

The kernel centers on generic work units rather than milestone or phase objects. Higher-level workflows may layer milestone, phase, sprint, or epic concepts on top of work units, but the kernel does not depend on them.

### Human-Readable, Machine-Checkable Artifacts

All kernel artifacts are Markdown files with YAML frontmatter. Humans should be able to inspect and edit them directly. Tools should be able to validate and migrate them reliably.

### Short Entry, Deep References

Top-level entry files such as `AGENTS.md` should route agents to durable artifacts. They should not attempt to carry the full framework.

### Fresh Context Is A Normal Operation

The kernel assumes context resets are healthy. Handoffs and state artifacts must support clean resumes.

### Mechanical Guardrails Over Narrative Guardrails

The kernel prefers tests, lint rules, scripts, and CI checks over prose-only constraints whenever a failure pattern recurs.

## Kernel Root

Every project instance stores framework state in:

```text
.yxg/
```

`.yxg/` is the reserved kernel root for project-local framework artifacts.

## Version Control Model

The kernel must remain usable without git or GitHub, but v1 assumes most real projects will use git.

### Shared Durable Artifacts

These artifacts normally belong in git because they carry durable project knowledge:

- `.yxg/MANIFEST.md`
- `.yxg/PROJECT.md`
- `.yxg/ROADMAP.md` when present
- `.yxg/work/`
- `.yxg/reviews/`
- `.yxg/handoffs/`
- `.yxg/threads/`
- `.yxg/baseline/`

### Local Runtime Artifacts

These artifacts are high-churn operational views or regenerated helpers and should normally stay local:

- `.yxg/STATE.md`
- `.yxg/INDEX.md`
- `.yxg/LOG.md`
- `.yxg/logs/`
- `.yxg/templates/`

`STATE`, `INDEX`, and `LOG` still matter to daily operation. They are local in git terms, not optional in runtime terms.

### Adapter Layers

Git integration belongs in an adapter layer. GitHub integration belongs in a further adapter layer on top of git.

Git adapters may observe repository state and suggest safer branch, diff, or commit conventions. They must not make git mandatory and must not implicitly perform git write operations such as initializing a repository, switching branches, creating worktrees, or committing files.

The kernel may define the semantic objects that adapters refer to, but it must not hard-code:

- branch requirements
- commit requirements
- pull-request requirements
- issue tracker requirements

## Required Kernel Artifacts

- `.yxg/MANIFEST.md`
- `.yxg/PROJECT.md`
- `.yxg/STATE.md`
- `.yxg/INDEX.md`
- `.yxg/LOG.md`
- `.yxg/work/active/`

## Optional Kernel Artifacts

- `.yxg/ROADMAP.md`
- `.yxg/work/archive/`
- `.yxg/reviews/`
- `.yxg/handoffs/`
- `.yxg/threads/`
- `.yxg/baseline/`
- `.yxg/templates/`

Optional artifacts may be absent until a project needs them.

`init` may create a larger default scaffold than the minimum required kernel set. That scaffold is defined separately in `docs/SCAFFOLD-SPEC.md`.

## Core Object Model

### Manifest

Framework control object for kernel versioning, migrations, and instance metadata.

Manifest may carry strategy-level local overrides, but these overrides must not alter:

- the canonical work-unit lifecycle
- core artifact types
- core artifact semantics
- core command semantics

### Project

Defines project intent, constraints, principles, and success criteria.

### State

Defines the current operational position of the project and the next safe action.

`State` is intentionally operational in v1. It should answer "where are we now, what is active, what is risky, and what is the next safe move" rather than acting as a project dashboard.

### Index

Defines the navigation map for durable knowledge artifacts.

In v1, `Index` is a mixed navigation artifact. It should include both durable reference artifacts and currently active operational artifacts.

### Log

Defines an append-only record of meaningful planning, execution, review, migration, and cleanup events.

In v1, the human-facing `LOG.md` stores only important events. Tooling may maintain a separate machine-oriented log without changing the role of `LOG.md`.

### Work Unit

Defines one bounded unit of work with explicit scope, expected touch points, verification, and escalation conditions.

### Review

Defines a post-execution evaluation of a work unit or change set.

### Handoff

Defines the minimum durable context needed to resume safely after a context reset or session boundary.

### Roadmap

Optional sequencing layer for projects that need an explicit order of outcomes. The kernel allows it but does not require it.

### Baseline

Optional imported understanding of an existing codebase, such as architecture, conventions, and risk snapshots.

In v1, an onboarding-grade import baseline is expected to produce:

- stack summary
- architecture summary
- conventions summary
- risks summary
- import summary with evidence confidence notes

## Work-Unit Lifecycle

The kernel defines the following canonical work-unit states:

```text
draft -> ready -> active -> monitoring -> review -> done
```

### State Meanings

- `draft`: being shaped; not ready to execute
- `ready`: contract is sufficiently clear to begin execution
- `active`: implementation is in progress
- `monitoring`: implementation is deployed or otherwise complete enough to wait for external observation, soak time, scheduled collection, or acceptance evidence before review
- `blocked`: execution cannot continue without external resolution or replanning
- `review`: implementation claims completion and is awaiting evaluation
- `done`: review passed and state artifacts were updated

### Transition Rules

- `draft -> ready`: allowed when scope, touch points, verification, and done condition are explicit
- `ready -> active`: allowed when the work unit becomes the current execution target
- `active -> blocked`: allowed when a blocker or unresolved ambiguity prevents safe continuation
- `active -> monitoring`: allowed when implementation is complete but the done condition requires external evidence over time
- `active -> review`: allowed when planned implementation work is complete
- `monitoring -> review`: allowed when the required observation or acceptance evidence has been collected
- `blocked -> ready`: allowed when blockers are resolved and the contract remains valid
- `blocked -> draft`: allowed when the work must be reshaped materially
- `review -> done`: allowed when review passes and follow-up actions are captured
- `review -> ready`: allowed when review requires bounded revisions
- `review -> blocked`: allowed when review exposes an external blocker

Direct transitions that skip intermediate states should be treated as invalid by compliant tooling.

## Canonical Operating Loop

1. Read `MANIFEST`, `PROJECT`, and `STATE`.
2. Read only the minimum additional artifacts required for the current task.
3. Create or refine a work-unit artifact.
4. Execute against the work-unit contract.
5. Produce a review artifact.
6. Update `STATE`, `INDEX`, and `LOG`.
7. Create a handoff if context will reset before the next action is obvious.
8. Periodically run cleanup and guardrail-hardening.

All work units must pass through `review` before reaching `done`.

## Adapter Model

The kernel is runtime-agnostic.

Runtimes may expose the kernel through:

- CLI commands
- slash commands
- skills
- editor integrations
- CI jobs

Adapters may translate runtime-specific behavior into the kernel artifact model, but they must not change the core semantics of the artifacts or work-unit lifecycle.

This includes:

- runtime adapters such as CLI, slash commands, and skills
- git adapters that map work units to branches or commits
- GitHub adapters that map work units and reviews to issues, pull requests, or CI state

## Local Overrides

`local_overrides` are limited to strategy-level behavior flags in v1.

Allowed override areas include:

- whether roadmap usage is enabled
- whether handoffs are enabled
- cleanup behavior preference
- import behavior preference
- whether baseline artifacts are enabled
- index refresh behavior

`local_overrides` must not redefine schema structure, required lifecycle states, or transition rules.

## Versioning And Migration

### Kernel Version

Every project instance records the kernel version in `.yxg/MANIFEST.md`.

### Schema Version

Each artifact type also records its own schema version in frontmatter.

### Migration Rule

Kernel upgrades must prefer additive migration when possible. Breaking changes require an explicit migration record in the manifest and a log entry in `LOG.md`.

## Recommended Companion Files

The kernel does not require files outside `.yxg/`, but strongly recommends a short root-level `AGENTS.md` that:

- points agents to `.yxg/INDEX.md`
- states the minimum read order
- reminds agents to write `review` and `handoff` artifacts at the appropriate times
