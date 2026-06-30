---
id: generated/integration/message-recall
title: websdk2 Integration - 撤回消息
description: 来自 SDK 集成文档 docs/integration/message_recall.md，用于回答 撤回消息 相关接入问题。
---

# 撤回消息

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 撤回消息

发送方可在限定时间内（默认 2 分钟，可在控制台配置最长 7 天）撤回已发送的消息。群主/管理员可撤回群内其他成员的消息。

```typescript
const result = await client.chatManager.recallMessage({
  messageId: 'msg-id-123',
  conversationId: 'user2',
  conversationType: 'singleChat',
  // 可选：撤回时附带的扩展信息（如"撤回了一条消息并编辑"）
  ext: { reason: '发错了' },
});
```

## 监听撤回事件

消息接收方通过 `onMessageRecalled` 事件得知消息被撤回：

```typescript
client.addEventHandler('recall', {
  onMessageRecalled: (event) => {
    console.log('消息被撤回:', event.messageId);
    console.log('撤回者:', event.from);
    console.log('扩展信息:', event.ext);
    // 在 UI 上将该消息替换为"xxx 撤回了一条消息"
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onMessageRecalled` | 消息被撤回 | 会话中的所有成员（含撤回者的其他设备） |

## 注意事项

- 除透传消息（CMD）外，所有消息类型均支持撤回。
- 撤回后，消息附件也会从服务器删除。
- 群主/管理员撤回他人消息时，被撤回方也会收到 `onMessageRecalled` 事件。
