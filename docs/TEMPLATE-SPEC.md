# Template Spec

## Status

- Spec status: draft
- Kernel version: v1

## Purpose

Define the canonical v1 artifact templates used by the `.yxg/` kernel.

These templates are the source material that a future `init` implementation can copy into a project instance under `.yxg/templates/`.

## Canonical Template Source

The canonical template files for this framework repository live in:

```text
templates/yxg/
```

## Template Set

The v1 template set includes:

- `MANIFEST.md`
- `PROJECT.md`
- `STATE.md`
- `INDEX.md`
- `LOG.md`
- `WORK.md`
- `REVIEW.md`
- `HANDOFF.md`
- `ROADMAP.md`
- `STACK.md`
- `ARCHITECTURE.md`
- `CONVENTIONS.md`
- `RISKS.md`
- `IMPORT-SUMMARY.md`

## Template Rules

### Complete Frontmatter

Every template uses full frontmatter with all schema-required fields and any standard artifact-specific fields.

### Short Prompts In Body

Templates include brief instructional prompts under each required section. Prompts should help a human or agent write the artifact without turning the template into a second manual.

### Semantic Placeholder Values

Templates should use placeholders according to meaning:

- `TODO`: required content that still needs author input
- `none`: a valid empty value
- `unknown`: not yet known, but expected to be discovered later

### Single Standard Variant

Each artifact has one standard template in v1. There are no `light`, `standard`, or `complex` variants.

### Baseline Evidence Tags

Baseline templates must demonstrate per-conclusion evidence tags. Allowed tags are:

- `[code-backed]`
- `[doc-backed]`
- `[inferred-low-confidence]`

## Instance Copy Rule

Project instances may copy these templates into:

```text
.yxg/templates/
```

The copied instance templates may keep the same structure and prompts. Project instances should not change the core semantics of the templates in ways that conflict with the kernel spec.
