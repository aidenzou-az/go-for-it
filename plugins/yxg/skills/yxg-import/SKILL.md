---
name: "yxg-import"
description: "Run /yxg:import or $yxg-import to onboard an existing repository into yxg with deep understanding"
metadata:
  short-description: "Onboard an existing repo into yxg"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:import` or `$yxg-import`.
- Treat this as the normal entry point for existing repositories, not as a thin shell wrapper.
</codex_skill_adapter>

<objective>
Onboard an existing repository into yxg, including bootstrap of the minimal `.yxg/` state when needed and deep baseline generation for later feature work.
</objective>

<process>
1. Run `yxg import --json`.
2. Treat `import` as the existing-project onboarding action. Do not force the user to run `init` first when the goal is to understand an existing repository.
3. Use the user's language for user-facing summaries by default. Do not switch to English merely because the repository, source files, or baseline artifacts are written in English.
4. Start the summary by explaining the project itself, not the import mechanics. First answer:
   - what problem this project is solving
   - who or what uses it
   - the core workflow or output it provides
   - the role this repository plays in that system
5. If those answers are low-confidence, say so explicitly and identify which evidence is missing, rather than skipping the problem statement.
6. After the problem-oriented summary, surface the architecture, runtime, dependency, verification, and risk findings from the baseline artifacts.
7. If the CLI result or repository context shows this is not a git worktree, explain only the capability degradation: branch isolation, dirty-worktree classification, and commit-trailer handoff will be unavailable or weaker.
8. Do not suggest or run `git init` as part of `$yxg:yxg-import`. Any git setup must be a separate explicit user request.
9. Make it clear that import is building the durable starting context for later planning and implementation.
10. Do not invent roadmap items or work units during import unless the user asks for them separately.
</process>
