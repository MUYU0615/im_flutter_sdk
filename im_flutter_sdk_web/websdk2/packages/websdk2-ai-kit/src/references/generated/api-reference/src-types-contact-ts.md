---
id: generated/api-reference/src-types-contact-ts
title: websdk2 API Reference - 联系人类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/contact.ts API Reference 分段。
---

## src/types/contact.ts

### Contact

#### 说明

联系人展示对象。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 联系人用户 ID。 |
| userInfo | `UserInfo` | 联系人资料视图，直接复用统一 `UserInfo`。 |
| remark | `string` | 当前用户给该联系人的备注。 |
| addTs | `number` | 联系人关系建立时间。 |

### ContactInfoUpdatedEvent

#### 说明

好友资料变化事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userInfo | `UserInfo` | 最新好友资料。 |
| contact | `Contact` | 当前会话中可用的联系人快照。 |

### ContactMutationTarget

#### 说明

联系人写操作的统一目标。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 目标用户 ID。 |

### AddContactParams

#### 说明

添加联系人的输入参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `string` | 可选的验证消息。 |

### SetContactRemarkParams

#### 说明

更新联系人备注的输入参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| remark | `string` | 联系人备注，允许空字符串以清空备注。 |

### BlocklistMutationParams

#### 说明

黑名单增删接口的输入参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待处理的用户 ID 列表。 |

### BlocklistAddResult

#### 说明

黑名单添加成功结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| succeeded | `ReadonlyArray<UserInfo>` | 成功加入黑名单的用户资料列表。 |
| failed | `ReadonlyArray<UserInfo>` | 加入失败的用户资料列表。 |

### BlocklistSnapshot

#### 说明

会话级黑名单快照。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<UserInfo>` | 当前黑名单条目列表。 |
| loaded | `boolean` | 当前会话是否已完成过服务端加载。 |
| source | `'server' | 'mutation_patch'` | 快照来源。 |

### ContactRosterEventPayload

#### 说明

原工程联系人 roster 事件的标准化载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| type | `ContactRosterEventType` | 原工程事件中的关系类型。 |
| from | `string` | 事件发送方用户 ID。 |
| to | `string` | 事件接收方用户 ID。 |
| status | `string` | 服务端附带的状态/原因字符串。 |
| rosterVersion | `string` | 当前 roster 版本号。 |
| userInfo | `UserInfo` | 事件目标用户的资料视图；对外事件会在派发前补齐，至少包含 `userId`。 |

### ContactSnapshot

#### 说明

联系人快照，包含列表、来源、版本和完整性信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<Contact>` | 当前快照中的联系人列表。 |
| source | `ContactSyncSource` | 当前快照来自缓存还是同步结果。 |
| version | `string` | 当前快照对应的联系人版本号。 |
| complete | `boolean` | 当前快照是否可作为完整联系人结果使用。 |

### ContactSyncError

#### 说明

联系人同步错误对象。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| code | `ErrorCode` | SDK 错误码。 |
| stage | `ContactSyncStage` | 错误发生阶段。 |
| message | `string` | 面向调用方的错误消息。 |
| retryable | `boolean` | 当前错误是否建议重试。 |

### ContactSyncFinishPayload

#### 说明

联系人同步完成事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| error | `ContactSyncError` | 失败时返回错误详情。成功时 `onContactSyncFinish` 不携带 payload。 |
