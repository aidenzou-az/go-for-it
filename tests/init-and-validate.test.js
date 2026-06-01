import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { cp, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { runCli } from "../src/cli/run-cli.js";
import { atomicWriteFile } from "../src/fs/atomic-write.js";

function createBufferIo() {
  const stdout = [];
  const stderr = [];

  return {
    stdout: {
      write(value) {
        stdout.push(value);
      }
    },
    stderr: {
      write(value) {
        stderr.push(value);
      }
    },
    readStdout() {
      return stdout.join("");
    },
    readStderr() {
      return stderr.join("");
    }
  };
}

test("yxg init creates a valid .yxg scaffold", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-init-"));

  const io = createBufferIo();
  const initResult = await runCli(["init"], { ...io, cwd: tempDir });

  assert.equal(initResult.ok, true);
  assert.match(io.readStdout(), /initialized \.yxg scaffold/);

  const manifest = await readFile(path.join(tempDir, ".yxg", "MANIFEST.md"), "utf8");
  assert.match(manifest, /instance_name:/);

  const validateIo = createBufferIo();
  const validateResult = await runCli(["validate", "instance"], { ...validateIo, cwd: tempDir });

  assert.equal(validateResult.ok, true);
  assert.match(validateIo.readStdout(), /validation passed for instance/);
});

test("yxg init does not create a git repository in a non-git directory", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-init-no-git-"));

  const result = await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  await assert.rejects(stat(path.join(tempDir, ".git")), { code: "ENOENT" });
});

test("yxg init fails by default when .yxg already exists", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-init-repeat-"));

  const io = createBufferIo();
  const first = await runCli(["init"], { ...io, cwd: tempDir });
  assert.equal(first.ok, true);

  const secondIo = createBufferIo();
  const second = await runCli(["init"], { ...secondIo, cwd: tempDir });

  assert.equal(second.ok, false);
  assert.match(secondIo.readStderr(), /\.yxg already exists/);
});

test("yxg plan fails safely before init instead of partially materializing state", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-plan-no-init-"));

  const io = createBufferIo();
  const result = await runCli(["plan", "WU-000"], { ...io, cwd: tempDir });

  assert.equal(result.ok, false);
  assert.match(io.readStderr(), /missing \.yxg scaffold/);
  await assert.rejects(readFile(path.join(tempDir, ".yxg", "work", "active", "WU-000-wu-000.md"), "utf8"));
});

test("yxg import bootstraps a minimal instance when onboarding an existing repository", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-import-bootstrap-"));
  await atomicWriteFile(
    path.join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "existing-target",
        scripts: {
          test: "node --test"
        }
      },
      null,
      2
    )
  );
  await atomicWriteFile(path.join(tempDir, "README.md"), "# Existing Target\n");

  const io = createBufferIo();
  const result = await runCli(["import"], { ...io, cwd: tempDir });

  assert.equal(result.ok, true);
  assert.match(io.readStdout(), /existing-project import completed/);
  assert.equal(result.data.bootstrap_mode, "merge");
  assert.match(await readFile(path.join(tempDir, ".yxg", "MANIFEST.md"), "utf8"), /artifact_type: manifest/);
  assert.match(await readFile(path.join(tempDir, ".yxg", "baseline", "IMPORT-SUMMARY.md"), "utf8"), /Existing Target/);
});

test("yxg import does not create a git repository in a non-git directory", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-import-no-git-"));
  await atomicWriteFile(path.join(tempDir, "README.md"), "# Existing Non Git Target\n");

  const result = await runCli(["import"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.data.import_mode, "deep-onboarding");
  await assert.rejects(stat(path.join(tempDir, ".git")), { code: "ENOENT" });
});

test("yxg init --merge restores missing scaffold pieces without overwriting existing artifacts", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-init-merge-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  const manifestPath = path.join(tempDir, ".yxg", "MANIFEST.md");
  const templatePath = path.join(tempDir, ".yxg", "templates", "WORK.md");
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(
    manifestPath,
    (await readFile(manifestPath, "utf8")).replace("instance_status: active", "instance_status: paused")
  );
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(templatePath, "custom work template\n");
  await rm(path.join(tempDir, ".yxg", "LOG.md"));
  await rm(path.join(tempDir, ".yxg", "handoffs"), { recursive: true, force: true });

  const result = await runCli(["init", "--merge"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.meta.mode, "merge");
  assert.equal(result.meta.template_write_mode, "missing-only");
  assert.match(await readFile(manifestPath, "utf8"), /instance_status: paused/);
  assert.equal(await readFile(templatePath, "utf8"), "custom work template\n");
  assert.match(await readFile(path.join(tempDir, ".yxg", "LOG.md"), "utf8"), /artifact_type: log/);
});

test("yxg init --reinit refreshes instance templates but preserves existing project artifacts", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-init-reinit-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  const manifestPath = path.join(tempDir, ".yxg", "MANIFEST.md");
  const templatePath = path.join(tempDir, ".yxg", "templates", "WORK.md");
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(
    manifestPath,
    (await readFile(manifestPath, "utf8")).replace("instance_status: active", "instance_status: paused")
  );
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(templatePath, "custom work template\n");
  await rm(path.join(tempDir, ".yxg", "PROJECT.md"));

  const result = await runCli(["init", "--reinit"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.meta.mode, "reinit");
  assert.equal(result.meta.template_write_mode, "overwrite");
  assert.match(await readFile(manifestPath, "utf8"), /instance_status: paused/);
  assert.match(await readFile(templatePath, "utf8"), /artifact_type: work/);
  assert.match(await readFile(path.join(tempDir, ".yxg", "PROJECT.md"), "utf8"), /artifact_type: project/);
});

test("yxg plan creates a draft work unit and updates state and index", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-plan-draft-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  const io = createBufferIo();
  const result = await runCli(["plan", "WU-100", "--slug=cli-foundation", "--title=CLI Foundation"], {
    ...io,
    cwd: tempDir
  });

  assert.equal(result.ok, true);
  assert.match(io.readStdout(), /work WU-100 is in draft/);

  const work = await readFile(path.join(tempDir, ".yxg", "work", "active", "WU-100-cli-foundation.md"), "utf8");
  const state = await readFile(path.join(tempDir, ".yxg", "STATE.md"), "utf8");
  const index = await readFile(path.join(tempDir, ".yxg", "INDEX.md"), "utf8");

  assert.match(work, /id: WU-100/);
  assert.match(work, /slug: cli-foundation/);
  assert.match(state, /planning work WU-100/);
  assert.match(index, /WU-100-cli-foundation\.md/);
});

test("yxg plan rejects natural-language work descriptions as invalid ids", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-plan-invalid-id-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  const io = createBufferIo();
  const result = await runCli(["plan", "增加“降水概率”显示"], { ...io, cwd: tempDir });

  assert.equal(result.ok, false);
  assert.match(io.readStderr(), /invalid work id/);
  await assert.rejects(
    readFile(path.join(tempDir, ".yxg", "work", "active", "增加“降水概率”显示-work.md"), "utf8")
  );
});

test("yxg plan --task creates a draft work unit from natural-language intake", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-plan-task-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  const io = createBufferIo();
  const result = await runCli(["plan", "--task=增加“降水概率”显示"], { ...io, cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.data.auto_generated_work_id, true);
  assert.equal(result.data.work_id, "WU-001");
  assert.equal(result.data.task, "增加“降水概率”显示");
  assert.match(io.readStdout(), /work WU-001 is in draft/);

  const work = await readFile(path.join(tempDir, ".yxg", "work", "active", "WU-001-work-001.md"), "utf8");
  assert.match(work, /id: WU-001/);
  assert.match(work, /slug: work-001/);
  assert.match(work, /title: 增加“降水概率”显示/);
  assert.equal(result.data.intake_mode, "task");
  assert.equal(result.data.work_path, ".yxg/work/active/WU-001-work-001.md");
});

test("yxg plan --task increments the generated work id based on existing work", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-plan-task-next-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "--task=增加“降水概率”显示"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["review", "WU-001", "--verdict=pass"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["cleanup"], { ...createBufferIo(), cwd: tempDir });

  const result = await runCli(["plan", "--task=增加体感温度显示"], {
    ...createBufferIo(),
    cwd: tempDir
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.work_id, "WU-002");
  const work = await readFile(path.join(tempDir, ".yxg", "work", "active", "WU-002-work-002.md"), "utf8");
  assert.match(work, /title: 增加体感温度显示/);
});

test("yxg plan refuses ready state when the work contract is incomplete", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-plan-ready-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-101"], { ...createBufferIo(), cwd: tempDir });

  const io = createBufferIo();
  const result = await runCli(["plan", "WU-101", "--ready"], { ...io, cwd: tempDir });

  assert.equal(result.ok, false);
  assert.match(io.readStderr(), /failed ready validation/);

  const work = await readFile(path.join(tempDir, ".yxg", "work", "active", "WU-101-wu-101.md"), "utf8");
  assert.match(work, /status: draft/);
});

test("yxg plan --ready strips template guidance lines from completed sections", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-plan-ready-sanitize-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "--task=增加降水概率显示"], { ...createBufferIo(), cwd: tempDir });

  const workPath = path.join(tempDir, ".yxg", "work", "active", "WU-001-work-001.md");
  let work = await readFile(workPath, "utf8");
  work = work
    .replace(
      "Describe the concrete outcome this work unit is meant to produce.\n\nTODO",
      "Describe the concrete outcome this work unit is meant to produce.\n\n在页面中展示降水概率。"
    )
    .replace(
      "List what this work unit is explicitly allowed to change or address.\n\n- TODO",
      "List what this work unit is explicitly allowed to change or address.\n\n- 更新天气数据来源。\n- 更新页面展示。"
    )
    .replace(
      "List what this work unit must not silently absorb.\n\n- TODO",
      "List what this work unit must not silently absorb.\n\n- 不做页面整体重设计。"
    )
    .replace(
      "List the files, modules, commands, or surfaces likely to move.\n\n- TODO",
      "List the files, modules, commands, or surfaces likely to move.\n\n- lib/weather.js\n- functions/page-data.js\n- functions/render.js"
    )
    .replace(
      "List prior work, external inputs, or blocking prerequisites. Write `none` if there are none.\n\n- none",
      "List prior work, external inputs, or blocking prerequisites. Write `none` if there are none.\n\n- OpenWeather forecast data"
    )
    .replace(
      "Write the assumptions this work relies on. If there are none, write `none`.\n\n- none",
      "Write the assumptions this work relies on. If there are none, write `none`.\n\n- 现有 current weather 接口没有降水概率字段。"
    )
    .replace(
      "Write the main risks or write `none`.\n\n- none",
      "Write the main risks or write `none`.\n\n- 不同输出面可能需要不同的格式。"
    )
    .replace(
      "Write the bounded steps to complete the work.\n\n1. TODO",
      "Write the bounded steps to complete the work.\n\n1. 确认数据来源。\n2. 更新 view model。\n3. 更新渲染。"
    )
    .replace(
      "Write the checks that will prove the work is correct.\n\n- TODO",
      "Write the checks that will prove the work is correct.\n\n- 页面展示正确。\n- 缺失数据时不报错。"
    )
    .replace(
      "Write the testable completion condition.\n\n- TODO",
      "Write the testable completion condition.\n\n- 用户可见输出中出现降水概率。"
    )
    .replace(
      "Write the conditions that should trigger replanning or escalation.\n\n- TODO",
      "Write the conditions that should trigger replanning or escalation.\n\n- 数据源无法稳定提供降水概率。"
    );
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(workPath, work);

  const result = await runCli(["plan", "WU-001", "--ready"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);

  const sanitizedWork = await readFile(workPath, "utf8");
  assert.doesNotMatch(sanitizedWork, /Write the assumptions this work relies on\./);
  assert.doesNotMatch(sanitizedWork, /Write the main risks or write `none`\./);
  assert.doesNotMatch(sanitizedWork, /List prior work, external inputs, or blocking prerequisites\./);
  assert.match(sanitizedWork, /- OpenWeather forecast data/);
  assert.match(sanitizedWork, /- 现有 current weather 接口没有降水概率字段。/);
  assert.match(sanitizedWork, /status: ready/);
});

test("yxg plan --ready preserves existing work slug and title in command output", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-plan-ready-preserve-metadata-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-222", "--slug=btc-l1-raw-cache", "--title=BTC L1 数据基础与 raw cache"], {
    ...createBufferIo(),
    cwd: tempDir
  });

  const workPath = path.join(tempDir, ".yxg", "work", "active", "WU-222-btc-l1-raw-cache.md");
  let work = await readFile(workPath, "utf8");
  work = work
    .replace("\nTODO\n", "\nBuild the BTC L1 raw cache foundation.\n")
    .replace("- TODO", "- Capture BTC L1 data into a raw cache.")
    .replace("- TODO", "- Do not build trading logic.")
    .replace("- TODO", "- src/btc-l1-cache.js")
    .replace("- TODO", "- Run cache verification tests.")
    .replace("- TODO", "- BTC L1 raw cache is available for later work.")
    .replace("- TODO", "- Escalate if source data is unavailable.");
  await atomicWriteFile(workPath, work);

  const result = await runCli(["plan", "WU-222", "--ready"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.data.slug, "btc-l1-raw-cache");
  assert.equal(result.data.title, "BTC L1 数据基础与 raw cache");
  assert.equal(result.data.suggested_branch, "yxg/wu-222-btc-l1-raw-cache");
});

test("yxg cancel-work removes a mistaken draft and refreshes state and index", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-cancel-draft-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "--task=增加“降水概率”显示"], { ...createBufferIo(), cwd: tempDir });

  const io = createBufferIo();
  const result = await runCli(["cancel-work", "WU-001"], { ...io, cwd: tempDir });

  assert.equal(result.ok, true);
  assert.match(io.readStdout(), /canceled draft work WU-001/);
  await assert.rejects(readFile(path.join(tempDir, ".yxg", "work", "active", "WU-001-work-001.md"), "utf8"));

  const state = await readFile(path.join(tempDir, ".yxg", "STATE.md"), "utf8");
  const index = await readFile(path.join(tempDir, ".yxg", "INDEX.md"), "utf8");
  const log = await readFile(path.join(tempDir, ".yxg", "LOG.md"), "utf8");

  assert.match(state, /canceled draft work WU-001/);
  assert.doesNotMatch(index, /WU-001-work-001\.md/);
  assert.match(log, /cancel-WU-001/);
});

test("yxg cancel-work refuses to remove non-draft work", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-cancel-ready-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-107"], { ...createBufferIo(), cwd: tempDir });

  const workPath = path.join(tempDir, ".yxg", "work", "active", "WU-107-wu-107.md");
  let work = await readFile(workPath, "utf8");
  work = work
    .replace("\nTODO\n", "\nBuild cancel-work lifecycle support.\n")
    .replace("- TODO", "- In scope is cancel-work behavior.")
    .replace("- TODO", "- Out of scope is unrelated repository changes.")
    .replace("- TODO", "- Touch point is the active work artifact.")
    .replace("- TODO", "- Verification is validator pass for ready state.")
    .replace("- TODO", "- Done when ready validation succeeds.")
    .replace("- TODO", "- Escalate if lifecycle semantics change.");
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(workPath, work);
  await runCli(["plan", "WU-107", "--ready"], { ...createBufferIo(), cwd: tempDir });

  const io = createBufferIo();
  const result = await runCli(["cancel-work", "WU-107"], { ...io, cwd: tempDir });

  assert.equal(result.ok, false);
  assert.match(io.readStderr(), /cannot cancel WU-107 because it is not in draft/);
  assert.match(await readFile(workPath, "utf8"), /status: ready/);
});

test("yxg cancel-work fails safely before init", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-cancel-no-init-"));

  const io = createBufferIo();
  const result = await runCli(["cancel-work", "WU-001"], { ...io, cwd: tempDir });

  assert.equal(result.ok, false);
  assert.match(io.readStderr(), /missing \.yxg scaffold/);
});

test("yxg review can mark work done after a passing review", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-review-pass-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-102", "--slug=ready-work", "--title=Ready Work"], {
    ...createBufferIo(),
    cwd: tempDir
  });

  const workPath = path.join(tempDir, ".yxg", "work", "active", "WU-102-ready-work.md");
  let work = await readFile(workPath, "utf8");
  work = work
    .replace("\nTODO\n", "\nBuild the ready work path.\n")
    .replace("- TODO", "- Update only the ready work module.")
    .replace("- TODO", "- Do not change unrelated modules.")
    .replace("- TODO", "- .yxg/work/active/WU-102-ready-work.md")
    .replace("- TODO", "- Verify review completion with validator.")
    .replace("- TODO", "- Work is ready for review and passes validation.")
    .replace("- TODO", "- Escalate if the contract changes materially.");

  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(workPath, work);
  await runCli(["plan", "WU-102", "--ready"], { ...createBufferIo(), cwd: tempDir });

  const io = createBufferIo();
  const result = await runCli(["review", "WU-102", "--verdict=pass"], { ...io, cwd: tempDir });

  assert.equal(result.ok, true);
  assert.match(io.readStdout(), /review recorded for WU-102 with verdict pass/);

  const reviewedWork = await readFile(workPath, "utf8");
  const reviewFile = await readFile(path.join(tempDir, ".yxg", "reviews", "WU-102-review.md"), "utf8");

  assert.match(reviewedWork, /status: done/);
  assert.match(reviewFile, /verdict: pass/);
  assert.doesNotMatch(reviewFile, /Change set: unknown/);
  assert.doesNotMatch(reviewFile, /validator run pending or complete/);
  assert.match(reviewFile, /Validator summary: 0 error\(s\), 0 warning\(s\), 0 info finding\(s\)\./);
  assert.match(reviewFile, /Suggested commit trailer: YXG-Work: WU-102|Run cleanup to archive completed work/);
});

test("yxg review uses an explicit fallback change set when no touch points are recorded", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-review-fallback-change-set-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-108", "--slug=fallback-review", "--title=Fallback Review"], {
    ...createBufferIo(),
    cwd: tempDir
  });

  const workPath = path.join(tempDir, ".yxg", "work", "active", "WU-108-fallback-review.md");
  let work = await readFile(workPath, "utf8");
  work = work
    .replace("\nTODO\n", "\nReview fallback coverage.\n")
    .replace("- TODO", "- Update the active work contract only.")
    .replace("- TODO", "- Do not touch unrelated code.")
    .replace("- TODO", "- none")
    .replace("- TODO", "- Verify review completion with validator.")
    .replace("- TODO", "- Work passes review and validation.")
    .replace("- TODO", "- Escalate if review fallback semantics regress.");

  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(workPath, work);
  await runCli(["plan", "WU-108", "--ready"], { ...createBufferIo(), cwd: tempDir });

  const result = await runCli(["review", "WU-108", "--verdict=pass"], {
    ...createBufferIo(),
    cwd: tempDir
  });

  assert.equal(result.ok, true);
  const reviewFile = await readFile(path.join(tempDir, ".yxg", "reviews", "WU-108-review.md"), "utf8");
  assert.match(reviewFile, /Change set: current work artifact for WU-108/);
  assert.doesNotMatch(reviewFile, /Change set: unknown/);
});

test("yxg resume summarizes current focus and next safe action", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-resume-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-103"], { ...createBufferIo(), cwd: tempDir });

  const io = createBufferIo();
  const result = await runCli(["resume"], { ...io, cwd: tempDir });

  assert.equal(result.ok, true);
  assert.match(io.readStdout(), /resume focus:/);
  assert.match(io.readStdout(), /WU-103-wu-103\.md/);
});

test("yxg resume surfaces a uniquely recommended active work when state narrative names one", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-resume-recommended-work-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-201", "--slug=alpha", "--title=Alpha"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-202", "--slug=beta", "--title=Beta"], { ...createBufferIo(), cwd: tempDir });

  const statePath = path.join(tempDir, ".yxg", "STATE.md");
  let state = await readFile(statePath, "utf8");
  state = state
    .replace("## Current Focus\n- planning work WU-202", "## Current Focus\n- continuing work WU-202 before the other queued cards")
    .replace(
      "## Next Safe Action\n1. Refine WU-202-beta.md and rerun yxg plan WU-202 --ready when the contract is complete.",
      "## Next Safe Action\n1. Continue WU-202 first; leave WU-201 queued until this UI card is complete."
    );
  await atomicWriteFile(statePath, state);

  const result = await runCli(["resume"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.data.recommended_work_id, "WU-202");
  assert.match(result.data.recommended_work_path, /WU-202-beta\.md/);
  assert.match(result.details, /recommended: WU-202/);
});

test("yxg resume recommends the first ready work after batch planning instead of the last planned work", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-resume-batch-planning-order-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  for (const workId of ["WU-001", "WU-002", "WU-003"]) {
    await runCli(["plan", workId], { ...createBufferIo(), cwd: tempDir });
    const slug = workId.toLowerCase();
    const workPath = path.join(tempDir, ".yxg", "work", "active", `${workId}-${slug}.md`);
    let work = await readFile(workPath, "utf8");
    work = work
      .replace("status: draft", "status: ready")
      .replace("\nTODO\n", `\nImplement ${workId}.\n`)
      .replace("- TODO", `- Scope for ${workId}.`)
      .replace("- TODO", "- Do not change unrelated work.")
      .replace("- TODO", `- src/${workId}.js`)
      .replace("- TODO", `- Verify ${workId}.`)
      .replace("- TODO", `${workId} is complete.`)
      .replace("- TODO", "Escalate if blocked.");
    await atomicWriteFile(workPath, work);
    await runCli(["plan", workId, "--ready"], { ...createBufferIo(), cwd: tempDir });
  }

  const result = await runCli(["resume"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.match(result.data.current_focus, /planning work WU-003/);
  assert.equal(result.data.recommended_work_id, "WU-001");
  assert.match(result.data.recommended_work_path, /WU-001-wu-001\.md/);
});

test("yxg resume prefers actionable work over monitoring work waiting for evidence", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-resume-monitoring-actionable-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  for (const workId of ["WU-013", "WU-014"]) {
    await runCli(["plan", workId], { ...createBufferIo(), cwd: tempDir });
    const slug = workId.toLowerCase();
    const workPath = path.join(tempDir, ".yxg", "work", "active", `${workId}-${slug}.md`);
    let work = await readFile(workPath, "utf8");
    work = work
      .replace("\nTODO\n", `\nImplement ${workId}.\n`)
      .replace("- TODO", `- Scope for ${workId}.`)
      .replace("- TODO", "- Do not change unrelated work.")
      .replace("- TODO", `- src/${workId}.js`)
      .replace("- TODO", `- Verify ${workId}.`)
      .replace("- TODO", `${workId} is complete.`)
      .replace("- TODO", "Escalate if blocked.");
    await atomicWriteFile(workPath, work);
    await runCli(["plan", workId, "--ready"], { ...createBufferIo(), cwd: tempDir });
  }

  await runCli(["execute", "WU-013"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["execute", "WU-013", "--monitoring"], { ...createBufferIo(), cwd: tempDir });

  const result = await runCli(["resume"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.match(result.data.current_focus, /monitoring work WU-013/);
  assert.equal(result.data.recommended_work_id, "WU-014");
  assert.match(result.data.recommended_work_path, /WU-014-wu-014\.md/);
});

test("yxg resume surfaces planned next work from roadmap when no active work exists", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-resume-roadmap-planned-next-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  const roadmapPath = path.join(tempDir, ".yxg", "ROADMAP.md");
  await atomicWriteFile(
    roadmapPath,
    `---
artifact_type: roadmap
schema_version: "1.0"
kernel_version: "1"
id: roadmap
status: active
created_at: "2026-05-13"
updated_at: "2026-05-13"
---

# Roadmap

## Now

- WU-008 BTC L1 数据基础与 raw cache

## Next

- WU-009 策略调参

## Later

- none

## Deferred

- none
`
  );

  const result = await runCli(["resume"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.data.recommended_work_id, null);
  assert.equal(result.data.planned_next_work.work_id, "WU-008");
  assert.equal(result.data.planned_next_work.title, "BTC L1 数据基础与 raw cache");
  assert.equal(result.data.planned_next_work.section, "Now");
  assert.match(result.details, /planned next: WU-008/);
  assert.match(result.next_steps.join("\n"), /Planned next work: WU-008 BTC L1 数据基础与 raw cache/);
  assert.doesNotMatch(result.next_steps.join("\n"), /yxg plan WU-008 --ready/);
});

test("yxg import generates the baseline artifact set", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-import-"));
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(
    path.join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "import-target",
        private: true,
        scripts: {
          test: "node --test"
        }
      },
      null,
      2
    )
  );
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(
    path.join(tempDir, "README.md"),
    "# Import Target\n"
  );

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  const io = createBufferIo();
  const result = await runCli(["import"], { ...io, cwd: tempDir });

  assert.equal(result.ok, true);
  assert.match(io.readStdout(), /existing-project import completed/);

  const baselineRoot = path.join(tempDir, ".yxg", "baseline");
  for (const filename of [
    "STACK.md",
    "ARCHITECTURE.md",
    "CONVENTIONS.md",
    "RISKS.md",
    "IMPORT-SUMMARY.md"
  ]) {
    const content = await readFile(path.join(baselineRoot, filename), "utf8");
    assert.ok(content.length > 0);
  }

  const stack = await readFile(path.join(baselineRoot, "STACK.md"), "utf8");
  const summary = await readFile(path.join(baselineRoot, "IMPORT-SUMMARY.md"), "utf8");
  const project = await readFile(path.join(tempDir, ".yxg", "PROJECT.md"), "utf8");
  const manifest = await readFile(path.join(tempDir, ".yxg", "MANIFEST.md"), "utf8");
  assert.match(stack, /\[code-backed\] package\.json defines package metadata and scripts\./);
  assert.match(summary, /\[doc-backed\] README\.md is titled "Import Target"\./);
  assert.match(summary, /\[inferred-low-confidence\] README suggests the repository centers on "Import Target"\./);
  assert.doesNotMatch(project, /\bTODO\b/);
  assert.match(project, /## Success Criteria\n- /);
  assert.match(project, /## Product Principles\n- /);
  assert.match(manifest, /preferred_adapter: yxg-cli/);
  assert.doesNotMatch(manifest, /Write the active kernel version/);
  assert.equal(result.data.import_mode, "deep-onboarding");
});

test("yxg import normalizes stale index metadata while refreshing baseline references", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-import-index-normalize-"));
  await atomicWriteFile(
    path.join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "stale-index-target"
      },
      null,
      2
    )
  );
  await atomicWriteFile(path.join(tempDir, "README.md"), "# Stale Index Target\n");

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  const indexPath = path.join(tempDir, ".yxg", "INDEX.md");
  let index = await readFile(indexPath, "utf8");
  index = index
    .replace("## Core Artifacts\n- `MANIFEST.md`\n- `PROJECT.md`\n- `STATE.md`\n- `INDEX.md`\n- `LOG.md`", "## Core Artifacts\n- TODO")
    .replace(
      "## Update Rule\n- Refresh when active work changes, important reference artifacts are added, or cleanup archives material.",
      "## Update Rule\n- TODO"
    );
  await atomicWriteFile(indexPath, index);

  const result = await runCli(["import"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  const normalizedIndex = await readFile(indexPath, "utf8");
  assert.match(normalizedIndex, /## Core Artifacts\n- `MANIFEST\.md`\n- `PROJECT\.md`\n- `STATE\.md`\n- `INDEX\.md`\n- `LOG\.md`/);
  assert.match(
    normalizedIndex,
    /## Update Rule\n- Refresh when active work changes, important reference artifacts are added, or cleanup archives material\./
  );
  assert.match(normalizedIndex, /\.yxg\/baseline\/STACK\.md/);
});

test("yxg import extracts deeper architecture and runtime clues for existing repositories", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-import-deep-"));
  await atomicWriteFile(
    path.join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "weather-signature-like",
        scripts: {
          test: "node --test"
        }
      },
      null,
      2
    )
  );
  await atomicWriteFile(path.join(tempDir, "README.md"), "# Weather Signature for Feishu\n");
  await atomicWriteFile(
    path.join(tempDir, "functions", "page-data.js"),
    "import { fetchWeather } from '../lib/weather.js';\nexport async function getWeatherPageData(env){ return fetchWeather(env.OPENWEATHER_API_KEY ?? env.FALLBACK_OPENWEATHER_API_KEY, 'Beijing'); }\n"
  );
  await atomicWriteFile(
    path.join(tempDir, "functions", "render.js"),
    "import { getWeatherPageData } from './page-data.js';\nexport async function render(env){ return getWeatherPageData(env); }\n"
  );
  await atomicWriteFile(
    path.join(tempDir, "functions", "og-image.js"),
    "import { getWeatherPageData } from './page-data.js';\nexport async function og(env){ return getWeatherPageData(env); }\n"
  );
  await atomicWriteFile(
    path.join(tempDir, "lib", "weather.js"),
    "export async function fetchWeather(apiKey, city){ try { const response = await fetch('https://api.openweathermap.org/data/2.5/weather'); return { apiKey, city, response }; } catch { return { apiKey, city, stale: true }; } }\n"
  );
  await atomicWriteFile(path.join(tempDir, ".env.example"), "OPENWEATHER_API_KEY=demo\n");

  const result = await runCli(["import"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  const stack = await readFile(path.join(tempDir, ".yxg", "baseline", "STACK.md"), "utf8");
  const architecture = await readFile(path.join(tempDir, ".yxg", "baseline", "ARCHITECTURE.md"), "utf8");
  const conventions = await readFile(path.join(tempDir, ".yxg", "baseline", "CONVENTIONS.md"), "utf8");
  const summary = await readFile(path.join(tempDir, ".yxg", "baseline", "IMPORT-SUMMARY.md"), "utf8");

  assert.match(stack, /Runtime entrypoint candidates were detected: functions\/og-image\.js, functions\/page-data\.js, functions\/render\.js\./);
  assert.match(architecture, /functions\/page-data\.js is a high-confidence request-surface entrypoint candidate\./);
  assert.match(architecture, /functions\/page-data\.js imports shared logic from lib\/weather\.js\./);
  assert.match(architecture, /functions\/render\.js depends on functions\/page-data\.js\./);
  assert.match(architecture, /Execution-path candidate: functions\/render\.js -> functions\/page-data\.js -> lib\/weather\.js\./);
  assert.match(architecture, /functions\/page-data\.js links multiple visible surfaces: functions\/og-image\.js, functions\/render\.js\./);
  assert.match(conventions, /Environment variables referenced in code include: .*OPENWEATHER_API_KEY/);
  assert.match(conventions, /functions\/page-data\.js applies a \?\? fallback when reading OPENWEATHER_API_KEY\./);
  assert.match(summary, /Source files reference external services including OpenWeather\./);
  assert.match(summary, /A concrete execution path can already be traced, for example .*lib\/weather\.js\./);
  const risks = await readFile(path.join(tempDir, ".yxg", "baseline", "RISKS.md"), "utf8");
  assert.match(risks, /functions\/page-data\.js is a shared boundary between functions\/og-image\.js, functions\/render\.js/);
  assert.match(risks, /Manual verification still matters for Manual runtime verification likely needs to exercise .*functions\/page-data\.js.*functions\/og-image\.js.*functions\/render\.js/);
});

test("yxg import tolerates malformed package.json and records reduced confidence", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-import-bad-pkg-"));
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(
    path.join(tempDir, "package.json"),
    "{bad json"
  );
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(
    path.join(tempDir, "README.md"),
    "# Broken Package\n"
  );

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  const result = await runCli(["import"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  const summary = await readFile(path.join(tempDir, ".yxg", "baseline", "IMPORT-SUMMARY.md"), "utf8");
  const risks = await readFile(path.join(tempDir, ".yxg", "baseline", "RISKS.md"), "utf8");

  assert.match(summary, /\[code-backed\] package\.json was detected but not parsed due to invalid JSON\./);
  assert.match(risks, /\[code-backed\] package\.json could not be parsed/);
});

test("yxg import ignores archived legacy-ai readmes as active documentation evidence", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-import-legacy-ai-"));
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(
    path.join(tempDir, "package.json"),
    JSON.stringify({ name: "legacy-ignore-target" }, null, 2)
  );
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(
    path.join(tempDir, "docs", "legacy-ai", "README.md"),
    "# Legacy AI Snapshot\n"
  );

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["import"], { ...createBufferIo(), cwd: tempDir });

  const summary = await readFile(path.join(tempDir, ".yxg", "baseline", "IMPORT-SUMMARY.md"), "utf8");
  const risks = await readFile(path.join(tempDir, ".yxg", "baseline", "RISKS.md"), "utf8");

  assert.doesNotMatch(summary, /Legacy AI Snapshot/);
  assert.match(risks, /\[doc-backed\] README files are absent/);
});

test("yxg execute moves work through active and review states", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-execute-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-104"], { ...createBufferIo(), cwd: tempDir });

  const workPath = path.join(tempDir, ".yxg", "work", "active", "WU-104-wu-104.md");
  let work = await readFile(workPath, "utf8");
  work = work
    .replace("\nTODO\n", "\nBuild execute lifecycle support.\n")
    .replace("- TODO", "- In scope is lifecycle state management.")
    .replace("- TODO", "- Out of scope is application code changes.")
    .replace("- TODO", "- Touch point is the work artifact.")
    .replace("- TODO", "- Verification is validator pass for work ready state.")
    .replace("- TODO", "- Done when execute can move the work to review.")
    .replace("- TODO", "- Escalate if lifecycle state handling changes.");
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(workPath, work);
  await runCli(["plan", "WU-104", "--ready"], { ...createBufferIo(), cwd: tempDir });

  const active = await runCli(["execute", "WU-104"], { ...createBufferIo(), cwd: tempDir });
  const review = await runCli(["execute", "WU-104", "--review"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(active.ok, true);
  assert.equal(review.ok, true);

  const updatedWork = await readFile(workPath, "utf8");
  assert.match(updatedWork, /status: review/);
});

test("yxg execute supports monitoring work before review", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-execute-monitoring-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-109"], { ...createBufferIo(), cwd: tempDir });

  const workPath = path.join(tempDir, ".yxg", "work", "active", "WU-109-wu-109.md");
  let work = await readFile(workPath, "utf8");
  work = work
    .replace("\nTODO\n", "\nDeploy a collector and wait for external evidence.\n")
    .replace("- TODO", "- In scope is collector deployment and monitoring.")
    .replace("- TODO", "- Out of scope is unrelated strategy work.")
    .replace("- TODO", "- Touch point is the work artifact.")
    .replace("- TODO", "- Verification includes a completed observation window.")
    .replace("- TODO", "- Done when monitoring evidence is ready for review.")
    .replace("- TODO", "- Escalate if the collector stops producing evidence.");
  await atomicWriteFile(workPath, work);
  await runCli(["plan", "WU-109", "--ready"], { ...createBufferIo(), cwd: tempDir });

  const active = await runCli(["execute", "WU-109"], { ...createBufferIo(), cwd: tempDir });
  const monitoring = await runCli(["execute", "WU-109", "--monitoring"], { ...createBufferIo(), cwd: tempDir });
  const review = await runCli(["execute", "WU-109", "--review"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(active.ok, true);
  assert.equal(monitoring.ok, true);
  assert.equal(review.ok, true);

  const updatedWork = await readFile(workPath, "utf8");
  assert.match(updatedWork, /status: review/);
});

test("yxg cleanup archives done work and refreshes index", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-cleanup-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-105"], { ...createBufferIo(), cwd: tempDir });

  const workPath = path.join(tempDir, ".yxg", "work", "active", "WU-105-wu-105.md");
  let work = await readFile(workPath, "utf8");
  work = work
    .replace("\nTODO\n", "\nBuild cleanup support.\n")
    .replace("- TODO", "- In scope is cleanup lifecycle behavior.")
    .replace("- TODO", "- Out of scope is unrelated framework code.")
    .replace("- TODO", "- Touch point is the cleanup work artifact.")
    .replace("- TODO", "- Verification is review pass.")
    .replace("- TODO", "- Done when cleanup can archive the work.")
    .replace("- TODO", "- Escalate if archive semantics change.");
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(workPath, work);
  await runCli(["plan", "WU-105", "--ready"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["review", "WU-105", "--verdict=pass"], { ...createBufferIo(), cwd: tempDir });

  const result = await runCli(["cleanup"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);

  const archivePath = path.join(tempDir, ".yxg", "work", "archive", "WU-105-wu-105.md");
  const index = await readFile(path.join(tempDir, ".yxg", "INDEX.md"), "utf8");
  const archivedWork = await readFile(archivePath, "utf8");
  const state = await readFile(path.join(tempDir, ".yxg", "STATE.md"), "utf8");

  assert.match(archivedWork, /status: done/);
  assert.match(index, /\.yxg\/work\/archive\//);
  assert.doesNotMatch(index, /\.yxg\/reviews\/WU-105-review\.md/);
  assert.match(index, /\.yxg\/reviews\//);
  assert.match(state, /no active work; cleanup completed|cleanup completed/);
  assert.match(state, /Summary: Archived completed work WU-105/);
  assert.doesNotMatch(state, /继续|收尾评审|active-task execution guidance/);
});

test("yxg cleanup refreshes baseline with recent completed work insights", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-cleanup-baseline-refresh-"));

  await atomicWriteFile(
    path.join(tempDir, "README.md"),
    "# Existing Project\n"
  );
  await atomicWriteFile(
    path.join(tempDir, "functions", "render.js"),
    "import { getData } from '../lib/data.js';\nexport async function render(){ return getData(); }\n"
  );
  await atomicWriteFile(
    path.join(tempDir, "lib", "data.js"),
    "export async function getData(){ return { ok: true }; }\n"
  );

  await runCli(["import"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-110", "--slug=baseline-refresh", "--title=Baseline Refresh"], {
    ...createBufferIo(),
    cwd: tempDir
  });

  const workPath = path.join(tempDir, ".yxg", "work", "active", "WU-110-baseline-refresh.md");
  let work = await readFile(workPath, "utf8");
  work = work
    .replace("\nTODO\n", "\nRefresh baseline knowledge from completed work.\n")
    .replace("- TODO", "- Update the shared render/data path.")
    .replace("- TODO", "- Do not broaden the task beyond the existing render/data path.")
    .replace("- TODO", "- functions/render.js\n- lib/data.js")
    .replace(
      "Write the assumptions this work relies on. If there are none, write `none`.\n\n- none",
      "Write the assumptions this work relies on. If there are none, write `none`.\n\n- The render path depends on lib/data.js."
    )
    .replace(
      "Write the main risks or write `none`.\n\n- none",
      "Write the main risks or write `none`.\n\n- Shared render/data changes can affect the visible surface."
    )
    .replace(
      "Write the bounded steps to complete the work.\n\n1. TODO",
      "Write the bounded steps to complete the work.\n\n1. Update the shared render/data path.\n2. Verify the shared output still works."
    )
    .replace(
      "Write the checks that will prove the work is correct.\n\n- TODO",
      "Write the checks that will prove the work is correct.\n\n- Shared render/data output is still correct."
    )
    .replace(
      "Write the testable completion condition.\n\n- TODO",
      "Write the testable completion condition.\n\n- The render path still returns data from lib/data.js."
    )
    .replace(
      "Write the conditions that should trigger replanning or escalation.\n\n- TODO",
      "Write the conditions that should trigger replanning or escalation.\n\n- The render/data boundary needs broader redesign."
    )
    .replace(
      "Record durable facts discovered during execution. Write `none` until evidence exists.\n\n- none",
      "Record durable facts discovered during execution. Write `none` until evidence exists.\n\n- functions/render.js imports shared logic from lib/data.js.\n- The visible render surface depends on the shared data module."
    );
  await atomicWriteFile(workPath, work);
  await runCli(["plan", "WU-110", "--ready"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["review", "WU-110", "--verdict=pass"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["cleanup"], { ...createBufferIo(), cwd: tempDir });

  const architecture = await readFile(path.join(tempDir, ".yxg", "baseline", "ARCHITECTURE.md"), "utf8");
  const summary = await readFile(path.join(tempDir, ".yxg", "baseline", "IMPORT-SUMMARY.md"), "utf8");

  assert.match(architecture, /Recent completed work WU-110 \(Baseline Refresh\) confirmed touch points functions\/render\.js, lib\/data\.js\./);
  assert.match(summary, /Recent completed work WU-110 \(Baseline Refresh\) added durable knowledge about functions\/render\.js, lib\/data\.js\./);
});

test("yxg cleanup keeps reviews for still-active work in current operations", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-cleanup-active-review-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-106"], { ...createBufferIo(), cwd: tempDir });

  const workPath = path.join(tempDir, ".yxg", "work", "active", "WU-106-wu-106.md");
  let work = await readFile(workPath, "utf8");
  work = work
    .replace("\nTODO\n", "\nBuild revise lifecycle support.\n")
    .replace("- TODO", "- In scope is revise lifecycle behavior.")
    .replace("- TODO", "- Out of scope is unrelated repository changes.")
    .replace("- TODO", "- Touch point is the work artifact.")
    .replace("- TODO", "- Verification is successful review artifact creation.")
    .replace("- TODO", "- Done when a revise verdict returns work to ready.")
    .replace("- TODO", "- Escalate if review lifecycle semantics change.");
  await (await import("../src/fs/atomic-write.js")).atomicWriteFile(workPath, work);
  await runCli(["plan", "WU-106", "--ready"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["review", "WU-106", "--verdict=revise"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["cleanup"], { ...createBufferIo(), cwd: tempDir });

  const index = await readFile(path.join(tempDir, ".yxg", "INDEX.md"), "utf8");
  assert.match(index, /\.yxg\/work\/active\/WU-106-wu-106\.md/);
  assert.match(index, /\.yxg\/reviews\/WU-106-review\.md/);
});

test("yxg cleanup fails safely before init", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-cleanup-no-init-"));

  const io = createBufferIo();
  const result = await runCli(["cleanup"], { ...io, cwd: tempDir });

  assert.equal(result.ok, false);
  assert.match(io.readStderr(), /missing \.yxg scaffold/);
});
