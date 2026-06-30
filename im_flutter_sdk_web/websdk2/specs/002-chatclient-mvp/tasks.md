---

description: "ChatClient MVP 实现任务清单"
---

# 任务清单：ChatClient MVP（初始化/登录/登出/连接状态事件）

**Input**: 设计文档 `/specs/002-chatclient-mvp/`  
**Prerequisites**: plan.md（必需）, spec.md（必需）  
**Tests**: 遵循 Constitution 的 TDD 要求，包含单元测试任务  
**Organization**: 任务按用户故事分组，确保每个故事可独立验证

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可并行执行（不同文件/无依赖）
- **[Story]**: 对应用户故事（US1/US2/US3）
- 描述中包含具体文件路径

---

## 阶段 1：基础结构

- [x] T001 创建 `src/chat-client.ts` 与 `src/index.ts` 基础结构（占位导出与类声明）
- [x] T002 [P] 新增 `src/rest/dns-config.ts`，封装 dnsconfig 请求与响应解析（内置默认 DNS_CONFIG 列表）
- [x] T003 [P] 新增 `src/types/chat-client.ts`，定义 `InitConfig`/`AuthContext`/`ConnectionState`/`DnsConfig` 并在 `src/types/index.ts` 导出
- [x] T004 [P] 新增 `src/validators/chat-client.ts`，定义 init/login/dnsconfig 的 Zod 校验 schema（必填 `appKey`、`userId`、`token`，可选 `serviceConfig.dnsConfigUrls`）

---

## 阶段 2：用户故事 1 - 初始化 ChatClient（Priority: P1）

**Goal**: 支持 `ChatClient.init(config)`，校验配置并返回单例实例

**Independent Test**: 合法/非法配置验证初始化成功或失败，重复 init 返回同一实例

### Tests for User Story 1

- [x] T005 [P] [US1] 编写初始化单元测试 `tests/unit/chat-client/init.test.ts`
  - 合法配置初始化成功，初始状态为 `disconnected` 且未触发连接
  - 配置缺失或非法返回 `ValidationError`
  - 相同配置重复 init 返回同一实例
  - 不同配置重复 init 返回配置冲突错误

### Implementation for User Story 1

- [x] T006 [US1] 在 `src/chat-client.ts` 实现 `init(config)`（校验配置、单例管理、冲突检测、初始状态）

---

## 阶段 3：用户故事 2 - 登录与登出（Priority: P1）

**Goal**: 支持 `login({userId, token})` 与 `logout()` 的最小连接生命周期（含 dnsconfig 请求）

**Independent Test**: 初始化后登录先请求 dnsconfig，再进入 `connected`，登出进入 `disconnected`；重复登录报错；连接中登出可取消

### Tests for User Story 2

- [x] T007 [P] [US2] 编写登录/登出单元测试 `tests/unit/chat-client/auth.test.ts`
  - 未初始化调用 `login` 返回明确错误
  - dnsconfig 请求失败时登录失败且状态回到 `disconnected`
  - dnsconfig 请求成功时使用返回域名建立连接
  - 仅选择与页面协议一致的 hosts（http/https）
  - DNS_CONFIG 列表按顺序重试直到成功或耗尽
  - 登录成功触发 `connecting -> connected`
  - 登录失败触发 `connecting -> disconnected` 且 Promise reject
  - 已连接重复 `login` 返回错误
  - `connecting` 状态调用 `logout` 取消连接并进入 `disconnected`
  - `disconnected` 状态调用 `logout` 无副作用

### Implementation for User Story 2

- [x] T008 [US2] 在 `src/rest/dns-config.ts` 实现 dnsconfig 请求逻辑（基于 `RestClient`，校验响应并解析 `msync-wx.hosts` 返回可用域名）
- [x] T009 [US2] 在 `src/chat-client.ts` 实现 `login({userId, token})`
  - 参数校验与错误映射（`ValidationError`/`AuthenticationError`）
  - 先调用 dnsconfig 获取域名（按 DNS_CONFIG 顺序重试），再初始化 `CoreSDK` 并显式设置 `autoReconnectNumMax = 0`
  - 连接失败时确保状态回到 `disconnected`
- [x] T010 [US2] 在 `src/chat-client.ts` 实现 `logout()`（调用 `disconnect()`，清理登录态）

---

## 阶段 4：用户故事 3 - 连接状态事件（Priority: P1）

**Goal**: 支持订阅连接状态变化并可取消订阅

**Independent Test**: 订阅后登录/登出触发事件；取消订阅后不再接收

### Tests for User Story 3

- [x] T011 [P] [US3] 编写连接事件单元测试 `tests/unit/chat-client/connection-events.test.ts`
  - 订阅返回取消函数
  - 状态事件顺序正确且仅在变化时触发
  - 取消订阅后不再收到事件
  - `getConnectionState()` 返回当前状态

### Implementation for User Story 3

- [x] T012 [US3] 在 `src/chat-client.ts` 实现 `onConnectionStateChange(handler)` 并返回取消订阅函数
- [x] T013 [US3] 在 `src/chat-client.ts` 实现 `getConnectionState()`，并维护内部状态
- [x] T014 [US3] 将 `CoreSDK` 的连接事件映射到 `ConnectionState`（过滤 `reconnecting/error` 为 `disconnected`）

---

## 阶段 5：收尾与文档

- [x] T015 [P] 为 `src/chat-client.ts` 的公共 API 添加 JSDoc 注释

---

## 依赖与执行顺序

- **阶段 1**: 先完成基础文件与类型/校验定义
- **阶段 2**: 依赖阶段 1，完成 init 单例与校验
- **阶段 3**: 依赖阶段 1 & 阶段 2
- **阶段 4**: 依赖阶段 3（需要连接生命周期）
- **阶段 5**: 可在核心功能完成后并行进行
