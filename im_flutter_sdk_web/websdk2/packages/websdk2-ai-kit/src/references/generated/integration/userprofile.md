---
id: generated/integration/userprofile
title: websdk2 Integration - 用户属性
description: 来自 SDK 集成文档 docs/integration/userprofile.md，用于回答 用户属性 相关接入问题。
---

# 用户属性

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `UserInfoManager`。

## 设置自己的用户属性

```typescript
// 设置全部属性
await client.userInfoManager.updateOwnInfo({
  nickname: '张三',
  avatarUrl: 'https://example.com/avatar.png',
  phone: '13800138000',
  mail: 'zhangsan@example.com',
  gender: 1, // 0: 未知, 1: 男, 2: 女
  sign: '这是我的签名',
  birth: '1990-01-01',
  ext: '{"custom": "data"}',
});

// 设置单个属性
await client.userInfoManager.updateOwnInfoByAttribute({
  attribute: 'nickname',
  value: '李四',
});
```

## 获取用户属性

```typescript
// 按用户 ID 获取全部属性（最多 100 个用户）
const result = await client.userInfoManager.getUserInfoByUserId({
  userIds: ['user1', 'user2'],
});

// 按用户 ID 获取指定属性
const result = await client.userInfoManager.getUserInfoByAttribute({
  userIds: ['user1'],
  attributes: ['nickname', 'avatarUrl'],
});
```

## 用户属性字段

| 字段 | 类型 | 最大长度 | 描述 |
|------|------|----------|------|
| `nickname` | string | 64 | 昵称 |
| `avatarUrl` | string | 256 | 头像 URL |
| `phone` | string | 32 | 手机号 |
| `mail` | string | 64 | 邮箱 |
| `gender` | number | - | 性别：0 未知 / 1 男 / 2 女 |
| `sign` | string | 256 | 签名 |
| `birth` | string | 64 | 生日 |
| `ext` | string | - | 扩展字段 |

## 订阅用户属性变更

```typescript
// 订阅
await client.userInfoManager.subscribeUsersInfo({
  userIds: ['user1', 'user2'],
});

// 取消订阅
await client.userInfoManager.unsubscribeUsersInfo({
  userIds: ['user1'],
});

// 获取已订阅的用户列表
const subscribedUsers = await client.userInfoManager.getSubscribedUsers();
```

## 监听用户属性变更事件

```typescript
client.addEventHandler('userInfo', {
  // 自己的属性被修改
  onOwnInfoUpdated: (userInfo) => {
    console.log('自己的属性更新:', userInfo);
  },
  // 订阅的用户属性变更
  onUserInfoUpdated: (event) => {
    console.log('用户属性变更:', event.userId, event.userInfo);
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onOwnInfoUpdated` | 自己的属性被修改（含其他设备修改） | 当前用户所有设备 |
| `onUserInfoUpdated` | 订阅的用户属性变更 | 订阅方 |

## 注意事项

- 每个用户属性总大小不超过 2KB。
- 只有用户本人可以修改自己的属性。
