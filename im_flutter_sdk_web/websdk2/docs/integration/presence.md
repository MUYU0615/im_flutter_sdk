# 在线状态（Presence）

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `PresenceManager`。
- 需要在控制台开通在线状态功能。

## 发布自定义在线状态

```typescript
await client.presenceManager.publishPresence({
  description: '忙碌中',
});
```

## 订阅用户在线状态

```typescript
// 订阅（每次最多 100 人，总计最多 3000 人）
const result = await client.presenceManager.subscribePresence({
  userIds: ['user1', 'user2'],
  expiry: 7 * 24 * 3600, // 订阅有效期，单位秒，最长 30 天
});
```

## 取消订阅

```typescript
await client.presenceManager.unsubscribePresence({
  userIds: ['user1', 'user2'],
});
```

## 查询用户在线状态

```typescript
// 主动查询（最多 100 人）
const result = await client.presenceManager.getPresenceStatus({
  userIds: ['user1', 'user2'],
});
```

## 获取订阅列表

```typescript
const result = await client.presenceManager.getSubscribedPresenceList({
  pageSize: 50,
  pageNum: 1,
});
```

## 监听在线状态变更

```typescript
client.addEventHandler('presence', {
  onPresenceStatusChange: (presenceList) => {
    presenceList.forEach((presence) => {
      console.log('用户:', presence.userId);
      console.log('状态描述:', presence.description);
      console.log('设备状态:', presence.statusDetails);
    });
  },
});
```

## 事件接收方说明

| 事件 | 触发时机 | 接收方 |
|------|----------|--------|
| `onPresenceStatusChange` | 订阅的用户在线状态变更 | 订阅方 |

## 注意事项

- 每次订阅最多 100 人，总订阅上限 3000 人。
- 订阅有效期最长 30 天。
- 每个用户最多被 3000 人订阅。
