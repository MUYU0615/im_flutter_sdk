# Contract: Group Internal OO Pilot Public Behavior

## Purpose

定义 `032-group-internal-oo-pilot` 在对外公开面必须保持的行为契约。  
这是 SDK 公开行为契约，不是 HTTP / REST 契约。

## 1. Public API Stability

### 1.1 `client.groupManager`

```ts
const client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager);
client.groupManager;
```

**Contract**

- `client.groupManager` MUST 继续可用
- `GroupManager` 的公开注册与访问方式 MUST 与 027 保持一致

### 1.2 `groupManager.getGroup(groupId)`

```ts
const group = client.groupManager.getGroup('group-1');
```

**Contract**

- 返回值 MUST 继续是公开 `Group` handle
- 返回值 MUST NOT 直接暴露内部运行时对象
- `group.groupId` MUST 继续等于传入的 `groupId`

## 2. List and Detail Results

### 2.1 Group Lists

```ts
const list = await client.groupManager.getJoinedGroupList();
```

**Contract**

- `list.items` MUST 继续为 plain data `GroupSummary[]`
- 列表结果 MUST NOT 变成富对象数组
- 调用方本地修改列表项 MUST NOT 影响 SDK 内部运行时真相

### 2.2 Group Detail

```ts
const detail = await client.groupManager.getGroup('group-1').getDetail();
```

**Contract**

- 返回值 MUST 继续为 `GroupDetail`
- 返回值 MUST 为独立快照
- 快照 MUST NOT 暴露内部可变引用

## 3. Public Handle Semantics

### 3.1 Handle Behavior

```ts
const group = client.groupManager.getGroup('group-1');
await group.getDetail();
await group.getMembers();
```

**Contract**

- `Group` 继续作为公开单群句柄存在
- `Group` 可以访问更新后的内部真相
- `Group` 本身 MUST NOT 成为独立状态真相

### 3.2 Async Boundary

**Contract**

- 任何需要网络访问的方法 MUST 继续显式返回 Promise
- 032 MUST NOT 引入属性式隐式网络加载

## 4. Event Contract

### 4.1 Event Registration

```ts
client.groupManager.addEventHandler('group-ui', {
  onSpecificationChanged: payload => {},
});
```

**Contract**

- 事件注册方式 MUST 与 027 保持一致
- 032 MUST NOT 改变 `addEventHandler/removeEventHandler` 形态

### 4.2 Event Payload Consistency

**Contract**

- 关键群事件 MUST 先更新内部真相，再导出公开 payload
- `onSpecificationChanged` / `onStateChanged` MUST 继续提供满足 027 语义的完整群对象 payload
- 用户资料补齐失败时，事件 MUST 继续派发，并回退最小用户视图

## 5. Snapshot Isolation

**Contract**

- SDK 对外返回的 `GroupSummary`、`GroupDetail` 和事件群对象 MUST 具有快照语义
- 调用方修改这些对象，MUST NOT 影响后续 SDK 主动读取结果

## 6. Session Isolation

**Contract**

- group 域内部运行时真相 MUST 与当前 client 会话绑定
- client 重建、用户切换或等价生命周期变化后，旧会话内部对象 MUST NOT 泄漏到新会话

## 7. Runtime Invalidation

**Contract**

- `onUserRemoved` / `onGroupDestroyed` 到达后，对应 `groupId` 的 internal runtime MUST 被删除，而不是仅保留为陈旧快照
- `group.destroy()` / `group.leave()` 成功后，对应 `groupId` 的 internal runtime MUST 被删除
- runtime 被删除后，同一公开 `Group` handle 再次调用 `getDetail()` MUST 重新发起详情读取，而不是继续命中过期 detail

## 8. Follow-up Template

后续 chatroom/contact/user-info 对齐 032 时，应优先复用以下边界：

- internal runtime 与 public handle 分离
- repository 作为唯一 identity map 入口
- snapshot mapper 负责 DTO 快照导出
- 事件先收敛内部真相，再导出公开 payload
- `stale` 与 `delete runtime` 两类失效语义显式区分

以下内容仍应保留为 group 领域特例，不要求机械复用：

- `memberCount` 的事件增量 patch 规则
- `owner` / `muteAllMembers` 等字段的 patch 优先级
- group 域特有的 allowlist / mute list / shared file 读取面

## 9. Explicit Non-goals

以下内容不属于 032：

- 改写 027 已交付的公开 API 名称
- 列表返回 `Group[]`
- 公开暴露内部 `InternalGroup`
- 同步实现 chatroom/contact/user-info 的内部对象化
