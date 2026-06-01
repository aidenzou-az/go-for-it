export const COMMON_FRONTMATTER_FIELDS = [
  "artifact_type",
  "schema_version",
  "kernel_version",
  "id",
  "created_at",
  "updated_at"
];

export const ARTIFACT_SCHEMAS = {
  manifest: {
    requiredFrontmatter: [
      "instance_name",
      "instance_status",
      "default_artifact_schema_version",
      "preferred_adapter",
      "adapter_version"
    ],
    requiredHeadings: ["# Manifest", "## Kernel", "## Migrations", "## Local Overrides"]
  },
  project: {
    requiredFrontmatter: ["status"],
    requiredHeadings: [
      "# Project",
      "## One-Sentence Goal",
      "## Why This Project Exists",
      "## Success Criteria",
      "## Non-Negotiable Constraints",
      "## Product Principles",
      "## Engineering Principles",
      "## Out Of Scope"
    ]
  },
  state: {
    requiredFrontmatter: ["current_status"],
    requiredHeadings: [
      "# State",
      "## Current Focus",
      "## Active Work",
      "## Last Safe Checkpoint",
      "## Open Risks",
      "## Next Safe Action"
    ]
  },
  index: {
    requiredFrontmatter: [],
    requiredHeadings: [
      "# Index",
      "## Core Artifacts",
      "## Current Operations",
      "## Reference Knowledge",
      "## Archive / History",
      "## Update Rule"
    ]
  },
  log: {
    requiredFrontmatter: ["append_only"],
    requiredHeadings: ["# Log"]
  },
  work: {
    requiredFrontmatter: ["slug", "title", "status", "priority", "owner_role"],
    requiredHeadings: [
      "# Work Unit",
      "## Objective",
      "## In Scope",
      "## Out Of Scope",
      "## Expected Touch Points",
      "## Dependencies",
      "## Assumptions",
      "## Risks",
      "## Plan",
      "## Verification",
      "## Done When",
      "## Escalate If",
      "## Evidence Log",
      "## Notes"
    ]
  },
  review: {
    requiredFrontmatter: ["target_work_id", "verdict"],
    requiredHeadings: [
      "# Review",
      "## Scope Under Review",
      "## Contract",
      "## Findings",
      "## Verification Results",
      "## Verdict",
      "## Follow-Up"
    ]
  },
  handoff: {
    requiredFrontmatter: ["target_work_id", "handoff_status"],
    requiredHeadings: [
      "# Handoff",
      "## Current Objective",
      "## Completed So Far",
      "## Current State",
      "## Exact Next Steps",
      "## Blockers And Open Questions",
      "## Resume Context"
    ]
  },
  roadmap: {
    requiredFrontmatter: ["status"],
    requiredHeadings: ["# Roadmap", "## Now", "## Next", "## Later", "## Deferred"]
  },
  "baseline-stack": {
    requiredFrontmatter: [],
    requiredHeadings: [
      "# Stack",
      "## Languages And Runtimes",
      "## Frameworks And Libraries",
      "## Build And Package Tooling",
      "## Test Stack",
      "## Deployment Clues"
    ]
  },
  "baseline-architecture": {
    requiredFrontmatter: [],
    requiredHeadings: [
      "# Architecture",
      "## Repository Shape",
      "## Runtime Entry Points",
      "## Major Modules",
      "## Key Data Flows",
      "## Boundary Notes"
    ]
  },
  "baseline-conventions": {
    requiredFrontmatter: [],
    requiredHeadings: [
      "# Conventions",
      "## Naming",
      "## Structure",
      "## Testing",
      "## Configuration",
      "## Error Handling And Logging"
    ]
  },
  "baseline-risks": {
    requiredFrontmatter: [],
    requiredHeadings: [
      "# Risks",
      "## Stale Or Conflicting Documentation",
      "## Weak Boundaries",
      "## Verification Gaps",
      "## Sensitive Paths",
      "## Import Warnings"
    ]
  },
  "baseline-import-summary": {
    requiredFrontmatter: [],
    requiredHeadings: [
      "# Import Summary",
      "## Evidence Sources",
      "## High-Confidence Conclusions",
      "## Documentation-Supported Conclusions",
      "## Low-Confidence Inferences",
      "## Conflicts Or Gaps",
      "## Recommended Next Safe Action"
    ]
  }
};

export const ALLOWED_LOCAL_OVERRIDE_KEYS = [
  "roadmap_enabled",
  "handoff_enabled",
  "cleanup_mode",
  "import_mode",
  "baseline_enabled",
  "index_refresh_mode"
];

export const ALLOWED_OVERRIDE_VALUES = {
  cleanup_mode: ["manual", "suggest", "auto_safe"],
  import_mode: ["deep-onboarding"],
  index_refresh_mode: ["manual", "on_write", "on_command"]
};

export const WORK_STATUS_VALUES = ["draft", "ready", "active", "monitoring", "blocked", "review", "done"];

export const BASELINE_TEMPLATE_FILES = [
  "STACK.md",
  "ARCHITECTURE.md",
  "CONVENTIONS.md",
  "RISKS.md",
  "IMPORT-SUMMARY.md"
];

export const BASELINE_EVIDENCE_TAGS = [
  "[code-backed]",
  "[doc-backed]",
  "[inferred-low-confidence]"
];
