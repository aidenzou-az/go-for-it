---
name: "yxg"
description: "Dispatcher for Codex-native yxg slash commands"
metadata:
  short-description: "Use /yxg:<subcommand> or $yxg <subcommand> to drive the yxg kernel"
---

<codex_skill_adapter>
## A. Skill Invocation
- This adapter is invoked by `/yxg:<subcommand>` or `$yxg <subcommand>`.
- Supported subcommands in v1:
  - `do`
  - `monitor`
  - `finish`
  - `cancel`
  - `init`
  - `import`
  - `plan`
  - `cancel-work`
  - `review`
  - `resume`
  - `cleanup`
- Prefer the intent-level skills `plan`, `do`, `monitor`, `finish`, `resume`, and `cancel` for user-facing workflow steps.
- Do not blindly pass trailing text through as CLI positional arguments.
- For `plan`, treat trailing natural-language text as task intake and route it to the dedicated `yxg-plan` skill.
- For `do`, `monitor`, `finish`, `resume`, and `cancel`, route to the matching intent-level skill instead of exposing execute, review, cleanup, or cancel-work details to the user.
- For `cancel-work`, expect a stable work ID such as `WU-001`.
- If the user uses a command-specific alias like `$yxg-init`, prefer the matching dedicated skill when present.
</codex_skill_adapter>

<objective>
Map Codex-native command syntax to the canonical `yxg` CLI without duplicating kernel logic.
</objective>

<process>
1. Parse the requested subcommand and arguments.
2. Prefer the dedicated subcommand skill when one exists.
3. Treat `do`, `monitor`, `finish`, `resume`, and `cancel` as primary user-facing workflows.
4. For raw fallback execution, prefer running `yxg <subcommand> --json`.
5. If `yxg` is unavailable on `PATH`, stop and tell the user to install or link the CLI instead of reimplementing the command manually.
6. Summarize the command result using the structured output fields.
7. Point the user to changed `.yxg/` artifacts when they matter.
</process>
