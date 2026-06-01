import path from "node:path";
import { readFile } from "node:fs/promises";
import { parseMarkdownArtifact } from "../artifacts/markdown.js";
import {
  findActiveWorkPath,
  getNextGeneratedWorkId,
  listActiveWorkFiles,
  sanitizeWorkArtifactContent
} from "../artifacts/work.js";
import { atomicWriteFile } from "../fs/atomic-write.js";
import { getWorkActiveRoot } from "../fs/paths.js";
import { buildSuggestedBranchName, getGitContext } from "../git/context.js";
import { createCommandResult } from "../output/result.js";
import { loadCanonicalTemplate, prepareTemplate } from "../templates/core.js";
import { runValidation } from "../validation/index.js";
import {
  addCurrentOperationEntry,
  appendLogEntry,
  checkRequiredInstanceArtifacts,
  updateStateForWork
} from "./shared-artifacts.js";
import { syncManifestWithRuntime } from "./instance-metadata.js";

export async function runPlanCommand({ args, flags, repoRoot }) {
  const taskDescription = typeof flags.task === "string" ? flags.task.trim() : "";
  const [positionalWorkId] = args;
  const workId = taskDescription ? await getNextGeneratedWorkId(repoRoot) : positionalWorkId;

  const missingInstanceArtifacts = await checkRequiredInstanceArtifacts(repoRoot, [
    "MANIFEST.md",
    "STATE.md",
    "INDEX.md",
    "LOG.md"
  ]);

  if (missingInstanceArtifacts.length > 0) {
    return createCommandResult({
      ok: false,
      command: "plan",
      scope: "work",
      message: "missing .yxg scaffold; initialize the framework first",
      validation: { errors: 1, warnings: 0, infos: 0 },
      details: `missing required artifacts: ${missingInstanceArtifacts.join(", ")}`,
      nextSteps: [
        "For a new repository, run yxg init first.",
        "For an existing repository, run yxg import first so planning starts from an imported baseline."
      ],
      data: {
        missing_artifacts: missingInstanceArtifacts
      }
    });
  }

  if (!workId) {
    return createCommandResult({
      ok: false,
      command: "plan",
      scope: "work",
      message: "missing work id",
      validation: { errors: 1, warnings: 0, infos: 0 }
    });
  }

  if (taskDescription && taskDescription.length < 3) {
    return createCommandResult({
      ok: false,
      command: "plan",
      scope: "work",
      message: "task description is too short",
      validation: { errors: 1, warnings: 0, infos: 0 },
      details: "provide a concrete natural-language task description with at least a few characters",
      nextSteps: ["Retry with a fuller task description, for example: yxg plan --task=\"增加降水概率显示\"."],
      data: {
        task: taskDescription
      }
    });
  }

  if (!taskDescription && !isValidWorkId(workId)) {
    return createCommandResult({
      ok: false,
      command: "plan",
      scope: "work",
      message: "invalid work id",
      validation: { errors: 1, warnings: 0, infos: 0 },
      details:
        "work ids must be ASCII machine identifiers without spaces; use a stable ID like WU-001 and pass human text via --slug and --title",
      nextSteps: [
        'Retry with a stable ID, for example: yxg plan WU-001 --slug=rain-probability --title="Add rain probability display".',
        'Or use natural-language intake, for example: yxg plan --task="增加降水概率显示".'
      ],
      data: {
        work_id: workId
      }
    });
  }

  const existingPath = await findActiveWorkPath(repoRoot, workId);
  const existingMetadata = existingPath
    ? parseMarkdownArtifact(await readFile(existingPath, "utf8")).frontmatter
    : {};
  const slug =
    flags.slug ??
    existingMetadata.slug ??
    (taskDescription ? inferSlugFromTask(taskDescription, workId) : inferSlugFromId(workId));
  const title = flags.title ?? existingMetadata.title ?? (taskDescription || inferTitleFromSlug(slug));
  const date = new Date().toISOString().slice(0, 10);
  const changed = [];
  let workPath = existingPath;

  if (!workPath) {
    const template = await loadCanonicalTemplate(repoRoot, "WORK.md");
    const prepared = prepareTemplate(template, {
      date,
      frontmatter: {
        id: workId,
        slug,
        title
      }
    });

    workPath = path.join(getWorkActiveRoot(repoRoot), `${workId}-${slug}.md`);
    await atomicWriteFile(workPath, prepared);
    changed.push(path.relative(repoRoot, workPath));
  } else if (flags.ready) {
    const current = await readFile(workPath, "utf8");
    const sanitizedCurrent = sanitizeWorkArtifactContent(current);
    const updated = sanitizedCurrent.replace(/^status:\s*.*$/m, "status: ready");
    await atomicWriteFile(workPath, updated);
    changed.push(path.relative(repoRoot, workPath));
  }

  const workFilename = path.basename(workPath);
  const workRelativePath = path.relative(repoRoot, workPath).replace(/\\/g, "/");
  const activeWork = await listActiveWorkFiles(repoRoot);
  const manifestPath = await syncManifestWithRuntime(repoRoot);
  const statePath = await updateStateForWork(repoRoot, {
    focus: `planning work ${workId}`,
    workEntries: activeWork,
    nextSafeAction: flags.ready
      ? `Review validation findings for ${workId} or proceed to execution if validation passes.`
      : `Refine ${workFilename} and rerun yxg plan ${workId} --ready when the contract is complete.`,
    checkpointSummary: flags.ready
      ? `Work ${workId} passed ready validation and is available for execution.`
      : `Work ${workId} exists as a draft contract and still needs planning detail before execution.`,
    openRisks: ["none"]
  });
  const indexPath = await addCurrentOperationEntry(repoRoot, workFilename);
  const logPath = await appendLogEntry(repoRoot, {
    date,
    eventId: `plan-${workId}`,
    summary: flags.ready ? `attempted ready transition for ${workId}` : `created or updated work ${workId}`,
    bullets: [
      `Work artifact: ${workFilename}`,
      flags.ready ? "Requested ready-state validation." : "Work remains in draft until explicitly moved to ready."
    ]
  });

  changed.push(statePath, indexPath, logPath);
  if (manifestPath) {
    changed.push(manifestPath);
  }

  let validation = { ok: true, summary: { errors: 0, warnings: 0, infos: 0 }, findings: [] };

  if (flags.ready) {
    validation = await runValidation({ repoRoot, scope: "work", target: workId });

    if (!validation.ok) {
      const current = await readFile(workPath, "utf8");
      const reverted = current.replace(/^status:\s*ready$/m, "status: draft");
      await atomicWriteFile(workPath, reverted);

      return createCommandResult({
        ok: false,
        command: "plan",
        scope: "work",
        artifactsChanged: Array.from(new Set(changed)),
        validation: validation.summary,
        message: `work ${workId} failed ready validation`,
        details: buildValidationDetails(validation),
        nextSteps: [
          `Fill the missing contract sections in ${workFilename}.`,
          `Rerun yxg plan ${workId} --ready after the validator passes.`
        ],
        data: {
          findings: validation.findings,
          work_id: workId,
          work_file: workFilename
        }
      });
    }
  } else {
    validation = await runValidation({ repoRoot, scope: "work", target: workId });
  }

  const gitContext = await getGitContext(repoRoot, { workPath });
  const suggestedBranch = buildSuggestedBranchName(workId, slug);
  const nextSteps = flags.ready
    ? [`Use yxg execute ${workId} to move the work into active execution.`]
    : [`Complete the contract in ${workFilename} and rerun yxg plan ${workId} --ready.`];

  if (gitContext.available) {
    nextSteps.push(`Suggested branch: ${suggestedBranch}`);
  }

  return createCommandResult({
    ok: true,
    command: "plan",
    scope: "work",
    artifactsChanged: Array.from(new Set(changed)),
    validation: validation.summary,
    message: flags.ready ? `work ${workId} is ready` : `work ${workId} is in draft`,
    details: flags.ready
      ? `validated ${workId} for ready state`
      : `created or updated ${workFilename}`,
    nextSteps,
    data: {
      work_id: workId,
      auto_generated_work_id: Boolean(taskDescription),
      work_file: workFilename,
      work_path: workRelativePath,
      slug,
      title,
      suggested_branch: suggestedBranch,
      suggested_commit_trailer: `YXG-Work: ${workId}`,
      intake_mode: taskDescription ? "task" : "explicit-work-id",
      task: taskDescription || null,
      git: gitContext.available ? gitContext : null,
      findings: validation.findings
    }
  });
}

function inferSlugFromId(workId) {
  return workId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "work";
}

function inferSlugFromTask(taskDescription, workId) {
  const asciiWords = taskDescription
    .toLowerCase()
    .replace(/["'“”‘’()]/g, " ")
    .match(/[a-z0-9]+/g);

  if (asciiWords && asciiWords.length > 0) {
    return asciiWords.slice(0, 4).join("-").replace(/^-+|-+$/g, "") || inferFallbackTaskSlug(workId);
  }

  return inferFallbackTaskSlug(workId);
}

function inferFallbackTaskSlug(workId) {
  const numericPart = workId.match(/(\d+)/)?.[1];
  return numericPart ? `work-${numericPart}` : "work";
}

function inferTitleFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function buildValidationDetails(validation) {
  if (validation.findings.length === 0) {
    return "no findings";
  }

  return validation.findings
    .slice(0, 3)
    .map((finding) => `${finding.rule_id}: ${finding.message}`)
    .join(" | ");
}

function isValidWorkId(workId) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(workId);
}
