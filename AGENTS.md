# Agent Entry Point

This repository is designing a reusable AI development framework kernel.

Keep durable state in `.yxg/` artifacts when a project instance exists. Do not rely on chat history as durable memory.

## Read Order

1. `.yxg/INDEX.md` if present
2. `.yxg/PROJECT.md` if present
3. `.yxg/STATE.md` if present
4. active work, review, handoff, roadmap, or baseline artifacts referenced from the index
5. framework specs in `docs/` when working on the kernel itself

## Current Sources Of Truth

- Kernel definition: `docs/FRAMEWORK-SPEC.md`
- Artifact contracts: `docs/ARTIFACT-SCHEMAS.md`
- Command semantics: `docs/WORKFLOW-COMMANDS.md`
- Default scaffold: `docs/SCAFFOLD-SPEC.md`
- Template rules: `docs/TEMPLATE-SPEC.md`
- Validator rules: `docs/VALIDATOR-SPEC.md`
- Tooling contract: `docs/TOOLING-CONTRACT.md`
- Git integration: `docs/GIT-INTEGRATION-SPEC.md`
- Codex adapter: `docs/CODEX-ADAPTER-SPEC.md`
- Codex dogfood flow: `docs/CODEX-DOGFOOD-CHECKLIST.md`
- Import enhancement roadmap: `docs/IMPORT-ENHANCEMENT-ROADMAP.md`
- Supporting rationale: `docs/SOURCES.md`

## Working Rules

- Write durable decisions into repository artifacts, not only into chat.
- All work units require review before they can be considered done.
- Write a handoff before context reset or session end when the next safe step is not obvious.
- Keep `AGENTS.md` short; do not duplicate the framework manual here.
