# 初始化

初始化是使用 SDK 的必要步骤，需在所有接口方法调用前完成。

## 前提条件

- 有效的环信即时通讯 IM 开发者账号和 App Key。
- 已通过 npm 安装 SDK。

```bash
npm install easemob-websdk
```

## 初始化 SDK

通过 `ChatClient.init` 传入配置创建 SDK 单例实例。

```typescript
import { ChatClient } from 'easemob-websdk';

const client = ChatClient.init({
  appKey: 'your-org#your-app',
});
```

### 初始化参数

| 参数 | 类型 | 是否必需 | 描述 |
|------|------|----------|------|
| `appKey` | string | 是 | 应用唯一标识，格式为 `org#app`。 |
| `useFixedDeviceId` | boolean | 否 | 是否在同一浏览器内复用固定设备标识。默认 `true`，即同一浏览器所有实例视为同一设备。设为 `false` 则每个实例使用随机设备 ID。影响多端互踢策略。 |
| `deviceId` | string | 否 | 自定义设备标识；未传时使用 SDK 默认值。 |
| `useReplacedMessageContents` | boolean | 否 | 内容审核替换后，是否将替换后的消息回给发送方。 |
| `useCustomAttachmentUpload` | boolean | 否 | 是否使用自定义附件上传能力。设为 `true` 时 SDK 不自动上传附件。 |
| `autoLogin` | boolean | 否 | 是否启用自动登录续连行为。 |
| `enableSyncData` | `ReadonlyArray<'conversation' \| 'contact' \| 'group'>` | 否 | 登录后自动同步的数据类型；未传时默认 `['conversation']`，只自动同步会话列表；传 `[]` 表示全部关闭；可额外传 `contact` / `group` 同步联系人和已加入群组。 |
| `enableDeliveryReceipt` | boolean | 否 | 是否开启送达回执。开启后收到单聊消息时 SDK 自动向发送方回送达回执。默认 `false`。 |
| `enableUserInfoSync` | boolean | 否 | 是否启用用户资料同步增强能力。 |
| `customDeviceName` | string | 否 | 自定义设备名称，通常与 `customOsPlatform` 搭配使用。 |
| `customOsPlatform` | number | 否 | 自定义平台编号（1-100）。 |
| `loginExtensionInfo` | string | 否 | 登录自定义扩展信息。当多设备策略导致当前设备被踢时，该字符串会传递给被踢设备，最大 1024 字符。 |
| `serviceConfig` | object | 否 | 服务接入配置（私有部署时使用）；缺省时使用 SDK 内置 DNS 配置。 |
| `managers` | array | 否 | 初始化时需要自动注册的管理器列表。 |

### 自动同步连接模型

登录后启用 `enableSyncData` 时，`conversation`、`contact`、`group` 三类数据同步复用同一条 sync WebSocket。SDK 会按请求的 `requestId` 路由服务端串行返回的响应帧，所有同步请求完成后自动关闭这条 sync WebSocket；如果连接建立失败或同步过程中异常断开，SDK 会用 `maxAttempts = 3` 进行有限重试，并记录不含 token 的结构化日志。

## 注册管理器

SDK 采用模块化设计，各功能通过管理器（Manager）提供。初始化时通过 `managers` 参数或 `use()` 方法注册：

```typescript
import { ChatClient, ChatManager, ContactManager, GroupManager } from 'easemob-websdk';

// 方式一：init 时注册
const client = ChatClient.init({
  appKey: 'your-org#your-app',
  managers: [ChatManager, ContactManager, GroupManager],
});

// 方式二：链式 use 注册
const client = ChatClient.init({ appKey: 'your-org#your-app' })
  .use(ChatManager)
  .use(ContactManager)
  .use(GroupManager);

// 注册后即可通过属性访问
client.chatManager.sendMessage(msg);
client.contactManager.getContacts();
client.groupManager.createGroup(params);
```

## 初始化后设置监听

初始化后，可通过 `addEventHandler` 注册事件监听，及时获知连接状态和消息收发。

```typescript
client.addEventHandler('connection', {
  onConnecting: () => console.log('正在连接...'),
  onConnected: () => console.log('连接成功'),
  onDisconnected: (reason) => console.log('连接断开', reason),
  onTokenWillExpire: () => console.log('Token 即将过期'),
  onTokenExpired: () => console.log('Token 已过期'),
});

client.addEventHandler('message', {
  onMessage: (message) => console.log('收到消息', message),
});
```

详见 [连接状态管理](./connection.md) 和 [接收消息](./message_receive.md)。
