---
name: "yxg-do"
description: "Run $yxg:yxg-do to continue the current active yxg work unit without exposing execute or work-id details to the user"
metadata:
  short-description: "Continue the current yxg task"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:do`, `$yxg-do`, or `$yxg:yxg-do`.
- It is an intent-level command. The user should not need to name `execute` or a work ID.
- Read current context through `.yxg/` and `yxg resume --json`, then act on the active work.
- Do not hand-edit `.yxg/STATE.md`, `.yxg/INDEX.md`, or work status fields when an equivalent `yxg` command exists.
</codex_skill_adapter>

<objective>
Continue the current active work unit using the durable yxg contract, while hiding low-level execute and work-id mechanics from the user.
</objective>

<process>
1. Run `yxg resume --json` to identify the current focus, active work, and next safe action.
2. If there is no active work but `resume` returns a roadmap-backed planned next work, treat that as the user's intended next task:
   - Read `.yxg/ROADMAP.md` and relevant baseline/context artifacts.
   - Use `yxg plan <WORK-ID> --json` internally to create or update the work unit from the planned roadmap item.
   - Fill the contract from roadmap evidence, current conversation context, and repo evidence.
   - Do not ask the user to run `yxg plan WU-xxx --ready`; keep planning and readying as internal mechanics.
   - Do not jump into implementation until the contract is complete and ready validation passes.
3. If there is no active work and no planned next work, tell the user there is no current yxg task and suggest `$yxg:yxg-plan <task>` instead of inventing one.
4. If `resume` returns a unique recommended current work, continue that work. If multiple active works remain and `resume` does not identify a unique recommendation, stop and ask the user which work to continue instead of picking one arbitrarily.
5. If `resume` returns git context, consume it before editing files:
   - If `branch_matches_recommended_work` is `false`, tell the user the current branch, suggested branch, and `branch_mismatch_reason` in natural language.
   - If unrelated dirty changes are reported, mention that they are outside the recommended work scope and should not be treated as safe yxg-owned changes.
   - Do not run implicit git writes such as `git init`, checkout/switch, branch creation, worktree creation, staging, or committing. If the user wants one of those actions, handle it as a separate explicit request.
6. If the kernel's `next_safe_action` says to resolve branch or unrelated dirty-worktree risk before starting, pause instead of modifying non-.yxg files, unless the current work is specifically about improving that git-risk behavior and the user has already invoked `yxg-do` to continue it.
7. Read the active work artifact and relevant referenced baseline or review artifacts.
8. If the work is still draft or blocked on clarification, ask the user the minimum necessary questions instead of forcing execution.
9. If the work is ready and implementation is beginning, use the kernel path that advances execution state, rather than hand-editing work status or `STATE.md`.
10. If the work is ready or active, continue implementation against the existing contract.
11. If implementation is complete but the contract requires external observation or scheduled collection before review, use the kernel path that moves the work to monitoring instead of forcing finish.
12. If implementation reveals material scope drift, update the durable work artifact or ask the user for clarification before proceeding.
13. If multiple user-visible surfaces could reasonably diverge, such as page body, title, OG image, share text, or docs, ask before choosing behavior that materially changes the product contract.
14. Keep durable discoveries in the work artifact's `Evidence Log`, `Assumptions`, or `Risks`, not only in chat.
15. If the kernel returns git context, prefer that result over re-deriving branch, dirty-tree, or related/unrelated change information manually.
16. In user-facing summaries, lead with the task title and current action. Mention work IDs or internal stage names only as secondary debugging detail.
</process>
