# Tasks: 日志分级与 DNS 控制上报

**Input**: Design documents from `/specs/012-log-report/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/  

**Tests**: 本特性涉及核心日志与上报能力，按 Constitution 要求包含必要单元测试。  

**Organization**: 按用户故事拆分，确保每个故事可独立交付与验证。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立日志脱敏与上报基础模块骨架

- [ ] T001 创建日志脱敏工具骨架 `src/utils/log-sanitizer.ts`
- [ ] T002 创建日志上报器模块骨架 `src/utils/log-reporter.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有用户故事的前置基础改造

- [ ] T003 扩展日志输出以支持缓冲与上报钩子 `src/utils/logger.ts`
- [ ] T004 更新 DNS 类型与校验以支持 enableReportLogs `src/types/chat-client.ts`, `src/validators/chat-client.ts`
- [ ] T005 更新 DNS 解析返回结构以携带 enableReportLogs `src/rest/dns-config.ts`
- [ ] T006 [P] REST 调用最小必要日志埋点 `src/rest/client.ts`
- [ ] T007 [P] 上传/下载调用最小必要日志埋点 `src/upload/simple-upload.ts`, `src/upload/multipart-upload.ts`, `src/upload/attachment-uploader.ts`
- [ ] T008 [P] WebSocket 连接与收发最小必要日志埋点 `src/core/connection/connection-manager.ts`

**Checkpoint**: 基础能力完成后可并行进入用户故事实现

---

## Phase 3: User Story 1 - 日志级别收敛与重分类 (Priority: P1) 🎯 MVP

**Goal**: 仅保留 debug/warn/error 并完成 info 重分类

**Independent Test**: `logger.info` 不可用，运行中只输出 debug/warn/error

### Tests for User Story 1

- [ ] T009 [P] [US1] 新增日志级别过滤单元测试 `tests/unit/utils/logger.test.ts`

### Implementation for User Story 1

- [ ] T010 [US1] 更新 LogLevel 类型移除 INFO `src/types/index.ts`
- [ ] T011 [US1] 更新 Logger 接口与默认实现移除 info `src/utils/logger.ts`
- [ ] T012 [P] [US1] 重分类连接相关日志为 debug/warn `src/core/connection/heartbeat.ts`, `src/core/connection/connection-retry.ts`, `src/core/connection/connection-manager.ts`
- [ ] T013 [P] [US1] 重分类消息相关日志为 debug/warn `src/core/message/message-sender.ts`, `src/core/message/message-receiver.ts`, `src/core/message/message-retry.ts`, `src/core/message/message-queue.ts`
- [ ] T014 [P] [US1] 重分类存储/事件/协议日志为 debug/warn `src/core/storage/indexeddb-storage.ts`, `src/core/events/event-hub.ts`, `src/protocol/protobuf/encoder.ts`, `src/protocol/protobuf/decoder.ts`
- [ ] T015 [US1] 重分类 core 与 ChatClient 关键日志为 debug/warn `src/core/index.ts`, `src/chat-client.ts`

**Checkpoint**: 日志分级与重分类完成

---

## Phase 4: User Story 2 - DNS 开关控制上报与定时上传 (Priority: P1)

**Goal**: DNS 成功后根据开关启用定时上报，DNS 前日志缓存

**Independent Test**: DNS 返回 `'true'` 启用定时上报，返回 `'false'` 不上报

### Tests for User Story 2

- [ ] T016 [P] [US2] 新增 DNS 开关解析单元测试 `tests/unit/rest/dns-config.test.ts`
- [ ] T017 [P] [US2] 新增日志上报分片与回退单元测试 `tests/unit/utils/log-reporter.test.ts`

### Implementation for User Story 2

- [ ] T018 [US2] 实现日志上报分片/间隔/回退与定时器 `src/utils/log-reporter.ts`
- [ ] T019 [US2] 日志脱敏后写入上报缓存与队列 `src/utils/logger.ts`, `src/utils/log-sanitizer.ts`
- [ ] T020 [US2] DNS 成功后读取 enableReportLogs 并配置上报器 `src/chat-client.ts`, `src/rest/dns-config.ts`
- [ ] T021 [US2] 登录流程注入上报上下文（restBaseUrl/appKey/userId/token/resource）`src/chat-client.ts`, `src/core/index.ts`

**Checkpoint**: 上报开关与定时机制可独立验证

---

## Phase 5: User Story 3 - 登录成功与退出时即时上报 (Priority: P2)

**Goal**: 登录成功与退出时立即上报一次

**Independent Test**: 开启上报时，登录/退出触发即时上报

### Tests for User Story 3

- [ ] T022 [P] [US3] 新增登录/退出即时上报单元测试 `tests/unit/chat-client/auth.test.ts`

### Implementation for User Story 3

- [ ] T023 [US3] 登录成功后触发一次立即上报 `src/chat-client.ts`, `src/utils/log-reporter.ts`
- [ ] T024 [US3] 退出流程触发立即上报并清理定时器 `src/chat-client.ts`, `src/utils/log-reporter.ts`

**Checkpoint**: 登录/退出即时上报可独立验证

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T025 [P] 更新快速验证步骤说明 `specs/012-log-report/quickstart.md`
- [ ] T026 对照 quickstart 执行验证 `specs/012-log-report/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始  
- **Foundational (Phase 2)**: 依赖 Phase 1  
- **User Stories (Phase 3+)**: 依赖 Phase 2  
- **Polish (Phase 6)**: 依赖所有用户故事完成  

### User Story Dependencies

- **US1 (P1)**: 无其他故事依赖  
- **US2 (P1)**: 无其他故事依赖  
- **US3 (P2)**: 依赖 US2 上报器可用  

### Parallel Opportunities

- Foundational 中标记 [P] 的任务可并行  
- US1 内部的日志重分类可按模块并行  
- US2 的测试与实现可在不同文件上并行推进  

---

## Parallel Example: User Story 1

```bash
Task: "重分类连接相关日志为 debug/warn (src/core/connection/heartbeat.ts, src/core/connection/connection-retry.ts, src/core/connection/connection-manager.ts)"
Task: "重分类消息相关日志为 debug/warn (src/core/message/message-sender.ts, src/core/message/message-receiver.ts, src/core/message/message-retry.ts, src/core/message/message-queue.ts)"
```

---

## Implementation Strategy

### MVP First

1. 完成 Phase 1 + Phase 2  
2. 完成 US1（日志级别收敛）  
3. 验证 US1 独立可用  

### Incremental Delivery

1. US1 → US2 → US3 逐步交付  
2. 每个用户故事完成后独立验证  
3. 最后执行 Polish  
