# 本地缓存模块设计文档

## 1. 背景与目标

在 IM SDK 场景下，部分数据对首屏渲染、弱网降级与交互流畅度有明显收益，但 localStorage 有 **5MB 左右容量限制**、**同步阻塞主线程**、**频繁读写导致 UI 卡顿** 等问题。因此需要设计一个 **轻量、可控、可回退** 的缓存模块，目标是：

- **首屏加速**：登录后优先展示缓存的会话摘要/未读数，提升用户感知速度。
- **弱网兜底**：网络不稳时仍可展示“最近数据”。
- **成本可控**：避免缓存大数据/高频数据造成卡顿或空间爆炸。
- **可回退**：缓存失败或过期时，完全依赖服务端数据。

## 2. 适用范围与非目标

### 2.1 适用范围（缓存“热点 + 轻量”）

- 会话列表摘要（conversation list summary）
- 每个会话的最后一条消息摘要（lastMessage）
- 每个会话的未读数（unreadCount）
- 用户信息（userInfo）摘要（默认上限 1000 条，支持批量写入）

### 2.2 非目标（不缓存或谨慎缓存）

- 完整历史消息
- 大附件（图片、视频、文件、语音等）
- 高频变化、服务端已很快可获取的数据
- 账号敏感信息（token、密码、密钥、设备标识等）

## 3. 设计原则

1. **缓存是加速层，不是真相**：服务端数据为最终可信来源。
2. **尽量少写**：只在关键时刻写入，避免频繁同步阻塞。
3. **可控淘汰**：结合 LRU + TTL，保证缓存新鲜与空间可控。
4. **失败可回退**：任何读/写失败都不影响主流程。
5. **兼容升级**：通过 schemaVersion 统一清理老结构。

## 4. 数据模型

### 4.1 缓存 Key 设计

- Key 前缀：`IMSDK_{SDKAppID}_{userId}_`（示例）
- schemaVersion：写入 value 中或 key 后缀中

示例：

- `IMSDK_{SDKAppID}_{userId}_conversationMap_v1`
- `IMSDK_{SDKAppID}_{userId}_metadata_v1`

### 4.2 会话摘要结构（示例）

```json
{
  "conversationId": "C2C_user123",
  "type": "singleChat",
  "lastMessage": {
    "msgId": "xxx",
    "type": "text",
    "body": { "text": "hello" },
    "timestamp": 1700000000000
  },
  "unreadCount": 2,
  "userInfo": { "userId": "user123", "nickname": "Tom", "avatarUrl": "" },
  "groupInfo": null,
  "lastAccess": 1700000000000,
  "lastUpdate": 1700000000000
}
```

### 4.3 用户信息结构（示例）

```json
{
  "userId": "user123",
  "nickname": "Tom",
  "avatarUrl": "https://example.com/avatar.png",
  "lastAccess": 1700000000000, // 访问时间
  "lastUpdate": 1700000000000
}
```

### 4.4 元信息（metadata）

用于记录整体缓存状态：

```json
{
  "schemaVersion": 1, // 缓存数据结构版本号
  "lastFlush": 1700000000000 // 上一次批量写入（flush）到本地存储的时间，用于观察写入频率或做诊断
}
```

## 5. 容量与上限策略

- 不再计算数据 `size`，仅依赖数量限制与写入失败时的淘汰策略。
- 用户信息默认最多缓存 1000 条（固定上限）。
- localStorage 物理容量约 5MB，若写入触发 `QuotaExceededError` 则执行 TTL + LRU 清理后重试一次。

## 6. 淘汰与过期策略

### 6.1 LRU + TTL

- 每条记录存 `lastAccess` 与 `lastUpdate`
- 过期时间（TTL）建议 24~72 小时
- 写入超限时，按 LRU（最久未访问）或最旧会话清理

### 6.2 写入超限处理

- 捕获 `QuotaExceededError`
- 触发 TTL + LRU 清理逻辑（优先清理过期与最久未访问数据）
- 清理后 **只重试一次**
- 仍失败则放弃写入，保留内存数据

### 6.3 用户信息缓存策略

- **默认上限 1000 条**，超过上限时按 TTL + LRU 淘汰
- 按 `lastAccess` 执行 LRU 淘汰
- 支持批量写入/批量读取，避免频繁同步 IO 阻塞主线程

## 7. 读写策略

### 7.1 读取时机

- SDK init / login 后先读缓存 有控制参数
- 构建内存会话列表并触发 UI 更新
- 同步拉取服务端数据后覆盖/融合

### 7.2 写入时机

- 会话列表同步完成后
- 会话置顶/取消置顶
- 删除会话
- SDK reset

**注意**：避免每条消息都写入 localStorage。

### 7.2.1 用户信息写入时机

- 获取用户信息成功后，批量写入（合并同一帧/同一时段的请求）
- 收到消息时若包含未知用户信息，允许批量补写摘要

### 7.3 写入节流

- 默认进入写入队列
- 使用定时器或 `requestIdleCallback` 批量 flush
- 仅在关键场景才 `flushAtOnce = true`

### 7.4 用户信息读取策略

- 先查缓存命中直接返回
- 缓存未命中或过期时从服务端获取
- 服务端返回后更新缓存并返回最新结果

## 8. 与服务端融合策略

推荐采用“**本地先显示，服务端再覆盖**”策略：

1. 从缓存构建内存会话列表并触发 UI 更新
2. 同步拉取服务端会话列表
3. 同步完成后执行：
   - 删除服务端不存在的本地会话
   - 触发 UI 更新
   - 写回最新缓存

## 9. 失败与回退

- 任何缓存读取失败 → 走服务端数据
- 任何缓存写入失败 → 不影响主流程
- 读写都必须 try/catch，确保安全降级

## 10. 安全与隐私

- 不缓存 token、密码、密钥等敏感信息
- 仅缓存展示所需的轻量字段
- 业务扩展字段（ext）应设置大小上限

## 11. 可配置项（建议）

- `maxConversations`: 最大会话数
- `ttlSeconds`: 缓存过期时间
- `flushInterval`: 批量 flush 间隔
- `enableUserInfoCache`: 是否启用用户信息缓存（默认开启）
- `maxUserInfoCount`: 用户信息缓存上限（默认 1000）

## 12. 对外接口（建议）

**使用说明**：收消息模块、用户信息模块等业务层在需要展示或补全用户信息时，应通过缓存模块 API 进行读取与写入，避免直接访问 localStorage。

### 12.1 会话缓存接口

- `getConversationCache()`
- `setConversationCache(payload)`
- `setConversationCacheBatch(payloadList)`

### 12.2 用户信息缓存接口

- `getUserInfoCache(userIds)`
- `setUserInfoCache(userInfo)`
- `setUserInfoCacheBatch(userInfoList)`
- `removeUserInfoCache(userIds)`
- `clearUserInfoCache()`

## 13. 参考：TCloudChat 缓存机制

- 仅缓存会话列表（最多 20 条）与必要字段
- init 时加载本地会话列表，先渲染 UI
- 后续 `syncConvList()` 拉服务端会话列表并覆盖
- setItem 采用写入队列，定时批量 flush

## 14. 结论

本地缓存应定位为“**首屏加速 + 弱网兜底**”的轻量能力，必须严格控制数据规模与写入频率，避免同步存储带来的 UI 卡顿与配额风险。服务端数据始终是最终可信来源，缓存只负责提升体验与降低冷启动成本。
