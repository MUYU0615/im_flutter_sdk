# Feature Specification: 创建消息方法（createTextMessage 等）

**Feature Branch**: `003-message-create`  
**Created**: 2026-01-22  
**Status**: Draft  
**Input**: User description: "实现创建消息方法，参考 User Story 13，提供 createTextMessage 等创建消息的方法，并对齐 Channel 使用方式。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 创建文本消息（Priority: P1）

开发者需要通过 `ChatManager` 实例的 `createTextMessage` 快速构造文本消息对象，用于发送、缓存或展示。

**Why this priority**: 文本消息是最核心的消息类型，也是构建其他消息类型的基础。

**Independent Test**: 调用 `createTextMessage`，验证返回的 Message 符合 data-model 的 Message 接口，`type` 为 `text`，`body.content` 正确，默认状态为 `sending`。

**Acceptance Scenarios**:

1. **Given** 已注册 `ChatManager`, **When** 调用 `client.chatManager.createTextMessage`, **Then** 返回 `Message` 且 `type = text`、`body.content` 为输入内容。
2. **Given** 未提供 `msgLocalId`, **When** 调用 `createTextMessage`, **Then** 自动生成唯一 `msgLocalId`。
3. **Given** 空文本内容, **When** 调用 `createTextMessage`, **Then** 抛出参数校验错误。
4. **Given** 当前登录用户信息可用, **When** 调用 `createTextMessage`, **Then** `sender` 自动填充为当前用户。
5. **Given** 当前用户信息缺失, **When** 调用 `createTextMessage`, **Then** 抛出参数/状态错误并提示缺少 `sender.userId`。

---

### User Story 2 - 创建图片消息（Priority: P1）

开发者需要通过 `ChatManager` 实例的 `createImageMessage` 构造图片消息，支持 GIF/缩略图等字段。

**Why this priority**: 图片消息是常用多媒体类型，要求与移动端字段尽量统一。

**Independent Test**: 调用 `createImageMessage`，验证返回的 Message 符合 data-model 的 ImageMessageBody 结构。

**Acceptance Scenarios**:

1. **Given** 合法图片参数, **When** 调用 `client.chatManager.createImageMessage`, **Then** `type = image` 且 `body` 包含 `url/filename/filetype/width/height/isGif`。
2. **Given** `isGif = true`, **When** 创建图片消息, **Then** `body.isGif` 为 `true` 且支持 GIF 标记。
3. **Given** 图片参数缺失关键字段, **When** 调用 `client.chatManager.createImageMessage`, **Then** 抛出参数校验错误。
4. **Given** 仅传入本地文件对象且未提供 `url`, **When** 调用 `client.chatManager.createImageMessage`, **Then** 生成本地可用 `url` 并保留 `data`，待发送流程上传成功后回填为服务端 `url`。

---

### User Story 3 - 创建文件/语音/视频/位置消息（Priority: P2）

开发者需要通过 `ChatManager` 实例的 `createFileMessage`、`createVoiceMessage`、`createVideoMessage`、`createLocationMessage` 构造多媒体与位置消息。

**Why this priority**: 这些类型是完整 SDK 的必要能力，但优先级略低于文本与图片。

**Independent Test**: 调用各方法，验证 `type` 与 `body` 字段匹配，并能通过统一的 Message 接口消费。

**Acceptance Scenarios**:

1. **Given** 合法文件参数, **When** 调用 `client.chatManager.createFileMessage`, **Then** 返回 `type = file` 且 `body` 含文件元数据。
2. **Given** 合法语音参数, **When** 调用 `client.chatManager.createVoiceMessage`, **Then** 返回 `type = voice` 且 `body` 含时长信息。
3. **Given** 合法视频参数, **When** 调用 `client.chatManager.createVideoMessage`, **Then** 返回 `type = video` 且 `body` 含缩略图与时长。
4. **Given** 合法坐标, **When** 调用 `client.chatManager.createLocationMessage`, **Then** 返回 `type = location` 且 `body` 含经纬度与地址。
5. **Given** 仅提供本地文件对象, **When** 调用 `client.chatManager.createFileMessage/createVoiceMessage/createVideoMessage`, **Then** 生成本地可用 `url` 并保留 `data`，待发送流程上传成功后回填为服务端 `url`。

---

### User Story 4 - 创建命令/自定义消息（Priority: P2）

开发者需要通过 `ChatManager` 实例的 `createCmdMessage` 与 `createCustomMessage` 构造透传与自定义消息。

**Why this priority**: 命令与自定义消息用于扩展业务能力，需要与移动端扩展字段兼容。

**Independent Test**: 调用各方法，验证 `type` 与 `body` 字段匹配；`createCmdMessage` 仅接受 `action`，`createCustomMessage` 可通过 `params` 与 `ext` 携带自定义数据。

**Acceptance Scenarios**:

1. **Given** 合法 `action`, **When** 调用 `client.chatManager.createCmdMessage`, **Then** 返回 `type = cmd` 且 `body.action` 正确。
2. **Given** 旧版本调用方在 JS 运行时仍向 `createCmdMessage` 传入 `params`, **When** 创建命令消息, **Then** 返回的 `body` 不包含命令参数。
3. **Given** 合法 `event` 与扩展字段, **When** 调用 `client.chatManager.createCustomMessage`, **Then** 返回 `type = custom` 且 `body.event`、`ext` 正确。

---

### User Story 5 - 消息格式与移动端对齐（Priority: P1）

开发者需要 Web 端消息格式与移动端尽量统一，降低跨端适配成本。

**Why this priority**: 统一格式可以简化业务层数据处理，减少跨端差异。

**Independent Test**: 对比 Web 创建的 Message 与移动端字段映射表，验证关键字段一致。

**Acceptance Scenarios**:

1. **Given** 通过创建方法生成的 Message, **When** 按映射表检查字段, **Then** 与移动端语义保持一致。
2. **Given** 扩展字段, **When** 写入 `ext`, **Then** 可与移动端 `setAttribute` 使用习惯保持一致。

---

### User Story 6 - 创建消息扩展策略字段（Priority: P1）

开发者需要在创建消息时直接设置投递策略字段（`receiverList`、`deliverOnlineOnly`、`priority`）与方向字段（`direct`），减少发送前二次组装。

**Why this priority**: 这些字段直接影响发送行为与业务展示，属于创建消息链路的高频输入。

**Independent Test**: 调用创建方法并校验返回 Message 中扩展字段完整、默认值符合预期、非法入参可被拦截。

**Acceptance Scenarios**:

1. **Given** 创建群组消息时传入 `receiverList`, **When** 创建完成, **Then** 返回消息对象包含该字段且保持原顺序。
2. **Given** 创建任意消息时传入 `deliverOnlineOnly`, **When** 创建完成, **Then** 返回消息对象包含该字段。
3. **Given** 创建聊天室消息时传入 `priority`, **When** 创建完成, **Then** 返回消息对象包含合法优先级值。
4. **Given** 创建消息未传 `direct`, **When** 创建完成, **Then** `direct` 默认值为 `SEND`。

---

### Out of Scope

- 消息发送/接收流程（发送能力由 ChatManager/ChatClient 发送链路承载，但不在本规格实现范围内）
- 消息存储与历史同步
- 消息撤回、编辑、表情回应等高级功能

### Edge Cases

- `conversationId` 为空
- `sender.userId` 为空或当前用户信息缺失
- `type` 与 `body` 不匹配
- `ext` 非对象或包含不可序列化内容
- `receiverList` 为空数组或元素为空字符串
- 同时设置 `receiverList` 与 `deliverOnlineOnly` 时的优先级约束（创建侧需保留输入，具体投递优先级由发送协议层处理）
- `priority` 非法值（非 `high/normal/low`）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SDK MUST 通过 `ChatManager` 提供 `createTextMessage`、`createImageMessage`、`createFileMessage`、`createVoiceMessage`、`createVideoMessage`、`createLocationMessage`、`createCmdMessage`、`createCustomMessage`、`createCombineMessage`；`ChatClient` 不公开创建消息方法。
- **FR-001A**: `createTextMessage` 的文本内容入参 MUST 命名为 `content`，返回的 `TextMessageBody` 也 MUST 使用 `content` 字段表达文本内容。
- **FR-002**: 所有创建方法 MUST 返回符合 data-model 中 `Message` 接口的对象。
- **FR-003**: `msgLocalId` MUST 由 SDK 内部生成且唯一，不作为创建方法入参；`msgServerId` 默认空字符串；`status` 默认 `sending`；`timestamp` 创建时默认 `Date.now()`（本地时间），发送成功后由服务端回填为服务端时间。
- **FR-004**: `type` 与 `body` 必须一致，否则抛出校验错误。
- **FR-005**: 创建入参使用 `conversationId/conversationType` 表达 `to`/`chatType` 语义，`sender.userId` 对齐移动端 `from`；通过 `ChatManager` 创建时需自动注入 `sender`。
- **FR-006**: `ext` MUST 为 JSON 可序列化的对象结构（键值对），用于对齐移动端 `setAttribute`，未提供时默认 `{}`。
- **FR-007**: 必须提供清晰的参数错误信息，指出具体字段。
- **FR-008**: 创建消息时 `sender` 由 SDK 读取当前登录用户并自动填充，不作为创建方法入参；若无法获取 `sender.userId`，必须抛出错误。
- **FR-009**: 图片/文件/语音/视频消息的 `url` 与 `data` 至少其一必填；仅提供 `data` 时需要生成本地可用 `url`（H5 使用 `ObjectURL`，小程序/uniapp 使用本地 `path`），上传成功后由发送流程回填服务端 `url`；接收方消息不包含 `data`。
- **FR-009A**: 图片/文件/语音/视频消息的创建入参中，远程地址字段统一命名为 `originalUrl`。`filename`/`filetype` 均为可选（传 `data` 时 SDK 自动从文件对象获取）。`secret` 不作为创建入参（由上传后服务端返回）。图片消息的 `width`/`height`/`isGif`/`fileLength` 也为可选，`isGif` 默认 `false`，`width`/`height` 发送前自动获取。
- **FR-010**: `data` 兼容 H5 `File` 与小程序/uniapp 文件对象；小程序/uniapp 文件对象字段包含 `path`、`size`、`name`、`type`（`name/type` 仅 H5 可用的场景可为空）。
- **FR-011**: 创建消息参数 MUST 支持 `receiverList`、`deliverOnlineOnly`、`priority` 字段，并在参数校验阶段拦截非法输入。
- **FR-012**: `receiverList` MUST 为非空字符串数组（可选）；为空数组或包含空字符串时必须报错。
- **FR-013**: 创建消息返回对象 MUST 支持 `direct` 字段；创建侧默认 `direct = SEND`。
- **FR-014**: 创建消息返回对象 MUST 透传 `deliverOnlineOnly` 与 `priority` 到 Message 顶层字段，`CmdMessageBody.deliverOnlineOnly` 仅保留兼容语义。
- **FR-014A**: `createCmdMessage` 创建入参 MUST 只接受命令动作 `action` 与通用消息字段，不再接受命令 `params`；若 JS 运行时传入旧 `params` 字段，创建结果 MUST 忽略该字段且不得写入 `CmdMessageBody`。
- **FR-015**: `TextMessageBody.translations` 不作为创建方法入参；该字段由 SDK 翻译 API（`translateMessage`）调用后内部填充。创建入参仅支持 `targetLanguages` 用于声明期望翻译的目标语言。
- **FR-016**: `createCombineMessage` 的 `messageList` 入参类型为 `Message[]`，用户直接传入 SDK 产出的 Message 对象。不限制消息类型（含 cmd）。`filename`/`filetype` 不作为创建入参，SDK 内部硬编码。
- **FR-017**: `Message` MUST 包含 `from`（发送方 userId）和 `to`（接收方标识：单聊为对方 userId，群聊为 groupId，聊天室为 chatroomId）。创建时 SDK 自动填充 `from = sender.userId`，`to = conversationId`；接收时从协议解码填充真实值。
- **FR-018**: `Message` MUST 支持 `reactions?: MessageReaction[]`（表情回应列表，接收时从协议解码填充）、`groupReadCount?: number`（群消息已读人数）、`needGroupReadReceipt?: boolean`（是否需要群已读回执，创建时可传入）。

### 移动端字段映射（对齐原则）

- `msgServerId` ↔ `msgId`
- `msgLocalId` ↔ 本地唯一标识（对应移动端本地消息标识/本地时间）
- `sender.userId` ↔ `from`
- `conversationId` ↔ `to` / `conversationId`
- `conversationType` ↔ `ChatType`（SINGLE/GROUP/CHATROOM）
- `timestamp` ↔ `timestamp`（创建时为本地时间，发送成功后由服务端回填；接收方消息为服务端时间）
- `ext` ↔ `ext`/`setAttribute` 扩展字段
- `type` ↔ `EMMessageBodyType`
- `body` ↔ 具体 MessageBody（Text/Image/File/Voice/Video/Location/Cmd/Custom）
- `direct` ↔ 消息方向（发送侧默认 `SEND`，接收侧由收包链路补充 `RECEIVE`）
- `receiverList` ↔ 定向投递用户列表
- `deliverOnlineOnly` ↔ 仅在线投递开关
- `priority` ↔ 消息优先级（high/normal/low）

### Message 接口（引用 data-model）

`Sender` 结构定义见 `specs/001-im-sdk-refactor/data-model.md`；通过 `ChatManager` 创建时不需要传入 `sender`，由 SDK 自动填充。

```ts
interface Message {
  msgServerId: string;
  msgLocalId: string;
  sender: Sender;
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  direct?: 'SEND' | 'RECEIVE';
  receiverList?: string[];
  deliverOnlineOnly?: boolean;
  priority?: 'high' | 'normal' | 'low';
  isBroadcast?: boolean;
  isContentReplaced?: boolean;
  type: MessageType;
  status: MessageStatus;
  ext: Record<string, unknown>;
  timestamp: number;
  body: MessageBody;
}
```

### MessageBody 结构（与移动端对齐的扩展）

```ts
interface TextMessageBody {
  content: string;
  targetLanguages?: string[];   // 对齐移动端 targetLanguages
  translations?: Record<string, string>; // 对齐移动端 translations
}

interface ImageMessageBody {
  url: string;
  filename: string;
  filetype: string;
  width: number;
  height: number;
  isGif: boolean;
  data?: File;
  thumbnailUrl?: string;
}

interface FileMessageBody {
  url?: string;
  filename: string;
  filetype: string;
  fileSize?: number;
  data?: File;
}

interface VoiceMessageBody {
  url?: string;
  filename: string;
  filetype: string;
  duration: number;
  data?: File;
}

interface VideoMessageBody {
  url?: string;
  filename: string;
  filetype: string;
  duration: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  data?: File;
}

interface LocationMessageBody {
  latitude: number;
  longitude: number;
  address?: string;
  buildingName?: string;
}

interface CmdMessageBody {
  action: string;
  params?: Record<string, string>; // 仅用于接收/协议兼容，createCmdMessage 不写入
  deliverOnlineOnly?: boolean; // 兼容字段，推荐使用 Message 顶层 deliverOnlineOnly
}

interface CustomMessageBody {
  event: string;
  params?: Record<string, string>;
}
```

**说明**：
- `data` 仅用于发送端本地创建阶段，接收方消息中不应出现该字段。
- 当仅提供 `data` 时，`url` 在创建阶段可为本地可用地址（H5 使用 `ObjectURL`，小程序/uniapp 使用本地 `path`），发送成功后由发送流程回填服务端 `url`。
- 小程序图片的 `width/height` 可来自图片信息（`width/height/path/orientation/type`），其中 `width/height` 不考虑旋转。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 所有 create 方法返回的对象均通过 Message 接口校验。
- **SC-002**: 文本与图片消息可直接用于现有发送流程，无需二次转换。
- **SC-003**: 关键字段与移动端映射一致，跨端适配成本降低。
- **SC-004**: 参数错误能够提示具体字段与修复建议。
- **SC-005**: `receiverList/deliverOnlineOnly/priority/direct` 在创建链路的字段断言用例通过率为 100%。
