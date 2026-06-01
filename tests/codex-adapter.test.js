import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SUBCOMMANDS = ["do", "monitor", "finish", "cancel", "init", "import", "plan", "cancel-work", "review", "resume", "cleanup"];
const USER_FACING_INTENTS = ["plan", "do", "monitor", "finish", "resume", "cancel"];
const KERNEL_STYLE_SUBCOMMANDS = ["init", "import", "plan", "cancel-work", "review", "resume", "cleanup"];

test("yxg plugin manifest points Codex at the local skills adapter", async () => {
  const manifest = JSON.parse(
    await readFile("plugins/yxg/.codex-plugin/plugin.json", "utf8")
  );
  const marketplace = JSON.parse(
    await readFile(".agents/plugins/marketplace.json", "utf8")
  );

  assert.equal(manifest.name, "yxg");
  assert.equal(manifest.version, "0.1.1");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.interface.displayName, "yxg");
  assert.match(manifest.interface.longDescription, /\/yxg:monitor/);
  assert.match(manifest.interface.longDescription, /\/yxg:finish/);
  assert.equal(marketplace.plugins[0].name, "yxg");
  assert.equal(marketplace.plugins[0].source.path, "./plugins/yxg");
});

test("yxg codex adapter spec declares the slash namespace and fallback syntax", async () => {
  const spec = await readFile("docs/CODEX-ADAPTER-SPEC.md", "utf8");

  for (const subcommand of SUBCOMMANDS) {
    assert.match(spec, new RegExp(`/yxg:${subcommand}`));
  }

  assert.match(spec, /\$yxg init/);
  assert.match(spec, /\$yxg:yxg-plan <task description>/);
  assert.match(spec, /Users should not need to think in terms of `execute`, `review`, `cleanup`/);
  assert.match(spec, /manually install or enable the local plugin inside Codex/i);
});

test("yxg skills advertise slash aliases for the supported subcommands", async () => {
  const dispatcher = await readFile("plugins/yxg/skills/yxg/SKILL.md", "utf8");
  assert.match(dispatcher, /\/yxg:<subcommand>/);
  assert.match(dispatcher, /Prefer the intent-level skills `plan`, `do`, `monitor`, `finish`, `resume`, and `cancel`/);

  for (const subcommand of SUBCOMMANDS) {
    const skill = await readFile(`plugins/yxg/skills/yxg-${subcommand}/SKILL.md`, "utf8");
    assert.match(skill, new RegExp(`/yxg:${subcommand}`));
    assert.match(skill, new RegExp(`\\$yxg-${subcommand}`));
    if (KERNEL_STYLE_SUBCOMMANDS.includes(subcommand)) {
      assert.match(skill, new RegExp(`yxg ${subcommand}`));
    }
  }
});

test("yxg plan adapter documents natural-language intake through --task", async () => {
  const skill = await readFile("plugins/yxg/skills/yxg-plan/SKILL.md", "utf8");
  const spec = await readFile("docs/CODEX-ADAPTER-SPEC.md", "utf8");
  const checklist = await readFile("docs/CODEX-DOGFOOD-CHECKLIST.md", "utf8");

  assert.match(skill, /yxg plan --task=/);
  assert.match(skill, /Never probe natural-language task text by first calling `yxg plan "<task text>"`/);
  assert.match(skill, /\$yxg:yxg-plan/);
  assert.match(skill, /focused clarification questions/i);
  assert.match(skill, /already established scope, constraints, tradeoffs, or acceptance criteria/i);
  assert.match(skill, /repository-wide product or engineering constraints go into `.yxg\/PROJECT\.md`/i);
  assert.match(skill, /repository structure, runtime, dependency, or verification understanding.*baseline artifact/i);
  assert.match(skill, /write the resulting conclusions back into the work artifact/i);
  assert.match(skill, /Do not move the work unit to `ready` while such material ambiguity remains unresolved/);
  assert.match(spec, /yxg plan --task=/);
  assert.match(spec, /must not "try and see" with `yxg plan "<task text>"` first/i);
  assert.match(spec, /carry forward already-confirmed scope, constraints, tradeoffs, and acceptance criteria/i);
  assert.match(spec, /task-local conclusions go into the current work artifact/i);
  assert.match(spec, /repository-wide product or engineering constraints go into `.yxg\/PROJECT\.md`/i);
  assert.match(spec, /should not automatically enter implementation after planning/i);
  assert.match(spec, /must not advance a work unit to `ready` while material ambiguity remains unresolved/i);
  assert.match(spec, /manually install or enable the local plugin inside Codex/i);
  assert.match(spec, /must not initialize git automatically/i);
  assert.match(checklist, /does not first probe with `yxg plan '增加“降水概率”显示'`/);
  assert.match(checklist, /already discussed in chat, Codex carries forward the already-confirmed scope, constraints, tradeoffs, and acceptance criteria/i);
  assert.match(checklist, /repository-wide constraints into `.yxg\/PROJECT\.md`/i);
  assert.match(checklist, /does not automatically enter execution just because planning succeeded/i);
  assert.match(checklist, /writes any externally researched conclusions back into `Evidence Log`, `Assumptions`, or `Risks`/);
});

test("yxg user-facing intent skills are documented as the primary dogfood interface", async () => {
  const spec = await readFile("docs/CODEX-ADAPTER-SPEC.md", "utf8");
  const checklist = await readFile("docs/CODEX-DOGFOOD-CHECKLIST.md", "utf8");

  for (const intent of USER_FACING_INTENTS) {
    const skill = await readFile(`plugins/yxg/skills/yxg-${intent}/SKILL.md`, "utf8");
    assert.match(skill, new RegExp(`\\$yxg:yxg-${intent}`));
    assert.match(spec, new RegExp(`/yxg:${intent}`));
  }

  assert.match(checklist, /\$yxg:yxg-do/);
  assert.match(checklist, /\$yxg:yxg-monitor/);
  assert.match(checklist, /\$yxg:yxg-finish/);
  assert.match(checklist, /\$yxg:yxg-resume/);
  assert.match(checklist, /\$yxg:yxg-cancel/);
  assert.match(checklist, /\$yxg:yxg-init/);
  assert.match(checklist, /\$yxg:yxg-import/);
  assert.match(checklist, /prefer the user-facing skills instead of raw kernel commands/i);
});

test("yxg init and import skills distinguish greenfield from existing-repository onboarding", async () => {
  const initSkill = await readFile("plugins/yxg/skills/yxg-init/SKILL.md", "utf8");
  const importSkill = await readFile("plugins/yxg/skills/yxg-import/SKILL.md", "utf8");
  const spec = await readFile("docs/CODEX-ADAPTER-SPEC.md", "utf8");
  const checklist = await readFile("docs/CODEX-DOGFOOD-CHECKLIST.md", "utf8");

  assert.match(initSkill, /greenfield/i);
  assert.match(initSkill, /recommend `?\$yxg:yxg-import`?/i);
  assert.match(initSkill, /not a git worktree/i);
  assert.match(initSkill, /Do not suggest or run `git init`/i);
  assert.match(importSkill, /existing repository/i);
  assert.match(importSkill, /Do not force the user to run `?init`? first/i);
  assert.match(importSkill, /Use the user's language for user-facing summaries by default/i);
  assert.match(importSkill, /what problem this project is solving/i);
  assert.match(importSkill, /who or what uses it/i);
  assert.match(importSkill, /the core workflow or output it provides/i);
  assert.match(importSkill, /the role this repository plays/i);
  assert.match(importSkill, /say so explicitly and identify which evidence is missing/i);
  assert.match(importSkill, /not a git worktree/i);
  assert.match(importSkill, /Do not suggest or run `git init`/i);
  assert.match(spec, /`init` is for greenfield repositories/i);
  assert.match(spec, /`import` is for existing repositories/i);
  assert.match(spec, /User-facing summaries should default to the user's language/i);
  assert.match(spec, /should summarize the project before summarizing the import/i);
  assert.match(spec, /what problem the project is solving, who uses it, the core workflow or output, and the role this repository plays/i);
  assert.match(spec, /should say so explicitly and identify the missing evidence/i);
  assert.match(checklist, /For a new or greenfield repository/i);
  assert.match(checklist, /For an existing repository/i);
  assert.match(checklist, /user-facing summaries stay in the user's language/i);
  assert.match(checklist, /what problem it solves/i);
  assert.match(checklist, /who uses it/i);
  assert.match(checklist, /the core workflow or output/i);
  assert.match(checklist, /the role this repository plays/i);
  assert.match(checklist, /without helping the user answer “这个项目是干什么的”/);
  assert.match(checklist, /does not run `git init` as part of `\$yxg:yxg-init` or `\$yxg:yxg-import`/);
});

test("import roadmap is linked and schema reflects onboarding-grade import mode", async () => {
  const agents = await readFile("AGENTS.md", "utf8");
  const roadmap = await readFile("docs/IMPORT-ENHANCEMENT-ROADMAP.md", "utf8");
  const artifactSchemas = await readFile("docs/ARTIFACT-SCHEMAS.md", "utf8");

  assert.match(agents, /Import enhancement roadmap: `docs\/IMPORT-ENHANCEMENT-ROADMAP\.md`/);
  assert.match(roadmap, /`import` is for existing repositories/i);
  assert.match(roadmap, /After `yxg import`, a capable adapter should be able to:/);
  assert.match(roadmap, /Acceptance Criteria/);
  assert.match(artifactSchemas, /`import_mode`: `deep-onboarding`/);
});

test("yxg-do documents kernel-safe execution and clarification behavior", async () => {
  const skill = await readFile("plugins/yxg/skills/yxg-do/SKILL.md", "utf8");
  const spec = await readFile("docs/CODEX-ADAPTER-SPEC.md", "utf8");
  const checklist = await readFile("docs/CODEX-DOGFOOD-CHECKLIST.md", "utf8");

  assert.match(skill, /Do not hand-edit `\.yxg\/STATE\.md`, `\.yxg\/INDEX\.md`, or work status fields/);
  assert.match(skill, /planned next/i);
  assert.match(skill, /ROADMAP\.md/);
  assert.match(skill, /Do not ask the user to run `yxg plan WU-xxx --ready`/);
  assert.match(skill, /If `resume` returns a unique recommended current work, continue that work/i);
  assert.match(skill, /ask the user which work to continue instead of picking one arbitrarily/i);
  assert.match(skill, /use the kernel path that advances execution state/);
  assert.match(skill, /branch_matches_recommended_work/);
  assert.match(skill, /branch_mismatch_reason/);
  assert.match(skill, /current branch, suggested branch/i);
  assert.match(skill, /unrelated dirty changes/i);
  assert.match(skill, /Do not run implicit git writes/i);
  assert.match(skill, /multiple user-visible surfaces could reasonably diverge/);
  assert.match(skill, /prefer that result over re-deriving branch, dirty-tree, or related\/unrelated change information manually/i);
  assert.match(skill, /lead with the task title and current action/);
  assert.match(spec, /must use kernel state-transition commands internally when they exist/);
  assert.match(spec, /planned next work/i);
  assert.match(spec, /must not tell the user to run `yxg plan WU-xxx --ready`/);
  assert.match(spec, /should continue only the work uniquely recommended by `yxg resume --json`/i);
  assert.match(spec, /should ask the user which work to continue instead of picking the first one arbitrarily/i);
  assert.match(spec, /should surface a unique recommended current work/i);
  assert.match(spec, /must pause for clarification when execution reaches a product decision that materially affects multiple visible surfaces/);
  assert.match(spec, /prefer kernel-returned git context over manually re-deriving/i);
  assert.match(spec, /branch_matches_recommended_work/);
  assert.match(spec, /branch_mismatch_reason/);
  assert.match(spec, /current branch, suggested branch, and risk/i);
  assert.match(spec, /observe\/suggest only/i);
  assert.match(spec, /must not implicitly run git writes/i);
  assert.match(checklist, /uses the existing yxg state machine internally instead of hand-editing/i);
  assert.match(checklist, /roadmap names a planned next work/i);
  assert.match(checklist, /does not ask the user to run `yxg plan WU-008 --ready`/);
  assert.match(checklist, /continues only the uniquely recommended work from `yxg resume --json`/i);
  assert.match(checklist, /silently picks the first active work/i);
  assert.match(checklist, /asks before making a product decision that changes multiple visible surfaces/i);
  assert.match(checklist, /reuses kernel-returned git context/i);
  assert.match(checklist, /branch_matches_recommended_work/);
  assert.match(checklist, /current branch, suggested branch, and mismatch reason/i);
  assert.match(checklist, /does not treat them as safe yxg-owned work/i);
  assert.match(checklist, /git integration as observe\/suggest only/i);
  assert.match(checklist, /runs `git init` as an implicit side effect/i);
  assert.match(checklist, /reports progress in task language first/i);
});

test("yxg-monitor documents user-facing monitoring transition behavior", async () => {
  const skill = await readFile("plugins/yxg/skills/yxg-monitor/SKILL.md", "utf8");
  const spec = await readFile("docs/CODEX-ADAPTER-SPEC.md", "utf8");
  const checklist = await readFile("docs/CODEX-DOGFOOD-CHECKLIST.md", "utf8");

  assert.match(skill, /execute <WORK-ID> --monitoring --json/);
  assert.match(skill, /The user should not need to name `execute --monitoring` or a work ID/);
  assert.match(skill, /record the monitoring reason, expected evidence, and observation window/i);
  assert.match(skill, /another actionable work is recommended/i);
  assert.match(skill, /monitoring work remains open/i);
  assert.match(skill, /does not抢占 later `yxg-do` runs/i);
  assert.match(skill, /branch mismatch or unrelated dirty changes/i);
  assert.match(spec, /\/yxg:monitor/);
  assert.match(spec, /yxg-monitor.*current recommended work into `monitoring`/i);
  assert.match(spec, /write the evidence gate back into the work artifact/i);
  assert.match(spec, /monitoring work remains open for evidence collection/i);
  assert.match(spec, /does not抢占 later `yxg-do` runs/i);
  assert.match(checklist, /execute --monitoring/);
  assert.match(checklist, /monitored work remains open until evidence arrives/i);
  assert.match(checklist, /does not抢占 later `\$yxg:yxg-do` runs/i);
});

test("yxg-finish documents user-facing close-out behavior and warning handling", async () => {
  const skill = await readFile("plugins/yxg/skills/yxg-finish/SKILL.md", "utf8");
  const spec = await readFile("docs/CODEX-ADAPTER-SPEC.md", "utf8");
  const checklist = await readFile("docs/CODEX-DOGFOOD-CHECKLIST.md", "utf8");

  assert.match(skill, /should not be narrated primarily as "running review", "running cleanup", or "running resume"/i);
  assert.match(skill, /use it to report branch, commit-trailer, and dirty-worktree risk instead of re-deriving those checks manually/i);
  assert.match(skill, /branch_matches_recommended_work: false/);
  assert.match(skill, /unrelated dirty changes/i);
  assert.match(skill, /not describe the finish as a clean or low-risk repository state/i);
  assert.match(skill, /Run one final `yxg resume --json` only to confirm the post-cleanup state/);
  assert.match(skill, /Do not claim that state was corrected unless a real change occurred/);
  assert.match(spec, /should perform review and cleanup internally, then summarize the result in user-facing terms rather than narrating low-level kernel steps/i);
  assert.match(spec, /should confirm post-cleanup state once and, if warnings remain, either resolve them through the kernel path or clearly report them as unresolved/i);
  assert.match(spec, /surface kernel-returned git context naturally/i);
  assert.match(spec, /must not describe the repository as clean or low-risk/i);
  assert.match(checklist, /keeps `review`, `cleanup`, and `resume` as internal mechanics rather than the main user-facing narration/i);
  assert.match(checklist, /surfaces kernel-returned git context naturally/i);
  assert.match(checklist, /yxg work is finished but the git state still needs separate attention/i);
  assert.match(checklist, /claims the repo is clean or low-risk/i);
  assert.match(checklist, /claims state was corrected even though no actual change was made/i);
  assert.match(checklist, /blurs the timing of warnings/i);
});
