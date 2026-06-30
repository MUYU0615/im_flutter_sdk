---
id: generated/integration/message-receive
title: websdk2 Integration - 接收消息
description: 来自 SDK 集成文档 docs/integration/message_receive.md，用于回答 接收消息 相关接入问题。
---

# 接收消息

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 监听消息

通过 `addEventHandler` 注册消息监听。所有类型的消息统一通过 `onMessage` 回调接收：

```typescript
client.addEventHandler('message', {
  onMessage: (message) => {
    switch (message.type) {
      case 'text':
        console.log('文本消息:', message.body.content);
        break;
      case 'image':
        console.log('图片消息:', message.body.url);
        break;
      case 'voice':
        console.log('语音消息:', message.body.url, '时长:', message.body.duration);
        break;
      case 'video':
        console.log('视频消息:', message.body.url);
        break;
      case 'file':
        console.log('文件消息:', message.body.url, '文件名:', message.body.fileName);
        break;
      case 'location':
        console.log('位置消息:', message.body.address);
        break;
      case 'cmd':
        console.log('透传消息:', message.body.action);
        break;
      case 'custom':
        console.log('自定义消息:', message.body.customEvent);
        break;
      case 'combine':
        console.log('合并消息:', message.body.title);
        break;
    }
  },
});
```

## 消息通用字段

每条收到的消息都包含以下通用字段：

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 消息唯一 ID |
| `conversationId` | string | 会话 ID |
| `conversationType` | string | 会话类型：`singleChat` / `groupChat` / `chatRoom` |
| `from` | string | 发送者用户 ID |
| `timestamp` | number | 服务器时间戳 |
| `type` | string | 消息类型 |
| `body` | object | 消息体（不同类型结构不同） |
| `ext` | object | 扩展字段 |

## 解析合并消息

收到合并消息后，需要下载并解析其中的子消息列表：

```typescript
client.addEventHandler('combine', {
  onMessage: async (message) => {
    if (message.type === 'combine') {
      const subMessages = await client.chatManager.downloadAndParseCombineMessage({
        url: message.body.url,
        secret: message.body.secret,
      });
      console.log('合并消息包含:', subMessages.length, '条子消息');
    }
  },
});
```

## 流式消息

流式消息（如 AI 生成内容）通过 `onStreamMessage` 事件接收：

```typescript
client.addEventHandler('stream', {
  onStreamMessage: (streamEvent) => {
    // streamEvent 包含流式消息的增量内容
    console.log('流式消息更新:', streamEvent);
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onMessage` | 收到新消息 | 消息接收方（含发送方的其他设备） |
| `onStreamMessage` | 流式消息更新 | 消息接收方 |
| `onConversationUpdate` | 会话列表变更 | 当前用户所有设备 |
