---
artifact_type: work
schema_version: "1.0"
kernel_version: "1"
id: WU-005
slug: yxg-do-active-work
title: 让 yxg-do 在没有 active work 但存在 roadmap/planned next work 时，以意图方式启动下一项，而不是要求用户手写 yxg plan WU-xxx --ready
status: done
priority: medium
owner_role: planner
created_at: "2026-05-13"
updated_at: "2026-05-13"
---

# Work Unit

## Objective

让 `yxg-do` 在没有 active work 但 roadmap 已明确下一项 planned work 时，能通过 intent flow 继续推进：Codex 应识别 planned next、内部创建或启动对应 work unit，并避免要求用户手写 `yxg plan WU-xxx --ready`。

## In Scope

- `yxg resume --json` 在无 active work 时，识别 `.yxg/ROADMAP.md` 中 `Now`/`Next` 的首个 `WU-xxx` planned next。
- 为 planned next 返回结构化字段，供 Codex skill 消费。
- 更新 `yxg-do` skill：无 active 但有 planned next 时，内部走 plan/contract/execute 流程；无 planned next 时才建议用户发起新 plan。
- 更新 adapter spec、dogfood checklist 和测试，防止再次暴露 `yxg plan WU-xxx --ready` 这种底层用法。

## Out Of Scope

- 不自动把 roadmap 里的每一项都创建成 work unit。
- 不跳过合同补全和 ready 校验。
- 不在没有 roadmap 证据时凭空发明下一项任务。
- 不引入 GitHub/托管平台行为。

## Expected Touch Points

- `src/commands/resume-command.js`
- `src/commands/plan-command.js`
- `plugins/yxg/skills/yxg-do/SKILL.md`
- `docs/CODEX-ADAPTER-SPEC.md`
- `docs/CODEX-DOGFOOD-CHECKLIST.md`
- `docs/WORKFLOW-COMMANDS.md`
- `tests/init-and-validate.test.js`
- `tests/codex-adapter.test.js`

## Dependencies
- WU-002：`resume` 已能提供结构化 recommended work 和 git context。
- WU-003：`yxg-do` intent skill 已能消费 kernel 输出而不是暴露底层命令。

## Assumptions
- Roadmap 中 planned work 的最小可识别格式是包含 `WU-xxx` 的 bullet 或文本行，例如 `- WU-008 BTC L1 数据基础与 raw cache`。
- `yxg-do` 可以创建 planned work 的 draft，但仍需按合同完整性决定是否进入 ready/active。
- 已归档或已有 active 的 work 不应被 roadmap planned-next 逻辑重复创建。

## Risks
- 如果 roadmap 文案格式过自由，planned next 识别可能误判。
- 如果 `yxg-do` 过度自动化，可能重新引入“不经确认就实现”的体验问题。
- planned next 的标题/slug 从 roadmap 推断时可能不如用户手写精确。

## Plan
1. 为 `resume` 增加无 active work 时的 roadmap planned-next 识别和结构化输出。
2. 更新 `yxg-do` skill，让 Codex 用 planned next 内部创建/启动 work，而不是要求用户手写底层命令。
3. 更新 adapter spec、workflow commands 和 dogfood checklist。
4. 补测试覆盖 no active + roadmap WU-008 场景，以及 skill 文案不再建议 raw `plan WU-xxx --ready`。
5. 跑相关测试和全量测试。

## Verification
- `node --test tests/init-and-validate.test.js tests/codex-adapter.test.js`
- `node --test`

## Done When
- 无 active work 且 roadmap 明确 `WU-008` 时，`yxg resume --json` 返回 planned next 结构化字段；`yxg-do` skill 明确内部处理 planned next，不要求用户发 `yxg plan WU-008 --ready`。

## Escalate If
- 需要设计完整 roadmap schema 才能安全识别 planned work。
- 用户期望 `yxg-do` 在没有合同的情况下直接进入实现。

## Evidence Log
- 用户 dogfooding 发现：没有 active work 时，Codex 把下一步说成“发 `$yxg:yxg-plan WU-008 --ready` 或直接说开始 WU-008”，这暴露了底层命令，并且不符合 intent-level yxg 使用方式。
- 当前 `plugins/yxg/skills/yxg-do/SKILL.md` 第 2 步写明“没有 active work 就告诉用户并建议 `$yxg:yxg-plan <task>`”，没有处理 roadmap planned next。
- 当前 `src/commands/resume-command.js` 只从 active work 和 state narrative 推断 `recommended_work_id`，没有在无 active work 时读取 `.yxg/ROADMAP.md`。
- 执行 `yxg plan WU-005 --ready --json` 时发现一个相邻漂移：对已有 work ready 时，返回的 `slug`/`title` 会从 work ID 重新推断为 `wu-005`/`Wu 005`，而不是保留 artifact frontmatter。planned-next 内部启动会依赖这些字段，因此本 work 需要一并修正。
- 2026-05-13 已更新 `src/commands/resume-command.js`：无 active work 且 `.yxg/ROADMAP.md` 的 `Now`/`Next` 中存在 `WU-xxx` 时，返回 `planned_next_work` 结构化字段，并在 details/next_steps 中显示 planned next，但不创建 work artifact。
- 2026-05-13 已更新 `src/commands/plan-command.js`：对已有 work 执行 ready 转换时，返回值保留 artifact frontmatter 中的 `slug` 和 `title`，避免重新推断成 `wu-xxx`。
- 2026-05-13 已更新 `plugins/yxg/skills/yxg-do/SKILL.md`：无 active 但有 planned next 时，Codex 应内部读取 roadmap、创建/更新 work、补全合同并通过 ready 校验后再执行；不要求用户运行 `yxg plan WU-xxx --ready`。
- 2026-05-13 已更新 `docs/CODEX-ADAPTER-SPEC.md`、`docs/WORKFLOW-COMMANDS.md` 和 `docs/CODEX-DOGFOOD-CHECKLIST.md`，固化 planned-next 的 resume 语义和 dogfood 预期。
- 2026-05-13 已补测试：`yxg resume surfaces planned next work from roadmap when no active work exists`、`yxg plan --ready preserves existing work slug and title in command output`，并补强 codex adapter 文案断言。
- 2026-05-13 验证通过：`node --test tests/init-and-validate.test.js tests/codex-adapter.test.js` 46/46 passed；`node --test` 全量 71/71 passed。

## Notes
- 这个修复保留“plan 和 do 分离”的原则：`yxg-do` 可以启动 planned next 的合同创建流程，但不能在合同未明确时直接实现。
