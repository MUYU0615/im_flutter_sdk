# WebSDK2 vs Emclient-Linux 功能差距分析

> 对比日期：2026-05-27
> 对比对象：`websdk2/src` vs `emclient-linux/src`
> 排除范围：移动端特有功能（推送通知、原生数据库、音视频通话、本地文件系统等）

---

## 一、缺失功能

### 1.1 Critical（建议近期补齐）

| # | 功能 | emclient 位置 | 说明 |
|---|------|--------------|------|
| 1 | 定向消息 `receiverList` | `Message.setReceiverList()` | 群/聊天室中只发给指定用户列表，其他人不可见。websdk2 的 `sendMessage` 未支持此参数 |
| 2 | 消息送达回执 | `isDeliverAcked` + `onReceiveHasDeliveredAcks` | 完整链路缺失：发送端标记需要送达回执 + 接收端自动发送送达 ACK + 发送端收到送达通知事件 |
| 3 | `resendMessage` | `ChatManager.resendMessage` | 语义化重发入口，保留原消息 ID 和创建时间。当前用户只能手动重新调用 `sendMessage` |
| 4 | `reportMessage` | `ChatManager.reportMessage` | 举报违规消息，服务端有此接口但 websdk2 未暴露 |
| 5 | `removeMessagesFromServer` 多模式 | `ChatManager.removeMessagesFromServer` | websdk2 只有一种删除模式，emclient 支持按消息 ID 列表删除和按时间戳批量删除两种方式 |
| 6 | 设备管理 | `ChatClient` | `getLoggedInDevicesFromServer` / `kickDevice` / `kickAllDevices` 完全缺失 |
| 7 | `blockGroupMessage` / `unblockGroupMessage` | `GroupManager` | 屏蔽群消息（不退群但不接收消息） |
| 8 | `markAllConversationsAsRead` | `ChatManager` | 一键标记所有会话已读，websdk2 只有单会话 `markConversationRead` |

### 1.2 Important

| # | 功能 | emclient 位置 | 说明 |
|---|------|--------------|------|
| 9 | `searchPublicGroup` | `GroupManager` | 按关键字搜索公开群，websdk2 只有 `getPublicGroupList` 分页列表 |
| 10 | `fetchMyGroupsCount` | `GroupManager` | 获取已加入群组数量（不拉全量列表） |
| 11 | `insertMessages` | `ChatManager.insertMessages` | 本地插入消息（不发送），用于系统提示、消息迁移等场景 |
| 12 | `createChatroom` / `destroyChatroom` | `ChatRoomManager` | 创建和销毁聊天室 |
| 13 | `StatisticsManager` | 独立 Manager | 消息统计（发送/接收字节数、消息数等） |
| 14 | `TranslateManager` 本地缓存 | 独立 Manager | `getTranslateResultByMsgId`、`removeTranslationsByConversationId` 等翻译结果本地管理 |
| 15 | PushManager 扩展 | `PushManager` | `setPushTemplate`、`reportPushAction`、`updatePushNickName`、`updatePushDisplayStyle` |
| 16 | ChatRoom `updateSelfNameCard` | `ChatRoomManager` | 聊天室内名片设置 |
| 17 | `getSelfIdsOnOtherPlatform` | `ContactManager` | 获取当前用户在其他平台的设备 ID 列表 |
| 18 | `downloadMessageThumbnail` | `ChatManager` | 独立缩略图下载入口，websdk2 的 `downloadAttachment` 不区分缩略图和原图 |

### 1.3 Nice-to-have

| # | 功能 | 说明 |
|---|------|------|
| 19 | `changeAppkey` / `changeAppId` | 运行时切换 appKey，极少使用但 emclient 支持 |
| 20 | `uploadLog` | 上传日志文件到服务端，用于远程排障 |
| 21 | `getMessagesCount` | 获取会话消息总数 |
| 22 | `createAccount`（注册） | 客户端注册账号能力 |
| 23 | `sendPing`（公开 API） | 手动发送心跳探测，websdk2 内部有但未暴露 |

---

## 二、实现问题（已有功能但实现不完整或有误）

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| 1 | Message `broadcast` 标记缺失 | Important | emclient 有 `setBroadcast()` 标记广播消息（全员可见，不计入未读），websdk2 未实现 |
| 2 | Message `isContentReplaced` 缺失 | Important | 服务端内容替换标记，用户无法判断消息是否被服务端替换过 |
| 3 | `recallMessage` 缺少 `ext` 参数 | Important | emclient 撤回时可附带扩展信息（如自定义撤回提示文案），websdk2 未支持 |
| 4 | 群消息已读回执分页查询缺失 | Important | emclient 有 `fetchGroupReadAcks` 分页获取已读回执详情列表（谁读了、什么时候读的） |
| 5 | `modifyMessage` 返回值缺少编辑元数据 | Important | emclient 返回 `operationTime`、`operatorId`、`operationCount`，需确认 websdk2 是否包含 |
| 6 | Message `senderInfo` 结构完整性 | Important | emclient 的 `EMSenderInfo` 包含 userId/nickname/avatar/namecard/remark，websdk2 通过 profile-sync 异步补充，但 Message 对象本身是否携带完整 senderInfo 需确认 |
| 7 | Stream message 状态枚举语义 | Nice-to-have | emclient 的 `START_AND_COMPLETE` 在 websdk2 中映射为 `FULL`，语义不够直观 |
| 8 | `removeHistoryMessages` 模式单一 | Important | websdk2 只有一种删除模式，emclient 支持按消息 ID 列表和按时间戳两种删除方式 |
| 9 | ChatRoom 事件使用内部前缀 | Nice-to-have | websdk2 的聊天室事件使用 `__chatroom:` 前缀的内部事件名，未暴露为公开的 `chatRoomManager.addEventHandler` 回调接口（与 Group/Contact 模式不一致） |

---

## 三、事件/回调缺失

### 3.1 Critical

| # | 事件 | emclient 位置 | 说明 |
|---|------|--------------|------|
| 1 | `onReceiveHasDeliveredAcks` | ChatManagerListener | 消息送达回执事件，websdk2 完全缺失 |
| 2 | `onReceiveCmdMessages`（独立 CMD 事件） | ChatManagerListener | CMD 透传消息独立事件，当前合并在 `onMessage` 中，不便于业务层区分处理 |
| 3 | `onMessageIdChanged` | ChatManagerListener | 本地 ID → 服务端 ID 变更通知，UI 层实时更新需要此事件 |

### 3.2 Important

| # | 事件 | emclient 位置 | 说明 |
|---|------|--------------|------|
| 4 | `onReceivePrivateMessages` | ChatManagerListener | 定向消息接收事件（群/聊天室中只发给特定人的消息） |
| 5 | `onMessageAttachmentsStatusChanged` | ChatManagerListener | 附件状态变更（下载中/下载完成/下载失败） |
| 6 | `onUpdateGroupAcks` | ChatManagerListener | 群消息已读回执数量更新通知 |
| 7 | `onUpdateMyGroupList` | GroupManagerListener | 已加入群组列表变更通知（加入/退出/被踢后） |
| 8 | `onLeaveGroup`（统一离开事件含原因） | GroupManagerListener | 当前分散为 `onUserRemoved` 和 `onGroupDestroyed`，缺少主动退出事件 |
| 9 | `undisturbMultiDevicesEvent` | MultiDevicesListener | 免打扰设置的多设备同步事件 |
| 10 | `onLeaveChatroom`（含原因） | ChatroomManagerListener | 聊天室离开事件应包含原因（被踢/房间销毁/主动退出） |

### 3.3 Nice-to-have

| # | 事件 | 说明 |
|---|------|------|
| 11 | `onPong` | 心跳响应事件，可用于网络延迟监测 |
| 12 | `onReceiveToken` | 服务端主动下发新 token 事件（区别于客户端主动 renew） |

---

## 四、API 设计改进建议

| # | 建议 | 严重度 | 说明 |
|---|------|--------|------|
| 1 | Conversation 对象化 | Important | emclient 的 Conversation 是独立实例，可直接 `conv.getMessages()`、`conv.markRead()`。websdk2 将操作全部平铺在 ChatManager 上，API 膨胀且缺少面向对象入口 |
| 2 | `FetchMessageOption` 高级历史查询 | Important | emclient 支持按发送者、类型、时间范围、方向等组合过滤，websdk2 的 `getHistoryMessages` 过滤能力较弱 |
| 3 | Message ext 类型安全存取 | Important | emclient 有 `setAttribute<T>/getAttribute<T>` 支持多种类型（bool/int/double/string/json），websdk2 只是 `Record<string, unknown>` |
| 4 | `onMessageStatusChanged` 统一回调 | Important | 统一的消息状态流转通知（sending→sent→delivered→read），当前分散为多个事件 |
| 5 | 附件下载进度事件 | Important | 接收端下载附件的进度通知，当前只有发送端有 progress callback |
| 6 | `logout(waitServerAck)` 参数 | Nice-to-have | 控制是否等待服务端确认断开 |
| 7 | Reaction 独立 Manager | Nice-to-have | emclient 将 Reaction 作为独立 Manager，更利于按需加载和职责分离 |
| 8 | `fetchGroupMemberInfoList`（批量成员信息） | Nice-to-have | 一次性获取多个成员的角色+属性+名片信息，减少多次调用 |

---

## 五、优先级总结

| 优先级 | 数量 | 建议行动 |
|--------|------|----------|
| **Critical** | 12 项 | 排入近期 spec 规划，逐步补齐 |
| **Important** | 20 项 | 按业务需求优先级逐步实现 |
| **Nice-to-have** | 15 项 | 作为后续迭代储备 |

---

## 六、后续行动建议

1. **近期优先**：定向消息、送达回执、设备管理、resendMessage — 这些是用户高频需求且服务端已支持
2. **中期补齐**：blockGroupMessage、markAllConversationsAsRead、removeMessagesFromServer 多模式、reportMessage
3. **架构优化**：Conversation 对象化、统一消息状态回调、ChatRoom 事件规范化
4. **长期储备**：StatisticsManager、TranslateManager 本地缓存、uploadLog
