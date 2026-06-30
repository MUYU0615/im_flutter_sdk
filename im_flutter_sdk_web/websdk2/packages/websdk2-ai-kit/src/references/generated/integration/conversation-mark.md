---
id: generated/integration/conversation-mark
title: websdk2 Integration - 会话标记
description: 来自 SDK 集成文档 docs/integration/conversation_mark.md，用于回答 会话标记 相关接入问题。
---

# 会话标记

会话标记允许用户为会话添加自定义标签（如"重要"、"待办"等）。

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 添加标记

```typescript
await client.chatManager.addConversationMark({
  conversations: [
    { conversationId: 'user2', conversationType: 'singleChat' },
    { conversationId: 'group1', conversationType: 'groupChat' },
  ],
  mark: 0, // 标记编号 0-19
});
```

## 移除标记

```typescript
await client.chatManager.removeConversationMark({
  conversations: [
    { conversationId: 'user2', conversationType: 'singleChat' },
  ],
  mark: 0,
});
```

## 按标记筛选会话

```typescript
const result = await client.chatManager.getConversationListByMark({
  mark: 0,
  pageSize: 20,
  cursor: '',
});
```

## 注意事项

- 标记编号范围为 0-19，每个会话最多 20 个标记。
- 标记的含义由应用层自行维护（如 0=重要，1=待办）。
- 其他设备会收到多设备事件通知。
