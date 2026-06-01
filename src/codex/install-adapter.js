import { cp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile } from "../fs/atomic-write.js";
import { pathExists } from "../fs/exists.js";

const DEFAULT_MARKETPLACE = {
  name: "local-repo-plugins",
  interface: {
    displayName: "Local Repo Plugins"
  },
  plugins: []
};

export async function installCodexAdapter({ sourceRepoRoot, targetRepoRoot }) {
  const pluginSourceRoot = path.join(sourceRepoRoot, "plugins", "yxg");
  const pluginTargetRoot = path.join(targetRepoRoot, "plugins", "yxg");
  const marketplacePath = path.join(targetRepoRoot, ".agents", "plugins", "marketplace.json");

  await mkdir(path.dirname(pluginTargetRoot), { recursive: true });
  await cp(pluginSourceRoot, pluginTargetRoot, {
    recursive: true,
    force: true
  });

  const marketplace = await loadMarketplace(marketplacePath);
  const yxgEntry = {
    name: "yxg",
    source: {
      source: "local",
      path: "./plugins/yxg"
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL"
    },
    category: "Developer Tools"
  };

  const nextPlugins = marketplace.plugins.filter((plugin) => plugin?.name !== "yxg");
  nextPlugins.push(yxgEntry);

  const nextMarketplace = {
    name: marketplace.name || DEFAULT_MARKETPLACE.name,
    interface: {
      displayName:
        marketplace.interface?.displayName || DEFAULT_MARKETPLACE.interface.displayName
    },
    plugins: nextPlugins
  };

  await mkdir(path.dirname(marketplacePath), { recursive: true });
  await atomicWriteFile(marketplacePath, `${JSON.stringify(nextMarketplace, null, 2)}\n`);

  return {
    plugin_root: path.relative(targetRepoRoot, pluginTargetRoot).replace(/\\/g, "/"),
    marketplace: path.relative(targetRepoRoot, marketplacePath).replace(/\\/g, "/"),
    manual_enable_required: true,
    next_steps: [
      "Run the adapter verifier against the target repository.",
      "Open Codex in the target repository and manually install or enable the local yxg plugin."
    ]
  };
}

async function loadMarketplace(marketplacePath) {
  if (!(await pathExists(marketplacePath))) {
    return structuredClone(DEFAULT_MARKETPLACE);
  }

  try {
    const content = await readFile(marketplacePath, "utf8");
    const parsed = JSON.parse(content);

    return {
      name: parsed?.name || DEFAULT_MARKETPLACE.name,
      interface: {
        displayName: parsed?.interface?.displayName || DEFAULT_MARKETPLACE.interface.displayName
      },
      plugins: Array.isArray(parsed?.plugins) ? parsed.plugins : []
    };
  } catch {
    return structuredClone(DEFAULT_MARKETPLACE);
  }
}
