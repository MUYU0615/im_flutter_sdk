# Research: 消息模型替换 channel 为会话字段

## Decision 1: 公开消息定位字段使用 conversationId/conversationType

**Decision**: `Message`、`Create*MessageParams`、`CombineMessageItem` 和消息事件中的消息对象统一使用 `conversationId` 与 `conversationType`。`conversationType` 取值为 `singleChat | groupChat | chatRoom`。

**Rationale**: `ChatManager`、`ConversationLocator` 与 034 会话 REST 规格已经使用 `conversationId/conversationType`。消息模型继续使用同一命名能减少别名，避免 `chatType` 与服务端协议 chat type 混淆。

**Alternatives considered**:

- `conversationId/chatType`: 被拒绝，容易和协议内部 chat type 混用。
- 保留 `channel.channelId/channel.type`: 被拒绝，本特性目标就是移除消息公开模型中的 channel 概念。

## Decision 2: 不迁移现有 ChatManager / Conversation 方法参数

**Decision**: 本期只迁移消息模型及消息对象流经链路，不重命名现有 ChatManager / Conversation 公开方法参数。

**Rationale**: 这些方法已经使用 `conversationId/conversationType`，与本期最终字段一致。继续扩展到其它 manager 会扩大 scope 但不产生额外收益。

**Alternatives considered**:

- 全量重命名所有会话参数：被拒绝，现有参数已符合目标命名。
- 增加 `chatType` 别名：被拒绝，会引入双命名。

## Decision 3: 旧 channel 不公开兼容、不迁移

**Decision**: 公开输入遇到旧 `channel` 消息对象时按参数校验失败处理，不自动转换为新字段。测试 fixture、demo 和示例必须全量改写为新字段。

**Rationale**: 本特性是 breaking change。兼容旧完整消息对象会让内部长期维护双模型，增加协议、上传、缓存和事件链路的分支复杂度。

**Alternatives considered**:

- 公开 API 同时接受旧 `channel` 和新字段：被拒绝，会削弱 breaking change 的边界。
- 仅缓存读取做迁移：被拒绝，当前仓库主要落盘 conversation summary，不把完整旧消息对象作为迁移对象。

## Decision 4: ChannelReference / ChannelType 不再公开导出

**Decision**: `ChannelReference` 与 `ChannelType` 从 SDK 公开导出面移除。若内部协议映射仍需等价概念，只能作为私有类型存在。

**Rationale**: 继续公开这些类型会让调用方误以为消息创建仍支持 channel 模型，与本特性目标冲突。

**Alternatives considered**:

- 保留并标记 deprecated：被拒绝，本期不保留公开兼容。
- 保留内部并公开导出：被拒绝，会扩大概念泄漏。

## Decision 5: 错误处理复用现有参数校验错误

**Decision**: 旧字段误用不新增专门错误码，也不强制错误文案包含迁移提示；复用现有参数校验错误即可。

**Rationale**: 旧 `channel` 不被当作兼容输入处理。缺少 `conversationId/conversationType` 本质上是普通参数缺失或格式错误，不需要新增迁移专用错误码。

**Alternatives considered**:

- 新增 `MESSAGE_CHANNEL_DEPRECATED` 类错误码：被拒绝，过度设计。
- 只依赖 TypeScript，不做运行时校验：被拒绝，SDK 公开 API 仍需运行时参数校验兜底。

## Decision 6: 服务端协议保持内部映射

**Decision**: MSync、上传 REST header、protobuf 私有序列化等内部协议可以继续使用各自需要的 chat type、domain、target 字段，但不得泄漏到公开消息对象。

**Rationale**: 服务端协议不是本期重命名对象。保持内部映射能降低协议风险，并把 breaking change 限定在 SDK 公开模型。

**Alternatives considered**:

- 尝试同步重命名服务端协议字段：不可行，不在 SDK feature scope。
- 在公开模型中保留协议 chat type：被拒绝，会破坏 canonical naming。
