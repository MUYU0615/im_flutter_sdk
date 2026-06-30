# Data Model: ChatClient Token 续期与 RTC Token 能力

## TokenLifecycleState

表示当前登录会话的 IM token 生命周期状态。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | `string` | yes | 当前已应用的 IM 登录 token；不得写入日志 |
| `issuedAt` | `number` | yes | 本地确认 token 生命周期的时间戳，毫秒 |
| `expireAt` | `number` | yes | token 过期时间戳，毫秒 |
| `willExpireAt` | `number` | yes | 进入最后 20% 生命周期的提醒时间戳，毫秒 |
| `willExpireEmitted` | `boolean` | yes | 当前 token 生命周期是否已派发 will-expire 事件 |
| `expiredEmitted` | `boolean` | yes | 当前 token 生命周期是否已派发 expired 事件 |

### Validation Rules

- `token` 必须为非空字符串。
- `expireAt` 必须大于当前时间。
- `willExpireAt` 必须小于等于 `expireAt`。
- `renewToken` 成功后必须替换整个生命周期状态，并清理旧 token 的计时器。

### State Transitions

```text
none -> active(token applied)
active -> willExpiring(final 20% reached)
willExpiring -> expired(expireAt reached)
active -> expired(expireAt reached before warning can be observed)
active/willExpiring -> active(renewToken success)
expired -> disconnected(token-expired disconnect)
```

## TokenRenewalResult

`ChatClient.renewToken(token)` 成功后的公开返回对象。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | `string` | yes | 已成功应用的新 IM token |
| `expireAt` | `number` | yes | 新 token 过期时间戳，毫秒 |

### Validation Rules

- 返回的 `token` 必须等于本次成功应用的 token。
- `expireAt` 来自服务端 token expires 响应归一化结果。
- 返回对象不得包含服务端包装字段。

## TokenLifecycleEvent

通过 `addEventHandler/removeEventHandler` 派发的 token 生命周期事件。

| Event | Payload | Description |
|-------|---------|-------------|
| `onTokenWillExpire` | `undefined` | 当前 token 进入最后 20% 生命周期 |
| `onTokenExpired` | `undefined` | 当前 token 已过期或服务端明确返回 token expired |

### Validation Rules

- 每个 token 生命周期正常只派发一次 `onTokenWillExpire`。
- 每个 token 生命周期正常只派发一次 `onTokenExpired`。
- 事件 payload 不携带 token。

## RtcTokenInfo

`ChatClient.getRTCTokenInfo(params?)` 的公开返回对象。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | `string` | yes | RTC App ID |
| `rtcToken` | `string` | yes | RTC 入会 token |
| `channelName` | `string` | yes | RTC 频道名 |
| `rtcUid` | `number` | yes | 当前用户 RTC UID |
| `expireAt` | `number` | yes | RTC token 过期时间或服务端过期字段归一化结果 |

### Validation Rules

- 入参为可选对象，`channelName` 可选。
- 未传 `channelName` 时使用服务端默认频道语义。
- 返回字段使用 lower camelCase。
- 不透传服务端 `app_id`、`rtc_token`、`rtcUid`、`expires_in` 等原始字段名。

## RtcUidUserIdMap

`ChatClient.getUserIdsWithRTCUids(rtcUids)` 的公开返回对象。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `[rtcUid]` | `string` | no | RTC UID 对应的 IM userId；未映射 UID 不出现 |

### Validation Rules

- 输入必须为非空数组。
- 每个 RTC UID 必须是安全整数且大于等于 0。
- 重复 RTC UID 可在请求前去重；返回结果只需包含一次。
- 服务端部分命中时，不应因为缺失项失败。

## TokenExpiredDisconnect

token 过期导致的连接断开状态。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | `'token-expired'` | yes | 可诊断断开原因 |
| `state` | `'disconnected'` | yes | 连接断开后的状态 |
| `logoutPerformed` | `false` | yes | 明确不是完整业务 logout |
| `autoReconnectPaused` | `true` | yes | 禁止旧 token 自动重连 |

### Validation Rules

- 断开前必须派发 `onTokenExpired`。
- 断开后不得清理已注册事件处理器。
- 断开后不得使用旧 token 自动重连。
