# Import Enhancement Roadmap

## Status

- Spec status: active roadmap
- Scope: existing-project onboarding through `yxg import`
- Current implementation baseline: import can bootstrap a minimal `.yxg/` instance and generate onboarding-grade baseline artifacts from repository evidence

## Purpose

Define what `import` must become so an existing repository can be adopted into `yxg` with enough understanding to support later planning and implementation without blind repo rescans.

`init` is for greenfield repositories.
`import` is for existing repositories.

## Desired Outcome

After `yxg import`, a capable adapter should be able to:

- explain what the project does and where it starts
- identify primary runtime entry points and major execution paths
- describe the most important module boundaries and shared core surfaces
- surface configuration, environment, cache, and external service dependencies
- identify the practical verification surface and major risks
- create a credible next work plan without re-onboarding the whole repository from scratch

This is not full omniscience. It is onboarding-grade project understanding that is strong enough to support real feature planning.

## Current State

The current implementation already does the following:

- bootstraps a minimal `.yxg/` instance when importing an existing repository that does not already contain `.yxg/`
- reads source files, repository docs, manifests, workflows, and configuration clues
- extracts runtime entrypoint candidates
- extracts a local import graph from relative imports
- extracts environment-variable references and env/config files
- extracts external-service hints and cache/config-sensitive modules
- writes durable baseline artifacts:
  - `STACK.md`
  - `ARCHITECTURE.md`
  - `CONVENTIONS.md`
  - `RISKS.md`
  - `IMPORT-SUMMARY.md`

This is materially stronger than simple repo census, but it is still short of ideal onboarding depth.

## Remaining Gaps

### 1. Runtime Flow Understanding

`import` can identify likely entry files and import edges, but it still treats many runtime paths as clues rather than dependable execution narratives.

It should become better at:

- identifying the primary user-visible entry points
- distinguishing main execution paths from secondary helpers
- narrating request, render, worker, or CLI flow through the repository

### 2. Behavior-Level Config Understanding

`import` can detect env vars and config-sensitive files, but it does not yet explain their behavioral consequences well enough.

It should become better at:

- mapping each important env/config surface to runtime behavior
- identifying fallback behavior when config is absent
- surfacing config that changes upstream data source, cache, deploy, or auth behavior

### 3. External Dependency Mapping

`import` can detect external-service hints, but it does not yet map them into actionable dependency narratives.

It should become better at:

- identifying which external service is on the critical path
- describing how the system degrades when that dependency fails
- highlighting integration points that are likely to constrain future feature work

### 4. Verification Surface Understanding

`import` can detect tests and workflow clues, but it does not yet build a strong enough verification model for later `finish` quality.

It should become better at:

- identifying the real minimal verification path for the project
- distinguishing automated verification from manual verification
- identifying linked output surfaces that should be checked together

### 5. Planning Readiness

The most important remaining gap is that `plan` still often needs a heavy targeted repo read to compensate for import depth.

Ideal `import` should reduce that gap enough that planning mainly adds task-specific analysis rather than re-onboarding the repo.

## Enhancement Phases

### Phase 1: Onboarding-Grade Structural Understanding

Goal:

- make `import` strong enough to describe entry points, shared modules, env/config surface, and initial data-flow clues from real code

Implemented in the current branch:

- minimal `.yxg/` bootstrap during import
- entrypoint candidate extraction
- local import graph extraction
- env/config file and variable extraction
- external service hints
- cache/config-sensitive module hints
- richer baseline synthesis in `ARCHITECTURE`, `CONVENTIONS`, `RISKS`, and `IMPORT-SUMMARY`

### Phase 2: Runtime And Dependency Narrative

Goal:

- turn structural clues into stronger execution-path and dependency-path narratives

Implemented in the current branch:

- rank candidate entry points by confidence and likely user visibility
- describe high-confidence execution chains across key files
- identify upstream source-of-truth modules versus presentation-only modules
- map external dependency failure/degradation paths where code makes them visible

### Phase 3: Verification And Risk Readiness

Goal:

- make import output materially useful for later `plan`, `do`, and `finish`

Implemented in the current branch:

- infer practical verification routes from code and repo artifacts
- identify multi-surface outputs that should be validated together
- distinguish high-risk, high-coupling, and likely-scope-creep areas
- improve `IMPORT-SUMMARY` so it can function as a real onboarding brief

## Acceptance Criteria

`import` should be considered strong enough when all of the following are usually true for a medium-complexity existing repository:

1. The resulting baseline can name the main user-visible or runtime entry points with explicit evidence.
2. `ARCHITECTURE.md` can describe at least one concrete execution or render path through the codebase.
3. `CONVENTIONS.md` can name real config or environment surfaces and the files that consume them.
4. `RISKS.md` can identify concrete high-risk surfaces instead of only generic uncertainty.
5. `IMPORT-SUMMARY.md` can explain how the system is likely verified today, including gaps.
6. A subsequent `plan` can produce a credible first draft for a real feature without re-onboarding the entire repo.

## Non-Goals

`import` is not trying to:

- fully replace task-specific analysis during planning
- prove every inference at semantic-compiler precision
- automatically generate roadmap items or work units without user intent
- pretend uncertainty does not exist

## Implementation Notes

- keep evidence tagging explicit: `code-backed`, `doc-backed`, `inferred-low-confidence`
- prefer durable findings in baseline artifacts over chat-only explanations
- keep `import` as the existing-project onboarding action; do not reintroduce a required separate `init` step for that path
