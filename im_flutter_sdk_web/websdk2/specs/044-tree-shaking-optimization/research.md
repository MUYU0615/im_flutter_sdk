# Research: ChatClient Tree-Shaking 优化

## Decision 1: 可选域能力必须显式注册，不允许 `ChatClient` 隐式创建 Manager

**Decision**: `ChatClient` 不再 runtime import 或 `new` `UserInfoManager`、`GroupManager`、`ChatRoomManager` 等可选 Manager。所有可选域能力只能来自显式注册的 Manager 或显式 capability。

**Rationale**: 隐式创建 Manager 会把可选域代码重新拉入核心依赖图，直接破坏 tree-shaking 目标。显式注册让用户能从导入语句和初始化配置中预测包体积。

**Alternatives considered**:

- 保持当前隐式 `UserInfoManager` 辅助实例：兼容性好，但核心入口继续硬引用用户资料域，不符合 spec。
- 使用动态 import 延迟加载 Manager：可减少首包，但仍让 `ChatClient` 拥有域知识；小程序构建链对动态 import 支持不稳定。

## Decision 2: 自动同步缺依赖时 fail fast，而不是 no-op

**Decision**: 当调用方开启联系人自动同步、profile-sync 或未来群组自动同步，但缺少所需 Manager/capability 时，SDK 必须在初始化或登录前抛出可操作配置错误。

**Rationale**: 用户显式开启同步代表期望功能生效。静默 no-op 会造成数据不一致且难排查；隐式加载 Manager 会破坏包体积。fail fast 同时保证行为可靠和依赖显式。

**Alternatives considered**:

- 缺依赖时静默降级：更宽容，但容易让调用方误以为同步已开启。
- 缺依赖时只打 warning：线上容易被忽略，不能满足可靠性要求。

## Decision 3: raw notify 路由保留在核心，域级解释下放到 Manager

**Decision**: 核心仍负责从消息接收链路识别 raw notify 类型并路由给已注册 Manager/capability；raw payload 的域级规范化、用户资料补全、详情拉取和公开事件派发由 Manager 负责。

**Rationale**: `MessageReceiver` 已经是协议与事件的入口，完全移除核心识别会牵涉 protocol codec 大拆分。保留轻量路由可控制改动范围，同时把主要体积泄漏从 `ChatClient` 移出。

**Alternatives considered**:

- 协议 codec 由 Manager 注册解码器：长期最干净，但改动大，风险高，适合作为独立 spec。
- `ChatClient` 继续构建业务 payload 后再交给 Manager：不能解决当前 God Object 和硬引用问题。

## Decision 4: 小程序/size-sensitive 场景推荐 Manager 子路径导入

**Decision**: 文档应优先推荐 `im-sdk-web/managers/*` 子路径导入 Manager；主入口聚合导出可保留兼容，但不作为小程序包体积敏感场景的推荐方式。

**Rationale**: 现代 Web 打包器通常能处理主入口 re-export，但小程序工具链、CJS 转译、IIFE 和保守构建配置可能导致 tree-shaking 失效。子路径导入能减少对下游 DCE 能力的依赖。

**Alternatives considered**:

- 只保留主入口导入文档：使用简单，但 size-sensitive 场景风险较高。
- 移除主入口 Manager 导出：最干净，但破坏性过大，不是本期必要条件。

## Decision 5: bundle gate 以依赖图泄漏为主，体积预算为辅

**Decision**: 自动化检查优先断言未注册 Manager runtime 模块是否出现在消费场景依赖图中；体积阈值作为辅助趋势指标。

**Rationale**: 体积会受压缩器、依赖版本、源码注释和共享模块影响，容易产生噪声。依赖图能直接判断 tree-shaking 边界是否被破坏。

**Alternatives considered**:

- 只检查 minified KB：直观但不稳定。
- 只做人工 bundle visualizer：适合分析，不适合作为 CI 门禁。

## Decision 6: 本期不强制拆分 protocol codec 与 `api-errors.json`

**Decision**: MSync codec 单体拆分和 `api-errors.json` 按域分片暂不作为本期核心交付；本期重点消除 `ChatClient` 对 Manager、域 REST 和域事件处理的硬引用。

**Rationale**: codec 和错误码分片收益存在，但范围大、回归面广。先移除明显 God Object 泄漏能更快让架构按需能力成立。

**Alternatives considered**:

- 本期同时做 codec 插件化：架构更彻底，但会显著扩大协议回归风险。
- 本期同时拆错误码映射：可能有额外体积收益，但需要 REST 错误治理脚本和文档生成联动，适合后续独立任务。
