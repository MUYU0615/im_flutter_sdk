# 代码审查发现 — 2026-06-12

## 一、Spec 与代码不一致

### 1.1 [033] User Info Subscription — 命名偏差

| # | Spec 定义 | 实际实现 | 文件 |
|---|----------|---------|------|
| A | `subscribeUserInfoChanges` | `subscribeUsersInfo` | `src/managers/user-info-manager.ts:299` |
| B | `unsubscribeUserInfoChanges` | `unsubscribeUsersInfo` | `src/managers/user-info-manager.ts:325` |
| C | `getSubscribedUserInfoList` | `getSubscribedUsers` | `src/managers/user-info-manager.ts:366` |
| D | `onSubscribedUserInfoChanged`（专用订阅事件） | 复用 `onUserInfoUpdated` | `src/types/event-system.ts:153` |
| E | `onFriendInfoChanged` | `onContactInfoUpdated` | `src/types/event-system.ts:146` |

功能逻辑（REST 请求、缓存版本比较、部分字段合并）实现正确，仅命名与 spec 有偏差。

---

### 1.2 [034] Conversation REST API — 事件/枚举命名偏差

| # | Spec 定义 | 实际实现 | 文件 |
|---|----------|---------|------|
| F | `onConversationUpdate` | `onConversationListUpdate` | `src/types/event-system.ts:102` |
| G | `ConversationUpdateSource`（5 个值） | `ConversationListUpdateReason`（4 个值） | `src/cache/cache-types.ts:121` |
| H | `onMessagePinChange` | `onPinnedMessageChanged` | `src/types/event-system.ts:109` |

API 方法（`getConversationList`、`pinMessage`、`setConversationPinned`、`addConversationMark` 等）实现完整。

---

### 1.3 [044] Tree-Shaking Optimization — 核心未达标

`chat-client.ts` 静态 import 了以下模块，导致即使用户不注册对应 Manager，产物仍包含所有同步代码：

| # | 不应静态引入的模块 | 位置 |
|---|-------------------|------|
| I | `GroupSyncController` | `src/chat-client.ts:17` |
| J | `RosterSyncController` | `src/chat-client.ts:16` |
| K | `SessionListSyncController` | `src/chat-client.ts:18` |
| L | `GroupNamecardHydrationQueue` | `src/chat-client.ts:35-47` |
| M | `UserInfoHydrationQueue` | `src/chat-client.ts:35-47` |
| N | `resolveSingleContactUserInfo` | `src/chat-client.ts:34` |

`scripts/check-tree-shaking.mjs` forbidden 列表也未覆盖上述同步控制器。

---

### 1.4 [045] Group Auto-Sync — 轻微

| # | 问题 | 文件 |
|---|------|------|
| O | 缺少 `enableSyncData: ['group']` 时对 `GroupManager` 注册的依赖校验 | `src/chat-client.ts:1985-1988` |

---

## 二、代码/逻辑问题

### 严重

| # | 问题 | 文件 |
|---|------|------|
| P | 连接超时后可能泄露 WebSocket：timeout 先 reject，但 socket 随后连接成功不会被清理，变成孤儿连接 | `src/core/connection/connection-manager.ts:757-795` |
| Q | StreamMessageCache 无 TTL/上限：流式消息若不 complete，sessions Map 无限增长 | `src/core/message/stream-message-cache.ts` |

### 中等

| # | 问题 | 文件 |
|---|------|------|
| R | `MessageSender.destroy()` 不清理 timeout 定时器，reject 了 pending message 但没 clearTimeout | `src/core/message/message-sender.ts:275-290` |
| S | `isConversationListItemEqual` 用 `JSON.stringify` 做深比较，大列表性能差 | `src/chat-client.ts:2298` |
| T | `ConnectionManager.createWebSocketConnection` 的 catch 重复执行错误处理（内/外层各处理一次） | `src/core/connection/connection-manager.ts:795-810` |
| U | REST client 标记 `retryable: true` 但无自动重试逻辑 | `src/rest/client.ts` |

### 轻微

| # | 问题 | 文件 |
|---|------|------|
| V | ChatClient 单例无法重置，SPA 切换账号可能残留状态 | `src/chat-client.ts:392` |
| W | MessageReceiver 多端通知用 `as unknown as ...` 绕过类型检查 | `src/core/message/message-receiver.ts` |
| X | `src/features/` 和 `src/core/storage/` 空目录残留 | — |

---

## 三、架构改进建议

| # | 优先级 | 建议 |
|---|--------|------|
| Y | 高 | `chat-client.ts`（101KB）拆分为瘦门面 + 协调器（SyncOrchestrator、ProfileHydrationCoordinator、TokenLifecycleManager） |
| Z | 高 | `codec.ts`（77KB）从 protocol 层反向 import managers 的 event-mapper，违反分层；应将 mapper 下沉或注入 |
| AA | 高 | `protobufjs/light` 和 `long` 未加入 MODULE_EXTERNAL，SDK 产物膨胀 ~150KB |
| BB | 中 | `cache-manager.ts`（70KB）继续拆分为领域缓存协调器 |
| CC | 中 | Managers 对 ChatClient 的 `import type` 改为依赖 `ChatClientInterface`，防意外循环依赖 |
| DD | 低 | Module build 开启 sourcemap |
| EE | 低 | devDependencies 版本范围收窄/锁定 |

---

## 四、决策记录

> 逐条填写处理方式：`修复` / `不改（原因）` / `延后到 xxx spec` / `更新 spec 对齐代码`

| # | 决策 | 备注 |
|---|------|------|
| A | 更新 spec 对齐代码 | 已完成 |
| B | 更新 spec 对齐代码 | 已完成 |
| C | 更新 spec 对齐代码 | 已完成 |
| D | 更新 spec 对齐代码 | 已完成 |
| E | 更新 spec 对齐代码 | 已完成 |
| F | 更新 spec 对齐代码 | 已完成 |
| G | 更新 spec 对齐代码 | 已完成 |
| H | 更新 spec 对齐代码 | 已完成 |
| I | 修复 | Manager 暴露 createSyncController，ChatClient 从 manager 获取 |
| J | 修复 | 同上 |
| K | 保留 | SessionListSyncController 是公开 API 依赖，保留静态 import |
| L | 延后（随 Y 一起做） | 受 enableUserInfoSync 门控，影响有限 |
| M | 延后（随 Y 一起做） | 同上 |
| N | 延后（随 Y 一起做） | 同上 |
| O | 修复 | 已完成，validateOptionalCapabilityDependencies 增加 group 校验 |
| P | 修复 | cancelled 标志 + reconnectPaused 检查，超时/登出时关闭孤儿 socket |
| Q | 修复 | 增加 TTL（5min）和上限（100 session），自动淘汰 |
| R | 修复 | destroy() 增加 clearTimeout |
| S | 修复 | 改为逐字段浅比较，lastMessage 只比 msgServerId |
| T | 不改（P 修复后重新分析无双重处理） | outer catch 仅兜底非 ConnectionError，无实际重复 |
| U | 不改（设计合理） | retryable 是给调用方的决策信号，SDK 不应自动重试 REST |
| V | 不改（无问题） | logout 后可直接 login 另一个账号，状态已清理 |
| W | 修复 | 按事件名逐分支 dispatch，消除 as unknown as |
| X | 修复 | 删除 src/features/ 和 src/core/storage/ |
| Y | 延后 | 纯内部可维护性，用户 bundle 无变化，等大改动时顺手拆 |
| Z | 延后 | 需要单独 spec，codec 重构影响面大 |
| AA | 不改 | externalize 不减总体积，还会破坏 IIFE/script 标签使用方式 |
| BB | 延后 | 纯内部结构，等大改动时顺手拆 |
| CC | 延后 | 当前 import type 已防护，实际循环风险低 |
| DD | 延后 | 低优先级，用户可用 devtool 调试 |
| EE | 延后 | lockfile 已保证复现性，低优先级 |
