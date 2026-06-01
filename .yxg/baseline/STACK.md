---
artifact_type: baseline-stack
schema_version: "1.0"
kernel_version: "1"
id: stack
created_at: "2026-06-01"
updated_at: "2026-06-01"
---

# Stack

## Languages And Runtimes
- [code-backed] JavaScript source files are present.
- [code-backed] Markdown documentation is present.
- [code-backed] package.json sets type=module for ESM execution.
- [code-backed] package.json declares a Node engine range: >=20.

## Frameworks And Libraries
- [code-backed] The Node built-in test runner is referenced by the test script.

## Build And Package Tooling
- [code-backed] package.json defines package metadata and scripts.
- [code-backed] package.json exposes CLI entry points: ./bin/yxg.js.
- [code-backed] Runtime entrypoint candidates were detected: bin/yxg.js, src/commands/index.js, src/validation/index.js.

## Test Stack
- [code-backed] package.json defines a test script.
- [code-backed] The test script uses node --test.
- [code-backed] Test files are present: tests/cli-foundation.test.js, tests/codex-adapter-install.test.js, tests/codex-adapter.test.js.

## Deployment Clues
- [inferred-low-confidence] unknown
