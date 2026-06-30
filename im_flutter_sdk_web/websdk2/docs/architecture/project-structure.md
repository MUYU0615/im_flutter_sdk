# 项目结构与收发消息流程

本文档说明当前项目的核心目录结构，以及“发送/接收消息”涉及的方法链路和对应文件。

## 项目结构概览

### 核心入口
- `src/index.ts`：SDK 入口导出。
- `src/chat-client.ts`：对外 ChatClient API（初始化、登录、创建消息、发送消息、事件）。

### 连接与消息核心
- `src/core/index.ts`：CoreSDK 聚合连接与消息模块。
- `src/core/connection/connection-manager.ts`：WebSocket 连接管理、provision、下行分发（PROVISION/NOTICE/UNREAD/SYNC）。
- `src/core/message/message-sender.ts`：消息发送、ACK 超时、失败重试入口。
- `src/core/message/message-receiver.ts`：SYNC 解码、ACK 处理、消息分发。
- `src/core/events/event-hub.ts`：统一事件管理与分发。

### 协议编解码
- `src/protocol/msync/codec.ts`：MSync 编解码、消息体构建、NOTICE/UNREAD/BackQueue、压缩协商。
- `src/protocol/msync/proto.ts`：MSync protobuf 定义。
- `src/protocol/msync/types.ts`：MSync 常量枚举。
- `src/protocol/msync/lz4-compressor/*`：LZ4 压缩/解压实现。

### REST & DNS
- `src/rest/dns-config.ts`：DNS_CONFIG 请求与 websocket 地址解析。

### 消息创建与校验
- `src/message/create-message.ts`：createText/createCmd/createCustom 等消息构建。
- `src/validators/*`：参数校验（ChatClient、消息创建等）。
- `src/types/*`：SDK 类型定义（Message、事件、连接状态等）。

### 辅助模块
- `src/utils/*`：日志、错误、重试、ID 生成等通用工具。
- `src/config/*`：超时等常量配置。

## 发送消息流程（调用链）

1. **创建消息**
   - `client.chatManager.createTextMessage / createCmdMessage / createCustomMessage ...`
   - 文件：`src/managers/chat-manager.ts`
   - 由 ChatManager 注入 sender 后进入 `src/message/create-message.ts` 完成校验与 Message 结构构建。

2. **发送消息**
   - `ChatClient.sendMessage`
   - 文件：`src/chat-client.ts`
   - 校验登录态与 sender，转发到 `CoreSDK.sendMessage`。

3. **CoreSDK 转发**
   - `CoreSDK.sendMessage`
   - 文件：`src/core/index.ts`
   - 委托给 `MessageSender.sendMessage`。

4. **协议编码并发送**
   - `MessageSender.sendMessage` → `MessageSender.doSendMessage`
   - 文件：`src/core/message/message-sender.ts`
   - 调用 `MsyncCodec.encodeChatMessage` 组包并 `prepareOutgoing`（压缩）后，通过 WebSocket 发送。
   - 编码逻辑在 `src/protocol/msync/codec.ts`。

5. **ACK 处理**
   - 服务器回 ACK 后，在接收流程中触发 `MessageReceiver.handleAck`。
   - 文件：`src/core/message/message-receiver.ts`

## 接收消息流程（调用链）

1. **WebSocket 收包**
   - `ConnectionManager.handleWebSocketMessage`
   - 文件：`src/core/connection/connection-manager.ts`
   - 调用 `MsyncCodec.normalizeIncoming`（Buffer 规整）与 `decompressIncoming`（解压）。

2. **解码外层 MSync**
   - `MsyncCodec.decodeMsync`
   - 文件：`src/protocol/msync/codec.ts`
   - 根据 `command` 分发：
     - `PROVISION` → `handleProvisionMessage`
     - `NOTICE` → `handleNoticeMessage`
     - `UNREAD` → `handleUnreadMessage`
     - `SYNC` → `handleSyncMessage`

3. **NOTICE/UNREAD 队列拉取**
   - `handleNoticeMessage` / `handleUnreadMessage`
   - 文件：`src/core/connection/connection-manager.ts`
   - 使用 `MsyncCodec.encodeBackQueue` 发送 backqueue 拉取。

4. **SYNC 解析与消息分发**
   - `handleSyncMessage` → `MessageReceiver.handleSyncPayload`
   - 文件：`src/core/message/message-receiver.ts`
   - `MsyncCodec.decodeSync` 解析 ACK + metas（只处理 CHAT ns）。

5. **队列续拉（nextKey/isLast）**
   - `handleSyncQueueState`
   - 文件：`src/core/connection/connection-manager.ts`
   - 根据 `nextKey/isLast` 使用 `MsyncCodec.encodeLastSession` 或继续 backqueue。

6. **事件分发**
   - `EventHub.dispatch('onMessage', message)`
   - 文件：`src/core/events/event-hub.ts`
   - 对外通过 `ChatClient.addEventHandler` 订阅事件。

## 关键方法与文件速查

- `ChatClient.login` → `resolveDnsConfig` → `CoreSDK.connect`
  - `src/chat-client.ts`
  - `src/rest/dns-config.ts`
  - `src/core/index.ts`
- `ConnectionManager` WebSocket 入口与下行分发
  - `src/core/connection/connection-manager.ts`
- `MsyncCodec` 负责编解码与压缩协商
  - `src/protocol/msync/codec.ts`
- `MessageSender` 发送与 ACK 超时处理
  - `src/core/message/message-sender.ts`
- `MessageReceiver` 解码 SYNC + 分发
  - `src/core/message/message-receiver.ts`
