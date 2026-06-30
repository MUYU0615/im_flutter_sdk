---
id: generated/api-reference/src-chat-client-ts
title: websdk2 API Reference - ChatClient API
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/chat-client.ts API Reference 分段。
---

## src/chat-client.ts

### ChatClient

### init(config: Omit<InitConfig, 'managers'> & { managers?: Managers }) => WithManagers<ChatClient, Managers>

#### 说明

初始化 ChatClient 单例。首次调用会创建实例，后续以相同配置调用时复用同一个实例，并可追加注册管理器。

#### 调用示例

初始化并注册管理器

```ts
const client = ChatClient.init({
  appKey: 'org#app',
  managers: [ChatManager, GroupManager],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| config | `Omit<InitConfig, 'managers'> & { managers?: Managers }` | 初始化配置，包含 appKey、服务接入参数与可选管理器列表。 |

#### 返回值

返回带已注册管理器类型增强的 ChatClient 实例。

### login(params: AuthContext) => Promise<void>

#### 说明

登录并建立到消息服务的长连接。登录成功后会恢复本地缓存、同步会话列表，并按配置触发联系人与资料同步。

#### 调用示例

登录 SDK

```ts
await client.login({
  userId: 'alice',
  token: 'your-im-token',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `AuthContext` | 登录参数，包含用户 ID 与 IM token。 |

#### 返回值

登录成功时 resolve，无返回业务数据。

### logout() => Promise<void>

#### 说明

登出并关闭当前连接，同时清理登录态、运行时缓存引用与日志上报状态。

#### 调用示例

登出 SDK

```ts
await client.logout();
```

#### 返回值

登出完成时 resolve，无返回业务数据。

### getConnectionState() => ConnectionState

#### 说明

获取当前连接状态。

#### 调用示例

读取连接状态

```ts
const state = client.getConnectionState();
```

#### 返回值

返回当前连接状态枚举值。

### getCurrentUserId() => string | null

#### 说明

获取当前登录用户 ID。

#### 调用示例

读取当前登录用户

```ts
const userId = client.getCurrentUserId();
```

#### 返回值

返回当前登录用户 ID；未登录时返回 `null`。

### getRestContext() => RestContext

#### 说明

获取当前登录会话的 REST 访问上下文，供 SDK 公开模块或扩展能力复用统一鉴权与地址信息。

#### 调用示例

读取 REST 上下文

```ts
const context = client.getRestContext();
```

#### 返回值

返回当前登录会话对应的 REST 上下文。

### renewToken(token: string) => Promise<TokenRenewalResult>

#### 说明

更新当前登录会话的 IM token，并重置 token 生命周期提醒。

#### 调用示例

续期 IM token

```ts
const result = await client.renewToken(newToken);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| token | `string` | 新 IM token。 |

#### 返回值

返回已应用的新 token 与过期时间。

### getRTCTokenInfo(params: GetRTCTokenInfoParams) => Promise<RTCTokenInfo>

#### 说明

获取当前用户的 RTC token 信息。

#### 调用示例

查询 RTC token

```ts
const rtc = await client.getRTCTokenInfo({ channelName: 'demo' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetRTCTokenInfoParams` | RTC token 查询参数。 |

#### 返回值

返回 RTC App ID、token、频道名、UID 与过期时间。

### getUserIdsWithRTCUids(rtcUids: ReadonlyArray<number>) => Promise<RTCUidUserIdMap>

#### 说明

批量查询 RTC UID 对应的 IM userId。

#### 调用示例

查询 RTC UID 映射

```ts
const users = await client.getUserIdsWithRTCUids([123456]);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| rtcUids | `ReadonlyArray<number>` | RTC UID 列表。 |

#### 返回值

返回 RTC UID 到 IM userId 的映射；未命中的 UID 不出现在结果中。

### getSelfIdsOnOtherPlatform() => Promise<SelfIdsOnOtherPlatform>

#### 说明

获取当前用户在其他已登录设备上的登录 ID 列表。

#### 调用示例

查询其他平台登录 ID

```ts
const ids = await client.getSelfIdsOnOtherPlatform();
```

#### 返回值

返回当前用户在其他设备上的 `userId/resource` 列表；当前设备会被自动过滤。

### getCacheManager() => CacheManager | null

#### 说明

获取当前会话绑定的缓存管理器实例。

#### 调用示例

读取缓存管理器

```ts
const cacheManager = client.getCacheManager();
```

#### 返回值

返回缓存管理器；未登录或缓存未初始化时返回 `null`。

### getUploadAdapter() => UploadAdapter | null

#### 说明

获取当前平台适配层暴露的上传适配器。

#### 调用示例

读取上传适配器

```ts
const uploadAdapter = client.getUploadAdapter();
```

#### 返回值

返回上传适配器；当前平台未提供时返回 `null`。

### getServerUrlsConfig() => ServerUrlsConfig | undefined

#### 说明

获取当前固定服务地址配置；仅在使用 `serviceConfig.serverUrls` 初始化时有值。

#### 调用示例

读取固定服务地址配置

```ts
const serverUrls = client.getServerUrlsConfig();
```

#### 返回值

返回固定服务地址配置；未配置时返回 `undefined`。

### getContactSnapshot() => ContactSnapshot | null

#### 说明

获取当前联系人快照缓存。

#### 调用示例

读取联系人快照

```ts
const snapshot = client.getContactSnapshot();
```

#### 返回值

返回联系人快照；缓存未初始化时返回 `null`。

### addEventHandler(id: EventHandlerId, handlers: EventHandlerMap) => void

#### 说明

注册 ChatClient 事件处理器，用于监听连接、消息、联系人、群组等 SDK 公开事件。

#### 调用示例

监听连接状态变化

```ts
client.addEventHandler('client-events', {
  onConnected: () => console.log('connected'),
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一 ID，用于后续移除。 |
| handlers | `EventHandlerMap` | 事件处理器集合，按需实现对应回调。 |

#### 返回值

注册完成后无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除指定的 ChatClient 事件处理器。

#### 调用示例

移除事件处理器

```ts
client.removeEventHandler('client-events');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 待移除的事件处理器 ID。 |

#### 返回值

移除完成后无返回值。

### use(ManagerCtor: ManagerConstructor<ChatClient, Manager, Key>) => WithManager<this, Key, Manager>

#### 说明

注册一个管理器构造器，并返回带该管理器类型增强的 ChatClient 实例。

#### 调用示例

手动注册管理器

```ts
const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| ManagerCtor | `ManagerConstructor<ChatClient, Manager, Key>` | 管理器构造器。 |

#### 返回值

返回带管理器类型增强的当前 ChatClient 实例。

### sendMessage(message: Message, options: SendMessageOptions) => Promise<Message>

#### 说明

发送消息。消息通常应通过 `ChatManager` 或 `create*Message` 系列方法先构造，再交给此方法发送。

#### 调用示例

发送消息

```ts
const sent = await client.sendMessage(message);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | 待发送的消息对象。 |
| options | `SendMessageOptions` | 可选发送参数，如进度回调等。 |

#### 返回值

返回发送流程处理后的消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 消息发送者缺失、发送者与当前用户不一致，或尝试发送当前不支持的流式消息 | 先通过 ChatManager 的 create*Message 方法创建消息，并确保当前用户与消息 sender.userId 一致 |
| 300 | not_connected | 发送消息时 SDK 未连接到消息服务器 | 等待连接成功后重试 |
| 500 | encode_failed | 消息内容无法编码为协议数据 | 检查消息体、扩展字段和附件信息是否合法 |
| 1200 | MESSAGE_BLOCKED | 第三方内容审核拒绝 | - |
| 215 | USER_MUTED | 用户被禁言 | - |
