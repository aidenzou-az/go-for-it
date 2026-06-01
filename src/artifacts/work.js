import { readdir } from "node:fs/promises";
import path from "node:path";
import { extractSectionBody, replaceSectionBody } from "./sections.js";
import { pathExists } from "../fs/exists.js";
import { getWorkActiveRoot, getWorkArchiveRoot } from "../fs/paths.js";

export async function findActiveWorkPath(repoRoot, workId) {
  const workRoot = getWorkActiveRoot(repoRoot);

  if (!(await pathExists(workRoot))) {
    return null;
  }

  const workFiles = await readdir(workRoot);
  const filename = workFiles.find((entry) => entry === workId || entry.startsWith(`${workId}-`));

  return filename ? path.join(workRoot, filename) : null;
}

export async function listActiveWorkFiles(repoRoot) {
  const workRoot = getWorkActiveRoot(repoRoot);

  if (!(await pathExists(workRoot))) {
    return [];
  }

  return readdir(workRoot);
}

export async function getNextGeneratedWorkId(repoRoot) {
  const ids = [];

  for (const root of [getWorkActiveRoot(repoRoot), getWorkArchiveRoot(repoRoot)]) {
    if (!(await pathExists(root))) {
      continue;
    }

    for (const filename of await readdir(root)) {
      const match = filename.match(/^(WU-(\d+))/i);
      if (match) {
        ids.push(Number(match[2]));
      }
    }
  }

  const nextNumber = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return `WU-${String(nextNumber).padStart(3, "0")}`;
}

const WORK_TEMPLATE_GUIDANCE = new Map([
  ["## Objective", "Describe the concrete outcome this work unit is meant to produce."],
  ["## In Scope", "List what this work unit is explicitly allowed to change or address."],
  ["## Out Of Scope", "List what this work unit must not silently absorb."],
  ["## Expected Touch Points", "List the files, modules, commands, or surfaces likely to move."],
  ["## Dependencies", "List prior work, external inputs, or blocking prerequisites. Write `none` if there are none."],
  ["## Assumptions", "Write the assumptions this work relies on. If there are none, write `none`."],
  ["## Risks", "Write the main risks or write `none`."],
  ["## Plan", "Write the bounded steps to complete the work."],
  ["## Verification", "Write the checks that will prove the work is correct."],
  ["## Done When", "Write the testable completion condition."],
  ["## Escalate If", "Write the conditions that should trigger replanning or escalation."],
  ["## Evidence Log", "Record durable facts discovered during execution. Write `none` until evidence exists."],
  ["## Notes", "Write any additional context that should remain attached to this work unit."]
]);

export function sanitizeWorkArtifactContent(content) {
  let sanitized = content;

  for (const [heading, guidanceLine] of WORK_TEMPLATE_GUIDANCE.entries()) {
    const body = extractSectionBody(sanitized, heading);
    if (!body) {
      continue;
    }

    const lines = body
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0);

    if (lines.length <= 1) {
      continue;
    }

    if (lines[0] === guidanceLine) {
      sanitized = replaceSectionBody(sanitized, heading, lines.slice(1).join("\n"));
    }
  }

  return sanitized;
}
