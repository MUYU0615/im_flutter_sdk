# 020 快速验证指南（Phase 1）

## 目标

验证流式消息接收链路满足：单流有序回调、缺片补齐、兜底末片完成、服务端超时错误结束、单片 `STREAM_FULL` 语义。

## 前置准备

1. 安装依赖：

```bash
npm install
```

2. 准备可注入下行消息的测试环境（单聊/群聊各一组）。

3. 确认已有普通消息回归基线。

## 验证步骤

### 步骤 1：基础回归

```bash
npm run test:run
npm run lint
```

期望：普通非流式消息链路全部通过。

### 步骤 2：单流顺序回调

- 注入同一 `msgId` 的多分片流，故意打乱到达顺序（如 `seq=0,2,1,3`）。
- 观察 `onStreamMessage` 回调顺序。

期望：回调顺序严格为 `0,1,2,3`，每片仅一次。

### 步骤 3：缺片等待与补齐回放

- 注入 `seq=0,2`，暂不注入 `seq=1`。
- 验证 SDK 只回调可连续部分。
- 再注入 `seq=1`。

期望：补齐后立即按序回放此前缓存的连续分片。

### 步骤 4：兜底末片完成

- 注入存在缺片的流（如缺 `seq=2`）。
- 最后注入带完整文本的兜底末片。

期望：SDK 回调兜底完成事件并结束该流，后续历史缺片被忽略。

### 步骤 5：超时错误（服务端分片）

- 构造单片或多片流超时场景，由服务端下发超时错误分片（如 512）。

期望：SDK 回调一次错误态并清理该流缓存，不依赖本地超时计时器。

### 步骤 6：单片 STREAM_FULL

- 注入仅一片流式消息，状态为 `STREAM_FULL`。

期望：仅一次回调，状态为 `STREAM_FULL`，文本语义包含 `fullText + deltaText`。

### 步骤 7：并行多流

- 同时注入多个不同 `msgId` 的流。

期望：每条流内部保持有序；跨流按到达顺序回调且互不串流。

## 验收清单（对应 spec）

- 单流顺序回调正确率：100%
- 缺片补齐回放正确率：100%
- 兜底末片完成正确率：100%
- 超时错误回调次数：每流 1 次
- 单片 `STREAM_FULL` 场景通过率：100%
- 非流式消息回归通过率：100%

## 常见失败定位

- 顺序错误：检查分片去重与 `lastDispatchedSeq` 推进逻辑。
- 补齐不触发：检查缺片判定区间与缓存连续扫描逻辑。
- 超时重复回调：检查错误态完成后会话清理与重复分片丢弃逻辑。
- 跨流串扰：检查缓存键是否严格使用 `msgId`。

## 本次实现验证记录（2026-02-25）

- 已执行测试命令：
  - `npm run test:run -- tests/unit/protocol/stream-chunk-decode.test.ts tests/unit/protocol/stream-error-decode.test.ts tests/unit/core/message/stream-message-cache.test.ts tests/unit/core/message/stream-message-ordering.test.ts tests/unit/core/message/stream-message-gap-recovery.test.ts tests/unit/core/message/stream-message-dedup.test.ts tests/unit/core/message/stream-message-fallback-full.test.ts tests/unit/core/message/stream-message-timeout-error.test.ts tests/unit/core/message/stream-message-cleanup.test.ts tests/unit/core/message/stream-message-single-full.test.ts tests/unit/core/message/message-receiver-stream-regression.test.ts tests/unit/core/message/message-receiver.test.ts tests/unit/core/message/combine-message-receiver.test.ts tests/unit/chat-client/send-stream-unsupported.test.ts tests/types/stream-event-types.test.ts tests/contract/stream-message-event.contract.test.ts tests/contract/stream-send-unsupported.contract.test.ts`
  - 结果：17 个测试文件、26 条测试全部通过。
- 已执行静态检查命令：
  - `npx eslint src/types/index.ts src/types/event-system.ts src/protocol/msync/types.ts src/protocol/msync/codec.ts src/core/message/message-receiver.ts src/core/message/message-sender.ts src/core/message/stream-message-cache.ts src/core/message/stream-message-handler.ts src/chat-client.ts tests/unit/protocol/stream-chunk-decode.test.ts tests/unit/protocol/stream-error-decode.test.ts tests/unit/core/message/stream-message-cache.test.ts tests/unit/core/message/stream-message-ordering.test.ts tests/unit/core/message/stream-message-gap-recovery.test.ts tests/unit/core/message/stream-message-dedup.test.ts tests/unit/core/message/stream-message-fallback-full.test.ts tests/unit/core/message/stream-message-timeout-error.test.ts tests/unit/core/message/stream-message-cleanup.test.ts tests/unit/core/message/stream-message-single-full.test.ts tests/unit/core/message/message-receiver-stream-regression.test.ts tests/unit/chat-client/send-stream-unsupported.test.ts tests/types/stream-event-types.test.ts tests/contract/stream-message-event.contract.test.ts tests/contract/stream-send-unsupported.contract.test.ts tests/test-utils/stream/build-stream-chunk.ts`
  - 结果：通过（0 error, 0 warning）。
- 已知风险：
  - `completedIds` 当前为内存去重窗口（上限 2048），用于防止完成流重复回调；若服务端重复使用 `msgId`，可能被误判为已完成流。
