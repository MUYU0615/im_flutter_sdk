# 032 快速验证指南

## 目标

验证 Group 内部对象化试点满足以下核心约束：

- 027 既有公开 API 契约不变
- `client.groupManager` 和 `groupManager.getGroup(groupId)` 主调用方式不变
- 群列表继续返回 plain data
- `Group` 继续是 public handle，不是内部真相对象
- 同一 `groupId` 的列表、详情、事件和 handle 链路围绕同一内部运行时真相协作
- 关键群事件先更新内部真相，再导出标准化 payload
- 外部 DTO 修改不会污染内部状态
- client 会话变化后，旧内部对象不会泄漏到新会话

## 前置准备

1. 安装依赖：

```bash
npm install
```

2. 准备 group 域现有测试基线：

- `tests/unit/managers/group-manager.test.ts`
- `tests/unit/group/`
- `tests/integration/group-manager/`
- `tests/integration/mock/manager-public-api.test.ts`
- `tests/types/group-manager-types.test.ts`

3. 准备关键验证场景：

- 列表读取后拿到 `GroupSummary`
- 通过 `getGroup(groupId)` 拿到 `Group`
- 详情读取后触发 `onSpecificationChanged`
- 先收到不完整状态事件，再触发受控详情补拉
- 用户资料补齐成功与失败两条路径
- client 生命周期切换或 manager 重新 bind

## 验证步骤

### 步骤 1：静态检查

```bash
npm run lint
npm run type-check
```

期望：

- group 公开类型、导出和 handle 语义没有回归
- 不存在把内部运行时对象暴露到公开类型面的情况

### 步骤 2：单元测试

```bash
npm run test:run -- tests/unit/managers/group-manager.test.ts tests/unit/group tests/types/group-manager-types.test.ts
```

期望：

- 同一 `groupId` 的内部对象复用语义正确
- `Group` 继续是 public handle，而不是内部实体
- snapshot mapper 导出的列表/详情/事件群对象保持快照语义
- 事件 patch、失效标记和详情补拉触发条件正确
- 用户资料补齐失败时主结果不丢失

### 步骤 3：集成测试

```bash
npm run test:run -- tests/integration/group-manager tests/integration/mock/manager-public-api.test.ts
```

期望：

- `client.groupManager` 主路径保持兼容
- `groupManager.getGroup(groupId)` 仍返回 `Group`
- 列表读取、详情读取、事件派发和 handle 调用围绕同一内部真相协作
- `onSpecificationChanged` / `onStateChanged` 继续返回满足 027 语义的完整群对象
- DTO 本地修改不会污染后续主动读取结果

### 步骤 4：手工验证关键语义

1. 获取群列表：

```ts
const list = await client.groupManager.getJoinedGroupList();
const group = client.groupManager.getGroup(list.items[0].groupId);
```

2. 获取详情并缓存快照：

```ts
const detail1 = await group.getDetail();
```

3. 派发同一群的规格变更事件或喂入等价 fixture
4. 再次读取详情：

```ts
const detail2 = await group.getDetail();
```

5. 修改第一次拿到的快照对象：

```ts
detail1.name = 'mutated locally';
```

6. 再次读取详情或重新取列表

期望：

- `detail1` 的本地修改不会影响后续 SDK 返回
- `detail2` 反映事件后的新状态
- 关键事件的 payload 与后续主动读取结果一致

### 步骤 5：生命周期隔离验证

1. 建立 client A，读取若干 group
2. 重新初始化 client 或模拟登出重登
3. 用新会话再次访问同一 `groupId`

期望：

- 新会话不会复用旧会话的内部运行时对象
- 不出现跨会话污染

## 已执行验证记录（2026-04-22）

### 聚焦 032 的已完成验证

```bash
npm run test:run -- tests/unit/group/group-event-sync.test.ts tests/unit/group/group-repository.test.ts tests/unit/group/group-snapshot-mapper.test.ts tests/unit/group/internal-group.test.ts tests/unit/group/group-event-mapper.test.ts tests/unit/group/group-event-user-info-resolver.test.ts
npm run test:run -- tests/unit/managers/group-manager.test.ts tests/unit/managers/group.test.ts tests/unit/chat-client/group-events.test.ts
npm run test:run -- tests/integration/group-manager/group-events.integration.test.ts
npm run test:run -- tests/integration/group-manager/group-manager.integration.test.ts
```

已覆盖结果：

- `InternalGroup` / `GroupRepository` / `GroupSnapshotMapper` / `GroupEventSync` 的状态迁移、快照隔离与 identity map 语义
- `client.groupManager.getJoinedGroupList()` 返回 plain data 快照且与内部状态隔离
- `groupManager.getGroup(groupId)` 持续返回公开 `Group` handle
- 会话切换后 repository 与公开 handle registry 同步清理
- `onSpecificationChanged` / `onStateChanged` / `onOwnerChanged` / 成员进出事件先收敛 internal runtime，再让后续 `group.getDetail()` 命中同一真相
- `onUserRemoved` / `onGroupDestroyed` 以及主动 `group.leave()` / `group.destroy()` 成功后，会删除对应群 runtime，下一次读取重新拉取

### 本轮 gate 结果（2026-04-22）

```bash
npm run lint
npm run type-check
npm run test:gate:pr
```

执行结果：

- `npm run lint`：通过
- `npm run type-check`：通过
- `npm run test:gate:pr`：通过

补充说明：

- 为让 `tests/integration/mock/*` 在本地启动 mock server，本轮 `npm run test:gate:pr` 以允许 `127.0.0.1:*` 端口监听的方式执行
- 本轮同时修复了 chat client 相关单测中的 `MockWebSocket` 过时行为：测试 double 现在会同时派发 `onopen/onmessage/onclose` 属性回调与 `addEventListener` 监听器，和当前平台 socket 适配器保持一致
- 修复后，`tests/unit/chat-client/auth.test.ts`、`tests/unit/chat-client/connection-events.test.ts`、`tests/unit/message/create-cmd-custom-message.test.ts`、`tests/unit/message/create-media-message.test.ts`、`tests/unit/message/create-text-message.test.ts` 均恢复通过

## 验收清单（对应 spec）

- 公开 API 不变：通过率 100%
- 列表仍返回 plain data：通过率 100%
- `Group` 仍为 public handle：通过率 100%
- 同一 `groupId` 内部真相唯一：通过率 100%
- 关键事件先更新内部再派发：通过率 100%
- DTO 修改不污染内部状态：通过率 100%
- 会话切换后内部对象隔离：通过率 100%

## 建议执行命令

```bash
npm run lint
npm run type-check
npm run test:gate:pr
```

如果需要更聚焦地验证 032，可先执行：

```bash
npm run test:run -- tests/unit/managers/group-manager.test.ts tests/unit/group tests/integration/group-manager tests/types/group-manager-types.test.ts
```
