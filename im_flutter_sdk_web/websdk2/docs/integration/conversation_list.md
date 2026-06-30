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
// 获取缓存的公开会话列表
const conversations = client.chatManager.getConversationList();

// 强制从服务器刷新
const freshConversations = await client.chatManager.refreshSessionList();
```

## 监听会话列表同步

```typescript
client.addEventHandler('session', {
  onSyncDataStart: payload => {
    if (payload.dataType !== 'conversation') return;
    console.log('会话列表同步开始');
  },
  onSyncDataFinished: payload => {
    if (payload.dataType !== 'conversation') return;
    console.log('会话列表同步完成');
  },
  onConversationListUpdate: ({ items, source }) => {
    console.log('会话列表有更新', source, items);
  },
});
```

`onSyncDataFinished({ dataType: 'conversation' })` 只表示服务端会话列表同步生命周期结束；UI 应以 `onConversationListUpdate` 的完整 `ConversationItem[]` 快照作为列表数据源。

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
