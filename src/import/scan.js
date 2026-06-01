import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../fs/exists.js";

const IGNORED_DIRECTORIES = new Set([".git", ".yxg", "node_modules"]);
const DEPLOYMENT_CLUE_FILES = [
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
  "vercel.json",
  "netlify.toml",
  "fly.toml",
  "render.yaml",
  "render.yml"
];
const CONFIG_CLUE_FILES = ["tsconfig.json", "eslint.config.js", ".eslintrc", ".eslintrc.json"];
const MODULE_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"];
const ENTRYPOINT_PREFIXES = ["functions/", "app/", "pages/", "api/", "server/", "worker/", "workers/", "bin/"];
const ENTRYPOINT_BASENAMES = new Set(["index.js", "index.mjs", "index.cjs", "handler.js", "main.js"]);

export async function scanRepository(repoRoot) {
  const files = [];
  await walk(repoRoot, repoRoot, files);

  const packageJsonPath = path.join(repoRoot, "package.json");
  const legacyArchiveFiles = files.filter((file) => file.startsWith("docs/legacy-ai/"));
  const readmeFiles = files.filter(
    (file) => /^README/i.test(path.basename(file)) && !file.startsWith("docs/legacy-ai/")
  );
  const docsFiles = files.filter(
    (file) => file.startsWith("docs/") && !file.startsWith("docs/legacy-ai/")
  );
  const agentsFiles = files.filter((file) => path.basename(file) === "AGENTS.md");
  const workflowFiles = files.filter((file) => file.startsWith(".github/workflows/"));
  const testFiles = files.filter((file) => isTestFile(file));
  const deploymentFiles = files.filter((file) => DEPLOYMENT_CLUE_FILES.includes(file));
  const configFiles = files.filter((file) => CONFIG_CLUE_FILES.includes(path.basename(file)));
  const envFiles = files.filter((file) => isEnvClueFile(file));
  const moduleFiles = files.filter((file) => MODULE_EXTENSIONS.includes(path.extname(file)));
  const entryPointFiles = files.filter((file) => isEntrypointFile(file));
  const packageJsonPresent = await pathExists(packageJsonPath);
  let packageJson = null;
  let packageJsonParseError = null;

  if (packageJsonPresent) {
    try {
      packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    } catch (error) {
      packageJsonParseError = error instanceof Error ? error.message : String(error);
    }
  }
  const readmeSummaries = await Promise.all(
    readmeFiles.slice(0, 3).map(async (file) => summarizeMarkdownFile(repoRoot, file))
  );
  const docSummaries = await Promise.all(
    docsFiles.slice(0, 6).map(async (file) => summarizeMarkdownFile(repoRoot, file))
  );
  const agentsSummaries = await Promise.all(
    agentsFiles.slice(0, 3).map(async (file) => summarizeMarkdownFile(repoRoot, file))
  );
  const srcChildren = await listDirectoryChildren(repoRoot, "src");
  const binChildren = await listDirectoryChildren(repoRoot, "bin");
  const detectedPackageManager = detectPackageManager(files);
  const dependencyNames = collectDependencyNames(packageJson);
  const packageBinEntries = collectPackageBinEntries(packageJson);
  const codeSignals = await analyzeCodeSignals(repoRoot, moduleFiles);
  const localImportGraph = buildLocalImportGraph(repoRoot, files, codeSignals.moduleContents);
  const entryPointCandidates = buildEntrypointCandidates({
    files,
    packageBinEntries,
    entryPointFiles,
    localImportGraph
  });
  const executionChains = buildExecutionChains(entryPointCandidates, localImportGraph);
  const linkedSurfaceGroups = buildLinkedSurfaceGroups(entryPointCandidates, localImportGraph);
  const verificationSignals = buildVerificationSignals({
    packageJson,
    workflowFiles,
    testFiles,
    entryPointCandidates,
    linkedSurfaceGroups
  });

  return {
    files,
    packageJson,
    packageJsonPresent,
    packageJsonParseError,
    readmeFiles,
    readmeSummaries,
    docsFiles,
    legacyArchiveFiles,
    docSummaries,
    agentsFiles,
    agentsSummaries,
    workflowFiles,
    testFiles,
    deploymentFiles,
    configFiles,
    envFiles,
    entryPointFiles,
    entryPointCandidates,
    executionChains,
    linkedSurfaceGroups,
    verificationSignals,
    localImportGraph,
    envVariableNames: Array.from(codeSignals.envVariableNames).sort(),
    envVariableUsage: mapToSortedObject(codeSignals.envVariableUsage),
    envFallbackHints: codeSignals.envFallbackHints.sort(compareHintObjects),
    externalServiceHints: Array.from(codeSignals.externalServiceHints).sort(),
    externalDependencyDetails: summarizeExternalDependencies(codeSignals.externalDependencies),
    cacheHints: Array.from(codeSignals.cacheHints).sort(),
    configHints: Array.from(codeSignals.configHints).sort(),
    detectedPackageManager,
    dependencyNames,
    scriptNames: Object.keys(packageJson?.scripts ?? {}),
    hasNodeTestScript: typeof packageJson?.scripts?.test === "string" && packageJson.scripts.test.includes("node --test"),
    packageBinEntries,
    srcChildren,
    binChildren,
    topLevelDirectories: collectTopLevelDirectories(files),
    fileExtensions: collectFileExtensions(files)
  };
}

async function walk(repoRoot, currentDir, files) {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") && ![".github"].includes(entry.name) && entry.name !== ".git" && entry.name !== ".yxg") {
      // fall through for dot-directories handled below
    }

    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      await walk(repoRoot, absolutePath, files);
      continue;
    }

    files.push(relativePath);
  }
}

function collectTopLevelDirectories(files) {
  const directories = new Set();

  for (const file of files) {
    const [top] = file.split("/");
    if (top && file.includes("/")) {
      directories.add(top);
    }
  }

  return Array.from(directories).sort();
}

function collectFileExtensions(files) {
  const extensions = new Set();

  for (const file of files) {
    const extension = path.extname(file);
    if (extension) {
      extensions.add(extension);
    }
  }

  return Array.from(extensions).sort();
}

function isTestFile(file) {
  return (
    file.startsWith("tests/") ||
    /\.test\.(c|m)?jsx?$/.test(file) ||
    /\.spec\.(c|m)?jsx?$/.test(file)
  );
}

function isEnvClueFile(file) {
  const base = path.basename(file);
  return (
    base === ".env" ||
    base.startsWith(".env.") ||
    base === ".dev.vars" ||
    base === ".env.example" ||
    base === ".env.sample" ||
    base === "wrangler.toml" ||
    base === "wrangler.jsonc"
  );
}

function isEntrypointFile(file) {
  if (ENTRYPOINT_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    return true;
  }

  return ENTRYPOINT_BASENAMES.has(path.basename(file));
}

async function summarizeMarkdownFile(repoRoot, relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const content = await readFile(absolutePath, "utf8");
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const heading = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() ?? "unknown";
  const paragraph = lines
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && !line.startsWith(">") && !line.startsWith("-")) ?? "unknown";

  return {
    file: relativePath,
    heading,
    paragraph
  };
}

async function listDirectoryChildren(repoRoot, relativeDir) {
  const target = path.join(repoRoot, relativeDir);
  if (!(await pathExists(target))) {
    return [];
  }

  const entries = await readdir(target, { withFileTypes: true });
  return entries.map((entry) => entry.name).sort();
}

function detectPackageManager(files) {
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("bun.lockb") || files.includes("bun.lock")) return "bun";
  if (files.includes("package-lock.json")) return "npm";
  return "unknown";
}

function collectDependencyNames(packageJson) {
  return Object.keys({
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {})
  }).sort();
}

function collectPackageBinEntries(packageJson) {
  const rawBin = packageJson?.bin;

  if (!rawBin) {
    return [];
  }

  if (typeof rawBin === "string") {
    return [rawBin];
  }

  return Object.values(rawBin).sort();
}

async function analyzeCodeSignals(repoRoot, moduleFiles) {
  const envVariableNames = new Set();
  const envVariableUsage = new Map();
  const envFallbackHints = [];
  const externalServiceHints = new Set();
  const externalDependencies = new Map();
  const cacheHints = new Set();
  const configHints = new Set();
  const moduleContents = new Map();

  for (const relativePath of moduleFiles) {
    const content = await readFile(path.join(repoRoot, relativePath), "utf8");
    moduleContents.set(relativePath, content);

    for (const match of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      envVariableNames.add(match[1]);
      addMapSetValue(envVariableUsage, match[1], relativePath);
    }

    for (const match of content.matchAll(/\benv\.([A-Z0-9_]+)/g)) {
      envVariableNames.add(match[1]);
      addMapSetValue(envVariableUsage, match[1], relativePath);
    }

    for (const hint of extractEnvFallbackHints(relativePath, content)) {
      envFallbackHints.push(hint);
    }

    for (const dependency of extractExternalDependencies(relativePath, content)) {
      externalServiceHints.add(dependency.service);
      mergeExternalDependency(externalDependencies, dependency);
    }

    if (/\bKV\b|\.get\(|\.put\(|caches\.default|cache/i.test(content)) {
      cacheHints.add(relativePath);
    }

    if (/wrangler/i.test(content) || /process\.env|env\./.test(content)) {
      configHints.add(relativePath);
    }
  }

  return {
    envVariableNames,
    envVariableUsage,
    envFallbackHints,
    externalServiceHints,
    externalDependencies,
    cacheHints,
    configHints,
    moduleContents
  };
}

function buildLocalImportGraph(repoRoot, files, moduleContents) {
  const fileSet = new Set(files);
  const edges = [];
  const inboundCount = new Map();

  for (const [fromFile, content] of moduleContents.entries()) {
    const specifiers = extractRelativeImportSpecifiers(content);

    for (const specifier of specifiers) {
      const resolved = resolveRelativeModule(fileSet, fromFile, specifier);
      if (!resolved) {
        continue;
      }

      edges.push({ from: fromFile, to: resolved });
      inboundCount.set(resolved, (inboundCount.get(resolved) ?? 0) + 1);
    }
  }

  return {
    edges,
    inboundCount: Array.from(inboundCount.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([file, count]) => ({ file, count }))
  };
}

function buildEntrypointCandidates({ files, packageBinEntries, entryPointFiles, localImportGraph }) {
  const inboundCounts = new Map(localImportGraph.inboundCount.map((entry) => [entry.file, entry.count]));
  const seen = new Set();
  const candidates = [];

  for (const binEntry of packageBinEntries) {
    if (files.includes(binEntry)) {
      const candidate = createEntrypointCandidate(binEntry, "cli", "high", inboundCounts);
      candidates.push(candidate);
      seen.add(candidate.file);
    }
  }

  for (const file of entryPointFiles) {
    if (seen.has(file)) continue;
    const candidate = createEntrypointCandidate(file, inferEntrypointKind(file), inferEntrypointConfidence(file), inboundCounts);
    candidates.push(candidate);
    seen.add(file);
  }

  return candidates.sort(compareEntrypointCandidates);
}

function createEntrypointCandidate(file, kind, confidence, inboundCounts) {
  return {
    file,
    kind,
    confidence,
    inboundCount: inboundCounts.get(file) ?? 0
  };
}

function inferEntrypointKind(file) {
  if (file.startsWith("functions/")) return "request-surface";
  if (file.startsWith("api/")) return "request-surface";
  if (file.startsWith("pages/")) return "page-surface";
  if (file.startsWith("app/")) return "app-surface";
  if (file.startsWith("worker/") || file.startsWith("workers/")) return "worker";
  if (file.startsWith("bin/")) return "cli";
  if (file.startsWith("server/")) return "server-entry";
  return "entry-candidate";
}

function inferEntrypointConfidence(file) {
  if (file.startsWith("functions/") || file.startsWith("api/") || file.startsWith("pages/") || file.startsWith("app/")) {
    return "high";
  }

  if (file.startsWith("worker/") || file.startsWith("workers/") || file.startsWith("bin/") || file.startsWith("server/")) {
    return "medium";
  }

  return "medium";
}

function compareEntrypointCandidates(a, b) {
  return (
    confidenceRank(b.confidence) - confidenceRank(a.confidence) ||
    b.inboundCount - a.inboundCount ||
    a.file.localeCompare(b.file)
  );
}

function confidenceRank(confidence) {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

function buildExecutionChains(entryPointCandidates, localImportGraph) {
  const adjacency = new Map();

  for (const edge of localImportGraph.edges) {
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, []);
    }
    adjacency.get(edge.from).push(edge.to);
  }

  const chains = [];
  const seen = new Set();

  for (const candidate of entryPointCandidates.slice(0, 6)) {
    const stack = [{ path: [candidate.file], depth: 0 }];

    while (stack.length > 0 && chains.length < 8) {
      const current = stack.pop();
      const neighbors = adjacency.get(current.path.at(-1)) ?? [];

      if (neighbors.length === 0 || current.depth >= 3) {
        if (current.path.length >= 2) {
          const chain = current.path.join(" -> ");
          if (!seen.has(chain)) {
            chains.push({
              entry: candidate.file,
              kind: candidate.kind,
              confidence: candidate.confidence,
              chain
            });
            seen.add(chain);
          }
        }
        continue;
      }

      for (const neighbor of neighbors.slice(0, 3).reverse()) {
        if (current.path.includes(neighbor)) {
          continue;
        }

        stack.push({
          path: [...current.path, neighbor],
          depth: current.depth + 1
        });
      }
    }
  }

  return chains;
}

function buildLinkedSurfaceGroups(entryPointCandidates, localImportGraph) {
  const entryFiles = new Set(
    entryPointCandidates
      .filter((candidate) => candidate.kind.endsWith("surface"))
      .map((candidate) => candidate.file)
  );
  const importsByTarget = new Map();

  for (const edge of localImportGraph.edges) {
    if (!entryFiles.has(edge.from)) {
      continue;
    }

    addMapSetValue(importsByTarget, edge.to, edge.from);
  }

  return Array.from(importsByTarget.entries())
    .filter(([, importers]) => importers.size >= 2)
    .map(([sharedModule, importers]) => ({
      sharedModule,
      surfaces: Array.from(importers).sort()
    }))
    .sort((a, b) => a.sharedModule.localeCompare(b.sharedModule));
}

function buildVerificationSignals({ packageJson, workflowFiles, testFiles, entryPointCandidates, linkedSurfaceGroups }) {
  const automated = [];
  const manual = [];

  if (typeof packageJson?.scripts?.test === "string") {
    automated.push(`Automated verification script available via npm test: ${packageJson.scripts.test}.`);
  }
  if (typeof packageJson?.scripts?.build === "string") {
    automated.push(`Build validation is available via npm run build: ${packageJson.scripts.build}.`);
  }
  if (workflowFiles.length > 0) {
    automated.push(`CI/workflow definitions exist under .github/workflows (${workflowFiles.slice(0, 3).join(", ")}).`);
  }
  if (testFiles.length > 0) {
    automated.push(`Repository test files include ${testFiles.slice(0, 4).join(", ")}.`);
  }

  const requestSurfaces = entryPointCandidates.filter((candidate) => candidate.kind.endsWith("surface"));
  if (requestSurfaces.length > 0) {
    manual.push(
      `Manual runtime verification likely needs to exercise ${requestSurfaces.slice(0, 4).map((candidate) => candidate.file).join(", ")}.`
    );
  }
  if (linkedSurfaceGroups.length > 0) {
    for (const group of linkedSurfaceGroups.slice(0, 2)) {
      manual.push(
        `Changes flowing through ${group.sharedModule} likely require joint verification across ${group.surfaces.join(", ")}.`
      );
    }
  }

  return {
    automated,
    manual
  };
}

function extractRelativeImportSpecifiers(content) {
  const specifiers = new Set();
  const patterns = [
    /from\s+["'](\.[^"']+)["']/g,
    /import\s*\(\s*["'](\.[^"']+)["']\s*\)/g,
    /require\(\s*["'](\.[^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }

  return Array.from(specifiers);
}

function resolveRelativeModule(fileSet, fromFile, specifier) {
  const basePath = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [
    basePath,
    ...MODULE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...MODULE_EXTENSIONS.map((extension) => `${basePath}/index${extension}`)
  ];

  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function extractEnvFallbackHints(relativePath, content) {
  const hints = [];
  const patterns = [
    /process\.env\.([A-Z0-9_]+)\s*(\?\?|\|\|)/g,
    /\benv\.([A-Z0-9_]+)\s*(\?\?|\|\|)/g
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      hints.push({
        variable: match[1],
        file: relativePath,
        operator: match[2]
      });
    }
  }

  return hints;
}

function extractExternalDependencies(relativePath, content) {
  const results = [];
  const urls = Array.from(content.matchAll(/https?:\/\/[^\s"'`]+/g)).map((match) => match[0]);
  const services = inferServicesFromContent(content, urls);
  const hasFailureHandling = /\btry\s*\{[\s\S]*?\bfetch\s*\(|\bcatch\s*\(|\.catch\s*\(/.test(content);
  const hasFallbackBehavior = /(fallback|default|stale|cache|unknown|null|暂无数据)/i.test(content);

  for (const service of services) {
    results.push({
      service,
      file: relativePath,
      urls,
      hasFailureHandling,
      hasFallbackBehavior
    });
  }

  return results;
}

function inferServicesFromContent(content, urls) {
  const services = new Set();
  const lowercaseContent = content.toLowerCase();
  const lowercaseUrls = urls.map((url) => url.toLowerCase());

  if (lowercaseContent.includes("openweather") || lowercaseUrls.some((url) => url.includes("openweathermap.org"))) {
    services.add("OpenWeather");
  }
  if (lowercaseUrls.some((url) => url.includes("api.openai.com")) || lowercaseContent.includes("openai")) {
    services.add("OpenAI");
  }
  if (lowercaseContent.includes("anthropic")) {
    services.add("Anthropic");
  }
  if (lowercaseContent.includes("github") || lowercaseUrls.some((url) => url.includes("github.com"))) {
    services.add("GitHub");
  }
  if (lowercaseContent.includes("slack")) {
    services.add("Slack");
  }
  if (lowercaseContent.includes("discord")) {
    services.add("Discord");
  }
  if (/(feishu|lark)/i.test(content)) {
    services.add("Feishu/Lark");
  }

  return Array.from(services);
}

function mergeExternalDependency(map, dependency) {
  const existing = map.get(dependency.service) ?? {
    service: dependency.service,
    files: new Set(),
    urls: new Set(),
    hasFailureHandling: false,
    hasFallbackBehavior: false
  };

  existing.files.add(dependency.file);
  for (const url of dependency.urls) {
    existing.urls.add(url);
  }
  existing.hasFailureHandling ||= dependency.hasFailureHandling;
  existing.hasFallbackBehavior ||= dependency.hasFallbackBehavior;
  map.set(dependency.service, existing);
}

function summarizeExternalDependencies(externalDependencies) {
  return Array.from(externalDependencies.values())
    .map((entry) => ({
      service: entry.service,
      files: Array.from(entry.files).sort(),
      urls: Array.from(entry.urls).sort(),
      hasFailureHandling: entry.hasFailureHandling,
      hasFallbackBehavior: entry.hasFallbackBehavior
    }))
    .sort((a, b) => a.service.localeCompare(b.service));
}

function addMapSetValue(map, key, value) {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  map.get(key).add(value);
}

function mapToSortedObject(map) {
  return Object.fromEntries(
    Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, values]) => [key, Array.from(values).sort()])
  );
}

function compareHintObjects(a, b) {
  return a.variable.localeCompare(b.variable) || a.file.localeCompare(b.file);
}
