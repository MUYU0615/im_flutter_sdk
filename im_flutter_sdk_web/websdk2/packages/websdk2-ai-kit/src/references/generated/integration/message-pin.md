---
id: generated/integration/message-pin
title: websdk2 Integration - 消息置顶
description: 来自 SDK 集成文档 docs/integration/message_pin.md，用于回答 消息置顶 相关接入问题。
---

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
  pageSize: 20,
  cursor: '',
});

console.log('置顶消息:', result.messages);
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
- 每个会话默认最多 20 条置顶消息（最大可配置 100 条）。
