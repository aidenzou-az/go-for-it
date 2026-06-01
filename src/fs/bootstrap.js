import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile } from "./atomic-write.js";
import { pathExists } from "./exists.js";
import {
  getCanonicalTemplatesRoot,
  getInstanceTemplatesRoot,
  getWorkActiveRoot,
  getWorkArchiveRoot,
  getYxgRoot
} from "./paths.js";

export const DEFAULT_SCAFFOLD_DIRECTORIES = [
  ".yxg/work/active",
  ".yxg/work/archive",
  ".yxg/reviews",
  ".yxg/handoffs",
  ".yxg/templates"
];

export async function ensureDefaultScaffoldDirectories(repoRoot) {
  const yxgRoot = getYxgRoot(repoRoot);

  await mkdir(yxgRoot, { recursive: true });
  await mkdir(getWorkActiveRoot(repoRoot), { recursive: true });
  await mkdir(getWorkArchiveRoot(repoRoot), { recursive: true });
  await mkdir(path.join(yxgRoot, "reviews"), { recursive: true });
  await mkdir(path.join(yxgRoot, "handoffs"), { recursive: true });
  await mkdir(getInstanceTemplatesRoot(repoRoot), { recursive: true });
}

export async function syncCanonicalTemplatesToInstance(repoRoot, { writeMode = "overwrite" } = {}) {
  const canonicalRoot = getCanonicalTemplatesRoot(repoRoot);
  const instanceRoot = getInstanceTemplatesRoot(repoRoot);
  const changed = [];

  await mkdir(instanceRoot, { recursive: true });

  for (const filename of await readdir(canonicalRoot)) {
    const sourcePath = path.join(canonicalRoot, filename);
    const targetPath = path.join(instanceRoot, filename);
    const targetExists = await pathExists(targetPath);

    if (targetExists && writeMode === "missing-only") {
      continue;
    }

    const content = await readFile(sourcePath, "utf8");
    await atomicWriteFile(targetPath, content);
    changed.push(path.relative(repoRoot, targetPath));
  }

  return changed;
}
