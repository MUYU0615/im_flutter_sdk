# 计划：Node 版 WebSocket + Protobuf Mock MSync Server

## 背景

当前 023 的 mock server 仅提供 HTTP 场景注入，不满足“真实 WebSocket 协议联调”目标。  
目标升级为：在本工程内直接启动 Node mock server，按 protobuf 协议进行握手与消息收发，并可注入异常场景，供 `test:gate:pr` 直接使用。

## 目标

1. 提供可独立启动的 WebSocket mock MSync 服务（Node 实现）
2. 对齐现有 SDK 的 protobuf 编解码定义（复用仓库已有 proto 定义）
3. 支持 provision 握手与基础消息收发（ACK 回包）
4. 支持异常场景注入（超时、断连、乱序、非法包）
5. 在测试执行时自动拉起/关闭 mock server
6. 与现有分层门禁脚本对接，保持一键执行

## 技术选型

- 语言：Node.js（与仓库现有脚本统一）
- WebSocket：`ws`
- protobuf：复用 `protobufjs` + 仓库内 `src/protocol/msync/proto-source.json` 或现有 root 构建逻辑

## 实施范围

### A. 新增服务端实现

- `scripts/test/mock-msync-ws-server.mjs`
  - 启动 WebSocket Server
  - 解析客户端二进制包
  - 响应 provision 成功/失败
  - 在收到发送消息后回 ACK（最小闭环）
  - 支持场景注入：
    - `NORMAL_FLOW`
    - `TIMEOUT`
    - `DISCONNECT_AFTER_CONNECT`
    - `OUT_OF_ORDER_ACK`
    - `INVALID_PROTO_PAYLOAD`

### B. 新增服务控制器

- `tests/test-utils/layered/mock-msync-server-control.ts`
  - 启停服务
  - 场景切换
  - 健康探测
  - 日志/证据收集

### C. 协议测试与门禁接入

- 新增集成测试：
  - `tests/integration/mock/mock-msync-normal-flow.test.ts`
  - `tests/integration/mock/mock-msync-timeout.test.ts`
  - `tests/integration/mock/mock-msync-disconnect.test.ts`
  - `tests/integration/mock/mock-msync-invalid-payload.test.ts`
- 更新编排脚本：
  - `scripts/test/run-layered-tests.mjs`（mock 阶段改为 ws/protobuf 版本）

### D. 脚本与文档

- `package.json` 增加（或更新）mock-msync 启动脚本
- `docs/testing/testing-layered-strategy.md` 补充 ws/protobuf mock 能力说明
- `docs/testing/testing-layered-env.md` 补充 mock-msync 端口/场景变量
- `specs/023-test-layer-strategy/quickstart.md` 更新验证步骤

## 验证计划

1. `npm run test:run -- tests/integration/mock/mock-msync-*.test.ts` 通过
2. `LAYERED_GATE_STRICT=1 npm run test:gate:pr` 通过（含 mock ws/protobuf 层）
3. 失败注入场景能稳定复现并输出结构化失败证据

## 风险与应对

1. **协议细节对齐风险**：若现有 SDK codec 与 mock 解析细节不一致，优先按 SDK 实际 decode 路径修正 server
2. **测试环境端口限制**：提供 in-memory fallback，避免本地端口受限时阻塞开发
3. **复杂度膨胀**：先落地最小闭环（provision + text send + ack），再扩展异常场景

## 交付清单

1. Node 版 ws/protobuf mock server（可独立启动）
2. 场景控制器与 mock 集成测试
3. 分层门禁脚本接入
4. 文档、quickstart、changelog、版本号同步
