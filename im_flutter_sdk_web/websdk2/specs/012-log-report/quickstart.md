# 快速验证：日志分级与 DNS 控制上报

> 目的：提供可重复的最小验证路径，确保日志分级与上报行为符合规格。

## 前置条件

- 已完成日志分级与上报实现
- 可模拟 DNS 接口响应（单测或本地 mock）

## 场景 1：DNS 开关开启 + 登录/退出即时上报

1. Mock DNS 接口返回 `enableReportLogs: 'true'`
2. 初始化 SDK，触发 DNS 解析
3. 登录成功后观察：触发一次即时上报
4. 等待 5 分钟，观察：触发一次定时上报
5. 执行退出流程，观察：触发一次即时上报

**期望结果**:
- DNS 成功后启动定时器
- 登录/退出触发立即上报
- 上报内容已脱敏

## 场景 2：DNS 开关关闭

1. Mock DNS 接口返回 `enableReportLogs: 'false'`
2. 初始化 SDK，触发 DNS 解析
3. 产生多条日志

**期望结果**:
- 不创建上报定时器
- 日志仅缓存，不触发上报

## 场景 3：DNS 未完成前日志缓存

1. 在 DNS 返回前输出多条日志
2. DNS 返回 `enableReportLogs: 'true'`

**期望结果**:
- 缓存日志进入上报队列
- 下次定时或即时上报时被发送

## 场景 4：API 调用最小必要日志

1. 触发 REST、WebSocket 与上传请求
2. 检查日志字段

**期望结果**:
- 仅记录 method、endpoint、status、duration、errorCode 等必要字段
- 不出现 token、password、完整 payload 等敏感信息
