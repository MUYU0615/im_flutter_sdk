---
id: generated/api-reference/src-managers-chatroom-manager-ts
title: websdk2 API Reference - ChatRoomManager API
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/chatroom-manager.ts API Reference 分段。
---

## src/managers/chatroom-manager.ts

### ChatRoomManager

### addEventHandler(id: EventHandlerId, handlers: ChatRoomEventHandlerMap) => void

#### 说明

注册聊天室事件处理器，事件包括成员进出、禁言、allowlist、公告和属性变更等。

#### 调用示例

调用示例（监听聊天室成员加入）

```ts
client.chatRoomManager.addEventHandler('chatroom-ui', {
  onMembersJoined: event => {
    console.log(event.chatRoomId, event.members);
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一 ID，用于后续移除。 |
| handlers | `ChatRoomEventHandlerMap` | 聊天室事件处理器集合，可只实现需要监听的回调。 |

#### 返回值

注册完成后无返回值。

#### 可能错误

- 错误码 `110`：事件上下文未绑定。解决方式：先完成 SDK 初始化并注册 ChatRoomManager。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除指定 ID 的聊天室事件处理器。

#### 调用示例

调用示例（移除监听）

```ts
client.chatRoomManager.removeEventHandler('chatroom-ui');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 待移除的事件处理器 ID。 |

#### 返回值

移除完成后无返回值。

#### 可能错误

- 错误码 `110`：事件上下文未绑定。解决方式：先完成 SDK 初始化并注册 ChatRoomManager。

### getChatRoomList(params: GetChatRoomListParams) => Promise<{
    readonly items: ReadonlyArray<ChatRoomSummary>;
    readonly pageNum?: number;
    readonly pageSize?: number;
    readonly total?: number;
    readonly hasMore?: boolean;
  }>

#### 说明

分页获取公开聊天室列表，并尽量补齐聊天室所有者资料。

#### 调用示例

调用示例（获取第一页聊天室）

```ts
const result = await client.chatRoomManager.getChatRoomList({
  pageNum: 1,
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatRoomListParams` | 分页参数；`pageNum` 从 1 开始，`pageSize` 未传时使用服务端默认值。 |

#### 返回值

返回聊天室摘要列表与分页信息。

#### 可能错误

- REST 请求失败或登录态不可用时抛出统一 SDK 错误。

### getChatRoom(chatRoomId: string) => ChatRoom

#### 说明

获取绑定指定 `chatRoomId` 的单聊天室对象，便于后续在对象上调用成员、公告、属性等方法。

#### 调用示例

调用示例（获取聊天室对象）

```ts
const chatRoom = client.chatRoomManager.getChatRoom('chatroom-1');
const detail = await chatRoom.getInfo();
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID，必填且不能为空字符串。 |

#### 返回值

返回复用的单聊天室对象。

#### 可能错误

- 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。

### joinChatRoom(params: JoinChatRoomParams) => Promise<void>

#### 说明

加入指定聊天室。该方法通过长连接聊天室操作发送加入请求。

#### 调用示例

调用示例（加入聊天室）

```ts
await client.chatRoomManager.joinChatRoom({
  chatRoomId: 'chatroom-1',
  ext: 'from-web',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `JoinChatRoomParams` | 加入参数，包含必填 `chatRoomId`，以及可选 `ext`、`leaveOtherRooms`。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 4 | exceed_limit | 当前用户已加入过多聊天室，服务端拒绝继续加入 | 退出不再使用的聊天室后重试，或联系服务端提升限制 |
| 704 | members_full | 聊天室人数已达上限，无法继续加入 | 等待其他成员退出后重试，或联系聊天室管理员提升上限 |
| 707 | user_in_blocklist | 当前用户已被加入聊天室黑名单，无法加入 | 联系聊天室管理员将用户从黑名单移除 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
