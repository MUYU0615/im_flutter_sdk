---
id: generated/integration/room-attributes
title: websdk2 Integration - 聊天室属性
description: 来自 SDK 集成文档 docs/integration/room_attributes.md，用于回答 聊天室属性 相关接入问题。
---

# 聊天室属性

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ChatRoomManager`。

## 聊天室公告

```typescript
// 获取公告
const announcement = await client.chatRoomManager.getAnnouncement({
  chatRoomId: 'room1',
});

// 更新公告（最多 512 字符，仅聊天室主/管理员）
await client.chatRoomManager.updateAnnouncement({
  chatRoomId: 'room1',
  announcement: '欢迎来到直播间！',
});
```

## 自定义属性（KV）

聊天室支持自定义 KV 属性，适用于直播间礼物墙、座位信息等场景。

### 获取属性

```typescript
const result = await client.chatRoomManager.getAttributes({
  chatRoomId: 'room1',
  keys: ['seat1', 'seat2'], // 不传则获取全部
});
```

### 设置属性

```typescript
await client.chatRoomManager.setAttributes({
  chatRoomId: 'room1',
  attributes: {
    seat1: JSON.stringify({ userId: 'user1', status: 'occupied' }),
    seat2: JSON.stringify({ userId: '', status: 'empty' }),
  },
  autoDelete: true, // 成员离开时自动删除其设置的属性（默认 true）
  isForced: false,  // 是否允许覆盖他人设置的属性
});
```

### 删除属性

```typescript
await client.chatRoomManager.removeAttributes({
  chatRoomId: 'room1',
  keys: ['seat1'],
  isForced: false,
});
```

## 监听属性变更事件

```typescript
client.addEventHandler('roomAttr', {
  onChatRoomAnnouncementChanged: (event) => {
    console.log('聊天室公告变更:', event.chatRoomId);
  },
  onChatRoomAttributesUpdated: (event) => {
    console.log('属性更新:', event.attributes);
  },
  onChatRoomAttributesRemoved: (event) => {
    console.log('属性删除:', event.keys);
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onChatRoomAnnouncementChanged` | 公告变更 | 聊天室内所有成员 |
| `onChatRoomAttributesUpdated` | 自定义属性更新 | 聊天室内所有成员 |
| `onChatRoomAttributesRemoved` | 自定义属性删除 | 聊天室内所有成员 |

## 注意事项

- `autoDelete` 默认为 `true`，成员离开聊天室时自动删除其设置的属性。
- `isForced` 为 `true` 时可覆盖他人设置的属性。
