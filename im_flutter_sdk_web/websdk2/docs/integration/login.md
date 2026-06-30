# 用户登录

## 前提条件

- 完成 SDK 初始化，详见 [初始化文档](./initialization.md)。
- 已获取有效的用户 ID 和 Token。

## 登录

使用 `login` 方法通过用户 ID 和 Token 登录。

```typescript
await client.login({
  userId: 'user1',
  token: 'your-im-token',
});
```

登录成功后 SDK 会自动建立 WebSocket 长连接，并触发 `onConnected` 事件。

## 登出

```typescript
await client.logout();
```

登出后 SDK 会断开长连接并清理会话状态。

## Token 续期

Token 有有效期。SDK 会在 Token 即将过期时触发 `onTokenWillExpire` 事件，你应在此时获取新 Token 并调用 `renewToken`：

```typescript
client.addEventHandler('token', {
  onTokenWillExpire: async () => {
    const newToken = await fetchNewTokenFromServer();
    const result = await client.renewToken(newToken);
    console.log('Token 续期成功，过期时间:', result.expireAt);
  },
  onTokenExpired: () => {
    // Token 已过期，需要重新登录
    console.log('Token 已过期');
  },
});
```

### renewToken 返回值

| 字段 | 类型 | 描述 |
|------|------|------|
| `token` | string | 已成功应用的新 Token |
| `expireAt` | number | Token 过期时间戳（毫秒） |

## 多设备登录

SDK 支持同一账号在多个设备上同时登录。通过初始化参数控制设备标识：

- `useFixedDeviceId: true`（默认）：同一浏览器所有标签页视为同一设备。
- `useFixedDeviceId: false`：每个 SDK 实例使用随机设备 ID，每个标签页视为不同设备。
- `customOsPlatform`：自定义平台编号（1-100），用于区分不同端。
- `customDeviceName`：自定义设备名称。

当多设备登录策略导致当前设备被踢时，会触发 `onDisconnected` 事件，并携带 `loginExtensionInfo`（踢人设备设置的扩展信息）。

## 获取其他设备登录信息

```typescript
const otherDeviceIds = await client.getSelfIdsOnOtherPlatform();
// 返回当前用户在其他平台上的登录 ID 列表
```
