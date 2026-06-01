# Operating Model

> Legacy exploratory draft. This file is not normative for v1.
> The historical `.ai/` snapshot has been archived under `docs/legacy-ai/`.
> The current kernel specs are:
> - `docs/FRAMEWORK-SPEC.md`
> - `docs/ARTIFACT-SCHEMAS.md`
> - `docs/WORKFLOW-COMMANDS.md`
> - `docs/SCAFFOLD-SPEC.md`

## Roles

### Architect

Owns intent, boundaries, and acceptance criteria. Writes or refines project-level documents when direction changes.

### Planner

Translates a goal into a bounded unit of work with explicit verification and completion criteria.

### Executor

Implements one bounded unit at a time. Should not silently expand scope.

### Evaluator

Checks the result against the contract, not against optimism. Looks for regressions, edge cases, and mismatch between promise and behavior.

### Curator

Maintains the knowledge base: indexes, logs, decisions, stale docs, and recurring cleanup.

## Work Unit Contract

Every substantial task should answer:

- What is being changed?
- What is out of scope?
- Which files or surfaces are expected to move?
- How will success be checked?
- What should trigger escalation or replanning?

## Execution Rhythm

### Before Work

- Read `.ai/PROJECT.md`, `.ai/ROADMAP.md`, and `.ai/STATE.md`.
- Read the minimal additional context required for the current task.
- Write or update a plan in `.ai/plans/active/`.

### During Work

- Keep implementation tied to the written plan.
- If the task shape changes materially, update the plan before continuing.
- Record important discoveries in the plan or thread, not only in chat.

### After Work

- Run the planned verification steps.
- Write an evaluation artifact.
- Update `.ai/STATE.md`.
- Append a dated entry to `.ai/LOG.md`.
- Move finished plans to `.ai/plans/completed/`.

## Reset And Resume Rules

Reset or hand off when:

- the context is getting noisy
- the task has crossed multiple subproblems
- the agent is starting to summarize instead of act
- the next session needs a clean starting point

The handoff should include:

- current objective
- finished work
- exact next actions
- blockers and open questions
- commands or checks to rerun
- relevant files and artifacts

## Review Strategy

Use at least two review modes:

- contract review: did the work satisfy the written plan?
- codebase review: did the work introduce drift, duplication, or boundary violations?

For UI-heavy or workflow-heavy changes, include behavior-level evaluation, not just static review.

## Knowledge Compaction

Useful outputs should be written back as durable artifacts:

- decisions
- comparisons
- failure analyses
- runbooks
- verification notes

Chat should produce artifacts. Artifacts should shape future chat.
