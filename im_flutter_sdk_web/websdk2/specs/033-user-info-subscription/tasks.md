---
description: '033 用户资料订阅与变更通知实现任务清单'
---

# Tasks: 用户资料订阅与变更通知

**Input**: 设计文档来自 `/specs/033-user-info-subscription/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）；`research.md`、`data-model.md`、`contracts/`、`quickstart.md` 可在实现中补齐  
**Tests**: 需要，包含单元测试、集成测试与测试分层说明；E2E 本期默认不新增专项用例，但必须在本文件中显式记录复用依据 / 不适用依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US3]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 033 所需文档、fixture 与测试骨架

- [x] T001 创建 033 设计与验证文档骨架 `specs/033-user-info-subscription/research.md`、`specs/033-user-info-subscription/data-model.md`、`specs/033-user-info-subscription/contracts/user-info-subscription.openapi.yaml`、`specs/033-user-info-subscription/quickstart.md`
- [x] T002 [P] 创建 033 单元与集成测试骨架 `tests/unit/managers/user-info-manager-subscription.test.ts`、`tests/unit/managers/contact-manager-friend-info.test.ts`、`tests/unit/core/message/message-receiver-user-info-notify.test.ts`、`tests/integration/user-info-manager/user-info-subscription.integration.test.ts`、`tests/integration/contact-manager/contact-manager.integration.test.ts`、`tests/integration/mock/manager-public-api.test.ts`
- [x] T003 [P] 创建 033 契约与类型测试骨架 `tests/contract/user-info-subscription.contract.test.ts`、`tests/types/user-info-subscription-types.test.ts`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 建立所有用户故事共享的真实样例门禁、版本语义和内部 notify 通道

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [x] T004 在 `specs/033-user-info-subscription/research.md`、`specs/033-user-info-subscription/contracts/user-info-subscription.openapi.yaml`、`specs/033-user-info-subscription/quickstart.md` 补齐并记录 POST / DELETE / GET 真实成功响应样例、已知错误样例与实现前门禁说明
- [x] T005 [P] 在 `src/types/user-info.ts`、`src/types/contact.ts`、`src/types/event-system.ts`、`src/types/connection.ts` 定义 033 共用的订阅参数、事件载荷、内部 user-info notify 事件名与类型边界
- [x] T006 [P] 在 `src/cache/cache-types.ts`、`src/cache/user-info-cache.ts`、`src/cache/cache-manager.ts` 设计并落地 `lastModified` 保真规则、摘要缓存投影规则和会话级完整资料运行时态基础接口
- [x] T007 [P] 在 `src/managers/user-info/user-info-runtime-store.ts`、`src/managers/user-info/user-info-notify-normalizer.ts` 建立完整资料运行时真相、patch merge、旧版本丢弃与等价重复通知判定的基础能力
- [x] T008 [P] 在 `tests/unit/core/message/message-receiver-user-info-notify.test.ts`、`tests/types/user-info-subscription-types.test.ts` 增加基础边界测试：内部事件不直接泄漏原始 notify、`lastModified` 版本语义可表达、公开类型可从根导出访问

**Checkpoint**: 真实样例门禁、内部 notify 通道和资料版本基础设施已就绪，用户故事可以围绕同一版本语义推进

---

## Phase 3: User Story 1 - 订阅、取消订阅并查询陌生人资料变更（Priority: P1） 🎯 MVP

**Goal**: 通过 `UserInfoManager` 提供稳定的添加订阅、取消订阅和查询订阅 API，并完成参数校验、错误映射与返回归一化

**Independent Test**: 登录态下独立验证 `subscribeUsersInfo`、`unsubscribeUsersInfo`、`getSubscribedUsers` 的成功路径、参数校验、去重、401/403/400 错误映射与超限边界

### Tests for User Story 1

- [x] T009 [P] [US1] 在 `tests/unit/managers/user-info-manager-subscription.test.ts` 补充订阅/取消订阅/查询订阅的参数校验、去重顺序保持、100 人上限和错误映射单测
- [x] T010 [P] [US1] 在 `tests/integration/user-info-manager/user-info-subscription.integration.test.ts` 补充订阅接口路径、POST `usernames` body、DELETE `usernames` query、GET 用户名数组 hydrate、成功响应归一化和缓存写回集成用例
- [x] T010A [P] [US1] 在 `tests/integration/mock/manager-public-api.test.ts` 补充 `client.use(UserInfoManager)` / `client.use(ContactManager)` 的公开 manager 注册与访问主路径集成用例
- [x] T011 [P] [US1] 在 `tests/contract/user-info-subscription.contract.test.ts` 校验 `specs/033-user-info-subscription/contracts/user-info-subscription.openapi.yaml` 包含三项订阅 API、真实 success envelope 与 SDK 返回模型
- [x] T012 [US1] 在 `specs/033-user-info-subscription/tasks.md` 记录 US1 不新增 E2E 的依据（当前仓库无订阅管理 demo 主路径，风险集中在 REST 映射、参数与 manager 语义，由单元 + 集成 + 契约覆盖）

### Implementation for User Story 1

- [x] T013 [US1] 在 `src/rest/user-info-subscription.ts` 实现订阅新增、取消、查询的 endpoint 构造、`userIds -> usernames` 参数归一化、GET 用户名数组到 `UserInfo[]` 的成功响应解析
- [x] T014 [P] [US1] 在 `src/rest/api-errors.json`、`src/rest/errors.ts` 补充 `subscribeUsersInfo`、`unsubscribeUsersInfo`、`getSubscribedUsers` 的 operation 定义与 401/403/400 超限错误映射
- [x] T015 [P] [US1] 在 `src/types/user-info.ts`、`src/managers/user-info/index.ts`、`src/index.ts` 补齐订阅参数/返回类型、双语注释与公开导出
- [x] T016 [US1] 在 `src/managers/user-info-manager.ts` 实现 `subscribeUsersInfo({ userIds })`、`unsubscribeUsersInfo({ userIds })`、`getSubscribedUsers()`，并接入统一错误处理与缓存投影

**Checkpoint**: US1 完成后，SDK 已具备稳定可调用的订阅管理 API，且不泄漏原始 REST envelope

---

## Phase 4: User Story 2 - 订阅用户资料变化时自动更新缓存并派发事件（Priority: P1）

**Goal**: 收到 `subscribe_metadata_updated` 后，先更新会话内用户资料真相与摘要缓存，再通过 `UserInfoManager` 派发 `onUserInfoUpdated`

**Independent Test**: 模拟 `subscribe_metadata_updated` notify、旧版本 notify、部分字段 patch、缓存为空与重复通知，验证缓存 patch、事件顺序和订阅事件载荷

### Tests for User Story 2

- [x] T017 [P] [US2] 在 `tests/unit/core/message/message-receiver-user-info-notify.test.ts` 补充 `subscribe_metadata_updated` 识别、内部事件派发和非法 notify 忽略单测
- [x] T018 [P] [US2] 在 `tests/unit/chat-client/user-info-notify.test.ts` 补充订阅 notify 的 patch merge、旧版本丢弃、重复通知去重、先更新缓存后派发事件单测
- [x] T019 [P] [US2] 在 `tests/unit/chat-client/user-info-notify.test.ts` 验证 `MessageReceiver` 等价内部事件进入 `ChatClient` 后，`UserInfoManager` 回调中可立即读取最新资料
- [x] T020 [US2] 在 `specs/033-user-info-subscription/tasks.md` 记录 US2 不新增 E2E 的依据（当前无“订阅资料变化”浏览器主路径，风险集中在 notify 编排、缓存和事件顺序）

### Implementation for User Story 2

- [x] T021 [US2] 在 `src/core/message/message-receiver.ts` 识别 `subscribe_metadata_updated` 并转为 `InternalEventName.USER_INFO_NOTIFY`
- [x] T022 [P] [US2] 在 `src/chat-client.ts` 增加 user-info notify 内部监听、归一化编排和“先 patch 再事件”的处理顺序
- [x] T023 [P] [US2] 在 `src/managers/user-info/user-info-notify-normalizer.ts`、`src/managers/user-info/user-info-runtime-store.ts` 实现订阅 notify 到 `UserInfo` patch、`lastModified` 比较与最小可用资料建立
- [x] T024 [P] [US2] 在 `src/types/event-system.ts`、`src/types/user-info.ts`、`src/managers/user-info-manager.ts` 实现 `onUserInfoUpdated` 的事件类型、注册入口与对外派发
- [x] T025 [US2] 在 `src/cache/cache-manager.ts`、`src/cache/user-info-cache.ts` 修正 summary `lastUpdate` 与运行时完整资料同步逻辑，避免旧 notify 回退新缓存

**Checkpoint**: US2 完成后，订阅用户资料变化已能在无需补拉的前提下闭环更新缓存并派发订阅事件

---

## Phase 5: User Story 3 - 好友资料变化时同步刷新联系人视图并给出好友事件（Priority: P1）

**Goal**: 收到 `contact_metadata_updated` 后，更新统一用户资料真相、刷新同会话联系人视图，并通过 `ContactManager` 派发 `onContactInfoUpdated`

**Independent Test**: 在已存在好友关系的前提下模拟 `contact_metadata_updated`，验证 `getContacts()` 与 `onContactInfoUpdated` 一致、缺少关系字段时仍派发最小事件

### Tests for User Story 3

- [x] T026 [P] [US3] 在 `tests/unit/core/message/message-receiver-user-info-notify.test.ts` 补充 `contact_metadata_updated` 识别与内部事件派发单测
- [x] T027 [P] [US3] 在 `tests/unit/managers/contact-manager-friend-info.test.ts` 补充好友资料变化事件 payload、联系人快照可选附带、缺少 `remark/addTs` 时的最小回退单测
- [x] T028 [P] [US3] 在 `tests/integration/contact-manager/contact-manager.integration.test.ts` 补充 `contact_metadata_updated` 后 `getContacts()` 与 `onContactInfoUpdated` 一致性的集成用例
- [x] T029 [US3] 在 `specs/033-user-info-subscription/tasks.md` 记录 US3 不新增 E2E 的依据（当前仓库无好友资料变化 demo 主路径，风险集中在联系人快照与事件协作）

### Implementation for User Story 3

- [x] T030 [US3] 在 `src/core/message/message-receiver.ts`、`src/chat-client.ts` 把 `contact_metadata_updated` 接入与订阅 notify 共用的内部 user-info notify 编排链
- [x] T031 [P] [US3] 在 `src/types/contact.ts`、`src/types/event-system.ts`、`src/managers/contact/index.ts` 扩展 `FriendInfoChangedEvent`、`onContactInfoUpdated` 类型与公开导出
- [x] T032 [P] [US3] 在 `src/managers/contact-manager.ts` 实现好友资料变化事件的注册入口、公开派发与联系人快照协作
- [x] T033 [P] [US3] 在 `src/chat-client.ts`、`src/cache/cache-manager.ts` 完成好友 notify 后的联系人视图刷新与关系字段缺失时的最小可用事件组装

**Checkpoint**: US3 完成后，好友资料变化会与统一资料缓存和联系人视图保持一致，并通过 `ContactManager` 稳定对外暴露

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 收尾验证、文档同步、版本治理与提交

- [x] T034 [P] 同步 033 设计文档到实现现实 `specs/033-user-info-subscription/research.md`、`specs/033-user-info-subscription/data-model.md`、`specs/033-user-info-subscription/contracts/user-info-subscription.openapi.yaml`、`specs/033-user-info-subscription/quickstart.md`
- [x] T035 [P] 补齐 033 的公开文档与双语注释回归 `src/managers/user-info-manager.ts`、`src/managers/contact-manager.ts`、`docs/reference/api.md`、`docs/reference/user-info-manager-api.md`、`docs/reference/contact-manager-api.md`
- [x] T036 在 `specs/033-user-info-subscription/quickstart.md` 记录 033 的关键验证结果（至少包含聚焦的 unit/integration/contract/types 用例与 E2E 不新增依据）
- [x] T037 执行 `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run docs:api:check`、`npm run test:gate:pr` 并把 033 相关结果记录到 `specs/033-user-info-subscription/quickstart.md`
- [x] T038 更新版本与变更记录 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [x] T039 基于 `specs/033-user-info-subscription/`、`src/`、`tests/`、`docs/` 提交 033 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-5 (User Stories)**: 依赖 Phase 2 完成；建议按 P1 主线逐步推进，也可在团队允许时部分并行
- **Phase 6 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 完成后即可开始，是 033 的 MVP 主路径
- **US2 (P1)**: 依赖 Phase 2 的内部 notify 通道与版本语义基础，可在 US1 API 稳定后推进
- **US3 (P1)**: 依赖 Phase 2 的内部 notify 通道与运行时资料真相；建议在 US2 完成共用 notify 编排后推进

### Within Each User Story

- 先补故事级测试并确认当前实现尚未满足新约束
- 再实现 REST / cache / manager / notify 编排逻辑
- 最后完成故事级独立验证和“不新增 E2E”依据记录

### Parallel Opportunities

- Phase 1 中 `T002`、`T003` 可并行
- Phase 2 中 `T005`、`T006`、`T007`、`T008` 可在 `T004` 明确真实样例门禁后并行
- US1 中 `T009`、`T010`、`T011` 可并行
- US2 中 `T017`、`T018`、`T019` 可并行
- US3 中 `T026`、`T027`、`T028` 可并行
- Polish 中 `T034`、`T035` 可并行

---

## Parallel Example: User Story 1

```bash
Task: "T009 tests/unit/managers/user-info-manager-subscription.test.ts"
Task: "T010 tests/integration/user-info-manager/user-info-subscription.integration.test.ts"
Task: "T011 tests/contract/user-info-subscription.contract.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T017 tests/unit/core/message/message-receiver-user-info-notify.test.ts"
Task: "T018 tests/unit/managers/user-info-manager-subscription.test.ts"
Task: "T019 tests/integration/user-info-manager/user-info-subscription.integration.test.ts"
Task: "T023 src/managers/user-info/user-info-notify-normalizer.ts and src/managers/user-info/user-info-runtime-store.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T026 tests/unit/core/message/message-receiver-user-info-notify.test.ts"
Task: "T027 tests/unit/managers/contact-manager-friend-info.test.ts"
Task: "T028 tests/integration/contact-manager/contact-friend-info.integration.test.ts"
Task: "T031 src/types/contact.ts and src/types/event-system.ts and src/managers/contact/index.ts"
```

---

## Implementation Strategy

### MVP First（建议）

1. 完成 Phase 1-2，先补齐真实响应样例门禁、版本语义和内部 notify 通道
2. 交付 US1，确保订阅管理 API 可独立使用
3. **停止并验证**：确认订阅 API 不泄漏 REST envelope、错误映射稳定、查询结果为标准化 `UserInfo`
4. 再进入 US2 和 US3，补齐 notify 闭环与好友视图一致性

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（订阅/取消/查询 API）
3. 交付 US2（订阅 notify 更新缓存并派发事件）
4. 交付 US3（好友 notify 刷新联系人视图并派发事件）
5. 最后完成文档、验证、版本治理和提交

### Parallel Team Strategy

1. 一人先完成 Phase 1-2
2. Foundation 完成后：
   - 开发者 A：US1 订阅 REST 适配、错误映射和 `UserInfoManager` API
   - 开发者 B：US2 user-info notify 编排、版本比较和订阅事件
   - 开发者 C：US3 好友资料变化事件、联系人视图协作和 `ContactManager` 扩展

---

## Notes

- `[P]` 任务表示不同文件、可并行推进
- 033 的硬门槛是补齐真实 POST / DELETE / GET 成功响应样例；未完成前不得固化 REST 成功解析逻辑
- 本期 E2E 通过显式记录“不新增 / 复用依据”满足 spec 的测试分层要求
- 实现完成后必须先验证，再更新版本号、`CHANGELOG.md`，最后提交中文 commit

## E2E 说明

- US1 不新增 E2E：当前仓库无订阅管理 demo 主路径，核心风险在 REST 映射、参数校验和 manager 语义
- US2 不新增 E2E：当前无订阅资料变化浏览器主路径，风险集中在 notify 编排、缓存与事件顺序
- US3 不新增 E2E：当前无好友资料变化 demo 主路径，风险集中在联系人快照与事件协作
