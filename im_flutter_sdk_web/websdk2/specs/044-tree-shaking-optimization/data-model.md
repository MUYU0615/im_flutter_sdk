# Data Model: ChatClient Tree-Shaking 优化

## Core Client

**Purpose**: SDK 始终加载的核心入口，负责初始化、连接生命周期、基础消息收发、缓存访问和 Manager 注册。

**Key Attributes**:

- `registeredManagers`: 已显式注册的 Manager 集合。
- `enabledOptions`: 初始化时开启的核心或可选能力开关。
- `capabilityRegistry`: 已注册 Manager 暴露的可选能力索引。

**Validation Rules**:

- 不能 runtime import 或实例化可选 Manager。
- 只能向已注册 Manager/capability 路由对应域通知。
- 开启可选同步开关前必须校验依赖 capability 是否存在。

## Optional Manager

**Purpose**: 调用方显式选择的域能力，例如 Chat、Group、ChatRoom、Contact、UserInfo、Presence、Push、ChatThread。

**Key Attributes**:

- `key`: Manager 注册键。
- `capabilities`: Manager 提供的能力，例如 `rawNotify:group`、`userInfo:read`、`group:namecard`。
- `eventHandlers`: Manager 管理的公开事件订阅。

**Relationships**:

- 由 Core Client 显式注册。
- 可向 Core Client 暴露 capability。
- 可依赖其他显式 capability，但必须在启用相关功能前校验。

**Validation Rules**:

- Manager 只能处理自己声明的域通知。
- Manager 不能要求 `ChatClient` 隐式创建其他 Manager。

## Optional Capability Dependency

**Purpose**: 表达某个开关或 Manager 功能需要的显式能力。

**Key Attributes**:

- `optionName`: 触发依赖的配置项或功能名，例如 `enableAutoSyncContacts`。
- `requiredCapability`: 所需能力，例如用户资料读取、群组资料读取。
- `requiredManagerHint`: 面向用户的建议 Manager 名称。
- `failureTiming`: 依赖缺失时的校验时机，优先初始化或登录前。

**Validation Rules**:

- 依赖缺失必须 fail fast。
- 错误信息必须包含 `optionName` 和 `requiredManagerHint`。
- 关闭 option 时不得加载该 option 的可选能力。

## Domain Notification

**Purpose**: 协议下行产生的原始域通知，可能属于 group、chatroom、contact、thread、user-info 等可选域。

**Key Attributes**:

- `domain`: 原始通知所属域。
- `payload`: 原始通知数据。
- `source`: 通知来源，例如实时下行、离线补偿或同步。

**State Transitions**:

- `received` → `ignored`: 未注册对应 Manager/capability。
- `received` → `routed`: 已注册对应 Manager/capability。
- `routed` → `dispatched`: Manager 成功生成公开业务事件。
- `routed` → `failed`: Manager 处理失败并按现有错误/日志策略处理。

**Validation Rules**:

- Core Client 不构建域公开 payload。
- 未注册域通知不得影响核心连接和消息能力。

## Consumption Scenario

**Purpose**: 用于验证 tree-shaking 的代表性消费入口。

**Examples**:

- `core-only`: 只导入并初始化 `ChatClient`。
- `core-chat`: 导入 `ChatClient` 和 `ChatManager`。
- `core-group`: 导入 `ChatClient` 和 `GroupManager`。
- `core-contact-sync`: 开启联系人自动同步并显式注册所需能力。

**Validation Rules**:

- 每个场景必须有依赖图断言。
- size-sensitive 场景必须使用推荐子路径导入。

## Bundle Size Baseline

**Purpose**: 记录消费场景构建产物的体积和依赖图预期。

**Key Attributes**:

- `scenario`: 消费场景名。
- `includedRuntimeModules`: 实际进入 bundle 的运行时模块。
- `forbiddenRuntimeModules`: 该场景不允许出现的模块模式。
- `minifiedBytes`: 压缩后体积记录。
- `toolchain`: 构建工具或小程序等价验证环境。

**Validation Rules**:

- `forbiddenRuntimeModules` 命中时检查失败。
- 体积阈值用于趋势预警，依赖图泄漏用于硬失败。
