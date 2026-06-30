---
id: generated/api-reference/src-types-chat-client-ts
title: websdk2 API Reference - ChatClient 类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/chat-client.ts API Reference 分段。
---

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

### InitConfig

#### 说明

ChatClient 初始化配置。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| appKey | `string` | 应用唯一标识，格式为 `org#app`。 |
| enableUserInfoSync | `boolean` | 是否启用用户资料同步增强能力。 |
| enableAutoSyncContacts | `boolean` | 是否在登录后自动同步联系人快照。 |
| sessionListSync | `SessionListSyncConfig` | 会话列表同步配置。 |
| useCustomAttachmentUpload | `boolean` | 是否使用自定义附件上传能力。 |
| useFixedDeviceId | `boolean` | 是否在同一浏览器内复用固定设备标识。 |
| deviceId | `string` | 自定义设备标识；未传时使用 SDK 默认值。 |
| serviceConfig | `ServiceConfig` | 服务接入配置；缺省时使用 SDK 内置 DNS_CONFIG。 |
| useReplacedMessageContents | `boolean` | 内容审核替换后，是否将替换后的消息回给发送方。 |
| customDeviceName | `string` | 自定义设备名称；通常与 `customOsPlatform` 搭配使用。 |
| customOsPlatform | `number` | 自定义平台编号。 |
| autoLogin | `boolean` | 是否启用自动登录续连行为。 |
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
