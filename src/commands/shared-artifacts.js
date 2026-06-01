import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseMarkdownArtifact } from "../artifacts/markdown.js";
import { extractBulletValues, extractSectionBody, replaceSectionBody, bulletList } from "../artifacts/sections.js";
import { atomicWriteFile } from "../fs/atomic-write.js";
import { pathExists } from "../fs/exists.js";
import { getWorkActiveRoot, getWorkArchiveRoot, getYxgRoot } from "../fs/paths.js";
import { applyFrontmatterValues } from "../templates/core.js";

const INDEX_CORE_ARTIFACTS = [
  "`MANIFEST.md`",
  "`PROJECT.md`",
  "`STATE.md`",
  "`INDEX.md`",
  "`LOG.md`"
];

const INDEX_UPDATE_RULE = [
  "Refresh when active work changes, important reference artifacts are added, or cleanup archives material."
];

const LOG_PLACEHOLDER_ENTRY = "## [YYYY-MM-DD] init | framework instance initialized";

export async function updateStateForWork(
  repoRoot,
  {
    focus,
    workEntries,
    nextSafeAction,
    checkpointSummary = null,
    checkpointDate = null,
    openRisks = null
  }
) {
  const statePath = path.join(getYxgRoot(repoRoot), "STATE.md");
  const date = new Date().toISOString().slice(0, 10);
  let content = applyFrontmatterValues(await readFile(statePath, "utf8"), {
    updated_at: date
  });

  content = replaceSectionBody(content, "## Current Focus", bulletList([focus]));
  content = replaceSectionBody(content, "## Active Work", bulletList(workEntries));
  content = replaceSectionBody(content, "## Next Safe Action", `1. ${nextSafeAction}`);
  if (checkpointSummary !== null) {
    content = replaceSectionBody(
      content,
      "## Last Safe Checkpoint",
      bulletList([
        `Date: ${checkpointDate ?? date}`,
        `Summary: ${checkpointSummary}`
      ])
    );
  }
  if (openRisks !== null) {
    content = replaceSectionBody(content, "## Open Risks", bulletList(openRisks));
  }

  await atomicWriteFile(statePath, content);
  return path.relative(repoRoot, statePath);
}

export async function addCurrentOperationEntry(repoRoot, entry) {
  const indexPath = path.join(getYxgRoot(repoRoot), "INDEX.md");
  let content = normalizeIndexContent(await readFile(indexPath, "utf8"));
  const currentOperations = extractSectionBody(content, "## Current Operations");
  const values = extractBulletValues(currentOperations).filter((value) => value !== "none");

  if (!values.includes(entry)) {
    values.push(entry);
    content = replaceSectionBody(content, "## Current Operations", bulletList(values));
    await atomicWriteFile(indexPath, content);
  }

  return path.relative(repoRoot, indexPath);
}

export async function rebuildIndexFromRepoState(repoRoot) {
  const indexPath = path.join(getYxgRoot(repoRoot), "INDEX.md");
  let content = normalizeIndexContent(await readFile(indexPath, "utf8"));
  const currentOps = [];
  const referenceKnowledge = [];
  const archiveHistory = [];
  const activeWorkIds = new Set();

  const activeRoot = getWorkActiveRoot(repoRoot);
  if (await pathExists(activeRoot)) {
    for (const filename of await readdir(activeRoot)) {
      currentOps.push(path.join(".yxg", "work", "active", filename).replace(/\\/g, "/"));
      const activePath = path.join(activeRoot, filename);
      const parsed = parseMarkdownArtifact(await readFile(activePath, "utf8"));
      if (parsed.frontmatter.id) {
        activeWorkIds.add(parsed.frontmatter.id);
      }
    }
  }

  const reviewsRoot = path.join(getYxgRoot(repoRoot), "reviews");
  let staleReviewExists = false;
  if (await pathExists(reviewsRoot)) {
    for (const filename of await readdir(reviewsRoot)) {
      const reviewPath = path.join(reviewsRoot, filename);
      const parsed = parseMarkdownArtifact(await readFile(reviewPath, "utf8"));
      const targetWorkId = parsed.frontmatter.target_work_id;

      if (targetWorkId && activeWorkIds.has(targetWorkId)) {
        currentOps.push(path.join(".yxg", "reviews", filename).replace(/\\/g, "/"));
      } else {
        staleReviewExists = true;
      }
    }
  }

  const baselineRoot = path.join(getYxgRoot(repoRoot), "baseline");
  if (await pathExists(baselineRoot)) {
    for (const filename of await readdir(baselineRoot)) {
      referenceKnowledge.push(path.join(".yxg", "baseline", filename).replace(/\\/g, "/"));
    }
  }

  const roadmapPath = path.join(getYxgRoot(repoRoot), "ROADMAP.md");
  if (await pathExists(roadmapPath)) {
    referenceKnowledge.push(".yxg/ROADMAP.md");
  }

  const archiveRoot = getWorkArchiveRoot(repoRoot);
  if (await pathExists(archiveRoot)) {
    const archived = await readdir(archiveRoot);
    if (archived.length > 0) {
      archiveHistory.push(".yxg/work/archive/");
    }
  }

  if (staleReviewExists) {
    archiveHistory.push(".yxg/reviews/");
  }

  content = replaceSectionBody(content, "## Core Artifacts", bulletList(INDEX_CORE_ARTIFACTS));
  content = replaceSectionBody(content, "## Current Operations", bulletList(currentOps));
  content = replaceSectionBody(content, "## Reference Knowledge", bulletList(referenceKnowledge));
  content = replaceSectionBody(content, "## Archive / History", bulletList(archiveHistory));
  content = replaceSectionBody(content, "## Update Rule", bulletList(INDEX_UPDATE_RULE));

  await atomicWriteFile(indexPath, content);
  return path.relative(repoRoot, indexPath);
}

export async function appendLogEntry(repoRoot, { date, eventId, summary, bullets }) {
  const logPath = path.join(getYxgRoot(repoRoot), "LOG.md");
  const content = normalizeLogContent(
    applyFrontmatterValues(await readFile(logPath, "utf8"), {
      updated_at: date
    })
  );
  const entry = `\n## [${date}] ${eventId} | ${summary}\n\n${bullets
    .map((bullet) => `- ${bullet}`)
    .join("\n")}\n`;

  await atomicWriteFile(logPath, `${content.trimEnd()}\n${entry}`);
  return path.relative(repoRoot, logPath);
}

export async function checkRequiredInstanceArtifacts(repoRoot, filenames = []) {
  const missing = [];

  for (const filename of filenames) {
    const targetPath = path.join(getYxgRoot(repoRoot), filename);
    if (!(await pathExists(targetPath))) {
      missing.push(filename);
    }
  }

  return missing;
}

export async function listCurrentWorkEntries(repoRoot) {
  const activeRoot = getWorkActiveRoot(repoRoot);
  if (!(await pathExists(activeRoot))) {
    return [];
  }
  return readdir(activeRoot);
}

export function normalizeIndexContent(content, date = new Date().toISOString().slice(0, 10)) {
  let normalized = applyFrontmatterValues(content, {
    updated_at: date
  });
  normalized = replaceSectionBody(normalized, "## Core Artifacts", bulletList(INDEX_CORE_ARTIFACTS));
  normalized = replaceSectionBody(normalized, "## Update Rule", bulletList(INDEX_UPDATE_RULE));
  return normalized;
}

function normalizeLogContent(content) {
  if (!content.includes(LOG_PLACEHOLDER_ENTRY)) {
    return content;
  }

  const normalized = content.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(`\n${LOG_PLACEHOLDER_ENTRY}`);

  if (start === -1) {
    return content;
  }

  return normalized.slice(0, start).trimEnd();
}
