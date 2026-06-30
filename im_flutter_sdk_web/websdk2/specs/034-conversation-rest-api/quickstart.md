# 034 快速验证指南

## 目标

验证 034 满足以下核心约束：

- conversation 主线统一通过 `client.chatManager` 访问
- conversation silent mode 继续通过 `client.pushManager` 访问
- thread 域通过新增的 `client.chatThreadManager` 访问
- conversation cache 已升级到 `singleChat/groupChat/chatRoom`
- 会话 mutation 默认不自动 patch 当前列表，调用方通过 `getConversationList()` 主动刷新
- `onConversationListUpdate` 与 `onPinnedMessageChanged`、`onChatThreadChange` 具备稳定 typed payload

## 前置准备

1. 安装依赖：

```bash
npm install
```

2. 准备可用登录态：

- `appKey`
- `userId`
- `token`
- `restBaseUrl`

3. 准备验证样例 / fixture：

- 旧 `websdk` conversation REST 样例或等价 fixture
- 旧 `websdk` thread REST 样例或等价 fixture
- message pin / conversation notify / thread notify fixture
- 一份旧 schema conversation cache fixture（包含 `single/group/room`）

## 验证步骤

### 步骤 1：静态检查

```bash
npm run lint
npm run type-check
```

期望：

- conversation / thread 新类型、导出与事件 typing 通过
- 旧 connection 风格会话 / thread 公开入口不再出现在新示例主路径

### 步骤 2：登录后会话同步

```ts
import {
  ChatClient,
  ChatManager,
  PushManager,
  ChatThreadManager,
} from 'im-sdk-web';

const client = ChatClient.init({ appKey: 'org#app' })
  .use(ChatManager)
  .use(PushManager)
  .use(ChatThreadManager);

client.chatManager.addEventHandler('conversation-ui', {
  onConversationListUpdate: payload => {
    console.log(payload.source, payload.items.map(item => item.type));
  },
  onPinnedMessageChanged: event => {
    console.log(event.operation, event.messageId);
  },
});

client.chatThreadManager.addEventHandler('thread-ui', {
  onChatThreadChange: event => {
    console.log(event.change, event.chatThreadId);
  },
});
```

期望：

- 登录后若存在本地 conversation cache，先收到 `source = 'cache'`
- 服务端同步有差异时收到 `source = 'serverSync'`
- 会话类型均为 `singleChat/groupChat/chatRoom`

### 步骤 3：会话主线 REST

```ts
const page = await client.chatManager.getConversationList({
  pageSize: 20,
  cursor: '',
  includeEmptyConversations: false,
});

await client.chatManager.setConversationPinned({
  conversationId: page.items[0]?.conversationId ?? 'group_123',
  conversationType: page.items[0]?.type ?? 'groupChat',
  pinned: true,
});

await client.chatManager.deleteConversation({
  conversationId: 'group_123',
  conversationType: 'groupChat',
  deleteRoamingMessages: false,
});

const refreshed = await client.chatManager.getConversationList({
  pageSize: 20,
  cursor: '',
});
```

期望：

- mutation 成功先返回标准化 REST 结果
- 当前会话列表是否更新，以重新调用 `getConversationList()` 的结果为准
- demo 与 quickstart 都明确体现“操作后主动刷新”

### 步骤 4：会话免打扰

```ts
await client.pushManager.setConversationSilentMode({
  conversationId: 'group_123',
  type: 'groupChat',
  rule: { mode: 'REMIND_TYPE', remindType: 'NONE' },
});

const silent = await client.pushManager.getConversationSilentMode({
  conversationId: 'group_123',
  type: 'groupChat',
});
```

期望：

- silent mode 仍走 `pushManager`
- 结果可按 `conversationId + type` 与会话列表关联

### 步骤 5：thread 主路径

```ts
const created = await client.chatThreadManager.createChatThread({
  parentId: 'group_123',
  name: 'Topic A',
  messageId: 'mid_001',
});

const chatThread = client.chatThreadManager.getChatThread(created.chatThreadId);
await chatThread.join();
await chatThread.getInfo();
await chatThread.getMemberList();
```

期望：

- `chatThreadManager` 成为 thread 域唯一公开入口
- `ChatThread` 只承载单 thread 上下文方法
- thread 事件通过 `onChatThreadChange` 统一回调

### 步骤 6：cache migration

准备一份旧 cache：

```json
{
  "items": [
    {
      "conversationId": "u1",
      "type": "single",
      "lastMessage": null,
      "unreadCount": 1,
      "lastAccess": 1,
      "lastUpdate": 1
    }
  ]
}
```

期望：

- 读取后内存中的类型被归一化为 `singleChat`
- 后续 flush 不再写回 `single/group/room`
- 缺失 `marks` 的旧数据会回填为空数组

## 推荐验证命令

```bash
npm run test:run -- tests/unit/managers/chat-manager-conversation.test.ts tests/unit/chat-thread tests/unit/cache/conversation-cache.test.ts
npm run test:run -- tests/integration/chat tests/integration/chat-thread
npm run test:run -- tests/contract/conversation-rest-api.contract.test.ts tests/contract/push-manager.contract.test.ts
npm run test:e2e -- tests/e2e/conversation-panel.spec.ts tests/e2e/push-panel.spec.ts tests/e2e/chat-thread-panel.spec.ts
```

## 验收要点

- `chatManager / pushManager / chatThreadManager` 三域入口边界清晰
- conversation mutation 默认主动刷新策略在代码、demo、文档和测试中一致
- `onConversationListUpdate` / `onPinnedMessageChanged` / `onChatThreadChange` 全部为 typed event
- conversation cache canonical naming 与公开 DTO 对齐
