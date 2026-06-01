#!/usr/bin/env node
import path from "node:path";
import { verifyCodexAdapter } from "../src/codex/verify-adapter.js";

const [, , rawTargetPath] = process.argv;

if (!rawTargetPath) {
  console.error("Usage: node ./scripts/verify-codex-adapter.js <target-repo-path>");
  process.exitCode = 1;
} else {
  const targetRepoRoot = path.resolve(rawTargetPath);
  const result = await verifyCodexAdapter({ targetRepoRoot });

  console.log(`Verified yxg Codex adapter assets in ${targetRepoRoot}`);
  console.log(`plugin: ${result.plugin_root}`);
  console.log(`plugin manifest: ${result.plugin_manifest}`);
  console.log(`marketplace: ${result.marketplace}`);

  const errors = result.findings.filter((finding) => finding.level === "error");
  const infos = result.findings.filter((finding) => finding.level === "info");

  if (errors.length > 0) {
    for (const finding of errors) {
      console.log(`ERROR ${finding.rule_id}: ${finding.message}`);
      if (finding.suggested_fix) {
        console.log(`  fix: ${finding.suggested_fix}`);
      }
    }
    process.exitCode = 1;
  } else {
    console.log("Adapter files look correct.");
  }

  for (const finding of infos) {
    console.log(`INFO ${finding.rule_id}: ${finding.message}`);
    if (finding.suggested_fix) {
      console.log(`  next: ${finding.suggested_fix}`);
    }
  }
}
