# 数据模型：实时连接重连逻辑

> 说明：以下为逻辑实体与状态模型，不涉及实现细节。

## 实体 1：连接会话（ConnectionSession）

- **作用**: 表示当前 WebSocket 连接的生命周期与状态。
- **关键字段**:
  - sessionId：会话标识
  - status：连接状态（disconnected / connecting / connected / reconnecting / reconnectFailed）
  - lastConnectedAt：最近成功连接时间
  - lastDisconnectedAt：最近断开时间
  - errorReason：最近失败原因

## 实体 2：重连任务（ReconnectJob）

- **作用**: 描述一次重连流程的执行与锁定状态。
- **关键字段**:
  - jobId：重连任务标识
  - inProgress：是否正在执行
  - attempt：当前重连次数
  - maxAttempts：最大重连次数
  - lastAttemptAt：最近重连尝试时间
  - stopReason：停止原因（达到上限 / 登录失败 / 手动停止）

## 实体 3：重试策略（RetryPolicy）

- **作用**: 管理最大次数与重试节奏。
- **关键字段**:
  - maxAttempts：最大重试次数
  - backoffMs：重试间隔策略
  - resetOnSuccess：成功是否重置计数

## 实体 4：健康检查结果（HeartbeatCheck）

- **作用**: 记录前台恢复或心跳探测结果。
- **关键字段**:
  - checkId：检查标识
  - trigger：触发来源（foreground / interval）
  - success：是否成功
  - elapsedMs：耗时

## 实体 5：登录状态（LoginPhase）

- **作用**: 标识当前是否处于登录阶段。
- **关键字段**:
  - phase：状态（logging_in / logged_in / logged_out）
  - failedAt：登录失败时间

## 实体 6：连接事件（ConnectionEvent）

- **作用**: 面向 UI 的连接状态通知。
- **关键字段**:
  - type：事件类型（onConnecting / onConnected / onDisconnected / onReconnectFailed）
  - reason：触发原因
  - attempt：当前重连次数
  - maxAttempts：最大重连次数
  - isOnline：网络状态
  - timestamp：事件时间
