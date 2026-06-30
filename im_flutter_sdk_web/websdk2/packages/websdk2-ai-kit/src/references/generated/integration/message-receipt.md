---
id: generated/integration/message-receipt
title: websdk2 Integration - 消息回执
description: 来自 SDK 集成文档 docs/integration/message_receipt.md，用于回答 消息回执 相关接入问题。
---

# 消息回执

消息回执包括送达回执、单聊已读回执和群聊已读回执。

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 送达回执

送达回执表示消息已成功到达接收方设备。

### 开启送达回执

在初始化时设置 `enableDeliveryReceipt: true`：

```typescript
const client = ChatClient.init({
  appKey: 'org#app',
  enableDeliveryReceipt: true,
  managers: [ChatManager],
});
```

开启后，收到单聊消息时 SDK 自动向发送方回送达回执，无需手动调用。

### 监听送达回执

发送方通过 `onMessageDelivered` 事件得知消息已送达对方设备：

```typescript
client.chatManager.addEventHandler('delivery', {
  onMessageDelivered: (event) => {
    console.log('消息已送达:', event.messageId);
    console.log('送达方:', event.from);
    console.log('会话:', event.conversationId);
  },
});
```

### 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onMessageDelivered` | 接收方 SDK 自动回送达回执后 | 消息的原始发送方 |

### 注意事项

- 仅支持单聊，群聊和聊天室不触发送达回执。
- 需要接收方也开启了 `enableDeliveryReceipt: true` 才会回送达回执。
- 送达回执由 SDK 自动发送，开发者无需手动操作。

---

## 单聊已读回执

### 发送已读回执

收到消息后，调用 `sendMessageReadAck` 告知对方消息已读：

```typescript
client.addEventHandler('readAck', {
  onMessage: (message) => {
    // 收到单聊消息后发送已读回执
    if (message.conversationType === 'singleChat') {
      client.chatManager.sendMessageReadAck({
        messageId: message.id,
        conversationId: message.from,
      });
    }
  },
});
```

### 监听已读回执

发送方通过 `onMessageRead` 事件得知消息已被对方阅读：

```typescript
client.addEventHandler('read', {
  onMessageRead: (event) => {
    console.log('消息已读:', event.messageId);
    console.log('已读者:', event.from);
  },
});
```

## 群聊已读回执

群聊已读回执需要在控制台开通。

### 发送群消息已读回执

```typescript
await client.chatManager.sendGroupMessageReadAck({
  messageId: 'msg-id-123',
  groupId: 'group-id',
  // 可选：回执附带内容
  content: '已阅',
});
```

### 查询群消息已读用户列表

```typescript
const result = await client.chatManager.getGroupMessageReadUsers({
  messageId: 'msg-id-123',
  groupId: 'group-id',
  pageSize: 20,
  cursor: '',
});
console.log('已读用户:', result.users);
console.log('已读数:', result.readCount);
console.log('未读数:', result.unreadCount);
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onMessageRead` | 单聊消息被对方已读 | 消息发送方 |
| `onMessageRead` | 群消息被成员已读（在线时） | 消息发送方 |

## 注意事项

- 群聊已读回执有效期为 3 天。
- 群聊已读回执最多支持 200 人的群。
