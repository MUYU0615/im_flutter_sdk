---
id: generated/integration/conversation-list
title: websdk2 Integration - 会话列表
description: 来自 SDK 集成文档 docs/integration/conversation_list.md，用于回答 会话列表 相关接入问题。
---

# 会话列表

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 获取服务端会话列表

```typescript
const result = await client.chatManager.getConversationList({
  pageSize: 20,
  cursor: '',
});

result.conversations.forEach((conv) => {
  console.log('会话 ID:', conv.conversationId);
  console.log('会话类型:', conv.conversationType);
  console.log('是否置顶:', conv.isPinned);
  console.log('未读数:', conv.unreadCount);
  console.log('最后一条消息:', conv.lastMessage);
  console.log('标记:', conv.marks);
});
```

## 获取会话列表（WSS 同步）

SDK 支持通过 WebSocket 实时同步会话列表：

```typescript
// 获取缓存的会话列表
const sessions = client.chatManager.getSessionList();

// 强制从服务器刷新
const freshSessions = await client.chatManager.refreshSessionList();
```

## 监听会话列表同步

```typescript
client.addEventHandler('session', {
  onConversationListSyncDidStart: () => {
    console.log('会话列表同步开始');
  },
  onConversationListSyncDidFinish: () => {
    console.log('会话列表同步完成');
  },
  onConversationUpdate: () => {
    console.log('会话列表有更新');
  },
});
```

## 获取置顶会话列表

```typescript
const result = await client.chatManager.getPinnedConversationList({
  pageSize: 50,
  cursor: '',
});
```

## 按标记筛选会话

```typescript
const result = await client.chatManager.getConversationListByMark({
  mark: 0, // 标记编号 0-19
  pageSize: 20,
  cursor: '',
});
```

## 注意事项

- 服务端最多存储 100 个会话。
- 收到新消息后会话列表异步更新，不要在收到消息后立即查询。
