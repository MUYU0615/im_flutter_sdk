# 033 数据模型（Phase 1）

## 1) SubscribeUsersInfoParams

- **描述**: `subscribeUsersInfo` 的输入模型，用于为当前登录用户批量添加陌生人资料订阅。
- **关键字段**:
  - `userIds: string[]`
- **校验规则**:
  - `userIds` 必须为非空数组
  - 数组元素必须为非空字符串
  - 归一化前必须去重
  - 去重后必须保持剩余有效用户 ID 的相对顺序
  - 唯一用户 ID 数量不得超过 `metadataSubscriptionLimit = 100`
- **返回语义**:
  - 成功返回 `void`
- **上游映射**:
  - SDK `userIds` 归一化后映射到 upstream JSON body `usernames`

## 2) UnsubscribeUsersInfoParams

- **描述**: `unsubscribeUsersInfo` 的输入模型，用于为当前登录用户批量取消陌生人资料订阅。
- **关键字段**:
  - `userIds: string[]`
- **校验规则**:
  - `userIds` 必须为非空数组
  - 数组元素必须为非空字符串
  - 归一化前必须去重
  - 去重后必须保持剩余有效用户 ID 的相对顺序
- **返回语义**:
  - 成功返回 `void`
- **上游映射**:
  - SDK `userIds` 归一化后映射到 upstream query `usernames=a,b`

## 3) SubscribedUserInfoTarget

- **描述**: 当前登录用户已订阅的陌生人资料目标实体，用于表达订阅关系的最小业务语义。
- **关键字段**:
  - `userId: string`
  - `userInfo: UserInfo`
- **约束**:
  - 只表达“已订阅的陌生人”，不自动混入好友
  - 对外查询结果仍以 `ReadonlyArray<UserInfo>` 暴露，不额外暴露本地持久化订阅关系模型

## 4) SubscribedUserInfoList

- **描述**: `getSubscribedUsers()` 的标准化返回模型。
- **关键字段**:
  - `items: ReadonlyArray<UserInfo>`
- **约束**:
  - 返回对象对外实际表现为 `ReadonlyArray<UserInfo>`
  - 对外字段统一使用现有 `UserInfo` 驼峰语义
  - 不暴露 REST envelope、蛇形字段和原始用户名字符串数组
  - 由于 upstream GET success 的 `data` 仅返回用户名数组，SDK 需要先完成用户名列表到 `UserInfo` 的 hydrate，再生成最终结果

## 5) UserInfoNotifyPatch

- **描述**: 从 `subscribe_metadata_updated` / `contact_metadata_updated` 中抽取出的资料补丁实体，用于与当前资料真相做 patch merge。
- **关键字段**:
  - `userId: string`
  - `attributes: Partial<UserInfo>`
  - `lastModified: number`
  - `source: 'subscription' | 'contact'`
- **校验规则**:
  - `userId` 必填且非空
  - `lastModified` 必须为有效数字
  - `attributes` 允许只包含部分字段
  - 未出现在 `attributes` 中的字段不得被视为“删除”
- **映射规则**:
  - `metadata.avatarurl -> attributes.avatarUrl`
  - 其余公开字段按 `UserInfo` 驼峰规则归一化

## 6) UserInfoRawNotifyEvent

- **描述**: `MessageReceiver` 识别后转交 `ChatClient` 的 user-info 内部原始 notify 事件。
- **关键字段**:
  - `notifyType: 'subscribe_metadata_updated' | 'contact_metadata_updated'`
  - `userId: string`
  - `metadata: Record<string, unknown>`
  - `lastModified: number`
- **用途**:
  - 仅用于内部编排链路
  - 不直接暴露给 SDK 调用方
- **约束**:
  - 原始 notify 必须先归一化为该结构，才允许进入公开事件派发流程

## 7) UserInfoRuntimeRecord

- **描述**: 当前登录会话内完整用户资料运行时真相。
- **关键字段**:
  - `profile: UserInfo`
  - `lastModified: number`
  - `lastAccess: number`
  - `source: 'fetch' | 'update' | 'subscription_notify' | 'contact_notify'`
- **约束**:
  - 只保存在当前会话内存中，不要求直接落盘
  - `lastModified` 是版本比较的唯一可信依据
  - 当缓存中不存在对应用户时，可由 notify 建立最小可用 `profile`

## 8) UserInfoRuntimeStore

- **描述**: 会话级完整资料运行时真相容器，用于管理 `userId -> UserInfoRuntimeRecord`。
- **关键字段**:
  - `records: Map<string, UserInfoRuntimeRecord>`
  - `sessionKey: string | null`
- **校验规则**:
  - 同一 `sessionKey` 下，同一 `userId` 只能对应一份完整资料真相
  - `sessionKey` 变化时，旧 `records` 必须整体失效或清空
- **状态语义**:
  - `missing -> hydrated`: 首次查询/更新/notify 建立记录
  - `hydrated -> hydrated`: 新版本 patch merge 或显式更新
  - `hydrated -> ignored`: 收到旧版本 patch 时丢弃，不回退

## 9) UserInfoSummaryProjection

- **描述**: 从 `UserInfoRuntimeRecord` 投影到现有 `UserInfoSummary` 缓存模型的桥接结果。
- **关键字段**:
  - `userId`
  - `nickname`
  - `avatarUrl`
  - `sign`
  - `ext`
  - `lastAccess`
  - `lastUpdate`
- **约束**:
  - `lastUpdate` 必须保留服务端 `lastModified` 语义，不能被 `Date.now()` 覆盖
  - `mail` / `phone` / `gender` / `birth` 等完整字段允许只存在于运行时真相，不要求进入持久化摘要

## 10) SubscribedUserInfoChangedEvent

- **描述**: `onUserInfoUpdated` 的标准化对外事件载荷。
- **关键字段**:
  - `userInfo: UserInfo`
  - `lastModified?: number`
  - `source: 'subscription_notify'`
- **约束**:
  - 以最新 `userInfo` 为主语义
  - 不额外暴露 `changedFields`
  - 不直接透传原始 notify JSON

## 11) FriendInfoChangedEvent

- **描述**: `onContactInfoUpdated` 的标准化对外事件载荷。
- **关键字段**:
  - `userId: string`
  - `userInfo: UserInfo`
  - `contact?: Contact`
  - `lastModified?: number`
  - `source: 'contact_notify'`
- **约束**:
  - 至少必须包含 `userId` 与最新 `userInfo`
  - 当当前联系人关系快照可用时，可附带 `contact`
  - 即使 `remark` / `addTs` 不可用，也不得因此吞掉整条事件

## 12) ContactViewProjection

- **描述**: 好友资料变化后，从“联系人关系快照 + 最新 user-info 真相”重建出的联系人视图结果。
- **关键字段**:
  - `userId: string`
  - `userInfo: UserInfo`
  - `remark: string`
  - `addTs: number`
- **约束**:
  - `ContactManager.getContacts()` 继续基于关系快照与资料投影构建结果
  - 若只缺关系字段，则允许事件先派发最小 `FriendInfoChangedEvent`，后续读取再通过完整关系快照补齐

## 13) MetadataSubscriptionLimitState

- **描述**: 订阅边界与错误语义实体，用于表达当前账号在“最多订阅 100 人”和“最多被订阅 1000 人”两类限制下的校验与映射结果。
- **关键字段**:
  - `subscriptionLimit: 100`
  - `subscribedLimit: 1000`
  - `errorKind: 'subscriber_limit_exceeded' | 'target_limit_exceeded' | null`
- **约束**:
  - 订阅人数上限可在请求前做本地 fail-fast
  - 被订阅人数上限主要依赖服务端 400 错误样例映射

## 14) UserInfoSubscriptionErrorEnvelope

- **描述**: 033 订阅相关已知业务错误的统一内部映射模型。
- **关键字段**:
  - `httpStatus: 401 | 403 | 400`
  - `serverCode?: string | number`
  - `error?: string`
  - `exception?: string`
  - `errorDescription?: string`
  - `reasonKey: 'unauthorized' | 'service_forbidden' | 'subscriber_limit_exceeded' | 'target_limit_exceeded'`
- **归一化规则**:
  - 401 -> 鉴权失败
  - 403 -> 服务未开通 / 无权限
  - 400 + 超限样例 A -> 当前登录用户订阅数超限
  - 400 + 超限样例 B -> 目标用户被订阅数超限

## 15) SubscribeUserInfoChangesResponseEnvelope

- **描述**: 订阅新增接口的服务端成功响应包装结构。
- **关键字段**:
  - `path: string`
  - `uri: string`
  - `status: 'ok'`
  - `timestamp: number`
  - `organization: string`
  - `application: string`
  - `entities: unknown[]`
  - `count: number`
  - `data: string[]`
  - `duration: number`
  - `applicationName: string`
- **当前约束**:
  - `data` 表示本次成功订阅的用户名列表
  - SDK 对外业务语义固定为成功返回 `void`

## 16) UnsubscribeUsersInfoResponseEnvelope

- **描述**: 取消订阅接口的服务端成功响应包装结构。
- **关键字段**:
  - `path: string`
  - `uri: string`
  - `status: 'ok'`
  - `timestamp: number`
  - `organization: string`
  - `application: string`
  - `entities: unknown[]`
  - `count: number`
  - `data: string[]`
  - `duration: number`
  - `applicationName: string`
- **当前约束**:
  - `data` 表示本次成功取消订阅的用户名列表
  - SDK 对外业务语义固定为成功返回 `void`

## 17) GetSubscribedUserInfoListResponseEnvelope

- **描述**: 查询订阅列表接口的服务端成功响应包装结构。
- **关键字段**:
  - `path: string`
  - `uri: string`
  - `status: 'ok'`
  - `timestamp: number`
  - `organization: string`
  - `application: string`
  - `entities: unknown[]`
  - `count: number`
  - `data: string[]`
  - `duration: number`
  - `applicationName: string`
- **当前约束**:
  - `data` 表示当前已订阅用户名列表，而不是完整资料对象
  - 当 `data` 为空数组时，SDK 直接返回 `ReadonlyArray<UserInfo>` 空列表
  - 当 `data` 非空时，SDK 需要复用现有批量资料查询能力把用户名数组 hydrate 为 `ReadonlyArray<UserInfo>`

## 关系说明

- `SubscribeUsersInfoParams` 与 `UnsubscribeUsersInfoParams` 最终都归一化为 `void`
- `getSubscribedUsers()` 先消费 `GetSubscribedUserInfoListResponseEnvelope.data`，再通过现有 user-info 查询能力归一化为 `ReadonlyArray<UserInfo>`
- `UserInfoRawNotifyEvent` 先归一化为 `UserInfoNotifyPatch`，再进入 `UserInfoRuntimeStore`
- `UserInfoRuntimeRecord` 通过 `UserInfoSummaryProjection` 写入现有 `UserInfoSummary`
- `SubscribedUserInfoChangedEvent` 与 `FriendInfoChangedEvent` 共享同一份 user-info 运行时真相，但按 notify 类型分别归属 `UserInfoManager` 与 `ContactManager`
- `FriendInfoChangedEvent.contact` 由 `ContactViewProjection` 按当前联系人关系快照可用性决定是否附带

## 状态语义

### 订阅 API

- `pending -> succeeded`: 返回 `void` 或 `ReadonlyArray<UserInfo>`
- `pending -> failed`: 返回统一 SDK 错误
- `pending -> rejected_locally`: `userIds` 非法、为空或超过 100 人时 fail-fast，不发网络请求
- `listed_usernames_fetched -> hydrated_profiles`: 查询订阅列表时，先拿到 upstream 用户名数组，再批量补齐资料

### 订阅 notify

- `received -> normalized`: 原始 notify 被归一化为 `UserInfoNotifyPatch`
- `normalized -> merged`: 新版本 patch 合并到 `UserInfoRuntimeStore`
- `normalized -> ignored`: 旧版本 patch 被丢弃，不更新缓存、不派发事件
- `merged -> projected`: 完整资料投影到 `UserInfoSummary`
- `projected -> dispatched`: 派发 `onUserInfoUpdated`

### 好友 notify

- `received -> normalized`: 原始 notify 被归一化为 `UserInfoNotifyPatch`
- `normalized -> merged`: 新版本 patch 合并到 `UserInfoRuntimeStore`
- `merged -> contact_projected`: 基于关系快照重建联系人资料投影
- `contact_projected -> dispatched`: 派发 `onContactInfoUpdated`
- `merged -> dispatched_minimal`: 关系字段缺失时派发最小好友事件
