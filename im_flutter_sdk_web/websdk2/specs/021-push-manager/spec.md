# 功能规格：PushManager 推送与免打扰管理

**Feature Branch**: `021-push-manager`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: 用户需求："写 021 spec，实现 pushManager。包含 `uploadPushTokenToServer` 与 `silentModeApi.ts` 全部 API，同时优化 API 定义（尤其参数与返回值，必要时拆分 API），错误处理参考 `specs/005-error-handling/spec.md`，并按 speckit.specify 模板产出。"

**Reference**:

- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/push.ts`
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/silentModeApi.ts`
- `/Users/zhangdong/code/websdk2/specs/005-error-handling/spec.md`

## Clarifications

### Session 2026-02-26

- Q: 会话级免打扰 API 的会话类型范围要如何定义？ → A: 仅支持 `singleChat`、`groupChat`，类型层面直接排除 `chatRoom`。
- Q: PushManager 的旧 API 兼容策略要怎么定？ → A: 只保留新 API，旧 API 全部不兼容（破坏性升级）。
- Q: 免打扰“时间区间模式”的时区基准要怎么定义？ → A: 固定使用设备本地时区。
- Q: 批量查询会话免打扰（上限 20）超限时，错误细分策略怎么定？ → A: 超限统一返回 `INVALID_PARAM (110)`，并在 `details.fields` 标记 `conversationList` 超限。
- Q: 同一设备重复上传 Push Token 时，期望语义是什么？ → A: 相同 `deviceId` 重复上传时覆盖为最新 token（幂等更新）。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 注册推送设备并配置全局免打扰 (Priority: P1)

作为 SDK 使用者，我希望在登录后注册设备推送标识，并可直接设置当前账号的全局免打扰策略，以保证离线推送行为符合业务预期。

**Why this priority**: 设备 token 注册和全局免打扰是推送能力可用的前置条件，缺失会直接导致“收不到推送”或“推送打扰策略错误”。

**Independent Test**: 使用有效登录态调用“上传 token + 设置全局免打扰 + 查询全局免打扰”，返回成功且查询结果与设置一致。

**Acceptance Scenarios**:

1. **Given** 用户已登录且传入合法设备信息，**When** 调用 Push Token 上传 API，**Then** Promise resolve 且完成设备绑定（不返回业务数据）。
2. **Given** 用户已登录，**When** 调用全局免打扰设置 API（提醒类型/持续时长/时间区间任一模式），**Then** 服务端保存配置且查询 API 返回一致配置。
3. **Given** 传入非法参数（如空 token、非法时间区间），**When** 调用对应 API，**Then** 请求在本地校验阶段失败并返回统一参数错误契约。

---

### User Story 2 - 管理会话级免打扰并批量查询 (Priority: P1)

作为 SDK 使用者，我希望按会话单独设置或清除免打扰，并可批量查询多个会话当前配置，便于在会话列表中展示精准推送策略。

**Why this priority**: 会话级推送策略直接影响核心消息触达体验，且列表页通常依赖批量查询结果。

**Independent Test**: 针对单聊/群聊会话设置免打扰后，执行单会话查询与批量查询，结果均正确；清除提醒类型后状态恢复默认。

**Acceptance Scenarios**:

1. **Given** 提供合法会话标识与会话类型，**When** 调用会话免打扰设置 API，**Then** 指定会话的免打扰配置生效。
2. **Given** 已设置会话提醒类型，**When** 调用清除提醒类型 API，**Then** 会话提醒类型恢复默认并可被查询验证。
3. **Given** 提供会话列表（数量不超过上限），**When** 调用批量查询 API，**Then** 返回每个会话的独立配置结果，且不混淆单聊与群聊数据。

---

### User Story 3 - 管理推送翻译语言与免打扰会话分页 (Priority: P2)

作为 SDK 使用者，我希望设置/获取推送翻译语言，并分页拉取所有已设置免打扰提醒类型的会话，支持设置页与管理页展示。

**Why this priority**: 这是推送体验优化能力，优先级低于 token 注册与免打扰核心链路，但属于完整 PushManager 的必要组成。

**Independent Test**: 设置翻译语言后可查询回读；分页查询免打扰会话时，cursor 翻页行为正确且结果结构稳定。

**Acceptance Scenarios**:

1. **Given** 提供合法语言参数，**When** 调用设置语言 API，**Then** 获取语言 API 返回新值。
2. **Given** 已存在多条免打扰会话记录，**When** 使用分页参数调用查询 API，**Then** 返回会话列表与下一页 cursor，并可持续翻页直到结束。

### Edge Cases

- 设备 token 上传时 `deviceId`、`deviceToken`、`notifierName` 任一为空或类型错误；同 `deviceId` 重复上传需按幂等覆盖处理。
- 免打扰“时间区间模式”中 `startTime`、`endTime` 越界或开始时间等于结束时间；时间计算固定基于设备本地时区。
- 同一接口同时混入不兼容参数（例如同时传持续时长和时间区间）。
- 会话类型非法（含 `chatRoom`）、会话 ID 为空、批量查询列表为空或超过单次上限（20）。
- 批量查询列表包含重复会话或同 ID 不同类型，返回结果去重与映射规则；当列表长度 >20 时返回 `INVALID_PARAM (110)`。
- 分页参数缺失、页大小非法或 cursor 无效时的返回行为。
- 登录态失效、网络超时、服务端业务拒绝时的错误码与错误详情一致性。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系统必须提供 `PushManager`，并按现有 Manager 机制挂载到 `ChatClient`。
- **FR-002**: `PushManager` 必须覆盖旧工程 `uploadPushTokenToServer` 与 `silentModeApi.ts` 的全部业务能力，不得缺项。
- **FR-003**: 系统必须提供 Push Token 上传能力，输入参数至少包含设备标识、设备 token、推送通道标识；成功时 Promise resolve，不返回业务数据。
- **FR-004**: 系统必须将“全局免打扰设置”定义为强类型 API，调用方可明确选择提醒类型、静默时长、静默时间区间三种模式中的一种，禁止通过弱类型数字开关表达。
- **FR-005**: 系统必须将“会话免打扰设置”定义为强类型 API，仅支持 `singleChat` 与 `groupChat`，并支持提醒类型、静默时长、静默时间区间三种模式设置。
- **FR-006**: 系统必须提供会话提醒类型清除能力，并保证清除后查询结果可识别为默认策略。
- **FR-007**: 系统必须提供全局免打扰查询、单会话免打扰查询、批量会话免打扰查询三类读取能力。
- **FR-008**: 批量会话免打扰查询必须限制单次输入上限（20），超限时必须返回 `INVALID_PARAM (110)`，并在 `details.fields` 中标记 `conversationList` 超限，禁止截断处理。
- **FR-009**: 系统必须提供推送翻译语言的设置与查询能力，并返回统一的语言字段定义。
- **FR-010**: 系统必须提供“按提醒类型进入免打扰的会话”分页查询能力，返回会话列表与下一页游标。
- **FR-011**: 系统必须对外提供精确、可区分的请求参数类型与响应结果类型；不同业务场景返回结构不得混用 `any` 或不透明对象。
- **FR-012**: 若旧接口中单一 API 同时承载多种业务语义，系统必须拆分为多个语义单一的新 API，或通过可判别联合类型保证“一个请求只表示一种语义”。
- **FR-013**: 所有对外异步 API 必须默认返回 Promise；新 API 可选支持 success/error 回调，但不保证旧 API 方法名兼容。
- **FR-014**: 所有 API 必须遵循 `specs/005-error-handling/spec.md` 的统一错误契约（`code`、`message`、`details`）。
- **FR-015**: 参数校验错误必须在发起网络请求前失败，错误码使用 `INVALID_PARAM (110)`，并在 `details.fields` 中返回具体字段路径与原因。
- **FR-016**: REST 失败必须区分传输错误与业务错误，并映射到统一数字错误码体系（含 Push 相关错误码区间 `1500-1502`）。
- **FR-017**: 登录态失效或连接状态不满足前置条件时，API 必须返回可识别的连接/鉴权错误，不得返回原生 `Error`。
- **FR-018**: 所有 API 错误必须通过对应调用 Promise 的 reject/catch 处理，不引入全局 onError 兜底作为必选依赖。
- **FR-019**: 会话级免打扰相关 API 在接收到 `chatRoom` 类型时必须直接返回 `INVALID_PARAM (110)`，且 `details.fields` 明确标记 `type` 字段不支持。
- **FR-020**: 本期仅提供新 PushManager API，旧 API 方法名与参数形态不做兼容别名；若调用旧入口应返回明确的不可用/不存在语义。
- **FR-021**: 免打扰时间区间模式的时间解释必须固定基于设备本地时区，不引入额外时区入参。
- **FR-022**: Push Token 上传在相同 `deviceId` 重复调用时必须按幂等语义覆盖为最新 `deviceToken`，并保持成功时 Promise resolve（无业务返回体）。

### Key Entities _(include if feature involves data)_

- **PushTokenBinding**: 设备推送绑定实体，包含 `deviceId`、`deviceToken`、`notifierName` 输入字段与幂等覆盖语义。
- **SilentModeRule**: 免打扰规则实体，表示提醒类型模式、持续时长模式或时间区间模式中的一种，并携带统一生效信息。
- **ConversationSilentModeSnapshot**: 会话级免打扰快照，包含会话 ID、会话类型、当前规则与来源范围（单会话/批量）。
- **PushLanguagePreference**: 推送翻译语言偏好实体，包含语言代码与更新时间。
- **MutedConversationPage**: 免打扰会话分页实体，包含会话列表、游标与分页参数。

### Assumptions & Dependencies

- 时间区间免打扰按设备本地时区解释，跨时区一致性由业务侧自行管理。
- 本期范围不包含旧 Push/SilentMode API 的兼容别名层与自动迁移适配。
- 旧工程中 `silentModeApi.ts` 的能力边界（全局设置、会话设置、批量查询、语言设置、分页查询）在本期保持完整继承。
- 服务端对推送与免打扰相关 REST 接口能力保持可用，且返回字段可映射为统一错误契约与强类型响应。
- PushManager 复用现有 REST 客户端与错误映射机制，不额外引入新的全局错误通道。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Push Token 上传成功场景中，调用成功率达到 100%，并可在后续查询链路中确认绑定生效。
- **SC-002**: 全局免打扰三种模式（提醒类型/持续时长/时间区间）设置后回读一致性达到 100%。
- **SC-003**: 会话免打扰单会话查询与批量查询结果一致性达到 100%，且单聊/群聊映射错误率为 0。
- **SC-004**: 参数非法场景返回 `INVALID_PARAM (110)` 命中率达到 100%，且无网络请求被触发。
- **SC-005**: REST 传输错误与业务错误在错误码层面可区分，分类准确率达到 100%。
- **SC-006**: 推送翻译语言设置后可稳定回读，正确率达到 100%。
- **SC-007**: 免打扰会话分页在连续翻页场景下无重复/漏项，数据完整性达到 100%。
- **SC-008**: 相同 `deviceId` 重复上传 token 场景下，最新 token 生效率达到 100%，且不出现重复绑定错误。
