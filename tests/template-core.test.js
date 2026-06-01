import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { access, cp, mkdtemp, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { atomicWriteFile } from "../src/fs/atomic-write.js";
import {
  ensureDefaultScaffoldDirectories,
  syncCanonicalTemplatesToInstance
} from "../src/fs/bootstrap.js";
import { loadCanonicalTemplate, prepareTemplate } from "../src/templates/core.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("loadCanonicalTemplate loads a canonical template from templates/yxg", async () => {
  const content = await loadCanonicalTemplate(repoRoot, "WORK.md");

  assert.match(content, /artifact_type: work/);
  assert.match(content, /# Work Unit/);
});

test("prepareTemplate fills date placeholders and frontmatter overrides", async () => {
  const template = await loadCanonicalTemplate(repoRoot, "WORK.md");
  const prepared = prepareTemplate(template, {
    date: "2026-04-13",
    frontmatter: {
      id: "WU-001",
      slug: "cli-foundation",
      title: "CLI Foundation"
    }
  });

  assert.match(prepared, /id: WU-001/);
  assert.match(prepared, /slug: cli-foundation/);
  assert.match(prepared, /title: CLI Foundation/);
  assert.match(prepared, /2026-04-13/);
});

test("atomicWriteFile writes content safely to disk", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-atomic-"));
  const targetPath = path.join(tempDir, "sample.txt");

  await atomicWriteFile(targetPath, "hello");

  const content = await readFile(targetPath, "utf8");
  assert.equal(content, "hello");
});

test("ensureDefaultScaffoldDirectories creates the default scaffold directories", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-scaffold-"));

  await ensureDefaultScaffoldDirectories(tempDir);

  const expectedDirectories = [
    ".yxg/work/active",
    ".yxg/work/archive",
    ".yxg/reviews",
    ".yxg/handoffs",
    ".yxg/templates"
  ];

  for (const directory of expectedDirectories) {
    const absolutePath = path.join(tempDir, directory);
    await access(absolutePath);
  }
});

test("syncCanonicalTemplatesToInstance can preserve existing instance templates", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-templates-merge-"));
  await cp(path.resolve(process.cwd(), "templates"), path.join(tempDir, "templates"), {
    recursive: true
  });

  await ensureDefaultScaffoldDirectories(tempDir);
  await syncCanonicalTemplatesToInstance(tempDir, { writeMode: "overwrite" });

  const instanceWorkTemplate = path.join(tempDir, ".yxg", "templates", "WORK.md");
  await atomicWriteFile(instanceWorkTemplate, "custom template body\n");

  const changed = await syncCanonicalTemplatesToInstance(tempDir, { writeMode: "missing-only" });
  const preserved = await readFile(instanceWorkTemplate, "utf8");

  assert.equal(preserved, "custom template body\n");
  assert.equal(changed.includes(".yxg/templates/WORK.md"), false);
});

test("syncCanonicalTemplatesToInstance can refresh existing instance templates", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-templates-reinit-"));
  await cp(path.resolve(process.cwd(), "templates"), path.join(tempDir, "templates"), {
    recursive: true
  });

  await ensureDefaultScaffoldDirectories(tempDir);
  await syncCanonicalTemplatesToInstance(tempDir, { writeMode: "overwrite" });

  const instanceWorkTemplate = path.join(tempDir, ".yxg", "templates", "WORK.md");
  await atomicWriteFile(instanceWorkTemplate, "custom template body\n");

  const changed = await syncCanonicalTemplatesToInstance(tempDir, { writeMode: "overwrite" });
  const refreshed = await readFile(instanceWorkTemplate, "utf8");

  assert.match(refreshed, /artifact_type: work/);
  assert.ok(changed.includes(".yxg/templates/WORK.md"));
});
