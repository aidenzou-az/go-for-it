---
name: "yxg-finish"
description: "Run $yxg:yxg-finish to wrap up the current yxg task by performing internal review and cleanup without exposing those commands to the user"
metadata:
  short-description: "Finish the current yxg task"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:finish`, `$yxg-finish`, or `$yxg:yxg-finish`.
- It is an intent-level command. The user should not need to ask for `review`, `cleanup`, or a work ID.
- Internally, this skill may use `yxg review`, `yxg cleanup`, and `yxg resume`.
- User-facing progress updates should not be narrated primarily as "running review", "running cleanup", or "running resume".
</codex_skill_adapter>

<objective>
Finish the current active work unit in a user-facing way while keeping review and cleanup as internal workflow mechanics.
</objective>

<process>
1. Run `yxg resume --json` to locate the current active work unit.
2. If no active work exists, tell the user there is nothing to finish.
3. Review the active work against its contract and verification evidence.
4. If the work is monitoring or otherwise waiting for external observation evidence, explain the missing evidence in natural language instead of running a premature pass review.
5. If the work is not actually ready to finish, explain the blockers or missing verification in natural language instead of running a premature pass review.
6. If the work satisfies the contract, run `yxg review <WORK-ID> --verdict=pass --json`.
7. If review returns a revise or escalate path, summarize that outcome naturally and stop.
8. After a successful pass, run `yxg cleanup --json`.
9. When `review` or `cleanup` returns git context, use it to report branch, commit-trailer, and dirty-worktree risk instead of re-deriving those checks manually.
10. If git context reports `branch_matches_recommended_work: false`, state the branch mismatch as an unresolved isolation risk unless an explicit user-approved git action corrected it.
11. If git context reports unrelated dirty changes, do not describe the finish as a clean or low-risk repository state. Say that the yxg work is finished, but the worktree still contains unrelated changes that need separate attention.
12. Run one final `yxg resume --json` only to confirm the post-cleanup state and next safe action.
13. If the final resume still reports warnings or inconsistent state, either resolve them through the kernel path or report them as unresolved. Do not claim that state was corrected unless a real change occurred.
14. Summarize the outcome in user-facing terms: what was finished, whether it was archived, what remains unresolved, what git risk remains if the worktree is still dirty, and what the next safe action is.
</process>
