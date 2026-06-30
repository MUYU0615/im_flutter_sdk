# 发送消息

环信即时通讯 IM Web SDK 支持发送文本、图片、语音、视频、文件、位置、透传、自定义和合并消息。

- 对于单聊，默认支持陌生人之间发送消息，即无需添加好友即可聊天。
- 对于群组和聊天室，用户每次只能向所属的单个群组和聊天室发送消息。

## 前提条件

- 完成 SDK 初始化并登录，详见 [初始化](./initialization.md) 和 [登录](./login.md)。
- 已注册 `ChatManager`。

## 发送文本消息

```typescript
const message = client.chatManager.createTextMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  content: 'Hello!',
});

const sentMessage = await client.chatManager.sendMessage(message);
```

### 会话类型

| 值 | 说明 |
|----|------|
| `'singleChat'` | 单聊 |
| `'groupChat'` | 群聊 |
| `'chatRoom'` | 聊天室 |

## 发送图片消息

```typescript
const fileInput = document.getElementById('imageInput') as HTMLInputElement;
const file = fileInput.files![0];

const message = client.chatManager.createImageMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  file,
  // 可选：宽高信息
  width: 800,
  height: 600,
});

await client.chatManager.sendMessage(message);
```

SDK 会自动上传图片到服务器，上传成功后补齐 `url`、`secret` 等字段再发送。

## 发送语音消息

```typescript
const message = client.chatManager.createVoiceMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  file: audioFile,
  duration: 5, // 语音时长，单位秒
});

await client.chatManager.sendMessage(message);
```

## 发送视频消息

```typescript
const message = client.chatManager.createVideoMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  file: videoFile,
  duration: 30,
  // 可选：视频首帧缩略图
  thumbnailFile: thumbFile,
});

await client.chatManager.sendMessage(message);
```

## 发送文件消息

```typescript
const message = client.chatManager.createFileMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  file: selectedFile,
  fileName: 'document.pdf',
});

await client.chatManager.sendMessage(message);
```

## 发送位置消息

```typescript
const message = client.chatManager.createLocationMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  latitude: 39.9042,
  longitude: 116.4074,
  address: '北京市天安门广场',
});

await client.chatManager.sendMessage(message);
```

## 发送透传消息

透传消息不会在 UI 上展示，适用于通知类场景（如输入状态指示）。

```typescript
const message = client.chatManager.createCmdMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  action: 'TypingBegin',
});

await client.chatManager.sendMessage(message);
```

## 发送自定义消息

```typescript
const message = client.chatManager.createCustomMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  customEvent: 'gift',
  customExts: { giftId: '123', giftName: '玫瑰' },
});

await client.chatManager.sendMessage(message);
```

## 发送合并消息

将多条消息合并为一条转发。

```typescript
const message = client.chatManager.createCombineMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  title: '聊天记录',
  summary: 'user1: Hello\nuser2: Hi',
  messageList: [msg1, msg2, msg3], // 最多 300 条
  compatibleText: '[聊天记录]',
});

await client.chatManager.sendMessage(message);
```

## 发送消息选项

`sendMessage` 支持第二个可选参数：

```typescript
await client.chatManager.sendMessage(message, {
  // 仅在线投递，不存离线
  deliverOnlineOnly: true,
  // 定向消息接收者列表（最多 20 人）
  receiverList: ['user3', 'user4'],
  // 聊天室消息优先级
  priority: 'high', // 'high' | 'normal' | 'low'
});
```

## 消息扩展字段

所有消息类型都支持 `ext` 扩展字段，用于携带自定义业务数据：

```typescript
const message = client.chatManager.createTextMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  content: 'Hello!',
  ext: { key1: 'value1', key2: 123 },
});
```

## 事件通知

- **发送方**：`sendMessage` 返回的 Promise resolve 时表示服务器已收到消息。
- **接收方**：通过 `onMessage` 事件接收消息，详见 [接收消息](./message_receive.md)。
- **多设备**：发送方的其他设备也会通过 `onMessage` 收到自己发送的消息。
