# 功能规格：统一事件系统（addEventHandler 模式）

**Feature Branch**: `004-event-system`  
**Created**: 2026-01-22  
**Status**: Draft  
**Input**: 用户需求："统一事件系统，使用 addEventHandler/removeEventHandler 一次注册/移除一组事件，并迁移现有代码。ChatClient 仅保留连接相关事件监听，其余事件下沉到 Manager，并提供语法糖与类型限制。"

## User Scenarios & Testing *(mandatory)*

### 用户故事 1 - 批量注册/移除事件 (Priority: P1)

开发者可以通过 `addEventHandler(id, handlers)` 一次性注册一组事件，并通过 `removeEventHandler(id)` 一次性移除，便于 React useEffect 管理。

**Why this priority**: 这是事件系统的核心需求，直接影响使用体验与可维护性。

**Independent Test**: 注册一组事件 → 触发事件 → 验证回调；移除同一 id → 再触发事件 → 回调不再被调用。

**Acceptance Scenarios**:

1. **Given** 开发者注册 `id=ui` 的事件组, **When** 事件触发, **Then** 该组内的对应回调被调用。
2. **Given** 再次使用相同 id 注册事件组, **When** 事件触发, **Then** 新的事件组替换旧的事件组。
3. **Given** 调用 `removeEventHandler(id)`, **When** 事件触发, **Then** 该 id 的事件组不再响应。
4. **Given** 移除不存在的 id, **When** 调用 `removeEventHandler`, **Then** 不抛错且无副作用。

---

### 用户故事 2 - 连接状态事件统一化 (Priority: P1)

开发者通过事件系统订阅连接状态变化，例如 `onConnecting`/`onConnected`/`onDisconnected`，统一获取连接生命周期变化。

**Why this priority**: 连接事件是 SDK 最关键的公共事件，必须率先迁移到统一事件系统。

**Independent Test**: 登录/登出触发 `onConnecting`/`onConnected`/`onDisconnected`；事件按顺序触发且回调正确。

**Acceptance Scenarios**:

1. **Given** 已注册 `onConnecting`/`onConnected`, **When** 登录成功, **Then** 依次触发 `onConnecting` -> `onConnected`。
2. **Given** 已注册 `onConnecting`/`onDisconnected`, **When** 登录失败, **Then** 依次触发 `onConnecting` -> `onDisconnected`。
3. **Given** 已注册 `onDisconnected`, **When** 登出完成, **Then** 触发 `onDisconnected`。

---

### 用户故事 3 - 内外事件统一迁移 (Priority: P2)

现有代码的事件触发与订阅方式全部迁移到统一事件系统，内部模块也改为 EventHub，避免混用 `on/off` 与 `addEventHandler`。

**Why this priority**: 统一事件模型可以减少维护成本，避免 API 形态分裂。

**Independent Test**: 现有事件均通过统一事件系统订阅，内部模块不再使用 EventEmitter，旧的 on/off 不再对外暴露。

**Acceptance Scenarios**:

1. **Given** 现有 `message`/`error` 事件, **When** 触发, **Then** 通过统一事件系统收到回调。
2. **Given** SDK 对外 API, **When** 查看事件相关方法, **Then** 仅保留 `addEventHandler/removeEventHandler` 形式。
3. **Given** 内部模块事件触发, **When** 检查实现, **Then** 仅使用 EventHub 进行 dispatch，不再依赖 EventEmitter。
4. **Given** 使用 `client.channelManager.addEventHandler` 注册事件, **When** 事件触发, **Then** 仅能订阅 Channel 相关事件且类型校验通过。

---

### 用户故事 4 - Manager 事件语法糖与类型限制 (Priority: P2)

开发者希望通过 Manager 的事件语法糖监听业务事件，同时 TypeScript 类型只允许注册本 Manager 的事件，避免误用。

**Why this priority**: 事件下沉到 Manager 后，必须通过类型约束保证正确性与可维护性。

**Independent Test**: `client.channelManager.addEventHandler` 可以订阅 `onMessage`，但订阅 `onConnected` 在编译期报错。

**Acceptance Scenarios**:

1. **Given** 使用 `client.channelManager.addEventHandler('channelEvent', { onMessage: fn })`, **When** 收到消息, **Then** `fn` 被调用。
2. **Given** 在 `channelManager` 上注册 `onConnected`, **When** 编译, **Then** TypeScript 报错提示事件不属于该 Manager。

---

### Out of Scope

- 新增消息类型或业务事件设计（仅迁移已有事件）
- 跨进程/跨标签页事件系统

### Edge Cases

- 事件回调抛错时，不影响其他事件回调。
- 同一个 handler object 内注册多个事件时，部分事件不存在的处理策略。
- 在回调内移除自身 handler 的行为。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SDK MUST 提供 `addEventHandler(id, handlers)` 与 `removeEventHandler(id)`。
- **FR-002**: `id` 必须唯一，重复注册同 id 必须覆盖旧事件组。
- **FR-003**: 事件系统 MUST 支持 `onX` 命名风格（如 `onConnecting`/`onConnected`/`onDisconnected`）。
- **FR-004**: ChatClient 对外仅暴露连接相关事件（`onConnecting`/`onConnected`/`onDisconnected`）。
- **FR-005**: 非连接类事件 MUST 通过对应 Manager 提供的 `addEventHandler/removeEventHandler` 进行监听。
- **FR-006**: Manager 事件监听 MUST 通过类型约束限制为本 Manager 可用事件，禁止跨 Manager 事件混用。
- **FR-007**: SDK 对外 MUST 不再暴露 `on/off` 专用方法（如 `onConnectionStateChange`）。
- **FR-008**: 事件回调抛错时 MUST 不影响其他回调执行。
- **FR-009**: SDK 内部事件触发 MUST 统一使用 EventHub，不再直接对外暴露或依赖 EventEmitter。

### Key Entities *(include if feature involves data)*

- **EventHub**: 统一事件枢纽，负责注册、移除与分发事件。
- **EventHandlerMap**: 事件名称到回调函数的映射对象。
- **EventHandlerId**: 事件组唯一标识，用于成组注册与移除。
- **ManagerEventMap**: Manager 内部的事件映射类型，用于限制可监听事件范围。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: React useEffect 场景下可用一个 id 完成事件注册与清理。
- **SC-002**: ChatClient 仅暴露连接事件，其他事件下沉到 Manager。
- **SC-003**: Manager 事件监听具有类型限制，跨 Manager 事件注册在编译期报错。
- **SC-004**: 连接状态事件在 100ms 内发出且顺序正确。
