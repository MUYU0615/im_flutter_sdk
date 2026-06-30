---
description: '024 联系人自动同步实现任务清单'
---

# Tasks: 联系人自动同步（阶段一）

**Input**: 设计文档来自 `/specs/024-contact-sync/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、集成测试、契约测试；E2E 若本期无 demo 联系人入口，则必须显式记录不新增依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US3]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 024 所需协议、类型、缓存与测试骨架

- [x] T001 创建联系人领域类型与导出骨架 `src/types/contact.ts`、`src/types/index.ts`
- [x] T002 创建联系人同步核心目录与文件骨架 `src/core/contact-sync/roster-sync-client.ts`、`src/core/contact-sync/roster-sync-session.ts`、`src/core/contact-sync/roster-sync-controller.ts`、`src/core/contact-sync/roster-sync-types.ts`
- [x] T003 [P] 创建联系人缓存骨架 `src/cache/contact-cache.ts`
- [x] T004 [P] 创建联系人协议目录与静态产物骨架 `src/protocol/roster/proto-source.json`、`src/protocol/roster/proto.ts`、`src/protocol/roster/root.ts`、`src/protocol/roster/codec.ts`、`src/protocol/roster/types.ts`
- [x] T005 [P] 创建联系人 metadata REST 文件骨架 `src/rest/contact-metadata.ts`
- [x] T006 [P] 创建联系人同步单元测试骨架 `tests/unit/contact-sync/roster-sync-decision.test.ts`、`tests/unit/contact-sync/contact-cache.test.ts`、`tests/unit/contact-sync/roster-sync-client.test.ts`
- [ ] T007 [P] 创建联系人同步集成测试骨架 `tests/integration/contact-sync/contact-sync-login.integration.test.ts`、`tests/integration/contact-sync/contact-sync-recovery.integration.test.ts`
- [ ] T008 [P] 创建联系人同步契约测试骨架 `tests/contract/contact-sync.contract.test.ts`
- [x] T009 [P] 创建联系人协议测试辅助与 fixture 骨架 `tests/test-utils/contact-sync/build-roster-frame.ts`、`tests/test-utils/contact-sync/fixtures/`
- [x] T010 [P] 创建 roster 静态 proto 生成脚本骨架 `scripts/generate-roster-proto.js`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的参数、错误、缓存、协议与挂载基础

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [x] T011 在 `src/types/chat-client.ts` 与 `src/validators/chat-client.ts` 增加联系人自动同步初始化参数定义与校验，保留 `enableAutoSyncContacts`，并补充统一的私有化 URL 结构（主链路 REST/WS + 同步链路 REST/WS）
- [x] T012 [P] 在 `src/types/event-system.ts` 与 `src/types/contact.ts` 增加 `onContactSyncStart`、`onContactSyncFinish` 事件载荷与错误类型，并把失败语义收敛到 `finish.error`
- [x] T013 [P] 在 `src/utils/error-codes.ts` 定义联系人同步相关错误码与阶段语义常量
- [x] T014 在 `src/index.ts`、`src/chat-client.ts`、`src/managers/contact-manager.ts` 补充 ContactManager 注册、导出与挂载骨架
- [x] T015 [P] 在 `src/cache/cache-keys.ts`、`src/cache/cache-types.ts` 定义联系人关系缓存、版本状态、缓存完整性元数据 key 与类型
- [x] T016 [P] 在 `src/cache/cache-manager.ts` 接入联系人缓存读写入口与按用户隔离的持久化编排
- [x] T017 在 `scripts/generate-roster-proto.js` 实现 roster 静态 proto 生成/校验逻辑，并在 `package.json` 补充 `proto:gen`、`proto:check` 对应扩展
- [ ] T018 [P] 在 `src/platform/proto/static-proto-adapter.ts`、`src/platform/proto/proto-adapter.ts` 复用 roster 静态协议注册能力
- [x] T019 [P] 在 `tests/unit/contact-sync/roster-sync-decision.test.ts` 增加开关、缓存完整性、metadata 降级与阶段错误消息基础测试
- [x] T020 [P] 在 `tests/unit/contact-sync/contact-cache.test.ts` 增加联系人缓存、版本状态与 `cacheIntegrity` 基础测试
- [x] T021 [P] 在 `tests/unit/protocol/roster-codec.test.ts` 增加 roster 静态协议编码/解码基础测试

**Checkpoint**: 024 共享基础能力就绪，用户故事可并行推进

---

## Phase 3: User Story 1 - 登录后自动获取最新联系人列表（Priority: P1） 🎯 MVP

**Goal**: 实现登录后按开关触发联系人同步，先查 metadata version，再在“缓存完整 / 缓存不完整 / metadata 明确错误 / 其他失败”之间正确选择跳过、全量、快速失败或保守路径

**Independent Test**: 使用关闭开关、完整缓存、缺失缓存、metadata 失败四类场景登录，验证联系人同步决策正确，且可独立得到缓存结果或最新全量结果

### Tests for User Story 1

- [x] T022 [P] [US1] 在 `tests/unit/contact-sync/roster-sync-decision.test.ts` 增加 metadata version 判定 `skip/full/fallback-full` 用例
- [x] T023 [P] [US1] 在 `tests/unit/contact-sync/contact-cache.test.ts` 增加 `cacheIntegrity=complete/incomplete` 与冷启动结果可用性用例
- [x] T024 [P] [US1] 在 `tests/integration/contact-sync/contact-sync-login.integration.test.ts` 增加登录后先查 metadata 再决策同步路径的集成用例
- [x] T025 [P] [US1] 在 `tests/integration/contact-sync/contact-sync-login.integration.test.ts` 增加 metadata 预检返回 `skip` 时仍派发 `start -> finish`，以及明确 `401/403/404` 直接触发 `start -> finish(error)` 的集成用例
- [ ] T026 [US1] 在 `specs/024-contact-sync/tasks.md` 记录本期不新增联系人 demo E2E 的依据（当前无 demo 联系人入口，先由集成测试兜底）

### Implementation for User Story 1

- [x] T027 [US1] 在 `src/rest/contact-metadata.ts` 实现联系人版本元数据查询与错误分类，至少覆盖明确的 `401/403/404 -> onContactSyncFinish(error)`
- [x] T028 [US1] 在 `src/core/contact-sync/roster-sync-controller.ts` 实现登录后读取缓存、查询 metadata、判定 `skip/full/fail-fast` 的主流程，并确保所有分支都形成 `start -> finish` 事件闭环
- [x] T029 [US1] 在 `src/cache/contact-cache.ts` 实现联系人关系缓存、版本状态、缓存完整性元数据的内存模型与读写方法
- [x] T030 [US1] 在 `src/cache/cache-manager.ts` 接入联系人缓存 prepare/load/set/remove/flush 生命周期
- [x] T031 [US1] 在 `src/chat-client.ts` 接入联系人自动同步初始化开关、统一私有化 URL 结构、登录触发与关闭场景跳过逻辑
- [x] T032 [US1] 在 `src/managers/contact-manager.ts` 提供读取当前联系人快照与联系人同步事件注册能力
- [x] T033 [US1] 在 `src/core/contact-sync/roster-sync-controller.ts` 增加 metadata 错误分类、缓存优先返回与 `finish(error)` 结构化日志，并记录“快速失败 / 保守处理”分支

**Checkpoint**: US1 可独立完成“登录后联系人同步决策 + 缓存/全量初次结果”闭环

---

## Phase 4: User Story 2 - 同步过程中断线后基于 cursor 续传联系人分页（Priority: P1）

**Goal**: 实现 DNS 获取 `sync-ws`、独立 protobuf websocket、分页 cursor、断线续传、整轮额外重试、增量/全量合并与删除切全量，并在同步结束后关闭链路

**Independent Test**: 模拟 `sync-ws` 多地址、分页响应、增量新增、删除触发全量、同步 websocket 中途断线后基于 `cursor` 续传，以及整轮额外重试，验证最终联系人结果正确且链路会关闭

### Tests for User Story 2

- [x] T034 [P] [US2] 在 `tests/unit/contact-sync/roster-sync-client.test.ts` 增加 `sync-ws` 地址随机化、失败切换与单轮整轮重试用例
- [x] T035 [P] [US2] 在 `tests/unit/protocol/roster-codec.test.ts` 增加 roster `ping/pong`、全量/增量页、cursor 编解码用例
- [ ] T036 [P] [US2] 在 `tests/integration/contact-sync/contact-sync-recovery.integration.test.ts` 增加同步 websocket 中途断线后基于 `cursor` 续传剩余分页的集成用例
- [ ] T037 [P] [US2] 在 `tests/integration/contact-sync/contact-sync-recovery.integration.test.ts` 增加“新增联系人走增量、删除联系人走全量”集成用例
- [ ] T038 [P] [US2] 在 `tests/contract/contact-sync.contract.test.ts` 增加 metadata version、roster websocket 分页与错误阶段逻辑契约用例
- [ ] T039 [US2] 在 `specs/024-contact-sync/tasks.md` 记录本期不新增联系人恢复链路 E2E 的依据（无 demo 联系人入口，恢复链路由集成测试覆盖）

### Implementation for User Story 2

- [x] T040 [US2] 在 `src/rest/dns-config.ts` 扩展或复用 `sync-ws` 解析能力，并在 `src/core/contact-sync/roster-sync-controller.ts` 接入地址随机化、缺失时 `start -> finish(error)` 降级与失败切换
- [x] T041 [US2] 在 `src/protocol/roster/root.ts`、`src/protocol/roster/codec.ts`、`src/protocol/roster/types.ts` 实现 roster 协议 Root/Codec/类型映射
- [x] T042 [US2] 在 `src/core/contact-sync/roster-sync-client.ts` 旁抽出可复用 sync transport，并完成独立 websocket 建连、`ping/pong`、分页请求发送、断线后的 `cursor` 续传与整轮额外重试
- [x] T043 [US2] 在 `src/core/contact-sync/roster-sync-session.ts` 实现 cursor、requestId、pageCount、responseType、version 的会话状态推进
- [x] T044 [US2] 在 `src/core/contact-sync/roster-sync-controller.ts` 实现分页结果合并、增量新增/资料更新、删除切全量、去除 controller 对 `lastSyncTs` 的决策依赖，并明确主消息 websocket 重连不触发新的联系人预检
- [ ] T045 [US2] 在 `src/core/contact-sync/roster-sync-controller.ts` 接入用户切换、登出取消，以及同步链路中途断开时的续传编排逻辑
- [x] T046 [US2] 在 `src/cache/contact-cache.ts` 实现版本推进、`lastSyncTs` 更新、删除全量覆盖与同步完成后的 `cacheIntegrity` 回写

**Checkpoint**: US2 可独立完成“独立协议同步 + 增量/全量恢复 + 关闭链路”闭环

---

## Phase 5: User Story 3 - 联系人变化可被业务稳定感知（Priority: P2）

**Goal**: 实现联系人结果投影、事件派发、失败阶段消息和 `RosterItem.metadata -> userInfo` 回填，保证业务可稳定感知同步状态，并通过 `getContacts()` 主动读取最新结果

**Independent Test**: 触发同步开始/成功/失败、无变更、`skip` 预检与最新结果覆盖，验证业务侧能收到正确事件，并通过 `getContacts()` 读取最新结果与带阶段信息的失败消息

### Tests for User Story 3

- [ ] T047 [P] [US3] 在 `tests/unit/contact-sync/contact-cache.test.ts` 增加联系人关系缓存与 `userInfo` 合并投影用例
- [x] T048 [P] [US3] 在 `tests/unit/contact-sync/roster-sync-decision.test.ts` 增加 `onContactSyncStart/onContactSyncFinish` 事件、`skip` 仍派发事件闭环，以及 `finish.error` 失败阶段 message 用例
- [ ] T049 [P] [US3] 在 `tests/integration/contact-sync/contact-sync-login.integration.test.ts` 增加“实际同步无变更时仍派发一次 finish，但不重复派发联系人数据更新”的集成用例
- [ ] T050 [P] [US3] 在 `tests/integration/contact-sync/contact-sync-login.integration.test.ts` 增加 `RosterItem.metadata` 解析并回填 `userInfo` 缓存的集成用例
- [ ] T051 [US3] 在 `specs/024-contact-sync/tasks.md` 记录本期不新增联系人 UI E2E 的依据（业务侧无联系人展示主路径，事件语义由集成测试验证）

### Implementation for User Story 3

- [x] T052 [US3] 在 `src/core/contact-sync/roster-sync-controller.ts` 实现所有分支统一 `start -> finish`、实际同步无变更仍派发 `finish`，以及成功无 payload / 失败仅 `error` 的事件派发
- [x] T053 [US3] 在 `src/core/contact-sync/roster-sync-controller.ts` 实现失败阶段 message 组装（`metadata/socket_connect/sync_page/decode/cancelled`）
- [x] T054 [US3] 在 `src/protocol/roster/codec.ts` 与 `src/core/contact-sync/roster-sync-controller.ts` 实现 `RosterItem.metadata` 解析
- [x] T055 [US3] 在 `src/cache/cache-manager.ts` 与 `src/cache/contact-cache.ts` 实现联系人同步时回填 `userInfo` 缓存、记录 `addTs` 并重算 `cacheIntegrity`
- [x] T056 [US3] 在 `src/managers/contact-manager.ts` 与 `src/types/contact.ts` 完善对外联系人结构（`userInfo + remark + addTs`）、事件类型与错误注释
- [ ] T057 [US3] 在 `src/utils/logger.ts` 调用点增加联系人同步事件与失败阶段结构化日志

**Checkpoint**: US3 可独立完成“联系人事件语义 + 资料回填 + 可诊断失败消息”闭环

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、验证与发布

- [x] T058 [P] 对齐 024 文档术语与判定规则于 `specs/024-contact-sync/spec.md`、`specs/024-contact-sync/plan.md`、`specs/024-contact-sync/tasks.md`
- [ ] T059 [P] 回填 `specs/024-contact-sync/quickstart.md` 的实测结果、测试 DNS 样例与已知风险
- [ ] T060 执行 `npm run test:run -- tests/unit/contact-sync tests/unit/protocol tests/integration/contact-sync tests/contract/contact-sync.contract.test.ts` 并记录输出到 `specs/024-contact-sync/quickstart.md`
- [ ] T061 执行 `npm run lint`、`npm run type-check`、`npm run test:gate:pr` 并记录与 024 相关结果到 `specs/024-contact-sync/quickstart.md`
- [ ] T062 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [ ] T063 提交 024 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-5 (User Stories)**: 依赖 Phase 2 完成；可并行或按优先级推进
- **Phase 6 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: 依赖 Phase 2，可在 US1 主决策稳定后推进独立协议与恢复链路
- **US3 (P2)**: 依赖 Phase 2，建议在 US1/US2 的基础链路稳定后补齐事件、资料回填与错误语义

### Within Each User Story

- 先完成故事级测试任务并验证失败预期
- 再实现类型/缓存/协议或控制器核心逻辑
- 再接入 ChatClient / Manager / 事件分发
- 最后执行故事级独立验证

### Parallel Opportunities

- Phase 1、2 所有标记 `[P]` 的任务可并行
- Phase 2 完成后，US1 与 US2 的测试任务可并行
- US2 的协议静态产物与 DNS 失败切换任务可并行推进
- US3 的 `metadata` 解析与事件测试可与 US2 收尾并行
- Phase 6 的文档与验证类任务可并行

---

## Parallel Example: User Story 1

```bash
Task: "T022 tests/unit/contact-sync/roster-sync-decision.test.ts"
Task: "T023 tests/unit/contact-sync/contact-cache.test.ts"
Task: "T024 tests/integration/contact-sync/contact-sync-login.integration.test.ts"
Task: "T025 tests/integration/contact-sync/contact-sync-login.integration.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T034 tests/unit/contact-sync/roster-sync-client.test.ts"
Task: "T035 tests/unit/protocol/roster-codec.test.ts"
Task: "T036 tests/integration/contact-sync/contact-sync-recovery.integration.test.ts"
Task: "T038 tests/contract/contact-sync.contract.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T047 tests/unit/contact-sync/contact-cache.test.ts"
Task: "T048 tests/unit/contact-sync/roster-sync-decision.test.ts"
Task: "T049 tests/integration/contact-sync/contact-sync-login.integration.test.ts"
Task: "T050 tests/integration/contact-sync/contact-sync-login.integration.test.ts"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（metadata version 判定、缓存完整性、失败降级）
3. **STOP and VALIDATE**：仅验证 US1 独立通过
4. 通过后再推进独立 websocket 同步与恢复链路

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（登录后同步决策与初始可用结果）
3. 交付 US2（独立协议同步、分页恢复、删除切全量）
4. 交付 US3（事件语义、资料回填、失败阶段 message）
5. 收尾发布（Phase 6）

### Parallel Team Strategy

- 开发 A：US1（metadata 判定、缓存完整性、登录编排）
- 开发 B：US2（协议静态产物、websocket client、分页 session）
- 开发 C：US3（事件语义、metadata 解析、userInfo 回填）

---

## Notes

- 所有任务均遵循 `- [ ] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段均带 `[USx]` 标签，便于追踪与独立验收
- 每个用户故事可独立实现、独立测试、独立演示
- 本期无联系人 demo 主路径，E2E 通过显式记录“不新增”依据满足 spec 的测试分层要求
- 每轮实现完成后按规则更新版本号、CHANGELOG 并提交 commit
