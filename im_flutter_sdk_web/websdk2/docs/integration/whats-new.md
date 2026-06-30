# 新 SDK 相对旧 SDK 的增强与变化

## 增强点

### 1. 完整的 TypeScript 类型安全

**旧 SDK：** 大量 `any` 类型，参数和返回值缺乏类型约束，IDE 补全和重构体验差。

**新 SDK：** TypeScript strict 模式，零 `any`。所有公开 API 参数、返回值、事件载荷均有完整类型定义。

```typescript
// 旧 SDK — 无类型提示，容易传错参数
const msg = WebIM.message.create({ type: 'txt', to: 123, msg: null }); // 运行时才报错

// 新 SDK — 编译期即报错
const msg = client.chatManager.createTextMessage({
  conversationId: 'user2',    // 必须是 string
  conversationType: 'singleChat', // 只能是联合类型之一
  content: 'hello',           // 必填
}); // ✅ 类型安全
```

---

### 2. 模块化按需加载

**旧 SDK：** 所有功能（群组、聊天室、Presence、Thread 等）全量打包，即使不使用也会增加包体积。

**新 SDK：** Manager 按需注册，未注册的模块不会进入最终 bundle。

```typescript
// 只需要消息和联系人功能
const client = ChatClient.init({
  appKey: 'org#app',
  managers: [ChatManager, ContactManager],
});
// GroupManager、ChatRoomManager 等不会被打包
```

---

### 3. 消息创建类型安全

**旧 SDK：** 单一 `message.create({ type: ... })` 工厂，所有消息类型共用一个参数类型，IDE 无法根据 `type` 推断必填字段。

**新 SDK：** 每种消息类型有独立的创建方法，参数完全类型化。

```typescript
// 旧 SDK — 创建图片消息时 IDE 不知道需要 file 字段
WebIM.message.create({ type: 'img', to: 'u2', chatType: 'singleChat' }); // 缺 file 不报错

// 新 SDK — 缺少必填字段直接编译报错
client.chatManager.createImageMessage({
  conversationId: 'u2',
  conversationType: 'singleChat',
  file: imageFile, // 必填，缺少则 TS 报错
});
```

---

### 4. 事件系统增强

**旧 SDK：**
- 群组/聊天室事件聚合在单一回调中，需要手动 `switch (event.operation)`
- 消息事件按类型分散（`onTextMessage`、`onImageMessage` 等），处理统一逻辑时需要注册多个回调
- 事件载荷类型为 `any` 或宽泛联合类型

**新 SDK：**
- 群组/聊天室事件拆分为独立事件名，每个事件有精确的载荷类型
- 消息统一为 `onMessage`，通过 `msg.type` 判断，更符合实际业务模式
- 所有事件载荷完整类型化，IDE 可直接点出字段
- 每个事件的 JSDoc 注释标注了触发时机和接收方

```typescript
// 旧 SDK — 需要 switch 判断
onGroupEvent: (event) => {
  if (event.operation === 'memberPresence') { /* ... */ }
  if (event.operation === 'removeMember') { /* ... */ }
}

// 新 SDK — 直接注册关心的事件，类型精确
onMembersJoined: (event) => {
  console.log(event.groupId, event.userId); // 类型安全
},
onUserRemoved: (event) => {
  console.log(event.groupId); // 类型安全
},
```

---

### 5. 面向对象的实体 API（可选风格）

**旧 SDK：** 所有操作都是扁平的函数调用，每次都需要传 `groupId` / `chatRoomId`。

**新 SDK：** 在保留平铺 Manager API 的同时，额外提供 Group / ChatRoom / ChatThread 实体对象，适合围绕单个实体做一系列操作的场景。

```typescript
// 平铺风格（仍然支持，更适合 React/Vue 状态管理模式）
await client.groupManager.muteGroupMembers({ groupId: 'g1', userIds: ['u1'], duration: 60000 });

// OO 实体风格（适合 demo、快速原型、或不使用状态管理库的场景）
const group = client.groupManager.getGroup('g1');
await group.muteMembers({ userIds: ['u1'], duration: 60000 });
await group.getMuteList();
await group.getAnnouncement();
```

两种风格并存，按场景选择。

---

### 6. 统一错误模型

**旧 SDK：** 错误格式不统一，有时是 `{ type, message, data }`，有时是 HTTP 错误对象，有时是字符串。

**新 SDK：** 类型化错误类层次结构，每种错误有明确的 `code`：

| 错误类 | 场景 |
|--------|------|
| `ValidationError` | 参数校验失败（本地） |
| `ConnectionError` | 连接/网络问题 |
| `AuthenticationError` | 认证失败 |
| `SDKError` | 服务端业务错误（含 HTTP 状态码和错误码） |
| `MessageSendError` | 消息发送失败 |

```typescript
try {
  await client.chatManager.sendMessage(msg);
} catch (e) {
  if (e instanceof ValidationError) {
    // 本地参数问题，不需要重试
  } else if (e instanceof SDKError) {
    console.log(e.code, e.httpStatus); // 结构化错误信息
  }
}
```

---

### 7. 会话列表实时同步

**旧 SDK：** 会话列表只能通过 REST 轮询 `getServerConversations` 获取，无实时推送。

**新 SDK：** 内置 WebSocket 实时会话列表同步（session-list-sync），登录后自动推送会话变更，无需轮询。

```typescript
// 实时获取最新会话列表
const conversations = client.chatManager.getConversationList();

// 监听同步事件
client.addEventHandler('session', {
  onSyncDataFinished: payload => {
    if (payload.dataType !== 'conversation') return;
    // 会话列表已更新
  },
});
```

---

### 8. 联系人自动同步

**旧 SDK：** 联系人列表需要手动调用 `getContacts()` 拉取，无增量同步。

**新 SDK：** 登录后自动通过 WebSocket 增量同步联系人快照，支持冷启动缓存。

```typescript
// 配置
ChatClient.init({ appKey: '...', enableSyncData: ['contact'] });

// 同步完成后直接读取
client.addEventHandler('contact', {
  onSyncDataFinished: payload => {
    if (payload.dataType === 'contact' && payload.status === 'success') {
      const contacts = client.contactManager.getContacts(); // 已同步完毕
    }
  },
});
```

---

### 9. 用户资料订阅与自动同步

**旧 SDK：** 用户资料需要手动 `fetchUserInfoById` 拉取，无变更通知。

**新 SDK：** 支持订阅用户资料变更，变更时自动推送；消息中自动携带发送者资料（profile hydration）。

```typescript
await client.userInfoManager.subscribeUsersInfo({ userIds: ['u1', 'u2'] });

client.addEventHandler('userInfo', {
  onUserInfoUpdated: (users) => {
    // 订阅的用户资料变更，自动推送
  },
});
```

---

### 10. 结构化日志与上报

**旧 SDK：** `isDebug: true` 开关式日志，无级别控制，无缓存下载。

**新 SDK：** 分级日志（TRACE/DEBUG/INFO/WARN/ERROR/SILENT），支持缓存、下载、自定义监听。

---

### 11. 跨平台适配层

**旧 SDK：** Web 和小程序分别维护不同入口（`entry.ts` vs `wxEntry.ts`），代码分叉。

**新 SDK：** 统一的平台适配层（`PlatformAdapter`），通过运行时检测自动适配 Web / 微信小程序 / React Native，核心代码零分叉。

---

### 12. 小程序附件上传内置化

**旧 SDK：** 小程序环境下发送图片/语音/视频/文件消息时，开发者需要自行调用 `wx.uploadFile` 上传附件到环信服务器，拿到 URL 后再拼装消息发送。流程繁琐且容易出错。

**新 SDK：** 附件上传完全内置于 SDK 内部。小程序环境下传入小程序文件对象（`MiniAppFile`），SDK 自动通过平台适配层完成上传，开发者只需 `createImageMessage` + `sendMessage`，体验与 Web 端完全一致。

```typescript
// 新 SDK 小程序端 — 与 Web 端代码完全相同
const msg = client.chatManager.createImageMessage({
  conversationId: 'user2',
  conversationType: 'singleChat',
  file: miniAppFile, // 小程序文件对象，SDK 内部自动适配上传
});
await client.chatManager.sendMessage(msg);
```

---

### 13. 图片发送增强（大图 + 压缩）

**旧 SDK：** 图片消息直接上传原图，无压缩能力。大图发送慢，且可能超出服务端限制。

**新 SDK：** 内置图片预处理能力：
- 支持发送大图（超出限制时自动压缩）
- 可配置压缩质量和最大尺寸
- 压缩在发送前完成，对接收方透明

---

### 14. 语音转文字

**旧 SDK：** 无此功能。

**新 SDK：** 内置 `voiceMessageToText` / `voiceFileToText` API，支持语音消息和语音文件转文字。

---

### 15. 流式消息

**旧 SDK：** 无此功能。

**新 SDK：** 支持流式消息（如 AI 生成内容），通过 `onStreamMessage` 事件接收增量更新。

---

### 16. Token 生命周期管理

**旧 SDK：** 仅提供 `onTokenWillExpire` 事件，续期后无过期时间反馈。

**新 SDK：** `renewToken` 返回 `{ token, expireAt }`，明确告知新 Token 过期时间；支持 RTC Token 获取和 UID 映射。

---

### 17. 双语 JSDoc 文档

**旧 SDK：** 注释稀少，无统一格式。

**新 SDK：** 所有公开 API 均有中英双语 JSDoc，包含 `@example` 代码示例、参数说明、事件触发时机和接收方描述。IDE 悬停即可查看完整文档。

---

## 当前不如旧 SDK 的地方

| 项目 | 说明 |
|------|------|
| **密码登录** | 旧 SDK 支持 `conn.open({ user, pwd })`；新 SDK 仅支持 Token 登录 |
| **创建聊天室** | 旧 SDK 有 `conn.createChatRoom()`；新 SDK 未暴露（需通过服务端 REST API） |
| **注册用户** | 旧 SDK 有 `conn.registerUser()`；新 SDK 已移除（应通过服务端 REST API） |
| **消息搜索** | 两者都没有本地全文搜索，但旧 SDK 的 `fetchHistoryMessages` 支持更灵活的旧版分页参数 |
| **断点续传** | 两者都未实现，但旧 SDK 的分片上传有更多回调（`onFileUploadProgress`）；新 SDK 的上传进度回调尚在完善中 |
| **生态兼容** | 旧 SDK 有大量社区使用案例和 UIKit 集成；新 SDK 生态尚在建设中 |
| **MiniCore 轻量模式** | 旧 SDK 提供 MiniCore 极简入口（不含 REST API）；新 SDK 通过 Manager 按需注册实现类似效果，但无独立的极简包 |

---

## 总结

新 SDK 在**类型安全、模块化、事件精确性、实时同步、跨平台一致性、错误处理、开发体验**方面有显著提升，适合新项目和追求代码质量的团队。旧 SDK 在**送达回执、密码登录、生态成熟度**方面仍有优势，但这些差距会随着新 SDK 迭代逐步补齐。
