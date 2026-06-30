# Quickstart：验证重连逻辑

> 目的：提供最小可执行的验证路径，确保每个用户场景可独立验收。

## 环境准备

- 使用现有 demo 或测试页面初始化 SDK
- 确保可观察连接状态事件（onConnecting/onConnected/onDisconnected/onReconnectFailed）
- 除“登录阶段失败”场景外，其余场景需先登录成功

## 场景 1：离线/在线切换（US1）

1. 连接成功后，手动断网触发 offline
2. 验证 SDK 主动关闭连接并进入断开状态
3. 恢复网络触发 online
4. 期望：触发 onConnecting → onConnected 或 onReconnectFailed 事件

## 场景 2：前台恢复心跳检查（US2）

1. 连接成功后将页面切到后台并保持一段时间
2. 切回前台触发心跳检查
3. 若心跳失败，期望触发 onConnecting → onConnected/onReconnectFailed
4. 若心跳成功，连接保持且不触发重连

## 场景 3：登录阶段失败（US3）

1. 在登录阶段模拟连接错误或 close
2. 验证自动重连达到最大次数
3. 期望 `login()` 抛出失败并停止所有自动重连（不触发 onReconnectFailed）

## 场景 4：发送超时（US4）

1. 模拟消息发送超时
2. 期望触发 onConnecting 事件并进入重连流程

## 场景 5：登录后达到上限后在线恢复（US5）

1. 登录成功后断网触发重连直到达到最大次数
2. 验证进入 onReconnectFailed 状态并停止自动重连
3. 恢复网络触发 online
4. 期望重新开始重连并触发 onConnecting 事件
