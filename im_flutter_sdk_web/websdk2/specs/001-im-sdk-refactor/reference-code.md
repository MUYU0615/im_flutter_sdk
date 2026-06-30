# 现有代码参考

**目的**: 记录原工程的关键实现模式，供重构时参考

**原工程路径**: `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src`

---

## 一、连接管理实现参考

### 文件位置
- **旧代码**: `engineCore/connection.ts`
- **新代码**: `src/core/connection/connection-manager.ts`

### 关键实现模式

#### 1. 连接参数配置
```typescript
// 旧代码关键配置（参考）
export type ConnectionParameters = {
  appKey?: string;
  appId?: string;
  heartBeatWait?: number; // 心跳间隔，默认 30000ms
  autoReconnectNumMax?: number; // 最大重连次数
  isHttpDNS?: boolean; // 是否开启 DNS
  // ... 其他配置
}
```

**重构要求**:
- 保持心跳间隔默认 30 秒
- 支持最大重连次数配置
- 保持连接参数的结构化设计

#### 2. WebSocket 连接建立
```typescript
// 旧代码实现模式（参考）
// 1. 先进行 provision（获取连接信息）
// 2. 建立 WebSocket 连接
// 3. 发送认证消息
// 4. 启动心跳机制
```

**重构要求**:
- 保持连接建立的流程（provision → WebSocket → auth → heartbeat）
- 保持错误处理和重连逻辑
- 使用新的架构（管理器模式）

#### 3. 心跳机制
```typescript
// 旧代码实现（参考）
// HEARTBEAT_INTERVAL = 30000ms
// 使用 ping/pong 机制
// 心跳超时处理
```

**重构要求**:
- 保持 30 秒心跳间隔
- 使用 ping/pong 机制
- 心跳超时自动重连

#### 4. 重连逻辑
```typescript
// 旧代码实现（参考）
// RECONNECT_LIMIT = 最大重连次数
// 指数退避策略
// 重连状态管理
```

**重构要求**:
- 保持指数退避策略
- 支持最大重连次数配置
- 重连状态回调

---

## 二、消息编解码实现参考

### 文件位置
- **旧代码**: `engineCore/mSync.ts`
- **新代码**: `src/core/message/message-sender.ts`, `src/core/message/message-receiver.ts`, `src/protocol/protobuf/encoder.ts`, `src/protocol/protobuf/decoder.ts`

### 关键实现模式

#### 1. Protobuf 消息类型
```typescript
// 旧代码实现（参考）
export enum MsyncMessageType {
  NORMAL = 0,
  SINGLECHAT = 1,
  GROUPCHAT = 2,
  CHATROOM = 3,
  READ_ACK = 4,
  DELIVER_ACK = 5,
  RECALL = 6,
  CHANNEL_ACK = 7,
  EDIT = 8,
}
```

**重构要求**:
- 使用联合类型而非枚举（符合新规范）
- 保持消息类型值的一致性
- 支持 Channel 概念（single/group/room）

#### 2. 消息编码（发送）
```typescript
// 旧代码实现模式（参考）
// 1. 构造 protobuf MessageBody
// 2. 设置消息类型、发送者、接收者
// 3. 序列化为二进制
// 4. 可选压缩（LZ4）
// 5. 通过 WebSocket 发送
```

**重构要求**:
- 保持 protobuf 序列化方式
- 支持消息压缩（LZ4）
- 使用 ChannelReference 代替 to/receiverId/groupId
- 保持消息扩展字段（ext）的处理

#### 3. 消息解码（接收）
```typescript
// 旧代码实现模式（参考）
// 1. 接收 WebSocket 消息
// 2. 可选解压缩（LZ4）
// 3. 反序列化 protobuf
// 4. 解析消息类型和内容
// 5. 触发消息回调
```

**重构要求**:
- 保持 protobuf 反序列化方式
- 支持消息解压缩
- 构造 Message 对象（包含 ChannelReference）
- 触发事件系统

#### 4. 消息状态管理
```typescript
// 旧代码实现（参考）
// MessageStatus: SENDING → SENT → DELIVERED → READ
// 支持 ACK 机制
// 消息超时处理（MESSAGE_TIMEOUT）
```

**重构要求**:
- 保持消息状态转换逻辑
- 支持 ACK 机制（READ_ACK, DELIVER_ACK）
- 消息超时处理

---

## 三、Protobuf 协议定义参考

### 文件位置
- **旧代码**: `proto.ts`（protobufjs 定义）
- **新代码**: `src/protocol/protobuf/messages.proto`（.proto 文件）

### 关键实现模式

#### 1. 消息体结构
```typescript
// 旧代码实现（参考）
// MessageBody 包含：
// - type: 消息类型
// - from: 发送者 JID
// - to: 接收者 JID
// - contents: 消息内容数组
// - ext: 扩展字段
// - ackMessageId: ACK 消息ID
// - msgConfig: 消息配置
```

**重构要求**:
- 保持消息体的基本结构
- 使用 ChannelReference 代替 from/to
- 保持 ext 扩展字段
- 保持 ACK 机制

#### 2. 消息内容类型
```typescript
// 旧代码实现（参考）
const ContentsType = {
  0: 'TEXT',
  1: 'IMAGE',
  2: 'VIDEO',
  3: 'LOCATION',
  4: 'VOICE',
  5: 'FILE',
  6: 'COMMAND',
  7: 'CUSTOM',
  8: 'COMBINE',
};
```

**重构要求**:
- 保持消息内容类型的一致性
- 支持文本、图片、视频、音频、文件、位置、自定义消息
- 使用新的 MessageBody 联合类型

---

## 四、消息回调处理参考

### 文件位置
- **旧代码**: `handleMessages/handleChatMsg.ts`
- **新代码**: `src/core/message/message-receiver.ts`

### 关键实现模式

#### 1. 消息类型分发
```typescript
// 旧代码实现模式（参考）
// 根据消息类型（MsyncMessageType）分发处理：
// - SINGLECHAT: 单聊消息
// - GROUPCHAT: 群组消息
// - CHATROOM: 聊天室消息
// - READ_ACK: 已读回执
// - DELIVER_ACK: 送达回执
// - RECALL: 撤回消息
// - EDIT: 编辑消息
```

**重构要求**:
- 保持消息类型分发逻辑
- 使用 ChannelReference.type 区分单聊/群组/聊天室
- 支持 ACK 和特殊消息类型

#### 2. 消息解析
```typescript
// 旧代码实现（参考）
// 1. 解析 protobuf 消息
// 2. 提取消息内容（contents）
// 3. 解析扩展字段（ext）
// 4. 构造消息对象
// 5. 触发回调
```

**重构要求**:
- 保持消息解析逻辑
- 构造完整的 Message 对象（包含 ChannelReference、MessageBody）
- 使用事件系统触发回调

#### 3. 错误处理
```typescript
// 旧代码实现（参考）
// 消息解析失败时：
// - 记录错误日志
// - 设置消息错误状态
// - 触发错误回调
```

**重构要求**:
- 保持错误处理方式
- 使用统一的错误处理类（SDKError）
- 记录结构化日志

---

## 五、重构注意事项

### ✅ 需要保持的
1. **连接建立流程**: provision → WebSocket → auth → heartbeat
2. **心跳机制**: 30 秒间隔，ping/pong 机制
3. **重连逻辑**: 指数退避策略，最大重连次数配置
4. **消息编解码**: protobuf 序列化/反序列化，LZ4 压缩
5. **消息状态管理**: SENDING → SENT → DELIVERED → READ
6. **ACK 机制**: READ_ACK, DELIVER_ACK
7. **错误处理**: 统一的错误码和错误信息

### 🔄 需要改进的
1. **API 形式**: 从 Connection 类改为管理器模式（MessageManager, ChannelManager）
2. **类型系统**: 使用联合类型而非枚举
3. **Channel 概念**: 统一会话和群组，使用 ChannelReference
4. **事件系统**: 独立事件，不再使用 operation 区分
5. **错误处理**: 统一使用 Promise，不再使用回调

### ❌ 需要移除的
1. **兼容代码**: 移除旧的消息格式兼容代码
2. **回调方式**: 移除回调方式的 API，统一使用 Promise
3. **namespace**: 移除 TypeScript namespace，使用模块导出

---

## 六、实现优先级

### Phase 3: User Story 1（连接建立与消息收发）
**参考文件**:
- `engineCore/connection.ts` → `src/core/connection/connection-manager.ts`
- `engineCore/mSync.ts` → `src/core/message/message-sender.ts`, `src/core/message/message-receiver.ts`
- `proto.ts` → `src/protocol/protobuf/messages.proto`
- `handleMessages/handleChatMsg.ts` → `src/core/message/message-receiver.ts`

**关键点**:
1. 保持连接建立流程和心跳机制
2. 保持 protobuf 编解码方式
3. 使用 ChannelReference 代替 to/receiverId/groupId
4. 使用事件系统代替回调

---

## 七、代码示例

### 连接建立示例（参考）
```typescript
// 旧代码流程（参考）
// 1. 调用 connect() 方法
// 2. 进行 provision（获取连接信息）
// 3. 建立 WebSocket 连接
// 4. 发送认证消息
// 5. 启动心跳机制
// 6. 触发连接成功回调
```

### 消息发送示例（参考）
```typescript
// 旧代码流程（参考）
// 1. 构造消息对象
// 2. 序列化为 protobuf
// 3. 可选压缩（LZ4）
// 4. 通过 WebSocket 发送
// 5. 等待 ACK
// 6. 更新消息状态
```

### 消息接收示例（参考）
```typescript
// 旧代码流程（参考）
// 1. 接收 WebSocket 消息
// 2. 可选解压缩（LZ4）
// 3. 反序列化 protobuf
// 4. 解析消息类型和内容
// 5. 构造消息对象
// 6. 触发消息回调
```

---

## 八、总结

**核心原则**:
- ✅ 保持核心实现逻辑（连接、编解码、状态管理）
- 🔄 改进架构设计（管理器模式、类型系统、事件系统）
- ❌ 移除过时设计（回调、namespace、兼容代码）

**实现策略**:
1. 先理解旧代码的实现模式
2. 在新架构中保持核心逻辑
3. 使用新的设计模式改进代码结构
4. 确保 API 行为一致性
