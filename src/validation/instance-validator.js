import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseMarkdownArtifact } from "../artifacts/markdown.js";
import { extractBulletValues, extractSectionBody } from "../artifacts/sections.js";
import {
  ALLOWED_LOCAL_OVERRIDE_KEYS,
  ALLOWED_OVERRIDE_VALUES,
  ARTIFACT_SCHEMAS,
  BASELINE_EVIDENCE_TAGS,
  BASELINE_TEMPLATE_FILES,
  COMMON_FRONTMATTER_FIELDS,
  WORK_STATUS_VALUES
} from "../artifacts/schema.js";
import { pathExists } from "../fs/exists.js";
import {
  getCanonicalTemplatesRoot,
  getInstanceTemplatesRoot,
  getWorkActiveRoot,
  getYxgRoot
} from "../fs/paths.js";
import { CANONICAL_TEMPLATE_FILES } from "../templates/catalog.js";
import { createFinding, createValidationResult } from "./findings.js";

const REQUIRED_CORE_FILES = ["MANIFEST.md", "PROJECT.md", "STATE.md", "INDEX.md", "LOG.md"];

export async function validateInstance(repoRoot) {
  const findings = [];
  const yxgRoot = getYxgRoot(repoRoot);

  if (!(await pathExists(yxgRoot))) {
    findings.push(
      createFinding({
        level: "error",
        ruleId: "CORE-ARTIFACT-001",
        artifact: yxgRoot,
        message: "Missing .yxg/ root directory.",
        suggestedFix: "Run yxg init to create the framework scaffold."
      })
    );

    return createValidationResult("instance", findings);
  }

  for (const filename of REQUIRED_CORE_FILES) {
    const filePath = path.join(yxgRoot, filename);

    if (!(await pathExists(filePath))) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: "CORE-ARTIFACT-001",
          artifact: filePath,
          message: `Missing required artifact ${filename}.`,
          suggestedFix: `Create ${filename} from the canonical template.`
        })
      );
    }
  }

  const workActiveRoot = getWorkActiveRoot(repoRoot);

  if (!(await pathExists(workActiveRoot))) {
    findings.push(
      createFinding({
        level: "error",
        ruleId: "CORE-ARTIFACT-002",
        artifact: workActiveRoot,
        message: "Missing required .yxg/work/active directory.",
        suggestedFix: "Create .yxg/work/active as part of the standard scaffold."
      })
    );
  }

  if (findings.some((finding) => finding.level === "error")) {
    return createValidationResult("instance", findings);
  }

  findings.push(...(await validateArtifactFile(path.join(yxgRoot, "MANIFEST.md"), "manifest")));
  findings.push(...(await validateArtifactFile(path.join(yxgRoot, "PROJECT.md"), "project")));
  findings.push(...(await validateArtifactFile(path.join(yxgRoot, "STATE.md"), "state")));
  findings.push(...(await validateArtifactFile(path.join(yxgRoot, "INDEX.md"), "index")));
  findings.push(...(await validateArtifactFile(path.join(yxgRoot, "LOG.md"), "log")));
  findings.push(...(await validateManifestOverrides(path.join(yxgRoot, "MANIFEST.md"))));
  findings.push(...(await validateStateFile(repoRoot, path.join(yxgRoot, "STATE.md"))));
  findings.push(...(await validateIndexFile(repoRoot, path.join(yxgRoot, "INDEX.md"))));

  return createValidationResult("instance", findings);
}

export async function validateWork(repoRoot, workId) {
  const findings = [];
  const workActiveRoot = getWorkActiveRoot(repoRoot);

  if (!(await pathExists(workActiveRoot))) {
    findings.push(
      createFinding({
        level: "error",
        ruleId: "CORE-ARTIFACT-002",
        artifact: workActiveRoot,
        message: "Missing required .yxg/work/active directory.",
        suggestedFix: "Run yxg init or restore the work scaffold."
      })
    );
    return createValidationResult("work", findings);
  }

  const workFiles = await readdir(workActiveRoot);
  const targetFile = workFiles.find((filename) => filename.startsWith(`${workId}-`) || filename === workId);

  if (!targetFile) {
    findings.push(
      createFinding({
        level: "error",
        ruleId: "STATE-002",
        artifact: workId,
        message: `No active work artifact found for ${workId}.`,
        suggestedFix: "Create the work unit first or use the correct work ID."
      })
    );
    return createValidationResult("work", findings);
  }

  const workPath = path.join(workActiveRoot, targetFile);
  findings.push(...(await validateArtifactFile(workPath, "work")));
  findings.push(...(await validateWorkReadyConditions(workPath)));
  findings.push(...(await validateWorkReviewCompletion(repoRoot, workPath)));

  return createValidationResult("work", findings);
}

export async function validateState(repoRoot) {
  const statePath = path.join(getYxgRoot(repoRoot), "STATE.md");
  const findings = [];

  findings.push(...(await validateArtifactFile(statePath, "state")));
  findings.push(...(await validateStateFile(repoRoot, statePath)));

  return createValidationResult("state", findings);
}

export async function validateIndex(repoRoot) {
  const indexPath = path.join(getYxgRoot(repoRoot), "INDEX.md");
  const findings = [];

  findings.push(...(await validateArtifactFile(indexPath, "index")));
  findings.push(...(await validateIndexFile(repoRoot, indexPath)));

  return createValidationResult("index", findings);
}

export async function validateTemplates(repoRoot) {
  const findings = [];
  const templatesRoot = getInstanceTemplatesRoot(repoRoot);

  if (!(await pathExists(templatesRoot))) {
    findings.push(
      createFinding({
        level: "error",
        ruleId: "TEMPLATE-001",
        artifact: templatesRoot,
        message: "Missing .yxg/templates directory.",
        suggestedFix: "Run yxg init or copy the canonical templates into the instance."
      })
    );
    return createValidationResult("templates", findings);
  }

  const instanceFiles = new Set(await readdir(templatesRoot));

  for (const filename of CANONICAL_TEMPLATE_FILES) {
    if (!instanceFiles.has(filename)) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: "TEMPLATE-001",
          artifact: path.join(templatesRoot, filename),
          message: `Missing canonical template ${filename}.`,
          suggestedFix: `Restore ${filename} from the yxg tool's canonical templates and rerun yxg init --reinit.`
        })
      );
    }
  }

  return createValidationResult("templates", findings);
}

async function validateArtifactFile(filePath, expectedArtifactType) {
  const findings = [];

  if (!(await pathExists(filePath))) {
    findings.push(
      createFinding({
        level: "error",
        ruleId: "SCHEMA-001",
        artifact: filePath,
        message: "Artifact file is missing.",
        suggestedFix: "Create the file from the canonical template."
      })
    );
    return findings;
  }

  const content = await readFile(filePath, "utf8");
  const parsed = parseMarkdownArtifact(content);

  for (const field of COMMON_FRONTMATTER_FIELDS) {
    if (!parsed.frontmatter[field]) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: "SCHEMA-001",
          artifact: filePath,
          message: `Missing required frontmatter field ${field}.`,
          suggestedFix: `Add ${field} to the artifact frontmatter.`
        })
      );
    }
  }

  if (parsed.frontmatter.artifact_type !== expectedArtifactType) {
    findings.push(
      createFinding({
        level: "error",
        ruleId: "SCHEMA-002",
        artifact: filePath,
        message: `artifact_type must be ${expectedArtifactType}.`,
        suggestedFix: `Set artifact_type to ${expectedArtifactType}.`
      })
    );
  }

  const schema = ARTIFACT_SCHEMAS[expectedArtifactType];

  if (!schema) {
    return findings;
  }

  for (const field of schema.requiredFrontmatter) {
    if (!parsed.frontmatter[field]) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: "SCHEMA-003",
          artifact: filePath,
          message: `Missing artifact-specific frontmatter field ${field}.`,
          suggestedFix: `Add ${field} to the frontmatter.`
        })
      );
    }
  }

  for (const heading of schema.requiredHeadings) {
    if (!parsed.headings.includes(heading)) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: expectedArtifactType === "state" ? "STATE-001" : expectedArtifactType === "index" ? "INDEX-001" : "SCHEMA-003",
          artifact: filePath,
          message: `Missing required heading ${heading}.`,
          suggestedFix: `Restore the ${heading} section.`
        })
      );
    }
  }

  if (expectedArtifactType === "work") {
    if (!WORK_STATUS_VALUES.includes(parsed.frontmatter.status)) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: "WORK-STATUS-001",
          artifact: filePath,
          message: `Invalid work status ${parsed.frontmatter.status ?? "<missing>"}.`,
          suggestedFix: `Use one of: ${WORK_STATUS_VALUES.join(", ")}.`
        })
      );
    }
  }

  if (expectedArtifactType === "project") {
    findings.push(...validateProjectSubstance(filePath, content));
  }

  if (expectedArtifactType === "manifest") {
    findings.push(...validateManifestSubstance(filePath, parsed.frontmatter, content));
  }

  if (expectedArtifactType === "review") {
    findings.push(...validateReviewSubstance(filePath, parsed.frontmatter, content));
  }

  if (expectedArtifactType.startsWith("baseline-")) {
    findings.push(...validateBaselineEvidenceTags(filePath, parsed.body));
  }

  return findings;
}

function validateProjectSubstance(filePath, content) {
  const findings = [];

  for (const heading of [
    "## One-Sentence Goal",
    "## Success Criteria",
    "## Non-Negotiable Constraints",
    "## Product Principles",
    "## Engineering Principles",
    "## Out Of Scope"
  ]) {
    const body = extractSectionBody(content, heading).trim();
    if (!body || /\bTODO\b/i.test(body)) {
      findings.push(
        createFinding({
          level: "warning",
          ruleId: "PROJECT-001",
          artifact: filePath,
          message: `${heading.replace("## ", "")} is still placeholder-heavy.`,
          suggestedFix: `Fill ${heading.replace("## ", "")} with durable project-specific guidance.`
        })
      );
    }
  }

  return findings;
}

function validateManifestSubstance(filePath, frontmatter, content) {
  const findings = [];

  if ((frontmatter.preferred_adapter ?? "unknown") === "unknown") {
    findings.push(
      createFinding({
        level: "warning",
        ruleId: "MANIFEST-001",
        artifact: filePath,
        message: "preferred_adapter is still unknown.",
        suggestedFix: "Sync the manifest with the current CLI or Codex adapter runtime."
      })
    );
  }

  if ((frontmatter.adapter_version ?? "unknown") === "unknown") {
    findings.push(
      createFinding({
        level: "warning",
        ruleId: "MANIFEST-002",
        artifact: filePath,
        message: "adapter_version is still unknown.",
        suggestedFix: "Write the active adapter version into the manifest."
      })
    );
  }

  if (/Write the active kernel version/i.test(content)) {
    findings.push(
      createFinding({
        level: "warning",
        ruleId: "MANIFEST-003",
        artifact: filePath,
        message: "Manifest still contains template guidance in the Kernel section.",
        suggestedFix: "Replace template guidance with concrete kernel and adapter metadata."
      })
    );
  }

  return findings;
}

function validateReviewSubstance(filePath, frontmatter, content) {
  const findings = [];
  const verdict = frontmatter.verdict;
  const scope = extractSectionBody(content, "## Scope Under Review");
  const verification = extractSectionBody(content, "## Verification Results");
  const verdictSection = extractSectionBody(content, "## Verdict");

  if (/Change set:\s*unknown/i.test(scope)) {
    findings.push(
      createFinding({
        level: verdict === "pass" ? "error" : "warning",
        ruleId: "REVIEW-003",
        artifact: filePath,
        message: "Review still uses an unknown change set placeholder.",
        suggestedFix: "Record the reviewed change set or related paths explicitly."
      })
    );
  }

  if (/validator run pending or complete/i.test(verification) || /\bTODO\b/i.test(verification)) {
    findings.push(
      createFinding({
        level: verdict === "pass" ? "error" : "warning",
        ruleId: "REVIEW-004",
        artifact: filePath,
        message: "Verification Results still contains placeholder text.",
        suggestedFix: "Write the actual checks that were run and what they showed."
      })
    );
  }

  if (/Reason:\s*TODO/i.test(verdictSection)) {
    findings.push(
      createFinding({
        level: verdict === "pass" ? "error" : "warning",
        ruleId: "REVIEW-005",
        artifact: filePath,
        message: "Review verdict reason is still placeholder text.",
        suggestedFix: "Explain why the verdict was reached."
      })
    );
  }

  return findings;
}

async function validateManifestOverrides(manifestPath) {
  if (!(await pathExists(manifestPath))) {
    return [];
  }

  const content = await readFile(manifestPath, "utf8");
  const overridesSection = extractSectionBody(content, "## Local Overrides");
  const findings = [];

  for (const line of extractBulletValues(overridesSection)) {
    if (line === "none") {
      continue;
    }

    const [key, rawValue] = splitKeyValue(line);

    if (!key) {
      continue;
    }

    if (!ALLOWED_LOCAL_OVERRIDE_KEYS.includes(key)) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: "MANIFEST-OVERRIDE-001",
          artifact: manifestPath,
          message: `Unsupported local override key ${key}.`,
          suggestedFix: `Use only allowed override keys: ${ALLOWED_LOCAL_OVERRIDE_KEYS.join(", ")}.`
        })
      );
      continue;
    }

    const allowedValues = ALLOWED_OVERRIDE_VALUES[key];

    if (allowedValues && !allowedValues.includes(rawValue)) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: "MANIFEST-OVERRIDE-002",
          artifact: manifestPath,
          message: `Invalid value ${rawValue} for override ${key}.`,
          suggestedFix: `Use one of: ${allowedValues.join(", ")}.`
        })
      );
    }
  }

  return findings;
}

async function validateStateFile(repoRoot, statePath) {
  if (!(await pathExists(statePath))) {
    return [];
  }

  const content = await readFile(statePath, "utf8");
  const findings = [];
  const activeWorkSection = extractSectionBody(content, "## Active Work");
  const checkpointSection = extractSectionBody(content, "## Last Safe Checkpoint");
  const activeWorkValues = extractBulletValues(activeWorkSection);

  for (const workRef of activeWorkValues) {
    if (workRef === "none") {
      continue;
    }

    const workExists = await findActiveWorkFile(repoRoot, workRef);

    if (!workExists) {
      findings.push(
        createFinding({
          level: "warning",
          ruleId: "STATE-002",
          artifact: statePath,
          message: `Active Work references missing work artifact ${workRef}.`,
          suggestedFix: "Update Active Work to reference an existing work-unit artifact."
        })
      );
    }
  }

  const nextSafeAction = extractSectionBody(content, "## Next Safe Action").trim();

  if (!nextSafeAction || /\bTODO\b/i.test(nextSafeAction) || /\bunknown\b/i.test(nextSafeAction)) {
    findings.push(
      createFinding({
        level: "warning",
        ruleId: "STATE-003",
        artifact: statePath,
        message: "Next Safe Action is empty or still uses placeholder content.",
        suggestedFix: "Write one concrete next safe action."
      })
    );
  }

  if (
    activeWorkValues.length === 1 &&
    activeWorkValues[0] === "none" &&
    /继续|resume|继续做|当前任务|收尾评审|active work/i.test(checkpointSection)
  ) {
    findings.push(
      createFinding({
        level: "warning",
        ruleId: "STATE-004",
        artifact: statePath,
        message: "Last Safe Checkpoint still reads like active-task execution guidance even though Active Work is none.",
        suggestedFix: "Refresh the checkpoint summary after finish/cleanup so it reflects the latest completed or idle state."
      })
    );
  }

  return findings;
}

async function validateIndexFile(repoRoot, indexPath) {
  if (!(await pathExists(indexPath))) {
    return [];
  }

  const content = await readFile(indexPath, "utf8");
  const findings = [];
  const currentOperations = extractSectionBody(content, "## Current Operations");
  const listedLines = new Set(extractBulletValues(currentOperations));
  const activeWorkIds = new Set();

  const activeWorkRoot = getWorkActiveRoot(repoRoot);
  if (await pathExists(activeWorkRoot)) {
    const workFiles = await readdir(activeWorkRoot);
    for (const workFile of workFiles) {
      const workPath = path.join(activeWorkRoot, workFile);
      const workContent = await readFile(workPath, "utf8");
      const workParsed = parseMarkdownArtifact(workContent);
      if (workParsed.frontmatter.id) {
        activeWorkIds.add(workParsed.frontmatter.id);
      }

      if (!hasListedEntry(listedLines, workFile)) {
        findings.push(
          createFinding({
            level: "warning",
            ruleId: "INDEX-002",
            artifact: indexPath,
            message: `Active work ${workFile} is not listed under Current Operations.`,
            suggestedFix: `Add ${workFile} to Current Operations.`
          })
        );
      }
    }
  }

  const reviewsRoot = path.join(getYxgRoot(repoRoot), "reviews");
  if (await pathExists(reviewsRoot)) {
    const reviewFiles = await readdir(reviewsRoot);
    for (const reviewFile of reviewFiles) {
      const reviewPath = path.join(reviewsRoot, reviewFile);
      const reviewContent = await readFile(reviewPath, "utf8");
      const reviewParsed = parseMarkdownArtifact(reviewContent);
      const targetWorkId = reviewParsed.frontmatter.target_work_id;

      if (targetWorkId && !activeWorkIds.has(targetWorkId)) {
        continue;
      }

      if (!hasListedEntry(listedLines, reviewFile)) {
        findings.push(
          createFinding({
            level: "warning",
            ruleId: "INDEX-003",
            artifact: indexPath,
            message: `Active review ${reviewFile} is not listed under Current Operations.`,
            suggestedFix: `Add ${reviewFile} to Current Operations.`
          })
        );
      }
    }
  }

  return findings;
}

async function validateWorkReadyConditions(workPath) {
  if (!(await pathExists(workPath))) {
    return [];
  }

  const content = await readFile(workPath, "utf8");
  const { frontmatter } = parseMarkdownArtifact(content);

  if (frontmatter.status !== "ready") {
    return [];
  }

  const findings = [];
  const checks = [
    ["WORK-READY-001", "## Objective"],
    ["WORK-READY-002", "## In Scope"],
    ["WORK-READY-002", "## Out Of Scope"],
    ["WORK-READY-002", "## Expected Touch Points"],
    ["WORK-READY-003", "## Assumptions"],
    ["WORK-READY-003", "## Risks"],
    ["WORK-READY-004", "## Verification"],
    ["WORK-READY-004", "## Done When"],
    ["WORK-READY-005", "## Escalate If"]
  ];

  for (const [ruleId, heading] of checks) {
    const body = extractSectionBody(content, heading).trim();
    if (!body || /\bTODO\b/i.test(body) || /\bunknown\b/i.test(body)) {
      findings.push(
        createFinding({
          level: "error",
          ruleId,
          artifact: workPath,
          message: `${heading.replace("## ", "")} is incomplete for ready state.`,
          suggestedFix: `Fill ${heading.replace("## ", "")} before marking work ready.`
        })
      );
    }
  }

  return findings;
}

async function validateWorkReviewCompletion(repoRoot, workPath) {
  if (!(await pathExists(workPath))) {
    return [];
  }

  const content = await readFile(workPath, "utf8");
  const { frontmatter } = parseMarkdownArtifact(content);

  if (frontmatter.status !== "done") {
    return [];
  }

  const findings = [];
  const reviewsRoot = path.join(getYxgRoot(repoRoot), "reviews");

  if (!(await pathExists(reviewsRoot))) {
    findings.push(
      createFinding({
        level: "error",
        ruleId: "REVIEW-001",
        artifact: workPath,
        message: "Work is marked done but no reviews directory exists.",
        suggestedFix: "Create a passing review before marking work done."
      })
    );
    return findings;
  }

  const reviewFiles = await readdir(reviewsRoot);
  const matchingReviews = [];

  for (const reviewFile of reviewFiles) {
    const reviewPath = path.join(reviewsRoot, reviewFile);
    const reviewContent = await readFile(reviewPath, "utf8");
    const parsed = parseMarkdownArtifact(reviewContent);
    if (parsed.frontmatter.target_work_id === frontmatter.id) {
      matchingReviews.push(parsed.frontmatter);
    }
  }

  if (matchingReviews.length === 0) {
    findings.push(
      createFinding({
        level: "error",
        ruleId: "REVIEW-001",
        artifact: workPath,
        message: "Work is marked done but no corresponding review artifact exists.",
        suggestedFix: "Create a review artifact with target_work_id matching the work ID."
      })
    );
    return findings;
  }

  const latestReview = matchingReviews.at(-1);

  if (latestReview.verdict !== "pass") {
    findings.push(
      createFinding({
        level: "error",
        ruleId: "REVIEW-002",
        artifact: workPath,
        message: `Latest review verdict is ${latestReview.verdict}, not pass.`,
        suggestedFix: "Only mark work done after a passing review."
      })
    );
  }

  return findings;
}

function validateBaselineEvidenceTags(filePath, body) {
  const findings = [];
  const bulletLines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));

  for (const bulletLine of bulletLines) {
    if (bulletLine === "- none") {
      continue;
    }

    const matchingTags = BASELINE_EVIDENCE_TAGS.filter((tag) => bulletLine.includes(tag));

    if (matchingTags.length === 0) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: "IMPORT-TAG-001",
          artifact: filePath,
          message: `Baseline conclusion lacks an evidence tag: ${bulletLine}`,
          suggestedFix: "Prefix each baseline conclusion with one allowed evidence tag."
        })
      );
      continue;
    }

    if (matchingTags.length > 1) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: "IMPORT-TAG-002",
          artifact: filePath,
          message: `Baseline conclusion has multiple evidence tags: ${bulletLine}`,
          suggestedFix: "Use exactly one evidence tag per conclusion."
        })
      );
    }
  }

  return findings;
}

export async function validateImport(repoRoot) {
  const findings = [];
  const baselineRoot = path.join(getYxgRoot(repoRoot), "baseline");
  const artifactTypeByFile = {
    "STACK.md": "baseline-stack",
    "ARCHITECTURE.md": "baseline-architecture",
    "CONVENTIONS.md": "baseline-conventions",
    "RISKS.md": "baseline-risks",
    "IMPORT-SUMMARY.md": "baseline-import-summary"
  };

  for (const filename of BASELINE_TEMPLATE_FILES) {
    const filePath = path.join(baselineRoot, filename);
    if (!(await pathExists(filePath))) {
      findings.push(
        createFinding({
          level: "error",
          ruleId: "IMPORT-001",
          artifact: filePath,
          message: `Missing required import baseline file ${filename}.`,
          suggestedFix: `Create ${filename} as part of import completion.`
        })
      );
      continue;
    }

    findings.push(...(await validateArtifactFile(filePath, artifactTypeByFile[filename])));
  }

  return createValidationResult("import", findings);
}

async function findActiveWorkFile(repoRoot, workRef) {
  const workRoot = getWorkActiveRoot(repoRoot);

  if (!(await pathExists(workRoot))) {
    return false;
  }

  const workFiles = await readdir(workRoot);
  return workFiles.some((filename) => filename === workRef || filename.startsWith(`${workRef}-`));
}

function splitKeyValue(line) {
  const separatorIndex = line.indexOf(":");

  if (separatorIndex === -1) {
    return [line.trim(), ""];
  }

  return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
}

function hasListedEntry(listedLines, filename) {
  return Array.from(listedLines).some(
    (entry) =>
      entry === filename ||
      entry === `\`${filename}\`` ||
      entry.endsWith(`/${filename}`) ||
      entry.endsWith(`/${filename}\``)
  );
}
