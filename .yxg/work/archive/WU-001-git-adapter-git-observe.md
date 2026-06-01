---
artifact_type: work
schema_version: "1.0"
kernel_version: "1"
id: WU-001
slug: git-adapter-git-observe
title: 收敛 git adapter 规范：把 git 集成明确限定为 observe 和 suggest 两层，移除 managed/自动托管语义；明确 init/import 只检测 git 不自动 git init；明确 yxg 不自动 checkout、branch、worktree、commit；明确 shared .yxg/work 不记录本地 worktree 路径，STATE/INDEX/LOG 仍作为 local runtime views。
status: done
priority: medium
owner_role: planner
created_at: "2026-05-13"
updated_at: "2026-05-13"
---

# Work Unit

## Objective

把 yxg 的 git 集成规范收敛为 `observe` 与 `suggest` 两层，明确 git 只是 adapter 能力，不进入 kernel core，也不提供自动托管 git 状态的 managed 模式。

## In Scope

- 更新 git adapter 分层和模式定义。
- 明确 `yxg init` 与 `yxg import` 在无 git 项目中只检测和提示，不自动 `git init`。
- 明确 yxg 默认不自动执行 checkout、branch、worktree、commit 等写操作。
- 明确 shared `.yxg/work/**` 不记录本地 worktree 路径，`STATE.md`、`INDEX.md`、`LOG.md` 仍是 local runtime views。
- 明确后续 branch/worktree 相关能力只能停留在建议和风险提示层。

## Out Of Scope

- 不实现 runtime 代码改动。
- 不新增 GitHub、PR、CI 集成。
- 不设计 managed 模式或自动 git 操作。
- 不改变现有 `.yxg` scaffold 文件结构。

## Expected Touch Points

- `docs/GIT-INTEGRATION-SPEC.md`
- `docs/FRAMEWORK-SPEC.md`
- `docs/TOOLING-CONTRACT.md`
- `docs/CODEX-ADAPTER-SPEC.md`
- `docs/CODEX-DOGFOOD-CHECKLIST.md`
- `tests/git-integration-docs.test.js`
- `tests/codex-adapter.test.js`

## Dependencies

- none

## Assumptions

- 当前项目已经有轻量 git adapter 文档和 runtime 输出，可在此基础上收敛语义。
- 用户已明确不做 managed/托管层，所有 git 写操作必须保持显式人工动作或普通 Codex 操作，而不是 yxg kernel 自动动作。
- 文档语义要先稳定，后续 WU-002/WU-003 才能按一致边界实现。

## Risks

- 如果文档仍保留 managed 或自动 worktree 暗示，后续实现会漂移。
- 如果把 git 约束写得过强，会破坏无 git 项目或非标准团队流程的可用性。

## Plan

1. 审阅现有 git integration、tooling、Codex adapter 文档中的 git 语义。
2. 将 git mode 收敛为 `observe` 与 `suggest`，删除或改写 managed/自动托管暗示。
3. 明确 init/import 对无 git 项目的处理边界。
4. 明确 shared/local artifact 与 branch/worktree 信息的落点边界。
5. 补文档测试，防止 managed 语义回流。

## Verification

- `node --test tests/git-integration-docs.test.js tests/codex-adapter.test.js`
- 手动检查相关文档中不再出现把 managed 作为目标模式的规范性表述。

## Done When

- git adapter 规范明确只支持 observe/suggest，不包含 managed；init/import 无 git 时只检测提示，不自动初始化；所有相关文档测试通过。

## Escalate If

- 发现现有代码已经依赖 managed/自动 git 操作语义。
- 需要引入新 CLI 命令才能完成文档语义收敛。

## Evidence Log

- 2026-05-13 用户明确调整方向为“不做托管”，即不设计 managed 模式。
- 2026-05-13 已将 git adapter 规范收敛为 `observe`/`suggest` 两层；`docs/GIT-INTEGRATION-SPEC.md` 明确 yxg 不隐式执行 `git init`、checkout/switch、branch、worktree、add、commit 等 git 写操作。
- 2026-05-13 已在 `docs/FRAMEWORK-SPEC.md`、`docs/TOOLING-CONTRACT.md`、`docs/CODEX-ADAPTER-SPEC.md` 和 `docs/CODEX-DOGFOOD-CHECKLIST.md` 同步无 git 降级、非托管、显式用户动作边界。
- 2026-05-13 已通过 `node --test tests/git-integration-docs.test.js tests/codex-adapter.test.js`；并用 `rg` 检查相关文档没有规范性 managed/托管模式残留。
- 2026-05-13 已通过 `node --test` 全量测试，63/63 passed。

## Notes

- 这是后续 git suggest runtime 与 Codex skill 行为的前置规范工作。
