import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../fs/exists.js";

export async function verifyCodexAdapter({ targetRepoRoot }) {
  const pluginRoot = path.join(targetRepoRoot, "plugins", "yxg");
  const pluginManifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
  const marketplacePath = path.join(targetRepoRoot, ".agents", "plugins", "marketplace.json");
  const findings = [];

  if (!(await pathExists(pluginRoot))) {
    findings.push({
      level: "error",
      rule_id: "codex.adapter.plugin_root_missing",
      message: "missing plugins/yxg in the target repository",
      suggested_fix: "Run the codex adapter installer again."
    });
  }

  if (!(await pathExists(pluginManifestPath))) {
    findings.push({
      level: "error",
      rule_id: "codex.adapter.plugin_manifest_missing",
      message: "missing plugins/yxg/.codex-plugin/plugin.json",
      suggested_fix: "Reinstall the repo-local yxg plugin."
    });
  }

  if (!(await pathExists(marketplacePath))) {
    findings.push({
      level: "error",
      rule_id: "codex.adapter.marketplace_missing",
      message: "missing .agents/plugins/marketplace.json",
      suggested_fix: "Reinstall the adapter to seed marketplace metadata."
    });
  }

  let pluginManifest = null;
  if (findings.every((finding) => finding.rule_id !== "codex.adapter.plugin_manifest_missing")) {
    try {
      pluginManifest = JSON.parse(await readFile(pluginManifestPath, "utf8"));
    } catch {
      findings.push({
        level: "error",
        rule_id: "codex.adapter.plugin_manifest_invalid",
        message: "plugin manifest is not valid JSON",
        suggested_fix: "Reinstall the adapter to refresh plugins/yxg/.codex-plugin/plugin.json."
      });
    }
  }

  let marketplace = null;
  if (findings.every((finding) => finding.rule_id !== "codex.adapter.marketplace_missing")) {
    try {
      marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
    } catch {
      findings.push({
        level: "error",
        rule_id: "codex.adapter.marketplace_invalid",
        message: "marketplace.json is not valid JSON",
        suggested_fix: "Reinstall the adapter to rewrite marketplace metadata."
      });
    }
  }

  if (pluginManifest && pluginManifest.name !== "yxg") {
    findings.push({
      level: "error",
      rule_id: "codex.adapter.plugin_name_mismatch",
      message: `plugin manifest name is ${pluginManifest.name}, expected yxg`,
      suggested_fix: "Reinstall the adapter to restore the yxg plugin scaffold."
    });
  }

  const marketplaceEntry = marketplace?.plugins?.find((plugin) => plugin?.name === "yxg") ?? null;
  if (marketplace && !marketplaceEntry) {
    findings.push({
      level: "error",
      rule_id: "codex.adapter.marketplace_entry_missing",
      message: "marketplace.json does not contain a yxg plugin entry",
      suggested_fix: "Reinstall the adapter to add the yxg marketplace entry."
    });
  } else if (marketplaceEntry?.source?.path !== "./plugins/yxg") {
    findings.push({
      level: "error",
      rule_id: "codex.adapter.marketplace_path_mismatch",
      message: `yxg marketplace path is ${marketplaceEntry?.source?.path ?? "unknown"}, expected ./plugins/yxg`,
      suggested_fix: "Reinstall the adapter to normalize the yxg marketplace entry."
    });
  }

  findings.push({
    level: "info",
    rule_id: "codex.adapter.manual_enable_required",
    message: "repo-local plugin files are present; Codex still requires a manual install or enable step inside the target repository UI",
    suggested_fix: "Open Codex in the target repo and manually install or enable the local yxg plugin before testing $yxg:* or /yxg:*."
  });

  return {
    ok: findings.every((finding) => finding.level !== "error"),
    plugin_root: path.relative(targetRepoRoot, pluginRoot).replace(/\\/g, "/"),
    plugin_manifest: path.relative(targetRepoRoot, pluginManifestPath).replace(/\\/g, "/"),
    marketplace: path.relative(targetRepoRoot, marketplacePath).replace(/\\/g, "/"),
    findings
  };
}
