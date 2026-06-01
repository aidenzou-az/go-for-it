---
name: "yxg-review"
description: "Run /yxg:review or $yxg-review to record a review verdict"
metadata:
  short-description: "Codex wrapper for yxg review"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:review` or `$yxg-review`.
- Treat all trailing text as arguments for `yxg review`.
- Typical example:
  - `/yxg:review WU-001 --verdict=pass`
</codex_skill_adapter>

<objective>
Record a bounded review verdict through the canonical CLI before declaring work complete.
</objective>

<process>
1. Run `yxg review --json` with the requested work ID and verdict.
2. Surface the resulting status transition and follow-up steps.
3. Do not mark work complete outside the review flow when `yxg review` is available.
</process>
