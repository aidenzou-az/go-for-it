---
artifact_type: project
schema_version: "1.0"
kernel_version: "1"
id: project
status: active
created_at: "2026-05-13"
updated_at: 2026-06-01
---

# Project

## One-Sentence Goal
A repository-local framework kernel for yxg framework.

## Why This Project Exists
yxg framework should preserve project understanding and implementation context in durable repository artifacts instead of relying on chat history alone.

## Success Criteria
- The primary runtime surfaces remain healthy across src/validation/index.js, src/commands/index.js, bin/yxg.js.
- External integrations such as Anthropic, Discord, Feishu/Lark, GitHub, OpenAI, OpenWeather, Slack continue to return usable data.
- The repository has a clear verification path for future feature work.
- Completed work continues to harden the shared baseline instead of leaving new knowledge only in chat.

## Non-Negotiable Constraints
- Runtime behavior depends on environment bindings such as FALLBACK_OPENWEATHER_API_KEY, OPENWEATHER_API_KEY.
- External service contracts with Anthropic, Discord, Feishu/Lark, GitHub, OpenAI, OpenWeather, Slack constrain feature behavior and fallbacks.

## Product Principles
- Degrade gracefully when upstream data is incomplete or temporarily unavailable.
- Prefer small, legible feature changes over scope creep during iterative development.

## Engineering Principles
- Preserve shared module boundaries instead of duplicating logic across runtime surfaces.
- Record concrete verification evidence in durable artifacts before closing work.
- Treat external dependency failure modes as first-class implementation concerns.

## Out Of Scope
- Do not rely on chat history as the only source of project understanding.
- Do not mix unrelated repository cleanup into ordinary feature work without making it explicit.
