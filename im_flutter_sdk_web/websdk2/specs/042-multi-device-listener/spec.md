# Feature Specification: ChatClient Multi-Device Listener

**Feature Branch**: `042-multi-device-listener`  
**Created**: 2026-05-22  
**Status**: Draft  
**Input**: User description: "给 ChatClient 加上 MultiDevice 的事件监听，参考移动端 EMMultiDeviceListener，明确都有哪些多设备事件；加完多设备事件后，原来已有事件是否可以省略设备 id。"

## Clarifications

### Session 2026-05-22

- Q: MultiDevice 监听 API 应采用单一总线回调还是按事件类别拆分回调？ → A: 采用分类回调：`onMultiDeviceContact`、`onMultiDeviceGroup`、`onMultiDeviceThread`、`onMultiDeviceConversation`、`onMultiDeviceMessageRemoved`。
- Q: MultiDevice 事件对外如何表达来源设备？ → A: 统一暴露 `deviceId?: string`，服务端 resource/clientResource 也归一到该字段；缺失时保持 `undefined`。
- Q: MultiDevice 事件是否负责更新本地缓存状态？ → A: 本期只保证派发 MultiDevice 事件；本地缓存更新沿用现有业务链路，不新增强制缓存收敛。
- Q: 漫游消息删除 MultiDevice 事件如何表达删除范围？ → A: 同时支持 `messageIds?: string[]` 和 `beforeTimestamp?: number`，且至少一个字段必须存在。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 统一订阅多设备事件 (Priority: P1)

业务应用需要在 Web SDK 中像移动端一样订阅“当前账号在其他设备上的操作”，用于刷新联系人、群组、子区、会话和消息漫游删除等本地视图，而不是从普通业务事件中猜测这些操作是否来自其他设备。

**Why this priority**: 多端同时在线是 IM SDK 的基础能力；没有独立多设备事件时，业务侧无法稳定区分“别人对我发生的事件”和“我在其他设备上发起的同步事件”。

**Independent Test**: 可以通过模拟或真实触发其他设备操作，并只验证 ChatClient 的多设备事件处理器收到标准化 payload，不依赖联系人、群组或消息列表 UI。

**Acceptance Scenarios**:

1. **Given** 当前用户在设备 A 和设备 B 同时在线，**When** 设备 B 接受联系人邀请，**Then** 设备 A 收到联系人类多设备事件，事件包含操作类型、目标用户和 roster 版本信息。
2. **Given** 当前用户在设备 A 和设备 B 同时在线，**When** 设备 B 对群组执行加管理员、禁言、白名单或转让群主等操作，**Then** 设备 A 收到群组类多设备事件，事件包含操作类型、群组 ID 和相关用户列表。
3. **Given** 当前用户在设备 A 和设备 B 同时在线，**When** 设备 B 创建、加入、退出、解散或被踢出子区，**Then** 设备 A 收到子区类多设备事件，事件包含操作类型、子区 ID 和相关用户列表。
4. **Given** 当前用户在设备 A 和设备 B 同时在线，**When** 设备 B 置顶、取消置顶、删除、标记、取消标记或修改会话免打扰，**Then** 设备 A 收到会话类多设备事件，事件包含操作类型、会话 ID、会话类型和必要的标记/免打扰信息。
5. **Given** 当前用户在设备 A 和设备 B 同时在线，**When** 设备 B 删除漫游消息，**Then** 设备 A 收到漫游删除多设备事件，事件包含会话 ID、来源设备 ID、被删除消息 ID 列表和/或删除时间戳，且消息 ID 列表与删除时间戳至少存在一个。

---

### User Story 2 - 与现有业务事件边界清晰 (Priority: P1)

业务应用已经订阅了 `onMessageRead`、`onMessageRecalled`、群组事件、联系人事件等现有事件。新增多设备监听后，业务侧需要明确哪些信息继续从原事件读取，哪些信息从多设备事件读取，避免重复字段和破坏兼容。

**Why this priority**: 如果旧事件和新事件都承载来源设备语义，会造成重复、冲突和迁移成本；如果边界不清晰，业务无法判断是否要同时监听两类事件。

**Independent Test**: 可以通过类型测试和事件用例验证：原事件 payload 保持兼容；多设备事件 payload 独立提供跨设备来源信息；同一操作不会要求业务从原事件读取设备 ID。

**Acceptance Scenarios**:

1. **Given** 应用升级到支持多设备事件的新版本，**When** 继续使用原有业务事件，**Then** 原事件字段不发生破坏性变化。
2. **Given** 某个同步操作来自当前账号的其他设备，**When** SDK 派发多设备事件，**Then** 该事件承担来源设备 ID；原业务事件不需要额外补 `deviceId` 才能表达多设备语义。
3. **Given** 原事件本身已有业务操作者字段，例如 `operatorId`、`from`、`userIds`，**When** 新增多设备事件，**Then** 原事件继续保留这些业务语义字段，不因新监听器而删除或复用为设备字段。

---

### User Story 3 - 覆盖移动端已有多设备事件集合 (Priority: P2)

SDK 维护者需要一个清晰的 Web 端事件清单，与移动端 `EMMultiDeviceListener` 的能力对齐，明确 Web 支持、暂不支持和不适用的事件。

**Why this priority**: 事件枚举和文档必须稳定，后续真实环境 E2E、API 文档和跨端一致性都依赖这份清单。

**Independent Test**: 可以通过枚举/类型测试确认所有定义的多设备操作都有 payload 类型、事件名和文档说明，并通过协议 fixture 验证核心映射。

**Acceptance Scenarios**:

1. **Given** 开发者查看 Web SDK 类型定义或文档，**When** 查找多设备操作枚举，**Then** 能看到联系人、群组、子区、会话、漫游消息删除五类操作及各自 payload 字段。
2. **Given** 移动端文档声明聊天室操作没有多设备事件，**When** Web SDK 设计多设备监听，**Then** 聊天室 join/leave/admin/mute 等事件不列为多设备监听范围。
3. **Given** 某个移动端多设备操作当前 Web 协议链路尚无稳定字段，**When** 写入 spec，**Then** 必须标记为“事件枚举保留但本期不承诺触发”或给出可测试的降级语义。

### Edge Cases

- 当前设备发起的操作经服务端回流时，SDK 必须过滤或标记为本设备事件；默认不对业务派发多设备事件，避免重复处理。
- 服务端 payload 缺少来源设备标识时，SDK 仍可派发多设备事件，但 `deviceId` 必须保持 `undefined`，不能把缺失字段伪造为当前设备。
- 同一操作既会触发现有业务事件又会触发多设备事件时，两类事件必须有明确边界：多设备事件用于同步来源和操作分类，业务事件用于原有业务通知。
- 未识别的移动端 operation 必须归一为 `unknown` 或丢弃并记录日志，不得派发到错误的操作类型。
- 群组、联系人、会话缓存更新失败时，不得阻塞多设备事件派发；本期 MultiDevice 事件本身不承诺新增缓存收敛，事件 payload 应保留服务端原始可识别字段。
- 多个监听器注册同一类事件时，移除其中一个监听器不得影响其他监听器。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖多设备 operation 枚举、协议 payload 到标准事件 payload 的映射、当前设备 resource 过滤、缺失 deviceId/resource、unknown operation、监听器 add/remove/clear 行为。
- Planned location: `tests/unit/multi-device/`、`tests/unit/core/message/`、`tests/types/multi-device-events.d.ts`
- Not applicable rationale: N/A；这是事件类型和协议映射能力，单元测试必需。

### Integration Tests

- Coverage goals: 覆盖 mSync notify 解码 -> ChatClient 事件系统 -> 多设备事件 handler 的整链路；覆盖联系人、群组、子区、会话和漫游删除至少各一个代表场景。
- Planned location: `tests/integration/multi-device/multi-device-listener.integration.test.ts`
- Not applicable rationale: N/A；该能力跨协议解码、事件系统和 ChatClient 公共 API，集成测试必需。

### E2E Tests

- Coverage goals: 在真实浏览器双账号/双页面环境中覆盖 ChatClient 多设备事件 handler 的注册、移除和至少一个真实可稳定触发的多设备事件；真实服务无法稳定触发的类别必须用 fixture 说明并保留在 nightly/real-env backlog。
- Planned location: `tests/e2e/api/auth.spec.ts` 或新增 `tests/e2e/api/multi-device.spec.ts`
- Not applicable rationale: N/A；这是公开事件能力，至少需要浏览器入口 E2E 验证 handler API 行为。

### Gate Impact

- Required gates: PR gate 必须包含单元、类型和核心集成测试；Nightly gate 必须包含 multi-device 浏览器 E2E；Release gate 必须包含文档生成检查和完整 API 类型检查。
- Validation notes: 若真实环境缺少双设备稳定触发条件，PR gate 不阻塞真实事件 E2E，但必须用协议 fixture 覆盖事件映射；Nightly 记录真实环境覆盖状态。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST provide ChatClient-level multi-device event listener registration and removal capability consistent with existing `addEventHandler/removeEventHandler` style, using category-specific callbacks: `onMultiDeviceContact`、`onMultiDeviceGroup`、`onMultiDeviceThread`、`onMultiDeviceConversation` and `onMultiDeviceMessageRemoved`.
- **FR-002**: SDK MUST expose a dedicated multi-device event payload model instead of requiring existing business events to carry multi-device source semantics.
- **FR-003**: SDK MUST define contact multi-device operations at least including `CONTACT_REMOVE`、`CONTACT_ACCEPT`、`CONTACT_DECLINE`、`CONTACT_BAN`、`CONTACT_ALLOW` and `UNKNOWN`.
- **FR-004**: Contact multi-device events MUST include operation, target user ID, optional roster version/ext, optional `deviceId`, and event timestamp when available.
- **FR-005**: SDK MUST define group multi-device operations at least including `GROUP_CREATE`、`GROUP_DESTROY`、`GROUP_JOIN`、`GROUP_LEAVE`、`GROUP_APPLY`、`GROUP_APPLY_ACCEPT`、`GROUP_APPLY_DECLINE`、`GROUP_INVITE`、`GROUP_INVITE_ACCEPT`、`GROUP_INVITE_DECLINE`、`GROUP_KICK`、`GROUP_BAN`、`GROUP_ALLOW`、`GROUP_BLOCK`、`GROUP_UNBLOCK`、`GROUP_ASSIGN_OWNER`、`GROUP_ADD_ADMIN`、`GROUP_REMOVE_ADMIN`、`GROUP_ADD_MUTE`、`GROUP_REMOVE_MUTE`、`GROUP_ADD_USER_WHITE_LIST`、`GROUP_REMOVE_USER_WHITE_LIST`、`GROUP_ALL_BAN`、`GROUP_REMOVE_ALL_BAN`、`GROUP_MEMBER_METADATA_CHANGED`、`GROUP_UPDATED` and `UNKNOWN`.
- **FR-006**: Group multi-device events MUST include operation, group ID, related user IDs, optional `deviceId`, and event timestamp when available.
- **FR-007**: SDK MUST define chat thread multi-device operations at least including `THREAD_CREATE`、`THREAD_JOIN`、`THREAD_UPDATE`、`THREAD_LEAVE`、`THREAD_DESTROY`、`THREAD_KICK` and `UNKNOWN`.
- **FR-008**: Chat thread multi-device events MUST include operation, thread ID, related user IDs, optional `deviceId`, and event timestamp when available.
- **FR-009**: SDK MUST define conversation multi-device operations at least including `CONVERSATION_DELETED`、`CONVERSATION_PINNED`、`CONVERSATION_UNPINNED`、`CONVERSATION_MARK`、`CONVERSATION_MUTE_INFO_CHANGED` and `UNKNOWN`.
- **FR-010**: Conversation multi-device events MUST include operation, conversation ID, conversation type, optional mark/remind/silent-mode detail, optional `deviceId`, and event timestamp when available.
- **FR-011**: SDK MUST expose roam-message-delete multi-device events including conversation ID, optional `deviceId`, optional deleted message ID list, optional delete-before timestamp, and conversation type when available; at least one of deleted message ID list or delete-before timestamp MUST be present for the event to be dispatched.
- **FR-012**: SDK MUST NOT list chatroom membership, admin, mute, allowlist, announcement or attribute operations as multi-device listener events unless a later protocol/documentation source explicitly adds them; existing chatroom business events remain unchanged.
- **FR-013**: SDK MUST filter out same-device echoes when the server payload contains a resource/device value equal to the current client resource.
- **FR-014**: SDK MUST preserve backward compatibility of existing business events. Existing events MUST NOT require `deviceId` to represent multi-device behavior after this feature lands.
- **FR-015**: SDK MUST keep existing business fields such as `operatorId`、`from`、`userIds`、`conversationId` and `groupId`; these fields are business actors/targets and MUST NOT be removed or reinterpreted as device identifiers.
- **FR-016**: If an existing event currently has a multi-device hint such as `source: 'multiDevice'`, SDK MAY keep it for compatibility, but the dedicated multi-device event MUST be the authoritative source for cross-device operation metadata.
- **FR-017**: Multi-device event payloads MUST include `deviceId` only when the server provides a source device/resource/clientResource value; absence of this field MUST be represented as `undefined` rather than current device or an empty fabricated value.
- **FR-018**: SDK MUST document every multi-device operation with its mapped mobile operation name, Web event category, required fields, optional fields and unsupported status if applicable.
- **FR-019**: SDK MUST provide TypeScript exported types for operation enums/unions and payloads so applications can exhaustively switch on operation.
- **FR-020**: SDK MUST ensure one failing multi-device handler does not prevent other registered handlers from receiving the same event, consistent with current EventHub behavior.
- **FR-021**: SDK MUST NOT make local cache convergence a prerequisite for dispatching MultiDevice events in this feature; contact, group, thread, conversation and message caches continue to follow their existing business-event or manager synchronization paths.

### Key Entities _(include if feature involves data)_

- **MultiDeviceEvent**: A standardized event envelope for operations performed by the current user from another device. Key attributes: category, operation, target ID, related user IDs, optional `deviceId`, optional timestamp, raw/extra data for diagnostics.
- **MultiDeviceOperation**: A stable string union or enum-like set that mirrors mobile operation names while using Web-friendly naming. Categories: contact, group, thread, conversation, roam message delete.
- **Device Source**: Optional source metadata normalized to `deviceId`. Upstream `resource` or `clientResource` values are exposed as `deviceId` when available.
- **Business Event**: Existing SDK event such as contact, group, message, conversation or chatroom event. It continues to represent business state changes and is not the canonical carrier of multi-device source metadata.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Developers can subscribe to all supported multi-device event categories from ChatClient using one documented listener surface.
- **SC-002**: 100% of supported mobile multi-device operation names are either mapped to a Web event operation or explicitly documented as unsupported/not applicable.
- **SC-003**: Existing event payload TypeScript compatibility is preserved; code compiled against current business event payloads continues to type-check without requiring device fields.
- **SC-004**: Protocol fixture tests cover at least one operation from each supported category: contact, group, thread, conversation and roam message delete.
- **SC-005**: Same-device echoed payloads with current client resource do not produce multi-device callbacks in tests.
- **SC-006**: Public API documentation clearly states that chatroom operation events are not multi-device listener events in this feature scope.

## Assumptions

- The feature should use a dedicated multi-device event surface on ChatClient rather than overloading manager-specific business events.
- Existing manager events remain useful for business state changes and should not be removed or structurally changed in this feature.
- When both a business event and a multi-device event are emitted for the same upstream operation, applications may listen to either depending on use case; the multi-device event is the only place guaranteed to carry cross-device metadata.
- The current Web SDK protocol may not expose source device/resource for every mobile operation. `deviceId` is optional until the upstream payload supports it.
- MultiDevice event delivery and local cache convergence are separate concerns in this feature. A later feature may define stronger cache synchronization requirements if product scope needs it.

## Reference Notes

- Android `EMMultiDeviceListener` documentation lists contact, group, thread, conversation and remote message removed callbacks, and states that chat room operations do not have multi-device events.
- Local mobile implementation references:
  - `/Users/zhangdong/code/emclient-linux/src/emcontactmanager.cpp`
  - `/Users/zhangdong/code/emclient-linux/src/emgroupmanager.cpp`
  - `/Users/zhangdong/code/emclient-linux/src/emthreadmanager.cpp`
  - `/Users/zhangdong/code/emclient-linux/src/emchatmanager.cpp`
  - `/Users/zhangdong/code/emclient-linux/src/emchatclientimpl.cpp`
