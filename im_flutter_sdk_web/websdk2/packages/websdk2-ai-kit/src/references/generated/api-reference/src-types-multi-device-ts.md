---
id: generated/api-reference/src-types-multi-device-ts
title: websdk2 API Reference - 多设备事件类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/multi-device.ts API Reference 分段。
---

## src/types/multi-device.ts

### MultiDeviceEventBase

#### 说明

MultiDevice 公共载荷基类。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `MultiDeviceEventCategory` | 事件分类。 |
| operation | `| MultiDeviceContactOperation
    | MultiDeviceGroupOperation
    | MultiDeviceThreadOperation
    | MultiDeviceConversationOperation
    | MultiDeviceMessageRemovedOperation` | 标准化操作名。 |
| deviceId | `string` | 来源设备 ID。 |
| timestamp | `number` | 事件时间戳。 |
| raw | `Readonly<Record<string, unknown>>` | 原始调试数据。 |

### MultiDeviceContactEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `'contact'` | - |
| operation | `MultiDeviceContactOperation` | - |
| targetUserId | `string` | - |
| rosterVersion | `string` | - |
| ext | `string` | - |

### MultiDeviceGroupEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `'group'` | - |
| operation | `MultiDeviceGroupOperation` | - |
| groupId | `string` | - |
| userIds | `ReadonlyArray<string>` | - |
| operatorId | `string` | - |
| groupName | `string` | - |

### MultiDeviceThreadEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `'thread'` | - |
| operation | `MultiDeviceThreadOperation` | - |
| threadId | `string` | - |
| parentId | `string` | - |
| userIds | `ReadonlyArray<string>` | - |
| operatorId | `string` | - |
| threadName | `string` | - |

### MultiDeviceConversationEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `'conversation'` | - |
| operation | `MultiDeviceConversationOperation` | - |
| conversationId | `string` | - |
| conversationType | `ConversationType` | - |
| mark | `number` | - |
| remindType | `string` | - |
| silentMode | `Readonly<Record<string, unknown>>` | - |
| operatorId | `string` | - |

### MultiDeviceMessageRemovedEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| category | `'messageRemoved'` | - |
| operation | `MultiDeviceMessageRemovedOperation` | - |
| conversationId | `string` | - |
| conversationType | `ConversationType` | - |
| messageIds | `ReadonlyArray<string>` | - |
| beforeTimestamp | `number` | - |

### MultiDeviceEventHandlerMap

#### 说明

ChatClient 多设备监听器映射。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onMultiDeviceContact | `(
    event: MultiDeviceContactEvent
  ) => void | Promise<void>` | 联系人多设备事件。 |
| onMultiDeviceGroup | `(
    event: MultiDeviceGroupEvent
  ) => void | Promise<void>` | 群组多设备事件。 |
| onMultiDeviceThread | `(
    event: MultiDeviceThreadEvent
  ) => void | Promise<void>` | 子区多设备事件。 |
| onMultiDeviceConversation | `(
    event: MultiDeviceConversationEvent
  ) => void | Promise<void>` | 会话多设备事件。 |
| onMultiDeviceMessageRemoved | `(
    event: MultiDeviceMessageRemovedEvent
  ) => void | Promise<void>` | 漫游消息删除多设备事件。 |
