# 实施方案：消息模型替换 channel 为会话字段

**Branch**: `001-im-sdk-refactor` | **Date**: 2026-05-11 | **Spec**: [spec.md](/Users/zhangdong/code/websdk2/specs/037-message-conversation-fields/spec.md)
**Input**: Feature specification from `/specs/037-message-conversation-fields/spec.md`

> 说明：本规格按用户要求在当前分支手工创建。`.specify/scripts/bash/setup-plan.sh --json` 与 prerequisite 脚本会按当前分支定位到 `specs/001-im-sdk-refactor`，因此本 plan 以 `specs/037-message-conversation-fields/` 为显式目标目录手工生成。

## Summary

本特性是一次公开消息模型 breaking change：移除 `Message.channel`、消息创建入参中的 `channel`、合并消息子项中的 `channel`，统一替换为 `conversationId` 与 `conversationType`。`conversationType` 复用现有 canonical 会话类型 `singleChat | groupChat | chatRoom`，与 ChatManager / Conversation API 的会话定位命名保持一致。

实现范围只覆盖消息模型与消息对象流经链路，不重命名现有 ChatManager / Conversation 公开方法参数。旧 `channel` 消息对象不兼容、不迁移；公开运行时调用若仍传入旧字段，按现有参数校验错误处理，不新增迁移专用错误码或专门文案。`ChannelReference` / `ChannelType` 不再作为公开类型导出。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）
**Primary Dependencies**: 现有 `ChatClient`、`ChatManager`、消息创建模块、zod 校验器、`MessageSender` / `MessageReceiver`、MSync protobuf 编解码、`AttachmentUploader`、`CacheManager`、`EventHub`、profile sync 队列、Vitest、Vite、Playwright
**Storage**: 不新增持久化；conversation cache 继续使用现有 localStorage 机制，但消息驱动的会话摘要输入从 `message.channel` 改为 `message.conversationId/conversationType`
**Testing**: `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run test:gate:pr`、必要时 `npm run test:e2e`、`npm run docs:api:check`
**Target Platform**: Web SDK 主库 + 浏览器 demo + 小程序 demo 相关消息创建示例
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`demo/`、`docs/`）
**Performance Goals**: 字段替换不得增加消息发送、接收、上传、缓存更新和事件派发的额外网络往返；协议映射保持 O(1) 字段转换
**Constraints**:
- 公开消息对象只使用 `conversationId/conversationType`
- 现有 ChatManager / Conversation 方法参数继续使用 `conversationId/conversationType`，不做额外命名迁移
- 旧 `channel` 输入不兼容、不自动转换
- `ChannelReference` / `ChannelType` 从公开导出面移除
- 服务端协议字段不改名，SDK 内部负责映射
- 对外 API 注释、文档和迁移说明必须同步
- 测试 fixture、demo、类型测试必须全量切换新模型
**Scale/Scope**: 涉及公开类型、消息创建、参数校验、协议编解码、上传链路、会话缓存、事件系统、profile sync、合并消息、demo、文档与 unit/integration/e2e/types 测试的系统性迁移

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 仅替换消息定位字段并保持同步字段映射，不引入额外网络请求或阻塞流程。
- [x] **类型安全**: 公开 `Message`、`Create*MessageParams`、`CombineMessageItem`、事件 payload 和导出面都必须 strict typing，不保留旧 channel 双模型。
- [x] **测试驱动**: spec 已覆盖 unit / integration / E2E / docs gate；本 plan 明确测试落点。
- [x] **可靠性**: 下行单聊 conversationId 推导、群聊/聊天室区分、附件上传目标、会话摘要更新和 profile sync 都列为关键验证路径。
- [x] **可扩展性**: 公开层统一到 conversation canonical naming，服务端协议映射封装在内部，后续扩展不会继续泄漏 channel 概念。
- [x] **可观测性**: 字段缺失、协议上下文不足、上传目标异常等错误继续走现有结构化日志与 SDKError 体系，不输出敏感信息。
- [x] **版本管理**: 本特性为 breaking change，已要求更新版本号、CHANGELOG 和迁移示例。

Phase 1 设计复检：通过。研究与设计产物均保持“无旧 channel 兼容层、无新增错误码、公开字段统一 conversationId/conversationType”的澄清结论。

## Project Structure

### Documentation (this feature)

```text
specs/037-message-conversation-fields/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    └── message-conversation-fields.md
```

### Source Code (repository root)

```text
src/
├── chat-client.ts
├── index.ts
├── types/
│   ├── index.ts
│   ├── message-create.ts
│   ├── chat-manager.ts
│   └── channel.ts
├── validators/
│   └── message-create.ts
├── message/
│   ├── create-message.ts
│   └── combine-payload-codec.ts
├── protocol/
│   ├── msync/codec.ts
│   └── protobuf/
├── core/message/
│   ├── message-sender.ts
│   ├── message-receiver.ts
│   ├── message-queue.ts
│   ├── attachment-downloader.ts
│   └── profile-sync/
├── upload/
│   ├── attachment-uploader.ts
│   ├── simple-upload.ts
│   ├── multipart-upload.ts
│   └── types.ts
├── cache/
│   └── cache-manager.ts
└── managers/
    └── chat-manager.ts

tests/
├── unit/
│   ├── message/
│   ├── core/message/
│   ├── protocol/
│   ├── cache/
│   ├── chat-client/
│   └── managers/
├── integration/
│   ├── chat-manager/
│   ├── miniapp-demo/
│   └── mock/
├── types/
└── e2e/

demo/
└── src/components/
    ├── SendPanel.tsx
    ├── ChatManagerPanel.tsx
    └── ProfileSyncPanel.tsx
```

**Structure Decision**: 保持单仓库单项目结构，不新增 manager、不新增持久化、不新增兼容 adapter。实现应优先增加少量内部转换辅助函数，例如 `toProtocolChatType(conversationType)`、`resolveMessageConversationContext(message)`，避免在业务代码中散落字符串判断。

## Phase 0: Research

输出：

- `specs/037-message-conversation-fields/research.md`

研究结论已固化以下决策：

1. 公开消息定位字段使用 `conversationId/conversationType`，不用 `chatType`。
2. 旧 `channel` 不公开兼容、不迁移、不自动转换。
3. `ChannelReference` / `ChannelType` 从公开导出面移除。
4. 服务端协议继续使用内部 chat type / JID 语义，由 SDK 内部映射。
5. 参数错误复用现有校验错误体系，不新增迁移专用错误码。

## Phase 1: Design & Contracts

输出：

- `specs/037-message-conversation-fields/data-model.md`
- `specs/037-message-conversation-fields/contracts/message-conversation-fields.md`
- `specs/037-message-conversation-fields/quickstart.md`

设计要点：

### 1. 公开类型面迁移

- `Message` 新增必填 `conversationId` / `conversationType`，移除 `channel`
- `CombineMessageItem` 同步迁移
- `CreateMessageBaseParams` 同步迁移，所有 `Create*MessageParams` 继承新字段
- `ChannelReference` / `ChannelType` 不再从主入口公开导出
- 复用或对齐 `ChatConversationType = 'singleChat' | 'groupChat' | 'chatRoom'`

### 2. 创建消息与校验

- `validators/message-create.ts` 将 `channelReferenceSchema` 替换为 conversation locator schema
- `receiverList` 规则改为 `conversationType === 'groupChat'`
- `message/create-message.ts` 的 `buildMessage` 输出新字段
- 对旧 `channel` 不做 preprocess / transform

### 3. 协议编解码

- `MsyncCodec.encodeChatMessage` 从 `message.conversationId/conversationType` 计算：
  - MSync message type
  - `MessageBody.to`
  - meta target JID / domain
  - route type / directed users / room priority ext
- `decodeChatMessage` 下行输出新字段
- 单聊下行 `conversationId` 必须稳定解析为当前用户以外的对端用户
- 群聊 / 聊天室按协议类型或上下文区分为 `groupChat` / `chatRoom`

### 4. 上传、缓存、事件与 profile sync

- `AttachmentUploader`、simple upload、multipart upload 从新字段推导 `chat-type` 与 `chat-target`
- `CacheManager.buildConversationFromMessage` 从新字段计算 conversation summary
- `MessageReceiver` 记忆消息上下文时使用新字段
- `ChatClient` profile sync 的群名片逻辑改为 `conversationType === 'groupChat'`
- `ChatManager` 接受 `Message` 的校验改为读取 `message.conversationType`

### 5. Protobuf / 合并消息 / 下载链路

- `src/protocol/protobuf/messages.proto`、encoder、decoder 如仍作为公开消息序列化模型使用，必须同步从 `ChannelReference channel` 改为 `conversationId/conversationType`
- 合并消息 payload 编解码中的子消息使用新字段
- 附件下载和合并消息下载解析返回的消息对象必须不含 `channel`

### 6. Demo、文档与测试

- demo 发消息 UI 可继续显示“会话类型”，但内部创建消息必须传 `conversationType`
- `docs/reference`、README 示例、API JSDoc 和迁移说明全部改新字段
- 类型测试必须验证旧 `channel` 不再被公开类型接受
- E2E 至少覆盖 demo 发送主路径和一条消息动作链路

## Phase 2: Task Planning Input

后续 `/speckit.tasks` 应至少拆出以下工作组：

1. 类型与导出面迁移
2. 创建消息与校验迁移
3. MSync 编解码迁移
4. 上传 / 缓存 / 事件 / profile sync 迁移
5. 合并消息 / protobuf / 下载链路迁移
6. demo 与文档迁移
7. 单元、集成、类型、E2E 与 docs gate 验证

## Agent Context Update

项目脚本默认按当前分支定位 feature。由于本规格在当前分支手工创建，若需要更新 agent context，应在 plan 文件落地后显式运行：

```bash
SPECIFY_FEATURE=037-message-conversation-fields .specify/scripts/bash/update-agent-context.sh codex
```

本 plan 本身未引入新的语言、框架或存储技术，仅延续 TypeScript 5.x、zod、protobufjs、Vitest、Vite、Playwright 与现有 SDK 架构。

## Complexity Tracking

无 Constitution 例外。复杂度来自公开消息模型 breaking change 的影响面，但该复杂度不可通过保留旧 `channel` 兼容层降低；兼容层会制造双模型长期成本，已被澄清为不采用。
