---
name: "yxg-plan"
description: "Run /yxg:plan or $yxg:yxg-plan to intake a natural-language task, create a work unit, and ask clarifying questions when needed"
metadata:
  short-description: "Natural-language Codex wrapper for yxg plan"
---

<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by `/yxg:plan`, `$yxg-plan`, or `$yxg:yxg-plan`.
- When the user gives a natural-language task request, treat that text as a task description, not as a raw CLI positional argument.
- For natural-language intake, run `yxg plan --task="<task text>" --json`.
- Never probe natural-language task text by first calling `yxg plan "<task text>"`.
- Typical examples:
  - `/yxg:plan 增加“降水概率”显示`
  - `$yxg:yxg-plan 增加“降水概率”显示`
  - `yxg plan --task="增加降水概率显示" --json`
  - `/yxg:plan WU-001 --ready`
- Only use a raw positional work ID when continuing or readying an existing work unit.
</codex_skill_adapter>

<objective>
Take a natural-language task from the user, create or update the durable work unit through the canonical CLI, and ask the user for clarification only when the contract cannot be completed safely from repo context.
</objective>

<process>
1. If `.yxg/` is missing and the repository already contains meaningful implementation files or documentation, prefer `yxg import --json` before planning.
2. If `.yxg/` is missing and the repository is truly greenfield, run `yxg init --json` before planning.
3. If baseline artifacts are missing in an existing repository, run `yxg import --json` before planning.
4. If the user input is natural-language task text, run `yxg plan --task="<task text>" --json`.
5. If the user input already names a stable work ID, pass it through to `yxg plan --json`.
6. Surface the generated work ID, slug, title, and work file path from the CLI result.
7. Read the generated work artifact plus `.yxg/STATE.md`, `.yxg/INDEX.md`, and any relevant baseline artifacts.
8. If this conversation already established scope, constraints, tradeoffs, or acceptance criteria, prefer writing those confirmed conclusions into the work contract instead of asking the user to restate them.
9. Fill only the contract details that are clearly supported by current conversation context, repository evidence, or explicit external research.
10. If you use external research to shape implementation choices, write the resulting conclusions back into the work artifact's `Evidence Log`, `Assumptions`, or `Risks` instead of leaving them only in chat.
11. Route durable conclusions to the right artifact:
   - task-specific scope, checks, and evidence go into the current work artifact
   - repository-wide product or engineering constraints go into `.yxg/PROJECT.md`
   - repository structure, runtime, dependency, or verification understanding that outlives one task goes into the appropriate baseline artifact
12. If scope, behavior, output shape, verification, or user-visible formatting are materially ambiguous, stop and ask the user focused clarification questions instead of inventing details.
13. Do not move the work unit to `ready` while such material ambiguity remains unresolved.
14. If ready validation fails, use CLI findings to explain which sections remain incomplete.
15. Keep contract state in durable artifacts rather than in chat-only summaries.
</process>

<clarification_policy>
- Ask questions only when a wrong assumption would materially change implementation or acceptance.
- Prefer 1 to 3 focused questions.
- Good triggers:
  - multiple plausible output behaviors
  - unclear in-scope vs out-of-scope boundary
  - missing verification standard
  - likely user-facing format change
  - multiple visible output surfaces that may need different behavior or formatting
- Bad triggers:
  - asking for information already discoverable from the repo
  - asking for IDs, slugs, or titles that the skill can generate itself
</clarification_policy>
