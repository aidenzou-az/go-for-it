import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
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

async function initCommittedGitRepo(tempDir) {
  execFileSync("git", ["init", "-b", "main"], { cwd: tempDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "YXG Test"], { cwd: tempDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "yxg@example.com"], { cwd: tempDir, stdio: "ignore" });

  await writeFile(path.join(tempDir, "README.md"), "# Test Repo\n");
  await writeFile(path.join(tempDir, "src", "feature.js"), "export const feature = true;\n", { flag: "w" }).catch(async () => {
    await (await import("node:fs/promises")).mkdir(path.join(tempDir, "src"), { recursive: true });
    await writeFile(path.join(tempDir, "src", "feature.js"), "export const feature = true;\n");
  });

  execFileSync("git", ["add", "."], { cwd: tempDir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: tempDir, stdio: "ignore" });
}

async function makeWorkReady(tempDir, workId, filename, touchPoints = ["src/feature.js"]) {
  const workPath = path.join(tempDir, ".yxg", "work", "active", filename);
  let work = await readFile(workPath, "utf8");
  work = work
    .replace("\nTODO\n", "\n实现与 Git 适配相关的功能。\n")
    .replace("- TODO", "- 更新工作相关文件。")
    .replace("- TODO", "- 不处理无关文件。")
    .replace("- TODO", touchPoints.map((value) => `- ${value}`).join("\n"))
    .replace(
      "List prior work, external inputs, or blocking prerequisites. Write `none` if there are none.\n\n- none",
      "List prior work, external inputs, or blocking prerequisites. Write `none` if there are none.\n\n- none"
    )
    .replace(
      "Write the assumptions this work relies on. If there are none, write `none`.\n\n- none",
      "Write the assumptions this work relies on. If there are none, write `none`.\n\n- 当前仓库使用 git。"
    )
    .replace(
      "Write the main risks or write `none`.\n\n- none",
      "Write the main risks or write `none`.\n\n- 无关变更可能混入 finish。"
    )
    .replace(
      "Write the bounded steps to complete the work.\n\n1. TODO",
      "Write the bounded steps to complete the work.\n\n1. 更新相关文件。\n2. 验证输出。"
    )
    .replace(
      "Write the checks that will prove the work is correct.\n\n- TODO",
      "Write the checks that will prove the work is correct.\n\n- 相关文件被正确修改。"
    )
    .replace(
      "Write the testable completion condition.\n\n- TODO",
      "Write the testable completion condition.\n\n- review 可以通过。"
    )
    .replace(
      "Write the conditions that should trigger replanning or escalation.\n\n- TODO",
      "Write the conditions that should trigger replanning or escalation.\n\n- 发现大量无关变更。"
    );

  await atomicWriteFile(workPath, work);
  const result = await runCli(["plan", workId, "--ready"], { ...createBufferIo(), cwd: tempDir });
  assert.equal(result.ok, true);
}

test("yxg plan in a git repo suggests branch and commit trailer", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-git-plan-"));
  await initCommittedGitRepo(tempDir);
  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  const result = await runCli(["plan", "WU-200", "--slug=git-adapter", "--title=Git Adapter"], {
    ...createBufferIo(),
    cwd: tempDir
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.suggested_branch, "yxg/wu-200-git-adapter");
  assert.equal(result.data.suggested_commit_trailer, "YXG-Work: WU-200");
  assert.equal(result.data.git.branch, "main");
});

test("yxg resume classifies related and unrelated changes for the active work", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-git-resume-"));
  await initCommittedGitRepo(tempDir);
  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-201", "--slug=git-resume", "--title=Git Resume"], {
    ...createBufferIo(),
    cwd: tempDir
  });
  await makeWorkReady(tempDir, "WU-201", "WU-201-git-resume.md");

  await writeFile(path.join(tempDir, "src", "feature.js"), "export const feature = false;\n");
  await writeFile(path.join(tempDir, "README.md"), "# Changed\n");

  const result = await runCli(["resume"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.data.git.branch, "main");
  assert.equal(result.data.git.suggested_branch, "yxg/wu-201-git-resume");
  assert.equal(result.data.git.branch_matches_recommended_work, false);
  assert.match(result.data.git.branch_mismatch_reason, /current branch main does not match suggested branch yxg\/wu-201-git-resume/);
  assert.deepEqual(result.data.git.related_paths, ["src/feature.js"]);
  assert.deepEqual(result.data.git.unrelated_paths, ["README.md"]);
  assert.match(result.next_steps.join("\n"), /Branch mismatch:/);
});

test("yxg resume reports matching git branch for the recommended work", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-git-resume-branch-match-"));
  await initCommittedGitRepo(tempDir);
  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-204", "--slug=branch-match", "--title=Branch Match"], {
    ...createBufferIo(),
    cwd: tempDir
  });
  await makeWorkReady(tempDir, "WU-204", "WU-204-branch-match.md");
  execFileSync("git", ["switch", "-c", "yxg/wu-204-branch-match"], { cwd: tempDir, stdio: "ignore" });

  const result = await runCli(["resume"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.data.git.branch, "yxg/wu-204-branch-match");
  assert.equal(result.data.git.suggested_branch, "yxg/wu-204-branch-match");
  assert.equal(result.data.git.branch_matches_recommended_work, true);
  assert.equal(result.data.git.branch_mismatch_reason, null);
});

test("yxg resume suggests the actionable work branch instead of a monitoring work branch", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-git-resume-monitoring-branch-"));
  await initCommittedGitRepo(tempDir);
  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });

  await runCli(["plan", "WU-013", "--slug=collector", "--title=Collector"], {
    ...createBufferIo(),
    cwd: tempDir
  });
  await makeWorkReady(tempDir, "WU-013", "WU-013-collector.md");
  await runCli(["execute", "WU-013"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["execute", "WU-013", "--monitoring"], { ...createBufferIo(), cwd: tempDir });

  await runCli(["plan", "WU-014", "--slug=policy", "--title=Policy"], {
    ...createBufferIo(),
    cwd: tempDir
  });
  await makeWorkReady(tempDir, "WU-014", "WU-014-policy.md");
  execFileSync("git", ["switch", "-c", "yxg/wu-013-collector"], { cwd: tempDir, stdio: "ignore" });

  const result = await runCli(["resume"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.data.recommended_work_id, "WU-014");
  assert.equal(result.data.git.suggested_branch, "yxg/wu-014-policy");
  assert.equal(result.data.git.branch_matches_recommended_work, false);
  assert.match(result.data.git.branch_mismatch_reason, /current branch yxg\/wu-013-collector does not match suggested branch yxg\/wu-014-policy/);
  assert.match(result.details, /branch mismatch/);
  assert.match(result.next_steps.join("\n"), /Branch mismatch:/);
  assert.match(result.next_steps.join("\n"), /yxg\/wu-014-policy/);
});

test("yxg resume reports git unavailable outside a git worktree without creating .git", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-git-unavailable-resume-"));

  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  const result = await runCli(["resume"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.data.git, null);
  assert.match(result.details, /git: unavailable/);
  await assert.rejects(stat(path.join(tempDir, ".git")), { code: "ENOENT" });
});

test("yxg review pass reports unrelated git changes and suggested commit trailer", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-git-review-"));
  await initCommittedGitRepo(tempDir);
  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-202", "--slug=git-review", "--title=Git Review"], {
    ...createBufferIo(),
    cwd: tempDir
  });
  await makeWorkReady(tempDir, "WU-202", "WU-202-git-review.md");
  await runCli(["execute", "WU-202"], { ...createBufferIo(), cwd: tempDir });

  await writeFile(path.join(tempDir, "src", "feature.js"), "export const feature = 2;\n");
  await writeFile(path.join(tempDir, "README.md"), "# Changed Again\n");

  const result = await runCli(["review", "WU-202", "--verdict=pass"], {
    ...createBufferIo(),
    cwd: tempDir
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.git.suggested_commit_trailer, "YXG-Work: WU-202");
  assert.match(result.next_steps.join("\n"), /Inspect unrelated repository changes/);
  assert.match(result.next_steps.join("\n"), /YXG-Work: WU-202/);
});

test("yxg cleanup reports git worktree state for archived work", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "yxg-git-cleanup-"));
  await initCommittedGitRepo(tempDir);
  await runCli(["init"], { ...createBufferIo(), cwd: tempDir });
  await runCli(["plan", "WU-203", "--slug=git-cleanup", "--title=Git Cleanup"], {
    ...createBufferIo(),
    cwd: tempDir
  });
  await makeWorkReady(tempDir, "WU-203", "WU-203-git-cleanup.md");
  await runCli(["execute", "WU-203"], { ...createBufferIo(), cwd: tempDir });

  await writeFile(path.join(tempDir, "src", "feature.js"), "export const feature = 3;\n");
  await writeFile(path.join(tempDir, "README.md"), "# Cleanup Dirty\n");

  await runCli(["review", "WU-203", "--verdict=pass"], { ...createBufferIo(), cwd: tempDir });
  const result = await runCli(["cleanup"], { ...createBufferIo(), cwd: tempDir });

  assert.equal(result.ok, true);
  assert.equal(result.data.archived_work_ids[0], "WU-203");
  assert.equal(result.data.git.branch, "main");
  assert.deepEqual(result.data.git.related_paths, ["src/feature.js"]);
  assert.deepEqual(result.data.git.unrelated_paths, ["README.md"]);
  assert.match(result.details, /git: dirty on main/);
});
