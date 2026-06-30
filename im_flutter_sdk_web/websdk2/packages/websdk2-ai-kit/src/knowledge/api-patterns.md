---
id: api-patterns
name: websdk2-api-patterns
title: websdk2 API Patterns
description: Use when explaining recommended im-sdk-web API call order, manager entrypoints, and message flow patterns.
cursorGlobs: **/*.{ts,tsx,js,jsx}
referenceIds:
  - generated/integration-index
  - generated/api-reference-index
  - manager-capabilities
  - upgrade-and-compatibility
---
# websdk2 API Patterns

Use when explaining recommended `im-sdk-web` API call order, manager entrypoints, and message flow patterns.

## 推荐调用顺序

```typescript
const client = ChatClient.init({ appKey });
const chatManager = client.use(ChatManager);

client.addEventHandler('main', {
  onConnected: () => {},
  onMessage: messages => {},
});

await client.login({ userId, token });

const message = client.createTextMessage({
  targetId,
  channelType: 'singleChat',
  content: 'hello',
});

await client.send(message);
await chatManager.markConversationRead({ targetId, channelType: 'singleChat' });
```

## 常用模式

### 1. 生命周期

- 一个业务实例通常只初始化一个 `ChatClient`
- `use(Manager)` 放在初始化后、业务调用前
- 事件处理器应成对出现：`addEventHandler` / `removeEventHandler`
- 登录成功后再发送消息、拉会话、读写资料

### 2. 事件监听

```typescript
client.addEventHandler('page-chat', {
  onConnected: () => setConnected(true),
  onDisconnected: () => setConnected(false),
  onMessage: messages => appendMessages(messages),
});

return () => client.removeEventHandler('page-chat');
```

### 3. 发消息与会话操作

- `client.create*Message()` 负责创建消息体
- `client.send(message)` 负责真正发送
- 会话已读、会话置顶、会话列表等走对应 manager
- 群聊/聊天室消息创建时重点校验 `channelType` 与目标 ID 是否一致

## 标识映射速查

| 场景 | channelType | targetId 应传什么 |
|------|-------------|-------------------|
| 单聊 | `singleChat` | 对方 `userId` |
| 群聊 | `groupChat` | `groupId` |
| 聊天室 | `chatRoom` | `chatRoomId` |

## Manager 使用原则

- 聊天消息、会话操作优先看 `ChatManager`
- 联系人、黑名单、备注看 `ContactManager`
- 群组资料、成员、公告看 `GroupManager`
- 聊天室成员与属性看 `ChatroomManager`
- 在线状态看 `PresenceManager`
- 推送免打扰、展示名等推送配置看 `PushManager`
- 用户资料订阅与查询看 `UserInfoManager`
- 线程消息看 `ChatThreadManager`

## 回答要求

- 优先给“推荐调用顺序”而不是只列 API 名
- 说明状态前置条件，例如“需先登录成功”
- 发现用户把 `client` 能力和 manager 能力混用时，直接指出更合适入口
- 需要精确签名时先查 `websdk2 API Reference Index`，需要完整业务步骤时先查 `websdk2 Integration Documentation Index`
