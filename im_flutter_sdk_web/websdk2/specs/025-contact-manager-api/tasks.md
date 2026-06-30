---
description: '025 联系人管理 API 实现任务清单'
---

# Tasks: 联系人管理 API 补齐（阶段二）

**Input**: 设计文档来自 `/specs/025-contact-manager-api/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、集成测试、契约测试与类型/JSDoc 回归；E2E 若本期无 demo 联系人入口，则必须显式记录不新增依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US3]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 025 所需的 REST、类型与测试骨架

- [ ] T001 创建联系人管理 REST 适配骨架 `src/rest/contact-management.ts`
- [ ] T002 创建 ContactManager 管理接口测试骨架 `tests/unit/contact-manager/contact-manager-validation.test.ts`、`tests/unit/contact-manager/contact-manager-mutations.test.ts`、`tests/unit/contact-manager/contact-manager-blocklist.test.ts`
- [ ] T003 [P] 创建 ContactManager 集成测试骨架 `tests/integration/contact-manager/contact-manager.integration.test.ts`
- [ ] T004 [P] 创建 ContactManager 契约测试骨架 `tests/contract/contact-manager.contract.test.ts`
- [ ] T005 [P] 创建 ContactManager 类型回归测试骨架 `tests/types/contact-manager-types.test.ts`
- [ ] T006 [P] 在 `src/managers/contact/index.ts`、`src/index.ts` 预留 025 导出调整位点

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的类型、错误、归一化、事件扩展与会话协调基础

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [ ] T007 在 `src/types/contact.ts` 定义联系人管理请求/响应类型、黑名单对象模型与会话级快照类型
- [ ] T008 [P] 在 `src/types/index.ts`、`src/index.ts` 导出 025 新增的 contact 公共类型
- [ ] T009 [P] 在 `src/rest/api-errors.json` 增加联系人/黑名单业务错误映射（含已知 blocklist 404 not found 场景）
- [ ] T010 [P] 在 `src/utils/error-codes.ts` 对齐 025 需要使用的联系人管理错误码入口
- [ ] T011 在 `src/rest/contact-management.ts` 实现共享的请求体构造、响应 envelope 归一化与 `userIds` 去重工具
- [ ] T012 在 `src/managers/contact-manager.ts` 实现共享的 REST 客户端获取、统一错误转换与日志辅助方法
- [ ] T013 [P] 在 `src/cache/contact-cache.ts`、`src/cache/cache-manager.ts` 增加联系人本地补丁 helper 骨架（delete/remark/rebuild snapshot）
- [ ] T014 [P] 在 `src/chat-client.ts` 预留联系人受控刷新 helper 骨架，供接受好友申请后复用 024 同步控制器
- [ ] T015 [P] 在 `src/types/contact.ts`、`src/types/event-system.ts` 扩展原工程 5 个 roster 联系人事件名称、payload 与 handler 类型
- [ ] T016 [P] 在 `src/protocol/msync/codec.ts`、`src/core/message/message-receiver.ts` 预留 roster meta 解码与联系人事件分发骨架
- [ ] T017 [P] 在 `tests/unit/contact-manager/contact-manager-validation.test.ts` 增加共享参数校验、错误映射与 `userIds` 去重基础测试
- [ ] T018 [P] 在 `tests/types/contact-manager-types.test.ts` 增加 `void` 返回、`UserInfo[]` 返回、`userIds: string[]` 入参与新增联系人事件 handler 的类型约束测试

**Checkpoint**: 025 共享基础能力就绪，用户故事可并行推进

---

## Phase 3: User Story 1 - 在 ContactManager 上完成联系人关系操作闭环（Priority: P1） 🎯 MVP

**Goal**: 实现 `addContact`、`deleteContact`、`acceptContactInvite`、`declineContactInvite`、`setContactRemark`，并保证联系人写操作后的会话内状态一致

**Independent Test**: 在已登录场景下独立调用 5 个联系人写接口，验证参数校验、统一错误模型、`void` 返回约束，以及删除/备注修改/接受申请后的联系人快照一致性

### Tests for User Story 1

- [ ] T019 [P] [US1] 在 `tests/contract/contact-manager.contract.test.ts` 增加联系人写接口逻辑契约用例（add/delete/accept/decline/remark）
- [ ] T020 [P] [US1] 在 `tests/unit/contact-manager/contact-manager-validation.test.ts` 增加 `addContact`、`acceptContactInvite`、`declineContactInvite` 的参数校验与 `void` 返回用例
- [ ] T021 [P] [US1] 在 `tests/unit/contact-manager/contact-manager-mutations.test.ts` 增加 `deleteContact`、`setContactRemark` 本地补丁与 `acceptContactInvite` 受控刷新触发用例
- [ ] T022 [P] [US1] 在 `tests/integration/contact-manager/contact-manager.integration.test.ts` 增加联系人写操作成功/失败路径与同会话快照一致性集成用例
- [ ] T023 [P] [US1] 在 `tests/types/contact-manager-types.test.ts` 增加 5 个联系人写接口返回 `Promise<void>` 的类型回归用例
- [ ] T024 [US1] 在 `specs/025-contact-manager-api/tasks.md` 记录本期不新增联系人写操作 demo E2E 的依据（当前无 demo 联系人管理入口，先由集成测试兜底）

### Implementation for User Story 1

- [ ] T025 [US1] 在 `src/rest/contact-management.ts` 实现 `addContact`、`deleteContact`、`acceptContactInvite`、`declineContactInvite`、`setContactRemark` 的 endpoint 适配与原始响应处理
- [ ] T026 [US1] 在 `src/managers/contact-manager.ts` 实现 5 个联系人写接口及其双语 JSDoc
- [ ] T027 [US1] 在 `src/cache/contact-cache.ts`、`src/cache/cache-manager.ts` 实现 `deleteContact` 与 `setContactRemark` 的本地补丁与快照重建
- [ ] T028 [US1] 在 `src/chat-client.ts` 实现 `acceptContactInvite` 成功后的联系人受控刷新 helper，并复用 024 `RosterSyncController`
- [ ] T029 [US1] 在 `src/managers/contact-manager.ts` 明确 `addContact` / `declineContactInvite` 的 `noop` 协调策略，避免伪造联系人记录
- [ ] T030 [US1] 在 `src/managers/contact-manager.ts`、`src/rest/contact-management.ts` 增加联系人写操作结构化日志与错误诊断字段

**Checkpoint**: US1 可独立完成“联系人关系写操作 + 会话内联系人结果协调”闭环

---

## Phase 4: User Story 2 - 联系人读取 API 与当前快照语义一致（Priority: P1）

**Goal**: 保持 `getContacts()` 的同步读取与 024 兼容语义，并确保联系人写操作后读取结果始终是标准 `Contact` 快照

**Independent Test**: 在“有快照”“无快照”“联系人刚发生写操作”三类场景下独立调用 `getContacts()`，验证返回结构、空数组语义、无额外网络调用和与 024 事件/快照的兼容性

### Tests for User Story 2

- [ ] T031 [P] [US2] 在 `tests/unit/contact-manager/contact-manager-mutations.test.ts` 增加 `getContacts()` 的同步读取、空结果与无网络依赖用例
- [ ] T032 [P] [US2] 在 `tests/integration/contact-manager/contact-manager.integration.test.ts` 增加联系人写操作后再次读取 `getContacts()` 的一致性回归用例
- [ ] T033 [P] [US2] 在 `tests/contract/contact-manager.contract.test.ts` 增加 `ContactManager.getContacts()` 逻辑契约与 `Contact` 结构断言
- [ ] T034 [US2] 在 `specs/025-contact-manager-api/tasks.md` 记录本期不新增联系人读取 UI E2E 的依据（当前无 demo 联系人展示主路径，读取语义由单元+集成测试覆盖）

### Implementation for User Story 2

- [ ] T035 [US2] 在 `src/managers/contact-manager.ts` 强化 `getContacts()` 的同步读取语义与双语文档，明确区别于异步管理接口，并移除对外 `getSnapshot()` / `getContactList()`
- [ ] T036 [US2] 在 `src/cache/cache-manager.ts` 保持联系人本地补丁后的快照重建逻辑与 024 `ContactSnapshot` 结构兼容
- [ ] T037 [US2] 在 `src/chat-client.ts` 保持 `getContactSnapshot()` 的同步读取路径，不引入 `getContacts()` 的隐式 REST 调用
- [ ] T038 [US2] 在 `src/types/contact.ts` 对齐 `Contact` / `ContactSnapshot` 的公开注释，确保 025 扩展不破坏 024 既有含义

**Checkpoint**: US2 可独立完成“联系人读取入口不变 + 写后读取一致 + 024 兼容不回退”闭环

---

## Phase 5: User Story 3 - 黑名单 API 可直接在 ContactManager 中使用（Priority: P2）

**Goal**: 实现 `getBlocklist`、`addUsersToBlocklist`、`removeUserFromBlocklist`，并保证对象化返回、会话级快照一致性、部分成功返回、整单失败映射与移除幂等成功

**Independent Test**: 在已登录场景下独立调用 3 个黑名单接口，验证 `UserInfo[]` 返回、`userIds: string[]` 入参、重复值去重、`succeeded/failed` 数组结构、已知整单失败映射和移除不存在用户成功语义

### Tests for User Story 3

- [ ] T039 [P] [US3] 在 `tests/contract/contact-manager.contract.test.ts` 增加黑名单查询/添加/移除契约与真实 envelope fixture 用例
- [ ] T040 [P] [US3] 在 `tests/unit/contact-manager/contact-manager-blocklist.test.ts` 增加 `getBlocklist` 归一化、`userIds` 去重、`succeeded/failed` 数组、整单失败映射与移除幂等成功用例
- [ ] T041 [P] [US3] 在 `tests/integration/contact-manager/contact-manager.integration.test.ts` 增加黑名单会话级快照增删一致性集成用例
- [ ] T042 [P] [US3] 在 `tests/types/contact-manager-types.test.ts` 增加 `getBlocklist(): Promise<UserInfo[]>` 与 blocklist mutation 类型约束用例
- [ ] T043 [US3] 在 `specs/025-contact-manager-api/tasks.md` 记录本期不新增黑名单 demo E2E 的依据（当前无 demo 黑名单交互入口，核心风险由集成与契约测试覆盖）

### Implementation for User Story 3

- [ ] T044 [US3] 在 `src/types/contact.ts` 补充`UserInfo`、`BlocklistAddResult`、`BlocklistSnapshot` 与黑名单请求类型
- [ ] T045 [US3] 在 `src/rest/contact-management.ts` 实现 `getBlocklist`、`addUsersToBlocklist`、`removeUserFromBlocklist` 的 endpoint 适配与 envelope 归一化
- [ ] T046 [US3] 在 `src/managers/contact-manager.ts` 实现黑名单会话级快照维护与 3 个黑名单管理接口
- [ ] T047 [US3] 在 `src/rest/api-errors.json`、`src/rest/errors.ts` 增加并接入已确认的 `service_resource_not_found + UserNotFoundException` 业务错误映射
- [ ] T048 [US3] 在 `src/managers/contact-manager.ts`、`src/rest/contact-management.ts` 增加黑名单读写操作日志与调试诊断信息

---

## Phase 6: User Story 4 - ContactManager 可监听原工程 roster 联系人事件（Priority: P1）

**Goal**: 恢复 `onContactInvited`、`onContactDeleted`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 5 个 roster 联系人事件，并在联系人建立/删除事件发生时同步修补当前会话联系人缓存；其中 `onContactInvited`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 必须带 `userInfo`

**Independent Test**: 通过模拟 `NameSpace.ROSTER` 下行 meta，独立验证 5 个事件的协议解码、`contactManager.addEventHandler()` 对外派发、4 个事件的 `userInfo` 补齐/回退，以及 `onContactAdded` / `onContactAgreed` / `onContactDeleted` 对 `getContacts()` 的即时影响

### Tests for User Story 4

- [ ] T049 [P] [US4] 在 `tests/unit/protocol/msync-roster-notify.test.ts` 增加 `RosterBody` 解码与 operation -> contact event 映射用例
- [ ] T050 [P] [US4] 在 `tests/unit/core/message/message-receiver.test.ts` 增加 roster 联系人事件分发用例
- [ ] T051 [P] [US4] 在 `tests/unit/chat-client/contact-roster-events.test.ts` 增加 `onContactAdded/onContactAgreed/onContactDeleted` 对缓存 patch、`userInfo` 补齐与版本更新的用例
- [ ] T052 [P] [US4] 在 `tests/unit/managers/contact-manager.test.ts` 增加 `ContactEventHandlerMap` 对新增 5 个事件的委托与兼容性用例
- [ ] T053 [P] [US4] 在 `tests/integration/contact-manager/contact-manager.integration.test.ts` 增加 roster 事件到达后 `getContacts()` 一致性与事件 `userInfo` 补齐集成用例
- [ ] T054 [P] [US4] 在 `tests/unit/managers/contact-manager.test.ts` 增加 `getBlocklist()` 资料补齐/回退，以及联系人事件 `userInfo` 使用 `UserInfo` 视图的用例

### Implementation for User Story 4

- [ ] T055 [US4] 在 `src/types/contact.ts` 定义 `ContactRosterEventType`、带 `userInfo: UserInfo` 的 `ContactRosterEventPayload`，并把 `Contact` 收敛为 `userInfo: UserInfo + addTs`
- [ ] T056 [US4] 在 `src/types/event-system.ts`、`src/types/index.ts`、`src/index.ts` 导出 5 个 roster 联系人事件名称、payload 与 handler 类型
- [ ] T057 [US4] 在 `src/protocol/msync/codec.ts` 增加 `NameSpace.ROSTER` / `RosterBody` 解码与事件归一化
- [ ] T058 [US4] 在 `src/cache/contact-cache.ts`、`src/cache/cache-manager.ts` 增加联系人新增 patch、资料读取辅助与 roster version 更新 helper
- [ ] T059 [US4] 在 `src/managers/contact-manager.ts` 实现 `getBlocklist()` 的资料补齐编排，优先复用快照，缺失时批量调用 `fetchUserInfoByUserId`
- [ ] T060 [US4] 在 `src/chat-client.ts`、`src/core/message/message-receiver.ts` 接入联系人 roster 事件的本地缓存 patch 补齐，并保持资料补拉失败时仍派发 `onContactInvited/onContactRefuse/onContactAdded/onContactAgreed`
- [ ] T061 [US4] 在 `src/managers/contact-manager.ts` 与公开文档中声明对原工程 5 个 roster 联系人事件及 `userInfo` payload 的兼容支持

**Checkpoint**: US3 可独立完成“黑名单对象化 API + 会话级一致性 + 错误语义收敛”闭环

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、验证与发布

- [ ] T062 [P] 对齐 025 文档术语、测试层说明与 E2E 不新增依据于 `specs/025-contact-manager-api/spec.md`、`specs/025-contact-manager-api/plan.md`、`specs/025-contact-manager-api/tasks.md`
- [ ] T063 [P] 回填 `specs/025-contact-manager-api/quickstart.md` 的实测结果、已知限制与 fixture 使用说明
- [ ] T064 执行 `npm run test:run -- tests/unit/contact-manager tests/integration/contact-manager tests/contract/contact-manager.contract.test.ts tests/types/contact-manager-types.test.ts tests/unit/protocol/msync-roster-notify.test.ts tests/unit/core/message/message-receiver.test.ts tests/unit/chat-client/contact-roster-events.test.ts tests/unit/managers/contact-manager.test.ts` 并记录输出到 `specs/025-contact-manager-api/quickstart.md`
- [ ] T065 执行 `npm run lint`、`npm run type-check`、`npm run test:gate:pr` 并记录 025 相关结果到 `specs/025-contact-manager-api/quickstart.md`
- [ ] T066 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [ ] T067 基于 `specs/025-contact-manager-api/`、`src/`、`tests/` 提交 025 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-5 (User Stories)**: 依赖 Phase 2 完成；可并行或按优先级推进
- **Phase 6 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: Phase 2 后可开始；最终集成验证会复用 US1 的联系人写接口，但读取语义回归可独立推进
- **US3 (P2)**: Phase 2 后可开始，与联系人写操作共享基础设施，但可独立实现与验证

### Within Each User Story

- 先完成故事级测试任务并验证失败预期
- 再实现 REST 适配、类型与 manager 公开方法
- 再接入缓存补丁、受控刷新或会话级快照协调
- 最后执行故事级独立验证

### Parallel Opportunities

- Phase 1、2 所有标记 `[P]` 的任务可并行
- Phase 2 完成后，US1/US2/US3 的测试任务可并行推进
- US1 的 REST 适配与缓存补丁任务可分开发者并行
- US3 的契约/fixture 测试与错误映射任务可并行
- Phase 6 的文档与验证类任务可并行

---

## Parallel Example: User Story 1

```bash
Task: "T017 tests/contract/contact-manager.contract.test.ts"
Task: "T018 tests/unit/contact-manager/contact-manager-validation.test.ts"
Task: "T019 tests/unit/contact-manager/contact-manager-mutations.test.ts"
Task: "T021 tests/types/contact-manager-types.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T029 tests/unit/contact-manager/contact-manager-mutations.test.ts"
Task: "T030 tests/integration/contact-manager/contact-manager.integration.test.ts"
Task: "T031 tests/contract/contact-manager.contract.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T037 tests/contract/contact-manager.contract.test.ts"
Task: "T038 tests/unit/contact-manager/contact-manager-blocklist.test.ts"
Task: "T039 tests/integration/contact-manager/contact-manager.integration.test.ts"
Task: "T040 tests/types/contact-manager-types.test.ts"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（联系人写接口、缓存补丁、受控刷新）
3. **STOP and VALIDATE**：仅验证 US1 独立通过
4. 通过后再推进读取兼容性和黑名单能力

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（联系人关系写操作闭环）
3. 交付 US2（同步读取语义与快照兼容性回归）
4. 交付 US3（黑名单对象化 API 与会话快照）
5. 收尾发布（Phase 6）

### Parallel Team Strategy

- 开发 A：US1（联系人写接口、缓存补丁、受控刷新）
- 开发 B：US2（读取兼容性、快照重建与回归测试）
- 开发 C：US3（黑名单 REST 适配、快照、错误映射）

---

## Notes

- 所有任务均遵循 `- [ ] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段均带 `[USx]` 标签，便于追踪与独立验收
- 本期 E2E 通过显式记录“不新增”依据满足 spec 的测试分层要求
- 当前脚手架 active feature 仍指向 `001-im-sdk-refactor`，执行 Speckit 脚本时需显式以 `specs/025-contact-manager-api/` 为准
- 每轮实现完成后按规则更新版本号、CHANGELOG 并提交 commit
