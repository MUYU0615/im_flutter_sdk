---
id: generated/api-reference/src-types-push-ts
title: websdk2 API Reference - 推送类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/push.ts API Reference 分段。
---

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
