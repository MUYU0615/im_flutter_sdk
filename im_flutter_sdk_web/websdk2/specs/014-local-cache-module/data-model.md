# 数据模型（Phase 1）

## 1. ConversationSummary（会话摘要）

**字段**
- conversationId：会话唯一标识
- type：会话类型（单聊/群聊）
- subType：会话子类型（可选）
- lastMessage：最后一条消息摘要
- unreadCount：未读数
- userProfile：单聊对端用户摘要（可选）
- groupProfile：群组摘要（可选）
- lastAccess：最近访问时间戳
- lastUpdate：最近更新（写入）时间戳

**约束**
- lastMessage 为摘要，不包含完整历史消息

## 2. UserInfoSummary（用户信息摘要）

**字段**
- userId：用户唯一标识
- nickname：昵称
- avatarUrl：头像地址
- lastAccess：最近访问时间戳
- lastUpdate：最近更新（写入）时间戳

**约束**
- 默认最多缓存 1000 条
- 超限时优先淘汰该实体

## 3. CacheMetadata（缓存元信息）

**字段**
- schemaVersion：缓存结构版本号
- lastFlush：最近一次批量写入时间戳

**约束**
- schemaVersion 变更时允许清理旧缓存

## 关系与规则

- ConversationSummary 仅包含 lastMessage 摘要，不关联消息列表缓存
- UserInfoSummary 可被会话摘要引用（userProfile）
- CacheMetadata 记录整体缓存状态，用于容量与过期控制
