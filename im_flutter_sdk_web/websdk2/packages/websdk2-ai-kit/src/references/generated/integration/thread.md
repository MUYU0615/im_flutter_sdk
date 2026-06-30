---
id: generated/integration/thread
title: websdk2 Integration - 消息子区 Thread
description: 来自 SDK 集成文档 docs/integration/thread.md，用于回答 消息子区 Thread 相关接入问题。
---

# 消息子区（Thread）

Thread 是群组消息的子会话，允许用户围绕某条消息展开独立讨论。

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatThreadManager`。
- 需要在控制台开通 Thread 功能。

## 创建 Thread

```typescript
const result = await client.chatThreadManager.createChatThread({
  parentId: 'group1',     // 所属群组 ID
  name: '讨论主题',       // Thread 名称（最多 64 字符）
  messageId: 'msg-id-123', // 关联的群消息 ID
});

console.log('Thread ID:', result.chatThreadId);
```

## 加入/退出 Thread

```typescript
// 加入
await client.chatThreadManager.joinChatThread({ chatThreadId: 'thread1' });

// 退出
await client.chatThreadManager.leaveChatThread({ chatThreadId: 'thread1' });
```

## 销毁 Thread

仅群主/管理员可销毁：

```typescript
await client.chatThreadManager.destroyChatThread({ chatThreadId: 'thread1' });
```

## 修改 Thread 名称

```typescript
await client.chatThreadManager.updateChatThreadName({
  chatThreadId: 'thread1',
  name: '新主题名称',
});
```

## 获取 Thread 信息

```typescript
const detail = await client.chatThreadManager.getChatThreadInfo({
  chatThreadId: 'thread1',
});
```

## 获取 Thread 列表

```typescript
// 获取群内所有 Thread
const result = await client.chatThreadManager.getChatThreadList({
  parentId: 'group1',
  pageSize: 20,
  cursor: '',
});

// 获取自己加入的 Thread
const joined = await client.chatThreadManager.getJoinedChatThreadList({
  parentId: 'group1', // 可选，不传则获取所有群的
  pageSize: 20,
  cursor: '',
});
```

## 获取 Thread 成员

```typescript
const result = await client.chatThreadManager.getChatThreadMemberList({
  chatThreadId: 'thread1',
  pageSize: 20,
  cursor: '',
});
```

## 移除 Thread 成员

仅群主/管理员可操作：

```typescript
await client.chatThreadManager.removeChatThreadMember({
  chatThreadId: 'thread1',
  memberId: 'user3',
});
```

## 获取 Thread 最后一条消息

```typescript
const result = await client.chatThreadManager.getChatThreadLastMessageList({
  chatThreadIds: ['thread1', 'thread2'], // 最多 20 个
});
```

## 在 Thread 中发送消息

当前公开的 ChatThread API 覆盖子区管理、成员管理、最后消息查询和事件监听。发送 Thread 回复消息需要使用服务端支持的 Thread 消息字段；如果当前 SDK 版本未公开专用创建参数，不要在业务代码中使用未声明的 `isChatThread` 等字段。

## 使用 ChatThread 实体对象

```typescript
const thread = client.chatThreadManager.getChatThread('thread1');
const detail = await thread.getInfo();
const latest = await thread.refresh();
```

## 监听 Thread 事件

```typescript
client.chatThreadManager.addEventHandler('thread', {
  onChatThreadCreated: (event) => {
    console.log('Thread 创建:', event.chatThreadId, event.chatThreadName);
  },
  onChatThreadDestroyed: (event) => {
    console.log('Thread 销毁:', event.chatThreadId);
  },
  onChatThreadUpdated: (event) => {
    console.log('Thread 更新:', event.chatThreadId, event.messageCount);
  },
  onChatThreadUserRemoved: (event) => {
    console.log('当前用户被移出 Thread:', event.chatThreadId, event.memberId);
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onChatThreadCreated` | Thread 创建 | 子区所属群组的所有成员 |
| `onChatThreadDestroyed` | Thread 解散 | 子区所属群组的所有成员 |
| `onChatThreadUpdated` | Thread 名称修改，或子区中添加、撤销回复消息 | 子区所属群组的所有成员 |
| `onChatThreadUserRemoved` | 当前登录用户被群主或管理员移出 Thread | 被移出的当前登录用户 |

## 注意事项

- 所有群成员都可以创建 Thread。
- 群主/管理员可以销毁、重命名和移除成员。
- Thread 中的消息不计入群的未读数。
