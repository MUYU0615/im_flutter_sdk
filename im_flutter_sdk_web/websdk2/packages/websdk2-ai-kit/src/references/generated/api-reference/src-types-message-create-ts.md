---
id: generated/api-reference/src-types-message-create-ts
title: websdk2 API Reference - 消息创建参数类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/message-create.ts API Reference 分段。
---

## src/types/message-create.ts

### CreateMessageBaseParams

#### 说明

创建消息的通用入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID；单聊为对端用户 ID，群聊为 groupId，聊天室为 chatroomId。 |
| conversationType | `ChatConversationType` | 会话类型。 |
| ext | `Record<string, unknown>` | 消息扩展字段，需保持 JSON 可序列化。 |
| timestamp | `number` | 本地时间戳，单位毫秒；不传时由 SDK 生成。 |
| receiverList | `string[]` | 定向消息接收者列表。 |
| deliverOnlineOnly | `boolean` | 是否仅投递给在线用户。 |
| env | `string` | 出站路由环境标记。 |
| priority | `MessagePriority` | 消息优先级。 |
| needGroupReadReceipt | `boolean` | 是否需要群已读回执，仅群聊有效。 |

### CreateTextMessageParams

#### 说明

创建文本消息的入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| content | `string` | 文本消息内容。 |
| targetLanguages | `string[]` | 发送时需要翻译到的目标语言列表。 |

### CreateImageMessageParams

#### 说明

创建图片消息的入参。`data` 与 `originalUrl` 至少传一个；传 `data` 时 SDK 会自动补齐文件信息，并在发送前解析图片宽高。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | 本地文件对象。 |
| originalUrl | `string` | 远程原图地址。 |
| filename | `string` | 文件名；传 `data` 时可由 SDK 自动获取。 |
| filetype | `string` | 文件 MIME 类型；传 `data` 时可由 SDK 自动获取。 |
| width | `number` | 图片宽度，单位像素。 |
| height | `number` | 图片高度，单位像素。 |
| isGif | `boolean` | 是否为 GIF。 |
| isOriginalImage | `boolean` | 是否按原图语义发送。 |
| fileLength | `number` | 文件大小，单位字节。 |
| thumbnailUrl | `string` | 缩略图地址。 |

### CreateFileMessageParams

#### 说明

创建文件消息的入参。`data` 与 `originalUrl` 至少传一个。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | 本地文件对象。 |
| originalUrl | `string` | 远程文件地址。 |
| filename | `string` | 文件名；传 `data` 时可由 SDK 自动获取。 |
| filetype | `string` | 文件 MIME 类型；传 `data` 时可由 SDK 自动获取。 |
| fileSize | `number` | 文件大小，单位字节。 |
| fileLength | `number` | 文件长度，单位字节；兼容服务端字段。 |

### CreateVoiceMessageParams

#### 说明

创建语音消息的入参。`data` 与 `originalUrl` 至少传一个。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | 本地语音文件对象。 |
| originalUrl | `string` | 远程语音地址。 |
| filename | `string` | 文件名；传 `data` 时可由 SDK 自动获取。 |
| filetype | `string` | 文件 MIME 类型；传 `data` 时可由 SDK 自动获取。 |
| duration | `number` | 语音时长，单位秒。 |
| fileLength | `number` | 文件大小，单位字节。 |

### CreateVideoMessageParams

#### 说明

创建视频消息的入参。`data` 与 `originalUrl` 至少传一个。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | 本地视频文件对象。 |
| originalUrl | `string` | 远程视频地址。 |
| filename | `string` | 文件名；传 `data` 时可由 SDK 自动获取。 |
| filetype | `string` | 文件 MIME 类型；传 `data` 时可由 SDK 自动获取。 |
| duration | `number` | 视频时长，单位秒。 |
| width | `number` | 视频宽度，单位像素。 |
| height | `number` | 视频高度，单位像素。 |
| fileLength | `number` | 文件大小，单位字节。 |
| thumbnailUrl | `string` | 视频缩略图地址。 |

### CreateLocationMessageParams

#### 说明

创建位置消息的入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| latitude | `number` | 纬度。 |
| longitude | `number` | 经度。 |
| address | `string` | 地址描述。 |
| buildingName | `string` | 建筑名称。 |

### CreateCmdMessageParams

#### 说明

创建命令消息的入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| action | `string` | 命令动作。 |

### CreateCustomMessageParams

#### 说明

创建自定义消息的入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| event | `string` | 自定义事件名称。 |
| params | `Record<string, string>` | 自定义参数。 |

### CreateCombineMessageParams

#### 说明

创建合并消息的入参。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | 合并消息标题。 |
| summary | `string` | 合并消息摘要。 |
| compatibleText | `string` | 兼容展示文本，默认 `[聊天记录]`。 |
| messageList | `ReadonlyArray<Message>` | 被合并的消息列表。 |
