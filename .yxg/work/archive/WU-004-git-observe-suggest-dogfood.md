---
artifact_type: work
schema_version: "1.0"
kernel_version: "1"
id: WU-004
slug: git-observe-suggest-dogfood
title: 补 git observe/suggest 场景测试和 dogfood 检查：覆盖当前推荐 WU-014 但 branch 是 yxg/wu-013-collector 时 resume 返回 mismatch；WU-013 monitoring、WU-014 ready 时 branch 建议指向 WU-014；非 git 项目 init/import 不创建 .git；finish skill 文档要求提示 mismatch/unrelated changes；full test 覆盖 git unavailable、branch mismatch、dirty unrelated changes。
status: done
priority: medium
owner_role: planner
created_at: "2026-05-13"
updated_at: "2026-05-13"
---

# Work Unit

## Objective

补齐 git observe/suggest 的端到端测试和 dogfood 检查，确保 branch mismatch、无 git 降级、monitoring 与 unrelated dirty changes 的关键行为不会回归。

## In Scope

- 覆盖当前推荐 WU-014 但当前 branch 是 `yxg/wu-013-collector` 的 mismatch 场景。
- 覆盖 WU-013 monitoring、WU-014 ready 时，resume branch suggestion 指向 WU-014。
- 覆盖非 git 项目 init/import 不创建 `.git`。
- 覆盖 finish skill 文档要求提示 branch mismatch 与 unrelated dirty changes。
- 将必要 dogfood checklist 条目补充成可测试文本。

## Out Of Scope

- 不新增 runtime 功能，除非发现测试无法表达已规划行为。
- 不修改 git adapter 规范主语义，除非修复明显遗漏。
- 不做 GitHub/PR 测试。
- 不创建真实长期 worktree 或依赖外部 git remote。

## Expected Touch Points

- `tests/git-adapter-runtime.test.js`
- `tests/init-and-validate.test.js`
- `tests/codex-adapter.test.js`
- `tests/git-integration-docs.test.js`
- `docs/CODEX-DOGFOOD-CHECKLIST.md`
- `docs/GIT-INTEGRATION-SPEC.md`

## Dependencies

- WU-001：规范边界完成。
- WU-002：resume git suggest 字段完成。
- WU-003：Codex intent skill 行为完成。

## Assumptions

- 测试可用临时 git repo 模拟 branch mismatch。
- 无 git 测试应在临时目录运行，避免污染当前仓库。
- dogfood checklist 的文本约束足以防止 skill 文案漂移。

## Risks

- 测试如果过度绑定具体文案，会增加后续维护成本。
- 临时 git repo 测试如果没有隔离干净，可能受全局 git 配置影响。
- 当前仓库本身 worktree 很脏，测试必须避免依赖当前 repo clean 状态。

## Plan

1. 为 branch mismatch 与 monitoring 推荐关系补 runtime 测试。
2. 为无 git init/import 不创建 `.git` 补测试。
3. 为 Codex skill 文档风险提示补测试。
4. 更新 dogfood checklist 中 git observe/suggest 体验验收项。
5. 跑 full test，确认所有新增约束稳定。

## Verification

- `node --test`
- 手工确认测试没有依赖当前仓库 clean worktree。

## Done When

- git observe/suggest 的关键行为均有自动化测试覆盖；full test 通过；dogfood checklist 能指导用户验证 branch mismatch、无 git 降级和 monitoring 分流。

## Escalate If

- WU-002 或 WU-003 未提供足够结构化输出，导致测试只能验证脆弱文案。
- 需要引入 git remote 或 GitHub 才能验证预期行为。

## Evidence Log

- 当前已有 `tests/git-adapter-runtime.test.js` 覆盖 branch、related/unrelated、commit trailer 等基础 git adapter 行为，可在其上扩展。
- 2026-05-13 已在 `tests/git-adapter-runtime.test.js` 补强 WU-013 monitoring + WU-014 ready 场景：当前 branch 为 `yxg/wu-013-collector` 时，`resume` 仍推荐 WU-014、`suggested_branch` 指向 `yxg/wu-014-policy`，并返回 branch mismatch details/next_steps。
- 2026-05-13 已在 `tests/git-adapter-runtime.test.js` 新增非 git worktree 的 resume 覆盖：`yxg init` 后 `resume` 返回 `git: unavailable`，且不会创建 `.git`。
- 2026-05-13 已在 `tests/init-and-validate.test.js` 覆盖非 git 目录下 `yxg init` 和 `yxg import` 都不会创建 `.git`，保持 git setup 为显式用户动作。
- 2026-05-13 已在 `docs/GIT-INTEGRATION-SPEC.md` 增加 Branch Mismatch And Monitoring Handoff 章节，明确 branch mismatch、monitoring 不抢占 actionable work、unrelated dirty changes 只作为 observe/suggest 风险。
- 2026-05-13 已在 `docs/CODEX-DOGFOOD-CHECKLIST.md` 增加 git observe/suggest dogfood 场景，包括 WU-013/WU-014 分流、branch mismatch、非 git init/import、finish unrelated dirty changes。
- 2026-05-13 已在 `tests/git-integration-docs.test.js` 增加 checklist 和 git spec 文本约束，防止 dogfood 验收项漂移。
- 2026-05-13 验证通过：`node --test tests/git-adapter-runtime.test.js tests/init-and-validate.test.js tests/codex-adapter.test.js tests/git-integration-docs.test.js` 54/54 passed；`node --test` 全量 69/69 passed。

## Notes

- 此 work 是测试兜底，顺序上应在 WU-001 到 WU-003 之后执行。
