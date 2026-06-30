# 多设备登录

## 前提条件

- 完成 SDK 初始化并登录。

## 获取其他设备登录信息

```typescript
const otherDeviceIds = await client.getSelfIdsOnOtherPlatform();
console.log('其他设备登录 ID:', otherDeviceIds);
```

## 初始化参数

| 参数 | 说明 |
|------|------|
| `useFixedDeviceId` | `true`（默认）：同一浏览器固定设备 ID；`false`：每个实例随机设备 ID |
| `customOsPlatform` | 自定义平台编号（1-100），用于区分不同端 |
| `customDeviceName` | 自定义设备名称 |
| `loginExtensionInfo` | 登录扩展信息，被踢时传递给被踢设备（最大 1024 字符） |

## 监听多设备事件

当同一账号在其他设备上执行操作时，当前设备会收到多设备事件：

```typescript
client.addEventHandler('multiDevice', {
  // 联系人相关多设备事件
  onMultiDeviceContact: (event) => {
    console.log('联系人多设备操作:', event.operation);
  },
  // 群组相关多设备事件
  onMultiDeviceGroup: (event) => {
    console.log('群组多设备操作:', event.operation);
  },
  // Thread 相关多设备事件
  onMultiDeviceThread: (event) => {
    console.log('Thread 多设备操作:', event.operation);
  },
  // 会话相关多设备事件
  onMultiDeviceConversation: (event) => {
    console.log('会话多设备操作:', event.operation);
  },
  // 消息删除多设备事件
  onMultiDeviceMessageRemoved: (event) => {
    console.log('消息删除多设备操作:', event);
  },
});
```

## 多设备事件操作类型

### 联系人操作
- 添加/删除联系人
- 接受/拒绝好友请求
- 添加/移除黑名单

### 群组操作
- 创建/解散群组
- 加入/退出群组
- 设置/移除管理员
- 禁言/解除禁言
- 修改群信息

### 会话操作
- 删除会话
- 置顶/取消置顶会话
- 添加/移除会话标记
- 设置/清除免打扰

### Thread 操作
- 创建/销毁 Thread
- 加入/退出 Thread
- 修改 Thread 名称

## 被踢下线

当设备数量超限或被管理员强制下线时，会触发 `onDisconnected` 事件：

```typescript
client.addEventHandler('kick', {
  onDisconnected: (reason) => {
    if (reason?.type === 'kicked') {
      console.log('被踢下线');
      console.log('踢人设备扩展信息:', reason.loginExtensionInfo);
    }
  },
});
```

## 注意事项

- 默认每个平台最多 4 个设备同时在线。
- 好友和群组事件在多设备间使用相同的事件名（通过 `from` 字段区分来源）。
