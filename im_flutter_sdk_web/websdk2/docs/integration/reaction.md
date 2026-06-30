# 消息 Reaction

Reaction 允许用户对消息添加表情回应。

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatManager`。
- 需要在控制台开通 Reaction 功能。

## 添加 Reaction

```typescript
await client.chatManager.addReaction({
  messageId: 'msg-id-123',
  reaction: '👍',
});
```

## 移除 Reaction

```typescript
await client.chatManager.removeReaction({
  messageId: 'msg-id-123',
  reaction: '👍',
});
```

## 获取 Reaction 列表

获取消息的 Reaction 概览（每个 Reaction 显示前 3 个用户）：

```typescript
const reactions = await client.chatManager.getReactionList({
  messageId: 'msg-id-123',
  conversationType: 'groupChat',
});

reactions.forEach((item) => {
  console.log('Reaction:', item.reaction);
  console.log('数量:', item.count);
  console.log('前几个用户:', item.userList);
  console.log('自己是否添加:', item.isAddedBySelf);
});
```

## 获取 Reaction 详情

获取某个 Reaction 的完整用户列表：

```typescript
const detail = await client.chatManager.getReactionDetail({
  messageId: 'msg-id-123',
  reaction: '👍',
  pageSize: 20,
  cursor: '',
});

console.log('用户列表:', detail.users);
console.log('下一页:', detail.cursor);
```

## 监听 Reaction 变更事件

```typescript
client.addEventHandler('reaction', {
  onReactionChanged: (event) => {
    console.log('消息 ID:', event.messageId);
    console.log('会话 ID:', event.conversationId);
    console.log('Reaction 列表:', event.reactions);
    console.log('操作列表:', event.operations);
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onReactionChanged` | 消息的 Reaction 发生变更 | 会话中的所有成员 |

## 注意事项

- 仅支持单聊和群聊，**不支持聊天室**。
- 每个用户对同一消息的同一 Reaction 只能添加一次。
- 重复添加会返回错误。
- 历史消息中会包含 Reaction 概览信息。
