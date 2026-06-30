# 消息置顶（Pin）

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。
- 需要在控制台开通商业功能。

## 置顶消息

```typescript
await client.chatManager.pinMessage({
  conversationId: 'group1',
  conversationType: 'groupChat',
  messageId: 'msg-id-123',
});
```

## 取消置顶

```typescript
await client.chatManager.unpinMessage({
  conversationId: 'group1',
  conversationType: 'groupChat',
  messageId: 'msg-id-123',
});
```

## 获取置顶消息列表

```typescript
const result = await client.chatManager.getPinnedMessageList({
  conversationId: 'group1',
  conversationType: 'groupChat',
});

for (const item of result.items) {
  console.log('置顶消息 ID:', item.messageId);
  console.log('置顶时间:', item.pinnedAt);
  console.log('置顶消息:', item.message);
}
```

## 监听置顶事件

```typescript
client.addEventHandler('pin', {
  onPinnedMessageChanged: (event) => {
    console.log('操作:', event.operation); // 'pin' | 'unpin'
    console.log('消息 ID:', event.messageId);
    console.log('操作者:', event.operatorId);
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onPinnedMessageChanged` | 消息被置顶或取消置顶 | 会话中的所有成员 |

## 注意事项

- 单聊、群聊、聊天室均支持。
- `getPinnedMessageList` 不分页，最多返回 20 条置顶消息。
- 当服务端返回消息内容时，`result.items[].message` 会包含标准 `Message` 对象，可直接用于展示消息发送者、类型和内容。
