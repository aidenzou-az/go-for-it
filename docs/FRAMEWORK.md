# Framework

> Legacy exploratory draft. This file is not normative for v1.
> The historical `.ai/` snapshot has been archived under `docs/legacy-ai/`.
> The current kernel specs are:
> - `docs/FRAMEWORK-SPEC.md`
> - `docs/ARTIFACT-SCHEMAS.md`
> - `docs/WORKFLOW-COMMANDS.md`
> - `docs/SCAFFOLD-SPEC.md`

## Goal

Build a repository-local development harness that lets AI agents work on a project for a long time without losing direction, silently changing scope, or accumulating unbounded architectural drift.

## Core Thesis

Long-running AI development does not stay coherent because the prompt is clever. It stays coherent because the environment is legible, the state is externalized, the work is chunked, and the output is continuously checked.

## Design Pillars

### 1. The Repository Is The Working Memory

Important knowledge must live in the repo as code, markdown, schemas, plans, reviews, and logs. If context lives only in chat, it is not durable enough.

### 2. `AGENTS.md` Is A Table Of Contents

The top-level entry file should point to the right artifacts. It should not try to carry the whole system.

### 3. Plans Are First-Class Artifacts

Every non-trivial task should have:

- a scoped plan
- explicit files or surfaces it may change
- verification steps
- a completion condition

### 4. Planning, Execution, And Evaluation Are Different Jobs

The same model can perform all three, but the roles should be separated in artifacts and prompts. This reduces self-deception and makes failure legible.

### 5. Context Resets Are A Feature

When a task grows large, switch to a fresh context and resume from a handoff artifact. Fresh context is cheaper than letting drift compound.

### 6. Mechanical Constraints Beat Narrative Constraints

If the project needs a boundary, style rule, dependency direction, migration rule, or performance budget, prefer encoding it in tests, linters, scripts, or CI.

### 7. Knowledge Should Compound

Useful answers, reviews, decisions, and postmortems should be written back into the repo so later sessions start from a better state.

### 8. Garbage Collection Must Be Ongoing

AI systems replicate whatever patterns exist. Without recurring cleanup, stale docs and weak patterns become the new baseline.

## Layers

### Layer 1: Intent

- `.ai/PROJECT.md`
- `.ai/ROADMAP.md`

These define what the project is, what matters, and what sequence of work exists.

### Layer 2: Live State

- `.ai/STATE.md`
- `.ai/LOG.md`
- `.ai/threads/`

These track current position, active questions, checkpoints, and cross-session work.

### Layer 3: Execution Control

- `.ai/plans/active/`
- `.ai/plans/completed/`
- `.ai/reviews/`

These turn abstract goals into auditable units of work.

### Layer 4: Standards

- `docs/OPERATING_MODEL.md`
- `docs/GUARDRAILS.md`

These define how work should happen and which rules should become automated.

## Canonical Loop

1. Align on intent and scope.
2. Produce a written plan.
3. Execute against that plan.
4. Evaluate against explicit criteria.
5. Update state and knowledge artifacts.
6. Reset context when needed.
7. Periodically run cleanup and rule-hardening passes.

## Success Criteria

This framework is working if:

- a new session can resume safely from repo files alone
- plans are small enough to execute without context collapse
- reviews catch drift before it spreads
- repeated bugs become guardrails
- the repo gets easier, not harder, for later agents to navigate
