---
description: '031 消息驱动的用户资料补位与群名片同步任务清单'
---

# Tasks: 消息驱动的用户资料补位与群名片同步

**Input**: 设计文档来自 `/specs/031-message-profile-sync/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、集成测试、契约/逻辑回归、类型回归；E2E 需复用浏览器 `send-receive` smoke，若某个故事不新增 E2E，必须在任务中明确说明依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US3]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 031 所需的协议、补位模块、缓存与测试骨架

- [X] T001 创建 profile-sync 模块骨架 `src/core/message/profile-sync/profile-version-sidecar.ts`、`src/core/message/profile-sync/user-info-hydrator.ts`、`src/core/message/profile-sync/user-info-hydration-queue.ts`、`src/core/message/profile-sync/group-namecard-hydrator.ts`、`src/core/message/profile-sync/group-namecard-hydration-queue.ts`、`src/core/message/profile-sync/latest-message-version-projector.ts`
- [X] T002 创建群名片缓存骨架 `src/cache/group-namecard-cache.ts`
- [ ] T003 [P] 创建协议与接收链路单测骨架 `tests/unit/protocol/msync-message-profile-sync.test.ts`、`tests/unit/core/message/message-receiver-profile-sync.test.ts`
- [X] T004 [P] 创建用户资料与群名片队列单测骨架 `tests/unit/core/message/user-info-hydration-queue.test.ts`、`tests/unit/core/message/group-namecard-hydration-queue.test.ts`
- [ ] T005 [P] 创建缓存单测骨架 `tests/unit/cache/group-namecard-cache.test.ts`、`tests/unit/cache/conversation-cache-profile-sync.test.ts`
- [ ] T006 [P] 创建消息资料同步集成测试骨架 `tests/integration/message-profile-sync/message-profile-sync.integration.test.ts`
- [ ] T007 [P] 创建消息资料同步契约/逻辑测试骨架 `tests/contract/message-profile-sync.contract.test.ts`
- [ ] T008 [P] 创建消息资料同步类型回归骨架 `tests/types/message-profile-sync-types.test.ts`
- [ ] T009 [P] 在 `tests/e2e/send-receive.spec.ts` 预留 031 的 send/receive smoke 场景占位

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的开关配置、缓存模型、事件类型与协议基础

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [X] T010 在 `src/config/timeouts.ts` 增加用户资料补拉窗口、群名片补拉窗口与群名片跨群并行度默认配置
- [X] T011 [P] 在 `src/config/cache.ts` 定义群名片缓存数量、淘汰阈值与热点保留相关配置常量
- [X] T012 在 `src/cache/cache-keys.ts`、`src/cache/cache-types.ts` 扩展 `UserInfoSummary` 内部版本元数据、`GroupNamecardCacheRecord` 与 `MessageSnippet` 版本字段投影
- [X] T013 [P] 在 `src/cache/group-namecard-cache.ts` 实现基础装载、按 `groupId + userId` 读写、TTL/LRU 淘汰与纯度校验
- [X] T014 在 `src/cache/cache-manager.ts`、`src/cache/index.ts` 接入群名片缓存的 load/flush/evict 主路径
- [X] T015 [P] 在 `src/types/event-system.ts`、`src/types/user-info.ts`、`src/types/group.ts` 补齐 `onSelfUserInfoUpdated`、`onUserInfoUpdated`、`onUserGroupNamecardUpdated` 的 payload 与 listener 类型
- [ ] T016 [P] 在 `src/types/chat-client.ts`、`src/validators/chat-client.ts`、`src/chat-client.ts` 增加 `enableUserInfoSync` 配置、默认值归一化与仅开启时生效的 profile sync 总开关
- [X] T017 在 `src/protocol/msync/proto-source.json`、`src/protocol/msync/proto.ts`、`src/protocol/msync/types.ts` 为 `MessageBody` 增加 `userInfoUpdateTime` 与 `namecardUpdateTime`
- [ ] T018 [P] 在 `tests/types/message-profile-sync-types.test.ts` 增加 `InitConfig.enableUserInfoSync`、公开 `Message` 不暴露内部版本字段、三个对外事件签名稳定的基础回归

**Checkpoint**: 031 共享基础能力就绪，用户故事可并行推进

---

## Phase 3: User Story 1 - 接收消息时按版本戳异步补齐发送者资料（Priority: P1） 🎯 MVP

**Goal**: 在 `enableUserInfoSync=true` 时，实现用户资料版本戳的接收、缓存优先 hydrated view、异步批量补拉、缓存写回与 `onSelfUserInfoUpdated` / `onUserInfoUpdated` 事件闭环；在 `enableUserInfoSync=false` 时保持消息主链路可用且整条资料同步链路静默

**Independent Test**: 构造“本地资料已新”“本地资料落后但已有旧值”“本地资料缺失”“补拉部分成功/失败”“冷启动重载消息与实时消息同时命中”“`enableUserInfoSync=false` 静默”场景，验证消息主链路、用户资料队列、缓存写回和对外事件均独立成立

### Tests for User Story 1

- [ ] T019 [P] [US1] 在 `tests/unit/protocol/msync-message-profile-sync.test.ts` 增加 `userInfoUpdateTime` 的编解码、秒级语义、`enableUserInfoSync=false` 时不挂载版本字段与公开 `Message` 隔离用例
- [ ] T020 [P] [US1] 在 `tests/unit/core/message/message-receiver-profile-sync.test.ts` 增加“本地旧资料优先展示”“本地缺失回退最小身份信息”“补拉成功后不直接修改当前消息对象”“`enableUserInfoSync=false` 时接收侧静默”的接收链路用例
- [X] T021 [P] [US1] 在 `tests/unit/core/message/user-info-hydration-queue.test.ts` 增加 `userId` 去重、最大 `userInfoUpdateTime` 收敛、默认 20 阈值、默认 7 秒窗口与可配置覆盖用例
- [ ] T022 [P] [US1] 在 `tests/unit/managers/user-info-manager-fetch.test.ts`、`tests/unit/managers/user-info-manager-update.test.ts` 增加“先写缓存再发 `onUserInfoUpdated/onSelfUserInfoUpdated`”“当前用户更新后仅在开关开启时下一条消息携带最新版本”的用例
- [ ] T023 [P] [US1] 在 `tests/integration/message-profile-sync/message-profile-sync.integration.test.ts` 增加 `enableUserInfoSync=true/false` 两种模式下的 mSync 解码 -> message-receiver -> UserInfoManager -> CacheManager -> `onUserInfoUpdated/onSelfUserInfoUpdated` 整链路集成用例
- [ ] T024 [P] [US1] 在 `tests/contract/message-profile-sync.contract.test.ts` 增加用户资料补拉部分成功、事件拆分派发与缓存写回先后顺序的逻辑契约用例
- [ ] T025 [P] [US1] 在 `tests/types/message-profile-sync-types.test.ts` 增加 `onSelfUserInfoUpdated` / `onUserInfoUpdated` 的 listener 参数回归、`InitConfig.enableUserInfoSync` 类型声明与 `Message` 类型不透出内部字段的类型回归
- [ ] T026 [P] [US1] 在 `tests/e2e/send-receive.spec.ts` 复用 send/receive smoke，验证 `enableUserInfoSync=true` 时异步资料补位不会破坏浏览器端消息主链路，`enableUserInfoSync=false` 时消息主链路仍然成立

### Implementation for User Story 1

- [ ] T027 [US1] 在 `src/protocol/msync/codec.ts`、`src/core/message/profile-sync/profile-version-sidecar.ts` 解码并提取 `userInfoUpdateTime` sidecar metadata，并确保发送侧仅在 `enableUserInfoSync=true` 时挂载
- [ ] T028 [US1] 在 `src/core/message/profile-sync/user-info-hydration-queue.ts` 实现用户资料待补拉队列、窗口/阈值配置与冷启动/实时消息统一去重
- [ ] T029 [US1] 在 `src/core/message/profile-sync/user-info-hydrator.ts` 实现 cache-first 查找、最小身份信息兜底、批量补拉、部分成功收敛与事件分发，并在开关关闭时保持整条链路静默
- [ ] T030 [US1] 在 `src/core/message/message-receiver.ts`、`src/chat-client.ts` 接入 `enableUserInfoSync` 控制下的用户资料版本比较、旧 `senderInfo` 复用与异步入队，不阻塞消息派发
- [ ] T031 [US1] 在 `src/cache/user-info-cache.ts`、`src/cache/cache-types.ts` 持久化 `userInfoUpdateTime` 与必要同步元数据
- [ ] T032 [US1] 在 `src/managers/user-info-manager.ts`、`src/chat-client.ts` 接入当前用户资料主动更新后的缓存回写、仅开关开启时的下一条消息版本携带与 `onSelfUserInfoUpdated/onUserInfoUpdated` 派发顺序

**Checkpoint**: US1 可独立完成“消息驱动的用户资料补位 + cache-first 展示 + 事件闭环”闭环

---

## Phase 4: User Story 2 - 群聊中的群名片按群维度独立更新并发布事件（Priority: P1）

**Goal**: 在 `enableUserInfoSync=true` 时，实现群消息里的 `namecardUpdateTime`、按 `groupId + userId` 去重的群名片补拉、同群串行/跨群并行调度、缓存写回与 `onUserGroupNamecardUpdated` 事件闭环；在 `enableUserInfoSync=false` 时保持群消息主链路可用且群名片同步链路静默

**Independent Test**: 构造“同一群多用户命中”“不同群并行命中”“当前用户自己的群名片更新”“部分成功/失败”“冷启动重载群消息与实时群消息同时命中”“`enableUserInfoSync=false` 静默”场景，验证群名片缓存、调度、事件顺序与消息对象不直接回填的语义

### Tests for User Story 2

- [ ] T033 [P] [US2] 在 `tests/unit/protocol/msync-message-profile-sync.test.ts` 增加 `namecardUpdateTime` 的编解码、群消息限定生效、`enableUserInfoSync=false` 时不挂载与聊天室/单聊不参与的用例
- [X] T034 [P] [US2] 在 `tests/unit/core/message/group-namecard-hydration-queue.test.ts` 增加 `groupId + userId` 去重、最大 `namecardUpdateTime` 收敛、同群串行、跨群并行默认 5 且可配置的用例
- [X] T035 [P] [US2] 在 `tests/unit/cache/group-namecard-cache.test.ts` 增加“仅保存 `groupId/userId/namecard` + 内部元数据”“不混入头像昵称”“整体替换写回”的用例
- [ ] T036 [P] [US2] 在 `tests/unit/chat-client/group-events.test.ts`、`tests/unit/core/message/message-receiver-group.test.ts` 增加 `onUserGroupNamecardUpdated` 只对他人触发、按处理顺序依次触发、不直接改消息对象与 `enableUserInfoSync=false` 时静默的用例
- [ ] T037 [P] [US2] 在 `tests/integration/message-profile-sync/message-profile-sync.integration.test.ts` 增加 `enableUserInfoSync=true/false` 两种模式下的群消息 -> 群名片补拉 -> 群名片缓存 -> `onUserGroupNamecardUpdated` 整链路集成用例
- [ ] T038 [P] [US2] 在 `tests/contract/message-profile-sync.contract.test.ts` 增加群名片部分成功、当前用户自己不触发事件与顺序派发的逻辑契约用例
- [ ] T039 [US2] [US2] 在 `specs/031-message-profile-sync/tasks.md` 记录本期不新增群消息 E2E 的依据（当前 `tests/e2e/send-receive.spec.ts` 以单聊 smoke 为主，群名片核心风险已由单元+集成+契约覆盖）

### Implementation for User Story 2

- [ ] T040 [US2] 在 `src/core/message/profile-sync/group-namecard-hydration-queue.ts` 实现群名片窗口队列、同群串行、跨群并行调度与顺序派发控制，并在开关关闭时不启动任务
- [ ] T041 [US2] 在 `src/core/message/profile-sync/group-namecard-hydrator.ts` 实现按群补拉、部分成功收敛、当前用户自己过滤与 `onUserGroupNamecardUpdated` 派发，并在开关关闭时保持静默
- [ ] T042 [US2] 在 `src/core/message/message-receiver.ts`、`src/core/message/profile-sync/profile-version-sidecar.ts` 接入 `enableUserInfoSync` 控制下的群消息 `namecardUpdateTime` 比较与异步入队
- [ ] T043 [US2] 在 `src/rest/group-management.ts`、`src/managers/group-manager.ts` 接入群成员属性读取、当前用户主动更新群名片后的本端缓存回写与仅开关开启时的下一条群消息版本携带
- [ ] T044 [US2] 在 `src/cache/group-namecard-cache.ts`、`src/cache/cache-manager.ts` 完成群名片持久化、装载与配额回退主路径
- [ ] T045 [US2] 在 `src/types/event-system.ts`、`src/types/group.ts` 收敛 `onUserGroupNamecardUpdated` 的公开 payload 与仅他人触发的语义

**Checkpoint**: US2 可独立完成“群名片版本同步 + 群维度缓存 + 单用户事件派发”闭环

---

## Phase 5: User Story 3 - 热点资料在 Web 与小程序环境中都能稳定缓存（Priority: P1）

**Goal**: 让用户资料与群名片缓存继续复用现有缓存层和过期淘汰策略，并在冷启动重载消息、配额回退、跨平台存储适配下保持稳定一致；同时保证 `enableUserInfoSync=false` 时不会误触发消息驱动的缓存同步语义

**Independent Test**: 构造“冷启动重载消息补位”“localStorage 配额回退”“自己/联系人/最近活跃用户保留”“非浏览器环境不依赖 `URL` / 原生 `localStorage`”“`enableUserInfoSync=false` 时无消息驱动同步副作用”场景，验证缓存淘汰、会话摘要版本投影与跨平台语义均独立成立

### Tests for User Story 3

- [ ] T046 [P] [US3] 在 `tests/unit/cache/cache-manager.test.ts`、`tests/unit/cache/cache-eviction.test.ts` 增加“自己/联系人/最近活跃用户优先保留”“群名片缓存与用户资料缓存共存”的淘汰策略用例
- [ ] T047 [P] [US3] 在 `tests/unit/cache/conversation-cache-profile-sync.test.ts` 增加群会话保留 `userInfoUpdateTime + namecardUpdateTime`、单聊只保留 `userInfoUpdateTime` 与冷启动恢复版本投影的用例
- [ ] T048 [P] [US3] 在 `tests/integration/cache/local-storage-quota.test.ts`、`tests/integration/message-profile-sync/message-profile-sync.integration.test.ts` 增加配额回退、冷启动重载消息补位与“只更新本轮新加载消息”的集成用例
- [ ] T049 [P] [US3] 在 `tests/unit/core/message/message-receiver-profile-sync.test.ts` 增加冷启动重载消息与实时消息进入同一补拉队列、按最大版本统一去重以及 `enableUserInfoSync=false` 时不入队的用例
- [ ] T050 [P] [US3] 在 `tests/unit/cache/cache-store.test.ts`、`tests/integration/miniapp-demo/init-login.integration.test.ts` 增加新模块不直接依赖原生 `localStorage` / `URL` 的跨平台适配回归
- [ ] T051 [US3] [US3] 在 `specs/031-message-profile-sync/tasks.md` 记录本期不新增小程序自动化 E2E 的依据（当前自动化 E2E 基础设施仍以浏览器为主，小程序路径由集成测试与手工验收清单兜底）

### Implementation for User Story 3

- [ ] T052 [US3] 在 `src/cache/cache-manager.ts`、`src/cache/cache-eviction.ts`、`src/config/cache.ts` 实现用户资料/群名片热点保留、TTL/LRU 淘汰与配额回退策略
- [ ] T053 [US3] 在 `src/cache/cache-types.ts`、`src/cache/conversation-cache.ts`、`src/core/message/profile-sync/latest-message-version-projector.ts` 实现会话摘要版本字段投影
- [ ] T054 [US3] 在 `src/chat-client.ts`、`src/core/message/profile-sync/user-info-hydration-queue.ts`、`src/core/message/profile-sync/group-namecard-hydration-queue.ts` 接入冷启动重载消息与实时消息共享队列的恢复主路径，并确保开关关闭时不进入恢复后的消息驱动同步链路
- [ ] T055 [US3] 在 `src/cache/cache-store.ts`、`src/core/message/profile-sync/` 约束新补位模块只通过现有存储抽象读写，不直接依赖 `URL` 或原生 `localStorage`
- [ ] T056 [US3] 在 `src/cache/cache-types.ts`、`src/cache/group-namecard-cache.ts`、`src/cache/user-info-cache.ts` 完成群名片缓存与用户资料缓存的持久化元数据收口

**Checkpoint**: US3 可独立完成“热点缓存稳定性 + 冷启动补位 + 跨平台适配”闭环

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、验证与发布

- [ ] T057 [P] 对齐 031 文档术语、测试分层说明与不新增 E2E 的依据于 `specs/031-message-profile-sync/spec.md`、`specs/031-message-profile-sync/plan.md`、`specs/031-message-profile-sync/tasks.md`
- [ ] T058 [P] 产出并回填 `specs/031-message-profile-sync/research.md`、`specs/031-message-profile-sync/data-model.md`、`specs/031-message-profile-sync/contracts/message-profile-sync.contract.yaml`、`specs/031-message-profile-sync/quickstart.md`
- [ ] T059 执行 `npm run test:run -- tests/unit/protocol/msync-message-profile-sync.test.ts tests/unit/core/message/message-receiver-profile-sync.test.ts tests/unit/core/message/user-info-hydration-queue.test.ts tests/unit/core/message/group-namecard-hydration-queue.test.ts tests/unit/cache/group-namecard-cache.test.ts tests/unit/cache/conversation-cache-profile-sync.test.ts tests/integration/message-profile-sync/message-profile-sync.integration.test.ts tests/contract/message-profile-sync.contract.test.ts tests/types/message-profile-sync-types.test.ts tests/e2e/send-receive.spec.ts` 并记录结果到 `specs/031-message-profile-sync/quickstart.md`
- [ ] T060 执行 `npm run lint`、`npm run type-check`、`npm run docs:api:check`、`npm run test:gate:pr` 并记录 031 相关结果到 `specs/031-message-profile-sync/quickstart.md`
- [ ] T061 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [ ] T062 基于 `specs/031-message-profile-sync/`、`src/`、`tests/` 提交 031 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-5 (User Stories)**: 依赖 Phase 2 完成；可并行或按优先级推进
- **Phase 6 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: Phase 2 后可开始；共享协议与缓存基础，但群名片链路可独立验证
- **US3 (P1)**: Phase 2 后可开始；依赖缓存模型与队列基础，但冷启动/跨平台路径可独立验证

### Within Each User Story

- 单元/集成/E2E 任务必须与 `spec.md` 的测试分层要求对齐；如果某层不新增，必须保留明确依据
- 优先完成故事级测试任务并验证失败预期
- 再实现协议/缓存/协调器/事件链路
- 最后执行故事级独立验证

### Parallel Opportunities

- Phase 1、2 中所有标记 `[P]` 的任务可并行
- Phase 2 完成后，US1/US2/US3 的测试任务可并行推进
- US1 的协议编解码、用户资料队列与接收链路测试可并行
- US2 的群名片队列、缓存与事件顺序测试可并行
- US3 的缓存淘汰、会话摘要投影与跨平台适配回归可并行

---

## Parallel Example: User Story 1

```bash
Task: "T019 tests/unit/protocol/msync-message-profile-sync.test.ts"
Task: "T020 tests/unit/core/message/message-receiver-profile-sync.test.ts"
Task: "T021 tests/unit/core/message/user-info-hydration-queue.test.ts"
Task: "T025 tests/types/message-profile-sync-types.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T034 tests/unit/core/message/group-namecard-hydration-queue.test.ts"
Task: "T035 tests/unit/cache/group-namecard-cache.test.ts"
Task: "T036 tests/unit/chat-client/group-events.test.ts"
Task: "T038 tests/contract/message-profile-sync.contract.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T046 tests/unit/cache/cache-manager.test.ts"
Task: "T047 tests/unit/cache/conversation-cache-profile-sync.test.ts"
Task: "T049 tests/unit/core/message/message-receiver-profile-sync.test.ts"
Task: "T050 tests/unit/cache/cache-store.test.ts"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（用户资料版本字段、接收侧补位、事件闭环）
3. **STOP and VALIDATE**：仅验证 US1 独立通过
4. 通过后再推进群名片与缓存稳定性

### Incremental Delivery

1. 完成 Setup + Foundational，建立开关、协议、缓存、事件与补位基础
2. 交付 US1，确保单聊/全局用户资料补位主路径与 `enableUserInfoSync=false` 静默语义同时成立
3. 交付 US2，补齐群名片同步、按群缓存与事件链路，并覆盖开关关闭场景
4. 交付 US3，收尾冷启动、配额回退与跨平台缓存稳定性，同时确认开关关闭无副作用
5. 最后执行验证、版本号与 CHANGELOG 收尾

### Parallel Team Strategy

- 开发 A：US1（用户资料协议、接收链路、用户资料队列与事件）
- 开发 B：US2（群名片队列、群名片缓存、群事件派发）
- 开发 C：US3（缓存淘汰、会话摘要投影、冷启动与跨平台适配）

---

## Notes

- 所有任务都遵循 `- [ ] Txxx [P] [USx] 描述 + 路径` 规范
- 用户故事阶段均带 `[USx]` 标签，便于独立验收与并行实现
- 031 的浏览器 E2E 通过复用 `tests/e2e/send-receive.spec.ts` 完成；群名片与小程序路径通过显式“不新增”任务记录依据
- 当前 feature 目录还缺 `research.md`、`data-model.md`、`contracts/`、`quickstart.md`，本任务清单已在收尾阶段预留产出与回填任务
- 实现完成后需按仓库规则更新版本号、CHANGELOG 并提交中文 commit
