---
id: generated/api-reference/src-types-presence-ts
title: websdk2 API Reference - 在线状态类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/presence.ts API Reference 分段。
---

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
