# 聊天室成员管理

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatRoomManager`。

## 获取成员列表

```typescript
const result = await client.chatRoomManager.getMemberList({
  chatRoomId: 'room1',
  pageSize: 20,
  cursor: '',
});
```

## 移除成员

```typescript
await client.chatRoomManager.removeMembers({
  chatRoomId: 'room1',
  userIds: ['user3'],
});
```

## 管理员管理

```typescript
// 获取管理员列表
const admins = await client.chatRoomManager.getAdminList({ chatRoomId: 'room1' });

// 设置管理员
await client.chatRoomManager.addAdmin({
  chatRoomId: 'room1',
  userId: 'user2',
});

// 移除管理员
await client.chatRoomManager.removeAdmin({
  chatRoomId: 'room1',
  userId: 'user2',
});
```

## 禁言管理

```typescript
// 禁言指定成员
await client.chatRoomManager.muteMembers({
  chatRoomId: 'room1',
  userIds: ['user3'],
  duration: 60000,
});

// 解除禁言
await client.chatRoomManager.unmuteMembers({
  chatRoomId: 'room1',
  userIds: ['user3'],
});

// 全员禁言
await client.chatRoomManager.muteAllMembers({ chatRoomId: 'room1' });

// 解除全员禁言
await client.chatRoomManager.unmuteAllMembers({ chatRoomId: 'room1' });

// 获取禁言列表
const muteList = await client.chatRoomManager.getMuteList({ chatRoomId: 'room1' });

// 检查自己是否被禁言
const status = await client.chatRoomManager.checkIfInMuteList({ chatRoomId: 'room1' });
```

## 黑名单管理

```typescript
// 获取黑名单
const blocklist = await client.chatRoomManager.getBlocklist({ chatRoomId: 'room1' });

// 加入黑名单
await client.chatRoomManager.blockMembers({
  chatRoomId: 'room1',
  userIds: ['user5'],
});

// 移出黑名单
await client.chatRoomManager.unblockMembers({
  chatRoomId: 'room1',
  userIds: ['user5'],
});
```

## 白名单管理

```typescript
// 获取白名单
const allowlist = await client.chatRoomManager.getAllowlist({ chatRoomId: 'room1' });

// 加入白名单
await client.chatRoomManager.addUsersToAllowlist({
  chatRoomId: 'room1',
  userIds: ['user2'],
});

// 移出白名单
await client.chatRoomManager.removeUsersFromAllowlist({
  chatRoomId: 'room1',
  userIds: ['user2'],
});

// 检查是否在白名单
const isInAllowlist = await client.chatRoomManager.checkIfInAllowList({
  chatRoomId: 'room1',
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onChatRoomMemberMuted` | 成员被禁言 | 聊天室内所有成员 |
| `onChatRoomMemberUnmuted` | 成员被解除禁言 | 聊天室内所有成员 |
| `onChatRoomAllMembersMuted` | 全员禁言 | 聊天室内所有成员 |
| `onChatRoomAllMembersUnmuted` | 解除全员禁言 | 聊天室内所有成员 |
| `onChatRoomAllowlistAdded` | 成员加入白名单 | 聊天室内所有成员 |
| `onChatRoomAllowlistRemoved` | 成员移出白名单 | 聊天室内所有成员 |
| `onChatRoomMemberUnblocked` | 成员移出黑名单 | 聊天室内所有成员 |
