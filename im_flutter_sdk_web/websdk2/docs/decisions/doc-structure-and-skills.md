# 文档结构整理与 Skill 落地计划

## 目标

- 清理根目录散落的说明文档与计划文档，建立稳定的文档入口。
- 将长期有效的知识沉淀到 `docs/` 子目录，将临时/历史计划归档到 `plans/`。
- 在 `README.md` 中补充文档目录说明，明确 `docs/architecture`、`docs/testing` 等分层用途。
- 为后续项目级 skill 落地提供稳定的引用路径。

## 目录方案

### 根目录保留

- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`
- `docs/process/ai-collaboration-problems.md`（暂保留，后续可视情况迁入 `docs/process/` 或删除）

### 新增目录

- `docs/architecture/`
- `docs/process/`
- `docs/reference/`
- `docs/testing/`
- `docs/decisions/`
- `plans/active/`
- `plans/archive/`

## 文档迁移规则

### 迁入 `docs/reference/`

- `docs/reference/push-manager-api-name.md`
- `docs/reference/presence-manager-api-name.md`

原因：这两份文档是 API 对照与返回结构说明，属于长期参考资料，不应放在根目录。

### 迁入 `docs/process/`

- `docs/process/project-summary.md` 或合并其有效内容后移除

处理原则：

- 若内容与 `README.md`、`AGENTS.md` 明显重复，则不保留独立文件。
- 若仍有简明的“项目速览”价值，则迁为 `docs/process/project-summary.md`。

### 迁入 `docs/decisions/`

以下计划文档若内容已超出“纯任务清单”，包含明确背景、方案、风险和决策，可作为设计决策留档：

- `docs/decisions/agents-context-rebuild.md`
- `docs/decisions/error-code-alignment.md`
- `docs/decisions/real-env-e2e-rebuild.md`
- `docs/decisions/websdk2-release-skill.md`

处理原则：

- 文件名改为更稳定的决策类命名，如 `docs/decisions/agents-context-rebuild.md`
- 若已有对应正式文档吸收其内容，则删除冗余计划文件，不再重复保留

### 迁入 `plans/archive/`

以下文件优先视为历史实施计划归档：

- `plan-004-event-system-impl.md`
- `plan-demo-im-sdk.md`
- `plan-demo-message-components.md`
- `plan-demo-message-preview.md`
- `plan-demo-presence-apis.md`
- `plan-demo-presence.md`
- `plan-fix-lint.md`
- `plan-lint-cleanup.md`
- `plan-mock-msync-ws-protobuf.md`
- `plan-proto-adapter-skeleton.md`
- `plan-test-coverage-boost.md`

处理原则：

- 若对应内容已经进入 `specs/*/plan.md`、`docs/*` 或代码实现完成，则归档到 `plans/archive/`
- 若仍在执行中，则保留到 `plans/active/`

## README 调整

在 `README.md` 中新增“文档目录说明”区块，明确：

- `docs/architecture/`：项目架构、协议、缓存、跨平台适配
- `docs/testing/`：测试架构、测试分层、真实环境说明
- `docs/reference/`：API 对照、错误码、参考资料
- `docs/process/`：Spec-Kit、协作流程、代码修改指南
- `docs/decisions/`：重要设计决策与方案留档
- `plans/active/`：当前进行中的跨功能计划
- `plans/archive/`：历史计划归档

并补充一条约束：

- 新功能正式方案优先写入 `specs/<feature-id>/plan.md`
- 仅跨 feature 的临时执行计划写入 `plans/active/`

## Skill 落地顺序

文档整理完成后再新增第一批项目级 skill：

1. `project-onboarding`
2. `speckit-feature-workflow`
3. `test-layer-enforcer`
4. `release-change-check`

## 执行步骤

1. 新建 `docs` 子目录与 `plans/active`、`plans/archive`
2. 迁移根目录文档到目标目录
3. 处理 `docs/process/project-summary.md`：迁移或删除
4. 更新 `README.md` 的文档目录说明
5. 更新 `AGENTS.md` 中与文档入口相关的引用（如有必要）
6. 新建项目级 skill 目录与第一批 skill
7. 运行文档格式检查
8. 更新 `CHANGELOG.md`、版本号并提交

## 风险与处理

- 风险：部分 `plan-*.md` 仍有未沉淀信息，直接归档后不易发现
  - 处理：先按“长期参考 / 历史计划 / 可删除”分类，再迁移
- 风险：README 仍引用旧路径
  - 处理：迁移后全局搜索 `*.md` 引用并回写
- 风险：skill 直接引用旧路径导致失效
  - 处理：skill 在文档整理完成后再创建
