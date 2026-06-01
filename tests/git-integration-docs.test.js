import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("framework docs define shared durable vs local runtime yxg artifacts", async () => {
  const framework = await readFile("docs/FRAMEWORK-SPEC.md", "utf8");
  const schemas = await readFile("docs/ARTIFACT-SCHEMAS.md", "utf8");
  const scaffold = await readFile("docs/SCAFFOLD-SPEC.md", "utf8");
  const gitSpec = await readFile("docs/GIT-INTEGRATION-SPEC.md", "utf8");
  const agents = await readFile("AGENTS.md", "utf8");

  assert.match(framework, /Shared durable artifacts/i);
  assert.match(framework, /Local runtime artifacts/i);
  assert.match(framework, /\.yxg\/STATE\.md/);
  assert.match(framework, /\.yxg\/work\//);

  assert.match(schemas, /Git Persistence Classes/);
  assert.match(schemas, /Shared Durable Artifacts/);
  assert.match(schemas, /Local Runtime Artifacts/);
  assert.match(schemas, /`STATE\.md` as a durable shared planning record/i);
  assert.match(schemas, /`INDEX\.md` should normally be refreshed locally/i);

  assert.match(scaffold, /Git Ignore Expectation/);
  assert.match(scaffold, /\.yxg\/templates\//);
  assert.match(scaffold, /docs\/GIT-INTEGRATION-SPEC\.md/);

  assert.match(gitSpec, /branch naming/i);
  assert.match(gitSpec, /Git Adapter Modes/i);
  assert.match(gitSpec, /`observe`/);
  assert.match(gitSpec, /`suggest`/);
  assert.doesNotMatch(gitSpec, /\bmanaged\b/i);
  assert.match(gitSpec, /must not create a git repository automatically/i);
  assert.match(gitSpec, /must not run git write operations/i);
  assert.match(gitSpec, /YXG-Work: WU-001/);
  assert.match(gitSpec, /GitHub integration is optional/i);
  assert.match(gitSpec, /Branch Mismatch And Monitoring Handoff/);
  assert.match(gitSpec, /branch_matches_recommended_work: false/);
  assert.match(gitSpec, /branch_mismatch_reason/);
  assert.match(gitSpec, /suggested_branch.*actionable work/i);
  assert.match(gitSpec, /monitoring work open for evidence collection/i);
  assert.match(gitSpec, /\.yxg\/STATE\.md/);
  assert.match(gitSpec, /\.yxg\/baseline\/\*\*/);
  assert.match(gitSpec, /must not store machine-specific worktree paths/i);

  assert.match(agents, /docs\/GIT-INTEGRATION-SPEC\.md/);
});

test("dogfood checklist covers git observe/suggest regression scenarios", async () => {
  const checklist = await readFile("docs/CODEX-DOGFOOD-CHECKLIST.md", "utf8");

  assert.match(checklist, /Git observe\/suggest scenarios to verify during dogfood/);
  assert.match(checklist, /`WU-013` is monitoring and `WU-014` is ready/);
  assert.match(checklist, /current branch is `yxg\/wu-013-collector`/);
  assert.match(checklist, /suggested `yxg\/wu-014-\*` branch/);
  assert.match(checklist, /\$yxg:yxg-init.*\$yxg:yxg-import.*should not create `\.git`/s);
  assert.match(checklist, /unrelated dirty changes remain during `\$yxg:yxg-finish`/);
});

test("gitignore defaults protect local-only yxg runtime artifacts", async () => {
  const gitignore = await readFile(".gitignore", "utf8");

  for (const entry of [
    ".yxg/STATE.md",
    ".yxg/INDEX.md",
    ".yxg/LOG.md",
    ".yxg/logs/",
    ".yxg/templates/"
  ]) {
    assert.match(gitignore, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
