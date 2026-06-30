# Demo 密码换 Token 登录计划

日期：2026-05-12

## 背景

当前 `demo` 登录面板同时展示了 `Token` 和 `Password` 输入框，但实际实现并不支持“用户名 + 密码”直登：

1. `LoginPanel` 会把 `password` 直接当成 `token` 传给 `onLogin`。
2. `App.tsx` 最终只调用 `client.login({ userId, token })`。
3. SDK 核心 WebSocket provision 只接受 token 鉴权，因此输入密码时会出现 `Provision rejected / Sorry, who are you?`。

这会造成 demo UI 与真实能力不一致，也会误导联调用户。

## 目标

1. 在 `demo` 中真正支持“输入 `userId + password` 后，先请求 token，再调用 SDK 登录”。
2. 保持现有 `userId + token` 登录路径继续可用。
3. 在页面日志与错误提示中明确区分：
   - token 直登失败
   - 密码换 token 失败
   - token 换取成功但 SDK 登录失败

## 非目标

1. 本次不修改 SDK 核心 `ChatClient.login()` 的鉴权模型。
2. 本次不新增 SDK 公开“密码登录”API。
3. 本次不改小程序 demo 登录流程。
4. 本次不引入新的服务端代理，仅复用现有 token 接口约定。

## 范围

- `demo/src/App.tsx`
- `demo/src/components/LoginPanel.tsx`
- 必要时新增 `demo/src` 下的轻量辅助函数或类型
- `tests/unit/demo/*` 中与登录面板、登录流程相关的测试
- 如需补充说明，再更新 `demo/README.md` 或根 `README.md`

## 方案

### 一、明确登录模式

为 demo 登录增加显式模式判断：

1. 输入了 `token` 时，走现有 token 登录。
2. 未输入 `token`、但输入了 `password` 时，先发起 token 换取请求。
3. 两者都为空时，维持当前前端校验报错。

页面日志中输出明确的 `loginMode=token` 或 `loginMode=password`，避免继续出现“密码被当 token”的误判。

### 二、补 token 换取请求

在 demo 层新增轻量 token 获取逻辑：

1. 请求现有文档中的 `/token` 接口。
2. 请求体沿用仓库 README 中的约定：
   - `grant_type: "password"`
   - `username: userId`
   - `password`
   - `timestamp: Date.now()`
3. 从响应中提取真正的 token，再调用 `client.login({ userId, token })`。

接口地址优先策略：

1. 优先复用 demo 当前配置可推导出的 `restBaseUrl`
2. 若仓库现有 demo 已固定 token 域名或另有环境变量约定，则对齐现有约定，不额外发明新配置

如果排查后发现 token 接口域名与 `restBaseUrl` 不是同一个地址，则在实现时显式固化规则，并补文档说明。

### 三、收敛 UI 文案与交互

1. `Password` 输入框文案从“如无 Token 可输入密码”升级为更准确的说明，明确其行为是“先换 token 再登录”。
2. 若用户同时填写了 `token` 和 `password`，默认优先 `token`，并在日志中说明。
3. 密码换 token 失败时，页面日志要给出独立错误前缀，便于联调定位。

### 四、测试补齐

补最小必要测试，优先覆盖 demo 层行为：

1. `LoginPanel`
   - token 优先于 password
   - 两者都为空时报错
2. `App` 登录流程
   - token 模式直接调用 `client.login`
   - password 模式先请求 token，再调用 `client.login`
   - token 接口失败时不应继续调用 `client.login`

如现有测试结构不适合覆盖 `App` 内部流程，可抽离小型 helper 后对 helper 做单测。

## 验证

计划中的验证顺序：

1. 定向单测：登录面板 / token 换取 helper / demo 登录流程
2. `npm run test:run`
3. 如本地验证成本可控，再补一次手工 demo 登录验证：
   - `userId + token`
   - `userId + password`

## 风险

1. token 接口的准确域名规则可能与当前 `restBaseUrl` 不完全一致，编码前需要先对齐仓库已有示例。
2. 若 token 接口存在跨域限制，password 模式可能只能在特定 demo 部署域下可用；这需要在文档中说清楚，不能伪装成 SDK 问题。
3. 如果服务端返回结构与 README 示例不完全一致，需要在 demo 侧做保守解析和错误提示兜底。

## 确认点

开始编码前需要你确认两件事：

1. 是否按本计划实现“demo 侧密码换 token 再登录”，且不改 SDK 核心登录 API。
2. 是否需要先新建分支再开始实现。
