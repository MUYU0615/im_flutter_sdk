# 026 数据模型（Phase 1）

## 1) UserInfoAttribute

- **描述**: 对外公开的用户资料属性枚举，供 `fetchUserInfoByAttribute` 与 `updateOwnInfoByAttribute` 使用。
- **允许值**:
  - `nickname`
  - `avatarUrl`
  - `mail`
  - `phone`
  - `gender`
  - `sign`
  - `birth`
  - `ext`
- **映射规则**:
  - `avatarUrl -> avatarurl`
  - 其余字段默认使用同名或约定映射
- **校验规则**:
  - 只能使用上述值
  - 不接受旧 Web 蛇形字段名作为公开输入

## 2) UserInfo

- **描述**: UserInfoManager 对外统一返回的用户资料业务对象。
- **关键字段**:
  - `userId: string`
  - `nickname?: string`
  - `avatarUrl?: string`
  - `mail?: string`
  - `phone?: string`
  - `gender?: string | number | boolean`
  - `sign?: string`
  - `birth?: string`
  - `ext?: string`
- **约束**:
  - 对外字段统一使用驼峰命名
  - 不直接暴露 envelope 中的 `timestamp`、`duration`
  - `lastModified` 作为内部归一化元数据使用，不作为当前阶段默认对外字段

## 3) FetchUserInfoByUserIdParams

- **描述**: 默认字段查询输入模型。
- **关键字段**:
  - `userIds: string[]`
- **校验规则**:
  - 必须为非空数组
  - 元素必须为非空字符串
  - 归一化前必须去重
  - 去重后保持剩余有效用户 ID 的相对顺序
- **返回语义**:
  - 成功返回 `ReadonlyArray<UserInfo>`

## 4) FetchUserInfoByAttributeParams

- **描述**: 显式属性查询输入模型。
- **关键字段**:
  - `userIds: string[]`
  - `attributes: UserInfoAttribute[]`
- **校验规则**:
  - `userIds` 规则同上
  - `attributes` 必须为非空数组
  - 每个属性值必须属于 `UserInfoAttribute`
  - 空属性数组不得退化为“查询全部”
- **返回语义**:
  - 成功返回 `ReadonlyArray<UserInfo>`

## 5) UpdateOwnInfoParams

- **描述**: 当前用户整对象更新输入模型。
- **关键字段**:
  - `nickname?: string`
  - `avatarUrl?: string`
  - `mail?: string`
  - `phone?: string`
  - `gender?: string | number | boolean`
  - `sign?: string`
  - `birth?: string`
  - `ext?: string`
- **校验规则**:
  - 至少一个字段存在
  - 空字符串为合法“清空字段”语义
  - `false` / `0` 为合法值，不得被真假值判断吞掉
- **返回语义**:
  - 成功返回 `UserInfo`

## 6) UpdateOwnInfoByAttributeParams

- **描述**: 当前用户单属性更新输入模型。
- **关键字段**:
  - `attribute: UserInfoAttribute`
  - `value: string | number | boolean`
- **校验规则**:
  - `attribute` 必填且必须属于 `UserInfoAttribute`
  - `value` 必须存在；空字符串为合法值
- **返回语义**:
  - 成功返回 `UserInfo`

## 7) UserInfoFetchResponseEnvelope

- **描述**: 查询接口当前已确认的服务端成功响应包装结构。
- **关键字段**:
  - `timestamp: number`
  - `data: Record<string, ServerUserInfoAttributes>`
  - `lastModified: Record<string, number>`
  - `duration: number`
- **归一化规则**:
  - `data.<userId> -> UserInfo`
  - `avatarurl -> avatarUrl`
  - `lastModified.<userId> -> internal.lastModified`
  - `timestamp` / `duration` 只保留在内部日志或调试上下文

## 8) UserInfoUpdateResponseEnvelope

- **描述**: 更新接口当前已确认的服务端成功响应包装结构。
- **关键字段**:
  - `timestamp: number`
  - `data: ServerUserInfoAttributes`
  - `lastModified: number`
  - `duration: number`
- **归一化规则**:
  - `data -> UserInfo`
  - `data` 表示当前用户已设置过的全部属性
  - `lastModified -> internal.lastModified`
  - `timestamp` / `duration` 不作为默认公开字段

## 9) ServerUserInfoAttributes

- **描述**: 服务端资料属性对象的内部映射模型。
- **关键字段**:
  - `nickname?: string`
  - `avatarurl?: string`
  - `mail?: string`
  - `phone?: string`
  - `gender?: string | number | boolean`
  - `sign?: string`
  - `birth?: string`
  - `ext?: string`
- **用途**:
  - 仅用于 REST 适配层和归一化层
  - 不直接导出给 SDK 调用方

## 10) UserInfoCacheProjection

- **描述**: 从 `UserInfo` 投影到现有 `UserInfoSummary` 缓存模型的桥接结果。
- **关键字段**:
  - `userId`
  - `nickname`
  - `avatarUrl`
  - `sign`
  - `ext`
  - `lastAccess`
  - `lastUpdate`
- **约束**:
  - 当前缓存层只持久化摘要字段
  - `mail` / `phone` / `gender` / `birth` 不要求进入现有持久化摘要
  - 查询/更新当次对外返回仍必须保留完整资料字段

## 关系说明

- `FetchUserInfoByUserIdParams` 与 `FetchUserInfoByAttributeParams` 最终都归一化为 `ReadonlyArray<UserInfo>`
- `UpdateOwnInfoParams` 与 `UpdateOwnInfoByAttributeParams` 最终都归一化为 `UserInfo`
- `UserInfoFetchResponseEnvelope` 与 `UserInfoUpdateResponseEnvelope` 共享 `ServerUserInfoAttributes`
- `UserInfo` 通过 `UserInfoCacheProjection` 写入现有 `UserInfoSummary` 缓存

## 状态语义

### 查询

- `pending -> succeeded`: 返回 `ReadonlyArray<UserInfo>`
- `pending -> failed`: 返回统一 SDK 错误
- `partial_hit -> succeeded`: 仅返回命中用户，不把未命中视为整体失败

### 更新

- `pending -> succeeded`: 返回 `UserInfo`
- `pending -> failed`: 返回统一 SDK 错误
- `succeeded -> cache_projected`: 将完整资料投影到现有摘要缓存模型
