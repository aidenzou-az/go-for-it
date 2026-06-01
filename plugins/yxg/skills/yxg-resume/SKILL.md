---
name: "yxg-resume"
description: "Run $yxg:yxg-resume to restore current yxg context in user-facing terms without exposing raw resume CLI output"
metadata:
  short-description: "Resume current yxg work"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:resume`, `$yxg-resume`, or `$yxg:yxg-resume`.
- It is an intent-level command. The user should not need to know about `resume --json`.
</codex_skill_adapter>

<objective>
Restore current working context from `.yxg/` artifacts and present it as a user-facing summary.
</objective>

<process>
1. Run `yxg resume --json`.
2. Read the active work artifact and relevant baseline or review artifacts if the CLI points to them.
3. Summarize current focus, active work, blockers, and next safe action in natural language.
4. Prefer this resume path over re-deriving context from broad repository scanning.
</process>
