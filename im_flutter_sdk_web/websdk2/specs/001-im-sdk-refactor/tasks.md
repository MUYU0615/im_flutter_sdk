# Tasks: IM SDK Web 重构

**Input**: Design documents from `/specs/001-im-sdk-refactor/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 遵循 TDD 流程，所有功能都需要先写测试，确保测试失败后再实现。

**Organization**: 任务按用户故事组织，每个用户故事可以独立实现和测试。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可以并行执行（不同文件，无依赖）
- **[Story]**: 任务所属的用户故事（US1, US2, US3, US6-US19）
- 所有任务必须包含确切的文件路径

## Path Conventions

- **Single project**: `src/`, `tests/` 在仓库根目录
- 路径基于 plan.md 中定义的项目结构

## Phase 1: Setup (共享基础设施)

**目的**: 项目初始化和基础结构

- [X] T001 在仓库根目录按照实现方案创建项目结构（src/core, src/managers, src/rest, src/validators 等）
- [X] T002 初始化 TypeScript 项目，创建 package.json 和 tsconfig.json（启用 strict 模式，declaration: true）
- [X] T003 [P] 在 tests/ 目录配置 Vitest 测试框架
- [X] T004 [P] 配置 ESLint 和 Prettier 用于代码质量检查
- [X] T005 [P] 创建 .gitignore 文件，包含 Node.js 和 TypeScript 模式
- [X] T006 [P] 配置 Vite/Rollup 构建工具用于库打包（支持 tree shaking，sideEffects: false）

---

## Phase 2: Foundational (阻塞前置条件)

**目的**: 核心基础设施，必须在任何用户故事实现之前完成

**⚠️ 关键**: 所有用户故事工作必须在此阶段完成后才能开始

- [X] T007 在 src/types/index.ts 创建基础 TypeScript 类型（MessageType、MessageStatus、ConnectionStatus 联合类型，不使用 enum）
- [X] T008 [P] 在 src/types/index.ts 创建 Channel 类型系统（ChannelType、ChannelReference、ChannelBase、SingleChannel、GroupChannel、RoomChannel、Channel 联合类型）
- [X] T009 [P] 在 src/types/index.ts 创建 MessageBody 类型系统（TextMessageBody、ImageMessageBody、MessageBody 联合类型）
- [X] T010 [P] 在 src/types/index.ts 创建类型守卫函数（isSingleChannel、isGroupChannel、isRoomChannel）
- [X] T011 [P] 在 src/core/events/event-emitter.ts 实现 EventEmitter 基类
- [X] T012 [P] 在 src/utils/logger.ts 实现日志工具，支持日志级别（DEBUG、INFO、WARN、ERROR）
- [X] T013 [P] 在 src/utils/retry.ts 实现重试工具，支持指数退避策略
- [X] T014 [P] 在 src/validators/validator.ts 实现统一参数校验器（基于 zod）
- [X] T015 在 src/core/storage/indexeddb-storage.ts 创建 IndexedDB 存储封装（数据库初始化、版本管理）
- [X] T016 在 src/utils/errors.ts 实现错误处理类（SDKError、ErrorCode 枚举）
- [X] T017 [P] 在 src/protocol/protobuf/messages.proto 设置 protobuf 消息定义（使用 protobufjs-lite）
- [X] T018 [P] 使用 protobufjs-lite 在 src/protocol/protobuf/types.ts 从 protobuf 生成 TypeScript 类型
- [X] T019 [P] 在 src/rest/client.ts 创建 REST 客户端基础类（统一 Promise 返回，不使用回调）
- [X] T020 [P] 在 src/rest/errors.ts 实现 API 级别错误定义（API_ERRORS 常量，每个 API 明确定义错误码）

**Checkpoint**: 基础设施就绪 - 用户故事实现现在可以并行开始

---

## Phase 3: User Story 1 - 连接建立与消息收发 (Priority: P1) 🎯 MVP

**Goal**: 实现 SDK 与服务器的 WebSocket 连接，支持消息发送和接收功能。使用 ChannelReference 统一标识消息所属 Channel。

**Independent Test**: 创建一个测试应用：初始化 SDK → 建立连接 → 发送一条消息（使用 ChannelReference） → 接收一条消息 → 断开连接。这个流程可以完全独立测试。

**参考代码**: 见 `reference-code.md`
- 连接管理：参考 `engineCore/connection.ts` 的连接建立流程和心跳机制
- 消息编解码：参考 `engineCore/mSync.ts` 的 protobuf 序列化和 LZ4 压缩
- 协议定义：参考 `proto.ts` 的消息体结构
- 消息回调：参考 `handleMessages/handleChatMsg.ts` 的消息类型分发逻辑

### Tests for User Story 1 ⚠️

> **注意: 先写这些测试，确保它们在实现前失败**

- [X] T021 [P] [US1] 在 tests/unit/core/connection/connection-manager.test.ts 编写连接管理器的单元测试（连接、断开、重连场景）
- [X] T022 [P] [US1] 在 tests/unit/core/message/message-sender.test.ts 编写消息发送器的单元测试（发送消息、失败重试）
- [X] T023 [P] [US1] 在 tests/unit/core/message/message-receiver.test.ts 编写消息接收器的单元测试（接收消息、错误处理）
- [X] T024 [P] [US1] 在 tests/integration/connection-message.test.ts 编写连接和消息流程的集成测试（完整用户旅程，使用 ChannelReference）

### Implementation for User Story 1

- [X] T025 [P] [US1] 在 src/types/index.ts 创建 Connection 模型类型（ConnectionStatus 联合类型、Connection 接口）
- [X] T026 [P] [US1] 在 src/types/index.ts 创建 Message 模型类型（Message 接口，包含 msgServerId、msgLocalId、channel: ChannelReference、body: MessageBody）
- [X] T027 [P] [US1] 在 src/types/index.ts 创建 Sender 接口（userId、nickname、avatarUrl）
- [X] T028 [US1] 在 src/core/connection/connection-manager.ts 实现连接管理器（WebSocket 连接、状态管理、事件处理）
- [X] T029 [US1] 在 src/core/connection/connection-retry.ts 实现连接重试逻辑（指数退避、最大 60 秒间隔）
- [X] T030 [US1] 在 src/core/connection/heartbeat.ts 实现心跳机制（ping/pong、超时处理）
- [X] T031 [US1] 在 src/core/message/message-sender.ts 实现消息发送器（接收 Message 对象，发送消息、等待 ACK、错误处理）
- [X] T032 [US1] 在 src/core/message/message-receiver.ts 实现消息接收器（接收消息、解析 protobuf、构造 Message 对象（包含 ChannelReference）、触发事件）
- [X] T033 [US1] 在 src/core/message/message-retry.ts 实现消息重试逻辑（存储失败消息、重连后重试、最多 3 次尝试）
- [X] T034 [US1] 在 src/core/message/message-queue.ts 实现消息队列用于排序（按时间戳排序、处理重复）
- [X] T035 [US1] 在 src/protocol/protobuf/encoder.ts 实现 protobuf 消息编码器（将 Message 对象编码为二进制，包含 ChannelReference）
- [X] T036 [US1] 在 src/protocol/protobuf/decoder.ts 实现 protobuf 消息解码器（将二进制解码为 Message 对象，包含 ChannelReference）
- [X] T037 [US1] 在 src/core/index.ts 集成连接和消息组件
- [X] T038 [US1] 在 src/core/connection/connection-manager.ts 添加连接状态回调（onConnected、onDisconnected、onReconnecting）
- [X] T039 [US1] 在 src/core/message/message-sender.ts 添加消息状态回调（onSending、onSent、onFailed）
- [X] T040 [US1] 为所有连接和消息操作添加错误处理和日志记录

**Checkpoint**: 此时，User Story 1 应该完全功能正常并可以独立测试

---

## Phase 4: User Story 6 - 统一使用方式与 API 形式 (Priority: P1)

**Goal**: SDK 只提供一种统一的使用方式，采用管理器模式（面向对象），支持 tree shaking

**Independent Test**: 使用新的统一 API → 验证功能正常 → 验证 tree shaking 生效（未使用的代码不被打包）

### Tests for User Story 6 ⚠️

- [ ] T041 [P] [US6] 在 tests/unit/managers/message-manager.test.ts 编写消息管理器的单元测试
- [ ] T042 [P] [US6] 在 tests/integration/api-form.test.ts 编写 API 形式的集成测试（验证统一 API 形式）

### Implementation for User Story 6

- [ ] T043 [US6] 在 src/managers/MessageManager.ts 实现消息管理器（sendMessage(message: Message) 方法）
- [ ] T044 [US6] 在 src/managers/ChannelManager.ts 实现 Channel 管理器（getChannels、getChannel、markChannelRead、deleteChannel 等方法）
- [ ] T045 [US6] 在 src/index.ts 实现 IMClient 主类，聚合所有管理器（client.message、client.channel 等）
- [ ] T046 [US6] 在 vite.config.ts 配置 tree shaking（sideEffects: false，ES modules 导出）
- [ ] T047 [US6] 验证 tree shaking 生效（构建测试，验证未使用的管理器不被打包）

**Checkpoint**: 此时，统一 API 形式应该可用，tree shaking 生效

---

## Phase 5: User Story 7 - 统一参数校验方法 (Priority: P1)

**Goal**: SDK 使用统一的参数校验方法，统一参数非法的错误处理

**Independent Test**: 传入非法参数 → 验证错误信息统一 → 验证错误码一致

### Tests for User Story 7 ⚠️

- [ ] T048 [P] [US7] 在 tests/unit/validators/validator.test.ts 编写参数校验器的单元测试
- [ ] T049 [P] [US7] 在 tests/integration/validation.test.ts 编写参数校验的集成测试（验证统一错误处理）

### Implementation for User Story 7

- [ ] T050 [US7] 在 src/validators/schemas/message-schemas.ts 创建消息相关的 zod schema（MessageSchema，包含 ChannelReference、MessageBody 校验）
- [ ] T051 [US7] 在 src/validators/schemas/channel-schemas.ts 创建 Channel 相关的 zod schema（ChannelReferenceSchema、SingleChannelSchema、GroupChannelSchema、RoomChannelSchema）
- [ ] T052 [US7] 在 src/validators/validator.ts 实现统一参数校验器（validate 方法，统一抛出 ValidationError）
- [ ] T053 [US7] 在所有管理器方法中集成参数校验（MessageManager.sendMessage、ChannelManager.getChannel 等）
- [ ] T054 [US7] 验证错误信息包含具体的参数问题和修复建议

**Checkpoint**: 此时，所有 API 都应该有统一的参数校验和错误处理

---

## Phase 6: User Story 8 - REST 接口错误处理重构 (Priority: P1)

**Goal**: 重新实现 REST 接口错误处理，每个 API 明确定义可能的错误码，统一使用 Promise

**Independent Test**: 触发各种错误场景 → 验证错误码明确 → 验证错误信息清晰

### Tests for User Story 8 ⚠️

- [ ] T055 [P] [US8] 在 tests/unit/rest/errors.test.ts 编写错误定义的单元测试
- [ ] T056 [P] [US8] 在 tests/integration/rest-errors.test.ts 编写 REST 错误处理的集成测试

### Implementation for User Story 8

- [ ] T057 [US8] 在 src/rest/errors.ts 完善 API 级别错误定义（getChannel、sendMessage、joinChannel 等所有 API 的错误码）
- [ ] T058 [US8] 在 src/rest/v3/channel-api.ts 实现 Channel 相关 REST API v3 接口（统一 Promise 返回，使用错误定义）
- [ ] T059 [US8] 在 src/rest/v3/message-api.ts 实现消息相关 REST API v3 接口
- [ ] T060 [US8] 在 src/rest/client.ts 统一错误处理逻辑（根据错误码映射到 API_ERRORS）
- [ ] T061 [US8] 移除所有回调方式的 API，统一使用 Promise

**Checkpoint**: 此时，所有 REST API 都应该有明确的错误码定义和统一的错误处理

---

## Phase 7: User Story 9 - 构建工具替换 (Priority: P1)

**Goal**: 使用 vite/rollup 替换 webpack，优化打包体积

**Independent Test**: 使用新构建工具打包 → 验证打包体积减小至少 20% → 验证功能正常

### Tests for User Story 9 ⚠️

- [ ] T062 [P] [US9] 在 tests/build/build-size.test.ts 编写构建体积的测试（验证体积减小）

### Implementation for User Story 9

- [ ] T063 [US9] 创建 vite.config.ts 配置文件（支持 tree shaking、代码分割、压缩）
- [ ] T064 [US9] 创建 rollup.config.ts 配置文件（备选方案）
- [ ] T065 [US9] 配置 TypeScript 编译选项（自动生成类型声明文件，不使用 namespace）
- [ ] T066 [US9] 配置构建脚本（package.json scripts，支持完整版和 lite 版构建）
- [ ] T067 [US9] 验证打包体积相比 webpack 版本减小至少 20%
- [ ] T068 [US9] 验证构建速度提升，开发体验改善

**Checkpoint**: 此时，构建工具应该替换完成，打包体积优化

---

## Phase 8: User Story 10 - API 形式方案确定与实现 (Priority: P1)

**Goal**: 提供面向对象的 API 形式，参考竞品最佳实践，确定并实现统一的 API 设计

**Independent Test**: 使用新 API 形式 → 验证开发体验良好 → 验证功能完整

### Tests for User Story 10 ⚠️

- [ ] T069 [P] [US10] 在 tests/integration/api-design.test.ts 编写 API 设计的集成测试（验证面向对象设计）

### Implementation for User Story 10

- [ ] T070 [US10] 完善 IMClient 主类设计（参考 Sendbird、腾讯云 IM 等竞品）
- [ ] T071 [US10] 完善各管理器接口设计（MessageManager、ChannelManager）
- [ ] T072 [US10] 实现管理器内部持有 client 引用（无需传递 client）
- [ ] T073 [US10] 统一错误处理和事件监听（所有管理器使用统一的错误处理和事件系统）
- [ ] T074 [US10] 验证 IDE 自动提示完整，类型检查通过率 100%

**Checkpoint**: 此时，API 形式应该统一，开发体验良好

---

## Phase 9: User Story 11 - 小程序上传文件封装 (Priority: P1)

**Goal**: 封装小程序发送附件消息的上传文件部分，简化小程序开发

**Independent Test**: 小程序选择文件 → SDK 自动上传 → 构造消息发送

### Tests for User Story 11 ⚠️

- [ ] T075 [P] [US11] 在 tests/unit/utils/upload.test.ts 编写上传工具的单元测试
- [ ] T076 [P] [US11] 在 tests/integration/miniprogram-upload.test.ts 编写小程序上传的集成测试

### Implementation for User Story 11

- [ ] T077 [US11] 在 src/utils/upload.ts 实现小程序上传文件封装（支持微信小程序、支付宝小程序、uni-app）
- [ ] T078 [US11] 在 src/utils/upload.ts 实现上传到环信服务器的逻辑
- [ ] T079 [US11] 在 src/managers/MessageManager.ts 集成上传功能（sendImage、sendFile 等方法支持 file 参数，自动构造 ImageMessageBody）
- [ ] T080 [US11] 支持用户上传到自己服务器后使用 URL 方式构造消息
- [ ] T081 [US11] 实现上传失败的错误处理和重试机制

**Checkpoint**: 此时，小程序上传文件功能应该封装完整

---

## Phase 10: User Story 2 - 离线消息同步 (Priority: P2)

**Goal**: 实现离线消息自动同步功能，确保用户在网络恢复后能获取所有离线期间的消息

**Independent Test**: 模拟场景：连接 SDK → 发送多条消息 → 断开连接 → 模拟服务器推送离线消息 → 重新连接 → 验证所有离线消息按顺序被接收

### Tests for User Story 2 ⚠️

- [ ] T082 [P] [US2] 在 tests/unit/features/offline/offline-sync.test.ts 编写离线消息同步的单元测试（同步消息、处理分页）
- [ ] T083 [P] [US2] 在 tests/unit/core/storage/message-storage.test.ts 编写消息存储的单元测试（保存、检索、查询消息，使用 channel.channelId 索引）
- [ ] T084 [P] [US2] 在 tests/integration/offline-sync.test.ts 编写离线同步流程的集成测试

### Implementation for User Story 2

- [ ] T085 [US2] 在 src/core/storage/message-storage.ts 实现消息存储服务（保存消息到 IndexedDB、按 channel.channelId 查询、按时间戳查询）
- [ ] T086 [US2] 在 src/core/storage/schemas/messages-schema.ts 创建消息的 IndexedDB 模式（对象存储、索引：channel.channelId、timestamp、msgServerId、msgLocalId）
- [ ] T087 [US2] 在 src/features/offline/offline-sync.ts 实现离线消息同步服务（从服务器获取离线消息、支持分页）
- [ ] T088 [US2] 在 src/features/offline/message-pagination.ts 实现消息分页逻辑（每页 50 条、基于游标的分页）
- [ ] T089 [US2] 在 src/features/offline/sync-state.ts 实现同步状态管理（跟踪同步进度、处理中断、从检查点恢复）
- [ ] T090 [US2] 在 src/core/connection/connection-manager.ts 集成离线同步与连接管理器（连接时自动同步）
- [ ] T091 [US2] 在 src/features/offline/message-ordering.ts 实现同步过程中的消息排序（按时间戳排序、处理并发新消息）
- [ ] T092 [US2] 在 src/features/offline/offline-sync.ts 添加同步进度回调（onSyncStart、onSyncProgress、onSyncComplete）
- [ ] T093 [US2] 为同步失败添加错误处理（网络错误、存储错误、重试逻辑）

**Checkpoint**: 此时，User Story 1 和 User Story 2 都应该可以独立工作

---

## Phase 11: User Story 13 - 新的消息构造方法 (Priority: P2)

**Goal**: 提供新的构造消息方法，丢弃兼容代码，支持新增字段，统一发/收/历史消息格式

**Independent Test**: 使用新方法构造消息 → 验证消息格式统一 → 验证新增字段支持

### Tests for User Story 13 ⚠️

- [ ] T094 [P] [US13] 在 tests/unit/core/message/factory.test.ts 编写消息工厂函数的单元测试
- [ ] T095 [P] [US13] 在 tests/integration/message-format.test.ts 编写消息格式的集成测试（验证统一格式）

### Implementation for User Story 13

- [ ] T096 [US13] 在 src/core/message/factory.ts 实现消息工厂函数（createTextMessage、createImageMessage 等，返回完整的 Message 对象，包含 ChannelReference 和 MessageBody）
- [ ] T097 [US13] 在 src/core/message/builder.ts 实现消息 Builder 模式（可选，MessageBuilder 类）
- [ ] T098 [US13] 统一消息格式（参考 Android SDK 3.0 消息结构，统一发/收/历史消息格式，使用 msgServerId、msgLocalId、body: MessageBody）
- [ ] T099 [US13] 支持新增字段（priority、deliverOnlineOnly、isChatThread、chatThreadId 等，通过 ext 字段扩展）
- [ ] T100 [US13] 移除所有兼容代码，使用新消息格式

**Checkpoint**: 此时，消息构造方法应该统一，支持新增字段

---

## Phase 12: User Story 12 - 类型声明文件优化 (Priority: P2)

**Goal**: 类型声明文件不再使用 namespace，使用打包工具自动导出类型声明

**Independent Test**: 使用 SDK → 验证类型定义完整 → 验证无需手动维护

### Tests for User Story 12 ⚠️

- [ ] T101 [P] [US12] 在 tests/build/type-declarations.test.ts 编写类型声明的测试（验证自动生成）

### Implementation for User Story 12

- [ ] T102 [US12] 移除所有 namespace 使用，改为模块导出
- [ ] T103 [US12] 配置 TypeScript 自动生成类型声明文件（tsconfig.json declaration: true）
- [ ] T104 [US12] 配置构建工具自动导出类型声明（vite.config.ts 或 rollup.config.ts）
- [ ] T105 [US12] 验证类型声明文件自动生成，结构清晰，无需手动维护

**Checkpoint**: 此时，类型声明文件应该自动生成，不再使用 namespace

---

## Phase 13: User Story 14 - Channel 列表 API 和事件重新设计 (Priority: P2)

**Goal**: 重新设计 Channel 列表 API 和事件，增加 channel update 事件

**Independent Test**: Channel 列表更新 → SDK 触发事件 → 触发 channel update 事件

### Tests for User Story 14 ⚠️

- [ ] T106 [P] [US14] 在 tests/unit/managers/channel-manager.test.ts 编写 Channel 列表 API 的单元测试
- [ ] T107 [P] [US14] 在 tests/integration/channel-events.test.ts 编写 channel update 事件的集成测试

### Implementation for User Story 14

- [ ] T108 [US14] 在 src/managers/ChannelManager.ts 重新设计 Channel 列表 API（getChannels、getChannel 等方法，返回 Channel 联合类型）
- [ ] T109 [US14] 在 src/core/events/channel-events.ts 实现 channel update 事件（独立事件，不再使用 operation）
- [ ] T110 [US14] 在 src/core/connection/connection-manager.ts 集成 channel update 事件（登录后自动触发）
- [ ] T111 [US14] 确定是否本地缓存 20 条 Channel（与产品确认）
- [ ] T112 [US14] 确定每个 Channel 是否默认拉 20 条消息（与产品确认）

**Checkpoint**: 此时，Channel 列表 API 和事件应该重新设计完成

---

## Phase 14: User Story 15 - 事件监听独立化 (Priority: P2)

**Goal**: 将群组/聊天室事件改为独立事件，不再使用 operation 区分

**Independent Test**: 群组操作发生 → SDK 触发事件 → 触发独立的群组事件（如 channel:group:created, channel:group:updated）

### Tests for User Story 15 ⚠️

- [ ] T113 [P] [US15] 在 tests/unit/core/events/independent-events.test.ts 编写独立事件的单元测试
- [ ] T114 [P] [US15] 在 tests/integration/event-independence.test.ts 编写事件独立化的集成测试

### Implementation for User Story 15

- [ ] T115 [US15] 在 src/core/events/channel-events.ts 实现独立的 Channel 事件（channel:updated、channel:created、channel:deleted 等）
- [ ] T116 [US15] 在 src/core/events/channel-events.ts 实现独立的群组/聊天室事件（channel:group:joined、channel:group:left、channel:room:joined 等）
- [ ] T117 [US15] 移除统一事件中的 operation 区分逻辑
- [ ] T118 [US15] 更新事件监听文档和示例代码

**Checkpoint**: 此时，事件应该独立化，不再使用 operation 区分

---

## Phase 15: User Story 16 - 多版本构建支持 (Priority: P2)

**Goal**: 支持同时 build 完整版和 lite 版，满足不同使用场景

**Independent Test**: 构建配置 → 执行构建 → 同时生成完整版和 lite 版

### Tests for User Story 16 ⚠️

- [ ] T119 [P] [US16] 在 tests/build/multi-build.test.ts 编写多版本构建的测试

### Implementation for User Story 16

- [ ] T120 [US16] 创建 build/full.config.ts 完整版配置（包含所有功能）
- [ ] T121 [US16] 创建 build/lite.config.ts lite 版配置（排除群组等高级功能）
- [ ] T122 [US16] 配置构建脚本支持同时构建两个版本（package.json scripts）
- [ ] T123 [US16] 验证完整版和 lite 版都正常构建，功能正常

**Checkpoint**: 此时，多版本构建应该支持完成

---

## Phase 16: User Story 17 - 数据格式统一 (Priority: P2)

**Goal**: 返回数据和移动端尽量统一，内部组合数据

**Independent Test**: SDK 返回数据 → 查看格式 → 与移动端格式尽量统一

### Tests for User Story 17 ⚠️

- [ ] T124 [P] [US17] 在 tests/integration/data-format.test.ts 编写数据格式统一的集成测试

### Implementation for User Story 17

- [ ] T125 [US17] 在 src/utils/formatter.ts 实现数据格式化逻辑（统一返回数据格式）
- [ ] T126 [US17] 参考移动端 SDK 返回格式，统一消息、Channel 等数据格式
- [ ] T127 [US17] 在所有管理器方法中集成数据格式化（MessageManager、ChannelManager）
- [ ] T128 [US17] 验证返回数据格式与移动端尽量统一

**Checkpoint**: 此时，数据格式应该统一

---

## Phase 17: User Story 18 - Protobuf 统一 (Priority: P2)

**Goal**: 小程序和 web 使用统一的 protobuf（lite 版本）

**Independent Test**: 小程序和 web SDK → 使用 protobuf → 使用统一的 lite 版本

### Tests for User Story 18 ⚠️

- [ ] T129 [P] [US18] 在 tests/unit/protocol/protobuf-unified.test.ts 编写 protobuf 统一的单元测试

### Implementation for User Story 18

- [ ] T130 [US18] 替换 protobufjs 为 protobufjs-lite（package.json 依赖更新）
- [ ] T131 [US18] 更新 src/protocol/protobuf/ 目录下的所有 protobuf 相关代码（使用 lite 版本）
- [ ] T132 [US18] 验证小程序和 web 的 protobuf 序列化/反序列化行为一致
- [ ] T133 [US18] 验证代码体积减小，性能提升

**Checkpoint**: 此时，protobuf 应该统一为 lite 版本

---

## Phase 18: User Story 19 - 本地 Channel 列表决策 (Priority: P2)

**Goal**: 明确本地 Channel 列表是否还需要，如果不需要则移除相关代码

**Independent Test**: SDK 内部同步 channel → 登录后 → 自动触发 channel update 事件，无需本地缓存

### Tests for User Story 19 ⚠️

- [ ] T134 [P] [US19] 在 tests/integration/channel-sync.test.ts 编写 channel 同步的集成测试

### Implementation for User Story 19

- [ ] T135 [US19] 与产品确认是否需要本地 Channel 列表
- [ ] T136 [US19] 如果不需要，移除 src/core/storage/channel-storage.ts 中的本地 Channel 列表相关代码
- [ ] T137 [US19] 确保登录后自动触发 channel update 事件，开发者通过事件获取 Channel 列表
- [ ] T138 [US19] 更新文档说明 Channel 列表获取方式

**Checkpoint**: 此时，本地 Channel 列表决策应该完成

---

## Phase 19: User Story 3 - Channel 管理 (Priority: P3)

**Goal**: 实现 Channel 列表管理功能，包括获取 Channel 列表、更新 Channel 信息、标记已读等操作。Channel 统一了会话和群组的概念。

**Independent Test**: 测试场景：连接 SDK → 接收消息创建新 Channel → 获取 Channel 列表 → 更新 Channel 信息（如未读数） → 标记 Channel 已读

### Tests for User Story 3 ⚠️

- [ ] T139 [P] [US3] 在 tests/unit/managers/channel-manager.test.ts 编写 Channel 管理器的单元测试
- [ ] T140 [P] [US3] 在 tests/unit/core/storage/channel-storage.test.ts 编写 Channel 存储的单元测试（保存、检索、查询、排序）
- [ ] T141 [P] [US3] 在 tests/integration/channel-management.test.ts 编写 Channel 流程的集成测试（接收消息、创建 Channel、获取列表、标记已读）

### Implementation for User Story 3

- [ ] T142 [P] [US3] 在 src/core/storage/schemas/channels-schema.ts 创建 Channel 的 IndexedDB 模式（对象存储、索引：lastMessageTime、channelId、type）
- [ ] T143 [US3] 在 src/core/storage/channel-storage.ts 实现 Channel 存储服务（保存 Channel、按 lastMessageTime 查询、更新 Channel，支持 SingleChannel、GroupChannel、RoomChannel）
- [ ] T144 [US3] 在 src/managers/ChannelManager.ts 实现 Channel 管理器（getChannels、getChannel、markChannelRead、deleteChannel 等方法，返回 Channel 联合类型）
- [ ] T145 [US3] 在 src/features/channel/channel-auto-create.ts 实现 Channel 自动创建（收到第一条消息时创建 Channel、收到新消息时更新）
- [ ] T146 [US3] 在 src/features/channel/channel-updater.ts 实现 Channel 更新逻辑（更新最后消息、更新未读数、更新最后消息时间）
- [ ] T147 [US3] 在 src/core/message/message-receiver.ts 集成 Channel 与消息接收器（收到消息时自动创建/更新 Channel）
- [ ] T148 [US3] 在 src/features/channel/channel-sorter.ts 实现 Channel 排序（按 lastMessageTime 降序）
- [ ] T149 [US3] 在 src/managers/ChannelManager.ts 添加 Channel 事件回调（onChannelCreated、onChannelUpdated）
- [ ] T150 [US3] 为 Channel 操作添加错误处理

**Checkpoint**: 此时，所有用户故事（US1, US2, US3）都应该可以独立工作

---

## Phase 20: User Story 4 - 群组功能 (Priority: P4)

**Goal**: 支持群组聊天功能，包括加入群组、发送群组消息、接收群组消息、获取群组成员等。使用 Channel 统一概念。

**Independent Test**: 测试场景：连接 SDK → 加入群组 Channel → 发送群组消息 → 接收群组消息 → 获取群组成员列表

### Tests for User Story 4 ⚠️

- [ ] T151 [P] [US4] 在 tests/unit/managers/channel-manager.test.ts 编写群组 Channel 的单元测试
- [ ] T152 [P] [US4] 在 tests/integration/group-channel.test.ts 编写群组 Channel 流程的集成测试

### Implementation for User Story 4

- [ ] T153 [US4] 在 src/managers/ChannelManager.ts 实现群组/聊天室 Channel 操作（joinChannel、leaveChannel、getChannelMembers 等方法）
- [ ] T154 [US4] 在 src/rest/v3/channel-api.ts 实现群组/聊天室相关 REST API v3 接口
- [ ] T155 [US4] 在 src/core/message/message-sender.ts 支持发送群组/聊天室消息（通过 ChannelReference.type === 'group' 或 'room' 识别）
- [ ] T156 [US4] 在 src/core/message/message-receiver.ts 支持接收群组/聊天室消息（识别 ChannelReference.type）
- [ ] T157 [US4] 在 src/features/channel/group-channel-service.ts 实现群组 Channel 服务（加入、离开、获取成员等）
- [ ] T158 [US4] 为群组 Channel 操作添加错误处理

**Checkpoint**: 此时，群组功能应该可用

---

## Phase 21: Polish & Cross-Cutting Concerns

**目的**: 影响多个用户故事的改进

- [ ] T159 [P] 在 src/core/connection/multi-tab-coordinator.ts 实现多标签页协调（BroadcastChannel API、防止重复连接）
- [ ] T160 [P] 在 src/utils/monitor.ts 添加性能监控（消息延迟、连接状态、错误率指标）
- [ ] T161 [P] 在 src/core/message/message-deduplicator.ts 实现消息去重（跟踪已处理消息 ID（msgServerId、msgLocalId）、防止重复处理）
- [ ] T162 [P] 在 src/utils/errors.ts 添加详细的错误信息和恢复建议
- [ ] T163 [P] 在 src/core/index.ts 实现优雅关闭（清理资源、关闭连接、清除定时器）
- [ ] T164 [P] 为 src/ 中所有公共 API 添加 JSDoc 注释
- [ ] T165 [P] 更新 docs/ 中的文档（API 文档、使用指南、示例）
- [ ] T166 [P] 运行 quickstart.md 验证（测试所有示例是否工作）
- [ ] T167 [P] 代码清理和重构（移除未使用代码、优化导入）
- [ ] T168 [P] 性能优化（消息批量处理、IndexedDB 查询优化）
- [ ] T169 [P] 安全加固（验证所有输入、清理输出、防止 XSS）
- [ ] T170 [P] 更新 CHANGELOG.md（记录所有重要变更，使用中文）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可以立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - **阻塞所有用户故事**
- **User Stories (Phase 3-20)**: 都依赖 Foundational 阶段完成
  - P1 用户故事（US1, US6-US11）可以并行进行（如果有足够人力）
  - P2 用户故事（US2, US12-US19）可以并行进行
  - P3 用户故事（US3）可以并行进行
  - P4 用户故事（US4）优先级最低，可以最后实现
  - 或按优先级顺序执行（P1 → P2 → P3 → P4）
- **Polish (Phase 21)**: 依赖所有期望的用户故事完成

### User Story Dependencies

- **User Story 1 (P1)**: 可以在 Foundational (Phase 2) 后开始 - 不依赖其他故事
- **User Story 6 (P1)**: 可以在 Foundational (Phase 2) 后开始 - 依赖 US1 的基础功能
- **User Story 7 (P1)**: 可以在 Foundational (Phase 2) 后开始 - 可以独立实现
- **User Story 8 (P1)**: 可以在 Foundational (Phase 2) 后开始 - 可以独立实现
- **User Story 9 (P1)**: 可以在 Setup (Phase 1) 后开始 - 可以独立实现
- **User Story 10 (P1)**: 可以在 US6 完成后开始 - 依赖统一 API 形式
- **User Story 11 (P1)**: 可以在 US1 完成后开始 - 依赖消息发送功能
- **User Story 2 (P2)**: 可以在 US1 完成后开始 - 依赖消息功能
- **User Story 13 (P2)**: 可以在 US1 完成后开始 - 依赖消息功能
- **User Story 12 (P2)**: 可以在 US9 完成后开始 - 依赖构建工具
- **User Story 14 (P2)**: 可以在 US3 完成后开始 - 依赖 Channel 管理
- **User Story 15 (P2)**: 可以在 US4 完成后开始 - 依赖群组功能
- **User Story 16 (P2)**: 可以在 US9 完成后开始 - 依赖构建工具
- **User Story 17 (P2)**: 可以在 US1-US3 完成后开始 - 依赖数据返回
- **User Story 18 (P2)**: 可以在 US1 完成后开始 - 依赖 protobuf
- **User Story 19 (P2)**: 可以在 US14 完成后开始 - 依赖 Channel 列表 API
- **User Story 3 (P3)**: 可以在 US1 完成后开始 - 依赖消息功能
- **User Story 4 (P4)**: 可以在 US1 完成后开始 - 依赖消息功能

### Within Each User Story

- 测试（如果包含）必须在实现前编写并确保失败
- 模型在服务之前
- 服务在集成之前
- 核心实现在集成之前
- 故事完成后再进入下一个优先级

### Parallel Opportunities

- 所有标记 [P] 的 Setup 任务可以并行运行
- 所有标记 [P] 的 Foundational 任务可以并行运行（在 Phase 2 内）
- Foundational 完成后，P1 用户故事可以并行开始（如果团队容量允许）
- 用户故事的所有测试标记 [P] 可以并行运行
- 故事内的模型标记 [P] 可以并行运行
- 不同用户故事可以由不同团队成员并行工作

---

## 并行执行示例: User Story 1

```bash
# 并行启动 User Story 1 的所有测试（如果请求了测试）：
任务: "在 tests/unit/core/connection/connection-manager.test.ts 编写连接管理器的单元测试"
任务: "在 tests/unit/core/message/message-sender.test.ts 编写消息发送器的单元测试"
任务: "在 tests/unit/core/message/message-receiver.test.ts 编写消息接收器的单元测试"

# 并行启动 User Story 1 的所有模型：
任务: "在 src/types/index.ts 创建 Connection 模型类型"
任务: "在 src/types/index.ts 创建 Message 模型类型"
任务: "在 src/types/index.ts 创建 Sender 接口"
```

---

## Implementation Strategy

### MVP First (仅 User Story 1)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（关键 - 阻塞所有故事）
3. 完成 Phase 3: User Story 1
4. **停止并验证**: 独立测试 User Story 1
5. 如果就绪，部署/演示

### 增量交付

1. 完成 Setup + Foundational → 基础设施就绪
2. 添加 User Story 1 → 独立测试 → 部署/演示（MVP！）
3. 添加 P1 重构项（US6-US11）→ 独立测试 → 部署/演示
4. 添加 User Story 2 → 独立测试 → 部署/演示
5. 添加 P2 重构项（US12-US19）→ 独立测试 → 部署/演示
6. 添加 User Story 3 → 独立测试 → 部署/演示
7. 添加 User Story 4 → 独立测试 → 部署/演示
8. 每个故事在不破坏之前故事的情况下增加价值

### 并行团队策略

如果有多个开发者：

1. 团队一起完成 Setup + Foundational
2. Foundational 完成后：
   - 开发者 A: User Story 1（核心功能）
   - 开发者 B: User Story 6-8（API 形式、参数校验、错误处理）
   - 开发者 C: User Story 9-11（构建工具、API 设计、小程序上传）
3. P1 完成后：
   - 开发者 A: User Story 2（离线同步）
   - 开发者 B: User Story 12-15（类型声明、消息构造、Channel API、事件独立化）
   - 开发者 C: User Story 16-19（多版本构建、数据格式、protobuf、Channel 列表决策）
4. P2 完成后：
   - 开发者 A: User Story 3（Channel 管理）
   - 开发者 B: User Story 4（群组功能）
5. 最后一起完成 Polish 阶段

---

## Notes

- [P] 任务 = 不同文件，无依赖
- [Story] 标签将任务映射到特定用户故事以便追溯
- 每个用户故事应该可以独立完成和测试
- 在实现前验证测试失败
- 每个任务或逻辑组后提交
- 在任何检查点停止以独立验证故事
- 避免：模糊任务、同一文件冲突、破坏独立性的跨故事依赖

---

## Task Summary

- **总任务数**: 170
- **Setup 阶段**: 6 个任务
- **Foundational 阶段**: 14 个任务（包含 Channel 类型系统、MessageBody 类型系统）
- **User Story 1 (P1)**: 20 个任务（4 个测试 + 16 个实现）
- **User Story 6 (P1)**: 7 个任务（2 个测试 + 5 个实现）
- **User Story 7 (P1)**: 7 个任务（2 个测试 + 5 个实现）
- **User Story 8 (P1)**: 7 个任务（2 个测试 + 5 个实现）
- **User Story 9 (P1)**: 7 个任务（1 个测试 + 6 个实现）
- **User Story 10 (P1)**: 6 个任务（1 个测试 + 5 个实现）
- **User Story 11 (P1)**: 7 个任务（2 个测试 + 5 个实现）
- **User Story 2 (P2)**: 12 个任务（3 个测试 + 9 个实现）
- **User Story 13 (P2)**: 7 个任务（2 个测试 + 5 个实现）
- **User Story 12 (P2)**: 5 个任务（1 个测试 + 4 个实现）
- **User Story 14 (P2)**: 7 个任务（2 个测试 + 5 个实现）
- **User Story 15 (P2)**: 6 个任务（2 个测试 + 4 个实现）
- **User Story 16 (P2)**: 5 个任务（1 个测试 + 4 个实现）
- **User Story 17 (P2)**: 5 个任务（1 个测试 + 4 个实现）
- **User Story 18 (P2)**: 5 个任务（1 个测试 + 4 个实现）
- **User Story 19 (P2)**: 5 个任务（1 个测试 + 4 个实现）
- **User Story 3 (P3)**: 12 个任务（3 个测试 + 9 个实现）
- **User Story 4 (P4)**: 6 个任务（2 个测试 + 4 个实现）
- **Polish 阶段**: 12 个任务

- **并行机会**: 所有标记 [P] 的任务可以并行执行
- **MVP 范围**: User Story 1（连接建立与消息收发）
- **独立测试标准**: 每个用户故事都有明确的独立测试标准
