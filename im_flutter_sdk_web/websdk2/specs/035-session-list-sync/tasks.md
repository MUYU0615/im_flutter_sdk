---
description: '035 会话列表同步与 SessionItem 实现任务清单'
---

# Tasks: 会话列表同步与 SessionItem

**Input**: 设计文档来自 `/specs/035-session-list-sync/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、集成测试、E2E 测试；demo 主路径变更必须纳入浏览器验证  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US3]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 035 所需类型、缓存、同步模块、demo 与测试骨架

- [X] T001 创建 session-list 领域目录与文件骨架 `src/core/session-list-sync/session-list-sync-controller.ts`、`src/core/session-list-sync/session-list-sync-session.ts`、`src/core/session-list-sync/session-list-sync-types.ts`、`src/core/session-list-sync/session-list-sync-normalizer.ts`、`src/core/session-list-sync/session-list-sync-merge.ts`
- [X] T002 [P] 创建 session-list 协议目录与骨架 `src/protocol/session-list/codec.ts`、`src/protocol/session-list/types.ts`、`src/protocol/session-list/gateway.ts`
- [X] T003 [P] 创建 session-list 专用缓存骨架 `src/cache/session-list-cache.ts`
- [X] T004 [P] 在 `src/types/conversation.ts`、`src/types/chat-manager.ts`、`src/types/event-system.ts` 创建 `SessionItem`、`SessionMessageSnippet`、`SessionListRemindType` 与同步事件类型骨架
- [X] T005 [P] 创建新 demo 面板骨架 `demo/src/components/SessionListPanel.tsx`
- [X] T006 [P] 创建 session-list 单元测试骨架 `tests/unit/session-list-sync/session-list-sync-controller.test.ts`、`tests/unit/session-list-sync/session-item-normalizer.test.ts`、`tests/unit/cache/session-list-cache.test.ts`、`tests/unit/managers/chat-manager-session-list.test.ts`
- [X] T007 [P] 创建 session-list 集成测试骨架 `tests/integration/session-list-sync/session-list-sync.integration.test.ts`、`tests/integration/session-list-sync/session-list-fallback.integration.test.ts`、`tests/integration/session-list-sync/session-list-msync-merge.integration.test.ts`
- [X] T008 [P] 创建 session-list 协议测试骨架 `tests/unit/protocol/session-list-codec.test.ts`
- [X] T009 [P] 创建浏览器 E2E 骨架 `tests/e2e/session-list.spec.ts`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的类型、缓存、事件、导出与同步基础

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [X] T010 在 `src/types/conversation.ts` 定义 `SessionItem`、`SessionMessageSnippet`、`SessionListRemindType` 与公开字段注释
- [X] T011 [P] 在 `src/types/event-system.ts`、`src/types/chat-manager.ts` 定义 `onSyncDataStart` / `onSyncDataFinished` handler 签名，并接入 `ChatEventHandlerMap`
- [X] T012 [P] 在 `src/index.ts` 导出 `SessionItem`、`SessionMessageSnippet`、`SessionListRemindType`
- [X] T013 [P] 在 `src/cache/cache-types.ts` 增加 session-list 缓存记录、checkpoint、capability state 与 `SessionItem` 映射类型
- [X] T014 [P] 在 `src/cache/cache-keys.ts` 增加 session-list 专用 cache key 与 `sessions_last_sync_ts` key
- [X] T015 在 `src/cache/session-list-cache.ts` 实现 session-list 专用缓存读写、排序、覆盖删除与 checkpoint 读写骨架
- [X] T016 [P] 在 `src/cache/cache-manager.ts` 接入 session-list 专用缓存生命周期与按用户隔离的持久化入口
- [X] T017 [P] 在 `src/protocol/session-list/types.ts`、`src/protocol/session-list/gateway.ts` 定义 WSS request/response、批次字段、协议层数值枚举与公开枚举映射
- [X] T018 [P] 在 `src/protocol/session-list/codec.ts` 实现 session-list 协议编码/解码基础能力
- [X] T019 在 `src/core/session-list-sync/session-list-sync-types.ts` 定义 controller/session 上下文、request_id、batch 去重、终态与错误分支类型
- [X] T020 [P] 在 `tests/unit/protocol/session-list-codec.test.ts` 增加 `session_type`、`remindType`、batch 字段与 request/response 编解码基础测试
- [X] T021 [P] 在 `tests/unit/cache/session-list-cache.test.ts` 增加 session-list checkpoint、排序与覆盖删除基础测试
- [X] T022 [P] 在 `tests/unit/managers/chat-manager-session-list.test.ts` 增加 `getSessionList`、`refreshSessionList`、事件签名与 Promise 复用基础测试

**Checkpoint**: 035 共享基础能力就绪，用户故事可并行推进

---

## Phase 3: User Story 1 - 登录后优先同步新会话列表并提供稳定读取入口（Priority: P1） 🎯 MVP

**Goal**: 在 `ChatManager` 上提供 `getSessionList()` / `refreshSessionList()`，登录后优先进行新会话列表同步，并把结果稳定映射为 `SessionItem`

**Independent Test**: 登录后在支持新链路场景下先完成新会话列表同步，再通过 `getSessionList()` 读到新缓存；主动调用 `refreshSessionList()` 时可获得统一 `SessionItem[]` 结果

### Tests for User Story 1

- [X] T023 [P] [US1] 在 `tests/unit/session-list-sync/session-item-normalizer.test.ts` 增加 `conversationName/conversationAvatar`、`lastMessage.from/to/sender`、`readAt`、`SessionListRemindType` 归一化测试
- [X] T024 [P] [US1] 在 `tests/unit/managers/chat-manager-session-list.test.ts` 增加 `getSessionList()` 纯读缓存、`refreshSessionList()` 走同步服务、重复调用复用 Promise 测试
- [X] T025 [P] [US1] 在 `tests/integration/session-list-sync/session-list-sync.integration.test.ts` 增加登录后“先会话列表同步，再好友同步/消息调度”的集成用例
- [X] T026 [P] [US1] 在 `tests/integration/session-list-sync/session-list-sync.integration.test.ts` 增加“服务端返回空快照/无变化”时仍形成 `start -> finish` 闭环且不清空本地列表的集成用例

### Implementation for User Story 1

- [X] T027 [US1] 在 `src/core/session-list-sync/session-list-sync-normalizer.ts` 实现协议快照与旧会话列表到 `SessionItem` 的归一化逻辑
- [ ] T028 [US1] 在 `src/core/session-list-sync/session-list-sync-merge.ts` 实现排序保持、完整快照覆盖、删除本地多余会话与最小 message snippet 组装
- [X] T029 [US1] 在 `src/cache/session-list-cache.ts` 实现 session-list 真相缓存、checkpoint 持久化与 `getSessionList` 读取能力
- [X] T030 [US1] 在 `src/core/session-list-sync/session-list-sync-controller.ts` 实现新链路成功后的批次收集、终态提交与 `SessionItem[]` 返回
- [X] T031 [US1] 在 `src/managers/chat-manager.ts` 新增 `getSessionList()`、`refreshSessionList()` 与同步事件接线
- [X] T032 [US1] 在 `src/chat-client.ts` 接入登录后 session-list 同步前置步骤，并保证后续好友同步与消息调度按顺序继续

**Checkpoint**: US1 可独立完成“登录后优先同步 + 新会话列表读取 + 稳定 SessionItem 结果”闭环

---

## Phase 4: User Story 2 - 新会话列表失败时仅回退旧列表逻辑（Priority: P1）

**Goal**: 在未配置、服务端不支持或同步失败时，仅会话列表能力回退旧逻辑，且同一登录周期内不重复探测不支持的新链路

**Independent Test**: 在未配置、明确 unsupported、同步失败、重复 refresh 调用场景下，仅会话列表回退旧逻辑，好友同步与漫游消息链路不受影响

### Tests for User Story 2

- [X] T033 [P] [US2] 在 `tests/unit/session-list-sync/session-list-sync-controller.test.ts` 增加未配置、unsupported、`RATE_LIMIT`、`SYNC_IN_PROGRESS`、`DATA_VERSION_MISMATCH` 分支测试
- [X] T034 [P] [US2] 在 `tests/unit/managers/chat-manager-session-list.test.ts` 增加“同一登录周期已确认 unsupported 后不重复探测”与“重复 refresh 复用同一个 Promise”测试
- [X] T035 [P] [US2] 在 `tests/integration/session-list-sync/session-list-fallback.integration.test.ts` 增加未配置/unsupported/同步失败仅回退会话列表而不阻断 024/漫游调度的集成用例
- [X] T036 [P] [US2] 在 `tests/integration/session-list-sync/session-list-fallback.integration.test.ts` 增加回退后仍返回统一 `SessionItem` 结构的集成用例

### Implementation for User Story 2

- [X] T037 [US2] 在 `src/core/session-list-sync/session-list-sync-controller.ts` 实现 capability state、unsupported/unconfigured 登录周期探测缓存与 direct fallback 判定
- [X] T038 [US2] 在 `src/core/session-list-sync/session-list-sync-controller.ts` 实现 `INVALID_TOKEN`、`KICKED`、`RATE_LIMIT`、`SYNC_IN_PROGRESS`、`DATA_VERSION_MISMATCH` 错误处理与回退/重试策略
- [X] T039 [US2] 在 `src/core/session-list-sync/session-list-sync-session.ts` 实现 request_id、batch 去重、在途任务复用与终态控制
- [X] T040 [US2] 在 `src/managers/chat-manager.ts` 与 `src/chat-client.ts` 接入旧会话列表到 `SessionItem` 的回退映射与登录周期探测结果复用

**Checkpoint**: US2 可独立完成“新链路失败时仅本能力回退，且同一登录周期不重复探测”闭环

---

## Phase 5: User Story 3 - 对外暴露稳定的 SessionItem 展示模型并在 demo 中实际可见（Priority: P2）

**Goal**: 提供稳定的 `conversationName` / `conversationAvatar` 展示字段，处理单聊联系人投影、群名称/群头像映射，并在 demo 中并行展示新旧两套会话列表

**Independent Test**: 支持新链路与回退旧链路两种模式下，demo 都能显示 `SessionItem` 关键字段与同步日志，旧 `ConversationPanel` 不受破坏

### Tests for User Story 3

- [X] T041 [P] [US3] 在 `tests/unit/session-list-sync/session-item-normalizer.test.ts` 增加单聊联系人投影优先级、群名称/群头像到 `conversationName/conversationAvatar` 的映射测试
- [X] T042 [P] [US3] 在 `tests/integration/session-list-sync/session-list-msync-merge.integration.test.ts` 增加 WSS 同步与 MSync 新消息/删除/置顶/未读并发收敛测试
- [X] T043 [P] [US3] 在 `tests/e2e/session-list.spec.ts` 增加 demo 登录后展示新 SessionItem 面板、打印同步开始/结束日志、旧面板仍可用的浏览器用例
- [X] T044 [P] [US3] 在 `tests/e2e/session-list.spec.ts` 增加回退模式下新面板仍能显示 `SessionItem` 列表的浏览器用例

### Implementation for User Story 3

- [X] T045 [US3] 在 `src/core/session-list-sync/session-list-sync-normalizer.ts` 完善单聊联系人快照/资料缓存优先级、群名称/群头像到 `conversationName/conversationAvatar` 的归一化
- [X] T046 [US3] 在 `src/core/session-list-sync/session-list-sync-merge.ts` 实现 WSS 与 MSync 并发收敛规则：新消息、新会话、删除/退出、置顶/标记/未读、免打扰覆盖
- [X] T047 [US3] 在 `demo/src/components/SessionListPanel.tsx` 实现新 SessionItem 面板展示、刷新入口与同步日志输出
- [X] T048 [US3] 在 `demo/src/App.tsx`、`demo/src/types.ts` 接入 `SessionListPanel`，保留旧 `ConversationPanel` 并行展示

**Checkpoint**: US3 可独立完成“稳定展示模型 + MSync/WSS 收敛 + demo 实际可见”闭环

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、验证与发布

- [ ] T049 [P] 补充 `specs/035-session-list-sync/research.md`、`specs/035-session-list-sync/data-model.md`、`specs/035-session-list-sync/contracts/session-list-sync.openapi.yaml`、`specs/035-session-list-sync/quickstart.md`
- [X] T050 [P] 更新 `demo/src/components/ConversationPanel.tsx` 的说明文案，明确旧会话列表与新 SessionItem 面板并行关系
- [X] T051 执行 `npm run test:run -- tests/unit/session-list-sync tests/unit/cache/session-list-cache.test.ts tests/unit/managers/chat-manager-session-list.test.ts tests/integration/session-list-sync tests/e2e/session-list.spec.ts` 并记录结果到 `specs/035-session-list-sync/quickstart.md`
- [X] T052 执行 `npm run lint`、`npm run type-check`、`npm run test:gate:pr` 并记录与 035 相关结果到 `specs/035-session-list-sync/quickstart.md`
- [X] T053 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [ ] T054 提交 035 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-5 (User Stories)**: 依赖 Phase 2 完成；US1 与 US2 可并行推进，US3 建议在基础同步链路稳定后推进
- **Phase 6 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: 依赖 Phase 2；建议在 US1 基础链路可跑通后推进失败回退与探测缓存
- **US3 (P2)**: 依赖 Phase 2；建议在 US1/US2 的缓存、同步与回退语义稳定后补齐显示与浏览器验证

### Within Each User Story

- 先完成故事级测试任务并验证失败预期
- 再实现类型/缓存/同步控制器与公开入口
- 再接入 ChatClient / demo / 事件分发
- 最后执行故事级独立验证

### Parallel Opportunities

- Phase 1、2 所有标记 `[P]` 的任务可并行
- US1 的 normalizer/cache/manager 测试可并行
- US2 的错误码策略与 Promise 复用测试可并行
- US3 的 demo 面板实现与 MSync/WSS 收敛测试可并行
- Phase 6 的文档补充与验证记录可并行

---

## Parallel Example: User Story 1

```bash
Task: "T023 tests/unit/session-list-sync/session-item-normalizer.test.ts"
Task: "T024 tests/unit/managers/chat-manager-session-list.test.ts"
Task: "T025 tests/integration/session-list-sync/session-list-sync.integration.test.ts"
Task: "T026 tests/integration/session-list-sync/session-list-sync.integration.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T033 tests/unit/session-list-sync/session-list-sync-controller.test.ts"
Task: "T034 tests/unit/managers/chat-manager-session-list.test.ts"
Task: "T035 tests/integration/session-list-sync/session-list-fallback.integration.test.ts"
Task: "T036 tests/integration/session-list-sync/session-list-fallback.integration.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T041 tests/unit/session-list-sync/session-item-normalizer.test.ts"
Task: "T042 tests/integration/session-list-sync/session-list-msync-merge.integration.test.ts"
Task: "T043 tests/e2e/session-list.spec.ts"
Task: "T047 demo/src/components/SessionListPanel.tsx"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（`getSessionList` / `refreshSessionList` / 登录后前置同步 / `SessionItem` 归一化）
3. **STOP and VALIDATE**：仅验证 US1 独立通过
4. 通过后再推进失败回退、探测缓存与 demo 浏览器链路

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（新会话列表读取与登录后前置同步）
3. 交付 US2（失败回退、同登录周期探测缓存、Promise 复用）
4. 交付 US3（展示模型、MSync/WSS 收敛、demo 实际可见）
5. 收尾发布（Phase 6）

### Parallel Team Strategy

- 开发 A：US1（类型、缓存、ChatManager 公开面、登录编排）
- 开发 B：US2（WSS controller/session、错误策略、回退与 capability state）
- 开发 C：US3（normalizer 展示模型、demo 新面板、E2E）

---

## Notes

- 所有任务均遵循 `- [ ] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段均带 `[USx]` 标签，便于追踪与独立验收
- 每个用户故事可独立实现、独立测试、独立演示
- 本期明确要求浏览器页面实际操作验证，因此 E2E 为必需，不可用“无 demo 入口”跳过
- 实现阶段仍需遵守：先验证，再改版本号/CHANGELOG，最后中文 commit
