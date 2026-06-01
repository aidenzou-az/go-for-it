---
artifact_type: work
schema_version: "1.0"
kernel_version: "1"
id: WU-003
slug: codex-intent-skills-git
title: 更新 Codex intent skills 的 git suggest 行为：yxg-do 遇到 branch mismatch 时提示风险和建议 branch；yxg-finish 遇到 branch mismatch 或 unrelated dirty changes 时明确提示不能轻易宣称无风险；yxg-monitor 说明 monitoring work 仍打开但不抢占后续 actionable work；yxg-init/import 无 git 时只提示能力降级，不建议自动初始化。
status: done
priority: medium
owner_role: planner
created_at: "2026-05-13"
updated_at: "2026-05-13"
---

# Work Unit

## Objective

更新 Codex intent skills，使 `yxg-do`、`yxg-finish`、`yxg-monitor`、`yxg-init` 和 `yxg-import` 能自然消费 git suggest 输出，并以用户语言提示风险而不是暴露底层 git adapter 细节。

## In Scope

- `yxg-do` 遇到 branch mismatch 时，提示当前 branch、建议 branch 和风险。
- `yxg-finish` 遇到 branch mismatch 或 unrelated dirty changes 时，不轻易宣称无风险完成。
- `yxg-monitor` 说明 monitoring work 仍打开，但不会抢占后续 actionable work。
- `yxg-init` 和 `yxg-import` 在无 git 时只说明能力降级，不建议自动初始化 git。
- 更新 adapter spec 与 dogfood checklist 中对应验收标准。

## Out Of Scope

- 不实现 runtime git 字段；该部分归 WU-002。
- 不新增 `$yxg:yxg-git-init` 或任何自动 git 操作入口。
- 不更改 plugin 安装脚本。
- 不引入 GitHub/PR 行为。

## Expected Touch Points

- `plugins/yxg/skills/yxg-do/SKILL.md`
- `plugins/yxg/skills/yxg-finish/SKILL.md`
- `plugins/yxg/skills/yxg-monitor/SKILL.md`
- `plugins/yxg/skills/yxg-init/SKILL.md`
- `plugins/yxg/skills/yxg-import/SKILL.md`
- `docs/CODEX-ADAPTER-SPEC.md`
- `docs/CODEX-DOGFOOD-CHECKLIST.md`
- `tests/codex-adapter.test.js`

## Dependencies

- WU-001：git adapter 规范边界已收敛。
- WU-002：resume 已提供 branch match/mismatch 的结构化字段。

## Assumptions

- Codex skill 层只消费 kernel 输出，不重新手写 branch 判断逻辑。
- 用户体验目标是自然语言提醒，而不是要求用户记住 CLI 参数或 work ID。
- 无 git 项目仍然是合法 yxg 项目。

## Risks

- skill 文案过强可能让普通 branch 工作流显得像错误。
- skill 文案过弱又可能无法阻止 Agent 在错误 branch 上继续工作。
- init/import 无 git 提示如果写得像推荐自动初始化，会违背用户已确认的边界。

## Plan

1. 更新 yxg-do skill，明确 branch mismatch 的提示和继续前确认行为。
2. 更新 yxg-finish skill，明确 mismatch/unrelated dirty changes 的收尾风险表达。
3. 更新 yxg-monitor skill，明确 monitoring 与后续 actionable work 的关系。
4. 更新 init/import skill，无 git 时只说明能力降级。
5. 更新 Codex adapter spec、dogfood checklist 和测试。

## Verification

- `node --test tests/codex-adapter.test.js`
- 手动检查 skill 文案中没有自动 git init、checkout、worktree、commit 的指令。

## Done When

- Codex intent skills 明确使用 resume 返回的 git suggest 字段提示风险；没有任何 skill 将 git 写操作描述为默认自动动作；adapter 测试通过。

## Escalate If

- WU-002 未能提供稳定 branch mismatch 字段。
- 需要新增独立 git intent skill 才能满足用户体验。

## Evidence Log

- 用户要求以 `yxg-plan`、`yxg-do`、`yxg-finish` 类似方式使用新机制，因此 git 提示也应保持 intent-level 而非 raw CLI 参数导向。
- 2026-05-13 已更新 `plugins/yxg/skills/yxg-do/SKILL.md`：`yxg-do` 会消费 `branch_matches_recommended_work`、`branch_mismatch_reason`、`suggested_branch` 和 unrelated dirty changes；遇到 mismatch 时先用自然语言说明当前 branch、建议 branch 与风险，不隐式执行 git 写操作。
- 2026-05-13 已更新 `plugins/yxg/skills/yxg-finish/SKILL.md`：收尾时如果仍有 branch mismatch 或 unrelated dirty changes，不宣称仓库 clean/low-risk，只能说明 yxg work 已完成且 git 风险仍需单独处理。
- 2026-05-13 已更新 `plugins/yxg/skills/yxg-monitor/SKILL.md`：monitoring work 保持打开等待证据，但不抢占后续可执行 work；monitor 场景下的 branch/dirty 风险也只做 observe/suggest。
- 2026-05-13 已更新 `plugins/yxg/skills/yxg-init/SKILL.md` 与 `plugins/yxg/skills/yxg-import/SKILL.md`：无 git 时只说明 branch isolation、dirty-worktree classification、commit-trailer handoff 能力降级，不建议或执行 `git init`。
- 2026-05-13 已更新 `docs/CODEX-ADAPTER-SPEC.md` 与 `docs/CODEX-DOGFOOD-CHECKLIST.md`，补充 intent skill 对 git suggest 字段的消费规则、monitoring 与 actionable work 的关系，以及 finish 时残留 git 风险的表达要求。
- 2026-05-13 已补强 `tests/codex-adapter.test.js`，覆盖 do/finish/monitor/init/import 的 git suggest 文案边界；`node --test tests/codex-adapter.test.js` 通过，`node --test` 全量 65/65 passed。

## Notes

- 此 work 只处理 Codex adapter 行为，不改变 kernel 命令语义。
