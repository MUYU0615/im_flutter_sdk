# 功能规格：Channel 模块（统一会话/群组/联系人）

**Feature Branch**: `010-channel-module`  
**Created**: 2026-01-30  
**Status**: Draft  
**Input**: 用户需求：“Channel 模块用于代替原 SDK 的会话列表、群组列表、联系人列表，统一成 Channel；希望创建消息/发送消息也放在 Channel 上，提供 ChannelManager 负责创建与列表。”  
**Reference**:
- `specs/001-im-sdk-refactor/plan.md`
- `specs/009-manager-usage/spec.md`

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 统一 Channel 列表 (Priority: P1)

开发者通过 `ChannelManager` 获取 Channel 列表，列表可以统一表达会话、群组、联系人，并通过 `type` 区分不同场景。

**Why this priority**: 统一列表是 Channel 模块的核心价值，也是替换旧 SDK 列表的基础。

**Independent Test**: 仅实现列表拉取与统一模型即可形成 MVP。

**Acceptance Scenarios**:
1. **Given** 开发者调用 `ChannelManager.getChannels()`，**When** 返回列表，**Then** 每个条目都有 `channelId` 与 `type`。
2. **Given** 列表包含单聊/群组/聊天室，**When** 读取条目，**Then** 可通过 `type` 精确区分。
3. **Given** 列表为空，**When** 调用接口，**Then** 返回空数组且无异常。

---

### 用户故事 2 - channel 发送与创建消息 (Priority: P1)

开发者可以通过 channel 直接创建与发送消息，底层复用 ChatClient/消息发送能力。

**Why this priority**: channel 作为统一入口，提供便捷的消息操作是核心使用方式。

**Independent Test**: 仅实现 `channel.createMessage` 与 `channel.sendMessage` 的直通调用即可验证。

**Acceptance Scenarios**:
1. **Given** 一个 Channel 实例，**When** 调用 `channel.createTextMessage(params)`，**Then** 返回消息对象且 sender 自动填充。
2. **Given** 一个 Channel 实例，**When** 调用 `channel.sendMessage(message)`，**Then** 成功发送并返回服务端响应。
3. **Given** Channel 未绑定 Client，**When** 调用 `sendMessage`，**Then** 抛出明确的未绑定错误。

---

### 用户故事 3 - Channel 创建与管理 (Priority: P2)

开发者可以通过 `ChannelManager` 创建 Channel 并获取单个 Channel 实例。

**Why this priority**: 创建/获取是列表之外最常用的管理能力。

**Independent Test**: 仅实现创建与获取接口即可形成独立能力。

**Acceptance Scenarios**:
1. **Given** 开发者调用 `ChannelManager.createChannel(params)`，**When** 成功创建，**Then** 返回 Channel 实例。
2. **Given** 开发者调用 `ChannelManager.getChannel(channelId, type)`，**When** 存在，**Then** 返回 Channel 实例。
3. **Given** Channel 不存在，**When** 调用获取，**Then** 返回 null 或抛出明确错误（需在需求中明确）。

### Edge Cases

- 列表分页与游标（cursor）为空或越界。
- 不同类型的 Channel 同 id 但 type 不同。
- Channel 上发送消息时 client 未登录或未连接。
- Channel 被删除/退群后仍持有旧实例。

---

### 用户故事 4 - Channel 事件监听语法糖 (Priority: P2)

开发者希望通过 `ChannelManager` 监听消息等 Channel 事件，并确保事件类型仅限 Channel 相关事件。

**Why this priority**: 事件下沉到 Manager 后，必须提供一致的使用入口并保证类型正确。

**Independent Test**: `client.channelManager.addEventHandler` 可订阅 `onMessage` 且类型校验通过。

**Acceptance Scenarios**:
1. **Given** 注册 `client.channelManager.addEventHandler('channelEvent', { onMessage })`, **When** 收到消息, **Then** 回调被调用。
2. **Given** 在 `channelManager` 上注册非 Channel 事件, **When** 编译, **Then** TypeScript 报错。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SDK 必须提供 `ChannelManager`，包含获取列表、创建与查询 Channel 的能力。
- **FR-002**: Channel 列表必须统一输出 `channelId` 与 `type` 字段，`type` 仅允许 `'single' | 'group' | 'room'`。
- **FR-003**: Channel 必须支持 `createMessage` 与 `sendMessage` 语法糖，底层复用 ChatClient/消息发送逻辑。
- **FR-004**: Channel 必须绑定 ChatClient，上层必须通过 ChannelManager 或 ChatClient 注入创建；未绑定时调用需抛出明确错误。
- **FR-005**: ChannelManager 必须支持按 `channelId + type` 获取单个 Channel。
- **FR-006**: Channel 与 ChannelManager 的方法必须显式返回类型并遵循 strict 模式约束。
- **FR-007**: ChannelManager 必须提供 `addEventHandler/removeEventHandler` 语法糖，仅暴露 Channel 相关事件（如 `onMessage`）。
- **FR-008**: ChannelManager 事件监听必须具备类型限制，禁止注册非本 Manager 事件。

### 关键实体 *(include if feature involves data)*

- **Channel**: 统一的通道实体（含 `channelId`、`type` 等字段）。
- **ChannelManager**: Channel 的创建、查询、列表入口。
- **ChannelListResponse**: 列表响应结构（含分页信息）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Channel 列表 API 可覆盖会话/群组/联系人三类数据源。
- **SC-002**: Channel 级 `createMessage/sendMessage` 可在不直接调用 ChatClient 的情况下完成消息发送。
- **SC-003**: Channel 未绑定时能明确报错且错误信息一致。
- **SC-004**: `client.channelManager.addEventHandler` 仅允许注册 Channel 事件且类型校验通过。

## Out of Scope

- 具体服务端接口与协议细节。
- 频道级成员管理与权限细节（后续独立 spec 处理）。
