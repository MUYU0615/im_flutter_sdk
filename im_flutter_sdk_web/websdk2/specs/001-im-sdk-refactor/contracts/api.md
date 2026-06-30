# API 契约文档

**创建日期**: 2025-01-27  
**功能**: IM SDK Web 重构

## SDK 主接口

### IMSDK 类

SDK 的主入口类，提供所有核心功能。

```typescript
class IMSDK {
  // 构造函数
  constructor(config: SDKConfig): IMSDK

  // 连接管理
  connect(): Promise<void>
  disconnect(): Promise<void>
  getConnectionStatus(): ConnectionStatus

  // 消息发送
  sendMessage(message: Message): Promise<Message>

  // 消息接收（通过事件）
  on(event: 'message', handler: (message: Message) => void): void
  on(event: 'connection', handler: (status: ConnectionStatus) => void): void
  on(event: 'error', handler: (error: SDKError) => void): void

  // Channel 管理（统一会话和群组）
  getChannels(): Promise<Channel[]>                    // 获取 Channel 列表
  getChannel(channelId: string): Promise<Channel | null>  // 获取 Channel 详情
  markChannelRead(channelId: string): Promise<void>    // 标记 Channel 已读
  deleteChannel(channelId: string): Promise<void>      // 删除 Channel
  
  // 群组/聊天室操作（仅当 Channel type === 'group' 或 'room' 时）
  joinChannel(channelId: string): Promise<Channel>      // 加入 Channel（群组/聊天室）
  leaveChannel(channelId: string): Promise<void>        // 离开 Channel（群组/聊天室）
  getChannelMembers(channelId: string): Promise<User[]> // 获取 Channel 成员列表（群组/聊天室）

  // 离线消息
  syncOfflineMessages(): Promise<Message[]>

  // 工具方法
  off(event: string, handler?: Function): void
  destroy(): void
}
```

---

## 配置接口

### SDKConfig

SDK 初始化配置。

```typescript
interface SDKConfig {
  // 服务器地址（必需）
  serverUrl: string

  // 用户认证信息（必需）
  userId: string
  token: string

  // 可选配置
  options?: SDKOptions
}

interface SDKOptions {
  // 自动重连配置
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  reconnectInterval?: number

  // 消息配置
  messageRetryCount?: number
  messageRetryInterval?: number

  // 存储配置
  storageEnabled?: boolean
  maxStorageSize?: number

  // 日志配置
  logLevel?: LogLevel
  logger?: Logger

  // 心跳配置
  heartbeatInterval?: number
  heartbeatTimeout?: number
}
```

---

## 消息接口

### Message

发送消息的选项。使用 ChannelReference 统一标识接收 Channel。

```typescript
interface Message {
  msgServerId: string;                    // 消息唯一标识符
  msgLocalId: string;                     // 消息唯一标识符
  sender: Sender;                // 发送者用户
  channel: ChannelReference;    // Channel 引用（轻量级，只包含 channelId 和 type）
  type: MessageType;             // 消息类型
  status: MessageStatus;          // 消息状态（sending, sent, failed, delivered, read）
  ext: Record<string, unknown>;  // 消息扩展
  timestamp: number;              // 消息时间戳（毫秒）
  body: MessageBody; 
  // 注意：不再使用 to、receiverId、groupId 等字段，统一使用 channel
}

/**
 * Channel 引用（消息中使用）
 * 轻量级引用，只包含标识信息
 */
interface ChannelReference {
  channelId: string        // Channel 唯一标识符
  type: ChannelType        // Channel 类型：'single' | 'group' | 'room'
}

/**
 * Channel 类型
 */
type ChannelType = 'single' | 'group' | 'room';

enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high'
}
```

### Message

消息对象（见 data-model.md）。

---

## 事件接口

### 事件类型

```typescript
type SDKEvent = 
  | 'message'           // 收到消息
  | 'message:sent'      // 消息发送成功
  | 'message:failed'    // 消息发送失败
  | 'connection'        // 连接状态变化
  | 'connection:connected'    // 连接成功
  | 'connection:disconnected' // 连接断开
  | 'connection:reconnecting' // 重连中
  | 'channel:updated'         // Channel 更新（统一会话和群组）
  | 'channel:created'         // Channel 创建
  | 'channel:joined'          // 加入 Channel（群组/聊天室）
  | 'channel:left'            // 离开 Channel（群组/聊天室）
  | 'conversation:updated'    // 已废弃，使用 channel:updated
  | 'conversation:created'    // 已废弃，使用 channel:created
  | 'group:joined'            // 已废弃，使用 channel:joined
  | 'group:left'              // 已废弃，使用 channel:left
  | 'group:updated'           // 已废弃，使用 channel:updated
  | 'error'              // 错误事件
```

### 事件处理器签名

```typescript
// 消息事件
type MessageHandler = (message: Message) => void

// 连接状态事件
type ConnectionHandler = (status: ConnectionStatus) => void

// 错误事件
type ErrorHandler = (error: SDKError) => void

// 会话事件
type ConversationHandler = (conversation: Conversation) => void

// 群组事件
type GroupHandler = (group: Group) => void
```

---

## 错误接口

### SDKError

SDK 错误对象。

```typescript
class SDKError extends Error {
  code: ErrorCode
  message: string
  details?: unknown

  constructor(code: ErrorCode, message: string, details?: unknown)
}

enum ErrorCode {
  // 连接错误
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_CLOSED = 'CONNECTION_CLOSED',

  // 认证错误
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',

  // 消息错误
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  MESSAGE_INVALID = 'MESSAGE_INVALID',

  // 存储错误
  STORAGE_ERROR = 'STORAGE_ERROR',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',

  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',

  // 业务错误
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  GROUP_NOT_FOUND = 'GROUP_NOT_FOUND',           // 已废弃，使用 CHANNEL_NOT_FOUND
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND', // 已废弃，使用 CHANNEL_NOT_FOUND
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}
```

---

## 数据模型接口

所有数据模型接口定义见 `data-model.md`：
- `Message` - 消息对象（使用 `ChannelReference` 标识所属 Channel）
- `ChannelReference` - Channel 引用（消息中使用，轻量级）
- `Channel` - Channel 完整对象（列表和详情中使用，统一会话和群组）
- `User` - 用户对象
- `Connection` - 连接状态对象

### Channel 相关接口

```typescript
/**
 * Channel 引用（消息中使用）
 * 轻量级引用，只包含标识信息，用于消息中标识所属 Channel
 */
interface ChannelReference {
  channelId: string        // Channel 唯一标识符
  type: ChannelType        // Channel 类型：'single' | 'group' | 'room'
}

/**
 * Channel 基础属性（所有 Channel 类型共享）
 */
interface ChannelBase {
  channelId: string
  type: ChannelType
  name?: string
  avatar?: string
  isPinned: boolean
  isMuted: boolean
  unreadCount: number
  lastMessage?: Message
  lastMessageTime?: number
  draft?: string
  updatedAt: number
}

/**
 * 单聊 Channel
 */
interface SingleChannel extends ChannelBase {
  type: 'single'
  targetUserId: string
}

/**
 * 群组 Channel
 */
interface GroupChannel extends ChannelBase {
  type: 'group'
  memberCount: number
  members: string[]
  ownerId: string
  admins: string[]
  myRole: ChannelRole
  settings: GroupChannelSettings
  description?: string
  createdAt: number
}

/**
 * 聊天室 Channel
 */
interface RoomChannel extends ChannelBase {
  type: 'room'
  memberCount: number
  members: string[]
  ownerId: string
  admins: string[]
  myRole: ChannelRole
  settings: RoomChannelSettings
  description?: string
  createdAt: number
}

/**
 * Channel 联合类型（列表和详情中使用）
 * 根据 type 字段可以精确区分不同的 Channel 类型
 */
type Channel = SingleChannel | GroupChannel | RoomChannel

type ChannelType = 'single' | 'group' | 'room'
type ChannelRole = 'owner' | 'admin' | 'member'

/**
 * 群组 Channel 设置
 */
interface GroupChannelSettings {
  allowInvite: boolean
  allowMemberInvite: boolean
  maxMembers?: number
  needApproval: boolean
  allowMemberModifyNickname: boolean
}

/**
 * 聊天室 Channel 设置
 */
interface RoomChannelSettings {
  allowInvite: boolean
  maxMembers?: number
  allowAnonymous: boolean
}

/**
 * 类型守卫函数（Type Guards）
 */
function isSingleChannel(channel: Channel): channel is SingleChannel
function isGroupChannel(channel: Channel): channel is GroupChannel
function isRoomChannel(channel: Channel): channel is RoomChannel
```

---

## 扩展接口

### 自定义消息类型

```typescript
interface CustomMessage extends Message {
  type: MessageType.CUSTOM
  customType: string
  customData: Record<string, unknown>
}

// 注册自定义消息处理器
interface MessageHandler {
  encode(message: CustomMessage): Uint8Array
  decode(data: Uint8Array): CustomMessage
}

function registerMessageHandler(
  customType: string,
  handler: MessageHandler
): void
```

### 插件接口

```typescript
interface SDKPlugin {
  name: string
  version: string

  // 插件生命周期
  install(sdk: IMSDK): void
  uninstall(sdk: IMSDK): void

  // 插件钩子
  onMessage?(message: Message): Message | null
  onBeforeSend?(message: SendMessageOptions): SendMessageOptions | null
}
```

---

## 异步操作返回类型

所有异步方法返回 `Promise<T>`，其中 `T` 是操作结果类型。

### 成功响应
- `Promise<void>` - 无返回值操作
- `Promise<Message>` - 返回消息对象
- `Promise<Conversation[]>` - 返回会话列表
- `Promise<Group>` - 返回群组对象

### 错误处理
所有 Promise 可能 reject，抛出 `SDKError` 实例。

---

## 使用示例

### 基本使用

```typescript
import { IMSDK } from '@im/sdk'

// 初始化
const sdk = new IMSDK({
  appkey: 'app key'
})

// 监听事件
sdk.on('message', (message) => {
  console.log('收到消息:', message)
})

sdk.on('connection', (status) => {
  console.log('连接状态:', status)
})

// 连接
await sdk.connect()

// 发送消息
const message = await sdk.sendMessage({
  receiverId: 'user456',
  type: MessageType.TEXT,
  content: 'Hello, World!'
})

```

---

## 版本兼容性

### 向后兼容规则
- 新增可选参数不影响现有代码
- 新增事件类型不影响现有监听器
- 数据结构扩展使用可选字段

### 破坏性变更
- MAJOR 版本变更时提供迁移指南
- 废弃的 API 保留至少一个 MAJOR 版本周期
- 提供 `@deprecated` 标记和替代方案
