# Workflow Commands

## Status

- Spec status: draft
- Kernel version: v1

## Command Model

These are semantic commands, not a fixed CLI syntax. Different runtimes may expose them through different transports, but compliant adapters should preserve the same preconditions, outputs, and state transitions.

Validation behavior for these commands is defined in `docs/VALIDATOR-SPEC.md`.
Implementation behavior for the reference v1 CLI is defined in `docs/TOOLING-CONTRACT.md`.

## Core Commands

- `init`
- `import`
- `plan`
- `cancel-work`
- `execute`
- `review`
- `resume`
- `cleanup`

## init

### Purpose

Create a new `.yxg/` kernel instance in a repository.

`init` is the intended entry point for greenfield work, not the default onboarding path for an existing repository.

### Preconditions

- target repository exists
- `.yxg/` is absent or the caller explicitly requests reinitialization behavior

### Inputs

- repository path
- optional instance name
- optional initial project summary

### Outputs

- creates the standard default scaffold defined in `docs/SCAFFOLD-SPEC.md`
- records a framework bootstrap entry in `LOG.md`

### State Changes

- initializes `MANIFEST.md`
- initializes `PROJECT.md`
- initializes `STATE.md`
- initializes `INDEX.md`
- initializes `LOG.md`
- initializes `.yxg/work/active/`
- initializes `.yxg/work/archive/`
- initializes `.yxg/reviews/`
- initializes `.yxg/handoffs/`
- initializes `.yxg/templates/`

### Failure Conditions

- existing `.yxg/` without explicit merge or reinit mode
- insufficient filesystem permissions
- partial writes without rollback support

## import

### Purpose

Map an existing codebase into the kernel so future work starts from repository reality instead of empty assumptions.

`import` is the intended onboarding path for an existing repository.

### Preconditions

- target repository contains code or relevant project artifacts

### Inputs

- import target path
- optional focus areas such as architecture, conventions, or risks

### Outputs

- bootstraps the minimal `.yxg/` kernel instance if needed
- updates `PROJECT.md` and `INDEX.md` when strong signals are found
- creates or updates:
  - `.yxg/baseline/STACK.md`
  - `.yxg/baseline/ARCHITECTURE.md`
  - `.yxg/baseline/CONVENTIONS.md`
  - `.yxg/baseline/RISKS.md`
  - `.yxg/baseline/IMPORT-SUMMARY.md`
- writes an import summary to `LOG.md`
- updates `STATE.md` with the next safe action after import
- establishes onboarding-grade runtime, dependency, configuration, verification, and risk context for later planning
- materializes `PROJECT.md` and `MANIFEST.md` with repository-specific context instead of leaving template guidance in place

### State Changes

- no work unit is created automatically unless the adapter is explicitly asked to do so
- baseline knowledge becomes durable project context
- the repository becomes ready for subsequent `plan` flows without a separate user-facing `init` step

### Evidence Sources

`import` may use:

- source tree structure
- source files
- package manifests and lockfiles
- build and test configuration
- CI workflow files
- `README*`
- `docs/`
- root or nested `AGENTS.md`
- issue and pull request templates

`import` should distinguish clearly between:

- evidence grounded in code or config
- evidence grounded in repository documentation
- low-confidence inference made by the adapter

Each baseline conclusion should carry one explicit evidence tag:

- `[code-backed]`
- `[doc-backed]`
- `[inferred-low-confidence]`

### Failure Conditions

- repository is too empty to infer useful baseline
- imported evidence is contradictory and needs human clarification
- adapter cannot determine safe file ownership or language conventions

## plan

### Purpose

Turn an objective into a bounded work-unit contract.

### Preconditions

- `.yxg/PROJECT.md` exists
- `.yxg/STATE.md` exists
- the objective is specific enough to define verification

### Inputs

- work objective
- optional constraints
- optional references to roadmap, thread, or baseline artifacts

### Outputs

- creates or updates a work-unit file under `.yxg/work/active/`
- sets work-unit status to `draft` or `ready`
- updates `STATE.md` to reference the active planning target
- appends a planning entry to `LOG.md`

### Required Planning Checks

Before a work unit may reach `ready`, planning must define:

- objective
- in-scope boundary
- out-of-scope boundary
- expected touch points
- assumptions
- risks
- verification strategy
- done condition
- escalation triggers

### Failure Conditions

- work remains too vague for a bounded contract
- verification cannot be stated
- scope is obviously too large and must be split

### Natural-Language Intake

Adapters may expose `plan` as a natural-language intake surface.
In that mode:

- the user supplies task text, not a machine work ID
- the adapter calls `yxg plan --task="<task text>"`
- the adapter reads the resulting draft work artifact
- if key scope or verification decisions are still ambiguous, the adapter asks focused clarification questions before moving the work toward `ready`

## cancel-work

### Purpose

Safely remove a mistaken draft work unit without leaving stale operational references behind.

### Preconditions

- `.yxg/` exists
- target work unit exists under `.yxg/work/active/`
- target work unit status is `draft`

### Inputs

- target work-unit ID

### Outputs

- removes the target draft work artifact
- refreshes `STATE.md`
- refreshes `INDEX.md`
- appends a cancellation entry to `LOG.md`

### Failure Conditions

- target work unit does not exist
- target work unit is not in `draft`
- caller attempts to use cancellation as a substitute for review or cleanup

## execute

### Purpose

Implement one `ready`, `active`, or `monitoring` work unit.

### Preconditions

- target work unit exists
- work-unit status is `ready`, `active`, `monitoring`, or `blocked` with resolved blockers

### Inputs

- target work-unit ID
- optional execution notes

### Outputs

- updates target work unit to `active`
- performs implementation work in the repository
- updates target work unit notes and verification details as needed
- may move the target work unit to `monitoring` when implementation is complete but external observation evidence is still pending
- advances target work unit to `review` when implementation claims completion
- updates `STATE.md` and `LOG.md`

### Execution Rules

- execution should not silently widen scope
- material plan changes require updating the work-unit contract first
- durable discoveries should be written into repo artifacts, not left only in chat
- fresh context execution is recommended for large or noisy tasks

### Monitoring Behavior

Use `monitoring` when a work unit has shipped or started a long-running process, but cannot honestly enter review until external evidence arrives. Examples include scheduled collectors, soak tests, production observation windows, partner approval, or data backfills that need time to complete.

While a work unit is `monitoring`, it remains open under `.yxg/work/active/`, but it should not monopolize the default execution recommendation when another `ready` or `active` work exists. Move it to `review` only after the evidence required by `Verification` and `Done When` has been recorded.

### Failure Conditions

- work cannot proceed safely without replanning
- blockers make continuation unsafe
- actual touch points exceed the planned boundary substantially

### Blocked Behavior

When blocked, the adapter should:

- set work-unit status to `blocked`
- record the blocker explicitly
- update `STATE.md` with the next safe action

## review

### Purpose

Evaluate whether execution satisfied the work-unit contract and whether it introduced drift or regressions.

### Preconditions

- target work unit exists
- work-unit status is `review`

### Inputs

- target work-unit ID
- optional changed-file scope

### Outputs

- creates a review artifact in `.yxg/reviews/`
- sets verdict to `pass`, `revise`, or `escalate`
- transitions work-unit status:
  - `review -> done` on `pass`
  - `review -> ready` on bounded revision
  - `review -> blocked` on external escalation
- updates `STATE.md`, `INDEX.md`, and `LOG.md`
- records a concrete change set, actual verification results, and follow-up actions in the review artifact

### Required Review Lenses

- contract review: did the work satisfy the stated objective and done condition?
- drift review: did the work introduce architectural drift, duplication, or avoidable mess?

### Review Policy

All work units require review before completion in v1. Adapters must reject direct completion paths that bypass review.

### Failure Conditions

- verification evidence is missing
- the execution cannot be mapped back to the work contract
- serious regressions or ambiguity require escalation

## resume

### Purpose

Restore safe working context after a reset, interruption, or handoff.

### Preconditions

- `.yxg/STATE.md` exists
- at least one of: active work unit, open handoff, or open thread

### Inputs

- optional target work-unit ID
- optional target handoff ID

### Outputs

- identifies the relevant current artifacts
- updates `STATE.md` if the current focus changes
- does not create implementation changes by itself

### Resume Order

Adapters should prefer this order:

1. explicit handoff
2. active work unit
3. current state next safe action
4. roadmap planned next work when no active work exists
5. latest unresolved review
6. latest active thread

When multiple active work-unit files exist, `resume` may return a recommended current work. It should only use the state narrative as a direct recommendation when the narrative clearly describes ongoing execution of one actionable work unit. A planning-only state such as `planning work WU-007` plus `proceed to execution if validation passes` records the latest planned card; it must not override the execution order for a batch of ready cards. A monitoring state such as `monitoring work WU-013` records an open evidence gate; it must not override a separate `ready` or `active` follow-up such as WU-014. In those cases, recommend the earliest unblocked actionable work by work ID order.

When no active work-unit files exist, `resume` may read `.yxg/ROADMAP.md` and return a structured planned next work from the first `WU-xxx` item in `Now`, then `Next`. This is a hint for intent-level adapters such as `yxg-do`; it must not create work artifacts by itself, and it must not replace contract completion or ready validation.

### Failure Conditions

- no coherent active context exists
- artifacts disagree materially and require human arbitration

## cleanup

### Purpose

Reduce long-term drift in the framework instance and the codebase workflow around it.

### Preconditions

- `.yxg/` exists

### Inputs

- optional scope such as docs, work archive, reviews, or guardrails

### Outputs

- archives completed work units when appropriate
- prunes stale handoffs
- refreshes `INDEX.md`
- refreshes baseline artifacts when completed work materially improves project understanding
- records cleanup actions in `LOG.md`
- may propose guardrail patches or guardrail recommendations derived from repeated review findings
- rewrites `STATE.md` so the last safe checkpoint reflects the post-cleanup repository state rather than stale execution guidance

### Cleanup Targets

- stale or duplicate docs
- outdated index entries
- obsolete handoffs
- recurring review findings that should become lint, test, or CI checks

### Cleanup Safety Boundary

`cleanup` may automatically perform safe organizational maintenance, but must not directly apply project-code changes or enforce new guardrails without explicit human approval.

### Failure Conditions

- cleanup would discard still-active context
- archival targets are ambiguous
- proposed guardrails need human approval because they change engineering policy
