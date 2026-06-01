---
artifact_type: baseline-risks
schema_version: "1.0"
kernel_version: "1"
id: risks
created_at: "2026-06-01"
updated_at: "2026-06-01"
---

# Risks

## Stale Or Conflicting Documentation
- [doc-backed] Legacy exploratory draft still present at docs/FRAMEWORK.md.
- [doc-backed] Legacy exploratory draft still present at docs/OPERATING_MODEL.md.
- [doc-backed] README files are absent, which weakens project-intent import confidence.

## Weak Boundaries
- [code-backed] src/fs/paths.js is heavily shared across 14 local modules, so its boundary is high leverage.
- [code-backed] src/fs/atomic-write.js is heavily shared across 13 local modules, so its boundary is high leverage.

## Verification Gaps
- [inferred-low-confidence] No CI workflow files were detected, so automated verification coverage is unclear.
- [code-backed] Recent completed work WU-005 validated node --test tests/init-and-validate.test.js tests/codex-adapter.test.js; node --test.

## Sensitive Paths
- [code-backed] .yxg/ is a framework state root and should be updated intentionally.

## Import Warnings
- [doc-backed] README files are absent, so project-intent inference is limited.
- [inferred-low-confidence] No deployment or CI clue files were detected.
