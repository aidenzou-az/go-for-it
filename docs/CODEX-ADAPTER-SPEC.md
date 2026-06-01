# Codex Adapter Spec

## Status

- Spec status: draft
- Kernel version: v1
- Adapter phase: stage 1 skills plus stage 2 plugin scaffold

## Purpose

Define how Codex should invoke the `.yxg/` kernel through Codex-native command surfaces instead of asking users to remember raw CLI commands.

The adapter must not duplicate kernel logic.
It only maps Codex interaction surfaces to the canonical `yxg` CLI and internal workflow steps.

`yxg init` and `yxg import` remain explicit user actions, but they should have the same intent-level feel as the rest of the workflow:

- `init` is for greenfield repositories that are starting with yxg from the beginning
- `import` is for existing repositories that need to be onboarded and deeply understood before future work

## User-Facing Intent Layer

The preferred user-facing Codex entry points are intent-level skills:

- `/yxg:plan` or `$yxg:yxg-plan <task>`
- `/yxg:do` or `$yxg:yxg-do`
- `/yxg:monitor` or `$yxg:yxg-monitor`
- `/yxg:finish` or `$yxg:yxg-finish`
- `/yxg:resume` or `$yxg:yxg-resume`
- `/yxg:cancel` or `$yxg:yxg-cancel`

These are the primary UX surface.
Users should not need to think in terms of `execute`, `review`, `cleanup`, `resume --json`, or work IDs for common flows.

## Primary Syntax

The preferred Codex slash namespace is:

```text
/yxg:<subcommand>
```

The first supported subcommands are:

- `/yxg:do`
- `/yxg:monitor`
- `/yxg:finish`
- `/yxg:cancel`
- `/yxg:init`
- `/yxg:import`
- `/yxg:plan`
- `/yxg:cancel-work`
- `/yxg:review`
- `/yxg:resume`
- `/yxg:cleanup`

## Fallback Syntax

Until slash registration is fully available in every Codex environment, the adapter must also support skill-style invocation:

- `$yxg do`
- `$yxg finish`
- `$yxg cancel`
- `$yxg init ...`
- `$yxg import`
- `$yxg plan ...`
- `$yxg cancel-work ...`
- `$yxg review ...`
- `$yxg resume`
- `$yxg cleanup`

And command-specific aliases:

- `$yxg-do`
- `$yxg-finish`
- `$yxg-cancel`
- `$yxg-init`
- `$yxg-import`
- `$yxg-plan`
- `$yxg-cancel-work`
- `$yxg-review`
- `$yxg-resume`
- `$yxg-cleanup`

The preferred natural-language planning alias is:

- `$yxg:yxg-plan <task description>`

## Adapter Rules

- Prefer `yxg <subcommand> --json` so Codex receives structured output.
- If `yxg` is unavailable on `PATH`, stop and tell the user to install or link the CLI rather than reimplementing the command manually.
- Do not manually edit `.yxg/` when an equivalent `yxg` command exists.
- User-facing summaries should default to the user's language, not to the dominant language of the repository or source files. Quote repository text verbatim only when needed, but keep the surrounding explanation in the user's language.
- `yxg-import` should summarize the project before summarizing the import. Its first job is to explain what problem the project is solving, who uses it, the core workflow or output, and the role this repository plays.
- If import cannot answer that project-level problem statement with confidence, it should say so explicitly and identify the missing evidence instead of jumping straight to implementation details or artifact lists.
- `yxg-do`, `yxg-monitor`, `yxg-finish`, `yxg-resume`, and `yxg-cancel` are intent-level workflows. They may internally call multiple kernel commands, but those low-level commands should stay hidden from the user in normal use.
- `yxg-do` must use kernel state-transition commands internally when they exist. It must not hand-edit `.yxg/STATE.md`, `.yxg/INDEX.md`, or work status fields as a substitute for those commands.
- If `yxg-do` finds no active work but `yxg resume --json` returns a roadmap-backed planned next work, the adapter should treat that planned next work as the user's intended next task. It may internally create or update the work unit from `.yxg/ROADMAP.md`, fill the contract from evidence, and ready/execute it only after validation passes.
- `yxg-do` must not tell the user to run `yxg plan WU-xxx --ready` for a roadmap planned next work. If the contract is incomplete, ask focused clarification questions in user language instead of exposing raw ready commands.
- `yxg-monitor` should move the current recommended work into `monitoring` only when implementation is complete enough to observe but external evidence is still pending. It should use the kernel transition command internally and write the evidence gate back into the work artifact.
- When multiple active works exist, `yxg-do` should continue only the work uniquely recommended by `yxg resume --json`. If resume does not identify a unique current work, the adapter should ask the user which work to continue instead of picking the first one arbitrarily.
- For natural-language planning, the adapter should call `yxg plan --task="<task text>" --json`.
- The adapter, not the user, is responsible for generating the stable work ID, slug, and title.
- Only use a raw positional work ID such as `WU-001` when continuing or readying an existing work unit.
- `yxg-plan` is an intent-level skill, not a thin shell alias. Natural-language task text after `$yxg:yxg-plan` must not be forwarded as a positional work ID.
- The skill must not "try and see" with `yxg plan "<task text>"` first. Natural-language intake goes directly to `yxg plan --task="<task text>" --json`.
- The skill should read `.yxg/STATE.md`, `.yxg/INDEX.md`, and relevant baseline artifacts after task intake, then ask focused clarification questions whenever the contract cannot be completed safely from the available evidence.
- When the user first discusses a task in chat and only later invokes `yxg-plan`, the adapter should carry forward already-confirmed scope, constraints, tradeoffs, and acceptance criteria into durable artifacts instead of asking the user to restate them.
- Durable conclusions must be routed by scope:
  - task-local conclusions go into the current work artifact
  - repository-wide product or engineering constraints go into `.yxg/PROJECT.md`
  - repository understanding that should outlive one task goes into baseline artifacts
- If `.yxg/` is missing, `yxg-plan` may initialize it first. If the repo lacks baseline artifacts, `yxg-plan` may run `yxg import --json` before planning.
- `yxg-init` should be framed as a new-project or greenfield action. If the repository is already established, the adapter should prefer `yxg-import`.
- `yxg-import` should be framed as the existing-project onboarding action. It should not require a separate prior `yxg-init` step from the user.
- `yxg-init` and `yxg-import` must not initialize git automatically. If git is unavailable, summarize the capability degradation and ask before any separate git setup action.
- If external research is used during planning, the resulting conclusions must be written back into the work artifact rather than left only in chat.
- The skill must not advance a work unit to `ready` while material ambiguity remains unresolved.
- `yxg-plan` should not automatically enter implementation after planning, even when no ambiguity remains. Transition into `yxg-do` stays an explicit user action.
- `yxg-do` must pause for clarification when execution reaches a product decision that materially affects multiple visible surfaces or changes user-facing behavior.
- `yxg-do` should prefer kernel-returned git context over manually re-deriving branch, dirty-worktree, or related/unrelated change analysis.
- `yxg-do` should consume `branch_matches_recommended_work`, `branch_mismatch_reason`, `suggested_branch`, and unrelated dirty-change fields from `yxg resume --json`. If the kernel says the current branch does not match the recommended work, Codex should explain the current branch, suggested branch, and risk before editing files.
- If `yxg resume --json` says the next safe action is to resolve branch or unrelated dirty-worktree risk before starting, `yxg-do` should pause before modifying non-.yxg files, unless the active work explicitly concerns improving that git-risk behavior and the user has invoked `yxg-do` to continue it.
- Git-related adapter behavior is observe/suggest only. Codex may advise a branch, worktree, or commit convention, but must not implicitly run git writes such as `git init`, checkout/switch, branch creation, worktree creation, staging, or committing as part of normal yxg intent skills.
- `yxg-resume` should surface a unique recommended current work when the state narrative points to ongoing execution of one actionable work unit. If the state only records the latest planned ready card in a batch, `resume` should recommend the earliest unblocked `ready` work instead. If the state records a `monitoring` work that is waiting for external evidence, `resume` should prefer a separate `ready` or `active` work over the monitoring work. That recommendation is the only safe implicit target for `yxg-do`.
- `yxg-monitor` should explain that monitoring work remains open for evidence collection, but does not抢占 later `yxg-do` runs when a separate ready or active actionable work is available.
- User-facing summaries for `yxg-do` should lead with the task and current action, not with internal work IDs or stage names.
- `yxg-finish` should perform review and cleanup internally, then summarize the result in user-facing terms rather than narrating low-level kernel steps.
- `yxg-finish` should confirm post-cleanup state once and, if warnings remain, either resolve them through the kernel path or clearly report them as unresolved.
- `yxg-finish` should surface kernel-returned git context naturally, especially suggested commit trailer and unrelated dirty changes that still need user attention.
- `yxg-finish` must not describe the repository as clean or low-risk when the kernel reports branch mismatch or unrelated dirty changes. It may finish the yxg work if the contract is satisfied, but must state the remaining git risk separately.
- `yxg-cancel` should resolve the current draft work context and use `yxg cancel-work <WORK-ID>` internally when safe.
- Summaries shown to the user should come from CLI result fields such as `message`, `details`, `artifacts_changed`, and `next_steps`.
- Treat `.yxg/` as the durable source of truth. The adapter must not create a second state system inside prompts.

## Installation Shape

The repo now carries a local Codex plugin scaffold at:

```text
plugins/yxg/
```

with marketplace metadata at:

```text
.agents/plugins/marketplace.json
```

This enables repo-local plugin discovery while the skills provide immediate operational coverage.

## Installation Model

Repo-local plugin assets are necessary but not sufficient.
The supported install flow is:

1. copy plugin assets into the target repository
2. confirm repo-local marketplace and plugin manifest paths are present
3. manually install or enable the local plugin inside Codex for that target repository
4. reopen Codex in the target repository and verify command routing

The installer script only handles step 1 and step 2.
Codex manual enablement remains a required operator action in the current workflow.
When the repo-local plugin version changes, treat that as a cache boundary and refresh or reinstall the local `yxg` plugin inside Codex before testing new behavior.

## Verification Model

The recommended verification sequence is:

1. `npm run install:codex-adapter -- <target-repo-path>`
2. `npm run verify:codex-adapter -- <target-repo-path>`
3. manually enable the local yxg plugin inside Codex
4. test `$yxg:yxg-plan <task description>`

Verification is complete only when both of these are true:

- repo-local assets are present and structurally correct
- Codex actually routes `$yxg:*` or `/yxg:*` to the yxg skill layer

## Non-Goals

- No duplicate implementation of `init/import/plan/review/resume/cleanup`
- No adapter-only state files
- No `execute` slash command in the first adapter batch
