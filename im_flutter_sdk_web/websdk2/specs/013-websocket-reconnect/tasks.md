# Tasks: 实时连接重连逻辑

**Input**: Design documents from `/specs/013-websocket-reconnect/`
**Prerequisites**: plan.md（必需）, spec.md（必需）, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 依据 Constitution 要求补充关键路径单元测试。

**Organization**: 按用户故事分组，确保每个故事可独立实现与验证。

## Phase 1: Setup（共享基础）

**Purpose**: 准备事件/状态/配置的基础定义

- [ ] T001 更新连接事件定义（onConnecting/onConnected/onDisconnected/onReconnectFailed）在 `src/types/event-system.ts`
- [ ] T002 更新连接状态与重连原因类型（含 reason 常量/联合类型）在 `src/types/connection.ts` 并在 `src/types/index.ts` 导出
- [ ] T003 [P] 扩展前台心跳检测与重连相关超时配置在 `src/config/timeouts.ts`
- [ ] T004 [P] 扩展 DNS 解析输出 WebSocket 域名列表（过滤 http/ip，仅保留与页面协议一致的域名）在 `src/rest/dns-config.ts`
- [ ] T005 [P] 扩展对外连接状态类型（含 reconnecting/reconnectFailed）在 `src/types/chat-client.ts`

---

## Phase 2: Foundational（阻塞前置）

**Purpose**: 重连核心能力与状态锁，所有用户故事的基础依赖

- [ ] T006 在 `src/core/connection/connection-manager.ts` 中新增重连状态锁/暂停标记/登录阶段标记
- [ ] T007 [P] 对齐重试策略与重连计数重置逻辑在 `src/core/connection/connection-retry.ts`
- [ ] T008 在 `src/core/connection/connection-manager.ts` 中实现统一重连方法与状态保护
- [ ] T009 [P] 在 `src/core/connection/connection-manager.ts` 中统一连接事件回调与 payload 组装（含 reason/attempt/max/isLoginPhase/isOnline）
- [ ] T010 [P] 在 `src/core/connection/connection-manager.ts` 中补充重连生命周期日志
- [ ] T011 [P] 在 `src/core/connection/connection-manager.ts` 中维护 DNS 域名候选列表与轮询索引，并在每次连接尝试前切换 WebSocket URL

**Checkpoint**: 基础能力完成后，用户故事可以并行推进

---

## Phase 3: User Story 1 - 网络切换后快速恢复连接 (Priority: P1) 🎯 MVP

**Goal**: 离线时主动关闭连接，在线时快速重连

**Independent Test**: 模拟 offline→online，确认触发关闭与重连事件

- [ ] T012 [US1] 在 `src/core/index.ts` 中注册/注销 online/offline 监听
- [ ] T013 [US1] 在 `src/core/connection/connection-manager.ts` 中实现 offline 主动关闭逻辑
- [ ] T014 [US1] 在 `src/core/connection/connection-manager.ts` 中实现 online 触发重连逻辑
- [ ] T015 [P] [US1] 新增网络切换单测在 `tests/unit/core/connection/network-reconnect.spec.ts`（覆盖 offline 暂停重连、online 恢复、onDisconnected 仅在已连接后触发）

---

## Phase 4: User Story 2 - 前台恢复时保证连接健康 (Priority: P1)

**Goal**: 前台恢复触发心跳检测，失败则重连

**Independent Test**: 前台切换后心跳失败触发 reconnect

- [ ] T016 [US2] 在 `src/core/index.ts` 中注册/注销 visibilitychange 监听
- [ ] T017 [US2] 在 `src/core/connection/heartbeat.ts` 中补充前台心跳探测方法
- [ ] T018 [US2] 在 `src/core/connection/connection-manager.ts` 中接入前台心跳失败触发重连
- [ ] T019 [P] [US2] 新增前台心跳失败单测在 `tests/unit/core/connection/foreground-heartbeat.spec.ts`（覆盖心跳超时与 ws 非 OPEN 直接失败）

---

## Phase 5: User Story 3 - 登录阶段失败可自动恢复 (Priority: P2)

**Goal**: 登录阶段连接失败可重试，达到上限后 `login()` 抛错并停止重连

**Independent Test**: 登录阶段连续失败达到上限后 `login()` 抛错且不触发 onReconnectFailed

- [ ] T020 [US3] 在 `src/core/index.ts` 中标记登录阶段开始/结束
- [ ] T021 [US3] 在 `src/core/connection/connection-manager.ts` 中处理登录阶段 onClose/onError 重连与上限终止（失败由 login() 抛错）
- [ ] T022 [US3] 在 `src/core/connection/connection-manager.ts` 中接入业务错误判定（参考旧 receiveProvision），业务错误不重试
- [ ] T023 [P] [US3] 新增登录失败抛错单测在 `tests/unit/core/connection/login-reconnect.spec.ts`（确保不触发 onDisconnected/onReconnectFailed，且 autoReconnectNumMax=0 仍尝试一次）
- [ ] T024 [P] [US3] 新增业务错误不重试单测在 `tests/unit/core/connection/login-reconnect.spec.ts` 或新增独立用例

---

## Phase 6: User Story 4 - 发送超时自动恢复 (Priority: P3)

**Goal**: 发送超时触发重连

**Independent Test**: 模拟 ACK 超时后触发 reconnect

- [ ] T025 [US4] 在 `src/core/message/message-sender.ts` 中发送超时派发事件
- [ ] T026 [US4] 在 `src/core/connection/connection-manager.ts` 中监听发送超时事件并触发重连
- [ ] T027 [P] [US4] 新增发送超时触发重连单测在 `tests/unit/core/connection/send-timeout-reconnect.spec.ts`（reason=send-timeout）

---

## Phase 7: User Story 5 - 已登录场景达到上限后在线恢复 (Priority: P3)

**Goal**: 登录后达到上限时暂停重连，online 恢复后继续（触发 onReconnectFailed）

**Independent Test**: 达到上限后 online 事件恢复重连

- [ ] T028 [US5] 在 `src/core/connection/connection-manager.ts` 中实现上限暂停与 online 恢复逻辑
- [ ] T029 [P] [US5] 新增 online 恢复单测在 `tests/unit/core/connection/online-resume.spec.ts`（覆盖 onReconnectFailed payload 与恢复逻辑）

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 文档与一致性更新

- [ ] T030 [P] 更新连接事件说明文档在 `docs/reference/api.md`
- [ ] T031 [P] 校验 quickstart 步骤并补充说明在 `specs/013-websocket-reconnect/quickstart.md`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → User Stories (P1 → P2 → P3) → Polish
- US1 与 US2 可并行（在 Phase 2 完成后）
- US3 依赖登录阶段标记，建议在 US1/US2 稳定后执行
- US4/US5 可并行推进（均依赖 Phase 2）

## Parallel Example: User Story 1

- 网络监听注册：`src/core/index.ts`
- offline/online 逻辑：`src/core/connection/connection-manager.ts`
- 单测：`tests/unit/core/connection/network-reconnect.spec.ts`

## Implementation Strategy

1. 完成 Phase 1 & Phase 2，确保重连核心逻辑可复用
2. 优先实现 US1 + US2（P1），形成可演示的 MVP
3. 继续 US3（登录失败与上限处理）
4. 完成 US4/US5
5. 文档与 quickstart 校验收尾
