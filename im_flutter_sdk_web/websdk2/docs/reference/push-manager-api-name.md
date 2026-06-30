# PushManager API 命名对照

## 命名映射（Web SDK vs Android SDK）

| Web SDK                           | Android SDK                        | 说明                           |
| --------------------------------- | ---------------------------------- | ------------------------------ |
| `uploadPushToken`                 | `bindDeviceToken`                  | 上传/绑定设备推送 token        |
| `setGlobalSilentMode`             | `setSilentModeForAll`              | 设置 App 级免打扰              |
| `getGlobalSilentMode`             | `getSilentModeForAll`              | 查询 App 级免打扰              |
| `setConversationSilentMode`       | `setSilentModeForConversation`     | 设置会话级免打扰               |
| `getConversationSilentMode`       | `getSilentModeForConversation`     | 查询单会话免打扰               |
| `clearConversationRemindType`     | `clearRemindTypeForConversation`   | 清除会话提醒类型               |
| `getConversationSilentModes`      | `getSilentModeForConversations`    | 批量查询会话免打扰             |
| `getConversationListByRemindType` | `N/A`                              | 分页查询“已设置提醒类型”的会话 |
| `setPushLanguage`                 | `setPreferredNotificationLanguage` | 设置推送语言                   |
| `getPushLanguage`                 | `getPreferredNotificationLanguage` | 查询推送语言                   |

## 结论（本项目约定）

- 对外 API 命名以 **Web SDK 自身命名规范** 为准（TypeScript 语义化 + 动词前缀一致）。
- 不强制与 Android 方法名完全一致，但要求**语义一一对应**，并通过本文件维护映射关系。
- 跨端统一重点是“能力一致 + 参数/返回语义一致”，不是“方法名逐字一致”。

## 共享数据结构

> 说明：
>
> - 以下结构均为 **Web SDK 对外类型**，不是服务端原始 HTTP 返回体。
> - 除 `uploadPushToken` 外，其余 API 的 `params` 都支持可选 `success(response)` / `error(error)` 回调；`uploadPushToken` 的 `success` 无参数。

### `PushTimePoint`

| 字段      | 类型     | 必填 | 说明              |
| --------- | -------- | ---- | ----------------- |
| `hours`   | `number` | 是   | 小时，范围 `0-23` |
| `minutes` | `number` | 是   | 分钟，范围 `0-59` |

### `PushSilentModeRuleInput`

三选一，只能传一种模式：

#### 1. 提醒类型模式

```ts
{
  mode: 'REMIND_TYPE';
  remindType: 'ALL' | 'AT' | 'NONE';
}
```

#### 2. 持续时长模式

```ts
{
  mode: 'DURATION';
  duration: number; // 正整数，单位：秒
}
```

#### 3. 时间区间模式

```ts
{
  mode: 'INTERVAL';
  startTime: PushTimePoint;
  endTime: PushTimePoint;
}
```

### `PushSilentModeRuleView`

| 字段                  | 类型                                   | 必填 | 说明               |
| --------------------- | -------------------------------------- | ---- | ------------------ |
| `remindType`          | `'ALL' \| 'AT' \| 'NONE' \| 'DEFAULT'` | 否   | 当前提醒类型       |
| `expireTimestamp`     | `number`                               | 否   | 到期时间戳，毫秒   |
| `silentModeStartTime` | [`PushTimePoint`](#pushtimepoint)      | 否   | 每日免打扰开始时间 |
| `silentModeEndTime`   | [`PushTimePoint`](#pushtimepoint)      | 否   | 每日免打扰结束时间 |

### `ConversationIdentifier`

| 字段   | 类型                          | 必填 | 说明                        |
| ------ | ----------------------------- | ---- | --------------------------- |
| `id`   | `string`                      | 是   | 会话 ID                     |
| `type` | `'singleChat' \| 'groupChat'` | 是   | 会话类型，不支持 `chatRoom` |

## API 请求参数与返回结构

### `uploadPushToken`

**签名**

```ts
uploadPushToken(params: UploadPushTokenParams): Promise<void>
```

**请求参数：`UploadPushTokenParams`**

| 字段           | 类型                        | 必填 | 说明                   |
| -------------- | --------------------------- | ---- | ---------------------- |
| `deviceId`     | `string`                    | 是   | 设备唯一标识           |
| `deviceToken`  | `string`                    | 是   | 设备推送 token         |
| `notifierName` | `string`                    | 是   | 推送通道名称，如 `FCM` |
| `success`      | `() => void`                | 否   | 成功回调               |
| `error`        | `(error: SDKError) => void` | 否   | 失败回调               |

**返回结构**

```ts
Promise<void>;
```

成功仅表示上传完成，不返回业务数据。

### `setGlobalSilentMode`

**签名**

```ts
setGlobalSilentMode(
  params: SetGlobalSilentModeParams
): Promise<GlobalSilentModeResponse>
```

**请求参数：`SetGlobalSilentModeParams`**

| 字段      | 类型                                                  | 必填 | 说明           |
| --------- | ----------------------------------------------------- | ---- | -------------- |
| `rule`    | [`PushSilentModeRuleInput`](#pushsilentmoderuleinput) | 是   | 全局免打扰规则 |
| `success` | `(response: GlobalSilentModeResponse) => void`        | 否   | 成功回调       |
| `error`   | `(error: SDKError) => void`                           | 否   | 失败回调       |

**返回结构：`GlobalSilentModeResponse`**

```ts
{
  scope: 'global';
  rule: PushSilentModeRuleView;
}
```

### `getGlobalSilentMode`

**签名**

```ts
getGlobalSilentMode(
  params?: GetGlobalSilentModeParams
): Promise<GlobalSilentModeResponse>
```

**请求参数：`GetGlobalSilentModeParams`**

| 字段      | 类型                                           | 必填 | 说明     |
| --------- | ---------------------------------------------- | ---- | -------- |
| `success` | `(response: GlobalSilentModeResponse) => void` | 否   | 成功回调 |
| `error`   | `(error: SDKError) => void`                    | 否   | 失败回调 |

业务查询无需额外入参。

**返回结构：`GlobalSilentModeResponse`**

```ts
{
  scope: 'global';
  rule: PushSilentModeRuleView;
}
```

### `setConversationSilentMode`

**签名**

```ts
setConversationSilentMode(
  params: SetConversationSilentModeParams
): Promise<ConversationSilentModeResponse>
```

**请求参数：`SetConversationSilentModeParams`**

| 字段             | 类型                                                  | 必填 | 说明             |
| ---------------- | ----------------------------------------------------- | ---- | ---------------- |
| `conversationId` | `string`                                              | 是   | 会话 ID          |
| `type`           | `'singleChat' \| 'groupChat'`                         | 是   | 会话类型         |
| `rule`           | [`PushSilentModeRuleInput`](#pushsilentmoderuleinput) | 是   | 会话级免打扰规则 |
| `success`        | `(response: ConversationSilentModeResponse) => void`  | 否   | 成功回调         |
| `error`          | `(error: SDKError) => void`                           | 否   | 失败回调         |

**返回结构：`ConversationSilentModeResponse`**

```ts
{
  conversationId: string;
  type: 'singleChat' | 'groupChat';
  rule: PushSilentModeRuleView;
}
```

### `getConversationSilentMode`

**签名**

```ts
getConversationSilentMode(
  params: GetConversationSilentModeParams
): Promise<ConversationSilentModeResponse>
```

**请求参数：`GetConversationSilentModeParams`**

| 字段             | 类型                                                 | 必填 | 说明     |
| ---------------- | ---------------------------------------------------- | ---- | -------- |
| `conversationId` | `string`                                             | 是   | 会话 ID  |
| `type`           | `'singleChat' \| 'groupChat'`                        | 是   | 会话类型 |
| `success`        | `(response: ConversationSilentModeResponse) => void` | 否   | 成功回调 |
| `error`          | `(error: SDKError) => void`                          | 否   | 失败回调 |

**返回结构：`ConversationSilentModeResponse`**

```ts
{
  conversationId: string;
  type: 'singleChat' | 'groupChat';
  rule: PushSilentModeRuleView;
}
```

### `clearConversationRemindType`

**签名**

```ts
clearConversationRemindType(
  params: ClearConversationRemindTypeParams
): Promise<ConversationSilentModeResponse>
```

**请求参数：`ClearConversationRemindTypeParams`**

| 字段             | 类型                                                 | 必填 | 说明     |
| ---------------- | ---------------------------------------------------- | ---- | -------- |
| `conversationId` | `string`                                             | 是   | 会话 ID  |
| `type`           | `'singleChat' \| 'groupChat'`                        | 是   | 会话类型 |
| `success`        | `(response: ConversationSilentModeResponse) => void` | 否   | 成功回调 |
| `error`          | `(error: SDKError) => void`                          | 否   | 失败回调 |

**返回结构：`ConversationSilentModeResponse`**

```ts
{
  conversationId: string;
  type: 'singleChat' | 'groupChat';
  rule: {
    remindType?: 'ALL' | 'AT' | 'NONE' | 'DEFAULT';
    expireTimestamp?: number;
    silentModeStartTime?: PushTimePoint;
    silentModeEndTime?: PushTimePoint;
  };
}
```

通常清除后 `rule.remindType` 为 `DEFAULT`。

### `getConversationSilentModes`

**签名**

```ts
getConversationSilentModes(
  params: GetConversationSilentModesParams
): Promise<BatchConversationSilentModeResponse>
```

**请求参数：`GetConversationSilentModesParams`**

| 字段               | 类型                                                      | 必填 | 说明                             |
| ------------------ | --------------------------------------------------------- | ---- | -------------------------------- |
| `conversationList` | `ReadonlyArray<ConversationIdentifier>`                   | 是   | 会话列表，不能为空，且最多 20 条 |
| `success`          | `(response: BatchConversationSilentModeResponse) => void` | 否   | 成功回调                         |
| `error`            | `(error: SDKError) => void`                               | 否   | 失败回调                         |

**返回结构：`BatchConversationSilentModeResponse`**

```ts
{
  conversations: Array<{
    conversationId: string;
    type: 'singleChat' | 'groupChat';
    rule: PushSilentModeRuleView;
  }>;
}
```

返回结果顺序与 `conversationList` 输入顺序保持一致。

### `setPushLanguage`

**签名**

```ts
setPushLanguage(params: SetPushLanguageParams): Promise<PushLanguageResponse>
```

**请求参数：`SetPushLanguageParams`**

| 字段       | 类型                                       | 必填 | 说明                       |
| ---------- | ------------------------------------------ | ---- | -------------------------- |
| `language` | `string`                                   | 是   | 语言值，如 `zh-Hans`、`en` |
| `success`  | `(response: PushLanguageResponse) => void` | 否   | 成功回调                   |
| `error`    | `(error: SDKError) => void`                | 否   | 失败回调                   |

**返回结构：`PushLanguageResponse`**

```ts
{
  language: string;
}
```

### `getPushLanguage`

**签名**

```ts
getPushLanguage(params?: GetPushLanguageParams): Promise<PushLanguageResponse>
```

**请求参数：`GetPushLanguageParams`**

| 字段      | 类型                                       | 必填 | 说明     |
| --------- | ------------------------------------------ | ---- | -------- |
| `success` | `(response: PushLanguageResponse) => void` | 否   | 成功回调 |
| `error`   | `(error: SDKError) => void`                | 否   | 失败回调 |

业务查询无需额外入参。

**返回结构：`PushLanguageResponse`**

```ts
{
  language: string;
}
```

### `getConversationListByRemindType`

**签名**

```ts
getConversationListByRemindType(
  params: GetConversationListByRemindTypeParams
): Promise<MutedConversationPageResponse>
```

**请求参数：`GetConversationListByRemindTypeParams`**

| 字段       | 类型                                                | 必填 | 说明                             |
| ---------- | --------------------------------------------------- | ---- | -------------------------------- |
| `pageSize` | `number`                                            | 是   | 分页大小，必须为正整数           |
| `cursor`   | `string`                                            | 否   | 分页游标；传入时必须为非空字符串 |
| `success`  | `(response: MutedConversationPageResponse) => void` | 否   | 成功回调                         |
| `error`    | `(error: SDKError) => void`                         | 否   | 失败回调                         |

**返回结构：`MutedConversationPageResponse`**

```ts
{
  conversations: Array<{
    conversationId: string;
    type: 'singleChat' | 'groupChat';
    remindType: 'ALL' | 'AT' | 'NONE';
  }>;
  cursor: string;
}
```

`cursor` 为空字符串表示没有更多数据。
