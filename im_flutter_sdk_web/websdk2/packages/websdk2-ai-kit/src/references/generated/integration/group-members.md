---
id: generated/integration/group-members
title: websdk2 Integration - 群组成员管理
description: 来自 SDK 集成文档 docs/integration/group_members.md，用于回答 群组成员管理 相关接入问题。
---

# 群组成员管理

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `GroupManager`。

## 获取群成员列表

```typescript
const result = await client.groupManager.getGroupMemberList({
  groupId: 'group1',
  pageSize: 20,
  cursor: '',
});

console.log('成员列表:', result.members);
console.log('下一页:', result.cursor);
```

## 移除群成员

```typescript
await client.groupManager.removeGroupMembers({
  groupId: 'group1',
  userIds: ['user3', 'user4'],
});
```

## 管理员管理

```typescript
// 获取管理员列表
const admins = await client.groupManager.getGroupAdminList({ groupId: 'group1' });

// 设置管理员
await client.groupManager.addGroupAdmin({
  groupId: 'group1',
  userId: 'user2',
});

// 移除管理员
await client.groupManager.removeGroupAdmin({
  groupId: 'group1',
  userId: 'user2',
});
```

## 禁言管理

```typescript
// 禁言指定成员（duration 单位毫秒，-1 为永久禁言）
await client.groupManager.muteGroupMembers({
  groupId: 'group1',
  userIds: ['user3'],
  duration: 60000, // 禁言 60 秒
});

// 解除禁言
await client.groupManager.unmuteGroupMembers({
  groupId: 'group1',
  userIds: ['user3'],
});

// 全员禁言
await client.groupManager.muteAllGroupMembers({ groupId: 'group1' });

// 解除全员禁言
await client.groupManager.unmuteAllGroupMembers({ groupId: 'group1' });

// 获取禁言列表
const muteList = await client.groupManager.getGroupMuteList({ groupId: 'group1' });

// 检查自己是否在禁言列表
const isMuted = await client.groupManager.checkIfInGroupMuteList({ groupId: 'group1' });
```

## 黑名单管理

```typescript
// 获取黑名单
const blocklist = await client.groupManager.getGroupBlocklist({ groupId: 'group1' });

// 加入黑名单（同时移出群）
await client.groupManager.blockGroupMembers({
  groupId: 'group1',
  userIds: ['user5'],
});

// 移出黑名单
await client.groupManager.unblockGroupMembers({
  groupId: 'group1',
  userIds: ['user5'],
});
```

## 白名单管理

白名单成员在全员禁言时仍可发言。

```typescript
// 获取白名单
const allowlist = await client.groupManager.getGroupAllowlist({ groupId: 'group1' });

// 加入白名单
await client.groupManager.addUsersToGroupAllowlist({
  groupId: 'group1',
  userIds: ['user2'],
});

// 移出白名单
await client.groupManager.removeUsersFromGroupAllowlist({
  groupId: 'group1',
  userIds: ['user2'],
});

// 检查是否在白名单
const isInAllowlist = await client.groupManager.checkIfInGroupAllowList({
  groupId: 'group1',
});
```

## 群成员自定义属性

```typescript
// 设置成员属性（如群名片）
await client.groupManager.setGroupMemberAttributes({
  groupId: 'group1',
  userId: 'user2',
  attributes: { nickName: '群内昵称', role: '开发' },
});

// 获取成员属性（最多 10 人）
const result = await client.groupManager.getGroupMembersAttributes({
  groupId: 'group1',
  userIds: ['user2', 'user3'],
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onGroupMemberMuted` | 成员被禁言 | 群内所有成员 |
| `onGroupMemberUnmuted` | 成员被解除禁言 | 群内所有成员 |
| `onGroupAllMembersMuted` | 全员禁言 | 群内所有成员 |
| `onGroupAllMembersUnmuted` | 解除全员禁言 | 群内所有成员 |
| `onGroupAllowlistAdded` | 成员加入白名单 | 群内所有成员 |
| `onGroupAllowlistRemoved` | 成员移出白名单 | 群内所有成员 |
| `onGroupMemberAttributesUpdated` | 成员属性变更 | 群内所有成员 |
