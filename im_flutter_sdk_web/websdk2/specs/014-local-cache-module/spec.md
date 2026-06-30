# Feature Specification: 本地缓存模块

**Feature Branch**: `[014-local-cache-module]`  
**Created**: 2026-02-11  
**Status**: Draft  
**Input**: User description: "按照设计文档设计本地缓存模块，不计算 size，不限制 80% 容量；会话仅缓存 lastMessage，不缓存会话消息列表；用户信息默认上限 1000 条。写入超限时按 TTL + LRU 清理并重试一次，优先保留会话。参考 /websdk2/docs/architecture/cache-module-design.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 首屏快速展示会话摘要 (Priority: P1)

作为应用用户，我希望在登录或启动后能立即看到最近会话与最后一条消息，即使网络慢也能先展示缓存内容。

**Why this priority**: 首屏体验是 IM 使用的核心感知，直接影响留存与可用性。

**Independent Test**: 在网络慢或离线情况下启动应用，依然可以看到缓存会话摘要与未读数，并在同步完成后自动更新。

**Acceptance Scenarios**:

1. **Given** 本地存在会话缓存，**When** 应用初始化并读取缓存，**Then** 会话摘要与最后一条消息可立即用于渲染 UI。
2. **Given** 服务端同步完成，**When** 缓存与服务端数据存在差异，**Then** 服务端结果覆盖本地缓存并触发更新。
3. **Given** 登录成功，**When** 从 localStorage 读取会话缓存，**Then** 必须触发一次 `onConversationUpdate` 回调输出缓存结果。
4. **Given** 登录成功，**When** 通过服务端拉取会话列表（递归获取全部会话），**Then** 若与本地缓存不同需再次触发 `onConversationUpdate` 并更新本地缓存。

---

### User Story 2 - 业务模块可读写缓存 (Priority: P2)

作为业务模块（收消息/用户信息模块），我希望通过缓存模块统一读写用户信息与会话摘要，从而减少重复请求并保持一致性。

**Why this priority**: 统一缓存入口能降低耦合，提升数据一致性与可复用性。

**Independent Test**: 通过缓存模块写入一批用户信息与会话摘要，然后读取并验证结果一致。

**Acceptance Scenarios**:

1. **Given** 收到一批用户信息，**When** 批量写入缓存，**Then** 可通过批量读取返回相同结果。
2. **Given** 用户调用 `fetchUserInfoById` 或 `updateOwnUserInfo`，**When** 服务端返回用户信息，**Then** 必须写入本地缓存。
3. **Given** 登录成功，**When** 从本地缓存加载用户信息到内存，**Then** 不影响后续缓存更新（具体使用场景后续补充）。

---

### User Story 3 - 淘汰与过期可控 (Priority: P3)

作为系统，我希望缓存具有明确的数量上限与过期机制，并在超限时自动清理，确保长期运行稳定且不会撑爆存储空间。

**Why this priority**: 本地存储容量有限，必须通过淘汰与过期保证稳定性。

**Independent Test**: 通过持续写入触发超限错误，检查是否自动淘汰并优先保留会话缓存，同时验证 LRU 行为不被全量加载刷新。

**Acceptance Scenarios**:

1. **Given** 写入触发超限错误，**When** 继续写入数据，**Then** 系统先按 TTL 清理，再按 LRU 淘汰，并优先保留会话摘要与消息，且仅重试一次写入。
2. **Given** 缓存数据超过 TTL，**When** 读取缓存，**Then** 过期数据不会被返回且会被丢弃。
3. **Given** 登录后进行全量缓存加载，**When** 未实际展示或使用缓存项，**Then** 不应更新其 lastAccess，避免 LRU 失效。

---

### Edge Cases

- 当写入触发 `QuotaExceededError` 且清理后仍失败时，是否直接放弃写入？
- 当缓存数据损坏或无法解析时，是否安全回退到空缓存？
- 多用户切换时是否隔离缓存数据？
- 用户信息缓存达到 1000 条上限时，淘汰策略是否按 LRU + TTL？
- 会话缓存与用户信息缓存都超限时，优先清理用户信息是否足够？
- 全量加载缓存时是否禁止批量刷新 lastAccess，避免 LRU 失效？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须提供统一的缓存读写接口，支持会话摘要与用户信息的读取与写入。
- **FR-002**: 系统必须支持批量写入与批量读取，以减少频繁写入带来的 UI 卡顿风险。
- **FR-003**: 系统不得计算缓存 `size`，仅在写入触发 `QuotaExceededError` 时进行清理与重试。
- **FR-004**: 系统必须在写入超限时先按 TTL 清理，再按 LRU 清理，并仅重试一次写入。
- **FR-005**: 系统必须仅缓存会话摘要中的 `lastMessage`，不得缓存会话消息列表。
- **FR-006**: 系统必须限制用户信息缓存默认最多 1000 条，超过上限时按 TTL + LRU 淘汰。
- **FR-007**: 系统必须在超限清理时优先保证会话缓存可用，用户信息缓存应优先被淘汰。
- **FR-008**: 系统必须支持过期机制，超过 TTL 的缓存不可返回且应被丢弃。
- **FR-009**: 系统必须支持同步更新机制，当服务端数据更新时本地缓存应可被更新并对外可见。
- **FR-010**: 系统必须确保缓存读写不会造成可感知的 UI 停顿，必要时采用延迟或批量更新机制。
- **FR-011**: 系统必须按用户维度隔离缓存并支持 schemaVersion 以便升级清理。
- **FR-012**: 系统必须在缓存读写失败时安全降级，不影响核心业务流程。
- **FR-013**: 系统必须使用 `lastAccess` 参与 LRU 淘汰排序，并使用 `lastUpdate` 参与 TTL 过期判断。
- **FR-014**: 系统不得在“全量加载缓存”时批量更新 `lastAccess`；仅在业务实际使用（渲染/读取命中）时更新，并在内存标记后批量落盘。
- **FR-015**: 系统必须在登录成功后读取本地会话缓存并触发一次 `onConversationUpdate` 回调。
- **FR-016**: 系统必须在登录成功后通过服务端拉取会话列表（支持递归获取全部会话），当结果与本地缓存不一致时触发 `onConversationUpdate` 并更新本地缓存。
- **FR-017**: 系统必须在 `fetchUserInfoById` 与 `updateOwnUserInfo` 成功返回后写入用户信息缓存，并在登录成功时加载用户信息到内存。
- **FR-018**: 系统必须在支持 Web Crypto 时使用 `SHA-256(appKey:userId)` 派生密钥并用 `AES-GCM` 加密 localStorage 内容；若不支持 Web Crypto（含小程序环境）则回退为明文存储。加密开关由 `cacheEncryptionMode` 控制，默认 `auto`。

### Key Entities *(include if feature involves data)*

- **ConversationSummary**: 会话摘要信息，包含会话标识、最后一条消息摘要、未读数等。
- **UserInfoSummary**: 用户信息摘要，包含用户标识、昵称、头像、更新时间与访问时间等展示字段。
- **CacheMetadata**: 缓存元信息，包括 schemaVersion、上次 flush 时间等。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在存在缓存时，用户在初始化后 1 秒内可看到会话摘要与最后消息（不依赖网络响应）。
- **SC-002**: 写入触发 `QuotaExceededError` 时，系统执行 TTL + LRU 清理并重试一次；若仍失败则放弃写入且不影响主流程。
- **SC-003**: 会话缓存仅包含 `lastMessage` 摘要，不存在会话消息列表缓存。
- **SC-004**: 超过 TTL 的缓存数据不会被返回，且在下一次访问时被清理。
- **SC-005**: 当写入触发超限时，系统先按 TTL 清理，再按 LRU 清理，且用户信息优先被淘汰。
- **SC-006**: 多用户切换后，缓存读取只返回当前用户的数据，历史用户数据不会泄露。
- **SC-007**: 全量加载缓存不会刷新所有记录的 `lastAccess`，LRU 淘汰仍能反映真实使用顺序。
