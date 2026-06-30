# IM SDK Web API Reference (zh-CN)

本文档由脚本从 JSDoc 自动生成。

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

### getClientResource() => string | null

#### 说明

获取当前连接的设备资源标识。

#### 调用示例

读取当前设备资源标识

```ts
const clientResource = client.getClientResource();
```

#### 返回值

返回当前连接的设备资源标识；未连接或尚未完成登录握手时返回 `null`。

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

### emitConversationListUpdate(reason: ConversationListUpdateReason, reset: boolean) => void

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| reason | `ConversationListUpdateReason` | - |
| reset | `boolean` | - |

## src/types/chat-client.ts

### ServerUrlsConfig

#### 说明

固定服务地址配置。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| restApiUrl | `string` | REST API 基础地址。 |
| wsUrl | `string` | 消息 WebSocket 地址。 |
| syncRestApiUrl | `string` | 会话/联系人同步 REST API 基础地址。 |
| syncWsUrl | `string` | 会话/联系人同步 WebSocket 地址。 |

### ServiceConfig

#### 说明

服务接入配置。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| dnsConfigUrls | `string[]` | DNS_CONFIG 地址列表；配置后仍走 DNS_CONFIG 发现流程。 |
| serverUrls | `ServerUrlsConfig` | 固定服务地址；配置后直连这些地址，不请求 DNS_CONFIG。 |

### ProfileSyncConfig

#### 说明

消息资料回填节流配置。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userInfoWindowMs | `number` | 用户资料回填聚合窗口，单位毫秒。 |
| userInfoBatchSize | `number` | 单次用户资料回填批大小。 |
| groupNamecardWindowMs | `number` | 群名片回填聚合窗口，单位毫秒。 |
| groupNamecardMaxConcurrency | `number` | 群名片回填最大并发数。 |

### SyncConversationListConfig

#### 说明

会话列表同步配置。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| includeEmpty | `boolean` | 是否同步空会话；会话标记固定同步。 |

### InitConfig

#### 说明

ChatClient 初始化配置。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| appKey | `string` | 应用唯一标识，格式为 `org#app`。 |
| enableUserInfoSync | `boolean` | 是否启用用户资料同步增强能力。 |
| enableSyncData | `ReadonlyArray<SyncDataType>` | 登录后自动同步的数据类型。 |
| enableDeliveryReceipt | `boolean` | 是否开启送达回执。开启后，收到单聊消息时 SDK 自动向发送方回送达回执；发送方通过 `onMessageDelivered` 事件得知消息已送达。 |
| syncConversationListConfig | `SyncConversationListConfig` | 会话列表同步配置。 |
| useCustomAttachmentUpload | `boolean` | 是否使用自定义附件上传能力。 |
| useFixedDeviceId | `boolean` | 是否在同一浏览器内复用固定设备标识。 |
| deviceId | `string` | 自定义设备标识；未传时使用 SDK 默认值。 |
| serviceConfig | `ServiceConfig` | 服务接入配置；缺省时使用 SDK 内置 DNS_CONFIG。 |
| useReplacedMessageContents | `boolean` | 内容审核替换后，是否将替换后的消息回给发送方。 |
| customDeviceName | `string` | 自定义设备名称；通常与 `customOsPlatform` 搭配使用。 |
| customOsPlatform | `number` | 自定义平台编号。 |
| uiKitVersion | `string` | UI Kit 版本号，用于上报。 |
| loginExtensionInfo | `string` | 登录自定义扩展信息。当多设备登录策略导致当前设备被踢时，该扩展字符串会传递给被踢设备，最大长度 1024 字符。 |
| managers | `ReadonlyArray<ManagerRegistration<unknown>>` | 初始化时需要自动注册的管理器列表。 |

### AuthContext

#### 说明

登录参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 登录用户 ID。 |
| token | `string` | IM 登录 token。 |

### TokenRenewalResult

#### 说明

IM token 续期结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| token | `string` | 已成功应用的新 IM token。 |
| expireAt | `number` | token 过期时间戳，单位毫秒。 |

### GetRTCTokenInfoParams

#### 说明

RTC token 查询参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| channelName | `string` | RTC 频道名；不传时使用服务端默认频道语义。 |

### RTCTokenInfo

#### 说明

RTC token 信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| appId | `string` | RTC App ID。 |
| rtcToken | `string` | RTC 入会 token。 |
| channelName | `string` | RTC 频道名。 |
| rtcUid | `number` | 当前用户的 RTC UID。 |
| expireAt | `number` | RTC token 过期时间戳，单位毫秒。 |

### RestContext

#### 说明

REST 访问上下文。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| restBaseUrl | `string` | REST 基础地址。 |
| appKey | `string` | 当前应用的 appKey。 |
| userId | `string` | 当前登录用户 ID。 |
| token | `string` | 当前登录 token。 |
| clientResource | `string` | 当前连接的设备资源标识。 |

### DnsHost

#### 说明

DNS Host 信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| protocol | `string` | 地址协议。 |
| domain | `string` | 域名。 |
| ip | `string` | IP 地址。 |
| port | `string | number` | 端口号。 |

### DnsConfig

#### 说明

DNSConfig 响应结构。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| rest | `{ hosts: DnsHost[] }` | REST 服务地址集合。 |
| 'msync-wx' | `{ hosts: DnsHost[] }` | 消息 WebSocket 地址集合。 |
| 'sync-ws' | `{ hosts: DnsHost[] }` | 会话/联系人同步 WebSocket 地址集合。 |
| enableReportLogs | `'true' | 'false'` | 日志上报开关（DNS 下发）。 |

## src/types/connection.ts

### ConnectionEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| state | `ConnectionStatus` | - |
| reason | `ConnectionEventReason` | - |
| attempt | `number` | - |
| maxAttempts | `number` | - |
| isLoginPhase | `boolean` | - |
| isOnline | `boolean` | - |
| errorCode | `number` | - |
| errorMessage | `string` | - |
| timestamp | `number` | - |

### SendTimeoutEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reason | `typeof ConnectionEventReason.SEND_TIMEOUT` | - |
| timestamp | `number` | - |

## src/types/event-system.ts

### EventPayloadMap

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onConnecting | `ConnectionEventPayload` | 正在连接到服务器（含自动重连）。 |
| onConnected | `ConnectionEventPayload` | 成功连接到服务器。 |
| onDisconnected | `ConnectionEventPayload` | 与服务器断开连接。断开原因包括：主动登出、Token 过期、被踢下线、设备超限等。 |
| onReconnectFailed | `ConnectionEventPayload` | 自动重连失败（达到最大重试次数）。 |
| onTokenWillExpire | `TokenLifecycleEventPayload` | Token 即将过期（约 80% 生命周期时触发）。应在此时获取新 Token 并调用 renewToken。 |
| onTokenExpired | `TokenLifecycleEventPayload` | Token 已过期，需要重新登录。 |
| onOfflineMessageSyncStart | `undefined` | 开始拉取离线消息。 |
| onOfflineMessageSyncFinish | `undefined` | 离线消息拉取完成。 |
| onMessage | `Message` | 收到新消息。
触发时机：有新消息到达（含单聊、群聊、聊天室）。
接收方：消息接收方（含发送方的其他设备）。 |
| onStreamMessage | `StreamMessage` | 流式消息更新。
触发时机：流式消息（如 AI 生成内容）有增量更新。
接收方：消息接收方。 |
| onConversationListUpdate | `ConversationListUpdatePayload` | 会话列表有更新。事件载荷始终包含当前完整且已排序的 ConversationItem 快照；需要保留业务本地字段时，可结合 patch.reset、patch.upserted、patch.removed 与 patch.orderChanged 做增量合并。 |
| onMessageRead | `ReadonlyArray<MessageReadEventPayload>` | 消息已读回执列表。
触发时机：对方发送一条或多条消息已读回执。
接收方：消息的原始发送方。 |
| onMessageDelivered | `MessageDeliveredEventPayload` | 消息送达回执。
触发时机：接收方 SDK 自动回送达回执后，发送方收到此事件。
接收方：消息的原始发送方。 |
| onConversationRead | `ConversationReadEventPayload` | 会话已读回执。
触发时机：对方标记整个会话为已读。
接收方：单聊对方（群聊不触发此事件）。 |
| onMessageRecalled | `MessageRecalledEventPayload` | 消息被撤回。
触发时机：发送方撤回消息，或群主/管理员撤回他人消息。
接收方：会话中的所有成员（含撤回者的其他设备）。 |
| onMessageUpdated | `MessageUpdatedEventPayload` | 消息被编辑。
触发时机：发送方编辑已发送的消息。
接收方：会话中的所有成员（含编辑者的其他设备）。 |
| onReactionChanged | `ReactionChangedEventPayload` | 消息 Reaction 变更。
触发时机：有成员对消息添加或移除 Reaction。
接收方：会话中的所有成员（仅单聊和群聊）。 |
| onPinnedMessageChanged | `PinnedMessageChangedEventPayload` | 消息置顶状态变更。
触发时机：有成员置顶或取消置顶消息。
接收方：会话中的所有成员。 |
| onChatThreadCreated | `ChatThreadCreatedEventPayload` | ChatThread 创建事件。接收方：子区所属群组的所有成员。 |
| onChatThreadDestroyed | `ChatThreadDestroyedEventPayload` | ChatThread 解散事件。接收方：子区所属群组的所有成员。 |
| onChatThreadUpdated | `ChatThreadUpdatedEventPayload` | ChatThread 更新事件。修改子区名称，或子区中添加、撤销回复消息时触发。接收方：子区所属群组的所有成员。 |
| onChatThreadUserRemoved | `ChatThreadUserRemovedEventPayload` | 当前登录用户被群主或群管理员移出 ChatThread。接收方：被移出的当前登录用户。 |
| onMultiDeviceContact | `MultiDeviceContactEvent` | 联系人相关多设备事件。
触发时机：当前用户在其他设备上执行联系人操作（添加/删除/黑名单等）。
接收方：当前用户的其他在线设备。 |
| onMultiDeviceGroup | `MultiDeviceGroupEvent` | 群组相关多设备事件。
触发时机：当前用户在其他设备上执行群组操作。
接收方：当前用户的其他在线设备。 |
| onMultiDeviceThread | `MultiDeviceThreadEvent` | Thread 相关多设备事件。
触发时机：当前用户在其他设备上执行 Thread 操作。
接收方：当前用户的其他在线设备。 |
| onMultiDeviceConversation | `MultiDeviceConversationEvent` | 会话相关多设备事件。
触发时机：当前用户在其他设备上执行会话操作（删除/置顶/标记/免打扰等）。
接收方：当前用户的其他在线设备。 |
| onMultiDeviceMessageRemoved | `MultiDeviceMessageRemovedEvent` | 消息删除多设备事件。
触发时机：当前用户在其他设备上删除漫游消息。
接收方：当前用户的其他在线设备。 |
| onSyncDataStart | `SyncDataStartPayload` | 自动数据同步开始。 |
| onSyncDataFinished | `SyncDataFinishedPayload` | 自动数据同步完成。 |
| onPresenceStatusChange | `ReadonlyArray<PresenceState>` | 订阅的用户在线状态变更。
触发时机：已订阅的用户在线状态发生变化。
接收方：订阅方。 |
| onContactInvited | `ContactRosterEventPayload` | 收到好友请求。
触发时机：其他用户向当前用户发送好友请求。
接收方：被邀请方。 |
| onContactDeleted | `ContactRosterEventPayload` | 被对方删除联系人。
触发时机：对方将当前用户从联系人列表中删除。
接收方：被删除方。 |
| onContactAdded | `ContactRosterEventPayload` | 新增联系人。
触发时机：好友关系建立成功。
接收方：双方。 |
| onContactRefuse | `ContactRosterEventPayload` | 好友请求被拒绝。
触发时机：对方拒绝了当前用户的好友请求。
接收方：请求发起方。 |
| onContactAgreed | `ContactRosterEventPayload` | 好友请求被接受。
触发时机：对方接受了当前用户的好友请求。
接收方：请求发起方。 |
| onContactInfoUpdated | `ContactInfoUpdatedEvent` | 联系人信息变更。
触发时机：已订阅的联系人信息发生变化。
接收方：订阅方。 |
| onOwnInfoUpdated | `UserInfo` | 自己的用户属性被修改。
触发时机：当前用户的属性被修改（含其他设备修改）。
接收方：当前用户所有设备。 |
| onUserInfoUpdated | `ReadonlyArray<UserInfo>` | 订阅的用户属性变更。
触发时机：已订阅的用户属性发生变化。
接收方：订阅方。 |
| onInvitationReceived | `GroupInvitationReceivedEventPayload` | 收到入群邀请。接收方：被邀请者。 |
| onRequestToJoinReceived | `GroupRequestToJoinReceivedEventPayload` | 收到入群申请。接收方：群主和管理员。 |
| onRequestToJoinAccepted | `GroupRequestToJoinAcceptedEventPayload` | 入群申请被同意。接收方：申请者。 |
| onRequestToJoinDeclined | `GroupRequestToJoinDeclinedEventPayload` | 入群申请被拒绝。接收方：申请者。 |
| onInvitationAccepted | `GroupInvitationAcceptedEventPayload` | 入群邀请被接受。接收方：邀请发起者。 |
| onInvitationDeclined | `GroupInvitationDeclinedEventPayload` | 入群邀请被拒绝。接收方：邀请发起者。 |
| onUserRemoved | `GroupUserRemovedEventPayload` | 被移出群组。接收方：被移出者 + 群内所有成员。 |
| onGroupDestroyed | `GroupDestroyedEventPayload` | 群组被解散。接收方：群内所有成员。 |
| onAutoAcceptInvitationFromGroup | `GroupAutoAcceptInvitationEventPayload` | 自动接受入群邀请（群设置为不需要确认时）。接收方：被邀请者。 |
| onMuteListAdded | `GroupMuteListAddedEventPayload` | 成员被禁言。接收方：群内所有成员。 |
| onMuteListRemoved | `GroupMuteListRemovedEventPayload` | 成员被解除禁言。接收方：群内所有成员。 |
| onAllowListAdded | `GroupAllowListAddedEventPayload` | 成员加入白名单。接收方：群内所有成员。 |
| onAllowListRemoved | `GroupAllowListRemovedEventPayload` | 成员移出白名单。接收方：群内所有成员。 |
| onAllMemberMuteStateChanged | `GroupAllMemberMuteStateChangedEventPayload` | 全员禁言状态变更。接收方：群内所有成员。 |
| onAdminAdded | `GroupAdminAddedEventPayload` | 新增管理员。接收方：群内所有成员。 |
| onAdminRemoved | `GroupAdminRemovedEventPayload` | 移除管理员。接收方：群内所有成员。 |
| onOwnerChanged | `GroupOwnerChangedEventPayload` | 群主变更。接收方：群内所有成员。 |
| onMembersJoined | `GroupMembersJoinedEventPayload` | 新成员加入群组。接收方：群内所有成员。 |
| onMembersExited | `GroupMembersExitedEventPayload` | 成员退出群组。接收方：群内所有成员。 |
| onAnnouncementChanged | `GroupAnnouncementChangedEventPayload` | 群公告变更。接收方：群内所有成员。 |
| onSharedFileAdded | `GroupSharedFileAddedEventPayload` | 新增群共享文件。接收方：群内所有成员。 |
| onSharedFileDeleted | `GroupSharedFileDeletedEventPayload` | 删除群共享文件。接收方：群内所有成员。 |
| onGroupInfoChanged | `GroupInfoChangedEventPayload` | 群信息变更。接收方：群内所有成员。 |
| onGroupDisabledChanged | `GroupDisabledChangedEventPayload` | 群组禁用状态变更。接收方：群内所有成员。 |
| onGroupMemberAttributeChanged | `GroupMemberAttributeChangedEventPayload` | 群成员自定义属性变更。接收方：群内所有成员。 |
| onUserGroupNamecardUpdated | `GroupUserGroupNamecardUpdatedEventPayload` | 群名片变更。接收方：群内所有成员。 |
| '__chatroom:onChatRoomDestroyed' | `ChatRoomDestroyedEventPayload` | 聊天室被销毁。接收方：聊天室内所有成员。 |
| '__chatroom:onMembersJoined' | `ChatRoomMembersJoinedEventPayload` | 成员加入聊天室。接收方：聊天室内所有成员。 |
| '__chatroom:onMembersExited' | `ChatRoomMembersExitedEventPayload` | 成员离开聊天室。接收方：聊天室内所有成员。 |
| '__chatroom:onRemovedFromChatRoom' | `ChatRoomRemovedFromChatRoomEventPayload` | 被移出聊天室。接收方：被移出者 + 聊天室内所有成员。 |
| '__chatroom:onMuteListAdded' | `ChatRoomMuteListAddedEventPayload` | 成员被禁言。接收方：聊天室内所有成员。 |
| '__chatroom:onMuteListRemoved' | `ChatRoomMuteListRemovedEventPayload` | 成员被解除禁言。接收方：聊天室内所有成员。 |
| '__chatroom:onAllowListAdded' | `ChatRoomAllowListAddedEventPayload` | 成员加入白名单。接收方：聊天室内所有成员。 |
| '__chatroom:onAllowListRemoved' | `ChatRoomAllowListRemovedEventPayload` | 成员移出白名单。接收方：聊天室内所有成员。 |
| '__chatroom:onAllMemberMuteStateChanged' | `ChatRoomAllMemberMuteStateChangedEventPayload` | 全员禁言状态变更。接收方：聊天室内所有成员。 |
| '__chatroom:onAdminAdded' | `ChatRoomAdminAddedEventPayload` | 新增管理员。接收方：聊天室内所有成员。 |
| '__chatroom:onAdminRemoved' | `ChatRoomAdminRemovedEventPayload` | 移除管理员。接收方：聊天室内所有成员。 |
| '__chatroom:onOwnerChanged' | `ChatRoomOwnerChangedEventPayload` | 聊天室主变更。接收方：聊天室内所有成员。 |
| '__chatroom:onAnnouncementChanged' | `ChatRoomAnnouncementChangedEventPayload` | 聊天室公告变更。接收方：聊天室内所有成员。 |
| '__chatroom:onChatRoomInfoChanged' | `ChatRoomInfoChangedEventPayload` | 聊天室信息变更。接收方：聊天室内所有成员。 |
| '__chatroom:onAttributesUpdate' | `ChatRoomAttributesUpdateEventPayload` | 聊天室自定义属性更新。接收方：聊天室内所有成员。 |
| '__chatroom:onAttributesRemoved' | `ChatRoomAttributesRemovedEventPayload` | 聊天室自定义属性删除。接收方：聊天室内所有成员。 |

## src/platform/types.ts

### PlatformAdapterError

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| code | `PlatformErrorCode` | - |
| stage | `PlatformErrorStage` | - |
| retryable | `boolean` | - |
| details | `Record<string, unknown>` | - |

### PlatformErrorOptions

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| code | `PlatformErrorCode` | - |
| stage | `PlatformErrorStage` | - |
| retryable | `boolean` | - |
| details | `Record<string, unknown>` | - |

### RequestConfig

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| method | `HttpMethod` | - |
| headers | `Record<string, string>` | - |
| body | `string | Record<string, unknown> | Uint8Array` | - |
| responseType | `'json' | 'text' | 'arraybuffer'` | - |
| timeoutMs | `number` | - |
| signal | `AbortSignal` | - |

### RequestResponse

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| status | `number` | - |
| headers | `Record<string, string>` | - |
| data | `TData` | - |

### RequestAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### UploadSource

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| sourceType | `UploadSourceType` | - |
| file | `File | Blob` | - |
| path | `string` | - |
| uri | `string` | - |
| name | `string` | - |
| mimeType | `string` | - |
| size | `number` | - |

### ImageInfoResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| width | `number` | - |
| height | `number` | - |
| mimeType | `string` | - |
| fileSize | `number` | - |
| isGif | `boolean` | - |

### ImageGenerateOptions

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| maxShortEdge | `number` | - |
| quality | `number` | - |

### GeneratedImageResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| source | `UploadSource` | - |
| width | `number` | - |
| height | `number` | - |
| fileName | `string` | - |
| fileType | `string` | - |
| fileSize | `number` | - |
| webFile | `File` | - |

### ImageProcessor

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### UploadProgress

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| loaded | `number` | - |
| total | `number` | - |
| percent | `number` | - |

### UploadConfig

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| headers | `Record<string, string>` | - |
| source | `UploadSource` | - |
| fields | `Record<string, string>` | - |
| timeoutMs | `number` | - |
| signal | `AbortSignal` | - |
| onProgress | `(progress: UploadProgress) => void` | - |

### UploadResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| status | `number` | - |
| body | `string` | - |

### UploadAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### SocketConnectConfig

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| protocols | `string | string[]` | - |

### SocketLike

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| readyState | `number` | - |

### SocketAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### RuntimeAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### StorageAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### ProtoAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |

### PlatformAdapter

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| platform | `RuntimePlatform` | - |
| request | `RequestAdapter` | - |
| upload | `UploadAdapter` | - |
| socket | `SocketAdapter` | - |
| runtime | `RuntimeAdapter` | - |
| proto | `ProtoAdapter` | - |
| storage | `StorageAdapter` | - |
| imageProcessor | `ImageProcessor` | - |

### PlatformCapability

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| request | `boolean` | - |
| upload | `boolean` | - |
| socket | `boolean` | - |
| runtime | `boolean` | - |
| proto | `boolean` | - |
| storage | `boolean` | - |
| imageProcessor | `boolean` | - |

### PlatformAdapterProfile

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| platformId | `RuntimePlatform` | - |
| capability | `PlatformCapability` | - |

### PlatformAdapterOverrides

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| request | `RequestAdapter` | - |
| upload | `UploadAdapter` | - |
| socket | `SocketAdapter` | - |
| runtime | `RuntimeAdapter` | - |
| proto | `ProtoAdapter` | - |
| storage | `StorageAdapter` | - |
| imageProcessor | `ImageProcessor` | - |

### CreatePlatformAdapterOptions

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| prefer | `RuntimePlatform` | - |
| overrides | `PlatformAdapterOverrides | PlatformAdapterOverridesResolver` | - |

## src/cache/cache-types.ts

### ConversationListUpdatePatch

#### 说明

会话列表更新补丁。简单 UI 可以直接使用 `ConversationListUpdatePayload.items`，只有需要保留业务本地字段或做精细合并时才需要读取该补丁。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reset | `boolean` | 是否为一次整体基线重置。为 `true` 时，表示 SDK 重新建立或替换了会话列表基线，例如登录后加载缓存、服务端全量同步、fallback 到全量刷新等。业务如果自己维护带本地字段的列表，应以 `items` 作为当前权威快照，按会话 key 重新挂回本地字段；简单 UI 直接使用 `items` 即可。 |
| upserted | `ReadonlyArray<ConversationItem>` | 本次新增或 SDK 字段发生变化的会话。 |
| removed | `ReadonlyArray<ConversationIdentifier>` | 本次移除的会话标识。 |
| affectedKeys | `ReadonlyArray<string>` | 本次受影响的会话 key，格式为 `${conversationType}:${conversationId}`。 |
| orderChanged | `boolean` | 本次是否改变了会话列表顺序。可能只有排序变化而没有 `upserted` 内容变化，例如置顶、最后消息时间或服务端排序基线变化。按补丁合并的业务在该值为 `true` 时，应按 `items` 中的顺序重排本地列表；直接使用 `items` 的业务无需额外处理。 |

### ConversationListUpdatePayload

#### 说明

`onConversationListUpdate` 事件载荷。`items` 始终是 SDK 当前完整且已排序的 `ConversationItem` 快照；`patch` 用于业务按增量合并并保留自定义本地字段。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| version | `number` | 会话列表快照版本号，每次有效派发递增，可用于忽略旧事件。 |
| items | `ReadonlyArray<ConversationItem>` | 当前完整且已排序的会话列表快照。简单 UI 推荐直接用该字段刷新列表。 |
| reason | `ConversationListUpdateReason` | 本次列表更新原因。 |
| patch | `ConversationListUpdatePatch` | 本次变化补丁，便于业务保留本地字段。 |

## src/managers/chat-manager.ts

### ChatManager

### sendMessage(message: Message, options: SendMessageOptions) => Promise<Message>

#### 说明

发送一条已创建的消息。文本、图片、文件、语音、视频、位置、命令、自定义和合并消息均通过该入口发送。

事件触发：接收方（含发送方的其他设备）会收到 `onMessage` 事件。
附件类消息（图片/文件/语音/视频）会先自动上传到服务器，上传成功后再发送。

#### 调用示例

```ts
const message = chatManager.createTextMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  content: 'hello',
});
const sent = await chatManager.sendMessage(message);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | 待发送消息对象。 |
| options | `SendMessageOptions` | 发送过程回调。 |

#### 返回值

发送成功后的消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 消息发送者缺失、发送者与当前用户不一致，或尝试发送当前不支持的流式消息 | 先通过 ChatManager 的 create*Message 方法创建消息，并确保当前用户与消息 sender.userId 一致 |
| 300 | not_connected | 发送消息时 SDK 未连接到消息服务器 | 等待连接成功后重试 |
| 500 | encode_failed | 消息内容无法编码为协议数据 | 检查消息体、扩展字段和附件信息是否合法 |
| 1200 | MESSAGE_BLOCKED | 第三方内容审核拒绝 | - |
| 215 | USER_MUTED | 用户被禁言 | - |

### createTextMessage(params: CreateTextMessageParams) => Message

#### 说明

创建文本消息对象。创建后需调用 {@link ChatManager.sendMessage} 发送。

#### 调用示例

```ts
const message = chatManager.createTextMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  content: 'hello',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateTextMessageParams` | 文本消息创建参数。 |

#### 返回值

文本消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话 ID、会话类型、文本内容、扩展字段或定向接收配置非法 | 传入合法的 conversationId、conversationType 和非空 content；receiverList 与 needGroupReadReceipt 仅用于群聊 |

### createImageMessage(params: CreateImageMessageParams) => Message

#### 说明

创建图片消息对象。支持传入本地文件或远程图片地址。

#### 调用示例

```ts
const message = chatManager.createImageMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  data: imageFile,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateImageMessageParams` | 图片消息创建参数。 |

#### 返回值

图片消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或图片消息缺少 data/originalUrl，或文件、宽高、文件大小字段非法 | 至少传入 data 或 originalUrl，并确保图片元数据为合法类型和值 |

### createFileMessage(params: CreateFileMessageParams) => Message

#### 说明

创建文件消息对象。支持传入本地文件或远程文件地址。

#### 调用示例

```ts
const message = chatManager.createFileMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  data: file,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateFileMessageParams` | 文件消息创建参数。 |

#### 返回值

文件消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或文件消息缺少 data/originalUrl，或文件名、文件类型、文件大小字段非法 | 至少传入 data 或 originalUrl，并确保文件元数据合法 |

### createVoiceMessage(params: CreateVoiceMessageParams) => Message

#### 说明

创建语音消息对象。支持传入本地语音文件或远程语音地址。

#### 调用示例

```ts
const message = chatManager.createVoiceMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  data: voiceFile,
  duration: 3,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateVoiceMessageParams` | 语音消息创建参数。 |

#### 返回值

语音消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或语音消息缺少 data/originalUrl，或 duration、文件信息非法 | 至少传入 data 或 originalUrl，并传入大于 0 的 duration |

### createVideoMessage(params: CreateVideoMessageParams) => Message

#### 说明

创建视频消息对象。支持传入本地视频文件或远程视频地址。

#### 调用示例

```ts
const message = chatManager.createVideoMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  data: videoFile,
  duration: 12,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateVideoMessageParams` | 视频消息创建参数。 |

#### 返回值

视频消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或视频消息缺少 data/originalUrl，或 duration、宽高、文件信息非法 | 至少传入 data 或 originalUrl，并传入大于 0 的 duration |

### createLocationMessage(params: CreateLocationMessageParams) => Message

#### 说明

创建位置消息对象。

#### 调用示例

```ts
const message = chatManager.createLocationMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  latitude: 39.9042,
  longitude: 116.4074,
  address: 'Beijing',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateLocationMessageParams` | 位置消息创建参数。 |

#### 返回值

位置消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或经纬度、地址、建筑名称字段非法 | 传入合法的 conversationId、conversationType、latitude 和 longitude |

### createCmdMessage(params: CreateCmdMessageParams) => Message

#### 说明

创建命令消息对象。命令消息通常用于业务自定义控制信令。

#### 调用示例

```ts
const message = chatManager.createCmdMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  action: 'typing',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateCmdMessageParams` | 命令消息创建参数。 |

#### 返回值

命令消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或 action 为空 | 传入合法的 conversationId、conversationType 和非空 action |

### createCustomMessage(params: CreateCustomMessageParams) => Message

#### 说明

创建自定义消息对象。可通过 `event` 与 `params` 承载业务自定义内容。

#### 调用示例

```ts
const message = chatManager.createCustomMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  event: 'gift',
  params: { id: 'rose' },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateCustomMessageParams` | 自定义消息创建参数。 |

#### 返回值

自定义消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或 event、params 字段非法 | 传入合法的 conversationId、conversationType 和非空 event；params 使用字符串键值 |

### createCombineMessage(params: CreateCombineMessageParams) => Message

#### 说明

创建合并消息对象，用于发送聊天记录合集。

#### 调用示例

```ts
const message = chatManager.createCombineMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  title: '聊天记录',
  summary: '3 条消息',
  messageList: selectedMessages,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateCombineMessageParams` | 合并消息创建参数。 |

#### 返回值

合并消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或 title、summary、messageList 为空，或合并消息条目格式非法 | 传入合法的标题、摘要和 1 到 300 条可合并消息 |
| 4 | combine_level_exceeded | 合并消息嵌套层级超过 SDK 限制 | 减少合并消息嵌套层级后重试 |
| 500 | combine_encode_failed | 合并消息内容无法编码 | 检查被合并消息的消息体和扩展字段是否合法 |

### getConversationList(filter: ConversationFilter) => ReadonlyArray<ConversationItem>

#### 说明

从本地会话列表缓存中获取会话，支持通过 filter 过滤。

#### 调用示例

```ts
// 获取全部会话
const all = chatManager.getConversationList();
// 获取置顶会话
const pinned = chatManager.getConversationList({ isPinned: true });
// 获取指定标记的会话
const marked = chatManager.getConversationList({ mark: 3 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| filter | `ConversationFilter` | 可选过滤条件。 |

#### 返回值

匹配条件的会话数组。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 分页游标、pageSize 或 includeEmptyConversations 类型非法 | 使用 SDK 上一次返回的 cursor，并确保 pageSize 为正整数、includeEmptyConversations 为布尔值 |

### setCurrentConversation(params: ConversationLocator) => void

#### 说明

设置当前正在浏览的会话。设置后，该会话收到在线消息时 SDK 仍会更新最后消息和列表排序，但不会累加本地未读数。该状态只保存在当前 SDK 会话内存中，切换页面或关闭会话时应调用 `resetCurrentConversation()`。

#### 调用示例

```ts
chatManager.setCurrentConversation({
  conversationId: 'user_2',
  conversationType: 'singleChat',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ConversationLocator` | 当前正在浏览的会话定位参数。 |

#### 返回值

无返回值。

### resetCurrentConversation() => void

#### 说明

重置当前正在浏览的会话。重置后，收到在线消息会按默认规则累加对应会话的本地未读数。

#### 调用示例

```ts
chatManager.resetCurrentConversation();
```

#### 返回值

无返回值。

### getCurrentConversation() => ConversationLocator | null

#### 说明

获取当前正在浏览的会话；未设置时返回 `null`。

#### 调用示例

```ts
const current = chatManager.getCurrentConversation();
```

#### 返回值

当前正在浏览的会话定位参数，未设置时为 `null`。

### refreshSessionList(params: RefreshSessionListParams) => Promise<ReadonlyArray<ConversationItem>>

#### 说明

主动向服务端刷新会话列表，并返回刷新后的公开会话列表。

#### 调用示例

```ts
const conversations = await chatManager.refreshSessionList({ includeEmpty: true });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `RefreshSessionListParams` | 刷新会话列表的选项。 |

#### 返回值

刷新后的公开会话列表。

### deleteConversation(params: DeleteConversationParams) => Promise<ConversationMutationResult>

#### 说明

删除指定会话，可选择同时删除服务端漫游消息。
删除成功后，SDK 会同步删除本地会话列表缓存；如果本地会话列表发生变化，会派发 `onConversationListUpdate`，`reason` 为 `local`。

#### 调用示例

```ts
await chatManager.deleteConversation({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  deleteRoamingMessages: false,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `DeleteConversationParams` | 删除会话参数。 |

#### 返回值

会话删除结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId、conversationType 或 deleteRoamingMessages 参数非法 | 传入合法会话 ID、会话类型，并确保 deleteRoamingMessages 为布尔值 |

### setConversationPinned(params: SetConversationPinnedParams) => Promise<ConversationMutationResult>

#### 说明

设置或取消设置会话置顶状态。

#### 调用示例

```ts
await chatManager.setConversationPinned({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  pinned: true,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SetConversationPinnedParams` | 会话置顶参数。 |

#### 返回值

会话置顶变更结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId、conversationType 或 pinned 参数非法 | 传入合法会话 ID、会话类型，并确保 pinned 为布尔值 |

### addConversationMark(params: ConversationMarkParams) => Promise<ConversationMarkMutationResult>

#### 说明

为单个或多个会话添加标记。

#### 调用示例

```ts
await chatManager.addConversationMark({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  mark: 0,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ConversationMarkParams` | 会话标记参数。 |

#### 返回值

会话标记添加结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | mark 不是 0 到 19 之间的整数，或会话目标列表非法 | 传入合法 mark，并确保 conversations 为非空数组或传入单个合法会话 |

### removeConversationMark(params: ConversationMarkParams) => Promise<ConversationMarkMutationResult>

#### 说明

从单个或多个会话移除标记。

#### 调用示例

```ts
await chatManager.removeConversationMark({
  conversations: [
    { conversationId: 'user_2', conversationType: 'singleChat' },
  ],
  mark: 0,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ConversationMarkParams` | 会话标记参数。 |

#### 返回值

会话标记移除结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | mark 不是 0 到 19 之间的整数，或会话目标列表非法 | 传入合法 mark，并确保 conversations 为非空数组或传入单个合法会话 |

### clearAllMessagesAndConversations() => Promise<void>

#### 说明

清空当前用户的所有会话和服务端漫游消息。
清空成功后，SDK 会同步清空本地 conversation/session-list 缓存；如果本地会话列表发生变化，会派发 `onConversationListUpdate`，`reason` 为 `local`。

#### 调用示例

```ts
await chatManager.clearAllMessagesAndConversations();
```

#### 返回值

清空完成后 resolve。

### pinMessage(params: PinMessageParams) => Promise<void>

#### 说明

在指定会话中置顶一条消息。

事件触发：会话中的所有成员会收到 `onPinnedMessageChanged` 事件（operation='pin'）。

#### 调用示例

```ts
await chatManager.pinMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  messageId: 'msg_1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `PinMessageParams` | 置顶消息参数。 |

#### 返回值

置顶消息结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | pin_msg_id_illegal | param pin_msg_id illegal, please check it! | - |
| 4 | pin_message_limit | 置顶消息数量达到上限 | - |
| 110 | pin_message_not_found | 待置顶消息不存在 | - |

### unpinMessage(params: PinMessageParams) => Promise<void>

#### 说明

取消置顶指定会话中的一条消息。

事件触发：会话中的所有成员会收到 `onPinnedMessageChanged` 事件（operation='unpin'）。

#### 调用示例

```ts
await chatManager.unpinMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  messageId: 'msg_1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `PinMessageParams` | 取消置顶消息参数。 |

#### 返回值

取消置顶消息结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | pin_msg_id_illegal | param pin_msg_id illegal, please check it! | - |
| 110 | pin_message_not_found | 待取消置顶消息不存在 | - |

### getPinnedMessageList(params: GetPinnedMessageListParams) => Promise<PinnedMessageListResult>

#### 说明

获取指定会话内的置顶消息列表。该接口不分页，不接收 messageId，最多返回 20 条。

#### 调用示例

```ts
const result = await chatManager.getPinnedMessageList({
  conversationId: 'group_1',
  conversationType: 'groupChat',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetPinnedMessageListParams` | 会话定位参数。 |

#### 返回值

置顶消息列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 111 | operation_unsupported | 当前服务端不支持获取置顶消息列表 | - |
| 110 | pin_message_not_found | 置顶消息不存在 | - |

### addEventHandler(id: EventHandlerId, handlers: ChatEventHandlerMap) => void

#### 说明

注册消息域事件处理器。

#### 调用示例

```ts
chatManager.addEventHandler('chat-page', {
  onMessage: event => {
    console.log(event.messages);
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一标识。 |
| handlers | `ChatEventHandlerMap` | 消息事件处理器集合。 |

#### 返回值

无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除已注册的消息域事件处理器。

#### 调用示例

```ts
chatManager.removeEventHandler('chat-page');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一标识。 |

#### 返回值

无返回值。

### markConversationRead(params: MarkConversationReadParams) => Promise<void>

#### 说明

将指定会话标记为已读。

事件触发：单聊对方会收到 `onConversationRead` 事件；本地调用方不会收到该事件。群聊仅清除服务端未读数，不触发对方事件。
标记成功后，SDK 会同步清空本地会话列表中的未读数；如果本地会话列表发生变化，本地调用方会收到 `onConversationListUpdate`，`reason` 为 `local`。

#### 调用示例

```ts
await chatManager.markConversationRead({
  conversationId: 'user_2',
  conversationType: 'singleChat',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `MarkConversationReadParams` | 会话定位参数。 |

#### 返回值

标记完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId 为空或 conversationType 非法 | 传入合法会话 ID，并使用 singleChat、groupChat 或 chatRoom |
| 201 | not_login | 未登录 | - |
| 300 | not_connected | 未连接服务器 | - |
| 500 | message_invalid | 会话中无消息 | - |

### markMessageRead(params: MarkMessageReadParams) => Promise<void>

#### 说明

批量标记消息已读。仅能对同一个会话内收到的单聊或群聊消息发送。

事件触发：消息的原始发送方会收到 `onMessageRead` 事件；本地调用方不会收到该事件。
注意：群聊已读回执有效期为 3 天，最多支持 200 人的群。需要在控制台开通。

#### 调用示例

```ts
await chatManager.markMessageRead({
  messages: [{ message }],
});

await chatManager.markMessageRead({
  messages: [
    { message: groupMessage1, ackContent: 'read-1' },
    { message: groupMessage2, ackContent: 'read-2' },
  ],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `MarkMessageReadParams` | 批量消息已读参数。 |

#### 返回值

全部已读回执发送完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messages 为空、消息缺少服务端 ID 或会话 ID、消息不是收到的单聊/群聊消息、消息不属于同一会话，或单聊消息传入 ackContent | 传入非空 messages，确保每条都是收到的 singleChat 或 groupChat 消息，包含 msgServerId 与 conversationId，且全部属于同一会话；ackContent 仅用于 groupChat |
| 110 | invalid_direction | 只能对接收的消息发送已读回执 | - |
| 300 | not_connected | 未连接服务器 | - |

### recallMessage(params: RecallMessageParams) => Promise<ChatActionResult>

#### 说明

撤回一条已发送消息。

事件触发：会话中的所有成员（含撤回者的其他设备）会收到 `onMessageRecalled` 事件。
注意：默认 2 分钟内可撤回（可在控制台配置最长 7 天）；群主/管理员可撤回他人消息；除 CMD 外所有类型均支持。

#### 调用示例

```ts
const result = await chatManager.recallMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  messageId: 'msg_1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `RecallMessageParams` | 撤回消息参数。 |

#### 返回值

撤回动作结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId、conversationType 或 messageId 参数非法 | 传入合法会话定位参数和待撤回消息 ID |
| 110 | message_invalid | 消息无效或未发送成功 | - |
| 201 | not_login | 未登录 | - |
| 300 | not_connected | 未连接服务器 | - |
| 504 | recall_time_limit | 超过撤回时间限制 | - |
| 505 | recall_disabled | 撤回功能未开通 | - |

### modifyMessage(params: UpdateMessageParams) => Promise<Message>

#### 说明

编辑一条消息内容。当前仅支持文本消息和自定义消息。

事件触发：会话中的所有成员（含编辑者的其他设备）会收到 `onMessageUpdated` 事件。
注意：最多编辑 10 次；无时间限制；编辑后消息漫游有效期重新计算；需要在控制台开通。

#### 调用示例

```ts
const updated = await chatManager.modifyMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  messageId: 'msg_1',
  message: {
    type: 'text',
    body: { content: 'updated text' },
    ext: {},
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UpdateMessageParams` | 编辑消息参数。 |

#### 返回值

编辑后的消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId、conversationType 或 messageId 参数非法 | 传入合法会话定位参数和待编辑消息 ID |
| 111 | unsupported_type | 当前仅支持编辑文本消息和自定义消息 | 仅传入 type 为 text 或 custom 的消息内容 |
| 110 | message_invalid | 消息无效 | - |
| 111 | unsupported_type | 当前仅支持编辑文本消息和自定义消息 | 仅传入 type 为 text 或 custom 的消息内容 |
| 201 | not_login | 未登录 | - |
| 210 | permission_denied | 无权编辑该消息 | - |
| 300 | not_connected | 未连接服务器 | - |
| 511 | edit_failed | 消息编辑失败 | - |

### getHistoryMessages(params: GetHistoryMessagesParams) => Promise<MessageHistoryPage>

#### 说明

从服务端获取历史消息。

#### 调用示例

```ts
const page = await chatManager.getHistoryMessages({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  pageSize: 20,
  searchDirection: 'up',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetHistoryMessagesParams` | 历史消息查询参数。 |

#### 返回值

历史消息分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId、conversationType 或 pageSize 参数非法 | 传入合法会话定位参数，并确保 pageSize 为正整数 |
| 505 | service_not_enabled | this appKey not open message roaming | - |
| 110 | page_size_exceeded | 分页参数超限 | - |

### searchMessages(params: SearchMessagesParams) => Promise<SearchMessagesResult>

#### 说明

服务端消息搜索，根据关键词和过滤条件搜索历史消息。需要在 Console 开通 Message Search 服务。

#### 调用示例

```ts
const result = await chatManager.searchMessages({
  option: { keywordList: ['hello'] },
  pageNum: 1,
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SearchMessagesParams` | 搜索参数。 |

#### 返回值

搜索结果。

### downloadAttachment(params: DownloadAttachmentParams) => Promise<MessageAttachmentDownloadResult>

#### 说明

下载消息附件，适用于图片、语音、视频和文件等附件消息。

#### 调用示例

```ts
const attachment = await chatManager.downloadAttachment({ message });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `DownloadAttachmentParams` | 附件下载参数。 |

#### 返回值

附件下载结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 401 | validation_invalid | 消息不包含可下载附件，或附件 URL 缺失 | 仅对包含远程附件地址的图片、语音、视频或文件消息调用 |
| 400 | not_found | 附件不存在 | - |
| 401 | invalid | 附件无效或消息类型不支持下载 | - |
| 403 | download_failed | 附件下载失败 | - |
| 407 | expired | 附件已过期 | - |

### downloadAndParseCombineMessage(params: DownloadCombineMessageInput) => Promise<ReadonlyArray<Message>>

#### 说明

下载并解析合并消息内容，返回合并消息中的子消息列表。

#### 调用示例

```ts
const messages = await chatManager.downloadAndParseCombineMessage({ message: combineMessage });

const messagesFromBody = await chatManager.downloadAndParseCombineMessage({
  url: combineMessage.body.url,
  secret: combineMessage.body.secret,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `DownloadCombineMessageInput` | 合并消息解析参数；可传完整合并消息，也可传合并消息体中的最小下载参数。 |

#### 返回值

合并消息中的子消息列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 传入消息不是合并消息，或合并消息/最小下载参数缺少下载地址 | 传入 type 为 combine 且包含有效 url 的消息，或直接传入合并消息体中的有效 url/secret |
| 110 | invalid_param | 消息为空 | - |
| 500 | invalid_type | 消息不是合并消息类型 | - |
| 401 | parse_failed | 合并消息解析失败 | - |
| 403 | download_failed | 合并消息下载失败 | - |

### removeHistoryMessages(params: RemoveHistoryMessagesParams) => Promise<void>

#### 说明

删除服务端历史消息，可按消息 ID 列表或时间戳删除。

#### 调用示例

```ts
await chatManager.removeHistoryMessages({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  messageIds: ['msg_1'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `RemoveHistoryMessagesParams` | 删除历史消息参数。 |

#### 返回值

删除完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 缺少 messageIds/beforeTimestamp，或 messageIds 为空，或 beforeTimestamp 不是正整数 | 传入非空 messageIds，或传入大于 0 的 beforeTimestamp |
| 505 | service_not_enabled | this appKey not open message roaming | - |
| 112 | query_param_reaches_limit | 删除消息数量超限 | - |

### getGroupMessageReadUsers(params: GroupMessageReadUsersParams) => Promise<GroupMessageReadUsersResult>

#### 说明

获取指定群消息的已读成员列表。

#### 调用示例

```ts
const page = await chatManager.getGroupMessageReadUsers({
  groupId: 'group_1',
  messageId: 'msg_1',
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupMessageReadUsersParams` | 群消息已读成员查询参数。 |

#### 返回值

群消息已读成员分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | groupId、messageId 为空，或 pageSize 不是正整数 | 传入合法 groupId、messageId，并确保 pageSize 为正整数 |
| 500 | message_not_found | 消息不存在 | - |

### addReaction(params: ReactionOperationParams) => Promise<void>

#### 说明

为消息添加 Reaction。

事件触发：会话中的所有成员会收到 `onReactionChanged` 事件。
注意：仅支持单聊和群聊，不支持聊天室；每个用户对同一消息的同一 Reaction 只能添加一次。

#### 调用示例

```ts
await chatManager.addReaction({
  messageId: 'msg_1',
  reaction: '👍',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ReactionOperationParams` | 添加 Reaction 参数。 |

#### 返回值

添加完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messageId 或 reaction 为空 | 传入合法 messageId 和非空 reaction |
| 1301 | reaction_already_operated | the user is already operation this message | - |
| 1300 | reaction_reach_limit | The quantity has exceeded the limit! | - |
| 602 | group_not_joined | The user not in this group! | - |
| 1302 | reaction_operation_illegal | the user operation is illegal! | - |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 302 | server_busy | this message is creating reaction, please try again. | - |

### removeReaction(params: ReactionOperationParams) => Promise<void>

#### 说明

删除当前用户在消息上添加的 Reaction。

事件触发：会话中的所有成员会收到 `onReactionChanged` 事件。

#### 调用示例

```ts
await chatManager.removeReaction({
  messageId: 'msg_1',
  reaction: '👍',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ReactionOperationParams` | 删除 Reaction 参数。 |

#### 返回值

删除完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messageId 或 reaction 为空 | 传入合法 messageId 和非空 reaction |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 1302 | reaction_operation_illegal | the user operation is illegal! | - |

### getReactionList(params: GetReactionListParams) => Promise<ReadonlyArray<MessageReactionListItem>>

#### 说明

获取一条或多条消息的 Reaction 汇总列表。

#### 调用示例

```ts
const list = await chatManager.getReactionList({
  messageId: ['msg_1', 'msg_2'],
  conversationType: 'groupChat',
  groupId: 'group_1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetReactionListParams` | Reaction 汇总查询参数。 |

#### 返回值

消息 Reaction 汇总列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messageId 为空，或群聊查询缺少 groupId | 传入合法 messageId；conversationType 为 groupChat 时同时传入 groupId |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 600 | group_invalid_id | groupId can not be null! | - |

### getReactionDetail(params: GetReactionDetailParams) => Promise<MessageReactionDetailPage>

#### 说明

获取指定消息 Reaction 的用户明细。

#### 调用示例

```ts
const page = await chatManager.getReactionDetail({
  messageId: 'msg_1',
  reaction: '👍',
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetReactionDetailParams` | Reaction 详情查询参数。 |

#### 返回值

Reaction 用户明细分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messageId、reaction 为空，或 pageSize 不是正整数 | 传入合法 messageId、非空 reaction，并确保 pageSize 为正整数 |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 1302 | reaction_operation_illegal | the user operation is illegal! | - |

### getSupportedTranslationLanguages() => Promise<ReadonlyArray<TranslationLanguage>>

#### 说明

获取翻译服务支持的语言列表。

#### 调用示例

```ts
const languages = await chatManager.getSupportedTranslationLanguages();
```

#### 返回值

翻译支持语言列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 505 | service_not_enabled | 翻译服务未开通 | - |

### translateMessage(params: TranslateMessageParams) => Promise<MessageTranslationResult>

#### 说明

翻译文本消息内容到一个或多个目标语言。

#### 调用示例

```ts
const result = await chatManager.translateMessage({
  message,
  targetLanguages: ['en'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `TranslateMessageParams` | 消息翻译参数。 |

#### 返回值

消息翻译结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1110 | validation_invalid | 消息不是文本消息、文本内容为空，或 targetLanguages 为空/包含非法语言代码 | 仅传入包含非空文本内容的文本消息，并指定至少一个合法目标语言代码 |
| 1110 | translate_text_too_long | The input text is too long. | - |
| 1110 | translate_param_invalid | The target language is not valid. | - |
| 1111 | service_not_enabled | 翻译服务未开通 | - |
| 1112 | translate_usage_limit | 翻译服务配额已达上限 | - |
| 1113 | translate_failed | 翻译服务异常 | - |

### voiceMessageToText(voiceMessageBody: VoiceMessageBody, voiceParams: VoiceParams) => Promise<VoiceToTextResult>

#### 说明

将已发送或已接收的语音消息体转为文字。

#### 调用示例

```ts
const result = await chatManager.voiceMessageToText(voiceMessage.body, {
  format: 'amr',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| voiceMessageBody | `VoiceMessageBody` | 语音消息体。 |
| voiceParams | `VoiceParams` | 语音识别参数。 |

#### 返回值

语音转文字结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 407 | validation_invalid | 语音消息体格式非法、语音 URL 缺失，或语音识别参数类型非法 | 传入带有效 url 的语音消息体，并确保 format、sampleRate、bitsPerSample、channels 类型合法 |
| 410 | file_not_found | 语音消息体中没有可识别的文件 ID | 确认语音消息已成功上传且 url 有效 |
| 202 | unauthorized | 语音转文字服务鉴权失败 | 刷新 token 后重试 |
| 410 | file_not_found | 语音消息体中没有可识别的文件 ID | 确认语音消息已成功上传且 url 有效 |
| 407 | file_invalid | 语音文件格式或内容非法 | 更换合法语音文件后重试 |
| 408 | duration_too_long | 语音时长超过 60 秒 | 缩短语音时长后重试 |
| 411 | file_too_large | 上传语音文件超过服务端大小限制 | 压缩或缩短语音文件后重试 |
| 505 | service_not_enabled | 当前应用未开通语音转文字服务 | 开通服务后重试 |
| 4 | service_limit_exceeded | 语音转文字服务用量达到限制 | 稍后重试或提升服务配额 |
| 409 | voice_to_text_failed | 语音转文字服务处理失败 | 稍后重试；如果持续失败，联系服务端排查 |

### voiceFileToText(file: VoiceSourceFile, voiceParams: VoiceParams) => Promise<VoiceToTextResult>

#### 说明

上传本地语音文件并转换为文字。

#### 调用示例

```ts
const result = await chatManager.voiceFileToText(file, {
  format: 'amr',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| file | `VoiceSourceFile` | 本地语音文件。 |
| voiceParams | `VoiceParams` | 语音识别参数。 |

#### 返回值

语音转文字结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 407 | validation_invalid | 本地文件对象非法，或语音识别参数类型非法 | 传入浏览器 File 或小程序 MiniAppFile，并确保语音识别参数类型合法 |
| 110 | upload_required | 当前平台缺少上传能力 | 在支持上传的环境中调用，或为当前平台配置上传适配器 |
| 202 | unauthorized | 语音转文字服务鉴权失败 | 刷新 token 后重试 |
| 402 | upload_failed | 语音文件上传失败 | 检查网络和文件后重试 |
| 407 | file_invalid | 语音文件格式或内容非法 | 更换合法语音文件后重试 |
| 408 | duration_too_long | 语音时长超过 60 秒 | 缩短语音时长后重试 |
| 411 | file_too_large | 上传语音文件超过服务端大小限制 | 压缩或缩短语音文件后重试 |
| 505 | service_not_enabled | 当前应用未开通语音转文字服务 | 开通服务后重试 |
| 4 | service_limit_exceeded | 语音转文字服务用量达到限制 | 稍后重试或提升服务配额 |
| 409 | voice_to_text_failed | 语音转文字服务处理失败 | 稍后重试；如果持续失败，联系服务端排查 |

## src/types/chat-manager.ts

### MarkMessageReadItem

#### 说明

单条消息已读标记项。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | 要标记已读的收到消息。SDK 会从消息中读取会话、类型与服务端消息 ID。 |
| ackContent | `string` | 群消息已读回执附带内容，仅群聊有效。 |

### MarkMessageReadParams

#### 说明

批量标记消息已读的参数。

所有消息必须属于同一个单聊或群聊会话；SDK 会逐条发送服务端已读回执。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messages | `ReadonlyArray<MarkMessageReadItem>` | 要标记已读的消息列表，必须非空且属于同一会话。 |

### RecallMessageParams

#### 说明

撤回消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 待撤回消息 ID。 |
| ext | `Record<string, unknown>` | 撤回操作扩展字段。 |

### UpdateMessageParams

#### 说明

编辑消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 待编辑消息 ID。 |
| message | `Pick<Message, 'type' | 'body' | 'ext'>` | 新消息内容；当前仅支持文本和自定义消息。 |

### RemoveHistoryMessagesParams

#### 说明

删除历史消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageIds | `ReadonlyArray<string>` | 指定删除的消息 ID 列表。 |
| beforeTimestamp | `number` | 删除该时间戳之前的历史消息，单位毫秒。 |

### GetHistoryMessagesParams

#### 说明

获取历史消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| cursor | `string` | 分页游标；首次请求可不传。 |
| pageSize | `number` | 每页消息数量。 |
| searchDirection | `'up' | 'down'` | 拉取方向，`up` 表示更早消息，`down` 表示更新消息。 |
| senderIds | `ReadonlyArray<string>` | 群聊场景下按发送者过滤。 |
| messageTypes | `ReadonlyArray<Message['type']>` | 按消息类型过滤。 |
| startTime | `number` | 查询起始时间戳，单位毫秒。 |
| endTime | `number` | 查询结束时间戳，单位毫秒。 |

### MessageHistoryPage

#### 说明

历史消息分页结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<Message>` | 当前页消息列表。 |
| cursor | `string` | 下一页游标；为空表示没有后续游标。 |
| hasMore | `boolean` | 是否还有更多历史消息。 |

### DownloadAttachmentParams

#### 说明

下载消息附件的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | 需要下载附件的消息，通常为图片、语音、视频或文件消息。 |

### MessageAttachmentDownloadResult

#### 说明

消息附件下载结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| filename | `string` | 附件文件名。 |
| mimeType | `string` | 附件 MIME 类型。 |
| size | `number` | 附件大小，单位字节。 |
| data | `Uint8Array` | 附件二进制数据。 |
| downloadUrl | `string` | 实际下载地址。 |

### DownloadCombineMessageByMessageInput

#### 说明

使用完整合并消息对象下载并解析合并消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | 合并消息对象。SDK 会从 `message.body` 读取下载地址与密钥。 |
| timeoutMs | `number` | 下载超时，单位毫秒；不传时使用 SDK 默认值。 |
| maxItems | `number` | 单次允许解码的最大消息条数；不传时使用 SDK 默认值。 |

### GroupMessageReadUsersParams

#### 说明

查询群消息已读成员的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |
| messageId | `string` | 群消息 ID。 |
| cursor | `string` | 分页游标。 |
| pageSize | `number` | 每页成员数量。 |

### GroupMessageReadUser

#### 说明

群消息已读成员条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 用户 ID。 |
| user | `UserInfo` | 用户资料摘要。 |
| ackId | `string` | 服务端回执 ID。 |
| timestamp | `number` | 已读时间戳，单位毫秒。 |
| ackContent | `string` | 自定义回执内容。 |

### GroupMessageReadUsersResult

#### 说明

群消息已读成员分页结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |
| messageId | `string` | 群消息 ID。 |
| users | `ReadonlyArray<GroupMessageReadUser>` | 当前页已读成员列表。 |
| count | `number` | 已读成员总数。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有更多成员。 |

### ReactionOperationParams

#### 说明

添加或删除消息 Reaction 的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| reaction | `string` | Reaction 内容，例如表情或业务标识。 |

### GetReactionListParams

#### 说明

获取消息 Reaction 列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string | ReadonlyArray<string>` | 单个消息 ID 或消息 ID 列表。 |
| conversationType | `Extract<ChatConversationType, 'singleChat' | 'groupChat'>` | 会话类型；当前支持单聊和群聊。 |
| groupId | `string` | 群聊时必填的群组 ID。 |

### MessageReactionSummary

#### 说明

单个 Reaction 汇总信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reaction | `string` | Reaction 内容。 |
| count | `number` | 添加该 Reaction 的用户数量。 |
| isAddedBySelf | `boolean` | 当前用户是否已添加该 Reaction。 |
| userIds | `ReadonlyArray<string>` | 添加该 Reaction 的用户 ID 列表。 |

### MessageReactionListItem

#### 说明

单条消息的 Reaction 汇总。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| reactions | `ReadonlyArray<MessageReactionSummary>` | 该消息上的 Reaction 汇总列表。 |

### GetReactionDetailParams

#### 说明

获取 Reaction 详情的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| cursor | `string` | 分页游标。 |
| pageSize | `number` | 每页用户数量。 |

### ReactionUser

#### 说明

Reaction 用户明细条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 用户 ID。 |
| user | `UserInfo` | 用户资料摘要。 |
| createdAt | `string` | 添加 Reaction 的时间。 |

### MessageReactionDetailPage

#### 说明

Reaction 详情分页结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reaction | `string` | Reaction 内容。 |
| count | `number` | 添加该 Reaction 的用户数量。 |
| isAddedBySelf | `boolean` | 当前用户是否已添加该 Reaction。 |
| reactionUsers | `ReadonlyArray<ReactionUser>` | 添加该 Reaction 的用户明细列表。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有更多用户。 |
| createdAt | `string` | Reaction 创建时间。 |

### TranslationLanguage

#### 说明

翻译服务支持的语言。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| code | `string` | 语言代码。 |
| name | `string` | 语言英文名或服务端返回名称。 |
| nativeName | `string` | 语言本地名称。 |

### TranslateMessageParams

#### 说明

翻译消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | 待翻译文本消息。 |
| targetLanguages | `ReadonlyArray<string>` | 目标语言代码列表。 |

### VoiceParams

#### 说明

语音转文字可选参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| format | `string` | 语音格式，例如 `amr`、`mp3`、`pcm`。 |
| sampleRate | `number` | 采样率。 |
| bitsPerSample | `number` | 位深。 |
| channels | `number` | 声道数。 |

### VoiceToTextResult

#### 说明

语音转文字业务结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| text | `string` | 转写得到的文本。 |

### MessageTranslation

#### 说明

单条翻译结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| text | `string` | 翻译后的文本。 |
| to | `string` | 目标语言代码。 |

### MessageTranslationResult

#### 说明

消息翻译结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| detectedLanguage | `{
    /** [zh-CN] 源语言代码。 [en-US] Source language code. */
    language: string;
    /** [zh-CN] 识别置信度。 [en-US] Detection confidence score. */
    score: number;
  }` | 服务端识别出的源语言。 |
| translations | `ReadonlyArray<MessageTranslation>` | 翻译结果列表。 |

### MessageDeliveredEventPayload

#### 说明

消息送达回执事件载荷。

触发时机：接收方的 SDK 自动回送达回执后，发送方收到此事件。
接收方：消息的原始发送方。
前提：接收方初始化时设置了 `enableDeliveryReceipt: true`。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 已送达的原始消息 ID。 |
| conversationId | `string` | 会话 ID。 |
| conversationType | `'singleChat'` | 会话类型（始终为 singleChat）。 |

### MessageReadEventPayload

#### 说明

消息已读回执事件载荷。

触发时机：对方发送单聊消息已读回执，或群成员发送群消息已读回执。
接收方：消息的原始发送方。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 被标记已读的消息 ID。 |
| ackContent | `string` | 群已读回执附带的内容。 |

### ConversationReadEventPayload

#### 说明

会话已读回执事件载荷。

触发时机：对方调用 `markConversationRead` 标记整个会话为已读。
接收方：单聊对方（仅单聊触发此事件；群聊标记已读仅清除服务端未读数，不触发此事件）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| timestamp | `number` | 标记已读的时间戳。 |

### MessageRecalledEventPayload

#### 说明

消息撤回事件载荷。

触发时机：发送方撤回消息，或群主/管理员撤回群内他人消息。
接收方：会话中的所有成员（含撤回者的其他设备）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 被撤回的消息 ID。 |
| timestamp | `number` | 撤回时间戳。 |

### MessageUpdatedEventPayload

#### 说明

消息编辑事件载荷。

触发时机：发送方编辑已发送的消息。
接收方：会话中的所有成员（含编辑者的其他设备）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 被编辑的消息 ID。 |
| message | `Pick<Message, 'type' | 'body' | 'ext' | 'modifiedInfo'>` | 编辑后的消息内容。 |
| timestamp | `number` | 编辑时间戳。 |

### ReactionChangedEventPayload

#### 说明

Reaction 变更事件载荷。

触发时机：会话中有成员对消息添加或移除 Reaction。
接收方：会话中的所有成员。
注意：仅支持单聊和群聊，不支持聊天室。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| reaction | `string` | Reaction 表情。 |
| operation | `'add' | 'remove'` | 操作类型。 |

### PinnedMessageChangedEventPayload

#### 说明

消息置顶变更事件载荷。

触发时机：会话中有成员置顶或取消置顶消息。
接收方：会话中的所有成员。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| operation | `'pin' | 'unpin'` | 操作类型。 |
| pinTime | `number` | 置顶时间戳。 |
| operatorId | `string` | 操作者用户 ID。 |

### ChatActionResult

#### 说明

消息动作结果，适用于撤回等基于动作通道完成的操作。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ChatConversationType` | 会话类型。 |
| timestamp | `number` | 动作完成时间戳，单位毫秒。 |

### ChatMessageAction

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| kind | `'conversationRead' | 'messageRead' | 'groupMessageRead' | 'recall' | 'update'` | - |
| conversationId | `string` | - |
| conversationType | `ChatConversationType` | - |
| messageId | `string` | - |
| ackContent | `string` | - |
| body | `MessageBody` | - |
| type | `Message['type']` | - |
| ext | `Record<string, unknown>` | - |

### MessageSearchOption

#### 说明

消息搜索选项。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| keywordList | `ReadonlyArray<string>` | 搜索关键词列表（必填，最多5个，每个最长512字符）。 |
| keywordListMatchType | `MessageSearchKeywordMatchType` | 多关键词匹配关系，默认 'or'。 |
| conversationId | `string` | 会话内搜索时的会话 ID。 |
| conversationType | `MessageSearchConversationType` | 会话类型过滤，需与 conversationId 配合使用。 |
| msgTypes | `ReadonlyArray<SearchableMessageType>` | 消息体类型过滤（不支持 audio 和 cmd）。 |
| startTime | `number` | 查询开始时间戳（毫秒），需与 endTime 同时提供。 |
| endTime | `number` | 查询结束时间戳（毫秒），需与 startTime 同时提供。 |
| searchScope | `MessageSearchScope` | 搜索范围：'none' 仅消息体 | 'with' 消息体+扩展 | 'only' 仅扩展字段。 |
| direction | `MessageSearchDirection` | 搜索方向：'up' 旧→新 | 'down' 新→旧。 |

### SearchMessagesParams

#### 说明

服务端消息搜索参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| option | `MessageSearchOption` | 搜索选项。 |
| pageNum | `number` | 页码，从1开始，默认1。 |
| pageSize | `number` | 每页数量，范围1-100，默认20。 |

### SearchResultMessage

#### 说明

搜索结果中的单条消息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| highlight | `ReadonlyArray<string>` | 服务端返回的高亮片段。 |
| text | `string` | 服务端返回的摘要文本。 |

### SearchMessagesResult

#### 说明

服务端消息搜索结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messages | `ReadonlyArray<SearchResultMessage>` | 搜索结果消息列表。 |
| pageNum | `number` | 当前页码。 |
| pageSize | `number` | 请求页大小。 |
| totalPages | `number` | 总页数。 |
| isLast | `boolean` | 是否为最后一页。 |

## src/managers/chat-thread-manager.ts

### ChatThreadManager

### bind(client: ChatClient, context: ManagerEventContext) => void

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| client | `ChatClient` | - |
| context | `ManagerEventContext` | - |

### addEventHandler(id: EventHandlerId, handlers: ChatThreadEventHandlerMap) => void

#### 说明

注册 ChatThread 事件处理器。只包含移动端对齐的 4 个公开事件，不包含 `onChatThreadChange`。

#### 调用示例

调用示例（监听 Thread 创建）

```ts
client.chatThreadManager.addEventHandler('thread-ui', {
  onChatThreadCreated: event => {
    console.log(event.chatThreadId);
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器 ID；相同 ID 会覆盖旧处理器。 |
| handlers | `ChatThreadEventHandlerMap` | ChatThread 事件处理器映射。 |

#### 返回值

无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除指定 ChatThread 事件处理器。

#### 调用示例

调用示例（取消监听）

```ts
client.chatThreadManager.removeEventHandler('thread-ui');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 要移除的事件处理器 ID。 |

#### 返回值

无返回值。

### getChatThread(chatThreadId: string) => ChatThread

#### 说明

获取绑定指定 `chatThreadId` 的 ChatThread 实体对象。

#### 调用示例

调用示例（获取实体对象）

```ts
const thread = client.chatThreadManager.getChatThread('thread-1');
const detail = await thread.getInfo();
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |

#### 返回值

返回可复用的 ChatThread 实体对象。

### createChatThread(params: CreateChatThreadParams) => Promise<CreateChatThreadResult>

#### 说明

创建子区。

#### 调用示例

调用示例（创建子区）

```ts
const result = await client.chatThreadManager.createChatThread({
  parentId: 'group-1',
  name: 'Topic',
  messageId: 'msg-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateChatThreadParams` | 创建参数，包含父群组 ID、子区名称和父消息 ID。 |

#### 返回值

返回新建子区 ID。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | parentId、name 或 messageId 为空或格式非法 | 传入有效的父群组 ID、子区名称和父消息 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再创建子区 |
| 210 | permission_denied | 当前用户不在父群组中，或服务端未开通 Thread 能力 | 确认当前用户已加入父群组，并检查控制台 Thread 能力开通状态 |
| 606 | resource_not_found | parentId 对应群组不存在，或 messageId 对应父消息不存在 | 确认父群组和父消息仍存在后重试 |
| 4 | service_limit_exceeded | 子区数量或创建频率超过服务端限制 | 减少创建频率，清理不需要的子区，或联系服务端提升配额 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 创建错误 | 稍后重试或联系服务端排查 |

### getChatThreadList(params: GetChatThreadListParams) => Promise<ChatThreadListResult>

#### 说明

查询指定群组下的子区列表。

#### 调用示例

调用示例（查询群内子区）

```ts
const page = await client.chatThreadManager.getChatThreadList({
  parentId: 'group-1',
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadListParams` | 查询参数，包含父群组 ID、分页大小和游标。 |

#### 返回值

返回子区列表和下一页游标。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | parentId 为空，pageSize 不是 1 到 50 之间的整数，或 cursor 类型非法 | 传入有效的父群组 ID、分页大小和游标 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区列表 |
| 210 | permission_denied | 当前用户无权访问目标群组的子区列表 | 确认当前用户已加入父群组 |
| 606 | resource_not_found | parentId 对应群组不存在或已被解散 | 确认父群组 ID 正确且群组仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 列表查询错误 | 稍后重试或联系服务端排查 |

### getJoinedChatThreadList(params: GetJoinedChatThreadListParams) => Promise<ChatThreadListResult>

#### 说明

查询当前用户已加入的子区列表。

#### 调用示例

调用示例（查询已加入子区）

```ts
const page = await client.chatThreadManager.getJoinedChatThreadList({
  parentId: 'group-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetJoinedChatThreadListParams` | 查询参数；`parentId` 可选。 |

#### 返回值

返回已加入子区列表和下一页游标。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | pageSize 不是 1 到 50 之间的整数，cursor 类型非法，或 parentId 类型非法 | 传入有效的分页参数；如指定 parentId，应传入非空字符串 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询已加入子区 |
| 210 | permission_denied | 当前用户无权访问目标群组的已加入子区列表 | 确认当前用户已加入目标群组 |
| 606 | resource_not_found | 指定 parentId 时，目标群组不存在或已被解散 | 确认父群组 ID 正确且群组仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的已加入 Thread 查询错误 | 稍后重试或联系服务端排查 |

### getChatThreadInfo(params: GetChatThreadInfoParams) => Promise<ChatThreadDetail>

#### 说明

查询子区详情。

#### 调用示例

调用示例（查询详情）

```ts
const detail = await client.chatThreadManager.getChatThreadInfo({
  chatThreadId: 'thread-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadInfoParams` | 查询参数，包含子区 ID。 |

#### 返回值

返回子区详情。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 为空或格式非法 | 传入有效的子区 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区详情 |
| 210 | permission_denied | 当前用户无权访问目标子区 | 确认当前用户已加入父群组或目标子区 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 详情查询错误 | 稍后重试或联系服务端排查 |

### joinChatThread(params: ChatThreadMutationTarget) => Promise<void>

#### 说明

加入子区。

#### 调用示例

调用示例（加入子区）

```ts
await client.chatThreadManager.joinChatThread({ chatThreadId: 'thread-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ChatThreadMutationTarget` | 操作目标，包含子区 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 为空或格式非法 | 传入有效的子区 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再加入子区 |
| 210 | permission_denied | 当前用户不在父群组中，或服务端拒绝加入目标子区 | 确认当前用户已加入父群组且目标子区可加入 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 4 | service_limit_exceeded | 加入子区频率或数量超过服务端限制 | 减少操作频率或联系服务端提升配额 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 加入错误 | 稍后重试或联系服务端排查 |

### leaveChatThread(params: ChatThreadMutationTarget) => Promise<void>

#### 说明

退出子区。

#### 调用示例

调用示例（退出子区）

```ts
await client.chatThreadManager.leaveChatThread({ chatThreadId: 'thread-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ChatThreadMutationTarget` | 操作目标，包含子区 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 为空或格式非法 | 传入有效的子区 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再退出子区 |
| 210 | permission_denied | 服务端拒绝当前用户退出目标子区 | 确认当前用户已加入目标子区且允许退出 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 退出错误 | 稍后重试或联系服务端排查 |

### destroyChatThread(params: ChatThreadMutationTarget) => Promise<void>

#### 说明

解散子区。

#### 调用示例

调用示例（解散子区）

```ts
await client.chatThreadManager.destroyChatThread({ chatThreadId: 'thread-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ChatThreadMutationTarget` | 操作目标，包含子区 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 为空或格式非法 | 传入有效的子区 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再解散子区 |
| 210 | permission_denied | 当前用户不是群主、管理员或子区创建者，服务端拒绝解散 | 使用有管理权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 解散错误 | 稍后重试或联系服务端排查 |

### updateChatThreadName(params: UpdateChatThreadNameParams) => Promise<void>

#### 说明

更新子区名称。

#### 调用示例

调用示例（更新名称）

```ts
await client.chatThreadManager.updateChatThreadName({
  chatThreadId: 'thread-1',
  name: 'New topic',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UpdateChatThreadNameParams` | 更新参数，包含子区 ID 和新名称。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 或 name 为空或格式非法 | 传入有效的子区 ID 和新名称 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再更新子区名称 |
| 210 | permission_denied | 当前用户没有修改目标子区名称的权限 | 使用群主、管理员或有权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 名称更新错误 | 稍后重试或联系服务端排查 |

### getChatThreadMemberList(params: GetChatThreadMemberListParams) => Promise<ChatThreadMemberListResult>

#### 说明

查询子区成员列表。

#### 调用示例

调用示例（查询成员）

```ts
const page = await client.chatThreadManager.getChatThreadMemberList({
  chatThreadId: 'thread-1',
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadMemberListParams` | 查询参数，包含子区 ID、分页大小和游标。 |

#### 返回值

返回成员列表和下一页游标。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 为空，pageSize 不是 1 到 50 之间的整数，或 cursor 类型非法 | 传入有效的子区 ID、分页大小和游标 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区成员 |
| 210 | permission_denied | 当前用户无权访问目标子区成员列表 | 确认当前用户已加入父群组或目标子区 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 成员列表查询错误 | 稍后重试或联系服务端排查 |

### removeChatThreadMember(params: RemoveChatThreadMemberParams) => Promise<void>

#### 说明

从子区移除成员。

#### 调用示例

调用示例（移除成员）

```ts
await client.chatThreadManager.removeChatThreadMember({
  chatThreadId: 'thread-1',
  memberId: 'user-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `RemoveChatThreadMemberParams` | 移除参数，包含子区 ID 和成员 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 或 memberId 为空或格式非法 | 传入有效的子区 ID 和成员 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再移除子区成员 |
| 210 | permission_denied | 当前用户没有移除目标子区成员的权限 | 使用群主、管理员或有权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在，或 memberId 不是子区成员 | 确认子区和目标成员关系仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 成员移除错误 | 稍后重试或联系服务端排查 |

### getChatThreadLastMessageList(params: GetChatThreadLastMessageListParams) => Promise<ChatThreadLastMessageListResult>

#### 说明

批量查询子区最后一条消息。

#### 调用示例

调用示例（查询最后消息）

```ts
const result = await client.chatThreadManager.getChatThreadLastMessageList({
  chatThreadIds: ['thread-1', 'thread-2'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadLastMessageListParams` | 查询参数，包含最多 20 个子区 ID。 |

#### 返回值

返回每个子区的最后消息摘要。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadIds 为空、不是数组、超过 20 个，或包含非法子区 ID | 传入 1 到 20 个有效的子区 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区最后消息 |
| 210 | permission_denied | 当前用户无权访问一个或多个目标子区 | 确认当前用户有权限访问传入的所有子区 |
| 606 | resource_not_found | 一个或多个 chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 最后消息查询错误 | 稍后重试或联系服务端排查 |

## src/managers/chat-thread/chat-thread.ts

### ChatThread

### getInfo() => Promise<ChatThreadDetail>

#### 说明

获取当前子区详情。

#### 调用示例

调用示例（获取详情）

```ts
const thread = client.chatThreadManager.getChatThread('thread-1');
const detail = await thread.getInfo();
```

#### 返回值

返回子区详情。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区详情 |
| 210 | permission_denied | 当前用户无权访问目标子区 | 确认当前用户已加入父群组或目标子区 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 详情查询错误 | 稍后重试或联系服务端排查 |

### refresh() => Promise<ChatThreadDetail>

#### 说明

刷新并返回当前子区详情，等价于 `getInfo()`。

#### 调用示例

调用示例（刷新详情）

```ts
const detail = await thread.refresh();
```

#### 返回值

返回最新子区详情。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区详情 |
| 210 | permission_denied | 当前用户无权访问目标子区 | 确认当前用户已加入父群组或目标子区 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 详情查询错误 | 稍后重试或联系服务端排查 |

### join() => Promise<void>

#### 说明

加入当前子区。

#### 调用示例

调用示例（加入子区）

```ts
await thread.join();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再加入子区 |
| 210 | permission_denied | 当前用户不在父群组中，或服务端拒绝加入目标子区 | 确认当前用户已加入父群组且目标子区可加入 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 4 | service_limit_exceeded | 加入子区频率或数量超过服务端限制 | 减少操作频率或联系服务端提升配额 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 加入错误 | 稍后重试或联系服务端排查 |

### leave() => Promise<void>

#### 说明

退出当前子区。

#### 调用示例

调用示例（退出子区）

```ts
await thread.leave();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再退出子区 |
| 210 | permission_denied | 服务端拒绝当前用户退出目标子区 | 确认当前用户已加入目标子区且允许退出 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 退出错误 | 稍后重试或联系服务端排查 |

### destroy() => Promise<void>

#### 说明

解散当前子区。

#### 调用示例

调用示例（解散子区）

```ts
await thread.destroy();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再解散子区 |
| 210 | permission_denied | 当前用户不是群主、管理员或子区创建者，服务端拒绝解散 | 使用有管理权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 解散错误 | 稍后重试或联系服务端排查 |

### updateName(input: { readonly name: string }) => Promise<void>

#### 说明

更新当前子区名称。

#### 调用示例

调用示例（更新名称）

```ts
await thread.updateName({ name: 'New topic' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `{ readonly name: string }` | 更新输入，`name` 为新子区名称。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空，或 name 为空/格式非法 | 通过有效的 chatThreadId 创建实体，并传入有效的新名称 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再更新子区名称 |
| 210 | permission_denied | 当前用户没有修改目标子区名称的权限 | 使用群主、管理员或有权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 名称更新错误 | 稍后重试或联系服务端排查 |

### getMemberList(query: {
    readonly pageSize?: number;
    readonly cursor?: string;
  }) => Promise<ChatThreadMemberListResult>

#### 说明

获取当前子区成员列表。

#### 调用示例

调用示例（查询成员）

```ts
const page = await thread.getMemberList({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| query | `{
    readonly pageSize?: number;
    readonly cursor?: string;
  }` | 游标分页参数。 |

#### 返回值

返回成员列表和下一页游标。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空，或分页参数非法 | 通过有效的 chatThreadId 创建实体，并传入有效分页参数 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区成员 |
| 210 | permission_denied | 当前用户无权访问目标子区成员列表 | 确认当前用户已加入父群组或目标子区 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 成员列表查询错误 | 稍后重试或联系服务端排查 |

### removeMember(input: Omit<RemoveChatThreadMemberParams, 'chatThreadId'>) => Promise<void>

#### 说明

从当前子区移除成员。

#### 调用示例

调用示例（移除成员）

```ts
await thread.removeMember({ memberId: 'user-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `Omit<RemoveChatThreadMemberParams, 'chatThreadId'>` | 移除输入，包含成员 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空，或 memberId 为空/格式非法 | 通过有效的 chatThreadId 创建实体，并传入有效成员 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再移除子区成员 |
| 210 | permission_denied | 当前用户没有移除目标子区成员的权限 | 使用群主、管理员或有权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在，或 memberId 不是子区成员 | 确认子区和目标成员关系仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 成员移除错误 | 稍后重试或联系服务端排查 |

## src/types/chat-thread.ts

### CreateChatThreadParams

#### 说明

创建 ChatThread 的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| parentId | `string` | 子区所属群组 ID。 |
| name | `string` | 子区名称。 |
| messageId | `string` | 父消息 ID。 |

### CreateChatThreadResult

#### 说明

创建 ChatThread 的结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 新建子区 ID。 |

### GetChatThreadListParams

#### 说明

查询指定群组内 ChatThread 列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| parentId | `string` | 子区所属群组 ID。 |
| pageSize | `number` | 每页数量，默认 20，范围 1-50。 |
| cursor | `string` | 分页游标。 |

### GetJoinedChatThreadListParams

#### 说明

查询当前用户已加入 ChatThread 列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| parentId | `string` | 可选的父级群组 ID。 |
| pageSize | `number` | 每页数量，默认 20，范围 1-50。 |
| cursor | `string` | 分页游标。 |

### GetChatThreadInfoParams

#### 说明

查询 ChatThread 详情的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |

### GetChatThreadMemberListParams

#### 说明

查询 ChatThread 成员列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |
| pageSize | `number` | 每页数量，默认 20，范围 1-50。 |
| cursor | `string` | 分页游标。 |

### GetChatThreadLastMessageListParams

#### 说明

批量查询 ChatThread 最后一条消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadIds | `ReadonlyArray<string>` | 子区 ID 列表，最多 20 个。 |

### ChatThreadMutationTarget

#### 说明

ChatThread 生命周期操作的目标。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |

### UpdateChatThreadNameParams

#### 说明

更新 ChatThread 名称的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | 新子区名称。 |

### RemoveChatThreadMemberParams

#### 说明

移除 ChatThread 成员的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| memberId | `string` | 要移除的成员用户 ID。 |

### ChatThreadSummary

#### 说明

ChatThread 摘要信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |
| parentId | `string` | 子区所属群组 ID。 |
| name | `string` | 子区名称。 |
| ownerId | `string` | 子区所有者用户 ID。 |
| memberCount | `number` | 子区成员数。 |
| messageCount | `number` | 子区消息数。 |
| messageId | `string` | 子区父消息 ID。 |
| lastMessage | `MessageSnippet | null` | 子区最后一条消息摘要。 |
| createdAt | `number` | 子区创建时间戳。 |

### ChatThreadListResult

#### 说明

ChatThread 列表结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatThreadSummary>` | 当前页子区列表。 |
| cursor | `string` | 下一页游标，空字符串表示没有更多或未知。 |

### ChatThreadMemberEntry

#### 说明

ChatThread 成员条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| memberId | `string` | 成员用户 ID。 |
| joinedAt | `number` | 成员加入时间戳。 |

### ChatThreadMemberListResult

#### 说明

ChatThread 成员列表结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatThreadMemberEntry>` | 当前页成员列表。 |
| cursor | `string` | 下一页游标。 |

### ChatThreadLastMessageEntry

#### 说明

ChatThread 最后一条消息条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |
| lastMessage | `MessageSnippet | null` | 最后一条消息摘要；没有可用消息时为 null。 |

### ChatThreadLastMessageListResult

#### 说明

ChatThread 最后一条消息批量查询结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatThreadLastMessageEntry>` | 最后一条消息结果列表。 |

### ChatThreadBaseEventPayload

#### 说明

ChatThread 公开事件的基础载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |
| parentId | `string` | 子区所属群组 ID。 |
| operatorId | `string` | 操作者用户 ID。 |
| timestamp | `number` | 事件时间戳。 |

### ChatThreadCreatedEventPayload

#### 说明

ChatThread 创建事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadName | `string` | 子区名称。 |
| messageId | `string` | 父消息 ID。 |
| thread | `ChatThreadSummary` | 归一化后的子区摘要。 |

### ChatThreadUpdatedEventPayload

#### 说明

ChatThread 更新事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadName | `string` | 子区名称。 |
| messageId | `string` | 父消息 ID。 |
| messageCount | `number` | 子区消息数。 |
| lastMessage | `MessageSnippet | null` | 子区最后一条消息摘要。 |
| thread | `ChatThreadSummary` | 归一化后的子区摘要。 |

### ChatThreadUserRemovedEventPayload

#### 说明

当前登录用户被移出 ChatThread 的事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| memberId | `string` | 被移出的成员用户 ID。 |

### ChatThreadEventHandlerMap

#### 说明

ChatThread 公开事件处理器映射。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onChatThreadCreated | `(
    event: ChatThreadCreatedEventPayload
  ) => void | Promise<void>` | - |
| onChatThreadDestroyed | `(
    event: ChatThreadDestroyedEventPayload
  ) => void | Promise<void>` | - |
| onChatThreadUpdated | `(
    event: ChatThreadUpdatedEventPayload
  ) => void | Promise<void>` | - |
| onChatThreadUserRemoved | `(
    event: ChatThreadUserRemovedEventPayload
  ) => void | Promise<void>` | - |

## src/types/index.ts

### MessageModifiedInfo

#### 说明

消息修改信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| operatorId | `string` | 最后一次修改消息的操作者用户 ID。 |
| operationCount | `number` | 消息已被修改的次数。 |
| operationTime | `number` | 最后一次修改消息的时间戳，单位毫秒。 |

### MiniAppFile

#### 说明

小程序/uniapp 本地文件对象

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | - |
| size | `number` | - |
| name | `string` | - |
| type | `string` | - |

### ReactNativeFile

#### 说明

React Native 本地文件对象

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| uri | `string` | - |
| size | `number` | - |
| name | `string` | - |
| type | `string` | - |

### TextMessageBody

#### 说明

文本消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| content | `string` | - |
| targetLanguages | `string[]` | - |
| translations | `Record<string, string>` | - |

### ImageMessageBody

#### 说明

图片消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| localUrl | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| width | `number` | - |
| height | `number` | - |
| isGif | `boolean` | - |
| isOriginalImage | `boolean` | - |
| originalImageUrl | `string` | - |
| bigImageUrl | `string` | - |
| secret | `string` | - |
| fileLength | `number` | - |
| thumbnailUrl | `string` | - |

### FileMessageBody

#### 说明

文件消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| fileSize | `number` | - |
| fileLength | `number` | - |
| secret | `string` | - |

### VoiceMessageBody

#### 说明

语音消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| duration | `number` | - |
| fileLength | `number` | - |
| secret | `string` | - |

### VideoMessageBody

#### 说明

视频消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| duration | `number` | - |
| width | `number` | - |
| height | `number` | - |
| fileLength | `number` | - |
| secret | `string` | - |
| thumbnailUrl | `string` | - |

### LocationMessageBody

#### 说明

位置消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| latitude | `number` | - |
| longitude | `number` | - |
| address | `string` | - |
| buildingName | `string` | - |

### CmdMessageBody

#### 说明

命令消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| action | `string` | - |
| params | `Record<string, string>` | - |
| deliverOnlineOnly | `boolean` | - |

### CustomMessageBody

#### 说明

自定义消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| event | `string` | - |
| params | `Record<string, string>` | - |

### CombineMessageBody

#### 说明

合并消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | - |
| summary | `string` | - |
| compatibleText | `string` | - |
| messageList | `ReadonlyArray<Message>` | - |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| fileLength | `number` | - |
| secret | `string` | - |
| combineLevel | `number` | - |

### Message

#### 说明

消息对象。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| msgServerId | `string` | 服务端消息 ID。 |
| msgLocalId | `string` | 本地消息 ID。 |
| from | `string` | 发送方 userId。 |
| to | `string` | 接收方标识：单聊为对方 userId，群聊为 groupId，聊天室为 chatroomId。 |
| sender | `Sender` | 发送者资料摘要。 |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ChatConversationType` | 会话类型。 |
| type | `MessageType` | 消息类型。 |
| status | `MessageStatus` | 消息状态。 |
| ext | `Record<string, unknown>` | 消息扩展字段。 |
| timestamp | `number` | 消息时间戳，单位毫秒。 |
| body | `MessageBody` | 消息体。 |
| direct | `MessageDirect` | 消息方向。 |
| isOnline | `boolean` | 是否为在线消息；`false` 表示离线消息。 |
| receiverList | `string[]` | 定向消息接收者列表。 |
| deliverOnlineOnly | `boolean` | 是否仅投递给在线用户。 |
| webhookEnv | `string` | 发送消息协议中的 webhookEnv 字段。 |
| priority | `MessagePriority` | 消息优先级。 |
| isBroadcast | `boolean` | 是否为广播消息，主要用于聊天室下行语义。 |
| isContentReplaced | `boolean` | 内容是否被审核替换。 |
| combineLevel | `number` | 合并消息层级，仅 `type=combine` 时有意义。 |
| stream | `StreamMessageMeta` | 流式消息元信息，仅流式消息回调场景提供。 |
| reactions | `MessageReaction[]` | 消息的表情回应列表。 |
| groupReadCount | `number` | 群消息已读人数。 |
| needGroupReadReceipt | `boolean` | 是否需要群已读回执。 |
| modifiedInfo | `MessageModifiedInfo` | 消息修改信息；消息被编辑后返回或下发。 |

### MessageReaction

#### 说明

消息表情回应
Message reaction

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reaction | `string` | 表情标识。Reaction emoji identifier. |
| count | `number` | 该表情的回应人数。Count of users who reacted with this emoji. |
| userList | `string[]` | 回应的用户 ID 列表。List of user IDs who reacted. |
| isAddedBySelf | `boolean` | 当前用户是否已添加该表情。Whether the current user has added this reaction. |

### CombineMessage

#### 说明

合并消息对象

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| type | `'combine'` | - |
| body | `CombineMessageBody` | - |
| combineLevel | `number` | - |

### StreamMessageMeta

#### 说明

流式消息元信息

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| customType | `string` | - |
| seq | `number` | - |
| status | `StreamMessageStatus` | - |
| errorType | `number` | - |
| finishReason | `number` | - |
| deltaText | `string` | - |
| fullText | `string` | - |

### StreamMessage

#### 说明

流式消息事件

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| type | `'text'` | - |
| body | `TextMessageBody` | - |
| stream | `StreamMessageMeta` | - |

### FileUploadProgress

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| loaded | `number` | 已上传字节数。 |
| total | `number` | 总字节数。 |
| percent | `number` | 上传进度百分比。 |

### FileUploadResult

#### 说明

文件上传完成结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | 文件远程地址。 |
| isOriginalImage | `boolean` | 是否按原图语义上传。 |
| originalImageUrl | `string` | 原图地址。 |
| bigImageUrl | `string` | 大图地址。 |
| secret | `string` | 下载密钥。 |
| fileLength | `number` | 文件大小，单位字节。 |
| filetype | `string` | 文件 MIME 类型。 |
| filename | `string` | 文件名。 |
| thumbnailUrl | `string` | 缩略图地址。 |
| width | `number` | 图片或视频宽度，单位像素。 |
| height | `number` | 图片或视频高度，单位像素。 |

### SendMessageOptions

#### 说明

发送消息的可选回调。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onSending | `(message: Message) => void` | 消息开始发送时触发。 |
| onSuccess | `(message: Message) => void` | 消息发送成功时触发。 |
| onFailed | `(message: Message, error: Error) => void` | 消息发送失败时触发。 |
| onFileUploadProgress | `(progress: FileUploadProgress) => void` | 附件上传进度回调。 |
| onFileUploadComplete | `(result: FileUploadResult) => void` | 附件上传完成回调。 |
| onFileUploadError | `(error: Error) => void` | 附件上传失败回调。 |
| onFileUploadCanceled | `() => void` | 附件上传取消回调。 |

### DownloadCombineMessageParams

#### 说明

下载并解析合并消息的最小参数，通常来自合并消息体中的 `url` 与 `secret`。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | 合并消息详情下载地址。 |
| secret | `string` | 下载密钥；服务端未下发时可不传。 |
| timeoutMs | `number` | 下载超时，单位毫秒；不传时使用 SDK 默认值。 |
| maxItems | `number` | 单次允许解码的最大消息条数；不传时默认最多 300 条。 |

### Connection

#### 说明

连接对象（内存对象，不持久化）

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| status | `ConnectionStatus` | - |
| serverUrl | `string` | - |
| userId | `string` | - |
| token | `string` | - |
| lastConnectedAt | `number` | - |
| reconnectAttempts | `number` | - |
| error | `Error` | - |

## src/types/message-create.ts

### CreateMessageBaseParams

#### 说明

创建消息的通用入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID；单聊为对端用户 ID，群聊为 groupId，聊天室为 chatroomId。 |
| conversationType | `ChatConversationType` | 会话类型。 |
| ext | `Record<string, unknown>` | 消息扩展字段，需保持 JSON 可序列化。 |
| timestamp | `number` | 本地时间戳，单位毫秒；不传时由 SDK 生成。 |
| receiverList | `string[]` | 定向消息接收者列表。 |
| deliverOnlineOnly | `boolean` | 是否仅投递给在线用户。 |
| webhookEnv | `string` | 发送消息协议中的 webhookEnv 字段。 |
| priority | `MessagePriority` | 消息优先级。 |
| needGroupReadReceipt | `boolean` | 是否需要群已读回执，仅群聊有效。 |

### CreateTextMessageParams

#### 说明

创建文本消息的入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| content | `string` | 文本消息内容。 |
| targetLanguages | `string[]` | 发送时需要翻译到的目标语言列表。 |

### CreateImageMessageParams

#### 说明

创建图片消息的入参。`data` 与 `originalUrl` 至少传一个；传 `data` 时 SDK 会自动补齐文件信息，并在发送前解析图片宽高。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | 本地文件对象。 |
| originalUrl | `string` | 远程原图地址。 |
| filename | `string` | 文件名；传 `data` 时可由 SDK 自动获取。 |
| filetype | `string` | 文件 MIME 类型；传 `data` 时可由 SDK 自动获取。 |
| width | `number` | 图片宽度，单位像素。 |
| height | `number` | 图片高度，单位像素。 |
| isGif | `boolean` | 是否为 GIF。 |
| isOriginalImage | `boolean` | 是否按原图语义发送。 |
| fileLength | `number` | 文件大小，单位字节。 |
| thumbnailUrl | `string` | 缩略图地址。 |

### CreateFileMessageParams

#### 说明

创建文件消息的入参。`data` 与 `originalUrl` 至少传一个。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | 本地文件对象。 |
| originalUrl | `string` | 远程文件地址。 |
| filename | `string` | 文件名；传 `data` 时可由 SDK 自动获取。 |
| filetype | `string` | 文件 MIME 类型；传 `data` 时可由 SDK 自动获取。 |
| fileSize | `number` | 文件大小，单位字节。 |
| fileLength | `number` | 文件长度，单位字节；兼容服务端字段。 |

### CreateVoiceMessageParams

#### 说明

创建语音消息的入参。`data` 与 `originalUrl` 至少传一个。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | 本地语音文件对象。 |
| originalUrl | `string` | 远程语音地址。 |
| filename | `string` | 文件名；传 `data` 时可由 SDK 自动获取。 |
| filetype | `string` | 文件 MIME 类型；传 `data` 时可由 SDK 自动获取。 |
| duration | `number` | 语音时长，单位秒。 |
| fileLength | `number` | 文件大小，单位字节。 |

### CreateVideoMessageParams

#### 说明

创建视频消息的入参。`data` 与 `originalUrl` 至少传一个。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | 本地视频文件对象。 |
| originalUrl | `string` | 远程视频地址。 |
| filename | `string` | 文件名；传 `data` 时可由 SDK 自动获取。 |
| filetype | `string` | 文件 MIME 类型；传 `data` 时可由 SDK 自动获取。 |
| duration | `number` | 视频时长，单位秒。 |
| width | `number` | 视频宽度，单位像素。 |
| height | `number` | 视频高度，单位像素。 |
| fileLength | `number` | 文件大小，单位字节。 |
| thumbnailUrl | `string` | 视频缩略图地址。 |

### CreateLocationMessageParams

#### 说明

创建位置消息的入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| latitude | `number` | 纬度。 |
| longitude | `number` | 经度。 |
| address | `string` | 地址描述。 |
| buildingName | `string` | 建筑名称。 |

### CreateCmdMessageParams

#### 说明

创建命令消息的入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| action | `string` | 命令动作。 |

### CreateCustomMessageParams

#### 说明

创建自定义消息的入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| event | `string` | 自定义事件名称。 |
| params | `Record<string, string>` | 自定义参数。 |

### CreateCombineMessageParams

#### 说明

创建合并消息的入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | 合并消息标题。 |
| summary | `string` | 合并消息摘要。 |
| compatibleText | `string` | 兼容展示文本，默认 `[聊天记录]`。 |
| messageList | `ReadonlyArray<Message>` | 被合并的消息列表。 |

## src/types/message-conversation.ts

### MessageConversationLocator

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | - |
| conversationType | `ChatConversationType` | - |

## src/types/conversation.ts

### ConversationIdentifier

#### 说明

会话唯一标识。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID；单聊为用户 ID，群聊为 groupId，聊天室为 chatroomId。 |
| conversationType | `ConversationType` | 会话类型。 |

### ConversationFilter

#### 说明

会话列表过滤条件。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| isPinned | `boolean` | 为 true 时只返回置顶会话。 |
| mark | `ConversationMark` | 按会话标记槽位过滤，取值 0 到 19。 |

### DeleteConversationParams

#### 说明

删除会话的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| deleteRoamingMessages | `boolean` | 是否同时删除服务端漫游消息。 |

### SetConversationPinnedParams

#### 说明

设置会话置顶的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pinned | `boolean` | `true` 表示置顶，`false` 表示取消置顶。 |

### ConversationMarkMutationItem

#### 说明

单个会话标记变更结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reason | `string` | 操作失败原因；成功项不包含该字段。 |

### ConversationMarkMutationResult

#### 说明

会话标记变更结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| succeeded | `ReadonlyArray<ConversationMarkMutationItem>` | 成功应用本次标记变更的会话。 |
| failed | `ReadonlyArray<ConversationMarkMutationItem>` | 未能应用本次标记变更的会话。 |
| mark | `ConversationMark` | 本次操作的标记槽位。 |
| operation | `'addMark' | 'removeMark'` | 标记操作类型。 |

### PinMessageParams

#### 说明

置顶或取消置顶消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |

### ConversationMutationResult

#### 说明

会话变更结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ConversationType` | 会话类型。 |
| operation | `'delete' | 'setPinned'` | 操作类型。 |
| isPinned | `boolean` | 会话是否置顶。 |
| pinnedTime | `number` | 置顶时间戳，单位毫秒。 |

### MessagePinMutationResult

#### 说明

置顶或取消置顶消息的结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ConversationType` | 会话类型。 |
| messageId | `string` | 消息 ID。 |
| operation | `'pin' | 'unpin'` | 操作类型。 |

### PinnedMessageSummary

#### 说明

置顶消息摘要。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ConversationType` | 会话类型。 |
| operatorId | `string` | 置顶操作者用户 ID。 |
| pinnedAt | `number` | 置顶时间戳，单位毫秒。 |
| message | `Message` | 被置顶的完整消息。 |

### PinnedMessageListResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<PinnedMessageSummary>` | 会话内置顶消息摘要列表，最多 20 条。 |

### RefreshSessionListParams

#### 说明

主动刷新新会话列表时的请求参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| includeEmpty | `boolean` | 是否需要返回空会话。 |

### SessionMessageSnippet

#### 说明

会话列表最小消息摘要。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| msgServerId | `string` | 服务端消息 ID。 |
| from | `string` | 发送者用户 ID。 |
| to | `string` | 接收方 ID；单聊为 userId，群聊为 groupId，聊天室为 chatroomId。 |
| sender | `Sender` | 发送者信息。 |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ConversationType` | 会话类型。 |
| type | `MessageType` | 消息类型。 |
| status | `MessageStatus` | 消息状态。 |
| timestamp | `number` | 消息时间戳，单位毫秒。 |
| direct | `MessageDirect` | 消息方向。 |
| modifiedInfo | `MessageModifiedInfo` | 消息修改信息；最后一条消息被编辑后可能存在。 |
| userInfoUpdateTime | `number` | 发送者用户资料版本时间，单位秒；用于资料补位。 |
| namecardUpdateTime | `number` | 群成员名片版本时间，单位秒；仅群聊最后一条消息可能存在。 |
| body | `Record<string, unknown>` | 消息体摘要；不得包含 `type` 字段。 |

### ConversationItem

#### 说明

公开会话列表项，来源于本地会话列表缓存投影。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ConversationType` | 会话类型。 |
| unreadCount | `number` | 未读消息数。 |
| lastMessage | `SessionMessageSnippet | null` | 最后一条消息摘要。 |
| lastMessageAt | `number` | 最后一条消息时间戳，单位毫秒。 |
| isPinned | `boolean` | 是否置顶。 |
| pinnedTimestamp | `number` | 置顶时间戳，单位毫秒。 |
| marks | `ReadonlyArray<ConversationMark>` | 会话标记列表。 |
| readAt | `number` | 已读位置或已读时间戳。 |
| remindType | `SessionListRemindType` | 会话提醒类型。 |
| conversationName | `string` | 会话展示名称。 |
| conversationAvatar | `string` | 会话头像地址。 |

## src/types/multi-device.ts

### MultiDeviceEventBase

#### 说明

MultiDevice 公共载荷基类。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `MultiDeviceEventCategory` | 事件分类。 |
| operation | `| MultiDeviceContactOperation
    | MultiDeviceGroupOperation
    | MultiDeviceThreadOperation
    | MultiDeviceConversationOperation
    | MultiDeviceMessageRemovedOperation` | 标准化操作名。 |
| deviceId | `string` | 来源设备 ID。 |
| timestamp | `number` | 事件时间戳。 |
| raw | `Readonly<Record<string, unknown>>` | 原始调试数据。 |

### MultiDeviceContactEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `'contact'` | - |
| operation | `MultiDeviceContactOperation` | - |
| targetUserId | `string` | - |
| rosterVersion | `string` | - |
| ext | `string` | - |

### MultiDeviceGroupEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `'group'` | - |
| operation | `MultiDeviceGroupOperation` | - |
| groupId | `string` | - |
| userIds | `ReadonlyArray<string>` | - |
| operatorId | `string` | - |
| groupName | `string` | - |

### MultiDeviceThreadEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `'thread'` | - |
| operation | `MultiDeviceThreadOperation` | - |
| threadId | `string` | - |
| parentId | `string` | - |
| userIds | `ReadonlyArray<string>` | - |
| operatorId | `string` | - |
| threadName | `string` | - |

### MultiDeviceConversationEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `'conversation'` | - |
| operation | `MultiDeviceConversationOperation` | - |
| conversationId | `string` | - |
| conversationType | `ConversationType` | - |
| mark | `number` | - |
| remindType | `string` | - |
| silentMode | `Readonly<Record<string, unknown>>` | - |
| operatorId | `string` | - |

### MultiDeviceMessageRemovedEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `'messageRemoved'` | - |
| operation | `MultiDeviceMessageRemovedOperation` | - |
| conversationId | `string` | - |
| conversationType | `ConversationType` | - |
| messageIds | `ReadonlyArray<string>` | - |
| beforeTimestamp | `number` | - |

### MultiDeviceEventHandlerMap

#### 说明

ChatClient 多设备监听器映射。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onMultiDeviceContact | `(
    event: MultiDeviceContactEvent
  ) => void | Promise<void>` | 联系人多设备事件。 |
| onMultiDeviceGroup | `(
    event: MultiDeviceGroupEvent
  ) => void | Promise<void>` | 群组多设备事件。 |
| onMultiDeviceThread | `(
    event: MultiDeviceThreadEvent
  ) => void | Promise<void>` | 子区多设备事件。 |
| onMultiDeviceConversation | `(
    event: MultiDeviceConversationEvent
  ) => void | Promise<void>` | 会话多设备事件。 |
| onMultiDeviceMessageRemoved | `(
    event: MultiDeviceMessageRemovedEvent
  ) => void | Promise<void>` | 漫游消息删除多设备事件。 |

## src/managers/chatroom-manager.ts

### ChatRoomManager

### addEventHandler(id: EventHandlerId, handlers: ChatRoomEventHandlerMap) => void

#### 说明

注册聊天室事件处理器，事件包括成员进出、禁言、allowlist、公告和属性变更等。

#### 调用示例

调用示例（监听聊天室成员加入）

```ts
client.chatRoomManager.addEventHandler('chatroom-ui', {
  onMembersJoined: event => {
    console.log(event.chatRoomId, event.members);
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一 ID，用于后续移除。 |
| handlers | `ChatRoomEventHandlerMap` | 聊天室事件处理器集合，可只实现需要监听的回调。 |

#### 返回值

注册完成后无返回值。

#### 可能错误

- 错误码 `110`：事件上下文未绑定。解决方式：先完成 SDK 初始化并注册 ChatRoomManager。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除指定 ID 的聊天室事件处理器。

#### 调用示例

调用示例（移除监听）

```ts
client.chatRoomManager.removeEventHandler('chatroom-ui');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 待移除的事件处理器 ID。 |

#### 返回值

移除完成后无返回值。

#### 可能错误

- 错误码 `110`：事件上下文未绑定。解决方式：先完成 SDK 初始化并注册 ChatRoomManager。

### getChatRoomList(params: GetChatRoomListParams) => Promise<{
    readonly items: ReadonlyArray<ChatRoomSummary>;
    readonly pageNum?: number;
    readonly pageSize?: number;
    readonly total?: number;
    readonly hasMore?: boolean;
  }>

#### 说明

分页获取公开聊天室列表，并尽量补齐聊天室所有者资料。

#### 调用示例

调用示例（获取第一页聊天室）

```ts
const result = await client.chatRoomManager.getChatRoomList({
  pageNum: 1,
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatRoomListParams` | 分页参数；`pageNum` 从 1 开始，`pageSize` 未传时使用服务端默认值。 |

#### 返回值

返回聊天室摘要列表与分页信息。

#### 可能错误

- REST 请求失败或登录态不可用时抛出统一 SDK 错误。

### getChatRoom(chatRoomId: string) => ChatRoom

#### 说明

获取绑定指定 `chatRoomId` 的单聊天室对象，便于后续在对象上调用成员、公告、属性等方法。

#### 调用示例

调用示例（获取聊天室对象）

```ts
const chatRoom = client.chatRoomManager.getChatRoom('chatroom-1');
const detail = await chatRoom.getInfo();
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID，必填且不能为空字符串。 |

#### 返回值

返回复用的单聊天室对象。

#### 可能错误

- 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。

### joinChatRoom(params: JoinChatRoomParams) => Promise<void>

#### 说明

加入指定聊天室。该方法通过长连接聊天室操作发送加入请求。

#### 调用示例

调用示例（加入聊天室）

```ts
await client.chatRoomManager.joinChatRoom({
  chatRoomId: 'chatroom-1',
  ext: 'from-web',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `JoinChatRoomParams` | 加入参数，包含必填 `chatRoomId`，以及可选 `ext`、`leaveOtherRooms`。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 4 | exceed_limit | 当前用户已加入过多聊天室，服务端拒绝继续加入 | 退出不再使用的聊天室后重试，或联系服务端提升限制 |
| 704 | members_full | 聊天室人数已达上限，无法继续加入 | 等待其他成员退出后重试，或联系聊天室管理员提升上限 |
| 707 | user_in_blocklist | 当前用户已被加入聊天室黑名单，无法加入 | 联系聊天室管理员将用户从黑名单移除 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

## src/managers/chatroom/chatroom.ts

### ChatRoom

### getInfo() => Promise<ChatRoomDetail>

#### 说明

获取当前聊天室详情。

#### 调用示例

调用示例（获取详情）

```ts
const chatRoom = client.chatRoomManager.getChatRoom('chatroom-1');
const detail = await chatRoom.getInfo();
```

#### 返回值

返回聊天室详情、公告、权限与当前用户状态。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### refresh() => Promise<ChatRoomDetail>

#### 说明

刷新并返回当前聊天室详情，等价于 `getInfo()`。

#### 调用示例

调用示例（刷新详情）

```ts
const detail = await chatRoom.refresh();
```

#### 返回值

返回最新聊天室详情。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### updateInfo(input: ChatRoomUpdateInfoInput) => Promise<ChatRoomUpdateResult>

#### 说明

更新当前聊天室名称、描述或最大成员数。

#### 调用示例

调用示例（更新聊天室信息）

```ts
await chatRoom.updateInfo({ name: 'SDK room' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUpdateInfoInput` | 更新字段，`name/description/maxMembers` 至少传入一项。 |

#### 返回值

返回各字段是否更新成功。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改聊天室信息 | 使用聊天室 owner/admin 账号重试 |
| 110 | forbidden_op | 聊天室名称、描述或最大人数超过服务端限制 | 缩短名称/描述，或传入允许范围内的 maxMembers |
| 110 | illegal_argument | 请求中包含 chatroom_id 等不允许修改的字段 | 仅提交 name、description、maxMembers 等允许修改的字段 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### leaveChatRoom() => Promise<void>

#### 说明

退出当前聊天室。

#### 调用示例

调用示例（退出聊天室）

```ts
await chatRoom.leaveChatRoom();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getMembers(query: CursorPageParams) => Promise<ChatRoomMemberListResult>

#### 说明

获取当前聊天室成员列表。

#### 调用示例

调用示例（获取成员）

```ts
const members = await chatRoom.getMembers({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| query | `CursorPageParams` | 游标分页参数；未传时使用服务端默认分页。 |

#### 返回值

返回成员列表、游标与是否还有下一页。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### removeMembers(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### 说明

从当前聊天室移除成员。

#### 调用示例

调用示例（移除成员）

```ts
const result = await chatRoom.removeMembers({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 移除输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

返回每个目标用户的移除结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法移除成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAdminList() => Promise<ReadonlyArray<UserInfo>>

#### 说明

获取当前聊天室管理员列表。

#### 调用示例

调用示例（获取管理员）

```ts
const admins = await chatRoom.getAdminList();
```

#### 返回值

返回管理员用户资料列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### addAdmin(input: ChatRoomAdminInput) => Promise<void>

#### 说明

将用户设置为当前聊天室管理员。

#### 调用示例

调用示例（添加管理员）

```ts
await chatRoom.addAdmin({ userId: 'user-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomAdminInput` | 管理员输入，`userId` 必填。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室所有者，无法设置管理员 | 使用聊天室 owner 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
| 204 | service_resource_not_found | 待设置为管理员的用户不存在 | 确认 userId 对应用户存在 |

### removeAdmin(input: ChatRoomAdminInput) => Promise<void>

#### 说明

移除当前聊天室管理员。

#### 调用示例

调用示例（移除管理员）

```ts
await chatRoom.removeAdmin({ userId: 'user-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomAdminInput` | 管理员输入，`userId` 必填。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室所有者，无法移除管理员 | 使用聊天室 owner 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getMuteList(page: ChatRoomPageParams) => Promise<ReadonlyArray<ChatRoomMuteEntry>>

#### 说明

获取当前聊天室禁言列表。

#### 调用示例

调用示例（获取禁言列表）

```ts
const mutes = await chatRoom.getMuteList({ pageNum: 1, pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| page | `ChatRoomPageParams` | 页码分页参数；未传时使用服务端默认分页。 |

#### 返回值

返回禁言用户与过期时间列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### muteMembers(input: ChatRoomMuteMembersInput) => Promise<void>

#### 说明

禁言当前聊天室成员。

#### 调用示例

调用示例（禁言成员）

```ts
await chatRoom.muteMembers({ userIds: ['user-1'], duration: 3600 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomMuteMembersInput` | 禁言输入，包含非空 `userIds` 与禁言时长 `duration`（秒）。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | muteDuration、userIds 或请求体字段不符合服务端约束 | 检查 userIds 与 muteDuration，确保传入有效值 |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法禁言成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### unmuteMembers(input: ChatRoomUserBatchInput) => Promise<void>

#### 说明

解除当前聊天室成员禁言。

#### 调用示例

调用示例（解除禁言）

```ts
await chatRoom.unmuteMembers({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 解除禁言输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法解除禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### muteAllMembers() => Promise<void>

#### 说明

开启当前聊天室全员禁言。

#### 调用示例

调用示例（开启全员禁言）

```ts
await chatRoom.muteAllMembers();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法开启全员禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### unmuteAllMembers() => Promise<void>

#### 说明

关闭当前聊天室全员禁言。

#### 调用示例

调用示例（关闭全员禁言）

```ts
await chatRoom.unmuteAllMembers();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法关闭全员禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### checkIfInMuteList() => Promise<ChatRoomMuteStatus>

#### 说明

查询当前用户是否在当前聊天室禁言列表中。

#### 调用示例

调用示例（查询禁言状态）

```ts
const status = await chatRoom.checkIfInMuteList();
```

#### 返回值

返回当前用户是否被禁言及过期时间。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getBlocklist(page: ChatRoomPageParams) => Promise<ReadonlyArray<ChatRoomBlocklistEntry>>

#### 说明

获取当前聊天室黑名单。

#### 调用示例

调用示例（获取黑名单）

```ts
const blocklist = await chatRoom.getBlocklist({ pageNum: 1, pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| page | `ChatRoomPageParams` | 页码分页参数；未传时使用服务端默认分页。 |

#### 返回值

返回黑名单用户列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### blockMembers(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### 说明

将成员加入当前聊天室黑名单。

#### 调用示例

调用示例（拉黑成员）

```ts
const result = await chatRoom.blockMembers({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 拉黑输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

返回每个目标用户的拉黑结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法拉黑成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
| 204 | service_resource_not_found | 待加入黑名单的用户不存在 | 确认 userIds 中的用户都已存在 |

### unblockMembers(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### 说明

从当前聊天室黑名单移除成员。

#### 调用示例

调用示例（移除黑名单）

```ts
const result = await chatRoom.unblockMembers({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 移除输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

返回每个目标用户的移除结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法移除黑名单成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAllowlist() => Promise<ReadonlyArray<{ readonly user: UserInfo }>>

#### 说明

获取当前聊天室 allowlist。

#### 调用示例

调用示例（获取 allowlist）

```ts
const allowlist = await chatRoom.getAllowlist();
```

#### 返回值

返回 allowlist 用户列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### addUsersToAllowlist(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### 说明

将用户加入当前聊天室 allowlist。

#### 调用示例

调用示例（添加 allowlist）

```ts
const result = await chatRoom.addUsersToAllowlist({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 添加输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

返回每个目标用户的添加结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
| 204 | service_resource_not_found | 待加入 allowlist 的用户不存在 | 确认 userIds 中的用户都已存在 |

### removeUsersFromAllowlist(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### 说明

从当前聊天室 allowlist 移除用户。

#### 调用示例

调用示例（移除 allowlist）

```ts
const result = await chatRoom.removeUsersFromAllowlist({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 移除输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

返回每个目标用户的移除结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### checkIfInAllowList() => Promise<boolean>

#### 说明

查询当前用户是否在当前聊天室 allowlist 中。

#### 调用示例

调用示例（查询 allowlist 状态）

```ts
const status = await chatRoom.checkIfInAllowList();
```

#### 返回值

返回当前用户是否在 allowlist 中。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAnnouncement() => Promise<ChatRoomAnnouncement>

#### 说明

获取当前聊天室公告。

#### 调用示例

调用示例（获取公告）

```ts
const announcement = await chatRoom.getAnnouncement();
```

#### 返回值

返回聊天室 ID 与公告内容。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### updateAnnouncement(input: ChatRoomAnnouncementUpdateInput) => Promise<void>

#### 说明

更新当前聊天室公告。

#### 调用示例

调用示例（更新公告）

```ts
await chatRoom.updateAnnouncement({ announcement: 'Welcome' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomAnnouncementUpdateInput` | 公告更新输入，`announcement` 必填。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改公告 | 使用聊天室 owner/admin 账号重试 |
| 110 | forbidden_op | 公告长度超过服务端允许上限 | 缩短公告内容后重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAttributes(input: GetChatRoomAttributesInput) => Promise<ChatRoomAttributesSnapshot>

#### 说明

获取当前聊天室属性。

#### 调用示例

调用示例（获取属性）

```ts
const snapshot = await chatRoom.getAttributes({ keys: ['topic'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GetChatRoomAttributesInput` | 查询输入，可传 `keys` 获取指定属性；未传时获取全部属性。 |

#### 返回值

返回聊天室属性快照。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | keys 为空字符串、包含非法值，或请求体格式不符合要求 | 确保 keys 为合法非空字符串数组，或省略 keys 获取全部属性 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### setAttributes(input: SetChatRoomAttributesInput) => Promise<ChatRoomAttributeMutationResult>

#### 说明

设置当前聊天室属性。

#### 调用示例

调用示例（设置属性）

```ts
const result = await chatRoom.setAttributes({
  attributes: { topic: 'sdk' },
  autoDelete: true,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `SetChatRoomAttributesInput` | 设置输入，包含非空 `attributes`，可选 `autoDelete/isForced`。 |

#### 返回值

返回成功应用和失败的属性 key。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | 属性 key 数量超过限制，或属性字段格式不符合要求 | 确保每次设置的属性数量不超过限制，且 key/value 均为合法字符串 |
| 702 | chatroom_not_joined | 当前用户未加入目标聊天室，无法设置属性 | 先加入聊天室后重试 |
| 703 | chatroom_permission_denied | 当前用户无权设置目标属性（属性不属于当前用户且未使用 forced 模式） | 仅修改自己创建的属性，或使用 forced 模式覆盖 |
| 4 | exceed_limit | 单个聊天室属性数量或应用级属性总量超过服务端限制 | 删除不再使用的属性后重试，或联系服务端提升配额 |
| 210 | MetadataException | 当前用户不在聊天室内，或试图修改其他用户的聊天室属性 | 确认当前用户已加入聊天室，并仅修改自己有权限操作的属性 |

### removeAttributes(input: RemoveChatRoomAttributesInput) => Promise<ChatRoomAttributeMutationResult>

#### 说明

删除当前聊天室属性。

#### 调用示例

调用示例（删除属性）

```ts
const result = await chatRoom.removeAttributes({ keys: ['topic'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `RemoveChatRoomAttributesInput` | 删除输入，`keys` 必填且至少包含一个属性 key，可选 `isForced`。 |

#### 返回值

返回成功删除和失败的属性 key。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | 属性 key 数量超过限制，或 keys 字段格式不符合要求 | 确保每次删除的属性数量不超过限制，且 keys 为合法非空字符串数组 |
| 702 | chatroom_not_joined | 当前用户未加入目标聊天室，无法删除属性 | 先加入聊天室后重试 |
| 703 | chatroom_permission_denied | 当前用户无权删除目标属性 | 仅删除自己创建的属性，或使用 forced 模式 |
| 4 | exceed_limit | 属性操作超过服务端限制 | 减少单次操作的属性数量 |
| 210 | MetadataException | 当前用户不在聊天室内，或无权删除目标属性 | 确认当前用户已加入聊天室，并仅删除自己有权限操作的属性 |

## src/types/chatroom.ts

### ChatRoomSummary

#### 说明

聊天室列表中的摘要信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| name | `string` | 聊天室名称。 |
| owner | `UserInfo` | 聊天室所有者资料；SDK 会尽量从缓存或用户资料接口补齐。 |
| memberCount | `number` | 当前成员数量。 |
| disabled | `boolean` | 聊天室是否已禁用。 |

### ChatRoomListResult

#### 说明

聊天室分页列表返回值。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatRoomSummary>` | 当前页聊天室摘要列表。 |
| pageNum | `number` | 当前页码，从 1 开始；具体值取决于服务端返回。 |
| pageSize | `number` | 当前页大小。 |
| total | `number` | 服务端返回的总数。 |
| hasMore | `boolean` | 是否还有下一页。 |

### ChatRoomCurrentUserStatus

#### 说明

当前用户在聊天室内的状态。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| inAllowlist | `boolean` | 当前用户是否在 allowlist 中。 |
| muted | `boolean` | 当前用户是否被禁言。 |
| muteExpireAt | `number` | 当前用户禁言过期时间。 |
| permissionType | `ChatRoomPermissionType` | 当前用户权限类型。 |

### ChatRoomDetail

#### 说明

聊天室详情。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| description | `string` | 聊天室描述。 |
| maxMembers | `number` | 聊天室最大成员数。 |
| createdAt | `number` | 聊天室创建时间戳，单位由服务端返回决定。 |
| ext | `string` | 聊天室扩展信息。 |
| announcement | `string` | 聊天室公告。 |
| permissionType | `ChatRoomPermissionType` | 当前用户权限类型。 |
| currentUserStatus | `ChatRoomCurrentUserStatus` | 当前用户在聊天室内的状态快照。 |

### ChatRoomPageParams

#### 说明

页码分页参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pageNum | `number` | 页码，从 1 开始；未传时使用服务端默认值。 |
| pageSize | `number` | 每页数量；未传时使用服务端默认值。 |

### GetChatRoomInfoParams

#### 说明

查询聊天室详情参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID，必填。 |

### ChatRoomUpdateInfoInput

#### 说明

更新聊天室信息的输入字段。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | 新聊天室名称；未传则不修改。 |
| description | `string` | 新聊天室描述；未传则不修改。 |
| maxMembers | `number` | 新最大成员数；未传则不修改。 |

### UpdateChatRoomInfoParams

#### 说明

更新聊天室信息参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID，必填。 |

### ChatRoomUpdateResult

#### 说明

聊天室信息更新结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| nameUpdated | `boolean` | 名称是否已更新。 |
| descriptionUpdated | `boolean` | 描述是否已更新。 |
| maxMembersUpdated | `boolean` | 最大成员数是否已更新。 |

### ChatRoomMutationTarget

#### 说明

仅包含聊天室 ID 的通用操作目标。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID，必填。 |

### JoinChatRoomParams

#### 说明

加入聊天室参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| ext | `string` | 加入聊天室时透传给服务端的扩展信息。 |
| leaveOtherRooms | `boolean` | 是否离开当前账号已加入的其他聊天室；未传时由服务端默认策略决定。 |

### ChatRoomUserBatchInput

#### 说明

批量用户操作输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 用户 ID 列表，必填且至少包含一个有效用户 ID。 |

### ChatRoomUserBatchParams

#### 说明

带聊天室 ID 的批量用户操作参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 用户 ID 列表，必填且至少包含一个有效用户 ID。 |

### ChatRoomAdminInput

#### 说明

单个管理员操作输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 目标用户 ID，必填。 |

### ChatRoomAdminParams

#### 说明

带聊天室 ID 的管理员操作参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 目标用户 ID，必填。 |

### ChatRoomMemberEntry

#### 说明

聊天室成员条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 成员用户资料。 |
| role | `ChatRoomRole` | 成员角色。 |
| joinedAt | `number` | 成员加入时间戳。 |

### ChatRoomMemberListParams

#### 说明

聊天室成员列表查询参数。

### ChatRoomMemberListResult

#### 说明

聊天室成员列表返回值。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatRoomMemberEntry>` | 成员条目列表。 |
| cursor | `string` | 下一页游标；为空表示服务端未返回游标。 |
| hasMore | `boolean` | 是否还有下一页。 |

### ChatRoomMemberActionResult

#### 说明

单个成员操作结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| user | `UserInfo` | 目标用户资料。 |
| action | `string` | 操作名称。 |
| reason | `string` | 失败原因；仅失败时可能返回。 |

### ChatRoomMemberActionListResult

#### 说明

批量成员操作结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| succeeded | `ReadonlyArray<ChatRoomMemberActionResult>` | 操作成功的目标用户结果。 |
| failed | `ReadonlyArray<ChatRoomMemberActionResult>` | 操作失败的目标用户结果。 |

### ChatRoomMuteEntry

#### 说明

禁言列表条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 被禁言用户资料。 |
| muteExpire | `number` | 禁言过期时间。 |
| duration | `number` | 禁言时长，单位通常为秒，具体以服务端返回为准。 |

### ChatRoomMuteMembersInput

#### 说明

禁言成员输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待禁言用户 ID 列表，必填。 |
| duration | `number` | 禁言时长，单位为秒。 |

### ChatRoomMuteMembersParams

#### 说明

带聊天室 ID 的禁言成员参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待禁言用户 ID 列表，必填。 |
| duration | `number` | 禁言时长，单位为秒。 |

### ChatRoomMuteStatus

#### 说明

当前用户禁言状态。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| muted | `boolean` | 当前用户是否被禁言。 |
| muteExpireAt | `number` | 禁言过期时间。 |

### ChatRoomMuteListParams

#### 说明

禁言列表查询参数。

### ChatRoomAllowlistEntry

#### 说明

allowlist 条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | allowlist 用户资料。 |

### ChatRoomBlocklistEntry

#### 说明

黑名单条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 黑名单用户资料。 |

### ChatRoomBlocklistParams

#### 说明

黑名单分页查询参数。

### ChatRoomAnnouncement

#### 说明

聊天室公告。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | 公告内容。 |

### ChatRoomAnnouncementUpdateInput

#### 说明

更新公告输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | 新公告内容，必填。 |

### ChatRoomAnnouncementUpdateParams

#### 说明

带聊天室 ID 的更新公告参数。

### ChatRoomSharedFile

#### 说明

聊天室共享文件条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 文件 ID。 |
| fileName | `string` | 文件名。 |
| fileOwner | `UserInfo` | 文件上传者资料。 |
| fileSize | `number` | 文件大小，单位为字节。 |
| createdAt | `number` | 文件创建时间戳。 |

### ChatRoomSharedFileListParams

#### 说明

聊天室共享文件列表查询参数。

### ChatRoomSharedFileListResult

#### 说明

聊天室共享文件列表返回值。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatRoomSharedFile>` | 共享文件列表。 |
| pageNum | `number` | 当前页码。 |
| pageSize | `number` | 当前页大小。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有下一页。 |

### ChatRoomDeleteSharedFileInput

#### 说明

删除共享文件输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 文件 ID，必填。 |

### DeleteChatRoomSharedFileParams

#### 说明

带聊天室 ID 的删除共享文件参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 文件 ID，必填。 |

### GetChatRoomAttributesInput

#### 说明

查询聊天室属性输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | 指定要查询的属性 key；未传时查询全部属性。 |

### GetChatRoomAttributesParams

#### 说明

带聊天室 ID 的查询属性参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | 指定要查询的属性 key；未传时查询全部属性。 |

### SetChatRoomAttributesInput

#### 说明

设置聊天室属性输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| attributes | `Readonly<Record<string, string>>` | 要设置的属性键值对，key/value 均必须为字符串。 |
| autoDelete | `boolean` | 成员退出聊天室时是否自动删除其设置的属性。默认 `true`。 |
| isForced | `boolean` | 是否允许覆盖其他成员设置的属性。默认 `false`。 |

### SetChatRoomAttributesParams

#### 说明

带聊天室 ID 的设置属性参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| attributes | `Readonly<Record<string, string>>` | 要设置的属性键值对，key/value 均必须为字符串。 |
| autoDelete | `boolean` | 成员退出聊天室时是否自动删除其设置的属性。默认 `true`。 |
| isForced | `boolean` | 是否允许覆盖其他成员设置的属性。默认 `false`。 |

### RemoveChatRoomAttributesInput

#### 说明

删除聊天室属性输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | 要删除的属性 key 列表，必填。 |
| isForced | `boolean` | 是否允许删除其他成员设置的属性。默认 `false`。 |

### RemoveChatRoomAttributesParams

#### 说明

带聊天室 ID 的删除属性参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | 要删除的属性 key 列表，必填。 |
| isForced | `boolean` | 是否允许删除其他成员设置的属性。默认 `false`。 |

### ChatRoomAttributesSnapshot

#### 说明

聊天室属性快照。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| attributes | `Readonly<Record<string, string>>` | 属性键值对。 |

### ChatRoomAttributeMutationResult

#### 说明

聊天室属性批量变更结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| appliedKeys | `ReadonlyArray<string>` | 已成功应用的属性 key。 |
| failedKeys | `Readonly<
    Record<string, { readonly code: number; readonly message: string }>
  >` | 设置或删除失败的属性 key 到错误信息的映射。 |

### ChatRoomDestroyedEventPayload

#### 说明

聊天室被销毁事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomName | `string` | 聊天室名称。 |

### ChatRoomMembersJoinedEventPayload

#### 说明

成员加入聊天室事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomName | `string` | 聊天室名称。 |
| members | `ReadonlyArray<UserInfo>` | 加入聊天室的成员列表。 |
| ext | `string` | 加入时透传的扩展信息。 |

### ChatRoomMembersExitedEventPayload

#### 说明

成员退出聊天室事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomName | `string` | 聊天室名称。 |
| members | `ReadonlyArray<UserInfo>` | 退出聊天室的成员列表。 |

### ChatRoomRemovedFromChatRoomEventPayload

#### 说明

当前用户被移出聊天室事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reason | `number` | 被移出的原因码。 |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomName | `string` | 聊天室名称。 |
| participant | `UserInfo` | 触发移除的参与者资料。 |

### ChatRoomMuteListAddedEventPayload

#### 说明

聊天室禁言列表新增事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| mutes | `ReadonlyArray<ChatRoomMuteEntry>` | 新增的禁言条目。 |
| muteExpire | `number` | 禁言过期时间。 |

### ChatRoomMuteListRemovedEventPayload

#### 说明

聊天室禁言列表移除事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| mutes | `ReadonlyArray<UserInfo>` | 解除禁言的用户资料列表。 |

### ChatRoomAllowListAddedEventPayload

#### 说明

聊天室 allowlist 新增事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| allowlist | `ReadonlyArray<UserInfo>` | 新增到 allowlist 的用户资料。 |

### ChatRoomAllowListRemovedEventPayload

#### 说明

聊天室 allowlist 移除事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| allowlist | `ReadonlyArray<UserInfo>` | 从 allowlist 移除的用户资料。 |

### ChatRoomAllMemberMuteStateChangedEventPayload

#### 说明

聊天室全员禁言状态变更事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| isMuted | `boolean` | 当前是否已开启全员禁言。 |

### ChatRoomAdminAddedEventPayload

#### 说明

聊天室管理员新增事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| admin | `UserInfo` | 新增管理员资料。 |

### ChatRoomAdminRemovedEventPayload

#### 说明

聊天室管理员移除事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| admin | `UserInfo` | 被移除管理员资料。 |

### ChatRoomOwnerChangedEventPayload

#### 说明

聊天室所有者变更事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| newOwner | `UserInfo` | 新所有者资料。 |
| oldOwner | `UserInfo` | 原所有者资料。 |

### ChatRoomAnnouncementChangedEventPayload

#### 说明

聊天室公告变更事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| announcement | `string` | 最新公告内容。 |

### ChatRoomInfoChangedEventPayload

#### 说明

聊天室信息变更事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomInfo | `ChatRoomDetail` | 最新聊天室详情。 |

### ChatRoomAttributesUpdateEventPayload

#### 说明

聊天室属性更新事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| attributes | `Readonly<Record<string, string>>` | 更新后的属性键值对。 |
| from | `UserInfo` | 触发更新的用户资料。 |

### ChatRoomAttributesRemovedEventPayload

#### 说明

聊天室属性删除事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| keyList | `ReadonlyArray<string>` | 被删除的属性 key 列表。 |
| from | `UserInfo` | 触发删除的用户资料。 |

### ChatRoomEventPayloadMap

#### 说明

聊天室事件名到载荷类型的映射。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onChatRoomDestroyed | `ChatRoomDestroyedEventPayload` | 聊天室被销毁事件载荷。 |
| onMembersJoined | `ChatRoomMembersJoinedEventPayload` | 成员加入聊天室事件载荷。 |
| onMembersExited | `ChatRoomMembersExitedEventPayload` | 成员退出聊天室事件载荷。 |
| onRemovedFromChatRoom | `ChatRoomRemovedFromChatRoomEventPayload` | 当前用户被移出聊天室事件载荷。 |
| onMuteListAdded | `ChatRoomMuteListAddedEventPayload` | 禁言列表新增事件载荷。 |
| onMuteListRemoved | `ChatRoomMuteListRemovedEventPayload` | 禁言列表移除事件载荷。 |
| onAllowListAdded | `ChatRoomAllowListAddedEventPayload` | allowlist 新增事件载荷。 |
| onAllowListRemoved | `ChatRoomAllowListRemovedEventPayload` | allowlist 移除事件载荷。 |
| onAllMemberMuteStateChanged | `ChatRoomAllMemberMuteStateChangedEventPayload` | 全员禁言状态变更事件载荷。 |
| onAdminAdded | `ChatRoomAdminAddedEventPayload` | 管理员新增事件载荷。 |
| onAdminRemoved | `ChatRoomAdminRemovedEventPayload` | 管理员移除事件载荷。 |
| onOwnerChanged | `ChatRoomOwnerChangedEventPayload` | 所有者变更事件载荷。 |
| onAnnouncementChanged | `ChatRoomAnnouncementChangedEventPayload` | 公告变更事件载荷。 |
| onChatRoomInfoChanged | `ChatRoomInfoChangedEventPayload` | 聊天室信息变更事件载荷。 |
| onAttributesUpdate | `ChatRoomAttributesUpdateEventPayload` | 属性更新事件载荷。 |
| onAttributesRemoved | `ChatRoomAttributesRemovedEventPayload` | 属性删除事件载荷。 |

## src/managers/contact-manager.ts

### ContactManager

### getContacts() => ReadonlyArray<Contact>

#### 说明

获取当前内存中的联系人列表视图。

#### 调用示例

调用示例（读取联系人列表）

```ts
const contacts = client.contactManager.getContacts();
console.log(contacts[0]?.userId);
```

#### 返回值

返回当前联系人列表；若暂无可用数据则返回空数组。

### addContact(params: AddContactParams) => Promise<void>

#### 说明

发送联系人申请。

#### 调用示例

调用示例（发送联系人申请）

```ts
await client.contactManager.addContact({
  userId: 'user-1',
  message: '我是 Alice',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `AddContactParams` | 目标用户与可选验证消息。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userId 为空、不是字符串，或 message 不是字符串 | 传入非空字符串 userId；message 如需传入也必须是字符串 |
| 204 | USER_NOT_FOUND | 目标用户不存在 | 确认用户 ID 正确 |
| 1000 | ALREADY_FRIEND | 添加联系人失败：已是好友 | - |
| 210 | BLOCKED_BY_USER | 用户无权限：被对方拉黑 | - |
| 1001 | CONTACT_REACH_LIMIT | 当前用户的联系人数量已达服务端上限 | 删除不再使用的联系人后重试，或联系服务端提升配额 |
| 1002 | CONTACT_REACH_LIMIT_PEER | 对方的联系人数量已达服务端上限 | 联系对方清理联系人列表 |

### deleteContact(params: ContactMutationTarget) => Promise<void>

#### 说明

删除联系人，并立即修补当前会话中的联系人快照。

#### 调用示例

调用示例（删除联系人）

```ts
await client.contactManager.deleteContact({
  userId: 'user-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ContactMutationTarget` | 目标用户。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userId 为空或不是字符串 | 传入非空字符串 userId |
| 204 | USER_NOT_FOUND | 目标用户不存在 | 确认用户 ID 正确 |

### acceptContactInvite(params: ContactMutationTarget) => Promise<void>

#### 说明

接受联系人申请，并触发受控联系人刷新。

#### 调用示例

调用示例（接受联系人申请）

```ts
await client.contactManager.acceptContactInvite({
  userId: 'user-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ContactMutationTarget` | 目标用户。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userId 为空或不是字符串 | 传入非空字符串 userId |
| 204 | USER_NOT_FOUND | 目标用户不存在 | 确认用户 ID 正确 |
| 1001 | CONTACT_REACH_LIMIT | 当前用户的联系人数量已达服务端上限 | 删除不再使用的联系人后重试 |
| 1002 | CONTACT_REACH_LIMIT_PEER | 对方的联系人数量已达服务端上限 | 联系对方清理联系人列表 |

### declineContactInvite(params: ContactMutationTarget) => Promise<void>

#### 说明

拒绝联系人申请。

#### 调用示例

调用示例（拒绝联系人申请）

```ts
await client.contactManager.declineContactInvite({
  userId: 'user-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ContactMutationTarget` | 目标用户。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userId 为空或不是字符串 | 传入非空字符串 userId |
| 204 | USER_NOT_FOUND | 目标用户不存在 | 确认用户 ID 正确 |

### setContactRemark(params: SetContactRemarkParams) => Promise<void>

#### 说明

设置联系人备注，允许传入空字符串以清空备注。

#### 调用示例

调用示例（设置联系人备注）

```ts
await client.contactManager.setContactRemark({
  userId: 'user-1',
  remark: '产品同学',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SetContactRemarkParams` | 目标用户与备注内容。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userId 为空、不是字符串，或 remark 不是字符串 | 传入非空字符串 userId，并确保 remark 为字符串；可传空字符串清空备注 |
| 223 | illegal_argument | 目标用户不是当前用户的好友 | 先添加好友再设置备注 |
| 4 | remark_length_exceeded | 备注内容超过服务端允许的最大长度 | 缩短备注内容后重试 |

### getBlocklist() => Promise<ReadonlyArray<UserInfo>>

#### 说明

获取当前用户的黑名单列表。

#### 调用示例

调用示例（获取黑名单）

```ts
const blocklist = await client.contactManager.getBlocklist();
console.log(blocklist.map(item => item.userId));
```

#### 返回值

返回黑名单用户资料列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### addUsersToBlocklist(params: BlocklistMutationParams) => Promise<BlocklistAddResult>

#### 说明

批量添加黑名单用户，重复值会在请求前去重并保持原始顺序。

#### 调用示例

调用示例（添加黑名单）

```ts
const result = await client.contactManager.addUsersToBlocklist({
  userIds: ['user-1', 'user-2'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `BlocklistMutationParams` | 待加入黑名单的用户 ID 列表。 |

#### 返回值

返回成功与失败两类用户资料列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userIds 不是非空数组，或数组项不是字符串 | 传入至少一个非空字符串 userId；重复值会由 SDK 去重 |
| 204 | service_resource_not_found | 目标用户不存在 | 确认用户 ID 正确 |
| 4 | blocklist_limit_exceeded | 黑名单数量已达服务端上限 | 移除不再需要的黑名单用户后重试 |

### removeUserFromBlocklist(params: BlocklistMutationParams) => Promise<void>

#### 说明

批量移除黑名单用户，重复值会在请求前去重并保持原始顺序。

#### 调用示例

调用示例（移除黑名单）

```ts
await client.contactManager.removeUserFromBlocklist({
  userIds: ['user-1'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `BlocklistMutationParams` | 待移除的黑名单用户 ID 列表。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userIds 不是非空数组，或数组项不是字符串 | 传入至少一个非空字符串 userId；重复值会由 SDK 去重 |

### addEventHandler(id: string, handlers: ContactEventHandlerMap) => void

#### 说明

注册联系人事件处理器，用于接收联系人关系事件；自动同步进度请在 ChatClient 级监听统一同步事件。

#### 调用示例

调用示例（监听联系人添加事件）

```ts
client.contactManager.addEventHandler('contact-ui', {
  onContactAdded: event => {
    console.log(event.from);
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `string` | 事件处理器唯一 ID，用于后续移除。 |
| handlers | `ContactEventHandlerMap` | 联系人事件处理器集合，按需实现对应回调。 |

#### 返回值

注册完成后无返回值。

### removeEventHandler(id: string) => void

#### 说明

移除已注册的联系人同步事件处理器。

#### 调用示例

调用示例（移除联系人事件处理器）

```ts
client.contactManager.removeEventHandler('contact-ui');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `string` | 待移除的事件处理器 ID。 |

#### 返回值

移除完成后无返回值。

## src/types/contact.ts

### Contact

#### 说明

联系人展示对象。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 联系人用户 ID。 |
| userInfo | `UserInfo` | 联系人资料视图，直接复用统一 `UserInfo`。 |
| remark | `string` | 当前用户给该联系人的备注。 |
| addTs | `number` | 联系人关系建立时间。 |

### ContactInfoUpdatedEvent

#### 说明

好友资料变化事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userInfo | `UserInfo` | 最新好友资料。 |
| contact | `Contact` | 当前会话中可用的联系人快照。 |

### ContactMutationTarget

#### 说明

联系人写操作的统一目标。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 目标用户 ID。 |

### AddContactParams

#### 说明

添加联系人的输入参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `string` | 可选的验证消息。 |

### SetContactRemarkParams

#### 说明

更新联系人备注的输入参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| remark | `string` | 联系人备注，允许空字符串以清空备注。 |

### BlocklistMutationParams

#### 说明

黑名单增删接口的输入参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待处理的用户 ID 列表。 |

### BlocklistAddResult

#### 说明

黑名单添加成功结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| succeeded | `ReadonlyArray<UserInfo>` | 成功加入黑名单的用户资料列表。 |
| failed | `ReadonlyArray<UserInfo>` | 加入失败的用户资料列表。 |

### BlocklistSnapshot

#### 说明

会话级黑名单快照。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<UserInfo>` | 当前黑名单条目列表。 |
| loaded | `boolean` | 当前会话是否已完成过服务端加载。 |
| source | `'server' | 'mutation_patch'` | 快照来源。 |

### ContactRosterEventPayload

#### 说明

原工程联系人 roster 事件的标准化载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| type | `ContactRosterEventType` | 原工程事件中的关系类型。 |
| from | `string` | 事件发送方用户 ID。 |
| to | `string` | 事件接收方用户 ID。 |
| status | `string` | 服务端附带的状态/原因字符串。 |
| rosterVersion | `string` | 当前 roster 版本号。 |
| userInfo | `UserInfo` | 事件目标用户的资料视图；对外事件会在派发前补齐，至少包含 `userId`。 |

### ContactSnapshot

#### 说明

联系人快照，包含列表、来源、版本和完整性信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<Contact>` | 当前快照中的联系人列表。 |
| source | `ContactSyncSource` | 当前快照来自缓存还是同步结果。 |
| version | `string` | 当前快照对应的联系人版本号。 |
| complete | `boolean` | 当前快照是否可作为完整联系人结果使用。 |

### ContactSyncError

#### 说明

联系人同步错误对象。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| code | `ErrorCode` | SDK 错误码。 |
| stage | `ContactSyncStage` | 错误发生阶段。 |
| message | `string` | 面向调用方的错误消息。 |
| retryable | `boolean` | 当前错误是否建议重试。 |

### ContactSyncFinishPayload

#### 说明

联系人同步内部完成载荷；公开同步事件已统一到 ChatClient 级 `onSyncDataFinished`。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| error | `ContactSyncError` | 失败时返回错误详情。 |

## src/managers/group-manager.ts

### GroupManager

### addEventHandler(id: EventHandlerId, handlers: GroupEventHandlerMap) => void

#### 说明

注册群组事件处理器。

#### 调用示例

监听群成员加入事件

```ts
client.groupManager.addEventHandler('group-events', {
  onMembersJoined: event => console.log(event.groupId, event.members),
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一 ID，用于后续移除。 |
| handlers | `GroupEventHandlerMap` | 群组事件处理器集合。 |

#### 返回值

注册完成后无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除群组事件处理器。

#### 调用示例

移除监听

```ts
client.groupManager.removeEventHandler('group-events');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 待移除的事件处理器 ID。 |

#### 返回值

移除完成后无返回值。

### createGroup(params: CreateGroupParams) => Promise<CreateGroupResult>

#### 说明

创建群组，可指定初始成员、公开属性、入群审批、邀请策略与最大人数。

#### 调用示例

创建公开群

```ts
const result = await client.groupManager.createGroup({
  name: 'Developers',
  description: 'SDK discussion',
  memberIds: ['user-1', 'user-2'],
  public: true,
  joinApprovalRequired: false,
  allowInvites: true,
  inviteNeedConfirm: true,
  maxMembers: 200,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateGroupParams` | 创建群组参数。 |

#### 返回值

返回创建成功后的群 ID。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | invalid_parameter | 创建群组时缺少 public、name 等必填字段，或字段格式不符合服务端约束 | 检查创建群组请求体，补齐必填字段并修正字段格式 |
| 110 | illegal_argument | 群组 ID 冲突、头像字段过长，或请求字段组合不符合服务端要求 | 更换冲突参数，并确保请求字段长度与取值范围合法 |
| 4 | exceed_limit | 应用可创建群数量、用户可加入群数量或创建群初始成员数量触达服务限制 | 减少创建或加入数量，或联系服务端提升限制 |
| 608 | group_name_violation | 群组名称触发服务端敏感词或命名规范校验 | 更换为合法群组名称后重试 |
| 204 | resource_not_found | 创建群组时附带的成员列表中包含不存在的用户 | 确认 memberIds 中的用户都已存在 |

### getJoinedGroupList() => ReadonlyArray<JoinedGroupSummary>

#### 说明

读取当前用户已加入群组的本地同步列表；该方法只读本地缓存和当前会话运行时数据，不发起网络请求。

#### 调用示例

读取已加入群本地列表

```ts
const groups = client.groupManager.getJoinedGroupList();
```

#### 返回值

返回本地已加入群组轻量数组。

### getGroup(groupId: string) => Group

#### 说明

获取绑定指定群 ID 的单群操作对象；该方法不发起网络请求。

#### 调用示例

获取单群对象

```ts
const group = client.groupManager.getGroup('group-1');
await group.getDetail();
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |

#### 返回值

返回绑定该群 ID 的 `Group` 对象。

#### 可能错误

- 错误码 `100`：`groupId` 为空。

### getGroupInfo(params: GetGroupInfoParams) => Promise<GroupDetail>

#### 说明

从服务端获取单个群组详情。

#### 调用示例

获取群详情

```ts
const detail = await client.groupManager.getGroupInfo({ groupId: 'group-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetGroupInfoParams` | 群组详情查询参数。 |

#### 返回值

返回标准化群详情。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |

### getGroupInfoList(params: GetGroupInfoListParams) => Promise<ReadonlyArray<GroupDetail>>

#### 说明

批量获取多个群组详情。

#### 调用示例

批量获取群详情

```ts
const groups = await client.groupManager.getGroupInfoList({
  groupIds: ['group-1', 'group-2'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetGroupInfoListParams` | 群组 ID 列表。 |

#### 返回值

返回标准化群详情数组。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | groupIds 中存在无效群组 ID | 确认 groupIds 中的群组都存在 |

### joinGroup(params: GroupJoinParams) => Promise<void>

#### 说明

申请加入或直接加入指定群组，取决于群组入群审批配置。

#### 调用示例

加入群组

```ts
await client.groupManager.joinGroup({
  groupId: 'group-1',
  message: 'Please approve my request',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupJoinParams` | 群组 ID 与可选申请原因。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 600 | group_invalid_id | 传入的 groupId 为空、格式不合法或不符合服务端约束 | 检查并传入合法的 groupId |
| 601 | already_joined | 当前用户已经加入目标群组 | 无需重复加入，直接使用现有群组上下文 |
| 602 | not_joined | 当前用户不在该群组中，或服务端要求当前用户先成为群成员 | 确认当前用户已加入目标群组 |
| 603 | group_authorization | 加入群组需要管理员审批，或当前用户没有权限加入目标群组 | 等待管理员审批，或改用有权限的账号重试 |
| 604 | group_full | 目标群组人数已达到上限，无法继续加入 | 清理群成员或提升群人数上限后重试 |
| 606 | resource_not_found | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |
| 607 | group_disabled | 目标群组处于禁用状态，服务端拒绝加入 | 确认群组状态恢复正常后再尝试加入 |
| 613 | group_user_in_blocklist | 当前用户处于群组黑名单或禁入名单中，服务端拒绝加入 | 联系群主或管理员移出对应名单后重试 |

### inviteUsersToGroup(params: GroupUserBatchParams) => Promise<void>

#### 说明

邀请用户加入指定群组。

#### 调用示例

邀请成员

```ts
await client.groupManager.inviteUsersToGroup({
  groupId: 'group-1',
  userIds: ['user-2', 'user-3'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupUserBatchParams` | 群组 ID 与被邀请用户 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 603 | group_authorization | 当前用户没有邀请成员入群的权限 | 使用有邀请权限的账号重试 |
| 204 | resource_not_found | 被邀请用户不存在 | 确认 userIds 中的用户都已存在 |
| 606 | group_not_found | 目标群组不存在或已被销毁 | 确认 groupId 正确且群组仍存在 |
| 607 | group_disabled | 目标群组处于禁用状态，服务端拒绝邀请入群 | 确认群组状态恢复正常后再重试 |

### acceptGroupJoinRequest(params: AcceptGroupJoinRequestParams) => Promise<void>

#### 说明

同意用户的入群申请。

#### 调用示例

同意入群申请

```ts
await client.groupManager.acceptGroupJoinRequest({
  groupId: 'group-1',
  userId: 'user-2',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `AcceptGroupJoinRequestParams` | 群组 ID 与申请人用户 ID。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：申请人 ID 非法、申请不存在或群组不存在。
- 错误码 `202`：鉴权失败或无权限。

### rejectGroupJoinRequest(params: RejectGroupJoinRequestParams) => Promise<void>

#### 说明

拒绝用户的入群申请。

#### 调用示例

拒绝入群申请

```ts
await client.groupManager.rejectGroupJoinRequest({
  groupId: 'group-1',
  userId: 'user-2',
  reason: 'Group is full',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `RejectGroupJoinRequestParams` | 群组 ID、申请人用户 ID 与拒绝原因。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：申请人 ID、拒绝原因非法，申请不存在或群组不存在。
- 错误码 `202`：鉴权失败或无权限。

### acceptInvitation(params: GroupMutationTarget) => Promise<void>

#### 说明

接受当前用户收到的群组邀请。

#### 调用示例

接受群邀请

```ts
await client.groupManager.acceptInvitation({ groupId: 'group-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupMutationTarget` | 群组 ID。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：群 ID 非法、邀请不存在或群组不存在。
- 错误码 `202`：鉴权失败。

### rejectInvitation(params: GroupMutationTarget) => Promise<void>

#### 说明

拒绝当前用户收到的群组邀请。

#### 调用示例

拒绝群邀请

```ts
await client.groupManager.rejectInvitation({ groupId: 'group-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupMutationTarget` | 群组 ID。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：群 ID 非法、邀请不存在或群组不存在。
- 错误码 `202`：鉴权失败。

### hydrateMessageProfileGroupNamecards(groupId: string, targets: ReadonlyArray<GroupNamecardHydrationTarget>) => Promise<void>

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| targets | `ReadonlyArray<GroupNamecardHydrationTarget>` | - |

## src/managers/group/group.ts

### Group

### getSummary() => JoinedGroupSummary | null

#### 说明

读取当前会话或本地预览中已知的已加入群轻量摘要；该方法不发起网络请求，也不代表完整群详情。

#### 调用示例

读取本地轻量摘要

```ts
const group = client.groupManager.getGroup('group-1');
const summary = group.getSummary();
```

#### 返回值

返回本地已知轻量摘要；未知时返回 `null`。

### getDetail() => Promise<GroupDetail>

#### 说明

获取当前群组详情；优先返回当前会话内可用快照，必要时从服务端刷新。

#### 调用示例

获取群详情

```ts
const group = client.groupManager.getGroup('group-1');
const detail = await group.getDetail();
```

#### 返回值

返回标准化群详情。

#### 可能错误

- 错误码 `110`：群 ID 非法或群组不存在。
- 错误码 `202`：鉴权失败。

### refresh() => Promise<GroupDetail>

#### 说明

强制从服务端刷新当前群组详情。

#### 调用示例

刷新群详情

```ts
const detail = await client.groupManager.getGroup('group-1').refresh();
```

#### 返回值

返回刷新后的标准化群详情。

#### 可能错误

- 错误码 `110`：群 ID 非法或群组不存在。
- 错误码 `202`：鉴权失败。

### updateInfo(input: GroupUpdateInfoInput) => Promise<void>

#### 说明

更新当前群组基础资料，例如名称、描述、头像或扩展字段。

#### 调用示例

更新群名称

```ts
await client.groupManager.getGroup('group-1').updateInfo({ name: 'New group name' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUpdateInfoInput` | 群资料更新字段。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：参数非法或群组不存在。
- 错误码 `202`：鉴权失败。

### updateConfigs(input: GroupUpdateConfigsInput) => Promise<void>

#### 说明

更新当前群组配置，例如公开属性、入群审批、成员邀请权限或人数上限。

#### 调用示例

关闭成员邀请

```ts
await client.groupManager.getGroup('group-1').updateConfigs({ allowInvites: false });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUpdateConfigsInput` | 群配置更新字段。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：参数非法或群组不存在。
- 错误码 `202`：鉴权失败。

### changeOwner(input: GroupOwnerChangeInput) => Promise<void>

#### 说明

转让当前群组所有权。

#### 调用示例

转让群主

```ts
await client.groupManager.getGroup('group-1').changeOwner({ newOwner: 'user-2' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupOwnerChangeInput` | 新群主用户 ID。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：新群主非法、不在群内或群组不存在。
- 错误码 `202`：鉴权失败。

### destroy() => Promise<void>

#### 说明

解散当前群组。

#### 调用示例

解散群组

```ts
await client.groupManager.getGroup('group-1').destroy();
```

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：群 ID 非法或群组不存在。
- 错误码 `202`：鉴权失败或无权限。

### leave() => Promise<void>

#### 说明

当前登录用户主动退出群组。

#### 调用示例

退出群组

```ts
await client.groupManager.getGroup('group-1').leave();
```

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：群 ID 非法、群组不存在或当前用户不在群内。
- 错误码 `202`：鉴权失败。

### getMembers(query: GroupMemberListQuery) => Promise<GroupMemberListResult>

#### 说明

分页获取当前群组成员列表。

#### 调用示例

获取群成员

```ts
const page = await client.groupManager.getGroup('group-1').getMembers({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| query | `GroupMemberListQuery` | 可选分页参数。 |

#### 返回值

返回成员分页结果。

#### 可能错误

- 错误码 `110`：群 ID 或分页参数非法。
- 错误码 `202`：鉴权失败。

### removeMembers(input: GroupUserBatchInput) => Promise<void>

#### 说明

从当前群组移除成员。

#### 调用示例

移除群成员

```ts
await client.groupManager.getGroup('group-1').removeMembers({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待移除成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法移除成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAdmins() => Promise<ReadonlyArray<UserInfo>>

#### 说明

获取当前群组管理员列表。

#### 调用示例

获取管理员

```ts
const admins = await client.groupManager.getGroup('group-1').getAdmins();
```

#### 返回值

返回管理员用户资料列表。

#### 可能错误

- 错误码 `110`：群 ID 非法或群组不存在。
- 错误码 `202`：鉴权失败。

### addAdmin(input: { userId: string }) => Promise<void>

#### 说明

添加群管理员。

#### 调用示例

添加管理员

```ts
await client.groupManager.getGroup('group-1').addAdmin({ userId: 'user-2' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `{ userId: string }` | 管理员用户 ID。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：用户 ID 非法、用户不在群内或群组不存在。
- 错误码 `202`：鉴权失败或无权限。

### removeAdmin(input: { userId: string }) => Promise<void>

#### 说明

移除群管理员。

#### 调用示例

移除管理员

```ts
await client.groupManager.getGroup('group-1').removeAdmin({ userId: 'user-2' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `{ userId: string }` | 管理员用户 ID。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室所有者，无法移除管理员 | 使用聊天室 owner 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getMuteList(page: GroupMuteListQuery) => Promise<ReadonlyArray<GroupMuteEntry>>

#### 说明

获取当前群组禁言列表。

#### 调用示例

获取禁言列表

```ts
const mutes = await client.groupManager.getGroup('group-1').getMuteList({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| page | `GroupMuteListQuery` | 可选分页参数。 |

#### 返回值

返回禁言成员列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### muteMembers(input: GroupMuteMembersInput) => Promise<void>

#### 说明

禁言当前群组中的指定成员。

#### 调用示例

禁言成员

```ts
await client.groupManager.getGroup('group-1').muteMembers({
  userIds: ['user-2'],
  muteDuration: 3600,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupMuteMembersInput` | 成员 ID 列表与禁言时长，单位秒。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | muteDuration、userIds 或请求体字段不符合服务端约束 | 检查 userIds 与 muteDuration，确保传入有效值 |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法禁言成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### unmuteMembers(input: GroupUserBatchInput) => Promise<void>

#### 说明

解除当前群组中指定成员的禁言。

#### 调用示例

解除禁言

```ts
await client.groupManager.getGroup('group-1').unmuteMembers({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待解除禁言的成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法解除禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### muteAllMembers() => Promise<void>

#### 说明

开启当前群组全员禁言。

#### 调用示例

开启全员禁言

```ts
await client.groupManager.getGroup('group-1').muteAllMembers();
```

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法开启全员禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### unmuteAllMembers() => Promise<void>

#### 说明

关闭当前群组全员禁言。

#### 调用示例

关闭全员禁言

```ts
await client.groupManager.getGroup('group-1').unmuteAllMembers();
```

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法关闭全员禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getBlocklist(page: NumberPageParams) => Promise<ReadonlyArray<GroupBlocklistEntry>>

#### 说明

获取当前群组黑名单列表。

#### 调用示例

获取群黑名单

```ts
const blocklist = await client.groupManager.getGroup('group-1').getBlocklist({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| page | `NumberPageParams` | 可选分页参数。 |

#### 返回值

返回黑名单成员列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### blockMembers(input: GroupUserBatchInput) => Promise<void>

#### 说明

将指定成员加入当前群组黑名单。

#### 调用示例

加入黑名单

```ts
await client.groupManager.getGroup('group-1').blockMembers({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待加入黑名单的成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法拉黑成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
| 204 | service_resource_not_found | 待加入黑名单的用户不存在 | 确认 userIds 中的用户都已存在 |

### unblockMembers(input: GroupUserBatchInput) => Promise<void>

#### 说明

将指定成员移出当前群组黑名单。

#### 调用示例

移出黑名单

```ts
await client.groupManager.getGroup('group-1').unblockMembers({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待移出黑名单的成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法移除黑名单成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAllowlist() => Promise<ReadonlyArray<GroupAllowlistEntry>>

#### 说明

获取当前群组白名单列表。

#### 调用示例

获取白名单

```ts
const allowlist = await client.groupManager.getGroup('group-1').getAllowlist();
```

#### 返回值

返回白名单成员列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### addUsersToAllowlist(input: GroupUserBatchInput) => Promise<void>

#### 说明

将指定成员加入当前群组白名单。

#### 调用示例

加入白名单

```ts
await client.groupManager.getGroup('group-1').addUsersToAllowlist({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待加入白名单的成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
| 204 | service_resource_not_found | 待加入 allowlist 的用户不存在 | 确认 userIds 中的用户都已存在 |

### removeUsersFromAllowlist(input: GroupUserBatchInput) => Promise<void>

#### 说明

将指定成员移出当前群组白名单。

#### 调用示例

移出白名单

```ts
await client.groupManager.getGroup('group-1').removeUsersFromAllowlist({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待移出白名单的成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### checkIfInAllowList() => Promise<boolean>

#### 说明

查询当前用户是否在当前群组白名单中。

#### 调用示例

查询是否在白名单

```ts
const inAllowlist = await client.groupManager.getGroup('group-1').checkIfInAllowList();
```

#### 返回值

当前用户在白名单中返回 `true`。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### checkIfInMuteList() => Promise<boolean>

#### 说明

查询当前用户是否在当前群组禁言列表中。

#### 调用示例

查询是否被禁言

```ts
const muted = await client.groupManager.getGroup('group-1').checkIfInMuteList();
```

#### 返回值

当前用户在禁言列表中返回 `true`。

#### 可能错误

- 错误码 `110`：群 ID 非法或群组不存在。
- 错误码 `202`：鉴权失败。

### getAnnouncement() => Promise<GroupAnnouncement>

#### 说明

获取当前群组公告。

#### 调用示例

获取群公告

```ts
const announcement = await client.groupManager.getGroup('group-1').getAnnouncement();
```

#### 返回值

返回群公告对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### updateAnnouncement(input: GroupAnnouncementUpdateInput) => Promise<void>

#### 说明

更新当前群组公告。

#### 调用示例

更新群公告

```ts
await client.groupManager.getGroup('group-1').updateAnnouncement({ announcement: 'Welcome' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupAnnouncementUpdateInput` | 新公告内容。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改公告 | 使用聊天室 owner/admin 账号重试 |
| 110 | forbidden_op | 公告长度超过服务端允许上限 | 缩短公告内容后重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getSharedFileList(query: GroupSharedFileListQuery) => Promise<GroupSharedFileListResult>

#### 说明

分页获取当前群组共享文件列表。

#### 调用示例

获取共享文件

```ts
const files = await client.groupManager.getGroup('group-1').getSharedFileList({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| query | `GroupSharedFileListQuery` | 可选分页参数。 |

#### 返回值

返回共享文件分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### uploadSharedFile(input: GroupUploadSharedFileInput) => Promise<void>

#### 说明

上传文件到当前群组共享文件列表。

#### 调用示例

上传共享文件

```ts
await client.groupManager.getGroup('group-1').uploadSharedFile({
  file,
  onFileUploadProgress: event => console.log(event.loaded),
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUploadSharedFileInput` | 文件对象与上传回调。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：群 ID 或文件参数非法。
- 错误码 `202`：鉴权失败或无权限。
- 错误码 `1`：上传被取消或平台上传失败。

### deleteSharedFile(input: GroupDeleteSharedFileInput) => Promise<void>

#### 说明

删除当前群组共享文件。

#### 调用示例

删除共享文件

```ts
await client.groupManager.getGroup('group-1').deleteSharedFile({ fileId: 'file-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupDeleteSharedFileInput` | 共享文件 ID。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法删除共享文件 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在、聊天室已被销毁，或共享文件不存在 | 确认 chatRoomId 与 fileId 正确且资源仍存在 |

### downloadSharedFile(input: GroupDownloadSharedFileInput) => Promise<void>

#### 说明

下载当前群组共享文件，下载完成后通过回调返回 Blob 数据。

#### 调用示例

下载共享文件

```ts
await client.groupManager.getGroup('group-1').downloadSharedFile({
  fileId: 'file-1',
  onFileDownloadComplete: blob => console.log(blob.size),
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupDownloadSharedFileInput` | 文件 ID、可选 secret 与下载回调。 |

#### 返回值

下载流程完成时 resolve。

#### 可能错误

- 错误码 `110`：群 ID 或文件 ID 非法。
- 错误码 `202`：鉴权失败。
- 错误码 `303`：HTTP 下载失败。

### setMemberAttributes(input: GroupSetMemberAttributesInput) => Promise<void>

#### 说明

设置当前群组中指定成员的自定义属性；常用于群名片。

#### 调用示例

设置群名片

```ts
await client.groupManager.getGroup('group-1').setMemberAttributes({
  userId: 'user-1',
  memberAttributes: { groupNamecard: 'Alice' },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupSetMemberAttributesInput` | 成员 ID 与属性键值。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：成员 ID、属性 key 或 value 非法。
- 错误码 `4`：属性数量或长度达到服务限制。
- 错误码 `202`：鉴权失败或无权限。

### getMembersAttributes(input: GroupGetMembersAttributesInput) => Promise<GroupMembersAttributesResult>

#### 说明

批量获取当前群组中多个成员的自定义属性。

#### 调用示例

批量获取成员属性

```ts
const result = await client.groupManager.getGroup('group-1').getMembersAttributes({
  userIds: ['user-1', 'user-2'],
  keys: ['groupNamecard'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupGetMembersAttributesInput` | 成员 ID 列表与可选属性 key 列表。 |

#### 返回值

返回按成员 ID 索引的属性集合。

#### 可能错误

- 错误码 `110`：成员列表为空、成员 ID 或属性 key 非法。
- 错误码 `202`：鉴权失败。

## src/types/group.ts

### GroupSummary

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |
| name | `string` | 群组名称。 |
| description | `string` | 群组描述。 |
| memberCount | `number` | 当前群成员数量。 |
| public | `boolean` | 是否为公开群。 |
| joinApprovalRequired | `boolean` | 入群是否需要管理员审批。 |
| allowInvites | `boolean` | 是否允许普通成员邀请其他用户入群。 |
| maxMembers | `number` | 群组最大成员数。 |
| role | `GroupRole` | 当前用户在群内的角色。 |
| disabled | `boolean` | 群组是否被禁用。 |

### GroupListResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<GroupSummary>` | 群组摘要列表。 |
| pageNum | `number` | 当前页码。 |
| pageSize | `number` | 每页条数。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有下一页。 |

### GroupDetail

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| owner | `UserInfo` | 群主资料。 |
| inviteNeedConfirm | `boolean` | 受邀人入群前是否需要确认邀请。 |
| muteAllMembers | `boolean` | 是否开启全员禁言。 |
| ext | `string` | 群扩展字段。 |
| createdAt | `number` | 群组创建时间戳。 |
| joinedAt | `number` | 当前用户入群时间戳。 |
| avatarUrl | `string` | 群头像 URL。 |
| messageBlocked | `boolean` | 当前用户是否屏蔽该群消息。 |

### JoinedGroupSummary

#### 说明

当前用户已加入群组的轻量同步摘要，不等同于完整群详情。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| ownerId | `string` | 群主用户 ID。 |
| avatarUrl | `string` | 群头像 URL。 |
| muteAllMembers | `boolean` | 是否开启全员禁言。 |
| muteExpiration | `number` | 当前用户禁言到期时间戳，0 表示未禁言。 |
| remindType | `SessionListRemindType` | 会话提醒类型。 |
| createdAt | `number` | 群创建时间戳。 |
| updatedAt | `number` | 群更新时间戳。 |
| joinedAt | `number` | 当前用户入群时间戳。 |

### JoinedGroupSnapshotMeta

#### 说明

本地已加入群组快照元信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| integrity | `JoinedGroupSnapshotIntegrity` | 当前快照完整性。 |
| limited | `boolean` | 当前结果是否受服务端上限影响。 |
| storageLimit | `number` | 本地预览存储上限。 |
| serverLimit | `number` | 服务端单轮同步上限。 |
| source | `JoinedGroupSnapshotSource` | 快照来源。 |
| lastSyncFinishedTs | `number` | 服务端最终批返回的完成时间。 |
| lastSuccessfulAt | `number` | 最近一次成功同步完成的本地时间。 |
| reason | `string` | 状态原因。 |

### JoinedGroupSnapshot

#### 说明

本地已加入群组快照。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<JoinedGroupSummary>` | 群组轻量摘要列表。 |
| meta | `JoinedGroupSnapshotMeta` | 快照元信息。 |

### GroupUpdateInfoInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | 新群组名称。 |
| description | `string` | 新群组描述。 |
| avatar | `string` | 新群头像地址或标识。 |
| ext | `string` | 新群扩展字段。 |

### GroupUpdateConfigsInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| public | `boolean` | 是否为公开群。 |
| joinApprovalRequired | `boolean` | 入群是否需要管理员审批。 |
| allowInvites | `boolean` | 是否允许普通成员邀请其他用户。 |
| inviteNeedConfirm | `boolean` | 受邀人入群前是否需要确认邀请。 |
| maxMembers | `number` | 群组最大成员数。 |

### GroupOwnerChangeInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| newOwner | `string` | 新群主用户 ID。 |

### GroupMemberEntry

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 成员用户资料。 |
| role | `GroupRole` | 成员角色。 |
| joinedAt | `number` | 成员入群时间戳。 |

### GroupMemberListResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<GroupMemberEntry>` | 成员列表。 |
| pageNum | `number` | 当前页码。 |
| pageSize | `number` | 每页条数。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有下一页。 |

### GroupMuteEntry

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 被禁言成员资料。 |
| muteExpire | `number` | 禁言到期时间戳。 |
| muteDuration | `number` | 禁言时长，单位秒。 |

### GroupAllowlistEntry

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 白名单成员资料。 |

### GroupBlocklistEntry

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 黑名单成员资料。 |

### GroupAnnouncement

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | 群公告内容。 |

### GroupSharedFile

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 共享文件 ID。 |
| fileName | `string` | 文件名。 |
| fileOwner | `UserInfo` | 文件上传者资料。 |
| fileSize | `number` | 文件大小，单位字节。 |
| createdAt | `number` | 文件创建时间戳。 |

### GroupSharedFileListResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<GroupSharedFile>` | 共享文件列表。 |
| pageNum | `number` | 当前页码。 |
| pageSize | `number` | 每页条数。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有下一页。 |

### CursorPageParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pageSize | `number` | 每页条数。 |
| cursor | `string` | 下一页游标。 |

### NumberPageParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pageNum | `number` | 页码。 |
| pageSize | `number` | 每页条数。 |

### GroupUserBatchInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 用户 ID 列表。 |

### GroupMuteMembersInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待禁言成员 ID 列表。 |
| muteDuration | `number` | 禁言时长，单位秒。 |

### GroupAnnouncementUpdateInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | 新群公告内容。 |

### GetJoinedGroupListParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| needMemberCount | `boolean` | 是否返回成员数量。 |
| needRole | `boolean` | 是否返回当前用户角色。 |

### GetGroupInfoParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |

### GetGroupInfoListParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupIds | `ReadonlyArray<string>` | 群组 ID 列表。 |

### CreateGroupParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | 群组名称。 |
| description | `string` | 群组描述。 |
| memberIds | `ReadonlyArray<string>` | 初始成员 ID 列表。 |
| public | `boolean` | 是否为公开群。 |
| joinApprovalRequired | `boolean` | 入群是否需要管理员审批。 |
| allowInvites | `boolean` | 是否允许普通成员邀请其他用户入群。 |
| inviteNeedConfirm | `boolean` | 受邀人入群前是否需要确认邀请。 |
| maxMembers | `number` | 群组最大成员数。 |
| ext | `string` | 群扩展字段。 |
| avatar | `string` | 群头像地址或标识。 |

### CreateGroupResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 创建成功后的群组 ID。 |

### UpdateGroupInfoParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |
| name | `string` | 新群组名称。 |
| description | `string` | 新群组描述。 |
| avatar | `string` | 新群头像地址或标识。 |
| public | `boolean` | 是否为公开群。 |
| joinApprovalRequired | `boolean` | 入群是否需要管理员审批。 |
| allowInvites | `boolean` | 是否允许普通成员邀请其他用户入群。 |
| inviteNeedConfirm | `boolean` | 受邀人入群前是否需要确认邀请。 |
| maxMembers | `number` | 群组最大成员数。 |
| ext | `string` | 群扩展字段。 |

### GroupMutationTarget

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |

### GroupUserBatchParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 用户 ID 列表。 |

### GroupAdminMutationParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 管理员用户 ID。 |

### GroupOwnerChangeParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| newOwner | `string` | 新群主用户 ID。 |

### GroupJoinParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `string` | 入群申请原因或附言。 |

### AcceptGroupJoinRequestParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 申请人用户 ID。 |

### RejectGroupJoinRequestParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 申请人用户 ID。 |
| reason | `string` | 拒绝原因。 |

### GroupMuteMembersParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待禁言成员 ID 列表。 |
| muteDuration | `number` | 禁言时长，单位秒。 |

### GroupAnnouncementUpdateParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | 新群公告内容。 |

### UploadGroupSharedFileCallbacks

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onFileUploadProgress | `(event: ProgressEvent) => void` | 文件上传进度回调。 |
| onFileUploadComplete | `(payload: unknown) => void` | 文件上传完成回调。 |
| onFileUploadError | `(payload: unknown) => void` | 文件上传失败回调。 |
| onFileUploadCanceled | `() => void` | 文件上传取消回调。 |

### UploadGroupSharedFileParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| file | `File | Blob | Record<string, unknown>` | 待上传文件。 |

### GroupUploadSharedFileInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| file | `File | Blob | Record<string, unknown>` | 待上传文件。 |

### DeleteGroupSharedFileParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 共享文件 ID。 |

### GroupDeleteSharedFileInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 共享文件 ID。 |

### DownloadGroupSharedFileCallbacks

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onFileDownloadComplete | `(data: Blob) => void` | 文件下载完成回调，参数为 Blob 数据。 |
| onFileDownloadError | `(error: unknown) => void` | 文件下载失败回调。 |

### DownloadGroupSharedFileParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 共享文件 ID。 |
| secret | `string` | 文件下载密钥。 |

### GroupDownloadSharedFileInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 共享文件 ID。 |
| secret | `string` | 文件下载密钥。 |

### SetGroupMemberAttributesParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 成员用户 ID。 |
| memberAttributes | `Readonly<Record<string, string>>` | 成员属性键值对象。 |

### GroupSetMemberAttributesInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 成员用户 ID。 |
| memberAttributes | `Readonly<Record<string, string>>` | 成员属性键值对象。 |

### GetGroupMembersAttributesParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 成员用户 ID 列表。 |
| keys | `ReadonlyArray<string>` | 可选属性 key 列表；不传时返回全部属性。 |

### GroupGetMembersAttributesInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 成员用户 ID 列表。 |
| keys | `ReadonlyArray<string>` | 可选属性 key 列表；不传时返回全部属性。 |

### GroupMembersAttributesResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `Readonly<Record<string, Readonly<Record<string, string>>>>` | 按成员用户 ID 索引的属性集合。 |

### GroupInvitationReceivedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| inviter | `UserInfo` | - |
| reason | `string` | - |

### GroupRequestToJoinReceivedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| applicant | `UserInfo` | - |
| reason | `string` | - |

### GroupRequestToJoinAcceptedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| accepter | `UserInfo` | - |

### GroupRequestToJoinDeclinedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| decliner | `UserInfo` | - |
| reason | `string` | - |
| applicant | `UserInfo` | - |

### GroupInvitationAcceptedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| invitee | `UserInfo` | - |
| reason | `string` | - |

### GroupInvitationDeclinedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| invitee | `UserInfo` | - |
| reason | `string` | - |

### GroupUserRemovedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |

### GroupDestroyedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |

### GroupAutoAcceptInvitationEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| inviter | `UserInfo` | - |
| inviteMessage | `string` | - |

### GroupMuteListAddedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| mutes | `ReadonlyArray<UserInfo>` | - |
| muteExpire | `number` | - |

### GroupMuteListRemovedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| mutes | `ReadonlyArray<UserInfo>` | - |

### GroupAllowListAddedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| allowlist | `ReadonlyArray<UserInfo>` | - |

### GroupAllowListRemovedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| allowlist | `ReadonlyArray<UserInfo>` | - |

### GroupAllMemberMuteStateChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| isMuted | `boolean` | - |

### GroupAdminAddedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| administrator | `UserInfo` | - |

### GroupAdminRemovedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| administrator | `UserInfo` | - |

### GroupOwnerChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| newOwner | `UserInfo` | - |
| oldOwner | `UserInfo` | - |

### GroupMembersJoinedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| members | `ReadonlyArray<UserInfo>` | - |

### GroupMembersExitedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| members | `ReadonlyArray<UserInfo>` | - |

### GroupAnnouncementChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| announcement | `string` | - |

### GroupSharedFileAddedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| sharedFile | `GroupSharedFile` | - |

### GroupSharedFileDeletedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| fileId | `string` | - |

### GroupInfoChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupInfo | `GroupDetail` | - |

### GroupDisabledChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupInfo | `GroupDetail` | - |
| disabled | `boolean` | - |

### GroupMemberAttributeChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| user | `UserInfo` | - |
| attribute | `Readonly<Record<string, string>>` | - |
| from | `string` | - |
| source | `'direct' | 'multiDevice'` | - |

### GroupUserGroupNamecardUpdatedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| userId | `string` | - |
| namecard | `string` | - |

### GroupManagerListener

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onUserGroupNamecardUpdated | `(groupId: string, userId: string, namecard: string) => void` | - |

## src/managers/presence-manager.ts

### PublishPresenceParams

#### 说明

发布当前用户在线状态的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| customStatus | `string` | 在线状态自定义状态，服务端对应 `ext` 字段。 |

### SubscribePresenceParams

#### 说明

订阅用户在线状态的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待订阅的用户 ID 列表，至少包含 1 项。 |
| expiry | `number` | 订阅时长（秒），取值需大于等于 0。 |

### UnsubscribePresenceParams

#### 说明

取消订阅用户在线状态的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待取消订阅的用户 ID 列表，至少包含 1 项。 |

### GetSubscribedPresenceListParams

#### 说明

查询当前用户在线状态订阅列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pageNum | `number` | 页码，从 0 开始。 |
| pageSize | `number` | 每页条数，取值需大于等于 0。 |

### GetPresenceStatusParams

#### 说明

查询用户在线状态的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待查询的用户 ID 列表，至少包含 1 项。 |

### PresenceManager

### addEventHandler(id: EventHandlerId, handlers: PresenceEventHandlerMap) => void

#### 说明

注册 Presence 事件处理器，用于接收在线状态变更推送。

#### 调用示例

调用示例（注册在线状态事件）

```ts
client.presenceManager.addEventHandler('presence-ui', {
  onPresenceStatusChange: (states) => {
    console.log(states);
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一 ID，用于后续移除。 |
| handlers | `PresenceEventHandlerMap` | 事件处理器集合，按需实现对应回调。 |

#### 返回值

注册完成后无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除 Presence 事件处理器。

#### 调用示例

调用示例（移除在线状态事件）

```ts
client.presenceManager.removeEventHandler('presence-ui');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 待移除的事件处理器 ID。 |

#### 返回值

移除完成后无返回值。

### publishPresence(params: PublishPresenceParams) => Promise<void>

#### 说明

发布当前用户的自定义在线状态，该状态会作为在线状态扩展描述信息保存并下发给订阅者。

#### 调用示例

调用示例（发布在线状态）

```ts
await client.presenceManager.publishPresence({
  customStatus: 'busy',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `PublishPresenceParams` | 发布参数，包含在线状态扩展描述信息与可选回调。 |

#### 返回值

成功时 resolve，无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | PRESENCE_PARAM_EXCEED | 在线状态扩展描述信息长度超过服务端允许上限 | 缩短 customStatus 后重试 |

### subscribePresence(params: SubscribePresenceParams) => Promise<SubscribePresenceResponse>

#### 说明

订阅指定用户的在线状态。订阅成功后，这些用户在线状态变更时会触发 Presence 事件回调。

#### 调用示例

调用示例（订阅用户在线状态）

```ts
const result = await client.presenceManager.subscribePresence({
  userIds: ['userA'],
  expiry: 3600,
});
console.log(result[0]?.publisher);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SubscribePresenceParams` | 订阅参数，包含用户列表、订阅时长与可选回调。 |

#### 返回值

返回归一化后的在线状态列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1101 | cannot_subscribe_yourself | 订阅列表中包含当前用户自己 | 从订阅列表中移除当前用户 |
| 1100 | param_length_exceed | 订阅参数长度超过服务端允许上限 | 减少单次订阅的用户数量 |

### unsubscribePresence(params: UnsubscribePresenceParams) => Promise<void>

#### 说明

取消订阅指定用户的在线状态，成功后不再接收这些用户的在线状态变更事件。

#### 调用示例

调用示例（取消订阅）

```ts
await client.presenceManager.unsubscribePresence({
  userIds: ['userA'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UnsubscribePresenceParams` | 取消订阅参数，包含用户列表与可选回调。 |

#### 返回值

成功时 resolve，无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | param_length_exceed | 取消订阅参数长度超过服务端允许上限 | 减少单次取消订阅的用户数量 |

### getSubscribedPresenceList(params: GetSubscribedPresenceListParams) => Promise<SubscribedPresenceListResponse>

#### 说明

分页查询当前用户订阅了哪些用户的在线状态。

#### 调用示例

调用示例（分页查询订阅列表）

```ts
const list = await client.presenceManager.getSubscribedPresenceList({
  pageNum: 1,
  pageSize: 20,
});
console.log(list);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetSubscribedPresenceListParams` | 分页参数，包含页码、每页数量与可选回调。 |

#### 返回值

返回订阅用户 ID 列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | param_length_exceed | 分页参数超过服务端允许上限 | 调整 pageNum 或 pageSize 后重试 |

### getPresenceStatus(params: GetPresenceStatusParams) => Promise<SubscribePresenceResponse>

#### 说明

查询指定用户的当前在线状态，不会建立订阅关系。

#### 调用示例

调用示例（查询在线状态）

```ts
const status = await client.presenceManager.getPresenceStatus({
  userIds: ['userA'],
});
console.log(status[0]?.statusList);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetPresenceStatusParams` | 查询参数，包含用户列表与可选回调。 |

#### 返回值

返回归一化后的在线状态列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | param_length_exceed | 查询参数长度超过服务端允许上限 | 减少单次查询的用户数量 |

## src/types/presence.ts

### PresenceStatusDetails

#### 说明

单设备在线状态明细。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| device | `string` | 设备标识（如 web/mobile）。 |
| status | `number` | 设备在线状态值。 |

### PresenceState

#### 说明

在线状态事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 状态所属用户 ID。 |
| statusDetails | `ReadonlyArray<PresenceStatusDetails>` | 多设备状态明细列表。 |
| ext | `string` | 扩展描述字段。 |
| lastTime | `number` | 状态更新时间（毫秒时间戳）。 |
| expire | `number` | 订阅到期时间（毫秒时间戳）。 |

### PresenceInfo

#### 说明

在线状态业务对象（对齐 Android Presence 语义）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| publisher | `string` | 状态发布者（用户 ID）。 |
| statusList | `Readonly<Record<string, number>>` | 设备状态映射（key 为设备，value 为状态值）。 |
| ext | `string` | 扩展描述字段。 |
| latestTime | `number` | 最新更新时间（毫秒时间戳）。 |
| expiryTime | `number` | 状态到期时间（毫秒时间戳）。 |

### SubscribePresenceRawResponse

#### 说明

订阅/查询在线状态原始响应（服务端返回）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| result | `ReadonlyArray<{
    /** [zh-CN] 服务端用户 ID。 [en-US] User id from server. */
    readonly uid?: string;
    /** [zh-CN] 服务端设备状态映射。 [en-US] Device-status map from server. */
    readonly status?: Record<string, unknown>;
    /** [zh-CN] 服务端扩展字段。 [en-US] Extension field from server. */
    readonly ext?: string;
    /** [zh-CN] 服务端更新时间（毫秒时间戳）。 [en-US] Update time from server in milliseconds timestamp. */
    readonly last_time?: number;
    /** [zh-CN] 服务端到期时间（毫秒时间戳）。 [en-US] Expire time from server in milliseconds timestamp. */
    readonly expiry?: number;
  }>` | 服务端结果列表。 |

### SubscribedPresenceListRawResponse

#### 说明

订阅列表原始响应（服务端返回）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| result | `{
    /** [zh-CN] 订阅条目列表。 [en-US] Subscribed entry list. */
    readonly sublist?: ReadonlyArray<{
      /** [zh-CN] 服务端用户 ID。 [en-US] User id from server. */
      readonly uid?: string;
      /** [zh-CN] 服务端到期时间（毫秒时间戳）。 [en-US] Expire time from server in milliseconds timestamp. */
      readonly expiry?: number;
    }>;
    /** [zh-CN] 服务端总条目数。 [en-US] Total entry count from server. */
    readonly totalnum?: number;
  }` | 服务端结果对象。 |

## src/managers/push-manager.ts

### PushManager

### uploadPushToken(params: UploadPushTokenParams) => Promise<void>

#### 说明

上传或覆盖设备 Push Token。成功时仅表示请求完成，不返回业务数据。

#### 调用示例

调用示例（上传设备 token）

```ts
await client.pushManager.uploadPushToken({
  deviceId: 'web-device-001',
  deviceToken: 'token-from-push-provider',
  notifierName: 'FCM',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UploadPushTokenParams` | 上传参数，包含设备标识、设备 token 与推送通道标识。 |

#### 返回值

成功时 resolve，无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | deviceId、deviceToken 或 notifierName 为空或不是字符串 | 传入非空 deviceId、deviceToken 和 notifierName |
| 1500 | TOKEN_UPLOAD_FAILED | 服务端拒绝 push token 绑定请求，或推送通道信息不可用 | 检查登录态、deviceToken 与 notifierName 后重试 |

### setGlobalSilentMode(params: SetGlobalSilentModeParams) => Promise<GlobalSilentModeResponse>

#### 说明

设置 App 级（全局）免打扰规则，支持提醒类型、持续时长、时间区间三种模式。

#### 调用示例

调用示例（设置全局提醒类型）

```ts
const result = await client.pushManager.setGlobalSilentMode({
  rule: { mode: 'REMIND_TYPE', remindType: 'AT' },
});
console.log(result.rule.remindType);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SetGlobalSilentModeParams` | 全局免打扰设置参数。 |

#### 返回值

返回全局规则快照。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 免打扰规则参数非法，或同一个 mode 下传入了互斥字段 | 按 REMIND_TYPE、DURATION 或 INTERVAL 选择一种规则模式，并传入对应必填字段 |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰参数无效或服务端拒绝 | 检查免打扰参数后重试 |

### getGlobalSilentMode(params: GetGlobalSilentModeParams) => Promise<GlobalSilentModeResponse>

#### 说明

查询 App 级（全局）免打扰规则。

#### 调用示例

调用示例（查询全局规则）

```ts
const result = await client.pushManager.getGlobalSilentMode();
console.log(result.rule);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetGlobalSilentModeParams` | 查询参数（当前无字段）。 |

#### 返回值

返回全局规则快照。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 | - |

### setConversationSilentMode(params: SetConversationSilentModeParams) => Promise<ConversationSilentModeResponse>

#### 说明

设置单会话免打扰规则，仅支持单聊与群聊。

#### 调用示例

调用示例（设置会话时长免打扰）

```ts
const result = await client.pushManager.setConversationSilentMode({
  conversationId: 'group_123',
  conversationType: 'groupChat',
  rule: { mode: 'DURATION', duration: 3600 },
});
console.log(result.rule.expireTimestamp);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SetConversationSilentModeParams` | 会话维度的免打扰设置参数。 |

#### 返回值

返回目标会话与规则快照。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId 为空、type 不是 singleChat/groupChat，或免打扰规则参数非法 | 传入合法会话 ID、会话类型，并按 REMIND_TYPE、DURATION 或 INTERVAL 选择一种规则模式 |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰参数无效或服务端拒绝 | 检查免打扰参数后重试 |

### getConversationSilentMode(params: GetConversationSilentModeParams) => Promise<ConversationSilentModeResponse>

#### 说明

查询单会话免打扰规则。

#### 调用示例

调用示例（查询会话规则）

```ts
const result = await client.pushManager.getConversationSilentMode({
  conversationId: 'user_001',
  conversationType: 'singleChat',
});
console.log(result.rule.remindType);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetConversationSilentModeParams` | 会话查询参数。 |

#### 返回值

返回目标会话的规则快照。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId 为空，或 type 不是 singleChat/groupChat | 传入合法会话 ID，并使用 singleChat 或 groupChat |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 | - |

### clearConversationRemindType(params: ClearConversationRemindTypeParams) => Promise<ConversationSilentModeResponse>

#### 说明

清除会话提醒类型配置，恢复服务端默认提醒策略。

#### 调用示例

调用示例（清除会话提醒类型）

```ts
const result = await client.pushManager.clearConversationRemindType({
  conversationId: 'group_123',
  conversationType: 'groupChat',
});
console.log(result.rule.remindType);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ClearConversationRemindTypeParams` | 清除会话提醒类型所需参数。 |

#### 返回值

返回清除后的会话规则快照。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId 为空，或 type 不是 singleChat/groupChat | 传入合法会话 ID，并使用 singleChat 或 groupChat |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 | - |

### getConversationSilentModes(params: GetConversationSilentModesParams) => Promise<BatchConversationSilentModeResponse>

#### 说明

批量查询多个会话的免打扰规则，单次最多 20 条。

#### 调用示例

调用示例（批量查询）

```ts
const result = await client.pushManager.getConversationSilentModes({
  conversationList: [
    { conversationId: 'user_001', conversationType: 'singleChat' },
    { conversationId: 'group_123', conversationType: 'groupChat' },
  ],
});
console.log(result.conversations);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetConversationSilentModesParams` | 批量查询参数。 |

#### 返回值

返回与输入顺序对齐的会话规则列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationList 为空、超过 20 条，或包含非法会话 ID/类型 | 传入 1 到 20 个会话，并确保每项包含非空 id 与 singleChat/groupChat 类型 |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 | - |

### setPushLanguage(params: SetPushLanguageParams) => Promise<void>

#### 说明

设置推送翻译语言。

#### 调用示例

调用示例（设置推送语言）

```ts
await client.pushManager.setPushLanguage({ language: 'zh-Hans' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SetPushLanguageParams` | 语言设置参数。 |

#### 返回值

成功时 resolve，无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | language 为空或不是字符串 | 传入非空语言标识，例如 zh-Hans 或 en |
| 1502 | PUSH_LANGUAGE_OPERATION_FAILED | 语言参数无效或服务端拒绝 | 检查语言参数后重试 |

### getPushLanguage(params: GetPushLanguageParams) => Promise<PushLanguageResponse>

#### 说明

查询当前推送翻译语言。

#### 调用示例

调用示例（查询推送语言）

```ts
const result = await client.pushManager.getPushLanguage();
console.log(result.language);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetPushLanguageParams` | 查询参数（当前无字段）。 |

#### 返回值

返回当前语言值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1502 | PUSH_LANGUAGE_OPERATION_FAILED | 推送翻译语言设置失败 | - |

### getConversationListByRemindType(params: GetConversationListByRemindTypeParams) => Promise<MutedConversationPageResponse>

#### 说明

分页查询已设置提醒类型的会话列表。

#### 调用示例

调用示例（分页查询）

```ts
const result = await client.pushManager.getConversationListByRemindType({
  pageSize: 20,
  cursor: '',
});
console.log(result.conversations, result.cursor);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetConversationListByRemindTypeParams` | 分页参数，包含页大小与可选游标。 |

#### 返回值

返回会话列表与下一页游标。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | pageSize 不是正整数，或 cursor 不是 SDK 返回的本地分页游标 | 传入正整数 pageSize，并使用上一次返回的 cursor |

## src/types/push.ts

### PushTimePoint

#### 说明

时间点（24 小时制）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| hours | `number` | 小时，范围 0-23。 |
| minutes | `number` | 分钟，范围 0-59。 |

### PushSilentModeRemindTypeRuleInput

#### 说明

提醒类型模式输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| mode | `'REMIND_TYPE'` | 固定值 `REMIND_TYPE`。 |
| remindType | `PushRemindTypeWithoutDefault` | 提醒类型，支持 `ALL/AT/NONE`。 |

### PushSilentModeDurationRuleInput

#### 说明

时长模式输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| mode | `'DURATION'` | 固定值 `DURATION`。 |
| duration | `number` | 持续秒数，必须为正整数。 |

### PushSilentModeIntervalRuleInput

#### 说明

时间区间模式输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| mode | `'INTERVAL'` | 固定值 `INTERVAL`。 |
| startTime | `PushTimePoint` | 开始时间点。 |
| endTime | `PushTimePoint` | 结束时间点。 |

### PushSilentModeRuleView

#### 说明

免打扰规则查询视图（字段可并存）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| remindType | `PushRemindType` | 当前提醒类型。 |
| expireTimestamp | `number` | 到期时间戳（毫秒）。 |
| silentModeStartTime | `PushTimePoint` | 每日免打扰开始时间。 |
| silentModeEndTime | `PushTimePoint` | 每日免打扰结束时间。 |

### GlobalSilentModeResponse

#### 说明

全局免打扰响应。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| scope | `'global'` | 作用域，固定为 `global`。 |
| rule | `PushSilentModeRuleView` | 全局免打扰规则。 |

### ConversationSilentModeResponse

#### 说明

单会话免打扰响应。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `PushConversationType` | 会话类型。 |
| rule | `PushSilentModeRuleView` | 会话免打扰规则。 |

### ConversationIdentifier

#### 说明

会话标识。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `PushConversationType` | 会话类型。 |

### BatchConversationSilentModeResponse

#### 说明

批量会话免打扰响应。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversations | `ReadonlyArray<ConversationSilentModeResponse>` | 会话结果列表。 |

### PushLanguageResponse

#### 说明

推送语言响应。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| language | `string` | 当前生效语言。 |

### MutedConversationItem

#### 说明

免打扰会话条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `PushConversationType` | 会话类型。 |
| remindType | `PushRemindTypeWithoutDefault` | 提醒类型（不含 DEFAULT）。 |

### MutedConversationPageResponse

#### 说明

免打扰会话分页响应。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversations | `ReadonlyArray<MutedConversationItem>` | 当前页会话列表。 |
| cursor | `string` | 下一页游标，空字符串表示无更多数据。 |

### UploadPushTokenParams

#### 说明

上传 Push Token 参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| deviceId | `string` | 设备唯一标识。 |
| deviceToken | `string` | 设备推送 token。 |
| notifierName | `string` | 推送通道名称（例如 FCM）。 |

### SetGlobalSilentModeParams

#### 说明

设置全局免打扰参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| rule | `PushSilentModeRuleInput` | 免打扰规则输入。 |

### SetConversationSilentModeParams

#### 说明

设置会话免打扰参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `PushConversationType` | 会话类型。 |
| rule | `PushSilentModeRuleInput` | 会话免打扰规则。 |

### GetConversationSilentModeParams

#### 说明

查询会话免打扰参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `PushConversationType` | 会话类型。 |

### ClearConversationRemindTypeParams

#### 说明

清除会话提醒类型参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `PushConversationType` | 会话类型。 |

### GetConversationSilentModesParams

#### 说明

批量查询会话免打扰参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationList | `ReadonlyArray<ConversationIdentifier>` | 会话列表，单次最多 20 条。 |

### SetPushLanguageParams

#### 说明

设置推送语言参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| language | `string` | 语言值（例如 `zh-Hans`、`en`）。 |

### GetConversationListByRemindTypeParams

#### 说明

分页查询提醒类型会话参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pageSize | `number` | 分页大小，必须为正整数。 |
| cursor | `string` | 分页游标（可选）。 |

## src/managers/user-info-manager.ts

### UserInfoManager

### addEventHandler(id: EventHandlerId, handlers: UserInfoEventHandlerMap) => void

#### 说明

注册用户资料事件处理器，用于接收当前用户资料更新和订阅用户资料变更通知。

#### 调用示例

调用示例（注册事件处理器）

```ts
client.userInfoManager.addEventHandler('profile-listener', {
  onOwnInfoUpdated: profile => {
    console.log(profile.nickname);
  },
  onUserInfoUpdated: users => {
    console.log(users.map(user => user.userId));
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器 ID，同一个 ID 再次注册会覆盖旧处理器。 |
| handlers | `UserInfoEventHandlerMap` | 用户资料事件处理器集合。 |

#### 返回值

无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除指定 ID 的用户资料事件处理器，停止接收对应事件回调。

#### 调用示例

调用示例（移除事件处理器）

```ts
client.userInfoManager.removeEventHandler('profile-listener');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 注册时传入的事件处理器 ID。 |

#### 返回值

无返回值。

### getUserInfoByUserId(params: FetchUserInfoByUserIdParams) => Promise<ReadonlyArray<UserInfo>>

#### 说明

按用户 ID 查询用户资料属性；未指定属性时查询 SDK 默认资料字段。

#### 调用示例

调用示例（按用户 ID 查询）

```ts
const users = await client.userInfoManager.getUserInfoByUserId({
  userIds: ['alice', 'bob'],
});
console.log(users[0]?.avatarUrl);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `FetchUserInfoByUserIdParams` | 包含 `userIds` 与可选成功/失败回调的参数对象。 |

#### 返回值

返回标准化后的用户资料数组，仅包含服务端命中的用户。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userIds 为空、不是数组，或包含非法用户 ID | 传入非空用户 ID 数组，并确保每个用户 ID 都是非空字符串 |
| 900 | usercount_exceed | 单次查询的用户数量超过服务端允许上限 | 减少单次查询的用户数量后重试 |
| 204 | resource_not_found | 查询的用户不存在 | 确认用户 ID 正确 |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |

### getUserInfoByAttribute(params: FetchUserInfoByAttributeParams) => Promise<ReadonlyArray<UserInfo>>

#### 说明

按用户 ID 和指定属性集查询用户资料，适合只读取昵称、头像等部分字段。

#### 调用示例

调用示例（按属性集查询）

```ts
const users = await client.userInfoManager.getUserInfoByAttribute({
  userIds: ['alice'],
  attributes: ['nickname', 'avatarUrl'],
});
console.log(users[0]?.nickname);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `FetchUserInfoByAttributeParams` | 包含 `userIds`、`attributes` 与可选回调的参数对象。 |

#### 返回值

返回标准化后的用户资料数组。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userIds 或 attributes 为空、不是数组，或包含非法值 | 传入非空用户 ID 数组和非空资料属性数组，并确保属性名属于支持范围 |
| 900 | usercount_exceed | 单次查询的用户数量超过服务端允许上限 | 减少单次查询的用户数量后重试 |
| 204 | resource_not_found | 查询的用户不存在 | 确认用户 ID 正确 |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |

### subscribeUsersInfo(params: SubscribeUsersInfoParams) => Promise<void>

#### 说明

订阅指定陌生人用户的资料变化；订阅成功后可通过用户资料事件处理器接收变更通知。

#### 调用示例

调用示例（订阅资料变化）

```ts
await client.userInfoManager.subscribeUsersInfo({
  userIds: ['alice', 'bob'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SubscribeUsersInfoParams` | 包含 `userIds` 与可选回调的参数对象。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 202 | unauthorized | unauthorized | refresh_token |
| 210 | forbidden | service_forbidden | check_service_permission |
| 1600 | subscriber_limit_exceeded | subscriber_limit_exceeded | reduce_subscription_targets |
| 1601 | target_limit_exceeded | target_limit_exceeded | change_subscription_target |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |
| 303 | server_unknown_error | server_unknown_error | 稍后重试或联系服务端排查 |

### unsubscribeUsersInfo(params: UnsubscribeUsersInfoParams) => Promise<void>

#### 说明

取消订阅指定陌生人用户的资料变化；取消后不再接收这些用户的资料变更通知。

#### 调用示例

调用示例（取消订阅资料变化）

```ts
await client.userInfoManager.unsubscribeUsersInfo({
  userIds: ['alice'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UnsubscribeUsersInfoParams` | 包含 `userIds` 与可选回调的参数对象。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 202 | unauthorized | unauthorized | refresh_token |
| 210 | forbidden | service_forbidden | check_service_permission |
| 1600 | subscriber_limit_exceeded | subscriber_limit_exceeded | reduce_subscription_targets |
| 1601 | target_limit_exceeded | target_limit_exceeded | change_subscription_target |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |
| 303 | server_unknown_error | server_unknown_error | 稍后重试或联系服务端排查 |

### getSubscribedUsers() => Promise<ReadonlyArray<UserInfo>>

#### 说明

查询当前用户已订阅资料变化的陌生人列表，并返回这些用户的标准化资料。

#### 调用示例

调用示例（查询已订阅用户）

```ts
const users = await client.userInfoManager.getSubscribedUsers();
console.log(users.map(user => user.userId));
```

#### 返回值

返回标准化后的用户资料数组。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 202 | unauthorized | unauthorized | refresh_token |
| 210 | forbidden | service_forbidden | check_service_permission |
| 1600 | subscriber_limit_exceeded | subscriber_limit_exceeded | reduce_subscription_targets |
| 1601 | target_limit_exceeded | target_limit_exceeded | change_subscription_target |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |
| 303 | server_unknown_error | server_unknown_error | 稍后重试或联系服务端排查 |

### updateOwnInfo(params: UpdateOwnInfoParams) => Promise<UserInfo>

#### 说明

更新当前登录用户的一个或多个资料属性，例如昵称、头像、邮箱、手机号、签名或扩展字段。

#### 调用示例

调用示例（整对象更新）

```ts
const profile = await client.userInfoManager.updateOwnInfo({
  nickname: 'Alice',
  avatarUrl: 'https://example.com/avatar.png',
});
console.log(profile.userId, profile.nickname);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UpdateOwnInfoParams` | 至少包含一个可更新字段的参数对象。 |

#### 返回值

返回标准化后的当前用户资料。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 没有任何可更新字段，或字段类型非法 | 至少传入一个可更新字段，并确保字段值类型合法 |
| 901 | data_length_exceed | 用户资料字段总长度超过服务端允许上限 | 缩短资料字段内容后重试 |
| 204 | resource_not_found | 当前用户不存在 | 确认用户已注册 |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |

### updateOwnInfoByAttribute(attribute: UserInfoAttribute, value: string | number | boolean) => Promise<UserInfo>

#### 说明

更新当前登录用户的单个资料属性，适合只修改昵称、头像等一个字段的场景。

#### 调用示例

调用示例（单属性更新）

```ts
const profile = await client.userInfoManager.updateOwnInfoByAttribute(
  'avatarUrl',
  'https://example.com/avatar.png'
);
console.log(profile.avatarUrl);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| attribute | `UserInfoAttribute` | 需要更新的资料属性。 |
| value | `string | number | boolean` | 属性值；空字符串、`false`、`0` 都是合法值。 |

#### 返回值

返回标准化后的当前用户资料。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 属性名或属性值非法 | 仅使用支持的资料属性，并确保属性值类型合法 |
| 901 | data_length_exceed | 用户资料字段总长度超过服务端允许上限 | 缩短资料字段内容后重试 |
| 204 | resource_not_found | 当前用户不存在 | 确认用户已注册 |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |

## src/types/user-info.ts

### UserInfo

#### 说明

UserInfoManager 查询/更新成功后返回的标准化用户资料对象。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 用户 ID。 |
| nickname | `string` | 昵称。 |
| avatarUrl | `string` | 头像地址。 |
| mail | `string` | 邮箱。 |
| phone | `string` | 手机号。 |
| gender | `UserInfoAttributeValue` | 性别或自定义标识。 |
| sign | `string` | 签名。 |
| birth | `string` | 生日。 |
| ext | `string` | 扩展字段。 |

### UserInfoListener

#### 说明

用户资料事件监听器。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onOwnInfoUpdated | `(userInfo: UserInfo) => void` | 当前用户资料更新时触发。 |
| onUserInfoUpdated | `(userInfos: ReadonlyArray<UserInfo>) => void` | 他人资料通过消息补位更新时触发。 |

### FetchUserInfoByUserIdParams

#### 说明

按用户 ID 查询默认字段的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 目标用户 ID 列表。 |

### FetchUserInfoByAttributeParams

#### 说明

按用户 ID 与属性集查询资料的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 目标用户 ID 列表。 |
| attributes | `ReadonlyArray<UserInfoAttribute>` | 需要查询的资料属性。 |

### SubscribeUsersInfoParams

#### 说明

批量订阅陌生人资料变化的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待订阅的用户 ID 列表。 |

### UnsubscribeUsersInfoParams

#### 说明

批量取消订阅陌生人资料变化的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待取消订阅的用户 ID 列表。 |

### UpdateOwnInfoParams

#### 说明

当前用户整对象更新参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| nickname | `string` | 昵称；传空字符串表示清空。 |
| avatarUrl | `string` | 头像地址；传空字符串表示清空。 |
| mail | `string` | 邮箱；传空字符串表示清空。 |
| phone | `string` | 手机号；传空字符串表示清空。 |
| gender | `UserInfoAttributeValue` | 性别；`false` / `0` 也是合法值。 |
| sign | `string` | 签名；传空字符串表示清空。 |
| birth | `string` | 生日；传空字符串表示清空。 |
| ext | `string` | 扩展字段；传空字符串表示清空。 |

### UpdateOwnInfoByAttributeParams

#### 说明

当前用户单属性更新参数模型。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| attribute | `UserInfoAttribute` | 目标属性。 |
| value | `UserInfoAttributeValue` | 属性值。 |
