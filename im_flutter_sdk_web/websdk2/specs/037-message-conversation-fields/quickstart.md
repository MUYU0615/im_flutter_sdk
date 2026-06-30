# Quickstart: 消息模型替换 channel 为会话字段

## 1. 迁移消息创建代码

### 单聊

```ts
const message = client.chatManager.createTextMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  content: 'hello',
});

await client.chatManager.sendMessage(message);
```

### 群聊

```ts
const message = client.chatManager.createTextMessage({
  conversationId: 'group-1',
  conversationType: 'groupChat',
  content: 'hello group',
});
```

### 聊天室

```ts
const message = client.chatManager.createTextMessage({
  conversationId: 'room-1',
  conversationType: 'chatRoom',
  content: 'hello room',
  priority: 'high',
});
```

## 2. 迁移合并消息子项

```ts
const combine = client.chatManager.createCombineMessage({
  conversationId: 'group-1',
  conversationType: 'groupChat',
  title: '聊天记录',
  summary: '2 条消息',
  messageList: [
    {
      type: 'text',
      sender: { userId: 'user-1' },
      conversationId: 'group-1',
      conversationType: 'groupChat',
      timestamp: Date.now(),
      body: { content: 'hello' },
    },
  ],
});
```

## 3. 字段映射

| 旧字段 | 新字段 |
|--------|--------|
| `message.channel.channelId` | `message.conversationId` |
| `message.channel.type === 'single'` | `message.conversationType === 'singleChat'` |
| `message.channel.type === 'group'` | `message.conversationType === 'groupChat'` |
| `message.channel.type === 'room'` | `message.conversationType === 'chatRoom'` |

## 4. 不支持的旧写法

```ts
client.chatManager.createTextMessage({
  channel: { channelId: 'user-2', type: 'single' },
  content: 'hello',
});
```

该写法不再作为公开兼容输入，SDK 不会自动转换旧 `channel`。

## 5. 建议验证命令

```bash
npm run type-check
npm run test:run
npm run lint
npm run docs:api:check
npm run test:e2e
```

## 6. 实现检查清单

- `Message`、`Create*MessageParams`、`CombineMessageItem` 不再包含公开 `channel`。
- `ChannelReference` / `ChannelType` 不再从公开入口导出。
- MSync 上行和下行都从 `conversationId/conversationType` 映射。
- 附件上传 header 目标从新字段计算。
- 会话摘要缓存、消息事件、profile sync 从新字段读取会话归属。
- demo 和文档示例均使用 `conversationId/conversationType`。
