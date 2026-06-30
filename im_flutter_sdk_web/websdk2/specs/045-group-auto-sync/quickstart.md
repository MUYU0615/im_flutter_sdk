# 045 快速验证指南（Phase 1）

## 目标

验证登录后自动同步群组数据满足以下核心约束：

- `enableSyncData` 是唯一自动同步配置入口
- `enableAutoSyncContacts` 已移除
- `onSyncDataStart/onSyncDataFinished` 在 `ChatClient` 级注册监听
- `onContactSyncStart/onContactSyncFinish` 已移除
- `enableSyncData: ['group']` 登录后触发 group-sync 第二通道
- `GroupManager` 本地读取入口纯读缓存，不触发网络
- localStorage 只保存最多 100 个群组预览，登录后仍同步本轮最多 3000 个群
- `groupManager.getGroup(groupId)` 能使用已知轻量群组信息，但不隐式请求完整详情
- 第二通道缺失项不删除群，删除只认 MUC
- 第二通道 `cursor` 只用于同一轮断点续传
- 服务端单轮最多 3000 个群，超过时 SDK 在内部快照与结构化日志中保留 limited/incomplete 诊断状态

## 前置准备

1. 安装依赖：

```bash
npm install
```

2. 准备可用登录态：

- `appKey`
- `userId`
- `token`
- REST 地址
- sync websocket 地址或可返回 `sync-ws` 的 DNS 配置

3. 准备测试数据：

- 用户 A 加入 0 个群
- 用户 B 加入若干群且存在群名称/头像更新
- 用户 B 至少存在超过 100 个群的 mock 数据，用于验证 localStorage 预览裁剪
- 用户 C 加入超过 3000 个群或使用 mock 服务端模拟 3000 上限
- 可触发 MUC 删除/退群/踢出/销毁事件的群

## 验证步骤

### 步骤 1：静态检查

```bash
npm run lint
npm run type-check
```

期望：

- `enableAutoSyncContacts` 不再是有效公开初始化字段
- `onContactSyncStart/onContactSyncFinish` 不再是有效公开同步事件字段
- `onSyncDataStart/onSyncDataFinished` 可在 `ChatClient` 级类型中注册

### 步骤 2：配置开关矩阵

分别初始化：

```ts
await client.init({ enableSyncData: [] });
await client.init({ enableSyncData: ['contact'] });
await client.init({ enableSyncData: ['group'] });
await client.init({ enableSyncData: ['contact', 'group'] });
```

期望：

- 空数组不触发联系人或群组自动同步
- `['contact']` 只触发联系人同步
- `['group']` 只触发群组同步
- `['contact', 'group']` 两类都触发，状态互不污染

### 步骤 3：ChatClient 级统一事件

注册：

```ts
client.addEventHandler('sync-data-test', {
  onSyncDataStart: payload => {
    console.log(payload.dataType);
  },
  onSyncDataFinished: payload => {
    console.log(payload.dataType, payload.status, payload.error);
  },
});
```

期望：

- 群组同步开始：收到 `dataType: 'group'`
- 群组同步成功：收到 `status: 'success'`
- 群组同步失败：收到错误阶段
- 联系人同步开始/结束：收到 `dataType: 'contact'`
- 在 `ContactManager` / `GroupManager` 注册同步 start/finish 不再通过类型检查

### 步骤 4：群组同步主路径

在支持 joined-groups 第二通道环境中登录：

```ts
await client.init({
  enableSyncData: ['group'],
});
await client.login({ userId, token });
```

期望：

- 登录主链路成功
- group-sync 建立第二通道 websocket
- 请求携带当前用户，`type=12`，`last_sync_time=0` 或等价全量起点
- 首次请求不携带 `cursor`
- 响应批次全部合并后记录本轮完成元信息
- 响应帧 `type=13`；非最后一批返回 `cursor` 时只用于同一轮断点续传
- `onSyncDataFinished({ dataType: 'group' })` 派发

### 步骤 5：冷启动预览与同步后列表

在已有 localStorage 预览但本次登录同步未完成时读取：

```ts
const groups = client.groupManager.getJoinedGroupList();
```

期望：

- 不发起网络请求
- 返回最多 100 个本地预览
- 对外只返回群组轻量业务数组，不返回同步 meta

登录同步完成后再次读取：

```ts
const groups = client.groupManager.getJoinedGroupList();
```

期望：

- 返回当前会话同步得到的已加入群组轻量列表，最多 3000 个
- localStorage 中仍只持久化最多 100 个预览
- 受限、预览来源和 `lastSyncFinishedTs` 等诊断信息保留在内部快照与结构化日志中，不随 `onSyncDataFinished` payload 返回

### 步骤 5A：getGroup 使用已知轻量信息

```ts
const group = client.groupManager.getGroup(groupId);
```

期望：

- 若 `groupId` 存在于本地预览或当前会话同步结果中，`Group` facade 能携带名称、头像、描述、成员数、角色等已知轻量字段
- 不自动发起 `getDetail` 网络请求
- 若需要完整配置、成员、管理员或公告，调用方仍显式调用 `group.getDetail()` 或对应 API
- 若 `groupId` 未同步到，仍返回现有轻量 facade，不隐式请求详情

### 步骤 6：第二通道缺失项不删除

准备本地已有群 A/B/C，第二通道本轮只返回 A/B。

期望：

- 同步成功后 C 仍保留
- 不因缺失 C 写删除状态
- 后续只有 MUC 删除/退群/踢出/销毁才能移除 C

### 步骤 7：MUC 删除优先

触发群 D 的 MUC 销毁或用户被踢事件，然后让第二通道返回旧的群 D 数据。

期望：

- 本地已加入群组列表不恢复 D
- MUC 删除状态命中日志可诊断
- 若后续有更晚的重新加入事实，才允许恢复

### 步骤 8：update_at 冲突裁决

构造：

- MUC 先更新群 E 名称，时间为 2000
- 第二通道返回群 E 旧名称，`update_at=1000`

期望：保留 MUC 名称。

再构造：

- 第二通道返回群 E 新名称，`update_at=3000`

期望：允许更新为第二通道名称。

### 步骤 9：cursor 断点续传

构造 mock 服务端：

- 首次请求 `last_sync_time=0`，不带 `cursor`
- 第一批返回 `is_last_batch=false` 和 `cursor='3'`
- websocket 在第二批前断开

期望：

- SDK 保留当前轮次已确认批次和最新 `cursor`
- 恢复请求继续使用 `last_sync_time=0`，并携带 `cursor='3'`
- 续传成功后才提交本轮快照和完成元信息
- 续传失败不得把半成品标记为成功同步

### 步骤 10：服务端错误帧

分别模拟 `ErrorDetail(type=5)`：

- `1601` 请求参数无效
- `1602` 服务端获取群组失败
- `1002` 鉴权失败
- `1003` 请求限流

期望：

- SDK 均派发 `onSyncDataFinished({ dataType: 'group', status: 'failed' })`
- 错误 payload 包含可诊断 code、stage、retryable
- `1002` 映射为鉴权失败，需要重新登录或刷新 token
- `1003` 暴露可延迟重试语义

### 步骤 11：100 预览与 3000 上限

使用 mock 服务端返回 150 个群，验证 localStorage 只保存 100 个；再返回 3000 个群并标记受限，或真实环境中账号超过 3000 个已加入群。

期望：

- localStorage 预览条数不超过 100
- 当前会话列表可读取本轮同步的 150 个或最多 3000 个群
- SDK 不把内部结果标记为完整快照
- `onSyncDataFinished` 仅派发 `status: 'success'`；limited/incomplete 状态通过内部快照与结构化日志保留

### 步骤 12：账号切换

- 用户 A 登录并完成 group-sync
- 用户 A 登出
- 用户 B 登录并读取本地群组

期望：

- 用户 B 不读取用户 A 的群组快照
- 用户 A 未完成的 group-sync 响应不会写入用户 B 缓存

## 推荐验证命令

```bash
npm run test:run -- tests/unit/sync-data tests/unit/group-sync tests/unit/cache/joined-group-preview-cache.test.ts tests/unit/managers/group-manager-local-groups.test.ts
npm run test:run -- tests/integration/sync-data tests/integration/group-sync
npm run type-check
npm run lint
npm run test:gate:pr
```

若公开 API 文档和错误码表受影响：

```bash
npm run docs:api:check
npm run errors:check
```

浏览器 API 级 E2E：

```bash
npx playwright test tests/e2e/api/group-sync.spec.ts --project=chromium
```

## 本轮实测记录（2026-06-09）

已通过：

```bash
npm run type-check
npm run lint
npm run errors:check
npm run docs:api:md
npm run docs:api:check
npm run test:run -- tests/unit/chat-client-tree-shaking/auto-sync-dependencies.test.ts tests/unit/miniapp-demo/init-config.test.ts tests/unit/miniapp-demo/session-controller.test.ts tests/integration/miniapp-demo/init-login.integration.test.ts tests/unit/managers/contact-manager.test.ts tests/unit/group/group-repository.test.ts tests/unit/managers/group-manager.test.ts tests/integration/contact-sync/contact-sync-login.integration.test.ts tests/unit/protocol/joined-groups-codec.test.ts tests/unit/group-sync/group-sync.test.ts tests/integration/group-sync/group-auto-sync.integration.test.ts
```

未在本轮执行：

- `npm run test:gate:pr`
- `npx playwright test tests/e2e/api/group-sync.spec.ts --project=chromium`

未执行原因：本轮先完成 SDK 协议、登录调度、统一事件、缓存快照与文档检查；浏览器 E2E 需要额外补齐 `tests/e2e/api/group-sync.spec.ts` 场景后执行。
