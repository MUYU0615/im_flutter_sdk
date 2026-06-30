# 微信小程序 Demo

## 目标

为仓库新增一个与 [`demo/`](/Users/zhangdong/code/websdk2/demo) 平级的原生微信小程序 demo，用于验证以下主路径：

- 初始化 SDK
- 登录 / 登出
- 发送 8 类基础消息

本 demo 不扩展联系人、群组、聊天室等高级联调面板。

## 关键实现点

### 1. SDK 连接链路改造

为适配微信小程序运行时，这次把核心连接发送链路从浏览器原生 `WebSocket` 收口到了平台 socket 抽象：

- `src/core/connection/connection-manager.ts`
- `src/core/connection/heartbeat.ts`
- `src/core/message/message-sender.ts`
- `src/core/index.ts`

SDK 会在小程序运行时自动装配内置 socket 实现，demo 不再需要通过初始化参数注入平台适配器。

### 2. 小程序平台适配器

SDK 内置小程序平台适配器会桥接以下能力：

- `RequestAdapter`: `wx.request`
- `SocketAdapter`: `wx.connectSocket`
- `UploadAdapter`: `wx.uploadFile`
- `RuntimeAdapter`: `onNetworkStatusChange` / `onAppShow` / `onAppHide`
- `StorageAdapter`: `getStorageSync` / `setStorageSync` / `removeStorageSync`
- `ImageProcessor`: `getImageInfo` / `compressImage` / `FileSystemManager.readFile`

## 导入策略

当前默认使用构建产物：

- 小程序 demo 从 `../../dist/index.js` 加载 SDK
- 避免在微信开发者工具里直接消费 `src/` 源码造成额外兼容问题

因此在联调前需要先执行：

```bash
npm run build
```

## 页面能力

首页分为四块：

1. 初始化
2. 登录 / 登出
3. 消息发送
4. 运行日志

消息发送覆盖：

- `text`
- `image`
- `voice`
- `video`
- `file`
- `location`
- `cmd`
- `custom`

## 初始化策略

为了降低联调复杂度，页面不暴露 DNS 相关输入：

- 通过 `serviceConfig.serverUrls` 固定使用 `restApiUrl` / `wsUrl`
- 小程序 demo 显式使用 `enableSyncData = []`，不触发登录后自动同步。
- 平台适配器与缓存加密模式使用 SDK 内部默认行为，不在页面表单暴露

## 自动化验证

当前已补齐：

```bash
npm run test:run -- tests/unit/miniapp-demo tests/integration/miniapp-demo tests/unit/core/connection/connection-manager.test.ts tests/unit/core/connection/heartbeat.test.ts tests/unit/core/message/message-sender.test.ts tests/unit/core/message/combine-message-sender.test.ts
npm run type-check
```

## 手工验证建议

1. 执行 `npm run build`
2. 用微信开发者工具导入 `miniprogram-demo/`
3. 依次验证初始化、登录、登出
4. 逐个验证 8 类消息发送
5. 检查日志面板是否能反映成功与失败结果
