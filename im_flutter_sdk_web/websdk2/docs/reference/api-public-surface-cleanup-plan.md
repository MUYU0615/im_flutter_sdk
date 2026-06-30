# API 公开面收敛计划

日期：2026-05-28

## 背景

基于最新生成的 API Reference HTML review，当前公开 API 面存在以下共性问题：

- `ChatClient` 暴露了部分只应供 Manager 内部调用的底层能力。
- Manager 注册协议、raw notify 处理协议和 capability 字段进入了 API Reference。
- 会话、聊天室、群组、Push 等模块存在同语义字段命名不一致，例如 `type` / `conversationType`、`id` / `conversationId`。
- 部分接口仍保留旧 callback 风格的 `success` / `error`，与当前 Promise API 设计不一致。
- 部分返回结构包含冗余字段、内部字段或服务端原始字段。
- 部分错误码、API Reference 生成入口和对应 feature spec 未同步。

本计划只定义公开 API 收敛方向和实施顺序。进入代码修改阶段前，需按本计划同步对应模块 spec，并在不确定真实服务端响应的接口上先通过 e2e API 环境取样。

## 范围

纳入本轮：

- ChatClient 公开面收敛
- ChatManager 消息、会话、reaction、pin、recall、附件下载公开面
- ChatRoomManager / ChatRoom 公开面
- ContactManager 公开面
- GroupManager / Group 公开面
- PresenceManager 公开面
- PushManager 公开面
- UserInfoManager 公开面
- TypeDoc / Markdown API Reference 入口与内部类型隐藏
- `api-errors.json` 与相关错误码生成链路
- 对应模块 spec 同步

暂不纳入本轮：

- ChatThreadManager 公开 API 设计。本轮目标是先不对外暴露 ChatThreadManager 与相关类型，不做进一步公开 API 收敛。
- CacheManager 公开 API 设计。
- 真实业务语义无法从现有 REST 或 e2e 样例确认的字段扩展。

## 总体原则

### 公开入口边界

`ChatClient` 只保留 SDK 主入口能力：

- init / login / logout
- 连接状态与当前用户查询
- token / RTC token 等全局能力
- Manager 注册
- 全局事件注册

领域能力放到对应 Manager：

- 消息、会话、附件下载：`ChatManager`
- 群组：`GroupManager` / `Group`
- 聊天室：`ChatRoomManager` / `ChatRoom`
- 联系人：`ContactManager`
- 用户资料：`UserInfoManager`
- 在线状态：`PresenceManager`
- Push：`PushManager`

`bind`、`capabilities`、`handleRawNotify`、`RawNotifyEvent`、内部 event dispatch、内部解码桥接方法均不进入 API Reference。

### 异步模型

除发消息、上传、下载这类需要进度、生命周期或取消状态的接口外，公开 API 统一使用 Promise：

- 成功有业务数据：`Promise<BusinessObject>`
- 成功无业务数据：`Promise<void>`
- 失败：抛出 `SDKError`

Presence、Push、UserInfo 等普通 REST API 参数中的 `success` / `error` 需要移除。

### 命名规则

会话统一使用：

- `conversationId`
- `conversationType`

不再新增 `id` / `type` 表示会话。

用户身份字段默认保持简洁：

- 参数中已有 `userId` 的，不因本轮统一强行改成 `targetUserId`。
- 事件或返回结构中存在多个用户角色时，按角色区分：`senderId`、`operatorId`、`memberId`、`targetId`。
- 只有字段歧义明显或无法从上下文判断是否为用户 ID 时，才考虑使用 `operatorUserId` / `memberUserId` 这类更明确命名。

### 分页规则

分页统一使用：

- `items`
- `cursor`
- `hasMore`

不引入 `isLast`。现有只有 `cursor` 的分页结果，在公开 API 中补 `hasMore`。

### 批量部分成功

批量操作如果存在部分成功场景，公开 API 应返回成功结果，并将结果分成两个数组：

```ts
interface BatchMutationResult<TSuccess, TFailure> {
  readonly succeeded: ReadonlyArray<TSuccess>;
  readonly failed: ReadonlyArray<TFailure>;
}
```

失败项至少包含目标标识与原因：

```ts
interface BatchMutationFailure {
  readonly id: string;
  readonly code?: number | string;
  readonly reason?: string;
}
```

如果服务端真实响应无法确认是否支持部分成功，实施阶段先通过 e2e API 测试环境请求真实接口，再决定：

- 服务端返回部分成功详情：映射为 `succeeded` / `failed`。
- 服务端只返回整体成功或整体失败：公开 API 使用 `Promise<void>`，失败抛 `SDKError`。

## 模块计划

### ChatClient

目标：

- 从 API Reference 中移除 `getSessionList`、`refreshSessionList`、`sendMessageAction`、`sendChatRoomOperation`、`downloadAttachment`、`decodeServerMessageMeta`。
- `sendMessage` 是否继续在 ChatClient 保留需二次确认。建议公开推荐入口为 `ChatManager.sendMessage`，ChatClient 入口隐藏或标记为兼容 API。
- 内部方法继续允许 Manager 调用，但通过内部接口、`@internal` 和文档入口过滤隐藏。

需同步 spec：

- `specs/002-chatclient-mvp/spec.md`
- `specs/009-manager-usage/spec.md`
- `specs/031-chat-manager-replace-channel/spec.md`
- `specs/034-conversation-rest-api/spec.md`

### ChatManager

目标：

- `sendMessage` 补全错误码，覆盖参数校验、未连接、未登录、附件上传失败、发送超时、ACK 失败、服务端业务错误等。
- `getConversationList` 不引用 cache 层 `ConversationSummary`，返回稳定公开类型 `ConversationItem`。
- `getSessionList` 不再作为公开 API 暴露。
- `addConversationMark` / `removeConversationMark` 返回 `succeeded` / `failed` 数组。
- `pinMessage` / `unpinMessage` 优先改为 `Promise<void>`；如果保留返回结构，字段使用 `conversationType` 且去掉 `applied`。
- `PinnedMessageSummary.type` 改为 `conversationType`。
- `PinnedMessageSummary.operatorId` 保持 `operatorId`，因为字段语义已明确为操作者。
- `recallMessage` 优先改为 `Promise<void>`；只有服务端返回可用业务数据时再保留返回对象。
- `MessageReactionDetailPage` 去掉 `reactionId`，只保留 `reactionUsers: ReadonlyArray<ReactionUser>`，不再同时返回 `users`。
- 所有分页结构统一 `hasMore`。
- `downloadAttachment` 作为公开入口保留在 `ChatManager`，文档说明其用于根据图片、语音、视频、文件消息下载原附件二进制。

需同步 spec：

- `specs/031-chat-manager-replace-channel/spec.md`
- `specs/034-conversation-rest-api/spec.md`
- `specs/037-message-conversation-fields/spec.md`
- `specs/043-chat-manager-event-cleanup/spec.md`

需真实环境确认：

- 会话 mark 批量接口是否返回部分成功详情。
- pin / unpin message 的真实返回体是否有可用业务字段。
- reaction detail 的真实返回体字段，确认 `ReactionUser` 可包含哪些信息。

### ChatRoomManager / ChatRoom

目标：

- `capabilities` / `handleRawNotify` 不进入 API Reference。
- `ChatRoomSummary` 只保留列表接口真实返回字段映射：`chatRoomId`、`name`、`owner`、`memberCount`、`disabled`。
- `ChatRoomDetail` 去掉群组语义字段，如 `allowInvites`、`membersOnly`、`public`、`shieldgroup`。
- `memberCount` / `maxUsers` 统一概念。对外建议改 `maxMembers`，必要时兼容旧 `maxUsers` 一版。
- `addUsersToAllowlist` / `removeUsersFromAllowlist` 等批量接口按真实响应决定是否返回 `succeeded` / `failed`。
- `getAnnouncement` 返回公告业务对象或字符串，不包含 `chatRoomId`。
- `checkIfInAllowList` 返回 `Promise<boolean>`，不返回 `{ value: boolean }`。
- 明确 `ChatRoom` 实例方法是否作为公开 OO API。如果公开，需要在 API Reference 中与 `ChatRoomManager` 分页展示；如果不公开，从 API Reference entry 中移除。

需同步 spec：

- `specs/028-chatroom-manager-api/spec.md`
- `specs/032-group-internal-oo-pilot/spec.md` 中与内部 OO handle 相关的约束如有复用需同步

需真实环境确认：

- allowlist / blocklist / mute 批量接口是否有部分成功详情。
- 聊天室详情接口中哪些字段对聊天室业务真实有效，哪些只是服务端复用群组结构返回。

### ContactManager

目标：

- `getBlocklist` 返回不重复表达用户 ID。建议返回 `ReadonlyArray<UserInfo>`；如果需要保留条目结构，则只保留 `{ user: UserInfo }`。
- `addUsersToBlocklist` 按真实响应决定是否返回 `succeeded` / `failed`。

需同步 spec：

- `specs/025-contact-manager-api/spec.md`
- `specs/024-contact-sync/spec.md` 中联系人快照字段如有受影响需同步

需真实环境确认：

- blocklist 批量添加是否存在部分成功，以及失败项结构。

### GroupManager / Group

目标：

- `capabilities` / `handleRawNotify` 不进入 API Reference。
- `getPublicGroupList` 本轮隐藏，不作为公开 API。
- `CreateGroupParams` / `GroupDetail` 中 `maxUsers` 建议改 `maxMembers`，必要时兼容旧字段一版。
- `approval` 建议改为 `joinApprovalRequired`。
- `checkIfInAllowList` 直接返回 `Promise<boolean>`。
- `getMemberAttributes` / `getMembersAttributes` 只保留 `getMembersAttributes`，单人查询传一个 `userId`。
- 批量成员、管理员、黑名单、白名单、禁言等操作按真实响应决定是否返回 `succeeded` / `failed`。
- 事件字段保留简洁角色名，如 `operatorId`、`memberId`、`admin`，不强制加 `User` 后缀。

需同步 spec：

- `specs/027-group-manager-api/spec.md`
- `specs/032-group-internal-oo-pilot/spec.md`
- `specs/031-message-profile-sync/spec.md` 中群名片相关事件如有受影响需同步

需真实环境确认：

- 群组批量成员操作是否存在部分成功详情。
- 群 allowlist / blocklist / mute 批量接口返回体。

### PresenceManager

目标：

- `PublishPresenceParams` 去掉 `success` / `error`。
- `SubscribePresenceParams`、`UnsubscribePresenceParams`、`GetSubscribedPresenceListParams`、`GetPresenceStatusParams` 同步去掉 `success` / `error`。
- 文档删除 Promise + callback 双模式说明。

需同步 spec：

- `specs/016-presence-manager/spec.md`

### PushManager

目标：

- `SetConversationSilentModeParams`、`GetConversationSilentModeParams`、`ClearConversationRemindTypeParams`、`MutedConversationItem` 等字段 `type` 改为 `conversationType`。
- Push 模块内 `ConversationIdentifier.id/type` 改为 `conversationId/conversationType`。
- 所有普通 REST 参数去掉 `success` / `error`。
- `setPushLanguage` 改为 `Promise<void>`。
- `getPushLanguage` 保留读取语义，返回 `{ language }` 或后续确认是否直接返回 `string`。

需同步 spec：

- `specs/021-push-manager/spec.md`
- `specs/034-conversation-rest-api/spec.md` 中会话标识通用命名如有复用需同步

### UserInfoManager

目标：

- `handleRawNotify` 不进入 API Reference。
- `FetchUserInfoByUserIdParams`、`FetchUserInfoByAttributeParams`、`SubscribeUsersInfoParams`、`UnsubscribeUsersInfoParams`、`UpdateOwnInfoParams`、`UpdateOwnInfoByAttributeParams` 去掉 `success` / `error`。
- 移除公开 `UserInfoOperationCallbacks`。

需同步 spec：

- `specs/026-user-info-manager-api/spec.md`
- `specs/033-user-info-subscription/spec.md`

### ChatThreadManager

目标：

- 本轮先不作为公开 API 处理。
- 从 API Reference entry 中隐藏 `ChatThreadManager`、`ChatThread` 和 `types/chat-thread`。
- 不新增 ChatThread 公开 API 设计，不补公开 JSDoc。

需同步 spec：

- 若已有隐藏要求不足，更新 `specs/043-chat-manager-event-cleanup/spec.md` 或单独记录到 API Reference 收敛说明。

## API Reference 与文档生成

目标：

- 收紧 `scripts/api-doc-entry-points.js`，移除不应公开的 manager 内部协议和 ChatThread 入口。
- 保持 `excludeInternal: true`，但不只依赖 `@internal`，入口文件也要避免包含纯内部协议。
- 检查 TypeDoc HTML 和 Markdown 生成结果，确认内部方法、内部类型和 raw notify 不再出现。
- 对 `@internal` 注释无法完全隐藏的场景，优先调整入口或拆分 public/internal 类型文件。

涉及文件：

- `scripts/api-doc-entry-points.js`
- `scripts/generate-typedoc-html.js`
- `scripts/generate-api-reference.js`
- `scripts/check-api-doc-comments.js`

验证：

- `npm run docs:api:check`
- `npm run docs:api:md`
- 针对生成产物用 `rg` 检查内部 API 名称不再出现。

## 错误码

目标：

- `sendMessage` 补全当前缺失错误码。
- ChatManager 中通过内部 action 通道实现的 API，如 recall、read ack、reaction，需要确保公开方法名与 `api-errors.json` operation 对应。
- 不通过源码 JSDoc `@throws` 维护错误码。

涉及文件：

- `src/rest/api-errors.json`
- `scripts/api-error-operation-aliases.js`
- `docs/reference/*error-codes*`

验证：

- `npm run docs:api:check`
- `npm run errors:check`

## 真实环境取样计划

对不确定是否部分成功的接口，实施阶段先用现有 e2e API 测试环境请求真实接口，保留最小 fixture 或测试断言。

优先取样接口：

- ChatManager: add/remove conversation mark, pin/unpin message, reaction detail
- ChatRoomManager: allowlist/blocklist/mute 批量操作
- ContactManager: add users to blocklist
- GroupManager: members/admin/blocklist/allowlist/mute 批量操作

取样要求：

- 记录请求参数、HTTP 状态、响应体关键字段。
- 不在日志、fixture、文档中保留 token、真实手机号、密码等敏感信息。
- 如果接口无法构造部分成功场景，记录限制，并按整体成功/失败 API 设计。

## 实施顺序

1. 更新对应模块 spec，明确公开 API 收敛后的字段、返回值和隐藏策略。
2. 调整 API Reference entry，先隐藏确定不公开的 ChatThread 和内部 manager 协议。
3. 收敛 ChatClient 公开面，保留必要内部调用路径。
4. 按模块调整公开类型和 Manager 方法签名。
5. 对部分成功不确定的接口跑 e2e API 取样，再落类型。
6. 补齐 `api-errors.json` 和 alias。
7. 更新 API Reference 生成产物。
8. 更新版本号、CHANGELOG。
9. 执行验证。
10. 提交 git commit，提交信息使用中文。

## 验证门禁

默认验证：

- `npm run type-check`
- `npm run lint`
- `npm run docs:api:check`
- `npm run errors:check`

按影响补充：

- `npm run test:run`
- 受影响模块的单元测试
- 真实环境 e2e API 取样或已有 e2e API 测试

若只修改计划文档，不涉及源码、类型、生成脚本和 API Reference 产物，可用文档存在性和内容检查替代代码门禁，并在变更说明中注明。

## 待确认问题

- `ChatClient.sendMessage` 是否彻底从公开 API Reference 隐藏，还是作为兼容入口保留但文档推荐 `ChatManager.sendMessage`。
- `ChatRoom` / `Group` 实例方法是否继续作为公开 OO API 展示，还是只展示 Manager API。
- `maxUsers` 改 `maxMembers` 是否需要提供一版兼容别名。
- `getPushLanguage` 返回 `{ language }` 还是直接返回 `string`。
