# Research: ChatClient Token 续期与 RTC Token 能力

## Decision: `renewToken` 通过 token expires REST 校验并返回续期结果

**Rationale**: 旧工程在续期时调用 `GET /sdk/users/{userId}/token/expires`，用新 token 查询 `expire_timestamp` 后再更新当前连接 token 和倒计时。本期沿用这个语义，可以避免只本地替换 token 却不知道过期时间的问题。公开返回结果包含已应用的 `token` 与 `expireAt`，满足澄清结果。

**Alternatives considered**:
- 只本地替换 token 并返回 `void`：无法重置准确的过期提醒，已被澄清否定。
- 解析 JWT 本地 exp：当前 token 不保证是标准 JWT，兼容性风险高。

## Decision: `onTokenWillExpire` 在 token 剩余生命周期进入最后 20% 时触发

**Rationale**: 用户澄清为“剩余 20% 生命周期触发”。实现上需基于本次 token 的总有效期与当前时间计算提醒点，并保证每个 token 生命周期正常只触发一次。续期成功后必须清理旧提醒和过期定时器。

**Alternatives considered**:
- 固定提前 5 分钟：短 token 和长 token 都可能不合适。
- 剩余 80% 生命周期触发：与澄清相反，提醒过早。

## Decision: token 过期后断开当前长连接但不执行完整 logout

**Rationale**: 澄清选择为只派发 `onTokenExpired` 并断开连接，不清理本地登录态、缓存和事件处理器。这样保留业务层重新取 token 后恢复连接的空间，同时阻止旧 token 自动重连。

**Alternatives considered**:
- 完整 `logout`：会放大 token 过期影响，清理缓存和注册态。
- 继续旧 token 自动重连：鉴权失效后会造成失败循环。

## Decision: RTC token 返回 lower camelCase 业务对象

**Rationale**: 旧工程返回 `RTCToken` / `RTCUId` 等混合大小写字段。本仓库公共 API 更偏向 lower camelCase，澄清也已确认主契约采用 `rtcToken`、`rtcUid`、`expireAt`。服务端原始字段只在 normalizer 内部处理。

**Alternatives considered**:
- 保留旧字段名：不符合当前 API 风格。
- 同时返回旧字段别名：扩大类型面，后续文档和测试成本更高。

## Decision: RTC UID mapper 返回映射对象

**Rationale**: 澄清确认 `getUserIdsWithRTCUids` 返回 `Record<RTCUid, userId>`，未映射 UID 不返回。该形态便于调用方按 RTC UID O(1) 查找，也自然表达服务端部分命中。

**Alternatives considered**:
- 返回列表：保序容易但查找不便，还需额外表达缺失项。
- 同时返回列表和映射：语义重复。

## Decision: REST helper 复用现有 `RestClient` 与 `RestContext`

**Rationale**: 当前 managers 和 ChatClient 已统一通过 `RestClient` 设置 Bearer token，并将服务端包装转换为业务对象或 `SDKError`。新 RTC helper 应保持同一模式，避免在 ChatClient 内直接拼接请求和解析响应。

**Alternatives considered**:
- 在 `ChatClient` 中内联 REST 请求：破坏对外入口只编排的原则。
- 新建 manager：本期需求明确挂在 ChatClient，且能力较小，不需要额外 manager。

## Decision: token 值禁止进入日志、事件 payload 和错误 details

**Rationale**: token 属敏感鉴权信息。虽然 `renewToken` 结果按需求返回 token 给调用方，但 SDK 自身日志和错误详情不得打印 token，事件也不应携带 token。

**Alternatives considered**:
- 在日志中打印 token 辅助调试：违反安全与合规要求。
