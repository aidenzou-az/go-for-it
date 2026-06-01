import { mkdir, readFile, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { parseMarkdownArtifact } from "../artifacts/markdown.js";
import { pathExists } from "../fs/exists.js";
import { getWorkActiveRoot, getWorkArchiveRoot, getYxgRoot } from "../fs/paths.js";
import { formatGitSummary, getGitContext } from "../git/context.js";
import { createCommandResult } from "../output/result.js";
import { runValidation } from "../validation/index.js";
import { refreshImportBaseline } from "./import-command.js";
import { syncManifestWithRuntime } from "./instance-metadata.js";
import {
  appendLogEntry,
  checkRequiredInstanceArtifacts,
  listCurrentWorkEntries,
  rebuildIndexFromRepoState,
  updateStateForWork
} from "./shared-artifacts.js";

export async function runCleanupCommand({ repoRoot }) {
  const missingInstanceArtifacts = await checkRequiredInstanceArtifacts(repoRoot, [
    "STATE.md",
    "INDEX.md",
    "LOG.md"
  ]);

  if (missingInstanceArtifacts.length > 0) {
    return createCommandResult({
      ok: false,
      command: "cleanup",
      scope: "instance",
      message: "missing .yxg scaffold; initialize the framework first",
      validation: { errors: 1, warnings: 0, infos: 0 },
      details: `missing required artifacts: ${missingInstanceArtifacts.join(", ")}`,
      nextSteps: ["Run yxg init before cleanup operations."],
      data: {
        missing_artifacts: missingInstanceArtifacts
      }
    });
  }

  const changed = [];
  const date = new Date().toISOString().slice(0, 10);
  const archived = await archiveCompletedWork(repoRoot);
  changed.push(...archived.map((entry) => entry.archived_path));
  const baselineRoot = path.join(getYxgRoot(repoRoot), "baseline");
  if (await pathExists(baselineRoot)) {
    const refreshed = await refreshImportBaseline(repoRoot, {
      date,
      recentWorkIds: archived.map((entry) => entry.work_id)
    });
    changed.push(...refreshed.changed);
  }
  const manifestPath = await syncManifestWithRuntime(repoRoot);
  if (manifestPath) {
    changed.push(manifestPath);
  }
  changed.push(await rebuildIndexFromRepoState(repoRoot));
  const currentWorkEntries = await listCurrentWorkEntries(repoRoot);
  const archivedWorkForGit = archived.length === 1 ? archived[0].archived_abs_path : null;
  const gitContext = await getGitContext(repoRoot, { workPath: archivedWorkForGit });
  changed.push(
    await updateStateForWork(repoRoot, {
      focus:
        archived.length > 0 && currentWorkEntries.length === 0
          ? "no active work; cleanup completed"
          : archived.length > 0
            ? "cleanup completed"
            : "cleanup checked current state",
      workEntries: currentWorkEntries,
      nextSafeAction:
        gitContext.available && gitContext.unrelated_count > 0
          ? "Resolve unrelated repository changes before starting or finalizing the next work unit."
          : currentWorkEntries.length > 0
            ? "Continue the remaining active work or create the next work unit."
            : "Create the next work unit when ready.",
      checkpointSummary:
        archived.length > 0
          ? `Archived completed work ${archived.map((entry) => entry.work_id).join(", ")} and refreshed repository baseline knowledge.`
          : "Cleanup confirmed the current repository and yxg state without archiving additional work.",
      openRisks:
        gitContext.available && gitContext.unrelated_count > 0
          ? [`Unrelated repository changes remain: ${gitContext.unrelated_paths.join(", ")}.`]
          : ["none"]
    })
  );
  changed.push(
    await appendLogEntry(repoRoot, {
      date,
      eventId: "cleanup",
      summary: "cleanup run completed",
      bullets: [
        archived.length > 0
          ? `Archived ${archived.length} completed work artifact(s): ${archived.map((entry) => entry.work_id).join(", ")}.`
          : "No completed work artifacts required archiving.",
        await pathExists(baselineRoot)
          ? "Refreshed onboarding baseline artifacts from the latest repository state."
          : "No baseline refresh was needed because onboarding artifacts do not exist yet."
      ]
    })
  );

  const validation = await runValidation({ repoRoot, scope: "instance" });
  const nextSteps = [
    archived.length > 0 && currentWorkEntries.length === 0
      ? "The current work has been archived; start the next work unit when ready."
      : archived.length > 0
        ? "Review archive/history and continue with the remaining active work."
        : "No archive action was needed; continue active work or create the next work unit."
  ];

  if (gitContext.available) {
    if (gitContext.unrelated_count > 0) {
      nextSteps.push(
        `Inspect unrelated repository changes before considering the finish path complete: ${gitContext.unrelated_paths.join(", ")}`
      );
    }
    if (gitContext.clean) {
      nextSteps.push("Repository worktree is clean.");
    }
  }

  return createCommandResult({
    ok: validation.ok,
    command: "cleanup",
    scope: "instance",
    artifactsChanged: Array.from(new Set(changed.filter(Boolean))),
    validation: validation.summary,
    message: validation.ok ? "cleanup completed" : "cleanup completed with validation errors",
    details: `${archived.length > 0 ? `archived ${archived.length} work artifact(s)` : "no completed work archived"} | ${formatGitSummary(gitContext)}`,
    nextSteps,
    data: {
      findings: validation.findings,
      archived_count: archived.length,
      archived_work_ids: archived.map((entry) => entry.work_id),
      git: gitContext.available ? gitContext : null
    }
  });
}

async function archiveCompletedWork(repoRoot) {
  const activeRoot = getWorkActiveRoot(repoRoot);
  const archiveRoot = getWorkArchiveRoot(repoRoot);
  const archived = [];

  if (!(await pathExists(activeRoot))) {
    return archived;
  }

  await mkdir(archiveRoot, { recursive: true });

  for (const filename of await readdir(activeRoot)) {
    const activePath = path.join(activeRoot, filename);
    const content = await readFile(activePath, "utf8");
    const parsed = parseMarkdownArtifact(content);

    if (parsed.frontmatter.status === "done") {
      const archivePath = path.join(archiveRoot, filename);
      await rename(activePath, archivePath);
      archived.push({
        work_id: parsed.frontmatter.id ?? filename,
        archived_path: path.relative(repoRoot, archivePath),
        archived_abs_path: archivePath
      });
    }
  }

  return archived;
}
