# 021 研究记录（Phase 0）

## Decision 1: 旧 Push/SilentMode API 不做兼容别名

- **Decision**: 本期仅暴露新 `PushManager` API，旧方法名与旧参数形态不提供兼容层。
- **Rationale**: 规格已明确破坏性升级，直接切换可避免长期维护双轨 API 与行为分叉。
- **Alternatives considered**:
  - 保留旧 API 别名并标记废弃：迁移平滑，但会增加长期维护负担。
  - 仅内部重构不改接口：无法兑现“参数与返回值优化”的目标。

## Decision 2: 免打扰策略使用可判别联合类型建模

- **Decision**: 把三种免打扰语义（提醒类型、静默时长、时间区间）抽象为单一规则模型，并通过判别字段区分。
- **Rationale**: 可避免旧 `paramType + 可选字段` 的弱类型组合，降低参数冲突与歧义。
- **Alternatives considered**:
  - 继续使用数值 `paramType`：兼容性好，但可读性和类型约束弱。
  - 每种语义拆独立方法：类型清晰，但对外 API 数量过多。

## Decision 3: 会话免打扰仅支持 singleChat/groupChat

- **Decision**: 会话级接口只允许 `singleChat` 和 `groupChat`；传入 `chatRoom` 直接返回 `INVALID_PARAM (110)`。
- **Rationale**: 与已澄清规格一致，避免聊天室语义不完整导致的“看似支持、实际异常”。
- **Alternatives considered**:
  - 允许 chatRoom 并映射 group 策略：实现简单但语义不严谨。
  - 接受 chatRoom 后再返回“不支持”业务错误：不如参数错误直观。

## Decision 4: 时间区间模式固定设备本地时区

- **Decision**: 时间区间免打扰按设备本地时区解释，不增加显式时区参数。
- **Rationale**: 已完成澄清，且与移动端用户直觉一致，调用成本最低。
- **Alternatives considered**:
  - 统一 UTC：跨端一致但用户感知偏差大。
  - 调用方显式传时区：更精确但 API 成本更高。

## Decision 5: 批量会话查询超限统一参数错误

- **Decision**: 批量查询列表长度 `>20` 时，统一返回 `INVALID_PARAM (110)`，并在 `details.fields` 标记 `conversationList`。
- **Rationale**: 对齐 `005-error-handling` 的 fail-fast 原则，且易于调用方统一处理。
- **Alternatives considered**:
  - 映射为 Push 业务错误码（1500-1502）：语义不如参数错误直接。
  - 自动截断为 20：会隐藏调用方错误，导致结果不确定。

## Decision 6: Push Token 重复上传采用幂等覆盖

- **Decision**: 相同 `deviceId` 重复上传时覆盖为最新 `deviceToken`，返回成功。
- **Rationale**: 适配常见 token 轮换场景，减少因旧 token 失效导致的推送失败。
- **Alternatives considered**:
  - 要求先解绑再上传：流程复杂且不必要。
  - 忽略重复上传：可能保留过期 token。

## Decision 7: 错误模型遵循“参数/传输/业务”三分法

- **Decision**: PushManager 全量接口统一使用 SDKError 契约；参数错误、REST 传输错误、REST 业务错误分别映射。
- **Rationale**: 与现有 `RestClient`、`api-errors.json`、`specs/005-error-handling` 保持一致，降低学习和接入成本。
- **Alternatives considered**:
  - 直接透传原始 Error：不符合统一错误规范。
  - 每个 API 自定义错误结构：增加维护与测试复杂度。

## Decision 8: Push 业务错误码区间预留专用语义

- **Decision**: 在错误映射中预留并使用 Push 相关错误码区间（`1500-1502`），用于 push 领域业务失败识别。
- **Rationale**: 与 EMError 区间规划一致，利于统计和问题定位。
- **Alternatives considered**:
  - 只复用通用 REST 错误码：粒度不足，不利于 push 领域观测。
  - 使用字符串错误码：与当前数字错误码体系不一致。
