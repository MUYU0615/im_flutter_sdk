# 删除消息

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 按消息 ID 删除

```typescript
await client.chatManager.removeHistoryMessages({
  conversationId: 'user2',
  conversationType: 'singleChat',
  messageIds: ['msg-1', 'msg-2', 'msg-3'], // 最多 50 条
});
```

## 按时间删除

删除指定时间戳之前的所有消息：

```typescript
await client.chatManager.removeHistoryMessages({
  conversationId: 'user2',
  conversationType: 'singleChat',
  beforeTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 天前
});
```

## 清空所有消息和会话

```typescript
await client.chatManager.clearAllMessagesAndConversations();
```

## 注意事项

- 删除操作是单向的，仅影响当前用户，不影响其他用户。
- 其他设备会收到 `onMultiDeviceMessageRemoved` 多设备事件。
