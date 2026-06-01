import path from "node:path";
import { readFile } from "node:fs/promises";
import { parseMarkdownArtifact } from "../artifacts/markdown.js";
import { extractBulletValues, extractSectionBody, replaceSectionBody, bulletList } from "../artifacts/sections.js";
import { findActiveWorkPath, listActiveWorkFiles } from "../artifacts/work.js";
import { atomicWriteFile } from "../fs/atomic-write.js";
import { getYxgRoot } from "../fs/paths.js";
import { formatGitSummary, getGitContext } from "../git/context.js";
import { createCommandResult } from "../output/result.js";
import { loadCanonicalTemplate, prepareTemplate } from "../templates/core.js";
import { runValidation } from "../validation/index.js";
import { addCurrentOperationEntry, appendLogEntry, updateStateForWork } from "./shared-artifacts.js";
import { syncManifestWithRuntime } from "./instance-metadata.js";

const REVIEW_VERDICTS = {
  pass: "done",
  revise: "ready",
  escalate: "blocked"
};

export async function runReviewCommand({ args, flags, repoRoot }) {
  const [workId] = args;
  const verdict = flags.verdict;

  if (!workId) {
    return createCommandResult({
      ok: false,
      command: "review",
      scope: "review",
      message: "missing work id",
      validation: { errors: 1, warnings: 0, infos: 0 }
    });
  }

  if (!verdict || !Object.hasOwn(REVIEW_VERDICTS, verdict)) {
    return createCommandResult({
      ok: false,
      command: "review",
      scope: "review",
      message: "missing or invalid --verdict=pass|revise|escalate",
      validation: { errors: 1, warnings: 0, infos: 0 }
    });
  }

  const workPath = await findActiveWorkPath(repoRoot, workId);

  if (!workPath) {
    return createCommandResult({
      ok: false,
      command: "review",
      scope: "review",
      message: `no active work artifact found for ${workId}`,
      validation: { errors: 1, warnings: 0, infos: 0 }
    });
  }

  const workContent = await readFile(workPath, "utf8");
  const work = parseMarkdownArtifact(workContent);
  const gitContext = await getGitContext(repoRoot, { workPath });
  const reviewFilename = `${workId}-review.md`;
  const reviewPath = path.join(getYxgRoot(repoRoot), "reviews", reviewFilename);
  const date = new Date().toISOString().slice(0, 10);
  const changed = [];

  const reviewTemplate = await loadCanonicalTemplate(repoRoot, "REVIEW.md");
  const preparedReview = prepareReviewArtifact(reviewTemplate, {
    date,
    reviewId: `${workId}-review`,
    workId,
    verdict,
    workTitle: work.frontmatter.title ?? workId,
    workContent,
    gitContext,
    validation: null
  });

  await atomicWriteFile(reviewPath, preparedReview);
  changed.push(path.relative(repoRoot, reviewPath));

  const nextStatus = REVIEW_VERDICTS[verdict];
  const updatedWorkContent = workContent.replace(/^status:\s*.*$/m, `status: ${nextStatus}`);
  await atomicWriteFile(workPath, updatedWorkContent);
  changed.push(path.relative(repoRoot, workPath));
  const manifestPath = await syncManifestWithRuntime(repoRoot);
  if (manifestPath) {
    changed.push(manifestPath);
  }

  const activeWork = await listActiveWorkFiles(repoRoot);
  const validation =
    verdict === "pass"
      ? await runValidation({ repoRoot, scope: "work", target: workId })
      : await runValidation({ repoRoot, scope: "instance" });
  const finalReview = prepareReviewArtifact(reviewTemplate, {
    date,
    reviewId: `${workId}-review`,
    workId,
    verdict,
    workTitle: work.frontmatter.title ?? workId,
    workContent,
    gitContext,
    validation
  });
  await atomicWriteFile(reviewPath, finalReview);
  const statePath = await updateStateForWork(
    repoRoot,
    buildStateUpdate({ verdict, workId, activeWork, gitContext })
  );
  const indexPath = await addCurrentOperationEntry(repoRoot, reviewFilename);
  const logPath = await appendLogEntry(repoRoot, {
    date,
    eventId: `review-${workId}`,
    summary: `review recorded for ${workId}`,
    bullets: buildReviewLogBullets({ verdict, nextStatus, validation, gitContext })
  });

  changed.push(statePath, indexPath, logPath);
  const nextSteps = buildReviewNextSteps(workId, verdict, gitContext);

  return createCommandResult({
    ok: validation.ok,
    command: "review",
    scope: "review",
    artifactsChanged: Array.from(new Set(changed)),
    validation: validation.summary,
    message: validation.ok
      ? `review recorded for ${workId} with verdict ${verdict}`
      : `review recorded for ${workId} but validation failed`,
    details: `${workId} -> ${nextStatus} | ${formatGitSummary(gitContext)}`,
    nextSteps,
    data: {
      work_id: workId,
      review_file: reviewFilename,
      findings: validation.findings,
      verdict,
      next_status: nextStatus,
      git: gitContext.available ? gitContext : null
    }
  });
}

function prepareReviewArtifact(template, { date, reviewId, workId, verdict, workTitle, workContent, gitContext, validation }) {
  let content = prepareTemplate(template, {
    date,
    frontmatter: {
      id: reviewId,
      target_work_id: workId,
      verdict
    }
  });
  const objective = firstMeaningfulLine(extractSectionBody(workContent, "## Objective")) ?? workTitle;
  const verificationChecks = extractBulletValues(extractSectionBody(workContent, "## Verification")).filter(
    (line) => line !== "TODO" && line !== "none"
  );
  const evidenceLog = extractBulletValues(extractSectionBody(workContent, "## Evidence Log")).filter(
    (line) => line !== "none"
  );
  const touchPoints = (gitContext?.related_paths?.length ?? 0) > 0
    ? gitContext.related_paths
    : gitContext?.work_scope?.touch_points?.length
      ? gitContext.work_scope.touch_points
      : [];
  const findings = buildReviewFindings(verdict, validation, gitContext);
  const verificationResults = buildVerificationResults(validation, verificationChecks, evidenceLog, gitContext);
  const followUp = buildFollowUp(verdict, gitContext);

  content = replaceSectionBody(
    content,
    "## Scope Under Review",
    bulletList([
      `Work unit: ${workId}`,
      `Change set: ${touchPoints.length > 0 ? touchPoints.join(", ") : `current work artifact for ${workId}`}`,
      `Evaluator: yxg`
    ])
  );
  content = replaceSectionBody(
    content,
    "## Contract",
    bulletList([
      `Intended outcome: ${objective || workTitle}`,
      verificationChecks.length > 0
        ? `Required checks: ${verificationChecks.join("; ")}`
        : "Required checks: review the contract, recorded evidence, and validator output."
    ])
  );
  content = replaceSectionBody(content, "## Findings", bulletList(findings));
  content = replaceSectionBody(content, "## Verification Results", bulletList(verificationResults));
  content = replaceSectionBody(
    content,
    "## Verdict",
    `- Status: ${verdict}\n- Reason: ${buildReason(verdict)}`
  );
  content = replaceSectionBody(content, "## Follow-Up", bulletList(followUp));

  return content;
}

function buildReason(verdict) {
  if (verdict === "pass") return "Contract satisfied and work may be considered done.";
  if (verdict === "revise") return "Further bounded revisions are required before completion.";
  return "External escalation or blocking issue prevents completion.";
}

function buildFollowUp(verdict, gitContext) {
  if (verdict === "pass") {
    const bullets = ["Run cleanup to archive completed work and refresh baseline/state artifacts."];
    if (gitContext?.suggested_commit_trailer) {
      bullets.push(`Suggested commit trailer: ${gitContext.suggested_commit_trailer}`);
    }
    if (gitContext?.unrelated_count > 0) {
      bullets.push(`Inspect unrelated repository changes: ${gitContext.unrelated_paths.join(", ")}`);
    }
    return bullets;
  }

  if (verdict === "revise") return ["Update the work unit and rerun review after revisions."];
  return ["Resolve the blocker or escalation path before resuming work."];
}

function buildStateUpdate({ verdict, workId, activeWork, gitContext }) {
  if (verdict === "pass") {
    return {
      focus: `reviewed work ${workId}`,
      workEntries: activeWork,
      nextSafeAction:
        gitContext?.unrelated_count > 0
          ? `Archive ${workId} with cleanup, then resolve unrelated repository changes before moving on.`
          : `Archive ${workId} with cleanup or create the next work unit.`,
      checkpointSummary: `Review passed for ${workId}; the work is ready to be archived on the next cleanup run.`,
      openRisks:
        gitContext?.unrelated_count > 0
          ? [`Unrelated repository changes remain: ${gitContext.unrelated_paths.join(", ")}.`]
          : ["none"]
    };
  }

  if (verdict === "revise") {
    return {
      focus: `revising work ${workId}`,
      workEntries: activeWork,
      nextSafeAction: `Update ${workId} and rerun yxg review ${workId} --verdict=pass when revisions are complete.`,
      checkpointSummary: `Review for ${workId} requested bounded revisions before the work can be closed.`,
      openRisks: ["none"]
    };
  }

  return {
    focus: `blocked work ${workId}`,
    workEntries: activeWork,
    nextSafeAction: `Resolve the blocker for ${workId} before resuming implementation.`,
    checkpointSummary: `Review escalated ${workId}; the work is blocked pending an external resolution path.`,
    openRisks: [`${workId} is currently blocked and cannot be closed yet.`]
  };
}

function buildReviewLogBullets({ verdict, nextStatus, validation, gitContext }) {
  const bullets = [
    `Verdict: ${verdict}`,
    `Work transitioned to ${nextStatus}.`,
    `Validation summary: ${validation.summary.errors} error(s), ${validation.summary.warnings} warning(s), ${validation.summary.infos} info finding(s).`
  ];

  if (gitContext?.suggested_commit_trailer) {
    bullets.push(`Suggested commit trailer: ${gitContext.suggested_commit_trailer}`);
  }
  if (gitContext?.unrelated_count > 0) {
    bullets.push(`Unrelated repository changes remain: ${gitContext.unrelated_paths.join(", ")}`);
  }

  return bullets;
}

function buildReviewFindings(verdict, validation, gitContext) {
  const findings = validation?.findings?.slice(0, 4).map((finding) => `${finding.rule_id}: ${finding.message}`) ?? [];

  if (gitContext?.unrelated_count > 0) {
    findings.push(`Repository contains unrelated changes outside the current work: ${gitContext.unrelated_paths.join(", ")}`);
  }

  if (findings.length > 0) {
    return findings;
  }

  if (verdict === "pass") {
    return ["none found after contract review, recorded evidence review, and validator checks"];
  }

  return ["none"];
}

function buildVerificationResults(validation, verificationChecks, evidenceLog, gitContext) {
  const results = [];

  if (verificationChecks.length > 0) {
    results.push(`Planned checks reviewed: ${verificationChecks.join("; ")}`);
  }

  if (evidenceLog.length > 0) {
    results.push(...evidenceLog.slice(0, 4));
  }

  if (validation) {
    results.push(
      `Validator summary: ${validation.summary.errors} error(s), ${validation.summary.warnings} warning(s), ${validation.summary.infos} info finding(s).`
    );
  }

  if (gitContext?.related_count > 0) {
    results.push(`Related repository changes under review: ${gitContext.related_paths.join(", ")}`);
  }

  return results.length > 0 ? results : ["Review completed against the current work contract and repository state."];
}

function firstMeaningfulLine(sectionBody) {
  return sectionBody
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !/^(Describe|Write|List)\b/.test(line) && line !== "TODO") ?? null;
}

function buildReviewNextSteps(workId, verdict, gitContext) {
  const steps = [];

  if (verdict === "pass") {
    steps.push(
      `Run yxg cleanup when you want to archive completed work for ${workId}.`,
      "Create the next work unit if more work remains."
    );
    if (gitContext?.available) {
      if (gitContext.suggested_commit_trailer) {
        steps.push(`Suggested commit trailer: ${gitContext.suggested_commit_trailer}`);
      }
      if (gitContext.unrelated_count > 0) {
        steps.push(
          `Inspect unrelated repository changes before finalizing: ${gitContext.unrelated_paths.join(", ")}`
        );
      }
    }
    return steps;
  }

  if (verdict === "revise") {
    steps.push(`Revise ${workId} and rerun yxg review ${workId} --verdict=pass when ready.`);
    return steps;
  }

  steps.push(`Resolve the blocker for ${workId} before moving it back into execution.`);
  return steps;
}
