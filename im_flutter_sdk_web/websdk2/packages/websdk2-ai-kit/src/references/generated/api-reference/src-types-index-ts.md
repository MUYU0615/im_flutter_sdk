---
id: generated/api-reference/src-types-index-ts
title: websdk2 API Reference - 消息与基础类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/index.ts API Reference 分段。
---

## src/types/index.ts

### MiniAppFile

#### 说明

小程序/uniapp 本地文件对象

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | - |
| size | `number` | - |
| name | `string` | - |
| type | `string` | - |

### ReactNativeFile

#### 说明

React Native 本地文件对象

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| uri | `string` | - |
| size | `number` | - |
| name | `string` | - |
| type | `string` | - |

### TextMessageBody

#### 说明

文本消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| content | `string` | - |
| targetLanguages | `string[]` | - |
| translations | `Record<string, string>` | - |

### ImageMessageBody

#### 说明

图片消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| localUrl | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| width | `number` | - |
| height | `number` | - |
| isGif | `boolean` | - |
| isOriginalImage | `boolean` | - |
| originalImageUrl | `string` | - |
| bigImageUrl | `string` | - |
| secret | `string` | - |
| fileLength | `number` | - |
| thumbnailUrl | `string` | - |

### FileMessageBody

#### 说明

文件消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| fileSize | `number` | - |
| fileLength | `number` | - |
| secret | `string` | - |

### VoiceMessageBody

#### 说明

语音消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| duration | `number` | - |
| fileLength | `number` | - |
| secret | `string` | - |

### VideoMessageBody

#### 说明

视频消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| duration | `number` | - |
| width | `number` | - |
| height | `number` | - |
| fileLength | `number` | - |
| secret | `string` | - |
| thumbnailUrl | `string` | - |

### LocationMessageBody

#### 说明

位置消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| latitude | `number` | - |
| longitude | `number` | - |
| address | `string` | - |
| buildingName | `string` | - |

### CmdMessageBody

#### 说明

命令消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| action | `string` | - |
| params | `Record<string, string>` | - |
| deliverOnlineOnly | `boolean` | - |

### CustomMessageBody

#### 说明

自定义消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| event | `string` | - |
| params | `Record<string, string>` | - |

### CombineMessageBody

#### 说明

合并消息体

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | - |
| summary | `string` | - |
| compatibleText | `string` | - |
| messageList | `ReadonlyArray<Message>` | - |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| fileLength | `number` | - |
| secret | `string` | - |
| combineLevel | `number` | - |

### Sender

#### 说明

发送者信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 发送者用户 ID。 |
| nickname | `string` | 发送者昵称。 |
| avatarUrl | `string` | 发送者头像地址。 |

### Message

#### 说明

消息对象。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| msgServerId | `string` | 服务端消息 ID。 |
| msgLocalId | `string` | 本地消息 ID。 |
| from | `string` | 发送方 userId。 |
| to | `string` | 接收方标识：单聊为对方 userId，群聊为 groupId，聊天室为 chatroomId。 |
| sender | `Sender` | 发送者资料摘要。 |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ChatConversationType` | 会话类型。 |
| type | `MessageType` | 消息类型。 |
| status | `MessageStatus` | 消息状态。 |
| ext | `Record<string, unknown>` | 消息扩展字段。 |
| timestamp | `number` | 消息时间戳，单位毫秒。 |
| body | `MessageBody` | 消息体。 |
| direct | `MessageDirect` | 消息方向。 |
| receiverList | `string[]` | 定向消息接收者列表。 |
| deliverOnlineOnly | `boolean` | 是否仅投递给在线用户。 |
| env | `string` | 出站路由环境标记。 |
| priority | `MessagePriority` | 消息优先级。 |
| isBroadcast | `boolean` | 是否为广播消息，主要用于聊天室下行语义。 |
| isContentReplaced | `boolean` | 内容是否被审核替换。 |
| combineLevel | `number` | 合并消息层级，仅 `type=combine` 时有意义。 |
| stream | `StreamMessageMeta` | 流式消息元信息，仅流式消息回调场景提供。 |
| reactions | `MessageReaction[]` | 消息的表情回应列表。 |
| groupReadCount | `number` | 群消息已读人数。 |
| needGroupReadReceipt | `boolean` | 是否需要群已读回执。 |

### MessageReaction

#### 说明

消息表情回应
Message reaction

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reaction | `string` | 表情标识。Reaction emoji identifier. |
| count | `number` | 该表情的回应人数。Count of users who reacted with this emoji. |
| userList | `string[]` | 回应的用户 ID 列表。List of user IDs who reacted. |
| isAddedBySelf | `boolean` | 当前用户是否已添加该表情。Whether the current user has added this reaction. |

### CombineMessage

#### 说明

合并消息对象

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| type | `'combine'` | - |
| body | `CombineMessageBody` | - |
| combineLevel | `number` | - |

### StreamMessageMeta

#### 说明

流式消息元信息

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| customType | `string` | - |
| seq | `number` | - |
| status | `StreamMessageStatus` | - |
| errorType | `number` | - |
| finishReason | `number` | - |
| deltaText | `string` | - |
| fullText | `string` | - |

### StreamMessage

#### 说明

流式消息事件

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| type | `'text'` | - |
| body | `TextMessageBody` | - |
| stream | `StreamMessageMeta` | - |

### FileUploadProgress

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| loaded | `number` | 已上传字节数。 |
| total | `number` | 总字节数。 |
| percent | `number` | 上传进度百分比。 |

### FileUploadResult

#### 说明

文件上传完成结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | 文件远程地址。 |
| isOriginalImage | `boolean` | 是否按原图语义上传。 |
| originalImageUrl | `string` | 原图地址。 |
| bigImageUrl | `string` | 大图地址。 |
| secret | `string` | 下载密钥。 |
| fileLength | `number` | 文件大小，单位字节。 |
| filetype | `string` | 文件 MIME 类型。 |
| filename | `string` | 文件名。 |
| thumbnailUrl | `string` | 缩略图地址。 |
| width | `number` | 图片或视频宽度，单位像素。 |
| height | `number` | 图片或视频高度，单位像素。 |

### SendMessageOptions

#### 说明

发送消息的可选回调。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onSending | `(message: Message) => void` | 消息开始发送时触发。 |
| onSuccess | `(message: Message) => void` | 消息发送成功时触发。 |
| onFailed | `(message: Message, error: Error) => void` | 消息发送失败时触发。 |
| onFileUploadProgress | `(progress: FileUploadProgress) => void` | 附件上传进度回调。 |
| onFileUploadComplete | `(result: FileUploadResult) => void` | 附件上传完成回调。 |
| onFileUploadError | `(error: Error) => void` | 附件上传失败回调。 |
| onFileUploadCanceled | `() => void` | 附件上传取消回调。 |

### DownloadCombineMessageParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| secret | `string` | - |
| timeoutMs | `number` | - |
| maxItems | `number` | - |

### Connection

#### 说明

连接对象（内存对象，不持久化）

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| status | `ConnectionStatus` | - |
| serverUrl | `string` | - |
| userId | `string` | - |
| token | `string` | - |
| lastConnectedAt | `number` | - |
| reconnectAttempts | `number` | - |
| error | `Error` | - |
