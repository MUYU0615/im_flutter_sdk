# 连接事件契约（Connection Events）

> 说明：本契约描述 SDK 对外暴露的连接状态事件与载荷，不涉及实现细节。

## 事件列表

### 1. onConnecting

- **触发时机**: 进入连接/重连流程时（含登录阶段连接、online 恢复、前台心跳失败、发送超时等）
- **载荷字段**:
  - attempt：当前重连次数
  - maxAttempts：最大重连次数
  - reason：触发原因（login / reconnect / online / offline-recover / heartbeat-failed / send-timeout / close / error）
  - isLoginPhase：是否登录阶段
  - isOnline：网络是否在线
  - timestamp：事件时间

### 2. onConnected

- **触发时机**: 连接成功完成握手后（含首次登录成功与重连成功）
- **载荷字段**:
  - attempt：本次成功前的重连次数
  - reason：触发原因（login / reconnect）
  - isLoginPhase：是否登录阶段
  - timestamp：事件时间

### 3. onDisconnected

- **触发时机**: 已经连接成功过的断开场景（offline 主动关闭、服务器主动关闭、异常断开）
- **载荷字段**:
  - reason：断开原因（offline / close / error / heartbeat-timeout / timeout）
  - isLoginPhase：是否登录阶段
  - isOnline：网络是否在线
  - timestamp：事件时间

### 4. onReconnectFailed

- **触发时机**: 已登录状态下达到最大重连次数并停止自动重连
- **载荷字段**:
  - attempt：当前重连次数
  - maxAttempts：最大重连次数
  - reason：失败原因（limit）
  - isOnline：网络是否在线
  - timestamp：事件时间

## 事件一致性要求

- 事件必须包含可追踪的触发原因与时间戳。
- 登录阶段失败不触发 onDisconnected/onReconnectFailed，失败由 `login()` 抛出。
- onDisconnected 仅在“曾经连接成功过”的断开场景触发。
- onReconnectFailed 仅在已登录状态触发。
