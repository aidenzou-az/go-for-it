# Git Integration Spec

## Status

- Spec status: draft
- Kernel version: v1

## Purpose

Define how `yxg` should coexist with git without turning git or GitHub into kernel dependencies.

This document defines:

- which `.yxg/` artifacts are shared vs local
- the supported git adapter modes
- the recommended `.gitignore` policy
- how a git adapter may map work units onto branches and commits

It does not define GitHub-specific pull-request or issue workflows as kernel requirements.

## Layering

### Kernel

The kernel owns:

- `.yxg/` artifact semantics
- work-unit lifecycle
- review, handoff, resume, cleanup semantics

The kernel must remain valid outside git-hosted environments.

### Git Adapter

The git adapter may add workflow guidance for:

- branch naming
- commit message and trailer conventions
- dirty-worktree checks
- grouping repository changes around a work unit

It must not make git a kernel precondition. It also must not automatically create, switch, or mutate git state as part of ordinary `yxg` commands.

## Git Adapter Modes

yxg supports two git adapter modes:

- `observe`: read git state and include it in command output.
- `suggest`: read git state, compare it with the current yxg work context, and return explicit recommendations or risk messages.

Both modes are non-mutating. yxg may suggest a branch name, commit trailer, or worktree-safe next action, but it must not run git write operations such as `git init`, `git checkout`, `git switch`, `git branch`, `git worktree`, `git add`, or `git commit` as an implicit side effect of `init`, `import`, `plan`, `do`, `finish`, `resume`, `review`, or `cleanup`.

If an adapter wants to perform a git write operation on behalf of the user, that action must be separate, explicit, and reviewable in the interaction. It is not part of the default yxg workflow contract.

### GitHub Adapter

GitHub integration is optional and must build on top of the git adapter rather than entering the kernel core.

Examples include:

- issue references
- pull-request templates
- CI status reporting
- PR review summaries derived from `yxg` review artifacts

## Shared Vs Local `.yxg/` Artifacts

### Shared Durable Artifacts

These should usually be committed:

- `.yxg/MANIFEST.md`
- `.yxg/PROJECT.md`
- `.yxg/ROADMAP.md` when present
- `.yxg/work/**`
- `.yxg/reviews/**`
- `.yxg/handoffs/**`
- `.yxg/threads/**`
- `.yxg/baseline/**`

These files carry durable project intent, execution history, and reusable knowledge.

### Local Runtime Artifacts

These should usually remain local:

- `.yxg/STATE.md`
- `.yxg/INDEX.md`
- `.yxg/LOG.md`
- `.yxg/logs/**`
- `.yxg/templates/**`

These files are important to operation, but they are optimized for local refresh and fast iteration rather than durable shared history.

## Recommended `.gitignore` Policy

Projects using git should normally ignore:

```text
.yxg/STATE.md
.yxg/INDEX.md
.yxg/LOG.md
.yxg/logs/
.yxg/templates/
```

If a project intentionally commits some of these files, that should be treated as a local policy override rather than the default framework recommendation.

## Branch Conventions

Branching is optional and advisory. The recommended git adapter convention is:

```text
yxg/wu-001-rain-probability
```

Rules:

- prefix with `yxg/`
- include stable work id in lowercase
- include a short slug when available

Work units must still remain the system of record. Branch names are only a convenience projection. A branch mismatch is a workflow risk to surface, not a reason for the kernel to automatically switch branches.

## Commit Conventions

The git adapter may suggest commit messages that tie code changes back to a work unit.

Recommended trailer:

```text
YXG-Work: WU-001
```

Recommended behavior:

- do not require automatic commits
- do not require one commit per work unit
- do surface unrelated dirty changes before finishing a work unit
- do not stage or commit files as an implicit yxg command side effect

## Dirty Worktree Checks

When a git adapter is present, finish flows should check for:

- unstaged changes
- untracked changes unrelated to the active work
- branch state that is inconsistent with the active work

The adapter should report these as workflow risks. It must not silently rewrite or discard unrelated changes.

## Branch Mismatch And Monitoring Handoff

When yxg recommends an actionable work unit, the git adapter should compare the current branch with that work unit's suggested branch.

Expected observe/suggest behavior:

- if the recommended work is `WU-014` and the current branch is still `yxg/wu-013-collector`, return `branch_matches_recommended_work: false`
- return a human-readable `branch_mismatch_reason` that names both the current branch and the suggested branch
- keep `suggested_branch` pointed at the actionable work, not at a monitoring work that is still waiting for evidence
- keep monitoring work open for evidence collection, but do not let it抢占 the next actionable work recommendation when a ready or active work unit exists
- report unrelated dirty changes as workflow risk; do not stage, commit, discard, or reclassify them automatically

## Init And Import Without Git

`yxg init` and `yxg import` must not create a git repository automatically.

If the target directory is not inside a git worktree, yxg should continue to operate and should report git adapter capability degradation in user-facing terms:

- branch isolation is unavailable
- dirty-worktree classification is unavailable
- suggested commit trailers may still be shown as conventions, but cannot be attached to actual commits by yxg
- GitHub or PR workflows are unavailable until the project is explicitly placed under git by the user

This rule applies even when a project appears to be a source repository. Initializing git changes project boundaries and must remain an explicit user action.

## Worktree Boundaries

Git worktrees are local runtime concerns. Shared durable artifacts such as `.yxg/work/**`, `.yxg/reviews/**`, and `.yxg/baseline/**` must not store machine-specific worktree paths as authoritative state.

If a local adapter records worktree hints, those hints belong in local runtime artifacts or external local cache, not in shared work-unit contracts.

## GitHub Integration Boundary

GitHub-specific metadata may be stored as external references, for example:

- `issue_ref`
- `pr_ref`
- `ci_ref`

But v1 must not require:

- a GitHub repository
- pull requests
- issue numbers
- GitHub Actions

## Design Implication For Tooling

Tooling should increasingly treat `STATE`, `INDEX`, and `LOG` as regenerable local views.

Tooling should treat work units, reviews, handoffs, and baseline files as the durable shared record that survives clones, branches, and sessions.
