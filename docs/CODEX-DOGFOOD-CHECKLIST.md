# Codex Dogfood Checklist

Use this checklist when validating `yxg` in a different repository through Codex.

Primary user-facing commands for dogfooding:

- `$yxg:yxg-init`
- `$yxg:yxg-import`
- `$yxg:yxg-plan <task>`
- `$yxg:yxg-do`
- `$yxg:yxg-monitor`
- `$yxg:yxg-finish`
- `$yxg:yxg-resume`
- `$yxg:yxg-cancel`

When evaluating these commands, prefer user-facing behavior over kernel transparency.
The user should not need to think about `execute`, `execute --monitoring`, `review`, `cleanup`, `resume --json`, or work IDs during the normal flow.
`init` and `import` remain explicit user-facing actions, but they should still feel like intent-level commands rather than raw shell wrappers.

## 1. Prerequisites

- `yxg` is callable in the target repo shell:
  - `yxg --help`
- the target repo does not need to contain the `yxg` source tree
- if the repo already has a partial `.yxg/`, prefer `yxg init --merge`

## 2. Install The Repo-Local Adapter

From the `yxg` source repository:

```bash
npm run install:codex-adapter -- /abs/path/to/target-repo
npm run verify:codex-adapter -- /abs/path/to/target-repo
```

Expected result:

- `plugins/yxg/.codex-plugin/plugin.json` exists in the target repo
- `.agents/plugins/marketplace.json` exists in the target repo
- verify reports no `ERROR` findings

## 3. Manually Enable The Plugin In Codex

Repo-local files alone are not enough.
Inside Codex for the target repository:

1. open the local plugin or marketplace UI
2. manually install or enable the repo-local `yxg` plugin
3. reopen the Codex session if required by the client
4. if the `yxg` plugin version changed since the last run, refresh or reinstall it instead of assuming the existing cached install picked up new skill behavior

Expected result:

- `$yxg:yxg-plan <task>` resolves to the yxg skill layer instead of being treated as ordinary chat text
- the installed local plugin version matches the current repo-local `plugins/yxg/.codex-plugin/plugin.json`

## 4. Choose The Right Onboarding Action

For a new or greenfield repository:

```text
$yxg:yxg-init
```

For an existing repository that needs to be understood and adopted into yxg:

```text
$yxg:yxg-import
```

Expected behavior:

- `yxg-init` is treated as the greenfield path
- `yxg-import` is treated as the existing-project onboarding path
- the user is not asked to run a separate `init` first when the goal is to import an existing repository
- user-facing summaries stay in the user's language even when the repository itself is primarily written in another language
- the first part of the summary explains the project itself:
  - what problem it solves
  - who uses it
  - the core workflow or output
  - the role this repository plays
- if import cannot answer that project-level problem statement confidently, it says which evidence is missing instead of skipping directly to implementation details
- if the target is not a git worktree, Codex explains that branch isolation, dirty-worktree classification, and commit/PR handoff are unavailable
- Codex does not run `git init` as part of `$yxg:yxg-init` or `$yxg:yxg-import`

Shell-level equivalents for debugging only:

```bash
yxg init --json
yxg import --json
yxg validate instance --json
```

Expected result:

- `.yxg/` exists and validates
- baseline artifacts exist under `.yxg/baseline/`
- import output includes architecture, runtime, dependency, verification, and risk findings for the existing repository

## 5. Test Natural-Language Planning

In Codex, use a real task in the intended natural form:

```text
$yxg:yxg-plan 增加“降水概率”显示
```

Expected behavior:

- Codex treats the text as task intake
- the skill calls `yxg plan --task="增加“降水概率”显示" --json`
- the skill does not first probe with `yxg plan '增加“降水概率”显示'`
- a new draft work unit is created with an auto-generated `WU-xxx`
- Codex reads the draft and relevant baseline/state artifacts
- if the task was already discussed in chat, Codex carries forward the already-confirmed scope, constraints, tradeoffs, and acceptance criteria instead of asking the user to repeat them
- Codex writes any externally researched conclusions back into `Evidence Log`, `Assumptions`, or `Risks`
- Codex routes durable conclusions by scope:
  - current-task decisions into the active work artifact
  - repository-wide constraints into `.yxg/PROJECT.md`
  - longer-lived repository understanding into baseline artifacts
- Codex asks focused clarification questions if key scope, verification, or user-visible behavior details remain ambiguous
- Codex does not move the work to `ready` until those ambiguities are resolved
- Codex does not automatically enter execution just because planning succeeded; moving into `$yxg:yxg-do` remains explicit

Failure signs:

- Codex forwards the raw text as a positional work ID
- Codex asks the user to invent `WU-001`, `--slug`, or `--title`
- Codex asks the user to restate conclusions that were already clearly settled in the same discussion
- Codex hand-edits `.yxg/` instead of using the CLI
- Codex performs external research but leaves the conclusion only in chat
- Codex auto-readies a task even though visible output behavior is still ambiguous
- Codex switches the whole summary to English just because the repository, docs, or baseline artifacts are written in English
- Codex explains import mechanics and generated files before it explains what the project is actually for
- Codex finishes import without helping the user answer “这个项目是干什么的”
- Codex initializes git, switches branches, creates worktrees, stages files, or commits files as an implicit yxg side effect

## 6. Test Recovery From Bad Intake

If a mistaken draft gets created:

```bash
yxg cancel-work <WORK-ID> --json
```

Expected result:

- the draft work file is removed
- `STATE.md` and `INDEX.md` are refreshed
- a log entry is added

## 7. Test Completion And Resume

After implementing a real task, prefer the user-facing skills instead of raw kernel commands.

In Codex:

```text
$yxg:yxg-finish
$yxg:yxg-resume
```

During `$yxg:yxg-do`, watch for these expected behaviors:

- Codex uses the existing yxg state machine internally instead of hand-editing `.yxg/STATE.md` or work status fields
- if no active work exists but the roadmap names a planned next work such as `WU-008 BTC L1 数据基础与 raw cache`, Codex treats it as the intended next task and creates/updates the work unit internally
- Codex does not ask the user to run `yxg plan WU-008 --ready`; if the planned next contract is incomplete, Codex asks focused clarification questions instead
- if multiple active works exist, Codex continues only the uniquely recommended work from `yxg resume --json`; otherwise it asks the user which work to continue
- Codex asks before making a product decision that changes multiple visible surfaces such as page content, title, OG image, or docs
- Codex reuses kernel-returned git context instead of inventing its own branch or dirty-tree story
- if `branch_matches_recommended_work` is false, Codex explains the current branch, suggested branch, and mismatch reason before changing non-.yxg files
- if unrelated dirty changes are reported, Codex does not treat them as safe yxg-owned work and does not hide them in the summary
- Codex treats git integration as observe/suggest only: it can recommend branch or worktree-safe actions, but does not perform git writes without a separate explicit user request
- Codex reports progress in task language first, not in terms of `WU-001`, `ready`, or `active`

Failure signs:

- Codex manually edits `.yxg/STATE.md` or flips work status directly when an equivalent kernel command exists
- Codex silently picks the first active work even though resume did not return a unique recommended work
- Codex silently chooses behavior across multiple visible surfaces without asking
- Codex sees a branch mismatch and continues as if the branch is safe without mentioning the suggested branch
- Codex stages, commits, creates a branch, creates a worktree, or runs `git init` as an implicit side effect of `$yxg:yxg-do`
- Codex narrates the workflow mainly in kernel terms instead of user-facing task terms

During `$yxg:yxg-monitor`, watch for these expected behaviors:

- Codex explains that the monitored work remains open until evidence arrives
- Codex explains the next actionable work if `resume` recommends one
- monitoring work does not抢占 later `$yxg:yxg-do` runs while a separate ready or active work is available
- any branch mismatch or dirty-worktree issue is reported as observe/suggest risk only

Git observe/suggest scenarios to verify during dogfood:

- if `WU-013` is monitoring and `WU-014` is ready, `$yxg:yxg-do` should follow the `WU-014` recommendation rather than returning to `WU-013`
- if the current branch is `yxg/wu-013-collector` while the recommended work is `WU-014`, Codex should report branch mismatch and name the suggested `yxg/wu-014-*` branch
- if the target directory is not a git worktree, `$yxg:yxg-init` and `$yxg:yxg-import` should not create `.git`; Codex should only explain that branch isolation, dirty-worktree classification, and commit handoff are unavailable or weaker
- if unrelated dirty changes remain during `$yxg:yxg-finish`, Codex may finish the yxg work only when the contract is satisfied, but must report the unrelated changes as separate git risk

During `$yxg:yxg-finish`, watch for these expected behaviors:

- Codex keeps `review`, `cleanup`, and `resume` as internal mechanics rather than the main user-facing narration
- Codex surfaces kernel-returned git context naturally, such as suggested commit trailer or unrelated dirty changes
- Codex confirms post-cleanup state once and reports the final safe next step
- if a residual warning remains after cleanup, Codex either resolves it through the kernel path or explicitly reports it as unresolved
- if branch mismatch or unrelated dirty changes remain, Codex says the yxg work is finished but the git state still needs separate attention

Failure signs:

- Codex narrates the close-out mainly as raw `yxg review`, `yxg cleanup`, or `yxg resume` steps
- Codex claims state was corrected even though no actual change was made
- Codex claims the repo is clean or low-risk while unrelated dirty changes or branch mismatch remain
- Codex blurs the timing of warnings, for example attributing a pre-cleanup warning to the post-cleanup state

Internal mechanics may still use review and cleanup, but they should not leak into the normal user flow.

Shell-level equivalents for debugging only:

```bash
yxg review <WORK-ID> --verdict=pass --json
yxg cleanup --json
yxg resume --json
```

Expected result:

- review is recorded before completion
- cleanup archives finished work and keeps current operations clean
- resume identifies the current focus and next safe action from `.yxg/`

## 8. Record Dogfood Findings

Capture these after each run:

- did Codex use the yxg skill naturally
- did `plan` stay natural-language first
- did the skill ask the right clarification questions
- did cleanup leave `INDEX.md` clean
- did resume recover without chat history
- what felt too heavy or too manual
