---
id: generated/api-reference/src-managers-chat-thread-chat-thread-ts
title: websdk2 API Reference - src/managers/chat-thread/chat-thread.ts
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/chat-thread/chat-thread.ts API Reference 分段。
---

## src/managers/chat-thread/chat-thread.ts

### ChatThread

### getInfo() => Promise<ChatThreadDetail>

#### 说明

获取当前子区详情。

#### 调用示例

调用示例（获取详情）

```ts
const thread = client.chatThreadManager.getChatThread('thread-1');
const detail = await thread.getInfo();
```

#### 返回值

返回子区详情。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区详情 |
| 210 | permission_denied | 当前用户无权访问目标子区 | 确认当前用户已加入父群组或目标子区 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 详情查询错误 | 稍后重试或联系服务端排查 |

### refresh() => Promise<ChatThreadDetail>

#### 说明

刷新并返回当前子区详情，等价于 `getInfo()`。

#### 调用示例

调用示例（刷新详情）

```ts
const detail = await thread.refresh();
```

#### 返回值

返回最新子区详情。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区详情 |
| 210 | permission_denied | 当前用户无权访问目标子区 | 确认当前用户已加入父群组或目标子区 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 详情查询错误 | 稍后重试或联系服务端排查 |

### join() => Promise<void>

#### 说明

加入当前子区。

#### 调用示例

调用示例（加入子区）

```ts
await thread.join();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再加入子区 |
| 210 | permission_denied | 当前用户不在父群组中，或服务端拒绝加入目标子区 | 确认当前用户已加入父群组且目标子区可加入 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 4 | service_limit_exceeded | 加入子区频率或数量超过服务端限制 | 减少操作频率或联系服务端提升配额 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 加入错误 | 稍后重试或联系服务端排查 |

### leave() => Promise<void>

#### 说明

退出当前子区。

#### 调用示例

调用示例（退出子区）

```ts
await thread.leave();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再退出子区 |
| 210 | permission_denied | 服务端拒绝当前用户退出目标子区 | 确认当前用户已加入目标子区且允许退出 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 退出错误 | 稍后重试或联系服务端排查 |

### destroy() => Promise<void>

#### 说明

解散当前子区。

#### 调用示例

调用示例（解散子区）

```ts
await thread.destroy();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再解散子区 |
| 210 | permission_denied | 当前用户不是群主、管理员或子区创建者，服务端拒绝解散 | 使用有管理权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 解散错误 | 稍后重试或联系服务端排查 |

### updateName(input: { readonly name: string }) => Promise<void>

#### 说明

更新当前子区名称。

#### 调用示例

调用示例（更新名称）

```ts
await thread.updateName({ name: 'New topic' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `{ readonly name: string }` | 更新输入，`name` 为新子区名称。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空，或 name 为空/格式非法 | 通过有效的 chatThreadId 创建实体，并传入有效的新名称 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再更新子区名称 |
| 210 | permission_denied | 当前用户没有修改目标子区名称的权限 | 使用群主、管理员或有权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 名称更新错误 | 稍后重试或联系服务端排查 |

### getMemberList(query: {
    readonly pageSize?: number;
    readonly cursor?: string;
  }) => Promise<ChatThreadMemberListResult>

#### 说明

获取当前子区成员列表。

#### 调用示例

调用示例（查询成员）

```ts
const page = await thread.getMemberList({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| query | `{
    readonly pageSize?: number;
    readonly cursor?: string;
  }` | 游标分页参数。 |

#### 返回值

返回成员列表和下一页游标。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空，或分页参数非法 | 通过有效的 chatThreadId 创建实体，并传入有效分页参数 |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区成员 |
| 210 | permission_denied | 当前用户无权访问目标子区成员列表 | 确认当前用户已加入父群组或目标子区 |
| 606 | resource_not_found | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 成员列表查询错误 | 稍后重试或联系服务端排查 |

### removeMember(input: Omit<RemoveChatThreadMemberParams, 'chatThreadId'>) => Promise<void>

#### 说明

从当前子区移除成员。

#### 调用示例

调用示例（移除成员）

```ts
await thread.removeMember({ memberId: 'user-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `Omit<RemoveChatThreadMemberParams, 'chatThreadId'>` | 移除输入，包含成员 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | ChatThread 实体绑定的 chatThreadId 为空，或 memberId 为空/格式非法 | 通过有效的 chatThreadId 创建实体，并传入有效成员 ID |
| 201 | not_login | 当前用户登录态不可用或 token 无效 | 重新登录后再移除子区成员 |
| 210 | permission_denied | 当前用户没有移除目标子区成员的权限 | 使用群主、管理员或有权限的账号重试 |
| 606 | resource_not_found | chatThreadId 对应子区不存在，或 memberId 不是子区成员 | 确认子区和目标成员关系仍存在 |
| 301 | request_timeout | 服务端处理超时或网络链路超时 | 稍后重试 |
| 303 | service_error | 服务端返回未细分的 Thread 成员移除错误 | 稍后重试或联系服务端排查 |
