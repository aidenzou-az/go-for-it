import path from "node:path";
import { readFile } from "node:fs/promises";
import { findActiveWorkPath, listActiveWorkFiles } from "../artifacts/work.js";
import { atomicWriteFile } from "../fs/atomic-write.js";
import { parseMarkdownArtifact } from "../artifacts/markdown.js";
import { createCommandResult } from "../output/result.js";
import { addCurrentOperationEntry, appendLogEntry, updateStateForWork } from "./shared-artifacts.js";
import { syncManifestWithRuntime } from "./instance-metadata.js";

export async function runExecuteCommand({ args, flags, repoRoot }) {
  const [workId] = args;

  if (!workId) {
    return createCommandResult({
      ok: false,
      command: "execute",
      scope: "work",
      message: "missing work id",
      validation: { errors: 1, warnings: 0, infos: 0 }
    });
  }

  const workPath = await findActiveWorkPath(repoRoot, workId);

  if (!workPath) {
    return createCommandResult({
      ok: false,
      command: "execute",
      scope: "work",
      message: `no active work artifact found for ${workId}`,
      validation: { errors: 1, warnings: 0, infos: 0 }
    });
  }

  const current = await readFile(workPath, "utf8");
  const parsed = parseMarkdownArtifact(current);
  const currentStatus = parsed.frontmatter.status;
  const nextStatus = flags.review ? "review" : flags.monitoring ? "monitoring" : "active";

  if (!isAllowedExecutionTransition(currentStatus, nextStatus)) {
    return createCommandResult({
      ok: false,
      command: "execute",
      scope: "work",
      message: `cannot move ${workId} from ${currentStatus} to ${nextStatus}`,
      validation: { errors: 1, warnings: 0, infos: 0 }
    });
  }

  const updated = current.replace(/^status:\s*.*$/m, `status: ${nextStatus}`);
  await atomicWriteFile(workPath, updated);

  const activeWork = await listActiveWorkFiles(repoRoot);
  const date = new Date().toISOString().slice(0, 10);
  const changed = [path.relative(repoRoot, workPath)];
  const manifestPath = await syncManifestWithRuntime(repoRoot);

  changed.push(
    await updateStateForWork(repoRoot, {
      focus: buildFocus(workId, nextStatus),
      workEntries: activeWork,
      nextSafeAction: buildNextSafeAction(workId, nextStatus),
      checkpointSummary: buildCheckpointSummary(workId, nextStatus),
      openRisks:
        nextStatus === "monitoring"
          ? [`${workId} is waiting for external observation or acceptance evidence before review.`]
          : ["none"]
    })
  );
  changed.push(await addCurrentOperationEntry(repoRoot, path.basename(workPath)));
  changed.push(
    await appendLogEntry(repoRoot, {
      date,
      eventId: `execute-${workId}`,
      summary: `work ${workId} moved to ${nextStatus}`,
      bullets: [`Lifecycle transition: ${currentStatus} -> ${nextStatus}`]
    })
  );
  if (manifestPath) {
    changed.push(manifestPath);
  }

  return createCommandResult({
    ok: true,
    command: "execute",
    scope: "work",
    artifactsChanged: Array.from(new Set(changed)),
    validation: { errors: 0, warnings: 0, infos: 0 },
    message: `work ${workId} moved to ${nextStatus}`,
    details: `${currentStatus} -> ${nextStatus}`,
    nextSteps: buildNextSteps(workId, nextStatus),
    data: {
      work_id: workId,
      previous_status: currentStatus,
      next_status: nextStatus
    }
  });
}

function isAllowedExecutionTransition(currentStatus, nextStatus) {
  if (currentStatus === "ready" && nextStatus === "active") return true;
  if (currentStatus === "active" && nextStatus === "review") return true;
  if (currentStatus === "active" && nextStatus === "monitoring") return true;
  if (currentStatus === "monitoring" && nextStatus === "review") return true;
  return false;
}

function buildFocus(workId, nextStatus) {
  if (nextStatus === "active") return `executing work ${workId}`;
  if (nextStatus === "monitoring") return `monitoring work ${workId}`;
  return `work ${workId} is awaiting review`;
}

function buildNextSafeAction(workId, nextStatus) {
  if (nextStatus === "active") {
    return `Implement ${workId} and use yxg execute ${workId} --review when implementation is complete.`;
  }
  if (nextStatus === "monitoring") {
    return `Collect the required external evidence for ${workId}; move it to review only after the monitoring window is complete.`;
  }
  return `Run yxg review ${workId} --verdict=<pass|revise|escalate>.`;
}

function buildCheckpointSummary(workId, nextStatus) {
  if (nextStatus === "active") return `${workId} moved into active execution.`;
  if (nextStatus === "monitoring") {
    return `${workId} finished implementation and is waiting for external observation evidence before review.`;
  }
  return `${workId} finished implementation and is now awaiting review.`;
}

function buildNextSteps(workId, nextStatus) {
  if (nextStatus === "active") {
    return [`Implement ${workId} and move it to review with yxg execute ${workId} --review.`];
  }
  if (nextStatus === "monitoring") {
    return [
      `Keep ${workId} open while observation evidence is collected.`,
      `Move ${workId} to review with yxg execute ${workId} --review after the monitoring window is complete.`
    ];
  }
  return [`Run yxg review ${workId} --verdict=<pass|revise|escalate>.`];
}
