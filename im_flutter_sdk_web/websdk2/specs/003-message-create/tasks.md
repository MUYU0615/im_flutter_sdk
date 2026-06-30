---

description: "创建消息方法（createTextMessage 等）任务清单"
---

# 任务清单：创建消息方法（createTextMessage 等）

**Input**: 设计文档 `/specs/003-message-create/`  
**Prerequisites**: spec.md（必需）, plan.md（必需）  
**Tests**: 遵循 TDD 要求，包含单元测试任务  
**Organization**: 任务按用户故事分组，确保每个故事可独立验证

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可并行执行（不同文件/无依赖）
- **[Story]**: 对应用户故事（US1/US2/US3/US4/US5）
- 描述中包含具体文件路径

---

## 阶段 1：类型与校验基础

- [x] T001 更新 `src/types/index.ts`，补齐 `MessageType` 与 `MessageBody`（新增 voice/cmd/file/video/location/custom 等）
- [x] T002 [P] 新增 `src/types/message-create.ts`，定义各 create 方法入参类型
- [x] T003 [P] 新增 `src/validators/message-create.ts`，定义参数校验 schema（conversationId/conversationType/ext/body/必填字段）
- [x] T004 [P] 更新 `specs/001-im-sdk-refactor/data-model.md` 中 MessageBody 描述，确保与 spec 对齐

---

## 阶段 2：用户故事 1 - 创建文本消息（Priority: P1）

**Goal**: 支持 `createTextMessage`，自动填充 sender 与默认字段

### Tests for User Story 1

- [x] T005 [P] [US1] 新增单元测试 `tests/unit/message/create-text-message.test.ts`
  - 生成 msgLocalId、timestamp、status
  - 未登录抛出错误
  - 空文本校验失败

### Implementation for User Story 1

- [x] T006 [US1] 在 `src/chat-client.ts` 增加 `currentUserId` 保存与 getter
- [x] T007 [US1] 新增 `src/message/create-message.ts`，实现 `createTextMessage`

---

## 阶段 3：用户故事 2 - 创建图片消息（Priority: P1）

**Goal**: 支持 `createImageMessage`，兼容 `data` 与本地 url

### Tests for User Story 2

- [x] T008 [P] [US2] 新增单元测试 `tests/unit/message/create-image-message.test.ts`
  - 校验必填字段
  - 仅 data 时生成本地 url
  - isGif 标记

### Implementation for User Story 2

- [x] T009 [US2] 在 `src/message/create-message.ts` 实现 `createImageMessage`
- [x] T010 [US2] 新增 `src/utils/message-id.ts` 与本地 url 生成工具

---

## 阶段 4：用户故事 3 - 创建文件/语音/视频/位置消息（Priority: P2）

**Goal**: 支持多媒体与位置消息构造

### Tests for User Story 3

- [x] T011 [P] [US3] 新增单元测试 `tests/unit/message/create-media-message.test.ts`
  - file/voice/video/location 类型与字段校验
  - 仅 data 时生成本地 url

### Implementation for User Story 3

- [x] T012 [US3] 在 `src/message/create-message.ts` 实现 `createFileMessage`/`createVoiceMessage`/`createVideoMessage`/`createLocationMessage`

---

## 阶段 5：用户故事 4 - 创建命令/自定义消息（Priority: P2）

**Goal**: 支持 cmd/custom 构造，ext 兼容移动端 setAttribute

### Tests for User Story 4

- [x] T013 [P] [US4] 新增单元测试 `tests/unit/message/create-cmd-custom-message.test.ts`
  - action/event 校验
  - ext JSON 校验

### Implementation for User Story 4

- [x] T014 [US4] 在 `src/message/create-message.ts` 实现 `createCmdMessage`/`createCustomMessage`

---

## 阶段 6：用户故事 5 - 对齐移动端与导出（Priority: P1）

**Goal**: 对齐字段映射并对外导出创建方法

- [x] T015 [US5] 更新公开入口：`src/index.ts` 不再导出独立创建函数，`ChatManager` 暴露创建方法并继续导出创建参数类型
- [x] T016 [US5] 校验 MessageType 与移动端语义一致（voice/cmd 等）

---

## 阶段 7：收尾与规范

- [x] T017 [P] 为新增代码补齐逐行注释，符合项目注释规范

---

## 阶段 8：消息扩展字段同步（关联 017）

- [ ] T018 [US6] 扩展 `src/types/index.ts` Message 顶层字段：`direct/receiverList/deliverOnlineOnly/priority/isBroadcast/isContentReplaced`
- [ ] T019 [P] [US6] 扩展 `src/types/message-create.ts` 与 `src/validators/message-create.ts` 的 `receiverList/deliverOnlineOnly/priority` 入参与校验
- [ ] T020 [US6] 更新 `src/message/create-message.ts`，创建消息默认设置 `direct = 'SEND'` 并透传扩展字段
- [ ] T021 [P] [US6] 更新 `tests/unit/message/create-text-message.test.ts` 与 `tests/unit/message/create-cmd-custom-message.test.ts`，覆盖扩展字段创建场景

---

## 阶段 9：文本内容字段命名收敛（2026-05-13）

- [x] T022 [US1] 将 `CreateTextMessageParams.message` 重命名为 `content`，同步 `src/types/message-create.ts` 与 `src/validators/message-create.ts`
- [x] T023 [US1] 将 `TextMessageBody.message` 重命名为 `content`，同步创建、发送、接收、协议编解码与流式消息处理链路
- [x] T024 [P] [US1] 更新文本消息相关单测、demo、README、API 文档与 031/037 示例，统一使用 `content`

## 阶段 10：创建消息公开入口收敛（2026-05-14）

- [x] T025 [US1-US5] 将公开创建消息入口从 `ChatClient.createXMessage` 迁移到 `ChatManager.createXMessage`
- [x] T026 [US1-US5] 移除 `src/index.ts` 对独立 `createXMessage` 工厂函数的公开导出，保留创建参数类型导出
- [x] T027 [P] [US1-US5] 更新 demo、小程序 demo、单测、README、API 文档与 031/037 规格示例，统一使用 `client.chatManager.createXMessage`

---

## 依赖与执行顺序

- **阶段 1**: 必须先完成类型与校验基础
- **阶段 2-5**: 可按优先级推进（P1 先于 P2）
- **阶段 6**: 在核心创建方法完成后执行
- **阶段 7**: 随实现同步或收尾完成
- **阶段 8**: 在 017 规格确认后执行，确保与 protobuf 收发层行为一致

## 阶段 11：创建入参字段收敛（2026-05-15）

- [x] T026 [US1] 从 `CreateMessageBaseParams` 移除 `msgLocalId`（SDK 内部生成，不接受外部传入）
- [x] T027 [US1] 从 `CreateTextMessageParams` 移除 `translations`（由翻译 API 内部填充，不作为创建入参）
- [x] T028 [P] [US1] 同步更新 `src/validators/message-create.ts` 与 `src/message/create-message.ts`
- [x] T029 [P] [US1] 补充单测：验证外部传入 `msgLocalId` 被忽略、外部传入 `translations` 不出现在消息体中

## 阶段 12：图片消息创建入参简化（2026-05-15）

- [x] T030 [US2] `CreateImageMessageParams` 移除 `secret`，`filename`/`filetype`/`width`/`height`/`isGif`/`fileLength` 全部改可选
- [x] T031 [US2] 同步更新 `createImageMessageSchema`、`create-message.ts`（isGif 默认 false）
- [x] T032 [US2] `ImageMessageBody` 中 `filename`/`filetype`/`width`/`height` 改为可选（发送前补全）
- [x] T033 [US2] `attachment-uploader.ts` 原图路径：width/height 缺失时调用 `getImageInfo` 自动获取
- [x] T034 [US2] `attachment-downloader.ts` 中 filename/filetype 加 fallback 兜底
- [x] T035 [US2] 创建入参 `originalImageUrl` 重命名为 `originalUrl`，同步更新 schema、create-message.ts 与测试

## 阶段 13：文件/语音/视频消息创建入参统一（2026-05-15）

- [x] T036 [US3] `CreateFileMessageParams`/`CreateVoiceMessageParams`/`CreateVideoMessageParams` 中 `url` 重命名为 `originalUrl`，`filename`/`filetype` 改可选，移除 `secret`
- [x] T037 [US3] 同步更新 schema、`create-message.ts`、`FileMessageBody`/`VoiceMessageBody`/`VideoMessageBody`（filename/filetype 改可选）
- [x] T038 [P] [US3] 补充单测：只传 data 创建成功、使用 originalUrl 字段名创建成功

## 阶段 14：合并消息入参简化（2026-05-15）

- [x] T039 [US4] `CreateCombineMessageParams.messageList` 类型从 `CombineMessageItem[]` 改为 `Message[]`，用户直接传 Message 对象
- [x] T040 [US4] `CombineMessageBody.messageList` 类型同步改为 `Message[]`
- [x] T041 [US4] 移除 cmd 类型排除限制，所有消息类型均可加入合并消息
- [x] T042 [US4] 同步更新 schema、combine-message-constraints、combine-payload-codec、message-sender、downloader
- [x] T043 [P] [US4] 补充单测：Message 对象含 cmd 类型可创建成功、完整 Message 字段可传入

## 阶段 15：Message 新增 from/to 字段（2026-05-15）

- [x] T044 [US5] `Message` 接口新增 `from`（发送方 userId）和 `to`（接收方标识）字段
- [x] T045 [US5] 创建消息时自动填充 `from = sender.userId`，`to = conversationId`
- [x] T046 [US5] 接收消息解码时从协议填充 `from = senderId`，`to = receiverId`
- [x] T047 [P] [US5] 补充单测：验证创建消息后 from/to 正确填充

## 阶段 16：Message 新增 reactions/groupReadCount/needGroupReadReceipt（2026-05-15）

- [x] T048 [US5] 定义 `MessageReaction` 接口，`Message` 新增 `reactions`/`groupReadCount`/`needGroupReadReceipt` 字段
- [x] T049 [US5] 创建消息入参支持 `needGroupReadReceipt`，`buildMessage` 透传
- [x] T050 [US5] 接收消息解码时从 `meta.meta` 解析 `reactions` 并填充
- [x] T051 [P] [US5] 补充单测：needGroupReadReceipt 透传、reactions/groupReadCount 默认 undefined

## 阶段 17：命令消息创建入参收敛（2026-05-18）

- [x] T052 [US4] 从 `CreateCmdMessageParams` 与 `createCmdMessageSchema` 移除命令 `params` 入参
- [x] T053 [US4] 更新 `src/message/create-message.ts` 与 `ChatManager` 创建链路，确保 `createCmdMessage` 不再写入 `CmdMessageBody.params`
- [x] T054 [P] [US4] 更新 `tests/unit/message/create-cmd-custom-message.test.ts`，覆盖无 `params` 创建与旧运行时输入忽略
- [x] T055 [P] [US4] 更新 demo/小程序 demo 的命令消息表单与草稿单测，移除命令参数输入
