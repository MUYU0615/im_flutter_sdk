---
id: generated/integration/user-relationship
title: websdk2 Integration - 联系人管理
description: 来自 SDK 集成文档 docs/integration/user_relationship.md，用于回答 联系人管理 相关接入问题。
---

# 联系人管理

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `ContactManager`。

## 获取联系人列表

```typescript
const contacts = client.contactManager.getContacts();
// 返回 ReadonlyArray<Contact>，包含 userId 和 remark
```

## 添加联系人

发送好友请求：

```typescript
await client.contactManager.addContact({
  userId: 'user2',
  reason: '你好，我是 user1，想加你为好友',
});
```

## 接受/拒绝好友请求

```typescript
// 接受
await client.contactManager.acceptContactInvite({ userId: 'user1' });

// 拒绝
await client.contactManager.declineContactInvite({ userId: 'user1' });
```

## 删除联系人

```typescript
await client.contactManager.deleteContact({ userId: 'user2' });
```

## 设置联系人备注

```typescript
await client.contactManager.setContactRemark({
  userId: 'user2',
  remark: '同事小王',
});
```

## 黑名单管理

```typescript
// 获取黑名单
const blocklist = await client.contactManager.getBlocklist();

// 添加到黑名单
await client.contactManager.addUsersToBlocklist({ userIds: ['user3'] });

// 从黑名单移除
await client.contactManager.removeUserFromBlocklist({ userIds: ['user3'] });
```

## 监听联系人事件

```typescript
client.addEventHandler('contact', {
  // 收到好友请求
  onContactInvited: (event) => {
    console.log('收到好友请求:', event.from, '附言:', event.reason);
  },
  // 好友请求被接受
  onContactAgreed: (event) => {
    console.log(event.from, '接受了你的好友请求');
  },
  // 好友请求被拒绝
  onContactRefuse: (event) => {
    console.log(event.from, '拒绝了你的好友请求');
  },
  // 新增联系人（双方都会收到）
  onContactAdded: (event) => {
    console.log('新增联系人:', event.userId);
  },
  // 被删除联系人
  onContactDeleted: (event) => {
    console.log('被删除联系人:', event.userId);
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onContactInvited` | 收到好友请求 | 被邀请方 |
| `onContactAgreed` | 好友请求被接受 | 请求发起方 |
| `onContactRefuse` | 好友请求被拒绝 | 请求发起方 |
| `onContactAdded` | 好友关系建立 | 双方 |
| `onContactDeleted` | 被对方删除 | 被删除方 |
| `onContactInfoUpdated` | 联系人信息变更 | 订阅方 |
