# SDK 对外接口风格说明

本文档仅描述对外 API 的使用方式与示例（初始化、登录、发消息、创建消息、事件监听、错误处理）。

## 1. 初始化与登录

```ts
import { ChatClient } from 'im-sdk-web';

const client = ChatClient.init({
  appKey: 'org#app',
  // serviceConfig 可选，默认使用 SDK 内置 DNS_CONFIG。
  // 如需指定 DNS_CONFIG 地址：
  // serviceConfig: { dnsConfigUrls: ['https://example.com/dns.json'] }
  // 如需固定服务地址直连：
  // serviceConfig: { serverUrls: { restApiUrl: 'https://...', wsUrl: 'wss://...' } }
});

await client.login({
  userId: 'user-1',
  token: 'token-xxx',
});
```

常用辅助方法：

```ts
const state = client.getConnectionState(); // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'reconnectFailed'
const currentUserId = client.getCurrentUserId(); // string | null
```

登出：

```ts
await client.logout();
```

## 2. 事件监听

```ts
client.addEventHandler('ui', {
  onConnecting: payload => console.log('connecting', payload),
  onConnected: payload => console.log('connected', payload),
  onDisconnected: payload => console.log('disconnected', payload),
  onReconnectFailed: payload => console.log('reconnectFailed', payload),
});

// 需要移除一组事件
client.removeEventHandler('ui');
```

连接事件 payload 结构（onConnecting/onConnected/onDisconnected/onReconnectFailed）：

```ts
{
  state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'reconnectFailed',
  reason: 'login' | 'reconnect' | 'online' | 'offline-recover' | 'heartbeat-failed' | 'send-timeout' | 'close' | 'error' | 'timeout' | 'limit' | 'offline',
  attempt: number,
  maxAttempts: number,
  isLoginPhase: boolean,
  isOnline: boolean,
  timestamp: number,
}
```

### 会话列表更新事件（onConversationListUpdate）

登录成功后会先派发缓存会话列表；服务端会话列表同步、联系人同步、用户资料 notify、消息收发或本地会话 mutation 更新本地会话列表后，都会继续派发该事件：

```ts
import { ChatManager } from 'im-sdk-web';

const chatManager = client.use(ChatManager);

chatManager.addEventHandler('conversation-ui', {
  onConversationListUpdate: ({ items, reason, patch }) => {
    console.log('reason', reason);
    console.log('changed conversations', patch.upserted);
    console.log('current conversations', items);
  },
});
```

payload 结构：

```ts
{
  version: number,
  items: ConversationItem[],
  reason: 'conversation' | 'profile' | 'message' | 'local',
  patch: {
    reset: boolean,
    upserted: ConversationItem[],
    removed: ConversationIdentifier[],
    affectedKeys: string[],
    orderChanged: boolean,
  },
}
```

简单使用时直接渲染 `items`：

```ts
chatManager.addEventHandler('conversation-ui', {
  onConversationListUpdate: ({ items }) => {
    setConversationItems(items);
  },
});
```

如果业务在会话对象上维护自己的本地字段，可以用 `patch` 合并：

- `patch.reset`：SDK 重新建立了会话列表基线，例如登录加载缓存、服务端全量同步或 fallback 全量刷新。此时应以 `items` 为当前权威快照，按 `${conversationType}:${conversationId}` 把业务本地字段重新挂回去。
- `patch.upserted`：本次新增或 SDK 字段变化的会话。
- `patch.removed`：本次删除的会话标识。
- `patch.orderChanged`：本次列表顺序发生变化。可能只有排序变化而没有 `upserted` 内容变化；按补丁合并时应按 `items` 的顺序重排本地列表。

```ts
type LocalConversationItem = ConversationItem & {
  draftText?: string;
  selected?: boolean;
};

const getConversationKey = (item: {
  conversationId: string;
  conversationType: ConversationType;
}): string => `${item.conversationType}:${item.conversationId}`;

chatManager.addEventHandler('conversation-ui', {
  onConversationListUpdate: ({ items, patch }) => {
    setConversationItems((previous: LocalConversationItem[]) => {
      if (patch.reset) {
        const previousByKey = new Map(previous.map((item) => [getConversationKey(item), item]));
        return items.map((item) => ({
          ...item,
          draftText: previousByKey.get(getConversationKey(item))?.draftText,
          selected: previousByKey.get(getConversationKey(item))?.selected,
        }));
      }

      const nextByKey = new Map(previous.map((item) => [getConversationKey(item), item]));
      for (const removed of patch.removed) {
        nextByKey.delete(getConversationKey(removed));
      }
      for (const item of patch.upserted) {
        const previousItem = nextByKey.get(getConversationKey(item));
        nextByKey.set(getConversationKey(item), {
          ...item,
          draftText: previousItem?.draftText,
          selected: previousItem?.selected,
        });
      }

      if (patch.orderChanged) {
        return items.map((item) => nextByKey.get(getConversationKey(item)) ?? item);
      }
      return previous
        .filter((item) => nextByKey.has(getConversationKey(item)))
        .map((item) => nextByKey.get(getConversationKey(item)) ?? item);
    });
  },
});
```

## 2.1 缓存模块（CacheManager）

缓存模块用于首屏会话展示与用户信息加速，写入采用批量 flush（空闲或节流时机）。  
登录成功会自动加载缓存并派发 `onConversationListUpdate`，无需手动调用。

```ts
import { CacheManager } from 'im-sdk-web';

const cache = new CacheManager({
  appKey: 'org#app',
  userId: 'user-1',
});

cache.setUserInfoSummaries([
  {
    userId: 'user-1',
    nickname: 'Tom',
    avatarUrl: '',
    lastAccess: Date.now(),
    lastUpdate: Date.now(),
  },
]);
```

## 2.2 用户信息管理（UserInfoManager）

```ts
import { ChatClient } from 'im-sdk-web';
import { UserInfoManager } from 'im-sdk-web';

const client = ChatClient.init({ appKey: 'org#app' }).use(UserInfoManager);

await client.userInfoManager.fetchUserInfoByUserId({
  userIds: ['user-1'],
});

await client.userInfoManager.fetchUserInfoByAttribute({
  userIds: ['user-1'],
  attributes: ['nickname', 'avatarUrl'],
});

await client.userInfoManager.subscribeUsersInfo({
  userIds: ['stranger-1', 'stranger-2'],
});

const subscribedUsers = await client.userInfoManager.getSubscribedUsers();

await client.userInfoManager.unsubscribeUsersInfo({
  userIds: ['stranger-2'],
});

await client.userInfoManager.updateOwnInfo({
  nickname: 'Tom',
  avatarUrl: 'https://example.com/avatar.png',
});

await client.userInfoManager.updateOwnInfoByAttribute(
  'avatarUrl',
  'https://example.com/avatar-v2.png'
);
```

资料事件监听：

```ts
client.userInfoManager.addEventHandler('user-info-ui', {
  onOwnInfoUpdated: userInfo => {
    console.log(userInfo.userId, userInfo.nickname);
  },
  onUserInfoUpdated: userInfos => {
    console.log(userInfos[0]?.userId, userInfos[0]?.nickname);
  },
});

client.contactManager.addEventHandler('contact-ui', {
  onContactInfoUpdated: payload => {
    console.log(payload.userInfo.userId, payload.contact?.remark);
  },
});
```

补充说明：

- `subscribeUsersInfo` / `unsubscribeUsersInfo` 面向陌生人资料订阅能力
- `getSubscribedUsers()` 会先读订阅用户名列表，再自动补齐为 `UserInfo[]`
- 当前用户资料更新成功，以及服务端下发 `user_metadata_updated` 多端通知时，会通过 `onOwnInfoUpdated` 派发
- 陌生人资料变更会并入 `onUserInfoUpdated`
- 好友资料变更通过 `contactManager` 的 `onContactInfoUpdated` 派发，并且会先刷新当前会话联系人视图

## 2.3 群组管理（GroupManager）

> 以下示例按 027 调整后的目标公开面展示，`getGroup(groupId)` 与 `Group` 单群对象需以对应实现任务完成结果为准。

```ts
import { ChatClient, GroupManager } from 'im-sdk-web';

const client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager);

const groups = client.groupManager.getJoinedGroupList();

const group = client.groupManager.getGroup(groups[0]?.groupId ?? '');
const detail = await group.getDetail();
const admins = await group.getAdmins();
```

群事件监听：

```ts
client.groupManager.addEventHandler('group-ui', {
  onInvitationReceived: payload => {
    console.log(payload.groupId, payload.inviter?.userId, payload.reason);
  },
  onGroupInfoChanged: payload => {
    console.log(payload.groupInfo.groupId, payload.groupInfo.name);
  },
});
```

补充说明：

- 群成员、管理员、黑名单、allowlist、禁言、已读成员等读取结果，当前统一返回对象化 `UserInfo`
- 推荐把单群上下文能力通过 `groupManager.getGroup(groupId)` 获取的 `Group` 对象使用；群列表仍然返回适合 state 的 plain object
- 不再推荐继续使用旧 connection/group 风格群组主路径；对外主入口统一收口到 `client.groupManager`
- `onGroupInfoChanged` / `onGroupDisabledChanged` 在必要时会先补拉完整群详情再派发
- allowlist 事件统一使用 `onAllowListAdded` / `onAllowListRemoved`，不再对外暴露 WhiteList 风格事件名
- 详细对照见 [GroupManager REST 与 SDK 返回对照](./group-manager-api.md)

## 2.4 聊天室管理（ChatRoomManager）

```ts
import { ChatClient, ChatRoomManager } from 'im-sdk-web';

const client = ChatClient.init({ appKey: 'org#app' }).use(ChatRoomManager);

const chatRooms = await client.chatRoomManager.getChatRoomList({
  pageNum: 1,
  pageSize: 20,
});

const chatRoom = client.chatRoomManager.getChatRoom(chatRooms.items[0]?.chatRoomId ?? '');
const detail = await chatRoom.getInfo();
const admins = await chatRoom.getAdminList();
```

聊天室事件监听：

```ts
client.chatRoomManager.addEventHandler('chatroom-ui', {
  onAdminAdded: payload => {
    console.log(payload.chatRoomId, payload.admin?.userId);
  },
  onChatRoomInfoChanged: payload => {
    console.log(payload.chatRoomInfo.chatRoomId, payload.chatRoomInfo.name);
  },
});
```

补充说明：

- 单聊天室上下文能力统一通过 `chatRoomManager.getChatRoom(chatRoomId)` 返回的 `ChatRoom` 对象使用
- `ChatRoom` 不提供同步 getter；详情统一通过 `getInfo()` / `refresh()` 获取
- 成员、管理员、黑名单、allowlist、禁言、共享文件 owner 等读取结果统一返回对象化 `UserInfo`
- `onChatRoomInfoChanged` 在必要时会先补拉完整聊天室详情再派发
- `uploadSharedFile` 不进入新的公开聊天室 API
- 详细对照见 [ChatRoomManager REST 与 SDK 返回对照](./chatroom-manager-api.md)

## 3. 创建消息

创建消息入口统一收敛到 `client.chatManager.createXMessage`。
`sender` 由 SDK 根据当前登录用户自动填充，`ChatClient` 不再公开创建消息方法，SDK 根入口也不再导出独立创建函数。

### 文本消息

```ts
const message = client.chatManager.createTextMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  content: 'hello',
});
```

### 命令/自定义消息

```ts
const cmdMessage = client.chatManager.createCmdMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  action: 'typing',
});

const customMessage = client.chatManager.createCustomMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  event: 'custom-event',
  params: { foo: 'bar' },
});
```

### 附件消息（image/file/voice/video）

附件创建参数允许传入 `data`（File/小程序文件对象），用于上传。  
注意：**MessageBody 对外不包含 `data` 字段**，`data` 只在发送阶段内部使用。

```ts
const file = input.files?.[0];
if (!file) throw new Error('file missing');

const imageMessage = client.chatManager.createImageMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  filename: file.name,
  filetype: file.type || 'image/png',
  width: 800,
  height: 600,
  isGif: false,
  data: file, // 仅用于上传，不会出现在 Message.body 中
});
```

如果你已自行上传完成，也可直接传远程 url（跳过上传）：

```ts
const fileMessage = client.chatManager.createFileMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  filename: 'report.pdf',
  filetype: 'application/pdf',
  url: 'https://cdn.example.com/report.pdf',
});
```

## 4. 发送消息

```ts
const sent = await client.chatManager.sendMessage(message);
console.log(sent.status); // 'sent' | 'failed'
```

附件上传进度/结果回调：

```ts
await client.chatManager.sendMessage(imageMessage, {
  onFileUploadProgress: progress => {
    console.log('upload', progress.percent);
  },
  onFileUploadComplete: result => {
    console.log('upload done', result.url);
  },
  onFileUploadError: error => {
    console.error('upload error', error);
  },
});
```

重试说明：

- **发送失败**：缓存会保留同一 `msgLocalId` 的文件，可直接 `sendMessage` 重试。
- **发送成功**：缓存会清理，重发需创建新消息。

## 5. 错误处理

SDK 会抛出带 `code/details` 的错误对象（基于 `SDKError`），建议通过 `code` 判断：

```ts
try {
  await client.login({ userId: 'u1', token: 't1' });
} catch (error) {
  const err = error as { code?: number; details?: unknown; message?: string };
  console.error(err.code, err.message, err.details);
}
```

常见错误类型（按码段）：

- 1000–1999：参数校验（Validation）
- 5000–5999：消息发送/ACK
- 6000–6999：连接/鉴权
- 7100–7199：附件上传

更多错误码见：`docs/reference/errors.md`。

## 6. 跨平台适配器（PlatformAdapter）

SDK 默认会根据运行环境自动装配平台能力。浏览器环境使用 Web 标准能力；微信、QQ、头条、百度、支付宝、钉钉等小程序环境使用 SDK 内置的小程序适配器。

`ChatClient.init` 不暴露平台适配器注入参数。初始化后 SDK 会自动完成 `request`、`upload`、`socket`、`storage`、`runtime`、`imageProcessor` 等能力装配。

### 6.1 能力缺失 fail-fast

初始化阶段会强校验关键能力：`request`、`upload`、`socket`、`proto`。若缺失会直接抛错，错误结构如下：

```ts
{
  name: 'PlatformAdapterError',
  code: 'PLATFORM_MISSING_CAPABILITY',
  stage: 'init',
  retryable: false,
  details: {
    required: ['request', 'upload', 'socket', 'proto'],
    missing: ['socket'],
  },
}
```

静态 protobuf 为默认且唯一方案；若编解码类型缺失会抛出 `PLATFORM_PROTO_FAILED`。

## 待讨论：

### 1. 创建消息是放在 chatClient 上？还是导出一个Message 类，把创建消息的方法设置成Message类的静态方法更好？

• 当前实现已收敛到 `client.chatManager.createXMessage + chatManager.sendMessage`，理由：

现有模式优点

- 语义清晰：创建消息与连接/发送分离，函数式更直观。
- 更轻：不引入 Message 类的实例化/继承语义，避免“消息对象应该是纯数据”的争议。
- 更易跨端：小程序/uniapp 环境对 class/instance 序列化不友好，函数更稳。

Message 类静态方法的缺点

- 只是“命名空间”，本质还是工厂函数，没有真实实例行为，反而多一层概念。
- 容易让人误解“Message 是可变对象/有方法”，但我们实际把它当数据结构用。

统一 API 入口时，创建和发送都挂在消息域 manager 下，避免在 `ChatClient` 上继续扩展消息域方法。

`结论：`
创建消息方法放在 `ChatManager` 上

### 2. sendMessage 方法放在哪？

- chatClient上
- const channel = chatClient.createChannle(); channel.sendMeesage()
- ChatManager上

短结论：当前阶段更适合放在 ChatClient.sendMessage 上。
只有在你计划引入“频道对象的生命周期与状态管理”（成员、未读、设置、缓存等）时，
才值得做 channel.sendMessage() 的抽象。

对比要点：

ChatClient.sendMessage（现状）

- ✅ 简单、无状态，易理解，适合 MVP
- ✅ 与现有 chatManager.createXMessage + conversationId/conversationType 结构一致
- ✅ 不需要管理 channel 实例的生命周期/同步
- ❌ 每次都要传 channel（重复）

ChatManager.sendMessage（当前主路径）

- ✅ 与移动端 `chatManager.sendMessage` 心智一致
- ✅ 不需要维护额外 Channel 实例生命周期
- ✅ 继续复用 `Message` 数据模型中的 `conversationId/conversationType`
- ❌ conversation CRUD 仍需后续补齐

建议

- Phase 1 保留 `ChatClient.sendMessage`，同时新增 `chatManager.sendMessage`。
- Channel 实例已移除，消息目标放在 `Message.conversationId/conversationType` 中。

`结论：`
sendMessage 放在 chatManager 上

### 3. Error 定义

- details 是对象
- code 按照移动端 差异记录

https://c1.private.easemob.com/pages/viewpage.action?pageId=24257795

### 4. 日志级别

`结论：`
debug warn error
code 按照移动端 差异记录

### 5. API 命名

- getXXX fetchXXX getXXXFromServer getXXXWithCursor 不同风格
- 重构的api 风格，以及部分风格不能统一的是否还使用原 api名字

`结论：`
getXXX 和移动端不一致的记录

### 6. 有哪些 Manager?

`结论：`
ContactManager UserInfoManager PresenceManager PushManager ChatManager

### 7. 使用 Manager 的方式

```ts
// 主入口导入（小程序推荐）
import { ChatClient, ChatManager } from 'im-sdk-web';

const client = ChatClient.init({ appKey: 'org#app', managers: [ChatManager] });
const chatManager = client.use(ChatManager);

const message = client.chatManager.createTextMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  content: 'hello',
});

await chatManager.sendMessage(message);
```

```ts
// 子路径导入（支持 tree shaking）
import { ChatClient } from 'im-sdk-web';
import { ChatManager } from 'im-sdk-web/managers/chat';

const client = ChatClient.init({ appKey: 'org#app', managers: [ChatManager] });
const chatManager = client.use(ChatManager);

const message = client.chatManager.createTextMessage({
  conversationId: 'group-1',
  conversationType: 'groupChat',
  content: 'hello group',
});

await chatManager.sendMessage(message);
```

`结论：`
小程序优先使用主入口导入；支持 tree shaking 的构建可使用子路径导入。

8. 事件监听方式

添加监听放在具体的 Manager 上
