---
id: generated/integration/push
title: websdk2 Integration - 推送与免打扰
description: 来自 SDK 集成文档 docs/integration/push.md，用于回答 推送与免打扰 相关接入问题。
---

# 推送与免打扰

## 前提条件

- 完成 SDK 初始化并登录。
- 已注册 `PushManager`。

## 上传推送 Token

```typescript
await client.pushManager.uploadPushToken({
  deviceId: 'device-id',
  deviceToken: 'push-token-from-fcm-or-apns',
  notifierName: 'your-push-certificate-name',
});
```

## 全局免打扰设置

### 设置全局免打扰

```typescript
await client.pushManager.setGlobalSilentMode({
  // 推送模式：'ALL' 接收所有 | 'AT' 仅 @消息 | 'NONE' 不接收
  remindType: 'AT',
  // 可选：免打扰时段
  startTime: '23:00',
  endTime: '07:00',
  // 可选：免打扰时长（毫秒），一次性
  duration: 8 * 3600 * 1000,
});
```

### 获取全局免打扰设置

```typescript
const settings = await client.pushManager.getGlobalSilentMode();
console.log('推送模式:', settings.remindType);
console.log('免打扰时段:', settings.startTime, '-', settings.endTime);
```

## 会话级免打扰设置

### 设置会话免打扰

```typescript
await client.pushManager.setConversationSilentMode({
  conversationId: 'user2',
  conversationType: 'singleChat',
  remindType: 'NONE',
});
```

### 获取会话免打扰设置

```typescript
const settings = await client.pushManager.getConversationSilentMode({
  conversationId: 'user2',
  conversationType: 'singleChat',
});
```

### 清除会话免打扰（恢复使用全局设置）

```typescript
await client.pushManager.clearConversationRemindType({
  conversationId: 'user2',
  conversationType: 'singleChat',
});
```

### 批量获取会话免打扰设置

```typescript
const result = await client.pushManager.getConversationSilentModes({
  conversations: [
    { conversationId: 'user2', conversationType: 'singleChat' },
    { conversationId: 'group1', conversationType: 'groupChat' },
  ],
});
```

## 获取设置了免打扰的会话列表

```typescript
const result = await client.pushManager.getConversationListByRemindType({
  pageSize: 20,
  cursor: '',
});
```

## 推送语言设置

```typescript
// 设置推送语言
await client.pushManager.setPushLanguage({ language: 'zh-CN' });

// 获取推送语言
const lang = await client.pushManager.getPushLanguage();
```

## 推送模式说明

| 模式 | 说明 |
|------|------|
| `ALL` | 接收所有推送通知 |
| `AT` | 仅接收 @消息的推送 |
| `NONE` | 不接收任何推送 |

## 优先级规则

- 会话级设置优先于全局设置。
- 免打扰时段（DND）优先于推送模式。
- `duration` 为一次性免打扰，到期后自动恢复。
- `startTime`/`endTime` 为每日循环免打扰时段。

## 注意事项

- 需要在控制台开通推送功能（免费）。
- 其他设备会收到多设备事件通知。
