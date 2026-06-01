import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { parseMarkdownArtifact } from "../artifacts/markdown.js";
import { findActiveWorkPath } from "../artifacts/work.js";
import { createCommandResult } from "../output/result.js";
import { runValidation } from "../validation/index.js";
import {
  appendLogEntry,
  checkRequiredInstanceArtifacts,
  listCurrentWorkEntries,
  rebuildIndexFromRepoState,
  updateStateForWork
} from "./shared-artifacts.js";
import { syncManifestWithRuntime } from "./instance-metadata.js";

export async function runCancelWorkCommand({ args, repoRoot }) {
  const [workId] = args;

  if (!workId) {
    return createCommandResult({
      ok: false,
      command: "cancel-work",
      scope: "work",
      message: "missing work id",
      validation: { errors: 1, warnings: 0, infos: 0 },
      nextSteps: ["Run yxg cancel-work <WORK-ID> to remove a draft work unit."]
    });
  }

  const missingInstanceArtifacts = await checkRequiredInstanceArtifacts(repoRoot, [
    "STATE.md",
    "INDEX.md",
    "LOG.md"
  ]);

  if (missingInstanceArtifacts.length > 0) {
    return createCommandResult({
      ok: false,
      command: "cancel-work",
      scope: "work",
      message: "missing .yxg scaffold; initialize the framework first",
      validation: { errors: 1, warnings: 0, infos: 0 },
      details: `missing required artifacts: ${missingInstanceArtifacts.join(", ")}`,
      nextSteps: ["Run yxg init before canceling work units."],
      data: {
        missing_artifacts: missingInstanceArtifacts
      }
    });
  }

  const workPath = await findActiveWorkPath(repoRoot, workId);
  if (!workPath) {
    return createCommandResult({
      ok: false,
      command: "cancel-work",
      scope: "work",
      message: `no active work artifact found for ${workId}`,
      validation: { errors: 1, warnings: 0, infos: 0 }
    });
  }

  const workContent = await readFile(workPath, "utf8");
  const parsed = parseMarkdownArtifact(workContent);
  const currentStatus = parsed.frontmatter.status ?? "unknown";

  if (currentStatus !== "draft") {
    return createCommandResult({
      ok: false,
      command: "cancel-work",
      scope: "work",
      message: `cannot cancel ${workId} because it is not in draft`,
      validation: { errors: 1, warnings: 0, infos: 0 },
      details: `${workId} is currently ${currentStatus}`,
      nextSteps: [
        "Only draft work can be canceled automatically.",
        `Use review/cleanup or adjust the work state for ${workId} instead.`
      ],
      data: {
        work_id: workId,
        current_status: currentStatus
      }
    });
  }

  await rm(workPath);
  const changed = [path.relative(repoRoot, workPath)];
  const manifestPath = await syncManifestWithRuntime(repoRoot);
  changed.push(await rebuildIndexFromRepoState(repoRoot));
  changed.push(
    await updateStateForWork(repoRoot, {
      focus: `canceled draft work ${workId}`,
      workEntries: await listCurrentWorkEntries(repoRoot),
      nextSafeAction: "Create a corrected work unit or continue the remaining active work.",
      checkpointSummary: `Draft work ${workId} was canceled and removed from the active queue.`,
      openRisks: ["none"]
    })
  );
  if (manifestPath) {
    changed.push(manifestPath);
  }

  const date = new Date().toISOString().slice(0, 10);
  changed.push(
    await appendLogEntry(repoRoot, {
      date,
      eventId: `cancel-${workId}`,
      summary: `canceled draft work ${workId}`,
      bullets: [
        `Removed draft work artifact: ${path.basename(workPath)}`,
        "Operational state and index were refreshed after cancellation."
      ]
    })
  );

  const validation = await runValidation({ repoRoot, scope: "instance" });

  return createCommandResult({
    ok: validation.ok,
    command: "cancel-work",
    scope: "work",
    artifactsChanged: Array.from(new Set(changed)),
    validation: validation.summary,
    message: `canceled draft work ${workId}`,
    details: `removed ${path.basename(workPath)} and refreshed .yxg state`,
    nextSteps: [
      'Create a replacement draft with yxg plan --task="<task text>".',
      "Continue with the remaining active work if no replacement is needed."
    ],
    data: {
      work_id: workId,
      canceled_file: path.basename(workPath),
      findings: validation.findings
    }
  });
}
