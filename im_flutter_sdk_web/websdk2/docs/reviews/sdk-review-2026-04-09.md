# SDK 工程评审报告（2026-04-09）

## 1. 评审范围

- 范围：`src/`、`tests/`、`package.json`、`vite.config.ts`、关键设计文档
- 目标：识别当前 SDK 工程里的实现问题、设计不合理点、可维护性风险与可执行的优化方向

## 2. 验证结论

本次评审实际执行了以下检查：

| 命令 | 结果 | 结论 |
| --- | --- | --- |
| `npm run test:run` | 通过（137 files, 528 passed, 2 skipped） | 测试广度不错，主链路回归能力存在 |
| `npm run type-check` | 失败 | 类型门禁已失效 |
| `npm run lint` | 失败 | 代码规范门禁已失效 |
| `npm run build` | 失败 | 当前版本无法稳定构建/发布 |
| `npm run test:coverage` | 失败 | 覆盖率门禁未达阈值 |

补充说明：

- `test:run` 与 `test:coverage` 在沙箱内会因为本地端口监听受限而误失败；本次已在提权环境复核，`test:run` 真实通过，`test:coverage` 真实失败。
- `test:coverage` 的真实结果为：`statements 82.75% / branches 76.56% / functions 84.22% / lines 82.75%`，未达到 `vitest.config.ts` 里配置的 `85 / 75 / 90 / 85` 阈值。

## 3. 优点

1. 测试层次已经成型。`unit`、`integration`、`contract`、`types`、`smoke` 基本齐全，`npm run test:run` 全量通过说明回归体系不是空架子。
2. 平台抽象方向是对的。`platform/`、`upload/`、`proto/`、`runtime/` 已经把跨端适配和协议编解码解耦出来，整体方向比把能力硬塞进 `ChatClient` 更健康。
3. Manager 化 API 基本形成统一风格。`ChannelManager`、`ContactManager`、`PushManager`、`UserInfoManager`、`GroupManager` 已有比较一致的入口模型，SDK 对外心智负担相对可控。

## 4. 主要问题

### P0. 构建门禁已经坏掉，当前版本不具备稳定发布条件

证据：

- `src/cache/cache-crypto.ts:30`
- `src/cache/conversation-cache.ts:42`
- `src/cache/conversation-cache.ts:45`
- `src/chat-client.ts:1057`
- `src/managers/group-manager.ts:502`

现象：

- `npm run build` 在 `tsc --project tsconfig.build.json` 阶段失败。
- `npm run type-check` 失败，且不只是测试代码报错，`src/` 本身就存在 strict mode 类型错误。
- `npm run lint` 失败，说明静态质量门禁没有保持常绿。

影响：

- 代码库已经出现“测试能过，但类型/构建不过”的分裂状态。
- 这类问题一旦进入 CI 或发布流程，会直接阻塞产物生成，也会削弱团队对门禁结果的信任。

建议：

1. 把 `build`、`type-check`、`lint` 恢复到全绿，作为第一优先级修复。
2. 修复后把这三项收敛为一个最小 PR gate，禁止再回退。
3. 对 `tests/**/*` 的 TS 报错单独治理，避免长期依赖 Vitest 转译掩盖测试类型问题。

### P0. 覆盖率门禁未达标，尤其是群组域实现覆盖明显偏低

证据：

- `vitest.config.ts:14-40`
- `src/managers/group-manager.ts`
- `src/managers/group/group.ts`
- `src/rest/group-management.ts`

现象：

- `npm run test:coverage` 真实失败。
- 全局覆盖率只有 `82.75 / 76.56 / 84.22 / 82.75`。
- 其中群组域是明显短板：
  - `group-manager.ts` 语句覆盖约 `57.7%`
  - `group/group.ts` 函数覆盖约 `10.52%`
  - `rest/group-management.ts` 函数覆盖约 `42.3%`

影响：

- 新近扩展的群组能力体量很大，但自动化保护明显不足。
- 这意味着群组域更容易出现“接口很多、看似完整、但回归保护不够”的情况。

建议：

1. 不要先降阈值，先补 `GroupManager / Group / rest/group-management` 的测试。
2. 群组域优先补三类测试：共享文件、成员属性、权限变更。
3. 对超大模块增加文件级最低阈值，避免全局覆盖率被其他模块“均摊掩盖”。

### P1. 包导出与构建策略明显漂移，Manager 子路径导出只做了一半

证据：

- `package.json:9-20`
- `vite.config.ts:5-8`
- `src/managers/contact/index.ts:1`
- `src/managers/push/index.ts:1`
- `src/managers/user-info/index.ts:5`
- `specs/015-manager-exports/spec.md:66-76`

现象：

- 源码里已经有多个 Manager 子路径入口。
- 但 `package.json` 只暴露了 `./managers/channel`。
- `vite.config.ts` 也只配置了 `channel` 的子入口。

影响：

- 对外“每个 Manager 可独立导入”的承诺没有真正落地。
- 用户无法稳定使用 `im-sdk-web/managers/contact`、`.../push`、`.../user-info` 等子路径。
- tree shaking 和按需引入的故事只完成了 `channel` 一个点，不是完整能力。

建议：

1. 用单一清单统一生成 `src/managers/*/index.ts`、Vite entries、`package.json.exports`。
2. 为所有公开 Manager 补上子路径 contract test。
3. 如果短期不想完整支持，就删掉相关 spec/文档承诺，避免接口预期和真实发布产物不一致。

### P1. 构建外置依赖配置错误，导致 protobuf 相关代码被整体打进产物

证据：

- `vite.config.ts:10-15`
- `src/platform/proto/static-proto-adapter.ts:5-15`
- `src/protocol/roster/root.ts:5-7`
- `src/platform/proto/proto-adapter.ts:5`

现象：

- 构建配置外置的是 `protobufjs-lite`，但代码实际依赖的是 `protobufjs`。
- `npm run build` 的输出里已经能看到大量 `dist/node_modules/protobufjs/**` 产物，并出现 `@protobufjs/inquire` 的 `eval` 警告。

影响：

- 包体增大。
- 构建产物与依赖声明不一致，后续 CDN / bundle 语义会越来越难维护。
- 这也是为什么当前“多入口、轻量导出”的目标没有真正达成。

建议：

1. 统一依赖策略，只保留一种 protobuf runtime。
2. 若要外置，则外置真实用到的 `protobufjs`；若不外置，就接受 bundle 体积并在文档说明。
3. 对构建产物增加 size snapshot，避免这类问题再次无声扩大。

### P1. Group 共享文件上传 API 的 Promise 语义不成立，异步设计不合理

证据：

- `src/managers/group-manager.ts:501-537`
- `src/managers/group/group.ts:195-200`
- `src/types/group.ts:242-257`

现象：

- `uploadGroupSharedFile()` / `group.uploadSharedFile()` 返回 `Promise<void>`。
- 但内部只是 `XMLHttpRequest.send()` 后立即返回，Promise 不会等待上传完成，也不会把失败作为 rejection 抛出。
- 真正结果只能通过回调拿到，导致 `await group.uploadSharedFile()` 没有业务语义。

影响：

- API 表面是 Promise 风格，实际是 callback 风格，调用者很容易误用。
- 无法自然接入 `try/catch`、取消、超时、重试链路。
- 这与 Constitution 里“异步操作优先 async/await、必须有超时/错误处理”的要求不一致。

建议：

1. 改为返回 `Promise<UploadResult>`，在 `load/error/abort/timeout` 时 resolve/reject。
2. 回调只作为可选观测接口，不能成为唯一结果通道。
3. 把上传能力尽量复用已有 `upload/` 目录的适配层，不要在 `GroupManager` 再手写一套 XHR 流程。

### P1. `ChatClient` 的单例设计和 Manager 挂载策略存在扩展性隐患

证据：

- `src/chat-client.ts:124-126`
- `src/chat-client.ts:214-265`
- `src/chat-client.ts:455-510`
- `src/chat-client.ts:1530-1540`

现象：

- `ChatClient` 被硬编码成进程级单例。
- `logout()` 会清理连接状态，但不会释放静态实例。
- `attachManager()` 遇到同名属性时直接 `return`，不会报错，也不会校验是否撞上 SDK 保留字段。

影响：

- 同一页面难以安全切换不同 `appKey` / 环境 / 沙箱实例。
- 自定义 Manager 一旦 key 与现有字段冲突，会出现“注册成功但实例没挂上 client”的隐性错误。
- 这会成为插件化和多租户场景的结构性障碍。

建议：

1. 至少提供显式 `destroy()`，允许完全释放单例。
2. 更好的做法是去掉全局单例，改成普通实例化客户端。
3. 对 Manager key 增加保留字校验；如果冲突必须抛错，不能静默跳过。

### P2. 文档和真实实现已经出现明显漂移，项目文档可信度下降

证据：

- `docs/process/project-summary.md:23-27`
- `docs/process/project-summary.md:36-80`

现象：

- 文档仍然把 `src/protocol/message-types.ts` 作为主要模块，但仓库中并不存在这个文件。
- `project-summary.md` 混入大量阶段性 TODO 和周报，已经不是“项目概览”，更像历史工作笔记。

影响：

- 新接手的人会被过期文档误导。
- 文档入口一旦不可信，大家最终只会回到直接读源码，文档投资被浪费。

建议：

1. `project-summary.md` 只保留稳定信息：架构、入口、目录、命令、测试分层。
2. 周报/TODO 移到 `plans/archive/` 或 `docs/decisions/`。
3. 对“概览类文档”建立季度清理机制，避免继续陈旧化。

## 5. 设计层面的总体判断

我对当前工程的总体判断是：

- **方向基本对**：Manager 化、平台抽象、分层测试这些大方向没有问题。
- **工程纪律在回退**：测试能跑，但构建、类型、lint、覆盖率都不绿，说明交付纪律已经松动。
- **热点模块不够收敛**：`ChatClient`、`GroupManager`、`rest/group-management.ts` 都偏大，职责边界还不够清晰。
- **文档和发布面开始漂移**：spec、源码、构建产物、概览文档之间已经出现不一致。

换句话说，这个仓库不是“架构推倒重来”的问题，而是“已经形成可用骨架，但需要尽快把工程一致性重新拉回正轨”的问题。

## 6. 建议的改进顺序

### 第一阶段：先把门禁拉回绿色

1. 修复 `build`、`type-check`、`lint` 失败项。
2. 修复 `test:coverage` 阈值不达标问题，重点补群组域测试。
3. 将上述 4 项固化为 PR 必跑门禁。

### 第二阶段：收敛发布面和导出面

1. 补齐所有 Manager 子路径导出。
2. 修正 protobuf 外置配置和 bundle 策略。
3. 为 package exports 建 contract test，避免再次漂移。

### 第三阶段：处理 API 设计债务

1. 重构共享文件上传/下载 API，统一 Promise 语义。
2. 处理 `ChatClient` 单例和 Manager key 冲突问题。
3. 逐步拆分超大文件：
   - `src/chat-client.ts`
   - `src/managers/group-manager.ts`
   - `src/rest/group-management.ts`

### 第四阶段：清理文档与规范一致性

1. 删掉过期 summary / 周报式文档内容。
2. 让 spec、exports、构建产物保持自动一致。
3. 对外 API 文档补齐群组共享文件等当前漏项。

## 7. 如果只做三件事，我建议先做什么

1. 修掉 `build + type-check + lint`，恢复最基本的发布可信度。
2. 补齐群组域覆盖率，把 `test:coverage` 拉回阈值之上。
3. 统一 Manager 子路径导出与构建配置，解决“源码有、发布没有”的设计漂移。
