# 功能规格：附件上传与消息发送

**Feature Branch**: `007-file-upload`  
**Created**: 2026-01-23  
**Status**: Draft  
**Input**: 用户需求："发送附件消息前需上传文件，支持简单/分片上传，文件 > 5MB 用分片。"  
**Reference**:
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/mSync.ts`（upLoadFile）
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/utils/index.ts`（uploadFile）
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/uploadFile/index.ts`（分片上传）

> 本 spec 聚焦附件上传与附件消息发送链路，复用现有消息结构与错误码规范。

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 发送附件消息时自动上传 (Priority: P1)

开发者发送 image/video/voice/file 消息时，SDK 应先上传附件并将返回的 URL/secret 写入消息体，再进行消息发送。

**Independent Test**: 构造带 `file` 的图片消息，触发上传，等待上传成功并发送；断言发送 payload 中包含 url/secret。

**Acceptance Scenarios**:
1. **Given** message.body.url 为空, **When** sendMessage 调用, **Then** 自动上传并在成功后发送消息。
2. **Given** 上传成功返回 url/secret, **When** 发送消息, **Then** 消息体包含 url/secret/fileLength 等字段。
3. **Given** 上传失败, **When** 错误抛出, **Then** Promise reject 并包含错误码与 details。

---

### 用户故事 2 - 大文件分片上传 (Priority: P1)

当附件大于 5MB 时，SDK 应自动切换为分片上传；若分片初始化失败则降级为简单上传。

**Independent Test**: 模拟 6MB 文件触发分片上传；模拟初始化失败时回退到简单上传。

**Acceptance Scenarios**:
1. **Given** 文件大小 > 5MB, **When** 上传启动, **Then** 使用分片上传流程。
2. **Given** 分片 init 失败, **When** 回退策略执行, **Then** 进入简单上传并继续流程。
3. **Given** 分片上传完成, **When** merge 完成, **Then** 返回与简单上传一致的结果结构。

---

### 用户故事 3 - 已有 URL 跳过上传 (Priority: P1)

当消息体已包含 `url` 且为远程可访问地址（用户自行上传）时，SDK 不再上传，直接发送消息。

**Independent Test**: 构造 body.url 已填充的 file 消息并发送，断言不会触发上传逻辑。

**Acceptance Scenarios**:
1. **Given** message.body.url 已存在且为远程 URL, **When** sendMessage 调用, **Then** 跳过上传直接发送。
2. **Given** message.body.url 是本地 URL 或 data 存在, **When** sendMessage 调用, **Then** 仍需上传。
3. **Given** 自带远程 url 的附件消息, **When** 发送成功, **Then** 不修改原始 url/secret 字段。

---

### 用户故事 4 - 上传过程事件与错误 (Priority: P2)

SDK 应提供上传过程进度与错误回调，便于 UI 展示。

**Independent Test**: 监听上传进度事件，断言进度回调被触发；模拟上传失败触发错误回调。

**Acceptance Scenarios**:
1. **Given** 上传进行中, **When** 产生进度事件, **Then** 触发 onFileUploadProgress 回调。
2. **Given** 上传失败, **When** error 발생, **Then** 回调 onFileUploadError 并 reject。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 支持 `image/video/voice/file` 消息上传（附件消息）。
- **FR-002**: 若消息体已包含远程 `url` 且 `data` 不存在，则跳过上传直接发送。
- **FR-002-1**: 若 `data` 存在或 `url` 为本地地址（如 `blob:`/`data:`/`file:`/`wxfile:` 等），仍需上传。
- **FR-003**: 当文件大小 > 5MB 时使用分片上传；≤ 5MB 使用简单上传。
- **FR-004**: 分片上传流程必须包含 `init -> upload parts -> complete`，并可根据服务端返回的分片大小调整。
- **FR-005**: 分片 init 失败时，必须自动降级到简单上传。
- **FR-006**: 上传成功后需要将 `url/secret/fileLength/filetype/size` 等写入消息体，再发送。
- **FR-007**: 上传失败必须抛出 SDKError（数字错误码 + details），并终止消息发送。
- **FR-008**: 上传接口使用 REST，超时使用 `UPLOAD_TIMEOUT`。
- **FR-009**: 上传逻辑需独立模块化，避免与 mSync 发送逻辑混在同一文件。
- **FR-010**: 上传回调通过 `sendMessage(message, options)` 传入，不使用 EventHub。

### 错误码建议（暂定）

> 码段遵循 005 错误规范，先行占位，后续以实现为准。

- **上传类** (7000-7999)
  - `7001` UPLOAD_REQUIRED_FIELD_MISSING（缺少文件/size）
  - `7002` UPLOAD_INVALID_APPKEY（appKey 非法）
  - `7003` UPLOAD_SIZE_EXCEEDED（超过最大限制）
  - `7004` UPLOAD_REQUEST_FAILED（请求失败）
  - `7005` UPLOAD_TIMEOUT（超时）
  - `7006` UPLOAD_ABORTED（取消/中断）

### 数据字段补全（消息体 & 类型）

上传成功后需填充以下字段（与现有消息结构对齐）：

- `url`: 附件下载地址
- `secret`: 分享密钥
- `fileLength`: 文件大小（字节）
- `filetype`: MIME 类型
- `filename`: 文件名
- `size`: 图片/视频尺寸（如有）
- `thumbnailUrl`: 图片/视频缩略图（如服务端支持）

> 以上字段需同步到 MessageBody 类型定义与校验规则，避免类型丢失。

### 超时配置

- 复用 `UPLOAD_TIMEOUT = 1000 * 60 * 5`

## Out of Scope

- 文件秒传与哈希去重
- 断点续传与暂停/恢复
- CDN 域名切换策略
- 附件加密/解密

## Edge Cases

- message.body.data 缺失或 size 为 0
- 自定义上传 URL 的特殊场景（chatroom/group share file）
- 分片上传部分失败的重试策略
- 上传完成但发送失败的补偿策略

## Success Criteria *(mandatory)*

- **SC-001**: 附件消息发送前可自动上传并正确填充消息体。
- **SC-002**: 大文件触发分片上传，小文件走简单上传，init 失败可降级。
- **SC-003**: 已提供远程 url 的消息可直接发送，本地 url 仍会触发上传。
