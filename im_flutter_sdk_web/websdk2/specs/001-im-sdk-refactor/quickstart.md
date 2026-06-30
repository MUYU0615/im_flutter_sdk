# 快速开始指南

**创建日期**: 2025-01-27  
**功能**: IM SDK Web 重构

## 安装

```bash
npm install @im/sdk
# 或
yarn add @im/sdk
# 或
pnpm add @im/sdk
```

## 基本使用

### 1. 初始化 SDK

```typescript
import { IMSDK, MessageType } from '@im/sdk'

const sdk = new IMSDK({
  serverUrl: 'wss://im.example.com',
  userId: 'your_user_id',
  token: 'your_auth_token',
  options: {
    autoReconnect: true,
    logLevel: 'info'
  }
})
```

### 2. 建立连接

```typescript
// 监听连接状态
sdk.on('connection', (status) => {
  console.log('连接状态:', status)
  if (status === 'connected') {
    console.log('连接成功！')
  }
})

// 连接服务器
try {
  await sdk.connect()
} catch (error) {
  console.error('连接失败:', error)
}
```

### 3. 发送消息

```typescript
// 发送单聊消息
const message = await sdk.sendMessage({
  receiverId: 'target_user_id',
  type: MessageType.TEXT,
  content: 'Hello, World!'
})

console.log('消息已发送:', message.id)
```

### 4. 接收消息

```typescript
// 监听新消息
sdk.on('message', (message) => {
  console.log('收到消息:', {
    from: message.senderId,
    content: message.content,
    time: new Date(message.timestamp)
  })
})
```

### 5. 断开连接

```typescript
// 断开连接
await sdk.disconnect()

// 或销毁 SDK 实例（清理所有资源）
sdk.destroy()
```

---

## 完整示例

```typescript
import { IMSDK, MessageType, ConnectionStatus } from '@im/sdk'

async function initIM() {
  // 1. 初始化
  const sdk = new IMSDK({
    serverUrl: 'wss://im.example.com',
    userId: 'user123',
    token: 'token_here'
  })

  // 2. 设置事件监听
  sdk.on('connection', (status) => {
    if (status === ConnectionStatus.CONNECTED) {
      console.log('✅ 已连接')
    } else if (status === ConnectionStatus.DISCONNECTED) {
      console.log('❌ 已断开')
    }
  })

  sdk.on('message', (message) => {
    console.log(`📨 收到来自 ${message.senderId} 的消息:`, message.content)
  })

  sdk.on('error', (error) => {
    console.error('❌ 错误:', error.message)
  })

  // 3. 连接
  try {
    await sdk.connect()
    console.log('连接成功')
  } catch (error) {
    console.error('连接失败:', error)
    return
  }

  // 4. 发送消息
  try {
    const message = await sdk.sendMessage({
      receiverId: 'user456',
      type: MessageType.TEXT,
      content: 'Hello!'
    })
    console.log('消息发送成功:', message.id)
  } catch (error) {
    console.error('消息发送失败:', error)
  }

  // 5. 获取会话列表
  try {
    const conversations = await sdk.getConversations()
    console.log('会话列表:', conversations)
  } catch (error) {
    console.error('获取会话列表失败:', error)
  }

  return sdk
}

// 使用
initIM().then((sdk) => {
  // SDK 已初始化并连接
})
```

---

## 会话管理

### 获取会话列表

```typescript
const conversations = await sdk.getConversations()
// 会话按最后消息时间倒序排列
conversations.forEach(conv => {
  console.log(`${conv.targetId}: ${conv.unreadCount} 条未读`)
})
```

### 标记会话已读

```typescript
await sdk.markConversationRead('conversation_id')
```

### 删除会话

```typescript
await sdk.deleteConversation('conversation_id')
```

---

## 群组功能

### 加入群组

```typescript
const group = await sdk.joinGroup('group_id')
console.log('已加入群组:', group.name)
```

### 发送群组消息

```typescript
const message = await sdk.sendGroupMessage('group_id', {
  type: MessageType.TEXT,
  content: '大家好！'
})
```

### 获取群组成员

```typescript
const members = await sdk.getGroupMembers('group_id')
console.log('群组成员:', members.map(m => m.name))
```

---

## 离线消息同步

```typescript
// 连接成功后自动同步离线消息
sdk.on('connection', async (status) => {
  if (status === ConnectionStatus.CONNECTED) {
    // 手动触发同步（可选，SDK 会自动同步）
    const offlineMessages = await sdk.syncOfflineMessages()
    console.log(`同步了 ${offlineMessages.length} 条离线消息`)
  }
})
```

---

## 错误处理

```typescript
import { SDKError, ErrorCode } from '@im/sdk'

try {
  await sdk.sendMessage({...})
} catch (error) {
  if (error instanceof SDKError) {
    switch (error.code) {
      case ErrorCode.CONNECTION_FAILED:
        console.error('连接失败，请检查网络')
        break
      case ErrorCode.MESSAGE_SEND_FAILED:
        console.error('消息发送失败，将自动重试')
        break
      default:
        console.error('未知错误:', error.message)
    }
  }
}
```

---

## 配置选项

### 完整配置示例

```typescript
const sdk = new IMSDK({
  serverUrl: 'wss://im.example.com',
  userId: 'user123',
  token: 'token_here',
  options: {
    // 自动重连
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectInterval: 1000, // 初始重连间隔（毫秒）

    // 消息重试
    messageRetryCount: 3,
    messageRetryInterval: 1000,

    // 存储
    storageEnabled: true,
    maxStorageSize: 100 * 1024 * 1024, // 100MB

    // 日志
    logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'

    // 心跳
    heartbeatInterval: 30000, // 30秒
    heartbeatTimeout: 10000    // 10秒
  }
})
```

---

## 自定义消息类型

```typescript
import { registerMessageHandler, MessageType } from '@im/sdk'

// 注册自定义消息类型
registerMessageHandler('order', {
  encode(message) {
    // 将消息编码为二进制
    return new TextEncoder().encode(JSON.stringify(message.customData))
  },
  decode(data) {
    // 将二进制解码为消息
    const json = new TextDecoder().decode(data)
    return {
      type: MessageType.CUSTOM,
      customType: 'order',
      customData: JSON.parse(json)
    }
  }
})

// 发送自定义消息
await sdk.sendMessage({
  receiverId: 'user456',
  type: MessageType.CUSTOM,
  content: new Uint8Array(),
  extras: {
    customType: 'order',
    orderId: '12345'
  }
})
```

---

## 最佳实践

### 1. 错误处理
始终使用 try-catch 处理异步操作，并检查错误类型。

### 2. 事件清理
在组件卸载或页面关闭时，记得移除事件监听器：

```typescript
const handler = (message) => { /* ... */ }
sdk.on('message', handler)

// 清理
sdk.off('message', handler)
```

### 3. 连接管理
在单页应用中，确保页面切换时正确管理连接状态。

### 4. 存储管理
定期清理不需要的数据，避免存储空间不足。

---

## 常见问题

### Q: 如何处理网络断开？
A: SDK 会自动重连，你可以监听 `connection` 事件获取连接状态。

### Q: 消息发送失败怎么办？
A: SDK 会自动重试，超过重试次数后会触发 `message:failed` 事件。

### Q: 如何获取历史消息？
A: 使用会话管理 API，消息会自动从 IndexedDB 加载。

### Q: 支持多标签页吗？
A: 支持，SDK 会自动协调多个标签页，避免重复连接。

---

## 下一步

- 查看 [API 文档](./contracts/api.md) 了解完整 API
- 查看 [数据模型](./data-model.md) 了解数据结构
- 查看 [技术方案](./plan.md) 了解实现细节
