---
name: "yxg-cancel-work"
description: "Run /yxg:cancel-work or $yxg:yxg-cancel-work to safely remove a mistaken draft work unit and refresh .yxg state"
metadata:
  short-description: "Cancel a bad draft work unit"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:cancel-work`, `$yxg-cancel-work`, or `$yxg:yxg-cancel-work`.
- It expects a stable work ID such as `WU-001`.
- Run `yxg cancel-work <WORK-ID> --json`.
- Use this only for mistaken draft work. Do not use it for reviewed or in-progress work.
</codex_skill_adapter>

<objective>
Remove an erroneous draft work artifact without leaving stale references in `.yxg/STATE.md`, `.yxg/INDEX.md`, or `.yxg/LOG.md`.
</objective>

<process>
1. Confirm the target work ID from the user input.
2. Run `yxg cancel-work <WORK-ID> --json`.
3. Surface the changed artifacts and the next safe action.
4. If the CLI refuses because the work is not in draft, stop and explain why instead of trying to edit `.yxg/` manually.
</process>
