---
name: "yxg-init"
description: "Run /yxg:init or $yxg-init to start a new or greenfield repository with yxg"
metadata:
  short-description: "Start a new project with yxg"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:init` or `$yxg-init`.
- Treat this as a greenfield onboarding action, not as the normal path for existing repositories.
</codex_skill_adapter>

<objective>
Initialize the standard `.yxg/` scaffold for a new or greenfield repository through the canonical CLI.
</objective>

<process>
1. If the repository is clearly an existing project that should be onboarded rather than started fresh, recommend `$yxg:yxg-import` instead of forcing `init`.
2. Otherwise run `yxg init --json`, adding explicit flags only when the user actually asked for merge or reinit behavior.
3. Do not manually create `.yxg/` files when the CLI is available.
4. If the CLI result or repository context shows this is not a git worktree, explain only the capability degradation: branch isolation, dirty-worktree classification, and commit-trailer handoff will be unavailable or weaker.
5. Do not suggest or run `git init` as part of `$yxg:yxg-init`. Any git setup must be a separate explicit user request.
6. Report `message`, `details`, changed artifacts, and next steps from the CLI result in user-facing terms.
</process>
