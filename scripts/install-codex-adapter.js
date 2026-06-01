#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installCodexAdapter } from "../src/codex/install-adapter.js";

const [, , rawTargetPath] = process.argv;

if (!rawTargetPath) {
  console.error("Usage: node ./scripts/install-codex-adapter.js <target-repo-path>");
  process.exitCode = 1;
} else {
  const sourceRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const targetRepoRoot = path.resolve(rawTargetPath);
  const result = await installCodexAdapter({ sourceRepoRoot, targetRepoRoot });

  console.log(`Installed yxg Codex adapter into ${targetRepoRoot}`);
  console.log(`plugin: ${result.plugin_root}`);
  console.log(`marketplace: ${result.marketplace}`);
  console.log("Next steps:");
  console.log("- Run npm run verify:codex-adapter -- <target-repo-path> to confirm repo-local adapter assets.");
  console.log("- Open Codex in the target repository and manually install or enable the local yxg plugin.");
  console.log("- After manual enablement, retry $yxg:yxg-plan <task> or /yxg:plan <task>.");
}
