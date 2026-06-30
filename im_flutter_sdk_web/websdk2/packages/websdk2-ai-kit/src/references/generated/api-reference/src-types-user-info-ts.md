---
id: generated/api-reference/src-types-user-info-ts
title: websdk2 API Reference - 用户资料类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/user-info.ts API Reference 分段。
---

## src/types/user-info.ts

### UserInfo

#### 说明

UserInfoManager 查询/更新成功后返回的标准化用户资料对象。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 用户 ID。 |
| nickname | `string` | 昵称。 |
| avatarUrl | `string` | 头像地址。 |
| mail | `string` | 邮箱。 |
| phone | `string` | 手机号。 |
| gender | `UserInfoAttributeValue` | 性别或自定义标识。 |
| sign | `string` | 签名。 |
| birth | `string` | 生日。 |
| ext | `string` | 扩展字段。 |

### UserInfoListener

#### 说明

用户资料事件监听器。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onOwnInfoUpdated | `(userInfo: UserInfo) => void` | 当前用户资料更新时触发。 |
| onUserInfoUpdated | `(userInfos: ReadonlyArray<UserInfo>) => void` | 他人资料通过消息补位更新时触发。 |

### FetchUserInfoByUserIdParams

#### 说明

按用户 ID 查询默认字段的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 目标用户 ID 列表。 |

### FetchUserInfoByAttributeParams

#### 说明

按用户 ID 与属性集查询资料的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 目标用户 ID 列表。 |
| attributes | `ReadonlyArray<UserInfoAttribute>` | 需要查询的资料属性。 |

### SubscribeUsersInfoParams

#### 说明

批量订阅陌生人资料变化的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待订阅的用户 ID 列表。 |

### UnsubscribeUsersInfoParams

#### 说明

批量取消订阅陌生人资料变化的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待取消订阅的用户 ID 列表。 |

### UserInfoRawNotifyEvent

#### 说明

@internal MessageReceiver 转发给 ChatClient 的用户资料原始 notify。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| notifyType | `UserInfoRawNotifyType` | - |
| userId | `string` | - |
| metadata | `Record<string, unknown>` | - |
| lastModified | `number` | - |

### UserInfoNotifyPatch

#### 说明

@internal 归一化后的用户资料补丁。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | - |
| attributes | `Partial<UserInfo>` | - |
| lastModified | `number` | - |
| source | `UserInfoNotifySource` | - |

### UpdateOwnInfoParams

#### 说明

当前用户整对象更新参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| nickname | `string` | 昵称；传空字符串表示清空。 |
| avatarUrl | `string` | 头像地址；传空字符串表示清空。 |
| mail | `string` | 邮箱；传空字符串表示清空。 |
| phone | `string` | 手机号；传空字符串表示清空。 |
| gender | `UserInfoAttributeValue` | 性别；`false` / `0` 也是合法值。 |
| sign | `string` | 签名；传空字符串表示清空。 |
| birth | `string` | 生日；传空字符串表示清空。 |
| ext | `string` | 扩展字段；传空字符串表示清空。 |

### UpdateOwnInfoByAttributeParams

#### 说明

当前用户单属性更新参数模型。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| attribute | `UserInfoAttribute` | 目标属性。 |
| value | `UserInfoAttributeValue` | 属性值。 |

### ServerUserInfoAttributes

#### 说明

@internal 服务端用户资料属性结构。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| nickname | `unknown` | - |
| avatarurl | `unknown` | - |
| avatarUrl | `unknown` | - |
| mail | `unknown` | - |
| phone | `unknown` | - |
| gender | `unknown` | - |
| sign | `unknown` | - |
| birth | `unknown` | - |
| ext | `unknown` | - |

### UserInfoFetchResponseEnvelope

#### 说明

@internal 查询接口真实响应 envelope。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| timestamp | `unknown` | - |
| data | `unknown` | - |
| lastModified | `unknown` | - |
| duration | `unknown` | - |

### UserInfoUpdateResponseEnvelope

#### 说明

@internal 更新接口真实响应 envelope。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| timestamp | `unknown` | - |
| data | `unknown` | - |
| lastModified | `unknown` | - |
| duration | `unknown` | - |

### UserInfoSubscriptionResponseEnvelope

#### 说明

@internal 订阅相关接口真实响应 envelope。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| path | `unknown` | - |
| uri | `unknown` | - |
| status | `unknown` | - |
| timestamp | `unknown` | - |
| organization | `unknown` | - |
| application | `unknown` | - |
| entities | `unknown` | - |
| count | `unknown` | - |
| data | `unknown` | - |
| duration | `unknown` | - |
| applicationName | `unknown` | - |
