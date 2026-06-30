# 实施方案：SDK 跨平台适配层（小程序 / uni-app / Electron / React Native）

**Branch**: `018-cross-platform-adapter` | **Date**: 2026-02-13 | **Spec**: `specs/018-cross-platform-adapter/spec.md`  
**Input**: Feature specification from `/specs/018-cross-platform-adapter/spec.md`

## Summary

本特性将现有 Web 偏置实现收敛为统一 `PlatformAdapter` 架构，先完成跨平台能力抽象（请求、上传、WebSocket、运行时生命周期、编解码、存储）与 Web 默认实现，再逐步接入微信小程序、uni-app（含 H5）、React Native、Electron Renderer。编解码策略采用“同版本单一静态 protobuf 方案”，不内置运行时回退分支。

增量补充（2026-02-28）：在 Service Worker/Worker 运行时补齐请求链路兼容，明确当环境缺失 `XMLHttpRequest` 时，HTTP 请求必须自动回退到 `fetch`，并保持统一错误语义与超时行为。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、protobufjs/minimal、vitest、vite、eslint  
**Storage**: Web 默认 localStorage（后续通过 StorageAdapter 扩展到小程序/RN）  
**Testing**: Vitest（单元/契约/集成分层），必要的跨平台兼容基线用例  
**Target Platform**: Web、微信小程序、uni-app（小程序/App/H5）、Electron Renderer、React Native  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 适配层引入后核心消息路径无显著回退；文本消息链路与现状保持同级响应；上传/连接状态回调语义一致  
**Constraints**: 单一 protobuf 方案；关键能力缺失 fail-fast；保持现有 Web API 向后兼容；禁止 `any`  
**Scale/Scope**: 聚焦 SDK 核心链路（初始化、连接、文本收发、附件上传、生命周期、编解码一致性）

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 采用适配层解耦，不在消息热路径增加阻塞操作；保持异步调用模型
- [x] **类型安全**: 适配层接口与平台能力画像全部使用严格类型定义，禁止 `any`
- [x] **测试驱动**: 计划中包含适配层单测、协议一致性测试、平台契约测试与回归测试
- [x] **可靠性**: 保留现有重连/超时机制，并将网络与前后台监听抽象为统一运行时适配
- [x] **可扩展性**: 引入可注入适配器与平台能力注册机制，支持后续扩展
- [x] **可观测性**: 统一错误模型与日志上下文字段，适配层关键节点可追踪
- [x] **版本管理**: 文档与代码变更均按 SemVer 递增并记录 CHANGELOG

Phase 1 设计复检结果：通过（无新增原则冲突，见 `research.md` 与 `data-model.md` 的约束落地）。

## Project Structure

### Documentation (this feature)

```text
specs/018-cross-platform-adapter/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sdk-platform-compat.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── platform/
│   ├── index.ts
│   ├── types.ts
│   ├── factory.ts
│   ├── runtime/
│   ├── request/
│   ├── upload/
│   ├── socket/
│   ├── proto/
│   └── storage/
├── core/
├── rest/
├── upload/
├── protocol/
└── utils/

tests/
├── unit/
│   ├── platform/
│   └── protocol/
├── contract/
└── integration/
```

**Structure Decision**: 采用单项目结构，在 `src/platform/` 下集中承载跨平台适配能力，避免平台分支散落在 `core/rest/upload/protocol` 各模块中。

## Phase 0: Research

输出：`specs/018-cross-platform-adapter/research.md`

- 明确平台识别优先级与冲突处理策略（含 uni-app H5 与 Web 区分）
- 明确关键能力缺失 fail-fast 的边界（连接、上传、请求、编解码）
- 明确 Service Worker 无 `XMLHttpRequest` 时请求适配器的 `fetch` 兜底策略
- 明确单一静态 protobuf 方案的可行性与替换策略
- 明确附件跨端源对象标准化策略（Web File、MiniApp path、RN uri）

## Phase 1: Design & Contracts

输出：

- `specs/018-cross-platform-adapter/data-model.md`
- `specs/018-cross-platform-adapter/contracts/sdk-platform-compat.openapi.yaml`
- `specs/018-cross-platform-adapter/quickstart.md`

设计要点：

1. 定义平台能力数据模型（能力画像、传输契约、上传上下文、编解码能力）
2. 固化统一契约：初始化、登录、文本消息、附件消息、连接状态、错误码
3. 规定平台扩展入口：默认工厂 + 显式注入机制
4. 建立验收闭环：Web、微信小程序、uni-app 小程序/App/H5、RN、Electron Renderer
5. 增加 Service Worker 请求兼容基线：`XMLHttpRequest` 缺失时 `fetch` 兜底可用

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=018-cross-platform-adapter .specify/scripts/bash/update-agent-context.sh codex
```

预期：更新 `AGENTS.md` 的技术栈与最近变更上下文，便于后续 `/speckit.tasks` 与实现阶段保持一致。

## Complexity Tracking

无额外豁免项。
