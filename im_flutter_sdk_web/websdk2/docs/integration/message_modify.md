# 编辑消息

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。
- 需要在控制台开通商业功能。

## 编辑已发送的消息

```typescript
const modifiedMessage = await client.chatManager.modifyMessage({
  messageId: 'msg-id-123',
  modifiedMessage: {
    type: 'text',
    content: '修改后的内容',
    ext: { edited: true },
  },
});

console.log('编辑次数:', modifiedMessage.modifiedInfo?.operationCount);
```

## 可编辑的字段

| 消息类型 | 可编辑字段 |
|----------|-----------|
| text | `content` + `ext` |
| custom | `customEvent` + `customExts` + `ext` |
| image / voice / video / file / location / combine | 仅 `ext` |
| cmd | **不支持编辑** |

## 监听消息编辑事件

消息接收方通过 `onMessageUpdated` 事件得知消息被编辑：

```typescript
client.addEventHandler('modify', {
  onMessageUpdated: (message) => {
    console.log('消息被编辑:', message.id);
    console.log('编辑者:', message.modifiedInfo?.operatorId);
    console.log('编辑时间:', message.modifiedInfo?.operationTime);
    console.log('编辑次数:', message.modifiedInfo?.operationCount);
    // 在 UI 上更新该消息的显示内容
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onMessageUpdated` | 消息被编辑 | 会话中的所有成员（含编辑者的其他设备） |

## 注意事项

- 最多编辑 10 次。
- 编辑无时间限制。
- 编辑后消息的生命周期（漫游有效期）重新计算。
- 编辑后的消息会携带 `modifiedInfo`（操作时间、操作者、编辑次数）。
