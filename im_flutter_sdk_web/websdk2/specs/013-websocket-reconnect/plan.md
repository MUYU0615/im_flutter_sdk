# Implementation Plan: 实时连接重连逻辑

**Branch**: `013-websocket-reconnect` | **Date**: 2026-02-05 | **Spec**: [/Users/zhangdong/code/websdk2/specs/013-websocket-reconnect/spec.md]
**Input**: Feature specification from `/specs/013-websocket-reconnect/spec.md`

**Note**: 本计划依据 speckit.plan 流程生成，包含研究与设计产物路径。

## Summary

基于 013 规格，实现 WebSocket 重连的统一方法与触发时机，覆盖网络 online/offline、前台恢复心跳校验、登录阶段连接失败、发送超时、服务器主动关闭/心跳失败等场景；重连过程具备防并发与状态保护（已连接/重连中不重复发起），并对外提供 onConnecting/onConnected/onDisconnected/onReconnectFailed 事件回调。登录阶段重试受 autoReconnectNumMax 限制（0 仍需尝试一次），遇到明确业务错误立即终止重试并由 `login()` 抛出失败；已登录场景达到最大重连次数后触发 onReconnectFailed，并在 online 事件到达时继续重连；连接成功后重置重连计数与状态。重试期间需按 DNS 域名列表轮询切换（仅 https 域名，不使用 http/ip）。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、protobufjs、vitest、vite、eslint  
**Storage**: N/A（连接状态与重连计数仅内存态）  
**Testing**: vitest、eslint、tsc  
**Target Platform**: Web（浏览器环境）
**Project Type**: single（SDK 单项目结构）  
**Performance Goals**: 重连触发在当前退避间隔内启动；前台心跳校验在心跳超时内完成；同一时刻仅允许 1 个重连任务  
**Constraints**: 超时/重试配置集中在 `src/config/timeouts.ts`；事件/状态常量集中定义；禁止 `any`；重连必须防并发；DNS 域名列表需过滤 http/ip 并按顺序轮询  
**Scale/Scope**: SDK 内部连接重连逻辑与状态事件；不涉及服务端协议与鉴权变更

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证本实现方案是否符合 IM SDK Web Constitution 的核心原则：

- [x] **性能优先**: 核心逻辑异步非阻塞，重连与心跳不阻塞主线程
- [x] **类型安全**: TypeScript strict mode，公共 API 类型完整，禁止 `any`
- [x] **测试驱动**: 关键路径补充单元测试，覆盖核心重连流程
- [x] **可靠性**: 覆盖断线重连、超时、网络抖动与失败恢复
- [x] **可扩展性**: 事件与状态集中定义，保留扩展触发点
- [x] **可观测性**: 关键重连与失败路径记录结构化日志
- [x] **版本管理**: 遵循 SemVer，变更更新版本与日志

如存在违反原则的情况，必须在 Complexity Tracking 中说明理由。

## Project Structure

### Documentation (this feature)

```text
specs/013-websocket-reconnect/
├── plan.md              # 本文件（/speckit.plan 输出）
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出
└── tasks.md             # Phase 2 输出（/speckit.tasks 输出）
```

### Source Code (repository root)

```text
src/
├── config/
├── core/
│   └── connection/
├── managers/
├── types/
├── utils/
└── validators/

tests/
└── (unit/integration 根据现有约定补充)
```

**Structure Decision**: 采用单项目 SDK 结构，重连逻辑集中在 `src/core/connection/`，事件与配置在 `src/types/` 与 `src/config/`。

## Complexity Tracking

无（Constitution Check 全部通过）。
