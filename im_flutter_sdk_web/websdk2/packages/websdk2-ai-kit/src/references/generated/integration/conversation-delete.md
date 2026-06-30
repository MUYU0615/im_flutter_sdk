---
id: generated/integration/conversation-delete
title: websdk2 Integration - 删除会话
description: 来自 SDK 集成文档 docs/integration/conversation_delete.md，用于回答 删除会话 相关接入问题。
---

# 删除会话

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 删除服务端会话

```typescript
await client.chatManager.deleteConversation({
  conversationId: 'user2',
  conversationType: 'singleChat',
  // 是否同时删除漫游消息
  deleteRoamingMessages: true,
});
```

## 清空所有消息和会话

```typescript
await client.chatManager.clearAllMessagesAndConversations();
```

## 注意事项

- 删除操作是单向的，仅影响当前用户，不影响对方。
- 其他设备会收到多设备事件通知。
