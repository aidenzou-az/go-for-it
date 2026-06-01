---
artifact_type: baseline-architecture
schema_version: "1.0"
kernel_version: "1"
id: architecture
created_at: "2026-06-01"
updated_at: "2026-06-01"
---

# Architecture

## Repository Shape
- [code-backed] Top-level directory present: .agents.
- [code-backed] Top-level directory present: bin.
- [code-backed] Top-level directory present: docs.
- [code-backed] Top-level directory present: plugins.
- [code-backed] Top-level directory present: scripts.
- [code-backed] Top-level directory present: src.
- [code-backed] Top-level directory present: templates.
- [code-backed] Top-level directory present: tests.

## Runtime Entry Points
- [code-backed] Runtime entry clue found at bin/yxg.js.
- [code-backed] Runtime entry clue found at src/cli/run-cli.js.
- [code-backed] src/validation/index.js is a medium-confidence entry-candidate entrypoint candidate.
- [code-backed] src/commands/index.js is a medium-confidence entry-candidate entrypoint candidate.
- [code-backed] bin/yxg.js is a medium-confidence cli entrypoint candidate.

## Major Modules
- [code-backed] Source code is organized under src/.
- [code-backed] src/ contains: artifacts, cli, codex, commands, fs, git.
- [code-backed] Shared module candidate src/fs/paths.js is imported by 14 local modules.
- [code-backed] Shared module candidate src/fs/atomic-write.js is imported by 13 local modules.
- [code-backed] Shared module candidate src/fs/exists.js is imported by 13 local modules.
- [code-backed] Recent completed work WU-005 (让 yxg-do 在没有 active work 但存在 roadmap/planned next work 时，以意图方式启动下一项，而不是要求用户手写 yxg plan WU-xxx --ready) confirmed touch points src/commands/resume-command.js, src/commands/plan-command.js, plugins/yxg/skills/yxg-do/SKILL.md, docs/CODEX-ADAPTER-SPEC.md, docs/CODEX-DOGFOOD-CHECKLIST.md.

## Key Data Flows
- [code-backed] bin/yxg.js depends on src/cli/run-cli.js.
- [code-backed] scripts/install-codex-adapter.js depends on src/codex/install-adapter.js.
- [code-backed] scripts/verify-codex-adapter.js depends on src/codex/verify-adapter.js.
- [code-backed] Cache-related logic appears in src/commands/import-command.js, src/import/scan.js, tests/init-and-validate.test.js.
- [code-backed] Execution-path candidate: src/validation/index.js -> src/validation/instance-validator.js -> src/artifacts/markdown.js.
- [code-backed] Execution-path candidate: src/validation/index.js -> src/validation/instance-validator.js -> src/artifacts/sections.js.
- [code-backed] Execution-path candidate: src/validation/index.js -> src/validation/instance-validator.js -> src/artifacts/schema.js.
- [code-backed] Recent completed work WU-005 established: 用户 dogfooding 发现：没有 active work 时，Codex 把下一步说成“发 `$yxg:yxg-plan WU-008 --ready` 或直接说开始 WU-008”，这暴露了底层命令，并且不符合 intent-level yxg 使用方式。
- [code-backed] Recent completed work WU-005 established: 当前 `plugins/yxg/skills/yxg-do/SKILL.md` 第 2 步写明“没有 active work 就告诉用户并建议 `$yxg:yxg-plan <task>`”，没有处理 roadmap planned next。
- [code-backed] Recent completed work WU-005 established: 当前 `src/commands/resume-command.js` 只从 active work 和 state narrative 推断 `recommended_work_id`，没有在无 active work 时读取 `.yxg/ROADMAP.md`。

## Boundary Notes
- [code-backed] Documentation and template artifacts are separated from source code.
- [code-backed] Tests are isolated under tests/.
- [code-backed] Executable entry points are separated under bin/.
