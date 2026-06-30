---
id: integration
name: websdk2-integration
title: websdk2 Integration Guide
description: Use when integrating im-sdk-web in an application project.
cursorGlobs: **/*.{ts,tsx,js,jsx}
referenceIds:
  - generated/integration-index
  - generated/api-reference-index
  - manager-capabilities
  - real-env-credentials
---
# websdk2 Integration Guide

Use when integrating `im-sdk-web` in an application project.

## 最小可运行示例

```typescript
import { ChatClient } from 'im-sdk-web';

// 1. 初始化
const client = ChatClient.init({ appKey: 'your-org#your-app' });

// 2. 注册事件
client.addEventHandler('main', {
  onConnected: () => console.log('已连接'),
  onDisconnected: () => console.log('已断开'),
  onMessage: messages => console.log('收到消息', messages),
});

// 3. 登录（使用 token）
await client.login({ userId: 'user1', token: 'your-token' });

// 4. 发送文本消息
const msg = client.createTextMessage({
  targetId: 'user2',
  channelType: 'singleChat',
  content: 'Hello!',
});
await client.send(msg);

// 5. 登出
await client.logout();
```

## 关键参数说明

| 参数 | 说明 | 常见错误 |
|------|------|----------|
| appKey | 格式为 `orgName#appName`，从环信控制台获取 | 用了 REST API 的 orgName/appName 路径格式 |
| userId | 用户 ID，区分大小写 | 传了 UUID 而不是 username |
| token | 用户 token，有有效期 | 用了过期 token 或把 password 当 token |
| channelType | `singleChat` / `groupChat` / `chatRoom` | 群聊用了 singleChat |
| targetId | 单聊为对方 userId，群聊为 groupId | 群聊传了用户 ID |

## 初始化配置项

```typescript
ChatClient.init({
  appKey: 'your-org#your-app',
  // 可选：是否使用 HTTP DNS 自动解析服务地址（默认 false，使用固定地址）
  useHttpDns: true,
  // 可选：固定 REST 地址（useHttpDns=false 时生效）
  restApiUrl: 'https://a1.easemob.com',
  // 可选：固定 WebSocket 地址
  wsUrl: 'wss://im-api-wechat.easemob.com/websocket',
});
```

## 事件监听模式

```typescript
// 注册（适合 React useEffect）
client.addEventHandler('handlerId', {
  onConnected: () => {},
  onDisconnected: () => {},
  onMessage: msgs => {},
  onError: err => {},
});

// 清理
client.removeEventHandler('handlerId');
```

## Manager 使用模式

```typescript
// 使用 ChatManager 标记会话已读
const chatManager = client.use(ChatManager);
await chatManager.markConversationRead({ targetId: 'user2', channelType: 'singleChat' });

// 使用 ContactManager
const contactManager = client.use(ContactManager);
const contacts = await contactManager.getContacts();
```

## 检查清单

在提问或排查前，先确认：

1. `appKey` 格式正确（含 `#`）
2. 登录使用 `userId + token`，不是 password
3. 发送前 `connectionState` 已经是 `connected`
4. `channelType` 和 `targetId` 匹配（单聊/群聊/聊天室）
5. token 未过期（环信 token 有有效期，过期需重新获取）

## 首次接入建议

1. 先跑最小单聊链路：初始化、登录、文本发送、登出
2. 再补事件监听和消息展示
3. 再接 manager 能力，例如会话已读、联系人、群组
4. 最后再接真实环境 E2E 与 CI

## 详细知识库使用规则

- 需要具体功能接入步骤时，优先打开 `websdk2 Integration Documentation Index`，再读取对应主题文档
- 需要精确 API 签名、参数、返回值、错误码时，优先打开 `websdk2 API Reference Index`，再读取对应 API 分段
- 不确定公开入口时，先查 API Reference，不要凭旧 SDK 记忆补 API 名

## 回答风格要求

- 先给最小可运行示例
- 再解释关键参数
- 不输出明文 token
- 如果问题涉及当前仓库外的业务项目，优先给集成建议，不要引用仓库内部私有路径
