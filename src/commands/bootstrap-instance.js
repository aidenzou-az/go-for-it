import path from "node:path";
import {
  ensureDefaultScaffoldDirectories,
  syncCanonicalTemplatesToInstance
} from "../fs/bootstrap.js";
import { pathExists } from "../fs/exists.js";
import { getYxgRoot } from "../fs/paths.js";
import { loadCanonicalTemplate, prepareTemplate } from "../templates/core.js";
import { replaceSectionBody, bulletList } from "../artifacts/sections.js";
import { updateStateForWork } from "./shared-artifacts.js";
import { atomicWriteFile } from "../fs/atomic-write.js";
import { syncManifestWithRuntime } from "./instance-metadata.js";

const ROOT_ARTIFACTS = ["MANIFEST.md", "PROJECT.md", "STATE.md", "INDEX.md", "LOG.md"];

export async function bootstrapFrameworkInstance(repoRoot, { mode = "merge", nextSafeAction } = {}) {
  const yxgRoot = getYxgRoot(repoRoot);
  const exists = await pathExists(yxgRoot);

  if (exists && mode === "default") {
    return {
      ok: false,
      message: ".yxg already exists; use --reinit or --merge",
      changed: [],
      mode,
      templateWriteMode: "missing-only"
    };
  }

  await ensureDefaultScaffoldDirectories(repoRoot);
  const templateWriteMode = mode === "reinit" ? "overwrite" : "missing-only";
  const templateChanges = await syncCanonicalTemplatesToInstance(repoRoot, {
    writeMode: templateWriteMode
  });

  const writeMode = mode === "merge" ? "missing-only" : "preserve-existing";
  const changed = [...templateChanges];

  for (const artifactName of ROOT_ARTIFACTS) {
    const changedArtifact = await materializeRootArtifact(repoRoot, artifactName, {
      instanceName: path.basename(repoRoot),
      writeMode
    });

    if (changedArtifact) {
      changed.push(changedArtifact);
    }
  }

  const manifestPath = await syncManifestWithRuntime(repoRoot);
  if (manifestPath) {
    changed.push(manifestPath);
  }

  if (changed.some((entry) => entry.endsWith("STATE.md"))) {
    const statePath = await updateStateForWork(repoRoot, {
      focus: "framework instance bootstrapped",
      workEntries: [],
      nextSafeAction: nextSafeAction ?? "Fill PROJECT.md and create the first work unit with yxg plan.",
      checkpointSummary: "The yxg framework instance was bootstrapped and is ready for project onboarding or planning.",
      openRisks: ["none"]
    });
    changed.push(statePath);
  }

  return {
    ok: true,
    changed: Array.from(new Set(changed)),
    mode,
    templateWriteMode
  };
}

async function materializeRootArtifact(repoRoot, artifactName, { instanceName, writeMode }) {
  const targetPath = path.join(getYxgRoot(repoRoot), artifactName);
  const alreadyExists = await pathExists(targetPath);

  if (alreadyExists && writeMode === "missing-only") {
    return null;
  }

  if (alreadyExists && writeMode === "preserve-existing") {
    return null;
  }

  const template = await loadCanonicalTemplate(repoRoot, artifactName);
  const prepared = prepareRootArtifact(template, artifactName, instanceName);

  await atomicWriteFile(targetPath, prepared);
  return path.relative(repoRoot, targetPath);
}

function prepareRootArtifact(template, artifactName, instanceName) {
  const date = new Date().toISOString().slice(0, 10);
  const frontmatter = {};

  if (artifactName === "MANIFEST.md") {
    frontmatter.instance_name = instanceName;
  }

  let prepared = prepareTemplate(template, { date, frontmatter });

  if (artifactName === "INDEX.md") {
    prepared = replaceSectionBody(
      prepared,
      "## Core Artifacts",
      bulletList(["`MANIFEST.md`", "`PROJECT.md`", "`STATE.md`", "`INDEX.md`", "`LOG.md`"])
    );
    prepared = replaceSectionBody(
      prepared,
      "## Update Rule",
      bulletList(["Refresh when active work changes, important reference artifacts are added, or cleanup archives material."])
    );
  }

  if (artifactName === "LOG.md") {
    prepared = prepared.replace(/\n## \[YYYY-MM-DD\] init \| framework instance initialized[\s\S]*$/m, "");
  }

  return prepared;
}
