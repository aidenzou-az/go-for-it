import { readFile } from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { parseMarkdownArtifact } from "../artifacts/markdown.js";
import { extractBulletValues, extractSectionBody } from "../artifacts/sections.js";

const execFile = promisify(execFileCallback);

export async function getGitContext(repoRoot, { workPath = null } = {}) {
  const repoInfo = await readGitRepoInfo(repoRoot);

  if (!repoInfo.inside_work_tree) {
    return {
      available: false,
      inside_work_tree: false
    };
  }

  const changedPaths = await readChangedPaths(repoRoot);
  const workScope = workPath ? await readWorkScope(repoRoot, workPath) : null;
  const classified = classifyChangedPaths(changedPaths, workScope);
  const suggestedBranch = workScope?.work_id
    ? buildSuggestedBranchName(workScope.work_id, workScope.slug)
    : null;
  const suggestedCommitTrailer = workScope?.work_id ? `YXG-Work: ${workScope.work_id}` : null;
  const branchAlignment = buildBranchAlignment(repoInfo.branch, suggestedBranch);

  return {
    available: true,
    inside_work_tree: true,
    branch: repoInfo.branch,
    clean: changedPaths.length === 0,
    changed_paths: changedPaths,
    changed_count: changedPaths.length,
    related_paths: classified.related_paths,
    related_count: classified.related_paths.length,
    kernel_paths: classified.kernel_paths,
    kernel_count: classified.kernel_paths.length,
    unrelated_paths: classified.unrelated_paths,
    unrelated_count: classified.unrelated_paths.length,
    suggested_branch: suggestedBranch,
    suggested_commit_trailer: suggestedCommitTrailer,
    branch_matches_recommended_work: branchAlignment.matches,
    branch_mismatch_reason: branchAlignment.reason,
    work_scope: workScope
      ? {
          work_id: workScope.work_id,
          slug: workScope.slug,
          title: workScope.title,
          touch_points: workScope.touch_points
        }
      : null
  };
}

export function formatGitSummary(gitContext) {
  if (!gitContext?.available) {
    return "git: unavailable";
  }

  if (gitContext.clean) {
    return `git: clean on ${gitContext.branch || "detached"}`;
  }

  const segments = [
    `git: dirty on ${gitContext.branch || "detached"}`,
    `${gitContext.related_count} related`,
    `${gitContext.kernel_count} kernel`,
    `${gitContext.unrelated_count} unrelated`
  ];

  if (gitContext.branch_matches_recommended_work === false) {
    segments.push("branch mismatch");
  }

  return segments.join(" | ");
}

export function buildSuggestedBranchName(workId, slug) {
  const normalizedId = String(workId).toLowerCase();
  const normalizedSlug = String(slug || "work")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "work";

  return `yxg/${normalizedId}-${normalizedSlug}`;
}

function buildBranchAlignment(currentBranch, suggestedBranch) {
  if (!suggestedBranch) {
    return {
      matches: null,
      reason: null
    };
  }

  if (!currentBranch || currentBranch === "detached") {
    return {
      matches: false,
      reason: `current git HEAD is detached; suggested branch is ${suggestedBranch}`
    };
  }

  if (currentBranch === suggestedBranch) {
    return {
      matches: true,
      reason: null
    };
  }

  return {
    matches: false,
    reason: `current branch ${currentBranch} does not match suggested branch ${suggestedBranch}`
  };
}

async function readGitRepoInfo(repoRoot) {
  try {
    const inside = await execGit(repoRoot, ["rev-parse", "--is-inside-work-tree"]);
    if (inside.trim() !== "true") {
      return { inside_work_tree: false, branch: null };
    }

    const branch = await execGit(repoRoot, ["branch", "--show-current"]);
    return {
      inside_work_tree: true,
      branch: branch.trim() || "detached"
    };
  } catch {
    return {
      inside_work_tree: false,
      branch: null
    };
  }
}

async function readChangedPaths(repoRoot) {
  try {
    const stdout = await execGit(repoRoot, ["status", "--porcelain"]);
    return stdout
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map(extractPathFromPorcelain)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function extractPathFromPorcelain(line) {
  const payload = line.slice(3).trim();
  if (payload.includes(" -> ")) {
    return payload.split(" -> ").at(-1).trim().replace(/\\/g, "/");
  }

  return payload.replace(/\\/g, "/");
}

async function readWorkScope(repoRoot, workPath) {
  const content = await readFile(workPath, "utf8");
  const parsed = parseMarkdownArtifact(content);
  const touchPoints = extractBulletValues(extractSectionBody(content, "## Expected Touch Points")).map(
    normalizeTouchPoint
  ).filter(Boolean);

  return {
    work_id: parsed.frontmatter.id ?? path.basename(workPath, path.extname(workPath)),
    slug: parsed.frontmatter.slug ?? "work",
    title: parsed.frontmatter.title ?? parsed.frontmatter.id ?? "work",
    touch_points: touchPoints
  };
}

function normalizeTouchPoint(value) {
  return value
    .replace(/^`|`$/g, "")
    .split(/\s*[\(（]/)[0]
    .trim()
    .replace(/\\/g, "/");
}

function classifyChangedPaths(paths, workScope) {
  const related_paths = [];
  const kernel_paths = [];
  const unrelated_paths = [];
  const touchPoints = workScope?.touch_points ?? [];

  for (const changedPath of paths) {
    if (isLocalRuntimePath(changedPath)) {
      continue;
    }

    if (isKernelSharedPath(changedPath)) {
      kernel_paths.push(changedPath);
      continue;
    }

    if (touchPoints.length > 0 && touchPoints.some((touchPoint) => matchesTouchPoint(changedPath, touchPoint))) {
      related_paths.push(changedPath);
      continue;
    }

    unrelated_paths.push(changedPath);
  }

  return {
    related_paths,
    kernel_paths,
    unrelated_paths
  };
}

function matchesTouchPoint(changedPath, touchPoint) {
  if (!touchPoint) {
    return false;
  }

  if (changedPath === touchPoint) {
    return true;
  }

  if (changedPath.startsWith(`${touchPoint}/`)) {
    return true;
  }

  const changedBase = path.posix.basename(changedPath);
  const touchBase = path.posix.basename(touchPoint);
  return changedBase === touchBase && !touchPoint.includes("/");
}

function isLocalRuntimePath(changedPath) {
  return changedPath === ".yxg/" || [
    ".yxg/STATE.md",
    ".yxg/INDEX.md",
    ".yxg/LOG.md"
  ].includes(changedPath) || changedPath.startsWith(".yxg/logs/") || changedPath.startsWith(".yxg/templates/");
}

function isKernelSharedPath(changedPath) {
  return changedPath === ".yxg/MANIFEST.md" ||
    changedPath === ".yxg/PROJECT.md" ||
    changedPath === ".yxg/ROADMAP.md" ||
    changedPath.startsWith(".yxg/work/") ||
    changedPath.startsWith(".yxg/reviews/") ||
    changedPath.startsWith(".yxg/handoffs/") ||
    changedPath.startsWith(".yxg/threads/") ||
    changedPath.startsWith(".yxg/baseline/");
}

async function execGit(repoRoot, args) {
  const { stdout } = await execFile("git", args, {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return stdout;
}
