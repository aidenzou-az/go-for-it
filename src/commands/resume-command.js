import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { parseMarkdownArtifact } from "../artifacts/markdown.js";
import { extractBulletValues, extractSectionBody } from "../artifacts/sections.js";
import { findActiveWorkPath } from "../artifacts/work.js";
import { pathExists } from "../fs/exists.js";
import { getWorkArchiveRoot, getYxgRoot } from "../fs/paths.js";
import { formatGitSummary, getGitContext } from "../git/context.js";
import { createCommandResult } from "../output/result.js";
import { runValidation } from "../validation/index.js";

export async function runResumeCommand({ repoRoot }) {
  const yxgRoot = getYxgRoot(repoRoot);
  const statePath = path.join(yxgRoot, "STATE.md");

  if (!(await pathExists(statePath))) {
    return createCommandResult({
      ok: false,
      command: "resume",
      scope: "resume",
      message: "missing .yxg/STATE.md; initialize the framework first",
      validation: { errors: 1, warnings: 0, infos: 0 }
    });
  }

  const stateContent = await readFile(statePath, "utf8");
  const activeWork = extractBulletValues(extractSectionBody(stateContent, "## Active Work")).filter(
    (value) => value !== "none"
  );
  const nextSafeAction = extractSectionBody(stateContent, "## Next Safe Action").trim() || "unknown";
  const currentFocus = extractSectionBody(stateContent, "## Current Focus").trim() || "unknown";
  const contextEntries = [];
  const activeWorkDetails = [];

  for (const workRef of activeWork) {
    const workPath = await findActiveWorkPath(repoRoot, workRef);
    if (workPath) {
      contextEntries.push(path.relative(repoRoot, workPath));
      const workContent = await readFile(workPath, "utf8");
      const work = parseMarkdownArtifact(workContent);
      activeWorkDetails.push({
        ref: workRef,
        path: path.relative(repoRoot, workPath),
        id: work.frontmatter.id ?? path.basename(workPath, path.extname(workPath)),
        status: work.frontmatter.status ?? "unknown",
        dependencyIds: extractWorkIds(extractSectionBody(workContent, "## Dependencies"))
      });
    }
  }

  const recommendedWork = inferRecommendedActiveWork({
    currentFocus,
    nextSafeAction,
    activeWorkDetails
  });
  const plannedNextWork = recommendedWork ? null : await inferPlannedNextWork(repoRoot, activeWorkDetails);
  const primaryWorkPath =
    recommendedWork?.path
      ? path.join(repoRoot, recommendedWork.path)
      : activeWorkDetails.length === 1
        ? path.join(repoRoot, activeWorkDetails[0].path)
        : null;
  const gitContext = await getGitContext(repoRoot, { workPath: primaryWorkPath });

  const validation = await runValidation({ repoRoot, scope: "state" });
  const nextSteps = [stripNumbers(nextSafeAction)];

  if (recommendedWork?.id) {
    nextSteps.unshift(`Recommended current work: ${recommendedWork.id}`);
  } else if (plannedNextWork) {
    nextSteps.unshift(`Planned next work: ${plannedNextWork.work_id} ${plannedNextWork.title}`.trim());
  }
  if (gitContext.available && gitContext.suggested_branch) {
    nextSteps.push(`Suggested branch: ${gitContext.suggested_branch}`);
  }
  if (gitContext.available && gitContext.branch_mismatch_reason) {
    nextSteps.push(`Branch mismatch: ${gitContext.branch_mismatch_reason}`);
  }

  return createCommandResult({
    ok: true,
    command: "resume",
    scope: "resume",
    validation: validation.summary,
    message: `resume focus: ${stripBullets(currentFocus)}`,
    details: buildResumeDetails({ currentFocus, nextSafeAction, contextEntries, gitContext, recommendedWork, plannedNextWork }),
    nextSteps,
    data: {
      current_focus: stripBullets(currentFocus),
      next_safe_action: stripNumbers(nextSafeAction),
      active_work: contextEntries,
      recommended_work_id: recommendedWork?.id ?? null,
      recommended_work_path: recommendedWork?.path ?? null,
      planned_next_work: plannedNextWork,
      git: gitContext.available ? gitContext : null,
      findings: validation.findings
    }
  });
}

function stripBullets(value) {
  return value.replace(/^- /gm, "").trim();
}

function stripNumbers(value) {
  return value.replace(/^\d+\.\s*/gm, "").trim();
}

function buildResumeDetails({ currentFocus, nextSafeAction, contextEntries, gitContext, recommendedWork, plannedNextWork }) {
  const focus = stripBullets(currentFocus);
  const next = stripNumbers(nextSafeAction);
  const work = contextEntries.length > 0 ? contextEntries.join(", ") : "no active work files";
  const git = formatGitSummary(gitContext);
  const recommended = recommendedWork?.id ? ` | recommended: ${recommendedWork.id}` : "";
  const planned = !recommendedWork && plannedNextWork ? ` | planned next: ${plannedNextWork.work_id}` : "";

  return `focus: ${focus} | next: ${next} | work: ${work}${recommended}${planned} | ${git}`;
}

function inferRecommendedActiveWork({ currentFocus, nextSafeAction, activeWorkDetails }) {
  if (activeWorkDetails.length === 0) {
    return null;
  }

  if (activeWorkDetails.length === 1) {
    return activeWorkDetails[0];
  }

  const narrative = `${currentFocus}\n${nextSafeAction}`;
  if (!isPlanningOnlyNarrative(currentFocus, nextSafeAction)) {
    const hasActionableCandidates = activeWorkDetails.some((work) => isActionableStatus(work.status));
    const scored = activeWorkDetails
      .map((work) => ({
        work,
        count: countMatches(narrative, new RegExp(`\\b${escapeRegExp(work.id)}\\b`, "g"))
      }))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count);

    if (scored.length === 1 || scored[0]?.count > scored[1]?.count) {
      if (scored[0].work.status === "monitoring" && hasActionableCandidates) {
        return inferActionableWork(activeWorkDetails);
      }
      return scored[0].work;
    }
  }

  const actionableWork = inferActionableWork(activeWorkDetails);
  if (actionableWork) {
    return actionableWork;
  }

  const monitoringCandidates = sortedByWorkId(activeWorkDetails.filter((work) => work.status === "monitoring"));
  if (monitoringCandidates.length > 0) {
    return monitoringCandidates[0];
  }

  return null;
}

function inferActionableWork(activeWorkDetails) {
  const activeCandidates = sortedByWorkId(activeWorkDetails.filter((work) => work.status === "active"));
  if (activeCandidates.length === 1) {
    return activeCandidates[0];
  }

  const openWorkIds = new Set(activeWorkDetails.map((work) => work.id));
  const readyCandidates = sortedByWorkId(activeWorkDetails.filter((work) => work.status === "ready"));
  const unblockedReadyCandidates = readyCandidates.filter(
    (work) => !work.dependencyIds.some((dependencyId) => openWorkIds.has(dependencyId))
  );

  if (unblockedReadyCandidates.length > 0) {
    return unblockedReadyCandidates[0];
  }

  return readyCandidates[0] ?? null;
}

function isActionableStatus(status) {
  return status === "active" || status === "ready";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(input, pattern) {
  let count = 0;
  while (pattern.exec(input)) {
    count += 1;
  }
  return count;
}

function isPlanningOnlyNarrative(currentFocus, nextSafeAction) {
  return (
    /planning work WU-\d+/i.test(currentFocus) &&
    /Review validation findings for WU-\d+|proceed to execution/i.test(nextSafeAction)
  );
}

function extractWorkIds(value) {
  return Array.from(new Set(value.match(/\bWU-\d+\b/g) ?? []));
}

function sortedByWorkId(workItems) {
  return [...workItems].sort((left, right) => numericWorkId(left.id) - numericWorkId(right.id));
}

function numericWorkId(workId) {
  return Number(workId.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
}

async function inferPlannedNextWork(repoRoot, activeWorkDetails) {
  if (activeWorkDetails.length > 0) {
    return null;
  }

  const roadmapPath = path.join(getYxgRoot(repoRoot), "ROADMAP.md");
  if (!(await pathExists(roadmapPath))) {
    return null;
  }

  const roadmapContent = await readFile(roadmapPath, "utf8");
  const archivedWorkIds = await listArchivedWorkIds(repoRoot);

  for (const section of ["Now", "Next"]) {
    const sectionBody = extractSectionBody(roadmapContent, `## ${section}`);
    const planned = extractPlannedWorkFromRoadmapSection(sectionBody, {
      section,
      archivedWorkIds
    });

    if (planned) {
      return {
        ...planned,
        path: ".yxg/ROADMAP.md"
      };
    }
  }

  return null;
}

function extractPlannedWorkFromRoadmapSection(sectionBody, { section, archivedWorkIds }) {
  for (const rawLine of sectionBody.split("\n")) {
    const line = rawLine.replace(/^[-*]\s*/, "").trim();
    if (!line || /^none$/i.test(line) || /\bTODO\b/i.test(line)) {
      continue;
    }

    const match = line.match(/\b(WU-\d+)\b(?::|\s|-|—|–)*(.*)$/i);
    if (!match) {
      continue;
    }

    const workId = match[1].toUpperCase();
    if (archivedWorkIds.has(workId)) {
      continue;
    }

    const title = match[2].trim() || workId;

    return {
      work_id: workId,
      title,
      section
    };
  }

  return null;
}

async function listArchivedWorkIds(repoRoot) {
  const archiveRoot = getWorkArchiveRoot(repoRoot);
  const ids = new Set();

  if (!(await pathExists(archiveRoot))) {
    return ids;
  }

  for (const filename of await readdir(archiveRoot)) {
    const match = filename.match(/^(WU-\d+)/i);
    if (match) {
      ids.add(match[1].toUpperCase());
    }
  }

  return ids;
}
