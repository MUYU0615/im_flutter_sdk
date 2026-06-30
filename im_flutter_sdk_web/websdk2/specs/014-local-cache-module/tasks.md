# Tasks: 本地缓存模块

**Input**: Design documents from `/specs/014-local-cache-module/`
**Prerequisites**: plan.md（required）, spec.md（required）, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 本规格未要求 TDD，任务清单不包含测试任务。

**Organization**: 任务按用户故事分组，确保每个故事可独立实现与验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无前置依赖）
- **[Story]**: 任务所属用户故事（US1/US2/US3）
- 描述中必须包含明确文件路径

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 项目初始化与基础结构准备

- [x] T001 创建缓存模块目录与入口文件 `src/cache/index.ts`
- [x] T002 更新对外导出以暴露缓存模块 `src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有用户故事的基础能力与公共组件

- [x] T003 [P] 定义缓存配置与策略常量（TTL/上限/flush）`src/config/cache.ts`
- [x] T004 [P] 定义缓存实体类型与接口 `src/cache/cache-types.ts`
- [x] T005 实现序列化与超限错误识别工具 `src/cache/cache-utils.ts`（依赖 T003/T004）
- [x] T006 实现 localStorage 访问封装与错误降级 `src/cache/cache-store.ts`
- [x] T007 实现 LRU + TTL 淘汰策略 `src/cache/cache-eviction.ts`
- [x] T008 实现缓存元信息读写 `src/cache/cache-metadata.ts`

**Checkpoint**: 基础能力完成后可进入用户故事实现

---

## Phase 3: User Story 1 - 首屏快速展示会话摘要 (Priority: P1) 🎯 MVP

**Goal**: 支持会话摘要缓存读写，并在同步时更新

**Independent Test**: 读取缓存可展示会话摘要；同步完成后缓存更新可见

### Implementation for User Story 1

- [x] T009 [US1] 实现会话摘要缓存读写 `src/cache/conversation-cache.ts`
- [x] T010 [US1] 移除会话消息列表缓存与相关存储键 `src/cache/cache-manager.ts`
- [x] T011 [US1] 登录成功后读取会话缓存并触发 `onConversationUpdate` `src/chat-client.ts`
- [x] T012 [US1] 服务端递归拉取会话列表并差异回调/回写缓存 `src/chat-client.ts`、`src/apis/index.ts`

**Checkpoint**: US1 功能独立可用

---

## Phase 4: User Story 2 - 业务模块可读写缓存 (Priority: P2)

**Goal**: 提供用户信息缓存与批量读写接口，供业务模块调用

**Independent Test**: 批量写入用户信息后可批量读取，数据一致

### Implementation for User Story 2

- [x] T013 [US2] 实现用户信息缓存读写 `src/cache/user-info-cache.ts`
- [x] T014 [US2] 实现缓存统一入口与批量接口 `src/cache/cache-manager.ts`
- [x] T015 [US2] 在 `fetchUserInfoById`/`updateOwnUserInfo` 写入缓存并在登录后加载用户信息到内存 `src/chat-client.ts`、`src/managers/user-info-manager.ts`

**Checkpoint**: US2 功能独立可用

---

## Phase 5: User Story 3 - 容量与过期可控 (Priority: P3)

**Goal**: 超限清理与过期丢弃机制生效，优先保障会话缓存，LRU 反映真实使用顺序

**Independent Test**: 超限时会话优先保留，过期数据不再返回，且全量加载不刷新 lastAccess

### Implementation for User Story 3

- [x] T016 [US3] 在写入流程处理超限错误并执行 TTL + LRU 清理重试 `src/cache/cache-manager.ts`
- [x] T017 [US3] 在读取流程执行 TTL 校验与过期清理 `src/cache/cache-manager.ts`
- [x] T018 [US3] 实现 lastAccess 使用时更新与批量落盘 `src/cache/cache-manager.ts`

**Checkpoint**: US3 功能独立可用

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 跨故事补强与文档收尾

- [x] T019 [P] 更新缓存模块对外说明 `docs/reference/api.md`
- [ ] T020 运行 quickstart 指引进行人工验证 `specs/014-local-cache-module/quickstart.md`
- [x] T021 [P] 补充缓存模块单元测试（CacheStore/ConversationCache/UserInfoCache）`tests/unit/cache/cache-store.test.ts`、`tests/unit/cache/conversation-cache.test.ts`、`tests/unit/cache/user-info-cache.test.ts`
- [x] T022 [P] 补充 CacheManager 回归测试（prepare/merge/access/flush/quota-retry）`tests/unit/cache/cache-manager.test.ts`
- [x] T023 [P] 补充 localStorage 配额淘汰集成测试，验证 QuotaExceededError 下优先淘汰用户信息并保留会话摘要 `tests/integration/cache/local-storage-quota.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → **User Stories (Phase 3-5)** → **Polish (Phase 6)**

### User Story Dependencies

- **US1**：依赖 Foundational 完成后即可开始
- **US2**：依赖 Foundational 完成后即可开始
- **US3**：依赖 Foundational 完成后即可开始

### Parallel Opportunities

- T003 与 T004 可并行
- US1/US2/US3 可在基础完成后并行推进（不同模块文件）

---

## Parallel Example: User Story 1

```bash
Task: "实现会话摘要缓存读写 src/cache/conversation-cache.ts"
Task: "移除会话消息列表缓存与相关存储键 src/cache/cache-manager.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1 与 Phase 2
2. 实现 US1（Phase 3）
3. 独立验证 US1

### Incremental Delivery

1. US1 → 验证
2. US2 → 验证
3. US3 → 验证
4. Polish → 收尾

---

## Notes

- [P] 任务可并行执行
- 任务必须包含明确文件路径
- 每个用户故事必须可独立实现与验证
