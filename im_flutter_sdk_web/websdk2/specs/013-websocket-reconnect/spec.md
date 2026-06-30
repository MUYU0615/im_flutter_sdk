# Feature Specification: 实时连接重连逻辑

**Feature Branch**: `013-websocket-reconnect`  
**Created**: 2026-02-05  
**Status**: Revised  
**Input**:  
- 初始需求：实现 WebSocket 统一重连方法与触发时机（online/offline、前台心跳、登录阶段失败、发送超时），防并发，事件回调，参考旧工程 reconnect 实现。  
- 补充说明（2026-02-05）：仅登录成功后触发 online/前台/超时重连；登录失败由 `login()` 抛错；事件模型为 onConnecting/onConnected/onDisconnected/onReconnectFailed；重连策略使用指数退避并在成功后重置计数；离线时暂停重连，online 恢复继续。  
- 补充说明（2026-02-05）：登录重试受 autoReconnectNumMax 限制（0 仍需至少尝试一次，仅不做额外重试）；明确业务错误不重试；每次重试按 DNS 域名列表轮询切换（仅 https 域名，不使用 http/ip）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 网络切换后快速恢复连接 (Priority: P1)

作为 SDK 使用者，我希望当网络离线再恢复时，连接能被主动关闭并在网络恢复后快速重新建立，从而避免“表面已连接但实际不可用”的状态。

**Why this priority**: 网络切换是最常见的异常场景之一，直接影响消息收发与在线状态准确性。

**Independent Test**: 通过模拟离线→在线切换验证：离线时连接被关闭，在线后触发重连并给出状态事件。

**Acceptance Scenarios**:

1. **Given** 已登录且连接处于已连接状态，**When** 网络变为离线，**Then** 连接被主动关闭并进入离线/断开状态
2. **Given** 已登录且网络从离线恢复为在线，**When** 系统检测到在线状态，**Then** 触发重连并在成功/失败时发出状态事件

---

### User Story 2 - 前台恢复时保证连接健康 (Priority: P1)

作为 SDK 使用者，我希望当页面从后台回到前台时，系统会进行一次连接健康检查，如果健康检查失败就立即重连，确保前台可用。

**Why this priority**: 前台恢复是用户立刻需要可用连接的时刻，必须确保连接健康。

**Independent Test**: 模拟页面从后台回到前台，检查是否触发健康检测；健康检测失败时触发重连并发出事件。

**Acceptance Scenarios**:

1. **Given** 已登录且页面从后台切回前台，**When** 发起健康检查且检测成功，**Then** 保持连接且不触发重连
2. **Given** 已登录且页面从后台切回前台，**When** 健康检查失败或超时，**Then** 触发重连并发出 onConnecting 与结果事件

---

### User Story 3 - 登录阶段失败可自动恢复 (Priority: P2)

作为 SDK 使用者，我希望在登录阶段连接失败时，系统能自动重试重连直到达到最大次数，并通过事件通知 UI 以便展示状态。

**Why this priority**: 登录阶段失败会阻断核心流程，需要自动恢复并提供明确反馈。

**Independent Test**: 模拟登录阶段连接关闭或错误，验证系统持续重试直到达到最大次数，`login()` 直接抛出失败且不再继续重连。

**Acceptance Scenarios**:

1. **Given** 登录过程中连接出现错误或被关闭，**When** 系统检测到失败，**Then** 开始重试重连并发出 onConnecting 事件
2. **Given** 重试达到最大次数，**When** 仍无法连接成功，**Then** `login()` 抛出失败并停止所有自动重连
3. **Given** 登录过程中收到明确业务错误（如 token 失效/权限不足/设备超限等），**When** 系统识别为业务错误，**Then** 立即停止重试并让 `login()` 抛出失败

---

### User Story 4 - 发送超时自动恢复 (Priority: P3)

作为 SDK 使用者，我希望当消息发送超时后系统能主动重连，以降低长连接不可用导致的发送失败。

**Why this priority**: 发送超时是连接不可用的直接表现，快速重连可缩短故障影响。

**Independent Test**: 模拟发送超时触发重连，验证只会存在一个重连任务且有状态事件回调。

**Acceptance Scenarios**:

1. **Given** 已登录且发送请求超过超时阈值，**When** 系统判定为超时，**Then** 触发重连并发出 onConnecting 事件

---

### User Story 5 - 已登录场景达到最大重试后在线恢复 (Priority: P3)

作为 SDK 使用者，我希望在登录成功后的断网、发送超时等场景达到最大重连次数时，系统先停止自动重连，但在网络恢复且仍处于已登录状态时能自动继续重连，确保用户无需手动介入即可恢复连接。

**Why this priority**: 登录后连接稳定性直接影响业务可用性，网络恢复时自动重连是关键体验。

**Independent Test**: 模拟登录后断网导致重试达到上限，再触发 online 事件，验证系统重新开始重连并给出状态事件。

**Acceptance Scenarios**:

1. **Given** 登录成功后在断网/超时场景达到最大重试次数，**When** 触发 online 事件，**Then** 系统重新开始重连并发出 onConnecting 事件

---

### Edge Cases

- 网络频繁抖动（在线/离线快速切换）时，如何避免重复并发重连？
- 页面多次快速切前后台时，如何避免重复健康检查与重连？
- 登录阶段达到最大重连次数后，是否允许用户手动再次触发重连？
- 已登录场景达到最大重连次数后，等待 online 事件恢复重连时是否需要用户手动确认？
- 离线状态下是否需要暂停所有重连并等待 online？
- 当连接已恢复但旧的重连任务尚未结束时，如何避免状态覆盖？
- 如何区分正常关闭与异常关闭并决定是否触发重连？
- DNS 域名列表为空或仅包含 http/ip 时是否应终止连接并抛错？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须在检测到网络离线时主动关闭连接，并暂停所有重连直到网络恢复为在线
- **FR-002**: 系统必须仅在“已登录状态”下响应 online/前台/发送超时等触发点；未登录或登录失败时不得触发这些重连流程
- **FR-003**: 系统必须在网络恢复为在线且仍处于已登录状态时触发重连流程，避免保持“表面已连接但不可用”的状态
- **FR-004**: 系统必须在页面回到前台且处于已登录状态时执行一次连接健康检查；若健康检查失败或超时，必须触发重连
- **FR-005**: 健康检查必须采用心跳探测（ping/pong），在心跳超时内未收到 pong 或发送失败即判定失败；失败一次即触发重连（ping 使用 MSync UNREAD，收到任意有效 MSync 消息视为 pong）
- **FR-006**: 系统必须在登录阶段连接失败（包括连接错误或被关闭）时进行重连重试，直到达到最大重试次数
- **FR-007**: 登录阶段达到最大重试次数后，`login()` 必须抛出失败并停止所有自动重连；此阶段不得触发 onDisconnected/onReconnectFailed
- **FR-008**: 系统必须在消息发送超时且处于已登录状态时触发重连
- **FR-009**: 重连方法必须具备防并发能力：当已在重连中或已连接时，不得破坏现有连接或重复开启新连接
- **FR-010**: 重连策略必须采用指数退避并可配置（默认：初始 1s、倍数 2、最大 60s、最大重连次数 10）
- **FR-011**: 重连流程必须提供状态事件回调：onConnecting、onConnected、onDisconnected、onReconnectFailed
- **FR-012**: onDisconnected 仅在“曾经连接成功过”的断开场景触发；onReconnectFailed 仅在已登录状态下达到最大重试次数时触发
- **FR-013**: 事件回调必须包含可区分原因与上下文的载荷（reason/attempt/maxAttempts/isLoginPhase/isOnline/timestamp）
- **FR-014**: 当连接被服务器主动关闭、心跳失败或长时间无响应且处于已登录状态时，系统必须触发重连
- **FR-015**: 已登录场景达到最大重试次数后，系统必须停止自动重试并进入失败状态；在收到 online 事件且仍处于已登录状态时必须继续重连
- **FR-016**: 连接成功后必须清零重连计数与失败状态，确保后续重连可正常触发
- **FR-017**: 健康检查不得阻塞正常业务消息；当 WebSocket 不处于可用状态时应直接判定失败并触发重连
- **FR-018**: 事件名、状态名与原因名必须集中定义为常量或联合类型，禁止在业务逻辑中硬编码字符串
- **FR-019**: 登录阶段重试次数必须受 autoReconnectNumMax 限制；autoReconnectNumMax=0 时仍需执行 1 次连接尝试（仅不做额外重试）
- **FR-020**: 登录阶段若收到明确业务错误（见“业务错误判定”）必须立即终止重试并让 `login()` 抛出失败
- **FR-021**: 每次重试必须轮询 DNS 解析得到的 WebSocket 域名列表并按顺序循环切换；过滤规则：仅使用与页面协议一致的域名（https→wss），不使用 http 与 ip 地址

### 业务错误判定（Provision）

以下错误视为“明确业务错误”，必须终止重试并让 `login()` 抛出失败（错误映射参考旧工程 `receiveProvision` 行为）：

- **FAIL**：根据 reason 细分  
  - `Sorry, user register limit` → 达到上限  
  - `Sorry, user register rate limit` → 达到上限  
  - `Sorry, token expired` → token 过期  
  - `Sorry, token or password does not match login info` → token 无效  
  - `Sorry, user not found` → 用户不存在  
  - 其他 reason → 鉴权失败  
- **WRONG_PARAMETER** → 参数错误  
- **UNAUTHORIZED** → 鉴权失败  
- **IM_FORBIDDEN** → 服务被禁用/无权限  
- **PERMISSION_DENIED**：若 reason 为月活/日活/在线人数限制则视为达到上限；否则视为鉴权失败  
- **TOO_MANY_DEVICES** → 设备数超限  
- **RESOURCE_CHANGED** → 设备变更  
- **TOKEN_EXPIRED/BIND_ANOTHER_DEVICE/USER_MUTED/PLATFORM_LIMIT/PERMISSION_DENIED_EXTERNAL/ENCRYPT_* ** → 视为业务错误不重试

### 运行参数与默认值（可配置）

- 最大重连次数：10
- 重连退避：初始 1 秒、倍数 2、最大 60 秒
- WebSocket 连接超时：10 秒
- 消息发送超时（ACK）：15 秒
- 心跳间隔：30 秒
- 心跳超时：60 秒

> 以上均允许配置覆盖，成功指标以实际配置值为准。

### 连接状态与原因定义

- 对外连接状态：disconnected / connecting / connected / reconnecting / reconnectFailed
- 事件原因（reason）示例：login / reconnect / online / offline-recover / heartbeat-failed / send-timeout / close / error / timeout

### Key Entities *(include if feature involves data)*

- **连接会话**: 表示当前实时连接的生命周期与状态（disconnected/connecting/connected/reconnecting/reconnectFailed）
- **重连任务**: 描述一次重连的执行过程与状态锁，确保同一时间只有一个任务生效
- **重试策略**: 定义最大重试次数与重试节奏的规则
- **健康检查结果**: 记录前台恢复或心跳检测的成功/失败结论
- **连接状态事件**: 面向 UI 的连接状态变化通知（onConnecting/onConnected/onDisconnected/onReconnectFailed）

### Assumptions & Dependencies

- 假设已有可配置的“最大重试次数”“发送超时阈值”“心跳检测超时”配置项，若缺失需补齐
- 假设 UI/业务层已订阅连接状态事件，并能根据连接状态做提示或交互处理
- 假设系统能够识别当前是否处于登录阶段/登录成功状态，登录失败由 `login()` 抛错处理
- 假设心跳消息格式沿用现有心跳实现（ping 使用 MSync UNREAD；pong 通过任意有效 MSync 下行确认）
- 本规范仅覆盖实时连接的重连逻辑，不包含鉴权机制或协议层变更

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 网络从离线恢复到在线且处于已登录状态后，95% 情况下在“当前退避间隔 + 连接超时”内进入 onConnected 或 onReconnectFailed 并完成事件回调
- **SC-002**: 前台恢复触发的健康检查在“心跳超时”内给出成功/失败结果；失败时在“一个退避间隔”内开始重连
- **SC-003**: 已登录场景达到最大重试次数后，系统在 1 次事件回调内进入 onReconnectFailed 且不再自动重试
- **SC-004**: 任意时刻最多只有 1 个重连任务处于进行中（可通过状态事件与日志验证）
- **SC-005**: 消息发送超时场景下，100% 触发重连并发出 onConnecting 事件
- **SC-006**: 登录阶段达到最大重试次数时，`login()` 在 1 次失败回调内抛出错误且不触发 onReconnectFailed
- **SC-007**: 已登录场景达到最大重试次数后，网络恢复为在线时 100% 重新开始重连
- **SC-008**: 离线状态下不触发任何重连，直到收到 online 事件
- **SC-009**: 多次重试场景下，WebSocket 域名按 DNS 列表顺序循环切换（可通过日志或调试断言验证）
