# 021 快速验证指南（Phase 1）

## 目标

验证 `PushManager` 覆盖旧 Push/SilentMode 全能力，并满足本期澄清约束：

- 会话类型仅 `singleChat/groupChat`
- 时间区间按设备本地时区
- 批量查询上限 20 且超限报 `INVALID_PARAM (110)`
- 重复上传 token 幂等覆盖
- 旧 API 不兼容（仅新 API）

## 前置准备

1. 安装依赖：

```bash
npm install
```

2. 准备可用登录态（`restBaseUrl`、`token`、`appKey`、`userId`）。

3. 准备测试会话：至少 1 个单聊、1 个群聊会话。

## 验证步骤

### 步骤 1：基础静态检查与测试

```bash
npm run test:run
npm run lint
```

期望：现有能力全部通过，无回归。

### 步骤 2：Push token 上传与幂等覆盖

- 首次上传 `{ deviceId, deviceTokenA, notifierName }`
- 再次上传 `{ deviceId, deviceTokenB, notifierName }`

期望：两次均成功；最终绑定为 `deviceTokenB`，无重复绑定错误。

### 步骤 3：全局免打扰三种模式

- 设置提醒类型模式（`ALL/AT/NONE`）并查询回读
- 设置时长模式（`duration`）并查询回读
- 设置时间区间模式（`startTime/endTime`）并查询回读

期望：三种模式均可生效，且回读一致。

### 步骤 4：会话免打扰（单会话 + 清除）

- 对单聊设置规则并查询
- 对群聊设置规则并查询
- 调用清除提醒类型 API 并再次查询

期望：设置与查询一致；清除后恢复默认策略。

### 步骤 5：会话类型边界

- 传入 `chatRoom` 调用会话级接口

期望：立即返回 `INVALID_PARAM (110)`，`details.fields` 包含 `type`。

### 步骤 6：批量查询与超限

- 传入 2~5 个会话执行批量查询
- 传入 21 个会话执行批量查询

期望：

- 合法批量查询成功，返回会话维度正确
- 超限场景返回 `INVALID_PARAM (110)`，`details.fields` 包含 `conversationList`

### 步骤 7：语言设置与分页查询

- 设置并查询推送翻译语言
- 分页查询已设置提醒类型的会话（cursor 翻页）

期望：语言可回读；分页无重复无漏项。

### 步骤 8：旧 API 不兼容验证

- 调用旧方法名入口（若仍可访问）

期望：返回明确不可用/不存在语义，不存在“静默成功”。

## 验收清单（对应 spec）

- Push token 上传 + 幂等覆盖：通过率 100%
- 全局免打扰三模式回读一致：通过率 100%
- 会话级规则设置/清除/查询一致：通过率 100%
- 会话类型非法与批量超限：`INVALID_PARAM (110)` 命中率 100%
- 语言设置与分页结果：通过率 100%
- 旧 API 不兼容行为：可识别且稳定

## 实测记录（2026-02-26）

- `npm run test:run -- tests/unit/managers/push-manager.test.ts tests/contract/push-manager.contract.test.ts tests/types/push-manager-types.test.ts`：通过（3 files, 21 tests）
- `npx eslint src/managers/push-manager.ts src/types/push.ts tests/unit/managers/push-manager.test.ts tests/types/push-manager-types.test.ts tests/contract/push-manager.contract.test.ts`：通过
- `npm run type-check`：存在仓库既有失败（cache/connection/platform 等历史类型错误），本次 021 变更相关文件无新增报错
- 新增断言：`uploadPushToken/setGlobalSilentMode/setPushLanguage` 的服务端业务错误分别精确映射到 `1500/1501/1502`

## 常见失败定位

- 参数错误未命中：检查 `details.fields` 字段路径是否完整。
- 批量查询超限未报错：检查上限校验是否发生在发请求之前。
- 时间区间行为偏移：确认是否按设备本地时区解释。
- 重复 token 未覆盖：检查 `deviceId` 幂等键逻辑。
- 错误结构不一致：检查是否统一走 SDKError 契约。
