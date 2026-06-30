---
id: generated/integration/message-target
title: websdk2 Integration - 定向消息
description: 来自 SDK 集成文档 docs/integration/message_target.md，用于回答 定向消息 相关接入问题。
---

# 定向消息

定向消息允许在群聊或聊天室中将消息发送给指定的部分成员。

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 发送定向消息

在 `sendMessage` 的选项中设置 `receiverList`：

```typescript
const message = client.chatManager.createTextMessage({
  conversationId: 'group1',
  conversationType: 'groupChat',
  content: '这条消息只有指定的人能看到',
});

await client.chatManager.sendMessage(message, {
  receiverList: ['user1', 'user2', 'user3'], // 最多 20 人
});
```

## 注意事项

- 最多指定 20 个接收者。
- 定向消息不会写入服务端会话列表。
- 定向消息不计入未读数。
- 默认不存入漫游消息（可在控制台配置）。
