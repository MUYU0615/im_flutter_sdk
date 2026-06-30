# 会话已读回执

会话已读回执用于标记整个会话为已读，区别于单条消息的已读回执。

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 标记会话已读

```typescript
await client.chatManager.markConversationRead({
  conversationId: 'user2',
  conversationType: 'singleChat',
});
```

## 监听会话已读事件

发送方通过 `onConversationRead` 事件得知对方已读整个会话：

```typescript
client.addEventHandler('convRead', {
  onConversationRead: (event) => {
    console.log('会话已读:', event.conversationId);
    console.log('已读者:', event.from);
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onConversationRead` | 对方标记会话已读 | 单聊对方 |

## 注意事项

- 对于群聊，标记会话已读仅清除服务端未读数，不会触发 `onConversationRead` 事件。
