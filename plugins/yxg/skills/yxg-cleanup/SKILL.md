---
name: "yxg-cleanup"
description: "Run /yxg:cleanup or $yxg-cleanup to archive completed work and refresh the index"
metadata:
  short-description: "Codex wrapper for yxg cleanup"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:cleanup` or `$yxg-cleanup`.
- Treat all trailing text as arguments for `yxg cleanup`.
</codex_skill_adapter>

<objective>
Perform safe maintenance actions through the canonical CLI so `.yxg/` stays legible over long-running work.
</objective>

<process>
1. Run `yxg cleanup --json`.
2. Surface archive counts, index refresh effects, and any validation findings.
3. Keep cleanup limited to safe maintenance; do not rewrite unrelated project code.
</process>
