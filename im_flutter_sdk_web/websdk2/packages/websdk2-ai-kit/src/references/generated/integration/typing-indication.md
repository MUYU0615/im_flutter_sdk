---
id: generated/integration/typing-indication
title: websdk2 Integration - 输入指示器
description: 来自 SDK 集成文档 docs/integration/typing_indication.md，用于回答 输入指示器 相关接入问题。
---

# 输入指示器

输入指示器用于在单聊中向对方展示"对方正在输入..."的状态。SDK 没有专用 API，通过透传消息（CMD）实现。

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 发送输入状态

当用户开始输入时，发送一条透传消息通知对方：

```typescript
// 发送"正在输入"指示
function sendTypingIndicator(to: string): void {
  const message = client.chatManager.createCmdMessage({
    conversationId: to,
    conversationType: 'singleChat',
    action: 'TypingBegin',
  });
  client.chatManager.sendMessage(message);
}
```

建议节流：每 5 秒最多发送一次输入指示，避免频繁发送。

## 接收输入状态

```typescript
client.addEventHandler('typing', {
  onMessage: (message) => {
    if (message.type === 'cmd' && message.body.action === 'TypingBegin') {
      console.log(message.from, '正在输入...');
      // 设置 5 秒超时后自动隐藏"正在输入"提示
      setTimeout(() => {
        console.log('输入指示超时，隐藏提示');
      }, 5000);
    }
  },
});
```

## 注意事项

- 这不是专用 API，而是基于透传消息的约定实现。
- 建议发送方节流间隔为 5 秒。
- 接收方应设置超时（如 5 秒），超时后自动隐藏"正在输入"提示。
- 透传消息不会存入历史消息，不计入未读数。
