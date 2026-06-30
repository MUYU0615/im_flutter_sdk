# 引用消息

引用（回复）消息通过消息的 `ext` 扩展字段实现，不是独立的 API。

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。

## 发送引用消息

在消息的 `ext` 字段中添加 `msgQuote` 信息：

```typescript
const message = client.chatManager.createTextMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  content: '好的，收到！',
  ext: {
    msgQuote: {
      msgID: 'original-msg-id',
      msgPreview: '原消息内容预览',
      msgSender: 'user1',
      msgType: 'text',
    },
  },
});

await client.chatManager.sendMessage(message);
```

## 接收引用消息

接收方解析消息的 `ext.msgQuote` 字段来展示引用内容：

```typescript
client.addEventHandler('quote', {
  onMessage: (message) => {
    if (message.ext?.msgQuote) {
      const quote = message.ext.msgQuote;
      console.log('引用了消息:', quote.msgID);
      console.log('原消息预览:', quote.msgPreview);
      console.log('原消息发送者:', quote.msgSender);
    }
  },
});
```

## 注意事项

- 除透传消息（CMD）外，所有消息类型均可被引用。
- 引用信息仅作为展示用途，SDK 不会自动校验被引用消息是否存在。
