# 020 数据模型（Phase 1）

## 1) StreamMessageChunk

- **描述**: 协议解码后的单个流式分片对象。
- **关键字段**:
  - `msgId`: 流缓存键
  - `seq`: 分片顺序号
  - `status`: 分片状态（`STREAM_START | STREAM_IN_PROGRESS | STREAM_COMPLETED | STREAM_FULL | STREAM_ERROR`）
  - `deltaText`: 当前分片增量文本
  - `fullTextCandidate`: 当前分片携带的全文候选（仅兜底末片或特定状态可用）
  - `errorCode`: 服务端错误码（如 512）
  - `arrivedAt`: 到达时间戳
- **校验规则**:
  - `msgId` 必填
  - `seq` 必须是非负整数
  - 重复 `seq` 分片需去重丢弃

## 2) StreamAssembleSession

- **描述**: 单条流的内存装配会话，按 `msgId` 唯一索引。
- **关键字段**:
  - `msgId`: 会话唯一键
  - `chunksBySeq`: 已缓存分片索引
  - `lastDispatchedSeq`: 已回调最大序号
  - `fullText`: 已回调累计全文
  - `completed`: 是否已完成
  - `completedReason`: `normal | fallback_full | timeout_error`
- **约束**:
  - 仅在流未完成时接收新分片
  - 完成后必须清理并禁止二次完成

## 3) StreamDispatchEvent

- **描述**: SDK 对外 `onStreamMessage` 回调事件。
- **关键字段**:
  - `id`: 对应 `msgId`
  - `type`: 固定文本消息语义（流式片段）
  - `stream.seq`: 当前分片序号（若协议约束不对外可按约定省略）
  - `stream.status`: 当前分片状态
  - `stream.errorType`: 错误类型（超时等）
  - `stream.deltaText`: 本片增量文本
  - `stream.fullText`: 当前累计全文
  - `time`: 消息时间戳
- **约束**:
  - 单流内按序回调
  - 每个分片最多回调一次

## 4) StreamErrorEvent

- **描述**: 流式失败终态事件（属于 `StreamDispatchEvent` 的错误分支）。
- **关键字段**:
  - `status`: `STREAM_ERROR`
  - `errorCode`: 来自服务端错误分片（如 512）
  - `final`: 固定 `true`
- **约束**:
  - 同一流超时失败只允许回调一次
  - 回调后立即清理会话

## 关系说明

- `StreamMessageChunk` --(按 msgId 聚合)--> `StreamAssembleSession`
- `StreamAssembleSession` --(顺序分发)--> `StreamDispatchEvent`
- `StreamAssembleSession` --(服务端超时错误)--> `StreamErrorEvent`

## 状态流转

### 流会话状态

- `idle` -> `assembling`
- `assembling` -> `completed_normal`（缺片补齐后完成）
- `assembling` -> `completed_fallback`（兜底末片完成）
- `assembling` -> `completed_error`（服务端超时错误分片）

### 分片分发状态

- `pending` -> `dispatched`（连续可达）
- `pending` -> `dropped_duplicate`（重复 seq）
- `pending` -> `ignored_after_complete`（流已完成后到达）
