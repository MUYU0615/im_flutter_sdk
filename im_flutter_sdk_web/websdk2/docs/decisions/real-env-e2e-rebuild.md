# 真实环境 E2E 重构计划

## 1. 目标

将当前基于 `demo/src/test-harness.tsx` 的本地状态机 E2E，替换为基于 `demo/src/App.tsx` 的真实 demo 页面 E2E，使 E2E 真正验证以下内容：

- SDK 初始化是否成功
- 登录并建立真实连接是否成功
- 发送消息是否成功，返回值与页面状态是否符合预期
- 真实环境下的关键浏览器端用户链路是否可用

## 2. 当前问题

当前 Playwright 用例通过 `/?harness=1` 进入 `TestHarness` 页面，只验证本地状态切换与计数更新，不验证真实 SDK 与真实环境：

- `btn-init` 仅本地设置 `initialized`
- `btn-connect` 仅本地设置 `connected`
- `btn-send` 仅本地递增发送/接收计数
- `btn-network-recover` 仅本地模拟 `reconnecting -> connected`

因此：

- 修改无效 `AppKey` 仍可通过
- E2E 不能证明 SDK 可连接真实环境
- E2E 不能证明真实消息链路或返回值正确

## 3. 重构原则

- 删除或停用当前不满足目标的 harness E2E 用例
- 新 E2E 必须基于真实 demo 页面，而不是本地状态机
- 新 E2E 只覆盖高价值主链路，不把大量异常协议测试搬到浏览器层
- 真实环境必需配置缺失时，应显式跳过或在严格模式下失败，不能“假通过”
- 保留 mock / real-env integration 的现有职责边界

## 4. 新 E2E 范围

### P0 用例

1. 初始化 SDK 成功
2. 登录并建立连接成功
3. 发送文本消息成功，页面日志与消息列表出现结果
4. 发送 API 返回成功后，消息状态进入 `sent`
5. 登出后状态恢复为未连接态

### P1 用例

1. 连续发送 2~3 条文本消息，页面可观察到稳定结果
2. 重复初始化不会导致页面进入异常状态
3. 登录失败时页面能给出明确错误日志

### 暂不纳入首轮 E2E

- Push 全链路
- Presence 全场景
- 复杂异常协议
- 多账号复杂编排
- 附件上传大文件链路

## 5. 实施步骤

### 步骤一：为真实 demo 页面补充稳定测试锚点

目标：

- 为初始化、登录、发送、日志、消息列表、状态展示补充 `data-testid`
- 避免 Playwright 依赖中文文案或脆弱 DOM 结构

涉及文件：

- `demo/src/App.tsx`
- `demo/src/components/InitPanel.tsx`
- `demo/src/components/LoginPanel.tsx`
- `demo/src/components/SendPanel.tsx`
- 可能补充 `MessagePanel.tsx`、`LogPanel.tsx`

### 步骤二：重写 E2E fixture

目标：

- 去掉对 `/?harness=1` 的依赖
- 直接打开 demo 主页面
- 封装真实初始化、登录、发送、登出流程
- 支持等待连接状态、日志、消息状态更新

涉及文件：

- `tests/e2e/fixtures/sdk-flow.ts`

### 步骤三：替换现有 E2E 用例

目标：

- 删除或重写基于 harness 的四个现有 spec
- 改为真实 demo 主链路 E2E

涉及文件：

- `tests/e2e/init-connect.spec.ts`
- `tests/e2e/send-receive.spec.ts`
- `tests/e2e/network-recover.spec.ts`
- `tests/e2e/snapshot-consistency.spec.ts`

说明：

- 文件可以保留原名，但测试内容必须改为真实 demo 场景
- 如果 `network-recover` 在真实环境下不稳定，可在首轮降级为单独后续任务

### 步骤四：补充 E2E 配置与文档

目标：

- 明确 E2E 依赖真实环境配置
- 说明 `demo/.env` 与根目录 `.env` 的使用关系
- 说明缺少真实环境配置时的行为

涉及文件：

- `tests/e2e/README.md`
- `playwright.config.ts`
- 可能补充 `demo/README.md`

## 6. 验证方案

至少执行以下验证：

1. `npx eslint` 检查改动文件
2. `npx prettier --check` 检查改动文件
3. `npm run test:e2e` 在具备真实环境配置时执行
4. 如有必要，单独运行真实环境核心集成测试，确认与新 E2E 不冲突

## 7. 风险

- 真实环境 E2E 更脆弱，依赖账号、网络与服务端状态
- demo 页面当前缺少稳定测试锚点，首轮需要补充
- 如果消息回显依赖对端账号，可能需要重新设计测试数据隔离策略
- 当前 demo 页签较多，若日志与消息展示结构不稳定，断言容易抖动

## 8. 成功标准

- 将无真实业务价值的 harness E2E 移除或替换
- E2E 修改无效 `AppKey` 或无效 `Token` 时不能继续“假通过”
- 至少有 3 条真实环境浏览器 E2E 能验证 SDK 主链路
- 新 E2E 的职责与 real-env integration、mock integration 边界清晰
