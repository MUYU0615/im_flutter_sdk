# 功能规格：附件消息 data 内部缓存化

**Feature Branch**: `008-attachment-data-cache`  
**Created**: 2026-01-27  
**Status**: Draft  
**Input**: 用户需求：“附件消息体不应暴露 data 字段，data 仅用于发送阶段上传，内部缓存即可。”  
**Reference**:
- `specs/003-message-create/spec.md`
- `specs/007-file-upload/spec.md`

> 目标：对外 MessageBody 不再包含 `data`，发送阶段所需文件改为内部缓存，保持接收/发送消息结构一致。

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 发送附件消息时不暴露 data (Priority: P1)

开发者发送附件消息时，消息体中不再包含 `data` 字段，但上传仍能正常进行。

**Independent Test**: 构造带 `data` 的附件消息，返回的 MessageBody 不包含 `data`；发送时可成功上传并发送。

**Acceptance Scenarios**:
1. **Given** createImageMessage 传入 `data`，**When** 返回 Message，**Then** `body` 中不包含 `data` 字段。
2. **Given** sendMessage 发送附件消息，**When** 上传完成，**Then** 消息正常发送且 body 不含 `data`。
3. **Given** 接收消息，**When** 业务读取 body，**Then** 不存在 `data`，结构与发送端一致。

---

### 用户故事 2 - 本地 URL 无缓存时应失败 (Priority: P1)

若附件消息的 `url` 为本地地址（如 `blob:`/`data:`/`file:`/`wxfile:`），但缓存中找不到 file，则发送应失败并给出明确错误。

**Independent Test**: 使用 `blob:` url 但不提供 data，发送时应抛出 UploadError。

**Acceptance Scenarios**:
1. **Given** 本地 url 且缓存缺失，**When** sendMessage 调用，**Then** 抛出 `UPLOAD_REQUIRED_FIELD_MISSING`。
2. **Given** 远程 url 且缓存缺失，**When** sendMessage 调用，**Then** 跳过上传直接发送。

---

### 用户故事 3 - 发送后缓存策略与重试 (Priority: P2)

发送成功后清理缓存；发送失败时保留缓存用于重试（同一 msgLocalId），避免“失败后不可重试”。

**Independent Test**: 发送成功后缓存释放；发送失败后再次发送仍可从缓存拿到文件。

**Acceptance Scenarios**:
1. **Given** 上传成功，**When** sendMessage resolve，**Then** 缓存中不再存在该 msgLocalId。
2. **Given** 上传失败，**When** sendMessage reject，**Then** 缓存仍存在该 msgLocalId 以便重试。
3. **Given** 重试同一 msgLocalId，**When** sendMessage 调用，**Then** 可复用缓存并继续上传。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MessageBody 类型对外不包含 `data` 字段（Image/File/Voice/Video）。
- **FR-002**: CreateMessage 入参仍允许 `data`，并在创建时写入内部缓存。
- **FR-003**: 发送附件消息时从缓存获取 File/CompatibleFile 进行上传。
- **FR-004**: 本地 url（blob/data/file/wxfile/appfile）必须有缓存文件，否则发送失败。
- **FR-005**: 远程 url 且无缓存时，跳过上传直接发送。
- **FR-006**: 上传成功后清理缓存；上传失败时保留缓存用于重试；ChatClient/Core 销毁时清理剩余缓存。
- **FR-007**: msgLocalId 作为缓存键；若外部传入重复 msgLocalId，新的 data 覆盖旧缓存（以最新选择为准）。

### 设计与模块建议

- 新增 `AttachmentFileStore`（内部模块）：
  - `set(msgLocalId, file)`
  - `get(msgLocalId)`
  - `consume(msgLocalId)`（读取并删除）
  - `clear()`（登出/销毁时清理）
- `createMessage`：先生成/确定 msgLocalId，再将 `data` 存入缓存并从返回的 message.body 中移除。
- `AttachmentUploader`：从 `AttachmentFileStore` 获取 file，失败时抛出 UploadError。

### 错误处理

- 缓存缺失时抛出 `UploadError`，错误码为 `UPLOAD_REQUIRED_FIELD_MISSING`，`details` 包含 `msgLocalId` 与 `url`。
- 其它错误均返回 005/007 规范的错误码结构（SDKError + code/details）。

## Out of Scope

- 不新增对外 API（如 `uploadFile` 独立调用）。
- 不调整附件上传协议与 REST 接口。
- 不修改已有文档；此变更仅记录在新 spec 中。

## Edge Cases

- 创建消息后从未发送（缓存释放策略）。
- 多次 send 同一 msgLocalId（失败可重试，成功后清理）。
- 发送被取消或超时（保留缓存用于重试，直到成功或登出/销毁）。

## Success Criteria *(mandatory)*

- **SC-001**: 对外 MessageBody 不再出现 `data` 字段。
- **SC-002**: 附件消息发送仍可正常上传与发送。
- **SC-003**: 本地 url 无缓存时明确失败，远程 url 无缓存时可发送。
