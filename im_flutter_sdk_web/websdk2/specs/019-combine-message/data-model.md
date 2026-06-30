# 019 数据模型（Phase 1）

## 1) CombineMessageDraft

- **描述**: 业务侧创建的合并消息草稿输入对象。
- **关键字段**:
  - `id`: 本地消息 ID
  - `to`: 会话目标 ID
  - `chatType`: `singleChat | groupChat | chatRoom`
  - `messageList`: 待合并消息列表
  - `title`: 合并消息标题
  - `summary`: 合并消息摘要
  - `compatibleText`: 旧端兼容展示文本
- **校验规则**:
  - `messageList` 条数范围 `1..300`
  - `messageList` 仅允许业务消息类型（`txt/img/video/audio/file/loc/custom/combine`）
  - `messageList` 输入顺序必须保留，不允许重排

## 2) CombineNestedConstraint

- **描述**: 合并消息嵌套层级约束模型。
- **关键字段**:
  - `maxInputLevel`: 输入消息中最大 `combineLevel`（若无则按 0）
  - `nextCombineLevel`: 发送时计算得到的层级（`maxInputLevel + 1`）
  - `limit`: 固定值 10
- **校验规则**:
  - `nextCombineLevel <= 10` 才允许发送
  - 超限必须返回可识别错误并终止发送

## 3) CombineEncodedPayload

- **描述**: 将 `messageList` 序列化后的二进制载荷模型。
- **关键字段**:
  - `binary`: 编码结果
  - `itemCount`: 子消息条数
  - `orderedMessageIds`: 编码前顺序 ID 列表（用于一致性校验）
  - `checksum`: 完整性校验值
- **约束**:
  - 编码必须覆盖全部输入消息，且顺序一致
  - 任何编码失败均视为发送失败

## 4) CombineAttachmentResource

- **描述**: 编码载荷上传成功后返回的资源信息。
- **关键字段**:
  - `url`: 下载地址
  - `secret`: 访问密钥
  - `filename`: 文件名（默认 `combine`）
  - `fileLength`: 资源大小
- **约束**:
  - 上传失败不得进入最终发送阶段
  - `url/fileLength` 缺失视为无效资源

## 5) CombineMessageEvent

- **描述**: SDK 对外回调的合并消息元信息对象。
- **关键字段**:
  - `id`, `from`, `to`, `chatType`, `time`
  - `type`: 固定 `combine`
  - `title`, `summary`, `compatibleText`
  - `url`, `secret`, `filename`, `fileLength`
  - `combineLevel`
- **约束**:
  - 接收阶段默认仅回调该元信息对象
  - 非 `combine` 消息不得触发 `onCombineMessage`

## 6) CombineMessageDetailResult

- **描述**: 按需下载并解码合并消息详情的返回对象。
- **关键字段**:
  - `parentMessageId`: 对应合并消息 ID
  - `items`: 解码后的子消息列表
  - `itemCount`: 子消息数
- **校验规则**:
  - 详情解码阶段同样执行 `itemCount <= 300`
  - 任一子消息解析失败即整体失败，不返回部分 `items`

## 关系说明

- `CombineMessageDraft` --(编码)--> `CombineEncodedPayload`
- `CombineEncodedPayload` --(上传)--> `CombineAttachmentResource`
- `CombineAttachmentResource` + `CombineNestedConstraint` --(发送)--> `CombineMessageEvent`
- `CombineMessageEvent` --(按需下载解码)--> `CombineMessageDetailResult`

## 状态流转

### 发送状态

- `draft` -> `encoding` -> `uploading` -> `sending` -> `sent`
- `draft` -> `failed_validation`
- `encoding|uploading|sending` -> `failed`

### 详情解码状态

- `idle` -> `downloading` -> `decoding` -> `resolved`
- `downloading|decoding` -> `failed`
