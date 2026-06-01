import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function resolveRepoRoot(startCwd) {
  return path.resolve(startCwd);
}

export function getYxgRoot(repoRoot) {
  return path.join(repoRoot, ".yxg");
}

export function getCanonicalTemplatesRoot(repoRoot) {
  return path.join(TOOL_ROOT, "templates", "yxg");
}

export function getInstanceTemplatesRoot(repoRoot) {
  return path.join(getYxgRoot(repoRoot), "templates");
}

export function getWorkActiveRoot(repoRoot) {
  return path.join(getYxgRoot(repoRoot), "work", "active");
}

export function getWorkArchiveRoot(repoRoot) {
  return path.join(getYxgRoot(repoRoot), "work", "archive");
}
