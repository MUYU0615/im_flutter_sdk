# Web SDK2 对外 API Review Matrix

生成时间：2026-05-12

总计：274 行 callable/value API。
范围：以 `package.json` 的导出入口和 `src/index.ts` 根导出为准，按当前公开/推荐业务 API 整理；明确 `@internal` 的 Manager 注册协议、事件分发内部方法、REST helper 不纳入本表。

移动端对照列先留空：你可以补 `移动端 API` / `移动端参数` / `移动端返回值`，最后在 `差异/Review 结论` 写命名、参数字段、返回结构或语义差异。

表头说明：`Web 参数字段展开` 只展开第一层对象字段，复杂嵌套以类型名为准。

创建消息 API 只保留在 `消息创建 API` 章节中，不在 `ChatClient` 章节重复列出。

## Manager 拆分文档

| 模块 | 行数 | 文档 |
| --- | ---: | --- |
| ChatManager 消息与会话 | 35 | [websdk2-api-review-chat-manager.md](./websdk2-api-review-chat-manager.md) |
| ChatThread 子区 | 22 | [websdk2-api-review-chat-thread-manager.md](./websdk2-api-review-chat-thread-manager.md) |
| ContactManager 联系人 | 11 | [websdk2-api-review-contact-manager.md](./websdk2-api-review-contact-manager.md) |
| UserInfoManager 用户资料 | 9 | [websdk2-api-review-user-info-manager.md](./websdk2-api-review-user-info-manager.md) |
| GroupManager / Group 群组 | 48 | [websdk2-api-review-group-manager.md](./websdk2-api-review-group-manager.md) |
| ChatRoomManager / ChatRoom 聊天室 | 72 | [websdk2-api-review-chatroom-manager.md](./websdk2-api-review-chatroom-manager.md) |
| PresenceManager 在线状态 | 7 | [websdk2-api-review-presence-manager.md](./websdk2-api-review-presence-manager.md) |
| PushManager 推送 | 10 | [websdk2-api-review-push-manager.md](./websdk2-api-review-push-manager.md) |
| CacheManager 缓存 | 34 | [websdk2-api-review-cache-manager.md](./websdk2-api-review-cache-manager.md) |

## 错误码 Review 文档

| 模块 | 文档 |
| --- | --- |
| Web SDK2 / Android 错误码 | [websdk2-error-code-review-matrix.md](./websdk2-error-code-review-matrix.md) |

## 核心 ChatClient

| Web API | Web 参数 | Web 参数字段展开 | Web 返回值 | 移动端 API | 移动端参数 | 移动端返回值 | 差异/Review 结论 | 来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ChatClient.init | config: Omit<InitConfig, 'managers'> & { managers?: Managers } | config: appKey: string; enableUserInfoSync?: boolean \| undefined; enableSyncData?: ReadonlyArray<'conversation' \| 'contact' \| 'group'> \| undefined; useCustomAttachmentUpload?: boolean \| undefined; useFixedDeviceId?: boolean \| undefined; deviceId?: string \| undefined; serviceConfig?: ServiceConfig \| undefined; useReplacedMessageContents?: boolean \| undefined; customDeviceName?: string \| undefined; customOsPlatform?: number \| undefined; autoLogin?: boolean \| undefined; uiKitVersion?: string \| undefined; managers?: Managers \| undefined | WithManagers<ChatClient, Managers> |  |  |  |  | src/chat-client.ts:318 |  |
| ChatClient.login | params: AuthContext | params: userId: string; token: string | Promise<void> |  |  |  |  | src/chat-client.ts:387 |  |
| ChatClient.logout | - | - | Promise<void> |  |  |  |  | src/chat-client.ts:573 |  |
| ChatClient.getConnectionState | - | - | ConnectionStatus |  |  |  |  | src/chat-client.ts:639 |  |
| ChatClient.getCurrentUserId | - | - | string \| null |  |  |  |  | src/chat-client.ts:667 |  |
| ChatClient.addEventHandler | id: EventHandlerId, handlers: EventHandlerMap | - | void |  |  |  |  | src/chat-client.ts:2102 |  |
| ChatClient.removeEventHandler | id: EventHandlerId | - | void |  |  |  |  | src/chat-client.ts:2109 |  |
| ChatClient.use | ManagerCtor: ManagerConstructor<ChatClient, Manager, Key> | ManagerCtor: key: Key | WithManager<ChatClient, Key, Manager> |  |  |  |  | src/chat-client.ts:2116 |  |
| ChatClient.sendMessage | message: Message, options?: SendMessageOptions | message: msgServerId: string; msgLocalId: string; sender: Sender; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; type: MessageType; status: MessageStatus; ext: Record<string, unknown>; timestamp: number; body: MessageBody; direct?: MessageDirect \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined; isBroadcast?: boolean \| undefined; isContentReplaced?: boolean \| undefined; combineLevel?: number \| undefined; stream?: StreamMessageMeta \| undefined | Promise<Message> |  |  |  |  | src/chat-client.ts:2215 |  |
| ChatClient.downloadMessageAttachment | message: Message, timeoutMs?: number | message: msgServerId: string; msgLocalId: string; sender: Sender; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; type: MessageType; status: MessageStatus; ext: Record<string, unknown>; timestamp: number; body: MessageBody; direct?: MessageDirect \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined; isBroadcast?: boolean \| undefined; isContentReplaced?: boolean \| undefined; combineLevel?: number \| undefined; stream?: StreamMessageMeta \| undefined | Promise<MessageAttachmentDownloadResult> |  |  |  |  | src/chat-client.ts:2362 |  |
| ChatClient.refreshSessionList | - | - | Promise<readonly ConversationItem[]> |  |  |  |  | src/chat-client.ts:795 |  |

## 消息创建 API

| Web API | Web 参数 | Web 参数字段展开 | Web 返回值 | 移动端 API | 移动端参数 | 移动端返回值 | 差异/Review 结论 | 来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ChatManager.createTextMessage | params: CreateTextMessageParams | params: content: string; targetLanguages?: string[] \| undefined; translations?: Record<string, string> \| undefined; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; ext?: Record<string, unknown> \| undefined; msgLocalId?: string \| undefined; timestamp?: number \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined | Message |  |  |  | sender 由 SDK 当前登录态填充；不再从根入口导出独立工厂函数。 | src/managers/chat-manager.ts:144 |  |
| ChatManager.createImageMessage | params: CreateImageMessageParams | params: originalImageUrl?: string \| undefined; filename: string; filetype: string; width: number; height: number; isGif: boolean; isOriginalImage?: boolean \| undefined; secret?: string \| undefined; fileLength?: number \| undefined; data?: CompatibleFile \| undefined; thumbnailUrl?: string \| undefined; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; ext?: Record<string, unknown> \| undefined; msgLocalId?: string \| undefined; timestamp?: number \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined | Message |  |  |  | sender 与图片上传选项由 SDK 内部填充。 | src/managers/chat-manager.ts:148 |  |
| ChatManager.createFileMessage | params: CreateFileMessageParams | params: url?: string \| undefined; filename: string; filetype: string; fileSize?: number \| undefined; fileLength?: number \| undefined; secret?: string \| undefined; data?: CompatibleFile \| undefined; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; ext?: Record<string, unknown> \| undefined; msgLocalId?: string \| undefined; timestamp?: number \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined | Message |  |  |  | sender 由 SDK 当前登录态填充。 | src/managers/chat-manager.ts:156 |  |
| ChatManager.createVoiceMessage | params: CreateVoiceMessageParams | params: url?: string \| undefined; filename: string; filetype: string; duration: number; fileLength?: number \| undefined; secret?: string \| undefined; data?: CompatibleFile \| undefined; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; ext?: Record<string, unknown> \| undefined; msgLocalId?: string \| undefined; timestamp?: number \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined | Message |  |  |  | sender 由 SDK 当前登录态填充。 | src/managers/chat-manager.ts:160 |  |
| ChatManager.createVideoMessage | params: CreateVideoMessageParams | params: url?: string \| undefined; filename: string; filetype: string; duration: number; width?: number \| undefined; height?: number \| undefined; fileLength?: number \| undefined; secret?: string \| undefined; thumbnailUrl?: string \| undefined; data?: CompatibleFile \| undefined; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; ext?: Record<string, unknown> \| undefined; msgLocalId?: string \| undefined; timestamp?: number \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined | Message |  |  |  | sender 由 SDK 当前登录态填充。 | src/managers/chat-manager.ts:164 |  |
| ChatManager.createLocationMessage | params: CreateLocationMessageParams | params: latitude: number; longitude: number; address?: string \| undefined; buildingName?: string \| undefined; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; ext?: Record<string, unknown> \| undefined; msgLocalId?: string \| undefined; timestamp?: number \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined | Message |  |  |  | sender 由 SDK 当前登录态填充。 | src/managers/chat-manager.ts:168 |  |
| ChatManager.createCmdMessage | params: CreateCmdMessageParams | params: action: string; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; ext?: Record<string, unknown> \| undefined; timestamp?: number \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined; needGroupReadReceipt?: boolean \| undefined | Message |  |  |  | sender 由 SDK 当前登录态填充；命令消息创建入参不再接受 params。 | src/managers/chat-manager.ts:179 |  |
| ChatManager.createCustomMessage | params: CreateCustomMessageParams | params: event: string; params?: Record<string, string> \| undefined; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; ext?: Record<string, unknown> \| undefined; msgLocalId?: string \| undefined; timestamp?: number \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined | Message |  |  |  | sender 由 SDK 当前登录态填充。 | src/managers/chat-manager.ts:176 |  |
| ChatManager.createCombineMessage | params: CreateCombineMessageParams | params: title: string; summary: string; compatibleText?: string \| undefined; messageList: readonly CombineMessageItem[]; filename?: string \| undefined; filetype?: string \| undefined; conversationId: string; conversationType: "singleChat" \| "groupChat" \| "chatRoom"; ext?: Record<string, unknown> \| undefined; msgLocalId?: string \| undefined; timestamp?: number \| undefined; receiverList?: string[] \| undefined; deliverOnlineOnly?: boolean \| undefined; priority?: MessagePriority \| undefined | Message |  |  |  | sender 由 SDK 当前登录态填充。 | src/managers/chat-manager.ts:180 |  |

## 平台适配

| Web API | Web 参数 | Web 参数字段展开 | Web 返回值 | 移动端 API | 移动端参数 | 移动端返回值 | 差异/Review 结论 | 来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| createPlatformAdapter | options?: CreatePlatformAdapterOptions | - | PlatformAdapterProfile |  |  |  |  | src/platform/factory.ts:338 |  |
| detectRuntimePlatform | prefer?: RuntimePlatform, runtimeInput?: RuntimeDetectionInput | - | RuntimePlatform |  |  |  |  | src/platform/factory.ts:305 |  |
| RUNTIME_PLATFORMS | - | - | { readonly WEB: "web"; readonly WECHAT_MINIAPP: "wechat-miniapp"; readonly UNIAPP: "uniapp"; readonly REACT_NATIVE: "react-native"; readonly ELECTRON_RENDERER: "electron-renderer"; readonly ELECTRON_MAIN: "electron-main"; readonly UNKNOWN: "unknown"; } |  |  |  |  | src/platform/types.ts:5 | 常量/值导出。 |
