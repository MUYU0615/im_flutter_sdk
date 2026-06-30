---
id: generated/integration/room-manage
title: websdk2 Integration - 聊天室管理
description: 来自 SDK 集成文档 docs/integration/room_manage.md，用于回答 聊天室管理 相关接入问题。
---

# 聊天室管理

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatRoomManager`。

## 获取聊天室列表

```typescript
const result = await client.chatRoomManager.getChatRoomList({
  pageSize: 20,
  cursor: '',
});

console.log('聊天室列表:', result.list);
```

## 获取聊天室详情

```typescript
const detail = await client.chatRoomManager.getChatRoomInfo({
  chatRoomId: 'room1',
});
```

## 加入聊天室

```typescript
await client.chatRoomManager.joinChatRoom({
  chatRoomId: 'room1',
  // 可选：加入时携带的扩展信息
  ext: '{"source": "search"}',
});
```

## 离开聊天室

```typescript
await client.chatRoomManager.leaveChatRoom({ chatRoomId: 'room1' });
```

## 修改聊天室信息

```typescript
await client.chatRoomManager.updateChatRoomInfo({
  chatRoomId: 'room1',
  name: '新聊天室名称',
  description: '新描述',
  maxMembers: 5000,
});
```

## 使用 ChatRoom 实体对象

```typescript
const room = client.chatRoomManager.getChatRoom('room1');

const detail = await room.getDetail();
await room.updateInfo({ name: '新名称' });
const members = await room.getMemberList({ pageSize: 20, cursor: '' });
```

## 监听聊天室事件

```typescript
client.addEventHandler('chatroom', {
  // 聊天室被销毁
  onChatRoomDestroyed: (event) => {
    console.log('聊天室被销毁:', event.chatRoomId);
  },
  // 有成员加入
  onChatRoomMemberJoined: (event) => {
    console.log('成员加入:', event.userId, '当前人数:', event.memberCount);
  },
  // 有成员离开
  onChatRoomMemberExited: (event) => {
    console.log('成员离开:', event.userId, '当前人数:', event.memberCount);
  },
  // 被移出聊天室
  onChatRoomMemberRemoved: (event) => {
    console.log('被移出聊天室:', event.chatRoomId);
  },
  // 聊天室信息变更
  onChatRoomInfoChanged: (event) => {
    console.log('聊天室信息变更:', event.chatRoomId);
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onChatRoomDestroyed` | 聊天室被销毁 | 聊天室内所有成员 |
| `onChatRoomMemberJoined` | 成员加入 | 聊天室内所有成员 |
| `onChatRoomMemberExited` | 成员离开 | 聊天室内所有成员 |
| `onChatRoomMemberRemoved` | 被移出 | 被移出者 + 聊天室内所有成员 |
| `onChatRoomInfoChanged` | 信息变更 | 聊天室内所有成员 |
| `onChatRoomOwnerChanged` | 聊天室主变更 | 聊天室内所有成员 |
| `onChatRoomAdminAdded` | 新增管理员 | 聊天室内所有成员 |
| `onChatRoomAdminRemoved` | 移除管理员 | 聊天室内所有成员 |

## 注意事项

- 成员离线超过 2 分钟自动退出聊天室（白名单成员除外）。
- 白名单成员的消息具有高优先级。
- 聊天室消息超过 20 条/秒时，低优先级消息可能被丢弃。
