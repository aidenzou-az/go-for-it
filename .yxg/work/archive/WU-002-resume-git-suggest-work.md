---
artifact_type: work
schema_version: "1.0"
kernel_version: "1"
id: WU-002
slug: resume-git-suggest-work
title: 增强 resume 的 git suggest 输出：在推荐当前 work 后返回 current branch、suggested branch、branch_matches_recommended_work、branch_mismatch_reason，并继续返回 related/unrelated changes；monitoring work 不参与 branch 匹配推荐，除非没有其他 actionable work。
status: done
priority: medium
owner_role: planner
created_at: "2026-05-13"
updated_at: "2026-05-13"
---

# Work Unit

## Objective

增强 `yxg resume --json` 的 git suggest 输出，使 Codex 能判断当前 branch 是否适合继续推荐 work，并用结构化字段解释 branch mismatch 风险。

## In Scope

- 在 `resume` 推荐 current work 后，返回当前 branch、推荐 branch、匹配布尔值和 mismatch reason。
- 保留并复用现有 related/unrelated dirty worktree 分类。
- 让 monitoring work 不参与 branch 匹配推荐，除非没有其他 actionable work。
- 在 human-readable details/next steps 中体现 branch mismatch 风险，但不自动切换 branch。

## Out Of Scope

- 不执行任何 git 写操作。
- 不新增 checkout、branch、worktree、commit 命令。
- 不修改 Codex skill 文案，除非测试需要极小同步；主要 skill 更新归 WU-003。
- 不改变 work 推荐顺序，除非是为了保持 monitoring 不抢占 actionable work 的既有语义。

## Expected Touch Points

- `src/git/context.js`
- `src/commands/resume-command.js`
- `tests/git-adapter-runtime.test.js`
- `tests/init-and-validate.test.js`
- `docs/TOOLING-CONTRACT.md`

## Dependencies

- WU-001：git adapter 规范先收敛为 observe/suggest。

## Assumptions

- 推荐 branch 继续使用现有 `yxg/<work-id-lower>-<slug>` 约定。
- branch mismatch 是风险提示，不是 hard error。
- 当前 branch 为 `main` 或其他非推荐 branch 时，也应能解释为未处于推荐 work branch。

## Risks

- branch 匹配规则过严会让正常团队分支策略产生噪音。
- branch 匹配规则过松会让 Agent 在错误分支继续工作的风险无法暴露。
- untracked `.yxg/` 或 repo 初始脏状态可能干扰测试判断。

## Plan

1. 定义 `data.git` 中 branch match 相关字段命名和语义。
2. 在 git context 或 resume 层实现 recommended work branch 匹配判断。
3. 将 mismatch reason 写入 structured JSON 和 next steps/details。
4. 覆盖 monitoring + ready work 的推荐与 branch suggestion 场景。
5. 跑相关 runtime 测试。

## Verification

- `node --test tests/git-adapter-runtime.test.js tests/init-and-validate.test.js`
- 手工查看 `yxg resume --json` 输出包含 branch match 与 mismatch reason 字段。

## Done When

- `resume --json` 能在推荐 work 后稳定返回 branch match 字段；当前 branch 与推荐 branch 不一致时给出明确 mismatch reason；测试覆盖 monitoring 不抢占 branch 推荐。

## Escalate If

- 需要修改 work artifact schema 才能表达 branch policy。
- 发现现有 branch naming 约定不足以支持 mismatch 判断。

## Evidence Log

- 当前 `src/git/context.js` 已提供 `branch`、`suggested_branch`、`suggested_commit_trailer`、related/unrelated 分类，但尚未返回 branch match/mismatch 字段。
- 2026-05-13 已在 `src/git/context.js` 增加 `branch_matches_recommended_work` 与 `branch_mismatch_reason`，当当前 branch 与推荐 work 的 suggested branch 不一致时返回明确原因。
- 2026-05-13 已在 `src/commands/resume-command.js` 的 `next_steps` 中加入 branch mismatch 提示，并在 git summary 中标记 `branch mismatch`，保持 suggest-only，不阻塞也不切分支。
- 2026-05-13 已补 `tests/git-adapter-runtime.test.js` 覆盖 main 分支 mismatch、推荐 work 分支匹配、WU-013 monitoring + WU-014 ready 时 branch suggestion 指向 WU-014 的场景。
- 2026-05-13 当前仓库 `yxg resume --json` 已返回 `branch_matches_recommended_work: false` 与 `branch_mismatch_reason: current branch main does not match suggested branch yxg/wu-002-resume-git-suggest-work`。
- 2026-05-13 已通过 `node --test tests/git-adapter-runtime.test.js tests/init-and-validate.test.js` 和 `node --test` 全量测试，65/65 passed。

## Notes

- 此 work 为 WU-003 的 skill 行为提供结构化基础。
