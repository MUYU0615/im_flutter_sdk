# 实施增补：以 WebSocket Session List 替换 REST 会话列表入口

**Feature**: `035-session-list-sync`  
**Date**: `2026-05-18`  
**Scope**: 停止对外暴露基于 REST 的普通会话列表拉取入口，统一切到 `refreshSessionList() + getSessionList()` 的 websocket session-list 语义。

## 背景

当前仓库里同时存在两套“会话列表”能力：

1. 旧链路：REST
   - `ChatManager.getConversationList()`
   - `requestGetConversationList()`
   - `getServerConversations() / getAllServerConversations()`
   - 返回 `ConversationSummary`，带 `cursor/pageSize`

2. 新链路：WebSocket protobuf session-list
   - `ChatManager.refreshSessionList()`
   - `ChatManager.getSessionList()`
   - 返回 `SessionItem`
   - 真相来自本地 session-list 缓存，不再暴露 REST 游标分页语义

用户当前要求不是“删除会话列表能力”，而是：

- 以后不要再有 REST 的会话列表拉取接口
- 普通会话列表统一使用 websocket session-list 作为唯一来源
- 调用方式统一到新语义：`refreshSessionList()` 主动同步，`getSessionList()` 读取缓存

## 目标

本轮实现以下目标：

1. 停止暴露 `ChatManager.getConversationList()` 普通会话列表公开 API
2. 停止保留 `requestGetConversationList()` 及其 API 封装作为普通会话列表入口
3. demo 中移除“普通 REST 会话列表查询”交互，统一引导到 `SessionItem` 面板
4. 测试、文档、spec 中不再把 `getConversationList()` 作为普通会话列表主入口
5. 保留以下能力不变：
   - `refreshSessionList()`
   - `getSessionList()`
   - `getPinnedConversationList()`
   - `getConversationListByMark()`
   - `PushManager.getConversationListByRemindType()`

## 关键决策

### 1. 不做“同名兼容适配”

本轮不保留 `getConversationList()` 名字再偷偷改走 websocket。

原因：

- 旧接口有 `cursor/pageSize/includeEmptyConversations` 语义
- 新 websocket session-list 是“全量/增量同步 + 本地缓存读取”语义
- 两者不是同一抽象，强行复用名字会制造误导

因此本轮选择：

- 调用方显式迁移到 `refreshSessionList()` / `getSessionList()`
- 不保留名不副实的兼容层

### 2. 旧 DTO 与新 DTO 不再并行承接“普通会话列表”

`ConversationSummary` 仍可保留给：

- 置顶会话 REST 查询
- 按 mark 查询
- 其他 mutation 结果或旧缓存内部结构

但“普通会话列表”的公开主语义只保留 `SessionItem`。

### 3. fallback 仍允许内部复用旧数据源

虽然公开 REST 会话列表入口会下线，但 `session-list sync` 内部 fallback 仍可保留：

- `buildFallbackSessionItemsFromConversations(...)`
- conversation cache 到 `SessionItem` 的映射

这是新链路失败时的内部降级策略，不等于继续对外提供旧 REST 会话列表 API。

## 影响范围

### A. SDK 公开面

需要修改：

- `src/managers/chat-manager.ts`
  - 移除 `getConversationList()`
- `src/types/conversation.ts`
  - 视实际引用情况移除 `GetConversationListParams`，或仅保留给 pinned/mark API 共用
- `src/types/chat-manager.ts` / `src/types/index.ts`
  - 移除对 `getConversationList` 的公开声明与导出说明

需要保留：

- `getSessionList()`
- `refreshSessionList()`
- `getPinnedConversationList()`
- `getConversationListByMark()`

### B. REST 层

需要修改：

- `src/rest/conversation-management.ts`
  - 移除 `requestGetConversationList()`
  - 若 `GetConversationListParams` 仍被 pinned API 复用，则只保留其参数归一化辅助逻辑

### C. API 封装层

需要修改：

- `src/apis/index.ts`
  - 移除 `getServerConversations()`
  - 移除 `getAllServerConversations()`

### D. Demo

需要修改：

- `demo/src/components/ConversationPanel.tsx`
  - 移除普通 `getConversationList` 按钮和对应日志
  - 保留 pinned / byMark / mutation 能力
- 如有必要，补文案提示：
  - 普通会话列表请到 `SessionItem` 面板查看

### E. 测试

需要删除或改造：

- `tests/unit/rest/conversation-management.test.ts`
  - 删除 `requestGetConversationList` 相关用例
- `tests/unit/apis/server-conversations.test.ts`
  - 整个文件大概率删除
- `tests/e2e/conversation-rest.spec.ts`
  - 删除或改造成 pinned/byMark 专项
- `tests/unit/managers/chat-manager.test.ts`
  - 删除 `getConversationList` 公开面断言

需要保留/补强：

- `tests/unit/managers/chat-manager-session-list.test.ts`
- `tests/unit/session-list-sync/*`
- `tests/integration/session-list-sync/*`

### F. 文档 / Spec

需要修改：

- `specs/035-session-list-sync/plan.md`
  - 把“保留 getConversationList 等旧 REST API 不变”改为“普通会话列表统一收口到 session-list”
- `specs/035-session-list-sync/spec.md`
  - 增补公开 API 收口澄清
- `tests/e2e/README.md`
- `docs/reference/websdk2-api-review-chat-manager.md`
- 其他仍把 `getConversationList()` 写成普通会话列表主入口的文档

需要注意：

- `specs/034-conversation-rest-api/*` 是历史特性文档，原则上不回写“伪造历史”
- 如需注明变更，应在新 spec / changelog 中解释“035 后续收口已覆盖 034 的普通会话列表主入口”

## 实现步骤

### 第一步：收口 SDK 公开入口

1. 从 `ChatManager` 删除 `getConversationList()`
2. 清理导出类型、声明和对外 API 文档
3. 保证 `getSessionList()` / `refreshSessionList()` 成为唯一普通会话列表入口

### 第二步：移除普通 REST 会话列表底层实现

1. 删除 `requestGetConversationList()`
2. 删除 `getServerConversations()` / `getAllServerConversations()`
3. 清理相关未使用的类型、helper、测试桩

### 第三步：迁移 demo

1. 从 `ConversationPanel` 去掉普通列表刷新按钮
2. 保留 pinned / byMark / mutation
3. 必要时把页面引导文案切到 `SessionListPanel`

### 第四步：测试与文档收尾

1. 删除/更新旧 REST 会话列表测试
2. 补充 session-list 主路径测试
3. 更新说明文档、版本号、`CHANGELOG.md`

## 验证方案

至少执行：

- `npm run type-check`
- `npm run test:run -- tests/unit/managers/chat-manager-session-list.test.ts tests/unit/session-list-sync/session-list-sync-controller.test.ts tests/unit/session-list-sync/session-list-sync-session.test.ts tests/integration/session-list-sync/session-list-msync-merge.integration.test.ts tests/integration/session-list-sync/session-list-fallback.integration.test.ts`
- 视改动范围补：
  - `tests/unit/managers/chat-manager.test.ts`
  - `tests/unit/rest/conversation-management.test.ts`
  - `tests/unit/apis/server-conversations.test.ts`

## 风险

1. 这是公开 API 变更
   - 现有依赖 `chatManager.getConversationList()` 的调用方会直接编译失败
   - 这是预期行为，但必须在 changelog 中明确标注

2. pinned / byMark 仍然走 REST
   - 需要避免误删公共 helper，导致 `getPinnedConversationList()` / `getConversationListByMark()` 受损

3. fallback 内部依赖 conversation cache
   - 不能把内部 fallback 所需的 conversation cache/summary 映射链路一起误删

## 待确认

请确认是否按以下范围执行：

1. 删除 `ChatManager.getConversationList()` 公开入口
2. 删除 `requestGetConversationList()` 与 `src/apis/index.ts` 的旧普通会话列表封装
3. demo 去掉普通 REST 会话列表按钮，统一改用 session-list 面板
4. 保留 pinned / byMark / push remindType 相关 REST API

确认后我再开始改代码。
