# 034 会话 REST Spec 修订计划

## 背景

当前 [specs/034-conversation-rest-api/spec.md](/Users/wangmeng/IdeaProjects/easemob-font/WEBSDK2/specs/034-conversation-rest-api/spec.md) 已形成较完整的功能范围，但存在几类会直接影响后续 `/speckit.plan` 与实现落地的问题：

1. 与 [031-chat-manager-replace-channel](/Users/wangmeng/IdeaProjects/easemob-font/WEBSDK2/specs/031-chat-manager-replace-channel/spec.md) 的 `ChatManager` 范围界定发生冲突。
2. 把公开 DTO、缓存真相模型、内部兼容模型混写在一起，缺少清晰分层。
3. 缺少真实 REST contract / 样例响应支撑，不满足 Constitution 对 REST 映射的约束。
4. 事件新增方向明确，但 typed event surface、归属边界与现有事件系统衔接还不完整。

本计划仅用于修订 `034` 的 spec，使其达到“可继续出 plan”的质量，不在本阶段进入代码实现。

## 目标

1. 把 `034` 修订为可落地、可规划、可验证的 spec。
2. 消除与 `031` 的阶段边界冲突，明确 `034` 是 conversation capability 的后续阶段。
3. 明确公开模型、内部兼容模型、缓存模型之间的职责边界，避免后续 plan 阶段返工。
4. 为后续补 `contracts/`、`plan.md`、`tasks.md` 提供稳定入口。

## 非目标

1. 本次不实现任何 SDK 代码。
2. 本次不补完整 `plan.md`、`tasks.md`。
3. 本次不直接确认所有 REST 字段细节；若缺真实样例，仅在 spec 中补“前置依赖与约束”。
4. 本次不引入新的兼容层承诺。

## 修订范围

本次确认后将修改以下内容：

- [specs/034-conversation-rest-api/spec.md](/Users/wangmeng/IdeaProjects/easemob-font/WEBSDK2/specs/034-conversation-rest-api/spec.md)

必要时补充以下产物骨架：

- `specs/034-conversation-rest-api/contracts/README.md`
- `specs/034-conversation-rest-api/checklists/requirements.md`

说明：

- 若你只希望先修 `spec.md`，我会先不新增 `contracts/` 与 checklist。
- 若按 Speckit 完整流程收敛，我建议这次一并补最小 `contracts/README.md` 和 checklist。

## 计划修订项

### 一、重写阶段边界

把 `034` 明确表述为：

- 承接 `031` Phase 1 之后的 conversation capability 补齐阶段
- 不推翻 `031` 对 `ChatManager` Phase 1 的既有结论
- `031` 与 `034` 的关系为“先消息域迁移，再会话域补齐”

预期落地：

- 在 `Clarifications` 或 `Assumptions & Dependencies` 中补明确声明
- 在 `设计决策` 和 `Requirements` 中避免与 `031` 正面冲突的措辞

### 二、补 DTO / 缓存 / 内部兼容分层

把当前 spec 中混合表达拆成三层：

1. 公开输入输出模型
2. SDK 内部兼容映射模型
3. 缓存真相 / 落盘模型

预期落地：

- 明确 `singleChat/groupChat/chatRoom` 是公开 canonical naming
- 明确缓存层是否继续保留 `single/group/room`，以及何时做 schema 升级
- 明确 `ConversationSummary` 是公开 DTO、缓存 DTO，还是两者需要拆分

### 三、补缓存升级与兼容约束

当前 spec 已要求新增 `marks`、扩展 `source` 枚举、改变对外 `type` 语义，但没有定义缓存迁移策略。

预期落地：

- 在 Edge Cases / Assumptions 中补：
  - 旧缓存读取策略
  - schema version 是否需要升级
  - 旧缓存字段缺失时的降级规则
- 避免在 spec 里直接承诺“立刻切换缓存真相格式”但不说明迁移路径

### 四、收紧 manager 职责描述

把当前“`ChatManager` 直接 patch cache + dispatch event”的表述，改成更符合 Constitution 的 facade 语义：

- `ChatManager` 负责公开入口、参数校验、方法编排
- `ChatClient` / 内部 domain service / repository 负责缓存补丁与事件派发

预期落地：

- 修正文中的“谁负责 patch cache / dispatch event / normalize notify”
- 避免后续 plan 阶段把 manager 做成过胖实现

### 五、补 typed event 落地边界

对 `onMessagePinChange` 和 `onChatThreadChange` 增加更明确约束：

- 事件名进入 `EventPayloadMap`
- `ChatThreadManager` 是否拥有专属 handler map
- 内部 raw notify 与公开 typed payload 的映射边界

预期落地：

- 在事件模型中补“公开事件面”和“内部归一化层”的关系
- 在 FR 中补足类型系统层面的可验证要求

### 六、降低未经验证的契约断言

当前 spec 对 conversation/thread REST 字段映射写得很具体，但缺少真实样例。

预期落地：

- 保留能力目标
- 对未拿到真实响应样例的字段，改为“需以旧工程真实请求/响应样例校验后固化”
- 补充 `contracts` 前置约束，满足 Constitution 要求

### 七、把成功标准改成可验收表述

把“遗漏项为 0”“占比降为 0”“刷新缺失率为 0”这类偏口号化表述改成可通过测试或 checklist 验证的条目。

预期落地：

- 与单元 / 集成 / E2E 验收断言直接对应

## 建议改写顺序

1. 先改 `Clarifications`、`Assumptions & Dependencies`、`设计决策`
2. 再改 `User Scenarios & Testing` 与 `Test Layer Requirements`
3. 再改 `Functional Requirements`
4. 最后补 `contracts/README.md` 与 checklist（如果本次一并做）

## 风险

1. 如果现在没有旧工程 conversation/thread REST 的真实请求与响应样例，spec 只能先把“能力边界”写稳，不能把所有字段契约写死。
2. 如果你希望 `034` 直接决定缓存 schema 升级方案，spec 会变重，后续最好同步出 `plan.md`，否则仍会在实现前二次讨论。
3. 如果你希望 thread 事件同时沿用全局 handler map 和 manager 局部 handler map，需要在 spec 中二选一，否则类型边界会继续含糊。

## 确认后执行内容

你确认后，我将：

1. 直接修订 `specs/034-conversation-rest-api/spec.md`
2. 保留现有 feature 编号与目录，不新开分支、不新建新 feature
3. 默认一并补最小 `contracts/README.md` 与 `checklists/requirements.md`，除非你只想先修 spec 正文

## 待你确认的默认方案

若你不额外指定，我按以下默认方案执行：

1. `034` 明确为承接 `031` 的后续阶段
2. 先修 `spec.md`，并补最小 `contracts/README.md` 与 checklist
3. 对缺真实样例的 REST 字段，不在 spec 中硬写死具体响应字段，而是增加“待样例校验后固化”的约束
4. 不在本轮进入 `plan.md` / `tasks.md`
