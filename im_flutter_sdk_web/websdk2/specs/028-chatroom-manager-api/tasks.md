---
description: '028 ChatRoomManager API 实现任务清单'
---

# Tasks: ChatRoomManager API 迁移、聊天室对象化与事件标准化

**Input**: 设计文档来自 `/specs/028-chatroom-manager-api/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、集成测试、契约测试与类型/JSDoc 回归；E2E 本期不新增，但必须在文档中显式记录依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US4]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 028 所需的聊天室类型、REST、事件与测试骨架

- [ ] T001 创建 ChatRoomManager 骨架 `src/managers/chatroom-manager.ts`、`src/managers/chatroom/index.ts`
- [ ] T002 创建聊天室 REST 适配骨架 `src/rest/chatroom-management.ts`
- [ ] T003 创建聊天室公开类型骨架 `src/types/chatroom.ts`
- [ ] T004 [P] 创建聊天室归一化与事件 helper 骨架 `src/managers/chatroom/chatroom.ts`、`src/managers/chatroom/chatroom-normalizers.ts`、`src/managers/chatroom/chatroom-event-mapper.ts`、`src/managers/chatroom/chatroom-event-user-info-resolver.ts`
- [ ] T005 [P] 创建 ChatRoomManager 单元与 REST 单测骨架 `tests/unit/managers/chatroom-manager.test.ts`、`tests/unit/rest/chatroom-management.test.ts`
- [ ] T006 [P] 创建聊天室对象与事件单测骨架 `tests/unit/chatroom/chatroom.test.ts`、`tests/unit/chatroom/chatroom-event-mapper.test.ts`、`tests/unit/chatroom/chatroom-event-user-info-resolver.test.ts`、`tests/unit/protocol/msync-chatroom-notify.test.ts`、`tests/unit/core/message/message-receiver-chatroom.test.ts`
- [ ] T007 [P] 创建 ChatRoomManager 集成测试骨架 `tests/integration/chatroom-manager/chatroom-manager.integration.test.ts`、`tests/integration/chatroom-manager/chatroom-events.integration.test.ts`
- [ ] T008 [P] 创建 ChatRoomManager 契约/类型测试骨架 `tests/contract/chatroom-manager.contract.test.ts`、`tests/types/chatroom-manager-types.test.ts`
- [ ] T009 [P] 创建聊天室 API 对照文档骨架 `docs/reference/chatroom-manager-api.md`，并在 `docs/reference/api.md` 预留 028 替换位点

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的类型、错误、归一化、导出与样例治理基础

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [ ] T010 在 `src/types/chatroom.ts` 定义 `ChatRoomSummary`、`ChatRoomListResult`、`ChatRoomDetail`、`ChatRoomCurrentUserStatus`、`ChatRoomMemberEntry`、`ChatRoomMuteEntry`、`ChatRoomAllowlistEntry`、`ChatRoomBlocklistEntry`、`ChatRoomSharedFile`、`ChatRoomAttributeMutationResult` 与基础输入模型
- [x] T011 [P] 在 `src/types/event-system.ts`、`src/index.ts` 扩展 ChatRoomManager 事件名、payload map、handler map 与公开类型导出
- [ ] T012 [P] 在 `src/index.ts`、`src/managers/chatroom/index.ts` 导出 `ChatRoomManager`、`ChatRoom` 并为 `client.chatRoomManager` 访问方式预留公开入口
- [x] T013 [P] 在 `src/rest/api-errors.json`、`src/utils/error-codes.ts` 增加聊天室域错误映射入口（FR-048）：(1) `common.chatroom` 段定义 7 个聊天室专属错误码 CHATROOM_INVALID_ID(700) / CHATROOM_NOT_JOINED(702) / CHATROOM_PERMISSION_DENIED(703) / CHATROOM_MEMBERS_FULL(704) / CHATROOM_NOT_EXIST(705) / CHATROOM_OWNER_NOT_ALLOW_LEAVE(706) / CHATROOM_USER_IN_BLOCKLIST(707)；(2) `error-codes.ts` 导出对应 `CHATROOM_` 前缀常量；(3) `joinChatRoom` 补充 members_full(704) 和 user_in_blocklist(707)；(4) 4 个属性 API 补充 error_code 字段级映射 (60010→703, 60011→702, 60012→4)
- [ ] T014 在 `src/rest/chatroom-management.ts` 实现共享的 path/query/body 构造、`userIds` 去重、Promise 返回 envelope 剥离与样例/同构契约 guard rail
- [ ] T015 在 `src/managers/chatroom-manager.ts` 实现共享的 REST 客户端获取、统一错误转换、结构化日志与参数校验 helper
- [ ] T016 [P] 在 `src/managers/chatroom/chatroom-normalizers.ts` 实现聊天室对象、分页对象、共享文件对象、属性结果与写操作结果的基础归一化 helper
- [ ] T017 [P] 在 `specs/028-chatroom-manager-api/contracts/chatroom-manager.openapi.yaml`、`specs/028-chatroom-manager-api/quickstart.md` 标注真实样例来源、027 同构接口复用范围与 `uploadSharedFile` 移除约束
- [x] T018 [P] 在 `tests/unit/managers/chatroom-manager.test.ts`、`tests/unit/rest/chatroom-management.test.ts` 增加共享参数校验、`userIds` 去重、旧命名移除与 `uploadSharedFile` 不可见基础测试
- [x] T019 [P] 在 `tests/types/chatroom-manager-types.test.ts` 增加 `client.use(ChatRoomManager)` / `client.chatRoomManager` 注册方式、`ChatRoom` 方法模型与旧别名不可见的基础回归
- [x] T020 [P] 在 `tests/integration/mock/manager-public-api.test.ts` 预留 ChatRoomManager 公开入口 mock-only 骨架与复用辅助方法

**Checkpoint**: 028 共享基础能力就绪，用户故事可并行推进

---

## Phase 3: User Story 1 - 通过 ChatRoomManager 完成聊天室域公开 API 迁移（Priority: P1） 🎯 MVP

**Goal**: 实现聊天室生命周期、列表、详情与基础管理 API 的新命名公开面，引入 `getChatRoom(chatRoomId)` + `ChatRoom` 单聊天室对象，并彻底移除旧 connection/chatRoom 别名主路径

**Independent Test**: 在已登录 mock 场景下验证 `client.chatRoomManager` 的入口 API、`getChatRoom(chatRoomId)`、分页结果归一化、`userIds` 批量入参与旧名移除，即可独立验收 028 的主交付面

### Tests for User Story 1

- [ ] T021 [P] [US1] 在 `tests/contract/chatroom-manager.contract.test.ts` 增加聊天室列表、详情、生命周期与基础 mutation 的逻辑契约用例
- [ ] T022 [P] [US1] 在 `tests/unit/rest/chatroom-management.test.ts` 增加 `getChatRoomList`、`getChatRoomInfo`、`updateChatRoomInfo`、`joinChatRoom`、`leaveChatRoom`、`destroy` 的请求组装、`leaveChatRoom` 逻辑 contract 约束与分页归一化用例
- [x] T023 [P] [US1] 在 `tests/unit/managers/chatroom-manager.test.ts` 增加核心 API 参数校验、`getChatRoom(chatRoomId)`、旧别名移除与 `Promise<void>` 返回约束用例
- [ ] T024 [P] [US1] 在 `tests/integration/chatroom-manager/chatroom-manager.integration.test.ts` 增加 `client.chatRoomManager` 主路径、基础 mutation、分页读取与统一错误模型集成用例
- [ ] T025 [P] [US1] 在 `tests/types/chatroom-manager-types.test.ts` 增加核心 API 签名、分页结果对象与 `userIds: ReadonlyArray<string>` 入参回归
- [ ] T026 [US1] 在 `specs/028-chatroom-manager-api/quickstart.md` 记录本期不新增聊天室管理 demo E2E 的依据

### Implementation for User Story 1

- [ ] T027 [US1] 在 `src/rest/chatroom-management.ts` 实现 `getChatRoomList`、`getChatRoomInfo`、`updateChatRoomInfo`、`joinChatRoom`、`leaveChatRoom`、`destroy` 的 endpoint 适配
- [ ] T028 [US1] 在 `src/managers/chatroom-manager.ts` 实现聊天室基础 API、分页结果封装、`getChatRoom(chatRoomId)` 入口、统一错误抛出与双语 JSDoc
- [ ] T029 [US1] 在 `src/managers/chatroom/chatroom.ts` 实现 `ChatRoom` 轻量对象及 `getInfo()` / `refresh()`、`updateInfo()`、`destroy()`、`leaveChatRoom()` 等单聊天室基础方法委托
- [x] T030 [US1] 在 `tests/integration/mock/manager-public-api.test.ts` 增加 ChatRoomManager 公开入口 mock-only 回归，覆盖 `client.use(ChatRoomManager)` 与 `ChatClient.init({ managers: [ChatRoomManager] })`
- [ ] T031 [US1] 在 `src/index.ts`、`docs/reference/api.md`、`docs/reference/chatroom-manager-api.md` 移除旧 chat room API 名称与 connection 风格示例，替换为 028 主 API 名称

**Checkpoint**: US1 可独立完成“ChatRoomManager 成为聊天室域唯一入口 + `ChatRoom` 成为单聊天室上下文对象 + 主 API 命名迁移”闭环

---

## Phase 4: User Story 2 - ChatRoom 对象按 Group 模式承载单聊天室方法，并复用群组同构数据结构（Priority: P1）

**Goal**: 让 `ChatRoom` 像 027 的 `Group` 一样只承担单聊天室上下文方法容器角色，并让详情、成员、管理员、黑名单、allowlist、禁言、公告、共享文件列表/删除结果统一复用群组域已确认的数据结构与用户对象化策略

**Independent Test**: 独立验证 `ChatRoom` 的详情、成员、管理员、黑名单、allowlist、禁言列表、公告、共享文件列表/删除、当前用户状态方法在“缓存命中 / 批量补拉 / 部分失败”三类场景下都返回标准化业务对象

### Tests for User Story 2

- [x] T032 [P] [US2] 在 `tests/unit/chatroom/chatroom.test.ts` 增加 `ChatRoom` 方法挂载、无同步 getter、方法委托与职责边界用例
- [x] T033 [P] [US2] 在 `tests/unit/chatroom/chatroom-event-user-info-resolver.test.ts` 增加缓存命中、批量补拉、部分失败回退与最小 `userId` 视图用例
- [ ] T034 [P] [US2] 在 `tests/unit/managers/chatroom-manager.test.ts` 增加详情、成员列表、管理员列表、黑名单、allowlist、禁言列表、公告、共享文件结果对象化返回与顺序保持用例
- [ ] T035 [P] [US2] 在 `tests/integration/chatroom-manager/chatroom-manager.integration.test.ts` 增加 UserInfoManager/CacheManager 协作、资料补拉失败不吞主结果与最小对象回退集成用例
- [ ] T036 [P] [US2] 在 `tests/contract/chatroom-manager.contract.test.ts` 增加详情、成员、管理员、黑名单、allowlist、禁言、公告、共享文件与状态类 endpoint 的 fixture 契约用例
- [ ] T037 [P] [US2] 在 `tests/types/chatroom-manager-types.test.ts` 增加 `ChatRoomDetail`、`ChatRoomMemberEntry`、`ChatRoomMuteEntry`、`ChatRoomAllowlistEntry`、`ChatRoomBlocklistEntry`、`ChatRoomSharedFile` 与 `ChatRoomCurrentUserStatus` 的返回类型回归

### Implementation for User Story 2

- [ ] T038 [US2] 在 `src/rest/chatroom-management.ts` 实现 `getMemberList`、`addMembers`、`removeMembers`、`getAdminList`、单用户 `setAdmin` / `removeAdmin`、`getBlocklist`、`blockMembers`、`unblockMembers`、`getAllowlist`、`addUsersToAllowlist`、`removeUsersFromAllowlist`、`checkIfInAllowList`、`getMuteList`、`muteMembers`、`unmuteMembers`、`muteAllMembers`、`unmuteAllMembers`、`isCurrentUserMuted`、`getAnnouncement`、`getSharedFileList`、`deleteSharedFile` 的 endpoint 适配
- [ ] T039 [US2] 在 `src/managers/chatroom/chatroom-event-user-info-resolver.ts`、`src/managers/chatroom-manager.ts` 实现缓存优先 + 批量 `fetchUserInfoByUserId` 的资料补齐编排与最小 `UserInfo` 回退
- [ ] T040 [US2] 在 `src/managers/chatroom/chatroom-normalizers.ts` 实现与 027 同构的详情、成员、管理员、黑名单、allowlist、禁言、公告、共享文件与当前用户状态归一化
- [ ] T041 [US2] 在 `src/managers/chatroom/chatroom.ts` 实现 `getMemberList()`、`getAdminList()`、`getBlocklist()`、`getAllowlist()`、`checkIfInAllowList()`、`isCurrentUserMuted()`、`getAnnouncement()`、`getSharedFileList()`、`deleteSharedFile()` 等单聊天室方法
- [ ] T042 [US2] 在 `docs/reference/chatroom-manager-api.md`、`specs/028-chatroom-manager-api/quickstart.md` 补充 `ChatRoom` 方法模型与 `uploadSharedFile` 已移除说明

**Checkpoint**: US2 可独立完成“Group 风格的 ChatRoom 对象 + Web 标准化返回 + 用户对象化补齐”闭环

---

## Phase 5: User Story 3 - 通过 ChatRoomManager 统一监听聊天室事件，并按 Web SDK 规范收敛（Priority: P1）

**Goal**: 让旧 `handleMucMsg.ts` 中聊天室相关 MUC operation 全部迁移为 ChatRoomManager 类型化事件模型，事件名按 Web SDK 规范收敛、payload 字段驼峰化、用户字段对象化，并去掉旧 `onChatroomChange/onChatroomEvent` 公开模型

**Independent Test**: 独立验证聊天室事件解码映射、事件名类型定义、事件注册入口与事件派发，不依赖所有 REST API 完整实现即可验收

### Tests for User Story 3

- [x] T043 [P] [US3] 在 `tests/unit/chatroom/chatroom-event-mapper.test.ts` 增加聊天室销毁、成员加入/退出、管理员变更、群主变更、全员禁言、allowlist、公告、属性等 operation 到事件名映射用例
- [ ] T044 [P] [US3] 在 `tests/unit/chatroom/chatroom-event-user-info-resolver.test.ts` 增加聊天室事件用户字段对象化、数组补齐与失败回退用例
- [x] T045 [P] [US3] 在 `tests/unit/protocol/msync-chatroom-notify.test.ts` 增加聊天室 MUCBody 解码、原始字段驼峰化与 ext/muteInfo 收敛用例
- [x] T046 [P] [US3] 在 `tests/unit/core/message/message-receiver-chatroom.test.ts` 增加消息接收链路到 ChatRoomManager 事件派发的单测
- [ ] T047 [P] [US3] 在 `tests/integration/chatroom-manager/chatroom-events.integration.test.ts` 增加 `chatRoomManager.addEventHandler()` 注册、对象化 payload 与资料补齐失败不丢事件集成用例
- [x] T048 [P] [US3] 在 `tests/types/chatroom-manager-types.test.ts` 增加聊天室事件 handler map、Web SDK 收敛事件与旧事件模型不可见的类型回归

### Implementation for User Story 3

- [x] T049 [US3] 在 `src/types/chatroom.ts`、`src/types/event-system.ts`、`src/index.ts` 定义并导出 ChatRoomManager 事件 payload 类型、事件名称常量与 handler map
- [x] T050 [US3] 在 `src/managers/chatroom/chatroom-event-mapper.ts` 基于旧 `handleMucMsg.ts` 实现聊天室 operation -> ChatRoomManager 事件名映射
- [ ] T050A [US3] 在 `src/managers/chatroom/chatroom-event-mapper.ts` 实现事件 payload 解析规则（FR-055/FR-056/FR-057）：(1) ADD_MUTE 优先从 ext JSON `user_mute_time` 提取按用户区分的禁言到期时间戳，解析失败回退到 `body.tos()` + 默认过期时间 4638873600000；(2) KICK 通过 reason 字段区分 BE_KICKED_FOR_OFFLINE 和 BE_KICKED；(3) PRESENCE/ABSENCE 优先从 getMUCMembers() 获取成员列表，为空时回退到 from().userName()
- [ ] T051 [US3] 在 `src/managers/chatroom/chatroom-event-user-info-resolver.ts` 实现聊天室事件用户字段对象化、最小 `UserInfo` 回退与数组批量补齐
- [x] T052 [US3] 在 `src/protocol/msync/proto.ts`、`src/protocol/msync/codec.ts` 增加聊天室 `MUCBody` 解码与原始载荷归一化
- [x] T053 [US3] 在 `src/core/message/message-receiver.ts`、`src/chat-client.ts`、`src/managers/chatroom-manager.ts` 接入 ChatRoomManager 事件分发链路与 `onChatRoomInfoChanged` 受控详情补拉
- [x] T054 [US3] 在 `docs/reference/chatroom-manager-api.md` 补充旧事件模型到新事件模型的迁移说明，并明确共享文件事件不进入公开聊天室事件集

**Checkpoint**: US3 可独立完成“旧聊天室 MUC 事件 -> ChatRoomManager 类型化事件体系”闭环

---

## Phase 6: User Story 4 - 公告、共享文件列表/删除与聊天室属性能力在 ChatRoom 对象上形成闭环（Priority: P2）

**Goal**: 让聊天室公告、共享文件列表/删除和聊天室属性能力统一收敛到 `ChatRoom` 对象上，并保持与群组域一致的命名、错误语义与标准化返回结构；同时明确 `uploadSharedFile` 不再进入公开面

**Independent Test**: 独立验证 `ChatRoom` 对象上的公告、共享文件列表/删除、属性读写能力，以及属性相关事件派发和结果归一化语义

### Tests for User Story 4

- [ ] T055 [P] [US4] 在 `tests/contract/chatroom-manager.contract.test.ts` 增加公告、共享文件列表/删除与属性 endpoint 的契约与 fixture 用例
- [ ] T056 [P] [US4] 在 `tests/unit/rest/chatroom-management.test.ts`、`tests/unit/chatroom/chatroom.test.ts` 增加 `getAnnouncement()`、`updateAnnouncement()`、`getSharedFileList()`、`deleteSharedFile()`、`getAttributes({ keys })`、`setAttributes()`、`setAttribute()`、`removeAttributes()`、`removeAttribute()` 的请求组装与归一化用例
- [ ] T057 [P] [US4] 在 `tests/unit/managers/chatroom-manager.test.ts` 增加高阶 API 的参数校验、统一错误模型、属性部分成功结果与 `uploadSharedFile` 不可见约束用例
- [ ] T058 [P] [US4] 在 `tests/integration/chatroom-manager/chatroom-manager.integration.test.ts` 增加公告、共享文件列表/删除与属性高阶能力的集成用例
- [ ] T059 [P] [US4] 在 `tests/integration/chatroom-manager/chatroom-events.integration.test.ts` 增加 `onAnnouncementChanged`、`onAttributesUpdate`、`onAttributesRemoved` 事件集成用例
- [ ] T060 [P] [US4] 在 `tests/types/chatroom-manager-types.test.ts` 增加公告、共享文件列表/删除、属性快照与属性变更结果的类型签名回归

### Implementation for User Story 4

- [ ] T061 [US4] 在 `src/rest/chatroom-management.ts`、`src/managers/chatroom/chatroom.ts` 实现 `getAnnouncement()`、`updateAnnouncement()`、`getSharedFileList()`、`deleteSharedFile()`
- [ ] T062 [US4] 在 `src/rest/chatroom-management.ts`、`src/managers/chatroom/chatroom.ts`、`src/types/chatroom.ts` 实现 `getAttributes({ keys?: string[] })`、`setAttributes()`、`setAttribute()`、`removeAttributes()`、`removeAttribute()` 与属性结果模型
- [ ] T062A [US4] 在 `src/rest/chatroom-management.ts` 或 `src/rest/errors.ts` 实现属性 API 的 `error_code` 字段级映射（FR-050/FR-058）：HTTP 400 响应按 `error_code`(60010/60011/60012) 映射为 CHATROOM_PERMISSION_DENIED(703) / CHATROOM_NOT_JOINED(702) / SERVICE_LIMIT_EXCEEDED(4)
- [ ] T062B [US4] 在 `src/managers/chatroom/chatroom-normalizers.ts` 实现属性批量操作 PARTIAL_SUCCESS 判定（FR-051/FR-052）：解析 `successKeys`/`errorKeys`，按字符串匹配规则映射每个 errorKey 的错误码，返回 `ChatRoomAttributeMutationResult` 或抛出 `SDKError`
- [ ] T063 [US4] 在 `src/managers/chatroom/chatroom-normalizers.ts` 实现公告、共享文件与属性快照/属性变更结果的归一化
- [ ] T064 [US4] 在 `docs/reference/chatroom-manager-api.md`、`docs/reference/chatroom-api.md`、`specs/028-chatroom-manager-api/contracts/chatroom-manager.openapi.yaml` 更新高阶能力的请求体、返回体与“上传共享文件已移除”的迁移说明

**Checkpoint**: US4 可独立完成“高阶聊天室能力命名/返回/文档语义一致”闭环

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、验证与发布

- [x] T065 [P] 对齐 028 文档术语、测试分层说明与 E2E 不新增依据于 `specs/028-chatroom-manager-api/spec.md`、`specs/028-chatroom-manager-api/plan.md`、`specs/028-chatroom-manager-api/tasks.md`、`specs/028-chatroom-manager-api/quickstart.md`
- [x] T066 [P] 回填 `specs/028-chatroom-manager-api/quickstart.md` 的实测结果、真实样例到位情况、已知限制与 fixture 使用说明
- [ ] T067 执行 `npm run test:run -- tests/unit/managers/chatroom-manager.test.ts tests/unit/chatroom tests/unit/rest/chatroom-management.test.ts tests/unit/protocol/msync-chatroom-notify.test.ts tests/unit/core/message/message-receiver-chatroom.test.ts tests/integration/chatroom-manager/chatroom-manager.integration.test.ts tests/integration/chatroom-manager/chatroom-events.integration.test.ts tests/integration/mock/manager-public-api.test.ts tests/contract/chatroom-manager.contract.test.ts tests/types/chatroom-manager-types.test.ts` 并记录输出到 `specs/028-chatroom-manager-api/quickstart.md`
- [x] T068 执行 `npm run lint`、`npm run type-check`、`npm run docs:api:check`、`npm run test:gate:pr` 并记录 028 相关结果到 `specs/028-chatroom-manager-api/quickstart.md`
- [x] T069 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [x] T070 在 `docs/reference/chatroom-manager-api.md`、相关 JSDoc 与生成型 API site 对齐最终公开面，确保 `ChatRoomManager` 页面不再展示属于 `ChatRoom` 的方法，也不再展示 `uploadSharedFile`
- [ ] T071 基于 `specs/028-chatroom-manager-api/`、`src/`、`tests/`、`docs/` 提交 028 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-6 (User Stories)**: 依赖 Phase 2 完成；可并行或按优先级推进
- **Phase 7 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: Phase 2 后可开始；复用 US1 的 manager 骨架与用户资料入口，但对象化返回可独立验证
- **US3 (P1)**: Phase 2 后可开始；依赖聊天室事件类型和协议解码基础，但可与 US1/US2 并行推进
- **US4 (P2)**: Phase 2 后可开始；高阶 API 与 US1/US2 共享 REST/ChatRoom 基础，可在主路径稳定后补齐

### Within Each User Story

- 先完成故事级测试任务并验证失败预期
- 再实现 REST 适配、公开类型与 manager/chatroom 方法
- 再补齐归一化、资料补齐、事件映射或文档/JSDoc
- 最后执行故事级独立验证

### Parallel Opportunities

- Phase 1、2 所有标记 `[P]` 的任务可并行
- Phase 2 完成后，US1/US2/US3 的测试任务可并行推进
- US2 的对象化资料补齐与 US3 的事件映射可由不同开发者并行
- US4 的高阶 REST 适配与文档更新可并行
- Phase 7 的文档回填与测试执行前准备可并行

---

## Parallel Example: User Story 1

```bash
Task: "T021 tests/contract/chatroom-manager.contract.test.ts"
Task: "T022 tests/unit/rest/chatroom-management.test.ts"
Task: "T023 tests/unit/managers/chatroom-manager.test.ts"
Task: "T025 tests/types/chatroom-manager-types.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T032 tests/unit/chatroom/chatroom.test.ts"
Task: "T033 tests/unit/chatroom/chatroom-event-user-info-resolver.test.ts"
Task: "T035 tests/integration/chatroom-manager/chatroom-manager.integration.test.ts"
Task: "T036 tests/contract/chatroom-manager.contract.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T043 tests/unit/chatroom/chatroom-event-mapper.test.ts"
Task: "T045 tests/unit/protocol/msync-chatroom-notify.test.ts"
Task: "T046 tests/unit/core/message/message-receiver-chatroom.test.ts"
Task: "T048 tests/types/chatroom-manager-types.test.ts"
```

## Parallel Example: User Story 4

```bash
Task: "T055 tests/contract/chatroom-manager.contract.test.ts"
Task: "T056 tests/unit/rest/chatroom-management.test.ts"
Task: "T058 tests/integration/chatroom-manager/chatroom-manager.integration.test.ts"
Task: "T060 tests/types/chatroom-manager-types.test.ts"
```

---

## Implementation Strategy

### MVP First（建议）

1. 完成 Phase 1-2，建立 ChatRoomManager/ChatRoom/REST/事件基础骨架
2. 优先交付 US1，确保 `client.chatRoomManager` 与 `getChatRoom(chatRoomId)` 主路径成立
3. 紧接 US2，收敛聊天室对象方法模型和同构数据结构
4. 再完成 US3，打通聊天室事件迁移主链路
5. 最后补齐 US4 的公告、共享文件列表/删除与属性闭环

### Incremental Delivery

1. US1 完成后即可提供最小可用聊天室管理公开面
2. US2 完成后即可稳定提供对象化读取结果与 `ChatRoom` 方法模型
3. US3 完成后即可替换旧聊天室事件监听方式
4. US4 完成后即可补齐聊天室高阶管理能力
