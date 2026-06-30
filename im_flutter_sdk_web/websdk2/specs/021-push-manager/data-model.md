# 021 数据模型（Phase 1）

## 1) PushTokenBinding

- **描述**: 设备推送绑定请求模型（成功仅返回 `void`）。
- **关键字段**:
  - `deviceId`: 设备唯一标识（必填）
  - `deviceToken`: 推送 token（必填）
  - `notifierName`: 推送通道标识（必填）
- **校验规则**:
  - 三个输入字段均为非空字符串
  - 相同 `deviceId` 重复上传必须幂等覆盖最新 `deviceToken`

## 2) SilentModeRule

- **描述**: 免打扰规则统一模型。入参与出参语义分离：入参使用 `mode` 判别，出参直接返回可并存字段。
- **入参规则类型**:
  - `mode = REMIND_TYPE`：`remindType`（`ALL | AT | NONE`）
  - `mode = DURATION`：`duration`（正整数秒）
  - `mode = INTERVAL`：`startTime` + `endTime`（小时分钟）
- **出参字段**:
  - `remindType`: 当前推送通知方式
  - `expireTimestamp`: 时长免打扰模式的到期时间戳（毫秒）
  - `silentModeStartTime` / `silentModeEndTime`: 每日免打扰时间段
  - 允许同时返回多字段（例如 `remindType` 与 `expireTimestamp` 同时存在）
- **校验规则**:
  - 入参单次请求只能命中一种 `mode`
  - `INTERVAL` 模式下开始与结束时间必须合法；开始与结束时间可相等（表示全天或关闭，具体语义由服务端定义）

## 3) ConversationTarget

- **描述**: 会话级免打扰操作目标。
- **关键字段**:
  - `conversationId`: 会话 ID
  - `type`: `singleChat | groupChat`
- **校验规则**:
  - `conversationId` 必填
  - `type = chatRoom` 直接判定参数错误（`INVALID_PARAM (110)`）

## 4) ConversationSilentModeSnapshot

- **描述**: 单会话或批量查询返回的会话免打扰快照。
- **关键字段**:
  - `target`: `ConversationTarget`
  - `rule`: `SilentModeRule`
  - `source`: `single_query | batch_query`
  - `updatedAt`: 最近更新时间
- **约束**:
  - 同一快照只对应一个会话与一条规则
  - 批量结果不得混淆单聊/群聊维度

## 5) BatchConversationQuery

- **描述**: 批量查询会话免打扰的输入模型。
- **关键字段**:
  - `conversationList`: 会话目标数组
- **校验规则**:
  - `conversationList` 必须为非空数组
  - `conversationList.length <= 20`
  - 超限时返回 `INVALID_PARAM (110)` 且 `details.fields.path = conversationList`

## 6) PushLanguagePreference

- **描述**: 推送翻译语言配置模型。
- **关键字段**:
  - `language`: 语言代码（必填）
  - `updatedAt`: 最近更新时间
- **校验规则**:
  - `language` 必须为非空字符串

## 7) MutedConversationPage

- **描述**: 已设置提醒类型免打扰会话的分页结果模型。
- **关键字段**:
  - `conversations`: `ConversationSilentModeSnapshot[]`
  - `cursor`: 下一页游标
  - `pageSize`: 当前页大小
- **校验规则**:
  - `pageSize` 必须为正整数
  - `cursor` 允许为空（表示首页）

## 8) PushManagerError

- **描述**: PushManager 统一错误模型（对齐 005 错误规范）。
- **关键字段**:
  - `code: number`
  - `message: string`
  - `details?: object`
- **details 约束**:
  - 参数错误：必须包含 `fields[{ path, message, rule }]`
  - REST 传输错误：包含 `url/method/httpStatus?/timeout?`
  - REST 业务错误：包含 `api/serverCode/serverMessage?`

## 关系说明

- `PushTokenBinding` 与 `ConversationSilentModeSnapshot` 按用户维度关联
- `SilentModeRule` 作为全局与会话配置的核心子结构
- `BatchConversationQuery` 产生多个 `ConversationSilentModeSnapshot`
- `PushLanguagePreference` 与用户配置一对一
- `MutedConversationPage` 聚合多个会话快照用于分页浏览

## 状态流转

### Push Token 绑定状态

- `unbound` -> `bound`
- `bound` -> `bound`（同 `deviceId` 再次上传覆盖最新 token）
- `bound` -> `failed`（参数/网络/业务失败）

### 免打扰规则状态

- `empty` -> `active`（设置规则）
- `active` -> `default`（清除提醒类型）
- `active|default` -> `failed`（参数/网络/业务失败）
