# 实施方案：流式消息接收回调（stream）

**Branch**: `020-stream-message` | **Date**: 2026-02-25 | **Spec**: `specs/020-stream-message/spec.md`  
**Input**: Feature specification from `/specs/020-stream-message/spec.md`

## Summary

本特性仅实现流式消息“接收与回调”链路：SDK 在收到流式分片后按消息 ID 建立缓存会话，处理乱序与缺片补齐，保证单流内严格有序回调；当缺片未补齐时，支持服务端兜底末片完成语义；超时仅以服务端错误分片（含 512）为准并回调一次错误态后结束该流；单片场景输出 `STREAM_FULL`，同时保持非流式消息链路零回归。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、protobufjs/minimal、vitest、vite、eslint  
**Storage**: N/A（内存流缓存会话，不引入持久化）  
**Testing**: Vitest（单元 + 接收链路回归 + 协议解码）  
**Target Platform**: Web、微信小程序、uni-app（小程序/App/H5）、Electron Renderer、React Native  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 流式回调保持实时可交互（分片到达后可立即判定并回调）；多流并行不出现明显延迟回退；非流式接收吞吐不回退  
**Constraints**: 仅接收不发送；单流内有序、跨流按到达顺序；缓存键仅 `msgId`；超时仅信任服务端错误分片；分片回调同时提供累计全文与本片增量  
**Scale/Scope**: 聚焦 SDK 接收端流式分片装配与回调语义，不扩展服务端协议、不新增持久层

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 分片处理、顺序校验、回调分发均按异步非阻塞流程设计
- [x] **类型安全**: 流式分片、缓存会话、回调事件与错误语义采用 strict 类型约束
- [x] **测试驱动**: 计划覆盖乱序、缺片、兜底、超时、单片 FULL、去重、多流并行、非流式回归
- [x] **可靠性**: 明确缺片等待、补齐回放、服务端超时分片结束与一次性错误回调语义
- [x] **可扩展性**: 复用现有 message-receiver/事件分发与协议解码扩展点，不新增耦合分支
- [x] **可观测性**: 在缓存创建、补片回放、流完成、超时错误、丢弃重复分片等节点输出结构化日志
- [x] **版本管理**: 文档与后续实现按 SemVer 与 CHANGELOG 规则迭代

Phase 1 设计复检结果：通过（研究决策与数据模型未引入额外宪章冲突）。

## Project Structure

### Documentation (this feature)

```text
specs/020-stream-message/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── stream-message.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/message/
│   ├── message-receiver.ts
│   ├── stream-message-handler.ts
│   └── stream-message-cache.ts
├── protocol/msync/
│   ├── codec.ts
│   └── types.ts
├── types/
│   ├── index.ts
│   └── event-system.ts
└── utils/

tests/
├── unit/core/message/
├── unit/protocol/
└── unit/message/
```

**Structure Decision**: 采用单项目结构，在现有接收链路中新增流式子模块（缓存/排序/回调）并扩展协议映射与事件类型，避免引入独立子系统。

## Phase 0: Research

输出：`specs/020-stream-message/research.md`

- 固化“仅接收不发送”的能力边界与失败语义
- 固化分片文本语义（累计全文 + 本片增量）
- 固化缺片策略（等待补齐 + 兜底末片完成）
- 固化超时来源（仅服务端错误分片）与单片 512 语义
- 固化并行顺序语义（单流有序、跨流按到达）与 `msgId` 缓存键约束

## Phase 1: Design & Contracts

输出：

- `specs/020-stream-message/data-model.md`
- `specs/020-stream-message/contracts/stream-message.openapi.yaml`
- `specs/020-stream-message/quickstart.md`

设计要点：

1. 定义流式分片、装配会话、回调事件、错误事件模型与状态流转
2. 明确接收链路分层：协议解析 -> 分片归并 -> 顺序回调 -> 完成清理
3. 明确缺片与兜底分支：缺片缓存等待、补齐后连续回放、兜底末片完成
4. 明确超时与错误契约：仅服务端错误分片触发结束，错误回调一次
5. 明确并行隔离与去重契约：按 `msgId` 聚合、重复分片丢弃、跨流按到达分发

## Agent Context Update

执行命令：

```bash
.specify/scripts/bash/update-agent-context.sh codex
```

预期：同步 agent 上下文中的当前技术栈与最近变更，保证 `/speckit.tasks` 和实现阶段一致。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 接收入口与协议字段映射
2. 流缓存会话与缺片检测/去重
3. 顺序回调与文本语义（full + delta）
4. 兜底末片与服务端超时错误分片处理
5. 回归测试与跨平台语义校验

## Complexity Tracking

无额外豁免项。
