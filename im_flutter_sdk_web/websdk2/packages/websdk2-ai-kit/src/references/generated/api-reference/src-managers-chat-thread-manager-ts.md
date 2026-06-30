---
id: generated/api-reference/src-managers-chat-thread-manager-ts
title: websdk2 API Reference - src/managers/chat-thread-manager.ts
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/chat-thread-manager.ts API Reference 分段。
---

## src/managers/chat-thread-manager.ts

### ChatThreadManager

### bind(client: ChatClient, context: ManagerEventContext) => void

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| client | `ChatClient` | - |
| context | `ManagerEventContext` | - |

### addEventHandler(id: EventHandlerId, handlers: ChatThreadEventHandlerMap) => void

#### 说明

注册 ChatThread 事件处理器。只包含移动端对齐的 4 个公开事件，不包含 `onChatThreadChange`。

#### 调用示例

调用示例（监听 Thread 创建）

```ts
client.chatThreadManager.addEventHandler('thread-ui', {
  onChatThreadCreated: event => {
    console.log(event.chatThreadId);
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器 ID；相同 ID 会覆盖旧处理器。 |
| handlers | `ChatThreadEventHandlerMap` | ChatThread 事件处理器映射。 |

#### 返回值

无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除指定 ChatThread 事件处理器。

#### 调用示例

调用示例（取消监听）

```ts
client.chatThreadManager.removeEventHandler('thread-ui');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 要移除的事件处理器 ID。 |

#### 返回值

无返回值。

### getChatThread(chatThreadId: string) => ChatThread

#### 说明

获取绑定指定 `chatThreadId` 的 ChatThread 实体对象。

#### 调用示例

调用示例（获取实体对象）

```ts
const thread = client.chatThreadManager.getChatThread('thread-1');
const detail = await thread.getInfo();
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |

#### 返回值

返回可复用的 ChatThread 实体对象。

### createChatThread(params: CreateChatThreadParams) => Promise<CreateChatThreadResult>

#### 说明

创建子区。

#### 调用示例

调用示例（创建子区）

```ts
const result = await client.chatThreadManager.createChatThread({
  parentId: 'group-1',
  name: 'Topic',
  messageId: 'msg-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateChatThreadParams` | 创建参数，包含父群组 ID、子区名称和父消息 ID。 |

#### 返回值

返回新建子区 ID。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | parentId、name 或 messageId 为空或格式非法 | 传入有效的父群组 ID、子区名称和父消息 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再创建子区 |
| 210 | permission_denied | 当前用户不在父群组中，或服务端未开通 Thread 能力 | 确认当前用户已加入父群组，并检查控制台 Thread 能力开通状态 |
| 606 | resource_not_found | parentId 对应群组不存在，或 messageId 对应父消息不存在 | 确认父群组和父消息仍存在后重试 |
| 4 | service_limit_exceeded | 子区数量或创建频率超过服务端限制 | 减少创建频率，清理不需要的子区，或联系服务端提升配额 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 创建错误 | 稍后重试或联系服务端排查 |

### getChatThreadList(params: GetChatThreadListParams) => Promise<ChatThreadListResult>

#### 说明

查询指定群组下的子区列表。

#### 调用示例

调用示例（查询群内子区）

```ts
const page = await client.chatThreadManager.getChatThreadList({
  parentId: 'group-1',
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadListParams` | 查询参数，包含父群组 ID、分页大小和游标。 |

#### 返回值

返回子区列表和下一页游标。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | parentId 为空，pageSize 不是 1 到 50 之间的整数，或 cursor 类型非法 | 传入有效的父群组 ID、分页大小和游标 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区列表 |
| 210 | permission_denied | 当前用户无权访问目标群组的子区列表 | 确认当前用户已加入父群组 |
| 606 | resource_not_found | parentId 对应群组不存在或已被解散 | 确认父群组 ID 正确且群组仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 列表查询错误 | 稍后重试或联系服务端排查 |

### getJoinedChatThreadList(params: GetJoinedChatThreadListParams) => Promise<ChatThreadListResult>

#### 说明

查询当前用户已加入的子区列表。

#### 调用示例

调用示例（查询已加入子区）

```ts
const page = await client.chatThreadManager.getJoinedChatThreadList({
  parentId: 'group-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetJoinedChatThreadListParams` | 查询参数；`parentId` 可选。 |

#### 返回值

返回已加入子区列表和下一页游标。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | pageSize 不是 1 到 50 之间的整数，cursor 类型非法，或 parentId 类型非法 | 传入有效的分页参数；如指定 parentId，应传入非空字符串 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询已加入子区 |
| 210 | permission_denied | 当前用户无权访问目标群组的已加入子区列表 | 确认当前用户已加入目标群组 |
| 606 | resource_not_found | 指定 parentId 时，目标群组不存在或已被解散 | 确认父群组 ID 正确且群组仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的已加入 Thread 查询错误 | 稍后重试或联系服务端排查 |

### getChatThreadInfo(params: GetChatThreadInfoParams) => Promise<ChatThreadDetail>

#### 说明

查询子区详情。

#### 调用示例

调用示例（查询详情）

```ts
const detail = await client.chatThreadManager.getChatThreadInfo({
  chatThreadId: 'thread-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadInfoParams` | 查询参数，包含子区 ID。 |

#### 返回值

返回子区详情。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 为空或格式非法 | 传入有效的子区 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区详情 |
| 210 | permission_denied | 当前用户无权访问目标子区 | 确认当前用户已加入父群组或目标子区 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 详情查询错误 | 稍后重试或联系服务端排查 |

### joinChatThread(params: ChatThreadMutationTarget) => Promise<void>

#### 说明

加入子区。

#### 调用示例

调用示例（加入子区）

```ts
await client.chatThreadManager.joinChatThread({ chatThreadId: 'thread-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ChatThreadMutationTarget` | 操作目标，包含子区 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 为空或格式非法 | 传入有效的子区 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再加入子区 |
| 210 | permission_denied | 当前用户不在父群组中，或服务端拒绝加入目标子区 | 确认当前用户已加入父群组且目标子区可加入 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 4 | service_limit_exceeded | 加入子区频率或数量超过服务端限制 | 减少操作频率或联系服务端提升配额 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 加入错误 | 稍后重试或联系服务端排查 |

### leaveChatThread(params: ChatThreadMutationTarget) => Promise<void>

#### 说明

退出子区。

#### 调用示例

调用示例（退出子区）

```ts
await client.chatThreadManager.leaveChatThread({ chatThreadId: 'thread-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ChatThreadMutationTarget` | 操作目标，包含子区 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 为空或格式非法 | 传入有效的子区 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再退出子区 |
| 210 | permission_denied | 服务端拒绝当前用户退出目标子区 | 确认当前用户已加入目标子区且允许退出 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 退出错误 | 稍后重试或联系服务端排查 |

### destroyChatThread(params: ChatThreadMutationTarget) => Promise<void>

#### 说明

解散子区。

#### 调用示例

调用示例（解散子区）

```ts
await client.chatThreadManager.destroyChatThread({ chatThreadId: 'thread-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ChatThreadMutationTarget` | 操作目标，包含子区 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 为空或格式非法 | 传入有效的子区 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再解散子区 |
| 210 | permission_denied | 当前用户不是群主、管理员或子区创建者，服务端拒绝解散 | 使用有管理权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 解散错误 | 稍后重试或联系服务端排查 |

### updateChatThreadName(params: UpdateChatThreadNameParams) => Promise<void>

#### 说明

更新子区名称。

#### 调用示例

调用示例（更新名称）

```ts
await client.chatThreadManager.updateChatThreadName({
  chatThreadId: 'thread-1',
  name: 'New topic',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UpdateChatThreadNameParams` | 更新参数，包含子区 ID 和新名称。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 或 name 为空或格式非法 | 传入有效的子区 ID 和新名称 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再更新子区名称 |
| 210 | permission_denied | 当前用户没有修改目标子区名称的权限 | 使用群主、管理员或有权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 名称更新错误 | 稍后重试或联系服务端排查 |

### getChatThreadMemberList(params: GetChatThreadMemberListParams) => Promise<ChatThreadMemberListResult>

#### 说明

查询子区成员列表。

#### 调用示例

调用示例（查询成员）

```ts
const page = await client.chatThreadManager.getChatThreadMemberList({
  chatThreadId: 'thread-1',
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadMemberListParams` | 查询参数，包含子区 ID、分页大小和游标。 |

#### 返回值

返回成员列表和下一页游标。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 为空，pageSize 不是 1 到 50 之间的整数，或 cursor 类型非法 | 传入有效的子区 ID、分页大小和游标 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区成员 |
| 210 | permission_denied | 当前用户无权访问目标子区成员列表 | 确认当前用户已加入父群组或目标子区 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 成员列表查询错误 | 稍后重试或联系服务端排查 |

### removeChatThreadMember(params: RemoveChatThreadMemberParams) => Promise<void>

#### 说明

从子区移除成员。

#### 调用示例

调用示例（移除成员）

```ts
await client.chatThreadManager.removeChatThreadMember({
  chatThreadId: 'thread-1',
  memberId: 'user-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `RemoveChatThreadMemberParams` | 移除参数，包含子区 ID 和成员 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadId 或 memberId 为空或格式非法 | 传入有效的子区 ID 和成员 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再移除子区成员 |
| 210 | permission_denied | 当前用户没有移除目标子区成员的权限 | 使用群主、管理员或有权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在，或 memberId 不是子区成员 | 确认子区和目标成员关系仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 成员移除错误 | 稍后重试或联系服务端排查 |

### getChatThreadLastMessageList(params: GetChatThreadLastMessageListParams) => Promise<ChatThreadLastMessageListResult>

#### 说明

批量查询子区最后一条消息。

#### 调用示例

调用示例（查询最后消息）

```ts
const result = await client.chatThreadManager.getChatThreadLastMessageList({
  chatThreadIds: ['thread-1', 'thread-2'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadLastMessageListParams` | 查询参数，包含最多 20 个子区 ID。 |

#### 返回值

返回每个子区的最后消息摘要。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | chatThreadIds 为空、不是数组、超过 20 个，或包含非法子区 ID | 传入 1 到 20 个有效的子区 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区最后消息 |
| 210 | permission_denied | 当前用户无权访问一个或多个目标子区 | 确认当前用户有权限访问传入的所有子区 |
| 606 | resource_not_found | 一个或多个 chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 最后消息查询错误 | 稍后重试或联系服务端排查 |
