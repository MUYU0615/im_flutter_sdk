# Feature Specification: Presence Manager 在线状态管理

**Feature Branch**: `[016-presence-manager]`  
**Created**: 2026-02-11  
**Status**: Draft  
**Input**: User description: "实现 presenceManager，覆盖旧工程 presenceApi.ts 的 API，错误处理与 REST 请求参考当前工程"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 订阅用户在线状态并接收变更 (Priority: P1)

作为 SDK 使用者，我希望订阅一组用户的在线状态，并在状态变化时收到通知，以便实时更新 UI。

**Why this priority**: 在线状态是即时通讯的核心体验，缺失会直接影响产品可用性。

**Independent Test**: 订阅指定用户后，模拟状态变更，验证 SDK 能收到并派发变更事件。

**Acceptance Scenarios**:

1. **Given** 已登录且提供有效用户列表，**When** 订阅在线状态，**Then** 返回订阅结果并开始接收状态变更通知。
2. **Given** 订阅已过期或被取消，**When** 服务端发送状态变更，**Then** SDK 不再派发该订阅的变更通知。

---

### User Story 2 - 发布自身在线状态 (Priority: P2)

作为 SDK 使用者，我希望发布自定义在线状态，供其他订阅者查询或接收变更通知。

**Why this priority**: 允许业务侧扩展在线状态含义，提升互动体验。

**Independent Test**: 发布在线状态后，通过查询接口读取该状态，结果与发布内容一致。

**Acceptance Scenarios**:

1. **Given** 已登录，**When** 发布自定义在线状态描述，**Then** 服务端成功保存并对外可查询。

---

### User Story 3 - 查询在线状态与管理订阅列表 (Priority: P3)

作为 SDK 使用者，我希望查询用户当前在线状态，并分页获取/管理订阅列表，便于展示与管理。

**Why this priority**: 查询与管理订阅关系是线上运维与产品体验的重要组成。

**Independent Test**: 使用查询与分页接口拉取数据，验证返回结构与数量符合预期。

**Acceptance Scenarios**:

1. **Given** 提供有效用户列表，**When** 查询在线状态，**Then** 返回每个用户的当前状态详情。
2. **Given** 存在订阅记录，**When** 分页查询订阅列表，**Then** 返回总数与当前页列表。
3. **Given** 订阅列表包含指定用户，**When** 取消订阅，**Then** 列表中不再出现该用户。

---

### Edge Cases

- 订阅/查询用户列表为空或包含非法用户 ID 时如何处理？
- 订阅时长参数缺失、为非数字或小于 0 时如何处理？
- 重复订阅同一用户是否去重，返回结果如何体现？
- 取消订阅未订阅过的用户时是否报错还是忽略？
- 分页参数越界（页码、页大小异常）时返回什么结果？
- 网络异常、超时或鉴权失败时是否返回一致的错误格式？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须提供 PresenceManager，并按现有 Manager 方式挂载到 ChatClient。
- **FR-002**: 系统必须提供发布在线状态能力，支持设置自定义描述信息。
- **FR-003**: 系统必须支持批量订阅在线状态，订阅时长由调用方指定，返回订阅结果列表。
- **FR-004**: 系统必须支持批量取消订阅在线状态。
- **FR-005**: 系统必须提供分页查询订阅列表能力，并返回总数与当前页列表。
- **FR-006**: 系统必须提供查询用户当前在线状态能力，返回状态详情集合。
- **FR-007**: 系统必须提供标准化的 API 命名，订阅列表查询以 `getSubscribedPresenceList` 为准，旧工程别名不再作为新增要求。
- **FR-008**: 系统必须支持 Promise 返回，并允许提供可选的 success/error 回调以兼容旧用法。
- **FR-009**: 系统必须对参数进行校验（用户列表不能为空、订阅时长/分页参数为非负数字），失败时返回统一的参数错误码（`INVALID_PARAM (110)`），并在错误详情中标明具体参数与原因（例如 `details.fields`）。
- **FR-010**: 系统必须遵循 `specs/005-error-handling/spec.md` 的错误契约与错误码规范，REST 传输/业务错误映射保持一致。
- **FR-011**: 订阅成功后，当服务端推送在线状态变更时，SDK 必须通过事件系统派发对应变更通知。

### Key Entities *(include if feature involves data)*

- **PresenceState**: 用户在线状态信息，包含用户 ID、状态详情、扩展描述、更新时间与订阅到期时间。
- **PresenceSubscription**: 订阅记录，包含用户 ID 与订阅到期时间。
- **PresenceSubscriptionList**: 订阅列表结果，包含订阅用户列表与总数。

### Assumptions & Dependencies

- 订阅时长单位沿用旧工程的约定（如需调整由产品或服务端规范明确）。
- Presence 变更通知通过现有事件系统分发，具体事件名与结构应与现有事件体系保持一致。
- REST 调用与错误映射遵循现有错误处理规范与 REST 客户端行为。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 对有效用户列表执行订阅，返回结果数量与输入用户数一致，并开始接收状态变更通知。
- **SC-002**: 发布在线状态后，通过查询接口可获取到一致的状态描述与更新时间。
- **SC-003**: 取消订阅后，查询订阅列表不再包含被取消的用户。
- **SC-004**: 对非法参数请求返回统一的校验错误码 `INVALID_PARAM (110)`，错误详情包含参数路径与原因，且不触发网络请求。
- **SC-005**: 在网络错误、超时或鉴权失败时，返回与现有 REST 错误规范一致的错误结构。
