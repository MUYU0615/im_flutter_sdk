# 会话置顶

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 置顶/取消置顶会话

```typescript
// 置顶
await client.chatManager.setConversationPinned({
  conversationId: 'user2',
  conversationType: 'singleChat',
  isPinned: true,
});

// 取消置顶
await client.chatManager.setConversationPinned({
  conversationId: 'user2',
  conversationType: 'singleChat',
  isPinned: false,
});
```

## 获取置顶会话列表

```typescript
const result = await client.chatManager.getPinnedConversationList({
  pageSize: 50,
  cursor: '',
});
```

## 注意事项

- 最多置顶 50 个会话。
- 其他设备会收到多设备事件通知（`onMultiDeviceConversation`）。
