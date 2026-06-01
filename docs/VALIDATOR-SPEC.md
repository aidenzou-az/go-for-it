# Validator Spec

## Status

- Spec status: draft
- Kernel version: v1

## Purpose

Define the validation model for `.yxg/` kernel instances.

The validator exists to ensure that project instances are structurally valid, semantically coherent enough to operate safely, and aligned with the core kernel constraints.

## Validation Goals

1. Catch broken or incomplete artifact structure early.
2. Prevent invalid state transitions from being treated as complete work.
3. Distinguish blocking problems from non-blocking issues.
4. Produce output that is useful to both humans and tooling.

## Severity Levels

The validator uses three result levels:

- `error`
- `warning`
- `info`

### Severity Meaning

- `error`: blocks the relevant action or marks the validated scope as invalid
- `warning`: does not block execution by itself, but must be surfaced clearly
- `info`: non-blocking suggestion or observation

## Hard-Fail Policy

The validator must hard fail on:

- schema structure violations
- invalid enumerated values
- invalid override keys or values
- invalid work-unit lifecycle transitions
- work units that attempt to reach `ready` without satisfying the required contract conditions
- work units that attempt to reach `done` without a successful review
- imports marked complete without the required baseline artifact set

Warnings and infos never hard fail by themselves.

## Validation Modes

The validator supports both instance-wide and scoped execution.

### Instance Mode

Validate the `.yxg/` instance as a whole.

Recommended semantic name:

```text
validate instance
```

### Scoped Modes

Validate a specific operational area.

Recommended semantic names:

```text
validate work <id>
validate import
validate state
validate index
validate templates
```

Adapters may use different transport syntax, but the logical scopes should remain equivalent.

## Warning Behavior

Warnings do not block command execution, but any command that continues in the presence of warnings must present a warning summary in its output.

This applies especially to:

- `plan`
- `review`
- `import`
- `cleanup`

## Output Model

Validator output must include:

- a machine-readable result set
- a human-readable summary

### Minimum Structured Fields

Each validation finding should expose at least:

```text
ok
level
rule_id
artifact
message
suggested_fix
```

### Suggested Result Shape

```yaml
ok: true | false
scope: instance | work | import | state | index | templates
summary:
  errors: 0
  warnings: 0
  infos: 0
findings:
  - level: error
    rule_id: WORK-READY-001
    artifact: .yxg/work/active/001-example.md
    message: Verification section is empty.
    suggested_fix: Add at least one explicit verification check before moving to ready.
```

The exact transport may differ by adapter, but the logical fields must remain available.

## Rule Categories

The v1 validator rule set is grouped into the following categories:

- core artifact presence
- frontmatter and schema shape
- override safety
- state integrity
- work-unit contract completeness
- lifecycle transition validity
- review completion requirements
- import baseline completeness
- import evidence-tag correctness
- template conformity

## Rule Set

### Core Artifact Presence

#### CORE-ARTIFACT-001

- Level: `error`
- Scope: `instance`
- Condition: missing required artifact `MANIFEST.md`, `PROJECT.md`, `STATE.md`, `INDEX.md`, or `LOG.md`

#### CORE-ARTIFACT-002

- Level: `error`
- Scope: `instance`
- Condition: missing required directory `.yxg/work/active/`

### Frontmatter And Schema Shape

#### SCHEMA-001

- Level: `error`
- Scope: all artifacts
- Condition: missing required common frontmatter fields

#### SCHEMA-002

- Level: `error`
- Scope: all artifacts
- Condition: `artifact_type` does not match the target artifact schema

#### SCHEMA-003

- Level: `error`
- Scope: all artifacts
- Condition: invalid or missing artifact-specific frontmatter fields

### Override Safety

#### MANIFEST-OVERRIDE-001

- Level: `error`
- Scope: `instance`
- Condition: `local_overrides` contains a key not allowed by the kernel

#### MANIFEST-OVERRIDE-002

- Level: `error`
- Scope: `instance`
- Condition: `local_overrides` contains an invalid value for an allowed key

#### MANIFEST-001

- Level: `warning`
- Scope: `instance`
- Condition: `preferred_adapter` remains `unknown`

#### MANIFEST-002

- Level: `warning`
- Scope: `instance`
- Condition: `adapter_version` remains `unknown`

#### MANIFEST-003

- Level: `warning`
- Scope: `instance`
- Condition: template guidance remains in the `Manifest` kernel section

### State Integrity

#### STATE-001

- Level: `error`
- Scope: `state`
- Condition: missing required sections in `STATE.md`

#### STATE-002

- Level: `warning`
- Scope: `state`
- Condition: `Active Work` references missing work-unit artifacts

#### STATE-003

- Level: `warning`
- Scope: `state`
- Condition: `Next Safe Action` is empty, vague, or obviously not operational

#### STATE-004

- Level: `warning`
- Scope: `state`
- Condition: `Last Safe Checkpoint` still reads like active-task execution guidance even though `Active Work` is `none`

### Index Integrity

#### INDEX-001

- Level: `error`
- Scope: `index`
- Condition: missing required sections in `INDEX.md`

#### INDEX-002

- Level: `warning`
- Scope: `index`
- Condition: active work exists but is not listed under `Current Operations`

#### INDEX-003

- Level: `warning`
- Scope: `index`
- Condition: active reviews exist but are not listed under `Current Operations`

### Work-Unit Contract Completeness

#### WORK-STATUS-001

- Level: `error`
- Scope: `work`
- Condition: work-unit status is not one of `draft`, `ready`, `active`, `blocked`, `review`, `done`

#### WORK-READY-001

- Level: `error`
- Scope: `work`
- Condition: work-unit status is `ready` but `Objective` is missing or vague

#### WORK-READY-002

- Level: `error`
- Scope: `work`
- Condition: work-unit status is `ready` but `In Scope`, `Out Of Scope`, or `Expected Touch Points` is empty

#### WORK-READY-003

- Level: `error`
- Scope: `work`
- Condition: work-unit status is `ready` but `Assumptions` or `Risks` is missing

#### WORK-READY-004

- Level: `error`
- Scope: `work`
- Condition: work-unit status is `ready` but `Verification` or `Done When` is empty

#### WORK-READY-005

- Level: `error`
- Scope: `work`
- Condition: work-unit status is `ready` but `Escalate If` is empty

### Lifecycle Transition Validity

#### LIFECYCLE-001

- Level: `error`
- Scope: `work`
- Condition: attempted transition skips required intermediate states

#### LIFECYCLE-002

- Level: `warning`
- Scope: `work`
- Condition: status changed recently but `updated_at` was not refreshed

### Review Completion Requirements

#### REVIEW-001

- Level: `error`
- Scope: `work`
- Condition: work-unit status is `done` but no corresponding review artifact exists

#### REVIEW-002

- Level: `error`
- Scope: `work`
- Condition: work-unit status is `done` but the latest corresponding review verdict is not `pass`

#### REVIEW-003

- Level: `error` on `pass`, otherwise `warning`
- Scope: `review`
- Condition: review still uses an unknown change set placeholder

#### REVIEW-004

- Level: `error` on `pass`, otherwise `warning`
- Scope: `review`
- Condition: verification results still contain placeholder text

#### REVIEW-005

- Level: `error` on `pass`, otherwise `warning`
- Scope: `review`
- Condition: verdict reasoning still contains placeholder text

### Import Baseline Completeness

#### IMPORT-001

- Level: `error`
- Scope: `import`
- Condition: import is treated as complete but one or more required baseline files is missing

Required baseline files:

- `.yxg/baseline/STACK.md`
- `.yxg/baseline/ARCHITECTURE.md`
- `.yxg/baseline/CONVENTIONS.md`
- `.yxg/baseline/RISKS.md`
- `.yxg/baseline/IMPORT-SUMMARY.md`

#### IMPORT-002

- Level: `warning`
- Scope: `import`
- Condition: baseline exists but `PROJECT.md` or `STATE.md` was not updated to reflect the import result

### Import Evidence-Tag Correctness

#### IMPORT-TAG-001

- Level: `error`
- Scope: `import`
- Condition: a baseline conclusion lacks an evidence tag

#### IMPORT-TAG-002

- Level: `error`
- Scope: `import`
- Condition: a baseline conclusion uses an unsupported evidence tag

Allowed evidence tags:

- `[code-backed]`
- `[doc-backed]`
- `[inferred-low-confidence]`

### Template Conformity

#### TEMPLATE-001

- Level: `error`
- Scope: `templates`
- Condition: a canonical template is missing from `.yxg/templates/` when template validation is requested

#### TEMPLATE-002

- Level: `warning`
- Scope: `templates`
- Condition: template body deviates from the canonical structure while preserving core semantics

## Validation Order

The recommended validation order is:

1. core artifact presence
2. frontmatter and schema shape
3. override safety
4. state and index integrity
5. work-unit contract and lifecycle checks
6. review completion requirements
7. import baseline and evidence-tag checks
8. template conformity

This order helps fail early on structural problems before performing more semantic checks.

## Command Integration

Recommended command integrations:

- `init`: validate instance after scaffold creation
- `plan`: validate target work unit before allowing `ready`
- `review`: validate review artifact and target work completion rules
- `resume`: warn on inconsistent state or missing referenced artifacts
- `import`: validate baseline completeness and evidence tags after import
- `cleanup`: validate instance after archive or index updates

## Non-Goals

The v1 validator does not attempt to:

- judge product quality or engineering taste
- lint arbitrary project source code
- infer hidden intent from incomplete writing
- replace human review
