import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { cp, mkdtemp, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { installCodexAdapter } from "../src/codex/install-adapter.js";
import { verifyCodexAdapter } from "../src/codex/verify-adapter.js";

const execFileAsync = promisify(execFile);

test("installCodexAdapter copies the yxg plugin and seeds a marketplace entry", async () => {
  const sourceRepoRoot = process.cwd();
  const targetRepoRoot = await mkdtemp(path.join(os.tmpdir(), "yxg-adapter-install-"));

  const result = await installCodexAdapter({ sourceRepoRoot, targetRepoRoot });
  const pluginManifest = JSON.parse(
    await readFile(path.join(targetRepoRoot, "plugins", "yxg", ".codex-plugin", "plugin.json"), "utf8")
  );
  const marketplace = JSON.parse(
    await readFile(path.join(targetRepoRoot, ".agents", "plugins", "marketplace.json"), "utf8")
  );

  assert.equal(result.plugin_root, "plugins/yxg");
  assert.equal(result.marketplace, ".agents/plugins/marketplace.json");
  assert.equal(result.manual_enable_required, true);
  assert.equal(pluginManifest.name, "yxg");
  assert.equal(marketplace.plugins[0].name, "yxg");
});

test("installCodexAdapter merges into an existing marketplace without duplicating yxg", async () => {
  const sourceRepoRoot = process.cwd();
  const targetRepoRoot = await mkdtemp(path.join(os.tmpdir(), "yxg-adapter-merge-"));

  await cp(path.join(sourceRepoRoot, ".agents"), path.join(targetRepoRoot, ".agents"), {
    recursive: true
  });
  const existingMarketplacePath = path.join(targetRepoRoot, ".agents", "plugins", "marketplace.json");
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(
    existingMarketplacePath,
    JSON.stringify(
      {
        name: "custom-marketplace",
        interface: {
          displayName: "Custom Plugins"
        },
        plugins: [
          {
            name: "other-plugin",
            source: {
              source: "local",
              path: "./plugins/other-plugin"
            },
            policy: {
              installation: "AVAILABLE",
              authentication: "ON_INSTALL"
            },
            category: "Productivity"
          },
          {
            name: "yxg",
            source: {
              source: "local",
              path: "./plugins/old-yxg"
            },
            policy: {
              installation: "AVAILABLE",
              authentication: "ON_INSTALL"
            },
            category: "Developer Tools"
          }
        ]
      },
      null,
      2
    )
  );

  await installCodexAdapter({ sourceRepoRoot, targetRepoRoot });
  const marketplace = JSON.parse(await readFile(existingMarketplacePath, "utf8"));
  const yxgEntries = marketplace.plugins.filter((plugin) => plugin.name === "yxg");

  assert.equal(marketplace.name, "custom-marketplace");
  assert.equal(marketplace.interface.displayName, "Custom Plugins");
  assert.equal(yxgEntries.length, 1);
  assert.equal(yxgEntries[0].source.path, "./plugins/yxg");
  assert.equal(marketplace.plugins.some((plugin) => plugin.name === "other-plugin"), true);
});

test("install-codex-adapter script installs from the current repository root", async () => {
  const targetRepoRoot = await mkdtemp(path.join(os.tmpdir(), "yxg-adapter-script-"));

  const { stdout } = await execFileAsync("node", ["./scripts/install-codex-adapter.js", targetRepoRoot], {
    cwd: process.cwd()
  });
  const pluginManifest = JSON.parse(
    await readFile(path.join(targetRepoRoot, "plugins", "yxg", ".codex-plugin", "plugin.json"), "utf8")
  );

  assert.match(stdout, /Installed yxg Codex adapter/);
  assert.match(stdout, /manually install or enable the local yxg plugin/i);
  assert.equal(pluginManifest.name, "yxg");
});

test("verifyCodexAdapter confirms repo-local adapter assets and reminds the user about manual enablement", async () => {
  const sourceRepoRoot = process.cwd();
  const targetRepoRoot = await mkdtemp(path.join(os.tmpdir(), "yxg-adapter-verify-"));

  await installCodexAdapter({ sourceRepoRoot, targetRepoRoot });
  const result = await verifyCodexAdapter({ targetRepoRoot });

  assert.equal(result.ok, true);
  assert.equal(result.findings.some((finding) => finding.rule_id === "codex.adapter.manual_enable_required"), true);
});

test("verify-codex-adapter script reports the repo-local files and manual Codex step", async () => {
  const targetRepoRoot = await mkdtemp(path.join(os.tmpdir(), "yxg-adapter-verify-script-"));
  await installCodexAdapter({ sourceRepoRoot: process.cwd(), targetRepoRoot });

  const { stdout } = await execFileAsync("node", ["./scripts/verify-codex-adapter.js", targetRepoRoot], {
    cwd: process.cwd()
  });

  assert.match(stdout, /Verified yxg Codex adapter assets/);
  assert.match(stdout, /Adapter files look correct\./);
  assert.match(stdout, /manual install or enable step inside the target repository UI/i);
});
