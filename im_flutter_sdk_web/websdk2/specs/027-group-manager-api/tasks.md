---
description: '027 GroupManager API 实现任务清单'
---

# Tasks: GroupManager API 迁移、命名收敛与事件标准化

**Input**: 设计文档来自 `/specs/027-group-manager-api/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、集成测试、契约测试与类型/JSDoc 回归；E2E 若本期无 demo 群组入口，则必须显式记录不新增依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US4]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 027 所需的群组类型、REST、事件与测试骨架

- [X] T001 创建 GroupManager 骨架 `src/managers/group-manager.ts`、`src/managers/group/index.ts`
- [X] T002 创建群组 REST 适配骨架 `src/rest/group-management.ts`
- [X] T003 创建群组公开类型骨架 `src/types/group.ts`
- [X] T004 [P] 创建群组归一化与事件 helper 骨架 `src/managers/group/group-normalizers.ts`、`src/managers/group/group-event-mapper.ts`、`src/managers/group/group-event-user-info-resolver.ts`
- [X] T005 [P] 创建 GroupManager 单元与 REST 单测骨架 `tests/unit/managers/group-manager.test.ts`、`tests/unit/rest/group-management.test.ts`
- [X] T006 [P] 创建群事件单测骨架 `tests/unit/group/group-event-mapper.test.ts`、`tests/unit/group/group-event-user-info-resolver.test.ts`、`tests/unit/protocol/msync-muc-notify.test.ts`、`tests/unit/core/message/message-receiver-group.test.ts`
- [X] T007 [P] 创建 GroupManager 集成测试骨架 `tests/integration/group-manager/group-manager.integration.test.ts`、`tests/integration/group-manager/group-events.integration.test.ts`
- [X] T008 [P] 创建 GroupManager 契约/类型测试骨架 `tests/contract/group-manager.contract.test.ts`、`tests/types/group-manager-types.test.ts`
- [X] T009 [P] 创建群组 API 对照文档骨架 `docs/reference/group-manager-api.md`，并在 `docs/reference/api.md` 预留 027 替换位点

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的类型、错误、归一化、导出与样例治理基础

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [X] T010 在 `src/types/group.ts` 定义 `GroupSummary`、`GroupListResult`、`GroupDetail`、`GroupMemberEntry`、`GroupMuteEntry`、`GroupAllowlistEntry`、`GroupBlocklistEntry`、`GroupSharedFile` 与基础输入模型
- [X] T011 [P] 在 `src/types/event-system.ts`、`src/index.ts` 扩展 GroupManager 事件名、payload map、handler map 与公开类型导出
- [X] T012 [P] 在 `src/index.ts`、`src/managers/group/index.ts` 导出 `GroupManager` 并为 `client.groupManager` 访问方式预留公开入口
- [X] T013 [P] 在 `src/rest/api-errors.json`、`src/utils/error-codes.ts` 增加群组域错误映射入口
- [X] T014 在 `src/rest/group-management.ts` 实现共享的 path/query/body 构造、`userIds` 去重、Promise 返回 envelope 剥离与真实样例待确认 guard rail
- [X] T015 在 `src/managers/group-manager.ts` 实现共享的 REST 客户端获取、统一错误转换、结构化日志与参数校验 helper
- [X] T016 [P] 在 `src/managers/group/group-normalizers.ts` 实现群对象、分页对象、共享文件对象与 patch->业务模型的基础归一化 helper
- [X] T017 [P] 在 `specs/027-group-manager-api/contracts/group-manager.openapi.yaml`、`specs/027-group-manager-api/quickstart.md` 标注待需求方提供真实响应样例的 endpoint 清单与 fixture 接入位点
- [X] T018 [P] 在 `tests/unit/managers/group-manager.test.ts`、`tests/unit/rest/group-management.test.ts` 增加共享参数校验、`userIds` 去重与旧命名移除基础测试
- [X] T019 [P] 在 `tests/types/group-manager-types.test.ts` 增加 `client.use(GroupManager)` / `client.groupManager` 注册方式与旧别名不可见的基础回归
- [X] T020 [P] 在 `tests/integration/mock/manager-public-api.test.ts` 预留 GroupManager 公开入口 mock-only 骨架与复用辅助方法

**Checkpoint**: 027 共享基础能力就绪，用户故事可并行推进

---

## Phase 3: User Story 1 - 通过 GroupManager 完成群组域公开 API 迁移（Priority: P1） 🎯 MVP

**Goal**: 实现群组生命周期、列表、详情与基础管理 API 的新命名公开面，引入 `getGroup(groupId)` + `Group` 单群对象，并彻底移除旧 connection/group 别名主路径

**Independent Test**: 在已登录 mock 场景下验证 `client.groupManager` 的入口 API、`getGroup(groupId)`、分页结果归一化、`userIds` 批量入参与旧名移除，即可独立验收 027 的主交付面

### Tests for User Story 1

- [X] T021 [P] [US1] 在 `tests/contract/group-manager.contract.test.ts` 增加群列表、群详情、群生命周期与基础 mutation 的逻辑契约用例
- [X] T022 [P] [US1] 在 `tests/unit/rest/group-management.test.ts` 增加 `createGroup`、`getJoinedGroupList`、`getGroupInfo`、`getGroupInfoList`、`updateGroupInfo`、`changeGroupOwner`、`destroyGroup`、`leaveGroup`、`joinGroup` 的请求组装与分页归一化用例
- [X] T023 [P] [US1] 在 `tests/unit/managers/group-manager.test.ts` 增加核心 API 参数校验、`acceptGroupInvite/rejectGroupInvite` 无 `invitee` 入参、旧别名移除与 `Promise<void>` 返回约束用例
- [X] T024 [P] [US1] 在 `tests/integration/group-manager/group-manager.integration.test.ts` 增加 `client.groupManager` 主路径、基础 mutation、分页读取与统一错误模型集成用例
- [X] T025 [P] [US1] 在 `tests/types/group-manager-types.test.ts` 增加核心 API 签名、分页结果对象与 `userIds: ReadonlyArray<string>` 入参回归
- [X] T026 [US1] 在 `specs/027-group-manager-api/tasks.md` 记录本期不新增群组管理 demo E2E 的依据（当前无 demo 群组主路径，核心风险由单元+集成+契约测试覆盖）

### Implementation for User Story 1

- [X] T027 [US1] 在 `src/rest/group-management.ts` 实现 `createGroup`、`getJoinedGroupList`、`getGroupInfo`、`getGroupInfoList`、`updateGroupInfo`、`changeGroupOwner`、`destroyGroup`、`leaveGroup`、`joinGroup` 的 endpoint 适配
- [X] T028 [US1] 在 `src/rest/group-management.ts`、`src/managers/group-manager.ts` 实现 `inviteUsersToGroup`、`acceptGroupJoinRequest`、`rejectGroupJoinRequest`、`acceptGroupInvite`、`rejectGroupInvite` 的请求适配与公开方法
- [X] T029 [US1] 在 `src/managers/group-manager.ts` 实现群组基础 API、分页结果封装、统一错误抛出与双语 JSDoc
- [X] T030 [US1] 在 `tests/integration/mock/manager-public-api.test.ts` 增加 GroupManager 公开入口 mock-only 回归，覆盖 `client.use(GroupManager)` 与 `ChatClient.init({ managers: [GroupManager] })`
- [X] T031 [US1] 在 `src/index.ts`、`docs/reference/api.md`、`docs/reference/group-manager-api.md` 移除旧 group API 名称与 connection 风格示例，替换为 027 主 API 名称

备注：本期不新增群组管理 demo E2E。当前仓库没有稳定的 demo 群组主路径，027 的主风险集中在 manager API、REST 组装、公开类型与事件语义，已由单元、mock 集成、契约与类型测试覆盖。

**Checkpoint**: US1 可独立完成“GroupManager 成为群组域唯一入口 + `Group` 成为单群上下文对象 + 主 API 命名迁移”闭环

---

## Phase 4: User Story 2 - 读取用户列表类结果时直接拿到对象化用户视图（Priority: P1）

**Goal**: 让原本只返回 `userId` 的群成员、管理员、黑名单、allowlist 与禁言结果，在 `Group` 单群方法上统一返回 `UserInfo` 视图，并复用缓存优先的资料补齐链路

**Independent Test**: 独立验证 `group.getMembers()`、`group.getAdmins()`、`group.getBlocklist()`、`group.getAllowlist()`、`group.getMuteList()` 在“缓存命中 / 批量补拉 / 部分失败”三类场景下都返回对象化结果

### Tests for User Story 2

- [X] T032 [P] [US2] 在 `tests/unit/group/group-event-user-info-resolver.test.ts` 增加缓存命中、批量补拉、部分失败回退与最小 `userId` 视图用例
- [X] T033 [P] [US2] 在 `tests/unit/managers/group-manager.test.ts` 增加成员列表、管理员列表、黑名单、allowlist、禁言列表对象化返回、去重与顺序保持用例
- [X] T034 [P] [US2] 在 `tests/integration/group-manager/group-manager.integration.test.ts` 增加 UserInfoManager/CacheManager 协作、资料补拉失败不吞主结果与最小对象回退集成用例
- [X] T035 [P] [US2] 在 `tests/contract/group-manager.contract.test.ts` 增加成员/管理员/黑名单/allowlist/禁言 endpoint 的 fixture 契约与样例占位
- [X] T036 [P] [US2] 在 `tests/types/group-manager-types.test.ts` 增加 `GroupMemberEntry`、`GroupMuteEntry`、`GroupAllowlistEntry`、`GroupBlocklistEntry` 的对象化返回类型回归
- [X] T037 [US2] 在 `specs/027-group-manager-api/tasks.md` 记录本期不新增“群成员列表 UI”E2E 的依据（当前无 demo 群成员展示入口，资料补齐风险由单元+集成覆盖）

### Implementation for User Story 2

- [X] T038 [US2] 在 `src/rest/group-management.ts` 实现 `getGroupMemberList`、`removeGroupMembers`、`getGroupAdminList`、`setGroupAdmin`、`removeGroupAdmin`、`getGroupBlocklist`、`blockGroupMembers`、`unblockGroupMembers`、`getGroupAllowlist`、`addUsersToGroupAllowlist`、`removeUsersFromGroupAllowlist`、`checkIfInGroupAllowList`、`getGroupMuteList`、`muteGroupMembers`、`unmuteGroupMembers`、`muteAllGroupMembers`、`unmuteAllGroupMembers`、`isCurrentUserMutedInGroup` 的 endpoint 适配
- [X] T039 [US2] 在 `src/managers/group-manager.ts`、`src/managers/group/group-event-user-info-resolver.ts` 实现缓存优先 + 批量 `fetchUserInfoByUserId` 的资料补齐编排，并保证补齐失败时主业务结果继续返回
- [X] T040 [US2] 在 `src/managers/group/group-normalizers.ts`、`src/types/group.ts` 实现成员/管理员/黑名单/allowlist/禁言的 `UserInfo` 对象化模型与归一化
- [X] T041 [US2] 在 `src/managers/group-manager.ts` 完成相关公开方法、`ReadonlyArray<string>` 入参约束与双语 JSDoc
- [X] T042 [US2] 在 `docs/reference/group-manager-api.md`、`docs/reference/api.md` 记录“旧 userId 字段 -> 新对象化用户结果”的迁移对照与示例

**Checkpoint**: US2 可独立完成“群域用户相关读取统一对象化 + cache-first 资料补齐 + 失败回退可用”闭环

备注：本期不新增“群成员列表 UI”E2E。当前 demo 没有群成员展示入口，风险集中在对象化资料补齐、最小 `{ userId }` 回退与缓存协作，优先由单元与集成测试锁定。

---

## Phase 5: User Story 3 - 通过 GroupManager 统一监听群事件，并覆盖旧 MUC 群事件范围（Priority: P1）

**Goal**: 把旧 `handleMucMsg.ts` 的群事件完整迁移到 `groupManager.addEventHandler()`，事件名与移动端对齐，但用户字段与群对象字段保持 Web 对象化语义

**Independent Test**: 独立喂入 MUC fixture，验证 operation 解码、事件映射、对象化 payload、`onGroupInfoChanged/onGroupDisabledChanged` 的完整群对象语义与受控补拉行为

### Tests for User Story 3

- [X] T043 [P] [US3] 在 `tests/unit/group/group-event-mapper.test.ts` 增加旧 `handleMucMsg.ts` 中群组 operation 到移动端事件名的映射覆盖
- [X] T044 [P] [US3] 在 `tests/unit/group/group-event-user-info-resolver.test.ts` 增加邀请类、成员类、管理员类、allowlist/禁言类事件的对象化用户字段与失败回退用例
- [X] T045 [P] [US3] 在 `tests/unit/protocol/msync-muc-notify.test.ts` 增加 `MUCBody` 解码、operation 归一化与原始字段判别用例
- [X] T046 [P] [US3] 在 `tests/unit/core/message/message-receiver-group.test.ts` 增加群事件进入 `EventHub`、再到 `groupManager.addEventHandler()` 的分发用例
- [X] T047 [P] [US3] 在 `tests/integration/group-manager/group-events.integration.test.ts` 增加邀请、成员加入、公告变化、共享文件变化、成员属性变化、`onGroupInfoChanged` / `onGroupDisabledChanged` 补拉详情的集成用例
- [X] T048 [P] [US3] 在 `tests/types/group-manager-types.test.ts` 增加 GroupManager 事件名、payload map、handler 签名与移动端对齐事件集合回归
- [X] T049 [US3] 在 `specs/027-group-manager-api/tasks.md` 记录本期不新增群事件 demo E2E 的依据（当前无可交互群事件浏览器主路径，风险集中在协议映射与事件派发链路）

### Implementation for User Story 3

- [X] T050 [US3] 在 `src/types/group.ts`、`src/types/event-system.ts`、`src/index.ts` 定义并导出 GroupManager 事件 payload 类型、事件名称常量与 handler map
- [X] T051 [US3] 在 `src/managers/group/group-event-mapper.ts` 基于旧 `handleMucMsg.ts` 实现群组 operation -> GroupManager 事件名映射
- [X] T052 [US3] 在 `src/managers/group/group-event-user-info-resolver.ts` 实现群事件用户字段对象化、最小 `UserInfo` 回退与数组批量补齐
- [X] T053 [US3] 在 `src/protocol/msync/proto.ts`、`src/protocol/msync/codec.ts` 增加 `MUCBody` 解码与群事件原始载荷归一化
- [X] T054 [US3] 在 `src/core/message/message-receiver.ts`、`src/chat-client.ts` 接入 GroupManager 事件分发链路与 manager 级事件注册
- [X] T055 [US3] 在 `src/managers/group-manager.ts`、`src/managers/group/group-normalizers.ts` 实现 `onGroupInfoChanged` / `onGroupDisabledChanged` 的完整群对象语义与必要时群详情受控补拉
- [X] T056 [US3] 在 `docs/reference/group-manager-api.md` 补充旧事件模型到新事件模型的迁移说明，并明确 `onAllowListAdded/onAllowListRemoved` 为公开 allowlist 事件名

**Checkpoint**: US3 可独立完成“旧 MUC 群事件 -> GroupManager 类型化事件体系”闭环

备注：本期不新增群事件 demo E2E。当前仓库没有可交互的群事件浏览器主路径，核心风险在 `MUCBody` 解码、operation 映射、`EventHub` 派发与对象化载荷回退，已由单元与专项集成测试承担。

---

## Phase 6: User Story 4 - 高阶群能力也遵循同一命名和返回模型（Priority: P2）

**Goal**: 让群公告、共享文件、成员属性等高阶能力与基础群管理 API 使用同一命名规范、Promise 主语义、统一错误模型与标准化返回结构，并优先挂载到 `Group` 上

**Independent Test**: 独立验证 `Group` 上的公告、共享文件、成员属性高阶能力的请求组装、返回归一化、进度回调兼容与对象化结果语义

### Tests for User Story 4

- [X] T057 [P] [US4] 在 `tests/contract/group-manager.contract.test.ts` 增加群公告、共享文件、成员属性高阶 endpoint 的契约与 fixture 占位
- [X] T058 [P] [US4] 在 `tests/unit/rest/group-management.test.ts`、`tests/unit/managers/group.test.ts` 增加 `group.getAnnouncement()`、`group.updateAnnouncement()`、`group.getSharedFileList()`、`group.uploadSharedFile()`、`group.deleteSharedFile()`、`group.downloadSharedFile()`、`group.setMemberAttributes()`、`group.getMembersAttributes()` 的请求组装与归一化用例
- [X] T059 [P] [US4] 在 `tests/unit/managers/group-manager.test.ts` 增加高阶 API 的参数校验、Promise 主语义、共享文件进度回调副语义与统一错误模型用例
- [X] T060 [P] [US4] 在 `tests/integration/group-manager/group-manager.integration.test.ts` 增加公告、共享文件、成员属性高阶能力的集成用例
- [X] T061 [P] [US4] 在 `tests/types/group-manager-types.test.ts` 增加高阶 API 类型签名、共享文件对象与成员属性返回模型回归
- [X] T062 [US4] 在 `specs/027-group-manager-api/tasks.md` 记录本期不新增“群共享文件/公告”E2E 的依据（当前无 demo 群高阶功能入口，主风险不在浏览器交互层）

### Implementation for User Story 4

- [X] T063 [US4] 在 `src/rest/group-management.ts`、`src/managers/group/group.ts` 实现 `group.getAnnouncement()`、`group.updateAnnouncement()`、`group.getSharedFileList()`、`group.uploadSharedFile()`、`group.deleteSharedFile()`、`group.downloadSharedFile()`
- [X] T064 [US4] 在 `src/rest/group-management.ts`、`src/managers/group/group.ts`、`src/types/group.ts` 实现 `group.setMemberAttributes()`、`group.getMembersAttributes()` 与高阶能力相关类型
- [X] T065 [US4] 在 `src/managers/group/group-normalizers.ts` 实现公告、共享文件与成员属性结果的归一化
- [X] T066 [US4] 在 `docs/reference/RESTful-API-Body-Formats.md`、`docs/reference/group-manager-api.md` 更新高阶群能力的请求体、返回体与迁移对照
- [X] T067 [US4] 在 `specs/027-group-manager-api/contracts/group-manager.openapi.yaml`、`specs/027-group-manager-api/quickstart.md` 记录高阶 endpoint 的真实响应缺口与 fixture 补齐要求

**Checkpoint**: US4 可独立完成“高阶群能力命名/返回/文档语义一致”闭环

备注：本期不新增“群共享文件/公告”E2E。当前 demo 无群高阶功能入口，高风险集中在 REST 组装、对象化归一化与 Promise/进度回调语义，不在浏览器交互层。

---

## Phase 6A: Group 对象化 API 收口（Spec 调整后新增）

**Purpose**: 把 027 从“所有能力挂在 GroupManager”调整为“GroupManager 入口 + Group 单群对象”的混合公开面，并同步收口文档与测试

- [X] T074 [P] 在 `tests/types/group-manager-types.test.ts` 增加 `groupManager.getGroup(groupId): Group`、列表继续返回 `GroupSummary[]`、`Group` 单群方法签名回归
- [X] T075 [P] 在 `tests/unit/managers/group-manager.test.ts`、`tests/unit/managers/group.test.ts` 增加 `getGroup`、Group/Manager 职责边界、方法委托与参数校验用例
- [X] T076 [P] 在 `tests/integration/group-manager/group-manager.integration.test.ts` 增加 `getGroup(groupId)` 后通过 `group.getMembers()`、`group.getAdmins()`、`group.getAnnouncement()` 等单群路径调用的集成用例
- [X] T077 在 `src/types/group.ts`、`src/managers/group/group.ts`、`src/managers/group-manager.ts`、`src/index.ts` 实现 `Group` 公开类型、轻量对象与 `getGroup(groupId)` 入口
- [X] T078 在 `src/managers/group/group.ts`、`src/managers/group-manager.ts` 把成员、管理员、黑名单、allowlist、禁言、公告、共享文件、成员属性、单群 mutation 等方法收敛到 `Group` 对象，并处理过渡期委托或兼容策略
- [X] T079 在 `docs/reference/group-manager-api.md`、`docs/reference/api.md`、相关 JSDoc 中隐藏属于 `Group` 的方法，不再在 GroupManager 对外 API 文档里列出这些方法，并补充 `Group` 的推荐用法

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、验证与发布

- [X] T068 [P] 对齐 027 文档术语、测试层说明与 E2E 不新增依据于 `specs/027-group-manager-api/spec.md`、`specs/027-group-manager-api/plan.md`、`specs/027-group-manager-api/tasks.md`
- [X] T069 [P] 回填 `specs/027-group-manager-api/quickstart.md` 的实测结果、真实样例到位情况、已知限制与 fixture 使用说明
- [X] T070 执行 `npm run test:run -- tests/unit/managers/group-manager.test.ts tests/unit/rest/group-management.test.ts tests/unit/group/group-event-mapper.test.ts tests/unit/group/group-event-user-info-resolver.test.ts tests/unit/protocol/msync-muc-notify.test.ts tests/unit/core/message/message-receiver-group.test.ts tests/integration/group-manager/group-manager.integration.test.ts tests/integration/group-manager/group-events.integration.test.ts tests/integration/mock/manager-public-api.test.ts tests/contract/group-manager.contract.test.ts tests/types/group-manager-types.test.ts` 并记录输出到 `specs/027-group-manager-api/quickstart.md`
- [X] T071 执行 `npm run lint`、`npm run type-check`、`npm run docs:api:check`、`npm run test:gate:pr` 并记录 027 相关结果到 `specs/027-group-manager-api/quickstart.md`
- [X] T072 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [X] T073 基于 `specs/027-group-manager-api/`、`src/`、`tests/`、`docs/` 提交 027 实现变更（不 push）
- [X] T080 对齐 027 最终文档与生成型 API site，确保 GroupManager 页面不再展示属于 `Group` 的方法，并记录到 `specs/027-group-manager-api/quickstart.md`

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
- **US3 (P1)**: Phase 2 后可开始；依赖群事件类型和协议解码基础，但可与 US1/US2 并行推进
- **US4 (P2)**: Phase 2 后可开始；高阶 API 与 US1 共享 REST/manager 基础，可在主路径稳定后补齐

### Within Each User Story

- 先完成故事级测试任务并验证失败预期
- 再实现 REST 适配、公开类型与 manager 方法
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
Task: "T021 tests/contract/group-manager.contract.test.ts"
Task: "T022 tests/unit/rest/group-management.test.ts"
Task: "T023 tests/unit/managers/group-manager.test.ts"
Task: "T025 tests/types/group-manager-types.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T032 tests/unit/group/group-event-user-info-resolver.test.ts"
Task: "T033 tests/unit/managers/group-manager.test.ts"
Task: "T034 tests/integration/group-manager/group-manager.integration.test.ts"
Task: "T035 tests/contract/group-manager.contract.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T043 tests/unit/group/group-event-mapper.test.ts"
Task: "T045 tests/unit/protocol/msync-muc-notify.test.ts"
Task: "T046 tests/unit/core/message/message-receiver-group.test.ts"
Task: "T048 tests/types/group-manager-types.test.ts"
```

## Parallel Example: User Story 4

```bash
Task: "T057 tests/contract/group-manager.contract.test.ts"
Task: "T058 tests/unit/rest/group-management.test.ts"
Task: "T060 tests/integration/group-manager/group-manager.integration.test.ts"
Task: "T066 docs/reference/RESTful-API-Body-Formats.md"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（公开入口、核心 API、命名迁移）
3. **STOP and VALIDATE**：仅验证 US1 独立通过
4. 通过后再推进对象化返回与事件系统

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（群组主 API 迁移）
3. 交付 US2（对象化用户返回）
4. 交付 US3（群事件迁移与标准化）
5. 交付 US4（高阶群能力统一）
6. 收尾发布（Phase 7）

### Parallel Team Strategy

- 开发 A：US1（核心 REST 适配、GroupManager 主 API、公开入口）
- 开发 B：US2（用户资料补齐、对象化结果、相关集成测试）
- 开发 C：US3（MUC 解码、事件映射、事件派发链路）
- 开发 D：US4（公告/共享文件/成员属性高阶接口与文档）

---

## Notes

- 所有任务均遵循 `- [ ] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段均带 `[USx]` 标签，便于追踪与独立验收
- 本期 E2E 通过显式记录“不新增”依据满足 spec 的测试分层要求
- 群列表/详情、管理员列表、禁言列表、黑名单、allowlist、公告、共享文件列表、成员属性读取等真实样例到位前，不应拍板最终 REST 解析字段
- 每轮实现完成后按规则更新版本号、CHANGELOG 并提交 commit
