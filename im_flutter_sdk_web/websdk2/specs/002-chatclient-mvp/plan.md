# 实施方案：ChatClient MVP（初始化/登录/登出/连接状态事件）

**Branch**: `002-chatclient-mvp` | **Date**: 2026-01-22 | **Spec**: `specs/002-chatclient-mvp/spec.md`  
**Input**: 规范文档 `/specs/002-chatclient-mvp/spec.md`

## 概述

实现 ChatClient 单例入口，覆盖初始化、登录/登出与连接状态事件订阅。登录流程在建立连接前先请求 dnsconfig 获取可用域名，再使用返回域名建立连接。复用现有 `CoreSDK`/`ConnectionManager`、`RestClient`、校验器与错误体系，提供最小可用生命周期；对外仅暴露 `disconnected/connecting/connected` 三态，明确错误路径与订阅 API 行为。

## 技术背景

- **语言/版本**: TypeScript 5.x
- **主要依赖**: Vite 5、Vitest、Zod、RestClient（内部）
- **存储**: N/A
- **测试**: Vitest（单元测试）
- **目标平台**: Web SDK
- **性能目标**: 连接状态事件在状态切换后 100ms 内发出
- **约束**: 仅覆盖初始化/登录/登出/连接事件（含 dnsconfig 请求）；不包含消息收发与离线同步
- **范围**: 单一 ChatClient 入口与最小连接生命周期

## 方案要点

1. **单例与配置冲突**
   - `ChatClient.init(config)` 返回单例实例。
   - 关键配置包含 `appKey` 与可选 `serviceConfig.dnsConfigUrls`；同配置重复 init 直接返回实例；配置不一致则抛出明确的配置冲突错误（使用 `ValidationError` 并给出字段差异提示）。

2. **连接状态模型**
   - 对外状态仅允许 `disconnected`、`connecting`、`connected`。
   - 初始状态为 `disconnected`，且 init 不触发任何网络连接。
   - 登录失败时回到 `disconnected`，事件序列为 `connecting -> disconnected`。

3. **登录流程（dnsconfig → 连接）**
   - `login({ userId, token })` 使用 `serviceConfig.dnsConfigUrls`（或默认 DNS_CONFIG 列表）依次请求 DNS；内置 DNS 基址走 `${baseUrl}/easemob/server.json?app_key=...&_v=...`，完整自定义 DNS URL 保持原样请求。
   - 解析响应中的 `rest.hosts` 与登录主 websocket section，至少兼容 `msync-wx`、`msync-ws`、`msync`、`msync-web`、`websocket`、`im-ws` 等别名；根据当前页面协议（`window.location.protocol`）选择 `http/https` hosts，并匹配 `ws/wss`。
   - 主 websocket host 选择策略为“优先 `domain`，缺失时回退 `ip`”。
   - dnsconfig 失败或连接信息无效时自动切换到下一个 baseUrl，全部失败后返回错误并回到 `disconnected`。
   - 未初始化时调用 `login` 必须返回明确错误。

4. **登录/登出行为**
   - dnsconfig 成功后建立连接；已连接时拒绝重复登录。
   - 若 `core.connect()`、provision 或登录后初始化失败，必须执行失败清理，避免残留在 `connecting`。
   - `logout()`：连接中则取消连接，已断开则无副作用并成功返回。

5. **事件订阅 API**
   - 对外提供 `onConnectionStateChange(handler)` 并返回取消订阅函数。
   - 事件只在状态变化时触发，保证顺序与幂等。

6. **禁用自动重连**
   - 初始化 `CoreSDK` 时显式设置 `autoReconnectNumMax = 0`，确保不会进入自动重连流程。
   - 若底层仍出现 `reconnecting`/`error`，对外统一映射为 `disconnected` 并保持事件一致性。

7. **错误处理策略**
   - 参数校验：`ValidationError`，消息包含具体字段。
   - 认证失败：`AuthenticationError`。
   - 连接失败：`ConnectionError`，并保证状态回到 `disconnected`。

## 现有代码参考

- 旧工程实现：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/connection.ts`（`getHttpDNS`/`retryRequestDNS`/`setSocketUrl`）
- 保持的行为要点：
  - dnsconfig 请求地址：内置 DNS 基址使用 `${baseUrl}/easemob/server.json?app_key=...&_v=...`；完整自定义 DNS URL 保持原样
  - 仅选择与页面协议一致的 hosts（`http` or `https`）
  - WebSocket hosts 来源：兼容 `msync-wx.hosts` 及新版别名字段
  - WebSocket 地址拼接：`{wss|ws}://{domain|ip}:{port}/websocket`
  - 顺序重试 DNS_CONFIG 列表，失败后切换下一域名

## DNS_CONFIG 默认列表

- `https://rs.easemob.com`
- `https://rs.chat.agora.io`
- `http://59.110.89.59`
- `http://39.97.193.190`
- `http://39.97.193.187`

## 工程结构

### 文档

```text
specs/002-chatclient-mvp/
├── plan.md
├── spec.md
└── tasks.md
```

### 代码与测试

```text
src/
├── chat-client.ts          # 新增：ChatClient 入口
├── index.ts                # 新增：导出 ChatClient 相关 API
├── core/
│   └── index.ts            # 复用 CoreSDK
├── rest/
│   └── dns-config.ts        # 新增：dnsconfig 请求封装
├── validators/
│   └── chat-client.ts      # 新增：init/login 校验 schema
├── types/
│   ├── chat-client.ts      # 新增：ChatClient 相关类型
│   └── index.ts            # 扩展导出 ChatClient 相关类型
└── utils/

tests/
├── unit/
│   └── chat-client/
│       ├── init.test.ts
│       ├── auth.test.ts
│       └── connection-events.test.ts
```

## 测试策略

- **US1**：合法/非法配置、幂等 init、配置冲突、初始状态不触发连接。
- **US2**：dnsconfig 成功/失败、登录成功/失败、未初始化登录、重复登录、连接中登出、断开后登出。
- **US3**：连接事件顺序、取消订阅、生效时序、`getConnectionState` 返回值。

## 风险与权衡

- **底层状态映射**：现有 `ConnectionStatus` 包含 `reconnecting/error`，需要在 ChatClient 层过滤或映射，避免对外扩散。
- **禁用自动重连**：需确保底层配置可完全关闭自动重连行为，否则需在上层兜底为 `disconnected`。

## 复杂度跟踪

中等：状态映射与错误路径需要与现有连接管理器对齐。
