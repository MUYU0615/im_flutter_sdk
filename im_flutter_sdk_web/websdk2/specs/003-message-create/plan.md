# 实施方案：创建消息方法（createTextMessage 等）

**Branch**: `003-message-create` | **Date**: 2026-01-22 | **Spec**: `specs/003-message-create/spec.md`  
**Input**: 规范文档 `/specs/003-message-create/spec.md`

## 概述

新增一组创建消息的 API（createTextMessage 等），以统一的 Message 接口构造消息对象，自动填充发送者信息，默认生成本地 msgLocalId 与本地 timestamp，并与移动端消息字段尽量对齐。创建方法仅负责构造数据，不包含发送/存储流程；公开创建入口由 ChatManager 承载。

## 技术背景

- **语言/版本**: TypeScript 5.x
- **主要依赖**: Zod（参数校验）、Vitest（单元测试）
- **目标平台**: Web SDK（H5 + 小程序/uniapp）
- **性能目标**: 创建方法为纯同步/轻量逻辑
- **约束**: sender 从当前登录态自动填充；不接受 sender 入参

## 方案要点

1. **API 入口与调用方式**
   - 推荐通过 `client.chatManager.createTextMessage`、`client.chatManager.createImageMessage` 等语法糖创建消息。
   - `src/message/create-message.ts` 保留内部工厂实现，`ChatManager` 负责读取当前登录用户并注入 `sender`。
   - `ChatClient` 在 `login` 后保存当前用户信息（至少 `userId`），但不对外公开创建消息方法。

2. **类型与数据结构统一**
   - 扩展 `src/types/index.ts` 的 `MessageType` 与 `MessageBody`，补齐 `cmd/voice/file/video/location/custom` 等类型与 Body。
   - 补充创建方法的入参类型（如 `CreateTextMessageParams`），并保持与 `specs/001-im-sdk-refactor/data-model.md` 一致。
   - 文本内容字段统一命名为 `content`：`CreateTextMessageParams.content` 作为创建入参，`TextMessageBody.content` 作为公开消息体字段；底层 MSync 协议仍映射到协议 `text` 字段。

3. **参数校验与错误**
   - 新增 `src/validators/message-create.ts`，使用 Zod 校验 `conversationId/conversationType`、`body`、`ext` 与必填字段；ChatManager 入口负责补齐 `sender`。
   - 无法获取 `sender.userId` 时抛出清晰错误（`ValidationError`）。

4. **本地 msgLocalId 与时间戳**
   - 创建时由 SDK 内部生成 `msgLocalId`（优先 `crypto.randomUUID()`，否则使用时间戳 + 随机数），不接受外部传入。
   - `timestamp` 默认 `Date.now()`；`msgServerId` 默认空字符串；`status` 默认 `sending`。

5. **data 与本地 url 生成**
   - 当 `data` 提供但 `url` 缺失时：
     - H5（`File`）：使用 `URL.createObjectURL(file)` 生成本地可用 url。
     - 小程序/uniapp：使用 `data.path` 作为本地 url。
   - 仅创建阶段使用 `data`；接收消息不包含 `data`。

6. **与移动端对齐策略**
  - `conversationType` 对齐移动端 `ChatType`（SINGLE/GROUP/CHATROOM）。
   - `MessageType` 与 `EMMessageBodyType` 保持语义一致（voice 对齐移动端语音）。
   - `ext` 采用键值对 JSON 结构，对齐移动端 `setAttribute`。

7. **消息扩展字段策略（与 017 对齐）**
   - 在创建入参层统一支持 `receiverList`、`deliverOnlineOnly`、`priority`，并做基础合法性校验。
   - 创建结果在 Message 顶层补充 `direct`，默认值为 `SEND`。
   - `CmdMessageBody.deliverOnlineOnly` 保持兼容，推荐以 Message 顶层字段为准。

## 工程结构

```text
src/
├── managers/
│   └── chat-manager.ts            # 创建消息公开入口
├── message/
│   └── create-message.ts          # 新增：消息创建函数
├── types/
│   ├── index.ts                   # 扩展 MessageType/MessageBody
│   └── message-create.ts          # 新增：创建方法入参类型
├── validators/
│   ├── message-create.ts          # 新增：创建方法校验
│   └── validator.ts               # 复用统一校验入口
└── utils/
    └── message-id.ts              # 新增：msgLocalId 生成

specs/003-message-create/
├── spec.md
├── plan.md
└── tasks.md
```

## 测试策略

- **文本消息**：自动填充 sender、msgLocalId、timestamp；`content` 空文本校验；ChatManager 入口自动读取登录态。
- **图片/文件/语音/视频**：`data` 与 `url` 至少其一必填；本地 url 生成逻辑。
- **命令/自定义**：action/event 校验；`createCmdMessage` 不再接受或写入命令 `params`；`createCustomMessage` 继续支持 `params` 与 `ext` JSON 校验。
- **扩展字段**：`receiverList` 非空字符串数组校验；`deliverOnlineOnly/priority` 透传与默认值校验；`direct` 默认值校验。
- **错误路径**：未登录或缺少 sender 时抛出明确错误。

## 风险与权衡

- **类型兼容性**：现有 `MessageType` 使用 `audio`，需统一为 `voice` 并评估对既有代码影响。
- **环境差异**：`URL.createObjectURL` 仅在 H5 可用，小程序/uniapp 需走 `path`。

## 复杂度跟踪

中等：涉及类型体系扩展与跨端文件对象兼容。
