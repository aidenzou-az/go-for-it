---
name: "yxg-cancel"
description: "Run $yxg:yxg-cancel to cancel the current mistaken draft yxg task without exposing cancel-work or work-id details to the user"
metadata:
  short-description: "Cancel the current yxg draft"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:cancel`, `$yxg-cancel`, or `$yxg:yxg-cancel`.
- It is an intent-level command. The user should not need to name `cancel-work` or a work ID.
- Internally, this skill may use `yxg resume --json` and `yxg cancel-work <WORK-ID> --json`.
</codex_skill_adapter>

<objective>
Cancel the current mistaken draft work unit safely, without requiring the user to edit `.yxg/` or learn kernel command details.
</objective>

<process>
1. Run `yxg resume --json` and inspect current active work.
2. If there is no active draft work, explain that there is nothing safe to cancel automatically.
3. If the active work is draft, run `yxg cancel-work <WORK-ID> --json`.
4. If the work is ready, active, review, blocked, or done, stop and explain that automatic cancellation is only for draft work.
5. Summarize the cancellation outcome and point the user to the next safe action, usually `$yxg:yxg-plan <task>`.
</process>
