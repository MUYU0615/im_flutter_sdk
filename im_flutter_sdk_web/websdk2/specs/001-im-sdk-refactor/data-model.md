# 数据模型设计

**创建日期**: 2025-01-27  
**功能**: IM SDK Web 重构

## 实体关系图

```
User (用户)
  ├── 1:N ──> Message (发送的消息)
  └── 1:N ──> Channel (参与的 Channel)

Channel (Channel，统一会话和群组)
  ├── 1:1 ──> User (单聊时为对方用户)
  ├── 1:N ──> User (群组/聊天室时为成员列表)
  └── 1:N ──> Message (消息列表)

Message (消息)
  ├── N:1 ──> User (发送者)
  └── N:1 ──> ChannelReference (所属 Channel，轻量级引用)

ChannelReference (Channel 引用)
  └── N:1 ──> Channel (指向完整 Channel 对象)
```

## 核心实体

```ts
interface Sender {
  userId: string;
  nickname?: string;
  avatarUrl?: string;
}

/**
 * Channel 引用（消息中使用）
 * 轻量级引用，只包含标识信息，用于消息中标识所属 Channel
 */
interface ChannelReference {
  channelId: string;        // Channel 唯一标识符
  type: ChannelType;        // Channel 类型：'single' | 'group' | 'room'
}

/**
 * Channel 类型
 */
type ChannelType = 'single' | 'group' | 'room';

/**
 * Channel 基础属性（所有 Channel 类型共享）
 */
interface ChannelBase {
  channelId: string;         // Channel 唯一标识符
  type: ChannelType;         // Channel 类型
  
  // 会话属性（所有 Channel 类型都有）
  name?: string;             // Channel 名称
  avatar?: string;           // Channel 头像 URL
  isPinned: boolean;        // 是否置顶
  isMuted: boolean;         // 是否免打扰
  unreadCount: number;      // 未读消息数
  lastMessage?: Message;     // 最后一条消息
  lastMessageTime?: number;  // 最后消息时间戳
  draft?: string;            // 草稿内容
  updatedAt: number;         // 更新时间戳
}

/**
 * 单聊 Channel
 */
interface SingleChannel extends ChannelBase {
  type: 'single';
  channelId: string;     // 对方用户ID（必需）
  // 注意：单聊 Channel 没有群组相关属性
}

/**
 * 群组 Channel
 */
interface GroupChannel extends ChannelBase {
  type: 'group';
  channelId: string;         // 群组 ID
  // 群组属性（必需）
  memberCount: number;       // 成员数量
  members: string[];         // 成员用户ID列表
  ownerId: string;           // 群主用户ID
  admins: string[];          // 管理员用户ID列表
  myRole: ChannelRole;       // 当前用户在群组中的角色
  settings: GroupChannelSettings; // 群组设置
  description?: string;      // 群组描述
  createdAt: number;         // 创建时间戳
}

/**
 * 聊天室 Channel
 */
interface RoomChannel extends ChannelBase {
  type: 'room';
  channelId: string;         // 聊天室 ID
  // 聊天室属性（必需）
  memberCount: number;       // 成员数量
  members: string[];         // 成员用户ID列表
  ownerId: string;           // 聊天室创建者ID
  admins: string[];          // 管理员用户ID列表
  myRole: ChannelRole;       // 当前用户在聊天室中的角色
  settings: RoomChannelSettings; // 聊天室设置
  description?: string;      // 聊天室描述
  createdAt: number;         // 创建时间戳
}

/**
 * Channel 联合类型（列表和详情中使用）
 * 根据 type 字段可以精确区分不同的 Channel 类型
 */
type Channel = SingleChannel | GroupChannel | RoomChannel;

/**
 * Channel 角色（群组/聊天室）
 */
type ChannelRole = 'owner' | 'admin' | 'member';

/**
 * 群组 Channel 设置
 */
interface GroupChannelSettings {
  allowMemberInvite: boolean;     // 是否允许成员邀请
  maxMembers: number;             // 最大成员数（可选）
  needApproval: boolean;           // 加入是否需要审批
  // ... 其他群组设置
}

/**
 * 聊天室 Channel 设置
 */
interface RoomChannelSettings {
  // ... 其他聊天室设置
}

/**
 * 小程序/uniapp 本地文件对象
 */
interface MiniAppFile {
  path: string; // 本地文件路径
  size?: number; // 文件大小（可选）
  name?: string; // 文件名称（可选）
  type?: string; // 文件类型（可选）
}

/**
 * 跨端文件对象（H5 File 或小程序/uniapp 文件对象）
 */
type CompatibleFile = File | MiniAppFile;

/**
 * 消息体联合类型
 */
type MessageBody =
  | TextMessageBody
  | ImageMessageBody
  | FileMessageBody
  | VoiceMessageBody
  | VideoMessageBody
  | LocationMessageBody
  | CmdMessageBody
  | CustomMessageBody;

interface TextMessageBody {
  content: string; // 消息内容
  targetLanguages?: string[]; // 目标翻译语言列表（可选）
  translations?: Record<string, string>; // 翻译内容映射（可选）
}

interface ImageMessageBody {
  url: string; // 图片地址（服务端或本地可用地址）
  filename: string; // 文件名
  filetype: string; // 文件类型
  width: number; // 图片宽度
  height: number; // 图片高度
  isGif: boolean; // 是否为 GIF
  data?: CompatibleFile; // 本地文件对象（发送端可用）
  thumbnailUrl?: string; // 缩略图地址（可选）
}

interface FileMessageBody {
  url?: string; // 文件地址（服务端或本地可用地址）
  filename: string; // 文件名
  filetype: string; // 文件类型
  fileSize?: number; // 文件大小（可选）
  data?: CompatibleFile; // 本地文件对象（发送端可用）
}

interface VoiceMessageBody {
  url?: string; // 语音地址（服务端或本地可用地址）
  filename: string; // 文件名
  filetype: string; // 文件类型
  duration: number; // 语音时长（秒）
  data?: CompatibleFile; // 本地文件对象（发送端可用）
}

interface VideoMessageBody {
  url?: string; // 视频地址（服务端或本地可用地址）
  filename: string; // 文件名
  filetype: string; // 文件类型
  duration: number; // 视频时长（秒）
  width?: number; // 视频宽度（可选）
  height?: number; // 视频高度（可选）
  thumbnailUrl?: string; // 视频缩略图地址（可选）
  data?: CompatibleFile; // 本地文件对象（发送端可用）
}

interface LocationMessageBody {
  latitude: number; // 纬度
  longitude: number; // 经度
  address?: string; // 地址描述（可选）
  buildingName?: string; // 建筑名称（可选）
}

interface CmdMessageBody {
  action: string; // 命令动作
  params?: Record<string, string>; // 命令参数（可选）
  deliverOnlineOnly?: boolean; // 是否仅在线投递（可选）
}

interface CustomMessageBody {
  event: string; // 自定义事件名称
  params?: Record<string, string>; // 自定义参数（可选）
}
```

### 1. Message (消息)

**描述**: 表示一条即时消息，可以是单聊消息或群组消息。使用 ChannelReference 标识所属 Channel。

**属性**:
```ts
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
```

**验证规则**:
- `id` 必须唯一，不能为空
- `channel.channelId` 不能为空
- `channel.type` 必须是有效的 ChannelType（'single' | 'group' | 'room'）
- `sender.userId` 不能为空
- `timestamp` 必须为正整数
- `type` 必须是有效的消息类型枚举值

**状态转换**:
```
sending → sent → delivered → read
         ↓
       failed (可重试)
```

**存储**: IndexedDB `messages` 表，索引：`channel.channelId`, `timestamp`, `id`

---

### 2. Channel (Channel 完整对象)

**描述**: Channel 统一了会话和群组的概念。包含会话属性（头像、名称、是否置顶等）和群组属性（角色、群主等）。

**注意**: 
- 消息中使用 `ChannelReference`（轻量级引用）
- 列表和详情中使用 `Channel`（完整对象）

**属性**: 见上方 `Channel` 接口定义

**验证规则**:

**所有 Channel 类型**:
- `channelId` 必须唯一，不能为空
- `type` 必须是有效的 ChannelType（'single' | 'group' | 'room'）
- `unreadCount` 必须为非负整数
- `lastMessageTime` 如果存在，必须小于等于当前时间

**SingleChannel**:
- `targetUserId` 不能为空
- 不能包含群组相关属性（memberCount、members、ownerId 等）

**GroupChannel**:
- `memberCount` 必须等于 `members.length`
- `memberCount` 必须大于等于 1
- `ownerId` 必须在 `members` 列表中
- `admins` 中的所有ID必须在 `members` 列表中
- `myRole` 必须是有效的 ChannelRole
- `settings` 不能为空

**RoomChannel**:
- `memberCount` 必须等于 `members.length`
- `memberCount` 必须大于等于 0（聊天室可以为空）
- `ownerId` 必须在 `members` 列表中（如果成员列表不为空）
- `admins` 中的所有ID必须在 `members` 列表中
- `myRole` 必须是有效的 ChannelRole
- `settings` 不能为空

**存储**: IndexedDB `channels` 表，索引：`lastMessageTime`, `channelId`, `type`

---

### 3. Connection (连接状态)

**描述**: 表示与服务器的连接状态（内存对象，不持久化）。

**属性**:
- `status: ConnectionStatus` - 连接状态（disconnected, connecting, connected, reconnecting, error）
- `serverUrl: string` - 服务器地址
- `userId?: string` - 当前用户ID
- `token?: string` - 认证令牌
- `lastConnectedAt?: number` - 最后连接成功时间
- `reconnectAttempts: number` - 重连尝试次数
- `error?: Error` - 连接错误信息

**状态转换**:
```
disconnected → connecting → connected
                    ↓
              reconnecting → connected
                    ↓
                  error
```

**验证规则**:
- `serverUrl` 必须是有效的 WebSocket URL（ws:// 或 wss://）
- `status` 必须是有效的连接状态枚举值

---

### 4. Group (群组)

**描述**: 表示一个群组。

**属性**:
- `id: string` - 群组唯一标识符
- `name: string` - 群组名称
- `avatar?: string` - 群组头像URL
- `description?: string` - 群组描述
- `memberCount: number` - 成员数量
- `members: string[]` - 成员用户ID列表
- `ownerId: string` - 群主用户ID
- `admins: string[]` - 管理员用户ID列表
- `settings: GroupSettings` - 群组设置
- `createdAt: number` - 创建时间戳
- `updatedAt: number` - 更新时间戳

**验证规则**:
- `id` 必须唯一，不能为空
- `name` 不能为空，长度不超过 100 字符
- `memberCount` 必须等于 `members.length`
- `ownerId` 必须在 `members` 列表中
- `admins` 中的所有ID必须在 `members` 列表中

**存储**: IndexedDB `groups` 表，索引：`id`, `name`

---

### 5. User (用户)

**描述**: 表示一个用户（简化版，主要用于消息发送者/接收者信息）。

**属性**:
- `id: string` - 用户唯一标识符
- `name: string` - 用户名称
- `avatar?: string` - 用户头像URL
- `status?: UserStatus` - 用户状态（online, offline, away）

**验证规则**:
- `id` 必须唯一，不能为空
- `name` 不能为空

**存储**: IndexedDB `users` 表（缓存），索引：`id`

---

## 枚举类型

### MessageType (消息类型)

```typescript
enum MessageType {
  TEXT = 'text',           // 文本消息
  IMAGE = 'image',         // 图片消息
  FILE = 'file',           // 文件消息
  VOICE = 'voice',         // 音频消息
  VIDEO = 'video',         // 视频消息
  LOCATION = 'location',   // 位置消息
  CMD = 'cmd',             // 命令消息（透传消息）
  CUSTOM = 'custom'        // 自定义消息类型
}
```

### MessageStatus (消息状态)

```typescript
enum MessageStatus {
  SENDING = 'sending',     // 发送中
  SENT = 'sent',          // 已发送
  DELIVERED = 'delivered', // 已送达
  READ = 'read',          // 已读
  FAILED = 'failed'       // 发送失败
}
```

### ChannelType (Channel 类型)

```typescript
type ChannelType = 'single' | 'group' | 'room';

// 说明：
// - 'single': 单聊 Channel（SingleChannel）
// - 'group': 群组 Channel（GroupChannel）
// - 'room': 聊天室 Channel（RoomChannel）
```

### Channel 类型定义

```typescript
// 基础 Channel 接口
interface ChannelBase {
  channelId: string;
  type: ChannelType;
  name?: string;
  avatar?: string;
  isPinned: boolean;
  isMuted: boolean;
  unreadCount: number;
  lastMessage?: Message;
  lastMessageTime?: number;
  draft?: string;
  updatedAt: number;
}

// 单聊 Channel
interface SingleChannel extends ChannelBase {
  type: 'single';
  targetUserId: string;
}

// 群组 Channel
interface GroupChannel extends ChannelBase {
  type: 'group';
  memberCount: number;
  members: string[];
  ownerId: string;
  admins: string[];
  myRole: ChannelRole;
  settings: GroupChannelSettings;
  description?: string;
  createdAt: number;
}

// 聊天室 Channel
interface RoomChannel extends ChannelBase {
  type: 'room';
  memberCount: number;
  members: string[];
  ownerId: string;
  admins: string[];
  myRole: ChannelRole;
  settings: RoomChannelSettings;
  description?: string;
  createdAt: number;
}

// Channel 联合类型
type Channel = SingleChannel | GroupChannel | RoomChannel;
```

### ChannelRole (Channel 角色)

```typescript
type ChannelRole = 'owner' | 'admin' | 'member';

// 说明：
// - 'owner': 群主/聊天室创建者
// - 'admin': 管理员
// - 'member': 普通成员
```

### 类型守卫函数（Type Guards）

```typescript
// 类型守卫：判断是否为单聊 Channel
function isSingleChannel(channel: Channel): channel is SingleChannel {
  return channel.type === 'single';
}

// 类型守卫：判断是否为群组 Channel
function isGroupChannel(channel: Channel): channel is GroupChannel {
  return channel.type === 'group';
}

// 类型守卫：判断是否为聊天室 Channel
function isRoomChannel(channel: Channel): channel is RoomChannel {
  return channel.type === 'room';
}

// 使用示例：
function processChannel(channel: Channel) {
  if (isSingleChannel(channel)) {
    // TypeScript 知道这里是 SingleChannel
    console.log(channel.targetUserId); // ✅ 类型安全
  } else if (isGroupChannel(channel)) {
    // TypeScript 知道这里是 GroupChannel
    console.log(channel.memberCount); // ✅ 类型安全
    console.log(channel.settings);   // ✅ 类型安全
  } else if (isRoomChannel(channel)) {
    // TypeScript 知道这里是 RoomChannel
    console.log(channel.settings);   // ✅ 类型安全
  }
}
```

### ConnectionStatus (连接状态)

```typescript
enum ConnectionStatus {
  DISCONNECTED = 'disconnected', // 未连接
  CONNECTING = 'connecting',      // 连接中
  CONNECTED = 'connected',       // 已连接
  RECONNECTING = 'reconnecting', // 重连中
  ERROR = 'error'               // 错误
}
```

---

## 数据验证规则

### 消息验证
- 消息ID必须唯一，为纯数字格式
- 时间戳必须在合理范围内（不能是未来时间，不能是太久远的过去）
- 消息内容不能为空（除非是系统消息）
- 消息类型必须是支持的类型

### Channel 验证
- Channel ID 必须唯一
- 最后消息时间必须小于等于当前时间
- 未读数必须为非负整数
- Channel 类型必须有效（'single' | 'group' | 'room'）
- 群组/聊天室 Channel 的成员数量必须与成员列表长度一致

### 群组验证
- 群组名称长度限制：1-100 字符
- 成员数量必须大于等于 1
- 群主必须在成员列表中

---

## IndexedDB 数据库设计

### 数据库名称
`im_sdk_db`

### 版本管理
- 初始版本：1
- 支持版本升级和数据迁移

### 对象存储（Object Stores）

#### 1. messages
- **主键**: `id`
- **索引**:
  - `conversationId` (非唯一)
  - `timestamp` (非唯一，降序)
  - `senderId` (非唯一)
  - `status` (非唯一)
- **数据清理**: 保留最近 30 天的消息，或按会话保留最近 1000 条

#### 2. channels
- **主键**: `channelId`
- **索引**:
  - `lastMessageTime` (非唯一，降序)
  - `type` (非唯一)
  - `targetUserId` (唯一，仅单聊 Channel)
- **数据清理**: 无自动清理，由应用层控制

#### 3. groups
- **主键**: `id`
- **索引**:
  - `name` (非唯一)
- **数据清理**: 无自动清理，由应用层控制

#### 4. users
- **主键**: `id`
- **索引**: 无
- **数据清理**: LRU 策略，最多保留 1000 个用户缓存

#### 5. failed_messages (失败消息队列)
- **主键**: `id`
- **索引**:
  - `retryCount` (非唯一)
  - `timestamp` (非唯一)
- **数据清理**: 重试成功后删除，超过最大重试次数后保留 7 天

---

## 数据迁移策略

### 版本升级
- 检测数据库版本变化
- 执行迁移脚本
- 验证数据完整性

### 迁移示例
```typescript
// 从版本 1 升级到版本 2
if (oldVersion < 2) {
  // 添加新字段
  // 转换旧数据格式
  // 创建新索引
}
```

---

## 性能优化

### 查询优化
- 使用索引加速查询
- 分页加载消息（每次 50 条）
- 延迟加载会话详情

### 存储优化
- 压缩大消息内容
- 定期清理过期数据
- 限制单条消息大小（10MB）

### 内存优化
- 使用对象池复用消息对象
- 限制内存中缓存的消息数量（最多 1000 条）
- 及时释放不需要的数据引用
