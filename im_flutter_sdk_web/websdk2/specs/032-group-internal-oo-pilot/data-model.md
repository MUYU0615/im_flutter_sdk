# Data Model: Group 内部对象化试点

## 1. InternalGroup

### Purpose

表示 group 域内部的唯一运行时真相，承载单个 `groupId` 在当前 client 会话内的已知状态、失效状态和事件 patch 合并结果。

### Fields

- `groupId`: `string`
- `summarySnapshot`: `GroupSummary | null`
- `detailSnapshot`: `GroupDetail | null`
- `loadedSummary`: `boolean`
- `isStale`: `boolean`
- `hasLoadedDetail`: `boolean`
- `lastPatchedAt`: `number | null`
- `lastHydratedAt`: `number | null`

### Validation Rules

- `groupId` 必填且为当前会话内唯一标识
- `detailSnapshot` 存在时，`summarySnapshot` 至少应可从中投影得到
- `isStale=true` 时，不允许把当前缓存视为完整详情真相

### State Transitions

- `empty -> summaryKnown`: 列表读取或最小 patch 导入后
- `summaryKnown -> detailKnown`: 详情读取成功后
- `detailKnown -> stale`: 事件原始字段不足以直接完成完整更新时
- `stale -> detailKnown`: 受控详情补拉成功后
- `detailKnown -> detailKnown`: 事件可安全增量 patch 时，例如 `owner`、`muteAllMembers`、`memberCount`

## 2. GroupRepository

### Purpose

作为 group 域内部对象的唯一访问入口，管理 `groupId` 到 `InternalGroup` 的 identity map，并负责列表、详情、事件和 handle 读取之间的状态收敛。

### Fields

- `groups`: `Map<string, InternalGroup>`
- `sessionKey`: `string | null`

### Validation Rules

- 同一 `sessionKey` 下，同一 `groupId` 只能对应一个 `InternalGroup`
- `sessionKey` 变化时，旧 `groups` 必须整体失效或清空
- repository 需要同时支持 `markStale(groupId)` 与 `delete(groupId)` 两类失效语义

### Relationships

- `GroupManager` 和 `Group` handle 都通过 `GroupRepository` 访问内部真相
- `GroupEventSync` 通过 `GroupRepository` 定位并更新 `InternalGroup`
- `GroupManager.groupRegistry` 仅缓存公开 `Group` handle，不再承担状态真相职责

## 3. GroupSnapshotMapper

### Purpose

负责把 `InternalGroup` 的当前已知状态导出为对外公开的 `GroupSummary`、`GroupDetail` 和事件 payload 所需的群对象快照。

### Outputs

- `toSummary(internalGroup): GroupSummary`
- `toDetail(internalGroup): GroupDetail`
- `toEventGroupDetail(internalGroup): GroupDetail`

### Validation Rules

- 输出对象必须是独立快照
- 输出中不得保留指向 `InternalGroup` 内部结构的可变引用

## 4. GroupEventPatch

### Purpose

表示从 group 原始事件中抽取出的内部状态变更片段，用于对 `InternalGroup` 执行局部更新、失效标记或触发补偿逻辑。

### Fields

- `groupId`: `string`
- `groupPatch`: `Partial<GroupDetail> | null`
- `shouldMarkStale`: `boolean`
- `groupName`: `string | undefined`

### Validation Rules

- `groupId` 必填
- `groupPatch` 与 `shouldMarkStale` 至少有一个具备实际变更意义
- 当当前 runtime 不存在 detail 时，允许基于 `groupName + groupPatch` 建立最小详情快照

## 5. GroupPublicHandle

### Purpose

表示对外暴露的 `Group` 句柄，绑定固定 `groupId`，承载单群上下文方法调用，但不持有自己的独立状态真相。

### Fields

- `groupId`: `string`

### Relationships

- 每次调用通过 `GroupRepository` 访问对应 `InternalGroup`
- 不缓存独立的 `GroupDetail` 或 `GroupSummary`

## 6. GroupSnapshot

### Purpose

表示对外暴露的 group 快照数据，包括列表项、详情对象和事件中的完整群对象。

### Variants

- `GroupSummary`
- `GroupDetail`
- Event payload `group`

### Validation Rules

- 快照可被调用方持久化、序列化和本地修改
- 调用方对快照的本地修改不得影响 `InternalGroup`

## 7. GroupSessionBoundary

### Purpose

表示 group 域内部运行时真相与 client 生命周期之间的隔离边界，用于决定 repository 何时清理。

### Triggers

- `GroupManager.bind(client)`
- client 重新初始化
- 登出/用户切换
- 明确的 manager 生命周期重建
- `onUserRemoved` / `onGroupDestroyed`
- `group.destroy()` / `group.leave()` 成功

### Rules

- 会话边界变化后，旧 `InternalGroup` 不能继续作为新会话真相使用
- 单群已失效时，应优先删除对应 runtime，而不是继续保留陈旧对象等待外部覆盖

## Derived Relationships

### List Read -> Repository

- `getJoinedGroupList` / `getPublicGroupList`
- `GroupSummary[]`
- 写入或更新 `InternalGroup.summarySnapshot`

### Detail Read -> Repository

- `getGroupInfo` / `group.getDetail`
- `GroupDetail`
- 写入或更新 `InternalGroup.detailSnapshot`

### Event -> Patch -> Repository

- 原始事件
- `GroupEventPatch`
- 更新 `InternalGroup`，再导出快照 payload
- 当前已落地的直接 patch 字段包括：`owner`、`muteAllMembers`、`memberCount`

### Handle -> Repository

- `groupManager.getGroup(groupId)`
- 返回 `GroupPublicHandle`
- 后续读取不直接持有状态真相，而是通过 repository 获取

## Non-goals in Data Model

- 不把 `InternalGroup` 暴露为公开导出类型
- 不把列表项升级为富对象数组
- 不在 032 中定义 chatroom/contact/user-info 的内部对象数据模型
