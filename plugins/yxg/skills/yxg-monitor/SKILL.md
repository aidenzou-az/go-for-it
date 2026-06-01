---
name: "yxg-monitor"
description: "Run /yxg:monitor or $yxg:yxg-monitor to move the current yxg task into monitoring while external evidence is collected"
metadata:
  short-description: "Move current yxg task to monitoring"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:monitor`, `$yxg-monitor`, or `$yxg:yxg-monitor`.
- It is an intent-level command. The user should not need to name `execute --monitoring` or a work ID.
- Internally, this skill should use `yxg resume --json` and `yxg execute <WORK-ID> --monitoring --json`.
- Do not hand-edit `.yxg/STATE.md`, `.yxg/INDEX.md`, or work status fields when the kernel transition command is available.
</codex_skill_adapter>

<objective>
Move the current work unit into monitoring when implementation is complete but external observation, scheduled collection, soak time, or acceptance evidence is still pending.
</objective>

<process>
1. Run `yxg resume --json` to identify the current recommended work.
2. If no recommended work exists, ask the user which work should enter monitoring instead of guessing.
3. Read the recommended work artifact and confirm the work is not still draft, blocked, already in review, or done.
4. If implementation is not actually complete enough to observe, explain what remains to implement and continue through `yxg-do` instead of moving to monitoring.
5. If the work contract requires external evidence before review, record the monitoring reason, expected evidence, and observation window in the work artifact's `Evidence Log`, `Verification`, `Done When`, or `Notes` as appropriate.
6. Run `yxg execute <WORK-ID> --monitoring --json` to perform the state transition.
7. After the transition, use `yxg resume --json` to identify whether another actionable work is recommended while this work remains in monitoring.
8. Summarize in user-facing language: what is now running or waiting, what evidence is needed, when the work can return to review, and what the next actionable work is if `resume` identifies one.
9. Explicitly explain that monitoring work remains open for evidence collection and does not抢占 later `yxg-do` runs when a separate ready or active actionable work is available.
10. If the kernel returns git context, prefer that result over re-deriving branch, dirty-tree, or related/unrelated change information manually.
11. If branch mismatch or unrelated dirty changes are reported, surface them as observe/suggest risks only; do not switch branches, create worktrees, stage files, or commit as part of monitoring.
</process>
