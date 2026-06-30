# 获取历史消息

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 从服务器获取历史消息

```typescript
const result = await client.chatManager.getHistoryMessages({
  conversationId: 'user2',
  conversationType: 'singleChat',
  pageSize: 20,
  cursor: '', // 首次传空，后续传返回的 cursor
  searchDirection: 'down', // 'up' 向前翻页 | 'down' 向后翻页
});

console.log('消息列表:', result.messages);
console.log('下一页 cursor:', result.cursor);
console.log('是否还有更多:', result.hasMore);
```

## 按条件搜索历史消息

```typescript
const result = await client.chatManager.getHistoryMessages({
  conversationId: 'group1',
  conversationType: 'groupChat',
  pageSize: 20,
  cursor: '',
  searchOptions: {
    from: 'user1',           // 按发送者过滤
    msgTypes: ['text'],      // 按消息类型过滤
    startTime: 1700000000000, // 起始时间戳
    endTime: 1700100000000,   // 结束时间戳
  },
});
```

## 注意事项

- 每页最多 50 条消息。
- 聊天室历史消息需要在控制台开通商业功能。
