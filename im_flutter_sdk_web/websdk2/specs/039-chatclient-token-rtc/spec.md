# 功能规格：ChatClient Token 续期与 RTC Token 能力

**Feature Branch**: `039-chatclient-token-rtc`
**Created**: 2026-05-13
**Status**: Draft
**Input**: 用户需求："ChatClient 上实现 renewToken、getUserIdsWithRTCUids、getRTCTokenInfo，同时注册监听事件加上 onTokenWillExpire、onTokenExpired 事件。实现可以参考原工程 /Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/connection.ts 里的 renewToken、onTokenWillExpire、onTokenExpired，以及 /Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/index.ts 里的 getUserIdByRTCUIds、getRTCToken（方法名稍做改变）。同时也得实现 token 过期后的断开逻辑（是否还需要退出？）"

## References

- 旧工程连接参考：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/connection.ts`
- 旧工程 REST API 参考：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/index.ts`
- 当前事件系统规格：`specs/004-event-system/spec.md`
- 当前错误处理规格：`specs/005-error-handling/spec.md`
- 当前连接重连规格：`specs/013-websocket-reconnect/spec.md`

## Clarifications

### Session 2026-05-13

- Q: token 过期后是否执行完整 `logout` 还是仅断开当前长连接？ → A: 只触发 `onTokenExpired` 并断开当前长连接，不执行完整 `logout`，不清理本地登录态和已注册事件。
- Q: `getRTCTokenInfo` 的对外返回字段应优先采用哪种命名风格？ → A: 使用 SDK 统一的 lower camelCase，并用 `rtcToken` / `rtcUid` / `expireAt` 这类更清晰的业务字段，不保留服务端大小写混合字段作为主契约。
- Q: `getUserIdsWithRTCUids` 的对外返回形态应如何定义？ → A: 返回映射对象 `Record<RTCUid, userId>`，缺失项不返回。
- Q: `getRTCTokenInfo` 的入参形态应如何定义？ → A: 使用对象入参，`channelName` 作为可选字段。
- Q: `onTokenWillExpire` 的触发时机应如何定义？ → A: 在 token 剩余生命周期进入最后 20% 时触发。
- Q: `renewToken` 成功后应返回什么？ → A: 返回完整续期结果对象，包含 token 与过期时间。

## Assumptions

- `renewToken` 用于当前 IM 登录 token 续期；RTC token 获取与 RTC UID 映射只是 REST 能力，不改变当前 IM 连接 token。
- `renewToken` 成功返回续期业务结果对象，至少包含已应用的 token 与过期时间；Promise 成功即表示续期完成。
- `getRTCTokenInfo` 对齐旧工程 `getRTCToken` 的业务语义，但对外方法名使用本期要求的新名称。
- `getRTCTokenInfo` 使用对象入参，`channelName` 为可选字段；对外返回字段采用 lower camelCase。
- `getUserIdsWithRTCUids` 对齐旧工程 `getUserIdByRTCUIds` 的业务语义，但对外方法名使用本期要求的新名称；`RTCUids` 表示 RTC 数字 UID 列表。
- token 过期后的默认行为是断开当前长连接并派发过期事件，不执行完整 logout；SDK 不主动清理本地缓存、当前用户身份或已注册事件处理器。应用需获取新 token 后重新登录或按后续恢复能力重新建立连接。
- `onTokenWillExpire` 与 `onTokenExpired` 通过现有 `addEventHandler/removeEventHandler` 事件注册风格暴露，不新增单独 delegate setter。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 登录态 token 过期前续期 (Priority: P1)

作为 SDK 使用者，我希望在当前登录 token 即将过期时收到明确事件，并能调用 `renewToken` 更新 SDK 内部 token，这样业务无需强制用户重新登录即可维持 IM 长连接。

**Why this priority**: token 续期是长连接稳定性的核心路径；如果续期能力缺失，业务只能等待连接过期后重登，聊天收发会出现可感知中断。

**Independent Test**: 使用一个即将过期的登录 token 建立连接，监听 `onTokenWillExpire` 后调用 `renewToken`，验证后续消息收发与 REST 请求继续使用新 token。

**Acceptance Scenarios**:

1. **Given** 当前用户已成功登录且 token 仍有效，**When** token 剩余生命周期进入最后 20%，**Then** SDK 必须触发一次 `onTokenWillExpire` 事件，提示应用刷新 token。
2. **Given** 当前用户已连接且应用已获取新 token，**When** 应用调用 `renewToken(newToken)`，**Then** SDK 必须更新当前会话使用的 token、重新计算下一轮过期提醒与过期时间，并返回包含 token 与过期时间的续期结果。
3. **Given** `renewToken` 成功，**When** 应用继续发送消息或调用需要鉴权的公开能力，**Then** SDK 必须使用新 token 完成鉴权，不再使用旧 token。
4. **Given** 当前用户未登录、未连接或传入空 token，**When** 应用调用 `renewToken`，**Then** SDK 必须以统一 SDK 错误拒绝调用，并说明当前状态或参数不满足续期条件。

---

### User Story 2 - token 过期后明确断开 (Priority: P1)

作为 SDK 使用者，我希望 token 真正过期时收到 `onTokenExpired` 事件，并看到 SDK 当前连接进入断开状态，这样业务可以停止依赖旧连接并引导用户重新获取 token。

**Why this priority**: token 过期属于鉴权失效，不应继续静默重连或尝试使用旧 token；明确断开能避免消息发送挂起、重复失败或无限重连。

**Independent Test**: 使用短有效期 token 登录，等待其过期，验证 SDK 触发 `onTokenExpired` 并关闭当前连接，同时不执行完整 logout 清理。

**Acceptance Scenarios**:

1. **Given** 当前登录 token 已到达过期时间，**When** SDK 检测到过期，**Then** SDK 必须先触发 `onTokenExpired`，再断开当前长连接。
2. **Given** token 已过期导致连接断开，**When** SDK 更新连接状态，**Then** SDK 必须派发断开事件，断开原因应能区分为 token 过期而非普通网络断开。
3. **Given** token 已过期，**When** SDK 断开当前连接，**Then** SDK 不得自动使用旧 token 重连。
4. **Given** token 已过期，**When** SDK 完成断开处理，**Then** SDK 不得等同执行业务 logout，不得主动清空本地缓存、当前用户身份、管理器注册关系或用户已注册的事件处理器。

---

### User Story 3 - 获取 RTC token 信息 (Priority: P2)

作为 SDK 使用者，我希望通过 `ChatClient.getRTCTokenInfo` 获取当前用户加入 RTC 频道所需的 token、RTC UID、App ID 与过期信息，这样音视频业务可以复用 IM 登录态完成 RTC 入会准备。

**Why this priority**: RTC token 是音视频场景接入的基础能力，但它不影响纯 IM 主路径，因此优先级低于 IM token 续期和过期断开。

**Independent Test**: 在已登录状态下传入频道名称调用 `getRTCTokenInfo`，验证返回结构包含 RTC 入会所需字段，且字段命名稳定、无服务端包装泄漏。

**Acceptance Scenarios**:

1. **Given** 当前用户已登录，**When** 应用调用 `getRTCTokenInfo({ channelName })`，**Then** SDK 必须返回当前用户在该 RTC 频道可使用的 RTC token 信息，返回字段使用 lower camelCase。
2. **Given** 应用未指定频道名称，**When** 应用调用 `getRTCTokenInfo()`，**Then** SDK 必须按服务默认频道语义获取 RTC token 信息。
3. **Given** 当前用户未登录或鉴权失效，**When** 应用调用 `getRTCTokenInfo`，**Then** SDK 必须抛出统一 SDK 错误，不得返回服务端原始错误包装。
4. **Given** 服务端返回 RTC token 原始字段，**When** SDK 对外返回，**Then** 返回对象必须只包含业务字段，不得透传 `code/data/path/timestamp` 等服务端包装。

---

### User Story 4 - 批量映射 RTC UID 到用户 ID (Priority: P2)

作为 SDK 使用者，我希望通过 `ChatClient.getUserIdsWithRTCUids` 批量把 RTC 数字 UID 映射为 IM 用户 ID，这样音视频房间内的成员可以和 IM 资料、联系人、群成员展示打通。

**Why this priority**: RTC UID 映射是音视频展示与身份关联能力，通常和 RTC token 获取配套使用。

**Independent Test**: 在已登录状态下传入一组 RTC UID，验证返回每个可识别 UID 对应的用户 ID，并对空数组、非法 UID 和部分缺失结果做明确处理。

**Acceptance Scenarios**:

1. **Given** 当前用户已登录且传入非空 RTC UID 列表，**When** 应用调用 `getUserIdsWithRTCUids`，**Then** SDK 必须返回 RTC UID 到 IM 用户 ID 的映射对象，未映射 UID 不出现在结果中。
2. **Given** 输入列表为空、包含非数字 UID 或超出安全范围，**When** 应用调用该方法，**Then** SDK 必须抛出参数校验错误。
3. **Given** 服务端只识别部分 RTC UID，**When** SDK 返回结果，**Then** SDK 必须保留已识别映射，并允许调用方判断未返回的 UID 未映射。
4. **Given** 调用失败，**When** SDK 抛出错误，**Then** 错误信息不得泄露 token 或敏感鉴权信息。

### Edge Cases

- token 剩余有效期极短，`onTokenWillExpire` 和 `onTokenExpired` 可能非常接近；SDK 必须保证事件顺序可预测，且不会重复派发同一轮过期事件。
- `renewToken` 传入的 token 已过期或无法解析过期时间；SDK 必须拒绝续期并保留原连接状态或按鉴权失败规则断开。
- 多次快速调用 `renewToken`；SDK 最终必须以最后一次成功续期的 token 和过期时间为准，并清理旧的过期提醒。
- 已触发 `onTokenExpired` 后才调用 `renewToken`；SDK 不应假装旧连接仍可用，应用需按重新登录或重新连接流程恢复。
- 应用在 `onTokenWillExpire` 回调中抛错或返回失败 Promise；SDK 不应因此中断内部过期计时和连接状态处理。
- token 过期与网络断开、被踢、多设备冲突等事件同时发生；SDK 应优先保留可诊断的真实原因，并避免重复派发矛盾状态。
- RTC token REST 请求期间 IM token 被续期；请求应使用发起时的鉴权上下文，后续请求必须使用新 token。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 `renewToken` 参数校验、登录态校验、token 过期时间解析、提醒/过期计时重置、`onTokenWillExpire/onTokenExpired` 事件去重与顺序、RTC token 返回结构归一化、RTC UID 输入校验与映射结果归一化。
- Planned location: `tests/unit/chat-client-token-rtc/`、`tests/unit/core/connection/`、`tests/unit/rest/rtc-token.test.ts`、`tests/unit/types/chat-client-token-rtc.test-d.ts`。
- Not applicable rationale: N/A，新增公开 API 与连接事件默认必须覆盖单元测试。

### Integration Tests

- Coverage goals: 覆盖 ChatClient、CoreSDK、ConnectionManager、EventHub、RestClient 的协作；验证续期后鉴权上下文更新、过期后断开且不自动重连、事件通过 `addEventHandler/removeEventHandler` 对外派发、RTC REST 能力在已登录上下文下可用。
- Planned location: `tests/integration/chat-client-token-rtc/`。
- Not applicable rationale: N/A，功能涉及公开入口、连接状态机、事件系统和 REST 鉴权上下文，集成测试必需。

### E2E Tests

- Coverage goals: 评估真实浏览器 demo 登录后 token 即将过期/过期事件展示、续期按钮或流程是否能维持连接、RTC token 获取是否能在真实环境返回可展示结果。
- Planned location: `tests/e2e/token-renewal.spec.ts` 或复用现有登录/连接 E2E；若真实短期 token 难以稳定构造，E2E 可先以手动 real-env 记录或跳过用例形式落地。
- Not applicable rationale: 真实 token 过期依赖可控测试账号与短有效期 token；若环境暂不支持，必须在 quickstart 中记录不新增自动 E2E 的原因和替代验证方式。

### Gate Impact

- Required gates: `npm run type-check`、`npm run lint`、`npm run test:run`；涉及真实环境能力时纳入 `npm run test:e2e` 或 `npm run test:gate:pr` 的可跳过实测说明。
- Validation notes: PR 门禁必须阻塞公开类型、参数校验、事件派发、续期成功/失败、过期断开和 RTC REST 映射回归；真实环境 E2E 若受 token 构造限制，可不阻塞 PR，但 release 前需有手动或自动 real-env 记录。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST expose `ChatClient.renewToken(token)` as a public method for replacing the current IM login token during an active authenticated session.
- **FR-002**: `renewToken` MUST validate that the client is initialized, currently authenticated, and receives a non-empty token before attempting renewal.
- **FR-003**: `renewToken` MUST determine the new token expiration time, update all current IM authentication contexts used by connection and REST operations, and return a renewal result object containing the applied token and expiration time after successful renewal.
- **FR-004**: `renewToken` MUST reset the token warning and expiration schedule after successful renewal, so old timers cannot fire for a token that has been replaced.
- **FR-005**: SDK MUST expose `onTokenWillExpire` through the existing event handler registration mechanism.
- **FR-006**: SDK MUST emit `onTokenWillExpire` when the current token enters the final 20% of its lifecycle, before token expiration.
- **FR-007**: SDK MUST expose `onTokenExpired` through the existing event handler registration mechanism.
- **FR-008**: SDK MUST emit `onTokenExpired` when the current token has expired or when server-side authentication reports the token as expired.
- **FR-009**: After token expiration, SDK MUST close the current long connection and enter a disconnected state with a token-expired reason.
- **FR-010**: After token expiration, SDK MUST NOT automatically reconnect with the expired token.
- **FR-011**: Token expiration handling MUST NOT perform a full business logout unless the application explicitly calls logout.
- **FR-012**: SDK MUST expose `ChatClient.getRTCTokenInfo(params?)` as a public method returning RTC token business information for the current user.
- **FR-013**: `getRTCTokenInfo` MUST accept an optional object parameter with optional `channelName` and use the service default channel behavior when omitted.
- **FR-014**: `getRTCTokenInfo` MUST return a stable lower camelCase business object containing app ID, RTC token, channel name, RTC UID, and expiration information.
- **FR-015**: SDK MUST expose `ChatClient.getUserIdsWithRTCUids(rtcUids)` as a public method for batch RTC UID to IM user ID mapping.
- **FR-016**: `getUserIdsWithRTCUids` MUST reject empty lists and invalid RTC UID values with SDK validation errors.
- **FR-017**: `getUserIdsWithRTCUids` MUST return a stable mapping object without forcing every requested RTC UID to exist in the response.
- **FR-018**: All new public methods MUST return business objects and MUST throw `SDKError` subclasses on failure; they MUST NOT expose raw service response wrappers.
- **FR-019**: All new events and public methods MUST be covered by bilingual public API documentation and exported public types.
- **FR-020**: Logs and errors for token renewal, token expiration, RTC token, and RTC UID mapping MUST NOT print token values or other sensitive authentication data.

### Key Entities

- **Token Renewal State**: Represents the current IM token, its known expiration time, warning status, and expiration status for the current login session.
- **Token Renewal Result**: Represents the successful renewal outcome returned to callers, including the applied token and expiration time.
- **Token Lifecycle Event**: Represents a public notification that the current token will expire soon or has expired.
- **RTC Token Info**: Represents the RTC join credential for a user and channel, including app ID, RTC token, channel name, RTC UID, and expiration.
- **RTC UID Mapping**: Represents a mapping from numeric RTC UID values to IM user IDs.
- **Token Expired Disconnect**: Represents a connection state transition caused by authentication expiration, distinct from normal logout and ordinary network loss.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In controlled tests, 100% of successful `renewToken` calls update subsequent authenticated operations to use the new token and return the applied token with expiration time.
- **SC-002**: In controlled tests, 100% of token expiration cases emit `onTokenExpired` and transition the connection to disconnected without automatic reconnect using the expired token.
- **SC-003**: `onTokenWillExpire` is emitted exactly once per token lifecycle in normal countdown scenarios and before the expiration event.
- **SC-004**: RTC token retrieval returns all required business fields for valid logged-in requests in 100% of mocked success cases.
- **SC-005**: RTC UID mapping rejects invalid input in 100% of validation tests and returns partial mappings without failure when the service omits unknown UIDs.
- **SC-006**: Public API documentation generation can include all new methods, types, and events without missing bilingual comments.
