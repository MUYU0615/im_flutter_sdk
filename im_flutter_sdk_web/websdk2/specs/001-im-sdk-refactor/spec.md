# Feature Specification: IM SDK Web 重构

**Feature Branch**: `001-im-sdk-refactor`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "重构 IM SDK Web 版本，实现高性能、类型安全、可扩展的即时通讯 SDK，支持消息发送接收、离线同步、会话管理、群组功能等核心能力。同时进行架构优化，包括 REST API v3 升级、构建工具替换、API 形式统一、类型声明优化等 15 个重构项。"

> 说明：本 spec 作为总体目标与方向说明。具体功能将拆分为独立 spec 逐步实现，
> 未实现部分不会在本文档中“预置代码”，仅在对应 spec 中落地。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 连接建立与消息收发 (Priority: P1)

开发者需要能够建立与 IM 服务器的连接，并能够发送和接收文本消息。这是 IM SDK 最核心的功能，所有其他功能都依赖于此。

**Why this priority**: 连接和消息收发是 IM SDK 的基础能力，没有这个功能，SDK 无法提供任何价值。这是 MVP 的最小可行功能集。

**Independent Test**: 可以通过创建一个简单的测试应用来验证：初始化 SDK → 建立连接 → 发送一条消息 → 接收一条消息 → 断开连接。这个流程可以完全独立测试，不依赖其他功能。

**Acceptance Scenarios**:

1. **Given** SDK 已初始化并配置了服务器地址和认证信息, **When** 调用连接方法, **Then** SDK 成功建立 WebSocket 连接并在 2 秒内完成连接
2. **Given** SDK 已成功连接, **When** 调用发送消息方法并传入消息内容, **Then** 消息在 100ms 内发送成功并收到服务器确认
3. **Given** SDK 已成功连接, **When** 服务器推送一条消息, **Then** SDK 在 100ms 内接收到消息并通过回调通知应用层
4. **Given** SDK 处于连接状态, **When** 网络中断, **Then** SDK 检测到断线并在 5 秒内自动重连
5. **Given** SDK 处于连接状态, **When** 调用断开连接方法, **Then** SDK 优雅关闭连接并清理资源
6. **Given** SDK 处于建立链接状态, **When** 调用断开连接方法, **Then** SDK 成功取消建立链接
---

### User Story 2 - 离线消息同步 (Priority: P2)

开发者需要确保用户在网络恢复后能够自动获取离线期间错过的消息，保证消息的完整性和顺序。

**Why this priority**: 离线消息同步是 IM 应用的核心体验要求，用户期望看到所有历史消息，而不是只看到在线后的新消息。这直接影响用户体验。

**Independent Test**: 可以通过模拟场景测试：连接 SDK → 发送多条消息 → 断开连接 → 模拟服务器推送离线消息 → 重新连接 → 验证所有离线消息按顺序被接收。这个功能可以独立于群组、会话管理等功能进行测试。

**Acceptance Scenarios**:

1. **Given** 用户离线期间有 10 条未读消息, **When** 用户重新连接 SDK, **Then** SDK 自动同步所有 10 条消息并按时间顺序返回
2. **Given** 用户离线期间有消息, **When** 同步过程中收到新消息, **Then** SDK 先完成离线消息同步，再处理新消息，保证消息顺序
3. **Given** 离线消息数量超过 1000 条, **When** 用户重新连接, **Then** SDK 采用分页机制同步，避免一次性加载造成性能问题
4. **Given** 同步过程中网络再次中断, **When** 网络恢复, **Then** SDK 从中断点继续同步，不重复已同步的消息

---

### User Story 3 - 会话管理 (Priority: P3)

开发者需要能够管理会话列表，包括获取会话列表、更新会话信息、标记已读等操作。

**Why this priority**: 会话管理是 IM 应用的基础功能，用户需要通过会话列表查看所有对话，但相比消息收发，这个功能的优先级稍低，可以在 MVP 之后实现。

**Independent Test**: 可以通过测试场景验证：连接 SDK → 接收消息创建新会话 → 获取会话列表 → 更新会话信息（如未读数） → 标记会话已读。这个功能可以独立测试，只需要消息收发功能作为前置条件。

**Acceptance Scenarios**:

1. **Given** 用户有多个会话, **When** 调用获取会话列表方法, **Then** SDK 返回所有会话并按最后消息时间排序
2. **Given** 会话收到新消息, **When** 会话信息更新, **Then** SDK 自动更新会话的未读数和最后消息时间
3. **Given** 用户打开某个会话, **When** 调用标记已读方法, **Then** 该会话的未读数清零并在会话列表中更新
4. **Given** 会话被删除, **When** 获取会话列表, **Then** 该会话不再出现在列表中

---

### User Story 4 - 群组功能 (Priority: P4)

开发者需要支持群组聊天功能，包括加入群组、发送群组消息、接收群组消息、获取群组成员等。

**Why this priority**: 群组功能是 IM 应用的高级功能，虽然重要但不是 MVP 必需。可以在核心功能稳定后再实现。

**Independent Test**: 可以通过测试场景验证：连接 SDK → 加入群组 → 发送群组消息 → 接收群组消息 → 获取群组成员列表。这个功能可以独立测试，依赖消息收发功能。

**Acceptance Scenarios**:

1. **Given** 用户有群组 ID, **When** 调用加入群组方法, **Then** SDK 成功加入群组并开始接收群组消息
2. **Given** 用户已加入群组, **When** 发送群组消息, **Then** 消息成功发送并被所有群组成员接收
3. **Given** 群组中有新消息, **When** 消息推送, **Then** SDK 接收消息并标识为群组消息
4. **Given** 用户已加入群组, **When** 调用获取群组成员方法, **Then** SDK 返回群组所有成员列表

---

## 架构重构与优化

### User Story 6 - 统一使用方式与 API 形式 (Priority: P1)

开发者需要 SDK 只提供一种统一的使用方式，不再提供 Connection、miniCore 两个类，支持 tree shaking。

**Why this priority**: 🔴 高优先级。统一 API 形式可以简化使用，支持 tree shaking 可以减小打包体积。

**Independent Test**: 可以通过测试场景验证：使用新的统一 API → 验证功能正常 → 验证 tree shaking 生效（未使用的代码不被打包）。

**Acceptance Scenarios**:

1. **Given** 开发者使用 SDK, **When** 使用统一 API 形式, **Then** 所有功能通过单一入口访问
2. **Given** 开发者只引入部分功能, **When** 打包应用, **Then** 未使用的代码不被打包（tree shaking 生效）
3. **Given** 开发者使用新 API, **When** 调用方法, **Then** IDE 提供完整的自动提示和类型检查

---

### User Story 7 - 统一参数校验方法 (Priority: P1)

开发者需要 SDK 使用统一的参数校验方法，统一参数非法的错误处理。

**Why this priority**: 🔴 高优先级，现在能做。统一参数校验可以提高代码质量和错误处理一致性。

**Independent Test**: 可以通过测试场景验证：传入非法参数 → 验证错误信息统一 → 验证错误码一致。

**Acceptance Scenarios**:

1. **Given** 开发者调用 API 并传入非法参数, **When** SDK 校验参数, **Then** 返回统一的错误格式和错误码
2. **Given** 不同 API 的参数校验, **When** 参数非法, **Then** 错误处理方式一致
3. **Given** 参数校验失败, **When** SDK 抛出错误, **Then** 错误信息包含具体的参数问题和修复建议

---

### User Story 8 - REST 接口错误处理重构 (Priority: P1)

开发者需要 SDK 重新实现 REST 接口错误处理，每个 API 明确定义可能的错误码，统一使用 Promise。

**Why this priority**: 🔴 高优先级，现在能做。清晰的错误处理可以提高开发体验和问题排查效率。

**Independent Test**: 可以通过测试场景验证：触发各种错误场景 → 验证错误码明确 → 验证错误信息清晰。

**Acceptance Scenarios**:

1. **Given** API 调用失败, **When** SDK 处理错误, **Then** 返回明确的错误码和错误信息
2. **Given** 不同 API 的错误, **When** 查看错误码, **Then** 可以明确知道是哪个 API 的什么错误
3. **Given** SDK 处理错误, **When** 统一使用 Promise, **Then** 不再提供回调方式，代码更简洁

---

### User Story 9 - 构建工具替换 (Priority: P1)

开发者需要 SDK 使用 vite/rollup 替换 webpack，优化打包体积。

**Why this priority**: 🔴 高优先级。vite/rollup 可以提供更好的打包性能和更小的体积。

**Independent Test**: 可以通过测试场景验证：使用新构建工具打包 → 验证打包体积减小 → 验证功能正常。

**Acceptance Scenarios**:

1. **Given** 使用 vite/rollup 构建, **When** 打包 SDK, **Then** 打包体积相比 webpack 减小至少 20%
2. **Given** 构建配置, **When** 执行构建, **Then** 构建速度提升，开发体验改善
3. **Given** 构建产物, **When** 测试功能, **Then** 所有功能正常工作

---

### User Story 10 - API 形式方案确定与实现 (Priority: P1)

开发者需要 SDK 提供面向对象的 API 形式，参考竞品最佳实践，确定并实现统一的 API 设计。

**Why this priority**: 🔴 高优先级。API 形式直接影响开发体验，需要优先确定方案并实现。

**Independent Test**: 可以通过测试场景验证：使用新 API 形式 → 验证开发体验良好 → 验证功能完整。

**Acceptance Scenarios**:

1. **Given** 开发者使用 SDK, **When** 调用 API, **Then** API 形式统一，符合面向对象设计
2. **Given** IDE 环境, **When** 使用 SDK, **Then** 自动提示完整，类型检查通过
3. **Given** 不同功能模块, **When** 调用 API, **Then** API 设计一致，学习成本低

---

### User Story 11 - 小程序上传文件封装 (Priority: P1)

开发者需要 SDK 封装小程序发送附件消息的上传文件部分，简化小程序开发。

**Why this priority**: 🔴 高优先级，现在能做。封装上传功能可以简化小程序开发流程。

**Independent Test**: 可以通过测试场景验证：小程序选择文件 → SDK 自动上传 → 构造消息发送。

**Acceptance Scenarios**:

1. **Given** 小程序选择文件, **When** 调用发送附件方法, **Then** SDK 自动处理上传并构造消息
2. **Given** 用户上传到自己服务器, **When** 提供文件 URL, **Then** SDK 使用 URL 方式构造消息
3. **Given** 上传失败, **When** SDK 处理错误, **Then** 提供清晰的错误信息和重试机制

---

### User Story 12 - 类型声明文件优化 (Priority: P2)

开发者需要 SDK 类型声明文件不再使用 namespace，使用打包工具自动导出类型声明。

**Why this priority**: 🟡 中优先级。去掉 namespace 后不需要手动维护类型声明文件，减少维护成本。

**Independent Test**: 可以通过测试场景验证：使用 SDK → 验证类型定义完整 → 验证无需手动维护。

**Acceptance Scenarios**:

1. **Given** SDK 类型定义, **When** 使用打包工具, **Then** 自动生成类型声明文件
2. **Given** 开发者使用 SDK, **When** 导入类型, **Then** 类型定义完整，无需手动维护
3. **Given** 类型声明文件, **When** 检查内容, **Then** 不再使用 namespace，结构清晰

---

### User Story 13 - 新的消息构造方法 (Priority: P2)

开发者需要 SDK 提供新的构造消息方法，丢弃兼容代码，支持新增字段，统一发/收/历史消息格式。

**Why this priority**: 🟡 中优先级。新的消息构造方法可以统一消息格式，支持更多字段。

**Independent Test**: 可以通过测试场景验证：使用新方法构造消息 → 验证消息格式统一 → 验证新增字段支持。

**Acceptance Scenarios**:

1. **Given** 开发者构造消息, **When** 使用新方法, **Then** 消息格式统一，支持新增字段
2. **Given** 发送、接收、历史消息, **When** 查看格式, **Then** 消息格式一致
3. **Given** 新消息字段, **When** 构造消息, **Then** 支持优先级、在线送达等新字段

---

### User Story 14 - 会话列表 API 和事件重新设计 (Priority: P2)

开发者需要 SDK 重新设计会话列表 API 和事件，增加 channel update 事件。

**Why this priority**: 🟡 中优先级。重新设计可以优化 API 设计，增加必要的事件支持。

**Acceptance Scenarios**:

1. **Given** 会话列表更新, **When** SDK 触发事件, **Then** 触发 channel update 事件
2. **Given** 开发者监听事件, **When** 会话变化, **Then** 收到清晰的事件通知
3. **Given** 会话列表 API, **When** 调用方法, **Then** API 设计清晰，易于使用

---

### User Story 15 - 事件监听独立化 (Priority: P2)

开发者需要 SDK 将群组/聊天室事件改为独立事件，不再使用 operation 区分。

**Why this priority**: 🟡 中优先级。独立事件可以提高事件处理的清晰度和易用性。

**Acceptance Scenarios**:

1. **Given** 群组操作发生, **When** SDK 触发事件, **Then** 触发独立的群组事件（如 group:created, group:updated）
2. **Given** 聊天室操作发生, **When** SDK 触发事件, **Then** 触发独立的聊天室事件
3. **Given** 开发者监听事件, **When** 事件触发, **Then** 事件类型明确，无需解析 operation

---

### User Story 16 - 多版本构建支持 (Priority: P2)

开发者需要 SDK 支持同时 build 完整版和 lite 版，满足不同使用场景。

**Why this priority**: 🟡 中优先级。多版本构建可以提供更灵活的选择，但优先级低于核心功能。

**Acceptance Scenarios**:

1. **Given** 构建配置, **When** 执行构建, **Then** 同时生成完整版和 lite 版
2. **Given** 开发者选择版本, **When** 引入 SDK, **Then** 可以根据需求选择合适版本
3. **Given** lite 版本, **When** 使用功能, **Then** 核心功能正常，体积更小

---

### User Story 17 - 数据格式统一 (Priority: P2)

开发者需要 SDK 返回数据和移动端尽量统一，内部组合数据。

**Why this priority**: 🟡 中优先级。数据格式统一可以简化跨平台开发。

**Acceptance Scenarios**:

1. **Given** SDK 返回数据, **When** 查看格式, **Then** 与移动端格式尽量统一
2. **Given** 跨平台开发, **When** 处理数据, **Then** 数据格式一致，减少适配成本

---

### User Story 18 - Protobuf 统一 (Priority: P2)

开发者需要 SDK 小程序和 web 使用统一的 protobuf（lite 版本）。

**Why this priority**: 🟡 中优先级。统一 protobuf 可以简化维护，减少代码差异。

**Acceptance Scenarios**:

1. **Given** 小程序和 web SDK, **When** 使用 protobuf, **Then** 使用统一的 lite 版本
2. **Given** protobuf 消息, **When** 序列化/反序列化, **Then** 小程序和 web 行为一致

---

### User Story 19 - 本地会话列表决策 (Priority: P2)

开发者需要明确本地会话列表是否还需要，如果不需要则移除相关代码。

**Why this priority**: 🟡 中优先级。需要和产品确认，如果不需要可以简化代码。

**Acceptance Scenarios**:

1. **Given** 产品决策, **When** 确认不需要本地会话列表, **Then** SDK 移除相关代码
2. **Given** SDK 内部同步 channel, **When** 登录后, **Then** 自动触发 channel update 事件，无需本地缓存

---

### Edge Cases

- 网络频繁抖动时，SDK 如何处理连接状态和消息重发？
- 消息发送失败后，SDK 如何保证消息最终送达（至少一次送达）？
- 服务器推送的消息顺序与发送顺序不一致时，SDK 如何保证消息顺序？
- 离线消息同步过程中，如果消息数量过大（如 10 万条），SDK 如何处理性能问题？
- 多个标签页同时使用 SDK 时，如何避免重复连接和消息重复接收？
- 用户快速发送多条消息时，SDK 如何保证消息顺序和性能？
- 连接建立过程中用户关闭页面，SDK 如何优雅清理资源？
- 服务器返回错误码时，SDK 如何提供清晰的错误信息和恢复建议？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SDK MUST 支持建立与 IM 服务器的 WebSocket 连接，连接建立时间不超过 2 秒
- **FR-002**: SDK MUST 支持发送文本消息，消息发送延迟 P95 不超过 100ms
- **FR-003**: SDK MUST 支持接收服务器推送的消息，消息接收延迟 P95 不超过 100ms
- **FR-004**: SDK MUST 实现自动断线重连机制，网络恢复后重连时间不超过 5 秒
- **FR-005**: SDK MUST 支持消息发送失败自动重试，最多重试 3 次，采用指数退避策略
- **FR-006**: SDK MUST 支持离线消息自动同步，按时间顺序返回所有离线消息
- **FR-007**: SDK MUST 支持获取会话列表，会话按最后消息时间倒序排列
- **FR-008**: SDK MUST 支持更新会话信息（未读数、最后消息等）
- **FR-009**: SDK MUST 支持标记会话已读，更新会话未读数
- **FR-010**: SDK MUST 支持加入群组，加入后自动接收群组消息
- **FR-011**: SDK MUST 支持发送群组消息，消息被所有群组成员接收
- **FR-012**: SDK MUST 支持获取群组成员列表
- **FR-013**: SDK MUST 提供完整的 TypeScript 类型定义，所有公共 API 有类型支持
- **FR-014**: SDK MUST 提供结构化日志，支持日志级别控制（DEBUG、INFO、WARN、ERROR）
- **FR-015**: SDK MUST 支持自定义消息类型扩展，允许开发者扩展消息协议
- **FR-016**: SDK MUST 处理消息乱序问题，保证消息按时间顺序处理
- **FR-017**: SDK MUST 支持消息去重，避免重复消息被处理
- **FR-018**: SDK MUST 提供连接状态回调（连接中、已连接、断开、重连中）
- **FR-019**: SDK MUST 提供消息发送状态回调（发送中、已发送、发送失败）
- **FR-020**: SDK MUST 支持 TLS/SSL 加密连接，保证通信安全
- **FR-021**: SDK MUST 使用 REST API v3 接口，统一返回值格式
- **FR-022**: SDK MUST 提供统一的使用方式，只提供一种 API 形式，支持 tree shaking
- **FR-023**: SDK MUST 使用统一的参数校验方法，统一参数非法的错误处理
- **FR-024**: SDK MUST 重新实现 REST 接口错误处理，每个 API 明确定义错误码，统一使用 Promise
- **FR-025**: SDK MUST 使用 vite/rollup 替换 webpack，优化打包体积
- **FR-026**: SDK MUST 提供面向对象的 API 形式，参考竞品最佳实践
- **FR-027**: SDK MUST 封装小程序发送附件消息的上传文件部分
- **FR-028**: SDK MUST 类型声明文件不再使用 namespace，使用打包工具自动导出
- **FR-029**: SDK MUST 提供新的构造消息方法，统一发/收/历史消息格式，支持新增字段
- **FR-030**: SDK MUST 重新设计会话列表 API 和事件，增加 channel update 事件
- **FR-031**: SDK MUST 将群组/聊天室事件改为独立事件，不再使用 operation 区分
- **FR-032**: SDK MUST 支持同时 build 完整版和 lite 版
- **FR-033**: SDK MUST 返回数据和移动端尽量统一
- **FR-034**: SDK MUST 小程序和 web 使用统一的 protobuf（lite 版本）

### Key Entities *(include if feature involves data)*

- **Message（消息）**: 表示一条即时消息，包含消息 ID、发送者 ID、接收者 ID、消息类型、消息内容、时间戳、消息状态等属性。消息可以是单聊消息或群组消息。
- **Conversation（会话）**: 表示一个对话会话，包含会话 ID、会话类型（单聊/群组）、最后消息、未读数、最后消息时间等属性。会话与消息是一对多关系。
- **Connection（连接）**: 表示与服务器的连接状态，包含连接状态（未连接、连接中、已连接、断开、重连中）、服务器地址、认证信息等属性。
- **Group（群组）**: 表示一个群组，包含群组 ID、群组名称、群组成员列表、群组设置等属性。群组与消息是一对多关系。
- **User（用户）**: 表示一个用户，包含用户 ID、用户名称、头像等属性。用户可以是消息的发送者或接收者。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 开发者可以在 5 分钟内完成 SDK 初始化和首次连接建立
- **SC-002**: 消息发送成功率在正常网络条件下达到 99.9% 以上
- **SC-003**: 消息接收延迟 P95 不超过 100ms，P99 不超过 500ms
- **SC-004**: 离线消息同步成功率达到 100%，所有离线消息都能被正确同步
- **SC-005**: SDK 支持单实例至少 10,000 个并发连接
- **SC-006**: SDK 基础内存占用不超过 10MB，每 1000 条消息增加内存不超过 1MB
- **SC-007**: 网络中断后，SDK 在 5 秒内自动重连成功率达到 95% 以上
- **SC-008**: 开发者使用 TypeScript 开发时，类型检查覆盖率达到 100%，无 any 类型使用
- **SC-009**: 单元测试覆盖率至少达到 80%，核心功能（连接、消息收发）达到 95%
- **SC-010**: 90% 的开发者能够在 30 分钟内基于文档完成基础功能集成
- **SC-011**: 打包体积相比 webpack 版本减小至少 20%
- **SC-012**: Tree shaking 生效，未使用的代码不被打包
- **SC-013**: 所有 REST API 使用 v3 接口，返回值格式统一
- **SC-014**: API 形式统一，IDE 自动提示完整，类型检查通过率 100%
- **SC-015**: 参数校验错误信息统一，错误码明确，便于问题排查
- **SC-016**: 小程序上传文件功能封装完整，开发者无需手动处理上传逻辑
