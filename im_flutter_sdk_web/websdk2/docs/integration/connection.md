# 连接状态管理

## 前提条件

完成 SDK 初始化，详见 [初始化文档](./initialization.md)。

## 监听连接状态

通过 `addEventHandler` 监听连接相关事件：

```typescript
client.addEventHandler('connection', {
  // 正在连接到服务器
  onConnecting: () => {
    console.log('正在连接...');
  },
  // 成功连接到服务器
  onConnected: () => {
    console.log('连接成功');
  },
  // 与服务器断开连接
  onDisconnected: (reason) => {
    console.log('连接断开', reason);
  },
  // 自动重连失败（达到最大重试次数）
  onReconnectFailed: () => {
    console.log('重连失败');
  },
});
```

## 获取当前连接状态

```typescript
const state = client.getConnectionState();
// 返回: 'disconnected' | 'connecting' | 'connected'
```

## 自动重连

SDK 内置自动重连机制。当网络断开后，SDK 会自动尝试重新连接，期间触发 `onConnecting` 事件。

### 不会自动重连的情况

以下情况 SDK 不会自动重连，需要用户重新登录：

- 用户主动调用 `logout()`
- 认证错误（Token 无效或过期）
- 密码被修改
- 账号被删除
- 被其他设备踢下线
- 设备数量超限
- DAU/MAU 超限
- 被管理员强制下线

## 离线消息同步

登录成功后，SDK 会自动拉取离线消息。可通过事件监听同步进度：

```typescript
client.addEventHandler('sync', {
  onOfflineMessageSyncStart: () => {
    console.log('开始拉取离线消息');
  },
  onOfflineMessageSyncFinish: () => {
    console.log('离线消息拉取完成');
  },
});
```
