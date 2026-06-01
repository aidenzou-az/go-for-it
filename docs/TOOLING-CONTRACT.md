# Tooling Contract

## Status

- Spec status: draft
- Kernel version: v1

## Purpose

Define the minimum implementation contract for the v1 `.yxg/` tooling layer.

This contract turns the semantic workflow into a concrete CLI-oriented implementation target without binding the framework to any specific runtime adapter beyond the CLI itself.

## CLI Shape

The reference v1 implementation is modeled as a CLI with these semantic commands:

```text
yxg init
yxg import
yxg plan
yxg cancel-work
yxg execute
yxg review
yxg resume
yxg cleanup
yxg validate
```

Adapters may later wrap these behaviors, but this CLI contract is the primary v1 implementation target.

## Core Principles

- use canonical templates as the source of artifact structure
- write files atomically
- run relevant validation automatically inside commands
- fail safely on ambiguous destructive behavior
- keep command output understandable to a human and usable by tooling

## Canonical Template Source

Tooling must treat:

```text
templates/yxg/
```

as the canonical source for v1 template content.

When an instance is initialized, templates may be copied into:

```text
.yxg/templates/
```

## File Write Strategy

All tooling writes to framework artifacts must use atomic write semantics.

### Atomic Write Rule

The minimum compliant write sequence is:

1. render new content
2. write to a temporary file in the same filesystem
3. replace the target atomically
4. preserve the original file if replacement fails

This rule applies especially to:

- `MANIFEST.md`
- `STATE.md`
- `INDEX.md`
- `LOG.md`
- work-unit artifacts
- review artifacts
- handoff artifacts

## Template Instantiation

The v1 tooling should instantiate artifacts by copying canonical templates and filling placeholders, rather than by embedding template bodies in source code.

### Placeholder Handling

The implementation may replace placeholders such as:

- `YYYY-MM-DD`
- `TODO`
- `unknown`
- `none`

but must preserve the overall template structure and required sections.

### Instance Templates

`init` should copy the canonical template set into `.yxg/templates/` so project instances remain usable without the CLI.

## Validation Integration

The CLI must run validation automatically in addition to exposing an explicit `validate` command.

### Required Automatic Validation

- `yxg init` -> `validate instance`
- `yxg plan` -> `validate work <id>` before allowing `ready`
- `yxg review` -> validate review artifact and target completion rules
- `yxg import` -> `validate import`
- `yxg cleanup` -> `validate instance` after cleanup actions

### Resume Validation

`yxg resume` should not fail hard merely because of warnings, but it must surface validation warnings when active context is inconsistent.

## Command Contract

### `yxg init`

Creates the standard default scaffold from `docs/SCAFFOLD-SPEC.md`.

`init` is the greenfield entry point. It is meant for repositories that are starting with `yxg` from the beginning rather than onboarding an already-established codebase.

#### Default Behavior

- fail if `.yxg/` already exists
- detect git availability when useful, but do not create a git repository automatically

#### Explicit Modes

- `--reinit`
- `--merge`

#### `--reinit`

Rebuild the scaffold and templates while preserving existing project artifacts unless explicitly told to overwrite them.

This mode is for restoring framework structure, not for deleting project knowledge.

#### `--merge`

Create only missing scaffold artifacts and directories without modifying existing artifacts.

This mode is for incomplete or partially initialized instances.

### `yxg import`

Onboards an existing repository into `yxg`.

The implementation should:

- bootstrap the minimal `.yxg/` instance if one does not already exist
- use the allowed import evidence sources
- write evidence-tagged baseline conclusions
- avoid inventing roadmap or work units automatically
- update `PROJECT.md`, `STATE.md`, `INDEX.md`, and `LOG.md` as part of onboarding
- materialize `PROJECT.md` and `MANIFEST.md` into repository-specific artifacts rather than leaving template prose in place
- produce onboarding-grade understanding of runtime entry points, execution-path candidates, module boundaries, configuration surface, external services, dependency degradation clues, verification paths, and major data-flow clues
- detect git availability when useful, but do not create a git repository automatically

### `yxg plan`

Creates or updates a work-unit artifact.

The implementation should:

- instantiate from the canonical `WORK.md` template
- refuse to mark work as `ready` unless the validator passes the ready-state checks
- update `STATE.md`, `INDEX.md`, and `LOG.md`
- surface git adapter hints when git is available, including suggested branch name and commit trailer

For natural-language intake, adapters should prefer:

```text
yxg plan --task="<task text>" --json
```

The CLI, not the user, is responsible for generating the stable work ID, slug, and title in this mode.

### `yxg cancel-work`

Safely removes a mistaken draft work unit.

The implementation should:

- require a stable work ID such as `WU-001`
- refuse to cancel work that is not in `draft`
- remove the active work artifact
- refresh `STATE.md`, `INDEX.md`, and `LOG.md`
- validate the instance after cancellation

This command exists to recover from bad task intake without requiring manual edits to `.yxg/`.

### `yxg execute`

Implements a `ready`, already `active`, or `monitoring` work unit.

The implementation may remain thin in v1, but if present it should:

- move work to `active`
- move work to `monitoring` when implementation is complete but external observation evidence is still pending
- preserve plan scope boundaries
- advance work to `review` rather than directly to `done`
- update `STATE.md` and `LOG.md`

### `yxg review`

Creates or updates a review artifact and controls completion.

The implementation should:

- instantiate from the canonical `REVIEW.md` template
- require a verdict of `pass`, `revise`, or `escalate`
- only allow `done` when the validator confirms review-completion rules
- update `STATE.md`, `INDEX.md`, and `LOG.md`
- report dirty-worktree risk when git is available, especially unrelated changes outside the active work scope
- write a concrete change set and non-placeholder verification results into the review artifact

### `yxg resume`

Restores the current working context from durable artifacts.

The implementation should use the resume order defined in `docs/WORKFLOW-COMMANDS.md`, surface warnings when context is inconsistent, and include git context when available.

### `yxg cleanup`

Performs safe maintenance actions.

The implementation may:

- archive completed work
- refresh `INDEX.md`
- refresh baseline artifacts when recently completed work produced reusable project knowledge
- prune stale handoffs
- append cleanup entries to `LOG.md`
- generate guardrail suggestions or patches
- summarize git worktree state when git is available so finish flows can detect leftover unrelated changes

The implementation must not:

- silently rewrite project source code
- silently enforce new guardrails
- discard active operational context

### `yxg validate`

Runs the validator explicitly in instance or scoped mode as defined by `docs/VALIDATOR-SPEC.md`.

## Output Contract

Commands should produce:

- a concise human-readable result summary
- structured status data that tooling can consume

When git is available, commands may additionally include structured git context in `data.git`, including:

- current branch
- clean vs dirty status
- related, kernel, and unrelated changed paths
- suggested branch name for an active work unit
- suggested commit trailer
- whether the current branch matches the suggested branch for the recommended work
- a branch mismatch reason when the current branch does not match the suggested branch

Git context is advisory. The CLI must not implicitly run git write operations such as repository initialization, branch switching, worktree creation, staging, or committing as a side effect of ordinary yxg commands.

### Minimum Structured Fields

```text
ok
status
command
scope
timestamp
artifacts_changed
artifacts_changed_count
validation
message
details
next_steps
```

### Validation Field

The `validation` field should include at least:

- `ok`
- `errors`
- `warnings`
- `infos`
- `findings_count`

and may inline structured findings or provide a reference to them.

## Failure Contract

### Hard Failure

Commands must return a hard failure when:

- required preconditions are not met
- atomic write fails
- validation returns an `error` for a blocking scope
- reinitialization mode is ambiguous

### Warning Continuation

Commands may continue when validation returns only warnings, but they must print or return a warning summary.

## Non-Goals

The v1 tooling contract does not require:

- background daemons
- databases
- multi-agent orchestration
- code generation outside the framework artifacts
- automatic source-code guardrail enforcement
