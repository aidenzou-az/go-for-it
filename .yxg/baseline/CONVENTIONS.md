---
artifact_type: baseline-conventions
schema_version: "1.0"
kernel_version: "1"
id: conventions
created_at: "2026-06-01"
updated_at: "2026-06-01"
---

# Conventions

## Naming
- [code-backed] Hyphenated file names are used in the repository.
- [code-backed] .test.* naming is used for automated tests.

## Structure
- [code-backed] Repository uses a dedicated src/ directory for implementation code.
- [code-backed] Repository uses docs/ for durable documentation.
- [code-backed] Repository uses templates/ for canonical artifact templates.

## Testing
- [code-backed] Tests are grouped under tests/.
- [code-backed] The repository standardizes on node --test in package scripts.

## Configuration
- [code-backed] package.json is a central configuration artifact.
- [code-backed] Environment variables referenced in code include: FALLBACK_OPENWEATHER_API_KEY, OPENWEATHER_API_KEY.
- [code-backed] Configuration-sensitive modules include: src/import/scan.js, tests/init-and-validate.test.js.
- [code-backed] FALLBACK_OPENWEATHER_API_KEY influences runtime behavior in tests/init-and-validate.test.js.
- [code-backed] OPENWEATHER_API_KEY influences runtime behavior in tests/init-and-validate.test.js.
- [code-backed] tests/init-and-validate.test.js applies a ?? fallback when reading OPENWEATHER_API_KEY.

## Error Handling And Logging
- [code-backed] Explicit catch or failure-handling paths exist around external dependencies such as Anthropic, Discord.
- [code-backed] Some runtime paths appear to degrade gracefully when Anthropic, Discord fails or returns incomplete data.
- [code-backed] Recent completed work WU-005 flagged an operational risk: 如果 roadmap 文案格式过自由，planned next 识别可能误判。
- [code-backed] Recent completed work WU-005 flagged an operational risk: 如果 `yxg-do` 过度自动化，可能重新引入“不经确认就实现”的体验问题。
