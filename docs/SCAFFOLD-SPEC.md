# Scaffold Spec

## Status

- Spec status: draft
- Kernel version: v1

## Purpose

Define the standard default `.yxg/` scaffold produced by `init`.

This document specifies the default instance layout for v1. It does not require every artifact to be populated immediately, but it defines which files and directories exist after initialization.

## Standard Default Scaffold

`init` should create the following by default:

```text
.yxg/
  MANIFEST.md
  PROJECT.md
  STATE.md
  INDEX.md
  LOG.md
  work/
    active/
    archive/
  reviews/
  handoffs/
  templates/
```

The default scaffold includes both shared durable artifacts and local runtime artifacts. Git persistence policy is defined separately in `docs/GIT-INTEGRATION-SPEC.md`.

## Not Created By Default

The following remain optional and should not be created by default in v1 unless explicitly requested or needed by later commands:

```text
.yxg/ROADMAP.md
.yxg/threads/
.yxg/baseline/
.yxg/logs/
```

### Notes

- `.yxg/ROADMAP.md` is optional because the kernel is work-unit centric
- `.yxg/threads/` is optional until cross-session knowledge outside active work is needed
- `.yxg/baseline/` is created by `import` when enough source material exists
- `.yxg/logs/` is reserved for machine-oriented logs maintained by tooling

## Root AGENTS.md Contract

The repository root should contain a short `AGENTS.md` that does the following:

1. Points agents to `.yxg/INDEX.md`
2. Defines the minimum read order
3. States that durable decisions belong in `.yxg/`, not in chat
4. States that work must be reviewed before completion
5. States that handoffs should be written before context reset or session end when the next step is not obvious

### Root AGENTS.md Anti-Goal

Root `AGENTS.md` should not become a second framework manual. It should remain a compact entry point.

## Minimum Read Order

Root `AGENTS.md` should instruct agents to read in this order:

1. `.yxg/INDEX.md`
2. `.yxg/PROJECT.md`
3. `.yxg/STATE.md`
4. referenced active work artifacts
5. referenced reviews, handoffs, roadmap, or baseline artifacts as needed

## Templates Directory

`.yxg/templates/` is created by default so the framework remains usable even without dedicated tooling.

### Reserved v1 Template Paths

```text
.yxg/templates/MANIFEST.md
.yxg/templates/PROJECT.md
.yxg/templates/STATE.md
.yxg/templates/INDEX.md
.yxg/templates/LOG.md
.yxg/templates/WORK.md
.yxg/templates/REVIEW.md
.yxg/templates/HANDOFF.md
.yxg/templates/ROADMAP.md
.yxg/templates/STACK.md
.yxg/templates/ARCHITECTURE.md
.yxg/templates/CONVENTIONS.md
.yxg/templates/RISKS.md
.yxg/templates/IMPORT-SUMMARY.md
```

This document reserves the paths. Template content is defined separately.

The template rules and canonical source files are defined in:

- `docs/TEMPLATE-SPEC.md`
- `templates/yxg/`

## Machine Log Location

If tooling chooses to maintain a machine-oriented log, the reserved v1 path is:

```text
.yxg/logs/MACHINE.ndjson
```

This file is auxiliary. It must not replace the human-facing `LOG.md`.

## Git Ignore Expectation

Projects using git should normally ignore local runtime artifacts created by the scaffold:

- `.yxg/STATE.md`
- `.yxg/INDEX.md`
- `.yxg/LOG.md`
- `.yxg/logs/`
- `.yxg/templates/`

Shared durable artifacts should remain available for commit.
