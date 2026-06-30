# 从旧 SDK 升级到新 SDK 迁移指南

本文档帮助你从 `easemob-websdk`（旧 SDK）迁移到新版 SDK。

## 目录

1. [架构变更概述](#架构变更概述)
2. [安装与初始化](#安装与初始化)
3. [登录与登出](#登录与登出)
4. [消息创建与发送](#消息创建与发送)
5. [事件系统](#事件系统)
6. [联系人 API](#联系人-api)
7. [用户属性 API](#用户属性-api)
8. [群组 API](#群组-api)
9. [聊天室 API](#聊天室-api)
10. [会话 API](#会话-api)
11. [Presence / Thread / Reaction / Push](#其他模块)
12. [返回值变更](#返回值变更)
13. [已移除的 API](#已移除的-api)

---

## 架构变更概述

| 维度 | 旧 SDK | 新 SDK |
|------|--------|--------|
| 入口 | `new SDK.connection({ appKey })` | `ChatClient.init({ appKey })` |
| API 挂载 | 所有 API 挂在 `conn` 实例上 | 按功能分散到各 Manager |
| 消息创建 | `WebIM.message.create({ type, ... })` | `chatManager.createXxxMessage(...)` |
| 消息发送 | `conn.send(msg)` | `chatManager.sendMessage(msg)` |
| 会话标识 | `to` + `chatType` | `conversationId` + `conversationType` |
| 返回值 | `Promise<AsyncResult<T>>` 包装 | 直接返回 `Promise<T>` |
| 事件系统 | 按消息类型分事件 + `onGroupEvent` 聚合 | 统一 `onMessage` + 独立群组/聊天室事件名 |
| 类型安全 | 弱类型，大量 `any` | TypeScript strict，完整类型推导 |
| 模块化 | 全量引入 | 按需注册 Manager |

### Manager 对照表

| 旧 SDK（conn 上的方法） | 新 SDK Manager |
|------------------------|----------------|
| `conn.send` / `WebIM.message.create` | `client.chatManager` |
| `conn.addContact` / `conn.getContacts` 等 | `client.contactManager` |
| `conn.createGroup` / `conn.getGroupInfo` 等 | `client.groupManager` |
| `conn.joinChatRoom` / `conn.getChatRooms` 等 | `client.chatRoomManager` |
| `conn.publishPresence` / `conn.subscribePresence` 等 | `client.presenceManager` |
| `conn.setSilentModeForAll` 等 | `client.pushManager` |
| `conn.updateOwnUserInfo` / `conn.fetchUserInfoById` | `client.userInfoManager` |
| `conn.createChatThread` 等 | `client.chatThreadManager` |

---

## 安装与初始化

### 旧 SDK

```typescript
import SDK from 'easemob-websdk';

const conn = new SDK.connection({
  appKey: 'org#app',
  isHttpDNS: true,
  delivery: true,
  isFixedDeviceId: true,
});

conn.addEventHandler('handler', { onConnected: () => {} });
```

### 新 SDK

```typescript
import { ChatClient, ChatManager, ContactManager, GroupManager } from 'easemob-websdk';

const client = ChatClient.init({
  appKey: 'org#app',
  useFixedDeviceId: true,
  managers: [ChatManager, ContactManager, GroupManager],
});

client.addEventHandler('handler', { onConnected: () => {} });
```

### 初始化参数对照

| 旧参数 | 新参数 | 说明 |
|--------|--------|------|
| `appKey` | `appKey` | 不变 |
| `isFixedDeviceId` | `useFixedDeviceId` | 重命名 |
| `delivery` | `enableDeliveryReceipt` | 重命名，功能相同 |
| `isHttpDNS` | — | 默认启用，无需配置 |
| `useOwnUploadFun` | `useCustomAttachmentUpload` | 重命名 |
| `useReplacedMessageContents` | `useReplacedMessageContents` | 不变 |
| `customDeviceName` | `customDeviceName` | 不变 |
| `customOSPlatform` | `customOsPlatform` | 大小写变化 |
| `apiUrl` / `url` | `serviceConfig` | 合并为对象 |
| `autoReconnectNumMax` | — | 内置重连策略，无需配置 |
| `isDebug` | — | 使用 `logger.setLevel()` 替代 |

---

## 登录与登出

### 旧 SDK

```typescript
// 登录
await conn.open({ user: 'userId', accessToken: 'token' });

// 登出
conn.close();
```

### 新 SDK

```typescript
// 登录
await client.login({ userId: 'userId', token: 'token' });

// 登出
await client.logout();
```

### 变更点

| 变更 | 说明 |
|------|------|
| `open` → `login` | 方法重命名 |
| `{ user, accessToken }` → `{ userId, token }` | 参数重命名 |
| 不再支持密码登录 | `pwd` 参数已移除 |
| `close()` → `logout()` | 方法重命名，且变为异步 |
| `renewToken(token)` | 不变，但返回 `{ token, expireAt }` |

---

## 消息创建与发送

### 旧 SDK

```typescript
// 创建
const msg = WebIM.message.create({
  type: 'txt',
  to: 'user2',
  chatType: 'singleChat',
  msg: 'Hello!',
  ext: { key: 'value' },
});

// 发送
const result = await conn.send(msg);
// result: { localMsgId, serverMsgId }
```

### 新 SDK

```typescript
// 创建（类型安全，每种消息类型有独立方法）
const msg = client.chatManager.createTextMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  content: 'Hello!',
  ext: { key: 'value' },
});

// 发送
const sentMsg = await client.chatManager.sendMessage(msg);
// sentMsg: 完整的 Message 对象
```

### 消息创建方法对照

| 旧 SDK `type` 值 | 新 SDK 方法 | 参数变更 |
|------------------|-------------|----------|
| `'txt'` | `createTextMessage` | `msg` → `content` |
| `'img'` | `createImageMessage` | `file` 不变 |
| `'audio'` | `createVoiceMessage` | `length` → `duration` |
| `'video'` | `createVideoMessage` | `length` → `duration` |
| `'file'` | `createFileMessage` | `filename` → `fileName` |
| `'loc'` | `createLocationMessage` | `lat/lng` → `latitude/longitude`，`addr` → `address` |
| `'cmd'` | `createCmdMessage` | `action` 不变 |
| `'custom'` | `createCustomMessage` | `customEvent/customExts` 不变 |
| `'combine'` | `createCombineMessage` | `messageList/title/summary` 不变 |

### 会话标识变更

| 旧 SDK | 新 SDK |
|--------|--------|
| `to: 'user2'` | `conversationId: 'user2'` |
| `chatType: 'singleChat'` | `conversationType: 'singleChat'` |

`conversationType` 值不变：`'singleChat'` / `'groupChat'` / `'chatRoom'`。

### 发送选项变更

旧 SDK 将 `deliverOnlineOnly`、`receiverList`、`priority` 放在消息创建参数中；新 SDK 放在 `sendMessage` 的第二个参数：

```typescript
await client.chatManager.sendMessage(msg, {
  deliverOnlineOnly: true,
  receiverList: ['user3'],
  priority: 'high',
});
```

### 附件上传回调变更

旧 SDK 在消息创建参数中传入 `onFileUploadProgress/Complete/Error`；新 SDK 在 `sendMessage` 选项中传入（或通过 Promise 处理）。

---

## 事件系统

### 注册方式

注册方式不变，仍然使用 `addEventHandler` / `removeEventHandler`：

```typescript
// 旧 SDK
conn.addEventHandler('id', { ... });
conn.removeEventHandler('id');

// 新 SDK（完全相同）
client.addEventHandler('id', { ... });
client.removeEventHandler('id');
```

### 消息事件变更

旧 SDK 按消息类型分发到不同回调，新 SDK 统一为 `onMessage`：

| 旧 SDK 事件 | 新 SDK 事件 |
|-------------|-------------|
| `onTextMessage(msg)` | `onMessage(msg)` — `msg.type === 'text'` |
| `onImageMessage(msg)` | `onMessage(msg)` — `msg.type === 'image'` |
| `onAudioMessage(msg)` | `onMessage(msg)` — `msg.type === 'voice'` |
| `onVideoMessage(msg)` | `onMessage(msg)` — `msg.type === 'video'` |
| `onFileMessage(msg)` | `onMessage(msg)` — `msg.type === 'file'` |
| `onLocationMessage(msg)` | `onMessage(msg)` — `msg.type === 'location'` |
| `onCmdMessage(msg)` | `onMessage(msg)` — `msg.type === 'cmd'` |
| `onCustomMessage(msg)` | `onMessage(msg)` — `msg.type === 'custom'` |
| `onCombineMessage(msg)` | `onMessage(msg)` — `msg.type === 'combine'` |
| `onMessage(msgs[])` | `onMessage(msg)` — 注意：旧 SDK 是数组，新 SDK 是单条 |

**迁移示例：**

```typescript
// 旧 SDK
conn.addEventHandler('msg', {
  onTextMessage: (msg) => handleText(msg),
  onImageMessage: (msg) => handleImage(msg),
});

// 新 SDK
client.addEventHandler('msg', {
  onMessage: (msg) => {
    switch (msg.type) {
      case 'text': handleText(msg); break;
      case 'image': handleImage(msg); break;
    }
  },
});
```

### 连接事件变更

| 旧 SDK | 新 SDK | 说明 |
|--------|--------|------|
| `onConnected` | `onConnected` | 不变 |
| `onDisconnected` | `onDisconnected` | 不变 |
| `onReconnecting` | `onConnecting` | 重命名 |
| `onTokenWillExpire` | `onTokenWillExpire` | 不变 |
| `onTokenExpired` | `onTokenExpired` | 不变 |
| `onOnline` | — | 已移除 |
| `onOffline` | — | 已移除 |
| `onError` | — | 已移除，通过 Promise reject 处理 |

### 消息操作事件变更

| 旧 SDK | 新 SDK | 说明 |
|--------|--------|------|
| `onRecallMessage` | `onMessageRecalled` | 重命名 |
| `onModifiedMessage` | `onMessageUpdated` | 重命名 |
| `onReadMessage` | `onMessageRead` | 重命名 |
| `onChannelMessage` | `onConversationRead` | 重命名（会话已读回执） |
| `onDeliveredMessage` | `onMessageDelivered` | 重命名，通过 `chatManager.addEventHandler` 监听 |
| `onReceivedMessage` | — | 已移除（服务端 ACK） |
| `onMessagePinEvent` | `onPinnedMessageChanged` | 重命名 |
| `onReactionChange` | `onReactionChanged` | 重命名 |
| `onStatisticMessage` | — | 已移除 |

### 群组事件变更（重大变更）

旧 SDK 使用单一 `onGroupEvent` 回调 + `operation` 字段区分操作；新 SDK 拆分为独立事件名：

```typescript
// 旧 SDK
conn.addEventHandler('group', {
  onGroupEvent: (event) => {
    switch (event.operation) {
      case 'inviteToJoin': /* ... */ break;
      case 'memberPresence': /* ... */ break;
      case 'removeMember': /* ... */ break;
    }
  },
});

// 新 SDK
client.addEventHandler('group', {
  onInvitationReceived: (event) => { /* 收到入群邀请 */ },
  onMembersJoined: (event) => { /* 成员加入 */ },
  onUserRemoved: (event) => { /* 被移出群 */ },
});
```

**群组事件 operation → 新事件名对照：**

| 旧 `operation` | 新事件名 |
|----------------|----------|
| `inviteToJoin` | `onInvitationReceived` |
| `acceptInvite` | `onInvitationAccepted` |
| `rejectInvite` | `onInvitationDeclined` |
| `requestToJoin` | `onRequestToJoinReceived` |
| `acceptRequest` | `onRequestToJoinAccepted` |
| `joinPublicGroupDeclined` | `onRequestToJoinDeclined` |
| `directJoined` | `onAutoAcceptInvitationFromGroup` |
| `removeMember` | `onUserRemoved` |
| `destroy` | `onGroupDestroyed` |
| `memberPresence` / `membersPresence` | `onMembersJoined` |
| `memberAbsence` / `membersAbsence` | `onMembersExited` |
| `muteMember` | `onMuteListAdded` |
| `unmuteMember` | `onMuteListRemoved` |
| `muteAllMembers` | `onAllMemberMuteStateChanged` |
| `unmuteAllMembers` | `onAllMemberMuteStateChanged` |
| `setAdmin` | `onAdminAdded` |
| `removeAdmin` | `onAdminRemoved` |
| `changeOwner` | `onOwnerChanged` |
| `updateAnnouncement` / `deleteAnnouncement` | `onAnnouncementChanged` |
| `uploadFile` | `onSharedFileAdded` |
| `deleteFile` | `onSharedFileDeleted` |
| `updateInfo` | `onGroupInfoChanged` |
| `addUserToAllowlist` | `onAllowListAdded` |
| `removeAllowlistMember` | `onAllowListRemoved` |
| `memberAttributesUpdate` | `onGroupMemberAttributeChanged` |

### 聊天室事件变更

与群组类似，旧 SDK 使用 `onChatroomEvent` + `operation`，新 SDK 使用独立事件名（通过 `ChatRoomManager.addEventHandler` 注册）。映射关系与群组类似。

### 联系人事件

| 旧 SDK | 新 SDK | 说明 |
|--------|--------|------|
| `onContactInvited` | `onContactInvited` | 不变 |
| `onContactAgreed` | `onContactAgreed` | 不变 |
| `onContactRefuse` | `onContactRefuse` | 不变 |
| `onContactDeleted` | `onContactDeleted` | 不变 |
| `onContactAdded` | `onContactAdded` | 不变 |

### 多设备事件变更

旧 SDK 使用单一 `onMultiDeviceEvent`，新 SDK 按类型拆分：

| 旧 SDK | 新 SDK |
|--------|--------|
| `onMultiDeviceEvent` (所有) | `onMultiDeviceContact` |
| | `onMultiDeviceGroup` |
| | `onMultiDeviceThread` |
| | `onMultiDeviceConversation` |
| | `onMultiDeviceMessageRemoved` |

---

## 联系人 API

| 旧 SDK | 新 SDK | 说明 |
|--------|--------|------|
| `conn.getContacts()` | `contactManager.getContacts()` | 返回值从 `UserId[]` 变为 `Contact[]`（含 remark） |
| `conn.getAllContacts()` | `contactManager.getContacts()` | 合并，新 SDK 默认含 remark |
| `conn.addContact(to, msg)` | `contactManager.addContact({ userId, reason })` | 参数对象化 |
| `conn.deleteContact(to)` | `contactManager.deleteContact({ userId })` | 参数对象化 |
| `conn.acceptInvitation(to)` | `contactManager.acceptContactInvite({ userId })` | 重命名 |
| `conn.declineInvitation(to)` | `contactManager.declineContactInvite({ userId })` | 重命名 |
| `conn.setContactRemark({ userId, remark })` | `contactManager.setContactRemark({ userId, remark })` | 不变 |
| `conn.getBlocklist()` | `contactManager.getBlocklist()` | 返回 `UserInfo[]` 而非 `UserId[]` |
| `conn.addUsersToBlocklist({ name })` | `contactManager.addUsersToBlocklist({ userIds })` | `name` → `userIds` |
| `conn.removeUserFromBlocklist({ name })` | `contactManager.removeUserFromBlocklist({ userIds })` | `name` → `userIds` |

---

## 用户属性 API

| 旧 SDK | 新 SDK | 说明 |
|--------|--------|------|
| `conn.updateOwnUserInfo(params)` | `userInfoManager.updateOwnInfo(params)` | 重命名 |
| `conn.updateOwnUserInfo('nickname', val)` | `userInfoManager.updateOwnInfoByAttribute({ attribute, value })` | 拆分为独立方法 |
| `conn.fetchUserInfoById({ userId })` | `userInfoManager.getUserInfoByUserId({ userIds })` | 重命名，参数复数 |

---

## 群组 API

所有群组 API 从 `conn.xxx` 迁移到 `client.groupManager.xxx`。

| 旧 SDK | 新 SDK | 说明 |
|--------|--------|------|
| `conn.createGroupVNext(params)` | `groupManager.createGroup(params)` | 重命名 |
| `conn.getGroupInfo({ groupId })` | `groupManager.getGroupInfo({ groupId })` | 不变 |
| `conn.getJoinedGroups(params)` | `groupManager.getJoinedGroupList(params)` | 重命名 |
| `conn.listGroups(params)` | `groupManager.getPublicGroupList(params)` | 重命名 |
| `conn.modifyGroup(params)` | `groupManager.updateGroupInfo(params)` | 重命名 |
| `conn.destroyGroup({ groupId })` | `groupManager.destroyGroup({ groupId })` | 不变 |
| `conn.leaveGroup({ groupId })` | `groupManager.leaveGroup({ groupId })` | 不变 |
| `conn.changeGroupOwner(params)` | `groupManager.changeGroupOwner(params)` | 不变 |
| `conn.inviteUsersToGroup(params)` | `groupManager.inviteUsersToGroup(params)` | `users` → `userIds` |
| `conn.joinGroup({ groupId, message })` | `groupManager.joinGroup({ groupId, reason })` | `message` → `reason` |
| `conn.getGroupMembers({ groupId, cursor, limit })` | `groupManager.getGroupMemberList({ groupId, cursor, pageSize })` | `limit` → `pageSize` |
| `conn.setGroupAdmin({ groupId, username })` | `groupManager.addGroupAdmin({ groupId, userId })` | `username` → `userId` |
| `conn.removeGroupAdmin({ groupId, username })` | `groupManager.removeGroupAdmin({ groupId, userId })` | `username` → `userId` |
| `conn.muteGroupMember({ username, muteDuration, groupId })` | `groupManager.muteGroupMembers({ userIds, duration, groupId })` | 参数重命名，支持批量 |
| `conn.unmuteGroupMember({ groupId, username })` | `groupManager.unmuteGroupMembers({ groupId, userIds })` | 支持批量 |
| `conn.disableSendGroupMsg({ groupId })` | `groupManager.muteAllGroupMembers({ groupId })` | 重命名 |
| `conn.enableSendGroupMsg({ groupId })` | `groupManager.unmuteAllGroupMembers({ groupId })` | 重命名 |
| `conn.blockGroupMembers({ groupId, usernames })` | `groupManager.blockGroupMembers({ groupId, userIds })` | `usernames` → `userIds` |
| `conn.getGroupBlocklist({ groupId })` | `groupManager.getGroupBlocklist({ groupId })` | 不变 |
| `conn.fetchGroupAnnouncement({ groupId })` | `groupManager.getGroupAnnouncement({ groupId })` | 重命名 |
| `conn.updateGroupAnnouncement(params)` | `groupManager.updateGroupAnnouncement(params)` | 不变 |

---

## 聊天室 API

所有聊天室 API 从 `conn.xxx` 迁移到 `client.chatRoomManager.xxx`。

| 旧 SDK | 新 SDK | 说明 |
|--------|--------|------|
| `conn.getChatRooms(params)` | `chatRoomManager.getChatRoomList(params)` | 重命名 |
| `conn.getChatRoomDetails({ chatRoomId })` | `chatRoomManager.getChatRoomInfo({ chatRoomId })` | 重命名 |
| `conn.joinChatRoom({ roomId })` | `chatRoomManager.joinChatRoom({ chatRoomId })` | `roomId` → `chatRoomId` |
| `conn.leaveChatRoom({ roomId })` | `chatRoomManager.leaveChatRoom({ chatRoomId })` | `roomId` → `chatRoomId` |
| `conn.modifyChatRoom(params)` | `chatRoomManager.updateChatRoomInfo(params)` | 重命名 |
| `conn.getChatRoomMembers({ chatRoomId, cursor, limit })` | `chatRoomManager.getMemberList({ chatRoomId, cursor, pageSize })` | 重命名 |
| `conn.setChatRoomAdmin({ chatRoomId, username })` | `chatRoomManager.addAdmin({ chatRoomId, userId })` | 重命名 |
| `conn.removeChatRoomAdmin({ chatRoomId, username })` | `chatRoomManager.removeAdmin({ chatRoomId, userId })` | 重命名 |
| `conn.getChatRoomAttributes(params)` | `chatRoomManager.getAttributes(params)` | 重命名 |
| `conn.setChatRoomAttributes(params)` | `chatRoomManager.setAttributes(params)` | 重命名 |
| `conn.removeChatRoomAttributes(params)` | `chatRoomManager.removeAttributes(params)` | 重命名 |

---

## 会话 API

| 旧 SDK | 新 SDK | 说明 |
|--------|--------|------|
| `conn.getServerConversations(params)` | `chatManager.getConversationList(params)` | 重命名 |
| `conn.deleteConversation({ channel, chatType, deleteRoam })` | `chatManager.deleteConversation({ conversationId, conversationType, deleteRoamingMessages })` | 参数重命名 |
| `conn.pinConversation({ conversationId, conversationType, isPinned })` | `chatManager.setConversationPinned({ conversationId, conversationType, isPinned })` | 重命名 |
| `conn.getServerPinnedConversations(params)` | `chatManager.getPinnedConversationList(params)` | 重命名 |
| `conn.markConversation({ conversations, mark, isMarked })` | `chatManager.addConversationMark / removeConversationMark` | 拆分为两个方法 |
| `conn.getServerConversationsByFilter({ filter: { mark } })` | `chatManager.getConversationListByMark({ mark })` | 简化参数 |

---

## 其他模块

### Presence

| 旧 SDK | 新 SDK |
|--------|--------|
| `conn.publishPresence(params)` | `presenceManager.publishPresence(params)` |
| `conn.subscribePresence(params)` | `presenceManager.subscribePresence(params)` |
| `conn.unsubscribePresence(params)` | `presenceManager.unsubscribePresence(params)` |
| `conn.getSubscribedPresencelist(params)` | `presenceManager.getSubscribedPresenceList(params)` |
| `conn.getPresenceStatus(params)` | `presenceManager.getPresenceStatus(params)` |

### Thread

| 旧 SDK | 新 SDK |
|--------|--------|
| `conn.createChatThread(params)` | `chatThreadManager.createChatThread(params)` |
| `conn.joinChatThread(params)` | `chatThreadManager.joinChatThread(params)` |
| `conn.leaveChatThread(params)` | `chatThreadManager.leaveChatThread(params)` |
| `conn.destroyChatThread(params)` | `chatThreadManager.destroyChatThread(params)` |
| `conn.changeChatThreadName(params)` | `chatThreadManager.updateChatThreadName(params)` |
| `conn.getChatThreadDetail(params)` | `chatThreadManager.getChatThreadInfo(params)` |
| `conn.getChatThreadLastMessage(params)` | `chatThreadManager.getChatThreadLastMessageList(params)` |

### Reaction

| 旧 SDK | 新 SDK |
|--------|--------|
| `conn.addReaction(params)` | `chatManager.addReaction(params)` |
| `conn.deleteReaction(params)` | `chatManager.removeReaction(params)` |
| `conn.getReactionList(params)` | `chatManager.getReactionList(params)` |
| `conn.getReactionDetail(params)` | `chatManager.getReactionDetail(params)` |

### Push / 免打扰

| 旧 SDK | 新 SDK |
|--------|--------|
| `conn.setSilentModeForAll(params)` | `pushManager.setGlobalSilentMode(params)` |
| `conn.getSilentModeForAll()` | `pushManager.getGlobalSilentMode()` |
| `conn.setSilentModeForConversation(params)` | `pushManager.setConversationSilentMode(params)` |
| `conn.getSilentModeForConversation(params)` | `pushManager.getConversationSilentMode(params)` |
| `conn.clearRemindTypeForConversation(params)` | `pushManager.clearConversationRemindType(params)` |
| `conn.getSilentModeForConversations(params)` | `pushManager.getConversationSilentModes(params)` |
| `conn.setPushPerformLanguage(params)` | `pushManager.setPushLanguage(params)` |
| `conn.getPushPerformLanguage()` | `pushManager.getPushLanguage()` |

---

## 返回值变更

旧 SDK 所有 REST API 返回 `Promise<AsyncResult<T>>`，需要通过 `.data` 访问实际数据：

```typescript
// 旧 SDK
const result = await conn.getGroupInfo({ groupId: 'g1' });
const info = result.data[0]; // AsyncResult 包装

// 新 SDK — 直接返回业务类型
const info = await client.groupManager.getGroupInfo({ groupId: 'g1' });
```

### AsyncResult 包装移除

| 旧 SDK 返回 | 新 SDK 返回 |
|-------------|-------------|
| `AsyncResult<UserId[]>` | `ReadonlyArray<Contact>` |
| `AsyncResult<GroupDetailInfo[]>` | `GroupDetail` |
| `AsyncResult<{ groupId }>` | `CreateGroupResult` |
| `AsyncResult<SendMsgResult>` | `Message`（完整消息对象） |
| `AsyncResult<ServerConversations>` | `ConversationListResult` |

### 错误处理

旧 SDK 错误通过 `onError` 事件或 Promise reject 返回松散对象；新 SDK 使用类型化错误类：

```typescript
// 新 SDK 错误类型
import { ValidationError, ConnectionError, SDKError } from 'easemob-websdk';

try {
  await client.chatManager.sendMessage(msg);
} catch (error) {
  if (error instanceof ValidationError) {
    // 参数校验错误
  } else if (error instanceof SDKError) {
    // 服务端业务错误，有 error.code
  }
}
```

---

## 已移除的 API

以下旧 SDK API 在新 SDK 中已移除或无等价替代：

| 旧 API | 说明 |
|--------|------|
| `conn.registerUser()` | 注册用户应通过服务端 REST API |
| `conn.listen()` | 已废弃，使用 `addEventHandler` |
| `conn.isOpened()` | 使用 `client.getConnectionState()` |
| `conn.setLoginInfoCustomExt()` | 使用 `initConfig.loginExtensionInfo` |
| `conn.onShow()` | 小程序生命周期钩子，新 SDK 内部处理 |
| `conn.usePlugin()` | 使用 `ChatClient.init({ managers })` 或 `.use()` |
| `conn.fetchHistoryMessages()` | 使用 `chatManager.getHistoryMessages()`（旧版分页接口已移除） |
| `conn.createChatRoom()` | 创建聊天室应通过服务端 REST API |
| `conn.getGroupMsgReadUser()` | 使用 `chatManager.getGroupMessageReadUsers()` |
| `WebIM.message.create({ type: 'read' })` | 使用 `chatManager.markMessageRead({ messages: [{ message }] })` |
| `WebIM.message.create({ type: 'delivery' })` | 送达回执暂未实现 |
| `WebIM.message.create({ type: 'channel' })` | 使用 `chatManager.markConversationRead()` |
| 所有 deprecated 别名（`getBlacklist`、`getRoster` 等） | 使用新 SDK 对应方法 |
