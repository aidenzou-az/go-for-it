import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { replaceSectionBody, extractSectionBody, extractBulletValues, bulletList } from "../artifacts/sections.js";
import { atomicWriteFile } from "../fs/atomic-write.js";
import { pathExists } from "../fs/exists.js";
import { getWorkArchiveRoot, getYxgRoot } from "../fs/paths.js";
import { createCommandResult } from "../output/result.js";
import { scanRepository } from "../import/scan.js";
import { loadCanonicalTemplate, prepareTemplate, applyFrontmatterValues } from "../templates/core.js";
import { runValidation } from "../validation/index.js";
import {
  appendLogEntry,
  normalizeIndexContent,
  updateStateForWork
} from "./shared-artifacts.js";
import { bootstrapFrameworkInstance } from "./bootstrap-instance.js";
import { parseMarkdownArtifact } from "../artifacts/markdown.js";
import { syncManifestWithRuntime } from "./instance-metadata.js";

export const BASELINE_FILES = [
  "STACK.md",
  "ARCHITECTURE.md",
  "CONVENTIONS.md",
  "RISKS.md",
  "IMPORT-SUMMARY.md"
];

export async function runImportCommand({ repoRoot }) {
  const bootstrap = await bootstrapFrameworkInstance(repoRoot, {
    mode: "merge",
    nextSafeAction: "Allow import to build an onboarding baseline for this existing repository."
  });

  const date = new Date().toISOString().slice(0, 10);
  const refresh = await refreshImportBaseline(repoRoot, { date });
  const changed = [...bootstrap.changed, ...refresh.changed];
  changed.push(
    await updateStateForWork(repoRoot, {
      focus: "import baseline generated",
      workEntries: [],
      nextSafeAction: "Review baseline findings and create the next work unit.",
      checkpointSummary: "Existing-project onboarding completed; the imported baseline is ready to support planning.",
      openRisks: buildImportOperationalRisks(refresh.scan)
    })
  );
  changed.push(
    await appendLogEntry(repoRoot, {
      date,
      eventId: "import",
      summary: "existing repository imported into yxg",
      bullets: [
        bootstrap.changed.length > 0
          ? "Bootstrapped a minimal .yxg instance for existing-project onboarding."
          : "Reused the existing .yxg instance for onboarding.",
        "Generated or refreshed onboarding baseline files under .yxg/baseline/.",
        "Updated project context and adapter metadata from repository evidence."
      ]
    })
  );

  const validation = await runValidation({ repoRoot, scope: "import" });

  return createCommandResult({
    ok: validation.ok,
    command: "import",
    scope: "import",
    artifactsChanged: Array.from(new Set(changed.filter(Boolean))),
    validation: validation.summary,
    message: validation.ok ? "existing-project import completed" : "existing-project import completed with validation errors",
    details: `generated ${BASELINE_FILES.length} baseline artifact(s) from repository evidence${bootstrap.changed.length > 0 ? " and bootstrapped a minimal .yxg instance" : ""}`,
    nextSteps: [
      "Review .yxg/baseline/IMPORT-SUMMARY.md for architecture, dependency, and verification gaps.",
      "Create the next work unit after confirming the imported baseline."
    ],
    data: {
      baseline_files: BASELINE_FILES.map((filename) => `.yxg/baseline/${filename}`),
      evidence_summary: {
        package_json_present: refresh.scan.packageJsonPresent,
        package_json_parsed: Boolean(refresh.scan.packageJson),
        package_json_parse_error: refresh.scan.packageJsonParseError,
        readme_files: refresh.scan.readmeFiles.length,
        docs_files: refresh.scan.docsFiles.length,
        workflow_files: refresh.scan.workflowFiles.length,
        entry_point_files: refresh.scan.entryPointFiles.length,
        env_variables: refresh.scan.envVariableNames.length,
        external_services: refresh.scan.externalServiceHints.length
      },
      findings: validation.findings,
      import_mode: "deep-onboarding",
      bootstrap_mode: bootstrap.changed.length > 0 ? "merge" : "reuse-existing"
    },
    meta: {
      import_mode: "deep-onboarding",
      bootstrap_mode: bootstrap.changed.length > 0 ? "merge" : "reuse-existing"
    }
  });
}

export async function refreshImportBaseline(repoRoot, { date = new Date().toISOString().slice(0, 10), recentWorkIds = [] } = {}) {
  const yxgRoot = getYxgRoot(repoRoot);
  const baselineRoot = path.join(yxgRoot, "baseline");
  await mkdir(baselineRoot, { recursive: true });

  const scan = await scanRepository(repoRoot);
  const workInsights = await collectRecentWorkInsights(repoRoot, recentWorkIds);
  const changed = [];

  for (const filename of BASELINE_FILES) {
    const content = await renderBaselineArtifact(repoRoot, filename, scan, date, workInsights);
    const targetPath = path.join(baselineRoot, filename);
    await atomicWriteFile(targetPath, content);
    changed.push(path.relative(repoRoot, targetPath));
  }

  changed.push(await updateProjectFromImport(repoRoot, scan, workInsights));
  changed.push(...(await updateIndexForBaseline(repoRoot)));
  const manifestPath = await syncManifestWithRuntime(repoRoot);
  if (manifestPath) {
    changed.push(manifestPath);
  }

  return {
    changed: Array.from(new Set(changed.filter(Boolean))),
    scan,
    workInsights
  };
}

async function renderBaselineArtifact(repoRoot, filename, scan, date, workInsights) {
  const template = await loadCanonicalTemplate(repoRoot, filename);
  let content = prepareTemplate(template, { date });

  if (filename === "STACK.md") {
    content = replaceSectionBody(
      content,
      "## Languages And Runtimes",
      bulletList(buildLanguageBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Frameworks And Libraries",
      bulletList(buildFrameworkBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Build And Package Tooling",
      bulletList(buildBuildBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Test Stack",
      bulletList(buildTestBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Deployment Clues",
      bulletList(buildDeploymentBullets(scan))
    );
  }

  if (filename === "ARCHITECTURE.md") {
    content = replaceSectionBody(
      content,
      "## Repository Shape",
      bulletList(buildRepositoryShapeBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Runtime Entry Points",
      bulletList(buildRuntimeEntryBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Major Modules",
      bulletList(buildModuleBullets(scan, workInsights))
    );
    content = replaceSectionBody(
      content,
      "## Key Data Flows",
      bulletList(buildDataFlowBullets(scan, workInsights))
    );
    content = replaceSectionBody(
      content,
      "## Boundary Notes",
      bulletList(buildBoundaryBullets(scan))
    );
  }

  if (filename === "CONVENTIONS.md") {
    content = replaceSectionBody(content, "## Naming", bulletList(buildNamingBullets(scan)));
    content = replaceSectionBody(content, "## Structure", bulletList(buildStructureBullets(scan)));
    content = replaceSectionBody(content, "## Testing", bulletList(buildTestingConventionBullets(scan)));
    content = replaceSectionBody(
      content,
      "## Configuration",
      bulletList(buildConfigurationBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Error Handling And Logging",
      bulletList(buildErrorHandlingBullets(scan, workInsights))
    );
  }

  if (filename === "RISKS.md") {
    content = replaceSectionBody(
      content,
      "## Stale Or Conflicting Documentation",
      bulletList(buildDocumentationRiskBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Weak Boundaries",
      bulletList(buildWeakBoundaryBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Verification Gaps",
      bulletList(buildVerificationGapBullets(scan, workInsights))
    );
    content = replaceSectionBody(
      content,
      "## Sensitive Paths",
      bulletList(buildSensitivePathBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Import Warnings",
      bulletList(buildImportWarningBullets(scan))
    );
  }

  if (filename === "IMPORT-SUMMARY.md") {
    content = replaceSectionBody(
      content,
      "## Evidence Sources",
      bulletList(buildEvidenceSourceBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## High-Confidence Conclusions",
      bulletList(buildHighConfidenceBullets(scan, workInsights))
    );
    content = replaceSectionBody(
      content,
      "## Documentation-Supported Conclusions",
      bulletList(buildDocSupportedBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Low-Confidence Inferences",
      bulletList(buildLowConfidenceBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Conflicts Or Gaps",
      bulletList(buildImportWarningBullets(scan))
    );
    content = replaceSectionBody(
      content,
      "## Recommended Next Safe Action",
      bulletList(buildRecommendedNextSafeActionBullets(scan))
    );
  }

  return content;
}

async function updateProjectFromImport(repoRoot, scan, workInsights) {
  const projectPath = path.join(getYxgRoot(repoRoot), "PROJECT.md");
  const date = new Date().toISOString().slice(0, 10);
  let content = applyFrontmatterValues(await readFile(projectPath, "utf8"), {
    updated_at: date
  });
  const packageName = scan.packageJson?.name;
  const title = packageName ? packageName.replace(/[-_]/g, " ") : "this repository";
  const packageDescription = scan.packageJson?.description;
  const readmeHeading = scan.readmeSummaries[0]?.heading;
  const summary =
    packageDescription
      ? packageDescription
      : readmeHeading && readmeHeading !== "unknown"
        ? `A repository centered on ${readmeHeading}.`
        : `A repository-local framework kernel for ${title}.`;

  content = replaceSectionBody(content, "## One-Sentence Goal", summary);
  content = replaceSectionBody(
    content,
    "## Why This Project Exists",
    packageDescription
      ? `${title} should deliver on "${packageDescription}" while keeping durable repository context available to future sessions and collaborators.`
      : `${title} should preserve project understanding and implementation context in durable repository artifacts instead of relying on chat history alone.`
  );
  content = replaceSectionBody(content, "## Success Criteria", bulletList(buildProjectSuccessCriteria(scan, workInsights)));
  content = replaceSectionBody(
    content,
    "## Non-Negotiable Constraints",
    bulletList(buildProjectConstraints(scan))
  );
  content = replaceSectionBody(
    content,
    "## Product Principles",
    bulletList(buildProjectProductPrinciples(scan))
  );
  content = replaceSectionBody(
    content,
    "## Engineering Principles",
    bulletList(buildProjectEngineeringPrinciples(scan, workInsights))
  );
  content = replaceSectionBody(content, "## Out Of Scope", bulletList(buildProjectOutOfScope(scan)));

  await atomicWriteFile(projectPath, content);
  return path.relative(repoRoot, projectPath);
}

async function updateIndexForBaseline(repoRoot) {
  const indexPath = path.join(getYxgRoot(repoRoot), "INDEX.md");
  let content = normalizeIndexContent(await readFile(indexPath, "utf8"));
  const referenceSection = extractSectionBody(content, "## Reference Knowledge");
  const currentValues = extractBulletValues(referenceSection).filter((value) => value !== "none");
  const baselineEntries = BASELINE_FILES.map((name) => `.yxg/baseline/${name}`);

  for (const entry of baselineEntries) {
    if (!currentValues.includes(entry)) {
      currentValues.push(entry);
    }
  }

  content = replaceSectionBody(content, "## Reference Knowledge", bulletList(currentValues));
  await atomicWriteFile(indexPath, content);

  return [path.relative(repoRoot, indexPath)];
}

function buildLanguageBullets(scan) {
  const extensions = scan.fileExtensions;
  const bullets = [];

  if (extensions.includes(".js")) bullets.push("[code-backed] JavaScript source files are present.");
  if (extensions.includes(".mjs")) bullets.push("[code-backed] ECMAScript module source files are present.");
  if (extensions.includes(".cjs")) bullets.push("[code-backed] CommonJS source files are present.");
  if (extensions.includes(".ts")) bullets.push("[code-backed] TypeScript source files are present.");
  if (extensions.includes(".jsx")) bullets.push("[code-backed] JSX source files are present.");
  if (extensions.includes(".tsx")) bullets.push("[code-backed] TSX source files are present.");
  if (extensions.includes(".md")) bullets.push("[code-backed] Markdown documentation is present.");
  if (scan.packageJson?.type === "module") {
    bullets.push("[code-backed] package.json sets type=module for ESM execution.");
  }
  if (scan.packageJson?.engines?.node) {
    bullets.push(`[code-backed] package.json declares a Node engine range: ${scan.packageJson.engines.node}.`);
  }
  if (bullets.length === 0) bullets.push("[inferred-low-confidence] unknown");

  return bullets;
}

function buildFrameworkBullets(scan) {
  const bullets = [];
  const candidates = [
    ["react", "React"],
    ["next", "Next.js"],
    ["vite", "Vite"],
    ["express", "Express"],
    ["vitest", "Vitest"],
    ["jest", "Jest"],
    ["commander", "Commander"],
    ["yargs", "Yargs"]
  ];

  for (const [packageName, label] of candidates) {
    if (scan.dependencyNames.includes(packageName)) {
      bullets.push(`[code-backed] ${label} is declared in package metadata.`);
    }
  }

  if (scan.hasNodeTestScript) {
    bullets.push("[code-backed] The Node built-in test runner is referenced by the test script.");
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildBuildBullets(scan) {
  const bullets = [];

  if (scan.packageJson) bullets.push("[code-backed] package.json defines package metadata and scripts.");
  if (scan.packageJsonPresent && scan.packageJsonParseError) {
    bullets.push("[code-backed] package.json exists but could not be parsed safely.");
  }
  if (scan.detectedPackageManager !== "unknown") {
    bullets.push(`[code-backed] ${scan.detectedPackageManager} lockfile metadata is present.`);
  }
  if (scan.files.includes("package-lock.json")) bullets.push("[code-backed] npm lockfile is present.");
  if (scan.files.includes("pnpm-lock.yaml")) bullets.push("[code-backed] pnpm lockfile is present.");
  if (scan.files.includes("yarn.lock")) bullets.push("[code-backed] Yarn lockfile is present.");
  if (scan.packageBinEntries.length > 0) {
    bullets.push(
      `[code-backed] package.json exposes CLI entry points: ${scan.packageBinEntries.join(", ")}.`
    );
  }
  if (scan.scriptNames.includes("build")) {
    bullets.push("[code-backed] package.json defines a build script.");
  }
  if (scan.entryPointFiles.length > 0) {
    bullets.push(
      `[code-backed] Runtime entrypoint candidates were detected: ${scan.entryPointFiles.slice(0, 5).join(", ")}.`
    );
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildTestBullets(scan) {
  const bullets = [];

  if (scan.packageJson?.scripts?.test) {
    bullets.push("[code-backed] package.json defines a test script.");
  }

  if (scan.hasNodeTestScript) {
    bullets.push("[code-backed] The test script uses node --test.");
  }

  if (scan.testFiles.length > 0) {
    bullets.push(`[code-backed] Test files are present: ${scan.testFiles.slice(0, 3).join(", ")}.`);
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildDeploymentBullets(scan) {
  const bullets = [];

  if (scan.workflowFiles.length > 0) {
    bullets.push("[doc-backed] GitHub workflow files suggest automated repository workflows.");
  }

  if (scan.deploymentFiles.length > 0) {
    bullets.push(
      `[code-backed] Deployment or packaging clue files are present: ${scan.deploymentFiles.join(", ")}.`
    );
  }
  if (scan.envFiles.length > 0) {
    bullets.push(`[code-backed] Environment or runtime config files are present: ${scan.envFiles.join(", ")}.`);
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildRepositoryShapeBullets(scan) {
  if (scan.topLevelDirectories.length === 0) {
    return ["[inferred-low-confidence] unknown"];
  }

  return scan.topLevelDirectories.map(
    (directory) => `[code-backed] Top-level directory present: ${directory}.`
  );
}

function buildRuntimeEntryBullets(scan) {
  const bullets = [];
  const candidates = new Set(["bin/yxg.js", "src/cli/run-cli.js", "index.js", ...scan.packageBinEntries]);

  for (const candidate of candidates) {
    if (scan.files.includes(candidate)) {
      bullets.push(`[code-backed] Runtime entry clue found at ${candidate}.`);
    }
  }

  if (scan.entryPointCandidates.length > 0) {
    for (const candidate of scan.entryPointCandidates.slice(0, 4)) {
      bullets.push(
        `[code-backed] ${candidate.file} is a ${candidate.confidence}-confidence ${candidate.kind} entrypoint candidate.`
      );
    }
  } else if (scan.entryPointFiles.length > 0) {
    bullets.push(
      `[code-backed] Framework-facing entry files include ${scan.entryPointFiles.slice(0, 6).join(", ")}.`
    );
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildModuleBullets(scan, workInsights) {
  const bullets = [];

  if (scan.topLevelDirectories.includes("src")) {
    bullets.push("[code-backed] Source code is organized under src/.");
  }

  if (scan.srcChildren.length > 0) {
    bullets.push(`[code-backed] src/ contains: ${scan.srcChildren.slice(0, 6).join(", ")}.`);
  }

  for (const entry of scan.localImportGraph.inboundCount.slice(0, 3)) {
    if (entry.count >= 2) {
      bullets.push(
        `[code-backed] Shared module candidate ${entry.file} is imported by ${entry.count} local modules.`
      );
    }
  }

  for (const group of scan.linkedSurfaceGroups.slice(0, 2)) {
    bullets.push(
      `[code-backed] ${group.sharedModule} links multiple visible surfaces: ${group.surfaces.join(", ")}.`
    );
  }

  bullets.push(...workInsights.moduleBullets);

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildBoundaryBullets(scan) {
  const bullets = [];

  if (scan.topLevelDirectories.includes("docs") && scan.topLevelDirectories.includes("templates")) {
    bullets.push("[code-backed] Documentation and template artifacts are separated from source code.");
  }

  if (scan.topLevelDirectories.includes("tests")) {
    bullets.push("[code-backed] Tests are isolated under tests/.");
  }

  if (scan.topLevelDirectories.includes("bin")) {
    bullets.push("[code-backed] Executable entry points are separated under bin/.");
  }

  if (scan.topLevelDirectories.includes("functions") && scan.topLevelDirectories.includes("lib")) {
    bullets.push("[code-backed] Runtime handlers under functions/ appear to consume shared logic from lib/.");
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildDataFlowBullets(scan, workInsights) {
  const bullets = [];
  const functionToLibEdges = scan.localImportGraph.edges.filter(
    (edge) => edge.from.startsWith("functions/") && edge.to.startsWith("lib/")
  );
  const crossModuleEdges = scan.localImportGraph.edges.filter((edge) => {
    const fromTop = edge.from.split("/")[0];
    const toTop = edge.to.split("/")[0];
    return fromTop !== toTop;
  });
  const functionToFunctionEdges = scan.localImportGraph.edges.filter(
    (edge) => edge.from.startsWith("functions/") && edge.to.startsWith("functions/")
  );

  for (const edge of functionToLibEdges.slice(0, 3)) {
    bullets.push(`[code-backed] ${edge.from} imports shared logic from ${edge.to}.`);
  }

  for (const edge of functionToFunctionEdges.slice(0, 3)) {
    const line = `[code-backed] ${edge.from} depends on ${edge.to}.`;
    if (!bullets.includes(line)) {
      bullets.push(line);
    }
  }

  if (bullets.length === 0) {
    for (const edge of crossModuleEdges.slice(0, 3)) {
      const line = `[code-backed] ${edge.from} depends on ${edge.to}.`;
      if (!bullets.includes(line)) {
        bullets.push(line);
      }
    }
  }

  if (scan.cacheHints.length > 0) {
    bullets.push(
      `[code-backed] Cache-related logic appears in ${scan.cacheHints.slice(0, 4).join(", ")}.`
    );
  }

  for (const chain of scan.executionChains.slice(0, 3)) {
    bullets.push(
      `[code-backed] Execution-path candidate: ${chain.chain}.`
    );
  }

  bullets.push(...workInsights.dataFlowBullets);

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildNamingBullets(scan) {
  const bullets = [];

  if (scan.files.some((file) => file.includes("-"))) {
    bullets.push("[code-backed] Hyphenated file names are used in the repository.");
  }

  if (scan.testFiles.some((file) => file.includes(".test."))) {
    bullets.push("[code-backed] .test.* naming is used for automated tests.");
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildStructureBullets(scan) {
  const bullets = [];

  if (scan.topLevelDirectories.includes("src")) {
    bullets.push("[code-backed] Repository uses a dedicated src/ directory for implementation code.");
  }

  if (scan.topLevelDirectories.includes("docs")) {
    bullets.push("[code-backed] Repository uses docs/ for durable documentation.");
  }

  if (scan.topLevelDirectories.includes("templates")) {
    bullets.push("[code-backed] Repository uses templates/ for canonical artifact templates.");
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildTestingConventionBullets(scan) {
  const bullets = [];

  if (scan.files.some((file) => file.startsWith("tests/"))) {
    bullets.push("[code-backed] Tests are grouped under tests/.");
  }

  if (scan.hasNodeTestScript) {
    bullets.push("[code-backed] The repository standardizes on node --test in package scripts.");
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildConfigurationBullets(scan) {
  const bullets = [];

  if (scan.packageJson) {
    bullets.push("[code-backed] package.json is a central configuration artifact.");
  }

  if (scan.configFiles.length > 0) {
    bullets.push(`[code-backed] Configuration files are present: ${scan.configFiles.join(", ")}.`);
  }

  if (scan.workflowFiles.length > 0) {
    bullets.push("[doc-backed] Workflow definitions under .github/workflows influence repository automation.");
  }
  if (scan.envVariableNames.length > 0) {
    bullets.push(
      `[code-backed] Environment variables referenced in code include: ${scan.envVariableNames.slice(0, 8).join(", ")}.`
    );
  }
  if (scan.envFiles.length > 0) {
    bullets.push(`[code-backed] Environment/config files were detected: ${scan.envFiles.join(", ")}.`);
  }
  if (scan.configHints.length > 0) {
    bullets.push(
      `[code-backed] Configuration-sensitive modules include: ${scan.configHints.slice(0, 5).join(", ")}.`
    );
  }
  for (const [variable, files] of Object.entries(scan.envVariableUsage).slice(0, 4)) {
    bullets.push(
      `[code-backed] ${variable} influences runtime behavior in ${files.slice(0, 3).join(", ")}.`
    );
  }
  for (const hint of scan.envFallbackHints.slice(0, 3)) {
    bullets.push(
      `[code-backed] ${hint.file} applies a ${hint.operator} fallback when reading ${hint.variable}.`
    );
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildErrorHandlingBullets(scan, workInsights) {
  const bullets = [];

  if (scan.externalDependencyDetails.some((dependency) => dependency.hasFailureHandling)) {
    const handled = scan.externalDependencyDetails
      .filter((dependency) => dependency.hasFailureHandling)
      .slice(0, 2)
      .map((dependency) => dependency.service);
    bullets.push(
      `[code-backed] Explicit catch or failure-handling paths exist around external dependencies such as ${handled.join(", ")}.`
    );
  }
  if (scan.externalDependencyDetails.some((dependency) => dependency.hasFallbackBehavior)) {
    const fallbackServices = scan.externalDependencyDetails
      .filter((dependency) => dependency.hasFallbackBehavior)
      .slice(0, 2)
      .map((dependency) => dependency.service);
    bullets.push(
      `[code-backed] Some runtime paths appear to degrade gracefully when ${fallbackServices.join(", ")} fails or returns incomplete data.`
    );
  }

  bullets.push(...workInsights.errorHandlingBullets);

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildDocumentationRiskBullets(scan) {
  const legacyDocs = scan.docsFiles.filter((file) =>
    ["docs/FRAMEWORK.md", "docs/OPERATING_MODEL.md"].includes(file)
  );
  const bullets = [];

  if (legacyDocs.length > 0) {
    bullets.push(
      ...legacyDocs.map((file) => `[doc-backed] Legacy exploratory draft still present at ${file}.`)
    );
  }

  if (scan.readmeFiles.length === 0) {
    bullets.push("[doc-backed] README files are absent, which weakens project-intent import confidence.");
  }

  return bullets.length > 0 ? bullets : ["[doc-backed] none"];
}

function buildVerificationGapBullets(scan, workInsights) {
  const bullets = [];

  if (!scan.packageJson?.scripts?.test) {
    bullets.push("[code-backed] No explicit test script was detected in package.json.");
  }

  if (scan.testFiles.length === 0) {
    bullets.push("[code-backed] No test files were detected from repository file names.");
  }
  if (scan.workflowFiles.length === 0) {
    bullets.push("[inferred-low-confidence] No CI workflow files were detected, so automated verification coverage is unclear.");
  }
  if (scan.verificationSignals.manual.length > 0) {
    bullets.push(
      `[code-backed] Manual verification still matters for ${scan.verificationSignals.manual
        .slice(0, 2)
        .map((line) => line.replace(/\.$/, ""))
        .join("; ")}.`
    );
  }

  bullets.push(...workInsights.verificationGapBullets);

  return bullets.length > 0 ? bullets : ["[code-backed] none"];
}

function buildWeakBoundaryBullets(scan) {
  const bullets = [];

  for (const group of scan.linkedSurfaceGroups.slice(0, 3)) {
    bullets.push(
      `[code-backed] ${group.sharedModule} is a shared boundary between ${group.surfaces.join(", ")}; changes there can fan out across multiple visible surfaces.`
    );
  }

  const sharedCore = scan.localImportGraph.inboundCount.filter((entry) => entry.count >= 3).slice(0, 2);
  for (const entry of sharedCore) {
    bullets.push(
      `[code-backed] ${entry.file} is heavily shared across ${entry.count} local modules, so its boundary is high leverage.`
    );
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildSensitivePathBullets(scan) {
  const bullets = [];

  if (scan.files.some((file) => file.startsWith(".git/"))) {
    bullets.push("[code-backed] .git metadata exists and should not be modified casually.");
  }

  bullets.push("[code-backed] .yxg/ is a framework state root and should be updated intentionally.");
  return bullets;
}

function buildImportWarningBullets(scan) {
  const bullets = [];

  if (!scan.packageJsonPresent) {
    bullets.push("[inferred-low-confidence] package.json is absent, so stack inference is limited.");
  }

  if (scan.packageJsonParseError) {
    bullets.push("[code-backed] package.json could not be parsed, so metadata-derived conclusions were reduced.");
  }

  if (scan.readmeFiles.length === 0) {
    bullets.push("[doc-backed] README files are absent, so project-intent inference is limited.");
  }

  if (scan.workflowFiles.length === 0 && scan.deploymentFiles.length === 0) {
    bullets.push("[inferred-low-confidence] No deployment or CI clue files were detected.");
  }
  if (scan.localImportGraph.edges.length === 0) {
    bullets.push("[inferred-low-confidence] No local module import graph could be derived from repository source files.");
  }
  if (scan.executionChains.length === 0) {
    bullets.push("[inferred-low-confidence] No concrete execution-path narrative could be derived from the current code graph.");
  }
  if (scan.verificationSignals.automated.length === 0 && scan.verificationSignals.manual.length === 0) {
    bullets.push("[inferred-low-confidence] Verification routes remain unclear from repository evidence.");
  }
  for (const dependency of scan.externalDependencyDetails.slice(0, 2)) {
    if (!dependency.hasFailureHandling) {
      bullets.push(
        `[inferred-low-confidence] ${dependency.service} appears in ${dependency.files.slice(0, 2).join(", ")} without clear failure handling.`
      );
    }
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildEvidenceSourceBullets(scan) {
  const bullets = ["[code-backed] Source tree and repository file structure were scanned."];

  if (scan.packageJson) {
    bullets.push("[code-backed] package.json and related metadata were inspected.");
  } else if (scan.packageJsonPresent) {
    bullets.push("[code-backed] package.json was detected but not parsed due to invalid JSON.");
  }

  if (scan.readmeFiles.length > 0 || scan.docsFiles.length > 0) {
    bullets.push("[doc-backed] Repository documentation files were inspected.");
  }

  if (scan.agentsFiles.length > 0) {
    bullets.push("[doc-backed] AGENTS.md guidance files were inspected.");
  }

  if (scan.workflowFiles.length > 0) {
    bullets.push("[doc-backed] CI or workflow definitions were inspected.");
  }
  if (scan.localImportGraph.edges.length > 0) {
    bullets.push("[code-backed] Local module import relationships were derived from source files.");
  }
  if (scan.envVariableNames.length > 0) {
    bullets.push("[code-backed] Environment variable references were extracted from source files.");
  }

  return bullets;
}

function buildHighConfidenceBullets(scan, workInsights) {
  const bullets = [];

  if (scan.packageJson?.name) {
    bullets.push(`[code-backed] package.json identifies the package as ${scan.packageJson.name}.`);
  }

  if (scan.topLevelDirectories.length > 0) {
    bullets.push(
      `[code-backed] Top-level directories include ${scan.topLevelDirectories.slice(0, 4).join(", ")}.`
    );
  }

  if (scan.detectedPackageManager !== "unknown") {
    bullets.push(`[code-backed] Repository lockfiles indicate ${scan.detectedPackageManager} as a package manager.`);
  }

  if (scan.packageBinEntries.length > 0) {
    bullets.push(`[code-backed] package.json exposes runtime entry paths via bin: ${scan.packageBinEntries.join(", ")}.`);
  }
  if (scan.entryPointFiles.length > 0) {
    bullets.push(
      `[code-backed] Runtime entrypoint candidates include ${scan.entryPointFiles.slice(0, 4).join(", ")}.`
    );
  }
  if (scan.externalServiceHints.length > 0) {
    bullets.push(
      `[code-backed] Source files reference external services including ${scan.externalServiceHints.join(", ")}.`
    );
  }
  if (scan.executionChains.length > 0) {
    bullets.push(
      `[code-backed] A concrete execution path can already be traced, for example ${scan.executionChains[0].chain}.`
    );
  }
  if (scan.verificationSignals.automated.length > 0) {
    bullets.push(
      `[code-backed] Automated verification clues exist: ${scan.verificationSignals.automated[0]}`
    );
  }

  bullets.push(...workInsights.summaryBullets);

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildDocSupportedBullets(scan) {
  const bullets = [];

  if (scan.readmeSummaries.length > 0) {
    bullets.push(
      ...scan.readmeSummaries.map((summary) => `[doc-backed] ${summary.file} is titled "${summary.heading}".`)
    );
  }

  if (scan.agentsSummaries.length > 0) {
    bullets.push(
      ...scan.agentsSummaries.map(
        (summary) => `[doc-backed] ${summary.file} provides agent guidance titled "${summary.heading}".`
      )
    );
  }

  return bullets.length > 0 ? bullets : ["[doc-backed] unknown"];
}

function buildLowConfidenceBullets(scan) {
  const bullets = [];
  const primaryReadme = scan.readmeSummaries[0];

  if (scan.packageJson?.description) {
    bullets.push(
      `[inferred-low-confidence] package.json suggests the repository purpose is: ${scan.packageJson.description}.`
    );
  } else if (primaryReadme?.heading && primaryReadme.heading !== "unknown") {
    bullets.push(
      `[inferred-low-confidence] README suggests the repository centers on "${primaryReadme.heading}".`
    );
  }

  if (scan.binChildren.length > 0 && scan.topLevelDirectories.includes("src")) {
    bullets.push(
      "[inferred-low-confidence] The repository likely exposes a CLI wrapper over implementation code."
    );
  }
  const libConsumerEdges = scan.localImportGraph.edges.filter(
    (edge) => edge.from.startsWith("functions/") && edge.to.startsWith("lib/")
  );
  if (libConsumerEdges.length > 0) {
    bullets.push(
      "[inferred-low-confidence] Request-facing modules under functions/ likely compose shared domain logic from lib/ modules."
    );
  }
  if (scan.envVariableNames.length > 0) {
    bullets.push(
      `[inferred-low-confidence] Runtime behavior likely depends on environment bindings such as ${scan.envVariableNames.slice(0, 4).join(", ")}.`
    );
  }
  for (const dependency of scan.externalDependencyDetails.slice(0, 2)) {
    if (!dependency.hasFailureHandling) {
      bullets.push(
        `[inferred-low-confidence] ${dependency.service} usage in ${dependency.files.slice(0, 2).join(", ")} may be on the critical path without explicit failure handling.`
      );
    } else if (!dependency.hasFallbackBehavior) {
      bullets.push(
        `[inferred-low-confidence] ${dependency.service} calls appear to be caught, but fallback behavior is not obvious from ${dependency.files.slice(0, 2).join(", ")}.`
      );
    }
  }
  if (scan.verificationSignals.manual.length > 0) {
    bullets.push(
      `[inferred-low-confidence] Manual verification likely needs to cover ${scan.verificationSignals.manual
        .slice(0, 2)
        .map((line) => line.replace(/^Manual runtime verification likely needs to exercise /, "").replace(/\.$/, ""))
        .join(" and ")}.`
    );
  }

  return bullets.length > 0 ? bullets : ["[inferred-low-confidence] unknown"];
}

function buildRecommendedNextSafeActionBullets(scan) {
  const bullets = [];

  if (scan.verificationSignals.manual.length > 0) {
    bullets.push(
      `[code-backed] Confirm the likely manual verification surfaces before the next feature plan: ${scan.verificationSignals.manual
        .slice(0, 2)
        .map((line) => line.replace(/\.$/, ""))
        .join("; ")}.`
    );
  }
  if (scan.externalDependencyDetails.some((dependency) => !dependency.hasFailureHandling)) {
    const critical = scan.externalDependencyDetails
      .filter((dependency) => !dependency.hasFailureHandling)
      .slice(0, 2)
      .map((dependency) => dependency.service)
      .join(", ");
    bullets.push(
      `[inferred-low-confidence] Validate failure and fallback behavior around external dependencies such as ${critical} before widening future work scope.`
    );
  }
  if (scan.executionChains.length > 0) {
    bullets.push(
      `[code-backed] Use the traced execution path ${scan.executionChains[0].chain} as the starting context for the next planned feature.`
    );
  }

  return bullets.length > 0
    ? bullets
    : ["[inferred-low-confidence] Review the baseline and create the next work unit."];
}

function buildImportOperationalRisks(scan) {
  const risks = [];

  if (scan.executionChains.length === 0) {
    risks.push("Execution-path understanding is still incomplete for some runtime surfaces.");
  }
  if (scan.verificationSignals.manual.length > 0 && scan.verificationSignals.automated.length === 0) {
    risks.push("Manual verification is still required for the primary visible surfaces.");
  }
  if (scan.externalDependencyDetails.some((dependency) => !dependency.hasFailureHandling)) {
    risks.push("At least one external dependency still lacks obvious failure-handling in the imported code path.");
  }

  return risks.length > 0 ? risks : ["none"];
}

function buildProjectSuccessCriteria(scan, workInsights) {
  const criteria = [];

  if (scan.entryPointCandidates.length > 0) {
    criteria.push(
      `The primary runtime surfaces remain healthy across ${scan.entryPointCandidates
        .slice(0, 3)
        .map((candidate) => candidate.file)
        .join(", ")}.`
    );
  }
  if (scan.externalServiceHints.length > 0) {
    criteria.push(`External integrations such as ${scan.externalServiceHints.join(", ")} continue to return usable data.`);
  }
  if (scan.verificationSignals.manual.length > 0 || scan.verificationSignals.automated.length > 0) {
    criteria.push("The repository has a clear verification path for future feature work.");
  }
  if (workInsights.summaryBullets.length > 0) {
    criteria.push("Completed work continues to harden the shared baseline instead of leaving new knowledge only in chat.");
  }

  return criteria.length > 0 ? criteria : ["Imported baseline stays accurate enough to support the next planned feature."];
}

function buildProjectConstraints(scan) {
  const constraints = [];

  if (scan.envVariableNames.length > 0) {
    constraints.push(`Runtime behavior depends on environment bindings such as ${scan.envVariableNames.slice(0, 4).join(", ")}.`);
  }
  if (scan.externalServiceHints.length > 0) {
    constraints.push(`External service contracts with ${scan.externalServiceHints.join(", ")} constrain feature behavior and fallbacks.`);
  }
  if (scan.linkedSurfaceGroups.length > 0) {
    constraints.push("Changes to shared modules must preserve consistency across linked visible surfaces.");
  }

  return constraints.length > 0 ? constraints : ["Preserve the current runtime contract while evolving the repository."];
}

function buildProjectProductPrinciples(scan) {
  const principles = [];

  if (scan.linkedSurfaceGroups.length > 0) {
    principles.push("Keep shared user-visible outputs consistent when multiple surfaces consume the same project data.");
  }
  if (scan.externalServiceHints.length > 0) {
    principles.push("Degrade gracefully when upstream data is incomplete or temporarily unavailable.");
  }
  principles.push("Prefer small, legible feature changes over scope creep during iterative development.");

  return principles;
}

function buildProjectEngineeringPrinciples(scan, workInsights) {
  const principles = [];

  if (scan.localImportGraph.inboundCount.some((entry) => entry.count >= 2)) {
    principles.push("Preserve shared module boundaries instead of duplicating logic across runtime surfaces.");
  }
  if (scan.verificationSignals.manual.length > 0 || workInsights.verificationGapBullets.length > 0) {
    principles.push("Record concrete verification evidence in durable artifacts before closing work.");
  }
  if (scan.externalDependencyDetails.length > 0) {
    principles.push("Treat external dependency failure modes as first-class implementation concerns.");
  }

  return principles.length > 0 ? principles : ["Keep implementation changes bounded, explicit, and verifiable."];
}

function buildProjectOutOfScope(scan) {
  const outOfScope = [];

  if (scan.readmeSummaries[0]?.heading && scan.readmeSummaries[0].heading !== "unknown") {
    outOfScope.push(`Do not silently expand the project beyond the repository's stated focus: ${scan.readmeSummaries[0].heading}.`);
  }
  outOfScope.push("Do not rely on chat history as the only source of project understanding.");
  outOfScope.push("Do not mix unrelated repository cleanup into ordinary feature work without making it explicit.");

  return outOfScope;
}

async function collectRecentWorkInsights(repoRoot, recentWorkIds) {
  const archiveRoot = getWorkArchiveRoot(repoRoot);
  const insight = {
    moduleBullets: [],
    dataFlowBullets: [],
    verificationGapBullets: [],
    errorHandlingBullets: [],
    summaryBullets: []
  };

  if (recentWorkIds.length === 0 || !(await pathExists(archiveRoot))) {
    return insight;
  }

  const files = await readDirectorySafe(archiveRoot);
  const archiveFiles = recentWorkIds.map((workId) => {
    const filename = `${workId}-`;
    const match = files.find((entry) => entry.startsWith(filename));
    return match ? path.join(archiveRoot, match) : null;
  });

  for (const filePath of archiveFiles.filter(Boolean)) {
    const content = await readFile(filePath, "utf8");
    const parsed = parseMarkdownArtifact(content);
    const workId = parsed.frontmatter.id ?? path.basename(filePath, path.extname(filePath));
    const title = parsed.frontmatter.title ?? workId;
    const touchPoints = extractBulletValues(extractSectionBody(content, "## Expected Touch Points")).filter(
      (value) => value !== "none"
    );
    const evidence = extractBulletValues(extractSectionBody(content, "## Evidence Log")).filter(
      (value) => value !== "none"
    );
    const verification = extractBulletValues(extractSectionBody(content, "## Verification")).filter(
      (value) => value !== "none"
    );
    const risks = extractBulletValues(extractSectionBody(content, "## Risks")).filter(
      (value) => value !== "none"
    );

    if (touchPoints.length > 0) {
      insight.moduleBullets.push(
        `[code-backed] Recent completed work ${workId} (${title}) confirmed touch points ${touchPoints
          .slice(0, 5)
          .join(", ")}.`
      );
      insight.summaryBullets.push(
        `[code-backed] Recent completed work ${workId} (${title}) added durable knowledge about ${touchPoints
          .slice(0, 3)
          .join(", ")}.`
      );
    }

    for (const line of evidence.slice(0, 3)) {
      insight.dataFlowBullets.push(`[code-backed] Recent completed work ${workId} established: ${line}`);
    }

    if (verification.length > 0) {
      insight.verificationGapBullets.push(
        `[code-backed] Recent completed work ${workId} validated ${verification.slice(0, 2).join("; ")}.`
      );
    }

    for (const risk of risks.slice(0, 2)) {
      insight.errorHandlingBullets.push(
        `[code-backed] Recent completed work ${workId} flagged an operational risk: ${risk}`
      );
    }
  }

  for (const key of Object.keys(insight)) {
    insight[key] = Array.from(new Set(insight[key]));
  }

  return insight;
}

async function readDirectorySafe(targetPath) {
  if (!(await pathExists(targetPath))) {
    return [];
  }

  return readdir(targetPath);
}
