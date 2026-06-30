# 功能规格：Protobuf 私有协议与 WebSocket 收发

**Feature Branch**: `006-protobuf-ws`  
**Created**: 2026-01-23  
**Status**: Draft  
**Input**: 用户需求："使用 protobuf 实现私有协议，WebSocket 实现消息收发，流程参考原工程。"  
**Reference**:
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/proto.ts`
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/connection.ts`
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/mSync.ts`
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/handleMessages/handleChatMsg.ts`

> 本 spec 聚焦协议编码/解码与 WebSocket 收发主流程，消息去重/本地缓存/聊天室相关逻辑先不纳入，实现细节后续补充。

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - WebSocket 登录握手与 provision (Priority: P1)

开发者调用 `login` 后，SDK 应使用 token 生成 provision 消息并发送给服务端，等待鉴权结果决定连接是否成功。

**Independent Test**: 模拟 WebSocket onopen，断言发送 provision；模拟鉴权成功返回，状态切换为 connected；模拟超时/失败，返回错误。

**Acceptance Scenarios**:
1. **Given** WebSocket 连接建立, **When** onopen 触发, **Then** 发送 provision 消息并启动超时计时器。
2. **Given** 服务端返回鉴权成功, **When** provision 回包处理完成, **Then** 连接状态变为 connected。
3. **Given** provision 超时或失败, **When** 超时触发, **Then** 连接失败并返回错误。

---

### 用户故事 2 - 发送消息（protobuf 编码）(Priority: P1)

开发者通过 SDK 发送消息时，SDK 应将消息编码为 protobuf 二进制并通过 WebSocket 发送，收到服务端确认后 Promise resolve。

**Independent Test**: 构造消息 -> encode -> send；模拟服务端 ACK 回包，Promise resolve；模拟失败返回，Promise reject。

**Acceptance Scenarios**:
1. **Given** 已登录且连接正常, **When** 调用 `sendMessage`, **Then** 消息被编码为 protobuf 并发送。
2. **Given** 服务端返回 ACK, **When** ACK 被处理, **Then** 对应消息的 Promise resolve。
3. **Given** 服务端返回错误或连接异常, **When** 错误触发, **Then** Promise reject 并带错误码。

---

### 用户故事 3 - 接收消息（protobuf 解码）(Priority: P1)

服务端推送消息后，SDK 应进行 protobuf 解码并转换为公开 Message 结构，最终触发 onMessage 事件回调。

**Independent Test**: 模拟 WebSocket message（protobuf 二进制），断言解码与消息回调被触发。

**Acceptance Scenarios**:
1. **Given** WebSocket 接收到消息, **When** onmessage 触发, **Then** 通过 mSync 解码并分发。
2. **Given** 解码后的消息为聊天消息, **When** handleChatMsg 处理完成, **Then** 触发 onMessage 回调。
3. **Given** 收到未知 command, **When** 分发处理, **Then** 记录日志但不崩溃。
4. **Given** 收到 NOTICE/UNREAD, **When** 队列进入同步, **Then** 发送 backqueue 并处理 nextKey/isLast 续拉。

---

### 用户故事 4 - 复用原工程协议定义 (Priority: P2)

新的 protobuf 编码/解码必须与原工程私有协议兼容，使用同一份 proto 定义。

**Independent Test**: 使用同一消息结构分别编码（新 SDK vs 原 SDK），二进制结构字段兼容。

**Acceptance Scenarios**:
1. **Given** 原工程 proto 定义, **When** 新 SDK 编码/解码, **Then** 与原工程字段一致。
2. **Given** 原工程发送的二进制消息, **When** 新 SDK 解码, **Then** 能正确解析为 Message。

---

### 用户故事 5 - 扩展消息字段协议映射 (Priority: P1)

开发者在发送/接收消息时，需要让 `receiverList`、`deliverOnlineOnly`、`priority`、`direct`、`isBroadcast`、`isContentReplaced` 等语义与协议字段一致。

**Independent Test**: 构造带扩展字段的发送消息与下行消息，断言编码映射与解码回调字段正确；ACK 仍仅内部处理。

**Acceptance Scenarios**:
1. **Given** 发送群组消息并带 `receiverList`, **When** 编码发送, **Then** 按定向投递语义编码。
2. **Given** 发送消息并带 `deliverOnlineOnly = true`, **When** 编码发送, **Then** 按仅在线投递语义编码。
3. **Given** 发送聊天室消息并带 `priority`, **When** 编码发送, **Then** 优先级语义映射到协议扩展字段。
4. **Given** 接收聊天室下行消息含广播标记, **When** 解码回调, **Then** 回调消息包含 `isBroadcast`。
5. **Given** 接收下行消息含内容替换标记, **When** 解码回调, **Then** 回调消息包含 `isContentReplaced`。
6. **Given** 接收 ACK 或内部回执消息, **When** SDK 处理完成, **Then** 不触发 `onMessage`。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 必须复用 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/proto.ts` 作为 protobuf 协议定义来源。
- **FR-002**: WebSocket `onopen` 时必须生成并发送 provision 消息（参考 connection.ts `onopenCallback`）。
- **FR-003**: provision 处理需有超时机制，超时/失败时连接应回到 `disconnected` 并返回错误。
- **FR-004**: WebSocket `onmessage` 必须走 `decodeMSync -> distributeMSync` 流程，并在聊天消息时调用 `handleChatMsg`。
- **FR-005**: 发送消息必须走 mSync send 流程（参考 mSync.ts `send`），并在 ACK 时 resolve 对应 Promise。
- **FR-006**: 编码/解码必须使用 protobuf 二进制（不再使用 JSON 序列化占位）。
- **FR-007**: 传输层必须支持二进制消息（ArrayBuffer/Uint8Array）。
- **FR-008**: 对外事件仍使用 EventHub 的 `onX` 事件风格（`onMessage`/`onMessageStatus`）。
- **FR-009**: 错误返回必须符合 005 错误处理规范（数字错误码与 details）。
- **FR-010**: 连接与发送超时必须集中配置在同一配置文件中，并在超时触发时返回对应错误码。
- **FR-011**: 本阶段仅需支持文本/命令/自定义消息发送；附件类消息（file/image/video/audio）上传流程暂不实现。
- **FR-012**: mSync 编码/解码逻辑需重构为结构清晰的模块，避免当前“单文件职责过重”的问题。
- **FR-013**: 消息解码与解析流程必须增加关键注释，覆盖每个方法的职责与核心分支逻辑，便于维护与审阅。
- **FR-014**: 必须支持 NOTICE/UNREAD 队列拉取与 nextKey/isLast 续拉逻辑，确保消息拉取链路完整。
- **FR-015**: protobuf uint64 字段必须以 Long 解析，避免精度丢失（serverId/metaId/nextKey 等）。
- **FR-016**: provision 协商压缩（protocolCompressType/protocolCompressDirection）与 LZ4 解压/压缩需可用。
- **FR-017**: 发送消息编码必须支持 `receiverList` 与 `deliverOnlineOnly` 的路由语义映射；`receiverList` 优先级高于 `deliverOnlineOnly`。
- **FR-018**: 发送聊天室消息编码必须支持 `priority` 语义映射，并与原工程字段约定保持一致。
- **FR-019**: 下行解码后的公开消息必须支持 `direct/isBroadcast/isContentReplaced` 字段，其中 `direct` 对下行为 `RECEIVE`。
- **FR-020**: ACK 与内部回执消息必须仅由 SDK 内部处理，禁止回调到 `onMessage`。

### 超时配置（集中定义）

- `MESSAGE_TIMEOUT = 1000 * 15`（发送消息超时）
- `REQUEST_TIMEOUT = 1000 * 15`（REST 请求超时，本阶段不实现，仅占位用）
- `UPLOAD_TIMEOUT = 1000 * 60 * 5`（上传文件超时，暂不实现上传逻辑）
- `CONNECT_TIMEOUT = 1000 * 10`（WebSocket 连接超时）
- `PROVISION_TIMEOUT = 1000 * 10`（provision 响应超时）

### 错误码建议（暂定，可后续调整）

> 码段遵循 005 错误规范，先行占位，后续以实现为准。

- **连接/握手** (6000-6999)
  - `6006` PROVISION_TIMEOUT（provision 超时）
  - `6007` PROVISION_REJECTED（provision 鉴权失败）
  - `6008` PROVISION_CLOSED（provision 期间连接关闭）
- **消息发送/编解码** (5000-5999)
  - `5005` MESSAGE_ENCODE_FAILED（编码失败）
  - `5006` MESSAGE_DECODE_FAILED（解码失败）
  - `5007` MESSAGE_ACK_MISSING（ACK 缺失/超时）

### 正式环境联调测试

- 提供真实环境联调用例，连接正式服务器完成登录与收发消息。
- 测试用账号信息通过 `.env` 注入，并确保 `.gitignore` 忽略该文件。
- 可选：当未提供 token 时，允许通过 REST 接口获取临时 token（需要网络权限）。

### Key Entities *(include if feature involves data)*

- **ProvisionMessage**: 登录握手消息，由 token 生成并在 onopen 时发送。
- **MSyncMessage**: WebSocket 传输的主消息结构（command + payload）。
- **CommSyncDL**: 下行聊天消息载体，携带 serverId/metaId 等字段。
- **Public Message**: 对外暴露的 Message 结构（含 ChannelReference、MessageBody）。

## Out of Scope

- 消息去重逻辑
- 自己发送消息的本地缓存/回执合并策略
- 加入/退出聊天室等通过消息完成的内部 API
- 离线消息/未读数同步细节
- 附件上传流程（file/image/video/audio）

## Edge Cases

- provision 超时或鉴权失败时的连接状态恢复
- WebSocket 收到未知 command 的处理策略
- ACK 丢失或重复 ACK 的处理
- 解码失败时的错误与日志策略
- `receiverList` 与 `deliverOnlineOnly` 同时存在时的编码优先级
- 聊天室消息缺失优先级或广播字段时的默认值处理
- 下行消息缺失内容替换标记时 `isContentReplaced` 的默认值处理

## Success Criteria *(mandatory)*

- **SC-001**: 登录握手流程完整可用，连接成功后进入 `connected` 状态。
- **SC-002**: 发送消息后能收到 ACK 并 resolve Promise。
- **SC-003**: 接收消息能被正确解码并触发 `onMessage`。
- **SC-004**: protobuf 编码/解码与原工程协议兼容。
- **SC-005**: 扩展字段协议映射用例（`receiverList/deliverOnlineOnly/priority/isBroadcast/isContentReplaced/direct`）通过率为 100%。
