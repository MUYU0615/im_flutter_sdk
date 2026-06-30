# 025 数据模型（Phase 1）

## 1) ContactMutationTarget

- **描述**: 联系人写操作的统一目标模型。
- **关键字段**:
  - `userId: string`
- **校验规则**:
  - `userId` 必须为非空字符串

## 2) AddContactInput

- **描述**: `addContact` 的输入模型。
- **关键字段**:
  - `userId: string`
  - `message?: string`
- **校验规则**:
  - `userId` 必填且非空
  - `message` 允许为空或缺省
- **返回语义**:
  - 成功返回 `void`

## 3) ContactInviteDecisionInput

- **描述**: `acceptContactInvite` 与 `declineContactInvite` 的统一输入模型。
- **关键字段**:
  - `userId: string`
  - `action: accept | decline`
- **校验规则**:
  - `userId` 必填且非空
- **返回语义**:
  - 成功返回 `void`

## 4) ContactRemarkUpdate

- **描述**: `setContactRemark` 的输入模型。
- **关键字段**:
  - `userId: string`
  - `remark: string`
- **校验规则**:
  - `userId` 必填且非空
  - `remark` 必须为字符串，可为空字符串
- **返回语义**:
  - 成功返回 `void`

## 5) BlocklistMutationInput

- **描述**: 黑名单增删接口的统一输入模型。
- **关键字段**:
  - `userIds: string[]`
- **校验规则**:
  - `userIds` 必须为非空数组
  - 数组元素必须为非空字符串
  - 重复用户 ID 在归一化前必须去重
  - 去重后必须保持剩余有效用户 ID 的相对顺序

## 6) UserInfo

- **描述**: 当前 SDK 对外暴露的黑名单条目对象。
- **关键字段**:
  - `userId: string`
- **映射规则**:
  - 来自 `getBlocklist` 成功响应中的 `data[]`
  - 每项至少包含 `userId`
  - 优先复用当前缓存中的用户资料，缺失时批量补拉默认资料字段
  - 当前阶段不向外透传 `uri/timestamp/entities/action/duration/count`

## 7) BlocklistSnapshot

- **描述**: 当前登录会话中的黑名单快照。
- **关键字段**:
  - `items: UserInfo[]`
  - `loaded: boolean`
  - `source: server | mutation_patch`
- **约束**:
  - 仅在当前会话内维护，不要求落盘持久化
  - 成功的黑名单增删操作必须同步修补当前快照

## 8) BlocklistAddResult

- **描述**: `addUsersToBlocklist` 成功后的标准化返回结果。
- **关键字段**:
  - `succeeded: UserInfo[]`
  - `failed: UserInfo[]`
- **映射规则**:
  - 来自服务端成功响应中的 `data[]`
  - 仅返回成功用户时，`data[] -> BlocklistAddResult.succeeded[]`，`failed` 为空数组
  - 若服务端返回可区分的失败项，失败用户归一化到 `failed[]`
  - 不包含传输包装字段

## 9) ContactMutationReconciliation

- **描述**: 联系人写操作成功后，对本地联系人快照采取的协调策略。
- **策略类型**:
  - `noop`: 不修改当前联系人快照（如 `addContact`、`declineContactInvite`）
  - `local_patch`: 直接在联系人缓存上应用本地补丁（如 `deleteContact`、`setContactRemark`）
  - `controlled_refresh`: 触发受控联系人刷新以获取完整快照（如 `acceptContactInvite`）

## 10) ContactRosterEvent

- **描述**: 原工程 roster 联系人事件的标准化对外载荷。
- **关键字段**:
  - `type: subscribe | unsubscribed | subscribed`
  - `from: string`
  - `to: string`
  - `status: string`
  - `rosterVersion?: string`
  - `userInfo: ContactUserInfo`
- **映射规则**:
  - `onContactInvited`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 必须带 `userInfo`
  - `userInfo` 至少包含 `userId`
  - 优先复用当前联系人/用户资料缓存；缓存缺失时按目标用户批量补拉默认资料字段
  - 资料补拉失败时仍派发事件，并保留最小 `userInfo`

## 11) GetBlocklistResponseEnvelope

- **描述**: 已确认的 `getBlocklist` 服务端成功响应包装结构。
- **关键字段**:
  - `uri`
  - `timestamp`
  - `entities`
  - `count`
  - `action`
  - `data: string[]`
  - `duration`
- **归一化规则**:
  - `data[] -> UserInfo[]`
  - `action = get`
  - `count` 仅作为服务端包装元信息保留在内部，不作为 SDK 对外数据模型字段

## 12) AddUsersToBlocklistResponseEnvelope

- **描述**: 已确认的 `addUsersToBlocklist` 服务端成功响应包装结构。
- **关键字段**:
  - `uri`
  - `timestamp`
  - `organization`
  - `application`
  - `entities`
  - `action`
  - `data: string[]`
  - `duration`
  - `applicationName`
- **归一化规则**:
  - `data[] -> BlocklistAddResult.succeeded[]`
  - `failed[]` 当前按空数组返回；若后续真实响应提供失败项则按 `UserInfo[]` 补齐
  - `action = post`
  - SDK 对外不暴露 `organization/application/applicationName`

## 13) RemoveUserFromBlocklistResponseEnvelope

- **描述**: 已确认的 `removeUserFromBlocklist` 服务端成功响应包装结构。
- **关键字段**:
  - `path`
  - `uri`
  - `timestamp`
  - `organization`
  - `application`
  - `entities`
  - `action`
  - `duration`
  - `applicationName`
- **归一化规则**:
  - 该响应不包含稳定业务数据
  - `action = delete`
  - SDK 对外返回 `void` 完成语义，不根据请求参数人为拼装结果对象

## 14) BlocklistAddNotFoundErrorEnvelope

- **描述**: `addUsersToBlocklist` 在请求中包含服务端不存在用户时的已知错误样例。
- **关键字段**:
  - `error: service_resource_not_found`
  - `exception: UserNotFoundException`
  - `timestamp`
  - `duration`
  - `error_description`
- **归一化规则**:
  - 统一映射到 SDK 错误模型
  - `error_description -> errorDescription`
  - 表示服务端判定整次黑名单添加失败；不同于可通过成功响应表达的部分成功

## 关系说明

- `AddContactInput`、`ContactInviteDecisionInput`、`ContactRemarkUpdate`、`BlocklistMutationInput` 均以 `ContactMutationTarget.userId` 为基础标识
- `GetBlocklistResponseEnvelope` 归一化为 `UserInfo[]`
- `AddUsersToBlocklistResponseEnvelope` 归一化为 `BlocklistAddResult`
- `RemoveUserFromBlocklistResponseEnvelope` 归一化为 `void`
- `BlocklistSnapshot` 由 `getBlocklist` 初次加载，并由黑名单成功写操作增量修补
- `ContactMutationReconciliation` 约束联系人写操作成功后应如何让 `getContacts()` 保持会话内一致
- `UserInfo` 与 `ContactRosterEvent.userInfo` 共享同一套联系人资料视图，均优先复用缓存，再受控补拉用户属性

## 状态语义

### 联系人写操作协调

- `addContact -> noop`：申请成功但未确认建联，不向当前联系人快照伪造新联系人
- `deleteContact -> local_patch`：从联系人缓存移除目标用户并重建快照
- `setContactRemark -> local_patch`：在联系人缓存中覆盖 remark 并重建快照
- `acceptContactInvite -> controlled_refresh`：成功后触发受控联系人刷新，以获得完整联系人投影
- `declineContactInvite -> noop`：拒绝申请不修改当前联系人快照

### 联系人事件与黑名单资料补齐

- `getBlocklist -> cache_first + fetch_fallback`：黑名单用户先复用当前会话缓存资料，仍缺失时批量查询用户资料，未命中则回退最小 `userInfo`
- `onContactInvited/onContactAdded/onContactRefuse/onContactAgreed -> cache_first + fetch_fallback`：事件派发前优先读取缓存资料，仍缺失时补拉用户资料，失败时仍派发事件

### 黑名单添加

- `pending -> succeeded`：服务端返回 `data[]`，SDK 输出 `BlocklistAddResult`
- `pending -> partial_succeeded`：服务端成功响应中若能区分失败项，SDK 仍返回 `BlocklistAddResult`，并把失败项放入 `failed[]`
- `pending -> failed`：服务端返回整单业务错误时，SDK 抛出统一错误

### 黑名单移除

- `pending -> succeeded`：服务端返回删除成功包装结构，SDK 输出 `void`
- `pending -> succeeded`：目标用户在服务端不存在时，当前已知样例仍返回成功
