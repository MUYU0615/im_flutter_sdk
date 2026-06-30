# 实施方案：消息 webhookEnv 出站路由字段

**Branch**: `040-message-meta-env` | **Date**: 2026-05-19 | **Spec**: [spec.md](/Users/wangmeng/IdeaProjects/easemob-font/WEBSDK2/specs/040-message-meta-env/spec.md)
**Input**: Feature specification from `/specs/040-message-meta-env/spec.md`

## Summary

本期在现有消息发送主链路上新增一个轻量的出站路由字段 `webhookEnv`。实现方式是：在 protobuf `Meta` 中增加 `optional string env = 13`，在公开 `Message` 与所有 `Create*MessageParams` 上增加 `webhookEnv?: string`，并在消息创建时透传该字段，在 `MsyncCodec.encodeChatMessage()` 编码出站协议时写入 `Meta.env`。同时更新 demo 发送面板，使联调时可直接在 UI 中填写 `webhookEnv` 并随消息创建主路径出站。

本特性只保证出站能力，不扩展下行解析、历史消息、缓存、会话列表、资料同步或全局默认配置。`webhookEnv` 允许不传，也允许空字符串；实现需要确保它与既有 `receiverList`、`deliverOnlineOnly`、`priority`、`needGroupReadReceipt` 等发送字段共存且不互相影响。demo UI 仅增加输入与透传，不要求展示服务端回包中的 `webhookEnv`。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）
**Primary Dependencies**: 现有 `ChatClient`、`ChatManager`、消息创建模块、zod 校验器、MSync protobuf 编解码、Vitest、Vite、eslint
**Storage**: N/A；本功能不新增持久化，也不改现有缓存结构
**Testing**: `npm run test:run`、`npm run type-check`；如实现阶段涉及导出面异常，再补 `npm run lint`
**Target Platform**: Web SDK 主库公开消息创建与发送链路 + 浏览器 demo 发送面板
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`specs/`、`demo/`）
**Performance Goals**: `env` 透传与编码保持 O(1) 字段复制，不增加额外网络请求、异步流程或额外序列化轮次
**Constraints**:
- `webhookEnv` 仅为单条消息的可选字符串字段，不新增全局默认值
- `webhookEnv` 只保证出站，不做下行解码公开透传
- `webhookEnv` 允许 `undefined` 与 `''`
- `chatManager.createXMessage(...)` 与手写 `Message` 后直接 `sendMessage(message)` 都必须支持
- `combine` 只处理外层消息的 `webhookEnv`，不扩展子消息列表语义
- demo 只增加 `webhookEnv` 输入与创建参数透传，不扩展消息列表展示或接收态展示
- 本期不修改真实环境测试脚本
**Scale/Scope**: 涉及 `proto` 定义、公开消息类型、创建消息基础入参、运行时参数校验、消息创建透传、MSync 出站编码、demo 发送面板与 unit/UI 验证

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **性能优先**: 只新增字段透传和编码，不引入额外网络请求或后台任务。
- [x] **类型安全**: `Message`、`CreateMessageBaseParams` 与相关导出面都使用显式 `webhookEnv?: string`，不引入 `any`。
- [x] **测试驱动**: 计划补消息创建与协议编码单元测试，并补 demo UI 验证路径，覆盖正常值、空串和未传场景。
- [x] **可靠性**: `env` 加入不得破坏既有发送字段、消息状态流转和编码行为。
- [x] **可扩展性**: 将 `env` 放在公共基础类型与 `Meta` 中，后续新增消息类型可自动继承。
- [x] **可观测性**: 本字段只是透传，不新增额外日志与敏感输出；错误仍走现有校验体系。
- [x] **版本管理**: 若后续进入实现与提交阶段，需按仓库规则先验证，再更新版本号与 `CHANGELOG.md`。

## Project Structure

### Documentation (this feature)

```text
specs/040-message-meta-env/
├── spec.md
└── plan.md
```

### Source Code (repository root)

```text
src/
├── types/
│   ├── index.ts
│   └── message-create.ts
├── validators/
│   └── message-create.ts
├── message/
│   └── create-message.ts
└── protocol/
    └── msync/
        ├── proto-source.json
        ├── proto.ts
        └── codec.ts

tests/
├── unit/
│   ├── message/
│   └── protocol/

demo/
└── src/components/
    └── SendPanel.tsx
```

**Structure Decision**: 保持现有单仓库结构，不新增新模块或 helper 层。`webhookEnv` 通过已有基础类型 `CreateMessageBaseParams` 和 `Message` 接入，通过 `buildMessage()` 统一透传，通过 `MsyncCodec.encodeChatMessage()` 统一编码；demo 侧直接在 `SendPanel` 上新增单一输入源，并把它并入统一 `conversationLocator`/创建参数拼装流程。

## Phase 0: Research

本特性范围足够收敛，不需要单独 `research.md`。已在 `spec.md` 中固化以下关键澄清：

1. `webhookEnv` 同时进入公开 `Message` 与所有 `Create*MessageParams`
2. `webhookEnv` 允许 `undefined` 与空字符串
3. 只保证出站，不做下行解析
4. 手写 `Message` 后直接 `sendMessage(message)` 也要支持
5. `combine` 仅处理外层消息，不扩展子消息 `webhookEnv`
6. demo 发送面板要支持填写 `webhookEnv`

## Phase 1: Design & Contracts

本特性不需要额外 `contracts/` 或 `openapi` 产物，设计直接体现在现有类型与协议定义变更中。

### 1. 协议定义

- 在 `src/protocol/msync/proto-source.json` 的 `Meta.fields` 中新增 `env: { type: "string", id: 13 }`
- 在 `src/protocol/msync/proto.ts` 中同步新增 `Meta.env`
- 保证 source 与运行时产物字段号一致

### 2. 公开类型与创建入参

- 在 `src/types/index.ts` 的 `Message` 上新增 `webhookEnv?: string`
- 在 `src/types/message-create.ts` 的 `CreateMessageBaseParams` 上新增 `webhookEnv?: string`
- 依赖基础入参继承，让全部 `Create*MessageParams` 自动支持 `webhookEnv`

### 3. 运行时校验与消息创建

- 在 `src/validators/message-create.ts` 中允许 `webhookEnv` 作为可选字符串
- 不对 `webhookEnv` 做 `.min(1)` 校验，确保 `''` 可通过
- 在 `src/message/create-message.ts` 的 `buildMessage()` 中透传 `params.webhookEnv`

### 4. 出站编码

- 在 `src/protocol/msync/codec.ts` 的 `encodeChatMessage()` 中，从 `message.webhookEnv` 写入 `Meta.env`
- `message.webhookEnv === undefined` 时保持兼容，不强制写字段
- `message.webhookEnv === ''` 时允许按空串编码

### 5. 测试设计

- `tests/unit/message/`：验证 `createTextMessage()` 至少一条主路径能透传 `webhookEnv` 与空字符串
- `tests/unit/protocol/`：验证 `encodeChatMessage()` 能把 `webhookEnv` 编码到 `Meta.env`
- demo 手动或自动验证：确认 `SendPanel` 填写 `webhookEnv` 后，发送主路径构建出的消息对象包含相同值
- 复用现有消息创建与协议解码测试风格，不新增真实环境依赖

## Post-Design Constitution Check

- [x] **性能优先**: 设计仅增加静态字段透传和一次编码字段写入
- [x] **类型安全**: 公开类型、运行时校验与协议字段三层保持一致
- [x] **测试驱动**: 正常值、空串、未传三类场景都有明确单测落点，demo UI 也有独立验证路径
- [x] **可靠性**: 与既有路由/优先级/已读回执字段共存的要求已写入设计
- [x] **可扩展性**: 统一接入基础类型，后续消息类型无需重复加字段
- [x] **可观测性**: 不新增隐式行为，不更改既有错误体系
- [x] **版本管理**: 实现阶段需按仓库规则补验证、版本号、CHANGELOG 与中文 commit

## Phase 2: Task Planning Input

后续 `tasks.md` 至少拆成以下工作组：

1. 协议定义更新：`Meta.env` 同步到 `proto-source.json` 与 `proto.ts`
2. 公开类型更新：`Message.webhookEnv` 与 `CreateMessageBaseParams.webhookEnv`
3. 运行时接入：参数校验、`buildMessage()` 透传、`sendMessage` 主链路兼容
4. 协议编码接入：`MsyncCodec.encodeChatMessage()` 写入 `Meta.env`
5. demo UI 接入：`SendPanel` 新增 `webhookEnv` 输入并接入各类 `createXMessage(...)`
6. 测试与验证：消息创建透传、协议编码正常值/空串/未传场景，及 demo UI 验证
7. 收尾验证：`type-check`、`test:run`、版本号、`CHANGELOG.md`、中文 commit

## Agent Context Update

本特性未引入新的语言、框架、存储或外部服务，只在既有消息发送模型上增加一个可选出站字段，因此无需额外 agent context 更新。

## Complexity Tracking

无 Constitution 例外。复杂度较低，主要风险在于：

- 公开类型、运行时校验与协议字段三层不一致
- 空字符串被误判为非法值
- 新字段影响既有发送编码断言
- demo UI 只接到部分消息类型，造成发送面板行为不一致

这些风险都可以通过小范围单元测试覆盖控制。
