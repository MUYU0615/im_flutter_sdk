---
id: generated/api-reference/src-managers-push-manager-ts
title: websdk2 API Reference - PushManager API
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/push-manager.ts API Reference 分段。
---

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
