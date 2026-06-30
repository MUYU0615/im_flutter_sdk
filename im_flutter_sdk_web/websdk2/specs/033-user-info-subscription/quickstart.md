# 033 快速验证指南

## 目标

验证用户资料订阅与变更通知满足以下核心约束：

- `UserInfoManager` 提供 `subscribeUsersInfo`、`unsubscribeUsersInfo`、`getSubscribedUsers`
- 订阅相关 API 不透传原始 REST envelope，只返回 `void` 或 `ReadonlyArray<UserInfo>`
- `subscribe_metadata_updated` 会先更新当前会话资料真相，再派发 `onUserInfoUpdated`
- `contact_metadata_updated` 会先更新当前会话资料真相，再刷新联系人视图，并派发 `onContactInfoUpdated`
- 乱序 notify 不会让旧 `lastModified` 覆盖新缓存
- 当前 `UserInfoSummary` 仍保持摘要持久化，会话内完整资料由运行时态保证
- 同一用户即使同时是好友且已订阅，事件归属仍严格以服务端 notify 类型为准

## 当前状态

### 样例门禁已补齐

033 已补齐以下真实 success 响应样例：

- `POST /{org}/{app}/user/{username}/metadata/subscription`
- `DELETE /{org}/{app}/user/{username}/metadata/subscription?usernames=...`
- `GET /{org}/{app}/user/{username}/metadata/subscription`

已确认的关键结论：

- POST upstream body 字段名是 `usernames`，不是 `userIds`
- DELETE upstream 通过 query `usernames=a,b` 传参，不走 request body
- 三类 success response 都复用同一组 envelope 字段：`path`、`uri`、`status`、`timestamp`、`organization`、`application`、`entities`、`count`、`data`、`duration`、`applicationName`
- GET upstream `data` 只返回用户名数组，因此 SDK 查询链路需要在内部继续 hydrate 为 `ReadonlyArray<UserInfo>`

这意味着：

- 可以进入 033 的正式实现阶段
- contract 不再使用 `pending-real-sample` 占位 schema
- US1 的实现必须显式验证“用户名列表 -> `UserInfo[]`”这一步内部归一化

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

3. 准备测试账号或等价 fixture：

- 账号 A：当前登录用户，可发起订阅、取消订阅、查询订阅
- 账号 B：非好友用户，可用于订阅与 `subscribe_metadata_updated`
- 账号 C：好友用户，可用于 `contact_metadata_updated`

4. 准备 notify 等价 fixture：

- `subscribe_metadata_updated` 正常 patch
- `subscribe_metadata_updated` 旧版本 patch
- `subscribe_metadata_updated` 重复等价 patch
- `contact_metadata_updated` 正常 patch
- `contact_metadata_updated` 关系字段不完整场景

5. 准备已知错误样例：

- 401 鉴权失败
- 403 服务未开通 / 无权限
- 400 当前登录用户订阅数超限
- 400 目标用户被订阅数超限

## 验证步骤

### 步骤 1：静态检查

```bash
npm run lint
npm run type-check
```

期望：

- 033 新增的订阅 API、事件类型、内部 notify 类型与缓存模型都能通过静态检查
- 不存在把原始 notify JSON 直接暴露为公开事件载荷的情况
- 不存在继续用 `Date.now()` 覆盖 `lastModified` 版本语义的实现回归

### 步骤 2：单元测试

```bash
npm run test:run -- tests/unit/managers/user-info-manager-subscription.test.ts tests/unit/managers/contact-manager-friend-info.test.ts tests/unit/core/message/message-receiver-user-info-notify.test.ts tests/types/user-info-subscription-types.test.ts
```

期望：

- 订阅/取消订阅参数校验正确
- `userIds` 去重后顺序保持不变
- 单次订阅人数超过 100 时在本地 fail-fast
- 401/403/400 超限错误被正确映射
- `subscribe_metadata_updated` / `contact_metadata_updated` 能被正确识别
- notify patch 为部分字段 merge，而不是全量替换
- 旧版本 `lastModified` patch 被丢弃
- 重复等价 notify 不重复派发无意义事件
- `onUserInfoUpdated` 与 `onContactInfoUpdated` 的公开类型可从根导出

### 步骤 3：集成测试

```bash
npm run test:run -- tests/integration/user-info-manager/user-info-subscription.integration.test.ts tests/integration/contact-manager/contact-manager.integration.test.ts tests/integration/mock/manager-public-api.test.ts
```

期望：

- `client.use(UserInfoManager)` 后可通过 `client.userInfoManager` 调用三项订阅 API
- `client.use(ContactManager)` 后可通过 `client.contactManager` 监听好友资料变化事件
- `tests/integration/mock/manager-public-api.test.ts` 能覆盖 manager 注册、公开属性访问与基础事件订阅主路径
- `MessageReceiver -> ChatClient -> UserInfoManager/ContactManager` 协作链路成立
- 回调中立即读取用户资料时，拿到的是更新后的结果
- `getContacts()` 在好友 notify 处理完成后与 `onContactInfoUpdated` 结果一致
- `getSubscribedUsers()` 会先消费 upstream 用户名数组，再在 SDK 内部补齐 `UserInfo[]`

### 步骤 4：契约校验

```bash
npm run test:run -- tests/contract/user-info-subscription.contract.test.ts
```

期望：

- `contracts/user-info-subscription.openapi.yaml` 包含三项订阅 API 的 SDK-facing 路径
- contract 中显式保留 `SubscribedUserInfoChangedEvent` / `FriendInfoChangedEvent`
- contract 已固化三项 upstream success envelope 的真实字段结构
- contract 明确区分 DELETE 的 upstream query 传参与 GET 的 upstream 用户名数组返回

### 步骤 5：手工验证订阅 API 语义

```ts
const client = ChatClient.init({ appKey: 'org#app' })
  .use(UserInfoManager)
  .use(ContactManager);

await client.userInfoManager.subscribeUsersInfo({
  userIds: ['stranger-1', 'stranger-2'],
});

await client.userInfoManager.unsubscribeUsersInfo({
  userIds: ['stranger-2'],
});

const subscribed = await client.userInfoManager.getSubscribedUsers();
```

期望：

- 三个 API 都以 Promise 主语义工作
- 添加/取消订阅成功时返回 `void`
- 查询成功时返回 `ReadonlyArray<UserInfo>`
- 查询链路会先解析 GET success 中的用户名数组，再补齐资料 hydrate
- 查询结果只包含已订阅陌生人，不自动混入好友

### 步骤 6：手工验证订阅 notify 闭环

1. 当前用户已订阅 `stranger-1`
2. 向 SDK 注入一条 `subscribe_metadata_updated` fixture
3. 在 `onUserInfoUpdated` 回调中立即读取该用户资料

示例：

```ts
client.userInfoManager.addEventHandler('subscription-ui', {
  onUserInfoUpdated: event => {
    console.log(event.userInfo);
  },
});
```

期望：

- notify 会先更新缓存，再触发 `onUserInfoUpdated`
- 回调拿到的是最新 `userInfo`
- 若再次读取同一用户资料，结果与回调一致
- 若注入旧版本 notify，不更新缓存、不派发误导性事件

### 步骤 7：手工验证好友 notify 闭环

1. 当前用户与 `friend-1` 已存在好友关系
2. 向 SDK 注入一条 `contact_metadata_updated` fixture
3. 在 `onContactInfoUpdated` 回调后立即读取 `getContacts()`

示例：

```ts
client.contactManager.addEventHandler('contact-ui', {
  onContactInfoUpdated: event => {
    console.log(event.userId, event.userInfo, event.contact);
  },
});
```

期望：

- notify 会先更新统一 user-info 真相
- `onContactInfoUpdated` 至少包含 `userId` 与最新 `userInfo`
- 若当前联系人关系快照可用，则事件可附带 `contact`
- `getContacts()` 中同一好友的资料视图与事件一致
- 若关系字段缺失，仍派发最小事件，不吞掉整条通知

## 验收清单（对应 spec）

- 订阅 API 三项能力完整：通过率 100%
- 订阅 API 不泄漏原始 REST envelope：通过率 100%
- 订阅 notify 后无需补拉即可读到最新资料：通过率 100%
- 好友 notify 后 `getContacts()` 与事件一致：通过率 100%
- 401/403/400 已知错误映射正确：通过率 100%
- 旧版本 notify 不会回退新缓存：通过率 100%
- 新增事件、类型与文档说明齐全：通过率 100%

## 本期不新增 E2E 的依据

- 当前仓库没有“资料订阅管理”或“好友资料变化调试”浏览器 demo 主路径
- 033 的主要风险集中在 REST 映射、内部 notify 编排、`lastModified` 版本比较、运行时缓存与 manager 事件协作
- 这些风险由单元测试、集成测试、契约测试和类型测试覆盖更直接
- 若后续 demo 增加订阅管理界面或资料变化调试入口，再补对应 E2E

## 待记录实测

### 建议执行命令

```bash
npm run test:run -- tests/unit/managers/user-info-manager-subscription.test.ts tests/unit/managers/contact-manager-friend-info.test.ts tests/unit/core/message/message-receiver-user-info-notify.test.ts tests/types/user-info-subscription-types.test.ts
npm run test:run -- tests/integration/user-info-manager/user-info-subscription.integration.test.ts tests/integration/contact-manager/contact-manager.integration.test.ts tests/integration/mock/manager-public-api.test.ts
npm run test:run -- tests/contract/user-info-subscription.contract.test.ts
npm run lint
npm run type-check
npm run docs:api:check
npm run test:gate:pr
```

### 实测结果

- 2026-04-24 已通过：
  - `npm run test:run -- tests/unit/core/message/message-receiver-user-info-notify.test.ts tests/unit/chat-client/user-info-notify.test.ts tests/unit/managers/contact-manager-friend-info.test.ts tests/unit/managers/user-info-manager-subscription.test.ts tests/types/user-info-subscription-types.test.ts tests/contract/user-info-subscription.contract.test.ts tests/integration/user-info-manager/user-info-subscription.integration.test.ts tests/integration/mock/manager-public-api.test.ts tests/integration/contact-manager/contact-manager.integration.test.ts`
  - `npm run test:run -- tests/integration/cache/local-storage-quota.test.ts`
  - `npm run lint`
  - `npm run type-check`
  - `npm run docs:api:check`
  - `npm run test:gate:pr`（提权执行，因 mock/integration 需要监听 `127.0.0.1:*`）
- 2026-04-24 执行 `npm run test:run`：
  - 当前失败于与 033 无关的既有 upload / group-type 用例
  - 失败文件：`tests/integration/image-attachment-upload.integration.test.ts`、`tests/types/group-manager-types.test.ts`、`tests/unit/upload/attachment-uploader.test.ts`、`tests/unit/upload/image-upload-utils.test.ts`
  - 033 相关定向测试、静态检查、文档检查和 `pr_gate` 已全部通过

### 补充说明

- 若 `tests/integration/*` 依赖本地 mock server，可能需要和仓库现有 mock integration 一样在允许 `127.0.0.1:*` 监听的环境中执行
- 本次 `docs:api:check` 通过，但仍有仓库既有 TypeDoc warning：`PresenceManager` 对 `ManagerBase` / `ChatClient` / `SDKError` 的引用未纳入文档输出
- 033 的 contract 与实现都必须以 2026-04-23 补齐的三类真实 success 样例为准，尤其要覆盖 POST `usernames` body、DELETE `usernames` query 和 GET `data: string[]`
