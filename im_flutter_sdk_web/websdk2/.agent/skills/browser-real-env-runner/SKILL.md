---
name: browser-real-env-runner
description: Use this skill when the user asks to run websdk2 in a real browser on the host machine, including 在浏览器里跑、宿主浏览器联调、真实浏览器验证、双账号浏览器验证、页面里点一遍、帮我在浏览器里操作. This skill handles host browser execution, dynamic dev-server port discovery, escalation points, and step-by-step operation reporting.
---

# Browser Real Env Runner

该 skill 用于处理 `websdk2` 在宿主浏览器中的真实操作与联调，不负责替代真实环境判断或标准测试命令映射。

## 与其他 skill 的分工

- 真实环境是否应该跑、缺什么环境、失败归因：
  - 先结合 `real-env-test-runner`
- 标准 npm 测试命令怎么跑：
  - 先结合 `test-command-runner`
- 需要在宿主浏览器里实际打开页面、点击、登录、双账号联调、读取页面状态：
  - 使用本 skill

## 适用场景

- 用户明确要求“在浏览器里跑”
- 用户要求“帮我在页面上点一遍 / 操作一遍”
- 用户要求双账号浏览器联调
- 用户要求验证 demo 页面中的真实链路，而不是只跑 mock / unit / integration
- sandbox 内浏览器能力不可用，需要切换到宿主环境浏览器

## 核心规则

### 1. 不要假设端口固定

宿主环境 dev server 端口可能变化，不能写死 `3000` / `4173` / `5173`。

执行顺序：

1. 优先尝试约定端口启动 dev server
2. 如果端口占用，读取实际启动输出中的 `Local:` 地址
3. 将实际地址记录为本次联调的 `BASE_URL`
4. 后续所有浏览器脚本、打开页面、结果汇报都以该 `BASE_URL` 为准

如果用户已明确给出可访问地址，则优先使用用户提供的地址，不要重复启动。

### 2. 识别 sandbox / 宿主环境边界

常见现象：

- sandbox 内启动的 `vite`，宿主浏览器可能访问不到
- sandbox 内 `Playwright` 可能因系统权限失败
- 这时需要提权到宿主环境执行

遇到以下情况时，优先判断为“环境执行面问题”，不要直接归因到业务代码：

- `ERR_CONNECTION_REFUSED`
- 浏览器进程权限报错
- 本机端口从 shell 可见但宿主浏览器不可访问

### 3. 明确授权点

宿主浏览器联调时，常见需要提权的动作包括：

- 在宿主环境启动 `npm run dev`
- 在宿主环境运行浏览器脚本，例如 `node tmp/*.mjs`
- 需要宿主浏览器访问 `127.0.0.1` 的页面

每次提权前，要明确告诉用户本次提权用途，例如：

- 为了让宿主浏览器访问 demo，需要在宿主环境启动 dev server
- 为了真实点页面，需要在宿主环境运行 Playwright 脚本

### 4. 操作过程必须持续汇报

当用户要求“在浏览器里操作”时，不能只给最终结果。

至少要在 `commentary` 中持续汇报这些信息：

1. 准备使用哪种链路
   - in-app browser
   - sandbox Playwright
   - 宿主环境 Playwright
2. 实际使用的 `BASE_URL`
3. 当前使用的账号 / 目标对象
   - 需要脱敏时做脱敏
4. 当前正在执行的关键动作
   - 打开页面
   - 初始化
   - 登录
   - 发消息
   - 点击 `refreshSessionList`
   - 读取 SessionItem / 会话列表 / 日志
5. 一旦失败，立刻说明失败阶段
   - 页面打不开
   - 登录失败
   - 发消息失败
   - 会话未更新
   - refresh 后会话丢失

### 5. 输出结果要区分“操作失败”和“业务失败”

浏览器联调结束后，结论必须分层：

- 浏览器执行层
  - 页面是否打开
  - 是否成功登录
  - 是否成功点击和读到页面状态
- 业务链路层
  - 消息是否发送成功
  - `onConversationListSyncDidStart/Finish` 是否触发
  - `SessionItem` 是否出现
  - `refreshSessionList()` 后是否丢会话
- 环境层
  - 账号写错
  - token / password 不匹配
  - 目标用户不是 roster
  - `syncWsUrl` 未配置导致 `capability: unconfigured`

## 建议工作流

1. 先判断是否真的需要宿主浏览器
2. 确定 demo 页面来源：
   - 用户提供的现成地址
   - 需要本地启动 dev server
3. 如果本地启动：
   - 启动后读取实际 `Local:` 地址
   - 记录为 `BASE_URL`
4. 在浏览器里按步骤执行：
   - 打开 demo
   - 初始化
   - 登录
   - 操作目标功能
   - 读取日志 / 页面状态
5. 汇总时给出：
   - 实际地址
   - 实际账号
   - 实际观察到的页面状态
   - 对失败归因的判断

## 边界

- 不要把端口写死到 skill 中
- 不要把“浏览器执行层失败”误判成 SDK 业务缺陷
- 不要只返回命令成功/失败，要返回页面里实际观察到的状态
- 如果用户要求“页面内直接展示 Agent 操作”，这是代码改动需求，不是本 skill 本身能完成的事
