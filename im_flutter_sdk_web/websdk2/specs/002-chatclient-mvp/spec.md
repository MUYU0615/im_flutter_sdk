# Feature Specification: ChatClient MVP（初始化/登录/登出/连接状态事件）

**Feature Branch**: `002-chatclient-mvp`  
**Created**: 2026-01-22  
**Status**: Draft  
**Input**: User description: "ChatClient MVP 只包含初始化、登录/登出和连接状态事件。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 初始化 ChatClient（Priority: P1）

开发者可以用必要配置初始化 ChatClient，得到一个可用但未连接的客户端。

**Why this priority**: 初始化是所有后续操作的入口，没有有效实例就无法登录或订阅事件。

**Independent Test**: 传入合法配置创建客户端，验证初始状态为 `disconnected`，且未发起网络连接。

**Acceptance Scenarios**:

1. **Given** 传入合法配置, **When** 调用 `ChatClient.init(config)`, **Then** 返回客户端实例，状态为 `disconnected`。
2. **Given** 配置缺失或非法, **When** 调用 `ChatClient.init(config)`, **Then** 以参数校验错误失败。
3. **Given** 客户端已初始化且配置一致, **When** 再次调用 `ChatClient.init(config)`, **Then** 返回同一实例且无副作用。
4. **Given** 客户端已初始化但配置不一致, **When** 再次调用 `ChatClient.init(config)`, **Then** 抛出配置冲突错误且不覆盖现有配置。

---

### User Story 2 - 登录与登出（Priority: P1）

开发者可以登录建立连接，登录时先请求 dnsconfig 获取可用连接信息，再使用返回地址建立连接；登出后清理并断开连接。dnsconfig 请求使用固定域名列表按顺序重试；使用 SDK 内置 DNS 基址时，请求需追加正式参数；使用完整自定义 DNS URL 时保持原样请求。

**Why this priority**: 登录/登出定义最小可用生命周期，是 MVP 的核心闭环。

**Independent Test**: 初始化客户端后执行 `login`，验证先请求 dnsconfig（按顺序尝试 DNS_CONFIG 列表），再使用返回域名建立连接并进入 `connected`；再执行 `logout`，验证状态变为 `disconnected`。

**Acceptance Scenarios**:

1. **Given** 客户端有效且凭证正确, **When** 调用 `login({userId, token})`, **Then** 先按顺序请求 DNS_CONFIG 列表的 `/easemob/server.json?app_key=...&_v=...`，使用返回连接地址建立连接并触发 `connecting` -> `connected`，且 Promise resolve；若 `serviceConfig.dnsConfigUrls` 已提供完整自定义 URL，则保持原样请求。
2. **Given** dnsconfig 返回主 websocket hosts, **When** 字段使用 `msync-wx` 或兼容别名（如 `msync-ws`、`msync`、`msync-web`、`websocket`、`im-ws`）, **Then** SDK 必须兼容解析这些字段并继续登录主链路。
3. **Given** 当前页面为 https, **When** dnsconfig 返回 hosts, **Then** 仅选择 `protocol=https` 的 hosts 并使用 `wss` 建立连接；若可用 host 缺少 `domain` 但存在 `ip`, 则允许回退使用 `ip` 建立连接。
4. **Given** dnsconfig 请求失败或返回无效连接信息, **When** 调用 `login`, **Then** 自动切换到下一个 DNS_CONFIG 域名重试，直到全部失败才返回错误，且状态回到 `disconnected`。
5. **Given** dnsconfig 已成功但后续 `core.connect()`、provision 或登录后初始化失败, **When** 调用 `login`, **Then** Promise reject，且 SDK 必须立即清理内部连接资源并回到 `disconnected`。
6. **Given** 客户端已连接, **When** 再次调用 `login`, **Then** 以清晰错误失败。
7. **Given** 客户端处于 `connecting`, **When** 调用 `logout()`, **Then** 取消连接尝试并进入 `disconnected`。
8. **Given** 客户端处于 `disconnected`, **When** 调用 `logout()`, **Then** 无副作用且 Promise resolve。

---

### User Story 3 - 连接状态事件（Priority: P1）

开发者可订阅连接状态变化事件，用于更新 UI 或业务流程。

**Why this priority**: 状态事件是业务侧感知连接生命周期的必要机制。

**Independent Test**: 订阅状态事件，执行登录/登出，验证事件按顺序发出。

**Acceptance Scenarios**:

1. **Given** 已订阅状态事件, **When** 调用 `login`, **Then** 依次收到 `connecting` -> `connected` 事件。
2. **Given** 已订阅状态事件, **When** `login` 失败, **Then** 依次收到 `connecting` -> `disconnected` 事件。
3. **Given** 已订阅状态事件, **When** 调用 `logout`, **Then** 收到 `disconnected` 事件。
4. **Given** 监听已取消订阅, **When** 状态变化, **Then** 监听不再收到事件。
5. **Given** 获取当前连接状态, **When** 调用 `getConnectionState`, **Then** 返回当前连接状态。

---

### Out of Scope

- 消息收发
- 离线同步
- 会话列表
- 群组能力
- 自动重连策略
- 构建工具迁移
- Protobuf 统一
- 小程序上传封装

### Edge Cases

- 未初始化直接调用 `login`。
- 已 `disconnected` 时调用 `logout`。
- `userId` 为空或 `token` 非法。
- 重复初始化但配置不一致。
- dnsconfig 请求超时或返回空域名。
- dnsconfig 主 websocket 字段不是旧版 `msync-wx`，而是兼容别名。
- dnsconfig 主 websocket host 只有 `ip` 没有 `domain`。
- DNS_CONFIG 列表为空或全部不可用。
- `serviceConfig.dnsConfigUrls` 缺失或格式非法。
- 登录链路在 DNS 成功后被服务端 `Provision rejected` 或其他连接错误拒绝。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SDK MUST 提供 `ChatClient.init(config)` 并校验必要配置，必须包含 `appKey`，并使用默认 DNS_CONFIG 列表或由 `serviceConfig.dnsConfigUrls` 覆盖。
- **FR-002**: SDK MUST 在同一运行时保持单实例（init 幂等）。
- **FR-003**: SDK MUST 提供 `login({userId, token})`，并在建立连接前请求 dnsconfig。
- **FR-004**: SDK MUST 提供 `logout()` 以清理并关闭当前或进行中的连接。
- **FR-005**: SDK MUST 暴露连接状态枚举，包含 `disconnected`、`connecting`、`connected`。
- **FR-006**: SDK MUST 触发连接状态变化事件，并支持取消订阅。
- **FR-007**: SDK MUST 对参数与连接错误提供清晰、可操作的错误信息。
- **FR-008**: SDK MUST 提供 `getConnectionState()` 获取当前连接状态。
- **FR-009**: SDK MUST 在未初始化时调用 `login` 返回明确错误信息。
- **FR-010**: SDK MUST 禁用自动重连；连接失败或 `logout` 后保持 `disconnected` 状态。
- **FR-011**: SDK MUST 对 dnsconfig 响应做校验，并兼容解析登录主 websocket 字段的历史/新版别名（至少包含 `msync-wx`、`msync-ws`、`msync`、`msync-web`、`websocket`、`im-ws`）。
- **FR-012**: SDK MUST 使用 DNS_CONFIG 列表按顺序重试 dnsconfig 请求，直到成功或耗尽。
- **FR-013**: SDK MUST 根据当前页面协议（http/https）筛选 dnsconfig hosts，并匹配 `ws/wss`；主 websocket host 选择需优先使用 `domain`，缺失时允许回退到 `ip`。
- **FR-014**: SDK MUST 在使用内置 DNS_CONFIG 基址时，请求 `${baseUrl}/easemob/server.json` 并追加 `app_key` 与 `_v` 查询参数；当 `serviceConfig.dnsConfigUrls` 提供完整自定义 URL 时，必须保持原样请求。
- **FR-015**: SDK MUST 在 DNS 成功后若连接建立、provision 或登录后初始化任一阶段失败时，立即清理残留资源并恢复为 `disconnected`。

### API 约定（MVP）

- `ChatClient.init(config: InitConfig): ChatClient`
- `login(params: AuthContext): Promise<void>`
- `logout(): Promise<void>`
- `getConnectionState(): ConnectionState`
- `onConnectionStateChange(handler: (state: ConnectionState) => void): () => void`

### 默认 DNS_CONFIG 列表

- `https://rs.easemob.com`
- `https://rs.chat.agora.io`
- `http://59.110.89.59`
- `http://39.97.193.190`
- `http://39.97.193.187`

### Key Entities *(include if feature involves data)*

- **ChatClient**: SDK 入口，负责配置、状态与连接生命周期。
- **ConnectionState**: 连接生命周期状态枚举（`disconnected`, `connecting`, `connected`）。
- **AuthContext**: 登录鉴权上下文（用户标识与 token）。
- **InitConfig**: 初始化 SDK 所需配置参数（至少包含 `appKey`，可用 `serviceConfig.dnsConfigUrls` 覆盖 DNS_CONFIG 列表）。
- **DnsConfig**: 登录前获取的连接信息（域名、协议或其他连接参数）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 开发者可在 `init` -> `login` 后观察到 `connected` 状态事件。
- **SC-002**: 连接状态事件在状态切换后 100ms 内发出。
- **SC-003**: 初始化或登录参数错误时，错误信息能指明具体字段。
- **SC-004**: `logout` 后客户端处于干净的 `disconnected` 状态且无活动连接。
- **SC-005**: 重复初始化且配置不一致时，返回明确的配置冲突错误。
