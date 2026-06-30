---
id: generated/integration/message-deliver-only-online
title: websdk2 Integration - 仅在线投递
description: 来自 SDK 集成文档 docs/integration/message_deliver_only_online.md，用于回答 仅在线投递 相关接入问题。
---

# 仅在线投递

仅在线投递的消息只发送给当前在线的用户，不存储离线消息。

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 发送仅在线投递消息

在 `sendMessage` 的选项中设置 `deliverOnlineOnly: true`：

```typescript
const message = client.chatManager.createTextMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  content: '这条消息只有在线才能收到',
});

await client.chatManager.sendMessage(message, {
  deliverOnlineOnly: true,
});
```

## 注意事项

- 仅支持单聊和群聊，**不支持聊天室**。
- 接收方离线时不会收到该消息，也不会存入离线消息队列。
- 默认不存入漫游消息（可在控制台配置开启漫游存储）。
