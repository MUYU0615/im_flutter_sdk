# 046 快速验证指南

## 前置条件

- 已安装依赖。
- 已完成 SDK 初始化和登录所需测试账号。
- 测试环境中至少有一个群组、一个可作为父消息的群消息，以及 Thread 功能已开通。
- 本功能不新建分支；当前产物位于 `specs/046-chat-thread-public-api/`。

## 本地开发验证

### 1. 注册 ChatThreadManager

```ts
import { ChatClient, ChatManager, ChatThreadManager } from 'im-sdk-web';

const client = ChatClient.init({
  appKey: 'org#app',
}).use(ChatManager).use(ChatThreadManager);
```

### 2. 监听 4 个公开事件

```ts
client.chatThreadManager.addEventHandler('thread-ui', {
  onChatThreadCreated: event => {
    console.log(event.chatThreadId, event.parentId);
  },
  onChatThreadDestroyed: event => {
    console.log(event.chatThreadId);
  },
  onChatThreadUpdated: event => {
    console.log(event.chatThreadId, event.chatThreadName, event.lastMessage);
  },
  onChatThreadUserRemoved: event => {
    console.log(event.chatThreadId, event.memberId);
  },
});
```

不得再示例或使用 `onChatThreadChange`。

### 3. 创建和查询 Thread

```ts
const created = await client.chatThreadManager.createChatThread({
  parentId: 'group-1',
  name: 'topic',
  messageId: 'msg-1',
});

const detail = await client.chatThreadManager.getChatThreadInfo({
  chatThreadId: created.chatThreadId,
});

console.log(detail.chatThreadId, detail.parentId);
```

### 4. 使用 ChatThread 实体

```ts
const thread = client.chatThreadManager.getChatThread('thread-1');
const info = await thread.getInfo();
await thread.updateName({ name: 'new topic' });
const members = await thread.getMemberList({ pageSize: 20, cursor: '' });
```

文档中不得出现 `thread.getDetail()`，除非实现阶段新增并测试该 alias。

### 5. 成员与最后消息

```ts
await client.chatThreadManager.removeChatThreadMember({
  chatThreadId: 'thread-1',
  memberId: 'user-2',
});

const lastMessages = await client.chatThreadManager.getChatThreadLastMessageList({
  chatThreadIds: ['thread-1'],
});

console.log(lastMessages.items);
```

## 必跑验证命令

### 针对性单元测试

```bash
npm run test:run -- \
  tests/unit/rest/chat-thread-management.test.ts \
  tests/unit/managers/chat-thread-manager.test.ts \
  tests/unit/managers/chat-thread.test.ts \
  tests/unit/chat-client/chat-thread-events.test.ts \
  tests/unit/core/message/message-receiver-thread.test.ts
```

### 导出契约

```bash
npm run test:run -- tests/contract/manager-exports.contract.test.ts
```

### 文档和错误码

```bash
npm run docs:api:check
npm run errors:check
```

### 常规门禁

```bash
npm run type-check
npm run lint
npm run test:gate:pr
```

## 最终验证记录

已通过：

- `npm run test:run -- tests/unit/rest/chat-thread-management.test.ts tests/unit/managers/chat-thread-manager.test.ts tests/unit/managers/chat-thread.test.ts tests/unit/chat-client/chat-thread-events.test.ts tests/unit/core/message/message-receiver-thread.test.ts tests/types/chat-thread-types.test.ts tests/contract/manager-exports.contract.test.ts tests/contract/api-doc-entry-points.contract.test.ts`
  - 8 个文件、35 个用例通过。
- `npm run type-check`
- `npm run lint`
  - 通过，仍有仓库既有 3 条 warning：`src/core/contact-sync/roster-sync-client.ts`、`src/message/combine-message-constraints.ts`、`src/rest/conversation-management.ts`。
- `npm run docs:api:check`
  - 通过，TypeDoc 仍有仓库既有 6 条引用 warning，无 error。
- `npm run errors:check`
- `npm --prefix packages/websdk2-ai-kit run sync:references`
- `npm run test:gate:pr`
  - 沙箱内因 integration mock server 监听 `127.0.0.1` 报 `listen EPERM`；提升权限重跑通过，32 个文件、94 个用例通过。

未完成的真实环境验证：

- `tests/e2e/api/chat-thread.spec.ts` 尚未实现真实环境链路，原因是缺少稳定的父群组、父群消息、Thread fixture 和双账号事件观测流程。
- `tests/integration/chat-thread/` 尚未新增专属 integration 文件；当前事件链路由 `tests/unit/chat-client/chat-thread-events.test.ts` 与 `tests/unit/core/message/message-receiver-thread.test.ts` 覆盖。
- `tests/types/chat-thread-doc-examples.test.ts` 尚未新增；当前通过 `tests/types/chat-thread-types.test.ts`、API Reference 生成检查和 AI Kit reference 同步覆盖公开类型与文档主路径。

## 事件验证矩阵

| 输入来源 | 公开事件 | 期望 |
|----------|----------|------|
| Thread create raw notify | `onChatThreadCreated` | 派发一次，包含 `chatThreadId`、`parentId`、`chatThreadName` |
| Thread delete raw notify | `onChatThreadDestroyed` | 派发一次，包含 `chatThreadId`、`parentId` |
| Thread update raw notify | `onChatThreadUpdated` | 派发一次，包含新名称或 Thread 摘要 |
| Thread update_msg raw notify | `onChatThreadUpdated` | 派发一次，包含 `messageCount` / `lastMessage` |
| 当前用户被移出 Thread | `onChatThreadUserRemoved` | 派发一次，包含 `memberId` |
| Thread join / leave raw notify | 无公开 Thread 事件 | 不派发 |
| 未注册 ChatThreadManager | 无公开 Thread 事件 | 不派发 |
| 缺少 `chatThreadId` 或 `parentId` | 无公开 Thread 事件 | 不派发 |

## 发布前检查

- `src/rest/api-errors.json` 中 Thread operation 的 `errors` 和 `localErrors` 已补齐。
- API Reference 中能搜索到 `ChatThreadManager`、`ChatThread`、4 个事件 payload 和所有公开参数/返回类型。
- API Reference 中搜索不到可公开依赖的 `onChatThreadChange` 和 raw notify 类型。
- `docs/integration/thread.md` 示例和公开类型一致。
- demo Thread 面板不再展示旧聚合事件。
- CHANGELOG 和版本号在实现完成后更新，最终提交使用中文 commit message。
