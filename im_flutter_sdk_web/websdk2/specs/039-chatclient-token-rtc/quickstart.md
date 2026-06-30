# Quickstart: ChatClient Token 续期与 RTC Token 能力

## Scope

本 quickstart 用于验证 `039-chatclient-token-rtc` 的计划和后续实现：

- `ChatClient.renewToken(token)` 更新 IM token，返回 `{ token, expireAt }`
- `onTokenWillExpire` 在 token 剩余生命周期进入最后 20% 时派发
- `onTokenExpired` 派发后断开长连接，但不执行完整 `logout`
- `ChatClient.getRTCTokenInfo({ channelName? })` 返回 lower camelCase RTC token 信息
- `ChatClient.getUserIdsWithRTCUids(rtcUids)` 返回 `Record<RTCUid, userId>`

## Planned Verification Commands

```bash
npm run type-check
npm run lint
npm run test:run -- tests/unit/chat-client-token-rtc tests/unit/core/connection tests/unit/rest/rtc-token.test.ts tests/integration/chat-client-token-rtc
npm run test:gate:pr
```

## Unit Verification Checklist

- `renewToken`:
  - 未初始化、未登录、空 token 抛 `ValidationError`
  - token expires 响应缺失或过期时抛 `SDKError`
  - 成功后更新 ChatClient REST token、CoreSDK token、ConnectionManager token、MSync codec token
  - 成功返回 `{ token, expireAt }`
  - 多次续期只保留最后一次 token 的提醒和过期计时器
- token events:
  - 最后 20% 生命周期触发一次 `onTokenWillExpire`
  - 到期触发一次 `onTokenExpired`
  - 过期后连接状态为 disconnected，原因可诊断为 token expired
  - 过期后不执行完整 `logout`，不移除用户注册事件
- RTC REST:
  - `getRTCTokenInfo({ channelName })` 归一化 `app_id/rtc_token/channel_name/rtcUid/expires_in`
  - `getRTCTokenInfo()` 使用服务端默认频道语义
  - `getUserIdsWithRTCUids([])` 和非法 UID 抛校验错误
  - 部分映射结果只返回已命中项

## Integration Verification Checklist

- 使用 mock WebSocket 和 mock REST：
  - 登录成功后触发 token 生命周期计时
  - `renewToken` 成功后后续 REST 请求 Authorization 使用新 token
  - `renewToken` 成功后后续 mSync/provision 相关上下文使用新 token
  - token 过期后不进入自动重连
  - `addEventHandler/removeEventHandler` 可以注册和移除 `onTokenWillExpire/onTokenExpired`

## E2E / Real Environment Notes

自动 E2E 依赖可控短有效期 token 和真实 RTC token 服务。如果当前环境无法稳定构造短 token：

- PR 阶段可用单元和集成测试阻塞
- release 前需补一条真实环境记录，说明：
  - 测试账号
  - token 有效期
  - will-expire 触发时间
  - expired 后连接状态
  - RTC token 返回字段
  - RTC UID 映射结果

## Validation Log

- `npm run type-check` - 通过
- `npm run lint` - 通过，保留仓库既有 4 个 warning
- `npm run test:run -- tests/unit/chat-client-token-rtc tests/unit/core/connection tests/unit/rest/rtc-token.test.ts tests/integration/chat-client-token-rtc` - 通过
- `npm run test:run` - 提权执行通过，225 个测试文件通过、2 个跳过
- `npm run test:gate:pr` - 通过
- `npm run docs:api:check` - 通过
- 真实环境 token/RTC 验证：本次未执行，当前没有可稳定复现的短有效期 token 与 RTC 服务联调条件

## Sensitive Data Rules

- 测试日志不得打印 IM token 或 RTC token 全量值
- 断言 token 更新时只比较变量或脱敏片段
- 错误 details 不得包含 Authorization header
