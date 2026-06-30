---
description: "会话相关 REST API 收敛任务清单"
---

# 任务清单：会话相关 REST API 收敛

**Input**: 设计文档 `/specs/034-conversation-rest-api/`  
**Prerequisites**: spec.md（必需）, plan.md（必需）  
**Tests**: 遵循分层测试要求，至少覆盖会话 REST 单元测试与 ChatManager 集成路径

## 阶段 1：会话类型入参命名收敛（2026-05-18）

- [x] T001 [US1] 将 `src/types/conversation.ts` 中 ChatManager 会话定位入参字段从 `type` 改为 `conversationType`
- [x] T002 [US1] 更新 `src/rest/conversation-management.ts`，所有会话 mutation 与 message pin 入参从 `params.conversationType` 读取并继续映射服务端 `type`
- [x] T003 [P] [US1] 更新 `tests/unit/rest/conversation-management.test.ts`，覆盖 `conversationType` 请求映射与旧 `type` 入参不再兜底
- [x] T004 [P] [US1] 更新 ChatManager 相关 integration/unit/demo 调用，统一使用 `conversationType`
- [x] T005 [P] [US1] 更新 `spec.md`、`plan.md`、`data-model.md`、`quickstart.md` 与 OpenAPI contract，明确 ChatManager 会话类公开入参不再使用 `type`
- [x] T006 [P] [US1] 更新 ChatManager API review 文档中的参数展开与差异说明，避免继续展示 `type`

## 阶段 2：会话 mark 类型收窄（2026-05-18）

- [x] T007 [US1] 将 `ConversationMark` 从宽泛 `number` 收窄为 `0 | ... | 19`，并导出 `CONVERSATION_MARK` 常量
- [x] T008 [P] [US1] 更新 REST/cache/demo 中的 mark normalize 与调用类型，保持服务端 `mark_x` 映射不变
- [x] T009 [P] [US1] 更新类型测试、REST 单测、spec/plan/data-model/OpenAPI 与 API review 文档，明确 mark 不再接受任意 `number`

## 阶段 3：会话 mark 批量目标（2026-05-18）

- [x] T010 [US1] 将 `addConversationMark`、`removeConversationMark` 入参扩展为 `conversations` 批量目标数组，并保留单会话旧写法运行时兼容
- [x] T011 [P] [US1] 更新 REST 映射与返回模型，按服务端 `ignore` 列表输出每个目标的 `applied` 状态
- [x] T012 [P] [US1] 更新 demo、单元/类型测试、spec/plan/data-model/OpenAPI 与 API review 文档

## 阶段 4：置顶消息列表去分页参数（2026-05-18）

- [x] T013 [US1] 移除 `getPinnedMessageList` 入参中的 `messageId`、`pageSize` 与 `cursor`
- [x] T014 [P] [US1] 更新 REST 映射为固定 `limit=20`，返回值不再暴露 cursor
- [x] T015 [P] [US1] 更新注释、demo、单元/集成测试、spec/data-model/OpenAPI 与 API review 文档，明确最多返回 20 条
