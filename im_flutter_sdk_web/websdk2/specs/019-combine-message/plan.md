# 实施方案：合并消息收发（combine）

**Branch**: `019-combine-message` | **Date**: 2026-02-24 | **Spec**: `specs/019-combine-message/spec.md`  
**Input**: Feature specification from `/specs/019-combine-message/spec.md`

## Summary

本特性在现有消息链路中新增 `combine` 消息的完整能力：发送侧把 `messageList` 编码为单一载荷并按附件上传后发送，接收侧先回调合并消息元信息，再通过按需 API 下载并解码详情列表；同时强制执行 `combineLevel <= 10`、条数上限 300、系统消息拒绝入列，并对齐 018 跨平台适配层语义。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、protobufjs/minimal、vitest、vite、eslint  
**Storage**: N/A（沿用现有消息缓存与附件资源访问模型）  
**Testing**: Vitest（单元 + 协议 + 平台兼容 + 回归）  
**Target Platform**: Web、微信小程序、uni-app（小程序/App/H5）、Electron Renderer、React Native  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 合并消息发送主链路无明显回退；按需下载解码在正常网络下保持可交互体验；非合并消息链路零回归  
**Constraints**: `combineLevel` 最大 10；`messageList` 上限 300（发送与按需解码阶段一致）；仅允许业务消息类型；默认不自动下载详情；失败必须可识别且不可误报成功  
**Scale/Scope**: 聚焦 SDK 合并消息创建/发送/接收/按需解码与跨平台适配，不扩展新协议通道或独立存储系统

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 编码、上传、下载、解码均按异步非阻塞流程设计，避免阻塞主线程
- [x] **类型安全**: 合并消息模型、错误模型、按需解码返回模型均采用 strict 类型约束
- [x] **测试驱动**: 计划覆盖发送、接收、按需解码、边界校验、跨平台一致性与回归测试
- [x] **可靠性**: 明确超时/失败/超限/校验失败处理，采用“全量成功或整体失败”策略
- [x] **可扩展性**: 复用 018 平台适配层与协议扩展点，不引入耦合平台分支
- [x] **可观测性**: 在编码、上传、发送、下载、解码关键节点记录结构化日志并复用现有错误分类
- [x] **版本管理**: 规格与计划文档产物按 SemVer 递增并记录 CHANGELOG

Phase 1 设计复检结果：通过（研究与数据模型未引入额外宪章冲突）。

## Project Structure

### Documentation (this feature)

```text
specs/019-combine-message/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── combine-message.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── message/
│   └── create-message.ts
├── core/message/
│   ├── message-sender.ts
│   └── message-receiver.ts
├── protocol/msync/
│   ├── codec.ts
│   ├── proto.ts
│   └── types.ts
├── platform/
│   ├── upload/
│   └── proto/
└── upload/

tests/
├── unit/message/
├── unit/core/message/
├── unit/protocol/
├── unit/platform/
└── contract/
```

**Structure Decision**: 采用单项目结构，优先在既有消息、协议、上传与平台适配模块中扩展 `combine` 能力，避免新建并行子系统。

## Phase 0: Research

输出：`specs/019-combine-message/research.md`

- 固化“接收回调元信息 + 按需拉取详情 API”的交互边界
- 固化 `messageList` 输入约束（类型白名单、顺序保持、300 条上限）
- 固化按需解码失败策略（全量成功或整体失败）
- 固化跨平台下载与二进制解码兼容策略（对齐旧工程 `downloadAndParseCombineMessage` 语义）

## Phase 1: Design & Contracts

输出：

- `specs/019-combine-message/data-model.md`
- `specs/019-combine-message/contracts/combine-message.openapi.yaml`
- `specs/019-combine-message/quickstart.md`

设计要点：

1. 定义合并消息草稿、编码载荷、附件资源、回调事件与详情解码结果模型
2. 明确发送链路分层：校验 -> 编码 -> 上传 -> 最终 `combine` 消息发送
3. 明确接收链路分层：协议解析 -> 元信息回调 -> 按需下载解码接口
4. 固化边界约束：`combineLevel <= 10`、条数 <= 300、系统消息拒绝、解析失败整体失败
5. 明确跨平台兼容点：文件对象/路径差异、下载 API 差异、二进制读取差异

## Agent Context Update

执行命令：

```bash
.specify/scripts/bash/update-agent-context.sh cursor-agent
```

预期：更新 `.cursor/rules/specify-rules.mdc` 与上下文技术栈/最近变更，使后续 `/speckit.tasks` 与实现阶段保持一致。

## Complexity Tracking

无额外豁免项。
