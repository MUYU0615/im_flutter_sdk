# 实施方案：Protobuf 私有协议与 WebSocket 收发

**Branch**: `006-protobuf-ws` | **Date**: 2026-01-23 | **Spec**: `specs/006-protobuf-ws/spec.md`  
**Input**: 规范文档 `/specs/006-protobuf-ws/spec.md`

## 概述

对齐原工程私有协议，使用 protobuf 编码/解码与 WebSocket 收发消息。实现登录 provision 握手、消息发送/ACK/接收流程，并在重构过程中拆解 mSync 编解码逻辑，使结构更清晰、可维护。附件上传与消息去重暂不实现。

## 技术背景

- **协议定义来源**: `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/proto.ts`
- **连接流程参考**: `engineCore/connection.ts`（onopenCallback/onmessageCallback）
- **消息流程参考**: `engineCore/mSync.ts`（send/decodeMSync/distributeMSync）
- **消息解析参考**: `handleMessages/handleChatMsg.ts`
- **错误规范**: `specs/005-error-handling/spec.md`（数字错误码 + details）

## 设计要点

1. **统一超时配置**
   - 在单独配置文件中集中定义 `MESSAGE_TIMEOUT/REQUEST_TIMEOUT/UPLOAD_TIMEOUT/CONNECT_TIMEOUT/PROVISION_TIMEOUT`。
   - 连接/发送超时触发时返回对应错误码与 details。

2. **provision 登录握手**
   - WebSocket onopen 后生成 provision 并发送。
   - 设置 provision 超时，超时/失败回落到 disconnected。
   - provision 回包用于确认鉴权结果与连接建立。

3. **mSync 编解码重构**
   - 以“输入 -> 编码/解码 -> 分发 -> 事件/回调”为主流程拆分模块。
   - 编码/解码逻辑从单文件拆分到可测试的小函数。
   - 接收消息解析流程必须有关键注释，覆盖每个方法职责与核心分支。

4. **发送消息流程**
   - 仅支持文本/命令/自定义消息类型。
   - 通过 mSync send 发送 protobuf 二进制数据。
   - 收到 ACK 后 resolve 对应 Promise；失败则 reject 并带错误码。

5. **接收消息流程**
   - onmessage 回调使用 `decodeMSync -> distributeMSync` 路径。
   - 聊天消息解析后回调到 onMessage 事件。
   - NOTICE/UNREAD 触发 backqueue 拉取，并根据 nextKey/isLast 续拉。

6. **错误码占位与映射**
   - 为 provision 超时/拒绝、编码/解码失败、ACK 超时预留码段（暂定）。
   - 统一接入 005 错误规范，后续根据实现调整。

7. **正式环境联调测试**
   - 集成测试支持真实环境连接与收发消息。
   - 使用 `.env` 提供 appKey/userId/token，并将 `.env` 加入 `.gitignore`。
   - 允许可选 REST 拉取 token（需要网络权限）。

8. **压缩与 Long 解析**
   - provision 协商压缩类型与方向，启用 LZ4 压缩/解压。
   - protobuf uint64 使用 Long 解析，避免精度丢失。

9. **扩展字段协议映射（关联 017）**
   - 发送侧支持 `receiverList`（定向投递）、`deliverOnlineOnly`（仅在线）、`priority`（聊天室优先级）编码映射。
   - 接收侧支持 `direct`、`isBroadcast`、`isContentReplaced` 解码映射并透传到公开 Message。
   - ACK/内部回执消息继续仅内部处理，不进入 `onMessage` 回调。

## 实施说明

- 协议定义与字段需与原工程保持一致（proto.ts 复用）。
- protobuf 编解码不得再使用 JSON 占位实现。
- 错误处理统一使用 SDKError（数字错误码 + details）。
- 事件通知统一使用 EventHub（onMessage/onMessageStatus）。

## 测试策略

- **握手流程**：onopen 发送 provision、provision 超时与失败路径。
- **发送流程**：send -> encode -> send -> ACK resolve；异常路径 reject。
- **接收流程**：onmessage -> decode -> distribute -> onMessage。
- **扩展字段映射**：覆盖 `receiverList/deliverOnlineOnly/priority` 上行编码与 `direct/isBroadcast/isContentReplaced` 下行解析。
- **超时配置**：验证超时值来自集中配置文件。
- **联调测试**：连接正式环境并完成收发消息（需要网络权限与账号配置）。

## 风险与权衡

- **风险**: 协议字段映射与原工程不一致。
  - **应对**: 以 proto.ts 为唯一来源，必要时加入对照测试。
- **风险**: mSync 拆解导致调用链变长。
  - **应对**: 保持入口函数稳定，增加注释与测试保障。
