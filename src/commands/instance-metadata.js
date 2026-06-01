import { readFile } from "node:fs/promises";
import path from "node:path";
import { replaceSectionBody, bulletList } from "../artifacts/sections.js";
import { atomicWriteFile } from "../fs/atomic-write.js";
import { pathExists } from "../fs/exists.js";
import { getYxgRoot } from "../fs/paths.js";
import { applyFrontmatterValues } from "../templates/core.js";

const TOOL_PACKAGE_JSON = new URL("../../package.json", import.meta.url);

export async function syncManifestWithRuntime(repoRoot) {
  const manifestPath = path.join(getYxgRoot(repoRoot), "MANIFEST.md");

  if (!(await pathExists(manifestPath))) {
    return null;
  }

  const adapter = await detectPreferredAdapter(repoRoot);
  const date = new Date().toISOString().slice(0, 10);
  let content = applyFrontmatterValues(await readFile(manifestPath, "utf8"), {
    preferred_adapter: adapter.name,
    adapter_version: adapter.version,
    updated_at: date
  });

  content = replaceSectionBody(
    content,
    "## Kernel",
    bulletList([
      "Kernel version: 1",
      `Preferred adapter: ${adapter.name}`,
      `Adapter version: ${adapter.version}`
    ])
  );

  await atomicWriteFile(manifestPath, content);
  return path.relative(repoRoot, manifestPath);
}

async function detectPreferredAdapter(repoRoot) {
  const repoLocalPluginManifest = path.join(repoRoot, "plugins", "yxg", ".codex-plugin", "plugin.json");

  if (await pathExists(repoLocalPluginManifest)) {
    try {
      const parsed = JSON.parse(await readFile(repoLocalPluginManifest, "utf8"));
      return {
        name: "codex-repo-local-plugin",
        version: typeof parsed.version === "string" ? parsed.version : "unknown"
      };
    } catch {
      return {
        name: "codex-repo-local-plugin",
        version: "unknown"
      };
    }
  }

  try {
    const pkg = JSON.parse(await readFile(TOOL_PACKAGE_JSON, "utf8"));
    return {
      name: "yxg-cli",
      version: typeof pkg.version === "string" ? pkg.version : "unknown"
    };
  } catch {
    return {
      name: "yxg-cli",
      version: "unknown"
    };
  }
}
